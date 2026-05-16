import { useState, useCallback, useEffect } from 'react'
import {
  FolderOpen, Film, Plus, Trash2, ChevronLeft,
  Search, RefreshCw, FolderPlus,
} from 'lucide-react'
import { useApp } from '../../store/AppContext'
import type { AppSettings, PlaylistItem } from '../../types'

interface Props {
  onInsert: (item: Omit<PlaylistItem, 'id' | 'order' | 'status'>) => void
}

interface VideoFile {
  filePath: string
  filename: string
}

interface FolderSource {
  key: string
  label: string
  folderPath: string
  color?: string
  isStyle: boolean   // true = vem do AutoProg, false = pasta personalizada
}

const VIDEO_EXTS = new Set(['mp4', 'mov', 'avi', 'mkv', 'wmv', 'mxf', 'flv', 'webm', 'ts', 'm2ts', 'mpg', 'mpeg'])

function ext(filename: string) { return (filename.split('.').pop() ?? '').toUpperCase() }
function noExt(filename: string) { return filename.replace(/\.[^.]+$/, '') }
function folderName(fp: string) { return fp.split(/[\\/]/).pop() ?? fp }

// ── Folder Card ───────────────────────────────────────────────────────────────
function FolderCard({
  source,
  onOpen,
  onRemove,
}: {
  source: FolderSource
  onOpen: () => void
  onRemove?: () => void
}) {
  return (
    <div
      className="mb-folder-card"
      onClick={onOpen}
      title={`${source.folderPath}\nArraste para inserir vídeo aleatório`}
      draggable
      onDragStart={e => {
        e.dataTransfer.effectAllowed = 'copy'
        e.dataTransfer.setData('application/vtmaster-folder', JSON.stringify({
          folderPath: source.folderPath,
          label: source.label,
          mediaType: 'video',
        }))
      }}
    >
      {source.color && (
        <span className="mb-folder-card-dot" style={{ background: source.color }} />
      )}
      <div className="mb-folder-card-icon">
        <FolderOpen size={32} />
      </div>
      <div className="mb-folder-card-name">{source.label}</div>
      <div className="mb-folder-card-path">{folderName(source.folderPath)}</div>
      {!source.isStyle && onRemove && (
        <button
          className="mb-folder-card-remove"
          title="Remover pasta"
          onClick={(e) => { e.stopPropagation(); onRemove() }}
        >
          <Trash2 size={11} />
        </button>
      )}
    </div>
  )
}

