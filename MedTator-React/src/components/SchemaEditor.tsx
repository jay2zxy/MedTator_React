import { useState, useRef } from 'react'
import { Modal, Button, Input, Select, message } from 'antd'
import { PlusOutlined, FolderOpenOutlined, TagOutlined, LinkOutlined, DownloadOutlined } from '@ant-design/icons'
import { useAppStore } from '../store'
import {
  parse as parseDtd,
  mkBaseDtd,
  mkBaseTag,
  mkBaseAttr,
  extendBaseDtd,
  stringify as stringifyDtd,
} from '../parsers/dtd-parser'
import { assignTagColors, injectTagColors } from '../editor/cm-theme'
import { assignTagShortcuts } from '../utils/tag-helper'
import { downloadTextAsFile, readFileAsText } from '../utils/file-helper'
import type { Dtd, DtdTag, DtdAttr } from '../types'

import minimalTaskDtd from '../../../sample/MINIMAL_TASK/MINIMAL_TASK.dtd?raw'
import entityRelationDtd from '../../../sample/ENTITY_RELATION_TASK/COVID_VAX_AE.dtd?raw'
import documentLevelDtd from '../../../sample/DOCUMENT_LEVEL_TASK/VAX_SYMPTOM.dtd?raw'
import iaaDtd from '../../../sample/IAA_TASK/VAX_AE_MED.dtd?raw'

const SAMPLES = [
  { value: 'minimal',         label: 'Minimal Task',          raw: minimalTaskDtd },
  { value: 'entity_relation', label: 'Entity-Relation Task',  raw: entityRelationDtd },
  { value: 'document',        label: 'Document-Level Task',   raw: documentLevelDtd },
  { value: 'iaa',             label: 'IAA Task',              raw: iaaDtd },
]

const ETYPE_OPTIONS = [{ value: 'text', label: 'TEXT' }, { value: 'list', label: 'LIST' }]
const RTYPE_OPTIONS = [{ value: 'text', label: 'TEXT' }, { value: 'list', label: 'LIST' }, { value: 'idref', label: 'LINK' }]

function filterNameKey(e: React.KeyboardEvent<HTMLInputElement>) {
  if (e.ctrlKey || e.metaKey) return
  if (e.key.length === 1 && !/[A-Za-z0-9_]/.test(e.key)) e.preventDefault()
}

// Small uppercase label (e.g. "TAG NAME", "TYPE")
function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 9, color: '#aaa', fontWeight: 700, letterSpacing: '0.06em', marginBottom: 2, userSelect: 'none' }}>
      {children}
    </div>
  )
}

// ── Attribute column (horizontal card) ──
interface AttrColProps {
  attr: DtdAttr
  isEtag: boolean
  onUpdate: (patch: Partial<DtdAttr>) => void
  onRemove: () => void
}

