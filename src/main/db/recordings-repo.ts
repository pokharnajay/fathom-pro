import { getDb } from './database'
import type { RecordingRow } from '../utils/constants'

export interface ListFilters {
  search?: string
  dateRange?: 'all' | 'week' | 'month'
  transcriptStatus?: string
}

export function insertRecording(recording: RecordingRow): void {
  const db = getDb()
  db.prepare(`
    INSERT INTO recordings (id, title, date, duration_seconds, file_path, transcript_status, summary_status, clickup_synced, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    recording.id,
    recording.title,
    recording.date,
    recording.duration_seconds,
    recording.file_path,
    recording.transcript_status,
    recording.summary_status,
    recording.clickup_synced,
    recording.created_at
  )
}

export function getRecording(id: string): RecordingRow | undefined {
  const db = getDb()
  return db.prepare('SELECT * FROM recordings WHERE id = ?').get(id) as RecordingRow | undefined
}

export function listRecordings(filters?: ListFilters): RecordingRow[] {
  const db = getDb()
  let query = 'SELECT * FROM recordings'
  const conditions: string[] = []
  const params: unknown[] = []

  if (filters?.dateRange === 'week') {
    conditions.push("date >= datetime('now', '-7 days')")
  } else if (filters?.dateRange === 'month') {
    conditions.push("date >= datetime('now', '-30 days')")
  }

  if (filters?.transcriptStatus) {
    conditions.push('transcript_status = ?')
    params.push(filters.transcriptStatus)
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ')
  }

  query += ' ORDER BY date DESC'

  return db.prepare(query).all(...params) as RecordingRow[]
}

export function updateRecording(id: string, data: Partial<RecordingRow>): void {
  const db = getDb()
  const fields = Object.keys(data)
    .filter((k) => k !== 'id')
    .map((k) => `${k} = ?`)
  const values = Object.keys(data)
    .filter((k) => k !== 'id')
    .map((k) => data[k as keyof RecordingRow])

  if (fields.length === 0) return

  db.prepare(`UPDATE recordings SET ${fields.join(', ')} WHERE id = ?`).run(...values, id)
}

export function deleteRecording(id: string): void {
  const db = getDb()
  db.prepare('DELETE FROM transcript_search WHERE recording_id = ?').run(id)
  db.prepare('DELETE FROM speakers WHERE recording_id = ?').run(id)
  db.prepare('DELETE FROM recordings WHERE id = ?').run(id)
}

export function getRecentRecordings(limit: number = 5): RecordingRow[] {
  const db = getDb()
  return db.prepare('SELECT * FROM recordings ORDER BY date DESC LIMIT ?').all(limit) as RecordingRow[]
}
