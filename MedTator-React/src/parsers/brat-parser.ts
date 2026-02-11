/**
 * BRAT standoff format annotation file parser
 * Migrated from templates/js/brat_parser.js
 */
import type { Dtd, AnnTag, BratDocData, BratColData } from '../types'
import { spans2locs } from './ann-parser'

// ── Color management ──

const COLORS = [
  '#a6cee3', '#1f78b4', '#b2df8a', '#33a02c', '#fb9a99', '#e31a1c',
  '#fdbf6f', '#ff7f00', '#cab2d6', '#6a3d9a', '#ffff99', '#b15928',
  '#8dd3c7', '#ffffb3', '#bebada', '#fb8072', '#80b1d3', '#fdb462',
  '#b3de69', '#fccde5', '#d9d9d9', '#bc80bd', '#ccebc5', '#ffed6f',
]

let colorMapping: Record<string, string> = {}

export function resetColorMapping(): void {
  colorMapping = {}
}

export function getColor(name: string): string {
  if (!colorMapping.hasOwnProperty(name)) {
    const nAssigned = Object.keys(colorMapping).length
    if (nAssigned < COLORS.length) {
      colorMapping[name] = COLORS[nAssigned]
    } else {
      colorMapping[name] = '#' + Math.floor(Math.random() * 8388608 + 4388607).toString(16)
    }
  }
  return colorMapping[name]
}

// ── Parse brat .ann format ──

export interface BratParseResult {
  text: string
  entities: [string, string, number[][], string][]
  relations: any[]
  attributes: any[]
  events: any[]
  triggers: any[]
}

export function parseAnn(annText: string): BratParseResult {
  const docData: BratParseResult = {
    text: '',
    entities: [],
    relations: [],
    attributes: [],
    events: [],
    triggers: [],
  }

  const lines = annText.split('\n')
  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (line === '' || line.startsWith('#')) continue

    if (line[0] === 'T') {
      const r = parseAnnLineTypeText(line)
      docData.entities.push(r)
    }
  }

  return docData
}

function parseAnnLineTypeText(line: string): [string, string, number[][], string] {
  const ps = line.split('\t')
  const id = ps[0]
  const token = ps[2]

  const firstSpaceIdx = ps[1].indexOf(' ')
  const type = ps[1].substring(0, firstSpaceIdx)
  const spansTxt = ps[1].substring(firstSpaceIdx + 1)

  const spansPs = spansTxt.split(';')
  const locs: number[][] = []
  for (const spanP of spansPs) {
    const sps = spanP.split(' ')
    locs.push([parseInt(sps[0]), parseInt(sps[1])])
  }

  return [id, type, locs, token]
}

// ── Ann → brat format (stub, incomplete in original) ──

export function ann2brat(ann: any, dtd: Dtd): string[] {
  const cnt = { T: 0, R: 0, A: 0 }
  const idMapping: Record<string, string> = {}
  const rs: string[] = []

  for (const tag of ann.tags) {
    let newID: string | null = null
    if (dtd.tag_dict[tag.tag]?.type === 'etag') {
      cnt.T++
      newID = 'T' + cnt.T
    } else if (dtd.tag_dict[tag.tag]?.type === 'rtag') {
      cnt.R++
      newID = 'R' + cnt.R
    }
    if (newID) idMapping[tag.id] = newID

    // TODO: build actual brat output rows (original was also incomplete)
  }

  return rs
}

// ── MedTagger output → brat format ──

interface MedTaggerRecord {
  norm: string
  start: string
  end: string
  certainty?: string
  status?: string
  [key: string]: any
}

