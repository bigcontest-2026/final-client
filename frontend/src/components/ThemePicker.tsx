import { useTheme, type ThemePreference } from '../state/theme'

export function ThemePicker() {
  const { preference, resolved, setPreference } = useTheme()
  return (
    <div className="shrink-0">
      <label htmlFor="theme-preference" className="sr-only">화면 모드</label>
      <select
        id="theme-preference"
        value={preference}
        onChange={(event) => setPreference(event.target.value as ThemePreference)}
        title={`화면 모드 · 현재 ${resolved === 'dark' ? '다크' : '라이트'}`}
        className="min-h-11 w-26 cursor-pointer rounded-full border border-separator-opaque bg-field px-3 text-footnote font-medium text-label transition-quick hover:bg-fill focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <option value="system">시스템</option>
        <option value="light">라이트</option>
        <option value="dark">다크</option>
      </select>
    </div>
  )
}
