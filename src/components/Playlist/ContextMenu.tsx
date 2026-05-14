import { useEffect, useRef } from 'react'
import { Pause, Zap, MonitorPlay, Clock, Copy, SkipForward, CheckCircle } from 'lucide-react'
import type { PlaylistItem } from '../../types'
import './ContextMenu.css'

export interface ContextMenuState {
  x: number
  y: number
  item: PlaylistItem
  index: number
}

interface ContextMenuProps {
  menu: ContextMenuState
  onClose: () => void
  onInsertPause: (afterOrder: number) => void
  onInsertVmixAction: (afterOrder: number) => void
  onInsertVmixInput: (afterOrder: number) => void
  onEditSchedule: (item: PlaylistItem) => void
  onDuplicate: (item: PlaylistItem, afterOrder: number) => void
  onSkip: (item: PlaylistItem) => void
  onMarkDone: (item: PlaylistItem) => void
}

export default function ContextMenu({
  menu, onClose,
  onInsertPause, onInsertVmixAction, onInsertVmixInput,
  onEditSchedule, onDuplicate, onSkip, onMarkDone,
}: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null)
  // Keep a stable ref to onClose so the document listeners never need to re-register
  const onCloseRef = useRef(onClose)
  useEffect(() => { onCloseRef.current = onClose })

  // Fechar ao clicar fora ou pressionar Escape — registered once on mount only
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onCloseRef.current()
    }
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCloseRef.current() }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [])  

  // Ajustar posição para não sair da tela
  const style: React.CSSProperties = {
    position: 'fixed',
    top: Math.min(menu.y, window.innerHeight - 280),
    left: Math.min(menu.x, window.innerWidth - 220),
    zIndex: 9999,
  }

  const isPlayable = menu.item.status === 'pending' || menu.item.status === 'playing'
  const isPlayed   = menu.item.status === 'done' || menu.item.status === 'skipped'

  const run = (fn: () => void) => { fn(); onClose() }

  return (
    <div ref={ref} className="context-menu" style={style}>
      {/* Cabeçalho: nome do item */}
      <div className="ctx-header">
        <span className="ctx-item-name">{menu.item.title}</span>
      </div>

      <div className="ctx-separator" />

      {/* ── Inserir após ── */}
      <div className="ctx-section-label">Inserir após</div>

      <button className="ctx-item" onClick={() => run(() => onInsertPause(menu.item.order))}>
        <Pause size={13} />
        <span>Pausa</span>
        <span className="ctx-hint">aguarda em silêncio</span>
      </button>

      <button className="ctx-item ctx-item--purple" onClick={() => run(() => onInsertVmixAction(menu.item.order))}>
        <Zap size={13} />
        <span>Ação vMix</span>
        <span className="ctx-hint">AudioOff, Fade...</span>
      </button>

      <button className="ctx-item" onClick={() => run(() => onInsertVmixInput(menu.item.order))}>
        <MonitorPlay size={13} />
        <span>Input do vMix</span>
        <span className="ctx-hint">câmera, NDI...</span>
      </button>

      <div className="ctx-separator" />

      {/* ── Edição ── */}
      <div className="ctx-section-label">Editar</div>

      <button className="ctx-item" onClick={() => run(() => onEditSchedule(menu.item))}>
        <Clock size={13} />
        <span>Horário Agendado</span>
      </button>

      <button className="ctx-item" onClick={() => run(() => onDuplicate(menu.item, menu.item.order))}>
        <Copy size={13} />
        <span>Duplicar Item</span>
      </button>

      <div className="ctx-separator" />

      {/* ── Status ── */}
      {!isPlayed && (
        <>
          {isPlayable && (
            <button className="ctx-item" onClick={() => run(() => onSkip(menu.item))}>
              <SkipForward size={13} />
              <span>Pular</span>
            </button>
          )}
          <button className="ctx-item" onClick={() => run(() => onMarkDone(menu.item))}>
            <CheckCircle size={13} />
            <span>Marcar como Veiculado</span>
          </button>
        </>
      )}
    </div>
  )
}
