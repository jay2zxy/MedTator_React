/**
 * IAA Calculator — port of iaa_calculator.js (~1966 lines)
 *
 * Core engine for Inter-Annotator Agreement calculation:
 *   - Document matching by text hash
 *   - Tag matching (overlap / exact)
 *   - Confusion matrix (TP/FP/FN) with tag-level detail
 *   - F1, Precision, Recall metrics
 *   - Cohen's Kappa with 95% CI
 *   - Gold standard initialization
 *   - Report data generation (JSON)
 */

import type { Ann, AnnTag, Dtd, DtdTag } from '../types'
import { getNextTagId } from '../parsers/ann-parser'

// ── Types ──

export interface CmTags {
  tp: [AnnTag, AnnTag][]    // [tag_a, tag_b]
  fp: [AnnTag, AnnTag | null][]
  fn: [null, AnnTag][]
}

export interface Cm {
  tp: number
  fp: number
  fn: number
  tags: CmTags
}

export interface CohenKappa {
  N: number
  Po: number
  Pe: number
  Pes?: { a: Record<string, number>; b: Record<string, number> }
  kappa: number
  SE_k: number
  lower: number
  upper: number
}

export interface TagResult {
  precision: number
  recall: number
  f1: number
  cohen_kappa: CohenKappa
  cm: Cm
}

export interface AnnRst {
  all: TagResult
  tag: Record<string, TagResult>
}

export interface IaaAnnEntry {
  anns: [Ann, Ann]
  rst: AnnRst
}

export interface IaaDict {
  ann: Record<string, IaaAnnEntry>
  all: TagResult
  tag: Record<string, TagResult>
  stat: {
    duplicates: { ann: Ann; from: string }[]
    unmatched: { ann: Ann; from: string }[]
    matched_hashcodes: string[]
  }
}

export interface GsTagObj {
  tag: AnnTag
  from: 'A' | 'B'
}

export interface GsAnnEntry {
  ann: Ann
  rst: Record<string, { tp: (GsTagObj | null)[]; fp: (GsTagObj | null)[]; fn: (GsTagObj | null)[] }>
}

export type GsDict = Record<string, GsAnnEntry>

// ── Utility functions ──

export function hash(str: string, seed = 0): number {
  let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return 4294967296 * (2097151 & h2) + (h1 >>> 0)
}

export function toFixed(v: number | null | undefined): string {
  if (v == null || isNaN(v)) return 'NA'
  return v.toFixed(4)
}

export function spans2loc(spans: string): [number, number] {
  const vs = spans.split('~')
  return [parseInt(vs[0]), parseInt(vs[1])]
}

export function findLcs(str1: string, str2: string): string {
  const m: number[][] = Array.from({ length: str1.length + 1 }, () =>
    new Array(str2.length + 1).fill(0)
  )
  let max = 0
  let index = 0
  for (let i = 0; i < str1.length; i++) {
    for (let j = 0; j < str2.length; j++) {
      if (str1.charAt(i) === str2.charAt(j)) {
        m[i][j] = i > 0 && j > 0 && m[i - 1][j - 1] > 0 ? 1 + m[i - 1][j - 1] : 1
        if (max < m[i][j]) { max = m[i][j]; index = i }
      }
    }
  }
  return str1.substring(index - max + 1, index + 1)
}

function setIntersectionSize(a: Set<number>, b: Set<number>): number {
  let count = 0
  for (const v of b) if (a.has(v)) count++
  return count
}

function setUnionSize(a: Set<number>, b: Set<number>): number {
  const u = new Set(a)
  for (const v of b) u.add(v)
  return u.size
}

// ── Metrics ──

function calcPrecision(tp: number, fp: number): number {
  return tp + fp === 0 ? NaN : tp / (tp + fp)
}

function calcRecall(tp: number, fn: number): number {
  return tp + fn === 0 ? NaN : tp / (tp + fn)
}

