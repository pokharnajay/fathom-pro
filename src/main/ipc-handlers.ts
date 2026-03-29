import { ipcMain, dialog, Notification, BrowserWindow } from 'electron'
import { readFileSync, writeFileSync, existsSync, unlinkSync, rmSync } from 'fs'
import { join } from 'path'
import { IPC } from './utils/constants'
import { recordingEngine } from './recording/engine'
import { checkPermissions, requestPermissions } from './recording/permissions'
import {
  listRecordings,
  getRecording,
  updateRecording,
  deleteRecording,
  type ListFilters
} from './db/recordings-repo'
import { searchTranscripts, indexTranscript } from './db/search-repo'
import { getConfig, setConfigValue, updateConfig } from './storage/config'
import { createLibraryWindow, createPreferencesWindow, createOverlayWindow, closeOverlayWindow, sendToAllWindows } from './windows'
import { transcribeWithWhisper } from './transcription/whisper'
import { transcribeWithDeepgram } from './transcription/deepgram'
import { generateSummary } from './ai/claude-summary'
import { testConnection, getAllLists, pushActionItems } from './integrations/clickup'
import { convertToWavForTranscription } from './recording/encoder'
import log from './utils/logger'
import type { RecordingConfig, Transcript, Summary, AppConfig } from './utils/constants'

