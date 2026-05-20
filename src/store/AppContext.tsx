import React, {
  createContext,
  useContext,
  useReducer,
  useState,
  useEffect,
  useCallback,
  useMemo,
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
  MusicTrack,
  AudioLayer,
  AudioLayerMode,
  VideoStyle,
  AudioStyle,
  VmixOutputProfile,
  PlaybackSnapshot,
  ResumeCandidate,
} from '../types'
import { getTranslations } from '../i18n'
import type { Translations } from '../i18n'
import { dateToLocalYmd, now, today } from '../utils/time'
import { generateMusicBlock as generateMusicBlockEngine } from '../utils/autoprog'
import { buildAutoProgStyleSources } from '../utils/autoprogStyles'
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
  continuousPlayback: false,
  gcMusicEnabled: false,
  gcMusicDelaySeconds: 5,
  gcMusicInputName: '',
  gcMusicLine1Field: 'Artist.Text',
  gcMusicLine2Field: 'Title.Text',
  gcMusicDynamic: true,
  dataSourcesEnabled: false,
  dataSourcesPort: 7070,
  videoFolders: [],
  audioFolders: [],
  transitionType: 'cut',
  transitionDurationMs: 0,
  snapshotOnSpot: false,
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
  musicLibrary: MusicTrack[]
  grafismoTitleInputs: GrafismoTitleInput[]
  grafismoTemplates: GrafismoTemplate[]
  audioLayers: AudioLayer[]
  videoStyles: VideoStyle[]
  audioStyles: AudioStyle[]
  vmixOutputProfiles: VmixOutputProfile[]
}

const DEFAULT_WEEKLY_GRID: WeeklyProgramGrid = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] }
const COMMERCIAL_CATCH_UP_GRACE_SECONDS = 10 * 60

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
  musicLibrary: [],
  grafismoTitleInputs: [],
  grafismoTemplates: [],
  audioLayers: [],
  videoStyles: [],
  audioStyles: [],
  vmixOutputProfiles: [],
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
  | { type: 'ADD_DATE_SCHEDULE_ITEM'; payload: { date: string; item: Omit<PlaylistItem, 'id' | 'order'> & { groupTime?: string } } }
  | { type: 'INSERT_ITEM_AFTER';      payload: { date: string; afterId: string; item: Omit<PlaylistItem, 'id' | 'order'> } }
  | { type: 'INSERT_ITEM_BEFORE';     payload: { date: string; beforeId: string; item: Omit<PlaylistItem, 'id' | 'order'> } }
  | { type: 'UPSERT_MEDIA_DURATIONS'; payload: Record<string, number> }
  | { type: 'ADD_MUSIC_STYLE';             payload: MusicStyle }
  | { type: 'UPDATE_MUSIC_STYLE';          payload: MusicStyle }
  | { type: 'DELETE_MUSIC_STYLE';          payload: string }
  | { type: 'ADD_MUSIC_SEQUENCE';          payload: MusicSequence }
  | { type: 'UPDATE_MUSIC_SEQUENCE';       payload: MusicSequence }
  | { type: 'DELETE_MUSIC_SEQUENCE';       payload: string }
  | { type: 'SET_AUTO_BLOCO_ASSIGNMENT';   payload: AutoBlocoAssignment }
  | { type: 'DELETE_AUTO_BLOCO_ASSIGNMENT'; payload: string }
  | { type: 'SET_MUSIC_LIBRARY';          payload: MusicTrack[] }
  | { type: 'UPSERT_MUSIC_TRACK';         payload: MusicTrack }
  | { type: 'DELETE_MUSIC_TRACK';         payload: string }
  | { type: 'UPDATE_MUSIC_TRACK_PLAYED';  payload: { id: string; date: string } }
  | { type: 'ADD_GRAFISMO_TITLE_INPUT';    payload: GrafismoTitleInput }
  | { type: 'UPDATE_GRAFISMO_TITLE_INPUT'; payload: GrafismoTitleInput }
  | { type: 'DELETE_GRAFISMO_TITLE_INPUT'; payload: string }
  | { type: 'ADD_GRAFISMO_TEMPLATE';       payload: GrafismoTemplate }
  | { type: 'UPDATE_GRAFISMO_TEMPLATE';    payload: GrafismoTemplate }
  | { type: 'DELETE_GRAFISMO_TEMPLATE';    payload: string }
  | { type: 'UPSERT_AUDIO_LAYER';          payload: AudioLayer }
  | { type: 'DELETE_AUDIO_LAYER';          payload: string }
  | { type: 'ADVANCE_AUDIO_LAYER_INDEX';   payload: { layerId: string; newIndex: number } }
  | { type: 'ADD_VIDEO_STYLE';             payload: VideoStyle }
  | { type: 'UPDATE_VIDEO_STYLE';          payload: VideoStyle }
  | { type: 'DELETE_VIDEO_STYLE';          payload: string }
  | { type: 'ADD_AUDIO_STYLE';             payload: AudioStyle }
  | { type: 'UPDATE_AUDIO_STYLE';          payload: AudioStyle }
  | { type: 'DELETE_AUDIO_STYLE';          payload: string }
  | { type: 'ADD_VMIX_OUTPUT_PROFILE';     payload: VmixOutputProfile }
  | { type: 'UPDATE_VMIX_OUTPUT_PROFILE';  payload: VmixOutputProfile }
  | { type: 'DELETE_VMIX_OUTPUT_PROFILE';  payload: string }
  | { type: 'CLEAR_MEDIA_DURATION_CACHE' }
  | { type: 'CLEAR_VMIX_COMMAND_LOG' }
  | { type: 'CLEAR_PLAY_LOG' }
  | { type: 'CLEAR_MUSIC_LIBRARY' }

function mergeRuntimeStatus(
  current: PlaylistItem | undefined,
  incoming: PlaylistItem,
  isSequencePlaying: boolean,
): PlaylistItem {
  if (!isSequencePlaying || !current) return incoming
  if (incoming.status !== 'pending') return incoming
  if (current.status === 'playing') {
    return { ...incoming, status: current.status }
  }
  return incoming
}

function mergeScheduleRuntimeStatus(
  currentItems: PlaylistItem[],
  incomingItems: PlaylistItem[],
  isSequencePlaying: boolean,
): PlaylistItem[] {
  if (!isSequencePlaying || currentItems.length === 0) return incomingItems
  const currentById = new Map(currentItems.map(item => [item.id, item]))
  return incomingItems.map(item =>
    mergeRuntimeStatus(currentById.get(item.id), item, isSequencePlaying)
  )
}

