import { useState } from 'react'
import { Plus, Trash2, Edit2, ChevronUp, ChevronDown, FolderOpen } from 'lucide-react'
import { useApp } from '../../store/AppContext'
import type {
  AudioLayer,
  AudioPlaceholder,
  AudioLayerMode,
  AudioLayerSourceType,
  AudioLayerCategory,
  AudioLayerPlayMode,
  AudioPlaceholderType,
  VmixActionItem,
} from '../../types'
import { VMIX_COMMAND_CATALOG } from '../../utils/vmixCommandCatalog'
import Button from '../ui/Button'
import Modal from '../ui/Modal'
import { Field, FieldRow, Section } from '../ui/Field'

// ── Defaults ────────────────────────────────────────────────────────────────

const DEFAULT_LAYER: Omit<AudioLayer, 'id'> = {
  name: '',
  category: 'outros',
  playMode: 'once',
  stopOnNewTrigger: false,
  preActions: [],
  postActions: [],
  defaultMode: 'parallel',
  sourceType: 'round_robin',
  fixedInputName: '',
  overlayChannel: null,
  volume: undefined,
  placeholders: [],
  currentIndex: 0,
}

const DEFAULT_PLACEHOLDER: Omit<AudioPlaceholder, 'id'> = {
  name: '',
  type: 'file',
  filePath: '',
  inputName: '',
  duration: undefined,
  mode: undefined,
}

// ── Action List Editor ────────────────────────────────────────────────────────

const VISIBLE_FUNCTIONS = VMIX_COMMAND_CATALOG.filter(d => !d.hidden)

function ActionListEditor({
  label,
  actions,
  onChange,
}: {
  label: string
  actions: VmixActionItem[]
  onChange: (actions: VmixActionItem[]) => void
}) {
  const addAction = () => onChange([...actions, { function: 'PlayInput' }])
  const removeAction = (i: number) => onChange(actions.filter((_, idx) => idx !== i))
  const updateAction = (i: number, patch: Partial<VmixActionItem>) =>
    onChange(actions.map((a, idx) => idx === i ? { ...a, ...patch } : a))

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {label}
        </span>
        <button className="btn-icon" onClick={addAction} title="Adicionar comando">
          <Plus size={13} />
        </button>
      </div>
      {actions.length === 0 && (
        <p className="ui-field-hint" style={{ fontSize: 11, marginBottom: 0 }}>Nenhum comando configurado.</p>
      )}
      {actions.map((action, i) => {
        const def = VISIBLE_FUNCTIONS.find(d => d.functionName === action.function)
        return (
          <div key={i} style={{ display: 'flex', gap: 4, alignItems: 'center', marginBottom: 4, flexWrap: 'wrap' }}>
            <select
              className="ui-select"
              style={{ flex: '1 1 140px', fontSize: 12 }}
              value={action.function}
              onChange={e => updateAction(i, { function: e.target.value })}
            >
              {VISIBLE_FUNCTIONS.map(d => (
                <option key={d.functionName} value={d.functionName}>{d.label}</option>
              ))}
            </select>
            {def?.requiresInput && (
              <input
                className="ui-input"
                style={{ flex: '1 1 100px', fontSize: 12 }}
                value={action.input ?? ''}
                onChange={e => updateAction(i, { input: e.target.value || undefined })}
                placeholder="input"
              />
            )}
            {def?.requiresValue && (
              <input
                className="ui-input"
                style={{ flex: '1 1 80px', fontSize: 12 }}
                value={action.value ?? ''}
                onChange={e => updateAction(i, { value: e.target.value || undefined })}
                placeholder={def?.valueLabel ?? 'valor'}
              />
            )}
            <button
              className="btn-icon btn-icon--danger"
              onClick={() => removeAction(i)}
              title="Remover"
            >
              <Trash2 size={12} />
            </button>
          </div>
        )
      })}
    </div>
  )
}

// ── Placeholder Modal ─────────────────────────────────────────────────────────

