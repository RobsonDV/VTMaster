import { useState, useRef, useEffect } from 'react'
import { Film, Music, Image as ImageIcon, Tv, DollarSign, X } from 'lucide-react'
import { useApp } from '../../store/AppContext'
import type { ProgramSlot, ScheduleSlotType } from '../../types'
import Button from '../ui/Button'
import { Field, FieldRow } from '../ui/Field'
import Modal from '../ui/Modal'
import SegmentedControl from '../ui/SegmentedControl'
import { detectMediaType, readMediaDuration } from '../../utils/mediaDuration'
import '../Playlist/ItemModal.css'

function autoTitle(type: ScheduleSlotType, hhmm: string): string {
  if (type === 'bloco_musical') return `Musical ${hhmm}`
  if (type === 'bloco_comercial') return `Comercial ${hhmm}`
  if (type === 'programa') return `Programa ${hhmm}`
  if (type === 'vinheta') return `Vinheta ${hhmm}`
  if (type === 'bumper') return `Bumper ${hhmm}`
  return `Slot ${hhmm}`
}

const MEDIA_TYPES: ScheduleSlotType[] = ['programa', 'vinheta', 'bumper', 'outros']
const BLOCK_COMERCIAL: ScheduleSlotType = 'bloco_comercial'
const BLOCK_MUSICAL: ScheduleSlotType = 'bloco_musical'

interface Props {
  slot?: ProgramSlot | null
  defaultType?: ScheduleSlotType
  day: number
  onClose: () => void
}