function calcF1ByPR(p: number, r: number): number {
  return p + r === 0 || isNaN(p) || isNaN(r) ? NaN : (2 * p * r) / (p + r)
}

function calcN(tp: number, fp: number, fn: number): number {
  return tp + fp + fn
}

function calcPo(tp: number, fp: number, fn: number): number {
  const n = calcN(tp, fp, fn)
  return n === 0 ? NaN : tp / n
}

function calcPe(tp: number, fp: number, fn: number): number {
  const n = calcN(tp, fp, fn)
  return n === 0 ? NaN : ((tp + fn) * (tp + fp) + fn * fp) / n ** 2
}

function calcCohenKappa(Po: number, Pe: number): number {
  const pe = Pe === 1 ? 1.0001 : Pe
  return 1 - (1 - Po) / (1 - pe)
}

function calcSEk(N: number, Po: number, Pe: number): number {
  return (Po * (1 - Po) / (N * (1 - Pe) ** 2)) ** 0.5
}

export function getCohenKappa(tp: number, fp: number, fn: number): CohenKappa {
  const N = calcN(tp, fp, fn)
  const Po = calcPo(tp, fp, fn)
  const Pe = calcPe(tp, fp, fn)
  const kappa = calcCohenKappa(Po, Pe)
  const SE_k = calcSEk(N, Po, Pe)
  return { N, Po, Pe, kappa, SE_k, lower: kappa - 1.96 * SE_k, upper: kappa + 1.96 * SE_k }
}

function getCohenKappaOverall(iaaRst: AnnRst): CohenKappa {
  const N = calcN(iaaRst.all.cm.tp, iaaRst.all.cm.fp, iaaRst.all.cm.fn)
  const Po = calcPo(iaaRst.all.cm.tp, iaaRst.all.cm.fp, iaaRst.all.cm.fn)
  const sPes: number[] = []
  const Pes: { a: Record<string, number>; b: Record<string, number> } = { a: {}, b: {} }
  let eA = 0, eB = 0

  for (const tagName in iaaRst.tag) {
    if (!Object.prototype.hasOwnProperty.call(iaaRst.tag, tagName)) continue
    const rst = iaaRst.tag[tagName]
    Pes.a[tagName] = (rst.cm.tp + rst.cm.fn) / N
    Pes.b[tagName] = (rst.cm.tp + rst.cm.fp) / N
    sPes.push(Pes.a[tagName] * Pes.b[tagName])
    eA += rst.cm.fn
    eB += rst.cm.fp
  }

  Pes.a['_EMPTY_'] = eA / N
  Pes.b['_EMPTY_'] = eB / N
  sPes.push(Pes.a['_EMPTY_'] * Pes.b['_EMPTY_'])

  const Pe = sPes.reduce((a, b) => a + b, 0)
  const kappa = calcCohenKappa(Po, Pe)
  const SE_k = calcSEk(N, Po, Pe)
  return { N, Po, Pe, Pes, kappa, SE_k, lower: kappa - 1.96 * SE_k, upper: kappa + 1.96 * SE_k }
}

function calcPRF1(cm: Cm): TagResult {
  const precision = calcPrecision(cm.tp, cm.fp)
  const recall = calcRecall(cm.tp, cm.fn)
  const f1 = calcF1ByPR(precision, recall)
  const cohen_kappa = getCohenKappa(cm.tp, cm.fp, cm.fn)
  return { precision, recall, f1, cohen_kappa, cm }
}

// ── Matching ──

function getTagListByTag(tagDef: DtdTag, ann: Ann): AnnTag[] {
  const dict: Record<string, AnnTag> = {}
  for (const tag of ann.tags) {
    if (tag.tag === tagDef.name && tag.spans) dict[tag.spans] = tag
  }
  return Object.values(dict)
}