function PlaceholderModal({
  value,
  onSave,
  onClose,
}: {
  value: AudioPlaceholder | null
  onSave: (p: AudioPlaceholder) => void
  onClose: () => void
}) {
  const [form, setForm] = useState<AudioPlaceholder>(
    value ?? { id: crypto.randomUUID(), ...DEFAULT_PLACEHOLDER }
  )

  const set = <K extends keyof AudioPlaceholder>(k: K, v: AudioPlaceholder[K]) =>
    setForm(f => ({ ...f, [k]: v }))

  const handleBrowse = async () => {
    const path = await window.spotmaster?.browseVideoFile()
    if (path) {
      set('filePath', path)
      if (!form.name) {
        const filename = path.split(/[\\/]/).pop() ?? path
        set('name', filename.replace(/\.[^.]+$/, ''))
      }
    }
  }

  const isValid = form.name.trim() &&
    (form.type === 'file' ? !!form.filePath?.trim() : !!form.inputName?.trim())

  return (
    <Modal
      title={value ? 'Editar Placeholder' : 'Novo Placeholder'}
      onClose={onClose}
      minWidth={460}
      actions={
        <>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" onClick={() => onSave(form)} disabled={!isValid}>Salvar</Button>
        </>
      }
    >
      <Section>
        <Field label="Nome de exibição">
          <input
            className="ui-input"
            value={form.name}
            onChange={e => set('name', e.target.value)}
            placeholder="ex: Vinheta 1"
            autoFocus
          />
        </Field>
        <Field label="Tipo de fonte">
          <select
            className="ui-select"
            value={form.type}
            onChange={e => set('type', e.target.value as AudioPlaceholderType)}
          >
            <option value="file">Arquivo no disco</option>
            <option value="vmix_input">Input existente no vMix</option>
          </select>
        </Field>
        {form.type === 'file' ? (
          <Field label="Caminho do arquivo">
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                className="ui-input"
                value={form.filePath ?? ''}
                onChange={e => set('filePath', e.target.value)}
                placeholder="C:\Áudio\vinheta.mp3"
                style={{ flex: 1 }}
              />
              <Button variant="ghost" onClick={handleBrowse} title="Procurar arquivo">
                <FolderOpen size={15} />
              </Button>
            </div>
          </Field>
        ) : (
          <Field label="Nome do input no vMix">
            <input
              className="ui-input"
              value={form.inputName ?? ''}
              onChange={e => set('inputName', e.target.value)}
              placeholder="ex: BGM Audio"
            />
          </Field>
        )}
        <FieldRow>
          <Field label="Duração (s)">
            <input
              className="ui-input"
              type="number"
              min={0}
              step={1}
              value={form.duration ?? ''}
              onChange={e => set('duration', e.target.value ? Number(e.target.value) : undefined)}
              placeholder="automático"
            />
          </Field>
          <Field label="Modo (sobrescreve camada)">
            <select
              className="ui-select"
              value={form.mode ?? ''}
              onChange={e => set('mode', (e.target.value as AudioLayerMode) || undefined)}
            >
              <option value="">Herdar da camada</option>
              <option value="parallel">Paralelo (sem corte)</option>
              <option value="replace">Substituir PGM</option>
            </select>
          </Field>
        </FieldRow>
      </Section>
    </Modal>
  )
}

// ── Layer Modal ────────────────────────────────────────────────────────────────

