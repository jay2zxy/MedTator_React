/**
 * Converter Tab — port of app_hotpot_ext_converter.js + _annotator_mui_corpus.html
 *
 * Converts external formats to MedTator XML:
 *   - Raw Text (.txt) → empty MedTator XML (txt2ann)
 *   - MedTagger (.txt + .ann pairs) → MedTator XML
 *
 * Results can be downloaded individually or as a ZIP.
 */
import { useRef, useState } from 'react'
import { Radio, message } from 'antd'
import {
  ClearOutlined,
  ExperimentOutlined,
  DownloadOutlined,
  QuestionCircleOutlined,
  FileTextOutlined,
  FileZipOutlined,
} from '@ant-design/icons'
import JSZip from 'jszip'
import { useAppStore } from '../store'
import { readFileAsText } from '../utils/file-helper'
import { txt2ann, ann2xml, xml2str, getNextTagId } from '../parsers/ann-parser'
import type { Ann, Dtd } from '../types'

// ── Ribbon components ──

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
        minWidth: 56, height: 52, padding: '4px 10px',
        border: '1px solid transparent', borderRadius: 3,
        background: 'transparent', cursor: disabled ? 'default' : 'pointer',
        color: disabled ? '#bbb' : '#333',
        fontSize: 11, lineHeight: 1.2, transition: 'background 0.15s',
      }}
      onMouseEnter={e => { if (!disabled) (e.currentTarget as HTMLButtonElement).style.background = '#e6f0ff' }}
      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>
        {children}
      </div>
      <div style={{ fontSize: 10, color: '#888', whiteSpace: 'nowrap' }}>{label}</div>
    </div>
  )
}

// ── Dropzone panel ──

