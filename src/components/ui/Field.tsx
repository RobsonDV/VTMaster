import type { ReactNode } from 'react'
import './ui.css'

interface FieldProps {
  label?: ReactNode
  hint?: ReactNode
  className?: string
  children: ReactNode
}

export function Field({ label, hint, className = '', children }: FieldProps) {
  return (
    <div className={`ui-field ${className}`.trim()}>
      {label ? <label className="ui-field-label">{label}</label> : null}
      <div className="ui-field-control">{children}</div>
      {hint ? <div className="ui-field-hint">{hint}</div> : null}
    </div>
  )
}

export function FieldRow({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`ui-field-row ${className}`.trim()}>{children}</div>
}

export function Section({ title, children, className = '' }: { title?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`ui-section ${className}`.trim()}>
      {title ? <div className="ui-section-title">{title}</div> : null}
      {children}
    </section>
  )
}
