import { useEffect, useRef, useState } from 'react'
import { ApiError, errorMessage } from '../../api/client'
import { api } from '../../api/endpoints'
import type { AnalysisReport, AnalysisReportSummary } from '../../api/types'
import { ReportDownload } from './ReportDownload'
import { INVESTIGATION_STATUS_LABELS, monthLabel, scopeGroupLabel, scopeLine } from '../../lib/labels'
import { useApi } from '../../lib/useApi'
import { Markdown } from '../Markdown'
import { Icon } from '../icons'
import { Accordion, Badge, Button, ErrorBox, Notice, Spinner, Thinking } from '../ui'
import { AiSummaryPanel, AssessmentAccordion, InvestigationResult, LifecycleSection, RegionBackground } from './ReportSections'

export function analysisFilename(report: AnalysisReport): string {
  const area = report.scope.dong_code ?? report.scope.region_code
  return `HERMES_현황분석_${area}_${report.scope.month}_${report.report_id}.md`
}

const MAX_CONFLICT_RETRIES = 18

export function AnalysisDetail({
  reportId,
  mode,
  onReview,
  onLink,
  onReportCreated,
}: {
  reportId: string
  mode: 'full' | 'preview'
  onReview?: (report: AnalysisReport) => void
  onLink?: (report: AnalysisReport) => void
  onReportCreated?: (report: AnalysisReport) => void
}) {
  const { data: report, error, loading, reload } = useApi((signal) => api.getAnalysisReport(reportId, signal), [reportId])
  const [investigating, setInvestigating] = useState(false)
  const [investigationError, setInvestigationError] = useState<string | null>(null)
  const [comparing, setComparing] = useState(false)
  const alive = useRef(true)

  useEffect(() => {
    alive.current = true
    setInvestigationError(null)
    setComparing(false)
    return () => {
      alive.current = false
    }
  }, [reportId])

  if (loading && !report) return <Spinner label="보고서를 불러오는 중" />
  if (error || !report) return <ErrorBox message={error ?? '보고서를 불러오지 못했습니다.'} onRetry={reload} />

  const isDong = Boolean(report.scope.dong_code)
  const parentName = report.context.activity_scope?.region_name ?? ''
  const isCause = report.report_type === 'context_cause_analysis'
  const canInvestigate = report.context_investigation_status !== 'not_applicable' && report.assessments.some((item) => item.category !== 'assessment_hold')

  const investigate = async (comparisonIds: string[]) => {
    setInvestigating(true)
    setInvestigationError(null)
    setComparing(false)
    try {
      for (let attempt = 0; ; attempt += 1) {
        try {
          const result = await api.investigate(report.report_id, comparisonIds)
          if (alive.current) onReportCreated?.(result)
          return
        } catch (reason) {
          if (reason instanceof ApiError && reason.status === 409 && reason.code === 'analysis_research_in_progress' && attempt < MAX_CONFLICT_RETRIES) {
            await new Promise((resolve) => setTimeout(resolve, (reason.retryAfter ?? 10) * 1000))
            if (!alive.current) return
            continue
          }
          throw reason
        }
      }
    } catch (reason) {
      if (alive.current) setInvestigationError(errorMessage(reason))
    } finally {
      if (alive.current) setInvestigating(false)
    }
  }

  return (
    <div className={`flex flex-col gap-4 ${mode === 'preview' ? 'pb-6' : ''}`}>
      {mode === 'preview' && onLink && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-card-sm bg-accent-tint px-5 py-4">
          <div className="text-subhead text-label">
            <span className="font-bold text-label">{report.region_name}</span> · {scopeLine(report.scope)}
          </div>
          <Button variant="primary" onClick={() => onLink(report)}>
            <Icon name="link" />
            이 분석에 연결하기
          </Button>
        </div>
      )}

      <div className="pb-2">
        <p className="eyebrow">현황 보고서</p>
        <h3 className="mt-1 text-title-2 text-label">
          {report.region_name} · {monthLabel(report.scope.month)}
        </h3>
        <p className="mt-1 text-subhead text-label-secondary">{scopeGroupLabel(report.scope)}</p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {report.storage_status === 'saved' && <Badge tone="green">현황 보고서 저장됨</Badge>}
        {isCause && <Badge tone="violet">원인 분석 보고서</Badge>}
        <Badge>{INVESTIGATION_STATUS_LABELS[report.context_investigation_status] ?? report.context_investigation_status}</Badge>
        {report.report_status === 'partial' && <Badge tone="amber">일부 집단 자료 없음</Badge>}
      </div>

      <AiSummaryPanel report={report} />

      {isDong && (
        <Notice tone="info">활동 변화는 상위 시군구 {parentName}의 참고 자료입니다. 선택 행정동의 직접 활동 자료가 아닙니다.</Notice>
      )}

      {report.activity_availability && report.activity_availability.status !== 'available' && (
        <Notice tone="warn">
          요청한 {report.activity_availability.requested_group_count}개 집단 중 {report.activity_availability.observed_group_count}개 집단만 활동 자료가 있습니다.
        </Notice>
      )}

      <div className="flex flex-col gap-2">
        {report.assessments.map((assessment) => (
          <AssessmentAccordion key={`${assessment.scope.sex_code}-${assessment.scope.age_code}`} assessment={assessment} />
        ))}
        {!report.assessments.length && <Notice tone="muted">이 조건에는 활동 관측 집단이 없습니다.</Notice>}
      </div>

      {isCause && report.context_investigation && <InvestigationResult investigation={report.context_investigation} />}

      {mode === 'full' && (
        <div className="flex flex-col gap-2 rounded-card-sm bg-elevated px-5 py-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-subhead text-label">
              {report.context_investigation_status === 'not_performed' ? '지역 원인 조사 전' : INVESTIGATION_STATUS_LABELS[report.context_investigation_status]}
            </span>
            <Button size="sm" onClick={() => investigate([])} disabled={investigating || !canInvestigate} title={canInvestigate ? undefined : '활동 관측이 없는 보고서는 원인 조사를 할 수 없습니다.'}>
              {isCause ? '원인 다시 조사' : '원인 조사'}
            </Button>
          </div>
          {!canInvestigate && <p className="text-footnote text-label-secondary">활동 관측이 없는 보고서라 원인 조사를 할 수 없습니다.</p>}
          {investigating && <Thinking label="헤르미가 공개 자료에서 지역 맥락을 찾고 있어요. 최대 3분쯤 걸려요." />}
          {investigationError && <ErrorBox message={investigationError} />}
        </div>
      )}

      <Accordion title="생애주기·지역 맥락" aside={<span className="text-footnote text-label-secondary">가설 · 지원 필요 미확인</span>}>
        <LifecycleSection lifecycle={report.lifecycle_interpretation} />
      </Accordion>
      <Accordion title="지역 배경">
        <RegionBackground report={report} />
      </Accordion>
      <Accordion title="자료·보고서 전문">
        <Markdown text={report.markdown} />
      </Accordion>

      {mode === 'full' && (
        <>
          <p className="text-subhead text-label-secondary">이 보고서만 활용해도 됩니다. 대응안 검토는 선택이며, 나중에 저장된 보고서에서 이어갈 수 있어요.</p>
          {comparing && <ComparisonPicker report={report} onCancel={() => setComparing(false)} onStart={investigate} />}
          <div className="glass sticky bottom-0 -mx-5 flex flex-wrap gap-2 border-t border-separator px-5 py-3 sm:-mx-8 sm:px-8">
            <Button variant="primary" onClick={() => onReview?.(report)}>
              <Icon name="pen" />
              대응안 검토
            </Button>
            <ReportDownload kind="analysis" reportId={report.report_id} filename={analysisFilename(report)} />
            <Button onClick={() => setComparing(true)} disabled={investigating || !canInvestigate}>
              다른 지역과 비교 조사
            </Button>
          </div>
        </>
      )}
    </div>
  )
}

