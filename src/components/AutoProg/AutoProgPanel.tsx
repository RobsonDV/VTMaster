import { useState } from 'react'
import StylesTab from './StylesTab'
import SequencesTab from './SequencesTab'
import AutoBlocoTab from './AutoBlocoTab'
import './AutoProgPanel.css'

type Tab = 'styles' | 'sequences' | 'autobloco'

const TABS: { id: Tab; label: string }[] = [
  { id: 'styles',    label: 'Cadastrar' },
  { id: 'sequences', label: 'Sequência' },
  { id: 'autobloco', label: 'Autobloco' },
]

export default function AutoProgPanel() {
  const [tab, setTab] = useState<Tab>('styles')

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
        {tab === 'styles'    && <StylesTab />}
        {tab === 'sequences' && <SequencesTab />}
        {tab === 'autobloco' && <AutoBlocoTab />}
      </div>
    </div>
  )
}
