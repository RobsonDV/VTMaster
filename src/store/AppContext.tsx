import React, {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from 'react'
import type {
  PlaylistItem,
  Client,
  PlayLog,
  AppSettings,
  VmixStatus,
  VmixCommandLog,
  VmixCommandMeta,
  ClientSpot,
  CommercialBlock,
  CommercialBlockItem,
  SpotRotation,
  ProgramSlot,
  WeeklyProgramGrid,
  MusicStyle,
  MusicSequence,
  AutoBlocoAssignment,
  DeletedScheduleSlot,
  Campaign,
  Segment,
  ProgramWindow,
  GrafismoTitleInput,
  GrafismoTemplate,
} from '../types'
import { getTranslations } from '../i18n'
import type { Translations } from '../i18n'
import { now, today } from '../utils/time'
import { generateMusicBlock as generateMusicBlockEngine } from '../utils/autoprog'
import { setPlaybackProgress } from './playbackProgress'
import {
  detectMediaType,
  mediaDurationCacheKey,
  readMediaDuration,
  readMediaDurationBatch,
} from '../utils/mediaDuration'
import { executeVmixAction, executeVmixCommand, requestVmixXml } from '../utils/vmixCommandService'

/** Signature usada para casar item deletado com item potencialmente regerado pela grade.
 *  Igual para o mesmo slot independentemente de id (id muda a cada geração). */
function _scheduleSignature(item: { type: string; title?: string; adBreakId?: string }): string {
  if (item.adBreakId) return `block:${item.adBreakId}`
  return `${item.type}|${(item.title ?? '').toLowerCase().trim()}`
}

const DEFAULT_SETTINGS: AppSettings = {
  vmixHost: 'localhost',
  vmixPort: 8088,
  stationName: 'Minha Emissora',
  theme: 'dark',
  language: 'pt',
  autoConnect: false,
  autoPlay: false,
  triggerEnabled: false,
  triggerKey: null,
  autoplayComerciais: false,
  preloadMinutes: 5,
  gcMusicEnabled: false,
  gcMusicDelaySeconds: 5,
  gcMusicInputName: '',
  gcMusicLine1Field: 'Artist.Text',
  gcMusicLine2Field: 'Title.Text',
  gcMusicDynamic: true,
  dataSourcesEnabled: false,
  dataSourcesPort: 7070,
}

interface AppState {
  playlist: PlaylistItem[]
  dateSchedules: Record<string, PlaylistItem[]>  // YYYY-MM-DD → programação daquela data
  mediaDurationCache: Record<string, number>     // normalized filePath → duration seconds
  /** Itens deletados manualmente da Programação por data — impede o regenerador da grade
   *  de re-adicionar o mesmo slot no merge. Limpo no virar do dia ou no Replace mode. */
  deletedScheduleSlots: Record<string, DeletedScheduleSlot[]>
  clients: Client[]
  campaigns: Campaign[]
  segments: Segment[]
  programWindows: ProgramWindow[]
  playLog: PlayLog[]
  settings: AppSettings
  vmixStatus: VmixStatus
  vmixCommandLog: VmixCommandLog[]
  activePanel: string
  isLoading: boolean
  isSequencePlaying: boolean
  commercialBlocks: CommercialBlock[]
  clientSpots: ClientSpot[]
  spotRotation: SpotRotation
  weeklyGrid: WeeklyProgramGrid
  musicStyles: MusicStyle[]
  musicSequences: MusicSequence[]
  autoBlocoAssignments: AutoBlocoAssignment[]
  grafismoTitleInputs: GrafismoTitleInput[]
  grafismoTemplates: GrafismoTemplate[]
}

const DEFAULT_WEEKLY_GRID: WeeklyProgramGrid = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] }

function sanitizeDurationCache(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out: Record<string, number> = {}
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const dur = typeof value === 'number' ? value : Number(value)
    if (key && isFinite(dur) && dur > 0) out[key] = Math.round(dur)
  }
  return out
}

const initialState: AppState = {
  playlist: [],
  dateSchedules: {},
  mediaDurationCache: {},
  deletedScheduleSlots: {},
  clients: [],
  campaigns: [],
  segments: [],
  programWindows: [],
  playLog: [],
  settings: DEFAULT_SETTINGS,
  vmixStatus: { connected: false },
  vmixCommandLog: [],
  activePanel: 'playlist',
  isLoading: true,
  isSequencePlaying: false,
  commercialBlocks: [],
  clientSpots: [],
  spotRotation: {},
  weeklyGrid: DEFAULT_WEEKLY_GRID,
  musicStyles: [],
  musicSequences: [],
  autoBlocoAssignments: [],
  grafismoTitleInputs: [],
  grafismoTemplates: [],
}

type Action =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'LOAD_ALL'; payload: Partial<AppState> }
  | { type: 'SET_ACTIVE_PANEL'; payload: string }
  | { type: 'SET_SETTINGS'; payload: AppSettings }
  | { type: 'SET_VMIX_STATUS'; payload: VmixStatus }
  | { type: 'ADD_VMIX_COMMAND_LOG'; payload: VmixCommandLog }
  | { type: 'SET_VMIX_COMMAND_LOG'; payload: VmixCommandLog[] }
  | { type: 'SET_PLAYLIST'; payload: PlaylistItem[] }
  | { type: 'ADD_PLAYLIST_ITEM'; payload: PlaylistItem }
  | { type: 'UPDATE_PLAYLIST_ITEM'; payload: PlaylistItem }
  | { type: 'DELETE_PLAYLIST_ITEM'; payload: string }
  | { type: 'CLEAR_PLAYLIST' }
  | { type: 'REORDER_PLAYLIST'; payload: PlaylistItem[] }
  | { type: 'ADD_CLIENT'; payload: Client }
  | { type: 'UPDATE_CLIENT'; payload: Client }
  | { type: 'DELETE_CLIENT'; payload: string }
  | { type: 'ADD_CAMPAIGN';    payload: Campaign }
  | { type: 'UPDATE_CAMPAIGN'; payload: Campaign }
  | { type: 'DELETE_CAMPAIGN'; payload: string }
  | { type: 'ADD_SEGMENT';    payload: Segment }
  | { type: 'UPDATE_SEGMENT'; payload: Segment }
  | { type: 'DELETE_SEGMENT'; payload: string }
  | { type: 'ADD_PROGRAM_WINDOW';    payload: ProgramWindow }
  | { type: 'UPDATE_PROGRAM_WINDOW'; payload: ProgramWindow }
  | { type: 'DELETE_PROGRAM_WINDOW'; payload: string }
  | { type: 'ADD_LOG'; payload: PlayLog }
  | { type: 'SET_LOG'; payload: PlayLog[] }
  | { type: 'SET_SEQUENCE_PLAYING'; payload: boolean }
  | { type: 'ADD_COMMERCIAL_BLOCK';    payload: CommercialBlock }
  | { type: 'UPDATE_COMMERCIAL_BLOCK'; payload: CommercialBlock }
  | { type: 'DELETE_COMMERCIAL_BLOCK'; payload: string }
  | { type: 'MARK_BLOCK_LOADED';       payload: { blockId: string; date: string } }
  | { type: 'ADD_CLIENT_SPOT';         payload: ClientSpot }
  | { type: 'UPDATE_CLIENT_SPOT';      payload: ClientSpot }
  | { type: 'DELETE_CLIENT_SPOT';      payload: string }
  | { type: 'SET_SPOT_ROTATION';       payload: SpotRotation }
  | { type: 'INSERT_PLAYLIST_ITEM_AFTER'; payload: { item: PlaylistItem; afterOrder: number } }
  | { type: 'SET_WEEKLY_GRID';      payload: WeeklyProgramGrid }
  | { type: 'ADD_PROGRAM_SLOT';     payload: { day: number; slot: ProgramSlot } }
  | { type: 'UPDATE_PROGRAM_SLOT';  payload: { day: number; slot: ProgramSlot } }
  | { type: 'DELETE_PROGRAM_SLOT';  payload: { day: number; slotId: string } }
  | { type: 'REORDER_PROGRAM_SLOTS';payload: { day: number; slots: ProgramSlot[] } }
  | { type: 'SET_DATE_SCHEDULE';      payload: { date: string; items: PlaylistItem[] } }
  | { type: 'UPDATE_SCHEDULE_ITEM';   payload: { date: string; item: PlaylistItem } }
  | { type: 'DELETE_SCHEDULE_ITEM';   payload: { date: string; id: string } }
  | { type: 'REORDER_DATE_SCHEDULE';  payload: { date: string; items: PlaylistItem[] } }
  | { type: 'UPSERT_MEDIA_DURATIONS'; payload: Record<string, number> }
  | { type: 'ADD_MUSIC_STYLE';             payload: MusicStyle }
  | { type: 'UPDATE_MUSIC_STYLE';          payload: MusicStyle }
  | { type: 'DELETE_MUSIC_STYLE';          payload: string }
  | { type: 'ADD_MUSIC_SEQUENCE';          payload: MusicSequence }
  | { type: 'UPDATE_MUSIC_SEQUENCE';       payload: MusicSequence }
  | { type: 'DELETE_MUSIC_SEQUENCE';       payload: string }
  | { type: 'SET_AUTO_BLOCO_ASSIGNMENT';   payload: AutoBlocoAssignment }
  | { type: 'DELETE_AUTO_BLOCO_ASSIGNMENT'; payload: string }
  | { type: 'ADD_GRAFISMO_TITLE_INPUT';    payload: GrafismoTitleInput }
  | { type: 'UPDATE_GRAFISMO_TITLE_INPUT'; payload: GrafismoTitleInput }
  | { type: 'DELETE_GRAFISMO_TITLE_INPUT'; payload: string }
  | { type: 'ADD_GRAFISMO_TEMPLATE';       payload: GrafismoTemplate }
  | { type: 'UPDATE_GRAFISMO_TEMPLATE';    payload: GrafismoTemplate }
  | { type: 'DELETE_GRAFISMO_TEMPLATE';    payload: string }

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload }
    case 'LOAD_ALL':
      return { ...state, ...action.payload, isLoading: false }
    case 'SET_ACTIVE_PANEL':
      return { ...state, activePanel: action.payload }
    case 'SET_SETTINGS':
      return { ...state, settings: action.payload }
    case 'SET_VMIX_STATUS':
      return { ...state, vmixStatus: action.payload }
    case 'ADD_VMIX_COMMAND_LOG': {
      const next = [...state.vmixCommandLog, action.payload]
      return { ...state, vmixCommandLog: next.length > 2000 ? next.slice(-2000) : next }
    }
    case 'SET_VMIX_COMMAND_LOG':
      return { ...state, vmixCommandLog: action.payload.length > 2000 ? action.payload.slice(-2000) : action.payload }
    case 'SET_PLAYLIST':
      return { ...state, playlist: action.payload }
    case 'ADD_PLAYLIST_ITEM':
      return { ...state, playlist: [...state.playlist, action.payload] }
    case 'UPDATE_PLAYLIST_ITEM':
      return {
        ...state,
        playlist: state.playlist.map((item) =>
          item.id === action.payload.id ? action.payload : item
        ),
      }
    case 'DELETE_PLAYLIST_ITEM':
      return {
        ...state,
        playlist: state.playlist
          .filter((item) => item.id !== action.payload)
          .map((item, i) => ({ ...item, order: i + 1 })),
      }
    case 'CLEAR_PLAYLIST':
      return { ...state, playlist: [] }
    case 'REORDER_PLAYLIST':
      return { ...state, playlist: action.payload }
    case 'ADD_CLIENT':
      return { ...state, clients: [...state.clients, action.payload] }
    case 'UPDATE_CLIENT':
      return {
        ...state,
        clients: state.clients.map((c) =>
          c.id === action.payload.id ? action.payload : c
        ),
      }
    case 'DELETE_CLIENT':
      return {
        ...state,
        clients: state.clients.filter((c) => c.id !== action.payload),
        clientSpots: state.clientSpots.filter((s) => s.clientId !== action.payload),
        campaigns: state.campaigns.filter((camp) => camp.clientId !== action.payload),
      }
    case 'ADD_CAMPAIGN':
      return { ...state, campaigns: [...state.campaigns, action.payload] }
    case 'UPDATE_CAMPAIGN':
      return { ...state, campaigns: state.campaigns.map(c => c.id === action.payload.id ? action.payload : c) }
    case 'DELETE_CAMPAIGN':
      return { ...state, campaigns: state.campaigns.filter(c => c.id !== action.payload) }
    case 'ADD_SEGMENT':
      return { ...state, segments: [...state.segments, action.payload] }
    case 'UPDATE_SEGMENT':
      return { ...state, segments: state.segments.map(s => s.id === action.payload.id ? action.payload : s) }
    case 'DELETE_SEGMENT':
      return { ...state, segments: state.segments.filter(s => s.id !== action.payload) }
    case 'ADD_PROGRAM_WINDOW':
      return { ...state, programWindows: [...state.programWindows, action.payload] }
    case 'UPDATE_PROGRAM_WINDOW':
      return { ...state, programWindows: state.programWindows.map(p => p.id === action.payload.id ? action.payload : p) }
    case 'DELETE_PROGRAM_WINDOW':
      return { ...state, programWindows: state.programWindows.filter(p => p.id !== action.payload) }
    case 'ADD_LOG': {
      const next = [...state.playLog, action.payload]
      return { ...state, playLog: next.length > 10000 ? next.slice(-10000) : next }
    }
    case 'SET_LOG':
      return { ...state, playLog: action.payload.length > 10000 ? action.payload.slice(-10000) : action.payload }
    case 'SET_SEQUENCE_PLAYING':
      return { ...state, isSequencePlaying: action.payload }
    case 'ADD_COMMERCIAL_BLOCK':
      return { ...state, commercialBlocks: [...state.commercialBlocks, action.payload] }
    case 'UPDATE_COMMERCIAL_BLOCK':
      return { ...state, commercialBlocks: state.commercialBlocks.map(b => b.id === action.payload.id ? action.payload : b) }
    case 'DELETE_COMMERCIAL_BLOCK':
      return { ...state, commercialBlocks: state.commercialBlocks.filter(b => b.id !== action.payload) }
    case 'MARK_BLOCK_LOADED':
      return { ...state, commercialBlocks: state.commercialBlocks.map(b => b.id === action.payload.blockId ? { ...b, lastLoadedDate: action.payload.date } : b) }
    case 'ADD_CLIENT_SPOT':
      return { ...state, clientSpots: [...state.clientSpots, action.payload] }
    case 'UPDATE_CLIENT_SPOT':
      return { ...state, clientSpots: state.clientSpots.map(s => s.id === action.payload.id ? action.payload : s) }
    case 'DELETE_CLIENT_SPOT':
      return { ...state, clientSpots: state.clientSpots.filter(s => s.id !== action.payload) }
    case 'SET_SPOT_ROTATION':
      return { ...state, spotRotation: action.payload }
    case 'INSERT_PLAYLIST_ITEM_AFTER': {
      const sorted = [...state.playlist].sort((a, b) => a.order - b.order)
      const insertIdx = sorted.findIndex(i => i.order === action.payload.afterOrder)
      const spliced = [
        ...sorted.slice(0, insertIdx + 1),
        action.payload.item,
        ...sorted.slice(insertIdx + 1),
      ].map((i, idx) => ({ ...i, order: idx + 1 }))
      return { ...state, playlist: spliced }
    }
    case 'SET_WEEKLY_GRID':
      return { ...state, weeklyGrid: action.payload }
    case 'ADD_PROGRAM_SLOT': {
      const daySlots = [...(state.weeklyGrid[action.payload.day] ?? [])]
      daySlots.push(action.payload.slot)
      return { ...state, weeklyGrid: { ...state.weeklyGrid, [action.payload.day]: daySlots } }
    }
    case 'UPDATE_PROGRAM_SLOT': {
      const daySlots = (state.weeklyGrid[action.payload.day] ?? []).map(s =>
        s.id === action.payload.slot.id ? action.payload.slot : s
      )
      return { ...state, weeklyGrid: { ...state.weeklyGrid, [action.payload.day]: daySlots } }
    }
    case 'DELETE_PROGRAM_SLOT': {
      const daySlots = (state.weeklyGrid[action.payload.day] ?? [])
        .filter(s => s.id !== action.payload.slotId)
        .map((s, i) => ({ ...s, order: i + 1 }))
      return { ...state, weeklyGrid: { ...state.weeklyGrid, [action.payload.day]: daySlots } }
    }
    case 'REORDER_PROGRAM_SLOTS':
      return { ...state, weeklyGrid: { ...state.weeklyGrid, [action.payload.day]: action.payload.slots } }
    case 'SET_DATE_SCHEDULE':
      return { ...state, dateSchedules: { ...state.dateSchedules, [action.payload.date]: action.payload.items } }
    case 'UPDATE_SCHEDULE_ITEM': {
      const d = action.payload.date
      return { ...state, dateSchedules: { ...state.dateSchedules,
        [d]: (state.dateSchedules[d] ?? []).map(i => i.id === action.payload.item.id ? action.payload.item : i),
      }}
    }
    case 'DELETE_SCHEDULE_ITEM': {
      const d = action.payload.date
      const existing = state.dateSchedules[d] ?? []
      const deletedItem = existing.find(i => i.id === action.payload.id)
      const remaining = existing.filter(i => i.id !== action.payload.id).map((i, idx) => ({ ...i, order: idx + 1 }))
      // Registra a deleção apenas para itens que vieram da grade (não manuais),
      // para impedir que o regenerador da grade os re-adicione no merge.
      let nextDeleted = state.deletedScheduleSlots
      if (deletedItem && !deletedItem.manuallyAdded) {
        const time = deletedItem.scheduledTime?.slice(0, 5)
        if (time) {
          const signature = _scheduleSignature(deletedItem)
          const dayList = nextDeleted[d] ?? []
          const already = dayList.some(s => s.time === time && s.signature === signature)
          if (!already) {
            nextDeleted = { ...nextDeleted, [d]: [...dayList, { time, signature }] }
          }
        }
      }
      return {
        ...state,
        dateSchedules: { ...state.dateSchedules, [d]: remaining },
        deletedScheduleSlots: nextDeleted,
      }
    }
    case 'REORDER_DATE_SCHEDULE':
      return { ...state, dateSchedules: { ...state.dateSchedules, [action.payload.date]: action.payload.items } }
    case 'UPSERT_MEDIA_DURATIONS':
      return { ...state, mediaDurationCache: { ...state.mediaDurationCache, ...action.payload } }
    case 'ADD_MUSIC_STYLE':
      return { ...state, musicStyles: [...state.musicStyles, action.payload] }
    case 'UPDATE_MUSIC_STYLE':
      return { ...state, musicStyles: state.musicStyles.map(s => s.id === action.payload.id ? action.payload : s) }
    case 'DELETE_MUSIC_STYLE':
      return { ...state, musicStyles: state.musicStyles.filter(s => s.id !== action.payload) }
    case 'ADD_MUSIC_SEQUENCE':
      return { ...state, musicSequences: [...state.musicSequences, action.payload] }
    case 'UPDATE_MUSIC_SEQUENCE':
      return { ...state, musicSequences: state.musicSequences.map(s => s.id === action.payload.id ? action.payload : s) }
    case 'DELETE_MUSIC_SEQUENCE':
      return { ...state, musicSequences: state.musicSequences.filter(s => s.id !== action.payload) }
    case 'SET_AUTO_BLOCO_ASSIGNMENT': {
      const exists = state.autoBlocoAssignments.some(
        a => a.programSlotId === action.payload.programSlotId && a.dayOfWeek === action.payload.dayOfWeek,
      )
      return {
        ...state,
        autoBlocoAssignments: exists
          ? state.autoBlocoAssignments.map(a =>
              a.programSlotId === action.payload.programSlotId && a.dayOfWeek === action.payload.dayOfWeek
                ? action.payload
                : a,
            )
          : [...state.autoBlocoAssignments, action.payload],
      }
    }
    case 'DELETE_AUTO_BLOCO_ASSIGNMENT':
      return { ...state, autoBlocoAssignments: state.autoBlocoAssignments.filter(a => a.id !== action.payload) }
    case 'ADD_GRAFISMO_TITLE_INPUT':
      return { ...state, grafismoTitleInputs: [...state.grafismoTitleInputs, action.payload] }
    case 'UPDATE_GRAFISMO_TITLE_INPUT':
      return { ...state, grafismoTitleInputs: state.grafismoTitleInputs.map(i => i.id === action.payload.id ? action.payload : i) }
    case 'DELETE_GRAFISMO_TITLE_INPUT':
      return { ...state, grafismoTitleInputs: state.grafismoTitleInputs.filter(i => i.id !== action.payload) }
    case 'ADD_GRAFISMO_TEMPLATE':
      return { ...state, grafismoTemplates: [...state.grafismoTemplates, action.payload] }
    case 'UPDATE_GRAFISMO_TEMPLATE':
      return { ...state, grafismoTemplates: state.grafismoTemplates.map(t => t.id === action.payload.id ? action.payload : t) }
    case 'DELETE_GRAFISMO_TEMPLATE':
      return { ...state, grafismoTemplates: state.grafismoTemplates.filter(t => t.id !== action.payload) }
    default:
      return state
  }
}

