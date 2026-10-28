import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AnalysisReport } from '../../api/types'
import { useApi } from '../../lib/useApi'
import { AnalysisDetail } from './AnalysisDetail'

vi.mock('../../lib/useApi', () => ({ useApi: vi.fn() }))
vi.mock('./ReportSections', () => ({
  AiSummaryPanel: () => null, AssessmentAccordion: () => null,
  InvestigationResult: () => null, LifecycleSection: () => null, RegionBackground: () => null,
}))
const previous = {
  report_id: 'previous', region_name: '이전 보고서 지역',
  scope: { region_code: '11110', month: '202512' }, context: {},
  assessments: [], context_investigation_status: 'not_performed', markdown: '',
} as unknown as AnalysisReport
const reload = vi.fn()
function snapshot(loading: boolean, error: string | null) {
  vi.mocked(useApi).mockReturnValue({ data: previous, loading, error, reload, setData: vi.fn() })
}
afterEach(() => vi.clearAllMocks())

describe('report replacement loading', () => {
  it('shows a failed replacement load and retry instead of hiding them behind the stale-report spinner', () => {
    // useApi keeps its previous data during an ID change; render each hook snapshot.
    snapshot(false, null)
    expect(renderToStaticMarkup(createElement(AnalysisDetail, { reportId: 'previous', mode: 'preview' }))).toContain('이전 보고서 지역')
    snapshot(true, null)
    const waiting = renderToStaticMarkup(createElement(AnalysisDetail, { reportId: 'replacement', mode: 'preview' }))
    expect(waiting).toContain('보고서를 불러오는 중')
    expect(waiting).not.toContain('이전 보고서 지역')
    snapshot(false, '새 보고서 로드에 실패했습니다.')
    const failed = renderToStaticMarkup(createElement(AnalysisDetail, { reportId: 'replacement', mode: 'preview' }))
    expect(failed).toContain('새 보고서 로드에 실패했습니다.')
    expect(failed).toContain('다시 시도')
    expect(failed).not.toContain('보고서를 불러오는 중')
    expect(failed).not.toContain('이전 보고서 지역')
  })
})
