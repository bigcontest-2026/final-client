import { describe, expect, it } from 'vitest'
import type { RegionItem } from '../api/types'
import { parseQuestion } from './parseQuestion'

const regions: RegionItem[] = [
  { code: '51110', name: '춘천시', province_code: '51', province_name: '강원특별자치도', dong_count: 25 },
  { code: '11680', name: '강남구', province_code: '11', province_name: '서울특별시', dong_count: 22 },
  { code: '11140', name: '중구', province_code: '11', province_name: '서울특별시', dong_count: 15 },
  { code: '26110', name: '중구', province_code: '26', province_name: '부산광역시', dong_count: 9 },
  { code: '41110', name: '수원시', province_code: '41', province_name: '경기도', dong_count: 0 },
  { code: '41111', name: '수원시 장안구', province_code: '41', province_name: '경기도', dong_count: 10 },
]

describe('parseQuestion', () => {
  it('finds region and age in a plain question', () => {
    expect(parseQuestion('춘천시 20대의 활동 변화를 분석해 줘', regions)).toEqual({ provinceCode: '51', regionCode: '51110', ageCode: '20G' })
  })

  it('accepts a short region name', () => {
    expect(parseQuestion('강남 30대 보여줘', regions)).toMatchObject({ regionCode: '11680', ageCode: '30G' })
  })

  it('does not guess between districts with the same name', () => {
    expect(parseQuestion('중구 40대', regions).regionCode).toBeUndefined()
  })

  it('uses the province to break a tie', () => {
    expect(parseQuestion('부산 중구 50대', regions)).toMatchObject({ provinceCode: '26', regionCode: '26110', ageCode: '50G' })
  })

  it('prefers the longest matching name', () => {
    expect(parseQuestion('수원시 장안구 노인', regions)).toMatchObject({ regionCode: '41111', ageCode: '60GU' })
  })

  it('returns nothing for an unrelated sentence', () => {
    expect(parseQuestion('안녕하세요', regions)).toEqual({})
  })
})
