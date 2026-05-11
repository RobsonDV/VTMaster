import { useState } from 'react'
import { Film, Music, Image as ImageIcon, Tv, DollarSign } from 'lucide-react'
import { useApp } from '../../store/AppContext'
import type { ProgramSlot, ScheduleSlotType } from '../../types'
import '../Playlist/ItemModal.css'

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

// Auto-nome baseado em tipo + horário
function autoTitle(type: ScheduleSlotType, hhmm: string): string {
  if (type === 'bloco_musical')   return `Musical ${hhmm}`
  if (type === 'bloco_comercial') return `Comercial ${hhmm}`
  if (type === 'programa')        return `Programa ${hhmm}`
  if (type === 'vinheta')         return `Vinheta ${hhmm}`
  if (type === 'bumper')          return `Bumper ${hhmm}`
  return `Slot ${hhmm}`
}

const MEDIA_TYPES: ScheduleSlotType[] = ['programa', 'vinheta', 'bumper', 'outros']
const BLOCK_COMERCIAL: ScheduleSlotType   = 'bloco_comercial'
const BLOCK_MUSICAL: ScheduleSlotType     = 'bloco_musical'

interface Props {
  slot?: ProgramSlot | null
  defaultType?: ScheduleSlotType
  day: number
  onClose: () => void
}

