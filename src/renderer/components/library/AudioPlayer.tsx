import { useEffect, useRef, useState } from 'react'
import Button from '../shared/Button'

interface AudioPlayerProps {
  filePath: string
  onTimeUpdate?: (time: number) => void
  seekTo?: number
}

export default function AudioPlayer({ filePath, onTimeUpdate, seekTo }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const waveformRef = useRef<HTMLDivElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [track, setTrack] = useState<'mixed' | 'system' | 'mic'>('mixed')

  const audioSrc = `file://${filePath}/audio_${track}.wav`

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

  // Handle external seek
  useEffect(() => {
    if (seekTo !== undefined && audioRef.current && Math.abs(audioRef.current.currentTime - seekTo) > 1) {
      audioRef.current.currentTime = seekTo
    }
  }, [seekTo])

  const togglePlay = () => {
    if (!audioRef.current) return
    if (isPlaying) {
      audioRef.current.pause()
    } else {
      audioRef.current.play()
    }
    setIsPlaying(!isPlaying)
  }

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !duration) return
    const rect = e.currentTarget.getBoundingClientRect()
    const pct = (e.clientX - rect.left) / rect.width
    audioRef.current.currentTime = pct * duration
  }

  const formatTime = (s: number) => {
    if (isNaN(s)) return '00:00'
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  }

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <div
      style={{
        background: 'var(--bg-secondary)',
        borderRadius: 'var(--radius-md)',
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 16
      }}
    >
      <audio ref={audioRef} src={audioSrc} preload="metadata" />

      {/* Waveform / progress bar */}
      <div
        ref={waveformRef}
        onClick={handleSeek}
        style={{
          height: 48,
          borderRadius: 'var(--radius-sm)',
          background: 'var(--bg-tertiary)',
          cursor: 'pointer',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        {/* Progress fill */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: `${progress}%`,
            background: 'rgba(0, 122, 255, 0.2)',
            transition: 'width 0.1s linear'
          }}
        />

        {/* Playhead */}
        <div
          style={{
            position: 'absolute',
            left: `${progress}%`,
            top: 0,
            bottom: 0,
            width: 2,
            background: 'var(--accent)',
            transition: 'left 0.1s linear'
          }}
        />

        {/* Fake waveform bars */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            height: '100%',
            padding: '0 4px',
            gap: 1
          }}
        >
          {Array.from({ length: 80 }).map((_, i) => {
            const h = 8 + Math.sin(i * 0.7) * 10 + Math.random() * 12
            return (
              <div
                key={i}
                style={{
                  flex: 1,
                  height: h,
                  background: i / 80 * 100 < progress ? 'var(--accent)' : 'var(--text-tertiary)',
                  borderRadius: 1,
                  opacity: 0.6
                }}
              />
            )
          })}
        </div>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          onClick={togglePlay}
          style={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            background: 'var(--accent)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 16,
            border: 'none',
            cursor: 'pointer'
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
        </button>

        <span style={{ fontSize: 13, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>

        <div style={{ flex: 1 }} />

        {/* Track selector */}
        <div style={{ display: 'flex', gap: 4 }}>
          {(['mixed', 'system', 'mic'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTrack(t)}
              style={{
                padding: '3px 8px',
                fontSize: 11,
                borderRadius: 4,
                background: track === t ? 'var(--accent)' : 'var(--bg-tertiary)',
                color: track === t ? '#fff' : 'var(--text-secondary)',
                textTransform: 'capitalize'
              }}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
