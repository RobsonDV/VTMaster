import { useState, useCallback } from 'react'
import { Play, Square, SkipForward, Radio } from 'lucide-react'
import { useApp } from '../../store/AppContext'
import type { AudioLayer, AudioLayerCategory } from '../../types'
import Button from '../ui/Button'

// ── History item ─────────────────────────────────────────────────────────────
interface HistoryEntry { layerId: string; name: string; at: string }

const CATEGORY_CHIP: Record<AudioLayerCategory, string> = {
  vinheta: 'chip--blue',
  musica: 'chip--green',
  trilha: 'chip--purple',
  outros: 'chip--gray',
}
const CATEGORY_LABEL: Record<AudioLayerCategory, string> = {
  vinheta: 'Vinheta',
  musica: 'Música',
  trilha: 'Trilha',
  outros: 'Outros',
}

// ── Layer Card ────────────────────────────────────────────────────────────────

function LayerCard({
  layer,
  isPlaying,
  onTrigger,
  onStop,
  onAdvance,
}: {
  layer: AudioLayer
  isPlaying: boolean
  onTrigger: () => void
  onStop: () => void
  onAdvance: () => void
}) {
  const category = layer.category ?? 'outros'
  const isTrilha = category === 'trilha'
  const isLoop = (layer.playMode ?? 'once') === 'loop'

  const nextIndex = layer.sourceType === 'round_robin'
    ? layer.currentIndex % Math.max(layer.placeholders.length, 1)
    : 0
  const currentPlaceholder = layer.sourceType === 'round_robin' && layer.placeholders.length > 0
    ? layer.placeholders[nextIndex]
    : null

  const modeLabel = layer.defaultMode === 'parallel' ? 'Paralelo' : 'Substituir PGM'
  const sourceLabel = layer.sourceType === 'fixed_input'
    ? `Input fixo: ${layer.fixedInputName ?? '—'}`
    : `Round-robin · ${layer.placeholders.length} placeholder${layer.placeholders.length !== 1 ? 's' : ''}`

  return (
    <div className={`audiopro-control-card ${isPlaying ? 'audiopro-control-card--active' : ''}`}>
      <div className="audiopro-control-card-header">
        <div className="audiopro-control-card-title">
          <span className={`audiopro-status-dot ${isPlaying ? 'audiopro-status-dot--on' : ''}`} />
          <strong>{layer.name}</strong>
        </div>
        <div className="audiopro-control-card-meta">
          <span className={`chip ${CATEGORY_CHIP[category]}`} style={{ fontSize: 11 }}>{CATEGORY_LABEL[category]}</span>
          <span className="chip chip--blue" style={{ fontSize: 11 }}>{modeLabel}</span>
          {!isTrilha && (
            <span className="chip chip--gray" style={{ fontSize: 11 }}>{sourceLabel}</span>
          )}
          {layer.overlayChannel && (
            <span className="chip chip--green" style={{ fontSize: 11 }}>OVL {layer.overlayChannel}</span>
          )}
          {isPlaying && isLoop && (
            <span className="chip chip--amber" style={{ fontSize: 11 }}>⟳ loop</span>
          )}
        </div>
      </div>

      {!isTrilha && layer.sourceType === 'round_robin' && layer.placeholders.length > 0 && (
        <div className="audiopro-rr-indicator">
          {layer.placeholders.map((p, i) => (
            <div
              key={p.id}
              className={`audiopro-rr-dot ${i === nextIndex ? 'audiopro-rr-dot--current' : ''}`}
              title={p.name}
            />
          ))}
          <span className="ui-field-hint" style={{ marginLeft: 8, fontSize: 11 }}>
            Próximo: {currentPlaceholder?.name ?? '—'}
          </span>
        </div>
      )}

      {isTrilha && layer.placeholders.length > 0 && (
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
          {layer.placeholders[0].name}
        </div>
      )}

      <div className="audiopro-control-buttons">
        <Button
          variant="primary"
          size="sm"
          onClick={onTrigger}
          title="Disparar camada"
          style={{ gap: 5 }}
        >
          <Play size={13} />
          Disparar
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onStop}
          disabled={!isPlaying}
          title="Parar"
          style={{ gap: 5 }}
        >
          <Square size={13} />
          Parar
        </Button>
        {!isTrilha && layer.sourceType === 'round_robin' && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onAdvance}
            title="Avançar índice sem tocar"
            style={{ gap: 5 }}
          >
            <SkipForward size={13} />
            Próximo
          </Button>
        )}
      </div>
    </div>
  )
}

// ── Main Tab ──────────────────────────────────────────────────────────────────

export default function AudioControlTab() {
  const { state, dispatch, triggerAudioLayer, stopAudioLayer, audioLayerActive } = useApp()
  const [history, setHistory] = useState<HistoryEntry[]>([])

  const layers = state.audioLayers

  const handleTrigger = useCallback(async (layer: AudioLayer) => {
    await triggerAudioLayer(layer.id)
    const now = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    setHistory(prev => [
      { layerId: layer.id, name: layer.name, at: now },
      ...prev.slice(0, 9),
    ])
  }, [triggerAudioLayer])

  const handleStop = useCallback(async (layer: AudioLayer) => {
    await stopAudioLayer(layer.id)
  }, [stopAudioLayer])

  const handleAdvance = useCallback((layer: AudioLayer) => {
    if (layer.placeholders.length === 0) return
    const newIndex = (layer.currentIndex + 1) % layer.placeholders.length
    dispatch({ type: 'ADVANCE_AUDIO_LAYER_INDEX', payload: { layerId: layer.id, newIndex } })
  }, [dispatch])

  if (layers.length === 0) {
    return (
      <div className="ui-empty-state" style={{ padding: 24 }}>
        <Radio size={32} style={{ color: 'var(--text-muted)', marginBottom: 8 }} />
        <p>Nenhuma camada configurada.</p>
        <p className="ui-field-hint">Vá para a aba <strong>Camadas</strong> e crie uma camada de áudio.</p>
      </div>
    )
  }

  return (
    <div style={{ padding: '0 16px 16px' }}>
      <div className="audiopro-control-grid">
        {layers.map(layer => (
          <LayerCard
            key={layer.id}
            layer={layer}
            isPlaying={!!audioLayerActive[layer.id]}
            onTrigger={() => handleTrigger(layer)}
            onStop={() => handleStop(layer)}
            onAdvance={() => handleAdvance(layer)}
          />
        ))}
      </div>

      {history.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <h4 style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
            Histórico
          </h4>
          <table className="ui-table" style={{ fontSize: 12 }}>
            <tbody>
              {history.map((h, i) => (
                <tr key={i}>
                  <td style={{ color: 'var(--text-muted)', width: 80 }}>{h.at}</td>
                  <td>{h.name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
