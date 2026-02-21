import type { Ann, AnnTag, Dtd } from '../types'
import type { LlmAnnotation } from './ollama-client'
import { getLocs, spans2locs } from '../parsers/ann-parser'
import { makeEtag } from './tag-helper'

/**
 * Check if two span ranges overlap
 */
function spansOverlap(a: [number, number], b: [number, number]): boolean {
  return a[0] < b[1] && b[0] < a[1]
}

/**
 * Get all existing etag span ranges from an annotation
 */
function getExistingSpans(ann: Ann, dtd: Dtd): [number, number][] {
  const ranges: [number, number][] = []
  for (const tag of ann.tags) {
    const tagDef = dtd.tag_dict[tag.tag]
    if (!tagDef || tagDef.type !== 'etag') continue
    if (!tag.spans || tag.spans === '-1~-1') continue
    const locs = spans2locs(tag.spans)
    for (const loc of locs) {
      ranges.push([loc[0], loc[1]])
    }
  }
  return ranges
}

/**
 * Convert LLM annotation results to AnnTag objects.
 * Uses getLocs() for precise span matching instead of trusting LLM offsets.
 * Skips annotations that overlap with existing tags.
 */
export function llmAnnotationsToTags(
  llmResult: LlmAnnotation[],
  ann: Ann,
  dtd: Dtd
): AnnTag[] {
  const existingSpans = getExistingSpans(ann, dtd)
  const newTags: AnnTag[] = []

  for (const { keyword, tag: tagName } of llmResult) {
    const tagDef = dtd.tag_dict[tagName]
    if (!tagDef || tagDef.type !== 'etag') continue

    const locs = getLocs(keyword, ann.text)
    if (locs.length === 0) continue

    for (const [start, end] of locs) {
      const span: [number, number] = [start, end]

      // Check overlap with existing + newly created tags
      const hasOverlap = existingSpans.some((ex) => spansOverlap(span, ex))
      if (hasOverlap) continue

      const text = ann.text.substring(start, end)
      const tag = makeEtag({ spans: `${start}~${end}`, text }, tagDef, ann)

      newTags.push(tag)
      existingSpans.push(span)

      // Push tag to ann.tags so next makeEtag gets correct next ID
      ann.tags.push(tag)
    }
  }

  // Remove the tags we just pushed (caller will addTag them properly)
  ann.tags.splice(ann.tags.length - newTags.length, newTags.length)

  return newTags
}
