import { useState } from 'react'
import {
  Plus, Trash2, Edit2, Clock, ToggleLeft, ToggleRight,
  RefreshCw, Film, Music, Image as ImageIcon, ChevronDown, ChevronRight,
} from 'lucide-react'
import { useApp } from '../../store/AppContext'
import type { CommercialBlock, BlockClientSlot, ClientSpot, Client } from '../../types'
import { formatDuration } from '../../utils/time'
import './AdBreaksPanel.css'

// ─── Media helpers ──────────────────────────────────────────────────────────
const IMAGE_EXTS = new Set(['jpg','jpeg','png','gif','bmp','webp','tiff','tif','ico'])
const AUDIO_EXTS = new Set(['mp3','wav','aac','ogg','flac','m4a','wma','opus','aiff'])

function detectMediaType(fp: string): 'video' | 'audio' | 'image' {
  const ext = fp.split('.').pop()?.toLowerCase() ?? ''
  if (IMAGE_EXTS.has(ext)) return 'image'
  if (AUDIO_EXTS.has(ext)) return 'audio'
  return 'video'
}

function toLocalMediaUrl(fp: string) {
  return 'local-media:///' + fp.replace(/\\/g, '/')
}

function readMediaDuration(fp: string, type: 'video' | 'audio'): Promise<number | null> {
  return new Promise(resolve => {
    const el = document.createElement(type === 'audio' ? 'audio' : 'video') as HTMLVideoElement
    el.preload = 'metadata'
    const t = setTimeout(() => { el.src = ''; resolve(null) }, 10_000)
    el.onloadedmetadata = () => {
      clearTimeout(t)
      const d = el.duration
      el.src = ''
      resolve(isFinite(d) && d > 0 ? Math.round(d) : null)
    }
    el.onerror = () => { clearTimeout(t); el.src = ''; resolve(null) }
    el.src = toLocalMediaUrl(fp)
  })
}

function MediaIcon({ type }: { type: 'video' | 'audio' | 'image' }) {
  if (type === 'image') return <ImageIcon size={12} />
  if (type === 'audio') return <Music size={12} />
  return <Film size={12} />
}

