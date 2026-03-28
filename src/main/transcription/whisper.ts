import { spawn } from 'child_process'
import { readFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import log from '../utils/logger'
import type { Transcript, TranscriptSegment } from '../utils/constants'

export async function transcribeWithWhisper(
  audioPath: string,
  recordingId: string,
  onProgress?: (percent: number) => void
): Promise<Transcript> {
  return new Promise((resolve, reject) => {
    const outputDir = dirname(audioPath)
    const outputJson = join(outputDir, 'whisper_output.json')

    // Find whisper-cli
    const whisperPaths = [
      '/opt/homebrew/bin/whisper-cli',
      '/usr/local/bin/whisper-cli',
      'whisper-cli'
    ]

    let whisperBin = 'whisper-cli'
    for (const p of whisperPaths) {
      if (p === 'whisper-cli' || existsSync(p)) {
        whisperBin = p
        break
      }
    }

    log.info(`Transcribing with whisper: ${whisperBin} ${audioPath}`)
    onProgress?.(5)

    const args = [
      '--model', 'large-v3',
      '--output-format', 'json',
      '--output-dir', outputDir,
      '--language', 'en',
      audioPath
    ]

    const proc = spawn(whisperBin, args, {
      stdio: ['pipe', 'pipe', 'pipe']
    })

    let stderr = ''

    proc.stderr?.on('data', (data: Buffer) => {
      const text = data.toString()
      stderr += text

      // Try to parse progress from whisper output
      const progressMatch = text.match(/(\d+)%/)
      if (progressMatch) {
        const pct = parseInt(progressMatch[1], 10)
        onProgress?.(Math.min(pct, 95))
      }
    })

    proc.on('close', (code) => {
      if (code !== 0) {
        log.error('Whisper failed with code', code, stderr)
        reject(new Error(`Whisper exited with code ${code}: ${stderr}`))
        return
      }

      onProgress?.(95)

      try {
        // Whisper outputs a JSON file alongside the input
        const baseName = audioPath.replace(/\.[^.]+$/, '')
        const possibleOutputs = [
          outputJson,
          `${baseName}.json`,
          join(outputDir, 'audio_mixed.json')
        ]

        let rawData: string | null = null
        for (const p of possibleOutputs) {
          if (existsSync(p)) {
            rawData = readFileSync(p, 'utf-8')
            break
          }
        }

        if (!rawData) {
          reject(new Error('Whisper output JSON not found'))
          return
        }

        const whisperOutput = JSON.parse(rawData)
        const transcript = parseWhisperOutput(whisperOutput, recordingId)

        onProgress?.(100)
        resolve(transcript)
      } catch (err) {
        reject(err)
      }
    })

    proc.on('error', (err) => {
      log.error('Failed to spawn whisper:', err)
      reject(new Error(`Failed to run whisper-cli: ${err.message}. Make sure whisper-cli is installed.`))
    })

    // Simulate progress if whisper doesn't report it
    let simulatedProgress = 10
    const progressTimer = setInterval(() => {
      if (simulatedProgress < 85) {
        simulatedProgress += 5
        onProgress?.(simulatedProgress)
      }
    }, 15000) // every 15 seconds

    proc.on('close', () => clearInterval(progressTimer))
  })
}

function parseWhisperOutput(data: unknown, recordingId: string): Transcript {
  const output = data as {
    segments?: Array<{
      start: number
      end: number
      text: string
      speaker?: string
    }>
    text?: string
  }

  const segments: TranscriptSegment[] = (output.segments || []).map((seg, i) => ({
    speaker: seg.speaker || `Speaker ${(i % 2) + 1}`,
    start: seg.start,
    end: seg.end,
    text: seg.text.trim(),
    confidence: 0.9
  }))

  // Extract unique speakers
  const speakerSet = new Set(segments.map((s) => s.speaker))
  const speakers = Array.from(speakerSet).map((s, i) => ({
    id: `speaker_${i}`,
    label: s
  }))

  return {
    recording_id: recordingId,
    duration_seconds: segments.length > 0 ? segments[segments.length - 1].end : 0,
    speakers,
    segments,
    engine: 'whisper',
    created_at: new Date().toISOString()
  }
}
