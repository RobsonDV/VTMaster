import { useState, useEffect, useRef, useMemo } from 'react'
import {
  Tv, ListVideo, LayoutGrid, CalendarDays, Users, Megaphone,
  MonitorPlay, ClipboardList, FileBarChart, Music2, Volume2,
  Database, Play, Search, ArrowRight, MonitorCog, Activity,
} from 'lucide-react'
import { useApp } from '../../store/AppContext'
import './CommandPalette.css'

type ActionType = 'panel' | 'client' | 'campaign' | 'template' | 'audiolayer'

interface PaletteItem {
  id: string
  type: ActionType
  label: string
  sub?: string
  icon: React.ReactNode
  action: () => void
}

interface Props {
  onClose: () => void
  onNavigate: (panel: string) => void
  onToggleMediaBank: () => void
  onToggleOnAir: () => void
}

const NAV_ITEMS = [
  { id: 'programacao', label: 'Programação do Dia',    icon: <Tv size={14} /> },
  { id: 'playlist',   label: 'Playlist',               icon: <ListVideo size={14} /> },
  { id: 'grade',      label: 'Estrutura Semanal',      icon: <LayoutGrid size={14} /> },
  { id: 'adbreaks',   label: 'Blocos Comerciais',      icon: <CalendarDays size={14} /> },
  { id: 'clients',    label: 'Anunciantes',             icon: <Users size={14} /> },
  { id: 'campaigns',  label: 'Comercial Pro',           icon: <Megaphone size={14} /> },
  { id: 'grafismos',  label: 'Grafismos',               icon: <MonitorPlay size={14} /> },
  { id: 'outputs',    label: 'Saidas vMix',             icon: <MonitorCog size={14} /> },
  { id: 'vmixhealth', label: 'Saude vMix',              icon: <Activity size={14} /> },
  { id: 'log',        label: 'Log de Veiculação',       icon: <ClipboardList size={14} /> },
  { id: 'reports',    label: 'Relatórios',              icon: <FileBarChart size={14} /> },
  { id: 'autoprog',   label: 'AutoProg',                icon: <Music2 size={14} /> },
  { id: 'audiopro',   label: 'AudioPro',                icon: <Volume2 size={14} /> },
]

export default function CommandPalette({ onClose, onNavigate, onToggleMediaBank, onToggleOnAir }: Props) {
  const { state, triggerAudioLayer } = useApp()
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Fechar com ESC
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const items = useMemo<PaletteItem[]>(() => {
    const q = query.trim().toLowerCase()

    // Ferramentas especiais
    const tools: PaletteItem[] = [
      {
        id: 'tool-onair',
        type: 'panel',
        label: 'Modo On Air',
        sub: 'Tela simplificada de operação ao vivo',
        icon: <Play size={14} />,
        action: () => { onToggleOnAir(); onClose() },
      },
      {
        id: 'tool-mediabank',
        type: 'panel',
        label: 'Banco de Mídia',
        sub: 'Vídeos, Áudios, Inputs, Ações',
        icon: <Database size={14} />,
        action: () => { onToggleMediaBank(); onClose() },
      },
    ]

    // Painéis de navegação
    const panels: PaletteItem[] = NAV_ITEMS.map(n => ({
      id: `nav-${n.id}`,
      type: 'panel' as const,
      label: `Ir para: ${n.label}`,
      icon: n.icon,
      action: () => { onNavigate(n.id); onClose() },
    }))

    // Anunciantes
    const clients: PaletteItem[] = state.clients.map(c => ({
      id: `client-${c.id}`,
      type: 'client' as const,
      label: c.name,
      sub: 'Anunciante',
      icon: <Users size={14} />,
      action: () => { onNavigate('clients'); onClose() },
    }))

    // Campanhas
    const campaigns: PaletteItem[] = state.campaigns.filter(c => c.status === 'active').map(c => ({
      id: `campaign-${c.id}`,
      type: 'campaign' as const,
      label: c.name,
      sub: `Campanha · ${c.status}`,
      icon: <Megaphone size={14} />,
      action: () => { onNavigate('campaigns'); onClose() },
    }))

    // Camadas de áudio
    const layers: PaletteItem[] = state.audioLayers.map(l => ({
      id: `audiolayer-${l.id}`,
      type: 'audiolayer' as const,
      label: `Disparar: ${l.name}`,
      sub: 'Camada de áudio',
      icon: <Volume2 size={14} />,
      action: () => { triggerAudioLayer(l.id); onClose() },
    }))

    const all = [...tools, ...panels, ...clients, ...campaigns, ...layers]

    if (!q) return all.slice(0, 20)

    return all.filter(item =>
      item.label.toLowerCase().includes(q) ||
      (item.sub ?? '').toLowerCase().includes(q)
    ).slice(0, 20)
  }, [query, state.clients, state.campaigns, state.audioLayers, onClose, onNavigate, onToggleMediaBank, onToggleOnAir, triggerAudioLayer])

  // Teclado: setas + Enter
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelected(s => Math.min(s + 1, items.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelected(s => Math.max(s - 1, 0))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        items[selected]?.action()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [items, selected])

  useEffect(() => {
    const el = listRef.current?.children[selected] as HTMLElement | undefined
    el?.scrollIntoView({ block: 'nearest' })
  }, [selected])

  return (
    <div className="cp-backdrop" onClick={onClose}>
      <div className="cp-modal" onClick={e => e.stopPropagation()}>
        <div className="cp-search-row">
          <Search size={16} className="cp-search-icon" />
          <input
            ref={inputRef}
            className="cp-input"
            placeholder="Buscar painel, anunciante, campanha, áudio…"
            value={query}
            onChange={e => { setQuery(e.target.value); setSelected(0) }}
          />
          <kbd className="cp-esc">ESC</kbd>
        </div>

        <div className="cp-list" ref={listRef}>
          {items.length === 0 && (
            <div className="cp-empty">Nenhum resultado para "{query}"</div>
          )}
          {items.map((item, idx) => (
            <button
              key={item.id}
              className={`cp-item ${idx === selected ? 'cp-item-selected' : ''}`}
              onClick={item.action}
              onMouseEnter={() => setSelected(idx)}
            >
              <span className="cp-item-icon">{item.icon}</span>
              <span className="cp-item-body">
                <span className="cp-item-label">{item.label}</span>
                {item.sub && <span className="cp-item-sub">{item.sub}</span>}
              </span>
              <ArrowRight size={12} className="cp-item-arrow" />
            </button>
          ))}
        </div>

        <div className="cp-footer">
          <span><kbd>↑↓</kbd> navegar</span>
          <span><kbd>Enter</kbd> executar</span>
          <span><kbd>ESC</kbd> fechar</span>
        </div>
      </div>
    </div>
  )
}
