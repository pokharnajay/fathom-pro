import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Spinner from '../shared/Spinner'

interface Config {
  recording: { quality: string; recordScreen: boolean; micDeviceId: string; storagePath: string }
  transcription: { engine: string; deepgramApiKey: string; autoTranscribe: boolean }
  ai: { autoSummarize: boolean; claudeApiKey: string }
  clickup: { apiKey: string; defaultListId: string; autoPush: boolean }
  shortcuts: { toggleRecording: string; openLibrary: string }
}

type Tab = 'recording' | 'transcription' | 'ai' | 'clickup' | 'shortcuts'

const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: 'recording', label: 'Recording',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="3" /></svg> },
  { key: 'transcription', label: 'Transcription',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="23" /></svg> },
  { key: 'ai', label: 'AI Summary',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 1 1 7.072 0l-.548.547A3.374 3.374 0 0 0 14 18.469V19a2 2 0 1 1-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg> },
  { key: 'clickup', label: 'ClickUp',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="9 11 12 14 22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg> },
  { key: 'shortcuts', label: 'Shortcuts',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="2" y="4" width="20" height="16" rx="2" /><path d="M6 8h.001M10 8h.001M14 8h.001M18 8h.001M8 12h8M6 16h.001M10 16h.001M14 16h.001M18 16h.001" /></svg> }
]

