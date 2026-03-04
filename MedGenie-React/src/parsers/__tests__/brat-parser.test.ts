import { describe, it, expect } from 'vitest'
import { makeCollectionDataByDtd, makeDocumentData } from '../brat-parser'
import { parseDtd } from '../dtd-parser'
import type { AnnTag } from '../../types'

const DTD_TEXT = `<!ENTITY name "COVID_VAX_AE">
<!ELEMENT AE ( #PCDATA ) >
<!ATTLIST AE certainty ( positive | negated | possible ) #IMPLIED "positive" >
<!ELEMENT SVRT ( #PCDATA ) >
<!ATTLIST SVRT severity ( mild | moderate | severe | NA ) #IMPLIED "NA" >
<!ELEMENT LK_AE_SVRT EMPTY >
<!ATTLIST LK_AE_SVRT arg0 IDREF prefix="link_AE" #IMPLIED>
<!ATTLIST LK_AE_SVRT arg1 IDREF prefix="link_SVRT" #IMPLIED>
`

describe('brat-parser', () => {
  it('makeCollectionDataByDtd creates entity + relation types', () => {
    const dtd = parseDtd(DTD_TEXT)
    const col = makeCollectionDataByDtd(dtd)
    expect(col.entity_types).toHaveLength(2)
    expect(col.relation_types!.length).toBeGreaterThanOrEqual(1)
  })

  it('makeDocumentData converts tags to brat format', () => {
    const dtd = parseDtd(DTD_TEXT)
    const tags: AnnTag[] = [
      { tag: 'AE', id: 'A0', spans: '10~15', text: 'pain', certainty: 'positive' },
      { tag: 'SVRT', id: 'S0', spans: '5~9', text: 'mild', severity: 'mild' },
      { tag: 'LK_AE_SVRT', id: 'L0', link_AE: 'A0', link_SVRT: 'S0' },
    ]
    const doc = makeDocumentData('x'.repeat(20), tags, dtd)
    expect(doc.entities).toHaveLength(2)
    expect(doc.relations).toHaveLength(1)
    expect(doc.relations[0][2]).toEqual([['link_AE', 'A0'], ['link_SVRT', 'S0']])
  })
})
