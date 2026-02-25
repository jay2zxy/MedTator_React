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

// Pre-negation: cues that appear BEFORE the keyword ("denies fever", "no fever")
const PRE_NEGATION_CUES = [
  'denies', 'denied', 'deny',
  'no ', 'not ', 'without',
  "doesn't", "don't", "does not", "do not",
  'negative for', 'rules out', 'ruled out', 'absent',
]
const PRE_NEGATION_WINDOW = 60

// Post-negation: cues that appear AFTER the keyword ("fever: absent", "fever not found")
const POST_NEGATION_CUES = [
  'absent', 'not found', 'not present', 'not reported', 'not detected',
  'ruled out', ': none', ': negative', ': no ',
]
const POST_NEGATION_WINDOW = 30

// Sentence boundaries and contrast conjunctions reset the negation scope.
const SCOPE_BREAKER_RE = /[.!?]|\b(but|however|although|yet|except|while|whereas|though)\b/gi

export function isNegatedByContext(text: string, keywordStart: number, keywordEnd = keywordStart): boolean {
  // Pre-negation: look back up to PRE_NEGATION_WINDOW chars, stop at last scope breaker
  const windowStart = Math.max(0, keywordStart - PRE_NEGATION_WINDOW)
  let preWindow = text.slice(windowStart, keywordStart).toLowerCase()
  const breakers = [...preWindow.matchAll(SCOPE_BREAKER_RE)]
  if (breakers.length > 0) {
    const last = breakers[breakers.length - 1]
    preWindow = preWindow.slice(last.index! + last[0].length)
  }
  if (PRE_NEGATION_CUES.some((cue) => preWindow.includes(cue))) return true

  // Post-negation: look forward up to POST_NEGATION_WINDOW chars, stop at sentence boundary
  const postWindowEnd = Math.min(text.length, keywordEnd + POST_NEGATION_WINDOW)
  let postWindow = text.slice(keywordEnd, postWindowEnd).toLowerCase()
  const sentEnd = postWindow.search(/[.!?]/)
  if (sentEnd >= 0) postWindow = postWindow.slice(0, sentEnd)
  return POST_NEGATION_CUES.some((cue) => postWindow.includes(cue))
}

/**
 * Convert LLM annotation results to AnnTag objects.
 * Uses getLocs() for precise span matching instead of trusting LLM offsets.
 * Skips annotations that overlap with existing tags or are negated.
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

      if (isNegatedByContext(ann.text, start, end)) continue

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
