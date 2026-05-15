import { useState, useEffect, useCallback } from 'react'
import { Plus, Trash2, Edit2, Play, Copy, Check, Server, Wifi, WifiOff, ChevronDown, ChevronUp } from 'lucide-react'
import { useApp } from '../../store/AppContext'
import type {
  AppSettings,
  GrafismoTitleInput,
  GrafismoField,
  GrafismoTemplate,
  GrafismoTemplateMapping,
  GrafismoFieldSource,
} from '../../types'
import { today } from '../../utils/time'
import { executeVmixCommand } from '../../utils/vmixCommandService'
import Button from '../ui/Button'
import PageHeader from '../ui/PageHeader'
import { Field, FieldRow, Section } from '../ui/Field'
import '../AdBreaks/AdBreaksPanel.css'

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseTitle(title: string) {
  const sep = title.indexOf(' - ')
  return {
    artist: sep >= 0 ? title.slice(0, sep).trim() : title.trim(),
    song: sep >= 0 ? title.slice(sep + 3).trim() : '',
  }
}

const SOURCE_LABELS: Record<GrafismoFieldSource, string> = {
  now_artist:  'Artista atual',
  now_song:    'Música atual',
  now_title:   'Título completo atual',
  next_artist: 'Artista a seguir',
  next_song:   'Música a seguir',
  next_title:  'Título completo a seguir',
  time:        'Hora atual (HH:MM)',
  station:     'Nome da emissora',
  static:      'Texto fixo',
}

// ── GC Automático tab ─────────────────────────────────────────────────────────

