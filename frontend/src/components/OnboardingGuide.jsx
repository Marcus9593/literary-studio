import { useState } from 'react'
import { Link } from 'react-router-dom'

const STORAGE_KEY = 'literary_studio_onboarding_v1'

const STEPS = [
  {
    title: '1. 创建项目',
    body: '在「项目库」新建作品，或导入 docx 开始写作。',
    link: '/projects',
    label: '前往项目库',
  },
  {
    title: '2. 工作台写稿',
    body: '进入项目后在中间区域写作，右侧 AI 对话可续写、改稿。',
    link: null,
    label: null,
  },
  {
    title: '3. Story OS（右侧竖栏）',
    body: '节拍大纲 → 角色工坊 → 设定圣经 → 悬念分析 → 作品质量，按流程使用。',
    link: null,
    label: null,
  },
  {
    title: '4. 编剧室闭环',
    body: '「编剧室」管理 Canon 与记忆；「作品质量」运行规则审稿 + Governor。',
    link: null,
    label: null,
  },
  {
    title: '5. AI 配置',
    body: '在 AI 中心配置模型；语义审稿需 HTTP API 模型。',
    link: '/ai/models',
    label: '配置模型',
  },
]

export function isOnboardingDismissed() {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export function dismissOnboarding() {
  try {
    localStorage.setItem(STORAGE_KEY, '1')
  } catch { /* ignore */ }
}

export default function OnboardingGuide({ onDismiss }) {
  const [open, setOpen] = useState(!isOnboardingDismissed())

  if (!open) return null

  const close = () => {
    dismissOnboarding()
    setOpen(false)
    onDismiss?.()
  }

  return (
    <div className="onboarding-overlay" role="dialog" aria-label="新手指引">
      <div className="onboarding-card card">
        <header className="onboarding-head">
          <h2>文匠 Studio 功能地图</h2>
          <button type="button" className="btn btn-ghost btn-sm" onClick={close}>关闭</button>
        </header>
        <p className="hint">按推荐顺序使用各模块，快速上手创作闭环。</p>
        <ol className="onboarding-steps">
          {STEPS.map((s) => (
            <li key={s.title}>
              <strong>{s.title}</strong>
              <p>{s.body}</p>
              {s.link && (
                <Link to={s.link} className="btn btn-ghost btn-sm" onClick={close}>
                  {s.label}
                </Link>
              )}
            </li>
          ))}
        </ol>
        <div className="onboarding-foot">
          <button type="button" className="btn btn-primary" onClick={close}>
            知道了，开始创作
          </button>
        </div>
      </div>
    </div>
  )
}
