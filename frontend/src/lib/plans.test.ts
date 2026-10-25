import { describe, expect, it } from 'vitest'
import type { Plan } from '../api/types'
import { emptyPolicyReview, fromServerPlan, isDirty, toPlanInput, validatePlans, type DraftPlan } from './plans'

const serverPlan: Plan = {
  plan_id: 'plan_1',
  version: 2,
  kind: 'existing_program',
  title: '청년 마음건강 연계',
  target: '강남구 20대 남성',
  rationale: 'r',
  content: 'c',
  checks: 'k',
  selected: true,
  feedback: '',
  program_reference: {
    program_version_id: 'pv-1',
    title: '청년사업',
    url: 'https://www.bokjiro.go.kr/x',
    publisher: '보건복지부',
    origin: 'user_selected_welfare_catalog',
    verification_status: 'user_selected_unverified',
  } as unknown as Plan['program_reference'],
  policy_review: {
    eligibility: { status: 'confirmed', text: '대상 확인', evidence: '원문 3쪽', origin: 'user_entered' },
    support_content: { status: 'unconfirmed', text: '', evidence: '', origin: 'user_entered' },
    delivery: { status: 'unconfirmed', text: '', evidence: '', origin: 'user_entered' },
    finance_and_cost: { status: 'unconfirmed', text: '', evidence: '', origin: 'user_entered' },
  } as unknown as Plan['policy_review'],
  support_needs: [{ category_code: 'mental_health', status: 'unconfirmed', text: '', evidence: '', origin: 'user_entered' }] as unknown as Plan['support_needs'],
  created_at: '2026-10-25T20:47:00+00:00',
  updated_at: '2026-10-25T20:47:00+00:00',
  changed_fields: ['feedback'],
  history: [],
}

describe('toPlanInput', () => {
  it('drops every server-added field so the PUT is accepted', () => {
    const input = toPlanInput(serverPlan) as unknown as Record<string, unknown>
    expect(input).not.toHaveProperty('version')
    expect(input).not.toHaveProperty('created_at')
    expect(input).not.toHaveProperty('changed_fields')
    expect(input).not.toHaveProperty('history')
    expect(input.program_reference).toEqual({ program_version_id: 'pv-1', title: '청년사업', url: 'https://www.bokjiro.go.kr/x', publisher: '보건복지부' })
    expect((input.policy_review as Record<string, unknown>).eligibility).toEqual({ status: 'confirmed', text: '대상 확인', evidence: '원문 3쪽' })
    expect((input.support_needs as unknown[])[0]).toEqual({ category_code: 'mental_health', status: 'unconfirmed', text: '', evidence: '' })
    expect(input.plan_id).toBe('plan_1')
  })

  it('leaves plan_id out for a new plan', () => {
    const input = toPlanInput({ ...serverPlan, plan_id: undefined }) as unknown as Record<string, unknown>
    expect(input).not.toHaveProperty('plan_id')
  })
})

describe('isDirty', () => {
  it('is clean right after loading from the server', () => {
    expect(isDirty([fromServerPlan(serverPlan)], [serverPlan])).toBe(false)
  })

  it('notices an edited field', () => {
    const draft = { ...fromServerPlan(serverPlan), title: '바뀐 이름' }
    expect(isDirty([draft], [serverPlan])).toBe(true)
  })

  it('notices an added plan', () => {
    expect(isDirty([fromServerPlan(serverPlan), fromServerPlan({ ...serverPlan, plan_id: 'plan_2' })], [serverPlan])).toBe(true)
  })
})

describe('validatePlans', () => {
  const base: DraftPlan = {
    localId: 'a',
    kind: 'new_program',
    title: '새 대응안',
    target: '대상',
    rationale: '',
    content: '내용',
    checks: '',
    selected: true,
    feedback: '',
    policy_review: emptyPolicyReview(),
    support_needs: [],
  }

  it('accepts a complete plan', () => {
    expect(validatePlans([base])).toEqual([])
  })

  it('requires a title', () => {
    expect(validatePlans([{ ...base, title: ' ' }])[0].message).toContain('이름')
  })

  it('requires target and content only for selected plans', () => {
    expect(validatePlans([{ ...base, target: '', content: '' }])).toHaveLength(2)
    expect(validatePlans([{ ...base, target: '', content: '', selected: false }])).toEqual([])
  })

  it('requires text and evidence for a confirmed review', () => {
    const plan = { ...base, policy_review: { ...emptyPolicyReview(), delivery: { status: 'confirmed' as const, text: '확인', evidence: '' } } }
    expect(validatePlans([plan])[0].message).toContain('전달기관·이용 경로')
  })
})
