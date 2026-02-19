import { useMemo, useState } from 'react'
import { Switch, message } from 'antd'
import { SyncOutlined, FileTextOutlined, FileExcelOutlined, UndoOutlined } from '@ant-design/icons'
import * as XLSX from 'xlsx'
import { useAppStore } from '../store'
import { downloadTextAsFile } from '../utils/file-helper'
import { anns2hintDict } from '../parsers/ann-parser'
import type { AnnTag } from '../types'
import type { HintDict } from '../parsers/ann-parser'
import type { Ann, Dtd } from '../types'

// ── Pure stat helpers (ported from stat_helper.js) ──

function countAllTags(anns: Ann[]) {
  return anns.reduce((n, a) => n + a.tags.length, 0)
}

function countAllSentences(anns: Ann[]) {
  return anns.reduce((n, a) => n + (a._sentences?.length ?? 0), 0)
}

function countTagsByConcepts(anns: Ann[], dtd: Dtd): Record<string, number> {
  const cnt: Record<string, number> = {}
  for (const name in dtd.tag_dict) cnt[name] = 0
  for (const ann of anns)
    for (const tag of ann.tags) cnt[tag.tag] = (cnt[tag.tag] ?? 0) + 1
  return cnt
}

function getStatItems(anns: Ann[], dtd: Dtd): [string, number | string, any][] {
  const total = countAllTags(anns)
  const sents = countAllSentences(anns)
  const items: [string, number | string, any][] = [
    ['# of documents', anns.length, null],
    ['# of tags in schema', dtd.etags.length, null],
    ['# of annotations', total, null],
    ['# of annotations per tag', anns.length && dtd.etags.length ? (total / dtd.etags.length).toFixed(2) : '-', null],
    ['# of annotations per doc', anns.length ? (total / anns.length).toFixed(2) : '-', null],
    ['# of sentences', sents, null],
    ['# of sentences per doc', anns.length ? (sents / anns.length).toFixed(2) : '-', null],
  ]
  const cnt = countTagsByConcepts(anns, dtd)
  for (const tag_name in cnt) {
    items.push([`# of ${tag_name}`, cnt[tag_name], { stat_type: 'tag_count', tag: tag_name }])
  }
  return items
}

function getDocsByTagsData(anns: Ann[], dtd: Dtd) {
  const stat = { max_by_ann_tag: 0, max_by_ann: 0, max_by_tag: 0 }
  const allTags = [...dtd.etags, ...dtd.rtags]
  const summary: Record<string, any> = { file_name: 'Summary', _total_tags: 0 }
  for (const t of allTags) summary[t.name] = 0

  const rows = anns.map(ann => {
    const row: Record<string, any> = { file_name: ann._filename, _total_tags: 0 }
    for (const t of allTags) row[t.name] = 0
    for (const tag of ann.tags) {
      row[tag.tag]++
      row._total_tags++
      summary[tag.tag]++
      summary._total_tags++
      if (row[tag.tag] > stat.max_by_ann_tag) stat.max_by_ann_tag = row[tag.tag]
      if (summary[tag.tag] > stat.max_by_tag) stat.max_by_tag = summary[tag.tag]
    }
    if (ann.tags.length > stat.max_by_ann) stat.max_by_ann = ann.tags.length
    return row
  })

  return { stat, rs: [summary, ...rows] }
}

// Color interpolation (approximates d3.interpolateReds without d3)
function val2bgcolor(val: number, max: number): string {
  if (val === 0 || max === 0) return '#ffffff'
  const r = val / max
  return `rgb(${Math.round(255 - r * 152)},${Math.round(245 - r * 245)},${Math.round(240 - r * 227)})`
}

function val2ftcolor(val: number, max: number): string {
  return max > 0 && val / max > 0.7 ? '#ffffff' : '#000000'
}

// ── Export functions ──

function downloadCsv(anns: Ann[], dtd: Dtd) {
  const items = getStatItems(anns, dtd)
  const rows = [['item', 'result'], ...items.map(([label, val]) => [label, String(val)])]
  const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n')
  downloadTextAsFile(`${dtd.name}-statistics.csv`, csv)
}

