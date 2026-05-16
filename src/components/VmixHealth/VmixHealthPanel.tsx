import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  MonitorPlay,
  Radio,
  RefreshCw,
  Server,
  Video,
  XCircle,
} from 'lucide-react'
import { useMemo } from 'react'
import { useApp } from '../../store/AppContext'
import type { VmixCommandLog, VmixInput } from '../../types'
import PageHeader from '../ui/PageHeader'
import './VmixHealthPanel.css'

function formatInput(input?: VmixInput) {
  if (!input) return 'Nao informado'
  return `#${input.number} ${input.shortTitle || input.title || input.type || 'Input'}`
}

function HealthCard({
  label,
  value,
  hint,
  tone = 'neutral',
}: {
  label: string
  value: string | number
  hint: string
  tone?: 'ok' | 'warn' | 'bad' | 'neutral'
}) {
  return (
    <div className={`vmix-health-card ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{hint}</small>
    </div>
  )
}

function CommandRow({ log }: { log: VmixCommandLog }) {
  const paramText = log.params.Input
    ? `Input ${log.params.Input}`
    : log.params.Value
      ? `Value ${log.params.Value}`
      : ''

  return (
    <div className={`vmix-health-command ${log.success ? 'ok' : 'bad'}`}>
      <span>{new Date(log.at).toLocaleTimeString('pt-BR')}</span>
      <strong>{log.functionName}</strong>
      <em>{log.source || log.queue || 'manual'}</em>
      <small>{paramText}</small>
      <b>{log.success ? `${log.latencyMs} ms` : log.error || 'falha'}</b>
    </div>
  )
}

export default function VmixHealthPanel() {
  const { state } = useApp()
  const { vmixStatus: status, vmixCommandLog: logs } = state
  const referenceTime = logs.length ? Date.parse(logs[logs.length - 1].at) : 0

  const activeInput = status.inputs?.find(input => input.number === status.activeInput || input.key === status.activeInput)
  const previewInput = status.inputs?.find(input => input.number === status.previewInput || input.key === status.previewInput)

  const recentStats = useMemo(() => {
    const tenMinutesAgo = referenceTime - 10 * 60 * 1000
    const windowLogs = logs.filter(log => Date.parse(log.at) >= tenMinutesAgo)
    const failed = windowLogs.filter(log => !log.success)
    const success = windowLogs.filter(log => log.success)
    const avgLatency = success.length
      ? Math.round(success.reduce((sum, log) => sum + log.latencyMs, 0) / success.length)
      : 0
    return { total: windowLogs.length, failed: failed.length, avgLatency }
  }, [logs, referenceTime])

  const inputGroups = useMemo(() => {
    const grouped = new Map<string, VmixInput[]>()
    for (const input of status.inputs ?? []) {
      const key = input.type || 'Other'
      grouped.set(key, [...(grouped.get(key) ?? []), input])
    }
    return [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [status.inputs])

  const attentionInputs = useMemo(
    () => (status.inputs ?? []).filter(input => {
      const state = (input.state || '').toLowerCase()
      return state && !['running', 'paused', 'completed', ''].includes(state)
    }),
    [status.inputs]
  )

  const recentLogs = logs.slice(-80).reverse()
  const statusTone = !status.connected ? 'bad' : recentStats.failed > 0 ? 'warn' : 'ok'

  return (
    <div className="vmix-health-panel">
      <PageHeader
        title={<><Activity size={18} /> Saude vMix</>}
        subtitle="Estado da conexao, operacao ao vivo, inputs e comandos recentes."
      />

      <div className="vmix-health-overview">
        <HealthCard
          label="Conexao"
          value={status.connected ? 'Conectado' : 'Offline'}
          hint={status.error || `${status.version ?? 'vMix'} ${status.edition ?? ''}`.trim() || 'Sem XML recebido'}
          tone={status.connected ? 'ok' : 'bad'}
        />
        <HealthCard
          label="Operacao"
          value={[
            status.recording ? 'REC' : '',
            status.streaming ? 'STREAM' : '',
            status.external ? 'EXT' : '',
            status.srtOutput ? 'SRT' : '',
            status.multiCorder ? 'MC' : '',
            status.fadeToBlack ? 'FTB' : '',
          ].filter(Boolean).join(' / ') || 'Idle'}
          hint="Recording, streaming, external, SRT, MultiCorder e FTB"
          tone={status.fadeToBlack ? 'warn' : status.connected ? 'ok' : 'bad'}
        />
        <HealthCard
          label="Inputs"
          value={status.inputs?.length ?? 0}
          hint={`${attentionInputs.length} input(s) pedem atencao`}
          tone={attentionInputs.length > 0 ? 'warn' : status.connected ? 'ok' : 'neutral'}
        />
        <HealthCard
          label="Comandos 10 min"
          value={recentStats.total}
          hint={`${recentStats.failed} falha(s), ${recentStats.avgLatency} ms medio`}
          tone={statusTone}
        />
      </div>

      <div className="vmix-health-main">
        <section className="vmix-health-section">
          <div className="vmix-health-section-head">
            <div>
              <strong>Programa e preview</strong>
              <span>O que o vMix informa agora pelo XML.</span>
            </div>
            {status.connected ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
          </div>

          <div className="vmix-health-live-grid">
            <div>
              <MonitorPlay size={16} />
              <span>Program</span>
              <strong>{formatInput(activeInput)}</strong>
            </div>
            <div>
              <Video size={16} />
              <span>Preview</span>
              <strong>{formatInput(previewInput)}</strong>
            </div>
            <div>
              <Server size={16} />
              <span>Edicao</span>
              <strong>{status.edition || 'Nao informada'}</strong>
            </div>
            <div>
              <Clock3 size={16} />
              <span>Polling</span>
              <strong>{status.connected ? 'Ativo' : 'Sem resposta'}</strong>
            </div>
          </div>
        </section>

        <section className="vmix-health-section">
          <div className="vmix-health-section-head">
            <div>
              <strong>Inputs por tipo</strong>
              <span>Resumo rapido para achar excesso, duplicidade ou estados estranhos.</span>
            </div>
            <RefreshCw size={18} />
          </div>

          {inputGroups.length === 0 ? (
            <div className="vmix-health-empty">Nenhum input recebido. Verifique a conexao com o vMix.</div>
          ) : (
            <div className="vmix-health-input-groups">
              {inputGroups.map(([type, inputs]) => (
                <div key={type} className="vmix-health-input-group">
                  <span>{type}</span>
                  <strong>{inputs.length}</strong>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <div className="vmix-health-main">
        <section className="vmix-health-section">
          <div className="vmix-health-section-head">
            <div>
              <strong>Inputs que pedem atencao</strong>
              <span>Estados diferentes de running, paused ou completed.</span>
            </div>
            <AlertTriangle size={18} />
          </div>

          {attentionInputs.length === 0 ? (
            <div className="vmix-health-empty">Nenhum input em estado suspeito no XML atual.</div>
          ) : (
            <div className="vmix-health-input-list">
              {attentionInputs.slice(0, 12).map(input => (
                <div key={input.key || input.number} className="vmix-health-input-row">
                  <strong>{formatInput(input)}</strong>
                  <span>{input.state}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="vmix-health-section">
          <div className="vmix-health-section-head">
            <div>
              <strong>Comandos recentes</strong>
              <span>Ultimos 80 comandos registrados pelo servico central.</span>
            </div>
            <Radio size={18} />
          </div>

          {recentLogs.length === 0 ? (
            <div className="vmix-health-empty">Nenhum comando vMix registrado ainda.</div>
          ) : (
            <div className="vmix-health-command-list">
              {recentLogs.map(log => <CommandRow key={log.id} log={log} />)}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
