import { useLibraryStore } from '../../stores/library-store'

const filters = [
  { label: 'All', value: 'all' as const },
  { label: 'This Week', value: 'week' as const },
  { label: 'This Month', value: 'month' as const }
]

export default function FilterBar() {
  const dateFilter = useLibraryStore((s) => s.dateFilter)
  const setDateFilter = useLibraryStore((s) => s.setDateFilter)

  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {filters.map((f) => (
        <button
          key={f.value}
          onClick={() => setDateFilter(f.value)}
          style={{
            padding: '3px 10px',
            borderRadius: 'var(--radius-sm)',
            fontSize: 12,
            fontWeight: 500,
            background: dateFilter === f.value ? 'var(--accent)' : 'transparent',
            color: dateFilter === f.value ? '#fff' : 'var(--text-secondary)',
            transition: 'all 0.15s ease'
          }}
        >
          {f.label}
        </button>
      ))}
    </div>
  )
}
