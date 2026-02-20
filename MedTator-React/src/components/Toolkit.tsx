/**
 * Toolkit Tab — port of app_hotpot_ext_toolkit.js
 *
 * MedTaggerVis: Visualize MedTagger output (.ann files) alongside raw text (.txt files)
 * - Drag-drop .txt and .ann files
 * - Click .ann file → match with .txt → render highlighted visualization
 * - Show/hide Certainty and Status attributes
 */
import { useRef, useState } from 'react'
import { Switch, message } from 'antd'
import {
  ClearOutlined,
  QuestionCircleOutlined,
  FileTextOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons'
import { readFileAsText } from '../utils/file-helper'
import { parseMedTaggerAnn, medtagger2brat, type MedTaggerRecord } from '../parsers/brat-parser'

// ── Ribbon helpers ──

function RibbonBtn({ icon, label, onClick, title }: {
  icon: React.ReactNode; label: React.ReactNode; onClick?: () => void; title?: string
}) {
  return (
    <button title={title} onClick={onClick}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
        minWidth: 56, height: 52, padding: '4px 10px',
        border: '1px solid transparent', borderRadius: 3,
        background: 'transparent', cursor: 'pointer',
        color: '#333', fontSize: 11, lineHeight: 1.2, transition: 'background 0.15s',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = '#e6f0ff' }}
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

// ── File dropzone ──

interface TextFile { fn: string; text: string }

function FileDropzone({ accept, files, loading, onFiles, label }: {
  accept: string; files: TextFile[]; loading: boolean
  onFiles: (files: FileList | File[]) => void; label: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ fontWeight: 600, fontSize: 13, padding: '6px 0', display: 'flex', alignItems: 'center', gap: 4 }}>
        <UnorderedListOutlined /> {label}
      </div>
      <div style={{ fontSize: 11, color: '#666', marginBottom: 4 }}>
        Drag and drop the <b>{accept}</b> files or the folder in the following box
      </div>
      <div
        style={{
          flex: 1, border: '1px solid #d9d9d9', borderRadius: 4, background: '#fafafa',
          overflow: 'auto', minHeight: 200, cursor: 'pointer',
        }}
        onClick={() => inputRef.current?.click()}
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); onFiles(e.dataTransfer.files) }}
      >
        <input ref={inputRef} type="file" multiple accept={accept}
          style={{ display: 'none' }}
          onChange={e => { if (e.target.files) onFiles(e.target.files); e.target.value = '' }} />
        {loading ? (
          <div style={{ padding: 16, color: '#999', textAlign: 'center' }}>Loading files...</div>
        ) : files.length === 0 ? (
          <div style={{ padding: 16, color: '#999', textAlign: 'center' }}>{accept} files / folder</div>
        ) : (
          <div style={{ padding: 4 }}>
            {files.map((f, i) => (
              <div key={i} style={{
                padding: '3px 6px', fontSize: 11, cursor: 'pointer', borderRadius: 2,
              }}
                onMouseEnter={e => { e.currentTarget.style.background = '#e6f7ff' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
              >
                <FileTextOutlined style={{ marginRight: 4 }} />{f.fn}
              </div>
            ))}
          </div>
        )}
      </div>
      <div style={{ fontSize: 10, color: '#888', marginTop: 2, textAlign: 'center' }}>
        {files.length > 0 ? `${files.length} file(s)` : ''}
      </div>
    </div>
  )
}

// ── Visualization panel: renders highlighted text with entity spans ──

