/**
 * Context menu for annotation editor
 *
 * Two modes:
 * 1. Selection mode: User right-clicks on selected text → show entity tag list
 * 2. Tag mode: User right-clicks on existing tag → show relation types + delete option
 */
import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import type { DtdTag } from '../types'

interface ContextMenuProps {
  visible: boolean
  x: number
  y: number
  tags: DtdTag[]
  onSelect: (tag: DtdTag) => void
  onClose: () => void
}

export default function ContextMenu({ visible, x, y, tags, onSelect, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)

  // Click outside to close
  useEffect(() => {
    if (!visible) return

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [visible, onClose])

  if (!visible) return null

  // Adjust position if menu would overflow viewport
  const adjustedY = Math.min(y, window.innerHeight - 300) // Assume max menu height ~300px

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
        minWidth: 180,
        maxHeight: 400,
        overflow: 'auto',
        zIndex: 9999,
        fontSize: 13,
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '6px 12px',
          background: '#fafafa',
          borderBottom: '1px solid #e8e8e8',
          fontWeight: 600,
          color: '#333',
          cursor: 'pointer',
        }}
        onClick={onClose}
      >
        Entity Tags
      </div>

      {/* Tag list */}
      {tags.map((tag, idx) => (
        <div
          key={tag.name}
          style={{
            padding: '6px 12px',
            cursor: 'pointer',
            borderBottom: idx < tags.length - 1 ? '1px solid #f0f0f0' : 'none',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#f5f5f5'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent'
          }}
          onClick={() => {
            onSelect(tag)
            onClose()
          }}
        >
          {/* Color indicator */}
          <span
            style={{
              display: 'inline-block',
              width: 14,
              height: 14,
              borderRadius: 2,
              background: tag.style?.color || '#999',
              flexShrink: 0,
            }}
          />

          {/* Tag name */}
          <span style={{ flex: 1 }}>{tag.name}</span>

          {/* Shortcut key */}
          {tag.shortcut && (
            <span
              style={{
                fontSize: 11,
                color: '#999',
                fontFamily: 'monospace',
                background: '#f0f0f0',
                padding: '2px 6px',
                borderRadius: 3,
              }}
            >
              {tag.shortcut}
            </span>
          )}
        </div>
      ))}

      {tags.length === 0 && (
        <div style={{ padding: 12, color: '#999', textAlign: 'center' }}>
          No entity tags available
        </div>
      )}
    </div>,
    document.body
  )
}
