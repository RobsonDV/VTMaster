import { useState, useMemo } from 'react'
import {
  Plus, Trash2, Edit2, ChevronDown, ChevronUp, AlertTriangle,
  CheckCircle, Clock, TrendingUp, Calendar, Users, Zap, RotateCcw, RefreshCw, Ban,
} from 'lucide-react'
import { useApp } from '../../store/AppContext'
import type {
  Campaign, CampaignPriority, CampaignModality, CampaignStatus,
  Segment, ProgramWindow, CommercialBlock, CommercialBlockItem,
} from '../../types'
import { dateToLocalYmd, today } from '../../utils/time'
import Button from '../ui/Button'
import PageHeader from '../ui/PageHeader'
import '../AdBreaks/AdBreaksPanel.css'

const DAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6]

// ── Helpers ──────────────────────────────────────────────────────────────────

function daysBetween(start: string, end: string): number {
  return Math.floor((new Date(end).getTime() - new Date(start).getTime()) / 86400000)
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return dateToLocalYmd(d)
}

function stableShuffleScore(seed: string, id: string): number {
  let hash = 2166136261
  const text = `${seed}:${id}`
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function computeEffectiveStatus(camp: Campaign, todayStr: string): CampaignStatus {
  if (camp.status === 'paused' || camp.status === 'completed') return camp.status
  if (camp.endDate < todayStr) return 'expired'
  if (camp.startDate > todayStr) return 'paused'
  return 'active'
}

function statusColor(s: CampaignStatus): string {
  if (s === 'active') return 'var(--success)'
  if (s === 'paused') return '#f59e0b'
  if (s === 'expired') return 'var(--error)'
  return 'var(--text-secondary)'
}

function Chip({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span style={{
      padding: '2px 8px', borderRadius: 4, fontSize: '0.72rem', fontWeight: 700,
      background: `color-mix(in srgb, ${color} 15%, transparent)`,
      color, border: `1px solid color-mix(in srgb, ${color} 30%, transparent)`,
    }}>{children}</span>
  )
}

function blockIsInWindow(block: CommercialBlock, pw: ProgramWindow, todayDow: number): boolean {
  if (!pw.daysOfWeek.includes(todayDow)) return false
  return block.scheduledTime >= pw.timeFrom && block.scheduledTime <= pw.timeTo
}

// ── Distribution modal ────────────────────────────────────────────────────────

interface DistributionPreview {
  block: CommercialBlock
  reason: string
  blocked: boolean
}

function DistributeModal({
  campaign, blocks, programWindows, clients, campaigns, onConfirm, onCancel,
}: {
  campaign: Campaign
  blocks: CommercialBlock[]
  programWindows: ProgramWindow[]
  clients: { id: string; name: string }[]
  campaigns: Campaign[]
  onConfirm: (targetBlockIds: string[]) => void
  onCancel: () => void
}) {
  const todayDow = new Date().getDay()

  const { eligible, blockedBySegment } = useMemo(() => {
    if (campaign.modality === 'rotativo') return { eligible: [], blockedBySegment: [] }

    const enabledBlocks = blocks.filter(b => b.enabled)

    const pws = (campaign.programWindowIds ?? [])
      .map(id => programWindows.find(p => p.id === id))
      .filter(Boolean) as ProgramWindow[]

    const inWindow = pws.length === 0
      ? enabledBlocks
      : enabledBlocks.filter(b => pws.some(pw => blockIsInWindow(b, pw, todayDow)))

    const notDuplicate = inWindow.filter(b =>
      !(b.items ?? []).some(
        it => it.type === 'spot_client' && it.clientId === campaign.clientId && it.campaignId === campaign.id
      )
    )

    const eligible: DistributionPreview[] = []
    const blockedBySegment: DistributionPreview[] = []

    for (const b of notDuplicate) {
      if (campaign.segmentId) {
        // Find any competitor (same segment, different client) already in this block
        const competitorItem = (b.items ?? []).find(it => {
          if (it.type !== 'spot_client' || !it.clientId || it.clientId === campaign.clientId) return false
          if (!it.campaignId) return false
          const otherCamp = campaigns.find(c => c.id === it.campaignId)
          return otherCamp?.segmentId === campaign.segmentId
        })
        if (competitorItem) {
          const competitorName = clients.find(c => c.id === competitorItem.clientId)?.name ?? 'concorrente'
          blockedBySegment.push({ block: b, reason: competitorName, blocked: true })
          continue
        }
      }
      eligible.push({ block: b, reason: '', blocked: false })
    }

    return { eligible, blockedBySegment }
  }, [campaign, blocks, programWindows, campaigns, clients, todayDow])

  // Randomize and respect spotsPerDay limit
  const selected = useMemo(() => {
    const shuffled = [...eligible].sort((a, b) =>
      stableShuffleScore(`${campaign.id}:${today()}`, a.block.id) -
      stableShuffleScore(`${campaign.id}:${today()}`, b.block.id)
    )
    const limit = campaign.spotsPerDay && campaign.spotsPerDay > 0
      ? campaign.spotsPerDay
      : shuffled.length
    return shuffled.slice(0, limit)
  }, [eligible, campaign.spotsPerDay, campaign.id])

  const clientName = clients.find(c => c.id === campaign.clientId)?.name ?? '—'

  if (eligible.length === 0 && blockedBySegment.length === 0) {
    return (
      <div style={{
        position: 'fixed', inset: 0, background: '#00000080', zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{ background: 'var(--bg-secondary)', borderRadius: 12, padding: 28, maxWidth: 440, width: '90%', border: '1px solid var(--border)' }}>
          <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: 12 }}>Distribuição</div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginBottom: 20 }}>
            Nenhum bloco elegível encontrado para esta campanha.
          </div>
          <Button variant="ghost" onClick={onCancel}>Fechar</Button>
        </div>
      </div>
    )
  }

  if (eligible.length === 0 && blockedBySegment.length > 0) {
    return (
      <div style={{
        position: 'fixed', inset: 0, background: '#00000080', zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{ background: 'var(--bg-secondary)', borderRadius: 12, padding: 28, maxWidth: 480, width: '90%', border: '1px solid var(--border)' }}>
          <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: 8 }}>Distribuição bloqueada</div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 16 }}>
            Todos os blocos elegíveis já contêm um concorrente do mesmo segmento. A campanha <b style={{ color: 'var(--text-primary)' }}>{campaign.name}</b> não pode ser distribuída sem conflito de segmento.
          </div>
          <div style={{ marginBottom: 16 }}>
            {blockedBySegment.map(({ block, reason }) => (
              <div key={block.id} style={{ padding: '6px 10px', borderRadius: 6, marginBottom: 4, background: '#ef444410', border: '1px solid #ef444430', fontSize: '0.82rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 600 }}>{block.name}</span>
                <span style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Ban size={11} /> {reason}
                </span>
              </div>
            ))}
          </div>
          <Button variant="ghost" onClick={onCancel}>Fechar</Button>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: '#00000080', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{ background: 'var(--bg-secondary)', borderRadius: 12, padding: 28, maxWidth: 520, width: '90%', border: '1px solid var(--border)', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: 4 }}>Confirmar Distribuição</div>
        <div style={{ fontSize: '0.83rem', color: 'var(--text-secondary)', marginBottom: 16 }}>
          <b style={{ color: 'var(--text-primary)' }}>{campaign.name}</b> — {clientName}
        </div>

        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 8 }}>
          {eligible.length} bloco{eligible.length !== 1 ? 's' : ''} elegível{eligible.length !== 1 ? 'is' : ''} encontrado{eligible.length !== 1 ? 's' : ''}.
          {campaign.spotsPerDay && campaign.spotsPerDay > 0 && eligible.length > campaign.spotsPerDay && (
            <> Limite de <b>{campaign.spotsPerDay}/dia</b> — selecionados <b>{selected.length}</b> aleatoriamente.</>
          )}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', marginBottom: 16 }}>
          {selected.map(({ block }) => (
            <div key={block.id} style={{
              padding: '7px 10px', borderRadius: 6, marginBottom: 4,
              background: 'var(--bg-primary)', border: '1px solid var(--border)',
              fontSize: '0.83rem', display: 'flex', justifyContent: 'space-between',
            }}>
              <span style={{ fontWeight: 600 }}>{block.name}</span>
              <span style={{ color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{block.scheduledTime}</span>
            </div>
          ))}

          {blockedBySegment.length > 0 && (
            <>
              <div style={{ fontSize: '0.75rem', color: '#ef4444', fontWeight: 600, margin: '10px 0 6px', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Ban size={11} /> {blockedBySegment.length} bloco{blockedBySegment.length !== 1 ? 's' : ''} bloqueado{blockedBySegment.length !== 1 ? 's' : ''} por concorrência de segmento
              </div>
              {blockedBySegment.map(({ block, reason }) => (
                <div key={block.id} style={{
                  padding: '7px 10px', borderRadius: 6, marginBottom: 4,
                  background: '#ef444410', border: '1px solid #ef444430',
                  fontSize: '0.83rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{block.name}</span>
                  <span style={{ color: '#ef4444', fontFamily: 'monospace', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Ban size={11} /> {reason}
                  </span>
                </div>
              ))}
            </>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Button variant="ghost" onClick={onCancel}>Cancelar</Button>
          <Button variant="primary" onClick={() => onConfirm(selected.map(s => s.block.id))}>
            Aplicar Distribuição
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── Renew modal ───────────────────────────────────────────────────────────────

function RenewModal({
  campaign,
  clients,
  onConfirm,
  onCancel,
}: {
  campaign: Campaign
  clients: { id: string; name: string }[]
  onConfirm: (newStartDate: string, newEndDate: string, markPreviousCompleted: boolean) => void
  onCancel: () => void
}) {
  const duration = Math.max(1, daysBetween(campaign.startDate, campaign.endDate))
  const defaultStart = addDays(campaign.endDate, 1)
  const defaultEnd = addDays(defaultStart, duration)

  const [newStart, setNewStart] = useState(defaultStart)
  const [newEnd, setNewEnd] = useState(defaultEnd)
  const [markCompleted, setMarkCompleted] = useState(true)

  const clientName = clients.find(c => c.id === campaign.clientId)?.name ?? '—'
  const newDuration = Math.max(0, daysBetween(newStart, newEnd))

  return (
    <div style={{
      position: 'fixed', inset: 0, background: '#00000080', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{ background: 'var(--bg-secondary)', borderRadius: 12, padding: 28, maxWidth: 460, width: '90%', border: '1px solid var(--border)' }}>
        <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: 4 }}>Renovar Campanha</div>
        <div style={{ fontSize: '0.83rem', color: 'var(--text-secondary)', marginBottom: 20 }}>
          <b style={{ color: 'var(--text-primary)' }}>{campaign.name}</b> — {clientName}
        </div>

        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: 4 }}>Período anterior</div>
        <div style={{ fontSize: '0.85rem', fontFamily: 'monospace', color: 'var(--text-secondary)', marginBottom: 16, padding: '6px 10px', background: 'var(--bg-primary)', borderRadius: 6, border: '1px solid var(--border)' }}>
          {campaign.startDate} → {campaign.endDate} ({duration} dias, {campaign.totalSpots} spots)
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          <div>
            <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Novo início *</label>
            <input
              type="date"
              value={newStart}
              onChange={e => setNewStart(e.target.value)}
              style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 5, padding: '6px 10px', color: 'var(--text-primary)', fontSize: '0.85rem', outline: 'none', width: '100%' }}
            />
          </div>
          <div>
            <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Novo fim *</label>
            <input
              type="date"
              value={newEnd}
              min={newStart}
              onChange={e => setNewEnd(e.target.value)}
              style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 5, padding: '6px 10px', color: 'var(--text-primary)', fontSize: '0.85rem', outline: 'none', width: '100%' }}
            />
          </div>
        </div>

        {newDuration > 0 && (
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: 16 }}>
            Nova duração: <b style={{ color: 'var(--text-primary)' }}>{newDuration} dias</b> · Spots contratados: <b style={{ color: 'var(--text-primary)' }}>{campaign.totalSpots}</b> (herdados)
          </div>
        )}

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.83rem', color: 'var(--text-primary)', marginBottom: 20, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={markCompleted}
            onChange={e => setMarkCompleted(e.target.checked)}
          />
          Marcar campanha anterior como <b>Concluída</b>
        </label>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Button variant="ghost" onClick={onCancel}>Cancelar</Button>
          <Button
            variant="primary"
            disabled={!newStart || !newEnd || newEnd < newStart}
            onClick={() => onConfirm(newStart, newEnd, markCompleted)}
          >
            Criar Renovação
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── Campaign form state ───────────────────────────────────────────────────────

interface CampaignFormState {
  clientId: string
  name: string
  modality: CampaignModality
  startDate: string
  endDate: string
  totalSpots: number
  spotsPerDay: number
  daysOfWeek: number[]
  segmentId: string
  programWindowIds: string[]
  priority: CampaignPriority
  blockPosition: number
  status: CampaignStatus
  notes: string
}

const EMPTY_FORM: CampaignFormState = {
  clientId: '', name: '', modality: 'standard',
  startDate: today(), endDate: '',
  totalSpots: 30, spotsPerDay: 1,
  daysOfWeek: ALL_DAYS, segmentId: '',
  programWindowIds: [], priority: 2,
  blockPosition: 0,
  status: 'active', notes: '',
}

// ── Main panel ───────────────────────────────────────────────────────────────

export default function CampaignsPanel() {
  const { state, dispatch, t, saveToStorage } = useApp()
  const { campaigns, clients, playLog, commercialBlocks, segments, programWindows } = state
  const tc = t.campaigns
  const todayStr = today()

  const [activeTab, setActiveTab] = useState<'campaigns' | 'segments' | 'programs'>('campaigns')

  // Campaign tab state
  const [filterStatus, setFilterStatus] = useState<CampaignStatus | 'all'>('all')
  const [filterClient, setFilterClient] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null)
  const [form, setForm] = useState<CampaignFormState>(EMPTY_FORM)
  const [distributeTarget, setDistributeTarget] = useState<Campaign | null>(null)
  const [renewTarget, setRenewTarget] = useState<Campaign | null>(null)

  // Segment tab state
  const [editingSegment, setEditingSegment] = useState<Segment | null>(null)
  const [segForm, setSegForm] = useState({ name: '', description: '' })
  const [showSegForm, setShowSegForm] = useState(false)

  // ProgramWindow tab state
  const [editingPW, setEditingPW] = useState<ProgramWindow | null>(null)
  const [pwForm, setPwForm] = useState({ name: '', daysOfWeek: ALL_DAYS, timeFrom: '', timeTo: '', notes: '' })
  const [showPwForm, setShowPwForm] = useState(false)

  // ── Computed ────────────────────────────────────────────────────────────────

  const airedByCampaign = useMemo(() => {
    const map: Record<string, number> = {}
    for (const log of playLog) {
      if (log.campaignId && log.status === 'aired') {
        map[log.campaignId] = (map[log.campaignId] ?? 0) + 1
      }
    }
    return map
  }, [playLog])

  const competitorConflicts = useMemo(() => {
    const conflicts: { block: string; clients: string[] }[] = []
    for (const block of commercialBlocks) {
      if (!block.enabled) continue
      const bySegment: Record<string, string[]> = {}
      for (const it of (block.items ?? [])) {
        if (it.type !== 'spot_client' || !it.clientId || !it.campaignId) continue
        const camp = campaigns.find(c => c.id === it.campaignId)
        if (!camp?.segmentId) continue
        bySegment[camp.segmentId] = bySegment[camp.segmentId] ?? []
        bySegment[camp.segmentId].push(it.clientId)
      }
      for (const [, ids] of Object.entries(bySegment)) {
        if (ids.length > 1) {
          const names = [...new Set(ids)].map(id => clients.find(c => c.id === id)?.name ?? id)
          conflicts.push({ block: block.name, clients: names })
        }
      }
    }
    return conflicts
  }, [campaigns, commercialBlocks, clients])

  const filtered = useMemo(() => {
    return campaigns.filter(camp => {
      const eff = computeEffectiveStatus(camp, todayStr)
      if (filterStatus !== 'all' && eff !== filterStatus) return false
      if (filterClient && camp.clientId !== filterClient) return false
      return true
    }).sort((a, b) => {
      const sa = computeEffectiveStatus(a, todayStr)
      const sb = computeEffectiveStatus(b, todayStr)
      if (sa === 'active' && sb !== 'active') return -1
      if (sa !== 'active' && sb === 'active') return 1
      return a.priority - b.priority
    })
  }, [campaigns, filterStatus, filterClient, todayStr])

  // ── Campaign handlers ────────────────────────────────────────────────────────

  const openNewCampaign = () => {
    setEditingCampaign(null)
    setForm({ ...EMPTY_FORM, startDate: todayStr })
    setShowForm(true)
  }

  const openEditCampaign = (camp: Campaign) => {
    setEditingCampaign(camp)
    setForm({
      clientId: camp.clientId, name: camp.name,
      modality: camp.modality ?? 'standard',
      startDate: camp.startDate, endDate: camp.endDate,
      totalSpots: camp.totalSpots, spotsPerDay: camp.spotsPerDay ?? 1,
      daysOfWeek: camp.daysOfWeek ?? ALL_DAYS,
      segmentId: camp.segmentId ?? '',
      programWindowIds: camp.programWindowIds ?? [],
      priority: camp.priority,
      blockPosition: camp.blockPosition ?? 0,
      status: camp.status, notes: camp.notes ?? '',
    })
    setShowForm(true)
  }

  const handleSaveCampaign = () => {
    if (!form.clientId || !form.name || !form.startDate || !form.endDate || form.totalSpots < 1) return
    const payload: Campaign = {
      id: editingCampaign?.id ?? crypto.randomUUID(),
      createdAt: editingCampaign?.createdAt ?? new Date().toISOString(),
      clientId: form.clientId, name: form.name,
      modality: form.modality,
      startDate: form.startDate, endDate: form.endDate,
      totalSpots: form.totalSpots,
      spotsPerDay: form.spotsPerDay > 0 ? form.spotsPerDay : undefined,
      daysOfWeek: form.daysOfWeek.length === 7 ? undefined : form.daysOfWeek,
      segmentId: form.segmentId || undefined,
      programWindowIds: form.programWindowIds.length > 0 ? form.programWindowIds : undefined,
      priority: form.priority,
      blockPosition: form.blockPosition > 0 ? form.blockPosition : undefined,
      status: form.status,
      notes: form.notes || undefined,
    }
    if (editingCampaign) {
      dispatch({ type: 'UPDATE_CAMPAIGN', payload })
      saveToStorage('campaigns', state.campaigns.map(c => c.id === payload.id ? payload : c))
    } else {
      dispatch({ type: 'ADD_CAMPAIGN', payload })
      saveToStorage('campaigns', [...state.campaigns, payload])
    }
    setShowForm(false)
  }

  const handleDeleteCampaign = (id: string) => {
    if (!window.confirm(t.common.confirmDelete)) return
    dispatch({ type: 'DELETE_CAMPAIGN', payload: id })
    saveToStorage('campaigns', state.campaigns.filter(c => c.id !== id))
    if (expandedId === id) setExpandedId(null)
  }

  const handleDistribute = (targetBlockIds: string[]) => {
    if (!distributeTarget) return
    const camp = distributeTarget
    const updatedBlocks = state.commercialBlocks.map(block => {
      if (!targetBlockIds.includes(block.id)) return block
      const already = (block.items ?? []).some(
        it => it.type === 'spot_client' && it.clientId === camp.clientId && it.campaignId === camp.id
      )
      if (already) return block
      const newItem: CommercialBlockItem = {
        id: crypto.randomUUID(),
        order: (block.items ?? []).length + 1,
        type: 'spot_client',
        clientId: camp.clientId,
        spotsCount: 1,
        campaignId: camp.id,
      }
      return { ...block, items: [...(block.items ?? []), newItem] }
    })
    for (const block of updatedBlocks) {
      const orig = state.commercialBlocks.find(b => b.id === block.id)
      if (orig && orig.items.length !== block.items.length) {
        dispatch({ type: 'UPDATE_COMMERCIAL_BLOCK', payload: block })
      }
    }
    saveToStorage('commercialBlocks', updatedBlocks)
    setDistributeTarget(null)
  }

  const handleRenew = (newStartDate: string, newEndDate: string, markPreviousCompleted: boolean) => {
    if (!renewTarget) return
    const orig = renewTarget

    // Create renewed campaign with new dates, same settings
    const renewed: Campaign = {
      ...orig,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      name: `${orig.name} (Renovação)`,
      startDate: newStartDate,
      endDate: newEndDate,
      status: 'active',
    }

    let updatedCampaigns = [...state.campaigns, renewed]

    // Optionally mark the previous campaign as completed
    if (markPreviousCompleted) {
      updatedCampaigns = updatedCampaigns.map(c =>
        c.id === orig.id ? { ...c, status: 'completed' as CampaignStatus } : c
      )
      dispatch({ type: 'UPDATE_CAMPAIGN', payload: { ...orig, status: 'completed' } })
    }

    dispatch({ type: 'ADD_CAMPAIGN', payload: renewed })
    saveToStorage('campaigns', updatedCampaigns)
    setRenewTarget(null)
  }

  // ── Segment handlers ─────────────────────────────────────────────────────────

  const openNewSegment = () => { setEditingSegment(null); setSegForm({ name: '', description: '' }); setShowSegForm(true) }
  const openEditSegment = (s: Segment) => { setEditingSegment(s); setSegForm({ name: s.name, description: s.description ?? '' }); setShowSegForm(true) }
  const handleSaveSegment = () => {
    if (!segForm.name) return
    const payload: Segment = {
      id: editingSegment?.id ?? crypto.randomUUID(),
      createdAt: editingSegment?.createdAt ?? new Date().toISOString(),
      name: segForm.name, description: segForm.description || undefined,
    }
    if (editingSegment) {
      dispatch({ type: 'UPDATE_SEGMENT', payload })
      saveToStorage('segments', state.segments.map(s => s.id === payload.id ? payload : s))
    } else {
      dispatch({ type: 'ADD_SEGMENT', payload })
      saveToStorage('segments', [...state.segments, payload])
    }
    setShowSegForm(false)
  }
  const handleDeleteSegment = (id: string) => {
    if (!window.confirm(t.common.confirmDelete)) return
    dispatch({ type: 'DELETE_SEGMENT', payload: id })
    saveToStorage('segments', state.segments.filter(s => s.id !== id))
  }

  // ── ProgramWindow handlers ───────────────────────────────────────────────────

  const openNewPW = () => { setEditingPW(null); setPwForm({ name: '', daysOfWeek: ALL_DAYS, timeFrom: '', timeTo: '', notes: '' }); setShowPwForm(true) }
  const openEditPW = (p: ProgramWindow) => { setEditingPW(p); setPwForm({ name: p.name, daysOfWeek: p.daysOfWeek, timeFrom: p.timeFrom, timeTo: p.timeTo, notes: p.notes ?? '' }); setShowPwForm(true) }
  const handleSavePW = () => {
    if (!pwForm.name || !pwForm.timeFrom || !pwForm.timeTo) return
    const payload: ProgramWindow = {
      id: editingPW?.id ?? crypto.randomUUID(),
      createdAt: editingPW?.createdAt ?? new Date().toISOString(),
      name: pwForm.name, daysOfWeek: pwForm.daysOfWeek,
      timeFrom: pwForm.timeFrom, timeTo: pwForm.timeTo,
      notes: pwForm.notes || undefined,
    }
    if (editingPW) {
      dispatch({ type: 'UPDATE_PROGRAM_WINDOW', payload })
      saveToStorage('programWindows', state.programWindows.map(p => p.id === payload.id ? payload : p))
    } else {
      dispatch({ type: 'ADD_PROGRAM_WINDOW', payload })
      saveToStorage('programWindows', [...state.programWindows, payload])
    }
    setShowPwForm(false)
  }
  const handleDeletePW = (id: string) => {
    if (!window.confirm(t.common.confirmDelete)) return
    dispatch({ type: 'DELETE_PROGRAM_WINDOW', payload: id })
    saveToStorage('programWindows', state.programWindows.filter(p => p.id !== id))
  }
  const togglePWDay = (day: number) => {
    setPwForm(f => ({
      ...f, daysOfWeek: f.daysOfWeek.includes(day)
        ? f.daysOfWeek.filter(d => d !== day)
        : [...f.daysOfWeek, day].sort(),
    }))
  }

  // ── Styles ──────────────────────────────────────────────────────────────────

  const inp = {
    background: 'var(--bg-primary)', border: '1px solid var(--border)',
    borderRadius: 5, padding: '6px 10px',
    color: 'var(--text-primary)', fontSize: '0.85rem',
    outline: 'none', width: '100%',
  } as const

  const tabStyle = (active: boolean) => ({
    padding: '7px 18px', borderRadius: 7, border: 'none',
    background: active ? 'var(--accent)' : 'transparent',
    color: active ? '#fff' : 'var(--text-secondary)',
    fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer',
  })

  // ── Rotativo position helper ─────────────────────────────────────────────────

  const rotativoPosition = (camp: Campaign): string => {
    const allBlocks = commercialBlocks.filter(b => b.enabled).sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime))
    if (allBlocks.length === 0) return '—'
    const elapsed = Math.max(0, daysBetween(camp.startDate, todayStr))
    const idx = elapsed % allBlocks.length
    const block = allBlocks[idx]
    return `${block.name} (${block.scheduledTime})`
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="adbreaks-panel">
      <PageHeader
        title="Comercial Pro"
        actions={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {competitorConflicts.length > 0 && activeTab === 'campaigns' && (
              <Chip color="var(--error)">
                <AlertTriangle size={11} style={{ display: 'inline', marginRight: 3 }} />
                {competitorConflicts.length} conflito{competitorConflicts.length > 1 ? 's' : ''}
              </Chip>
            )}
            {activeTab === 'campaigns' && <Button variant="primary" icon={<Plus size={14} />} onClick={openNewCampaign}>{tc.newCampaign}</Button>}
            {activeTab === 'segments' && <Button variant="primary" icon={<Plus size={14} />} onClick={openNewSegment}>{tc.newSegment}</Button>}
            {activeTab === 'programs' && <Button variant="primary" icon={<Plus size={14} />} onClick={openNewPW}>{tc.newProgram}</Button>}
          </div>
        }
      />

      {/* Tabs */}
      <div style={{ padding: '0 20px 10px', display: 'flex', gap: 4, borderBottom: '1px solid var(--border)', marginBottom: 12 }}>
        {(['campaigns', 'segments', 'programs'] as const).map(tab => (
          <button key={tab} style={tabStyle(activeTab === tab)} onClick={() => setActiveTab(tab)}>
            {tab === 'campaigns' ? tc.tabCampaigns : tab === 'segments' ? tc.tabSegments : tc.tabPrograms}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 20px' }}>

        {/* ═══════════════════════════════════ CAMPAIGNS TAB ═══════════════════ */}
        {activeTab === 'campaigns' && (
          <>
            {/* Filters */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as CampaignStatus | 'all')} style={{ ...inp, width: 'auto', minWidth: 140 }}>
                <option value="all">{tc.allStatuses}</option>
                <option value="active">{tc.statusActive}</option>
                <option value="paused">{tc.statusPaused}</option>
                <option value="expired">{tc.statusExpired}</option>
                <option value="completed">{tc.statusCompleted}</option>
              </select>
              <select value={filterClient} onChange={e => setFilterClient(e.target.value)} style={{ ...inp, width: 'auto', minWidth: 160 }}>
                <option value="">{t.common.all} anunciantes</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            {/* Conflict alerts */}
            {competitorConflicts.map((cf, i) => (
              <div key={i} style={{ padding: '8px 12px', marginBottom: 8, background: '#ef444415', border: '1px solid #ef444440', borderRadius: 7, fontSize: '0.8rem' }}>
                <b style={{ color: '#ef4444' }}>Conflito de segmento — {cf.block}:</b>{' '}
                <span style={{ color: 'var(--text-secondary)' }}>{cf.clients.join(', ')}</span>
              </div>
            ))}

            {filtered.length === 0 && !showForm && (
              <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                {campaigns.length === 0 ? tc.empty : 'Nenhuma campanha com esses filtros.'}
              </div>
            )}

            {/* Campaign cards */}
            {filtered.map(camp => {
              const aired = airedByCampaign[camp.id] ?? 0
              const pct = camp.totalSpots > 0 ? Math.min(100, Math.round((aired / camp.totalSpots) * 100)) : 0
              const eff = computeEffectiveStatus(camp, todayStr)
              const client = clients.find(c => c.id === camp.clientId)
              const daysLeft = daysBetween(todayStr, camp.endDate)
              const isExpanded = expandedId === camp.id
              const isExpiringSoon = eff === 'active' && daysLeft >= 0 && daysLeft <= 7
              const segment = segments.find(s => s.id === camp.segmentId)
              const pws = (camp.programWindowIds ?? []).map(id => programWindows.find(p => p.id === id)?.name).filter(Boolean)
              const canRenew = eff === 'expired' || eff === 'completed' || (eff === 'active' && pct >= 90)

              return (
                <div key={camp.id} style={{ border: '1px solid var(--border)', borderRadius: 10, marginBottom: 10, overflow: 'hidden', background: 'var(--bg-secondary)' }}>
                  {/* Header */}
                  <div
                    onClick={() => setExpandedId(isExpanded ? null : camp.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', cursor: 'pointer', borderLeft: `3px solid ${statusColor(eff)}` }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                        {camp.modality === 'rotativo' && <RotateCcw size={13} style={{ color: '#7c3aed', flexShrink: 0 }} />}
                        <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{camp.name}</span>
                        <Chip color={statusColor(eff)}>
                          {eff === 'active' ? tc.statusActive : eff === 'paused' ? tc.statusPaused : eff === 'expired' ? tc.statusExpired : tc.statusCompleted}
                        </Chip>
                        {camp.modality === 'rotativo' && <Chip color="#7c3aed">{tc.modalityRotativo}</Chip>}
                        {isExpiringSoon && <Chip color="#f59e0b">{tc.expiringIn} {daysLeft}d</Chip>}
                        {pct >= 100 && eff === 'active' && <Chip color="var(--success)">{tc.completedLabel}</Chip>}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 3, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        <span><Users size={10} style={{ display: 'inline', marginRight: 3 }} />{client?.name ?? '—'}</span>
                        <span><Calendar size={10} style={{ display: 'inline', marginRight: 3 }} />{camp.startDate} → {camp.endDate}</span>
                        {segment && <span style={{ color: '#7c3aed' }}>#{segment.name}</span>}
                        {pws.length > 0 && <span style={{ color: 'var(--text-secondary)' }}>📺 {pws.join(', ')}</span>}
                      </div>
                    </div>

                    {/* Progress */}
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: '1rem', fontWeight: 700 }}>{aired}<span style={{ fontSize: '0.72rem', fontWeight: 400, color: 'var(--text-secondary)' }}>/{camp.totalSpots}</span></div>
                      <div style={{ width: 80, height: 4, background: 'var(--border)', borderRadius: 2, marginTop: 4 }}>
                        <div style={{ width: `${pct}%`, height: '100%', borderRadius: 2, background: pct >= 100 ? 'var(--success)' : pct > 60 ? '#f59e0b' : 'var(--accent)' }} />
                      </div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', marginTop: 1 }}>{pct}%</div>
                    </div>

                    <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                      {camp.modality === 'standard' && eff === 'active' && (
                        <button
                          onClick={e => { e.stopPropagation(); setDistributeTarget(camp) }}
                          title={tc.distribute}
                          style={{ background: 'var(--accent)', border: 'none', color: '#fff', cursor: 'pointer', padding: '3px 8px', borderRadius: 4, fontSize: '0.72rem', fontWeight: 600 }}
                        >
                          <Zap size={11} style={{ display: 'inline', marginRight: 3 }} />Distribuir
                        </button>
                      )}
                      {canRenew && (
                        <button
                          onClick={e => { e.stopPropagation(); setRenewTarget(camp) }}
                          title="Renovar campanha"
                          style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--success)', cursor: 'pointer', padding: '3px 8px', borderRadius: 4, fontSize: '0.72rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3 }}
                        >
                          <RefreshCw size={11} />Renovar
                        </button>
                      )}
                      <button onClick={e => { e.stopPropagation(); openEditCampaign(camp) }} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 4, borderRadius: 4 }} title={tc.editCampaign}><Edit2 size={14} /></button>
                      <button onClick={e => { e.stopPropagation(); handleDeleteCampaign(camp.id) }} style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', padding: 4, borderRadius: 4 }} title={tc.deleteCampaign}><Trash2 size={14} /></button>
                      {isExpanded ? <ChevronUp size={14} style={{ color: 'var(--text-secondary)' }} /> : <ChevronDown size={14} style={{ color: 'var(--text-secondary)' }} />}
                    </div>
                  </div>

                  {/* Expanded */}
                  {isExpanded && (
                    <div style={{ borderTop: '1px solid var(--border)', padding: '12px 14px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
                      <StatBox icon={<TrendingUp size={13} />} label={tc.contracted} value={String(camp.totalSpots)} />
                      <StatBox icon={<CheckCircle size={13} />} label={tc.aired} value={String(aired)} color={aired > 0 ? 'var(--success)' : undefined} />
                      <StatBox icon={<Clock size={13} />} label={tc.remaining} value={String(Math.max(0, camp.totalSpots - aired))} />
                      {camp.spotsPerDay && <StatBox label="Limite/dia" value={`${camp.spotsPerDay} spots`} />}
                      {(camp.blockPosition ?? 0) > 0 && <StatBox label={tc.blockPosition.replace(' (0–100)', '')} value={String(camp.blockPosition)} />}
                      {camp.modality === 'rotativo' && (
                        <StatBox icon={<RotateCcw size={13} />} label={tc.rotativoPosition} value={rotativoPosition(camp)} color="#7c3aed" />
                      )}
                      {camp.daysOfWeek && <StatBox label="Dias" value={camp.daysOfWeek.map(d => DAY_LABELS[d]).join(', ')} />}
                      {camp.notes && <div style={{ gridColumn: '1 / -1', fontSize: '0.78rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>{camp.notes}</div>}
                    </div>
                  )}
                </div>
              )
            })}

            {/* Campaign form */}
            {showForm && (
              <div style={{ border: '1px solid var(--accent)', borderRadius: 10, marginTop: 16, background: 'var(--bg-secondary)', overflow: 'hidden' }}>
                <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', fontWeight: 600, fontSize: '0.9rem' }}>
                  {editingCampaign ? tc.editCampaign : tc.newCampaign}
                </div>
                <div style={{ padding: 16 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 12 }}>

                    <FormField label={`${tc.client} *`}>
                      <select value={form.clientId} onChange={e => setForm(f => ({ ...f, clientId: e.target.value }))} style={inp}>
                        <option value="">Selecionar...</option>
                        {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </FormField>

                    <FormField label={`${tc.name} *`} span={2}>
                      <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={inp} placeholder="Ex: Campanha Julho 2026" />
                    </FormField>

                    <FormField label={tc.modality}>
                      <select value={form.modality} onChange={e => setForm(f => ({ ...f, modality: e.target.value as CampaignModality }))} style={inp}>
                        <option value="standard">{tc.modalityStandard}</option>
                        <option value="rotativo">{tc.modalityRotativo}</option>
                      </select>
                      {form.modality === 'rotativo' && (
                        <div style={{ fontSize: '0.72rem', color: '#7c3aed', marginTop: 4 }}>{tc.modalityRotativoHint}</div>
                      )}
                    </FormField>

                    <FormField label={`${tc.startDate} *`}>
                      <input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} style={inp} />
                    </FormField>

                    <FormField label={`${tc.endDate} *`}>
                      <input type="date" value={form.endDate} min={form.startDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} style={inp} />
                    </FormField>

                    <FormField label={`${tc.totalSpots} *`}>
                      <input type="number" min={1} value={form.totalSpots} onChange={e => setForm(f => ({ ...f, totalSpots: Math.max(1, parseInt(e.target.value) || 1) }))} style={inp} />
                    </FormField>

                    {form.modality === 'standard' && (
                      <FormField label={tc.spotsPerDay} hint={tc.spotsPerDayHint}>
                        <input type="number" min={0} value={form.spotsPerDay} onChange={e => setForm(f => ({ ...f, spotsPerDay: Math.max(0, parseInt(e.target.value) || 0) }))} style={inp} />
                      </FormField>
                    )}

                    <FormField label={tc.priority}>
                      <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: parseInt(e.target.value) as CampaignPriority }))} style={inp}>
                        <option value={1}>{tc.priorityHigh}</option>
                        <option value={2}>{tc.priorityMedium}</option>
                        <option value={3}>{tc.priorityLow}</option>
                      </select>
                    </FormField>

                    <FormField label={tc.blockPosition} hint={tc.blockPositionHint}>
                      <input
                        type="number" min={0} max={100}
                        value={form.blockPosition}
                        onChange={e => setForm(f => ({ ...f, blockPosition: Math.min(100, Math.max(0, parseInt(e.target.value) || 0)) }))}
                        style={inp}
                      />
                    </FormField>

                    {form.modality === 'standard' && (
                      <FormField label={tc.segment} hint={tc.segmentHint}>
                        <select value={form.segmentId} onChange={e => setForm(f => ({ ...f, segmentId: e.target.value }))} style={inp}>
                          <option value="">{tc.noSegment}</option>
                          {segments.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                      </FormField>
                    )}

                    <FormField label={tc.status}>
                      <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as CampaignStatus }))} style={inp}>
                        <option value="active">{tc.statusActive}</option>
                        <option value="paused">{tc.statusPaused}</option>
                        <option value="completed">{tc.statusCompleted}</option>
                      </select>
                    </FormField>

                    {/* Program windows (only standard) */}
                    {form.modality === 'standard' && programWindows.length > 0 && (
                      <FormField label={tc.programWindows} span={2} hint={tc.programWindowsHint}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {programWindows.map(pw => {
                            const sel = form.programWindowIds.includes(pw.id)
                            return (
                              <button
                                key={pw.id} type="button"
                                onClick={() => setForm(f => ({
                                  ...f,
                                  programWindowIds: sel
                                    ? f.programWindowIds.filter(id => id !== pw.id)
                                    : [...f.programWindowIds, pw.id],
                                }))}
                                style={{
                                  padding: '4px 10px', borderRadius: 5, fontSize: '0.78rem', fontWeight: 600,
                                  border: `1px solid ${sel ? 'var(--accent)' : 'var(--border)'}`,
                                  background: sel ? 'var(--accent)' : 'var(--bg-primary)',
                                  color: sel ? '#fff' : 'var(--text-secondary)', cursor: 'pointer',
                                }}
                              >
                                {pw.name} ({pw.timeFrom}–{pw.timeTo})
                              </button>
                            )
                          })}
                        </div>
                      </FormField>
                    )}

                    {/* Days of week */}
                    <FormField label={tc.daysOfWeek} span={2}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {ALL_DAYS.map(d => {
                          const sel = form.daysOfWeek.includes(d)
                          return (
                            <button key={d} type="button"
                              onClick={() => setForm(f => ({ ...f, daysOfWeek: sel ? f.daysOfWeek.filter(x => x !== d) : [...f.daysOfWeek, d].sort() }))}
                              style={{ padding: '4px 8px', borderRadius: 5, fontSize: '0.78rem', fontWeight: 600, border: `1px solid ${sel ? 'var(--accent)' : 'var(--border)'}`, background: sel ? 'var(--accent)' : 'var(--bg-primary)', color: sel ? '#fff' : 'var(--text-secondary)', cursor: 'pointer' }}
                            >{DAY_LABELS[d]}</button>
                          )
                        })}
                      </div>
                    </FormField>

                    <FormField label={tc.notes} span={2}>
                      <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} style={{ ...inp, minHeight: 56, resize: 'vertical' }} />
                    </FormField>
                  </div>

                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 14 }}>
                    <Button variant="ghost" onClick={() => setShowForm(false)}>{t.common.cancel}</Button>
                    <Button variant="primary" onClick={handleSaveCampaign}
                      disabled={!form.clientId || !form.name || !form.startDate || !form.endDate || form.totalSpots < 1 || form.endDate < form.startDate}>
                      {t.common.save}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* ═══════════════════════════════════ SEGMENTS TAB ═══════════════════ */}
        {activeTab === 'segments' && (
          <>
            {segments.length === 0 && !showSegForm && (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{tc.segmentsEmpty}</div>
            )}
            {segments.map(seg => (
              <div key={seg.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 8, background: 'var(--bg-secondary)', border: '1px solid var(--border)', marginBottom: 8 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{seg.name}</div>
                  {seg.description && <div style={{ fontSize: '0.77rem', color: 'var(--text-secondary)', marginTop: 2 }}>{seg.description}</div>}
                </div>
                <button onClick={() => openEditSegment(seg)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 4 }}><Edit2 size={13} /></button>
                <button onClick={() => handleDeleteSegment(seg.id)} style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', padding: 4 }}><Trash2 size={13} /></button>
              </div>
            ))}
            {showSegForm && (
              <div style={{ border: '1px solid var(--accent)', borderRadius: 10, padding: 16, marginTop: 12, background: 'var(--bg-secondary)' }}>
                <FormField label={`${tc.segmentName} *`}>
                  <input value={segForm.name} onChange={e => setSegForm(f => ({ ...f, name: e.target.value }))} style={inp} placeholder="Ex: Automóvel, Banco, Saúde..." autoFocus />
                </FormField>
                <FormField label={tc.segmentDesc}>
                  <input value={segForm.description} onChange={e => setSegForm(f => ({ ...f, description: e.target.value }))} style={inp} placeholder="Descrição opcional" />
                </FormField>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 10 }}>
                  <Button variant="ghost" onClick={() => setShowSegForm(false)}>{t.common.cancel}</Button>
                  <Button variant="primary" onClick={handleSaveSegment} disabled={!segForm.name}>{t.common.save}</Button>
                </div>
              </div>
            )}
          </>
        )}

        {/* ═══════════════════════════════════ PROGRAMS TAB ═══════════════════ */}
        {activeTab === 'programs' && (
          <>
            {programWindows.length === 0 && !showPwForm && (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{tc.programsEmpty}</div>
            )}
            {programWindows.map(pw => (
              <div key={pw.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 8, background: 'var(--bg-secondary)', border: '1px solid var(--border)', marginBottom: 8 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{pw.name}</div>
                  <div style={{ fontSize: '0.77rem', color: 'var(--text-secondary)', marginTop: 2, display: 'flex', gap: 10 }}>
                    <span style={{ fontFamily: 'monospace' }}>{pw.timeFrom} – {pw.timeTo}</span>
                    <span>{pw.daysOfWeek.map(d => DAY_LABELS[d]).join(', ')}</span>
                  </div>
                </div>
                <button onClick={() => openEditPW(pw)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 4 }}><Edit2 size={13} /></button>
                <button onClick={() => handleDeletePW(pw.id)} style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', padding: 4 }}><Trash2 size={13} /></button>
              </div>
            ))}
            {showPwForm && (
              <div style={{ border: '1px solid var(--accent)', borderRadius: 10, padding: 16, marginTop: 12, background: 'var(--bg-secondary)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 12 }}>
                  <FormField label={`${tc.programName} *`} span={2}>
                    <input value={pwForm.name} onChange={e => setPwForm(f => ({ ...f, name: e.target.value }))} style={inp} placeholder="Ex: Jornal das 12h" autoFocus />
                  </FormField>
                  <FormField label={`${tc.programFrom} *`}>
                    <input type="time" value={pwForm.timeFrom} onChange={e => setPwForm(f => ({ ...f, timeFrom: e.target.value }))} style={inp} />
                  </FormField>
                  <FormField label={`${tc.programTo} *`}>
                    <input type="time" value={pwForm.timeTo} onChange={e => setPwForm(f => ({ ...f, timeTo: e.target.value }))} style={inp} />
                  </FormField>
                  <FormField label={tc.programDays} span={2}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {ALL_DAYS.map(d => {
                        const sel = pwForm.daysOfWeek.includes(d)
                        return (
                          <button key={d} type="button" onClick={() => togglePWDay(d)}
                            style={{ padding: '4px 8px', borderRadius: 5, fontSize: '0.78rem', fontWeight: 600, border: `1px solid ${sel ? 'var(--accent)' : 'var(--border)'}`, background: sel ? 'var(--accent)' : 'var(--bg-primary)', color: sel ? '#fff' : 'var(--text-secondary)', cursor: 'pointer' }}
                          >{DAY_LABELS[d]}</button>
                        )
                      })}
                    </div>
                  </FormField>
                  <FormField label={tc.programNotes} span={2}>
                    <input value={pwForm.notes} onChange={e => setPwForm(f => ({ ...f, notes: e.target.value }))} style={inp} />
                  </FormField>
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 10 }}>
                  <Button variant="ghost" onClick={() => setShowPwForm(false)}>{t.common.cancel}</Button>
                  <Button variant="primary" onClick={handleSavePW} disabled={!pwForm.name || !pwForm.timeFrom || !pwForm.timeTo}>{t.common.save}</Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Distribution modal */}
      {distributeTarget && (
        <DistributeModal
          campaign={distributeTarget}
          blocks={commercialBlocks}
          programWindows={programWindows}
          clients={clients}
          campaigns={campaigns}
          onConfirm={handleDistribute}
          onCancel={() => setDistributeTarget(null)}
        />
      )}

      {/* Renew modal */}
      {renewTarget && (
        <RenewModal
          campaign={renewTarget}
          clients={clients}
          onConfirm={handleRenew}
          onCancel={() => setRenewTarget(null)}
        />
      )}
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function FormField({ label, hint, span, children }: { label: string; hint?: string; span?: number; children: React.ReactNode }) {
  return (
    <div style={{ gridColumn: span ? `span ${span}` : undefined }}>
      <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>{label}</label>
      {children}
      {hint && <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: 3 }}>{hint}</div>}
    </div>
  )
}

function StatBox({ icon, label, value, color }: { icon?: React.ReactNode; label: string; value: string; color?: string }) {
  return (
    <div style={{ background: 'var(--bg-primary)', borderRadius: 7, padding: '8px 10px' }}>
      <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>{icon}{label}</div>
      <div style={{ fontSize: '1rem', fontWeight: 700, color: color ?? 'var(--text-primary)' }}>{value}</div>
    </div>
  )
}
