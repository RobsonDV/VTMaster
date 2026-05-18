import { useState, useEffect, useRef, useCallback, useMemo, memo, Fragment } from 'react'
import { Play, ListVideo, Square, Edit2, Trash2, CheckCircle, SkipForward, ChevronUp, ChevronDown, FileVideo, Zap } from 'lucide-react'
import { useApp } from '../../store/AppContext'
import { usePlaybackProgress } from '../../store/playbackProgress'
import type { PlaylistItem, PlayLog, VmixInput, SpotType } from '../../types'
import { formatDuration, formatTime, now, today } from '../../utils/time'
import { spotTypeForVmix } from '../../utils/vmixInputs'
import ContextMenu, { type ContextMenuState } from './ContextMenu'
import './PlaylistTable.css'

interface PlaylistTableProps {
  onEditItem: (item: PlaylistItem) => void
  onInsertVmixAction?: (afterOrder: number) => void
  onInsertVmixInput?: (afterOrder: number) => void
  onEditSchedule?: (item: PlaylistItem) => void
  onSelectedItemChange?: (item: PlaylistItem | null) => void
}

// Célula de "tempo restante" do item tocando — consome progress isoladamente,
// para que linhas não-tocando não re-renderizem a cada tick de 500 ms.
function PlayingDurationCell({ duration }: { duration: number }) {
  const progress = usePlaybackProgress()
  if (!progress || progress.duration <= 0) return <>{formatDuration(duration)}</>
  const remaining = Math.max(0, Math.round((progress.duration - progress.position) / 1000))
  return (
    <span className="time-remaining" title={formatDuration(duration)}>
      −{formatDuration(remaining)}
    </span>
  )
}

// Linha de barra de progresso — consome progress isoladamente.
function PlayingProgressRow({ duration }: { duration: number }) {
  const progress = usePlaybackProgress()
  const hasReal = progress && progress.duration > 0
  return (
    <tr className="progress-bar-row">
      <td colSpan={10} className="progress-bar-cell">
        {hasReal ? (
          <div className="progress-track">
            <div
              className="progress-fill"
              style={{ width: `${Math.min(100, (progress!.position / progress!.duration) * 100)}%` }}
            />
            <span className="progress-label">
              {formatDuration(Math.round(progress!.position / 1000))}
              {' / '}
              {formatDuration(Math.round(progress!.duration / 1000))}
            </span>
          </div>
        ) : (
          <div className="progress-track">
            <div className="progress-fill progress-fill-anim" style={{ animationDuration: `${duration}s` }} />
            <span className="progress-label">{formatDuration(duration)}</span>
          </div>
        )}
      </td>
    </tr>
  )
}

interface PlaylistRowProps {
  item: PlaylistItem
  index: number
  isLast: boolean
  isSelected: boolean
  dragInsertAbove: boolean
  endTime: string | null | undefined
  t: ReturnType<typeof useApp>['t']
  onSelect: (id: string) => void
  onContextMenu: (e: React.MouseEvent, item: PlaylistItem, index: number) => void
  onRowDragOver: (e: React.DragEvent, index: number) => void
  onDrop: (e: React.DragEvent, atIndex: number) => void
  onDragLeave: (e: React.DragEvent) => void
  onMoveUp: (index: number) => void
  onMoveDown: (index: number) => void
  onPlay: (item: PlaylistItem) => void
  onMarkDone: (item: PlaylistItem) => void
  onSkip: (item: PlaylistItem) => void
  onEdit: (item: PlaylistItem) => void
  onDelete: (id: string) => void
}

