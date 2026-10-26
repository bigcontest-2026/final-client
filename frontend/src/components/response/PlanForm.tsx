import type { PlanKind, ReviewEntry, ReviewKey, ReviewStatus } from '../../api/types'
import { PLAN_KINDS, PLAN_KIND_LABELS, REVIEW_KEYS, REVIEW_LABELS, REVIEW_STATUS_LABELS } from '../../lib/labels'
import { EMPTY_REVIEW, type DraftPlan } from '../../lib/plans'
import { Accordion, Button, Field, Select, TextArea, TextInput } from '../ui'
import { PlanningForm } from './PlanningForm'

const REVIEW_TONE: Record<ReviewStatus, string> = {
  unconfirmed: 'bg-fill text-label-secondary',
  confirmed: 'bg-success-tint text-success',
  not_applicable: 'bg-fill text-label-secondary',
}

export function PlanForm({
  plan,
  onChange,
  onRemove,
}: {
  plan: DraftPlan
  onChange: (patch: Partial<DraftPlan>) => void
  onRemove?: () => void
}) {
  const reference = plan.program_reference
  const updateReview = (key: ReviewKey, patch: Partial<ReviewEntry>) => {
    const current = plan.policy_review?.[key] ?? EMPTY_REVIEW
    onChange({ policy_review: { ...plan.policy_review, [key]: { ...current, ...patch } } })
  }

  return (
    <section className="flex flex-col gap-6 rounded-card bg-elevated p-6 sm:p-8">
      <div className="flex items-end justify-between gap-3 border-b border-separator pb-4">
        <div>
          <p className="eyebrow">{PLAN_KIND_LABELS[plan.kind]}</p>
          <h3 className="mt-1 text-title-3 text-label">대응안 다듬기</h3>
        </div>
        <div className="flex items-center gap-3 text-footnote text-label-secondary">
          <span>{plan.version ? `저장본 ${plan.version}차` : '새 대응안 · 저장 전'}</span>
          {onRemove && (
            <Button size="sm" variant="danger" onClick={onRemove}>
              이 새 대응안 빼기
            </Button>
          )}
        </div>
      </div>

      {reference && (
        <div className="rounded-card-sm bg-accent-tint px-5 py-4">
          <div className="text-footnote text-label-secondary">선택한 복지사업</div>
          {reference.url ? (
            <a href={reference.url} target="_blank" rel="noreferrer noopener" className="mt-1 inline-block text-headline text-link underline-offset-2 hover:underline">
              {reference.title}
            </a>
          ) : (
            <div className="mt-1 text-headline text-label">{reference.title}</div>
          )}
          <p className="mt-1 text-footnote text-label-secondary">
            {reference.publisher ? `${reference.publisher} · ` : ''}적용 대상과 현재 접수 여부는 별도 확인해 주세요.
          </p>
        </div>
      )}

      <div className="flex flex-col gap-5">
      <h4 className="text-headline text-label">기본 내용</h4>
      <Field label="대응안 이름" required>
        {(id) => <TextInput id={id} value={plan.title} maxLength={200} onChange={(event) => onChange({ title: event.target.value })} />}
      </Field>
      <Field label="대응안 유형">
        {(id) => (
          <Select id={id} value={plan.kind} onChange={(event) => onChange({ kind: event.target.value as PlanKind })}>
            {PLAN_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {PLAN_KIND_LABELS[kind]}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <div className="grid gap-5 md:grid-cols-2">
        <Field label="대상과 범위" required>
          {(id) => <TextArea id={id} rows={3} maxLength={2000} value={plan.target} onChange={(event) => onChange({ target: event.target.value })} />}
        </Field>
        <Field label="분석과 연결한 이유">
          {(id) => <TextArea id={id} rows={3} maxLength={4000} value={plan.rationale} onChange={(event) => onChange({ rationale: event.target.value })} />}
        </Field>
      </div>
      <Field label="실행 내용" required>
        {(id) => <TextArea id={id} rows={5} maxLength={8000} value={plan.content} onChange={(event) => onChange({ content: event.target.value })} />}
      </Field>
      <Field label="실행 전 확인할 사항">
        {(id) => <TextArea id={id} rows={3} maxLength={4000} value={plan.checks} onChange={(event) => onChange({ checks: event.target.value })} />}
      </Field>
      </div>

      <PlanningForm kind={plan.kind} details={plan.planning_details} onChange={planning_details => onChange({ planning_details })} />

      <div className="flex flex-col gap-3 rounded-card-sm bg-fill p-5">
        <h4 className="text-headline text-label">사업 적용 전 네 가지 검토</h4>
        <p className="text-footnote text-label-secondary">확인 상태와 근거는 사용자가 직접 입력한 기록입니다. 시스템의 검증이나 개인 지원 자격 확정이 아닙니다.</p>
        {REVIEW_KEYS.map((key) => {
          const review = plan.policy_review?.[key] ?? EMPTY_REVIEW
          return (
            <Accordion key={key} title={REVIEW_LABELS[key]} aside={<span className={`rounded-full px-2 py-0.5 text-footnote font-medium ${REVIEW_TONE[review.status]}`}>{REVIEW_STATUS_LABELS[review.status]}</span>}>
              <div className="flex flex-col gap-3">
                <Field label="확인 상태">
                  {(id) => (
                    <Select id={id} value={review.status} onChange={(event) => updateReview(key, { status: event.target.value as ReviewStatus })}>
                      {(Object.keys(REVIEW_STATUS_LABELS) as ReviewStatus[]).map((status) => (
                        <option key={status} value={status}>
                          {REVIEW_STATUS_LABELS[status]}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
                <Field label="확인 내용" required={review.status === 'confirmed'}>
                  {(id) => <TextArea id={id} rows={2} value={review.text} onChange={(event) => updateReview(key, { text: event.target.value })} />}
                </Field>
                <Field label="근거" required={review.status === 'confirmed'} hint="예: 사업 공고문 3쪽, 담당 부서 통화 기록">
                  {(id) => <TextArea id={id} rows={2} value={review.evidence} onChange={(event) => updateReview(key, { evidence: event.target.value })} />}
                </Field>
              </div>
            </Accordion>
          )
        })}
      </div>
    </section>
  )
}
