import { useRef, useMemo } from 'react'
import { Radio, Button, Switch, Select, Input, Divider, message } from 'antd'
import {
  SearchOutlined,
  ClearOutlined,
  FolderOpenOutlined,
  TagOutlined,
  LinkOutlined,
  LeftOutlined,
  RightOutlined,
  CheckOutlined,
  StopOutlined,
  EditOutlined,
  ToolOutlined,
  InfoCircleOutlined,
  AppstoreOutlined,
} from '@ant-design/icons'
import { useAppStore } from '../store'
import { readFileAsText, isSchemaFile, isAnnotationFile } from '../utils/file-helper'
import { parse as parseDtd } from '../parsers/dtd-parser'
import { xml2ann, txt2ann } from '../parsers/ann-parser'

/* ── 工具栏 Ribbon ── */
function ToolbarRibbon() {
  const dtd = useAppStore(state => state.dtd)
  const setDtd = useAppStore(state => state.setDtd)
  const addAnns = useAppStore(state => state.addAnns)
  const startLoading = useAppStore(state => state.startLoading)
  const updateLoading = useAppStore(state => state.updateLoading)
  const finishLoading = useAppStore(state => state.finishLoading)

  const schemaInputRef = useRef<HTMLInputElement>(null)
  const annInputRef = useRef<HTMLInputElement>(null)

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
            padding: '4px 12px',
            textAlign: 'center',
            cursor: 'pointer',
            color: dtd ? '#52c41a' : '#999',
            fontSize: 12,
            minWidth: 120,
            background: dtd ? '#f6ffed' : 'transparent',
          }}
          onClick={() => schemaInputRef.current?.click()}
          onDragOver={e => e.preventDefault()}
          onDrop={e => {
            e.preventDefault()
            const file = e.dataTransfer.files[0]
            if (file) handleSchemaFile(file)
          }}
        >
          {dtd ? `✓ ${dtd.name}` : <>Drop a <b>Schema</b> File Here</>}
        </div>
      </ToolbarGroup>

      {/* Annotation File */}
      <ToolbarGroup label="Annotation File (.xml)">
        {dtd ? (
          <Button
            size="small"
            icon={<FolderOpenOutlined />}
            onClick={() => annInputRef.current?.click()}
          >
            Load Files
          </Button>
        ) : (
          <div style={{ color: '#999', fontSize: 12 }}>
            &larr; Load schema file first
          </div>
        )}
      </ToolbarGroup>

      {/* Display Mode */}
      <ToolbarGroup label="Display Mode">
        <Radio.Group size="small" defaultValue="document">
          <Radio.Button value="document">Document</Radio.Button>
          <Radio.Button value="sentences">Sentences</Radio.Button>
        </Radio.Group>
        <Button size="small" style={{ marginLeft: 4 }}>Visualize</Button>
      </ToolbarGroup>

      {/* Search */}
      <ToolbarGroup label="Search">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Button size="small" icon={<SearchOutlined />}>Search</Button>
          <Button size="small" icon={<ClearOutlined />}>Clear</Button>
        </div>
      </ToolbarGroup>

      {/* Entity Marks */}
      <ToolbarGroup label="Entity Marks">
        <Radio.Group size="small" defaultValue="color-id">
          <Radio.Button value="color-id">Color + ID</Radio.Button>
          <Radio.Button value="color-only">Color Only</Radio.Button>
        </Radio.Group>
      </ToolbarGroup>

      {/* Link Marks */}
      <ToolbarGroup label="Link Marks">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Switch size="small" defaultChecked /> <span>Show Links</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Switch size="small" defaultChecked /> <span>Show Lines</span>
          </div>
        </div>
      </ToolbarGroup>

      {/* Hint Marks */}
      <ToolbarGroup label="Hint Marks">
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <Radio.Group size="small" defaultValue="no-hint">
            <Radio.Button value="simple-hint">Simple Hint</Radio.Button>
            <Radio.Button value="no-hint"><StopOutlined /> No Hint</Radio.Button>
          </Radio.Group>
          <Button size="small" icon={<CheckOutlined />}>Accept All</Button>
        </div>
      </ToolbarGroup>

      {/* Help */}
      <ToolbarGroup label="Help">
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer' }}>
            <EditOutlined style={{ fontSize: 22 }} />
            <span style={{ fontSize: 10 }}>Sample</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer' }}>
            <ToolOutlined style={{ fontSize: 22 }} />
            <span style={{ fontSize: 10 }}>Schema</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer' }}>
            <InfoCircleOutlined style={{ fontSize: 22 }} />
            <span style={{ fontSize: 10 }}>Wiki</span>
          </div>
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
        <Button size="small" type="text" style={{ fontSize: 11 }} onClick={() => setFnPattern('')}>
          All
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
                }}
                onClick={() => setAnnIdx(realIdx)}
              >
                {ann._filename || `File ${realIdx + 1}`}
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

