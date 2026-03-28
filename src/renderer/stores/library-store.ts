import { create } from 'zustand'

export interface Recording {
  id: string
  title: string
  date: string
  duration_seconds: number
  file_path: string
  transcript_status: string
  summary_status: string
  clickup_synced: number
  created_at: string
  transcript?: Transcript | null
  summary?: Summary | null
}

export interface Transcript {
  recording_id: string
  duration_seconds: number
  speakers: { id: string; label: string }[]
  segments: TranscriptSegment[]
  engine: string
  created_at: string
}

export interface TranscriptSegment {
  speaker: string
  start: number
  end: number
  text: string
  confidence: number
}

export interface Summary {
  recording_id: string
  summary: string
  decisions: string[]
  action_items: { assignee: string; task: string; deadline: string | null }[]
  open_questions: string[]
  created_at: string
}

export interface SearchResult {
  recording_id: string
  speaker: string
  text: string
  start_time: number
  rank: number
}

interface LibraryStore {
  recordings: Recording[]
  selectedId: string | null
  selectedRecording: Recording | null
  dateFilter: 'all' | 'week' | 'month'
  searchQuery: string
  searchResults: SearchResult[]
  isLoading: boolean
  transcribeProgress: Record<string, number>

  fetchRecordings: () => Promise<void>
  selectRecording: (id: string | null) => Promise<void>
  deleteRecording: (id: string) => Promise<void>
  setDateFilter: (f: 'all' | 'week' | 'month') => void
  setSearchQuery: (q: string) => void
  search: (q: string) => Promise<void>
  setTranscribeProgress: (recordingId: string, percent: number) => void
  refreshSelected: () => Promise<void>
}

export const useLibraryStore = create<LibraryStore>((set, get) => ({
  recordings: [],
  selectedId: null,
  selectedRecording: null,
  dateFilter: 'all',
  searchQuery: '',
  searchResults: [],
  isLoading: false,
  transcribeProgress: {},

  fetchRecordings: async () => {
    set({ isLoading: true })
    try {
      const { dateFilter } = get()
      const recordings = await window.api.db.listRecordings({
        dateRange: dateFilter
      })
      set({ recordings, isLoading: false })
    } catch {
      set({ isLoading: false })
    }
  },

  selectRecording: async (id) => {
    if (!id) {
      set({ selectedId: null, selectedRecording: null })
      return
    }
    set({ selectedId: id })
    try {
      const rec = await window.api.db.getRecording(id)
      set({ selectedRecording: rec })
    } catch {
      set({ selectedRecording: null })
    }
  },

  deleteRecording: async (id) => {
    await window.api.db.deleteRecording(id)
    const { selectedId } = get()
    if (selectedId === id) {
      set({ selectedId: null, selectedRecording: null })
    }
    await get().fetchRecordings()
  },

  setDateFilter: (f) => {
    set({ dateFilter: f })
    get().fetchRecordings()
  },

  setSearchQuery: (q) => set({ searchQuery: q }),

  search: async (q) => {
    if (!q.trim()) {
      set({ searchResults: [] })
      return
    }
    try {
      const results = await window.api.db.search(q)
      set({ searchResults: results })
    } catch {
      set({ searchResults: [] })
    }
  },

  setTranscribeProgress: (recordingId, percent) => {
    set((state) => ({
      transcribeProgress: { ...state.transcribeProgress, [recordingId]: percent }
    }))
  },

  refreshSelected: async () => {
    const { selectedId } = get()
    if (selectedId) {
      await get().selectRecording(selectedId)
    }
    await get().fetchRecordings()
  }
}))

// Subscribe to IPC events
if (window.api) {
  window.api.onTranscribeProgress((data) => {
    useLibraryStore.getState().setTranscribeProgress(data.recordingId, data.percent)
  })

  window.api.onTranscribeComplete(() => {
    useLibraryStore.getState().refreshSelected()
  })

  window.api.onSummaryComplete(() => {
    useLibraryStore.getState().refreshSelected()
  })

  window.api.onNavigateRecording((id) => {
    useLibraryStore.getState().selectRecording(id)
  })
}
