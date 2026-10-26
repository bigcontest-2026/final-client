import { useId } from 'react'
import type { Category, Plan, ReportDocument, ResponseReport } from '../../api/types'
import { formatLongDateTime } from '../../lib/format'
import { CATEGORY_LABELS, CATEGORY_ORDER, PLAN_KIND_LABELS, REVIEW_KEYS, REVIEW_LABELS, REVIEW_STATUS_LABELS, monthLabel, scopeGroupLabel } from '../../lib/labels'
import { LifecycleSection } from '../report/ReportSections'
import hermiDone from '../../assets/hermi/hermi-5.png'
import { Badge } from '../ui'

const EMPTY = '아직 기재하지 않았습니다.'

function startingPoints(report: ResponseReport): string[] {
  const summary = report.analysis_snapshot?.summary
  if (!summary) return []
  return CATEGORY_ORDER.filter((category: Category) => (summary[category] ?? 0) > 0).map((category) => CATEGORY_LABELS[category])
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  const text = value?.trim()
  return (
    <div className="grid grid-cols-1 gap-1 py-2 sm:grid-cols-[150px_1fr] sm:gap-4">
      <dt className="text-subhead text-label-secondary">{label}</dt>
      <dd className={`text-subhead whitespace-pre-wrap ${text ? 'text-label' : 'text-label-secondary'}`}>{text || EMPTY}</dd>
    </div>
  )
}

function PlanSection({ plan, index }: { plan: Plan; index: number }) {
  return (
    <article className="border-t border-separator pt-6">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex gap-3">
          <span className="text-title-3 text-label-secondary tabular-nums">{String(index + 1).padStart(2, '0')}</span>
          <div>
            <div className="text-footnote text-label-secondary">{PLAN_KIND_LABELS[plan.kind]}</div>
            <h4 className="mt-0.5 text-title-3 text-label">{plan.title}</h4>
          </div>
        </div>
        <span className="text-footnote text-label-secondary">저장된 {plan.version}차 수정본</span>
      </div>
      <dl className="mt-3 divide-y divide-separator">
        {plan.program_reference && (
          <Row label="선택한 복지사업" value={[plan.program_reference.title, plan.program_reference.publisher].filter(Boolean).join(' · ')} />
        )}
        <Row label="대상과 범위" value={plan.target} />
        <Row label="분석과 연결한 이유" value={plan.rationale} />
        <Row label="실행 내용" value={plan.content} />
        <Row label="실행 전 확인할 사항" value={plan.checks} />
      </dl>
      <div className="mt-4 rounded-card-sm bg-fill px-5 py-4">
        <div className="text-subhead font-semibold text-label">사업 적용 전 네 가지 검토</div>
        <p className="mt-0.5 text-footnote text-label-secondary">담당자가 입력한 사업 적용 검토 내용입니다.</p>
        <ul className="mt-2 flex flex-col gap-1.5 text-subhead">
          {REVIEW_KEYS.map((key) => {
            const review = plan.policy_review?.[key]
            return (
              <li key={key} className="flex flex-wrap gap-x-2">
                <span className="font-medium text-label">{REVIEW_LABELS[key]}</span>
                <span className="text-label-secondary">{REVIEW_STATUS_LABELS[review?.status ?? 'unconfirmed']}</span>
                {review?.text && <span className="text-label">· {review.text}</span>}
                {review?.evidence && <span className="text-label-secondary">(근거: {review.evidence})</span>}
              </li>
            )
          })}
        </ul>
      </div>
    </article>
  )
}

