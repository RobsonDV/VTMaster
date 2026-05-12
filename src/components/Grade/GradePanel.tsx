import { useState } from 'react'
import { Plus, Edit2, Trash2, ChevronUp, ChevronDown, Tv, Music, DollarSign, AlertCircle, RefreshCw, Copy, Download, Upload } from 'lucide-react'
import { useApp } from '../../store/AppContext'
import type { ProgramSlot, ScheduleSlotType, WeeklyProgramGrid } from '../../types'
import { formatDuration } from '../../utils/time'
import Badge from '../ui/Badge'
import Button from '../ui/Button'
import Modal from '../ui/Modal'
import PageHeader from '../ui/PageHeader'
import ProgramSlotModal from './ProgramSlotModal'
import './GradePanel.css'

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

function DaySelectionModal({
  title,
  subtitle,
  selectedDays,
  onToggle,
  onQuickPick,
  onClose,
  onConfirm,
  confirmLabel,
  counts,
  warning,
}: {
  title: string
  subtitle: string
  selectedDays: number[]
  onToggle: (dow: number) => void
  onQuickPick: (days: number[]) => void
  onClose: () => void
  onConfirm: () => void
  confirmLabel: string
  counts: Record<number, number>
  warning?: string
}) {
  const allDays = [0, 1, 2, 3, 4, 5, 6]
  const setDays = (days: number[]) => {
    const allSelected = days.every(d => selectedDays.includes(d))
    onQuickPick(allSelected ? selectedDays.filter(d => !days.includes(d)) : [...new Set([...selectedDays, ...days])].sort((a, b) => a - b))
  }

  return (
    <Modal
      title={title}
      onClose={onClose}
      minWidth={340}
      actions={
        <>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" onClick={onConfirm} disabled={selectedDays.length === 0}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="ui-field-hint">{subtitle}</div>

      <div className="grade-quick-actions">
        <Button size="sm" variant="ghost" onClick={() => setDays([1, 2, 3, 4, 5])}>Seg-Sex</Button>
        <Button size="sm" variant="ghost" onClick={() => setDays([0, 6])}>Fim de semana</Button>
        <Button size="sm" variant="ghost" onClick={() => setDays(allDays)}>Todos</Button>
      </div>

      <div className="grade-day-chip-grid">
        {allDays.map((dow) => (
          <Button
            key={dow}
            size="sm"
            variant={selectedDays.includes(dow) ? 'primary' : 'ghost'}
            onClick={() => onToggle(dow)}
            className="grade-day-chip"
          >
            {DAY_LABELS[dow]}
            <span className="grade-day-chip-count">({counts[dow] ?? 0})</span>
          </Button>
        ))}
      </div>

      {warning && selectedDays.length > 0 ? (
        <div className="ui-card-note ui-card-note--warning">{warning}</div>
      ) : null}
    </Modal>
  )
}

function CopyDayModal({ sourceDay, slots, onClose }: { sourceDay: number; slots: ProgramSlot[]; onClose: () => void }) {
  const { state, dispatch } = useApp()
  const [targets, setTargets] = useState<number[]>([])
  const allOtherDays = [0, 1, 2, 3, 4, 5, 6].filter(d => d !== sourceDay)

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

  const counts = Object.fromEntries(allOtherDays.map((dow) => [dow, state.weeklyGrid[dow]?.length ?? 0])) as Record<number, number>

  return (
    <DaySelectionModal
      title={`Copiar estrutura de ${DAY_LABELS[sourceDay]}`}
      subtitle={`Selecione os dias que receberão a mesma estrutura (${slots.length} slots).`}
      selectedDays={targets}
      onToggle={(dow) => setTargets(prev => prev.includes(dow) ? prev.filter(d => d !== dow) : [...prev, dow].sort((a, b) => a - b))}
      onQuickPick={setTargets}
      onClose={onClose}
      onConfirm={handleCopy}
      confirmLabel={`Copiar para ${targets.length > 0 ? `${targets.length} dia${targets.length > 1 ? 's' : ''}` : '...'}`}
      counts={counts}
      warning="A estrutura atual dos dias selecionados será substituída."
    />
  )
}

function ImportGridModal({ importedGrid, onClose }: { importedGrid: WeeklyProgramGrid; onClose: () => void }) {
  const { state, dispatch } = useApp()
  const [targets, setTargets] = useState<number[]>([0, 1, 2, 3, 4, 5, 6])

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

  const counts = Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map((dow) => [dow, importedGrid[dow]?.length ?? 0])) as Record<number, number>

  return (
    <DaySelectionModal
      title="Importar Estrutura"
      subtitle="Selecione os dias que serão substituídos pela estrutura importada."
      selectedDays={targets}
      onToggle={(dow) => setTargets(prev => prev.includes(dow) ? prev.filter(d => d !== dow) : [...prev, dow].sort((a, b) => a - b))}
      onQuickPick={setTargets}
      onClose={onClose}
      onConfirm={handleImport}
      confirmLabel={`Importar ${targets.length > 0 ? `${targets.length} dia${targets.length > 1 ? 's' : ''}` : '...'}`}
      counts={counts}
      warning="A estrutura atual dos dias selecionados será substituída."
    />
  )
}

