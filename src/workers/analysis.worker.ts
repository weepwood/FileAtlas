/// <reference lib="webworker" />
import { calculateStatistics } from '../utils/file'
import type { FileEntryRecord } from '../types'

self.onmessage = (event: MessageEvent<{ entries: FileEntryRecord[] }>) => {
  self.postMessage(calculateStatistics(event.data.entries))
}