export function medtagger2brat(
  text: string,
  annRs: MedTaggerRecord[],
  flagAttrs: { certainty: boolean; status: boolean } = { certainty: true, status: true }
): { col_data: BratColData; doc_data: BratDocData } {
  const colData: BratColData = {
    entity_types: [],
    entity_attribute_types: [],
  }

  if (flagAttrs.certainty) {
    colData.entity_attribute_types!.push({
      type: 'Certainty',
      values: {
        Positive: { glyph: '➕', glyphColor: 'red' },
        Negated: { glyph: '➖', glyphColor: 'green' },
        Hypothetical: { glyph: '❓', glyphColor: 'orange' },
        Possible: { glyph: '%', glyphColor: 'yellow' },
      },
    })
  }

  if (flagAttrs.status) {
    colData.entity_attribute_types!.push({
      type: 'Status',
      values: {
        Present: { glyph: 'P' },
        HistoryOf: { glyph: 'H' },
      },
    })
  }

  const docData: BratDocData = {
    text,
    entities: [],
    relations: [],
    attributes: [],
  }

  const normDict: Record<string, any> = {}

  for (let i = 0; i < annRs.length; i++) {
    const r = annRs[i]

    if (!normDict.hasOwnProperty(r.norm)) {
      const bgColor = getColor(r.norm)
      const entDef = {
        type: r.norm,
        labels: [r.norm],
        bgColor,
        borderColor: 'darken',
      }
      colData.entity_types.push(entDef)
      normDict[r.norm] = entDef
    }

    const entityId = 'E' + i

    docData.entities.push([
      entityId,
      r.norm,
      [[parseInt(r.start), parseInt(r.end)]],
    ])

    if (flagAttrs.certainty) {
      docData.attributes!.push([
        'A' + docData.attributes!.length,
        'Certainty',
        entityId,
        r.certainty ?? '',
      ])
    }

    if (flagAttrs.status) {
      docData.attributes!.push([
        'A' + docData.attributes!.length,
        'Status',
        entityId,
        r.status ?? '',
      ])
    }
  }

  return { col_data: colData, doc_data: docData }
}

// ── DTD → brat collection data ──

export function makeCollectionDataByDtd(
  dtd: Dtd,
  relationCreationMode: string = 'first_others'
): BratColData {
  const colData: BratColData = {
    entity_types: [],
    relation_types: [],
  }

  // Convert entities
  for (const tag of dtd.etags) {
    colData.entity_types.push({
      type: tag.name,
      labels: [tag.name],
      bgColor: tag.style.color,
      borderColor: 'darken',
    })
  }

  // Convert relations
  for (const tag of dtd.rtags) {
    if (relationCreationMode === 'first_others') {
      for (let j = 0; j < tag.attrs.length; j++) {
        const attrJ = tag.attrs[j]
        if (attrJ.vtype !== 'idref') continue

        for (let k = j + 1; k < tag.attrs.length; k++) {
          const attrK = tag.attrs[k]
          if (attrK.vtype !== 'idref') continue

          colData.relation_types!.push({
            type: `${tag.name}.${attrJ.name}-${attrK.name}`,
            labels: [tag.name],
            color: tag.style.color,
            args: [{ role: attrJ.name }, { role: attrK.name }],
          })
        }
        break
      }
    }
  }

  return colData
}

// ── Ann tags → brat document data ──

export function makeDocumentData(text: string, tags: AnnTag[], dtd: Dtd): BratDocData {
  const docData: BratDocData = {
    text,
    entities: [],
    relations: [],
  }

  const etagDict: Record<string, AnnTag> = {}

  // First pass: entities
  for (const tag of tags) {
    if (!dtd.tag_dict[tag.tag] || dtd.tag_dict[tag.tag].type !== 'etag') continue

    etagDict[tag.id] = tag
    const locs = spans2locs(tag.spans!)

    docData.entities.push([tag.id, tag.tag, locs])
  }

  // Second pass: relations
  for (const tag of tags) {
    const tagDef = dtd.tag_dict[tag.tag]
    if (!tagDef || tagDef.type !== 'rtag') continue

    const arcs: [string, string][] = []
    for (const attrName in tag) {
      if (!tagDef.attr_dict[attrName]) continue
      if (tagDef.attr_dict[attrName].vtype !== 'idref') continue
      arcs.push([attrName, tag[attrName]])
    }

    docData.relations.push([tag.id, tag.tag, arcs])
  }

  return docData
}
