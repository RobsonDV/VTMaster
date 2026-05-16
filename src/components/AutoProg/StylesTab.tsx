import { useState } from 'react'
import { Edit2, Trash2, Plus, Folder } from 'lucide-react'
import { useApp } from '../../store/AppContext'
import type { MusicStyle, ArtistParseRule } from '../../types'
import Button from '../ui/Button'
import Modal from '../ui/Modal'
import { Field, FieldRow } from '../ui/Field'
import PageHeader from '../ui/PageHeader'

const COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899',
  '#14b8a6', '#a855f7',
]

const PARSE_RULE_LABELS: Record<ArtistParseRule, string> = {
  filename_dash:        'Arquivo: "Artista - Título.mp3"',
  filename_underscore:  'Arquivo: "Artista_Título.mp3"',
  subfolder:            'Nome da Subpasta',
  none:                 'Não extrair artista',
}

const DEFAULT_STYLE: Omit<MusicStyle, 'id'> = {
  name: '',
  folderPath: '',
  includeSubfolders: false,
  artistParseRule: 'filename_dash',
  cooldownDays: 7,
  color: COLORS[0],
  isJingle: false,
}

// ─── Style Form Modal ─────────────────────────────────────────────────────────

function StyleModal({
  initial,
  onSave,
  onClose,
}: {
  initial: MusicStyle | null
  onSave: (s: MusicStyle) => void
  onClose: () => void
}) {
  const [form, setForm] = useState<Omit<MusicStyle, 'id'>>(
    initial ? { ...initial } : { ...DEFAULT_STYLE },
  )

  const set = (patch: Partial<Omit<MusicStyle, 'id'>>) => setForm(f => ({ ...f, ...patch }))

  const handleBrowse = async () => {
    const folder = await window.spotmaster?.browseFolder()
    if (folder) set({ folderPath: folder })
  }

  const valid = form.name.trim() !== '' && form.folderPath.trim() !== ''

  return (
    <Modal
      title={initial ? 'Editar Estilo Musical' : 'Novo Estilo Musical'}
      onClose={onClose}
      maxWidth={480}
      actions={
        <>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button
            variant="primary"
            disabled={!valid}
            onClick={() => onSave({ id: initial?.id ?? crypto.randomUUID(), ...form })}
          >
            Salvar
          </Button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Field label="Nome do Estilo">
          <input
            className="input"
            value={form.name}
            onChange={e => set({ name: e.target.value })}
            placeholder="Ex: Rock Nacional, MPB, Flashback…"
            autoFocus
          />
        </Field>

        <Field label="Pasta dos Arquivos">
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              className="input"
              value={form.folderPath}
              onChange={e => set({ folderPath: e.target.value })}
              placeholder="Caminho da pasta…"
              style={{ flex: 1 }}
            />
            <Button variant="secondary" icon={<Folder size={14} />} onClick={handleBrowse}>
              Procurar
            </Button>
          </div>
        </Field>

        <FieldRow>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-primary)' }}>
            <input
              type="checkbox"
              checked={form.includeSubfolders}
              onChange={e => set({ includeSubfolders: e.target.checked })}
            />
            Incluir subpastas
          </label>
        </FieldRow>

        <Field label="Extrair nome do artista de">
          <select
            className="input"
            value={form.artistParseRule}
            onChange={e => set({ artistParseRule: e.target.value as ArtistParseRule })}
          >
            {(Object.keys(PARSE_RULE_LABELS) as ArtistParseRule[]).map(r => (
              <option key={r} value={r}>{PARSE_RULE_LABELS[r]}</option>
            ))}
          </select>
        </Field>

        <Field label="Cooldown (dias)" hint="Não repetir o mesmo arquivo por X dias">
          <input
            className="input"
            type="number"
            min={0}
            max={365}
            value={form.cooldownDays}
            onChange={e => set({ cooldownDays: Math.max(0, parseInt(e.target.value) || 0) })}
            style={{ width: 100 }}
          />
        </Field>

        <Field label="Cor de identificação">
          <div className="ap-color-swatches">
            {COLORS.map(c => (
              <button
                key={c}
                className={`ap-color-swatch ${form.color === c ? 'selected' : ''}`}
                style={{ background: c }}
                title={c}
                onClick={() => set({ color: c })}
              />
            ))}
          </div>
        </Field>

        <FieldRow>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-primary)' }}>
            <input
              type="checkbox"
              checked={form.isJingle ?? false}
              onChange={e => set({ isJingle: e.target.checked })}
            />
            É um estilo de jingles/vinhetas
          </label>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginLeft: 24, marginTop: 2 }}>
            Jingles são inseridos automaticamente a cada N músicas, configurado na Sequência.
          </div>
        </FieldRow>
      </div>
    </Modal>
  )
}

// ─── Styles Tab ───────────────────────────────────────────────────────────────

export default function StylesTab() {
  const { state, dispatch } = useApp()
  const [editing, setEditing] = useState<MusicStyle | null | 'new'>(null)

  const handleSave = (style: MusicStyle) => {
    const exists = state.musicStyles.some(s => s.id === style.id)
    dispatch({ type: exists ? 'UPDATE_MUSIC_STYLE' : 'ADD_MUSIC_STYLE', payload: style })
    setEditing(null)
  }

  const handleDelete = (id: string) => {
    if (!confirm('Excluir este estilo musical?')) return
    dispatch({ type: 'DELETE_MUSIC_STYLE', payload: id })
  }

  return (
    <div>
      <PageHeader
        title="Estilos Musicais"
        subtitle="Cadastre as pastas de áudio e configure regras de cooldown e extração de artista."
        actions={
          <Button variant="primary" icon={<Plus size={14} />} onClick={() => setEditing('new')}>
            Novo Estilo
          </Button>
        }
      />

      {state.musicStyles.length === 0 ? (
        <div className="ap-empty">
          Nenhum estilo cadastrado.<br />Clique em <strong>Novo Estilo</strong> para começar.
        </div>
      ) : (
        <div className="ap-card-list">
          {state.musicStyles.map(style => (
            <div key={style.id} className="ap-card">
              <div
                className="ap-card-color"
                style={{ background: style.color ?? '#3b82f6' }}
              />
              <div className="ap-card-body">
                <div className="ap-card-title">{style.name}</div>
                <div className="ap-card-meta">
                  {style.folderPath || '(pasta não configurada)'}
                  {style.includeSubfolders && ' — inclui subpastas'}
                  {' · '}Cooldown: {style.cooldownDays}d
                  {' · '}{PARSE_RULE_LABELS[style.artistParseRule]}
                </div>
              </div>
              <div className="ap-card-actions">
                <Button variant="ghost" iconOnly icon={<Edit2 size={14} />} onClick={() => setEditing(style)} />
                <Button variant="ghost" iconOnly icon={<Trash2 size={14} />} onClick={() => handleDelete(style.id)} />
              </div>
            </div>
          ))}
        </div>
      )}

      {editing !== null && (
        <StyleModal
          initial={editing === 'new' ? null : editing}
          onSave={handleSave}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}
