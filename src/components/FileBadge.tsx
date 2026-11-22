import {
  File,
  FileArchive,
  FileAudio,
  FileCode2,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileVideo,
  Folder,
} from 'lucide-react'
import { getFileCategory } from '../utils/spotlight'

export function FileTypeIcon({
  kind,
  extension,
  size = 16,
}: {
  kind: 'file' | 'directory'
  extension: string
  size?: number
}) {
  if (kind === 'directory') {
    return (
      <span className="file-type-glyph cat-folder">
        <Folder size={size} />
      </span>
    )
  }

  const category = getFileCategory(extension)
  const Icon =
    category === 'code'
      ? FileCode2
      : category === 'image'
        ? FileImage
        : category === 'video'
          ? FileVideo
          : category === 'audio'
            ? FileAudio
            : category === 'archive'
              ? FileArchive
              : category === 'document'
                ? FileText
                : category === 'data'
                  ? FileSpreadsheet
                  : File

  return (
    <span className={`file-type-glyph cat-${category}`}>
      <Icon size={size} />
    </span>
  )
}
