import { useState, useEffect, useRef } from 'react'
import { X, Film, Image as ImageIcon, Music, Loader2, Zap } from 'lucide-react'
import { useApp } from '../../store/AppContext'
import type { PlaylistItem, SpotType, VmixActionItem } from '../../types'
import './ItemModal.css'

interface ItemModalProps {
  item?: PlaylistItem | null
  onClose: () => void
  insertAfterOrder?: number   // quando vem do menu de contexto
  defaultMode?: 'media' | 'vmix_action'
}

const SPOT_TYPES: SpotType[] = ['spot', 'vinheta', 'programa', 'bumper', 'outros']

// ── Definição das funções vMix disponíveis ────────────────────────────────────
const VMIX_FUNCTIONS = [
  { value: 'AudioOff',       label: '🔇 Desligar Áudio',       hasInput: true,  hasValue: false, valuePlaceholder: '' },
  { value: 'AudioOn',        label: '🔊 Ligar Áudio',           hasInput: true,  hasValue: false, valuePlaceholder: '' },
  { value: 'SetVolume',      label: '🔉 Ajustar Volume',        hasInput: true,  hasValue: true,  valuePlaceholder: '0 – 100 (%)' },
  { value: 'Fade',           label: '✨ Fade (transição)',       hasInput: false, hasValue: true,  valuePlaceholder: 'Duração em ms (ex: 1000)' },
  { value: 'OverlayInput1',  label: '📺 Overlay 1 — Abrir',    hasInput: true,  hasValue: false, valuePlaceholder: '' },
  { value: 'OverlayInput1Out', label: '📺 Overlay 1 — Fechar', hasInput: false, hasValue: false, valuePlaceholder: '' },
] as const

// ── Media type helpers ─────────────────────────────────────────────────────
const IMAGE_EXTS = new Set(['jpg','jpeg','png','gif','bmp','webp','tiff','tif','ico','svg'])
const AUDIO_EXTS = new Set(['mp3','wav','aac','ogg','flac','m4a','wma','opus','aiff'])
type MediaType = 'video' | 'image' | 'audio'

function detectMediaType(filePath: string): MediaType {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? ''
  if (IMAGE_EXTS.has(ext)) return 'image'
  if (AUDIO_EXTS.has(ext)) return 'audio'
  return 'video'
}

// Converts a local file path to a custom protocol URL that Electron serves.
// This bypasses CSP/CORS when the renderer is loaded from localhost (dev mode).
function toLocalMediaUrl(filePath: string): string {
  return 'local-media:///' + filePath.replace(/\\/g, '/')
}

// Read video/audio duration using HTML5 media element via local-media:// protocol
function readMediaDuration(filePath: string, type: 'video' | 'audio'): Promise<number | null> {
  return new Promise((resolve) => {
    const el = document.createElement(type === 'audio' ? 'audio' : 'video') as HTMLVideoElement
    el.preload = 'metadata'
    const timer = setTimeout(() => { el.src = ''; resolve(null) }, 10_000)
    el.onloadedmetadata = () => {
      clearTimeout(timer)
      const d = el.duration
      el.src = ''
      resolve(isFinite(d) && d > 0 ? Math.round(d) : null)
    }
    el.onerror = () => { clearTimeout(timer); el.src = ''; resolve(null) }
    el.src = toLocalMediaUrl(filePath)
  })
}

const MediaIcon = ({ type, size = 13 }: { type: MediaType; size?: number }) => {
  if (type === 'image') return <ImageIcon size={size} />
  if (type === 'audio') return <Music size={size} />
  return <Film size={size} />
}

