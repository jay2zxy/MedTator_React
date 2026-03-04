/**
 * CM6 base configuration
 *
 * Returns the Extension array for the annotation editor:
 * read-only, line numbers, line wrapping, search.
 */
import { EditorState, type Extension } from '@codemirror/state'
import { EditorView, lineNumbers, keymap } from '@codemirror/view'
import { search, searchKeymap } from '@codemirror/search'
import { tagDecorationField, selectedTagField, hintDecorationField } from './cm-decorations'
import { annotationTheme } from './cm-theme'

export function createEditorExtensions(): Extension[] {
  return [
    EditorState.readOnly.of(true),
    lineNumbers(),
    EditorView.lineWrapping,
    search(),
    keymap.of(searchKeymap),
    annotationTheme,
    tagDecorationField,
    selectedTagField,
    hintDecorationField,
  ]
}
