import { useEffect, useId, useRef, type ButtonHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes, type InputHTMLAttributes } from 'react'
import { createPortal } from 'react-dom'
import hermiGuide from '../assets/hermi/hermi-1.png'
import hermiThinking from '../assets/hermi/hermi-3.png'
import { Icon } from './icons'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'

const BUTTON_STYLES: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-on-accent hover:bg-accent-hover disabled:opacity-40 disabled:hover:bg-accent',
  secondary: 'bg-fill text-label hover:bg-fill-strong disabled:opacity-40 disabled:hover:bg-fill',
  ghost: 'text-link hover:bg-accent-tint disabled:opacity-40 disabled:hover:bg-transparent',
  danger: 'bg-danger-tint text-danger hover:bg-fill-strong disabled:opacity-40',
}

export function Button({
  variant = 'secondary',
  size = 'md',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: 'sm' | 'md' | 'lg' }) {
  const sizing = size === 'sm' ? 'min-h-9 px-3.5 py-1.5 text-footnote' : size === 'lg' ? 'min-h-12 px-6 py-3 text-body' : 'min-h-11 px-5 py-2.5 text-subhead'
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-1.5 rounded-full font-medium transition-quick active:scale-[0.98] disabled:active:scale-100 ${sizing} ${BUTTON_STYLES[variant]} ${className}`}
      {...props}
    />
  )
}

const BADGE_DOTS = {
  green: 'bg-dot-green',
  slate: '',
  blue: 'bg-accent',
  amber: 'bg-dot-yellow',
  orange: 'bg-dot-orange',
  sky: 'bg-accent',
  rose: 'bg-dot-red',
  violet: 'bg-dot-purple',
}

export type BadgeTone = keyof typeof BADGE_DOTS

export function Badge({ tone = 'slate', children, className = '' }: { tone?: BadgeTone; children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full bg-fill px-2.5 py-0.5 text-footnote font-medium text-label ${className}`}>
      {BADGE_DOTS[tone] && <span className={`size-1.5 rounded-full ${BADGE_DOTS[tone]}`} aria-hidden="true" />}
      {children}
    </span>
  )
}

export function Accordion({
  title,
  aside,
  children,
  defaultOpen = false,
  className = '',
}: {
  title: ReactNode
  aside?: ReactNode
  children: ReactNode
  defaultOpen?: boolean
  className?: string
}) {
  return (
    <details open={defaultOpen} className={`group rounded-card-sm bg-elevated ${className}`}>
      <summary className="flex min-h-12 list-none items-center gap-3 px-5 py-3 select-none [&::-webkit-details-marker]:hidden">
        <span className="flex-1 text-subhead font-semibold text-label">{title}</span>
        {aside}
        <Icon name="chevronDown" className="size-4 text-label-tertiary transition-transform duration-200 ease-out group-open:rotate-180" />
      </summary>
      <div className="border-t border-separator px-5 py-4 text-subhead text-label">{children}</div>
    </details>
  )
}

export function Field({ label, required, hint, children }: { label: string; required?: boolean; hint?: ReactNode; children: (id: string) => ReactNode }) {
  const id = useId()
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="flex items-center gap-1.5 text-subhead font-medium text-label">
        {label}
        {required && <span className="text-caption font-normal text-label-secondary">필수</span>}
      </label>
      {children(id)}
      {hint && <p className="text-footnote text-label-secondary">{hint}</p>}
    </div>
  )
}

const CONTROL =
  'min-h-11 w-full rounded-control border border-separator-opaque bg-field px-3.5 py-2.5 text-body text-label placeholder:text-label-secondary transition-quick focus:border-accent focus:ring-4 focus:ring-accent-tint focus:outline-none disabled:cursor-not-allowed disabled:opacity-50'

