import { useState, useMemo } from 'react'
import { Music, Plus, Edit2, Trash2, AlertTriangle, RefreshCw, Tag, X, FolderOpen } from 'lucide-react'
import { useApp } from '../../store/AppContext'
import type { MusicTrack, TrackMetadataResult } from '../../types'
import Button from '../ui/Button'
import Modal from '../ui/Modal'
import { Field, FieldRow } from '../ui/Field'
import PageHeader from '../ui/PageHeader'

// ── Constantes ────────────────────────────────────────────────────────────────

const ENERGY_LABELS = ['', '1 — Calma', '2 — Suave', '3 — Média', '4 — Animada', '5 — Alta Energia']

function energyDots(energy?: number) {
  if (!energy) return null
  return (
    <span style={{ display: 'inline-flex', gap: 2 }}>
      {[1, 2, 3, 4, 5].map(n => (
        <span
          key={n}
          style={{
            width: 8, height: 8,
            borderRadius: '50%',
            background: n <= energy ? 'var(--accent)' : 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            display: 'inline-block',
          }}
        />
      ))}
    </span>
  )
}

function formatDuration(seconds?: number) {
  if (!seconds) return '—'
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

// ── TagInput ─────────────────────────────────────────────────────────────────

function TagInput({ tags, onChange }: { tags: string[]; onChange: (t: string[]) => void }) {
  const [input, setInput] = useState('')

  const addTag = () => {
    const tag = input.trim().toLowerCase()
    if (tag && !tags.includes(tag)) onChange([...tags, tag])
    setInput('')
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
        <input
          className="input"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Nova tag…"
          style={{ flex: 1 }}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag() } }}
        />
        <Button variant="secondary" size="sm" onClick={addTag} disabled={!input.trim()}>
          +
        </Button>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {tags.map(tag => (
          <span
            key={tag}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              background: 'var(--bg-secondary)', borderRadius: 12,
              padding: '2px 8px', fontSize: 12, color: 'var(--text-secondary)',
              border: '1px solid var(--border)',
            }}
          >
            <Tag size={10} />
            {tag}
            <button
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--text-secondary)', lineHeight: 1 }}
              onClick={() => onChange(tags.filter(t => t !== tag))}
            >
              <X size={10} />
            </button>
          </span>
        ))}
      </div>
    </div>
  )
}

// ── TrackEditModal ────────────────────────────────────────────────────────────

