import { useState } from 'react'
import { Music, Plus, Edit2, Trash2, FolderOpen, Check, Image, MonitorPlay } from 'lucide-react'
import { useApp } from '../../store/AppContext'
import type { AudioStyle, AudioStylePlaceholderType } from '../../types'
import Button from '../ui/Button'
import Modal from '../ui/Modal'
import { Field, FieldRow } from '../ui/Field'
import PageHeader from '../ui/PageHeader'

// ── Paleta de cores ───────────────────────────────────────────────────────────
const COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#14b8a6', '#3b82f6', '#8b5cf6', '#ec4899',
  '#6b7280', '#f5f5f5',
]

const PLACEHOLDER_LABELS: Record<AudioStylePlaceholderType, string> = {
  none:       'Nenhum (sem placeholder)',
  image:      'Imagem (SetImage no vMix)',
  vmix_input: 'Input vMix (ativar overlay)',
}

// ── Modal criar/editar AudioStyle ─────────────────────────────────────────────
function AudioStyleModal({
  initial,
  onSave,
  onClose,
}: {
  initial: AudioStyle | null
  onSave: (s: AudioStyle) => void
  onClose: () => void
}) {
  const [form, setForm] = useState<Omit<AudioStyle, 'id' | 'createdAt'>>({
    name:                initial?.name ?? '',
    folderPath:          initial?.folderPath ?? '',
    includeSubfolders:   initial?.includeSubfolders ?? true,
    color:               initial?.color ?? COLORS[0],
    isVinheta:           initial?.isVinheta ?? false,
    placeholderType:     initial?.placeholderType ?? 'none',
    placeholderImage:    initial?.placeholderImage ?? '',
    placeholderInputName: initial?.placeholderInputName ?? '',
    overlayChannel:      initial?.overlayChannel ?? 1,
  })

  const set = (patch: Partial<typeof form>) => setForm(f => ({ ...f, ...patch }))
  const valid = form.name.trim() !== '' && form.folderPath.trim() !== ''

  const handleBrowseFolder = async () => {
    const fp = await window.spotmaster?.browseFolder()
    if (fp) set({ folderPath: fp })
  }

  const handleBrowseImage = async () => {
    const fp = await window.spotmaster?.browseVideoFile()
    if (fp) set({ placeholderImage: fp })
  }

  return (
    <Modal
      title={initial ? 'Editar Estilo de Áudio' : 'Novo Estilo de Áudio'}
      onClose={onClose}
      maxWidth={520}
      actions={
        <>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" disabled={!valid} onClick={() => onSave({
            id: initial?.id ?? crypto.randomUUID(),
            createdAt: initial?.createdAt ?? new Date().toISOString(),
            ...form,
          })}>
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
            placeholder="Ex: Sertanejo, Internacionais, MPB…"
            autoFocus
          />
        </Field>

        <Field label="Pasta de áudios *">
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              className="ui-input"
              value={form.folderPath}
              readOnly
              placeholder="Selecione a pasta que contém os áudios…"
              style={{ flex: 1, cursor: 'default' }}
            />
            <Button variant="secondary" onClick={handleBrowseFolder} icon={<FolderOpen size={14} />}>
              Procurar
            </Button>
          </div>
        </Field>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', userSelect: 'none' }}>
          <input
            type="checkbox"
            checked={form.includeSubfolders}
            onChange={e => set({ includeSubfolders: e.target.checked })}
          />
          Incluir subpastas
        </label>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', userSelect: 'none', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 12px' }}>
          <input
            type="checkbox"
            checked={form.isVinheta ?? false}
            onChange={e => set({ isVinheta: e.target.checked })}
          />
          <span>
            <strong>Este estilo é Vinheta</strong>
            <span style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
              Itens gerados pelo AutoProg receberão tipo <code>VHT</code> — o CG Musical os ignora automaticamente
            </span>
          </span>
        </label>

        <Field label="Cor de identificação">
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {COLORS.map(c => (
              <button
                key={c}
                onClick={() => set({ color: c })}
                style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: c, border: form.color === c ? '3px solid var(--text-primary)' : '2px solid transparent',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                {form.color === c && <Check size={14} color={c === '#f5f5f5' ? '#111' : '#fff'} />}
              </button>
            ))}
          </div>
        </Field>

        {/* Placeholder visual */}
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>
            Placeholder Visual no vMix
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            Quando um áudio deste estilo tocar, o VTMaster ativa automaticamente
            um visual no vMix — assim o vídeo nunca fica com tela preta.
          </div>

          <Field label="Tipo de placeholder">
            <select
              className="ui-input"
              value={form.placeholderType}
              onChange={e => set({ placeholderType: e.target.value as AudioStylePlaceholderType })}
            >
              {(Object.entries(PLACEHOLDER_LABELS) as [AudioStylePlaceholderType, string][]).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </Field>

          {form.placeholderType !== 'none' && (
            <>
              <FieldRow>
                <Field label="Canal de overlay (1–4)">
                  <input
                    className="ui-input"
                    type="number"
                    min={1} max={4}
                    value={form.overlayChannel ?? 1}
                    onChange={e => set({ overlayChannel: Number(e.target.value) })}
                  />
                </Field>
                <Field label="Input vMix (onde mostrar)">
                  <input
                    className="ui-input"
                    value={form.placeholderInputName ?? ''}
                    onChange={e => set({ placeholderInputName: e.target.value })}
                    placeholder="Ex: BG Sertanejo, Logo Estilo…"
                  />
                </Field>
              </FieldRow>

              {form.placeholderType === 'image' && (
                <Field label="Arquivo de imagem">
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input
                      className="ui-input"
                      value={form.placeholderImage ?? ''}
                      readOnly
                      placeholder="Selecione a imagem de fundo…"
                      style={{ flex: 1, cursor: 'default' }}
                    />
                    <Button variant="secondary" onClick={handleBrowseImage} icon={<Image size={14} />}>
                      Procurar
                    </Button>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
                    O VTMaster usará <code>SetImage</code> neste arquivo e ativará o overlay no canal configurado.
                    O "Input vMix" deve ser um input de tipo Image/GT já existente no vMix.
                  </div>
                </Field>
              )}

              {form.placeholderType === 'vmix_input' && (
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 10px' }}>
                  O VTMaster ativará <code>OverlayInput{form.overlayChannel}In</code> com o input configurado acima.
                  Pré-configure o input no vMix (imagem, vídeo em loop, GT) antes de usar.
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </Modal>
  )
}

// ── AudioStylesTab ─────────────────────────────────────────────────────────────
export default function AudioStylesTab() {
  const { state, dispatch } = useApp()
  const { audioStyles } = state
  const [editing, setEditing] = useState<AudioStyle | null | 'new'>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const handleSave = (s: AudioStyle) => {
    if (audioStyles.find(a => a.id === s.id)) {
      dispatch({ type: 'UPDATE_AUDIO_STYLE', payload: s })
    } else {
      dispatch({ type: 'ADD_AUDIO_STYLE', payload: s })
    }
    setEditing(null)
  }

  const PLACEHOLDER_ICON: Record<AudioStylePlaceholderType, React.ReactNode> = {
    none:       <span style={{ color: 'var(--text-secondary)', fontSize: 11 }}>sem placeholder</span>,
    image:      <><Image size={12} /> imagem</>,
    vmix_input: <><MonitorPlay size={12} /> input vMix</>,
  }

  const shortFolder = (fp: string) => fp.split(/[\\/]/).pop() ?? fp

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <PageHeader
        title="Estilos de Áudio"
        subtitle={`${audioStyles.length} estilo(s) cadastrado(s)`}
        actions={
          <Button variant="primary" icon={<Plus size={14} />} onClick={() => setEditing('new')}>
            Novo Estilo
          </Button>
        }
      />

      {audioStyles.length === 0 ? (
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          color: 'var(--text-secondary)', gap: 14,
        }}>
          <Music size={52} strokeWidth={1} />
          <div style={{ fontSize: 15, fontWeight: 500 }}>Nenhum estilo de áudio</div>
          <div style={{ fontSize: 13, textAlign: 'center', maxWidth: 400, lineHeight: 1.6 }}>
            Cadastre estilos apontando para pastas de áudio. Para cada estilo, configure
            um <strong>placeholder visual</strong> que aparece no vMix enquanto o áudio toca —
            eliminando a tela preta.
          </div>
          <Button variant="primary" icon={<Plus size={14} />} onClick={() => setEditing('new')}>
            Cadastrar primeiro estilo
          </Button>
        </div>
      ) : (
        <div style={{ flex: 1, overflow: 'auto', padding: '0 0 16px 0' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12, padding: 4 }}>
            {audioStyles.map(style => (
              <div
                key={style.id}
                style={{
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border)',
                  borderLeft: `4px solid ${style.color ?? '#ef4444'}`,
                  borderRadius: 8,
                  padding: '12px 14px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 12,
                }}
              >
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: style.color ?? '#ef4444',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, marginTop: 2,
                }}>
                  <Music size={18} color="#fff" />
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{style.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={style.folderPath}>
                    📁 {shortFolder(style.folderPath)}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                    Overlay: {PLACEHOLDER_ICON[style.placeholderType]}
                    {style.placeholderType !== 'none' && style.overlayChannel && (
                      <span style={{ color: 'var(--accent)' }}> canal {style.overlayChannel}</span>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  <Button variant="ghost" size="sm" icon={<Edit2 size={13} />} iconOnly onClick={() => setEditing(style)} />
                  <Button variant="ghost" size="sm" icon={<Trash2 size={13} />} iconOnly onClick={() => setDeletingId(style.id)} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {editing && (
        <AudioStyleModal
          initial={editing === 'new' ? null : editing}
          onSave={handleSave}
          onClose={() => setEditing(null)}
        />
      )}

      {deletingId && (
        <Modal
          title="Excluir estilo de áudio"
          onClose={() => setDeletingId(null)}
          maxWidth={380}
          actions={
            <>
              <Button variant="ghost" onClick={() => setDeletingId(null)}>Cancelar</Button>
              <Button variant="danger" onClick={() => { dispatch({ type: 'DELETE_AUDIO_STYLE', payload: deletingId }); setDeletingId(null) }}>
                Excluir
              </Button>
            </>
          }
        >
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            Remove o estilo do catálogo. Os arquivos no disco não são afetados.
          </div>
        </Modal>
      )}
    </div>
  )
}
