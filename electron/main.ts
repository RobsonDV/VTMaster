import { app, BrowserWindow, ipcMain, dialog, shell, protocol, net, globalShortcut, powerSaveBlocker, Menu } from 'electron'
import { createServer, type Server } from 'http'
import { fileURLToPath, pathToFileURL } from 'url'
import { dirname, join } from 'path'
import { closeSync, copyFileSync, existsSync, mkdirSync, openSync, readFileSync, readSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from 'fs'
import { createReadStream } from 'fs'
import { createHash } from 'crypto'
import { randomUUID } from 'crypto'
import electronUpdater, { type UpdateInfo } from 'electron-updater'
import { makeVmixRequest, startVmixPolling, stopVmixPolling, startVmixFastPolling, stopVmixFastPolling } from './vmix.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const isDev = process.env.NODE_ENV === 'development'
const isPortable = !!process.env.PORTABLE_EXECUTABLE_DIR
const { autoUpdater } = electronUpdater

// Register custom scheme BEFORE app ready — allows renderer to load local media
// files via local-media:///path without CORS/CSP restrictions
protocol.registerSchemesAsPrivileged([
  { scheme: 'local-media', privileges: { secure: true, stream: true, supportFetchAPI: true, corsEnabled: true } },
])

let mainWindow: BrowserWindow | null = null
let registeredTriggerKey: string | null = null
let updateDownloaded = false
let powerSaveBlockerId: number | null = null

function localDateYmd(date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

const BACKUP_KEYS = [
  'settings',
  'playlist',
  'clients',
  'playLog',
  'commercialBlocks',
  'clientSpots',
  'spotRotation',
  'activePanel',
  'weeklyGrid',
  'dateSchedules',
  'musicStyles',
  'musicSequences',
  'autoBlocoAssignments',
  'deletedScheduleSlots',
  'mediaDurationCache',
  'vmixCommandLog',
  'campaigns',
  'segments',
  'programWindows',
  'grafismoTitleInputs',
  'grafismoTemplates',
  'musicLibrary',
  'audioLayers',
  'videoStyles',
  'audioStyles',
  'vmixOutputProfiles',
]

// ── Data Sources HTTP server ──────────────────────────────────────────────────
let dataSourcesServer: Server | null = null
let dataSourcesSnapshot: Record<string, unknown> = {}

type UpdateStatus = {
  status: 'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error'
  version?: string
  percent?: number
  message?: string
}

type VmixCommandLog = {
  id: string
  at: string
  source: string
  functionName: string
  params: Record<string, string>
  success: boolean
  latencyMs: number
  category?: string
  risk?: string
  itemId?: string
  itemTitle?: string
  scheduleDate?: string
  scheduledTime?: string
  queue?: string
  attempt?: number
  response?: string
  error?: string
}

type VmixCommandMeta = {
  source?: string
  category?: string
  risk?: string
  itemId?: string
  itemTitle?: string
  scheduleDate?: string
  scheduledTime?: string
  queue?: string
  attempt?: number
}

function sendUpdateStatus(status: UpdateStatus): void {
  mainWindow?.webContents.send('update-status', status)
}

// ─────────────────────────────────────────────────────────────────────────────
// Data store (userData JSON files)
// ─────────────────────────────────────────────────────────────────────────────
function getUserDataPath(): string {
  const dataDir = join(app.getPath('userData'), 'SpotMaster')
  if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true })
  return dataDir
}

function assertStorageKey(key: string): void {
  if (!/^[a-zA-Z0-9_-]+$/.test(key)) {
    throw new Error(`Invalid storage key: ${key}`)
  }
}

function storageFilePath(key: string): string {
  assertStorageKey(key)
  return join(getUserDataPath(), `${key}.json`)
}

function saveData(key: string, data: unknown): void {
  const filePath = storageFilePath(key)
  const tmpPath = `${filePath}.${process.pid}.tmp`
  writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf-8')
  renameSync(tmpPath, filePath)
}

function loadData(key: string): unknown {
  const filePath = storageFilePath(key)
  if (existsSync(filePath)) {
    try {
      return JSON.parse(readFileSync(filePath, 'utf-8'))
    } catch {
      return null
    }
  }
  return null
}

function backupTimestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-')
}

function sanitizeBackupReason(reason: string): string {
  return reason
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'manual'
}