function TrackEditModal({
  initial,
  onSave,
  onClose,
}: {
  initial: Partial<MusicTrack> | null
  onSave: (t: MusicTrack) => void
  onClose: () => void
}) {
  const [form, setForm] = useState<Omit<MusicTrack, 'id'>>(() => ({
    filePath: initial?.filePath ?? '',
    filename: initial?.filename ?? '',
    title:    initial?.title    ?? '',
    artist:   initial?.artist   ?? '',
    album:    initial?.album    ?? '',
    year:     initial?.year,
    genre:    initial?.genre    ?? '',
    energy:   initial?.energy,
    language: initial?.language ?? '',
    bpm:      initial?.bpm,
    tags:     initial?.tags     ?? [],
    playCount: initial?.playCount ?? 0,
    duration:  initial?.duration,
    md5:       initial?.md5,
    missing:   initial?.missing,
    lastAiredDate: initial?.lastAiredDate,
  }))
  const [loadingMeta, setLoadingMeta] = useState(false)

  const set = (patch: Partial<Omit<MusicTrack, 'id'>>) => setForm(f => ({ ...f, ...patch }))

  const handleBrowse = async () => {
    const fp = await window.spotmaster?.browseVideoFile()
    if (!fp) return
    const filename = fp.split(/[\\/]/).pop() ?? fp
    const noExt = filename.replace(/\.[^.]+$/, '')
    set({ filePath: fp, filename, title: noExt })
    // Tentar ler metadados automaticamente
    setLoadingMeta(true)
    try {
      const meta: TrackMetadataResult | null = await window.spotmaster?.readTrackMetadata(fp)
      if (meta) {
        set({
          filePath: fp,
          filename,
          title:    meta.title    ?? noExt,
          artist:   meta.artist   ?? '',
          album:    meta.album    ?? '',
          year:     meta.year     ?? undefined,
          genre:    meta.genre    ?? '',
          bpm:      meta.bpm      ?? undefined,
          duration: meta.duration ?? undefined,
        })
      } else {
        set({ filePath: fp, filename, title: noExt })
      }
    } finally {
      setLoadingMeta(false)
    }
  }

  const valid = form.filePath.trim() !== '' && form.title.trim() !== ''

  const isNew = !initial?.id

  return (
    <Modal
      title={isNew ? 'Adicionar Faixa' : 'Editar Faixa'}
      onClose={onClose}
      maxWidth={540}
      actions={
        <>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button
            variant="primary"
            disabled={!valid || loadingMeta}
            onClick={() => onSave({ id: initial?.id ?? crypto.randomUUID(), ...form })}
          >
            Salvar
          </Button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Field label="Arquivo">
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              className="input"
              value={form.filename || form.filePath}
              readOnly
              placeholder="Nenhum arquivo selecionado…"
              style={{ flex: 1, cursor: 'default' }}
            />
            <Button variant="secondary" onClick={handleBrowse} disabled={loadingMeta}>
              {loadingMeta ? 'Lendo…' : 'Procurar'}
            </Button>
          </div>
          {form.filePath && (
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 3, wordBreak: 'break-all' }}>
              {form.filePath}
            </div>
          )}
          {isNew && (
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 3 }}>
              Metadados lidos automaticamente das tags ID3/MP4 quando disponíveis. Para vídeos sem tags, preencha manualmente.
            </div>
          )}
        </Field>

        <FieldRow>
          <Field label="Título">
            <input
              className="input"
              value={form.title}
              onChange={e => set({ title: e.target.value })}
              placeholder="Título da faixa…"
            />
          </Field>
          <Field label="Artista">
            <input
              className="input"
              value={form.artist}
              onChange={e => set({ artist: e.target.value })}
              placeholder="Nome do artista…"
            />
          </Field>
        </FieldRow>

        <FieldRow>
          <Field label="Álbum">
            <input
              className="input"
              value={form.album ?? ''}
              onChange={e => set({ album: e.target.value })}
              placeholder="Álbum…"
            />
          </Field>
          <Field label="Ano">
            <input
              className="input"
              type="number"
              min={1900}
              max={2099}
              value={form.year ?? ''}
              onChange={e => set({ year: e.target.value ? Number(e.target.value) : undefined })}
              placeholder="Ex: 2024"
            />
          </Field>
        </FieldRow>

        <FieldRow>
          <Field label="Gênero">
            <input
              className="input"
              value={form.genre ?? ''}
              onChange={e => set({ genre: e.target.value })}
              placeholder="Ex: Rock, MPB, Sertanejo…"
            />
          </Field>
          <Field label="Idioma">
            <input
              className="input"
              value={form.language ?? ''}
              onChange={e => set({ language: e.target.value })}
              placeholder="Ex: pt, en, es…"
            />
          </Field>
        </FieldRow>

        <FieldRow>
          <Field label="BPM">
            <input
              className="input"
              type="number"
              min={1}
              max={400}
              value={form.bpm ?? ''}
              onChange={e => set({ bpm: e.target.value ? Number(e.target.value) : undefined })}
              placeholder="Batidas por minuto…"
            />
          </Field>
          <Field label="Energia">
            <select
              className="input"
              value={form.energy ?? ''}
              onChange={e => set({ energy: e.target.value ? Number(e.target.value) : undefined })}
            >
              <option value="">— Não definida —</option>
              {[1, 2, 3, 4, 5].map(n => (
                <option key={n} value={n}>{ENERGY_LABELS[n]}</option>
              ))}
            </select>
          </Field>
        </FieldRow>

        <Field label="Tags">
          <TagInput tags={form.tags} onChange={tags => set({ tags })} />
        </Field>
      </div>
    </Modal>
  )
}

// ── LibraryTab ────────────────────────────────────────────────────────────────

