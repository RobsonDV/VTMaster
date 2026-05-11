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
  MonitorPlay,
  Zap,
  Radio,
} from 'lucide-react'
import { useApp } from '../../store/AppContext'
import type { AppSettings } from '../../types'
import vtmasterLogo from '../../assets/Logo_VTMasterHorizontal.png'
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

  // ── Disparo toggle ──
  const toggleDisparo = () => {
    const next: AppSettings = { ...settings, triggerEnabled: !settings.triggerEnabled }
    dispatch({ type: 'SET_SETTINGS', payload: next })
    saveToStorage('settings', next)
  }

  // ── Autoplay Comerciais toggle ──
  const toggleAutoplayComerciais = () => {
    const next: AppSettings = { ...settings, autoplayComerciais: !settings.autoplayComerciais }
    dispatch({ type: 'SET_SETTINGS', payload: next })
    saveToStorage('settings', next)
  }

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

      {/* ── Fileira superior: logo + ações de playlist + vMix ── */}
      <div className="toolbar-row-top">
        <div className="toolbar-brand">
          <img src={vtmasterLogo} alt="VTMaster" className="brand-logo" />
        </div>

        <div className="toolbar-actions">
          {isPlaylistActive && (
            <>
              <button className="btn-toolbar" onClick={handleNew} title={t.toolbar.newPlaylist}>
                <FilePlus size={15} />
                <span>{t.toolbar.newPlaylist}</span>
              </button>

              <button className="btn-toolbar" onClick={handleImport} title={t.toolbar.importPlaylist}>
                <FolderOpen size={15} />
                <span>{t.toolbar.importPlaylist}</span>
              </button>

              <button className="btn-toolbar" onClick={handleExport} title={t.toolbar.exportPlaylist}>
                <Download size={15} />
                <span>{t.toolbar.exportPlaylist}</span>
              </button>

              <div className="toolbar-separator" />

              <button className="btn-toolbar btn-primary" onClick={onAddItem} title={t.toolbar.addItem}>
                <Plus size={15} />
                <span>{t.toolbar.addItem}</span>
              </button>

              <button
                className="btn-toolbar"
                onClick={onBrowseVmixInputs}
                title={t.toolbar.browseVmixInputs}
                disabled={!vmixStatus.connected}
              >
                <MonitorPlay size={15} />
                <span>{t.toolbar.browseVmixInputs}</span>
              </button>

              <button className="btn-toolbar" onClick={onAddAdBreak} title={t.toolbar.addAdBreak}>
                <Save size={15} />
                <span>{t.toolbar.addAdBreak}</span>
              </button>

              <button
                className="btn-toolbar btn-danger"
                onClick={() => dispatch({ type: 'CLEAR_PLAYLIST' })}
                title={t.toolbar.clearAll}
                disabled={state.playlist.length === 0}
              >
                <Trash2 size={15} />
              </button>

              <div className="toolbar-separator" />
            </>
          )}
        </div>

        {/* vMix Connection — sempre visível na fileira superior */}
        <button
          className={`btn-toolbar ${vmixStatus.connected ? 'btn-success' : 'btn-warning'}`}
          onClick={handleVmixToggle}
          title={vmixStatus.connected ? t.toolbar.disconnect : t.toolbar.connect}
        >
          {vmixStatus.connected ? <Wifi size={15} /> : <WifiOff size={15} />}
          <span>{vmixStatus.connected ? t.toolbar.disconnect : t.toolbar.connect}</span>
        </button>
      </div>

      {/* ── Fileira inferior: Disparo + Autoplay Comerciais + utilitários ── */}
      <div className="toolbar-row-bottom">

        {/* Disparo toggle */}
        <button
          className={`btn-toolbar ${settings.triggerEnabled ? 'btn-success' : ''}`}
          onClick={toggleDisparo}
          title={settings.triggerEnabled ? t.toolbar.disparoOn : t.toolbar.disparoOff}
          disabled={!settings.triggerKey}
          style={{ fontSize: '0.74rem' }}
        >
          <Zap size={14} />
          <span>{settings.triggerEnabled ? t.toolbar.disparoOn : t.toolbar.disparoOff}</span>
        </button>

        {/* Autoplay Comerciais toggle */}
        <button
          className={`btn-toolbar ${settings.autoplayComerciais ? 'btn-success' : ''}`}
          onClick={toggleAutoplayComerciais}
          title={settings.autoplayComerciais ? t.toolbar.autoplayComerciaisOn : t.toolbar.autoplayComerciaisOff}
          style={{ fontSize: '0.74rem' }}
        >
          <Radio size={14} />
          <span>{settings.autoplayComerciais ? t.toolbar.autoplayComerciaisOn : t.toolbar.autoplayComerciaisOff}</span>
        </button>

        {/* Utilitários — alinhados à direita */}
        <div className="toolbar-actions-right">
          <div className="toolbar-separator" />

          <button className="btn-icon" onClick={toggleTheme} title={t.toolbar.theme}>
            {settings.theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>

          <button className="btn-icon" onClick={toggleLanguage} title={t.toolbar.language}>
            <Globe size={16} />
            <span className="lang-label">{settings.language.toUpperCase()}</span>
          </button>

          <button className="btn-icon" onClick={onSettings} title={t.settings.title}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
          </button>
        </div>
      </div>

    </header>
  )
}
