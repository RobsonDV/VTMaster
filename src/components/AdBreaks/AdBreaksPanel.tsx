import { useState } from 'react'
import {
  Plus, Trash2, Clock, ToggleLeft, ToggleRight,
  RefreshCw, ChevronUp, ChevronDown, Zap, Monitor, User, ChevronDown as ExpandIcon, Megaphone, Pause,
} from 'lucide-react'
import { useApp } from '../../store/AppContext'
import type { CommercialBlock, CommercialBlockItem, Client } from '../../types'
import { formatDuration, today as todayLocal } from '../../utils/time'
import { VMIX_ACTION_COMMANDS } from '../../utils/vmixCommandCatalog'
import Badge from '../ui/Badge'
import Button from '../ui/Button'
import PageHeader from '../ui/PageHeader'
import './AdBreaksPanel.css'

const ALL_DAYS   = [0, 1, 2, 3, 4, 5, 6]
const DAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

// ─── Block Item Row (inline editor) ──────────────────────────────────────────
function BlockItemRow({
  item, clients, onUpdate, onRemove, onMoveUp, onMoveDown, isFirst, isLast,
}: {
  item: CommercialBlockItem
  clients: Client[]
  onUpdate: (updated: CommercialBlockItem) => void
  onRemove: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  isFirst: boolean
  isLast: boolean
}) {
  const borderColor = item.type === 'spot_client' ? '#f59e0b'
    : item.type === 'vmix_action' ? '#7c3aed'
    : item.type === 'pause' ? '#94a3b8'
    : '#0ea5e9'
  const bgColor = item.type === 'spot_client' ? 'color-mix(in srgb, #f59e0b 8%, var(--bg-primary))'
    : item.type === 'vmix_action' ? 'color-mix(in srgb, #7c3aed 8%, var(--bg-primary))'
    : item.type === 'pause' ? 'color-mix(in srgb, #94a3b8 8%, var(--bg-primary))'
    : 'color-mix(in srgb, #0ea5e9 8%, var(--bg-primary))'

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '7px 8px', borderRadius: 6, marginBottom: 4,
      background: bgColor, border: `1px solid ${borderColor}40`,
      borderLeft: `3px solid ${borderColor}`,
    }}>
      <span style={{ color: borderColor, flexShrink: 0, display: 'flex', alignItems: 'center' }}>
        {item.type === 'spot_client' ? <User size={13} />
          : item.type === 'vmix_action' ? <Zap size={13} />
          : item.type === 'pause' ? <Pause size={13} />
          : <Monitor size={13} />}
      </span>

      {item.type === 'spot_client' && (
        <>
          {item.campaignId && (
            <span title="Inserido por campanha automática" style={{ color: '#7c3aed', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
              <Megaphone size={12} />
            </span>
          )}
          <select
            value={item.clientId ?? ''}
            onChange={e => onUpdate({ ...item, clientId: e.target.value })}
            style={{ flex: 1, padding: '3px 6px', fontSize: '0.8rem', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-primary)' }}
          >
            <option value="">Selecionar anunciante...</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          {!item.campaignId && (
            <input
              type="number" value={item.spotsCount ?? 1} min={1} max={20}
              onChange={e => onUpdate({ ...item, spotsCount: Math.max(1, parseInt(e.target.value) || 1) })}
              style={{ width: 46, padding: '3px 5px', fontSize: '0.8rem', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-primary)', textAlign: 'center' }}
            />
          )}
          <span style={{ fontSize: '0.75rem', color: item.campaignId ? '#7c3aed' : 'var(--text-secondary)', flexShrink: 0 }}>
            {item.campaignId ? 'campanha' : 'spots'}
          </span>
        </>
      )}

      {item.type === 'vmix_action' && (
        <>
          <select
            value={item.vmixAction?.function ?? 'AudioOff'}
            onChange={e => onUpdate({ ...item, vmixAction: { ...item.vmixAction, function: e.target.value } })}
            style={{ padding: '3px 6px', fontSize: '0.8rem', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-primary)' }}
          >
            {VMIX_ACTION_COMMANDS.map(f => <option key={f.functionName} value={f.functionName}>{f.label}</option>)}
          </select>
          <input
            value={item.vmixAction?.input ?? ''}
            onChange={e => onUpdate({ ...item, vmixAction: { ...item.vmixAction, function: item.vmixAction?.function ?? 'AudioOff', input: e.target.value || undefined } })}
            placeholder="Input (opcional)"
            style={{ flex: 1, padding: '3px 6px', fontSize: '0.8rem', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-primary)' }}
          />
          <input
            value={item.vmixAction?.value ?? ''}
            onChange={e => onUpdate({ ...item, vmixAction: { ...item.vmixAction, function: item.vmixAction?.function ?? 'AudioOff', value: e.target.value || undefined } })}
            placeholder="Valor"
            style={{ width: 60, padding: '3px 5px', fontSize: '0.8rem', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-primary)' }}
          />
        </>
      )}

      {item.type === 'vmix_input' && (
        <>
          <input
            value={item.inputName ?? ''}
            onChange={e => onUpdate({ ...item, inputName: e.target.value })}
            placeholder="Nome/nº do input vMix"
            style={{ flex: 1, padding: '3px 6px', fontSize: '0.8rem', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-primary)' }}
          />
          <input
            type="number" value={item.duration ?? 10} min={1}
            onChange={e => onUpdate({ ...item, duration: Math.max(1, parseInt(e.target.value) || 10) })}
            style={{ width: 52, padding: '3px 5px', fontSize: '0.8rem', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-primary)', textAlign: 'center' }}
          />
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', flexShrink: 0 }}>s</span>
        </>
      )}

      {item.type === 'pause' && (
        <>
          <input
            value={item.title ?? ''}
            onChange={e => onUpdate({ ...item, title: e.target.value })}
            placeholder="Rótulo (ex: Aguardar próximo trigger)"
            style={{ flex: 1, padding: '3px 6px', fontSize: '0.8rem', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-primary)' }}
          />
          <span style={{ fontSize: '0.72rem', color: borderColor, flexShrink: 0, fontWeight: 600 }}>
            ⏸ Para aqui — espera novo disparo
          </span>
        </>
      )}

      <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
        <button onClick={onMoveUp} disabled={isFirst} style={{ width: 22, height: 22, border: 'none', background: 'transparent', cursor: isFirst ? 'default' : 'pointer', color: isFirst ? 'transparent' : 'var(--text-secondary)', borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <ChevronUp size={12} />
        </button>
        <button onClick={onMoveDown} disabled={isLast} style={{ width: 22, height: 22, border: 'none', background: 'transparent', cursor: isLast ? 'default' : 'pointer', color: isLast ? 'transparent' : 'var(--text-secondary)', borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <ChevronDown size={12} />
        </button>
        <button onClick={onRemove} style={{ width: 22, height: 22, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--error)', borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  )
}

// ─── Item type badges (collapsed view) ───────────────────────────────────────
function ItemTypeBadge({ item, clients, nextSpotTitle }: {
  item: CommercialBlockItem
  clients: Client[]
  nextSpotTitle?: string
}) {
  if (item.type === 'spot_client') {
    const client = clients.find(c => c.id === item.clientId)
    return (
      <span className="ab-slot-pill" style={{ borderColor: '#f59e0b60', background: 'color-mix(in srgb, #f59e0b 8%, transparent)' }}>
        <User size={10} style={{ color: '#f59e0b', marginRight: 3 }} />
        <strong>{client?.name ?? '?'}</strong>{' '}×{item.spotsCount ?? 1}
        {nextSpotTitle && <span className="ab-next-spot"> → {nextSpotTitle}</span>}
        {client && !nextSpotTitle && <span className="ab-warn"> (sem spots!)</span>}
      </span>
    )
  }
  if (item.type === 'vmix_action') {
    return (
      <span className="ab-slot-pill" style={{ borderColor: '#7c3aed60', background: 'color-mix(in srgb, #7c3aed 8%, transparent)' }}>
        <Zap size={10} style={{ color: '#a78bfa', marginRight: 3 }} />
        <strong style={{ color: '#a78bfa' }}>{item.vmixAction?.function ?? 'Ação'}</strong>
        {item.vmixAction?.input && <span className="ab-next-spot"> · {item.vmixAction.input}</span>}
      </span>
    )
  }
  if (item.type === 'pause') {
    return (
      <span className="ab-slot-pill" style={{ borderColor: '#94a3b860', background: 'color-mix(in srgb, #94a3b8 8%, transparent)' }}>
        <Pause size={10} style={{ color: '#94a3b8', marginRight: 3 }} />
        <strong style={{ color: '#94a3b8' }}>Pausa</strong>
        {item.title && <span className="ab-next-spot"> · {item.title}</span>}
      </span>
    )
  }
  return (
    <span className="ab-slot-pill" style={{ borderColor: '#0ea5e960', background: 'color-mix(in srgb, #0ea5e9 8%, transparent)' }}>
      <Monitor size={10} style={{ color: '#38bdf8', marginRight: 3 }} />
      <strong style={{ color: '#38bdf8' }}>{item.inputName || 'Input vMix'}</strong>
      {item.duration && <span className="ab-next-spot"> · {item.duration}s</span>}
    </span>
  )
}

// ─── Inline block editor (embedded in card) ───────────────────────────────────
function InlineBlockEditor({ draft, setDraft, onSave, onCancel, clients, isNew }: {
  draft: CommercialBlock
  setDraft: React.Dispatch<React.SetStateAction<CommercialBlock | null>>
  onSave: () => void
  onCancel: () => void
  clients: Client[]
  isNew: boolean
}) {
  const toggleDay = (dow: number) =>
    setDraft(d => {
      if (!d) return d
      const days = d.daysOfWeek ?? ALL_DAYS
      const next = days.includes(dow) ? days.filter(x => x !== dow) : [...days, dow].sort((a, b) => a - b)
      return { ...d, daysOfWeek: next.length === 7 ? undefined : next }
    })

  const addItem = (type: CommercialBlockItem['type']) => {
    const newItem: CommercialBlockItem = {
      id: crypto.randomUUID(), order: draft.items.length + 1, type,
      ...(type === 'spot_client' ? { clientId: '', spotsCount: 1 } : {}),
      ...(type === 'vmix_action' ? { vmixAction: { function: 'AudioOff' } } : {}),
      ...(type === 'vmix_input'  ? { inputName: '', duration: 10 } : {}),
      ...(type === 'pause'       ? { title: 'Aguardar próximo trigger' } : {}),
    }
    setDraft(d => d ? { ...d, items: [...d.items, newItem] } : d)
  }

  const updateItem = (id: string, updated: CommercialBlockItem) =>
    setDraft(d => d ? { ...d, items: d.items.map(it => it.id === id ? updated : it) } : d)

  const removeItem = (id: string) =>
    setDraft(d => d ? { ...d, items: d.items.filter(it => it.id !== id).map((it, i) => ({ ...it, order: i + 1 })) } : d)

  const moveItem = (idx: number, dir: -1 | 1) =>
    setDraft(d => {
      if (!d) return d
      const next = [...d.items]
      const target = idx + dir
      if (target < 0 || target >= next.length) return d
      ;[next[idx], next[target]] = [next[target], next[idx]]
      return { ...d, items: next.map((it, i) => ({ ...it, order: i + 1 })) }
    })

  const activeDays = draft.daysOfWeek ?? ALL_DAYS

  return (
    <div className="ab-inline-editor">
      {/* Name + Time + Toggle */}
      <div className="ab-form-row" style={{ marginBottom: 10 }}>
        <div className="form-group-sm" style={{ flex: 2, marginBottom: 0 }}>
          <label>Nome do Bloco</label>
          <input
            value={draft.name}
            onChange={e => setDraft(d => d ? { ...d, name: e.target.value } : d)}
            placeholder="ex: Intervalo das 14h"
            autoFocus={isNew}
          />
        </div>
        <div className="form-group-sm" style={{ marginBottom: 0 }}>
          <label>Horário</label>
          <input
            type="time"
            value={draft.scheduledTime.slice(0, 5)}
            onChange={e => setDraft(d => d ? { ...d, scheduledTime: (e.target.value || '00:00') + ':00' } : d)}
          />
        </div>
        <div className="form-group-sm ab-toggle-col" style={{ marginBottom: 0 }}>
          <label>Ativo</label>
          <button className="ab-toggle-btn" onClick={() => setDraft(d => d ? { ...d, enabled: !d.enabled } : d)}>
            {draft.enabled
              ? <ToggleRight size={22} color="var(--accent-green, #4ade80)" />
              : <ToggleLeft  size={22} color="var(--text-secondary)" />}
          </button>
        </div>
      </div>

      {/* Days of week */}
      <div className="form-group-sm" style={{ marginBottom: 12 }}>
        <label>Dias da Semana</label>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {ALL_DAYS.map(dow => (
            <button key={dow} type="button" onClick={() => toggleDay(dow)} style={{
              padding: '3px 8px', borderRadius: 5, border: '1px solid',
              borderColor: activeDays.includes(dow) ? 'var(--accent)' : 'var(--border)',
              background: activeDays.includes(dow) ? 'color-mix(in srgb, var(--accent) 15%, transparent)' : 'transparent',
              color: activeDays.includes(dow) ? 'var(--accent)' : 'var(--text-secondary)',
              fontSize: '0.75rem', fontWeight: activeDays.includes(dow) ? 700 : 400, cursor: 'pointer',
            }}>
              {DAY_LABELS[dow]}
            </button>
          ))}
        </div>
      </div>

      {/* Items header + add buttons */}
      <div className="adbreak-items-header">
        <span>Itens do Bloco</span>
        <div className="ab-item-actions">
          <Button className="ab-add-btn ab-add-btn--spot" size="sm" variant="ghost" onClick={() => addItem('spot_client')} icon={<User size={11} />}>
            Spot de Cliente
          </Button>
          <Button className="ab-add-btn ab-add-btn--action" size="sm" variant="ghost" onClick={() => addItem('vmix_action')} icon={<Zap size={11} />}>
            Ação vMix
          </Button>
          <Button className="ab-add-btn ab-add-btn--input" size="sm" variant="ghost" onClick={() => addItem('vmix_input')} icon={<Monitor size={11} />}>
            Input vMix
          </Button>
          <Button className="ab-add-btn ab-add-btn--pause" size="sm" variant="ghost" onClick={() => addItem('pause')} icon={<Pause size={11} />} title="Pausa pré-programada: ao chegar aqui o motor para e aguarda o próximo disparo manual">
            Pausa
          </Button>
        </div>
      </div>

      {/* Items list */}
      <div className="adbreak-items-list" style={{ minHeight: 32 }}>
        {draft.items.length === 0 && (
          <p className="ab-empty-msg">Adicione itens usando os botões acima.</p>
        )}
        {draft.items.map((item, idx) => (
          <BlockItemRow
            key={item.id} item={item} clients={clients}
            onUpdate={updated => updateItem(item.id, updated)}
            onRemove={() => removeItem(item.id)}
            onMoveUp={() => moveItem(idx, -1)}
            onMoveDown={() => moveItem(idx, 1)}
            isFirst={idx === 0} isLast={idx === draft.items.length - 1}
          />
        ))}
      </div>

      {/* Save / Cancel */}
      <div className="form-actions">
        <Button variant="ghost" onClick={onCancel}>Cancelar</Button>
        <Button variant="primary" onClick={onSave} disabled={!draft.name.trim()}>
          {isNew ? 'Criar Bloco' : 'Salvar Alterações'}
        </Button>
      </div>
    </div>
  )
}

// ─── Main Panel ───────────────────────────────────────────────────────────────
export default function AdBreaksPanel() {
  const { state, dispatch, loadBlockIntoPlaylist, saveToStorage } = useApp()
  const { commercialBlocks, clientSpots, clients, spotRotation, settings } = state
  const today = todayLocal()

  const [expandedId, setExpandedId] = useState<string | null>(null) // block.id or 'new'
  const [draft, setDraft]           = useState<CommercialBlock | null>(null)

  const emptyDraft = (): CommercialBlock => ({
    id: crypto.randomUUID(),
    name: '',
    scheduledTime: '08:00:00',
    enabled: true,
    items: [],
    createdAt: new Date().toISOString(),
  })

  const openExpand = (block: CommercialBlock) => {
    if (expandedId === block.id) {
      setExpandedId(null)
      setDraft(null)
    } else {
      setExpandedId(block.id)
      setDraft({ ...block, items: [...block.items].sort((a, b) => a.order - b.order) })
    }
  }

  const openNew = () => {
    setExpandedId('new')
    setDraft(emptyDraft())
  }

  const handleSaveDraft = () => {
    if (!draft) return
    if (expandedId === 'new') {
      dispatch({ type: 'ADD_COMMERCIAL_BLOCK', payload: draft })
    } else {
      dispatch({ type: 'UPDATE_COMMERCIAL_BLOCK', payload: draft })
    }
    setExpandedId(null)
    setDraft(null)
  }

  const handleCancelDraft = () => {
    setExpandedId(null)
    setDraft(null)
  }

  const handleDeleteBlock = (id: string) => {
    if (window.confirm('Excluir este bloco?')) {
      if (expandedId === id) { setExpandedId(null); setDraft(null) }
      dispatch({ type: 'DELETE_COMMERCIAL_BLOCK', payload: id })
    }
  }

  const handleToggleBlock = (block: CommercialBlock) =>
    dispatch({ type: 'UPDATE_COMMERCIAL_BLOCK', payload: { ...block, enabled: !block.enabled } })

  const handleForceReload = (block: CommercialBlock) => {
    const updated = { ...block, lastLoadedDate: undefined }
    dispatch({ type: 'UPDATE_COMMERCIAL_BLOCK', payload: updated })
    loadBlockIntoPlaylist(updated)
  }

  const handlePreloadMinutesChange = (val: number) => {
    const next = { ...settings, preloadMinutes: Math.max(1, Math.min(60, val)) }
    dispatch({ type: 'SET_SETTINGS', payload: next })
    saveToStorage('settings', next)
  }

  const totalBlockDuration = (block: CommercialBlock) =>
    (block.items ?? []).reduce((acc, item) => {
      if (item.type === 'spot_client') {
        const spots = clientSpots.filter(s => s.clientId === item.clientId)
        if (!spots.length) return acc
        const avg = spots.reduce((a, s) => a + s.duration, 0) / spots.length
        return acc + avg * (item.spotsCount ?? 1)
      }
      if (item.type === 'vmix_input') return acc + (item.duration ?? 10)
      return acc
    }, 0)

  return (
    <div className="adbreaks-panel">
      <PageHeader
        title="Blocos Comerciais"
        subtitle="Gerencie os blocos, o rodízio por anunciante e os atalhos vMix sem sair da operação."
        actions={
          <Button variant="primary" size="sm" onClick={openNew} disabled={expandedId === 'new'} icon={<Plus size={13} />}>
            Novo Bloco
          </Button>
        }
      />

      <div className="adbreaks-list">
        {/* Preload config */}
        <div className="ab-preload-row">
          <Clock size={13} />
          <span>Pré-carregar blocos (workflow manual)</span>
          <input
            type="number" min={1} max={60} value={settings.preloadMinutes ?? 5}
            onChange={e => handlePreloadMinutesChange(parseInt(e.target.value) || 5)}
            className="ab-preload-input"
          />
          <span>min antes do horário</span>
        </div>

        {/* New block inline form */}
        {expandedId === 'new' && draft && (
          <div className="adbreak-card" style={{ border: '2px dashed var(--accent)', opacity: 1 }}>
            <div className="adbreak-card-header">
              <div className="ab-block-info">
                <Clock size={14} color="var(--accent)" />
                <span style={{ color: 'var(--accent)', fontWeight: 600 }}>Novo Bloco</span>
              </div>
            </div>
            <InlineBlockEditor
              draft={draft} setDraft={setDraft}
              onSave={handleSaveDraft} onCancel={handleCancelDraft}
              clients={clients} isNew
            />
          </div>
        )}

        {/* Existing blocks */}
        {commercialBlocks.length === 0 && expandedId !== 'new' ? (
          <div className="panel-empty">Nenhum bloco cadastrado. Clique em "Novo Bloco" para começar.</div>
        ) : (
          [...commercialBlocks]
            .sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime))
            .map(block => {
              const isExpanded    = expandedId === block.id
              const isLoadedToday = block.lastLoadedDate === today
              const dur           = totalBlockDuration(block)
              const now           = new Date()
              const [bh, bm]      = block.scheduledTime.split(':').map(Number)
              const missedToday   = block.enabled && !isLoadedToday && (bh * 60 + bm) < (now.getHours() * 60 + now.getMinutes())

              return (
                <div
                  key={block.id}
                  className="adbreak-card"
                  style={{ opacity: block.enabled ? 1 : 0.55, border: isExpanded ? '1px solid var(--accent)' : undefined }}
                >
                  {/* Card header */}
                  <div className="adbreak-card-header">
                    <div className="ab-block-info">
                      <Clock size={14} color="var(--accent)" />
                      <strong>{block.scheduledTime.slice(0, 5)}</strong>
                      <span>{block.name}</span>
                      {dur > 0 && <Badge>{`≈ ${formatDuration(Math.round(dur))}`}</Badge>}
                      {isLoadedToday && <Badge tone="accent">Carregado hoje</Badge>}
                      {missedToday  && <Badge>Não disparou</Badge>}
                    </div>
                    <div className="adbreak-card-actions">
                      <Button className="adbreak-card-actions-btn ab-action-reload" variant="ghost" size="sm" iconOnly title="Carregar na playlist agora" onClick={() => handleForceReload(block)} icon={<RefreshCw size={13} />} />
                      <Button
                        className="adbreak-card-actions-btn"
                        variant="ghost"
                        size="sm"
                        iconOnly
                        title={block.enabled ? 'Desativar' : 'Ativar'}
                        onClick={() => handleToggleBlock(block)}
                        icon={block.enabled
                          ? <ToggleRight size={15} color="var(--accent-green, #4ade80)" />
                          : <ToggleLeft  size={15} />}
                      />
                      <Button
                        className="adbreak-card-actions-btn"
                        variant="ghost"
                        size="sm"
                        iconOnly
                        title={isExpanded ? 'Fechar editor' : 'Editar bloco'}
                        onClick={() => openExpand(block)}
                        icon={<ExpandIcon size={14} />}
                        style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
                      />
                      <Button className="adbreak-card-actions-btn btn-danger-icon" variant="ghost" size="sm" iconOnly title="Excluir" onClick={() => handleDeleteBlock(block.id)} icon={<Trash2 size={13} />} />
                    </div>
                  </div>

                  {/* Collapsed: days + item badges */}
                  {!isExpanded && (
                    <>
                      {block.daysOfWeek?.length ? (
                        <div style={{ display: 'flex', gap: 4, padding: '4px 12px', flexWrap: 'wrap' }}>
                          {ALL_DAYS.map(dow => (
                            <span key={dow} style={{
                              fontSize: '0.68rem', padding: '2px 6px', borderRadius: 4,
                              fontWeight: block.daysOfWeek!.includes(dow) ? 700 : 400,
                              background: block.daysOfWeek!.includes(dow) ? 'color-mix(in srgb, var(--accent) 15%, transparent)' : 'transparent',
                              color: block.daysOfWeek!.includes(dow) ? 'var(--accent)' : 'var(--text-secondary)',
                              opacity: block.daysOfWeek!.includes(dow) ? 1 : 0.4,
                              border: '1px solid',
                              borderColor: block.daysOfWeek!.includes(dow) ? 'color-mix(in srgb, var(--accent) 40%, transparent)' : 'var(--border)',
                            }}>
                              {DAY_LABELS[dow]}
                            </span>
                          ))}
                        </div>
                      ) : null}

                      <div className="ab-slots-row">
                        {(block.items ?? []).length === 0 && (
                          <span className="ab-empty-msg">
                            Bloco vazio — clique em ▾ para adicionar itens.
                          </span>
                        )}
                        {(block.items ?? []).map((item, i) => {
                          let nextSpotTitle: string | undefined
                          if (item.type === 'spot_client' && item.clientId) {
                            const spots = clientSpots.filter(s => s.clientId === item.clientId)
                            const nextIdx = spotRotation[item.clientId] ?? 0
                            nextSpotTitle = spots.length > 0 ? spots[nextIdx % spots.length]?.title : undefined
                          }
                          return <ItemTypeBadge key={i} item={item} clients={clients} nextSpotTitle={nextSpotTitle} />
                        })}
                      </div>
                    </>
                  )}

                  {/* Expanded: inline editor */}
                  {isExpanded && draft && (
                    <InlineBlockEditor
                      draft={draft} setDraft={setDraft}
                      onSave={handleSaveDraft} onCancel={handleCancelDraft}
                      clients={clients} isNew={false}
                    />
                  )}
                </div>
              )
            })
        )}
      </div>
    </div>
  )
}
