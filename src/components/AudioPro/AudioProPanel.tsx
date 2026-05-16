import { useState } from 'react'
import { Layers, Radio, Music } from 'lucide-react'
import AudioLayersTab from './AudioLayersTab'
import AudioControlTab from './AudioControlTab'
import AudioStylesTab from './AudioStylesTab'
import './AudioProPanel.css'

type Tab = 'control' | 'layers' | 'styles'

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'control', label: 'Controle', icon: Radio },
  { id: 'layers',  label: 'Camadas',  icon: Layers },
  { id: 'styles',  label: 'Estilos',  icon: Music },
]

export default function AudioProPanel() {
  const [tab, setTab] = useState<Tab>('control')

  return (
    <div className="audiopro-panel">
      <div className="audiopro-tabs">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            className={`audiopro-tab ${tab === id ? 'active' : ''}`}
            onClick={() => setTab(id)}
          >
            <Icon size={13} />
            {label}
          </button>
        ))}
      </div>

      <div className="audiopro-tab-content">
        {tab === 'control' && <AudioControlTab />}
        {tab === 'layers'  && <AudioLayersTab />}
        {tab === 'styles'  && <AudioStylesTab />}
      </div>
    </div>
  )
}
