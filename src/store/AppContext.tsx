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
  AdBreak,
  Client,
  PlayLog,
  AppSettings,
  VmixStatus,
  ClientSpot,
  CommercialBlock,
  SpotRotation,
} from '../types'
import { getTranslations } from '../i18n'
import type { Translations } from '../i18n'
import { now } from '../utils/time'

const DEFAULT_SETTINGS: AppSettings = {
  vmixHost: 'localhost',
  vmixPort: 8088,
  stationName: 'Minha Emissora',
  theme: 'dark',
  language: 'pt',
  autoConnect: false,
  autoPlay: false,
}

interface AppState {
  playlist: PlaylistItem[]
  adBreaks: AdBreak[]
  clients: Client[]
  playLog: PlayLog[]
  settings: AppSettings
  vmixStatus: VmixStatus
  activePanel: string
  isLoading: boolean
  isSequencePlaying: boolean
  activeItemProgress: { inputNum: string; position: number; duration: number } | null
  commercialBlocks: CommercialBlock[]
  clientSpots: ClientSpot[]
  spotRotation: SpotRotation
}

const initialState: AppState = {
  playlist: [],
  adBreaks: [],
  clients: [],
  playLog: [],
  settings: DEFAULT_SETTINGS,
  vmixStatus: { connected: false },
  activePanel: 'playlist',
  isLoading: true,
  isSequencePlaying: false,
  activeItemProgress: null,
  commercialBlocks: [],
  clientSpots: [],
  spotRotation: {},
}

