// Development-only deterministic UI fixture. Never calls a real server/provider.
import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { AnalysisDetail } from '../src/components/report/AnalysisDetail'
import { AiProposalPanel } from '../src/components/response/AiProposalPanel'
import type { AnalysisReport, AssistResponse } from '../src/api/types'
import type { ReportJob } from '../src/api/jobs'
import type { DraftPlan } from '../src/lib/plans'
import '../src/index.css'

const report = (id: string, parent?: string) => ({
  schema_version: 'fixture', report_id: id, parent_report_id: parent ?? null,
  report_type: parent ? 'context_cause_analysis' : 'activity_observation',
  created_at: '2026-10-28', storage_status: 'saved', reused: false,
  scope: { region_code: '11110', month: '202512', sex_code: 'MAN', age_code: '20G' },
  region_name: '시험 지역', context: {}, rule_version: 'fixture', threshold_percent: 5,
  assessments: [{ scope: { sex_code: 'MAN', age_code: '20G' }, category: 'no_threshold_decline', category_label: '관측 변화', sources: {}, reasons: [] }],
  context_investigation_status: parent ? 'completed' : 'not_performed',
  summary: {}, markdown: '가상 자료로 확인하는 UI입니다.',
}) as unknown as AnalysisReport
const base = report('fixture-root')
const initialPlan = { localId: 'fixture-plan', kind: 'existing_program', title: '사용자 원본', target: '시험 대상', rationale: '', content: '사용자가 작성한 내용', checks: '', selected: true, feedback: '' } as DraftPlan
const jobsKey = 'hermes:test:durable-jobs'
let jobs: (ReportJob & { payload?: Record<string, unknown>; polls?: number; fail?: boolean })[] = JSON.parse(localStorage.getItem(jobsKey) ?? '[]')
let failNext = false
const save = () => localStorage.setItem(jobsKey, JSON.stringify(jobs))
const realFetch = window.fetch.bind(window)
window.fetch = async (input, init) => {
  const url = String(input)
  if (!url.startsWith('/api/model/analysis-reports/')) return realFetch(input, init)
  const parts = url.split('/')
  const reportId = decodeURIComponent(parts[4])
  const answer = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status })
  if (parts.length === 5) return answer(report(reportId, reportId === base.report_id ? undefined : base.report_id))
  const action = parts[7]
  if (parts[5] !== 'jobs') throw new Error('Fixture received unexpected synchronous API call')
  if (parts.length === 6 && init?.method !== 'POST') return answer({ jobs: jobs.filter(job => job.report_id === reportId).slice().reverse() })
  if (parts.length === 6) {
    const body = JSON.parse(String(init?.body))
    const existing = jobs.find(job => job.report_id === reportId && job.kind === body.kind && ['queued', 'running', 'succeeded'].includes(job.status) && JSON.stringify(job.payload) === JSON.stringify(body.payload))
    if (existing) return answer(existing, 202)
    const job = { schema_version: 'report-job-1', job_id: `fixture-${Date.now()}`, report_id: reportId, kind: body.kind, status: 'queued', attempts: 1, created_at: 'fixture', updated_at: 'fixture', result: null, error: null, payload: body.payload, polls: 0, fail: failNext } as (typeof jobs)[number]
    failNext = false; jobs.push(job); save(); return answer(job, 202)
  }
  const job = jobs.find(job => job.job_id === parts[6] && job.report_id === reportId)
  if (!job) return answer({ detail: 'missing job' }, 404)
  if (action === 'cancel' && ['queued', 'running'].includes(job.status)) job.status = 'cancelled'
  else if (action === 'retry' && ['failed', 'cancelled'].includes(job.status)) { job.status = 'queued'; job.attempts++; job.polls = 0; job.fail = false; job.error = null }
  else if (!action && ['queued', 'running'].includes(job.status)) {
    job.polls = (job.polls ?? 0) + 1
    job.status = job.polls < 3 ? 'running' : job.fail ? 'failed' : 'succeeded'
    if (job.status === 'failed') job.error = { code: 'fixture_failure', message: 'deterministic failure' }
    if (job.status === 'succeeded') {
      if (job.kind === 'summary') job.result = { report_id: reportId, text: '활동 변화 → 가능한 배경 → 살펴볼 대응: 가상 요약', created_at: 'fixture', reused: false }
      if (job.kind === 'investigate') job.result = report(`child-${job.job_id}`, base.report_id)
      if (job.kind === 'assist') job.result = { mode: job.payload?.mode, kind: job.payload?.kind, suggestion: { title: 'AI 제안 이름', target: 'AI 대상 제안', rationale: '근거를 확인하세요', content: 'AI 내용 제안', checks: '실행 전 확인' }, review_notes: ['가상 자료에서 만든 제안입니다.'], status: 'completed', limitations: [] } as AssistResponse
    }
  }
  save(); return answer(job, action === 'retry' ? 202 : 200)
}
function Fixture() {
  const [reportId, setReportId] = useState(base.report_id)
  const [active, setActive] = useState<DraftPlan>(() => JSON.parse(localStorage.getItem('hermes:test:draft') ?? 'null') ?? initialPlan)
  const [visible, setVisible] = useState(true)
  const update = (patch: Partial<DraftPlan>) => setActive(current => { const next = { ...current, ...patch }; localStorage.setItem('hermes:test:draft', JSON.stringify(next)); return next })
  return <main className="mx-auto max-w-4xl space-y-6 bg-canvas p-6 text-label">
    <h1 className="text-title-2">가상 Job API 수명주기 확인</h1>
    <p>실제 서버·모델 호출 없음. 2초 간격으로 세 번 조회하면 완료됩니다. 현재 보고서: {reportId}</p>
    <div className="flex flex-wrap gap-4"><button onClick={() => setVisible(value => !value)}>{visible ? '화면 닫기' : '화면 열기'}</button><button onClick={() => { failNext = true }}>다음 작업 실패시키기</button><button onClick={() => { Object.keys(localStorage).filter(key => key.startsWith('hermes:test:') || key.startsWith('hermes:report-job:v1:fixture-') || key.startsWith('hermes:report-job:v1:child-fixture-')).forEach(key => localStorage.removeItem(key)); location.reload() }}>가상 자료 초기화</button></div>
    <label className="block">현재 대응안 이름<input className="ml-4 rounded-control border p-2" value={active.title} onChange={event => update({ title: event.target.value })} /></label>
    <p>현재 대응안 내용: {active.content}</p>
    {visible && <><AnalysisDetail reportId={reportId} mode="full" onReportCreated={result => setReportId(result.report_id)} /><AiProposalPanel analysisReportId={reportId} active={active} onUpdate={update} onDraft={setActive} /></>}
  </main>
}
createRoot(document.getElementById('root')!).render(<Fixture />)
