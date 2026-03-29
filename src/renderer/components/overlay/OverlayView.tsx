import { useRecordingStore } from '../../stores/recording-store'
import { motion } from 'framer-motion'

export default function OverlayView() {
  const state = useRecordingStore((s) => s.state)
  const elapsed = useRecordingStore((s) => s.elapsed)
  const levels = useRecordingStore((s) => s.levels)
  const stopRecording = useRecordingStore((s) => s.stopRecording)
  const pauseRecording = useRecordingStore((s) => s.pauseRecording)
  const resumeRecording = useRecordingStore((s) => s.resumeRecording)

  const fmt = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  }

  const isPaused = state === 'paused'

  return (
    <motion.div
      initial={{ y: -70, opacity: 0, scale: 0.9 }}
      animate={{ y: 0, opacity: 1, scale: 1 }}
      exit={{ y: -70, opacity: 0, scale: 0.9 }}
      transition={{ type: 'spring', stiffness: 350, damping: 28 }}
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      <div
        className="drag"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '10px 16px',
          background: 'rgba(20, 20, 20, 0.94)',
          backdropFilter: 'blur(30px) saturate(180%)',
          WebkitBackdropFilter: 'blur(30px) saturate(180%)',
          borderRadius: 'var(--radius-pill)',
          color: '#fff',
          boxShadow: 'var(--shadow-pill)',
          fontSize: 13,
          fontWeight: 500
        }}
      >
        {/* Recording dot */}
        <motion.div
          animate={{ opacity: isPaused ? [1, 0.2] : [1, 0.35, 1] }}
          transition={{ duration: isPaused ? 0.6 : 1.2, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: isPaused ? '#ff9500' : '#ff3b30',
            boxShadow: isPaused ? '0 0 6px rgba(255,149,0,0.5)' : '0 0 8px rgba(255,59,48,0.5)'
          }}
        />

        {/* Timer */}
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 14,
          fontWeight: 600,
          minWidth: 48,
          textAlign: 'center',
          letterSpacing: '0.02em'
        }}>
          {fmt(elapsed)}
        </span>

        {/* Audio level bars */}
        <div className="no-drag" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <LevelIndicator level={levels.system} color="#30d158" label="T" />
          <LevelIndicator level={levels.mic} color="#5ac8fa" label="M" />
        </div>

        {/* Separator */}
        <div style={{ width: 1, height: 22, background: 'rgba(255,255,255,0.12)', borderRadius: 1 }} />

        {/* Controls */}
        <div className="no-drag" style={{ display: 'flex', gap: 4 }}>
          {state === 'recording' ? (
            <OvlButton onClick={pauseRecording} title="Pause">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="4" width="4" height="16" rx="1.5" />
                <rect x="14" y="4" width="4" height="16" rx="1.5" />
              </svg>
            </OvlButton>
          ) : (
            <OvlButton onClick={resumeRecording} title="Resume">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            </OvlButton>
          )}
          <OvlButton onClick={stopRecording} title="Stop" danger>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
              <rect x="5" y="5" width="14" height="14" rx="2" />
            </svg>
          </OvlButton>
        </div>
      </div>
    </motion.div>
  )
}

function LevelIndicator({ level, color, label }: { level: number; color: string; label: string }) {
  const barCount = 4
  const normalizedLevel = Math.min(level, 1)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
      <div style={{ display: 'flex', gap: 1.5, alignItems: 'flex-end', height: 16 }}>
        {Array.from({ length: barCount }).map((_, i) => {
          const threshold = (i + 1) / barCount
          const isLit = normalizedLevel >= threshold * 0.7
          return (
            <motion.div
              key={i}
              animate={{ opacity: isLit ? 1 : 0.2 }}
              transition={{ duration: 0.08 }}
              style={{
                width: 3,
                height: 4 + i * 3,
                borderRadius: 1.5,
                background: isLit ? color : 'rgba(255,255,255,0.2)'
              }}
            />
          )
        })}
      </div>
      <span style={{ fontSize: 7, color: 'rgba(255,255,255,0.35)', fontWeight: 600, letterSpacing: '0.05em' }}>
        {label}
      </span>
    </div>
  )
}

function OvlButton({ children, onClick, title, danger }: {
  children: React.ReactNode; onClick: () => void; title: string; danger?: boolean
}) {
  return (
    <motion.button
      onClick={onClick}
      title={title}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.9 }}
      style={{
        width: 28,
        height: 28,
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: danger ? 'rgba(255, 59, 48, 0.25)' : 'rgba(255,255,255,0.1)',
        color: danger ? '#ff6961' : 'rgba(255,255,255,0.9)',
        border: 'none',
        cursor: 'pointer'
      }}
    >
      {children}
    </motion.button>
  )
}
