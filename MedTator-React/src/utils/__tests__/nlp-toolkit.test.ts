import { describe, it, expect } from 'vitest'
import {
  sentTokenize,
  docSpanToSentenceOffset,
  sentenceOffsetToDocPos,
  ensureAnnSentences,
} from '../nlp-toolkit'

describe('sentTokenize', () => {
  it('splits on period, question, exclamation, semicolon, newline', () => {
    const r = sentTokenize('Hello. How? Wow! A; B\nC')
    expect(r.sentences.map(s => s.text)).toEqual([
      'Hello.', ' How?', ' Wow!', ' A;', ' B', 'C',
    ])
  })

  it('does not split on abbreviations after a space', () => {
    const r = sentTokenize('See Dr. Smith now. Take daily.')
    expect(r.sentences).toHaveLength(2)
    expect(r.sentences[0].text).toBe('See Dr. Smith now.')
  })

  it('does not split on dot inside IP address', () => {
    const r = sentTokenize('Server is 192.168.1.1 now.')
    expect(r.sentences).toHaveLength(1)
  })

  it('handles empty string', () => {
    expect(sentTokenize('').sentences).toHaveLength(0)
  })
})

describe('roundtrip: docPos → sentenceOffset → docPos', () => {
  it('roundtrips positions across sentences', () => {
    const text = 'Patient has headache. See Dr. Smith now. Take daily.'
    const { sentences } = sentTokenize(text)
    for (let pos = 0; pos < text.length; pos++) {
      const offset = docSpanToSentenceOffset(pos, sentences)
      if (offset === null) continue
      expect(sentenceOffsetToDocPos(offset, sentences)).toBe(pos)
    }
  })
})

describe('ensureAnnSentences', () => {
  it('lazily computes and caches sentences', () => {
    const ann = { text: 'One. Two.', _sentences: [] as any[], _sentences_text: '' }
    ensureAnnSentences(ann)
    expect(ann._sentences).toHaveLength(2)
    expect(ann._sentences_text).toContain('One.')
    // Does not recompute
    ann._sentences = [{ text: 'Cached', spans: { start: 0, end: 5 } }]
    ensureAnnSentences(ann)
    expect(ann._sentences).toHaveLength(1)
  })
})