function LayerModal({
  value,
  onSave,
  onClose,
}: {
  value: AudioLayer | null
  onSave: (l: AudioLayer) => void
  onClose: () => void
}) {
  const [form, setForm] = useState<AudioLayer>(
    value ?? { id: crypto.randomUUID(), ...DEFAULT_LAYER }
  )
  const [editingPlaceholder, setEditingPlaceholder] = useState<AudioPlaceholder | null | 'new'>(null)

  const set = <K extends keyof AudioLayer>(k: K, v: AudioLayer[K]) =>
    setForm(f => ({ ...f, [k]: v }))

  const category = form.category ?? 'outros'
  const isTrilha = category === 'trilha'

  const handleCategoryChange = (cat: AudioLayerCategory) => {
    if (cat === 'trilha') {
      setForm(f => ({ ...f, category: cat, playMode: 'loop', stopOnNewTrigger: true, sourceType: 'round_robin' }))
    } else {
      setForm(f => ({ ...f, category: cat }))
    }
  }

  const handleSavePlaceholder = (p: AudioPlaceholder) => {
    const exists = form.placeholders.some(x => x.id === p.id)
    set('placeholders', exists
      ? form.placeholders.map(x => x.id === p.id ? p : x)
      : [...form.placeholders, p]
    )
    setEditingPlaceholder(null)
  }

  const movePlaceholder = (idx: number, dir: -1 | 1) => {
    const arr = [...form.placeholders]
    const swap = idx + dir
    if (swap < 0 || swap >= arr.length) return
    ;[arr[idx], arr[swap]] = [arr[swap], arr[idx]]
    set('placeholders', arr)
  }

  const isValid = form.name.trim() &&
    (form.sourceType === 'fixed_input'
      ? !!form.fixedInputName?.trim()
      : form.placeholders.length > 0
    )

  return (
    <>
      <Modal
        title={value ? 'Editar Camada' : 'Nova Camada de Áudio'}
        onClose={onClose}
        minWidth={560}
        actions={
          <>
            <Button variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button variant="primary" onClick={() => onSave(form)} disabled={!isValid}>Salvar</Button>
          </>
        }
      >
        <Section title="Configuração da camada">
          <FieldRow>
            <Field label="Nome da camada">
              <input
                className="ui-input"
                value={form.name}
                onChange={e => set('name', e.target.value)}
                placeholder="ex: Vinhetas horárias"
                autoFocus
                style={{ flex: 2 }}
              />
            </Field>
            <Field label="Categoria">
              <select
                className="ui-select"
                value={category}
                onChange={e => handleCategoryChange(e.target.value as AudioLayerCategory)}
              >
                <option value="vinheta">Vinheta</option>
                <option value="musica">Música</option>
                <option value="trilha">Trilha (background loop)</option>
                <option value="outros">Outros</option>
              </select>
            </Field>
          </FieldRow>

          <FieldRow>
            <Field label="Modo padrão">
              <select
                className="ui-select"
                value={form.defaultMode}
                onChange={e => set('defaultMode', e.target.value as AudioLayerMode)}
              >
                <option value="parallel">Paralelo (sem corte no PGM)</option>
                <option value="replace">Substituir PGM</option>
              </select>
            </Field>
            {!isTrilha && (
              <Field label="Tipo de fonte">
                <select
                  className="ui-select"
                  value={form.sourceType}
                  onChange={e => set('sourceType', e.target.value as AudioLayerSourceType)}
                >
                  <option value="round_robin">Round-robin (lista)</option>
                  <option value="fixed_input">Input fixo no vMix</option>
                </select>
              </Field>
            )}
          </FieldRow>

          {!isTrilha && (
            <FieldRow>
              <Field label="Modo de reprodução">
                <select
                  className="ui-select"
                  value={form.playMode ?? 'once'}
                  onChange={e => set('playMode', e.target.value as AudioLayerPlayMode)}
                >
                  <option value="once">Uma vez</option>
                  <option value="loop">Loop contínuo</option>
                </select>
              </Field>
              <Field label="Comportamento">
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer', paddingTop: 4 }}>
                  <input
                    type="checkbox"
                    checked={form.stopOnNewTrigger ?? false}
                    onChange={e => set('stopOnNewTrigger', e.target.checked)}
                  />
                  Para ao disparar outra camada
                </label>
              </Field>
            </FieldRow>
          )}

          {isTrilha && (
            <p className="ui-field-hint" style={{ fontSize: 11 }}>
              ⟳ Trilha: <strong>Loop contínuo</strong> ativado · Para quando outra camada é disparada
            </p>
          )}

          {form.sourceType === 'fixed_input' && !isTrilha && (
            <Field label="Nome do input fixo no vMix">
              <input
                className="ui-input"
                value={form.fixedInputName ?? ''}
                onChange={e => set('fixedInputName', e.target.value)}
                placeholder="ex: Background Music"
              />
            </Field>
          )}

          <FieldRow>
            <Field label="Canal de overlay (paralelo)">
              <select
                className="ui-select"
                value={form.overlayChannel ?? ''}
                onChange={e => set('overlayChannel', e.target.value ? Number(e.target.value) as 1 | 2 | 3 | 4 : null)}
              >
                <option value="">Nenhum (só áudio)</option>
                <option value="1">Overlay 1</option>
                <option value="2">Overlay 2</option>
                <option value="3">Overlay 3</option>
                <option value="4">Overlay 4</option>
              </select>
            </Field>
            <Field label="Volume padrão (0–100)">
              <input
                className="ui-input"
                type="number"
                min={0}
                max={100}
                value={form.volume ?? ''}
                onChange={e => set('volume', e.target.value ? Number(e.target.value) : undefined)}
                placeholder="não alterar"
              />
            </Field>
          </FieldRow>
        </Section>

        {(form.sourceType === 'round_robin' || isTrilha) && (
          <Section title={isTrilha ? 'Arquivo em loop' : 'Placeholders (ordem = round-robin)'}>
            {form.placeholders.length === 0 && (
              <p className="ui-field-hint">
                {isTrilha ? 'Nenhum arquivo. Adicione um arquivo de trilha.' : 'Nenhum placeholder. Adicione ao menos um.'}
              </p>
            )}
            {form.placeholders.map((p, idx) => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                {!isTrilha && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <button className="btn-icon" onClick={() => movePlaceholder(idx, -1)} disabled={idx === 0} title="Subir">
                      <ChevronUp size={13} />
                    </button>
                    <button className="btn-icon" onClick={() => movePlaceholder(idx, 1)} disabled={idx === form.placeholders.length - 1} title="Descer">
                      <ChevronDown size={13} />
                    </button>
                  </div>
                )}
                <span style={{ flex: 1, fontSize: 13 }}>
                  <strong>{p.name}</strong>
                  <span style={{ color: 'var(--text-muted)', marginLeft: 6, fontSize: 11 }}>
                    {p.type === 'file' ? p.filePath?.split(/[\\/]/).pop() : p.inputName}
                    {p.duration ? ` · ${p.duration}s` : ''}
                    {p.mode ? ` · ${p.mode === 'parallel' ? 'paralelo' : 'substituir'}` : ''}
                  </span>
                </span>
                <button className="btn-icon" onClick={() => setEditingPlaceholder(p)} title="Editar">
                  <Edit2 size={13} />
                </button>
                <button
                  className="btn-icon btn-icon--danger"
                  onClick={() => set('placeholders', form.placeholders.filter(x => x.id !== p.id))}
                  title="Remover"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
            {(!isTrilha || form.placeholders.length === 0) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEditingPlaceholder('new')}
                style={{ marginTop: 4 }}
              >
                <Plus size={13} style={{ marginRight: 4 }} />
                {isTrilha ? 'Selecionar arquivo' : 'Adicionar placeholder'}
              </Button>
            )}
          </Section>
        )}

        <Section title="Comandos vMix — Pré-disparo">
          <ActionListEditor
            label="Executados antes do áudio iniciar"
            actions={form.preActions ?? []}
            onChange={v => set('preActions', v)}
          />
        </Section>

        <Section title="Comandos vMix — Pós-parada">
          <ActionListEditor
            label="Executados após o áudio parar"
            actions={form.postActions ?? []}
            onChange={v => set('postActions', v)}
          />
        </Section>
      </Modal>

      {editingPlaceholder !== null && (
        <PlaceholderModal
          value={editingPlaceholder === 'new' ? null : editingPlaceholder}
          onSave={handleSavePlaceholder}
          onClose={() => setEditingPlaceholder(null)}
        />
      )}
    </>
  )
}

