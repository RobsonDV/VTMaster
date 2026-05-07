// ─────────────────────────────────────────────────────────────────────────────
// SpotMaster — Type Definitions
// ─────────────────────────────────────────────────────────────────────────────

export type SpotStatus = 'pending' | 'playing' | 'done' | 'skipped' | 'error'
export type SpotType = 'spot' | 'vinheta' | 'programa' | 'bumper' | 'outros'
export type Theme = 'dark' | 'light'
export type Language = 'pt' | 'en'

// ─────────────────────────────────────────────────────────────────────────────
// Client / Advertiser
// ─────────────────────────────────────────────────────────────────────────────
export interface Client {
  id: string
  name: string
  contact?: string
  email?: string
  phone?: string
  notes?: string
  createdAt: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Playlist Item
// ─────────────────────────────────────────────────────────────────────────────
export interface PlaylistItem {
  id: string
  order: number
  title: string
  clientId?: string
  clientName?: string
  duration: number          // seconds
  scheduledTime?: string    // HH:MM:SS
  inputName?: string        // vMix input name/number
  type: SpotType
  status: SpotStatus
  filePath?: string         // local media file path (video/image/audio)
  mediaType?: 'video' | 'image' | 'audio'  // detected from file extension
  notes?: string
  adBreakId?: string        // if part of an ad break
}

// ─────────────────────────────────────────────────────────────────────────────
// Ad Break (commercial block template)
// ─────────────────────────────────────────────────────────────────────────────
export interface AdBreak {
  id: string
  name: string
  items: PlaylistItem[]
  totalDuration: number     // sum of items duration
  createdAt: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Commercial Scheduling System
// ─────────────────────────────────────────────────────────────────────────────

/** Um arquivo de mídia cadastrado para um cliente */
export interface ClientSpot {
  id: string
  clientId: string
  title: string
  filePath: string
  mediaType: 'video' | 'audio' | 'image'
  duration: number          // seconds
}

/** Quantos spots de um cliente entram em um bloco */
export interface BlockClientSlot {
  clientId: string
  spotsCount: number
}

/** Um bloco comercial agendado — dispara todo dia no horário marcado */
export interface CommercialBlock {
  id: string
  name: string
  scheduledTime: string     // HH:MM:SS
  slots: BlockClientSlot[]
  enabled: boolean
  createdAt: string
  lastLoadedDate?: string   // YYYY-MM-DD — evita carga dupla no mesmo dia
}

/** Controle de rodízio persistido: clientId → próximo índice (0-based) */
export interface SpotRotation {
  [clientId: string]: number
}

// ─────────────────────────────────────────────────────────────────────────────
// Play Log Entry (proof of airing)
// ─────────────────────────────────────────────────────────────────────────────
export interface PlayLog {
  id: string
  date: string              // YYYY-MM-DD
  itemId: string
  title: string
  clientId?: string
  clientName?: string
  scheduledTime?: string    // HH:MM:SS
  actualTime: string        // HH:MM:SS — real air time
  duration: number          // seconds
  status: 'aired' | 'skipped' | 'error'
  inputName?: string
  notes?: string
}

// ─────────────────────────────────────────────────────────────────────────────
// App Settings
// ─────────────────────────────────────────────────────────────────────────────
export interface AppSettings {
  vmixHost: string
  vmixPort: number
  stationName: string
  stationLogo?: string
  theme: Theme
  language: Language
  autoConnect: boolean
  autoPlay: boolean
  defaultInputName?: string
  spotmasterInputName?: string  // legacy: name used in settings modal
}

// ─────────────────────────────────────────────────────────────────────────────
// vMix Status
// ─────────────────────────────────────────────────────────────────────────────
export interface VmixStatus {
  connected: boolean
  version?: string
  edition?: string
  inputs?: VmixInput[]
  activeInput?: string
  previewInput?: string
  recording?: boolean
  streaming?: boolean
  fadeToBlack?: boolean
  error?: string
}

export interface VmixInput {
  number: string
  key: string        // vMix GUID — stable across input renumbering
  type: string
  title: string
  shortTitle: string
  state: string
  duration: number
  position: number
}

// ─────────────────────────────────────────────────────────────────────────────
// PDF Report Request
// ─────────────────────────────────────────────────────────────────────────────
export type PDFReportType = 'daily' | 'client'

export interface PDFReportRequest {
  type: PDFReportType
  date?: string             // YYYY-MM-DD — for daily reports
  clientId?: string         // for client reports
  clientName?: string
  dateFrom?: string         // YYYY-MM-DD
  dateTo?: string           // YYYY-MM-DD
  logs: PlayLog[]
  stationName: string
  language: Language
}

// ─────────────────────────────────────────────────────────────────────────────
// Electron bridge type (window.spotmaster)
// ─────────────────────────────────────────────────────────────────────────────
export interface SpotMasterAPI {
  saveData: (key: string, data: unknown) => Promise<void>
  loadData: (key: string) => Promise<unknown>
  getVersion: () => Promise<string>
  exportPlaylist: (data: unknown) => Promise<string | null>
  importPlaylist: () => Promise<unknown>
  exportPDF: (filePath: string, buffer: number[]) => Promise<boolean>
  browseVideoFile: () => Promise<string | null>
  vmixRequest: (params: Record<string, string>) => Promise<{ success: boolean; data?: string; error?: string }>
  vmixStartPolling: (host: string, port: number) => Promise<boolean>
  vmixStopPolling: () => Promise<boolean>
  onVmixStatus: (callback: (status: VmixStatus) => void) => void
  removeVmixStatusListener: () => void
  // Fast polling (500ms) — used during active playback for progress & end detection
  vmixStartFastPolling: (host: string, port: number) => Promise<boolean>
  vmixStopFastPolling: () => Promise<boolean>
  onVmixFastStatus: (callback: (status: VmixStatus) => void) => void
  removeVmixFastStatusListener: () => void
  openExternal: (url: string) => Promise<void>
}

declare global {
  interface Window {
    spotmaster: SpotMasterAPI
  }
}
