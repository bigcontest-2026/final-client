import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../api/client'
import { reportJobs, type ReportJob } from '../../api/jobs'
import { ReportJobController, sameRequest } from './ReportJobController'

const job = (status: ReportJob['status'], extra: Partial<ReportJob> = {}): ReportJob => ({ schema_version: 'report-job-1', job_id: 'j1', report_id: 'r1', kind: 'summary', status, attempts: 1, created_at: 'now', updated_at: 'now', result: null, error: null, ...extra })
const response = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status })
const setup = (options = {}) => new ReportJobController('r1', 'summary', { intervalMs: 1000, maxElapsedMs: 10000, ...options })
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

describe('durable report job lifecycle', () => {
  it('accepts 202, waits at a bounded interval and delivers the matching success', async () => {
    vi.useFakeTimers()
    const trace: string[] = []
    vi.stubGlobal('fetch', vi.fn(async (_url, init) => { trace.push(`${Date.now()}:${init?.method ?? 'GET'}`); return response(init?.method === 'POST' ? job('queued') : job('succeeded', { result: { report_id: 'r1', text: 'summary' } }), init?.method === 'POST' ? 202 : 200) }))
    const controller = setup()
    const run = controller.submit({}, 'request-one')
    await vi.advanceTimersByTimeAsync(999)
    expect(controller.state.job?.status).toBe('queued')
    expect(trace).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(1)
    await run
    expect(controller.state.job?.result).toEqual({ report_id: 'r1', text: 'summary' })
    expect(controller.state.context).toBe('request-one')
    expect(trace).toHaveLength(2)
  })

  it('restores an active server job on reload without submitting another job', async () => {
    vi.useFakeTimers()
    const urls: string[] = []
    vi.stubGlobal('fetch', vi.fn(async (url) => { urls.push(String(url)); return response(String(url).endsWith('/jobs') ? { jobs: [job('running')] } : job('succeeded', { result: { text: 'restored' } })) }))
    const controller = setup()
    const run = controller.restore()
    await vi.advanceTimersByTimeAsync(1000)
    await run
    expect(controller.state.job?.result).toEqual({ text: 'restored' })
    expect(urls).toHaveLength(2)
  })

  it('shows failure and retries explicitly using the retry endpoint', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url) => response(String(url).endsWith('/retry') ? job('succeeded', { attempts: 2, result: { text: 'retry' } }) : job('failed', { error: { code: 'provider_error', message: 'failed' } }), 202)))
    const controller = setup()
    await controller.submit({})
    expect(controller.state.job?.status).toBe('failed')
    await controller.retry()
    expect(controller.state.job?.attempts).toBe(2)
    expect(controller.state.job?.result).toEqual({ text: 'retry' })
  })

  it('cancels only on explicit action and fences a late poll completion', async () => {
    vi.useFakeTimers()
    let finishPoll: ((value: Response) => void) | undefined
    vi.stubGlobal('fetch', vi.fn(async (url, init) => {
      if (String(url).endsWith('/cancel')) return response(job('cancelled'))
      if (init?.method === 'POST') return response(job('queued'), 202)
      return new Promise<Response>(resolve => { finishPoll = resolve })
    }))
    const controller = setup()
    const run = controller.submit({})
    await vi.advanceTimersByTimeAsync(1000)
    await controller.cancel()
    finishPoll?.(response(job('succeeded', { result: { text: 'late' } })))
    await run
    expect(controller.state.job?.status).toBe('cancelled')
  })

  it('stops client polling on view close without cancelling the durable job or notifying after dispose', async () => {
    vi.useFakeTimers()
    const fetch = vi.fn(async () => response(job('queued'), 202))
    vi.stubGlobal('fetch', fetch)
    const controller = setup()
    const listener = vi.fn()
    controller.subscribe(listener)
    const run = controller.submit({})
    await vi.advanceTimersByTimeAsync(1)
    controller.dispose()
    const count = listener.mock.calls.length
    await vi.advanceTimersByTimeAsync(20000)
    await run
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(listener.mock.calls.length).toBe(count)
  })

  it('backs off transient polling errors, respects Retry-After, then succeeds', async () => {
    vi.useFakeTimers()
    const fetch = vi.fn().mockResolvedValueOnce(response(job('queued'), 202))
      .mockResolvedValueOnce(response({ detail: 'busy' }, 503))
      .mockResolvedValueOnce(new Response(JSON.stringify({ detail: 'busy' }), { status: 429, headers: { 'Retry-After': '3' } }))
      .mockResolvedValueOnce(response(job('succeeded', { result: { text: 'ok' } })))
    vi.stubGlobal('fetch', fetch)
    const controller = setup({ maxElapsedMs: 20000 })
    const run = controller.submit({})
    await vi.advanceTimersByTimeAsync(1000)
    await vi.advanceTimersByTimeAsync(2000)
    expect(fetch).toHaveBeenCalledTimes(3)
    await vi.advanceTimersByTimeAsync(2999)
    expect(fetch).toHaveBeenCalledTimes(3)
    await vi.advanceTimersByTimeAsync(1)
    await run
    expect(controller.state.job?.status).toBe('succeeded')
  })

  it('bounds repeated polling failures and elapsed wait while keeping server work resumable', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(response(job('queued'), 202)).mockImplementation(async () => { throw new ApiError(0, 'offline', 'network_error', null, null) }))
    const controller = setup({ maxFailures: 2 })
    const run = controller.submit({})
    await vi.advanceTimersByTimeAsync(10000)
    await run
    expect(controller.state.error).toBeTruthy()
    expect(controller.state.busy).toBe(false)
    expect(controller.state.job?.status).toBe('queued')
    const timed = setup({ maxElapsedMs: 1500 })
    vi.stubGlobal('fetch', vi.fn(async () => response(job('running'))))
    const wait = timed.submit({})
    await vi.advanceTimersByTimeAsync(2000)
    await wait
    expect(timed.state.error).toBeTruthy()
  })

  it('rejects results from a different report or job identity', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => response(job('succeeded', { report_id: 'other', result: { text: 'wrong' } }))))
    const controller = setup()
    await controller.submit({})
    expect(controller.state.job).toBeNull()
    expect(controller.state.error).toBeTruthy()
  })

  it('rejects a polling response for a different job within the same report', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', vi.fn(async (_url, init) => response(init?.method === 'POST' ? job('queued') : job('succeeded', { job_id: 'another-job', result: { text: 'wrong request' } }))))
    const controller = setup()
    const run = controller.submit({}, 'original-request')
    await vi.advanceTimersByTimeAsync(1000)
    await run
    expect(controller.state.job?.status).toBe('queued')
    expect(controller.state.job?.result).toBeNull()
    expect(controller.state.error).toBeTruthy()
  })

  it('matches request snapshots and rejects changed assist drafts before apply', () => {
    expect(sameRequest('r1', 'r1', '{"draft":"original"}', '{"draft":"original"}')).toBe(true)
    expect(sameRequest('r1', 'r2', 'a', 'a')).toBe(false)
    expect(sameRequest('r1', 'r1', '{"draft":"original"}', '{"draft":"edited"}')).toBe(false)
    expect(sameRequest('r1', 'r1', null, 'current')).toBe(false)
  })

  it('bounds an in-flight status request by the elapsed polling budget', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', vi.fn(async (_url, init) => {
      if (init?.method === 'POST') return response(job('queued'), 202)
      return new Promise<Response>((_resolve, reject) => init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true }))
    }))
    const controller = setup({ maxElapsedMs: 1500 })
    const run = controller.submit({})
    try {
      await vi.advanceTimersByTimeAsync(1600)
      expect(controller.state.busy).toBe(false)
      expect(controller.state.error).toBeTruthy()
    } finally { controller.dispose(); await run }
  })

  it('restores the exact request context only for the matching job ID', async () => {
    const store = new Map<string, string>()
    vi.stubGlobal('localStorage', { getItem: (key: string) => store.get(key) ?? null, setItem: (key: string, value: string) => store.set(key, value) })
    vi.stubGlobal('fetch', vi.fn(async (_url, init) => response(init?.method === 'POST' ? job('succeeded', { result: { text: 'done' } }) : { jobs: [job('succeeded', { result: { text: 'done' } })] })))
    const first = setup()
    await first.submit({}, 'exact-snapshot')
    first.dispose()
    const restored = setup()
    await restored.restore()
    expect(restored.state.context).toBe('exact-snapshot')
    vi.stubGlobal('fetch', vi.fn(async () => response({ jobs: [job('succeeded', { job_id: 'different' })] })))
    await restored.restore()
    expect(restored.state.context).toBeNull()
  })

  it('encodes scoped IDs for the exact job API contract', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () => response({ jobs: [] }))
    vi.stubGlobal('fetch', fetch)
    await reportJobs.list('a/b')
    expect(fetch.mock.calls[0]?.[0]).toBe('/api/model/analysis-reports/a%2Fb/jobs')
  })
})
