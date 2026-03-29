interface BadgeProps {
  label: string
  color?: 'blue' | 'green' | 'orange' | 'red' | 'gray'
}

const colors = {
  blue: { bg: 'rgba(0, 122, 255, 0.12)', text: '#007aff' },
  green: { bg: 'rgba(52, 199, 89, 0.12)', text: '#34c759' },
  orange: { bg: 'rgba(255, 149, 0, 0.12)', text: '#ff9500' },
  red: { bg: 'rgba(255, 59, 48, 0.12)', text: '#ff3b30' },
  gray: { bg: 'rgba(142, 142, 147, 0.12)', text: '#8e8e93' }
}

export default function Badge({ label, color = 'gray' }: BadgeProps) {
  const c = colors[color]
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 8px',
        borderRadius: 10,
        fontSize: 11,
        fontWeight: 500,
        background: c.bg,
        color: c.text,
        whiteSpace: 'nowrap'
      }}
    >
      {label}
    </span>
  )
}
