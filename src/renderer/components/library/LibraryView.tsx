import { useEffect } from 'react'
import { useLibraryStore } from '../../stores/library-store'
import { useRecordingStore } from '../../stores/recording-store'
import RecordingList from './RecordingList'
import RecordingDetail from './RecordingDetail'
import SearchBar from './SearchBar'
import FilterBar from './FilterBar'

export default function LibraryView() {
  const fetchRecordings = useLibraryStore((s) => s.fetchRecordings)
  const selectedId = useLibraryStore((s) => s.selectedId)
  const recordingState = useRecordingStore((s) => s.state)

  useEffect(() => {
    fetchRecordings()
  }, [])

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* Sidebar */}
      <div
        style={{
          width: 'var(--sidebar-width)',
          minWidth: 260,
          borderRight: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--bg-sidebar)'
        }}
      >
        {/* Titlebar drag area */}
        <div
          className="titlebar-drag"
          style={{
            height: 'var(--titlebar-height)',
            display: 'flex',
            alignItems: 'flex-end',
            padding: '0 16px 8px',
            gap: 8,
            flexShrink: 0
          }}
        >
          <h1
            style={{
              fontSize: 20,
              fontWeight: 700,
              paddingLeft: 60 // Space for traffic lights
            }}
          >
            MeetRec
          </h1>
          {(recordingState === 'recording' || recordingState === 'paused') && (
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: recordingState === 'recording' ? 'var(--red)' : 'var(--orange)',
                animation: recordingState === 'recording' ? 'pulse 1.5s ease-in-out infinite' : undefined,
                marginBottom: 4
              }}
            />
          )}
        </div>

        {/* Search */}
        <div className="titlebar-no-drag" style={{ padding: '0 12px 8px' }}>
          <SearchBar />
        </div>

        {/* Filters */}
        <div className="titlebar-no-drag" style={{ padding: '0 12px 8px' }}>
          <FilterBar />
        </div>

        {/* Recording list */}
        <div style={{ flex: 1, overflow: 'auto' }}>
          <RecordingList />
        </div>
      </div>

      {/* Detail panel */}
      <div style={{ flex: 1, overflow: 'auto', background: 'var(--bg-primary)' }}>
        {selectedId ? (
          <RecordingDetail />
        ) : (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: 'var(--text-tertiary)',
              gap: 8
            }}
          >
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v4l3 3" />
            </svg>
            <span style={{ fontSize: 15 }}>Select a recording to view details</span>
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  )
}
