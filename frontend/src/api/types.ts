export type SexCode = 'MAN' | 'WMAN'
export type AgeCode = '20G' | '30G' | '40G' | '50G' | '60GU'

export type Category =
  | 'no_threshold_decline'
  | 'single_source_decline'
  | 'joint_decline'
  | 'priority_review'
  | 'assessment_hold'

export type SourceKey = 'skt' | 'card_a'

export interface HealthStatus {
  mode: string
  status: 'ok' | 'partial' | 'unavailable'
  sources: Record<string, { ready: boolean; code: string; run_id?: string }>
  months: string[]
  sex_codes: SexCode[]
  age_codes: AgeCode[]
}

export interface RegionItem {
  code: string
  name: string
  province_code: string
  province_name: string
  dong_count: number
}

export interface RegionsResponse {
  regions: RegionItem[]
  months: string[]
}

export interface Availability {
  status: string
  reason: string | null
  available_sources: string[]
  region_code: string | null
  month: string | null
}

export interface I5Record {
  record_id: string
  spatial_unit: 'sgg' | 'administrative_dong'
  area_code: string
  area_name: string
  dong_code: string | null
  region_code: string
  region_name: string
  month: string
  i5_reference: number | null
  i5_display_score?: number | null
  i5_z?: number | null
  i5_display_clipped?: boolean | null
  i5_display_reference_version?: string
  domain_scores: Record<'E' | 'P' | 'O' | 'C' | 'U', number> | null
  group_weights: Record<string, number> | null
  population_total: number | null
  population_20plus: number | null
}

export interface SurveyAreaResponse {
  availability: Availability
  total_matched: number
  records: I5Record[]
  next_offset: number | null
  run_id: string
}

export interface SourceAssessment {
  change_percent: number | null
  threshold_met: boolean | null
  previous_change_percent?: number | null
  previous_threshold_met?: boolean | null
}

export interface ActivityAssessment {
  rule_version: string
  threshold_percent: number
  category: Category
  category_label: string
  scope: { region_code: string; month: string; sex_code: SexCode | null; age_code: AgeCode | null }
  sources: Partial<Record<SourceKey, SourceAssessment>>
  signals: { joint_decline: boolean | null; two_month_streak: boolean | null; robust_candidate: boolean | null }
  reason_codes: string[]
  reasons: string[]
  evidence_ids: string[]
}

export interface BehaviorObservation {
  record_id: string
  key: { region_code: string; month: string; sex_code: SexCode; age_code: AgeCode }
  region_name: string
  sources: Partial<Record<SourceKey, { change_percent: number | null; direction?: string }>>
}

export interface BehaviorRecord {
  behavior: BehaviorObservation
  activity_assessment: ActivityAssessment
}

export interface BehaviorResponse {
  availability: Availability
  total_matched: number
  next_offset: number | null
  records: BehaviorRecord[]
}

export interface ReportScope {
  region_code: string
  dong_code?: string | null
  month: string
  sex_code: SexCode | null
  age_code: AgeCode | null
}

export interface ReportAssessment extends ActivityAssessment {
  historical_reference?: { status: string; reason?: string | null; independent_evidence?: boolean }
  observation?: {
    record_id: string
    region_name: string
    sources: Partial<Record<SourceKey, { activity_daily: number | null; previous_activity_daily: number | null; unit: string }>>
  }
}

export interface LifecycleGroup {
  scope: ReportScope
  age_label: string
  source_age_range: string
  observation_status: string
  hypotheses: { id: string; text: string; status: string }[]
  questions: string[]
  comparison_checks: string[]
  boundaries: string[]
  interpretation_status: string
  support_need_status: string
}

export interface LifecycleInterpretation {
  source?: { title: string; authors: string[]; publisher?: string; year: number; doi?: string; pages?: number[] }
  groups?: LifecycleGroup[]
}

export type CategorySummary = Record<Category, number> & { total: number }

export interface InvestigationSource {
  source_id: string
  title: string
  url: string
  publisher?: string | null
  reference_period?: string | null
  region_scope?: string | null
  geography_relation?: string
  period_relation?: string
  supporting_excerpt?: string
}

export interface ContextInvestigation {
  status: 'completed' | 'no_evidence'
  summary?: string
  observed_context?: { text: string; source_ids: string[] }[]
  possible_causes?: { title: string; explanation: string; source_ids: string[]; limitations?: string[] }[]
  verification_questions?: string[]
  sources?: InvestigationSource[]
  limitations?: string[]
  investigated_at?: string
}

export type ReportType = 'observation_analysis' | 'context_cause_analysis'

export interface AnalysisReportSummary {
  report_id: string
  created_at: string
  scope: ReportScope
  region_name: string
  summary: CategorySummary
  storage_status: string
  report_type: ReportType
  parent_report_id: string | null
  context_investigation_status: string
  activity_availability: ActivityAvailability | null
  report_status: 'complete' | 'partial' | null
}

export interface ActivityAvailability {
  status: 'available' | 'partial' | 'unavailable'
  spatial_unit: string
  region_code: string
  requested_group_count: number
  observed_group_count: number
  missing_groups: { sex_code: SexCode; age_code: AgeCode }[] | string[]
}

