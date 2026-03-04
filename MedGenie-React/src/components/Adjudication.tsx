/**
 * Adjudication (IAA) Tab — port of app_hotpot_ext_iaa.js + iaa_calculator.js
 *
 * Inter-Annotator Agreement:
 *   - Load two sets of annotation files (A and B)
 *   - Match documents by text hash, compare tags
 *   - Calculate F1, Precision, Recall, Cohen's Kappa
 *   - View per-document tag comparisons (TP/FP/FN)
 *   - Adjudicate (accept/reject) tags for gold standard
 *   - Download gold standard ZIP or Excel report
 */
import { useRef, useState, useMemo } from 'react'
import { Switch, message, Select } from 'antd'
import {
  ClearOutlined,
  CalculatorOutlined,
  FileExcelOutlined,
  DownloadOutlined,
  QuestionCircleOutlined,
  UserOutlined,
} from '@ant-design/icons'
import JSZip from 'jszip'
import * as XLSX from 'xlsx'
import { useAppStore } from '../store'
import { readFileAsText } from '../utils/file-helper'
import { xml2ann, ann2xml, xml2str } from '../parsers/ann-parser'
import {
  evaluateAnnsOnDtd, getDefaultGsDict, makeAnnByRst, makeAnnByIaa,
  countTagsInAnns, toFixed,
  type IaaDict, type GsDict, type GsAnnEntry, type GsTagObj, type AnnRst, type TagResult,
  getReportSummaryJson, getReportCohenKappaJson, getReportFilesJson,
  getReportTagsJson, getReportAdjudicationJson, spans2loc,
} from '../utils/iaa-calculator'
import type { Ann, AnnTag, Dtd } from '../types'

// ── Ribbon components ──

function RibbonBtn({ icon, label, disabled, onClick, title }: {
  icon: React.ReactNode; label: React.ReactNode; disabled?: boolean; onClick?: () => void; title?: string
}) {
  return (
    <button title={title} disabled={disabled} onClick={onClick}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
        minWidth: 56, height: 52, padding: '4px 10px',
        border: '1px solid transparent', borderRadius: 3,
        background: 'transparent', cursor: disabled ? 'default' : 'pointer',
        color: disabled ? '#bbb' : '#333', fontSize: 11, lineHeight: 1.2, transition: 'background 0.15s',
      }}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.background = '#e6f0ff' }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
    >
      <span style={{ fontSize: 20 }}>{icon}</span>
      <span style={{ whiteSpace: 'nowrap', textAlign: 'center' }}>{label}</span>
    </button>
  )
}

function TG({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '4px 8px', borderRight: '1px solid #e8e8e8', gap: 2,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>{children}</div>
      <div style={{ fontSize: 10, color: '#888', whiteSpace: 'nowrap' }}>{label}</div>
    </div>
  )
}

// ── Dropzone for annotation files ──

function IaaDropzone({
  label, anns, dtd, loading, onFiles, onClear,
}: {
  label: string; anns: Ann[]; dtd: Dtd | null; loading: boolean
  onFiles: (files: { fn: string; text: string }[]) => void; onClear: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const handleFiles = async (rawFiles: FileList | File[]) => {
    const arr = Array.from(rawFiles)
    const loaded: { fn: string; text: string }[] = []
    for (const f of arr) {
      if (!f.name.match(/\.xml$/i)) continue
      try { loaded.push({ fn: f.name, text: await readFileAsText(f) }) } catch { /* skip */ }
    }
    if (loaded.length > 0) onFiles(loaded)
  }

  return (
    <div style={{ position: 'relative', minWidth: 140 }}>
      <div
        style={{
          width: 140, height: 46, border: '1px dashed #aaa', borderRadius: 4,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: dtd ? 'pointer' : 'default', fontSize: 11, textAlign: 'center',
          background: anns.length > 0 ? '#f0faf0' : '#fafafa', padding: '0 4px',
        }}
        onClick={() => dtd && inputRef.current?.click()}
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); if (dtd) handleFiles(e.dataTransfer.files) }}
      >
        <input ref={inputRef} type="file" multiple accept=".xml"
          style={{ display: 'none' }}
          onChange={e => { if (e.target.files) handleFiles(e.target.files); e.target.value = '' }} />
        {!dtd ? <span style={{ color: '#999' }}>Load DTD first<br/>in Annotation Tab</span>
          : loading ? <span>Reading...</span>
          : anns.length === 0 ? <span style={{ color: '#888' }}>Drop .xml files<br/>or click</span>
          : <span style={{ color: '#389e0d' }}>{countTagsInAnns(anns)} Tags<br/>in {anns.length} Files</span>}
      </div>
      {anns.length > 0 && (
        <button onClick={e => { e.stopPropagation(); onClear() }}
          style={{
            position: 'absolute', top: 1, right: 1, background: 'none', border: 'none',
            cursor: 'pointer', color: '#999', fontSize: 10, padding: '1px 3px',
          }} title={`Clear ${label}`}>×</button>
      )}
    </div>
  )
}

