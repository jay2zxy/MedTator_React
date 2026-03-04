/**
 * Span ↔ CM6 position conversion
 *
 * CM6 uses absolute character offsets natively, so this is trivial
 * compared to CM5's line+ch coordinate system.
 */

export interface CmRange {
  from: number
  to: number
}

/**
 * Parse spans string "10~20,30~40" into CM6 ranges
 */
export function spansToCmRanges(spans: string): CmRange[] {
  const parts = spans.replace(/;/g, ',').split(',')
  const ranges: CmRange[] = []

  for (const part of parts) {
    const ps = part.split('~')
    const a = parseInt(ps[0])
    const b = parseInt(ps[1])
    if (!isNaN(a) && !isNaN(b) && a >= 0 && b >= 0) {
      ranges.push({ from: a, to: b })
    }
  }

  return ranges
}

/**
 * Convert CM6 selection range to spans string
 * Normalizes direction (smaller value first)
 */
export function cmRangeToSpans(from: number, to: number): string {
  const a = Math.min(from, to)
  const b = Math.max(from, to)
  return `${a}~${b}`
}
