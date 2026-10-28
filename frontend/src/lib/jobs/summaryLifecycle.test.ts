import { describe, expect, it } from 'vitest'
import { shouldSubmitSummary, type JobState } from './ReportJobController'
import type { ReportJob } from '../../api/jobs'
const empty: JobState = { job: null, busy: false, error: null, context: null }
describe('automatic summary after restoration', () => {
  it('submits for a restored empty report and again after an explicit status recovery', () => {
    expect(shouldSubmitSummary(empty, false)).toBe(false)
    expect(shouldSubmitSummary(empty, true)).toBe(true)
    expect(shouldSubmitSummary({ ...empty, busy: true }, true)).toBe(false)
    expect(shouldSubmitSummary({ ...empty, error: 'temporary submit failure' }, true)).toBe(false)
    expect(shouldSubmitSummary({ ...empty, busy: true, error: null }, true)).toBe(false)
    expect(shouldSubmitSummary(empty, true)).toBe(true)
  })
  it('never automatically duplicates or retries an existing durable job', () => {
    for (const status of ['queued', 'running', 'succeeded', 'failed', 'cancelled']) {
      expect(shouldSubmitSummary({ ...empty, job: { status } as ReportJob }, true)).toBe(false)
    }
  })
})
