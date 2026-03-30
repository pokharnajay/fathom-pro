import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useLibraryStore } from '../../stores/library-store'
import { useRecordingStore } from '../../stores/recording-store'
import RecordingList from './RecordingList'
import RecordingDetail from './RecordingDetail'
import SearchBar from './SearchBar'
import FilterBar from './FilterBar'

export default function LibraryView() {
  const fetchRecordings = useLibraryStore((s) => s.fetchRecordings)
  const selectedId = useLibraryStore((s) => s.selectedId)
  const recordingState = useRecordingStore((s) => s.state)
  const elapsed = useRecordingStore((s) => s.elapsed)

  useEffect(() => {
    fetchRecordings()
    // Poll for updates every 10s
    const interval = setInterval(fetchRecordings, 10000)
    return () => clearInterval(interval)
  }, [])

  const formatTimer = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  }

  const isRecording = recordingState === 'recording' || recordingState === 'paused'

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      {/* ── Sidebar ── */}
      <div
        style={{
          width: 'var(--sidebar-width)',
          minWidth: 240,
          maxWidth: 340,
          borderRight: '1px solid var(--divider)',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--bg-sidebar)',
          backdropFilter: 'blur(40px) saturate(180%)',
          WebkitBackdropFilter: 'blur(40px) saturate(180%)'
        }}
      >
        {/* Title + recording status */}
        <div className="drag" style={{ height: 'var(--titlebar-height)', flexShrink: 0 }} />

        <div className="no-drag" style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingLeft: 4 }}>
            <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.3px' }}>
              MeetRec
            </span>
            <AnimatePresence>
              {isRecording && (
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    padding: '2px 8px 2px 6px',
                    borderRadius: 'var(--radius-pill)',
                    background: recordingState === 'recording' ? 'var(--red-soft)' : 'var(--orange-soft)',
                    fontSize: 11,
                    fontWeight: 600,
                    fontFamily: 'var(--font-mono)',
                    color: recordingState === 'recording' ? 'var(--red)' : 'var(--orange)'
                  }}
                >
                  <motion.span
                    animate={{ opacity: [1, 0.3] }}
                    transition={{ duration: 1, repeat: Infinity }}
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: recordingState === 'recording' ? 'var(--red)' : 'var(--orange)'
                    }}
                  />
                  {formatTimer(elapsed)}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <SearchBar />
          <FilterBar />
        </div>

        {/* List */}
        <div style={{ flex: 1, overflow: 'auto', marginTop: 8 }}>
          <RecordingList />
        </div>
      </div>

      {/* ── Detail Panel ── */}
      <div style={{ flex: 1, overflow: 'hidden', background: 'var(--bg-primary)', position: 'relative' }}>
        <AnimatePresence mode="wait">
          {selectedId ? (
            <motion.div
              key={selectedId}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              style={{ height: '100%' }}
            >
              <RecordingDetail />
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                gap: 12
              }}
            >
              <div style={{
                width: 64,
                height: 64,
                borderRadius: 'var(--radius-lg)',
                background: 'var(--bg-secondary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="1.5" strokeLinecap="round">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              </div>
              <span style={{ fontSize: 14, color: 'var(--text-tertiary)', fontWeight: 500 }}>
                Select a recording
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
