import type { AgeCode, RegionItem } from '../api/types'

export interface ParsedQuestion {
  provinceCode?: string
  regionCode?: string
  ageCode?: AgeCode
}

const PROVINCE_ALIASES: Record<string, string[]> = {
  '11': ['서울'],
  '26': ['부산'],
  '27': ['대구'],
  '28': ['인천'],
  '29': ['광주광역시', '광주시'],
  '30': ['대전'],
  '31': ['울산'],
  '36': ['세종'],
  '41': ['경기'],
  '43': ['충북', '충청북도'],
  '44': ['충남', '충청남도'],
  '46': ['전남', '전라남도'],
  '47': ['경북', '경상북도'],
  '48': ['경남', '경상남도'],
  '50': ['제주'],
  '51': ['강원'],
  '52': ['전북', '전라북도'],
}

const AGE_PATTERNS: [RegExp, AgeCode][] = [
  [/(60|70|80|90)\s*대|60\s*세\s*이상|노인|어르신|고령/, '60GU'],
  [/50\s*대/, '50G'],
  [/40\s*대/, '40G'],
  [/30\s*대/, '30G'],
  [/20\s*대|청년/, '20G'],
]

function shortName(name: string): string {
  return name.length > 2 ? name.replace(/(시|군|구)$/, '') : name
}

export function parseQuestion(text: string, regions: RegionItem[]): ParsedQuestion {
  const result: ParsedQuestion = {}
  const normalized = text.replace(/\s+/g, ' ')

  for (const [code, aliases] of Object.entries(PROVINCE_ALIASES)) {
    const full = regions.find((region) => region.province_code === code)?.province_name
    if ((full && normalized.includes(full)) || aliases.some((alias) => normalized.includes(alias))) {
      result.provinceCode = code
      break
    }
  }

  const pool = result.provinceCode ? regions.filter((region) => region.province_code === result.provinceCode) : regions
  const byLength = (a: RegionItem, b: RegionItem) => b.name.length - a.name.length
  const exact = pool.filter((region) => normalized.includes(region.name)).sort(byLength)
  const loose = pool.filter((region) => shortName(region.name) !== region.name && normalized.includes(shortName(region.name))).sort(byLength)
  const candidates = exact.length ? exact : loose
  const best = candidates[0]
  const ambiguous = candidates.filter((region) => region.name.length === best?.name.length).length > 1
  if (best && !ambiguous) {
    result.regionCode = best.code
    result.provinceCode = best.province_code
  }

  for (const [pattern, age] of AGE_PATTERNS) {
    if (pattern.test(normalized)) {
      result.ageCode = age
      break
    }
  }
  return result
}
