import { useState, useRef, useMemo, useEffect } from 'react'
import { Radio, Button, Switch, Select, Input, Divider, Modal, Spin, message, Tooltip } from 'antd'
import {
  SearchOutlined,
  ClearOutlined,
  FolderOpenOutlined,
  SaveOutlined,
  PlusOutlined,
  TagOutlined,
  LinkOutlined,
  LeftOutlined,
  RightOutlined,
  CheckOutlined,
  StopOutlined,
  EditOutlined,
  ToolOutlined,
  InfoCircleOutlined,
  DeleteOutlined,
  MinusCircleOutlined,
  AppstoreOutlined,
  RobotOutlined,
  SettingOutlined,
  ApiOutlined,
  CloudOutlined,
} from '@ant-design/icons'
import { openSearchPanel } from '@codemirror/search'
import { useAppStore } from '../store'
import { readFileAsText, isSchemaFile, isAnnotationFile, downloadTextAsFile } from '../utils/file-helper'
import { parse as parseDtd } from '../parsers/dtd-parser'
import { xml2ann, txt2ann, ann2xml, xml2str, getNextTagId } from '../parsers/ann-parser'
import { assignTagColors } from '../editor/cm-theme'
import { makeEmptyEtagByDef, makeEmptyRtagByDef, APP_SHORTCUTS, assignTagShortcuts } from '../utils/tag-helper'
import { editorViewRef } from './AnnotationEditor'
import AnnotationEditor from './AnnotationEditor'
import AnnotationTable from './AnnotationTable'
import SchemaEditor from './SchemaEditor'
import { checkOllamaStatus, listModels } from '../utils/ollama-client'
import type { OllamaModelInfo } from '../utils/ollama-client'
import type { DtdTag } from '../types'

// ── Save helper (reads store directly, safe to call from event handlers) ──

function saveCurrentXml(): string | null {
  const { anns, annIdx, dtd, setAnnSaved } = useAppStore.getState()
  if (annIdx === null || !dtd) return null
  const ann = anns[annIdx]
  const xmlDoc = ann2xml(ann, dtd)
  const xmlStr = xml2str(xmlDoc)
  const filename = ann._filename || `${dtd.name}.xml`
  downloadTextAsFile(filename, xmlStr)
  setAnnSaved()
  return filename
}

