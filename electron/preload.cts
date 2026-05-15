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
  exportPlaylist: (data: unknown) =>
    ipcRenderer.invoke('export-playlist', data),
  importPlaylist: () =>
    ipcRenderer.invoke('import-playlist'),

  // PDF export
  exportPDF: (filePath: string, buffer: number[]) =>
    ipcRenderer.invoke('export-pdf', filePath, buffer),

  // Browse for video file
  browseVideoFile: () =>
    ipcRenderer.invoke('browse-video-file'),

  // Browse for a folder
  browseFolder: () =>
    ipcRenderer.invoke('browse-folder'),

  // Scan a folder for media files (AutoProg)
  scanMusicFolder: (folderPath: string, includeSubfolders: boolean) =>
    ipcRenderer.invoke('scan-music-folder', folderPath, includeSubfolders),

  // vMix integration
  vmixRequest: (params: Record<string, string>, meta?: unknown) =>
    ipcRenderer.invoke('vmix-request', params, meta),
  vmixStartPolling: (host: string, port: number) =>
    ipcRenderer.invoke('vmix-start-polling', host, port),
  vmixStopPolling: () =>
    ipcRenderer.invoke('vmix-stop-polling'),

  // vMix fast polling (500ms — used during playback for real-time progress)
  vmixStartFastPolling: (host: string, port: number) =>
    ipcRenderer.invoke('vmix-start-fast-polling', host, port),
  vmixStopFastPolling: () =>
    ipcRenderer.invoke('vmix-stop-fast-polling'),

  // vMix status listeners (push from main process)
  onVmixStatus: (callback: (status: unknown) => void) => {
    ipcRenderer.on('vmix-status', (_event, status) => callback(status))
  },
  removeVmixStatusListener: () => {
    ipcRenderer.removeAllListeners('vmix-status')
  },

  // vMix fast status listeners (from fast polling)
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

  // Open external URLs
  openExternal: (url: string) =>
    ipcRenderer.invoke('open-external', url),
})
