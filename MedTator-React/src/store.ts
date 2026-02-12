import { create } from 'zustand'
import type { Dtd, Ann } from './types'

// ── Exported Types ──

export type TabKey =
  | 'annotation'
  | 'statistics'
  | 'export'
  | 'adjudication'
  | 'converter'
  | 'error-analysis'
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
}))
