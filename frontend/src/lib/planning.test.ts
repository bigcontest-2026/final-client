import { describe, expect, it } from 'vitest'
import { applicablePlanningFields, emptyPlanningEntry, mergePlanningSuggestion } from './planning'
import { fromServerPlan, isDirty, toPlanInput, validatePlans } from './plans'
import type { Plan } from '../api/types'

const plan = { plan_id: 'plan_1', version: 1, kind: 'existing_program', title: '연계 검토', target: '지역 집단', content: '기관 확인', rationale: '', checks: '', selected: true, feedback: '', created_at: '', updated_at: '', changed_fields: [] } as Plan

describe('planning details', () => {
  it('offers service review for A and alternatives for B', () => {
    expect(applicablePlanningFields('existing_program').map(x => x.key)).toContain('availability')
    expect(applicablePlanningFields('existing_program').map(x => x.key)).not.toContain('alternatives')
    expect(applicablePlanningFields('new_program').map(x => x.key)).toContain('alternatives')
  })
  it('preserves new fields through server, draft and input round trips', () => {
    const saved = { ...plan, planning_details: { execution: { ...emptyPlanningEntry(), text: '공식 기관 확인', owner: '담당 부서', next_action: '회신 확인' } } }
    const draft = fromServerPlan(saved)
    expect(toPlanInput(draft).planning_details).toEqual(saved.planning_details)
    expect(isDirty([draft], [saved])).toBe(false)
    expect(isDirty([{ ...draft, planning_details: { execution: { ...saved.planning_details.execution, owner: '다른 역할' } } }], [saved])).toBe(true)
  })
  it('requires evidence for confirmation and a reason for non-applicability', () => {
    expect(validatePlans([{ ...fromServerPlan(plan), planning_details: { budget: { ...emptyPlanningEntry(), status: 'confirmed', text: '예산 확인' } } }])[0].message).toContain('근거')
    expect(validatePlans([{ ...fromServerPlan(plan), planning_details: { budget: { ...emptyPlanningEntry(), status: 'not_applicable' } } }])[0].message).toContain('이유')
    expect(validatePlans([fromServerPlan(plan)])).toEqual([])
  })
  it('AI additions never overwrite an existing entry or confirm new facts', () => {
    const confirmed = { ...emptyPlanningEntry(), status: 'confirmed' as const, text: '기관 회신', evidence: '공식 문서' }
    const result = mergePlanningSuggestion({ execution: confirmed }, { execution: { ...emptyPlanningEntry(), text: '덮어쓰기' }, budget: { ...confirmed, text: '예산 확인 필요' } }, ['execution', 'budget'])
    expect(result.execution).toEqual(confirmed)
    expect(result.budget?.status).toBe('unconfirmed')
  })
})
