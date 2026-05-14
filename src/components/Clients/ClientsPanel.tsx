import { useState } from 'react'
import { Plus, Edit2, Trash2, Search, ChevronDown, ChevronRight, Film, Music, Image as ImageIcon } from 'lucide-react'
import { useApp } from '../../store/AppContext'
import type { Client, ClientSpot } from '../../types'
import { detectMediaType, readMediaDuration } from '../../utils/mediaDuration'
import { formatDuration } from '../../utils/time'
import '../AdBreaks/AdBreaksPanel.css'

function MediaIcon({ type }: { type: 'video' | 'audio' | 'image' }) {
  if (type === 'image') return <ImageIcon size={12} />
  if (type === 'audio') return <Music size={12} />
  return <Film size={12} />
}

// ─── Spot Form (inline) ───────────────────────────────────────────────────────
function SpotForm({ spot, onSave, onCancel }: {
  spot?: ClientSpot | null
  onSave: (data: Omit<ClientSpot, 'id' | 'clientId'>) => void
  onCancel: () => void
}) {
  const [title, setTitle] = useState(spot?.title ?? '')
  const [filePath, setFilePath] = useState(spot?.filePath ?? '')
  const [mediaType, setMediaType] = useState<'video'|'audio'|'image'>(spot?.mediaType ?? 'video')
  const [duration, setDuration] = useState(spot?.duration ?? 30)
  const [detecting, setDetecting] = useState(false)

  const browse = async () => {
    const path = await window.spotmaster?.browseVideoFile()
    if (!path) return
    const nameNoExt = path.split(/[\\/]/).pop()?.replace(/\.[^.]+$/, '') ?? ''
    const mt = detectMediaType(path)
    setFilePath(path)
    setMediaType(mt)
    if (!title) setTitle(nameNoExt)
    if (mt !== 'image') {
      setDetecting(true)
      const dur = await readMediaDuration(path, mt)
      setDetecting(false)
      if (dur !== null) setDuration(dur)
    }
  }

  return (
    <div className="ab-spot-form" style={{ margin: '6px 0' }}>
      <div className="form-group-sm">
        <label>Título do Spot</label>
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex: Spot Verão 30s" autoFocus />
      </div>
      <div className="form-group-sm">
        <label>Arquivo</label>
        <div className="ab-file-picker">
          <input type="text" readOnly value={filePath ? filePath.split(/[\\/]/).pop()! : ''} placeholder="Nenhum arquivo selecionado" />
          <button type="button" className="btn-primary-sm" onClick={browse}>Procurar...</button>
        </div>
      </div>
      <div className="ab-form-row">
        <div className="form-group-sm">
          <label>Duração (s){detecting && <span className="ab-detecting"> detectando...</span>}</label>
          <input type="number" value={duration} min={1} onChange={e => setDuration(parseInt(e.target.value) || 30)} disabled={detecting} style={{ width: 80 }} />
        </div>
        {filePath && (
          <div className="ab-media-badge">
            <MediaIcon type={mediaType} />
            {mediaType === 'video' ? 'Vídeo' : mediaType === 'audio' ? 'Áudio' : 'Imagem'}
          </div>
        )}
      </div>
      <div className="form-actions">
        <button className="btn-cancel" onClick={onCancel}>Cancelar</button>
        <button className="btn-save" onClick={() => onSave({ title: title.trim(), filePath, mediaType, duration })} disabled={!title.trim() || !filePath}>
          Salvar Spot
        </button>
      </div>
    </div>
  )
}

