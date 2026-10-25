import { useEffect, useId } from 'react'
import { createPortal } from 'react-dom'
import { formatDateTime } from '../lib/format'
import { clearHistory, useHistory, type HistoryEntry } from '../state/history'
import { Button, Notice } from './ui'

export function HistoryDrawer({ onClose, onOpen }: { onClose: () => void; onOpen: (entry: HistoryEntry) => void }) {
  const titleId = useId()
  const entries = useHistory()

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end bg-scrim backdrop-blur-sm" onClick={onClose}>
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="glass-thick sheet-in flex h-full w-full max-w-sm flex-col shadow-float sm:m-3 sm:h-[calc(100%-1.5rem)] sm:rounded-sheet"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-separator px-5 pt-5 pb-4">
          <div>
            <div className="text-footnote text-label-secondary">이 브라우저에만 저장</div>
            <h2 id={titleId} className="text-title-3 text-label">
              대화 이력
            </h2>
          </div>
          <Button size="sm" variant="ghost" onClick={onClose} className="-mr-2 font-semibold">
            닫기
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-4">
          <p className="mb-3 px-2 text-footnote text-label-secondary">헤르미에게 요청한 분석 기록입니다. 이 브라우저에만 저장됩니다.</p>
          {!entries.length && <Notice tone="muted">아직 대화 이력이 없습니다.</Notice>}
          <ol className="flex flex-col gap-0.5">
            {entries.map((entry) => (
              <li key={entry.id}>
                <button type="button" onClick={() => onOpen(entry)} className="w-full rounded-control px-3 py-3 text-left transition-quick hover:bg-fill">
                  <div className="text-subhead font-semibold text-label">{entry.question || `${entry.regionLabel} 분석`}</div>
                  <div className="mt-0.5 text-footnote text-label-secondary">
                    {entry.regionLabel} · {entry.scopeLabel}
                  </div>
                  <div className="mt-0.5 text-caption text-label-secondary">
                    {entry.source === 'dashboard' ? '대시보드' : '메인'} · {formatDateTime(entry.at)}
                  </div>
                </button>
              </li>
            ))}
          </ol>
        </div>
        {entries.length > 0 && (
          <div className="border-t border-separator px-3 py-3">
            <Button size="sm" variant="ghost" onClick={clearHistory}>
              이력 지우기
            </Button>
          </div>
        )}
      </aside>
    </div>,
    document.body,
  )
}
