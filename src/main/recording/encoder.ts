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

/**
 * Extract audio from tab capture (which may contain video+audio)
 * and mix with mic audio into a single WAV for transcription.
 */
export function mixTabAndMicAudio(
  tabCapturePath: string,
  micAudioPath: string,
  outputPath: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(tabCapturePath)
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

/**
 * Extract just the tab audio track from a tab capture webm
 * (strips video, keeps audio only as WAV).
 */
export function extractTabAudio(
  tabCapturePath: string,
  outputPath: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(tabCapturePath)
      .noVideo()
      .audioCodec('pcm_s16le')
      .audioFrequency(16000)
      .audioChannels(1)
      .output(outputPath)
      .on('end', () => {
        log.info('Tab audio extracted:', outputPath)
        resolve()
      })
      .on('error', (err) => {
        log.error('Tab audio extraction failed:', err)
        reject(err)
      })
      .run()
  })
}

/**
 * Convert tab capture webm to a high-quality 1080p MP4 (H.264 + AAC).
 * This produces a crystal-clear, universally-playable recording.
 */
export function convertToMp4(
  inputPath: string,
  outputPath: string,
  quality: QualityPreset = 'high'
): Promise<void> {
  return new Promise((resolve, reject) => {
    const cmd = ffmpeg().input(inputPath)

    if (quality === 'lossless') {
      // Very high quality H.264 for near-lossless
      cmd
        .videoCodec('libx264')
        .outputOptions(['-crf', '14', '-preset', 'slow'])
        .size('1920x1080')
        .fps(30)
        .audioCodec('aac')
        .audioBitrate('320k')
        .audioFrequency(48000)
    } else if (quality === 'high') {
      // Crystal clear 1080p 30fps
      cmd
        .videoCodec('libx264')
        .outputOptions(['-crf', '18', '-preset', 'medium'])
        .size('1920x1080')
        .fps(30)
        .audioCodec('aac')
        .audioBitrate('256k')
        .audioFrequency(48000)
    } else {
      // Standard — still good, smaller files
      cmd
        .videoCodec('libx264')
        .outputOptions(['-crf', '23', '-preset', 'fast'])
        .size('1280x720')
        .fps(30)
        .audioCodec('aac')
        .audioBitrate('192k')
        .audioFrequency(44100)
    }

    cmd
      .output(outputPath)
      .on('end', () => {
        log.info('MP4 conversion complete:', outputPath)
        resolve()
      })
      .on('error', (err) => {
        log.error('MP4 conversion failed:', err)
        reject(err)
      })
      .run()
  })
}

/**
 * Mix mic audio into an existing MP4's audio track,
 * producing a final MP4 with both meeting audio + your voice.
 */
export function mixMicIntoVideo(
  videoPath: string,
  micPath: string,
  outputPath: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(videoPath)
      .input(micPath)
      .complexFilter([
        '[0:a][1:a]amix=inputs=2:duration=longest:dropout_transition=2[aout]'
      ])
      .outputOptions([
        '-map', '0:v',
        '-map', '[aout]',
        '-c:v', 'copy'   // Copy video stream, only re-encode audio
      ])
      .audioCodec('aac')
      .audioBitrate('256k')
      .output(outputPath)
      .on('end', () => {
        log.info('Mic mixed into video:', outputPath)
        resolve()
      })
      .on('error', (err) => {
        log.error('Mic mix failed:', err)
        reject(err)
      })
      .run()
  })
}

export function convertToWavForTranscription(inputPath: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(inputPath)
      .noVideo()
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
