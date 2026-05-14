import { useState, useEffect, useRef } from 'react'
import { Film, Image as ImageIcon, Music, Loader2, Zap, X } from 'lucide-react'
import { useApp } from '../../store/AppContext'
import type { PlaylistItem, SpotType, VmixActionItem } from '../../types'
import Badge from '../ui/Badge'
import Button from '../ui/Button'
import { Field, FieldRow } from '../ui/Field'
import Modal from '../ui/Modal'
import SegmentedControl from '../ui/SegmentedControl'
import './ItemModal.css'

interface ItemModalProps {
  item?: PlaylistItem | null
  onClose: () => void
  insertAfterOrder?: number
  defaultMode?: 'media' | 'vmix_action'
}

const SPOT_TYPES: SpotType[] = ['spot', 'vinheta', 'programa', 'bumper', 'outros']

const VMIX_FUNCTIONS = [
  { value: 'AudioOff', label: 'Desligar Audio', hasInput: true, hasValue: false, valuePlaceholder: '' },
  { value: 'AudioOn', label: 'Ligar Audio', hasInput: true, hasValue: false, valuePlaceholder: '' },
  { value: 'SetVolume', label: 'Ajustar Volume', hasInput: true, hasValue: true, valuePlaceholder: '0 - 100 (%)' },
  { value: 'Fade', label: 'Fade (transicao)', hasInput: false, hasValue: true, valuePlaceholder: 'Duracao em ms (ex: 1000)' },
  { value: 'OverlayInput1', label: 'Overlay 1 - Abrir', hasInput: true, hasValue: false, valuePlaceholder: '' },
  { value: 'OverlayInput1Out', label: 'Overlay 1 - Fechar', hasInput: false, hasValue: false, valuePlaceholder: '' },
] as const

