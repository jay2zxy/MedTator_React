import { describe, it, expect } from 'vitest'
import {
  hash, toFixed, spans2loc, findLcs,
  getCohenKappa, evaluateAnnsOnDtd, getDefaultGsDict,
  makeAnnByRst, countTagsInAnns,
  getReportSummaryJson, getReportCohenKappaJson,
  getReportFilesJson, getReportTagsJson,
} from '../iaa-calculator'
import type { Ann, AnnTag, Dtd, DtdTag } from '../../types'

// ── Helpers ──

function mkEtag(name: string, idPrefix = name[0]): DtdTag {
  return {
    name, type: 'etag', id_prefix: idPrefix, attrs: [], is_non_consuming: false,
    attr_dict: {}, shortcut: null, style: { color: '' }, description: '',
  }
}

function mkDtd(etags: DtdTag[]): Dtd {
  const tag_dict: Record<string, DtdTag> = {}
  const id_prefix_dict: Record<string, DtdTag> = {}
  for (const t of etags) { tag_dict[t.name] = t; id_prefix_dict[t.id_prefix] = t }
  return { name: 'test', etags, rtags: [], tag_dict, id_prefix_dict, text: null }
}

function mkTag(tag: string, id: string, spans: string, text: string): AnnTag {
  return { tag, id, spans, text }
}

function mkAnn(filename: string, text: string, tags: AnnTag[]): Ann {
  return {
    _filename: filename, _fh: null, text, tags, meta: {},
    _has_saved: false, dtd_name: 'test', _sentences: [], _sentences_text: '',
  }
}

// ── Utility functions ──

describe('utility functions', () => {
  it('hash: consistent and distinct', () => {
    expect(hash('hello')).toBe(hash('hello'))
    expect(hash('hello')).not.toBe(hash('world'))
  })

  it('toFixed: formats numbers, NA for null/NaN', () => {
    expect(toFixed(0.123456)).toBe('0.1235')
    expect(toFixed(null)).toBe('NA')
    expect(toFixed(NaN)).toBe('NA')
  })

  it('spans2loc: parses span string', () => {
    expect(spans2loc('10~20')).toEqual([10, 20])
  })

  it('findLcs: longest common substring', () => {
    expect(findLcs('abcdef', 'xbcdyz')).toBe('bcd')
    expect(findLcs('abc', 'xyz')).toBe('')
  })
})

// ── Cohen's Kappa ──

describe('getCohenKappa', () => {
  it('perfect agreement → kappa ≈ 1', () => {
    const k = getCohenKappa(10, 0, 0)
    expect(k.N).toBe(10)
    expect(k.kappa).toBeCloseTo(1, 4)
  })

  it('no agreement → kappa < 0', () => {
    const k = getCohenKappa(0, 5, 5)
    expect(k.Po).toBe(0)
    expect(k.kappa).toBeLessThan(0)
  })

  it('partial agreement with CI bracket', () => {
    const k = getCohenKappa(5, 2, 3)
    expect(k.kappa).toBeCloseTo(-0.3158, 3)
    expect(k.lower).toBeLessThan(k.kappa)
    expect(k.upper).toBeGreaterThan(k.kappa)
  })

  it('zero tags → NaN', () => {
    const k = getCohenKappa(0, 0, 0)
    expect(isNaN(k.kappa)).toBe(true)
  })
})

// ── evaluateAnnsOnDtd ──

