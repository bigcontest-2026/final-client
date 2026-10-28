import type { AssistResponse, PlanKind } from '../../api/types'
import { toPlanInput, type DraftPlan } from '../plans'
import { sameRequest } from './ReportJobController'

export function assistRequestContext(active: DraftPlan | null, mode: AssistResponse['mode'], kind: PlanKind): string {
  return JSON.stringify({ mode, kind, active: active ? { localId: active.localId, plan: toPlanInput(active) } : null })
}
export function canApplyAssistProposal(reportId: string, currentReportId: string, context: string | null, active: DraftPlan | null, result: AssistResponse): boolean {
  return sameRequest(reportId, currentReportId, context, assistRequestContext(active, result.mode, result.kind))
}
