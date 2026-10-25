const BASE_URL = (import.meta.env.VITE_MODEL_API_BASE_URL ?? '').replace(/\/$/, '')

const GENERIC_MESSAGE = '요청을 처리하지 못했습니다. 잠시 뒤 다시 시도해 주세요.'
const VALIDATION_MESSAGE = '입력값을 확인해 주세요.'

const FIELD_LABELS: Record<string, string> = {
  region_code: '시군구',
  dong_code: '행정동',
  month: '기준월',
  sex_code: '성별',
  age_code: '연령',
  title: '대응안 이름',
  target: '대상과 범위',
  content: '실행 내용',
  rationale: '분석과 연결한 이유',
  checks: '실행 전 확인할 사항',
  instruction: '요청 내용',
  url: '사업 링크',
}

export class ApiError extends Error {
  status: number
  code: string | null
  detail: unknown
  retryAfter: number | null

  constructor(status: number, message: string, code: string | null, detail: unknown, retryAfter: number | null) {
    super(message)
    this.status = status
    this.code = code
    this.detail = detail
    this.retryAfter = retryAfter
  }
}

export function describeErrorDetail(status: number, body: unknown): { message: string; code: string | null } {
  const detail = (body as { detail?: unknown } | null)?.detail
  if (typeof detail === 'string') return { message: detail, code: null }
  if (Array.isArray(detail)) {
    const fields = detail
      .map((item) => (item as { loc?: unknown[] }).loc?.filter((part) => typeof part === 'string' && part !== 'body').pop())
      .filter((field): field is string => typeof field === 'string')
      .map((field) => FIELD_LABELS[field] ?? field)
    const unique = [...new Set(fields)]
    return { message: unique.length ? `${VALIDATION_MESSAGE} (${unique.join(', ')})` : VALIDATION_MESSAGE, code: 'validation_error' }
  }
  if (detail && typeof detail === 'object') {
    const { code, message } = detail as { code?: string; message?: string }
    return { message: message || messageForStatus(status, code), code: code ?? null }
  }
  return { message: messageForStatus(status, null), code: null }
}

function messageForStatus(status: number, code: string | null | undefined): string {
  if (code === 'local_development_only') return '로컬 개발 모드에서는 이 컴퓨터에서만 서버를 부를 수 있습니다. 프록시 설정을 확인해 주세요.'
  if (status === 401) return '로그인이 필요합니다.'
  if (status === 403) return '이 기능을 쓸 권한이 없습니다.'
  if (status === 404) return '요청한 자료를 찾지 못했습니다.'
  if (status === 409) return '다른 화면에서 내용이 바뀌었습니다. 새로 불러온 뒤 다시 시도해 주세요.'
  if (status === 503) return '서버 자료나 연결이 준비되지 않았습니다. 잠시 뒤 다시 시도해 주세요.'
  return GENERIC_MESSAGE
}

type QueryValue = string | number | boolean | null | undefined | string[]

export function buildQuery(params: Record<string, QueryValue>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue
    if (Array.isArray(value)) value.forEach((item) => search.append(key, item))
    else search.set(key, String(value))
  }
  const text = search.toString()
  return text ? `?${text}` : ''
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT'
  query?: Record<string, QueryValue>
  body?: unknown
  signal?: AbortSignal
  timeoutMs?: number
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', query, body, signal, timeoutMs = 30_000 } = options
  const timeout = AbortSignal.timeout(timeoutMs)
  const combined = signal ? AbortSignal.any([signal, timeout]) : timeout
  let response: Response
  try {
    response = await fetch(`${BASE_URL}${path}${query ? buildQuery(query) : ''}`, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: combined,
    })
  } catch (error) {
    if (signal?.aborted) throw error
    if (timeout.aborted) throw new ApiError(0, '서버 응답이 너무 오래 걸립니다. 잠시 뒤 다시 시도해 주세요.', 'timeout', null, null)
    throw new ApiError(0, '서버에 연결하지 못했습니다. 서버가 켜져 있는지 확인해 주세요.', 'network_error', null, null)
  }
  const text = await response.text()
  let data: unknown = null
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = null
    }
  }
  if (!response.ok) {
    const { message, code } = describeErrorDetail(response.status, data)
    const retryHeader = response.headers.get('Retry-After')
    throw new ApiError(response.status, message, code, (data as { detail?: unknown } | null)?.detail ?? null, retryHeader ? Number(retryHeader) : null)
  }
  return data as T
}

export function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message
  return GENERIC_MESSAGE
}
