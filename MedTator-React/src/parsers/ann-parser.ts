/**
 * Annotation file parser
 * Migrated from templates/js/ann_parser.js
 */
import type { Dtd, Ann, AnnTag } from '../types'

export const NON_CONSUMING_SPANS = '-1~-1'

// ── Annotation creation ──

export function txt2ann(txt: string, dtd: Dtd): Ann {
  return {
    text: txt,
    dtd_name: dtd.name,
    tags: [],
    meta: {},
    _fh: null,
    _filename: null,
    _has_saved: true,
    _sentences: [],
    _sentences_text: '',
  }
}

// ── XML → Ann ──

export function xml2ann(xmlText: string, dtd: Dtd): Ann {
  const parser = new DOMParser()
  const xmlDoc = parser.parseFromString(xmlText, 'text/xml')

  const ann: Ann = {
    text: '',
    dtd_name: '',
    tags: [],
    meta: {},
    _fh: null,
    _filename: null,
    _has_saved: true,
    _sentences: [],
    _sentences_text: '',
  }

  // Get DTD name
  const dtdName = xmlDoc.children[0].tagName
  ann.dtd_name = dtdName

  if (dtd.name !== ann.dtd_name) {
    throw {
      name: 'Not match given DTD',
      message: `The task name in XML (${ann.dtd_name}) does NOT match the given DTD (${dtd.name})`,
    }
  }

  // Get text content
  const textElem = xmlDoc.getElementsByTagName('TEXT')[0]
  ann.text = textElem ? textElem.textContent ?? '' : ''

  // Parse tags
  const tagsElem = xmlDoc.getElementsByTagName('TAGS')
  if (tagsElem.length > 0) {
    const elems = tagsElem[0].children

    for (let i = 0; i < elems.length; i++) {
      const elem = elems[i]
      const tagName = elem.tagName

      if (!dtd.tag_dict[tagName]) {
        console.log('* not found', tagName, 'in current dtd')
        continue
      }

      const tag: AnnTag = { tag: tagName, id: '' }
      const attrs = elem.getAttributeNames()

      for (const attr of attrs) {
        const value = elem.getAttribute(attr) ?? ''

        if (attr.toLowerCase() === 'text') {
          tag.text = value
        } else if (attr.toLowerCase() === 'spans') {
          // Fix wrong format spans
          const locs = spans2locs(value)
          const spans = locs2spans(locs)
          if (value !== spans) {
            console.log(`* fixed wrong format spans ${value} -> ${spans}`)
          }
          tag.spans = spans
        } else if (attr.endsWith('ID')) {
          const prefixName = attr.substring(0, attr.length - 2)
          const attrTextName = prefixName + 'Text'
          if (attrs.includes(attrTextName)) {
            tag[prefixName] = value
            continue
          }
          tag[attr] = value
        } else if (attr.endsWith('Text')) {
          continue
        } else if (attr.startsWith('_')) {
          tag[attr] = value
        } else {
          tag[attr] = value
        }
      }

      // Fill missing attrs from DTD defaults
      if (dtd.tag_dict[tagName]) {
        for (const att of dtd.tag_dict[tagName].attrs) {
          if (!tag.hasOwnProperty(att.name)) {
            tag[att.name] = att.default_value
            console.log(`* fixed missing ${tag.id} attr[${att.name}]`)
          }
        }

        // Check text for entity tags
        if (dtd.tag_dict[tagName].type === 'etag') {
          if (!tag.hasOwnProperty('text')) {
            tag.text = tag.spans === '-1~-1' ? '' : getTextBySpans(tag.spans!, ann.text)
          }
        }
      }

      ann.tags.push(tag)
    }
  }

  // Parse META
  const metaElem = xmlDoc.getElementsByTagName('META')
  if (metaElem.length > 0) {
    const elems = metaElem[0].children
    for (let i = 0; i < elems.length; i++) {
      const elem = elems[i]
      const tagName = elem.tagName

      if (!ann.meta[tagName]) {
        ann.meta[tagName] = []
      }

      const obj: Record<string, string> = {}
      for (const attr of elem.getAttributeNames()) {
        obj[attr] = elem.getAttribute(attr) ?? ''
      }
      ann.meta[tagName].push(obj)
    }
  }

  return ann
}

