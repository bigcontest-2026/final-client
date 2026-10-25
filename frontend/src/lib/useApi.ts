import { useCallback, useEffect, useRef, useState } from 'react'
import { errorMessage, isAbort } from '../api/client'

export interface ApiState<T> {
  data: T | null
  error: string | null
  loading: boolean
  reload: () => void
  setData: (updater: T | null | ((current: T | null) => T | null)) => void
}

export function useApi<T>(load: ((signal: AbortSignal) => Promise<T>) | null, deps: unknown[]): ApiState<T> {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(Boolean(load))
  const [nonce, setNonce] = useState(0)
  const loadRef = useRef(load)
  loadRef.current = load

  useEffect(() => {
    const current = loadRef.current
    if (!current) {
      setLoading(false)
      return
    }
    const controller = new AbortController()
    setLoading(true)
    setError(null)
    current(controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) setData(result)
      })
      .catch((reason) => {
        if (controller.signal.aborted || isAbort(reason)) return
        setError(errorMessage(reason))
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [...deps, nonce])

  const reload = useCallback(() => setNonce((value) => value + 1), [])
  return { data, error, loading, reload, setData }
}
