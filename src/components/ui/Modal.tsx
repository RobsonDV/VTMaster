import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react'
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
  const boxRef = useRef<HTMLDivElement | null>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  const boxStyle: CSSProperties = {}
  if (maxWidth !== undefined) boxStyle.maxWidth = maxWidth
  if (minWidth !== undefined) boxStyle.minWidth = minWidth

  useEffect(() => {
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null

    const focusId = window.requestAnimationFrame(() => {
      const preferredTarget = boxRef.current?.querySelector<HTMLElement>(
        '[autofocus], input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled])'
      )
      ;(preferredTarget ?? boxRef.current)?.focus({ preventScroll: true })
    })

    return () => {
      window.cancelAnimationFrame(focusId)
      const restoreTarget = previousFocusRef.current
      if (!restoreTarget) return
      window.requestAnimationFrame(() => {
        restoreTarget.focus({ preventScroll: true })
      })
    }
  }, [])

  return (
    <div className="ui-modal-overlay" onClick={onClose}>
      <div
        ref={boxRef}
        className="ui-modal-box"
        style={boxStyle}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
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