export function FinalReportView({ report }: { report: ResponseReport }) {
  const points = startingPoints(report)
  const snapshot = report.analysis_snapshot
  if (report.document) return <DocumentView document={report.document} />
  return (
    <div className="mx-auto flex w-full max-w-[860px] flex-col gap-5 py-2">
      <div className="flex items-center gap-4 rounded-card-sm bg-elevated px-5 py-4">
        <img src={hermiDone} alt="" className="size-12" />
        <p className="flex-1 text-subhead text-label">선택한 대응안의 저장된 버전을 묶었습니다. 이후 초안을 수정해도 이 보고서의 내용은 바뀌지 않습니다.</p>
        <Badge tone="green">서버에 저장됨</Badge>
      </div>

      <div className="card px-6 py-8 sm:px-12 sm:py-12">
        <p className="eyebrow">두 번째 산출물 · 검토용 보고서</p>
        <h3 className="mt-2 text-title-1 text-label">{report.title}</h3>
        <dl className="mt-8 grid grid-cols-2 gap-6 border-y border-separator py-6 sm:grid-cols-4">
          <div>
            <dt className="text-footnote text-label-secondary">검토 지역·집단</dt>
            <dd className="mt-1 text-subhead font-medium text-label">
              {report.region_name}
              <br />
              {scopeGroupLabel(report.scope)}
            </dd>
          </div>
          <div>
            <dt className="text-footnote text-label-secondary">관측 기준</dt>
            <dd className="mt-1 text-subhead font-medium text-label">{monthLabel(report.scope.month)}</dd>
          </div>
          <div>
            <dt className="text-footnote text-label-secondary">작성일</dt>
            <dd className="mt-1 text-subhead font-medium text-label">{formatLongDateTime(report.created_at)}</dd>
          </div>
          <div>
            <dt className="text-footnote text-label-secondary">선택한 대응안</dt>
            <dd className="mt-1 text-subhead font-medium text-label">{report.selected_plan_count}개</dd>
          </div>
        </dl>

        <section className="mt-8">
          <h4 className="text-headline text-label">대응안의 출발점</h4>
          <p className="mt-2 text-subhead text-label">{points.length ? points.join(' · ') : '활동 분류 정보가 없습니다.'}</p>
          {report.scope.dong_code && <p className="mt-1 text-footnote text-label-secondary">활동 집계 범위: 상위 시군구</p>}
          <details className="mt-3 text-subhead">
            <summary className="font-semibold text-label">생애주기별 살펴볼 사항</summary>
            <div className="mt-2">
              <LifecycleSection lifecycle={snapshot?.lifecycle_interpretation} />
            </div>
          </details>
        </section>

        <div className="mt-8 flex flex-col gap-8">
          {report.selected_plans.map((plan, index) => (
            <PlanSection key={plan.plan_id} plan={plan} index={index} />
          ))}
        </div>

        {report.limitations.length > 0 && (
          <details className="mt-6 border-t border-separator pt-4 text-footnote text-label-secondary">
            <summary className="cursor-pointer font-semibold">자료·작성 정보</summary>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {report.limitations.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </details>
        )}
      </div>
    </div>
  )
}

function DocumentView({ document }: { document: ReportDocument }) {
  const prefix = useId().replace(/:/g, '')
  const [summary, ...remaining] = document.sections
  const sectionView = (section: ReportDocument['sections'][number], primary = false) => <section key={section.id} id={`${prefix}-${section.id}`} tabIndex={-1} aria-labelledby={`${prefix}-${section.id}-heading`} className={`scroll-mt-5 rounded-card-sm ${primary ? 'bg-accent-tint p-5 sm:p-6' : 'border-t border-separator pt-6'}`}>
    <h4 id={`${prefix}-${section.id}-heading`} className="mb-4 text-title-3 [text-wrap:balance]">{section.title}</h4>
    <div className="flex flex-col gap-4">{section.paragraphs.map((paragraph, i) => {
      const split = paragraph.indexOf(': ')
      return <p key={i} className="whitespace-pre-wrap [overflow-wrap:anywhere]">{primary && split > 0 && split < 20 ? <><strong className="font-semibold">{paragraph.slice(0, split)}</strong>{paragraph.slice(split)}</> : paragraph}</p>
    })}</div>
  </section>
  return <div className="report-document mx-auto w-full max-w-[940px] text-base leading-7 text-label">
    <article className="card overflow-hidden px-5 py-8 sm:px-10 sm:py-10">
      <header>
        <div className="flex flex-wrap items-center justify-between gap-2"><p className="eyebrow">복지 대응계획 · 검토용</p><Badge tone="green">서버에 저장됨</Badge></div>
        <h3 className="mt-3 break-words text-title-2 sm:text-title-1 [text-wrap:balance]">{document.title}</h3>
        <p className="mt-3 whitespace-pre-wrap text-label-secondary">{document.subtitle}</p>
        <dl className="my-5 flex flex-wrap gap-x-5 gap-y-2 border-y border-separator py-3 text-footnote">
          {document.metadata.filter(item => item.label !== '문서 상태').map((item, index) => <div key={`${item.label}-${index}`} className="flex flex-wrap gap-x-2"><dt className="text-label-secondary">{item.label}</dt><dd className="whitespace-pre-wrap break-words">{item.value}</dd></div>)}
        </dl>
      </header>
      {summary && sectionView(summary, true)}
      <nav aria-label="보고서 목차" className="my-7 rounded-card-sm bg-canvas px-5 py-4">
        <p className="text-headline">보고서 목차</p>
        <ol className="mt-2 grid gap-1 sm:grid-cols-2">
          {document.sections.map((section, index) => <li key={section.id}><a className="flex min-h-11 items-center gap-2 rounded-control px-2 text-link hover:bg-accent-tint" href={`#${prefix}-${section.id}`} onClick={event => { event.preventDefault(); const target = window.document.getElementById(`${prefix}-${section.id}`); target?.scrollIntoView({ block: 'start' }); target?.focus({ preventScroll: true }) }}><span className="text-footnote tabular-nums">{String(index + 1).padStart(2, '0')}</span>{section.title}</a></li>)}
        </ol>
      </nav>
      <div className="flex flex-col gap-9">
        {remaining.map(section => sectionView(section))}
      </div>
      {document.metadata.filter(item => item.label === '문서 상태').map(item => <p key={item.label} className="mt-8 border-t border-separator pt-4 text-footnote text-label-secondary">{item.label}: {item.value}</p>)}
    </article>
  </div>
}
