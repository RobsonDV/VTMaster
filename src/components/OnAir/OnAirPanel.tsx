import { useEffect, useRef } from 'react'
import { Play, Square, SkipForward, Minimize2, AlertTriangle } from 'lucide-react'
import { useApp } from '../../store/AppContext'
import { usePlaybackProgress } from '../../store/playbackProgress'
import { formatDuration, today as todayLocal } from '../../utils/time'
import './OnAirPanel.css'

interface Props {
  onClose: () => void
}

function ProgressBar({ duration }: { duration: number }) {
  const progress = usePlaybackProgress()
  const hasReal = progress && progress.duration > 0
  const pct = hasReal
    ? Math.min(100, (progress!.position / progress!.duration) * 100)
    : 0
  const remaining = hasReal
    ? Math.max(0, Math.round((progress!.duration - progress!.position) / 1000))
    : duration

  return (
    <div className="oa-progress-wrap">
      <div className="oa-progress-track">
        <div className="oa-progress-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="oa-progress-label">
        {hasReal ? (
          <>
            <span>{formatDuration(Math.round(progress!.position / 1000))}</span>
            <span style={{ color: 'var(--danger, #ef4444)', fontWeight: 700 }}>−{formatDuration(remaining)}</span>
          </>
        ) : (
          <span>{formatDuration(duration)}</span>
        )}
      </div>
    </div>
  )
}

export default function OnAirPanel({ onClose }: Props) {
  const { state, startSequence, stopPlayback, skipToNext } = useApp()
  const { isSequencePlaying, dateSchedules } = state

  // Descobre a data ativa e a programação do dia corrente
  const activePanel = state.activePanel
  const today = todayLocal()

  // Pega os itens de hoje da programação agendada
  const todayItems = (dateSchedules[today] ?? [])
    .filter(i => i.status !== 'done' && i.status !== 'skipped')
    .sort((a, b) => (a.scheduledTime ?? '').localeCompare(b.scheduledTime ?? ''))

  const playlist = state.playlist.filter(i => i.status !== 'done' && i.status !== 'skipped')
  const items = activePanel === 'programacao' ? todayItems : playlist

  const nowItem = items.find(i => i.status === 'playing') ?? items[0] ?? null
  const nextItems = nowItem ? items.filter(i => i.id !== nowItem.id && i.status === 'pending').slice(0, 4) : items.filter(i => i.status === 'pending').slice(0, 4)

  const containerRef = useRef<HTMLDivElement>(null)

  // ESC fecha
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div className="oa-overlay" ref={containerRef}>
      <div className="oa-header">
        <div className="oa-live-badge" style={{ background: isSequencePlaying ? '#ef4444' : '#6b7280' }}>
          {isSequencePlaying ? '● AO VIVO' : '● PARADO'}
        </div>
        <div className="oa-station">{state.settings.stationName}</div>
        <button className="oa-close-btn" onClick={onClose} title="Fechar modo On Air (ESC)">
          <Minimize2 size={16} />
        </button>
      </div>

      <div className="oa-body">
        {/* Agora */}
        <div className="oa-now-section">
          <div className="oa-section-label">AGORA NO AR</div>
          {nowItem ? (
            <div className="oa-now-card">
              <div className="oa-now-title">{nowItem.title}</div>
              {nowItem.clientName && (
                <div className="oa-now-meta">{nowItem.clientName}</div>
              )}
              <div className="oa-now-meta">{nowItem.scheduledTime ? `Horário: ${nowItem.scheduledTime}` : ''} · {formatDuration(nowItem.duration)}</div>
              {nowItem.status === 'playing' && <ProgressBar duration={nowItem.duration} />}
            </div>
          ) : (
            <div className="oa-empty-card">
              <AlertTriangle size={20} />
              Nenhum item em reprodução
            </div>
          )}
        </div>

        {/* Controles grandes */}
        <div className="oa-controls">
          {!isSequencePlaying ? (
            <button
              className="oa-btn oa-btn-start"
              onClick={() => startSequence?.()}
              title="Iniciar programação"
            >
              <Play size={28} fill="currentColor" />
              <span>INICIAR</span>
            </button>
          ) : (
            <button
              className="oa-btn oa-btn-stop"
              onClick={() => stopPlayback?.()}
              title="Parar programação"
            >
              <Square size={28} fill="currentColor" />
              <span>PARAR</span>
            </button>
          )}

          <button
            className="oa-btn oa-btn-next"
            onClick={() => skipToNext?.()}
            disabled={!isSequencePlaying}
            title="Avançar para o próximo"
          >
            <SkipForward size={24} />
            <span>AVANÇAR</span>
          </button>
        </div>

        {/* Próximos itens */}
        {nextItems.length > 0 && (
          <div className="oa-next-section">
            <div className="oa-section-label">A SEGUIR</div>
            <div className="oa-next-list">
              {nextItems.map((item, idx) => (
                <div key={item.id} className="oa-next-card">
                  <div className="oa-next-index">{idx + 1}</div>
                  <div className="oa-next-info">
                    <div className="oa-next-title">{item.title}</div>
                    <div className="oa-next-meta">
                      {item.scheduledTime ?? ''}{item.clientName ? ` · ${item.clientName}` : ''} · {formatDuration(item.duration)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
