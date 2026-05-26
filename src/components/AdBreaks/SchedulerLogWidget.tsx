import { useState, useCallback } from 'react'
import { ChevronDown, ChevronUp, RefreshCw, Download, Trash2 } from 'lucide-react'
import { useApp, type SchedulerLogEntry } from '../../store/AppContext'
import { today } from '../../utils/time'
import Button from '../ui/Button'

export default function SchedulerLogWidget() {
  const { getSchedulerLog } = useApp()
  const [open, setOpen] = useState(false)
  const [entries, setEntries] = useState<SchedulerLogEntry[]>([])

  const refresh = useCallback(() => {
    setEntries(getSchedulerLog())
  }, [getSchedulerLog])

  const handleOpen = useCallback(() => {
    if (!open) refresh()
    setOpen(v => !v)
  }, [open, refresh])

  const handleExport = useCallback(async () => {
    const rows = getSchedulerLog()
    if (rows.length === 0) return
    const lines = rows.map(e => `[${e.ts}] [${e.level.toUpperCase()}] ${e.msg}`).join('\n')
    const fileName = `scheduler-log-${today()}.txt`
    await window.spotmaster?.exportTextFile(fileName, lines)
  }, [getSchedulerLog])

  const handleClear = useCallback(() => {
    setEntries([])
  }, [])

  const levelColor: Record<SchedulerLogEntry['level'], string> = {
    info: 'var(--text-secondary)',
    warn: 'var(--warning, #f59e0b)',
    error: 'var(--error, #f87171)',
  }

  return (
    <div style={{ marginTop: 16, border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
      <button
        onClick={handleOpen}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          width: '100%', padding: '10px 14px',
          background: 'var(--bg-secondary)', border: 'none', cursor: 'pointer',
          color: 'var(--text-primary)', fontSize: '0.83rem', fontWeight: 600,
        }}
      >
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        <span style={{ flex: 1, textAlign: 'left' }}>Diagnóstico do Scheduler Comercial</span>
        {entries.some(e => e.level === 'error') && (
          <span style={{ fontSize: '0.7rem', background: 'var(--error, #f87171)', color: '#fff', borderRadius: 10, padding: '2px 7px' }}>ERRO</span>
        )}
        {!entries.some(e => e.level === 'error') && entries.some(e => e.level === 'warn') && (
          <span style={{ fontSize: '0.7rem', background: 'var(--warning, #f59e0b)', color: '#fff', borderRadius: 10, padding: '2px 7px' }}>AVISO</span>
        )}
      </button>

      {open && (
        <div style={{ padding: '10px 14px', background: 'var(--bg-primary)' }}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
            <Button size="sm" variant="secondary" onClick={refresh} icon={<RefreshCw size={12} />}>
              Atualizar
            </Button>
            <Button size="sm" variant="secondary" onClick={handleExport} icon={<Download size={12} />}>
              Exportar .txt
            </Button>
            <Button size="sm" variant="secondary" onClick={handleClear} icon={<Trash2 size={12} />}>
              Limpar
            </Button>
          </div>

          {entries.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', margin: 0 }}>
              Nenhum evento registrado. Clique em "Atualizar" para carregar.
            </p>
          ) : (
            <div style={{
              maxHeight: 280, overflowY: 'auto',
              fontFamily: 'Courier New, monospace', fontSize: '0.75rem',
              display: 'flex', flexDirection: 'column', gap: 2,
            }}>
              {entries.map((e, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                  <span style={{ color: 'var(--text-secondary)', flexShrink: 0 }}>{e.ts}</span>
                  <span style={{ color: levelColor[e.level], flexShrink: 0, fontWeight: 600, minWidth: 36 }}>
                    {e.level.toUpperCase()}
                  </span>
                  <span style={{ color: 'var(--text-primary)', wordBreak: 'break-word' }}>{e.msg}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
