interface SpinnerProps {
  size?: number
}

export default function Spinner({ size = 18 }: SpinnerProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      style={{ animation: 'spin 0.8s linear infinite' }}
    >
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="var(--text-tertiary)"
        strokeWidth="3"
        fill="none"
        strokeDasharray="40 60"
        strokeLinecap="round"
      />
    </svg>
  )
}