export default function PreferencesView() {
  const [config, setConfig] = useState<Config | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('recording')
  const [testingClickup, setTestingClickup] = useState(false)
  const [clickupLists, setClickupLists] = useState<{ id: string; name: string }[]>([])
  const [testResult, setTestResult] = useState<boolean | null>(null)

  useEffect(() => { loadConfig() }, [])

  const loadConfig = async () => { setConfig(await window.api.config.get()) }
  const update = async (key: string, value: unknown) => {
    await window.api.config.set(key, value)
    await loadConfig()
  }

  const testClickup = async () => {
    if (!config?.clickup.apiKey) return
    setTestingClickup(true)
    setTestResult(null)
    try {
      const ok = await window.api.clickup.test(config.clickup.apiKey)
      setTestResult(ok)
      if (ok) setClickupLists(await window.api.clickup.getLists())
    } catch { setTestResult(false) }
    setTestingClickup(false)
  }

  if (!config) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      <Spinner />
    </div>
  )

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      {/* Sidebar */}
      <div style={{
        width: 180,
        background: 'var(--bg-sidebar)',
        backdropFilter: 'blur(40px)',
        borderRight: '1px solid var(--divider)',
        paddingTop: 'var(--titlebar-height)',
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        padding: '60px 8px 16px'
      }}>
        <div className="drag" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 'var(--titlebar-height)' }} />
        {tabs.map((tab) => {
          const active = activeTab === tab.key
          return (
            <motion.button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              whileTap={{ scale: 0.97 }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 12px',
                borderRadius: 'var(--radius-sm)',
                fontSize: 13,
                fontWeight: active ? 600 : 400,
                color: active ? 'var(--accent)' : 'var(--text-primary)',
                background: active ? 'var(--bg-active)' : 'transparent',
                textAlign: 'left',
                border: 'none',
                cursor: 'pointer',
                width: '100%'
              }}
            >
              <span style={{ opacity: active ? 1 : 0.5 }}>{tab.icon}</span>
              {tab.label}
            </motion.button>
          )
        })}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        <div className="drag" style={{ height: 'var(--titlebar-height)', flexShrink: 0 }} />
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8 }}
            transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
            style={{ padding: '8px 28px 28px' }}
          >
            {activeTab === 'recording' && (
              <Section title="Recording">
                <Field label="Quality">
                  <SegmentedControl
                    value={config.recording.quality}
                    options={[
                      { value: 'standard', label: 'Standard (720p)' },
                      { value: 'high', label: 'High (1080p)' },
                      { value: 'lossless', label: 'Lossless' }
                    ]}
                    onChange={(v) => update('recording.quality', v)}
                  />
                </Field>
                <Field label="Record Screen (1080p Video)">
                  <Toggle checked={config.recording.recordScreen} onChange={(v) => update('recording.recordScreen', v)} />
                  <Hint>Records the Meet tab at 1080p 30fps. Only the selected tab is captured.</Hint>
                </Field>
                <Field label="Storage Path">
                  <input value={config.recording.storagePath || '~/MeetRec'} onChange={(e) => update('recording.storagePath', e.target.value)} style={{ width: '100%' }} />
                </Field>
              </Section>
            )}

            {activeTab === 'transcription' && (
              <Section title="Transcription">
                <Field label="Engine">
                  <SegmentedControl
                    value={config.transcription.engine}
                    options={[
                      { value: 'whisper', label: 'Local Whisper' },
                      { value: 'deepgram', label: 'Deepgram Cloud' }
                    ]}
                    onChange={(v) => update('transcription.engine', v)}
                  />
                  <Hint>{config.transcription.engine === 'whisper' ? 'Free, private, runs on your M-series GPU. Requires whisper-cli.' : 'Fast, accurate, speaker diarization. ~$0.26/hr.'}</Hint>
                </Field>
                {config.transcription.engine === 'deepgram' && (
                  <Field label="Deepgram API Key">
                    <input type="password" value={config.transcription.deepgramApiKey} onChange={(e) => update('transcription.deepgramApiKey', e.target.value)} placeholder="Enter key..." style={{ width: '100%' }} />
                  </Field>
                )}
                <Field label="Auto-Transcribe">
                  <Toggle checked={config.transcription.autoTranscribe} onChange={(v) => update('transcription.autoTranscribe', v)} />
                  <Hint>Automatically transcribe when recording stops</Hint>
                </Field>
              </Section>
            )}

            {activeTab === 'ai' && (
              <Section title="AI Summary">
                <div style={{
                  padding: '14px 16px',
                  background: 'var(--accent-soft)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid rgba(0,122,255,0.1)',
                  marginBottom: 16
                }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)', marginBottom: 4 }}>
                    Powered by Claude Code
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    Summaries are generated using your locally installed Claude Code CLI.
                    No API key needed — uses your existing Claude Code authentication.
                  </div>
                </div>
                <Field label="Auto-Summarize">
                  <Toggle checked={config.ai.autoSummarize} onChange={(v) => update('ai.autoSummarize', v)} />
                  <Hint>Automatically generate summary after transcription completes</Hint>
                </Field>
              </Section>
            )}

            {activeTab === 'clickup' && (
              <Section title="ClickUp Integration">
                <Field label="API Key">
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input type="password" value={config.clickup.apiKey} onChange={(e) => update('clickup.apiKey', e.target.value)} placeholder="Enter ClickUp API key..." style={{ flex: 1 }} />
                    <motion.button
                      onClick={testClickup}
                      disabled={testingClickup || !config.clickup.apiKey}
                      whileTap={{ scale: 0.97 }}
                      style={{
                        padding: '8px 14px',
                        borderRadius: 'var(--radius-sm)',
                        background: testResult === true ? 'var(--green-soft)' : testResult === false ? 'var(--red-soft)' : 'var(--bg-tertiary)',
                        color: testResult === true ? 'var(--green)' : testResult === false ? 'var(--red)' : 'var(--text-primary)',
                        fontSize: 12,
                        fontWeight: 600,
                        border: '1px solid var(--border)',
                        cursor: 'pointer'
                      }}
                    >
                      {testingClickup ? <Spinner size={14} /> : testResult === true ? 'Connected!' : testResult === false ? 'Failed' : 'Test'}
                    </motion.button>
                  </div>
                </Field>
                <Field label="Default List">
                  {clickupLists.length > 0 ? (
                    <select value={config.clickup.defaultListId} onChange={(e) => update('clickup.defaultListId', e.target.value)} style={{ width: '100%' }}>
                      <option value="">Select a list...</option>
                      {clickupLists.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                    </select>
                  ) : (
                    <input value={config.clickup.defaultListId} onChange={(e) => update('clickup.defaultListId', e.target.value)} placeholder="List ID (test connection to browse)" style={{ width: '100%' }} />
                  )}
                </Field>
                <Field label="Auto-Push Action Items">
                  <Toggle checked={config.clickup.autoPush} onChange={(v) => update('clickup.autoPush', v)} />
                  <Hint>Automatically create ClickUp tasks after summary generation</Hint>
                </Field>
              </Section>
            )}

            {activeTab === 'shortcuts' && (
              <Section title="Keyboard Shortcuts">
                <Field label="Toggle Recording">
                  <KeyCombo value={config.shortcuts.toggleRecording} />
                  <Hint>Start or stop recording from anywhere</Hint>
                </Field>
                <Field label="Open Library">
                  <KeyCombo value={config.shortcuts.openLibrary} />
                  <Hint>Open the recording library window</Hint>
                </Field>
                <Hint>Restart MeetRec to apply shortcut changes</Hint>
              </Section>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.3px' }}>{title}</h2>
      {children}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>{label}</label>
      {children}
    </div>
  )
}

function Hint({ children }: { children: React.ReactNode }) {
  return <span style={{ fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.4 }}>{children}</span>
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <motion.button
      onClick={() => onChange(!checked)}
      whileTap={{ scale: 0.95 }}
      style={{
        width: 44,
        height: 26,
        borderRadius: 13,
        background: checked ? 'var(--accent)' : 'var(--bg-tertiary)',
        position: 'relative',
        border: 'none',
        cursor: 'pointer',
        transition: 'background 0.2s ease'
      }}
    >
      <motion.div
        animate={{ x: checked ? 20 : 2 }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        style={{
          width: 22,
          height: 22,
          borderRadius: '50%',
          background: '#fff',
          position: 'absolute',
          top: 2,
          left: 0,
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
        }}
      />
    </motion.button>
  )
}

function SegmentedControl({ value, options, onChange }: {
  value: string; options: { value: string; label: string }[]; onChange: (v: string) => void
}) {
  return (
    <div style={{
      display: 'flex',
      gap: 1,
      background: 'var(--bg-tertiary)',
      borderRadius: 'var(--radius-sm)',
      padding: 2
    }}>
      {options.map((opt) => (
        <motion.button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          whileTap={{ scale: 0.97 }}
          style={{
            flex: 1,
            padding: '7px 12px',
            fontSize: 12,
            fontWeight: value === opt.value ? 600 : 400,
            borderRadius: 6,
            background: value === opt.value ? 'var(--bg-card)' : 'transparent',
            color: value === opt.value ? 'var(--text-primary)' : 'var(--text-secondary)',
            boxShadow: value === opt.value ? 'var(--shadow-xs)' : 'none',
            border: 'none',
            cursor: 'pointer'
          }}
        >
          {opt.label}
        </motion.button>
      ))}
    </div>
  )
}

function KeyCombo({ value }: { value: string }) {
  const keys = value.split('+').map((k) => k.trim())
  const symbols: Record<string, string> = { Alt: '⌥', Shift: '⇧', Ctrl: '⌃', Meta: '⌘' }

  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {keys.map((k, i) => (
        <span key={i} style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '4px 8px',
          minWidth: 28,
          background: 'var(--bg-tertiary)',
          borderRadius: 6,
          fontSize: 13,
          fontWeight: 500,
          border: '1px solid var(--border)',
          boxShadow: '0 1px 0 var(--border)'
        }}>
          {symbols[k] || k}
        </span>
      ))}
    </div>
  )
}
