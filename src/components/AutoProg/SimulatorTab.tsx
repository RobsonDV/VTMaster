// ─────────────────────────────────────────────────────────────────────────────
// SimulatorTab — Simulador de Grade Musical (Sub-fase 5D)
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react'
import { Play, Loader2, ChevronDown, ChevronRight, Clock, Music } from 'lucide-react'
import { useApp } from '../../store/AppContext'
import { simulateMusicDay } from '../../utils/autoprog'
import type { DayBlockResult } from '../../utils/autoprog'
import { buildAutoProgStyleSources } from '../../utils/autoprogStyles'
import { dateToLocalYmd } from '../../utils/time'
import Button from '../ui/Button'
import PageHeader from '../ui/PageHeader'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const DAY_NAMES = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

function fmtDuration(secs: number): string {
  if (!secs) return '–'
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return m >= 60
    ? `${Math.floor(m / 60)}h ${m % 60}m`
    : `${m}m ${s.toString().padStart(2, '0')}s`
}

// ─── Block Result Card ────────────────────────────────────────────────────────

function BlockCard({ result }: { result: DayBlockResult }) {
  const { state } = useApp()
  const [open, setOpen] = useState(false)
  const styleSources = buildAutoProgStyleSources({
    audioStyles: state.audioStyles,
    videoStyles: state.videoStyles,
    legacyMusicStyles: state.musicStyles,
  })

  const styleCountMap = new Map<string, number>()
  for (const t of result.tracks) {
    styleCountMap.set(t.styleId, (styleCountMap.get(t.styleId) ?? 0) + 1)
  }

  return (
    <div style={{
      border: '1px solid var(--border)',
      borderRadius: 8,
      overflow: 'hidden',
      background: 'var(--bg-secondary)',
    }}>
      {/* Header */}
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 14px', cursor: 'pointer',
          background: result.error ? 'color-mix(in srgb, #ef4444 8%, var(--bg-secondary))' : undefined,
        }}
        onClick={() => setOpen(o => !o)}
      >
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        {result.slotTime && (
          <span style={{ fontSize: 12, color: 'var(--text-secondary)', minWidth: 40 }}>
            {result.slotTime}
          </span>
        )}
        <span style={{ fontWeight: 600, fontSize: 13, flex: 1 }}>{result.slotTitle}</span>
        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
          {result.sequence.name}
        </span>
        <span style={{
          fontSize: 11,
          padding: '2px 7px',
          borderRadius: 10,
          background: 'var(--bg-tertiary, rgba(0,0,0,0.12))',
          color: 'var(--text-secondary)',
          minWidth: 60,
          textAlign: 'right',
        }}>
          {result.tracks.length} faixa{result.tracks.length !== 1 ? 's' : ''}
          {result.totalDuration > 0 ? ` · ${fmtDuration(result.totalDuration)}` : ''}
        </span>
      </div>

      {/* Error */}
      {result.error && (
        <div style={{ padding: '6px 14px', fontSize: 12, color: '#ef4444', background: 'color-mix(in srgb, #ef4444 6%, var(--bg-primary))' }}>
          {result.error}
        </div>
      )}

      {/* Style distribution pills */}
      {!open && styleCountMap.size > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, padding: '0 14px 10px' }}>
          {[...styleCountMap.entries()].map(([styleId, count]) => {
            const style = styleSources.find(s => s.id === styleId)
            return (
              <span key={styleId} style={{
                fontSize: 11, padding: '2px 7px', borderRadius: 10,
                background: style?.color ? `color-mix(in srgb, ${style.color} 15%, var(--bg-primary))` : 'var(--bg-tertiary)',
                color: style?.color ?? 'var(--text-secondary)',
                border: style?.color ? `1px solid color-mix(in srgb, ${style.color} 30%, transparent)` : '1px solid var(--border)',
              }}>
                {style?.name ?? styleId} × {count}
              </span>
            )
          })}
        </div>
      )}

      {/* Track list */}
      {open && result.tracks.length > 0 && (
        <div style={{ borderTop: '1px solid var(--border)' }}>
          {result.tracks.map((t, i) => {
            const style = styleSources.find(s => s.id === t.styleId && s.mediaType === t.mediaType)
            const isJingle = style?.isJingle
            return (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '6px 14px',
                borderBottom: i < result.tracks.length - 1 ? '1px solid var(--border-faint, rgba(0,0,0,0.06))' : undefined,
                background: isJingle ? 'color-mix(in srgb, var(--accent, #3b82f6) 4%, transparent)' : undefined,
              }}>
                <span style={{ fontSize: 11, color: 'var(--text-secondary)', minWidth: 22, textAlign: 'right' }}>
                  {i + 1}.
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: isJingle ? 600 : 400, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                    {t.title}
                  </div>
                  {t.artist && (
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{t.artist}</div>
                  )}
                </div>
                {style && (
                  <span style={{
                    fontSize: 10, padding: '1px 6px', borderRadius: 8,
                    background: style.color ? `color-mix(in srgb, ${style.color} 15%, var(--bg-primary))` : 'var(--bg-tertiary)',
                    color: style.color ?? 'var(--text-secondary)',
                    border: style.color ? `1px solid color-mix(in srgb, ${style.color} 30%, transparent)` : '1px solid var(--border)',
                    flexShrink: 0,
                  }}>
                    {isJingle ? '♪ ' : ''}{style.name}
                  </span>
                )}
                {t.duration && (
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)', minWidth: 38, textAlign: 'right', flexShrink: 0 }}>
                    {fmtDuration(t.duration)}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      )}

      {open && result.tracks.length === 0 && !result.error && (
        <div style={{ padding: '10px 14px', fontSize: 13, color: 'var(--text-secondary)', borderTop: '1px solid var(--border)' }}>
          Nenhuma faixa gerada. Verifique a configuração das pastas nos estilos.
        </div>
      )}
    </div>
  )
}

// ─── SimulatorTab ─────────────────────────────────────────────────────────────

export default function SimulatorTab() {
  const { state } = useApp()
  const [dayOfWeek, setDayOfWeek] = useState(() => new Date().getDay())
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<DayBlockResult[] | null>(null)
  const [error, setError] = useState('')

  const totalTracks   = results?.reduce((a, r) => a + r.tracks.length, 0) ?? 0
  const totalDuration = results?.reduce((a, r) => a + r.totalDuration, 0) ?? 0
  const blocksWithData = results?.filter(r => r.tracks.length > 0).length ?? 0

  const hasAssignments = state.autoBlocoAssignments.some(
    a => a.dayOfWeek === dayOfWeek && a.sequenceId !== null,
  )

  const handleSimulate = async () => {
    if (!window.spotmaster?.scanMusicFolder) {
      setError('Varredura de pastas não disponível (modo web).')
      return
    }
    setLoading(true)
    setError('')
    setResults(null)
    try {
      const today = new Date()
      // Avança a data alvo para cair no próximo dayOfWeek
      const diff = (dayOfWeek - today.getDay() + 7) % 7
      const targetDate = new Date(today)
      targetDate.setDate(today.getDate() + (diff === 0 ? 0 : diff))
      const dateStr = dateToLocalYmd(targetDate)

      const programSlots: import('../../types').ProgramSlot[] =
        state.weeklyGrid?.[dayOfWeek] ?? []
      const styleSources = buildAutoProgStyleSources({
        audioStyles: state.audioStyles,
        videoStyles: state.videoStyles,
        legacyMusicStyles: state.musicStyles,
      })

      const dayResults = await simulateMusicDay({
        dayOfWeek,
        assignments:  state.autoBlocoAssignments,
        sequences:    state.musicSequences,
        styles:       styleSources,
        programSlots,
        playLog:      state.playLog,
        date:         dateStr,
        scanFolder:   (p, subs) => window.spotmaster.scanMusicFolder(p, subs),
        scanVideoFolder: (p, subs) => window.spotmaster.scanVideoFolder(p, subs),
      })

      setResults(dayResults)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <PageHeader
        title="Simulador de Grade"
        subtitle="Prévia de todos os blocos musicais de um dia da semana"
        actions={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <select
              className="input"
              value={dayOfWeek}
              onChange={e => { setDayOfWeek(Number(e.target.value)); setResults(null) }}
              style={{ width: 'auto' }}
            >
              {DAY_NAMES.map((d, i) => (
                <option key={i} value={i}>{d}</option>
              ))}
            </select>
            <Button
              variant="primary"
              icon={loading
                ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                : <Play size={14} />
              }
              disabled={loading || !hasAssignments}
              onClick={handleSimulate}
              title={!hasAssignments ? 'Nenhum bloco musical configurado para este dia' : undefined}
            >
              {loading ? 'Simulando…' : 'Simular Dia'}
            </Button>
          </div>
        }
      />

      {error && (
        <div style={{
          marginBottom: 12, padding: '8px 14px',
          background: 'color-mix(in srgb, #ef4444 10%, var(--bg-secondary))',
          border: '1px solid color-mix(in srgb, #ef4444 30%, transparent)',
          borderRadius: 8, fontSize: 13, color: '#ef4444',
        }}>
          {error}
        </div>
      )}

      {/* Resumo */}
      {results !== null && (
        <div style={{
          display: 'flex', gap: 20, padding: '10px 14px',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderRadius: 8, marginBottom: 12,
          flexWrap: 'wrap',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            <Music size={14} style={{ color: 'var(--text-secondary)' }} />
            <strong>{totalTracks}</strong>
            <span style={{ color: 'var(--text-secondary)' }}>faixas em</span>
            <strong>{blocksWithData}</strong>
            <span style={{ color: 'var(--text-secondary)' }}>{blocksWithData === 1 ? 'bloco' : 'blocos'}</span>
          </div>
          {totalDuration > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
              <Clock size={14} style={{ color: 'var(--text-secondary)' }} />
              <span style={{ color: 'var(--text-secondary)' }}>duração total estimada:</span>
              <strong>{fmtDuration(totalDuration)}</strong>
            </div>
          )}
        </div>
      )}

      {/* Blocos */}
      {results !== null && results.length === 0 && (
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          color: 'var(--text-secondary)', gap: 8,
        }}>
          <Music size={40} strokeWidth={1} />
          <div style={{ fontSize: 15 }}>Nenhum bloco musical configurado para {DAY_NAMES[dayOfWeek]}.</div>
          <div style={{ fontSize: 13 }}>Configure atribuições na aba Blocos Musicais.</div>
        </div>
      )}

      {results === null && !loading && (
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          color: 'var(--text-secondary)', gap: 8,
        }}>
          <Play size={40} strokeWidth={1} />
          <div style={{ fontSize: 15 }}>Selecione um dia e clique em Simular Dia.</div>
          {!hasAssignments && (
            <div style={{ fontSize: 13 }}>
              Nenhum bloco musical configurado para {DAY_NAMES[dayOfWeek]}.
            </div>
          )}
        </div>
      )}

      {results !== null && results.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto', flex: 1 }}>
          {results.map((r, i) => (
            <BlockCard key={i} result={r} />
          ))}
        </div>
      )}
    </div>
  )
}