const IMAGE_EXTS = new Set(['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'tiff', 'tif', 'ico', 'svg'])
const AUDIO_EXTS = new Set(['mp3', 'wav', 'aac', 'ogg', 'flac', 'm4a', 'wma', 'opus', 'aiff'])
type MediaType = 'video' | 'image' | 'audio'

function detectMediaType(filePath: string): MediaType {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? ''
  if (IMAGE_EXTS.has(ext)) return 'image'
  if (AUDIO_EXTS.has(ext)) return 'audio'
  return 'video'
}

function toLocalMediaUrl(filePath: string): string {
  return 'local-media:///' + filePath.replace(/\\/g, '/')
}

function readMediaDuration(filePath: string, type: 'video' | 'audio'): Promise<number | null> {
  return new Promise((resolve) => {
    const el = document.createElement(type === 'audio' ? 'audio' : 'video') as HTMLVideoElement
    el.preload = 'metadata'
    const cleanup = () => {
      el.onloadedmetadata = null
      el.onerror = null
      try { el.pause() } catch {}
      el.removeAttribute('src')
      try { el.load() } catch {}
    }
    const timer = setTimeout(() => { cleanup(); resolve(null) }, 10_000)
    el.onloadedmetadata = () => {
      clearTimeout(timer)
      const d = el.duration
      cleanup()
      resolve(isFinite(d) && d > 0 ? Math.round(d) : null)
    }
    el.onerror = () => { clearTimeout(timer); cleanup(); resolve(null) }
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

  const [actionFn, setActionFn] = useState(item?.vmixAction?.function ?? 'AudioOff')
  const [actionInput, setActionInput] = useState(item?.vmixAction?.input ?? '')
  const [actionValue, setActionValue] = useState(item?.vmixAction?.value ?? '')
  const [actionTitle, setActionTitle] = useState(
    item?.type === 'vmix_action' ? item.title : ''
  )

  const selectedFnDef = VMIX_FUNCTIONS.find(f => f.value === actionFn) ?? VMIX_FUNCTIONS[0]

  const firstFieldRef = useRef<HTMLSelectElement | HTMLInputElement | null>(null)
  useEffect(() => { firstFieldRef.current?.focus() }, [])

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
    <Modal
      title={isEdit ? t.playlist.editItem : t.playlist.addItem}
      onClose={onClose}
      actions={
        <>
          <Button variant="ghost" onClick={onClose}>{t.common.cancel}</Button>
          <Button variant={mode === 'vmix_action' ? 'purple' : 'primary'} type="submit" form="playlist-item-form">
            {isEdit ? t.common.save : t.common.add}
          </Button>
        </>
      }
    >
      <form id="playlist-item-form" onSubmit={handleSubmit} className="modal-form">
        {!isEdit && (
          <SegmentedControl
            value={mode}
            onChange={setMode}
            options={[
              { value: 'media', label: 'Midia / Input' },
              { value: 'vmix_action', label: 'Acao vMix', icon: <Zap size={13} />, variant: 'purple' },
            ]}
          />
        )}

        {mode === 'vmix_action' && (
          <>
            <Field label="Funcao vMix *">
              <select
                ref={el => { if (mode === 'vmix_action') firstFieldRef.current = el }}
                  value={actionFn}
                onChange={e => {
                  const nextFn = e.target.value
                  setActionFn(nextFn)
                  if (!actionTitle.trim()) {
                    const nextDef = VMIX_FUNCTIONS.find(f => f.value === nextFn)
                    if (nextDef) setActionTitle(nextDef.label)
                  }
                }}
                className="ui-select"
              >
                {VMIX_FUNCTIONS.map(f => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
            </Field>

            {selectedFnDef.hasInput && (
              <Field
                label="Input vMix (nome, numero ou GUID)"
                hint="Nome ou numero do input no vMix que recebera o comando"
              >
                <input
                  type="text"
                  value={actionInput}
                  onChange={e => setActionInput(e.target.value)}
                  placeholder="Ex: Camera1, 1, {GUID...}"
                  className="ui-input"
                />
              </Field>
            )}

            {selectedFnDef.hasValue && (
              <Field label="Valor">
                <input
                  type="text"
                  value={actionValue}
                  onChange={e => setActionValue(e.target.value)}
                  placeholder={selectedFnDef.valuePlaceholder}
                  className="ui-input"
                />
              </Field>
            )}

            <Field label="Titulo (opcional)">
              <input
                type="text"
                value={actionTitle}
                onChange={e => setActionTitle(e.target.value)}
                placeholder={selectedFnDef.label}
                className="ui-input"
              />
            </Field>

            <div className="ui-card-note item-modal-command-preview">
              <span className="item-modal-command-source">vMix</span>
              {' -> '}
              <span className="item-modal-command-fn">{actionFn}</span>
              {actionInput && <span className="item-modal-command-input">{` Input="${actionInput}"`}</span>}
              {actionValue && <span className="item-modal-command-value">{` Value="${actionValue}"`}</span>}
            </div>
          </>
        )}

        {mode === 'media' && (
          <>
            <Field label={`${t.common.title} *`}>
              <input
                ref={el => { if (mode === 'media') firstFieldRef.current = el }}
                type="text"
                value={form.title}
                onChange={(e) => set('title', e.target.value)}
                placeholder="Ex: Spot Coca-Cola 30s"
                required
                className="ui-input"
              />
            </Field>

            <FieldRow>
              <Field label={t.playlist.columns.client}>
                <select
                  value={form.clientId}
                  onChange={(e) => {
                    const nextClientId = e.target.value
                    const client = clients.find((c) => c.id === nextClientId)
                    setForm((f) => ({
                      ...f,
                      clientId: nextClientId,
                      clientName: client?.name ?? '',
                    }))
                  }}
                  className="ui-select"
                >
                  <option value="">{t.common.all}</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </Field>

              <Field label={t.playlist.columns.type}>
                <select
                  value={form.type}
                  onChange={(e) => set('type', e.target.value)}
                  className="ui-select"
                >
                  {SPOT_TYPES.map((tp) => (
                    <option key={tp} value={tp}>{t.types[tp]}</option>
                  ))}
                </select>
              </Field>
            </FieldRow>

            <Field label="Arquivo de Midia">
              <div className="file-picker">
                <input
                  type="text"
                  readOnly
                  value={form.filePath ? form.filePath.split(/[\\/]/).pop()! : ''}
                  placeholder="Nenhum arquivo selecionado"
                  className="file-picker-input ui-input"
                />
                <Button
                  type="button"
                  variant="secondary"
                  className="btn-browse"
                  onClick={async () => {
                    if (!window.spotmaster?.browseVideoFile) return
                    const path = await window.spotmaster.browseVideoFile()
                    if (!path) return
                    const filename = path.split(/[/\\]/).pop() ?? ''
                    const nameWithoutExt = filename.replace(/\.[^.]+$/, '')
                    const mtype = detectMediaType(path)
                    setMediaType(mtype)
                    setForm(f => ({
                      ...f,
                      filePath: path,
                      title: f.title.trim() ? f.title : nameWithoutExt,
                    }))
                    if (mtype === 'image') {
                      setDurationStr(prev => prev === '30' || !prev ? '10' : prev)
                    } else {
                      setDetectingDuration(true)
                      const dur = await readMediaDuration(path, mtype)
                      setDetectingDuration(false)
                      if (dur !== null) setDurationStr(String(dur))
                    }
                  }}
                >
                  Procurar...
                </Button>
                {form.filePath && (
                  <Button
                    type="button"
                    variant="ghost"
                    iconOnly
                    className="btn-clear-file"
                    title="Remover arquivo"
                    onClick={() => {
                      setForm(f => ({ ...f, filePath: '' }))
                      setMediaType('video')
                    }}
                    icon={<X size={14} />}
                  />
                )}
              </div>
              {form.filePath && (
                <div className="media-type-badge">
                  <MediaIcon type={mediaType} size={12} />
                  <span>{mediaType === 'video' ? 'Video' : mediaType === 'image' ? 'Imagem - duracao manual' : 'Audio'}</span>
                  <span className="file-path-full" title={form.filePath}>{form.filePath}</span>
                </div>
              )}
            </Field>

            <FieldRow>
              <Field
                label={
                  <span className="item-modal-inline-label">
                    <span>Duracao (s)</span>
                    {detectingDuration && (
                      <span className="detecting-badge">
                        <Loader2 size={11} className="spin" /> Detectando...
                      </span>
                    )}
                    {!detectingDuration && form.filePath && mediaType === 'image' && (
                      <Badge tone="muted">manual</Badge>
                    )}
                  </span>
                }
              >
                <input
                  type="number"
                  value={durationStr}
                  onChange={(e) => setDurationStr(e.target.value)}
                  min="1"
                  max="7200"
                  disabled={detectingDuration}
                  className="ui-input"
                />
              </Field>

              <Field label={`${t.common.time} (HH:MM:SS)`}>
                <input
                  type="time"
                  step="1"
                  value={form.scheduledTime}
                  onChange={(e) => set('scheduledTime', e.target.value)}
                  className="ui-input"
                />
              </Field>
            </FieldRow>

            {form.filePath ? (
              <Field label="Input vMix">
                <div className="input-auto-note">
                  Gerenciado automaticamente pelo VTMaster ao veicular
                </div>
              </Field>
            ) : (
              <Field
                label={`${t.playlist.columns.input} (vMix)`}
                hint="Numero ou nome de um input ja existente no vMix (sem arquivo)"
              >
                <input
                  type="text"
                  value={form.inputName}
                  onChange={(e) => set('inputName', e.target.value)}
                  placeholder="Ex: 1, Camera1, NDI-Source, Grafismo"
                  className="ui-input"
                />
              </Field>
            )}

            <Field label={t.common.notes}>
              <textarea
                value={form.notes}
                onChange={(e) => set('notes', e.target.value)}
                rows={2}
                placeholder="Observacoes opcionais..."
                className="ui-textarea"
              />
            </Field>
          </>
        )}
      </form>
    </Modal>
  )
}