// ── Ann → XML ──

export function ann2xml(ann: Ann, dtd: Dtd): XMLDocument {
  const xmlDoc = document.implementation.createDocument(null, ann.dtd_name)
  const root = xmlDoc.getElementsByTagName(ann.dtd_name)[0]

  // TEXT node
  const nodeText = xmlDoc.createElement('TEXT')
  nodeText.appendChild(xmlDoc.createCDATASection(ann.text))
  root.appendChild(nodeText)

  // TAGS node
  const nodeTags = xmlDoc.createElement('TAGS')
  for (const tag of ann.tags) {
    const nodeTag = xmlDoc.createElement(tag.tag)

    for (const attr in tag) {
      if (attr.startsWith('_')) {
        nodeTag.setAttribute(attr, tag[attr])
        continue
      }
      if (attr === 'tag') continue
      if (tag[attr] == null) continue

      if (attr === 'id') {
        nodeTag.setAttribute(attr, tag[attr])
        continue
      }

      if (dtd.tag_dict[tag.tag].type === 'etag') {
        nodeTag.setAttribute(attr, tag[attr])
      } else if (dtd.tag_dict[tag.tag].type === 'rtag') {
        if (attr === 'spans' || attr === 'text') continue
        if (!dtd.tag_dict[tag.tag].attr_dict[attr]) continue

        if (dtd.tag_dict[tag.tag].attr_dict[attr].vtype === 'idref') {
          if (!tag[attr]) continue
          const etag = getTagByTagId(tag[attr], ann)
          if (!etag) {
            console.log('* not found etag [', attr, '] in', tag)
            continue
          }
          nodeTag.setAttribute(attr + 'ID', tag[attr])
          nodeTag.setAttribute(attr + 'Text', etag.text ?? '')
        } else {
          nodeTag.setAttribute(attr, tag[attr])
        }
      }
    }

    nodeTags.appendChild(nodeTag)
  }
  root.appendChild(nodeTags)

  // META node — only create if ann has meta property with content
  if (ann.hasOwnProperty('meta') && ann.meta && Object.keys(ann.meta).length > 0) {
    const nodeMeta = xmlDoc.createElement('META')
    for (const key in ann.meta) {
      for (const obj of ann.meta[key]) {
        const nodeMetaTag = xmlDoc.createElement(key)
        for (const attr in obj) {
          nodeMetaTag.setAttribute(attr, obj[attr])
        }
        nodeMeta.appendChild(nodeMetaTag)
      }
    }
    root.appendChild(nodeMeta)
  }

  return xmlDoc
}

// ── XML → String ──

export function xml2str(xmlDoc: XMLDocument): string {
  const serializer = new XMLSerializer()
  const textElem = xmlDoc.getElementsByTagName('TEXT')[0]
  const tagsElem = xmlDoc.getElementsByTagName('TAGS')[0]
  const metaElem = xmlDoc.getElementsByTagName('META')[0]

  const xmlStrText = textElem ? serializer.serializeToString(textElem) : '<TEXT></TEXT>'
  const xmlStrTags = tagsElem ? serializer.serializeToString(tagsElem) : '<TAGS></TAGS>'
  const xmlStrMeta = metaElem ? serializer.serializeToString(metaElem) : '<META></META>'

  // Simple formatting: add newlines between tags
  const formatXml = (s: string): string =>
    s.replace(/></g, '>\n<').replace(/^\s*\n/gm, '')

  const rootName = xmlDoc.children[0].nodeName

  return [
    '<?xml version="1.0" encoding="UTF-8" ?>',
    '<' + rootName + '>',
    xmlStrText,
    formatXml(xmlStrTags),
    formatXml(xmlStrMeta),
    '</' + rootName + '>',
  ].join('\n')
}

