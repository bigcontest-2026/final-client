import { mkdirSync, writeFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import type { AnalysisReport } from '../../api/types'
import { requestActivitySummary } from '../../api/summary'
import { ReportJobController } from './ReportJobController'
import type { ReportJob } from '../../api/jobs'

// Reproduce: npm test -- --run src/lib/jobs/lifecycleTrace.test.ts
// Virtual time, deterministic protocol model. These are not real LLM timings.
describe('reproducible deterministic lifecycle trace', () => {
  it('records request-bound feedback versus durable acknowledgement and bounded polls', async () => {
    vi.useFakeTimers()
    const providerDurations = [600, 1800, 2600, 4200, 600, 1800, 2600, 4200]
    const samples: object[] = []
    const firstFeedback: number[] = []
    const terminalTimes: number[] = []
    const baselineTimes: number[] = []
    try {
      for (const [index, providerMs] of providerDurations.entries()) {
        const reportId = `trace-${index}`
        vi.setSystemTime(0)
        const summary = { report_id: reportId, text: 'deterministic summary', created_at: 'fixture', reused: false }
        vi.stubGlobal('fetch', vi.fn(async () => {
          await new Promise(resolve => setTimeout(resolve, providerMs + 5))
          return new Response(JSON.stringify(summary))
        }))
        let baselineMs = -1
        const baseline = requestActivitySummary({ report_id: reportId } as AnalysisReport).then(() => { baselineMs = Date.now() })
        await vi.advanceTimersByTimeAsync(10000)
        await baseline
        baselineTimes.push(baselineMs)

        vi.setSystemTime(0)
        const requests: { atMs: number; method: string; path: string; status: string }[] = []
        const transitions: { atMs: number; status: string }[] = []
        vi.stubGlobal('fetch', vi.fn(async (url, init) => {
          await new Promise(resolve => setTimeout(resolve, 5))
          const status = init?.method === 'POST' ? 'queued' : Date.now() >= providerMs ? 'succeeded' : 'running'
          const job: ReportJob = { schema_version: 'report-job-1', job_id: `job-${index}`, report_id: reportId, kind: 'summary', status, attempts: 1, created_at: 'fixture', updated_at: 'fixture', result: status === 'succeeded' ? summary : null, error: null }
          requests.push({ atMs: Date.now(), method: init?.method ?? 'GET', path: String(url), status })
          return new Response(JSON.stringify(job), { status: init?.method === 'POST' ? 202 : 200 })
        }))
        const controller = new ReportJobController(reportId, 'summary', { intervalMs: 1000, maxElapsedMs: 10000 })
        controller.subscribe(state => {
          if (state.job && transitions.at(-1)?.status !== state.job.status) transitions.push({ atMs: Date.now(), status: state.job.status })
        })
        const run = controller.submit({}, reportId)
        await vi.advanceTimersByTimeAsync(10000)
        await run
        expect(controller.state.job?.result).toEqual(summary)
        expect(controller.state.error).toBeNull()
        expect(requests.slice(1).every((request, i) => request.atMs - requests[i].atMs >= 1000)).toBe(true)
        const acknowledgedMs = transitions[0].atMs
        const terminalMs = transitions.at(-1)!.atMs
        firstFeedback.push(acknowledgedMs)
        terminalTimes.push(terminalMs)
        samples.push({ reportId, providerMs, baselineMs, acknowledgedMs, terminalMs, polls: requests.length - 1, requests, transitions })
        controller.dispose()
      }
      const percentile = (values: number[], fraction: number) => [...values].sort((a, b) => a - b)[Math.ceil(values.length * fraction) - 1]
      const distribution = (values: number[]) => ({ p50: percentile(values, 0.5), p95: percentile(values, 0.95), min: Math.min(...values), max: Math.max(...values) })
      const evidence = {
        schema: 'hermes-client-job-trace-1',
        provider: 'deterministic mocked HTTP + virtual clock; no real model or network',
        environment: { runtime: 'Vitest 3.2.7 / Node; virtual time', node: process.version, platform: process.platform, architecture: process.arch },
        parameters: { samples: providerDurations.length, providerDurationsMs: providerDurations, httpEnvelopeMs: 5, pollIntervalMs: 1000, maxElapsedMs: 10000 },
        result: { correct: samples.length, failed: 0, baselineFirstFeedbackMs: distribution(baselineTimes), durableFirstFeedbackMs: distribution(firstFeedback), durableTerminalMs: distribution(terminalTimes) },
        limitation: 'Protocol/UI lifecycle evidence only. Acknowledgement is earlier; polling adds detection delay. No inference about real model speed, GPU throughput or deployment.',
        samples,
      }
      mkdirSync('../docs/evidence', { recursive: true })
      writeFileSync('../docs/evidence/durable-report-job-trace.json', JSON.stringify(evidence, null, 2) + '\n')
    } finally { vi.useRealTimers(); vi.unstubAllGlobals() }
  })
})
