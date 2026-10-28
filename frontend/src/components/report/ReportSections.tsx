import { displayScore, INDEX_SOURCE_NOTE } from '../../lib/indexScale'
import { useEffect } from 'react'
import { SUMMARY_UNAVAILABLE_MESSAGE } from '../../api/summary'
import { shouldSubmitSummary } from '../../lib/jobs/ReportJobController'
import { useReportJob } from '../../lib/jobs/useReportJob'
import { ReportJobStatus } from './ReportJobStatus'
import type { AnalysisReport, ContextInvestigation, LifecycleInterpretation, ReportAssessment, SourceKey } from '../../api/types'
import { formatIndex, formatNumber, formatPercent } from '../../lib/format'
import { CATEGORY_TONE, SOURCE_LABELS, scopeGroupLabel } from '../../lib/labels'
import { Icon } from '../icons'
import { Accordion, Badge, Spinner } from '../ui'

const TONE_DOT = { amber: 'bg-dot-yellow', orange: 'bg-dot-orange', sky: 'bg-accent', slate: 'bg-dot-gray' }

function thresholdText(value: boolean | null | undefined): string {
  if (value === true) return '5% 이상 감소'
  if (value === false) return '기준 미만'
  return '확인할 수 없음'
}

export function AiSummaryPanel({ report }: { report: AnalysisReport }) {
  const task = useReportJob(report.report_id, 'summary')
  useEffect(() => {
    if (shouldSubmitSummary(task, task.restored)) {
      void task.submit({}, report.report_id)
    }
  }, [task.restored, task.busy, task.job, task.error, task.submit, report.report_id])
  const summary = task.result
  const valid = summary?.report_id === report.report_id && typeof summary.text === 'string' && Boolean(summary.text.trim())
  return (
    <section className="rounded-card-sm bg-elevated px-5 py-4">
      <h4 className="flex items-center gap-1.5 text-headline text-label">
        <Icon name="spark" className="size-4 text-link" />
        활동 변화 AI 요약
      </h4>
      <div className="mt-2 text-subhead">
        {task.busy && <Spinner label="요약을 만드는 중" />}
        {valid && <p className="text-label">{summary!.text}</p>}
        {summary && !valid && <p role="alert" className="text-warning">{SUMMARY_UNAVAILABLE_MESSAGE}</p>}
        <ReportJobStatus task={task} />
      </div>
    </section>
  )
}

function SourceRow({ assessment, source }: { assessment: ReportAssessment; source: SourceKey }) {
  const item = assessment.sources[source]
  if (!item) return null
  return (
    <tr className="border-t border-separator tabular-nums">
      <td className="py-1.5 pr-3 font-medium">{SOURCE_LABELS[source]}</td>
      <td className="py-1.5 pr-3">{formatPercent(item.change_percent)}</td>
      <td className="py-1.5 pr-3">{thresholdText(item.threshold_met)}</td>
      <td className="py-1.5 text-label-secondary">{item.previous_change_percent === undefined ? '-' : formatPercent(item.previous_change_percent)}</td>
    </tr>
  )
}

