# syntax=docker/dockerfile:1
# Literary Studio — literarycraft/studio
#
# Build (full, with Python document conversion):
#   docker build -t literarycraft/studio:latest .
#
# Build (slim, Node only):
#   docker build --target runtime-slim -t literarycraft/studio:slim .

FROM node:22-bookworm-slim AS frontend-builder

WORKDIR /build/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build


FROM node:22-bookworm-slim AS backend-deps

WORKDIR /build/backend-node
COPY backend-node/package.json backend-node/package-lock.json ./
RUN npm ci --omit=dev


FROM node:22-bookworm-slim AS runtime-base

WORKDIR /app

COPY backend-node/package.json backend-node/package-lock.json ./backend-node/
COPY --from=backend-deps /build/backend-node/node_modules ./backend-node/node_modules
COPY backend-node/ ./backend-node/
COPY --from=frontend-builder /build/frontend/dist ./frontend/dist
COPY backend/ ./backend/
COPY skills/literary-writer/ ./skills/literary-writer/

ENV NODE_ENV=production \
    NODE_OPTIONS=--disable-warning=ExperimentalWarning \
    PORT=8765 \
    STUDIO_HOST=0.0.0.0 \
    LITERARY_STUDIO_DATA=/app/data \
    LITERARY_WRITER_ROOT=/app/skills/literary-writer

EXPOSE 8765
VOLUME ["/app/data"]

WORKDIR /app/backend-node

HEALTHCHECK --interval=30s --timeout=5s --start-period=45s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 8765) + '/api/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"


FROM runtime-base AS runtime-slim

USER root
# Claude Code CLI — required for Studio AI chat / skill workflows
RUN npm install -g @anthropic-ai/claude-code

# Avoid apt in slim image (helps slow/unreachable Debian mirrors on some servers)
ADD --chmod=755 https://github.com/tianon/gosu/releases/download/1.16/gosu-amd64 /usr/local/bin/gosu

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh \
  && mkdir -p /app/data \
  && chown -R node:node /app

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "server.js"]


FROM runtime-base AS runtime

ARG APT_MIRROR=
USER root
RUN if [ -n "${APT_MIRROR}" ]; then \
      sed -i "s|deb.debian.org|${APT_MIRROR}|g; s|security.debian.org|${APT_MIRROR}|g" /etc/apt/sources.list.d/debian.sources; \
    fi \
  && apt-get update \
  && apt-get install -y --no-install-recommends python3 python3-pip gosu \
  && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt /tmp/backend-requirements.txt
RUN pip3 install --no-cache-dir --break-system-packages -r /tmp/backend-requirements.txt \
  && rm /tmp/backend-requirements.txt

RUN npm install -g @anthropic-ai/claude-code

ENV PYTHON=python3

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh \
  && mkdir -p /app/data \
  && chown -R node:node /app

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "server.js"]
