import { Film, Music, MonitorPlay, Zap, X, Database } from 'lucide-react'
import type { PlaylistItem } from '../../types'
import VideosTab from './VideosTab'
import AudiosTab from './AudiosTab'
import InputsTab from './InputsTab'
import ActionsTab from './ActionsTab'
import './MediaBankPanel.css'

type Tab = 'videos' | 'audios' | 'inputs' | 'actions'

interface Props {
  tab: Tab
  onTabChange: (tab: Tab) => void
  onClose: () => void
  onInsert: (item: Omit<PlaylistItem, 'id' | 'order' | 'status'>) => void
}

const TABS: { id: Tab; label: string; Icon: React.ElementType }[] = [
  { id: 'videos',  label: 'Vídeos',  Icon: Film },
  { id: 'audios',  label: 'Áudios',  Icon: Music },
  { id: 'inputs',  label: 'Inputs',  Icon: MonitorPlay },
  { id: 'actions', label: 'Ações',   Icon: Zap },
]

export default function MediaBankPanel({ tab, onTabChange, onClose, onInsert }: Props) {
  return (
    <div className="media-bank-drawer">
      <div className="media-bank-header">
        <Database size={15} style={{ color: 'var(--accent)' }} />
        <h3>Banco de Mídia</h3>
        <button className="media-bank-close" onClick={onClose} title="Fechar">
          <X size={15} />
        </button>
      </div>

      <div className="media-bank-tabs">
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            className={`mb-tab ${tab === id ? 'active' : ''}`}
            onClick={() => onTabChange(id)}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      <div className="media-bank-body">
        {tab === 'videos'  && <VideosTab  onInsert={onInsert} />}
        {tab === 'audios'  && <AudiosTab  onInsert={onInsert} />}
        {tab === 'inputs'  && <InputsTab  onInsert={onInsert} />}
        {tab === 'actions' && <ActionsTab onInsert={onInsert} />}
      </div>
    </div>
  )
}
