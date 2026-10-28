import { useEffect, useRef, useState } from 'react'
import { useReportJob } from '../../lib/jobs/useReportJob'
import { assistRequestContext, canApplyAssistProposal } from '../../lib/jobs/assistProposal'
import { ReportJobStatus } from '../report/ReportJobStatus'
import type { AssistResponse, PlanKind, PlanningKey } from '../../api/types'
import { applicablePlanningFields, mergePlanningSuggestion } from '../../lib/planning'
import { newLocalId, toPlanInput, type DraftPlan } from '../../lib/plans'
import { PLAN_KINDS, PLAN_KIND_LABELS } from '../../lib/labels'
import { Badge, Button, ErrorBox, Select, TextArea, Thinking } from '../ui'

const LABELS = { title: '대응안 이름', target: '대상과 범위', rationale: '분석과 연결한 이유', content: '실행 내용', checks: '실행 전 확인할 사항' }
export function AiProposalPanel({ analysisReportId, active, onDraft, onUpdate }: { analysisReportId: string; active: DraftPlan | null; onDraft: (plan: DraftPlan) => void; onUpdate: (patch: Partial<DraftPlan>) => void }) {
  const [instruction, setInstruction] = useState('')
  const [kind, setKind] = useState<PlanKind>('existing_program')
  const [mode, setMode] = useState<'draft' | 'revise'>('draft')
  const task = useReportJob(analysisReportId, 'assist')
  const loading = task.busy || task.pending
  const delivered = useRef<string | null>(null)
  const [proposal, setProposal] = useState<{ reportId: string; context: string | null; result: AssistResponse } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notes, setNotes] = useState<string[]>([])
  const [suggestion, setSuggestion] = useState<AssistResponse['suggestion']>(null)
  const [chosen, setChosen] = useState<string[]>([])
  const requested = useRef({ kind, mode })
  useEffect(() => {
    const result = task.result
    const job = task.job
    if (!result || !job || job.report_id !== analysisReportId || delivered.current === job.job_id) return
    delivered.current = job.job_id
    if (!['draft', 'revise', 'review'].includes(result.mode) || !PLAN_KINDS.includes(result.kind)) {
      setError('AI 제안을 확인하지 못했습니다. 새 요청을 보내 주세요.')
      return
    }
    requested.current = { kind: result.kind, mode: result.mode === 'revise' ? 'revise' : 'draft' }
    setProposal({ reportId: job.report_id, context: task.context, result })
    setNotes(result.review_notes ?? [])
    setSuggestion(result.suggestion)
    setChosen(result.mode === 'draft' ? [...Object.keys(LABELS), ...applicablePlanningFields(result.kind).filter(field => result.suggestion?.planning_details?.[field.key]).map(field => field.key)] : [])
    if (!result.suggestion) setError('AI가 초안을 돌려주지 않았습니다. 요청을 바꿔 다시 시도해 주세요.')
  }, [task.result, task.job, task.context, analysisReportId])
  const request = () => {
    if (loading) return
    delivered.current = null
    setError(null); setNotes([]); setSuggestion(null); setProposal(null)
    const requestedKind = mode === 'revise' && active ? active.kind : kind
    requested.current = { kind: requestedKind, mode }
    void task.submit({ mode, kind: requestedKind, instruction: instruction.trim(), ...(mode === 'revise' && active ? { current_plan: toPlanInput(active) } : {}) }, assistRequestContext(active, mode, requestedKind))
  }
  const safeToApply = proposal && canApplyAssistProposal(proposal.reportId, analysisReportId, proposal.context, active, proposal.result)
  const toggle = (key: string) => setChosen(current => current.includes(key) ? current.filter(item => item !== key) : [...current, key])
  const apply = () => {
    if (!suggestion || !safeToApply) {
      setError('요청 이후 대응안이 바뀌었거나 원래 요청을 확인할 수 없습니다. 현재 내용으로 새 제안을 받아 주세요.')
      return
    }
    const basicKeys = Object.keys(LABELS) as (keyof typeof LABELS)[]
    const basic = Object.fromEntries(basicKeys.filter(key => chosen.includes(key)).map(key => [key, suggestion[key]]))
    const planning_details = mergePlanningSuggestion(requested.current.mode === 'revise' ? active?.planning_details ?? {} : {}, suggestion.planning_details ?? {}, chosen as PlanningKey[])
    if (requested.current.mode === 'revise') onUpdate({ ...basic, planning_details })
    else onDraft({ localId: newLocalId(), kind: requested.current.kind, title: '', target: '', rationale: '', content: '', checks: '', selected: true, feedback: '', ...basic, planning_details })
    setSuggestion(null); setInstruction('')
  }
  return <section className="rounded-card bg-elevated p-6">
    <div className="flex flex-wrap items-center gap-2"><h3 className="text-headline text-label">헤르미와 초안 검토하기</h3><Badge tone="amber">선택 후 반영</Badge></div>
    <p className="mt-2 text-footnote text-label-secondary">AI 제안을 읽고 반영할 항목을 고르세요. 미확인 사항은 확인 상태로 바뀌지 않습니다.</p>
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      <Select aria-label="AI 작업" value={mode} disabled={loading} onChange={event => { setMode(event.target.value as 'draft' | 'revise'); setSuggestion(null) }}><option value="draft">새 대응안 제안</option><option value="revise" disabled={!active}>선택한 대응안 보완</option></Select>
      {mode === 'draft' && <Select value={kind} disabled={loading} onChange={event => { setKind(event.target.value as PlanKind); setSuggestion(null) }} aria-label="초안 유형">{PLAN_KINDS.map(value => <option key={value} value={value}>{PLAN_KIND_LABELS[value]}</option>)}</Select>}
    </div>
    <TextArea className="mt-3" rows={3} maxLength={2000} value={instruction} placeholder="예: 신청부터 기관 인계까지 확인할 단계와 완료 조건을 제안해 줘" onChange={event => setInstruction(event.target.value)} aria-label="AI 초안 요청 내용" />
    <div className="mt-3 flex justify-end"><Button onClick={request} disabled={loading || !instruction.trim()}>초안 제안받기</Button></div>
    {loading && <Thinking label="헤르미가 근거에 맞는 초안을 쓰고 있어요. 1분 넘게 걸릴 수 있어요." />}
    <ReportJobStatus task={task} />
    {error && <div className="mt-3"><ErrorBox message={error} /></div>}
    {suggestion && <div className="mt-5 flex flex-col gap-3 rounded-card-sm border border-separator p-4">
      <h4 className="text-headline text-label">AI 제안 미리보기</h4>
      {!safeToApply && <p role="status" className="text-footnote text-warning">요청 당시 대응안과 현재 내용이 다르거나 원래 요청을 확인할 수 없어 이 제안은 읽기만 할 수 있습니다. 현재 내용으로 새 제안을 받아 주세요.</p>}
      <p className="text-footnote text-label-secondary">기본 내용은 선택하면 반영됩니다. 이미 작성한 세부 항목은 보존하며, 새 세부 제안은 미확인으로 추가합니다.</p>
      {Object.entries(LABELS).map(([key, label]) => <label key={key} className="flex min-h-11 items-start gap-3 rounded-control bg-fill p-3"><input className="mt-1 size-5 shrink-0" type="checkbox" checked={chosen.includes(key)} onChange={() => toggle(key)} /><span className="min-w-0 text-subhead"><strong className="block text-label">{label}</strong><span className="whitespace-pre-wrap break-words text-label-secondary">{suggestion[key as keyof typeof LABELS]}</span></span></label>)}
      {applicablePlanningFields(requested.current.kind).filter(field => suggestion.planning_details?.[field.key]).map(field => {
        const entry = suggestion.planning_details![field.key]!
        const current = active?.planning_details?.[field.key]
        const protectedEntry = requested.current.mode === 'revise' && current && (current.status !== 'unconfirmed' || current.text || current.evidence || current.owner || current.next_action)
        return <label key={field.key} className="flex min-h-11 items-start gap-3 rounded-control bg-fill p-3"><input className="mt-1 size-5 shrink-0" type="checkbox" disabled={Boolean(protectedEntry)} checked={!protectedEntry && chosen.includes(field.key)} onChange={() => toggle(field.key)} /><span className="min-w-0 text-subhead"><strong className="block text-label">{field.label}{protectedEntry ? ' · 기존 기록 유지' : ''}</strong><span className="whitespace-pre-wrap break-words text-label-secondary">{entry.text || '미확인'}{entry.owner ? `\n담당 역할(안): ${entry.owner}` : ''}{entry.next_action ? `\n다음 조치: ${entry.next_action}` : ''}</span></span></label>
      })}
      <div className="flex flex-wrap justify-end gap-2"><Button onClick={() => setSuggestion(null)}>제안 닫기</Button><Button variant="primary" onClick={apply} disabled={!chosen.length || !safeToApply}>선택 항목 {requested.current.mode === 'draft' ? '새 대응안에 넣기' : '반영하기'}</Button></div>
    </div>}
    {notes.length > 0 && <ul className="mt-3 list-disc space-y-1 pl-5 text-footnote text-label-secondary">{notes.map(note => <li key={note}>{note}</li>)}</ul>}
  </section>
}
