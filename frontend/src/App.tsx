import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { GlobalNav } from './components/Header'
import { ModalHost } from './components/ModalHost'
import { Notice } from './components/ui'
import { useHealth } from './lib/regions'
import { DashboardPage } from './pages/DashboardPage'
import { MainPage } from './pages/MainPage'
import { WelfarePage } from './pages/WelfarePage'
import { ModalProvider } from './state/modals'

function HealthBanner() {
  const { health, error } = useHealth()
  if (error) {
    return (
      <Notice tone="warn" className="mx-auto mt-6 w-[calc(100%-2*var(--spacing-gutter))] max-w-[1240px]">
        서버에 연결하지 못했습니다. API 서버가 켜져 있는지 확인해 주세요. ({error})
      </Notice>
    )
  }
  if (health && health.status !== 'ok') {
    const missing = Object.entries(health.sources)
      .filter(([, source]) => !source.ready)
      .map(([name]) => (name === 'activity' ? '활동 자료' : name === 'survey' ? 'I5 자료' : name))
    return (
      <Notice tone="warn" className="mx-auto mt-6 w-[calc(100%-2*var(--spacing-gutter))] max-w-[1240px]">
        일부 자료가 준비되지 않았습니다: {missing.join(', ')}. 해당 기능은 결과가 비어 있을 수 있습니다.
      </Notice>
    )
  }
  return null
}

function Layout() {
  return (
    <div className="flex min-h-dvh flex-col">
      <GlobalNav />
      <HealthBanner />
      <main className="flex-1">
        <Outlet />
      </main>
      <footer className="border-t border-separator">
        <p className="mx-auto max-w-[1240px] px-gutter py-6 text-footnote text-label-secondary">
          HERMES는 참고 자료를 모아 보여 줍니다. 활동 변화는 시군구 단위 참고 자료이며 고립 판정이나 경보가 아닙니다. 지원 필요·자격·접수 여부는 담당자가 확인하고 최종 판단합니다.
        </p>
      </footer>
      <ModalHost />
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <ModalProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<MainPage />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="welfare" element={<WelfarePage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </ModalProvider>
    </BrowserRouter>
  )
}
