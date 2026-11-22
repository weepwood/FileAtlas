import { useState } from 'react'
import {
  CheckCircle2,
  CircleX,
  Database,
  Filter,
  HardDrive,
  LockKeyhole,
  Moon,
  Network,
  Plus,
  RotateCcw,
  Sun,
  X,
} from 'lucide-react'
import { detectCapabilities } from '../services/capabilities'
import { DEFAULT_IGNORE_NAMES, useUiStore } from '../store/useUiStore'
import { handleSpotlightMove } from '../utils/spotlight'

export function SettingsPage() {
  const capabilities = detectCapabilities()
  const { theme, setTheme, scanConfig, updateScanConfig, resetScanConfig, pushToast } = useUiStore()
  const [newIgnore, setNewIgnore] = useState('')

  const rows = [
    ['File System Access 目录选择器', capabilities.directoryPicker, '完整目录句柄授权、最近目录持久化与空目录精确识别'],
    ['webkitdirectory 目录上传降级', capabilities.webkitDirectory, 'Firefox / Safari 等环境的单次会话兼容读取方案（统一应用忽略规则）'],
    ['Web Worker 多线程计算', capabilities.webWorker, '将统计聚合与 SHA-256 指纹计算移出 UI 主线程，支持实时进度与取消'],
    ['Web Crypto 原生加密引擎', capabilities.webCrypto, '使用浏览器原生硬件加速生成 SHA-256 文件指纹'],
    ['IndexedDB 本地数据库', capabilities.indexedDB, '在当前设备浏览器中离线保存目录快照与最近扫描句柄'],
  ] as const

  const supportedCount = rows.filter(([, ok]) => ok).length

  const handleAddIgnore = () => {
    const cleaned = newIgnore.trim()
    if (!cleaned) return
    if (scanConfig.customIgnores.includes(cleaned)) {
      setNewIgnore('')
      return
    }
    updateScanConfig({ customIgnores: [...scanConfig.customIgnores, cleaned] })
    setNewIgnore('')
    pushToast({ tone: 'success', title: `已添加忽略目录/文件名：${cleaned}` })
  }

  const handleRemoveIgnore = (target: string) => {
    updateScanConfig({
      customIgnores: scanConfig.customIgnores.filter((item) => item !== target),
    })
  }

  return (
    <div className="page-stack">
      <div className="page-heading">
        <div>
          <span className="eyebrow">SETTINGS, PRIVACY & CAPABILITIES</span>
          <h1>扫描配置与隐私能力</h1>
          <p>自定义本地目录扫描过滤规则，并实时查看浏览器运行时能力与隐私边界。</p>
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

      <article className="panel spotlight-surface" onPointerMove={handleSpotlightMove}>
        <div className="panel-title">
          <div>
            <h2>扫描过滤与深度策略</h2>
            <p>统一作用于目录授权、拖拽读取与降级上传三种入口，保存于本地偏好设置（下次扫描生效）</p>
          </div>
          <div className="panel-title-right">
            <button
              type="button"
              className="chip-btn reset"
              onClick={() => {
                resetScanConfig()
                pushToast({ tone: 'info', title: '已恢复默认扫描规则' })
              }}
            >
              <RotateCcw size={12} />
              <span>恢复默认</span>
            </button>
            <Filter size={18} className="accent-sky" />
          </div>
        </div>

        <div className="scan-config-body">
          <div className="scan-config-row">
            <div>
              <strong>跳过常见开发构建缓存目录</strong>
              <small>默认忽略：{DEFAULT_IGNORE_NAMES.join(', ')}（若需诊断 node_modules 占用可关闭此项）</small>
            </div>
            <button
              type="button"
              aria-pressed={scanConfig.ignoreDefaults}
              className={scanConfig.ignoreDefaults ? 'chip-btn active' : 'chip-btn'}
              onClick={() => updateScanConfig({ ignoreDefaults: !scanConfig.ignoreDefaults })}
            >
              {scanConfig.ignoreDefaults ? '已启用默认忽略' : '不跳过默认目录'}
            </button>
          </div>

          <div className="scan-config-row">
            <div>
              <strong>跳过点号开头的隐藏文件与隐藏文件夹</strong>
              <small>开启后将在遍历阶段直接忽略所有以 . 开头的文件或目录（如 .env、.DS_Store）</small>
            </div>
            <button
              type="button"
              aria-pressed={scanConfig.skipHidden}
              className={scanConfig.skipHidden ? 'chip-btn active' : 'chip-btn'}
              onClick={() => updateScanConfig({ skipHidden: !scanConfig.skipHidden })}
            >
              {scanConfig.skipHidden ? '已跳过隐藏项' : '保留隐藏项'}
            </button>
          </div>

          <div className="scan-config-row">
            <div>
              <strong>最大递归扫描层级上限</strong>
              <small>限制遍历深度可进一步加速超大型仓库的顶层结构概览</small>
            </div>
            <select
              className="compact-select"
              aria-label="最大递归扫描层级"
              value={scanConfig.maxDepth ?? 0}
              onChange={(event) => {
                const num = Number(event.target.value)
                updateScanConfig({ maxDepth: num > 0 ? num : null })
              }}
            >
              <option value={0}>不限层级（完整扫描）</option>
              <option value={3}>最多深入 3 层</option>
              <option value={5}>最多深入 5 层</option>
              <option value={8}>最多深入 8 层</option>
              <option value={12}>最多深入 12 层</option>
            </select>
          </div>

          <div className="scan-custom-ignores">
            <div className="scan-custom-head">
              <strong>自定义额外忽略名称</strong>
              <div className="scan-custom-input-wrap">
                <input
                  value={newIgnore}
                  onChange={(event) => setNewIgnore(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      handleAddIgnore()
                    }
                  }}
                  placeholder="输入目录或文件名，如 venv / coverage…"
                />
                <button type="button" className="chip-btn active" onClick={handleAddIgnore}>
                  <Plus size={12} /> 添加
                </button>
              </div>
            </div>

            {scanConfig.customIgnores.length > 0 ? (
              <div className="tiny-pills-wrap">
                {scanConfig.customIgnores.map((item) => (
                  <span className="custom-ignore-tag" key={item}>
                    <code>{item}</code>
                    <button
                      type="button"
                      aria-label={`移除忽略项 ${item}`}
                      onClick={() => handleRemoveIgnore(item)}
                    >
                      <X size={11} />
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <small className="muted-hint">暂未添加自定义忽略名称。</small>
            )}
          </div>
        </div>
      </article>

      <div className="privacy-grid">
        <article className="panel privacy-card spotlight-surface" onPointerMove={handleSpotlightMove}>
          <div className="stat-icon">
            <LockKeyhole size={20} />
          </div>
          <h2>默认只读保护</h2>
          <p>当前版本不执行任何直接磁盘覆写或删除。配套生成的整理脚本采用安全隔离移动（mv -n）策略，由您审阅后自主运行。</p>
        </article>
        <article className="panel privacy-card spotlight-surface" onPointerMove={handleSpotlightMove}>
          <div className="stat-icon">
            <Network size={20} />
          </div>
          <h2>零网络上传</h2>
          <p>文件树遍历、快速预览、SHA-256 哈希与报告导出完全在本地沙盒内完成，仅静态前端资源来自托管站点。</p>
        </article>
        <article className="panel privacy-card spotlight-surface" onPointerMove={handleSpotlightMove}>
          <div className="stat-icon">
            <Database size={20} />
          </div>
          <h2>离线本地快照</h2>
          <p>目录快照与最近访问句柄存储在当前浏览器站点的 IndexedDB 中，不会同步至云端；清理站点存储即可擦除。</p>
        </article>
        <article className="panel privacy-card spotlight-surface" onPointerMove={handleSpotlightMove}>
          <div className="stat-icon">
            <HardDrive size={20} />
          </div>
          <h2>大文件内存保护</h2>
          <p>预览抽屉仅切片读取前 48 KB 文本，超过 128 MB 的重复候选采用 64 KB×3 抽样指纹，严防主内存峰值溢出。</p>
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
