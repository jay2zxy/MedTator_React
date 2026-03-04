/**
 * Tag creation helpers
 * Migrated from templates/js/app_hotpot.js (lines 3348-3435)
 */
import type { Ann, AnnTag, DtdTag, DtdAttr, Dtd } from '../types'

// Keyboard shortcuts for entity tags (mirrors original app_hotpot.js)
export const APP_SHORTCUTS = ['1','2','3','4','5','6','7','8','9','a','c','v','b']

/**
 * Assign keyboard shortcuts to etags in order
 */
export function assignTagShortcuts(dtd: Pick<Dtd, 'etags'>): void {
  dtd.etags.forEach((tag, i) => {
    tag.shortcut = i < APP_SHORTCUTS.length ? APP_SHORTCUTS[i] : null
  })
}
import { getNextTagId } from '../parsers/ann-parser'
import { NON_CONSUMING_SPANS } from '../parsers/dtd-parser'

/**
 * Create an entity tag from basic tag info and tag definition
 * @param basicTag - Partial tag with at least 'spans' and 'text'
 * @param tagDef - DTD tag definition
 * @param ann - Annotation to add tag to (used for ID generation)
 * @returns Complete entity tag with auto-generated ID and default attributes
 */
export function makeEtag(
  basicTag: Partial<AnnTag>,
  tagDef: DtdTag,
  ann: Ann
): AnnTag {
  const tag: AnnTag = {
    tag: tagDef.name,
    id: getNextTagId(ann, tagDef),
    ...basicTag,
  }

  // Add default values for all attributes defined in schema
  for (const att of tagDef.attrs) {
    if (att.name === 'spans') {
      // Skip spans - already in basicTag or handled by makeEmptyEtagByDef
    } else if (!tag.hasOwnProperty(att.name)) {
      tag[att.name] = att.default_value
    }
  }

  return tag
}

/**
 * Create an empty entity tag (document-level / non-consuming)
 * @param tagDef - DTD tag definition
 * @returns Empty entity tag with non-consuming spans
 */
export function makeEmptyEtagByDef(tagDef: DtdTag): AnnTag {
  const etag: AnnTag = {
    id: '',
    tag: tagDef.name,
    spans: '',
    text: '',
  }

  // For non-consuming tag (doc-level tag)
  if (tagDef.is_non_consuming) {
    etag.spans = NON_CONSUMING_SPANS
  }

  // Add default values for all attributes
  for (const att of tagDef.attrs) {
    if (att.name === 'spans') {
      // Special rule for spans attr - set to non-consuming
      etag.spans = NON_CONSUMING_SPANS
    } else {
      etag[att.name] = att.default_value
    }
  }

  return etag
}

/**
 * Create an empty relation tag
 * @param tagDef - DTD tag definition
 * @returns Empty relation tag with default attributes
 */
export function makeEmptyRtagByDef(tagDef: DtdTag): AnnTag {
  const rtag: AnnTag = {
    id: '',
    tag: tagDef.name,
  }

  // Add default values for all attributes
  for (const att of tagDef.attrs) {
    if (att.name === 'spans') {
      // Skip spans for rtag
    } else {
      rtag[att.name] = att.default_value
    }
  }

  return rtag
}

/**
 * Get all IDREF attributes from a relation tag definition
 * Used for multi-step relation linking UI
 * @param rtagDef - Relation tag definition
 * @returns Array of IDREF attributes
 */
export function getIdrefAttrs(rtagDef: DtdTag): DtdAttr[] {
  return rtagDef.attrs.filter((att) => att.vtype === 'idref')
}
