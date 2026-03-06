import { describe, it, expect } from 'vitest'
import { extractJson } from '../ollama-client'

describe('extractJson', () => {
  it('parses plain JSON', () => {
    expect(extractJson('{"annotations": []}'))
      .toEqual({ annotations: [] })
  })

  it('strips markdown code fence', () => {
    const raw = 'Here is the result:\n```json\n{"annotations": [{"keyword": "diabetes", "tag": "Disease"}]}\n```'
    expect(extractJson(raw).annotations[0].tag).toBe('Disease')
  })

  it('strips closed <think> blocks', () => {
    const raw = '<think>reasoning here</think>{"annotations": []}'
    expect(extractJson(raw)).toEqual({ annotations: [] })
  })

  it('strips unclosed <think> block', () => {
    const raw = '{"annotations": []}<think>model kept thinking...'
    expect(extractJson(raw)).toEqual({ annotations: [] })
  })

  it('extracts JSON from surrounding text', () => {
    const raw = 'Sure! Here is the annotation:\n{"annotations": [{"keyword": "flu", "tag": "Disease"}]}\nHope this helps!'
    expect(extractJson(raw).annotations[0].keyword).toBe('flu')
  })

  it('handles nested braces', () => {
    const raw = '{"annotations": [{"keyword": "a{b}", "tag": "X"}]}'
    expect(extractJson(raw).annotations[0].keyword).toBe('a{b}')
  })

  it('returns null for unparseable input', () => {
    expect(extractJson('no json here')).toBeNull()
    expect(extractJson('')).toBeNull()
  })
})
