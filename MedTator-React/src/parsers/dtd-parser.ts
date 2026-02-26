/**
 * Annotation schema file parser
 * Migrated from templates/js/dtd_parser.js
 */
import yaml from 'js-yaml'
import type { Dtd, DtdTag, DtdAttr } from '../types'

export const NON_CONSUMING_SPANS = '-1~-1'

// ── Factory functions ──

export function mkBaseAttr(element: string, name: string, vtype: DtdAttr['vtype']): DtdAttr {
  return {
    name,
    vtype,
    require: '',
    values: [],
    default_value: '',
    element,
    type: 'attr',
  }
}

export function mkBaseTag(tagName: string, tagType: 'etag' | 'rtag'): DtdTag {
  return {
    name: tagName,
    type: tagType,
    is_non_consuming: false,
    attrs: [],
    attr_dict: {},
    id_prefix: '',
    shortcut: null,
    style: { color: '#333333' },
  }
}

export function mkBaseDtd(dtdName: string): Dtd {
  return {
    name: dtdName,
    etags: [],
    rtags: [],
    id_prefix_dict: {},
    tag_dict: {},
    text: null,
  }
}

// ── Parse entry ──

export function parse(text: string, format: string = 'dtd'): Dtd | null {
  if (format === 'dtd') return parseDtd(text)
  if (format === 'json') return parseJson(text)
  if (format === 'yaml') return parseYaml(text)
  return null
}

// ── DTD text parsing ──

export function parseDtd(text: string): Dtd {
  const lines = text.split('\n')

  const dtd: Dtd = {
    name: '',
    etags: [],
    rtags: [],
    id_prefix_dict: {},
    tag_dict: {},
    text,
  }

  for (const line of lines) {
    const ret = parseLine(line)

    if (ret == null) {
      continue
    } else if (ret.type === 'entity') {
      dtd.name = (ret as any).name
    } else if (ret.type === 'etag' || ret.type === 'rtag') {
      const tag = ret as DtdTag
      while (dtd.id_prefix_dict[tag.id_prefix]) {
        tag.id_prefix = getNextIdPrefix(tag)
      }
      dtd.id_prefix_dict[tag.id_prefix] = tag
      dtd.tag_dict[tag.name] = tag
    } else if (ret.type === 'attr') {
      const attr = ret as DtdAttr
      if (dtd.tag_dict[attr.element]) {
        dtd.tag_dict[attr.element].attrs.push(attr)
      }
    }
  }

  // Post-processing
  for (const name in dtd.tag_dict) {
    const tag = dtd.tag_dict[name]

    if (tag.type === 'etag') {
      for (const attr of tag.attrs) {
        if (attr.vtype === 'dfix') {
          tag.is_non_consuming = true
        }
      }
    } else {
      // For link tag, check if has idref attrs
      let cntIdrefs = 0
      for (const attr of tag.attrs) {
        if (attr.vtype === 'idref') cntIdrefs++
      }
      if (cntIdrefs === 0) {
        const attrFrom = mkBaseAttr(name, 'from', 'idref')
        const attrTo = mkBaseAttr(name, 'to', 'idref')
        tag.attrs = [attrFrom, attrTo, ...tag.attrs]
      }
    }
  }

  // Split tags into etags/rtags and build attr_dict
  for (const name in dtd.tag_dict) {
    const tag = dtd.tag_dict[name]
    tag.attr_dict = makeAttrDict(tag)

    if (tag.type === 'etag') {
      dtd.etags.push(tag)
    } else {
      dtd.rtags.push(tag)
    }
  }

  return dtd
}

function parseLine(line: string): any {
  const entity = getEntity(line)
  if (entity != null) return entity

  const element = getElement(line)
  if (element != null) return element

  return getAttr(line)
}

function getEntity(text: string): { name: string; type: 'entity' } | null {
  const regex = /\<\!ENTITY\ name\ "([a-zA-Z\-0-9\_]+)"\>/gmi
  const m = regex.exec(text)
  if (m && m[1]) {
    return { name: m[1], type: 'entity' }
  }
  return null
}

