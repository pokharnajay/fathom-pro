import { BrowserWindow } from 'electron'
import { join } from 'path'
import { existsSync } from 'fs'
import { format } from 'date-fns'
import { EventEmitter } from 'events'
import { startCapture, stopCapture, pauseCapture, resumeCapture, destroyCaptureWindow } from './audio-capture'
import { mixTracks, convertToWavForTranscription, getAudioDuration } from './encoder'
import { createRecordingDir } from '../storage/file-manager'
import { insertRecording, updateRecording } from '../db/recordings-repo'
import { getConfig } from '../storage/config'
import log from '../utils/logger'
import type { RecordingState, RecordingConfig, AudioLevels } from '../utils/constants'

class RecordingEngine extends EventEmitter {
  private _state: RecordingState = 'idle'
  private recordingId: string | null = null
  private recordingDir: string | null = null
  private startTime: number = 0
  private pausedDuration: number = 0
  private pauseStart: number = 0
  private timerInterval: NodeJS.Timeout | null = null

  get state(): RecordingState {
    return this._state
  }

  get elapsedSeconds(): number {
    if (this._state === 'idle') return 0
    if (this._state === 'paused') {
      return Math.floor((this.pauseStart - this.startTime - this.pausedDuration) / 1000)
    }
    return Math.floor((Date.now() - this.startTime - this.pausedDuration) / 1000)
  }

  private setState(newState: RecordingState): void {
    const oldState = this._state
    this._state = newState
    log.info(`Recording state: ${oldState} → ${newState}`)
    this.emit('state-change', newState)
  }

  async start(config: RecordingConfig): Promise<string> {
    if (this._state !== 'idle' && this._state !== 'done') {
      throw new Error(`Cannot start recording in state: ${this._state}`)
    }

    const now = new Date()
    this.recordingId = `rec_${format(now, 'yyyyMMdd_HHmmss')}`
    this.recordingDir = createRecordingDir(now)
    this.startTime = Date.now()
    this.pausedDuration = 0
    this.pauseStart = 0

    // Insert DB record
    insertRecording({
      id: this.recordingId,
      title: `Meeting ${format(now, 'MMM d, yyyy h:mm a')}`,
      date: now.toISOString(),
      duration_seconds: 0,
      file_path: this.recordingDir,
      transcript_status: 'pending',
      summary_status: 'pending',
      clickup_synced: 0,
      created_at: now.toISOString()
    })

    // Start audio capture
    startCapture(this.recordingDir, config.micDeviceId)

    // Start timer that emits elapsed time
    this.timerInterval = setInterval(() => {
      if (this._state === 'recording') {
        this.emit('timer', this.elapsedSeconds)
      }
    }, 1000)

    this.setState('recording')
    return this.recordingId
  }

  pause(): void {
    if (this._state !== 'recording') {
      throw new Error(`Cannot pause in state: ${this._state}`)
    }
    this.pauseStart = Date.now()
    pauseCapture()
    this.setState('paused')
  }

  resume(): void {
    if (this._state !== 'paused') {
      throw new Error(`Cannot resume in state: ${this._state}`)
    }
    this.pausedDuration += Date.now() - this.pauseStart
    this.pauseStart = 0
    resumeCapture()
    this.setState('recording')
  }

  async stop(): Promise<{ id: string; dir: string; duration: number }> {
    if (this._state !== 'recording' && this._state !== 'paused') {
      throw new Error(`Cannot stop in state: ${this._state}`)
    }

    if (this.timerInterval) {
      clearInterval(this.timerInterval)
      this.timerInterval = null
    }

    const duration = this.elapsedSeconds
    this.setState('stopped')

    // Stop audio capture
    await stopCapture()
    destroyCaptureWindow()

    this.setState('processing')

    const dir = this.recordingDir!
    const id = this.recordingId!

    // Process audio files
    try {
      const systemWebm = join(dir, 'audio_system.webm')
      const micWebm = join(dir, 'audio_mic.webm')
      const systemWav = join(dir, 'audio_system.wav')
      const micWav = join(dir, 'audio_mic.wav')
      const mixedWav = join(dir, 'audio_mixed.wav')

      // Convert webm to wav for each track
      if (existsSync(systemWebm)) {
        await convertToWavForTranscription(systemWebm, systemWav)
      }
      if (existsSync(micWebm)) {
        await convertToWavForTranscription(micWebm, micWav)
      }

      // Mix tracks
      if (existsSync(systemWav) && existsSync(micWav)) {
        await mixTracks(systemWav, micWav, mixedWav)
      } else if (existsSync(systemWav)) {
        // Copy system as mixed if no mic
        const { copyFileSync } = require('fs')
        copyFileSync(systemWav, mixedWav)
      } else if (existsSync(micWav)) {
        const { copyFileSync } = require('fs')
        copyFileSync(micWav, mixedWav)
      }

      // Get actual duration from audio
      let actualDuration = duration
      if (existsSync(mixedWav)) {
        try {
          actualDuration = Math.round(await getAudioDuration(mixedWav))
        } catch {
          // fallback to timer duration
        }
      }

      // Update DB record
      updateRecording(id, { duration_seconds: actualDuration })

      this.setState('done')

      // Auto-transcribe if enabled
      const config = getConfig()
      if (config.transcription.autoTranscribe) {
        this.emit('auto-transcribe', id)
      }

      return { id, dir, duration: actualDuration }
    } catch (err) {
      log.error('Post-recording processing failed:', err)
      this.setState('done')
      return { id, dir, duration }
    }
  }

  reset(): void {
    this.recordingId = null
    this.recordingDir = null
    this.startTime = 0
    this.pausedDuration = 0
    this.pauseStart = 0
    if (this.timerInterval) {
      clearInterval(this.timerInterval)
      this.timerInterval = null
    }
    this.setState('idle')
  }

  getCurrentRecordingId(): string | null {
    return this.recordingId
  }
}

export const recordingEngine = new RecordingEngine()
