import { useMemo, useState } from 'react'
import {
  Camera,
  Copy,
  Edit3,
  Monitor,
  Radio,
  Save,
  Square,
  Trash2,
  Tv,
  Video,
} from 'lucide-react'
import { useApp } from '../../store/AppContext'
import type { VmixOutputProfile, VmixOutputSource, VmixOutputTarget } from '../../types'
import { executeVmixCommand } from '../../utils/vmixCommandService'
import Button from '../ui/Button'
import Modal from '../ui/Modal'
import { Field } from '../ui/Field'
import './VmixOutputsPanel.css'

type Tab = 'control' | 'profiles' | 'automations'

type PendingCommand = {
  functionName: string
  label: string
  value?: string
  input?: string
  confirm?: string
}

const OUTPUT_TARGETS: { id: VmixOutputTarget; label: string; fn: string }[] = [
  { id: 'output2', label: 'Output 2', fn: 'SetOutput2' },
  { id: 'output3', label: 'Output 3', fn: 'SetOutput3' },
  { id: 'output4', label: 'Output 4', fn: 'SetOutput4' },
  { id: 'fullscreen1', label: 'Fullscreen 1', fn: 'SetOutputFullscreen' },
  { id: 'fullscreen2', label: 'Fullscreen 2', fn: 'SetOutputFullscreen2' },
  { id: 'external2', label: 'External 2', fn: 'SetOutputExternal2' },
]

const SOURCE_OPTIONS: { value: VmixOutputSource; label: string }[] = [
  { value: 'program', label: 'Program' },
  { value: 'preview', label: 'Preview' },
  { value: 'multiview', label: 'MultiView' },
  { value: 'clean_feed', label: 'Clean Feed' },
  { value: 'input', label: 'Input especifico' },
  { value: 'mix', label: 'Mix especifico' },
]

const DEFAULT_PROFILE: Omit<VmixOutputProfile, 'id' | 'createdAt'> = {
  name: '',
  target: 'output2',
  source: 'program',
  inputName: '',
  mix: '1',
}

function targetLabel(target: VmixOutputTarget) {
  return OUTPUT_TARGETS.find(t => t.id === target)?.label ?? target
}

function sourceLabel(source: VmixOutputSource) {
  return SOURCE_OPTIONS.find(s => s.value === source)?.label ?? source
}

function outputFunction(target: VmixOutputTarget) {
  return OUTPUT_TARGETS.find(t => t.id === target)?.fn ?? 'SetOutput2'
}

function outputValue(profile: Pick<VmixOutputProfile, 'source' | 'inputName' | 'mix'>) {
  if (profile.source === 'program') return 'Output'
  if (profile.source === 'preview') return 'Preview'
  if (profile.source === 'multiview') return 'MultiView'
  if (profile.source === 'clean_feed') return 'Output'
  if (profile.source === 'mix') return `Mix ${profile.mix || '1'}`
  return profile.inputName?.trim() || ''
}

function isProfileValid(profile: Pick<VmixOutputProfile, 'name' | 'source' | 'inputName' | 'mix'>) {
  if (!profile.name.trim()) return false
  if (profile.source === 'input') return !!profile.inputName?.trim()
  if (profile.source === 'mix') return !!profile.mix?.trim()
  return true
}

function statusText(v?: boolean) {
  return v ? 'ON' : 'OFF'
}