function pruneOldBackups(maxBackups = 60): void {
  const backupRoot = join(getUserDataPath(), 'backups')
  if (!existsSync(backupRoot)) return
  const dirs = readdirSync(backupRoot, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => {
      const path = join(backupRoot, entry.name)
      let mtime = 0
      try { mtime = statSync(path).mtimeMs } catch { /* ignore */ }
      return { name: entry.name, path, mtime }
    })
    .sort((a, b) => b.mtime - a.mtime)

  for (const old of dirs.slice(maxBackups)) {
    try { rmSync(old.path, { recursive: true, force: true }) } catch { /* ignore */ }
  }
}

function createDataBackup(reason = 'manual'): string {
  const dataDir = getUserDataPath()
  const backupRoot = join(dataDir, 'backups')
  if (!existsSync(backupRoot)) mkdirSync(backupRoot, { recursive: true })

  const dirName = `${backupTimestamp()}-${sanitizeBackupReason(reason)}`
  const backupDir = join(backupRoot, dirName)
  mkdirSync(backupDir, { recursive: true })

  const copied: string[] = []
  for (const key of BACKUP_KEYS) {
    const src = join(dataDir, `${key}.json`)
    if (!existsSync(src)) continue
    try {
      copyFileSync(src, join(backupDir, `${key}.json`))
      copied.push(key)
    } catch { /* ignore individual file copy failures */ }
  }

  writeFileSync(
    join(backupDir, 'manifest.json'),
    JSON.stringify({ createdAt: new Date().toISOString(), reason, copied }, null, 2),
    'utf-8',
  )
  pruneOldBackups()
  return backupDir
}

function ensureDailyBackup(): void {
  const backupRoot = join(getUserDataPath(), 'backups')
  if (!existsSync(backupRoot)) mkdirSync(backupRoot, { recursive: true })
  const todayPrefix = localDateYmd()
  const alreadyExists = readdirSync(backupRoot, { withFileTypes: true })
    .some(entry => entry.isDirectory() && entry.name.startsWith(todayPrefix) && entry.name.includes('daily'))
  if (!alreadyExists) createDataBackup('daily')
}

function appendVmixCommandLog(log: VmixCommandLog): void {
  const current = loadData('vmixCommandLog')
  const list = Array.isArray(current) ? current as VmixCommandLog[] : []
  const next = [...list, log].slice(-2000)
  saveData('vmixCommandLog', next)
}

function cleanMetaValue(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed ? trimmed.slice(0, 300) : undefined
}

