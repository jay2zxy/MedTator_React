/**
 * CM6 StateField for annotation decorations
 *
 * Two independent decoration layers:
 * 1. tagDecorationField — all visible entity tags as colored marks
 * 2. selectedTagField  — highlight overlay for the selected tag
 */
import { StateField, StateEffect } from '@codemirror/state'
import { Decoration, type DecorationSet, EditorView } from '@codemirror/view'
import type { AnnTag, Dtd } from '../types'
import { NON_CONSUMING_SPANS } from '../parsers/dtd-parser'
import { spansToCmRanges } from './cm-spans'

// ── Effect types ──

interface TagDecoInput {
  tags: AnnTag[]
  dtd: Dtd
  displayTagName: string
  docLength: number
}

interface SelectedTagInput {
  tagId: string | null
  tags: AnnTag[]
  docLength: number
}

export const setTagDecorations = StateEffect.define<TagDecoInput>()
export const setSelectedTag = StateEffect.define<SelectedTagInput>()

// ── Tag decoration field ──

export const tagDecorationField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none
  },
  update(deco, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setTagDecorations)) {
        return buildTagDecorations(effect.value)
      }
    }
    if (tr.docChanged) {
      return Decoration.none
    }
    return deco
  },
  provide(field) {
    return EditorView.decorations.from(field)
  },
})

function buildTagDecorations(input: TagDecoInput): DecorationSet {
  const { tags, dtd, displayTagName, docLength } = input
  const ranges: { from: number; to: number; deco: Decoration }[] = []

  for (const tag of tags) {
    const tagDef = dtd.tag_dict[tag.tag]
    if (!tagDef || tagDef.type !== 'etag') continue

    // Display filter
    if (displayTagName !== '__all__') {
      if (tag.tag !== displayTagName) {
        // When a rtag is selected, also show its referenced etags
        const filterDef = dtd.tag_dict[displayTagName]
        if (filterDef?.type === 'rtag') {
          const isReferenced = tags.some(
            (t) =>
              t.tag === displayTagName &&
              Object.values(t).includes(tag.id)
          )
          if (!isReferenced) continue
        } else {
          continue
        }
      }
    }

    // Skip non-consuming / invalid spans
    const spans = tag.spans
    if (!spans || spans === '' || spans === NON_CONSUMING_SPANS) continue

    const cmRanges = spansToCmRanges(spans)
    for (const r of cmRanges) {
      if (r.from < 0 || r.to <= r.from) continue
      if (r.from >= docLength || r.to > docLength) continue

      ranges.push({
        from: r.from,
        to: r.to,
        deco: Decoration.mark({
          class: `mark-tag mark-tag-${tag.tag}`,
          attributes: {
            'data-tag-id': tag.id,
            'data-tag-name': tag.tag,
            title: `${tag.tag} – ${tag.id}\nspans: ${tag.spans}`,
          },
        }),
      })
    }
  }

  // CM6 requires sorted, non-overlapping ranges for mark decorations
  ranges.sort((a, b) => a.from - b.from || a.to - b.to)

  return Decoration.set(
    ranges.map((r) => r.deco.range(r.from, r.to)),
    true,
  )
}

// ── Selected tag highlight field ──

const selectedDeco = Decoration.mark({ class: 'mark-tag-active' })

export const selectedTagField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none
  },
  update(deco, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setSelectedTag)) {
        return buildSelectedDecoration(effect.value)
      }
    }
    if (tr.docChanged) {
      return Decoration.none
    }
    return deco
  },
  provide(field) {
    return EditorView.decorations.from(field)
  },
})

function buildSelectedDecoration(input: SelectedTagInput): DecorationSet {
  const { tagId, tags, docLength } = input
  if (!tagId) return Decoration.none

  const tag = tags.find((t) => t.id === tagId)
  if (!tag?.spans || tag.spans === NON_CONSUMING_SPANS) return Decoration.none

  const cmRanges = spansToCmRanges(tag.spans)
  const decoRanges = cmRanges
    .filter((r) => r.from >= 0 && r.to > r.from && r.to <= docLength)
    .map((r) => selectedDeco.range(r.from, r.to))

  return Decoration.set(decoRanges, true)
}
