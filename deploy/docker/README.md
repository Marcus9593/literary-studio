# Literary Studio — Docker 部署

| 项目 | 值 |
|------|-----|
| 镜像名称 | **`literarycraft/studio`** |
| Docker Hub | [hub.docker.com/r/literarycraft/studio](https://hub.docker.com/r/literarycraft/studio) |
| 默认端口 | `8765` |
| 数据卷 | `/app/data` |

---

## 快速开始（本地构建 + 运行）

```bash
# 1. 准备环境变量
cp .env.docker.example .env.docker
# 编辑 .env.docker，至少修改 STUDIO_JWT_SECRET 和 STUDIO_ADMIN_PASSWORD

# 2. 构建并启动
docker compose up -d --build

# 3. 访问
open http://127.0.0.1:8765   # macOS
# 浏览器打开 http://127.0.0.1:8765
```

默认管理员用户名见 `.env.docker` 中的 `STUDIO_ADMIN_USER`（默认 `admin`）。

---

## 仅拉取镜像运行（发布后）

```bash
docker pull literarycraft/studio:latest

docker run -d \
  --name literarycraft-studio \
  --restart unless-stopped \
  -p 8765:8765 \
  -v literarycraft-data:/app/data \
  -e STUDIO_PRODUCTION=1 \
  -e STUDIO_JWT_SECRET=your_random_secret \
  -e STUDIO_ADMIN_PASSWORD=your_strong_password \
  -e STUDIO_ALLOW_REGISTER=0 \
  literarycraft/studio:latest
```

---

## 构建镜像

### 完整版（含 Python 文档转换，默认）

```bash
docker build -t literarycraft/studio:latest .
docker build -t literarycraft/studio:2.6.0 .
```

### 精简版（仅 Node，无 DOCX/PDF 转换）

```bash
docker build --target runtime-slim -t literarycraft/studio:slim .
```

### 多架构（Apple Silicon + x86 服务器）

```bash
docker buildx create --use --name literarycraft-builder 2>/dev/null || docker buildx use literarycraft-builder

docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t literarycraft/studio:latest \
  -t literarycraft/studio:2.6.0 \
  --push \
  .
```

---

## 发布到 Docker Hub

### 1. 注册并创建组织

1. 注册 [Docker Hub](https://hub.docker.com/)
2. 创建 Organization：**`literarycraft`**
3. 创建 Repository：**`studio`**（可见性 Public）

### 2. 登录并推送

```bash
docker login

# 构建并打标签
docker build -t literarycraft/studio:latest .
docker build -t literarycraft/studio:2.6.0 .

# 推送
docker push literarycraft/studio:latest
docker push literarycraft/studio:2.6.0
```

### 3. 用户拉取

```bash
docker pull literarycraft/studio:latest
```

---

## 发布到 GitHub Container Registry（可选）

```bash
docker login ghcr.io -u YOUR_GITHUB_USER

docker tag literarycraft/studio:latest ghcr.io/YOUR_ORG/studio:latest
docker push ghcr.io/YOUR_ORG/studio:latest
```

用户拉取：

```bash
docker pull ghcr.io/YOUR_ORG/studio:latest
```

---

## 数据持久化

| 方式 | 说明 |
|------|------|
| Compose 命名卷 | `literarycraft-data`（默认，见 `docker-compose.yml`） |
| 绑定本地目录 | `-v /path/on/host/data:/app/data` |

升级镜像不会丢失数据，只要继续使用同一 volume。

---

## 环境变量

| 变量 | 说明 | 容器内推荐值 |
|------|------|--------------|
| `STUDIO_PRODUCTION` | 生产模式 | `1` |
| `STUDIO_JWT_SECRET` | JWT 密钥（必改） | 随机 32+ 字符 |
| `STUDIO_ADMIN_PASSWORD` | 管理员密码（必改） | 强密码 |
| `STUDIO_HOST` | 监听地址 | `0.0.0.0`（已在镜像中默认） |
| `PORT` | 容器内端口 | `8765` |
| `LITERARY_STUDIO_DATA` | 数据目录 | `/app/data` |
| `PYTHON` | Python 可执行文件 | `python3` |

完整列表见项目根目录 `.env.example`。

---

## 公网部署建议

不要将容器直接暴露到公网。推荐：

```
用户 → Nginx / Caddy（HTTPS）→ 127.0.0.1:8765（或 docker 映射端口）
```

可参考 `deploy/nginx-literary-studio.conf`。

---

## 常用命令

```bash
# 查看日志
docker compose logs -f studio

# 停止
docker compose down

# 停止并删除数据卷（慎用）
docker compose down -v

# 进入容器
docker compose exec studio sh
```

---

## 故障排查

| 现象 | 处理 |
|------|------|
| 无法访问页面 | 确认 `STUDIO_HOST=0.0.0.0`，端口映射 `8765:8765` |
| 启动即退出 | 检查是否设置 `STUDIO_JWT_SECRET`（`STUDIO_PRODUCTION=1` 时必填） |
| DOCX/PDF 导入失败 | 使用 `latest` 完整镜像，不要用 `slim` |
| 数据丢失 | 确认挂载了 `/app/data` volume |
