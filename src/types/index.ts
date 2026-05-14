// ─────────────────────────────────────────────────────────────────────────────
// SpotMaster — Type Definitions
// ─────────────────────────────────────────────────────────────────────────────

export type SpotStatus = 'pending' | 'playing' | 'done' | 'skipped' | 'error'
export type SpotType = 'spot' | 'vinheta' | 'programa' | 'bumper' | 'outros' | 'vmix_action' | 'pause'

// ─────────────────────────────────────────────────────────────────────────────
// vMix Action Item — comando enviado diretamente ao vMix (sem mídia)
// ─────────────────────────────────────────────────────────────────────────────
export interface VmixActionItem {
  function: string    // 'AudioOff' | 'AudioOn' | 'SetVolume' | 'Fade' | 'OverlayInput1' | 'OverlayInput1Out' | ...
  input?: string      // GUID, nome ou número do input vMix (quando necessário)
  value?: string      // Para SetVolume (0–100), Fade (duração em ms), etc.
}
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
  duration: number          // seconds (0 for vmix_action)
  scheduledTime?: string    // HH:MM:SS
  inputName?: string        // vMix input name/number
  type: SpotType
  status: SpotStatus
  filePath?: string         // local media file path (video/image/audio)
  mediaType?: 'video' | 'image' | 'audio'
  notes?: string
  adBreakId?: string        // if part of an ad break
  vmixAction?: VmixActionItem  // present only when type === 'vmix_action'
  manuallyAdded?: boolean   // true quando o operador adicionou via UI (não veio da grade)
}

/** Registro de uma deleção intencional pelo operador na Programação do Dia.
 *  Usado para impedir que o regenerador da grade re-adicione o item no merge. */
