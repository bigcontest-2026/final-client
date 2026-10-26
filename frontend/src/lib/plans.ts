import type { Plan, PlanInput, ReviewEntry, ReviewKey, ProgramReference } from '../api/types'
import { REVIEW_KEYS, REVIEW_LABELS } from './labels'
import { cleanPlanningDetails, PLANNING_FIELDS } from './planning'

export interface DraftPlan extends PlanInput {
  localId: string
  version?: number
}

export const EMPTY_REVIEW: ReviewEntry = { status: 'unconfirmed', text: '', evidence: '' }

export function emptyPolicyReview(): Record<ReviewKey, ReviewEntry> {
  return Object.fromEntries(REVIEW_KEYS.map((key) => [key, { ...EMPTY_REVIEW }])) as Record<ReviewKey, ReviewEntry>
}

function cleanReference(reference: ProgramReference | null | undefined): ProgramReference | null {
  if (!reference) return null
  return {
    program_version_id: reference.program_version_id,
    title: reference.title,
    url: reference.url ?? null,
    publisher: reference.publisher ?? null,
  }
}

export function toPlanInput(plan: PlanInput): PlanInput {
  const input: PlanInput = {
    kind: plan.kind,
    title: plan.title,
    target: plan.target ?? '',
    rationale: plan.rationale ?? '',
    content: plan.content ?? '',
    checks: plan.checks ?? '',
    selected: Boolean(plan.selected),
    feedback: plan.feedback ?? '',
    program_reference: cleanReference(plan.program_reference),
    policy_review: Object.fromEntries(
      REVIEW_KEYS.filter((key) => plan.policy_review?.[key]).map((key) => {
        const value = plan.policy_review![key]!
        return [key, { status: value.status, text: value.text ?? '', evidence: value.evidence ?? '' }]
      }),
    ),
    support_needs: (plan.support_needs ?? []).map((need) => ({
      category_code: need.category_code,
      status: need.status,
      text: need.text ?? '',
      evidence: need.evidence ?? '',
    })),
  }
  if (plan.plan_id) input.plan_id = plan.plan_id
  if (plan.planning_details !== undefined) input.planning_details = cleanPlanningDetails(plan.planning_details)
  return input
}

let localCounter = 0

export function newLocalId(): string {
  localCounter += 1
  return `local_${Date.now().toString(36)}_${localCounter}`
}

export function fromServerPlan(plan: Plan): DraftPlan {
  return {
    ...toPlanInput(plan),
    policy_review: { ...emptyPolicyReview(), ...toPlanInput(plan).policy_review },
    localId: plan.plan_id,
    version: plan.version,
  }
}

export function comparable(plan: PlanInput): string {
  return JSON.stringify(toPlanInput(plan))
}

export function isDirty(draft: DraftPlan[], server: Plan[]): boolean {
  if (draft.length !== server.length) return true
  return draft.some((plan, index) => comparable(plan) !== comparable(fromServerPlan(server[index])))
}

export interface PlanProblem {
  localId: string
  message: string
}

export function validatePlans(plans: DraftPlan[]): PlanProblem[] {
  const problems: PlanProblem[] = []
  for (const plan of plans) {
    if (!plan.title.trim()) problems.push({ localId: plan.localId, message: '대응안 이름을 입력해 주세요.' })
    if (plan.selected && !plan.target.trim()) problems.push({ localId: plan.localId, message: '보고서에 넣을 대응안은 대상과 범위를 입력해야 합니다.' })
    if (plan.selected && !plan.content.trim()) problems.push({ localId: plan.localId, message: '보고서에 넣을 대응안은 실행 내용을 입력해야 합니다.' })
    for (const key of REVIEW_KEYS) {
      const review = plan.policy_review?.[key]
      if (review?.status === 'confirmed' && (!review.text.trim() || !review.evidence.trim())) {
        problems.push({ localId: plan.localId, message: `"확인함"으로 바꾼 ${REVIEW_LABELS[key]} 항목에는 확인 내용과 근거를 모두 적어야 합니다.` })
      }
    }
    for (const { key, label } of PLANNING_FIELDS) {
      const entry = plan.planning_details?.[key]
      if (entry?.status === 'confirmed' && (!entry.text.trim() || !entry.evidence.trim())) {
        problems.push({ localId: plan.localId, message: `${label}: 확인 내용과 근거를 모두 적어 주세요.` })
      }
      if (entry?.status === 'not_applicable' && !entry.text.trim()) {
        problems.push({ localId: plan.localId, message: `${label}: 해당 없음의 이유를 적어 주세요.` })
      }
    }
  }
  return problems
}
