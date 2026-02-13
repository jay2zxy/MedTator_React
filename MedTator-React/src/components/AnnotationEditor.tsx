/**
 * CodeMirror 6 annotation editor
 *
 * Replaces the placeholder <textarea> in EditorPanel.
 * Displays read-only text with colored entity tag highlights.
 */
import { useRef, useEffect } from 'react'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { EditOutlined } from '@ant-design/icons'
import { useAppStore } from '../store'
import { createEditorExtensions } from '../editor/cm-setup'
import { setTagDecorations, setSelectedTag } from '../editor/cm-decorations'
import { injectTagColors } from '../editor/cm-theme'

export default function AnnotationEditor() {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)

  const anns = useAppStore((s) => s.anns)
  const annIdx = useAppStore((s) => s.annIdx)
  const dtd = useAppStore((s) => s.dtd)
  const displayTagName = useAppStore((s) => s.displayTagName)
  const selectedTagId = useAppStore((s) => s.selectedTagId)
  const markMode = useAppStore((s) => s.cm.markMode)

  const currentAnn = annIdx !== null && annIdx < anns.length ? anns[annIdx] : null

  // ── Initialize CM6 (once) ──

  useEffect(() => {
    if (!containerRef.current) return

    const state = EditorState.create({
      doc: '',
      extensions: createEditorExtensions(),
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
  }, [])

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
    </div>
  )
}
