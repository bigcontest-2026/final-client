import { useModals } from '../state/modals'
import { HistoryDrawer } from './HistoryDrawer'
import { LinkAnalysisModal } from './LinkAnalysisModal'
import { ResponseEditorModal } from './response/ResponseEditorModal'
import { SavedReportsModal } from './SavedReportsModal'

export function ModalHost() {
  const { modal, open, close } = useModals()
  if (!modal) return null

  switch (modal.type) {
    case 'savedReports':
      return (
        <SavedReportsModal
          key={`${modal.reportId ?? ''}-${modal.responseReportId ?? ''}-${modal.filter?.dong_code ?? ''}`}
          initialTab={modal.tab}
          reportId={modal.reportId}
          responseReportId={modal.responseReportId}
          filter={modal.filter}
          onClose={close}
          onReview={(report) => open({ type: 'responseEditor', analysisReportId: report.report_id })}
        />
      )
    case 'responseEditor':
      return (
        <ResponseEditorModal
          key={modal.analysisReportId}
          analysisReportId={modal.analysisReportId}
          program={modal.program}
          onProgramAdded={modal.onProgramAdded}
          onClose={close}
          onBackToAnalysis={(reportId) => open({ type: 'savedReports', reportId })}
        />
      )
    case 'linkAnalysis':
      return (
        <LinkAnalysisModal
          program={modal.program}
          onClose={close}
          onLink={(report) => open({ type: 'responseEditor', analysisReportId: report.report_id, program: modal.program, onProgramAdded: modal.onLinked })}
        />
      )
    case 'history':
      return <HistoryDrawer onClose={close} onOpen={(entry) => open({ type: 'savedReports', reportId: entry.reportId })} />
  }
}
