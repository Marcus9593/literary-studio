import { useState } from 'react'
import Modal from './Modal.jsx'

const SECTIONS = [
  { id: 'intro', label: '认识文匠', icon: '👋' },
  { id: 'start', label: '开始使用', icon: '🚀' },
  { id: 'project', label: '创建项目', icon: '📁' },
  { id: 'workspace', label: '写作工作台', icon: '✏️' },
  { id: 'setup', label: '搭建故事', icon: '🏗️' },
  { id: 'write', label: '开始写作', icon: '📝' },
  { id: 'ai', label: 'AI 辅助', icon: '🤖' },
  { id: 'edit', label: '修改润色', icon: '🔧' },
  { id: 'manage', label: '管理故事', icon: '📚' },
  { id: 'quality', label: '检查质量', icon: '🔍' },
  { id: 'plan', label: '规划章节', icon: '🗺️' },
  { id: 'review', label: '编辑审稿', icon: '📋' },
  { id: 'screenplay', label: '编剧功能', icon: '🎬' },
  { id: 'export', label: '导出备份', icon: '💾' },
  { id: 'advanced', label: '进阶功能', icon: '⚡' },
  { id: 'faq', label: '常见问题', icon: '❓' },
  { id: 'shortcuts', label: '快捷键', icon: '⌨️' },
]

