import { useState } from 'react'
import { Plus, Edit2, Trash2, Search } from 'lucide-react'
import { useApp } from '../../store/AppContext'
import type { Client } from '../../types'
import '../AdBreaks/AdBreaksPanel.css'

export default function ClientsPanel() {
  const { state, dispatch, t } = useApp()
  const { clients, playLog } = state

  const [editing, setEditing] = useState<Client | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', contact: '', email: '', phone: '', notes: '' })
  const [search, setSearch] = useState('')

  const openNew = () => {
    setEditing(null)
    setForm({ name: '', contact: '', email: '', phone: '', notes: '' })
    setShowForm(true)
  }

  const openEdit = (c: Client) => {
    setEditing(c)
    setForm({ name: c.name, contact: c.contact ?? '', email: c.email ?? '', phone: c.phone ?? '', notes: c.notes ?? '' })
    setShowForm(true)
  }

  const handleSave = () => {
    if (!form.name.trim()) return
    if (editing) {
      dispatch({ type: 'UPDATE_CLIENT', payload: { ...editing, ...form } })
    } else {
      dispatch({
        type: 'ADD_CLIENT',
        payload: { id: crypto.randomUUID(), ...form, createdAt: new Date().toISOString() },
      })
    }
    setShowForm(false)
  }

  const handleDelete = (id: string) => {
    if (window.confirm(t.common.confirmDelete)) {
      dispatch({ type: 'DELETE_CLIENT', payload: id })
    }
  }

  const set = (field: string, val: string) => setForm((f) => ({ ...f, [field]: val }))

  const spotCount = (clientId: string) =>
    playLog.filter((l) => l.clientId === clientId && l.status === 'aired').length

  const visibleClients = search.trim()
    ? clients.filter(c => c.name.toLowerCase().includes(search.toLowerCase()))
    : clients

  if (showForm) {
    return (
      <div className="clients-panel">
        <div className="panel-header">
          <h2>{editing ? t.clients.editClient : t.clients.newClient}</h2>
          <button className="btn-cancel-sm" onClick={() => setShowForm(false)}>{t.common.cancel}</button>
        </div>
        <div className="adbreak-form">
          {[
            { field: 'name', label: t.clients.name, required: true },
            { field: 'contact', label: t.clients.contact },
            { field: 'email', label: t.clients.email },
            { field: 'phone', label: t.clients.phone },
          ].map(({ field, label }) => (
            <div key={field} className="form-group-sm">
              <label>{label}</label>
              <input
                value={(form as Record<string, string>)[field]}
                onChange={(e) => set(field, e.target.value)}
              />
            </div>
          ))}
          <div className="form-group-sm">
            <label>{t.clients.notes}</label>
            <textarea
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              rows={3}
              style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 6, padding: '7px 10px', color: 'var(--text-primary)', fontSize: '0.85rem', outline: 'none', fontFamily: 'inherit', resize: 'vertical' }}
            />
          </div>
          <div className="form-actions">
            <button className="btn-cancel" onClick={() => setShowForm(false)}>{t.common.cancel}</button>
            <button className="btn-save" onClick={handleSave}>{t.common.save}</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="clients-panel">
      <div className="panel-header">
        <h2>{t.clients.title}</h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px' }}>
            <Search size={12} style={{ color: 'var(--text-secondary)' }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar anunciante..."
              style={{ background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: '0.8rem', width: 150 }}
            />
          </div>
          <button className="btn-primary-sm" onClick={openNew}>
            <Plus size={14} /> {t.clients.newClient}
          </button>
        </div>
      </div>

      {visibleClients.length === 0 ? (
        <div className="panel-empty">{clients.length === 0 ? t.clients.empty : 'Nenhum resultado para a busca.'}</div>
      ) : (
        <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem' }}>
            <thead>
              <tr>
                {[t.clients.name, t.clients.contact, t.clients.email, t.clients.phone, t.clients.spotCount, t.common.actions].map((h) => (
                  <th key={h} style={{ textAlign: 'left', padding: '8px 10px', borderBottom: '1px solid var(--border)', color: 'var(--text-secondary)', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleClients.map((c) => (
                <tr key={c.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '9px 10px', fontWeight: 500, color: 'var(--text-primary)' }}>{c.name}</td>
                  <td style={{ padding: '9px 10px', color: 'var(--text-secondary)' }}>{c.contact ?? '—'}</td>
                  <td style={{ padding: '9px 10px', color: 'var(--text-secondary)' }}>{c.email ?? '—'}</td>
                  <td style={{ padding: '9px 10px', color: 'var(--text-secondary)' }}>{c.phone ?? '—'}</td>
                  <td style={{ padding: '9px 10px', textAlign: 'center', color: 'var(--accent)', fontWeight: 600 }}>{spotCount(c.id)}</td>
                  <td style={{ padding: '9px 10px' }}>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button onClick={() => openEdit(c)} style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 5, padding: '4px 8px', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}>
                        <Edit2 size={13} />
                      </button>
                      <button onClick={() => handleDelete(c.id)} style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 5, padding: '4px 8px', cursor: 'pointer', color: 'var(--error)', display: 'flex', alignItems: 'center' }}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
