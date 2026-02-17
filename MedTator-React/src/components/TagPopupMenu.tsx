/**
 * Popup menu shown when clicking on an entity tag mark in the editor
 *
 * Two states based on linking mode:
 * 1. Normal: show relation types + delete option
 * 2. Linking: show remaining IDREF attrs to fill + cancel option
 */
import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Modal, message } from 'antd'
import {
  LinkOutlined,
  DeleteOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons'
import { useAppStore } from '../store'
import { getLinkedRtags } from '../parsers/ann-parser'
import { getIdrefAttrs } from '../utils/tag-helper'

interface TagPopupMenuProps {
  visible: boolean
  x: number
  y: number
  tagId: string | null
  onClose: () => void
}

export default function TagPopupMenu({
  visible,
  x,
  y,
  tagId,
  onClose,
}: TagPopupMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)

  const anns = useAppStore((s) => s.anns)
  const annIdx = useAppStore((s) => s.annIdx)
  const dtd = useAppStore((s) => s.dtd)
  const isLinking = useAppStore((s) => s.isLinking)
  const linkingTagDef = useAppStore((s) => s.linkingTagDef)
  const linkingAtts = useAppStore((s) => s.linkingAtts)
  const startLinking = useAppStore((s) => s.startLinking)
  const setLinking = useAppStore((s) => s.setLinking)
  const cancelLinking = useAppStore((s) => s.cancelLinking)
  const removeTag = useAppStore((s) => s.removeTag)

  const currentAnn = annIdx !== null ? anns[annIdx] : null
  const clickedTag = currentAnn?.tags.find((t) => t.id === tagId)

  // Click outside to close (skip clicks on entity marks — menu will update)
  useEffect(() => {
    if (!visible) return

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        const target = e.target as HTMLElement
        if (target.closest('[data-tag-id]')) return // Another tag clicked — menu will update
        onClose()
      }
    }

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [visible, onClose])

  if (!visible || !tagId || !clickedTag || !dtd) return null

  const adjustedY = Math.min(y, window.innerHeight - 300)

  // Handle delete
  const handleDelete = () => {
    if (!currentAnn) return

    const linkedRtags = getLinkedRtags(tagId, currentAnn)

    if (linkedRtags.length === 0) {
      removeTag(tagId)
      message.success(`Deleted tag ${tagId}`)
    } else {
      Modal.confirm({
        title: 'Confirm Deletion',
        icon: <ExclamationCircleOutlined />,
        content: (
          <pre style={{ fontSize: 12, whiteSpace: 'pre-wrap' }}>
            {`There are ${linkedRtags.length} link tag(s) related to [${tagId}]:\n\n` +
              linkedRtags.map((r) => `  - ${r.id} (${r.tag})`).join('\n') +
              `\n\nDeleting [${tagId}] will also delete the above link tag(s).`}
          </pre>
        ),
        okText: 'Delete All',
        okType: 'danger',
        onOk() {
          linkedRtags.forEach((r) => removeTag(r.id))
          removeTag(tagId)
          message.success(
            `Deleted ${tagId} and ${linkedRtags.length} linked tag(s)`
          )
        },
      })
    }
    onClose()
  }

  const itemStyle: React.CSSProperties = {
    padding: '6px 12px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  }

  const hoverIn = (e: React.MouseEvent) => {
    ;(e.currentTarget as HTMLElement).style.background = '#f5f5f5'
  }
  const hoverOut = (e: React.MouseEvent) => {
    ;(e.currentTarget as HTMLElement).style.background = 'transparent'
  }

  return createPortal(
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        left: x - 10,
        top: adjustedY + 10,
        background: '#fff',
        border: '1px solid #d9d9d9',
        borderRadius: 4,
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        minWidth: 220,
        maxHeight: 400,
        overflow: 'auto',
        zIndex: 9999,
        fontSize: 13,
      }}
    >
      {/* Header: clicked tag info */}
      <div
        style={{
          padding: '6px 12px',
          background: '#fafafa',
          borderBottom: '1px solid #e8e8e8',
          fontWeight: 600,
          color: '#333',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
        onClick={onClose}
      >
        <span
          style={{
            display: 'inline-block',
            width: 14,
            height: 14,
            borderRadius: 2,
            background: dtd.tag_dict[clickedTag.tag]?.style?.color || '#999',
          }}
        />
        <span>{clickedTag.tag}</span>
        <b>{clickedTag.id}</b>
      </div>

      {isLinking && linkingTagDef ? (
        /* ── LINKING MODE: remaining IDREF attrs + cancel ── */
        <>
          {linkingAtts.map((att, idx) => (
            <div
              key={att.name}
              style={{
                ...itemStyle,
                borderBottom:
                  idx < linkingAtts.length - 1
                    ? '1px solid #f0f0f0'
                    : 'none',
              }}
              onMouseEnter={hoverIn}
              onMouseLeave={hoverOut}
              onClick={() => {
                setLinking(idx, tagId)
                onClose()
              }}
            >
              <LinkOutlined
                style={{
                  color:
                    dtd.tag_dict[linkingTagDef.name]?.style?.color || '#1890ff',
                }}
              />
              <b>{linkingTagDef.name}</b>
              <span style={{ color: '#888' }}>- {att.name}</span>
            </div>
          ))}

          <div style={{ borderTop: '1px solid #e8e8e8' }}>
            <div
              style={itemStyle}
              onMouseEnter={(e) => {
                ;(e.currentTarget as HTMLElement).style.background = '#fff2f0'
              }}
              onMouseLeave={hoverOut}
              onClick={() => {
                cancelLinking()
                onClose()
              }}
            >
              <CloseCircleOutlined style={{ color: '#ff4d4f' }} />
              <span>Cancel current linking</span>
            </div>
          </div>
        </>
      ) : (
        /* ── NORMAL MODE: relation types + delete ── */
        <>
          {dtd.rtags.map((rtag, idx) => {
            const firstAttr = getIdrefAttrs(rtag)[0]
            return (
              <div
                key={rtag.name}
                style={{
                  ...itemStyle,
                  borderBottom:
                    idx < dtd.rtags.length - 1
                      ? '1px solid #f0f0f0'
                      : 'none',
                }}
                onMouseEnter={hoverIn}
                onMouseLeave={hoverOut}
                onClick={() => {
                  startLinking(rtag, tagId)
                  onClose()
                }}
              >
                <LinkOutlined
                  style={{ color: rtag.style?.color || '#1890ff' }}
                />
                <b>{rtag.name}</b>
                {firstAttr && (
                  <span style={{ color: '#888' }}>- {firstAttr.name}</span>
                )}
              </div>
            )
          })}

          {dtd.rtags.length === 0 && (
            <div style={{ padding: '6px 12px', color: '#999' }}>
              No relation types defined
            </div>
          )}

          <div style={{ borderTop: '1px solid #e8e8e8' }}>
            <div
              style={itemStyle}
              onMouseEnter={(e) => {
                ;(e.currentTarget as HTMLElement).style.background = '#fff2f0'
              }}
              onMouseLeave={hoverOut}
              onClick={handleDelete}
            >
              <DeleteOutlined style={{ color: '#ff4d4f' }} />
              <span>Delete this tag</span>
            </div>
          </div>
        </>
      )}
    </div>,
    document.body
  )
}
