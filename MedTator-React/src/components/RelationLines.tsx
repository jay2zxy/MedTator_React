/**
 * SVG overlay for drawing relation tag polylines
 *
 * Renders polylines connecting entity tags referenced by relation tags.
 * Uses EditorView.coordsAtPos() to get pixel coordinates.
 * Responds to scroll, resize, and annotation changes.
 */
import { useEffect, useRef, useState, useCallback } from 'react'
import type { EditorView } from '@codemirror/view'
import { useAppStore } from '../store'
import { spansToCmRanges } from '../editor/cm-spans'
import { NON_CONSUMING_SPANS } from '../parsers/dtd-parser'
import { getIdrefAttrs } from '../utils/tag-helper'
import { remapSpansToSentenceView } from '../utils/nlp-toolkit'

interface Props {
  viewRef: React.RefObject<EditorView | null>
}

interface LineData {
  id: string
  rtagName: string
  points: string
  labelX: number
  labelY: number
  labelText: string
}

export default function RelationLines({ viewRef }: Props) {
  const anns = useAppStore((s) => s.anns)
  const annIdx = useAppStore((s) => s.annIdx)
  const dtd = useAppStore((s) => s.dtd)
  const displayTagName = useAppStore((s) => s.displayTagName)
  const enabledLinks = useAppStore((s) => s.cm.enabledLinks)
  const enabledLinkName = useAppStore((s) => s.cm.enabledLinkName)

  const [lines, setLines] = useState<LineData[]>([])
  const containerRef = useRef<HTMLDivElement>(null)

  // Stable calculation function — reads fresh state from store
  const calculateLines = useCallback(() => {
    const view = viewRef.current
    const container = containerRef.current
    const state = useAppStore.getState()
    const { anns: curAnns, annIdx: curIdx, dtd: curDtd, cm } = state

    const ann = curIdx !== null ? curAnns[curIdx] : null

    if (!view || !container || !ann || !curDtd || !cm.enabledLinks) {
      setLines([])
      return
    }

    if (view.state.doc.length === 0) {
      setLines([])
      return
    }

    const containerRect = container.getBoundingClientRect()
    const newLines: LineData[] = []

    const curDisplayTagName = state.displayTagName

    for (const rtag of ann.tags) {
      const rtagDef = curDtd.tag_dict[rtag.tag]
      if (!rtagDef || rtagDef.type !== 'rtag') continue

      // Filter by displayTagName
      if (curDisplayTagName !== '__all__') {
        if (rtag.tag === curDisplayTagName) {
          // Direct match on rtag name — show it
        } else {
          const filterDef = curDtd.tag_dict[curDisplayTagName]
          if (filterDef?.type === 'rtag') {
            continue // Different rtag type — skip
          }
          // Filtering by etag — show rtag only if it references that etag type
          const filterIdrefAttrs = getIdrefAttrs(rtagDef)
          let matchesFilter = false
          for (const attr of filterIdrefAttrs) {
            const etagId = rtag[attr.name]
            if (!etagId) continue
            const etag = ann.tags.find(t => t.id === etagId)
            if (etag && etag.tag === curDisplayTagName) {
              matchesFilter = true
              break
            }
          }
          if (!matchesFilter) continue
        }
      }

      const idrefAttrs = getIdrefAttrs(rtagDef)
      if (idrefAttrs.length < 2) continue

      const etags = []
      for (const attr of idrefAttrs) {
        const etagId = rtag[attr.name]
        if (!etagId) continue

        const etag = ann.tags.find((t) => t.id === etagId)
        if (!etag) continue

        const etagDef = curDtd.tag_dict[etag.tag]
        if (etagDef?.type !== 'etag') continue

        if (!etag.spans || etag.spans === '' || etag.spans === NON_CONSUMING_SPANS)
          continue

        etags.push(etag)
      }

      if (etags.length < 2) continue

      const etagA = etags[0]
      const etagB = etags[1]

      if (!etagA.spans || !etagB.spans) continue

      // In sentence mode, remap spans to sentence-view offsets
      let spansA = etagA.spans
      let spansB = etagB.spans
      if (cm.displayMode === 'sentences' && ann._sentences.length > 0) {
        const remappedA = remapSpansToSentenceView(spansA, ann._sentences)
        const remappedB = remapSpansToSentenceView(spansB, ann._sentences)
        if (!remappedA || !remappedB) continue
        spansA = remappedA
        spansB = remappedB
      }

      const coordsA = getEntityCoords(view, spansA, containerRect)
      const coordsB = getEntityCoords(view, spansB, containerRect)

      if (!coordsA || !coordsB) continue

      const polyline = buildPolyline(coordsA, coordsB)

      newLines.push({
        id: rtag.id,
        rtagName: rtag.tag,
        points: polyline.points,
        labelX: polyline.labelX,
        labelY: polyline.labelY,
        labelText: rtag.id,
      })
    }

    setLines(newLines)
  }, [viewRef])

  // Update lines on data change — delay one frame so CM6 renders first
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      calculateLines()
    })
    return () => cancelAnimationFrame(raf)
  }, [anns, annIdx, dtd, displayTagName, enabledLinks, enabledLinkName, calculateLines])

  // Recalculate on CM6 scroll
  useEffect(() => {
    const view = viewRef.current
    if (!view) return

    const handleScroll = () => calculateLines()
    const scroller = view.scrollDOM
    scroller.addEventListener('scroll', handleScroll)
    return () => scroller.removeEventListener('scroll', handleScroll)
  }, [viewRef.current, calculateLines])

  // Recalculate on window resize
  useEffect(() => {
    const handleResize = () => calculateLines()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [calculateLines])

  if (!enabledLinks) return null

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
      }}
    >
      <svg
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          overflow: 'visible',
        }}
      >
        {lines.map((line) => (
          <g key={line.id}>
            <polyline
              points={line.points}
              style={{
                fill: 'none',
                stroke: 'black',
                strokeWidth: 1,
                strokeLinecap: 'round',
                opacity: 0.5,
              }}
            />

            {enabledLinkName && (
              <>
                <rect
                  x={line.labelX - 12}
                  y={line.labelY - 5}
                  width={24}
                  height={10}
                  rx={3}
                  className={`svgmark-tag-${line.rtagName}`}
                  style={{
                    strokeWidth: 0,
                    opacity: 0.9,
                  }}
                />
                <text
                  x={line.labelX}
                  y={line.labelY}
                  textAnchor="middle"
                  alignmentBaseline="middle"
                  style={{
                    fontSize: 8,
                    fontFamily: 'monospace',
                    fill: '#333',
                  }}
                >
                  {line.labelText}
                </text>
              </>
            )}
          </g>
        ))}
      </svg>
    </div>
  )
}

