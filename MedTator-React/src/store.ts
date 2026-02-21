import { create } from 'zustand'
import type { Dtd, Ann, AnnTag, DtdTag, DtdAttr } from './types'
import { getNextTagId, anns2hintDict, addTagToHintDict } from './parsers/ann-parser'
import { mkBaseDtd } from './parsers/dtd-parser'
import type { HintDict } from './parsers/ann-parser'
import { makeEtag } from './utils/tag-helper'
import type { OllamaConfig } from './utils/ollama-client'
import { DEFAULT_OLLAMA_CONFIG, requestAutoAnnotation } from './utils/ollama-client'
import { llmAnnotationsToTags } from './utils/auto-annotate'

// ── Exported Types ──

export type TabKey =
  | 'annotation'
  | 'statistics'
  | 'export'
  | 'adjudication'
  | 'converter'
  | 'toolkit'

export type SortAnnsBy =
  | 'default'
  | 'alphabet'
  | 'alphabet_r'
  | 'tags'
  | 'tags_r'
  | 'label'

export interface CmSettings {
  displayMode: 'document' | 'sentences'
  markMode: 'node' | 'span'
  hintMode: 'simple' | 'smart'
  enabledHints: boolean
  enabledLinks: boolean
  enabledLinkName: boolean
  enabledLinkComplex: boolean
}

// ── State Interface ──

interface AppState {
  // ─ Tab ─
  currentTab: TabKey
  setCurrentTab: (tab: TabKey) => void

  // ─ Schema (DTD) ─
  dtd: Dtd | null
  setDtd: (dtd: Dtd | null) => void

  // ─ Annotation Files ─
  anns: Ann[]
  annIdx: number | null
  setAnns: (anns: Ann[]) => void
  setAnnIdx: (idx: number | null) => void
  addAnns: (newAnns: Ann[]) => void
  removeAnn: (idx: number) => void
  clearAnns: () => void

  // ─ File List Control ─
  sortAnnsBy: SortAnnsBy
  fnPattern: string
  pgIndex: number
  pgNumPerPage: number
  setSortAnnsBy: (sort: SortAnnsBy) => void
  setFnPattern: (pattern: string) => void
  setPgIndex: (idx: number) => void

  // ─ Tag Display Filter ─
  displayTagName: string
  setDisplayTagName: (name: string) => void

  // ─ Tag Operations ─
  addTag: (tag: AnnTag) => void
  removeTag: (tagId: string) => boolean
  updateTagAttr: (tagId: string, attr: string, value: any) => void
  setAnnSaved: () => void
  setAnnUnsaved: () => void

  // ─ Tag Selection ─
  selectedTagId: string | null
  setSelectedTagId: (tagId: string | null) => void

  // ─ Relation Linking State Machine ─
  isLinking: boolean
  linkingTagDef: DtdTag | null
  linkingTag: Partial<AnnTag> | null
  linkingAtts: DtdAttr[]
  startLinking: (rtagDef: DtdTag, firstEntityId: string) => void
  setLinking: (attIndex: number, entityId: string) => void
  updateLinkingAttr: (attrName: string, value: string) => void
  doneLinking: () => void
  cancelLinking: () => void

  // ─ Hint System ─
  hintDict: HintDict
  hints: AnnTag[]
  rebuildHintDict: () => void
  setHints: (hints: AnnTag[]) => void
  acceptHint: (hintId: string) => void
  acceptAllHints: () => void

  // ─ Loading Progress ─
  isLoadingAnns: boolean
  nAnnsDropped: number
  nAnnsLoaded: number
  nAnnsError: number
  msgLoadingAnns: string
  startLoading: (nDropped: number) => void
  updateLoading: (loaded: number, error: number, msg: string) => void
  finishLoading: () => void

  // ─ CodeMirror Settings ─
  cm: CmSettings
  setCm: (update: Partial<CmSettings>) => void

  // ─ Schema Editor ─
  seDtd: Dtd | null
  seOpen: boolean
  openSchemaEditorNew: () => void
  openSchemaEditorCopy: () => void
  openSchemaEditorLoad: (dtd: Dtd) => void
  closeSchemaEditor: () => void
  setSeDtd: (dtd: Dtd) => void

  // ─ LLM Auto-Annotate ─
  ollamaConfig: OllamaConfig
  isAutoAnnotating: boolean
  setOllamaConfig: (config: Partial<OllamaConfig>) => void
  autoAnnotate: () => Promise<number>
}

// ── Store ──