const content = {
  intro: (
    <>
      <h3>👋 认识文匠 Studio</h3>
      <p><strong>文匠 Studio</strong> 是一款 <strong>编剧级创作台</strong>——面向网文作者、编剧与长篇叙事创作者的专业 AI 工作台。核心不是「替你写完」，而是帮你 <strong>搭结构、改对白、迭代每一稿</strong>。</p>
      <table className="um-table">
        <thead><tr><th>层次</th><th>名称</th><th>做什么</th></tr></thead>
        <tbody>
          <tr><td>创作层</td><td><strong>写作工作台</strong></td><td>文稿/大纲/设定 + 编辑器 + AI 对话</td></tr>
          <tr><td>工程层</td><td><strong>Story OS</strong></td><td>写什么 → 写得好吗 → 怎么改</td></tr>
          <tr><td>引擎层</td><td><strong>叙事引擎</strong></td><td>Claude Code CLI + Skill + 模型凭据</td></tr>
        </tbody>
      </table>
      <div className="um-callout">
        <strong>核心理念：</strong>你负责创作，AI 负责辅助和把关。
      </div>
      <h4>部署方式</h4>
      <ul>
        <li><strong>本机：</strong>浏览器打开 <code>http://localhost:8765</code></li>
        <li><strong>Docker：</strong>团队通过 <code>http://服务器IP:8765</code> 访问，数据存在数据卷中</li>
      </ul>
      <h4>它能帮你做什么？</h4>
      <table className="um-table">
        <thead><tr><th>你想做的事</th><th>文匠 Studio 怎么帮你</th></tr></thead>
        <tbody>
          <tr><td>我有个故事想法，想开始写</td><td>建项目、搭大纲、设角色、同步知识库</td></tr>
          <tr><td>我写到一半写不下去了</td><td>AI 读前文，帮你续写或给方向</td></tr>
          <tr><td>我觉得这段写得不好</td><td>选中文字，改写/扩写/润色</td></tr>
          <tr><td>我忘了角色或伏笔</td><td>作品知识 + 伏笔看板随时查</td></tr>
          <tr><td>我担心前后矛盾</td><td>一致性检查 + Governor 审稿</td></tr>
          <tr><td>我想导出投稿</td><td>Word / EPUB / ZIP / Fountain</td></tr>
          <tr><td>我想写剧本</td><td>场景看板、编剧室流水线</td></tr>
        </tbody>
      </table>
    </>
  ),

  start: (
    <>
      <h3>🚀 开始使用</h3>
      <h4>第 1 步：注册与登录</h4>
      <ol>
        <li>浏览器打开文匠 Studio（本机 <code>localhost:8765</code> 或 Docker 服务器地址）</li>
        <li>点击 <strong>「注册账号」</strong>，填写用户名、显示名称、密码</li>
        <li>注册成功后进入 <strong>创作看板</strong></li>
      </ol>
      <p className="muted">Docker 部署：数据保存在数据卷（如 literarycraft-data），重建容器不丢数据，删除数据卷会清空一切。</p>
      <h4>第 2 步：认识创作看板</h4>
      <ul>
        <li><strong>5 张数据卡</strong>：项目总数、今日活跃、今日章节、今日字数、总字数</li>
        <li><strong>7 日趋势图</strong>、<strong>停滞项目提醒</strong>（14 天未更新）、<strong>按项目统计表</strong></li>
      </ul>
      <h4>第 3 步：配置叙事引擎（必做）</h4>
      <p>对话与写稿由 <strong>Claude Code CLI</strong> 驱动，需同时满足：</p>
      <table className="um-table">
        <thead><tr><th>条件</th><th>在哪里看</th></tr></thead>
        <tbody>
          <tr><td>Claude Code 已连接</td><td>AI 中心 → 总览</td></tr>
          <tr><td>模型凭据已设为活跃</td><td>AI 中心 → 模型与连接</td></tr>
          <tr><td>默认 Skill 有效</td><td>AI 中心 → 本机技能</td></tr>
        </tbody>
      </table>
      <p><strong>配置模型凭据：</strong></p>
      <ol>
        <li>AI 中心（◈）→ <strong>模型与连接</strong> → <strong>添加模型</strong></li>
        <li>选快捷模板（MiMo Anthropic / DeepSeek / 通义千问等），或 <strong>从 CC Switch 导入</strong></li>
        <li>填 API Key → <strong>测试连接</strong> → 保存 → <strong>设为活跃</strong></li>
        <li>换模型后 <strong>+ 新建会话</strong>，问「你是什么模型？」验证身份</li>
      </ol>
      <div className="um-callout">
        <strong>常见坑：</strong>协议必须与 Base URL 匹配（<code>/v1</code> → OpenAI；<code>/anthropic</code> → Anthropic）。404 多为协议填错。
      </div>
      <h4>第 4 步：配置本机技能</h4>
      <ol>
        <li>AI 中心 → <strong>本机技能</strong> → 设置默认 Skill</li>
        <li>需要更多技能 → <strong>发现安装</strong></li>
      </ol>
      <h4>左侧导航一览</h4>
      <p className="muted">◉ 创作看板 · ◫ 项目库 · ◑ 审稿中心 · ◧ 素材中心 · ⧉ 项目版本 · ◈ AI 中心 · 💬 留言板</p>
    </>
  ),

  project: (
    <>
      <h3>📁 创建你的第一个项目</h3>
      <p>在文匠 Studio 里，<strong>项目 = 一部作品</strong>。一本小说、一个剧本、一个短视频脚本都是一个项目。</p>
      <h4>操作步骤</h4>
      <ol>
        <li>点击左侧导航栏的 <strong>"项目库"（图标 ◫）</strong></li>
        <li>点击右上角的 <strong>"新建项目"</strong> 按钮</li>
        <li>填写项目信息（见下表）</li>
        <li>点击 <strong>"创建"</strong></li>
      </ol>
      <h4>项目信息说明</h4>
      <table className="um-table">
        <thead><tr><th>字段</th><th>说明</th></tr></thead>
        <tbody>
          <tr><td><strong>项目标题</strong></td><td>你的作品名字</td></tr>
          <tr><td><strong>作品类型</strong></td><td>长篇小说 / 短篇小说 / 电影剧本 / 剧集剧本 / 短视频脚本</td></tr>
          <tr><td><strong>创作模式</strong></td><td>从零开始 / 改写续写 / 导入已有（改写模式有试验稿、旧稿目录）</td></tr>
          <tr><td><strong>题材/风格</strong></td><td>如玄幻、都市、科幻（可选）</td></tr>
          <tr><td><strong>简介</strong></td><td>一句话描述故事（可选）</td></tr>
        </tbody>
      </table>
      <div className="um-callout">
        <strong>💡 不确定选什么类型？</strong> 选"长篇小说"，这是最通用的选项，后面随时可以改。
      </div>
      <h4>项目卡片 ⋯ 菜单</h4>
      <p>项目卡片右上角 <strong>⋯</strong>：置顶、<strong>共享权限</strong>、重命名、<strong>编辑简述</strong>、导入续写、设置状态、归档、删除。</p>
    </>
  ),

  workspace: (
    <>
      <h3>✏️ 认识你的写作工作台</h3>
      <p>进入项目后：<strong>左侧菜单</strong> + <strong>中央编辑区</strong> + <strong>AI 对话</strong> + 最右侧 <strong>Story OS</strong> 导航。</p>
      <div className="um-layout-preview">
        <div className="um-layout-col"><strong>左侧</strong><br/>☰文稿 · ◇大纲 · ◎设定 · ↓导出</div>
        <div className="um-layout-col um-layout-main"><strong>中央</strong><br/>编辑器 / 编剧界面</div>
        <div className="um-layout-col"><strong>AI 对话</strong><br/>会话 · 状态 · 输入</div>
        <div className="um-layout-col"><strong>Story OS</strong><br/>写什么 · 写得好吗 · 怎么改</div>
      </div>
      <h4>左侧菜单</h4>
      <table className="um-table">
        <thead><tr><th>图标</th><th>名称</th><th>作用</th></tr></thead>
        <tbody>
          <tr><td>☰</td><td>文稿</td><td>章节列表，侧栏 <strong>+ 新建</strong></td></tr>
          <tr><td>◇</td><td>大纲</td><td>大纲文件；<strong>更多 → 导入</strong> 添加</td></tr>
          <tr><td>◎</td><td>设定</td><td>设定文件；<strong>更多 → 导入</strong> 添加</td></tr>
          <tr><td>✎/⊟</td><td>试验稿/旧稿</td><td>仅「改写续写」模式</td></tr>
          <tr><td>↓</td><td>导出</td><td>打开导出模态框</td></tr>
        </tbody>
      </table>
      <p className="muted">尚无章节时，大纲与设定入口呈灰色不可用。</p>
      <h4>中央编辑区</h4>
      <ul>
        <li>工具栏：返回、设置、<strong>更多 → 导入</strong>、快捷键、诊断、导出</li>
        <li>Markdown 编辑/预览，停止打字 <strong>2.5 秒</strong>自动保存</li>
        <li>剧本项目显示场景看板等专业界面</li>
      </ul>
      <h4>右侧 AI 对话面板</h4>
      <ul>
        <li><strong>会话选择器</strong>：<strong>+ 新建会话</strong>；换模型后请新建会话</li>
        <li><strong>连接状态</strong>：须显示 Claude Code 已连接（绿色）</li>
        <li><strong>快捷建议 ▼</strong>：按作品类型动态生成，点击即发送</li>
        <li><strong>Enter</strong> 发送，<strong>Shift+Enter</strong> 换行</li>
      </ul>
      <h4>Story OS（故事工程）</h4>
      <table className="um-table">
        <thead><tr><th>分组</th><th>入口</th></tr></thead>
        <tbody>
          <tr><td><strong>写什么</strong></td><td>今日建议 · 创作路线</td></tr>
          <tr><td><strong>写得好吗</strong></td><td>作品质量 · 悬念分析 · 节拍大纲 · 作品知识</td></tr>
          <tr><td><strong>怎么改</strong></td><td>修改计划 · 角色工坊 · 设定圣经 · 编剧室</td></tr>
        </tbody>
      </table>
      <div className="um-callout">
        <strong>推荐流程：</strong>写好设定 → 作品知识「从设定集同步」→ 今日建议「快速同步」→ 工作台写作 → 作品质量检查 → 修改计划迭代。
      </div>
      <h4>常用快捷键</h4>
      <table className="um-table">
        <thead><tr><th>快捷键</th><th>功能</th></tr></thead>
        <tbody>
          <tr><td><kbd>Cmd/Ctrl</kbd> + <kbd>S</kbd></td><td>保存</td></tr>
          <tr><td><kbd>Cmd/Ctrl</kbd> + <kbd>←/→</kbd></td><td>切换章节</td></tr>
          <tr><td><kbd>Cmd/Ctrl</kbd> + <kbd>K</kbd></td><td>全局搜索</td></tr>
          <tr><td><kbd>F</kbd></td><td>专注模式</td></tr>
          <tr><td><kbd>?</kbd></td><td>快捷键参考</td></tr>
        </tbody>
      </table>
    </>
  ),

  setup: (
    <>
      <h3>🏗️ 在动笔之前——搭建故事骨架</h3>
      <p>在开始写之前，先把故事的基本框架搭好。就像盖房子要先打地基。</p>
      <h4>第 1 步：写大纲（故事蓝图）</h4>
      <ol>
        <li>点击左侧 <strong>「大纲」</strong>（◇）</li>
        <li>通过 <strong>更多 → 导入</strong> 添加大纲，或先有文稿后再建</li>
        <li>写下故事框架；支持大纲结构树拖拽调序</li>
      </ol>
      <p>大纲建议包含：</p>
      <ul>
        <li><strong>故事简介</strong>：用两三句话概括故事</li>
        <li><strong>主要角色</strong>：主角、反派、重要配角</li>
        <li><strong>核心冲突</strong>：主要矛盾是什么</li>
        <li><strong>大致走向</strong>：开头、发展、高潮、结局</li>
      </ul>
      <div className="um-callout">
        <strong>💡 小技巧：</strong>不知道怎么写大纲？直接在右侧 AI 对话面板里问："帮我设计一个故事大纲"，AI 会给你一个框架，你在此基础上修改。
      </div>
      <h4>第 2 步：建立设定集</h4>
      <ol>
        <li>点击左侧 <strong>「设定」</strong>（◎）</li>
        <li>通过 <strong>更多 → 导入</strong> 添加，建议逐步创建：</li>
      </ol>
      <table className="um-table">
        <thead><tr><th>文件名</th><th>写什么</th></tr></thead>
        <tbody>
          <tr><td>角色设定.md</td><td>每个角色的名字、性格、背景、能力</td></tr>
          <tr><td>世界观设定.md</td><td>世界是什么样的、有什么规则</td></tr>
          <tr><td>力量体系.md</td><td>超能力/魔法/武力系统的规则</td></tr>
          <tr><td>势力关系.md</td><td>组织、家族、国家之间的关系</td></tr>
        </tbody>
      </table>
      <h4>第 3 步：同步知识库</h4>
      <p>写好大纲和设定后，让系统把它们读一遍，建立索引：</p>
      <ol>
        <li>点击右侧导航栏的 <strong>"作品知识"</strong></li>
        <li>点击 <strong>「从设定集同步」</strong></li>
        <li>系统自动提取角色、地点、伏笔等信息</li>
      </ol>
      <div className="um-callout">
        <strong>为什么要同步？</strong> 知识库是 AI 的"记忆"。同步后，AI 在帮你写作时能准确引用角色和设定信息，保持前后一致。
      </div>
    </>
  ),

  write: (
    <>
      <h3>📝 开始写第一章</h3>
      <h4>创建章节</h4>
      <ol>
        <li>点击左侧 <strong>「文稿」</strong>（☰）</li>
        <li>侧栏点 <strong>「+ 新建」</strong>，或按空状态引导操作</li>
        <li>在 <strong>「新建文稿」</strong> 弹窗输入标题（如「第一章 初入江湖」）</li>
        <li>在编辑器中开始写故事</li>
      </ol>
      <h4>编辑器基本操作</h4>
      <table className="um-table">
        <thead><tr><th>操作</th><th>方法</th></tr></thead>
        <tbody>
          <tr><td>输入文字</td><td>直接打字</td></tr>
          <tr><td>保存</td><td>自动保存（2.5秒后），或按 <kbd>Cmd/Ctrl+S</kbd></td></tr>
          <tr><td>切换预览</td><td>点击编辑器上方的"预览"按钮</td></tr>
          <tr><td>调字号</td><td>点击字号按钮，选 15/16/18/20px</td></tr>
          <tr><td>切换章节</td><td><kbd>Cmd/Ctrl+←/→</kbd> 或点击左侧文件列表</td></tr>
          <tr><td>专注模式</td><td>按 <kbd>F</kbd> 键隐藏侧栏</td></tr>
        </tbody>
      </table>
      <div className="um-callout">
        <strong>💡 关于 Markdown：</strong>你不需要精通 Markdown。完全可以像在记事本里一样直接打字。想加粗就用 <code>**文字**</code>，想加标题就在前面加 <code>#</code>。
      </div>
    </>
  ),

  ai: (
    <>
      <h3>🤖 让 AI 帮你写作</h3>
      <h4>和 AI 对话</h4>
      <ol>
        <li>确保对话面板显示 <strong>Claude Code 已连接</strong>（绿色）</li>
        <li>在底部输入框输入你的问题</li>
        <li>按 <kbd>Enter</kbd> 发送</li>
      </ol>
      <h4>你可以问 AI 什么？</h4>
      <table className="um-table">
        <thead><tr><th>类型</th><th>示例问题</th></tr></thead>
        <tbody>
          <tr><td>剧情</td><td>"这一章接下来该怎么写？""帮我设计一个反转"</td></tr>
          <tr><td>角色</td><td>"帮我设计一个反派角色""这个角色该怎么发展？"</td></tr>
          <tr><td>技巧</td><td>"这段打斗怎么写得更精彩？""这段描写太啰嗦了"</td></tr>
          <tr><td>整体</td><td>"我的故事节奏是不是太快了？""帮我分析故事线"</td></tr>
        </tbody>
      </table>
      <h4>让 AI 续写</h4>
      <p>当你写不下去时，可以让 AI 帮你续写：</p>
      <ol>
        <li>输入「帮我续写这一章」，或在 <strong>快捷建议 ▼</strong> 中选续写相关建议</li>
        <li>AI 会读取你的大纲、设定、前面章节，生成续写内容</li>
        <li>内容会<strong>实时流式显示</strong>（看着它一个字一个字出来）</li>
        <li>完成后选择：<strong>打开为新文件</strong> / <strong>替换当前内容</strong> / <strong>丢弃</strong></li>
      </ol>
      <div className="um-callout">
        <strong>💡 建议：</strong>不确定 AI 写得好不好？先选"打开为新文件"，对比两个版本再决定用哪个。
      </div>
      <h4>会话管理</h4>
      <p>你可以创建多个对话，按章节或话题分开：</p>
      <ul>
        <li>点击会话选择器的下拉框</li>
        <li><strong>+ 新建会话</strong>、切换、删除；换模型后务必新建会话</li>
        <li>切换章节时，会自动聚焦到对应章节的会话</li>
      </ul>
    </>
  ),

  edit: (
    <>
      <h3>🔧 修改和润色</h3>
      <h4>选中文本进行 AI 编辑</h4>
      <ol>
        <li>在编辑器中<strong>选中一段文字</strong>（至少 8 个字符）</li>
        <li>选中后会出现一个<strong>浮动操作栏</strong></li>
        <li>选择你需要的操作：</li>
      </ol>
      <table className="um-table">
        <thead><tr><th>按钮</th><th>做什么</th><th>什么时候用</th></tr></thead>
        <tbody>
          <tr><td><strong>AI 改写</strong></td><td>用不同方式重写</td><td>觉得写得不好，不知道怎么改</td></tr>
          <tr><td><strong>扩写</strong></td><td>写得更详细</td><td>觉得太简略了</td></tr>
          <tr><td><strong>润色</strong></td><td>优化文笔</td><td>觉得太平淡了</td></tr>
          <tr><td><strong>与 AI 讨论</strong></td><td>发给 AI 分析</td><td>想听听 AI 的看法</td></tr>
        </tbody>
      </table>
      <ol start={4}>
        <li>AI 处理后会显示<strong>对比预览</strong>（原文 vs 修改后）</li>
        <li>选择<strong>接受</strong>或<strong>拒绝</strong></li>
      </ol>
      <div className="um-callout">
        <strong>💡 提示：</strong>AI 不是每次都改得好。觉得改得不如原来，大胆拒绝就行。你才是故事的主人。
      </div>
    </>
  ),

  manage: (
    <>
      <h3>📚 管理你的故事世界</h3>
      <h4>作品知识页面</h4>
      <p>点击右侧导航栏的 <strong>"作品知识"</strong>，可以管理：</p>
      <ul>
        <li><strong>角色卡片</strong>：每个角色一张卡，可直接编辑名字、定位、备注</li>
        <li><strong>伏笔看板</strong>：三列看板——已埋设 / 待解决 / 已回收，可拖拽移动</li>
        <li><strong>查询界面</strong>：搜索角色、关系、时间线、伏笔、地点</li>
        <li><strong>从设定集同步</strong>：修改设定文件后重新索引</li>
      </ul>
      <h4>角色工坊（深度角色开发）</h4>
      <p>点击右侧导航栏的 <strong>"角色工坊"</strong>：</p>
      <ul>
        <li><strong>心理模型</strong>：Want（想要）/ Need（需要）/ Ghost（心魔）/ Wound（创伤）/ Lie（谎言）</li>
        <li><strong>声纹DNA</strong>：从手稿中训练角色的说话风格，让 AI 写对话时更自然</li>
        <li><strong>角色关系图</strong>：可视化展示角色之间的关系网络</li>
      </ul>
      <h4>设定圣经（结构化世界观）</h4>
      <p>点击右侧导航栏的 <strong>"设定圣经"</strong>，填写结构化的世界观信息：</p>
      <ul>
        <li>核心元数据：标题、题材、Logline、背景、基调、主题</li>
        <li>世界观分区：世界观 / 魔法体系 / 政治 / 历史 / 风俗</li>
      </ul>
    </>
  ),

  quality: (
    <>
      <h3>🔍 检查你的作品质量</h3>
      <h4>作品质量页面</h4>
      <p>Story OS → <strong>「作品质量」</strong>，含两套评分体系：</p>
      <p><strong>叙事引擎 6 维度</strong>（EngineCritic）：结构、角色、场景、叙事压力、声音/对白、连续性/主题；标记 HARD / SOFT / PASS，含 Governor 决策。</p>
      <p><strong>章节启发式 6 维度</strong>：人物塑造、剧情推进、节奏控制、对白质量、情绪张力、设定一致性。</p>
      <ul>
        <li><strong>设定一致性检查</strong>：角色名、地点等前后是否矛盾</li>
        <li><strong>审查面板</strong>：规则 / 语义 / 规则+语义，结果可转修改计划</li>
      </ul>
      <h4>悬念分析</h4>
      <p>点击右侧导航栏的 <strong>"悬念分析"</strong>：</p>
      <ul>
        <li>每章的<strong>悬念强度评分</strong>（红=高，黄=中，绿=低）</li>
        <li><strong>张力曲线</strong>：柱状图展示全书悬念走势（理想是波浪形）</li>
        <li><strong>悬念线索分类</strong>：悬疑/危险/关系/揭露</li>
      </ul>
      <div className="um-callout">
        <strong>💡 什么时候做质量检查？</strong> 写完一个阶段后（比如 10 章或一卷）做一次，不用每章都查。
      </div>
    </>
  ),

  plan: (
    <>
      <h3>🗺️ 规划后续章节</h3>
      <h4>今日建议与同步</h4>
      <p>Story OS → <strong>「今日建议」</strong>，先用同步刷新数据：</p>
      <table className="um-table">
        <thead><tr><th>按钮</th><th>作用</th></tr></thead>
        <tbody>
          <tr><td><strong>快速同步</strong></td><td>日常写作前，刷新今日任务与诊断</td></tr>
          <tr><td><strong>全书理解</strong></td><td>大改/新卷前，深度分析全书</td></tr>
        </tbody>
      </table>
      <ul>
        <li><strong>今日任务</strong>：优先级排序，带预估时间，可「开始写作」</li>
        <li><strong>诊断建议</strong>：可生成行动计划或修改计划</li>
      </ul>
      <p className="muted">显示「暂无任务」？先快速同步，或在创作路线生成规划。</p>
      <h4>创作路线</h4>
      <p>Story OS → <strong>「创作路线」</strong>：</p>
      <ul>
        <li><strong>故事目标</strong>：当前状态 → 目标状态</li>
        <li><strong>章节路线图</strong>：每章一卡（计划中/进行中/已完成/已跳过）</li>
        <li><strong>生成创作路线</strong>：AI 规划后续 5～50 章</li>
      </ul>
      <h4>节拍大纲</h4>
      <p>点击右侧导航栏的 <strong>"节拍大纲"</strong>，把一章拆成多个小场景：</p>
      <ol>
        <li>选择章节，添加节拍（标题、场景类型、描述）</li>
        <li>点击 <strong>"一键从节拍写作"</strong>，AI 根据节拍生成写作计划</li>
      </ol>
      <h4>修改计划</h4>
      <p>点击右侧导航栏的 <strong>"修改计划"</strong>，管理待确认/执行中/已完成的修改。</p>
    </>
  ),

  review: (
    <>
      <h3>📋 编辑和审稿</h3>
      <h4>审稿中心（全局）</h4>
      <p>点击左侧导航栏的 <strong>"审稿中心"（图标 ◑）</strong>，对项目进行深度审查：</p>
      <table className="um-table">
        <thead><tr><th>模式</th><th>做什么</th></tr></thead>
        <tbody>
          <tr><td>规则审查</td><td>用内置规则引擎检查（不需要 AI）</td></tr>
          <tr><td>语义审查</td><td>用 LLM 深度分析（需要 AI 模型）</td></tr>
          <tr><td>规则+语义</td><td>两者结合</td></tr>
        </tbody>
      </table>
      <p>审查结果包含：</p>
      <ul>
        <li><strong>Governor 决策</strong>：通过 / 建议修订 / 建议重写</li>
        <li><strong>6 维度</strong>：结构、角色、场景、叙事压力、声音/对白、连续性/主题</li>
        <li><strong>等级</strong>：HARD / SOFT / PASS</li>
        <li><strong>问题列表</strong>：每个问题有位置、描述和修改建议</li>
      </ul>
      <h4>修改计划</h4>
      <p>审查发现的问题可以转换为<strong>修改计划</strong>，在右侧导航栏的"修改计划"中管理。</p>
    </>
  ),

  screenplay: (
    <>
      <h3>🎬 编剧专用功能</h3>
      <p>如果你的项目类型是<strong>电影剧本、剧集剧本或短视频脚本</strong>，编辑器会变成专业编剧界面。</p>
      <h4>电影剧本</h4>
      <ul>
        <li><strong>场景看板</strong>：三列看板（第一幕建置 → 第二幕对抗 → 第三幕解决）</li>
        <li>每个场景卡片：内/外景、地点、时间、角色、故事线、梗概、时长</li>
        <li>可拖拽排序，可按故事线筛选</li>
        <li>支持导出 <strong>Fountain 格式</strong>（剧本行业标准）</li>
      </ul>
      <h4>剧集剧本</h4>
      <ul>
        <li><strong>剧集列表</strong>：管理每一集，每集包含多个场景</li>
        <li><strong>伏笔追踪</strong>：管理跨集的叙事伏笔</li>
        <li><strong>角色弧线</strong>：追踪角色跨集发展</li>
      </ul>
      <h4>短视频脚本</h4>
      <ul>
        <li><strong>分镜看板</strong>：管理每个镜头</li>
        <li>支持分段和平台设置（抖音、B站等）</li>
        <li><strong>节奏分析</strong>：控制视频节奏</li>
      </ul>
      <h4>编剧室</h4>
      <p>Story OS → <strong>「编剧室」</strong>：</p>
      <ul>
        <li><strong>Canon 规则</strong>：世界观铁律，AI 写作时自动遵守</li>
        <li><strong>结构化记忆</strong>：章节叙事摘要与事实库</li>
        <li><strong>流水线</strong>：Creator → Critic → Governor → 自动生成 <strong>修改计划</strong></li>
      </ul>
      <p className="muted">Governor 给出「建议修订」后，到修改计划确认 → 工作台执行 → 标记完成。</p>
    </>
  ),

  export: (
    <>
      <h3>💾 导出和备份</h3>
      <h4>导出作品</h4>
      <ol>
        <li>点击左侧菜单的 <strong>"导出"</strong> 或顶部工具栏的导出按钮</li>
        <li>选择导出格式：</li>
      </ol>
      <table className="um-table">
        <thead><tr><th>格式</th><th>适合场景</th></tr></thead>
        <tbody>
          <tr><td><strong>ZIP 包</strong></td><td>备份整个项目（推荐）</td></tr>
          <tr><td><strong>EPUB</strong></td><td>电子书，手机/平板阅读</td></tr>
          <tr><td><strong>Word 全书</strong></td><td>合并成一个 Word，方便投稿</td></tr>
          <tr><td><strong>ZIP 含分章 Word</strong></td><td>每章一个 Word，逐章投稿</td></tr>
          <tr><td><strong>Markdown</strong></td><td>单章纯文本</td></tr>
        </tbody>
      </table>
      <h4>导入文档</h4>
      <ol>
        <li>点击顶部工具栏的 <strong>"上传"</strong> 按钮</li>
        <li>选择目标目录（正文/大纲/设定集/旧稿/试验稿）</li>
        <li>选择文件或<strong>拖拽</strong>到模态框</li>
      </ol>
      <p>支持格式：.md、.txt、.docx、.pdf、.html、.zip</p>
      <h4>版本管理（备份和恢复）</h4>
      <ol>
        <li>点击左侧导航栏的 <strong>"项目版本"（图标 ⧉）</strong></li>
        <li>点击 <strong>"创建快照"</strong> 给项目拍照存档</li>
        <li>需要恢复时，点击 <strong>"恢复到工作台"</strong></li>
      </ol>
      <div className="um-callout">
        <strong>💡 什么时候该存版本？</strong> 删除重要角色前、大改剧情线前、完成一卷后。
      </div>
    </>
  ),

  advanced: (
    <>
      <h3>⚡ 进阶功能</h3>
      <h4>全局搜索</h4>
      <p><kbd>Cmd/Ctrl + K</kbd> 搜索正文、大纲、设定、归档，支持正则。</p>
      <h4>素材中心</h4>
      <p>◧ 素材中心：跨项目角色卡、地点、灵感碎片。单部作品结构化知识请用项目内 <strong>作品知识</strong>。</p>
      <h4>本机技能</h4>
      <p>AI 中心 → <strong>本机技能</strong>（默认 Skill）/ <strong>发现安装</strong>。更换 Skill 后建议新建对话会话。</p>
      <h4>项目分享</h4>
      <p>项目库 → 卡片 <strong>⋯ → 共享权限</strong>，设置只读或可编辑。</p>
      <h4>MCP 扩展</h4>
      <p>AI 中心 → <strong>MCP 扩展</strong>：安装外部工具服务器，扩展 AI 能力。</p>
      <h4>用户管理（管理员）</h4>
      <p>👤 用户管理：创建/启用/禁用/删除用户。</p>
      <h4>留言板</h4>
      <p>💬 留言板：图文留言与多层回复。</p>
    </>
  ),

  faq: (
    <>
      <h3>❓ 常见问题解答</h3>
      <h4>Claude Code 未连接？</h4>
      <ol>
        <li>AI 中心 → 总览，查看 Claude Code 状态</li>
        <li>本机安装 CLI，终端能执行 <code>claude</code>；Docker 需镜像内含 CLI</li>
        <li>安装后重启服务或重建容器</li>
      </ol>
      <h4>模型连接测试失败？</h4>
      <ol>
        <li>协议与 Base URL 匹配（<code>/v1</code>→OpenAI，<code>/anthropic</code>→Anthropic）</li>
        <li>检查 API Key 与网络（Docker 注意容器出网）</li>
        <li>MiMo 用户优先试 <strong>MiMo Anthropic</strong> 模板</li>
        <li>成功后 <strong>设为活跃</strong> 并 <strong>新建会话</strong> 验证</li>
      </ol>
      <h4>换了模型 AI 还说自己是 Claude？</h4>
      <p>旧会话缓存上下文 → 会话选择器 <strong>+ 新建会话</strong>，再问「你是什么模型？由谁提供？」</p>
      <h4>AI 不回复？</h4>
      <ol>
        <li>确认 Claude Code 已连接（绿色）</li>
        <li>点重连；查 AI 中心总览三项状态</li>
        <li>检查 API Key、网络、WebSocket</li>
      </ol>
      <h4>今日建议暂无任务？</h4>
      <p>先点 <strong>快速同步</strong>，确认有章节内容，或在创作路线生成规划。</p>
      <h4>内容丢失？</h4>
      <ul>
        <li>自动保存（2.5 秒）；查左侧文件列表</li>
        <li>项目版本快照恢复；Docker 勿删数据卷</li>
      </ul>
      <h4>AI 味太重？</h4>
      <ul>
        <li>当初稿，手动改；用润色；角色工坊训练声纹 DNA</li>
      </ul>
      <h4>数据存在哪？</h4>
      <p>本机：<code>backend-node/data/</code>；Docker：命名数据卷。不上传官方云端。</p>
      <h4>修改/删除项目？</h4>
      <p>设置：工作台顶部 ⚙️。删除：项目库 <strong>⋯ → 删除</strong>，输入标题确认。删前请导出 ZIP。</p>
      <h4>导出 Word 失败？</h4>
      <p>需 Python 3.9+ 及依赖，模态框会显示具体错误。</p>
    </>
  ),

  shortcuts: (
    <>
      <h3>⌨️ 快捷键速查</h3>
      <table className="um-table">
        <thead><tr><th>快捷键</th><th>功能</th></tr></thead>
        <tbody>
          <tr><td><kbd>Cmd/Ctrl</kbd> + <kbd>S</kbd></td><td>保存当前章节</td></tr>
          <tr><td><kbd>Cmd/Ctrl</kbd> + <kbd>←</kbd></td><td>切换到上一章</td></tr>
          <tr><td><kbd>Cmd/Ctrl</kbd> + <kbd>→</kbd></td><td>切换到下一章</td></tr>
          <tr><td><kbd>Cmd/Ctrl</kbd> + <kbd>K</kbd></td><td>全局搜索</td></tr>
          <tr><td><kbd>F</kbd></td><td>专注模式（隐藏侧栏）</td></tr>
          <tr><td><kbd>?</kbd></td><td>查看所有快捷键</td></tr>
          <tr><td><kbd>Enter</kbd></td><td>发送 AI 消息</td></tr>
          <tr><td><kbd>Shift</kbd> + <kbd>Enter</kbd></td><td>在 AI 输入框中换行</td></tr>
          <tr><td><kbd>Escape</kbd></td><td>关闭弹窗/退出专注模式</td></tr>
        </tbody>
      </table>
      <h4>编辑器快捷操作</h4>
      <ul>
        <li>选中文字（8 字符以上）→ 浮动操作栏（改写/扩写/润色/讨论）</li>
        <li>停止打字 2.5 秒 → 自动保存</li>
      </ul>
    </>
  ),
}

export default function UserManualModal({ open, onClose }) {
  const [active, setActive] = useState('intro')

  return (
    <Modal open={open} onClose={onClose} title="📖 用户手册" panelClassName="um-panel">
      <div className="um-layout">
        <nav className="um-sidebar">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              className={`um-sidebar-item ${active === s.id ? 'um-sidebar-active' : ''}`}
              onClick={() => setActive(s.id)}
            >
              <span className="um-sidebar-icon">{s.icon}</span>
              <span className="um-sidebar-label">{s.label}</span>
            </button>
          ))}
        </nav>
        <div className="um-content">
          {content[active]}
        </div>
      </div>
    </Modal>
  )
}
