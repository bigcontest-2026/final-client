import { useEffect, useRef, useState } from 'react'
import { errorMessage, requestBlob } from '../../api/client'
import { downloadBlob } from '../../lib/download'
import { Button, Select } from '../ui'
import { Icon } from '../icons'

type Format = 'pdf' | 'hwpx' | 'md'
export function ReportDownload({ reportId, kind = 'response', filename, disabled = false }: { reportId?: string; kind?: 'response' | 'analysis'; filename?: string; disabled?: boolean }) {
  const [format, setFormat] = useState<Format>('pdf')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const controller = useRef<AbortController | null>(null)
  useEffect(() => () => controller.current?.abort(), [])
  useEffect(() => { controller.current?.abort(); controller.current = null; setBusy(false); setError(null) }, [reportId])
  const run = async () => {
    if (!reportId || controller.current) return
    const pending = new AbortController()
    controller.current = pending
    setBusy(true); setError(null)
    try {
      const blob = await requestBlob(`/api/model/${kind === 'response' ? 'response' : 'analysis'}-reports/${encodeURIComponent(reportId)}/export?format=${format}`, pending.signal)
      if (!pending.signal.aborted) downloadBlob(`${(filename || `HERMES_${reportId}`).replace(/\.[^.]+$/, '')}.${format}`, blob)
    } catch (reason) {
      if (!pending.signal.aborted) setError(errorMessage(reason))
    } finally {
      if (controller.current === pending) { controller.current = null; setBusy(false) }
    }
  }
  return <div className="flex max-w-full flex-col gap-2">
    <div className="flex flex-wrap items-center gap-2">
      <div className="w-48 max-w-full"><Select aria-label="보고서 다운로드 형식" value={format} disabled={busy || disabled} onChange={event => setFormat(event.target.value as Format)}>
        <option value="pdf">PDF · 읽기·공유</option><option value="hwpx">한글(HWPX) · 편집</option><option value="md">Markdown · 원문</option>
      </Select></div>
      <Button variant="primary" onClick={run} disabled={busy || disabled || !reportId}><Icon name="download" />{busy ? '파일 만드는 중…' : error ? '다운로드 다시 시도' : '보고서 내려받기'}</Button>
    </div>
    {busy && <p role="status" className="text-footnote text-label-secondary">저장된 보고서로 파일을 만들고 있습니다.</p>}
    {error && <p role="alert" className="text-footnote text-danger">{error}</p>}
  </div>
}
