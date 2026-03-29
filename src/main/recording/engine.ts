import { join } from 'path'
import { existsSync, copyFileSync } from 'fs'
import { format } from 'date-fns'
import { EventEmitter } from 'events'
import { startCapture, stopCapture, pauseCapture, resumeCapture, destroyCaptureWindow } from './audio-capture'
import { mixTabAndMicAudio, extractTabAudio, convertToMp4, mixMicIntoVideo, convertToWavForTranscription, getAudioDuration } from './encoder'
import { createRecordingDir } from '../storage/file-manager'
import { insertRecording, updateRecording } from '../db/recordings-repo'
import { getConfig } from '../storage/config'
import log from '../utils/logger'
import type { RecordingState, RecordingConfig } from '../utils/constants'

class RecordingEngine extends EventEmitter {
  private _state: RecordingState = 'idle'
  private recordingId: string | null = null
  private recordingDir: string | null = null
  private recordingConfig: RecordingConfig | null = null
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
    this.recordingConfig = config
    this.startTime = Date.now()
    this.pausedDuration = 0
    this.pauseStart = 0

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

    // Start capture — tab video/audio + mic
    startCapture(this.recordingDir, config.recordScreen, config.micDeviceId)

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

    await stopCapture()
    destroyCaptureWindow()

    this.setState('processing')

    const dir = this.recordingDir!
    const id = this.recordingId!
    const config = this.recordingConfig!

    try {
      const tabCapture = join(dir, 'tab_capture.webm')
      const micWebm = join(dir, 'audio_mic.webm')
      const tabAudioWav = join(dir, 'audio_system.wav')
      const micWav = join(dir, 'audio_mic.wav')
      const mixedWav = join(dir, 'audio_mixed.wav')

      // 1. Extract tab audio to WAV (for transcription)
      if (existsSync(tabCapture)) {
        await extractTabAudio(tabCapture, tabAudioWav)
      }

      // 2. Convert mic to WAV
      if (existsSync(micWebm)) {
        await convertToWavForTranscription(micWebm, micWav)
      }

      // 3. Mix tab audio + mic into combined WAV (for playback & transcription)
      if (existsSync(tabAudioWav) && existsSync(micWav)) {
        await mixTabAndMicAudio(tabCapture, micWebm, mixedWav)
      } else if (existsSync(tabAudioWav)) {
        copyFileSync(tabAudioWav, mixedWav)
      } else if (existsSync(micWav)) {
        copyFileSync(micWav, mixedWav)
      }

      // 4. If screen recording, produce a crystal-clear 1080p MP4
      if (config.recordScreen && existsSync(tabCapture)) {
        const mp4Path = join(dir, 'screen.mp4')
        await convertToMp4(tabCapture, mp4Path, config.quality)

        // Also create a version with mic audio mixed in
        if (existsSync(micWebm)) {
          const mp4Mixed = join(dir, 'screen_with_mic.mp4')
          await mixMicIntoVideo(mp4Path, micWebm, mp4Mixed)
        }
      }

      // Get actual duration
      let actualDuration = duration
      if (existsSync(mixedWav)) {
        try {
          actualDuration = Math.round(await getAudioDuration(mixedWav))
        } catch { /* use timer */ }
      }

      updateRecording(id, { duration_seconds: actualDuration })
      this.setState('done')

      // Auto-transcribe
      const appConfig = getConfig()
      if (appConfig.transcription.autoTranscribe) {
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
    this.recordingConfig = null
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