// ── Tag utilities ──

/**
 * Get tag by ID from annotation.
 */
export function getTagById(tagId: string, ann: Ann): AnnTag | null {
  for (const tag of ann.tags) {
    if (tag.id === tagId) {
      return tag
    }
  }
  return null
}

// ── Hint Dictionary ──

export interface HintTextInfo {
  count: number
  ann_fn_dict: Record<string, number>
  _is_shown: boolean
}

export interface HintTagInfo {
  text_dict: Record<string, HintTextInfo>
  nc_dict: {
    count: number
    ann_fn_dict: Record<string, number>
    _is_shown: boolean
  }
  texts: string[]
}

export type HintDict = Record<string, HintTagInfo>

export function anns2hintDict(_dtd: Dtd, anns: Ann[]): HintDict {
  const hintDict: HintDict = {}
  for (const ann of anns) {
    for (const tag of ann.tags) {
      addTagToHintDict(ann, tag, hintDict)
    }
  }
  return hintDict
}

export function addAnnToHintDict(ann: Ann, hintDict: HintDict): HintDict {
  for (const tag of ann.tags) {
    addTagToHintDict(ann, tag, hintDict)
  }
  return hintDict
}

export function addTagToHintDict(ann: Ann, tag: AnnTag, hintDict: HintDict): HintDict {
  if (!hintDict[tag.tag]) {
    hintDict[tag.tag] = {
      text_dict: {},
      nc_dict: { count: 0, ann_fn_dict: {}, _is_shown: false },
      texts: [],
    }
  }

  if (!tag.hasOwnProperty('text')) return hintDict

  let text = (tag.text ?? '').trim()

  if (text === '') {
    if (tag.spans === NON_CONSUMING_SPANS) {
      hintDict[tag.tag].nc_dict.count++
      if (hintDict[tag.tag].nc_dict.ann_fn_dict[ann._filename!]) {
        hintDict[tag.tag].nc_dict.ann_fn_dict[ann._filename!]++
      } else {
        hintDict[tag.tag].nc_dict.ann_fn_dict[ann._filename!] = 1
      }
    }
    return hintDict
  }

  if (hintDict[tag.tag].text_dict[text]) {
    hintDict[tag.tag].text_dict[text].count++
    if (hintDict[tag.tag].text_dict[text].ann_fn_dict[ann._filename!]) {
      hintDict[tag.tag].text_dict[text].ann_fn_dict[ann._filename!]++
    } else {
      hintDict[tag.tag].text_dict[text].ann_fn_dict[ann._filename!] = 1
    }
  } else {
    hintDict[tag.tag].text_dict[text] = {
      count: 1,
      ann_fn_dict: { [ann._filename!]: 1 },
      _is_shown: false,
    }
    hintDict[tag.tag].texts.push(text)
  }

  return hintDict
}

export function searchHintsInAnn(
  hintDict: HintDict,
  ann: Ann,
  focusTags: string[] | null = null
): AnnTag[] {
  const isOverlapped = (a: number[], b: number[]): boolean => {
    if (a[0] >= b[0] && a[0] < b[1]) return true
    if (a[1] > b[0] && a[1] <= b[1]) return true
    if (a[0] <= b[0] && a[1] >= b[1]) return true
    return false
  }

  const isOverlappedInList = (locX: number[], locList: number[][]): boolean => {
    return locList.some(loc => isOverlapped(locX, loc))
  }

  let locList: number[][] = []
  const hintList: AnnTag[] = []
  const strDict: Record<string, { tags: Record<string, number> }> = {}

  // Put existing tags into loc list
  for (const tag of ann.tags) {
    if (!tag.hasOwnProperty('spans')) continue
    const locs = spans2locs(tag.spans!)
    locList = locList.concat(locs)
  }

  for (const tagName in hintDict) {
    if (focusTags != null && !focusTags.includes(tagName)) continue

    for (let i = 0; i < hintDict[tagName].texts.length; i++) {
      const str = hintDict[tagName].texts[i]

      if (strDict[str]) {
        if (!strDict[str].tags[tagName]) {
          strDict[str].tags[tagName] = 1
        }
        continue
      }

      strDict[str] = { tags: { [tagName]: 1 } }

      const locs = getLocs(str, ann.text)
      for (let j = 0; j < locs.length; j++) {
        const loc = locs[j]
        if (!isOverlappedInList(loc, locList)) {
          locList.push(loc)
          hintList.push({
            id: `hint-${tagName}-${i}-${j}`,
            tag: tagName,
            text: str,
            spans: loc2span(loc),
          })
        }
      }
    }
  }

  return hintList
}

