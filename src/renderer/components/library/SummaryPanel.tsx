import { useState } from 'react'
import { type Summary } from '../../stores/library-store'
import Button from '../shared/Button'
import Badge from '../shared/Badge'

interface SummaryPanelProps {
  summary: Summary
  recordingId: string
  meetingTitle: string
}

export default function SummaryPanel({ summary, recordingId, meetingTitle }: SummaryPanelProps) {
  const [isPushing, setIsPushing] = useState(false)
  const [pushedItems, setPushedItems] = useState<Set<number>>(new Set())

  const handlePushAll = async () => {
    setIsPushing(true)
    try {
      await window.api.clickup.push(recordingId)
      const allIndices = new Set(summary.action_items.map((_, i) => i))
      setPushedItems(allIndices)
    } catch (err) {
      console.error('Push to ClickUp failed:', err)
      alert('Failed to push to ClickUp. Check your API key and list settings.')
    }
    setIsPushing(false)
  }

  const handleRegenerate = async () => {
    try {
      await window.api.ai.summarize(recordingId)
    } catch (err) {
      console.error('Regenerate summary failed:', err)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Summary */}
      <section>
        <SectionHeader title="Summary" />
        <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text-primary)', userSelect: 'text' }}>
          {summary.summary}
        </p>
      </section>

      {/* Key Decisions */}
      {summary.decisions.length > 0 && (
        <section>
          <SectionHeader title="Key Decisions" />
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {summary.decisions.map((d, i) => (
              <li key={i} style={{ display: 'flex', gap: 8, fontSize: 13, lineHeight: 1.5, userSelect: 'text' }}>
                <span style={{ color: 'var(--green)', flexShrink: 0 }}>&#10003;</span>
                <span>{d}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Action Items */}
      {summary.action_items.length > 0 && (
        <section>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <SectionHeader title="Action Items" noMargin />
            <Button
              variant="primary"
              size="sm"
              onClick={handlePushAll}
              disabled={isPushing || pushedItems.size === summary.action_items.length}
            >
              {isPushing ? 'Pushing...' : pushedItems.size > 0 ? 'Pushed to ClickUp' : 'Push All to ClickUp'}
            </Button>
          </div>
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {summary.action_items.map((item, i) => (
              <li
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'start',
                  gap: 10,
                  padding: '10px 14px',
                  background: 'var(--bg-secondary)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: 13
                }}
              >
                <span
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 4,
                    border: pushedItems.has(i) ? 'none' : '2px solid var(--border)',
                    background: pushedItems.has(i) ? 'var(--green)' : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    marginTop: 1,
                    color: '#fff',
                    fontSize: 11
                  }}
                >
                  {pushedItems.has(i) && '&#10003;'}
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500, marginBottom: 4, userSelect: 'text' }}>{item.task}</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Badge label={item.assignee} color="blue" />
                    {item.deadline && <Badge label={`Due: ${item.deadline}`} color="orange" />}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Open Questions */}
      {summary.open_questions.length > 0 && (
        <section>
          <SectionHeader title="Open Questions" />
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {summary.open_questions.map((q, i) => (
              <li key={i} style={{ display: 'flex', gap: 8, fontSize: 13, lineHeight: 1.5, userSelect: 'text' }}>
                <span style={{ color: 'var(--orange)', flexShrink: 0 }}>?</span>
                <span>{q}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Regenerate */}
      <div style={{ paddingTop: 8 }}>
        <Button variant="ghost" size="sm" onClick={handleRegenerate}>
          Regenerate Summary
        </Button>
      </div>
    </div>
  )
}

function SectionHeader({ title, noMargin }: { title: string; noMargin?: boolean }) {
  return (
    <h3
      style={{
        fontSize: 15,
        fontWeight: 600,
        color: 'var(--text-primary)',
        marginBottom: noMargin ? 0 : 10
      }}
    >
      {title}
    </h3>
  )
}
