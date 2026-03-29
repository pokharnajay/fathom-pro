import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { useLibraryStore } from '../../stores/library-store'
import AudioPlayer from './AudioPlayer'
import TranscriptViewer from './TranscriptViewer'
import SummaryPanel from './SummaryPanel'
import Button from '../shared/Button'
import Spinner from '../shared/Spinner'
import Badge from '../shared/Badge'

type Tab = 'player' | 'transcript' | 'summary'

export default function RecordingDetail() {
  const [activeTab, setActiveTab] = useState<Tab>('player')
  const [currentTime, setCurrentTime] = useState(0)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [isSummarizing, setIsSummarizing] = useState(false)

  const selectedRecording = useLibraryStore((s) => s.selectedRecording)
  const deleteRecording = useLibraryStore((s) => s.deleteRecording)
  const refreshSelected = useLibraryStore((s) => s.refreshSelected)
  const transcribeProgress = useLibraryStore((s) => s.transcribeProgress)

  const rec = selectedRecording
  if (!rec) return null

  const progress = transcribeProgress[rec.id] || 0

  const handleTranscribe = async (engine?: string) => {
    setIsTranscribing(true)
    try {
      await window.api.transcribe.start(rec.id, engine)
      await refreshSelected()
    } catch (err) {
      console.error('Transcription failed:', err)
    }
    setIsTranscribing(false)
  }

  const handleSummarize = async () => {
    setIsSummarizing(true)
    try {
      await window.api.ai.summarize(rec.id)
      await refreshSelected()
    } catch (err) {
      console.error('Summary failed:', err)
    }
    setIsSummarizing(false)
  }

  const handleDelete = async () => {
    if (confirm('Delete this recording permanently?')) {
      await deleteRecording(rec.id)
    }
  }

  const handleSeek = (time: number) => {
    setCurrentTime(time)
  }

  const tabs: { key: Tab; label: string; available: boolean }[] = [
    { key: 'player', label: 'Player', available: true },
    { key: 'transcript', label: 'Transcript', available: rec.transcript_status === 'done' },
    { key: 'summary', label: 'Summary', available: rec.summary_status === 'done' }
  ]

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m}m ${sec}s`
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Titlebar area */}
      <div
        className="titlebar-drag"
        style={{ height: 'var(--titlebar-height)', flexShrink: 0 }}
      />

      {/* Header */}
      <div style={{ padding: '0 24px 16px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'start', justifyContent: 'space-between', gap: 16 }}>
          <div style={{ flex: 1 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>
              {rec.title || 'Untitled Recording'}
            </h2>
            <div style={{ display: 'flex', gap: 12, fontSize: 13, color: 'var(--text-secondary)' }}>
              <span>{format(new Date(rec.date), 'MMM d, yyyy h:mm a')}</span>
              <span>&middot;</span>
              <span>{formatDuration(rec.duration_seconds)}</span>
              {rec.clickup_synced === 1 && (
                <>
                  <span>&middot;</span>
                  <Badge label="Synced to ClickUp" color="green" />
                </>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 6 }}>
            {/* Export dropdown */}
            <ExportMenu recordingId={rec.id} />
            <Button variant="danger" size="sm" onClick={handleDelete}>
              Delete
            </Button>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div
        style={{
          display: 'flex',
          gap: 0,
          borderBottom: '1px solid var(--border)',
          padding: '0 24px',
          flexShrink: 0
        }}
      >
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '8px 16px',
              fontSize: 13,
              fontWeight: 500,
              color: activeTab === tab.key ? 'var(--accent)' : 'var(--text-secondary)',
              borderBottom: activeTab === tab.key ? '2px solid var(--accent)' : '2px solid transparent',
              background: 'transparent',
              opacity: tab.available || tab.key === 'player' ? 1 : 0.4,
              transition: 'all 0.15s ease'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
        {activeTab === 'player' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <AudioPlayer
              filePath={rec.file_path}
              onTimeUpdate={setCurrentTime}
              seekTo={currentTime}
            />

            {/* Transcription actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {rec.transcript_status === 'pending' && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <Button
                    variant="primary"
                    onClick={() => handleTranscribe()}
                    disabled={isTranscribing}
                  >
                    {isTranscribing ? <><Spinner size={14} /> Transcribing...</> : 'Transcribe (Local Whisper)'}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => handleTranscribe('deepgram')}
                    disabled={isTranscribing}
                  >
                    Transcribe (Deepgram Cloud)
                  </Button>
                </div>
              )}
              {rec.transcript_status === 'processing' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-secondary)' }}>
                  <Spinner size={16} />
                  <span>Transcribing... {progress > 0 ? `${progress}%` : ''}</span>
                  {progress > 0 && (
                    <div style={{ flex: 1, maxWidth: 200, height: 4, background: 'var(--bg-tertiary)', borderRadius: 2 }}>
                      <div style={{ width: `${progress}%`, height: '100%', background: 'var(--accent)', borderRadius: 2, transition: 'width 0.3s' }} />
                    </div>
                  )}
                </div>
              )}
              {rec.transcript_status === 'failed' && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <Badge label="Transcription Failed" color="red" />
                  <Button variant="secondary" onClick={() => handleTranscribe()}>Retry</Button>
                </div>
              )}
              {rec.transcript_status === 'done' && rec.summary_status === 'pending' && (
                <Button variant="primary" onClick={handleSummarize} disabled={isSummarizing}>
                  {isSummarizing ? <><Spinner size={14} /> Generating Summary...</> : 'Generate AI Summary'}
                </Button>
              )}
            </div>
          </div>
        )}

        {activeTab === 'transcript' && rec.transcript && (
          <TranscriptViewer
            transcript={rec.transcript}
            currentTime={currentTime}
            onSeek={handleSeek}
            recordingId={rec.id}
          />
        )}

        {activeTab === 'summary' && rec.summary && (
          <SummaryPanel
            summary={rec.summary}
            recordingId={rec.id}
            meetingTitle={rec.title}
          />
        )}

        {activeTab === 'transcript' && !rec.transcript && (
          <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', padding: 40 }}>
            No transcript available. Transcribe the recording first.
          </div>
        )}

        {activeTab === 'summary' && !rec.summary && (
          <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', padding: 40 }}>
            No summary available. Generate a transcript first, then create an AI summary.
          </div>
        )}
      </div>
    </div>
  )
}

function ExportMenu({ recordingId }: { recordingId: string }) {
  const [open, setOpen] = useState(false)

  const handleExport = async (type: string, format?: string) => {
    try {
      if (type === 'transcript') {
        await window.api.export.transcript(recordingId, format || 'txt')
      } else if (type === 'summary') {
        await window.api.export.summary(recordingId)
      } else if (type === 'audio') {
        await window.api.export.audio(recordingId, format || 'mixed')
      }
    } catch (err) {
      console.error('Export failed:', err)
    }
    setOpen(false)
  }

  return (
    <div style={{ position: 'relative' }}>
      <Button variant="secondary" size="sm" onClick={() => setOpen(!open)}>
        Export
      </Button>
      {open && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 99 }}
            onClick={() => setOpen(false)}
          />
          <div
            style={{
              position: 'absolute',
              right: 0,
              top: '100%',
              marginTop: 4,
              background: 'var(--bg-primary)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              boxShadow: 'var(--shadow-md)',
              minWidth: 180,
              zIndex: 100,
              overflow: 'hidden'
            }}
          >
            <MenuItem label="Transcript (.txt)" onClick={() => handleExport('transcript', 'txt')} />
            <MenuItem label="Transcript (.md)" onClick={() => handleExport('transcript', 'md')} />
            <MenuItem label="Transcript (.srt)" onClick={() => handleExport('transcript', 'srt')} />
            <MenuItem label="Transcript (.json)" onClick={() => handleExport('transcript', 'json')} />
            <div style={{ height: 1, background: 'var(--border)' }} />
            <MenuItem label="Summary (.md)" onClick={() => handleExport('summary')} />
            <div style={{ height: 1, background: 'var(--border)' }} />
            <MenuItem label="Audio (mixed)" onClick={() => handleExport('audio', 'mixed')} />
            <MenuItem label="Audio (system)" onClick={() => handleExport('audio', 'system')} />
            <MenuItem label="Audio (mic)" onClick={() => handleExport('audio', 'mic')} />
          </div>
        </>
      )}
    </div>
  )
}

function MenuItem({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        padding: '8px 14px',
        fontSize: 13,
        cursor: 'pointer',
        transition: 'background 0.1s'
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      {label}
    </div>
  )
}
