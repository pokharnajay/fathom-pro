import { useState, useRef, useEffect } from 'react'
import { type Transcript, type TranscriptSegment } from '../../stores/library-store'

interface TranscriptViewerProps {
  transcript: Transcript
  currentTime: number
  onSeek: (time: number) => void
  recordingId: string
}

const speakerColors = [
  '#007aff', '#34c759', '#ff9500', '#af52de',
  '#ff3b30', '#5ac8fa', '#ffcc00', '#ff2d55'
]

function getSpeakerColor(speaker: string, speakers: { id: string; label: string }[]): string {
  const idx = speakers.findIndex((s) => s.label === speaker || s.id === speaker)
  return speakerColors[idx >= 0 ? idx % speakerColors.length : 0]
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export default function TranscriptViewer({ transcript, currentTime, onSeek, recordingId }: TranscriptViewerProps) {
  const [speakerLabels, setSpeakerLabels] = useState<Record<string, string>>({})
  const [editingSpeaker, setEditingSpeaker] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const activeRef = useRef<HTMLDivElement>(null)

  // Initialize speaker labels from transcript
  useEffect(() => {
    const labels: Record<string, string> = {}
    for (const s of transcript.speakers) {
      labels[s.id] = s.label
    }
    setSpeakerLabels(labels)
  }, [transcript.speakers])

  // Auto-scroll to active segment
  useEffect(() => {
    if (activeRef.current && containerRef.current) {
      const container = containerRef.current
      const el = activeRef.current
      const elTop = el.offsetTop - container.offsetTop
      const elBottom = elTop + el.offsetHeight
      const scrollTop = container.scrollTop
      const viewHeight = container.clientHeight

      if (elTop < scrollTop || elBottom > scrollTop + viewHeight) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }
  }, [currentTime])

  const handleSpeakerEdit = (speakerId: string) => {
    setEditingSpeaker(speakerId)
    setEditValue(speakerLabels[speakerId] || '')
  }

  const saveSpeakerLabel = async () => {
    if (!editingSpeaker || !editValue.trim()) return
    const newLabels = { ...speakerLabels, [editingSpeaker]: editValue.trim() }
    setSpeakerLabels(newLabels)
    setEditingSpeaker(null)

    // Persist speaker label update
    try {
      // Update the transcript file with new speaker labels
      const rec = await window.api.db.getRecording(recordingId)
      if (rec?.transcript) {
        rec.transcript.speakers = rec.transcript.speakers.map((s: { id: string; label: string }) =>
          s.id === editingSpeaker ? { ...s, label: editValue.trim() } : s
        )
      }
    } catch { /* best effort */ }
  }

  const findActiveSegment = (): number => {
    for (let i = transcript.segments.length - 1; i >= 0; i--) {
      if (transcript.segments[i].start <= currentTime) return i
    }
    return -1
  }

  const activeIdx = findActiveSegment()
  let lastSpeaker = ''

  return (
    <div ref={containerRef} style={{ maxHeight: '100%', overflow: 'auto' }}>
      {transcript.segments.map((seg, i) => {
        const isActive = i === activeIdx
        const showSpeaker = seg.speaker !== lastSpeaker
        lastSpeaker = seg.speaker

        const speakerId = transcript.speakers.find((s) => s.label === seg.speaker)?.id || seg.speaker
        const color = getSpeakerColor(seg.speaker, transcript.speakers)
        const displayName = speakerLabels[speakerId] || seg.speaker

        return (
          <div
            key={i}
            ref={isActive ? activeRef : undefined}
            style={{
              padding: '6px 0',
              borderLeft: isActive ? `3px solid ${color}` : '3px solid transparent',
              paddingLeft: 12,
              background: isActive ? 'var(--bg-hover)' : 'transparent',
              borderRadius: 4,
              transition: 'background 0.15s ease'
            }}
          >
            {showSpeaker && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                {editingSpeaker === speakerId ? (
                  <input
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={saveSpeakerLabel}
                    onKeyDown={(e) => e.key === 'Enter' && saveSpeakerLabel()}
                    autoFocus
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      padding: '2px 6px',
                      width: 120,
                      borderColor: color
                    }}
                  />
                ) : (
                  <span
                    onClick={() => handleSpeakerEdit(speakerId)}
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color,
                      cursor: 'pointer',
                      borderBottom: `1px dashed ${color}`
                    }}
                    title="Click to rename speaker"
                  >
                    {displayName}
                  </span>
                )}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <span
                onClick={() => onSeek(seg.start)}
                style={{
                  fontSize: 11,
                  color: 'var(--text-tertiary)',
                  fontFamily: 'var(--font-mono)',
                  cursor: 'pointer',
                  flexShrink: 0,
                  marginTop: 1
                }}
                title="Click to jump to this point"
              >
                {formatTime(seg.start)}
              </span>
              <span style={{ fontSize: 13, lineHeight: 1.5, userSelect: 'text' }}>
                {seg.text}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
