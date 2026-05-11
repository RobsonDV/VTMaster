import { useState, useEffect, useRef, Fragment } from 'react'
import { Play, ListVideo, Square, Edit2, Trash2, CheckCircle, SkipForward, ChevronUp, ChevronDown, FileVideo, Zap } from 'lucide-react'
import { useApp } from '../../store/AppContext'
import type { PlaylistItem, PlayLog, VmixInput, SpotType } from '../../types'
import { formatDuration, formatTime, now } from '../../utils/time'
import { spotTypeForVmix } from './VmixInputPanel'
import ContextMenu, { type ContextMenuState } from './ContextMenu'
import './PlaylistTable.css'

interface PlaylistTableProps {
  onEditItem: (item: PlaylistItem) => void
  onInsertVmixAction?: (afterOrder: number) => void
  onInsertVmixInput?: (afterOrder: number) => void
  onEditSchedule?: (item: PlaylistItem) => void
}

const STATUS_CLASS: Record<string, string> = {
  pending: 'status-pending',
  playing: 'status-playing',
  done: 'status-done',
  skipped: 'status-skipped',
  error: 'status-error',
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function nowSeconds(): number {
  const d = new Date()
  return d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds()
}

function secsToHHMMSS(s: number): string {
  const h = Math.floor(s / 3600) % 24
  const m = Math.floor((s % 3600) / 60)
  const ss = Math.floor(s % 60)
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(ss).padStart(2,'0')}`
}

// Calculate end time per item.
// Cursor starts from the current clock (live), or from scheduledTime when provided.
// Done/skipped items are excluded from the chain.
function calcEndTimes(
  playlist: PlaylistItem[],
  nowSecs: number,
): Record<string, string | null> {
  const result: Record<string, string | null> = {}
  const sorted = [...playlist].sort((a, b) => a.order - b.order)
  let cursor = nowSecs

  for (const item of sorted) {
    if (item.status === 'done' || item.status === 'skipped') {
      result[item.id] = null
      continue
    }
    // Anchor to a scheduled time if one is set for this item
    if (item.scheduledTime) {
      const [h = 0, m = 0, s = 0] = item.scheduledTime.split(':').map(Number)
      cursor = h * 3600 + m * 60 + s
    }
    cursor += item.duration
    result[item.id] = secsToHHMMSS(cursor)
  }
  return result
}

export default function PlaylistTable({ onEditItem, onInsertVmixAction, onInsertVmixInput, onEditSchedule }: PlaylistTableProps) {
  const { state, dispatch, t, playItem, playSingleItem, startSequence, stopPlayback, saveToStorage } = useApp()
  const { playlist, settings } = state
  const { activeItemProgress } = state
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)

  // Live preview clock — ticks every second ONLY when not playing
  const [nowSecs, setNowSecs] = useState(nowSeconds)
  useEffect(() => {
    const id = setInterval(() => setNowSecs(nowSeconds()), 1000)
    return () => clearInterval(id)
  }, [])

  // When sequence starts, freeze Término at the exact play-start time.
  // When stopped, reset to null so the column goes back to live preview.
  const [playAnchor, setPlayAnchor] = useState<number | null>(null)
  const prevPlayingRef = useRef(false)
  useEffect(() => {
    if (state.isSequencePlaying && !prevPlayingRef.current) {
      setPlayAnchor(nowSeconds()) // freeze: "started at HH:MM:SS"
    } else if (!state.isSequencePlaying && prevPlayingRef.current) {
      setPlayAnchor(null) // release: back to live preview
    }
    prevPlayingRef.current = state.isSequencePlaying
  }, [state.isSequencePlaying])

  // Use frozen anchor when playing, otherwise live clock
  const endTimes = calcEndTimes(playlist, playAnchor ?? nowSecs)
  const hasPending = playlist.some(i => i.status === 'pending')

  // ── Play single item ──
  const handlePlay = (item: PlaylistItem) => playItem(item)

  // ── Mark as done ──
  const handleMarkDone = (item: PlaylistItem) => {
    dispatch({ type: 'UPDATE_PLAYLIST_ITEM', payload: { ...item, status: 'done' } })
  }

  // ── Skip item ──
  const handleSkip = (item: PlaylistItem) => {
    const log: PlayLog = {
      id: crypto.randomUUID(),
      date: new Date().toISOString().slice(0, 10),
      itemId: item.id,
      title: item.title,
      clientId: item.clientId,
      clientName: item.clientName,
      scheduledTime: item.scheduledTime,
      actualTime: now(),
      duration: item.duration,
      status: 'skipped',
    }
    dispatch({ type: 'ADD_LOG', payload: log })
    dispatch({ type: 'UPDATE_PLAYLIST_ITEM', payload: { ...item, status: 'skipped' } })
  }

  // ── Context menu ──
  const handleContextMenu = (e: React.MouseEvent, item: PlaylistItem, index: number) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, item, index })
  }

  const handleInsertPause = (afterOrder: number) => {
    const pause: PlaylistItem = {
      id: crypto.randomUUID(),
      order: 0,
      title: 'Pausa',
      duration: 5,
      type: 'outros',
      status: 'pending',
    }
    dispatch({ type: 'INSERT_PLAYLIST_ITEM_AFTER', payload: { item: pause, afterOrder } })
  }

  const handleDuplicate = (item: PlaylistItem, afterOrder: number) => {
    const copy: PlaylistItem = {
      ...item,
      id: crypto.randomUUID(),
      order: 0,
      status: 'pending',
      title: `${item.title} (cópia)`,
    }
    dispatch({ type: 'INSERT_PLAYLIST_ITEM_AFTER', payload: { item: copy, afterOrder } })
  }

  // ── Delete ──
  const handleDelete = (id: string) => {
    dispatch({ type: 'DELETE_PLAYLIST_ITEM', payload: id })
    if (selectedId === id) setSelectedId(null)
  }

  // ── Reorder ──
  const moveItem = (index: number, dir: -1 | 1) => {
    const newList = [...playlist]
    const target = index + dir
    if (target < 0 || target >= newList.length) return
    ;[newList[index], newList[target]] = [newList[target], newList[index]]
    dispatch({ type: 'REORDER_PLAYLIST', payload: newList.map((item, i) => ({ ...item, order: i + 1 })) })
  }

  // ── Drop vMix input into playlist at a specific position ──────────────────
  const insertVmixInput = (inp: VmixInput, atIndex: number) => {
    const newItem: PlaylistItem = {
      id: crypto.randomUUID(),
      order: 0,
      title: inp.title || `Input ${inp.number}`,
      type: spotTypeForVmix(inp.type) as SpotType,
      duration: inp.duration > 0 ? Math.round(inp.duration / 1000) : 30,
      status: 'pending',
      inputName: inp.number,
    }
    const sorted = [...playlist].sort((a, b) => a.order - b.order)
    sorted.splice(atIndex, 0, newItem)
    dispatch({ type: 'REORDER_PLAYLIST', payload: sorted.map((item, i) => ({ ...item, order: i + 1 })) })
  }

  const handleRowDragOver = (e: React.DragEvent, index: number) => {
    if (!e.dataTransfer.types.includes('application/vmix-input')) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    setDragOverIndex(index)
  }

  const handleDrop = (e: React.DragEvent, atIndex: number) => {
    e.preventDefault()
    setDragOverIndex(null)
    const raw = e.dataTransfer.getData('application/vmix-input')
    if (!raw) return
    try { insertVmixInput(JSON.parse(raw) as VmixInput, atIndex) } catch {}
  }

  const totalDuration = playlist.reduce((acc, i) => acc + i.duration, 0)

  return (
    <div className="playlist-wrapper">

      {/* ── Transport Controls ── */}
      <div className="playlist-controls">
        <div className="ctrl-group">
          {!state.isSequencePlaying ? (
            <>
              {/* ▶ Play: roda apenas o primeiro item pendente */}
              <button
                className="ctrl-btn ctrl-play-single"
                onClick={playSingleItem}
                disabled={!hasPending}
                title={t.playlist.playSingle}
              >
                <Play size={14} fill="currentColor" />
                <span>{t.playlist.playSingle}</span>
              </button>

              {/* ▶▶ Playlist: roda todos os itens pendentes até o fim */}
              <button
                className="ctrl-btn ctrl-play"
                onClick={startSequence}
                disabled={!hasPending}
                title={t.playlist.playSequence}
              >
                <ListVideo size={14} />
                <span>{t.playlist.playSequence}</span>
              </button>
            </>
          ) : (
            <button
              className="ctrl-btn ctrl-stop"
              onClick={stopPlayback}
              title={t.playlist.stopPlayback}
            >
              <Square size={14} fill="currentColor" />
              <span>{t.playlist.stopPlayback}</span>
            </button>
          )}
          {state.isSequencePlaying && (
            <span className="ctrl-playing-badge">
              <span className="ctrl-dot" />
              {t.playlist.playing}
            </span>
          )}
        </div>

        <div className="ctrl-sep" />

        <label className="ctrl-autoplay">
          <input
            type="checkbox"
            checked={settings.autoPlay}
            onChange={(e) => {
              const updated = { ...settings, autoPlay: e.target.checked }
              dispatch({ type: 'SET_SETTINGS', payload: updated })
              saveToStorage('settings', updated)
            }}
          />
          <span>{t.playlist.autoPlayScheduled}</span>
        </label>
      </div>

      {playlist.length === 0 ? (
        <div className="playlist-empty"><p>{t.playlist.empty}</p></div>
      ) : (
        <>
          <div className="playlist-scroll">
            <table className="playlist-table">
              <thead>
                <tr>
                  <th style={{ width: 36 }}>{t.playlist.columns.order}</th>
                  <th style={{ width: 75 }}>{t.playlist.columns.time}</th>
                  <th>{t.playlist.columns.title}</th>
                  <th style={{ width: 130 }}>{t.playlist.columns.client}</th>
                  <th style={{ width: 75 }}>{t.playlist.columns.type}</th>
                  <th style={{ width: 65 }}>{t.playlist.columns.duration}</th>
                  <th style={{ width: 70 }}>{t.playlist.columns.endTime}</th>
                  <th style={{ width: 140 }}>{t.playlist.columns.input}</th>
                  <th style={{ width: 85 }}>{t.playlist.columns.status}</th>
                  <th style={{ width: 120 }}>{t.playlist.columns.actions}</th>
                </tr>
              </thead>
              <tbody>
                {playlist.map((item, index) => {
                  const isAwaitingTrigger =
                    !!item.adBreakId &&
                    item.status === 'pending' &&
                    !settings.autoplayComerciais
                  return (
                  <Fragment key={item.id}>
                  <tr
                    className={`playlist-row ${selectedId === item.id ? 'selected' : ''} row-${item.status}${dragOverIndex === index ? ' drag-insert-above' : ''}${isAwaitingTrigger ? ' row-awaiting-trigger' : ''}${item.type === 'vmix_action' ? ' row-vmix-action' : ''}`}
                    onClick={() => setSelectedId(item.id)}
                    onContextMenu={(e) => handleContextMenu(e, item, index)}
                    onDragOver={(e) => handleRowDragOver(e, index)}
                    onDrop={(e) => handleDrop(e, index)}
                    onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverIndex(null) }}
                  >
                    {/* Order + reorder */}
                    <td className="cell-order">
                      <div className="order-group">
                        <span className="order-num">{item.order}</span>
                        <div className="order-btns">
                          <button onClick={(e) => { e.stopPropagation(); moveItem(index, -1) }} disabled={index === 0}><ChevronUp size={10} /></button>
                          <button onClick={(e) => { e.stopPropagation(); moveItem(index, 1) }} disabled={index === playlist.length - 1}><ChevronDown size={10} /></button>
                        </div>
                      </div>
                    </td>

                    <td className="cell-time">{item.scheduledTime ?? '—'}</td>

                    <td className="cell-title">
                      <div className="title-cell">
                        {item.type === 'vmix_action'
                          ? <Zap size={12} className="file-icon" style={{ color: '#a78bfa' }} />
                          : item.filePath && <FileVideo size={12} className="file-icon" />
                        }
                        <span className="item-title">{item.title}</span>
                      </div>
                      {item.vmixAction && (
                        <span className="item-notes" style={{ fontFamily: 'monospace', fontSize: '0.68rem' }}>
                          {item.vmixAction.function}
                          {item.vmixAction.input ? ` → ${item.vmixAction.input}` : ''}
                          {item.vmixAction.value ? ` (${item.vmixAction.value})` : ''}
                        </span>
                      )}
                      {!item.vmixAction && item.notes && <span className="item-notes">{item.notes}</span>}
                    </td>

                    <td className="cell-client">{item.clientName ?? '—'}</td>

                    <td>
                      <span className={`type-badge type-${item.type}`}>{t.types[item.type]}</span>
                    </td>

                    <td className="cell-duration">
                      {item.status === 'playing' && activeItemProgress && activeItemProgress.duration > 0
                        ? (
                          <span className="time-remaining" title={formatDuration(item.duration)}>
                            −{formatDuration(Math.max(0, Math.round((activeItemProgress.duration - activeItemProgress.position) / 1000)))}
                          </span>
                        )
                        : formatDuration(item.duration)
                      }
                    </td>

                    <td className="cell-end">{endTimes[item.id] ?? '—'}</td>

                    <td className="cell-input">
                      {item.filePath
                        ? <span className="input-auto-tag" title={item.filePath}>📁 Auto</span>
                        : (item.inputName ?? '—')}
                    </td>

                    <td>
                      {isAwaitingTrigger ? (
                        <span className="status-badge status-awaiting-trigger" title={t.adBreaks.awaitingTrigger}>
                          ⚡ {t.adBreaks.awaitingTrigger}
                        </span>
                      ) : (
                        <span className={`status-badge ${STATUS_CLASS[item.status]}`}>
                          {t.statuses[item.status]}
                        </span>
                      )}
                    </td>

                    <td className="cell-actions">
                      <div className="actions-group">
                        {item.status === 'pending' && (
                          <button className="action-btn btn-play" onClick={(e) => { e.stopPropagation(); handlePlay(item) }} title={t.playlist.playItem}>
                            <Play size={13} />
                          </button>
                        )}
                        {item.status === 'playing' && (
                          <button className="action-btn btn-done" onClick={(e) => { e.stopPropagation(); handleMarkDone(item) }} title={t.playlist.markDone}>
                            <CheckCircle size={13} />
                          </button>
                        )}
                        {(item.status === 'pending' || item.status === 'playing') && (
                          <button className="action-btn btn-skip" onClick={(e) => { e.stopPropagation(); handleSkip(item) }} title={t.playlist.markSkipped}>
                            <SkipForward size={13} />
                          </button>
                        )}
                        <button className="action-btn btn-edit" onClick={(e) => { e.stopPropagation(); onEditItem(item) }} title={t.playlist.editItem}>
                          <Edit2 size={13} />
                        </button>
                        <button className="action-btn btn-delete" onClick={(e) => { e.stopPropagation(); handleDelete(item.id) }} title={t.playlist.deleteItem}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>

                  {/* Progress bar row — shown below the playing item */}
                  {item.status === 'playing' && (
                    <tr className="progress-bar-row">
                      <td colSpan={10} className="progress-bar-cell">
                        {activeItemProgress && activeItemProgress.duration > 0 ? (
                          // Real vMix position
                          <div className="progress-track">
                            <div
                              className="progress-fill"
                              style={{ width: `${Math.min(100, (activeItemProgress.position / activeItemProgress.duration) * 100)}%` }}
                            />
                            <span className="progress-label">
                              {formatDuration(Math.round(activeItemProgress.position / 1000))}
                              {' / '}
                              {formatDuration(Math.round(activeItemProgress.duration / 1000))}
                            </span>
                          </div>
                        ) : (
                          // Fallback: CSS animation over item.duration seconds
                          <div className="progress-track">
                            <div
                              className="progress-fill progress-fill-anim"
                              style={{ animationDuration: `${item.duration}s` }}
                            />
                            <span className="progress-label">{formatDuration(item.duration)}</span>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                  </Fragment>
                  )
                })}
                {/* Drop zone for inserting after the last item */}
                <tr
                  className={`playlist-drop-end${dragOverIndex === playlist.length ? ' drag-insert-above' : ''}`}
                  onDragOver={(e) => handleRowDragOver(e, playlist.length)}
                  onDrop={(e) => handleDrop(e, playlist.length)}
                  onDragLeave={() => setDragOverIndex(null)}
                >
                  <td colSpan={10} />
                </tr>
              </tbody>
            </table>
          </div>

          <div className="playlist-footer">
            <span>{playlist.length} {t.playlist.itemCount}</span>
            <span className="footer-sep">·</span>
            <span>{t.playlist.totalDuration}: <strong>{formatTime(totalDuration)}</strong></span>
            <span className="footer-sep">·</span>
            <span style={{ color: 'var(--success)' }}>{playlist.filter(i => i.status === 'done').length} {t.statuses.done.toLowerCase()}</span>
            <span className="footer-sep">·</span>
            <span style={{ color: 'var(--warning)' }}>{playlist.filter(i => i.status === 'pending').length} {t.statuses.pending.toLowerCase()}</span>
          </div>
        </>
      )}

      {/* ── Menu de contexto (botão direito) ── */}
      {contextMenu && (
        <ContextMenu
          menu={contextMenu}
          onClose={() => setContextMenu(null)}
          onInsertPause={handleInsertPause}
          onInsertVmixAction={(afterOrder) => {
            setContextMenu(null)
            onInsertVmixAction?.(afterOrder)
          }}
          onInsertVmixInput={(afterOrder) => {
            setContextMenu(null)
            onInsertVmixInput?.(afterOrder)
          }}
          onEditSchedule={(item) => {
            setContextMenu(null)
            onEditSchedule?.(item)
          }}
          onDuplicate={handleDuplicate}
          onSkip={handleSkip}
          onMarkDone={handleMarkDone}
        />
      )}
    </div>
  )
}
