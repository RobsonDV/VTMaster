import { useState } from 'react'
import { Plus, Edit2, Trash2, ChevronUp, ChevronDown, Tv, Music, DollarSign, AlertCircle, RefreshCw, Copy, Download, Upload } from 'lucide-react'
import { useApp } from '../../store/AppContext'
import type { ProgramSlot, ScheduleSlotType, WeeklyProgramGrid } from '../../types'
import { formatDuration } from '../../utils/time'
import ProgramSlotModal from './ProgramSlotModal'
import './GradePanel.css'

// ─── Formato do arquivo de exportação ────────────────────────────────────────
interface GridExportFile {
  version: '1'
  type: 'vtmaster-grade'
  exportedAt: string
  grid: WeeklyProgramGrid
}

function isValidGridExport(data: unknown): data is GridExportFile {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>
  return d.type === 'vtmaster-grade' && d.version === '1' && !!d.grid && typeof d.grid === 'object'
}

const DAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

// ─── Modal de cópia de dia ────────────────────────────────────────────────────
function CopyDayModal({ sourceDay, slots, onClose }: {
  sourceDay: number
  slots: ProgramSlot[]
  onClose: () => void
}) {
  const { state, dispatch } = useApp()
  const [targets, setTargets] = useState<number[]>([])

  const toggle = (dow: number) =>
    setTargets(prev => prev.includes(dow) ? prev.filter(d => d !== dow) : [...prev, dow])

  const handleCopy = () => {
    if (targets.length === 0) return
    const newGrid = { ...state.weeklyGrid }
    for (const dow of targets) {
      newGrid[dow] = slots.map((s, i) => ({
        ...s,
        id: crypto.randomUUID(),
        order: i + 1,
      }))
    }
    dispatch({ type: 'SET_WEEKLY_GRID', payload: newGrid })
    onClose()
  }

  const allOtherDays = [0,1,2,3,4,5,6].filter(d => d !== sourceDay)

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
      onClick={onClose}
    >
      <div
        style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 10, padding: 20, minWidth: 300, boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 4, color: 'var(--text-primary)' }}>
          Copiar estrutura de {DAY_LABELS[sourceDay]}
        </div>
        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: 14 }}>
          Selecione os dias que receberão a mesma estrutura ({slots.length} slots):
        </div>

        {/* Select all Seg–Sex shortcut */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
          <button
            type="button"
            onClick={() => setTargets(prev => {
              const weekdays = [1,2,3,4,5].filter(d => d !== sourceDay)
              const allSelected = weekdays.every(d => prev.includes(d))
              return allSelected ? prev.filter(d => !weekdays.includes(d)) : [...new Set([...prev, ...weekdays])]
            })}
            style={{ padding: '3px 10px', borderRadius: 5, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontSize: '0.73rem', cursor: 'pointer' }}
          >
            Seg–Sex
          </button>
          <button
            type="button"
            onClick={() => setTargets(prev => {
              const weekend = [0,6].filter(d => d !== sourceDay)
              const allSelected = weekend.every(d => prev.includes(d))
              return allSelected ? prev.filter(d => !weekend.includes(d)) : [...new Set([...prev, ...weekend])]
            })}
            style={{ padding: '3px 10px', borderRadius: 5, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontSize: '0.73rem', cursor: 'pointer' }}
          >
            Fim de semana
          </button>
          <button
            type="button"
            onClick={() => setTargets(allOtherDays.length === targets.length ? [] : allOtherDays)}
            style={{ padding: '3px 10px', borderRadius: 5, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontSize: '0.73rem', cursor: 'pointer' }}
          >
            Todos
          </button>
        </div>

        {/* Day checkboxes */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
          {allOtherDays.map(dow => (
            <button
              key={dow}
              type="button"
              onClick={() => toggle(dow)}
              style={{
                padding: '5px 12px', borderRadius: 6, border: '1px solid',
                borderColor: targets.includes(dow) ? 'var(--accent)' : 'var(--border)',
                background: targets.includes(dow) ? 'color-mix(in srgb, var(--accent) 15%, transparent)' : 'transparent',
                color: targets.includes(dow) ? 'var(--accent)' : 'var(--text-secondary)',
                fontSize: '0.8rem', fontWeight: targets.includes(dow) ? 700 : 400, cursor: 'pointer',
              }}
            >
              {DAY_LABELS[dow]}
              {state.weeklyGrid[dow]?.length > 0 && (
                <span style={{ fontSize: '0.65rem', opacity: 0.65, marginLeft: 4 }}>
                  ({state.weeklyGrid[dow].length})
                </span>
              )}
            </button>
          ))}
        </div>

        {targets.length > 0 && (
          <div style={{ fontSize: '0.73rem', color: 'var(--warning)', marginBottom: 10 }}>
            ⚠ A estrutura atual dos dias selecionados será substituída.
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.82rem' }}
          >
            Cancelar
          </button>
          <button
            onClick={handleCopy}
            disabled={targets.length === 0}
            style={{ padding: '6px 16px', borderRadius: 6, border: 'none', background: 'var(--accent)', color: '#fff', cursor: targets.length === 0 ? 'not-allowed' : 'pointer', fontSize: '0.82rem', fontWeight: 600, opacity: targets.length === 0 ? 0.5 : 1 }}
          >
            Copiar para {targets.length > 0 ? `${targets.length} dia${targets.length > 1 ? 's' : ''}` : '...'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Modal de importação de grade ────────────────────────────────────────────
function ImportGridModal({ importedGrid, onClose }: {
  importedGrid: WeeklyProgramGrid
  onClose: () => void
}) {
  const { state, dispatch } = useApp()
  const [targets, setTargets] = useState<number[]>([0,1,2,3,4,5,6])

  const toggle = (dow: number) =>
    setTargets(prev => prev.includes(dow) ? prev.filter(d => d !== dow) : [...prev, dow])

  const slotCount = (dow: number) => importedGrid[dow]?.length ?? 0

  const handleImport = () => {
    if (targets.length === 0) return
    const newGrid = { ...state.weeklyGrid }
    for (const dow of targets) {
      newGrid[dow] = (importedGrid[dow] ?? []).map((s, i) => ({
        ...s,
        id: crypto.randomUUID(),
        order: i + 1,
      }))
    }
    dispatch({ type: 'SET_WEEKLY_GRID', payload: newGrid })
    onClose()
  }

  const allDays = [0,1,2,3,4,5,6]

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
      onClick={onClose}
    >
      <div
        style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 10, padding: 20, minWidth: 320, boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 4, color: 'var(--text-primary)' }}>
          Importar Estrutura
        </div>
        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: 14 }}>
          Selecione os dias que serão substituídos pela estrutura importada:
        </div>

        {/* Atalhos de seleção */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
          {[
            { label: 'Seg–Sex', days: [1,2,3,4,5] },
            { label: 'Fim de semana', days: [0,6] },
            { label: 'Todos', days: allDays },
          ].map(({ label, days }) => (
            <button
              key={label}
              type="button"
              onClick={() => {
                const allSel = days.every(d => targets.includes(d))
                setTargets(prev => allSel ? prev.filter(d => !days.includes(d)) : [...new Set([...prev, ...days])])
              }}
              style={{ padding: '3px 10px', borderRadius: 5, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontSize: '0.73rem', cursor: 'pointer' }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Checkboxes de dias */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
          {allDays.map(dow => {
            const count = slotCount(dow)
            return (
              <button
                key={dow}
                type="button"
                onClick={() => toggle(dow)}
                style={{
                  padding: '5px 12px', borderRadius: 6, border: '1px solid',
                  borderColor: targets.includes(dow) ? 'var(--accent)' : 'var(--border)',
                  background: targets.includes(dow) ? 'color-mix(in srgb, var(--accent) 15%, transparent)' : 'transparent',
                  color: targets.includes(dow) ? 'var(--accent)' : 'var(--text-secondary)',
                  fontSize: '0.8rem', fontWeight: targets.includes(dow) ? 700 : 400, cursor: 'pointer',
                }}
              >
                {DAY_LABELS[dow]}
                <span style={{ fontSize: '0.65rem', opacity: 0.65, marginLeft: 4 }}>({count})</span>
              </button>
            )
          })}
        </div>

        {targets.length > 0 && (
          <div style={{ fontSize: '0.73rem', color: 'var(--warning)', marginBottom: 10 }}>
            ⚠ A estrutura atual dos dias selecionados será substituída.
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.82rem' }}
          >
            Cancelar
          </button>
          <button
            onClick={handleImport}
            disabled={targets.length === 0}
            style={{ padding: '6px 16px', borderRadius: 6, border: 'none', background: 'var(--accent)', color: '#fff', cursor: targets.length === 0 ? 'not-allowed' : 'pointer', fontSize: '0.82rem', fontWeight: 600, opacity: targets.length === 0 ? 0.5 : 1 }}
          >
            Importar {targets.length > 0 ? `${targets.length} dia${targets.length > 1 ? 's' : ''}` : '...'}
          </button>
        </div>
      </div>
    </div>
  )
}

interface Props {
  onNavigate?: (panel: 'playlist' | 'grade' | 'programacao' | 'adbreaks' | 'clients' | 'log' | 'reports') => void
}

// Cor e ícone por tipo de slot
function SlotIcon({ type }: { type: ScheduleSlotType }) {
  if (type === 'bloco_musical')   return <Music size={13} style={{ color: '#22c55e' }} />
  if (type === 'bloco_comercial') return <DollarSign size={13} style={{ color: '#f59e0b' }} />
  if (type === 'programa')        return <Tv size={13} style={{ color: '#0ea5e9' }} />
  if (type === 'vinheta')         return <Tv size={13} style={{ color: '#8b5cf6' }} />
  return <Tv size={13} style={{ color: 'var(--text-secondary)' }} />
}

function slotBorderColor(type: ScheduleSlotType): string {
  if (type === 'bloco_musical')   return '#22c55e'
  if (type === 'bloco_comercial') return '#f59e0b'
  if (type === 'programa')        return '#0ea5e9'
  if (type === 'vinheta')         return '#8b5cf6'
  return 'var(--text-secondary)'
}

function slotBg(type: ScheduleSlotType): string {
  if (type === 'bloco_musical')   return 'color-mix(in srgb, #22c55e 5%, var(--bg-secondary))'
  if (type === 'bloco_comercial') return 'color-mix(in srgb, #f59e0b 5%, var(--bg-secondary))'
  if (type === 'programa')        return 'color-mix(in srgb, #0ea5e9 5%, var(--bg-secondary))'
  if (type === 'vinheta')         return 'color-mix(in srgb, #8b5cf6 5%, var(--bg-secondary))'
  return 'var(--bg-secondary)'
}

export default function GradePanel({ onNavigate }: Props) {
  const { state, dispatch, t, generatePlaylistFromGrid } = useApp()
  const todayDow = new Date().getDay()
  const [selectedDay, setSelectedDay] = useState(todayDow)
  // editingSlot: undefined=closed, null=new, ProgramSlot=editing
  const [editingSlot, setEditingSlot] = useState<ProgramSlot | null | undefined>(undefined)
  const [newSlotType, setNewSlotType] = useState<ScheduleSlotType>('programa')
  const [showCopyModal, setShowCopyModal] = useState(false)
  const [importedGrid, setImportedGrid] = useState<WeeklyProgramGrid | null>(null)
  const [exportMsg, setExportMsg] = useState<string | null>(null)

  const slots = (state.weeklyGrid[selectedDay] ?? []).slice().sort((a, b) =>
    a.scheduledTime.localeCompare(b.scheduledTime) || a.order - b.order
  )

  const handleLoadToday = () => {
    if (!window.confirm(t.grade.loadTodayConfirm)) return
    generatePlaylistFromGrid()
    onNavigate?.('programacao')
  }

  const handleAddSlot = (type: ScheduleSlotType) => {
    setNewSlotType(type)
    setEditingSlot(null)
  }

  const handleExport = async () => {
    if (!window.spotmaster?.exportGrid) {
      alert('Erro: API de exportação não disponível. Reinicie o aplicativo.')
      return
    }
    try {
      const exportData: GridExportFile = {
        version: '1',
        type: 'vtmaster-grade',
        exportedAt: new Date().toISOString().slice(0, 10),
        grid: state.weeklyGrid,
      }
      const saved = await window.spotmaster.exportGrid(exportData)
      if (saved) {
        setExportMsg('Estrutura exportada com sucesso!')
        setTimeout(() => setExportMsg(null), 3000)
      }
    } catch (err) {
      alert(`Erro ao exportar: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const handleImport = async () => {
    if (!window.spotmaster?.importGrid) {
      alert('Erro: API de importação não disponível. Reinicie o aplicativo.')
      return
    }
    try {
      const raw = await window.spotmaster.importGrid()
      if (!raw) return
      if (!isValidGridExport(raw)) {
        alert('Arquivo inválido. Selecione um arquivo de grade VTMaster (.vtgrid).')
        return
      }
      setImportedGrid(raw.grid)
    } catch (err) {
      alert(`Erro ao importar: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const handleMoveUp = (slot: ProgramSlot) => {
    const ordered = (state.weeklyGrid[selectedDay] ?? []).slice().sort((a, b) => a.order - b.order)
    const idx = ordered.findIndex(s => s.id === slot.id)
    if (idx <= 0) return
    const next = ordered.map((s, i) => {
      if (i === idx - 1) return { ...s, order: slot.order }
      if (i === idx)     return { ...slot, order: ordered[idx - 1].order }
      return s
    })
    dispatch({ type: 'REORDER_PROGRAM_SLOTS', payload: { day: selectedDay, slots: next } })
  }

  const handleMoveDown = (slot: ProgramSlot) => {
    const ordered = (state.weeklyGrid[selectedDay] ?? []).slice().sort((a, b) => a.order - b.order)
    const idx = ordered.findIndex(s => s.id === slot.id)
    if (idx >= ordered.length - 1) return
    const next = ordered.map((s, i) => {
      if (i === idx)     return { ...slot, order: ordered[idx + 1].order }
      if (i === idx + 1) return { ...s, order: slot.order }
      return s
    })
    dispatch({ type: 'REORDER_PROGRAM_SLOTS', payload: { day: selectedDay, slots: next } })
  }

  const handleDelete = (slotId: string) => {
    if (!window.confirm(t.common.confirmDelete)) return
    dispatch({ type: 'DELETE_PROGRAM_SLOT', payload: { day: selectedDay, slotId } })
  }

  const getSlotLabel = (slot: ProgramSlot): string => {
    return t.grade.slotTypes[slot.type as keyof typeof t.grade.slotTypes] ?? slot.type
  }

  const getSlotContent = (slot: ProgramSlot): { text: string; isEmpty: boolean } => {
    if (slot.type === 'bloco_musical') {
      // Musical blocks are always empty in the Estrutura — content added in Programação
      return { text: 'Adicionar músicas na aba Programação', isEmpty: false }
    }
    if (slot.type === 'bloco_comercial') {
      if (!slot.commercialBlockId) return { text: 'Sem bloco', isEmpty: true }
      const block = state.commercialBlocks.find(b => b.id === slot.commercialBlockId)
      if (!block) return { text: 'Bloco removido', isEmpty: true }
      const count = block.items?.length ?? 0
      return count > 0
        ? { text: `${count} item${count > 1 ? 's' : ''} configurados`, isEmpty: false }
        : { text: 'Vazio — adicionar em Blocos Comerciais', isEmpty: false }
    }
    if (slot.filePath) return { text: slot.filePath.split(/[\\/]/).pop() ?? slot.title, isEmpty: false }
    if (slot.inputName) return { text: `Input: ${slot.inputName}`, isEmpty: false }
    return { text: 'Sem arquivo (opcional)', isEmpty: false }
  }

  return (
    <div className="grade-panel">
      {/* Header */}
      <div className="grade-panel-header">
        <div>
          <h2 style={{ fontSize: '0.95rem', fontWeight: 700 }}>{t.grade.title}</h2>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
            Monte a estrutura semanal — defina o esqueleto e preencha depois
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Feedback de exportação */}
          {exportMsg && (
            <span style={{ fontSize: '0.75rem', color: 'var(--success)', fontWeight: 600 }}>
              ✓ {exportMsg}
            </span>
          )}

          {/* Importar estrutura */}
          <button
            onClick={handleImport}
            title="Importar estrutura de grade de um arquivo .vtgrid"
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.78rem' }}
          >
            <Upload size={13} /> Importar
          </button>

          {/* Exportar estrutura */}
          <button
            onClick={handleExport}
            title="Exportar estrutura de grade para arquivo .vtgrid"
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.78rem' }}
          >
            <Download size={13} /> Exportar
          </button>

          {slots.length > 0 && (
            <button
              onClick={() => setShowCopyModal(true)}
              title="Copiar esta estrutura para outros dias da semana"
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.78rem' }}
            >
              <Copy size={13} /> Copiar para...
            </button>
          )}
          <button
            className="grade-load-btn"
            onClick={handleLoadToday}
            title="Regenerar a Programação do Dia com base neste template"
          >
            <RefreshCw size={13} />
            {t.grade.loadToday}
          </button>
        </div>
      </div>

      {/* Day tabs */}
      <div className="grade-day-tabs">
        {t.grade.days.map((dayLabel, dow) => (
          <button
            key={dow}
            className={`grade-day-tab${selectedDay === dow ? ' active' : ''}${dow === todayDow ? ' is-today' : ''}`}
            onClick={() => setSelectedDay(dow)}
          >
            {dayLabel}
            {dow === todayDow && <span style={{ fontSize: '0.6rem', marginLeft: 3, opacity: 0.65 }}>({t.grade.today})</span>}
          </button>
        ))}
      </div>

      {/* Add buttons */}
      <div style={{ display: 'flex', gap: 8, padding: '10px 20px 0', flexWrap: 'wrap' }}>
        <button
          className="grade-add-btn"
          onClick={() => handleAddSlot('programa')}
          style={{ borderColor: '#0ea5e960', color: '#0ea5e9' }}
        >
          <Plus size={13} /><Tv size={12} /> {t.grade.addPrograma}
        </button>
        <button
          className="grade-add-btn"
          onClick={() => handleAddSlot('bloco_musical')}
          style={{ borderColor: '#22c55e60', color: '#22c55e' }}
        >
          <Plus size={13} /><Music size={12} /> {t.grade.addBlocoMusical}
        </button>
        <button
          className="grade-add-btn"
          onClick={() => handleAddSlot('bloco_comercial')}
          style={{ borderColor: '#f59e0b60', color: '#f59e0b' }}
        >
          <Plus size={13} /><DollarSign size={12} /> {t.grade.addBlocoComercial}
        </button>
      </div>

      {/* Slot list */}
      <div className="grade-content">
        {slots.length === 0 ? (
          <p className="grade-empty">{t.grade.emptyDay}</p>
        ) : (
          <div className="grade-slot-list">
            {slots.map((slot, idx) => {
              const { text, isEmpty } = getSlotContent(slot)
              const borderColor = slotBorderColor(slot.type)
              const bg = slotBg(slot.type)
              return (
                <div
                  key={slot.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '9px 10px',
                    background: bg,
                    border: `1px solid ${isEmpty ? borderColor + '40' : borderColor + '60'}`,
                    borderLeft: `3px solid ${borderColor}`,
                    borderStyle: isEmpty ? 'dashed' : 'solid',
                    borderLeftStyle: 'solid',
                    borderRadius: 6,
                    marginBottom: 4,
                    opacity: isEmpty ? 0.85 : 1,
                  }}
                >
                  {/* Time */}
                  <span style={{ fontSize: '0.82rem', fontWeight: 700, color: borderColor, minWidth: 46, fontVariantNumeric: 'tabular-nums' }}>
                    {slot.scheduledTime.slice(0, 5)}
                  </span>

                  {/* Icon + type label */}
                  <SlotIcon type={slot.type} />
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: borderColor, minWidth: 90, whiteSpace: 'nowrap' }}>
                    {getSlotLabel(slot)}
                  </span>

                  {/* Title */}
                  <span style={{ fontSize: '0.83rem', fontWeight: 500, color: 'var(--text-primary)', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {slot.title}
                  </span>

                  {/* Content (file/block) */}
                  <span style={{ fontSize: '0.73rem', color: isEmpty ? 'var(--text-secondary)' : 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {isEmpty && <AlertCircle size={11} style={{ color: 'var(--warning)', flexShrink: 0 }} />}
                    {text}
                  </span>

                  {/* Duration */}
                  {slot.duration > 0 && (
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', minWidth: 40, textAlign: 'right', flexShrink: 0 }}>
                      {formatDuration(slot.duration)}
                    </span>
                  )}

                  {/* Actions */}
                  <div className="grade-slot-actions">
                    <button className="grade-slot-btn" onClick={() => handleMoveUp(slot)} disabled={idx === 0} title="Mover para cima">
                      <ChevronUp size={12} />
                    </button>
                    <button className="grade-slot-btn" onClick={() => handleMoveDown(slot)} disabled={idx === slots.length - 1} title="Mover para baixo">
                      <ChevronDown size={12} />
                    </button>
                    <button className="grade-slot-btn" onClick={() => setEditingSlot(slot)} title={t.grade.editSlot}>
                      <Edit2 size={12} />
                    </button>
                    <button className="grade-slot-btn danger" onClick={() => handleDelete(slot.id)} title={t.common.delete}>
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Modais */}
      {editingSlot !== undefined && (
        <ProgramSlotModal
          slot={editingSlot}
          defaultType={newSlotType}
          day={selectedDay}
          onClose={() => setEditingSlot(undefined)}
        />
      )}
      {showCopyModal && (
        <CopyDayModal
          sourceDay={selectedDay}
          slots={slots}
          onClose={() => setShowCopyModal(false)}
        />
      )}
      {importedGrid && (
        <ImportGridModal
          importedGrid={importedGrid}
          onClose={() => setImportedGrid(null)}
        />
      )}
    </div>
  )
}
