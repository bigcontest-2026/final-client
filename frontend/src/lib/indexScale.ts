export interface IndexBin {
  label: string
  min: number
  max: number
  fill: string
}

export const INDEX_NAME = '지역 고립 지수'
export const INDEX_SOURCE_NOTE = 'I5 참고지수(0~100) · 전국 설문 집단 평균을 지역 인구구성으로 가중한 참고값'

export const INDEX_BINS: IndexBin[] = [
  { label: '34 미만', min: -Infinity, max: 34, fill: 'var(--map-1)' },
  { label: '34–35', min: 34, max: 35, fill: 'var(--map-2)' },
  { label: '35–36', min: 35, max: 36, fill: 'var(--map-3)' },
  { label: '36–37', min: 36, max: 37, fill: 'var(--map-4)' },
  { label: '37 이상', min: 37, max: Infinity, fill: 'var(--map-5)' },
]

export const NO_VALUE_FILL = 'var(--map-none)'

export function binFor(value: number | null | undefined): IndexBin | null {
  if (value === null || value === undefined || Number.isNaN(value)) return null
  return INDEX_BINS.find((bin) => value >= bin.min && value < bin.max) ?? null
}

export function fillFor(value: number | null | undefined): string {
  return binFor(value)?.fill ?? NO_VALUE_FILL
}

export function weightedAverage(items: { value: number | null; weight: number | null }[]): number | null {
  let sum = 0
  let weight = 0
  for (const item of items) {
    if (item.value === null || !item.weight) continue
    sum += item.value * item.weight
    weight += item.weight
  }
  return weight ? sum / weight : null
}