export default function ProgramSlotModal({ slot, defaultType = 'programa', day, onClose }: Props) {
  const { state, dispatch, t } = useApp()

  const [type, setType]         = useState<ScheduleSlotType>(slot?.type ?? defaultType)
  const [schedTime, setSchedTime] = useState(slot?.scheduledTime?.slice(0, 5) ?? '08:00')
  // Optional custom name (for programa/vinheta only)
  const [customName, setCustomName] = useState(
    slot?.title && !slot.title.match(/^(Musical|Comercial|Programa|Vinheta|Bumper|Slot) \d{2}:\d{2}$/)
      ? slot.title : ''
  )
  // Media fields (programa/vinheta/outros)
  const [filePath, setFilePath] = useState(slot?.filePath ?? '')
  const [inputName, setInputName] = useState(slot?.inputName ?? '')
  const [duration, setDuration] = useState(slot?.duration ?? 0)
  const [mediaType, setMediaType] = useState<'video'|'audio'|'image'>(slot?.mediaType ?? 'video')
  const [detecting, setDetecting] = useState(false)

  const isMedia     = MEDIA_TYPES.includes(type)
  const isMusical   = type === BLOCK_MUSICAL
  const isComercial = type === BLOCK_COMERCIAL

  // When time changes for a slot that has auto-name, keep auto-name in sync
  const resolvedTitle = customName.trim() || autoTitle(type, schedTime)

  const handleBrowse = async () => {
    const fp = await window.spotmaster?.browseVideoFile()
    if (!fp) return
    const mt = detectMediaType(fp)
    setFilePath(fp)
    setMediaType(mt)
    if (mt !== 'image') {
      setDetecting(true)
      const dur = await readMediaDuration(fp, mt)
      setDetecting(false)
      if (dur != null) setDuration(dur)
    }
  }

  const handleSave = () => {
    const timeStr = schedTime + ':00'
    const title   = resolvedTitle

    if (isComercial) {
      // Auto-create empty CommercialBlock + link ProgramSlot
      const blockId = slot?.commercialBlockId ?? crypto.randomUUID()
      if (!slot?.commercialBlockId) {
        dispatch({
          type: 'ADD_COMMERCIAL_BLOCK',
          payload: {
            id: blockId,
            name: title,
            scheduledTime: timeStr,
            items: [],
            enabled: true,
            createdAt: new Date().toISOString(),
          },
        })
      }
      const base: ProgramSlot = {
        id: slot?.id ?? crypto.randomUUID(),
        order: slot?.order ?? ((state.weeklyGrid[day] ?? []).length + 1),
        title,
        type,
        scheduledTime: timeStr,
        duration: 0,
        commercialBlockId: blockId,
      }
      slot
        ? dispatch({ type: 'UPDATE_PROGRAM_SLOT', payload: { day, slot: base } })
        : dispatch({ type: 'ADD_PROGRAM_SLOT',    payload: { day, slot: base } })
      return onClose()
    }

    if (isMusical) {
      // Just a time marker — no file, no block link
      const base: ProgramSlot = {
        id: slot?.id ?? crypto.randomUUID(),
        order: slot?.order ?? ((state.weeklyGrid[day] ?? []).length + 1),
        title,
        type,
        scheduledTime: timeStr,
        duration: 0,
      }
      slot
        ? dispatch({ type: 'UPDATE_PROGRAM_SLOT', payload: { day, slot: base } })
        : dispatch({ type: 'ADD_PROGRAM_SLOT',    payload: { day, slot: base } })
      return onClose()
    }

    // Media type (programa / vinheta / bumper / outros)
    const base: ProgramSlot = {
      id: slot?.id ?? crypto.randomUUID(),
      order: slot?.order ?? ((state.weeklyGrid[day] ?? []).length + 1),
      title,
      type,
      scheduledTime: timeStr,
      duration,
      filePath:  filePath  || undefined,
      inputName: inputName || undefined,
      mediaType: filePath  ? mediaType : undefined,
    }
    slot
      ? dispatch({ type: 'UPDATE_PROGRAM_SLOT', payload: { day, slot: base } })
      : dispatch({ type: 'ADD_PROGRAM_SLOT',    payload: { day, slot: base } })
    onClose()
  }

  const typeLabel = t.grade.slotTypes[type as keyof typeof t.grade.slotTypes] ?? type

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()} style={{ minWidth: 400, maxWidth: 480 }}>
        <div className="modal-header">
          <h2>{slot ? t.grade.editSlot : t.grade.newSlot} — {typeLabel}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-form">
          {/* Tipo (somente ao criar novo) */}
          {!slot && (
            <div className="form-group">
              <label>Tipo</label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {([
                  { v: 'programa',        label: 'Programa',        icon: <Tv size={12}/>,        color: '#0ea5e9' },
                  { v: 'vinheta',         label: 'Vinheta',         icon: <Film size={12}/>,       color: '#8b5cf6' },
                  { v: 'bloco_musical',   label: 'Bloco Musical',   icon: <Music size={12}/>,      color: '#22c55e' },
                  { v: 'bloco_comercial', label: 'Bloco Comercial', icon: <DollarSign size={12}/>, color: '#f59e0b' },
                  { v: 'outros',          label: 'Outros',          icon: <Film size={12}/>,       color: 'var(--text-secondary)' },
                ] as const).map(({ v, label, icon, color }) => (
                  <button key={v} type="button" onClick={() => setType(v)} style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    padding: '4px 10px', borderRadius: 6, border: '1px solid',
                    borderColor: type === v ? color : 'var(--border)',
                    background: type === v ? `color-mix(in srgb, ${color} 15%, transparent)` : 'transparent',
                    color: type === v ? color : 'var(--text-secondary)',
                    cursor: 'pointer', fontSize: '0.78rem', fontWeight: type === v ? 700 : 400,
                  }}>
                    {icon} {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Horário — sempre obrigatório */}
          <div className="form-row">
            <div className="form-group" style={{ flex: 1 }}>
              <label>{t.grade.scheduledTime}</label>
              <input
                type="time"
                value={schedTime}
                onChange={e => setSchedTime(e.target.value)}
                autoFocus
              />
            </div>
            <div className="form-group" style={{ flex: 2 }}>
              <label>
                Nome{' '}
                <span style={{ fontWeight: 400, color: 'var(--text-secondary)' }}>
                  (automático: {autoTitle(type, schedTime)})
                </span>
              </label>
              <input
                value={customName}
                onChange={e => setCustomName(e.target.value)}
                placeholder={autoTitle(type, schedTime)}
              />
            </div>
          </div>

          {/* Info para Bloco Musical */}
          {isMusical && (
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', background: 'color-mix(in srgb, #22c55e 8%, var(--bg-tertiary))', border: '1px solid #22c55e30', borderRadius: 6, padding: '8px 10px' }}>
              <strong style={{ color: '#22c55e' }}>Bloco Musical</strong> — nasce vazio na Estrutura.{' '}
              Você adiciona as músicas diretamente na aba <strong>Programação</strong>, no dia a dia.
            </div>
          )}

          {/* Info para Bloco Comercial */}
          {isComercial && (
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', background: 'color-mix(in srgb, #f59e0b 8%, var(--bg-tertiary))', border: '1px solid #f59e0b30', borderRadius: 6, padding: '8px 10px' }}>
              <strong style={{ color: '#f59e0b' }}>Bloco Comercial</strong> — um bloco vazio será criado automaticamente na aba <strong>Blocos Comerciais</strong>.{' '}
              Você entra lá e adiciona os spots.
            </div>
          )}

          {/* Arquivo/Input — só para tipos de mídia */}
          {isMedia && (
            <>
              <div className="form-group">
                <label>
                  Arquivo{' '}
                  <span style={{ fontWeight: 400, color: 'var(--text-secondary)' }}>
                    (opcional — pode adicionar depois)
                  </span>
                  {filePath && (
                    <span style={{ marginLeft: 6, fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                      {mediaType === 'image' ? <ImageIcon size={10}/> : mediaType === 'audio' ? <Music size={10}/> : <Film size={10}/>}
                      {' '}{mediaType}
                    </span>
                  )}
                </label>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input
                    value={filePath ? filePath.split(/[\\/]/).pop()! : ''}
                    readOnly
                    placeholder="Nenhum arquivo selecionado"
                    style={{ flex: 1 }}
                  />
                  <button className="btn-browse" onClick={handleBrowse}>{t.common.browse}</button>
                  {filePath && (
                    <button className="btn-clear-file" onClick={() => { setFilePath(''); setDuration(0) }} style={{ width: 28, height: 34 }}>×</button>
                  )}
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>
                    Duração (s){' '}
                    {detecting && <span style={{ fontWeight: 400, color: 'var(--text-secondary)' }}>detectando...</span>}
                  </label>
                  <input type="number" value={duration} min={0} onChange={e => setDuration(Math.max(0, parseInt(e.target.value) || 0))} style={{ width: 90 }} />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Input vMix <span style={{ fontWeight: 400, color: 'var(--text-secondary)' }}>(alternativo ao arquivo)</span></label>
                  <input value={inputName} onChange={e => setInputName(e.target.value)} placeholder="Ex: Camera1" />
                </div>
              </div>
            </>
          )}
        </div>

        <div className="modal-actions">
          <button className="btn-cancel" onClick={onClose}>{t.common.cancel}</button>
          <button className="btn-save" onClick={handleSave}>
            {t.common.save}
          </button>
        </div>
      </div>
    </div>
  )
}
