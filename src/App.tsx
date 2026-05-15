import { useState, useEffect } from 'react'
import {
  CalendarDays,
  ClipboardList,
  FileBarChart,
  LayoutGrid,
  ListVideo,
  Music2,
  Settings,
  Tv,
  Users,
  Megaphone,
} from 'lucide-react'
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
import Button from './components/ui/Button'
import Modal from './components/ui/Modal'
import { Field } from './components/ui/Field'
import type { PlaylistItem } from './types'
import AutoProgPanel from './components/AutoProg/AutoProgPanel'
import CampaignsPanel from './components/Campaigns/CampaignsPanel'
import './App.css'
import vtmasterLogo from './assets/Logo_VTMasterHorizontal.png'

type Panel = 'playlist' | 'grade' | 'programacao' | 'adbreaks' | 'clients' | 'campaigns' | 'log' | 'reports' | 'autoprog'
const PANELS: Panel[] = ['playlist', 'grade', 'programacao', 'adbreaks', 'clients', 'campaigns', 'log', 'reports', 'autoprog']

function isPanel(value: string): value is Panel {
  return PANELS.includes(value as Panel)
}

// Mini-modal para editar apenas o horário agendado de um item
function ScheduleEditModal({ item, onClose }: { item: PlaylistItem; onClose: () => void }) {
  const { dispatch } = useApp()
  const [time, setTime] = useState(item.scheduledTime ?? '')

  const handleSave = () => {
    dispatch({ type: 'UPDATE_PLAYLIST_ITEM', payload: { ...item, scheduledTime: time || undefined } })
    onClose()
  }

  return (
    <Modal
      title="Editar Horário"
      onClose={onClose}
      minWidth={320}
      actions={
        <>
          {time && <Button variant="ghost" onClick={() => { setTime('') }}>Limpar</Button>}
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" onClick={handleSave}>Salvar</Button>
        </>
      }
    >
      <div className="ui-field-hint">{item.title}</div>
      <Field label="Horário">
        <input
          type="time"
          step="1"
          value={time}
          onChange={e => setTime(e.target.value)}
          autoFocus
          className="ui-input"
        />
      </Field>
    </Modal>
  )
}

export default function App() {
  const { state, dispatch, t } = useApp()
  const activePanel: Panel = isPanel(state.activePanel) ? state.activePanel : 'playlist'
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
    { id: 'programacao' as Panel, label: t.nav.programacao, icon: Tv },
    { id: 'playlist' as Panel,    label: t.nav.playlist, icon: ListVideo },
    { id: 'grade' as Panel,       label: t.nav.grade, icon: LayoutGrid },
    { id: 'adbreaks' as Panel,    label: t.nav.adBreaks, icon: CalendarDays },
    { id: 'clients' as Panel,     label: t.nav.clients, icon: Users },
    { id: 'campaigns' as Panel,   label: t.nav.campaigns, icon: Megaphone },
    { id: 'log' as Panel,         label: t.nav.log, icon: ClipboardList },
    { id: 'reports' as Panel,     label: t.nav.reports, icon: FileBarChart },
    { id: 'autoprog' as Panel,    label: 'AutoProg', icon: Music2 },
  ]

  const handleSetPanel = (panel: Panel) => {
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
          {navItems.map(({ id, label, icon: Icon }) => (
            <button key={id} className={`nav-item ${activePanel === id ? 'active' : ''}`} onClick={() => handleSetPanel(id)}>
              <Icon size={17} />
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
          {activePanel === 'campaigns' && <CampaignsPanel />}
          {activePanel === 'log' && <LogPanel />}
          {activePanel === 'reports' && <ReportsPanel />}
          {activePanel === 'autoprog' && <AutoProgPanel />}
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
