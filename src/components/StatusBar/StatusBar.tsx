import { today, formatDuration } from '../../utils/time'
import { useApp } from '../../store/AppContext'
import { usePlaybackProgress } from '../../store/playbackProgress'
import './StatusBar.css'

export default function StatusBar() {
  const { state, t } = useApp()
  const { vmixStatus, playlist } = state
  const activeItemProgress = usePlaybackProgress()

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
  )
}