// ── Main Tab ──────────────────────────────────────────────────────────────────

export default function AudioLayersTab() {
  const { state, dispatch } = useApp()
  const [editingLayer, setEditingLayer] = useState<AudioLayer | null | 'new'>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const layers = state.audioLayers

  const handleSave = (layer: AudioLayer) => {
    dispatch({ type: 'UPSERT_AUDIO_LAYER', payload: layer })
    // saveToStorage called via useEffect in AppContext
    setEditingLayer(null)
  }

  const handleDelete = (id: string) => {
    dispatch({ type: 'DELETE_AUDIO_LAYER', payload: id })
    setConfirmDelete(null)
  }

  const MODE_LABEL: Record<AudioLayerMode, string> = { parallel: 'Paralelo', replace: 'Substituir PGM' }
  const SOURCE_LABEL: Record<AudioLayerSourceType, string> = { round_robin: 'Round-robin', fixed_input: 'Input fixo' }
  const CATEGORY_LABEL: Record<AudioLayerCategory, string> = { vinheta: 'Vinheta', musica: 'Música', trilha: 'Trilha', outros: 'Outros' }
  const CATEGORY_CHIP: Record<AudioLayerCategory, string> = { vinheta: 'chip--blue', musica: 'chip--green', trilha: 'chip--purple', outros: 'chip--gray' }

  return (
    <div style={{ padding: '0 16px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <Button variant="primary" onClick={() => setEditingLayer('new')}>
          <Plus size={14} style={{ marginRight: 6 }} />
          Nova Camada
        </Button>
      </div>

      {layers.length === 0 ? (
        <div className="ui-empty-state">
          <p>Nenhuma camada configurada.</p>
          <p className="ui-field-hint">Crie uma camada para controlar áudio independente no vMix.</p>
        </div>
      ) : (
        <div className="audiopro-layers-list">
          {layers.map(layer => (
            <div key={layer.id} className="audiopro-layer-card">
              <div className="audiopro-layer-info">
                <strong className="audiopro-layer-name">{layer.name}</strong>
                <div className="audiopro-layer-meta">
                  {(() => {
                    const cat = layer.category ?? 'outros'
                    return <span className={`chip ${CATEGORY_CHIP[cat]}`}>{CATEGORY_LABEL[cat]}</span>
                  })()}
                  <span className="chip chip--blue">{MODE_LABEL[layer.defaultMode]}</span>
                  {!(layer.category === 'trilha') && (
                    <span className="chip chip--gray">{SOURCE_LABEL[layer.sourceType]}</span>
                  )}
                  {layer.sourceType === 'fixed_input' && layer.fixedInputName && (
                    <span className="ui-field-hint" style={{ marginLeft: 4 }}>{layer.fixedInputName}</span>
                  )}
                  {layer.sourceType === 'round_robin' && (
                    <span className="ui-field-hint" style={{ marginLeft: 4 }}>
                      {layer.placeholders.length} placeholder{layer.placeholders.length !== 1 ? 's' : ''}
                    </span>
                  )}
                  {layer.overlayChannel && (
                    <span className="chip chip--green">Overlay {layer.overlayChannel}</span>
                  )}
                  {(layer.playMode === 'loop') && (
                    <span className="chip chip--amber">⟳ loop</span>
                  )}
                  {layer.volume !== undefined && (
                    <span className="ui-field-hint" style={{ marginLeft: 4 }}>vol {layer.volume}%</span>
                  )}
                </div>
              </div>
              <div className="audiopro-layer-actions">
                <button className="btn-icon" onClick={() => setEditingLayer(layer)} title="Editar">
                  <Edit2 size={15} />
                </button>
                <button
                  className="btn-icon btn-icon--danger"
                  onClick={() => setConfirmDelete(layer.id)}
                  title="Excluir"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editingLayer !== null && (
        <LayerModal
          value={editingLayer === 'new' ? null : editingLayer}
          onSave={handleSave}
          onClose={() => setEditingLayer(null)}
        />
      )}

      {confirmDelete && (
        <Modal
          title="Excluir camada"
          onClose={() => setConfirmDelete(null)}
          minWidth={360}
          actions={
            <>
              <Button variant="ghost" onClick={() => setConfirmDelete(null)}>Cancelar</Button>
              <Button variant="danger" onClick={() => handleDelete(confirmDelete)}>Excluir</Button>
            </>
          }
        >
          <p>Deseja excluir esta camada? Esta ação não pode ser desfeita.</p>
        </Modal>
      )}
    </div>
  )
}
