import { useCallback, useEffect, useState } from 'react'
import { api } from '../../api/endpoints'
import { errorMessage, isAbort } from '../../api/client'
import type { AnalysisReportSummary } from '../../api/types'
import { formatDateTime } from '../../lib/format'
import { scopeLine } from '../../lib/labels'
import { Badge, Button, ErrorBox, Spinner } from '../ui'

const PAGE_SIZE = 20

export interface AnalysisListFilter {
  dong_code?: string
  region_code?: string
}

export function useAnalysisList(filter: AnalysisListFilter | undefined, refreshKey = 0) {
  const [reports, setReports] = useState<AnalysisReportSummary[]>([])
  const [nextOffset, setNextOffset] = useState<number | null>(null)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const dong = filter?.dong_code
  const region = filter?.region_code

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError(null)
    api
      .listAnalysisReports({ limit: PAGE_SIZE, dong_code: dong, region_code: region }, controller.signal)
      .then((page) => {
        setReports(page.reports)
        setNextOffset(page.next_offset)
        setTotal(page.total_matched)
      })
      .catch((reason) => {
        if (!isAbort(reason)) setError(errorMessage(reason))
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [dong, region, refreshKey, attempt])

  const loadMore = useCallback(() => {
    if (nextOffset === null) return
    setLoading(true)
    api
      .listAnalysisReports({ limit: PAGE_SIZE, offset: nextOffset, dong_code: dong, region_code: region })
      .then((page) => {
        setReports((current) => [...current, ...page.reports.filter((item) => !current.some((existing) => existing.report_id === item.report_id))])
        setNextOffset(page.next_offset)
        setTotal(page.total_matched)
      })
      .catch((reason) => setError(errorMessage(reason)))
      .finally(() => setLoading(false))
  }, [nextOffset, dong, region])

  return { reports, total, loading, error, hasMore: nextOffset !== null, loadMore, retry: () => setAttempt((value) => value + 1) }
}

export function reportKindLabel(report: Pick<AnalysisReportSummary, 'report_type'>): string {
  return report.report_type === 'context_cause_analysis' ? '원인 분석' : '관측 현황'
}

export function AnalysisCardList({
  list,
  selectedId,
  onSelect,
}: {
  list: ReturnType<typeof useAnalysisList>
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  if (list.error && !list.reports.length) return <ErrorBox message={list.error} onRetry={list.retry} />
  return (
    <div className="flex flex-col gap-1.5">
      {list.reports.map((report) => {
        const active = report.report_id === selectedId
        const cause = report.report_type === 'context_cause_analysis'
        return (
          <button
            key={report.report_id}
            type="button"
            onClick={() => onSelect(report.report_id)}
            aria-current={active}
            className={`rounded-control px-3.5 py-3 text-left transition-quick ${active ? 'bg-accent-tint' : 'hover:bg-fill'}`}
          >
            <div className="flex items-center gap-1.5">
              <Badge tone={cause ? 'violet' : 'blue'}>{reportKindLabel(report)}</Badge>
              {report.report_status === 'partial' && <Badge tone="amber">일부 집단 자료 없음</Badge>}
            </div>
            <div className="mt-1.5 text-headline text-label">{report.region_name}</div>
            <div className="mt-0.5 text-footnote text-label-secondary">{scopeLine(report.scope)}</div>
            <div className="mt-1 text-footnote text-label-secondary">{formatDateTime(report.created_at)}</div>
          </button>
        )
      })}
      {list.loading && <Spinner />}
      {list.error && list.reports.length > 0 && <ErrorBox message={list.error} />}
      {list.hasMore && !list.loading && (
        <Button size="sm" onClick={list.loadMore}>
          더 불러오기 ({list.reports.length}/{list.total})
        </Button>
      )}
    </div>
  )
}
