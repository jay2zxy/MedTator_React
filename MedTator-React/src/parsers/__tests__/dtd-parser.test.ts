import { describe, it, expect } from 'vitest'
import { parseDtd, parseJson, stringify, stringifyJson } from '../dtd-parser'

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

describe('dtd-parser', () => {
  it('parses entity tags, relation tags, and attributes', () => {
    const dtd = parseDtd(DTD_TEXT)
    expect(dtd.name).toBe('COVID_VAX_AE')
    expect(dtd.etags).toHaveLength(2)
    expect(dtd.rtags).toHaveLength(1)
    expect(dtd.etags[0].attrs[0].vtype).toBe('list')
    expect(dtd.etags[0].attrs[0].values).toEqual(['positive', 'negated', 'possible'])
    expect(dtd.rtags[0].attrs.filter(a => a.vtype === 'idref')).toHaveLength(2)
    expect(new Set(Object.keys(dtd.id_prefix_dict)).size).toBe(3)
  })

  it('DTD format roundtrip', () => {
    const dtd = parseDtd(DTD_TEXT)
    const dtd2 = parseDtd(stringify(dtd, 'dtd'))
    expect(dtd2.name).toBe(dtd.name)
    expect(dtd2.etags).toHaveLength(dtd.etags.length)
    expect(dtd2.rtags).toHaveLength(dtd.rtags.length)
  })

  it('JSON format roundtrip', () => {
    const dtd = parseDtd(DTD_TEXT)
    const dtd2 = parseJson(stringifyJson(dtd))
    expect(dtd2).not.toBeNull()
    expect(dtd2!.name).toBe(dtd.name)
    expect(dtd2!.etags).toHaveLength(dtd.etags.length)
  })
})
