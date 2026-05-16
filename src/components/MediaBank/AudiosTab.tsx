import { useState, useCallback, useMemo, useEffect } from 'react'
import {
  Music, Plus, Trash2, ChevronLeft, Search,
  RefreshCw, FolderOpen, FolderPlus, Upload, FileAudio,
  Edit2,
} from 'lucide-react'
import { useApp } from '../../store/AppContext'
import type { AppSettings, MusicTrack, PlaylistItem, TrackMetadataResult } from '../../types'
import Button from '../ui/Button'
import Modal from '../ui/Modal'
import { Field, FieldRow } from '../ui/Field'

interface Props {
  onInsert: (item: Omit<PlaylistItem, 'id' | 'order' | 'status'>) => void
}

interface AudioFile {
  filePath: string
  filename: string
}

interface FolderSource {
  key: string
  label: string
  folderPath: string
  color?: string
  isStyle: boolean
}

const AUDIO_EXTS = new Set(['mp3', 'wav', 'flac', 'm4a', 'aac', 'ogg', 'opus', 'wma', 'aiff'])

function ext(filename: string) { return (filename.split('.').pop() ?? '').toUpperCase() }
function noExt(filename: string) { return filename.replace(/\.[^.]+$/, '') }
function folderName(fp: string) { return fp.split(/[\\/]/).pop() ?? fp }
function formatDur(sec?: number) {
  if (!sec) return ''
  const m = Math.floor(sec / 60)
  const s = Math.round(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

// ── Folder Card (reutilizado de Videos) ─────────────────────────────────────
function FolderCard({ source, onOpen, onRemove }: { source: FolderSource; onOpen: () => void; onRemove?: () => void }) {
  return (
    <div
      className="mb-folder-card"
      onClick={onOpen}
      title={`${source.folderPath}\nArraste para inserir áudio aleatório`}
      draggable
      onDragStart={e => {
        e.dataTransfer.effectAllowed = 'copy'
        e.dataTransfer.setData('application/vtmaster-folder', JSON.stringify({
          folderPath: source.folderPath,
          label: source.label,
          mediaType: 'audio',
        }))
      }}
    >
      {source.color && <span className="mb-folder-card-dot" style={{ background: source.color }} />}
      <div className="mb-folder-card-icon"><FolderOpen size={32} /></div>
      <div className="mb-folder-card-name">{source.label}</div>
      <div className="mb-folder-card-path">{folderName(source.folderPath)}</div>
      {!source.isStyle && onRemove && (
        <button className="mb-folder-card-remove" title="Remover pasta" onClick={e => { e.stopPropagation(); onRemove() }}>
          <Trash2 size={11} />
        </button>
      )}
    </div>
  )
}

// ── Browser de arquivos de áudio ─────────────────────────────────────────────
function AudioBrowser({ source, onBack, onInsert }: { source: FolderSource; onBack: () => void; onInsert: Props['onInsert'] }) {
  const [files, setFiles] = useState<AudioFile[]>([])
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [search, setSearch] = useState('')
  const [includeSubfolders, setIncludeSubfolders] = useState(true)
  // Modo vinheta: type='vinheta' → GC Musical não dispara; false = 'spot' normal
  const [isVinheta, setIsVinheta] = useState(false)

  const scan = useCallback(async () => {
    setLoading(true)
    const results = await window.spotmaster?.scanMusicFolder(source.folderPath, includeSubfolders) ?? []
    const audios = results.filter(r => AUDIO_EXTS.has((r.filename.split('.').pop() ?? '').toLowerCase()))
    setFiles(audios.map(r => ({ filePath: r.filePath, filename: r.filename })))
    setLoaded(true)
    setLoading(false)
  }, [source.folderPath, includeSubfolders])

  // Auto-scan ao abrir
  useEffect(() => {
    const timer = window.setTimeout(() => { void scan() }, 0)
    return () => window.clearTimeout(timer)
  }, [scan])

  const filtered = search.trim()
    ? files.filter(f => f.filename.toLowerCase().includes(search.toLowerCase()))
    : files

  return (
    <div className="mb-browser">
      <div className="mb-browser-header">
        <button className="mb-back-btn" onClick={onBack}>
          <ChevronLeft size={15} /><span>Pastas</span>
        </button>
        <div className="mb-browser-title">
          {source.color && <span style={{ width: 8, height: 8, borderRadius: '50%', background: source.color, display: 'inline-block', marginRight: 6 }} />}
          {source.label}
        </div>
        <button className="mb-icon-btn" title="Alternar subpastas" onClick={() => { setIncludeSubfolders(v => !v); setLoaded(false) }}>
          <FolderPlus size={13} style={{ opacity: includeSubfolders ? 1 : 0.4 }} />
        </button>
        <button className="mb-icon-btn" title="Reescanear" onClick={scan} disabled={loading}>
          <RefreshCw size={13} className={loading ? 'spin' : ''} />
        </button>
      </div>

      {/* Toggle Música / Vinheta */}
      <div className="mb-audio-type-toggle">
        <button
          className={`mb-type-btn${!isVinheta ? ' active' : ''}`}
          onClick={() => setIsVinheta(false)}
          title="Inserir como Música — GC Musical ativa normalmente"
        >
          ♪ Música
        </button>
        <button
          className={`mb-type-btn${isVinheta ? ' active vinheta' : ''}`}
          onClick={() => setIsVinheta(true)}
          title="Inserir como Vinheta — GC Musical não ativa (vinhetas são curtas)"
        >
          ≋ Vinheta
        </button>
      </div>

      <div className="mb-search" style={{ position: 'relative' }}>
        <Search size={12} style={{ position: 'absolute', left: 20, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', pointerEvents: 'none' }} />
        <input placeholder="Buscar áudio…" value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 28 }} />
      </div>

      <div className="mb-list">
        {loading && <div className="mb-loading">Escaneando…</div>}
        {!loading && loaded && filtered.length === 0 && (
          <div className="mb-empty">{search ? `Nenhum áudio para "${search}"` : 'Nenhum arquivo de áudio nesta pasta.'}</div>
        )}
        {!loading && filtered.map(file => (
          <div
            key={file.filePath}
            className={`mb-item${isVinheta ? ' mb-item--vinheta' : ''}`}
            draggable
            onDragStart={e => {
              e.dataTransfer.effectAllowed = 'copy'
              e.dataTransfer.setData('application/vtmaster-media', JSON.stringify({
                title: noExt(file.filename),
                filePath: file.filePath,
                mediaType: 'audio',
                itemType: isVinheta ? 'vinheta' : 'spot',
                duration: 0,
              }))
            }}
          >
            <FileAudio size={14} className="mb-item-icon" style={{ cursor: 'grab' }} />
            <div className="mb-item-info">
              <div className="mb-item-name" title={file.filename}>{noExt(file.filename)}</div>
              <div className="mb-item-meta">{ext(file.filename)}{isVinheta ? ' · vinheta' : ''}</div>
            </div>
            <button
              className="mb-item-add"
              title={isVinheta ? 'Inserir como vinheta (sem GC)' : 'Inserir como música'}
              onClick={() => onInsert({
                title: noExt(file.filename),
                filePath: file.filePath,
                type: isVinheta ? 'vinheta' : 'spot',
                mediaType: 'audio',
                duration: 0,
              })}
            >
              <Plus size={13} />
            </button>
          </div>
        ))}
      </div>
      {loaded && !loading && (
        <div className="mb-footer-count">{filtered.length} {filtered.length === 1 ? 'áudio' : 'áudios'}</div>
      )}
    </div>
  )
}

// ── Biblioteca — gestão de faixas (import individual / lote) ─────────────────
function BibliotecaView({ onInsert }: Props) {
  const { state, dispatch } = useApp()
  const { musicLibrary } = state

  const [search, setSearch] = useState('')
  const [importing, setImporting] = useState(false)
  const [importProgress, setImportProgress] = useState(0)
  const [importTotal, setImportTotal] = useState(0)
  const [importSummary, setImportSummary] = useState<{ added: number; skipped: number } | null>(null)
  const [editingTrack, setEditingTrack] = useState<MusicTrack | null>(null)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return musicLibrary.filter(t => !t.missing && (
      !q ||
      t.title.toLowerCase().includes(q) ||
      t.artist.toLowerCase().includes(q) ||
      (t.genre ?? '').toLowerCase().includes(q)
    ))
  }, [musicLibrary, search])

  // ── Import individual ───────────────────────────────────────────────────────
  const handleAddFile = async () => {
    const fp = await window.spotmaster?.browseVideoFile()
    if (!fp) return
    const filename = fp.split(/[\\/]/).pop() ?? fp
    const noExtName = filename.replace(/\.[^.]+$/, '')
    const meta: TrackMetadataResult | null | undefined = await window.spotmaster?.readTrackMetadata(fp)
    const track: MusicTrack = {
      id: crypto.randomUUID(),
      filePath: fp, filename,
      title: meta?.title ?? noExtName,
      artist: meta?.artist ?? '',
      album: meta?.album ?? '',
      year: meta?.year ?? undefined,
      genre: meta?.genre ?? '',
      bpm: meta?.bpm ?? undefined,
      duration: meta?.duration ?? undefined,
      md5: undefined, tags: [], playCount: 0,
    }
    dispatch({ type: 'UPSERT_MUSIC_TRACK', payload: track })
  }

  // ── Import pasta em lote ────────────────────────────────────────────────────
  const handleImportFolder = async () => {
    const folder = await window.spotmaster?.browseFolder()
    if (!folder) return
    const inclSub = window.confirm('Incluir subpastas?')
    setImporting(true); setImportProgress(0); setImportTotal(0); setImportSummary(null)
    const files = await window.spotmaster?.scanMusicFolder(folder, inclSub) ?? []
    setImportTotal(files.length)
    const known = new Set(musicLibrary.map(t => t.filePath))
    let added = 0; let skipped = 0
    for (let i = 0; i < files.length; i++) {
      setImportProgress(i + 1)
      const f = files[i]
      if (known.has(f.filePath)) { skipped++; continue }
      const [meta, md5] = await Promise.all([
        window.spotmaster?.readTrackMetadata(f.filePath),
        window.spotmaster?.hashFileMd5(f.filePath),
      ])
      const noExtName = f.filename.replace(/\.[^.]+$/, '')
      dispatch({
        type: 'UPSERT_MUSIC_TRACK',
        payload: {
          id: crypto.randomUUID(),
          filePath: f.filePath, filename: f.filename,
          title: meta?.title ?? noExtName, artist: meta?.artist ?? '',
          album: meta?.album ?? '', year: meta?.year ?? undefined,
          genre: meta?.genre ?? '', bpm: meta?.bpm ?? undefined,
          duration: meta?.duration ?? undefined,
          md5: md5 ?? undefined, tags: [], playCount: 0,
        },
      })
      added++
    }
    setImportSummary({ added, skipped })
    setImporting(false)
  }

  return (
    <>
      {/* Toolbar */}
      <div className="mb-library-toolbar">
        <Button size="sm" variant="secondary" icon={<Upload size={12} />} onClick={handleImportFolder} disabled={importing}>
          {importing ? `Importando… ${importProgress}/${importTotal}` : 'Importar Pasta'}
        </Button>
        <Button size="sm" variant="secondary" icon={<Plus size={12} />} onClick={handleAddFile}>
          Adicionar Arquivo
        </Button>
      </div>

      {/* Progresso */}
      {importing && importTotal > 0 && (
        <div className="mb-import-progress">
          <div className="mb-progress-bar">
            <div className="mb-progress-fill" style={{ width: `${Math.round((importProgress / importTotal) * 100)}%` }} />
          </div>
          <span className="mb-progress-label">{importProgress} / {importTotal}</span>
        </div>
      )}

      {/* Resumo */}
      {importSummary && !importing && (
        <div className="mb-import-summary">
          ✅ {importSummary.added} adicionadas{importSummary.skipped > 0 ? `, ${importSummary.skipped} já existiam` : ''}
          <button onClick={() => setImportSummary(null)} style={{ marginLeft: 8, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>×</button>
        </div>
      )}

      {/* Busca */}
      <div className="mb-search" style={{ position: 'relative' }}>
        <Search size={12} style={{ position: 'absolute', left: 20, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', pointerEvents: 'none' }} />
        <input placeholder="Buscar faixa, artista, gênero…" value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 28 }} />
      </div>

      {/* Lista */}
      <div className="mb-list">
        {musicLibrary.length === 0 && (
          <div className="mb-empty">
            Biblioteca vazia. Use <strong>Importar Pasta</strong> ou <strong>Adicionar Arquivo</strong> acima.
          </div>
        )}
        {musicLibrary.length > 0 && filtered.length === 0 && (
          <div className="mb-empty">Nenhuma faixa para "{search}"</div>
        )}
        {filtered.map(track => (
          <div key={track.id} className="mb-item">
            <Music size={14} className="mb-item-icon" />
            <div className="mb-item-info">
              <div className="mb-item-name" title={track.title}>{track.title}</div>
              <div className="mb-item-meta">
                {track.artist || '—'}{track.genre ? ` · ${track.genre}` : ''}{track.duration ? ` · ${formatDur(track.duration)}` : ''}
              </div>
            </div>
            <button
              className="mb-item-add"
              style={{ marginRight: 2 }}
              title="Editar metadados"
              onClick={() => setEditingTrack(track)}
            >
              <Edit2 size={11} />
            </button>
            <button
              className="mb-item-add"
              title="Inserir na programação"
              onClick={() => onInsert({
                title: track.artist ? `${track.artist} - ${track.title}` : track.title,
                filePath: track.filePath,
                type: 'spot',
                mediaType: 'audio',
                duration: track.duration ?? 0,
              })}
            >
              <Plus size={13} />
            </button>
          </div>
        ))}
      </div>

      {musicLibrary.length > 0 && (
        <div className="mb-footer-count">{filtered.length} de {musicLibrary.filter(t => !t.missing).length} faixas</div>
      )}

      {/* Modal edição rápida de metadados */}
      {editingTrack && (
        <TrackQuickEdit
          track={editingTrack}
          onSave={t => { dispatch({ type: 'UPSERT_MUSIC_TRACK', payload: t }); setEditingTrack(null) }}
          onClose={() => setEditingTrack(null)}
        />
      )}
    </>
  )
}

// ── Modal edição rápida de faixa ─────────────────────────────────────────────
function TrackQuickEdit({ track, onSave, onClose }: { track: MusicTrack; onSave: (t: MusicTrack) => void; onClose: () => void }) {
  const [form, setForm] = useState({ title: track.title, artist: track.artist, genre: track.genre ?? '', duration: track.duration ?? 0 })
  const set = (p: Partial<typeof form>) => setForm(f => ({ ...f, ...p }))

  return (
    <Modal
      title="Editar faixa"
      onClose={onClose}
      maxWidth={420}
      actions={
        <>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" onClick={() => onSave({ ...track, ...form })}>Salvar</Button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: 11, color: 'var(--text-secondary)', wordBreak: 'break-all' }}>{track.filename}</div>
        <FieldRow>
          <Field label="Título">
            <input className="ui-input" value={form.title} onChange={e => set({ title: e.target.value })} />
          </Field>
          <Field label="Artista">
            <input className="ui-input" value={form.artist} onChange={e => set({ artist: e.target.value })} />
          </Field>
        </FieldRow>
        <FieldRow>
          <Field label="Gênero">
            <input className="ui-input" value={form.genre} onChange={e => set({ genre: e.target.value })} />
          </Field>
          <Field label="Duração (s)">
            <input className="ui-input" type="number" min={0} value={form.duration} onChange={e => set({ duration: Number(e.target.value) })} />
          </Field>
        </FieldRow>
      </div>
    </Modal>
  )
}

// ── AudiosTab principal ───────────────────────────────────────────────────────
export default function AudiosTab({ onInsert }: Props) {
  const { state, dispatch, saveToStorage } = useApp()
  const { settings, audioStyles } = state
  const audioFolders: string[] = settings.audioFolders ?? []

  const [subTab, setSubTab] = useState<'pastas' | 'biblioteca'>('pastas')
  const [browsing, setBrowsing] = useState<FolderSource | null>(null)

  // Fontes: estilos do AudioPro + pastas extras
  const sources: FolderSource[] = [
    ...audioStyles.map(s => ({
      key: `astyle-${s.id}`,
      label: s.name,
      folderPath: s.folderPath,
      color: s.color,
      isStyle: true,
    })),
    ...audioFolders.map(fp => ({
      key: `custom-${fp}`,
      label: folderName(fp),
      folderPath: fp,
      color: undefined,
      isStyle: false,
    })),
  ]

  const saveSettings = (patch: Partial<AppSettings>) => {
    const next = { ...settings, ...patch }
    dispatch({ type: 'SET_SETTINGS', payload: next })
    saveToStorage('settings', next)
  }

  const handleAddFolder = async () => {
    const fp = await window.spotmaster?.browseFolder()
    if (!fp || audioFolders.includes(fp)) return
    saveSettings({ audioFolders: [...audioFolders, fp] })
  }

  // Modo browser de pasta
  if (browsing && subTab === 'pastas') {
    return (
      <AudioBrowser
        source={browsing}
        onBack={() => setBrowsing(null)}
        onInsert={onInsert}
      />
    )
  }

  return (
    <>
      {/* Sub-abas */}
      <div className="mb-subtabs">
        <button className={`mb-subtab ${subTab === 'pastas' ? 'active' : ''}`} onClick={() => { setSubTab('pastas'); setBrowsing(null) }}>
          <FolderOpen size={12} /> Pastas
        </button>
        <button className={`mb-subtab ${subTab === 'biblioteca' ? 'active' : ''}`} onClick={() => setSubTab('biblioteca')}>
          <Music size={12} /> Biblioteca
        </button>
      </div>

      {/* Aba Pastas */}
      {subTab === 'pastas' && (
        <div className="mb-folder-grid-wrap">
          {sources.length === 0 && (
            <div className="mb-empty" style={{ marginTop: 32 }}>
              Nenhuma pasta cadastrada.<br />
              Cadastre estilos no <strong>AudioPro → Estilos</strong> ou clique em<br />
              <strong>"+ Pasta de áudio"</strong> abaixo.
            </div>
          )}
          <div className="mb-folder-grid">
            {sources.map(source => (
              <FolderCard
                key={source.key}
                source={source}
                onOpen={() => setBrowsing(source)}
                onRemove={!source.isStyle ? () => saveSettings({ audioFolders: audioFolders.filter(f => f !== source.folderPath) }) : undefined}
              />
            ))}
            <div className="mb-folder-card mb-folder-card-add" onClick={handleAddFolder} title="Adicionar pasta de áudio extra">
              <div className="mb-folder-card-icon"><Plus size={28} /></div>
              <div className="mb-folder-card-name">Pasta de áudio</div>
            </div>
          </div>
          <div className="mb-folder-grid-hint">
            Estilos cadastrados no <strong>AudioPro → Estilos</strong> aparecem automaticamente.
          </div>
        </div>
      )}

      {/* Aba Biblioteca */}
      {subTab === 'biblioteca' && <BibliotecaView onInsert={onInsert} />}
    </>
  )
}