export interface DeletedScheduleSlot {
  time: string        // HH:MM (apenas horas:minutos, suficiente para casar com slot da grade)
  signature: string   // identifica o item: `${type}|${normalizedTitle}` ou `commercial-block:${adBreakId}` etc.
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

/** Quantos spots de um cliente entram em um bloco (LEGADO — mantido para migração) */
export interface BlockClientSlot {
  clientId: string
  spotsCount: number
}

/** Tipo de item dentro de um bloco comercial */
export type CommercialBlockItemType = 'spot_client' | 'vmix_action' | 'vmix_input'

/** Item ordenado dentro de um bloco comercial (mini-playlist) */
export interface CommercialBlockItem {
  id: string
  order: number
  type: CommercialBlockItemType
  title?: string           // label de exibição
  // spot_client
  clientId?: string
  spotsCount?: number      // quantos spots do cliente (round-robin)
  // vmix_action
  vmixAction?: VmixActionItem
  // vmix_input
  inputName?: string
  duration?: number        // segundos que o input fica no ar
}

/** Um bloco comercial agendado — mini-playlist de itens ordenados */
export interface CommercialBlock {
  id: string
  name: string
  scheduledTime: string     // HH:MM:SS
  items: CommercialBlockItem[]
  slots?: BlockClientSlot[] // LEGADO — apenas para migração de dados antigos
  enabled: boolean
  createdAt: string
  lastLoadedDate?: string   // YYYY-MM-DD — evita carga dupla no mesmo dia
  daysOfWeek?: number[]     // 0=Dom…6=Sáb; undefined = todos os dias
}

// ─────────────────────────────────────────────────────────────────────────────
// Estrutura de Programação Semanal
// ─────────────────────────────────────────────────────────────────────────────

/** Tipos de slot na estrutura semanal — inclui tipos de bloco além dos SpotTypes */
export type ScheduleSlotType = SpotType | 'bloco_comercial' | 'bloco_musical'

/** Um slot no template semanal */
export interface ProgramSlot {
  id: string
  order: number
  title: string
  type: ScheduleSlotType
  scheduledTime: string           // HH:MM:SS
  // Para programa / vinheta / outros:
  filePath?: string
  inputName?: string
  duration: number                // segundos
  mediaType?: 'video' | 'audio' | 'image'
  // Para bloco_comercial / bloco_musical:
  commercialBlockId?: string      // referência ao CommercialBlock
  notes?: string
  vmixAction?: VmixActionItem
}

/** Mapa dia-da-semana → lista de slots. Chave: 0=Dom … 6=Sáb */
export type WeeklyProgramGrid = Record<number, ProgramSlot[]>

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
  triggerEnabled: boolean
  triggerKey: string | null
  autoplayComerciais: boolean
  preloadMinutes: number
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
// AutoProg — Programação Automática de Blocos Musicais
// ─────────────────────────────────────────────────────────────────────────────
export type ArtistParseRule = 'filename_dash' | 'filename_underscore' | 'subfolder' | 'none'

/** Estilo musical — aponta para uma pasta de arquivos de áudio */
export interface MusicStyle {
  id: string
  name: string
  folderPath: string
  includeSubfolders: boolean
  artistParseRule: ArtistParseRule
  cooldownDays: number    // não repetir o mesmo arquivo por X dias
  color?: string          // cor hex para identificação visual
}

/** Item de uma sequência — estilo + quantidade por passagem */
export interface MusicSequenceItem {
  styleId: string
  count: number
}

/** Sequência musical — define ordem e regras de um bloco musical automático */
export interface MusicSequence {
  id: string
  name: string
  items: MusicSequenceItem[]
  noSameArtistWindow: number    // não repetir artista nas últimas N músicas (0 = desabilitado)
  fallback: 'ignore_cooldown' | 'skip' | 'alert'
  targetMode: 'count' | 'duration'
  targetValue: number           // N músicas ou N minutos
}

/** Atribuição de uma sequência a um bloco musical específico de um dia da semana */
export interface AutoBlocoAssignment {
  id: string
  programSlotId: string   // ProgramSlot.id com type === 'bloco_musical'
  dayOfWeek: number       // 0=Dom … 6=Sáb
  sequenceId: string | null  // null = sem automação (modo manual)
}

// ─────────────────────────────────────────────────────────────────────────────
// Electron bridge type (window.spotmaster)
// ─────────────────────────────────────────────────────────────────────────────
export interface SpotMasterAPI {
  saveData: (key: string, data: unknown) => Promise<void>
  loadData: (key: string) => Promise<unknown>
  readMediaDuration: (filePath: string) => Promise<number | null>
  getVersion: () => Promise<string>
  exportPlaylist: (data: unknown) => Promise<string | null>
  importPlaylist: () => Promise<unknown>
  exportGrid: (data: unknown) => Promise<string | null>
  importGrid: () => Promise<unknown>
  exportPDF: (filePath: string, buffer: number[]) => Promise<boolean>
  browseVideoFile: () => Promise<string | null>
  browseFolder: () => Promise<string | null>
  scanMusicFolder: (folderPath: string, includeSubfolders: boolean) => Promise<Array<{ filePath: string; filename: string; subfolder: string }>>
  vmixRequest: (params: Record<string, string>) => Promise<{ success: boolean; data?: string; error?: string }>
  vmixStartPolling: (host: string, port: number) => Promise<boolean>
  vmixStopPolling: () => Promise<boolean>
  onVmixStatus: (callback: (status: VmixStatus) => void) => void
  removeVmixStatusListener: () => void
  vmixStartFastPolling: (host: string, port: number) => Promise<boolean>
  vmixStopFastPolling: () => Promise<boolean>
  onVmixFastStatus: (callback: (status: VmixStatus) => void) => void
  removeVmixFastStatusListener: () => void
  openExternal: (url: string) => Promise<void>
  // Disparo (global trigger)
  registerTrigger: (key: string) => Promise<boolean>
  unregisterTrigger: () => Promise<void>
  onTriggerFired: (callback: () => void) => void
  removeTriggerListener: () => void
}

declare global {
  interface Window {
    spotmaster: SpotMasterAPI
  }
}
