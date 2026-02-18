/**
 * NLP Toolkit — sentence tokenization and span remapping
 * Migrated from templates/js/nlp_toolkit.js (sent_tokenize_by_simpledot_v2)
 */

export interface Sentence {
  text: string
  spans: { start: number; end: number }
}

export interface SentenceResult {
  sentences: Sentence[]
  sentences_text: string
}

// Symbols that break a token boundary (for dot-exception lookback)
const SENT_TLB_SYMS = ' `!@#$%^&*()_+-=[]{}|\\:";\'<>?,/'

// Exception words: dots in these don't end a sentence
const SENTENCIZE_EXCEPTIONS = new Set([
  // time
  'a.m.', 'p.m.',
  'mon.', 'tue.', 'wed.', 'thu.', 'fri.', 'sat.', 'sun.',
  'jan.', 'feb.', 'mar.', 'apr.', 'jun.', 'jul.', 'aug.', 'sep.', 'oct.', 'nov.', 'dec.',
  // geo (US state abbreviations)
  'ark.', 'ala.', 'ariz.', 'calif.', 'colo.', 'conn.', 'fla.', 'ga.', 'ia.', 'id.',
  'ill.', 'ind.', 'kan.', 'kans.', 'ky.', 'mass.', 'n.c.', 'n.d.', 'n.h.', 'n.j.',
  'n.m.', 'n.y.', 'neb.', 'nebr.', 'nev.', 'okla.', 'ore.', 'pa.', 's.c.', 'tenn.',
  'va.', 'wash.', 'wis.', 'd.c.',
  // title and names
  'jr.', 'st.', 'mr.', 'mrs.', 'ms.', 'dr.', 'm.d.', 'ph.d.', 'prof.', 'bros.', 'adm.',
  // other
  '#.', 'no.', 'e.g.', 'ie.', 'i.e.', 'inc.', 'ltd.', 'co.', 'corp.', 'vs.', 'v.s.',
  'gov.', 'gen.', 'n.e.r.v.',
])

/**
 * Tokenize text into sentences using simpledot_v2 algorithm.
 * Splits on `.`, `?`, `!`, `;`, and `\n`, with exception handling for abbreviations.
 */
export function sentTokenize(text: string): SentenceResult {
  const sentences: Sentence[] = []
  const sentencesText: string[] = []

  const sentence: string[] = []
  let spansStart = 0
  let spansEnd = 0

  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    spansEnd = i
    let flagSent = false

    if (c === '.') {
      // Check if next char is non-whitespace → not a sentence break
      if (i + 1 < text.length && text[i + 1].trim() !== '') {
        sentence.push(c)
      } else {
        // Look back to find the token containing this dot
        let dotTokenStart = i
        for (let bi = i - 1; bi >= 0; bi--) {
          if (SENT_TLB_SYMS.includes(text[bi])) {
            dotTokenStart = bi + 1
            break
          }
        }
        const dotToken = text.substring(dotTokenStart, i + 1)
        const dotTokenLower = dotToken.toLocaleLowerCase()

        if (SENTENCIZE_EXCEPTIONS.has(dotTokenLower)) {
          // Exception — not a sentence break
          sentence.push(c)
        } else {
          flagSent = true
          sentence.push(c)
        }
      }
    } else if (c === '?' || c === '!' || c === ';') {
      flagSent = true
      sentence.push(c)
    } else if (c === '\n') {
      flagSent = true
      // Don't collect newline into sentence text
    } else {
      sentence.push(c)
    }

    if (flagSent) {
      const sentText = sentence.join('')
      sentence.length = 0

      sentences.push({
        text: sentText,
        spans: { start: spansStart, end: spansEnd },
      })
      sentencesText.push(sentText)

      spansStart = spansEnd + 1
    }
  }

  // Handle remaining text
  if (sentence.length > 0) {
    const sentText = sentence.join('')
    sentences.push({
      text: sentText,
      spans: { start: spansStart, end: spansEnd },
    })
    sentencesText.push(sentText)
  }

  return {
    sentences,
    sentences_text: sentencesText.join('\n'),
  }
}

/**
 * Find which sentence a document position falls in.
 * Returns { line, ch } where line is sentence index and ch is offset within sentence.
 */
export function findLineCh(
  pos: number,
  sentences: Sentence[]
): { line: number; ch: number } | null {
  for (let i = 0; i < sentences.length; i++) {
    const s = sentences[i]
    if (pos >= s.spans.start && pos <= s.spans.end) {
      return { line: i, ch: pos - s.spans.start }
    }
  }
  return null
}

/**
 * Convert document-space spans to sentence-view character offset.
 * In sentence view, each sentence is a line separated by \n.
 * Returns the absolute character offset in sentences_text.
 */
export function docSpanToSentenceOffset(
  docPos: number,
  sentences: Sentence[]
): number | null {
  let offset = 0
  for (let i = 0; i < sentences.length; i++) {
    const s = sentences[i]
    if (docPos >= s.spans.start && docPos <= s.spans.end) {
      return offset + (docPos - s.spans.start)
    }
    // Each sentence line is: s.text.length + 1 (\n separator)
    offset += s.text.length + 1
  }
  return null
}

/**
 * Convert sentence-view character offset back to document-space position.
 * Inverse of docSpanToSentenceOffset.
 */
export function sentenceOffsetToDocPos(
  sentOffset: number,
  sentences: Sentence[]
): number | null {
  let offset = 0
  for (let i = 0; i < sentences.length; i++) {
    const s = sentences[i]
    const lineEnd = offset + s.text.length
    if (sentOffset >= offset && sentOffset <= lineEnd) {
      const ch = sentOffset - offset
      return s.spans.start + ch
    }
    offset = lineEnd + 1 // +1 for \n
  }
  return null
}

/**
 * Remap a spans string from document space to sentence-view space.
 * E.g., "16~22" → "16~22" in document mode, but "5~11" in sentence mode
 * if the tag falls inside the second sentence.
 */
export function remapSpansToSentenceView(
  spans: string,
  sentences: Sentence[]
): string | null {
  const parts = spans.replace(/;/g, ',').split(',')
  const remapped: string[] = []

  for (const part of parts) {
    const ps = part.split('~')
    const from = parseInt(ps[0])
    const to = parseInt(ps[1])
    if (isNaN(from) || isNaN(to)) continue
    if (from === -1 && to === -1) return spans // non-consuming

    const newFrom = docSpanToSentenceOffset(from, sentences)
    const newTo = docSpanToSentenceOffset(to, sentences)
    if (newFrom === null || newTo === null) continue

    remapped.push(`${newFrom}~${newTo}`)
  }

  return remapped.length > 0 ? remapped.join(',') : null
}

/**
 * Ensure ann._sentences is computed (lazy memoization).
 * Mutates ann in place.
 */
export function ensureAnnSentences(ann: { text: string; _sentences: Sentence[]; _sentences_text: string }) {
  if (ann._sentences_text !== '') return // Already computed
  const result = sentTokenize(ann.text)
  ann._sentences = result.sentences
  ann._sentences_text = result.sentences_text
}
