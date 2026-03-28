import { type ReactNode, type ButtonHTMLAttributes } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  size?: 'sm' | 'md'
  children: ReactNode
}

export default function Button({ variant = 'secondary', size = 'md', children, style, ...props }: ButtonProps) {
  const baseStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 'var(--radius-sm)',
    fontWeight: 500,
    transition: 'all 0.15s ease',
    cursor: props.disabled ? 'not-allowed' : 'pointer',
    opacity: props.disabled ? 0.5 : 1,
    padding: size === 'sm' ? '4px 10px' : '7px 14px',
    fontSize: size === 'sm' ? 12 : 13,
    ...style
  }

  const variants: Record<string, React.CSSProperties> = {
    primary: {
      background: 'var(--accent)',
      color: '#fff'
    },
    secondary: {
      background: 'var(--bg-tertiary)',
      color: 'var(--text-primary)'
    },
    danger: {
      background: 'var(--red)',
      color: '#fff'
    },
    ghost: {
      background: 'transparent',
      color: 'var(--text-secondary)'
    }
  }

  return (
    <button style={{ ...baseStyle, ...variants[variant] }} {...props}>
      {children}
    </button>
  )
}