interface Props {
  onNavigate?: (panel: 'playlist' | 'grade' | 'programacao' | 'adbreaks' | 'clients' | 'log' | 'reports') => void
}

function SlotIcon({ type }: { type: ScheduleSlotType }) {
  if (type === 'bloco_musical') return <Music size={13} style={{ color: '#22c55e' }} />
  if (type === 'bloco_comercial') return <DollarSign size={13} style={{ color: '#f59e0b' }} />
  if (type === 'programa') return <Tv size={13} style={{ color: '#0ea5e9' }} />
  if (type === 'vinheta') return <Tv size={13} style={{ color: '#8b5cf6' }} />
  return <Tv size={13} style={{ color: 'var(--text-secondary)' }} />
}

function slotBorderColor(type: ScheduleSlotType): string {
  if (type === 'bloco_musical') return '#22c55e'
  if (type === 'bloco_comercial') return '#f59e0b'
  if (type === 'programa') return '#0ea5e9'
  if (type === 'vinheta') return '#8b5cf6'
  return 'var(--text-secondary)'
}

function slotBg(type: ScheduleSlotType): string {
  if (type === 'bloco_musical') return 'color-mix(in srgb, #22c55e 5%, var(--bg-secondary))'
  if (type === 'bloco_comercial') return 'color-mix(in srgb, #f59e0b 5%, var(--bg-secondary))'
  if (type === 'programa') return 'color-mix(in srgb, #0ea5e9 5%, var(--bg-secondary))'
  if (type === 'vinheta') return 'color-mix(in srgb, #8b5cf6 5%, var(--bg-secondary))'
  return 'var(--bg-secondary)'
}

