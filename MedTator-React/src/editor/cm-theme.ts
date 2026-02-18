/**
 * CM6 theme + dynamic tag color styles
 *
 * Static styles are defined here as a CM6 theme.
 * Dynamic per-tag colors are injected as a <style> element
 * when the DTD changes (see injectTagColors).
 */
import { EditorView } from '@codemirror/view'
import type { Dtd } from '../types'

// ── Static CM6 theme ──

export const annotationTheme = EditorView.theme({
  // Editor container
  '&': {
    height: '100%',
    fontSize: '14px',
  },
  '.cm-content': {
    lineHeight: '2em',
    fontFamily: 'Consolas, Monaco, "Courier New", monospace',
  },
  '.cm-gutters': {
    backgroundColor: '#f5f5f5',
    borderRight: '1px solid #ddd',
    lineHeight: '2em',
  },
  // Disable cursor blinking in readOnly mode
  '.cm-cursor': {
    borderLeftColor: 'transparent',
  },

  // ── Entity tag marks ──
  '.mark-tag': {
    borderRadius: '3px',
    padding: '1px 0',
    cursor: 'pointer',
    border: '1px solid transparent',
    borderLeft: '0',
    borderRight: '0',
  },
  '.mark-tag:hover': {
    borderColor: 'red',
  },

  // ── Selected tag glow ──
  '.mark-tag-active': {
    borderTop: '3px solid #333',
    borderBottom: '3px solid #333',
    animation: 'medtator-glow 500ms ease-out infinite alternate',
  },

  // ── Hint marks (Phase later) ──
  '.mark-hint': {
    cursor: 'pointer',
    borderBottom: '2px dotted #999',
    position: 'relative',
  },
  '.mark-hint:hover': {
    fontWeight: 'bold',
    borderColor: '#333',
  },
})

// ── Global static styles (injected once) ──

const STATIC_STYLE_ID = 'medtator-static-styles'
let staticInjected = false

function injectStaticStyles() {
  if (staticInjected) return
  staticInjected = true

  const style = document.createElement('style')
  style.id = STATIC_STYLE_ID
  style.textContent = `
@keyframes medtator-glow {
  0% {
    border-color: #efefef;
    box-shadow: 0 0 5px #efefef;
  }
  100% {
    border-color: #333333;
    box-shadow: 0 0 10px #555555;
  }
}

/* Tag ID label widget (always in DOM, hidden in span mode) */
.mark-tag-label {
  display: none;
  font-size: 0.75em;
  padding: 0 2px;
  margin-right: 2px;
  background: white;
  border-radius: 4px;
}

/* "Color + ID" mode: show tag ID labels */
.mark-mode-node .mark-tag-label {
  display: inline;
}
`
  document.head.appendChild(style)
}

// ── Color palette (from original app_hotpot.js) ──

const APP_COLORS = [
  '#a6cee3', '#51a1d7', '#b2df8a', '#33a02c',
  '#fb9a99', '#e31a1c', '#fdbf6f', '#ff7f00',
  '#cab2d6', '#9654dc', '#d0aa3d', '#b15928',
  '#8dd3c7', '#9c9c64', '#bebada', '#fb8072',
  '#80b1d3', '#fdb462', '#b3de69', '#fccde5',
  '#d9d9d9', '#bc80bd', '#ccebc5', '#ffed6f',
]

const DEFAULT_COLOR = '#333333'

/**
 * Assign colors from palette to DTD tags.
 * Mutates dtd.tag_dict[tag].style.color in place.
 * Call this BEFORE setDtd() so the store has correct colors from the start.
 */
export function assignTagColors(dtd: Dtd) {
  let colorIdx = 0
  for (const tagName in dtd.tag_dict) {
    const tag = dtd.tag_dict[tagName]
    let color = tag.style?.color
    if (!color || color === DEFAULT_COLOR) {
      color = colorIdx < APP_COLORS.length
        ? APP_COLORS[colorIdx]
        : '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')
      tag.style = { color }
    }
    colorIdx++
  }
}

// ── Dynamic tag colors ──

const TAG_COLOR_STYLE_ID = 'medtator-tag-colors'

/**
 * Inject per-tag CSS rules from DTD tag colors.
 * Assumes assignTagColors() was already called.
 */
export function injectTagColors(dtd: Dtd) {
  injectStaticStyles()

  // Remove old style element
  const old = document.getElementById(TAG_COLOR_STYLE_ID)
  if (old) old.remove()

  const rules: string[] = []

  for (const tagName in dtd.tag_dict) {
    const color = dtd.tag_dict[tagName].style?.color
    if (!color) continue

    rules.push(`.mark-tag-${tagName} { background-color: ${color}; }`)
    rules.push(`.border-tag-${tagName} { border-color: ${color} !important; }`)
    rules.push(`.fg-tag-${tagName} { color: ${color} !important; }`)
    rules.push(`.svgmark-tag-${tagName} { fill: ${color}; }`)
    rules.push(`.mark-hint-${tagName}:hover { background-color: ${color}; }`)
  }

  const style = document.createElement('style')
  style.id = TAG_COLOR_STYLE_ID
  style.textContent = rules.join('\n')
  document.head.appendChild(style)
}
