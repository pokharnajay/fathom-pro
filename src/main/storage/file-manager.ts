import { app } from 'electron'
import { join } from 'path'
import { mkdirSync, existsSync } from 'fs'
import { format } from 'date-fns'
import { STORAGE_DIR_NAME } from '../utils/constants'

let storagePath: string

export function getStoragePath(): string {
  if (storagePath) return storagePath
  storagePath = join(app.getPath('home'), STORAGE_DIR_NAME)
  ensureDir(storagePath)
  ensureDir(join(storagePath, 'recordings'))
  return storagePath
}

export function setStoragePath(path: string): void {
  storagePath = path
  ensureDir(storagePath)
  ensureDir(join(storagePath, 'recordings'))
}

export function getRecordingsDir(): string {
  return join(getStoragePath(), 'recordings')
}

export function getDbPath(): string {
  return join(getStoragePath(), 'meetrec.db')
}

export function getConfigPath(): string {
  return join(getStoragePath(), 'config.json')
}

export function createRecordingDir(date: Date): string {
  const dirName = format(date, 'yyyy-MM-dd_HHmmss')
  const dirPath = join(getRecordingsDir(), dirName)
  ensureDir(dirPath)
  return dirPath
}

function ensureDir(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
}
