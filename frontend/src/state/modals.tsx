import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import type { WelfareProgram } from '../api/types'

export type SavedReportsTab = 'analysis' | 'response'

export type ModalState =
  | { type: 'savedReports'; tab?: SavedReportsTab; reportId?: string; responseReportId?: string; filter?: { dong_code?: string; region_code?: string; label?: string } }
  | { type: 'responseEditor'; analysisReportId: string; program?: WelfareProgram; onProgramAdded?: () => void }
  | { type: 'linkAnalysis'; program: WelfareProgram; onLinked?: () => void }
  | { type: 'history' }

interface ModalContextValue {
  modal: ModalState | null
  open: (modal: ModalState) => void
  close: () => void
}

const ModalContext = createContext<ModalContextValue | null>(null)

export function ModalProvider({ children }: { children: ReactNode }) {
  const [modal, setModal] = useState<ModalState | null>(null)
  const open = useCallback((next: ModalState) => setModal(next), [])
  const close = useCallback(() => setModal(null), [])
  const value = useMemo(() => ({ modal, open, close }), [modal, open, close])
  return <ModalContext.Provider value={value}>{children}</ModalContext.Provider>
}

export function useModals(): ModalContextValue {
  const value = useContext(ModalContext)
  if (!value) throw new Error('ModalProvider is missing')
  return value
}