function VisualizationPanel({ text, records, settings }: {
  text: string | null; records: MedTaggerRecord[]; settings: { certainty: boolean; status: boolean }
}) {
  if (!text) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999', padding: 16 }}>
        <FileTextOutlined style={{ fontSize: 24, marginRight: 8 }} />
        Click an .ann file to view visualization
      </div>
    )
  }

  const brat = medtagger2brat(text, records, settings)
  const entities = brat.doc_data.entities
  const entityTypes: Record<string, { bgColor: string }> = {}
  for (const et of brat.col_data.entity_types) {
    entityTypes[et.type] = { bgColor: et.bgColor }
  }

  // Build attribute map: entityId → { Certainty: ..., Status: ... }
  const attrMap: Record<string, Record<string, string>> = {}
  if (brat.doc_data.attributes) {
    for (const attr of brat.doc_data.attributes) {
      const [, attrType, entityId, value] = attr
      if (!attrMap[entityId]) attrMap[entityId] = {}
      attrMap[entityId][attrType] = value
    }
  }

  // Sort entities by start position
  const sorted = [...entities].sort((a, b) => a[2][0][0] - b[2][0][0])

  // Build segments
  const segments: { text: string; entityId?: string; type?: string; bgColor?: string }[] = []
  let pos = 0
  for (const ent of sorted) {
    const [entityId, type, locs] = ent
    const start = locs[0][0]
    const end = locs[0][1]
    if (start > pos) segments.push({ text: text.substring(pos, start) })
    segments.push({
      text: text.substring(start, end),
      entityId, type,
      bgColor: entityTypes[type]?.bgColor || '#ddd',
    })
    pos = end
  }
  if (pos < text.length) segments.push({ text: text.substring(pos) })

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ fontWeight: 600, fontSize: 13, padding: '6px 0', display: 'flex', alignItems: 'center', gap: 4 }}>
        <FileTextOutlined /> Visualization of Document and Tags
      </div>
      <div style={{
        flex: 1, overflow: 'auto', border: '1px solid #d9d9d9', borderRadius: 4,
        padding: 12, background: '#fff', fontSize: 13, lineHeight: 2.2, whiteSpace: 'pre-wrap',
      }}>
        {segments.map((seg, i) => {
          if (!seg.type) return <span key={i}>{seg.text}</span>
          const attrs = attrMap[seg.entityId!] || {}
          const certaintyGlyph = settings.certainty && attrs.Certainty
            ? { Positive: '\u2795', Negated: '\u2796', Hypothetical: '\u2753', Possible: '%' }[attrs.Certainty] || ''
            : ''
          const statusGlyph = settings.status && attrs.Status
            ? { Present: 'P', HistoryOf: 'H' }[attrs.Status] || ''
            : ''
          const glyphs = [certaintyGlyph, statusGlyph].filter(Boolean).join('')
          return (
            <span key={i} title={`${seg.type}${attrs.Certainty ? ' [' + attrs.Certainty + ']' : ''}${attrs.Status ? ' [' + attrs.Status + ']' : ''}`}
              style={{
                background: seg.bgColor, borderRadius: 3, padding: '2px 1px',
                borderBottom: '2px solid rgba(0,0,0,0.2)', cursor: 'default',
              }}>
              {seg.text}
              <span style={{
                fontSize: 9, fontWeight: 600, background: 'rgba(0,0,0,0.15)',
                borderRadius: 2, padding: '0 2px', marginLeft: 1, verticalAlign: 'super',
              }}>
                {seg.type}{glyphs ? ' ' + glyphs : ''}
              </span>
            </span>
          )
        })}
      </div>
    </div>
  )
}

// ── Main component ──