function isCompatible(base: AnalysisReport, other: AnalysisReportSummary): boolean {
  if (other.report_id === base.report_id || other.report_type !== 'observation_analysis') return false
  if (other.scope.month !== base.scope.month || other.scope.sex_code !== base.scope.sex_code || other.scope.age_code !== base.scope.age_code) return false
  const baseDong = base.scope.dong_code ?? null
  const otherDong = other.scope.dong_code ?? null
  if (Boolean(baseDong) !== Boolean(otherDong)) return false
  if (baseDong ? otherDong === baseDong : other.scope.region_code === base.scope.region_code) return false
  return other.summary.assessment_hold < other.summary.total
}

function ComparisonPicker({ report, onCancel, onStart }: { report: AnalysisReport; onCancel: () => void; onStart: (ids: string[]) => void }) {
  const { data, error, loading, reload } = useApi(
    (signal) => api.listAnalysisReports({ limit: 100, month: report.scope.month, age_code: report.scope.age_code ?? undefined }, signal),
    [report.report_id],
  )
  const [picked, setPicked] = useState<string[]>([])
  const candidates = (data?.reports ?? []).filter((item) => isCompatible(report, item))
  const toggle = (id: string) => setPicked((current) => (current.includes(id) ? current.filter((value) => value !== id) : current.length >= 3 ? current : [...current, id]))

  return (
    <div className="rounded-card-sm bg-elevated px-5 py-4 text-subhead">
      <div className="font-semibold text-label">비교할 다른 지역 분석을 골라 주세요 (최대 3개)</div>
      <p className="mt-1 text-footnote text-label-secondary">같은 기준월·성별·연령, 같은 공간 단위로 저장된 다른 지역 분석만 고를 수 있습니다.</p>
      <div className="mt-3 flex flex-col gap-1.5">
        {loading && <Spinner />}
        {error && <ErrorBox message={error} onRetry={reload} />}
        {!loading && !error && !candidates.length && <p className="text-label-secondary">비교할 수 있는 저장 분석이 없습니다. 같은 조건으로 다른 지역을 먼저 분석해 주세요.</p>}
        {candidates.map((item) => (
          <label key={item.report_id} className="flex items-center gap-2 rounded-control bg-fill px-3 py-2.5">
            <input type="checkbox" checked={picked.includes(item.report_id)} onChange={() => toggle(item.report_id)} />
            <span className="font-medium text-label">{item.region_name}</span>
            <span className="text-label-secondary">{scopeLine(item.scope)}</span>
          </label>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <Button variant="primary" size="sm" disabled={!picked.length} onClick={() => onStart(picked)}>
          비교 조사 시작
        </Button>
        <Button size="sm" onClick={onCancel}>
          취소
        </Button>
      </div>
    </div>
  )
}