interface AppContextValue {
  state: AppState
  dispatch: React.Dispatch<Action>
  t: Translations
  saveToStorage: (key: string, data: unknown) => void
  playItem: (item: PlaylistItem) => Promise<void>
  playSingleItem: () => void
  startSequence: () => void
  startSchedule: () => void
  startScheduleFromNow: () => void
  startScheduleFromItem: (itemId: string) => void
  pauseSchedule: () => void
  stopPlayback: () => Promise<void>
  loadBlockIntoPlaylist: (block: CommercialBlock) => void
  disparo: () => void
  generatePlaylistFromGrid: (
    targetDate?: string,
    merge?: boolean,
    onDurationProgress?: (done: number, total: number) => void,
  ) => Promise<void>
  skipToNext: () => Promise<void>
  setStopAfterCurrent: (v: boolean) => void
}

const AppContext = createContext<AppContextValue | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState)
  const t = getTranslations(state.settings.language)

  const saveToStorage = useCallback((key: string, data: unknown) => {
    if (window.spotmaster) window.spotmaster.saveData(key, data)
  }, [])

  const stateRef = useRef(state)
  useEffect(() => { stateRef.current = state })

  // Tracks the vMix input number currently on-air
  const activeInputRef = useRef<string>('')
  // Set to true by stopPlayback(); checked inside every async loop
  const abortRef = useRef<boolean>(false)
  // When true, the abort was triggered by the schedule (not the user).
  // runSequence uses this to resume instead of stopping.
  const scheduleInterruptRef = useRef<boolean>(false)
  // Holds the scheduledTime (HH:MM:SS) that triggered the current interrupt.
  // Prevents the scheduler from re-triggering for the same block while it plays.
  const scheduleInterruptTimeRef = useRef<string>('')
  // Ref exclusivo do scheduler de comerciais — evita que o scheduler de autoPlay (programas)
  // bloqueie o disparo de comerciais quando ambos têm itens no mesmo horário.
  const commInterruptTimeRef = useRef<string>('')
  // Tracks last fast-poll position per input — guards progress bar against regression on audio end
  const lastFastPosRef = useRef<Record<string, number>>({})
  // Holds a preloaded next input (GUID + filePath) ready to go on-air without delay
  const preloadedInputRef = useRef<{ guid: string; filePath: string; alreadyOnAir?: boolean } | null>(null)
  // Tracks ALL GUIDs loaded by SpotMaster via AddInput during this session.
  // Used for full cleanup at end-of-sequence or stopPlayback — ensures no
  // ghost inputs accumulate in the vMix project. Permanent vMix inputs
  // (inputName) never pass through loadNewInput, so they are never in this Set.
  const spotmasterGuidsRef = useRef<Set<string>>(new Set())
  // Set by disparo() during active playback — signals runSequence to skip
  // current item and continue to the next, without fully stopping.
  const disparoInterruptRef = useRef<boolean>(false)
  // Registra o HH:MM:SS de quando a sessão iniciou. Os schedulers de autoplay
  // ignoram blocos cujo scheduledTime < sessionStartRef, evitando que o app
  // inicie automaticamente ao abrir com itens antigos ainda pendentes.
  const sessionStartRef = useRef<string>(now())
  // Mutex: prevents both autoplay schedulers from firing simultaneously in the
  // same JS event-loop tick. The second scheduler returns immediately if the
  // first hasn't finished yet, avoiding double writes to scheduleInterruptTimeRef.
  const schedulerFiringRef = useRef(false)
  // High-water mark: runSequence never selects items with order < this value.
  // Updated when a commercial fires automatically — pending musical items from
  // the interrupted block stay 'pending' (visible in the timeline) but are bypassed.
  // Reset to -1 on stopPlayback and natural sequence end.
  const minOrderRef = useRef(-1)
  // When true, runSequence breaks after the current item finishes (Stop Next button).
  const stopAfterCurrentRef = useRef(false)

  // Tracks which queue (playlist or daySchedule) runSequence is reading from.
  // Changed by startSequence() and startSchedule() before invoking runSequence().
  const activeQueueRef = useRef<'playlist' | 'schedule'>('playlist')

  // Returns the currently active queue's items (live read via stateRef).
  const getQueue = () =>
    activeQueueRef.current === 'schedule'
      ? (stateRef.current.dateSchedules[today()] ?? [])
      : stateRef.current.playlist

  // Dispatches a status update to whichever queue is active.
  const updateQueueItem = (item: PlaylistItem) => {
    if (activeQueueRef.current === 'schedule') {
      dispatch({ type: 'UPDATE_SCHEDULE_ITEM', payload: { date: today(), item } })
    } else {
      dispatch({ type: 'UPDATE_PLAYLIST_ITEM', payload: item })
    }
  }

  // ── expandBlockItems ────────────────────────────────────────────────────────
  // Converts a CommercialBlock's items into PlaylistItems (without dispatching).
  // Returns [playlistItems, updatedRotation].
  // Used by loadBlockIntoPlaylist (appends to playlist) and generatePlaylistFromGrid.
  const expandBlockItems = useCallback((
    block: CommercialBlock,
    startOrder: number,
    rotation: SpotRotation,
  ): [PlaylistItem[], SpotRotation] => {
    const { clientSpots, clients, campaigns, commercialBlocks } = stateRef.current
    const newRotation = { ...rotation }
    const items: PlaylistItem[] = []
    let offset = 0
    const todayStr = new Date().toISOString().slice(0, 10)

    // Helper: days between two YYYY-MM-DD strings (endDate - startDate)
    const daysBetween = (start: string, end: string): number =>
      Math.floor((new Date(end).getTime() - new Date(start).getTime()) / 86400000)

    const byOrder = [...(block.items ?? [])].sort((a, b) => a.order - b.order)

    const spotSlots = byOrder
      .map((it, i) => (it.type === 'spot_client' ? i : -1))
      .filter(i => i >= 0)

    const sortedSpots = byOrder
      .filter(it => it.type === 'spot_client')
      .sort((a, b) => {
        const ca = a.campaignId ? (campaigns ?? []).find(c => c.id === a.campaignId) : null
        const cb = b.campaignId ? (campaigns ?? []).find(c => c.id === b.campaignId) : null
        const pa = ca?.blockPosition ?? 0
        const pb = cb?.blockPosition ?? 0
        if (pa !== pb) return pa - pb
        const pra = ca?.priority ?? 2
        const prb = cb?.priority ?? 2
        if (pra !== prb) return pra - prb
        return a.order - b.order
      })

    const ordered = [...byOrder]
    spotSlots.forEach((slotIdx, rank) => { ordered[slotIdx] = sortedSpots[rank] })

    for (const bi of ordered) {
      if (bi.type === 'spot_client') {
        const clientId = bi.clientId ?? ''
        const spotsCount = bi.spotsCount ?? 1
        const spots = clientSpots.filter(s => s.clientId === clientId)
        if (spots.length === 0) continue

        // Se o item tem campaignId, valida se a campanha ainda está ativa
        if (bi.campaignId) {
          const camp = (campaigns ?? []).find(c => c.id === bi.campaignId)
          // Campanha inexistente, expirada, pausada ou concluída → não veicula
          if (!camp || camp.status !== 'active' || camp.endDate < todayStr || camp.startDate > todayStr) continue
        }

        const base = newRotation[clientId] ?? 0

        // Encontra campanha ativa para este cliente (para propagar campaignId no log)
        const activeCampaign = (campaigns ?? []).find(camp =>
          camp.clientId === clientId &&
          camp.status === 'active' &&
          camp.startDate <= todayStr &&
          camp.endDate >= todayStr
        )

        for (let i = 0; i < spotsCount; i++) {
          const spot = spots[(base + i) % spots.length]
          items.push({
            id: crypto.randomUUID(),
            order: startOrder + offset,
            title: spot.title,
            clientId: spot.clientId,
            clientName: clients.find(c => c.id === spot.clientId)?.name ?? '',
            campaignId: bi.campaignId ?? activeCampaign?.id,
            duration: Math.max(spot.duration || 0, 5),
            filePath: spot.filePath,
            mediaType: spot.mediaType,
            type: 'spot' as const,
            status: 'pending' as const,
            adBreakId: block.id,
            scheduledTime: block.scheduledTime,
          })
          offset++
        }
        newRotation[clientId] = (base + spotsCount) % spots.length
      } else if (bi.type === 'vmix_action') {
        items.push({
          id: crypto.randomUUID(),
          order: startOrder + offset,
          title: bi.title ?? (bi.vmixAction?.function ?? 'Ação vMix'),
          duration: 0,
          type: 'vmix_action' as const,
          status: 'pending' as const,
          adBreakId: block.id,
          scheduledTime: block.scheduledTime,
          vmixAction: bi.vmixAction,
        })
        offset++
      } else if (bi.type === 'vmix_input') {
        items.push({
          id: crypto.randomUUID(),
          order: startOrder + offset,
          title: bi.title ?? (bi.inputName ?? 'Input vMix'),
          duration: bi.duration ?? 10,
          type: 'outros' as const,
          status: 'pending' as const,
          adBreakId: block.id,
          scheduledTime: block.scheduledTime,
          inputName: bi.inputName,
        })
        offset++
      }
    }

    // ── Rotativo injection ──────────────────────────────────────────────────
    // For each active rotativo campaign, compute which block it targets today
    // (daysElapsed % totalBlocks). If this block is the target → inject client.
    const allEnabledBlocks = [...(commercialBlocks ?? [])]
      .filter(b => b.enabled)
      .sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime))

    if (allEnabledBlocks.length > 0) {
      const rotativoCampaigns = (campaigns ?? []).filter(c =>
        c.modality === 'rotativo' &&
        c.status === 'active' &&
        c.startDate <= todayStr &&
        c.endDate >= todayStr
      )

      for (const rCamp of rotativoCampaigns) {
        const elapsed = daysBetween(rCamp.startDate, todayStr)
        const targetIndex = Math.max(0, elapsed) % allEnabledBlocks.length
        const targetBlock = allEnabledBlocks[targetIndex]
        if (targetBlock.id !== block.id) continue

        // Avoid duplicating if already in template
        const alreadyInTemplate = (block.items ?? []).some(
          bi => bi.type === 'spot_client' && bi.clientId === rCamp.clientId
        )
        if (alreadyInTemplate) continue

        const spots = clientSpots.filter(s => s.clientId === rCamp.clientId)
        if (spots.length === 0) continue

        const base = newRotation[rCamp.clientId] ?? 0
        const spot = spots[base % spots.length]
        items.push({
          id: crypto.randomUUID(),
          order: startOrder + offset,
          title: spot.title,
          clientId: spot.clientId,
          clientName: clients.find(c => c.id === rCamp.clientId)?.name ?? '',
          campaignId: rCamp.id,
          duration: Math.max(spot.duration || 0, 5),
          filePath: spot.filePath,
          mediaType: spot.mediaType,
          type: 'spot' as const,
          status: 'pending' as const,
          adBreakId: block.id,
          scheduledTime: block.scheduledTime,
        })
        offset++
        newRotation[rCamp.clientId] = (base + 1) % spots.length
      }
    }

    return [items, newRotation]
  }, [])

  // ── loadBlockIntoPlaylist ───────────────────────────────────────────────────
  // Expands a block's items and appends them to the playlist tail.
  // Called by the scheduler (auto, manual workflow) and by "Recarregar" button.
  const loadBlockIntoPlaylist = useCallback((block: CommercialBlock) => {
    const dateStr = new Date().toISOString().slice(0, 10)
    const { playlist, spotRotation } = stateRef.current
    const startOrder = playlist.length + 1

    const [items, newRotation] = expandBlockItems(block, startOrder, spotRotation)
    items.forEach(item => dispatch({ type: 'ADD_PLAYLIST_ITEM', payload: item }))

    dispatch({ type: 'MARK_BLOCK_LOADED', payload: { blockId: block.id, date: dateStr } })
    dispatch({ type: 'SET_SPOT_ROTATION', payload: newRotation })
  }, [dispatch, expandBlockItems])

  // ── generatePlaylistFromGrid ─────────────────────────────────────────────────
  // Builds the full day's playlist from:
  //   1. Weekly grid template programs for today
  //   2. Commercial blocks scheduled for today (already expanded into items)
  // Sorts everything by scheduledTime and replaces the entire playlist.
  // Marks commercial blocks as loaded so the scheduler won't duplicate them.
  const generatePlaylistFromGrid = useCallback(async (
    targetDate?: string,
    merge = false,
    onDurationProgress?: (done: number, total: number) => void,
  ) => {
    const dateStr = targetDate ?? today()
    const existingScheduleForBackup = stateRef.current.dateSchedules[dateStr] ?? []
    if (existingScheduleForBackup.length > 0 && window.spotmaster?.createBackup) {
      window.spotmaster
        .createBackup(merge ? 'before-schedule-merge' : 'before-schedule-generate')
        .catch(() => {})
    }
    // Parse day-of-week from the target date (midday avoids DST edge cases)
    const dayOfWeek = new Date(dateStr + 'T12:00:00').getDay()
    const { weeklyGrid, commercialBlocks, spotRotation, mediaDurationCache } = stateRef.current
    const localDurationCache = new Map(Object.entries(mediaDurationCache))
    let durationCacheUpdates: Record<string, number> = {}

    const rememberDuration = (filePath: string, duration: number) => {
      const dur = Math.round(duration)
      if (!isFinite(dur) || dur <= 0) return
      const key = mediaDurationCacheKey(filePath)
      localDurationCache.set(key, dur)
      durationCacheUpdates[key] = dur
    }

    const cachedDuration = (filePath: string): number | undefined => {
      const dur = localDurationCache.get(mediaDurationCacheKey(filePath))
      return dur && dur > 0 ? dur : undefined
    }

    const readDurationForAutoProg = async (filePath: string): Promise<number | null> => {
      const cached = cachedDuration(filePath)
      if (cached) return cached
      const mediaType = detectMediaType(filePath)
      if (mediaType === 'image') return null
      const dur = await readMediaDuration(filePath, mediaType, 15_000)
      if (dur && dur > 0) {
        rememberDuration(filePath, dur)
        return dur
      }
      return null
    }

    const flushDurationCacheUpdates = () => {
      const payload = durationCacheUpdates
      durationCacheUpdates = {}
      if (Object.keys(payload).length > 0) {
        dispatch({ type: 'UPSERT_MEDIA_DURATIONS', payload })
      }
    }

    // 1. Programs + linked blocks from weekly grid
    const programItems: PlaylistItem[] = []
    let currentRotation = { ...spotRotation }

    const sortedSlots = (weeklyGrid[dayOfWeek] ?? [])
      .slice()
      .sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime) || a.order - b.order)

    // IDs de blocos referenciados por slots da grade. Calculado antes do loop
    // para que o fallback de órfão possa atualizar (sem isso, blocos usados como
    // fallback acabam duplicados no loop 2 abaixo).
    const linkedBlockIds = new Set(
      sortedSlots
        .filter(s => s.type === 'bloco_comercial' || s.type === 'bloco_musical')
        .map(s => s.commercialBlockId)
        .filter((id): id is string => !!id && commercialBlocks.some(b => b.id === id))
    )

    for (let si = 0; si < sortedSlots.length; si++) {
      const slot = sortedSlots[si]
      if (slot.type === 'bloco_comercial' || slot.type === 'bloco_musical') {
        if (slot.type === 'bloco_musical') {
          // AutoProg: verifica se há sequência atribuída a este slot+dia
          const { autoBlocoAssignments, musicSequences, musicStyles, playLog } = stateRef.current
          const assignment = autoBlocoAssignments.find(
            a => a.programSlotId === slot.id && a.dayOfWeek === dayOfWeek && !!a.sequenceId,
          )
          let musicItemsGenerated = false
          if (assignment?.sequenceId && window.spotmaster?.scanMusicFolder) {
            const sequence = musicSequences.find(s => s.id === assignment.sequenceId)
            if (sequence) {
              try {
                const generated = await generateMusicBlockEngine({
                  sequence,
                  styles: musicStyles,
                  playLog,
                  date: dateStr,
                  scanFolder: (p, subs) => window.spotmaster.scanMusicFolder(p, subs),
                  getDuration: readDurationForAutoProg,
                })
                if (generated.length > 0) {
                  generated.forEach(g => {
                    programItems.push({
                      id: crypto.randomUUID(),
                      order: 0,
                      title: g.title,
                      type: 'vinheta' as const,
                      status: 'pending' as const,
                      scheduledTime: slot.scheduledTime,
                      duration: g.duration ?? 0,
                      filePath: g.filePath,
                      mediaType: detectMediaType(g.filePath),
                    })
                  })
                  musicItemsGenerated = true
                }
              } catch (e) {
                console.error('[AutoProg] Erro ao gerar bloco musical:', e)
              }
            }
          }
          if (!musicItemsGenerated) {
            // Sem automação ou sem arquivos: placeholder manual (operador preenche)
            programItems.push({
              id: crypto.randomUUID(),
              order: 0,
              title: slot.title,
              type: 'vinheta' as const,
              status: 'pending' as const,
              scheduledTime: slot.scheduledTime,
              duration: 0,
            })
          }
        } else {
          // Commercial block: expand linked CommercialBlock
          if (!slot.commercialBlockId) continue
          let block = commercialBlocks.find(b => b.id === slot.commercialBlockId && b.enabled)
          if (!block) {
            // Fallback para referência órfã: o bloco linkado foi deletado.
            // Tenta achar um bloco não-linkado no mesmo horário e usar como substituto.
            // Sem isso, o slot fica órfão para sempre e nenhum comercial é puxado.
            const slotHHMM = slot.scheduledTime?.slice(0, 5)
            block = commercialBlocks.find(b =>
              b.enabled &&
              b.scheduledTime?.slice(0, 5) === slotHHMM &&
              !linkedBlockIds.has(b.id)
            )
            if (block) {
              console.warn(`[playout] Slot "${slot.title}" @${slotHHMM}: bloco linkado ${slot.commercialBlockId} não existe mais. Usando "${block.name}" como fallback.`)
              // Marca o bloco fallback como "agora linkado" para o loop 2 não duplicar.
              linkedBlockIds.add(block.id)
            } else {
              console.warn(`[playout] Slot "${slot.title}" @${slotHHMM}: bloco órfão ${slot.commercialBlockId} e sem bloco substituto disponível no mesmo horário.`)
              continue
            }
          }
          const blockWithTime = { ...block, scheduledTime: slot.scheduledTime }
          const [expanded, newRot] = expandBlockItems(blockWithTime, 0, currentRotation)
          if (expanded.length > 0) {
            programItems.push(...expanded)
          } else {
            // Block exists but has no items yet — one placeholder so operator sees it
            programItems.push({
              id: crypto.randomUUID(),
              order: 0,
              title: block.name,
              type: 'spot' as const,
              status: 'pending' as const,
              scheduledTime: slot.scheduledTime,
              duration: 0,
              adBreakId: block.id,
            })
          }
          currentRotation = newRot
        }
      } else {
        // Regular program slot — skip if not configured (no file, no input)
        if (!slot.filePath && !slot.inputName && slot.type !== 'vmix_action') continue
        programItems.push({
          id: crypto.randomUUID(),
          order: 0,
          title: slot.title,
          type: slot.type as import('../types').SpotType,
          status: 'pending' as const,
          scheduledTime: slot.scheduledTime,
          filePath: slot.filePath,
          inputName: slot.inputName,
          duration: slot.duration,
          mediaType: slot.mediaType,
          notes: slot.notes,
          vmixAction: slot.vmixAction,
        })
      }
    }

    // 2. Commercial blocks for today NOT already covered by the schedule slots
    // (linkedBlockIds calculado lá em cima — inclui blocos usados como fallback de órfão)
    const blocksForDay = commercialBlocks.filter(b => {
      if (!b.enabled || linkedBlockIds.has(b.id)) return false
      const days = b.daysOfWeek?.length ? b.daysOfWeek : [0, 1, 2, 3, 4, 5, 6]
      return days.includes(dayOfWeek)
    })

    const blockItems: PlaylistItem[] = []
    for (const block of blocksForDay) {
      const [expanded, newRotation] = expandBlockItems(block, 0, currentRotation)
      blockItems.push(...expanded)
      currentRotation = newRotation
    }

    // 3. Sort newly-generated items by scheduledTime
    const generated = [...programItems, ...blockItems].sort((a, b) =>
      (a.scheduledTime ?? '').localeCompare(b.scheduledTime ?? '')
    )

    const existing = stateRef.current.dateSchedules[dateStr] ?? []

    let finalItems: PlaylistItem[]

    if (merge && existing.length > 0) {
      // ── Merge mode ─────────────────────────────────────────────────────────
      // • Non-commercial items: kept as-is; new times are added.
      // • Commercial block items (adBreakId set): pending ones are REPLACED with
      //   fresh data so edits to a block are immediately reflected. Items already
      //   done/skipped/playing are kept (they already aired).

      // Times that have fresh commercial block data in the new generation
      const freshCommercialTimes = new Set<string>()
      for (const item of generated) {
        if (item.adBreakId) {
          const hhmm = item.scheduledTime?.slice(0, 5)
          if (hhmm) freshCommercialTimes.add(hhmm)
        }
      }

      // Times that have fresh AutoProg music (bloco_musical slots with generated content)
      const freshMusicTimes = new Set<string>()
      for (const item of generated) {
        if (!item.adBreakId && item.filePath) {
          const hhmm = item.scheduledTime?.slice(0, 5)
          if (hhmm) {
            const isMusicSlot = sortedSlots.some(
              s => s.type === 'bloco_musical' && s.scheduledTime?.slice(0, 5) === hhmm,
            )
            if (isMusicSlot) freshMusicTimes.add(hhmm)
          }
        }
      }

      // Keep all non-commercial items + commercial items that have real content.
      // Placeholders (no filePath, no inputName, not a vmix_action) are ALWAYS
      // removed when fresh data is available — even if skipped or done — because
      // they are stubs, not actual aired content.
      // bloco_musical placeholders are also removed when AutoProg generated new content.
      const keptExisting = existing.filter(item => {
        if (!item.adBreakId) {
          // Remove bloco_musical placeholder when AutoProg generated real content
          const hhmm = item.scheduledTime?.slice(0, 5)
          if (hhmm && freshMusicTimes.has(hhmm)) {
            const hasContent = !!(item.filePath || item.inputName || item.type === 'vmix_action')
            if (!hasContent) return false  // remove placeholder, replaced by AutoProg items
          }
          return true
        }
        const hhmm = item.scheduledTime?.slice(0, 5)
        if (!hhmm || !freshCommercialTimes.has(hhmm)) return true
        // Pending items are always replaced by fresh generation
        if (item.status === 'pending') return false
        // Placeholder stubs (no real content) are replaced regardless of status
        const hasContent = !!(item.filePath || item.inputName || item.type === 'vmix_action')
        if (!hasContent) return false
        // Keep done/skipped items that had actual content — they really aired
        return true
      })

      // Times still covered by the kept items (used to avoid duplicating non-commercial items)
      const coveredTimes = new Set(keptExisting.map(i => i.scheduledTime?.slice(0, 5)).filter(Boolean))

      // Horários onde já existem itens comerciais não-pendentes com conteúdo real
      // (tocaram ou estão tocando). Impede adicionar duplicatas ao clicar Atualizar.
      const occupiedCommercialTimes = new Set<string>()
      for (const item of keptExisting) {
        if (!item.adBreakId || item.status === 'pending') continue
        const hasContent = !!(item.filePath || item.inputName || item.type === 'vmix_action')
        if (hasContent) {
          const hhmm = item.scheduledTime?.slice(0, 5)
          if (hhmm) occupiedCommercialTimes.add(hhmm)
        }
      }

      // Deleções intencionais registradas pelo operador para esta data — não re-adicionar.
      const deletedForDate = stateRef.current.deletedScheduleSlots[dateStr] ?? []
      const deletedKeySet = new Set(deletedForDate.map(d => `${d.time}|${d.signature}`))

      // What to add: refreshed commercial items + non-commercial items for brand-new times
      const toAdd = generated.filter(item => {
        const hhmm = item.scheduledTime?.slice(0, 5)
        if (!hhmm) return false
        // Bloqueia tudo que o operador apagou explicitamente
        if (deletedKeySet.has(`${hhmm}|${_scheduleSignature(item)}`)) return false
        if (item.adBreakId) {
          if (occupiedCommercialTimes.has(hhmm)) return false  // bloco já foi ao ar, não duplicar
          return freshCommercialTimes.has(hhmm)
        }
        return !coveredTimes.has(hhmm)                               // non-commercial: only new times
      })

      finalItems = [...keptExisting, ...toAdd]
        .sort((a, b) => (a.scheduledTime ?? '').localeCompare(b.scheduledTime ?? ''))
        .map((item, idx) => ({ ...item, order: idx + 1 }))
    } else {
      // ── Replace mode: build fresh schedule from scratch ────────────────────
      // Mesmo no replace, respeita deleções intencionais do operador para a data.
      const deletedForDate = stateRef.current.deletedScheduleSlots[dateStr] ?? []
      const deletedKeySet = new Set(deletedForDate.map(d => `${d.time}|${d.signature}`))
      finalItems = generated
        .filter(item => {
          const hhmm = item.scheduledTime?.slice(0, 5)
          if (!hhmm) return true
          return !deletedKeySet.has(`${hhmm}|${_scheduleSignature(item)}`)
        })
        .map((item, idx) => ({ ...item, order: idx + 1 }))
    }

    finalItems = finalItems.map(item => {
      if (!item.filePath || item.duration > 0) return item
      const cached = cachedDuration(item.filePath)
      return cached ? { ...item, duration: cached } : item
    })

    // ── Eager batch-read file durations before dispatching ──────────────────
    // Lê em lotes com concorrência limitada (4 paralelos) para evitar saturar
    // o decoder do Chromium em programações grandes (50-100 músicas) — sem o
    // pool, dezenas de leituras simultâneas dão timeout e os itens chegam ao
    // operador com duração 0.
    const _needsDur = finalItems.filter(
      i => i.filePath && (i.duration === 0 || i.duration == null),
    )
    if (_needsDur.length > 0) {
      const _durMap = new Map<string, number>()
      onDurationProgress?.(0, _needsDur.length)
      await readMediaDurationBatch(
        _needsDur,
        (item, dur) => {
          _durMap.set(item.id, dur)
          if (item.filePath) rememberDuration(item.filePath, dur)
        },
        { concurrency: 4, timeoutMs: 15_000, onProgress: onDurationProgress },
      )
      if (_durMap.size > 0) {
        finalItems = finalItems.map(i =>
          _durMap.has(i.id) ? { ...i, duration: _durMap.get(i.id)! } : i,
        )
      }
    }

    // ── Race-condition guard ────────────────────────────────────────────────
    // O batch acima é assíncrono. Se handleRefreshDurations ou o useEffect do
    // DaySchedulePanel atualizou alguma duração via UPDATE_SCHEDULE_ITEM
    // enquanto aguardávamos, stateRef.current já tem esses valores mais recentes.
    // Sem esta etapa, SET_DATE_SCHEDULE sobrescreveria durações já lidas,
    // causando o efeito "tempo aparece e some".
    {
      const _cur = stateRef.current.dateSchedules[dateStr] ?? []
      const _curDur = new Map(_cur.map(i => [i.id, i.duration]))
      finalItems = finalItems.map(i => {
        const latest = _curDur.get(i.id)
        return (latest && latest > 0 && (i.duration === 0 || i.duration == null))
          ? { ...i, duration: latest }
          : i
      })
    }

    flushDurationCacheUpdates()
    dispatch({ type: 'SET_DATE_SCHEDULE', payload: { date: dateStr, items: finalItems } })
    dispatch({ type: 'SET_SPOT_ROTATION', payload: currentRotation })

    // Mark commercial blocks as loaded so the scheduler doesn't duplicate them
    if (dateStr === today()) {
      blocksForDay.forEach(b => {
        dispatch({ type: 'MARK_BLOCK_LOADED', payload: { blockId: b.id, date: dateStr } })
      })
    }
  }, [dispatch, expandBlockItems])

  // ── Midnight watcher ────────────────────────────────────────────────────────
  // Detects day change and auto-generates the schedule from the weekly grid.
  // Commercial blocks are no longer auto-loaded into the playlist — use the
  // "Inserir Bloco Comercial" button in the Playlist tab for manual loading.
  useEffect(() => {
    if (state.isLoading) return
    let lastDay = today()
    const interval = setInterval(() => {
      const currentDay = today()
      if (currentDay !== lastDay) {
        lastDay = currentDay
        generatePlaylistFromGrid(currentDay)
      }
    }, 30_000)
    return () => clearInterval(interval)
  }, [state.isLoading, generatePlaylistFromGrid])

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms))

  const vmixMetaForItem = useCallback((item: PlaylistItem, source = 'playout'): VmixCommandMeta => {
    const queue = activeQueueRef.current
    return {
      source,
      queue: queue === 'playlist' || queue === 'schedule' ? queue : 'system',
      itemId: item.id,
      itemTitle: item.title,
      scheduledTime: item.scheduledTime,
      scheduleDate: queue === 'schedule' ? today() : undefined,
    }
  }, [])

  // Returns the highest input number currently registered in vMix
  const getMaxInputNum = useCallback(async (): Promise<number> => {
    if (!window.spotmaster) return 0
    const st = await requestVmixXml()
    if (!st.success || !st.data) return 0
    const matches = [...st.data.matchAll(/<input\b[^>]*\bnumber="(\d+)"/gi)]
    return matches.reduce((max, m) => Math.max(max, parseInt(m[1])), 0)
  }, [])

  // Polls until a new input (number > prevMax) appears after AddInput.
  // Returns the input's GUID (key attribute) — stable across renumbering.
  // Aceita tanto <input ...>content</input> quanto <input ... /> (self-closing).
  const pollForNewInput = useCallback(async (prevMax: number): Promise<string | null> => {
    for (let attempt = 0; attempt < 50; attempt++) {
      await sleep(200)
      if (!window.spotmaster) return null
      const st = await requestVmixXml()
      if (st.success && st.data) {
        // Match abertura da tag input — não exige </input>, então funciona em ambos os formatos.
        const tags = [...st.data.matchAll(/<input\b([^>]*?)\/?>/gi)]
        for (const tag of tags) {
          const attrs = tag[1]
          const numM = attrs.match(/\bnumber="(\d+)"/i)
          const keyM = attrs.match(/\bkey="([^"]+)"/i)
          if (numM && parseInt(numM[1]) > prevMax && keyM) {
            return keyM[1]  // return GUID — never changes when vMix renumbers
          }
        }
      }
    }
    return null
  }, [])  

  // Polls até o state de um input específico ficar pronto pra tocar.
  // vMix v28/29 mantém state="Loading" enquanto decodifica o arquivo; PlayInput
  // enviado nesse momento é silenciosamente ignorado — daí o sintoma "input
  // adicionado mas não inicia". Esperamos por estados terminais (Paused/Running/Completed).
  const waitForInputReady = useCallback(async (guid: string, timeoutMs = 6000): Promise<boolean> => {
    if (!window.spotmaster) return false
    const start = Date.now()
    while (Date.now() - start < timeoutMs) {
      const st = await requestVmixXml()
      if (st.success && st.data) {
        // Procura a tag input com o key dado e extrai state
        const escaped = guid.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        const re = new RegExp(`<input\\b[^>]*\\bkey="${escaped}"[^>]*\\bstate="([^"]*)"`, 'i')
        const m = st.data.match(re)
        if (m) {
          const state = m[1]
          // Loading = ainda decodificando. Empty = falhou. Qualquer outro = pronto.
          if (state && state !== 'Loading' && state !== 'Empty') return true
        }
      }
      await sleep(150)
    }
    return false
  }, [])

  // Polls até o state virar Running (clip efetivamente tocando) ou a position avançar.
  // Usado logo após PlayInput para confirmar que o vMix aceitou o comando.
  const waitForInputPlaying = useCallback(async (guid: string, timeoutMs = 1200): Promise<boolean> => {
    if (!window.spotmaster) return false
    const start = Date.now()
    const escaped = guid.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const re = new RegExp(`<input\\b[^>]*\\bkey="${escaped}"[^>]*\\bstate="([^"]*)"[^>]*\\bposition="(\\d+)"`, 'i')
    while (Date.now() - start < timeoutMs) {
      const st = await requestVmixXml()
      if (st.success && st.data) {
        const m = st.data.match(re)
        if (m) {
          const state = m[1]
          const pos = parseInt(m[2] || '0')
          if (state === 'Running' || pos > 0) return true
        }
      }
      await sleep(100)
    }
    return false
  }, [])

  // Loads a file as a new input in vMix.
  // Returns the input's GUID (stable — never changes when vMix renumbers).
  const loadNewInput = useCallback(async (filePath: string, meta?: VmixCommandMeta): Promise<string | null> => {
    if (!window.spotmaster) return null
    const ext = filePath.split('.').pop()?.toLowerCase() ?? ''
    const isImage = ['jpg','jpeg','png','gif','bmp','webp','tiff','tif','ico'].includes(ext)
    const isAudio = ['mp3','wav','aac','ogg','flac','m4a','wma','opus','aiff'].includes(ext)
    const vmixType = isImage ? 'Image' : isAudio ? 'AudioFile' : 'Video'

    const prevMax = await getMaxInputNum()
    await executeVmixCommand('AddInput', {
      value: `${vmixType}|${filePath}`,
      meta: { source: 'load-input', ...meta },
    })
    const guid = await pollForNewInput(prevMax)  // returns GUID
    if (!guid) return null
    spotmasterGuidsRef.current.add(guid)  // register so we can clean up later
    // Aguarda o vMix terminar de carregar/decodar o arquivo antes de tocar.
    // Sem isso, PlayInput pode chegar enquanto state="Loading" e ser ignorado
    // silenciosamente — o input aparece no vMix mas não inicia a reprodução.
    if (!isImage) {
      const ready = await waitForInputReady(guid, 6000)
      if (!ready) {
        // Fallback: dá mais tempo absoluto pra arquivos lentos antes de desistir
        await sleep(1000)
      }
      await executeVmixCommand('SetPosition', {
        input: guid,
        value: '0',
        meta: { source: 'load-input', ...meta },
      })
    }
    return guid
  }, [getMaxInputNum, pollForNewInput, waitForInputReady])  

  // ── cleanupInputs ───────────────────────────────────────────────────────────
  // Removes the active input (by GUID) from vMix after delayMs.
  const cleanupInputs = useCallback((delayMs = 0) => {
    const toRemove = activeInputRef.current
    activeInputRef.current = ''
    if (!toRemove || !window.spotmaster) return
    setTimeout(async () => {
      if (window.spotmaster) {
        await executeVmixCommand('RemoveInput', {
          input: toRemove,
          meta: { source: 'cleanup-input', queue: 'system' },
        })
      }
    }, delayMs)
  }, [])  

  // ── playItem ────────────────────────────────────────────────────────────────
  // Sends ONE item to air and awaits until it finishes playing.
  // This function is strictly serial — it never runs concurrently with itself.
  // loadNewInput is called here (not in background) to prevent slot collisions.
  const playItem = useCallback(async (item: PlaylistItem, nextFilePath?: string) => {
    if (!window.spotmaster) return

    // Placeholder items (no file, no vMix input, not a vmix_action) have no
    // playable content — skip instantly rather than producing silence.
    if (!item.filePath && !item.inputName && item.type !== 'vmix_action' && item.type !== 'pause') {
      updateQueueItem({ ...item, status: 'skipped' })
      return
    }

    updateQueueItem({ ...item, status: 'playing' })
    const actualTime = now()

    // ── Ação vMix (comando instantâneo, sem mídia) ───────────────────────────
    // Executa o comando HTTP no vMix, aguarda 150ms e marca como done.
    // Não entra no loop de wall-clock nem afeta o input ativo no ar.
    if (item.type === 'vmix_action' && item.vmixAction) {
      const { function: fn, input, value } = item.vmixAction
      const commandResult = await executeVmixAction(item.vmixAction, vmixMetaForItem(item, 'vmix-action-item'))
      if (!commandResult.success) {
        dispatch({
          type: 'ADD_LOG',
          payload: {
            id: crypto.randomUUID(),
            date: new Date().toISOString().slice(0, 10),
            itemId: item.id,
            title: item.title,
            actualTime,
            duration: 0,
            status: 'error',
            notes: `vMix: ${fn} falhou - ${commandResult.error ?? 'erro desconhecido'}`,
          } as PlayLog,
        })
        updateQueueItem({ ...item, status: 'error' })
        return
      }
      await sleep(150)
      dispatch({
        type: 'ADD_LOG',
        payload: {
          id: crypto.randomUUID(),
          date: new Date().toISOString().slice(0, 10),
          itemId: item.id,
          title: item.title,
          actualTime,
          duration: 0,
          status: 'aired',
          notes: `vMix: ${fn}${input ? ` → ${input}` : ''}${value ? ` (${value})` : ''}`,
        } as PlayLog,
      })
      updateQueueItem({ ...item, status: 'done' })
      return
    }

    const { vmixStatus } = stateRef.current
    let onAirInput = ''

    // ── vMix offline guard ───────────────────────────────────────────────────
    // If vMix is unreachable and the item requires vMix (file or named input),
    // log an error immediately instead of silently skipping without any record.
    if (!vmixStatus.connected && (item.filePath || item.inputName)) {
      dispatch({
        type: 'ADD_LOG',
        payload: {
          id: crypto.randomUUID(),
          date: new Date().toISOString().slice(0, 10),
          itemId: item.id,
          title: item.title,
          clientId: item.clientId,
          clientName: item.clientName,
          campaignId: item.campaignId,
          scheduledTime: item.scheduledTime,
          actualTime,
          duration: 0,
          status: 'error',
          notes: 'vMix offline — item não enviado ao ar',
        } as PlayLog,
      })
      updateQueueItem({ ...item, status: 'error' })
      return
    }

    if (vmixStatus.connected) {
      const itemMeta = vmixMetaForItem(item, 'playout')
      if (item.filePath) {
        // Use a preloaded GUID if available for this exact file (eliminates gap between items).
        // Otherwise fall back to loading now (same behaviour as before this feature).
        let guid: string | null
        const cached = preloadedInputRef.current
        const cachedAlreadyOnAir = !!(cached?.alreadyOnAir)  // set by skipToNext
        if (cached?.filePath === item.filePath) {
          guid = cached.guid
          preloadedInputRef.current = null
          console.log(`[SpotMaster] using preloaded input for "${item.title}"${cachedAlreadyOnAir ? ' (already on air via Next)' : ''}`)
        } else {
          if (cached) {
            // Stale preload (e.g. playlist was reordered) — discard safely
            console.warn(`[SpotMaster] discarding stale preload: "${cached.filePath}"`)
            const staleGuid = cached.guid
            preloadedInputRef.current = null
            executeVmixCommand('RemoveInput', {
              input: staleGuid,
              meta: { ...itemMeta, source: 'discard-stale-preload' },
            })
          }
          guid = await loadNewInput(item.filePath, itemMeta)
        }

        if (guid) {
          const ext = item.filePath.split('.').pop()?.toLowerCase() ?? ''
          const isImg = ['jpg','jpeg','png','gif','bmp','webp','tiff','tif','ico'].includes(ext)

          if (!cachedAlreadyOnAir) {
            // Ordem correta para vMix 28+:
            //   1) PreviewInput  → input vai pro PVW
            //   2) Cut           → PVW vira PGM (input visível mas ainda Paused se for vídeo/áudio)
            //   3) PlayInput     → só agora o clip começa a reproduzir
            // Enviar PlayInput ANTES de o input estar no Program faz o vMix descartá-lo
            // silenciosamente em algumas versões — sintoma: "input vai pra play e não roda".
            await executeVmixCommand('PreviewInput', { input: guid, meta: itemMeta })
            await sleep(150)
            await executeVmixCommand('Cut', { meta: itemMeta })
            await sleep(150)
            if (!isImg) {
              await executeVmixCommand('PlayInput', { input: guid, meta: itemMeta })
              await sleep(200)
              // Verifica se o input realmente saiu de Paused. Se não, manda um 2º PlayInput.
              // Isso cobre o caso raro de vMix descartar o primeiro logo após o Cut.
              const ok = await waitForInputPlaying(guid, 1200)
              if (!ok) {
                await executeVmixCommand('PlayInput', {
                  input: guid,
                  meta: { ...itemMeta, source: 'playout-retry' },
                })
              }
            }

            // Remove the PREVIOUS input 5 s after the cut.
            // Delayed so the previous audio finishes fading out; GUID-based so
            // vMix renumbering never removes the wrong input.
            const prevGuid = activeInputRef.current
            if (prevGuid) {
              setTimeout(async () => {
                if (window.spotmaster) {
                  await executeVmixCommand('RemoveInput', {
                    input: prevGuid,
                    meta: { ...itemMeta, source: 'remove-previous-input' },
                  })
                }
              }, 5000)
            }

            activeInputRef.current = guid
          }
          // When alreadyOnAir=true, skipToNext already handled Cut + activeInputRef

          onAirInput = guid
        } else {
          // File failed to load (not found or vMix rejected AddInput).
          // Log immediately as error and return — no dead-air wait, no false 'aired' entry.
          dispatch({
            type: 'ADD_LOG',
            payload: {
              id: crypto.randomUUID(),
              date: new Date().toISOString().slice(0, 10),
              itemId: item.id,
              title: item.title,
              clientId: item.clientId,
              clientName: item.clientName,
              campaignId: item.campaignId,
              scheduledTime: item.scheduledTime,
              actualTime,
              duration: 0,
              status: 'error',
              notes: 'Arquivo não encontrado ou falha ao carregar no vMix',
            } as PlayLog,
          })
          updateQueueItem({ ...item, status: 'error' })
          return
        }

      } else if (item.inputName) {
        // ── vMix permanent input (camera, graphic, etc.) ─────────────────────
        // SpotMaster NEVER calls RemoveInput on these — they belong to the user's
        // vMix project. Only PlayInput / PreviewInput / Cut are allowed.
        //
        // If the previous item was a SpotMaster-loaded file (GUID in activeInputRef),
        // remove it now (with a 5 s grace period so audio fades out cleanly).
        const prevGuid = activeInputRef.current
        if (prevGuid) {
          setTimeout(async () => {
            if (window.spotmaster) {
              await executeVmixCommand('RemoveInput', {
                input: prevGuid,
                meta: { ...itemMeta, source: 'remove-previous-input' },
              })
            }
          }, 5000)
        }
        // Clear the ref — this input is permanent and must NEVER be auto-removed.
        activeInputRef.current = ''

        await executeVmixCommand('SetPosition', { input: item.inputName, value: '0', meta: itemMeta })
        await executeVmixCommand('PlayInput', { input: item.inputName, meta: itemMeta })
        await executeVmixCommand('PreviewInput', { input: item.inputName, meta: itemMeta })
        await sleep(100)
        await executeVmixCommand('Cut', { meta: itemMeta })
        onAirInput = item.inputName
        // activeInputRef intentionally left as '' — permanent inputs are not owned by SpotMaster
      }
    }

    // ── GC Musical automático ─────────────────────────────────────────────────
    // Dispara SetText no input de título do vMix após um delay configurável.
    // Nunca dispara em itens de blocos comerciais (adBreakId presente).
    {
      const gc = stateRef.current.settings
      if (
        gc.gcMusicEnabled &&
        gc.gcMusicInputName &&
        !item.adBreakId &&
        item.type !== 'vmix_action' &&
        item.type !== 'pause' &&
        item.filePath &&
        !abortRef.current
      ) {
        const delayMs = (gc.gcMusicDelaySeconds ?? 5) * 1000
        setTimeout(async () => {
          if (abortRef.current) return
          const s = stateRef.current.settings
          const rawTitle = item.title ?? ''
          const sep = rawTitle.indexOf(' - ')
          const artist = sep >= 0 ? rawTitle.slice(0, sep).trim() : rawTitle.trim()
          const song   = sep >= 0 ? rawTitle.slice(sep + 3).trim() : ''
          const line1  = artist
          const line2  = s.gcMusicDynamic ? song : (s.gcMusicStaticLine2 ?? '')
          const inp    = s.gcMusicInputName
          if (!inp) return
          const gcMeta = { source: 'gc-musical' as const, risk: 'low' as const }
          // validate:false porque valor vazio ('') é intencional para limpar o campo
          await executeVmixCommand('SetText', { input: inp, selectedName: s.gcMusicLine1Field || 'Artist', value: line1 || ' ', meta: gcMeta, validate: false })
          await executeVmixCommand('SetText', { input: inp, selectedName: s.gcMusicLine2Field || 'Title',  value: line2 || ' ', meta: gcMeta, validate: false })
          const ch = s.gcMusicOverlay ?? 0
          if (ch > 0) {
            await executeVmixCommand(`OverlayInput${ch}In`, { input: inp, meta: gcMeta })
            const hide = s.gcMusicHideDuration ?? 0
            if (hide > 0) {
              setTimeout(async () => {
                if (abortRef.current) return
                await executeVmixCommand(`OverlayInput${ch}Off`, { meta: gcMeta })
              }, hide * 1000)
            }
          }
        }, delayMs)
      }
    }

    dispatch({
      type: 'ADD_LOG',
      payload: {
        id: crypto.randomUUID(),
        date: new Date().toISOString().slice(0, 10),
        itemId: item.id,
        title: item.title,
        clientId: item.clientId,
        clientName: item.clientName,
        campaignId: item.campaignId,
        scheduledTime: item.scheduledTime,
        actualTime,
        duration: item.duration,
        status: 'aired',
        inputName: onAirInput,
      } as PlayLog,
    })

    // ── Wait for the clip to finish ─────────────────────────────────────────
    // Use wall-clock for all timing. If item.duration is 0 or missing, try
    // to read the real duration from vMix (reported after the input buffers).
    {
      let durationSec = item.duration ?? 0
      if (durationSec <= 0 && onAirInput && window.spotmaster) {
        // vMix already buffered the input (we slept 1s in loadNewInput).
        // Re-read the XML to get the real duration.
        const st = await requestVmixXml()
        if (st.success && st.data) {
          const tags = [...st.data.matchAll(/<input\s([^>]*)>/gi)]
          for (const tag of tags) {
            const keyM = tag[1].match(/\bkey="([^"]+)"/i)
            const durM = tag[1].match(/\bduration="(\d+)"/i)
            if (keyM && keyM[1] === onAirInput && durM) {
              durationSec = parseInt(durM[1]) / 1000
              // Persist the real duration so block headers always show total time
              if (activeQueueRef.current === 'schedule' && durationSec > 0) {
                const liveItem = getQueue().find(i => i.id === item.id)
                if (liveItem) {
                  dispatch({
                    type: 'UPDATE_SCHEDULE_ITEM',
                    payload: { date: today(), item: { ...liveItem, duration: durationSec } },
                  })
                }
              }
              break
            }
          }
        }
      }
      // Absolute minimum 3 s so a misconfigured item doesn't flash past.
      const totalMs = Math.max(durationSec * 1000, 3000)
      console.log(`[SpotMaster] playing "${item.title}" — duration: ${durationSec}s (${totalMs}ms)`)
      const start = Date.now()
      let preloadTriggered = false
      while (Date.now() - start < totalMs) {
        if (abortRef.current) break
        const elapsed = Date.now() - start
        setPlaybackProgress({
          inputNum: onAirInput || 'clock',
          position: elapsed,
          duration: totalMs,
        })
        // ── Anticipatory preload ─────────────────────────────────────────────
        // Start loading the next file-based item ~10 s before this one ends.
        // The GUID is stored in preloadedInputRef so playItem can use it
        // instantly instead of waiting for AddInput + buffer (~1.5-2 s).
        if (!preloadTriggered && nextFilePath && window.spotmaster) {
          const remaining = totalMs - elapsed
          if (remaining <= 10000) {
            preloadTriggered = true
            const fpToLoad = nextFilePath
            console.log(`[SpotMaster] preloading next: "${fpToLoad}" (${(remaining / 1000).toFixed(1)}s remaining)`)
            loadNewInput(fpToLoad, {
              source: 'preload-next-input',
              queue: activeQueueRef.current === 'schedule' ? 'schedule' : 'playlist',
            }).then(preGuid => {
              if (!preGuid) return
              if (abortRef.current) {
                // Playback was stopped while we were loading — discard immediately
                executeVmixCommand('RemoveInput', {
                  input: preGuid,
                  meta: { source: 'discard-aborted-preload', queue: 'system' },
                })
              } else {
                preloadedInputRef.current = { guid: preGuid, filePath: fpToLoad }
              }
            })
          }
        }
        await sleep(300)
      }
    }

    setPlaybackProgress(null)

    // Mark done. Items interrupted by a scheduled block go 'done' —
    // playout always moves forward, never returns to what was playing.
    const fresh = getQueue().find(i => i.id === item.id)
    if (fresh && fresh.status !== 'done' && fresh.status !== 'skipped') {
      updateQueueItem({ ...fresh, status: 'done' })
    }
  }, [dispatch, loadNewInput, waitForInputPlaying, vmixMetaForItem])

  // ── runSequence ─────────────────────────────────────────────────────────────
  // Infinite while-loop that reads the LIVE playlist on every iteration.
  // This means:
  //   - Items added DURING playback are picked up automatically.
  //   - The sequence only stops when there are genuinely no more pending items
  //     (or stopPlayback() sets abortRef).
  const runSequence = useCallback(async () => {
    while (true) {
      // ── Handle abort ─────────────────────────────────────────────────────
      if (abortRef.current) {
        if (!scheduleInterruptRef.current && !disparoInterruptRef.current) break
        abortRef.current = false
        scheduleInterruptRef.current = false
        disparoInterruptRef.current = false
      }

      // ── Read live queue (playlist or daySchedule) ────────────────────────
      const pending = getQueue().filter(i => i.status === 'pending')
      if (pending.length === 0) break

      const currentTime = now()
      const { autoPlay, autoplayComerciais } = stateRef.current.settings
      const isSchedule = activeQueueRef.current === 'schedule'
      // Itens com prioridade de horário (saltar à frente no horário programado):
      //   - comerciais (adBreakId): SOMENTE quando rodando a Programação E autoplayComerciais ON
      //   - itens gerais: depende do autoPlay (qualquer fila)
      // A Playlist é manual: blocos comerciais nela NUNCA pulam à frente automaticamente.
      const scheduledDue = pending
        .filter(i => {
          if (!i.scheduledTime || i.scheduledTime > currentTime) return false
          if (i.adBreakId) return isSchedule && autoplayComerciais
          return autoPlay
        })
        .sort((a, b) => {
          const timeCmp = (a.scheduledTime ?? '').localeCompare(b.scheduledTime ?? '')
          return timeCmp !== 0 ? timeCmp : a.order - b.order
        })

      // When a scheduled item becomes due, advance the playback pointer:
      // - Commercial block (adBreakId): advance the high-water mark so items from
      //   the interrupted musical block are bypassed. They stay 'pending' visually
      //   (operator can see what wasn't played) but the sequence moves forward.
      // - Generic time-jump (e.g. autoPlay recovering from a long pause): mark
      //   items before the due item as 'skipped' as before.
      if (scheduledDue.length > 0) {
        const firstDue = scheduledDue[0]
        if (firstDue.adBreakId) {
          // Commercial fires: advance high-water mark, do NOT mark anything skipped.
          minOrderRef.current = Math.max(minOrderRef.current, firstDue.order)
        } else {
          const toSkip = pending.filter(i => i.order < firstDue.order)
          if (toSkip.length > 0) {
            toSkip.forEach(i => updateQueueItem({ ...i, status: 'skipped' }))
            await sleep(150)
            continue
          }
        }
      }

      // After a commercial interrupt, always continue with the next pending item —
      // broadcast automation never stops mid-schedule. The sequence only stops when
      // there are no more pending items (natural end), a Pause marker, or Stop button.
      // Release the "due-items-only" constraint so the next block plays immediately.
      if (
        activeQueueRef.current === 'schedule' &&
        (autoPlay || autoplayComerciais) &&
        scheduledDue.length === 0 &&
        scheduleInterruptTimeRef.current !== ''
      ) {
        scheduleInterruptTimeRef.current = ''
        commInterruptTimeRef.current = ''
        // Don't break — fall through and pick the next pending item by order
      }

      // Apply high-water mark: only consider items at or above the mark.
      // Items below the mark stay 'pending' in the UI but are not played.
      const candidatePending = minOrderRef.current > -1
        ? pending.filter(i => i.order >= minOrderRef.current)
        : pending
      const next = scheduledDue[0] ?? [...candidatePending].sort((a, b) => a.order - b.order)[0]
      // Guard: all remaining pending items are in blocks the scheduler bypassed — end naturally.
      if (!next) break

      // Pause marker — stop the sequence exactly like a natural end.
      // All vMix inputs are cleaned up and isSequencePlaying goes false.
      // The operator restarts manually when ready.
      if (next.type === 'pause') {
        updateQueueItem({ ...next, status: 'done' })
        break
      }

      // Instantly skip items with no playable content (no file, no vMix input, not a vMix action).
      // These are empty musical slots that the operator hasn't filled yet.
      if (!next.filePath && !next.inputName && next.type !== 'vmix_action') {
        updateQueueItem({ ...next, status: 'skipped' })
        await sleep(50)
        continue
      }

      // Look ahead: find the next file-based pending item so playItem can preload it
      const pendingByOrder = [...pending].sort((a, b) => a.order - b.order)
      const afterNext = pendingByOrder.find(i => i.order > next.order && !!i.filePath)

      try {
        await playItem(next, afterNext?.filePath)
      } catch (err) {
        console.error('[SpotMaster] playItem error for "' + next.title + '":', err)
        const stale = getQueue().find(i => i.id === next.id)
        if (stale && stale.status !== 'done' && stale.status !== 'skipped') {
          updateQueueItem({ ...stale, status: 'error' })
        }
        dispatch({
          type: 'ADD_LOG',
          payload: {
            id: crypto.randomUUID(),
            date: new Date().toISOString().slice(0, 10),
            itemId: next.id,
            title: next.title,
            clientId: next.clientId,
            clientName: next.clientName,
            campaignId: next.campaignId,
            scheduledTime: next.scheduledTime,
            actualTime: now(),
            duration: 0,
            status: 'error',
            notes: String(err),
          } as PlayLog,
        })
      }

      // Stop Next: if armed, break after this item finishes (do not advance to next item).
      if (stopAfterCurrentRef.current) {
        stopAfterCurrentRef.current = false
        break
      }

      await sleep(200)
    }

    // Sequence fully ended — clean up
    scheduleInterruptTimeRef.current = ''
    commInterruptTimeRef.current = ''
    minOrderRef.current = -1
    dispatch({ type: 'SET_SEQUENCE_PLAYING', payload: false })
    setPlaybackProgress(null)

    // Discard any preloaded input that was never used (sequence ended before it played)
    const unusedPreload = preloadedInputRef.current
    if (unusedPreload) {
      preloadedInputRef.current = null
      if (window.spotmaster) {
        executeVmixCommand('RemoveInput', {
          input: unusedPreload.guid,
          meta: { source: 'discard-unused-preload', queue: 'system' },
        })
      }
    }

    // cleanupInputs reads activeInputRef internally, then zeros it.
    // Do NOT zero activeInputRef before this call or it will remove nothing.
    if (!abortRef.current) cleanupInputs(5000)
    else activeInputRef.current = ''

    // Full sweep: remove every GUID loaded by SpotMaster this session.
    // This catches any input that escaped individual cleanup (abort, error, etc.)
    // and prevents ghost inputs from accumulating in the vMix project.
    // Permanent vMix inputs are never in this Set — they are 100% safe.
    if (window.spotmaster) {
      const allGuids = [...spotmasterGuidsRef.current]
      spotmasterGuidsRef.current.clear()
      for (const g of allGuids) {
        executeVmixCommand('RemoveInput', {
          input: g,
          meta: { source: 'sequence-full-sweep', queue: 'system' },
        })
      }
    }

    if (window.spotmaster) window.spotmaster.vmixStopFastPolling()
  }, [dispatch, playItem, loadNewInput, cleanupInputs]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Sequence controls ──────────────────────────────────────────────────────
  const startSequence = useCallback(() => {
    if (stateRef.current.isSequencePlaying) return
    const hasPending = stateRef.current.playlist.some(i => i.status === 'pending')
    if (!hasPending) return
    activeQueueRef.current = 'playlist'
    abortRef.current = false
    scheduleInterruptRef.current = false
    dispatch({ type: 'SET_SEQUENCE_PLAYING', payload: true })
    if (window.spotmaster) {
      window.spotmaster.vmixStartFastPolling(
        stateRef.current.settings.vmixHost,
        stateRef.current.settings.vmixPort
      )
    }
    runSequence()
  }, [dispatch, runSequence])

  // Inicia a programação a partir do bloco cujo horário é o mais próximo
  // do horário atual (sem ultrapassar). Itens de blocos anteriores são
  // marcados como 'skipped' antes de iniciar o runSequence.
  const startScheduleFromNow = useCallback(() => {
    if (stateRef.current.isSequencePlaying) return

    const todayStr = today()
    const schedule = stateRef.current.dateSchedules[todayStr] ?? []

    const d = new Date()
    const nowHHMM = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`

    // Unique block times sorted ascending
    const blockTimes = [...new Set(
      schedule.map(i => i.scheduledTime?.slice(0, 5) ?? '00:00'),
    )].sort()

    // Latest block at or before now (the "current" block)
    const currentBlockTime = blockTimes.filter(t => t <= nowHHMM).pop()

    let updatedSchedule = schedule
    if (currentBlockTime) {
      updatedSchedule = schedule.map(item => ({
        ...item,
        status: (item.scheduledTime?.slice(0, 5) ?? '00:00') < currentBlockTime
          && item.status === 'pending'
            ? ('skipped' as const)
            : item.status,
      }))
      // Update stateRef immediately so runSequence reads the correct data
      stateRef.current = {
        ...stateRef.current,
        dateSchedules: { ...stateRef.current.dateSchedules, [todayStr]: updatedSchedule },
      }
      dispatch({ type: 'SET_DATE_SCHEDULE', payload: { date: todayStr, items: updatedSchedule } })
    }

    if (!updatedSchedule.some(i => i.status === 'pending')) return

    dispatch({ type: 'SET_SEQUENCE_PLAYING', payload: true })
    activeQueueRef.current = 'schedule'
    abortRef.current = false
    if (window.spotmaster) {
      window.spotmaster.vmixStartFastPolling(
        stateRef.current.settings.vmixHost,
        stateRef.current.settings.vmixPort
      )
    }
    runSequence()
  }, [dispatch, runSequence])

  // Inicia a partir de um item específico (direito no card → "Iniciar daqui").
  // Itens ANTES do alvo (por order) são marcados 'skipped'.
  // O item alvo é forçado para 'pending'. Funciona mesmo com a sequência ativa.
  const startScheduleFromItem = useCallback(async (itemId: string) => {
    const todayStr = today()
    const schedule = stateRef.current.dateSchedules[todayStr] ?? []
    const target   = schedule.find(i => i.id === itemId)
    if (!target) return

    const isPlaying = stateRef.current.isSequencePlaying

    // Build desired schedule: skip items before target, ensure target is pending
    const updatedSchedule = schedule.map(item => {
      if (item.id === itemId) return { ...item, status: 'pending' as const }
      if (item.order < target.order && (item.status === 'pending' || item.status === 'playing')) {
        return { ...item, status: 'skipped' as const }
      }
      return item
    })

    if (isPlaying) {
      // Signal abort — playItem's progress loop checks this every 300 ms
      abortRef.current = true
      scheduleInterruptRef.current  = false
      disparoInterruptRef.current   = false
      dispatch({ type: 'SET_SEQUENCE_PLAYING', payload: false })
      // Wait for playItem to finish its cycle and runSequence to exit
      await new Promise(r => setTimeout(r, 450))
    }

    // Apply the new schedule to stateRef immediately so runSequence reads it
    stateRef.current = {
      ...stateRef.current,
      isSequencePlaying: false,
      dateSchedules: { ...stateRef.current.dateSchedules, [todayStr]: updatedSchedule },
    }
    dispatch({ type: 'SET_DATE_SCHEDULE', payload: { date: todayStr, items: updatedSchedule } })

    if (!updatedSchedule.some(i => i.status === 'pending')) return

    await new Promise(r => setTimeout(r, 50))
    dispatch({ type: 'SET_SEQUENCE_PLAYING', payload: true })
    activeQueueRef.current = 'schedule'
    abortRef.current = false
    if (window.spotmaster) {
      window.spotmaster.vmixStartFastPolling(
        stateRef.current.settings.vmixHost,
        stateRef.current.settings.vmixPort
      )
    }
    runSequence()
  }, [dispatch, runSequence])

  // Para a sequência e mantém o item atual como 'pending' para retomar depois.
  const pauseSchedule = useCallback(() => {
    if (!stateRef.current.isSequencePlaying) return

    const todayStr     = today()
    const schedule     = stateRef.current.dateSchedules[todayStr] ?? []
    const playingId    = schedule.find(i => i.status === 'playing')?.id
    const activeInput  = activeInputRef.current

    // Pause vMix input if possible (media files support Pause)
    if (window.spotmaster && activeInput) {
      executeVmixCommand('Pause', {
        input: activeInput,
        meta: { source: 'pause-schedule', queue: 'schedule' },
      }).catch(() => {})
    }

    // Stop the sequence engine
    abortRef.current = true
    scheduleInterruptRef.current = false
    disparoInterruptRef.current  = false
    dispatch({ type: 'SET_SEQUENCE_PLAYING', payload: false })
    if (window.spotmaster) window.spotmaster.vmixStopFastPolling()

    // After playItem finishes cleanup (~300 ms), reset the paused item to pending
    // so the user can resume with "Iniciar daqui" or "Iniciar Programação"
    if (playingId) {
      setTimeout(() => {
        const fresh = stateRef.current.dateSchedules[todayStr] ?? []
        const updated = fresh.map(item => ({
          ...item,
          status: item.id === playingId && (item.status === 'done' || item.status === 'playing')
            ? 'pending' as const
            : item.status,
        }))
        stateRef.current = {
          ...stateRef.current,
          dateSchedules: { ...stateRef.current.dateSchedules, [todayStr]: updated },
        }
        dispatch({ type: 'SET_DATE_SCHEDULE', payload: { date: todayStr, items: updated } })
      }, 450)
    }
  }, [dispatch])

  const startSchedule = useCallback(() => {
    if (stateRef.current.isSequencePlaying) return
    const hasPending = (stateRef.current.dateSchedules[today()] ?? []).some(i => i.status === 'pending')
    if (!hasPending) return
    activeQueueRef.current = 'schedule'
    abortRef.current = false
    scheduleInterruptRef.current = false
    dispatch({ type: 'SET_SEQUENCE_PLAYING', payload: true })
    if (window.spotmaster) {
      window.spotmaster.vmixStartFastPolling(
        stateRef.current.settings.vmixHost,
        stateRef.current.settings.vmixPort
      )
    }
    runSequence()
  }, [dispatch, runSequence])

  const stopPlayback = useCallback(async () => {
    abortRef.current = true
    scheduleInterruptRef.current = false
    scheduleInterruptTimeRef.current = ''
    commInterruptTimeRef.current = ''
    minOrderRef.current = -1
    stopAfterCurrentRef.current = false
    dispatch({ type: 'SET_SEQUENCE_PLAYING', payload: false })
    setPlaybackProgress(null)
    if (window.spotmaster) {
      await window.spotmaster.vmixStopFastPolling()
      // Discard any in-progress preload so it doesn't linger in vMix
      const pre = preloadedInputRef.current
      if (pre) {
        preloadedInputRef.current = null
        executeVmixCommand('RemoveInput', {
          input: pre.guid,
          meta: { source: 'stop-discard-preload', queue: 'system' },
        })
      }
      cleanupInputs(0)
      // Full sweep: remove every GUID loaded by SpotMaster this session.
      // Catches anything that escaped individual cleanup on abort/stop.
      const allGuids = [...spotmasterGuidsRef.current]
      spotmasterGuidsRef.current.clear()
      for (const g of allGuids) {
        executeVmixCommand('RemoveInput', {
          input: g,
          meta: { source: 'stop-full-sweep', queue: 'system' },
        })
      }
    }
    getQueue()
      .filter(i => i.status === 'playing')
      .forEach(i => updateQueueItem({ ...i, status: 'pending' }))
  }, [dispatch, cleanupInputs])  

  // ── skipToNext ───────────────────────────────────────────────────────────────
  // Manual "Next" button: loads the next pending item into vMix Preview, lets
  // the current media continue playing for 3 seconds, then cuts to it.
  // Uses disparoInterruptRef so runSequence keeps going after the abort.
  const skipToNext = useCallback(async () => {
    if (!stateRef.current.isSequencePlaying) return
    if (!window.spotmaster) return

    const dateStr = today()
    const schedule = stateRef.current.dateSchedules[dateStr] ?? []
    const playingIdx = schedule.findIndex(i => i.status === 'playing')
    const nextPending = schedule
      .slice(playingIdx >= 0 ? playingIdx + 1 : 0)
      .find(i => i.status === 'pending')

    if (!nextPending?.filePath) {
      // No next media item — just advance naturally
      disparoInterruptRef.current = true
      abortRef.current = true
      return
    }

    const nextMeta = vmixMetaForItem(nextPending, 'manual-next')
    const nextGuid = await loadNewInput(nextPending.filePath, nextMeta)
    if (!nextGuid) {
      disparoInterruptRef.current = true
      abortRef.current = true
      return
    }

    const ext = nextPending.filePath.split('.').pop()?.toLowerCase() ?? ''
    const isImg   = ['jpg','jpeg','png','gif','bmp','webp','tiff','tif','ico'].includes(ext)
    const isAudio = ['mp3','wav','aac','m4a','flac','ogg','wma','opus','aiff','aif'].includes(ext)

    // Start playing the new input in preview — current media stays on Program
    if (!isImg && !isAudio) {
      await executeVmixCommand('PlayInput', { input: nextGuid, meta: nextMeta })
    }

    // 3-second crossfade window — current audio/video continues
    await sleep(3000)

    // Cut to new input
    await executeVmixCommand('PreviewInput', { input: nextGuid, meta: nextMeta })
    await sleep(100)
    await executeVmixCommand('Cut', { meta: nextMeta })
    if (isAudio) {
      await sleep(500)
      await executeVmixCommand('PlayInput', { input: nextGuid, meta: nextMeta })
    }

    // Remove previous input after 5s grace
    const prevGuid = activeInputRef.current
    if (prevGuid) {
      setTimeout(async () => {
        if (window.spotmaster) {
          await executeVmixCommand('RemoveInput', {
            input: prevGuid,
            meta: { ...nextMeta, source: 'manual-next-remove-previous' },
          })
        }
      }, 5000)
    }

    // Mark as already on air — playItem will skip load+cut
    activeInputRef.current = nextGuid
    preloadedInputRef.current = { guid: nextGuid, filePath: nextPending.filePath, alreadyOnAir: true }

    // Interrupt current playItem wait loop; runSequence keeps running
    disparoInterruptRef.current = true
    abortRef.current = true
  }, [loadNewInput, vmixMetaForItem])

  // ── setStopAfterCurrent ─────────────────────────────────────────────────────
  // Arms the "Stop Next" feature: runSequence will break after the current item
  // finishes, instead of advancing to the next one. Passing false disarms it.
  const setStopAfterCurrent = useCallback((v: boolean) => {
    stopAfterCurrentRef.current = v
  }, [])

  // ── disparo ─────────────────────────────────────────────────────────────────
  // Global trigger command: starts sequence if idle, or advances to next item
  // if already playing. Called by the global keyboard shortcut (trigger-fired).
  const disparo = useCallback(() => {
    if (stateRef.current.isSequencePlaying) {
      disparoInterruptRef.current = true
      abortRef.current = true
    } else {
      // Start whichever queue the operator last used (or playlist as default)
      if (activeQueueRef.current === 'schedule') {
        startSchedule()
      } else {
        startSequence()
      }
    }
  }, [startSequence, startSchedule])  

  // ── playSingleItem ──────────────────────────────────────────────────────────
  const playSingleItem = useCallback(() => {
    if (stateRef.current.isSequencePlaying) return
    const first = [...stateRef.current.playlist]
      .sort((a, b) => a.order - b.order)
      .find(i => i.status === 'pending')
    if (!first) return
    abortRef.current = false
    dispatch({ type: 'SET_SEQUENCE_PLAYING', payload: true })
    if (window.spotmaster) {
      window.spotmaster.vmixStartFastPolling(
        stateRef.current.settings.vmixHost,
        stateRef.current.settings.vmixPort
      )
    }
    playItem(first).then(() => {
      dispatch({ type: 'SET_SEQUENCE_PLAYING', payload: false })
      setPlaybackProgress(null)
      if (window.spotmaster) window.spotmaster.vmixStopFastPolling()
      // cleanupInputs reads and zeros activeInputRef internally
      cleanupInputs(5000)
    })
  }, [dispatch, playItem, cleanupInputs])

  // ── Fast-status listener: progress bar UI only ─────────────────────────────
  // Sequence advance is driven by waitForInputEnd() — NOT by this listener.
  useEffect(() => {
    if (!window.spotmaster) return
    window.spotmaster.onVmixFastStatus((rawStatus) => {
      const status = rawStatus as VmixStatus
      const num = activeInputRef.current
      if (!num) return
      const inp = status.inputs?.find(i => i.key === num || i.number === num)
      if (!inp || inp.duration <= 0) return
      const lastKnown = lastFastPosRef.current[num] ?? 0
      // Guard: position regressed by more than 2 s = audio ended and vMix reset it — skip
      if (inp.position < lastKnown - 2000) {
        lastFastPosRef.current[num] = 0
        return
      }
      lastFastPosRef.current[num] = inp.position
      setPlaybackProgress({ inputNum: inp.number, position: inp.position, duration: inp.duration })
    })
    return () => window.spotmaster?.removeVmixFastStatusListener()
  }, [])  

  // ── Disparo: listen for trigger-fired from main process ────────────────────
  useEffect(() => {
    if (!window.spotmaster?.onTriggerFired) return
    window.spotmaster.onTriggerFired(() => {
      if (stateRef.current.settings.triggerEnabled) disparo()
    })
    return () => window.spotmaster?.removeTriggerListener()
  }, [disparo])

  // ── Disparo: register/unregister global shortcut (teclado) ──────────────────
  // Gamepad e MIDI são gerenciados pelos effects abaixo — não via globalShortcut
  useEffect(() => {
    if (state.isLoading || !window.spotmaster?.registerTrigger) return
    const { triggerEnabled, triggerKey } = state.settings
    const isKeyboard = triggerKey && !triggerKey.startsWith('GAMEPAD:') && !triggerKey.startsWith('MIDI:')
    if (triggerEnabled && isKeyboard) {
      window.spotmaster.registerTrigger(triggerKey!)
    } else {
      window.spotmaster.unregisterTrigger()
    }
  }, [state.settings.triggerEnabled, state.settings.triggerKey, state.isLoading]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Disparo: polling de Gamepad ──────────────────────────────────────────────
  useEffect(() => {
    const { triggerEnabled, triggerKey } = state.settings
    if (!triggerEnabled || !triggerKey?.startsWith('GAMEPAD:')) return
    const parts    = triggerKey.split(':')
    const gpIndex  = parseInt(parts[1] ?? '0')
    const btnIndex = parseInt(parts[3] ?? '0')
    let wasPressed = false
    const interval = setInterval(() => {
      const gp = navigator.getGamepads()[gpIndex]
      if (!gp) return
      const pressed = gp.buttons[btnIndex]?.pressed ?? false
      if (pressed && !wasPressed) disparo()
      wasPressed = pressed
    }, 50)
    return () => clearInterval(interval)
  }, [state.settings.triggerEnabled, state.settings.triggerKey, disparo]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Disparo: listener MIDI ───────────────────────────────────────────────────
  useEffect(() => {
    const { triggerEnabled, triggerKey } = state.settings
    if (!triggerEnabled || !triggerKey?.startsWith('MIDI:')) return
    if (!navigator.requestMIDIAccess) return
    const suffix = triggerKey.slice(5)   // ex: '60' ou 'CC74'
    const isCC   = suffix.startsWith('CC')
    const target = parseInt(isCC ? suffix.slice(2) : suffix)
    let midiAccess: MIDIAccess | null = null

    navigator.requestMIDIAccess().then((access) => {
      midiAccess = access
      const handler = (event: MIDIMessageEvent) => {
        const data = event.data
        if (!data || data.length < 2) return
        const status = data[0] & 0xf0
        const num    = data[1]
        const vel    = data[2] ?? 127
        if (!stateRef.current.settings.triggerEnabled) return
        if (isCC  && status === 0xb0 && num === target && vel > 63) disparo()
        if (!isCC && status === 0x90 && num === target && vel > 0)  disparo()
      }
      access.inputs.forEach(input => { input.onmidimessage = handler })
      // Atualiza quando novos inputs conectam
      access.onstatechange = () => {
        access.inputs.forEach(input => { input.onmidimessage = handler })
      }
    }).catch(() => {})

    return () => {
      if (midiAccess) {
        midiAccess.onstatechange = null
        midiAccess.inputs.forEach(input => { input.onmidimessage = null })
      }
    }
  }, [state.settings.triggerEnabled, state.settings.triggerKey, disparo]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Scheduler: autoPlay geral (itens sem adBreakId) ────────────────────────
  useEffect(() => {
    if (state.isLoading) return
    const interval = setInterval(() => {
      if (schedulerFiringRef.current) return
      schedulerFiringRef.current = true
      try {
        if (!stateRef.current.settings.autoPlay) return
        const currentTime = now()
        const scheduledDue = getQueue().filter(
          i => i.status === 'pending' && !i.adBreakId && i.scheduledTime && i.scheduledTime <= currentTime
        )
        if (scheduledDue.length === 0) return
        const triggerTime = scheduledDue.map(i => i.scheduledTime!).sort()[0]
        if (scheduleInterruptTimeRef.current === triggerTime) return
        if (triggerTime < sessionStartRef.current) return  // não dispara blocos vencidos antes do startup
        if (!stateRef.current.isSequencePlaying) {
          scheduleInterruptTimeRef.current = triggerTime
          if (activeQueueRef.current === 'schedule') startSchedule()
          else startSequence()
        } else {
          scheduleInterruptTimeRef.current = triggerTime
          scheduleInterruptRef.current = true
          abortRef.current = true
        }
      } finally {
        schedulerFiringRef.current = false
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [state.isLoading, startSequence, startSchedule])  

  // ── Scheduler: Autoplay Comerciais (blocos com adBreakId) ──────────────────
  // Dispara EXCLUSIVAMENTE blocos comerciais da Programação do Dia.
  // A Playlist é manual — este scheduler não a inicia e não a interrompe.
  useEffect(() => {
    if (state.isLoading) return
    const interval = setInterval(() => {
      if (schedulerFiringRef.current) return
      schedulerFiringRef.current = true
      try {
        if (!stateRef.current.settings.autoplayComerciais) return
        // Se a Playlist está tocando manualmente, não interrompe nem dispara nada
        if (stateRef.current.isSequencePlaying && activeQueueRef.current === 'playlist') return
        const currentTime = now()
        // Lê SEMPRE a Programação do dia, ignorando activeQueueRef (que poderia ser playlist em idle)
        const schedule = stateRef.current.dateSchedules[today()] ?? []
        const scheduledDue = schedule.filter(
          i => i.status === 'pending' && !!i.adBreakId && i.scheduledTime && i.scheduledTime <= currentTime
        )
        if (scheduledDue.length === 0) return
        const triggerTime = scheduledDue.map(i => i.scheduledTime!).sort()[0]
        if (commInterruptTimeRef.current === triggerTime) return
        // Permite disparar blocos recentes (até 10 min após horário) mesmo se sessionStart os bloquearia
        const sessionStart = sessionStartRef.current
        const graceSec = 10 * 60  // 10 minutos de grace após startup
        const [tH, tM, tS] = triggerTime.split(':').map(Number)
        const [sH, sM, sS] = sessionStart.split(':').map(Number)
        const triggerSec = tH * 3600 + tM * 60 + (tS ?? 0)
        const sessionSec = sH * 3600 + sM * 60 + (sS ?? 0)
        if (triggerSec < sessionSec - graceSec) return  // bloco muito antigo, ignorar
        if (!stateRef.current.isSequencePlaying) {
          commInterruptTimeRef.current = triggerTime
          startSchedule() // SEMPRE inicia a Programação, nunca a Playlist
        } else {
          // Já está tocando a Programação — interrompe para saltar ao bloco devido
          commInterruptTimeRef.current = triggerTime
          scheduleInterruptRef.current = true
          abortRef.current = true
        }
      } finally {
        schedulerFiringRef.current = false
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [state.isLoading, startSchedule])

  // ── Scheduler: Pré-carregamento de blocos comerciais ──────────────────────
  // Lê commercialBlocks diretamente (sem depender de Programação do Dia) e
  // injeta os blocos em dateSchedules dentro da janela de preloadMinutes.
  // Resolve o caso em que o usuário não gerou a programação do dia mas tem
  // autoplayComerciais ligado — os blocos agora aparecem automaticamente na fila.
  // Roda a cada 20s para não sobrecarregar. O disparo real continua no scheduler de 1s.
  useEffect(() => {
    if (state.isLoading) return
    const interval = setInterval(() => {
      if (!stateRef.current.settings.autoplayComerciais) return

      const todayStr = today()
      const todayDow = new Date().getDay()
      const currentTime = now()
      const preloadMin = stateRef.current.settings.preloadMinutes ?? 5
      const { commercialBlocks, dateSchedules, spotRotation } = stateRef.current
      const todaySchedule = dateSchedules[todayStr] ?? []

      const [cH, cM, cS] = currentTime.split(':').map(Number)
      const currentSec = cH * 3600 + cM * 60 + (cS ?? 0)

      for (const block of commercialBlocks) {
        if (!block.enabled || !block.scheduledTime) continue
        if (block.lastLoadedDate === todayStr) continue
        if (block.daysOfWeek && !block.daysOfWeek.includes(todayDow)) continue

        // Janela de pré-carregamento: [scheduledTime - preloadMin, scheduledTime + 10min grace]
        const [bH, bM, bS] = block.scheduledTime.split(':').map(Number)
        const blockSec = bH * 3600 + bM * 60 + (bS ?? 0)
        const windowStart = blockSec - preloadMin * 60
        const windowEnd   = blockSec + 600  // +10 min grace para app aberto depois do horário

        if (currentSec < windowStart || currentSec > windowEnd) continue

        // Não duplicar: verificar se itens do bloco já estão na programação como pending
        const alreadyPending = todaySchedule.some(
          i => i.adBreakId === block.id && i.status === 'pending'
        )
        if (alreadyPending) continue

        // Expandir e injetar na programação do dia
        const maxOrder = todaySchedule.length > 0
          ? Math.max(...todaySchedule.map(i => i.order))
          : 0
        const [items, newRotation] = expandBlockItems(block, maxOrder + 1, spotRotation)
        if (items.length === 0) continue

        const newSchedule = [...todaySchedule, ...items]
        dispatch({ type: 'SET_DATE_SCHEDULE', payload: { date: todayStr, items: newSchedule } })
        dispatch({ type: 'SET_SPOT_ROTATION', payload: newRotation })
        dispatch({ type: 'MARK_BLOCK_LOADED', payload: { blockId: block.id, date: todayStr } })

        // Persiste imediatamente para sobreviver reload
        if (window.spotmaster) {
          window.spotmaster.saveData('dateSchedules',
            { ...stateRef.current.dateSchedules, [todayStr]: newSchedule }
          )
          window.spotmaster.saveData('spotRotation', newRotation)
        }

        console.log(`[SpotMaster] Bloco comercial pré-carregado: "${block.name}" (${block.scheduledTime})`)
      }
    }, 20000)
    return () => clearInterval(interval)
  }, [state.isLoading, expandBlockItems, dispatch])

  // ── Load all data on startup ───────────────────────────────────────────────
  useEffect(() => {
    const loadAll = async () => {
      if (!window.spotmaster) {
        dispatch({ type: 'SET_LOADING', payload: false })
        return
      }
      try {
        const [settingsRaw, playlistRaw, clientsRaw, logRaw,
               blocksRaw, spotsRaw, rotationRaw, panelRaw, gridRaw, dateSchedulesRaw,
               musicStylesRaw, musicSequencesRaw, autoBlocoRaw, deletedSlotsRaw, durationCacheRaw, vmixCommandLogRaw,
               campaignsRaw, segmentsRaw, programWindowsRaw,
               grafismoInputsRaw, grafismoTemplatesRaw] =
          await Promise.all([
            window.spotmaster.loadData('settings'),
            window.spotmaster.loadData('playlist'),
            window.spotmaster.loadData('clients'),
            window.spotmaster.loadData('playLog'),
            window.spotmaster.loadData('commercialBlocks'),
            window.spotmaster.loadData('clientSpots'),
            window.spotmaster.loadData('spotRotation'),
            window.spotmaster.loadData('activePanel'),
            window.spotmaster.loadData('weeklyGrid'),
            window.spotmaster.loadData('dateSchedules'),
            window.spotmaster.loadData('musicStyles'),
            window.spotmaster.loadData('musicSequences'),
            window.spotmaster.loadData('autoBlocoAssignments'),
            window.spotmaster.loadData('deletedScheduleSlots'),
            window.spotmaster.loadData('mediaDurationCache'),
            window.spotmaster.loadData('vmixCommandLog'),
            window.spotmaster.loadData('campaigns'),
            window.spotmaster.loadData('segments'),
            window.spotmaster.loadData('programWindows'),
            window.spotmaster.loadData('grafismoTitleInputs'),
            window.spotmaster.loadData('grafismoTemplates'),
          ])
        // Migrate old-format blocks (slots[]) to new format (items[])
        const migrateBlock = (b: CommercialBlock): CommercialBlock => {
          if (b.items?.length) return b
          const items: CommercialBlockItem[] = (b.slots ?? []).map((slot, i) => ({
            id: crypto.randomUUID(),
            order: i + 1,
            type: 'spot_client' as const,
            clientId: slot.clientId,
            spotsCount: slot.spotsCount,
          }))
          return { ...b, items, slots: undefined }
        }
        const rawBlocks = ((blocksRaw as CommercialBlock[]) ?? []).map(migrateBlock)

        dispatch({
          type: 'LOAD_ALL',
          payload: {
            settings:         { ...DEFAULT_SETTINGS, ...(settingsRaw as AppSettings) },
            playlist:         (playlistRaw as PlaylistItem[])     ?? [],
            clients:          (clientsRaw as Client[])            ?? [],
            playLog:          (logRaw as PlayLog[])               ?? [],
            commercialBlocks: rawBlocks,
            clientSpots:      (spotsRaw as ClientSpot[])          ?? [],
            spotRotation:     (rotationRaw as SpotRotation)       ?? {},
            activePanel:      (typeof panelRaw === 'string' ? panelRaw : null) ?? 'playlist',
            weeklyGrid:       { ...DEFAULT_WEEKLY_GRID, ...((gridRaw as WeeklyProgramGrid) ?? {}) },
            dateSchedules:    (dateSchedulesRaw as Record<string, PlaylistItem[]>) ?? {},
            mediaDurationCache: sanitizeDurationCache(durationCacheRaw),
            vmixCommandLog:    ((vmixCommandLogRaw as VmixCommandLog[]) ?? []).slice(-2000),
            deletedScheduleSlots: (deletedSlotsRaw as Record<string, DeletedScheduleSlot[]>) ?? {},
            musicStyles:          (musicStylesRaw as MusicStyle[])          ?? [],
            musicSequences:       (musicSequencesRaw as MusicSequence[])    ?? [],
            autoBlocoAssignments: (autoBlocoRaw as AutoBlocoAssignment[])   ?? [],
            campaigns:            (campaignsRaw as Campaign[])                     ?? [],
            segments:             (segmentsRaw as Segment[])                       ?? [],
            programWindows:       (programWindowsRaw as ProgramWindow[])           ?? [],
            grafismoTitleInputs:  (grafismoInputsRaw as GrafismoTitleInput[])      ?? [],
            grafismoTemplates:    (grafismoTemplatesRaw as GrafismoTemplate[])     ?? [],
          },
        })
      } catch {
        dispatch({ type: 'SET_LOADING', payload: false })
      }
    }
    loadAll()
  }, [])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', state.settings.theme)
  }, [state.settings.theme])

  useEffect(() => {
    if (!window.spotmaster) return
    window.spotmaster.onVmixStatus((status) => {
      dispatch({
        type: 'SET_VMIX_STATUS',
        payload: status as Parameters<typeof reducer>[1] extends { type: 'SET_VMIX_STATUS'; payload: infer P } ? P : never,
      })
    })
    return () => { window.spotmaster?.removeVmixStatusListener() }
  }, [])

  useEffect(() => {
    if (!window.spotmaster?.onVmixCommandLog) return
    window.spotmaster.onVmixCommandLog((log) => {
      dispatch({ type: 'ADD_VMIX_COMMAND_LOG', payload: log })
    })
    return () => { window.spotmaster?.removeVmixCommandLogListener?.() }
  }, [])

  useEffect(() => {
    if (state.isLoading) return
    if (state.settings.autoConnect && window.spotmaster) {
      window.spotmaster.vmixStartPolling(state.settings.vmixHost, state.settings.vmixPort)
    }
  }, [state.isLoading, state.settings.autoConnect, state.settings.vmixHost, state.settings.vmixPort])

  useEffect(() => {
    if (!state.isLoading) saveToStorage('playlist', state.playlist)
  }, [state.playlist, state.isLoading, saveToStorage])

  useEffect(() => {
    if (!state.isLoading) saveToStorage('clients', state.clients)
  }, [state.clients, state.isLoading, saveToStorage])

  useEffect(() => {
    if (!state.isLoading) saveToStorage('playLog', state.playLog)
  }, [state.playLog, state.isLoading, saveToStorage])

  useEffect(() => {
    if (!state.isLoading) saveToStorage('settings', state.settings)
  }, [state.settings, state.isLoading, saveToStorage])

  useEffect(() => {
    if (!state.isLoading) saveToStorage('commercialBlocks', state.commercialBlocks)
  }, [state.commercialBlocks, state.isLoading, saveToStorage])

  useEffect(() => {
    if (!state.isLoading) saveToStorage('clientSpots', state.clientSpots)
  }, [state.clientSpots, state.isLoading, saveToStorage])

  useEffect(() => {
    if (!state.isLoading) saveToStorage('spotRotation', state.spotRotation)
  }, [state.spotRotation, state.isLoading, saveToStorage])

  useEffect(() => {
    if (!state.isLoading) saveToStorage('activePanel', state.activePanel)
  }, [state.activePanel, state.isLoading, saveToStorage])

  useEffect(() => {
    if (!state.isLoading) saveToStorage('weeklyGrid', state.weeklyGrid)
  }, [state.weeklyGrid, state.isLoading, saveToStorage])

  useEffect(() => {
    if (state.isLoading) return
    // Prune entries older than 30 days before persisting to avoid unbounded growth
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - 30)
    const cutoffStr = cutoff.toISOString().slice(0, 10)
    const pruned = Object.fromEntries(
      Object.entries(state.dateSchedules).filter(([date]) => date >= cutoffStr),
    )
    saveToStorage('dateSchedules', pruned)
  }, [state.dateSchedules, state.isLoading, saveToStorage])

  useEffect(() => {
    if (!state.isLoading) saveToStorage('mediaDurationCache', state.mediaDurationCache)
  }, [state.mediaDurationCache, state.isLoading, saveToStorage])

  useEffect(() => {
    if (state.isLoading) return
    // Mesmo pruning de 30 dias do dateSchedules
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - 30)
    const cutoffStr = cutoff.toISOString().slice(0, 10)
    const pruned = Object.fromEntries(
      Object.entries(state.deletedScheduleSlots).filter(([date]) => date >= cutoffStr),
    )
    saveToStorage('deletedScheduleSlots', pruned)
  }, [state.deletedScheduleSlots, state.isLoading, saveToStorage])

  useEffect(() => {
    if (!state.isLoading) saveToStorage('musicStyles', state.musicStyles)
  }, [state.musicStyles, state.isLoading, saveToStorage])

  useEffect(() => {
    if (!state.isLoading) saveToStorage('musicSequences', state.musicSequences)
  }, [state.musicSequences, state.isLoading, saveToStorage])

  useEffect(() => {
    if (!state.isLoading) saveToStorage('autoBlocoAssignments', state.autoBlocoAssignments)
  }, [state.autoBlocoAssignments, state.isLoading, saveToStorage])

  useEffect(() => {
    if (!state.isLoading) saveToStorage('grafismoTitleInputs', state.grafismoTitleInputs)
  }, [state.grafismoTitleInputs, state.isLoading, saveToStorage])

  useEffect(() => {
    if (!state.isLoading) saveToStorage('grafismoTemplates', state.grafismoTemplates)
  }, [state.grafismoTemplates, state.isLoading, saveToStorage])

  // ── Data Sources push — envia snapshot de estado ao servidor HTTP local ──────
  useEffect(() => {
    if (state.isLoading || !state.settings.dataSourcesEnabled) return
    const todayStr = today()
    const schedule = stateRef.current.dateSchedules[todayStr] ?? []
    const playingIdx = schedule.findIndex(i => i.status === 'playing')
    const playingPlaylist = stateRef.current.playlist.find(i => i.status === 'playing')
    const nowItem = playingIdx >= 0 ? schedule[playingIdx] : playingPlaylist ?? null
    const nextItem = playingIdx >= 0
      ? schedule.find((i, idx) => idx > playingIdx && i.status === 'pending') ?? null
      : null
    const parseTitle = (title: string) => {
      const sep = title.indexOf(' - ')
      return { artist: sep >= 0 ? title.slice(0, sep).trim() : title.trim(), song: sep >= 0 ? title.slice(sep + 3).trim() : '' }
    }
    const itemSnap = (item: PlaylistItem | null) => item ? {
      title: item.title, type: item.type, duration: item.duration,
      scheduledTime: item.scheduledTime, clientName: item.clientName,
      ...parseTitle(item.title),
    } : null
    const snapshot = {
      nowPlaying: itemSnap(nowItem),
      nextItem: itemSnap(nextItem),
      schedule: schedule.map(i => ({ scheduledTime: i.scheduledTime, title: i.title, type: i.type, status: i.status, clientName: i.clientName, duration: i.duration })),
      log: stateRef.current.playLog.filter(l => l.date === todayStr).map(l => ({ actualTime: l.actualTime, title: l.title, clientName: l.clientName, status: l.status, duration: l.duration })),
    }
    window.spotmaster?.updateDataSources(snapshot)
  }, [state.playlist, state.dateSchedules, state.playLog, state.settings.dataSourcesEnabled, state.isLoading])

  // ── Auto-load today's schedule on startup ───────────────────────────────────
  // If today's date has no schedule stored, generate from the weekly template.
  useEffect(() => {
    if (state.isLoading) return
    if (!state.dateSchedules[today()]) {
      generatePlaylistFromGrid(today())
    }
  }, [state.isLoading]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-sync schedule when commercial blocks are configured or modified ─────
  // Replaces empty placeholder items with real block content as soon as the
  // operator configures a block — no need to manually click "Atualizar".
  // Only runs when: schedule already exists for today AND sequence is not playing.
  useEffect(() => {
    if (state.isLoading) return
    const todayStr = today()
    const schedule = stateRef.current.dateSchedules[todayStr]
    if (!schedule || schedule.length === 0) return   // fresh-generation handles new days
    if (stateRef.current.isSequencePlaying) return   // never touch an active playback queue
    generatePlaylistFromGrid(todayStr, true)
  }, [state.commercialBlocks]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <AppContext.Provider value={{ state, dispatch, t, saveToStorage, playItem, playSingleItem, startSequence, startSchedule, startScheduleFromNow, startScheduleFromItem, pauseSchedule, stopPlayback, loadBlockIntoPlaylist, disparo, generatePlaylistFromGrid, skipToNext, setStopAfterCurrent }}>
      {children}
    </AppContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useApp(): AppContextValue {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used inside AppProvider')
  return ctx
}
