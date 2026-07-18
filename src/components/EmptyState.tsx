import { FolderSearch } from 'lucide-react'

export function EmptyState({ title = '尚未扫描文件夹', description = '从顶部选择一个本地文件夹，所有分析都在当前设备中完成。' }: { title?: string; description?: string }) {
  return (
    <div className="empty-state">
      <div className="empty-icon"><FolderSearch size={30} /></div>
      <h2>{title}</h2>
      <p>{description}</p>
    </div>
  )
}
