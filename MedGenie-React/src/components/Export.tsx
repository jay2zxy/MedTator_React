/**
 * Export Tab — port of app_hotpot_ext_exporter.js + _annotator_mui_ruleset.html
 *
 * Exports annotated corpus to:
 *   - Tag Text TSV (tag/text/count from hint dict)
 *   - Tag & Sentence TSV (sentence-level annotation spans)
 *   - IOB2/BIO ZIP (NER format, 80/10/10 train/dev/test split)
 *   - BioC XML
 *   - spaCy JSONL (phrase patterns)
 */
import { useState } from 'react'
import { message } from 'antd'
import {
  FileTextOutlined,
  FileExcelOutlined,
  FileOutlined,
  CodeOutlined,
  QuestionCircleOutlined,
} from '@ant-design/icons'
import JSZip from 'jszip'
import { useAppStore } from '../store'
import { downloadTextAsFile } from '../utils/file-helper'
import { anns2hintDict } from '../parsers/ann-parser'
import { spans2locs } from '../parsers/ann-parser'
import { anns2xml, xml2str } from '../parsers/bioc-parser'
import { sentTokenize, findLineCh } from '../utils/nlp-toolkit'
import type { Ann, Dtd } from '../types'

// ── Ribbon components (same style as Statistics) ──

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
        fontSize: 11, lineHeight: 1.2,
        transition: 'background 0.15s',
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

// ── Export functions ──

function getBaseName(dtd: Dtd, anns: Ann[]): string {
  return `${dtd.name}-${anns.length}`
}

/** Tag Text TSV — tag/text/count from hint dictionary */
function exportTagTextTsv(anns: Ann[], dtd: Dtd): string {
  const hintDict = anns2hintDict(dtd, anns)
  const rows: string[][] = [['tag', 'text', 'count']]

  for (const tagName in hintDict) {
    const entry = hintDict[tagName]
    for (const text in entry.text_dict) {
      rows.push([tagName, text, String(entry.text_dict[text].count)])
    }
    for (const fn in entry.nc_dict.ann_fn_dict) {
      rows.push([tagName, fn, String(entry.nc_dict.ann_fn_dict[fn])])
    }
  }

  return rows.map(r => r.join('\t')).join('\n')
}

/** Tag & Sentence TSV — concept/text/doc_span/sen_span/document/sentence */
function exportTagSentenceTsv(anns: Ann[]): string {
  const rows: string[][] = [['concept', 'text', 'doc_span', 'sen_span', 'document', 'sentence']]

  for (const ann of anns) {
    const sentences = ann._sentences.length > 0
      ? ann._sentences
      : sentTokenize(ann.text).sentences

    for (const tag of ann.tags) {
      if (!tag.spans) continue
      const locs = spans2locs(tag.spans)

      for (const loc of locs) {
        const [start, end] = loc
        if (start === -1 || end === -1) continue

        const loc0 = findLineCh(start, sentences)
        if (!loc0) continue

        const senStart = loc0.ch
        const senEnd = senStart + (end - start)

        rows.push([
          tag.tag,
          tag.text || '',
          `[${start}, ${end}]`,
          `[${senStart}, ${senEnd}]`,
          ann._filename || '',
          sentences[loc0.line].text,
        ])
      }
    }
  }

  return rows.map(r => r.join('\t')).join('\n')
}

/** BioC XML export */
function exportBioC(anns: Ann[], dtd: Dtd): string {
  const xmlDoc = anns2xml(anns, dtd)
  return xml2str(xmlDoc)
}

/** spaCy JSONL — unique phrase patterns per tag (lowercased) */
function exportSpacyJsonl(anns: Ann[]): string {
  const patterns: Record<string, { textDict: Record<string, number>; list: object[] }> = {}

  for (const ann of anns) {
    for (const tag of ann.tags) {
      if (!patterns[tag.tag]) patterns[tag.tag] = { textDict: {}, list: [] }

      const text = (tag.text || '').trim().toLocaleLowerCase()
      if (!text) continue

      if (patterns[tag.tag].textDict[text]) {
        patterns[tag.tag].textDict[text]++
      } else {
        patterns[tag.tag].textDict[text] = 1
        patterns[tag.tag].list.push({
          label: tag.tag.toLocaleUpperCase(),
          pattern: text,
          id: tag.tag,
        })
      }
    }
  }

  const allPatterns: object[] = []
  for (const tagName in patterns) {
    allPatterns.push(...patterns[tagName].list)
  }

  return allPatterns.map(p => JSON.stringify(p)).join('\n')
}

