import { useApp } from '../../store/AppContext'
import './StatusBar.css'

export default function StatusBar() {
  const { state, t } = useApp()
  const { vmixStatus, playlist } = state

  const currentItem = playlist.find((i) => i.status === 'playing')
  const pendingItems = playlist.filter((i) => i.status === 'pending')
  const nextItem = pendingItems[0]

  return (
    <footer className="status-bar">
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
      </div>

      {/* Divider */}
      <div className="status-divider" />

      {/* Current item */}
      <div className="status-item">
        <span className="status-label">{t.statusBar.current}:</span>
        <span className="status-value">
          {currentItem ? (
            <><span className="playing-dot" />{currentItem.title}</>
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

      {/* Playlist summary */}
      <div className="status-right">
        <span className="status-summary">
          {playlist.length} {t.playlist.itemCount}
          {' · '}
          {playlist.filter((i) => i.status === 'done').length} {t.statuses.done.toLowerCase()}
        </span>
      </div>
    </footer>
  )
}
