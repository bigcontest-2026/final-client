import { ApiError } from './client'
import type { AnalysisReport } from './types'

export const SUMMARY_UNAVAILABLE_MESSAGE = '활동 변화를 요약할 모델 연결을 확인한 뒤 다시 시도해 주세요.'

export async function requestActivitySummary(report: AnalysisReport): Promise<string> {
  void report
  throw new ApiError(503, SUMMARY_UNAVAILABLE_MESSAGE, 'activity_summary_unavailable', null, null)
}
