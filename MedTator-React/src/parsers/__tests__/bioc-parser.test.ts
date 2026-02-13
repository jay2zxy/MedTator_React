import { describe, it, expect } from 'vitest'
import { anns2xml, xml2str } from '../bioc-parser'
import { xml2ann } from '../ann-parser'
import { parseDtd } from '../dtd-parser'

// ── Sample data ──

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
<COVID_VAX_AE>
<TEXT><![CDATA[Patient had mild pain after vaccine.]]></TEXT>
<TAGS>
<AE spans="17~21" text="pain" id="A0" certainty="positive" comment="NA"/>
<SVRT spans="12~16" text="mild" id="S0" severity="mild" comment="NA"/>
<LK_AE_SVRT id="L0" link_AEID="A0" link_AEText="pain" link_SVRTID="S0" link_SVRTText="mild" comment="NA"/>
</TAGS>
<META/>
</COVID_VAX_AE>`

// ── Tests ──

describe('anns2xml', () => {
  it('generates valid BioC XML', () => {
    const dtd = parseDtd(RELATION_DTD_TEXT)
    const ann = xml2ann(SAMPLE_XML, dtd)
    ann._filename = 'test_doc.txt.xml'

    const xmlDoc = anns2xml([ann], dtd)
    const xmlStr = xml2str(xmlDoc)

    expect(xmlStr).toContain('<?xml')
    expect(xmlStr).toContain('<collection')
    expect(xmlStr).toContain('<document')
    expect(xmlStr).toContain('<passage')
    expect(xmlStr).toContain('test_doc.txt.xml')
  })

  it('includes entity annotations with location', () => {
    const dtd = parseDtd(RELATION_DTD_TEXT)
    const ann = xml2ann(SAMPLE_XML, dtd)
    ann._filename = 'test.xml'

    const xmlDoc = anns2xml([ann], dtd)
    const xmlStr = xml2str(xmlDoc)

    expect(xmlStr).toContain('<annotation')
    expect(xmlStr).toContain('<location')
    expect(xmlStr).toContain('offset')
    expect(xmlStr).toContain('length')
  })

  it('includes relation elements', () => {
    const dtd = parseDtd(RELATION_DTD_TEXT)
    const ann = xml2ann(SAMPLE_XML, dtd)
    ann._filename = 'test.xml'

    const xmlDoc = anns2xml([ann], dtd)
    const xmlStr = xml2str(xmlDoc)

    expect(xmlStr).toContain('<relation')
    expect(xmlStr).toContain('<node')
    expect(xmlStr).toContain('refid')
  })

  it('handles multiple annotations', () => {
    const dtd = parseDtd(RELATION_DTD_TEXT)
    const ann1 = xml2ann(SAMPLE_XML, dtd)
    ann1._filename = 'doc1.xml'
    const ann2 = xml2ann(SAMPLE_XML, dtd)
    ann2._filename = 'doc2.xml'

    const xmlDoc = anns2xml([ann1, ann2], dtd)
    const xmlStr = xml2str(xmlDoc)

    expect(xmlStr).toContain('doc1.xml')
    expect(xmlStr).toContain('doc2.xml')
  })

  it('handles empty annotation list', () => {
    const dtd = parseDtd(RELATION_DTD_TEXT)
    const xmlDoc = anns2xml([], dtd)
    const xmlStr = xml2str(xmlDoc)

    expect(xmlStr).toContain('<collection')
    expect(xmlStr).not.toContain('<document')
  })
})

describe('xml2str', () => {
  it('prepends XML declaration and DOCTYPE', () => {
    const dtd = parseDtd(RELATION_DTD_TEXT)
    const xmlDoc = anns2xml([], dtd)
    const xmlStr = xml2str(xmlDoc)

    expect(xmlStr).toMatch(/^<\?xml/)
    expect(xmlStr).toContain('BioC.dtd')
  })
})