function downloadExcel(anns: Ann[], dtd: Dtd) {
  const items = getStatItems(anns, dtd)
  const summaryJson = items.map(([label, val]) => ({ measure: label, result: val }))
  const ws_summary = XLSX.utils.json_to_sheet(summaryJson)

  const docData = getDocsByTagsData(anns, dtd)
  const ws_docs = XLSX.utils.json_to_sheet(docData.rs)

  const nMax = Math.max(docData.stat.max_by_ann_tag, 10)
  const allTagNames = new Set([...dtd.etags, ...dtd.rtags].map(t => t.name))

  for (const coord in ws_docs) {
    if (!coord.startsWith('!')) {
      const cell = ws_docs[coord]
      if (typeof cell.v === 'number' && !coord.startsWith('B')) {
        const fg = val2bgcolor(cell.v, nMax).match(/\d+/g)!
        const fgHex = fg.map(n => parseInt(n).toString(16).padStart(2, '0')).join('')
        const fontDark = cell.v / nMax <= 0.7
        cell.s = {
          fill: { fgColor: { rgb: cell.v === 0 ? 'FFFFFF' : fgHex } },
          font: { color: { rgb: fontDark ? '000000' : 'FFFFFF' } },
        }
      } else if (typeof cell.v === 'string' && allTagNames.has(cell.v)) {
        const color = dtd.tag_dict[cell.v]?.style?.color?.substring(1) ?? '333333'
        cell.s = { fill: { fgColor: { rgb: color } }, font: { sz: 14 } }
      }
    }
  }

  const wb = { SheetNames: ['Summary', 'Documents'], Sheets: { Summary: ws_summary, Documents: ws_docs } }
  XLSX.writeFile(wb, `${dtd.name}-annotation-statistics.xlsx`)
}

// ── Toolbar components ──

// Ribbon-style button: icon on top, label below, ~52px tall
function RibbonBtn({ icon, label, disabled, onClick, title }: {
  icon: React.ReactNode
  label: string
  disabled?: boolean
  onClick?: () => void
  title?: string
}) {
  return (
    <button
      title={title}
      disabled={disabled}
      onClick={onClick}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', gap: 2,
        minWidth: 52, height: 52, padding: '4px 10px',
        border: '1px solid transparent', borderRadius: 3,
        background: 'transparent', cursor: disabled ? 'default' : 'pointer',
        color: disabled ? '#bbb' : '#333',
        fontSize: 11, lineHeight: 1.2,
        transition: 'background 0.15s, border-color 0.15s',
      }}
      onMouseEnter={e => {
        if (!disabled) (e.currentTarget as HTMLButtonElement).style.background = '#e6f0ff'
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLButtonElement).style.background = 'transparent'
      }}
    >
      <span style={{ fontSize: 20 }}>{icon}</span>
      <span style={{ whiteSpace: 'nowrap' }}>{label}</span>
    </button>
  )
}

// Toolbar group: children + label at bottom
function TG({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '4px 8px', borderRight: '1px solid #e8e8e8', gap: 2,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>
        {children}
      </div>
      <div style={{ fontSize: 10, color: '#888', whiteSpace: 'nowrap' }}>{label}</div>
    </div>
  )
}

// ── Cell popup ──

interface CellPopupState {
  x: number
  y: number
  fileName: string
  tagName: string
  tags: AnnTag[]
}