function getElement(line: string): DtdTag | null {
  const regex = /^\<\!ELEMENT\s+([a-zA-Z\-0-9\_]+)\s.+/gmi
  const m = regex.exec(line)
  if (!m) return null

  const element = mkBaseTag(m[1], 'etag')
  element.id_prefix = m[1].substring(0, 1)

  if (line.lastIndexOf('EMPTY') >= 0) {
    element.type = 'rtag'
  }

  return element
}

function getAttr(line: string): DtdAttr | null {
  const regex = /^\<\!ATTLIST\s+([a-zA-Z\-0-9\_]+)\s+([a-zA-Z0-9\_]+)\s+(\S+)\s/gmi
  const m = regex.exec(line)
  if (!m) return null

  const attr = mkBaseAttr('', '', '')
  attr.element = m[1]
  attr.name = m[2]

  // Special rule for spans
  if (m[2] === 'spans') {
    attr.vtype = 'dfix'
    attr.default_value = NON_CONSUMING_SPANS
  }

  const typeToken = m[3]
  if (typeToken === 'CDATA') {
    attr.vtype = 'text'
    attr.default_value = getAttrCdataDefaultValue(line) ?? ''
  } else if (typeToken === '(') {
    attr.vtype = 'list'
    attr.values = getAttrValues(line)
  } else if (typeToken === 'IDREF') {
    attr.vtype = 'idref'
    const prefix = getAttrPrefix(line)
    if (prefix != null) {
      attr.name = prefix
    }
  }

  // Check require info
  const req = getAttrRequire(line)
  if (req.length >= 1) attr.require = req[0]
  if (req.length >= 2) attr.default_value = req[1]

  return attr
}

function getAttrValues(line: string): string[] {
  const regex = /\(([a-zA-Z0-9\_\ \|\-]+)\)/gmi
  const m = regex.exec(line)
  if (!m || !m[1]) return []
  return m[1].split('|').map(s => s.trim())
}

function getAttrRequire(line: string): string[] {
  const regex = /#([A-Z]+)+(\b["a-zA-Z0-9\-\_\ ]+|\>)/gm
  let ret: string[] = []
  let m: RegExpExecArray | null

  while ((m = regex.exec(line)) !== null) {
    if (m.index === regex.lastIndex) regex.lastIndex++
    const values: string[] = []
    if (m[1]) values.push(m[1])
    if (m[2]) {
      const t = m[2].replaceAll('"', '').replaceAll('>', '').trim()
      values.push(t)
    }
    ret = values
  }

  return ret
}

function getAttrPrefix(line: string): string | null {
  const regex = /prefix="([a-zA-Z0-9\_]+)"/gm
  const m = regex.exec(line)
  return m ? m[1] : null
}

function getAttrCdataDefaultValue(line: string): string | null {
  const regex = /\s+\"(.*)\"/g
  const m = regex.exec(line)
  return m ? m[1] : null
}

function makeAttrDict(tag: DtdTag): Record<string, DtdAttr> {
  const dict: Record<string, DtdAttr> = {}
  for (const attr of tag.attrs) {
    dict[attr.name] = attr
  }
  return dict
}

function getNextIdPrefix(element: DtdTag): string {
  return element.name.substring(0, element.id_prefix.length + 1)
}

function getValidIdPrefix(tagName: string, dtd: Dtd): string {
  let idPrefix = tagName.substring(0, 1)
  while (dtd.id_prefix_dict[idPrefix]) {
    idPrefix = tagName.substring(0, idPrefix.length + 1)
  }
  return idPrefix
}

// ── JSON parsing ──

export function parseJson(text: string): Dtd | null {
  let tmp: any
  try {
    tmp = JSON.parse(text)
  } catch {
    console.log('* invalid JSON content')
    return null
  }
  const dtd = parseTmpDtd(tmp)
  if (dtd) dtd.text = text
  return dtd
}

// ── YAML parsing ──

export function parseYaml(text: string): Dtd | null {
  let tmp: any
  try {
    tmp = yaml.load(text)
  } catch {
    console.log('* invalid YAML content')
    return null
  }
  const dtd = parseTmpDtd(tmp)
  if (dtd) dtd.text = text
  return dtd
}

