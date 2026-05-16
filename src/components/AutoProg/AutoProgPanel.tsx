import { useState } from 'react'
import SequencesTab from './SequencesTab'
import AutoBlocoTab from './AutoBlocoTab'
import SimulatorTab from './SimulatorTab'
import './AutoProgPanel.css'

type Tab = 'sequences' | 'autobloco' | 'simulator'

const TABS: { id: Tab; label: string }[] = [
  { id: 'sequences', label: 'Sequência' },
  { id: 'autobloco', label: 'AutoBloco' },
  { id: 'simulator', label: 'Simulador' },
]

export default function AutoProgPanel() {
  const [tab, setTab] = useState<Tab>('sequences')

  return (
    <div className="autoprog-panel">
      <div className="autoprog-tabs">
        {TABS.map(t => (
          <button
            key={t.id}
            className={`autoprog-tab ${tab === t.id ? 'active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="autoprog-tab-content">
        {tab === 'sequences' && <SequencesTab />}
        {tab === 'autobloco' && <AutoBlocoTab />}
        {tab === 'simulator' && <SimulatorTab />}
      </div>
    </div>
  )
}