export default function Toolkit() {
  const [txtFiles, setTxtFiles] = useState<TextFile[]>([])
  const [annFiles, setAnnFiles] = useState<TextFile[]>([])
  const [loadingTxt, setLoadingTxt] = useState(false)
  const [loadingAnn, setLoadingAnn] = useState(false)
  const [showCertainty, setShowCertainty] = useState(true)
  const [showStatus, setShowStatus] = useState(true)
  const [visText, setVisText] = useState<string | null>(null)
  const [visRecords, setVisRecords] = useState<MedTaggerRecord[]>([])

  const handleTxtFiles = async (rawFiles: FileList | File[]) => {
    setLoadingTxt(true)
    const arr = Array.from(rawFiles)
    const loaded: TextFile[] = []
    for (const f of arr) {
      if (!f.name.match(/\.txt$/i)) continue
      try { loaded.push({ fn: f.name, text: await readFileAsText(f) }) } catch { /* skip */ }
    }
    if (loaded.length > 0) setTxtFiles(prev => [...prev, ...loaded])
    setLoadingTxt(false)
  }

  const handleAnnFiles = async (rawFiles: FileList | File[]) => {
    setLoadingAnn(true)
    const arr = Array.from(rawFiles)
    const loaded: TextFile[] = []
    for (const f of arr) {
      if (!f.name.match(/\.ann$/i)) continue
      try { loaded.push({ fn: f.name, text: await readFileAsText(f) }) } catch { /* skip */ }
    }
    if (loaded.length > 0) setAnnFiles(prev => [...prev, ...loaded])
    setLoadingAnn(false)
  }

  const clearAll = () => {
    setTxtFiles([])
    setAnnFiles([])
    setVisText(null)
    setVisRecords([])
  }

  const onClickAnnFile = (annFile: TextFile) => {
    // Find matching .txt file: "doc.txt.ann" → "doc.txt"
    const txtFn = annFile.fn.replace(/\.ann$/i, '')
    const matched = txtFiles.find(f => f.fn === txtFn)
    if (!matched) {
      message.warning(`No matching .txt file found for "${annFile.fn}". Expected "${txtFn}".`)
      return
    }
    const records = parseMedTaggerAnn(annFile.text)
    setVisText(matched.text)
    setVisRecords(records)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* ── Ribbon ── */}
      <div style={{
        display: 'flex', alignItems: 'stretch',
        borderBottom: '1px solid #ccc', background: '#fafafa',
        minHeight: 70, fontSize: 12, flexWrap: 'wrap', flexShrink: 0,
      }}>
        <TG label="Tools">
          <button style={{
            padding: '4px 10px', border: '1px solid #1890ff', borderRadius: 3,
            background: '#e6f7ff', color: '#1890ff', fontWeight: 600, fontSize: 11, cursor: 'default',
          }}>
            <FileTextOutlined style={{ marginRight: 4 }} />MedTaggerVis
          </button>
        </TG>

        <TG label="">
          <RibbonBtn icon={<ClearOutlined />} label="Clear All Files" onClick={clearAll}
            title="Clear all loaded files and visualization" />
        </TG>

        <TG label="MedTaggerVis">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '0 4px', justifyContent: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
              <Switch size="small" checked={showCertainty} onChange={setShowCertainty} />
              <span>Show Certainty</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
              <Switch size="small" checked={showStatus} onChange={setShowStatus} />
              <span>Show Status</span>
            </div>
          </div>
        </TG>

        <TG label="Help">
          <RibbonBtn icon={<QuestionCircleOutlined />} label="How to use"
            onClick={() => window.open('https://github.com/OHNLP/MedTator/wiki', '_blank')} />
        </TG>
      </div>

      {/* ── Body: 3-column layout ── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', padding: 8, gap: 12 }}>

        {/* Left: .txt files */}
        <div style={{ width: 250, flexShrink: 0 }}>
          <FileDropzone accept=".txt" files={txtFiles} loading={loadingTxt}
            onFiles={handleTxtFiles} label="Raw .txt Files" />
        </div>

        {/* Center: .ann files (clickable) */}
        <div style={{ width: 250, flexShrink: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 13, padding: '6px 0', display: 'flex', alignItems: 'center', gap: 4 }}>
            <UnorderedListOutlined /> Output .ann Files
          </div>
          <div style={{ fontSize: 11, color: '#666', marginBottom: 4 }}>
            Drag and drop the <b>.ann</b> files or the folder in the following box
          </div>
          <div
            style={{
              flex: 1, border: '1px solid #d9d9d9', borderRadius: 4, background: '#fafafa',
              overflow: 'auto', minHeight: 200, cursor: 'pointer',
            }}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); handleAnnFiles(e.dataTransfer.files) }}
            onClick={() => {
              const input = document.createElement('input')
              input.type = 'file'; input.multiple = true; input.accept = '.ann'
              input.onchange = () => { if (input.files) handleAnnFiles(input.files) }
              input.click()
            }}
          >
            {loadingAnn ? (
              <div style={{ padding: 16, color: '#999', textAlign: 'center' }}>Loading files...</div>
            ) : annFiles.length === 0 ? (
              <div style={{ padding: 16, color: '#999', textAlign: 'center' }}>.ann files / folder</div>
            ) : (
              <div style={{ padding: 4 }}>
                {annFiles.map((f, i) => (
                  <div key={i} style={{
                    padding: '3px 6px', fontSize: 11, cursor: 'pointer', borderRadius: 2,
                  }}
                    onClick={e => { e.stopPropagation(); onClickAnnFile(f) }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#e6f7ff' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                  >
                    <FileTextOutlined style={{ marginRight: 4 }} />{f.fn}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div style={{ fontSize: 10, color: '#888', marginTop: 2, textAlign: 'center' }}>
            {annFiles.length > 0 ? `${annFiles.length} file(s)` : ''}
          </div>
        </div>

        {/* Right: Visualization */}
        <VisualizationPanel text={visText} records={visRecords}
          settings={{ certainty: showCertainty, status: showStatus }} />
      </div>
    </div>
  )
}