export function AssessmentAccordion({ assessment }: { assessment: ReportAssessment }) {
  const tone = CATEGORY_TONE[assessment.category]
  return (
    <Accordion
      title={<span className="font-medium text-label">{scopeGroupLabel(assessment.scope)}</span>}
      aside={
        <span className="flex items-center gap-1.5 text-subhead font-semibold text-label">
          <span className={`size-2 rounded-full ${TONE_DOT[tone]}`} aria-hidden="true" />
          {assessment.category_label}
        </span>
      }
    >
      <table className="w-full text-left text-subhead">
        <thead className="text-footnote text-label-secondary">
          <tr>
            <th className="pb-1 font-medium">자료</th>
            <th className="pb-1 font-medium">전월 대비</th>
            <th className="pb-1 font-medium">5% 기준</th>
            <th className="pb-1 font-medium">이전 달 변화</th>
          </tr>
        </thead>
        <tbody>
          <SourceRow assessment={assessment} source="skt" />
          <SourceRow assessment={assessment} source="card_a" />
        </tbody>
      </table>
      {assessment.reasons.length > 0 && (
        <ul className="mt-3 list-disc space-y-1 pl-5 text-label-secondary">
          {assessment.reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      )}
      {assessment.historical_reference?.status === 'available' && (
        <p className="mt-2 text-footnote text-label-secondary">과거 카드 참고(C3)는 카드와 같은 원천이라 독립 근거로 세지 않습니다.</p>
      )}
    </Accordion>
  )
}

export function LifecycleSection({ lifecycle }: { lifecycle: LifecycleInterpretation | null | undefined }) {
  const groups = lifecycle?.groups ?? []
  if (!groups.length) return <p className="text-label-secondary">이 분석에 연결된 생애주기 해석 자료가 없습니다.</p>
  const source = lifecycle?.source
  return (
    <div className="flex flex-col gap-4">
      <p className="text-label-secondary">문헌을 참고해 만든 확인 질문입니다. 실제 생애사건·고립·외로움·지원 필요는 확인되지 않았습니다.</p>
      {groups.map((group) => (
        <div key={`${group.scope.sex_code}-${group.scope.age_code}`} className="rounded-card-sm bg-fill px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-label">{scopeGroupLabel(group.scope)}</span>
            <Badge tone="amber">가설</Badge>
            <Badge>지원 필요 미확인</Badge>
          </div>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {group.hypotheses.map((hypothesis) => (
              <li key={hypothesis.id}>{hypothesis.text}</li>
            ))}
          </ul>
          {group.questions.length > 0 && (
            <>
              <div className="mt-3 text-footnote font-semibold text-label-secondary">확인 질문</div>
              <ul className="mt-1 list-disc space-y-1 pl-5">
                {group.questions.map((question) => (
                  <li key={question}>{question}</li>
                ))}
              </ul>
            </>
          )}
          {group.boundaries.length > 0 && (
            <details className="mt-2 text-footnote text-label-secondary">
              <summary>해석 범위와 한계</summary>
              <ul className="mt-1 list-disc space-y-1 pl-5">
                {group.boundaries.map((boundary) => (
                  <li key={boundary}>{boundary}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      ))}
      {source && (
        <p className="text-footnote text-label-secondary">
          문헌: {source.authors?.join('·')} ({source.year}), 『{source.title}』{source.publisher ? `, ${source.publisher}` : ''}
        </p>
      )}
    </div>
  )
}

const DOMAIN_LABELS: Record<string, string> = { E: '경제', P: '참여', O: '외출', C: '교류', U: '지원 관계' }

export function RegionBackground({ report }: { report: AnalysisReport }) {
  const i5 = report.context.i5?.record
  const mois = report.context.mois?.record
  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="font-semibold text-label">I5 표시점수 {formatIndex(displayScore(i5)) || '자료 없음'}{displayScore(i5) !== null ? '/10' : ''}</div>
        {i5 ? (
          <>
            <p className="mt-1 text-footnote text-label-secondary">{INDEX_SOURCE_NOTE}. 지역에서 직접 조사한 값·고립률·위험등급이 아닙니다.</p>
            {i5.domain_scores && (
              <div className="mt-2 flex flex-wrap gap-2" aria-label="영역별 참고점수 (0~100점)">
                <span className="w-full text-footnote text-label-secondary">영역별 참고점수 (0~100점)</span>
                {Object.entries(i5.domain_scores).map(([key, value]) => (
                  <span key={key} className="rounded-full bg-fill px-2.5 py-1 text-footnote tabular-nums">
                    {DOMAIN_LABELS[key] ?? key} {formatIndex(value)}/100
                  </span>
                ))}
              </div>
            )}
          </>
        ) : (
          <p className="mt-1 text-label-secondary">I5 자료가 없습니다.</p>
        )}
      </div>
      <div>
        <div className="font-semibold text-label">주민등록 인구·세대 배경{report.scope.dong_code ? ' (상위 시군구)' : ''}</div>
        {mois ? (
          <dl className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-4">
            <dt className="text-label-secondary">전체 인구</dt>
            <dd>{formatNumber(mois.population_total)}명</dd>
            <dt className="text-label-secondary">20세 이상</dt>
            <dd>{formatNumber(mois.population_20plus)}명</dd>
            <dt className="text-label-secondary">전체 세대</dt>
            <dd>{formatNumber(mois.households_total)}세대</dd>
            <dt className="text-label-secondary">1인 세대 비율</dt>
            <dd>{mois.one_person_household_share ? `${(Number(mois.one_person_household_share) * 100).toFixed(1)}%` : '-'}</dd>
          </dl>
        ) : (
          <p className="mt-1 text-label-secondary">인구 배경 자료가 없습니다.</p>
        )}
        <p className="mt-2 text-footnote text-label-secondary">배경 자료는 점수에 더하거나 독립 근거로 세지 않습니다.</p>
      </div>
    </div>
  )
}

const GEOGRAPHY_LABELS: Record<string, string> = { same_region: '같은 지역', broader_region: '더 넓은 지역', other_region: '다른 지역', unverified: '지역 미확인' }
const PERIOD_LABELS: Record<string, string> = { same_period: '같은 기간', broader_or_other_period: '다른 기간', unverified: '기간 미확인' }

export function InvestigationResult({ investigation }: { investigation: ContextInvestigation }) {
  const sources = new Map((investigation.sources ?? []).map((source, index) => [source.source_id, index + 1]))
  const refs = (ids: string[]) => ids.map((id) => sources.get(id)).filter(Boolean).map((n) => `[${n}]`).join('')
  return (
    <section className="flex flex-col gap-4 rounded-card-sm bg-elevated px-5 py-4 text-subhead">
      <div className="flex items-center gap-2">
        <h4 className="text-headline text-label">지역 맥락·원인 조사</h4>
        {investigation.status === 'no_evidence' && <Badge>추가 자료 없음</Badge>}
      </div>
      {investigation.summary && <p>{investigation.summary}</p>}
      {!!investigation.observed_context?.length && (
        <div>
          <div className="font-semibold">지역에서 살펴본 내용</div>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            {investigation.observed_context.map((item) => (
              <li key={item.text}>
                {item.text} <span className="text-footnote text-label-secondary">{refs(item.source_ids)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {!!investigation.possible_causes?.length && (
        <div>
          <div className="flex items-center gap-2 font-semibold">
            가능한 배경
          </div>
          <ul className="mt-2 flex flex-col gap-2">
            {investigation.possible_causes.map((cause) => (
              <li key={cause.title} className="rounded-control bg-fill px-3 py-2.5">
                <div className="font-medium">
                  {cause.title} <span className="text-footnote text-label-secondary">{refs(cause.source_ids)}</span>
                </div>
                <p className="mt-1 text-label-secondary">{cause.explanation}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
      {!!investigation.verification_questions?.length && (
        <div>
          <div className="font-semibold">추가로 확인할 질문</div>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            {investigation.verification_questions.map((question) => (
              <li key={question}>{question}</li>
            ))}
          </ul>
        </div>
      )}
      {!!investigation.sources?.length && (
        <div>
          <div className="font-semibold">출처</div>
          <ol className="mt-1 flex flex-col gap-1.5">
            {investigation.sources.map((source, index) => (
              <li key={source.source_id} className="text-footnote text-label-secondary">
                [{index + 1}]{' '}
                <a href={source.url} target="_blank" rel="noreferrer noopener" className="text-link underline-offset-2 hover:underline">
                  {source.title}
                </a>
                {source.publisher ? ` · ${source.publisher}` : ''} · {GEOGRAPHY_LABELS[source.geography_relation ?? 'unverified'] ?? source.geography_relation} ·{' '}
                {PERIOD_LABELS[source.period_relation ?? 'unverified'] ?? source.period_relation}
                {source.supporting_excerpt && <div className="mt-0.5 text-label-secondary">“{source.supporting_excerpt}”</div>}
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  )
}
