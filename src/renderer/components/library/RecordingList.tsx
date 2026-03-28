import { useLibraryStore, type Recording } from '../../stores/library-store'
import { format, isToday, isYesterday, isThisWeek } from 'date-fns'
import Badge from '../shared/Badge'

function groupByDate(recordings: Recording[]): Map<string, Recording[]> {
  const groups = new Map<string, Recording[]>()

  for (const rec of recordings) {
    const date = new Date(rec.date)
    let label: string

    if (isToday(date)) {
      label = 'Today'
    } else if (isYesterday(date)) {
      label = 'Yesterday'
    } else if (isThisWeek(date)) {
      label = format(date, 'EEEE') // Day name
    } else {
      label = format(date, 'MMM d, yyyy')
    }

    if (!groups.has(label)) groups.set(label, [])
    groups.get(label)!.push(rec)
  }

  return groups
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  if (m >= 60) {
    const h = Math.floor(m / 60)
    return `${h}h ${m % 60}m`
  }
  return `${m}m ${s}s`
}

function statusBadge(rec: Recording) {
  if (rec.transcript_status === 'done' && rec.summary_status === 'done') {
    return <Badge label="Complete" color="green" />
  }
  if (rec.transcript_status === 'processing' || rec.summary_status === 'processing') {
    return <Badge label="Processing" color="orange" />
  }
  if (rec.transcript_status === 'failed') {
    return <Badge label="Failed" color="red" />
  }
  if (rec.transcript_status === 'done') {
    return <Badge label="Transcribed" color="blue" />
  }
  return <Badge label="Pending" color="gray" />
}

export default function RecordingList() {
  const recordings = useLibraryStore((s) => s.recordings)
  const selectedId = useLibraryStore((s) => s.selectedId)
  const selectRecording = useLibraryStore((s) => s.selectRecording)

  if (recordings.length === 0) {
    return (
      <div
        style={{
          padding: 24,
          textAlign: 'center',
          color: 'var(--text-tertiary)',
          fontSize: 13
        }}
      >
        No recordings yet. Start a recording from the menu bar.
      </div>
    )
  }

  const groups = groupByDate(recordings)

  return (
    <div style={{ paddingBottom: 12 }}>
      {Array.from(groups.entries()).map(([label, recs]) => (
        <div key={label}>
          <div
            style={{
              padding: '10px 16px 4px',
              fontSize: 11,
              fontWeight: 600,
              color: 'var(--text-secondary)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}
          >
            {label}
          </div>
          {recs.map((rec) => (
            <div
              key={rec.id}
              onClick={() => selectRecording(rec.id)}
              style={{
                padding: '10px 16px',
                margin: '0 8px',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                background: selectedId === rec.id ? 'var(--bg-active)' : 'transparent',
                transition: 'background 0.1s ease'
              }}
              onMouseEnter={(e) => {
                if (selectedId !== rec.id) e.currentTarget.style.background = 'var(--bg-hover)'
              }}
              onMouseLeave={(e) => {
                if (selectedId !== rec.id) e.currentTarget.style.background = 'transparent'
              }}
            >
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 500,
                  marginBottom: 4,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}
              >
                {rec.title || 'Untitled Recording'}
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8
                }}
              >
                <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                  {format(new Date(rec.date), 'h:mm a')} &middot; {formatDuration(rec.duration_seconds)}
                </span>
                {statusBadge(rec)}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
