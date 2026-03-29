import log from '../utils/logger'
import type { Transcript, Summary } from '../utils/constants'

const SYSTEM_PROMPT = `You are a meeting assistant. Given a meeting transcript, extract:
1. **Summary** (3-5 sentences, what was this meeting about)
2. **Key Decisions** (bullet points of decisions made)
3. **Action Items** (who needs to do what, with deadlines if mentioned)
4. **Open Questions** (unresolved topics that need follow-up)

Format as JSON with keys: summary, decisions, action_items, open_questions.
Each action_item should have: assignee, task, deadline (null if not mentioned).
decisions and open_questions are arrays of strings.

Return ONLY valid JSON, no markdown fences.`

export async function generateSummary(
  transcript: Transcript,
  apiKey: string
): Promise<Summary> {
  log.info('Generating AI summary for recording:', transcript.recording_id)

  // Build transcript text
  const transcriptText = transcript.segments
    .map((seg) => `${seg.speaker} [${formatTime(seg.start)}]: ${seg.text}`)
    .join('\n')

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Meeting transcript:\n\n${transcriptText}`
        }
      ]
    })
  })

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`Claude API error ${response.status}: ${errText}`)
  }

  const data = await response.json()
  const content = data.content?.[0]?.text

  if (!content) {
    throw new Error('Empty response from Claude API')
  }

  // Parse the JSON response
  let parsed: {
    summary: string
    decisions: string[]
    action_items: { assignee: string; task: string; deadline: string | null }[]
    open_questions: string[]
  }

  try {
    // Handle potential markdown fencing
    const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    parsed = JSON.parse(cleanContent)
  } catch {
    log.error('Failed to parse Claude response as JSON:', content)
    // Create a basic summary from raw text
    parsed = {
      summary: content,
      decisions: [],
      action_items: [],
      open_questions: []
    }
  }

  return {
    recording_id: transcript.recording_id,
    summary: parsed.summary,
    decisions: parsed.decisions || [],
    action_items: (parsed.action_items || []).map((item) => ({
      assignee: item.assignee || 'Unassigned',
      task: item.task,
      deadline: item.deadline || null
    })),
    open_questions: parsed.open_questions || [],
    created_at: new Date().toISOString()
  }
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}
