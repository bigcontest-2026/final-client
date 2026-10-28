# Durable report job experience

Approved by the user in conversation on 2026-10-28; proceed autonomously using agents, measurements, feature branches and convention-aligned commits/pushes.

## Intent
Connect final report summary, investigation and AI assistance to the shared job API. Show queued/running/failed/cancelled state and explicit retry/cancel controls. Restore pending report jobs on reload; closing a view stops polling but does not cancel a durable job. Never apply results to a different report or overwrite user edits. Preserve existing design. Contract is ../../.coordination/implementation.md.

## Approach
Build on existing code and dependencies. Keep original data and source checkouts untouched. Changes happen in this isolated checkout. Synthetic measurement and real-model measurement remain distinct. API-only/RAG correctness is preserved. No deployment or main-branch merge.

## Alternatives
Retaining request-bound execution leaves the identified bottlenecks and restart gaps. Introducing a new distributed platform before measuring adds unsupported complexity. Extend existing local architecture first. Semantic reuse stays disabled by default until evaluated; exact reuse and strict metadata/version checks precede approximate matching.

## Scope
frontend/src/api/endpoints.ts; frontend/src/api/summary.ts; new jobs API/helper; frontend/src/components/report/AnalysisDetail.tsx; frontend/src/components/report/ReportSections.tsx; frontend/src/components/response/AiProposalPanel.tsx; tests.

## Shared Job API Contract

Prefix `/api/model/analysis-reports/{report_id}/jobs`.

- POST prefix: body `{kind: 'summary'|'investigate'|'assist', payload: object}`; return 202 and Job. Same canonical request+report/model/prompt versions joins an existing queued/running/succeeded job. No raw arbitrary report/model input. Preserve existing action validation and access boundary before enqueue.
- GET prefix: return `{jobs: Job[]}` scoped to report (latest first; default max 20).
- GET prefix `/{job_id}`: Job; must match report ID.
- POST prefix `/{job_id}/cancel`: Job; terminal jobs unchanged; cancel execution and fence later writes.
- POST prefix `/{job_id}/retry`: Job; only failed/cancelled jobs can retry, with fresh attempt ownership and current allowed version validation.
- Job: `{schema_version:'report-job-1',job_id,report_id,kind,status:'queued'|'running'|'succeeded'|'failed'|'cancelled',attempts:number,created_at,updated_at,result:object|null,error:{code:string,message:string}|null}`. Results are identical to existing summary/investigate/assist endpoints. No lease tokens/provider diagnostics exposed.
- Keep original synchronous endpoints compatible. New frontend calls job endpoints and restores pending jobs on report reload. SSE not required; bounded abortable polling is sufficient. Closing a page stops polling, not a durable server job. Explicit cancel is separate.
