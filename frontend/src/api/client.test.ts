import { describe, expect, it } from 'vitest'
import { buildQuery, describeErrorDetail } from './client'

describe('describeErrorDetail', () => {
  it('uses a string detail as is', () => {
    expect(describeErrorDetail(422, { detail: '이 자료에서 지원하지 않는 조회 조건입니다.' })).toEqual({
      message: '이 자료에서 지원하지 않는 조회 조건입니다.',
      code: null,
    })
  })

  it('reads code and message from an object detail', () => {
    expect(describeErrorDetail(404, { detail: { code: 'analysis_report_not_found', message: '저장된 분석 보고서가 없습니다.' } })).toEqual({
      message: '저장된 분석 보고서가 없습니다.',
      code: 'analysis_report_not_found',
    })
  })

  it('names the fields of a validation array', () => {
    const result = describeErrorDetail(422, {
      detail: [
        { type: 'string_type', loc: ['body', 'region_code'], msg: 'Input should be a valid string' },
        { type: 'missing', loc: ['body', 'plans', 0, 'title'], msg: 'Field required' },
      ],
    })
    expect(result.code).toBe('validation_error')
    expect(result.message).toContain('시군구')
    expect(result.message).toContain('대응안 이름')
  })

  it('explains the local development 403', () => {
    expect(describeErrorDetail(403, { detail: { code: 'local_development_only' } }).message).toContain('프록시')
  })

  it('falls back when the body is empty', () => {
    expect(describeErrorDetail(503, null).message).toContain('준비되지 않았습니다')
  })
})

describe('buildQuery', () => {
  it('skips empty values and repeats arrays', () => {
    expect(buildQuery({ a: '1', b: undefined, c: '', d: null, e: ['x', 'y'], f: 0 })).toBe('?a=1&e=x&e=y&f=0')
  })

  it('returns an empty string with no values', () => {
    expect(buildQuery({ a: undefined })).toBe('')
  })
})