// ── Modo browser — arquivos dentro de uma pasta ───────────────────────────────
function FolderBrowser({
  source,
  onBack,
  onInsert,
}: {
  source: FolderSource
  onBack: () => void
  onInsert: Props['onInsert']
}) {
  const [files, setFiles] = useState<VideoFile[]>([])
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [search, setSearch] = useState('')
  const [includeSubfolders, setIncludeSubfolders] = useState(true)

  const scan = useCallback(async () => {
    setLoading(true)
    const results = await window.spotmaster?.scanVideoFolder(source.folderPath, includeSubfolders) ?? []
    const videos = results.filter(r => VIDEO_EXTS.has((r.filename.split('.').pop() ?? '').toLowerCase()))
    setFiles(videos)
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
      {/* Header do browser */}
      <div className="mb-browser-header">
        <button className="mb-back-btn" onClick={onBack}>
          <ChevronLeft size={15} />
          <span>Pastas</span>
        </button>
        <div className="mb-browser-title">
          {source.color && <span style={{ width: 8, height: 8, borderRadius: '50%', background: source.color, display: 'inline-block', marginRight: 6 }} />}
          {source.label}
        </div>
        <button
          className="mb-icon-btn"
          title={`${includeSubfolders ? 'Subpastas ON' : 'Subpastas OFF'} — clique para alternar`}
          onClick={() => { setIncludeSubfolders(v => !v); setLoaded(false) }}
        >
          <FolderPlus size={13} style={{ opacity: includeSubfolders ? 1 : 0.4 }} />
        </button>
        <button className="mb-icon-btn" title="Reescanear" onClick={scan} disabled={loading}>
          <RefreshCw size={13} className={loading ? 'spin' : ''} />
        </button>
      </div>

      {/* Busca */}
      <div className="mb-search">
        <Search size={12} style={{ position: 'absolute', left: 20, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', pointerEvents: 'none' }} />
        <input
          placeholder="Buscar vídeo…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ paddingLeft: 28 }}
        />
      </div>

      {/* Lista de arquivos */}
      <div className="mb-list">
        {loading && <div className="mb-loading">Escaneando…</div>}

        {!loading && loaded && filtered.length === 0 && (
          <div className="mb-empty">
            {search ? `Nenhum vídeo encontrado para "${search}"` : 'Nenhum arquivo de vídeo nesta pasta.'}
          </div>
        )}

        {!loading && filtered.map(file => (
          <div
            key={file.filePath}
            className="mb-item"
            draggable
            onDragStart={e => {
              e.dataTransfer.effectAllowed = 'copy'
              e.dataTransfer.setData('application/vtmaster-media', JSON.stringify({
                title: noExt(file.filename),
                filePath: file.filePath,
                mediaType: 'video',
                itemType: 'programa',
                duration: 0,
              }))
            }}
          >
            <Film size={14} className="mb-item-icon" style={{ cursor: 'grab' }} />
            <div className="mb-item-info">
              <div className="mb-item-name" title={file.filename}>{noExt(file.filename)}</div>
              <div className="mb-item-meta">{ext(file.filename)}</div>
            </div>
            <button
              className="mb-item-add"
              title="Inserir na programação"
              onClick={() => onInsert({
                title: noExt(file.filename),
                filePath: file.filePath,
                type: 'programa',
                mediaType: 'video',
                duration: 0,
              })}
            >
              <Plus size={13} />
            </button>
          </div>
        ))}
      </div>

      {loaded && !loading && (
        <div className="mb-footer-count">
          {filtered.length} {filtered.length === 1 ? 'vídeo' : 'vídeos'}
        </div>
      )}
    </div>
  )
}

// ── VideosTab principal ───────────────────────────────────────────────────────
export default function VideosTab({ onInsert }: Props) {
  const { state, dispatch, saveToStorage } = useApp()
  // videoStyles = estilos cadastrados no VideoPro
  // videoFolders = pastas extras adicionadas diretamente neste drawer
  const { settings, videoStyles } = state
  const videoFolders: string[] = settings.videoFolders ?? []

  const [browsing, setBrowsing] = useState<FolderSource | null>(null)

  // Fontes: estilos do VideoPro + pastas extras
  const sources: FolderSource[] = [
    ...videoStyles.map(s => ({
      key: `vstyle-${s.id}`,
      label: s.name,
      folderPath: s.folderPath,
      color: s.color,
      isStyle: true,
    })),
    ...videoFolders.map(fp => ({
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
    if (!fp || videoFolders.includes(fp)) return
    saveSettings({ videoFolders: [...videoFolders, fp] })
  }

  const handleRemoveFolder = (fp: string) => {
    saveSettings({ videoFolders: videoFolders.filter(f => f !== fp) })
  }

  // Modo browser
  if (browsing) {
    return (
      <FolderBrowser
        source={browsing}
        onBack={() => setBrowsing(null)}
        onInsert={onInsert}
      />
    )
  }

  // Grid de pastas
  return (
    <div className="mb-folder-grid-wrap">
      {sources.length === 0 && (
        <div className="mb-empty" style={{ marginTop: 32 }}>
          Nenhuma pasta cadastrada.<br />
          Cadastre estilos no <strong>VideoPro</strong> (barra lateral) ou clique em<br />
          <strong>"+ Pasta de vídeo"</strong> abaixo.
        </div>
      )}

      <div className="mb-folder-grid">
        {sources.map(source => (
          <FolderCard
            key={source.key}
            source={source}
            onOpen={() => setBrowsing(source)}
            onRemove={!source.isStyle ? () => handleRemoveFolder(source.folderPath) : undefined}
          />
        ))}

        {/* Card de adicionar nova pasta */}
        <div className="mb-folder-card mb-folder-card-add" onClick={handleAddFolder} title="Adicionar pasta de vídeo extra">
          <div className="mb-folder-card-icon">
            <Plus size={28} />
          </div>
          <div className="mb-folder-card-name">Pasta de vídeo</div>
        </div>
      </div>

      <div className="mb-folder-grid-hint">
        Estilos do <strong>VideoPro</strong> aparecem automaticamente.
        Adicione pastas extras para vídeos que não têm estilo cadastrado.
      </div>
    </div>
  )
}
