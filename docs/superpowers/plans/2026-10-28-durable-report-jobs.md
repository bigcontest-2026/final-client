# Durable report job experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement task-by-task.

**Goal:** Connect final report summary, investigation and AI assistance to the shared job API. Show queued/running/failed/cancelled state and explicit retry/cancel controls. Restore pending report jobs on reload; closing a view stops polling but does not cancel a durable job. Never apply results to a different report or overwrite user edits. Preserve existing design. Contract is ../../.coordination/implementation.md.

**Architecture:** Reuse existing interfaces and dependency injection. Isolate mutable state, own cancellation, and store measured evidence.

**Tech Stack:** Existing Python/FastAPI/SQLite or TypeScript/React stack.

**Spec:** ../specs/2026-10-28-durable-report-jobs-design.md

## Global Constraints
- Preserve existing tests/contracts; no real user runtime DB or credentials in artifacts.
- Feature branch only. Conventional commits (feat/fix/test/docs). Parent owns publishing.
- No claimed production or GPU performance from deterministic test providers.
- Do not spawn helper/review agents; controller coordinates reviews.

## Review Focus
- Cancellation and late results cannot corrupt other requests.
- Concurrent duplicates do not create duplicate committed effects.
- Provider/storage failure cannot leave unbounded waits.
- Report/context/version mismatch prevents reuse.
- Existing input/output validation and access boundaries remain active.

### Task 1: Implement and measure the approved behavior

**Files:** frontend/src/api/endpoints.ts; frontend/src/api/summary.ts; new jobs API/helper; frontend/src/components/report/AnalysisDetail.tsx; frontend/src/components/report/ReportSections.tsx; frontend/src/components/response/AiProposalPanel.tsx; tests.

**Interfaces:** Preserve current public contracts; HERMES additionally uses the shared job contract copied into the design before implementation. K-Buddy cache waits for concurrency integration.

- [x] Record baseline suite and reproduce the relevant missing behavior with failing regression tests.
- [x] Implement the smallest reusable units satisfying the spec and adversarial tests.
- [x] Run focused tests during iteration, then the full relevant suite and frontend build/typecheck.
- [x] Run a fixed, reproducible before/after workload, recording parameters, sample counts, provider type, environment, latency distributions and correctness/failure counts in JSON and a concise report.
- [x] Self-review diff and commit implementation/tests/evidence using repository conventions.
- [x] Hand the diff and test evidence to the independent reviewer; fix substantive findings.
