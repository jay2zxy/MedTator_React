import { describe, it, expect } from 'vitest'
import { parseDtd, parseJson, parseYaml, stringify, stringifyJson, stringifyYaml, mkBaseDtd, mkBaseTag, mkBaseAttr, extendBaseDtd } from '../dtd-parser'

// ── Sample DTD texts ──

const MINIMAL_DTD = `<!ENTITY name "COVID_VAX_SYMP">

<!-- #PCDATA makes an entity concept -->
<!ELEMENT SYMP ( #PCDATA ) >
<!ATTLIST SYMP certainty ( positive | negated | possible ) #IMPLIED "positive" >
<!ATTLIST SYMP comment CDATA "NA" >
`

const RELATION_DTD = `<!ENTITY name "COVID_VAX_AE">

<!ELEMENT AE ( #PCDATA ) >
<!ATTLIST AE certainty ( positive | negated | possible ) #IMPLIED "positive" >
<!ATTLIST AE comment CDATA "NA" >

<!ELEMENT SVRT ( #PCDATA ) >
<!ATTLIST SVRT severity ( mild | moderate | severe | NA ) #IMPLIED "NA" >
<!ATTLIST SVRT comment CDATA "NA" >

<!ELEMENT DATE ( #PCDATA ) >
<!ATTLIST DATE comment CDATA "NA" >

<!ELEMENT LK_AE_SVRT EMPTY >
<!ATTLIST LK_AE_SVRT arg0 IDREF prefix="link_AE" #IMPLIED>
<!ATTLIST LK_AE_SVRT arg1 IDREF prefix="link_SVRT" #IMPLIED>
<!ATTLIST LK_AE_SVRT comment CDATA "NA" >
`

// ── Tests ──

describe('parseDtd', () => {
  it('parses minimal DTD with one entity tag', () => {
    const dtd = parseDtd(MINIMAL_DTD)
    expect(dtd.name).toBe('COVID_VAX_SYMP')
    expect(dtd.etags).toHaveLength(1)
    expect(dtd.rtags).toHaveLength(0)
    expect(dtd.etags[0].name).toBe('SYMP')
    expect(dtd.etags[0].type).toBe('etag')
  })

  it('parses entity tag attributes correctly', () => {
    const dtd = parseDtd(MINIMAL_DTD)
    const symp = dtd.etags[0]
    expect(symp.attrs).toHaveLength(2)

    const certainty = symp.attrs[0]
    expect(certainty.name).toBe('certainty')
    expect(certainty.vtype).toBe('list')
    expect(certainty.values).toEqual(['positive', 'negated', 'possible'])
    expect(certainty.default_value).toBe('positive')

    const comment = symp.attrs[1]
    expect(comment.name).toBe('comment')
    expect(comment.vtype).toBe('text')
    expect(comment.default_value).toBe('NA')
  })

  it('parses DTD with entity + relation tags', () => {
    const dtd = parseDtd(RELATION_DTD)
    expect(dtd.name).toBe('COVID_VAX_AE')
    expect(dtd.etags).toHaveLength(3)
    expect(dtd.rtags).toHaveLength(1)
    expect(dtd.etags.map(t => t.name)).toEqual(['AE', 'SVRT', 'DATE'])
    expect(dtd.rtags[0].name).toBe('LK_AE_SVRT')
  })

  it('parses IDREF attrs with prefix', () => {
    const dtd = parseDtd(RELATION_DTD)
    const rtag = dtd.rtags[0]
    const idrefs = rtag.attrs.filter(a => a.vtype === 'idref')
    expect(idrefs).toHaveLength(2)
    expect(idrefs[0].name).toBe('link_AE')
    expect(idrefs[1].name).toBe('link_SVRT')
  })

  it('assigns unique id_prefix for each tag', () => {
    const dtd = parseDtd(RELATION_DTD)
    const prefixes = Object.keys(dtd.id_prefix_dict)
    expect(new Set(prefixes).size).toBe(prefixes.length)
    // AE→A, SVRT→S, DATE→D, LK_AE_SVRT→L
    expect(prefixes).toEqual(['A', 'S', 'D', 'L'])
  })

  it('builds attr_dict for each tag', () => {
    const dtd = parseDtd(RELATION_DTD)
    const ae = dtd.tag_dict['AE']
    expect(ae.attr_dict['certainty']).toBeDefined()
    expect(ae.attr_dict['certainty'].vtype).toBe('list')
    expect(ae.attr_dict['comment']).toBeDefined()
  })
})

