# 文匠 Studio / Literary Studio

<div align="center">

**AI 驱动的网文与剧本创作平台 / AI-Powered Novel & Screenplay Writing Platform**

[English](#english) · [中文](#中文)

![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)
![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)
![Python](https://img.shields.io/badge/Python-3.9+-yellow.svg)
![React](https://img.shields.io/badge/React-19-blue.svg)

</div>

---

<a id="中文"></a>
## 📖 中文

### 简介

文匠 Studio 是一个面向网文和剧本创作者的 AI 辅助写作平台。它将 AI 对话、智能续写、故事知识管理、版本控制和多格式导出整合在一个统一的工作台中，帮助作者更高效地完成创作。

### 核心功能

| 功能模块 | 说明 |
|---------|------|
| 🖊️ **智能写作工作台** | Markdown 编辑器 + AI 对话侧栏，支持焦点模式、自动保存 |
| 🤖 **AI 续写与改写** | 通过 WebSocket 流式生成，支持续写、扩写、润色、改写 |
| 📚 **故事知识库** | 自动提取人物、关系、时间线、伏笔、地点，构建结构化知识图谱 |
| 🧠 **RAG 语义检索** | 基于 LanceDB 向量数据库，AI 对话时自动检索相关上下文 |
| 📋 **故事规划器** | 章节路线图、写作任务调度、今日建议、故事目标追踪 |
| ✅ **写后校验** | 自动检查一致性、伏笔回收、字数阈值等质量指标 |
| 📊 **健康度仪表盘** | 故事 DNA 分析、冲突追踪、角色弧线监控 |
| 🎬 **剧本引擎** | 专业剧本格式支持（AWR 规则）、场景/分集/分镜管理 |
| 📤 **多格式导出** | 支持 ZIP、DOCX、EPUB、Fountain 格式 |
| 🔄 **版本管理** | 章节级版本快照，支持对比和回滚 |
| 💬 **留言板** | 内置反馈系统，支持图片上传 |
| 🔌 **MCP 集成** | 支持 Model Context Protocol 服务器扩展 |

### 技术架构

```
┌─────────────────────────────────────────────────────┐
│                    Frontend (React)                  │
│         Vite + Tailwind CSS + Zustand + WS          │
└──────────┬──────────────────────────┬───────────────┘
           │ REST API                 │ WebSocket
           ▼                          ▼
┌─────────────────────────────────────────────────────┐
│               Backend (Node.js + Express)            │
│  Auth · Projects · Chat · Story Engine · Versions   │
│  Orchestrator · Event Bus · MCP Adapter             │
└──┬────────────────┬─────────────────┬───────────────┘
   │                │                 │
   ▼                ▼                 ▼
┌────────┐   ┌───────────┐   ┌──────────────┐
│  Files │   │  SQLite   │   │   LanceDB    │
│ (JSON) │   │  (meta)   │   │  (vectors)   │
└────────┘   └───────────┘   └──────────────┘
                                   ▲
┌──────────────────────────────────┘
│  Python Backend (文档处理)
│  DOCX/PDF/HTML → Markdown 转换
│  Markdown → DOCX 导出
└──────────────────────────────────
```

### 快速开始

#### 环境要求

- **Node.js** >= 18
- **Python** >= 3.9
- **npm** 或 **pnpm**

#### 安装

```bash
# 克隆仓库
git clone https://github.com/YOUR_USERNAME/literary-studio.git
cd literary-studio

# 安装后端依赖
cd backend-node
npm install
cd ..

# 安装前端依赖
cd frontend
npm install
cd ..

# 安装 Python 依赖
cd backend
pip install -r requirements.txt
cd ..
```

#### 配置环境变量（可选）

```bash
# 在项目根目录创建 .env 文件
cp .env.example .env

# 可配置项：
# STUDIO_ADMIN_USER=admin          # 管理员用户名
# STUDIO_ADMIN_PASSWORD=your_pass  # 管理员密码（默认 admin123）
# STUDIO_JWT_SECRET=your_secret    # JWT 密钥（必须修改！）
# PORT=8765                        # 后端端口
```

#### 启动

```bash
# 启动后端（端口 8765）
cd backend-node
npm run dev

# 新终端，启动前端（端口 5173）
cd frontend
npm run dev
```

访问 http://localhost:5173 ，使用默认账号 `admin` / `admin123` 登录。

> ⚠️ **重要**：首次使用前请务必修改默认密码和 JWT Secret！

### 项目结构

```
literary-studio/
├── frontend/              # React 前端
│   ├── src/
│   │   ├── api.js         # REST API 客户端
│   │   ├── App.jsx        # 路由与布局
│   │   ├── components/    # 通用组件
│   │   ├── features/      # 功能模块（剧本等）
│   │   ├── pages/         # 页面组件
│   │   ├── stores/        # Zustand 状态管理
│   │   └── services/      # WebSocket 服务
│   └── package.json
├── backend-node/          # Node.js 后端（主服务）
│   ├── server.js          # 入口
│   ├── routes.js          # API 路由
│   ├── auth/              # 认证模块
│   ├── ai-runtime/        # AI 编排器
│   ├── event-bus/         # 事件总线
│   ├── memory/            # RAG 向量检索
│   ├── storage/           # 存储层（文件 + SQLite）
│   └── package.json
├── backend/               # Python 后端（文档处理）
│   ├── main.py            # FastAPI 入口
│   ├── engine.py          # LLM 集成
│   ├── document_convert.py # 文档转换
│   ├── document_export.py  # 文档导出
│   └── requirements.txt
├── skills/                # AI 技能包
│   └── literary-writer/   # 写作技能
├── data/                  # 运行时数据（不提交）
└── LICENSE
```

### 贡献指南

欢迎贡献！请遵循以下步骤：

1. Fork 本仓库
2. 创建功能分支：`git checkout -b feature/amazing-feature`
3. 提交更改：`git commit -m 'feat: add amazing feature'`
4. 推送分支：`git push origin feature/amazing-feature`
5. 提交 Pull Request

### 许可证

本项目基于 [MIT 许可证](LICENSE) 开源。

---

<a id="english"></a>
## 📖 English

### Introduction

Literary Studio is an AI-assisted writing platform designed for novel and screenplay creators. It integrates AI chat, intelligent writing assistance, story knowledge management, version control, and multi-format export into a unified workspace.

### Key Features

| Module | Description |
|--------|-------------|
| 🖊️ **Smart Writing Workspace** | Markdown editor + AI chat sidebar with focus mode and auto-save |
| 🤖 **AI Writing & Editing** | WebSocket-based streaming for continuation, expansion, polishing, and rewriting |
| 📚 **Story Knowledge Base** | Auto-extracts characters, relationships, timeline, foreshadowing, and locations |
| 🧠 **RAG Semantic Search** | LanceDB vector store for context-aware AI conversations |
| 📋 **Story Planner** | Chapter roadmaps, task scheduling, daily suggestions, and goal tracking |
| ✅ **Post-Write Verification** | Automatic consistency, foreshadowing, and quality checks |
| 📊 **Health Dashboard** | Story DNA analysis, conflict tracking, character arc monitoring |
| 🎬 **Screenplay Engine** | Professional screenplay format (AWR rules), scenes/episodes/shots management |
| 📤 **Multi-Format Export** | ZIP, DOCX, EPUB, and Fountain formats |
| 🔄 **Version Control** | Chapter-level snapshots with diff and rollback |
| 💬 **Guestbook** | Built-in feedback system with image upload |
| 🔌 **MCP Integration** | Model Context Protocol server extensions |

### Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Frontend (React)                  │
│         Vite + Tailwind CSS + Zustand + WS          │
└──────────┬──────────────────────────┬───────────────┘
           │ REST API                 │ WebSocket
           ▼                          ▼
┌─────────────────────────────────────────────────────┐
│               Backend (Node.js + Express)            │
│  Auth · Projects · Chat · Story Engine · Versions   │
│  Orchestrator · Event Bus · MCP Adapter             │
└──┬────────────────┬─────────────────┬───────────────┘
   │                │                 │
   ▼                ▼                 ▼
┌────────┐   ┌───────────┐   ┌──────────────┐
│  Files │   │  SQLite   │   │   LanceDB    │
│ (JSON) │   │  (meta)   │   │  (vectors)   │
└────────┘   └───────────┘   └──────────────┘
                                   ▲
┌──────────────────────────────────┘
│  Python Backend (Document Processing)
│  DOCX/PDF/HTML → Markdown conversion
│  Markdown → DOCX export
└──────────────────────────────────
```

### Quick Start

#### Prerequisites

- **Node.js** >= 18
- **Python** >= 3.9
- **npm** or **pnpm**

#### Installation

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/literary-studio.git
cd literary-studio

# Install backend dependencies
cd backend-node
npm install
cd ..

# Install frontend dependencies
cd frontend
npm install
cd ..

# Install Python dependencies
cd backend
pip install -r requirements.txt
cd ..
```

#### Environment Variables (Optional)

```bash
# Create .env file in project root
cp .env.example .env

# Available settings:
# STUDIO_ADMIN_USER=admin          # Admin username
# STUDIO_ADMIN_PASSWORD=your_pass  # Admin password (default: admin123)
# STUDIO_JWT_SECRET=your_secret    # JWT secret (MUST change!)
# PORT=8765                        # Backend port
```

#### Running

```bash
# Start backend (port 8765)
cd backend-node
npm run dev

# New terminal, start frontend (port 5173)
cd frontend
npm run dev
```

Visit http://localhost:5173 and login with default credentials `admin` / `admin123`.

> ⚠️ **Important**: Change the default password and JWT secret before any production use!

### Project Structure

```
literary-studio/
├── frontend/              # React frontend
│   ├── src/
│   │   ├── api.js         # REST API client
│   │   ├── App.jsx        # Routing & layout
│   │   ├── components/    # Shared components
│   │   ├── features/      # Feature modules (screenplay, etc.)
│   │   ├── pages/         # Page components
│   │   ├── stores/        # Zustand state management
│   │   └── services/      # WebSocket service
│   └── package.json
├── backend-node/          # Node.js backend (primary)
│   ├── server.js          # Entry point
│   ├── routes.js          # API routes
│   ├── auth/              # Authentication
│   ├── ai-runtime/        # AI orchestrator
│   ├── event-bus/         # Event bus
│   ├── memory/            # RAG vector retrieval
│   ├── storage/           # Storage layer (files + SQLite)
│   └── package.json
├── backend/               # Python backend (document processing)
│   ├── main.py            # FastAPI entry
│   ├── engine.py          # LLM integration
│   ├── document_convert.py # Document conversion
│   ├── document_export.py  # Document export
│   └── requirements.txt
├── skills/                # AI skill packs
│   └── literary-writer/   # Writing skill
├── data/                  # Runtime data (not committed)
└── LICENSE
```

### Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'feat: add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

### License

This project is licensed under the [MIT License](LICENSE).
