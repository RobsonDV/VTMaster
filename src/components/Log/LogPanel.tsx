import { useEffect, useState } from 'react'
import { useApp } from '../../store/AppContext'
import { formatDate, formatDuration } from '../../utils/time'
import '../AdBreaks/AdBreaksPanel.css'

export default function LogPanel() {
  const { state, t } = useApp()
  const { playLog, clients } = state

  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo,   setFilterDateTo]   = useState('')
  const [filterClientId, setFilterClientId] = useState('')
  const [filterStatus,   setFilterStatus]   = useState('')
  const [filterTitle,    setFilterTitle]    = useState('')

  const [page, setPage] = useState(1)
  // Reset to page 1 whenever any filter changes
  useEffect(() => { setPage(1) }, [filterDateFrom, filterDateTo, filterClientId, filterStatus, filterTitle])

  const PAGE_SIZE = 100

  const hasFilter = filterDateFrom || filterDateTo || filterClientId || filterStatus || filterTitle

  const filtered = playLog.filter((log) => {
    if (filterDateFrom && log.date < filterDateFrom) return false
    if (filterDateTo   && log.date > filterDateTo)   return false
    if (filterClientId && log.clientId !== filterClientId) return false
    if (filterStatus   && log.status !== filterStatus) return false
    if (filterTitle    && !log.title.toLowerCase().includes(filterTitle.toLowerCase())) return false
    return true
  })

  const sorted = [...filtered].sort((a, b) => {
    const dateCompare = b.date.localeCompare(a.date)
    if (dateCompare !== 0) return dateCompare
    return b.actualTime.localeCompare(a.actualTime)
  })

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const paginated  = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const clearFilters = () => {
    setFilterDateFrom('')
    setFilterDateTo('')
    setFilterClientId('')
    setFilterStatus('')
    setFilterTitle('')
  }

  const exportCSV = () => {
    const header = [
      t.log.columns.date,
      t.log.columns.scheduledTime,
      t.log.columns.actualTime,
      t.log.columns.title,
      t.log.columns.client,
      t.log.columns.duration,
      t.log.columns.status,
      t.log.columns.input,
    ].join(';')

    const rows = sorted.map((l) =>
      [
        l.date,
        l.scheduledTime ?? '',
        l.actualTime,
        `"${l.title}"`,
        `"${l.clientName ?? ''}"`,
        l.duration,
        l.status,
        l.inputName ?? '',
      ].join(';')
    )

    const csv = [header, ...rows].join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `log-${filterDateFrom || filterDateTo || new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const statusColor: Record<string, string> = {
    aired:   'var(--success)',
    skipped: 'var(--warning)',
    error:   'var(--error)',
  }

  return (
    <div className="log-panel">
      <div className="panel-header">
        <h2>{t.log.title}</h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Title search */}
          <input
            type="text"
            value={filterTitle}
            onChange={(e) => setFilterTitle(e.target.value)}
            placeholder="Buscar título..."
            style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 5, padding: '4px 8px', color: 'var(--text-primary)', fontSize: '0.8rem', outline: 'none', width: 140 }}
          />
          {/* Date from */}
          <input
            type="date"
            value={filterDateFrom}
            onChange={(e) => setFilterDateFrom(e.target.value)}
            title="De"
            style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 5, padding: '4px 8px', color: 'var(--text-primary)', fontSize: '0.8rem', outline: 'none' }}
          />
          {/* Date to */}
          <input
            type="date"
            value={filterDateTo}
            onChange={(e) => setFilterDateTo(e.target.value)}
            title="Até"
            style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 5, padding: '4px 8px', color: 'var(--text-primary)', fontSize: '0.8rem', outline: 'none' }}
          />
          {/* Client */}
          <select
            value={filterClientId}
            onChange={(e) => setFilterClientId(e.target.value)}
            title={t.log.filterClient}
            style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 5, padding: '4px 8px', color: 'var(--text-primary)', fontSize: '0.8rem', outline: 'none' }}
          >
            <option value="">{t.common.all}</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          {/* Status */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            title="Status"
            style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 5, padding: '4px 8px', color: 'var(--text-primary)', fontSize: '0.8rem', outline: 'none' }}
          >
            <option value="">Todos status</option>
            <option value="aired">Aired</option>
            <option value="skipped">Skipped</option>
            <option value="error">Error</option>
          </select>
          {hasFilter && (
            <button className="btn-cancel-sm" onClick={clearFilters}>{t.log.clearFilter}</button>
          )}
          <button className="btn-primary-sm" onClick={exportCSV}>{t.log.exportCSV}</button>
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className="panel-empty">{t.log.empty}</div>
      ) : (
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
            <thead>
              <tr>
                {Object.values(t.log.columns).map((h) => (
                  <th key={h} style={{ textAlign: 'left', padding: '8px 10px', borderBottom: '1px solid var(--border)', color: 'var(--text-secondary)', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', position: 'sticky', top: 0, background: 'var(--bg-secondary)', whiteSpace: 'nowrap' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginated.map((log) => (
                <tr key={log.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '7px 10px', color: 'var(--text-secondary)', fontFamily: 'monospace', fontSize: '0.78rem' }}>{formatDate(log.date, state.settings.language)}</td>
                  <td style={{ padding: '7px 10px', fontFamily: 'monospace', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{log.scheduledTime ?? '—'}</td>
                  <td style={{ padding: '7px 10px', fontFamily: 'monospace', fontSize: '0.78rem', color: 'var(--text-primary)' }}>{log.actualTime}</td>
                  <td style={{ padding: '7px 10px', fontWeight: 500, color: 'var(--text-primary)' }}>{log.title}</td>
                  <td style={{ padding: '7px 10px', color: 'var(--text-secondary)' }}>{log.clientName ?? '—'}</td>
                  <td style={{ padding: '7px 10px', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>{formatDuration(log.duration)}</td>
                  <td style={{ padding: '7px 10px' }}>
                    <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', background: `color-mix(in srgb, ${statusColor[log.status] ?? 'gray'} 15%, transparent)`, color: statusColor[log.status] ?? 'gray' }}>
                      {log.status}
                    </span>
                  </td>
                  <td style={{ padding: '7px 10px', fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{log.inputName ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ padding: '8px 16px', borderTop: '1px solid var(--border)', fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <span>{t.common.total}: <strong style={{ color: 'var(--text-primary)' }}>{sorted.length}</strong></span>
        <span style={{ color: 'var(--success)' }}>aired: <strong>{sorted.filter((l) => l.status === 'aired').length}</strong></span>
        <span style={{ color: 'var(--warning)' }}>skipped: <strong>{sorted.filter((l) => l.status === 'skipped').length}</strong></span>
        <span style={{ color: 'var(--error)' }}>error: <strong>{sorted.filter((l) => l.status === 'error').length}</strong></span>
        {totalPages > 1 && (
          <span style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 4, padding: '2px 8px', color: 'var(--text-primary)', cursor: page === 1 ? 'default' : 'pointer', opacity: page === 1 ? 0.4 : 1 }}
            >‹</button>
            <span>{page} / {totalPages}</span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 4, padding: '2px 8px', color: 'var(--text-primary)', cursor: page === totalPages ? 'default' : 'pointer', opacity: page === totalPages ? 0.4 : 1 }}
            >›</button>
          </span>
        )}
      </div>
    </div>
  )
}
