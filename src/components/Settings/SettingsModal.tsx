import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { useApp } from '../../store/AppContext'
import type { AppSettings } from '../../types'
import '../Playlist/ItemModal.css'
import '../AdBreaks/AdBreaksPanel.css'

interface SettingsModalProps {
  onClose: () => void
}

// ── Keyboard ─────────────────────────────────────────────────────────────────
function keyEventToAccelerator(e: KeyboardEvent): string {
  const parts: string[] = []
  if (e.ctrlKey) parts.push('CommandOrControl')
  if (e.altKey) parts.push('Alt')
  if (e.shiftKey) parts.push('Shift')
  const keyMap: Record<string, string> = {
    ' ': 'Space', 'ArrowUp': 'Up', 'ArrowDown': 'Down',
    'ArrowLeft': 'Left', 'ArrowRight': 'Right',
    'Enter': 'Return', 'Escape': 'Escape', 'Backspace': 'Backspace',
    'Delete': 'Delete', 'Tab': 'Tab', 'Home': 'Home', 'End': 'End',
    'PageUp': 'PageUp', 'PageDown': 'PageDown', 'Insert': 'Insert',
    'F1': 'F1', 'F2': 'F2', 'F3': 'F3', 'F4': 'F4', 'F5': 'F5',
    'F6': 'F6', 'F7': 'F7', 'F8': 'F8', 'F9': 'F9', 'F10': 'F10',
    'F11': 'F11', 'F12': 'F12', 'MediaPlayPause': 'MediaPlayPause',
    'MediaStop': 'MediaStop', 'MediaNextTrack': 'MediaNextTrack',
    'MediaPreviousTrack': 'MediaPreviousTrack',
  }
  const mapped = keyMap[e.key] ?? (e.key.length === 1 ? e.key.toUpperCase() : e.key)
  parts.push(mapped)
  return parts.join('+')
}

// ── Display ───────────────────────────────────────────────────────────────────
function triggerToDisplay(key: string): string {
  if (key.startsWith('GAMEPAD:')) {
    const parts = key.split(':')
    const gpNum  = (parseInt(parts[1] ?? '0') + 1).toString()
    const btnNum = (parseInt(parts[3] ?? '0') + 1).toString()
    return `🎮 Gamepad ${gpNum} · Botão ${btnNum}`
  }
  if (key.startsWith('MIDI:')) {
    const note = key.split(':')[1] ?? '?'
    return `🎹 MIDI · Nota ${note}`
  }
  return key.replace('CommandOrControl', 'Ctrl').replace(/\+/g, ' + ')
}

