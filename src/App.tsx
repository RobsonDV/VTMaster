import { useState, useEffect, useRef, useCallback } from 'react'
import { today } from './utils/time'
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
  MonitorPlay,
  Volume2,
  Film,
  MonitorCog,
  Activity,
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
import GrafismosPanel from './components/Grafismos/GrafismosPanel'
import AudioProPanel from './components/AudioPro/AudioProPanel'
import MediaBankPanel from './components/MediaBank/MediaBankPanel'
import OnAirPanel from './components/OnAir/OnAirPanel'
import CommandPalette from './components/CommandPalette/CommandPalette'
import VideoProPanel from './components/VideoPro/VideoProPanel'
import VmixOutputsPanel from './components/VmixOutputs/VmixOutputsPanel'
import VmixHealthPanel from './components/VmixHealth/VmixHealthPanel'
import ResumeBanner from './components/ResumeBanner/ResumeBanner'
import './App.css'
import vtmasterLogo from './assets/Logo_VTMasterHorizontal.png'

type Panel = 'playlist' | 'grade' | 'programacao' | 'adbreaks' | 'clients' | 'campaigns' | 'grafismos' | 'outputs' | 'vmixhealth' | 'log' | 'reports' | 'autoprog' | 'audiopro' | 'videopro'
const PANELS: Panel[] = ['playlist', 'grade', 'programacao', 'adbreaks', 'clients', 'campaigns', 'grafismos', 'outputs', 'vmixhealth', 'log', 'reports', 'autoprog', 'audiopro', 'videopro']

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
  const [scheduleDate, setScheduleDate] = useState(today)
  // Banco de Mídia, On Air e Command Palette
  const [showMediaBank, setShowMediaBank] = useState(false)
  const [mediaBankPinned, setMediaBankPinned] = useState(false)
  const [mediaBankTab, setMediaBankTab] = useState<'videos' | 'audios' | 'inputs' | 'actions'>('videos')
  // Sidebar colapsável
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [showOnAir, setShowOnAir] = useState(false)
  const [showCommandPalette, setShowCommandPalette] = useState(false)

  // Item selecionado em cada painel — usado pelo Banco de Mídia para inserir abaixo
  const selectedItemRef = useRef<PlaylistItem | null>(null)
  const scheduleDateRef = useRef(scheduleDate)

  useEffect(() => {
    scheduleDateRef.current = scheduleDate
  }, [scheduleDate])

  // Ctrl+K — Command Palette
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setShowCommandPalette(v => !v)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Inserção de itens do Banco de Mídia — detecta painel ativo e item selecionado
  const handleMediaBankInsert = useCallback((item: Omit<PlaylistItem, 'id' | 'order' | 'status'>) => {
    const selected = selectedItemRef.current
    const panel = state.activePanel

    if (panel === 'programacao') {
      const schedItems = state.dateSchedules[scheduleDate] ?? []
      if (selected && schedItems.find(i => i.id === selected.id)) {
        // Insert below selected item — INSERT_ITEM_AFTER reads state in reducer (no stale closure)
        dispatch({
          type: 'INSERT_ITEM_AFTER',
          payload: {
            date: scheduleDate,
            afterId: selected.id,
            item: { status: 'pending', manuallyAdded: true, ...item, scheduledTime: item.scheduledTime ?? selected.scheduledTime },
          },
        })
      } else {
        // No selection: append at end — ADD_DATE_SCHEDULE_ITEM reads state in reducer
        dispatch({
          type: 'ADD_DATE_SCHEDULE_ITEM',
          payload: { date: scheduleDate, item: { status: 'pending', manuallyAdded: true, ...item } },
        })
      }
    } else {
      // Inserir na Playlist
      if (selected && state.playlist.find(i => i.id === selected.id)) {
        const newItem: PlaylistItem = {
          id: crypto.randomUUID(),
          order: selected.order + 0.5,
          status: 'pending',
          ...item,
        }
        dispatch({ type: 'INSERT_PLAYLIST_ITEM_AFTER', payload: { item: newItem, afterOrder: selected.order } })
      } else {
        // Sem seleção: adicionar no final
        const newItem: PlaylistItem = {
          id: crypto.randomUUID(),
          order: state.playlist.length + 1,
          status: 'pending',
          ...item,
        }
        dispatch({ type: 'ADD_PLAYLIST_ITEM', payload: newItem })
      }
    }
  }, [state.activePanel, state.playlist, state.dateSchedules, scheduleDate, dispatch])

  // Auto-advance to the next day at midnight.
  // Only advances if the operator is viewing "today or the past" — future dates chosen
  // manually by the operator are preserved.
  useEffect(() => {
    const interval = setInterval(() => {
      const currentDay = today()
      if (scheduleDateRef.current < currentDay) {
        setScheduleDate(currentDay)
      }
    }, 30_000)
    return () => clearInterval(interval)
  }, [])

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
    { id: 'grafismos' as Panel,   label: t.nav.grafismos, icon: MonitorPlay },
    { id: 'outputs' as Panel,     label: 'Saidas vMix', icon: MonitorCog },
    { id: 'vmixhealth' as Panel,  label: 'Saude vMix', icon: Activity },
    { id: 'log' as Panel,         label: t.nav.log, icon: ClipboardList },
    { id: 'reports' as Panel,     label: t.nav.reports, icon: FileBarChart },
    { id: 'autoprog' as Panel,    label: 'AutoProg', icon: Music2 },
    { id: 'audiopro' as Panel,    label: 'AudioPro', icon: Volume2 },
    { id: 'videopro' as Panel,    label: 'VideoPro', icon: Film },
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
        onToggleMediaBank={() => setShowMediaBank(v => !v)}
        mediaBankOpen={showMediaBank}
      />
      {/* Banner global de retomada — visível em qualquer aba */}
      <ResumeBanner />
      <div className="app-body">
        {/* ── Sidebar colapsável ── */}
        <nav className={`sidebar${sidebarCollapsed ? ' sidebar--collapsed' : ''}`}>
          {navItems.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={`nav-item ${activePanel === id ? 'active' : ''}`}
              onClick={() => handleSetPanel(id)}
              title={sidebarCollapsed ? label : undefined}
            >
              <Icon size={17} />
              {!sidebarCollapsed && <span>{label}</span>}
            </button>
          ))}
          <div style={{ flex: 1 }} />
          <button
            className={`nav-item ${showOnAir ? 'active' : ''}`}
            onClick={() => setShowOnAir(v => !v)}
            title={sidebarCollapsed ? 'On Air' : 'Modo On Air — tela simplificada de operação'}
            style={{ color: state.isSequencePlaying ? 'var(--danger, #ef4444)' : undefined }}
          >
            <Tv size={17} />
            {!sidebarCollapsed && <span>On Air</span>}
          </button>
          <button className="nav-item" onClick={() => setShowSettings(true)} title={sidebarCollapsed ? t.settings.title : undefined}>
            <Settings size={18} />
            {!sidebarCollapsed && <span>{t.settings.title}</span>}
          </button>
          {/* Botão colapsar/expandir sidebar */}
          <button
            className="nav-item sidebar-toggle"
            onClick={() => setSidebarCollapsed(v => !v)}
            title={sidebarCollapsed ? 'Expandir menu' : 'Recolher menu'}
          >
            {sidebarCollapsed
              ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
              : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
            }
            {!sidebarCollapsed && <span>Recolher</span>}
          </button>
          {!sidebarCollapsed && (
            <div className="dev-credit">
              <strong>VTMaster</strong>
              {appVersion && <span className="dev-version">v{appVersion}</span>}
              Desenvolvido por<br />RobsonCostaDV
            </div>
          )}
        </nav>

        {/* ── Área de conteúdo principal ── */}
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
                onSelectedItemChange={(item) => { selectedItemRef.current = item }}
              />
              {showVmixPanel && <VmixInputPanel onClose={() => setShowVmixPanel(false)} />}
            </div>
          )}
          {activePanel === 'programacao' && (
            <DaySchedulePanel
              selectedDate={scheduleDate}
              onDateChange={setScheduleDate}
              onSelectedItemChange={(item) => { selectedItemRef.current = item }}
            />
          )}
          {activePanel === 'grade' && <GradePanel onNavigate={handleSetPanel} />}
          {activePanel === 'adbreaks' && <AdBreaksPanel />}
          {activePanel === 'clients' && <ClientsPanel />}
          {activePanel === 'campaigns' && <CampaignsPanel />}
          {activePanel === 'grafismos' && <GrafismosPanel />}
          {activePanel === 'outputs' && <VmixOutputsPanel />}
          {activePanel === 'vmixhealth' && <VmixHealthPanel />}
          {activePanel === 'log' && <LogPanel />}
          {activePanel === 'reports' && <ReportsPanel />}
          {activePanel === 'autoprog' && <AutoProgPanel />}
          {activePanel === 'audiopro' && <AudioProPanel />}
          {activePanel === 'videopro' && <VideoProPanel />}
        </main>

        {/* ── Banco de Mídia PINADO: dentro do layout como coluna fixa ── */}
        {showMediaBank && mediaBankPinned && (
          <MediaBankPanel
            tab={mediaBankTab}
            onTabChange={setMediaBankTab}
            onClose={() => { setShowMediaBank(false); setMediaBankPinned(false) }}
            onInsert={handleMediaBankInsert}
            pinned={true}
            onTogglePin={() => setMediaBankPinned(false)}
          />
        )}
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

      {/* Banco de Mídia — overlay drawer quando NÃO pinado */}
      {showMediaBank && !mediaBankPinned && (
        <MediaBankPanel
          tab={mediaBankTab}
          onTabChange={setMediaBankTab}
          onClose={() => setShowMediaBank(false)}
          onInsert={handleMediaBankInsert}
          pinned={false}
          onTogglePin={() => setMediaBankPinned(true)}
        />
      )}

      {/* Modo On Air — overlay de operação simplificado */}
      {showOnAir && <OnAirPanel onClose={() => setShowOnAir(false)} />}

      {/* Command Palette — Ctrl+K */}
      {showCommandPalette && (
        <CommandPalette
          onClose={() => setShowCommandPalette(false)}
          onNavigate={(panel) => {
            dispatch({ type: 'SET_ACTIVE_PANEL', payload: panel })
            setShowCommandPalette(false)
          }}
          onToggleMediaBank={() => { setShowMediaBank(v => !v); setShowCommandPalette(false) }}
          onToggleOnAir={() => { setShowOnAir(v => !v); setShowCommandPalette(false) }}
        />
      )}
    </div>
  )
}
