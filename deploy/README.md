# 文匠 Studio — 安装与部署指南

本文档是**从零到可运行**的完整安装与部署说明，覆盖 **Windows / macOS / Linux** 三个平台：前置依赖安装、获取代码、启动服务、首次验证，以及生产环境部署。

**默认访问地址：** http://127.0.0.1:8765  
**默认管理员账号：** `admin` / `admin123`（首次登录后请立即修改，见 [环境变量参考](#环境变量参考)）

---

## 目录

- [前置依赖总览](#前置依赖总览)
- [Windows 安装与启动](#windows-安装与启动)
- [macOS 安装与启动](#macos-安装与启动)
- [Linux 安装与启动](#linux-安装与启动)
- [首次登录与验证](#首次登录与验证)
- [开发模式与可选组件](#开发模式与可选组件)
- [生产环境部署](#生产环境部署)
- [环境变量参考](#环境变量参考)
- [故障排查](#故障排查)

---

## 前置依赖总览

| 组件 | 版本要求 | 是否必需 | 用途 |
|------|----------|----------|------|
| **Node.js** | **22 及以上** | ✅ 必需 | 主后端、前端构建、一键启动脚本 |
| **npm** | 随 Node 附带 | ✅ 必需 | 安装 `backend-node` / `frontend` 依赖 |
| **Git** | 任意较新版本 | ✅ 推荐 | 克隆仓库、后续更新 |
| **Python** | 3.9 及以上 | ⬜ 可选 | DOCX / PDF / HTML 文档导入转换、literary-writer CLI 增强 |
| **C++ 构建工具** | — | ⬜ Linux 常见需要 | 编译 LanceDB 等原生 Node 模块 |

**验证命令（三平台通用）：**

```bash
node -v    # 应显示 v22.x 或更高
npm -v
git --version
python3 --version   # 可选
```

---

## Windows 安装与启动

### 1. 安装 Node.js 22+

**方式 A — 官方安装包（推荐新手）**

1. 打开 https://nodejs.org/
2. 下载 **Current** 或 **LTS（22+）** Windows 安装包（`.msi`）
3. 安装时勾选 **Add to PATH**
4. 重新打开 PowerShell / CMD，执行 `node -v` 确认版本 ≥ 22

**方式 B — winget**

```powershell
winget install OpenJS.NodeJS
node -v
```

**方式 C — nvm-windows**

1. 安装 [nvm-windows](https://github.com/coreybutler/nvm-windows/releases)
2. 执行：

```powershell
nvm install 22
nvm use 22
node -v
```

### 2. 安装 Git（若尚未安装）

```powershell
winget install Git.Git
git --version
```

### 3. 安装 Python（可选 · 文档转换）

1. 打开 https://www.python.org/downloads/windows/
2. 下载 Python 3.11+ 安装包，**务必勾选** “Add python.exe to PATH”
3. 验证：`python --version`

```powershell
cd backend
python -m pip install -r requirements.txt
cd ..

cd skills\literary-writer\scripts
python -m pip install -r requirements.txt
cd ..\..\..
```

### 4. 获取代码

```powershell
git clone https://github.com/Marcus9593/literary-studio.git
cd literary-studio
```

### 5. 配置环境变量（推荐）

```powershell
copy .env.example .env
notepad .env
```

### 6. 启动服务

```powershell
npm start          # 推荐
.\start.ps1        # 或 PowerShell 脚本
# 或双击 start.bat
```

`npm start` 会自动：检查 Node 版本 → 安装依赖 → 构建前端 → 释放 8765 端口 → 启动服务。

### 7. 验证

1. 浏览器打开 http://127.0.0.1:8765
2. 登录 `admin` / `admin123`
3. `curl http://127.0.0.1:8765/api/health`

| 现象 | 处理 |
|------|------|
| 无法运行 `.ps1` | 使用 `npm start` 或 `start.bat` |
| `node` 不是内部命令 | 重装 Node 并勾选 PATH |
| 端口 8765 被占用 | 再次执行 `npm start` |
| 页面空白 | 执行 `npm run build` 后重启 |

---

## macOS 安装与启动

### 1. 安装 Homebrew（若尚未安装）

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

### 2. 安装 Node.js 22+

```bash
# Homebrew（推荐）
brew install node@22
brew link node@22 --force --overwrite
node -v

# 或 nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
nvm install 22 && nvm use 22
```

### 3. 安装 Git 与 Python（可选）

```bash
brew install git python@3.11
```

Python 依赖（可选）：

```bash
cd backend && python3 -m pip install -r requirements.txt && cd ..
cd skills/literary-writer/scripts && python3 -m pip install -r requirements.txt && cd ../../..
```

### 4. 获取代码、配置、启动

```bash
git clone https://github.com/Marcus9593/literary-studio.git
cd literary-studio
cp .env.example .env
chmod +x start.sh
npm start    # 或 ./start.sh
```

### 5. 验证

浏览器访问 http://127.0.0.1:8765 ，`curl http://127.0.0.1:8765/api/health`

| 现象 | 处理 |
|------|------|
| `Permission denied` | `chmod +x start.sh` |
| `command not found: node` | `brew link node@22` 或 nvm `use 22` |
| 原生模块编译失败 | `xcode-select --install` |

---

## Linux 安装与启动

以下以 **Ubuntu / Debian** 为例。

### 1. 系统基础工具

```bash
sudo apt update
sudo apt install -y git curl build-essential
```

### 2. 安装 Node.js 22+

```bash
# NodeSource（推荐生产）
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs

# 或 nvm（推荐开发）
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
source ~/.bashrc && nvm install 22 && nvm use 22
```

### 3. Python（可选）

```bash
sudo apt install -y python3 python3-pip
cd backend && python3 -m pip install -r requirements.txt && cd ..
cd skills/literary-writer/scripts && python3 -m pip install -r requirements.txt && cd ../../..
```

### 4. 获取代码、配置、启动

```bash
git clone https://github.com/Marcus9593/literary-studio.git
cd literary-studio
cp .env.example .env
chmod +x start.sh
npm start
```

### 5. 验证

```bash
curl http://127.0.0.1:8765/api/health
```

| 现象 | 处理 |
|------|------|
| `npm install` 编译失败 | 安装 `build-essential`，确认 Node 22+ |
| 远程无法访问 | 修改 `STUDIO_HOST` 并配置防火墙与反代 |
| `data/` 写入失败 | 检查目录写权限 |

---

## 首次登录与验证

| 步骤 | 操作 |
|------|------|
| 1 | 浏览器打开 http://127.0.0.1:8765 并登录 |
| 2 | **AI 中心 → 模型**，配置 LLM API |
| 3 | 确认默认技能为 `literary-writer` |
| 4 | 创建测试项目，验证编辑与保存 |
| 5 | （可选）上传 DOCX 测试导入（需 Python） |
| 6 | 修改 `.env` 中密码与 JWT Secret，重启服务 |

**停止服务：** 终端 `Ctrl + C`  
**更新版本：** `git pull && npm start`

---

## 开发模式与可选组件

### 前端热更新

```bash
# 终端 1
npm start

# 终端 2
npm run frontend:dev
```

### 仅构建前端

```bash
npm run build
```

### API 集成测试

```bash
cd test && pip install -r requirements.txt && pytest
```

详见 [`test/README.md`](../test/README.md)。

### Docker

当前版本**未提供官方 Docker 镜像**。生产环境推荐 systemd / launchd / NSSM，前置 Nginx / Caddy 反代。

---

## 生产环境部署

### 必设环境变量（公网）

```bash
STUDIO_PRODUCTION=1
STUDIO_JWT_SECRET=<随机 32+ 字符>
STUDIO_ADMIN_PASSWORD=<强密码>
STUDIO_ALLOW_REGISTER=0
STUDIO_CORS_ORIGIN=https://你的域名
```

### 推荐架构

```
用户浏览器 → Nginx/Caddy（HTTPS）→ Node.js（127.0.0.1:8765）→ data/
```

### 数据备份

定期备份 `data/` 目录（或 `LITERARY_STUDIO_DATA` 指定路径），包含全部项目与配置。

### Linux（systemd）

```bash
cd /opt/literary-studio/literary-studio
npm run build
# 编辑 deploy/literary-studio.service 中的路径
sudo cp deploy/literary-studio.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now literary-studio
# Nginx 反代见 nginx-literary-studio.conf
```

### macOS（launchd）

```bash
npm run build
sudo mkdir -p /var/log/literary-studio /var/lib/literary-studio/data
# 编辑 deploy/literary-studio-macos.plist
sudo cp deploy/literary-studio-macos.plist /Library/LaunchDaemons/com.literary-studio.plist
sudo launchctl load /Library/LaunchDaemons/com.literary-studio.plist
```

### Windows（后台运行）

| 方式 | 说明 |
|------|------|
| **计划任务** | 登录时运行 `node backend-node\server.js`，起始于 `backend-node` |
| **PowerShell** | 设置 `STUDIO_PRODUCTION=1` 后 `npm start` |
| **NSSM 服务** | 见下方示例 |

```powershell
npm run build
nssm install LiteraryStudio "C:\Program Files\nodejs\node.exe" "E:\literary-studio\literary-studio\backend-node\server.js"
nssm set LiteraryStudio AppDirectory "E:\literary-studio\literary-studio\backend-node"
nssm start LiteraryStudio
```

公网务必配合 **IIS / Nginx / Caddy** 做 HTTPS 反代，勿将 Node 直接暴露公网。

---

## 环境变量参考

在项目根目录创建 `.env`（参考 `.env.example`）：

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `PORT` | 监听端口 | `8765` |
| `STUDIO_HOST` | 绑定地址 | `127.0.0.1` |
| `STUDIO_ADMIN_USER` | 管理员用户名 | `admin` |
| `STUDIO_ADMIN_PASSWORD` | 管理员密码 | `admin123` |
| `STUDIO_JWT_SECRET` | JWT 签名密钥 | 内置默认值（**必须修改**） |
| `STUDIO_PRODUCTION` | 生产模式 | 未设置 |
| `STUDIO_ALLOW_REGISTER` | 允许注册 | 未设置 |
| `STUDIO_CORS_ORIGIN` | 跨域来源 | `*` |
| `LITERARY_STUDIO_DATA` | 数据目录 | `./data` |
| `LITERARY_WRITER_ROOT` | 技能包路径 | `skills/literary-writer` |
| `PYTHON` | Python 可执行文件 | `python3` |

---

## 故障排查

| 现象 | 处理 |
|------|------|
| 端口占用 | 再次运行 `npm start` |
| 页面空白 | `npm run build`，确认 `frontend/dist/index.html` 存在 |
| Node 版本错误 | 安装 Node 22+：`node -v` |
| Windows 无法运行 ps1 | 用 `start.bat` 或 `npm start` |
| macOS 权限 | `chmod +x start.sh` |
| AI 无响应 | 检查 AI 中心模型配置与 API 密钥 |
| 文档导入失败 | 安装 `backend/requirements.txt` |

配置文件：`deploy/literary-studio.service`、`deploy/literary-studio-macos.plist`、`deploy/nginx-literary-studio.conf`