export default function VmixOutputsPanel() {
  const { state, dispatch } = useApp()
  const [tab, setTab] = useState<Tab>('control')
  const [draft, setDraft] = useState<Omit<VmixOutputProfile, 'id' | 'createdAt'>>(DEFAULT_PROFILE)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState<string>('')
  const [pending, setPending] = useState<PendingCommand | null>(null)

  const recentOutputLogs = useMemo(
    () => state.vmixCommandLog
      .filter(log => log.category === 'output' || log.category === 'recording' || log.category === 'streaming')
      .slice(-8)
      .reverse(),
    [state.vmixCommandLog],
  )

  const runCommand = async (cmd: PendingCommand) => {
    setBusy(cmd.label)
    setMessage('')
    const result = await executeVmixCommand(cmd.functionName, {
      input: cmd.input,
      value: cmd.value,
      meta: {
        source: 'outputs-panel',
        queue: 'manual',
      },
    })
    setBusy(null)
    setPending(null)
    setMessage(result.success ? `${cmd.label}: comando enviado.` : `${cmd.label}: ${result.error ?? 'falhou.'}`)
  }

  const requestCommand = (cmd: PendingCommand) => {
    if (cmd.confirm) setPending(cmd)
    else void runCommand(cmd)
  }

  const applyProfile = (profile: VmixOutputProfile) => {
    const value = outputValue(profile)
    if (!value) {
      setMessage('Informe o input ou mix antes de aplicar o perfil.')
      return
    }
    requestCommand({
      functionName: outputFunction(profile.target),
      label: profile.name,
      value,
      confirm: profile.source === 'clean_feed'
        ? 'Aplicar este perfil como clean feed? Confirme se o Output do vMix esta configurado sem overlays.'
        : undefined,
    })
  }

  const saveProfile = () => {
    if (!isProfileValid(draft)) return
    if (editingId) {
      dispatch({
        type: 'UPDATE_VMIX_OUTPUT_PROFILE',
        payload: { ...draft, id: editingId, createdAt: state.vmixOutputProfiles.find(p => p.id === editingId)?.createdAt ?? new Date().toISOString() },
      })
    } else {
      dispatch({
        type: 'ADD_VMIX_OUTPUT_PROFILE',
        payload: { ...draft, id: crypto.randomUUID(), createdAt: new Date().toISOString() },
      })
    }
    setDraft(DEFAULT_PROFILE)
    setEditingId(null)
  }

  const editProfile = (profile: VmixOutputProfile) => {
    setDraft({
      name: profile.name,
      target: profile.target,
      source: profile.source,
      inputName: profile.inputName ?? '',
      mix: profile.mix ?? '1',
    })
    setEditingId(profile.id)
    setTab('profiles')
  }

  const copyAutomation = async (text: string) => {
    await navigator.clipboard?.writeText(text)
    setMessage('Receita de automacao copiada.')
  }

  return (
    <div className="outputs-panel">
      <div className="outputs-tabs">
        <button className={`outputs-tab ${tab === 'control' ? 'active' : ''}`} onClick={() => setTab('control')}>
          <Radio size={14} /> Controle
        </button>
        <button className={`outputs-tab ${tab === 'profiles' ? 'active' : ''}`} onClick={() => setTab('profiles')}>
          <Monitor size={14} /> Perfis
        </button>
        <button className={`outputs-tab ${tab === 'automations' ? 'active' : ''}`} onClick={() => setTab('automations')}>
          <Tv size={14} /> Automacoes
        </button>
      </div>

      <div className="outputs-content">
        {message && <div className="outputs-message">{message}</div>}

        {tab === 'control' && (
          <>
            <section className="outputs-status-grid">
              <div className="outputs-status-card">
                <span>Output 1</span>
                <strong>Program</strong>
              </div>
              <div className="outputs-status-card">
                <span>Active</span>
                <strong>{state.vmixStatus.activeInput || '-'}</strong>
              </div>
              <div className="outputs-status-card">
                <span>Preview</span>
                <strong>{state.vmixStatus.previewInput || '-'}</strong>
              </div>
              <div className={`outputs-status-card ${state.vmixStatus.recording ? 'on' : ''}`}>
                <span>Recording</span>
                <strong>{statusText(state.vmixStatus.recording)}</strong>
              </div>
              <div className={`outputs-status-card ${state.vmixStatus.streaming ? 'on' : ''}`}>
                <span>Streaming</span>
                <strong>{statusText(state.vmixStatus.streaming)}</strong>
              </div>
              <div className={`outputs-status-card ${state.vmixStatus.external ? 'on' : ''}`}>
                <span>External</span>
                <strong>{statusText(state.vmixStatus.external)}</strong>
              </div>
              <div className={`outputs-status-card ${state.vmixStatus.fadeToBlack ? 'warn' : ''}`}>
                <span>FTB</span>
                <strong>{statusText(state.vmixStatus.fadeToBlack)}</strong>
              </div>
              <div className={`outputs-status-card ${state.vmixStatus.srtOutput ? 'on' : ''}`}>
                <span>SRT</span>
                <strong>{statusText(state.vmixStatus.srtOutput)}</strong>
              </div>
            </section>

            <section className="outputs-command-grid">
              <div className="outputs-command-card">
                <h3>Gravacao</h3>
                <div className="outputs-command-row">
                  <Button icon={<Video size={14} />} variant="success" onClick={() => requestCommand({ functionName: 'StartRecording', label: 'Iniciar gravacao' })} disabled={!!busy}>
                    Iniciar
                  </Button>
                  <Button icon={<Square size={14} />} variant="danger" onClick={() => requestCommand({ functionName: 'StopRecording', label: 'Parar gravacao', confirm: 'Parar a gravacao agora?' })} disabled={!!busy}>
                    Parar
                  </Button>
                </div>
              </div>
              <div className="outputs-command-card">
                <h3>Streaming</h3>
                <div className="outputs-command-row">
                  <Button icon={<Radio size={14} />} variant="success" onClick={() => requestCommand({ functionName: 'StartStreaming', label: 'Iniciar streaming' })} disabled={!!busy}>
                    Iniciar
                  </Button>
                  <Button icon={<Square size={14} />} variant="danger" onClick={() => requestCommand({ functionName: 'StopStreaming', label: 'Parar streaming', confirm: 'Parar o streaming agora?' })} disabled={!!busy}>
                    Parar
                  </Button>
                </div>
              </div>
              <div className="outputs-command-card">
                <h3>External</h3>
                <div className="outputs-command-row">
                  <Button variant="success" onClick={() => requestCommand({ functionName: 'StartExternal', label: 'Iniciar External' })} disabled={!!busy}>Iniciar</Button>
                  <Button variant="danger" onClick={() => requestCommand({ functionName: 'StopExternal', label: 'Parar External', confirm: 'Desativar External agora?' })} disabled={!!busy}>Parar</Button>
                </div>
              </div>
              <div className="outputs-command-card">
                <h3>SRT Output</h3>
                <div className="outputs-command-row">
                  <Button variant="success" onClick={() => requestCommand({ functionName: 'StartSRTOutput', label: 'Iniciar SRT Output' })} disabled={!!busy}>Iniciar</Button>
                  <Button variant="danger" onClick={() => requestCommand({ functionName: 'StopSRTOutput', label: 'Parar SRT Output', confirm: 'Parar o SRT Output agora?' })} disabled={!!busy}>Parar</Button>
                </div>
              </div>
              <div className="outputs-command-card">
                <h3>MultiCorder</h3>
                <div className="outputs-command-row">
                  <Button variant="success" onClick={() => requestCommand({ functionName: 'StartMultiCorder', label: 'Iniciar MultiCorder' })} disabled={!!busy}>Iniciar</Button>
                  <Button variant="danger" onClick={() => requestCommand({ functionName: 'StopMultiCorder', label: 'Parar MultiCorder', confirm: 'Parar o MultiCorder agora?' })} disabled={!!busy}>Parar</Button>
                </div>
              </div>
              <div className="outputs-command-card">
                <h3>Fade to Black</h3>
                <div className="outputs-command-row">
                  <Button
                    variant={state.vmixStatus.fadeToBlack ? 'danger' : 'secondary'}
                    onClick={() => requestCommand({ functionName: 'FadeToBlack', label: 'Fade to Black', confirm: state.vmixStatus.fadeToBlack ? undefined : 'Ativar Fade to Black? O output ficara preto.' })}
                    disabled={!!busy}
                  >
                    {state.vmixStatus.fadeToBlack ? 'Sair do FTB' : 'FTB'}
                  </Button>
                </div>
              </div>
              <div className="outputs-command-card">
                <h3>Snapshot</h3>
                <div className="outputs-command-row">
                  <Button icon={<Camera size={14} />} onClick={() => requestCommand({ functionName: 'Snapshot', label: 'Snapshot do Output' })} disabled={!!busy}>Output</Button>
                </div>
              </div>
            </section>
          </>
        )}

        {tab === 'profiles' && (
          <div className="outputs-profiles-layout">
            <section className="outputs-editor">
              <h3>{editingId ? 'Editar perfil' : 'Novo perfil'}</h3>
              <Field label="Nome do perfil">
                <input className="ui-input" value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} placeholder="Output 2 Clean Feed" />
              </Field>
              <Field label="Destino">
                <select className="ui-input" value={draft.target} onChange={e => setDraft({ ...draft, target: e.target.value as VmixOutputTarget })}>
                  {OUTPUT_TARGETS.map(target => <option key={target.id} value={target.id}>{target.label}</option>)}
                </select>
              </Field>
              <Field label="Fonte">
                <select className="ui-input" value={draft.source} onChange={e => setDraft({ ...draft, source: e.target.value as VmixOutputSource })}>
                  {SOURCE_OPTIONS.map(source => <option key={source.value} value={source.value}>{source.label}</option>)}
                </select>
              </Field>
              {draft.source === 'input' && (
                <Field label="Input vMix">
                  <input className="ui-input" value={draft.inputName ?? ''} onChange={e => setDraft({ ...draft, inputName: e.target.value })} placeholder="Nome, numero ou GUID" />
                </Field>
              )}
              {draft.source === 'mix' && (
                <Field label="Mix">
                  <input className="ui-input" value={draft.mix ?? '1'} onChange={e => setDraft({ ...draft, mix: e.target.value })} placeholder="1" />
                </Field>
              )}
              <div className="outputs-editor-actions">
                {editingId && <Button variant="ghost" onClick={() => { setEditingId(null); setDraft(DEFAULT_PROFILE) }}>Cancelar</Button>}
                <Button icon={<Save size={14} />} variant="primary" onClick={saveProfile} disabled={!isProfileValid(draft)}>
                  Salvar
                </Button>
              </div>
            </section>

            <section className="outputs-profile-list">
              {state.vmixOutputProfiles.length === 0 ? (
                <div className="ui-empty-state">Nenhum perfil de output cadastrado.</div>
              ) : state.vmixOutputProfiles.map(profile => (
                <div key={profile.id} className="outputs-profile-card">
                  <div className="outputs-profile-main">
                    <strong>{profile.name}</strong>
                    <span>{targetLabel(profile.target)} · {sourceLabel(profile.source)} · {outputValue(profile) || '-'}</span>
                  </div>
                  <div className="outputs-profile-actions">
                    <Button size="sm" variant="primary" onClick={() => applyProfile(profile)} disabled={!!busy}>Aplicar</Button>
                    <Button size="sm" iconOnly icon={<Edit3 size={14} />} onClick={() => editProfile(profile)} title="Editar" />
                    <Button size="sm" iconOnly variant="danger" icon={<Trash2 size={14} />} onClick={() => dispatch({ type: 'DELETE_VMIX_OUTPUT_PROFILE', payload: profile.id })} title="Excluir" />
                  </div>
                </div>
              ))}
            </section>
          </div>
        )}

        {tab === 'automations' && (
          <div className="outputs-automation-grid">
            <div className="outputs-automation-card">
              <h3>Inicio de programa</h3>
              <p>Adicione uma acao vMix no primeiro item da grade com `StartRecording` e, se necessario, `StartStreaming`.</p>
              <Button size="sm" icon={<Copy size={14} />} onClick={() => copyAutomation('StartRecording / StartStreaming no inicio do programa')}>Copiar receita</Button>
            </div>
            <div className="outputs-automation-card">
              <h3>Fim de programa</h3>
              <p>Use `StopRecording` e `StopStreaming` no ultimo item. Paradas continuam pedindo confirmacao no painel ao vivo.</p>
              <Button size="sm" icon={<Copy size={14} />} onClick={() => copyAutomation('StopRecording / StopStreaming no fim do programa')}>Copiar receita</Button>
            </div>
            <div className="outputs-automation-card">
              <h3>Comerciais</h3>
              <p>Inclua `Snapshot` no inicio do bloco e um perfil de Output 2 para clean feed quando a emissora usar saida limpa.</p>
              <Button size="sm" icon={<Copy size={14} />} onClick={() => copyAutomation('Snapshot + SetOutput2=Output para clean feed em comerciais')}>Copiar receita</Button>
            </div>
          </div>
        )}

        {recentOutputLogs.length > 0 && (
          <section className="outputs-log">
            <h3>Log tecnico recente</h3>
            {recentOutputLogs.map(log => (
              <div key={log.id} className={`outputs-log-row ${log.success ? 'ok' : 'fail'}`}>
                <span>{new Date(log.at).toLocaleTimeString()}</span>
                <strong>{log.functionName}</strong>
                <em>{log.success ? 'OK' : log.error ?? 'Falhou'}</em>
              </div>
            ))}
          </section>
        )}
      </div>

      {pending && (
        <Modal
          title="Confirmar comando"
          onClose={() => setPending(null)}
          minWidth={360}
          actions={
            <>
              <Button variant="ghost" onClick={() => setPending(null)}>Cancelar</Button>
              <Button variant="danger" onClick={() => runCommand(pending)}>Confirmar</Button>
            </>
          }
        >
          <p className="outputs-confirm-text">{pending.confirm}</p>
        </Modal>
      )}
    </div>
  )
}
