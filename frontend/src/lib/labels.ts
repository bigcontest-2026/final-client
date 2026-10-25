import type { AgeCode, Category, PlanKind, ReportScope, ReviewKey, ReviewStatus, SexCode, SourceKey } from '../api/types'

export const SEX_LABELS: Record<SexCode, string> = { MAN: '남성', WMAN: '여성' }

export const AGE_LABELS: Record<AgeCode, string> = {
  '20G': '20대',
  '30G': '30대',
  '40G': '40대',
  '50G': '50대',
  '60GU': '60세 이상',
}

export const AGE_CODES = Object.keys(AGE_LABELS) as AgeCode[]
export const SEX_CODES = Object.keys(SEX_LABELS) as SexCode[]

export const SOURCE_LABELS: Record<SourceKey, string> = { skt: '통신', card_a: '카드' }

export const CATEGORY_LABELS: Record<Category, string> = {
  no_threshold_decline: '기준 이상 감소 미포착',
  single_source_decline: '단일 감소 관찰',
  joint_decline: '동시 감소 관찰',
  priority_review: '우선 검토 후보',
  assessment_hold: '판정 보류',
}

export const CATEGORY_ORDER: Category[] = ['priority_review', 'joint_decline', 'single_source_decline', 'no_threshold_decline', 'assessment_hold']

export const CATEGORY_TONE: Record<Category, 'amber' | 'orange' | 'sky' | 'slate'> = {
  priority_review: 'orange',
  joint_decline: 'amber',
  single_source_decline: 'sky',
  no_threshold_decline: 'slate',
  assessment_hold: 'slate',
}

export const PLAN_KIND_LABELS: Record<PlanKind, string> = {
  existing_program: '기존 사업 활용',
  program_improvement: '사업 보완',
  new_program: '신규 예방사업',
}

export const PLAN_KINDS = Object.keys(PLAN_KIND_LABELS) as PlanKind[]

export const REVIEW_LABELS: Record<ReviewKey, string> = {
  eligibility: '지원 대상·조건',
  support_content: '지원 내용',
  delivery: '전달기관·이용 경로',
  finance_and_cost: '재원·본인부담·이용 비용',
}

export const REVIEW_KEYS = Object.keys(REVIEW_LABELS) as ReviewKey[]

export const REVIEW_STATUS_LABELS: Record<ReviewStatus, string> = {
  unconfirmed: '미확인',
  confirmed: '확인함',
  not_applicable: '해당 없음',
}

export const INVESTIGATION_STATUS_LABELS: Record<string, string> = {
  not_performed: '원인 조사 전',
  not_applicable: '원인 조사 불가',
  completed: '원인 조사 완료',
  no_evidence: '근거 미확인',
}

export function monthLabel(month: string | null | undefined): string {
  if (!month || !/^\d{6}$/.test(month)) return month ?? ''
  return `${month.slice(0, 4)}년 ${Number(month.slice(4))}월`
}

export function sexLabel(sex: SexCode | null | undefined): string {
  return sex ? SEX_LABELS[sex] : '전체 성별'
}

export function ageLabel(age: AgeCode | null | undefined): string {
  return age ? AGE_LABELS[age] : '전체 연령'
}

export function scopeGroupLabel(scope: Pick<ReportScope, 'sex_code' | 'age_code'>): string {
  return `${sexLabel(scope.sex_code)} · ${ageLabel(scope.age_code)}`
}

export function scopeLine(scope: ReportScope): string {
  return `${monthLabel(scope.month)} · ${scopeGroupLabel(scope)}`
}
