import type { ReactNode } from 'react'
import './ui.css'

export default function Badge({
  children,
  tone = 'muted',
  className = '',
}: {
  children: ReactNode
  tone?: 'muted' | 'accent'
  className?: string
}) {
  return <span className={`ui-badge ui-badge--${tone} ${className}`.trim()}>{children}</span>
}
