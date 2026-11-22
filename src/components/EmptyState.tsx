import type { ReactNode } from 'react'
import { Cpu, Database, FolderSearch, HardDriveDownload, ShieldCheck, Sparkles } from 'lucide-react'
import { ScanButton } from './ScanButton'
import { generateDemoWorkspace } from '../services/demo'
import { useFileAtlasStore } from '../store/useFileAtlasStore'
import { useUiStore } from '../store/useUiStore'
import { handleSpotlightMove } from '../utils/spotlight'

interface EmptyStateProps {
  title?: string
  description?: string
  variant?: 'workspace' | 'inline'
  action?: ReactNode
}

export function EmptyState({
  title = '尚未扫描文件夹',
  description = '选择一个本地目录或直接拖拽文件夹至此处，所有扫描、哈希与分析计算均 100% 在当前设备浏览器内完成。',
  variant,
  action,
}: EmptyStateProps) {
  const { status, setResult } = useFileAtlasStore()
  const { setIsDemo, pushToast } = useUiStore()
  const resolvedVariant = variant ?? (status === 'idle' ? 'workspace' : 'inline')

  const loadDemo = () => {
    const demo = generateDemoWorkspace()
    setIsDemo(true)
    setResult(demo.rootName, demo.entries, demo.files, demo.statistics)
    pushToast({
      tone: 'info',
      title: '已载入示例工作区',
      message: '包含可验证 SHA-256 的重复文件、相似命名簇与健康审计样本。',
    })
  }

  if (resolvedVariant === 'inline') {
    return (
      <div className="empty-state empty-state-inline spotlight-surface" onPointerMove={handleSpotlightMove}>
        <div className="empty-icon">
          <FolderSearch size={26} />
        </div>
        <h2>{title}</h2>
        <p>{description}</p>
        {action && <div className="empty-actions">{action}</div>}
      </div>
    )
  }

  return (
    <section className="hero-empty spotlight-surface" onPointerMove={handleSpotlightMove}>
      <div className="hero-orb-stage" aria-hidden="true">
        <div className="hero-ring ring-outer" />
        <div className="hero-ring ring-middle" />
        <div className="hero-ring ring-inner" />
        <div className="hero-core">
          <FolderSearch size={30} />
        </div>
        <span className="floating-chip chip-top">SHA-256</span>
        <span className="floating-chip chip-right">Zero Upload</span>
        <span className="floating-chip chip-left">Web Worker</span>
      </div>

      <span className="eyebrow">PRIVACY-FIRST LOCAL WORKSPACE</span>
      <h1 className="hero-title">{title === '尚未扫描文件夹' ? '看见结构，理解空间，安心整理' : title}</h1>
      <p className="hero-description">{description}</p>

      <div className="hero-cta-row">
        <ScanButton label="选择本地文件夹" />
        <button type="button" className="button secondary-button" onClick={loadDemo}>
          <Sparkles size={16} />
          <span>体验示例工作区</span>
        </button>
      </div>

      <div className="drop-hint-pill">
        <HardDriveDownload size={14} />
        <span>支持将任意本地文件夹直接拖拽到浏览器窗口中快速扫描</span>
      </div>

      <div className="hero-pillars">
        <div className="hero-pillar">
          <ShieldCheck size={17} />
          <div>
            <strong>隐私零上传</strong>
            <span>默认只读模式，内容绝不离机</span>
          </div>
        </div>
        <div className="hero-pillar">
          <Cpu size={17} />
          <div>
            <strong>多线程指纹引擎</strong>
            <span>Web Worker + 抽样/完整 SHA-256</span>
          </div>
        </div>
        <div className="hero-pillar">
          <Database size={17} />
          <div>
            <strong>本地快照与导出</strong>
            <span>IndexedDB 差异对比与多格式报告</span>
          </div>
        </div>
      </div>
    </section>
  )
}
