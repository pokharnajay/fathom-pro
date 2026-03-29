import { readFileSync, writeFileSync, existsSync } from 'fs'
import { getConfigPath } from './file-manager'
import { AppConfig, DEFAULT_CONFIG } from '../utils/constants'
import log from '../utils/logger'

let cachedConfig: AppConfig | null = null

export function getConfig(): AppConfig {
  if (cachedConfig) return cachedConfig

  const configPath = getConfigPath()
  if (!existsSync(configPath)) {
    cachedConfig = { ...DEFAULT_CONFIG }
    saveConfig(cachedConfig)
    return cachedConfig
  }

  try {
    const raw = readFileSync(configPath, 'utf-8')
    const parsed = JSON.parse(raw)
    // Merge with defaults to handle missing keys
    cachedConfig = deepMerge(DEFAULT_CONFIG, parsed) as AppConfig
    return cachedConfig
  } catch (err) {
    log.error('Failed to read config, using defaults:', err)
    cachedConfig = { ...DEFAULT_CONFIG }
    return cachedConfig
  }
}

export function setConfigValue(key: string, value: unknown): void {
  const config = getConfig()
  setNestedValue(config, key, value)
  cachedConfig = config
  saveConfig(config)
}

export function updateConfig(partial: Partial<AppConfig>): void {
  const config = getConfig()
  cachedConfig = deepMerge(config, partial) as AppConfig
  saveConfig(cachedConfig)
}

function saveConfig(config: AppConfig): void {
  try {
    const configPath = getConfigPath()
    writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8')
  } catch (err) {
    log.error('Failed to save config:', err)
  }
}

function setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): void {
  const keys = path.split('.')
  let current: Record<string, unknown> = obj
  for (let i = 0; i < keys.length - 1; i++) {
    if (!current[keys[i]] || typeof current[keys[i]] !== 'object') {
      current[keys[i]] = {}
    }
    current = current[keys[i]] as Record<string, unknown>
  }
  current[keys[keys.length - 1]] = value
}

function deepMerge(target: unknown, source: unknown): unknown {
  if (
    typeof target !== 'object' || target === null ||
    typeof source !== 'object' || source === null
  ) {
    return source
  }

  const result = { ...(target as Record<string, unknown>) }
  for (const key of Object.keys(source as Record<string, unknown>)) {
    const tVal = (target as Record<string, unknown>)[key]
    const sVal = (source as Record<string, unknown>)[key]
    if (typeof tVal === 'object' && tVal !== null && typeof sVal === 'object' && sVal !== null && !Array.isArray(sVal)) {
      result[key] = deepMerge(tVal, sVal)
    } else {
      result[key] = sVal
    }
  }
  return result
}
