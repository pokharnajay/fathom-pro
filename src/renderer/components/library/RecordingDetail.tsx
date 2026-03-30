import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { format } from 'date-fns'
import { useLibraryStore } from '../../stores/library-store'
import AudioPlayer from './AudioPlayer'
import TranscriptViewer from './TranscriptViewer'
import SummaryPanel from './SummaryPanel'
import Spinner from '../shared/Spinner'

type Tab = 'player' | 'transcript' | 'summary'

export default function RecordingDetail() {
  const [activeTab, setActiveTab] = useState<Tab>('player')
  const [currentTime, setCurrentTime] = useState(0)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [isSummarizing, setIsSummarizing] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)

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

  const handleExport = async (type: string, fmt?: string) => {
    try {
      if (type === 'transcript') await window.api.export.transcript(rec.id, fmt || 'txt')
      else if (type === 'summary') await window.api.export.summary(rec.id)
      else if (type === 'audio') await window.api.export.audio(rec.id, fmt || 'mixed')
    } catch (err) { console.error('Export failed:', err) }
    setExportOpen(false)
  }

  const handleSeek = (time: number) => setCurrentTime(time)

  const tabs: { key: Tab; label: string; icon: React.ReactNode; enabled: boolean }[] = [
    {
      key: 'player', label: 'Player', enabled: true,
      icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="5 3 19 12 5 21 5 3" /></svg>
    },
    {
      key: 'transcript', label: 'Transcript', enabled: rec.transcript_status === 'done',
      icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>
    },
    {
      key: 'summary', label: 'Summary', enabled: rec.summary_status === 'done',
      icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 1 1 7.072 0l-.548.547A3.374 3.374 0 0 0 14 18.469V19a2 2 0 1 1-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
    }
  ]

  const formatDur = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m ${sec}s`
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Titlebar */}
      <div className="drag" style={{ height: 'var(--titlebar-height)', flexShrink: 0 }} />

      {/* Header */}
      <div style={{ padding: '0 28px 20px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'start', justifyContent: 'space-between', gap: 16 }}>
          <div style={{ flex: 1 }}>
            <h2 style={{
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: '-0.4px',
              marginBottom: 6,
              lineHeight: 1.2
            }}>
              {rec.title || 'Untitled Recording'}
            </h2>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 13,
              color: 'var(--text-secondary)'
            }}>
              <span>{format(new Date(rec.date), 'MMM d, yyyy · h:mm a')}</span>
              <span style={{ opacity: 0.4 }}>·</span>
              <span>{formatDur(rec.duration_seconds)}</span>
              {rec.clickup_synced === 1 && (
                <>
                  <span style={{ opacity: 0.4 }}>·</span>
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 3,
                    color: 'var(--green)',
                    fontWeight: 500,
                    fontSize: 12
                  }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                    ClickUp
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="no-drag" style={{ display: 'flex', gap: 6, marginTop: 4 }}>
            <div style={{ position: 'relative' }}>
              <ActionButton onClick={() => setExportOpen(!exportOpen)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                Export
              </ActionButton>
              <AnimatePresence>
                {exportOpen && (
                  <>
                    <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => setExportOpen(false)} />
                    <motion.div
                      initial={{ opacity: 0, y: -4, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -4, scale: 0.95 }}
                      transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                      style={{
                        position: 'absolute',
                        right: 0,
                        top: 'calc(100% + 6px)',
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-md)',
                        boxShadow: 'var(--shadow-lg)',
                        minWidth: 190,
                        zIndex: 100,
                        overflow: 'hidden',
                        padding: '4px 0'
                      }}
                    >
                      <MenuSection label="Transcript">
                        <MenuItem label=".txt (Plain text)" onClick={() => handleExport('transcript', 'txt')} />
                        <MenuItem label=".md (Markdown)" onClick={() => handleExport('transcript', 'md')} />
                        <MenuItem label=".srt (Subtitles)" onClick={() => handleExport('transcript', 'srt')} />
                      </MenuSection>
                      <div style={{ height: 1, background: 'var(--divider)', margin: '4px 0' }} />
                      <MenuSection label="Other">
                        <MenuItem label="Summary (.md)" onClick={() => handleExport('summary')} />
                        <MenuItem label="Audio (mixed)" onClick={() => handleExport('audio', 'mixed')} />
                      </MenuSection>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
            <ActionButton
              onClick={() => confirm('Delete this recording?') && deleteRecording(rec.id)}
              danger
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
            </ActionButton>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{
        display: 'flex',
        gap: 2,
        padding: '0 28px',
        borderBottom: '1px solid var(--divider)',
        flexShrink: 0
      }}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => tab.enabled && setActiveTab(tab.key)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '10px 14px',
                fontSize: 13,
                fontWeight: isActive ? 600 : 400,
                color: !tab.enabled ? 'var(--text-tertiary)' : isActive ? 'var(--accent)' : 'var(--text-secondary)',
                borderBottom: isActive ? '2px solid var(--accent)' : '2px solid transparent',
                marginBottom: -1,
                opacity: tab.enabled ? 1 : 0.4,
                cursor: tab.enabled ? 'pointer' : 'default'
              }}
            >
              {tab.icon}
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '24px 28px' }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          >
            {activeTab === 'player' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <AudioPlayer filePath={rec.file_path} onTimeUpdate={setCurrentTime} seekTo={currentTime} />

                {/* Action buttons */}
                {rec.transcript_status === 'pending' && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 }}
                    style={{ display: 'flex', gap: 8 }}
                  >
                    <PillButton onClick={() => handleTranscribe()} disabled={isTranscribing} primary>
                      {isTranscribing ? <><Spinner size={14} /> Transcribing...</> : 'Transcribe (Local Whisper)'}
                    </PillButton>
                    <PillButton onClick={() => handleTranscribe('deepgram')} disabled={isTranscribing}>
                      Transcribe (Deepgram)
                    </PillButton>
                  </motion.div>
                )}

                {rec.transcript_status === 'processing' && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '14px 18px',
                    background: 'var(--bg-secondary)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: 13
                  }}>
                    <Spinner size={16} />
                    <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>
                      Transcribing{progress > 0 ? ` · ${progress}%` : '...'}
                    </span>
                    {progress > 0 && (
                      <div style={{ flex: 1, maxWidth: 200, height: 3, background: 'var(--bg-tertiary)', borderRadius: 2, overflow: 'hidden' }}>
                        <motion.div
                          animate={{ width: `${progress}%` }}
                          transition={{ duration: 0.4, ease: 'easeOut' }}
                          style={{ height: '100%', background: 'var(--accent)', borderRadius: 2 }}
                        />
                      </div>
                    )}
                  </div>
                )}

                {rec.transcript_status === 'failed' && (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ fontSize: 13, color: 'var(--red)', fontWeight: 500 }}>Transcription failed</span>
                    <PillButton onClick={() => handleTranscribe()}>Retry</PillButton>
                  </div>
                )}

                {rec.transcript_status === 'done' && rec.summary_status === 'pending' && (
                  <PillButton onClick={handleSummarize} disabled={isSummarizing} primary>
                    {isSummarizing ? <><Spinner size={14} /> Generating Summary...</> : 'Generate AI Summary (Claude Code)'}
                  </PillButton>
                )}

                {rec.summary_status === 'processing' && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '14px 18px',
                    background: 'var(--purple-soft)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: 13,
                    color: 'var(--purple)',
                    fontWeight: 500
                  }}>
                    <Spinner size={16} />
                    Claude Code is analyzing the transcript...
                  </div>
                )}
              </div>
            )}

            {activeTab === 'transcript' && rec.transcript && (
              <TranscriptViewer transcript={rec.transcript} currentTime={currentTime} onSeek={handleSeek} recordingId={rec.id} />
            )}
            {activeTab === 'transcript' && !rec.transcript && (
              <EmptyState icon="transcript" message="No transcript yet" sub="Transcribe the recording from the Player tab" />
            )}

            {activeTab === 'summary' && rec.summary && (
              <SummaryPanel summary={rec.summary} recordingId={rec.id} meetingTitle={rec.title} />
            )}
            {activeTab === 'summary' && !rec.summary && (
              <EmptyState icon="summary" message="No summary yet" sub="Generate a transcript first, then create an AI summary" />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}

function ActionButton({ children, onClick, danger }: { children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        padding: '6px 12px',
        borderRadius: 'var(--radius-sm)',
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border)',
        fontSize: 12,
        fontWeight: 500,
        color: danger ? 'var(--red)' : 'var(--text-secondary)',
        cursor: 'pointer'
      }}
    >
      {children}
    </button>
  )
}

function PillButton({ children, onClick, primary, disabled }: {
  children: React.ReactNode; onClick: () => void; primary?: boolean; disabled?: boolean
}) {
  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '10px 18px',
        borderRadius: 'var(--radius-pill)',
        background: primary ? 'var(--accent)' : 'var(--bg-secondary)',
        color: primary ? '#fff' : 'var(--text-primary)',
        fontSize: 13,
        fontWeight: 600,
        border: primary ? 'none' : '1px solid var(--border)',
        boxShadow: primary ? 'var(--shadow-sm)' : 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1
      }}
    >
      {children}
    </motion.button>
  )
}

function MenuSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ padding: '6px 14px 4px', fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {label}
      </div>
      {children}
    </div>
  )
}

function MenuItem({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        padding: '7px 14px',
        fontSize: 13,
        cursor: 'pointer',
        borderRadius: 4,
        margin: '0 4px'
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      {label}
    </div>
  )
}

function EmptyState({ icon, message, sub }: { icon: string; message: string; sub: string }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '60px 20px',
      gap: 8
    }}>
      <div style={{
        width: 48,
        height: 48,
        borderRadius: 'var(--radius-md)',
        background: 'var(--bg-secondary)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 4
      }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="1.5" strokeLinecap="round">
          {icon === 'transcript' ? (
            <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></>
          ) : (
            <><path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 1 1 7.072 0l-.548.547A3.374 3.374 0 0 0 14 18.469V19a2 2 0 1 1-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></>
          )}
        </svg>
      </div>
      <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-secondary)' }}>{message}</span>
      <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{sub}</span>
    </div>
  )
}