/* ── 工具栏 Ribbon ── */
function ToolbarRibbon() {
  const dtd = useAppStore(state => state.dtd)
  const setDtd = useAppStore(state => state.setDtd)
  const anns = useAppStore(state => state.anns)
  const annIdx = useAppStore(state => state.annIdx)
  const addAnns = useAppStore(state => state.addAnns)
  const startLoading = useAppStore(state => state.startLoading)
  const updateLoading = useAppStore(state => state.updateLoading)
  const finishLoading = useAppStore(state => state.finishLoading)
  const isLoadingAnns = useAppStore(state => state.isLoadingAnns)
  const msgLoadingAnns = useAppStore(state => state.msgLoadingAnns)
  const cm = useAppStore(state => state.cm)
  const setCm = useAppStore(state => state.setCm)

  const ollamaConfig = useAppStore(state => state.ollamaConfig)
  const setOllamaConfig = useAppStore(state => state.setOllamaConfig)
  const isAutoAnnotating = useAppStore(state => state.isAutoAnnotating)

  const openSchemaEditorNew = useAppStore(state => state.openSchemaEditorNew)
  const openSchemaEditorCopy = useAppStore(state => state.openSchemaEditorCopy)

  const [ollamaSettingsOpen, setOllamaSettingsOpen] = useState(false)
  const [ollamaModels, setOllamaModels] = useState<OllamaModelInfo[]>([])
  const [ollamaTestStatus, setOllamaTestStatus] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle')

  const schemaInputRef = useRef<HTMLInputElement>(null)
  const annInputRef = useRef<HTMLInputElement>(null)

  const truncateFilename = (name: string, maxLen = 20) => {
    if (name.length <= maxLen) return name
    const dot = name.lastIndexOf('.')
    const ext = dot > 0 ? name.slice(dot) : ''
    return name.slice(0, maxLen - ext.length) + '...' + ext
  }

  // Handle schema file
  const handleSchemaFile = async (file: File) => {
    if (!isSchemaFile(file.name)) {
      message.error('Please select a .dtd, .json, or .yaml file')
      return
    }

    try {
      const text = await readFileAsText(file)
      const ext = file.name.split('.').pop()?.toLowerCase() || 'dtd'
      const format = ext === 'yml' ? 'yaml' : ext

      const parsed = parseDtd(text, format)
      if (!parsed) {
        message.error('Failed to parse schema file')
        return
      }

      assignTagColors(parsed)
      assignTagShortcuts(parsed)
      setDtd(parsed)
      message.success(`Schema loaded: ${parsed.name}`)
    } catch (error) {
      console.error('Error loading schema:', error)
      message.error('Failed to load schema file')
    }
  }

  // Handle annotation files
  const handleAnnotationFiles = async (files: File[]) => {
    if (!dtd) {
      message.warning('Please load a schema file first')
      return
    }

    const xmlFiles = files.filter(f => isAnnotationFile(f.name))
    if (xmlFiles.length === 0) {
      message.error('No valid annotation files (.xml, .txt) found')
      return
    }

    startLoading(xmlFiles.length)

    const newAnns = []
    let loaded = 0
    let errors = 0

    for (const file of xmlFiles) {
      try {
        const text = await readFileAsText(file)
        const ext = file.name.split('.').pop()?.toLowerCase() || 'xml'

        const ann = ext === 'txt' ? txt2ann(text, dtd) : xml2ann(text, dtd)
        ann._filename = file.name
        newAnns.push(ann)
        loaded++
        updateLoading(loaded, errors, `Loading ${loaded}/${xmlFiles.length} files...`)
      } catch (error) {
        console.error(`Error loading ${file.name}:`, error)
        errors++
        updateLoading(loaded, errors, `Loading ${loaded}/${xmlFiles.length} files... (${errors} errors)`)
      }
    }

    addAnns(newAnns)
    finishLoading()
    // Rebuild hint dictionary from all loaded annotations
    useAppStore.getState().rebuildHintDict()
    message.success(`Loaded ${loaded} files (${errors} errors)`)
  }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'stretch',
      borderBottom: '1px solid #ccc',
      background: '#fafafa',
      minHeight: 70,
      fontSize: 12,
      flexWrap: 'wrap',
    }}>
      {/* Hidden file inputs */}
      <input
        ref={schemaInputRef}
        type="file"
        accept=".dtd,.json,.yaml,.yml"
        style={{ display: 'none' }}
        onChange={e => {
          const file = e.target.files?.[0]
          if (file) handleSchemaFile(file)
          e.target.value = ''
        }}
      />
      <input
        ref={annInputRef}
        type="file"
        accept=".xml,.txt"
        multiple
        style={{ display: 'none' }}
        onChange={e => {
          const files = Array.from(e.target.files || [])
          if (files.length > 0) handleAnnotationFiles(files)
          e.target.value = ''
        }}
      />

      {/* Schema File */}
      <ToolbarGroup label="Schema File (.yaml / .json / .dtd)">
        <div
          style={{
            border: '2px dashed #d9d9d9',
            borderRadius: 4,
            padding: '4px 8px',
            textAlign: 'center',
            cursor: 'pointer',
            color: dtd ? '#52c41a' : '#999',
            fontSize: 11,
            minWidth: 110,
            background: dtd ? '#f6ffed' : 'transparent',
            lineHeight: 1.5,
          }}
          onClick={() => schemaInputRef.current?.click()}
          onDragOver={e => e.preventDefault()}
          onDrop={e => {
            e.preventDefault()
            const file = e.dataTransfer.files[0]
            if (file) handleSchemaFile(file)
          }}
        >
          {dtd ? (
            <>
              <b>{dtd.name}</b><br />
              {dtd.etags.length} Entity / {dtd.rtags.length} Link Tags
            </>
          ) : <>Drop a <b>Schema</b> File Here</>}
        </div>
        <Button
          size="small"
          icon={<ToolOutlined />}
          title="Schema Editor"
          onClick={() => dtd ? openSchemaEditorCopy() : openSchemaEditorNew()}
        />
      </ToolbarGroup>

      {/* Annotation File — dropzone showing current-file status */}
      <ToolbarGroup label="Annotation File (.xml)">
        <div
          style={{
            border: '2px dashed #d9d9d9',
            borderRadius: 4,
            padding: '4px 8px',
            textAlign: 'center',
            cursor: dtd ? 'pointer' : 'default',
            fontSize: 11,
            minWidth: 110,
            minHeight: 42,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: annIdx !== null ? '#f0f5ff' : 'transparent',
            lineHeight: 1.5,
          }}
          onClick={() => dtd && annInputRef.current?.click()}
          onDragOver={e => { if (dtd) e.preventDefault() }}
          onDrop={e => {
            e.preventDefault()
            if (!dtd) return
            const files = Array.from(e.dataTransfer.files)
            if (files.length > 0) handleAnnotationFiles(files)
          }}
        >
          {isLoadingAnns ? (
            <span style={{ color: '#1890ff' }}><Spin size="small" /> {msgLoadingAnns}</span>
          ) : !dtd ? (
            <span style={{ color: '#999' }}>&larr; Load schema file first</span>
          ) : annIdx !== null ? (
            <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', overflow: 'hidden' }}>
              <Tooltip title={anns[annIdx]._filename ?? ''}>
                <b style={{ fontSize: 11 }}>{truncateFilename(anns[annIdx]._filename ?? '')}</b>
              </Tooltip>
              <span style={{ color: '#888' }}>{anns[annIdx].text.length} chars · {anns[annIdx].tags.length} tags</span>
            </span>
          ) : anns.length === 0 ? (
            <span>Drop <b>Annotation</b><br />File(s) Here</span>
          ) : (
            <span style={{ color: '#888' }}>Select file<br />in the list</span>
          )}
        </div>
      </ToolbarGroup>

      {/* Auto-Annotate (LLM) */}
      <ToolbarGroup label="Auto-Annotate (LLM)">
        <Button
          size="small"
          icon={isAutoAnnotating ? <Spin size="small" /> : <RobotOutlined />}
          disabled={!dtd || annIdx === null || isAutoAnnotating}
          onClick={async () => {
            try {
              const count = await useAppStore.getState().autoAnnotate()
              message.success(`Auto-annotated: ${count} new tags added`)
            } catch (err: any) {
              message.error(`Auto-annotate failed: ${err.message}`)
            }
          }}
        >
          {isAutoAnnotating ? 'Annotating...' : 'Annotate'}
        </Button>
        <Button
          size="small"
          icon={<SettingOutlined />}
          onClick={() => {
            setOllamaSettingsOpen(true)
            setOllamaTestStatus('idle')
            listModels(ollamaConfig).then(setOllamaModels).catch(() => {})
          }}
        />
      </ToolbarGroup>

      {/* Ollama Settings Modal */}
      <Modal
        title={<><ApiOutlined /> Ollama Settings</>}
        open={ollamaSettingsOpen}
        onCancel={() => setOllamaSettingsOpen(false)}
        footer={<Button onClick={() => setOllamaSettingsOpen(false)}>Close</Button>}
        width={420}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <div style={{ marginBottom: 4, fontWeight: 500 }}>Ollama URL</div>
            <Input
              value={ollamaConfig.baseUrl}
              onChange={e => setOllamaConfig({ baseUrl: e.target.value })}
              placeholder="http://localhost:11434"
            />
          </div>
          <div>
            <div style={{ marginBottom: 4, fontWeight: 500 }}>Model</div>
            <Select
              style={{ width: '100%' }}
              value={ollamaConfig.model}
              onChange={v => setOllamaConfig({ model: v })}
              options={ollamaModels.map(m => ({
                value: m.name,
                disabled: m.isRemote,
                label: m.isRemote
                  ? <span style={{ color: '#bbb' }}>{m.name} <CloudOutlined style={{ color: '#bbb', marginLeft: 4 }} /></span>
                  : m.name,
              }))}
              showSearch
              placeholder="Select a model"
              notFoundContent={<span style={{ color: '#999' }}>Click "Test Connection" to load models</span>}
            />
          </div>
          <Button
            icon={<ApiOutlined />}
            loading={ollamaTestStatus === 'testing'}
            onClick={async () => {
              setOllamaTestStatus('testing')
              try {
                const ok = await checkOllamaStatus(ollamaConfig)
                if (ok) {
                  setOllamaTestStatus('ok')
                  const models = await listModels(ollamaConfig)
                  setOllamaModels(models)
                  const names = models.map(m => m.name)
                  if (models.length > 0 && !names.includes(ollamaConfig.model)) {
                    setOllamaConfig({ model: names[0] })
                  }
                  message.success(`Connected! ${models.length} model(s) available`)
                } else {
                  setOllamaTestStatus('fail')
                  message.error('Ollama responded but returned an error')
                }
              } catch {
                setOllamaTestStatus('fail')
                message.error('Cannot connect to Ollama. Is it running?')
              }
            }}
          >
            Test Connection
            {ollamaTestStatus === 'ok' && <CheckOutlined style={{ color: '#52c41a', marginLeft: 4 }} />}
            {ollamaTestStatus === 'fail' && <StopOutlined style={{ color: '#f5222d', marginLeft: 4 }} />}
          </Button>
        </div>
      </Modal>

      {/* Save — shown only when a file is open */}
      {annIdx !== null && (
        <ToolbarGroup label="Save">
          <Button
            size="small"
            icon={<SaveOutlined />}
            onClick={() => {
              const fn = saveCurrentXml()
              if (fn) message.success(`Downloaded ${fn}`)
            }}
          >
            Save XML
          </Button>
        </ToolbarGroup>
      )}

      {/* Display Mode */}
      <ToolbarGroup label="Display Mode">
        <Radio.Group size="small" value={cm.displayMode} onChange={e => setCm({ displayMode: e.target.value })}>
          <Radio.Button value="document">Document</Radio.Button>
          <Radio.Button value="sentences">Sentences</Radio.Button>
        </Radio.Group>
        <Button size="small" style={{ marginLeft: 4 }}>Visualize</Button>
      </ToolbarGroup>

      {/* Search */}
      <ToolbarGroup label="Search">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Button size="small" icon={<SearchOutlined />} onClick={() => {
            if (editorViewRef.current) openSearchPanel(editorViewRef.current)
          }}>Search</Button>
          <Button size="small" icon={<ClearOutlined />} onClick={() => {
            if (editorViewRef.current) editorViewRef.current.focus()
          }}>Clear</Button>
        </div>
      </ToolbarGroup>

      {/* Entity Marks */}
      <ToolbarGroup label="Entity Marks">
        <Radio.Group size="small" value={cm.markMode} onChange={e => setCm({ markMode: e.target.value })}>
          <Radio.Button value="node">Color + ID</Radio.Button>
          <Radio.Button value="span">Color Only</Radio.Button>
        </Radio.Group>
      </ToolbarGroup>

      {/* Link Marks */}
      <ToolbarGroup label="Link Marks">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Switch size="small" checked={cm.enabledLinks} onChange={v => setCm({ enabledLinks: v })} /> <span>Show Links</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Switch size="small" checked={cm.enabledLinkName} onChange={v => setCm({ enabledLinkName: v })} /> <span>Show Link Name</span>
          </div>
        </div>
      </ToolbarGroup>

      {/* Hint Marks */}
      <ToolbarGroup label="Hint Marks">
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <Radio.Group size="small" value={cm.enabledHints ? cm.hintMode : 'off'} onChange={e => {
            if (e.target.value === 'off') {
              setCm({ enabledHints: false })
            } else {
              setCm({ enabledHints: true, hintMode: e.target.value })
            }
          }}>
            <Radio.Button value="simple">Simple Hint</Radio.Button>
            <Radio.Button value="off"><StopOutlined /> No Hint</Radio.Button>
          </Radio.Group>
          <Button size="small" icon={<CheckOutlined />} onClick={() => {
            const { hints, acceptAllHints } = useAppStore.getState()
            if (hints.length === 0) {
              message.info('No hints to accept')
              return
            }
            Modal.confirm({
              title: 'Accept All Hints',
              content: `Accept all ${hints.length} hints as annotations?`,
              onOk: () => {
                acceptAllHints()
                message.success(`Accepted ${hints.length} hints`)
              },
            })
          }}>Accept All</Button>
        </div>
      </ToolbarGroup>

      
    </div>
  )
}

function ToolbarGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '6px 10px',
      borderRight: '1px solid #e8e8e8',
      gap: 4,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1 }}>
        {children}
      </div>
      <div style={{ fontSize: 10, color: '#888', whiteSpace: 'nowrap' }}>{label}</div>
    </div>
  )
}

/* ── 文件列表面板 ── */
function FileListPanel() {
  const dtd = useAppStore(state => state.dtd)
  const anns = useAppStore(state => state.anns)
  const annIdx = useAppStore(state => state.annIdx)
  const setAnnIdx = useAppStore(state => state.setAnnIdx)
  const removeAnn = useAppStore(state => state.removeAnn)
  const clearAnns = useAppStore(state => state.clearAnns)
  const sortAnnsBy = useAppStore(state => state.sortAnnsBy)
  const setSortAnnsBy = useAppStore(state => state.setSortAnnsBy)
  const fnPattern = useAppStore(state => state.fnPattern)
  const setFnPattern = useAppStore(state => state.setFnPattern)
  const pgIndex = useAppStore(state => state.pgIndex)
  const setPgIndex = useAppStore(state => state.setPgIndex)
  const pgNumPerPage = useAppStore(state => state.pgNumPerPage)

  // Filtered & sorted anns
  const displayedAnns = useMemo(() => {
    let result = [...anns]

    // Filter by filename pattern
    if (fnPattern) {
      const pattern = fnPattern.toLowerCase()
      result = result.filter(ann => ann._filename?.toLowerCase().includes(pattern))
    }

    // Sort
    if (sortAnnsBy === 'alphabet') {
      result.sort((a, b) => (a._filename || '').localeCompare(b._filename || ''))
    } else if (sortAnnsBy === 'alphabet_r') {
      result.sort((a, b) => (b._filename || '').localeCompare(a._filename || ''))
    }
    // TODO: implement 'tags', 'tags_r', 'label' sorting

    return result
  }, [anns, fnPattern, sortAnnsBy])

  // Pagination
  const totalPages = Math.ceil(displayedAnns.length / pgNumPerPage)
  const currentPageAnns = displayedAnns.slice(pgIndex * pgNumPerPage, (pgIndex + 1) * pgNumPerPage)

  return (
    <div style={{ width: 250, minWidth: 250, display: 'flex', flexDirection: 'column', borderRight: '1px solid #e9e9e9' }}>
      {/* 工具栏 */}
      <div style={{
        height: 30,
        display: 'flex',
        alignItems: 'center',
        padding: '0 4px',
        borderBottom: '1px solid #e9e9e9',
        gap: 4,
        fontSize: 12,
      }}>
        <Select
          size="small"
          value={sortAnnsBy}
          onChange={setSortAnnsBy}
          style={{ width: 70 }}
          options={[
            { value: 'default', label: 'Default' },
            { value: 'alphabet', label: 'Name ↑' },
            { value: 'alphabet_r', label: 'Name ↓' },
            { value: 'tags', label: 'Tags ↑' },
            { value: 'tags_r', label: 'Tags ↓' },
            { value: 'label', label: 'Label' },
          ]}
        />
        <span style={{ color: '#888' }}>Filter:</span>
        <Input
          size="small"
          style={{ flex: 1 }}
          value={fnPattern}
          onChange={e => setFnPattern(e.target.value)}
          allowClear
        />
        <span style={{ color: '#888', whiteSpace: 'nowrap' }}>{displayedAnns.length} files</span>
        <Button
          size="small"
          type="text"
          danger
          icon={<DeleteOutlined />}
          title="Remove all files"
          onClick={() => {
            if (anns.length === 0) return
            clearAnns()
            message.success('Removed all files')
          }}
        >
        </Button>
      </div>

      {/* 文件列表 */}
      <div style={{ flex: 1, overflow: 'auto', padding: 4 }}>
        {!dtd ? (
          <div style={{ color: '#999', fontSize: 12, textAlign: 'center', marginTop: 40 }}>
            <FolderOpenOutlined style={{ fontSize: 24, display: 'block', marginBottom: 8 }} />
            Load schema file first
          </div>
        ) : currentPageAnns.length === 0 ? (
          <div style={{ color: '#999', fontSize: 12, textAlign: 'center', marginTop: 40 }}>
            <FolderOpenOutlined style={{ fontSize: 24, display: 'block', marginBottom: 8 }} />
            {anns.length === 0 ? 'No files loaded' : 'No files match the filter'}
          </div>
        ) : (
          currentPageAnns.map((ann, idx) => {
            const realIdx = pgIndex * pgNumPerPage + idx
            const isSelected = annIdx === realIdx
            return (
              <div
                key={realIdx}
                style={{
                  padding: '4px 8px',
                  cursor: 'pointer',
                  background: isSelected ? '#e6f7ff' : 'transparent',
                  borderRadius: 4,
                  fontSize: 12,
                  marginBottom: 2,
                  border: isSelected ? '1px solid #91d5ff' : '1px solid transparent',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
                onClick={() => setAnnIdx(realIdx)}
              >
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {ann._has_saved === false && <span style={{ color: '#f5222d' }}>* </span>}
                  {ann._filename || `File ${realIdx + 1}`}
                </span>
                <span style={{ color: '#888', fontSize: 11, minWidth: 16, textAlign: 'right' }}>
                  {ann.tags.length}
                </span>
                <MinusCircleOutlined
                  style={{ color: '#999', fontSize: 12 }}
                  onClick={(e) => {
                    e.stopPropagation()
                    removeAnn(realIdx)
                  }}
                />
              </div>
            )
          })
        )}
      </div>

      {/* 分页 */}
      <div style={{
        height: 28,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderTop: '1px solid #e9e9e9',
        gap: 4,
        fontSize: 12,
      }}>
        <Button
          size="small"
          icon={<LeftOutlined />}
          disabled={pgIndex === 0}
          onClick={() => setPgIndex(pgIndex - 1)}
        />
        <span style={{ color: '#888' }}>
          {displayedAnns.length} files (pg {totalPages > 0 ? pgIndex + 1 : 0}/{totalPages})
        </span>
        <Button
          size="small"
          icon={<RightOutlined />}
          disabled={pgIndex >= totalPages - 1}
          onClick={() => setPgIndex(pgIndex + 1)}
        />
      </div>
    </div>
  )
}

/* ── Tag 定义列表 ── */
function TagListPanel() {
  const dtd = useAppStore(state => state.dtd)
  const anns = useAppStore(state => state.anns)
  const annIdx = useAppStore(state => state.annIdx)
  const displayTagName = useAppStore(state => state.displayTagName)
  const setDisplayTagName = useAppStore(state => state.setDisplayTagName)
  const addTag = useAppStore(state => state.addTag)

  const totalTags = (dtd?.etags.length || 0) + (dtd?.rtags.length || 0)

  // Count annotated tags in the current file
  const tagCounts = useMemo(() => {
    if (annIdx === null || !anns[annIdx]) return {} as Record<string, number>
    const counts: Record<string, number> = {}
    for (const tag of anns[annIdx].tags) {
      counts[tag.tag] = (counts[tag.tag] || 0) + 1
    }
    return counts
  }, [anns, annIdx])

  const handleAddEmptyEtag = (tagDef: DtdTag) => {
    const { anns: a, annIdx: i } = useAppStore.getState()
    if (i === null) return
    const tag = makeEmptyEtagByDef(tagDef)
    tag.id = getNextTagId(a[i], tagDef)
    addTag(tag)
  }

  const handleAddEmptyRtag = (tagDef: DtdTag) => {
    const { anns: a, annIdx: i } = useAppStore.getState()
    if (i === null) return
    const tag = makeEmptyRtagByDef(tagDef)
    tag.id = getNextTagId(a[i], tagDef)
    addTag(tag)
  }

  return (
    <div style={{ width: 250, minWidth: 250, display: 'flex', flexDirection: 'column', borderRight: '1px solid #e9e9e9' }}>
      <div style={{
        padding: '4px 8px',
        background: '#fafafa',
        borderBottom: '1px solid #e9e9e9',
        fontSize: 12,
        fontWeight: 'bold',
        display: 'flex',
        alignItems: 'center',
        gap: 4,
      }}>
        <AppstoreOutlined />
        <span
          style={{ cursor: 'pointer', color: displayTagName === '__all__' ? '#1890ff' : '#000' }}
          onClick={() => setDisplayTagName('__all__')}
        >
          All Tags
        </span>
        <span style={{ marginLeft: 'auto', color: '#888' }}>{totalTags}</span>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: 4 }}>
        {!dtd ? (
          <div style={{ color: '#ccc', fontSize: 12, textAlign: 'center', marginTop: 40 }}>
            <TagOutlined style={{ fontSize: 24, display: 'block', marginBottom: 8 }} />
            Load schema first
          </div>
        ) : (
          <>
            {/* Entity Tags */}
            {dtd.etags.length > 0 && (
              <>
                <div style={{ fontSize: 11, fontWeight: 'bold', color: '#888', marginBottom: 4 }}>
                  <TagOutlined /> Entity Tags ({dtd.etags.length})
                </div>
                {dtd.etags.map((tag, i) => (
                  <div
                    key={tag.name}
                    style={{
                      padding: '2px 4px 2px 8px',
                      cursor: 'pointer',
                      fontSize: 12,
                      marginBottom: 2,
                      borderRadius: 4,
                      background: displayTagName === tag.name ? '#e6f7ff' : 'transparent',
                      border: displayTagName === tag.name ? '1px solid #91d5ff' : '1px solid transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                    onClick={() => setDisplayTagName(tag.name)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, overflow: 'hidden' }}>
                      <span style={{
                        display: 'inline-block', width: 12, height: 12,
                        borderRadius: 2, background: tag.style?.color || '#333', flexShrink: 0,
                      }} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tag.name}</span>
                      {tag.shortcut && (
                        <span style={{ fontSize: 10, color: '#aaa', border: '1px solid #ddd', borderRadius: 2, padding: '0 2px', flexShrink: 0 }}>
                          {APP_SHORTCUTS[i]}
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
                      <span style={{ fontSize: 11, color: '#888', minWidth: 14, textAlign: 'right' }}>
                        {annIdx !== null ? (tagCounts[tag.name] || 0) : ''}
                      </span>
                      {tag.is_non_consuming && annIdx !== null && (
                        <Button
                          type="text" size="small" icon={<PlusOutlined />}
                          style={{ padding: '0 2px', height: 16, fontSize: 10 }}
                          title="Add a document-level tag"
                          onClick={e => { e.stopPropagation(); handleAddEmptyEtag(tag) }}
                        />
                      )}
                    </div>
                  </div>
                ))}
              </>
            )}

            {/* Divider */}
            {dtd.etags.length > 0 && dtd.rtags.length > 0 && (
              <Divider style={{ margin: '8px 0' }} />
            )}

            {/* Relation Tags */}
            {dtd.rtags.length > 0 && (
              <>
                <div style={{ fontSize: 11, fontWeight: 'bold', color: '#888', marginBottom: 4 }}>
                  <LinkOutlined /> Relation Tags ({dtd.rtags.length})
                </div>
                {dtd.rtags.map(tag => (
                  <div
                    key={tag.name}
                    style={{
                      padding: '2px 4px 2px 8px',
                      cursor: 'pointer',
                      fontSize: 12,
                      marginBottom: 2,
                      borderRadius: 4,
                      background: displayTagName === tag.name ? '#e6f7ff' : 'transparent',
                      border: displayTagName === tag.name ? '1px solid #91d5ff' : '1px solid transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                    onClick={() => setDisplayTagName(tag.name)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, overflow: 'hidden' }}>
                      <span style={{
                        display: 'inline-block', width: 12, height: 12,
                        borderRadius: 2, background: tag.style?.color || '#666', flexShrink: 0,
                      }} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tag.name}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
                      <span style={{ fontSize: 11, color: '#888', minWidth: 14, textAlign: 'right' }}>
                        {annIdx !== null ? (tagCounts[tag.name] || 0) : ''}
                      </span>
                      {annIdx !== null && (
                        <Button
                          type="text" size="small" icon={<PlusOutlined />}
                          style={{ padding: '0 2px', height: 16, fontSize: 10 }}
                          title="Add an empty link tag"
                          onClick={e => { e.stopPropagation(); handleAddEmptyRtag(tag) }}
                        />
                      )}
                    </div>
                  </div>
                ))}
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}

/* ── 主组件 ── */
export default function Annotation() {
  // Ctrl+S shortcut — download current annotation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        const fn = saveCurrentXml()
        if (fn) message.success(`Downloaded ${fn}`)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* 工具栏 */}
      <ToolbarRibbon />

      {/* 上半区: 文件列表 + 编辑器 (60%) */}
      <div style={{ flex: 6, display: 'flex', minHeight: 0, borderBottom: '5px solid #e9e9e9' }}>
        <FileListPanel />
        <AnnotationEditor />
      </div>

      {/* 下半区: Tag列表 + 标注表格 (40%) */}
      <div style={{ flex: 4, display: 'flex', minHeight: 0 }}>
        <TagListPanel />
        <AnnotationTable />
      </div>

      {/* Schema Editor modal */}
      <SchemaEditor />
    </div>
  )
}