export function registerIpcHandlers(): void {
  // ── Recording ──────────────────────────────────────────────────
  ipcMain.handle(IPC.RECORDING_START, async (_event, config: RecordingConfig) => {
    const id = await recordingEngine.start(config)
    createOverlayWindow()
    return id
  })

  ipcMain.handle(IPC.RECORDING_STOP, async () => {
    const result = await recordingEngine.stop()
    closeOverlayWindow()

    // Show notification
    new Notification({
      title: 'Recording Complete',
      body: `Saved ${Math.floor(result.duration / 60)}m ${result.duration % 60}s recording`
    }).show()

    recordingEngine.reset()
    return result
  })

  ipcMain.handle(IPC.RECORDING_PAUSE, () => {
    recordingEngine.pause()
  })

  ipcMain.handle(IPC.RECORDING_RESUME, () => {
    recordingEngine.resume()
  })

  ipcMain.handle(IPC.RECORDING_PERMISSIONS, async () => {
    return await requestPermissions()
  })

  // Forward recording state + levels to all renderer windows
  recordingEngine.on('state-change', (state) => {
    sendToAllWindows(IPC.RECORDING_STATE, state)
  })

  recordingEngine.on('timer', (seconds) => {
    sendToAllWindows('recording:timer', seconds)
  })

  ipcMain.on('capture:levels', (_event, levels) => {
    sendToAllWindows(IPC.RECORDING_LEVELS, levels)
  })

  // ── Database ───────────────────────────────────────────────────
  ipcMain.handle(IPC.DB_RECORDINGS_LIST, (_event, filters?: ListFilters) => {
    return listRecordings(filters)
  })

  ipcMain.handle(IPC.DB_RECORDINGS_GET, (_event, id: string) => {
    const rec = getRecording(id)
    if (!rec) return null

    // Also load transcript and summary if available
    const dir = rec.file_path
    let transcript: Transcript | null = null
    let summary: Summary | null = null

    const transcriptPath = join(dir, 'transcript.json')
    if (existsSync(transcriptPath)) {
      try {
        transcript = JSON.parse(readFileSync(transcriptPath, 'utf-8'))
      } catch { /* ignore */ }
    }

    const summaryPath = join(dir, 'summary.json')
    if (existsSync(summaryPath)) {
      try {
        summary = JSON.parse(readFileSync(summaryPath, 'utf-8'))
      } catch { /* ignore */ }
    }

    return { ...rec, transcript, summary }
  })

  ipcMain.handle(IPC.DB_RECORDINGS_UPDATE, (_event, id: string, data: Record<string, unknown>) => {
    updateRecording(id, data)
    return true
  })

  ipcMain.handle(IPC.DB_RECORDINGS_DELETE, (_event, id: string) => {
    const rec = getRecording(id)
    if (rec?.file_path && existsSync(rec.file_path)) {
      try {
        rmSync(rec.file_path, { recursive: true, force: true })
      } catch (err) {
        log.error('Failed to delete recording files:', err)
      }
    }
    deleteRecording(id)
    return true
  })

  ipcMain.handle(IPC.DB_SEARCH, (_event, query: string) => {
    return searchTranscripts(query)
  })

  // ── Transcription ──────────────────────────────────────────────
  ipcMain.handle(IPC.TRANSCRIBE_START, async (_event, recordingId: string, engine?: string) => {
    const rec = getRecording(recordingId)
    if (!rec) throw new Error('Recording not found')

    const config = getConfig()
    const selectedEngine = engine || config.transcription.engine

    updateRecording(recordingId, { transcript_status: 'processing' })
    sendToAllWindows(IPC.TRANSCRIBE_PROGRESS, { recordingId, percent: 0 })

    try {
      // Find the audio file to transcribe
      const dir = rec.file_path
      let audioPath = join(dir, 'audio_mixed.wav')

      if (!existsSync(audioPath)) {
        // Try webm and convert
        const webmPath = join(dir, 'audio_mixed.webm')
        if (existsSync(webmPath)) {
          await convertToWavForTranscription(webmPath, audioPath)
        } else {
          // Try system audio
          const sysPath = join(dir, 'audio_system.wav')
          const sysWebm = join(dir, 'audio_system.webm')
          if (existsSync(sysPath)) {
            audioPath = sysPath
          } else if (existsSync(sysWebm)) {
            audioPath = join(dir, 'audio_system_16k.wav')
            await convertToWavForTranscription(sysWebm, audioPath)
          } else {
            throw new Error('No audio file found for transcription')
          }
        }
      }

      let transcript: Transcript

      if (selectedEngine === 'deepgram') {
        if (!config.transcription.deepgramApiKey) {
          throw new Error('Deepgram API key not configured')
        }
        transcript = await transcribeWithDeepgram(
          audioPath,
          recordingId,
          config.transcription.deepgramApiKey,
          (percent) => sendToAllWindows(IPC.TRANSCRIBE_PROGRESS, { recordingId, percent })
        )
      } else {
        transcript = await transcribeWithWhisper(
          audioPath,
          recordingId,
          (percent) => sendToAllWindows(IPC.TRANSCRIBE_PROGRESS, { recordingId, percent })
        )
      }

      // Save transcript
      const transcriptPath = join(dir, 'transcript.json')
      writeFileSync(transcriptPath, JSON.stringify(transcript, null, 2), 'utf-8')

      // Index for FTS
      indexTranscript(recordingId, transcript.segments)

      // Update title from transcript content
      if (transcript.segments.length > 0) {
        const firstWords = transcript.segments
          .slice(0, 3)
          .map((s) => s.text)
          .join(' ')
          .slice(0, 80)
        if (firstWords) {
          updateRecording(recordingId, { title: firstWords + '...' })
        }
      }

      updateRecording(recordingId, { transcript_status: 'done' })
      sendToAllWindows(IPC.TRANSCRIBE_COMPLETE, { recordingId, transcript })

      new Notification({
        title: 'Transcription Complete',
        body: `Transcript ready for "${rec.title}"`
      }).show()

      // Auto-summarize if enabled (uses Claude Code CLI, no API key needed)
      if (config.ai.autoSummarize) {
        autoSummarize(recordingId, transcript, config)
      }

      return transcript
    } catch (err) {
      log.error('Transcription failed:', err)
      updateRecording(recordingId, { transcript_status: 'failed' })
      sendToAllWindows(IPC.TRANSCRIBE_PROGRESS, { recordingId, percent: -1 })
      throw err
    }
  })

  // ── AI Summary ─────────────────────────────────────────────────
  ipcMain.handle(IPC.AI_SUMMARIZE, async (_event, recordingId: string) => {
    const rec = getRecording(recordingId)
    if (!rec) throw new Error('Recording not found')

    const config = getConfig()
    const transcriptPath = join(rec.file_path, 'transcript.json')
    if (!existsSync(transcriptPath)) throw new Error('No transcript found')

    const transcript = JSON.parse(readFileSync(transcriptPath, 'utf-8')) as Transcript
    await autoSummarize(recordingId, transcript, config)
  })

  // ── ClickUp ────────────────────────────────────────────────────
  ipcMain.handle(IPC.CLICKUP_TEST, async (_event, apiKey: string) => {
    return await testConnection(apiKey)
  })

  ipcMain.handle(IPC.CLICKUP_LISTS, async () => {
    const config = getConfig()
    if (!config.clickup.apiKey) return []
    return await getAllLists(config.clickup.apiKey)
  })

  ipcMain.handle(IPC.CLICKUP_PUSH, async (_event, recordingId: string, listId?: string) => {
    const rec = getRecording(recordingId)
    if (!rec) throw new Error('Recording not found')

    const config = getConfig()
    if (!config.clickup.apiKey) throw new Error('ClickUp API key not configured')

    const targetListId = listId || config.clickup.defaultListId
    if (!targetListId) throw new Error('No ClickUp list selected')

    const summaryPath = join(rec.file_path, 'summary.json')
    if (!existsSync(summaryPath)) throw new Error('No summary found')

    const summary = JSON.parse(readFileSync(summaryPath, 'utf-8')) as Summary
    const taskIds = await pushActionItems(
      config.clickup.apiKey,
      targetListId,
      summary.action_items,
      rec.title
    )

    updateRecording(recordingId, { clickup_synced: 1 })

    new Notification({
      title: 'Tasks Created in ClickUp',
      body: `${taskIds.length} action items pushed`
    }).show()

    return taskIds
  })

  // ── Config ─────────────────────────────────────────────────────
  ipcMain.handle(IPC.CONFIG_GET, () => {
    return getConfig()
  })

  ipcMain.handle(IPC.CONFIG_SET, (_event, key: string, value: unknown) => {
    setConfigValue(key, value)
    return true
  })

  // ── Window ─────────────────────────────────────────────────────
  ipcMain.handle(IPC.WINDOW_OPEN_LIBRARY, () => {
    createLibraryWindow()
  })

  ipcMain.handle(IPC.WINDOW_OPEN_PREFS, () => {
    createPreferencesWindow()
  })

  // ── Export ─────────────────────────────────────────────────────
  ipcMain.handle(IPC.EXPORT_TRANSCRIPT, async (_event, recordingId: string, format: string) => {
    const rec = getRecording(recordingId)
    if (!rec) throw new Error('Recording not found')

    const transcriptPath = join(rec.file_path, 'transcript.json')
    if (!existsSync(transcriptPath)) throw new Error('No transcript found')

    const transcript = JSON.parse(readFileSync(transcriptPath, 'utf-8')) as Transcript

    const { canceled, filePath } = await dialog.showSaveDialog({
      defaultPath: `${rec.title || 'transcript'}.${format}`,
      filters: [{ name: format.toUpperCase(), extensions: [format] }]
    })

    if (canceled || !filePath) return null

    let content: string

    if (format === 'json') {
      content = JSON.stringify(transcript, null, 2)
    } else if (format === 'srt') {
      content = transcriptToSrt(transcript)
    } else if (format === 'md') {
      content = transcriptToMarkdown(transcript)
    } else {
      // txt
      content = transcript.segments
        .map((s) => `[${formatTime(s.start)}] ${s.speaker}: ${s.text}`)
        .join('\n')
    }

    writeFileSync(filePath, content, 'utf-8')
    return filePath
  })

  ipcMain.handle(IPC.EXPORT_SUMMARY, async (_event, recordingId: string) => {
    const rec = getRecording(recordingId)
    if (!rec) throw new Error('Recording not found')

    const summaryPath = join(rec.file_path, 'summary.json')
    if (!existsSync(summaryPath)) throw new Error('No summary found')

    const summary = JSON.parse(readFileSync(summaryPath, 'utf-8')) as Summary

    const { canceled, filePath } = await dialog.showSaveDialog({
      defaultPath: `${rec.title || 'summary'}.md`,
      filters: [{ name: 'Markdown', extensions: ['md'] }]
    })

    if (canceled || !filePath) return null

    const content = summaryToMarkdown(summary, rec.title)
    writeFileSync(filePath, content, 'utf-8')
    return filePath
  })

  ipcMain.handle(IPC.EXPORT_AUDIO, async (_event, recordingId: string, track: string) => {
    const rec = getRecording(recordingId)
    if (!rec) throw new Error('Recording not found')

    const trackFile = join(rec.file_path, `audio_${track}.wav`)
    if (!existsSync(trackFile)) throw new Error(`Track not found: ${track}`)

    const { canceled, filePath } = await dialog.showSaveDialog({
      defaultPath: `${rec.title || 'audio'}_${track}.wav`,
      filters: [{ name: 'WAV Audio', extensions: ['wav'] }]
    })

    if (canceled || !filePath) return null

    const { copyFileSync } = require('fs')
    copyFileSync(trackFile, filePath)
    return filePath
  })

  // ── Audio devices ──────────────────────────────────────────────
  ipcMain.handle(IPC.GET_AUDIO_DEVICES, async () => {
    // This needs to run in a renderer context; return empty for now
    // The renderer will enumerate devices itself
    return []
  })

  // ── Auto-transcribe hook ───────────────────────────────────────
  recordingEngine.on('auto-transcribe', async (recordingId: string) => {
    try {
      const config = getConfig()
      const rec = getRecording(recordingId)
      if (!rec) return

      log.info('Auto-transcribing recording:', recordingId)

      // Small delay to let files finish writing
      setTimeout(async () => {
        try {
          // Trigger transcription via the same handler
          const event = { sender: { send: () => {} } }
          await ipcMain.emit(IPC.TRANSCRIBE_START, event, recordingId)
        } catch (err) {
          log.error('Auto-transcribe failed:', err)
        }
      }, 2000)
    } catch (err) {
      log.error('Auto-transcribe setup failed:', err)
    }
  })
}

