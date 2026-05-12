import type { ReactNode } from 'react'
import './ui.css'

interface PageHeaderProps {
  title: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
}

export default function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <div className="ui-page-header">
      <div className="ui-page-header-copy">
        <h2 className="ui-page-header-title">{title}</h2>
        {subtitle ? <div className="ui-page-header-subtitle">{subtitle}</div> : null}
      </div>
      {actions ? <div className="ui-page-header-actions">{actions}</div> : null}
    </div>
  )
}
