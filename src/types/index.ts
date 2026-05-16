// ─────────────────────────────────────────────────────────────────────────────
// SpotMaster — Type Definitions
// ─────────────────────────────────────────────────────────────────────────────

export type SpotStatus = 'pending' | 'playing' | 'done' | 'skipped' | 'error'
export type SpotType = 'spot' | 'vinheta' | 'programa' | 'bumper' | 'outros' | 'vmix_action' | 'pause' | 'audio_trigger'

// ─────────────────────────────────────────────────────────────────────────────
// vMix Action Item — comando enviado diretamente ao vMix (sem mídia)
// ─────────────────────────────────────────────────────────────────────────────
export interface VmixActionItem {
  function: string    // 'AudioOff' | 'AudioOn' | 'SetVolume' | 'Fade' | 'OverlayInput1' | 'OverlayInput1Out' | ...
  input?: string      // GUID, nome ou número do input vMix (quando necessário)
  value?: string      // Para SetVolume (0–100), Fade (duração em ms), etc.
  duration?: string
  selectedName?: string
  selectedIndex?: string
  mix?: string
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
  campaignId?: string       // Campaign.id — quando o spot pertence a uma campanha
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
  audioLayerId?: string         // present only when type === 'audio_trigger'
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
  campaignId?: string      // Campaign.id — se inserido por distribuição automática
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
// Commercial Pro — Segmentos e Programas
// ─────────────────────────────────────────────────────────────────────────────

/** Segmento de mercado — usado para evitar concorrentes no mesmo bloco */
export interface Segment {
  id: string
  name: string
  description?: string
  createdAt: string
}

/** Faixa de programação — define janelas horárias em que campanhas podem veicular */
export interface ProgramWindow {
  id: string
  name: string
  daysOfWeek: number[]      // 0=Dom…6=Sáb
  timeFrom: string          // HH:MM
  timeTo: string            // HH:MM
  notes?: string
  createdAt: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Commercial Campaigns (Comercial Pro)
// ─────────────────────────────────────────────────────────────────────────────

export type CampaignStatus = 'active' | 'paused' | 'expired' | 'completed'
export type CampaignPriority = 1 | 2 | 3  // 1=alta, 2=média, 3=baixa
export type CampaignModality = 'standard' | 'rotativo'

/** Campanha comercial — contrato de veiculação de um anunciante */
export interface Campaign {
  id: string
  clientId: string
  name: string
  modality: CampaignModality   // 'standard' | 'rotativo'
  startDate: string            // YYYY-MM-DD
  endDate: string              // YYYY-MM-DD
  totalSpots: number           // quantidade contratada
  spotsPerDay?: number         // limite diário (0 ou undefined = sem limite)
  daysOfWeek?: number[]        // dias permitidos (undefined = todos)
  segmentId?: string           // Segment.id — para regra de concorrentes
  programWindowIds?: string[]  // ProgramWindow.id[] — janelas elegíveis (vazio = todos os blocos)
  priority: CampaignPriority
  blockPosition?: number       // 0-100, posição preferencial no bloco; desempate por priority
  status: CampaignStatus
  notes?: string
  createdAt: string
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
  campaignId?: string       // Campaign.id — quando o spot pertence a uma campanha
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
  // ── GC Musical automático ─────────────────────────────────────────────────
  gcMusicEnabled: boolean
  gcMusicDelaySeconds: number    // delay após o início (padrão: 5)
  gcMusicInputName: string       // nome do input de título no vMix
  gcMusicLine1Field: string      // campo da linha 1 no vMix (ex: "Artist")
  gcMusicLine2Field: string      // campo da linha 2 no vMix (ex: "Title")
  gcMusicDynamic: boolean        // true = ambas dinâmicas; false = linha 2 estática
  gcMusicStaticLine2?: string    // texto fixo para linha 2 quando !gcMusicDynamic
  gcMusicOverlay?: number        // canal de overlay 1-4 (0 = não ativar)
  gcMusicHideDuration?: number   // segundos até esconder o overlay (0 = manual)
  // ── Data Sources ──────────────────────────────────────────────────────────
  dataSourcesEnabled: boolean
  dataSourcesPort: number        // porta do servidor local (padrão: 7070)
  // ── Banco de Mídia ────────────────────────────────────────────────────────
  videoFolders: string[]         // pastas de vídeo extras (além das do AutoProg)
  audioFolders: string[]         // pastas de áudio extras (além das do AudioPro)
  // ── Transições entre clipes ───────────────────────────────────────────────
  transitionType: 'cut' | 'fade' | 'merge'  // tipo padrão de transição
  transitionDurationMs: number               // duração em ms (0 = usa o padrão do vMix)
  // ── Snapshot Comercial ────────────────────────────────────────────────────
  snapshotOnSpot: boolean         // tirar snapshot ao iniciar bloco comercial
}

// ─────────────────────────────────────────────────────────────────────────────
// VideoPro — Estilos de Vídeo (catálogo de vídeos por coleção/pasta)
// ─────────────────────────────────────────────────────────────────────────────

export interface VideoStyle {
  id: string
  name: string
  folderPath: string
  includeSubfolders: boolean
  color?: string
  createdAt: string
}

// ─────────────────────────────────────────────────────────────────────────────
// AudioPro — Estilos de Áudio com Placeholder Visual
// ─────────────────────────────────────────────────────────────────────────────
// Session Resume — snapshot do item em reprodução para retomar após restart
// ─────────────────────────────────────────────────────────────────────────────

export interface PlaybackSnapshot {
  itemId: string
  queue: 'playlist' | 'schedule'
  scheduleDate?: string      // YYYY-MM-DD quando queue='schedule'
  inputGuid?: string         // GUID do input no vMix
  inputName?: string         // nome do item para exibição
  startedAt: string          // ISO timestamp
  totalDuration: number      // duração total em segundos
  filePath?: string
}

export interface ResumeCandidate {
  itemId: string
  queue: 'playlist' | 'schedule'
  scheduleDate?: string
  inputGuid: string
  elapsedSeconds: number
  remainingSeconds: number
  inputTitle: string
}

// ─────────────────────────────────────────────────────────────────────────────

export type AudioStylePlaceholderType = 'none' | 'image' | 'vmix_input'

export interface AudioStyle {
  id: string
  name: string
  folderPath: string
  includeSubfolders: boolean
  color?: string
  /** Quando true, itens gerados pelo AutoProg a partir deste estilo recebem type='vinheta' */
  isVinheta?: boolean
  /** Tipo de placeholder visual que aparece no vMix quando este estilo está tocando */
  placeholderType: AudioStylePlaceholderType
  /** Caminho da imagem (para type='image') */
  placeholderImage?: string
  /** Nome do input vMix onde a imagem/overlay será mostrado */
  placeholderInputName?: string
  /** Canal de overlay 1–4 para ativar quando o áudio inicia */
  overlayChannel?: number
  createdAt: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Fase 3 — Saidas vMix / Perfis de Output
// ─────────────────────────────────────────────────────────────────────────────

export type VmixOutputTarget =
  | 'output2'
  | 'output3'
  | 'output4'
  | 'fullscreen1'
  | 'fullscreen2'
  | 'external2'

export type VmixOutputSource = 'program' | 'preview' | 'multiview' | 'clean_feed' | 'input' | 'mix'

export interface VmixOutputProfile {
  id: string
  name: string
  target: VmixOutputTarget
  source: VmixOutputSource
  inputName?: string
  mix?: string
  createdAt: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Grafismos — inputs de título e templates
// ─────────────────────────────────────────────────────────────────────────────

export interface GrafismoField {
  name: string    // nome do campo no vMix (ex: "Artist")
  label: string   // rótulo de exibição no VTMaster
}

export interface GrafismoTitleInput {
  id: string
  name: string             // nome exato do input no vMix (ex: "Lower Third")
  fields: GrafismoField[]
  createdAt: string
}

export type GrafismoFieldSource =
  | 'now_artist'   | 'now_song'    | 'now_title'
  | 'next_artist'  | 'next_song'   | 'next_title'
  | 'time'         | 'station'     | 'static'

export interface GrafismoTemplateMapping {
  fieldName: string
  source: GrafismoFieldSource
  staticValue?: string
}

export interface GrafismoTemplate {
  id: string
  name: string
  inputId: string
  mappings: GrafismoTemplateMapping[]
  overlayChannel?: number    // 1-4, 0 = não ativar overlay
  hideDuration?: number      // segundos para esconder (0 = manual)
  createdAt: string
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
  external?: boolean
  srtOutput?: boolean
  multiCorder?: boolean
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

export interface VmixCommandLog {
  id: string
  at: string
  source: string
  functionName: string
  params: Record<string, string>
  success: boolean
  latencyMs: number
  category?: VmixCommandCategory
  risk?: VmixCommandRisk
  itemId?: string
  itemTitle?: string
  scheduleDate?: string
  scheduledTime?: string
  queue?: 'playlist' | 'schedule' | 'manual' | 'system'
  attempt?: number
  response?: string
  error?: string
}

export type VmixCommandCategory =
  | 'status'
  | 'input'
  | 'playback'
  | 'transition'
  | 'audio'
  | 'overlay'
  | 'recording'
  | 'streaming'
  | 'output'
  | 'title'
  | 'browser'
  | 'script'
  | 'unknown'

export type VmixCommandRisk = 'low' | 'medium' | 'high'

export interface VmixCommandMeta {
  source?: string
  category?: VmixCommandCategory
  risk?: VmixCommandRisk
  itemId?: string
  itemTitle?: string
  scheduleDate?: string
  scheduledTime?: string
  queue?: 'playlist' | 'schedule' | 'manual' | 'system'
  attempt?: number
}

export interface VmixRequestResult {
  success: boolean
  data?: string
  error?: string
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
// AudioPro — Camadas de Áudio Paralelas / Independentes (Fase 6)
// ─────────────────────────────────────────────────────────────────────────────

export type AudioLayerMode = 'parallel' | 'replace'
export type AudioLayerSourceType = 'round_robin' | 'fixed_input'
export type AudioPlaceholderType = 'file' | 'vmix_input'
export type AudioLayerCategory = 'vinheta' | 'musica' | 'trilha' | 'outros'
export type AudioLayerPlayMode = 'once' | 'loop'

/** Fonte de áudio individual dentro de uma camada round-robin */
export interface AudioPlaceholder {
  id: string
  name: string
  type: AudioPlaceholderType
  /** Caminho do arquivo no disco (para type='file') */
  filePath?: string
  /** Nome do input no vMix (para type='vmix_input') */
  inputName?: string
  /** Duração em segundos (opcional; usado para timing) */
  duration?: number
  /** Sobrescreve defaultMode da camada (undefined = herda) */
  mode?: AudioLayerMode
}

/** Camada de áudio — pode ser round-robin de arquivos/inputs ou um input fixo */
export interface AudioLayer {
  id: string
  name: string
  /** Categoria: influencia comportamentos padrão */
  category?: AudioLayerCategory
  /** Modo de reprodução: 'once' toca e para; 'loop' fica em loop até parar */
  playMode?: AudioLayerPlayMode
  /** Se true, esta camada para quando qualquer outra camada for disparada */
  stopOnNewTrigger?: boolean
  /** Comandos vMix executados ANTES do áudio iniciar */
  preActions?: VmixActionItem[]
  /** Comandos vMix executados APÓS o áudio parar ou terminar */
  postActions?: VmixActionItem[]
  /** Modo de reprodução padrão */
  defaultMode: AudioLayerMode
  /** Como a fonte de áudio é selecionada */
  sourceType: AudioLayerSourceType
  /** Input vMix fixo (para sourceType='fixed_input') */
  fixedInputName?: string
  /** Canal de overlay no vMix (1–4; null = sem overlay visual; relevante para parallel) */
  overlayChannel?: 1 | 2 | 3 | 4 | null
  /** Volume padrão 0–100 (undefined = não altera volume no vMix) */
  volume?: number
  /** Lista de fontes para o round-robin */
  placeholders: AudioPlaceholder[]
  /** Posição atual no round-robin (persistida) */
  currentIndex: number
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
  isJingle?: boolean      // true = estilo de vinhetas/jingles (sem cooldown rígido, inserção a cada N músicas)
}

/** Item de uma sequência — estilo + quantidade por passagem */
export interface MusicSequenceItem {
  mediaType?: 'audio' | 'video'  // undefined = legado, tratado como audio
  styleId: string
  count: number
}

/** Sequência musical — define ordem e regras de um bloco musical automático */
export interface MusicSequence {
  id: string
  name: string
  items: MusicSequenceItem[]
  noSameArtistWindow: number    // não repetir artista nas últimas N músicas (0 = desabilitado)
  maxSameDayArtistPlays?: number  // máximo de veiculações por artista no mesmo dia (0 ou undefined = sem limite)
  fallback: 'ignore_cooldown' | 'skip' | 'alert'
  targetMode: 'count' | 'duration'
  targetValue: number           // N músicas ou N minutos
  /** ID do estilo de jingles/vinhetas a ser inserido automaticamente */
  jingleStyleId?: string
  /** Inserir 1 jingle a cada N músicas regulares (0 ou undefined = desabilitado) */
  jingleEveryN?: number
}

/** Atribuição de uma sequência a um bloco musical específico de um dia da semana */
export interface AutoBlocoAssignment {
  id: string
  programSlotId: string   // ProgramSlot.id com type === 'bloco_musical'
  dayOfWeek: number       // 0=Dom … 6=Sáb
  sequenceId: string | null  // null = sem automação (modo manual)
}

// ─────────────────────────────────────────────────────────────────────────────
// Musical Pro — Biblioteca Musical (Fase 5)
// ─────────────────────────────────────────────────────────────────────────────

/** Faixa da biblioteca musical com metadados editáveis */
export interface MusicTrack {
  id: string
  filePath: string
  filename: string
  /** Título editável pelo operador (fallback: nome do arquivo sem extensão) */
  title: string
  /** Artista editável pelo operador (fallback: extraído via artistParseRule do estilo) */
  artist: string
  album?: string
  year?: number
  /** Gênero/estilo musical (texto livre) */
  genre?: string
  /** Energia 1–5 (1 = calma, 5 = alta energia) */
  energy?: number
  /** Idioma (ex: 'pt', 'en', 'es') */
  language?: string
  /** BPM (batidas por minuto) */
  bpm?: number
  /** Tags livres para filtragem */
  tags: string[]
  /** Data do último dia em que a faixa foi veiculada (YYYY-MM-DD) */
  lastAiredDate?: string
  /** Total de veiculações registradas */
  playCount: number
  /** Duração em segundos */
  duration?: number
  /** MD5 hex do conteúdo do arquivo — detecta renomeados/duplicatas na reconciliação */
  md5?: string
  /** true se o arquivo não foi encontrado na última reconciliação */
  missing?: boolean
}

/** Metadados retornados pelo IPC read-track-metadata */
export interface TrackMetadataResult {
  title: string | null
  artist: string | null
  album: string | null
  year: number | null
  genre: string | null
  bpm: number | null
  duration: number | null
}

// ─────────────────────────────────────────────────────────────────────────────
// Electron bridge type (window.spotmaster)
// ─────────────────────────────────────────────────────────────────────────────
export interface UpdateStatus {
  status: 'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error'
  version?: string
  percent?: number
  message?: string
}

export interface SpotMasterAPI {
  saveData: (key: string, data: unknown) => Promise<void>
  loadData: (key: string) => Promise<unknown>
  createBackup: (reason?: string) => Promise<{ success: boolean; path?: string; error?: string }>
  fileExists: (filePaths: string[]) => Promise<Record<string, boolean>>
  readMediaDuration: (filePath: string) => Promise<number | null>
  readMediaDurationMM: (filePath: string) => Promise<number | null>
  getVersion: () => Promise<string>
  checkForUpdates: () => Promise<UpdateStatus>
  installUpdate: () => Promise<boolean>
  onUpdateStatus: (callback: (status: UpdateStatus) => void) => void
  removeUpdateStatusListener: () => void
  exportPlaylist: (data: unknown) => Promise<string | null>
  importPlaylist: () => Promise<unknown>
  exportGrid: (data: unknown) => Promise<string | null>
  importGrid: () => Promise<unknown>
  exportPDF: (filePath: string, buffer: number[]) => Promise<boolean>
  browseVideoFile: () => Promise<string | null>
  browseFolder: () => Promise<string | null>
  scanMusicFolder: (folderPath: string, includeSubfolders: boolean) => Promise<Array<{ filePath: string; filename: string; subfolder: string }>>
  readTrackMetadata: (filePath: string) => Promise<TrackMetadataResult | null>
  hashFileMd5: (filePath: string) => Promise<string | null>
  reconcileMusicFolders: (folderPaths: string[], existingTracks: MusicTrack[]) => Promise<{
    new: Array<{ filePath: string; filename: string }>
    missing: string[]  // filePaths ausentes
    renamed: Array<{ oldPath: string; newPath: string; newFilename: string; md5: string }>
    duplicates: Array<{ tracks: string[] }>  // arrays de filePaths com mesmo md5
  }>
  vmixRequest: (params: Record<string, string>, meta?: VmixCommandMeta) => Promise<VmixRequestResult>
  vmixStartPolling: (host: string, port: number) => Promise<boolean>
  vmixStopPolling: () => Promise<boolean>
  onVmixStatus: (callback: (status: VmixStatus) => void) => void
  removeVmixStatusListener: () => void
  vmixStartFastPolling: (host: string, port: number) => Promise<boolean>
  vmixStopFastPolling: () => Promise<boolean>
  onVmixFastStatus: (callback: (status: VmixStatus) => void) => void
  removeVmixFastStatusListener: () => void
  onVmixCommandLog: (callback: (log: VmixCommandLog) => void) => void
  removeVmixCommandLogListener: () => void
  openExternal: (url: string) => Promise<void>
  // Disparo (global trigger)
  registerTrigger: (key: string) => Promise<boolean>
  unregisterTrigger: () => Promise<void>
  onTriggerFired: (callback: () => void) => void
  removeTriggerListener: () => void
  // Data Sources
  updateDataSources: (snapshot: unknown) => Promise<void>
  startDataSourcesServer: (port: number) => Promise<{ success: boolean; port?: number; error?: string }>
  stopDataSourcesServer: () => Promise<{ success: boolean }>
  getDataSourcesStatus: () => Promise<{ running: boolean }>
  // Banco de Mídia — vídeos
  scanVideoFolder: (folderPath: string, includeSubfolders: boolean) => Promise<Array<{ filePath: string; filename: string }>>
  // Session resume
  savePlaybackSnapshot: (snapshot: PlaybackSnapshot) => Promise<boolean>
  loadPlaybackSnapshot: () => Promise<PlaybackSnapshot | null>
  clearPlaybackSnapshot: () => Promise<boolean>
}

declare global {
  interface Window {
    spotmaster: SpotMasterAPI
  }
}