// ─── Main Panel ───────────────────────────────────────────────────────────────
export default function ClientsPanel() {
  const { state, dispatch, t } = useApp()
  const { clients, playLog, clientSpots } = state

  const [editing, setEditing] = useState<Client | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', contact: '', email: '', phone: '', notes: '' })
  const [search, setSearch] = useState('')
  const [expandedClient, setExpandedClient] = useState<string | null>(null)
  const [editingSpot, setEditingSpot] = useState<{ clientId: string; spot?: ClientSpot } | null>(null)

  const openNew = () => {
    setEditing(null)
    setForm({ name: '', contact: '', email: '', phone: '', notes: '' })
    setShowForm(true)
  }

  const openEdit = (c: Client) => {
    setEditing(c)
    setForm({ name: c.name, contact: c.contact ?? '', email: c.email ?? '', phone: c.phone ?? '', notes: c.notes ?? '' })
    setShowForm(true)
  }

  const handleSave = () => {
    if (!form.name.trim()) return
    if (editing) {
      dispatch({ type: 'UPDATE_CLIENT', payload: { ...editing, ...form } })
    } else {
      dispatch({ type: 'ADD_CLIENT', payload: { id: crypto.randomUUID(), ...form, createdAt: new Date().toISOString() } })
    }
    setShowForm(false)
  }

  const handleDelete = (id: string) => {
    if (window.confirm(t.common.confirmDelete)) dispatch({ type: 'DELETE_CLIENT', payload: id })
  }

  const handleSaveSpot = (clientId: string, data: Omit<ClientSpot, 'id' | 'clientId'>) => {
    if (editingSpot?.spot) {
      dispatch({ type: 'UPDATE_CLIENT_SPOT', payload: { ...editingSpot.spot, ...data } })
    } else {
      dispatch({ type: 'ADD_CLIENT_SPOT', payload: { id: crypto.randomUUID(), clientId, ...data } })
    }
    setEditingSpot(null)
  }

  const handleDeleteSpot = (id: string) => {
    if (window.confirm(t.common.confirmDelete)) dispatch({ type: 'DELETE_CLIENT_SPOT', payload: id })
  }

  const set = (field: string, val: string) => setForm(f => ({ ...f, [field]: val }))
  const airedCount = (clientId: string) => playLog.filter(l => l.clientId === clientId && l.status === 'aired').length
  const spotsOf = (clientId: string) => clientSpots.filter(s => s.clientId === clientId)

  const visibleClients = search.trim()
    ? clients.filter(c => c.name.toLowerCase().includes(search.toLowerCase()))
    : clients

  if (showForm) {
    return (
      <div className="clients-panel">
        <div className="panel-header">
          <h2>{editing ? t.clients.editClient : t.clients.newClient}</h2>
          <button className="btn-cancel-sm" onClick={() => setShowForm(false)}>{t.common.cancel}</button>
        </div>
        <div className="adbreak-form">
          {[
            { field: 'name', label: t.clients.name },
            { field: 'contact', label: t.clients.contact },
            { field: 'email', label: t.clients.email },
            { field: 'phone', label: t.clients.phone },
          ].map(({ field, label }) => (
            <div key={field} className="form-group-sm">
              <label>{label}</label>
              <input value={(form as Record<string, string>)[field]} onChange={e => set(field, e.target.value)} />
            </div>
          ))}
          <div className="form-group-sm">
            <label>{t.clients.notes}</label>
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={3}
              style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 6, padding: '7px 10px', color: 'var(--text-primary)', fontSize: '0.85rem', outline: 'none', fontFamily: 'inherit', resize: 'vertical' }} />
          </div>
          <div className="form-actions">
            <button className="btn-cancel" onClick={() => setShowForm(false)}>{t.common.cancel}</button>
            <button className="btn-save" onClick={handleSave}>{t.common.save}</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="clients-panel">
      <div className="panel-header">
        <h2>{t.clients.title}</h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px' }}>
            <Search size={12} style={{ color: 'var(--text-secondary)' }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar anunciante..."
              style={{ background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: '0.8rem', width: 150 }} />
          </div>
          <button className="btn-primary-sm" onClick={openNew}><Plus size={14} /> {t.clients.newClient}</button>
        </div>
      </div>

      {visibleClients.length === 0 ? (
        <div className="panel-empty">{clients.length === 0 ? t.clients.empty : 'Nenhum resultado.'}</div>
      ) : (
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {visibleClients.map(c => {
            const spots = spotsOf(c.id)
            const isExpanded = expandedClient === c.id
            const isAddingSpot = editingSpot?.clientId === c.id && !editingSpot.spot
            const editingClientSpot = editingSpot?.clientId === c.id && editingSpot.spot ? editingSpot.spot : null

            return (
              <div key={c.id} className="adbreak-card" style={{ margin: '6px 12px', borderRadius: 8 }}>
                {/* Client header row */}
                <div className="adbreak-card-header" style={{ cursor: 'pointer' }}
                  onClick={() => setExpandedClient(isExpanded ? null : c.id)}>
                  <div className="ab-block-info" style={{ flex: 1 }}>
                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    <strong style={{ fontSize: '0.88rem' }}>{c.name}</strong>
                    {c.contact && <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{c.contact}</span>}
                    <span className="ab-dur-badge" style={{ background: 'color-mix(in srgb, #f59e0b 12%, transparent)', color: '#f59e0b', borderColor: '#f59e0b40' }}>
                      {spots.length} spot{spots.length !== 1 ? 's' : ''}
                    </span>
                    {airedCount(c.id) > 0 && (
                      <span className="ab-loaded-badge">{airedCount(c.id)} veiculados</span>
                    )}
                  </div>
                  <div className="adbreak-card-actions" onClick={e => e.stopPropagation()}>
                    <button className="btn-add-sm" onClick={() => { setExpandedClient(c.id); setEditingSpot({ clientId: c.id }) }}
                      style={{ fontSize: '0.72rem', padding: '3px 8px' }}>
                      <Plus size={11} /> Spot
                    </button>
                    <button title="Editar" onClick={() => openEdit(c)}><Edit2 size={13} /></button>
                    <button title="Excluir" onClick={() => handleDelete(c.id)} className="btn-danger-icon"><Trash2 size={13} /></button>
                  </div>
                </div>

                {/* Expanded: spots list */}
                {isExpanded && (
                  <div className="ab-spots-body">
                    {(isAddingSpot || editingClientSpot) && (
                      <SpotForm
                        spot={editingClientSpot}
                        onSave={data => handleSaveSpot(c.id, data)}
                        onCancel={() => setEditingSpot(null)}
                      />
                    )}
                    {spots.length === 0 && !isAddingSpot && (
                      <p className="ab-empty-msg">
                        {t.clients.noSpots}
                        <button className="btn-add-sm" style={{ marginLeft: 8 }}
                          onClick={() => setEditingSpot({ clientId: c.id })}>
                          <Plus size={11} /> {t.clients.addSpot}
                        </button>
                      </p>
                    )}
                    {spots.map((spot, idx) => (
                      <div key={spot.id} className="adbreak-item-row ab-spot-row">
                        <span className="item-num">{idx + 1}</span>
                        <MediaIcon type={spot.mediaType} />
                        <span className="ab-spot-title">{spot.title}</span>
                        <span className="ab-spot-dur">{formatDuration(spot.duration)}</span>
                        <button
                          className="adbreak-card-actions-btn"
                          onClick={() => setEditingSpot({ clientId: c.id, spot })}
                          title="Editar"
                        >
                          <Edit2 size={12} />
                        </button>
                        <button
                          className="adbreak-card-actions-btn btn-danger-icon"
                          onClick={() => handleDeleteSpot(spot.id)}
                          title="Excluir"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
