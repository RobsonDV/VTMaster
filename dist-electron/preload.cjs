"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
// ─────────────────────────────────────────────────────────────────────────────
// Expose SpotMaster API to the renderer process (React app)
// All communication between renderer and main process goes through this bridge.
// ─────────────────────────────────────────────────────────────────────────────
electron_1.contextBridge.exposeInMainWorld('spotmaster', {
    // Persistent storage
    saveData: (key, data) => electron_1.ipcRenderer.invoke('save-data', key, data),
    loadData: (key) => electron_1.ipcRenderer.invoke('load-data', key),
    // App info
    getVersion: () => electron_1.ipcRenderer.invoke('get-version'),
    // File operations
    exportPlaylist: (data) => electron_1.ipcRenderer.invoke('export-playlist', data),
    importPlaylist: () => electron_1.ipcRenderer.invoke('import-playlist'),
    // PDF export
    exportPDF: (filePath, buffer) => electron_1.ipcRenderer.invoke('export-pdf', filePath, buffer),
    // Browse for video file
    browseVideoFile: () => electron_1.ipcRenderer.invoke('browse-video-file'),
    // vMix integration
    vmixRequest: (params) => electron_1.ipcRenderer.invoke('vmix-request', params),
    vmixStartPolling: (host, port) => electron_1.ipcRenderer.invoke('vmix-start-polling', host, port),
    vmixStopPolling: () => electron_1.ipcRenderer.invoke('vmix-stop-polling'),
    // vMix fast polling (500ms — used during playback for real-time progress)
    vmixStartFastPolling: (host, port) => electron_1.ipcRenderer.invoke('vmix-start-fast-polling', host, port),
    vmixStopFastPolling: () => electron_1.ipcRenderer.invoke('vmix-stop-fast-polling'),
    // vMix status listeners (push from main process)
    onVmixStatus: (callback) => {
        electron_1.ipcRenderer.on('vmix-status', (_event, status) => callback(status));
    },
    removeVmixStatusListener: () => {
        electron_1.ipcRenderer.removeAllListeners('vmix-status');
    },
    // vMix fast status listeners (from fast polling)
    onVmixFastStatus: (callback) => {
        electron_1.ipcRenderer.on('vmix-fast-status', (_event, status) => callback(status));
    },
    removeVmixFastStatusListener: () => {
        electron_1.ipcRenderer.removeAllListeners('vmix-fast-status');
    },
    // Open external URLs
    openExternal: (url) => electron_1.ipcRenderer.invoke('open-external', url),
});
