// IPC Channel constants
export const IPC = {
  // Recording
  RECORDING_START: 'recording:start',
  RECORDING_STOP: 'recording:stop',
  RECORDING_PAUSE: 'recording:pause',
  RECORDING_RESUME: 'recording:resume',
  RECORDING_STATE: 'recording:state',
  RECORDING_LEVELS: 'recording:levels',
  RECORDING_PERMISSIONS: 'recording:permissions',

  // Database
  DB_RECORDINGS_LIST: 'db:recordings:list',
  DB_RECORDINGS_GET: 'db:recordings:get',
  DB_RECORDINGS_UPDATE: 'db:recordings:update',
  DB_RECORDINGS_DELETE: 'db:recordings:delete',
  DB_SEARCH: 'db:search',

  // Transcription
  TRANSCRIBE_START: 'transcribe:start',
  TRANSCRIBE_PROGRESS: 'transcribe:progress',
  TRANSCRIBE_COMPLETE: 'transcribe:complete',

  // AI Summary
  AI_SUMMARIZE: 'ai:summarize',
  AI_SUMMARY_COMPLETE: 'ai:summary-complete',

  // ClickUp
  CLICKUP_TEST: 'clickup:test',
  CLICKUP_LISTS: 'clickup:lists',
  CLICKUP_PUSH: 'clickup:push',

  // Config
  CONFIG_GET: 'config:get',
  CONFIG_SET: 'config:set',

  // Window
  WINDOW_OPEN_LIBRARY: 'window:open-library',
  WINDOW_OPEN_PREFS: 'window:open-prefs',
  WINDOW_CLOSE_OVERLAY: 'window:close-overlay',

  // Export
  EXPORT_TRANSCRIPT: 'export:transcript',
  EXPORT_AUDIO: 'export:audio',
  EXPORT_SUMMARY: 'export:summary',

  // Mic devices
  GET_AUDIO_DEVICES: 'get:audio-devices'
} as const

export type RecordingState = 'idle' | 'recording' | 'paused' | 'stopped' | 'processing' | 'done'

export type TranscriptStatus = 'pending' | 'processing' | 'done' | 'failed'
export type SummaryStatus = 'pending' | 'processing' | 'done' | 'failed'

export type QualityPreset = 'standard' | 'high' | 'lossless'

export interface RecordingConfig {
  quality: QualityPreset
  recordScreen: boolean
  micDeviceId?: string
}

export interface AudioLevels {
  system: number
  mic: number
}

export interface RecordingRow {
  id: string
  title: string
  date: string
  duration_seconds: number
  file_path: string
  transcript_status: TranscriptStatus
  summary_status: SummaryStatus
  clickup_synced: number
  created_at: string
}

export interface TranscriptSegment {
  speaker: string
  start: number
  end: number
  text: string
  confidence: number
}

export interface Transcript {
  recording_id: string
  duration_seconds: number
  speakers: { id: string; label: string }[]
  segments: TranscriptSegment[]
  engine: string
  created_at: string
}

export interface Summary {
  recording_id: string
  summary: string
  decisions: string[]
  action_items: { assignee: string; task: string; deadline: string | null }[]
  open_questions: string[]
  created_at: string
}

export interface AppConfig {
  recording: {
    quality: QualityPreset
    recordScreen: boolean
    micDeviceId: string
    storagePath: string
  }
  transcription: {
    engine: 'whisper' | 'deepgram'
    deepgramApiKey: string
    autoTranscribe: boolean
  }
  ai: {
    autoSummarize: boolean
    claudeApiKey: string
  }
  clickup: {
    apiKey: string
    defaultListId: string
    autoPush: boolean
  }
  shortcuts: {
    toggleRecording: string
    openLibrary: string
  }
}

export const DEFAULT_CONFIG: AppConfig = {
  recording: {
    quality: 'standard',
    recordScreen: false,
    micDeviceId: 'default',
    storagePath: ''
  },
  transcription: {
    engine: 'whisper',
    deepgramApiKey: '',
    autoTranscribe: true
  },
  ai: {
    autoSummarize: true,
    claudeApiKey: ''
  },
  clickup: {
    apiKey: '',
    defaultListId: '',
    autoPush: false
  },
  shortcuts: {
    toggleRecording: 'Alt+Shift+R',
    openLibrary: 'Alt+Shift+L'
  }
}

export const APP_NAME = 'MeetRec'
export const STORAGE_DIR_NAME = 'MeetRec'
