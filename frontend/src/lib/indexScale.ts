import type { I5Record } from '../api/types'

export interface IndexBin {
  label: string
  min: number
  max: number
  fill: string
}

export const INDEX_NAME = '지역 고립 지수 (0~10점)'
export const INDEX_SOURCE_NOTE = 'I5 표시점수(0~10점) · 2025년 12월 시군구 기준 상대점수 · 5점은 기준 평균'

export const INDEX_BINS: IndexBin[] = [
  { label: '0–2 미만', min: 0, max: 2, fill: 'var(--map-1)' },
  { label: '2–4 미만', min: 2, max: 4, fill: 'var(--map-2)' },
  { label: '4–6 미만', min: 4, max: 6, fill: 'var(--map-3)' },
  { label: '6–8 미만', min: 6, max: 8, fill: 'var(--map-4)' },
  { label: '8–10', min: 8, max: 10, fill: 'var(--map-5)' },
]

export function displayScore(record: { i5_display_score?: number | null } | null | undefined): number | null {
  const value = record?.i5_display_score
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 10 ? value : null
}

const LEGACY_REFERENCE_VERSION = 'i5_sgg_202512_equal_weight_v1'
const DISPLAY_REFERENCES = new Map<string, { mean: number; standardDeviation: number }>([
  [LEGACY_REFERENCE_VERSION, { mean: 35.22968484607534, standardDeviation: 0.8623201205529184 }],
  ['i5_10group_sgg_202512_equal_weight_v1', { mean: 35.24084915654042, standardDeviation: 0.8708522905523021 }],
])

// Use one matching frozen model reference; aggregate raw adult-weighted scores before clipping.
export function provinceDisplayScore(records: Pick<I5Record, 'i5_reference' | 'population_20plus' | 'i5_display_reference_version'>[]): number | null {
  const versions = new Set(records.map((row) => row.i5_display_reference_version ?? LEGACY_REFERENCE_VERSION))
  if (versions.size !== 1) return null
  const reference = DISPLAY_REFERENCES.get([...versions][0])
  if (!reference) return null
  const raw = weightedAverage(records.map((row) => ({ value: row.i5_reference, weight: row.population_20plus })))
  return raw === null ? null : Math.max(0, Math.min(10, 5 + (raw - reference.mean) / reference.standardDeviation))
}

export const NO_VALUE_FILL = 'var(--map-none)'

export function binFor(value: number | null | undefined): IndexBin | null {
  if (value === null || value === undefined || !Number.isFinite(value) || value < 0 || value > 10) return null
  if (value === 10) return INDEX_BINS[INDEX_BINS.length - 1]
  return INDEX_BINS.find((bin) => value >= bin.min && value < bin.max) ?? null
}

export function fillFor(value: number | null | undefined): string {
  return binFor(value)?.fill ?? NO_VALUE_FILL
}

export function weightedAverage(items: { value: number | null; weight: number | null }[]): number | null {
  let sum = 0
  let weight = 0
  for (const item of items) {
    if (item.value === null || !Number.isFinite(item.value) || item.weight === null || !Number.isFinite(item.weight) || item.weight <= 0) continue
    sum += item.value * item.weight
    weight += item.weight
  }
  return weight ? sum / weight : null
}
