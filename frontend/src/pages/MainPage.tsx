import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { errorMessage } from '../api/client'
import { api } from '../api/endpoints'
import type { AgeCode } from '../api/types'
import hermiGuide from '../assets/hermi/hermi-1.png'
import { Icon } from '../components/icons'
import { Button, ErrorBox, Field, Select, Thinking } from '../components/ui'
import { AGE_CODES, AGE_LABELS, ageLabel, monthLabel } from '../lib/labels'
import { parseQuestion } from '../lib/parseQuestion'
import { latestMonth, selectableRegions, useHealth, useRegionCatalog } from '../lib/regions'
import { readJson } from '../lib/storage'
import { addHistory } from '../state/history'
import { useModals } from '../state/modals'

export const LAST_DONG_KEY = 'hermes:last-dong:v1'

export function MainPage() {
  const navigate = useNavigate()
  const { open } = useModals()
  const { catalog, error: catalogError, retry } = useRegionCatalog()
  const { health } = useHealth()
  const [question, setQuestion] = useState('')
  const [provinceCode, setProvinceCode] = useState('')
  const [regionCode, setRegionCode] = useState('')
  const [ageCode, setAgeCode] = useState<AgeCode | ''>('')
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const lastDong = useMemo(() => readJson<{ code: string; name: string } | null>(LAST_DONG_KEY, null), [])

  const month = latestMonth(health?.months ?? catalog?.months)
  const regions = catalog && provinceCode ? selectableRegions(catalog, provinceCode) : []
  const region = catalog?.byCode.get(regionCode)
  const provinceName = catalog?.provinceName(provinceCode) ?? ''

  useEffect(() => {
    if (!catalog || !question.trim()) return
    const parsed = parseQuestion(question, catalog.regions)
    if (parsed.provinceCode) setProvinceCode(parsed.provinceCode)
    if (parsed.regionCode) setRegionCode(parsed.regionCode)
    else if (parsed.provinceCode && parsed.provinceCode !== provinceCode) setRegionCode('')
    if (parsed.ageCode) setAgeCode(parsed.ageCode)
  }, [question, catalog])

  const start = async () => {
    if (!region || !month) return
    setRunning(true)
    setError(null)
    try {
      const report = await api.createAnalysisReport({ region_code: region.code, month, ...(ageCode ? { age_code: ageCode } : {}) })
      addHistory({
        source: 'main',
        question: question.trim(),
        regionLabel: `${provinceName} ${region.name}`,
        scopeLabel: `${monthLabel(month)} · 전체 성별 · ${ageLabel(ageCode || null)}`,
        reportId: report.report_id,
      })
      open({ type: 'savedReports', reportId: report.report_id })
    } catch (reason) {
      setError(errorMessage(reason))
    } finally {
      setRunning(false)
    }
  }

  const shortcuts = [
    {
      title: '우리 동 살펴보기',
      description: `${lastDong ? `${lastDong.name}의` : '동의'} 지역 자료와 활동 참고`,
      onClick: () => navigate(lastDong ? `/dashboard?dong=${lastDong.code}` : '/dashboard'),
    },
    {
      title: '관련 복지 찾아보기',
      description: '행정동에 맞는 지원과 조건 확인',
      onClick: () => navigate(lastDong ? `/welfare?dong=${lastDong.code}` : '/welfare'),
    },
    {
      title: '복지 대응안 함께 만들기',
      description: '기존 사업부터 활용·보완 검토',
      onClick: () => open({ type: 'savedReports' }),
    },
  ]

  return (
    <div className="mx-auto max-w-[880px] px-gutter py-section">
      <header className="reveal flex flex-col items-center text-center">
        <img src={hermiGuide} alt="" className="size-20" />
        <h1 className="mt-5 text-large-title text-label">어느 지역을 살펴볼까요?</h1>
        <p className="mt-4 max-w-[560px] text-body text-label-secondary">질문에 적은 지역과 연령을 아래 조건에 자동으로 맞춥니다. 분석은 아래 조건으로 실행됩니다.</p>
      </header>

      <form
        className="reveal card mt-block p-6 sm:p-8"
        onSubmit={(event) => {
          event.preventDefault()
          void start()
        }}
      >
        <textarea
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          rows={3}
          placeholder="예: 서울시 강남구20대의 활동 변화를 분석해 줘"
          aria-label="헤르미에게 질문하기"
          className="w-full resize-y rounded-card-sm bg-fill px-5 py-4 text-body text-label placeholder:text-label-secondary transition-quick focus:bg-field focus:ring-4 focus:ring-accent-tint focus:outline-none"
        />
        {catalogError && (
          <div className="mt-4">
            <ErrorBox message={catalogError} onRetry={retry} />
          </div>
        )}
        <fieldset className="mt-6">
          <legend className="sr-only">분석 조건</legend>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="시도">
              {(id) => (
                <Select
                  id={id}
                  value={provinceCode}
                  onChange={(event) => {
                    setProvinceCode(event.target.value)
                    setRegionCode('')
                  }}
                >
                  <option value="">시도 선택</option>
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
                <Select id={id} value={regionCode} disabled={!provinceCode} onChange={(event) => setRegionCode(event.target.value)}>
                  <option value="">시군구 선택</option>
                  {regions.map((item) => (
                    <option key={item.code} value={item.code}>
                      {item.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="활동 연령">
              {(id) => (
                <Select id={id} value={ageCode} onChange={(event) => setAgeCode(event.target.value as AgeCode | '')}>
                  <option value="">전체 연령</option>
                  {AGE_CODES.map((code) => (
                    <option key={code} value={code}>
                      {AGE_LABELS[code]}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>
        </fieldset>
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-separator pt-6">
          <p className="text-subhead text-label-secondary">
            <span className="font-semibold text-label">{region ? `${provinceName} ${region.name}` : '지역을 골라 주세요'}</span>
            {month && ` · ${monthLabel(month)} 자료(최신)`}
          </p>
          <Button type="submit" variant="primary" size="lg" disabled={!region || !month || running}>
            분석 시작
          </Button>
        </div>
        {running && <Thinking label="헤르미가 자료를 모아 현황 보고서를 만들고 있어요." />}
        {error && (
          <div className="mt-4">
            <ErrorBox message={error} onRetry={() => void start()} />
          </div>
        )}
      </form>

      <section className="reveal mt-section">
        <h2 className="text-center text-title-2 text-label">이어서 할 수 있는 일</h2>
        <ol className="mt-8 grid gap-4 sm:grid-cols-3">
          {shortcuts.map((item, index) => (
            <li key={item.title}>
              <button type="button" onClick={item.onClick} className="card group flex h-full w-full flex-col items-start p-6 text-left transition-quick hover:-translate-y-0.5 hover:shadow-float">
                <span className="text-footnote text-label-secondary tabular-nums">{String(index + 1).padStart(2, '0')}</span>
                <span className="mt-3 text-headline text-label">{item.title}</span>
                <span className="mt-1 text-subhead text-label-secondary">{item.description}</span>
                <span className="mt-auto flex items-center gap-0.5 pt-5 text-subhead text-link">
                  바로 가기
                  <Icon name="chevronRight" className="size-4 transition-transform duration-200 ease-out group-hover:translate-x-0.5" />
                </span>
              </button>
            </li>
          ))}
        </ol>
      </section>

      <section className="reveal mx-auto mt-section max-w-[640px]">
        <details className="group rounded-card bg-elevated px-6 py-5 shadow-soft">
          <summary className="flex list-none items-center justify-between text-headline text-label [&::-webkit-details-marker]:hidden">
            자료 연결과 저장 안내
            <Icon name="chevronDown" className="size-4 text-label-tertiary transition-transform duration-200 ease-out group-open:rotate-180" />
          </summary>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-subhead text-label-secondary">
            <li>통신·카드 활동 자료는 시군구 단위 참고 자료입니다. 지금은 서울 강남구와 춘천시 자료만 연결되어 있습니다.</li>
            <li>지역 고립 지수는 I5의 0~10 표시점수입니다. 2025년 12월 시군구 기준 상대점수로, 5점은 기준 평균입니다. 지역 직접 조사값·고립률·위험등급이 아닙니다.</li>
            <li>현황 보고서와 예방 대응 보고서는 서버에 저장되어 "저장된 보고서"에서 다시 볼 수 있습니다.</li>
            <li>대응안을 고치는 동안에는 이 기기에 임시 저장되고, "변경 내용 저장"을 눌러야 서버에 저장됩니다.</li>
            <li>지원 필요·자격·접수 여부는 확인되지 않은 상태가 기본입니다. 최종 판단은 담당자가 합니다.</li>
          </ul>
        </details>
        {/* <p className="mt-6 text-center text-subhead text-label-secondary">확인한 자료를 바탕으로, 최종 판단은 담당자와 함께해요.</p> */}
      </section>
    </div>
  )
}
