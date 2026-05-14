import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import {
  Activity, AlertTriangle, ShieldCheck, Square, ListVideo, SkipForward, StopCircle, CheckCircle,
  Trash2, RefreshCw, CalendarDays,
  FolderOpen, Plus, Crosshair, Music, DollarSign, Tv,
  Zap, MonitorPlay, Clock, Copy, Clipboard, Play, Pause, GripVertical,
} from 'lucide-react'
import { useApp } from '../../store/AppContext'
import { usePlaybackProgress } from '../../store/playbackProgress'
import type { PlaylistItem, ProgramSlot, VmixActionItem, VmixCommandLog, VmixInput, VmixStatus } from '../../types'
import { formatDuration, today } from '../../utils/time'
import { runSchedulePreflight, type PreflightSeverity, type PreflightSummary } from '../../utils/preflight'
import {
  detectMediaType,
  mediaDurationCacheKey,
  readMediaDuration,
  readMediaDurationBatch,
} from '../../utils/mediaDuration'
import { spotTypeForVmix } from '../../utils/vmixInputs'
import VmixInputPanel from '../Playlist/VmixInputPanel'
import Badge from '../ui/Badge'
import Button from '../ui/Button'
import { Field, FieldRow } from '../ui/Field'
import Modal from '../ui/Modal'
import './DaySchedulePanel.css'
import '../Playlist/ContextMenu.css'

const VMIX_FUNCTIONS = [
  'AudioOff','AudioOn','SetVolume','Fade',
  'OverlayInput1','OverlayInput1Out','OverlayInput2','OverlayInput2Out',
  'StartRecording','StopRecording','Cut','Merge',
]

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

type AddGroupModalState = {
  group: BlockGroup
  mode: 'picker' | 'vmix_action' | 'vmix_input'
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

function ScheduleCtxMenu({ menu, onClose, onStartFromHere, onPause, onVmixAction, onVmixInput, onInsertPause, onDuplicate, onSkip, onMarkDone, onEditTime, onCopy, onPaste, canPaste, isPlaying, isToday }: {
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
  onCopy: () => void
  onPaste: () => void
  canPaste: boolean
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
  }, [])

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
      <button className="ctx-item" onClick={() => run(onCopy)}>
        <Copy size={13} /><span>Copiar item</span>
      </button>
      {canPaste && (
        <button className="ctx-item" onClick={() => run(onPaste)}>
          <Clipboard size={13} /><span>Colar abaixo</span>
        </button>
      )}

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
    <Modal
      title="Inserir Ação vMix"
      onClose={onClose}
      maxWidth={460}
      actions={
        <>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button
            variant="purple"
            onClick={() => {
              onInsert({ function: fn, input: input || undefined, value: value || undefined })
              onClose()
            }}
          >
            Adicionar
          </Button>
        </>
      }
    >
      <div className="ui-field-hint">Use isso para inserir comandos rápidos do vMix sem sair da programação.</div>
      <Field label="Função vMix">
        <select className="ui-select" value={fn} onChange={e => setFn(e.target.value)}>
          {VMIX_FUNCTIONS.map(f => <option key={f} value={f}>{f}</option>)}
        </select>
      </Field>
      <FieldRow>
        <Field label="Input (opcional)" className="settings-grow-2">
          <input ref={inputRef} className="ui-input" value={input} onChange={e => setInput(e.target.value)} placeholder="ex: Camera1" />
        </Field>
        <Field label="Valor">
          <input className="ui-input" value={value} onChange={e => setValue(e.target.value)} placeholder="ex: 100" />
        </Field>
      </FieldRow>
      <div className="ui-card-note day-insert-preview">
        <strong>Prévia:</strong> {fn}
        {input ? ` · Input "${input}"` : ''}
        {value ? ` · Value "${value}"` : ''}
      </div>
    </Modal>
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
    <Modal
      title="Inserir Input vMix"
      onClose={onClose}
      maxWidth={440}
      actions={
        <>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" disabled={!inputName.trim()} onClick={() => { onInsert(inputName, duration); onClose() }}>
            Adicionar
          </Button>
        </>
      }
    >
      <div className="ui-field-hint">Ideal para câmera, NDI, grafismo ou qualquer input já existente no vMix.</div>
      <FieldRow>
        <Field label="Nome ou nº do input" className="settings-grow-2">
          <input ref={inputRef} className="ui-input" value={inputName} onChange={e => setInputName(e.target.value)} placeholder="ex: Camera1" />
        </Field>
        <Field label="Duração (s)">
          <input
            className="ui-input"
            type="number"
            value={duration}
            min={1}
            onChange={e => setDuration(Math.max(1, parseInt(e.target.value) || 10))}
          />
        </Field>
      </FieldRow>
    </Modal>
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
    <Modal
      title="Horário Agendado"
      onClose={onClose}
      maxWidth={380}
      actions={
        <>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" onClick={save}>Salvar</Button>
        </>
      }
    >
      <div className="ui-field-hint">{item.title}</div>
      <Field label="Horário">
        <input ref={inputRef} className="ui-input" type="time" step="1" value={time} onChange={e => setTime(e.target.value)} />
      </Field>
    </Modal>
  )
}

// ── Add Item Picker Modal ─────────────────────────────────────────────────────

function AddItemModal({ groupTime, onClose, onFile, onVmixAction, onVmixInput }: {
  groupTime: string
  onClose: () => void
  onFile: () => void
  onVmixAction: () => void
  onVmixInput: () => void
}) {
  const ref = useRef<HTMLButtonElement>(null)
  useEffect(() => { ref.current?.focus() }, [])
  return (
    <Modal title={`Adicionar ao bloco ${groupTime}`} onClose={onClose} maxWidth={430}>
      <div className="ui-field-hint">
        Escolha o tipo de item que você quer inserir. O novo item entra no bloco selecionado sem quebrar a ordem da programação.
      </div>
      <div className="day-add-choice-list">
        <button ref={ref} className="day-add-choice-card" onClick={() => { onClose(); onFile() }}>
          <div className="day-add-choice-icon">
            <FolderOpen size={18} />
          </div>
          <div className="day-add-choice-copy">
            <strong>Arquivo de mídia</strong>
            <span>Vídeo, áudio ou imagem do disco</span>
          </div>
          <Badge>Mais comum</Badge>
        </button>
        <button className="day-add-choice-card day-add-choice-card--purple" onClick={() => { onClose(); onVmixAction() }}>
          <div className="day-add-choice-icon">
            <Zap size={18} />
          </div>
          <div className="day-add-choice-copy">
            <strong>Ação vMix</strong>
            <span>Corte, fade, volume, overlay e comandos rápidos</span>
          </div>
        </button>
        <button className="day-add-choice-card" onClick={() => { onClose(); onVmixInput() }}>
          <div className="day-add-choice-icon">
            <MonitorPlay size={18} />
          </div>
          <div className="day-add-choice-copy">
            <strong>Input vMix</strong>
            <span>Câmera, NDI, grafismo ou input já existente</span>
          </div>
        </button>
      </div>
    </Modal>
  )
}