export default function GradePanel({ onNavigate }: Props) {
  const { state, dispatch, t, generatePlaylistFromGrid } = useApp()
  const todayDow = new Date().getDay()
  const [selectedDay, setSelectedDay] = useState(todayDow)
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
      if (i === idx) return { ...slot, order: ordered[idx - 1].order }
      return s
    })
    dispatch({ type: 'REORDER_PROGRAM_SLOTS', payload: { day: selectedDay, slots: next } })
  }

  const handleMoveDown = (slot: ProgramSlot) => {
    const ordered = (state.weeklyGrid[selectedDay] ?? []).slice().sort((a, b) => a.order - b.order)
    const idx = ordered.findIndex(s => s.id === slot.id)
    if (idx >= ordered.length - 1) return
    const next = ordered.map((s, i) => {
      if (i === idx) return { ...slot, order: ordered[idx + 1].order }
      if (i === idx + 1) return { ...s, order: slot.order }
      return s
    })
    dispatch({ type: 'REORDER_PROGRAM_SLOTS', payload: { day: selectedDay, slots: next } })
  }

  const handleDelete = (slotId: string) => {
    if (!window.confirm(t.common.confirmDelete)) return
    dispatch({ type: 'DELETE_PROGRAM_SLOT', payload: { day: selectedDay, slotId } })
  }

  const getSlotLabel = (slot: ProgramSlot): string => t.grade.slotTypes[slot.type as keyof typeof t.grade.slotTypes] ?? slot.type

  const getSlotContent = (slot: ProgramSlot): { text: string; isEmpty: boolean } => {
    if (slot.type === 'bloco_musical') return { text: 'Adicionar músicas na aba Programação', isEmpty: false }
    if (slot.type === 'bloco_comercial') {
      if (!slot.commercialBlockId) return { text: 'Sem bloco', isEmpty: true }
      const block = state.commercialBlocks.find(b => b.id === slot.commercialBlockId)
      if (!block) return { text: 'Bloco removido', isEmpty: true }
      const count = block.items?.length ?? 0
      return count > 0
        ? { text: `${count} item${count > 1 ? 's' : ''} configurados`, isEmpty: false }
        : { text: 'Vazio - adicionar em Blocos Comerciais', isEmpty: false }
    }
    if (slot.filePath) return { text: slot.filePath.split(/[\\/]/).pop() ?? slot.title, isEmpty: false }
    if (slot.inputName) return { text: `Input: ${slot.inputName}`, isEmpty: false }
    return { text: 'Sem arquivo (opcional)', isEmpty: false }
  }

  return (
    <div className="grade-panel">
      <PageHeader
        title={t.grade.title}
        subtitle="Monte a estrutura semanal e preencha o conteúdo operacional depois."
        actions={
          <>
            {exportMsg ? <Badge tone="accent">{exportMsg}</Badge> : null}
            <Button size="sm" variant="secondary" onClick={handleImport} title="Importar estrutura de grade de um arquivo .vtgrid" icon={<Upload size={13} />}>Importar</Button>
            <Button size="sm" variant="secondary" onClick={handleExport} title="Exportar estrutura de grade para arquivo .vtgrid" icon={<Download size={13} />}>Exportar</Button>
            {slots.length > 0 ? (
              <Button size="sm" variant="secondary" onClick={() => setShowCopyModal(true)} title="Copiar esta estrutura para outros dias da semana" icon={<Copy size={13} />}>Copiar para...</Button>
            ) : null}
            <Button size="sm" variant="primary" onClick={handleLoadToday} title="Regenerar a Programação do Dia com base neste template" icon={<RefreshCw size={13} />}>
              {t.grade.loadToday}
            </Button>
          </>
        }
      />

      <div className="grade-day-tabs">
        {t.grade.days.map((dayLabel, dow) => (
          <button
            key={dow}
            className={`grade-day-tab${selectedDay === dow ? ' active' : ''}${dow === todayDow ? ' is-today' : ''}`}
            onClick={() => setSelectedDay(dow)}
          >
            {dayLabel}
            {dow === todayDow && <span className="grade-day-tab-note">({t.grade.today})</span>}
          </button>
        ))}
      </div>

      <div className="grade-add-actions">
        <Button className="grade-add-btn grade-add-btn--programa" variant="ghost" onClick={() => handleAddSlot('programa')} icon={<><Plus size={13} /><Tv size={12} /></>}>
          {t.grade.addPrograma}
        </Button>
        <Button className="grade-add-btn grade-add-btn--musical" variant="ghost" onClick={() => handleAddSlot('bloco_musical')} icon={<><Plus size={13} /><Music size={12} /></>}>
          {t.grade.addBlocoMusical}
        </Button>
        <Button className="grade-add-btn grade-add-btn--comercial" variant="ghost" onClick={() => handleAddSlot('bloco_comercial')} icon={<><Plus size={13} /><DollarSign size={12} /></>}>
          {t.grade.addBlocoComercial}
        </Button>
      </div>

      <div className="grade-content">
        {slots.length === 0 ? (
          <div className="ui-card-note">{t.grade.emptyDay}</div>
        ) : (
          <div className="grade-slot-list">
            {slots.map((slot, idx) => {
              const { text, isEmpty } = getSlotContent(slot)
              const borderColor = slotBorderColor(slot.type)
              const bg = slotBg(slot.type)
              return (
                <div
                  key={slot.id}
                  className="grade-slot-card"
                  style={{
                    background: bg,
                    border: `1px solid ${isEmpty ? borderColor + '40' : borderColor + '60'}`,
                    borderLeft: `3px solid ${borderColor}`,
                    borderStyle: isEmpty ? 'dashed' : 'solid',
                    borderLeftStyle: 'solid',
                    opacity: isEmpty ? 0.85 : 1,
                  }}
                >
                  <span className="grade-slot-time" style={{ color: borderColor }}>
                    {slot.scheduledTime.slice(0, 5)}
                  </span>
                  <SlotIcon type={slot.type} />
                  <span className="grade-slot-label" style={{ color: borderColor }}>
                    {getSlotLabel(slot)}
                  </span>
                  <span className="grade-slot-title">{slot.title}</span>
                  <span className="grade-slot-content">
                    {isEmpty && <AlertCircle size={11} className="grade-slot-alert" />}
                    {text}
                  </span>
                  {slot.duration > 0 && (
                    <span className="grade-slot-dur">{formatDuration(slot.duration)}</span>
                  )}
                  <div className="grade-slot-actions">
                    <Button className="grade-slot-btn" variant="ghost" size="sm" iconOnly onClick={() => handleMoveUp(slot)} disabled={idx === 0} title="Mover para cima" icon={<ChevronUp size={12} />} />
                    <Button className="grade-slot-btn" variant="ghost" size="sm" iconOnly onClick={() => handleMoveDown(slot)} disabled={idx === slots.length - 1} title="Mover para baixo" icon={<ChevronDown size={12} />} />
                    <Button className="grade-slot-btn" variant="ghost" size="sm" iconOnly onClick={() => setEditingSlot(slot)} title={t.grade.editSlot} icon={<Edit2 size={12} />} />
                    <Button className="grade-slot-btn grade-slot-btn-danger" variant="ghost" size="sm" iconOnly onClick={() => handleDelete(slot.id)} title={t.common.delete} icon={<Trash2 size={12} />} />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {editingSlot !== undefined && (
        <ProgramSlotModal
          slot={editingSlot}
          defaultType={newSlotType}
          day={selectedDay}
          onClose={() => setEditingSlot(undefined)}
        />
      )}
      {showCopyModal && <CopyDayModal sourceDay={selectedDay} slots={slots} onClose={() => setShowCopyModal(false)} />}
      {importedGrid && <ImportGridModal importedGrid={importedGrid} onClose={() => setImportedGrid(null)} />}
    </div>
  )
}