function sanitizeVmixCommandMeta(meta: unknown): VmixCommandMeta {
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return {}
  const raw = meta as Record<string, unknown>
  const attemptRaw = Number(raw.attempt)
  return {
    source: cleanMetaValue(raw.source),
    category: cleanMetaValue(raw.category),
    risk: cleanMetaValue(raw.risk),
    itemId: cleanMetaValue(raw.itemId),
    itemTitle: cleanMetaValue(raw.itemTitle),
    scheduleDate: cleanMetaValue(raw.scheduleDate),
    scheduledTime: cleanMetaValue(raw.scheduledTime),
    queue: cleanMetaValue(raw.queue),
    attempt: Number.isFinite(attemptRaw) && attemptRaw > 0 ? Math.round(attemptRaw) : undefined,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Native media duration fallback
// ─────────────────────────────────────────────────────────────────────────────
function readUInt64BEAsNumber(buffer: Buffer, offset: number): number {
  const high = buffer.readUInt32BE(offset)
  const low = buffer.readUInt32BE(offset + 4)
  return high * 0x100000000 + low
}

function readExact(fd: number, position: number, length: number): Buffer | null {
  const buffer = Buffer.alloc(length)
  const bytesRead = readSync(fd, buffer, 0, length, position)
  return bytesRead === length ? buffer : null
}

function durationFromTimescale(duration: number, timescale: number): number | null {
  if (!Number.isFinite(duration) || !Number.isFinite(timescale) || duration <= 0 || timescale <= 0) {
    return null
  }
  const seconds = Math.round(duration / timescale)
  return seconds > 0 ? seconds : null
}

function readMvhdDuration(fd: number, payloadStart: number, atomEnd: number): number | null {
  const versionHeader = readExact(fd, payloadStart, 1)
  if (!versionHeader) return null

  const version = versionHeader.readUInt8(0)
  if (version === 0) {
    if (payloadStart + 20 > atomEnd) return null
    const data = readExact(fd, payloadStart + 12, 8)
    if (!data) return null
    return durationFromTimescale(data.readUInt32BE(4), data.readUInt32BE(0))
  }

  if (version === 1) {
    if (payloadStart + 32 > atomEnd) return null
    const data = readExact(fd, payloadStart + 20, 12)
    if (!data) return null
    return durationFromTimescale(readUInt64BEAsNumber(data, 4), data.readUInt32BE(0))
  }

  return null
}

function scanMp4Atoms(fd: number, start: number, end: number, depth = 0): number | null {
  if (depth > 8) return null

  const containerAtoms = new Set(['moov', 'trak', 'mdia', 'minf', 'stbl', 'edts', 'udta', 'meta'])
  let position = start

  while (position + 8 <= end) {
    const header = readExact(fd, position, 8)
    if (!header) return null

    const size32 = header.readUInt32BE(0)
    const type = header.toString('ascii', 4, 8)
    let headerSize = 8
    let atomEnd = size32 === 0 ? end : position + size32

    if (size32 === 1) {
      const extendedSize = readExact(fd, position + 8, 8)
      if (!extendedSize) return null
      headerSize = 16
      atomEnd = position + readUInt64BEAsNumber(extendedSize, 0)
    }

    if (atomEnd < position + headerSize || atomEnd > end) return null

    const payloadStart = position + headerSize
    if (type === 'mvhd') {
      const duration = readMvhdDuration(fd, payloadStart, atomEnd)
      if (duration) return duration
    }

    if (containerAtoms.has(type)) {
      const nestedStart = type === 'meta' ? payloadStart + 4 : payloadStart
      if (nestedStart < atomEnd) {
        const duration = scanMp4Atoms(fd, nestedStart, atomEnd, depth + 1)
        if (duration) return duration
      }
    }

    position = atomEnd
  }

  return null
}

function readMp4Duration(filePath: string): number | null {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? ''
  if (!['mp4', 'm4v', 'mov', 'm4a', '3gp'].includes(ext)) return null

  let fd: number | null = null
  try {
    const size = statSync(filePath).size
    if (size <= 0) return null
    fd = openSync(filePath, 'r')
    return scanMp4Atoms(fd, 0, size)
  } catch {
    return null
  } finally {
    if (fd !== null) {
      try { closeSync(fd) } catch { /* noop */ }
    }
  }
}

function readNativeMediaDuration(filePath: string): number | null {
  return readMp4Duration(filePath)
}

// ─────────────────────────────────────────────────────────────────────────────
// Auto updater (GitHub Releases via electron-updater)
// ─────────────────────────────────────────────────────────────────────────────
function setupAutoUpdater(): void {
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('checking-for-update', () => {
    sendUpdateStatus({ status: 'checking', message: 'Verificando atualizações...' })
  })

  autoUpdater.on('update-available', (info: UpdateInfo) => {
    updateDownloaded = false
    sendUpdateStatus({ status: 'available', version: info.version, message: `Baixando versão ${info.version}...` })
  })

  autoUpdater.on('update-not-available', (info: UpdateInfo) => {
    sendUpdateStatus({ status: 'not-available', version: info.version, message: 'Você já está na versão mais recente.' })
  })

  autoUpdater.on('download-progress', progress => {
    sendUpdateStatus({
      status: 'downloading',
      percent: Math.round(progress.percent),
      message: `Baixando atualização: ${Math.round(progress.percent)}%`,
    })
  })

  autoUpdater.on('update-downloaded', async (info: UpdateInfo) => {
    updateDownloaded = true
    sendUpdateStatus({ status: 'downloaded', version: info.version, message: `Versão ${info.version} pronta para instalar.` })
    if (!mainWindow) return

    const result = await dialog.showMessageBox(mainWindow, {
      type: 'info',
      buttons: ['Reiniciar agora', 'Depois'],
      defaultId: 0,
      cancelId: 1,
      title: 'Atualização pronta',
      message: `VTMaster ${info.version} foi baixado.`,
      detail: 'Reinicie o aplicativo para aplicar a atualização. A programação salva não será apagada.',
    })

    if (result.response === 0) autoUpdater.quitAndInstall()
  })

  autoUpdater.on('error', err => {
    sendUpdateStatus({
      status: 'error',
      message: err instanceof Error ? err.message : String(err),
    })
  })
}

async function checkForAppUpdates(manual = false): Promise<UpdateStatus> {
  if (!app.isPackaged || isPortable) {
    const status: UpdateStatus = {
      status: 'not-available',
      version: app.getVersion(),
      message: isPortable
        ? 'Atualizações automáticas exigem a versão instalada pelo Setup.'
        : 'Atualizações automáticas só rodam no app instalado.',
    }
    if (manual) sendUpdateStatus(status)
    return status
  }

  try {
    sendUpdateStatus({ status: 'checking', message: 'Verificando atualizações...' })
    await autoUpdater.checkForUpdates()
    return { status: 'checking', message: 'Verificação iniciada.' }
  } catch (err) {
    const status: UpdateStatus = {
      status: 'error',
      message: err instanceof Error ? err.message : String(err),
    }
    sendUpdateStatus(status)
    return status
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Window creation
// ─────────────────────────────────────────────────────────────────────────────
function createWindow(): void {
  Menu.setApplicationMenu(null)

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    title: 'VTMaster',
    backgroundColor: '#0f0f1a',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
    icon: app.isPackaged
      ? join(process.resourcesPath, 'icon.ico')
      : join(__dirname, '../public/icon.ico'),
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
  } else {
    mainWindow.loadFile(join(__dirname, '../dist/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
    stopVmixPolling()
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// App lifecycle
// ─────────────────────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  powerSaveBlockerId = powerSaveBlocker.start('prevent-app-suspension')
  setupAutoUpdater()

  // Serve local files through custom protocol so renderer can read video/audio
  // metadata even when the page is served from http://localhost:5173 (dev mode).
  //
  // Decodifica percent-encoding ANTES de construir o file:// — sem isso, paths
  // com acentos (é → %C3%A9), espaços (%20) ou parênteses falham com
  // ERR_UNEXPECTED no net.fetch, e o app não consegue ler a duração do arquivo.
  protocol.handle('local-media', (request) => {
    try {
      const encoded = request.url.slice('local-media:///'.length)
      // decodeURIComponent converte %20 → " ", %C3%A9 → "é" etc.
      const filePath = decodeURIComponent(encoded)
      // pathToFileURL gera um file:// URL válido para caminhos Windows (com drive),
      // preservando caracteres especiais corretamente.
      return net.fetch(pathToFileURL(filePath).toString())
    } catch (err) {
      console.error('[local-media] falha ao resolver', request.url, err)
      return new Response(null, { status: 500 })
    }
  })

  try { ensureDailyBackup() } catch (err) { console.error('[backup] daily backup failed', err) }

  createWindow()
  if (app.isPackaged && !isPortable) {
    setTimeout(() => { void checkForAppUpdates() }, 12_000)
    setInterval(() => { void checkForAppUpdates() }, 6 * 60 * 60 * 1000)
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('will-quit', () => {
  if (powerSaveBlockerId !== null && powerSaveBlocker.isStarted(powerSaveBlockerId)) {
    powerSaveBlocker.stop(powerSaveBlockerId)
  }
  globalShortcut.unregisterAll()
})

// ─────────────────────────────────────────────────────────────────────────────
// IPC Handlers
// ─────────────────────────────────────────────────────────────────────────────

// Save/load persistent data
ipcMain.handle('save-data', (_event, key: string, data: unknown) => {
  saveData(key, data)
  return true
})

ipcMain.handle('load-data', (_event, key: string) => {
  return loadData(key)
})

ipcMain.handle('save-playback-snapshot', (_event, snapshot: unknown) => {
  saveData('lastPlaybackSnapshot', snapshot)
  return true
})

ipcMain.handle('load-playback-snapshot', () => {
  try { return loadData('lastPlaybackSnapshot') ?? null } catch { return null }
})

ipcMain.handle('clear-playback-snapshot', () => {
  saveData('lastPlaybackSnapshot', null)
  return true
})

ipcMain.handle('create-backup', (_event, reason?: string) => {
  try {
    return { success: true, path: createDataBackup(reason || 'manual') }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) }
  }
})

ipcMain.handle('file-exists', (_event, filePaths: string[]) => {
  const out: Record<string, boolean> = {}
  for (const filePath of filePaths) {
    try {
      out[filePath] = existsSync(filePath) && statSync(filePath).isFile()
    } catch {
      out[filePath] = false
    }
  }
  return out
})

ipcMain.handle('read-media-duration', (_event, filePath: string) => {
  return readNativeMediaDuration(filePath)
})

// Lê duração via music-metadata (Node.js, lê headers binários do arquivo).
// Muito mais rápido e confiável que o elemento HTML5 para áudio e vídeo.
// Suporta MP3, FLAC, WAV, OGG, AAC, M4A, MP4, MOV, AVI, WMA, OPUS, AIFF…
ipcMain.handle('read-media-duration-mm', async (_event, filePath: string) => {
  try {
    const { parseFile } = await import('music-metadata')
    const meta = await parseFile(filePath, { duration: true, skipCovers: true, includeChapters: false })
    const dur = meta.format.duration
    return (typeof dur === 'number' && isFinite(dur) && dur > 0) ? dur : null
  } catch {
    return null
  }
})

// Get app version
ipcMain.handle('get-version', () => {
  return app.getVersion()
})

ipcMain.handle('check-for-updates', async () => {
  return checkForAppUpdates(true)
})

ipcMain.handle('install-update', () => {
  if (!updateDownloaded) return false
  autoUpdater.quitAndInstall()
  return true
})

// Open external URL
ipcMain.handle('open-external', (_event, url: string) => {
  shell.openExternal(url)
})

// Export playlist to JSON file
ipcMain.handle('export-playlist', async (_event, data: unknown) => {
  if (!mainWindow) return null
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Exportar Playlist',
    defaultPath: `playlist-${localDateYmd()}.json`,
    filters: [{ name: 'JSON', extensions: ['json'] }],
  })
  if (!result.canceled && result.filePath) {
    writeFileSync(result.filePath, JSON.stringify(data, null, 2), 'utf-8')
    return result.filePath
  }
  return null
})

// Import playlist from JSON file
ipcMain.handle('import-playlist', async () => {
  if (!mainWindow) return null
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Importar Playlist',
    filters: [{ name: 'JSON', extensions: ['json'] }],
    properties: ['openFile'],
  })
  if (!result.canceled && result.filePaths.length > 0) {
    try {
      const content = readFileSync(result.filePaths[0], 'utf-8')
      return JSON.parse(content)
    } catch {
      return null
    }
  }
  return null
})

// Export weekly grid structure
ipcMain.handle('export-grid', async (_event, data: unknown) => {
  if (!mainWindow) return null
  const date = localDateYmd()
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Exportar Estrutura de Grade',
    defaultPath: `grade-${date}.vtgrid`,
    filters: [
      { name: 'VTMaster Grade', extensions: ['vtgrid'] },
      { name: 'JSON', extensions: ['json'] },
    ],
  })
  if (!result.canceled && result.filePath) {
    writeFileSync(result.filePath, JSON.stringify(data, null, 2), 'utf-8')
    return result.filePath
  }
  return null
})

