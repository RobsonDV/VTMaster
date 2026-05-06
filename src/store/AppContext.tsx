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
  const activeInputNumRef = useRef<string>('')
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

  // ── A/B Slot Engine ──────────────────────────────────────────────────────
  // Instead of accumulating unlimited vMix inputs, SpotMaster uses exactly
  // two fixed slots (A and B) that alternate with every item played.
  // When item N is on-air in slot A, item N+1 is loaded into slot B.
  // After Cut to B the old content in A is removed immediately, freeing the
  // slot for item N+2. The vMix project is always clean: ≤ 2 SpotMaster inputs.
  const slotARef          = useRef<string | null>(null) // input number in slot A (or null)
  const slotBRef          = useRef<string | null>(null) // input number in slot B (or null)
  const activeSlotRef     = useRef<'A' | 'B' | 'none'>('none')

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

  // Polls until a new input (number > prevMax) appears after AddInput
  const pollForNewInput = useCallback(async (prevMax: number): Promise<string | null> => {
    for (let attempt = 0; attempt < 50; attempt++) {
      await sleep(200)
      if (!window.spotmaster) return null
      const st = await window.spotmaster.vmixRequest({})
      if (st.success && st.data) {
        const nums = [...st.data.matchAll(/<input[^>]*number="(\d+)"/gi)]
        const found = nums.find(m => parseInt(m[1]) > prevMax)
        if (found) return found[1]
      }
    }
    return null
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Loads a file as a new input in vMix.
  // Returns the assigned input number string, or null on failure.
  // NOTE: called serially — never concurrently — to avoid slot collisions.
  const loadNewInput = useCallback(async (filePath: string): Promise<string | null> => {
    if (!window.spotmaster) return null
    const ext = filePath.split('.').pop()?.toLowerCase() ?? ''
    const isImage = ['jpg','jpeg','png','gif','bmp','webp','tiff','tif','ico'].includes(ext)
    const isAudio = ['mp3','wav','aac','ogg','flac','m4a','wma','opus','aiff'].includes(ext)
    const vmixType = isImage ? 'Image' : isAudio ? 'AudioFile' : 'Video'

    const prevMax = await getMaxInputNum()
    await window.spotmaster.vmixRequest({ Function: 'AddInput', Value: `${vmixType}|${filePath}` })
    const num = await pollForNewInput(prevMax)
    if (!num) return null
    await sleep(1000) // let vMix fully decode/buffer and report correct duration
    if (!isImage) {
      await window.spotmaster.vmixRequest({ Function: 'SetPosition', Input: num, Value: '0' })
    }
    return num
  }, [getMaxInputNum, pollForNewInput]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── waitForInputEnd ─────────────────────────────────────────────────────────
  // Polls vMix XML every 300 ms until position >= duration - 500 ms.
  // Falls back to wall-clock deadline (durationMs + 5 s) if position is
  // unavailable (e.g., for audio files that don't report position).
  // Completely isolated per clip — no shared state with other clips.
  const waitForInputEnd = useCallback(async (
    inputNum: string,
    durationMs: number,
  ): Promise<void> => {
    // Deadline: item duration + 5 s grace.
    const deadline = Date.now() + Math.max(durationMs, 1000) + 5000
    // hasSeenRunning becomes true once the input reports state="Running".
    // When it then transitions to ANY other state the clip has finished.
    // This is the PRIMARY exit for AudioFile inputs, which reset position
    // to 0 at end instead of staying at duration — so position-based
    // detection alone never fires for audio.
    let hasSeenRunning = false
    let lastPos = -1
    let lastHighPos = 0     // highest position seen — detects AudioFile position reset at end
    let nonRunningCount = 0 // consecutive non-Running polls after hasSeenRunning is set
    let lowPosCount = 0     // consecutive near-zero polls after lastHighPos > 1000

    while (Date.now() < deadline) {
      if (abortRef.current) return
      await sleep(300)
      if (abortRef.current) return
      if (!window.spotmaster) return

      const st = await window.spotmaster.vmixRequest({})
      if (!st.success || !st.data) continue

      // Find the <input number="N" ...> opening tag in vMix XML
      const tagMatch = st.data.match(
        new RegExp(`<input\\s[^>]*number="${inputNum}"[^>]*>`, 'i')
      )

      // Input disappeared from vMix entirely → it finished (or was removed)
      if (!tagMatch) {
        if (hasSeenRunning) return
        continue // hasn't appeared yet — keep waiting
      }

      const tag          = tagMatch[0]
      const stateM       = tag.match(/\bstate="([^"]+)"/i)
      const dM           = tag.match(/\bduration="(\d+)"/i)
      const pM           = tag.match(/\bposition="(\d+)"/i)
      const currentState = stateM ? stateM[1] : ''
      const dur          = dM ? parseInt(dM[1]) : 0
      const pos          = pM ? parseInt(pM[1]) : -1

      // Track state transitions — reset counter when Running resumes
      if (currentState === 'Running') {
        hasSeenRunning = true
        nonRunningCount = 0
      } else if (hasSeenRunning && currentState !== '') {
        nonRunningCount++
      }

      // Track position — detect reset to near-zero; reset counter when pos is high again
      if (pos > 1000) {
        lastHighPos = pos
        lowPosCount = 0
      } else if (lastHighPos > 1000 && pos >= 0 && pos < 500) {
        lowPosCount++
      }

      // Update progress bar
      if (dur > 0 && pos >= 0 && pos !== lastPos) {
        lastPos = pos
        dispatch({
          type: 'SET_ACTIVE_ITEM_PROGRESS',
          payload: { inputNum, position: pos, duration: dur },
        })
      }

      // EXIT 1 — position reached end (video/image clips)
      // Require dur to be both > 500 ms AND at least 50% of the expected clip
      // duration (durationMs).  vMix sometimes reports a preliminary/partial
      // duration while it is still reading a file's metadata — values like
      // 1 000–3 000 ms for a 30-second clip are common right after AddInput.
      // Without the second guard, position would reach (partial_dur - 500) in
      // just one second and EXIT 1 would fire immediately, causing every
      // commercial spot to be skipped in ~1 s instead of playing in full.
      // Using Math.max(durationMs * 0.5, 1000) ensures:
      //   • Very short clips  (durationMs < 2 000): require dur ≥ 1 000 ms
      //   • Normal/long clips (durationMs ≥ 2 000): require dur ≥ half expected
      const minReliableDur = Math.max(durationMs * 0.5, 1000)
      if (dur > 500 && dur >= minReliableDur && pos >= dur - 500) return

      // EXIT 2 — was Running, transitioned to non-Running for 2+ consecutive polls.
      // Requiring 2 polls prevents false exits from brief buffering/transition states.
      if (nonRunningCount >= 2) return

      // EXIT 3 — position reset to near-zero after being well into playback.
      // Requiring 2 consecutive near-zero polls avoids false positives from
      // momentary position glitches or mid-clip seeks.
      if (lowPosCount >= 2) {
        dispatch({ type: 'SET_ACTIVE_ITEM_PROGRESS', payload: { inputNum, position: dur || durationMs, duration: dur || durationMs } })
        return
      }
    }
    // Deadline reached — treat as natural completion
  }, [dispatch]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── cleanupInputs ───────────────────────────────────────────────────────────
  // Removes the A and B slots from vMix after `delayMs` and resets the refs.
  // Called after sequence/single-play finishes or when user stops playback.
  const cleanupInputs = useCallback((delayMs = 10000) => {
    const toRemove = [slotARef.current, slotBRef.current].filter(Boolean) as string[]
    slotARef.current = null
    slotBRef.current = null
    activeSlotRef.current = 'none'
    if (toRemove.length === 0) return
    setTimeout(async () => {
      for (const n of toRemove) {
        if (window.spotmaster) {
          await window.spotmaster.vmixRequest({ Function: 'RemoveInput', Input: n })
          await sleep(200)
        }
      }
    }, delayMs)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── playItem ────────────────────────────────────────────────────────────────
  // Sends ONE item to air and awaits until it finishes playing.
  // This function is strictly serial — it never runs concurrently with itself.
  // loadNewInput is called here (not in background) to prevent slot collisions.
  const playItem = useCallback(async (item: PlaylistItem) => {
    if (!window.spotmaster) return

    dispatch({ type: 'UPDATE_PLAYLIST_ITEM', payload: { ...item, status: 'playing' } })
    const actualTime = now()
    const { vmixStatus } = stateRef.current
    let onAirInput = ''

    if (vmixStatus.connected) {
      if (item.filePath) {
        // Serial load — no concurrent calls, no slot collisions
        const inputNum = await loadNewInput(item.filePath)

        if (inputNum) {
          const ext = item.filePath.split('.').pop()?.toLowerCase() ?? ''
          const isImg = ['jpg','jpeg','png','gif','bmp','webp','tiff','tif','ico'].includes(ext)
          const isAudio = ['mp3','wav','aac','m4a','flac','ogg','wma','opus','aiff','aif'].includes(ext)

          // ── A/B Slot: determine target slot and release the other one ────
          const targetSlot: 'A' | 'B' = activeSlotRef.current === 'A' ? 'B' : 'A'
          const slotToRelease = targetSlot === 'A' ? slotBRef.current : slotARef.current

          if (!isImg && !isAudio) {
            await window.spotmaster.vmixRequest({ Function: 'PlayInput', Input: inputNum })
            await sleep(300)
          }
          await window.spotmaster.vmixRequest({ Function: 'PreviewInput', Input: inputNum })
          await sleep(100)
          await window.spotmaster.vmixRequest({ Function: 'Cut' })
          if (isAudio) {
            await sleep(500)
            await window.spotmaster.vmixRequest({ Function: 'PlayInput', Input: inputNum })
            await sleep(200)
          }

          // Update A/B slot refs for this item
          if (targetSlot === 'A') slotARef.current = inputNum
          else slotBRef.current = inputNum
          activeSlotRef.current = targetSlot

          // Remove the previous slot content now that Cut happened (A/B roll cleanup)
          if (slotToRelease) {
            setTimeout(async () => {
              if (window.spotmaster) {
                await window.spotmaster.vmixRequest({ Function: 'RemoveInput', Input: slotToRelease })
                // Clear the ref for the released slot
                if (targetSlot === 'A' && slotBRef.current === slotToRelease) slotBRef.current = null
                if (targetSlot === 'B' && slotARef.current === slotToRelease) slotARef.current = null
              }
            }, 1500)
          }

          activeInputNumRef.current = inputNum
          onAirInput = inputNum
        }

      } else if (item.inputName) {
        await window.spotmaster.vmixRequest({ Function: 'SetPosition', Input: item.inputName, Value: '0' })
        await window.spotmaster.vmixRequest({ Function: 'PlayInput', Input: item.inputName })
        await window.spotmaster.vmixRequest({ Function: 'PreviewInput', Input: item.inputName })
        await sleep(100)
        await window.spotmaster.vmixRequest({ Function: 'Cut' })
          activeInputNumRef.current = item.inputName
        onAirInput = item.inputName
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
    if (onAirInput && vmixStatus.connected && item.filePath) {
      // Position-based polling (preferred — gives accurate progress bar)
      await waitForInputEnd(onAirInput, item.duration * 1000)
    } else {
      // Wall-clock fallback (no vMix connection, or named inputs)
      const start = Date.now()
      const totalMs = Math.max(item.duration * 1000, 1000)
      while (Date.now() - start < totalMs) {
        if (abortRef.current) break
        dispatch({
          type: 'SET_ACTIVE_ITEM_PROGRESS',
          payload: {
            inputNum: onAirInput || 'clock',
            position: Date.now() - start,
            duration: totalMs,
          },
        })
        await sleep(300)
      }
    }

    dispatch({ type: 'SET_ACTIVE_ITEM_PROGRESS', payload: null })

    // Mark done (only if not already changed by the user).
    // Exception: if this item was cut short by a schedule interrupt, put it
    // back in the queue so it resumes after the commercial block finishes.
    const fresh = stateRef.current.playlist.find(i => i.id === item.id)
    if (fresh && fresh.status !== 'done' && fresh.status !== 'skipped') {
      const newStatus = (abortRef.current && scheduleInterruptRef.current) ? 'pending' : 'done'
      dispatch({ type: 'UPDATE_PLAYLIST_ITEM', payload: { ...fresh, status: newStatus } })
    }
  }, [dispatch, loadNewInput, waitForInputEnd]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── runSequence ─────────────────────────────────────────────────────────────
  // Infinite while-loop that reads the LIVE playlist on every iteration.
  // This means:
  //   - Items added DURING playback are picked up automatically.
  //   - The sequence only stops when there are genuinely no more pending items
  //     (or stopPlayback() sets abortRef).
  const runSequence = useCallback(async () => {
    while (true) {
      // ── Handle abort at the top of every iteration ───────────────────────
      if (abortRef.current) {
        if (!scheduleInterruptRef.current) break // Real user stop — exit
        // Schedule interrupt: reset flags and fall through to priority pick
        abortRef.current = false
        scheduleInterruptRef.current = false
      }

      // ── Select next item ─────────────────────────────────────────────────
      // When autoPlay is ON, prioritise items whose scheduledTime has arrived;
      // this ensures commercial blocks jump to the front even mid-sequence.
      // Fallback: next item by insertion order (normal behaviour).
      const pending = stateRef.current.playlist.filter(i => i.status === 'pending')
      if (pending.length === 0) break // No more pending items

      const currentTime = now()
      const { autoPlay } = stateRef.current.settings
      const scheduledDue = autoPlay
        ? pending
            .filter(i => i.scheduledTime && i.scheduledTime <= currentTime)
            .sort((a, b) => (a.scheduledTime ?? '').localeCompare(b.scheduledTime ?? ''))
        : []

      const next = scheduledDue[0] ?? [...pending].sort((a, b) => a.order - b.order)[0]

      try {
        await playItem(next)
      } catch (err) {
        // Unexpected error — log, mark item as error, keep sequence going
        console.error('[SpotMaster] playItem error for "' + next.title + '":', err)
        const stale = stateRef.current.playlist.find(i => i.id === next.id)
        if (stale && stale.status !== 'done' && stale.status !== 'skipped') {
          dispatch({ type: 'UPDATE_PLAYLIST_ITEM', payload: { ...stale, status: 'error' } })
        }
      }

      // Yield a microtask cycle so React can flush dispatches from playItem
      // into stateRef before the next iteration reads the playlist.
      await sleep(50)
    }

    // Sequence fully ended — clean up
    scheduleInterruptTimeRef.current = ''
    dispatch({ type: 'SET_SEQUENCE_PLAYING', payload: false })
    dispatch({ type: 'SET_ACTIVE_ITEM_PROGRESS', payload: null })
    activeInputNumRef.current = ''

    if (!abortRef.current) cleanupInputs(10000)
    if (window.spotmaster) window.spotmaster.vmixStopFastPolling()
  }, [dispatch, playItem, cleanupInputs]) // eslint-disable-line react-hooks/exhaustive-deps

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
    activeInputNumRef.current = ''
    activeSlotRef.current = 'none'
    if (window.spotmaster) {
      await window.spotmaster.vmixStopFastPolling()
      cleanupInputs(5000)
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
      activeSlotRef.current = 'none'
      if (window.spotmaster) window.spotmaster.vmixStopFastPolling()
      cleanupInputs(10000)
    })
  }, [dispatch, playItem, cleanupInputs])

  // ── Fast-status listener: progress bar UI only ─────────────────────────────
  // Sequence advance is driven by waitForInputEnd() — NOT by this listener.
  useEffect(() => {
    if (!window.spotmaster) return
    window.spotmaster.onVmixFastStatus((rawStatus) => {
      const status = rawStatus as VmixStatus
      const num = activeInputNumRef.current
      if (!num) return
      const inp = status.inputs?.find(i => i.number === num)
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
