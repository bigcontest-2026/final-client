import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { ApiError, errorMessage } from '../../api/client'
import { api } from '../../api/endpoints'
import type { PlanKind, ResponseReport, WelfareProgram, Workspace } from '../../api/types'
import { ReportDownload } from '../report/ReportDownload'
import { PLAN_KIND_LABELS, REVIEW_KEYS, scopeLine } from '../../lib/labels'
import { emptyPolicyReview, fromServerPlan, isDirty, newLocalId, toPlanInput, validatePlans, type DraftPlan } from '../../lib/plans'
import { readJson, removeKey, writeJson } from '../../lib/storage'
import { useApi } from '../../lib/useApi'
import { Icon } from '../icons'
import { Button, ErrorBox, Modal, ModalHeader, Notice, Spinner, Tabs } from '../ui'
import { FinalReportView } from './FinalReportView'
import { PlanForm } from './PlanForm'
import { AiProposalPanel } from './AiProposalPanel'

interface StoredDraft {
  baseVersion: number
  plans: DraftPlan[]
}

type Banner = { tone: 'success' | 'info' | 'warn'; text: string }

const draftKey = (workspaceId: string) => `hermes:workspace-draft:v1:${workspaceId}`

function safeUrl(value: string | null | undefined): string | null {
  if (!value) return null
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null
  } catch {
    return null
  }
}

function blankPlan(kind: PlanKind = 'existing_program'): DraftPlan {
  return {
    localId: newLocalId(),
    kind,
    title: '',
    target: '',
    rationale: '',
    content: '',
    checks: '',
    selected: true,
    feedback: '',
    program_reference: null,
    policy_review: emptyPolicyReview(),
    support_needs: [],
  }
}

function planFromProgram(program: WelfareProgram): DraftPlan {
  return {
    ...blankPlan('existing_program'),
    title: `${program.title} 활용 검토`.slice(0, 200),
    target: (program.target_text ?? '').slice(0, 2000),
    program_reference: {
      program_version_id: program.version_id,
      title: program.title,
      url: safeUrl(program.source_url),
      publisher: program.institution ?? null,
    },
  }
}

function unconfirmedCount(plan: DraftPlan): number {
  return REVIEW_KEYS.filter((key) => (plan.policy_review?.[key]?.status ?? 'unconfirmed') === 'unconfirmed').length
}

