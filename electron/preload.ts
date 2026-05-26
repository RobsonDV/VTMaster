import { contextBridge, ipcRenderer } from 'electron'

// ─────────────────────────────────────────────────────────────────────────────
// Expose SpotMaster API to the renderer process (React app)
// All communication between renderer and main process goes through this bridge.
// ─────────────────────────────────────────────────────────────────────────────
contextBridge.exposeInMainWorld('spotmaster', {
  // Persistent storage
  saveData: (key: string, data: unknown) =>
    ipcRenderer.invoke('save-data', key, data),
  loadData: (key: string) =>
    ipcRenderer.invoke('load-data', key),
  createBackup: (reason?: string) =>
    ipcRenderer.invoke('create-backup', reason),
  fileExists: (filePaths: string[]) =>
    ipcRenderer.invoke('file-exists', filePaths),
  readMediaDuration: (filePath: string) =>
    ipcRenderer.invoke('read-media-duration', filePath),

  // App info
  getVersion: () =>
    ipcRenderer.invoke('get-version'),
  checkForUpdates: () =>
    ipcRenderer.invoke('check-for-updates'),
  installUpdate: () =>
    ipcRenderer.invoke('install-update'),
  onUpdateStatus: (callback: (status: unknown) => void) => {
    ipcRenderer.on('update-status', (_event, status) => callback(status))
  },
  removeUpdateStatusListener: () => {
    ipcRenderer.removeAllListeners('update-status')
  },

  // File operations
  exportTextFile: (defaultName: string, content: string) =>
    ipcRenderer.invoke('export-text-file', defaultName, content),
  exportPlaylist: (data: unknown) =>
    ipcRenderer.invoke('export-playlist', data),
  importPlaylist: () =>
    ipcRenderer.invoke('import-playlist'),
  exportGrid: (data: unknown) =>
    ipcRenderer.invoke('export-grid', data),
  importGrid: () =>
    ipcRenderer.invoke('import-grid'),

  // PDF export
  exportPDF: (filePath: string, buffer: number[]) =>
    ipcRenderer.invoke('export-pdf', filePath, buffer),

  // Browse for media file
  browseVideoFile: () =>
    ipcRenderer.invoke('browse-video-file'),

  // vMix integration
  vmixRequest: (params: Record<string, string>, meta?: unknown) =>
    ipcRenderer.invoke('vmix-request', params, meta),
  vmixStartPolling: (host: string, port: number) =>
    ipcRenderer.invoke('vmix-start-polling', host, port),
  vmixStopPolling: () =>
    ipcRenderer.invoke('vmix-stop-polling'),

  // vMix status listener (push from main process)
  onVmixStatus: (callback: (status: unknown) => void) => {
    ipcRenderer.on('vmix-status', (_event, status) => callback(status))
  },
  removeVmixStatusListener: () => {
    ipcRenderer.removeAllListeners('vmix-status')
  },

  // Fast polling (500ms) — used during active playback for progress tracking
  vmixStartFastPolling: (host: string, port: number) =>
    ipcRenderer.invoke('vmix-start-fast-polling', host, port),
  vmixStopFastPolling: () =>
    ipcRenderer.invoke('vmix-stop-fast-polling'),
  onVmixFastStatus: (callback: (status: unknown) => void) => {
    ipcRenderer.on('vmix-fast-status', (_event, status) => callback(status))
  },
  removeVmixFastStatusListener: () => {
    ipcRenderer.removeAllListeners('vmix-fast-status')
  },
  onVmixCommandLog: (callback: (log: unknown) => void) => {
    ipcRenderer.on('vmix-command-log', (_event, log) => callback(log))
  },
  removeVmixCommandLogListener: () => {
    ipcRenderer.removeAllListeners('vmix-command-log')
  },

  // Browse for folder
  browseFolder: () =>
    ipcRenderer.invoke('browse-folder'),

  // Scan music folder for media files
  scanMusicFolder: (folderPath: string, includeSubfolders: boolean) =>
    ipcRenderer.invoke('scan-music-folder', folderPath, includeSubfolders),

  // Musical Pro — Fase 5
  readTrackMetadata: (filePath: string) =>
    ipcRenderer.invoke('read-track-metadata', filePath),
  hashFileMd5: (filePath: string) =>
    ipcRenderer.invoke('hash-file-md5', filePath),
  reconcileMusicFolders: (folderPaths: string[], existingTracks: unknown[]) =>
    ipcRenderer.invoke('reconcile-music-folders', folderPaths, existingTracks),

  // Open external URLs
  openExternal: (url: string) =>
    ipcRenderer.invoke('open-external', url),

  // Banco de Mídia — scanner de vídeos
  scanVideoFolder: (folderPath: string, includeSubfolders: boolean) =>
    ipcRenderer.invoke('scan-video-folder', folderPath, includeSubfolders),

  // Data Sources — local HTTP server for vMix integration
  updateDataSources: (snapshot: unknown) =>
    ipcRenderer.invoke('datasources-update', snapshot),
  startDataSourcesServer: (port: number) =>
    ipcRenderer.invoke('datasources-start', port),
  stopDataSourcesServer: () =>
    ipcRenderer.invoke('datasources-stop'),
  getDataSourcesStatus: () =>
    ipcRenderer.invoke('datasources-status'),

  // Disparo — global trigger shortcut (works even when app is minimized)
  registerTrigger: (key: string) =>
    ipcRenderer.invoke('register-trigger', key),
  unregisterTrigger: () =>
    ipcRenderer.invoke('unregister-trigger'),
  onTriggerFired: (callback: () => void) => {
    ipcRenderer.on('trigger-fired', () => callback())
  },
  removeTriggerListener: () => {
    ipcRenderer.removeAllListeners('trigger-fired')
  },

  // Lê duração via music-metadata no processo Node (mais rápido e confiável que HTML5)
  readMediaDurationMM: (filePath: string) =>
    ipcRenderer.invoke('read-media-duration-mm', filePath),

  // Session resume — persiste o item em reprodução para retomar após restart
  savePlaybackSnapshot: (snapshot: unknown) =>
    ipcRenderer.invoke('save-playback-snapshot', snapshot),
  loadPlaybackSnapshot: () =>
    ipcRenderer.invoke('load-playback-snapshot'),
  clearPlaybackSnapshot: () =>
    ipcRenderer.invoke('clear-playback-snapshot'),

  // Maintenance
  getDataSizes: () =>
    ipcRenderer.invoke('get-data-sizes'),
  openDataFolder: () =>
    ipcRenderer.invoke('open-data-folder'),
  pruneBackups: (keepDays?: number) =>
    ipcRenderer.invoke('prune-backups', keepDays),
  factoryReset: () =>
    ipcRenderer.invoke('factory-reset'),
})