export default function LibraryTab() {
  const { state, dispatch } = useApp()
  const { musicLibrary } = state

  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<MusicTrack | null | 'new'>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [reconciling, setReconciling] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importProgress, setImportProgress] = useState(0)
  const [importTotal, setImportTotal] = useState(0)
  const [importSummary, setImportSummary] = useState<{ added: number; skipped: number } | null>(null)
  const [reconcileResult, setReconcileResult] = useState<{
    new: Array<{ filePath: string; filename: string }>
    missing: string[]
    renamed: Array<{ oldPath: string; newPath: string; newFilename: string; md5: string }>
    duplicates: Array<{ tracks: string[] }>
  } | null>(null)

  // ── Filtro ──────────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return musicLibrary
    return musicLibrary.filter(t =>
      t.title.toLowerCase().includes(q) ||
      t.artist.toLowerCase().includes(q) ||
      (t.album ?? '').toLowerCase().includes(q) ||
      (t.genre ?? '').toLowerCase().includes(q) ||
      t.tags.some(tag => tag.includes(q))
    )
  }, [musicLibrary, search])

  const missing = musicLibrary.filter(t => t.missing).length

  // ── Salvar faixa ────────────────────────────────────────────────────────────
  const handleSave = (track: MusicTrack) => {
    dispatch({ type: 'UPSERT_MUSIC_TRACK', payload: track })
    setEditing(null)
  }

  // ── Excluir faixa ───────────────────────────────────────────────────────────
  const handleDelete = (id: string) => {
    dispatch({ type: 'DELETE_MUSIC_TRACK', payload: id })
    setDeletingId(null)
  }

  // ── Reconciliar ─────────────────────────────────────────────────────────────
  const handleReconcile = async () => {
    setReconciling(true)
    try {
      // Coleta pastas únicas de todos os estilos configurados
      const folderPaths = [...new Set(state.musicStyles.map(s => s.folderPath).filter(Boolean))]
      const result = await window.spotmaster?.reconcileMusicFolders(folderPaths, musicLibrary)
      if (result) setReconcileResult({
        new:        result.new,
        missing:    result.missing,
        renamed:    result.renamed,
        duplicates: result.duplicates,
      })
    } finally {
      setReconciling(false)
    }
  }

  // ── Importar Pasta — escaneia e insere faixas em lote ──────────────────────
  const handleImportFolder = async () => {
    const folder = await window.spotmaster?.browseFolder()
    if (!folder) return
    const includeSubfolders = window.confirm('Incluir subpastas?')
    setImporting(true)
    setImportProgress(0)
    setImportTotal(0)
    setImportSummary(null)
    try {
      const files = await window.spotmaster?.scanMusicFolder(folder, includeSubfolders) ?? []
      setImportTotal(files.length)
      const knownPaths = new Set(musicLibrary.map(t => t.filePath))
      let added = 0
      let skipped = 0
      for (let i = 0; i < files.length; i++) {
        const f = files[i]
        setImportProgress(i + 1)
        if (knownPaths.has(f.filePath)) { skipped++; continue }
        const [meta, md5]: [TrackMetadataResult | null | undefined, string | null | undefined] =
          await Promise.all([
            window.spotmaster?.readTrackMetadata(f.filePath),
            window.spotmaster?.hashFileMd5(f.filePath),
          ])
        const noExt = f.filename.replace(/\.[^.]+$/, '')
        const track: MusicTrack = {
          id: crypto.randomUUID(),
          filePath: f.filePath,
          filename: f.filename,
          title:    meta?.title  ?? noExt,
          artist:   meta?.artist ?? '',
          album:    meta?.album  ?? '',
          year:     meta?.year   ?? undefined,
          genre:    meta?.genre  ?? '',
          bpm:      meta?.bpm    ?? undefined,
          duration: meta?.duration ?? undefined,
          md5:      md5 ?? undefined,
          tags: [],
          playCount: 0,
        }
        dispatch({ type: 'UPSERT_MUSIC_TRACK', payload: track })
        added++
      }
      setImportSummary({ added, skipped })
    } finally {
      setImporting(false)
    }
  }

  // ── Adicionar faixas novas vindas da reconciliação ──────────────────────────
  const handleAddFromReconcile = async (files: Array<{ filePath: string; filename: string }>) => {
    for (const f of files) {
      const [meta, md5]: [TrackMetadataResult | null | undefined, string | null | undefined] =
        await Promise.all([
          window.spotmaster?.readTrackMetadata(f.filePath),
          window.spotmaster?.hashFileMd5(f.filePath),
        ])
      const noExt = f.filename.replace(/\.[^.]+$/, '')
      const track: MusicTrack = {
        id: crypto.randomUUID(),
        filePath: f.filePath,
        filename: f.filename,
        title:    meta?.title  ?? noExt,
        artist:   meta?.artist ?? '',
        album:    meta?.album  ?? '',
        year:     meta?.year   ?? undefined,
        genre:    meta?.genre  ?? '',
        bpm:      meta?.bpm    ?? undefined,
        duration: meta?.duration ?? undefined,
        md5:      md5 ?? undefined,
        tags: [],
        playCount: 0,
      }
      dispatch({ type: 'UPSERT_MUSIC_TRACK', payload: track })
    }
    setReconcileResult(null)
  }

  // ── Aplicar renomeação: atualiza filePath no track existente ─────────────────
  const handleApplyRename = (oldPath: string, newPath: string, newFilename: string) => {
    const track = musicLibrary.find(t => t.filePath === oldPath)
    if (!track) return
    dispatch({
      type: 'UPSERT_MUSIC_TRACK',
      payload: { ...track, filePath: newPath, filename: newFilename, missing: false },
    })
    setReconcileResult(prev => prev ? {
      ...prev,
      renamed: prev.renamed.filter(r => r.oldPath !== oldPath),
    } : null)
  }

  // ── Remover duplicata: exclui um dos caminhos da biblioteca ──────────────────
  const handleRemoveDuplicate = (keepPath: string, removePath: string) => {
    const toRemove = musicLibrary.find(t => t.filePath === removePath)
    if (toRemove) dispatch({ type: 'DELETE_MUSIC_TRACK', payload: toRemove.id })
    setReconcileResult(prev => prev ? {
      ...prev,
      duplicates: prev.duplicates.filter(d => !d.tracks.includes(removePath)),
    } : null)
    void keepPath // keepPath informativo
  }

  // ── Marcar ausentes ─────────────────────────────────────────────────────────
  const handleMarkMissing = (missingPaths: string[]) => {
    const pathSet = new Set(missingPaths)
    for (const track of musicLibrary) {
      if (pathSet.has(track.filePath)) {
        dispatch({ type: 'UPSERT_MUSIC_TRACK', payload: { ...track, missing: true } })
      }
    }
    setReconcileResult(null)
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <PageHeader
        title="Biblioteca Musical"
        subtitle={`${musicLibrary.length} faixas${missing > 0 ? ` · ${missing} ausente(s)` : ''}`}
        actions={
          <div style={{ display: 'flex', gap: 6 }}>
            <Button
              variant="secondary"
              icon={<FolderOpen size={14} />}
              onClick={handleImportFolder}
              disabled={importing}
              title="Importar todos os arquivos de áudio de uma pasta (com ou sem subpastas)"
            >
              {importing ? `Importando… ${importProgress}/${importTotal}` : 'Importar Pasta'}
            </Button>
            <Button
              variant="secondary"
              icon={<RefreshCw size={14} />}
              onClick={handleReconcile}
              disabled={reconciling}
              title={state.musicStyles.length === 0 ? 'Sem estilos cadastrados — use "Importar Pasta" para adicionar faixas sem precisar de estilos' : 'Verificar novos e ausentes nas pastas dos estilos'}
            >
              {reconciling ? 'Reconciliando…' : 'Reconciliar'}
            </Button>
            <Button
              variant="primary"
              icon={<Plus size={14} />}
              onClick={() => setEditing('new')}
            >
              Adicionar Faixa
            </Button>
          </div>
        }
      />

      {/* Progresso de importação */}
      {importing && importTotal > 0 && (
        <div style={{ marginBottom: 12, background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 16px' }}>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>
            Importando… {importProgress} de {importTotal}
          </div>
          <div style={{ height: 4, background: 'var(--bg-primary)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ height: '100%', background: 'var(--accent)', width: `${Math.round((importProgress / importTotal) * 100)}%`, transition: 'width 0.2s', borderRadius: 2 }} />
          </div>
        </div>
      )}

      {/* Resumo de importação */}
      {importSummary && !importing && (
        <div style={{
          background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8,
          padding: '10px 16px', marginBottom: 12,
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <span style={{ flex: 1, fontSize: 13 }}>
            ✅ Importação concluída: <strong>{importSummary.added}</strong> {importSummary.added === 1 ? 'faixa adicionada' : 'faixas adicionadas'}{importSummary.skipped > 0 ? ` · ${importSummary.skipped} já existiam` : ''}.
          </span>
          <Button variant="ghost" size="sm" onClick={() => setImportSummary(null)}>OK</Button>
        </div>
      )}

      {/* Resultado de Reconciliação */}
      {reconcileResult && (() => {
        const hasAny =
          reconcileResult.new.length > 0 ||
          reconcileResult.missing.length > 0 ||
          reconcileResult.renamed.length > 0 ||
          reconcileResult.duplicates.length > 0
        if (!hasAny) {
          return (
            <div style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: '10px 16px',
              marginBottom: 12,
              fontSize: 13,
              color: 'var(--text-secondary)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span>✓ Biblioteca está sincronizada com as pastas dos estilos.</span>
              <Button variant="ghost" size="sm" onClick={() => setReconcileResult(null)}>Fechar</Button>
            </div>
          )
        }
        return (
          <div style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: '12px 16px',
            margin: '0 0 12px 0',
            display: 'flex', flexDirection: 'column', gap: 10,
          }}>
            <div style={{ fontWeight: 600, fontSize: 13 }}>Resultado da Reconciliação</div>

            {/* Novos */}
            {reconcileResult.new.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: 'var(--success, #22c55e)', fontSize: 13, flex: 1 }}>
                  +{reconcileResult.new.length} {reconcileResult.new.length === 1 ? 'arquivo novo' : 'arquivos novos'} encontrado(s)
                </span>
                <Button variant="success" size="sm" onClick={() => handleAddFromReconcile(reconcileResult.new)}>
                  Adicionar todos
                </Button>
              </div>
            )}

            {/* Ausentes */}
            {reconcileResult.missing.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: 'var(--warning, #eab308)', fontSize: 13, flex: 1 }}>
                  <AlertTriangle size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                  {reconcileResult.missing.length} {reconcileResult.missing.length === 1 ? 'arquivo ausente' : 'arquivos ausentes'} na(s) pasta(s)
                </span>
                <Button variant="warning" size="sm" onClick={() => handleMarkMissing(reconcileResult.missing)}>
                  Marcar ausentes
                </Button>
              </div>
            )}

            {/* Renomeados */}
            {reconcileResult.renamed.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ color: 'var(--info, #60a5fa)', fontSize: 13, fontWeight: 500 }}>
                  {reconcileResult.renamed.length} {reconcileResult.renamed.length === 1 ? 'arquivo renomeado/movido' : 'arquivos renomeados/movidos'} detectado(s)
                </span>
                {reconcileResult.renamed.map(r => (
                  <div key={r.oldPath} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    background: 'var(--bg-tertiary, rgba(96,165,250,0.06))',
                    borderRadius: 6, padding: '6px 10px',
                  }}>
                    <div style={{ flex: 1, fontSize: 12 }}>
                      <div style={{ color: 'var(--text-secondary)', textDecoration: 'line-through' }}>
                        {r.oldPath.split(/[\\/]/).pop()}
                      </div>
                      <div style={{ color: 'var(--text-primary)' }}>→ {r.newFilename}</div>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleApplyRename(r.oldPath, r.newPath, r.newFilename)}
                    >
                      Aplicar
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* Duplicatas */}
            {reconcileResult.duplicates.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ color: 'var(--danger, #f87171)', fontSize: 13, fontWeight: 500 }}>
                  {reconcileResult.duplicates.length} {reconcileResult.duplicates.length === 1 ? 'duplicata' : 'duplicatas'} encontrada(s) (mesmo conteúdo)
                </span>
                {reconcileResult.duplicates.map((d, i) => (
                  <div key={i} style={{
                    background: 'var(--bg-tertiary, rgba(248,113,113,0.06))',
                    borderRadius: 6, padding: '6px 10px',
                    display: 'flex', flexDirection: 'column', gap: 4,
                  }}>
                    {d.tracks.map((tp, ti) => (
                      <div key={tp} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ flex: 1, fontSize: 12, color: 'var(--text-secondary)' }}>
                          {tp.split(/[\\/]/).pop()}
                        </span>
                        {ti > 0 && (
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => handleRemoveDuplicate(d.tracks[0], tp)}
                          >
                            Remover
                          </Button>
                        )}
                        {ti === 0 && (
                          <span style={{ fontSize: 11, color: 'var(--text-secondary)', padding: '2px 8px' }}>manter</span>
                        )}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}

            <Button variant="ghost" size="sm" onClick={() => setReconcileResult(null)} style={{ alignSelf: 'flex-start' }}>
              Fechar
            </Button>
          </div>
        )
      })()}

      {/* Busca */}
      <div style={{ marginBottom: 12 }}>
        <input
          className="input"
          placeholder="Buscar por título, artista, álbum, gênero ou tag…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Tabela */}
      {musicLibrary.length === 0 ? (
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          color: 'var(--text-secondary)', gap: 12,
        }}>
          <Music size={48} strokeWidth={1} />
          <div style={{ fontSize: 15, fontWeight: 500 }}>Biblioteca vazia</div>
          <div style={{ fontSize: 13, textAlign: 'center', maxWidth: 360 }}>
            Adicione faixas manualmente ou use "Reconciliar" para importar automaticamente das pastas dos seus Estilos Musicais.
          </div>
          <Button variant="primary" icon={<Plus size={14} />} onClick={() => setEditing('new')}>
            Adicionar primeira faixa
          </Button>
        </div>
      ) : (
        <div style={{ flex: 1, overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
                {['Título', 'Artista', 'Álbum', 'Gênero', 'Dur.', 'BPM', 'Energia', 'Tags', 'Veiculações', 'Ações'].map(h => (
                  <th
                    key={h}
                    style={{
                      padding: '8px 10px', textAlign: 'left', fontWeight: 600,
                      color: 'var(--text-secondary)', fontSize: 12,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ padding: 24, textAlign: 'center', color: 'var(--text-secondary)' }}>
                    Nenhuma faixa encontrada para "{search}"
                  </td>
                </tr>
              ) : (
                filtered.map(track => (
                  <tr
                    key={track.id}
                    style={{
                      borderBottom: '1px solid var(--border)',
                      background: track.missing ? 'rgba(234,179,8,0.06)' : undefined,
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => { if (!track.missing) (e.currentTarget as HTMLElement).style.background = 'var(--bg-secondary)' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = track.missing ? 'rgba(234,179,8,0.06)' : '' }}
                  >
                    <td style={{ padding: '8px 10px', maxWidth: 200 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {track.missing && (
                          <span title="Arquivo ausente no disco">
                            <AlertTriangle size={12} style={{ color: 'var(--warning, #eab308)', flexShrink: 0 }} />
                          </span>
                        )}
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={track.title}>
                          {track.title || track.filename}
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: '8px 10px', color: 'var(--text-secondary)' }}>{track.artist || '—'}</td>
                    <td style={{ padding: '8px 10px', color: 'var(--text-secondary)' }}>{track.album || '—'}</td>
                    <td style={{ padding: '8px 10px', color: 'var(--text-secondary)' }}>{track.genre || '—'}</td>
                    <td style={{ padding: '8px 10px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                      {formatDuration(track.duration)}
                    </td>
                    <td style={{ padding: '8px 10px', color: 'var(--text-secondary)' }}>{track.bpm ?? '—'}</td>
                    <td style={{ padding: '8px 10px' }}>{energyDots(track.energy)}</td>
                    <td style={{ padding: '8px 10px', maxWidth: 160 }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                        {track.tags.slice(0, 3).map(tag => (
                          <span
                            key={tag}
                            style={{
                              background: 'var(--bg-secondary)',
                              border: '1px solid var(--border)',
                              borderRadius: 8, padding: '1px 6px', fontSize: 10,
                              color: 'var(--text-secondary)',
                            }}
                          >
                            {tag}
                          </span>
                        ))}
                        {track.tags.length > 3 && (
                          <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>+{track.tags.length - 3}</span>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: '8px 10px', color: 'var(--text-secondary)', textAlign: 'center' }}>
                      {track.playCount}
                    </td>
                    <td style={{ padding: '8px 10px' }}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={<Edit2 size={12} />}
                          onClick={() => setEditing(track)}
                          title="Editar faixa"
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={<Trash2 size={12} />}
                          onClick={() => setDeletingId(track.id)}
                          title="Excluir faixa"
                        />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal de edição */}
      {editing !== null && (
        <TrackEditModal
          initial={editing === 'new' ? null : editing}
          onSave={handleSave}
          onClose={() => setEditing(null)}
        />
      )}

      {/* Modal de confirmação de exclusão */}
      {deletingId && (
        <Modal
          title="Excluir Faixa"
          onClose={() => setDeletingId(null)}
          maxWidth={380}
          actions={
            <>
              <Button variant="secondary" onClick={() => setDeletingId(null)}>Cancelar</Button>
              <Button variant="danger" onClick={() => handleDelete(deletingId)}>Excluir</Button>
            </>
          }
        >
          <p style={{ margin: 0 }}>
            Tem certeza que deseja excluir esta faixa da biblioteca?
            <br />
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              O arquivo não será deletado do disco.
            </span>
          </p>
        </Modal>
      )}
    </div>
  )
}