function hasPlayableContent(item: PlaylistItem): boolean {
  return !!item.filePath || !!item.inputName || item.type === 'vmix_action' || item.type === 'pause'
}

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
      return { ...state, vmixCommandLog: next.length > 1000 ? next.slice(-1000) : next }
    }
    case 'SET_VMIX_COMMAND_LOG':
      return { ...state, vmixCommandLog: action.payload.length > 1000 ? action.payload.slice(-1000) : action.payload }
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
    case 'DELETE_CLIENT': {
      const clientId = action.payload
      const spotRotation = { ...state.spotRotation }
      delete spotRotation[clientId]
      const dateSchedules = Object.fromEntries(
        Object.entries(state.dateSchedules).map(([date, items]) => [
          date,
          items.filter((item) => item.clientId !== clientId).map((item, i) => ({ ...item, order: i + 1 })),
        ])
      )
      return {
        ...state,
        clients: state.clients.filter((c) => c.id !== clientId),
        clientSpots: state.clientSpots.filter((s) => s.clientId !== clientId),
        campaigns: state.campaigns.filter((camp) => camp.clientId !== clientId),
        playlist: state.playlist.filter((item) => item.clientId !== clientId).map((item, i) => ({ ...item, order: i + 1 })),
        dateSchedules,
        commercialBlocks: state.commercialBlocks.map((block) => ({
          ...block,
          items: block.items
            .filter((item) => item.clientId !== clientId)
            .map((item, i) => ({ ...item, order: i + 1 })),
          slots: block.slots?.filter((slot) => slot.clientId !== clientId),
        })),
        spotRotation,
      }
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
      return { ...state, playLog: next.length > 2000 ? next.slice(-2000) : next }
    }
    case 'SET_LOG':
      return { ...state, playLog: action.payload.length > 2000 ? action.payload.slice(-2000) : action.payload }
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
      // insertIdx === -1 means the target was not found — fallback: append at end
      const splitAt = insertIdx >= 0 ? insertIdx + 1 : sorted.length
      const spliced = [
        ...sorted.slice(0, splitAt),
        action.payload.item,
        ...sorted.slice(splitAt),
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
      return {
        ...state,
        dateSchedules: {
          ...state.dateSchedules,
          [action.payload.date]: mergeScheduleRuntimeStatus(
            state.dateSchedules[action.payload.date] ?? [],
            action.payload.items,
            state.isSequencePlaying,
          ),
        },
      }
    case 'UPDATE_SCHEDULE_ITEM': {
      const d = action.payload.date
      return { ...state, dateSchedules: { ...state.dateSchedules,
        [d]: (state.dateSchedules[d] ?? []).map(i =>
          i.id === action.payload.item.id
            ? mergeRuntimeStatus(i, action.payload.item, state.isSequencePlaying)
            : i
        ),
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
      return {
        ...state,
        dateSchedules: {
          ...state.dateSchedules,
          [action.payload.date]: mergeScheduleRuntimeStatus(
            state.dateSchedules[action.payload.date] ?? [],
            action.payload.items,
            state.isSequencePlaying,
          ),
        },
      }
    case 'ADD_DATE_SCHEDULE_ITEM': {
      // Always reads from current state — avoids stale closure when items are
      // added rapidly (each dispatch sees the latest schedule, not the render's copy)
      const current = state.dateSchedules[action.payload.date] ?? []
      const { groupTime, ...itemFields } = action.payload.item
      // Order: place after the last item of the same group (by scheduledTime prefix)
      const groupItems = groupTime
        ? current.filter(i => i.scheduledTime?.slice(0, 5) === groupTime)
        : current
      const maxGroupOrder = groupItems.length > 0
        ? Math.max(...groupItems.map(i => i.order ?? 0))
        : (current.length > 0 ? Math.max(...current.map(i => i.order ?? 0)) : 0)
      const newItem: PlaylistItem = {
        ...itemFields,
        id: crypto.randomUUID(),
        order: maxGroupOrder + 0.5,
      }
      const reindexed = [...current, newItem]
        .sort((a, b) => a.order - b.order)
        .map((i, n) => ({ ...i, order: n + 1 }))
      return {
        ...state,
        dateSchedules: {
          ...state.dateSchedules,
          [action.payload.date]: reindexed,
        },
      }
    }
    case 'INSERT_ITEM_AFTER': {
      const current = state.dateSchedules[action.payload.date] ?? []
      const anchor = current.find(i => i.id === action.payload.afterId)
      const anchorOrder = anchor?.order ?? (current.length > 0 ? Math.max(...current.map(i => i.order ?? 0)) : 0)
      const newItem: PlaylistItem = {
        ...action.payload.item,
        id: crypto.randomUUID(),
        order: anchorOrder + 0.5,
      }
      const reindexed = [...current, newItem]
        .sort((a, b) => a.order - b.order)
        .map((i, n) => ({ ...i, order: n + 1 }))
      return { ...state, dateSchedules: { ...state.dateSchedules, [action.payload.date]: reindexed } }
    }
    case 'INSERT_ITEM_BEFORE': {
      const current = state.dateSchedules[action.payload.date] ?? []
      const anchor = current.find(i => i.id === action.payload.beforeId)
      const anchorOrder = anchor?.order ?? 1
      const newItem: PlaylistItem = {
        ...action.payload.item,
        id: crypto.randomUUID(),
        order: anchorOrder - 0.5,
      }
      const reindexed = [...current, newItem]
        .sort((a, b) => a.order - b.order)
        .map((i, n) => ({ ...i, order: n + 1 }))
      return { ...state, dateSchedules: { ...state.dateSchedules, [action.payload.date]: reindexed } }
    }
    case 'UPSERT_MEDIA_DURATIONS': {
      const merged = { ...state.mediaDurationCache, ...action.payload }
      const entries = Object.entries(merged)
      // Cap at 15 000 entries — prevents unbounded growth over months of use
      const capped = entries.length > 15000 ? Object.fromEntries(entries.slice(-15000)) : merged
      return { ...state, mediaDurationCache: capped }
    }
    case 'CLEAR_MEDIA_DURATION_CACHE':
      return { ...state, mediaDurationCache: {} }
    case 'CLEAR_VMIX_COMMAND_LOG':
      return { ...state, vmixCommandLog: [] }
    case 'CLEAR_PLAY_LOG':
      return { ...state, playLog: [] }
    case 'CLEAR_MUSIC_LIBRARY':
      return { ...state, musicLibrary: [] }
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
    case 'SET_MUSIC_LIBRARY':
      // Cap at 50 000 tracks — no real station library exceeds this
      return { ...state, musicLibrary: action.payload.length > 50000 ? action.payload.slice(0, 50000) : action.payload }
    case 'UPSERT_MUSIC_TRACK': {
      const exists = state.musicLibrary.some(t => t.id === action.payload.id)
      const next = exists
        ? state.musicLibrary.map(t => t.id === action.payload.id ? action.payload : t)
        : [...state.musicLibrary, action.payload]
      return { ...state, musicLibrary: next.length > 50000 ? next.slice(0, 50000) : next }
    }
    case 'DELETE_MUSIC_TRACK':
      return { ...state, musicLibrary: state.musicLibrary.filter(t => t.id !== action.payload) }
    case 'UPDATE_MUSIC_TRACK_PLAYED': {
      return {
        ...state,
        musicLibrary: state.musicLibrary.map(t =>
          t.id === action.payload.id
            ? { ...t, lastAiredDate: action.payload.date, playCount: t.playCount + 1 }
            : t
        ),
      }
    }
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
    case 'UPSERT_AUDIO_LAYER': {
      const exists = state.audioLayers.some(l => l.id === action.payload.id)
      return {
        ...state,
        audioLayers: exists
          ? state.audioLayers.map(l => l.id === action.payload.id ? action.payload : l)
          : [...state.audioLayers, action.payload],
      }
    }
    case 'DELETE_AUDIO_LAYER':
      return { ...state, audioLayers: state.audioLayers.filter(l => l.id !== action.payload) }
    case 'ADD_VIDEO_STYLE':
      return { ...state, videoStyles: [...state.videoStyles, action.payload] }
    case 'UPDATE_VIDEO_STYLE':
      return { ...state, videoStyles: state.videoStyles.map(s => s.id === action.payload.id ? action.payload : s) }
    case 'DELETE_VIDEO_STYLE':
      return { ...state, videoStyles: state.videoStyles.filter(s => s.id !== action.payload) }
    case 'ADD_AUDIO_STYLE':
      return { ...state, audioStyles: [...state.audioStyles, action.payload] }
    case 'UPDATE_AUDIO_STYLE':
      return { ...state, audioStyles: state.audioStyles.map(s => s.id === action.payload.id ? action.payload : s) }
    case 'DELETE_AUDIO_STYLE':
      return { ...state, audioStyles: state.audioStyles.filter(s => s.id !== action.payload) }
    case 'ADD_VMIX_OUTPUT_PROFILE':
      return { ...state, vmixOutputProfiles: [...state.vmixOutputProfiles, action.payload] }
    case 'UPDATE_VMIX_OUTPUT_PROFILE':
      return { ...state, vmixOutputProfiles: state.vmixOutputProfiles.map(p => p.id === action.payload.id ? action.payload : p) }
    case 'DELETE_VMIX_OUTPUT_PROFILE':
      return { ...state, vmixOutputProfiles: state.vmixOutputProfiles.filter(p => p.id !== action.payload) }
    case 'ADVANCE_AUDIO_LAYER_INDEX':
      return {
        ...state,
        audioLayers: state.audioLayers.map(l =>
          l.id === action.payload.layerId
            ? { ...l, currentIndex: action.payload.newIndex }
            : l
        ),
      }
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
    backup?: boolean,
  ) => Promise<void>
  skipToNext: () => Promise<void>
  setStopAfterCurrent: (v: boolean) => void
  triggerAudioLayer: (layerId: string, opts?: { mode?: AudioLayerMode }) => Promise<void>
  stopAudioLayer: (layerId: string) => Promise<void>
  audioLayerActive: Record<string, boolean>
  resumeCandidate: ResumeCandidate | null
  resumeFromSnapshot: () => Promise<void>
  ignoreResume: () => void
  /** Bloco comercial pre-carregado em PVW do vMix, prestes a disparar (v5.5.31).
   *  Mostra o banner de "BLOCO ARMADO" no StatusBar. */
  armedCommercial: { blockId: string; blockName: string; firstItemId: string; guid: string; filePath: string; fireAt: string; scheduleDate: string } | null
}

const AppContext = createContext<AppContextValue | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState)
  const t = useMemo(() => getTranslations(state.settings.language), [state.settings.language])

  const saveTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const saveToStorage = useCallback((key: string, data: unknown) => {
    const existing = saveTimersRef.current.get(key)
    if (existing) clearTimeout(existing)
    const timer = setTimeout(() => {
      if (!window.spotmaster) return
      window.spotmaster.saveData(key, data)
      saveTimersRef.current.delete(key)
    }, 500)
    saveTimersRef.current.set(key, timer)
  }, [])

  const stateRef = useRef(state)
  useEffect(() => { stateRef.current = state })

  // ── Session resume state ──────────────────────────────────────────────────
  const [resumeCandidate, setResumeCandidate] = useState<ResumeCandidate | null>(null)
  const resumeDetectedRef = useRef(false)  // garante que a detecção roda apenas uma vez

  // ── AudioPro runtime state (not persisted) ────────────────────────────────
  // Tracks which audio layers are currently playing (used by AudioControlTab)
  const [audioLayerActive, setAudioLayerActive] = useState<Record<string, boolean>>({})
  // Runtime session data for each active layer — holds GUIDs and timers for cleanup
  type AudioSession = { looping: boolean; currentGuid?: string; timers: ReturnType<typeof setTimeout>[] }
  const audioSessionsRef = useRef<Map<string, AudioSession>>(new Map())

  // Tracks the vMix input number currently on-air
  const activeInputRef = useRef<string>('')
  // Set to true by stopPlayback(); checked inside every async loop
  const abortRef = useRef<boolean>(false)
  // Guarda o canal de overlay ativado pelo AudioStyle placeholder para desativar ao parar
  const activeAudioPlaceholderRef = useRef<{ channel: number } | null>(null)
  // Timers pendentes do GC Musical (delay inicial + hide). Limpos em stopPlayback.
  const gcMusicTimersRef = useRef<ReturnType<typeof setTimeout>[]>([])
  // Evita duplicar snapshot para o mesmo adBreakId (tira apenas no primeiro item do bloco)
  const lastSnapshotAdBreakRef = useRef<string | null>(null)
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
  // Conjunto de GUIDs cujo position já alcançou (ou ultrapassou) a duração no
  // fast-poll. Permite que o playItem.wait quebre cedo quando o operador
  // adianta manualmente no vMix (scrub) — sem isto, o wall-clock continua
  // contando a duração original e o vMix fica ocioso esperando.
  const activeInputEndedRef = useRef<Set<string>>(new Set())
  // Map de GUID → timer pendente em removeOwnedInput. Garante que o mesmo input
  // não tenha duas remoções agendadas ao mesmo tempo (stopPlayback + sweep
  // costumavam disparar StopInput/RemoveInput no mesmo GUID 2-3 vezes, fazendo
  // o vMix gerar "Referência de objeto não definida" na tentativa redundante).
  const pendingRemovalRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  // ── Pre-arming de bloco comercial (v5.5.31) ───────────────────────────────
  // 30s antes do horário de um bloco comercial, o app carrega o primeiro item
  // playable no vMix (AddInput + PreviewInput → PVW). Quando chega a hora, o
  // scheduler usa o GUID já armado para fazer Cut imediato — elimina a janela
  // de risco onde o AddInput "sob pressão" podia falhar (vMix lento, codec
  // pesado) e fazer o bloco inteiro pular.
  //
  // Ref pra leitura síncrona no scheduler (state seria stale por 1 tick).
  // State pra UI consumir e renderizar o banner.
  type ArmedCommercial = {
    blockId: string
    blockName: string
    firstItemId: string
    guid: string
    filePath: string
    fireAt: string         // HH:MM:SS do bloco
    scheduleDate: string   // YYYY-MM-DD
  }
  const armedCommercialRef = useRef<ArmedCommercial | null>(null)
  const [armedCommercial, setArmedCommercialState] = useState<ArmedCommercial | null>(null)
  const setArmedCommercial = useCallback((val: ArmedCommercial | null) => {
    armedCommercialRef.current = val
    setArmedCommercialState(val)
  }, [])
  const armingFiringRef = useRef(false)
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
  // Flipped to true assim que runSequence sai do while-loop (qualquer caminho).
  // Usado por callbacks .then() de preloads em voo para descartar inputs que
  // chegariam tarde demais (sequência já parou ou trocou de fila). Evita input
  // "fantasma" no vMix quando o usuário aciona Stop Next durante o preload.
  const sequenceEndedRef = useRef(true)

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
    const todayStr = today()

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
      } else if (bi.type === 'pause') {
        // Ponto de pausa pré-programado: ao chegar neste item, runSequence
        // marca como 'done' e quebra o while-loop. Reprodução continua só
        // após o operador disparar manualmente (botão, atalho ou gamepad).
        // Útil para "parar depois deste bloco e esperar próximo trigger do dia".
        items.push({
          id: crypto.randomUUID(),
          order: startOrder + offset,
          title: bi.title ?? 'Pausa',
          duration: 0,
          type: 'pause' as const,
          status: 'pending' as const,
          adBreakId: block.id,
          scheduledTime: block.scheduledTime,
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
  // Expands a block's items and replaces any pending items from the same block
  // in the playlist, then appends new items. Avoids duplicates when called
  // repeatedly (e.g. "Força Recarregar" clicked more than once, or after editing).
  const loadBlockIntoPlaylist = useCallback((block: CommercialBlock) => {
    const dateStr = today()
    const { playlist, spotRotation } = stateRef.current

    // Remove existing PENDING items for this block — they are stale and will be
    // replaced. Done/playing items are kept (they already aired or are on-air).
    const filtered = playlist.filter(i => !(i.adBreakId === block.id && i.status === 'pending'))
    const startOrder = filtered.length + 1

    const [items, newRotation] = expandBlockItems(block, startOrder, spotRotation)

    // Set the whole playlist at once to avoid intermediate renders with partial state
    const newPlaylist = [...filtered, ...items].map((item, idx) => ({ ...item, order: idx + 1 }))
    dispatch({ type: 'SET_PLAYLIST', payload: newPlaylist })
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
    backup = true,  // false for auto-sync calls to prevent backup storms
  ) => {
    const dateStr = targetDate ?? today()
    // Only backup for user-initiated actions, not for automatic syncs triggered
    // by state changes (e.g. commercialBlocks useEffect), which can fire dozens
    // of times in rapid succession creating hundreds of redundant backup copies.
    if (backup) {
      const existingScheduleForBackup = stateRef.current.dateSchedules[dateStr] ?? []
      if (existingScheduleForBackup.length > 0 && window.spotmaster?.createBackup) {
        window.spotmaster
          .createBackup(merge ? 'before-schedule-merge' : 'before-schedule-generate')
          .catch(() => {})
      }
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
          const { autoBlocoAssignments, musicSequences, musicStyles, audioStyles, videoStyles, playLog } = stateRef.current
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
                  styles: buildAutoProgStyleSources({ audioStyles, videoStyles, legacyMusicStyles: musicStyles }),
                  playLog,
                  date: dateStr,
                  scanFolder: (p, subs) => window.spotmaster.scanMusicFolder(p, subs),
                  scanVideoFolder: (p, subs) => window.spotmaster.scanVideoFolder(p, subs),
                  getDuration: readDurationForAutoProg,
                })
                if (generated.length > 0) {
                  generated.forEach(g => {
                    // Tipo correto: vinheta → 'vinheta', vídeo → 'programa', áudio → 'spot'
                    programItems.push({
                      id: crypto.randomUUID(),
                      order: 0,
                      title: g.title,
                      type: (g.isVinheta ? 'vinheta' : g.mediaType === 'video' ? 'programa' : 'spot') as import('../types').SpotType,
                      status: 'pending' as const,
                      scheduledTime: slot.scheduledTime,
                      duration: g.duration ?? 0,
                      filePath: g.filePath,
                      mediaType: g.mediaType,
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
              type: 'outros' as const,
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

    // Mark ALL used commercial blocks as loaded (linked + unlinked) so the preload scheduler
    // doesn't re-inject them after they've played. Without this, blocks linked to schedule
    // slots never got lastLoadedDate set, and the preload scheduler would fire them again
    // within the 60-minute grace window.
    if (dateStr === today()) {
      const allUsedBlockIds = new Set([...linkedBlockIds, ...blocksForDay.map(b => b.id)])
      // Só dispatch MARK_BLOCK_LOADED para blocos cuja lastLoadedDate ainda é diferente
      // de hoje. Dispatchs redundantes mudam a referência de state.commercialBlocks e
      // disparam o auto-sync useEffect, que regenera o schedule com novos UUIDs nos
      // items pending — fazia o banner de arming "piscar" e o motor pular itens.
      commercialBlocks
        .filter(b => allUsedBlockIds.has(b.id) && b.lastLoadedDate !== dateStr)
        .forEach(b => {
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
        // O app pode ficar aberto por dias. Ao virar a data, o "horario de inicio"
        // da sessao precisa ser reiniciado; caso contrario 21:00 de hoje pode ser
        // tratado como anterior a 22:00 de ontem e o autoplay comercial e bloqueado.
        sessionStartRef.current = '00:00:00'
        scheduleInterruptTimeRef.current = ''
        commInterruptTimeRef.current = ''
        minOrderRef.current = -1
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

  // Snapshot dos inputs atuais do vMix antes/depois de AddInput.
  // Usar GUID por diferenca e mais seguro que depender apenas do maior numero:
  // o vMix pode renumerar inputs, e inputs adicionados fora do VTMaster podem
  // aparecer no meio do processo.
  const getInputKeys = useCallback(async (): Promise<Set<string>> => {
    if (!window.spotmaster) return new Set()
    const st = await requestVmixXml()
    if (!st.success || !st.data) return new Set()
    const matches = [...st.data.matchAll(/<input\b[^>]*\bkey="([^"]+)"/gi)]
    return new Set(matches.map(m => m[1]))
  }, [])

  // Polls until a new input appears after AddInput.
  // Returns the input's GUID (key attribute) — stable across renumbering.
  // Aceita tanto <input ...>content</input> quanto <input ... /> (self-closing).
  const pollForNewInput = useCallback(async (knownKeys: Set<string>): Promise<string | null> => {
    for (let attempt = 0; attempt < 100; attempt++) {
      await sleep(200)
      if (!window.spotmaster) return null
      const st = await requestVmixXml()
      if (st.success && st.data) {
        const tags = [...st.data.matchAll(/<input\b([^>]*?)\/?>/gi)]
        for (const tag of tags) {
          const attrs = tag[1]
          const keyM = attrs.match(/\bkey="([^"]+)"/i)
          if (keyM && !knownKeys.has(keyM[1])) {
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
  // Extrai os atributos state e position de um input vMix pelo GUID.
  // O XML do vMix coloca o atributo `key` normalmente no FINAL da tag, portanto
  // não é possível depender de ordem de atributos. Esta função localiza a tag
  // completa pelo GUID e extrai os atributos independente de posição.
  const extractInputAttrs = (xml: string, guid: string): { state: string; position: number } | null => {
    const keyIdx = xml.indexOf(`key="${guid}"`)
    if (keyIdx < 0) return null
    const tagStart = xml.lastIndexOf('<input', keyIdx)
    if (tagStart < 0) return null
    const tagEnd = xml.indexOf('>', keyIdx)
    if (tagEnd < 0) return null
    const tag = xml.slice(tagStart, tagEnd + 1)
    const stateM = tag.match(/\bstate="([^"]*)"/)
    const posM   = tag.match(/\bposition="(\d+)"/)
    return {
      state:    stateM?.[1] ?? '',
      position: posM ? parseInt(posM[1]) : 0,
    }
  }

  const waitForInputReady = useCallback(async (guid: string, timeoutMs = 6000): Promise<boolean> => {
    if (!window.spotmaster) return false
    const start = Date.now()
    while (Date.now() - start < timeoutMs) {
      const st = await requestVmixXml()
      if (st.success && st.data) {
        const attrs = extractInputAttrs(st.data, guid)
        if (attrs) {
          // Loading = ainda decodificando. Empty = falhou. Qualquer outro = pronto.
          if (attrs.state && attrs.state !== 'Loading' && attrs.state !== 'Empty') return true
        }
      }
      await sleep(150)
    }
    return false
  }, [])

  // Polls até o state virar Running (clip efetivamente tocando) ou a position avançar.
  // Usado logo após PlayInput para confirmar que o vMix aceitou o comando.
  const waitForInputPlaying = useCallback(async (guid: string, timeoutMs = 1500): Promise<boolean> => {
    if (!window.spotmaster) return false
    const start = Date.now()
    while (Date.now() - start < timeoutMs) {
      const st = await requestVmixXml()
      if (st.success && st.data) {
        const attrs = extractInputAttrs(st.data, guid)
        if (attrs) {
          if (attrs.state === 'Running' || attrs.position > 0) return true
        }
      }
      await sleep(100)
    }
    return false
  }, [])

  const removeOwnedInput = useCallback((
    guid: string,
    meta?: VmixCommandMeta,
    delayMs = 0,
  ) => {
    if (!guid || !window.spotmaster) return
    // Dedup: se já existe uma remoção pendente para este GUID, cancela e
    // reagenda com o novo delay. Garante que uma chamada urgente (delay=0
    // em stopPlayback) sobrescreve uma remoção mais "gentil" (delay=5000 do
    // sequence-end). Sem isto, dois ou três setTimeouts diferentes
    // disparavam StopInput/RemoveInput sequencialmente no MESMO GUID —
    // a primeira removia o input e a segunda recebia
    // "Referência de objeto não definida" do vMix.
    const existing = pendingRemovalRef.current.get(guid)
    if (existing) clearTimeout(existing)

    const timer = setTimeout(async () => {
      // Re-checa: outra chamada substituiu este timer enquanto estava na fila?
      // Se sim, deixa a outra fazer o trabalho.
      if (pendingRemovalRef.current.get(guid) !== timer) return
      pendingRemovalRef.current.delete(guid)
      if (!window.spotmaster) return
      // StopInput garante que áudios em estado Running (AudioFile) sejam
      // encerrados antes da remoção. Para vídeos é inofensivo pois já saíram
      // do PGM via Cut. Sem este stop, o vMix rejeita RemoveInput em áudios
      // que ainda estão tocando no bus de áudio.
      await executeVmixCommand('StopInput', {
        input: guid,
        meta: { source: 'pre-stop-before-remove', queue: 'system', ...meta },
        validate: false,
      })
      await new Promise(r => setTimeout(r, 120))
      const result = await executeVmixCommand('RemoveInput', {
        input: guid,
        meta: { source: 'remove-owned-input', queue: 'system', ...meta },
      })
      // Deleta de spotmasterGuidsRef SEMPRE — se a remoção falhou porque o
      // input já não existia, é desejável esquecer dele também.
      spotmasterGuidsRef.current.delete(guid)
      if (!result.success) {
        console.debug(`[vmix] RemoveInput falhou para ${guid} (provavelmente já removido): ${result.error ?? 'sem detalhe'}`)
      }
    }, delayMs)
    pendingRemovalRef.current.set(guid, timer)
  }, [])

  // Loads a file as a new input in vMix.
  // Returns the input's GUID (stable — never changes when vMix renumbers).
  const loadNewInput = useCallback(async (filePath: string, meta?: VmixCommandMeta): Promise<string | null> => {
    if (!window.spotmaster) return null
    const ext = filePath.split('.').pop()?.toLowerCase() ?? ''
    const isImage = ['jpg','jpeg','png','gif','bmp','webp','tiff','tif','ico'].includes(ext)
    const isAudio = ['mp3','wav','aac','ogg','flac','m4a','wma','opus','aiff'].includes(ext)
    const vmixType = isImage ? 'Image' : isAudio ? 'AudioFile' : 'Video'

    const knownKeys = await getInputKeys()
    const addResult = await executeVmixCommand('AddInput', {
      value: `${vmixType}|${filePath}`,
      meta: { source: 'load-input', ...meta },
    })
    if (!addResult.success) return null
    const guid = await pollForNewInput(knownKeys)  // returns GUID
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
  }, [getInputKeys, pollForNewInput, waitForInputReady])

  // ── cleanupInputs ───────────────────────────────────────────────────────────
  // Removes the active input (by GUID) from vMix after delayMs.
  const cleanupInputs = useCallback((delayMs = 0) => {
    const toRemove = activeInputRef.current
    activeInputRef.current = ''
    if (!toRemove) return
    removeOwnedInput(toRemove, { source: 'cleanup-input', queue: 'system' }, delayMs)
  }, [removeOwnedInput])

  // ── playItem ────────────────────────────────────────────────────────────────
  // Sends ONE item to air and awaits until it finishes playing.
  // This function is strictly serial — it never runs concurrently with itself.
  // loadNewInput is called here (not in background) to prevent slot collisions.
  const playItem = useCallback(async (item: PlaylistItem, nextFilePath?: string) => {
    if (!window.spotmaster) return

    // Direct/manual execution can call playItem without going through
    // startSequence/startSchedule. Make sure status updates hit the queue that
    // actually owns this item instead of whichever queue was active last.
    if (!stateRef.current.isSequencePlaying) {
      const todaySchedule = stateRef.current.dateSchedules[today()] ?? []
      activeQueueRef.current = todaySchedule.some(i => i.id === item.id)
        ? 'schedule'
        : 'playlist'
    }

    // Placeholder items (no file, no vMix input, not a vmix_action) have no
    // playable content — skip instantly rather than producing silence.
    if (!hasPlayableContent(item)) {
      updateQueueItem({ ...item, status: 'skipped' })
      return
    }

    // ── Safeguard contra "items playing fantasma" ────────────────────────────
    // Antes de marcar o item atual como playing, varre a fila e marca como
    // done qualquer outro item que esteja em status='playing'. Cobre o caso
    // onde um playItem anterior foi abortado/interrompido sem chegar na linha
    // final de marcação de done (ex.: erro silencioso, race com auto-sync que
    // regenera o schedule, dispatch de status='done' não persistido por
    // mergeRuntimeStatus). Sem este safeguard, a UI mostra dois ou mais items
    // com badge "AO AR" simultaneamente (sintoma visual reportado).
    {
      const stale = getQueue().filter(i => i.status === 'playing' && i.id !== item.id)
      if (stale.length > 0) {
        console.warn(`[playItem] Safeguard: limpando ${stale.length} item(s) em 'playing' órfão(s) antes de tocar "${item.title}":`, stale.map(i => `${i.title} (${i.id.slice(0, 8)})`))
        stale.forEach(i => updateQueueItem({ ...i, status: 'done' }))
      }
    }

    updateQueueItem({ ...item, status: 'playing' })
    console.log(`[playItem] ▶ "${item.title}" → playing (queue=${activeQueueRef.current}, order=${item.order}, adBreakId=${item.adBreakId ? 'sim' : 'não'})`)
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
            date: today(),
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
          date: today(),
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
          date: today(),
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
      abortRef.current = true
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
            removeOwnedInput(staleGuid, { ...itemMeta, source: 'discard-stale-preload' })
          }
          guid = await loadNewInput(item.filePath, itemMeta)
        }

        if (guid) {
          const ext = item.filePath.split('.').pop()?.toLowerCase() ?? ''
          const isImg = ['jpg','jpeg','png','gif','bmp','webp','tiff','tif','ico'].includes(ext)

          if (!cachedAlreadyOnAir) {
            const { transitionType: txType, transitionDurationMs: txDuration } =
              stateRef.current.settings
            const useFade  = txType === 'fade'
            const useMerge = txType === 'merge'
            const useCrossfade = useFade || useMerge

            if (useCrossfade && !isImg) {
              // ── Crossfade (Fade / Merge) ──────────────────────────────────────
              // Para crossfade com áudio contínuo:
              //   1) PreviewInput → input vai pro PVW
              //   2) PlayInput    → começa a tocar NO PVW (áudio entra gradualmente)
              //   3) waitForInputPlaying → confirma Running antes de iniciar o fade
              //   4) SetTransitionEffect1 + SetTransitionDuration1 → configura slot 1
              //   5) Transition1 → executa a transição; o vMix faz o crossfade
              // O clip anterior continua tocando no PGM durante o fade — sem dead air.
              await executeVmixCommand('PreviewInput', { input: guid, meta: itemMeta })
              await sleep(100)
              await executeVmixCommand('PlayInput', { input: guid, meta: itemMeta })
              await sleep(150)
              await waitForInputPlaying(guid, 1500)

              if (txDuration > 0) {
                const effectName = useFade ? 'Fade' : 'Merge'
                // Configura tipo e duração no slot 1 de transição do vMix
                await executeVmixCommand('SetTransitionEffect1', {
                  value: effectName, meta: { ...itemMeta, source: 'transition-config' }, validate: false,
                })
                await executeVmixCommand('SetTransitionDuration1', {
                  value: String(txDuration), meta: { ...itemMeta, source: 'transition-config' }, validate: false,
                })
                await executeVmixCommand('Transition1', { meta: itemMeta })
              } else {
                // Usa a duração atual configurada no vMix (botão Fade da interface)
                await executeVmixCommand(useFade ? 'Fade' : 'Merge', { meta: itemMeta })
              }

            } else {
              // ── Corte seco (Cut) — padrão e para imagens ─────────────────────
              // Ordem correta para vMix 28+:
              //   1) PreviewInput  → input vai pro PVW
              //   2) Cut           → PVW vira PGM (input visível mas ainda Paused)
              //   3) PlayInput     → só agora o clip começa a reproduzir
              await executeVmixCommand('PreviewInput', { input: guid, meta: itemMeta })
              await sleep(150)
              await executeVmixCommand('Cut', { meta: itemMeta })
              await sleep(150)
              if (!isImg) {
                await executeVmixCommand('PlayInput', { input: guid, meta: itemMeta })
                // Aguarda até 1.5s confirmando Running. Só retenta se vMix realmente não respondeu.
                const ok = await waitForInputPlaying(guid, 1500)
                if (!ok) {
                  console.warn(`[SpotMaster] PlayInput retry for "${item.title}" — vMix did not confirm Running within 1.5s`)
                  await executeVmixCommand('PlayInput', {
                    input: guid,
                    meta: { ...itemMeta, source: 'playout-retry' },
                  })
                }
              }
            }

            // Remove o input anterior após a transição completar.
            // Para crossfade: espera a duração do fade + 2s de margem antes de remover.
            const prevGuid = activeInputRef.current
            if (prevGuid) {
              const removeDelay = useCrossfade && txDuration > 0 ? txDuration + 2000 : 5000
              removeOwnedInput(prevGuid, { ...itemMeta, source: 'remove-previous-input' }, removeDelay)
            }

            activeInputRef.current = guid
          }
          // When alreadyOnAir=true, skipToNext already handled Cut + activeInputRef

          onAirInput = guid
        } else {
          // File failed to load (not found or vMix rejected AddInput).
          // Log immediately as error — sequence continues to the NEXT item instead
          // of aborting the whole queue. Setting abortRef here in prior versions
          // caused the bug "para após o primeiro item": uma única falha de
          // loadNewInput (arquivo movido, vMix em estado Loading, etc.) parava
          // toda a Programação.
          console.warn(`[playout] Falha ao carregar item "${item.title}" no vMix — file=${item.filePath}. Marcando como erro e continuando para o próximo item.`)
          dispatch({
            type: 'ADD_LOG',
            payload: {
              id: crypto.randomUUID(),
              date: today(),
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
          removeOwnedInput(prevGuid, { ...itemMeta, source: 'remove-previous-input' }, 5000)
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
    // Nunca dispara em blocos comerciais (adBreakId) nem em vinhetas (type='vinheta'),
    // pois vinhetas são curtas e o GC perderia a janela de entrada/saída.
    {
      const gc = stateRef.current.settings
      if (
        gc.gcMusicEnabled &&
        gc.gcMusicInputName &&
        !item.adBreakId &&
        item.type !== 'vinheta' &&
        item.type !== 'vmix_action' &&
        item.type !== 'pause' &&
        item.filePath &&
        !abortRef.current
      ) {
        const delayMs = (gc.gcMusicDelaySeconds ?? 5) * 1000
        const outerTimer = setTimeout(async () => {
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
              const hideTimer = setTimeout(async () => {
                if (abortRef.current) return
                await executeVmixCommand(`OverlayInput${ch}Off`, { meta: gcMeta })
              }, hide * 1000)
              gcMusicTimersRef.current.push(hideTimer)
            }
          }
        }, delayMs)
        gcMusicTimersRef.current.push(outerTimer)
      }
    }

    // ── AudioStyle placeholder visual ────────────────────────────────────────
    // Quando um item de áudio inicia, detecta o estilo configurado e ativa
    // a imagem ou input vMix associado para evitar tela preta no vMix.
    if (
      item.mediaType === 'audio' &&
      item.filePath &&
      !item.adBreakId &&
      !abortRef.current
    ) {
      const styles = stateRef.current.audioStyles
      const fileLower = item.filePath.replace(/\\/g, '/')
      const style = styles.find(s => {
        const folderLower = s.folderPath.replace(/\\/g, '/')
        return s.placeholderType !== 'none' && s.overlayChannel && (
          fileLower.startsWith(folderLower + '/') ||
          fileLower.startsWith(folderLower + '\\') ||
          fileLower === folderLower
        )
      })
      if (style && style.overlayChannel) {
        const ch = style.overlayChannel
        const phMeta = { source: 'audio-style-placeholder', risk: 'low' as const }
        ;(async () => {
          if (abortRef.current) return
          if (style.placeholderType === 'vmix_input' && style.placeholderInputName) {
            await executeVmixCommand(`OverlayInput${ch}In`, { input: style.placeholderInputName, meta: phMeta })
          } else if (style.placeholderType === 'image' && style.placeholderImage && style.placeholderInputName) {
            await executeVmixCommand('SetImage', { input: style.placeholderInputName, value: style.placeholderImage, meta: phMeta, validate: false })
            await executeVmixCommand(`OverlayInput${ch}In`, { input: style.placeholderInputName, meta: phMeta })
          }
          activeAudioPlaceholderRef.current = { channel: ch }
        })()
      }
    }

    // ── Snapshot Comercial ────────────────────────────────────────────────────
    // Tira um snapshot no vMix quando o primeiro item de um bloco comercial vai ao ar.
    // Registra prova de veiculação sem precisar de intervenção manual.
    if (
      item.adBreakId &&
      item.adBreakId !== lastSnapshotAdBreakRef.current &&
      stateRef.current.settings.snapshotOnSpot &&
      !abortRef.current
    ) {
      lastSnapshotAdBreakRef.current = item.adBreakId
      ;(async () => {
        if (abortRef.current) return
        await executeVmixCommand('Snapshot', { meta: { source: 'snapshot-comercial', risk: 'low' as const } })
      })()
    }

    dispatch({
      type: 'ADD_LOG',
      payload: {
        id: crypto.randomUUID(),
        date: today(),
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

    // ── Session snapshot — persiste para retomada após restart ───────────────
    if (onAirInput && window.spotmaster?.savePlaybackSnapshot) {
      window.spotmaster.savePlaybackSnapshot({
        itemId: item.id,
        queue: activeQueueRef.current,
        scheduleDate: activeQueueRef.current === 'schedule' ? today() : undefined,
        inputGuid: onAirInput,
        inputName: item.title,
        startedAt: new Date().toISOString(),
        totalDuration: item.duration,
        filePath: item.filePath,
      } satisfies PlaybackSnapshot)
    }

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
      // Garante que o flag de "ended" do vMix começa zerado para este input
      // — evita falso positivo se o GUID foi reutilizado (ex.: skipToNext
      // marcou preloadedInputRef.alreadyOnAir e o input já tocou antes).
      if (onAirInput) activeInputEndedRef.current.delete(onAirInput)
      console.log(`[SpotMaster] playing "${item.title}" — duration: ${durationSec}s (${totalMs}ms)`)
      const start = Date.now()
      let preloadTriggered = false
      while (Date.now() - start < totalMs) {
        if (abortRef.current) break
        const elapsed = Date.now() - start

        // ── Detecta fim do item no vMix (scrub manual ou fim natural) ──────
        // O fast-poll registra em activeInputEndedRef quando o position do
        // input alcança a duração. Aqui quebramos o wait sem esperar o
        // wall-clock — sem isto, o operador adiantando o arquivo no vMix
        // deixa a sequência travada esperando minutos com o vMix ocioso.
        // Mínimo de 1.5s evita falso positivo no startup do input (estado
        // transiente onde position pode estar próximo de duration).
        if (onAirInput && elapsed >= 1500 && activeInputEndedRef.current.has(onAirInput)) {
          console.log(`[playItem] "${item.title}" terminou no vMix (scrub ou fim natural) — avançando antes do wall-clock.`)
          activeInputEndedRef.current.delete(onAirInput)
          break
        }

        // Só atualiza a barra pelo wall-clock quando não há input vMix ativo (ex: pausa).
        // Quando há input, o fast-polling é a única fonte de progresso — evita oscilação.
        if (!onAirInput) {
          setPlaybackProgress({
            inputNum: 'clock',
            position: elapsed,
            duration: totalMs,
          })
        }
        // ── Anticipatory preload ─────────────────────────────────────────────
        // Inicia o carregamento do próximo item 2s após o atual começar a tocar,
        // ou no máximo 3s antes do fim (o que vier primeiro). Assim vinhetas
        // curtas (< 5s) ainda têm tempo de preload antes de acabar.
        //
        // Guards de NÃO-preload:
        //  - stopAfterCurrentRef armado: usuário pediu Stop Next; carregar o
        //    próximo só geraria input fantasma no vMix que ninguém vai tocar.
        if (!preloadTriggered && nextFilePath && window.spotmaster && !stopAfterCurrentRef.current) {
          const remaining = totalMs - elapsed
          if (elapsed >= 2000 || remaining <= 3000) {
            preloadTriggered = true
            const fpToLoad = nextFilePath
            console.log(`[SpotMaster] preloading next: "${fpToLoad}" (elapsed ${(elapsed / 1000).toFixed(1)}s / ${(remaining / 1000).toFixed(1)}s remaining)`)
            loadNewInput(fpToLoad, {
              source: 'preload-next-input',
              queue: activeQueueRef.current === 'schedule' ? 'schedule' : 'playlist',
            }).then(preGuid => {
              if (!preGuid) return
              // Sequência terminou (Stop, Stop Next, fim natural ou erro) durante
              // o load — descarta imediatamente para evitar input fantasma.
              if (abortRef.current || sequenceEndedRef.current || stopAfterCurrentRef.current) {
                removeOwnedInput(preGuid, { source: 'discard-aborted-preload', queue: 'system' })
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
    window.spotmaster?.clearPlaybackSnapshot?.()

    // Desativar placeholder visual de AudioStyle quando item termina
    if (item.mediaType === 'audio' && activeAudioPlaceholderRef.current) {
      const { channel } = activeAudioPlaceholderRef.current
      activeAudioPlaceholderRef.current = null
      executeVmixCommand(`OverlayInput${channel}Off`, { meta: { source: 'audio-style-placeholder', risk: 'low' } })
    }

    // Mark done. Items interrupted by a scheduled block go 'done' —
    // playout always moves forward, never returns to what was playing.
    const fresh = getQueue().find(i => i.id === item.id)
    if (fresh && fresh.status !== 'done' && fresh.status !== 'skipped') {
      console.log(`[playItem] ✓ "${item.title}" → done (status anterior: ${fresh.status})`)
      updateQueueItem({ ...fresh, status: 'done' })
    } else if (!fresh) {
      // Item sumiu da queue entre o início e o fim do playItem — auto-sync
      // regenerou o schedule com IDs novos. Loga para diagnóstico.
      console.warn(`[playItem] ⚠ "${item.title}" (id=${item.id.slice(0, 8)}) sumiu da queue ao terminar — schedule foi regenerado durante playback. Item pode ter ficado 'playing' órfão.`)
    } else {
      console.log(`[playItem] = "${item.title}" já estava ${fresh.status}, não muda`)
    }
  }, [dispatch, loadNewInput, removeOwnedInput, waitForInputPlaying, vmixMetaForItem])

  // ── runSequence ─────────────────────────────────────────────────────────────
  // Infinite while-loop that reads the LIVE playlist on every iteration.
  // This means:
  //   - Items added DURING playback are picked up automatically.
  //   - The sequence only stops when there are genuinely no more pending items
  //     (or stopPlayback() sets abortRef).
  const runSequence = useCallback(async () => {
    sequenceEndedRef.current = false  // sinaliza que estamos ativos para preloads em voo
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

      // If an autoplay scheduler started/interrupted the sequence, play only
      // the items that are due now. Once none are due, stop and wait for the
      // next scheduler tick. This prevents empty musical placeholders from
      // being skipped until future commercial blocks play before their time.
      //
      // EXCEÇÃO: settings.continuousPlayback (Playlist Contínua) faz o motor
      // CONTINUAR tocando o próximo pending por ordem após o bloco comercial
      // terminar, em vez de parar e esperar o próximo agendamento. Útil quando
      // a Programação tem playlist musical entre os blocos e o operador quer
      // que ela toque ininterrupta.
      if (
        activeQueueRef.current === 'schedule' &&
        (autoPlay || autoplayComerciais) &&
        scheduledDue.length === 0 &&
        (scheduleInterruptTimeRef.current !== '' || commInterruptTimeRef.current !== '') &&
        !stateRef.current.settings.continuousPlayback
      ) {
        break
      }
      // Quando continuousPlayback está ON e o bloco comercial terminou,
      // limpa o flag de interrupt pra que o próximo bloco comercial possa
      // ser disparado mais tarde (caso contrário, commInterruptTimeRef
      // ainda guarda o triggerTime do bloco que acabou de tocar e bloqueia
      // detecção de novos blocos com o mesmo horário em outras execuções).
      if (
        activeQueueRef.current === 'schedule' &&
        scheduledDue.length === 0 &&
        commInterruptTimeRef.current !== '' &&
        stateRef.current.settings.continuousPlayback
      ) {
        commInterruptTimeRef.current = ''
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
      if (!hasPlayableContent(next)) {
        const hasPlayableAhead = candidatePending.some(i =>
          i.order > next.order && hasPlayableContent(i)
        )
        if (!hasPlayableAhead) break
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
            date: today(),
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
    sequenceEndedRef.current = true  // sinaliza preloads em voo para se descartarem
    scheduleInterruptTimeRef.current = ''
    commInterruptTimeRef.current = ''
    minOrderRef.current = -1
    dispatch({ type: 'SET_SEQUENCE_PLAYING', payload: false })
    setPlaybackProgress(null)

    // Discard any preloaded input that was never used (sequence ended before it played)
    const unusedPreload = preloadedInputRef.current
    if (unusedPreload) {
      preloadedInputRef.current = null
      removeOwnedInput(unusedPreload.guid, { source: 'discard-unused-preload', queue: 'system' })
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
      for (const g of allGuids) {
        removeOwnedInput(g, { source: 'sequence-full-sweep', queue: 'system' })
      }
    }

    // ── Safeguard final: limpa items 'playing' órfãos restantes ──────────
    // A sequência terminou (break, fim natural, erro). Qualquer item ainda
    // em 'playing' é fantasma — playItem não chegou a marcar como done
    // (interrupt + race / dispatch perdido). Marca como done agora pra UI
    // não mostrar badge "AO AR" eternamente.
    {
      const stale = getQueue().filter(i => i.status === 'playing')
      if (stale.length > 0) {
        console.warn(`[runSequence] Safeguard final: limpando ${stale.length} item(s) órfão(s) em 'playing':`, stale.map(i => i.title))
        stale.forEach(i => updateQueueItem({ ...i, status: 'done' }))
      }
    }

    if (window.spotmaster) window.spotmaster.vmixStopFastPolling()
  }, [dispatch, playItem, cleanupInputs, removeOwnedInput])

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

  // ── resumeFromSnapshot ───────────────────────────────────────────────────────
  // Retoma a programação após um restart. Dois cenários:
  //  • mode='live'   → o input ainda está rodando no vMix; o app só assume o
  //                     controle do timer sem reenviar Cut/PlayInput.
  //  • mode='reload' → o vMix também reiniciou e perdeu o input (típico em
  //                     queda de luz). O app carrega o arquivo fresco no vMix,
  //                     faz SetPosition para a posição calculada por wall-clock,
  //                     e dá Play. Em seguida marca alreadyOnAir=true para que
  //                     playItem só fique aguardando o restante do tempo.
  const resumeFromSnapshot = useCallback(async () => {
    if (!resumeCandidate) return
    const { itemId, queue, scheduleDate, inputGuid, elapsedSeconds, remainingSeconds, mode, filePath: snapshotFilePath } = resumeCandidate

    // Encontra o item
    const todayStr = today()
    const schedule = stateRef.current.dateSchedules[scheduleDate ?? todayStr] ?? []
    const playlist = stateRef.current.playlist
    const item = queue === 'schedule'
      ? schedule.find(i => i.id === itemId)
      : playlist.find(i => i.id === itemId)

    if (!item) { setResumeCandidate(null); return }

    // Atualiza a duração do item para o tempo restante (em segundos)
    // para que playItem espere exatamente esse tempo sem re-enviar Cut ao vMix
    const adjustedItem: PlaylistItem = { ...item, duration: Math.max(5, Math.round(remainingSeconds)), status: 'pending' }

    if (queue === 'schedule' && (scheduleDate === todayStr || !scheduleDate)) {
      let effectiveGuid = inputGuid

      if (mode === 'reload') {
        // ── Recarrega o arquivo no vMix e seeka para a posição estimada ──
        // Cenário: o vMix também reiniciou (queda de luz) — input não existe.
        // Calcula o filePath: prioriza o do snapshot (sobrevive a remontes
        // da grade), com fallback no item atual.
        const fp = snapshotFilePath ?? item.filePath
        if (!fp) {
          // Sem arquivo, não conseguimos recarregar. Aborta resume.
          console.warn('[resume] modo reload solicitado mas item não tem filePath — abortando.')
          setResumeCandidate(null)
          window.spotmaster?.clearPlaybackSnapshot?.()
          return
        }
        const resumeMeta: VmixCommandMeta = { source: 'resume-reload', queue: 'schedule', itemId: item.id, itemTitle: item.title }
        const loadedGuid = await loadNewInput(fp, resumeMeta)
        if (!loadedGuid) {
          console.error('[resume] falha ao recarregar arquivo no vMix — abortando resume.')
          setResumeCandidate(null)
          window.spotmaster?.clearPlaybackSnapshot?.()
          return
        }
        effectiveGuid = loadedGuid
        // SetPosition em ms — pula direto para onde a música estava (estimado por wall-clock)
        const seekMs = String(Math.max(0, elapsedSeconds * 1000))
        await executeVmixCommand('SetPosition', { input: loadedGuid, value: seekMs, meta: resumeMeta, validate: false })
        await executeVmixCommand('PreviewInput', { input: loadedGuid, meta: resumeMeta })
        await new Promise(r => setTimeout(r, 120))
        await executeVmixCommand('Cut', { meta: resumeMeta })
        await new Promise(r => setTimeout(r, 120))
        await executeVmixCommand('PlayInput', { input: loadedGuid, meta: resumeMeta })
        console.log(`[resume] reload: arquivo "${item.title}" recarregado, seek=${elapsedSeconds}s, faltam ${remainingSeconds}s`)
      }

      // Configura activeInputRef para que o cleanup saiba qual input remover depois
      activeInputRef.current = effectiveGuid
      spotmasterGuidsRef.current.add(effectiveGuid)

      // Sinaliza ao playItem que o input já está no ar (pula load + cut)
      preloadedInputRef.current = { guid: effectiveGuid, filePath: item.filePath ?? snapshotFilePath ?? '', alreadyOnAir: true }

      setResumeCandidate(null)
      window.spotmaster?.clearPlaybackSnapshot?.()

      // Usa startScheduleFromItem mas antes ajusta a duração na grade
      dispatch({ type: 'UPDATE_SCHEDULE_ITEM', payload: { date: todayStr, item: adjustedItem } })
      await new Promise(r => setTimeout(r, 50))
      startScheduleFromItem(itemId)
    } else {
      // Fila playlist ou data diferente — apenas desativa o banner
      setResumeCandidate(null)
      window.spotmaster?.clearPlaybackSnapshot?.()
    }
  }, [resumeCandidate, dispatch, startScheduleFromItem, loadNewInput])

  const ignoreResume = useCallback(() => {
    if (!resumeCandidate) return
    // Marca o item como done para não aparecer na sequência
    const todayStr = today()
    const { itemId, queue, scheduleDate } = resumeCandidate
    const schedule = stateRef.current.dateSchedules[scheduleDate ?? todayStr] ?? []
    const playlist = stateRef.current.playlist
    const item = queue === 'schedule'
      ? schedule.find(i => i.id === itemId)
      : playlist.find(i => i.id === itemId)
    if (item) {
      if (queue === 'schedule') {
        dispatch({ type: 'UPDATE_SCHEDULE_ITEM', payload: { date: scheduleDate ?? todayStr, item: { ...item, status: 'done' } } })
      } else {
        dispatch({ type: 'UPDATE_PLAYLIST_ITEM', payload: { ...item, status: 'done' } })
      }
    }
    setResumeCandidate(null)
    window.spotmaster?.clearPlaybackSnapshot?.()
  }, [resumeCandidate, dispatch])

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
    sequenceEndedRef.current = true  // descarta preloads tardios fora do runSequence
    scheduleInterruptRef.current = false
    scheduleInterruptTimeRef.current = ''
    commInterruptTimeRef.current = ''
    minOrderRef.current = -1
    stopAfterCurrentRef.current = false
    // Cancela timers pendentes do GC Musical (delay inicial + hide aninhado).
    // Sem isto, comandos SetText/OverlayOff podem disparar segundos após Stop.
    gcMusicTimersRef.current.forEach(t => clearTimeout(t))
    gcMusicTimersRef.current = []
    // Limpa o histórico de posição fast-poll para evitar acúmulo entre sessões longas.
    lastFastPosRef.current = {}
    // Limpa o flag de "ended" dos inputs — próxima sequência começa fresca.
    activeInputEndedRef.current.clear()
    // Descarta o arming pendente (se houver) — usuário parou tudo, não faz sentido
    // manter um input em PVW esperando o disparo automático que não vai acontecer.
    if (armedCommercialRef.current) {
      const armed = armedCommercialRef.current
      console.log(`[arming] Stop manual — descartando arming de "${armed.blockName}"`)
      removeOwnedInput(armed.guid, { source: 'arming-stop-discard', queue: 'system' })
      setArmedCommercial(null)
    }
    // Map de remoções pendentes — quem ainda tinha timer aí vai sobrescrever
    // os antigos pelos novos imediatos abaixo. A dedup interna do removeOwnedInput
    // cuida do clearTimeout. Aqui só registramos a intenção: depois deste stop,
    // não há mais nada útil esperando.
    // Desativar placeholder visual de AudioStyle se houver um ativo
    if (activeAudioPlaceholderRef.current) {
      const { channel } = activeAudioPlaceholderRef.current
      activeAudioPlaceholderRef.current = null
      executeVmixCommand(`OverlayInput${channel}Off`, { meta: { source: 'audio-style-placeholder', risk: 'low' } })
    }
    dispatch({ type: 'SET_SEQUENCE_PLAYING', payload: false })
    setPlaybackProgress(null)
    window.spotmaster?.clearPlaybackSnapshot?.()
    if (window.spotmaster) {
      await window.spotmaster.vmixStopFastPolling()
      // Discard any in-progress preload so it doesn't linger in vMix
      const pre = preloadedInputRef.current
      if (pre) {
        preloadedInputRef.current = null
        removeOwnedInput(pre.guid, { source: 'stop-discard-preload', queue: 'system' })
      }
      cleanupInputs(0)
      // Full sweep: remove every GUID loaded by SpotMaster this session.
      // Catches anything that escaped individual cleanup on abort/stop.
      const allGuids = [...spotmasterGuidsRef.current]
      for (const g of allGuids) {
        removeOwnedInput(g, { source: 'stop-full-sweep', queue: 'system' })
      }
    }
    getQueue()
      .filter(i => i.status === 'playing')
      .forEach(i => updateQueueItem({ ...i, status: 'pending' }))
    // Reset any schedule items stuck in 'playing' status (e.g. after app crash/close)
    const todayStr = today()
    const todaySchedule = stateRef.current.dateSchedules[todayStr]
    if (todaySchedule?.some(i => i.status === 'playing')) {
      const fixed = todaySchedule.map(i =>
        i.status === 'playing' ? { ...i, status: 'pending' as const } : i,
      )
      dispatch({ type: 'REORDER_DATE_SCHEDULE', payload: { date: todayStr, items: fixed } })
    }
  }, [dispatch, cleanupInputs, removeOwnedInput, setArmedCommercial])

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

    // ── Reaproveita o preload antecipatório se disponível ────────────────────
    // playItem dispara um preload do próximo arquivo ~2s após o item atual
    // começar. Quando o operador clica Next, o input já pode estar carregado
    // no vMix. Carregar de novo geraria um input duplicado/fantasma.
    let nextGuid: string | null
    const cached = preloadedInputRef.current
    if (cached?.filePath === nextPending.filePath) {
      nextGuid = cached.guid
      preloadedInputRef.current = null
      console.log(`[skipToNext] reaproveitando preload existente para "${nextPending.title}" (guid=${cached.guid})`)
    } else {
      if (cached) {
        // Preload é de outro arquivo (operador reordenou a fila depois) — descarta
        console.warn(`[skipToNext] descartando preload obsoleto "${cached.filePath}" (esperava "${nextPending.filePath}")`)
        const staleGuid = cached.guid
        preloadedInputRef.current = null
        removeOwnedInput(staleGuid, { ...nextMeta, source: 'next-discard-stale-preload' })
      }
      nextGuid = await loadNewInput(nextPending.filePath, nextMeta)
    }

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
      removeOwnedInput(prevGuid, { ...nextMeta, source: 'manual-next-remove-previous' }, 5000)
    }

    // Mark as already on air — playItem will skip load+cut
    activeInputRef.current = nextGuid
    preloadedInputRef.current = { guid: nextGuid, filePath: nextPending.filePath, alreadyOnAir: true }

    // Interrupt current playItem wait loop; runSequence keeps running
    disparoInterruptRef.current = true
    abortRef.current = true
  }, [loadNewInput, removeOwnedInput, vmixMetaForItem])

  // ── setStopAfterCurrent ─────────────────────────────────────────────────────
  // Arms the "Stop Next" feature: runSequence will break after the current item
  // finishes, instead of advancing to the next one. Passing false disarms it.
  const setStopAfterCurrent = useCallback((v: boolean) => {
    stopAfterCurrentRef.current = v
  }, [])

  // ── triggerAudioLayer / stopAudioLayer ─────────────────────────────────────
  // Dispara ou para uma camada de áudio configurada no AudioPro.
  // Cada camada pode estar em modo 'replace' (vai ao PGM, substituindo vídeo)
  // ou 'parallel' (toca em paralelo ao vídeo atual, sem corte no PGM).
  // Para camadas round_robin com arquivos, aplica pré-carregamento rápido (2s).

  const triggerAudioLayer = useCallback(async (layerId: string, opts?: { mode?: AudioLayerMode }) => {
    const layer = stateRef.current.audioLayers.find(l => l.id === layerId)
    if (!layer) return

    const audioMeta: VmixCommandMeta = { source: 'audiopro', category: 'audio', queue: 'manual' }

    // Para todas as camadas com stopOnNewTrigger ativo (exceto a que está sendo disparada)
    for (const [activeLayerId, session] of audioSessionsRef.current.entries()) {
      if (activeLayerId === layerId) continue
      const activeLayer = stateRef.current.audioLayers.find(l => l.id === activeLayerId)
      if (!activeLayer?.stopOnNewTrigger) continue
      session.looping = false
      session.timers.forEach(t => clearTimeout(t))
      audioSessionsRef.current.delete(activeLayerId)
      if (session.currentGuid) {
        executeVmixCommand('StopInput', { input: session.currentGuid, meta: audioMeta, validate: false }).catch(() => {})
        removeOwnedInput(session.currentGuid, audioMeta)
      }
      if (activeLayer.overlayChannel) {
        executeVmixCommand(`OverlayInput${activeLayer.overlayChannel}Out`, { meta: audioMeta, validate: false }).catch(() => {})
      }
      for (const action of (activeLayer.postActions ?? [])) {
        await executeVmixAction(action, audioMeta).catch(() => {})
      }
      setAudioLayerActive(prev => ({ ...prev, [activeLayerId]: false }))
    }

    // Para sessão anterior desta camada antes de iniciar nova
    const prevSession = audioSessionsRef.current.get(layerId)
    if (prevSession) {
      prevSession.looping = false
      prevSession.timers.forEach(t => clearTimeout(t))
      audioSessionsRef.current.delete(layerId)
    }

    const effectiveMode = opts?.mode ?? layer.defaultMode
    const playMode = layer.playMode ?? 'once'

    // Executar pré-comandos vMix
    for (const action of (layer.preActions ?? [])) {
      await executeVmixAction(action, audioMeta).catch(() => {})
    }

    // ── fixed_input mode ────────────────────────────────────────────────────
    if (layer.sourceType === 'fixed_input') {
      const inputName = layer.fixedInputName
      if (!inputName) return
      if (effectiveMode === 'replace') {
        await executeVmixCommand('PreviewInput', { input: inputName, meta: audioMeta })
        await executeVmixCommand('Cut', { meta: audioMeta })
        await executeVmixCommand('PlayInput', { input: inputName, meta: audioMeta })
      } else {
        await executeVmixCommand('PlayInput', { input: inputName, meta: audioMeta })
        if (layer.overlayChannel) {
          await executeVmixCommand(`OverlayInput${layer.overlayChannel}`, { input: inputName, meta: audioMeta, validate: false })
        }
      }
      if (layer.volume !== undefined) {
        await executeVmixCommand('SetVolume', { input: inputName, value: String(layer.volume), meta: audioMeta })
      }
      if (playMode === 'loop') {
        await executeVmixCommand('SetLoop', { input: inputName, value: '1', meta: audioMeta, validate: false })
      }
      setAudioLayerActive(prev => ({ ...prev, [layerId]: true }))
      return
    }

    // ── round_robin mode ───────────────────────────────────────────────────
    const placeholders = layer.placeholders
    if (placeholders.length === 0) return

    const session: { looping: boolean; currentGuid?: string; timers: ReturnType<typeof setTimeout>[] } = { looping: true, timers: [] }
    audioSessionsRef.current.set(layerId, session)
    setAudioLayerActive(prev => ({ ...prev, [layerId]: true }))

    let index = layer.currentIndex % placeholders.length

    const playNext = async () => {
      if (!session.looping) return
      const placeholder = placeholders[index % placeholders.length]
      const placeholderMode = placeholder.mode ?? effectiveMode
      index = (index + 1) % placeholders.length

      // Persist updated round-robin index
      dispatch({ type: 'ADVANCE_AUDIO_LAYER_INDEX', payload: { layerId, newIndex: index } })

      let guid: string | undefined

      if (placeholder.type === 'file' && placeholder.filePath) {
        // loadNewInput handles AddInput + poll for GUID + waitForInputReady
        const loaded = await loadNewInput(placeholder.filePath, audioMeta)
        guid = loaded ?? undefined
        session.currentGuid = guid

        if (guid && layer.volume !== undefined) {
          await executeVmixCommand('SetVolume', { input: guid, value: String(layer.volume), meta: audioMeta })
        }
        if (playMode === 'loop' && guid) {
          await executeVmixCommand('SetLoop', { input: guid, value: '1', meta: audioMeta, validate: false })
        }

        if (placeholderMode === 'replace') {
          if (guid) await executeVmixCommand('PreviewInput', { input: guid, meta: audioMeta })
          await executeVmixCommand('Cut', { meta: audioMeta })
          if (guid) await executeVmixCommand('PlayInput', { input: guid, meta: audioMeta })
        } else {
          if (guid) {
            await executeVmixCommand('PlayInput', { input: guid, meta: audioMeta })
            if (layer.overlayChannel) {
              await executeVmixCommand(`OverlayInput${layer.overlayChannel}`, { input: guid, meta: audioMeta, validate: false })
            }
          }
        }
      } else if (placeholder.type === 'vmix_input' && placeholder.inputName) {
        const inputName = placeholder.inputName
        if (layer.volume !== undefined) {
          await executeVmixCommand('SetVolume', { input: inputName, value: String(layer.volume), meta: audioMeta })
        }
        if (playMode === 'loop') {
          await executeVmixCommand('SetLoop', { input: inputName, value: '1', meta: audioMeta, validate: false })
        }
        if (placeholderMode === 'replace') {
          await executeVmixCommand('PreviewInput', { input: inputName, meta: audioMeta })
          await executeVmixCommand('Cut', { meta: audioMeta })
          await executeVmixCommand('PlayInput', { input: inputName, meta: audioMeta })
        } else {
          await executeVmixCommand('PlayInput', { input: inputName, meta: audioMeta })
          if (layer.overlayChannel) {
            await executeVmixCommand(`OverlayInput${layer.overlayChannel}`, { input: inputName, meta: audioMeta, validate: false })
          }
        }
      }

      // Modo loop: sem timers — sessão permanece ativa até stopAudioLayer
      if (playMode === 'loop') return

      // Modo 'once': agendar limpeza e pré-carregamento do próximo item
      const duration = placeholder.duration
      if (duration && duration > 0 && session.looping) {
        // Fast-preload: schedule next item at (duration - 2s)
        const preloadDelay = Math.max(0, (duration - 2) * 1000)
        const cleanupDelay = duration * 1000 + 200

        const preloadTimer = setTimeout(() => {
          if (!session.looping) return
          playNext()
        }, preloadDelay)
        session.timers.push(preloadTimer)

        // Cleanup current input after it finishes
        const cleanupTimer = setTimeout(() => {
          if (guid) {
            removeOwnedInput(guid, audioMeta)
          }
          if (layer.overlayChannel && placeholderMode === 'parallel') {
            executeVmixCommand(`OverlayInput${layer.overlayChannel}Out`, { meta: audioMeta, validate: false }).catch(() => {})
          }
        }, cleanupDelay)
        session.timers.push(cleanupTimer)
      } else if (placeholder.type === 'file' && guid) {
        // No duration known — play once, cleanup after 60s safety
        session.looping = false
        const safeCleanup = setTimeout(() => {
          removeOwnedInput(guid!, audioMeta)
        }, 60_000)
        session.timers.push(safeCleanup)
        setAudioLayerActive(prev => ({ ...prev, [layerId]: false }))
      }
    }

    await playNext()
  }, [dispatch, loadNewInput, removeOwnedInput])

  const stopAudioLayer = useCallback(async (layerId: string) => {
    const session = audioSessionsRef.current.get(layerId)
    const audioMeta: VmixCommandMeta = { source: 'audiopro', category: 'audio', queue: 'manual' }
    if (session) {
      session.looping = false
      session.timers.forEach(t => clearTimeout(t))
      audioSessionsRef.current.delete(layerId)
      if (session.currentGuid) {
        await executeVmixCommand('StopInput', { input: session.currentGuid, meta: audioMeta, validate: false }).catch(() => {})
        removeOwnedInput(session.currentGuid, audioMeta)
      }
    }
    const layer = stateRef.current.audioLayers.find(l => l.id === layerId)
    if (layer?.overlayChannel) {
      await executeVmixCommand(`OverlayInput${layer.overlayChannel}Out`, { meta: audioMeta, validate: false }).catch(() => {})
    }
    // Executar pós-comandos vMix após limpeza
    for (const action of (layer?.postActions ?? [])) {
      await executeVmixAction(action, audioMeta).catch(() => {})
    }
    setAudioLayerActive(prev => ({ ...prev, [layerId]: false }))
  }, [removeOwnedInput])

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
    activeQueueRef.current = 'playlist'
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
      // Detecta fim no vMix (natural ou via scrub manual): position chegou na
      // duração. Registra ANTES do guard de regressão — alguns drivers do vMix
      // resetam position para 0 logo após o fim, e perderíamos o sinal.
      // Janela de 500ms para tolerar granularidade do XML (~100ms).
      if (inp.position > 0 && inp.position >= inp.duration - 500) {
        activeInputEndedRef.current.add(num)
      }
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
      window.spotmaster.registerTrigger(triggerKey!).then(ok => {
        if (!ok) console.warn(`[disparo] Falha ao registrar tecla "${triggerKey}" — pode estar em uso por outro aplicativo.`)
      })
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
    }, 150)
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
  //
  // FAILSAFE Bug 1 (v5.5.30): se nenhum item adBreakId está em
  // dateSchedules[today] mas há um commercialBlocks habilitado com horário
  // próximo do agora, injeta o bloco inline em vez de confiar no preload de
  // 20s — garante que o disparo automático aconteça mesmo se o preload
  // ainda não rodou.
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
        const todayStr = today()
        const todayDow = new Date().getDay()
        // Lê SEMPRE a Programação do dia, ignorando activeQueueRef (que poderia ser playlist em idle)
        let schedule = stateRef.current.dateSchedules[todayStr] ?? []
        let scheduledDue = schedule.filter(
          i => i.status === 'pending' && !!i.adBreakId && i.scheduledTime && i.scheduledTime <= currentTime
        )

        // ── FAILSAFE: bloco devido SEM estar em dateSchedules ──────────────
        // Se não há items comerciais due no schedule, varre commercialBlocks
        // diretamente atrás de blocos cuja janela cobre o agora. Se achar,
        // injeta inline e re-filtra. Resolve o Bug 1: preload de 20s pode
        // não ter rodado ainda, mas o operador conta com o autoplay.
        if (scheduledDue.length === 0) {
          const [cH, cM, cS] = currentTime.split(':').map(Number)
          const currentSec = cH * 3600 + cM * 60 + (cS ?? 0)
          const preloadMin = stateRef.current.settings.preloadMinutes ?? 5
          const { commercialBlocks } = stateRef.current
          const overdueBlocks = commercialBlocks.filter(b => {
            if (!b.enabled || !b.scheduledTime) return false
            if (b.daysOfWeek && !b.daysOfWeek.includes(todayDow)) return false
            const [bH, bM, bS] = b.scheduledTime.split(':').map(Number)
            const blockSec = bH * 3600 + bM * 60 + (bS ?? 0)
            // Janela: [horário - preloadMin, horário + grace]
            const windowStart = blockSec - preloadMin * 60
            const windowEnd   = blockSec + COMMERCIAL_CATCH_UP_GRACE_SECONDS
            if (currentSec < windowStart || currentSec > windowEnd) return false
            // Já está no schedule do dia? Pula.
            return !schedule.some(i => i.adBreakId === b.id)
          })
          if (overdueBlocks.length > 0) {
            console.warn(`[autoplay-com] FAILSAFE: ${overdueBlocks.length} bloco(s) na janela atual mas ausente(s) de dateSchedules. Injetando inline.`, overdueBlocks.map(b => `${b.name}@${b.scheduledTime}`))
            let workingSchedule = schedule
            let workingRotation = stateRef.current.spotRotation
            for (const block of overdueBlocks) {
              const maxOrder = workingSchedule.length > 0
                ? Math.max(...workingSchedule.map(i => i.order))
                : 0
              const [items, newRotation] = expandBlockItems(block, maxOrder + 1, workingRotation)
              if (items.length === 0) {
                console.warn(`[autoplay-com] bloco "${block.name}" expandido para zero items — verificar spots dos clientes.`)
                continue
              }
              workingSchedule = [...workingSchedule, ...items]
              workingRotation = newRotation
            }
            if (workingSchedule.length > schedule.length) {
              dispatch({ type: 'SET_DATE_SCHEDULE', payload: { date: todayStr, items: workingSchedule } })
              dispatch({ type: 'SET_SPOT_ROTATION', payload: workingRotation })
              // Mesma proteção do generatePlaylistFromGrid: só MARK_BLOCK_LOADED se
              // ainda não estiver marcado hoje, pra não disparar auto-sync inútil.
              for (const b of overdueBlocks) {
                if (b.lastLoadedDate !== todayStr) {
                  dispatch({ type: 'MARK_BLOCK_LOADED', payload: { blockId: b.id, date: todayStr } })
                }
              }
              schedule = workingSchedule
              scheduledDue = schedule.filter(
                i => i.status === 'pending' && !!i.adBreakId && i.scheduledTime && i.scheduledTime <= currentTime
              )
            }
          }
        }

        if (scheduledDue.length === 0) return
        const triggerTime = scheduledDue.map(i => i.scheduledTime!).sort()[0]
        if (commInterruptTimeRef.current === triggerTime) {
          // Já disparamos para este horário nesta sessão. Comum acontecer
          // várias vezes por tick enquanto o bloco toca. Não loga pra não poluir.
          return
        }
        // Permite catch-up comercial por uma janela curta apos o horario, mesmo se
        // sessionStart bloquearia itens antigos. Depois disso, evita disparar
        // comerciais muito atrasados sem intervencao do operador.
        const sessionStart = sessionStartRef.current
        const graceSec = COMMERCIAL_CATCH_UP_GRACE_SECONDS
        const [tH, tM, tS] = triggerTime.split(':').map(Number)
        const [sH, sM, sS] = sessionStart.split(':').map(Number)
        const triggerSec = tH * 3600 + tM * 60 + (tS ?? 0)
        const sessionSec = sH * 3600 + sM * 60 + (sS ?? 0)
        if (triggerSec < sessionSec - graceSec) {
          console.warn(`[autoplay-com] bloco @${triggerTime} ignorado: passou ${Math.round((sessionSec - graceSec - triggerSec) / 60)} min antes do sessionStart (${sessionStart}). Grace=${graceSec}s.`)
          return
        }
        // ── Reaproveita o arming pré-carregado, se for o mesmo bloco ──────
        // O scheduler de arming (2s) já colocou o GUID em PVW do vMix 30s antes.
        // Aqui transferimos pra preloadedInputRef para que o playItem use
        // diretamente via Cut, sem AddInput sob pressão.
        //
        // Match por (blockId + filePath) — não por item.id, que pode ter sido
        // regenerado por algum auto-sync entre o arming e o disparo. O playItem
        // já consome preloadedInputRef baseado em filePath ([AppContext:~1696]),
        // então isso é coerente em todo o pipeline.
        const armed = armedCommercialRef.current
        const armedMatch = !!(armed
          && armed.scheduleDate === todayStr
          && armed.blockId === scheduledDue[0].adBreakId
          && scheduledDue.some(i => i.filePath === armed.filePath))
        if (armedMatch && armed) {
          console.log(`[autoplay-com] usando arming pré-carregado para "${armed.blockName}" (filePath match)`)
          // ── Importante: descartar preload musical antigo se houver ─────
          // Cenário: música tocando, playItem disparou anticipatory preload
          // do próximo musical (preloadedInputRef = guid_Y). Aí o bloco
          // comercial chega — vamos sobrescrever preloadedInputRef com o
          // guid do arming. Se não removermos guid_Y do vMix primeiro, ele
          // fica fantasma no projeto sem dono.
          const existingPreload = preloadedInputRef.current
          if (existingPreload && existingPreload.guid !== armed.guid) {
            console.log(`[autoplay-com] descartando preload musical "${existingPreload.filePath}" (guid=${existingPreload.guid}) — bloco comercial assumiu o slot`)
            removeOwnedInput(existingPreload.guid, { source: 'arming-replaces-musical-preload', queue: 'system' })
          }
          preloadedInputRef.current = {
            guid: armed.guid,
            filePath: armed.filePath,
            // alreadyOnAir false: ainda está só em PVW, playItem faz Cut normal
            alreadyOnAir: false,
          }
          setArmedCommercial(null)
        }

        if (!stateRef.current.isSequencePlaying) {
          console.log(`[autoplay-com] disparando bloco @${triggerTime} (app idle → startSchedule)${armedMatch ? ' [com arming]' : ''}`)
          commInterruptTimeRef.current = triggerTime
          startSchedule() // SEMPRE inicia a Programação, nunca a Playlist
        } else {
          // Já está tocando a Programação — interrompe para saltar ao bloco devido
          console.log(`[autoplay-com] interrompendo sequência para bloco @${triggerTime}${armedMatch ? ' [com arming]' : ''}`)
          commInterruptTimeRef.current = triggerTime
          scheduleInterruptRef.current = true
          abortRef.current = true
        }
      } finally {
        schedulerFiringRef.current = false
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [state.isLoading, startSchedule, expandBlockItems, dispatch, setArmedCommercial, removeOwnedInput])

  // ── Scheduler: Pre-arming de bloco comercial (v5.5.31) ─────────────────────
  // A cada 2s, varre dateSchedules procurando items adBreakId pending cujo
  // scheduledTime esteja entre +1s e +ARMING_LEAD_SEC (30s). Para o mais
  // próximo, pre-carrega o primeiro item playable no vMix e coloca em PVW.
  // Quando o scheduler comercial dispara, transfere o GUID armado para
  // preloadedInputRef e o playItem usa direto via Cut — sem AddInput de novo.
  // Elimina a janela de risco "AddInput sob pressão na hora exata".
  useEffect(() => {
    if (state.isLoading) return
    const ARMING_LEAD_SEC = 30
    const interval = setInterval(async () => {
      if (armingFiringRef.current) return
      armingFiringRef.current = true
      try {
        if (!stateRef.current.settings.autoplayComerciais) {
          // autoplayComerciais desligado: descarta arming pendente
          if (armedCommercialRef.current) {
            const old = armedCommercialRef.current
            console.log(`[arming] autoplayComerciais OFF — descartando bloco "${old.blockName}"`)
            removeOwnedInput(old.guid, { source: 'arming-discard-autoplay-off', queue: 'system' })
            setArmedCommercial(null)
          }
          return
        }
        // Se a Playlist manual está tocando, não arma (mesmo escopo do scheduler comercial)
        if (stateRef.current.isSequencePlaying && activeQueueRef.current === 'playlist') return

        const todayStr = today()
        const currentTime = now()
        const [cH, cM, cS] = currentTime.split(':').map(Number)
        const currentSec = cH * 3600 + cM * 60 + (cS ?? 0)

        const schedule = stateRef.current.dateSchedules[todayStr] ?? []

        // Procura item comercial pending cuja janela [+1s, +30s] cobre o agora
        const upcomingByTime = schedule
          .filter(i => {
            if (i.status !== 'pending') return false
            if (!i.adBreakId) return false
            if (!i.scheduledTime) return false
            return true
          })
          .map(i => {
            const [bH, bM, bS] = i.scheduledTime!.split(':').map(Number)
            const itemSec = bH * 3600 + bM * 60 + (bS ?? 0)
            return { item: i, sec: itemSec, diff: itemSec - currentSec }
          })
          .filter(x => x.diff > 0 && x.diff <= ARMING_LEAD_SEC)
          .sort((a, b) => a.diff - b.diff)

        const firstUpcoming = upcomingByTime[0]?.item

        // ── Casos de descarte do arming atual ──────────────────────────────
        // IMPORTANTE: usamos (blockId + filePath) como chave de identidade.
        // item.id era instável — qualquer re-geração de schedule (MERGE mode
        // do generatePlaylistFromGrid, executado pelo auto-sync useEffect)
        // criava UUIDs novos para os items pending, fazendo o check
        // "item.id ainda existe" falhar a cada 2-20s. Banner piscava sem fim,
        // input do vMix entrava/saia, e na hora do disparo o GUID armado
        // não casava com o item.id de scheduledDue → primeiro item do bloco
        // pulava. Chave (block + arquivo) é estável entre regenerações.
        if (armedCommercialRef.current) {
          const armed = armedCommercialRef.current
          // 1. O bloco armado já passou da hora há > 1min — vMix scheduler ainda
          //    não tocou; algo deu errado. Descarta.
          const [aH, aM, aS] = armed.fireAt.split(':').map(Number)
          const armedSec = aH * 3600 + aM * 60 + (aS ?? 0)
          const armedPassedTooLong = currentSec > armedSec + 60
          // 2. Trocou o dia
          const stale = armed.scheduleDate !== todayStr
          // 3. Item logicamente equivalente ainda no schedule? Casa por
          //    (blockId + filePath + status pending) — sobrevive a regens.
          const matchedItem = schedule.find(i =>
            i.adBreakId === armed.blockId &&
            i.filePath === armed.filePath &&
            i.status === 'pending'
          )
          const armedItemStillExists = !!matchedItem

          if (armedPassedTooLong || !armedItemStillExists || stale) {
            console.warn(`[arming] descartando "${armed.blockName}" @${armed.fireAt} — passedTooLong=${armedPassedTooLong} itemMissing=${!armedItemStillExists} stale=${stale}`)
            removeOwnedInput(armed.guid, { source: 'arming-discard-stale', queue: 'system' })
            setArmedCommercial(null)
          } else if (firstUpcoming && firstUpcoming.adBreakId !== armed.blockId) {
            // 4. Apareceu um bloco DIFERENTE mais próximo — descarta e re-arma
            //    (compara blockId, não item.id, pra ignorar regens).
            console.log(`[arming] re-armando: bloco mais próximo "${firstUpcoming.title}" substitui "${armed.blockName}"`)
            removeOwnedInput(armed.guid, { source: 'arming-discard-replaced', queue: 'system' })
            setArmedCommercial(null)
          } else {
            // Arming ainda válido (mesmo bloco, mesmo arquivo) — só refreshamos
            // o firstItemId pra que o scheduler comercial possa fazer match por
            // id também (defensive — match principal agora é por filePath).
            if (matchedItem && matchedItem.id !== armed.firstItemId) {
              setArmedCommercial({ ...armed, firstItemId: matchedItem.id })
            }
            return
          }
        }

        // ── Cria novo arming ──────────────────────────────────────────────
        if (!firstUpcoming) return
        if (!window.spotmaster) return

        // Encontra o primeiro item playable do bloco (pode haver vmix_action
        // antes do primeiro arquivo)
        const blockId = firstUpcoming.adBreakId!
        const blockItems = schedule
          .filter(i => i.adBreakId === blockId && i.status === 'pending')
          .sort((a, b) => a.order - b.order)
        const firstPlayable = blockItems.find(i => i.filePath)
        if (!firstPlayable?.filePath) {
          // Bloco só tem vmix_action ou inputs vMix permanentes — nada pra pré-carregar.
          return
        }

        const blockName = stateRef.current.commercialBlocks.find(b => b.id === blockId)?.name ?? 'Bloco'
        const armingMeta: VmixCommandMeta = {
          source: 'arming-pre-load',
          queue: 'schedule',
          itemId: firstPlayable.id,
          itemTitle: firstPlayable.title,
          scheduledTime: firstPlayable.scheduledTime,
        }

        console.log(`[arming] pre-carregando "${blockName}" @${firstUpcoming.scheduledTime} (em ${upcomingByTime[0].diff}s) → primeiro item: "${firstPlayable.title}"`)
        const guid = await loadNewInput(firstPlayable.filePath, armingMeta)
        if (!guid) {
          console.warn(`[arming] falha em loadNewInput para "${firstPlayable.title}" — vMix não respondeu. Tentará de novo no próximo tick.`)
          return
        }

        // Marca em PVW pra operador ver visualmente que o bloco está armado
        await executeVmixCommand('PreviewInput', { input: guid, meta: armingMeta })

        setArmedCommercial({
          blockId,
          blockName,
          firstItemId: firstPlayable.id,
          guid,
          filePath: firstPlayable.filePath,
          fireAt: firstUpcoming.scheduledTime!,
          scheduleDate: todayStr,
        })
        console.log(`[arming] ✓ "${blockName}" ARMADO em PVW (guid=${guid})`)
      } finally {
        armingFiringRef.current = false
      }
    }, 2000)
    return () => clearInterval(interval)
  }, [state.isLoading, loadNewInput, removeOwnedInput, setArmedCommercial])

  // ── Scheduler: Pré-carregamento de blocos comerciais ──────────────────────
  // Lê commercialBlocks diretamente (sem depender de Programação do Dia) e
  // injeta os blocos em dateSchedules dentro da janela de preloadMinutes.
  // Resolve o caso em que o usuário não gerou a programação do dia mas tem
  // autoplayComerciais ligado — os blocos agora aparecem automaticamente na fila.
  // Roda imediatamente no startup e depois a cada 20s. O disparo real continua no scheduler de 1s.
  useEffect(() => {
    if (state.isLoading) return

    const runPreload = () => {
      if (!stateRef.current.settings.autoplayComerciais) return

      const todayStr = today()
      const todayDow = new Date().getDay()
      const currentTime = now()
      const preloadMin = stateRef.current.settings.preloadMinutes ?? 5
      const { commercialBlocks, dateSchedules, spotRotation } = stateRef.current
      let workingSchedule = dateSchedules[todayStr] ?? []
      let workingRotation = spotRotation

      const [cH, cM, cS] = currentTime.split(':').map(Number)
      const currentSec = cH * 3600 + cM * 60 + (cS ?? 0)

      for (const block of commercialBlocks) {
        if (!block.enabled || !block.scheduledTime) continue
        if (block.daysOfWeek && !block.daysOfWeek.includes(todayDow)) continue
        const alreadyInSchedule = workingSchedule.some(i => i.adBreakId === block.id)
        if (block.lastLoadedDate === todayStr && alreadyInSchedule) continue

        // Janela de pré-carregamento: [scheduledTime - preloadMin, scheduledTime + catch-up grace]
        const [bH, bM, bS] = block.scheduledTime.split(':').map(Number)
        const blockSec = bH * 3600 + bM * 60 + (bS ?? 0)
        const windowStart = blockSec - preloadMin * 60
        const windowEnd   = blockSec + COMMERCIAL_CATCH_UP_GRACE_SECONDS

        if (currentSec < windowStart || currentSec > windowEnd) continue

        // Não duplicar: verificar se itens do bloco já estão na programação como pending
        const alreadyPending = workingSchedule.some(
          i => i.adBreakId === block.id && i.status === 'pending'
        )
        if (alreadyPending) continue

        // Expandir e injetar na programação do dia
        const maxOrder = workingSchedule.length > 0
          ? Math.max(...workingSchedule.map(i => i.order))
          : 0
        const [items, newRotation] = expandBlockItems(block, maxOrder + 1, workingRotation)
        if (items.length === 0) continue

        workingSchedule = [...workingSchedule, ...items]
        workingRotation = newRotation
        dispatch({ type: 'SET_DATE_SCHEDULE', payload: { date: todayStr, items: workingSchedule } })
        dispatch({ type: 'SET_SPOT_ROTATION', payload: workingRotation })
        // Só MARK_BLOCK_LOADED se a data ainda for diferente — dispatch redundante
        // muda referência de commercialBlocks e dispara auto-sync que regenera o
        // schedule com novos UUIDs (era a causa do banner de arming "piscar").
        if (block.lastLoadedDate !== todayStr) {
          dispatch({ type: 'MARK_BLOCK_LOADED', payload: { blockId: block.id, date: todayStr } })
        }

        // Persiste imediatamente para sobreviver reload
        if (window.spotmaster) {
          window.spotmaster.saveData('dateSchedules',
            { ...stateRef.current.dateSchedules, [todayStr]: workingSchedule }
          )
          window.spotmaster.saveData('spotRotation', workingRotation)
        }

        console.log(`[SpotMaster] Bloco comercial pré-carregado: "${block.name}" (${block.scheduledTime})`)
      }
    }

    runPreload()  // Roda imediatamente ao carregar — evita o delay de 20s no startup
    const interval = setInterval(runPreload, 20000)
    return () => clearInterval(interval)
  }, [state.isLoading, expandBlockItems, dispatch])

  // ── Load all data on startup ───────────────────────────────────────────────
  const loadAllStartedRef = useRef(false)
  useEffect(() => {
    if (loadAllStartedRef.current) return  // StrictMode/dev re-mount guard — load once
    loadAllStartedRef.current = true
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
               grafismoInputsRaw, grafismoTemplatesRaw, musicLibraryRaw, audioLayersRaw,
               videoStylesRaw, audioStylesRaw, vmixOutputProfilesRaw] =
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
            window.spotmaster.loadData('musicLibrary'),
            window.spotmaster.loadData('audioLayers'),
            window.spotmaster.loadData('videoStyles'),
            window.spotmaster.loadData('audioStyles'),
            window.spotmaster.loadData('vmixOutputProfiles'),
          ])
        // Diagnóstico: log do que veio do disco para o usuário poder
        // identificar via DevTools (Ctrl+Shift+I) se algum arquivo está null
        // ou vazio quando o problema "programação não carrega" reaparecer.
        const _datesCount = dateSchedulesRaw && typeof dateSchedulesRaw === 'object'
          ? Object.keys(dateSchedulesRaw).length
          : 0
        const _todayHasData = dateSchedulesRaw && typeof dateSchedulesRaw === 'object'
          ? Array.isArray((dateSchedulesRaw as Record<string, unknown>)[today()])
          : false
        console.log(`[loadAll] disk → ${_datesCount} dia(s) salvo(s), today (${today()}) ${_todayHasData ? 'tem' : 'NÃO tem'} dados | grid keys: ${Object.keys((gridRaw as object) ?? {}).length} | blocos: ${((blocksRaw as unknown[]) ?? []).length}`)

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
            musicLibrary:         (musicLibraryRaw as MusicTrack[])                ?? [],
            audioLayers:          (audioLayersRaw as AudioLayer[])                 ?? [],
            videoStyles:          (videoStylesRaw as VideoStyle[])                 ?? [],
            audioStyles:          (audioStylesRaw as AudioStyle[])                 ?? [],
            vmixOutputProfiles:   (vmixOutputProfilesRaw as VmixOutputProfile[])   ?? [],
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

  // ── Detecção de sessão anterior ao conectar no vMix ──────────────────────
  useEffect(() => {
    if (!state.vmixStatus.connected) return
    if (resumeDetectedRef.current) return    // roda apenas na primeira conexão
    if (state.isLoading) return
    resumeDetectedRef.current = true

    ;(async () => {
      if (!window.spotmaster?.loadPlaybackSnapshot) return
      const snapshot = await window.spotmaster.loadPlaybackSnapshot() as PlaybackSnapshot | null
      if (!snapshot) return

      // Rejeita snapshots com mais de 4 horas
      const ageMs = Date.now() - new Date(snapshot.startedAt).getTime()
      if (ageMs > 4 * 60 * 60 * 1000) {
        window.spotmaster?.clearPlaybackSnapshot?.()
        return
      }

      // Só retoma sessões do dia atual
      const todayStr = today()
      if (snapshot.scheduleDate && snapshot.scheduleDate !== todayStr) {
        window.spotmaster?.clearPlaybackSnapshot?.()
        return
      }

      // Encontra o item na fila
      const { playlist, dateSchedules } = stateRef.current
      let item: PlaylistItem | undefined
      if (snapshot.queue === 'schedule') {
        item = dateSchedules[snapshot.scheduleDate ?? todayStr]?.find(i => i.id === snapshot.itemId)
      } else {
        item = playlist.find(i => i.id === snapshot.itemId)
      }

      if (!item || item.status !== 'playing') {
        window.spotmaster?.clearPlaybackSnapshot?.()
        return
      }

      // Verifica se o input ainda está rodando no vMix
      const vmixSt = stateRef.current.vmixStatus
      const inp = vmixSt.inputs?.find(i =>
        (snapshot.inputGuid && (i.key === snapshot.inputGuid || i.number === snapshot.inputGuid)) ||
        (snapshot.inputName && i.title === snapshot.inputName)
      )
      if (!inp || inp.state !== 'Running') {
        // ── vMix esqueceu o input ────────────────────────────────────────
        // Aconteceu uma de duas coisas:
        //  (a) o item terminou de tocar enquanto o app estava fechado;
        //  (b) o vMix também reiniciou (queda de luz / kill geral) e
        //      simplesmente perdeu o input.
        //
        // Para distinguir: calculamos por wall-clock quanto tempo se passou
        // desde `snapshot.startedAt`. Se já passou TUDO (+5 s de folga),
        // assumimos (a) e marcamos como done. Se ainda sobra tempo e temos
        // um filePath, oferecemos resume no modo 'reload' — o app vai
        // recarregar o arquivo no vMix e SetPosition para o ponto calculado.
        const wallElapsedSec = Math.round((Date.now() - new Date(snapshot.startedAt).getTime()) / 1000)
        const wallRemainingSec = snapshot.totalDuration - wallElapsedSec

        if (wallRemainingSec <= 5 || !snapshot.filePath) {
          // Já passou o tempo todo OU é um input permanente vMix (sem arquivo
          // pra recarregar). Marca como done e segue.
          if (item) {
            if (snapshot.queue === 'schedule') {
              dispatch({ type: 'UPDATE_SCHEDULE_ITEM', payload: { date: snapshot.scheduleDate ?? todayStr, item: { ...item, status: 'done' } } })
            } else {
              dispatch({ type: 'UPDATE_PLAYLIST_ITEM', payload: { ...item, status: 'done' } })
            }
          }
          window.spotmaster?.clearPlaybackSnapshot?.()
          return
        }

        // Item foi interrompido a meio (queda de luz típica). Oferece
        // retomada via recarga do arquivo + seek na posição wall-clock.
        setResumeCandidate({
          itemId: item.id,
          queue: snapshot.queue,
          scheduleDate: snapshot.scheduleDate,
          inputGuid: '',                       // vai ser preenchido no resumeFromSnapshot
          elapsedSeconds: wallElapsedSec,
          remainingSeconds: wallRemainingSec,
          inputTitle: item.title,
          mode: 'reload',
          filePath: snapshot.filePath,
        })
        return
      }

      const elapsedSeconds = Math.round(inp.position / 1000)
      const remainingSeconds = Math.max(0, snapshot.totalDuration - elapsedSeconds)
      if (remainingSeconds <= 5) {
        // Menos de 5s restantes — não vale a pena retomar
        window.spotmaster?.clearPlaybackSnapshot?.()
        return
      }

      // Modo 'live': o input ainda está rodando no vMix, o app só vai
      // assumir o controle do timer sem re-enviar Cut/PlayInput.
      setResumeCandidate({
        itemId: item.id,
        queue: snapshot.queue,
        scheduleDate: snapshot.scheduleDate,
        inputGuid: snapshot.inputGuid ?? inp.key ?? inp.number ?? '',
        elapsedSeconds,
        remainingSeconds,
        inputTitle: item.title,
        mode: 'live',
        filePath: snapshot.filePath,
      })
    })()
  }, [state.vmixStatus.connected, state.isLoading])

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
    const cutoffStr = dateToLocalYmd(cutoff)
    const pruned = Object.fromEntries(
      Object.entries(state.dateSchedules).filter(([date]) => date >= cutoffStr),
    )
    // Guard: nunca persiste {} no disco. Se o state ficou vazio por race
    // transitória durante startup (LOAD_ALL com disk vazio, ou erro em
    // generatePlaylistFromGrid antes de popular today), o save de {}
    // sobrescreve dados legítimos do dia anterior e o usuário abre o app
    // achando que o dia "sumiu". Pular o save é seguro: na próxima mudança
    // legítima de dateSchedules o save dispara normal.
    if (Object.keys(pruned).length === 0) {
      console.warn('[persist] dateSchedules vazio — save ignorado (proteção contra wipe acidental)')
      return
    }
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
    const cutoffStr = dateToLocalYmd(cutoff)
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

  useEffect(() => {
    if (!state.isLoading) saveToStorage('musicLibrary', state.musicLibrary)
  }, [state.musicLibrary, state.isLoading, saveToStorage])

  useEffect(() => {
    if (!state.isLoading) saveToStorage('audioLayers', state.audioLayers)
  }, [state.audioLayers, state.isLoading, saveToStorage])

  useEffect(() => {
    if (!state.isLoading) saveToStorage('videoStyles', state.videoStyles)
  }, [state.videoStyles, state.isLoading, saveToStorage])

  useEffect(() => {
    if (!state.isLoading) saveToStorage('audioStyles', state.audioStyles)
  }, [state.audioStyles, state.isLoading, saveToStorage])

  useEffect(() => {
    if (!state.isLoading) saveToStorage('vmixOutputProfiles', state.vmixOutputProfiles)
  }, [state.vmixOutputProfiles, state.isLoading, saveToStorage])

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

  // Tracks whether a schedule sync was deferred because the sequence was playing.
  // Cleared once the sync actually runs.
  const needsScheduleSyncRef = useRef(false)

  // ── Auto-sync schedule when commercial blocks are configured or modified ─────
  // Replaces pending commercial items with refreshed content as soon as the
  // operator saves a block edit. When the sequence is playing we defer the merge
  // to avoid async status overwrites — the deferred-retry effect picks it up.
  // Safe to run immediately when minOrderRef = -1 (no commercial has fired yet,
  // so no high-water-mark to corrupt).
  useEffect(() => {
    if (state.isLoading) return
    const todayStr = today()
    const schedule = stateRef.current.dateSchedules[todayStr]
    if (!schedule || schedule.length === 0) return  // fresh-generation handles new days
    if (stateRef.current.isSequencePlaying && minOrderRef.current !== -1) {
      // A commercial has already fired — renumbering while playing is risky.
      // Defer until the sequence stops.
      needsScheduleSyncRef.current = true
      return
    }
    needsScheduleSyncRef.current = false
    generatePlaylistFromGrid(todayStr, true, undefined, false)  // auto-sync: no backup
  }, [state.commercialBlocks]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Deferred-retry: sync schedule as soon as the sequence stops ─────────────
  // Picks up updates that were deferred while a commercial had already fired.
  useEffect(() => {
    if (state.isLoading || state.isSequencePlaying) return
    if (!needsScheduleSyncRef.current) return
    needsScheduleSyncRef.current = false
    const todayStr = today()
    const schedule = stateRef.current.dateSchedules[todayStr]
    if (!schedule || schedule.length === 0) return
    generatePlaylistFromGrid(todayStr, true, undefined, false)  // auto-sync: no backup
  }, [state.isSequencePlaying, state.isLoading]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Max 1-minute guarantee for deferred schedule sync ────────────────────────
  // If the sequence stays running for a long time without stopping, this timer
  // fires every 60 s and runs the merge as soon as the sequence is idle.
  useEffect(() => {
    if (state.isLoading) return
    const interval = setInterval(() => {
      if (!needsScheduleSyncRef.current) return
      if (stateRef.current.isSequencePlaying) return  // still not safe to merge
      needsScheduleSyncRef.current = false
      const todayStr = today()
      const schedule = stateRef.current.dateSchedules[todayStr]
      if (!schedule || schedule.length === 0) return
      generatePlaylistFromGrid(todayStr, true, undefined, false)  // auto-sync: no backup
    }, 60_000)
    return () => clearInterval(interval)
  }, [state.isLoading]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <AppContext.Provider value={{ state, dispatch, t, saveToStorage, playItem, playSingleItem, startSequence, startSchedule, startScheduleFromNow, startScheduleFromItem, pauseSchedule, stopPlayback, loadBlockIntoPlaylist, disparo, generatePlaylistFromGrid, skipToNext, setStopAfterCurrent, triggerAudioLayer, stopAudioLayer, audioLayerActive, resumeCandidate, resumeFromSnapshot, ignoreResume, armedCommercial }}>
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
