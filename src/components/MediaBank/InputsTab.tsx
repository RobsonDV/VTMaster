import { useState, useCallback } from 'react'
import { Camera, Film, Music, Monitor, Image as ImageIcon, Wifi, Layers, Radio, Plus, RefreshCw } from 'lucide-react'
import { useApp } from '../../store/AppContext'
import type { VmixInput, PlaylistItem } from '../../types'
import { parseVmixInputs, spotTypeForVmix } from '../../utils/vmixInputs'
import Button from '../ui/Button'

interface Props {
  onInsert: (item: Omit<PlaylistItem, 'id' | 'order' | 'status'>) => void
}

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
    default:          return <Radio {...p} />
  }
}

const TYPE_GROUPS = [
  { label: 'Vídeo', types: ['Video', 'VideoList', 'VirtualSet'] },
  { label: 'Câmera', types: ['Camera', 'NDI', 'Stream'] },
  { label: 'Áudio', types: ['AudioFile', 'Audio'] },
  { label: 'Gráficos', types: ['GT', 'Xaml', 'Browser', 'Image', 'Colour'] },
  { label: 'Mix', types: ['Mix'] },
  { label: 'Outros', types: [] },
]

function groupForType(type: string): string {
  for (const g of TYPE_GROUPS) {
    if (g.types.includes(type)) return g.label
    if (g.label === 'Outros' && g.types.length === 0) return 'Outros'
  }
  return 'Outros'
}

export default function InputsTab({ onInsert }: Props) {
  const { state } = useApp()
  const [inputs, setInputs] = useState<VmixInput[]>([])
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [search, setSearch] = useState('')
  const [typeFilter] = useState('')

  const refresh = useCallback(async () => {
    if (!window.spotmaster) return
    setLoading(true)
    const result = await window.spotmaster.vmixRequest({})
    if (result.success && result.data) setInputs(parseVmixInputs(result.data))
    setLoading(false)
    setLoaded(true)
  }, [])

  const filtered = inputs.filter(inp => {
    if (typeFilter && groupForType(inp.type) !== typeFilter) return false
    if (!search.trim()) return true
    return inp.title.toLowerCase().includes(search.toLowerCase())
  })

  const byGroup: Record<string, VmixInput[]> = {}
  filtered.forEach(inp => {
    const g = groupForType(inp.type)
    if (!byGroup[g]) byGroup[g] = []
    byGroup[g].push(inp)
  })

  if (!state.vmixStatus.connected) {
    return (
      <div className="mb-empty" style={{ marginTop: 24 }}>
        vMix desconectado.<br />Conecte o vMix para listar os inputs.
      </div>
    )
  }

  return (
    <>
      <div className="mb-search" style={{ display: 'flex', gap: 6 }}>
        <input
          placeholder="Buscar input…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ flex: 1 }}
        />
        <Button size="sm" variant="ghost" icon={<RefreshCw size={11} />} onClick={refresh} disabled={loading} />
      </div>

      {!loaded && !loading && (
        <div className="mb-empty">
          Clique em <RefreshCw size={12} style={{ display: 'inline', verticalAlign: 'middle' }} /> para carregar os inputs do vMix.
        </div>
      )}

      {loading && <div className="mb-loading">Carregando inputs…</div>}

      {loaded && !loading && (
        <div className="mb-list">
          {filtered.length === 0 && (
            <div className="mb-empty">Nenhum input encontrado{search ? ' para esta busca' : ''}.</div>
          )}
          {Object.entries(byGroup).map(([group, items]) => (
            <div key={group}>
              <div className="mb-group-label">{group}</div>
              {items.map(inp => (
                <div key={inp.key} className="mb-item">
                  <TypeIcon type={inp.type} />
                  <div className="mb-item-info">
                    <div className="mb-item-name" title={inp.title}>{inp.title}</div>
                    <div className="mb-item-meta">#{inp.number} · {inp.type}</div>
                  </div>
                  {inp.key === state.vmixStatus.activeInput && (
                    <span className="mb-type-badge" style={{ color: 'var(--success, #22c55e)' }}>PGM</span>
                  )}
                  {inp.key === state.vmixStatus.previewInput && (
                    <span className="mb-type-badge" style={{ color: 'var(--warning, #f59e0b)' }}>PVW</span>
                  )}
                  <button
                    className="mb-item-add"
                    title="Inserir na programação"
                    onClick={() => onInsert({
                      title: inp.title,
                      inputName: inp.number,
                      type: spotTypeForVmix(inp.type),
                      mediaType: 'video',
                      duration: inp.duration > 0 ? Math.round(inp.duration / 1000) : 30,
                    })}
                  >
                    <Plus size={13} />
                  </button>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </>
  )
}
