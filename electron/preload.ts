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

  // App info
  getVersion: () =>
    ipcRenderer.invoke('get-version'),

  // File operations
  exportPlaylist: (data: unknown) =>
    ipcRenderer.invoke('export-playlist', data),
  importPlaylist: () =>
    ipcRenderer.invoke('import-playlist'),

  // PDF export
  exportPDF: (filePath: string, buffer: number[]) =>
    ipcRenderer.invoke('export-pdf', filePath, buffer),

  // Browse for media file
  browseVideoFile: () =>
    ipcRenderer.invoke('browse-video-file'),

  // vMix integration
  vmixRequest: (params: Record<string, string>) =>
    ipcRenderer.invoke('vmix-request', params),
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

  // Open external URLs
  openExternal: (url: string) =>
    ipcRenderer.invoke('open-external', url),

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
})