// ── Shared JSON/YAML parser ──

function mkAttrByTmpAttr(tag: any, tmpAttr: any): DtdAttr | null {
  if (!tmpAttr.hasOwnProperty('name') || !tmpAttr.hasOwnProperty('vtype')) return null

  const attr = mkBaseAttr(tag.name, tmpAttr.name, tmpAttr.vtype)
  if (tmpAttr.hasOwnProperty('require')) attr.require = tmpAttr.require
  if (tmpAttr.hasOwnProperty('values')) attr.values = tmpAttr.values
  if (tmpAttr.default_value !== undefined) attr.default_value = tmpAttr.default_value
  return attr
}

function parseTmpDtd(tmp: any): Dtd | null {
  if (!tmp || !tmp.hasOwnProperty('name')) {
    console.log('* missing name in the given schema')
    return null
  }

  const dtd = mkBaseDtd('')
  dtd.name = tmp.name

  if (!tmp.etags) tmp.etags = []
  if (!tmp.rtags) tmp.rtags = []

  // Parse entity tags
  for (const tmpTag of tmp.etags) {
    if (!tmpTag.name) continue

    const tag = mkBaseTag(tmpTag.name, 'etag')
    if (!tmpTag.attrs) tmpTag.attrs = []

    for (const tmpAttr of tmpTag.attrs) {
      const attr = mkAttrByTmpAttr(tmpTag, tmpAttr)
      if (!attr) continue
      tag.attrs.push(attr)
      tag.attr_dict[attr.name] = attr
    }

    if (tmpTag.is_non_consuming) tag.is_non_consuming = true
    if (tmpTag.description) tag.description = tmpTag.description

    tag.id_prefix = tmpTag.id_prefix ?? getValidIdPrefix(tag.name, dtd)
    dtd.id_prefix_dict[tag.id_prefix] = tag
    dtd.tag_dict[tag.name] = tag
    dtd.etags.push(tag)
  }

  // Parse relation tags
  for (const tmpTag of tmp.rtags) {
    if (!tmpTag.name) continue

    const tag = mkBaseTag(tmpTag.name, 'rtag')
    if (!tmpTag.attrs) tmpTag.attrs = []

    for (const tmpAttr of tmpTag.attrs) {
      const attr = mkAttrByTmpAttr(tmpTag, tmpAttr)
      if (!attr) continue
      tag.attrs.push(attr)
      tag.attr_dict[attr.name] = attr
    }

    if (tmpTag.description) tag.description = tmpTag.description

    tag.id_prefix = tmpTag.id_prefix ?? getValidIdPrefix(tag.name, dtd)
    dtd.id_prefix_dict[tag.id_prefix] = tag
    dtd.tag_dict[tag.name] = tag
    dtd.rtags.push(tag)
  }

  // Copy meta if exists
  if (tmp.meta) {
    dtd.meta = JSON.parse(JSON.stringify(tmp.meta))
  }

  return dtd
}

// ── Extend base DTD (add computed properties) ──

export function extendBaseDtd(baseDtd: Dtd): Dtd {
  const dtd: Dtd = JSON.parse(JSON.stringify(baseDtd))

  // Build attr_dict for each tag
  for (const el of ['etags', 'rtags'] as const) {
    for (const tag of dtd[el]) {
      tag.attr_dict = {}
      for (const att of tag.attrs) {
        tag.attr_dict[att.name] = att
      }
    }
  }

  // Build id_prefix_dict and tag_dict
  dtd.id_prefix_dict = {}
  dtd.tag_dict = {}
  for (const el of ['etags', 'rtags'] as const) {
    for (const tag of dtd[el]) {
      tag.id_prefix = tag.name.substring(0, 1).toLocaleUpperCase()
      while (dtd.id_prefix_dict[tag.id_prefix]) {
        tag.id_prefix = getNextIdPrefix(tag)
      }
      dtd.id_prefix_dict[tag.id_prefix] = tag
      dtd.tag_dict[tag.name] = tag
    }
  }

  dtd.text = stringify(dtd)
  return dtd
}

