import type { OpenAIChatRequest } from './transform/types.js'

// `stream_options.include_usage` is requested so streamed turns report token
// usage. Older OpenAI-compatible gateways reject the field outright; dropping
// it keeps the turn working (usage falls back to the stream's own counts).
// Knowledge is scoped to the endpoint and expires, so a server that gains
// support recovers without a restart.
const UNSUPPORTED_TTL_MS = 30 * 60 * 1000
const MAX_ENDPOINTS = 256
const unsupportedUntil = new Map<string, number>()

function endpointKey(endpointUrl: string): string {
  return endpointUrl.replace(/\/+$/, '').toLowerCase()
}

export function shouldOmitOpenAIChatStreamUsage(
  endpointUrl: string,
  now = Date.now(),
): boolean {
  const key = endpointKey(endpointUrl)
  const until = unsupportedUntil.get(key)
  if (until === undefined) return false
  if (until > now) return true
  unsupportedUntil.delete(key)
  return false
}

export function rememberOpenAIChatStreamUsageUnsupported(
  endpointUrl: string,
  now = Date.now(),
): void {
  const key = endpointKey(endpointUrl)
  if (!unsupportedUntil.has(key) && unsupportedUntil.size >= MAX_ENDPOINTS) {
    const oldest = unsupportedUntil.keys().next().value
    if (oldest !== undefined) unsupportedUntil.delete(oldest)
  }
  unsupportedUntil.set(key, now + UNSUPPORTED_TTL_MS)
}

/**
 * Whether a failed upstream response names `stream_options`/`include_usage` as
 * the rejected field. Some gateways only say so in the message, so both the
 * structured `error.param` and the message are inspected.
 */
export function isOpenAIChatStreamOptionsRejection(
  status: number,
  errorText: string,
  request: OpenAIChatRequest,
): boolean {
  if (status !== 400 && status !== 422) return false
  if (request.stream_options === undefined) return false

  let message = errorText
  let param: unknown
  try {
    const body = JSON.parse(errorText) as { error?: { param?: unknown; message?: unknown } }
    param = body?.error?.param
    if (typeof body?.error?.message === 'string' && body.error.message) {
      message = body.error.message
    }
  } catch {
    // Plain-text rejections are matched by the same message pattern below.
  }

  if (typeof param === 'string' && (param === 'stream_options' || param.startsWith('stream_options.'))) {
    return true
  }
  return /\bstream_options\b|\binclude_usage\b/i.test(message)
}

export function resetOpenAIChatStreamUsageSupportForTests(): void {
  unsupportedUntil.clear()
}
