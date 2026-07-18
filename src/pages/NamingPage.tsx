import { useMemo, useState } from 'react'
import { SearchCheck, WandSparkles } from 'lucide-react'
import { EmptyState } from '../components/EmptyState'
import { findSimilarNames } from '../services/naming'
import { useFileAtlasStore } from '../store/useFileAtlasStore'

export function NamingPage() {
  const { entries, status } = useFileAtlasStore()
  const [prefix, setPrefix] = useState('')
  const [suffix, setSuffix] = useState('')
  const [replaceFrom, setReplaceFrom] = useState('')
  const [replaceTo, setReplaceTo] = useState('')
  const groups = useMemo(() => findSimilarNames(entries), [entries])
  const preview = useMemo(() => entries.filter((entry) => entry.kind === 'file').slice(0, 30).map((entry, index) => {
    const dot = entry.name.lastIndexOf('.')
    const base = dot > 0 ? entry.name.slice(0, dot) : entry.name
    const ext = dot > 0 ? entry.name.slice(dot) : ''
    const replaced = replaceFrom ? base.replaceAll(replaceFrom, replaceTo) : base
    return { ...entry, target: `${prefix}${replaced}${suffix}${ext}`, index }
  }), [entries, prefix, replaceFrom, replaceTo, suffix])

  if (status === 'idle') return <EmptyState />
  return (
    <div className="page-stack">
      <div className="page-heading"><div><span className="eyebrow">NAMING</span><h1>命名整理</h1><p>识别相似文件名并生成重命名预览；当前版本不会写入本地文件。</p></div></div>
      <div className="two-column">
        <article className="panel">
          <div className="panel-title"><div><h2>规则预览</h2><p>先检查冲突，再决定是否进入未来的写入模式</p></div><WandSparkles size={19} /></div>
          <div className="form-grid">
            <label><span>添加前缀</span><input value={prefix} onChange={(event) => setPrefix(event.target.value)} placeholder="例如：2026-" /></label>
            <label><span>添加后缀</span><input value={suffix} onChange={(event) => setSuffix(event.target.value)} placeholder="例如：-归档" /></label>
            <label><span>替换文字</span><input value={replaceFrom} onChange={(event) => setReplaceFrom(event.target.value)} placeholder="原文字" /></label>
            <label><span>替换为</span><input value={replaceTo} onChange={(event) => setReplaceTo(event.target.value)} placeholder="新文字" /></label>
          </div>
          <div className="rename-preview">
            {preview.map((item) => <div key={item.id}><span>{item.name}</span><b>→</b><strong className={item.name === item.target ? 'muted' : ''}>{item.target}</strong></div>)}
          </div>
        </article>
        <article className="panel">
          <div className="panel-title"><div><h2>相似文件名</h2><p>基于 Unicode 归一化与编辑距离分组</p></div><SearchCheck size={19} /></div>
          <div className="similar-groups">
            {groups.slice(0, 20).map((group) => (
              <div className="similar-group" key={group.id}>
                <strong>相似度 {(group.score * 100).toFixed(0)}%</strong>
                {group.files.map((file) => <span key={file.id}>{file.name}<small>{file.parentPath}</small></span>)}
              </div>
            ))}
            {!groups.length && <p className="muted-text">当前扫描范围没有发现明显的相似命名簇。</p>}
          </div>
        </article>
      </div>
    </div>
  )
}
