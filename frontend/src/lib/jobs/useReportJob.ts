import { useCallback, useEffect, useRef, useState } from 'react'
import { isActiveJob, type JobKind, type JobResults } from '../../api/jobs'
import { ReportJobController, type JobState } from './ReportJobController'

const initial: JobState = { job: null, busy: true, error: null, context: null }
export function useReportJob<K extends JobKind>(reportId: string, kind: K) {
  const controller = useRef<ReportJobController | null>(null)
  const [observed, setObserved] = useState<{ key: string; state: JobState; restored: boolean }>({ key: '', state: initial, restored: false })
  const key = `${reportId}:${kind}`
  const state = observed.key === key ? observed.state : initial
  const restored = observed.key === key && observed.restored
  useEffect(() => {
    const current = new ReportJobController(reportId, kind)
    controller.current = current
    let alive = true
    let listed = false
    const unsubscribe = current.subscribe(state => {
      if (alive) setObserved({ key, state, restored: listed })
    })
    setObserved({ key, state: initial, restored: false })
    // restore() keeps observing until terminal; a first job response is already enough
    // to render its status. No second observer or server cancellation on cleanup.
    void current.restore().finally(() => {
      listed = true
      if (alive) setObserved({ key, state: current.state, restored: true })
    })
    return () => {
      alive = false
      unsubscribe()
      current.dispose()
      if (controller.current === current) controller.current = null
    }
  }, [reportId, kind, key])
  const submit = useCallback((payload: object, context: string | null = null) => controller.current?.submit(payload, context), [])
  const cancel = useCallback(() => controller.current?.cancel(), [])
  const retry = useCallback(() => controller.current?.retry(), [])
  const resume = useCallback(() => {
    const current = controller.current
    return current?.state.job ? current.resume() : current?.restore()
  }, [])
  return { ...state, restored, pending: isActiveJob(state.job), result: state.job?.status === 'succeeded' ? state.job.result as JobResults[K] | null : null, submit, cancel, retry, resume }
}
export type ReportJobView = ReturnType<typeof useReportJob>