// ── Tag info display (replaces Vue iaa-tag-info) ──

function IaaTagInfo({
  tag, ann, dtd, cm, showContext,
  onAccept,
}: {
  tag: AnnTag; ann: Ann; dtd: Dtd; cm: string; showContext: boolean
  onAccept: () => void
}) {
  const tagDef = dtd.tag_dict[tag.tag]
  const attrs = tagDef?.attrs.filter(a => !['id', 'spans', 'text', 'tag'].includes(a.name)) || []
  const bgClass = cm === 'tp' ? '#e8f5e9' : cm === 'fp' ? '#fff3e0' : '#fce4ec'

  const contextHtml = useMemo(() => {
    if (!showContext || !tag.spans) return null
    const loc = spans2loc(tag.spans)
    const cStart = Math.max(0, loc[0] - 200)
    const cEnd = Math.min(ann.text.length, loc[1] + 200)
    const color = tagDef?.style?.color || '#999'
    return (
      ann.text.substring(cStart, loc[0]) +
      `<span style="background:${color};color:#fff;padding:0 2px;border-radius:2px">${tag.text || ''}</span>` +
      ann.text.substring(loc[1], cEnd)
    )
  }, [tag, ann, showContext, tagDef])

  return (
    <div style={{ background: bgClass, padding: '3px 6px', borderRadius: 3, fontSize: 11, marginBottom: 2 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 4 }}>
        <button onClick={onAccept}
          style={{
            fontSize: 10, padding: '1px 6px', border: '1px solid #ccc', borderRadius: 3,
            background: '#fff', cursor: 'pointer',
          }}>Accept</button>
        <span style={{
          background: tagDef?.style?.color || '#999', color: '#fff',
          padding: '0 3px', borderRadius: 2, fontSize: 10,
        }}>{tag.id}</span>
        <span>{tag.spans === '-1~-1' ? 'DOCLEVEL' : tag.spans}: <b>{tag.text}</b></span>
        {attrs.map(a => (
          <span key={a.name} style={{ color: '#666' }}>
            <span style={{ fontSize: 10, color: '#999' }}>{a.name}:</span> {tag[a.name] || ''}
          </span>
        ))}
      </div>
      {contextHtml && (
        <div style={{ marginTop: 2, fontSize: 10, color: '#555', lineHeight: 1.4 }}
          dangerouslySetInnerHTML={{ __html: contextHtml }} />
      )}
    </div>
  )
}

