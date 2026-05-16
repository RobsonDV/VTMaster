import {
  Database,
  Download,
  FilePlus,
  FolderOpen,
  Globe,
  MonitorPlay,
  Moon,
  Plus,
  Radio,
  Save,
  Settings,
  Sun,
  Trash2,
  Wifi,
  WifiOff,
  Zap,
} from 'lucide-react'
import { useApp } from '../../store/AppContext'
import type { AppSettings } from '../../types'
import Button from '../ui/Button'
import vtmasterLogo from '../../assets/Logo_VTMasterHorizontal.png'
import './Toolbar.css'

interface ToolbarProps {
  onAddItem: () => void
  onAddAdBreak: () => void
  onSettings: () => void
  onBrowseVmixInputs: () => void
  onToggleMediaBank: () => void
  mediaBankOpen?: boolean
}

export default function Toolbar({ onAddItem, onAddAdBreak, onSettings, onBrowseVmixInputs, onToggleMediaBank, mediaBankOpen }: ToolbarProps) {
  const { state, dispatch, t, saveToStorage } = useApp()
  const { settings, vmixStatus, activePanel } = state

  const isPlaylistActive = activePanel === 'playlist'
  const isScheduleActive = activePanel === 'programacao'

  const toggleDisparo = () => {
    const next: AppSettings = { ...settings, triggerEnabled: !settings.triggerEnabled }
    dispatch({ type: 'SET_SETTINGS', payload: next })
    saveToStorage('settings', next)
  }

  const toggleAutoplayComerciais = () => {
    const next: AppSettings = { ...settings, autoplayComerciais: !settings.autoplayComerciais }
    dispatch({ type: 'SET_SETTINGS', payload: next })
    saveToStorage('settings', next)
  }

  const toggleTheme = () => {
    const next: AppSettings = {
      ...settings,
      theme: settings.theme === 'dark' ? 'light' : 'dark',
    }
    dispatch({ type: 'SET_SETTINGS', payload: next })
    saveToStorage('settings', next)
  }

  const toggleLanguage = () => {
    const next: AppSettings = {
      ...settings,
      language: settings.language === 'pt' ? 'en' : 'pt',
    }
    dispatch({ type: 'SET_SETTINGS', payload: next })
    saveToStorage('settings', next)
  }

  const handleVmixToggle = () => {
    if (!window.spotmaster) return
    if (vmixStatus.connected) {
      window.spotmaster.vmixStopPolling()
      dispatch({ type: 'SET_VMIX_STATUS', payload: { connected: false } })
    } else {
      window.spotmaster.vmixStartPolling(settings.vmixHost, settings.vmixPort)
    }
  }

  const handleExport = async () => {
    if (!window.spotmaster) return
    await window.spotmaster.exportPlaylist(state.playlist)
  }

  const handleImport = async () => {
    if (!window.spotmaster) return
    const data = await window.spotmaster.importPlaylist()
    if (Array.isArray(data)) {
      dispatch({ type: 'SET_PLAYLIST', payload: data })
    }
  }

  const handleNew = () => {
    if (state.playlist.length === 0) return
    const msg = t.common.confirmDelete + ' (playlist)'
    if (window.confirm(msg)) {
      dispatch({ type: 'CLEAR_PLAYLIST' })
    }
  }

  return (
    <header className="toolbar">
      <div className="toolbar-row-top">
        <div className="toolbar-brand">
          <img src={vtmasterLogo} alt="VTMaster" className="brand-logo" />
        </div>

        <div className="toolbar-spacer" />

        <Button
          className="toolbar-btn"
          variant={vmixStatus.connected ? 'success' : 'warning'}
          onClick={handleVmixToggle}
          title={vmixStatus.connected ? t.toolbar.disconnect : t.toolbar.connect}
          icon={vmixStatus.connected ? <Wifi size={15} /> : <WifiOff size={15} />}
        >
          {vmixStatus.connected ? t.toolbar.disconnect : t.toolbar.connect}
        </Button>

        <div className="toolbar-separator" />

        <Button className="toolbar-icon-btn" variant="ghost" iconOnly onClick={toggleTheme} title={t.toolbar.theme} icon={settings.theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />} />

        <Button className="toolbar-icon-btn toolbar-lang-btn" variant="ghost" onClick={toggleLanguage} title={t.toolbar.language} icon={<Globe size={16} />}>
          <span className="lang-label">{settings.language.toUpperCase()}</span>
        </Button>

        <Button
          className="toolbar-icon-btn"
          variant={mediaBankOpen ? 'primary' : 'ghost'}
          iconOnly
          onClick={onToggleMediaBank}
          title="Banco de Mídia"
          icon={<Database size={16} />}
        />
        <Button className="toolbar-icon-btn" variant="ghost" iconOnly onClick={onSettings} title={t.settings.title} icon={<Settings size={16} />} />
      </div>

      {(isPlaylistActive || isScheduleActive) && (
        <div className="toolbar-row-bottom">
          {isPlaylistActive && (
            <div className="toolbar-actions">
              <Button className="toolbar-btn" onClick={handleNew} title={t.toolbar.newPlaylist} icon={<FilePlus size={15} />}>
                {t.toolbar.newPlaylist}
              </Button>

              <Button className="toolbar-btn" onClick={handleImport} title={t.toolbar.importPlaylist} icon={<FolderOpen size={15} />}>
                {t.toolbar.importPlaylist}
              </Button>

              <Button className="toolbar-btn" onClick={handleExport} title={t.toolbar.exportPlaylist} icon={<Download size={15} />}>
                {t.toolbar.exportPlaylist}
              </Button>

              <div className="toolbar-separator" />

              <Button className="toolbar-btn" variant="primary" onClick={onAddItem} title={t.toolbar.addItem} icon={<Plus size={15} />}>
                {t.toolbar.addItem}
              </Button>

              <Button
                className="toolbar-btn"
                onClick={onBrowseVmixInputs}
                title={t.toolbar.browseVmixInputs}
                disabled={!vmixStatus.connected}
                icon={<MonitorPlay size={15} />}
              >
                {t.toolbar.browseVmixInputs}
              </Button>

              <Button className="toolbar-btn" onClick={onAddAdBreak} title={t.toolbar.addAdBreak} icon={<Save size={15} />}>
                {t.toolbar.addAdBreak}
              </Button>

              <Button
                className="toolbar-btn"
                variant="danger"
                onClick={() => {
                  if (window.confirm(t.common.confirmDelete + ' (playlist)')) {
                    dispatch({ type: 'CLEAR_PLAYLIST' })
                  }
                }}
                title={t.toolbar.clearAll}
                disabled={state.playlist.length === 0}
                icon={<Trash2 size={15} />}
                iconOnly
              />
            </div>
          )}

          {isScheduleActive && (
            <div className="toolbar-actions">
              <Button
                className="toolbar-btn"
                variant={settings.triggerEnabled ? 'success' : 'secondary'}
                onClick={toggleDisparo}
                title={settings.triggerEnabled ? t.toolbar.disparoOn : t.toolbar.disparoOff}
                disabled={!settings.triggerKey}
                icon={<Zap size={14} />}
              >
                {settings.triggerEnabled ? t.toolbar.disparoOn : t.toolbar.disparoOff}
              </Button>

              <Button
                className="toolbar-btn"
                variant={settings.autoplayComerciais ? 'success' : 'secondary'}
                onClick={toggleAutoplayComerciais}
                title={settings.autoplayComerciais ? t.toolbar.autoplayComerciaisOn : t.toolbar.autoplayComerciaisOff}
                icon={<Radio size={14} />}
              >
                {settings.autoplayComerciais ? t.toolbar.autoplayComerciaisOn : t.toolbar.autoplayComerciaisOff}
              </Button>
            </div>
          )}
        </div>
      )}
    </header>
  )
}