const PlaylistRow = memo(function PlaylistRow({
  item, index, isLast, isSelected, dragInsertAbove, endTime, t,
  onSelect, onContextMenu, onRowDragOver, onDrop, onDragLeave,
  onMoveUp, onMoveDown, onPlay, onMarkDone, onSkip, onEdit, onDelete,
}: PlaylistRowProps) {
  const isAwaitingTrigger = !!item.adBreakId && item.status === 'pending'
  const isPlaying = item.status === 'playing'
  const cls = `playlist-row ${isSelected ? 'selected' : ''} row-${item.status}${dragInsertAbove ? ' drag-insert-above' : ''}${isAwaitingTrigger ? ' row-awaiting-trigger' : ''}${item.type === 'vmix_action' ? ' row-vmix-action' : ''}${item.adBreakId ? ' row-commercial' : ''}${item.type === 'programa' && !item.adBreakId ? ' row-programa' : ''}${item.mediaType === 'audio' && !item.adBreakId ? ' row-audio' : ''}${item.mediaType === 'video' && !item.adBreakId && item.type !== 'programa' ? ' row-video' : ''}`
  return (
    <Fragment>
      <tr
        className={cls}
        onClick={() => onSelect(item.id)}
        onContextMenu={(e) => onContextMenu(e, item, index)}
        onDragOver={(e) => onRowDragOver(e, index)}
        onDrop={(e) => onDrop(e, index)}
        onDragLeave={onDragLeave}
      >
        <td className="cell-order">
          <div className="order-group">
            <span className="order-num">{item.order}</span>
            <div className="order-btns">
              <button onClick={(e) => { e.stopPropagation(); onMoveUp(index) }} disabled={index === 0}><ChevronUp size={10} /></button>
              <button onClick={(e) => { e.stopPropagation(); onMoveDown(index) }} disabled={isLast}><ChevronDown size={10} /></button>
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
          {isPlaying ? <PlayingDurationCell duration={item.duration} /> : formatDuration(item.duration)}
        </td>

        <td className="cell-end">{endTime ?? '—'}</td>

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
              <button className="action-btn btn-play" onClick={(e) => { e.stopPropagation(); onPlay(item) }} title={t.playlist.playItem}>
                <Play size={13} />
              </button>
            )}
            {isPlaying && (
              <button className="action-btn btn-done" onClick={(e) => { e.stopPropagation(); onMarkDone(item) }} title={t.playlist.markDone}>
                <CheckCircle size={13} />
              </button>
            )}
            {(item.status === 'pending' || isPlaying) && (
              <button className="action-btn btn-skip" onClick={(e) => { e.stopPropagation(); onSkip(item) }} title={t.playlist.markSkipped}>
                <SkipForward size={13} />
              </button>
            )}
            <button className="action-btn btn-edit" onClick={(e) => { e.stopPropagation(); onEdit(item) }} title={t.playlist.editItem}>
              <Edit2 size={13} />
            </button>
            <button className="action-btn btn-delete" onClick={(e) => { e.stopPropagation(); onDelete(item.id) }} title={t.playlist.deleteItem}>
              <Trash2 size={13} />
            </button>
          </div>
        </td>
      </tr>

      {isPlaying && <PlayingProgressRow duration={item.duration} />}
    </Fragment>
  )
})

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

