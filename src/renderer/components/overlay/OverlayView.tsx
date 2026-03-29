import { useRecordingStore } from '../../stores/recording-store'
import { motion } from 'framer-motion'

export default function OverlayView() {
  const state = useRecordingStore((s) => s.state)
  const elapsed = useRecordingStore((s) => s.elapsed)
  const levels = useRecordingStore((s) => s.levels)
  const stopRecording = useRecordingStore((s) => s.stopRecording)
  const pauseRecording = useRecordingStore((s) => s.pauseRecording)
  const resumeRecording = useRecordingStore((s) => s.resumeRecording)

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  }

  return (
    <motion.div
      initial={{ y: -60, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -60, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      <div
        className="titlebar-drag"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '8px 16px',
          background: 'rgba(30, 30, 30, 0.92)',
          backdropFilter: 'blur(20px)',
          borderRadius: 32,
          color: '#fff',
          boxShadow: '0 4px 20px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.1) inset',
          fontSize: 13,
          fontWeight: 500
        }}
      >
        {/* Recording indicator */}
        <motion.div
          animate={{ opacity: state === 'paused' ? [1, 0.3] : [1, 0.4, 1] }}
          transition={{ duration: state === 'paused' ? 0.8 : 1.5, repeat: Infinity }}
          style={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: state === 'paused' ? '#ff9500' : '#ff3b30',
            flexShrink: 0
          }}
        />

        {/* Timer */}
        <span style={{ fontFamily: 'var(--font-mono)', minWidth: 46, textAlign: 'center' }}>
          {formatTime(elapsed)}
        </span>

        {/* Audio levels */}
        <div
          className="titlebar-no-drag"
          style={{ display: 'flex', gap: 3, alignItems: 'center' }}
        >
          <LevelBar level={levels.system} color="#34c759" label="S" />
          <LevelBar level={levels.mic} color="#007aff" label="M" />
        </div>

        {/* Separator */}
        <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.15)' }} />

        {/* Controls */}
        <div className="titlebar-no-drag" style={{ display: 'flex', gap: 6 }}>
          {state === 'recording' ? (
            <IconButton onClick={pauseRecording} title="Pause">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="4" width="4" height="16" rx="1" />
                <rect x="14" y="4" width="4" height="16" rx="1" />
              </svg>
            </IconButton>
          ) : state === 'paused' ? (
            <IconButton onClick={resumeRecording} title="Resume">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            </IconButton>
          ) : null}

          <IconButton onClick={stopRecording} title="Stop" danger>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
          </IconButton>
        </div>
      </div>
    </motion.div>
  )
}

function LevelBar({ level, color, label }: { level: number; color: string; label: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      <div
        style={{
          width: 4,
          height: 18,
          borderRadius: 2,
          background: 'rgba(255,255,255,0.15)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column-reverse'
        }}
      >
        <motion.div
          animate={{ height: `${Math.min(level * 100, 100)}%` }}
          transition={{ duration: 0.1 }}
          style={{ width: '100%', background: color, borderRadius: 2 }}
        />
      </div>
      <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.5)' }}>{label}</span>
    </div>
  )
}

function IconButton({
  children,
  onClick,
  title,
  danger
}: {
  children: React.ReactNode
  onClick: () => void
  title: string
  danger?: boolean
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        width: 28,
        height: 28,
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: danger ? 'rgba(255, 59, 48, 0.3)' : 'rgba(255,255,255,0.1)',
        color: danger ? '#ff6961' : '#fff',
        border: 'none',
        cursor: 'pointer',
        transition: 'background 0.15s'
      }}
    >
      {children}
    </button>
  )
}
