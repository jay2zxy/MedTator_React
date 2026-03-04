import { describe, it, expect } from 'vitest'
import { makeEtag, makeEmptyRtagByDef, getIdrefAttrs } from '../tag-helper'
import type { Ann, DtdTag } from '../../types'

const mkTagDef = (name: string, type: 'etag' | 'rtag', prefix: string, attrs: any[] = []): DtdTag => ({
  name, type, is_non_consuming: false, id_prefix: prefix,
  shortcut: null, style: { color: '#000' }, attrs, attr_dict: {},
})

const mkAnn = (tags: any[] = []): Ann => ({
  text: 'test', dtd_name: 'T', tags, meta: {},
  _fh: null, _filename: null, _has_saved: true, _sentences: [], _sentences_text: '',
})

describe('tag-helper', () => {
  it('makeEtag auto-increments ID and fills defaults', () => {
    const def = mkTagDef('SYM', 'etag', 'S', [
      { name: 'severity', vtype: 'list', values: ['mild', 'severe'], default_value: 'mild', require: 'IMPLIED', element: '', type: 'attr' },
    ])
    const ann = mkAnn([{ tag: 'SYM', id: 'S0', spans: '0~3', text: 'abc' }])
    const tag = makeEtag({ spans: '5~8', text: 'xyz' }, def, ann)
    expect(tag.id).toBe('S1')
    expect(tag.severity).toBe('mild')
  })

  it('makeEmptyRtagByDef creates relation with empty IDREFs', () => {
    const def = mkTagDef('LK', 'rtag', 'L', [
      { name: 'arg1', vtype: 'idref', values: [], default_value: '', require: 'REQUIRED', element: '', type: 'attr' },
      { name: 'rel', vtype: 'list', values: ['a', 'b'], default_value: 'a', require: 'IMPLIED', element: '', type: 'attr' },
    ])
    const tag = makeEmptyRtagByDef(def)
    expect(tag.arg1).toBe('')
    expect(tag.rel).toBe('a')
    expect(tag.spans).toBeUndefined()
  })

  it('getIdrefAttrs filters IDREF only', () => {
    const def = mkTagDef('LK', 'rtag', 'L', [
      { name: 'a', vtype: 'idref', values: [], default_value: '', require: 'REQUIRED', element: '', type: 'attr' },
      { name: 'b', vtype: 'text', values: [], default_value: '', require: 'IMPLIED', element: '', type: 'attr' },
    ])
    expect(getIdrefAttrs(def)).toHaveLength(1)
  })
})