// Import weekly grid structure
ipcMain.handle('import-grid', async () => {
  if (!mainWindow) return null
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Importar Estrutura de Grade',
    filters: [
      { name: 'VTMaster Grade', extensions: ['vtgrid'] },
      { name: 'JSON', extensions: ['json'] },
    ],
    properties: ['openFile'],
  })
  if (!result.canceled && result.filePaths.length > 0) {
    try {
      return JSON.parse(readFileSync(result.filePaths[0], 'utf-8'))
    } catch {
      return null
    }
  }
  return null
})

// Export PDF report
ipcMain.handle('export-pdf', async (_event, filePath: string, buffer: number[]) => {
  if (!mainWindow) return false
  try {
    const saveResult = await dialog.showSaveDialog(mainWindow, {
      title: 'Salvar Relatório PDF',
      defaultPath: filePath,
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
    })
    if (!saveResult.canceled && saveResult.filePath) {
      writeFileSync(saveResult.filePath, Buffer.from(buffer))
      shell.openPath(saveResult.filePath)
      return true
    }
    return false
  } catch {
    return false
  }
})

// Browse for media file (video, image, audio)
ipcMain.handle('browse-video-file', async () => {
  if (!mainWindow) return null
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Selecionar Arquivo de Mídia',
    filters: [
      {
        name: 'Todos os formatos de mídia',
        extensions: ['mp4','mov','avi','mkv','wmv','flv','webm','mxf','ts','m2ts','m4v','3gp','asf','mpg','mpeg','jpg','jpeg','png','gif','bmp','webp','tiff','tif','mp3','wav','aac','ogg','flac','m4a','wma','opus','aiff'],
      },
      { name: 'Vídeos', extensions: ['mp4','mov','avi','mkv','wmv','flv','webm','mxf','ts','m2ts','m4v','3gp','asf','mpg','mpeg'] },
      { name: 'Imagens', extensions: ['jpg','jpeg','png','gif','bmp','webp','tiff','tif'] },
      { name: 'Áudios', extensions: ['mp3','wav','aac','ogg','flac','m4a','wma','opus','aiff'] },
      { name: 'Todos os Arquivos', extensions: ['*'] },
    ],
    properties: ['openFile'],
  })
  return result.canceled ? null : result.filePaths[0] ?? null
})

