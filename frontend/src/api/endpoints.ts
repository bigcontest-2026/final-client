import { request } from './client'
import type {
  AgeCode,
  AnalysisReport,
  AnalysisReportList,
  AssistResponse,
  BehaviorResponse,
  HealthStatus,
  PlanInput,
  PlanKind,
  RegionsResponse,
  ResponseReport,
  ResponseReportList,
  SexCode,
  SurveyAreaResponse,
  WelfareCatalog,
  Workspace,
} from './types'

const MODEL = '/api/model'
const AI_TIMEOUT = 120_000
const INVESTIGATION_TIMEOUT = 200_000

export const api = {
  health: (signal?: AbortSignal) => request<HealthStatus>('/api/health', { signal }),

  regions: (signal?: AbortSignal) => request<RegionsResponse>(`${MODEL}/regions`, { signal }),

  surveyArea: (
    query: { level?: 'sgg' | 'administrative_dong'; region_code?: string; province_code?: string; dong_code?: string; month?: string; offset?: number; limit?: number },
    signal?: AbortSignal,
  ) => request<SurveyAreaResponse>(`${MODEL}/survey-area`, { query, signal }),

  behavior: (
    query: { region_code?: string; month?: string; sex_code?: SexCode; age_code?: AgeCode; offset?: number; limit?: number },
    signal?: AbortSignal,
  ) => request<BehaviorResponse>(`${MODEL}/behavior`, { query, signal }),

  welfareCatalog: (
    query: { q?: string; category_id?: string; status?: string; region_code?: string; region_level?: string; offset?: number; limit?: number },
    signal?: AbortSignal,
  ) => request<WelfareCatalog>(`${MODEL}/welfare/catalog`, { query, signal }),

  createAnalysisReport: (body: { region_code: string; dong_code?: string; month: string; sex_code?: SexCode; age_code?: AgeCode }) =>
    request<AnalysisReport>(`${MODEL}/analysis-reports`, { method: 'POST', body }),

  listAnalysisReports: (
    query: { limit?: number; offset?: number; region_code?: string; dong_code?: string; month?: string; sex_code?: string; age_code?: string },
    signal?: AbortSignal,
  ) => request<AnalysisReportList>(`${MODEL}/analysis-reports`, { query, signal }),

  getAnalysisReport: (reportId: string, signal?: AbortSignal) =>
    request<AnalysisReport>(`${MODEL}/analysis-reports/${encodeURIComponent(reportId)}`, { signal }),

  investigate: (reportId: string, comparisonReportIds: string[] = []) =>
    request<AnalysisReport>(`${MODEL}/analysis-reports/${encodeURIComponent(reportId)}/investigate`, {
      method: 'POST',
      body: comparisonReportIds.length ? { comparison_report_ids: comparisonReportIds } : {},
      timeoutMs: INVESTIGATION_TIMEOUT,
    }),

  getWorkspace: (reportId: string, signal?: AbortSignal) =>
    request<Workspace>(`${MODEL}/analysis-reports/${encodeURIComponent(reportId)}/response-workspace`, { signal }),

  saveWorkspace: (reportId: string, expectedVersion: number, plans: PlanInput[]) =>
    request<Workspace>(`${MODEL}/analysis-reports/${encodeURIComponent(reportId)}/response-workspace`, {
      method: 'PUT',
      body: { expected_version: expectedVersion, plans },
    }),

  assist: (reportId: string, body: { mode: 'draft' | 'revise' | 'review'; kind: PlanKind; instruction?: string; current_plan?: PlanInput }) =>
    request<AssistResponse>(`${MODEL}/analysis-reports/${encodeURIComponent(reportId)}/response-workspace/assist`, {
      method: 'POST',
      body,
      timeoutMs: AI_TIMEOUT,
    }),

  createResponseReport: (reportId: string, body: { expected_workspace_version: number; selected_plan_versions: { plan_id: string; version: number }[] }) =>
    request<ResponseReport>(`${MODEL}/analysis-reports/${encodeURIComponent(reportId)}/response-reports`, { method: 'POST', body }),

  listResponseReports: (query: { limit?: number; offset?: number; analysis_report_id?: string; region_code?: string; dong_code?: string }, signal?: AbortSignal) =>
    request<ResponseReportList>(`${MODEL}/response-reports`, { query, signal }),

  getResponseReport: (reportId: string, signal?: AbortSignal) =>
    request<ResponseReport>(`${MODEL}/response-reports/${encodeURIComponent(reportId)}`, { signal }),
}
