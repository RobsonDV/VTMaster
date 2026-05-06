import { contextBridge, ipcRenderer } from 'electron';
// ─────────────────────────────────────────────────────────────────────────────
// Expose SpotMaster API to the renderer process (React app)
// All communication between renderer and main process goes through this bridge.
// ─────────────────────────────────────────────────────────────────────────────
contextBridge.exposeInMainWorld('spotmaster', {
    // Persistent storage
    saveData: (key, data) => ipcRenderer.invoke('save-data', key, data),
    loadData: (key) => ipcRenderer.invoke('load-data', key),
    // App info
    getVersion: () => ipcRenderer.invoke('get-version'),
    // File operations
    exportPlaylist: (data) => ipcRenderer.invoke('export-playlist', data),
    importPlaylist: () => ipcRenderer.invoke('import-playlist'),
    // PDF export
    exportPDF: (filePath, buffer) => ipcRenderer.invoke('export-pdf', filePath, buffer),
    // vMix integration
    vmixRequest: (params) => ipcRenderer.invoke('vmix-request', params),
    vmixStartPolling: (host, port) => ipcRenderer.invoke('vmix-start-polling', host, port),
    vmixStopPolling: () => ipcRenderer.invoke('vmix-stop-polling'),
    // vMix status listener (push from main process)
    onVmixStatus: (callback) => {
        ipcRenderer.on('vmix-status', (_event, status) => callback(status));
    },
    removeVmixStatusListener: () => {
        ipcRenderer.removeAllListeners('vmix-status');
    },
    // Open external URLs
    openExternal: (url) => ipcRenderer.invoke('open-external', url),
});
