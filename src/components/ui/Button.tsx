import type { ButtonHTMLAttributes, ReactNode } from 'react'
import './ui.css'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'warning' | 'purple'
type ButtonSize = 'md' | 'sm'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  icon?: ReactNode
  iconOnly?: boolean
  active?: boolean
}

export default function Button({
  variant = 'secondary',
  size = 'md',
  icon,
  iconOnly = false,
  active = false,
  className = '',
  children,
  type = 'button',
  ...props
}: ButtonProps) {
  const classes = [
    'ui-button',
    `ui-button--${variant}`,
    size === 'sm' ? 'ui-button--sm' : '',
    iconOnly ? 'ui-button--icon' : '',
    active ? 'ui-button--active' : '',
    className,
  ].filter(Boolean).join(' ')

  return (
    <button type={type} className={classes} {...props}>
      {icon}
      {!iconOnly && children}
    </button>
  )
}
