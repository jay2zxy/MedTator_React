import { describe, it, expect } from 'vitest'
import { makeEtag, makeEmptyEtagByDef, makeEmptyRtagByDef, getIdrefAttrs } from '../tag-helper'
import type { Ann, DtdTag, DtdAttr } from '../../types'
import { NON_CONSUMING_SPANS } from '../../parsers/dtd-parser'

describe('tag-helper', () => {
  describe('makeEtag', () => {
    it('should create entity tag with auto-generated ID and default attributes', () => {
      const tagDef: DtdTag = {
        name: 'SYMPTOM',
        type: 'etag',
        is_non_consuming: false,
        id_prefix: 'S',
        shortcut: 's',
        style: { color: '#ff0000' },
        attrs: [
          { name: 'certainty', vtype: 'list', values: ['high', 'low'], default_value: 'high', require: 'REQUIRED', element: '', type: 'attr' },
          { name: 'severity', vtype: 'text', values: [], default_value: '', require: 'IMPLIED', element: '', type: 'attr' },
        ],
        attr_dict: {},
      }

      const ann: Ann = {
        text: 'Patient has headache',
        dtd_name: 'TEST',
        tags: [
          { tag: 'SYMPTOM', id: 'S0', spans: '12~20', text: 'headache' },
        ],
        meta: {},
        _fh: null,
        _filename: null,
        _has_saved: true,
        _sentences: [],
        _sentences_text: '',
      }

      const basicTag = { spans: '0~7', text: 'Patient' }
      const result = makeEtag(basicTag, tagDef, ann)

      expect(result.tag).toBe('SYMPTOM')
      expect(result.id).toBe('S1') // Next ID after S0
      expect(result.spans).toBe('0~7')
      expect(result.text).toBe('Patient')
      expect(result.certainty).toBe('high')
      expect(result.severity).toBe('')
    })

    it('should not overwrite existing attributes in basicTag', () => {
      const tagDef: DtdTag = {
        name: 'DISEASE',
        type: 'etag',
        is_non_consuming: false,
        id_prefix: 'D',
        shortcut: 'd',
        style: { color: '#00ff00' },
        attrs: [
          { name: 'status', vtype: 'list', values: ['active', 'resolved'], default_value: 'active', require: 'REQUIRED', element: '', type: 'attr' },
        ],
        attr_dict: {},
      }

      const ann: Ann = {
        text: 'Test',
        dtd_name: 'TEST',
        tags: [],
        meta: {},
        _fh: null,
        _filename: null,
        _has_saved: true,
        _sentences: [],
        _sentences_text: '',
      }

      const basicTag = { spans: '0~4', text: 'Test', status: 'resolved' }
      const result = makeEtag(basicTag, tagDef, ann)

      expect(result.status).toBe('resolved') // Should keep custom value
    })
  })

  describe('makeEmptyEtagByDef', () => {
    it('should create non-consuming entity tag', () => {
      const tagDef: DtdTag = {
        name: 'METADATA',
        type: 'etag',
        is_non_consuming: true,
        id_prefix: 'M',
        shortcut: null,
        style: { color: '#0000ff' },
        attrs: [
          { name: 'source', vtype: 'text', values: [], default_value: 'manual', require: 'IMPLIED', element: '', type: 'attr' },
        ],
        attr_dict: {},
      }

      const result = makeEmptyEtagByDef(tagDef)

      expect(result.tag).toBe('METADATA')
      expect(result.id).toBe('')
      expect(result.spans).toBe(NON_CONSUMING_SPANS)
      expect(result.text).toBe('')
      expect(result.source).toBe('manual')
    })

    it('should set spans to NON_CONSUMING_SPANS if spans attr exists', () => {
      const tagDef: DtdTag = {
        name: 'DOCLEVEL',
        type: 'etag',
        is_non_consuming: false,
        id_prefix: 'DL',
        shortcut: null,
        style: { color: '#ff00ff' },
        attrs: [
          { name: 'spans', vtype: 'text', values: [], default_value: '', require: 'REQUIRED', element: '', type: 'attr' },
        ],
        attr_dict: {},
      }

      const result = makeEmptyEtagByDef(tagDef)

      expect(result.spans).toBe(NON_CONSUMING_SPANS)
    })
  })

  describe('makeEmptyRtagByDef', () => {
    it('should create empty relation tag with default attributes', () => {
      const tagDef: DtdTag = {
        name: 'LK_SYMPTOM_DISEASE',
        type: 'rtag',
        is_non_consuming: false,
        id_prefix: 'L',
        shortcut: null,
        style: { color: '#ffff00' },
        attrs: [
          { name: 'arg1', vtype: 'idref', values: [], default_value: '', require: 'REQUIRED', element: '', type: 'attr' },
          { name: 'arg2', vtype: 'idref', values: [], default_value: '', require: 'REQUIRED', element: '', type: 'attr' },
          { name: 'relation_type', vtype: 'list', values: ['causes', 'indicates'], default_value: 'causes', require: 'IMPLIED', element: '', type: 'attr' },
        ],
        attr_dict: {},
      }

      const result = makeEmptyRtagByDef(tagDef)

      expect(result.tag).toBe('LK_SYMPTOM_DISEASE')
      expect(result.id).toBe('')
      expect(result.spans).toBeUndefined()
      expect(result.arg1).toBe('')
      expect(result.arg2).toBe('')
      expect(result.relation_type).toBe('causes')
    })

    it('should skip spans attribute for rtag', () => {
      const tagDef: DtdTag = {
        name: 'LINK',
        type: 'rtag',
        is_non_consuming: false,
        id_prefix: 'LK',
        shortcut: null,
        style: { color: '#00ffff' },
        attrs: [
          { name: 'spans', vtype: 'text', values: [], default_value: '0~0', require: 'IMPLIED', element: '', type: 'attr' },
        ],
        attr_dict: {},
      }

      const result = makeEmptyRtagByDef(tagDef)

      expect(result.spans).toBeUndefined()
    })
  })

  describe('getIdrefAttrs', () => {
    it('should return only IDREF attributes', () => {
      const attrs: DtdAttr[] = [
        { name: 'arg1', vtype: 'idref', values: [], default_value: '', require: 'REQUIRED', element: '', type: 'attr' },
        { name: 'arg2', vtype: 'idref', values: [], default_value: '', require: 'REQUIRED', element: '', type: 'attr' },
        { name: 'type', vtype: 'list', values: ['a', 'b'], default_value: 'a', require: 'IMPLIED', element: '', type: 'attr' },
        { name: 'note', vtype: 'text', values: [], default_value: '', require: 'IMPLIED', element: '', type: 'attr' },
      ]

      const tagDef: DtdTag = {
        name: 'RELATION',
        type: 'rtag',
        is_non_consuming: false,
        id_prefix: 'R',
        shortcut: null,
        style: { color: '#ffffff' },
        attrs,
        attr_dict: {},
      }

      const result = getIdrefAttrs(tagDef)

      expect(result).toHaveLength(2)
      expect(result[0].name).toBe('arg1')
      expect(result[1].name).toBe('arg2')
      expect(result.every((att) => att.vtype === 'idref')).toBe(true)
    })

    it('should return empty array if no IDREF attributes', () => {
      const attrs: DtdAttr[] = [
        { name: 'type', vtype: 'list', values: ['a', 'b'], default_value: 'a', require: 'IMPLIED', element: '', type: 'attr' },
      ]

      const tagDef: DtdTag = {
        name: 'SIMPLE',
        type: 'rtag',
        is_non_consuming: false,
        id_prefix: 'S',
        shortcut: null,
        style: { color: '#ffffff' },
        attrs,
        attr_dict: {},
      }

      const result = getIdrefAttrs(tagDef)

      expect(result).toHaveLength(0)
    })
  })
})
