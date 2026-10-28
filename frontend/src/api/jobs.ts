import { request } from './client'
import type { ActivitySummary } from './summary'
import type { AnalysisReport, AssistResponse } from './types'

export type JobKind = 'summary' | 'investigate' | 'assist'
export type JobStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled'
export interface JobResults { summary: ActivitySummary; investigate: AnalysisReport; assist: AssistResponse }
export interface ReportJob {
  schema_version: 'report-job-1'
  job_id: string
  report_id: string
  kind: JobKind
  status: JobStatus
  attempts: number
  created_at: string
  updated_at: string
  result: object | null
  error: { code: string; message: string } | null
}
const path = (reportId: string, jobId?: string) => `/api/model/analysis-reports/${encodeURIComponent(reportId)}/jobs${jobId ? `/${encodeURIComponent(jobId)}` : ''}`
export const reportJobs = {
  submit: (reportId: string, kind: JobKind, payload: object, signal?: AbortSignal) => request<ReportJob>(path(reportId), { method: 'POST', body: { kind, payload }, signal }),
  list: (reportId: string, signal?: AbortSignal) => request<{ jobs: ReportJob[] }>(path(reportId), { signal }),
  get: (reportId: string, jobId: string, signal?: AbortSignal) => request<ReportJob>(path(reportId, jobId), { signal }),
  cancel: (reportId: string, jobId: string, signal?: AbortSignal) => request<ReportJob>(`${path(reportId, jobId)}/cancel`, { method: 'POST', signal }),
  retry: (reportId: string, jobId: string, signal?: AbortSignal) => request<ReportJob>(`${path(reportId, jobId)}/retry`, { method: 'POST', signal }),
}
export const isActiveJob = (job: ReportJob | null) => job?.status === 'queued' || job?.status === 'running'