// ── Stringify ──

export function stringify(dtd: Dtd, format: string = 'dtd'): string {
  if (format === 'json') return stringifyJson(dtd)
  if (format === 'yaml') return stringifyYaml(dtd)
  return stringifyDtd(dtd)
}

export function stringifyDtd(dtd: Dtd): string {
  const txt: string[] = []

  txt.push(`<!ENTITY name "${dtd.name}">`)
  txt.push('')

  for (const _t of [0, 1]) {
    const tags = _t === 0 ? dtd.etags : dtd.rtags

    for (const tag of tags) {
      let nLkAtt = 0

      if (_t === 0) {
        txt.push(`<!-- entity concept [${tag.name}] -->`)
        txt.push(`<!ELEMENT ${tag.name} ( #PCDATA ) >`)
        if (tag.is_non_consuming) {
          txt.push(`<!ATTLIST ${tag.name} spans #IMPLIED >`)
        }
      } else {
        txt.push(`<!-- relation concept [${tag.name}] -->`)
        txt.push(`<!ELEMENT ${tag.name} EMPTY >`)
      }

      for (const att of tag.attrs) {
        const attReq = att.require === 'REQUIRED' ? '#REQUIRED' : '#IMPLIED'

        if (att.vtype === 'text') {
          txt.push(`<!ATTLIST ${tag.name} ${att.name} ${attReq} "${att.default_value}" >`)
        } else if (att.vtype === 'list') {
          const attVals = att.values.join('|')
          txt.push(`<!ATTLIST ${tag.name} ${att.name} ( ${attVals} ) ${attReq} "${att.default_value}" >`)
        } else if (att.vtype === 'idref') {
          const argN = 'arg' + nLkAtt
          txt.push(`<!ATTLIST ${tag.name} ${argN} IDREF prefix="${att.name}" ${attReq} >`)
          nLkAtt++
        }
      }

      txt.push('')
    }
  }

  return txt.join('\n')
}

function minimizeDtdJson(dtd: Dtd): any {
  const j: any = JSON.parse(JSON.stringify(dtd))

  delete j.id_prefix_dict
  delete j.tag_dict
  delete j.text

  if (j.etags) {
    for (const etag of j.etags) {
      delete etag.attr_dict
      delete etag.shortcut
      delete etag.style
      delete etag.type
      delete etag.id_prefix
      if (!etag.is_non_consuming) delete etag.is_non_consuming

      for (const attr of etag.attrs) {
        delete attr.element
        delete attr.type
        if (attr.require === '' || attr.require === 'IMPLIED') delete attr.require
        if (attr.vtype === 'text') delete attr.values
      }
    }
    if (j.etags.length === 0) delete j.etags
  }

  if (j.rtags) {
    for (const rtag of j.rtags) {
      delete rtag.attr_dict
      delete rtag.shortcut
      delete rtag.style
      delete rtag.type
      delete rtag.id_prefix
      delete rtag.is_non_consuming

      for (const attr of rtag.attrs) {
        delete attr.element
        delete attr.type
        if (attr.require === '' || attr.require === 'IMPLIED') delete attr.require
        if (attr.vtype === 'text') delete attr.values
        if (attr.vtype === 'idref') {
          delete attr.values
          delete attr.default_value
        }
      }
    }
    if (j.rtags.length === 0) delete j.rtags
  }

  return j
}

export function stringifyJson(dtd: Dtd): string {
  return JSON.stringify(minimizeDtdJson(dtd), null, 4)
}

export function stringifyYaml(dtd: Dtd): string {
  const j = minimizeDtdJson(dtd)
  let yStr = yaml.dump(j)
  yStr =
    '# Annotation Schema: ' + dtd.name + '\n' +
    '# For more information schema design, you can check MedTator Wiki:\n' +
    '# https://github.com/OHNLP/MedTator/wiki/Annotation-Schema \n' +
    yStr
  return yStr
}

// ── Utils ──

export function getIdPrefix(tagName: string, dtd: Dtd): string {
  if (dtd.tag_dict[tagName]) {
    return dtd.tag_dict[tagName].id_prefix
  }
  return ''
}