function AttrColumn({ attr, isEtag, onUpdate, onRemove }: AttrColProps) {
  const vtypeOptions = isEtag ? ETYPE_OPTIONS : RTYPE_OPTIONS
  const isIdref = attr.vtype === 'idref'
  const isList  = attr.vtype === 'list'

  const handleEditItems = () => {
    const result = window.prompt('Edit list items (pipe-separated):', attr.values.join('|'))
    if (result === null) return
    onUpdate({ values: result.split('|').map(s => s.trim()).filter(Boolean) })
  }

  return (
    <div style={{ minWidth: 165, borderLeft: '1px solid #ebebeb', padding: '6px 10px' }}>
      <FieldLabel>ATTRIBUTE</FieldLabel>

      {/* Name + delete */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
        <Input
          size="small"
          value={attr.name}
          placeholder={isIdref ? 'PREFIX' : 'attr_name'}
          style={{ fontWeight: 600, fontSize: 13, flex: 1, padding: '0 2px' }}
          variant="borderless"
          onKeyDown={filterNameKey}
          onChange={e => onUpdate({ name: e.target.value })}
        />
        <button
          onClick={onRemove}
          style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#999', fontSize: 16, lineHeight: 1, padding: '0 2px' }}
          title="Remove attribute"
        >−</button>
      </div>

      {/* TYPE / DEFAULT / ITEMS */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        <div>
          <FieldLabel>TYPE</FieldLabel>
          <Select
            size="small"
            value={attr.vtype || 'text'}
            style={{ width: 68 }}
            options={vtypeOptions}
            onChange={v => onUpdate({ vtype: v as DtdAttr['vtype'] })}
          />
        </div>
        {!isIdref && !isList && (
          <div>
            <FieldLabel>DEFAULT</FieldLabel>
            <Input
              size="small"
              value={attr.default_value}
              style={{ width: 76 }}
              onChange={e => onUpdate({ default_value: e.target.value })}
            />
          </div>
        )}
        {isList && (
          <div>
            <FieldLabel>DEFAULT</FieldLabel>
            <Select
              size="small"
              value={attr.default_value || undefined}
              style={{ width: 90 }}
              placeholder="—"
              popupMatchSelectWidth={false}
              options={attr.values.map(v => ({ value: v, label: v }))}
              onChange={v => onUpdate({ default_value: v })}
            />
          </div>
        )}
        {isList && (
          <div
            style={{ cursor: 'pointer', maxWidth: 110 }}
            onClick={handleEditItems}
            title="Click to edit list items"
          >
            <FieldLabel>ITEMS ({attr.values.length})</FieldLabel>
            <div style={{
              fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              color: '#444', borderBottom: '1px dashed #ccc',
            }}>
              {attr.values.join('|') || '—'}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Tag row (full-width horizontal) ──
interface TagRowProps {
  tag: DtdTag
  isEtag: boolean
  onUpdate: (patch: Partial<DtdTag>) => void
  onRemove: () => void
  onAddAttr: () => void
  onUpdateAttr: (j: number, patch: Partial<DtdAttr>) => void
  onRemoveAttr: (j: number) => void
}

function TagRow({ tag, isEtag, onUpdate, onRemove, onAddAttr, onUpdateAttr, onRemoveAttr }: TagRowProps) {
  return (
    <div style={{
      display: 'flex', border: '1px solid #e0e0e0', borderRadius: 4,
      marginBottom: 8, background: '#fff', overflow: 'hidden',
    }}>
      {/* Left: tag name + ann.type + +Attr */}
      <div style={{ minWidth: 155, maxWidth: 155, padding: '6px 10px', background: '#f7f7f7', borderRight: '1px solid #e8e8e8' }}>
        <FieldLabel>TAG NAME</FieldLabel>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
          <Input
            size="small"
            value={tag.name}
            style={{ fontWeight: 700, fontSize: 13, flex: 1, padding: '0 2px' }}
            variant="borderless"
            onKeyDown={filterNameKey}
            onChange={e => onUpdate({ name: e.target.value })}
          />
          <button
            onClick={onRemove}
            style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#999', fontSize: 16, lineHeight: 1, padding: '0 2px' }}
            title="Remove tag"
          >−</button>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6 }}>
          {isEtag && (
            <div>
              <FieldLabel>ANN.TYPE</FieldLabel>
              <Select
                size="small"
                value={tag.is_non_consuming ? 'doc' : 'span'}
                style={{ width: 72 }}
                onChange={v => onUpdate({ is_non_consuming: v === 'doc' })}
                options={[{ value: 'span', label: 'SPAN' }, { value: 'doc', label: 'DOC' }]}
              />
            </div>
          )}
          <Button
            type="link" size="small"
            icon={<PlusOutlined />}
            onClick={onAddAttr}
            style={{ padding: 0, fontSize: 12 }}
          >Attr</Button>
        </div>
      </div>

      {/* Right: attribute columns */}
      <div style={{ display: 'flex', flexWrap: 'wrap', flex: 1, alignItems: 'flex-start' }}>
        {tag.attrs.length === 0 && (
          <div style={{ padding: '20px 16px', color: '#ccc', fontSize: 12 }}>No attributes</div>
        )}
        {tag.attrs.map((attr, j) => (
          <AttrColumn
            key={j}
            attr={attr}
            isEtag={isEtag}
            onUpdate={patch => onUpdateAttr(j, patch)}
            onRemove={() => onRemoveAttr(j)}
          />
        ))}
      </div>
    </div>
  )
}

// ── Section header ──
function SectionHeader({ icon, title, count, onAdd }: {
  icon: React.ReactNode; title: string; count: number; onAdd: () => void
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      borderBottom: '2px solid #444', paddingBottom: 5, marginBottom: 10, marginTop: 14,
    }}>
      {icon}
      <b style={{ fontSize: 14 }}>{title} — {count} tag(s)</b>
      <span style={{ color: '#ccc', margin: '0 2px' }}>|</span>
      <Button type="link" size="small" icon={<PlusOutlined />} onClick={onAdd} style={{ padding: 0, fontWeight: 600 }}>
        Tag
      </Button>
    </div>
  )
}

// ── Main component ──
export default function SchemaEditor() {
  const seDtd           = useAppStore(s => s.seDtd)
  const seOpen          = useAppStore(s => s.seOpen)
  const setSeDtd        = useAppStore(s => s.setSeDtd)
  const closeSchemaEditor = useAppStore(s => s.closeSchemaEditor)
  const setDtd          = useAppStore(s => s.setDtd)
  const clearAnns       = useAppStore(s => s.clearAnns)
  const anns            = useAppStore(s => s.anns)

  const [downloadFormat, setDownloadFormat] = useState<'yaml' | 'json' | 'dtd'>('yaml')
  const [selectedSample, setSelectedSample] = useState<string | undefined>(undefined)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const update = (mutator: (dtd: Dtd) => void) => {
    if (!seDtd) return
    const copy: Dtd = JSON.parse(JSON.stringify(seDtd))
    mutator(copy)
    setSeDtd(copy)
  }

  // ── Toolbar handlers ──
  const handleOpenFile = async (file: File) => {
    try {
      const text = await readFileAsText(file)
      const ext = file.name.split('.').pop()?.toLowerCase() || 'dtd'
      const dtd = parseDtd(text, ext === 'yml' ? 'yaml' : ext)
      if (!dtd) { message.error('Failed to parse schema file'); return }
      setSeDtd(dtd)
      message.success(`Loaded: ${dtd.name}`)
    } catch { message.error('Failed to read file') }
  }

  const handleLoadSample = () => {
    const s = SAMPLES.find(s => s.value === selectedSample)
    if (!s) { message.warning('Select a sample first'); return }
    const dtd = parseDtd(s.raw, 'dtd')
    if (!dtd) { message.error('Failed to parse sample'); return }
    setSeDtd(dtd)
    message.success(`Loaded sample: ${dtd.name}`)
  }

  const handleUse = () => {
    if (!seDtd) return
    const doUse = () => {
      const full = extendBaseDtd(seDtd)
      assignTagColors(full)
      assignTagShortcuts(full)
      injectTagColors(full)
      setDtd(full)
      clearAnns()
      closeSchemaEditor()
      message.success(`Schema "${full.name}" applied`)
    }
    if (anns.length > 0) {
      Modal.confirm({
        title: 'Apply Schema',
        content: `This will clear ${anns.length} loaded file(s). Continue?`,
        okText: 'Apply & Clear', okType: 'danger', onOk: doUse,
      })
    } else { doUse() }
  }

  const handleDownload = () => {
    if (!seDtd) return
    downloadTextAsFile(`${seDtd.name}.${downloadFormat}`, stringifyDtd(seDtd, downloadFormat))
  }

  // ── CRUD ──
  const addEtag       = ()                     => update(d => { d.etags.push(mkBaseTag('NEW_TAG', 'etag')) })
  const removeEtag    = (i: number)            => update(d => { d.etags.splice(i, 1) })
  const updateEtag    = (i: number, p: Partial<DtdTag>)  => update(d => { Object.assign(d.etags[i], p) })
  const addEtagAttr   = (i: number)            => update(d => { d.etags[i].attrs.push(mkBaseAttr(d.etags[i].name, 'NEW_ATTR', 'text')) })
  const removeEtagAttr = (i: number, j: number) => update(d => { d.etags[i].attrs.splice(j, 1) })
  const updateEtagAttr = (i: number, j: number, p: Partial<DtdAttr>) => update(d => { Object.assign(d.etags[i].attrs[j], p) })

  const addRtag       = ()                     => update(d => { d.rtags.push(mkBaseTag('NEW_LINK', 'rtag')) })
  const removeRtag    = (i: number)            => update(d => { d.rtags.splice(i, 1) })
  const updateRtag    = (i: number, p: Partial<DtdTag>)  => update(d => { Object.assign(d.rtags[i], p) })
  const addRtagAttr   = (i: number)            => update(d => { d.rtags[i].attrs.push(mkBaseAttr(d.rtags[i].name, 'NEW_ATTR', 'text')) })
  const removeRtagAttr = (i: number, j: number) => update(d => { d.rtags[i].attrs.splice(j, 1) })
  const updateRtagAttr = (i: number, j: number, p: Partial<DtdAttr>) => update(d => { Object.assign(d.rtags[i].attrs[j], p) })

  if (!seOpen || !seDtd) return null

  return (
    <Modal
      title="Schema Editor"
      open={seOpen}
      onCancel={closeSchemaEditor}
      footer={null}
      width={1020}
      zIndex={2000}
      destroyOnClose
      styles={{ body: { padding: '8px 16px', maxHeight: '80vh', overflow: 'auto' } }}
    >
      <input
        ref={fileInputRef} type="file" accept=".dtd,.json,.yaml,.yml"
        style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) handleOpenFile(f); e.target.value = '' }}
      />

      {/* ── Toolbar ── */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, flexWrap: 'wrap', marginBottom: 4, paddingBottom: 10, borderBottom: '1px solid #f0f0f0', position: 'sticky', top: -8, marginTop: -8, paddingTop: 8, background: '#fff', zIndex: 10 }}>
        <div>
          <FieldLabel>SCHEMA NAME</FieldLabel>
          <Input
            value={seDtd.name}
            style={{ width: 190, fontWeight: 700 }}
            onKeyDown={filterNameKey}
            onChange={e => update(d => { d.name = e.target.value })}
          />
        </div>
        <Button onClick={() => setSeDtd(mkBaseDtd('NEW_SCHEMA'))}>New</Button>
        <Button icon={<FolderOpenOutlined />} onClick={() => fileInputRef.current?.click()}>Open</Button>
        <Select
          placeholder="Sample template"
          style={{ width: 175 }}
          value={selectedSample}
          onChange={setSelectedSample}
          options={SAMPLES.map(s => ({ value: s.value, label: s.label }))}
        />
        <Button onClick={handleLoadSample}>Load</Button>
        <Button type="primary" onClick={handleUse}>Use</Button>
        <Button icon={<DownloadOutlined />} onClick={handleDownload}>Download</Button>
        <Select
          value={downloadFormat}
          onChange={setDownloadFormat}
          style={{ width: 78 }}
          options={[
            { value: 'yaml', label: 'YAML' },
            { value: 'json', label: 'JSON' },
            { value: 'dtd',  label: 'DTD'  },
          ]}
        />
      </div>

      {/* ── Entity Tags ── */}
      <SectionHeader icon={<TagOutlined />} title="ENTITY TAGS" count={seDtd.etags.length} onAdd={addEtag} />
      {seDtd.etags.length === 0 && (
        <div style={{ color: '#ccc', textAlign: 'center', padding: '12px 0', fontSize: 12 }}>No entity tags</div>
      )}
      {seDtd.etags.map((tag, i) => (
        <TagRow
          key={i} tag={tag} isEtag
          onUpdate={p => updateEtag(i, p)}
          onRemove={() => removeEtag(i)}
          onAddAttr={() => addEtagAttr(i)}
          onUpdateAttr={(j, p) => updateEtagAttr(i, j, p)}
          onRemoveAttr={j => removeEtagAttr(i, j)}
        />
      ))}

      {/* ── Relation Tags ── */}
      <SectionHeader icon={<LinkOutlined />} title="RELATION TAGS" count={seDtd.rtags.length} onAdd={addRtag} />
      {seDtd.rtags.length === 0 && (
        <div style={{ color: '#ccc', textAlign: 'center', padding: '12px 0', fontSize: 12 }}>No relation tags</div>
      )}
      {seDtd.rtags.map((tag, i) => (
        <TagRow
          key={i} tag={tag} isEtag={false}
          onUpdate={p => updateRtag(i, p)}
          onRemove={() => removeRtag(i)}
          onAddAttr={() => addRtagAttr(i)}
          onUpdateAttr={(j, p) => updateRtagAttr(i, j, p)}
          onRemoveAttr={j => removeRtagAttr(i, j)}
        />
      ))}
    </Modal>
  )
}
