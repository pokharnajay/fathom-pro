import { getDb } from './database'
import type { TranscriptSegment } from '../utils/constants'

export interface SearchResult {
  recording_id: string
  speaker: string
  text: string
  start_time: number
  rank: number
}

export function indexTranscript(recordingId: string, segments: TranscriptSegment[]): void {
  const db = getDb()

  // Clear existing entries for this recording
  db.prepare('DELETE FROM transcript_search WHERE recording_id = ?').run(recordingId)

  const insert = db.prepare(
    'INSERT INTO transcript_search (recording_id, speaker, text, start_time) VALUES (?, ?, ?, ?)'
  )

  const insertMany = db.transaction((segs: TranscriptSegment[]) => {
    for (const seg of segs) {
      insert.run(recordingId, seg.speaker, seg.text, String(seg.start))
    }
  })

  insertMany(segments)
}

export function searchTranscripts(query: string): SearchResult[] {
  const db = getDb()

  // FTS5 match query
  const results = db.prepare(`
    SELECT recording_id, speaker, text, start_time, rank
    FROM transcript_search
    WHERE transcript_search MATCH ?
    ORDER BY rank
    LIMIT 50
  `).all(query) as SearchResult[]

  return results
}

export function getTranscriptSegments(recordingId: string): { speaker: string; text: string; start_time: string }[] {
  const db = getDb()
  return db.prepare(
    'SELECT speaker, text, start_time FROM transcript_search WHERE recording_id = ? ORDER BY CAST(start_time AS REAL)'
  ).all(recordingId) as { speaker: string; text: string; start_time: string }[]
}