describe('evaluateAnnsOnDtd', () => {
  const dtd = mkDtd([mkEtag('Disease', 'D'), mkEtag('Drug', 'R')])

  it('perfect match → F1=1', () => {
    const tag1 = mkTag('Disease', 'D0', '0~7', 'diabetes')
    const annA = mkAnn('a.xml', 'diabetes is common', [tag1])
    const annB = mkAnn('b.xml', 'diabetes is common', [{ ...tag1 }])

    const iaa = evaluateAnnsOnDtd(dtd, [annA], [annB])
    expect(iaa.all.f1).toBe(1)
    expect(iaa.all.cm.tp).toBe(1)
    expect(iaa.all.cm.fp).toBe(0)
    expect(iaa.tag['Disease'].cm.tp).toBe(1)
  })

  it('no match → FP+FN by tag', () => {
    const annA = mkAnn('a.xml', 'diabetes is common', [mkTag('Disease', 'D0', '0~7', 'diabetes')])
    const annB = mkAnn('b.xml', 'diabetes is common', [mkTag('Drug', 'R0', '12~17', 'common')])

    const iaa = evaluateAnnsOnDtd(dtd, [annA], [annB])
    expect(iaa.all.cm.tp).toBe(0)
    expect(iaa.tag['Disease'].cm.fp).toBe(1)
    expect(iaa.tag['Drug'].cm.fn).toBe(1)
  })

  it('overlap vs exact mode', () => {
    const annA = mkAnn('a.xml', 'type 2 diabetes mellitus', [mkTag('Disease', 'D0', '0~23', 'type 2 diabetes mellitu')])
    const annB = mkAnn('b.xml', 'type 2 diabetes mellitus', [mkTag('Disease', 'D0', '7~24', 'diabetes mellitus')])

    expect(evaluateAnnsOnDtd(dtd, [annA], [annB], 'overlap', 0.1).all.cm.tp).toBe(1)
    expect(evaluateAnnsOnDtd(dtd, [annA], [annB], 'exact').all.cm.tp).toBe(0)
  })

  it('unmatched and duplicate documents', () => {
    const annA1 = mkAnn('a1.xml', 'same text', [])
    const annA2 = mkAnn('a2.xml', 'same text', [])
    const annB = mkAnn('b.xml', 'same text', [])

    const iaa = evaluateAnnsOnDtd(dtd, [annA1, annA2], [annB])
    expect(iaa.stat.duplicates.length).toBe(1)
    expect(iaa.stat.matched_hashcodes.length).toBe(1)

    const iaa2 = evaluateAnnsOnDtd(dtd, [annA1], [mkAnn('b.xml', 'different', [])])
    expect(iaa2.stat.unmatched.length).toBe(2)
  })

  it('multiple documents aggregate correctly', () => {
    const text1 = 'patient has diabetes'
    const text2 = 'aspirin prescribed'
    const iaa = evaluateAnnsOnDtd(dtd,
      [mkAnn('a1.xml', text1, [mkTag('Disease', 'D0', '12~19', 'diabetes')]),
       mkAnn('a2.xml', text2, [mkTag('Drug', 'R0', '0~6', 'aspirin')])],
      [mkAnn('b1.xml', text1, [mkTag('Disease', 'D0', '12~19', 'diabetes')]),
       mkAnn('b2.xml', text2, [mkTag('Drug', 'R0', '0~6', 'aspirin')])])
    expect(iaa.all.cm.tp).toBe(2)
    expect(iaa.all.f1).toBe(1)
  })
})

// ── Gold Standard + makeAnnByRst ──

describe('gold standard', () => {
  const dtd = mkDtd([mkEtag('Disease', 'D')])
  const tag = mkTag('Disease', 'D0', '0~7', 'diabetes')
  const annA = mkAnn('a_doc.xml', 'diabetes is common', [tag])
  const annB = mkAnn('b_doc.xml', 'diabetes is common', [{ ...tag }])
  const iaa = evaluateAnnsOnDtd(dtd, [annA], [annB])

  it('getDefaultGsDict creates GS entries', () => {
    const gs = getDefaultGsDict(dtd, iaa)
    const entry = Object.values(gs)[0]
    expect(entry.ann._filename).toContain('G_')
    expect(entry.rst['Disease'].tp.length).toBe(1)
  })

  it('makeAnnByRst assigns _annotator labels', () => {
    const gs = getDefaultGsDict(dtd, iaa)
    const ann = makeAnnByRst(Object.values(gs)[0], dtd)
    expect(ann.tags.length).toBe(1)
    expect(ann.tags[0]._annotator).toBe('AB')
  })
})

// ── Report JSON ──

describe('report generators', () => {
  const dtd = mkDtd([mkEtag('Disease', 'D'), mkEtag('Drug', 'R')])
  const tag = mkTag('Disease', 'D0', '0~7', 'diabetes')
  const iaa = evaluateAnnsOnDtd(dtd,
    [mkAnn('a.xml', 'diabetes is common', [tag])],
    [mkAnn('b.xml', 'diabetes is common', [{ ...tag }])])

  it('all report functions return expected structure', () => {
    const summary = getReportSummaryJson(iaa, dtd)
    expect(summary.length).toBe(3)
    expect(summary[0].tag_name).toBe('Overall')
    expect(summary[0].F1).toBe('1.0000')

    const kappa = getReportCohenKappaJson(iaa, dtd)
    expect(kappa.map(r => r.tag_name).filter(Boolean)).toContain('Disease')

    const files = getReportFilesJson(iaa, dtd)
    expect(files[0].file_name_A).toBe('a.xml')

    const tags = getReportTagsJson(iaa, dtd)
    expect(tags[0].concept).toBe('Disease')
  })
})

// ── countTagsInAnns ──

describe('countTagsInAnns', () => {
  it('sums tag counts across annotations', () => {
    expect(countTagsInAnns([
      mkAnn('a.xml', 'text', [mkTag('D', 'D0', '0~1', 'x'), mkTag('D', 'D1', '2~3', 'y')]),
      mkAnn('b.xml', 'text', [mkTag('D', 'D0', '0~1', 'x')]),
    ])).toBe(3)
  })
})
