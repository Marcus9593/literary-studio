# 文匠 Studio — 跨平台部署

## 前置要求

| 项目 | 要求 |
|------|------|
| Node.js | **22+**（必需） |
| 操作系统 | Windows 10+、macOS 12+、Linux（glibc 系） |
| 可选 | Python 3 + skill 内 `scripts/requirements.txt`（webnovel CLI 增强） |
| 公网 | Nginx/Caddy 反代 + HTTPS（见 `nginx-literary-studio.conf`） |

---

## 本地 / 内网启动（三平台通用）

```bash
# 任意平台，任选一种：
npm start
node scripts/start.mjs
```

| 平台 | 额外入口 |
|------|----------|
| **Windows** | 双击 `start.bat`，或 `.\start.ps1` |
| **macOS / Linux** | `chmod +x start.sh && ./start.sh` |

启动脚本会自动：

1. 检查 Node 22+
2. 安装 `backend-node` / `frontend` 依赖（若缺失）
3. 检测 `frontend/src` 变更并构建 `frontend/dist`
4. 释放占用端口（默认 8765）
5. 启动 Node 后端（含静态前端）

浏览器访问：**http://127.0.0.1:8765**

### 常用环境变量

| 变量 | 说明 | 默认 |
|------|------|------|
| `PORT` | 监听端口 | `8765` |
| `STUDIO_HOST` | 绑定地址 | `127.0.0.1` |
| `LITERARY_STUDIO_DATA` | 数据目录 | `./data` |
| `LITERARY_WRITER_ROOT` | 覆盖 skill 路径 | 默认 `skills/literary-writer` |

### 仅构建前端

```bash
npm run build
# 或 node scripts/build.mjs
```

### 开发模式（热更新前端）

```bash
# 终端 1
npm start

# 终端 2
npm run frontend:dev
# 浏览器打开 Vite 提示的地址（通常 :5173），API 仍走 8765
```

---

## 生产部署

### Linux（systemd）

```bash
# 1. 克隆到 /opt，构建
cd /opt/literary-studio/literary-studio
npm run build

# 2. 编辑 deploy/literary-studio.service 中的路径与环境变量
sudo cp deploy/literary-studio.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now literary-studio

# 3. Nginx 反代（见 nginx-literary-studio.conf）
```

### macOS（launchd）

```bash
# 1. 构建并编辑 deploy/literary-studio-macos.plist
npm run build
sudo mkdir -p /var/log/literary-studio /var/lib/literary-studio/data

# 2. 安装服务（修改 plist 内 node 路径与项目路径）
sudo cp deploy/literary-studio-macos.plist /Library/LaunchDaemons/com.literary-studio.plist
sudo launchctl load /Library/LaunchDaemons/com.literary-studio.plist

# 3. 可选：nginx / Caddy 反代到 127.0.0.1:8765
```

### Windows（后台运行）

**方式 A — 计划任务（推荐）**

1. `npm run build`
2. 任务计划程序 → 创建任务 → 触发器「登录时」
3. 操作：`node E:\path\to\literary-studio\backend-node\server.js`
4. 起始于：`...\backend-node`
5. 环境变量在「常规 → 不管用户是否登录都要运行」+ 系统环境变量中配置

**方式 B — PowerShell 前台**

```powershell
$env:STUDIO_PRODUCTION = '1'
$env:STUDIO_JWT_SECRET = 'your-secret'
npm start
```

**方式 C — NSSM 注册 Windows 服务**

```powershell
nssm install LiteraryStudio "C:\Program Files\nodejs\node.exe" "E:\literary-studio\literary-studio\backend-node\server.js"
nssm set LiteraryStudio AppDirectory "E:\literary-studio\literary-studio\backend-node"
nssm start LiteraryStudio
```

公网务必配合 **IIS / Nginx for Windows / Caddy** 做 HTTPS 反代，不要直接把 Node 绑到 `0.0.0.0` 裸暴露。

---

## 生产环境变量（公网必设）

```bash
STUDIO_PRODUCTION=1
STUDIO_JWT_SECRET=<随机 32+ 字符>
STUDIO_ADMIN_PASSWORD=<强密码>
STUDIO_ALLOW_REGISTER=0
STUDIO_CORS_ORIGIN=https://你的域名
```

---

## 故障排查

| 现象 | 处理 |
|------|------|
| 端口占用 | 再次运行 `npm start`（会自动杀旧进程） |
| 页面空白 | 运行 `npm run build`，确认 `frontend/dist/index.html` 存在 |
| Node 版本错误 | 安装 Node 22+：`node -v` |
| Windows 无法运行 ps1 | 用 `start.bat` 或 `npm start` |
| macOS 权限 | `chmod +x start.sh` |