describe('stringify roundtrip', () => {
  it('DTD format roundtrip preserves structure', () => {
    const dtd = parseDtd(RELATION_DTD)
    const text = stringify(dtd, 'dtd')
    const dtd2 = parseDtd(text)

    expect(dtd2.name).toBe(dtd.name)
    expect(dtd2.etags).toHaveLength(dtd.etags.length)
    expect(dtd2.rtags).toHaveLength(dtd.rtags.length)
    for (let i = 0; i < dtd.etags.length; i++) {
      expect(dtd2.etags[i].name).toBe(dtd.etags[i].name)
      expect(dtd2.etags[i].attrs).toHaveLength(dtd.etags[i].attrs.length)
    }
  })

  it('JSON format roundtrip', () => {
    const dtd = parseDtd(RELATION_DTD)
    const json = stringifyJson(dtd)
    const dtd2 = parseJson(json)

    expect(dtd2).not.toBeNull()
    expect(dtd2!.name).toBe(dtd.name)
    expect(dtd2!.etags).toHaveLength(dtd.etags.length)
    expect(dtd2!.rtags).toHaveLength(dtd.rtags.length)
  })

  it('YAML format roundtrip', () => {
    const dtd = parseDtd(RELATION_DTD)
    const yamlStr = stringifyYaml(dtd)
    const dtd2 = parseYaml(yamlStr)

    expect(dtd2).not.toBeNull()
    expect(dtd2!.name).toBe(dtd.name)
    expect(dtd2!.etags).toHaveLength(dtd.etags.length)
    expect(dtd2!.rtags).toHaveLength(dtd.rtags.length)
  })
})

describe('factory functions', () => {
  it('mkBaseDtd creates empty DTD', () => {
    const dtd = mkBaseDtd('TEST')
    expect(dtd.name).toBe('TEST')
    expect(dtd.etags).toEqual([])
    expect(dtd.rtags).toEqual([])
  })

  it('mkBaseTag creates tag with defaults', () => {
    const tag = mkBaseTag('FOO', 'etag')
    expect(tag.name).toBe('FOO')
    expect(tag.type).toBe('etag')
    expect(tag.attrs).toEqual([])
    expect(tag.id_prefix).toBe('')
  })

  it('mkBaseAttr creates attr with defaults', () => {
    const attr = mkBaseAttr('FOO', 'bar', 'text')
    expect(attr.element).toBe('FOO')
    expect(attr.name).toBe('bar')
    expect(attr.vtype).toBe('text')
    expect(attr.default_value).toBe('')
  })
})

describe('extendBaseDtd', () => {
  it('rebuilds computed properties', () => {
    const base = parseJson(stringifyJson(parseDtd(RELATION_DTD)))!
    const extended = extendBaseDtd(base)

    expect(Object.keys(extended.tag_dict)).toHaveLength(4)
    expect(Object.keys(extended.id_prefix_dict)).toHaveLength(4)
    expect(extended.tag_dict['AE'].attr_dict['certainty']).toBeDefined()
    expect(extended.text).toBeTruthy()
  })
})

describe('edge cases', () => {
  it('handles empty DTD text', () => {
    const dtd = parseDtd('')
    expect(dtd.name).toBe('')
    expect(dtd.etags).toEqual([])
  })

  it('handles comments-only DTD', () => {
    const dtd = parseDtd('<!-- just a comment -->\n<!-- another -->')
    expect(dtd.name).toBe('')
    expect(dtd.etags).toEqual([])
  })

  it('parseJson returns null for invalid JSON', () => {
    expect(parseJson('not json')).toBeNull()
  })

  it('parseYaml returns null for missing name', () => {
    expect(parseYaml('etags: []')).toBeNull()
  })
})
