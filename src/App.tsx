import { useState, useEffect } from 'react'
import { Settings } from 'lucide-react'
import { useApp } from './store/AppContext'
import Toolbar from './components/Toolbar/Toolbar'
import StatusBar from './components/StatusBar/StatusBar'
import PlaylistTable from './components/Playlist/PlaylistTable'
import ItemModal from './components/Playlist/ItemModal'
import VmixInputPanel from './components/Playlist/VmixInputPanel'
import AdBreaksPanel from './components/AdBreaks/AdBreaksPanel'
import AdBreakSelectModal from './components/AdBreaks/AdBreakSelectModal'
import ClientsPanel from './components/Clients/ClientsPanel'
import LogPanel from './components/Log/LogPanel'
import ReportsPanel from './components/Reports/ReportsPanel'
import SettingsModal from './components/Settings/SettingsModal'
import type { PlaylistItem } from './types'
import './App.css'
import vtmasterLogo from './assets/Logo_VTMasterHorizontal.png'

type Panel = 'playlist' | 'adbreaks' | 'clients' | 'log' | 'reports'

export default function App() {
  const { state, dispatch, t } = useApp()
  const [activePanel, setActivePanel] = useState<Panel>('playlist')
  const [showItemModal, setShowItemModal] = useState(false)
  const [editingItem, setEditingItem] = useState<PlaylistItem | null>(null)
  const [showAdBreakSelect, setShowAdBreakSelect] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showVmixPanel, setShowVmixPanel] = useState(false)
  const [appVersion, setAppVersion] = useState('')

  useEffect(() => {
    window.spotmaster?.getVersion().then(v => setAppVersion(v)).catch(() => {})
  }, [])

  const navItems = [
    { id: 'playlist' as Panel,  label: t.nav.playlist },
    { id: 'adbreaks' as Panel,  label: t.nav.adBreaks },
    { id: 'clients' as Panel,   label: t.nav.clients },
    { id: 'log' as Panel,       label: t.nav.log },
    { id: 'reports' as Panel,   label: t.nav.reports },
  ]

  const handleSetPanel = (panel: Panel) => {
    setActivePanel(panel)
    dispatch({ type: 'SET_ACTIVE_PANEL', payload: panel })
  }

  if (state.isLoading) {
    return (
      <div className="loading-screen">
        <img src={vtmasterLogo} alt="VTMaster" />
        <span>carregando...</span>
      </div>
    )
  }

  return (
    <div className="app-layout">
      <Toolbar
        onAddItem={() => { setEditingItem(null); setShowItemModal(true) }}
        onAddAdBreak={() => setShowAdBreakSelect(true)}
        onSettings={() => setShowSettings(true)}
        onBrowseVmixInputs={() => setShowVmixPanel(v => !v)}
      />
      <div className="app-body">
        <nav className="sidebar">
          {navItems.map(({ id, label }) => (
            <button key={id} className={`nav-item ${activePanel === id ? 'active' : ''}`} onClick={() => handleSetPanel(id)}>
              <span>{label}</span>
            </button>
          ))}
          <div style={{ flex: 1 }} />
          <button className="nav-item" onClick={() => setShowSettings(true)}>
            <Settings size={18} />
            <span>{t.settings.title}</span>
          </button>
          <div className="dev-credit">
            <strong>VTMaster</strong>
            {appVersion && <span className="dev-version">v{appVersion}</span>}
            Desenvolvido por<br />RobsonCostaDV
          </div>
        </nav>
        <main className="content-area">
          {activePanel === 'playlist' && (
            <div className="playlist-split">
              <PlaylistTable onEditItem={(item) => { setEditingItem(item); setShowItemModal(true) }} />
              {showVmixPanel && <VmixInputPanel onClose={() => setShowVmixPanel(false)} />}
            </div>
          )}
          {activePanel === 'adbreaks' && <AdBreaksPanel />}
          {activePanel === 'clients' && <ClientsPanel />}
          {activePanel === 'log' && <LogPanel />}
          {activePanel === 'reports' && <ReportsPanel />}
        </main>
      </div>
      <StatusBar />
      {showItemModal && <ItemModal item={editingItem} onClose={() => { setShowItemModal(false); setEditingItem(null) }} />}
      {showAdBreakSelect && <AdBreakSelectModal onClose={() => setShowAdBreakSelect(false)} />}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </div>
  )
}