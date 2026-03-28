import { app } from 'electron'
import { join } from 'path'
import { existsSync } from 'fs'

export function getFfmpegPath(): string {
  // In production, check resources directory
  if (app.isPackaged) {
    const resourcePath = join(process.resourcesPath, 'resources', 'ffmpeg')
    if (existsSync(resourcePath)) return resourcePath
  }

  // Try common macOS install locations
  const commonPaths = [
    '/opt/homebrew/bin/ffmpeg',
    '/usr/local/bin/ffmpeg',
    '/usr/bin/ffmpeg'
  ]

  for (const p of commonPaths) {
    if (existsSync(p)) return p
  }

  // Fallback: assume it's on PATH
  return 'ffmpeg'
}
