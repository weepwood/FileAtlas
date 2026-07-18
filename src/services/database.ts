import { openDB, type DBSchema } from 'idb'
import type { Snapshot } from '../types'

interface FileAtlasDB extends DBSchema {
  snapshots: {
    key: string
    value: Snapshot
    indexes: { 'by-created-at': number }
  }
}

const dbPromise = openDB<FileAtlasDB>('fileatlas', 1, {
  upgrade(db) {
    const store = db.createObjectStore('snapshots', { keyPath: 'id' })
    store.createIndex('by-created-at', 'createdAt')
  },
})

export async function saveSnapshot(snapshot: Snapshot): Promise<void> {
  const db = await dbPromise
  await db.put('snapshots', snapshot)
}

export async function listSnapshots(): Promise<Snapshot[]> {
  const db = await dbPromise
  return (await db.getAllFromIndex('snapshots', 'by-created-at')).sort((a, b) => b.createdAt - a.createdAt)
}

export async function deleteSnapshot(id: string): Promise<void> {
  const db = await dbPromise
  await db.delete('snapshots', id)
}
