import { contextBridge, ipcRenderer } from 'electron'

const api = {
  // ── Recording ──────────────────────────────────────────────────
  recording: {
    start: (config: unknown) => ipcRenderer.invoke('recording:start', config),
    stop: () => ipcRenderer.invoke('recording:stop'),
    pause: () => ipcRenderer.invoke('recording:pause'),
    resume: () => ipcRenderer.invoke('recording:resume'),
    getPermissions: () => ipcRenderer.invoke('recording:permissions')
  },

  onRecordingState: (cb: (state: string) => void) => {
    const handler = (_: unknown, state: string) => cb(state)
    ipcRenderer.on('recording:state', handler)
    return () => ipcRenderer.removeListener('recording:state', handler)
  },

  onRecordingLevels: (cb: (levels: { system: number; mic: number }) => void) => {
    const handler = (_: unknown, levels: { system: number; mic: number }) => cb(levels)
    ipcRenderer.on('recording:levels', handler)
    return () => ipcRenderer.removeListener('recording:levels', handler)
  },

  onRecordingTimer: (cb: (seconds: number) => void) => {
    const handler = (_: unknown, seconds: number) => cb(seconds)
    ipcRenderer.on('recording:timer', handler)
    return () => ipcRenderer.removeListener('recording:timer', handler)
  },

  // ── Database ───────────────────────────────────────────────────
  db: {
    listRecordings: (filters?: unknown) => ipcRenderer.invoke('db:recordings:list', filters),
    getRecording: (id: string) => ipcRenderer.invoke('db:recordings:get', id),
    updateRecording: (id: string, data: unknown) => ipcRenderer.invoke('db:recordings:update', id, data),
    deleteRecording: (id: string) => ipcRenderer.invoke('db:recordings:delete', id),
    search: (query: string) => ipcRenderer.invoke('db:search', query)
  },

  // ── Transcription ──────────────────────────────────────────────
  transcribe: {
    start: (recordingId: string, engine?: string) =>
      ipcRenderer.invoke('transcribe:start', recordingId, engine)
  },

  onTranscribeProgress: (cb: (data: { recordingId: string; percent: number }) => void) => {
    const handler = (_: unknown, data: { recordingId: string; percent: number }) => cb(data)
    ipcRenderer.on('transcribe:progress', handler)
    return () => ipcRenderer.removeListener('transcribe:progress', handler)
  },

  onTranscribeComplete: (cb: (data: { recordingId: string; transcript: unknown }) => void) => {
    const handler = (_: unknown, data: { recordingId: string; transcript: unknown }) => cb(data)
    ipcRenderer.on('transcribe:complete', handler)
    return () => ipcRenderer.removeListener('transcribe:complete', handler)
  },

  // ── AI Summary ─────────────────────────────────────────────────
  ai: {
    summarize: (recordingId: string) => ipcRenderer.invoke('ai:summarize', recordingId)
  },

  onSummaryComplete: (cb: (data: { recordingId: string; summary: unknown }) => void) => {
    const handler = (_: unknown, data: { recordingId: string; summary: unknown }) => cb(data)
    ipcRenderer.on('ai:summary-complete', handler)
    return () => ipcRenderer.removeListener('ai:summary-complete', handler)
  },

  // ── ClickUp ────────────────────────────────────────────────────
  clickup: {
    test: (apiKey: string) => ipcRenderer.invoke('clickup:test', apiKey),
    getLists: () => ipcRenderer.invoke('clickup:lists'),
    push: (recordingId: string, listId?: string) =>
      ipcRenderer.invoke('clickup:push', recordingId, listId)
  },

  // ── Config ─────────────────────────────────────────────────────
  config: {
    get: () => ipcRenderer.invoke('config:get'),
    set: (key: string, value: unknown) => ipcRenderer.invoke('config:set', key, value)
  },

  // ── Window ─────────────────────────────────────────────────────
  window: {
    openLibrary: () => ipcRenderer.invoke('window:open-library'),
    openPrefs: () => ipcRenderer.invoke('window:open-prefs')
  },

  // ── Export ─────────────────────────────────────────────────────
  export: {
    transcript: (recordingId: string, format: string) =>
      ipcRenderer.invoke('export:transcript', recordingId, format),
    summary: (recordingId: string) => ipcRenderer.invoke('export:summary', recordingId),
    audio: (recordingId: string, track: string) =>
      ipcRenderer.invoke('export:audio', recordingId, track)
  },

  // ── Navigation events from main ───────────────────────────────
  onNavigateRecording: (cb: (recordingId: string) => void) => {
    const handler = (_: unknown, id: string) => cb(id)
    ipcRenderer.on('navigate-recording', handler)
    return () => ipcRenderer.removeListener('navigate-recording', handler)
  },

  // ── Capture window helpers (used by hidden capture window) ─────
  onCaptureStart: (cb: (config: unknown) => void) => {
    ipcRenderer.on('capture:start', (_, config) => cb(config))
  },
  onCaptureStop: (cb: () => void) => {
    ipcRenderer.on('capture:stop', () => cb())
  },
  onCapturePause: (cb: () => void) => {
    ipcRenderer.on('capture:pause', () => cb())
  },
  onCaptureResume: (cb: () => void) => {
    ipcRenderer.on('capture:resume', () => cb())
  },
  sendTabData: (data: Uint8Array) => {
    ipcRenderer.send('capture:tab-data', Buffer.from(data))
  },
  sendSystemData: (data: Uint8Array) => {
    ipcRenderer.send('capture:tab-data', Buffer.from(data))
  },
  sendMicData: (data: Uint8Array) => {
    ipcRenderer.send('capture:mic-data', Buffer.from(data))
  },
  sendLevels: (levels: { system: number; mic: number }) => {
    ipcRenderer.send('capture:levels', levels)
  },
  sendCaptureError: (error: string) => {
    ipcRenderer.send('capture:error', error)
  },
  sendCaptureStopped: () => {
    ipcRenderer.send('capture:stopped')
  }
}

contextBridge.exposeInMainWorld('api', api)

export type ElectronAPI = typeof api
