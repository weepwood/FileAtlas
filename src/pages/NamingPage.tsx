import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  Eye,
  FileCode2,
  RotateCcw,
  SearchCheck,
  ShieldAlert,
  Terminal,
  WandSparkles,
} from 'lucide-react'
import { EmptyState } from '../components/EmptyState'
import { exportRenameScript } from '../services/export'
import { buildRenamePlan, findSimilarNames, type RenameCaseMode } from '../services/naming'
import { useFileAtlasStore } from '../store/useFileAtlasStore'
import { useUiStore } from '../store/useUiStore'
import { handleSpotlightMove } from '../utils/spotlight'

export function NamingPage() {
  const { rootName, entries, status } = useFileAtlasStore()
  const { pushToast, openPreview } = useUiStore()

  const [prefix, setPrefix] = useState('')
  const [suffix, setSuffix] = useState('')
  const [replaceFrom, setReplaceFrom] = useState('')
  const [replaceTo, setReplaceTo] = useState('')
  const [useRegex, setUseRegex] = useState(false)
  const [caseMode, setCaseMode] = useState<RenameCaseMode>('none')
  const [extensionFilter, setExtensionFilter] = useState('')
  const [onlyChanged, setOnlyChanged] = useState(false)

  const groups = useMemo(() => findSimilarNames(entries), [entries])

  const plan = useMemo(
    () =>
      buildRenamePlan(entries, {
        prefix,
        suffix,
        replaceFrom,
        replaceTo,
        useRegex,
        caseMode,
        extensionFilter,
      }),
    [caseMode, entries, extensionFilter, prefix, replaceFrom, replaceTo, suffix, useRegex],
  )

  const displayedItems = useMemo(() => {
    const source = onlyChanged ? plan.items.filter((item) => item.changed) : plan.items
    return source.slice(0, 200)
  }, [onlyChanged, plan.items])

  if (status === 'idle') return <EmptyState />

  const hasAnyRule = Boolean(
    prefix || suffix || replaceFrom || replaceTo || caseMode !== 'none' || extensionFilter,
  )

  const clearRules = () => {
    setPrefix('')
    setSuffix('')
    setReplaceFrom('')
    setReplaceTo('')
    setUseRegex(false)
    setCaseMode('none')
    setExtensionFilter('')
    setOnlyChanged(false)
  }

  const canExportScript =
    plan.changedCount > 0 && plan.collisionCount === 0 && plan.invalidCount === 0 && !plan.regexError

  const handleExportScript = (shell: 'sh' | 'ps1') => {
    const changedItems = plan.items.filter((item) => item.changed)
    exportRenameScript(changedItems, rootName || 'workspace', shell)
    pushToast({
      tone: 'success',
      title: `已导出 ${changedItems.length} 项重命名脚本`,
      message: `请置于「${rootName}」根目录审阅后运行。`,
    })
  }

  return (
    <div className="page-stack">
      <div className="page-heading">
        <div>
          <span className="eyebrow">NAMING GOVERNANCE</span>
          <h1>命名整理</h1>
          <p>全量文件沙盒重命名预检（支持模板变量、正则、大小写规范与跨平台保留名检查）与相似命名聚类。</p>
        </div>
      </div>

      <div className="two-column">
        <article className="panel spotlight-surface" onPointerMove={handleSpotlightMove}>
          <div className="panel-title">
            <div>
              <h2>批量规则沙盒预览</h2>
              <p>实时校验同目录全量文件同名冲突与系统非法字符</p>
            </div>
            <div className="panel-title-right">
              <span className="panel-pill tabular-nums">变更 {plan.changedCount.toLocaleString()} 项</span>
              <WandSparkles size={18} className="accent-sky" />
            </div>
          </div>

          <div className="preset-bar">
            <span className="preset-label">快捷规则：</span>
            <button type="button" className="chip-btn" onClick={() => setPrefix('{date}-')}>
              + 修改日期 {'{date}'}
            </button>
            <button type="button" className="chip-btn" onClick={() => setSuffix('-{index:03}')}>
              + 三位序号 {'{index:03}'}
            </button>
            <button
              type="button"
              className="chip-btn"
              onClick={() => {
                setUseRegex(false)
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
                setUseRegex(true)
                setReplaceFrom('[-_\\s]*(副本|copy|backup)$')
                setReplaceTo('')
              }}
            >
              正则移除副本后缀
            </button>
            {hasAnyRule && (
              <button type="button" className="chip-btn reset" onClick={clearRules}>
                <RotateCcw size={12} /> 清空
              </button>
            )}
          </div>

          <div className="form-grid">
            <label>
              <span>添加前缀（支持 {'{date}'} / {'{index:03}'}）</span>
              <input value={prefix} onChange={(event) => setPrefix(event.target.value)} placeholder="例如：{date}- 或 2026-" />
            </label>
            <label>
              <span>添加后缀（支持 {'{index:02}'}）</span>
              <input value={suffix} onChange={(event) => setSuffix(event.target.value)} placeholder="例如：-{index:03} 或 -归档" />
            </label>
            <label>
              <span>查找文字{useRegex ? '（正则表达式）' : ''}</span>
              <input value={replaceFrom} onChange={(event) => setReplaceFrom(event.target.value)} placeholder={useRegex ? '例如：\\s+' : '例如：副本 / _'} />
            </label>
            <label>
              <span>替换为</span>
              <input value={replaceTo} onChange={(event) => setReplaceTo(event.target.value)} placeholder="留空表示移除匹配词" />
            </label>
            <label>
              <span>大小写规范</span>
              <select
                className="form-select"
                value={caseMode}
                onChange={(event) => setCaseMode(event.target.value as RenameCaseMode)}
              >
                <option value="none">保持原大小写</option>
                <option value="kebab">kebab-case（连字符小写）</option>
                <option value="snake">snake_case（下划线小写）</option>
                <option value="lower">全小写字母</option>
              </select>
            </label>
            <label>
              <span>限定扩展名（选填）</span>
              <input
                value={extensionFilter}
                onChange={(event) => setExtensionFilter(event.target.value.replace(/^\./, ''))}
                placeholder="例如：webp / pdf（留空应用全部）"
              />
            </label>
          </div>

          <div className="naming-options-strip">
            <div className="naming-toggles">
              <button
                type="button"
                aria-pressed={useRegex}
                className={useRegex ? 'chip-btn active' : 'chip-btn'}
                onClick={() => setUseRegex((prev) => !prev)}
              >
                正则匹配模式
              </button>
              <button
                type="button"
                aria-pressed={onlyChanged}
                className={onlyChanged ? 'chip-btn active' : 'chip-btn'}
                onClick={() => setOnlyChanged((prev) => !prev)}
              >
                仅显示有变更 ({plan.changedCount})
              </button>
            </div>

            {canExportScript && (
              <div className="naming-toggles">
                <button type="button" className="chip-btn active" onClick={() => handleExportScript('sh')}>
                  <Terminal size={12} /> 导出脚本 (.sh)
                </button>
                <button type="button" className="chip-btn" onClick={() => handleExportScript('ps1')}>
                  <FileCode2 size={12} /> PowerShell (.ps1)
                </button>
              </div>
            )}
          </div>

          {plan.regexError && (
            <div className="notice warning inline-notice">
              <AlertTriangle size={16} />
              <span>正则表达式语法有误：{plan.regexError}</span>
            </div>
          )}

          {plan.collisionCount > 0 && (
            <div className="notice warning inline-notice">
              <AlertTriangle size={16} />
              <span>检测到 {plan.collisionCount} 处同目录目标名称冲突（含与未改动文件的重名），请补充 {'{index:02}'} 序号区分。</span>
            </div>
          )}

          {plan.invalidCount > 0 && (
            <div className="notice warning inline-notice">
              <ShieldAlert size={16} />
              <span>检测到 {plan.invalidCount} 项包含跨平台非法字符或 Windows 保留设备名（CON/NUL 等）。</span>
            </div>
          )}

          <div className="rename-preview">
            {displayedItems.map((item) => (
              <div
                key={item.id}
                className={[
                  'rename-row',
                  item.changed ? 'is-changed' : '',
                  item.hasCollision || item.safetyError ? 'is-conflict' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                <span title={item.relativePath}>{item.name}</span>
                <b aria-hidden="true">
                  <ArrowRight size={13} />
                </b>
                <strong
                  className={item.changed ? '' : 'muted'}
                  title={item.safetyError ?? (item.hasCollision ? '同目录目标重名冲突' : item.target)}
                >
                  {item.target}
                  {item.hasCollision ? ' ⚠️冲突' : ''}
                  {item.safetyError ? ` ⚠️${item.safetyError}` : ''}
                </strong>
              </div>
            ))}
            {displayedItems.length === 0 && (
              <p className="muted-text">当前规则下暂无匹配的变更文件。</p>
            )}
          </div>
        </article>

        <article className="panel spotlight-surface" onPointerMove={handleSpotlightMove}>
          <div className="panel-title">
            <div>
              <h2>相似文件名聚类</h2>
              <p>智能剥离日期/版本前后缀并基于编辑距离识别近似副本</p>
            </div>
            <div className="panel-title-right">
              <span className="panel-pill tabular-nums">{groups.length} 组簇</span>
              <SearchCheck size={18} className="accent-indigo" />
            </div>
          </div>

          <div className="similar-groups">
            {groups.slice(0, 24).map((group) => {
              const scorePct = Math.round(group.score * 100)
              return (
                <div className="similar-group" key={group.id}>
                  <div className="similar-group-head">
                    <strong className="tabular-nums">相似度 {scorePct}%</strong>
                    <span className="tabular-nums">{group.files.length} 个文件</span>
                  </div>
                  {group.files.map((file) => (
                    <div
                      className="similar-file-item similar-file-interactive"
                      key={file.id}
                      onClick={() => openPreview(file.id)}
                    >
                      <div className="similar-file-row">
                        <span>{file.name}</span>
                        <Eye size={12} className="similar-eye" />
                      </div>
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
