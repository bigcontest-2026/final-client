import { NavLink } from 'react-router-dom'
import logo from '../assets/hermi/hermi-4.png'
import { useModals } from '../state/modals'
import { Icon } from './icons'

const NAV = [
  { to: '/', label: '헤르미와 대화', end: true },
  { to: '/dashboard', label: '대시보드' },
  { to: '/welfare', label: '복지 리스트' },
]

export function GlobalNav() {
  const { modal, open } = useModals()
  const savedOpen = modal?.type === 'savedReports'
  const itemClass = (active: boolean) =>
    `flex min-h-9 shrink-0 items-center rounded-full px-3.5 text-subhead whitespace-nowrap transition-quick ${active ? 'bg-fill font-semibold text-label' : 'text-label-secondary hover:text-label'}`

  return (
    <header className="glass sticky top-0 z-40 border-b border-separator">
      <div className="mx-auto flex max-w-[1240px] flex-wrap items-center gap-x-6 px-gutter md:h-14 md:flex-nowrap">
        <NavLink to="/" aria-label="HERMES 홈" className="flex h-13 shrink-0 items-center gap-2 md:h-auto">
          <img src={logo} alt="" className="size-8" />
          <span className="text-headline tracking-[0.06em] text-label">HERMES</span>
        </NavLink>
        <nav aria-label="주 메뉴" className="order-last -mx-gutter flex w-[calc(100%+2*var(--spacing-gutter))] min-w-0 gap-1 overflow-x-auto px-gutter pb-2.5 md:order-none md:mx-0 md:w-auto md:flex-1 md:px-0 md:pb-0">
          {NAV.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => itemClass(isActive && !savedOpen)}>
              {item.label}
            </NavLink>
          ))}
          <button type="button" className={itemClass(savedOpen)} aria-pressed={savedOpen} onClick={() => open({ type: 'savedReports' })}>
            저장된 보고서
          </button>
        </nav>
        <button
          type="button"
          onClick={() => open({ type: 'history' })}
          className="ml-auto flex min-h-9 items-center gap-1.5 rounded-full px-3 text-subhead text-link transition-quick hover:bg-accent-tint"
        >
          <Icon name="history" className="size-[18px]" />
          대화 이력
        </button>
      </div>
    </header>
  )
}
