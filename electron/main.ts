import { app, BrowserWindow, ipcMain, dialog, shell, protocol, net, globalShortcut } from 'electron'
import { fileURLToPath, pathToFileURL } from 'url'
import { dirname, join } from 'path'
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, openSync, readSync, closeSync, statSync } from 'fs'
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

type UpdateStatus = {
  status: 'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error'
  version?: string
  percent?: number
  message?: string
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

function saveData(key: string, data: unknown): void {
  const filePath = join(getUserDataPath(), `${key}.json`)
  writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8')
}

function loadData(key: string): unknown {
  const filePath = join(getUserDataPath(), `${key}.json`)
  if (existsSync(filePath)) {
    try {
      return JSON.parse(readFileSync(filePath, 'utf-8'))
    } catch {
      return null
    }
  }
  return null
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
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    title: 'VTMaster',
    backgroundColor: '#0f0f1a',
    webPreferences: {
      preload: join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
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

ipcMain.handle('read-media-duration', (_event, filePath: string) => {
  return readNativeMediaDuration(filePath)
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
    defaultPath: `playlist-${new Date().toISOString().slice(0, 10)}.json`,
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
  const date = new Date().toISOString().slice(0, 10)
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

// vMix HTTP request
ipcMain.handle('vmix-request', async (_event, params: Record<string, string>) => {
  return makeVmixRequest(params)
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