// Browse for a folder
ipcMain.handle('browse-folder', async () => {
  if (!mainWindow) return null
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Selecionar Pasta',
    properties: ['openDirectory'],
  })
  return result.canceled ? null : result.filePaths[0] ?? null
})

// Scan a folder for media files (used by AutoProg)
ipcMain.handle('scan-music-folder', async (_event, folderPath: string, includeSubfolders: boolean) => {
  const MEDIA_EXTS = new Set([
    'mp3','wav','aac','ogg','flac','m4a','wma','opus','aiff',
    'mp4','mov','avi','mkv','wmv','flv','webm',
  ])
  type ScanResult = { filePath: string; filename: string; subfolder: string }
  const results: ScanResult[] = []

  function scanDir(dir: string, relative: string) {
    try {
      const entries = readdirSync(dir, { withFileTypes: true })
      for (const entry of entries) {
        if (entry.isDirectory() && includeSubfolders) {
          scanDir(
            join(dir, entry.name),
            relative ? `${relative}/${entry.name}` : entry.name,
          )
        } else if (entry.isFile()) {
          const ext = entry.name.split('.').pop()?.toLowerCase() ?? ''
          if (MEDIA_EXTS.has(ext)) {
            results.push({
              filePath: join(dir, entry.name),
              filename: entry.name,
              subfolder: relative,
            })
          }
        }
      }
    } catch { /* ignore permissão negada e similares */ }
  }

  scanDir(folderPath, '')
  return results
})