// ── Block Picker Modal ────────────────────────────────────────────────────────

function BlockPickerModal({ groups, onClose, onPick }: {
  groups: BlockGroup[]
  onClose: () => void
  onPick: (group: BlockGroup) => void
}) {
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', key)
    return () => document.removeEventListener('keydown', key)
  }, [onClose])
  return (
    <Modal title="Escolher bloco" onClose={onClose} maxWidth={440} bodyStyle={{ maxHeight: 420, overflowY: 'auto' }}>
      <div className="ui-field-hint">Selecione em qual bloco você quer inserir o novo item.</div>
      <div className="day-block-picker-list">
        {groups.map(g => (
          <button key={g.time} className="day-block-picker-card" onClick={() => { onClose(); onPick(g) }}>
            <div className="day-block-picker-main">
              <div className="day-block-picker-time">
                <Clock size={15} />
                <span>{g.time}</span>
              </div>
              <strong>{g.slot?.title ?? `Bloco ${g.time}`}</strong>
            </div>
            <Badge>{g.items.length} {g.items.length === 1 ? 'item' : 'itens'}</Badge>
          </button>
        ))}
      </div>
    </Modal>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

type PreflightMode = 'manual' | 'start'

const PREFLIGHT_LABEL: Record<PreflightSeverity, string> = {
  error: 'Erro',
  warning: 'Aviso',
  info: 'Info',
}

function PreflightModal({ summary, mode, onClose, onStartAnyway }: {
  summary: PreflightSummary
  mode: PreflightMode
  onClose: () => void
  onStartAnyway: () => void
}) {
  const hasErrors = summary.errorCount > 0
  const hasWarnings = summary.warningCount > 0
  const title = hasErrors
    ? 'Preflight com bloqueios'
    : hasWarnings
      ? 'Preflight com avisos'
      : 'Preflight aprovado'

  return (
    <Modal
      title={title}
      onClose={onClose}
      maxWidth={720}
      bodyStyle={{ maxHeight: 520, overflowY: 'auto' }}
      actions={
        <>
          <Button variant="ghost" onClick={onClose}>Fechar</Button>
          {mode === 'start' && !hasErrors && hasWarnings && (
            <Button variant="warning" onClick={onStartAnyway}>Iniciar com avisos</Button>
          )}
        </>
      }
    >
      <div className="preflight-summary-strip">
        <div className="preflight-summary-cell error">
          <strong>{summary.errorCount}</strong>
          <span>erros</span>
        </div>
        <div className="preflight-summary-cell warning">
          <strong>{summary.warningCount}</strong>
          <span>avisos</span>
        </div>
        <div className="preflight-summary-cell info">
          <strong>{summary.infoCount}</strong>
          <span>infos</span>
        </div>
      </div>

      {summary.issues.length === 0 ? (
        <div className="preflight-empty">
          <ShieldCheck size={26} />
          <div>
            <strong>Nenhum problema encontrado</strong>
            <span>Arquivos, inputs e estrutura basica passaram na validacao.</span>
          </div>
        </div>
      ) : (
        <div className="preflight-issue-list">
          {summary.issues.map(issue => (
            <div key={issue.id} className={`preflight-issue ${issue.severity}`}>
              <div className="preflight-issue-icon">
                {issue.severity === 'info' ? <ShieldCheck size={16} /> : <AlertTriangle size={16} />}
              </div>
              <div className="preflight-issue-copy">
                <div className="preflight-issue-title">
                  <span>{PREFLIGHT_LABEL[issue.severity]}</span>
                  <strong>{issue.title}</strong>
                  {issue.time && <em>{issue.time}</em>}
                </div>
                <p>{issue.detail}</p>
                {issue.action && <small>{issue.action}</small>}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="preflight-checked-at">
        Validado as {new Date(summary.checkedAt).toLocaleTimeString('pt-BR')}
      </div>
    </Modal>
  )
}

function VmixHealthModal({ status, logs, referenceTime, onClose }: {
  status: VmixStatus
  logs: VmixCommandLog[]
  referenceTime: number
  onClose: () => void
}) {
  const recentLogs = logs.slice(-25).reverse()
  const tenMinutesAgo = referenceTime - 10 * 60 * 1000
  const recentWindow = logs.filter(log => Date.parse(log.at) >= tenMinutesAgo)
  const failedRecent = recentWindow.filter(log => !log.success).length
  const successfulRecent = recentWindow.filter(log => log.success)
  const avgLatency = successfulRecent.length
    ? Math.round(successfulRecent.reduce((sum, log) => sum + log.latencyMs, 0) / successfulRecent.length)
    : 0

  return (
    <Modal
      title="Saude vMix"
      onClose={onClose}
      maxWidth={760}
      bodyStyle={{ maxHeight: 560, overflowY: 'auto' }}
      actions={<Button variant="primary" onClick={onClose}>Fechar</Button>}
    >
      <div className="vmix-health-grid">
        <div className={`vmix-health-tile ${status.connected ? 'ok' : 'bad'}`}>
          <span>Conexao</span>
          <strong>{status.connected ? 'Conectado' : 'Offline'}</strong>
          <small>{status.error || `${status.version ?? 'vMix'} ${status.edition ?? ''}`.trim()}</small>
        </div>
        <div className="vmix-health-tile">
          <span>Inputs</span>
          <strong>{status.inputs?.length ?? 0}</strong>
          <small>lidos do XML atual</small>
        </div>
        <div className="vmix-health-tile">
          <span>Ultimos 10 min</span>
          <strong>{recentWindow.length}</strong>
          <small>{failedRecent} falha(s), {avgLatency} ms medio</small>
        </div>
        <div className="vmix-health-tile">
          <span>Estado</span>
          <strong>{status.recording ? 'REC' : status.streaming ? 'STREAM' : status.external ? 'EXT' : 'Idle'}</strong>
          <small>recording, streaming ou external</small>
        </div>
      </div>

      <div className="vmix-command-log">
        <div className="vmix-command-log-head">
          <strong>Comandos recentes</strong>
          <span>{logs.length} armazenados</span>
        </div>
        {recentLogs.length === 0 ? (
          <div className="vmix-command-empty">Nenhum comando vMix registrado ainda.</div>
        ) : (
          recentLogs.map(log => (
            <div key={log.id} className={`vmix-command-row ${log.success ? 'ok' : 'bad'}`}>
              <span className="vmix-command-time">{new Date(log.at).toLocaleTimeString('pt-BR')}</span>
              <strong>{log.functionName}</strong>
              <span>{log.params.Input ? `Input ${log.params.Input}` : log.params.Value ? `Value ${log.params.Value}` : ''}</span>
              <em>{log.success ? `${log.latencyMs} ms` : log.error ?? 'falha'}</em>
            </div>
          ))
        )}
      </div>
    </Modal>
  )
}

interface Props {
  selectedDate: string        // lifted to App.tsx — persists across tab navigation
  onDateChange: (date: string) => void
}

export default function DaySchedulePanel({ selectedDate, onDateChange }: Props) {
  const { state, dispatch, t, startScheduleFromNow, startScheduleFromItem, pauseSchedule, stopPlayback, generatePlaylistFromGrid, skipToNext, setStopAfterCurrent } = useApp()
  const { dateSchedules } = state
  const activeItemProgress = usePlaybackProgress()

  const todayStr  = today()   // local date, not UTC
  const isToday   = selectedDate === todayStr

  const schedule = useMemo(
    () => dateSchedules[selectedDate] ?? [],
    [dateSchedules, selectedDate]
  )
  const sorted = useMemo(
    () => [...schedule].sort((a, b) => a.order - b.order),
    [schedule]
  )
  const hasPending = schedule.some(i => i.status === 'pending')

  // ── Auto-read duration for items loaded without metadata (e.g. AutoProg) ────
  const durationReadIds = useRef<Set<string>>(new Set())
  // Incrementado após falhas para forçar o useEffect a re-disparar e tentar novamente
  const [durationRetryTick, setDurationRetryTick] = useState(0)
  // Reset when date changes so items on a fresh date get their durations read
  useEffect(() => { durationReadIds.current.clear() }, [selectedDate])
  useEffect(() => {
    // IMPORTANTE: não usar flag 'active' para bloquear o .then() inteiro.
    // Quando áudios (rápidos) terminam e disparam dispatch, o useEffect é
    // re-executado e 'active' passa a false. Isso impedia que vídeos lentos
    // (que completam/timeout depois) removessem seus IDs do durationReadIds,
    // deixando-os presos para sempre e causando 'nada acontece' na próxima
    // geração de playlist (IDs presos → toRead vazio).
    let mounted = true  // usado APENAS para evitar setState em componente desmontado
    const toRead = schedule.filter(
      i => i.filePath && (i.duration === 0 || i.duration == null)
        && i.status !== 'playing'
        && !durationReadIds.current.has(i.id),
    )
    if (toRead.length === 0) return
    toRead.forEach(i => durationReadIds.current.add(i.id))
    const succeededIds = new Set<string>()
    const cacheUpdates: Record<string, number> = {}
    readMediaDurationBatch(
      toRead,
      (item, dur) => {
        succeededIds.add(item.id)
        if (item.filePath) cacheUpdates[mediaDurationCacheKey(item.filePath)] = dur
        dispatch({
          type: 'UPDATE_SCHEDULE_ITEM',
          payload: { date: selectedDate, item: { ...item, duration: dur } },
        })
      },
      // 15 s: vídeos grandes (DVD/concerto) precisam de mais tempo para o Chromium
      // localizar o moov atom via local-media://
      { concurrency: 4, timeoutMs: 15_000 },
    ).then(() => {
      // Limpeza de IDs falhos SEMPRE executa (independente de mounted).
      // Sem isso, IDs de vídeos que deram timeout ficam presos no set e
      // nunca são re-tentados — inclusive após regerar a playlist em merge mode.
      let hadFailures = false
      for (const item of toRead) {
        if (!succeededIds.has(item.id)) {
          durationReadIds.current.delete(item.id)
          hadFailures = true
        }
      }
      // setDurationRetryTick muda estado → só chamar se ainda montado
      if (hadFailures && mounted) setTimeout(() => setDurationRetryTick(t => t + 1), 5_000)
      if (Object.keys(cacheUpdates).length > 0) {
        dispatch({ type: 'UPSERT_MEDIA_DURATIONS', payload: cacheUpdates })
      }
    })
    return () => { mounted = false }
  }, [schedule, selectedDate, dispatch, durationRetryTick])

  const selDow   = new Date(selectedDate + 'T12:00:00').getDay()
  const weekSlots = useMemo(
    () => (state.weeklyGrid[selDow] ?? []).slice().sort((a, b) =>
      a.scheduledTime.localeCompare(b.scheduledTime)
    ),
    [state.weeklyGrid, selDow]
  )
  const groups = useMemo(
    () => buildGroups(sorted, weekSlots),
    [sorted, weekSlots]
  )

  // ── Context menu state ────────────────────────────────────────────────────
  const [ctxMenu, setCtxMenu]             = useState<CtxState | null>(null)
  const [vmixActionFor, setVmixActionFor] = useState<PlaylistItem | null>(null)
  const [vmixInputFor, setVmixInputFor]   = useState<PlaylistItem | null>(null)
  const [editTimeItem, setEditTimeItem]   = useState<PlaylistItem | null>(null)

  // ── Selection & add-item state ────────────────────────────────────────────
  const [selectedItemId, setSelectedItemId]   = useState<string | null>(null)
  const [showVmixPanel, setShowVmixPanel]     = useState(false)
  const [addGroupModal, setAddGroupModal]     = useState<AddGroupModalState | null>(null)
  const [copiedItem, setCopiedItem]           = useState<PlaylistItem | null>(null)
  const [showBlockPicker, setShowBlockPicker] = useState(false)
  const [nextCrossfadeActive, setNextCrossfadeActive] = useState(false)
  const [stopAfterArmed, setStopAfterArmed] = useState(false)
  const [readingDurations, setReadingDurations] = useState(false)
  const [updatingSchedule, setUpdatingSchedule] = useState(false)
  const [updateProgress, setUpdateProgress] = useState<{ done: number; total: number } | null>(null)
  const [updateError, setUpdateError] = useState<string | null>(null)
  const [preflightRunning, setPreflightRunning] = useState(false)
  const [preflightMode, setPreflightMode] = useState<PreflightMode>('manual')
  const [preflightSummary, setPreflightSummary] = useState<PreflightSummary | null>(null)
  const [showVmixHealth, setShowVmixHealth] = useState(false)
  const [vmixHealthReferenceTime, setVmixHealthReferenceTime] = useState(0)

  // Itens com arquivo mas sem duração lida — para mostrar/ocultar botão
  const missingDurCount = useMemo(
    () => schedule.filter(i => i.filePath && (i.duration === 0 || i.duration == null)).length,
    [schedule],
  )

  // Reset Stop Next when playback stops
  useEffect(() => {
    if (!state.isSequencePlaying) queueMicrotask(() => setStopAfterArmed(false))
  }, [state.isSequencePlaying])

  // ── Drag-and-drop state ───────────────────────────────────────────────────
  const [dragId, setDragId]     = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)

  const handleDragStart = (e: React.DragEvent, item: PlaylistItem) => {
    setDragId(item.id)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent, item: PlaylistItem) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = e.dataTransfer.types.includes('application/vmix-input') ? 'copy' : 'move'
    if (item.id !== dragId) setDragOverId(item.id)
  }

  const handleDrop = (e: React.DragEvent, targetItem: PlaylistItem) => {
    e.preventDefault()
    // vMix input drop from the side panel
    const vmixRaw = e.dataTransfer.getData('application/vmix-input')
    if (vmixRaw) {
      try {
        const inp = JSON.parse(vmixRaw) as VmixInput
        const newItem: PlaylistItem = {
          id: crypto.randomUUID(),
          order: targetItem.order - 0.5,
          title: inp.title || `Input ${inp.number}`,
          type: spotTypeForVmix(inp.type),
          duration: inp.duration > 0 ? Math.round(inp.duration / 1000) : 30,
          status: 'pending',
          scheduledTime: targetItem.scheduledTime,
          inputName: inp.number,
          manuallyAdded: true,
        }
        const newSchedule = [...schedule, newItem]
          .sort((a, b) => a.order - b.order)
          .map((i, n) => ({ ...i, order: n + 1 }))
        dispatch({ type: 'REORDER_DATE_SCHEDULE', payload: { date: selectedDate, items: newSchedule } })
      } catch { /* ignore bad JSON */ }
      setDragId(null)
      setDragOverId(null)
      return
    }
    // Internal reorder
    if (!dragId || dragId === targetItem.id) { setDragId(null); setDragOverId(null); return }
    const dragItem = sorted.find(i => i.id === dragId)
    if (!dragItem) { setDragId(null); setDragOverId(null); return }
    // When dropped on a different block, update scheduledTime to match the target block
    const movedItem = dragItem.scheduledTime?.slice(0, 5) !== targetItem.scheduledTime?.slice(0, 5)
      ? { ...dragItem, scheduledTime: targetItem.scheduledTime, adBreakId: targetItem.adBreakId }
      : dragItem
    const without = sorted.filter(i => i.id !== dragId)
    const tIdx    = without.findIndex(i => i.id === targetItem.id)
    without.splice(tIdx, 0, movedItem)
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
    const newItem: PlaylistItem = { id: crypto.randomUUID(), order: targetItem.order + 0.5, manuallyAdded: true, ...fields }
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
  useEffect(() => {
    groupsRef.current = groups
  }, [groups])

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
  const runPreflight = useCallback(async (mode: PreflightMode = 'manual') => {
    if (preflightRunning) return null
    setPreflightRunning(true)
    setPreflightMode(mode)
    try {
      const summary = await runSchedulePreflight({
        date: selectedDate,
        schedule: sorted,
        weekSlots,
        commercialBlocks: state.commercialBlocks,
        clientSpots: state.clientSpots,
        vmixStatus: state.vmixStatus,
        settings: state.settings,
        fileExists: window.spotmaster?.fileExists
          ? paths => window.spotmaster.fileExists(paths)
          : undefined,
      })
      setPreflightSummary(summary)
      return summary
    } finally {
      setPreflightRunning(false)
    }
  }, [
    preflightRunning,
    selectedDate,
    sorted,
    weekSlots,
    state.commercialBlocks,
    state.clientSpots,
    state.vmixStatus,
    state.settings,
  ])

  const handleStartScheduleWithPreflight = useCallback(async () => {
    const summary = await runPreflight('start')
    if (!summary) return
    if (summary.errorCount === 0 && summary.warningCount === 0) {
      setPreflightSummary(null)
      startScheduleFromNow()
    }
  }, [runPreflight, startScheduleFromNow])

  const handleStartAfterPreflightWarning = useCallback(() => {
    setPreflightSummary(null)
    startScheduleFromNow()
  }, [startScheduleFromNow])

  const handleReload = async () => {
    if (updatingSchedule) return
    if (isToday && state.isSequencePlaying) {
      if (!window.confirm('A programação está tocando. Atualizar vai adicionar os blocos faltantes. Continuar?')) return
    }
    // merge=true: preserves existing items, only adds missing schedule times
    setUpdatingSchedule(true)
    setUpdateProgress(null)
    setUpdateError(null)
    try {
      await generatePlaylistFromGrid(selectedDate as string, true, (done, total) => {
        setUpdateProgress({ done, total })
      })
    } catch (err) {
      console.error('[DaySchedule] Falha ao atualizar programação:', err)
      setUpdateError('Não foi possível atualizar a programação.')
    } finally {
      setUpdatingSchedule(false)
      setUpdateProgress(null)
    }
  }

  // Lê (ou re-lê) as durações de todos os itens que ainda estão com 0.
  // Chamado pelo botão manual — útil quando a leitura automática falhou
  // (ex: vídeos lentos que deram timeout no batch inicial).
  const handleRefreshDurations = useCallback(async () => {
    const toRefresh = schedule.filter(
      i => i.filePath && (i.duration === 0 || i.duration == null),
    )
    if (toRefresh.length === 0 || readingDurations) return
    // Marca no set para o useEffect não processar os mesmos itens ao mesmo tempo
    toRefresh.forEach(i => durationReadIds.current.add(i.id))
    setReadingDurations(true)
    const succeededIds = new Set<string>()
    const cacheUpdates: Record<string, number> = {}
    try {
      await readMediaDurationBatch(
        toRefresh,
        (item, dur) => {
          succeededIds.add(item.id)
          if (item.filePath) cacheUpdates[mediaDurationCacheKey(item.filePath)] = dur
          dispatch({
            type: 'UPDATE_SCHEDULE_ITEM',
            payload: { date: selectedDate, item: { ...item, duration: dur } },
          })
        },
        { concurrency: 2, timeoutMs: 20_000 },  // 2 simultâneos, 20 s cada
      )
    } finally {
      // Libera itens que falharam para eventual re-tentativa posterior
      for (const item of toRefresh) {
        if (!succeededIds.has(item.id)) durationReadIds.current.delete(item.id)
      }
      if (Object.keys(cacheUpdates).length > 0) {
        dispatch({ type: 'UPSERT_MEDIA_DURATIONS', payload: cacheUpdates })
      }
      setReadingDurations(false)
    }
  }, [schedule, selectedDate, dispatch, readingDurations])

  const handleSkip     = (item: PlaylistItem) =>
    dispatch({ type: 'UPDATE_SCHEDULE_ITEM', payload: { date: selectedDate, item: { ...item, status: 'skipped' } } })
  const handleMarkDone = (item: PlaylistItem) =>
    dispatch({ type: 'UPDATE_SCHEDULE_ITEM', payload: { date: selectedDate, item: { ...item, status: 'done' } } })
  const handleDelete   = async (id: string) => {
    if (!window.confirm(t.common.confirmDelete)) return
    await window.spotmaster?.createBackup?.('before-schedule-delete').catch(() => {})
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
      if (detected != null) {
        dur = detected
        dispatch({ type: 'UPSERT_MEDIA_DURATIONS', payload: { [mediaDurationCacheKey(fp)]: detected } })
      }
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
      manuallyAdded: true,
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

  // ── Insert item at end of a group ─────────────────────────────────────────
  const insertItemAtGroupEnd = (group: BlockGroup, fields: Omit<PlaylistItem, 'id' | 'order'>) => {
    const groupSorted = [...group.items].sort((a, b) => a.order - b.order)
    const lastItem = groupSorted[groupSorted.length - 1]
    const newItem: PlaylistItem = {
      manuallyAdded: true,
      ...fields,
      id: crypto.randomUUID(),
      order: lastItem ? lastItem.order + 0.5 : (sorted[sorted.length - 1]?.order ?? 0) + 1,
      scheduledTime: fields.scheduledTime ?? (group.time + ':00'),
    }
    const newSchedule = [...schedule, newItem]
      .sort((a, b) => a.order - b.order)
      .map((i, n) => ({ ...i, order: n + 1 }))
    dispatch({ type: 'REORDER_DATE_SCHEDULE', payload: { date: selectedDate, items: newSchedule } })
  }

  // ── Add file to a group via file browser ──────────────────────────────────
  const handleAddItemFile = async (group: BlockGroup) => {
    const fp = await window.spotmaster?.browseVideoFile()
    if (!fp) return
    const mt = detectMediaType(fp)
    const nameNoExt = fp.split(/[\\/]/).pop()?.replace(/\.[^.]+$/, '') ?? 'Arquivo'
    let dur = 0
    if (mt !== 'image') {
      const detected = await readMediaDuration(fp, mt)
      if (detected != null) {
        dur = detected
        dispatch({ type: 'UPSERT_MEDIA_DURATIONS', payload: { [mediaDurationCacheKey(fp)]: detected } })
      }
    }
    insertItemAtGroupEnd(group, {
      title: nameNoExt,
      type: mt === 'audio' ? 'spot' : 'vinheta',
      status: 'pending',
      scheduledTime: group.time + ':00',
      duration: dur,
      filePath: fp,
      mediaType: mt,
    })
  }

  // ── Toolbar: add item to selected block ───────────────────────────────────
  const handleAddItemFromToolbar = () => {
    const selItem = selectedItemId ? schedule.find(i => i.id === selectedItemId) : null
    const selGroupTime = selItem?.scheduledTime?.slice(0, 5)
    const targetGroup = selGroupTime ? groups.find(g => g.time === selGroupTime) : null
    if (targetGroup) setAddGroupModal({ group: targetGroup, mode: 'picker' })
    else setShowBlockPicker(true)
  }

  const handleAddToGroup = (group: BlockGroup) => {
    setAddGroupModal({ group, mode: 'picker' })
  }

  const playingItem = useMemo(() => schedule.find(i => i.status === 'playing'), [schedule])
  const pendingItems = useMemo(() => sorted.filter(i => i.status === 'pending'), [sorted])
  const nextItem = useMemo(
    () => playingItem ? pendingItems.find(i => i.order > (playingItem.order ?? 0)) : pendingItems[0],
    [playingItem, pendingItems],
  )
  const { totalDuration, completedCount, errorCount } = useMemo(() => {
    let total = 0, done = 0, err = 0
    for (const i of schedule) {
      total += i.duration ?? 0
      if (i.status === 'done' || i.status === 'skipped') done++
      else if (i.status === 'error') err++
    }
    return { totalDuration: total, completedCount: done, errorCount: err }
  }, [schedule])
  const scheduleDateLabel = useMemo(
    () => new Date(selectedDate + 'T12:00:00').toLocaleDateString('pt-BR'),
    [selectedDate],
  )
  const nowHHMM = secsToHHMM(nowSeconds())
  const currentBlock = useMemo(() => {
    if (playingItem) return groups.find(g => g.items.some(i => i.id === playingItem.id)) ?? null
    if (isToday) return groups.filter(g => g.time <= nowHHMM).pop() ?? groups[0] ?? null
    return groups[0] ?? null
  }, [playingItem, groups, isToday, nowHHMM])
  const nextBlock = useMemo(() => {
    if (nextItem) return groups.find(g => g.items.some(i => i.id === nextItem.id)) ?? null
    if (currentBlock) return groups.find(g => g.time > currentBlock.time) ?? null
    return null
  }, [nextItem, groups, currentBlock])
  const progressPct = activeItemProgress && activeItemProgress.duration > 0
    ? Math.min(100, (activeItemProgress.position / activeItemProgress.duration) * 100)
    : null
  const remainingLabel = activeItemProgress && activeItemProgress.duration > 0
    ? formatDuration(Math.max(0, Math.round((activeItemProgress.duration - activeItemProgress.position) / 1000)))
    : null
  const updateLabel = updatingSchedule && updateProgress?.total
    ? `Atualizando… ${updateProgress.done}/${updateProgress.total}`
    : updatingSchedule
      ? 'Atualizando…'
      : 'Atualizar'
  const generateLabel = updatingSchedule && updateProgress?.total
    ? `Gerando… ${updateProgress.done}/${updateProgress.total}`
    : updatingSchedule
      ? 'Gerando…'
      : 'Gerar da Estrutura'

  return (
    <div className="day-schedule-panel">
      <div className="schedule-cockpit">
        <div className="schedule-cockpit-top">
          <div>
            <div className="schedule-kicker">
              {DAY_NAMES[selDow]} · {scheduleDateLabel}
              {isToday && <span className="today-pill">Hoje</span>}
            </div>
            <h2>{t.schedule.title}</h2>
          </div>

          <div className="schedule-date-picker">
            <CalendarDays size={13} />
            <input
              type="date"
              value={selectedDate}
              onChange={e => onDateChange(e.target.value || todayStr)}
            />
          </div>
        </div>

        <div className="schedule-cockpit-grid">
          <section className={`cockpit-card cockpit-now${playingItem ? ' is-live' : ''}`}>
            <div className="cockpit-label">
              {playingItem ? 'Agora no ar' : isToday ? 'Bloco atual' : 'Primeiro bloco'}
            </div>
            <div className="cockpit-title">
              {playingItem?.title ?? currentBlock?.slot?.title ?? currentBlock?.time ?? 'Sem bloco'}
            </div>
            <div className="cockpit-meta">
              {currentBlock
                ? `${currentBlock.time} · ${currentBlock.items.length} ${currentBlock.items.length === 1 ? 'item' : 'itens'}`
                : 'Nenhuma programação carregada'}
              {remainingLabel && <span className="cockpit-countdown">-{remainingLabel}</span>}
            </div>
            {playingItem && progressPct !== null && (
              <div className="cockpit-progress-track">
                <div className="cockpit-progress-fill" style={{ width: `${progressPct}%` }} />
              </div>
            )}
          </section>

          <section className="cockpit-card">
            <div className="cockpit-label">Próximo</div>
            <div className="cockpit-title">{nextItem?.title ?? nextBlock?.slot?.title ?? 'Nada pendente'}</div>
            <div className="cockpit-meta">
              {nextBlock
                ? `${nextBlock.time}${nextBlock.slot?.title ? ` · ${nextBlock.slot.title}` : ''}`
                : hasPending ? 'Aguardando ordem' : 'Grade concluída'}
            </div>
          </section>

          <section className="cockpit-card cockpit-summary">
            <div className="summary-stat">
              <span>{schedule.length}</span>
              <small>itens</small>
            </div>
            <div className="summary-stat">
              <span>{completedCount}</span>
              <small>concluídos</small>
            </div>
            <div className="summary-stat">
              <span>{formatDuration(totalDuration)}</span>
              <small>total</small>
            </div>
            {errorCount > 0 && <div className="summary-alert">{errorCount} erro{errorCount > 1 ? 's' : ''}</div>}
          </section>
        </div>

        <div className="schedule-action-row">
          {/* ── Left: playback controls ── */}
          <div className="schedule-playback-controls">
            {isToday ? (
              !state.isSequencePlaying ? (
                <button
                  className="day-schedule-btn play"
                  onClick={handleStartScheduleWithPreflight}
                  disabled={!hasPending || preflightRunning}
                  title={hasPending ? 'Iniciar programação do bloco atual' : 'Nenhum item pendente'}
                >
                  <ListVideo size={15} /> {t.schedule.playSchedule}
                </button>
              ) : (
                <>
                  <button
                    className="day-schedule-btn"
                    disabled={nextCrossfadeActive}
                    onClick={async () => { setNextCrossfadeActive(true); await skipToNext(); setNextCrossfadeActive(false) }}
                    title="Próxima faixa com crossfade de 3s"
                  >
                    <SkipForward size={13} /> {nextCrossfadeActive ? '3s…' : 'Next'}
                  </button>
                  <button
                    className={`day-schedule-btn${stopAfterArmed ? ' stop-after-armed' : ''}`}
                    onClick={() => { const v = !stopAfterArmed; setStopAfterArmed(v); setStopAfterCurrent(v) }}
                    title={stopAfterArmed ? 'Stop Next armado — vai parar após o item atual terminar (clique para cancelar)' : 'Parar após o item atual terminar'}
                  >
                    <StopCircle size={13} /> {stopAfterArmed ? 'Stop Next ✓' : 'Stop Next'}
                  </button>
                  <button className="day-schedule-btn stop" onClick={stopPlayback}>
                    <Square size={13} /> {t.playlist.stopPlayback}
                  </button>
                </>
              )
            ) : null}
          </div>

          {/* ── Right: management tools ── */}
          <div className="day-schedule-controls">
            {schedule.length > 0 && (
              <button className="day-schedule-btn" onClick={handleCenterBlock} title="Rolar para o bloco da hora atual">
                <Crosshair size={13} /> Centralizar Bloco
              </button>
            )}
            <button
              className="day-schedule-btn"
              onClick={() => { void runPreflight('manual') }}
              disabled={preflightRunning}
              title="Validar arquivos, inputs e comandos antes da execucao"
            >
              <ShieldCheck size={13} className={preflightRunning ? 'spin' : ''} />
              {preflightRunning ? 'Validando...' : 'Validar'}
            </button>
            <button
              className="day-schedule-btn"
              onClick={() => { setVmixHealthReferenceTime(Date.now()); setShowVmixHealth(true) }}
              title="Ver saude da conexao e log de comandos vMix"
            >
              <Activity size={13} /> vMix
            </button>
            <button
              className="day-schedule-btn"
              onClick={handleReload}
              disabled={updatingSchedule}
              title={updatingSchedule ? 'Atualizando programação...' : 'Recarregar programação desta data'}
            >
              <RefreshCw size={13} className={updatingSchedule ? 'spin' : ''} />
              {updateLabel}
            </button>
            {missingDurCount > 0 && (
              <button
                className="day-schedule-btn"
                onClick={handleRefreshDurations}
                disabled={readingDurations}
                title={`Ler duração de ${missingDurCount} item(s) sem tempo`}
              >
                <Clock size={13} className={readingDurations ? 'spin' : ''} />
                {readingDurations ? `Lendo… (${missingDurCount})` : `Ler Tempos (${missingDurCount})`}
              </button>
            )}
            {updateError && <span className="schedule-action-error">{updateError}</span>}
            <button
              className="day-schedule-btn accent"
              onClick={handleAddItemFromToolbar}
              title={selectedItemId ? 'Adicionar item ao bloco selecionado' : 'Escolher bloco para adicionar item'}
            >
              <Plus size={13} /> Adicionar item
            </button>
            <button
              className={`day-schedule-btn${showVmixPanel ? ' accent' : ''}`}
              onClick={() => setShowVmixPanel(v => !v)}
              title={showVmixPanel ? 'Fechar painel de inputs' : 'Abrir painel de inputs do vMix'}
            >
              <MonitorPlay size={13} /> Inputs vMix
            </button>
          </div>
        </div>
      </div>
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
          <button
            className="day-schedule-btn"
            onClick={handleReload}
            disabled={updatingSchedule}
            title={updatingSchedule ? 'Atualizando programação...' : 'Recarregar programação desta data'}
          >
            <RefreshCw size={13} className={updatingSchedule ? 'spin' : ''} />
            {updateLabel}
          </button>

          {/* Ler Tempos — só aparece quando há itens sem duração */}
          {missingDurCount > 0 && (
            <button
              className="day-schedule-btn"
              onClick={handleRefreshDurations}
              disabled={readingDurations}
              title={`Ler duração de ${missingDurCount} item(s) sem tempo`}
            >
              <Clock size={13} className={readingDurations ? 'spin' : ''} />
              {readingDurations ? `Lendo… (${missingDurCount})` : `Ler Tempos (${missingDurCount})`}
            </button>
          )}
          {updateError && <span className="schedule-action-error">{updateError}</span>}

          {/* Play / Stop / Next — always visible for today; preview text for other dates */}
          {isToday ? (
            !state.isSequencePlaying ? (
              <button
                className="day-schedule-btn accent"
                onClick={handleStartScheduleWithPreflight}
                disabled={!hasPending || preflightRunning}
                title={hasPending ? 'Iniciar programação do bloco atual' : 'Nenhum item pendente'}
              >
                <ListVideo size={15} /> {t.schedule.playSchedule}
              </button>
            ) : (
              <>
                <button
                  className="day-schedule-btn"
                  disabled={nextCrossfadeActive}
                  onClick={async () => { setNextCrossfadeActive(true); await skipToNext(); setNextCrossfadeActive(false) }}
                  title="Próxima faixa com crossfade de 3s"
                >
                  <SkipForward size={13} /> {nextCrossfadeActive ? '3s…' : 'Next'}
                </button>
                <button
                  className={`day-schedule-btn${stopAfterArmed ? ' stop-after-armed' : ''}`}
                  onClick={() => { const v = !stopAfterArmed; setStopAfterArmed(v); setStopAfterCurrent(v) }}
                  title={stopAfterArmed ? 'Stop Next armado — vai parar após o item atual terminar (clique para cancelar)' : 'Parar após o item atual terminar'}
                >
                  <StopCircle size={13} /> {stopAfterArmed ? 'Stop Next ✓' : 'Stop Next'}
                </button>
                <button className="day-schedule-btn" onClick={stopPlayback} style={{ borderColor: 'var(--error)', color: 'var(--error)' }}>
                  <Square size={13} /> {t.playlist.stopPlayback}
                </button>
              </>
            )
          ) : (
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
              Pré-visualização — play só para hoje
            </span>
          )}
        </div>
      </div>

      {/* ── Sub-toolbar ── */}
      <div className="day-schedule-subtoolbar">
        <button
          className="day-schedule-btn accent"
          onClick={handleAddItemFromToolbar}
          title={selectedItemId ? 'Adicionar item ao bloco selecionado' : 'Escolher bloco para adicionar item'}
        >
          <Plus size={13} /> Adicionar item
        </button>
        <button
          className={`day-schedule-btn${showVmixPanel ? ' accent' : ''}`}
          onClick={() => setShowVmixPanel(v => !v)}
          title={showVmixPanel ? 'Fechar painel de inputs' : 'Abrir painel de inputs do vMix'}
        >
          <MonitorPlay size={13} /> Inputs vMix
        </button>
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
          <button
            className="day-schedule-btn accent"
            onClick={handleReload}
            disabled={updatingSchedule}
          >
            <RefreshCw size={14} className={updatingSchedule ? 'spin' : ''} />
            {generateLabel}
          </button>
          {updateError && <span className="schedule-action-error">{updateError}</span>}
        </div>
      ) : (
        <>
          <div className="day-schedule-body">
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
                <div
                  key={group.time}
                  className={`block-card ${cls}${currentBlock?.time === group.time ? ' current-block' : ''}${nextBlock?.time === group.time ? ' next-block' : ''}`}
                  data-block-time={group.time}
                >
                  {/* ── Card header ── */}
                  <div className="block-card-header">
                    <CardIcon size={14} />
                    <span className="block-card-time">{group.time}</span>
                    <span className="block-card-name">{group.slot?.title ?? group.time}</span>
                    <span className="block-card-status">
                      {statusLabel}{groupDur > 0 ? ` · ${formatDuration(groupDur)}` : ''}
                    </span>
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
                        item.id === selectedItemId ? 'selected' : '',
                      ].filter(Boolean).join(' ')

                      return (
                        <div
                          key={item.id}
                          className={rowCls}
                          data-row-id={item.id}
                          draggable
                          onClick={() => setSelectedItemId(item.id === selectedItemId ? null : item.id)}
                          onDragStart={e => handleDragStart(e, item)}
                          onDragOver={e => handleDragOver(e, item)}
                          onDrop={e => handleDrop(e, item)}
                          onDragEnd={handleDragEnd}
                          onDragLeave={() => setDragOverId(null)}
                          onContextMenu={e => { handleContextMenu(e, item); setSelectedItemId(item.id) }}
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
            {showVmixPanel && (
              <VmixInputPanel
                onClose={() => setShowVmixPanel(false)}
                onAddInput={inp => {
                  const selItem = selectedItemId ? schedule.find(i => i.id === selectedItemId) : null
                  if (selItem) {
                    // Insert below the selected item, inheriting its block time
                    insertAfterItem(selItem, {
                      title: inp.title,
                      type: spotTypeForVmix(inp.type),
                      duration: inp.duration > 0 ? Math.round(inp.duration / 1000) : 30,
                      status: 'pending',
                      scheduledTime: selItem.scheduledTime,
                      inputName: inp.number,
                    })
                  } else {
                    // No item selected: append to end of first group
                    const firstGroup = groups[0]
                    if (firstGroup) insertItemAtGroupEnd(firstGroup, {
                      title: inp.title,
                      type: spotTypeForVmix(inp.type),
                      duration: inp.duration > 0 ? Math.round(inp.duration / 1000) : 30,
                      status: 'pending',
                      scheduledTime: firstGroup.time + ':00',
                      inputName: inp.number,
                    })
                  }
                }}
              />
            )}
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
          canPaste={copiedItem !== null}
          onStartFromHere={() => { startScheduleFromItem(ctxMenu.item.id); setCtxMenu(null) }}
          onPause={() => { pauseSchedule(); setCtxMenu(null) }}
          onVmixAction={() => { setVmixActionFor(ctxMenu.item); setCtxMenu(null) }}
          onVmixInput={() => { setVmixInputFor(ctxMenu.item); setCtxMenu(null) }}
          onInsertPause={() => { handleInsertPause(ctxMenu.item); setCtxMenu(null) }}
          onDuplicate={() => { insertAfterItem(ctxMenu.item, { ...ctxMenu.item, status: 'pending' }); setCtxMenu(null) }}
          onSkip={() => { handleSkip(ctxMenu.item); setCtxMenu(null) }}
          onMarkDone={() => { handleMarkDone(ctxMenu.item); setCtxMenu(null) }}
          onEditTime={() => { setEditTimeItem(ctxMenu.item); setCtxMenu(null) }}
          onCopy={() => { setCopiedItem(ctxMenu.item); setCtxMenu(null) }}
          onPaste={() => {
            if (copiedItem) {
              const fields: Omit<PlaylistItem, 'id' | 'order'> = {
                title: copiedItem.title,
                clientId: copiedItem.clientId,
                clientName: copiedItem.clientName,
                duration: copiedItem.duration,
                scheduledTime: copiedItem.scheduledTime,
                inputName: copiedItem.inputName,
                type: copiedItem.type,
                status: copiedItem.status,
                filePath: copiedItem.filePath,
                mediaType: copiedItem.mediaType,
                notes: copiedItem.notes,
                adBreakId: copiedItem.adBreakId,
                vmixAction: copiedItem.vmixAction,
              }
              insertAfterItem(ctxMenu.item, { ...fields, status: 'pending', scheduledTime: ctxMenu.item.scheduledTime })
            }
            setCtxMenu(null)
          }}
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

      {/* ── Add Item picker modal ── */}
      {addGroupModal?.mode === 'picker' && (
        <AddItemModal
          key={`picker-${addGroupModal.group.time}`}
          groupTime={addGroupModal.group.time}
          onClose={() => setAddGroupModal(null)}
          onFile={() => {
            handleAddItemFile(addGroupModal.group)
            setAddGroupModal(null)
          }}
          onVmixAction={() => setAddGroupModal(current => current ? { ...current, mode: 'vmix_action' } : null)}
          onVmixInput={() => setAddGroupModal(current => current ? { ...current, mode: 'vmix_input' } : null)}
        />
      )}

      {/* ── vMix Action modal (via Add Item) ── */}
      {addGroupModal?.mode === 'vmix_action' && (
        <VmixActionModal
          key={`vmix-action-${addGroupModal.group.time}`}
          onInsert={action => insertItemAtGroupEnd(addGroupModal.group, {
            title: action.function, type: 'vmix_action', status: 'pending',
            scheduledTime: addGroupModal.group.time + ':00', duration: 0, vmixAction: action,
          })}
          onClose={() => setAddGroupModal(null)}
        />
      )}

      {/* ── vMix Input modal (via Add Item) ── */}
      {addGroupModal?.mode === 'vmix_input' && (
        <VmixInputModal
          key={`vmix-input-${addGroupModal.group.time}`}
          onInsert={(name, dur) => insertItemAtGroupEnd(addGroupModal.group, {
            title: name, type: 'vinheta', status: 'pending',
            scheduledTime: addGroupModal.group.time + ':00', duration: dur, inputName: name,
          })}
          onClose={() => setAddGroupModal(null)}
        />
      )}

      {/* ── Block picker (choose block when no item is selected) ── */}
      {showBlockPicker && (
        <BlockPickerModal
          groups={groups}
          onClose={() => setShowBlockPicker(false)}
          onPick={g => { setShowBlockPicker(false); setAddGroupModal({ group: g, mode: 'picker' }) }}
        />
      )}

      {preflightSummary && (
        <PreflightModal
          summary={preflightSummary}
          mode={preflightMode}
          onClose={() => setPreflightSummary(null)}
          onStartAnyway={handleStartAfterPreflightWarning}
        />
      )}

      {showVmixHealth && (
        <VmixHealthModal
          status={state.vmixStatus}
          logs={state.vmixCommandLog}
          referenceTime={vmixHealthReferenceTime}
          onClose={() => setShowVmixHealth(false)}
        />
      )}
    </div>
  )
}