export default function PlaylistTable({ onEditItem, onInsertVmixAction, onInsertVmixInput, onEditSchedule, onSelectedItemChange }: PlaylistTableProps) {
  const { state, dispatch, t, playItem, playSingleItem, startSequence, stopPlayback, saveToStorage } = useApp()
  const { playlist, settings } = state
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const handleSelect = (id: string) => {
    const newId = id === selectedId ? null : id
    setSelectedId(newId)
    if (onSelectedItemChange) {
      onSelectedItemChange(newId ? playlist.find(i => i.id === newId) ?? null : null)
    }
  }
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)

  // Preview clock — ticks every 30s. Frequent ticks re-render every row every
  // second (memo can't help when endTime prop changes), causing CSS :hover to
  // flicker. 30s is accurate enough for end-time estimates in the playlist.
  const [nowSecs, setNowSecs] = useState(nowSeconds)
  useEffect(() => {
    const id = setInterval(() => setNowSecs(nowSeconds()), 30_000)
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
  const endTimes = useMemo(() => calcEndTimes(playlist, playAnchor ?? nowSecs), [playlist, playAnchor, nowSecs])
  const hasPending = playlist.some(i => i.status === 'pending')

  // ── Play single item ──
  const handlePlay = useCallback((item: PlaylistItem) => { playItem(item) }, [playItem])

  // ── Mark as done ──
  const handleMarkDone = useCallback((item: PlaylistItem) => {
    dispatch({ type: 'UPDATE_PLAYLIST_ITEM', payload: { ...item, status: 'done' } })
  }, [dispatch])

  // ── Skip item ──
  const handleSkip = useCallback((item: PlaylistItem) => {
    const log: PlayLog = {
      id: crypto.randomUUID(),
      date: today(),
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
  }, [dispatch])

  // ── Context menu ──
  const handleContextMenu = useCallback((e: React.MouseEvent, item: PlaylistItem, index: number) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, item, index })
  }, [])

  const handleInsertPause = (afterOrder: number) => {
    const pause: PlaylistItem = {
      id: crypto.randomUUID(),
      order: 0,
      title: 'Pausa automática',
      duration: 0,
      type: 'pause',
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
  const handleDelete = useCallback((id: string) => {
    dispatch({ type: 'DELETE_PLAYLIST_ITEM', payload: id })
    setSelectedId(prev => prev === id ? null : prev)
  }, [dispatch])

  // ── Reorder ──
  const moveItem = useCallback((index: number, dir: -1 | 1) => {
    const newList = [...playlist]
    const target = index + dir
    if (target < 0 || target >= newList.length) return
    ;[newList[index], newList[target]] = [newList[target], newList[index]]
    dispatch({ type: 'REORDER_PLAYLIST', payload: newList.map((item, i) => ({ ...item, order: i + 1 })) })
  }, [dispatch, playlist])
  const handleMoveUp = useCallback((index: number) => moveItem(index, -1), [moveItem])
  const handleMoveDown = useCallback((index: number) => moveItem(index, 1), [moveItem])

  // ── Drop vMix input into playlist at a specific position ──────────────────
  const insertVmixInput = useCallback((inp: VmixInput, atIndex: number) => {
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
  }, [dispatch, playlist])

  const ACCEPTED_TYPES = ['application/vmix-input', 'application/vtmaster-media', 'application/vtmaster-folder']

  const insertMediaAt = useCallback((payload: { title: string; filePath: string; mediaType: 'audio' | 'video'; itemType: string; duration: number }, atIndex: number) => {
    const newItem: PlaylistItem = {
      id: crypto.randomUUID(),
      order: 0,
      title: payload.title,
      type: payload.itemType as SpotType,
      filePath: payload.filePath,
      mediaType: payload.mediaType,
      duration: payload.duration,
      status: 'pending',
    }
    const sorted = [...playlist].sort((a, b) => a.order - b.order)
    sorted.splice(atIndex, 0, newItem)
    dispatch({ type: 'REORDER_PLAYLIST', payload: sorted.map((item, i) => ({ ...item, order: i + 1 })) })
  }, [dispatch, playlist])

  const handleRowDragOver = useCallback((e: React.DragEvent, _index: number) => {
    if (!ACCEPTED_TYPES.some(t => e.dataTransfer.types.includes(t))) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    setDragOverIndex(_index)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleDrop = useCallback((e: React.DragEvent, atIndex: number) => {
    e.preventDefault()
    setDragOverIndex(null)

    // ── vMix input ────────────────────────────────────────────────────────────
    const vmixRaw = e.dataTransfer.getData('application/vmix-input')
    if (vmixRaw) {
      try { insertVmixInput(JSON.parse(vmixRaw) as VmixInput, atIndex) } catch { /* ignore */ }
      return
    }

    // ── Arquivo de mídia individual ───────────────────────────────────────────
    const mediaRaw = e.dataTransfer.getData('application/vtmaster-media')
    if (mediaRaw) {
      try { insertMediaAt(JSON.parse(mediaRaw), atIndex) } catch { /* ignore */ }
      return
    }

    // ── Pasta → faixa aleatória ───────────────────────────────────────────────
    const folderRaw = e.dataTransfer.getData('application/vtmaster-folder')
    if (folderRaw && window.spotmaster) {
      void (async () => {
        try {
          const { folderPath, mediaType } = JSON.parse(folderRaw) as { folderPath: string; label: string; mediaType: 'audio' | 'video' }
          const results = mediaType === 'video'
            ? await window.spotmaster.scanVideoFolder(folderPath, true)
            : (await window.spotmaster.scanMusicFolder(folderPath, true)).map(r => ({ filePath: r.filePath, filename: r.filename }))
          if (results.length === 0) return
          const pick = results[Math.floor(Math.random() * results.length)]
          const noExtName = pick.filename.replace(/\.[^.]+$/, '')
          insertMediaAt({
            title: noExtName,
            filePath: pick.filePath,
            mediaType,
            itemType: mediaType === 'video' ? 'programa' : 'spot',
            duration: 0,
          }, atIndex)
        } catch { /* ignore */ }
      })()
    }
  }, [insertVmixInput, insertMediaAt])

  const handleRowDragLeave = useCallback((e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverIndex(null)
  }, [])

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
        <div
          className={`playlist-empty${dragOverIndex === 0 ? ' drag-insert-above' : ''}`}
          onDragOver={(e) => handleRowDragOver(e, 0)}
          onDrop={(e) => handleDrop(e, 0)}
          onDragLeave={() => setDragOverIndex(null)}
        >
          <p>{t.playlist.empty}</p>
          {dragOverIndex === 0 && (
            <p style={{ color: 'var(--accent)', fontWeight: 600, marginTop: 8 }}>Solte para adicionar</p>
          )}
        </div>
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
                {playlist.map((item, index) => (
                  <PlaylistRow
                    key={item.id}
                    item={item}
                    index={index}
                    isLast={index === playlist.length - 1}
                    isSelected={selectedId === item.id}
                    dragInsertAbove={dragOverIndex === index}
                    endTime={endTimes[item.id]}
                    t={t}
                    onSelect={handleSelect}
                    onContextMenu={handleContextMenu}
                    onRowDragOver={handleRowDragOver}
                    onDrop={handleDrop}
                    onDragLeave={handleRowDragLeave}
                    onMoveUp={handleMoveUp}
                    onMoveDown={handleMoveDown}
                    onPlay={handlePlay}
                    onMarkDone={handleMarkDone}
                    onSkip={handleSkip}
                    onEdit={onEditItem}
                    onDelete={handleDelete}
                  />
                ))}
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
