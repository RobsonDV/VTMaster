import type { CSSProperties, ReactNode } from 'react'
import { X } from 'lucide-react'
import Button from './Button'
import './ui.css'

interface ModalProps {
  title: ReactNode
  onClose: () => void
  children: ReactNode
  actions?: ReactNode
  maxWidth?: number | string
  minWidth?: number | string
  bodyClassName?: string
  bodyStyle?: CSSProperties
}

export default function Modal({
  title,
  onClose,
  children,
  actions,
  maxWidth,
  minWidth,
  bodyClassName = '',
  bodyStyle,
}: ModalProps) {
  const boxStyle: CSSProperties = {}
  if (maxWidth !== undefined) boxStyle.maxWidth = maxWidth
  if (minWidth !== undefined) boxStyle.minWidth = minWidth

  return (
    <div className="ui-modal-overlay" onClick={onClose}>
      <div className="ui-modal-box" style={boxStyle} onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
        <div className="ui-modal-header">
          <div className="ui-modal-title">{title}</div>
          <Button variant="ghost" iconOnly aria-label="Fechar" onClick={onClose} icon={<X size={18} />} />
        </div>
        <div className={`ui-modal-body ${bodyClassName}`.trim()} style={bodyStyle}>
          {children}
        </div>
        {actions ? <div className="ui-modal-footer">{actions}</div> : null}
      </div>
    </div>
  )
}