// ── Pure helper functions ──

function getEntityCoords(
  view: EditorView,
  spans: string,
  containerRect: DOMRect
): { left: number; top: number; right: number } | null {
  const ranges = spansToCmRanges(spans)
  if (ranges.length === 0) return null

  const from = ranges[0].from
  const to = ranges[ranges.length - 1].to

  const docLength = view.state.doc.length
  if (from < 0 || from >= docLength || to < 0 || to > docLength) return null

  let fromCoords, toCoords
  try {
    fromCoords = view.coordsAtPos(from)
    toCoords = view.coordsAtPos(to)
  } catch {
    return null
  }

  if (!fromCoords || !toCoords) return null

  return {
    left: fromCoords.left - containerRect.left,
    top: fromCoords.top - containerRect.top,
    right: toCoords.right - containerRect.left,
  }
}

function buildPolyline(
  coordsA: { left: number; top: number; right: number },
  coordsB: { left: number; top: number; right: number }
) {
  const deltaHeight = 6

  const upperTop = Math.min(coordsA.top, coordsB.top) - deltaHeight

  const xys = [
    [(coordsA.left + coordsA.right) / 2, coordsA.top],
    [(coordsA.left + coordsA.right) / 2, upperTop],
    [(coordsB.left + coordsB.right) / 2, upperTop],
    [(coordsB.left + coordsB.right) / 2, coordsB.top],
  ]

  const points = xys
    .map((xy) => `${Math.floor(xy[0])},${Math.floor(xy[1])}`)
    .join(' ')

  const labelX = (xys[1][0] + xys[2][0]) / 2
  const labelY = upperTop

  return { points, labelX, labelY }
}
