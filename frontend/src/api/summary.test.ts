import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AnalysisReport } from './types'
import { requestActivitySummary } from './summary'

const report = (id: string) => ({ report_id: id, scope: { month: '202512' } }) as AnalysisReport
afterEach(() => vi.unstubAllGlobals())

describe('saved activity summaries', () => {
  it('posts only the saved report identifier and coalesces simultaneous reads', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () => new Response(JSON.stringify({ report_id: 'one', text: '저장된 관측 요약', created_at: 'now', reused: false })))
    vi.stubGlobal('fetch', fetch)
    const values = await Promise.all([requestActivitySummary(report('one')), requestActivitySummary(report('one'))])
    expect(values).toEqual(['저장된 관측 요약', '저장된 관측 요약'])
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(fetch.mock.calls[0]?.[0]).toBe('/api/model/analysis-reports/one/summary')
    expect(fetch.mock.calls[0]?.[1]).toMatchObject({ method: 'POST', body: undefined })
  })

  it('allows retry after a busy model without caching the error', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ detail: { code: 'activity_summary_busy', message: '다른 AI 작업 중' } }), { status: 409 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ report_id: 'retry', text: '재시도 성공' })))
    vi.stubGlobal('fetch', fetch)
    await expect(requestActivitySummary(report('retry'))).rejects.toMatchObject({ status: 409 })
    await expect(requestActivitySummary(report('retry'))).resolves.toBe('재시도 성공')
  })

  it('does not join requests for different report IDs', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => new Response(JSON.stringify({ report_id: url.includes('/first/') ? 'first' : 'second', text: url.includes('/first/') ? '첫 보고서' : '다음 보고서' }))))
    expect(await Promise.all([requestActivitySummary(report('first')), requestActivitySummary(report('second'))])).toEqual(['첫 보고서', '다음 보고서'])
  })

  it('rejects an invalid or mismatched response', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ report_id: 'other', text: '잘못된 보고서' }))))
    await expect(requestActivitySummary(report('invalid'))).rejects.toMatchObject({ code: 'activity_summary_invalid_response' })
  })
})
