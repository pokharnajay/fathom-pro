import ffmpeg from 'fluent-ffmpeg'
import { getFfmpegPath } from '../utils/ffmpeg-path'
import log from '../utils/logger'
import type { QualityPreset } from '../utils/constants'

ffmpeg.setFfmpegPath(getFfmpegPath())

export interface EncodeOptions {
  quality: QualityPreset
  inputPath: string
  outputPath: string
}

export function mixTracks(
  systemAudioPath: string,
  micAudioPath: string,
  outputPath: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(systemAudioPath)
      .input(micAudioPath)
      .complexFilter([
        '[0:a][1:a]amix=inputs=2:duration=longest:dropout_transition=2[out]'
      ])
      .outputOptions(['-map', '[out]'])
      .audioCodec('pcm_s16le')
      .audioFrequency(16000)
      .audioChannels(1)
      .output(outputPath)
      .on('end', () => {
        log.info('Audio mix complete:', outputPath)
        resolve()
      })
      .on('error', (err) => {
        log.error('Audio mix failed:', err)
        reject(err)
      })
      .run()
  })
}

export function encodeAudio(options: EncodeOptions): Promise<void> {
  return new Promise((resolve, reject) => {
    const cmd = ffmpeg().input(options.inputPath)

    switch (options.quality) {
      case 'lossless':
        cmd.audioCodec('pcm_s16le').audioFrequency(16000).audioChannels(1)
        break
      case 'high':
        cmd.audioCodec('aac').audioBitrate('256k').audioFrequency(44100).audioChannels(2)
        break
      case 'standard':
      default:
        cmd.audioCodec('aac').audioBitrate('128k').audioFrequency(44100).audioChannels(2)
        break
    }

    cmd
      .output(options.outputPath)
      .on('end', () => {
        log.info('Encode complete:', options.outputPath)
        resolve()
      })
      .on('error', (err) => {
        log.error('Encode failed:', err)
        reject(err)
      })
      .run()
  })
}

export function convertToWavForTranscription(inputPath: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(inputPath)
      .audioCodec('pcm_s16le')
      .audioFrequency(16000)
      .audioChannels(1)
      .output(outputPath)
      .on('end', () => {
        log.info('Transcription WAV ready:', outputPath)
        resolve()
      })
      .on('error', (err) => {
        log.error('WAV conversion failed:', err)
        reject(err)
      })
      .run()
  })
}

export function getAudioDuration(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        reject(err)
        return
      }
      resolve(metadata.format.duration || 0)
    })
  })
}
