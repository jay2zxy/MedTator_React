/**
 * CodeMirror 6 annotation editor
 *
 * Replaces the placeholder <textarea> in EditorPanel.
 * Displays read-only text with colored entity tag highlights.
 *
 * Interactions:
 * - Right-click on text selection → ContextMenu (entity creation)
 * - Left-click on entity mark → TagPopupMenu (relation linking / delete)
 * - During linking mode → LinkingBanner (floating attribute panel)
 */
import { useRef, useEffect, useState, useCallback } from 'react'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { EditOutlined } from '@ant-design/icons'
import { useAppStore } from '../store'
import { createEditorExtensions } from '../editor/cm-setup'
import { setTagDecorations, setSelectedTag } from '../editor/cm-decorations'
import { injectTagColors } from '../editor/cm-theme'
import { cmRangeToSpans } from '../editor/cm-spans'
import { makeEtag } from '../utils/tag-helper'
import ContextMenu from './ContextMenu'
import TagPopupMenu from './TagPopupMenu'
import LinkingBanner from './LinkingBanner'
import type { DtdTag } from '../types'

export default function AnnotationEditor() {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)

  const anns = useAppStore((s) => s.anns)
  const annIdx = useAppStore((s) => s.annIdx)
  const dtd = useAppStore((s) => s.dtd)
  const displayTagName = useAppStore((s) => s.displayTagName)
  const selectedTagId = useAppStore((s) => s.selectedTagId)
  const addTag = useAppStore((s) => s.addTag)
  const markMode = useAppStore((s) => s.cm.markMode)

  const currentAnn = annIdx !== null && annIdx < anns.length ? anns[annIdx] : null

  // Context menu state (right-click on text selection → entity creation)
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean
    x: number
    y: number
    selection: { from: number; to: number } | null
  }>({
    visible: false,
    x: 0,
    y: 0,
    selection: null,
  })

  // Tag popup menu state (left-click on entity mark → relation/delete)
  const [tagMenu, setTagMenu] = useState<{
    visible: boolean
    x: number
    y: number
    tagId: string | null
  }>({
    visible: false,
    x: 0,
    y: 0,
    tagId: null,
  })

  // Stable callbacks for CM6 event handlers (avoid stale closures)
  const setContextMenuRef = useRef(setContextMenu)
  setContextMenuRef.current = setContextMenu
  const setTagMenuRef = useRef(setTagMenu)
  setTagMenuRef.current = setTagMenu

  // ── Initialize CM6 (once) ──

  useEffect(() => {
    if (!containerRef.current) return

    // Event handlers as extension
    const eventHandlers = EditorView.domEventHandlers({
      contextmenu: (event: MouseEvent, view: EditorView) => {
        event.preventDefault()

        // Get current selection
        const selection = view.state.selection.main

        // Only show entity creation menu if text is selected
        if (selection.from === selection.to) {
          return false
        }

        // Close tag popup if open
        setTagMenuRef.current((prev) =>
          prev.visible ? { ...prev, visible: false } : prev
        )

        setContextMenuRef.current({
          visible: true,
          x: event.clientX,
          y: event.clientY,
          selection: { from: selection.from, to: selection.to },
        })

        return true
      },
      mousedown: (event: MouseEvent) => {
        // Check if clicking on an entity tag mark
        const target = event.target as HTMLElement
        const tagEl = target.closest('[data-tag-id]') as HTMLElement

        if (tagEl) {
          const tagId = tagEl.getAttribute('data-tag-id')!

          // Set selected tag (highlights in editor + table)
          useAppStore.getState().setSelectedTagId(tagId)

          // Close entity creation menu if open
          setContextMenuRef.current((prev) =>
            prev.visible ? { ...prev, visible: false } : prev
          )

          // Show tag popup menu
          setTagMenuRef.current({
            visible: true,
            x: event.clientX,
            y: event.clientY,
            tagId,
          })

          return true
        }

        // Clicking elsewhere — close menus and clear selection
        setTagMenuRef.current((prev) =>
          prev.visible ? { ...prev, visible: false } : prev
        )

        const store = useAppStore.getState()
        if (store.selectedTagId) {
          store.setSelectedTagId(null)
        }

        return false
      },
    })

    const state = EditorState.create({
      doc: '',
      extensions: [...createEditorExtensions(), eventHandlers],
    })

    const view = new EditorView({
      state,
      parent: containerRef.current,
    })

    viewRef.current = view

    return () => {
      view.destroy()
      viewRef.current = null
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Inject tag colors when DTD changes ──

  useEffect(() => {
    if (dtd) injectTagColors(dtd)
  }, [dtd])

  // ── Update document + decorations ──
  //
  // Runs when: file changes (annIdx/anns), tag edits (anns spread),
  // display filter changes, or DTD changes.

  useEffect(() => {
    const view = viewRef.current
    if (!view) return

    const text = currentAnn?.text ?? ''
    const currentText = view.state.doc.toString()
    const docChanged = currentText !== text

    const effects = []

    if (dtd && currentAnn) {
      const docLen = docChanged ? text.length : view.state.doc.length

      effects.push(
        setTagDecorations.of({
          tags: currentAnn.tags,
          dtd,
          displayTagName,
          docLength: docLen,
        }),
      )

      effects.push(
        setSelectedTag.of({
          tagId: selectedTagId,
          tags: currentAnn.tags,
          docLength: docLen,
        }),
      )
    }

    if (docChanged) {
      view.dispatch({
        changes: { from: 0, to: currentText.length, insert: text },
        effects,
      })
    } else if (effects.length > 0) {
      view.dispatch({ effects })
    }
  }, [anns, annIdx, dtd, displayTagName, selectedTagId])

  // ── Handle context menu tag selection (entity creation) ──

  const handleTagSelect = useCallback(
    (tagDef: DtdTag) => {
      if (!contextMenu.selection || !currentAnn || !dtd) return

      const view = viewRef.current
      if (!view) return

      const { from, to } = contextMenu.selection

      // Get selected text
      const text = view.state.doc.sliceString(from, to)

      // Create spans string
      const spans = cmRangeToSpans(from, to)

      // Create full entity tag with auto-generated ID and default attributes
      const tag = makeEtag({ spans, text }, tagDef, currentAnn)

      // Add tag to current annotation
      addTag(tag)

      // Clear CM6 selection
      view.dispatch({
        selection: { anchor: from },
      })

      console.log('* Created tag:', tag)
    },
    [contextMenu.selection, currentAnn, dtd, addTag]
  )

  // ── Render ──
  // Always render the container div so CM6 stays mounted.
  // Show empty-state overlay on top when no file is selected.

  return (
    <div
      className={markMode === 'node' ? 'mark-mode-node' : 'mark-mode-span'}
      style={{ flex: 1, position: 'relative', overflow: 'hidden' }}
    >
      {/* CM6 editor container — always mounted */}
      <div
        ref={containerRef}
        style={{
          width: '100%',
          height: '100%',
          visibility: currentAnn ? 'visible' : 'hidden',
        }}
      />

      {/* Empty-state overlay */}
      {!currentAnn && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ccc',
            fontSize: 14,
            background: '#fafafa',
          }}
        >
          <div style={{ textAlign: 'center' }}>
            <EditOutlined style={{ fontSize: 40, display: 'block', marginBottom: 12 }} />
            {anns.length === 0 ? 'No files loaded' : 'Select a file to view'}
          </div>
        </div>
      )}

      {/* Linking banner (floating panel during relation creation) */}
      <LinkingBanner />

      {/* Entity creation context menu (right-click on text selection) */}
      <ContextMenu
        visible={contextMenu.visible}
        x={contextMenu.x}
        y={contextMenu.y}
        tags={dtd?.etags || []}
        onSelect={handleTagSelect}
        onClose={() => setContextMenu({ ...contextMenu, visible: false })}
      />

      {/* Tag popup menu (left-click on entity mark) */}
      <TagPopupMenu
        visible={tagMenu.visible}
        x={tagMenu.x}
        y={tagMenu.y}
        tagId={tagMenu.tagId}
        onClose={() => setTagMenu({ ...tagMenu, visible: false })}
      />
    </div>
  )
}
