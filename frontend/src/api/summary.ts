import { ApiError, request } from './client'
import type { AnalysisReport } from './types'

export const SUMMARY_UNAVAILABLE_MESSAGE = '활동 변화를 요약할 모델 연결을 확인한 뒤 다시 시도해 주세요.'

export interface ActivitySummary {
  report_id: string
  text: string
  created_at: string
  reused: boolean
}

// Coalesce development StrictMode mounts and simultaneous views, without caching failures.
const pending = new Map<string, Promise<string>>()

export function requestActivitySummary(report: AnalysisReport): Promise<string> {
  const id = report.report_id
  const existing = pending.get(id)
  if (existing) return existing
  const result = request<ActivitySummary>(`/api/model/analysis-reports/${encodeURIComponent(id)}/summary`, {
    method: 'POST', timeoutMs: 120_000,
  }).then((summary) => {
    if (summary?.report_id !== id || typeof summary.text !== 'string' || !summary.text.trim()) {
      throw new ApiError(503, SUMMARY_UNAVAILABLE_MESSAGE, 'activity_summary_invalid_response', null, null)
    }
    return summary.text
  }).finally(() => pending.delete(id))
  pending.set(id, result)
  return result
}
