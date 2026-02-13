/**
 * Annotation table with inline editing and delete functionality
 *
 * Features:
 * - Inline attribute editing (Select/Input based on vtype)
 * - Delete button with cascade confirmation
 * - Click row to scroll editor and highlight tag
 * - Two-way highlighting (selectedTagId)
 */
import { useRef, useMemo, useEffect } from 'react'
import { Button, Select, Input, Modal, message } from 'antd'
import { DeleteOutlined, ExclamationCircleOutlined } from '@ant-design/icons'
import { useAppStore } from '../store'
import { getLinkedRtags } from '../parsers/ann-parser'
import type { DtdAttr } from '../types'

export default function AnnotationTable() {
  const anns = useAppStore((s) => s.anns)
  const annIdx = useAppStore((s) => s.annIdx)
  const dtd = useAppStore((s) => s.dtd)
  const displayTagName = useAppStore((s) => s.displayTagName)
  const selectedTagId = useAppStore((s) => s.selectedTagId)
  const setSelectedTagId = useAppStore((s) => s.setSelectedTagId)
  const updateTagAttr = useAppStore((s) => s.updateTagAttr)
  const removeTag = useAppStore((s) => s.removeTag)

  const containerRef = useRef<HTMLDivElement>(null)
  const currentAnn = annIdx !== null ? anns[annIdx] : null

  // Filter tags by displayTagName
  const displayedTags = useMemo(() => {
    if (!currentAnn) return []
    if (displayTagName === '__all__') return currentAnn.tags
    return currentAnn.tags.filter((tag) => tag.tag === displayTagName)
  }, [currentAnn, displayTagName])

  // Auto-scroll to bottom when new tag is added
  useEffect(() => {
    if (containerRef.current && displayedTags.length > 0) {
      requestAnimationFrame(() => {
        if (containerRef.current) {
          containerRef.current.scrollTop = containerRef.current.scrollHeight
        }
      })
    }
  }, [displayedTags.length])

  // Handle delete tag
  const handleDelete = (tagId: string) => {
    if (!currentAnn) return

    // Check if there are linked relation tags
    const linkedRtags = getLinkedRtags(tagId, currentAnn)

    if (linkedRtags.length === 0) {
      // No linked tags, delete directly
      removeTag(tagId)
      message.success(`Deleted tag ${tagId}`)
    } else {
      // Show confirmation modal
      const lines: string[] = [
        `There are ${linkedRtags.length} link tag(s) related to [${tagId}]:`,
        '',
      ]
      linkedRtags.forEach((rtag) => {
        lines.push(`  • ${rtag.id} (${rtag.tag})`)
      })
      lines.push('')
      lines.push(`Deleting [${tagId}] will also delete the above link tag(s).`)

      Modal.confirm({
        title: 'Confirm Deletion',
        icon: <ExclamationCircleOutlined />,
        content: (
          <pre style={{ fontSize: 12, whiteSpace: 'pre-wrap' }}>
            {lines.join('\n')}
          </pre>
        ),
        okText: 'Delete All',
        okType: 'danger',
        cancelText: 'Cancel',
        onOk() {
          // Delete linked rtags first
          linkedRtags.forEach((rtag) => {
            removeTag(rtag.id)
          })
          // Then delete the entity tag
          removeTag(tagId)
          message.success(`Deleted tag ${tagId} and ${linkedRtags.length} linked tag(s)`)
        },
      })
    }
  }

  // Handle click row - highlight tag in editor
  const handleRowClick = (tagId: string) => {
    setSelectedTagId(tagId)

    // TODO: Scroll editor to tag position
    // Will need to access EditorView instance from AnnotationEditor
    // For now, just set selectedTagId which triggers highlight
  }

  return (
    <div ref={containerRef} style={{ flex: 1, overflow: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr
            style={{
              background: '#fafafa',
              borderBottom: '1px solid #e9e9e9',
              position: 'sticky',
              top: 0,
            }}
          >
            <th style={{ textAlign: 'left', padding: '4px 8px', width: 90 }}>Tag</th>
            <th style={{ textAlign: 'left', padding: '4px 8px', width: 70 }}>ID</th>
            <th style={{ textAlign: 'left', padding: '4px 8px', width: 90 }}>Spans</th>
            <th style={{ textAlign: 'left', padding: '4px 8px', minWidth: 120 }}>Text</th>
            <th style={{ textAlign: 'left', padding: '4px 8px' }}>Attributes</th>
            <th style={{ textAlign: 'center', padding: '4px 8px', width: 50 }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {displayedTags.length === 0 ? (
            <tr>
              <td colSpan={6} style={{ textAlign: 'center', padding: 20, color: '#ccc' }}>
                {currentAnn ? 'No annotations' : 'Select a file to view annotations'}
              </td>
            </tr>
          ) : (
            displayedTags.map((tag) => {
              const tagDef = dtd?.tag_dict[tag.tag]
              const isSelected = tag.id === selectedTagId

              return (
                <tr
                  key={tag.id}
                  style={{
                    background: isSelected ? '#e6f7ff' : 'transparent',
                    borderBottom: '1px solid #f0f0f0',
                    cursor: 'pointer',
                  }}
                  onClick={() => handleRowClick(tag.id)}
                >
                  <td style={{ padding: '4px 8px' }}>
                    <span
                      className={`mark-tag-${tag.tag}`}
                      style={{
                        padding: '2px 6px',
                        borderRadius: 3,
                        fontSize: 11,
                      }}
                    >
                      {tag.tag}
                    </span>
                  </td>
                  <td style={{ padding: '4px 8px', fontFamily: 'monospace' }}>{tag.id}</td>
                  <td style={{ padding: '4px 8px', fontFamily: 'monospace' }}>
                    {tag.spans || ''}
                  </td>
                  <td
                    style={{
                      padding: '4px 8px',
                      maxWidth: 200,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                    title={tag.text}
                  >
                    {tag.text || ''}
                  </td>
                  <td style={{ padding: '4px 8px' }}>
                    {tagDef && (
                      <AttributeEditor tag={tag} tagDef={tagDef} onChange={updateTagAttr} />
                    )}
                  </td>
                  <td style={{ padding: '4px 8px', textAlign: 'center' }}>
                    <Button
                      type="text"
                      size="small"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDelete(tag.id)
                      }}
                    />
                  </td>
                </tr>
              )
            })
          )}
        </tbody>
      </table>
    </div>
  )
}

/* ── Attribute Editor ── */

interface AttributeEditorProps {
  tag: Record<string, any>
  tagDef: { name: string; attrs?: DtdAttr[] }
  onChange: (tagId: string, attrName: string, value: string) => void
}

function AttributeEditor({ tag, tagDef, onChange }: AttributeEditorProps) {
  const anns = useAppStore((s) => s.anns)
  const annIdx = useAppStore((s) => s.annIdx)
  const currentAnn = annIdx !== null ? anns[annIdx] : null

  if (!tagDef.attrs || tagDef.attrs.length === 0) return null

  // Filter attributes: exclude built-in fields
  const userAttrs = tagDef.attrs.filter(
    (attr) => !['tag', 'id', 'spans', 'text', 'type'].includes(attr.name)
  )

  if (userAttrs.length === 0) return null

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
      {userAttrs.map((attr) => (
        <div
          key={attr.name}
          style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 150 }}
        >
          <span style={{ fontSize: 11, color: '#888' }}>{attr.name}:</span>
          {attr.vtype === 'list' && attr.values ? (
            <Select
              size="small"
              style={{ flex: 1, minWidth: 100 }}
              value={tag[attr.name] || ''}
              onChange={(value) => onChange(tag.id, attr.name, value)}
              onClick={(e) => e.stopPropagation()}
            >
              {attr.values.map((val) => (
                <Select.Option key={val} value={val}>
                  {val}
                </Select.Option>
              ))}
              <Select.Option value="">-- EMPTY --</Select.Option>
            </Select>
          ) : attr.vtype === 'idref' ? (
            <Select
              size="small"
              style={{ flex: 1, minWidth: 100 }}
              value={tag[attr.name] || ''}
              onChange={(value) => onChange(tag.id, attr.name, value)}
              onClick={(e) => e.stopPropagation()}
            >
              {currentAnn?.tags
                .filter((t) => t.type === 'etag' || !t.type)
                .map((t) => (
                  <Select.Option key={t.id} value={t.id}>
                    {t.id} | {t.text}
                  </Select.Option>
                ))}
              <Select.Option value="">-- EMPTY --</Select.Option>
            </Select>
          ) : (
            <Input
              size="small"
              style={{ flex: 1, minWidth: 100 }}
              value={tag[attr.name] || ''}
              onChange={(e) => onChange(tag.id, attr.name, e.target.value)}
              onClick={(e) => e.stopPropagation()}
            />
          )}
        </div>
      ))}
    </div>
  )
}
