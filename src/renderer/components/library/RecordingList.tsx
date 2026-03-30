import { motion } from 'framer-motion'
import { useLibraryStore, type Recording } from '../../stores/library-store'
import { format, isToday, isYesterday, isThisWeek } from 'date-fns'

function groupByDate(recordings: Recording[]): Map<string, Recording[]> {
  const groups = new Map<string, Recording[]>()
  for (const rec of recordings) {
    const date = new Date(rec.date)
    let label: string
    if (isToday(date)) label = 'Today'
    else if (isYesterday(date)) label = 'Yesterday'
    else if (isThisWeek(date)) label = format(date, 'EEEE')
    else label = format(date, 'MMM d, yyyy')

    if (!groups.has(label)) groups.set(label, [])
    groups.get(label)!.push(rec)
  }
  return groups
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const m = Math.floor(seconds / 60)
  if (m >= 60) return `${Math.floor(m / 60)}h ${m % 60}m`
  return `${m}m`
}

const statusConfig: Record<string, { dot: string; label: string }> = {
  done_done: { dot: 'var(--green)', label: '' },
  done_pending: { dot: 'var(--accent)', label: '' },
  processing: { dot: 'var(--orange)', label: '' },
  failed: { dot: 'var(--red)', label: '' },
  pending: { dot: 'var(--text-tertiary)', label: '' }
}

function getStatus(rec: Recording) {
  if (rec.transcript_status === 'failed') return statusConfig.failed
  if (rec.transcript_status === 'processing' || rec.summary_status === 'processing') return statusConfig.processing
  if (rec.transcript_status === 'done' && rec.summary_status === 'done') return statusConfig.done_done
  if (rec.transcript_status === 'done') return statusConfig.done_pending
  return statusConfig.pending
}

export default function RecordingList() {
  const recordings = useLibraryStore((s) => s.recordings)
  const selectedId = useLibraryStore((s) => s.selectedId)
  const selectRecording = useLibraryStore((s) => s.selectRecording)

  if (recordings.length === 0) {
    return (
      <div style={{
        padding: '40px 24px',
        textAlign: 'center',
        color: 'var(--text-tertiary)',
        fontSize: 13,
        lineHeight: 1.6
      }}>
        No recordings yet.
        <br />
        <span style={{ fontSize: 12 }}>Start recording from the menu bar or press ⌥⇧R</span>
      </div>
    )
  }

  const groups = groupByDate(recordings)

  return (
    <div style={{ padding: '0 0 16px' }}>
      {Array.from(groups.entries()).map(([label, recs]) => (
        <div key={label}>
          <div style={{
            padding: '12px 20px 4px',
            fontSize: 11,
            fontWeight: 600,
            color: 'var(--text-tertiary)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em'
          }}>
            {label}
          </div>
          {recs.map((rec, i) => {
            const isSelected = selectedId === rec.id
            const status = getStatus(rec)

            return (
              <motion.div
                key={rec.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03, duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                onClick={() => selectRecording(rec.id)}
                style={{
                  padding: '10px 14px',
                  margin: '2px 8px',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  background: isSelected ? 'var(--bg-active)' : 'transparent',
                  transition: 'background 0.12s ease'
                }}
                whileHover={{ background: isSelected ? 'var(--bg-active)' : 'var(--bg-hover)' }}
                whileTap={{ scale: 0.98 }}
              >
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: 3
                }}>
                  {/* Status dot */}
                  <span style={{
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    background: status.dot,
                    flexShrink: 0
                  }} />
                  <span style={{
                    fontSize: 13,
                    fontWeight: 500,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    flex: 1
                  }}>
                    {rec.title || 'Untitled Recording'}
                  </span>
                </div>
                <div style={{
                  fontSize: 11,
                  color: 'var(--text-secondary)',
                  paddingLeft: 15
                }}>
                  {format(new Date(rec.date), 'h:mm a')} &middot; {formatDuration(rec.duration_seconds)}
                </div>
              </motion.div>
            )
          })}
        </div>
      ))}
    </div>
  )
}