export default function SettingsModal({ onClose }: SettingsModalProps) {
  const { state, dispatch, saveToStorage, t } = useApp()
  const [form, setForm] = useState<AppSettings>({ ...state.settings })
  const [testResult, setTestResult] = useState<string | null>(null)
  const [isCapturing, setIsCapturing] = useState(false)
  const [captureHint, setCaptureHint] = useState('')

  const set = <K extends keyof AppSettings>(field: K, value: AppSettings[K]) =>
    setForm((f) => ({ ...f, [field]: value }))

  const saveKey = (key: string) => {
    set('triggerKey', key)
    setIsCapturing(false)
    setCaptureHint('')
  }

  // ── Captura: Teclado ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isCapturing) return
    const handler = (e: KeyboardEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) return
      saveKey(keyEventToAccelerator(e))
    }
    window.addEventListener('keydown', handler, true)
    return () => window.removeEventListener('keydown', handler, true)
  }, [isCapturing]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Captura: Gamepad (polling 80ms) ────────────────────────────────────────
  useEffect(() => {
    if (!isCapturing) return
    // Snapshot de quais botões JÁ estavam pressionados ao entrar no modo captura
    // (evita capturar um botão que estava pressionado antes de clicar "Capturar")
    const initialPressed: Record<string, boolean> = {}
    const gpads = navigator.getGamepads()
    for (let g = 0; g < gpads.length; g++) {
      const gp = gpads[g]
      if (!gp) continue
      for (let b = 0; b < gp.buttons.length; b++) {
        if (gp.buttons[b].pressed) initialPressed[`${g}:${b}`] = true
      }
    }

    const interval = setInterval(() => {
      const pads = navigator.getGamepads()
      for (let g = 0; g < pads.length; g++) {
        const gp = pads[g]
        if (!gp) continue
        for (let b = 0; b < gp.buttons.length; b++) {
          const id = `${g}:${b}`
          if (gp.buttons[b].pressed && !initialPressed[id]) {
            saveKey(`GAMEPAD:${g}:BUTTON:${b}`)
            return
          }
          if (!gp.buttons[b].pressed) delete initialPressed[id]
        }
      }
    }, 80)

    // Avisa que gamepad está sendo monitorado (se houver gamepads conectados)
    if ([...navigator.getGamepads()].some(Boolean)) {
      setCaptureHint('⚡ Pressione tecla, botão do gamepad ou nota MIDI...')
    } else {
      setCaptureHint('⚡ Pressione qualquer tecla...')
    }

    return () => clearInterval(interval)
  }, [isCapturing]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Captura: MIDI ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isCapturing) return
    if (!navigator.requestMIDIAccess) return
    let midiAccess: MIDIAccess | null = null

    navigator.requestMIDIAccess().then((access) => {
      midiAccess = access
      access.inputs.forEach((input) => {
        input.onmidimessage = (event) => {
          const data = event.data
          if (!data || data.length < 2) return
          const status = data[0] & 0xf0   // tipo da mensagem (0x90 = note on)
          const note   = data[1]
          const vel    = data[2] ?? 127
          // Note On com velocity > 0
          if (status === 0x90 && vel > 0) {
            saveKey(`MIDI:${note}`)
          }
          // Control Change
          if (status === 0xb0 && vel > 63) {
            saveKey(`MIDI:CC${note}`)
          }
        }
      })
      if (access.inputs.size > 0) {
        setCaptureHint('⚡ Pressione tecla, botão do gamepad ou nota MIDI...')
      }
    }).catch(() => {
      // MIDI não disponível, captura só por teclado/gamepad
    })

    return () => {
      if (midiAccess) {
        midiAccess.inputs.forEach(input => { input.onmidimessage = null })
      }
    }
  }, [isCapturing]) // eslint-disable-line react-hooks/exhaustive-deps

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

          {/* Disparo */}
          <section>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>{t.settings.disparo}</div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>{t.settings.disparoKey}</label>
                <div style={{
                  padding: '8px 12px',
                  background: 'var(--bg-primary)',
                  border: `1px solid ${isCapturing ? 'var(--accent)' : 'var(--border)'}`,
                  borderRadius: 6,
                  fontSize: '0.85rem',
                  color: form.triggerKey ? 'var(--text-primary)' : 'var(--text-secondary)',
                  minHeight: 35,
                  display: 'flex',
                  alignItems: 'center',
                  transition: 'border-color 0.2s',
                  fontWeight: form.triggerKey ? 600 : 400,
                  letterSpacing: form.triggerKey ? '0.5px' : 'normal',
                }}>
                  {isCapturing
                    ? (captureHint || t.settings.disparoCapturing)
                    : form.triggerKey
                      ? triggerToDisplay(form.triggerKey)
                      : t.settings.disparoNone}
                </div>
              </div>
              <button
                className={isCapturing ? 'btn-danger' : 'btn-cancel-sm'}
                onClick={() => setIsCapturing(c => !c)}
              >
                {isCapturing ? t.settings.disparoCancelBtn : t.settings.disparoCaptureBtn}
              </button>
              {form.triggerKey && !isCapturing && (
                <button className="btn-cancel-sm" onClick={() => set('triggerKey', null)}>
                  {t.settings.disparoClearBtn}
                </button>
              )}
            </div>
            <p style={{ margin: '8px 0 0', fontSize: '0.74rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              {t.settings.disparoHint}
            </p>
            <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {(['⌨️ Teclado', '🎮 Gamepad / Joystick', '🎹 MIDI'] as const).map(d => (
                <span key={d} style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: 4, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                  {d}
                </span>
              ))}
            </div>
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
