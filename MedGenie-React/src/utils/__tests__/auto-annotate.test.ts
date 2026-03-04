import { describe, it, expect } from 'vitest'
import { llmAnnotationsToTags, isNegatedByContext } from '../auto-annotate'
import type { Ann, Dtd, DtdTag } from '../../types'

const mkTagDef = (name: string, prefix: string): DtdTag => ({
  name, type: 'etag', is_non_consuming: false, id_prefix: prefix,
  shortcut: null, style: { color: '#000' }, attrs: [], attr_dict: {},
})

const mkDtd = (etags: DtdTag[]): Dtd => {
  const tag_dict: Record<string, DtdTag> = {}
  for (const t of etags) tag_dict[t.name] = t
  return { name: 'TEST', etags, rtags: [], id_prefix_dict: {}, tag_dict, text: null }
}

const mkAnn = (text: string, tags: any[] = []): Ann => ({
  text, dtd_name: 'TEST', tags: [...tags], meta: {},
  _fh: null, _filename: null, _has_saved: true, _sentences: [], _sentences_text: '',
})

describe('auto-annotate', () => {
  const SYM = mkTagDef('SYMPTOM', 'S')
  const MED = mkTagDef('MEDICATION', 'M')
  const dtd = mkDtd([SYM, MED])

  it('matches keywords via getLocs and creates tags with correct spans', () => {
    const ann = mkAnn('Patient has headache and nausea.')
    const result = llmAnnotationsToTags(
      [{ keyword: 'headache', tag: 'SYMPTOM' }, { keyword: 'nausea', tag: 'SYMPTOM' }],
      ann, dtd
    )
    expect(result).toHaveLength(2)
    expect(result[0].spans).toBe('12~20')
    expect(result[0].text).toBe('headache')
    expect(result[0].tag).toBe('SYMPTOM')
    expect(result[1].spans).toBe('25~31')
    expect(result[1].text).toBe('nausea')
    expect(result[0].id).toBe('S0')
    expect(result[1].id).toBe('S1')
  })

  it('skips keywords not found in text', () => {
    const ann = mkAnn('Patient is fine.')
    const result = llmAnnotationsToTags(
      [{ keyword: 'headache', tag: 'SYMPTOM' }],
      ann, dtd
    )
    expect(result).toHaveLength(0)
  })

  it('skips invalid tag names not in dtd', () => {
    const ann = mkAnn('Patient has headache.')
    const result = llmAnnotationsToTags(
      [{ keyword: 'headache', tag: 'UNKNOWN_TAG' }],
      ann, dtd
    )
    expect(result).toHaveLength(0)
  })

  it('skips overlapping spans with existing tags', () => {
    const ann = mkAnn('Patient has headache.', [
      { tag: 'SYMPTOM', id: 'S0', spans: '12~20', text: 'headache' },
    ])
    const result = llmAnnotationsToTags(
      [{ keyword: 'headache', tag: 'SYMPTOM' }],
      ann, dtd
    )
    expect(result).toHaveLength(0)
  })

  it('finds multiple occurrences of the same keyword', () => {
    const ann = mkAnn('headache in morning, headache at night.')
    const result = llmAnnotationsToTags(
      [{ keyword: 'headache', tag: 'SYMPTOM' }],
      ann, dtd
    )
    expect(result).toHaveLength(2)
    expect(result[0].spans).toBe('0~8')
    expect(result[1].spans).toBe('21~29')
  })

  it('does not mutate ann.tags after returning', () => {
    const ann = mkAnn('Patient has headache.')
    const originalLen = ann.tags.length
    llmAnnotationsToTags([{ keyword: 'headache', tag: 'SYMPTOM' }], ann, dtd)
    expect(ann.tags.length).toBe(originalLen)
  })

  it('matches keyword with one space against text with multiple spaces', () => {
    const ann = mkAnn('Patient has blood  pressure issues.')
    const result = llmAnnotationsToTags(
      [{ keyword: 'blood pressure', tag: 'SYMPTOM' }],
      ann, dtd
    )
    expect(result).toHaveLength(1)
    expect(result[0].spans).toBe('12~27')
    expect(result[0].text).toBe('blood  pressure')
  })

  describe('isNegatedByContext', () => {
    // Pre-negation (cue before keyword)
    it('detects "denies X" pattern', () => {
      const text = 'Patient denies chest pain and feels fine.'
      expect(isNegatedByContext(text, 15)).toBe(true)
    })

    it('detects "no X" pattern', () => {
      const text = 'He has no headache today.'
      expect(isNegatedByContext(text, 10)).toBe(true)
    })

    it('detects "doesn\'t have X" pattern', () => {
      const text = "He doesn't have fever."
      expect(isNegatedByContext(text, 16)).toBe(true)
    })

    it('detects "negative for X" pattern', () => {
      const text = 'Lab results negative for pneumonia.'
      expect(isNegatedByContext(text, 25)).toBe(true)
    })

    it('does not flag positive mentions', () => {
      const text = 'Patient reports nausea and headache.'
      expect(isNegatedByContext(text, 16)).toBe(false)
    })

    it('sentence boundary resets negation scope', () => {
      const text = "He doesn't have fever. Reports nausea."
      expect(isNegatedByContext(text, text.indexOf('nausea'))).toBe(false)
    })

    it('ignores negation cues outside the 60-char window', () => {
      const text = 'Patient denies pain. ' + 'X'.repeat(60) + ' nausea is present.'
      expect(isNegatedByContext(text, text.indexOf('nausea'))).toBe(false)
    })

    // Post-negation (cue after keyword)
    it('detects "X: absent" pattern', () => {
      const text = 'Fever: absent. Patient reports headache.'
      // "Fever" at 0~5, ": absent" follows
      expect(isNegatedByContext(text, 0, 5)).toBe(true)
    })

    it('detects "X not found" pattern', () => {
      const text = 'The chest pain was not found in follow-up.'
      // "chest pain" at 4~14
      expect(isNegatedByContext(text, 4, 14)).toBe(true)
    })

    it('post-negation does not cross sentence boundary', () => {
      const text = 'Headache was reported. Fever: absent.'
      // "Headache" at 0~8; "absent" is in the next sentence
      expect(isNegatedByContext(text, 0, 8)).toBe(false)
    })
  })

  // Integration: context window catches pre-negation
  it('context window catches "no X" pre-negation', () => {
    const ann = mkAnn('Patient has no headache.')
    const result = llmAnnotationsToTags(
      [{ keyword: 'headache', tag: 'SYMPTOM' }],
      ann, dtd
    )
    expect(result).toHaveLength(0)
  })

  it('context window catches "denies X" pre-negation', () => {
    const ann = mkAnn('Patient denies chest pain and feels fine.')
    const result = llmAnnotationsToTags(
      [{ keyword: 'chest pain', tag: 'SYMPTOM' }],
      ann, dtd
    )
    expect(result).toHaveLength(0)
  })

  it('context window catches "X: absent" post-negation', () => {
    const ann = mkAnn('Fever: absent. Patient reports nausea.')
    const result = llmAnnotationsToTags(
      [{ keyword: 'Fever', tag: 'SYMPTOM' }, { keyword: 'nausea', tag: 'SYMPTOM' }],
      ann, dtd
    )
    expect(result).toHaveLength(1)
    expect(result[0].text).toBe('nausea')
  })

  it('context window keeps positive when negation is in different sentence', () => {
    const ann = mkAnn('Patient denies fever but reports nausea.')
    const result = llmAnnotationsToTags(
      [{ keyword: 'fever', tag: 'SYMPTOM' }, { keyword: 'nausea', tag: 'SYMPTOM' }],
      ann, dtd
    )
    expect(result).toHaveLength(1)
    expect(result[0].text).toBe('nausea')
  })
})
