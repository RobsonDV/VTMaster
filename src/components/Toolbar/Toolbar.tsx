import {
  FilePlus,
  FolderOpen,
  Download,
  Save,
  Plus,
  Trash2,
  Sun,
  Moon,
  Globe,
  Wifi,
  WifiOff,
  LayoutList,
  MonitorPlay,
} from 'lucide-react'
import { useApp } from '../../store/AppContext'
import type { AppSettings } from '../../types'
import './Toolbar.css'

interface ToolbarProps {
  onAddItem: () => void
  onAddAdBreak: () => void
  onSettings: () => void
  onBrowseVmixInputs: () => void
}

export default function Toolbar({ onAddItem, onAddAdBreak, onSettings, onBrowseVmixInputs }: ToolbarProps) {
  const { state, dispatch, t, saveToStorage } = useApp()
  const { settings, vmixStatus, activePanel } = state

  const isPlaylistActive = activePanel === 'playlist'

  // ── Theme toggle ──
  const toggleTheme = () => {
    const next: AppSettings = {
      ...settings,
      theme: settings.theme === 'dark' ? 'light' : 'dark',
    }
    dispatch({ type: 'SET_SETTINGS', payload: next })
    saveToStorage('settings', next)
  }

  // ── Language toggle ──
  const toggleLanguage = () => {
    const next: AppSettings = {
      ...settings,
      language: settings.language === 'pt' ? 'en' : 'pt',
    }
    dispatch({ type: 'SET_SETTINGS', payload: next })
    saveToStorage('settings', next)
  }

  // ── vMix connect/disconnect ──
  const handleVmixToggle = () => {
    if (!window.spotmaster) return
    if (vmixStatus.connected) {
      window.spotmaster.vmixStopPolling()
      dispatch({ type: 'SET_VMIX_STATUS', payload: { connected: false } })
    } else {
      window.spotmaster.vmixStartPolling(settings.vmixHost, settings.vmixPort)
    }
  }

  // ── Export playlist ──
  const handleExport = async () => {
    if (!window.spotmaster) return
    await window.spotmaster.exportPlaylist(state.playlist)
  }

  // ── Import playlist ──
  const handleImport = async () => {
    if (!window.spotmaster) return
    const data = await window.spotmaster.importPlaylist()
    if (Array.isArray(data)) {
      dispatch({ type: 'SET_PLAYLIST', payload: data })
    }
  }

  // ── New playlist ──
  const handleNew = () => {
    if (state.playlist.length === 0) return
    const msg = t.common.confirmDelete + ' (playlist)'
    if (window.confirm(msg)) {
      dispatch({ type: 'CLEAR_PLAYLIST' })
    }
  }

  return (
    <header className="toolbar">
      {/* Logo */}
      <div className="toolbar-brand">
        <LayoutList size={22} className="brand-icon" />
        <span className="brand-name">SpotMaster</span>
      </div>

      {/* Actions */}
      <div className="toolbar-actions">
        {isPlaylistActive && (
          <>
            <button className="btn-toolbar" onClick={handleNew} title={t.toolbar.newPlaylist}>
              <FilePlus size={16} />
              <span>{t.toolbar.newPlaylist}</span>
            </button>

            <button className="btn-toolbar" onClick={handleImport} title={t.toolbar.importPlaylist}>
              <FolderOpen size={16} />
              <span>{t.toolbar.importPlaylist}</span>
            </button>

            <button className="btn-toolbar" onClick={handleExport} title={t.toolbar.exportPlaylist}>
              <Download size={16} />
              <span>{t.toolbar.exportPlaylist}</span>
            </button>

            <div className="toolbar-separator" />

            <button className="btn-toolbar btn-primary" onClick={onAddItem} title={t.toolbar.addItem}>
              <Plus size={16} />
              <span>{t.toolbar.addItem}</span>
            </button>

            <button
              className="btn-toolbar"
              onClick={onBrowseVmixInputs}
              title={t.toolbar.browseVmixInputs}
              disabled={!vmixStatus.connected}
            >
              <MonitorPlay size={16} />
              <span>{t.toolbar.browseVmixInputs}</span>
            </button>

            <button className="btn-toolbar" onClick={onAddAdBreak} title={t.toolbar.addAdBreak}>
              <Save size={16} />
              <span>{t.toolbar.addAdBreak}</span>
            </button>

            <button
              className="btn-toolbar btn-danger"
              onClick={() => dispatch({ type: 'CLEAR_PLAYLIST' })}
              title={t.toolbar.clearAll}
              disabled={state.playlist.length === 0}
            >
              <Trash2 size={16} />
            </button>

            <div className="toolbar-separator" />
          </>
        )}

        {/* vMix Connection */}
        <button
          className={`btn-toolbar ${vmixStatus.connected ? 'btn-success' : 'btn-warning'}`}
          onClick={handleVmixToggle}
          title={vmixStatus.connected ? t.toolbar.disconnect : t.toolbar.connect}
        >
          {vmixStatus.connected ? <Wifi size={16} /> : <WifiOff size={16} />}
          <span>{vmixStatus.connected ? t.toolbar.disconnect : t.toolbar.connect}</span>
        </button>

        <div className="toolbar-separator" />

        {/* Theme */}
        <button className="btn-icon" onClick={toggleTheme} title={t.toolbar.theme}>
          {settings.theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        {/* Language */}
        <button className="btn-icon" onClick={toggleLanguage} title={t.toolbar.language}>
          <Globe size={18} />
          <span className="lang-label">{settings.language.toUpperCase()}</span>
        </button>

        {/* Settings */}
        <button className="btn-icon" onClick={onSettings} title={t.settings.title}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
        </button>
      </div>
    </header>
  )
}