function isOverlapped(locA: [number, number], locB: [number, number], overlapRatio: number): [boolean, number] {
  const sA = new Set(Array.from({ length: locA[1] - locA[0] + 1 }, (_, i) => locA[0] + i))
  const sB = new Set(Array.from({ length: locB[1] - locB[0] + 1 }, (_, i) => locB[0] + i))
  const interSize = setIntersectionSize(sA, sB)
  const unionSize = setUnionSize(sA, sB)
  const r = unionSize === 0 ? 0 : interSize / unionSize
  return [r >= overlapRatio, r]
}

function isAttrsMatched(
  tagA: AnnTag, tagB: AnnTag, tagAttrs: Record<string, Record<string, boolean>>
): [boolean, string | null] {
  if (!tagAttrs[tagA.tag]) return [true, null]
  for (const attr in tagA) {
    if (!tagAttrs[tagA.tag][attr]) continue
    if (!Object.prototype.hasOwnProperty.call(tagA, attr)) continue
    if (!tagB.hasOwnProperty(attr)) continue
    if (tagA[attr] !== tagB[attr]) return [false, attr]
  }
  return [true, null]
}

interface MatchResult {
  is_in: boolean
  tag_b: AnnTag | null
  olpr: number
  atum: string | null
}

function isTagMatchInList(
  tag: AnnTag, tagList: AnnTag[], matchMode: string, overlapRatio: number,
  tagAttrs: Record<string, Record<string, boolean>> | null
): MatchResult {
  const locA = spans2loc(tag.spans!)
  let pTagB: AnnTag | null = null

  for (const tagB of tagList) {
    if (matchMode === 'overlap') {
      const locB = spans2loc(tagB.spans!)
      const [isOlpd, r] = isOverlapped(locA, locB, overlapRatio)
      if (isOlpd) {
        if (tagAttrs == null) {
          return { is_in: true, tag_b: tagB, olpr: r, atum: null }
        }
        const [atMatched, failedAttr] = isAttrsMatched(tag, tagB, tagAttrs)
        return atMatched
          ? { is_in: true, tag_b: tagB, olpr: r, atum: null }
          : { is_in: false, tag_b: tagB, olpr: r, atum: failedAttr }
      }
      if (r > 0) pTagB = tagB
    } else if (matchMode === 'exact') {
      if (tag.spans === tagB.spans) return { is_in: true, tag_b: tagB, olpr: 1, atum: null }
    }
  }
  return { is_in: false, tag_b: pTagB, olpr: 0, atum: null }
}

function calcMatching(
  tagListA: AnnTag[], tagListB: AnnTag[], matchMode: string, overlapRatio: number,
  tagAttrs: Record<string, Record<string, boolean>> | null, removeLowOverlap: boolean
): Cm {
  const cm: Cm = { tp: 0, fp: 0, fn: 0, tags: { tp: [], fp: [], fn: [] } }
  const dictB: Record<string, AnnTag> = {}
  for (const t of tagListB) dictB[t.spans!] = { ...t }

  for (const tagA of tagListA) {
    const match = isTagMatchInList(tagA, tagListB, matchMode, overlapRatio, tagAttrs)
    if (match.is_in) {
      cm.tp++
      cm.tags.tp.push([tagA, match.tag_b!] as [AnnTag, AnnTag])
      delete dictB[match.tag_b!.spans!]
    } else {
      cm.fp++
      cm.tags.fp.push([tagA, match.tag_b] as [AnnTag, AnnTag | null])
      if (match.tag_b != null && removeLowOverlap) delete dictB[match.tag_b.spans!]
    }
  }

  const fnTags = Object.values(dictB)
  cm.fn = fnTags.length
  cm.tags.fn = fnTags.map(t => [null, t] as [null, AnnTag])
  return cm
}

// ── Evaluation ──

function evaluateAnnOnTag(
  tagDef: DtdTag, annA: Ann, annB: Ann, matchMode: string, overlapRatio: number,
  tagAttrs: Record<string, Record<string, boolean>> | null, removeLowOverlap: boolean
): TagResult {
  const listA = getTagListByTag(tagDef, annA)
  const listB = getTagListByTag(tagDef, annB)
  const cm = calcMatching(listA, listB, matchMode, overlapRatio, tagAttrs, removeLowOverlap)
  return calcPRF1(cm)
}