// ── Musical Pro — Fase 5 ──────────────────────────────────────────────────────

// Helper: computa MD5 de um arquivo via streaming (null em caso de erro)
async function computeStreamMd5(filePath: string): Promise<string | null> {
  return new Promise<string | null>((resolve) => {
    try {
      const hash = createHash('md5')
      const stream = createReadStream(filePath, { highWaterMark: 64 * 1024 })
      stream.on('data', (chunk) => hash.update(chunk))
      stream.on('end', () => resolve(hash.digest('hex')))
      stream.on('error', () => resolve(null))
    } catch {
      resolve(null)
    }
  })
}

// Lê metadados de tags de um arquivo de áudio/vídeo via music-metadata
ipcMain.handle('read-track-metadata', async (_event, filePath: string) => {
  try {
    const { parseFile } = await import('music-metadata')
    const meta = await parseFile(filePath, { duration: true, skipCovers: true })
    return {
      title:    meta.common.title   ?? null,
      artist:   meta.common.artist  ?? null,
      album:    meta.common.album   ?? null,
      year:     meta.common.year    ?? null,
      genre:    meta.common.genre?.[0] ?? null,
      bpm:      meta.common.bpm     ?? null,
      duration: meta.format.duration != null ? Math.round(meta.format.duration) : null,
    }
  } catch {
    return null
  }
})

// Calcula o hash MD5 do conteúdo de um arquivo (para detecção de duplicatas/renomeados)
ipcMain.handle('hash-file-md5', async (_event, filePath: string) => {
  return computeStreamMd5(filePath)
})

