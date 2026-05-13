import { app, BrowserWindow, ipcMain, dialog, shell, protocol, net, globalShortcut } from 'electron'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs'
import { makeVmixRequest, startVmixPolling, stopVmixPolling, startVmixFastPolling, stopVmixFastPolling } from './vmix.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const isDev = process.env.NODE_ENV === 'development'

// Register custom scheme BEFORE app ready — allows renderer to load local media
// files via local-media:///path without CORS/CSP restrictions
protocol.registerSchemesAsPrivileged([
  { scheme: 'local-media', privileges: { secure: true, stream: true, supportFetchAPI: true, corsEnabled: true } },
])

let mainWindow: BrowserWindow | null = null
let registeredTriggerKey: string | null = null

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
  // Serve local files through custom protocol so renderer can read video/audio
  // metadata even when the page is served from http://localhost:5173 (dev mode)
  protocol.handle('local-media', (request) => {
    const path = request.url.slice('local-media:///'.length)
    return net.fetch(`file:///${path}`)
  })

  createWindow()
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

// Get app version
ipcMain.handle('get-version', () => {
  return app.getVersion()
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
    try { globalShortcut.unregister(registeredTriggerKey) } catch {}
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
    try { globalShortcut.unregister(registeredTriggerKey) } catch {}
    registeredTriggerKey = null
  }
})