export const useAppStore = create<AppState>((set, get) => ({
  // ─ Tab ─
  currentTab: 'annotation',
  setCurrentTab: (tab) => set({ currentTab: tab }),

  // ─ Schema ─
  dtd: null,
  setDtd: (dtd) => set({ dtd }),

  // ─ Annotation Files ─
  anns: [],
  annIdx: null,
  setAnns: (anns) => set({
    anns,
    annIdx: anns.length > 0 ? 0 : null,
    pgIndex: 0,
  }),
  setAnnIdx: (idx) => set({ annIdx: idx }),
  addAnns: (newAnns) => {
    const { anns, annIdx } = get()
    const merged = [...anns, ...newAnns]
    set({
      anns: merged,
      annIdx: annIdx === null && merged.length > 0 ? 0 : annIdx,
    })
  },
  removeAnn: (idx) => {
    const { anns, annIdx } = get()
    const next = anns.filter((_, i) => i !== idx)
    let nextIdx = annIdx
    if (next.length === 0) {
      nextIdx = null
    } else if (annIdx !== null && annIdx >= next.length) {
      nextIdx = next.length - 1
    }
    set({ anns: next, annIdx: nextIdx })
  },
  clearAnns: () => set({ anns: [], annIdx: null, pgIndex: 0 }),

  // ─ File List Control ─
  sortAnnsBy: 'default',
  fnPattern: '',
  pgIndex: 0,
  pgNumPerPage: 100,
  setSortAnnsBy: (sort) => set({ sortAnnsBy: sort, pgIndex: 0 }),
  setFnPattern: (pattern) => set({ fnPattern: pattern, pgIndex: 0 }),
  setPgIndex: (idx) => set({ pgIndex: idx }),

  // ─ Tag Display Filter ─
  displayTagName: '__all__',
  setDisplayTagName: (name) => set({ displayTagName: name }),

  // ─ Tag Operations ─
  addTag: (tag) => {
    const { anns, annIdx } = get()
    if (annIdx === null) return

    const ann = anns[annIdx]
    ann.tags.push(tag)
    ann._has_saved = false

    set({ anns: [...anns] }) // Trigger re-render
  },

  removeTag: (tagId) => {
    const { anns, annIdx } = get()
    if (annIdx === null) return false

    const ann = anns[annIdx]
    const tagIdx = ann.tags.findIndex((t) => t.id === tagId)

    if (tagIdx === -1) return false

    ann.tags.splice(tagIdx, 1)
    ann._has_saved = false

    set({ anns: [...anns], selectedTagId: null }) // Trigger re-render
    return true
  },

  updateTagAttr: (tagId, attr, value) => {
    const { anns, annIdx } = get()
    if (annIdx === null) return

    const ann = anns[annIdx]
    const tag = ann.tags.find((t) => t.id === tagId)

    if (!tag) return

    tag[attr] = value
    ann._has_saved = false

    set({ anns: [...anns] }) // Trigger re-render
  },

  setAnnSaved: () => {
    const { anns, annIdx } = get()
    if (annIdx === null) return

    anns[annIdx]._has_saved = true
    set({ anns: [...anns] })
  },

  setAnnUnsaved: () => {
    const { anns, annIdx } = get()
    if (annIdx === null) return

    anns[annIdx]._has_saved = false
    set({ anns: [...anns] })
  },

  // ─ Tag Selection ─
  selectedTagId: null,
  setSelectedTagId: (tagId) => set({ selectedTagId: tagId }),

  // ─ Relation Linking State Machine ─
  isLinking: false,
  linkingTagDef: null,
  linkingTag: null,
  linkingAtts: [],

  startLinking: (rtagDef, firstEntityId) => {
    const { annIdx } = get()
    if (annIdx === null) return

    const idrefAttrs = rtagDef.attrs.filter((att) => att.vtype === 'idref')

    // Create partial rtag with ALL attributes set to defaults
    const partialTag: Partial<AnnTag> = {
      tag: rtagDef.name,
    }

    for (const att of rtagDef.attrs) {
      if (att.name === 'spans') continue
      partialTag[att.name] = att.default_value
    }

    // Override first IDREF attribute with clicked entity
    if (idrefAttrs.length > 0) {
      partialTag[idrefAttrs[0].name] = firstEntityId
    }

    set({
      isLinking: true,
      linkingTagDef: rtagDef,
      linkingTag: partialTag,
      linkingAtts: idrefAttrs.slice(1), // Remove first (already consumed)
    })
  },

  setLinking: (attIndex, entityId) => {
    const { linkingTag, linkingAtts } = get()
    if (!linkingTag || attIndex >= linkingAtts.length) return

    const updatedTag = {
      ...linkingTag,
      [linkingAtts[attIndex].name]: entityId,
    }

    const remainingAtts = linkingAtts.filter((_, i) => i !== attIndex)

    // Update tag and remaining attrs
    set({ linkingTag: updatedTag, linkingAtts: remainingAtts })

    // Auto-complete if all IDREFs filled
    if (remainingAtts.length === 0) {
      get().doneLinking()
    }
  },

  updateLinkingAttr: (attrName, value) => {
    const { linkingTag } = get()
    if (!linkingTag) return
    set({ linkingTag: { ...linkingTag, [attrName]: value } })
  },

  doneLinking: () => {
    const { anns, annIdx, linkingTag, linkingTagDef } = get()
    if (annIdx === null || !linkingTag || !linkingTagDef) return

    const ann = anns[annIdx]

    const completeTag: AnnTag = {
      id: getNextTagId(ann, linkingTagDef),
      tag: linkingTagDef.name,
      ...linkingTag,
    }

    ann.tags.push(completeTag)
    ann._has_saved = false

    set({
      anns: [...anns],
      isLinking: false,
      linkingTagDef: null,
      linkingTag: null,
      linkingAtts: [],
    })
  },

  cancelLinking: () => {
    set({
      isLinking: false,
      linkingTagDef: null,
      linkingTag: null,
      linkingAtts: [],
    })
  },

  // ─ Hint System ─
  hintDict: {},
  hints: [],

  rebuildHintDict: () => {
    const { dtd, anns } = get()
    if (!dtd) {
      set({ hintDict: {}, hints: [] })
      return
    }
    const dict = anns2hintDict(dtd, anns)
    set({ hintDict: dict })
  },

  setHints: (hints) => set({ hints }),

  acceptHint: (hintId) => {
    const { hints, anns, annIdx, dtd, hintDict } = get()
    if (annIdx === null || !dtd) return

    const hint = hints.find(h => h.id === hintId)
    if (!hint) return

    const ann = anns[annIdx]
    const tagDef = dtd.tag_dict[hint.tag]
    if (!tagDef || tagDef.type !== 'etag') return

    const tag = makeEtag(
      { spans: hint.spans!, text: hint.text! },
      tagDef,
      ann
    )

    ann.tags.push(tag)
    ann._has_saved = false

    // Incrementally update hint dict
    addTagToHintDict(ann, tag, hintDict)

    // Remove accepted hint
    const newHints = hints.filter(h => h.id !== hintId)

    set({ anns: [...anns], hints: newHints, hintDict: { ...hintDict } })
  },

  acceptAllHints: () => {
    const { hints, anns, annIdx, dtd, hintDict } = get()
    if (annIdx === null || !dtd || hints.length === 0) return

    const ann = anns[annIdx]

    for (const hint of hints) {
      const tagDef = dtd.tag_dict[hint.tag]
      if (!tagDef || tagDef.type !== 'etag') continue

      const tag = makeEtag(
        { spans: hint.spans!, text: hint.text! },
        tagDef,
        ann
      )

      ann.tags.push(tag)
      addTagToHintDict(ann, tag, hintDict)
    }

    ann._has_saved = false
    set({ anns: [...anns], hints: [], hintDict: { ...hintDict } })
  },

  // ─ Loading Progress ─
  isLoadingAnns: false,
  nAnnsDropped: 0,
  nAnnsLoaded: 0,
  nAnnsError: 0,
  msgLoadingAnns: '',
  startLoading: (nDropped) => set({
    isLoadingAnns: true,
    nAnnsDropped: nDropped,
    nAnnsLoaded: 0,
    nAnnsError: 0,
    msgLoadingAnns: `Loading 0/${nDropped} files...`,
  }),
  updateLoading: (loaded, error, msg) => set({
    nAnnsLoaded: loaded,
    nAnnsError: error,
    msgLoadingAnns: msg,
  }),
  finishLoading: () => set({
    isLoadingAnns: false,
    msgLoadingAnns: '',
  }),

  // ─ CodeMirror Settings ─
  cm: {
    displayMode: 'document',
    markMode: 'node',
    hintMode: 'simple',
    enabledHints: true,
    enabledLinks: true,
    enabledLinkName: true,
    enabledLinkComplex: true,
  },
  setCm: (update) => set((s) => ({ cm: { ...s.cm, ...update } })),

  // ─ Schema Editor ─
  seDtd: null,
  seOpen: false,
  openSchemaEditorNew: () => set({ seDtd: mkBaseDtd('NEW_SCHEMA'), seOpen: true }),
  openSchemaEditorCopy: () => {
    const { dtd } = get()
    const seDtd = dtd ? JSON.parse(JSON.stringify(dtd)) : mkBaseDtd('NEW_SCHEMA')
    set({ seDtd, seOpen: true })
  },
  openSchemaEditorLoad: (dtd) => set({ seDtd: dtd, seOpen: true }),
  closeSchemaEditor: () => set({ seOpen: false }),
  setSeDtd: (dtd) => set({ seDtd: dtd }),

  // ─ LLM Auto-Annotate ─
  ollamaConfig: { ...DEFAULT_OLLAMA_CONFIG },
  isAutoAnnotating: false,
  setOllamaConfig: (config) => set((s) => ({ ollamaConfig: { ...s.ollamaConfig, ...config } })),
  autoAnnotate: async () => {
    const { anns, annIdx, dtd } = get()
    if (annIdx === null || !dtd) return 0

    set({ isAutoAnnotating: true })
    try {
      const ann = anns[annIdx]
      const etagNames = dtd.etags.map((t) => t.name)
      const llmResult = await requestAutoAnnotation(get().ollamaConfig, ann.text, etagNames)
      const newTags = llmAnnotationsToTags(llmResult, ann, dtd)

      for (const tag of newTags) {
        ann.tags.push(tag)
      }
      if (newTags.length > 0) ann._has_saved = false

      set({ anns: [...anns] })
      return newTags.length
    } finally {
      set({ isAutoAnnotating: false })
    }
  },
}))
