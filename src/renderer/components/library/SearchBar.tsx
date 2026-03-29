import { useState, useCallback } from 'react'
import { useLibraryStore } from '../../stores/library-store'

export default function SearchBar() {
  const [query, setQuery] = useState('')
  const search = useLibraryStore((s) => s.search)
  const searchResults = useLibraryStore((s) => s.searchResults)
  const selectRecording = useLibraryStore((s) => s.selectRecording)

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value
      setQuery(val)
      search(val)
    },
    [search]
  )

  return (
    <div style={{ position: 'relative' }}>
      <input
        type="text"
        placeholder="Search transcripts..."
        value={query}
        onChange={handleChange}
        style={{
          width: '100%',
          padding: '6px 10px 6px 30px',
          background: 'var(--bg-tertiary)',
          border: '1px solid var(--border-light)',
          borderRadius: 'var(--radius-sm)',
          fontSize: 13
        }}
      />
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="var(--text-tertiary)"
        strokeWidth="2"
        style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }}
      >
        <circle cx="11" cy="11" r="8" />
        <path d="M21 21l-4.35-4.35" />
      </svg>

      {/* Search results dropdown */}
      {query && searchResults.length > 0 && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            marginTop: 4,
            background: 'var(--bg-primary)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            boxShadow: 'var(--shadow-md)',
            maxHeight: 300,
            overflow: 'auto',
            zIndex: 100
          }}
        >
          {searchResults.map((r, i) => (
            <div
              key={i}
              onClick={() => {
                selectRecording(r.recording_id)
                setQuery('')
              }}
              style={{
                padding: '8px 12px',
                cursor: 'pointer',
                borderBottom: '1px solid var(--border-light)',
                fontSize: 12
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <div style={{ color: 'var(--text-secondary)', fontWeight: 500, marginBottom: 2 }}>
                {r.speaker}
              </div>
              <div style={{ color: 'var(--text-primary)' }}>{r.text}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
