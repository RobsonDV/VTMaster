import { useMemo, useState } from 'react'
import { ChevronDown, ChevronUp, Edit2, Film, Loader2, Music, Play, Plus, Trash2 } from 'lucide-react'
import { useApp } from '../../store/AppContext'
import type { MusicSequence, MusicSequenceItem } from '../../types'
import { generateMusicBlock } from '../../utils/autoprog'
import { buildAutoProgStyleSources, parseStyleSourceKey, styleSourceKey } from '../../utils/autoprogStyles'
import { today as todayLocal } from '../../utils/time'
import Button from '../ui/Button'
import Modal from '../ui/Modal'
import { Field, FieldRow } from '../ui/Field'
import PageHeader from '../ui/PageHeader'

type StyleSource = ReturnType<typeof buildAutoProgStyleSources>[number]

function mediaIcon(mediaType: 'audio' | 'video') {
  return mediaType === 'video' ? <Film size={12} /> : <Music size={12} />
}

function sourceLabel(source: StyleSource) {
  return `${source.mediaType === 'video' ? 'Video' : 'Audio'} - ${source.name}`
}

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
  const styleSources = useMemo(() => buildAutoProgStyleSources({
    audioStyles: state.audioStyles,
    videoStyles: state.videoStyles,
    legacyMusicStyles: state.musicStyles,
  }), [state.audioStyles, state.videoStyles, state.musicStyles])

  const [name, setName] = useState(initial?.name ?? '')
  const [items, setItems] = useState<MusicSequenceItem[]>(initial?.items ?? [])
  const [noSameArtistWindow, setNoSameArtistWindow] = useState(initial?.noSameArtistWindow ?? 3)
  const [maxSameDayArtistPlays, setMaxSameDayArtistPlays] = useState(initial?.maxSameDayArtistPlays ?? 2)
  const [fallback, setFallback] = useState<MusicSequence['fallback']>(initial?.fallback ?? 'ignore_cooldown')
  const [targetMode, setTargetMode] = useState<MusicSequence['targetMode']>(initial?.targetMode ?? 'count')
  const [targetValue, setTargetValue] = useState(initial?.targetValue ?? 10)
  const [jingleStyleId, setJingleStyleId] = useState(initial?.jingleStyleId ?? '')
  const [jingleEveryN, setJingleEveryN] = useState(initial?.jingleEveryN ?? 4)

  const styleByKey = useMemo(
    () => new Map(styleSources.map(s => [styleSourceKey(s.mediaType, s.id), s])),
    [styleSources],
  )
  const audioJingles = styleSources.filter(s => s.mediaType === 'audio' && s.isJingle)

  const addItem = () => {
    const firstStyle = styleSources[0]
    if (!firstStyle) return
    setItems(prev => [...prev, { mediaType: firstStyle.mediaType, styleId: firstStyle.id, count: 1 }])
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
      maxSameDayArtistPlays: maxSameDayArtistPlays > 0 ? maxSameDayArtistPlays : undefined,
      fallback,
      targetMode,
      targetValue,
      jingleStyleId: jingleStyleId || undefined,
      jingleEveryN: jingleStyleId && jingleEveryN > 0 ? jingleEveryN : undefined,
    })
  }

  return (
    <Modal
      title={initial ? 'Editar Sequencia' : 'Nova Sequencia'}
      onClose={onClose}
      maxWidth={560}
      actions={
        <>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" disabled={!valid} onClick={handleSave}>Salvar</Button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Field label="Nome da Sequencia">
          <input
            className="input"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Ex: Manha mix, Clips + musicas, Tarde flashback..."
            autoFocus
          />
        </Field>

        <Field label="Ciclo de midias" hint="Misture estilos de audio e video na ordem ciclica desejada.">
          {styleSources.length === 0 ? (
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', padding: '8px 0' }}>
              Nenhum estilo cadastrado. Cadastre estilos no <strong>AudioPro</strong> ou <strong>VideoPro</strong> primeiro.
            </div>
          ) : (
            <>
              {items.map((item, idx) => {
                const mediaType = item.mediaType ?? 'audio'
                const key = styleSourceKey(mediaType, item.styleId)
                const current = styleByKey.get(key)
                return (
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

                    <div style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 20,
                      height: 20,
                      borderRadius: 4,
                      background: current?.color ?? '#555',
                      color: '#fff',
                      flexShrink: 0,
                    }}>
                      {mediaIcon(mediaType)}
                    </div>

                    <select
                      className="input"
                      value={key}
                      onChange={e => updateItem(idx, parseStyleSourceKey(e.target.value))}
                      style={{ flex: 1, padding: '3px 6px', fontSize: '0.82rem' }}
                    >
                      {styleSources.map(s => (
                        <option key={`${s.mediaType}:${s.id}`} value={styleSourceKey(s.mediaType, s.id)}>
                          {sourceLabel(s)}
                        </option>
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
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', flexShrink: 0 }}>itens</span>

                    <button
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 2 }}
                      onClick={() => removeItem(idx)}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                )
              })}
              <Button variant="secondary" icon={<Plus size={13} />} onClick={addItem} style={{ marginTop: 6 }}>
                Adicionar Estilo
              </Button>
            </>
          )}
        </Field>

        <FieldRow>
          <Field label="Nao repetir artista por">
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
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>itens de audio consecutivos (0 = desabilitado)</span>
            </div>
          </Field>
        </FieldRow>

        <FieldRow>
          <Field label="Maximo por artista no dia">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                className="input"
                type="number"
                min={0}
                max={20}
                value={maxSameDayArtistPlays}
                onChange={e => setMaxSameDayArtistPlays(Math.max(0, parseInt(e.target.value) || 0))}
                style={{ width: 60, textAlign: 'center' }}
              />
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>veiculacoes/artista/dia (0 = sem limite)</span>
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
                <option value="count">Numero de itens</option>
                <option value="duration">Duracao em minutos</option>
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
                {targetMode === 'count' ? 'itens' : 'min'}
              </span>
            </div>
          </Field>
        </FieldRow>

        <Field label="Se todos em cooldown...">
          <select
            className="input"
            value={fallback}
            onChange={e => setFallback(e.target.value as MusicSequence['fallback'])}
          >
            <option value="ignore_cooldown">Ignorar cooldown e tocar assim mesmo</option>
            <option value="skip">Pular o slot (nao gera item)</option>
            <option value="alert">Ignorar cooldown (aviso no log)</option>
          </select>
        </Field>

        <FieldRow>
          <Field label="Jingle / Vinheta" hint="Opcional: insere uma faixa curta de audio a cada N itens gerados.">
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <select
                className="input"
                value={jingleStyleId}
                onChange={e => setJingleStyleId(e.target.value)}
                style={{ flex: 1, minWidth: 150 }}
              >
                <option value="">Desabilitado</option>
                {audioJingles.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                {audioJingles.length === 0 && (
                  <option disabled value="">- jingles de audio ainda nao cadastrados -</option>
                )}
              </select>
              {jingleStyleId && (
                <>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>a cada</span>
                  <input
                    className="input"
                    type="number"
                    min={1}
                    max={20}
                    value={jingleEveryN}
                    onChange={e => setJingleEveryN(Math.max(1, parseInt(e.target.value) || 1))}
                    style={{ width: 60, textAlign: 'center' }}
                  />
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>itens</span>
                </>
              )}
            </div>
          </Field>
        </FieldRow>
      </div>
    </Modal>
  )
}

