import { useEffect, useRef, useState, useMemo } from 'react'
import { motion } from 'framer-motion'

interface AudioPlayerProps {
  filePath: string
  onTimeUpdate?: (time: number) => void
  seekTo?: number
}

export default function AudioPlayer({ filePath, onTimeUpdate, seekTo }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [track, setTrack] = useState<'mixed' | 'system' | 'mic'>('mixed')

  const audioSrc = `file://${filePath}/audio_${track}.wav`

  // Generate a consistent waveform pattern per file
  const bars = useMemo(() => {
    const b: number[] = []
    let seed = filePath.length
    for (let i = 0; i < 100; i++) {
      seed = (seed * 16807 + 7) % 2147483647
      const h = 0.15 + (seed / 2147483647) * 0.85
      b.push(h)
    }
    return b
  }, [filePath])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const onTime = () => {
      setCurrentTime(audio.currentTime)
      onTimeUpdate?.(audio.currentTime)
    }
    const onDur = () => setDuration(audio.duration || 0)
    const onEnd = () => setIsPlaying(false)

    audio.addEventListener('timeupdate', onTime)
    audio.addEventListener('loadedmetadata', onDur)
    audio.addEventListener('ended', onEnd)
    return () => {
      audio.removeEventListener('timeupdate', onTime)
      audio.removeEventListener('loadedmetadata', onDur)
      audio.removeEventListener('ended', onEnd)
    }
  }, [audioSrc])

  useEffect(() => {
    if (seekTo !== undefined && audioRef.current && Math.abs(audioRef.current.currentTime - seekTo) > 1) {
      audioRef.current.currentTime = seekTo
    }
  }, [seekTo])

  const togglePlay = () => {
    if (!audioRef.current) return
    if (isPlaying) audioRef.current.pause()
    else audioRef.current.play()
    setIsPlaying(!isPlaying)
  }

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !duration) return
    const rect = e.currentTarget.getBoundingClientRect()
    audioRef.current.currentTime = ((e.clientX - rect.left) / rect.width) * duration
  }

  const fmtTime = (s: number) => {
    if (isNaN(s)) return '0:00'
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${m}:${String(sec).padStart(2, '0')}`
  }

  const progress = duration > 0 ? currentTime / duration : 0

  return (
    <div style={{
      background: 'var(--bg-player)',
      borderRadius: 'var(--radius-lg)',
      padding: '20px 24px',
      border: '1px solid var(--border)',
      boxShadow: 'var(--shadow-xs)'
    }}>
      <audio ref={audioRef} src={audioSrc} preload="metadata" />

      {/* Waveform */}
      <div
        onClick={handleSeek}
        style={{
          height: 56,
          borderRadius: 'var(--radius-sm)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          padding: '0 2px',
          marginBottom: 16
        }}
      >
        {bars.map((h, i) => {
          const barProgress = i / bars.length
          const isPast = barProgress < progress
          return (
            <div
              key={i}
              style={{
                flex: 1,
                height: `${h * 100}%`,
                borderRadius: 2,
                background: isPast ? 'var(--accent)' : 'var(--text-tertiary)',
                opacity: isPast ? 0.9 : 0.18,
                transition: 'opacity 0.08s ease, background 0.08s ease'
              }}
            />
          )
        })}
      </div>

      {/* Controls row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        {/* Play button */}
        <motion.button
          onClick={togglePlay}
          whileHover={{ scale: 1.06 }}
          whileTap={{ scale: 0.95 }}
          style={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            background: 'var(--accent)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: 'none',
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(0, 122, 255, 0.25)'
          }}
        >
          {isPlaying ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </motion.button>

        {/* Time */}
        <span style={{
          fontSize: 13,
          fontFamily: 'var(--font-mono)',
          color: 'var(--text-secondary)',
          fontWeight: 500,
          minWidth: 90
        }}>
          {fmtTime(currentTime)}
          <span style={{ opacity: 0.4, margin: '0 3px' }}>/</span>
          {fmtTime(duration)}
        </span>

        <div style={{ flex: 1 }} />

        {/* Track selector */}
        <div style={{
          display: 'flex',
          gap: 1,
          background: 'var(--bg-tertiary)',
          borderRadius: 'var(--radius-sm)',
          padding: 2
        }}>
          {(['mixed', 'system', 'mic'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTrack(t)}
              style={{
                padding: '4px 10px',
                fontSize: 11,
                fontWeight: 500,
                borderRadius: 6,
                background: track === t ? 'var(--bg-card)' : 'transparent',
                color: track === t ? 'var(--text-primary)' : 'var(--text-tertiary)',
                boxShadow: track === t ? 'var(--shadow-xs)' : 'none',
                textTransform: 'capitalize',
                cursor: 'pointer',
                border: 'none'
              }}
            >
              {t === 'system' ? 'Tab' : t}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
