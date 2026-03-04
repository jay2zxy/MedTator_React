/**
 * Floating panel shown during relation linking mode
 *
 * Displays all relation attributes with editable controls:
 * - IDREF: Select dropdown of entity tags
 * - list: Select dropdown of predefined values
 * - text/other: Input field
 *
 * "Done Linking" completes the relation (even with empty IDREFs).
 * "Cancel Linking" discards the in-progress relation.
 */
import { useRef, useState, useCallback } from 'react'
import { Select, Input, Button } from 'antd'
import { CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons'
import { useAppStore } from '../store'

export default function LinkingBanner() {
  const isLinking = useAppStore((s) => s.isLinking)
  const linkingTagDef = useAppStore((s) => s.linkingTagDef)
  const linkingTag = useAppStore((s) => s.linkingTag)
  const updateLinkingAttr = useAppStore((s) => s.updateLinkingAttr)
  const doneLinking = useAppStore((s) => s.doneLinking)
  const cancelLinking = useAppStore((s) => s.cancelLinking)
  const anns = useAppStore((s) => s.anns)
  const annIdx = useAppStore((s) => s.annIdx)
  const dtd = useAppStore((s) => s.dtd)

  // Dragging state
  const [pos, setPos] = useState({ x: 10, y: 10 })
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null)

  const handleDragStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      dragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        origX: pos.x,
        origY: pos.y,
      }

      const handleDragMove = (ev: MouseEvent) => {
        if (!dragRef.current) return
        setPos({
          x: dragRef.current.origX + (ev.clientX - dragRef.current.startX),
          y: dragRef.current.origY + (ev.clientY - dragRef.current.startY),
        })
      }

      const handleDragEnd = () => {
        dragRef.current = null
        document.removeEventListener('mousemove', handleDragMove)
        document.removeEventListener('mouseup', handleDragEnd)
      }

      document.addEventListener('mousemove', handleDragMove)
      document.addEventListener('mouseup', handleDragEnd)
    },
    [pos]
  )

  if (!isLinking || !linkingTagDef || !linkingTag) return null

  const currentAnn = annIdx !== null ? anns[annIdx] : null
  const entityTags =
    currentAnn?.tags.filter((t) => dtd?.tag_dict[t.tag]?.type === 'etag') || []

  return (
    <div
      style={{
        position: 'absolute',
        top: pos.y,
        left: pos.x,
        maxWidth: 320,
        maxHeight: 400,
        overflowX: 'hidden',
        overflowY: 'auto',
        border: '1px solid #aaa',
        background: '#fff',
        boxShadow: '0 0 15px rgba(130,130,130,0.5)',
        zIndex: 999,
        fontSize: 12,
        borderRadius: 4,
      }}
    >
      {/* Draggable header */}
      <div
        style={{
          padding: 8,
          background: '#f5f5f5',
          borderBottom: '1px solid #ddd',
          cursor: 'grab',
          userSelect: 'none',
        }}
        onMouseDown={handleDragStart}
      >
        Creating a Link Tag <b>{linkingTagDef.name}</b>
      </div>

      {/* Action buttons */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          padding: 8,
          borderBottom: '1px solid #eee',
        }}
      >
        <Button
          size="small"
          type="primary"
          icon={<CheckCircleOutlined />}
          onClick={doneLinking}
        >
          Done Linking
        </Button>
        <Button
          size="small"
          danger
          icon={<CloseCircleOutlined />}
          onClick={cancelLinking}
        >
          Cancel
        </Button>
      </div>

      {/* Attribute rows */}
      <div style={{ padding: 8 }}>
        {linkingTagDef.attrs
          .filter((attr) => attr.name !== 'spans')
          .map((attr) => (
            <div
              key={attr.name}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                marginBottom: 4,
              }}
            >
              <span
                style={{
                  minWidth: 80,
                  maxWidth: 120,
                  color: '#666',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
                title={attr.name}
              >
                - {attr.name}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                {attr.vtype === 'idref' ? (
                  <Select
                    size="small"
                    style={{ width: '100%' }}
                    popupMatchSelectWidth={false}
                    value={linkingTag[attr.name] || ''}
                    onChange={(val) => updateLinkingAttr(attr.name, val)}
                  >
                    {entityTags.map((t) => (
                      <Select.Option key={t.id} value={t.id}>
                        {t.id} | {t.tag} - {t.text}
                      </Select.Option>
                    ))}
                    <Select.Option value="">-- EMPTY --</Select.Option>
                  </Select>
                ) : attr.vtype === 'list' && attr.values ? (
                  <Select
                    size="small"
                    style={{ width: '100%' }}
                    value={linkingTag[attr.name] || ''}
                    onChange={(val) => updateLinkingAttr(attr.name, val)}
                  >
                    {attr.values.map((v) => (
                      <Select.Option key={v} value={v}>
                        {v}
                      </Select.Option>
                    ))}
                    <Select.Option value="">-- EMPTY --</Select.Option>
                  </Select>
                ) : (
                  <Input
                    size="small"
                    value={linkingTag[attr.name] || ''}
                    onChange={(e) =>
                      updateLinkingAttr(attr.name, e.target.value)
                    }
                  />
                )}
              </div>
            </div>
          ))}
      </div>
    </div>
  )
}