export default function ProgramSlotModal({ slot, defaultType = 'programa', day, onClose }: Props) {
  const { state, dispatch, t } = useApp()
  const firstFieldRef = useRef<HTMLInputElement | null>(null)

  const [type, setType] = useState<ScheduleSlotType>(slot?.type ?? defaultType)
  const [schedTime, setSchedTime] = useState(slot?.scheduledTime?.slice(0, 5) ?? '08:00')
  const [customName, setCustomName] = useState(
    slot?.title && !slot.title.match(/^(Musical|Comercial|Programa|Vinheta|Bumper|Slot) \d{2}:\d{2}$/)
      ? slot.title : ''
  )
  const [filePath, setFilePath] = useState(slot?.filePath ?? '')
  const [inputName, setInputName] = useState(slot?.inputName ?? '')
  const [duration, setDuration] = useState(slot?.duration ?? 0)
  const [mediaType, setMediaType] = useState<'video' | 'audio' | 'image'>(slot?.mediaType ?? 'video')
  const [detecting, setDetecting] = useState(false)

  useEffect(() => {
    firstFieldRef.current?.focus()
  }, [])

  const isMedia = MEDIA_TYPES.includes(type)
  const isMusical = type === BLOCK_MUSICAL
  const isComercial = type === BLOCK_COMERCIAL
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
    const title = resolvedTitle

    if (isComercial) {
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
      if (slot) {
        dispatch({ type: 'UPDATE_PROGRAM_SLOT', payload: { day, slot: base } })
      } else {
        dispatch({ type: 'ADD_PROGRAM_SLOT', payload: { day, slot: base } })
      }
      onClose()
      return
    }

    if (isMusical) {
      const base: ProgramSlot = {
        id: slot?.id ?? crypto.randomUUID(),
        order: slot?.order ?? ((state.weeklyGrid[day] ?? []).length + 1),
        title,
        type,
        scheduledTime: timeStr,
        duration: 0,
      }
      if (slot) {
        dispatch({ type: 'UPDATE_PROGRAM_SLOT', payload: { day, slot: base } })
      } else {
        dispatch({ type: 'ADD_PROGRAM_SLOT', payload: { day, slot: base } })
      }
      onClose()
      return
    }

    const base: ProgramSlot = {
      id: slot?.id ?? crypto.randomUUID(),
      order: slot?.order ?? ((state.weeklyGrid[day] ?? []).length + 1),
      title,
      type,
      scheduledTime: timeStr,
      duration,
      filePath: filePath || undefined,
      inputName: inputName || undefined,
      mediaType: filePath ? mediaType : undefined,
    }
    if (slot) {
      dispatch({ type: 'UPDATE_PROGRAM_SLOT', payload: { day, slot: base } })
    } else {
      dispatch({ type: 'ADD_PROGRAM_SLOT', payload: { day, slot: base } })
    }
    onClose()
  }

  const typeLabel = t.grade.slotTypes[type as keyof typeof t.grade.slotTypes] ?? type

  return (
    <Modal
      title={`${slot ? t.grade.editSlot : t.grade.newSlot} - ${typeLabel}`}
      onClose={onClose}
      maxWidth={520}
      actions={
        <>
          <Button variant="ghost" onClick={onClose}>{t.common.cancel}</Button>
          <Button variant="primary" onClick={handleSave}>{t.common.save}</Button>
        </>
      }
    >
      {!slot && (
        <Field label="Tipo">
          <SegmentedControl
            value={type}
            onChange={setType}
            options={[
              { value: 'programa', label: 'Programa', icon: <Tv size={12} /> },
              { value: 'vinheta', label: 'Vinheta', icon: <Film size={12} />, variant: 'purple' },
              { value: 'bloco_musical', label: 'Bloco Musical', icon: <Music size={12} />, variant: 'success' },
              { value: 'bloco_comercial', label: 'Bloco Comercial', icon: <DollarSign size={12} />, variant: 'warning' },
              { value: 'outros', label: 'Outros', icon: <Film size={12} /> },
            ]}
          />
        </Field>
      )}

      <FieldRow>
        <Field label={t.grade.scheduledTime}>
          <input
            ref={firstFieldRef}
            className="ui-input"
            type="time"
            value={schedTime}
            onChange={e => setSchedTime(e.target.value)}
          />
        </Field>
        <Field label={`Nome (automatico: ${autoTitle(type, schedTime)})`} className="settings-grow-2">
          <input
            className="ui-input"
            value={customName}
            onChange={e => setCustomName(e.target.value)}
            placeholder={autoTitle(type, schedTime)}
          />
        </Field>
      </FieldRow>

      {isMusical && (
        <div className="ui-card-note ui-card-note--success">
          <strong>Bloco Musical</strong> - nasce vazio na Estrutura. Você adiciona as músicas na aba <strong>Programação</strong>.
        </div>
      )}

      {isComercial && (
        <div className="ui-card-note ui-card-note--warning">
          <strong>Bloco Comercial</strong> - um bloco vazio será criado automaticamente em <strong>Blocos Comerciais</strong>.
        </div>
      )}

      {isMedia && (
        <>
          <Field label="Arquivo (opcional - pode adicionar depois)">
            <div className="file-picker">
              <input
                className="file-picker-input ui-input"
                value={filePath ? filePath.split(/[\\/]/).pop()! : ''}
                readOnly
                placeholder="Nenhum arquivo selecionado"
              />
              <Button variant="secondary" className="btn-browse" onClick={handleBrowse}>{t.common.browse}</Button>
              {filePath && (
                <Button
                  variant="ghost"
                  iconOnly
                  className="btn-clear-file"
                  onClick={() => { setFilePath(''); setDuration(0) }}
                  icon={<X size={14} />}
                />
              )}
            </div>
            {filePath && (
              <div className="media-type-badge">
                {mediaType === 'image' ? <ImageIcon size={12} /> : mediaType === 'audio' ? <Music size={12} /> : <Film size={12} />}
                <span>{mediaType}</span>
              </div>
            )}
          </Field>

          <FieldRow>
            <Field label={`Duração (s)${detecting ? ' - detectando...' : ''}`}>
              <input
                className="ui-input"
                type="number"
                value={duration}
                min={0}
                onChange={e => setDuration(Math.max(0, parseInt(e.target.value) || 0))}
              />
            </Field>
            <Field label="Input vMix (alternativo ao arquivo)" className="settings-grow-2">
              <input
                className="ui-input"
                value={inputName}
                onChange={e => setInputName(e.target.value)}
                placeholder="Ex: Camera1"
              />
            </Field>
          </FieldRow>
        </>
      )}
    </Modal>
  )
}
