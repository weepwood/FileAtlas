import type { PointerEvent } from 'react'

export function handleSpotlightMove(event: PointerEvent<HTMLElement>): void {
  const rect = event.currentTarget.getBoundingClientRect()
  const x = event.clientX - rect.left
  const y = event.clientY - rect.top
  event.currentTarget.style.setProperty('--spot-x', `${x}px`)
  event.currentTarget.style.setProperty('--spot-y', `${y}px`)
}

export type FileCategory = 'code' | 'image' | 'video' | 'audio' | 'archive' | 'document' | 'data' | 'other'

const CODE_EXT = new Set(['ts', 'tsx', 'js', 'jsx', 'py', 'rs', 'go', 'java', 'cpp', 'c', 'h', 'css', 'scss', 'html', 'vue', 'svelte', 'sh'])
const IMAGE_EXT = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'avif', 'ico', 'psd', 'fig', 'sketch'])
const VIDEO_EXT = new Set(['mp4', 'mov', 'mkv', 'webm', 'avi', 'm4v', 'prproj'])
const AUDIO_EXT = new Set(['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a'])
const ARCHIVE_EXT = new Set(['zip', 'tar', 'gz', '7z', 'rar', 'tgz', 'dmg', 'iso'])
const DOC_EXT = new Set(['md', 'pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'txt', 'rtf', 'epub'])
const DATA_EXT = new Set(['json', 'yaml', 'yml', 'toml', 'csv', 'tsv', 'sql', 'db', 'sqlite', 'parquet', 'xml'])

export function getFileCategory(extension: string): FileCategory {
  const ext = extension.toLocaleLowerCase()
  if (CODE_EXT.has(ext)) return 'code'
  if (IMAGE_EXT.has(ext)) return 'image'
  if (VIDEO_EXT.has(ext)) return 'video'
  if (AUDIO_EXT.has(ext)) return 'audio'
  if (ARCHIVE_EXT.has(ext)) return 'archive'
  if (DOC_EXT.has(ext)) return 'document'
  if (DATA_EXT.has(ext)) return 'data'
  return 'other'
}

export async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // Fallback below
  }
  try {
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(textarea)
    return ok
  } catch {
    return false
  }
}
