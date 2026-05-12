import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Square, ListVideo, SkipForward, CheckCircle,
  Trash2, RefreshCw, CalendarDays,
  FolderOpen, Plus, Crosshair, Music, DollarSign, Tv,
  Zap, MonitorPlay, Clock, Copy, Play, Pause, GripVertical,
} from 'lucide-react'
import { useApp } from '../../store/AppContext'
import type { PlaylistItem, ProgramSlot, VmixActionItem } from '../../types'
import { formatDuration, today } from '../../utils/time'
import './DaySchedulePanel.css'
import '../Playlist/ContextMenu.css'
import '../Playlist/ItemModal.css'

const IMAGE_EXTS = new Set(['jpg','jpeg','png','gif','bmp','webp','tiff','tif','ico'])
const AUDIO_EXTS = new Set(['mp3','wav','aac','ogg','flac','m4a','wma','opus','aiff'])
const VMIX_FUNCTIONS = [
  'AudioOff','AudioOn','SetVolume','Fade',
  'OverlayInput1','OverlayInput1Out','OverlayInput2','OverlayInput2Out',
  'StartRecording','StopRecording','Cut','Merge',
]

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
      const d = el.duration; el.src = ''
      resolve(isFinite(d) && d > 0 ? Math.round(d) : null)
    }
    el.onerror = () => { clearTimeout(t); el.src = ''; resolve(null) }
    el.src = toLocalMediaUrl(fp)
  })
}

function nowSeconds(): number {
  const d = new Date()
  return d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds()
}

