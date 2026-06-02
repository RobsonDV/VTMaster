import { useEffect, useState } from 'react'
import { today, formatDuration } from '../../utils/time'
import { useApp } from '../../store/AppContext'
import { usePlaybackProgress } from '../../store/playbackProgress'
import './StatusBar.css'

export default function StatusBar() {
  const { state, t, armedCommercial } = useApp()
  const { vmixStatus, playlist } = state
  const activeItemProgress = usePlaybackProgress()

  // ── Countdown do arming / Autostart ─────────────────────────────────────
  // Tick a cada 1s pra atualizar o "em Xs" enquanto há um bloco armado OU
  // enquanto o Autostart (idle) aguarda o horário do 1º item. Sem isto o
  // contador mostraria o tempo congelado.
  const autoStartEnabled = state.settings.autoStart
  const [nowTick, setNowTick] = useState(0)
  useEffect(() => {
    if (!armedCommercial && !autoStartEnabled) return
    const id = setInterval(() => setNowTick(t => t + 1), 1000)
    return () => clearInterval(id)
  }, [armedCommercial, autoStartEnabled])
  const armedSecondsLeft = (() => {
    if (!armedCommercial) return null
    const [fH, fM, fS] = armedCommercial.fireAt.split(':').map(Number)
    const fireSec = fH * 3600 + fM * 60 + (fS ?? 0)
    const d = new Date()
    const nowSec = d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds()
    return Math.max(0, fireSec - nowSec)
  })()
  void nowTick  // só pra re-render a cada segundo

  const todaySchedule = state.dateSchedules?.[today()] ?? []

  // ── Countdown do Autostart (idle) ───────────────────────────────────────
  // Quando parado + Autostart ON, mostra o próximo bloco que o Autostart vai
  // honrar e quanto falta. Blocos vencidos há mais de 5 min (janela de
  // tolerância) são IGNORADOS aqui — não vão disparar, então não fazemos
  // contagem para eles; mostramos o próximo bloco elegível.
  const AUTOSTART_TOLERANCE_SEC = 5 * 60
  const autostartInfo = (() => {
    if (!autoStartEnabled) return null
    if (todaySchedule.some(i => i.status === 'playing')) return null  // já tocando
    const d = new Date()
    const nowSec = d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds()
    const toSec = (hhmmss: string) => {
      const [h, m, s] = hhmmss.split(':').map(Number)
      return h * 3600 + m * 60 + (s ?? 0)
    }
    // Elegível: bloco futuro OU vencido há no máximo 5 min (ainda na janela).
    const first = todaySchedule
      .filter(i => i.status === 'pending' && !!i.scheduledTime)
      .filter(i => toSec(i.scheduledTime!) + AUTOSTART_TOLERANCE_SEC >= nowSec)
      .sort((a, b) => (a.scheduledTime ?? '').localeCompare(b.scheduledTime ?? ''))[0]
    if (!first?.scheduledTime) return null
    return { fireAt: first.scheduledTime.slice(0, 5), secondsLeft: Math.max(0, toSec(first.scheduledTime) - nowSec) }
  })()

  // Active queue: whichever has a 'playing' item takes precedence
  const scheduleCurrentItem = todaySchedule.find((i) => i.status === 'playing')
  const playlistCurrentItem = playlist.find((i) => i.status === 'playing')
  const currentItem = scheduleCurrentItem ?? playlistCurrentItem

  // Next item from the same active queue, sorted by order
  const isScheduleActive = !!scheduleCurrentItem
  const activeItems = isScheduleActive ? todaySchedule : playlist
  const pendingItems = [...activeItems.filter((i) => i.status === 'pending')]
    .sort((a, b) => a.order - b.order)
  const nextItem = pendingItems[0]

  const isPlaying = !!currentItem

  // Progress percentage (0–100) from vMix fast poll
  const progressPct = activeItemProgress && activeItemProgress.duration > 0
    ? Math.min(100, (activeItemProgress.position / activeItemProgress.duration) * 100)
    : null

  // Remaining seconds for the countdown display
  const remaining = activeItemProgress && activeItemProgress.duration > 0
    ? Math.max(0, Math.round((activeItemProgress.duration - activeItemProgress.position) / 1000))
    : null

  return (
    <>
      {armedCommercial && armedSecondsLeft !== null && (
        <div
          style={{
            position: 'fixed',
            bottom: isPlaying ? 64 : 56,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1000,
            background: 'linear-gradient(90deg, color-mix(in srgb, #f59e0b 35%, transparent), color-mix(in srgb, #f59e0b 18%, transparent))',
            border: '1px solid #f59e0b',
            borderRadius: 8,
            padding: '6px 14px',
            fontSize: '0.85rem',
            fontWeight: 600,
            color: '#fbbf24',
            boxShadow: '0 4px 12px rgba(245, 158, 11, 0.4)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            pointerEvents: 'none',
            letterSpacing: '0.3px',
          }}
        >
          <span style={{ fontSize: '1.1rem' }}>🎯</span>
          <span>
            BLOCO <strong style={{ color: '#fff' }}>{armedCommercial.blockName}</strong>
            {' '}@<strong style={{ color: '#fff' }}>{armedCommercial.fireAt.slice(0, 5)}</strong>
            {' '}ARMADO
            <span style={{ marginLeft: 8, color: '#fcd34d', fontVariantNumeric: 'tabular-nums' }}>
              em {armedSecondsLeft}s
            </span>
          </span>
        </div>
      )}
      {!armedCommercial && autostartInfo && !isPlaying && (
        <div
          style={{
            position: 'fixed',
            bottom: 56,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1000,
            background: 'linear-gradient(90deg, color-mix(in srgb, #22c55e 32%, transparent), color-mix(in srgb, #22c55e 16%, transparent))',
            border: '1px solid #22c55e',
            borderRadius: 8,
            padding: '6px 14px',
            fontSize: '0.85rem',
            fontWeight: 600,
            color: '#86efac',
            boxShadow: '0 4px 12px rgba(34, 197, 94, 0.4)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            pointerEvents: 'none',
            letterSpacing: '0.3px',
          }}
        >
          <span style={{ fontSize: '1.1rem' }}>⏱</span>
          <span>
            AUTOSTART @<strong style={{ color: '#fff' }}>{autostartInfo.fireAt}</strong>
            <span style={{ marginLeft: 8, color: '#bbf7d0', fontVariantNumeric: 'tabular-nums' }}>
              {autostartInfo.secondsLeft > 0 ? `em ${autostartInfo.secondsLeft}s` : 'iniciando…'}
            </span>
          </span>
        </div>
      )}
    <footer className={`status-bar${isPlaying ? ' is-playing' : ''}`}>
      <div className="statusbar-main">
        {/* vMix status */}
        <div className={`status-vmix ${vmixStatus.connected ? 'connected' : 'disconnected'}`}>
          <span className="status-dot" />
          <span>
            {vmixStatus.connected
              ? `${t.statusBar.vmixConnected}${vmixStatus.edition ? ` · ${vmixStatus.edition}` : ''}`
              : t.statusBar.vmixDisconnected}
          </span>
          {vmixStatus.connected && vmixStatus.recording && (
            <span className="status-badge recording">{t.statusBar.recording}</span>
          )}
          {vmixStatus.connected && vmixStatus.streaming && (
            <span className="status-badge streaming">{t.statusBar.streaming}</span>
          )}
          {vmixStatus.connected && vmixStatus.external && (
            <span className="status-badge external">EXT</span>
          )}
          {vmixStatus.connected && vmixStatus.fadeToBlack && (
            <span className="status-badge ftb">FTB</span>
          )}
          {vmixStatus.connected && vmixStatus.srtOutput && (
            <span className="status-badge srt">SRT</span>
          )}
        </div>

        <div className="status-divider" />

        {/* Current item — ON AIR badge + title + countdown */}
        <div className="status-item">
          {isPlaying
            ? <span className="on-air-badge">◉ ON AIR</span>
            : <span className="status-label">{t.statusBar.current}:</span>
          }
          <span className="status-value">
            {currentItem ? (
              <>
                <span className="current-title">{currentItem.title}</span>
                {remaining !== null && (
                  <span className="on-air-countdown">−{formatDuration(remaining)}</span>
                )}
              </>
            ) : (
              <span className="status-empty">{t.statusBar.nothing}</span>
            )}
          </span>
        </div>

        <div className="status-divider" />

        {/* Next item */}
        <div className="status-item">
          <span className="status-label">{t.statusBar.next}:</span>
          <span className="status-value">
            {nextItem ? nextItem.title : <span className="status-empty">{t.statusBar.nothing}</span>}
          </span>
        </div>

        {/* Queue summary */}
        <div className="status-right">
          <span className="status-summary">
            {activeItems.length} {t.playlist.itemCount}
            {' · '}
            {activeItems.filter((i) => i.status === 'done').length} {t.statuses.done.toLowerCase()}
          </span>
        </div>
      </div>

      {/* Full-width progress bar pinned to bottom edge of StatusBar */}
      {isPlaying && (
        <div className="statusbar-progress-track">
          {progressPct !== null ? (
            <div className="statusbar-progress-fill" style={{ width: `${progressPct}%` }} />
          ) : (
            <div className="statusbar-progress-fill statusbar-progress-anim" />
          )}
        </div>
      )}
    </footer>
    </>
  )
}
