import { useState } from 'react'
import { Edit2, Trash2, Plus, ChevronUp, ChevronDown, Play, Loader2 } from 'lucide-react'
import { useApp } from '../../store/AppContext'
import type { MusicSequence, MusicSequenceItem } from '../../types'
import { generateMusicBlock } from '../../utils/autoprog'
import Button from '../ui/Button'
import Modal from '../ui/Modal'
import { Field, FieldRow } from '../ui/Field'
import PageHeader from '../ui/PageHeader'

// ─── Sequence Form Modal ──────────────────────────────────────────────────────

function SequenceModal({
  initial,
  onSave,
  onClose,
}: {
  initial: MusicSequence | null
  onSave: (s: MusicSequence) => void
  onClose: () => void
}) {
  const { state } = useApp()

  const [name, setName] = useState(initial?.name ?? '')
  const [items, setItems] = useState<MusicSequenceItem[]>(
    initial?.items ?? [],
  )
  const [noSameArtistWindow, setNoSameArtistWindow] = useState(initial?.noSameArtistWindow ?? 3)
  const [fallback, setFallback] = useState<MusicSequence['fallback']>(
    initial?.fallback ?? 'ignore_cooldown',
  )
  const [targetMode, setTargetMode] = useState<MusicSequence['targetMode']>(
    initial?.targetMode ?? 'count',
  )
  const [targetValue, setTargetValue] = useState(initial?.targetValue ?? 10)

  const addItem = () => {
    const firstStyle = state.musicStyles[0]
    if (!firstStyle) return
    setItems(prev => [...prev, { styleId: firstStyle.id, count: 1 }])
  }

  const updateItem = (idx: number, patch: Partial<MusicSequenceItem>) =>
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, ...patch } : it))

  const removeItem = (idx: number) =>
    setItems(prev => prev.filter((_, i) => i !== idx))

  const moveItem = (idx: number, dir: -1 | 1) => {
    const next = idx + dir
    if (next < 0 || next >= items.length) return
    setItems(prev => {
      const arr = [...prev]
      ;[arr[idx], arr[next]] = [arr[next], arr[idx]]
      return arr
    })
  }

  const valid = name.trim() !== '' && items.length > 0

  const handleSave = () => {
    onSave({
      id: initial?.id ?? crypto.randomUUID(),
      name: name.trim(),
      items,
      noSameArtistWindow,
      fallback,
      targetMode,
      targetValue,
    })
  }

  return (
    <Modal
      title={initial ? 'Editar Sequência' : 'Nova Sequência'}
      onClose={onClose}
      maxWidth={520}
      actions={
        <>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" disabled={!valid} onClick={handleSave}>Salvar</Button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Field label="Nome da Sequência">
          <input
            className="input"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Ex: Manhã Pop, Tarde Flashback…"
            autoFocus
          />
        </Field>

        <Field label="Ciclo de estilos" hint="Os estilos serão tocados em ordem cíclica com as quantidades definidas.">
          {state.musicStyles.length === 0 ? (
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', padding: '8px 0' }}>
              Nenhum estilo cadastrado. Vá para a aba <strong>Cadastrar</strong> primeiro.
            </div>
          ) : (
            <>
              {items.map((item, idx) => (
                <div key={idx} className="ap-seq-item">
                  <button
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 2 }}
                    onClick={() => moveItem(idx, -1)}
                    disabled={idx === 0}
                  >
                    <ChevronUp size={13} />
                  </button>
                  <button
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 2 }}
                    onClick={() => moveItem(idx, 1)}
                    disabled={idx === items.length - 1}
                  >
                    <ChevronDown size={13} />
                  </button>

                  {/* Color dot */}
                  <div style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: state.musicStyles.find(s => s.id === item.styleId)?.color ?? '#555',
                    flexShrink: 0,
                  }} />

                  <select
                    className="input"
                    value={item.styleId}
                    onChange={e => updateItem(idx, { styleId: e.target.value })}
                    style={{ flex: 1, padding: '3px 6px', fontSize: '0.82rem' }}
                  >
                    {state.musicStyles.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>

                  <input
                    type="number"
                    className="input"
                    min={1}
                    max={20}
                    value={item.count}
                    onChange={e => updateItem(idx, { count: Math.max(1, parseInt(e.target.value) || 1) })}
                    style={{ width: 50, padding: '3px 6px', fontSize: '0.82rem', textAlign: 'center' }}
                  />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', flexShrink: 0 }}>músicas</span>

                  <button
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 2 }}
                    onClick={() => removeItem(idx)}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
              <Button variant="secondary" icon={<Plus size={13} />} onClick={addItem} style={{ marginTop: 6 }}>
                Adicionar Estilo
              </Button>
            </>
          )}
        </Field>

        <FieldRow>
          <Field label="Não repetir artista por">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                className="input"
                type="number"
                min={0}
                max={50}
                value={noSameArtistWindow}
                onChange={e => setNoSameArtistWindow(Math.max(0, parseInt(e.target.value) || 0))}
                style={{ width: 60, textAlign: 'center' }}
              />
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>músicas (0 = desabilitado)</span>
            </div>
          </Field>
        </FieldRow>

        <FieldRow>
          <Field label="Objetivo do bloco">
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <select
                className="input"
                value={targetMode}
                onChange={e => setTargetMode(e.target.value as MusicSequence['targetMode'])}
                style={{ width: 'auto' }}
              >
                <option value="count">Número de músicas</option>
                <option value="duration">Duração em minutos</option>
              </select>
              <input
                className="input"
                type="number"
                min={1}
                value={targetValue}
                onChange={e => setTargetValue(Math.max(1, parseInt(e.target.value) || 1))}
                style={{ width: 70, textAlign: 'center' }}
              />
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                {targetMode === 'count' ? 'músicas' : 'min'}
              </span>
            </div>
          </Field>
        </FieldRow>

        <Field label="Se todos em cooldown…">
          <select
            className="input"
            value={fallback}
            onChange={e => setFallback(e.target.value as MusicSequence['fallback'])}
          >
            <option value="ignore_cooldown">Ignorar cooldown e tocar assim mesmo</option>
            <option value="skip">Pular o slot (não gera item)</option>
            <option value="alert">Ignorar cooldown (aviso no log)</option>
          </select>
        </Field>
      </div>
    </Modal>
  )
}

