import { useState, useEffect } from 'react'
import { X, Film, Image as ImageIcon, Music, Loader2 } from 'lucide-react'
import { useApp } from '../../store/AppContext'
import type { PlaylistItem, SpotType } from '../../types'
import './ItemModal.css'

interface ItemModalProps {
  item?: PlaylistItem | null
  onClose: () => void
}

const SPOT_TYPES: SpotType[] = ['spot', 'vinheta', 'programa', 'bumper', 'outros']

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

export default function ItemModal({ item, onClose }: ItemModalProps) {
  const { state, dispatch, t } = useApp()
  const { clients } = state

  const isEdit = !!item

  const [form, setForm] = useState({
    title: item?.title ?? '',
    clientId: item?.clientId ?? '',
    clientName: item?.clientName ?? '',
    type: item?.type ?? 'spot' as SpotType,
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
    const dur = parseInt(durationStr) || 30

    if (!form.title.trim()) return

    if (isEdit && item) {
      dispatch({
        type: 'UPDATE_PLAYLIST_ITEM',
        payload: { ...item, ...form, duration: dur, mediaType: form.filePath ? mediaType : undefined },
      })
    } else {
      const newItem: PlaylistItem = {
        id: crypto.randomUUID(),
        order: state.playlist.length + 1,
        ...form,
        duration: dur,
        status: 'pending',
        mediaType: form.filePath ? mediaType : undefined,
      }
      dispatch({ type: 'ADD_PLAYLIST_ITEM', payload: newItem })
    }
    onClose()
  }

  const set = (field: string, value: string | number) =>
    setForm((f) => ({ ...f, [field]: value }))

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <h2>{isEdit ? t.playlist.editItem : t.playlist.addItem}</h2>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          {/* Title */}
          <div className="form-group">
            <label>{t.common.title} *</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              placeholder="Ex: Spot Coca-Cola 30s"
              required
              autoFocus
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

          {/* Actions */}
          <div className="modal-actions">
            <button type="button" className="btn-cancel" onClick={onClose}>
              {t.common.cancel}
            </button>
            <button type="submit" className="btn-save">
              {isEdit ? t.common.save : t.common.add}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
