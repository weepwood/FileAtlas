import { useMemo, useState } from 'react'
import { AlertTriangle, ArrowRight, RotateCcw, SearchCheck, WandSparkles } from 'lucide-react'
import { EmptyState } from '../components/EmptyState'
import { findSimilarNames } from '../services/naming'
import { useFileAtlasStore } from '../store/useFileAtlasStore'
import { handleSpotlightMove } from '../utils/spotlight'

export function NamingPage() {
  const { entries, status } = useFileAtlasStore()
  const [prefix, setPrefix] = useState('')
  const [suffix, setSuffix] = useState('')
  const [replaceFrom, setReplaceFrom] = useState('')
  const [replaceTo, setReplaceTo] = useState('')

  const groups = useMemo(() => findSimilarNames(entries), [entries])

  const preview = useMemo(
    () =>
      entries
        .filter((entry) => entry.kind === 'file')
        .slice(0, 40)
        .map((entry, index) => {
          const dot = entry.name.lastIndexOf('.')
          const base = dot > 0 ? entry.name.slice(0, dot) : entry.name
          const ext = dot > 0 ? entry.name.slice(dot) : ''
          const replaced = replaceFrom ? base.replaceAll(replaceFrom, replaceTo) : base
          const target = `${prefix}${replaced}${suffix}${ext}`
          return { ...entry, target, changed: target !== entry.name, index }
        }),
    [entries, prefix, replaceFrom, replaceTo, suffix],
  )

  const collisionCount = useMemo(() => {
    const seen = new Map<string, number>()
    for (const item of preview) {
      const key = `${item.parentPath}/${item.target.toLocaleLowerCase()}`
      seen.set(key, (seen.get(key) ?? 0) + 1)
    }
    let collisions = 0
    for (const count of seen.values()) {
      if (count > 1) collisions += count - 1
    }
    return collisions
  }, [preview])

  const changedCount = useMemo(() => preview.filter((item) => item.changed).length, [preview])

  if (status === 'idle') return <EmptyState />

  const clearRules = () => {
    setPrefix('')
    setSuffix('')
    setReplaceFrom('')
    setReplaceTo('')
  }

  return (
    <div className="page-stack">
      <div className="page-heading">
        <div>
          <span className="eyebrow">NAMING GOVERNANCE</span>
          <h1>命名整理</h1>
          <p>识别相似命名簇并沙盒预览批量重命名规则，实时检查同目录重名冲突，不直接改动原文件。</p>
        </div>
      </div>

      <div className="two-column">
        <article className="panel spotlight-surface" onPointerMove={handleSpotlightMove}>
          <div className="panel-title">
            <div>
              <h2>批量规则沙盒预览</h2>
              <p>实时对比原名称与目标名称（前 40 个文件样本）</p>
            </div>
            <div className="panel-title-right">
              <span className="panel-pill tabular-nums">变更 {changedCount} 项</span>
              <WandSparkles size={18} className="accent-sky" />
            </div>
          </div>

          <div className="preset-bar">
            <span className="preset-label">快捷规则：</span>
            <button type="button" className="chip-btn" onClick={() => setPrefix('2026-')}>
              + 年份前缀
            </button>
            <button
              type="button"
              className="chip-btn"
              onClick={() => {
                setReplaceFrom('_')
                setReplaceTo('-')
              }}
            >
              下划线 → 连字符
            </button>
            <button
              type="button"
              className="chip-btn"
              onClick={() => {
                setReplaceFrom(' ')
                setReplaceTo('-')
              }}
            >
              空格 → 连字符
            </button>
            <button type="button" className="chip-btn" onClick={() => setSuffix('-archived')}>
              + 归档后缀
            </button>
            {(prefix || suffix || replaceFrom || replaceTo) && (
              <button type="button" className="chip-btn reset" onClick={clearRules}>
                <RotateCcw size={12} /> 清空
              </button>
            )}
          </div>

          <div className="form-grid">
            <label>
              <span>添加前缀</span>
              <input value={prefix} onChange={(event) => setPrefix(event.target.value)} placeholder="例如：2026-" />
            </label>
            <label>
              <span>添加后缀</span>
              <input value={suffix} onChange={(event) => setSuffix(event.target.value)} placeholder="例如：-归档" />
            </label>
            <label>
              <span>查找文字</span>
              <input value={replaceFrom} onChange={(event) => setReplaceFrom(event.target.value)} placeholder="例如：副本 / _" />
            </label>
            <label>
              <span>替换为</span>
              <input value={replaceTo} onChange={(event) => setReplaceTo(event.target.value)} placeholder="留空表示移除匹配词" />
            </label>
          </div>

          {collisionCount > 0 && (
            <div className="notice warning inline-notice">
              <AlertTriangle size={16} />
              <span>检测到 {collisionCount} 处同目录目标名称冲突，写入前需补充序号或区分词。</span>
            </div>
          )}

          <div className="rename-preview">
            {preview.map((item) => (
              <div key={item.id} className={item.changed ? 'rename-row is-changed' : 'rename-row'}>
                <span title={item.name}>{item.name}</span>
                <b aria-hidden="true">
                  <ArrowRight size={13} />
                </b>
                <strong className={item.changed ? '' : 'muted'} title={item.target}>
                  {item.target}
                </strong>
              </div>
            ))}
          </div>
        </article>

        <article className="panel spotlight-surface" onPointerMove={handleSpotlightMove}>
          <div className="panel-title">
            <div>
              <h2>相似文件名聚类</h2>
              <p>基于 Unicode NFKC 归一化与编辑距离检测近似副本</p>
            </div>
            <div className="panel-title-right">
              <span className="panel-pill tabular-nums">{groups.length} 组簇</span>
              <SearchCheck size={18} className="accent-indigo" />
            </div>
          </div>

          <div className="similar-groups">
            {groups.slice(0, 20).map((group) => {
              const scorePct = Math.round(group.score * 100)
              return (
                <div className="similar-group" key={group.id}>
                  <div className="similar-group-head">
                    <strong className="tabular-nums">相似度 {scorePct}%</strong>
                    <span className="tabular-nums">{group.files.length} 个文件</span>
                  </div>
                  {group.files.map((file) => (
                    <div className="similar-file-item" key={file.id}>
                      <span>{file.name}</span>
                      <small>{file.parentPath}</small>
                    </div>
                  ))}
                </div>
              )
            })}
            {!groups.length && <p className="muted-text">当前扫描范围没有发现明显的相似命名簇。</p>}
          </div>
        </article>
      </div>
    </div>
  )
}