// ─── Simulate Modal ────────────────────────────────────────────────────────────

function SimulateModal({
  sequence,
  onClose,
}: {
  sequence: MusicSequence
  onClose: () => void
}) {
  const { state } = useApp()
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<{ title: string; artist: string; styleId: string }[] | null>(null)
  const [error, setError] = useState('')

  const runSimulation = async () => {
    if (!window.spotmaster?.scanMusicFolder) {
      setError('Função de varredura não disponível (modo web).')
      return
    }
    setLoading(true)
    setError('')
    try {
      const today = new Date().toISOString().slice(0, 10)
      const generated = await generateMusicBlock({
        sequence,
        styles: state.musicStyles,
        playLog: state.playLog,
        date: today,
        scanFolder: (p, subs) => window.spotmaster.scanMusicFolder(p, subs),
      })
      setResults(generated)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      title={`Simular: ${sequence.name}`}
      onClose={onClose}
      maxWidth={520}
      actions={<Button variant="secondary" onClick={onClose}>Fechar</Button>}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <Button
            variant="primary"
            icon={loading ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Play size={14} />}
            disabled={loading}
            onClick={runSimulation}
          >
            {loading ? 'Gerando…' : 'Gerar Prévia'}
          </Button>
          {results !== null && (
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              {results.length} música{results.length !== 1 ? 's' : ''} geradas
            </span>
          )}
        </div>

        {error && (
          <div style={{ fontSize: '0.82rem', color: '#ef4444', padding: '8px 12px', background: 'color-mix(in srgb, #ef4444 10%, var(--bg-secondary))', borderRadius: 6 }}>
            {error}
          </div>
        )}

        {results !== null && results.length === 0 && (
          <div className="ap-empty" style={{ padding: '20px 0' }}>
            Nenhuma música encontrada. Verifique as pastas configuradas nos estilos.
          </div>
        )}

        {results !== null && results.length > 0 && (
          <div className="ap-simulate-list">
            {results.map((item, i) => {
              const style = state.musicStyles.find(s => s.id === item.styleId)
              return (
                <div key={i} className="ap-simulate-item">
                  <span className="ap-simulate-num">{i + 1}.</span>
                  <span className="ap-simulate-title">{item.title}</span>
                  {item.artist && <span className="ap-simulate-artist">{item.artist}</span>}
                  {style && (
                    <span
                      className="ap-simulate-style"
                      style={{
                        background: `color-mix(in srgb, ${style.color ?? '#3b82f6'} 15%, var(--bg-primary))`,
                        color: style.color ?? '#3b82f6',
                        border: `1px solid color-mix(in srgb, ${style.color ?? '#3b82f6'} 30%, transparent)`,
                      }}
                    >
                      {style.name}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </Modal>
  )
}

// ─── Sequences Tab ────────────────────────────────────────────────────────────

export default function SequencesTab() {
  const { state, dispatch } = useApp()
  const [editing, setEditing] = useState<MusicSequence | null | 'new'>(null)
  const [simulating, setSimulating] = useState<MusicSequence | null>(null)

  const handleSave = (seq: MusicSequence) => {
    const exists = state.musicSequences.some(s => s.id === seq.id)
    dispatch({ type: exists ? 'UPDATE_MUSIC_SEQUENCE' : 'ADD_MUSIC_SEQUENCE', payload: seq })
    setEditing(null)
  }

  const handleDelete = (id: string) => {
    if (!confirm('Excluir esta sequência?')) return
    dispatch({ type: 'DELETE_MUSIC_SEQUENCE', payload: id })
  }

  const getStyleName = (id: string) =>
    state.musicStyles.find(s => s.id === id)?.name ?? '(estilo removido)'

  return (
    <div>
      <PageHeader
        title="Sequências"
        subtitle="Monte a ordem dos estilos musicais e configure as regras de repetição."
        actions={
          <Button variant="primary" icon={<Plus size={14} />} onClick={() => setEditing('new')}>
            Nova Sequência
          </Button>
        }
      />

      {state.musicSequences.length === 0 ? (
        <div className="ap-empty">
          Nenhuma sequência cadastrada.<br />Clique em <strong>Nova Sequência</strong> para começar.
        </div>
      ) : (
        <div className="ap-card-list">
          {state.musicSequences.map(seq => (
            <div key={seq.id} className="ap-card">
              <div className="ap-card-body">
                <div className="ap-card-title">{seq.name}</div>
                <div className="ap-card-meta">
                  {seq.items.map(it => `${getStyleName(it.styleId)} ×${it.count}`).join(' → ')}
                </div>
                <div className="ap-card-meta" style={{ marginTop: 2 }}>
                  {seq.targetMode === 'count' ? `${seq.targetValue} músicas` : `${seq.targetValue} min`}
                  {seq.noSameArtistWindow > 0 && ` · Artista único por ${seq.noSameArtistWindow} músicas`}
                </div>
              </div>
              <div className="ap-card-actions">
                <Button variant="secondary" icon={<Play size={13} />} onClick={() => setSimulating(seq)}>Simular</Button>
                <Button variant="ghost" iconOnly icon={<Edit2 size={14} />} onClick={() => setEditing(seq)} />
                <Button variant="ghost" iconOnly icon={<Trash2 size={14} />} onClick={() => handleDelete(seq.id)} />
              </div>
            </div>
          ))}
        </div>
      )}

      {editing !== null && (
        <SequenceModal
          initial={editing === 'new' ? null : editing}
          onSave={handleSave}
          onClose={() => setEditing(null)}
        />
      )}

      {simulating && (
        <SimulateModal
          sequence={simulating}
          onClose={() => setSimulating(null)}
        />
      )}
    </div>
  )
}