function evaluateAnnOnDtd(
  dtd: Dtd, annA: Ann, annB: Ann, matchMode: string, overlapRatio: number,
  tagAttrs: Record<string, Record<string, boolean>> | null, removeLowOverlap: boolean
): AnnRst {
  const result: AnnRst = { all: {} as TagResult, tag: {} }
  const cmAnn = { tp: 0, fp: 0, fn: 0 }

  for (const tagDef of dtd.etags) {
    const r = evaluateAnnOnTag(tagDef, annA, annB, matchMode, overlapRatio, tagAttrs, removeLowOverlap)
    result.tag[tagDef.name] = r
    cmAnn.tp += r.cm.tp
    cmAnn.fp += r.cm.fp
    cmAnn.fn += r.cm.fn
  }

  const allResult = calcPRF1({ ...cmAnn, tags: { tp: [], fp: [], fn: [] } })
  result.all = allResult
  allResult.cohen_kappa = getCohenKappaOverall(result)
  return result
}

export function evaluateAnnsOnDtd(
  dtd: Dtd, annsA: Ann[], annsB: Ann[],
  matchMode = 'overlap', overlapRatio = 0.1,
  tagAttrs: Record<string, Record<string, boolean>> | null = null,
  removeLowOverlap = true
): IaaDict {
  const iaaDict: IaaDict = {
    ann: {}, all: {} as TagResult, tag: {},
    stat: { duplicates: [], unmatched: [], matched_hashcodes: [] }
  }

  const annDict: Record<string, { ann: Ann; from: string }[]> = {}

  // Hash all A annotations
  for (const annA of annsA) {
    const hc = String(hash(annA.text))
    if (annDict[hc]) {
      iaaDict.stat.duplicates.push({ ann: annA, from: 'a' })
      continue
    }
    annDict[hc] = [{ ann: annA, from: 'a' }]
  }

  // Match B annotations
  for (const annB of annsB) {
    const hc = String(hash(annB.text))
    if (annDict[hc]) {
      if (annDict[hc].length > 1) {
        iaaDict.stat.duplicates.push({ ann: annB, from: 'b' })
        continue
      }
    } else {
      annDict[hc] = [{ ann: annB, from: 'b' }]
      iaaDict.stat.unmatched.push({ ann: annB, from: 'b' })
      continue
    }

    const annA = annDict[hc][0].ann
    iaaDict.ann[hc] = { anns: [annA, annB], rst: {} as AnnRst }
    iaaDict.stat.matched_hashcodes.push(hc)
    annDict[hc].push({ ann: annB, from: 'b' })
    iaaDict.ann[hc].rst = evaluateAnnOnDtd(dtd, annA, annB, matchMode, overlapRatio, tagAttrs, removeLowOverlap)
  }

  // Check unmatched A
  for (const hc in annDict) {
    if (annDict[hc].length === 1 && annDict[hc][0].from === 'a') {
      iaaDict.stat.unmatched.push(annDict[hc][0])
    }
  }

  // Aggregate tag-level and overall
  const cmAll = { tp: 0, fp: 0, fn: 0 }
  for (const tagDef of dtd.etags) {
    const cmTag = { tp: 0, fp: 0, fn: 0 }
    for (const hc in iaaDict.ann) {
      cmTag.tp += iaaDict.ann[hc].rst.tag[tagDef.name].cm.tp
      cmTag.fp += iaaDict.ann[hc].rst.tag[tagDef.name].cm.fp
      cmTag.fn += iaaDict.ann[hc].rst.tag[tagDef.name].cm.fn
    }
    iaaDict.tag[tagDef.name] = calcPRF1({ ...cmTag, tags: { tp: [], fp: [], fn: [] } })
    cmAll.tp += cmTag.tp
    cmAll.fp += cmTag.fp
    cmAll.fn += cmTag.fn
  }

  const allResult = calcPRF1({ ...cmAll, tags: { tp: [], fp: [], fn: [] } })
  allResult.cohen_kappa = getCohenKappaOverall({ all: allResult, tag: iaaDict.tag })
  iaaDict.all = allResult
  return iaaDict
}

