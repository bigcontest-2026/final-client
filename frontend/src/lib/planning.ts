import type { PlanKind, PlanningDetails, PlanningEntry, PlanningKey } from '../api/types'

type PlanningField = { key: PlanningKey; label: string; hint: string; group: 'review' | 'execution' | 'decisions'; kinds?: PlanKind[] }
const A: PlanKind[] = ['existing_program']
const B: PlanKind[] = ['program_improvement', 'new_program']
export const PLANNING_FIELDS: PlanningField[] = [
  { key: 'goal', label: '목적·목표', hint: '어떤 지원 필요를 확인하고 무엇을 개선할지 적어 주세요. 목표 수치는 근거가 있을 때 기재합니다.', group: 'review' },
  { key: 'alternatives', label: '대안 비교·선택 이유', hint: '기존 체계 활용, 보완·확대, 신규 설계 중 비교한 대안과 선택 이유', group: 'review', kinds: B },
  { key: 'service_function', label: '사업의 지원 기능', hint: '어떤 지원을 얼마나, 어떤 주기로 제공하는지 원문과 연결합니다.', group: 'review', kinds: A },
  { key: 'service_scope', label: '지역·집단 범위', hint: '분석 지역·집단과 사업 제공 범위의 교집합·차이를 적어 주세요.', group: 'review', kinds: A },
  { key: 'selection_requirements', label: '개인 선정 요건', hint: '공식 선정·제외·중복 제한을 기록합니다. 집계 자료로 개인 자격을 확정하지 않습니다.', group: 'review', kinds: A },
  { key: 'availability', label: '운영·공급 확인', hint: '현재 운영, 정원, 대기 여부. 미확인은 공급 0이나 즉시 이용 가능을 뜻하지 않습니다.', group: 'review', kinds: A },
  { key: 'access_and_cost', label: '신청 경로·이용자 부담', hint: '공식 신청·문의 경로, 이동·디지털 접근 제약, 이용자 비용을 구분합니다.', group: 'review', kinds: A },
  { key: 'scale', label: '수요·제공 예정 규모', hint: '관측 집단, 확인·추정 수요, 제공 예정 규모를 단위·기간·근거와 구분합니다.', group: 'execution', kinds: B },
  { key: 'execution', label: '단계별 실행·인계', hint: '단계별 조치, 선행 조건, 완료·회신 조건과 미충족 시 대안을 적어 주세요. 날짜가 없으면 조건으로 작성합니다.', group: 'execution' },
  { key: 'budget', label: '비용 산출', hint: '단가·수량·횟수·기간·단위·산출근거를 적고 확인분 소계와 총액 미산정을 구분합니다. A는 추가 비용이 있을 때 작성합니다.', group: 'execution' },
  { key: 'funding', label: '재원·자원 확보', hint: '재원 후보와 확보 재원, 제안 역할과 기관 협의 상태, 인력·공간·공급 부족 시 대안을 구분합니다.', group: 'execution' },
  { key: 'institutional_conditions', label: '제도·협의·실행 조건', hint: '해당 절차의 적용 여부와 실행 전에 필요한 확인을 적습니다. 초안 검토와 사업 승인을 구분합니다.', group: 'execution' },
  { key: 'evaluation', label: '성과 측정·점검 계획', hint: '지표 정의, 단위·분모, 기준값, 목표·근거, 측정 방법·시점·주체와 보완 조건. 목표 미정도 기록할 수 있습니다.', group: 'execution' },
  { key: 'resident_feedback', label: '주민·현장 의견', hint: '확인한 의견의 출처·수집 방법·시점, 설계 반영 여부와 이유. 확인하지 않았다면 미확인으로 둡니다.', group: 'decisions' },
  { key: 'decisions', label: '확인·결정 요청', hint: '누가 무엇을 확인·선택해야 하는지 적습니다. 요청한 결정과 실제 결정 기록을 구분합니다.', group: 'decisions' },
  { key: 'sources', label: '출처·정보 갱신', hint: '근거 ID, 문서명·공식 링크, 해당 위치·기준시점·확인일과 재확인 조건을 적어 주세요.', group: 'decisions' },
]

export const emptyPlanningEntry = (): PlanningEntry => ({ status: 'unconfirmed', text: '', evidence: '', owner: '', next_action: '' })
export const applicablePlanningFields = (kind: PlanKind) => PLANNING_FIELDS.filter(field => !field.kinds || field.kinds.includes(kind))

export function cleanPlanningDetails(details: PlanningDetails): PlanningDetails {
  return Object.fromEntries(PLANNING_FIELDS.filter(({ key }) => details[key]).map(({ key }) => {
    const entry = details[key]!
    return [key, { status: entry.status ?? 'unconfirmed', text: entry.text ?? '', evidence: entry.evidence ?? '', owner: entry.owner ?? '', next_action: entry.next_action ?? '' }]
  }))
}

export function mergePlanningSuggestion(current: PlanningDetails, incoming: PlanningDetails, selected: PlanningKey[]): PlanningDetails {
  const merged = { ...current }
  for (const key of selected) {
    const old = current[key]
    if (old && (old.status !== 'unconfirmed' || old.text || old.evidence || old.owner || old.next_action)) continue
    if (incoming[key]) merged[key] = { ...incoming[key]!, status: 'unconfirmed' }
  }
  return merged
}