function IaaTagInfoGs({
  gsObj,
  onReject,
}: {
  gsObj: GsTagObj | null; cm: string; tagIdx: number
  onReject: () => void
}) {
  if (gsObj == null) {
    return <div style={{ fontSize: 10, color: '#999', padding: 3 }}>Rejected</div>
  }
  return (
    <div style={{ background: '#e3f2fd', padding: '3px 6px', borderRadius: 3, fontSize: 11, marginBottom: 2 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <button onClick={onReject}
          style={{
            fontSize: 10, padding: '1px 6px', border: '1px solid #ccc', borderRadius: 3,
            background: '#fff', cursor: 'pointer', color: '#d32f2f',
          }}>Remove</button>
        <UserOutlined style={{ fontSize: 10 }} />
        <b>{gsObj.from}</b>
        <span>{gsObj.tag.spans}: <b>{gsObj.tag.text}</b></span>
      </div>
    </div>
  )
}

// ── F1 bar ──
function F1Bar({ value, maxWidth = 100 }: { value: number; maxWidth?: number }) {
  const w = isNaN(value) ? 0 : Math.round(value * maxWidth)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <div style={{ width: w, height: 12, background: '#1890ff', borderRadius: 2 }} />
      <span style={{ fontSize: 11, fontWeight: isNaN(value) ? 'normal' : 'bold' }}>{toFixed(value)}</span>
    </div>
  )
}

// ── Helper: get rst by tag filter ──
function getRst(rst: AnnRst, tagName: string): TagResult {
  return tagName === '__all__' ? rst.all : rst.tag[tagName]
}

// ── Sort helper ──
function sortVAnns(
  iaaDict: IaaDict, sortBy: string, displayTagName: string
): { hashcode: string; f1: number; fnA: string; fnB: string }[] {
  const list: { hashcode: string; f1: number; fnA: string; fnB: string }[] = []
  for (const hc in iaaDict.ann) {
    const rst = iaaDict.ann[hc].rst
    const f1 = displayTagName === '__all__' ? rst.all.f1 : rst.tag[displayTagName]?.f1 ?? NaN
    list.push({ hashcode: hc, f1, fnA: iaaDict.ann[hc].anns[0]._filename || '', fnB: iaaDict.ann[hc].anns[1]._filename || '' })
  }
  if (sortBy === 'f1_asc') list.sort((a, b) => (isNaN(a.f1) ? 0 : a.f1) - (isNaN(b.f1) ? 0 : b.f1))
  else if (sortBy === 'f1_desc') list.sort((a, b) => (isNaN(b.f1) ? 0 : b.f1) - (isNaN(a.f1) ? 0 : a.f1))
  else if (sortBy === 'a.alphabet') list.sort((a, b) => a.fnA.localeCompare(b.fnA))
  else if (sortBy === 'a.alphabet_r') list.sort((a, b) => -a.fnA.localeCompare(b.fnA))
  else if (sortBy === 'b.alphabet') list.sort((a, b) => a.fnB.localeCompare(b.fnB))
  else if (sortBy === 'b.alphabet_r') list.sort((a, b) => -a.fnB.localeCompare(b.fnB))
  return list
}

// ── GS tag counting ──
function countGsTags(gsEntry: GsAnnEntry, tagName: string): number {
  let cnt = 0
  const rstToCount = tagName === '__all__' ? gsEntry.rst : { [tagName]: gsEntry.rst[tagName] }
  for (const tn in rstToCount) {
    if (!rstToCount[tn]) continue
    for (const cm of ['tp', 'fp', 'fn'] as const) {
      for (const item of rstToCount[tn][cm]) if (item != null) cnt++
    }
  }
  return cnt
}

// ── Main component ──

export default function Adjudication() {
  const dtd = useAppStore(s => s.dtd)

  // Annotator data
  const [annsA, setAnnsA] = useState<Ann[]>([])
  const [annsB, setAnnsB] = useState<Ann[]>([])
  const [loadingA, setLoadingA] = useState(false)
  const [loadingB, setLoadingB] = useState(false)

  // IAA settings
  const [overlapRatio, setOverlapRatio] = useState(50)
  const [useAttributes, setUseAttributes] = useState(false)
  const [tagAttrs, setTagAttrs] = useState<Record<string, Record<string, boolean>>>({})

  // Results
  const [iaaDict, setIaaDict] = useState<IaaDict | null>(null)
  const [gsDict, setGsDict] = useState<GsDict | null>(null)
  const [, setForceUpdate] = useState(0)

  // Display
  const [displayTagName, setDisplayTagName] = useState('__all__')
  const [displayHashcode, setDisplayHashcode] = useState<string | null>(null)
  const [displayMeasure, setDisplayMeasure] = useState<'f1' | 'cohen_kappa'>('f1')
  const [showAgreedTags, setShowAgreedTags] = useState(false)
  const [showContext, setShowContext] = useState(true)
  const [sortBy, setSortBy] = useState('default')

  // ── Load files ──
  const loadFiles = (files: { fn: string; text: string }[], which: 0 | 1) => {
    if (!dtd) return
    const setLoading = which === 0 ? setLoadingA : setLoadingB
    const setAnns = which === 0 ? setAnnsA : setAnnsB
    setLoading(true)
    const parsed: Ann[] = []
    for (const f of files) {
      try {
        const ann = xml2ann(f.text, dtd)
        ann._filename = f.fn
        parsed.push(ann)
      } catch { /* skip */ }
    }
    setAnns(prev => [...prev, ...parsed])
    setLoading(false)
  }

  const clearAll = (which: 0 | 1 | null) => {
    if (which == null || which === 0) setAnnsA([])
    if (which == null || which === 1) setAnnsB([])
    setIaaDict(null)
    setGsDict(null)
    setDisplayTagName('__all__')
    setDisplayHashcode(null)
  }

  // ── Calculate ──
  const calculate = () => {
    if (!dtd || annsA.length === 0 || annsB.length === 0) return
    try {
      const attrs = useAttributes ? tagAttrs : null
      const result = evaluateAnnsOnDtd(dtd, annsA, annsB, 'overlap', overlapRatio / 100, attrs, true)
      setIaaDict(result)
      setGsDict(getDefaultGsDict(dtd, result))
      setDisplayHashcode(null)
      message.success(`Calculated IAA: ${result.stat.matched_hashcodes.length} matched documents`)
    } catch (e) {
      console.error('IAA calculation error:', e)
      message.error('Calculation failed: ' + (e instanceof Error ? e.message : String(e)))
    }
  }

  // ── Attribute settings ──
  const initTagAttrs = () => {
    if (!dtd) return
    const attrs: Record<string, Record<string, boolean>> = {}
    for (const tagName in dtd.tag_dict) {
      attrs[tagName] = {}
      for (const attr of dtd.tag_dict[tagName].attrs) attrs[tagName][attr.name] = true
    }
    setTagAttrs(attrs)
  }

  // ── Accept/Reject ──
  const acceptTag = (hashcode: string, tagName: string, cm: 'tp' | 'fp' | 'fn', tagIdx: number, from: 'A' | 'B') => {
    if (!gsDict || !iaaDict) return
    const fromIdx = from === 'A' ? 0 : 1
    const tag = iaaDict.ann[hashcode].rst.tag[tagName].cm.tags[cm][tagIdx][fromIdx]
    if (!tag) return
    gsDict[hashcode].rst[tagName][cm][tagIdx] = { tag, from }
    setForceUpdate(v => v + 1)
  }

  const rejectTag = (hashcode: string, tagName: string, cm: 'tp' | 'fp' | 'fn', tagIdx: number) => {
    if (!gsDict) return
    gsDict[hashcode].rst[tagName][cm][tagIdx] = null
    setForceUpdate(v => v + 1)
  }

  // ── Downloads ──
  const downloadGsFile = (hashcode: string) => {
    if (!gsDict || !dtd) return
    const ann = makeAnnByRst(gsDict[hashcode], dtd)
    const xmlText = xml2str(ann2xml(ann, dtd))
    const blob = new Blob([xmlText], { type: 'text/xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = gsDict[hashcode].ann._filename || 'gs.xml'
    a.click(); URL.revokeObjectURL(url)
  }

  const downloadAllGs = async () => {
    if (!gsDict || !dtd) return
    const zip = new JSZip()
    const folder = dtd.name + '-goldstandards'
    for (const hc in gsDict) {
      const ann = makeAnnByRst(gsDict[hc], dtd)
      zip.file(folder + '/' + (ann._filename || 'gs.xml'), xml2str(ann2xml(ann, dtd)))
    }
    const blob = await zip.generateAsync({ type: 'blob' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = folder + '.zip'
    a.click(); URL.revokeObjectURL(url)
  }

  const downloadAllIaaAnns = async () => {
    if (!gsDict || !iaaDict || !dtd) return
    const zip = new JSZip()
    const folder = dtd.name + '-goldstandards_ALL'
    for (const hc in gsDict) {
      const ann = makeAnnByIaa(gsDict[hc], iaaDict.ann[hc], dtd)
      zip.file(folder + '/' + (ann._filename || 'all.xml'), xml2str(ann2xml(ann, dtd)))
    }
    const blob = await zip.generateAsync({ type: 'blob' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = folder + '.zip'
    a.click(); URL.revokeObjectURL(url)
  }

  const exportReport = () => {
    if (!iaaDict || !dtd) return
    try {
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(getReportSummaryJson(iaaDict, dtd)), 'F1-Score')
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(getReportCohenKappaJson(iaaDict, dtd)), 'Cohen Kappa')
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(getReportFilesJson(iaaDict, dtd)), 'Files')
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(getReportTagsJson(iaaDict, dtd)), 'Tags')
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(getReportAdjudicationJson(iaaDict, dtd)), 'Adjudication')
      XLSX.writeFile(wb, dtd.name + '-iaa-report.xlsx')
    } catch (err) {
      console.error(err)
      message.error('Failed to generate report')
    }
  }

  // ── Sorted file list ──
  const sortedAnns = useMemo(() => {
    if (!iaaDict) return []
    return sortVAnns(iaaDict, sortBy, displayTagName)
  }, [iaaDict, sortBy, displayTagName])

  const ready = dtd != null && annsA.length > 0 && annsB.length > 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* ── Ribbon ── */}
      <div style={{
        display: 'flex', alignItems: 'stretch',
        borderBottom: '1px solid #ccc', background: '#fafafa',
        minHeight: 70, fontSize: 12, flexWrap: 'wrap', flexShrink: 0,
      }}>
        <TG label="">
          <RibbonBtn icon={<ClearOutlined />} label="Clear All" onClick={() => clearAll(null)}
            title="Clear all annotation files and IAA results" />
        </TG>

        <TG label="Annotator A">
          <IaaDropzone label="A" anns={annsA} dtd={dtd} loading={loadingA}
            onFiles={f => loadFiles(f, 0)} onClear={() => clearAll(0)} />
        </TG>

        <TG label="Annotator B">
          <IaaDropzone label="B" anns={annsB} dtd={dtd} loading={loadingB}
            onFiles={f => loadFiles(f, 1)} onClear={() => clearAll(1)} />
        </TG>

        <TG label="IAA">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '0 4px', justifyContent: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
              <span>Overlap %</span>
              <input type="number" min={0} max={100} value={overlapRatio}
                onChange={e => setOverlapRatio(Number(e.target.value))}
                style={{ width: 36, fontSize: 11, textAlign: 'center' }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
              <Switch size="small" checked={useAttributes}
                onChange={v => { setUseAttributes(v); if (v && Object.keys(tagAttrs).length === 0) initTagAttrs() }} />
              <span>Attributes</span>
            </div>
          </div>
          <RibbonBtn icon={<CalculatorOutlined />} label="Calculate"
            disabled={!ready} onClick={calculate}
            title="Calculate IAA for annotation files" />
          <RibbonBtn icon={<FileExcelOutlined />} label="Report"
            disabled={!iaaDict} onClick={exportReport}
            title="Download IAA report as Excel" />
        </TG>

        <TG label="Tag Display">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '0 4px', justifyContent: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
              <Switch size="small" checked={showAgreedTags} onChange={setShowAgreedTags} />
              <span>Agreed Tags</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
              <Switch size="small" checked={showContext} onChange={setShowContext} />
              <span>Context</span>
            </div>
          </div>
        </TG>

        {iaaDict && gsDict && (
          <TG label="Adjudication">
            <RibbonBtn icon={<DownloadOutlined />} label={<>All Tags<br/>A &amp; B</>} onClick={downloadAllIaaAnns}
              title="Download all tags from both annotators as ZIP" />
            <RibbonBtn icon={<DownloadOutlined />} label={<>Gold<br/>Standard</>} onClick={downloadAllGs}
              title="Download adjudicated gold standard as ZIP" />
          </TG>
        )}

        <TG label="Help">
          <RibbonBtn icon={<QuestionCircleOutlined />} label="How to use"
            onClick={() => window.open('https://github.com/OHNLP/MedTator/wiki', '_blank')} />
        </TG>
      </div>

      {/* ── Body ── */}
      {!iaaDict || !dtd ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999' }}>
          Load annotation files for both annotators and click "Calculate".
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Tabs */}
          <div style={{
            display: 'flex', borderBottom: '1px solid #e8e8e8', flexShrink: 0,
          }}>
            <button
              onClick={() => setDisplayMeasure('f1')}
              style={{
                padding: '6px 16px', border: 'none', borderBottom: displayMeasure === 'f1' ? '2px solid #1890ff' : '2px solid transparent',
                background: 'none', cursor: 'pointer', fontWeight: displayMeasure === 'f1' ? 600 : 400, fontSize: 13,
              }}>F1 Score</button>
            <button
              onClick={() => setDisplayMeasure('cohen_kappa')}
              style={{
                padding: '6px 16px', border: 'none', borderBottom: displayMeasure === 'cohen_kappa' ? '2px solid #1890ff' : '2px solid transparent',
                background: 'none', cursor: 'pointer', fontWeight: displayMeasure === 'cohen_kappa' ? 600 : 400, fontSize: 13,
              }}>Cohen's Kappa</button>
          </div>

          {displayMeasure === 'f1' ? (
            <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

              {/* ── Left: F1 Summary ── */}
              <div style={{ width: 220, borderRight: '1px solid #e8e8e8', overflowY: 'auto', flexShrink: 0, padding: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 4 }}>Tag Name / F1</div>

                {/* OVERALL */}
                <div
                  onClick={() => setDisplayTagName('__all__')}
                  style={{
                    padding: '4px 6px', cursor: 'pointer', borderRadius: 3, marginBottom: 2,
                    background: displayTagName === '__all__' ? '#e6f7ff' : 'transparent',
                  }}>
                  <div style={{ fontWeight: 600, fontSize: 12 }}>OVERALL</div>
                  <F1Bar value={iaaDict.all.f1} />
                </div>

                {dtd.etags.map(etag => (
                  <div key={etag.name}
                    onClick={() => setDisplayTagName(etag.name)}
                    style={{
                      padding: '4px 6px', cursor: 'pointer', borderRadius: 3, marginBottom: 2,
                      background: displayTagName === etag.name ? '#e6f7ff' : 'transparent',
                    }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
                      <span style={{
                        width: 10, height: 10, borderRadius: 2,
                        background: etag.style?.color || '#999', display: 'inline-block',
                      }} />
                      {etag.name}
                    </div>
                    <F1Bar value={iaaDict.tag[etag.name]?.f1 ?? NaN} />
                  </div>
                ))}

                <div style={{ marginTop: 12, fontSize: 11, color: '#666' }}>
                  <div>Matched: <b>{iaaDict.stat.matched_hashcodes.length}</b></div>
                  <div>Duplicated: <b>{iaaDict.stat.duplicates.length}</b></div>
                  <div>Unmatched: <b>{iaaDict.stat.unmatched.length}</b></div>
                </div>
              </div>

              {/* ── Center: File list ── */}
              <div style={{ flex: 1, borderRight: '1px solid #e8e8e8', overflowY: 'auto', flexShrink: 0, minWidth: 200 }}>
                <div style={{ padding: '4px 8px', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Select size="small" value={sortBy} onChange={setSortBy}
                    style={{ width: 130, fontSize: 11 }}
                    options={[
                      { value: 'default', label: 'Default' },
                      { value: 'f1_asc', label: 'F1 (0→1)' },
                      { value: 'f1_desc', label: 'F1 (1→0)' },
                      { value: 'a.alphabet', label: 'A (A→Z)' },
                      { value: 'a.alphabet_r', label: 'A (Z→A)' },
                      { value: 'b.alphabet', label: 'B (A→Z)' },
                      { value: 'b.alphabet_r', label: 'B (Z→A)' },
                    ]} />
                  <span style={{ fontSize: 11, fontWeight: 600 }}>Annotation Files</span>
                </div>

                {sortedAnns.map(v => {
                  const rst = getRst(iaaDict.ann[v.hashcode].rst, displayTagName)
                  const gsEntry = gsDict?.[v.hashcode]
                  return (
                    <div key={v.hashcode}
                      onClick={() => setDisplayHashcode(v.hashcode)}
                      style={{
                        padding: '4px 8px', cursor: 'pointer', borderBottom: '1px solid #f5f5f5',
                        background: displayHashcode === v.hashcode ? '#e6f7ff' : 'transparent',
                      }}>
                      <div style={{ fontSize: 10, color: '#555' }}>A: {v.fnA}</div>
                      <div style={{ fontSize: 10, color: '#555' }}>B: {v.fnB}</div>
                      {gsEntry && (
                        <div style={{ fontSize: 10, color: '#555', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <button onClick={e => { e.stopPropagation(); downloadGsFile(v.hashcode) }}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#1890ff', fontSize: 10 }}
                            title="Download gold standard file">
                            <DownloadOutlined />
                          </button>
                          GS: {gsEntry.ann._filename}
                        </div>
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                        <F1Bar value={rst?.f1 ?? NaN} maxWidth={60} />
                        <span style={{ fontSize: 10, color: '#888' }}>
                          AB:{rst?.cm.tp ?? 0} A+:{rst?.cm.fp ?? 0} B+:{rst?.cm.fn ?? 0}
                        </span>
                      </div>
                      {gsEntry && (
                        <div style={{ fontSize: 10, color: '#888' }}>
                          GS: {countGsTags(gsEntry, displayTagName)} tags
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* ── Right: Tag details ── */}
              <div style={{ flex: 2, overflowY: 'auto', minWidth: 300 }}>
                {displayHashcode && iaaDict.ann[displayHashcode] ? (
                  <div style={{ padding: 8 }}>
                    {/* Header */}
                    <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
                      <div style={{ flex: 2, fontWeight: 600, fontSize: 11, color: '#d9e9f1', background: '#1890ff', padding: '3px 6px', borderRadius: 3 }}>
                        A: {iaaDict.ann[displayHashcode].anns[0]._filename}
                      </div>
                      <div style={{ flex: 2, fontWeight: 600, fontSize: 11, color: '#d8f7d6', background: '#52c41a', padding: '3px 6px', borderRadius: 3 }}>
                        B: {iaaDict.ann[displayHashcode].anns[1]._filename}
                      </div>
                      {gsDict && (
                        <div style={{ flex: 1, fontWeight: 600, fontSize: 11, color: '#fff', background: '#722ed1', padding: '3px 6px', borderRadius: 3 }}>
                          GS: {gsDict[displayHashcode]?.ann._filename}
                        </div>
                      )}
                    </div>

                    {/* Per-tag details */}
                    {dtd.etags
                      .filter(et => displayTagName === '__all__' || displayTagName === et.name)
                      .map(etag => {
                        const tagRst = iaaDict.ann[displayHashcode].rst.tag[etag.name]
                        if (!tagRst) return null
                        const gsTagRst = gsDict?.[displayHashcode]?.rst[etag.name]
                        return (
                          <div key={etag.name} style={{ marginBottom: 12 }}>
                            {/* Tag header */}
                            <div style={{
                              display: 'flex', alignItems: 'center', gap: 6,
                              padding: '4px 6px', background: '#fafafa', borderRadius: 3, marginBottom: 4,
                            }}>
                              <span style={{
                                width: 10, height: 10, borderRadius: 2,
                                background: etag.style?.color || '#999', display: 'inline-block',
                              }} />
                              <b>{etag.name}</b>
                              <span style={{ fontSize: 10, color: '#888' }}>
                                AB:{tagRst.cm.tp} A+:{tagRst.cm.fp} B+:{tagRst.cm.fn}
                              </span>
                              {gsTagRst && (
                                <span style={{ fontSize: 10, color: '#722ed1' }}>
                                  GS: {countGsTags({ ann: gsDict![displayHashcode].ann, rst: { [etag.name]: gsTagRst } }, etag.name)}
                                </span>
                              )}
                            </div>

                            {/* TP rows */}
                            {showAgreedTags && tagRst.cm.tags.tp.map((pair, idx) => (
                              <div key={'tp-' + idx} style={{ display: 'flex', gap: 4, marginBottom: 2 }}>
                                <div style={{ flex: 2 }}>
                                  <IaaTagInfo tag={pair[0]} ann={iaaDict.ann[displayHashcode].anns[0]} dtd={dtd}
                                    cm="tp" showContext={showContext}
                                    onAccept={() => acceptTag(displayHashcode, etag.name, 'tp', idx, 'A')} />
                                </div>
                                <div style={{ flex: 2 }}>
                                  <IaaTagInfo tag={pair[1]} ann={iaaDict.ann[displayHashcode].anns[1]} dtd={dtd}
                                    cm="tp" showContext={showContext}
                                    onAccept={() => acceptTag(displayHashcode, etag.name, 'tp', idx, 'B')} />
                                </div>
                                {gsDict && gsTagRst && (
                                  <div style={{ flex: 1 }}>
                                    <IaaTagInfoGs gsObj={gsTagRst.tp[idx]} cm="tp" tagIdx={idx}
                                      onReject={() => rejectTag(displayHashcode, etag.name, 'tp', idx)} />
                                  </div>
                                )}
                              </div>
                            ))}

                            {/* FP rows (A only) */}
                            {tagRst.cm.tags.fp.map((pair, idx) => (
                              <div key={'fp-' + idx} style={{ display: 'flex', gap: 4, marginBottom: 2 }}>
                                <div style={{ flex: 2 }}>
                                  <IaaTagInfo tag={pair[0]} ann={iaaDict.ann[displayHashcode].anns[0]} dtd={dtd}
                                    cm="fp" showContext={showContext}
                                    onAccept={() => acceptTag(displayHashcode, etag.name, 'fp', idx, 'A')} />
                                </div>
                                <div style={{ flex: 2 }}>
                                  {pair[1] ? (
                                    <IaaTagInfo tag={pair[1]} ann={iaaDict.ann[displayHashcode].anns[1]} dtd={dtd}
                                      cm="fp" showContext={showContext}
                                      onAccept={() => acceptTag(displayHashcode, etag.name, 'fp', idx, 'B')} />
                                  ) : <div style={{ flex: 1 }} />}
                                </div>
                                {gsDict && gsTagRst && (
                                  <div style={{ flex: 1 }}>
                                    <IaaTagInfoGs gsObj={gsTagRst.fp[idx]} cm="fp" tagIdx={idx}
                                      onReject={() => rejectTag(displayHashcode, etag.name, 'fp', idx)} />
                                  </div>
                                )}
                              </div>
                            ))}

                            {/* FN rows (B only) */}
                            {tagRst.cm.tags.fn.map((pair, idx) => (
                              <div key={'fn-' + idx} style={{ display: 'flex', gap: 4, marginBottom: 2 }}>
                                <div style={{ flex: 2 }} />
                                <div style={{ flex: 2 }}>
                                  <IaaTagInfo tag={pair[1]} ann={iaaDict.ann[displayHashcode].anns[1]} dtd={dtd}
                                    cm="fn" showContext={showContext}
                                    onAccept={() => acceptTag(displayHashcode, etag.name, 'fn', idx, 'B')} />
                                </div>
                                {gsDict && gsTagRst && (
                                  <div style={{ flex: 1 }}>
                                    <IaaTagInfoGs gsObj={gsTagRst.fn[idx]} cm="fn" tagIdx={idx}
                                      onReject={() => rejectTag(displayHashcode, etag.name, 'fn', idx)} />
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )
                      })}
                  </div>
                ) : (
                  <div style={{ padding: 32, color: '#999', textAlign: 'center' }}>
                    Select a document from the file list to view tag comparisons.
                  </div>
                )}
              </div>
            </div>

          ) : (
            /* ── Cohen's Kappa Panel ── */
            <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
              <div style={{ fontSize: 13, marginBottom: 12 }}>
                <span>Overall Cohen's Kappa: <b>{toFixed(iaaDict.all.cohen_kappa.kappa)}</b></span>
                &nbsp;&nbsp;
                <span>Percentage Agreement: <b>{toFixed(iaaDict.all.cohen_kappa.Po)}</b></span>
              </div>
              <div style={{ fontSize: 12, marginBottom: 12 }}>
                <i>TP</i>: <b>{iaaDict.all.cm.tp}</b>&nbsp;
                <i>FP</i>: <b>{iaaDict.all.cm.fp}</b>&nbsp;
                <i>FN</i>: <b>{iaaDict.all.cm.fn}</b>&nbsp;
                <i>N</i>: <b>{iaaDict.all.cohen_kappa.N}</b>
                <br />
                <i>Po</i>: <b>{toFixed(iaaDict.all.cohen_kappa.Po)}</b>&nbsp;
                <i>Pe</i>: <b>{toFixed(iaaDict.all.cohen_kappa.Pe)}</b>&nbsp;
                <i>SE<sub>k</sub></i>: <b>{toFixed(iaaDict.all.cohen_kappa.SE_k)}</b>&nbsp;
                <i>95% CI</i>: <b>{toFixed(iaaDict.all.cohen_kappa.lower)}, {toFixed(iaaDict.all.cohen_kappa.upper)}</b>
              </div>

              {/* Confusion matrix */}
              <table style={{ borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr>
                    <th colSpan={2} style={{ border: 0 }}>&nbsp;</th>
                    <th colSpan={dtd.etags.length + 2} style={{ border: '1px solid #ddd', padding: 4, textAlign: 'center' }}>
                      <b>Annotator B</b>
                    </th>
                  </tr>
                  <tr>
                    <th style={{ border: '1px solid #ddd', padding: 4 }}>&nbsp;</th>
                    <th style={{ border: '1px solid #ddd', padding: 4 }}>&nbsp;</th>
                    {dtd.etags.map(t => (
                      <th key={t.name} style={{ border: '1px solid #ddd', padding: 4 }}>
                        <div style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', whiteSpace: 'nowrap', fontSize: 11 }}>
                          <span style={{
                            width: 8, height: 8, borderRadius: 2,
                            background: t.style?.color || '#999', display: 'inline-block', marginRight: 2,
                          }} />
                          {t.name}
                        </div>
                      </th>
                    ))}
                    <th style={{ border: '1px solid #ddd', padding: 4 }}>EMPTY</th>
                    <th style={{ border: '1px solid #ddd', padding: 4 }}><i>P<sub>b</sub></i></th>
                  </tr>
                </thead>
                <tbody>
                  {dtd.etags.map((etagRow, rowIdx) => (
                    <tr key={etagRow.name}>
                      {rowIdx === 0 && (
                        <td rowSpan={dtd.etags.length + 2} style={{
                          border: '1px solid #ddd', padding: 8, verticalAlign: 'middle', fontWeight: 'bold',
                        }}>Annotator A</td>
                      )}
                      <td style={{ border: '1px solid #ddd', padding: 4, fontWeight: 'bold' }}>
                        <span style={{
                          width: 8, height: 8, borderRadius: 2,
                          background: etagRow.style?.color || '#999', display: 'inline-block', marginRight: 4,
                        }} />
                        {etagRow.name}
                      </td>
                      {dtd.etags.map(etagCol => (
                        <td key={etagCol.name} style={{
                          border: '1px solid #ddd', padding: 4, textAlign: 'center',
                          background: etagRow.name === etagCol.name ? '#e6f7ff' : '',
                        }}>
                          {etagRow.name === etagCol.name ? iaaDict.tag[etagRow.name].cm.tp : ''}
                        </td>
                      ))}
                      <td style={{ border: '1px solid #ddd', padding: 4, textAlign: 'center', color: '#888' }}>
                        {iaaDict.tag[etagRow.name].cm.fp}
                      </td>
                      <td style={{ border: '1px solid #ddd', padding: 4, textAlign: 'center', fontStyle: 'italic' }}>
                        {toFixed(iaaDict.all.cohen_kappa.Pes?.b[etagRow.name])}
                      </td>
                    </tr>
                  ))}
                  {/* EMPTY row */}
                  <tr>
                    <td style={{ border: '1px solid #ddd', padding: 4, fontWeight: 'bold' }}>EMPTY</td>
                    {dtd.etags.map(etagCol => (
                      <td key={etagCol.name} style={{ border: '1px solid #ddd', padding: 4, textAlign: 'center', color: '#888' }}>
                        {iaaDict.tag[etagCol.name].cm.fn}
                      </td>
                    ))}
                    <td style={{ border: '1px solid #ddd', padding: 4, textAlign: 'center', color: '#888' }}>0</td>
                    <td style={{ border: '1px solid #ddd', padding: 4, textAlign: 'center', fontStyle: 'italic' }}>
                      {toFixed(iaaDict.all.cohen_kappa.Pes?.b['_EMPTY_'])}
                    </td>
                  </tr>
                  {/* P_a row */}
                  <tr>
                    <td style={{ border: '1px solid #ddd', padding: 4, fontWeight: 'bold' }}><i>P<sub>a</sub></i></td>
                    {dtd.etags.map(etagCol => (
                      <td key={etagCol.name} style={{ border: '1px solid #ddd', padding: 4, textAlign: 'center', fontStyle: 'italic' }}>
                        {toFixed(iaaDict.all.cohen_kappa.Pes?.a[etagCol.name])}
                      </td>
                    ))}
                    <td style={{ border: '1px solid #ddd', padding: 4, textAlign: 'center', fontStyle: 'italic' }}>
                      {toFixed(iaaDict.all.cohen_kappa.Pes?.a['_EMPTY_'])}
                    </td>
                    <td style={{ border: '1px solid #ddd', padding: 4 }} />
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
