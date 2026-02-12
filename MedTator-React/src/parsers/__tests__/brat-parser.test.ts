import { describe, it, expect } from 'vitest'
import {
  getColor, resetColorMapping, parseAnn,
  makeCollectionDataByDtd, makeDocumentData, medtagger2brat,
} from '../brat-parser'
import { parseDtd } from '../dtd-parser'
import type { AnnTag } from '../../types'

// ── Sample data ──

const RELATION_DTD_TEXT = `<!ENTITY name "COVID_VAX_AE">
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

// ── Color management ──

describe('color management', () => {
  it('getColor returns consistent color for same name', () => {
    resetColorMapping()
    const c1 = getColor('foo')
    const c2 = getColor('foo')
    expect(c1).toBe(c2)
  })

  it('getColor returns different colors for different names', () => {
    resetColorMapping()
    const c1 = getColor('foo')
    const c2 = getColor('bar')
    expect(c1).not.toBe(c2)
  })

  it('resetColorMapping clears all mappings', () => {
    resetColorMapping()
    const c1 = getColor('test')
    resetColorMapping()
    const c2 = getColor('other')
    // After reset, 'other' should get the same first color that 'test' got
    expect(c1).toBe(c2)
  })
})

// ── parseAnn (BRAT .ann format) ──

describe('parseAnn', () => {
  it('parses brat annotation text', () => {
    const annText = `T1\tDisease 0 5\tpain
T2\tSymptom 10 20;25 30\tdizziness`
    const result = parseAnn(annText)

    expect(result.entities).toHaveLength(2)
    expect(result.entities[0]).toEqual(['T1', 'Disease', [[0, 5]], 'pain'])
    expect(result.entities[1]).toEqual(['T2', 'Symptom', [[10, 20], [25, 30]], 'dizziness'])
  })

  it('skips empty lines and comments', () => {
    const annText = `# comment
T1\tDisease 0 5\tpain

# another comment
`
    const result = parseAnn(annText)
    expect(result.entities).toHaveLength(1)
  })

  it('handles empty input', () => {
    const result = parseAnn('')
    expect(result.entities).toEqual([])
  })
})

// ── makeCollectionDataByDtd ──

describe('makeCollectionDataByDtd', () => {
  it('creates entity types from DTD', () => {
    const dtd = parseDtd(RELATION_DTD_TEXT)
    const colData = makeCollectionDataByDtd(dtd)

    expect(colData.entity_types).toHaveLength(3)
    expect(colData.entity_types.map(e => e.type)).toEqual(['AE', 'SVRT', 'DATE'])
    expect(colData.entity_types[0].borderColor).toBe('darken')
  })

  it('creates relation types from DTD', () => {
    const dtd = parseDtd(RELATION_DTD_TEXT)
    const colData = makeCollectionDataByDtd(dtd)

    expect(colData.relation_types).toBeDefined()
    expect(colData.relation_types!.length).toBeGreaterThanOrEqual(1)
    expect(colData.relation_types![0].type).toBe('LK_AE_SVRT.link_AE-link_SVRT')
    expect(colData.relation_types![0].args).toEqual([
      { role: 'link_AE' },
      { role: 'link_SVRT' },
    ])
  })
})

// ── makeDocumentData ──

describe('makeDocumentData', () => {
  it('converts entity tags to brat entities', () => {
    const dtd = parseDtd(RELATION_DTD_TEXT)
    const tags: AnnTag[] = [
      { tag: 'AE', id: 'A0', spans: '10~15', text: 'pain', certainty: 'positive', comment: 'NA' },
      { tag: 'SVRT', id: 'S0', spans: '5~9', text: 'mild', severity: 'mild', comment: 'NA' },
    ]
    const docData = makeDocumentData('x'.repeat(20), tags, dtd)

    expect(docData.entities).toHaveLength(2)
    expect(docData.entities[0]).toEqual(['A0', 'AE', [[10, 15]]])
    expect(docData.entities[1]).toEqual(['S0', 'SVRT', [[5, 9]]])
  })

  it('converts relation tags to brat relations', () => {
    const dtd = parseDtd(RELATION_DTD_TEXT)
    const tags: AnnTag[] = [
      { tag: 'AE', id: 'A0', spans: '10~15', text: 'pain', certainty: 'positive', comment: 'NA' },
      { tag: 'SVRT', id: 'S0', spans: '5~9', text: 'mild', severity: 'mild', comment: 'NA' },
      { tag: 'LK_AE_SVRT', id: 'L0', link_AE: 'A0', link_SVRT: 'S0', comment: 'NA' },
    ]
    const docData = makeDocumentData('x'.repeat(20), tags, dtd)

    expect(docData.relations).toHaveLength(1)
    expect(docData.relations[0][0]).toBe('L0')
    expect(docData.relations[0][1]).toBe('LK_AE_SVRT')
    expect(docData.relations[0][2]).toEqual([
      ['link_AE', 'A0'],
      ['link_SVRT', 'S0'],
    ])
  })

  it('handles multi-span entities', () => {
    const dtd = parseDtd(RELATION_DTD_TEXT)
    const tags: AnnTag[] = [
      { tag: 'AE', id: 'A0', spans: '5~10,15~20', text: 'some text', certainty: 'positive', comment: 'NA' },
    ]
    const docData = makeDocumentData('x'.repeat(25), tags, dtd)

    expect(docData.entities[0][2]).toEqual([[5, 10], [15, 20]])
  })

  it('skips tags not in DTD', () => {
    const dtd = parseDtd(RELATION_DTD_TEXT)
    const tags: AnnTag[] = [
      { tag: 'UNKNOWN', id: 'U0', spans: '0~5', text: 'test' },
    ]
    const docData = makeDocumentData('x'.repeat(10), tags, dtd)

    expect(docData.entities).toHaveLength(0)
    expect(docData.relations).toHaveLength(0)
  })
})

// ── medtagger2brat ──

describe('medtagger2brat', () => {
  it('converts medtagger records to brat format', () => {
    resetColorMapping()
    const records = [
      { norm: 'Disease', start: '10', end: '20', certainty: 'Positive', status: 'Present' },
      { norm: 'Disease', start: '30', end: '40', certainty: 'Negated', status: 'HistoryOf' },
    ]
    const { col_data, doc_data } = medtagger2brat('x'.repeat(50), records)

    expect(col_data.entity_types).toHaveLength(1)
    expect(col_data.entity_types[0].type).toBe('Disease')

    expect(doc_data.entities).toHaveLength(2)
    expect(doc_data.entities[0][1]).toBe('Disease')
    expect(doc_data.entities[0][2]).toEqual([[10, 20]])

    expect(doc_data.attributes!.length).toBeGreaterThanOrEqual(2)
  })

  it('respects flagAttrs options', () => {
    resetColorMapping()
    const records = [
      { norm: 'Disease', start: '0', end: '5' },
    ]
    const { doc_data } = medtagger2brat('x'.repeat(10), records, { certainty: false, status: false })

    expect(doc_data.attributes).toEqual([])
  })
})
