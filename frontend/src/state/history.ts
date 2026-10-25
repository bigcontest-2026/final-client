import { useSyncExternalStore } from 'react'
import { readJson, writeJson } from '../lib/storage'

export interface HistoryEntry {
  id: string
  at: string
  source: 'main' | 'dashboard'
  question: string
  regionLabel: string
  scopeLabel: string
  reportId: string
}

const KEY = 'hermes:history:v1'
const LIMIT = 50
const listeners = new Set<() => void>()
let cache: HistoryEntry[] | null = null

function snapshot(): HistoryEntry[] {
  if (!cache) cache = readJson<HistoryEntry[]>(KEY, [])
  return cache
}

export function addHistory(entry: Omit<HistoryEntry, 'id' | 'at'>): void {
  const next = [{ ...entry, id: `${Date.now().toString(36)}`, at: new Date().toISOString() }, ...snapshot()].slice(0, LIMIT)
  cache = next
  writeJson(KEY, next)
  listeners.forEach((listener) => listener())
}

export function clearHistory(): void {
  cache = []
  writeJson(KEY, [])
  listeners.forEach((listener) => listener())
}

export function useHistory(): HistoryEntry[] {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    snapshot,
    snapshot,
  )
}
