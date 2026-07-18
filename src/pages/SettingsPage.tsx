import { CheckCircle2, CircleX, Database, HardDrive, LockKeyhole, Network } from 'lucide-react'
import { detectCapabilities } from '../services/capabilities'

export function SettingsPage() {
  const capabilities = detectCapabilities()
  const rows = [
    ['目录选择器', capabilities.directoryPicker, '完整目录授权、空目录识别与后续写入能力'],
    ['目录上传降级', capabilities.webkitDirectory, 'Firefox / Safari 等环境中的本次会话分析'],
    ['Web Worker', capabilities.webWorker, '将统计和哈希计算移出主线程'],
    ['Web Crypto', capabilities.webCrypto, '生成 SHA-256 文件指纹'],
    ['IndexedDB', capabilities.indexedDB, '在浏览器本地保存快照'],
  ] as const
  return (
    <div className="page-stack">
      <div className="page-heading"><div><span className="eyebrow">PRIVACY & CAPABILITIES</span><h1>能力与隐私</h1><p>FileAtlas 根据实际 API 能力启用功能，而不是仅依赖浏览器名称判断。</p></div></div>
      <div className="privacy-grid">
        <article className="panel privacy-card"><LockKeyhole size={22} /><h2>默认只读</h2><p>首版不执行删除、移动或重命名。目录授权仅用于读取元数据和必要的哈希片段。</p></article>
        <article className="panel privacy-card"><Network size={22} /><h2>不上传目录数据</h2><p>扫描、统计、哈希与导出均在当前设备中完成。应用本身仍需从部署站点加载静态资源。</p></article>
        <article className="panel privacy-card"><Database size={22} /><h2>本地快照</h2><p>快照保存在当前浏览器的 IndexedDB 中，清理站点数据会删除这些记录。</p></article>
        <article className="panel privacy-card"><HardDrive size={22} /><h2>大文件保护</h2><p>超过 128 MB 的重复候选默认仅做抽样指纹比较，并明确标注为“可能重复”。</p></article>
      </div>
      <article className="panel">
        <div className="panel-title"><div><h2>浏览器能力检测</h2><p>当前设备与浏览器的实时结果</p></div></div>
        <div className="capability-list">{rows.map(([label, supported, description]) => <div key={label}>{supported ? <CheckCircle2 className="supported" size={18} /> : <CircleX className="unsupported" size={18} />}<div><strong>{label}</strong><small>{description}</small></div><b>{supported ? '可用' : '不可用'}</b></div>)}</div>
      </article>
    </div>
  )
}
