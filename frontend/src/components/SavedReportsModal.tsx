import { useEffect, useId, useState, type ReactNode } from 'react'
import { api } from '../api/endpoints'
import type { AnalysisReport } from '../api/types'
import { ReportDownload } from './report/ReportDownload'
import { formatDateTime } from '../lib/format'
import { scopeLine } from '../lib/labels'
import { useApi } from '../lib/useApi'
import type { SavedReportsTab } from '../state/modals'
import { AnalysisCardList, useAnalysisList, type AnalysisListFilter } from './report/AnalysisCardList'
import { AnalysisDetail } from './report/AnalysisDetail'
import { FinalReportView } from './response/FinalReportView'
import { Icon } from './icons'
import { Badge, EmptyState, ErrorBox, Modal, ModalHeader, Notice, Spinner, Tabs } from './ui'

export function SavedReportsModal({
  initialTab = 'analysis',
  reportId,
  responseReportId,
  filter,
  onClose,
  onReview,
}: {
  initialTab?: SavedReportsTab
  reportId?: string
  responseReportId?: string
  filter?: AnalysisListFilter & { label?: string }
  onClose: () => void
  onReview: (report: AnalysisReport) => void
}) {
  const titleId = useId()
  const [tab, setTab] = useState<SavedReportsTab>(initialTab)
  const [activeFilter, setActiveFilter] = useState(filter)

  return (
    <Modal onClose={onClose} labelledBy={titleId}>
      <ModalHeader titleId={titleId} eyebrow="현황 분석과 예방 대응 보고서" title="저장된 보고서" onClose={onClose}>
        <Tabs
          value={tab}
          onChange={setTab}
          items={[
            { value: 'analysis', label: '현황 분석' },
            { value: 'response', label: '예방 대응' },
          ]}
        />
        {activeFilter?.label && (
          <button type="button" onClick={() => setActiveFilter(undefined)} className="flex min-h-8 items-center gap-1.5 rounded-full bg-accent-tint px-3 py-1 text-footnote font-medium text-link transition-quick hover:bg-fill-strong">
            {activeFilter.label} 보고서만 보는 중 <Icon name="close" className="size-3.5" />
          </button>
        )}
      </ModalHeader>
      {tab === 'analysis' ? (
        <AnalysisTab filter={activeFilter} initialId={reportId} onReview={onReview} />
      ) : (
        <ResponseTab filter={activeFilter} initialId={responseReportId} />
      )}
    </Modal>
  )
}

function SplitPane({ list, detail }: { list: ReactNode; detail: ReactNode }) {
  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden md:grid-cols-[300px_1fr]">
      <div className="max-h-[38vh] overflow-y-auto border-b border-separator p-3 md:max-h-none md:border-r md:border-b-0">{list}</div>
      <div className="min-h-0 overflow-y-auto bg-canvas px-5 pt-6 sm:px-8">{detail}</div>
    </div>
  )
}

function AnalysisTab({ filter, initialId, onReview }: { filter?: AnalysisListFilter; initialId?: string; onReview: (report: AnalysisReport) => void }) {
  const [refreshKey, setRefreshKey] = useState(0)
  const list = useAnalysisList(filter, refreshKey)
  const [selected, setSelected] = useState<string | null>(initialId ?? null)

  useEffect(() => {
    if (!selected && list.reports.length) setSelected(list.reports[0].report_id)
  }, [list.reports, selected])

  return (
    <SplitPane
      list={
        <>
          {!list.loading && !list.error && !list.reports.length && <EmptyState>저장된 현황 분석이 없습니다. 메인이나 대시보드에서 지역을 분석해 주세요.</EmptyState>}
          <AnalysisCardList list={list} selectedId={selected} onSelect={setSelected} />
        </>
      }
      detail={
        selected ? (
          <AnalysisDetail
            key={selected}
            reportId={selected}
            mode="full"
            onReview={onReview}
            onReportCreated={(created) => {
              setSelected(created.report_id)
              setRefreshKey((value) => value + 1)
            }}
          />
        ) : list.loading ? (
          <Spinner />
        ) : (
          <Notice tone="muted">왼쪽에서 분석을 골라 주세요.</Notice>
        )
      }
    />
  )
}

function ResponseTab({ filter, initialId }: { filter?: AnalysisListFilter; initialId?: string }) {
  const { data, error, loading, reload } = useApi(
    (signal) => api.listResponseReports({ limit: 100, dong_code: filter?.dong_code, region_code: filter?.region_code }, signal),
    [filter?.dong_code, filter?.region_code],
  )
  const [selected, setSelected] = useState<string | null>(initialId ?? null)
  const reports = data?.reports ?? []

  useEffect(() => {
    if (!selected && reports.length) setSelected(reports[0].report_id)
  }, [reports, selected])

  return (
    <SplitPane
      list={
        <div className="flex flex-col gap-1.5">
          {loading && <Spinner />}
          {error && <ErrorBox message={error} onRetry={reload} />}
          {!loading && !error && !reports.length && <EmptyState>만든 예방 대응 보고서가 없습니다. 현황 분석에서 "대응안 검토"로 시작해 주세요.</EmptyState>}
          {reports.map((report) => {
            const active = report.report_id === selected
            return (
              <button
                key={report.report_id}
                type="button"
                onClick={() => setSelected(report.report_id)}
                aria-current={active}
                className={`rounded-control px-3.5 py-3 text-left transition-quick ${active ? 'bg-accent-tint' : 'hover:bg-fill'}`}
              >
                <Badge tone="green">예방 대응</Badge>
                <div className="mt-1.5 text-headline text-label">{report.title}</div>
                <div className="mt-0.5 text-footnote text-label-secondary">{scopeLine(report.scope)}</div>
                <div className="mt-1 flex items-center gap-2 text-footnote text-label-secondary">
                  {formatDateTime(report.created_at)} · 대응안 {report.selected_plan_count}개
                </div>
              </button>
            )
          })}
        </div>
      }
      detail={selected ? <ResponseDetail key={selected} reportId={selected} /> : <Notice tone="muted">왼쪽에서 보고서를 골라 주세요.</Notice>}
    />
  )
}

function ResponseDetail({ reportId }: { reportId: string }) {
  const { data, error, loading, reload } = useApi((signal) => api.getResponseReport(reportId, signal), [reportId])
  if (loading) return <Spinner label="보고서를 불러오는 중" />
  if (error || !data) return <ErrorBox message={error ?? '보고서를 불러오지 못했습니다.'} onRetry={reload} />
  return (
    <div className="flex flex-col gap-5">
      <FinalReportView report={data} />
      <div className="glass sticky bottom-0 -mx-5 flex justify-end border-t border-separator px-5 py-3 sm:-mx-8 sm:px-8">
        <ReportDownload reportId={data.report_id} filename={data.filename} />
      </div>
    </div>
  )
}