/** IOB2/BIO ZIP — word-level BIO labels, 80/10/10 train/dev/test split */
async function exportIob2Zip(anns: Ann[], dtd: Dtd, fn: string): Promise<string> {
  type LabeledToken = { token: string; label: string }

  // Tokenize a sentence into word tokens with character offsets
  function tokenizeSent(text: string): { token: string; start: number; end: number }[] {
    const tokens: { token: string; start: number; end: number }[] = []
    const re = /\S+/g
    let m: RegExpExecArray | null
    while ((m = re.exec(text)) !== null) {
      tokens.push({ token: m[0], start: m.index, end: m.index + m[0].length })
    }
    return tokens
  }

  // Assign B-TAG / I-TAG / O to tokens based on character-level spans
  function bioLabels(
    sentText: string,
    tags: { name: string; start: number; end: number }[]
  ): LabeledToken[] {
    return tokenizeSent(sentText).map(tok => {
      for (const tag of tags) {
        if (tok.start >= tag.start && tok.end <= tag.end) {
          const prefix = tok.start === tag.start ? 'B' : 'I'
          return { token: tok.token, label: `${prefix}-${tag.name}` }
        }
      }
      return { token: tok.token, label: 'O' }
    })
  }

  const bioSentences: LabeledToken[][] = []

  for (const ann of anns) {
    const sentences = ann._sentences.length > 0
      ? ann._sentences
      : sentTokenize(ann.text).sentences

    // Build per-sentence entity tag list
    const sentTagsMap = new Map<number, { name: string; start: number; end: number }[]>()

    for (const tag of ann.tags) {
      if (!tag.spans) continue
      const locs = spans2locs(tag.spans)
      for (const [start, end] of locs) {
        if (start === -1 || end === -1) continue
        const loc0 = findLineCh(start, sentences)
        if (!loc0) continue
        const sentStart = loc0.ch
        const sentEnd = sentStart + (end - start)
        if (!sentTagsMap.has(loc0.line)) sentTagsMap.set(loc0.line, [])
        sentTagsMap.get(loc0.line)!.push({ name: tag.tag, start: sentStart, end: sentEnd })
      }
    }

    for (const [sentIdx, tags] of sentTagsMap) {
      const sent = sentences[sentIdx]
      if (!sent) continue
      bioSentences.push(bioLabels(sent.text, tags))
    }
  }

  function bios2text(bios: LabeledToken[][]): string {
    return bios.map(sent => sent.map(t => `${t.token}\t${t.label}`).join('\n')).join('\n\n')
  }

  const n = bioSentences.length
  const trainEnd = Math.floor(n * 0.8)
  const devEnd = Math.floor(n * 0.9)

  const allText = bios2text(bioSentences)
  const trainText = bios2text(bioSentences.slice(0, trainEnd))
  const devText = bios2text(bioSentences.slice(trainEnd, devEnd))
  const testText = bios2text(bioSentences.slice(devEnd))

  const labels = new Set<string>()
  for (const sent of bioSentences) for (const t of sent) labels.add(t.label)
  const labelsText = [...labels].sort().join('\n')

  const folderName = `dataset-${dtd.name}-BIO`
  const zip = new JSZip()
  zip.file(`${folderName}/dataset.tsv`, allText)
  zip.file(`${folderName}/labels.tsv`, labelsText)
  zip.file(`${folderName}/train.tsv`, trainText)
  zip.file(`${folderName}/dev.tsv`, devText)
  zip.file(`${folderName}/test.tsv`, testText)

  const blob = await zip.generateAsync({ type: 'blob' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fn
  a.click()
  URL.revokeObjectURL(url)

  return allText
}

// ── Main component ──

export default function Export() {
  const anns = useAppStore(s => s.anns)
  const dtd = useAppStore(s => s.dtd)

  const [exportText, setExportText] = useState<string | null>(null)

  const ready = dtd != null && anns.length > 0

  const run = async (fn: () => Promise<string> | string) => {
    try {
      const text = await fn()
      setExportText(text)
    } catch (err) {
      console.error(err)
      message.error('Export failed')
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* ── Ribbon ── */}
      <div style={{
        display: 'flex', alignItems: 'stretch',
        borderBottom: '1px solid #ccc', background: '#fafafa',
        minHeight: 70, fontSize: 12, flexWrap: 'wrap', flexShrink: 0,
      }}>
        {/* Summary info */}
        {ready && (
          <TG label="">
            <div style={{ padding: '4px 8px', fontSize: 12, lineHeight: 1.8 }}>
              <div><b>{anns.length}</b> Documents</div>
              <div><b>{anns.reduce((n, a) => n + a.tags.length, 0)}</b> Annotated Tags</div>
            </div>
          </TG>
        )}

        <TG label="Text">
          <RibbonBtn
            icon={<FileExcelOutlined />}
            label="Tag Text"
            disabled={!ready}
            title="Download tag text as TSV (tag/text/count)"
            onClick={() => run(() => {
              const text = exportTagTextTsv(anns, dtd!)
              downloadTextAsFile(`${getBaseName(dtd!, anns)}_text.tsv`, text)
              return text
            })}
          />
          <RibbonBtn
            icon={<FileExcelOutlined />}
            label={<>Tag &amp;<br/>Sentence</>  as any}
            disabled={!ready}
            title="Download tag & sentence spans as TSV"
            onClick={() => run(() => {
              const text = exportTagSentenceTsv(anns)
              downloadTextAsFile(`${getBaseName(dtd!, anns)}_text_sentence.tsv`, text)
              return text
            })}
          />
        </TG>

        <TG label="Dataset">
          <RibbonBtn
            icon={<FileOutlined />}
            label="IOB2/BIO (.zip)"
            disabled={!ready}
            title="Download NER dataset in BIO format (train/dev/test split)"
            onClick={() => run(() =>
              exportIob2Zip(anns, dtd!, `dataset-${getBaseName(dtd!, anns)}-BIO.zip`)
            )}
          />
          <RibbonBtn
            icon={<FileTextOutlined />}
            label="BioC (.xml)"
            disabled={!ready}
            title="Download corpus in BioC XML format"
            onClick={() => run(() => {
              const text = exportBioC(anns, dtd!)
              downloadTextAsFile(`dataset-${getBaseName(dtd!, anns)}-BioC.xml`, text)
              return text
            })}
          />
        </TG>

        <TG label="Ruleset">
          <RibbonBtn
            icon={<CodeOutlined />}
            label="spaCy (.jsonl)"
            disabled={!ready}
            title="Download phrase patterns in spaCy JSONL format"
            onClick={() => run(() => {
              const text = exportSpacyJsonl(anns)
              downloadTextAsFile(`ruleset-spacy-${getBaseName(dtd!, anns)}.jsonl`, text)
              return text
            })}
          />
        </TG>

        <TG label="Help">
          <RibbonBtn
            icon={<QuestionCircleOutlined />}
            label="How to use"
            onClick={() => window.open('https://github.com/OHNLP/MedTator/wiki', '_blank')}
          />
        </TG>
      </div>

      {/* ── Body: Export Preview ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 8 }}>
        <div style={{
          background: '#fff', border: '1px solid #e8e8e8', borderRadius: 4,
          display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden',
        }}>
          <div style={{
            padding: '8px 12px', borderBottom: '1px solid #e8e8e8',
            fontWeight: 600, fontSize: 13, flexShrink: 0,
          }}>
            Export Preview
          </div>
          <div style={{ flex: 1, overflow: 'hidden', padding: 4 }}>
            {exportText != null ? (
              <textarea
                readOnly
                value={exportText}
                style={{
                  width: '100%', height: '100%', resize: 'none',
                  fontFamily: "'Courier New', Courier, monospace",
                  fontSize: 12, border: 'none', outline: 'none',
                  padding: '4px', boxSizing: 'border-box',
                }}
              />
            ) : (
              <div style={{ padding: 32, color: '#999', textAlign: 'center' }}>
                {ready
                  ? 'Click an export button to preview the output here.'
                  : 'Load a schema and annotation files to export.'}
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  )
}
