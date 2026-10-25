import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { errorMessage, isAbort } from '../api/client'
import { api } from '../api/endpoints'
import type { I5Record, WelfareCatalog, WelfareProgram } from '../api/types'
import { Icon } from '../components/icons'
import { Badge, Button, ErrorBox, Field, Notice, PageHeader, Select, Spinner, SyntheticBadge, TextInput } from '../components/ui'
import { formatNumber } from '../lib/format'
import { latestMonth, loadDongs, selectableRegions, useHealth, useRegionCatalog } from '../lib/regions'
import { useModals } from '../state/modals'

const PAGE_SIZE = 12

interface Filters {
  provinceCode: string
  regionCode: string
  dongCode: string
  q: string
  categoryId: string
  status: string
}

const EMPTY_FILTERS: Filters = { provinceCode: '', regionCode: '', dongCode: '', q: '', categoryId: '', status: '' }

function regionQuery(filters: Filters): { region_level?: string; region_code?: string } {
  if (filters.dongCode) return { region_level: 'administrative_dong', region_code: filters.dongCode }
  if (filters.regionCode) return { region_level: 'sgg', region_code: filters.regionCode }
  if (filters.provinceCode) return { region_level: 'sido', region_code: filters.provinceCode }
  return {}
}

export function WelfarePage() {
  const [params] = useSearchParams()
  const { catalog } = useRegionCatalog()
  const { health } = useHealth()
  const month = latestMonth(health?.months ?? catalog?.months)
  const [form, setForm] = useState<Filters>(EMPTY_FILTERS)
  const [applied, setApplied] = useState<Filters | null>(null)
  const [offset, setOffset] = useState(0)
  const [result, setResult] = useState<WelfareCatalog | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [dongOptions, setDongOptions] = useState<I5Record[]>([])
  const [attempt, setAttempt] = useState(0)
  const [added, setAdded] = useState<Set<string>>(new Set())
  const { open } = useModals()

  useEffect(() => {
    if (applied) return
    const dong = params.get('dong')
    if (dong && /^\d{10}$/.test(dong)) {
      const next = { ...EMPTY_FILTERS, provinceCode: dong.slice(0, 2), regionCode: dong.slice(0, 5), dongCode: dong }
      setForm(next)
      setApplied(next)
    } else {
      setApplied(EMPTY_FILTERS)
    }
  }, [params, applied])

  useEffect(() => {
    setDongOptions([])
    if (!form.regionCode || !month) return
    let alive = true
    loadDongs({ region_code: form.regionCode, month })
      .then((records) => alive && setDongOptions([...records].sort((a, b) => a.area_name.localeCompare(b.area_name, 'ko'))))
      .catch(() => alive && setDongOptions([]))
    return () => {
      alive = false
    }
  }, [form.regionCode, month])

  useEffect(() => {
    if (!applied) return
    const controller = new AbortController()
    setLoading(true)
    setError(null)
    api
      .welfareCatalog(
        {
          q: applied.q.trim() || undefined,
          category_id: applied.categoryId || undefined,
          status: applied.status || undefined,
          ...regionQuery(applied),
          offset,
          limit: PAGE_SIZE,
        },
        controller.signal,
      )
      .then((response) => {
        setResult(response)
        setSelectedId((current) => (response.programs.some((program) => program.version_id === current) ? current : (response.programs[0]?.version_id ?? null)))
      })
      .catch((reason) => {
        if (!isAbort(reason)) setError(errorMessage(reason))
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [applied, offset, attempt])

  const regions = catalog && form.provinceCode ? selectableRegions(catalog, form.provinceCode) : []
  const appliedChips = useMemo(() => {
    if (!applied || !catalog) return []
    const chips: string[] = []
    if (applied.provinceCode) chips.push(catalog.provinceName(applied.provinceCode))
    if (applied.regionCode) chips.push(catalog.byCode.get(applied.regionCode)?.name ?? applied.regionCode)
    if (applied.dongCode) chips.push(dongOptions.find((dong) => dong.dong_code === applied.dongCode)?.area_name ?? '선택한 읍면동')
    return chips
  }, [applied, catalog, dongOptions])

  const search = () => {
    setOffset(0)
    setApplied({ ...form })
  }

  const reset = () => {
    setForm(EMPTY_FILTERS)
    setOffset(0)
    setApplied(EMPTY_FILTERS)
  }

  const programs = result?.programs ?? []
  const selected = programs.find((program) => program.version_id === selectedId) ?? null
  const from = result && result.matched ? result.offset + 1 : 0
  const to = result ? result.offset + programs.length : 0

  return (
    <div className="mx-auto flex max-w-[1240px] flex-col gap-block px-gutter pt-12 pb-section sm:pt-16">
      <PageHeader eyebrow="복지 찾아보기" title="복지 리스트" description="등록된 복지사업을 살펴보고, 필요한 지원을 찾아보세요." />

      <div className="reveal grid gap-6 xl:grid-cols-[300px_minmax(0,1fr)]">
        <form
          className="card flex flex-col gap-6 self-start p-6"
          onSubmit={(event) => {
            event.preventDefault()
            search()
          }}
        >
          <fieldset className="flex flex-col gap-3">
            <legend className="mb-4 text-footnote font-semibold text-label-secondary">지역</legend>
            <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-1">
              <Field label="시도">
                {(id) => (
                  <Select id={id} value={form.provinceCode} onChange={(event) => setForm({ ...form, provinceCode: event.target.value, regionCode: '', dongCode: '' })}>
                    <option value="">전체 시도</option>
                    {catalog?.provinces.map((province) => (
                      <option key={province.code} value={province.code}>
                        {province.name}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label="시군구">
                {(id) => (
                  <Select id={id} value={form.regionCode} disabled={!form.provinceCode} onChange={(event) => setForm({ ...form, regionCode: event.target.value, dongCode: '' })}>
                    <option value="">전체 시군구</option>
                    {regions.map((region) => (
                      <option key={region.code} value={region.code}>
                        {region.name}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label="행정동·읍면">
                {(id) => (
                  <Select id={id} value={form.dongCode} disabled={!form.regionCode} onChange={(event) => setForm({ ...form, dongCode: event.target.value })}>
                    <option value="">전체 읍면동</option>
                    {dongOptions.map((dong) => (
                      <option key={dong.dong_code} value={dong.dong_code ?? ''}>
                        {dong.area_name}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            </div>
          </fieldset>
          <fieldset className="flex flex-col gap-4 border-t border-separator pt-6">
            <legend className="sr-only">사업 조건</legend>
            <p className="text-footnote font-semibold text-label-secondary">사업</p>
            <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-1">
              <Field label="복지사업 검색">
                {(id) => <TextInput id={id} value={form.q} maxLength={200} placeholder="예: 청년" onChange={(event) => setForm({ ...form, q: event.target.value })} />}
              </Field>
              <Field label="자료 분류">
                {(id) => (
                  <Select id={id} value={form.categoryId} onChange={(event) => setForm({ ...form, categoryId: event.target.value })}>
                    <option value="">전체 분야</option>
                    {result?.categories.map((category) => (
                      <option key={category.category_id} value={category.category_id}>
                        {category.label}
                        {category.count !== undefined ? ` (${category.count})` : ''}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label="신청 기간">
                {(id) => (
                  <Select id={id} value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
                    <option value="">전체 기간</option>
                    {result?.statuses.map((status) => (
                      <option key={status.code} value={status.code}>
                        {status.label}
                        {status.count !== undefined ? ` (${status.count})` : ''}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            </div>
          </fieldset>
          <div className="flex flex-col gap-3 border-t border-separator pt-6">
            <Button type="submit" variant="primary" size="lg" className="w-full">
              <Icon name="search" />
              선택
            </Button>
            <p className="text-center text-footnote text-label-secondary">조건을 고른 뒤 선택을 누르면 검색해요.</p>
            <button type="button" onClick={reset} className="mx-auto min-h-9 rounded-full px-3 text-subhead text-link transition-quick hover:bg-accent-tint">
              필터 초기화
            </button>
          </div>
        </form>

        <div className="flex min-w-0 flex-col gap-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2 text-subhead">
                <span className="text-label-secondary">조회 중인 지역</span>
                {appliedChips.length ? (
                  appliedChips.map((chip, index) => (
                    <span key={chip} className="flex items-center gap-2">
                      {index > 0 && <Icon name="chevronRight" className="size-3.5 text-label-secondary" />}
                      <span className="rounded-full bg-accent-tint px-3 py-1 text-footnote font-medium text-link">{chip}</span>
                    </span>
                  ))
                ) : (
                  <span className="rounded-full bg-fill px-3 py-1 text-footnote font-medium text-label">전체 지역</span>
                )}
                <SyntheticBadge show={result?.is_synthetic} />
              </div>
              <p className="mt-1.5 text-footnote text-label-secondary">선택한 읍면동 → 상위 시군구 → 전국 순</p>
            </div>
            <div className="text-right">
              <p className="text-label">
                전체 <span className="font-semibold text-label tabular-nums">{formatNumber(result?.total)}</span>개 중 <span className="font-semibold text-link tabular-nums">{formatNumber(result?.matched)}</span>개 사업
              </p>
              <p className="mt-0.5 text-footnote text-label-secondary tabular-nums">
                {from}–{to} / {formatNumber(result?.matched)}개 · 한 페이지에 {PAGE_SIZE}개씩 표시
              </p>
            </div>
          </div>

          <Notice tone="muted">지역은 담당기관 관할 기준이며, 신청자의 거주 자격을 뜻하지 않습니다. 신청 기간은 등록된 일정으로 현재 접수 여부는 별도 확인이 필요합니다.</Notice>

          {error && <ErrorBox message={error} onRetry={() => setAttempt((value) => value + 1)} />}

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
            <section className="flex flex-col gap-3">
              <div className="card overflow-hidden">
                {loading && !programs.length && (
                  <div className="p-5">
                    <Spinner />
                  </div>
                )}
                {!loading && !error && !programs.length && <p className="p-6 text-subhead text-label-secondary">조건에 맞는 사업이 없습니다.</p>}
                <ul className={`divide-y divide-separator ${loading ? 'opacity-60' : ''}`}>
                  {programs.map((program, index) => {
                    const active = program.version_id === selectedId
                    return (
                      <li key={program.version_id}>
                        <button
                          type="button"
                          onClick={() => setSelectedId(program.version_id)}
                          aria-current={active}
                          className={`flex w-full gap-3 px-5 py-4 text-left transition-quick ${active ? 'bg-accent-tint' : 'hover:bg-fill'}`}
                        >
                          <span className="w-6 shrink-0 pt-0.5 text-footnote text-label-secondary tabular-nums">{String(offset + index + 1).padStart(2, '0')}</span>
                          <span className="min-w-0">
                            <span className="block text-headline text-label">{program.title}</span>
                            <span className="mt-1 line-clamp-2 block text-subhead text-label-secondary">{program.summary || program.support_content || ''}</span>
                            {program.region_match_label && (
                              <span className="mt-1.5 flex items-center gap-1 text-footnote font-medium text-link">
                                <Icon name="pin" className="size-3.5" />
                                {program.region_match_label}
                              </span>
                            )}
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>
              {result && result.matched > PAGE_SIZE && (
                <div className="flex items-center justify-between">
                  <Button size="sm" disabled={offset === 0 || loading} onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}>
                    이전
                  </Button>
                  <span className="text-footnote text-label-secondary tabular-nums">
                    {Math.floor(offset / PAGE_SIZE) + 1} / {Math.ceil(result.matched / PAGE_SIZE)} 페이지
                  </span>
                  <Button size="sm" disabled={result.next_offset === null || loading} onClick={() => setOffset(result.next_offset ?? offset)}>
                    다음
                  </Button>
                </div>
              )}
            </section>
            <ProgramDetail
              program={selected}
              added={selected ? added.has(selected.version_id) : false}
              onAdd={(program) =>
                open({
                  type: 'linkAnalysis',
                  program,
                  onLinked: () => setAdded((current) => new Set(current).add(program.version_id)),
                })
              }
            />
          </div>
        </div>
      </div>
    </div>
  )
}

function TextBlock({ title, text }: { title: string; text: string | null | undefined }) {
  if (!text?.trim()) return null
  return (
    <section>
      <h3 className="text-headline text-label">{title}</h3>
      <p className="mt-1.5 text-body whitespace-pre-wrap text-label">{text}</p>
    </section>
  )
}

function ProgramDetail({ program, added, onAdd }: { program: WelfareProgram | null; added: boolean; onAdd: (program: WelfareProgram) => void }) {
  if (!program) {
    return <section className="card p-6 text-subhead text-label-secondary">왼쪽 목록에서 사업을 골라 주세요.</section>
  }
  const period = program.application_period_text || [program.start_date, program.end_date].filter(Boolean).join(' ~ ')
  const regions = (program.regions ?? []).map((region) => (region.scope_type === 'nationwide' ? '전국' : region.name || region.original_region_text)).filter(Boolean)
  return (
    <section className="card flex flex-col self-start overflow-hidden">
      <div className="px-6 pt-7 pb-6 sm:px-8">
        <div className="flex flex-wrap items-center gap-1.5">
          <SyntheticBadge show={program.is_synthetic} />
          {program.source_categories?.map((category) => (
            <Badge key={category.category_id}>{category.label}</Badge>
          ))}
        </div>
        <h2 className="mt-3 text-title-2 text-label">{program.title}</h2>
        {program.institution && <p className="mt-1 text-subhead text-label-secondary">{program.institution}</p>}
      </div>
      <div className="mx-6 flex flex-col gap-4 rounded-card-sm bg-accent-tint px-5 py-4 sm:mx-8 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-subhead text-label">저장된 현황 분석에 연결해 활용 방법을 검토할 수 있어요.</p>
          {added && <p className="mt-1 text-footnote font-medium text-success">대응안 편집 화면에 사업을 담았습니다. 내용을 검토한 뒤 저장해 주세요.</p>}
        </div>
        <Button variant="primary" onClick={() => onAdd(program)} className="shrink-0">
          <Icon name="plus" />
          이 사업을 대응안에 담기
        </Button>
      </div>
      <div className="flex flex-col gap-6 px-6 pt-7 pb-8 sm:px-8">
        <TextBlock title="지원 대상" text={program.target_text} />
        <TextBlock title="지원 내용" text={program.support_content} />
        <TextBlock title="선정 기준" text={program.selection_text} />
        <TextBlock title="신청 방법" text={program.application_text} />
        <dl className="grid grid-cols-[96px_1fr] gap-x-4 gap-y-2.5 rounded-card-sm bg-fill px-5 py-4 text-subhead">
          <dt className="text-label-secondary">신청 기간</dt>
          <dd className="text-label">
            {period || '기재 없음'} <span className="text-footnote text-label-secondary">(등록 일정 · 접수 여부 별도 확인)</span>
          </dd>
          <dt className="text-label-secondary">담당 관할</dt>
          <dd className="text-label">{regions.length ? regions.join(', ') : '기재 없음'}</dd>
          <dt className="text-label-secondary">출처</dt>
          <dd className="text-label">
            {program.source_url ? (
              <a href={program.source_url} target="_blank" rel="noreferrer noopener" className="text-label underline underline-offset-2">
                원문 보기
              </a>
            ) : (
              program.source?.name ?? '기재 없음'
            )}
          </dd>
        </dl>
      </div>
    </section>
  )
}
