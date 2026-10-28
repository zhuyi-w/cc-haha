import { afterEach, describe, expect, test } from 'bun:test'
import {
  isOpenAIChatStreamOptionsRejection,
  rememberOpenAIChatStreamUsageUnsupported,
  resetOpenAIChatStreamUsageSupportForTests,
  shouldOmitOpenAIChatStreamUsage,
} from './openaiChatStreamOptionsSupport.js'
import type { OpenAIChatRequest } from './transform/types.js'

const streamingRequest: OpenAIChatRequest = {
  model: 'gpt-5.6-sol',
  messages: [{ role: 'user', content: 'hello' }],
  stream: true,
  stream_options: { include_usage: true },
}

afterEach(resetOpenAIChatStreamUsageSupportForTests)

describe('isOpenAIChatStreamOptionsRejection', () => {
  test('recognises structured and plain-text rejections of stream_options', () => {
    expect(isOpenAIChatStreamOptionsRejection(
      400,
      JSON.stringify({ error: { param: 'stream_options', message: 'Unsupported parameter' } }),
      streamingRequest,
    )).toBe(true)
    expect(isOpenAIChatStreamOptionsRejection(
      422,
      JSON.stringify({ error: { param: 'stream_options.include_usage', message: 'Unsupported parameter' } }),
      streamingRequest,
    )).toBe(true)
    expect(isOpenAIChatStreamOptionsRejection(
      400,
      JSON.stringify({ error: { message: 'Unrecognized request argument supplied: stream_options' } }),
      streamingRequest,
    )).toBe(true)
    expect(isOpenAIChatStreamOptionsRejection(400, 'Unsupported field: include_usage', streamingRequest)).toBe(true)
  })

  test('ignores other failures, non-validation statuses and requests without stream_options', () => {
    expect(isOpenAIChatStreamOptionsRejection(
      400,
      JSON.stringify({ error: { param: 'reasoning_effort', message: 'Unsupported parameter' } }),
      streamingRequest,
    )).toBe(false)
    expect(isOpenAIChatStreamOptionsRejection(400, 'Unknown model', streamingRequest)).toBe(false)
    expect(isOpenAIChatStreamOptionsRejection(500, 'stream_options rejected', streamingRequest)).toBe(false)
    expect(isOpenAIChatStreamOptionsRejection(
      400,
      'stream_options rejected',
      { ...streamingRequest, stream_options: undefined },
    )).toBe(false)
  })
})

describe('learned stream usage support', () => {
  test('is scoped to one endpoint, ignores case and trailing slashes, and expires', () => {
    const endpoint = 'https://gateway.example/v1/chat/completions/'
    rememberOpenAIChatStreamUsageUnsupported(endpoint, 1_000_000)

    expect(shouldOmitOpenAIChatStreamUsage(endpoint, 1_000_001)).toBe(true)
    expect(shouldOmitOpenAIChatStreamUsage('HTTPS://GATEWAY.EXAMPLE/v1/chat/completions', 1_000_001)).toBe(true)
    expect(shouldOmitOpenAIChatStreamUsage('https://other.example/v1/chat/completions', 1_000_001)).toBe(false)
    expect(shouldOmitOpenAIChatStreamUsage(endpoint, 1_000_000 + 30 * 60_000 + 1)).toBe(false)
    // Expired entries are removed instead of lingering forever.
    expect(shouldOmitOpenAIChatStreamUsage(endpoint, 1_000_000 + 31 * 60_000)).toBe(false)
  })
})
