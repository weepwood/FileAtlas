import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { RecentDirectoryRecord, Snapshot } from '../types'

interface FileAtlasDB extends DBSchema {
  snapshots: {
    key: string
    value: Snapshot
    indexes: { 'by-created-at': number }
  }
  recentHandles: {
    key: string
    value: RecentDirectoryRecord
    indexes: { 'by-scanned-at': number }
  }
}

let cachedDbPromise: Promise<IDBPDatabase<FileAtlasDB>> | null = null
const memorySnapshots = new Map<string, Snapshot>()
const memoryRecents = new Map<string, RecentDirectoryRecord>()

function hasIndexedDb(): boolean {
  return typeof indexedDB !== 'undefined'
}

function getDb(): Promise<IDBPDatabase<FileAtlasDB>> {
  if (!cachedDbPromise) {
    cachedDbPromise = openDB<FileAtlasDB>('fileatlas', 2, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          const store = db.createObjectStore('snapshots', { keyPath: 'id' })
          store.createIndex('by-created-at', 'createdAt')
        }
        if (oldVersion < 2 && !db.objectStoreNames.contains('recentHandles')) {
          const recentStore = db.createObjectStore('recentHandles', { keyPath: 'id' })
          recentStore.createIndex('by-scanned-at', 'lastScannedAt')
        }
      },
    })
  }
  return cachedDbPromise
}

export async function saveSnapshot(snapshot: Snapshot): Promise<void> {
  if (!hasIndexedDb()) {
    memorySnapshots.set(snapshot.id, snapshot)
    return
  }
  const db = await getDb()
  await db.put('snapshots', snapshot)
}

export async function listSnapshots(): Promise<Snapshot[]> {
  if (!hasIndexedDb()) {
    return [...memorySnapshots.values()].sort((a, b) => b.createdAt - a.createdAt)
  }
  const db = await getDb()
  return (await db.getAllFromIndex('snapshots', 'by-created-at')).sort((a, b) => b.createdAt - a.createdAt)
}

export async function deleteSnapshot(id: string): Promise<void> {
  if (!hasIndexedDb()) {
    memorySnapshots.delete(id)
    return
  }
  const db = await getDb()
  await db.delete('snapshots', id)
}

export async function saveRecentDirectory(record: RecentDirectoryRecord): Promise<void> {
  if (!hasIndexedDb()) {
    memoryRecents.set(record.id, record)
    return
  }
  try {
    const db = await getDb()
    await db.put('recentHandles', record)
    const all = (await db.getAllFromIndex('recentHandles', 'by-scanned-at')).sort(
      (a, b) => b.lastScannedAt - a.lastScannedAt,
    )
    for (const stale of all.slice(6)) {
      await db.delete('recentHandles', stale.id)
    }
  } catch {
    // Ignore IndexedDB handle serialization limitations in non-Chromium browsers
  }
}

export async function listRecentDirectories(): Promise<RecentDirectoryRecord[]> {
  if (!hasIndexedDb()) {
    return [...memoryRecents.values()].sort((a, b) => b.lastScannedAt - a.lastScannedAt)
  }
  try {
    const db = await getDb()
    return (await db.getAllFromIndex('recentHandles', 'by-scanned-at')).sort(
      (a, b) => b.lastScannedAt - a.lastScannedAt,
    )
  } catch {
    return []
  }
}

export async function deleteRecentDirectory(id: string): Promise<void> {
  if (!hasIndexedDb()) {
    memoryRecents.delete(id)
    return
  }
  try {
    const db = await getDb()
    await db.delete('recentHandles', id)
  } catch {
    // Ignore errors
  }
}
