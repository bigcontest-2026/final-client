import { ApiError, errorMessage } from '../../api/client'
import { isActiveJob, reportJobs, type JobKind, type ReportJob } from '../../api/jobs'

export interface JobState { job: ReportJob | null; busy: boolean; error: string | null; context: string | null }
export function shouldSubmitSummary(state: JobState, restored: boolean): boolean {
  return restored && !state.busy && !state.job && !state.error
}
interface Options { intervalMs?: number; maxElapsedMs?: number; maxFailures?: number }
interface SavedContext { jobId: string; context: string | null }
const WAIT_MESSAGE = '상태 확인을 멈췄습니다. 작업은 서버에서 계속될 수 있습니다. 상태를 다시 확인해 주세요.'
export function sameRequest(reportId: string, currentReportId: string, submitted: string | null, current: string): boolean {
  return reportId === currentReportId && submitted !== null && submitted === current
}
function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(signal.reason); return }
    const abort = () => { clearTimeout(timer); reject(signal.reason) }
    const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve() }, ms)
    signal.addEventListener('abort', abort, { once: true })
  })
}

// A controller owns one view's observation, never the server job's lifetime.
export class ReportJobController {
  state: JobState = { job: null, busy: false, error: null, context: null }
  private listeners = new Set<(state: JobState) => void>()
  private operation: AbortController | null = null
  private disposed = false
  private interval: number
  private maxElapsed: number
  private maxFailures: number
  constructor(readonly reportId: string, readonly kind: JobKind, options: Options = {}) {
    this.interval = Math.max(100, options.intervalMs ?? 2000)
    this.maxElapsed = options.maxElapsedMs ?? 10 * 60_000
    this.maxFailures = options.maxFailures ?? 5
  }
  subscribe(listener: (state: JobState) => void) { this.listeners.add(listener); return () => { this.listeners.delete(listener) } }
  private update(patch: Partial<JobState>) {
    if (this.disposed) return
    this.state = { ...this.state, ...patch }
    this.listeners.forEach(listener => listener(this.state))
  }
  private key() { return `hermes:report-job:v1:${this.reportId}:${this.kind}` }
  private remember(job: ReportJob, context: string | null) {
    try { localStorage.setItem(this.key(), JSON.stringify({ jobId: job.job_id, context } satisfies SavedContext)) } catch { /* storage is optional */ }
  }
  private recalled(job: ReportJob): string | null {
    try {
      const saved = JSON.parse(localStorage.getItem(this.key()) ?? 'null') as SavedContext | null
      return saved?.jobId === job.job_id && typeof saved.context === 'string' ? saved.context : null
    } catch { return null }
  }
  private validate(job: ReportJob, expectedJobId?: string) {
    if (job?.schema_version !== 'report-job-1' || job.report_id !== this.reportId || job.kind !== this.kind || !job.job_id || (expectedJobId && job.job_id !== expectedJobId) || !['queued', 'running', 'succeeded', 'failed', 'cancelled'].includes(job.status)) {
      throw new ApiError(503, '보고서와 작업 응답이 맞지 않습니다. 다시 확인해 주세요.', 'report_job_mismatch', null, null)
    }
  }
  private async execute(action: (signal: AbortSignal) => Promise<void>) {
    if (this.disposed) return
    this.operation?.abort()
    const operation = new AbortController()
    this.operation = operation
    this.update({ busy: true, error: null })
    try { await action(operation.signal) }
    catch (reason) { if (!operation.signal.aborted) this.update({ error: errorMessage(reason) }) }
    finally { if (!operation.signal.aborted) this.update({ busy: false }) }
  }
  private async watch(initial: ReportJob, signal: AbortSignal) {
    let job = initial
    let failures = 0
    let interval = this.interval
    const deadline = new AbortController()
    const timer = setTimeout(() => deadline.abort(), this.maxElapsed)
    const bounded = AbortSignal.any([signal, deadline.signal])
    try {
      while (isActiveJob(job) && !bounded.aborted) {
        await delay(interval, bounded)
        try {
          const next = await reportJobs.get(this.reportId, job.job_id, bounded)
          if (bounded.aborted) return
          this.validate(next, job.job_id)
          job = next
          this.update({ job })
          failures = 0
          interval = this.interval
        } catch (reason) {
          if (bounded.aborted) throw reason
          if (reason instanceof ApiError && (reason.code === 'report_job_mismatch' || (reason.status >= 400 && reason.status < 500 && reason.status !== 429))) throw reason
          failures += 1
          if (failures >= this.maxFailures) throw new ApiError(0, WAIT_MESSAGE, 'job_poll_failures', null, null)
          const retry = reason instanceof ApiError ? reason.retryAfter : null
          interval = Number.isFinite(retry) && retry! > 0 ? Math.max(this.interval, retry! * 1000) : Math.min(30_000, this.interval * 2 ** failures)
        }
      }
    } catch (reason) {
      if (deadline.signal.aborted && !signal.aborted) throw new ApiError(0, WAIT_MESSAGE, 'job_poll_limit', null, null)
      throw reason
    } finally { clearTimeout(timer) }
  }

  restore() {
    return this.execute(async signal => {
      const { jobs } = await reportJobs.list(this.reportId, signal)
      if (signal.aborted) return
      const job = jobs.find(item => item.kind === this.kind)
      if (!job) { this.update({ job: null, context: null }); return }
      this.validate(job)
      this.update({ job, context: this.recalled(job) })
      await this.watch(job, signal)
    })
  }
  submit(payload: object, context: string | null = null) {
    if (this.state.busy) return Promise.resolve()
    return this.execute(async signal => {
      this.update({ job: null, context })
      const job = await reportJobs.submit(this.reportId, this.kind, payload, signal)
      if (signal.aborted) return
      this.validate(job)
      this.remember(job, context)
      this.update({ job })
      await this.watch(job, signal)
    })
  }
  cancel() {
    const current = this.state.job
    if (!current || !isActiveJob(current)) return Promise.resolve()
    return this.execute(async signal => {
      const job = await reportJobs.cancel(this.reportId, current.job_id, signal)
      if (signal.aborted) return
      this.validate(job, current.job_id)
      this.update({ job })
      if (isActiveJob(job)) await this.watch(job, signal)
    })
  }
  retry() {
    const current = this.state.job
    if (!current || !['failed', 'cancelled'].includes(current.status) || this.state.busy) return Promise.resolve()
    return this.execute(async signal => {
      const job = await reportJobs.retry(this.reportId, current.job_id, signal)
      if (signal.aborted) return
      this.validate(job)
      this.remember(job, this.state.context)
      this.update({ job })
      await this.watch(job, signal)
    })
  }
  resume() {
    const current = this.state.job
    if (!current || !isActiveJob(current) || this.state.busy) return Promise.resolve()
    return this.execute(async signal => {
      const job = await reportJobs.get(this.reportId, current.job_id, signal)
      if (signal.aborted) return
      this.validate(job, current.job_id)
      this.update({ job })
      await this.watch(job, signal)
    })
  }
  dispose() { this.disposed = true; this.operation?.abort(); this.listeners.clear() }
}