// ── Gold Standard ──

export function getDefaultGsDict(_dtd: Dtd, iaaDict: IaaDict): GsDict {
  const gsDict: GsDict = {}
  let cnt = 0

  for (const hc in iaaDict.ann) {
    if (!Object.prototype.hasOwnProperty.call(iaaDict.ann, hc)) continue
    const annRst = JSON.parse(JSON.stringify(iaaDict.ann[hc])) as IaaAnnEntry
    cnt++

    const fnGs = 'G_' + findLcs(annRst.anns[0]._filename || '', annRst.anns[1]._filename || '') + '_' + cnt + '.xml'

    gsDict[hc] = {
      ann: { ...annRst.anns[0], _filename: fnGs, _fh: null, tags: [], _has_saved: false },
      rst: {}
    }

    for (const tagName in annRst.rst.tag) {
      if (!Object.prototype.hasOwnProperty.call(annRst.rst.tag, tagName)) continue
      const tagRst = annRst.rst.tag[tagName]
      gsDict[hc].rst[tagName] = { tp: [], fp: [], fn: [] }

      for (const pair of tagRst.cm.tags.tp) {
        gsDict[hc].rst[tagName].tp.push({ tag: pair[0], from: 'A' })
      }
      for (const pair of tagRst.cm.tags.fp) {
        gsDict[hc].rst[tagName].fp.push({ tag: pair[0], from: 'A' })
      }
      for (const pair of tagRst.cm.tags.fn) {
        gsDict[hc].rst[tagName].fn.push({ tag: pair[1], from: 'B' })
      }
    }
  }
  return gsDict
}

export function makeAnnByRst(annRst: GsAnnEntry, dtd: Dtd): Ann {
  const ann: Ann = JSON.parse(JSON.stringify(annRst.ann))
  ann.tags = []
  ann.meta = {}

  const cms: ('tp' | 'fp' | 'fn')[] = ['tp', 'fp', 'fn']
  for (const tagName in annRst.rst) {
    const tagRst = annRst.rst[tagName]
    for (const cm of cms) {
      for (const entry of tagRst[cm]) {
        if (entry == null) continue
        const tag = { ...entry.tag }
        const tagDef = dtd.tag_dict[tag.tag]
        if (tagDef) tag.id = getNextTagId(ann, tagDef)
        tag._annotator = cm === 'tp' ? 'AB' : cm === 'fp' ? 'A' : 'B'
        ann.tags.push(tag)
      }
    }
  }
  return ann
}

export function makeAnnByIaa(annRst: GsAnnEntry, annIaa: IaaAnnEntry, dtd: Dtd): Ann {
  const ann: Ann = JSON.parse(JSON.stringify(annRst.ann))
  ann.tags = []
  ann.meta = {}

  const cms: ('tp' | 'fp' | 'fn')[] = ['tp', 'fp', 'fn']
  for (const tagName in annIaa.rst.tag) {
    const tagRst = annIaa.rst.tag[tagName].cm.tags
    for (const cm of cms) {
      for (const pair of tagRst[cm]) {
        if (pair == null) continue
        for (let k = 0; k < 2; k++) {
          if (cm === 'tp' && k === 1) continue
          const _tag = pair[k]
          if (_tag == null) continue
          const tag: AnnTag = { ..._tag }
          const tagDef = dtd.tag_dict[tag.tag]
          if (tagDef) tag.id = getNextTagId(ann, tagDef)
          tag._annotator = cm === 'tp' ? 'AB' : cm === 'fn' ? 'B' : (k === 0 ? 'A' : 'B')
          ann.tags.push(tag)
        }
      }
    }
  }
  return ann
}

// ── Report data (JSON only, no Excel styling) ──