type Action =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'LOAD_ALL'; payload: Partial<AppState> }
  | { type: 'SET_ACTIVE_PANEL'; payload: string }
  | { type: 'SET_SETTINGS'; payload: AppSettings }
  | { type: 'SET_VMIX_STATUS'; payload: VmixStatus }
  | { type: 'SET_PLAYLIST'; payload: PlaylistItem[] }
  | { type: 'ADD_PLAYLIST_ITEM'; payload: PlaylistItem }
  | { type: 'UPDATE_PLAYLIST_ITEM'; payload: PlaylistItem }
  | { type: 'DELETE_PLAYLIST_ITEM'; payload: string }
  | { type: 'CLEAR_PLAYLIST' }
  | { type: 'REORDER_PLAYLIST'; payload: PlaylistItem[] }
  | { type: 'ADD_AD_BREAK'; payload: AdBreak }
  | { type: 'UPDATE_AD_BREAK'; payload: AdBreak }
  | { type: 'DELETE_AD_BREAK'; payload: string }
  | { type: 'ADD_CLIENT'; payload: Client }
  | { type: 'UPDATE_CLIENT'; payload: Client }
  | { type: 'DELETE_CLIENT'; payload: string }
  | { type: 'ADD_LOG'; payload: PlayLog }
  | { type: 'SET_LOG'; payload: PlayLog[] }
  | { type: 'SET_SEQUENCE_PLAYING'; payload: boolean }
  | { type: 'SET_ACTIVE_ITEM_PROGRESS'; payload: { inputNum: string; position: number; duration: number } | null }
  | { type: 'ADD_COMMERCIAL_BLOCK';    payload: CommercialBlock }
  | { type: 'UPDATE_COMMERCIAL_BLOCK'; payload: CommercialBlock }
  | { type: 'DELETE_COMMERCIAL_BLOCK'; payload: string }
  | { type: 'MARK_BLOCK_LOADED';       payload: { blockId: string; date: string } }
  | { type: 'ADD_CLIENT_SPOT';         payload: ClientSpot }
  | { type: 'UPDATE_CLIENT_SPOT';      payload: ClientSpot }
  | { type: 'DELETE_CLIENT_SPOT';      payload: string }
  | { type: 'SET_SPOT_ROTATION';       payload: SpotRotation }

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
    case 'ADD_AD_BREAK':
      return { ...state, adBreaks: [...state.adBreaks, action.payload] }
    case 'UPDATE_AD_BREAK':
      return {
        ...state,
        adBreaks: state.adBreaks.map((ab) =>
          ab.id === action.payload.id ? action.payload : ab
        ),
      }
    case 'DELETE_AD_BREAK':
      return { ...state, adBreaks: state.adBreaks.filter((ab) => ab.id !== action.payload) }
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
      return { ...state, clients: state.clients.filter((c) => c.id !== action.payload) }
    case 'ADD_LOG':
      return { ...state, playLog: [...state.playLog, action.payload] }
    case 'SET_LOG':
      return { ...state, playLog: action.payload }
    case 'SET_SEQUENCE_PLAYING':
      return { ...state, isSequencePlaying: action.payload }
    case 'SET_ACTIVE_ITEM_PROGRESS':
      return { ...state, activeItemProgress: action.payload }
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
  stopPlayback: () => Promise<void>
  loadBlockIntoPlaylist: (block: CommercialBlock) => void
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
  // Tracks last fast-poll position per input — guards progress bar against regression on audio end
  const lastFastPosRef = useRef<Record<string, number>>({})
  // Holds a preloaded next input (GUID + filePath) ready to go on-air without delay
  const preloadedInputRef = useRef<{ guid: string; filePath: string } | null>(null)
  // Tracks ALL GUIDs loaded by SpotMaster via AddInput during this session.
  // Used for full cleanup at end-of-sequence or stopPlayback — ensures no
  // ghost inputs accumulate in the vMix project. Permanent vMix inputs
  // (inputName) never pass through loadNewInput, so they are never in this Set.
  const spotmasterGuidsRef = useRef<Set<string>>(new Set())

  // ── loadBlockIntoPlaylist ───────────────────────────────────────────────────
  // Resolves round-robin rotation and inserts spots into the playlist tail.
  // Called by the scheduler (auto) and by the "Recarregar" button (manual).
  const loadBlockIntoPlaylist = useCallback((block: CommercialBlock) => {
    const today = new Date().toISOString().slice(0, 10)
    const { clientSpots, spotRotation, clients, playlist } = stateRef.current
    const newRotation = { ...spotRotation }
    const startOrder = playlist.length + 1
    let offset = 0

    for (const slot of block.slots) {
      const spots = clientSpots.filter(s => s.clientId === slot.clientId)
      if (spots.length === 0) continue
      const base = newRotation[slot.clientId] ?? 0
      for (let i = 0; i < slot.spotsCount; i++) {
        const spot = spots[(base + i) % spots.length]
        // All spots share scheduledTime so runSequence finds them all in
        // scheduledDue and plays them in order before touching anything else.
        // scheduleInterruptTimeRef prevents the scheduler from re-interrupting
        // for the same time value while the block is playing.
        dispatch({
          type: 'ADD_PLAYLIST_ITEM',
          payload: {
            id: crypto.randomUUID(),
            order: startOrder + offset,
            title: spot.title,
            clientId: spot.clientId,
            clientName: clients.find(c => c.id === spot.clientId)?.name ?? '',
            duration: Math.max(spot.duration || 0, 5),
            filePath: spot.filePath,
            mediaType: spot.mediaType,
            type: 'spot' as const,
            status: 'pending' as const,
            adBreakId: block.id,
            scheduledTime: block.scheduledTime,
          },
        })
        offset++
      }
      newRotation[slot.clientId] = (base + slot.spotsCount) % spots.length
    }

    dispatch({ type: 'MARK_BLOCK_LOADED', payload: { blockId: block.id, date: today } })
    dispatch({ type: 'SET_SPOT_ROTATION', payload: newRotation })
  }, [dispatch]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Commercial block scheduler ───────────────────────────────────────────────
  // Checks every 30 s. 1 minute before each enabled block's scheduledTime,
  // loads it into the playlist (once per day).
  useEffect(() => {
    if (state.isLoading) return
    const interval = setInterval(() => {
      const today = new Date().toISOString().slice(0, 10)
      const d = new Date()
      const nowSecs = d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds()
      stateRef.current.commercialBlocks
        .filter(b => b.enabled && b.lastLoadedDate !== today)
        .forEach(b => {
          const [h = 0, m = 0, s = 0] = b.scheduledTime.split(':').map(Number)
          const blockSecs   = h * 3600 + m * 60 + s
          const triggerSecs = blockSecs - 60
          if (nowSecs >= triggerSecs && nowSecs < blockSecs) {
            loadBlockIntoPlaylist(b)
          }
        })
    }, 30_000)
    return () => clearInterval(interval)
  }, [state.isLoading, loadBlockIntoPlaylist])

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms))

  // Returns the highest input number currently registered in vMix
  const getMaxInputNum = useCallback(async (): Promise<number> => {
    if (!window.spotmaster) return 0
    const st = await window.spotmaster.vmixRequest({})
    if (!st.success || !st.data) return 0
    const matches = [...st.data.matchAll(/<input[^>]*number="(\d+)"/gi)]
    return matches.reduce((max, m) => Math.max(max, parseInt(m[1])), 0)
  }, [])

  // Polls until a new input (number > prevMax) appears after AddInput.
  // Returns the input's GUID (key attribute) — stable across renumbering.
  const pollForNewInput = useCallback(async (prevMax: number): Promise<string | null> => {
    for (let attempt = 0; attempt < 50; attempt++) {
      await sleep(200)
      if (!window.spotmaster) return null
      const st = await window.spotmaster.vmixRequest({})
      if (st.success && st.data) {
        // Parse every <input ...> tag and find one with number > prevMax
        const tags = [...st.data.matchAll(/<input\s([^>]*)>/gi)]
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
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Loads a file as a new input in vMix.
  // Returns the input's GUID (stable — never changes when vMix renumbers).
  const loadNewInput = useCallback(async (filePath: string): Promise<string | null> => {
    if (!window.spotmaster) return null
    const ext = filePath.split('.').pop()?.toLowerCase() ?? ''
    const isImage = ['jpg','jpeg','png','gif','bmp','webp','tiff','tif','ico'].includes(ext)
    const isAudio = ['mp3','wav','aac','ogg','flac','m4a','wma','opus','aiff'].includes(ext)
    const vmixType = isImage ? 'Image' : isAudio ? 'AudioFile' : 'Video'

    const prevMax = await getMaxInputNum()
    await window.spotmaster.vmixRequest({ Function: 'AddInput', Value: `${vmixType}|${filePath}` })
    const guid = await pollForNewInput(prevMax)  // returns GUID
    if (!guid) return null
    spotmasterGuidsRef.current.add(guid)  // register so we can clean up later
    await sleep(1000) // let vMix fully decode/buffer
    if (!isImage) {
      await window.spotmaster.vmixRequest({ Function: 'SetPosition', Input: guid, Value: '0' })
    }
    return guid
  }, [getMaxInputNum, pollForNewInput]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── cleanupInputs ───────────────────────────────────────────────────────────
  // Removes the active input (by GUID) from vMix after delayMs.
  const cleanupInputs = useCallback((delayMs = 0) => {
    const toRemove = activeInputRef.current
    activeInputRef.current = ''
    if (!toRemove || !window.spotmaster) return
    setTimeout(async () => {
      if (window.spotmaster) {
        await window.spotmaster.vmixRequest({ Function: 'RemoveInput', Input: toRemove })
      }
    }, delayMs)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── playItem ────────────────────────────────────────────────────────────────
  // Sends ONE item to air and awaits until it finishes playing.
  // This function is strictly serial — it never runs concurrently with itself.
  // loadNewInput is called here (not in background) to prevent slot collisions.
  const playItem = useCallback(async (item: PlaylistItem, nextFilePath?: string) => {
    if (!window.spotmaster) return

    dispatch({ type: 'UPDATE_PLAYLIST_ITEM', payload: { ...item, status: 'playing' } })
    const actualTime = now()
    const { vmixStatus } = stateRef.current
    let onAirInput = ''

    if (vmixStatus.connected) {
      if (item.filePath) {
        // Use a preloaded GUID if available for this exact file (eliminates gap between items).
        // Otherwise fall back to loading now (same behaviour as before this feature).
        let guid: string | null = null
        const cached = preloadedInputRef.current
        if (cached?.filePath === item.filePath) {
          guid = cached.guid
          preloadedInputRef.current = null
          console.log(`[SpotMaster] using preloaded input for "${item.title}"`)
        } else {
          if (cached) {
            // Stale preload (e.g. playlist was reordered) — discard safely
            console.warn(`[SpotMaster] discarding stale preload: "${cached.filePath}"`)
            const staleGuid = cached.guid
            preloadedInputRef.current = null
            window.spotmaster.vmixRequest({ Function: 'RemoveInput', Input: staleGuid })
          }
          guid = await loadNewInput(item.filePath)
        }

        if (guid) {
          const ext = item.filePath.split('.').pop()?.toLowerCase() ?? ''
          const isImg   = ['jpg','jpeg','png','gif','bmp','webp','tiff','tif','ico'].includes(ext)
          const isAudio = ['mp3','wav','aac','m4a','flac','ogg','wma','opus','aiff','aif'].includes(ext)

          if (!isImg && !isAudio) {
            await window.spotmaster.vmixRequest({ Function: 'PlayInput', Input: guid })
            await sleep(300)
          }
          await window.spotmaster.vmixRequest({ Function: 'PreviewInput', Input: guid })
          await sleep(100)
          await window.spotmaster.vmixRequest({ Function: 'Cut' })
          if (isAudio) {
            await sleep(500)
            await window.spotmaster.vmixRequest({ Function: 'PlayInput', Input: guid })
            await sleep(200)
          }

          // Remove the PREVIOUS input 5 s after the cut.
          // Delayed so the previous audio finishes fading out; GUID-based so
          // vMix renumbering never removes the wrong input.
          const prevGuid = activeInputRef.current
          if (prevGuid) {
            setTimeout(async () => {
              if (window.spotmaster) {
                await window.spotmaster.vmixRequest({ Function: 'RemoveInput', Input: prevGuid })
              }
            }, 5000)
          }

          activeInputRef.current = guid
          onAirInput = guid
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
              await window.spotmaster.vmixRequest({ Function: 'RemoveInput', Input: prevGuid })
            }
          }, 5000)
        }
        // Clear the ref — this input is permanent and must NEVER be auto-removed.
        activeInputRef.current = ''

        await window.spotmaster.vmixRequest({ Function: 'SetPosition', Input: item.inputName, Value: '0' })
        await window.spotmaster.vmixRequest({ Function: 'PlayInput', Input: item.inputName })
        await window.spotmaster.vmixRequest({ Function: 'PreviewInput', Input: item.inputName })
        await sleep(100)
        await window.spotmaster.vmixRequest({ Function: 'Cut' })
        onAirInput = item.inputName
        // activeInputRef intentionally left as '' — permanent inputs are not owned by SpotMaster
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
        const st = await window.spotmaster.vmixRequest({})
        if (st.success && st.data) {
          const tags = [...st.data.matchAll(/<input\s([^>]*)>/gi)]
          for (const tag of tags) {
            const keyM = tag[1].match(/\bkey="([^"]+)"/i)
            const durM = tag[1].match(/\bduration="(\d+)"/i)
            if (keyM && keyM[1] === onAirInput && durM) {
              durationSec = parseInt(durM[1]) / 1000
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
        dispatch({
          type: 'SET_ACTIVE_ITEM_PROGRESS',
          payload: {
            inputNum: onAirInput || 'clock',
            position: elapsed,
            duration: totalMs,
          },
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
            loadNewInput(fpToLoad).then(preGuid => {
              if (!preGuid) return
              if (abortRef.current) {
                // Playback was stopped while we were loading — discard immediately
                window.spotmaster?.vmixRequest({ Function: 'RemoveInput', Input: preGuid })
              } else {
                preloadedInputRef.current = { guid: preGuid, filePath: fpToLoad }
              }
            })
          }
        }
        await sleep(300)
      }
    }

    dispatch({ type: 'SET_ACTIVE_ITEM_PROGRESS', payload: null })

    // Mark done. Items interrupted by a scheduled block go 'done' —
    // playout always moves forward, never returns to what was playing.
    const fresh = stateRef.current.playlist.find(i => i.id === item.id)
    if (fresh && fresh.status !== 'done' && fresh.status !== 'skipped') {
      dispatch({ type: 'UPDATE_PLAYLIST_ITEM', payload: { ...fresh, status: 'done' } })
    }
  }, [dispatch, loadNewInput]) // eslint-disable-line react-hooks/exhaustive-deps

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
        if (!scheduleInterruptRef.current) break
        abortRef.current = false
        scheduleInterruptRef.current = false
      }

      // ── Read live playlist ───────────────────────────────────────────────
      const pending = stateRef.current.playlist.filter(i => i.status === 'pending')
      if (pending.length === 0) break

      const currentTime = now()
      const { autoPlay } = stateRef.current.settings
      const scheduledDue = autoPlay
        ? pending
            .filter(i => i.scheduledTime && i.scheduledTime <= currentTime)
            .sort((a, b) => {
              const timeCmp = (a.scheduledTime ?? '').localeCompare(b.scheduledTime ?? '')
              return timeCmp !== 0 ? timeCmp : a.order - b.order
            })
        : []

      // When a commercial block is due, skip pending items that come BEFORE
      // it in the playlist — playout always moves forward.
      if (scheduledDue.length > 0) {
        const firstDueOrder = scheduledDue[0].order
        const toSkip = pending.filter(i => i.order < firstDueOrder)
        if (toSkip.length > 0) {
          toSkip.forEach(i =>
            dispatch({ type: 'UPDATE_PLAYLIST_ITEM', payload: { ...i, status: 'skipped' } })
          )
          await sleep(150)
          continue
        }
      }

      const next = scheduledDue[0] ?? [...pending].sort((a, b) => a.order - b.order)[0]

      // Look ahead: find the next file-based pending item so playItem can preload it
      const pendingByOrder = [...pending].sort((a, b) => a.order - b.order)
      const afterNext = pendingByOrder.find(i => i.order > next.order && !!i.filePath)

      try {
        await playItem(next, afterNext?.filePath)
      } catch (err) {
        console.error('[SpotMaster] playItem error for "' + next.title + '":', err)
        const stale = stateRef.current.playlist.find(i => i.id === next.id)
        if (stale && stale.status !== 'done' && stale.status !== 'skipped') {
          dispatch({ type: 'UPDATE_PLAYLIST_ITEM', payload: { ...stale, status: 'error' } })
        }
      }

      await sleep(200)
    }

    // Sequence fully ended — clean up
    scheduleInterruptTimeRef.current = ''
    dispatch({ type: 'SET_SEQUENCE_PLAYING', payload: false })
    dispatch({ type: 'SET_ACTIVE_ITEM_PROGRESS', payload: null })

    // Discard any preloaded input that was never used (sequence ended before it played)
    const unusedPreload = preloadedInputRef.current
    if (unusedPreload) {
      preloadedInputRef.current = null
      if (window.spotmaster) {
        window.spotmaster.vmixRequest({ Function: 'RemoveInput', Input: unusedPreload.guid })
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
        window.spotmaster.vmixRequest({ Function: 'RemoveInput', Input: g })
      }
    }

    if (window.spotmaster) window.spotmaster.vmixStopFastPolling()
  }, [dispatch, playItem, loadNewInput, cleanupInputs]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Sequence controls ──────────────────────────────────────────────────────
  const startSequence = useCallback(() => {
    // Guard: don't start if already playing or nothing pending
    if (stateRef.current.isSequencePlaying) return
    const hasPending = stateRef.current.playlist.some(i => i.status === 'pending')
    if (!hasPending) return

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
    dispatch({ type: 'SET_SEQUENCE_PLAYING', payload: false })
    dispatch({ type: 'SET_ACTIVE_ITEM_PROGRESS', payload: null })
    if (window.spotmaster) {
      await window.spotmaster.vmixStopFastPolling()
      // Discard any in-progress preload so it doesn't linger in vMix
      const pre = preloadedInputRef.current
      if (pre) {
        preloadedInputRef.current = null
        window.spotmaster.vmixRequest({ Function: 'RemoveInput', Input: pre.guid })
      }
      cleanupInputs(0)
      // Full sweep: remove every GUID loaded by SpotMaster this session.
      // Catches anything that escaped individual cleanup on abort/stop.
      const allGuids = [...spotmasterGuidsRef.current]
      spotmasterGuidsRef.current.clear()
      for (const g of allGuids) {
        window.spotmaster.vmixRequest({ Function: 'RemoveInput', Input: g })
      }
    }
    stateRef.current.playlist
      .filter(i => i.status === 'playing')
      .forEach(i =>
        dispatch({ type: 'UPDATE_PLAYLIST_ITEM', payload: { ...i, status: 'pending' } })
      )
  }, [dispatch, cleanupInputs])

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
      dispatch({ type: 'SET_ACTIVE_ITEM_PROGRESS', payload: null })
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
      dispatch({
        type: 'SET_ACTIVE_ITEM_PROGRESS',
        payload: { inputNum: inp.number, position: inp.position, duration: inp.duration },
      })
    })
    return () => window.spotmaster?.removeVmixFastStatusListener()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Autoplay scheduler ─────────────────────────────────────────────────────
  // Every second: if autoPlay is ON and there are pending items whose
  // scheduledTime has arrived, either start the sequence (if idle) or
  // interrupt the currently playing item so the block fires on time.
  useEffect(() => {
    if (state.isLoading) return
    const interval = setInterval(() => {
      if (!stateRef.current.settings.autoPlay) return

      const currentTime = now()
      const scheduledDue = stateRef.current.playlist.filter(
        i => i.status === 'pending' && i.scheduledTime && i.scheduledTime <= currentTime
      )
      if (scheduledDue.length === 0) return

      // Determine the earliest due time to use as the trigger key
      const triggerTime = scheduledDue
        .map(i => i.scheduledTime!)
        .sort()[0]

      // Anti-loop: this trigger was already handled — skip until the sequence
      // ends and clears scheduleInterruptTimeRef
      if (scheduleInterruptTimeRef.current === triggerTime) return

      if (!stateRef.current.isSequencePlaying) {
        // Idle — start normally; runSequence will prioritise scheduled items
        scheduleInterruptTimeRef.current = triggerTime
        startSequence()
      } else {
        // Already playing — signal an interrupt so the current item is cut
        // and the block takes over immediately
        scheduleInterruptTimeRef.current = triggerTime
        scheduleInterruptRef.current = true
        abortRef.current = true
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [state.isLoading, startSequence])

  // ── Load all data on startup ───────────────────────────────────────────────
  useEffect(() => {
    const loadAll = async () => {
      if (!window.spotmaster) {
        dispatch({ type: 'SET_LOADING', payload: false })
        return
      }
      try {
        const [settingsRaw, playlistRaw, adBreaksRaw, clientsRaw, logRaw,
               blocksRaw, spotsRaw, rotationRaw, panelRaw] =
          await Promise.all([
            window.spotmaster.loadData('settings'),
            window.spotmaster.loadData('playlist'),
            window.spotmaster.loadData('adBreaks'),
            window.spotmaster.loadData('clients'),
            window.spotmaster.loadData('playLog'),
            window.spotmaster.loadData('commercialBlocks'),
            window.spotmaster.loadData('clientSpots'),
            window.spotmaster.loadData('spotRotation'),
            window.spotmaster.loadData('activePanel'),
          ])
        dispatch({
          type: 'LOAD_ALL',
          payload: {
            settings:         { ...DEFAULT_SETTINGS, ...(settingsRaw as AppSettings) },
            playlist:         (playlistRaw as PlaylistItem[])     ?? [],
            adBreaks:         (adBreaksRaw as AdBreak[])          ?? [],
            clients:          (clientsRaw as Client[])            ?? [],
            playLog:          (logRaw as PlayLog[])               ?? [],
            commercialBlocks: (blocksRaw as CommercialBlock[])    ?? [],
            clientSpots:      (spotsRaw as ClientSpot[])          ?? [],
            spotRotation:     (rotationRaw as SpotRotation)       ?? {},
            activePanel:      (typeof panelRaw === 'string' ? panelRaw : null) ?? 'playlist',
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
    if (state.isLoading) return
    if (state.settings.autoConnect && window.spotmaster) {
      window.spotmaster.vmixStartPolling(state.settings.vmixHost, state.settings.vmixPort)
    }
  }, [state.isLoading, state.settings.autoConnect, state.settings.vmixHost, state.settings.vmixPort])

  useEffect(() => {
    if (!state.isLoading) saveToStorage('playlist', state.playlist)
  }, [state.playlist, state.isLoading, saveToStorage])

  useEffect(() => {
    if (!state.isLoading) saveToStorage('adBreaks', state.adBreaks)
  }, [state.adBreaks, state.isLoading, saveToStorage])

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

  return (
    <AppContext.Provider value={{ state, dispatch, t, saveToStorage, playItem, playSingleItem, startSequence, stopPlayback, loadBlockIntoPlaylist }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used inside AppProvider')
  return ctx
}
