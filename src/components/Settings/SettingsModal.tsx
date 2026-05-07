import { useState } from 'react'
import { X } from 'lucide-react'
import { useApp } from '../../store/AppContext'
import type { AppSettings } from '../../types'
import '../Playlist/ItemModal.css'
import '../AdBreaks/AdBreaksPanel.css'

interface SettingsModalProps {
  onClose: () => void
}

export default function SettingsModal({ onClose }: SettingsModalProps) {
  const { state, dispatch, saveToStorage, t } = useApp()
  const [form, setForm] = useState<AppSettings>({ ...state.settings })
  const [testResult, setTestResult] = useState<string | null>(null)

  const set = <K extends keyof AppSettings>(field: K, value: AppSettings[K]) =>
    setForm((f) => ({ ...f, [field]: value }))

  const handleSave = () => {
    dispatch({ type: 'SET_SETTINGS', payload: form })
    saveToStorage('settings', form)
    onClose()
  }

  const testConnection = async () => {
    if (!window.spotmaster) { setTestResult('API not available in browser mode'); return }
    setTestResult('...')
    const result = await window.spotmaster.vmixRequest({ })
    if (result.success) {
      setTestResult('✅ Connected to vMix!')
    } else {
      setTestResult(`❌ ${result.error}`)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <h2>{t.settings.title}</h2>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>

        <div style={{ padding: '20px', maxHeight: '70vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Station info */}
          <section>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>{t.settings.station}</div>
            <div className="form-group-sm">
              <label>{t.settings.stationName}</label>
              <input value={form.stationName} onChange={(e) => set('stationName', e.target.value)} />
            </div>
          </section>

          {/* vMix */}
          <section>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>{t.settings.vmix}</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <div className="form-group-sm" style={{ flex: 2 }}>
                <label>{t.settings.vmixHost}</label>
                <input value={form.vmixHost} onChange={(e) => set('vmixHost', e.target.value)} placeholder="localhost" />
              </div>
              <div className="form-group-sm" style={{ flex: 1 }}>
                <label>{t.settings.vmixPort}</label>
                <input type="number" value={form.vmixPort} onChange={(e) => set('vmixPort', parseInt(e.target.value) || 8088)} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <div className="form-group-sm" style={{ flex: 1 }}>
                <label>{t.settings.spotmasterInput}</label>
                <input
                  value={form.spotmasterInputName ?? 'SpotMaster'}
                  onChange={(e) => set('spotmasterInputName', e.target.value)}
                  placeholder="SpotMaster"
                />
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.83rem', color: 'var(--text-primary)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={form.autoConnect}
                  onChange={(e) => set('autoConnect', e.target.checked)}
                  style={{ accentColor: 'var(--accent)' }}
                />
                {t.settings.autoConnect}
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.83rem', color: 'var(--text-primary)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={form.autoPlay}
                  onChange={(e) => set('autoPlay', e.target.checked)}
                  style={{ accentColor: 'var(--accent)' }}
                />
                {t.settings.autoPlay}
              </label>
              <button
                className="btn-cancel-sm"
                onClick={testConnection}
                style={{ marginLeft: 'auto' }}
              >
                {t.settings.testConnection}
              </button>
            </div>
            {testResult && (
              <div style={{ marginTop: 8, padding: '6px 10px', background: 'var(--bg-primary)', borderRadius: 5, fontSize: '0.8rem', color: 'var(--text-primary)' }}>
                {testResult}
              </div>
            )}
          </section>

          {/* Appearance */}
          <section>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>{t.settings.appearance}</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <div className="form-group-sm" style={{ flex: 1 }}>
                <label>{t.settings.theme}</label>
                <select
                  value={form.theme}
                  onChange={(e) => set('theme', e.target.value as 'dark' | 'light')}
                  style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 6, padding: '7px 10px', color: 'var(--text-primary)', fontSize: '0.85rem', outline: 'none' }}
                >
                  <option value="dark">{t.settings.themeDark}</option>
                  <option value="light">{t.settings.themeLight}</option>
                </select>
              </div>
              <div className="form-group-sm" style={{ flex: 1 }}>
                <label>{t.settings.language}</label>
                <select
                  value={form.language}
                  onChange={(e) => set('language', e.target.value as 'pt' | 'en')}
                  style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 6, padding: '7px 10px', color: 'var(--text-primary)', fontSize: '0.85rem', outline: 'none' }}
                >
                  <option value="pt">Português (BR)</option>
                  <option value="en">English</option>
                </select>
              </div>
            </div>
          </section>
        </div>

        <div className="modal-actions" style={{ borderTop: '1px solid var(--border)', padding: '14px 20px' }}>
          <button className="btn-cancel" onClick={onClose}>{t.common.cancel}</button>
          <button className="btn-save" onClick={handleSave}>{t.common.save}</button>
        </div>

        {/* Brand credit */}
        <div style={{ padding: '10px 20px 14px', textAlign: 'center', borderTop: '1px solid var(--border)' }}>
          <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', opacity: 0.6 }}>
            VTMaster · Desenvolvido por{' '}
            <strong style={{ color: 'var(--accent)', fontWeight: 700 }}>RobsonCostaDV</strong>
          </span>
        </div>
      </div>
    </div>
  )
}