export function getReportSummaryJson(iaaDict: IaaDict, dtd: Dtd) {
  const js: Record<string, any>[] = [{
    tag_name: 'Overall', F1: toFixed(iaaDict.all.f1),
    precision: toFixed(iaaDict.all.precision), recall: toFixed(iaaDict.all.recall),
    TP: iaaDict.all.cm.tp, FP: iaaDict.all.cm.fp, FN: iaaDict.all.cm.fn,
  }]
  for (const etag of dtd.etags) {
    js.push({
      tag_name: etag.name, F1: toFixed(iaaDict.tag[etag.name].f1),
      precision: toFixed(iaaDict.tag[etag.name].precision), recall: toFixed(iaaDict.tag[etag.name].recall),
      TP: iaaDict.tag[etag.name].cm.tp, FP: iaaDict.tag[etag.name].cm.fp, FN: iaaDict.tag[etag.name].cm.fn,
    })
  }
  return js
}

export function getReportCohenKappaJson(iaaDict: IaaDict, dtd: Dtd) {
  const js: Record<string, any>[] = []
  for (const etagRow of dtd.etags) {
    const j: Record<string, any> = { annotator: 'A', tag_name: etagRow.name }
    for (const etagCol of dtd.etags) {
      j[etagCol.name] = etagRow.name === etagCol.name ? iaaDict.tag[etagCol.name].cm.tp : ''
    }
    j['EMPTY_b'] = iaaDict.tag[etagRow.name].cm.fp
    j['P_b'] = toFixed(iaaDict.all.cohen_kappa.Pes?.b[etagRow.name])
    js.push(j)
  }
  // EMPTY_a row
  const jEmpty: Record<string, any> = { annotator: '', tag_name: 'EMPTY_a' }
  for (const etagCol of dtd.etags) jEmpty[etagCol.name] = iaaDict.tag[etagCol.name].cm.fn
  jEmpty['EMPTY_b'] = 0
  jEmpty['P_b'] = toFixed(iaaDict.all.cohen_kappa.Pes?.b['_EMPTY_'])
  js.push(jEmpty)
  // P_a row
  const jPa: Record<string, any> = { annotator: '', tag_name: 'P_a' }
  for (const etagCol of dtd.etags) jPa[etagCol.name] = toFixed(iaaDict.all.cohen_kappa.Pes?.a[etagCol.name])
  jPa['EMPTY_b'] = toFixed(iaaDict.all.cohen_kappa.Pes?.a['_EMPTY_'])
  jPa['P_b'] = ''
  js.push(jPa)

  // Summary rows
  js.push({})
  js.push({ annotator: "Overall Cohen's Kappa", tag_name: toFixed(iaaDict.all.cohen_kappa.kappa) })
  js.push({ annotator: 'Percentage Agreement', tag_name: toFixed(iaaDict.all.cohen_kappa.Po) })
  js.push({ annotator: 'TP', tag_name: iaaDict.all.cm.tp })
  js.push({ annotator: 'FP', tag_name: iaaDict.all.cm.fp })
  js.push({ annotator: 'FN', tag_name: iaaDict.all.cm.fn })
  js.push({ annotator: 'N', tag_name: iaaDict.all.cohen_kappa.N })
  js.push({ annotator: 'Po', tag_name: toFixed(iaaDict.all.cohen_kappa.Po) })
  js.push({ annotator: 'Pe', tag_name: toFixed(iaaDict.all.cohen_kappa.Pe) })
  js.push({ annotator: 'SE_k', tag_name: toFixed(iaaDict.all.cohen_kappa.SE_k) })
  js.push({ annotator: '95% CI Lower', tag_name: toFixed(iaaDict.all.cohen_kappa.lower) })
  js.push({ annotator: '95% CI Upper', tag_name: toFixed(iaaDict.all.cohen_kappa.upper) })
  return js
}

