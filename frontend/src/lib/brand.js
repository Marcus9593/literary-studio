/** 产品品牌文案（全站统一，固定不随 Skill 变化） */
export const BRAND = {
  title: '文匠 Studio',
  mark: '文',
  tagline: '编剧级创作台',
  slogan: '为叙事创作者打磨每一稿',
  engine: '叙事引擎',
  taglineHint: '面向编剧与叙事创作者的专业 AI 工作台',

  home: {
    title: '创作项目',
    intro:
      '从大纲、场次到成稿，在同一工作台完成结构搭建、对白打磨与迭代改稿。支持剧本、网文与长篇叙事项目。',
    emptyTitle: '还没有项目',
    emptyDesc: '创建第一个项目，导入已有本子或 docx 文稿，开始打磨你的故事。',
    createCta: '创建第一个项目',
  },

  cockpit: {
    title: '创作看板',
    intro: '全局创作数据一览：各项目今日改稿章节数、改动字数与近 7 日趋势（按文稿保存时间统计）。',
  },

  versions: {
    title: '项目版本',
    intro: '为大改前创建快照，对比差异并一键回滚到历史版本。',
  },

  review: {
    title: '审稿中心',
    intro: '跨项目选稿审稿：规则引擎 + Governor 决策，以及启发式正文分析。',
  },

  assets: {
    title: '素材中心',
    intro:
      '跨项目素材备忘：角色卡、地点与灵感碎片。单部作品的结构化设定与知识图谱请进入项目 → 作品知识。',
  },

  /** @deprecated 创作中心已拆分为独立功能模块 */
  studio: {
    title: '创作中心',
    intro: '此入口已废弃，请使用侧栏各功能模块。',
  },

  aiCenter: {
    title: 'AI 中心',
    intro: '配置创作引擎：模型连接、默认技能、MCP 扩展与外部工具。密钥仅存本机。',
  },

  guestbook: {
    title: '创作备忘录',
    intro: '记录灵感、待办事项和写作进度。支持图文、标签分类与置顶。',
  },

  /** @deprecated 已合并至 aiCenter */
  tools: {
    title: '工具中心',
    intro: '管理创作 Skill：安装、发现与设置默认 Skill。平台可通过 Skill 适配器调用 skill 内脚本。',
  },

  /** @deprecated 已合并至 aiCenter */
  settings: {
    title: 'AI 配置',
    intro:
      '备用 LLM 模型配置（OpenAI / Anthropic 兼容）。日常对话与写稿由 Claude Code 叙事引擎驱动，密钥仅存本机。',
  },
}
