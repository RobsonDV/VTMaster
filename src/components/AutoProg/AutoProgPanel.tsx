import { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import SequencesTab from './SequencesTab'
import AutoBlocoTab from './AutoBlocoTab'
import SimulatorTab from './SimulatorTab'
import { useApp } from '../../store/AppContext'
import { today } from '../../utils/time'
import Button from '../ui/Button'
import './AutoProgPanel.css'

type Tab = 'sequences' | 'autobloco' | 'simulator'

const TABS: { id: Tab; label: string }[] = [
  { id: 'sequences', label: 'Sequência' },
  { id: 'autobloco', label: 'AutoBloco' },
  { id: 'simulator', label: 'Simulador' },
]

export default function AutoProgPanel() {
  const [tab, setTab] = useState<Tab>('sequences')
  const { generatePlaylistFromGrid } = useApp()
  const [regenerating, setRegenerating] = useState(false)
  const [regenMsg, setRegenMsg] = useState<string | null>(null)

  const handleRegenerate = async () => {
    if (regenerating) return
    setRegenerating(true)
    setRegenMsg(null)
    try {
      // merge=true preserva items done/skipped; itens pending são regenerados
      // com o estado atual de sequências, atribuições e estilos do AutoProg.
      await generatePlaylistFromGrid(today(), true)
      setRegenMsg('✓ Programação do dia regenerada com as alterações do AutoProg.')
      setTimeout(() => setRegenMsg(null), 4000)
    } catch (err) {
      setRegenMsg(`Erro: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setRegenerating(false)
    }
  }

  return (
    <div className="autoprog-panel">
      <div className="autoprog-tabs" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {TABS.map(t => (
          <button
            key={t.id}
            className={`autoprog-tab ${tab === t.id ? 'active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        {regenMsg && (
          <span style={{ fontSize: '0.78rem', color: regenMsg.startsWith('Erro') ? 'var(--error)' : 'var(--success, #4ade80)' }}>
            {regenMsg}
          </span>
        )}
        <Button
          size="sm"
          variant="secondary"
          onClick={handleRegenerate}
          disabled={regenerating}
          icon={<RefreshCw size={13} className={regenerating ? 'spin' : ''} />}
          title="Regenera a Programação do Dia aplicando as alterações feitas no AutoProg (sequências, atribuições de blocos musicais). Itens já tocados/skipped são preservados."
        >
          {regenerating ? 'Regenerando…' : 'Regenerar Programação'}
        </Button>
      </div>

      <div className="autoprog-tab-content">
        {tab === 'sequences' && <SequencesTab />}
        {tab === 'autobloco' && <AutoBlocoTab />}
        {tab === 'simulator' && <SimulatorTab />}
      </div>
    </div>
  )
}
