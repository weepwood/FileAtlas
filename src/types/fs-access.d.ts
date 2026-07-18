interface Window {
  showDirectoryPicker?: (options?: { mode?: 'read' | 'readwrite'; id?: string }) => Promise<FileSystemDirectoryHandle>
}

interface HTMLInputElement {
  webkitdirectory: boolean
}