export function getStatTokensByHintDict(hintDict: HintDict) {
  const rs: { text: string; tag_name: string; n_count: number; n_anns: number }[] = []

  for (const tagName in hintDict) {
    const hintInfo = hintDict[tagName]
    for (const text in hintInfo.text_dict) {
      const textInfo = hintInfo.text_dict[text]
      rs.push({
        text,
        tag_name: tagName,
        n_count: textInfo.count,
        n_anns: Object.keys(textInfo.ann_fn_dict).length,
      })
    }
  }

  return { rs }
}

// ── Span / Location utilities ──

export function spans2locs(rawSpans: string): number[][] {
  const fixed = rawSpans.replaceAll(';', ',')
  const spanArr = fixed.split(',')
  const locs: number[][] = []

  for (const span of spanArr) {
    const loc = span2loc(span)
    if (loc != null) locs.push(loc)
  }

  return locs
}

export function span2loc(span: string): number[] | null {
  const ps = span.split('~')
  const a = parseInt(ps[0])
  const b = parseInt(ps[1])
  if (isNaN(a) || isNaN(b)) return null
  return [a, b]
}

export function loc2span(loc: number[]): string {
  return loc[0] + '~' + loc[1]
}

export function locs2spans(locs: number[][]): string {
  return locs.map(loc => loc2span(loc)).join(',')
}

export function getTextBySpans(spans: string, fullText: string): string {
  const locs = spans2locs(spans)
  const parts = locs.map(loc => fullText.substring(loc[0], loc[1]))
  return parts.join('...')
}

export function getLocs(str: string, text: string): number[][] {
  try {
    const regex = new RegExp('\\b' + str + '\\b', 'gmi')
    const locs: number[][] = []
    let m: RegExpExecArray | null

    while ((m = regex.exec(text)) !== null) {
      if (m.index === regex.lastIndex) regex.lastIndex++
      locs.push([m.index, regex.lastIndex])
    }

    return locs
  } catch {
    console.log("* couldn't create regex by", str)
    return []
  }
}

// ── Tag utilities ──

export function getNextTagId(ann: Ann, tagDef: { name: string; id_prefix: string }): string {
  let n = 0
  for (const tag of ann.tags) {
    if (tag.tag === tagDef.name) {
      const _id = parseInt(tag.id.replace(tagDef.id_prefix, ''))
      if (_id >= n) n = _id + 1
    }
  }
  return tagDef.id_prefix + n
}

export function getTagByTagId(tagId: string, ann: Ann): AnnTag | null {
  for (const tag of ann.tags) {
    if (tag.id === tagId) return tag
  }
  return null
}

export function getLinkedRtags(tagId: string, ann: Ann): AnnTag[] {
  const tags: AnnTag[] = []
  for (const tag of ann.tags) {
    if (tag.id === tagId) continue
    for (const attr in tag) {
      if (['id', 'tag', 'text', 'spans'].includes(attr)) continue
      if (tag[attr] === tagId) {
        tags.push(tag)
        break
      }
    }
  }
  return tags
}

export function hash(str: string, seed: number = 0): number {
  let h1 = 0xdeadbeef ^ seed
  let h2 = 0x41c6ce57 ^ seed
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return 4294967296 * (2097151 & h2) + (h1 >>> 0)
}
