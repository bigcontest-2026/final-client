import { useEffect, useId, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { AnalysisReport, WelfareProgram } from '../api/types'
import { AnalysisCardList, useAnalysisList } from './report/AnalysisCardList'
import { AnalysisDetail } from './report/AnalysisDetail'
import { Button, EmptyState, Modal, ModalHeader, Spinner } from './ui'

export function LinkAnalysisModal({ program, onClose, onLink }: { program: WelfareProgram; onClose: () => void; onLink: (report: AnalysisReport) => void }) {
  const titleId = useId()
  const navigate = useNavigate()
  const list = useAnalysisList(undefined)
  const [selected, setSelected] = useState<string | null>(null)

  useEffect(() => {
    if (!selected && list.reports.length) setSelected(list.reports[0].report_id)
  }, [list.reports, selected])

  const empty = !list.loading && !list.error && !list.reports.length
  const go = (path: string) => {
    onClose()
    navigate(path)
  }

  return (
    <Modal onClose={onClose} labelledBy={titleId}>
      <ModalHeader titleId={titleId} eyebrow="복지사업을 대응안에 담기" title="연결할 현황 분석을 선택해 주세요" description={`「${program.title}」을 어느 지역 분석에 연결할지 확인해 주세요.`} onClose={onClose} />
      {empty ? (
        <div className="p-8">
          <EmptyState>
            연결할 현황 분석이 아직 없습니다. 먼저 지역을 분석한 뒤 다시 연결해 주세요.
            <div className="flex flex-wrap justify-center gap-2">
              <Button size="sm" variant="primary" onClick={() => go('/')}>
                메인에서 분석하기
              </Button>
              <Button size="sm" onClick={() => go('/dashboard')}>
                대시보드에서 분석하기
              </Button>
            </div>
          </EmptyState>
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden md:grid-cols-[300px_1fr]">
          <div className="max-h-[38vh] overflow-y-auto border-b border-separator p-3 md:max-h-none md:border-r md:border-b-0">
            <AnalysisCardList list={list} selectedId={selected} onSelect={setSelected} />
          </div>
          <div className="min-h-0 overflow-y-auto bg-canvas px-5 pt-6 sm:px-8">
            {selected ? <AnalysisDetail key={selected} reportId={selected} mode="preview" onLink={onLink} /> : <Spinner />}
          </div>
        </div>
      )}
    </Modal>
  )
}
