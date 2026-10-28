import type { AnalysisReport } from '../../api/types'

export function matchesInvestigationResult(source: AnalysisReport, currentReportId: string, result: AnalysisReport): boolean {
  if (source.report_id !== currentReportId) return false
  const rootId = source.parent_report_id ?? source.report_id
  return result.report_id === currentReportId || result.parent_report_id === rootId
}
