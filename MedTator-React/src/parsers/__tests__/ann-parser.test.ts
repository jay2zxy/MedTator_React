import { describe, it, expect } from 'vitest'
import {
  txt2ann, xml2ann, ann2xml, xml2str,
  spans2locs, span2loc, loc2span, locs2spans, getTextBySpans, getLocs,
  getNextTagId, getTagByTagId, getLinkedRtags,
  anns2hintDict, searchHintsInAnn, hash,
  NON_CONSUMING_SPANS,
} from '../ann-parser'
import { parseDtd } from '../dtd-parser'
import type { Ann } from '../../types'

// ── Sample data ──

const MINIMAL_DTD_TEXT = `<!ENTITY name "COVID_VAX_SYMP">
<!ELEMENT SYMP ( #PCDATA ) >
<!ATTLIST SYMP certainty ( positive | negated | possible ) #IMPLIED "positive" >
<!ATTLIST SYMP comment CDATA "NA" >
`

const RELATION_DTD_TEXT = `<!ENTITY name "COVID_VAX_AE">
<!ELEMENT AE ( #PCDATA ) >
<!ATTLIST AE certainty ( positive | negated | possible ) #IMPLIED "positive" >
<!ATTLIST AE comment CDATA "NA" >
<!ELEMENT SVRT ( #PCDATA ) >
<!ATTLIST SVRT severity ( mild | moderate | severe | NA ) #IMPLIED "NA" >
<!ATTLIST SVRT comment CDATA "NA" >
<!ELEMENT LK_AE_SVRT EMPTY >
<!ATTLIST LK_AE_SVRT arg0 IDREF prefix="link_AE" #IMPLIED>
<!ATTLIST LK_AE_SVRT arg1 IDREF prefix="link_SVRT" #IMPLIED>
<!ATTLIST LK_AE_SVRT comment CDATA "NA" >
`

const SAMPLE_XML = `<?xml version="1.0" encoding="UTF-8" ?>
<COVID_VAX_SYMP>
<TEXT><![CDATA[The patient has dizziness and headache.]]></TEXT>
<TAGS>
<SYMP spans="16~25" text="dizziness" id="S0" certainty="positive" comment="NA"/>
<SYMP spans="30~38" text="headache" id="S1" certainty="negated" comment="NA"/>
</TAGS>
<META/>
</COVID_VAX_SYMP>`

const RELATION_XML = `<?xml version="1.0" encoding="UTF-8" ?>
<COVID_VAX_AE>
<TEXT><![CDATA[Patient had mild pain after vaccine.]]></TEXT>
<TAGS>
<AE spans="17~21" text="pain" id="A0" certainty="positive" comment="NA"/>
<SVRT spans="12~16" text="mild" id="S0" severity="mild" comment="NA"/>
<LK_AE_SVRT id="L0" link_AEID="A0" link_AEText="pain" link_SVRTID="S0" link_SVRTText="mild" comment="NA"/>
</TAGS>
<META>
<label color="yellow"/>
</META>
</COVID_VAX_AE>`

// ── Span / Location utilities ──

describe('span/loc utilities', () => {
  it('span2loc parses "10~20"', () => {
    expect(span2loc('10~20')).toEqual([10, 20])
  })

  it('span2loc returns null for invalid input', () => {
    expect(span2loc('abc~def')).toBeNull()
  })

  it('loc2span formats [10,20]', () => {
    expect(loc2span([10, 20])).toBe('10~20')
  })

  it('spans2locs handles comma-separated', () => {
    expect(spans2locs('10~20,30~40')).toEqual([[10, 20], [30, 40]])
  })

  it('spans2locs handles semicolon-separated', () => {
    expect(spans2locs('10~20;30~40')).toEqual([[10, 20], [30, 40]])
  })

  it('locs2spans formats array', () => {
    expect(locs2spans([[10, 20], [30, 40]])).toBe('10~20,30~40')
  })

  it('getTextBySpans extracts text segments', () => {
    expect(getTextBySpans('0~5,6~11', 'Hello World Again')).toBe('Hello...World')
  })

  it('getTextBySpans single span', () => {
    expect(getTextBySpans('4~9', 'The quick brown fox')).toBe('quick')
  })

  it('getLocs finds word boundaries', () => {
    const locs = getLocs('pain', 'The pain was mild pain.')
    expect(locs).toHaveLength(2)
    expect(locs[0]).toEqual([4, 8])
    expect(locs[1]).toEqual([18, 22])
  })

  it('getLocs returns empty for no match', () => {
    expect(getLocs('xyz', 'hello world')).toEqual([])
  })

  it('NON_CONSUMING_SPANS is -1~-1', () => {
    expect(NON_CONSUMING_SPANS).toBe('-1~-1')
  })
})

