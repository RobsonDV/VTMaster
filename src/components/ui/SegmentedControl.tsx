import type { ReactNode } from 'react'
import Button from './Button'
import './ui.css'

interface Option<T extends string> {
  value: T
  label: ReactNode
  icon?: ReactNode
  variant?: 'secondary' | 'purple' | 'success' | 'warning'
}

interface SegmentedControlProps<T extends string> {
  value: T
  onChange: (value: T) => void
  options: Option<T>[]
}

export default function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
}: SegmentedControlProps<T>) {
  return (
    <div className="ui-segmented">
      {options.map((option) => (
        <Button
          key={option.value}
          variant={option.variant ?? 'secondary'}
          active={value === option.value}
          onClick={() => onChange(option.value)}
          icon={option.icon}
        >
          {option.label}
        </Button>
      ))}
    </div>
  )
}