function DropZone({
  title, hint, files, accept, onFiles,
}: {
  title: string
  hint: string
  files: { fn: string; text: string }[]
  accept: string
  onFiles: (files: { fn: string; text: string }[]) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFiles = async (rawFiles: FileList | File[]) => {
    const arr = Array.from(rawFiles)
    const loaded: { fn: string; text: string }[] = []
    for (const f of arr) {
      try {
        const text = await readFileAsText(f)
        loaded.push({ fn: f.name, text })
      } catch { /* skip */ }
    }
    if (loaded.length > 0) onFiles(loaded)
  }

  return (
    <div
      style={{
        border: '2px dashed #d9d9d9', borderRadius: 4, padding: 12,
        minWidth: 180, minHeight: 100, cursor: 'pointer',
        background: files.length > 0 ? '#f6ffed' : '#fafafa',
        flex: 1,
      }}
      onClick={() => inputRef.current?.click()}
      onDragOver={e => e.preventDefault()}
      onDrop={e => { e.preventDefault(); handleFiles(e.dataTransfer.files) }}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={accept}
        style={{ display: 'none' }}
        onChange={e => { if (e.target.files) handleFiles(e.target.files); e.target.value = '' }}
      />
      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>{title}</div>
      {files.length === 0 ? (
        <div style={{ color: '#999', fontSize: 12 }}>{hint}</div>
      ) : (
        <div>
          <div style={{ color: '#52c41a', fontSize: 12, marginBottom: 4 }}>
            {files.length} file(s) loaded
          </div>
          <div style={{ overflowY: 'auto', maxHeight: 140 }}>
            {files.slice(0, 100).map(f => (
              <div key={f.fn} style={{ fontSize: 11, color: '#555', padding: '1px 0' }}>{f.fn}</div>
            ))}
            {files.length > 100 && (
              <div style={{ fontSize: 11, color: '#999' }}>…and {files.length - 100} more</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── MedTagger .ann parser ──

function parseMedtaggerAnnLine(line: string): Record<string, string> | null {
  if (!line.trim()) return null
  const re = /(\S+)="([^"]+)"/g
  const r: Record<string, string> = {}
  let m: RegExpExecArray | null
  while ((m = re.exec(line)) !== null) r[m[1]] = m[2]
  return Object.keys(r).length > 0 ? r : null
}

function convertMedtaggerToAnn(
  txt: { fn: string; text: string },
  annFile: { fn: string; text: string },
  dtd: Dtd
): Ann {
  const ann: Ann = {
    text: txt.text,
    dtd_name: dtd.name,
    tags: [],
    meta: {},
    _fh: null,
    _filename: txt.fn + '.xml',
    _has_saved: true,
    _sentences: [],
    _sentences_text: '',
  }

  for (const line of annFile.text.split('\n')) {
    const kv = parseMedtaggerAnnLine(line)
    if (!kv) continue

    const tag: Record<string, string> = {}
    if (kv.text) tag.text = kv.text
    if (kv.norm) tag.tag = kv.norm
    if (kv.start && kv.end) tag.spans = `${kv.start}~${kv.end}`

    if (!tag.tag || !tag.text || !tag.spans) continue
    const tagDef = dtd.tag_dict[tag.tag]
    if (!tagDef) continue

    tag.id = getNextTagId(ann, tagDef)
    for (const attr of tagDef.attrs) {
      if (!tag[attr.name]) tag[attr.name] = attr.default_value
    }
    ann.tags.push(tag as any)
  }

  return ann
}

// ── Panel wrapper ──

function Panel({ title, children, width, flex }: {
  title: string
  children: React.ReactNode
  width?: number
  flex?: number
}) {
  return (
    <div style={{
      background: '#fff', border: '1px solid #e8e8e8', borderRadius: 4,
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
      width: width ?? undefined, flex: flex ?? undefined, flexShrink: 0,
    }}>
      <div style={{
        padding: '6px 12px', borderBottom: '1px solid #e8e8e8',
        fontWeight: 600, fontSize: 13, flexShrink: 0,
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <FileTextOutlined style={{ fontSize: 14 }} />
        {title}
      </div>
      <div style={{ padding: 10, overflowY: 'auto', flex: 1 }}>
        {children}
      </div>
    </div>
  )
}

// ── Main component ──

type Task = 'raw' | 'medtagger'

export default function Converter() {
  const dtd = useAppStore(s => s.dtd)

  const [task, setTask] = useState<Task>('raw')
  const [rawTxts, setRawTxts] = useState<{ fn: string; text: string }[]>([])
  const [mtTxts, setMtTxts] = useState<{ fn: string; text: string }[]>([])
  const [mtAnns, setMtAnns] = useState<{ fn: string; text: string }[]>([])
  const [results, setResults] = useState<Ann[]>([])

  const clearAll = () => {
    setRawTxts([]); setMtTxts([]); setMtAnns([]); setResults([])
  }

  const convert = () => {
    if (!dtd) { message.warning('Load a schema first in the Annotation tab'); return }

    if (task === 'raw') {
      if (rawTxts.length === 0) { message.warning('.txt files are needed'); return }
      const converted = rawTxts.map(f => {
        const ann = txt2ann(f.text, dtd)
        ann._filename = f.fn.replace(/\.txt$/i, '') + '.xml'
        return ann
      })
      setResults(converted)
      message.success(`Converted ${converted.length} file(s)`)

    } else {
      if (mtTxts.length === 0) { message.warning('.txt files are needed'); return }
      if (mtAnns.length === 0) { message.warning('.ann files are needed'); return }

      const annDict: Record<string, { fn: string; text: string }> = {}
      for (const a of mtAnns) annDict[a.fn] = a

      const converted: Ann[] = []
      let skipped = 0
      for (const txt of mtTxts) {
        const annFn = txt.fn + '.ann'
        if (!annDict[annFn]) { skipped++; continue }
        converted.push(convertMedtaggerToAnn(txt, annDict[annFn], dtd))
      }
      setResults(converted)
      if (skipped > 0) message.warning(`Converted ${converted.length}, skipped ${skipped} (no matching .ann)`)
      else message.success(`Converted ${converted.length} file(s)`)
    }
  }

  const downloadOne = (ann: Ann) => {
    if (!dtd) return
    const xmlStr = xml2str(ann2xml(ann, dtd))
    const blob = new Blob([xmlStr], { type: 'text/xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = ann._filename || 'annotation.xml'
    a.click(); URL.revokeObjectURL(url)
  }

  const downloadAll = async () => {
    if (!dtd || results.length === 0) return
    const zip = new JSZip()
    for (const ann of results) {
      zip.file(ann._filename || 'annotation.xml', xml2str(ann2xml(ann, dtd)))
    }
    const blob = await zip.generateAsync({ type: 'blob' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `${dtd.name}-${task}-converted.zip`
    a.click(); URL.revokeObjectURL(url)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* Ribbon */}
      <div style={{
        display: 'flex', alignItems: 'stretch',
        borderBottom: '1px solid #ccc', background: '#fafafa',
        minHeight: 70, fontSize: 12, flexWrap: 'wrap', flexShrink: 0,
      }}>
        <TG label="">
          <RibbonBtn icon={<ClearOutlined />} label="Clear All" onClick={clearAll}
            title="Clear all loaded files and results" />
        </TG>

        <TG label={`Input Format: ${task}`}>
          <Radio.Group
            size="small" value={task}
            onChange={e => { setTask(e.target.value); setResults([]) }}
            style={{ display: 'flex', flexDirection: 'column', gap: 4, justifyContent: 'center', height: 52 }}
          >
            <Radio value="raw" style={{ fontSize: 11 }}>Raw Text</Radio>
            <Radio value="medtagger" style={{ fontSize: 11 }}>MedTagger</Radio>
          </Radio.Group>
        </TG>

        <TG label="Conversion">
          <RibbonBtn icon={<ExperimentOutlined />} label="Convert Files"
            disabled={!dtd} onClick={convert}
            title="Convert loaded files to MedTator XML" />
        </TG>

        <TG label="Results">
          <RibbonBtn icon={<FileZipOutlined />} label="Download as zip"
            disabled={results.length === 0} onClick={downloadAll}
            title="Download all converted XML files as ZIP" />
        </TG>

        <TG label="Help">
          <RibbonBtn icon={<QuestionCircleOutlined />} label="How to use"
            onClick={() => window.open('https://github.com/OHNLP/MedTator/wiki/Manual#converter-tab', '_blank')} />
        </TG>
      </div>

      {/* Body */}
      <div style={{ flex: 1, display: 'flex', gap: 8, padding: 8, overflow: 'hidden' }}>

        {/* Schema */}
        <Panel title="Annotation Schema" width={180}>
          {!dtd ? (
            <div style={{ color: '#888', fontSize: 12 }}>
              Load the schema in the <b>Annotation</b> tab first.
            </div>
          ) : (
            <div style={{ fontSize: 12 }}>
              <div style={{ marginBottom: 4 }}>Schema: <b>{dtd.name}</b></div>
              <div style={{ marginBottom: 2 }}><b>{dtd.etags.length}</b> Entity Tags:</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginBottom: 6 }}>
                {dtd.etags.map(t => (
                  <span key={t.name} style={{
                    background: t.style?.color ?? '#999', color: '#fff',
                    padding: '1px 5px', borderRadius: 3, fontSize: 11,
                  }}>{t.name}</span>
                ))}
              </div>
              <div style={{ marginBottom: 2 }}><b>{dtd.rtags.length}</b> Link Tags:</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                {dtd.rtags.map(t => (
                  <span key={t.name} style={{
                    background: t.style?.color ?? '#999', color: '#fff',
                    padding: '1px 5px', borderRadius: 3, fontSize: 11,
                  }}>{t.name}</span>
                ))}
              </div>
            </div>
          )}
        </Panel>

        {/* Input files */}
        <Panel title={task === 'raw' ? 'Raw Text Files' : 'MedTagger Files'} flex={1}>
          {task === 'raw' ? (
            <DropZone
              title="Raw .txt Text Files"
              hint="Drop .txt files here, or click to select"
              files={rawTxts}
              accept=".txt"
              onFiles={f => setRawTxts(prev => [...prev, ...f])}
            />
          ) : (
            <div style={{ display: 'flex', gap: 8, height: '100%' }}>
              <DropZone
                title="Raw .txt Text Files"
                hint="Drop .txt files here"
                files={mtTxts}
                accept=".txt"
                onFiles={f => setMtTxts(prev => [...prev, ...f])}
              />
              <DropZone
                title="MedTagger .ann Files"
                hint="Drop .ann files here"
                files={mtAnns}
                accept=".ann"
                onFiles={f => setMtAnns(prev => [...prev, ...f])}
              />
            </div>
          )}
        </Panel>

        {/* Results */}
        <Panel title="Conversion Results" flex={1}>
          <div style={{
            border: '2px solid #b7eb8f', borderRadius: 4,
            padding: 10, background: '#f6ffed', minHeight: 80,
          }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#52c41a', marginBottom: 6 }}>
              Generated MedTator XML Files
            </div>
            {results.length === 0 ? (
              <div style={{ color: '#999', fontSize: 12 }}>
                Click "Convert Files" to start conversion.
              </div>
            ) : (
              <>
                <div style={{ fontSize: 12, color: '#555', marginBottom: 6 }}>
                  Converted <b>{results.length}</b> file(s).
                </div>
                <div style={{ overflowY: 'auto', maxHeight: 320 }}>
                  {results.slice(0, 100).map(ann => (
                    <div key={ann._filename} style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '2px 0', fontSize: 12, borderBottom: '1px solid #d9f7be',
                    }}>
                      <span title="Download this file" onClick={() => downloadOne(ann)}
                        style={{ cursor: 'pointer', color: '#1890ff' }}>
                        <DownloadOutlined />
                      </span>
                      <span style={{
                        background: '#52c41a', color: '#fff',
                        padding: '0 4px', borderRadius: 3, fontSize: 11,
                        minWidth: 20, textAlign: 'center',
                      }} title={`${ann.tags.length} tags`}>
                        {ann.tags.length}
                      </span>
                      <span style={{ color: '#333' }}>{ann._filename}</span>
                    </div>
                  ))}
                  {results.length > 100 && (
                    <div style={{ fontSize: 11, color: '#999', padding: '4px 0' }}>
                      …and {results.length - 100} more
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </Panel>

      </div>
    </div>
  )
}