// ── txt2ann ──

describe('txt2ann', () => {
  it('creates empty annotation from text', () => {
    const dtd = parseDtd(MINIMAL_DTD_TEXT)
    const ann = txt2ann('hello world', dtd)
    expect(ann.text).toBe('hello world')
    expect(ann.dtd_name).toBe('COVID_VAX_SYMP')
    expect(ann.tags).toEqual([])
    expect(ann._has_saved).toBe(true)
  })
})

// ── xml2ann (needs DOM - happy-dom provides it) ──

describe('xml2ann', () => {
  it('parses simple annotation XML', () => {
    const dtd = parseDtd(MINIMAL_DTD_TEXT)
    const ann = xml2ann(SAMPLE_XML, dtd)

    expect(ann.dtd_name).toBe('COVID_VAX_SYMP')
    expect(ann.text).toBe('The patient has dizziness and headache.')
    expect(ann.tags).toHaveLength(2)
  })

  it('parses entity tag attributes', () => {
    const dtd = parseDtd(MINIMAL_DTD_TEXT)
    const ann = xml2ann(SAMPLE_XML, dtd)

    const s0 = ann.tags.find(t => t.id === 'S0')!
    expect(s0.tag).toBe('SYMP')
    expect(s0.spans).toBe('16~25')
    expect(s0.text).toBe('dizziness')
    expect(s0.certainty).toBe('positive')
    expect(s0.comment).toBe('NA')
  })

  it('parses relation tags with IDREF', () => {
    const dtd = parseDtd(RELATION_DTD_TEXT)
    const ann = xml2ann(RELATION_XML, dtd)

    const lk = ann.tags.find(t => t.tag === 'LK_AE_SVRT')!
    expect(lk.id).toBe('L0')
    expect(lk.link_AE).toBe('A0')
    expect(lk.link_SVRT).toBe('S0')
  })

  it('parses META section', () => {
    const dtd = parseDtd(RELATION_DTD_TEXT)
    const ann = xml2ann(RELATION_XML, dtd)

    expect(ann.meta).toBeDefined()
    expect(ann.meta['label']).toBeDefined()
    expect(ann.meta['label'][0].color).toBe('yellow')
  })

  it('throws on DTD name mismatch', () => {
    const dtd = parseDtd(MINIMAL_DTD_TEXT) // COVID_VAX_SYMP
    expect(() => xml2ann(RELATION_XML, dtd)).toThrow() // COVID_VAX_AE
  })
})

// ── ann2xml → xml2str roundtrip ──

