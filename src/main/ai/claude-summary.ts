import { spawn } from 'child_process'
import { existsSync } from 'fs'
import log from '../utils/logger'
import type { Transcript, Summary } from '../utils/constants'

const SUMMARY_PROMPT = `You are a meeting assistant. I'll give you a meeting transcript. Extract the following and return ONLY valid JSON (no markdown fences, no explanation):

{
  "summary": "3-5 sentence overview of the meeting",
  "decisions": ["decision 1", "decision 2"],
  "action_items": [{"assignee": "Name", "task": "what to do", "deadline": "Friday or null"}],
  "open_questions": ["unresolved question 1"]
}

Rules:
- summary should be a concise paragraph
- decisions are specific agreements reached
- action_items must have assignee, task, deadline (null if not mentioned)
- open_questions are unresolved topics needing follow-up
- Return ONLY the JSON object`

/**
 * Generate meeting summary using locally installed Claude Code CLI.
 * This runs `claude` as a subprocess with the transcript piped in.
 * No API key needed — uses the user's existing Claude Code auth.
 */
export async function generateSummary(
  transcript: Transcript,
  _apiKey?: string  // kept for interface compat, not used with CLI
): Promise<Summary> {
  log.info('Generating AI summary via Claude Code CLI for:', transcript.recording_id)

  const transcriptText = transcript.segments
    .map((seg) => `${seg.speaker} [${formatTime(seg.start)}]: ${seg.text}`)
    .join('\n')

  const fullPrompt = `${SUMMARY_PROMPT}\n\nMeeting transcript:\n\n${transcriptText}`

  // Find claude CLI
  const claudePath = findClaudeCli()
  log.info('Using Claude CLI at:', claudePath)

  const responseText = await runClaude(claudePath, fullPrompt)

  // Parse the JSON response
  let parsed: {
    summary: string
    decisions: string[]
    action_items: { assignee: string; task: string; deadline: string | null }[]
    open_questions: string[]
  }

  try {
    const cleanContent = responseText
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim()

    // Find the JSON object in the response
    const jsonStart = cleanContent.indexOf('{')
    const jsonEnd = cleanContent.lastIndexOf('}')
    if (jsonStart === -1 || jsonEnd === -1) {
      throw new Error('No JSON found in response')
    }
    parsed = JSON.parse(cleanContent.slice(jsonStart, jsonEnd + 1))
  } catch (parseErr) {
    log.error('Failed to parse Claude response as JSON:', responseText.slice(0, 500))
    parsed = {
      summary: responseText.slice(0, 500),
      decisions: [],
      action_items: [],
      open_questions: []
    }
  }

  return {
    recording_id: transcript.recording_id,
    summary: parsed.summary || '',
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

function findClaudeCli(): string {
  // Check common install locations
  const paths = [
    '/usr/local/bin/claude',
    '/opt/homebrew/bin/claude',
    `${process.env.HOME}/.npm-global/bin/claude`,
    `${process.env.HOME}/.local/bin/claude`,
    `${process.env.HOME}/.claude/local/claude`
  ]

  for (const p of paths) {
    if (existsSync(p)) return p
  }

  // Try npx as fallback
  return 'claude'
}

function runClaude(claudePath: string, prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(claudePath, [
      '--print',          // Print response and exit (non-interactive)
      '--output-format', 'text',
      prompt
    ], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        // Ensure Claude Code can find its config
        HOME: process.env.HOME || ''
      },
      timeout: 120000 // 2 min timeout
    })

    let stdout = ''
    let stderr = ''

    proc.stdout?.on('data', (data: Buffer) => {
      stdout += data.toString()
    })

    proc.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString()
    })

    proc.on('close', (code) => {
      if (code !== 0 && !stdout) {
        log.error('Claude CLI failed:', code, stderr)
        reject(new Error(`Claude CLI exited with code ${code}: ${stderr}`))
        return
      }
      resolve(stdout.trim())
    })

    proc.on('error', (err) => {
      log.error('Failed to spawn Claude CLI:', err)
      reject(new Error(
        `Failed to run Claude Code CLI: ${err.message}. ` +
        `Make sure Claude Code is installed (npm install -g @anthropic-ai/claude-code).`
      ))
    })
  })
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}