export default function ItemModal({ item, onClose, insertAfterOrder, defaultMode }: ItemModalProps) {
  const { state, dispatch, t } = useApp()
  const { clients } = state

  const isEdit = !!item
  const [mode, setMode] = useState<'media' | 'vmix_action'>(
    defaultMode ?? (item?.type === 'vmix_action' ? 'vmix_action' : 'media')
  )

  // ── Formulário de mídia ──
  const [form, setForm] = useState({
    title: item?.title ?? '',
    clientId: item?.clientId ?? '',
    clientName: item?.clientName ?? '',
    type: (item?.type !== 'vmix_action' ? item?.type : 'spot') ?? 'spot' as SpotType,
    duration: item?.duration ?? 30,
    scheduledTime: item?.scheduledTime ?? '',
    inputName: item?.inputName ?? '',
    filePath: item?.filePath ?? '',
    notes: item?.notes ?? '',
  })
  const [durationStr, setDurationStr] = useState(String(item?.duration ?? 30))
  const [mediaType, setMediaType] = useState<MediaType>(() =>
    item?.filePath ? detectMediaType(item.filePath) : 'video'
  )
  const [detectingDuration, setDetectingDuration] = useState(false)

  // ── Formulário de ação vMix ──
  const [actionFn, setActionFn]     = useState(item?.vmixAction?.function ?? 'AudioOff')
  const [actionInput, setActionInput] = useState(item?.vmixAction?.input ?? '')
  const [actionValue, setActionValue] = useState(item?.vmixAction?.value ?? '')
  const [actionTitle, setActionTitle] = useState(
    item?.type === 'vmix_action' ? item.title : ''
  )

  const selectedFnDef = VMIX_FUNCTIONS.find(f => f.value === actionFn) ?? VMIX_FUNCTIONS[0]

  // Focus the first relevant field on mount (more reliable than autoFocus in Electron)
  const firstFieldRef = useRef<HTMLSelectElement | HTMLInputElement | null>(null)
  useEffect(() => { firstFieldRef.current?.focus() }, [])

  // Auto-title para ações vMix quando o título estiver vazio
  useEffect(() => {
    if (mode !== 'vmix_action' || actionTitle) return
    const def = VMIX_FUNCTIONS.find(f => f.value === actionFn)
    if (def) setActionTitle(def.label)
  }, [actionFn, mode]) // eslint-disable-line react-hooks/exhaustive-deps

  // Sync clientName when clientId changes
  useEffect(() => {
    if (form.clientId) {
      const client = clients.find((c) => c.id === form.clientId)
      if (client) setForm((f) => ({ ...f, clientName: client.name }))
    } else {
      setForm((f) => ({ ...f, clientName: '' }))
    }
  }, [form.clientId, clients])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (mode === 'vmix_action') {
      if (!actionFn) return
      const vmixAction: VmixActionItem = {
        function: actionFn,
        input: actionInput || undefined,
        value: actionValue || undefined,
      }
      const title = actionTitle.trim() || selectedFnDef.label
      const newItem: PlaylistItem = {
        id: isEdit ? item!.id : crypto.randomUUID(),
        order: isEdit ? item!.order : (state.playlist.length + 1),
        title,
        duration: 0,
        type: 'vmix_action',
        status: 'pending',
        vmixAction,
      }
      if (isEdit) {
        dispatch({ type: 'UPDATE_PLAYLIST_ITEM', payload: newItem })
      } else if (insertAfterOrder !== undefined) {
        dispatch({ type: 'INSERT_PLAYLIST_ITEM_AFTER', payload: { item: newItem, afterOrder: insertAfterOrder } })
      } else {
        dispatch({ type: 'ADD_PLAYLIST_ITEM', payload: newItem })
      }
      onClose()
      return
    }

    // Modo mídia
    const dur = parseInt(durationStr) || 30
    if (!form.title.trim()) return

    if (isEdit && item) {
      dispatch({
        type: 'UPDATE_PLAYLIST_ITEM',
        payload: { ...item, ...form, duration: dur, mediaType: form.filePath ? mediaType : undefined, vmixAction: undefined },
      })
    } else {
      const newItem: PlaylistItem = {
        id: crypto.randomUUID(),
        order: insertAfterOrder !== undefined ? 0 : state.playlist.length + 1,
        ...form,
        duration: dur,
        status: 'pending',
        mediaType: form.filePath ? mediaType : undefined,
      }
      if (insertAfterOrder !== undefined) {
        dispatch({ type: 'INSERT_PLAYLIST_ITEM_AFTER', payload: { item: newItem, afterOrder: insertAfterOrder } })
      } else {
        dispatch({ type: 'ADD_PLAYLIST_ITEM', payload: newItem })
      }
    }
    onClose()
  }

  const set = (field: string, value: string | number) =>
    setForm((f) => ({ ...f, [field]: value }))

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <h2>{isEdit ? t.playlist.editItem : t.playlist.addItem}</h2>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">

          {/* ── Toggle de modo (só na criação) ── */}
          {!isEdit && (
            <div style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
              <button
                type="button"
                onClick={() => setMode('media')}
                style={{
                  flex: 1, padding: '7px 0', borderRadius: 6, border: '1px solid var(--border)',
                  background: mode === 'media' ? 'var(--accent)' : 'var(--bg-tertiary)',
                  color: mode === 'media' ? '#fff' : 'var(--text-secondary)',
                  fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
                }}
              >
                🎬 Mídia / Input
              </button>
              <button
                type="button"
                onClick={() => setMode('vmix_action')}
                style={{
                  flex: 1, padding: '7px 0', borderRadius: 6, border: '1px solid var(--border)',
                  background: mode === 'vmix_action' ? '#7c3aed' : 'var(--bg-tertiary)',
                  color: mode === 'vmix_action' ? '#fff' : 'var(--text-secondary)',
                  fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
                }}
              >
                <Zap size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                Ação vMix
              </button>
            </div>
          )}

          {/* ════════════════════════════════════════════════════
              MODO: AÇÃO vMIX
          ════════════════════════════════════════════════════ */}
          {mode === 'vmix_action' && (
            <>
              {/* Função */}
              <div className="form-group">
                <label>Função vMix *</label>
                <select
                  ref={el => { if (mode === 'vmix_action') firstFieldRef.current = el }}
                  value={actionFn}
                  onChange={e => { setActionFn(e.target.value); setActionTitle('') }}
                  style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 10px', color: 'var(--text-primary)', fontSize: '0.85rem', width: '100%' }}
                >
                  {VMIX_FUNCTIONS.map(f => (
                    <option key={f.value} value={f.value}>{f.label}</option>
                  ))}
                </select>
              </div>

              {/* Input vMix (quando necessário) */}
              {selectedFnDef.hasInput && (
                <div className="form-group">
                  <label>Input vMix (nome, número ou GUID)</label>
                  <input
                    type="text"
                    value={actionInput}
                    onChange={e => setActionInput(e.target.value)}
                    placeholder="Ex: Camera1, 1, {GUID...}"
                  />
                  <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: 3, display: 'block' }}>
                    Nome ou número do input no vMix que receberá o comando
                  </span>
                </div>
              )}

              {/* Valor (SetVolume, Fade, etc.) */}
              {selectedFnDef.hasValue && (
                <div className="form-group">
                  <label>Valor</label>
                  <input
                    type="text"
                    value={actionValue}
                    onChange={e => setActionValue(e.target.value)}
                    placeholder={selectedFnDef.valuePlaceholder}
                  />
                </div>
              )}

              {/* Título personalizado */}
              <div className="form-group">
                <label>Título (opcional)</label>
                <input
                  type="text"
                  value={actionTitle}
                  onChange={e => setActionTitle(e.target.value)}
                  placeholder={selectedFnDef.label}
                />
              </div>

              {/* Preview do comando */}
              <div style={{ padding: '8px 12px', background: 'color-mix(in srgb, #7c3aed 10%, var(--bg-primary))', border: '1px solid color-mix(in srgb, #7c3aed 30%, transparent)', borderRadius: 6, fontSize: '0.78rem', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                <span style={{ color: '#a78bfa', fontWeight: 700 }}>vMix</span>
                {' → '}
                <span style={{ color: 'var(--text-primary)' }}>{actionFn}</span>
                {actionInput && <span style={{ color: '#86efac' }}>{` Input="${actionInput}"`}</span>}
                {actionValue && <span style={{ color: '#fbbf24' }}>{` Value="${actionValue}"`}</span>}
              </div>
            </>
          )}

          {/* ════════════════════════════════════════════════════
              MODO: MÍDIA / INPUT
          ════════════════════════════════════════════════════ */}
          {mode === 'media' && (
            <>
          {/* Title */}
          <div className="form-group">
            <label>{t.common.title} *</label>
            <input
              ref={el => { if (mode === 'media') firstFieldRef.current = el }}
              type="text"
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              placeholder="Ex: Spot Coca-Cola 30s"
              required
            />
          </div>

          {/* Row: Client + Type */}
          <div className="form-row">
            <div className="form-group">
              <label>{t.playlist.columns.client}</label>
              <select
                value={form.clientId}
                onChange={(e) => set('clientId', e.target.value)}
              >
                <option value="">{t.common.all}</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>{t.playlist.columns.type}</label>
              <select
                value={form.type}
                onChange={(e) => set('type', e.target.value)}
              >
                {SPOT_TYPES.map((tp) => (
                  <option key={tp} value={tp}>{t.types[tp]}</option>
                ))}
              </select>
            </div>
          </div>

          {/* ── Arquivo de mídia ─────────────────────────────── */}
          <div className="form-group">
            <label>Arquivo de Mídia</label>
            <div className="file-picker">
              <input
                type="text"
                readOnly
                value={form.filePath ? form.filePath.split(/[\\/]/).pop()! : ''}
                placeholder="Nenhum arquivo selecionado"
                className="file-picker-input"
              />
              <button
                type="button"
                className="btn-browse"
                onClick={async () => {
                  if (!window.spotmaster?.browseVideoFile) return
                  const path = await window.spotmaster.browseVideoFile()
                  if (!path) return
                  const filename = path.split(/[\\\/]/).pop() ?? ''
                  const nameWithoutExt = filename.replace(/\.[^.]+$/, '')
                  const mtype = detectMediaType(path)
                  setMediaType(mtype)
                  // Auto-fill title from filename (only if empty)
                  setForm(f => ({
                    ...f,
                    filePath: path,
                    title: f.title.trim() ? f.title : nameWithoutExt,
                    // inputName intentionally NOT auto-filled — SpotMaster manages it
                  }))
                  if (mtype === 'image') {
                    // Images don't have duration — use 10s default (editable)
                    setDurationStr(prev => prev === '30' || !prev ? '10' : prev)
                  } else {
                    // Video or audio — read duration from file metadata
                    setDetectingDuration(true)
                    const dur = await readMediaDuration(path, mtype)
                    setDetectingDuration(false)
                    if (dur !== null) setDurationStr(String(dur))
                  }
                }}
              >
                Procurar...
              </button>
              {form.filePath && (
                <button
                  type="button"
                  className="btn-clear-file"
                  title="Remover arquivo"
                  onClick={() => {
                    setForm(f => ({ ...f, filePath: '' }))
                    setMediaType('video')
                  }}
                >
                  ×
                </button>
              )}
            </div>
            {form.filePath && (
              <div className="media-type-badge">
                <MediaIcon type={mediaType} size={12} />
                <span>{mediaType === 'video' ? 'Vídeo' : mediaType === 'image' ? 'Imagem — duração manual' : 'Áudio'}</span>
                <span className="file-path-full" title={form.filePath}>{form.filePath}</span>
              </div>
            )}
          </div>

          {/* ── Duração + Horário ─────────────────────────────── */}
          <div className="form-row">
            <div className="form-group">
              <label style={{ display:'flex', alignItems:'center', gap:6 }}>
                Duração (s)
                {detectingDuration && (
                  <span className="detecting-badge">
                    <Loader2 size={11} className="spin" /> Detectando...
                  </span>
                )}
                {!detectingDuration && form.filePath && mediaType === 'image' && (
                  <span className="detecting-badge" style={{ background:'var(--bg-tertiary)', color:'var(--text-secondary)' }}>
                    manual
                  </span>
                )}
              </label>
              <input
                type="number"
                value={durationStr}
                onChange={(e) => setDurationStr(e.target.value)}
                min="1"
                max="7200"
                disabled={detectingDuration}
              />
            </div>

            <div className="form-group">
              <label>{t.common.time} (HH:MM:SS)</label>
              <input
                type="time"
                step="1"
                value={form.scheduledTime}
                onChange={(e) => set('scheduledTime', e.target.value)}
              />
            </div>
          </div>

          {/* ── Input vMix ────────────────────────────────────── */}
          {form.filePath ? (
            <div className="form-group">
              <label>Input vMix</label>
              <div className="input-auto-note">
                Gerenciado automaticamente pelo SpotMaster ao veicular
              </div>
            </div>
          ) : (
            <div className="form-group">
              <label>{t.playlist.columns.input} (vMix)</label>
              <input
                type="text"
                value={form.inputName}
                onChange={(e) => set('inputName', e.target.value)}
                placeholder="Ex: 1, Camera1, NDI-Source, Grafismo"
              />
              <span style={{ fontSize:'0.75rem', color:'var(--text-secondary)', marginTop:3 }}>
                Número ou nome de um input já existente no vMix (sem arquivo)
              </span>
            </div>
          )}

          {/* Notes */}
          <div className="form-group">
            <label>{t.common.notes}</label>
            <textarea
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              rows={2}
              placeholder="Observações opcionais..."
            />
          </div>
            </>
          )}

          {/* Actions */}
          <div className="modal-actions">
            <button type="button" className="btn-cancel" onClick={onClose}>
              {t.common.cancel}
            </button>
            <button
              type="submit"
              className="btn-save"
              style={mode === 'vmix_action' ? { background: '#7c3aed', borderColor: '#7c3aed' } : undefined}
            >
              {isEdit ? t.common.save : t.common.add}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
