import Database from 'better-sqlite3'
import { getDbPath } from '../storage/file-manager'
import log from '../utils/logger'

let db: Database.Database | null = null

export function getDb(): Database.Database {
  if (db) return db

  const dbPath = getDbPath()
  log.info('Opening database at:', dbPath)

  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  runMigrations(db)
  return db
}

export function closeDb(): void {
  if (db) {
    db.close()
    db = null
  }
}

function runMigrations(db: Database.Database): void {
  const version = db.pragma('user_version', { simple: true }) as number

  if (version < 1) {
    log.info('Running migration v1: create recordings table')
    db.exec(`
      CREATE TABLE IF NOT EXISTS recordings (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL DEFAULT '',
        date TEXT NOT NULL,
        duration_seconds INTEGER NOT NULL DEFAULT 0,
        file_path TEXT NOT NULL,
        transcript_status TEXT NOT NULL DEFAULT 'pending',
        summary_status TEXT NOT NULL DEFAULT 'pending',
        clickup_synced INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_recordings_date ON recordings(date DESC);
    `)
    db.pragma('user_version = 1')
  }

  if (version < 2) {
    log.info('Running migration v2: create FTS5 search table')
    db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS transcript_search USING fts5(
        recording_id,
        speaker,
        text,
        start_time
      );
    `)
    db.pragma('user_version = 2')
  }

  if (version < 3) {
    log.info('Running migration v3: add speakers table')
    db.exec(`
      CREATE TABLE IF NOT EXISTS speakers (
        id TEXT PRIMARY KEY,
        recording_id TEXT NOT NULL,
        speaker_id TEXT NOT NULL,
        label TEXT NOT NULL DEFAULT '',
        FOREIGN KEY (recording_id) REFERENCES recordings(id) ON DELETE CASCADE
      );
    `)
    db.pragma('user_version = 3')
  }
}
