import { afterEach, expect, it, vi } from 'vitest'
import { requestBlob } from '../api/client'

afterEach(() => vi.unstubAllGlobals())
it('downloads binary bytes without JSON parsing', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('%PDF-test', { headers: { 'Content-Type': 'application/pdf' } })))
  const blob = await requestBlob('/api/model/response-reports/id/export?format=pdf')
  expect(blob.type).toBe('application/pdf')
  expect(await blob.text()).toBe('%PDF-test')
})
it('surfaces server export errors instead of downloading an error document', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ detail: { message: '문서 변환에 실패했습니다.' } }), { status: 503 })))
  await expect(requestBlob('/export')).rejects.toThrow('문서 변환에 실패했습니다.')
})
