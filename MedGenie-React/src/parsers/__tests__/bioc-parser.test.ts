import { describe, it, expect } from 'vitest'
import { anns2xml, xml2str } from '../bioc-parser'
import { xml2ann } from '../ann-parser'
import { parseDtd } from '../dtd-parser'

const DTD_TEXT = `<!ENTITY name "COVID_VAX_AE">
<!ELEMENT AE ( #PCDATA ) >
<!ATTLIST AE certainty ( positive | negated | possible ) #IMPLIED "positive" >
<!ELEMENT LK_AE_SVRT EMPTY >
<!ATTLIST LK_AE_SVRT arg0 IDREF prefix="link_AE" #IMPLIED>
`

const XML = `<?xml version="1.0" encoding="UTF-8" ?>
<COVID_VAX_AE>
<TEXT><![CDATA[Patient had pain.]]></TEXT>
<TAGS>
<AE spans="12~16" text="pain" id="A0" certainty="positive"/>
</TAGS>
<META/>
</COVID_VAX_AE>`

describe('bioc-parser', () => {
  it('exports valid BioC XML with annotations', () => {
    const dtd = parseDtd(DTD_TEXT)
    const ann = xml2ann(XML, dtd)
    ann._filename = 'test.xml'
    const xmlStr = xml2str(anns2xml([ann], dtd))
    expect(xmlStr).toContain('<collection')
    expect(xmlStr).toContain('<annotation')
    expect(xmlStr).toContain('<location')
  })
})
