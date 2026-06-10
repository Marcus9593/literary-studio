#!/bin/sh
set -e

DATA_DIR="${LITERARY_STUDIO_DATA:-/app/data}"

if [ "$(id -u)" = "0" ]; then
  mkdir -p "$DATA_DIR"
  chown -R node:node "$DATA_DIR"
  exec gosu node "$0" "$@"
fi

exec "$@"
