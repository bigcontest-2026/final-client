import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { errorMessage } from '../api/client'
import { api } from '../api/endpoints'
import type { AgeCode, BehaviorRecord, Category, I5Record } from '../api/types'
import hermiScout from '../assets/hermi/hermi-2.png'
import { KoreaMap } from '../components/dashboard/KoreaMap'
import { Icon } from '../components/icons'
import { Accordion, Badge, Button, ErrorBox, Field, PageHeader, Select, Spinner, TextInput, Thinking } from '../components/ui'
import { formatIndex, formatNumber, formatPercent } from '../lib/format'
import { INDEX_BINS, INDEX_NAME, INDEX_SOURCE_NOTE, NO_VALUE_FILL, fillFor, displayScore, provinceDisplayScore } from '../lib/indexScale'
import { AGE_CODES, AGE_LABELS, CATEGORY_ORDER, CATEGORY_TONE, SEX_LABELS, ageLabel, monthLabel } from '../lib/labels'
import { latestMonth, loadDongs, useHealth, useRegionCatalog } from '../lib/regions'
import { useApi } from '../lib/useApi'
import { writeJson } from '../lib/storage'
import { addHistory } from '../state/history'
import { useModals } from '../state/modals'
import { LAST_DONG_KEY } from './MainPage'

const LIST_STEP = 150

const DETAIL_SHELL = 'flex flex-col gap-6 border-t border-separator p-6 sm:p-8 @3xl:border-t-0 @3xl:border-l'

const QUICK_REGIONS = [
  { province: '11', region: '11680', label: '강남구', provinceName: '서울특별시' },
  { province: '51', region: '51110', label: '춘천시', provinceName: '강원특별자치도' },
]

function dongMatches(dong: I5Record, provinceName: string, tokens: string[]): boolean {
  if (!tokens.length) return true
  const haystack = `${provinceName} ${dong.region_name} ${dong.area_name}`
  return tokens.every((token) => haystack.includes(token))
}