function secsToHHMM(s: number): string {
  const h = Math.floor(s / 3600) % 24
  const m = Math.floor((s % 3600) / 60)
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`
}

interface BlockGroup {
  time: string
  slot: ProgramSlot | null
  items: PlaylistItem[]
}

function buildGroups(sorted: PlaylistItem[], weekSlots: ProgramSlot[]): BlockGroup[] {
  const seen = new Map<string, BlockGroup>()
  for (const item of sorted) {
    const key = item.scheduledTime?.slice(0, 5) ?? '??:??'
    if (!seen.has(key)) {
      const slot = weekSlots.find(s => s.scheduledTime.slice(0, 5) === key) ?? null
      seen.set(key, { time: key, slot, items: [] })
    }
    seen.get(key)!.items.push(item)
  }
  return [...seen.values()].sort((a, b) => a.time.localeCompare(b.time))
}

function cardClass(group: BlockGroup): 'musical' | 'commercial' | 'program' {
  const tp = group.slot?.type
  if (tp === 'bloco_musical') return 'musical'
  if (tp === 'bloco_comercial') return 'commercial'
  if (tp === 'programa') return 'program'
  return group.items.some(i => i.adBreakId) ? 'commercial' : 'musical'
}

const DAY_NAMES = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

// ── Schedule context menu ─────────────────────────────────────────────────────

interface CtxState { x: number; y: number; item: PlaylistItem }

function ScheduleCtxMenu({ menu, onClose, onStartFromHere, onPause, onVmixAction, onVmixInput, onInsertPause, onDuplicate, onSkip, onMarkDone, onEditTime, isPlaying, isToday }: {
  menu: CtxState
  onClose: () => void
  onStartFromHere: () => void
  onPause: () => void
  onVmixAction: () => void
  onVmixInput: () => void
  onInsertPause: () => void
  onDuplicate: () => void
  onSkip: () => void
  onMarkDone: () => void
  onEditTime: () => void
  isPlaying: boolean
  isToday: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  useEffect(() => { onCloseRef.current = onClose })
  // Register once on mount — onCloseRef always points to the latest version
  useEffect(() => {
    const click = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onCloseRef.current() }
    const key   = (e: KeyboardEvent) => { if (e.key === 'Escape') onCloseRef.current() }
    document.addEventListener('mousedown', click)
    document.addEventListener('keydown', key)
    return () => { document.removeEventListener('mousedown', click); document.removeEventListener('keydown', key) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const style: React.CSSProperties = {
    position: 'fixed',
    top:  Math.min(menu.y, window.innerHeight - 310),
    left: Math.min(menu.x, window.innerWidth  - 230),
    zIndex: 9999,
  }
  const run = (fn: () => void) => { fn(); onClose() }
  const isPlayable = menu.item.status === 'pending' || menu.item.status === 'playing'

  return (
    <div ref={ref} className="context-menu" style={style}>
      <div className="ctx-header"><span className="ctx-item-name">{menu.item.title}</span></div>

      {/* ── Playback actions ── */}
      {isToday && (
        <>
          <div className="ctx-separator" />
          <div className="ctx-section-label">Reprodução</div>
          <button className="ctx-item" style={{ color: 'var(--accent)', fontWeight: 600 }} onClick={() => run(onStartFromHere)}>
            <Play size={13} /><span>Iniciar daqui</span><span className="ctx-hint">pula itens anteriores</span>
          </button>
          {isPlaying && (
            <button className="ctx-item" onClick={() => run(onPause)}>
              <Pause size={13} /><span>Pausar</span><span className="ctx-hint">retoma do mesmo item</span>
            </button>
          )}
        </>
      )}

      <div className="ctx-separator" />
      <div className="ctx-section-label">Inserir após</div>
      <button className="ctx-item ctx-item--purple" onClick={() => run(onVmixAction)}>
        <Zap size={13} /><span>Ação vMix</span><span className="ctx-hint">AudioOff, Fade...</span>
      </button>
      <button className="ctx-item" onClick={() => run(onVmixInput)}>
        <MonitorPlay size={13} /><span>Input do vMix</span><span className="ctx-hint">câmera, NDI...</span>
      </button>
      <button className="ctx-item ctx-item--pause" onClick={() => run(onInsertPause)}>
        <Pause size={13} /><span>Ponto de Pausa</span><span className="ctx-hint">pausa automática aqui</span>
      </button>

      <div className="ctx-separator" />
      <div className="ctx-section-label">Editar</div>
      <button className="ctx-item" onClick={() => run(onEditTime)}>
        <Clock size={13} /><span>Horário Agendado</span>
      </button>
      <button className="ctx-item" onClick={() => run(onDuplicate)}>
        <Copy size={13} /><span>Duplicar Item</span>
      </button>

      {isPlayable && (
        <>
          <div className="ctx-separator" />
          <button className="ctx-item" onClick={() => run(onSkip)}>
            <SkipForward size={13} /><span>Pular</span>
          </button>
          <button className="ctx-item" onClick={() => run(onMarkDone)}>
            <CheckCircle size={13} /><span>Marcar como Veiculado</span>
          </button>
        </>
      )}
    </div>
  )
}

// ── vMix Action mini-modal ────────────────────────────────────────────────────

function VmixActionModal({ onInsert, onClose }: {
  onInsert: (action: VmixActionItem) => void
  onClose: () => void
}) {
  const [fn, setFn]       = useState('AudioOff')
  const [input, setInput] = useState('')
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => { inputRef.current?.focus() }, [])
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()} style={{ minWidth: 360, maxWidth: 440 }}>
        <div className="modal-header">
          <h2>Inserir Ação vMix</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-form">
          <div className="form-group">
            <label>Função vMix</label>
            <select value={fn} onChange={e => setFn(e.target.value)}>
              {VMIX_FUNCTIONS.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <div className="form-row">
            <div className="form-group" style={{ flex: 1 }}>
              <label>Input <span style={{ fontWeight: 400, color: 'var(--text-secondary)' }}>(opcional)</span></label>
              <input ref={inputRef} value={input} onChange={e => setInput(e.target.value)} placeholder="ex: Camera1" />
            </div>
            <div className="form-group" style={{ width: 90 }}>
              <label>Valor</label>
              <input value={value} onChange={e => setValue(e.target.value)} placeholder="ex: 100" />
            </div>
          </div>
        </div>
        <div className="modal-actions">
          <button className="btn-cancel" onClick={onClose}>Cancelar</button>
          <button className="btn-save" onClick={() => {
            onInsert({ function: fn, input: input || undefined, value: value || undefined })
            onClose()
          }}>Adicionar</button>
        </div>
      </div>
    </div>
  )
}

// ── vMix Input mini-modal ─────────────────────────────────────────────────────

function VmixInputModal({ onInsert, onClose }: {
  onInsert: (inputName: string, duration: number) => void
  onClose: () => void
}) {
  const [inputName, setInputName] = useState('')
  const [duration, setDuration]   = useState(10)
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => { inputRef.current?.focus() }, [])
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()} style={{ minWidth: 340, maxWidth: 420 }}>
        <div className="modal-header">
          <h2>Inserir Input vMix</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-form">
          <div className="form-row">
            <div className="form-group" style={{ flex: 1 }}>
              <label>Nome ou nº do input</label>
              <input ref={inputRef} value={inputName} onChange={e => setInputName(e.target.value)} placeholder="ex: Camera1" />
            </div>
            <div className="form-group" style={{ width: 90 }}>
              <label>Duração (s)</label>
              <input type="number" value={duration} min={1}
                onChange={e => setDuration(Math.max(1, parseInt(e.target.value) || 10))} />
            </div>
          </div>
        </div>
        <div className="modal-actions">
          <button className="btn-cancel" onClick={onClose}>Cancelar</button>
          <button className="btn-save" disabled={!inputName.trim()} onClick={() => {
            onInsert(inputName, duration); onClose()
          }}>Adicionar</button>
        </div>
      </div>
    </div>
  )
}

// ── Horário agendado mini-modal ───────────────────────────────────────────────

function ScheduleTimeEditModal({ item, date, onClose }: {
  item: PlaylistItem
  date: string
  onClose: () => void
}) {
  const { dispatch } = useApp()
  const [time, setTime] = useState(item.scheduledTime?.slice(0, 5) ?? '')
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => { inputRef.current?.focus() }, [])
  const save = () => {
    dispatch({ type: 'UPDATE_SCHEDULE_ITEM', payload: { date, item: { ...item, scheduledTime: time ? time + ':00' : undefined } } })
    onClose()
  }
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()} style={{ minWidth: 300, maxWidth: 360 }}>
        <div className="modal-header">
          <h2>Horário Agendado</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-form">
          <div className="form-group">
            <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: 6, display: 'block' }}>
              {item.title}
            </label>
            <input ref={inputRef} type="time" step="1" value={time} onChange={e => setTime(e.target.value)} />
          </div>
        </div>
        <div className="modal-actions">
          <button className="btn-cancel" onClick={onClose}>Cancelar</button>
          <button className="btn-save" onClick={save}>Salvar</button>
        </div>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  selectedDate: string        // lifted to App.tsx — persists across tab navigation
  onDateChange: (date: string) => void
}

export default function DaySchedulePanel({ selectedDate, onDateChange }: Props) {
  const { state, dispatch, t, startScheduleFromNow, startScheduleFromItem, pauseSchedule, stopPlayback, generatePlaylistFromGrid } = useApp()
  const { dateSchedules, activeItemProgress } = state

  const todayStr  = today()   // local date, not UTC
  const isToday   = selectedDate === todayStr

  const schedule   = dateSchedules[selectedDate] ?? []
  const sorted     = [...schedule].sort((a, b) => a.order - b.order)
  const hasPending = schedule.some(i => i.status === 'pending')

  const selDow   = new Date(selectedDate + 'T12:00:00').getDay()
  const weekSlots = (state.weeklyGrid[selDow] ?? []).slice().sort((a, b) =>
    a.scheduledTime.localeCompare(b.scheduledTime)
  )
  const groups = buildGroups(sorted, weekSlots)

  // ── Context menu state ────────────────────────────────────────────────────
  const [ctxMenu, setCtxMenu]             = useState<CtxState | null>(null)
  const [vmixActionFor, setVmixActionFor] = useState<PlaylistItem | null>(null)
  const [vmixInputFor, setVmixInputFor]   = useState<PlaylistItem | null>(null)
  const [editTimeItem, setEditTimeItem]   = useState<PlaylistItem | null>(null)

  // ── Drag-and-drop state ───────────────────────────────────────────────────
  const [dragId, setDragId]     = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)

  const handleDragStart = (e: React.DragEvent, item: PlaylistItem) => {
    setDragId(item.id)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent, item: PlaylistItem) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (item.id !== dragId) setDragOverId(item.id)
  }

  const handleDrop = (e: React.DragEvent, targetItem: PlaylistItem) => {
    e.preventDefault()
    if (!dragId || dragId === targetItem.id) { setDragId(null); setDragOverId(null); return }
    const dragItem = sorted.find(i => i.id === dragId)
    if (!dragItem) { setDragId(null); setDragOverId(null); return }
    const without = sorted.filter(i => i.id !== dragId)
    const tIdx    = without.findIndex(i => i.id === targetItem.id)
    without.splice(tIdx, 0, dragItem)
    dispatch({
      type: 'REORDER_DATE_SCHEDULE',
      payload: { date: selectedDate, items: without.map((i, n) => ({ ...i, order: n + 1 })) },
    })
    setDragId(null)
    setDragOverId(null)
  }

  const handleDragEnd = () => { setDragId(null); setDragOverId(null) }

  const handleContextMenu = (e: React.MouseEvent, item: PlaylistItem) => {
    e.preventDefault()
    setCtxMenu({ x: e.clientX, y: e.clientY, item })
  }

  const insertAfterItem = (targetItem: PlaylistItem, fields: Omit<PlaylistItem, 'id' | 'order'>) => {
    const newItem: PlaylistItem = { id: crypto.randomUUID(), order: targetItem.order + 0.5, ...fields }
    const newSchedule = [...schedule, newItem]
      .sort((a, b) => a.order - b.order)
      .map((i, n) => ({ ...i, order: n + 1 }))
    dispatch({ type: 'REORDER_DATE_SCHEDULE', payload: { date: selectedDate, items: newSchedule } })
  }

  // ── Scroll ───────────────────────────────────────────────────────────────
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  const scrollToCard = useCallback((blockTime: string) => {
    const card = scrollContainerRef.current?.querySelector(`[data-block-time="${blockTime}"]`)
    card?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [])

  // Keep a ref to the latest groups so the auto-center effect can read them after DOM renders
  const groupsRef = useRef(groups)
  groupsRef.current = groups

  const handleCenterBlock = useCallback(() => {
    const nowHHMM = secsToHHMM(nowSeconds())
    const times = groupsRef.current.map(g => g.time)
    const target = times.filter(t => t <= nowHHMM).pop() ?? times[0]
    if (target) scrollToCard(target)
  }, [scrollToCard])

  // Auto-center on the current block when the panel mounts or the schedule loads
  useEffect(() => {
    if (!isToday || groups.length === 0) return
    const tid = setTimeout(handleCenterBlock, 200)
    return () => clearTimeout(tid)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isToday, groups.length === 0]) // run on mount and when schedule goes from empty → filled

  // Auto-scroll to the block containing the currently playing item
  const prevPlayingIdRef = useRef<string | null>(null)
  useEffect(() => {
    if (!state.isSequencePlaying) return
    const playing = schedule.find(i => i.status === 'playing')
    if (playing && playing.id !== prevPlayingIdRef.current) {
      prevPlayingIdRef.current = playing.id
      const blockTime = playing.scheduledTime?.slice(0, 5)
      if (blockTime) scrollToCard(blockTime)
    }
  }, [schedule, state.isSequencePlaying, scrollToCard])

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleReload = () => {
    if (isToday && state.isSequencePlaying) {
      if (!window.confirm('A programação está tocando. Atualizar vai adicionar os blocos faltantes. Continuar?')) return
    }
    // merge=true: preserves existing items, only adds missing schedule times
    generatePlaylistFromGrid(selectedDate as string, true)
  }

  const handleSkip     = (item: PlaylistItem) =>
    dispatch({ type: 'UPDATE_SCHEDULE_ITEM', payload: { date: selectedDate, item: { ...item, status: 'skipped' } } })
  const handleMarkDone = (item: PlaylistItem) =>
    dispatch({ type: 'UPDATE_SCHEDULE_ITEM', payload: { date: selectedDate, item: { ...item, status: 'done' } } })
  const handleDelete   = (id: string) => {
    if (window.confirm(t.common.confirmDelete))
      dispatch({ type: 'DELETE_SCHEDULE_ITEM', payload: { date: selectedDate, id } })
  }

  const handleBrowseFile = async (item: PlaylistItem) => {
    const fp = await window.spotmaster?.browseVideoFile()
    if (!fp) return
    const mt = detectMediaType(fp)
    const nameNoExt = fp.split(/[\\/]/).pop()?.replace(/\.[^.]+$/, '') ?? item.title
    let dur = item.duration
    if (mt !== 'image') {
      const detected = await readMediaDuration(fp, mt)
      if (detected != null) dur = detected
    }
    dispatch({
      type: 'UPDATE_SCHEDULE_ITEM',
      payload: { date: selectedDate, item: { ...item, title: nameNoExt, filePath: fp, mediaType: mt, duration: dur } },
    })
  }

  const handleInsertAfter = (item: PlaylistItem) => {
    const newItem: PlaylistItem = {
      id: crypto.randomUUID(), order: item.order + 0.5,
      title: item.title, type: item.type,
      status: 'pending', scheduledTime: item.scheduledTime, duration: 0,
    }
    const newSchedule = [...schedule, newItem]
      .sort((a, b) => a.order - b.order)
      .map((i, n) => ({ ...i, order: n + 1 }))
    dispatch({ type: 'REORDER_DATE_SCHEDULE', payload: { date: selectedDate, items: newSchedule } })
  }

  const handleInsertPause = (afterItem: PlaylistItem) => {
    insertAfterItem(afterItem, {
      title: 'Pausa',
      type: 'pause',
      status: 'pending',
      scheduledTime: afterItem.scheduledTime,
      duration: 0,
    })
  }

  const handleAddToGroup = (group: BlockGroup) => {
    const lastItem = group.items[group.items.length - 1]
    if (lastItem) {
      handleInsertAfter(lastItem)
    } else {
      const newItem: PlaylistItem = {
        id: crypto.randomUUID(),
        order: (sorted[sorted.length - 1]?.order ?? 0) + 1,
        title: group.slot?.title ?? `Musical ${group.time}`,
        type: 'vinheta', status: 'pending',
        scheduledTime: group.time + ':00', duration: 0,
      }
      const newSchedule = [...schedule, newItem].map((i, n) => ({ ...i, order: n + 1 }))
      dispatch({ type: 'REORDER_DATE_SCHEDULE', payload: { date: selectedDate, items: newSchedule } })
    }
  }

  const playingItem   = schedule.find(i => i.status === 'playing')
  const pendingItems  = sorted.filter(i => i.status === 'pending')
  const nextItem      = playingItem
    ? pendingItems.find(i => i.order > (playingItem.order ?? 0))
    : pendingItems[0]
  const totalDuration = schedule.reduce((a, i) => a + (i.duration ?? 0), 0)

  return (
    <div className="day-schedule-panel">
      {/* ── Header ── */}
      <div className="day-schedule-header">
        <div>
          <h2>{t.schedule.title}</h2>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
            {DAY_NAMES[selDow]}
            {isToday && <span style={{ marginLeft: 6, color: 'var(--accent)', fontWeight: 600 }}>— HOJE</span>}
          </span>
        </div>

        <div className="day-schedule-controls">
          {/* Date picker */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px' }}>
            <CalendarDays size={13} style={{ color: 'var(--text-secondary)' }} />
            <input
              type="date" value={selectedDate}
              onChange={e => onDateChange(e.target.value || todayStr)}
              style={{ background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: '0.82rem', cursor: 'pointer' }}
            />
          </div>

          {/* Center block — only when schedule has items */}
          {schedule.length > 0 && (
            <button className="day-schedule-btn" onClick={handleCenterBlock} title="Rolar para o bloco da hora atual">
              <Crosshair size={13} /> Centralizar Bloco
            </button>
          )}

          {/* Reload */}
          <button className="day-schedule-btn" onClick={handleReload} title="Recarregar programação desta data">
            <RefreshCw size={13} /> Atualizar
          </button>

          {/* Play / Stop — always visible for today; preview text for other dates */}
          {isToday ? (
            !state.isSequencePlaying ? (
              <button
                className="day-schedule-btn accent"
                onClick={startScheduleFromNow}
                disabled={!hasPending}
                title={hasPending ? 'Iniciar programação do bloco atual' : 'Nenhum item pendente'}
              >
                <ListVideo size={15} /> {t.schedule.playSchedule}
              </button>
            ) : (
              <button className="day-schedule-btn" onClick={stopPlayback} style={{ borderColor: 'var(--error)', color: 'var(--error)' }}>
                <Square size={13} /> {t.playlist.stopPlayback}
              </button>
            )
          ) : (
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
              Pré-visualização — play só para hoje
            </span>
          )}
        </div>
      </div>

      {/* ── Progress bar ── */}
      {isToday && activeItemProgress && state.isSequencePlaying && (
        <div className="day-progress-bar">
          <div
            className="day-progress-fill"
            style={{ width: `${Math.min(100, (activeItemProgress.position / activeItemProgress.duration) * 100)}%` }}
          />
          <span className="day-progress-label">
            {playingItem?.title ?? ''}
            {' — '}{formatDuration(Math.round(activeItemProgress.position / 1000))}
            {' / '}{formatDuration(Math.round(activeItemProgress.duration / 1000))}
            {nextItem && ` → ${nextItem.title}`}
          </span>
        </div>
      )}

      {/* ── Empty state ── */}
      {schedule.length === 0 ? (
        <div className="day-schedule-empty">
          <p>
            Nenhuma programação para {DAY_NAMES[selDow]},{' '}
            {new Date(selectedDate + 'T12:00:00').toLocaleDateString('pt-BR')}.
          </p>
          <button className="day-schedule-btn accent" onClick={handleReload}>
            <RefreshCw size={14} /> Gerar da Estrutura
          </button>
        </div>
      ) : (
        <>
          <div className="day-schedule-scroll" ref={scrollContainerRef}>
            {groups.map(group => {
              const cls          = cardClass(group)
              const isMusical    = cls === 'musical'
              const isCommercial = cls === 'commercial'
              const groupDone    = group.items.every(i => i.status === 'done' || i.status === 'skipped')
              const groupPlaying = group.items.some(i => i.status === 'playing')
              const doneCount    = group.items.filter(i => i.status === 'done' || i.status === 'skipped').length
              const groupDur     = group.items.reduce((s, i) => s + (i.duration ?? 0), 0)
              const statusLabel  = groupPlaying ? 'Ao vivo'
                : groupDone     ? 'Concluído'
                : group.items.length > 0 ? `${doneCount}/${group.items.length}`
                : 'Vazio'
              const CardIcon = isMusical ? Music : isCommercial ? DollarSign : Tv

              return (
                <div key={group.time} className={`block-card ${cls}`} data-block-time={group.time}>
                  {/* ── Card header ── */}
                  <div className="block-card-header">
                    <CardIcon size={14} />
                    <span className="block-card-time">{group.time}</span>
                    <span className="block-card-name">{group.slot?.title ?? group.time}</span>
                    {groupDur > 0 && <span className="block-card-meta">{formatDuration(groupDur)}</span>}
                    <span className="block-card-status">{statusLabel}</span>
                  </div>

                  {/* ── Items ── */}
                  <div className="block-items-list">
                    {group.items.map((item, idx) => {
                      const hasFile = !!item.filePath || !!item.inputName
                      const isDragging  = dragId === item.id
                      const isDragOver  = dragOverId === item.id && dragId !== item.id
                      const rowCls      = [
                        'block-item-row',
                        item.status === 'playing' ? 'playing'  : '',
                        item.status === 'done'    ? 'done'     : '',
                        item.status === 'skipped' ? 'skipped'  : '',
                        isDragging  ? 'dragging'   : '',
                        isDragOver  ? 'drag-over'  : '',
                      ].filter(Boolean).join(' ')

                      return (
                        <div
                          key={item.id}
                          className={rowCls}
                          data-row-id={item.id}
                          draggable
                          onDragStart={e => handleDragStart(e, item)}
                          onDragOver={e => handleDragOver(e, item)}
                          onDrop={e => handleDrop(e, item)}
                          onDragEnd={handleDragEnd}
                          onDragLeave={() => setDragOverId(null)}
                          onContextMenu={e => handleContextMenu(e, item)}
                        >
                          {/* Drag handle */}
                          <span className="block-item-drag-handle" title="Arrastar para reordenar">
                            <GripVertical size={12} />
                          </span>

                          <span className="block-item-num">{idx + 1}</span>

                          <span className={`block-item-title${item.type === 'pause' ? ' pause-marker' : !hasFile && item.type !== 'vmix_action' ? ' empty' : ''}`}>
                            {item.type === 'pause'
                              ? '⏸ Pausa automática'
                              : item.type === 'vmix_action'
                              ? `⚡ ${item.vmixAction?.function ?? item.title}`
                              : hasFile ? item.title
                              : '— sem arquivo —'}
                          </span>

                          {item.status === 'playing' && activeItemProgress && isToday && (
                            <div className="block-item-inline-progress">
                              <div
                                className="block-item-inline-progress-fill"
                                style={{ width: `${Math.min(100, (activeItemProgress.position / activeItemProgress.duration) * 100)}%` }}
                              />
                            </div>
                          )}

                          <span className="block-item-dur">
                            {item.duration > 0 ? formatDuration(item.duration) : '—'}
                          </span>

                          <div className="block-item-actions">
                            {!hasFile && item.type !== 'vmix_action' && item.type !== 'pause' && (
                              <button className="block-item-btn green" onClick={() => handleBrowseFile(item)} title="Adicionar arquivo">
                                <FolderOpen size={12} />
                              </button>
                            )}
                            {isMusical && (
                              <button className="block-item-btn" onClick={() => handleInsertAfter(item)} title="Inserir música após">
                                <Plus size={12} />
                              </button>
                            )}
                            {item.status === 'pending' && (
                              <button className="block-item-btn" onClick={() => handleSkip(item)} title="Pular">
                                <SkipForward size={12} />
                              </button>
                            )}
                            <button className="block-item-btn" onClick={() => handleMarkDone(item)} title="Marcar como veiculado">
                              <CheckCircle size={12} />
                            </button>
                            <button className="block-item-btn danger" onClick={() => handleDelete(item.id)} title="Remover">
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {isMusical && (
                    <button className="block-add-btn" onClick={() => handleAddToGroup(group)}>
                      <Plus size={12} /> Adicionar música
                    </button>
                  )}
                </div>
              )
            })}
          </div>

          <div className="day-schedule-footer">
            <span>{schedule.length} itens · {groups.length} blocos</span>
            <span>Total: {formatDuration(totalDuration)}</span>
          </div>
        </>
      )}

      {/* ── Context menu ── */}
      {ctxMenu && (
        <ScheduleCtxMenu
          menu={ctxMenu}
          onClose={() => setCtxMenu(null)}
          isPlaying={state.isSequencePlaying}
          isToday={isToday}
          onStartFromHere={() => { startScheduleFromItem(ctxMenu.item.id); setCtxMenu(null) }}
          onPause={() => { pauseSchedule(); setCtxMenu(null) }}
          onVmixAction={() => { setVmixActionFor(ctxMenu.item); setCtxMenu(null) }}
          onVmixInput={() => { setVmixInputFor(ctxMenu.item); setCtxMenu(null) }}
          onInsertPause={() => { handleInsertPause(ctxMenu.item); setCtxMenu(null) }}
          onDuplicate={() => { insertAfterItem(ctxMenu.item, { ...ctxMenu.item, status: 'pending' }); setCtxMenu(null) }}
          onSkip={() => { handleSkip(ctxMenu.item); setCtxMenu(null) }}
          onMarkDone={() => { handleMarkDone(ctxMenu.item); setCtxMenu(null) }}
          onEditTime={() => { setEditTimeItem(ctxMenu.item); setCtxMenu(null) }}
        />
      )}

      {/* ── vMix Action modal ── */}
      {vmixActionFor && (
        <VmixActionModal
          onInsert={action => insertAfterItem(vmixActionFor, {
            title: action.function, type: 'vmix_action', status: 'pending',
            scheduledTime: vmixActionFor.scheduledTime, duration: 0, vmixAction: action,
          })}
          onClose={() => setVmixActionFor(null)}
        />
      )}

      {/* ── vMix Input modal ── */}
      {vmixInputFor && (
        <VmixInputModal
          onInsert={(name, dur) => insertAfterItem(vmixInputFor, {
            title: name, type: 'vinheta', status: 'pending',
            scheduledTime: vmixInputFor.scheduledTime, duration: dur, inputName: name,
          })}
          onClose={() => setVmixInputFor(null)}
        />
      )}

      {/* ── Edit time modal ── */}
      {editTimeItem && (
        <ScheduleTimeEditModal
          item={editTimeItem}
          date={selectedDate}
          onClose={() => setEditTimeItem(null)}
        />
      )}
    </div>
  )
}
