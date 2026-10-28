import { describe, expect, it } from 'vitest'
import type { AssistResponse } from '../../api/types'
import type { DraftPlan } from '../plans'
import { assistRequestContext, canApplyAssistProposal } from './assistProposal'

const draft = { localId: 'p1', kind: 'existing_program', title: 'original', target: '', rationale: '', content: '', checks: '', selected: true, feedback: '' } as DraftPlan
const result = { mode: 'revise', kind: 'existing_program', suggestion: { title: 'suggested' } } as AssistResponse
describe('assist proposal application', () => {
  it('permits an explicit application only to the exact submitted report and draft', () => {
    const context = assistRequestContext(draft, result.mode, result.kind)
    expect(canApplyAssistProposal('r1', 'r1', context, draft, result)).toBe(true)
    expect(canApplyAssistProposal('r1', 'other', context, draft, result)).toBe(false)
    expect(canApplyAssistProposal('r1', 'r1', context, { ...draft, title: 'user edit' }, result)).toBe(false)
    expect(canApplyAssistProposal('r1', 'r1', context, { ...draft, localId: 'other' }, result)).toBe(false)
    expect(canApplyAssistProposal('r1', 'r1', context, draft, { ...result, kind: 'new_program' })).toBe(false)
  })
  it('keeps an unknown restored request read-only and preserves fingerprint across reload', () => {
    expect(canApplyAssistProposal('r1', 'r1', null, draft, result)).toBe(false)
    expect(canApplyAssistProposal('r1', 'r1', 'malformed', draft, result)).toBe(false)
    const restored = JSON.parse(JSON.stringify({ context: assistRequestContext(draft, result.mode, result.kind) }))
    expect(canApplyAssistProposal('r1', 'r1', restored.context, { ...draft }, result)).toBe(true)
  })
})
