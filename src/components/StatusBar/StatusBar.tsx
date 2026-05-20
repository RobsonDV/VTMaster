import { useEffect, useState } from 'react'
import { today, formatDuration } from '../../utils/time'
import { useApp } from '../../store/AppContext'
import { usePlaybackProgress } from '../../store/playbackProgress'
import './StatusBar.css'

export default function StatusBar() {
  const { state, t, armedCommercial } = useApp()
  const { vmixStatus, playlist } = state
  const activeItemProgress = usePlaybackProgress()

  // ── Countdown do arming ────────────────────────────────────────────────
  // Tick a cada 1s pra atualizar o "em Xs" no banner enquanto o bloco está
  // armado. Sem isto o banner mostraria o tempo congelado de quando armou.
  const [nowTick, setNowTick] = useState(0)
  useEffect(() => {
    if (!armedCommercial) return
    const id = setInterval(() => setNowTick(t => t + 1), 1000)
    return () => clearInterval(id)
  }, [armedCommercial])
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
