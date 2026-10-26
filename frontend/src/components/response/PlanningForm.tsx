import type { PlanKind, PlanningDetails, PlanningEntry, PlanningKey, ReviewStatus } from '../../api/types'
import { applicablePlanningFields, emptyPlanningEntry } from '../../lib/planning'
import { Accordion, Badge, Field, Select, TextArea, TextInput } from '../ui'

const GROUPS = [
  { key: 'review', title: '서비스·대안 검토', description: '어떤 필요에 대응하며, 왜 이 방향을 선택했는지 정리합니다.' },
  { key: 'execution', title: '실행·비용·성과', description: '누가 어떤 조건에서 실행하고, 무엇을 확인해야 다음 단계로 갈 수 있는지 적습니다.' },
  { key: 'decisions', title: '확인사항·출처', description: '현장 의견과 근거를 연결하고 이번에 요청할 확인·결정을 모읍니다.' },
] as const

export function PlanningForm({ kind, details = {}, onChange }: { kind: PlanKind; details?: PlanningDetails; onChange: (value: PlanningDetails) => void }) {
  const fields = applicablePlanningFields(kind)
  const update = (key: PlanningKey, patch: Partial<PlanningEntry>) => onChange({ ...details, [key]: { ...emptyPlanningEntry(), ...details[key], ...patch } })
  return <div className="flex flex-col gap-4">
    <p className="text-footnote text-label-secondary">세부 항목은 필요한 만큼 작성하세요. 자료가 없으면 미확인으로 두고 다음 조치를 적을 수 있습니다. 미확인은 0이나 해당 없음과 다릅니다.</p>
    {GROUPS.map(group => {
      const entries = fields.filter(field => field.group === group.key)
      const recorded = entries.filter(field => details[field.key]?.text.trim()).length
      return <Accordion key={group.key} title={group.title} aside={<Badge>{recorded}/{entries.length} 기록</Badge>}>
        <p className="mb-5 text-label-secondary">{group.description}</p>
        <div className="flex flex-col gap-3">
          {entries.map(field => {
            const entry = details[field.key] ?? emptyPlanningEntry()
            const invalidConfirmed = entry.status === 'confirmed' && (!entry.text.trim() || !entry.evidence.trim())
            const invalidOmitted = entry.status === 'not_applicable' && !entry.text.trim()
            return <Accordion key={field.key} title={field.label} aside={<span className="text-footnote text-label-secondary">{entry.status === 'confirmed' ? '사용자 확인 기록' : entry.status === 'not_applicable' ? '해당 없음' : '미확인'}</span>} className="border border-separator">
              <div className="flex flex-col gap-4">
                <p className="text-footnote text-label-secondary">{field.hint}</p>
                <Field label={`${field.label} 상태`}>
                  {id => <Select id={id} value={entry.status} onChange={event => update(field.key, { status: event.target.value as ReviewStatus })}>
                    <option value="unconfirmed">미확인·검토 제안</option><option value="confirmed">사용자 확인 기록</option><option value="not_applicable">해당 없음（사유 기록）</option>
                  </Select>}
                </Field>
                <Field label={entry.status === 'not_applicable' ? `${field.label} 생략 이유` : `${field.label} 내용`} required={entry.status !== 'unconfirmed'}>
                  {id => <TextArea id={id} rows={3} maxLength={4000} value={entry.text} aria-invalid={invalidOmitted || (invalidConfirmed && !entry.text.trim()) || undefined} onChange={event => update(field.key, { text: event.target.value })} />}
                </Field>
                {invalidOmitted && <p role="alert" className="text-footnote text-danger">해당 없음으로 기록할 이유를 적어 주세요.</p>}
                <Field label={`${field.label} 근거`} required={entry.status === 'confirmed'} hint="문서·근거 ID, 해당 위치·기준시점·확인일을 함께 적어 주세요.">
                  {id => <TextArea id={id} rows={2} maxLength={2000} value={entry.evidence} aria-invalid={invalidConfirmed && !entry.evidence.trim() || undefined} onChange={event => update(field.key, { evidence: event.target.value })} />}
                </Field>
                {invalidConfirmed && <p role="alert" className="text-footnote text-danger">확인 상태에는 내용과 근거가 모두 필요합니다.</p>}
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label={`${field.label} 확인·담당 역할(안)`}>{id => <TextInput id={id} maxLength={300} value={entry.owner} placeholder="미지정이면 비워 두세요" onChange={event => update(field.key, { owner: event.target.value })} />}</Field>
                  <Field label={`${field.label} 다음 조치`}>{id => <TextArea id={id} rows={2} maxLength={2000} value={entry.next_action} onChange={event => update(field.key, { next_action: event.target.value })} />}</Field>
                </div>
              </div>
            </Accordion>
          })}
        </div>
      </Accordion>
    })}
  </div>
}