export function DashboardPage() {
  const [params, setParams] = useSearchParams()
  const { health } = useHealth()
  const { catalog } = useRegionCatalog()
  const months = health?.months ?? catalog?.months ?? []
  const month = params.get('month') && months.includes(params.get('month')!) ? params.get('month')! : latestMonth(months)
  const ageCode = (AGE_CODES as string[]).includes(params.get('age') ?? '') ? (params.get('age') as AgeCode) : '20G'
  const selectedCode = params.get('dong')
  const [search, setSearch] = useState('')
  const [mapProvince, setMapProvince] = useState<string | null>(null)
  const [limit, setLimit] = useState(LIST_STEP)

  const update = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params)
    for (const [key, value] of Object.entries(patch)) {
      if (value) next.set(key, value)
      else next.delete(key)
    }
    setParams(next, { replace: true })
  }

  const dongsQuery = useApi(month ? () => loadDongs({ month }) : null, [month])
  const behaviorQuery = useApi(month ? (signal) => api.behavior({ month, age_code: ageCode, limit: 100 }, signal) : null, [month, ageCode])
  const dongs = dongsQuery.data ?? []
  const behaviorRecords = behaviorQuery.data?.records ?? []

  const selected = useMemo(() => dongs.find((dong) => dong.dong_code === selectedCode) ?? null, [dongs, selectedCode])

  useEffect(() => {
    if (selected) setMapProvince(selected.region_code.slice(0, 2))
  }, [selected])

  const provinceName = (code: string) => catalog?.provinceName(code.slice(0, 2)) ?? ''
  const tokens = search.trim().split(/\s+/).filter(Boolean)
  const filtered = useMemo(() => dongs.filter((dong) => dongMatches(dong, catalog?.provinceName(dong.region_code.slice(0, 2)) ?? '', tokens)), [dongs, catalog, search])

  useEffect(() => setLimit(LIST_STEP), [search, month])

  const dongValues = useMemo(() => new Map(dongs.map((dong) => [dong.dong_code ?? '', displayScore(dong)])), [dongs])
  const sidoValues = useMemo(() => {
    const groups = new Map<string, I5Record[]>()
    for (const dong of dongs) {
      const code = dong.region_code.slice(0, 2)
      groups.set(code, [...(groups.get(code) ?? []), dong])
    }
    return new Map([...groups.entries()].map(([code, items]) => [code, provinceDisplayScore(items)]))
  }, [dongs])

  const activityRegions = new Set(behaviorRecords.map((record) => record.behavior.key.region_code))
  const jointCount = behaviorRecords.filter((record) => record.activity_assessment.signals.joint_decline === true).length

  const selectDong = (code: string) => {
    update({ dong: code })
    const dong = dongs.find((item) => item.dong_code === code)
    if (dong) writeJson(LAST_DONG_KEY, { code, name: dong.area_name })
  }

  return (
    <div className="mx-auto flex max-w-[1240px] flex-col gap-block px-gutter pt-12 pb-section sm:pt-16">
      <PageHeader
        eyebrow="지역 살펴보기"
        title="행정동 대시보드"
        description="지역 고립 지수는 지역 전체값입니다. 연령을 골라 활동 변화를 살펴보세요."
        aside={
          <div className="flex gap-3">
            <Field label="자료 기준월">
              {(id) => (
                <Select id={id} className="w-40" value={month ?? ''} onChange={(event) => update({ month: event.target.value })}>
                  {[...months].sort().reverse().map((value) => (
                    <option key={value} value={value}>
                      {monthLabel(value)}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="활동 연령">
              {(id) => (
                <Select id={id} className="w-36" value={ageCode} onChange={(event) => update({ age: event.target.value })}>
                  {AGE_CODES.map((code) => (
                    <option key={code} value={code}>
                      {AGE_LABELS[code]}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>
        }
      />

      <dl className="reveal card grid divide-y divide-separator sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <Stat title="조회 행정동" value={dongsQuery.loading ? null : dongs.length} unit="개" note={`${monthLabel(month)} · 읍·면·출장소 포함`} />
        <Stat title="상위 시군구 활동 자료" value={behaviorQuery.loading ? null : activityRegions.size} unit="개 지역" note="통신·카드의 실제 관측 단위" />
        <Stat title="상위 시군구 동시 감소" value={behaviorQuery.loading ? null : jointCount} unit="집단" note="시군구 관측집단 · 동별 합산 없음" />
      </dl>
      {(dongsQuery.error || behaviorQuery.error) && (
        <ErrorBox message={dongsQuery.error ?? behaviorQuery.error ?? ''} onRetry={() => (dongsQuery.error ? dongsQuery.reload() : behaviorQuery.reload())} />
      )}

      <div className="reveal grid gap-6 xl:grid-cols-[300px_minmax(0,1fr)]">
        <section className="card flex max-h-[460px] flex-col overflow-hidden xl:sticky xl:top-20 xl:max-h-[calc(100dvh-6rem)]">
          <div className="border-b border-separator p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-headline text-label">행정동 목록</h2>
              <span className="text-footnote text-label-secondary tabular-nums">{formatNumber(filtered.length)}개</span>
            </div>
            <div className="relative mt-3">
              <Icon name="search" className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-label-secondary" />
              <TextInput value={search} onChange={(event) => setSearch(event.target.value)} placeholder="예: 춘천시 강남동" aria-label="행정동 검색" className="pr-10 pl-10" />
              {search && (
                <button type="button" onClick={() => setSearch('')} aria-label="검색어 지우기" className="absolute top-1/2 right-1.5 flex size-8 -translate-y-1/2 items-center justify-center rounded-full text-label-secondary hover:bg-fill">
                  <Icon name="close" className="size-3.5" />
                </button>
              )}
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {dongsQuery.loading && (
              <div className="p-3">
                <Spinner label="행정동을 불러오는 중" />
              </div>
            )}
            <ul className="flex flex-col gap-0.5">
              {filtered.slice(0, limit).map((dong) => {
                const active = dong.dong_code === selectedCode
                return (
                  <li key={dong.dong_code}>
                    <button
                      type="button"
                      onClick={() => dong.dong_code && selectDong(dong.dong_code)}
                      aria-current={active}
                      className={`flex w-full items-center justify-between gap-2 rounded-control px-3 py-2.5 text-left transition-quick ${active ? 'bg-accent-tint' : 'hover:bg-fill'}`}
                    >
                      <span className="min-w-0">
                        <span className="block text-subhead font-medium text-label">{dong.area_name}</span>
                        <span className="block truncate text-footnote text-label-secondary">
                          {provinceName(dong.region_code)} {dong.region_name}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-1.5" title={INDEX_NAME}>
                        <span className="size-2.5 rounded-full" style={{ background: fillFor(displayScore(dong)) }} aria-hidden="true" />
                        <span className="text-subhead font-semibold text-label tabular-nums">{formatIndex(displayScore(dong)) || '자료 없음'}</span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
            {filtered.length > limit && (
              <Button size="sm" variant="ghost" className="mt-2 w-full" onClick={() => setLimit((value) => value + LIST_STEP)}>
                더 보기 ({limit}/{filtered.length})
              </Button>
            )}
          </div>
        </section>

        <section className="card @container overflow-hidden">
          <div className="grid @3xl:grid-cols-[minmax(0,1fr)_340px]">
            <div className="flex min-w-0 flex-col gap-5 p-6 sm:p-8">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-headline text-label">전국 지도</h2>
                  <nav className="mt-1 flex items-center gap-1 text-subhead" aria-label="지도 위치">
                    <button type="button" onClick={() => setMapProvince(null)} className={`font-medium ${mapProvince ? 'text-link hover:underline' : 'text-label'}`}>
                      전국
                    </button>
                    {mapProvince && (
                      <>
                        <Icon name="chevronRight" className="size-3.5 text-label-secondary" />
                        <span className="font-medium text-label">{catalog?.provinceName(mapProvince)}</span>
                      </>
                    )}
                  </nav>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-footnote text-label-secondary">바로 보기</span>
                  {QUICK_REGIONS.map((item) => (
                    <button
                      key={item.region}
                      type="button"
                      onClick={() => {
                        setMapProvince(item.province)
                        setSearch(`${item.label}`)
                      }}
                      title={item.provinceName}
                      className="inline-flex min-h-8 items-center gap-1 rounded-full bg-fill px-3 py-1 text-footnote font-medium text-label transition-quick hover:bg-fill-strong"
                    >
                      <Icon name="pin" className="size-3.5 text-link" />
                      {item.label} 행정동
                    </button>
                  ))}
                </div>
              </div>
              <p className="-mt-2 text-footnote text-label-secondary">시도를 누르거나 지역 바로 보기를 선택하세요.</p>
              <div className="rounded-card-sm bg-canvas p-3">
                <KoreaMap
                  provinceCode={mapProvince}
                  sidoValues={sidoValues}
                  dongValues={dongValues}
                  selectedDong={selectedCode}
                  onSelectProvince={setMapProvince}
                  onSelectDong={selectDong}
                />
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-footnote text-label">
                  <span className="font-semibold text-label">{INDEX_NAME}</span>
                  {INDEX_BINS.map((bin) => (
                    <span key={bin.label} className="flex items-center gap-1.5 tabular-nums">
                      <span className="inline-block h-2.5 w-5 rounded-sm" style={{ background: bin.fill }} />
                      {bin.label}
                    </span>
                  ))}
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block h-2.5 w-5 rounded-sm" style={{ background: NO_VALUE_FILL }} />
                    값 없음
                  </span>
                </div>
                <p className="text-caption text-label-secondary">
                  {mapProvince ? '행정동' : '시도(행정동 성인 인구 가중 집계)'} · {INDEX_SOURCE_NOTE}
                </p>
                <p className="text-caption text-label-secondary">
                  경계: 통계청 SGIS /{' '}
                  <a href="https://github.com/vuski/admdongkor" target="_blank" rel="noreferrer noopener" className="text-link hover:underline">
                    vuski/admdongkor
                  </a>{' '}
                  · 2025년 7월 · 단순화 ·{' '}
                  <a href="https://creativecommons.org/licenses/by/4.0/deed.ko" target="_blank" rel="noreferrer noopener" className="text-link hover:underline">
                    CC BY 4.0
                  </a>
                </p>
              </div>
            </div>
            <DongDetail dong={selected} month={month} ageCode={ageCode} provinceName={selected ? provinceName(selected.region_code) : ''} records={behaviorRecords} loading={behaviorQuery.loading} />
          </div>
        </section>
      </div>

      <Accordion title="행정동 자료는 어떻게 표시하나요?">
        <ul className="list-disc space-y-2 pl-5">
          <li>{INDEX_NAME}는 I5의 0~10 표시점수입니다. 전국 설문과 지역 인구구성으로 계산한 참고값을 2025년 12월 시군구 기준으로 변환했습니다. 5점은 기준 평균이며, 지역 직접 조사값·고립률·위험등급이 아닙니다.</li>
          <li>통신·카드 활동 자료는 시군구 단위로만 있습니다. 동을 골라도 상위 시군구의 값을 참고로 보여 주며, 동별로 나누거나 더하지 않습니다.</li>
          <li>5% 감소 분류는 검토 순서를 정하는 표시일 뿐입니다. 고립 판정이나 경보가 아닙니다.</li>
          <li>활동 자료는 지금 서울 강남구와 춘천시만 연결되어 있습니다. 다른 지역은 활동 참고가 비어 있는 것이 정상입니다.</li>
        </ul>
      </Accordion>
    </div>
  )
}

function Stat({ title, value, unit, note }: { title: string; value: number | null; unit: string; note: string }) {
  return (
    <div className="px-7 py-6">
      <dt className="text-subhead text-label-secondary">{title}</dt>
      <dd className="mt-1 flex items-baseline gap-1">
        <span className="text-title-1 text-label tabular-nums">{value === null ? '–' : formatNumber(value)}</span>
        <span className="text-subhead text-label-secondary">{unit}</span>
      </dd>
      <dd className="mt-0.5 text-footnote text-label-secondary">{note}</dd>
    </div>
  )
}

function mostNotable(records: BehaviorRecord[]): Category | null {
  for (const category of CATEGORY_ORDER) {
    if (records.some((record) => record.activity_assessment.category === category)) return category
  }
  return null
}

function DongDetail({
  dong,
  month,
  ageCode,
  provinceName,
  records,
  loading,
}: {
  dong: I5Record | null
  month: string | null
  ageCode: AgeCode
  provinceName: string
  records: BehaviorRecord[]
  loading: boolean
}) {
  const navigate = useNavigate()
  const { open } = useModals()
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => setError(null), [dong?.dong_code])

  if (!dong) {
    return (
      <section className={DETAIL_SHELL}>
        <p className="eyebrow">행정동 상세</p>
        <h2 className="text-title-2 text-label">행정동을 선택해 주세요</h2>
        <p className="text-subhead text-label-secondary">지도나 목록에서 동을 누르면 해당 동의 지역 고립 지수·인구구성과 상위 시군구 활동을 함께 확인할 수 있어요.</p>
        <img src={hermiScout} alt="" className="mx-auto mt-4 size-32" />
      </section>
    )
  }

  const regionRecords = records.filter((record) => record.behavior.key.region_code === dong.region_code)
  const notable = mostNotable(regionRecords)
  const notableCount = notable ? regionRecords.filter((record) => record.activity_assessment.category === notable).length : 0
  const toneClass = notable ? { amber: 'bg-dot-yellow', orange: 'bg-dot-orange', sky: 'bg-accent', slate: 'bg-dot-gray' }[CATEGORY_TONE[notable]] : ''

  const analyze = async () => {
    if (!month || !dong.dong_code) return
    setRunning(true)
    setError(null)
    try {
      const report = await api.createAnalysisReport({ region_code: dong.region_code, dong_code: dong.dong_code, month, age_code: ageCode })
      addHistory({
        source: 'dashboard',
        question: `${dong.region_name} ${dong.area_name} 분석`,
        regionLabel: `${provinceName} ${dong.region_name} ${dong.area_name}`,
        scopeLabel: `${monthLabel(month)} · 전체 성별 · ${ageLabel(ageCode)}`,
        reportId: report.report_id,
      })
      open({ type: 'savedReports', reportId: report.report_id })
    } catch (reason) {
      setError(errorMessage(reason))
    } finally {
      setRunning(false)
    }
  }

  return (
    <section className={DETAIL_SHELL}>
      <div>
        <p className="eyebrow">
          {provinceName} {dong.region_name}
        </p>
        <h2 className="mt-1 text-title-2 text-label">{dong.area_name}</h2>
      </div>
      <div className="rounded-card-sm bg-fill p-5">
        <div className="text-footnote text-label-secondary">{INDEX_NAME}</div>
        <div className="mt-1 flex items-center gap-2">
          <span className="size-3 rounded-full" style={{ background: fillFor(displayScore(dong)) }} aria-hidden="true" />
          <span className="text-title-1 text-label tabular-nums">{formatIndex(displayScore(dong)) || '자료 없음'}</span>
        </div>
        <p className="mt-1 text-footnote text-label-secondary">2025년 12월 시군구 기준 상대점수입니다. 5점은 기준 평균입니다.</p>
        <dl className="mt-3 grid grid-cols-2 gap-3 border-t border-separator pt-3 text-subhead">
          <div>
            <dt className="text-footnote text-label-secondary">전체 인구</dt>
            <dd className="mt-0.5 text-headline text-label tabular-nums">{formatNumber(dong.population_total)}명</dd>
          </div>
          <div>
            <dt className="text-footnote text-label-secondary">20세 이상 인구</dt>
            <dd className="mt-0.5 text-headline text-label tabular-nums">{formatNumber(dong.population_20plus)}명</dd>
          </div>
        </dl>
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-headline text-label">{dong.region_name} 활동 참고</h3>
        <p className="text-footnote text-label-secondary">
          {ageLabel(ageCode)} · 전체 성별 · 통신·카드 자료는 상위 시군구 단위로 제공됩니다.
        </p>
        {loading ? (
          <Spinner />
        ) : !regionRecords.length ? (
          <p className="rounded-card-sm bg-fill px-4 py-3 text-subhead text-label">이 시군구는 {monthLabel(month)} 통신·카드 활동 자료가 없습니다.</p>
        ) : (
          <>
            <div className="flex items-center gap-2">
              {notable && (
                <span className="inline-flex items-center gap-2 rounded-full bg-fill px-3 py-1 text-subhead font-semibold text-label">
                  <span className={`size-2 rounded-full ${toneClass}`} aria-hidden="true" />
                  {regionRecords.find((record) => record.activity_assessment.category === notable)?.activity_assessment.category_label}
                </span>
              )}
              <span className="text-footnote text-label-secondary">
                해당 {notableCount}/{regionRecords.length} 수록집단
              </span>
            </div>
            <ul className="flex flex-col gap-2">
              {regionRecords.map((record) => {
                const assessment = record.activity_assessment
                return (
                  <li key={record.behavior.record_id} className="rounded-card-sm bg-fill px-4 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-subhead font-semibold text-label">
                        {record.behavior.region_name} · {SEX_LABELS[record.behavior.key.sex_code]} {AGE_LABELS[record.behavior.key.age_code]}
                      </span>
                      <Badge tone={CATEGORY_TONE[assessment.category]}>{assessment.category_label}</Badge>
                    </div>
                    <p className="mt-1 text-subhead text-label tabular-nums">
                      통신 {formatPercent(assessment.sources.skt?.change_percent)} · 카드 {formatPercent(assessment.sources.card_a?.change_percent)}
                    </p>
                    <ul className="mt-1 list-disc space-y-0.5 pl-5 text-footnote leading-5 text-label-secondary">
                      {assessment.reasons.map((reason) => (
                        <li key={reason}>{reason}</li>
                      ))}
                    </ul>
                  </li>
                )
              })}
            </ul>
            <p className="text-footnote text-label-secondary">이 범주를 선택한 행정동의 판정으로 적용하지 않습니다. 연구용 검토 분류입니다.</p>
          </>
        )}
      </div>

      <div className="mt-auto flex flex-col gap-2 border-t border-separator pt-4">
        <Button variant="primary" size="lg" onClick={analyze} disabled={running || !month}>
          헤르미와 이 행정동 분석하기
        </Button>
        <Button onClick={() => navigate(`/welfare?dong=${dong.dong_code}`)}>이 행정동의 복지 보기</Button>
        <Button onClick={() => open({ type: 'savedReports', filter: { dong_code: dong.dong_code ?? undefined, label: dong.area_name } })}>이 행정동의 보고서 보기</Button>
      </div>
      {running && <Thinking label="헤르미가 이 행정동의 현황 보고서를 만들고 있어요." />}
      {error && <ErrorBox message={error} onRetry={analyze} />}
    </section>
  )
}
