import { useState, useEffect } from 'react'
import { X, Monitor, Search } from 'lucide-react'
import { useApp } from '../../store/AppContext'
import type { VmixInput, PlaylistItem } from '../../types'
import { INPUT_TYPE_LABELS, spotTypeForVmix } from '../../utils/vmixInputs'
import './VmixInputPickerModal.css'

interface VmixInputPickerModalProps {
  onClose: () => void
}

export default function VmixInputPickerModal({ onClose }: VmixInputPickerModalProps) {
  const { state, dispatch, t } = useApp()
  const [inputs, setInputs] = useState<VmixInput[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())

  // Load vMix inputs on mount
  useEffect(() => {
    const load = async () => {
      if (!window.spotmaster) { setLoading(false); return }
      setLoading(true)
      const result = await window.spotmaster.vmixRequest({})
      if (result.success && result.data) {
        // Parse inputs from XML
        const parsed: VmixInput[] = []
        const regex = /<input\s([^>]*)>([^<]*)<\/input>/gi
        let m
        while ((m = regex.exec(result.data)) !== null) {
          const attrs = m[1]
          const getText = (attr: string) => {
            const r = attrs.match(new RegExp(`${attr}="([^"]*)"`, 'i'))
            return r ? r[1] : ''
          }
          parsed.push({
            number: getText('number'),
            key: getText('key'),
            type: getText('type'),
            title: m[2].trim() || getText('title'),
            shortTitle: getText('shortTitle'),
            state: getText('state'),
            duration: parseInt(getText('duration') || '0'),
            position: parseInt(getText('position') || '0'),
          })
        }
        setInputs(parsed)
      }
      setLoading(false)
    }
    load()
  }, [])

  const filtered = inputs.filter(inp =>
    inp.title.toLowerCase().includes(filter.toLowerCase()) ||
    inp.number.includes(filter) ||
    inp.type.toLowerCase().includes(filter.toLowerCase())
  )

  const toggleSelect = (num: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(num)) next.delete(num)
      else next.add(num)
      return next
    })
  }

  const handleAdd = () => {
    const toAdd = inputs.filter(i => selected.has(i.number))
    const base = state.playlist.length
    toAdd.forEach((inp, idx) => {
      const item: PlaylistItem = {
        id: crypto.randomUUID(),
        order: base + idx + 1,
        title: inp.title || `Input ${inp.number}`,
        type: spotTypeForVmix(inp.type),
        duration: inp.duration > 0 ? Math.round(inp.duration / 1000) : 30,
        status: 'pending',
        inputName: inp.number,
        clientName: '',
      }
      dispatch({ type: 'ADD_PLAYLIST_ITEM', payload: item })
    })
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box vmix-picker-box" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Monitor size={18} />
            <h2>{t.common.vmixInputPicker}</h2>
          </div>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="vmix-picker-body">
          <p className="vmix-picker-hint">{t.common.vmixInputPickerHint}</p>

          {/* Search */}
          <div className="vmix-search">
            <Search size={14} />
            <input
              autoFocus
              placeholder="Filtrar inputs..."
              value={filter}
              onChange={e => setFilter(e.target.value)}
            />
          </div>

          {/* List */}
          <div className="vmix-input-list">
            {loading && (
              <div className="vmix-list-empty">Carregando inputs do vMix...</div>
            )}
            {!loading && filtered.length === 0 && (
              <div className="vmix-list-empty">{t.common.vmixInputPickerEmpty}</div>
            )}
            {!loading && filtered.map(inp => (
              <label
                key={inp.number}
                className={`vmix-input-row ${selected.has(inp.number) ? 'selected' : ''}`}
              >
                <input
                  type="checkbox"
                  checked={selected.has(inp.number)}
                  onChange={() => toggleSelect(inp.number)}
                />
                <div className="vmix-input-info">
                  <span className="vmix-input-num">#{inp.number}</span>
                  <span className="vmix-input-title">{inp.title}</span>
                  <span className={`vmix-input-type type-tag-${inp.type.toLowerCase()}`}>
                    {INPUT_TYPE_LABELS[inp.type] ?? inp.type}
                  </span>
                  {inp.state && (
                    <span className={`vmix-input-state state-${inp.state.toLowerCase()}`}>
                      {inp.state}
                    </span>
                  )}
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="modal-actions" style={{ padding: '14px 20px', borderTop: '1px solid var(--border)' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            {selected.size > 0 ? `${selected.size} selecionado(s)` : ''}
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-cancel" onClick={onClose}>{t.common.cancel}</button>
            <button className="btn-save" onClick={handleAdd} disabled={selected.size === 0}>
              {t.common.addToPlaylist}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
