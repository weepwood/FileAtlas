import { CheckCircle2, CircleX, Database, HardDrive, LockKeyhole, Moon, Network, Sun } from 'lucide-react'
import { detectCapabilities } from '../services/capabilities'
import { useUiStore } from '../store/useUiStore'
import { handleSpotlightMove } from '../utils/spotlight'

export function SettingsPage() {
  const capabilities = detectCapabilities()
  const { theme, setTheme } = useUiStore()

  const rows = [
    ['File System Access 目录选择器', capabilities.directoryPicker, '完整目录句柄授权、空目录精确识别与未来增量写入基础'],
    ['webkitdirectory 目录上传降级', capabilities.webkitDirectory, 'Firefox / Safari 等环境的单次会话兼容读取方案'],
    ['Web Worker 多线程计算', capabilities.webWorker, '将统计聚合与 SHA-256 指纹计算移出 UI 主线程，保障帧率流畅'],
    ['Web Crypto 原生加密引擎', capabilities.webCrypto, '使用浏览器原生硬件加速生成 SHA-256 文件指纹'],
    ['IndexedDB 本地数据库', capabilities.indexedDB, '在当前设备浏览器中离线保存目录快照并支持历史比对'],
  ] as const

  const supportedCount = rows.filter(([, ok]) => ok).length

  return (
    <div className="page-stack">
      <div className="page-heading">
        <div>
          <span className="eyebrow">PRIVACY & CAPABILITIES</span>
          <h1>能力与隐私</h1>
          <p>FileAtlas 依据浏览器运行时 API 能力自适应降级，并严格遵循本地只读隐私边界。</p>
        </div>
        <div className="segmented-tabs" role="group" aria-label="界面外观模式">
          <button
            type="button"
            className={theme === 'dark' ? 'seg-tab active' : 'seg-tab'}
            onClick={() => setTheme('dark')}
          >
            <Moon size={14} /> 深色星云
          </button>
          <button
            type="button"
            className={theme === 'light' ? 'seg-tab active' : 'seg-tab'}
            onClick={() => setTheme('light')}
          >
            <Sun size={14} /> 浅色晨雾
          </button>
        </div>
      </div>

      <div className="privacy-grid">
        <article className="panel privacy-card spotlight-surface" onPointerMove={handleSpotlightMove}>
          <div className="stat-icon">
            <LockKeyhole size={20} />
          </div>
          <h2>默认只读保护</h2>
          <p>当前版本不执行任何删除、移动或重命名磁盘写入。目录授权仅用于读取轻量元数据和必要的哈希分片。</p>
        </article>
        <article className="panel privacy-card spotlight-surface" onPointerMove={handleSpotlightMove}>
          <div className="stat-icon">
            <Network size={20} />
          </div>
          <h2>零网络上传</h2>
          <p>文件树遍历、空间聚合、SHA-256 哈希与报告导出完全在本地沙盒内完成，仅静态前端资源来自托管站点。</p>
        </article>
        <article className="panel privacy-card spotlight-surface" onPointerMove={handleSpotlightMove}>
          <div className="stat-icon">
            <Database size={20} />
          </div>
          <h2>离线本地快照</h2>
          <p>目录快照存储在当前浏览器站点的 IndexedDB 中，不会同步至云端；清理站点存储即可随时彻底擦除。</p>
        </article>
        <article className="panel privacy-card spotlight-surface" onPointerMove={handleSpotlightMove}>
          <div className="stat-icon">
            <HardDrive size={20} />
          </div>
          <h2>大文件内存保护</h2>
          <p>超过 128 MB 的同体积候选仅读取首中尾 64 KB 抽样指纹，并如实标注为“抽样一致”，防止主内存峰值溢出。</p>
        </article>
      </div>

      <article className="panel spotlight-surface" onPointerMove={handleSpotlightMove}>
        <div className="panel-title">
          <div>
            <h2>运行时能力矩阵</h2>
            <p>当前设备与浏览器的实时特性探测结果</p>
          </div>
          <span className="panel-pill tabular-nums">
            已就绪 {supportedCount} / {rows.length} 项
          </span>
        </div>
        <div className="capability-list">
          {rows.map(([label, supported, description]) => (
            <div key={label} className="capability-row">
              {supported ? (
                <CheckCircle2 className="supported" size={19} />
              ) : (
                <CircleX className="unsupported" size={19} />
              )}
              <div>
                <strong>{label}</strong>
                <small>{description}</small>
              </div>
              <b className={supported ? 'cap-pill is-ok' : 'cap-pill is-no'}>{supported ? '已启用' : '受限'}</b>
            </div>
          ))}
        </div>
      </article>
    </div>
  )
}
