import { useState, useEffect, useCallback } from 'react'
import {
  X, RefreshCw, Search, Camera, Film, Music, Monitor,
  Image as ImageIcon, Wifi, GripVertical, Plus, Layers, Radio,
} from 'lucide-react'
import { useApp } from '../../store/AppContext'
import type { VmixInput, PlaylistItem, SpotType } from '../../types'
import './VmixInputPanel.css'

// ── Constants ────────────────────────────────────────────────────────────────
export const INPUT_TYPE_LABELS: Record<string, string> = {
  Video:        'Vídeo',
  Camera:       'Câmera',
  NDI:          'NDI',
  VirtualSet:   'Cenário Virtual',
  Mix:          'Mix',
  Colour:       'Cor sólida',
  GT:           'Gráfico GT',
  Browser:      'Browser',
  Image:        'Imagem',
  AudioFile:    'Áudio',
  Flash:        'Flash',
  PowerPoint:   'PowerPoint',
  VideoList:    'Lista de Vídeos',
  Xaml:         'XAML',
  DVDInput:     'DVD',
}

export function spotTypeForVmix(type: string): SpotType {
  if (type === 'Camera' || type === 'NDI') return 'programa'
  if (type === 'Video' || type === 'VideoList') return 'spot'
  if (type === 'GT' || type === 'Browser' || type === 'Xaml') return 'vinheta'
  return 'outros'
}

export function parseVmixInputs(xml: string): VmixInput[] {
  const inputs: VmixInput[] = []
  const regex = /<input\s([^>]*)>([^<]*)<\/input>/gi
  let m
  while ((m = regex.exec(xml)) !== null) {
    const attrs = m[1]
    const get = (attr: string) => {
      const r = attrs.match(new RegExp(`${attr}="([^"]*)"`, 'i'))
      return r ? r[1] : ''
    }
    const num = get('number')
    if (!num) continue
    inputs.push({
      number: num,
      key: get('key'),
      type: get('type'),
      title: m[2].trim() || get('title') || get('shortTitle') || `Input ${num}`,
      shortTitle: get('shortTitle'),
      state: get('state'),
      duration: parseInt(get('duration') || '0'),
      position: parseInt(get('position') || '0'),
    })
  }
  return inputs
}

// ── Type icon map ─────────────────────────────────────────────────────────────
function TypeIcon({ type }: { type: string }) {
  const p = { size: 13 }
  switch (type) {
    case 'Camera':    return <Camera {...p} />
    case 'NDI':       return <Wifi {...p} />
    case 'Video':
    case 'VideoList': return <Film {...p} />
    case 'Image':     return <ImageIcon {...p} />
    case 'AudioFile': return <Music {...p} />
    case 'GT':
    case 'Browser':
    case 'Xaml':      return <Monitor {...p} />
    case 'Mix':       return <Layers {...p} />
    case 'Colour':    return <Radio {...p} />
    default:          return <Film {...p} />
  }
}

// ── State colour ──────────────────────────────────────────────────────────────
function stateClass(state: string) {
  if (!state) return ''
  const s = state.toLowerCase()
  if (s === 'running') return 'vip-state-on'
  if (s === 'paused')  return 'vip-state-pause'
  return 'vip-state-off'
}

interface VmixInputPanelProps {
  onClose: () => void
}

export default function VmixInputPanel({ onClose }: VmixInputPanelProps) {
  const { state, dispatch } = useApp()
  const [inputs, setInputs] = useState<VmixInput[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const [dragId, setDragId] = useState<string | null>(null)

  const fetchInputs = useCallback(async () => {
    if (!window.spotmaster) { setLoading(false); return }
    setLoading(true)
    const result = await window.spotmaster.vmixRequest({})
    if (result.success && result.data) {
      setInputs(parseVmixInputs(result.data))
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchInputs() }, [fetchInputs])

  const addToEnd = (inp: VmixInput) => {
    const item: PlaylistItem = {
      id: crypto.randomUUID(),
      order: state.playlist.length + 1,
      title: inp.title,
      type: spotTypeForVmix(inp.type),
      duration: inp.duration > 0 ? Math.round(inp.duration / 1000) : 30,
      status: 'pending',
      inputName: inp.number,
    }
    dispatch({ type: 'ADD_PLAYLIST_ITEM', payload: item })
  }

  const filtered = filter.trim()
    ? inputs.filter(inp =>
        inp.title.toLowerCase().includes(filter.toLowerCase()) ||
        inp.number.includes(filter) ||
        (INPUT_TYPE_LABELS[inp.type] ?? inp.type).toLowerCase().includes(filter.toLowerCase())
      )
    : inputs

  return (
    <div className="vmix-panel">
      {/* Header */}
      <div className="vip-header">
        <div className="vip-title">
          <Monitor size={14} />
          <span>Inputs do vMix</span>
          {!loading && <span className="vip-count">{filtered.length}</span>}
        </div>
        <div className="vip-header-btns">
          <button
            className="vip-btn"
            onClick={fetchInputs}
            title="Atualizar lista"
            disabled={loading}
          >
            <RefreshCw size={13} className={loading ? 'spin' : ''} />
          </button>
          <button className="vip-btn" onClick={onClose} title="Fechar painel">
            <X size={13} />
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="vip-search">
        <Search size={12} />
        <input
          autoFocus
          value={filter}
          onChange={e => setFilter(e.target.value)}
          placeholder="Filtrar..."
        />
      </div>

      {/* Hint */}
      <div className="vip-hint">
        <GripVertical size={11} /> Arraste para a playlist &nbsp;·&nbsp;
        <Plus size={10} /> Adiciona ao final
      </div>

      {/* List */}
      <div className="vip-list">
        {loading && (
          <div className="vip-empty">Carregando inputs do vMix...</div>
        )}
        {!loading && filtered.length === 0 && (
          <div className="vip-empty">
            {inputs.length === 0
              ? 'Nenhum input encontrado. Verifique a conexão com o vMix.'
              : 'Nenhum resultado para o filtro.'}
          </div>
        )}
        {!loading && filtered.map(inp => {
          const alreadyInPlaylist = state.playlist.some(
            i => i.inputName === inp.number || i.inputName === inp.title
          )
          return (
          <div
            key={inp.number}
            className={`vip-item${dragId === inp.number ? ' vip-dragging' : ''}${alreadyInPlaylist ? ' vip-in-playlist' : ''}`}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData('application/vmix-input', JSON.stringify(inp))
              e.dataTransfer.effectAllowed = 'copy'
              setDragId(inp.number)
            }}
            onDragEnd={() => setDragId(null)}
          >
            <GripVertical size={12} className="vip-grip" />
            <div className="vip-type-icon" title={INPUT_TYPE_LABELS[inp.type] ?? inp.type}>
              <TypeIcon type={inp.type} />
            </div>
            <div className="vip-info">
              <span className="vip-num">#{inp.number}</span>
              <span className="vip-name">{inp.title}</span>
              <span className="vip-type-label">{INPUT_TYPE_LABELS[inp.type] ?? inp.type}</span>
              {inp.state && (
                <span className={`vip-state ${stateClass(inp.state)}`}>{inp.state}</span>
              )}
              {alreadyInPlaylist && (
                <span className="vip-playlist-badge" title="Já está na playlist">✓ na playlist</span>
              )}
            </div>
            <button
              className="vip-add-btn"
              onClick={() => addToEnd(inp)}
              title="Adicionar ao final da playlist"
            >
              <Plus size={12} />
            </button>
          </div>
          )
        })}
      </div>
    </div>
  )
}
