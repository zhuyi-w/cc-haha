import { describe, expect, test } from 'bun:test'
import { anthropicToOpenaiChat } from './anthropicToOpenaiChat.js'

describe('OpenAI Chat thinking toggle compatibility', () => {
  for (const [input, expected] of [['adaptive', 'enabled'], ['enabled', 'enabled'], ['disabled', 'disabled']] as const) {
    test(`sends ${expected} for Anthropic ${input} thinking`, () => {
      const result = anthropicToOpenaiChat({
        model: 'deepseek-v4.1-flash',
        messages: [{ role: 'user', content: 'hello' }],
        max_tokens: 256,
        thinking: { type: input },
        output_config: { effort: 'high' },
      }, { passThinkingToggle: true })

      expect(result.thinking).toEqual({ type: expected })
      expect(result.reasoning_effort).toBe('high')
    })
  }

  test('does not introduce the toggle on endpoints that did not opt in', () => {
    expect(anthropicToOpenaiChat({
      model: 'fixture', messages: [], max_tokens: 256, thinking: { type: 'adaptive' },
    }).thinking).toBeUndefined()
  })
})

describe('OpenAI Chat stream usage request', () => {
  const body = {
    model: 'gpt-5.6-sol',
    messages: [{ role: 'user' as const, content: 'hello' }],
    max_tokens: 256,
    stream: true,
  }

  test('asks for usage by default and omits it for endpoints that rejected the field', () => {
    expect(anthropicToOpenaiChat(body).stream_options).toEqual({ include_usage: true })
    expect(anthropicToOpenaiChat(body, { passStreamUsage: false }).stream_options).toBeUndefined()
  })
})
