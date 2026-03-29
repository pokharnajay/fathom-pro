import { useEffect, useState } from 'react'
import Button from '../shared/Button'
import Spinner from '../shared/Spinner'

interface Config {
  recording: {
    quality: string
    recordScreen: boolean
    micDeviceId: string
    storagePath: string
  }
  transcription: {
    engine: string
    deepgramApiKey: string
    autoTranscribe: boolean
  }
  ai: {
    autoSummarize: boolean
    claudeApiKey: string
  }
  clickup: {
    apiKey: string
    defaultListId: string
    autoPush: boolean
  }
  shortcuts: {
    toggleRecording: string
    openLibrary: string
  }
}

type Tab = 'recording' | 'transcription' | 'ai' | 'clickup' | 'shortcuts'

export default function PreferencesView() {
  const [config, setConfig] = useState<Config | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('recording')
  const [saving, setSaving] = useState(false)
  const [testingClickup, setTestingClickup] = useState(false)
  const [clickupLists, setClickupLists] = useState<{ id: string; name: string }[]>([])

  useEffect(() => {
    loadConfig()
  }, [])

  const loadConfig = async () => {
    const c = await window.api.config.get()
    setConfig(c)
  }

  const updateField = async (key: string, value: unknown) => {
    await window.api.config.set(key, value)
    await loadConfig()
  }

  const testClickup = async () => {
    if (!config?.clickup.apiKey) return
    setTestingClickup(true)
    try {
      const ok = await window.api.clickup.test(config.clickup.apiKey)
      if (ok) {
        const lists = await window.api.clickup.getLists()
        setClickupLists(lists)
        alert('Connected successfully!')
      } else {
        alert('Connection failed. Check your API key.')
      }
    } catch {
      alert('Connection failed.')
    }
    setTestingClickup(false)
  }

  if (!config) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <Spinner />
      </div>
    )
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'recording', label: 'Recording' },
    { key: 'transcription', label: 'Transcription' },
    { key: 'ai', label: 'AI Summary' },
    { key: 'clickup', label: 'ClickUp' },
    { key: 'shortcuts', label: 'Shortcuts' }
  ]

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      {/* Sidebar */}
      <div
        style={{
          width: 160,
          background: 'var(--bg-sidebar)',
          borderRight: '1px solid var(--border)',
          paddingTop: 'var(--titlebar-height)',
          display: 'flex',
          flexDirection: 'column',
          gap: 2
        }}
      >
        <div className="titlebar-drag" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 'var(--titlebar-height)' }} />
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '8px 16px',
              fontSize: 13,
              fontWeight: activeTab === tab.key ? 600 : 400,
              color: activeTab === tab.key ? 'var(--accent)' : 'var(--text-primary)',
              background: activeTab === tab.key ? 'var(--bg-active)' : 'transparent',
              borderRadius: 'var(--radius-sm)',
              textAlign: 'left',
              margin: '0 8px',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, padding: '24px 28px', paddingTop: 'calc(var(--titlebar-height) + 12px)', overflow: 'auto' }}>
        <div className="titlebar-drag" style={{ position: 'absolute', top: 0, left: 160, right: 0, height: 'var(--titlebar-height)' }} />

        {activeTab === 'recording' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <h2 style={{ fontSize: 17, fontWeight: 600 }}>Recording</h2>

            <Field label="Quality">
              <select
                value={config.recording.quality}
                onChange={(e) => updateField('recording.quality', e.target.value)}
                style={{ width: '100%' }}
              >
                <option value="standard">Standard (128 kbps AAC)</option>
                <option value="high">High (256 kbps AAC)</option>
                <option value="lossless">Lossless (WAV 16-bit)</option>
              </select>
            </Field>

            <Field label="Record Screen">
              <Toggle
                checked={config.recording.recordScreen}
                onChange={(v) => updateField('recording.recordScreen', v)}
              />
            </Field>

            <Field label="Storage Path">
              <input
                type="text"
                value={config.recording.storagePath || '~/MeetRec'}
                onChange={(e) => updateField('recording.storagePath', e.target.value)}
                style={{ width: '100%' }}
              />
            </Field>
          </div>
        )}

        {activeTab === 'transcription' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <h2 style={{ fontSize: 17, fontWeight: 600 }}>Transcription</h2>

            <Field label="Engine">
              <select
                value={config.transcription.engine}
                onChange={(e) => updateField('transcription.engine', e.target.value)}
                style={{ width: '100%' }}
              >
                <option value="whisper">Local Whisper (Free, Private)</option>
                <option value="deepgram">Deepgram Nova-3 (Cloud, Fast)</option>
              </select>
            </Field>

            <Field label="Deepgram API Key">
              <input
                type="password"
                value={config.transcription.deepgramApiKey}
                onChange={(e) => updateField('transcription.deepgramApiKey', e.target.value)}
                placeholder="Enter Deepgram API key..."
                style={{ width: '100%' }}
              />
            </Field>

            <Field label="Auto-Transcribe">
              <Toggle
                checked={config.transcription.autoTranscribe}
                onChange={(v) => updateField('transcription.autoTranscribe', v)}
              />
              <span style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                Automatically transcribe after recording stops
              </span>
            </Field>
          </div>
        )}

        {activeTab === 'ai' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <h2 style={{ fontSize: 17, fontWeight: 600 }}>AI Summary</h2>

            <Field label="Claude API Key">
              <input
                type="password"
                value={config.ai.claudeApiKey}
                onChange={(e) => updateField('ai.claudeApiKey', e.target.value)}
                placeholder="Enter Claude API key..."
                style={{ width: '100%' }}
              />
            </Field>

            <Field label="Auto-Summarize">
              <Toggle
                checked={config.ai.autoSummarize}
                onChange={(v) => updateField('ai.autoSummarize', v)}
              />
              <span style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                Automatically generate summary after transcription
              </span>
            </Field>
          </div>
        )}

        {activeTab === 'clickup' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <h2 style={{ fontSize: 17, fontWeight: 600 }}>ClickUp</h2>

            <Field label="API Key">
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="password"
                  value={config.clickup.apiKey}
                  onChange={(e) => updateField('clickup.apiKey', e.target.value)}
                  placeholder="Enter ClickUp API key..."
                  style={{ flex: 1 }}
                />
                <Button variant="secondary" size="sm" onClick={testClickup} disabled={testingClickup}>
                  {testingClickup ? 'Testing...' : 'Test'}
                </Button>
              </div>
            </Field>

            <Field label="Default List">
              {clickupLists.length > 0 ? (
                <select
                  value={config.clickup.defaultListId}
                  onChange={(e) => updateField('clickup.defaultListId', e.target.value)}
                  style={{ width: '100%' }}
                >
                  <option value="">Select a list...</option>
                  {clickupLists.map((list) => (
                    <option key={list.id} value={list.id}>
                      {list.name}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={config.clickup.defaultListId}
                  onChange={(e) => updateField('clickup.defaultListId', e.target.value)}
                  placeholder="List ID (test connection to browse)"
                  style={{ width: '100%' }}
                />
              )}
            </Field>

            <Field label="Auto-Push Action Items">
              <Toggle
                checked={config.clickup.autoPush}
                onChange={(v) => updateField('clickup.autoPush', v)}
              />
              <span style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                Automatically push action items after summary generation
              </span>
            </Field>
          </div>
        )}

        {activeTab === 'shortcuts' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <h2 style={{ fontSize: 17, fontWeight: 600 }}>Keyboard Shortcuts</h2>

            <Field label="Toggle Recording">
              <input
                type="text"
                value={config.shortcuts.toggleRecording}
                onChange={(e) => updateField('shortcuts.toggleRecording', e.target.value)}
                style={{ width: '100%' }}
              />
              <span style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                Default: Alt+Shift+R. Restart app to apply changes.
              </span>
            </Field>

            <Field label="Open Library">
              <input
                type="text"
                value={config.shortcuts.openLibrary}
                onChange={(e) => updateField('shortcuts.openLibrary', e.target.value)}
                style={{ width: '100%' }}
              />
              <span style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                Default: Alt+Shift+L. Restart app to apply changes.
              </span>
            </Field>
          </div>
        )}
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>
        {label}
      </label>
      {children}
    </div>
  )
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      style={{
        width: 44,
        height: 24,
        borderRadius: 12,
        background: checked ? 'var(--accent)' : 'var(--bg-tertiary)',
        position: 'relative',
        border: 'none',
        cursor: 'pointer',
        transition: 'background 0.2s ease'
      }}
    >
      <div
        style={{
          width: 20,
          height: 20,
          borderRadius: '50%',
          background: '#fff',
          position: 'absolute',
          top: 2,
          left: checked ? 22 : 2,
          transition: 'left 0.2s ease',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
        }}
      />
    </button>
  )
}