async function autoSummarize(recordingId: string, transcript: Transcript, config: AppConfig): Promise<void> {
  try {
    updateRecording(recordingId, { summary_status: 'processing' })

    // Uses Claude Code CLI — no API key needed
    const summary = await generateSummary(transcript)

    const rec = getRecording(recordingId)
    if (!rec) return

    const summaryPath = join(rec.file_path, 'summary.json')
    writeFileSync(summaryPath, JSON.stringify(summary, null, 2), 'utf-8')

    updateRecording(recordingId, { summary_status: 'done' })
    sendToAllWindows(IPC.AI_SUMMARY_COMPLETE, { recordingId, summary })

    new Notification({
      title: 'Summary Ready',
      body: `AI summary generated for "${rec.title}"`
    }).show()

    // Auto-push to ClickUp if enabled
    if (config.clickup.autoPush && config.clickup.apiKey && config.clickup.defaultListId) {
      await pushActionItems(
        config.clickup.apiKey,
        config.clickup.defaultListId,
        summary.action_items,
        rec.title
      )
      updateRecording(recordingId, { clickup_synced: 1 })
    }
  } catch (err) {
    log.error('Auto-summarize failed:', err)
    updateRecording(recordingId, { summary_status: 'failed' })
  }
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function transcriptToSrt(transcript: Transcript): string {
  return transcript.segments
    .map((seg, i) => {
      const start = srtTime(seg.start)
      const end = srtTime(seg.end)
      return `${i + 1}\n${start} --> ${end}\n${seg.speaker}: ${seg.text}\n`
    })
    .join('\n')
}

function srtTime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  const ms = Math.round((seconds % 1) * 1000)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`
}

function transcriptToMarkdown(transcript: Transcript): string {
  let md = '# Meeting Transcript\n\n'
  md += `**Speakers:** ${transcript.speakers.map((s) => s.label).join(', ')}\n\n`
  md += '---\n\n'

  for (const seg of transcript.segments) {
    md += `**${seg.speaker}** [${formatTime(seg.start)}]\n\n${seg.text}\n\n`
  }

  return md
}

function summaryToMarkdown(summary: Summary, title: string): string {
  let md = `# Meeting Summary: ${title}\n\n`
  md += `## Summary\n\n${summary.summary}\n\n`

  if (summary.decisions.length > 0) {
    md += `## Key Decisions\n\n`
    for (const d of summary.decisions) {
      md += `- ${d}\n`
    }
    md += '\n'
  }

  if (summary.action_items.length > 0) {
    md += `## Action Items\n\n`
    for (const item of summary.action_items) {
      md += `- [ ] **${item.assignee}**: ${item.task}`
      if (item.deadline) md += ` (due: ${item.deadline})`
      md += '\n'
    }
    md += '\n'
  }

  if (summary.open_questions.length > 0) {
    md += `## Open Questions\n\n`
    for (const q of summary.open_questions) {
      md += `- ${q}\n`
    }
    md += '\n'
  }

  return md
}
