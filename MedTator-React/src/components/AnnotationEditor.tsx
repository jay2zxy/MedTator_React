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
import { setTagDecorations, setSelectedTag, setHintDecorations } from '../editor/cm-decorations'
import { injectTagColors } from '../editor/cm-theme'
import { cmRangeToSpans } from '../editor/cm-spans'
import { searchHintsInAnn } from '../parsers/ann-parser'
import { makeEtag } from '../utils/tag-helper'
import { ensureAnnSentences, remapSpansToSentenceView, sentenceOffsetToDocPos } from '../utils/nlp-toolkit'
import type { AnnTag, DtdTag } from '../types'
import ContextMenu from './ContextMenu'
import TagPopupMenu from './TagPopupMenu'
import LinkingBanner from './LinkingBanner'
import RelationLines from './RelationLines'

// Module-level ref so ToolbarRibbon can call openSearchPanel(editorViewRef.current)
export const editorViewRef: { current: EditorView | null } = { current: null }

// Shortcut keys assigned to etags[0], etags[1], ...
const APP_SHORTCUTS = ['1','2','3','4','5','6','7','8','9','a','c','v','b']

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
  const enabledHints = useAppStore((s) => s.cm.enabledHints)
  const hintDict = useAppStore((s) => s.hintDict)
  const setHints = useAppStore((s) => s.setHints)
  const displayMode = useAppStore((s) => s.cm.displayMode)

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
      keydown: (event: KeyboardEvent, view: EditorView) => {
        // Skip modifier-key combos (Ctrl+S etc. handled elsewhere)
        if (event.ctrlKey || event.metaKey || event.altKey) return false

        const key = event.key.toLowerCase()
        const tagIdx = APP_SHORTCUTS.indexOf(key)
        if (tagIdx < 0) return false

        const store = useAppStore.getState()
        const { dtd, anns, annIdx, cm } = store
        if (!dtd || annIdx === null) return false
        if (tagIdx >= dtd.etags.length) return false

        // Require a text selection
        const sel = view.state.selection.main
        if (sel.from === sel.to) return false

        const tagDef = dtd.etags[tagIdx]
        const selText = view.state.doc.sliceString(sel.from, sel.to)

        // In sentence mode, remap CM6 offsets back to document space
        let spans: string
        if (cm.displayMode === 'sentences' && anns[annIdx]._sentences.length > 0) {
          const docFrom = sentenceOffsetToDocPos(sel.from, anns[annIdx]._sentences)
          const docTo = sentenceOffsetToDocPos(sel.to, anns[annIdx]._sentences)
          if (docFrom === null || docTo === null) return false
          spans = cmRangeToSpans(docFrom, docTo)
        } else {
          spans = cmRangeToSpans(sel.from, sel.to)
        }

        const tag = makeEtag({ spans, text: selText }, tagDef, anns[annIdx])

        store.addTag(tag)
        view.dispatch({ selection: { anchor: sel.from } })

        event.preventDefault()
        return true
      },

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
        // Check if clicking on a hint mark
        const target = event.target as HTMLElement
        const hintEl = target.closest('[data-hint-id]') as HTMLElement
        if (hintEl) {
          const hintId = hintEl.getAttribute('data-hint-id')!
          useAppStore.getState().acceptHint(hintId)
          event.preventDefault()
          return true
        }

        // Check if clicking on an entity tag mark
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
    editorViewRef.current = view

    return () => {
      view.destroy()
      viewRef.current = null
      editorViewRef.current = null
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

    // Determine display text based on mode
    let text = ''
    const isSentenceMode = displayMode === 'sentences'
    if (currentAnn) {
      if (isSentenceMode) {
        ensureAnnSentences(currentAnn)
        text = currentAnn._sentences_text
      } else {
        text = currentAnn.text
      }
    }

    const currentText = view.state.doc.toString()
    const docChanged = currentText !== text

    const effects = []

    if (dtd && currentAnn) {
      const docLen = docChanged ? text.length : view.state.doc.length

      // In sentence mode, remap tag spans to sentence-view offsets
      let displayTags = currentAnn.tags
      if (isSentenceMode && currentAnn._sentences.length > 0) {
        displayTags = currentAnn.tags
          .map(tag => {
            if (!tag.spans || tag.spans === '-1~-1') return tag
            const remapped = remapSpansToSentenceView(tag.spans, currentAnn._sentences)
            if (!remapped) return null
            return { ...tag, spans: remapped }
          })
          .filter((t): t is AnnTag => t !== null)
      }

      effects.push(
        setTagDecorations.of({
          tags: displayTags,
          dtd,
          displayTagName,
          docLength: docLen,
        }),
      )

      effects.push(
        setSelectedTag.of({
          tagId: selectedTagId,
          tags: displayTags,
          docLength: docLen,
        }),
      )

      // Compute and dispatch hint decorations
      if (enabledHints) {
        const focusTags = displayTagName !== '__all__'
          ? [displayTagName]
          : null
        const computedHints = searchHintsInAnn(hintDict, currentAnn, focusTags)
          .filter(h => h.text !== '.')
        setHints(computedHints)

        // In sentence mode, remap hint spans too
        let displayHints = computedHints
        if (isSentenceMode && currentAnn._sentences.length > 0) {
          displayHints = computedHints
            .map(hint => {
              if (!hint.spans) return hint
              const remapped = remapSpansToSentenceView(hint.spans, currentAnn._sentences)
              if (!remapped) return null
              return { ...hint, spans: remapped }
            })
            .filter((h): h is AnnTag => h !== null)
        }

        effects.push(
          setHintDecorations.of({
            hints: displayHints,
            dtd,
            docLength: docLen,
          }),
        )
      } else {
        setHints([])
        effects.push(
          setHintDecorations.of({
            hints: [],
            dtd,
            docLength: docLen,
          }),
        )
      }
    }

    if (docChanged) {
      view.dispatch({
        changes: { from: 0, to: currentText.length, insert: text },
        effects,
      })
    } else if (effects.length > 0) {
      view.dispatch({ effects })
    }
  }, [anns, annIdx, dtd, displayTagName, selectedTagId, enabledHints, hintDict, displayMode])

  // ── Handle context menu tag selection (entity creation) ──

  const handleTagSelect = useCallback(
    (tagDef: DtdTag) => {
      if (!contextMenu.selection || !currentAnn || !dtd) return

      const view = viewRef.current
      if (!view) return

      const { from, to } = contextMenu.selection

      // Get selected text
      const selText = view.state.doc.sliceString(from, to)

      // In sentence mode, remap CM6 offsets back to document space
      let spans: string
      if (displayMode === 'sentences' && currentAnn._sentences.length > 0) {
        const docFrom = sentenceOffsetToDocPos(from, currentAnn._sentences)
        const docTo = sentenceOffsetToDocPos(to, currentAnn._sentences)
        if (docFrom === null || docTo === null) return
        spans = cmRangeToSpans(docFrom, docTo)
      } else {
        spans = cmRangeToSpans(from, to)
      }

      // Create full entity tag with auto-generated ID and default attributes
      const tag = makeEtag({ spans, text: selText }, tagDef, currentAnn)

      // Add tag to current annotation
      addTag(tag)

      // Clear CM6 selection
      view.dispatch({
        selection: { anchor: from },
      })

      console.log('* Created tag:', tag)
    },
    [contextMenu.selection, currentAnn, dtd, addTag, displayMode]
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

      {/* Relation lines (SVG overlay) */}
      <RelationLines viewRef={viewRef} />

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