// Reconcilia a biblioteca musical com os arquivos reais nas pastas — Sub-fase 5B completo
ipcMain.handle('reconcile-music-folders', async (_event, folderPaths: string[], existingTracks: unknown[]) => {
  const MEDIA_EXTS = new Set([
    'mp3','wav','aac','ogg','flac','m4a','wma','opus','aiff',
    'mp4','mov','avi','mkv','wmv','flv','webm',
  ])
  type ExistingTrack = { filePath: string; filename: string; md5?: string }
  const tracks = existingTracks as ExistingTrack[]
  const knownPaths = new Set(tracks.map(t => t.filePath))
  const foundPaths = new Set<string>()

  function scanDir(dir: string) {
    try {
      const entries = readdirSync(dir, { withFileTypes: true })
      for (const entry of entries) {
        if (entry.isDirectory()) {
          scanDir(join(dir, entry.name))
        } else if (entry.isFile()) {
          const ext = entry.name.split('.').pop()?.toLowerCase() ?? ''
          if (MEDIA_EXTS.has(ext)) foundPaths.add(join(dir, entry.name))
        }
      }
    } catch { /* ignore */ }
  }

  for (const fp of folderPaths) {
    if (fp && existsSync(fp)) scanDir(fp)
  }

  // Candidatos básicos
  const newFileCandidates = [...foundPaths]
    .filter(p => !knownPaths.has(p))
    .map(p => ({ filePath: p, filename: p.split(/[\\/]/).pop() ?? p }))

  const missingCandidatePaths = [...knownPaths].filter(p => !foundPaths.has(p))

  // ── Sub-fase 5B: detecção de renomeados e duplicatas via MD5 ──────────────
  const tracksWithMd5 = tracks.filter(t => t.md5 && missingCandidatePaths.includes(t.filePath))
  const renamed: Array<{ oldPath: string; newPath: string; newFilename: string; md5: string }> = []
  const duplicates: Array<{ tracks: string[] }> = []

  if (newFileCandidates.length > 0) {
    // Limita a 300 arquivos para evitar lentidão excessiva
    const filesToHash = newFileCandidates.slice(0, 300)
    const newFileMd5Map = new Map<string, string>() // path → md5

    await Promise.all(
      filesToHash.map(async (f) => {
        const md5 = await computeStreamMd5(f.filePath)
        if (md5) newFileMd5Map.set(f.filePath, md5)
      })
    )

    // Detecta renomeados: track ausente cujo md5 aparece em arquivo novo
    if (tracksWithMd5.length > 0) {
      const md5ToMissing = new Map(tracksWithMd5.map(t => [t.md5!, t]))
      for (const [newPath, md5] of newFileMd5Map) {
        if (md5ToMissing.has(md5)) {
          const oldTrack = md5ToMissing.get(md5)!
          renamed.push({
            oldPath: oldTrack.filePath,
            newPath,
            newFilename: newPath.split(/[\\/]/).pop() ?? newPath,
            md5,
          })
        }
      }
    }

    // Detecta duplicatas: md5 idêntico em 2+ arquivos novos (não cadastrados)
    const md5Groups = new Map<string, string[]>()
    for (const [p, md5] of newFileMd5Map) {
      const group = md5Groups.get(md5)
      if (group) group.push(p)
      else md5Groups.set(md5, [p])
    }
    for (const [, paths] of md5Groups) {
      if (paths.length > 1) duplicates.push({ tracks: paths })
    }

    // Duplicatas entre arquivos novos e existentes (mesmo md5 já na biblioteca)
    const knownMd5s = new Map<string, string>() // md5 → filePath existente
    for (const t of tracks) {
      if (t.md5 && foundPaths.has(t.filePath)) knownMd5s.set(t.md5, t.filePath)
    }
    for (const [newPath, md5] of newFileMd5Map) {
      if (knownMd5s.has(md5)) {
        duplicates.push({ tracks: [newPath, knownMd5s.get(md5)!] })
      }
    }
  }

  // Excluir renomeados dos conjuntos de novos e ausentes
  const renamedNewPaths  = new Set(renamed.map(r => r.newPath))
  const renamedOldPaths  = new Set(renamed.map(r => r.oldPath))
  const duplicateNewPaths = new Set(duplicates.flatMap(d => d.tracks).filter(p => !knownPaths.has(p)))

  return {
    new:      newFileCandidates.filter(f => !renamedNewPaths.has(f.filePath) && !duplicateNewPaths.has(f.filePath)),
    missing:  missingCandidatePaths.filter(p => !renamedOldPaths.has(p)),
    renamed,
    duplicates,
  }
})

// vMix HTTP request
ipcMain.handle('vmix-request', async (_event, params: Record<string, string>, meta?: unknown) => {
  const startedAt = Date.now()
  const commandMeta = sanitizeVmixCommandMeta(meta)
  const result = await makeVmixRequest(params)
  if (params.Function) {
    const log: VmixCommandLog = {
      id: randomUUID(),
      at: new Date().toISOString(),
      source: commandMeta.source ?? 'vmix-request',
      functionName: params.Function,
      params,
      success: result.success,
      latencyMs: Date.now() - startedAt,
      ...(commandMeta.category ? { category: commandMeta.category } : {}),
      ...(commandMeta.risk ? { risk: commandMeta.risk } : {}),
      ...(commandMeta.itemId ? { itemId: commandMeta.itemId } : {}),
      ...(commandMeta.itemTitle ? { itemTitle: commandMeta.itemTitle } : {}),
      ...(commandMeta.scheduleDate ? { scheduleDate: commandMeta.scheduleDate } : {}),
      ...(commandMeta.scheduledTime ? { scheduledTime: commandMeta.scheduledTime } : {}),
      ...(commandMeta.queue ? { queue: commandMeta.queue } : {}),
      ...(commandMeta.attempt ? { attempt: commandMeta.attempt } : {}),
      ...(result.data ? { response: result.data.slice(0, 500) } : {}),
      ...(result.error ? { error: result.error } : {}),
    }
    try { appendVmixCommandLog(log) } catch { /* non-critical */ }
    mainWindow?.webContents.send('vmix-command-log', log)
  }
  return result
})

// Start vMix polling
ipcMain.handle('vmix-start-polling', (_event, host: string, port: number) => {
  startVmixPolling(host, port, (status) => {
    mainWindow?.webContents.send('vmix-status', status)
  })
  return true
})

// Stop vMix polling
ipcMain.handle('vmix-stop-polling', () => {
  stopVmixPolling()
  return true
})

