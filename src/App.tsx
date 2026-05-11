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
import GradePanel from './components/Grade/GradePanel'
import DaySchedulePanel from './components/DaySchedule/DaySchedulePanel'
import type { PlaylistItem } from './types'
import './App.css'
import vtmasterLogo from './assets/Logo_VTMasterHorizontal.png'

type Panel = 'playlist' | 'grade' | 'programacao' | 'adbreaks' | 'clients' | 'log' | 'reports'

// Mini-modal para editar apenas o horário agendado de um item
function ScheduleEditModal({ item, onClose }: { item: PlaylistItem; onClose: () => void }) {
  const { dispatch } = useApp()
  const [time, setTime] = useState(item.scheduledTime ?? '')

  const handleSave = () => {
    dispatch({ type: 'UPDATE_PLAYLIST_ITEM', payload: { ...item, scheduledTime: time || undefined } })
    onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={onClose}>
      <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 10, padding: 20, minWidth: 280, boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }} onClick={e => e.stopPropagation()}>
        <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 12, color: 'var(--text-primary)' }}>
          🕐 Editar Horário
        </div>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 8 }}>{item.title}</div>
        <input
          type="time"
          step="1"
          value={time}
          onChange={e => setTime(e.target.value)}
          autoFocus
          style={{ width: '100%', padding: '8px 10px', background: 'var(--bg-primary)', border: '1px solid var(--accent)', borderRadius: 6, color: 'var(--text-primary)', fontSize: '1rem' }}
        />
        <div style={{ display: 'flex', gap: 8, marginTop: 14, justifyContent: 'flex-end' }}>
          {time && (
            <button onClick={() => { setTime('') }} style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.8rem' }}>
              Limpar
            </button>
          )}
          <button onClick={onClose} style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.8rem' }}>
            Cancelar
          </button>
          <button onClick={handleSave} style={{ padding: '6px 16px', borderRadius: 6, border: 'none', background: 'var(--accent)', color: '#fff', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>
            Salvar
          </button>
        </div>
      </div>
    </div>
  )
}

export default function App() {
  const { state, dispatch, t } = useApp()
  const [activePanel, setActivePanel] = useState<Panel>('playlist')
  const [showItemModal, setShowItemModal] = useState(false)
  const [editingItem, setEditingItem] = useState<PlaylistItem | null>(null)
  const [showAdBreakSelect, setShowAdBreakSelect] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showVmixPanel, setShowVmixPanel] = useState(false)
  const [appVersion, setAppVersion] = useState('')
  // Context menu callbacks: inserir ação vMix ou input vMix após um item específico
  const [insertAfterOrder, setInsertAfterOrder] = useState<number | undefined>()
  const [defaultItemMode, setDefaultItemMode] = useState<'media' | 'vmix_action'>('media')
  const [scheduleEditItem, setScheduleEditItem] = useState<PlaylistItem | null>(null)
  // Persists the selected date across Programação tab navigation
  const [scheduleDate, setScheduleDate] = useState(() => {
    // Use the useApp today(), but defer to avoid stale closure on module load
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })

  useEffect(() => {
    window.spotmaster?.getVersion().then(v => setAppVersion(v)).catch(() => {})
  }, [])

  const navItems = [
    { id: 'playlist' as Panel,    label: t.nav.playlist },
    { id: 'programacao' as Panel, label: t.nav.programacao },
    { id: 'grade' as Panel,       label: t.nav.grade },
    { id: 'adbreaks' as Panel,    label: t.nav.adBreaks },
    { id: 'clients' as Panel,     label: t.nav.clients },
    { id: 'log' as Panel,         label: t.nav.log },
    { id: 'reports' as Panel,     label: t.nav.reports },
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
              <PlaylistTable
                onEditItem={(item) => { setEditingItem(item); setShowItemModal(true) }}
                onInsertVmixAction={(afterOrder) => {
                  setInsertAfterOrder(afterOrder)
                  setDefaultItemMode('vmix_action')
                  setEditingItem(null)
                  setShowItemModal(true)
                }}
                onInsertVmixInput={(afterOrder) => {
                  setInsertAfterOrder(afterOrder)
                  setDefaultItemMode('media')
                  setEditingItem(null)
                  setShowVmixPanel(true)
                }}
                onEditSchedule={(item) => { setScheduleEditItem(item) }}
              />
              {showVmixPanel && <VmixInputPanel onClose={() => setShowVmixPanel(false)} />}
            </div>
          )}
          {activePanel === 'programacao' && (
            <DaySchedulePanel
              selectedDate={scheduleDate}
              onDateChange={setScheduleDate}
            />
          )}
          {activePanel === 'grade' && <GradePanel onNavigate={handleSetPanel} />}
          {activePanel === 'adbreaks' && <AdBreaksPanel />}
          {activePanel === 'clients' && <ClientsPanel />}
          {activePanel === 'log' && <LogPanel />}
          {activePanel === 'reports' && <ReportsPanel />}
        </main>
      </div>
      <StatusBar />
      {showItemModal && (
        <ItemModal
          item={editingItem}
          insertAfterOrder={editingItem ? undefined : insertAfterOrder}
          defaultMode={editingItem ? undefined : defaultItemMode}
          onClose={() => {
            setShowItemModal(false)
            setEditingItem(null)
            setInsertAfterOrder(undefined)
            setDefaultItemMode('media')
          }}
        />
      )}
      {showAdBreakSelect && <AdBreakSelectModal onClose={() => setShowAdBreakSelect(false)} />}
      {scheduleEditItem && (
        <ScheduleEditModal
          item={scheduleEditItem}
          onClose={() => setScheduleEditItem(null)}
        />
      )}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </div>
  )
}