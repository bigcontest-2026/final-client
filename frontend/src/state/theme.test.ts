import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { describe, expect, it } from 'vitest'

const script = readFileSync(new URL('../../public/theme-init.js', import.meta.url), 'utf8')
type Preference = 'system' | 'light' | 'dark'
interface Runtime {
  getSnapshot(): { preference: Preference; resolved: 'light' | 'dark' }
  setPreference(value: string): void
  subscribe(listener: () => void): () => void
}

function boot(options: { stored?: string; dark?: boolean; blocked?: boolean; noMedia?: boolean } = {}) {
  const values = new Map(options.stored ? [['hermes.theme', options.stored]] : [])
  const events: Record<string, (event: { key: string | null; newValue: string | null; storageArea?: unknown }) => void> = {}
  const media = { matches: options.dark ?? false, addEventListener: (_type: string, listener: () => void) => { mediaChange = listener } }
  let mediaChange = () => {}
  const root = { dataset: {} as Record<string, string>, style: {} as Record<string, string> }
  const meta = { content: '' }
  const localStorage = {
    getItem(key: string) { if (options.blocked) throw new Error('blocked'); return values.get(key) ?? null },
    setItem(key: string, value: string) { if (options.blocked) throw new Error('blocked'); values.set(key, value) },
  }
  const document = { documentElement: root, querySelector: () => meta }
  const window = {
    localStorage, matchMedia: options.noMedia ? undefined : () => media,
    addEventListener: (name: string, fn: typeof events[string]) => { events[name] = fn },
    __HERMES_THEME__: undefined as Runtime | undefined,
  }
  runInNewContext(script, { window, document })
  return { runtime: window.__HERMES_THEME__!, root, meta, values, localStorage,
    system(dark: boolean) { media.matches = dark; mediaChange() },
    storage(value: string | null, key: string | null = 'hermes.theme', storageArea?: unknown) {
      events.storage({ key, newValue: value, storageArea })
    },
    rerun() { runInNewContext(script, { window, document }) },
  }
}

describe('theme preference and first paint', () => {
  it('applies the system theme and native/browser colors before React mounts', () => {
    const app = boot({ dark: true })
    expect(app.runtime.getSnapshot()).toEqual({ preference: 'system', resolved: 'dark' })
    expect(app.root.dataset.theme).toBe('dark')
    expect(app.root.style.colorScheme).toBe('dark')
    expect(app.meta.content).toBe('#000000')
  })

  it.each([['light', true], ['dark', false]] as const)('restores explicit %s over an opposite system setting', (stored, dark) => {
    const app = boot({ stored, dark })
    expect(app.runtime.getSnapshot().resolved).toBe(stored)
    app.system(!dark)
    expect(app.runtime.getSnapshot().resolved).toBe(stored)
  })

  it('persists a manual selection and resumes system tracking when selected', () => {
    const app = boot()
    app.runtime.setPreference('dark')
    expect(app.values.get('hermes.theme')).toBe('dark')
    expect(app.meta.content).toBe('#000000')
    app.runtime.setPreference('system')
    expect(app.runtime.getSnapshot().resolved).toBe('light')
    app.system(true)
    expect(app.runtime.getSnapshot().resolved).toBe('dark')
  })

  it('falls back safely when storage or media APIs are unavailable', () => {
    const app = boot({ blocked: true, dark: true })
    expect(app.runtime.getSnapshot().resolved).toBe('dark')
    app.runtime.setPreference('light')
    expect(app.runtime.getSnapshot().resolved).toBe('light')
    expect(boot({ noMedia: true }).runtime.getSnapshot().resolved).toBe('light')
  })

  it('rejects invalid stored values and synchronizes changes and clearing across tabs', () => {
    const app = boot({ stored: '<invalid>', dark: true })
    expect(app.runtime.getSnapshot().preference).toBe('system')
    app.storage('light')
    expect(app.runtime.getSnapshot()).toEqual({ preference: 'light', resolved: 'light' })
    app.storage('dark', 'other.key')
    expect(app.runtime.getSnapshot().preference).toBe('light')
    app.storage(null, null)
    expect(app.runtime.getSnapshot()).toEqual({ preference: 'system', resolved: 'dark' })
  })

  it('does not treat sessionStorage changes as local theme preferences', () => {
    const app = boot()
    app.storage('dark', 'hermes.theme', {})
    expect(app.runtime.getSnapshot().resolved).toBe('light')
  })

  it('keeps snapshots stable and unsubscribes without duplicate notifications', () => {
    const app = boot()
    const first = app.runtime.getSnapshot()
    let count = 0
    const unsubscribe = app.runtime.subscribe(() => count++)
    app.runtime.setPreference('system')
    expect(app.runtime.getSnapshot()).toBe(first)
    expect(count).toBe(0)
    app.runtime.setPreference('dark')
    expect(count).toBe(1)
    unsubscribe()
    app.runtime.setPreference('light')
    expect(count).toBe(1)
    const runtime = app.runtime
    app.rerun()
    expect(app.runtime).toBe(runtime)
  })
})