function SimulateModal({
  sequence,
  onClose,
}: {
  sequence: MusicSequence
  onClose: () => void
}) {
  const { state } = useApp()
  const styleSources = useMemo(() => buildAutoProgStyleSources({
    audioStyles: state.audioStyles,
    videoStyles: state.videoStyles,
    legacyMusicStyles: state.musicStyles,
  }), [state.audioStyles, state.videoStyles, state.musicStyles])
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<Array<{ title: string; artist: string; styleId: string; mediaType: 'audio' | 'video' }> | null>(null)
  const [error, setError] = useState('')

  const runSimulation = async () => {
    if (!window.spotmaster?.scanMusicFolder || !window.spotmaster?.scanVideoFolder) {
      setError('Funcao de varredura nao disponivel.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const today = todayLocal()
      const generated = await generateMusicBlock({
        sequence,
        styles: styleSources,
        playLog: state.playLog,
        date: today,
        scanFolder: (p, subs) => window.spotmaster.scanMusicFolder(p, subs),
        scanVideoFolder: (p, subs) => window.spotmaster.scanVideoFolder(p, subs),
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
            {loading ? 'Gerando...' : 'Gerar Previa'}
          </Button>
          {results !== null && (
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              {results.length} item{results.length !== 1 ? 's' : ''} gerados
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
            Nenhuma midia encontrada. Verifique as pastas configuradas nos estilos.
          </div>
        )}

        {results !== null && results.length > 0 && (
          <div className="ap-simulate-list">
            {results.map((item, i) => {
              const style = styleSources.find(s => s.id === item.styleId && s.mediaType === item.mediaType)
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
                      {item.mediaType === 'video' ? 'Video' : 'Audio'} - {style.name}
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

export default function SequencesTab() {
  const { state, dispatch } = useApp()
  const styleSources = useMemo(() => buildAutoProgStyleSources({
    audioStyles: state.audioStyles,
    videoStyles: state.videoStyles,
    legacyMusicStyles: state.musicStyles,
  }), [state.audioStyles, state.videoStyles, state.musicStyles])
  const [editing, setEditing] = useState<MusicSequence | null | 'new'>(null)
  const [simulating, setSimulating] = useState<MusicSequence | null>(null)

  const handleSave = (seq: MusicSequence) => {
    const exists = state.musicSequences.some(s => s.id === seq.id)
    dispatch({ type: exists ? 'UPDATE_MUSIC_SEQUENCE' : 'ADD_MUSIC_SEQUENCE', payload: seq })
    setEditing(null)
  }

  const handleDelete = (id: string) => {
    if (!confirm('Excluir esta sequencia?')) return
    dispatch({ type: 'DELETE_MUSIC_SEQUENCE', payload: id })
  }

  const getStyleName = (item: MusicSequenceItem) => {
    const mediaType = item.mediaType ?? 'audio'
    const style = styleSources.find(s => s.id === item.styleId && s.mediaType === mediaType)
    return style ? `${mediaType === 'video' ? 'Video' : 'Audio'} - ${style.name}` : '(estilo removido)'
  }

  return (
    <div>
      <PageHeader
        title="Sequencias"
        subtitle="Monte ciclos misturando estilos de AudioPro e VideoPro."
        actions={
          <Button variant="primary" icon={<Plus size={14} />} onClick={() => setEditing('new')}>
            Nova Sequencia
          </Button>
        }
      />

      {state.musicSequences.length === 0 ? (
        <div className="ap-empty">
          Nenhuma sequencia cadastrada.<br />Clique em <strong>Nova Sequencia</strong> para comecar.
        </div>
      ) : (
        <div className="ap-card-list">
          {state.musicSequences.map(seq => (
            <div key={seq.id} className="ap-card">
              <div className="ap-card-body">
                <div className="ap-card-title">{seq.name}</div>
                <div className="ap-card-meta">
                  {seq.items.map(it => `${getStyleName(it)} x${it.count}`).join(' -> ')}
                </div>
                <div className="ap-card-meta" style={{ marginTop: 2 }}>
                  {seq.targetMode === 'count' ? `${seq.targetValue} itens` : `${seq.targetValue} min`}
                  {seq.noSameArtistWindow > 0 && ` - Janela artista: ${seq.noSameArtistWindow} audios`}
                  {(seq.maxSameDayArtistPlays ?? 0) > 0 && ` - Max ${seq.maxSameDayArtistPlays}/artista/dia`}
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
