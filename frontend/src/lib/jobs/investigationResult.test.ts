import { describe, expect, it } from 'vitest'
import type { AnalysisReport } from '../../api/types'
import { matchesInvestigationResult } from './investigationResult'
const report = (id: string, parent?: string) => ({ report_id: id, parent_report_id: parent }) as AnalysisReport
describe('investigation report attachment', () => {
  it('accepts root attachment when investigating an already investigated child', () => {
    expect(matchesInvestigationResult(report('child-one', 'root'), 'child-one', report('child-two', 'root'))).toBe(true)
    expect(matchesInvestigationResult(report('root'), 'root', report('child', 'root'))).toBe(true)
  })
  it('rejects old view snapshots and results attached to a different root', () => {
    expect(matchesInvestigationResult(report('old'), 'current', report('child', 'old'))).toBe(false)
    expect(matchesInvestigationResult(report('child-one', 'root'), 'child-one', report('child-two', 'other'))).toBe(false)
  })
})
