import { describe, it, expect } from 'vitest'
import {
  xml2ann, ann2xml, xml2str, txt2ann,
  span2loc, loc2span, getLocs,
  anns2hintDict, searchHintsInAnn, hash,
} from '../ann-parser'
import { parseDtd } from '../dtd-parser'

const DTD_TEXT = `<!ENTITY name "COVID_VAX_AE">
<!ELEMENT AE ( #PCDATA ) >
<!ATTLIST AE certainty ( positive | negated | possible ) #IMPLIED "positive" >
<!ATTLIST AE comment CDATA "NA" >
<!ELEMENT SVRT ( #PCDATA ) >
<!ATTLIST SVRT severity ( mild | moderate | severe | NA ) #IMPLIED "NA" >
<!ELEMENT LK_AE_SVRT EMPTY >
<!ATTLIST LK_AE_SVRT arg0 IDREF prefix="link_AE" #IMPLIED>
<!ATTLIST LK_AE_SVRT arg1 IDREF prefix="link_SVRT" #IMPLIED>
<!ATTLIST LK_AE_SVRT comment CDATA "NA" >
`

const XML = `<?xml version="1.0" encoding="UTF-8" ?>
<COVID_VAX_AE>
<TEXT><![CDATA[Patient had mild pain after vaccine.]]></TEXT>
<TAGS>
<AE spans="17~21" text="pain" id="A0" certainty="positive" comment="NA"/>
<SVRT spans="12~16" text="mild" id="S0" severity="mild" comment="NA"/>
<LK_AE_SVRT id="L0" link_AEID="A0" link_AEText="pain" link_SVRTID="S0" link_SVRTText="mild" comment="NA"/>
</TAGS>
<META><label color="yellow"/></META>
</COVID_VAX_AE>`

describe('ann-parser', () => {
  it('span2loc / loc2span', () => {
    expect(span2loc('10~20')).toEqual([10, 20])
    expect(loc2span([10, 20])).toBe('10~20')
    expect(span2loc('abc')).toBeNull()
  })

  it('getLocs finds word boundaries', () => {
    const locs = getLocs('pain', 'The pain was mild pain.')
    expect(locs).toEqual([[4, 8], [18, 22]])
  })

  it('xml2ann parses entities, relations, and meta', () => {
    const dtd = parseDtd(DTD_TEXT)
    const ann = xml2ann(XML, dtd)
    expect(ann.tags).toHaveLength(3)
    expect(ann.tags[0].certainty).toBe('positive')
    expect(ann.tags[2].link_AE).toBe('A0')
    expect(ann.meta['label'][0].color).toBe('yellow')
  })

  it('ann2xml roundtrip preserves data', () => {
    const dtd = parseDtd(DTD_TEXT)
    const ann = xml2ann(XML, dtd)
    const ann2 = xml2ann(xml2str(ann2xml(ann, dtd)), dtd)
    expect(ann2.text).toBe(ann.text)
    expect(ann2.tags).toHaveLength(ann.tags.length)
    expect(ann2.tags[2].link_AE).toBe('A0')
  })

  it('hint dict builds and searches', () => {
    const dtd = parseDtd(DTD_TEXT)
    const ann = xml2ann(XML, dtd)
    ann._filename = 'source.xml'
    const hintDict = anns2hintDict(dtd, [ann])
    expect(hintDict['AE'].texts).toContain('pain')

    const ann2 = txt2ann('He reported pain and more pain.', dtd)
    const hints = searchHintsInAnn(hintDict, ann2)
    expect(hints.length).toBeGreaterThanOrEqual(1)
  })

  it('hash is consistent', () => {
    expect(hash('hello')).toBe(hash('hello'))
    expect(hash('hello')).not.toBe(hash('world'))
  })
})
