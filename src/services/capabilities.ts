import type { BrowserCapabilities } from '../types'

export function detectCapabilities(): BrowserCapabilities {
  const input = document.createElement('input')
  return {
    directoryPicker: 'showDirectoryPicker' in window,
    webkitDirectory: 'webkitdirectory' in input,
    indexedDB: 'indexedDB' in window,
    webWorker: 'Worker' in window,
    webCrypto: Boolean(window.crypto?.subtle),
  }
}
