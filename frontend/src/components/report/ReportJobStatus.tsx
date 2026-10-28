import type { ReportJobView } from '../../lib/jobs/useReportJob'
import { Button } from '../ui'

const LABELS = { queued: '대기 중', running: '진행 중', succeeded: '완료', failed: '실패', cancelled: '취소됨' }
export function ReportJobStatus({ task }: { task: ReportJobView }) {
  const { job, busy, error, pending } = task
  if (!job && !busy && !error) return null
  return <div className="mt-3 flex flex-col items-start gap-2" aria-busy={busy}>
    <p role="status" aria-live="polite" className="text-footnote text-label-secondary">
      {job ? `AI 작업 ${LABELS[job.status]}` : busy ? '저장된 작업 확인 중' : ''}
      {pending && ' · 화면을 닫아도 서버 작업은 계속됩니다.'}
    </p>
    {job?.status === 'failed' && <p role="alert" className="text-subhead text-warning">작업을 완료하지 못했습니다. 다시 시도해 주세요.</p>}
    {error && <p role="alert" className="text-subhead text-warning">{error}</p>}
    <div className="flex flex-wrap gap-2">
      {pending && <Button size="sm" onClick={() => void task.cancel()}>작업 취소</Button>}
      {(job?.status === 'failed' || job?.status === 'cancelled') && <Button size="sm" disabled={busy} onClick={() => void task.retry()}>작업 다시 시도</Button>}
      {error && !busy && (!job || pending) && <Button size="sm" onClick={() => void task.resume()}>상태 다시 확인</Button>}
    </div>
  </div>
}
