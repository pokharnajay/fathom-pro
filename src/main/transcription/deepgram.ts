import { readFileSync } from 'fs'
import log from '../utils/logger'
import type { Transcript, TranscriptSegment } from '../utils/constants'

export async function transcribeWithDeepgram(
  audioPath: string,
  recordingId: string,
  apiKey: string,
  onProgress?: (percent: number) => void
): Promise<Transcript> {
  log.info('Transcribing with Deepgram:', audioPath)
  onProgress?.(10)

  const audioBuffer = readFileSync(audioPath)
  onProgress?.(30)

  const url = new URL('https://api.deepgram.com/v1/listen')
  url.searchParams.set('model', 'nova-3')
  url.searchParams.set('smart_format', 'true')
  url.searchParams.set('diarize', 'true')
  url.searchParams.set('punctuate', 'true')
  url.searchParams.set('paragraphs', 'true')
  url.searchParams.set('utterances', 'true')
  url.searchParams.set('language', 'en')

  const response = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      Authorization: `Token ${apiKey}`,
      'Content-Type': 'audio/wav'
    },
    body: audioBuffer
  })

  onProgress?.(80)

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`Deepgram API error ${response.status}: ${errText}`)
  }

  const data = await response.json()
  onProgress?.(90)

  const transcript = parseDeepgramResponse(data, recordingId)
  onProgress?.(100)

  return transcript
}

interface DeepgramUtterance {
  start: number
  end: number
  transcript: string
  speaker: number
  confidence: number
}

interface DeepgramResponse {
  results: {
    utterances?: DeepgramUtterance[]
    channels: Array<{
      alternatives: Array<{
        transcript: string
        words: Array<{
          word: string
          start: number
          end: number
          speaker?: number
          confidence: number
        }>
        paragraphs?: {
          paragraphs: Array<{
            sentences: Array<{
              text: string
              start: number
              end: number
            }>
            speaker: number
            start: number
            end: number
          }>
        }
      }>
    }>
  }
  metadata: {
    duration: number
  }
}

function parseDeepgramResponse(data: DeepgramResponse, recordingId: string): Transcript {
  const segments: TranscriptSegment[] = []
  const speakerMap = new Map<number, string>()

  // Prefer utterances (better speaker-attributed chunks)
  if (data.results.utterances && data.results.utterances.length > 0) {
    for (const utt of data.results.utterances) {
      const speakerLabel = `Speaker ${utt.speaker + 1}`
      speakerMap.set(utt.speaker, speakerLabel)

      segments.push({
        speaker: speakerLabel,
        start: utt.start,
        end: utt.end,
        text: utt.transcript.trim(),
        confidence: utt.confidence
      })
    }
  } else {
    // Fallback to paragraphs from first channel
    const alt = data.results.channels?.[0]?.alternatives?.[0]
    if (alt?.paragraphs?.paragraphs) {
      for (const para of alt.paragraphs.paragraphs) {
        const speakerLabel = `Speaker ${para.speaker + 1}`
        speakerMap.set(para.speaker, speakerLabel)

        for (const sentence of para.sentences) {
          segments.push({
            speaker: speakerLabel,
            start: sentence.start,
            end: sentence.end,
            text: sentence.text.trim(),
            confidence: 0.95
          })
        }
      }
    }
  }

  const speakers = Array.from(speakerMap.entries()).map(([id, label]) => ({
    id: `speaker_${id}`,
    label
  }))

  return {
    recording_id: recordingId,
    duration_seconds: data.metadata?.duration || 0,
    speakers,
    segments,
    engine: 'deepgram',
    created_at: new Date().toISOString()
  }
}
