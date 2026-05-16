import { useState, useMemo } from 'react'
import { Zap, Plus } from 'lucide-react'
import type { PlaylistItem, VmixActionItem } from '../../types'
import { VMIX_COMMAND_CATALOG } from '../../utils/vmixCommandCatalog'

interface Props {
  onInsert: (item: Omit<PlaylistItem, 'id' | 'order' | 'status'>) => void
}

const CATEGORY_LABELS: Record<string, string> = {
  playback:   'Reprodução',
  transition: 'Transição',
  audio:      'Áudio',
  overlay:    'Overlay',
  recording:  'Gravação',
  streaming:  'Streaming',
  output:     'Saídas',
  title:      'Títulos',
  browser:    'Browser',
  script:     'Script',
  unknown:    'Outros',
}

export default function ActionsTab({ onInsert }: Props) {
  const [search, setSearch] = useState('')
  const [inputs, setInputs] = useState<Record<string, string>>({})
  const [values, setValues] = useState<Record<string, string>>({})

  const visible = useMemo(() =>
    VMIX_COMMAND_CATALOG.filter(cmd => {
      if (cmd.hidden) return false
      if (!search.trim()) return true
      return cmd.label.toLowerCase().includes(search.toLowerCase()) ||
        cmd.functionName.toLowerCase().includes(search.toLowerCase())
    }),
    [search]
  )

  const byCategory = useMemo(() => {
    const map: Record<string, typeof visible> = {}
    visible.forEach(cmd => {
      const cat = cmd.category ?? 'unknown'
      if (!map[cat]) map[cat] = []
      map[cat].push(cmd)
    })
    return map
  }, [visible])

  const handleInsert = (fn: string) => {
    const cmd = VMIX_COMMAND_CATALOG.find(c => c.functionName === fn)!
    const action: VmixActionItem = {
      function: fn,
      input: inputs[fn] ?? undefined,
      value: values[fn] ?? undefined,
    }
    onInsert({
      title: cmd.label,
      type: 'vmix_action',
      duration: 0,
      vmixAction: action,
    })
    setInputs(prev => { const n = { ...prev }; delete n[fn]; return n })
    setValues(prev => { const n = { ...prev }; delete n[fn]; return n })
  }

  return (
    <>
      <div className="mb-search">
        <input
          placeholder="Buscar ação vMix…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className="mb-list">
        {visible.length === 0 && (
          <div className="mb-empty">Nenhuma ação encontrada.</div>
        )}
        {Object.entries(byCategory).map(([cat, cmds]) => (
          <div key={cat}>
            <div className="mb-group-label">{CATEGORY_LABELS[cat] ?? cat}</div>
            {cmds.map(cmd => (
              <div key={cmd.functionName} className="mb-item" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Zap size={13} className="mb-item-icon" />
                  <div className="mb-item-info">
                    <div className="mb-item-name">{cmd.label}</div>
                    <div className="mb-item-meta">{cmd.functionName}</div>
                  </div>
                  <button
                    className="mb-item-add"
                    title="Inserir ação na programação"
                    onClick={() => handleInsert(cmd.functionName)}
                  >
                    <Plus size={13} />
                  </button>
                </div>

                {(cmd.requiresInput || cmd.requiresValue) && (
                  <div className="mb-action-fields">
                    {cmd.requiresInput && (
                      <input
                        placeholder="Input / GUID…"
                        value={inputs[cmd.functionName] ?? ''}
                        onChange={e => setInputs(prev => ({ ...prev, [cmd.functionName]: e.target.value }))}
                      />
                    )}
                    {cmd.requiresValue && (
                      <input
                        placeholder={cmd.valueLabel ?? 'Valor…'}
                        value={values[cmd.functionName] ?? ''}
                        onChange={e => setValues(prev => ({ ...prev, [cmd.functionName]: e.target.value }))}
                      />
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </>
  )
}