export function getReportFilesJson(iaaDict: IaaDict, dtd: Dtd) {
  const js: Record<string, any>[] = []
  for (const docHash in iaaDict.ann) {
    const annRst = iaaDict.ann[docHash]
    const j: Record<string, any> = {
      file_name_A: annRst.anns[0]._filename, file_name_B: annRst.anns[1]._filename,
      F1: toFixed(annRst.rst.all.f1), precision: toFixed(annRst.rst.all.precision),
      recall: toFixed(annRst.rst.all.recall),
      TP: annRst.rst.all.cm.tp, FP: annRst.rst.all.cm.fp, FN: annRst.rst.all.cm.fn,
    }
    for (const etag of dtd.etags) j[etag.name + '_F1'] = toFixed(annRst.rst.tag[etag.name].f1)
    js.push(j)
  }
  return js
}

export function getReportTagsJson(iaaDict: IaaDict, dtd: Dtd, skipAgreed = false) {
  const js: Record<string, any>[] = []
  const cms = skipAgreed ? ['fp', 'fn'] : ['tp', 'fp', 'fn']

  for (const docHash in iaaDict.ann) {
    const annRst = iaaDict.ann[docHash]
    for (const etag of dtd.etags) {
      for (const cm of cms) {
        const idx = cm === 'fn' ? 1 : 0
        const iaa = cm === 'tp' ? 'Agreed' : 'Disagreed'
        const cmTags = annRst.rst.tag[etag.name].cm.tags[cm as keyof CmTags]
        for (const cmTag of cmTags) {
          for (let anterIdx = 0; anterIdx < 2; anterIdx++) {
            if (cmTag[anterIdx] == null) continue
            const src = anterIdx === 0 ? 'A' : 'B'
            const json: Record<string, any> = {
              file_name: annRst.anns[idx]._filename, source: src,
              concept: etag.name, id: cmTag[anterIdx]!.id,
              spans: cmTag[anterIdx]!.spans, text: cmTag[anterIdx]!.text, IAA: iaa,
            }
            for (let attIdx = 0; attIdx < etag.attrs.length; attIdx++) {
              json['attr_name_' + attIdx] = etag.attrs[attIdx].name
              json['attr_value_' + attIdx] = cmTag[anterIdx]![etag.attrs[attIdx].name]
            }
            js.push(json)
          }
        }
      }
    }
  }
  return js
}

export function getReportAdjudicationJson(iaaDict: IaaDict, dtd: Dtd, skipAgreed = false) {
  const js: Record<string, any>[] = []
  const cms = skipAgreed ? ['fp', 'fn'] : ['tp', 'fp', 'fn']

  for (const docHash in iaaDict.ann) {
    const annRst = iaaDict.ann[docHash]
    for (const etag of dtd.etags) {
      const pTagsB: string[] = []
      for (const cm of cms) {
        const iaa = cm === 'tp' ? 'Agreed' : 'Disagreed'
        const cmTags = annRst.rst.tag[etag.name].cm.tags[cm as keyof CmTags]
        for (const cmTag of cmTags) {
          if (cmTag[1] != null) {
            if (pTagsB.includes(cmTag[1].id)) continue
            pTagsB.push(cmTag[1].id)
          }
          const json: Record<string, any> = {
            file_name: annRst.anns[0]._filename, concept: etag.name, IAA: iaa,
          }
          for (let anterIdx = 0; anterIdx < 2; anterIdx++) {
            const label = anterIdx === 0 ? 'A' : 'B'
            if (cmTag[anterIdx] == null) {
              json[label + '.id'] = ''; json[label + '.spans'] = ''; json[label + '.text'] = ''
            } else {
              json[label + '.id'] = cmTag[anterIdx]!.id
              json[label + '.spans'] = cmTag[anterIdx]!.spans
              json[label + '.text'] = cmTag[anterIdx]!.text
            }
          }
          js.push(json)
        }
      }
    }
  }
  return js
}

export function countTagsInAnns(anns: Ann[]): number {
  return anns.reduce((c, a) => c + a.tags.length, 0)
}