export interface AnalysisReport {
  schema_version: string
  report_type: ReportType
  report_id: string
  parent_report_id?: string | null
  created_at: string
  storage_status: string
  reused: boolean
  scope: ReportScope
  region_name: string
  rule_version: string
  threshold_percent: number
  assessments: ReportAssessment[]
  summary: CategorySummary
  context: {
    i5?: { status: string; record?: I5Record | null }
    mois?: { status: string; record?: Record<string, string> | null }
    activity_scope?: { spatial_unit: string; region_code: string; region_name: string; role: string; is_dong_observation: boolean }
  }
  context_investigation_status: 'not_performed' | 'not_applicable' | 'completed' | 'no_evidence'
  context_investigation?: ContextInvestigation | null
  lifecycle_interpretation?: LifecycleInterpretation | null
  limitations: string[]
  open_questions: string[]
  markdown: string
  activity_availability?: ActivityAvailability | null
  report_status?: 'complete' | 'partial' | null
}

export interface ListResponse {
  total_matched: number
  offset: number
  next_offset: number | null
}

export interface AnalysisReportList extends ListResponse {
  reports: AnalysisReportSummary[]
}

export type PlanKind = 'existing_program' | 'program_improvement' | 'new_program'
export type ReviewKey = 'eligibility' | 'support_content' | 'delivery' | 'finance_and_cost'
export type ReviewStatus = 'unconfirmed' | 'confirmed' | 'not_applicable'

export interface PlanningEntry extends ReviewEntry {
  owner: string
  next_action: string
}

export type PlanningKey = 'goal' | 'alternatives' | 'service_function' | 'service_scope' | 'selection_requirements' | 'availability' | 'access_and_cost' | 'execution' | 'scale' | 'budget' | 'funding' | 'evaluation' | 'decisions' | 'sources' | 'institutional_conditions' | 'resident_feedback'
export type PlanningDetails = Partial<Record<PlanningKey, PlanningEntry>>
export interface ReportDocument {
  version: string
  title: string
  subtitle: string
  metadata: { label: string; value: string }[]
  sections: { id: string; title: string; paragraphs: string[] }[]
}

export interface ReviewEntry {
  status: ReviewStatus
  text: string
  evidence: string
}

export interface SupportNeedEntry {
  category_code: string
  status: 'unconfirmed' | 'confirmed'
  text: string
  evidence: string
}

export interface ProgramReference {
  program_version_id: string
  title: string
  url?: string | null
  publisher?: string | null
}

export interface PlanInput {
  plan_id?: string
  kind: PlanKind
  title: string
  target: string
  rationale: string
  content: string
  checks: string
  selected: boolean
  feedback: string
  program_reference?: ProgramReference | null
  policy_review?: Partial<Record<ReviewKey, ReviewEntry>>
  support_needs?: SupportNeedEntry[]
  planning_details?: PlanningDetails
}

export interface Plan extends PlanInput {
  plan_id: string
  version: number
  created_at: string
  updated_at: string
  changed_fields: string[]
  history?: { version: number; title: string; selected: boolean; updated_at: string; changed_fields: string[] }[]
}

export interface ResponseReportSummary {
  report_id: string
  title: string
  created_at: string
  workspace_version: number
  selected_plan_count: number
  filename: string
  scope: ReportScope
  region_name: string
  report_type: 'preventive_response'
  storage_status: string
  analysis_report_id: string
  workspace_analysis_report_id: string
}

export interface Workspace {
  analysis_report_id: string
  workspace_analysis_report_id: string
  version: number
  updated_at: string | null
  storage_status: string
  plans: Plan[]
  reports: ResponseReportSummary[]
}

export interface ResponseReport extends ResponseReportSummary {
  document?: ReportDocument
  schema_version: string
  selected_plans: Plan[]
  analysis_snapshot: AnalysisReport
  limitations: string[]
  markdown: string
  reused: boolean
}

export interface ResponseReportList extends ListResponse {
  reports: ResponseReportSummary[]
}

export interface AssistResponse {
  mode: 'draft' | 'revise' | 'review'
  kind: PlanKind
  suggestion: Pick<PlanInput, 'title' | 'target' | 'rationale' | 'content' | 'checks' | 'planning_details'> | null
  review_notes: string[]
  status: string
  limitations: string[]
}

export interface WelfareOption {
  code?: string
  category_id?: string
  label: string
  count?: number
}

export interface WelfareProgram {
  version_id: string
  program_id: string
  title: string
  summary?: string | null
  institution?: string | null
  support_content?: string | null
  target_text?: string | null
  selection_text?: string | null
  application_text?: string | null
  application_period_text?: string | null
  start_date?: string | null
  end_date?: string | null
  period_status?: string | null
  source_url?: string | null
  source?: { source_id: string; name: string } | null
  is_synthetic?: boolean
  source_categories?: { category_id: string; label: string }[]
  regions?: { scope_type: string; code: string | null; name: string | null; original_region_text?: string | null }[]
  conditions?: { kind: string; value: unknown; source_quote?: string | null }[]
  region_match_rank?: number
  region_match_label?: string
}

export interface WelfareCatalog {
  is_synthetic?: boolean
  data_source?: string
  total: number
  matched: number
  offset: number
  limit: number
  next_offset: number | null
  programs: WelfareProgram[]
  categories: WelfareOption[]
  statuses: WelfareOption[]
  region_search_order?: { level: string; label: string; rank: number }[]
  limitations?: string[]
}
