import { create } from 'zustand'

export type TabKey = 'annotation' | 'statistics' | 'export' | 'adjudication' | 'converter' | 'error-analysis' | 'toolkit'

interface AppState {
  // 当前Tab
  currentTab: TabKey
  setCurrentTab: (tab: TabKey) => void

  // Schema
  dtd: any | null

  // 标注文件列表
  anns: any[]
  annIdx: number | null

  // 编辑器设置
  cm: {
    displayMode: 'document' | 'sentences'
    markMode: 'node' | 'span'
    enabledHints: boolean
    enabledLinks: boolean
  }
}

export const useAppStore = create<AppState>((set) => ({
  currentTab: 'annotation',
  setCurrentTab: (tab) => set({ currentTab: tab }),

  dtd: null,
  anns: [],
  annIdx: null,

  cm: {
    displayMode: 'document',
    markMode: 'node',
    enabledHints: true,
    enabledLinks: true,
  },
}))