// ─── Block Form ──────────────────────────────────────────────────────────────
function BlockForm({ block, clients, onSave, onCancel }: {
  block?: CommercialBlock | null
  clients: Client[]
  onSave: (data: Omit<CommercialBlock, 'id' | 'createdAt' | 'lastLoadedDate'>) => void
  onCancel: () => void
}) {
  const [name, setName] = useState(block?.name ?? '')
  const [time, setTime] = useState(block?.scheduledTime?.slice(0, 5) ?? '08:00')
  const [enabled, setEnabled] = useState(block?.enabled ?? true)
  const [slots, setSlots] = useState<BlockClientSlot[]>(block?.slots ?? [])

  const addSlot = () => setSlots(s => [...s, { clientId: '', spotsCount: 1 }])
  const removeSlot = (i: number) => setSlots(s => s.filter((_, idx) => idx !== i))
  const updateSlot = (i: number, field: keyof BlockClientSlot, val: string | number) =>
    setSlots(s => s.map((slot, idx) => idx === i ? { ...slot, [field]: val } : slot))

  const handleSave = () => {
    if (!name.trim() || !time) return
    onSave({
      name: name.trim(),
      scheduledTime: time + ':00',
      enabled,
      slots: slots.filter(s => s.clientId),
    })
  }

  return (
    <div className="adbreaks-panel">
      <div className="panel-header">
        <h2>{block ? 'Editar Bloco' : 'Novo Bloco'}</h2>
        <button className="btn-cancel-sm" onClick={onCancel}>Cancelar</button>
      </div>
      <div className="adbreak-form">
        <div className="ab-form-row">
          <div className="form-group-sm" style={{ flex: 2 }}>
            <label>Nome do Bloco</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ex: Intervalo das 14h"
              autoFocus
            />
          </div>
          <div className="form-group-sm">
            <label>Horário</label>
            <input type="time" value={time} onChange={e => setTime(e.target.value)} />
          </div>
          <div className="form-group-sm ab-toggle-col">
            <label>Ativo</label>
            <button className="ab-toggle-btn" onClick={() => setEnabled(e => !e)} title="Ativar/Desativar">
              {enabled
                ? <ToggleRight size={22} color="var(--accent-green, #4ade80)" />
                : <ToggleLeft size={22} color="var(--text-secondary)" />}
            </button>
          </div>
        </div>

        <div className="adbreak-items-header">
          <span>Clientes no Bloco</span>
          <button className="btn-add-sm" onClick={addSlot}><Plus size={13} /> Adicionar Cliente</button>
        </div>
        <div className="adbreak-items-list">
          {slots.length === 0 && (
            <p className="ab-empty-msg">Adicione clientes a este bloco.</p>
          )}
          {slots.map((slot, i) => (
            <div key={i} className="adbreak-item-row">
              <span className="item-num">{i + 1}</span>
              <select
                value={slot.clientId}
                onChange={e => updateSlot(i, 'clientId', e.target.value)}
                style={{ flex: 1 }}
              >
                <option value="">Selecionar anunciante...</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <input
                type="number"
                value={slot.spotsCount}
                min={1}
                max={20}
                style={{ width: 60 }}
                title="Nº de spots por exibição"
                onChange={e => updateSlot(i, 'spotsCount', Math.max(1, parseInt(e.target.value) || 1))}
              />
              <span className="ab-spots-label">spots</span>
              <button className="btn-remove-item" onClick={() => removeSlot(i)} title="Remover">
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>

        <div className="form-actions">
          <button className="btn-cancel" onClick={onCancel}>Cancelar</button>
          <button className="btn-save" onClick={handleSave} disabled={!name.trim()}>
            Salvar Bloco
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Spot Form ───────────────────────────────────────────────────────────────
function SpotForm({ spot, onSave, onCancel }: {
  spot?: ClientSpot | null
  onSave: (data: Omit<ClientSpot, 'id' | 'clientId'>) => void
  onCancel: () => void
}) {
  const [title, setTitle] = useState(spot?.title ?? '')
  const [filePath, setFilePath] = useState(spot?.filePath ?? '')
  const [mediaType, setMediaType] = useState<'video' | 'audio' | 'image'>(spot?.mediaType ?? 'video')
  const [duration, setDuration] = useState(spot?.duration ?? 30)
  const [detecting, setDetecting] = useState(false)

  const browse = async () => {
    if (!window.spotmaster?.browseVideoFile) return
    const path = await window.spotmaster.browseVideoFile()
    if (!path) return
    const filename = path.split(/[\\\/]/).pop() ?? ''
    const nameNoExt = filename.replace(/\.[^.]+$/, '')
    const mtype = detectMediaType(path)
    setFilePath(path)
    setMediaType(mtype)
    if (!title) setTitle(nameNoExt)
    if (mtype !== 'image') {
      setDetecting(true)
      const dur = await readMediaDuration(path, mtype)
      setDetecting(false)
      if (dur !== null) setDuration(dur)
    }
  }

  return (
    <div className="ab-spot-form">
      <div className="form-group-sm">
        <label>Título do Spot</label>
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Ex: Spot Verão 30s"
          autoFocus
        />
      </div>
      <div className="form-group-sm">
        <label>Arquivo</label>
        <div className="ab-file-picker">
          <input
            type="text"
            readOnly
            value={filePath ? filePath.split(/[\\/]/).pop()! : ''}
            placeholder="Nenhum arquivo selecionado"
          />
          <button type="button" className="btn-primary-sm" onClick={browse}>
            Procurar...
          </button>
        </div>
      </div>
      <div className="ab-form-row">
        <div className="form-group-sm">
          <label>
            Duração (s){detecting && <span className="ab-detecting"> detectando...</span>}
          </label>
          <input
            type="number"
            value={duration}
            min={1}
            onChange={e => setDuration(parseInt(e.target.value) || 30)}
            disabled={detecting}
            style={{ width: 80 }}
          />
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
        <button
          className="btn-save"
          onClick={() => onSave({ title: title.trim(), filePath, mediaType, duration })}
          disabled={!title.trim() || !filePath}
        >
          Salvar Spot
        </button>
      </div>
    </div>
  )
}

// ─── Main Panel ──────────────────────────────────────────────────────────────
export default function AdBreaksPanel() {
  const { state, dispatch, loadBlockIntoPlaylist, saveToStorage } = useApp()
  const { commercialBlocks, clientSpots, clients, spotRotation, settings } = state
  const today = new Date().toISOString().slice(0, 10)

  const handlePreloadMinutesChange = (val: number) => {
    const next = { ...settings, preloadMinutes: Math.max(1, Math.min(60, val)) }
    dispatch({ type: 'SET_SETTINGS', payload: next })
    saveToStorage('settings', next)
  }

  const [tab, setTab] = useState<'blocks' | 'spots'>('blocks')
  const [editingBlock, setEditingBlock] = useState<CommercialBlock | null | undefined>(undefined)
  const [expandedClient, setExpandedClient] = useState<string | null>(null)
  const [editingSpot, setEditingSpot] = useState<{ clientId: string; spot?: ClientSpot } | null>(null)

  // ── Block handlers ──
  const handleSaveBlock = (data: Omit<CommercialBlock, 'id' | 'createdAt' | 'lastLoadedDate'>) => {
    if (editingBlock?.id) {
      dispatch({ type: 'UPDATE_COMMERCIAL_BLOCK', payload: { ...editingBlock, ...data } })
    } else {
      dispatch({
        type: 'ADD_COMMERCIAL_BLOCK',
        payload: { id: crypto.randomUUID(), ...data, createdAt: new Date().toISOString() },
      })
    }
    setEditingBlock(undefined)
  }

  const handleDeleteBlock = (id: string) => {
    if (window.confirm('Excluir este bloco?'))
      dispatch({ type: 'DELETE_COMMERCIAL_BLOCK', payload: id })
  }

  const handleToggleBlock = (block: CommercialBlock) =>
    dispatch({ type: 'UPDATE_COMMERCIAL_BLOCK', payload: { ...block, enabled: !block.enabled } })

  const handleForceReload = (block: CommercialBlock) => {
    const updated = { ...block, lastLoadedDate: undefined }
    dispatch({ type: 'UPDATE_COMMERCIAL_BLOCK', payload: updated })
    loadBlockIntoPlaylist(updated)
  }

  // ── Spot handlers ──
  const handleSaveSpot = (clientId: string, data: Omit<ClientSpot, 'id' | 'clientId'>) => {
    if (editingSpot?.spot) {
      dispatch({ type: 'UPDATE_CLIENT_SPOT', payload: { ...editingSpot.spot, ...data } })
    } else {
      dispatch({ type: 'ADD_CLIENT_SPOT', payload: { id: crypto.randomUUID(), clientId, ...data } })
    }
    setEditingSpot(null)
  }

  const handleDeleteSpot = (id: string) => {
    if (window.confirm('Excluir este spot?'))
      dispatch({ type: 'DELETE_CLIENT_SPOT', payload: id })
  }

  const totalBlockDuration = (block: CommercialBlock) =>
    block.slots.reduce((acc, slot) => {
      const spots = clientSpots.filter(s => s.clientId === slot.clientId)
      if (!spots.length) return acc
      const avg = spots.reduce((a, s) => a + s.duration, 0) / spots.length
      return acc + avg * slot.spotsCount
    }, 0)

  // ── Block form shown ──
  if (editingBlock !== undefined) {
    return (
      <BlockForm
        key={editingBlock?.id ?? 'new'}
        block={editingBlock}
        clients={clients}
        onSave={handleSaveBlock}
        onCancel={() => setEditingBlock(undefined)}
      />
    )
  }

  return (
    <div className="adbreaks-panel">
      {/* Header */}
      <div className="panel-header">
        <h2>Blocos Comerciais</h2>
        {tab === 'blocks' && (
          <button className="btn-primary-sm" onClick={() => setEditingBlock(null)}>
            <Plus size={13} /> Novo Bloco
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="ab-tabs">
        {(['blocks', 'spots'] as const).map(t => (
          <button
            key={t}
            className={`ab-tab${tab === t ? ' ab-tab--active' : ''}`}
            onClick={() => setTab(t)}
          >
            {t === 'blocks' ? 'Grade de Blocos' : 'Spots dos Clientes'}
          </button>
        ))}
      </div>

      {/* ── BLOCKS TAB ──────────────────────────────────── */}
      {tab === 'blocks' && (
        <div className="adbreaks-list">
          {/* Preload minutes config */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            <Clock size={13} />
            <span>Pré-carregar blocos</span>
            <input
              type="number"
              min={1}
              max={60}
              value={settings.preloadMinutes ?? 5}
              onChange={e => handlePreloadMinutesChange(parseInt(e.target.value) || 5)}
              style={{ width: 52, padding: '2px 6px', background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-primary)', fontSize: '0.8rem', textAlign: 'center' }}
            />
            <span>min antes do horário agendado</span>
          </div>
          {commercialBlocks.length === 0 ? (
            <div className="panel-empty">
              Nenhum bloco cadastrado. Crie um bloco para agendar intervalos comerciais automaticamente.
            </div>
          ) : (
            [...commercialBlocks]
              .sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime))
              .map(block => {
                const isLoadedToday = block.lastLoadedDate === today
                const dur = totalBlockDuration(block)
                // Detect if the block was supposed to fire today but didn't load
                const now = new Date()
                const [bh, bm] = block.scheduledTime.split(':').map(Number)
                const blockMinutes = bh * 60 + bm
                const nowMinutes  = now.getHours() * 60 + now.getMinutes()
                const missedToday = block.enabled && !isLoadedToday && blockMinutes < nowMinutes
                return (
                  <div
                    key={block.id}
                    className="adbreak-card"
                    style={{ opacity: block.enabled ? 1 : 0.55 }}
                  >
                    <div className="adbreak-card-header">
                      <div className="ab-block-info">
                        <Clock size={14} color="var(--accent, #6366f1)" />
                        <strong>{block.scheduledTime.slice(0, 5)}</strong>
                        <span>{block.name}</span>
                        {dur > 0 && (
                          <span className="ab-dur-badge">≈ {formatDuration(Math.round(dur))}</span>
                        )}
                        {isLoadedToday && (
                          <span className="ab-loaded-badge">Carregado hoje</span>
                        )}
                        {missedToday && (
                          <span className="ab-missed-badge" title="Horário já passou e o bloco não foi carregado hoje">⚠ Não disparou</span>
                        )}
                      </div>
                      <div className="adbreak-card-actions">
                        <button
                          title={isLoadedToday ? 'Recarregar (já carregado hoje)' : 'Carregar na playlist agora'}
                          onClick={() => handleForceReload(block)}
                          className="ab-action-reload"
                        >
                          <RefreshCw size={13} />
                        </button>
                        <button title={block.enabled ? 'Desativar' : 'Ativar'} onClick={() => handleToggleBlock(block)}>
                          {block.enabled
                            ? <ToggleRight size={15} color="var(--accent-green, #4ade80)" />
                            : <ToggleLeft size={15} />}
                        </button>
                        <button title="Editar" onClick={() => setEditingBlock(block)}>
                          <Edit2 size={13} />
                        </button>
                        <button
                          title="Excluir"
                          onClick={() => handleDeleteBlock(block.id)}
                          className="btn-danger-icon"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                    {/* Client slots summary */}
                    <div className="ab-slots-row">
                      {block.slots.length === 0 && (
                        <span className="ab-empty-msg">Nenhum cliente configurado</span>
                      )}
                      {block.slots.map((slot, i) => {
                        const client = clients.find(c => c.id === slot.clientId)
                        const spots = clientSpots.filter(s => s.clientId === slot.clientId)
                        const nextIdx = spotRotation[slot.clientId] ?? 0
                        const nextSpot = spots.length > 0 ? spots[nextIdx % spots.length] : null
                        return (
                          <span key={i} className="ab-slot-pill">
                            <strong>{client?.name ?? '?'}</strong>
                            {' '}×{slot.spotsCount}
                            {nextSpot && (
                              <span title={`Próximo: ${nextSpot.title}`} className="ab-next-spot">
                                → {nextSpot.title}
                              </span>
                            )}
                            {spots.length === 0 && (
                              <span className="ab-warn"> (sem spots!)</span>
                            )}
                          </span>
                        )
                      })}
                    </div>
                  </div>
                )
              })
          )}
        </div>
      )}

      {/* ── SPOTS TAB ──────────────────────────────────── */}
      {tab === 'spots' && (
        <div className="adbreaks-list">
          {clients.length === 0 ? (
            <div className="panel-empty">
              Nenhum anunciante cadastrado. Vá até a aba Anunciantes para cadastrar.
            </div>
          ) : (
            clients.map(client => {
              const spots = clientSpots.filter(s => s.clientId === client.id)
              const isExpanded = expandedClient === client.id
              const isAddingSpot = editingSpot?.clientId === client.id && !editingSpot.spot
              const editingClientSpot = editingSpot?.clientId === client.id && editingSpot.spot
                ? editingSpot.spot
                : null

              return (
                <div key={client.id} className="adbreak-card">
                  <div
                    className="adbreak-card-header ab-client-header"
                    onClick={() => setExpandedClient(isExpanded ? null : client.id)}
                  >
                    <div className="ab-block-info">
                      {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      <strong>{client.name}</strong>
                      <span className="adbreak-meta">
                        {spots.length} spot{spots.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <button
                      className="btn-add-sm"
                      onClick={e => {
                        e.stopPropagation()
                        setExpandedClient(client.id)
                        setEditingSpot({ clientId: client.id })
                      }}
                    >
                      <Plus size={12} /> Spot
                    </button>
                  </div>

                  {isExpanded && (
                    <div className="ab-spots-body">
                      {(isAddingSpot || editingClientSpot) && (
                        <SpotForm
                          spot={editingClientSpot}
                          onSave={data => handleSaveSpot(client.id, data)}
                          onCancel={() => setEditingSpot(null)}
                        />
                      )}
                      {spots.length === 0 && !isAddingSpot && (
                        <p className="ab-empty-msg">
                          Nenhum spot cadastrado. Clique em "+ Spot" para adicionar.
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
                            title="Editar"
                            onClick={() => setEditingSpot({ clientId: client.id, spot })}
                          >
                            <Edit2 size={12} />
                          </button>
                          <button
                            className="adbreak-card-actions-btn btn-danger-icon"
                            title="Excluir"
                            onClick={() => handleDeleteSpot(spot.id)}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
