import { useState } from 'react'
import { Check, Edit2, Film, FolderOpen, Plus, Trash2 } from 'lucide-react'
import { useApp } from '../../store/AppContext'
import type { VideoStyle } from '../../types'
import Button from '../ui/Button'
import Modal from '../ui/Modal'
import { Field } from '../ui/Field'
import PageHeader from '../ui/PageHeader'

const COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#14b8a6', '#3b82f6', '#8b5cf6', '#ec4899',
  '#6b7280', '#f5f5f5',
]

function folderName(path: string) {
  return path.split(/[\\/]/).pop() ?? path
}

function VideoStyleModal({
  initial,
  onSave,
  onClose,
}: {
  initial: VideoStyle | null
  onSave: (style: VideoStyle) => void
  onClose: () => void
}) {
  const [form, setForm] = useState<Omit<VideoStyle, 'id' | 'createdAt'>>({
    name: initial?.name ?? '',
    folderPath: initial?.folderPath ?? '',
    includeSubfolders: initial?.includeSubfolders ?? true,
    color: initial?.color ?? COLORS[0],
  })

  const set = (patch: Partial<typeof form>) => setForm(f => ({ ...f, ...patch }))
  const valid = form.name.trim() !== '' && form.folderPath.trim() !== ''

  const browseFolder = async () => {
    const folder = await window.spotmaster?.browseFolder()
    if (folder) set({ folderPath: folder })
  }

  return (
    <Modal
      title={initial ? 'Editar Estilo de Video' : 'Novo Estilo de Video'}
      onClose={onClose}
      maxWidth={500}
      actions={
        <>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button
            variant="primary"
            disabled={!valid}
            onClick={() => onSave({
              id: initial?.id ?? crypto.randomUUID(),
              createdAt: initial?.createdAt ?? new Date().toISOString(),
              ...form,
            })}
          >
            Salvar
          </Button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Field label="Nome do estilo *">
          <input
            className="ui-input"
            value={form.name}
            onChange={e => set({ name: e.target.value })}
            placeholder="Ex: Clips Pop, Institucionais, Vinhetas..."
            autoFocus
          />
        </Field>

        <Field label="Pasta de videos *">
          <div style={{ display: 'flex', gap: 6 }}>
            <input className="ui-input" value={form.folderPath} readOnly style={{ flex: 1 }} />
            <Button variant="secondary" icon={<FolderOpen size={14} />} onClick={browseFolder}>
              Procurar
            </Button>
          </div>
        </Field>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={form.includeSubfolders}
            onChange={e => set({ includeSubfolders: e.target.checked })}
          />
          Incluir subpastas
        </label>

        <Field label="Cor de identificacao">
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {COLORS.map(color => (
              <button
                key={color}
                onClick={() => set({ color })}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  background: color,
                  border: form.color === color ? '3px solid var(--text-primary)' : '2px solid transparent',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {form.color === color && <Check size={14} color={color === '#f5f5f5' ? '#111' : '#fff'} />}
              </button>
            ))}
          </div>
        </Field>
      </div>
    </Modal>
  )
}

export default function VideoProPanel() {
  const { state, dispatch } = useApp()
  const [editing, setEditing] = useState<VideoStyle | null | 'new'>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const saveStyle = (style: VideoStyle) => {
    const exists = state.videoStyles.some(s => s.id === style.id)
    dispatch({ type: exists ? 'UPDATE_VIDEO_STYLE' : 'ADD_VIDEO_STYLE', payload: style })
    setEditing(null)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <PageHeader
        title="Estilos de Video"
        subtitle={`${state.videoStyles.length} estilo(s) cadastrado(s)`}
        actions={
          <Button variant="primary" icon={<Plus size={14} />} onClick={() => setEditing('new')}>
            Novo Estilo
          </Button>
        }
      />

      {state.videoStyles.length === 0 ? (
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-secondary)',
          gap: 14,
        }}>
          <Film size={52} strokeWidth={1} />
          <div style={{ fontSize: 15, fontWeight: 500 }}>Nenhum estilo de video</div>
          <Button variant="primary" icon={<Plus size={14} />} onClick={() => setEditing('new')}>
            Cadastrar primeiro estilo
          </Button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12, padding: 4 }}>
          {state.videoStyles.map(style => (
            <div
              key={style.id}
              style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                borderLeft: `4px solid ${style.color ?? '#3b82f6'}`,
                borderRadius: 8,
                padding: '12px 14px',
                display: 'flex',
                gap: 12,
                alignItems: 'flex-start',
              }}
            >
              <div style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                background: style.color ?? '#3b82f6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>
                <Film size={18} color="#fff" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{style.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }} title={style.folderPath}>
                  {folderName(style.folderPath)}{style.includeSubfolders ? ' - subpastas' : ''}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <Button variant="ghost" size="sm" iconOnly icon={<Edit2 size={13} />} onClick={() => setEditing(style)} />
                <Button variant="ghost" size="sm" iconOnly icon={<Trash2 size={13} />} onClick={() => setDeletingId(style.id)} />
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <VideoStyleModal
          initial={editing === 'new' ? null : editing}
          onSave={saveStyle}
          onClose={() => setEditing(null)}
        />
      )}

      {deletingId && (
        <Modal
          title="Excluir estilo de video"
          onClose={() => setDeletingId(null)}
          maxWidth={380}
          actions={
            <>
              <Button variant="ghost" onClick={() => setDeletingId(null)}>Cancelar</Button>
              <Button variant="danger" onClick={() => { dispatch({ type: 'DELETE_VIDEO_STYLE', payload: deletingId }); setDeletingId(null) }}>
                Excluir
              </Button>
            </>
          }
        >
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            Remove o estilo do catalogo. Os arquivos no disco nao sao afetados.
          </div>
        </Modal>
      )}
    </div>
  )
}