export function Select({ className = '', ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={`${CONTROL} ${className}`} {...props} />
}

export function TextArea({ className = '', ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${CONTROL} resize-y ${className}`} {...props} />
}

export function TextInput({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${CONTROL} ${className}`} {...props} />
}

export function Spinner({ label = '불러오는 중' }: { label?: string }) {
  return (
    <div className="flex items-center gap-2.5 text-subhead text-label-secondary" role="status">
      <span className="size-4 animate-spin rounded-full border-2 border-fill-strong border-t-accent" />
      {label}
    </div>
  )
}

export function Thinking({ label }: { label: string }) {
  return (
    <div className="mt-4 flex items-center gap-4 rounded-card-sm bg-fill px-5 py-4 text-left" role="status">
      <img src={hermiThinking} alt="" className="size-12 shrink-0 motion-safe:animate-pulse" />
      <p className="text-subhead text-label">{label}</p>
    </div>
  )
}

export function ErrorBox({ message, onRetry, retryLabel = '다시 시도' }: { message: string; onRetry?: () => void; retryLabel?: string }) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-card-sm bg-danger-tint px-5 py-4 text-subhead text-danger" role="alert">
      <p>{message}</p>
      {onRetry && (
        <Button size="sm" onClick={onRetry}>
          {retryLabel}
        </Button>
      )}
    </div>
  )
}

export function Notice({ tone = 'info', children, className = '' }: { tone?: 'info' | 'success' | 'warn' | 'muted'; children: ReactNode; className?: string }) {
  const tones = {
    info: 'bg-accent-tint text-label',
    success: 'bg-success-tint text-label',
    warn: 'bg-warning-tint text-label',
    muted: 'bg-fill text-label-secondary',
  }
  return <div className={`rounded-card-sm px-5 py-4 text-subhead ${tones[tone]} ${className}`}>{children}</div>
}

export function Modal({
  onClose,
  children,
  labelledBy,
  size = 'lg',
}: {
  onClose: () => void
  children: ReactNode
  labelledBy: string
  size?: 'lg' | 'xl'
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    panelRef.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeRef.current()
    }
    document.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      previous?.focus?.()
    }
  }, [])

  const width = size === 'xl' ? 'max-w-[1440px]' : 'max-w-[1200px]'
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-scrim p-2 backdrop-blur-sm sm:p-6">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        className={`glass-thick sheet-in flex w-full ${width} flex-col overflow-hidden rounded-sheet shadow-float outline-none`}
      >
        {children}
      </div>
    </div>,
    document.body,
  )
}

export function ModalHeader({
  titleId,
  title,
  eyebrow,
  description,
  onClose,
  children,
}: {
  titleId: string
  title: ReactNode
  eyebrow?: ReactNode
  description?: ReactNode
  onClose: () => void
  children?: ReactNode
}) {
  return (
    <header className="border-b border-separator">
      <div className="flex items-start justify-between gap-4 px-5 pt-5 pb-4 sm:px-8 sm:pt-6">
        <div className="min-w-0">
          {eyebrow && <div className="text-footnote text-label-secondary">{eyebrow}</div>}
          <h2 id={titleId} className="mt-0.5 text-title-3 text-label">
            {title}
          </h2>
          {description && <p className="mt-1 text-subhead text-label-secondary">{description}</p>}
        </div>
        <Button variant="ghost" size="sm" onClick={onClose} className="-mr-2 font-semibold">
          닫기
        </Button>
      </div>
      {children && <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-5 pb-4 sm:px-8">{children}</div>}
    </header>
  )
}

export function Tabs<T extends string>({ value, onChange, items }: { value: T; onChange: (value: T) => void; items: { value: T; label: string; disabled?: boolean }[] }) {
  return (
    <div role="tablist" className="inline-flex gap-0.5 rounded-control bg-fill p-0.5">
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          role="tab"
          aria-selected={value === item.value}
          disabled={item.disabled}
          onClick={() => onChange(item.value)}
          className={`min-h-8 rounded-[10px] px-4 py-1.5 text-footnote font-medium transition-quick ${
            value === item.value ? 'bg-elevated text-label shadow-[0_1px_4px_rgb(0_0_0/0.12)]' : 'text-label-secondary hover:text-label disabled:opacity-40'
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}

export function PageHeader({ eyebrow, title, description, aside }: { eyebrow: string; title: string; description?: ReactNode; aside?: ReactNode }) {
  return (
    <header className="reveal flex flex-wrap items-end justify-between gap-6">
      <div className="max-w-[680px]">
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="mt-2 text-title-1 text-label">{title}</h1>
        {description && <p className="mt-3 text-body text-label-secondary">{description}</p>}
      </div>
      {aside}
    </header>
  )
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-card bg-fill px-6 py-10 text-center text-subhead text-label-secondary">
      <img src={hermiGuide} alt="" className="size-20" />
      {children}
    </div>
  )
}

export function SyntheticBadge({ show }: { show: boolean | undefined }) {
  if (!show) return null
  return <Badge tone="violet">가상 자료</Badge>
}