export function ResponseEditorModal({
  analysisReportId,
  program,
  onProgramAdded,
  onClose,
  onBackToAnalysis,
}: {
  analysisReportId: string
  program?: WelfareProgram
  onProgramAdded?: () => void
  onClose: () => void
  onBackToAnalysis: (reportId: string) => void
}) {
  const titleId = useId()
  const reportQuery = useApi((signal) => api.getAnalysisReport(analysisReportId, signal), [analysisReportId])
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [draft, setDraft] = useState<DraftPlan[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [tab, setTab] = useState<'edit' | 'final'>('edit')
  const [banner, setBanner] = useState<Banner | null>(null)
  const [busy, setBusy] = useState<'save' | 'report' | null>(null)
  const [actionError, setActionError] = useState<{ message: string; conflict?: boolean } | null>(null)
  const [finalReport, setFinalReport] = useState<ResponseReport | null>(null)
  const programHandled = useRef(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 })
  }, [tab, activeId])

  const applyServer = useCallback((next: Workspace, options: { restoreDraft: boolean; keepIndex?: number }) => {
    const serverPlans = next.plans.map(fromServerPlan)
    let plans = serverPlans
    let notice: Banner | null = null
    if (options.restoreDraft) {
      const stored = readJson<StoredDraft | null>(draftKey(next.workspace_analysis_report_id), null)
      if (stored && stored.baseVersion === next.version && Array.isArray(stored.plans)) {
        plans = stored.plans
        notice = { tone: 'info', text: '이 기기에 임시 저장해 둔 변경 내용을 불러왔습니다. 저장해야 서버에 반영됩니다.' }
      } else if (stored) {
        removeKey(draftKey(next.workspace_analysis_report_id))
        notice = { tone: 'warn', text: '그사이 서버 저장본이 바뀌어, 이 기기의 임시 저장본 대신 서버 저장본을 불러왔습니다.' }
      }
    }
    setWorkspace(next)
    setDraft(plans)
    setActiveId(plans[options.keepIndex ?? 0]?.localId ?? plans[0]?.localId ?? null)
    return notice
  }, [])

  const programRef = useRef({ program, onProgramAdded })
  programRef.current = { program, onProgramAdded }

  const requestSeq = useRef(0)

  const loadWorkspace = useCallback(
    (restoreDraft: boolean) => {
      setLoadError(null)
      const seq = ++requestSeq.current
      return api
        .getWorkspace(analysisReportId)
        .then((next) => {
          if (seq !== requestSeq.current) return
          const notice = applyServer(next, { restoreDraft })
          const pending = programRef.current.program
          if (pending && !programHandled.current) {
            programHandled.current = true
            const added = planFromProgram(pending)
            setDraft((current) => [...current, added])
            setActiveId(added.localId)
            setBanner({ tone: 'success', text: '대응안 편집 화면에 사업을 담았습니다. 검토 후 저장해 주세요.' })
            programRef.current.onProgramAdded?.()
          } else if (notice) {
            setBanner(notice)
          }
        })
        .catch((reason) => {
          if (seq === requestSeq.current) setLoadError(errorMessage(reason))
        })
    },
    [analysisReportId, applyServer],
  )

  useEffect(() => {
    void loadWorkspace(true)
  }, [loadWorkspace])

  const dirty = workspace ? isDirty(draft, workspace.plans) : false

  useEffect(() => {
    if (!workspace) return
    const key = draftKey(workspace.workspace_analysis_report_id)
    if (dirty) writeJson(key, { baseVersion: workspace.version, plans: draft } satisfies StoredDraft)
    else removeKey(key)
  }, [draft, dirty, workspace])

  const active = draft.find((plan) => plan.localId === activeId) ?? null
  const savedSelected = useMemo(() => workspace?.plans.filter((plan) => plan.selected) ?? [], [workspace])

  const updatePlan = (localId: string, patch: Partial<DraftPlan>) => {
    setDraft((current) => current.map((plan) => (plan.localId === localId ? { ...plan, ...patch } : plan)))
    setBanner(null)
  }

  const addPlan = (plan: DraftPlan) => {
    setDraft((current) => [...current, plan])
    setActiveId(plan.localId)
  }

  const removePlan = (localId: string) => {
    const next = draft.filter((plan) => plan.localId !== localId)
    setDraft(next)
    setActiveId(next.at(-1)?.localId ?? null)
  }

  const save = async () => {
    if (!workspace) return
    setActionError(null)
    const problems = validatePlans(draft)
    if (problems.length) {
      setActionError({ message: problems[0].message })
      setActiveId(problems[0].localId)
      return
    }
    setBusy('save')
    try {
      const index = draft.findIndex((plan) => plan.localId === activeId)
      const saved = await api.saveWorkspace(analysisReportId, workspace.version, draft.map(toPlanInput))
      removeKey(draftKey(saved.workspace_analysis_report_id))
      applyServer(saved, { restoreDraft: false, keepIndex: Math.max(index, 0) })
      setBanner({ tone: 'success', text: '변경 내용과 선택을 서버에 저장했습니다.' })
    } catch (reason) {
      setActionError({ message: errorMessage(reason), conflict: reason instanceof ApiError && reason.status === 409 })
    } finally {
      setBusy(null)
    }
  }

  const discardAndReload = () => {
    if (workspace) removeKey(draftKey(workspace.workspace_analysis_report_id))
    setActionError(null)
    setBanner(null)
    void loadWorkspace(false)
  }

  const makeReport = async () => {
    if (!workspace) return
    setActionError(null)
    setBusy('report')
    try {
      const report = await api.createResponseReport(analysisReportId, {
        expected_workspace_version: workspace.version,
        selected_plan_versions: savedSelected.map((plan) => ({ plan_id: plan.plan_id, version: plan.version })),
      })
      setFinalReport(report)
      setTab('final')
      setBanner({ tone: 'success', text: '선택한 대응안으로 보고서를 만들고 서버에 저장했습니다.' })
      api.getWorkspace(analysisReportId).then((next) => setWorkspace(next)).catch(() => undefined)
    } catch (reason) {
      setActionError({ message: errorMessage(reason), conflict: reason instanceof ApiError && reason.status === 409 })
    } finally {
      setBusy(null)
    }
  }

  const report = reportQuery.data
  const header = report ? `${report.region_name} ${scopeLine(report.scope)}` : ''
  const saveState = !workspace ? null : dirty ? (
    <span className="flex items-center gap-1.5 text-footnote text-label-secondary">
      <span className="size-2 rounded-full bg-dot-orange" aria-hidden="true" />
      이 기기에 임시 저장됨
    </span>
  ) : workspace.version > 0 ? (
    <span className="flex items-center gap-1.5 text-footnote text-label-secondary">
      <span className="size-2 rounded-full bg-dot-green" aria-hidden="true" />
      서버에 저장됨
    </span>
  ) : (
    <span className="text-footnote text-label-secondary">아직 저장한 대응안 없음</span>
  )

  return (
    <Modal onClose={onClose} labelledBy={titleId} size="xl">
      <ModalHeader titleId={titleId} eyebrow={header} title="지역 맞춤 예방 대응안" onClose={onClose}>
        <Tabs
          value={tab}
          onChange={setTab}
          items={[
            { value: 'edit', label: '대응안 편집·선택' },
            { value: 'final', label: '최종 보고서' },
          ]}
        />
        {saveState}
      </ModalHeader>
      {banner && (
        <div className={`border-b border-separator px-6 py-3 text-subhead text-label sm:px-8 ${banner.tone === 'success' ? 'bg-success-tint' : banner.tone === 'warn' ? 'bg-warning-tint' : 'bg-accent-tint'}`}>
          {banner.text}
        </div>
      )}

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
        {loadError ? (
          <div className="p-8">
            <ErrorBox message={loadError} onRetry={() => void loadWorkspace(true)} />
          </div>
        ) : !workspace ? (
          <div className="p-8">
            <Spinner label="대응안을 불러오는 중" />
          </div>
        ) : tab === 'edit' ? (
          <div className="grid min-h-full grid-cols-1 lg:grid-cols-[280px_1fr]">
            <aside className="border-b border-separator p-4 lg:border-r lg:border-b-0">
              <div className="lg:sticky lg:top-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-headline text-label">대응안 {draft.length}개</span>
                  <Button size="sm" variant="ghost" onClick={() => addPlan(blankPlan())} disabled={draft.length >= 20}>
                    <Icon name="plus" />
                    추가
                  </Button>
                </div>
                <ol className="flex flex-col gap-1.5">
                  {draft.map((plan, index) => {
                    const current = plan.localId === activeId
                    return (
                      <li key={plan.localId}>
                        <div className={`rounded-control px-3 py-2.5 transition-quick ${current ? 'bg-accent-tint' : 'hover:bg-fill'}`}>
                          <button type="button" className="flex w-full gap-2.5 text-left" onClick={() => setActiveId(plan.localId)}>
                            <span className="pt-0.5 text-subhead font-medium text-label-secondary tabular-nums">{String(index + 1).padStart(2, '0')}</span>
                            <span className="min-w-0">
                              <span className="block text-footnote text-label-secondary">{PLAN_KIND_LABELS[plan.kind]}</span>
                              <span className="mt-0.5 line-clamp-2 block text-subhead font-semibold text-label">{plan.title || '이름 없는 대응안'}</span>
                              <span className="mt-1 flex flex-wrap gap-1.5 text-caption text-label-secondary">
                                <span>{plan.version ? `저장본 ${plan.version}차` : '저장 전'}</span>
                                <span>· 미확인 {unconfirmedCount(plan)}</span>
                              </span>
                            </span>
                          </button>
                          <label className="mt-2 ml-7 flex items-center gap-1.5 text-footnote text-label">
                            <input type="checkbox" checked={plan.selected} onChange={(event) => updatePlan(plan.localId, { selected: event.target.checked })} />
                            보고서에 넣기
                          </label>
                        </div>
                      </li>
                    )
                  })}
                </ol>
                {draft.some((plan) => plan.version) && <p className="mt-3 text-footnote text-label-secondary">서버에 저장한 대응안은 지울 수 없습니다. 보고서에서 빼려면 선택을 해제하세요.</p>}
              </div>
            </aside>
            <div className="bg-canvas">
              <div className="mx-auto flex w-full max-w-[940px] flex-col gap-6 px-5 py-8 sm:px-8">
                <AiProposalPanel key={active?.localId ?? "empty"} active={active} onUpdate={patch => active && updatePlan(active.localId, patch)} analysisReportId={analysisReportId} onDraft={(plan) => { addPlan(plan); setBanner({ tone: 'info', text: 'AI 초안을 새 대응안으로 넣었습니다. 검토하고 다듬은 뒤 저장해 주세요.' }) }} />
                {active ? (
                  <PlanForm plan={active} onChange={(patch) => updatePlan(active.localId, patch)} onRemove={active.plan_id ? undefined : () => removePlan(active.localId)} />
                ) : (
                  <Notice tone="muted">
                    아직 대응안이 없습니다. AI 초안을 받거나 왼쪽의 "+ 추가"로 직접 작성해 주세요.
                    <div className="mt-3">
                      <Button size="sm" variant="primary" onClick={() => addPlan(blankPlan())}>
                        빈 대응안 추가
                      </Button>
                    </div>
                  </Notice>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-canvas px-5 py-8 sm:px-8">
            {finalReport ? <FinalReportView report={finalReport} /> : <LatestReport workspace={workspace} onLoaded={setFinalReport} />}
          </div>
        )}
      </div>

      {actionError && (
        <div className="border-t border-separator bg-danger-tint px-6 py-2.5 text-subhead text-danger sm:px-8" role="alert">
          {actionError.message}
          {actionError.conflict && (
            <button type="button" className="ml-3 font-semibold underline" onClick={discardAndReload}>
              서버 저장본 다시 불러오기(이 기기의 변경 버림)
            </button>
          )}
        </div>
      )}
      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-separator px-6 py-4 sm:px-8">
        <p className="text-subhead text-label-secondary">
          {tab === 'final'
            ? '이 보고서는 저장된 선택과 수정 내용을 담은 검토안입니다.'
            : dirty
              ? '수정한 내용과 선택을 먼저 저장해 주세요.'
              : savedSelected.length
                ? `${savedSelected.length}개 대응안의 저장된 내용으로 보고서를 만들 수 있습니다.`
                : '보고서에 넣을 대응안을 하나 이상 골라 저장해 주세요.'}
        </p>
        <div className="flex gap-2">
          <Button onClick={() => onBackToAnalysis(analysisReportId)}>분석으로 돌아가기</Button>
          {tab === 'final' ? (
            <ReportDownload reportId={finalReport?.report_id} filename={finalReport?.filename} disabled={!finalReport} />
          ) : dirty ? (
            <Button variant="primary" onClick={save} disabled={busy !== null}>
              {busy === 'save' ? '저장하는 중…' : '변경 내용 저장'}
            </Button>
          ) : (
            <Button variant="primary" onClick={makeReport} disabled={busy !== null || !savedSelected.length}>
              {busy === 'report' ? '보고서 만드는 중…' : '선택한 대응안으로 보고서 만들기'}
            </Button>
          )}
        </div>
      </footer>
    </Modal>
  )
}

function LatestReport({ workspace, onLoaded }: { workspace: Workspace; onLoaded: (report: ResponseReport) => void }) {
  const latest = [...workspace.reports].sort((a, b) => b.created_at.localeCompare(a.created_at))[0]
  const { data, error, loading, reload } = useApi(latest ? (signal) => api.getResponseReport(latest.report_id, signal) : null, [latest?.report_id])

  useEffect(() => {
    if (data) onLoaded(data)
  }, [data, onLoaded])

  if (!latest) {
    return (
      <Notice tone="muted" className="mx-auto max-w-[860px]">
        아직 만든 보고서가 없습니다. 대응안을 저장하고 보고서에 넣을 것을 고른 뒤 "선택한 대응안으로 보고서 만들기"를 눌러 주세요.
      </Notice>
    )
  }
  if (loading) return <Spinner label="최근 보고서를 불러오는 중" />
  if (error) return <ErrorBox message={error} onRetry={reload} />
  return null
}