function GcAutoTab() {
  const { state, dispatch, saveToStorage } = useApp()
  const [form, setForm] = useState<AppSettings>({ ...state.settings })
  const [testMsg, setTestMsg] = useState<string | null>(null)

  const set = <K extends keyof AppSettings>(k: K, v: AppSettings[K]) =>
    setForm(f => ({ ...f, [k]: v }))

  const handleSave = () => {
    dispatch({ type: 'SET_SETTINGS', payload: form })
    saveToStorage('settings', form)
  }

  const handleTest = async () => {
    if (!form.gcMusicInputName) { setTestMsg('❌ Configure o nome do Input vMix antes de testar.'); return }
    const gcMeta = { source: 'gc-test' as const, risk: 'low' as const }
    const r1 = await executeVmixCommand('SetText', { input: form.gcMusicInputName, selectedName: form.gcMusicLine1Field || 'Artist.Text', value: 'Artista Teste', meta: gcMeta, validate: false })
    const r2 = await executeVmixCommand('SetText', { input: form.gcMusicInputName, selectedName: form.gcMusicLine2Field || 'Title.Text',  value: form.gcMusicDynamic ? 'Música Teste' : (form.gcMusicStaticLine2 || ' '), meta: gcMeta, validate: false })
    const ch = form.gcMusicOverlay ?? 0
    if (ch > 0) await executeVmixCommand(`OverlayInput${ch}In`, { input: form.gcMusicInputName, meta: gcMeta })
    if (!r1.success || !r2.success) {
      setTestMsg(`❌ Erro no SetText — Linha 1: ${r1.error ?? 'ok'} | Linha 2: ${r2.error ?? 'ok'} — Verifique o nome do Input e os nomes dos campos (precisam ter .Text no final, ex: Artist.Text)`)
    } else {
      setTestMsg('✅ GC disparado! Se o texto não mudou no vMix, verifique os nomes dos campos (use NomeDoCampo.Text).')
    }
    setTimeout(() => setTestMsg(null), 8000)
  }

  return (
    <div style={{ padding: '0 20px 20px' }}>
      <Section title="Ativação">
        <div className="settings-inline-actions">
          <label className="settings-check">
            <input type="checkbox" checked={form.gcMusicEnabled ?? false} onChange={e => set('gcMusicEnabled', e.target.checked)} />
            Ativar GC automático para músicas
          </label>
        </div>
        <div className="ui-field-hint">
          Dispara automaticamente quando uma música começa a tocar num bloco musical (nunca em blocos comerciais).
        </div>
      </Section>

      {form.gcMusicEnabled && (
        <>
          <Section title="Input e delay">
            <FieldRow>
              <Field label="Delay após início (s)">
                <input className="ui-input" type="number" min={0} max={60} value={form.gcMusicDelaySeconds ?? 5}
                  onChange={e => set('gcMusicDelaySeconds', Math.max(0, parseInt(e.target.value) || 0))} />
              </Field>
              <Field label="Input de título no vMix" className="settings-grow-2">
                <input className="ui-input" value={form.gcMusicInputName ?? ''} placeholder="Ex: Lower Third Music"
                  onChange={e => set('gcMusicInputName', e.target.value)} />
              </Field>
            </FieldRow>
            <FieldRow>
              <Field label="Campo linha 1 (artista)">
                <input className="ui-input" value={form.gcMusicLine1Field ?? ''} placeholder="Ex: Artist.Text"
                  onChange={e => set('gcMusicLine1Field', e.target.value)} />
              </Field>
              <Field label="Campo linha 2 (música)">
                <input className="ui-input" value={form.gcMusicLine2Field ?? ''} placeholder="Ex: Title.Text"
                  onChange={e => set('gcMusicLine2Field', e.target.value)} />
              </Field>
            </FieldRow>
            <div className="ui-field-hint">
              ⚠️ Títulos GT do vMix exigem o sufixo <b>.Text</b> no nome do campo — ex: <b>Artist.Text</b>, <b>Title.Text</b>.
              Para ver os nomes: clique duas vezes no title no vMix → os campos aparecem à esquerda do editor.
            </div>
          </Section>

          <Section title="Modo da linha 2">
            <Field label="Modo">
              <select className="ui-select" value={form.gcMusicDynamic ? 'dynamic' : 'static'}
                onChange={e => set('gcMusicDynamic', e.target.value === 'dynamic')}>
                <option value="dynamic">Dinâmico — artista + música do arquivo</option>
                <option value="static">Linha 2 fixa (texto configurado abaixo)</option>
              </select>
            </Field>
            {!form.gcMusicDynamic && (
              <Field label="Texto fixo — linha 2">
                <input className="ui-input" value={form.gcMusicStaticLine2 ?? ''} placeholder="Ex: Rádio Exemplo FM"
                  onChange={e => set('gcMusicStaticLine2', e.target.value)} />
              </Field>
            )}
            <div className="ui-field-hint">Formato esperado no nome do arquivo: ARTISTA - MÚSICA</div>
          </Section>

          <Section title="Overlay (opcional)">
            <FieldRow>
              <Field label="Canal de overlay (0 = só setar texto)">
                <input className="ui-input" type="number" min={0} max={4} value={form.gcMusicOverlay ?? 0}
                  onChange={e => set('gcMusicOverlay', Math.min(4, Math.max(0, parseInt(e.target.value) || 0)))} />
              </Field>
              <Field label="Esconder após (s, 0 = manual)">
                <input className="ui-input" type="number" min={0} value={form.gcMusicHideDuration ?? 0}
                  onChange={e => set('gcMusicHideDuration', Math.max(0, parseInt(e.target.value) || 0))} />
              </Field>
            </FieldRow>
          </Section>
        </>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <Button variant="primary" onClick={handleSave}>Salvar configurações</Button>
        {form.gcMusicEnabled && (
          <Button variant="secondary" icon={<Play size={14} />} onClick={handleTest}>Testar GC agora</Button>
        )}
      </div>
      {testMsg && <div className="ui-card-note" style={{ marginTop: 8 }}>{testMsg}</div>}
    </div>
  )
}

// ── Inputs de Título tab ──────────────────────────────────────────────────────

function TitulosTab() {
  const { state, dispatch, saveToStorage } = useApp()
  const { grafismoTitleInputs } = state

  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<GrafismoTitleInput | null>(null)
  const [name, setName] = useState('')
  const [fields, setFields] = useState<GrafismoField[]>([])
  const [expanded, setExpanded] = useState<string | null>(null)

  const openNew = () => { setEditing(null); setName(''); setFields([{ name: '', label: '' }]); setShowForm(true) }
  const openEdit = (inp: GrafismoTitleInput) => { setEditing(inp); setName(inp.name); setFields([...inp.fields]); setShowForm(true) }

  const addField = () => setFields(f => [...f, { name: '', label: '' }])
  const removeField = (i: number) => setFields(f => f.filter((_, idx) => idx !== i))
  const updateField = (i: number, key: keyof GrafismoField, val: string) =>
    setFields(f => f.map((fld, idx) => idx === i ? { ...fld, [key]: val } : fld))

  const handleSave = () => {
    if (!name.trim()) return
    const validFields = fields.filter(f => f.name.trim())
    const payload: GrafismoTitleInput = {
      id: editing?.id ?? crypto.randomUUID(),
      createdAt: editing?.createdAt ?? new Date().toISOString(),
      name: name.trim(),
      fields: validFields,
    }
    if (editing) {
      dispatch({ type: 'UPDATE_GRAFISMO_TITLE_INPUT', payload })
      saveToStorage('grafismoTitleInputs', grafismoTitleInputs.map(i => i.id === payload.id ? payload : i))
    } else {
      dispatch({ type: 'ADD_GRAFISMO_TITLE_INPUT', payload })
      saveToStorage('grafismoTitleInputs', [...grafismoTitleInputs, payload])
    }
    setShowForm(false)
  }

  const handleDelete = (id: string) => {
    if (!window.confirm('Excluir este input de título?')) return
    dispatch({ type: 'DELETE_GRAFISMO_TITLE_INPUT', payload: id })
    saveToStorage('grafismoTitleInputs', grafismoTitleInputs.filter(i => i.id !== id))
  }

  const inp = { background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 5, padding: '6px 10px', color: 'var(--text-primary)', fontSize: '0.85rem', outline: 'none', width: '100%' } as const

  return (
    <div style={{ padding: '0 20px 20px' }}>
      <div style={{ marginBottom: 12 }}>
        <Button variant="primary" icon={<Plus size={14} />} onClick={openNew}>Novo Input de Título</Button>
      </div>
      <div className="ui-field-hint" style={{ marginBottom: 16 }}>
        Cadastre aqui os inputs de título do seu vMix (GT/XAML) com os campos de texto que eles contêm. Esses inputs serão usados pelos Templates e pelo GC automático.
      </div>

      {grafismoTitleInputs.length === 0 && !showForm && (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-secondary)' }}>
          Nenhum input de título cadastrado.
        </div>
      )}

      {grafismoTitleInputs.map(inp_ => (
        <div key={inp_.id} style={{ border: '1px solid var(--border)', borderRadius: 8, marginBottom: 8, background: 'var(--bg-secondary)', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', cursor: 'pointer' }}
            onClick={() => setExpanded(e => e === inp_.id ? null : inp_.id)}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{inp_.name}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{inp_.fields.length} campo{inp_.fields.length !== 1 ? 's' : ''}</div>
            </div>
            <button onClick={e => { e.stopPropagation(); openEdit(inp_) }} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 4 }}><Edit2 size={14} /></button>
            <button onClick={e => { e.stopPropagation(); handleDelete(inp_.id) }} style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', padding: 4 }}><Trash2 size={14} /></button>
            {expanded === inp_.id ? <ChevronUp size={14} style={{ color: 'var(--text-secondary)' }} /> : <ChevronDown size={14} style={{ color: 'var(--text-secondary)' }} />}
          </div>
          {expanded === inp_.id && inp_.fields.length > 0 && (
            <div style={{ borderTop: '1px solid var(--border)', padding: '8px 14px', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {inp_.fields.map((f, i) => (
                <span key={i} style={{ padding: '2px 8px', borderRadius: 4, background: 'var(--bg-primary)', border: '1px solid var(--border)', fontSize: '0.78rem' }}>
                  <b>{f.name}</b>{f.label ? ` — ${f.label}` : ''}
                </span>
              ))}
            </div>
          )}
        </div>
      ))}

      {showForm && (
        <div style={{ border: '1px solid var(--accent)', borderRadius: 10, padding: 16, marginTop: 12, background: 'var(--bg-secondary)' }}>
          <div style={{ fontWeight: 600, marginBottom: 12 }}>{editing ? 'Editar Input' : 'Novo Input de Título'}</div>
          <Field label="Nome do input no vMix *">
            <input style={inp} value={name} placeholder="Ex: Lower Third Music" onChange={e => setName(e.target.value)} autoFocus />
          </Field>
          <div style={{ marginTop: 12, marginBottom: 6, fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Campos de texto</div>
          {fields.map((f, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, marginBottom: 6 }}>
              <input style={inp} value={f.name} placeholder="Nome do campo (ex: Artist.Text)" onChange={e => updateField(i, 'name', e.target.value)} />
              <input style={inp} value={f.label} placeholder="Rótulo (ex: Artista)" onChange={e => updateField(i, 'label', e.target.value)} />
              <button onClick={() => removeField(i)} style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer' }}><Trash2 size={14} /></button>
            </div>
          ))}
          <Button variant="ghost" size="sm" icon={<Plus size={12} />} onClick={addField} style={{ marginBottom: 12 }}>Adicionar campo</Button>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button variant="ghost" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button variant="primary" disabled={!name.trim()} onClick={handleSave}>Salvar</Button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Templates tab ─────────────────────────────────────────────────────────────

function TemplatesTab() {
  const { state, dispatch, saveToStorage } = useApp()
  const { grafismoTitleInputs, grafismoTemplates, dateSchedules, playlist, settings } = state
  const todayStr = today()

  const schedule = dateSchedules[todayStr] ?? []
  const playingIdx = schedule.findIndex(i => i.status === 'playing')
  const nowItem = playingIdx >= 0 ? schedule[playingIdx] : playlist.find(i => i.status === 'playing') ?? null
  const nextItem = playingIdx >= 0 ? schedule.find((i, idx) => idx > playingIdx && i.status === 'pending') ?? null : null

  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<GrafismoTemplate | null>(null)
  const [tName, setTName] = useState('')
  const [tInputId, setTInputId] = useState('')
  const [tMappings, setTMappings] = useState<GrafismoTemplateMapping[]>([])
  const [tOverlay, setTOverlay] = useState(0)
  const [tHide, setTHide] = useState(0)
  const [firing, setFiring] = useState<string | null>(null)

  const selectedInput = grafismoTitleInputs.find(i => i.id === tInputId)

  const openNew = () => {
    setEditing(null); setTName(''); setTInputId(grafismoTitleInputs[0]?.id ?? ''); setTMappings([]); setTOverlay(0); setTHide(0); setShowForm(true)
  }
  const openEdit = (t: GrafismoTemplate) => {
    setEditing(t); setTName(t.name); setTInputId(t.inputId); setTMappings([...t.mappings]); setTOverlay(t.overlayChannel ?? 0); setTHide(t.hideDuration ?? 0); setShowForm(true)
  }

  const addMapping = () => {
    const firstField = selectedInput?.fields[0]?.name ?? ''
    setTMappings(m => [...m, { fieldName: firstField, source: 'now_artist', staticValue: '' }])
  }
  const removeMapping = (i: number) => setTMappings(m => m.filter((_, idx) => idx !== i))
  const updateMapping = (i: number, patch: Partial<GrafismoTemplateMapping>) =>
    setTMappings(m => m.map((mp, idx) => idx === i ? { ...mp, ...patch } : mp))

  const handleSave = () => {
    if (!tName.trim() || !tInputId) return
    const payload: GrafismoTemplate = {
      id: editing?.id ?? crypto.randomUUID(),
      createdAt: editing?.createdAt ?? new Date().toISOString(),
      name: tName.trim(),
      inputId: tInputId,
      mappings: tMappings,
      overlayChannel: tOverlay > 0 ? tOverlay : undefined,
      hideDuration: tHide > 0 ? tHide : undefined,
    }
    if (editing) {
      dispatch({ type: 'UPDATE_GRAFISMO_TEMPLATE', payload })
      saveToStorage('grafismoTemplates', grafismoTemplates.map(t => t.id === payload.id ? payload : t))
    } else {
      dispatch({ type: 'ADD_GRAFISMO_TEMPLATE', payload })
      saveToStorage('grafismoTemplates', [...grafismoTemplates, payload])
    }
    setShowForm(false)
  }

  const handleDelete = (id: string) => {
    if (!window.confirm('Excluir este template?')) return
    dispatch({ type: 'DELETE_GRAFISMO_TEMPLATE', payload: id })
    saveToStorage('grafismoTemplates', grafismoTemplates.filter(t => t.id !== id))
  }

  const fireTemplate = useCallback(async (template: GrafismoTemplate) => {
    const titleInput = grafismoTitleInputs.find(i => i.id === template.inputId)
    if (!titleInput) return
    setFiring(template.id)
    const gcMeta = { source: 'grafismo-template' as const, risk: 'low' as const }
    for (const m of template.mappings) {
      let value = ''
      const now = nowItem ? parseTitle(nowItem.title) : { artist: '', song: '' }
      const next = nextItem ? parseTitle(nextItem.title) : { artist: '', song: '' }
      switch (m.source) {
        case 'now_artist':  value = now.artist; break
        case 'now_song':    value = now.song; break
        case 'now_title':   value = nowItem?.title ?? ''; break
        case 'next_artist': value = next.artist; break
        case 'next_song':   value = next.song; break
        case 'next_title':  value = nextItem?.title ?? ''; break
        case 'time':        value = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); break
        case 'station':     value = settings.stationName; break
        case 'static':      value = m.staticValue ?? ''; break
      }
      await executeVmixCommand('SetText', { input: titleInput.name, selectedName: m.fieldName, value, meta: gcMeta })
    }
    const ch = template.overlayChannel ?? 0
    if (ch > 0) {
      await executeVmixCommand(`OverlayInput${ch}In`, { input: titleInput.name, meta: gcMeta })
      if (template.hideDuration && template.hideDuration > 0) {
        setTimeout(() => executeVmixCommand(`OverlayInput${ch}Off`, { meta: gcMeta }), template.hideDuration * 1000)
      }
    }
    setTimeout(() => setFiring(null), 1200)
  }, [grafismoTitleInputs, nowItem, nextItem, settings.stationName])

  const inp = { background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 5, padding: '6px 10px', color: 'var(--text-primary)', fontSize: '0.85rem', outline: 'none', width: '100%' } as const

  return (
    <div style={{ padding: '0 20px 20px' }}>
      {grafismoTitleInputs.length === 0 && (
        <div className="ui-card-note" style={{ marginBottom: 16 }}>
          Cadastre pelo menos um Input de Título na aba "Meus Títulos" antes de criar templates.
        </div>
      )}

      <div style={{ marginBottom: 12 }}>
        <Button variant="primary" icon={<Plus size={14} />} onClick={openNew} disabled={grafismoTitleInputs.length === 0}>Novo Template</Button>
      </div>

      {grafismoTemplates.length === 0 && !showForm && (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-secondary)' }}>
          Nenhum template criado. Crie templates para "Agora no ar", "A seguir", "Intervalo" etc.
        </div>
      )}

      {grafismoTemplates.map(tmpl => {
        const inputName = grafismoTitleInputs.find(i => i.id === tmpl.inputId)?.name ?? '?'
        const isFiring = firing === tmpl.id
        return (
          <div key={tmpl.id} style={{ border: '1px solid var(--border)', borderRadius: 8, marginBottom: 8, background: 'var(--bg-secondary)', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{tmpl.name}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 2, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <span>📺 {inputName}</span>
                <span>{tmpl.mappings.length} mapeamento{tmpl.mappings.length !== 1 ? 's' : ''}</span>
                {(tmpl.overlayChannel ?? 0) > 0 && <span>Overlay {tmpl.overlayChannel}</span>}
              </div>
            </div>
            <button
              onClick={() => fireTemplate(tmpl)}
              disabled={isFiring}
              style={{ background: isFiring ? 'var(--success)' : 'var(--accent)', border: 'none', color: '#fff', cursor: 'pointer', padding: '4px 10px', borderRadius: 5, fontSize: '0.78rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}
            >
              {isFiring ? <Check size={13} /> : <Play size={13} />}
              {isFiring ? 'Disparado!' : 'Disparar'}
            </button>
            <button onClick={() => openEdit(tmpl)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 4 }}><Edit2 size={14} /></button>
            <button onClick={() => handleDelete(tmpl.id)} style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', padding: 4 }}><Trash2 size={14} /></button>
          </div>
        )
      })}

      {showForm && (
        <div style={{ border: '1px solid var(--accent)', borderRadius: 10, padding: 16, marginTop: 12, background: 'var(--bg-secondary)' }}>
          <div style={{ fontWeight: 600, marginBottom: 12 }}>{editing ? 'Editar Template' : 'Novo Template'}</div>
          <FieldRow>
            <Field label="Nome do template *">
              <input style={inp} value={tName} placeholder="Ex: Agora no ar" onChange={e => setTName(e.target.value)} autoFocus />
            </Field>
            <Field label="Input de título *">
              <select style={inp} value={tInputId} onChange={e => { setTInputId(e.target.value); setTMappings([]) }}>
                <option value="">Selecionar...</option>
                {grafismoTitleInputs.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
            </Field>
          </FieldRow>

          {tInputId && (
            <>
              <div style={{ marginTop: 12, marginBottom: 6, fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Mapeamentos de campos</div>
              {tMappings.map((m, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, marginBottom: 8, alignItems: 'start' }}>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: 3 }}>Campo no vMix</label>
                    {selectedInput && selectedInput.fields.length > 0 ? (
                      <select style={inp} value={m.fieldName} onChange={e => updateMapping(i, { fieldName: e.target.value })}>
                        {selectedInput.fields.map(f => <option key={f.name} value={f.name}>{f.name}{f.label ? ` — ${f.label}` : ''}</option>)}
                      </select>
                    ) : (
                      <input style={inp} value={m.fieldName} placeholder="Nome do campo" onChange={e => updateMapping(i, { fieldName: e.target.value })} />
                    )}
                  </div>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: 3 }}>Fonte dos dados</label>
                    <select style={inp} value={m.source} onChange={e => updateMapping(i, { source: e.target.value as GrafismoFieldSource })}>
                      {(Object.keys(SOURCE_LABELS) as GrafismoFieldSource[]).map(s => (
                        <option key={s} value={s}>{SOURCE_LABELS[s]}</option>
                      ))}
                    </select>
                    {m.source === 'static' && (
                      <input style={{ ...inp, marginTop: 6 }} value={m.staticValue ?? ''} placeholder="Texto fixo" onChange={e => updateMapping(i, { staticValue: e.target.value })} />
                    )}
                  </div>
                  <button onClick={() => removeMapping(i)} style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', marginTop: 22 }}><Trash2 size={14} /></button>
                </div>
              ))}
              <Button variant="ghost" size="sm" icon={<Plus size={12} />} onClick={addMapping} style={{ marginBottom: 12 }}>Adicionar mapeamento</Button>
            </>
          )}

          <FieldRow>
            <Field label="Canal overlay (0 = só texto)">
              <input style={inp} type="number" min={0} max={4} value={tOverlay} onChange={e => setTOverlay(Math.min(4, Math.max(0, parseInt(e.target.value) || 0)))} />
            </Field>
            <Field label="Esconder após (s, 0 = manual)">
              <input style={inp} type="number" min={0} value={tHide} onChange={e => setTHide(Math.max(0, parseInt(e.target.value) || 0))} />
            </Field>
          </FieldRow>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
            <Button variant="ghost" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button variant="primary" disabled={!tName.trim() || !tInputId} onClick={handleSave}>Salvar</Button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Data Sources tab ──────────────────────────────────────────────────────────

function DataSourcesTab() {
  const { state, dispatch, saveToStorage } = useApp()
  const { settings } = state
  const [running, setRunning] = useState(false)
  const [port, setPort] = useState(settings.dataSourcesPort ?? 7070)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  useEffect(() => {
    window.spotmaster?.getDataSourcesStatus().then((s: { running: boolean }) => setRunning(s.running)).catch(() => {})
  }, [])

  const handleToggle = async () => {
    if (running) {
      await window.spotmaster?.stopDataSourcesServer()
      setRunning(false)
      const updated = { ...settings, dataSourcesEnabled: false }
      dispatch({ type: 'SET_SETTINGS', payload: updated })
      saveToStorage('settings', updated)
    } else {
      const result = await window.spotmaster?.startDataSourcesServer(port)
      if (result?.success) {
        setRunning(true)
        setError(null)
        const updated = { ...settings, dataSourcesEnabled: true, dataSourcesPort: port }
        dispatch({ type: 'SET_SETTINGS', payload: updated })
        saveToStorage('settings', updated)
      } else {
        setError(result?.error ?? 'Erro ao iniciar servidor')
      }
    }
  }

  const baseUrl = `http://localhost:${port}`
  const endpoints = [
    { path: '/vtmaster/now-next', desc: 'Agora tocando + próximo item' },
    { path: '/vtmaster/schedule', desc: 'Programação completa do dia' },
    { path: '/vtmaster/log-today', desc: 'Log de veiculação do dia' },
  ]

  const copyUrl = (url: string) => {
    navigator.clipboard.writeText(url).then(() => { setCopied(url); setTimeout(() => setCopied(null), 2000) })
  }

  return (
    <div style={{ padding: '0 20px 20px' }}>
      <Section title="Servidor local">
        <div className="ui-field-hint" style={{ marginBottom: 12 }}>
          O VTMaster publica a programação atual como JSON via HTTP. Configure um Data Source no vMix apontando para essas URLs e seus títulos atualizam automaticamente sem intervenção do operador.
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 8, background: running ? '#16a34a18' : 'var(--bg-primary)', border: `1px solid ${running ? '#16a34a40' : 'var(--border)'}` }}>
            {running ? <Wifi size={16} style={{ color: 'var(--success)' }} /> : <WifiOff size={16} style={{ color: 'var(--text-secondary)' }} />}
            <span style={{ fontWeight: 600, fontSize: '0.88rem', color: running ? 'var(--success)' : 'var(--text-secondary)' }}>
              {running ? `Rodando na porta ${port}` : 'Parado'}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Porta:</label>
            <input
              type="number" min={1024} max={65535}
              value={port}
              onChange={e => setPort(parseInt(e.target.value) || 7070)}
              disabled={running}
              style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 5, padding: '5px 8px', color: 'var(--text-primary)', fontSize: '0.85rem', outline: 'none', width: 90 }}
            />
          </div>
          <Button variant={running ? 'danger' : 'primary'} icon={running ? <WifiOff size={14} /> : <Server size={14} />} onClick={handleToggle}>
            {running ? 'Parar servidor' : 'Iniciar servidor'}
          </Button>
        </div>

        {error && <div className="ui-card-note" style={{ marginBottom: 12, color: 'var(--error)' }}>{error}</div>}
      </Section>

      <Section title="URLs para copiar no vMix">
        {endpoints.map(ep => {
          const url = `${baseUrl}${ep.path}`
          const isCopied = copied === url
          return (
            <div key={ep.path} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 6, background: 'var(--bg-primary)', border: '1px solid var(--border)', marginBottom: 6 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'monospace', fontSize: '0.82rem', color: 'var(--accent)' }}>{url}</div>
                <div style={{ fontSize: '0.73rem', color: 'var(--text-secondary)', marginTop: 2 }}>{ep.desc}</div>
              </div>
              <button
                onClick={() => copyUrl(url)}
                style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 4, padding: '3px 8px', cursor: 'pointer', color: isCopied ? 'var(--success)' : 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.75rem' }}
              >
                {isCopied ? <Check size={12} /> : <Copy size={12} />}
                {isCopied ? 'Copiado!' : 'Copiar'}
              </button>
            </div>
          )
        })}
        <div className="ui-field-hint" style={{ marginTop: 8 }}>
          No vMix: Adicionar Input → Data Source → Web → cole a URL. O vMix vai atualizar automaticamente.
        </div>
      </Section>

      {running && (
        <Section title="Exemplo de resposta — Agora tocando">
          <pre style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 6, padding: '10px 12px', fontSize: '0.75rem', color: 'var(--text-secondary)', overflowX: 'auto', margin: 0 }}>
{`{
  "nowPlaying": {
    "title": "Beatles - Yesterday",
    "artist": "Beatles",
    "song": "Yesterday",
    "type": "spot",
    "duration": 185,
    "scheduledTime": "09:00:00"
  },
  "nextItem": {
    "title": "Rolling Stones - Paint It Black",
    "artist": "Rolling Stones",
    "song": "Paint It Black",
    "scheduledTime": "09:03:05"
  }
}`}
          </pre>
        </Section>
      )}
    </div>
  )
}

// ── Main panel ────────────────────────────────────────────────────────────────

type GrafTab = 'gc' | 'titulos' | 'templates' | 'datasources'

export default function GrafismosPanel() {
  const [activeTab, setActiveTab] = useState<GrafTab>('gc')

  const tabStyle = (active: boolean) => ({
    padding: '7px 18px', borderRadius: 7, border: 'none',
    background: active ? 'var(--accent)' : 'transparent',
    color: active ? '#fff' : 'var(--text-secondary)',
    fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer',
  })

  return (
    <div className="adbreaks-panel">
      <PageHeader title="Grafismos" />

      <div style={{ padding: '0 20px 10px', display: 'flex', gap: 4, borderBottom: '1px solid var(--border)', marginBottom: 0, flexWrap: 'wrap' }}>
        {([
          ['gc',          'GC Automático'],
          ['titulos',     'Meus Títulos'],
          ['templates',   'Templates'],
          ['datasources', 'Data Sources'],
        ] as [GrafTab, string][]).map(([id, label]) => (
          <button key={id} style={tabStyle(activeTab === id)} onClick={() => setActiveTab(id)}>{label}</button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {activeTab === 'gc'          && <GcAutoTab />}
        {activeTab === 'titulos'     && <TitulosTab />}
        {activeTab === 'templates'   && <TemplatesTab />}
        {activeTab === 'datasources' && <DataSourcesTab />}
      </div>
    </div>
  )
}
