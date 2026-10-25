import { useEffect, useState } from 'react'
import { api } from '../api/endpoints'
import { errorMessage } from '../api/client'
import type { HealthStatus, I5Record, RegionItem } from '../api/types'

export interface Province {
  code: string
  name: string
}

export interface RegionCatalog {
  provinces: Province[]
  regions: RegionItem[]
  months: string[]
  byCode: Map<string, RegionItem>
  provinceName: (code: string) => string
}

let catalogPromise: Promise<RegionCatalog> | null = null
let healthPromise: Promise<HealthStatus> | null = null
const dongCache = new Map<string, Promise<I5Record[]>>()

function buildCatalog(regions: RegionItem[], months: string[]): RegionCatalog {
  const provinceMap = new Map<string, string>()
  for (const region of regions) provinceMap.set(region.province_code, region.province_name)
  const provinces = [...provinceMap.entries()].map(([code, name]) => ({ code, name })).sort((a, b) => a.code.localeCompare(b.code))
  const byCode = new Map(regions.map((region) => [region.code, region]))
  return {
    provinces,
    regions,
    months,
    byCode,
    provinceName: (code: string) => provinceMap.get(code) ?? '',
  }
}

export function loadRegionCatalog(): Promise<RegionCatalog> {
  if (!catalogPromise) {
    catalogPromise = api.regions().then((response) => buildCatalog(response.regions, response.months))
    catalogPromise.catch(() => {
      catalogPromise = null
    })
  }
  return catalogPromise
}

export function loadHealth(): Promise<HealthStatus> {
  if (!healthPromise) {
    healthPromise = api.health()
    healthPromise.catch(() => {
      healthPromise = null
    })
  }
  return healthPromise
}

async function fetchAllDongs(query: { region_code?: string; province_code?: string; month: string }): Promise<I5Record[]> {
  const records: I5Record[] = []
  let offset: number | null = 0
  let runId: string | null = null
  let restarts = 0
  while (offset !== null) {
    const page = await api.surveyArea({ level: 'administrative_dong', limit: 500, offset, ...query })
    if (runId && page.run_id !== runId && restarts < 2) {
      records.length = 0
      offset = 0
      runId = null
      restarts += 1
      continue
    }
    runId = page.run_id
    records.push(...page.records)
    offset = page.next_offset
  }
  return records
}

export function loadDongs(query: { region_code?: string; month: string }): Promise<I5Record[]> {
  const key = `${query.region_code ?? 'all'}:${query.month}`
  let cached = dongCache.get(key)
  if (!cached) {
    cached = fetchAllDongs(query)
    dongCache.set(key, cached)
    cached.catch(() => dongCache.delete(key))
  }
  return cached
}

export function useRegionCatalog() {
  const [catalog, setCatalog] = useState<RegionCatalog | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let alive = true
    setError(null)
    loadRegionCatalog()
      .then((value) => alive && setCatalog(value))
      .catch((reason) => alive && setError(errorMessage(reason)))
    return () => {
      alive = false
    }
  }, [attempt])

  return { catalog, error, retry: () => setAttempt((value) => value + 1) }
}

export function useHealth() {
  const [health, setHealth] = useState<HealthStatus | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    loadHealth()
      .then((value) => alive && setHealth(value))
      .catch((reason) => alive && setError(errorMessage(reason)))
    return () => {
      alive = false
    }
  }, [])

  return { health, error }
}

export function latestMonth(months: string[] | undefined): string | null {
  if (!months?.length) return null
  return [...months].sort().at(-1) ?? null
}

export function selectableRegions(catalog: RegionCatalog, provinceCode: string): RegionItem[] {
  return catalog.regions.filter((region) => region.province_code === provinceCode).sort((a, b) => a.name.localeCompare(b.name, 'ko'))
}