/* ── 编辑器面板 ── */
function EditorPanel() {
  const anns = useAppStore(state => state.anns)
  const annIdx = useAppStore(state => state.annIdx)

  const currentAnn = annIdx !== null ? anns[annIdx] : null

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'monospace',
      fontSize: 13,
      position: 'relative',
      background: '#fafafa',
    }}>
      {currentAnn ? (
        <textarea
          readOnly
          value={currentAnn.text}
          style={{
            flex: 1,
            padding: 8,
            fontFamily: 'Consolas, Monaco, monospace',
            fontSize: 13,
            border: 'none',
            outline: 'none',
            resize: 'none',
            background: '#fff',
          }}
        />
      ) : (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          color: '#ccc',
          fontSize: 14,
        }}>
          <div style={{ textAlign: 'center' }}>
            <EditOutlined style={{ fontSize: 40, display: 'block', marginBottom: 12 }} />
            {anns.length === 0 ? 'No files loaded' : 'Select a file to view'}
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Tag 定义列表 ── */
function TagListPanel() {
  const dtd = useAppStore(state => state.dtd)
  const displayTagName = useAppStore(state => state.displayTagName)
  const setDisplayTagName = useAppStore(state => state.setDisplayTagName)

  const totalTags = (dtd?.etags.length || 0) + (dtd?.rtags.length || 0)

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
                {dtd.etags.map(tag => (
                  <div
                    key={tag.name}
                    style={{
                      padding: '2px 8px',
                      cursor: 'pointer',
                      fontSize: 12,
                      marginBottom: 2,
                      borderRadius: 4,
                      background: displayTagName === tag.name ? '#e6f7ff' : 'transparent',
                      border: displayTagName === tag.name ? '1px solid #91d5ff' : '1px solid transparent',
                    }}
                    onClick={() => setDisplayTagName(tag.name)}
                  >
                    <span
                      style={{
                        display: 'inline-block',
                        width: 12,
                        height: 12,
                        borderRadius: 2,
                        background: tag.style?.color || '#333',
                        marginRight: 6,
                      }}
                    />
                    {tag.name}
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
                      padding: '2px 8px',
                      cursor: 'pointer',
                      fontSize: 12,
                      marginBottom: 2,
                      borderRadius: 4,
                      background: displayTagName === tag.name ? '#e6f7ff' : 'transparent',
                      border: displayTagName === tag.name ? '1px solid #91d5ff' : '1px solid transparent',
                    }}
                    onClick={() => setDisplayTagName(tag.name)}
                  >
                    <span
                      style={{
                        display: 'inline-block',
                        width: 12,
                        height: 12,
                        borderRadius: 2,
                        background: tag.style?.color || '#666',
                        marginRight: 6,
                      }}
                    />
                    {tag.name}
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

/* ── 标注表格 ── */
function AnnotationTable() {
  const anns = useAppStore(state => state.anns)
  const annIdx = useAppStore(state => state.annIdx)
  const displayTagName = useAppStore(state => state.displayTagName)

  const currentAnn = annIdx !== null ? anns[annIdx] : null

  // Filter tags by displayTagName
  const displayedTags = useMemo(() => {
    if (!currentAnn) return []
    if (displayTagName === '__all__') return currentAnn.tags
    return currentAnn.tags.filter(tag => tag.tag === displayTagName)
  }, [currentAnn, displayTagName])

  return (
    <div style={{ flex: 1, overflow: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ background: '#fafafa', borderBottom: '1px solid #e9e9e9', position: 'sticky', top: 0 }}>
            <th style={{ textAlign: 'left', padding: '4px 8px', width: 100 }}>Tag</th>
            <th style={{ textAlign: 'left', padding: '4px 8px', width: 50 }}>ID</th>
            <th style={{ textAlign: 'left', padding: '4px 8px', width: 100 }}>Spans</th>
            <th style={{ textAlign: 'left', padding: '4px 8px', minWidth: 150 }}>Text</th>
            <th style={{ textAlign: 'left', padding: '4px 8px' }}>Attributes</th>
          </tr>
        </thead>
        <tbody>
          {displayedTags.length === 0 ? (
            <tr>
              <td colSpan={5} style={{ textAlign: 'center', padding: 20, color: '#ccc' }}>
                {currentAnn ? 'No annotations' : 'Select a file to view annotations'}
              </td>
            </tr>
          ) : (
            displayedTags.map((tag, idx) => {
              const spansText = tag.spans || ''
              const tagText = tag.text || ''
              const attrs = Object.entries(tag)
                .filter(([k, v]) => !['tag', 'id', 'spans', 'text', 'type'].includes(k) && v)
                .map(([k, v]) => `${k}=${v}`)
                .join(', ')

              return (
                <tr key={tag.id || idx} style={{ borderBottom: '1px solid #f0f0f0' }}>
                  <td style={{ padding: '4px 8px' }}>{tag.tag}</td>
                  <td style={{ padding: '4px 8px', color: '#888' }}>{tag.id}</td>
                  <td style={{ padding: '4px 8px', fontFamily: 'monospace', fontSize: 11 }}>{spansText}</td>
                  <td style={{ padding: '4px 8px', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {tagText}
                  </td>
                  <td style={{ padding: '4px 8px', color: '#666', fontSize: 11 }}>{attrs}</td>
                </tr>
              )
            })
          )}
        </tbody>
      </table>
    </div>
  )
}

/* ── 主组件 ── */
export default function Annotation() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* 工具栏 */}
      <ToolbarRibbon />

      {/* 上半区: 文件列表 + 编辑器 (60%) */}
      <div style={{ flex: 6, display: 'flex', minHeight: 0, borderBottom: '5px solid #e9e9e9' }}>
        <FileListPanel />
        <EditorPanel />
      </div>

      {/* 下半区: Tag列表 + 标注表格 (40%) */}
      <div style={{ flex: 4, display: 'flex', minHeight: 0 }}>
        <TagListPanel />
        <AnnotationTable />
      </div>
    </div>
  )
}