describe('ann2xml roundtrip', () => {
  it('serializes and re-parses annotation', () => {
    const dtd = parseDtd(MINIMAL_DTD_TEXT)
    const ann = xml2ann(SAMPLE_XML, dtd)

    const xmlDoc = ann2xml(ann, dtd)
    const xmlStr = xml2str(xmlDoc)

    const ann2 = xml2ann(xmlStr, dtd)
    expect(ann2.text).toBe(ann.text)
    expect(ann2.tags).toHaveLength(ann.tags.length)
    expect(ann2.tags[0].id).toBe(ann.tags[0].id)
    expect(ann2.tags[0].text).toBe(ann.tags[0].text)
  })

  it('roundtrip preserves relation tags', () => {
    const dtd = parseDtd(RELATION_DTD_TEXT)
    const ann = xml2ann(RELATION_XML, dtd)

    const xmlDoc = ann2xml(ann, dtd)
    const xmlStr = xml2str(xmlDoc)

    const ann2 = xml2ann(xmlStr, dtd)
    const lk = ann2.tags.find(t => t.tag === 'LK_AE_SVRT')!
    expect(lk.link_AE).toBe('A0')
    expect(lk.link_SVRT).toBe('S0')
  })

  it('roundtrip preserves META', () => {
    const dtd = parseDtd(RELATION_DTD_TEXT)
    const ann = xml2ann(RELATION_XML, dtd)

    const xmlDoc = ann2xml(ann, dtd)
    const xmlStr = xml2str(xmlDoc)

    const ann2 = xml2ann(xmlStr, dtd)
    expect(ann2.meta['label']).toBeDefined()
    expect(ann2.meta['label'][0].color).toBe('yellow')
  })

  it('does not emit META when empty', () => {
    const dtd = parseDtd(MINIMAL_DTD_TEXT)
    const ann = xml2ann(SAMPLE_XML, dtd)
    ann.meta = {}

    const xmlDoc = ann2xml(ann, dtd)
    const xmlStr = xml2str(xmlDoc)

    // Should not contain non-empty META block
    expect(xmlStr).not.toMatch(/<META>.*<label/s)
  })
})

// ── Tag utilities ──

describe('tag utilities', () => {
  const dtd = parseDtd(MINIMAL_DTD_TEXT)

  function makeAnn(): Ann {
    return xml2ann(SAMPLE_XML, dtd)
  }

  it('getTagByTagId finds existing tag', () => {
    const ann = makeAnn()
    const tag = getTagByTagId('S0', ann)
    expect(tag).not.toBeNull()
    expect(tag!.text).toBe('dizziness')
  })

  it('getTagByTagId returns null for missing', () => {
    const ann = makeAnn()
    expect(getTagByTagId('X99', ann)).toBeNull()
  })

  it('getNextTagId returns correct next id', () => {
    const ann = makeAnn()
    const tagDef = dtd.etags[0] // SYMP, prefix S
    const nextId = getNextTagId(ann, tagDef)
    // S0 and S1 exist, so next should be S2
    expect(nextId).toBe('S2')
  })

  it('getLinkedRtags finds related tags', () => {
    const rDtd = parseDtd(RELATION_DTD_TEXT)
    const ann = xml2ann(RELATION_XML, rDtd)
    const linked = getLinkedRtags('A0', ann)
    expect(linked.length).toBeGreaterThanOrEqual(1)
    expect(linked[0].tag).toBe('LK_AE_SVRT')
  })
})

// ── Hint dictionary ──

describe('hint dictionary', () => {
  it('builds hint dict from annotations', () => {
    const dtd = parseDtd(MINIMAL_DTD_TEXT)
    const ann = xml2ann(SAMPLE_XML, dtd)
    ann._filename = 'test.xml'

    const hintDict = anns2hintDict(dtd, [ann])
    expect(hintDict['SYMP']).toBeDefined()
    expect(hintDict['SYMP'].texts).toContain('dizziness')
    expect(hintDict['SYMP'].texts).toContain('headache')
    expect(hintDict['SYMP'].text_dict['dizziness'].count).toBe(1)
  })

  it('searchHintsInAnn finds unhinted text', () => {
    const dtd = parseDtd(MINIMAL_DTD_TEXT)
    const ann1 = xml2ann(SAMPLE_XML, dtd)
    ann1._filename = 'test1.xml'

    const hintDict = anns2hintDict(dtd, [ann1])

    // Create a new ann with same text but no tags
    const ann2 = txt2ann('He reported dizziness and headache and more dizziness.', dtd)
    const hints = searchHintsInAnn(hintDict, ann2)

    // Should find "dizziness" and "headache" in the new text
    expect(hints.length).toBeGreaterThanOrEqual(2)
  })
})

// ── hash ──

describe('hash', () => {
  it('returns consistent values', () => {
    expect(hash('hello')).toBe(hash('hello'))
  })

  it('different strings produce different hashes', () => {
    expect(hash('hello')).not.toBe(hash('world'))
  })

  it('seed changes output', () => {
    expect(hash('hello', 0)).not.toBe(hash('hello', 42))
  })
})
