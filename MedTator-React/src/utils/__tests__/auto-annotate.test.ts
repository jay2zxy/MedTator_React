import { describe, it, expect } from 'vitest'
import { llmAnnotationsToTags } from '../auto-annotate'
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
    // IDs auto-increment
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
})