// Start vMix fast polling (500ms — used during active playback for progress tracking)
ipcMain.handle('vmix-start-fast-polling', (_event, host: string, port: number) => {
  startVmixFastPolling(host, port, (status) => {
    mainWindow?.webContents.send('vmix-fast-status', status)
  })
  return true
})

// Stop vMix fast polling
ipcMain.handle('vmix-stop-fast-polling', () => {
  stopVmixFastPolling()
  return true
})

// Register global trigger shortcut (Disparo)
// Gamepad e MIDI são gerenciados no renderer — apenas teclas de teclado usam globalShortcut
ipcMain.handle('register-trigger', (_event, key: string) => {
  if (registeredTriggerKey) {
    try { globalShortcut.unregister(registeredTriggerKey) } catch { /* ignore invalid shortcut unregister */ }
    registeredTriggerKey = null
  }
  // Gamepad e MIDI são tratados no renderer via polling/Web MIDI API
  if (key.startsWith('GAMEPAD:') || key.startsWith('MIDI:')) return true
  try {
    const success = globalShortcut.register(key, () => {
      mainWindow?.webContents.send('trigger-fired')
    })
    registeredTriggerKey = success ? key : null
    return success
  } catch {
    registeredTriggerKey = null
    return false
  }
})

// Unregister global trigger shortcut
ipcMain.handle('unregister-trigger', () => {
  if (registeredTriggerKey) {
    try { globalShortcut.unregister(registeredTriggerKey) } catch { /* ignore invalid shortcut unregister */ }
    registeredTriggerKey = null
  }
})

// ── Banco de Mídia — scanner de vídeos ───────────────────────────────────────

ipcMain.handle('scan-video-folder', (_event, folderPath: string, includeSubfolders: boolean) => {
  const VIDEO_EXTS = new Set(['mp4', 'mov', 'avi', 'mkv', 'wmv', 'mxf', 'flv', 'webm', 'ts', 'm2ts'])
  const results: Array<{ filePath: string; filename: string }> = []

  function scanDir(dir: string) {
    try {
      const entries = readdirSync(dir, { withFileTypes: true })
      for (const entry of entries) {
        const fullPath = join(dir, entry.name)
        if (entry.isDirectory() && includeSubfolders) {
          scanDir(fullPath)
        } else if (entry.isFile()) {
          const ext = entry.name.split('.').pop()?.toLowerCase() ?? ''
          if (VIDEO_EXTS.has(ext)) {
            results.push({ filePath: fullPath, filename: entry.name })
          }
        }
      }
    } catch { /* ignore unreadable dirs */ }
  }

  if (existsSync(folderPath)) scanDir(folderPath)
  return results
})

// ── Data Sources IPC handlers ─────────────────────────────────────────────────

ipcMain.handle('datasources-update', (_event, snapshot: unknown) => {
  dataSourcesSnapshot = snapshot as Record<string, unknown>
})

ipcMain.handle('datasources-start', (_event, port: number) => {
  if (dataSourcesServer) return { success: true, port }
  return new Promise<{ success: boolean; port?: number; error?: string }>((resolve) => {
    const server = createServer((req, res) => {
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.setHeader('Access-Control-Allow-Origin', '*')
      const url = req.url ?? '/'
      let body: unknown
      if (url.startsWith('/vtmaster/now-next')) {
        body = { nowPlaying: dataSourcesSnapshot.nowPlaying ?? null, nextItem: dataSourcesSnapshot.nextItem ?? null }
      } else if (url.startsWith('/vtmaster/schedule')) {
        body = { date: localDateYmd(), schedule: dataSourcesSnapshot.schedule ?? [] }
      } else if (url.startsWith('/vtmaster/log-today')) {
        body = { date: localDateYmd(), log: dataSourcesSnapshot.log ?? [] }
      } else {
        body = { status: 'VTMaster Data Sources', endpoints: ['/vtmaster/now-next', '/vtmaster/schedule', '/vtmaster/log-today'] }
      }
      res.writeHead(200)
      res.end(JSON.stringify(body, null, 2))
    })
    server.once('error', (err: Error) => {
      dataSourcesServer = null
      resolve({ success: false, error: err.message })
    })
    server.listen(port, '127.0.0.1', () => {
      dataSourcesServer = server
      resolve({ success: true, port })
    })
  })
})

ipcMain.handle('datasources-stop', () => {
  if (dataSourcesServer) {
    dataSourcesServer.close()
    dataSourcesServer = null
  }
  return { success: true }
})

ipcMain.handle('datasources-status', () => {
  return { running: dataSourcesServer !== null }
})
