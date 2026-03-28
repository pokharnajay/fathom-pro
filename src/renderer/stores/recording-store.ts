import { create } from 'zustand'

interface RecordingStore {
  state: string
  elapsed: number
  levels: { system: number; mic: number }

  startRecording: () => Promise<void>
  stopRecording: () => Promise<unknown>
  pauseRecording: () => Promise<void>
  resumeRecording: () => Promise<void>
  setElapsed: (s: number) => void
  setLevels: (l: { system: number; mic: number }) => void
  setState: (s: string) => void
}

export const useRecordingStore = create<RecordingStore>((set, get) => ({
  state: 'idle',
  elapsed: 0,
  levels: { system: 0, mic: 0 },

  startRecording: async () => {
    const config = await window.api.config.get()
    await window.api.recording.start({
      quality: config.recording.quality,
      recordScreen: config.recording.recordScreen,
      micDeviceId: config.recording.micDeviceId
    })
  },

  stopRecording: async () => {
    const result = await window.api.recording.stop()
    set({ elapsed: 0, levels: { system: 0, mic: 0 } })
    return result
  },

  pauseRecording: async () => {
    await window.api.recording.pause()
  },

  resumeRecording: async () => {
    await window.api.recording.resume()
  },

  setElapsed: (s) => set({ elapsed: s }),
  setLevels: (l) => set({ levels: l }),
  setState: (s) => set({ state: s })
}))

// Subscribe to IPC events
if (window.api) {
  window.api.onRecordingState((state) => {
    useRecordingStore.getState().setState(state)
  })

  window.api.onRecordingTimer((seconds) => {
    useRecordingStore.getState().setElapsed(seconds)
  })

  window.api.onRecordingLevels((levels) => {
    useRecordingStore.getState().setLevels(levels)
  })
}