function CellPopup({ popup, dtd, onClose }: {
  popup: CellPopupState
  dtd: Dtd
  onClose: () => void
}) {
  const tagDef = dtd.tag_dict[popup.tagName]
  const color = tagDef?.style?.color ?? '#999'
  const nonBuiltin = tagDef?.attrs.filter(a => !['id', 'spans', 'text', 'tag'].includes(a.name)) ?? []

  return (
    <div
      style={{
        position: 'fixed',
        left: popup.x,
        top: popup.y,
        zIndex: 1000,
        background: '#fff',
        border: '1px solid #d9d9d9',
        borderRadius: 4,
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        minWidth: 260,
        maxWidth: 420,
        maxHeight: 320,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        fontSize: 12,
      }}
      onClick={e => e.stopPropagation()}
    >
      {/* Header */}
      <div style={{
        padding: '6px 10px',
        borderBottom: '1px solid #f0f0f0',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: '#fafafa',
      }}>
        <span>
          <b style={{ marginRight: 4 }}>{popup.fileName}</b>
          — <span style={{ color }}>{popup.tagName}</span>
          &nbsp;<span style={{ color: '#888' }}>({popup.tags.length} tags)</span>
        </span>
        <span
          style={{ cursor: 'pointer', color: '#888', fontSize: 14, lineHeight: 1 }}
          onClick={onClose}
        >✕</span>
      </div>

      {/* Tag list */}
      <div style={{ overflowY: 'auto', padding: '6px 10px', flex: 1 }}>
        {popup.tags.map(tag => (
          <div key={tag.id} style={{
            display: 'flex', flexWrap: 'wrap', gap: 6,
            marginBottom: 6, paddingBottom: 6,
            borderBottom: '1px solid #f0f0f0',
            alignItems: 'flex-start',
          }}>
            <span style={{
              background: color, color: '#fff',
              padding: '1px 5px', borderRadius: 3, fontSize: 11,
            }}>{tag.id}</span>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: 10, color: '#888' }}>{tag.spans}:</span>
              <b style={{ fontSize: 12 }}>{tag.text}</b>
            </div>
            {nonBuiltin.map(attr => (
              <div key={attr.name} style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: 10, color: '#888' }}>{attr.name}:</span>
                <span style={{ fontSize: 12 }}>{tag[attr.name] || '\u00a0'}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Token Summary sub-component ──

function TokenSummary({ dtd, hintDict, maxByTag, showTokenText, minTokens }: {
  dtd: Dtd
  hintDict: HintDict
  maxByTag: number
  showTokenText: boolean
  minTokens: number
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const toggle = (key: string) =>
    setExpanded(prev => ({ ...prev, [key]: !prev[key] }))

  return (
    <div>
      {dtd.etags.map(tagDef => {
        const entry = hintDict[tagDef.name]
        const color = tagDef.style?.color ?? '#999'
        const texts = entry
          ? Object.entries(entry.text_dict ?? {})
              .sort((a, b) => b[1].count - a[1].count)
              .filter(([, info]) => minTokens === 0 || info.count <= minTokens)
          : []
        const allTexts = entry ? Object.entries(entry.text_dict ?? {}) : []
        const ncCount = entry?.nc_dict?.count ?? 0

        return (
          <div key={tagDef.name} style={{
            display: 'flex', alignItems: 'flex-start', gap: 6,
            marginBottom: 6, paddingTop: 4, paddingBottom: 4,
            borderBottom: '1px solid #f5f5f5',
          }}>
            {/* Tag name column */}
            <div style={{
              minWidth: 140, padding: '2px 8px',
              borderLeft: `4px solid ${color}`,
              fontSize: 12, fontWeight: 600,
              display: 'flex', justifyContent: 'space-between',
              flexShrink: 0,
            }}>
              <span style={{ color }}>{tagDef.name}</span>
              <span style={{ color: '#999', fontWeight: 400 }}>
                {entry
                  ? (minTokens > 0 ? `${texts.length}/${allTexts.length}` : allTexts.length)
                  : '-'}
              </span>
            </div>

            {/* Tokens */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {/* DOC-LEVEL (non-consuming) */}
              {ncCount > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <div
                    onClick={() => toggle(`nc_${tagDef.name}`)}
                    style={{ cursor: 'pointer', display: 'flex', gap: 4, alignItems: 'center' }}
                  >
                    <span style={{
                      fontSize: 11, padding: '1px 4px', borderRadius: 3,
                      backgroundColor: val2bgcolor(ncCount, maxByTag),
                      color: val2ftcolor(ncCount, maxByTag),
                    }}>
                      {expanded[`nc_${tagDef.name}`] ? '▼' : '▶'} {ncCount}
                    </span>
                    {showTokenText && (
                      <span style={{ fontSize: 11, color: '#888' }}>DOC-LEVEL</span>
                    )}
                  </div>
                  {expanded[`nc_${tagDef.name}`] && (
                    <div style={{ paddingLeft: 8, marginTop: 2 }}>
                      {Object.entries(entry!.nc_dict.ann_fn_dict).map(([fn, cnt]) => (
                        <div key={fn} style={{ fontSize: 11, color: '#666', display: 'flex', gap: 4 }}>
                          <span style={{
                            fontSize: 11, padding: '1px 4px', borderRadius: 3,
                            backgroundColor: val2bgcolor(cnt as number, maxByTag),
                            color: val2ftcolor(cnt as number, maxByTag),
                          }}>{cnt as number}</span>
                          <span style={{ color: '#888' }}>›</span>
                          <span>{fn}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Span tokens */}
              {texts.map(([text, info]) => {
                const key = `${tagDef.name}_${text}`
                return (
                  <div key={text} style={{ display: 'flex', flexDirection: 'column' }}>
                    <div
                      onClick={() => toggle(key)}
                      style={{ cursor: 'pointer', display: 'flex', gap: 4, alignItems: 'center' }}
                    >
                      <span style={{
                        fontSize: 11, padding: '1px 4px', borderRadius: 3,
                        backgroundColor: val2bgcolor(info.count, maxByTag),
                        color: val2ftcolor(info.count, maxByTag),
                      }}>
                        {expanded[key] ? '▼' : '▶'} {info.count}
                      </span>
                      {showTokenText && (
                        <span style={{ fontSize: 11 }}>{text}</span>
                      )}
                    </div>
                    {expanded[key] && (
                      <div style={{ paddingLeft: 8, marginTop: 2 }}>
                        {Object.entries(info.ann_fn_dict).map(([fn, cnt]) => (
                          <div key={fn} style={{ fontSize: 11, color: '#666', display: 'flex', gap: 4 }}>
                            <span style={{
                              fontSize: 11, padding: '1px 4px', borderRadius: 3,
                              backgroundColor: val2bgcolor(cnt as number, maxByTag),
                              color: val2ftcolor(cnt as number, maxByTag),
                            }}>{cnt as number}</span>
                            <span style={{ color: '#888' }}>›</span>
                            <span>{fn}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Main component ──

export default function Statistics() {
  const anns = useAppStore(s => s.anns)
  const dtd = useAppStore(s => s.dtd)

  const [showTokenText, setShowTokenText] = useState(true)
  const [minTokens, setMinTokens] = useState(0)
  const [cellPopup, setCellPopup] = useState<CellPopupState | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  // Compute locally so data is always current; refreshKey forces a recompute on demand
  const hintDict = useMemo(() => {
    if (!dtd || anns.length === 0) return {}
    return anns2hintDict(dtd, anns)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anns, dtd, refreshKey])

  const statItems = useMemo(() => {
    if (!dtd || anns.length === 0) return []
    return getStatItems(anns, dtd)
  }, [anns, dtd])

  const docData = useMemo(() => {
    if (!dtd || anns.length === 0) return null
    return getDocsByTagsData(anns, dtd)
  }, [anns, dtd])

  const ready = dtd != null && anns.length > 0

  const handleCellClick = (e: React.MouseEvent, fileName: string, tagName: string) => {
    if (!dtd) return
    const ann = anns.find(a => a._filename === fileName)
    if (!ann) return
    const tags = ann.tags.filter(t => t.tag === tagName)
    if (tags.length === 0) return

    const rect = (e.target as HTMLElement).getBoundingClientRect()
    let x = rect.left
    let y = rect.bottom + 4
    // Keep inside viewport
    if (x + 420 > window.innerWidth) x = window.innerWidth - 430
    if (y + 320 > window.innerHeight) y = rect.top - 324

    setCellPopup({ x, y, fileName, tagName, tags })
  }

  const allTags = dtd ? [...dtd.etags, ...dtd.rtags] : []

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}
      onClick={() => setCellPopup(null)}
    >
      {/* ── Ribbon toolbar ── */}
      <div style={{
        display: 'flex',
        alignItems: 'stretch',
        borderBottom: '1px solid #ccc',
        background: '#fafafa',
        minHeight: 70,
        fontSize: 12,
        flexWrap: 'wrap',
        flexShrink: 0,
      }}>
        <TG label="">
          <RibbonBtn
            icon={<SyncOutlined />}
            label="Refresh"
            disabled={!ready}
            title="Rebuild token statistics from all loaded files"
            onClick={() => {
              setRefreshKey(k => k + 1)
              message.success('Statistics refreshed')
            }}
          />
        </TG>

        <TG label="Download">
          <RibbonBtn
            icon={<FileTextOutlined />}
            label="Summary (.csv)"
            disabled={!ready}
            title="Download summary as CSV"
            onClick={() => downloadCsv(anns, dtd!)}
          />
          <RibbonBtn
            icon={<FileExcelOutlined />}
            label="Details (.xlsx)"
            disabled={!ready}
            title="Download details as Excel"
            onClick={() => downloadExcel(anns, dtd!)}
          />
        </TG>

        <TG label="Filters">
          <RibbonBtn
            icon={<UndoOutlined />}
            label="Reset All"
            disabled={!ready}
            title="Reset all filters to defaults"
            onClick={() => setMinTokens(0)}
          />
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
            justifyContent: 'center', gap: 6, height: 52, padding: '0 8px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Switch
                size="small"
                checked={showTokenText}
                disabled={!ready}
                onChange={setShowTokenText}
              />
              <span style={{ fontSize: 11 }}>Token Text</span>
            </div>
          </div>
          <div style={{
            display: 'flex', flexDirection: 'column', gap: 2,
            justifyContent: 'center', height: 52, padding: '0 4px',
            minWidth: 100,
          }}>
            <div style={{ fontSize: 11 }}>
              Show Token: <b>{minTokens === 0 ? 'ALL' : `≤${minTokens}`}</b>
            </div>
            <input
              type="range"
              min={0}
              max={10}
              value={minTokens}
              disabled={!ready}
              onChange={e => setMinTokens(Number(e.target.value))}
              style={{ width: 90 }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#888', width: 90 }}>
              <span>All</span><span>5</span><span>10</span>
            </div>
          </div>
        </TG>
      </div>

      {/* ── Body ── */}
      {!ready ? (
        <div style={{ padding: 32, color: '#999', textAlign: 'center' }}>
          Load a schema and annotation files to view statistics.
        </div>
      ) : (
        <div style={{ display: 'flex', flex: 1, gap: 8, padding: 8, overflow: 'hidden' }}>

          {/* Left: Corpus Summary */}
          <div style={{ width: 260, flexShrink: 0, background: '#fff', border: '1px solid #e8e8e8', borderRadius: 4, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '8px 12px', borderBottom: '1px solid #e8e8e8', fontWeight: 600, fontSize: 13 }}>
              Corpus Summary
            </div>
            <div style={{ overflowY: 'auto', flex: 1, padding: 4 }}>
              {statItems.map(([label, val, ext], i) => (
                <div key={i} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '3px 4px', fontSize: 12,
                  borderBottom: '1px solid #f0f0f0',
                }}>
                  <span style={{ color: '#555', flex: 1 }}>{label}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontWeight: 600, minWidth: 30, textAlign: 'right' }}>{val}</span>
                    {ext?.stat_type === 'tag_count' && docData && (
                      <div style={{
                        height: 10,
                        width: `${Math.round((Number(val) / Math.max(docData.stat.max_by_tag, 1)) * 60)}px`,
                        backgroundColor: dtd!.tag_dict[ext.tag]?.style?.color ?? '#999',
                        borderRadius: 2, minWidth: 2,
                      }} />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Annotation Overview + Token Summary */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, overflow: 'hidden' }}>

            {/* Annotation Overview */}
            <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: 4, display: 'flex', flexDirection: 'column', flex: '0 0 auto', maxHeight: '45%' }}>
              <div style={{ padding: '8px 12px', borderBottom: '1px solid #e8e8e8', fontWeight: 600, fontSize: 13, flexShrink: 0 }}>
                Annotation Overview
              </div>
              <div style={{ overflow: 'auto', flex: 1 }}>
                {docData && (
                  <table style={{ borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr>
                        <th style={{
                          padding: '4px 8px', borderBottom: '2px solid #e8e8e8',
                          textAlign: 'left', whiteSpace: 'nowrap',
                          position: 'sticky', top: 0, background: '#fafafa', zIndex: 1,
                          verticalAlign: 'bottom',
                        }}>
                          File Name
                        </th>
                        <th style={{
                          padding: '4px 6px', borderBottom: '2px solid #e8e8e8',
                          textAlign: 'center',
                          position: 'sticky', top: 0, background: '#fafafa', zIndex: 1,
                          verticalAlign: 'bottom',
                        }}>
                          Total
                        </th>
                        {allTags.map(t => (
                          <th key={t.name} style={{
                            padding: '4px 6px', borderBottom: '2px solid #e8e8e8',
                            position: 'sticky', top: 0, background: '#fafafa', zIndex: 1,
                            verticalAlign: 'bottom', textAlign: 'center',
                          }}>
                            <span style={{
                              display: 'inline-block',
                              writingMode: 'vertical-rl',
                              transform: 'rotate(180deg)',
                              color: t.style?.color ?? '#333',
                              fontSize: 11,
                              maxHeight: 80,
                              overflow: 'hidden',
                            }}>
                              {t.name}
                            </span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {docData.rs.map((row, i) => (
                        <tr key={i} style={{ background: i === 0 ? '#f5f5f5' : undefined }}>
                          <td style={{ padding: '3px 8px', borderBottom: '1px solid #f0f0f0', whiteSpace: 'nowrap', fontWeight: i === 0 ? 600 : undefined }}>
                            {row.file_name as string}
                          </td>
                          <td style={{ padding: '3px 6px', borderBottom: '1px solid #f0f0f0', textAlign: 'center' }}>
                            {row._total_tags as number}
                          </td>
                          {allTags.map(t => {
                            const v = row[t.name] as number
                            const bg = i === 0 ? undefined : val2bgcolor(v, docData.stat.max_by_ann_tag)
                            const fc = i === 0 ? undefined : val2ftcolor(v, docData.stat.max_by_ann_tag)
                            return (
                              <td key={t.name} style={{
                                padding: '3px 6px', borderBottom: '1px solid #f0f0f0',
                                textAlign: 'center', backgroundColor: bg, color: fc,
                                cursor: i > 0 ? 'pointer' : undefined,
                              }}
                                onClick={i > 0 ? (e) => handleCellClick(e, row.file_name as string, t.name) : undefined}
                                title={i > 0 ? `Click to view ${t.name} tags in ${row.file_name}` : undefined}
                              >
                                {v}
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* Token Summary */}
            <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: 4, display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
              <div style={{ padding: '8px 12px', borderBottom: '1px solid #e8e8e8', fontWeight: 600, fontSize: 13, flexShrink: 0 }}>
                Token Summary
              </div>
              <div style={{ padding: 8, overflowY: 'auto', flex: 1 }}>
                <TokenSummary
                  dtd={dtd!}
                  hintDict={hintDict}
                  maxByTag={docData?.stat.max_by_tag ?? 1}
                  showTokenText={showTokenText}
                  minTokens={minTokens}
                />
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Cell popup */}
      {cellPopup && dtd && (
        <CellPopup
          popup={cellPopup}
          dtd={dtd}
          onClose={() => setCellPopup(null)}
        />
      )}
    </div>
  )
}
