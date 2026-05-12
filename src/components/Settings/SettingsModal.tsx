import { useState, useEffect } from 'react'
import { useApp } from '../../store/AppContext'
import type { AppSettings } from '../../types'
import Badge from '../ui/Badge'
import Button from '../ui/Button'
import { Field, FieldRow, Section } from '../ui/Field'
import Modal from '../ui/Modal'
import '../Playlist/ItemModal.css'

interface SettingsModalProps {
  onClose: () => void
}

function keyEventToAccelerator(e: KeyboardEvent): string {
  const parts: string[] = []
  if (e.ctrlKey) parts.push('CommandOrControl')
  if (e.altKey) parts.push('Alt')
  if (e.shiftKey) parts.push('Shift')
  const keyMap: Record<string, string> = {
    ' ': 'Space', ArrowUp: 'Up', ArrowDown: 'Down',
    ArrowLeft: 'Left', ArrowRight: 'Right',
    Enter: 'Return', Escape: 'Escape', Backspace: 'Backspace',
    Delete: 'Delete', Tab: 'Tab', Home: 'Home', End: 'End',
    PageUp: 'PageUp', PageDown: 'PageDown', Insert: 'Insert',
    F1: 'F1', F2: 'F2', F3: 'F3', F4: 'F4', F5: 'F5',
    F6: 'F6', F7: 'F7', F8: 'F8', F9: 'F9', F10: 'F10',
    F11: 'F11', F12: 'F12', MediaPlayPause: 'MediaPlayPause',
    MediaStop: 'MediaStop', MediaNextTrack: 'MediaNextTrack',
    MediaPreviousTrack: 'MediaPreviousTrack',
  }
  const mapped = keyMap[e.key] ?? (e.key.length === 1 ? e.key.toUpperCase() : e.key)
  parts.push(mapped)
  return parts.join('+')
}

function triggerToDisplay(key: string): string {
  if (key.startsWith('GAMEPAD:')) {
    const parts = key.split(':')
    const gpNum = (parseInt(parts[1] ?? '0') + 1).toString()
    const btnNum = (parseInt(parts[3] ?? '0') + 1).toString()
    return `Gamepad ${gpNum} - Botao ${btnNum}`
  }
  if (key.startsWith('MIDI:')) {
    const note = key.split(':')[1] ?? '?'
    return `MIDI - Nota ${note}`
  }
  return key.replace('CommandOrControl', 'Ctrl').replace(/\+/g, ' + ')
}

export default function SettingsModal({ onClose }: SettingsModalProps) {
  const { state, dispatch, saveToStorage, t } = useApp()
  const [form, setForm] = useState<AppSettings>({ ...state.settings })
  const [testResult, setTestResult] = useState<string | null>(null)
  const [isCapturing, setIsCapturing] = useState(false)
  const [captureHint, setCaptureHint] = useState('')
  const [appVersion, setAppVersion] = useState('')

  useEffect(() => {
    window.spotmaster?.getVersion().then(v => setAppVersion(v)).catch(() => {})
  }, [])

  const set = <K extends keyof AppSettings>(field: K, value: AppSettings[K]) =>
    setForm((f) => ({ ...f, [field]: value }))

  const saveKey = (key: string) => {
    set('triggerKey', key)
    setIsCapturing(false)
    setCaptureHint('')
  }

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

  useEffect(() => {
    if (!isCapturing) return
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

    return () => clearInterval(interval)
  }, [isCapturing]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isCapturing || !navigator.requestMIDIAccess) return
    let midiAccess: MIDIAccess | null = null

    navigator.requestMIDIAccess().then((access) => {
      midiAccess = access
      access.inputs.forEach((input) => {
        input.onmidimessage = (event) => {
          const data = event.data
          if (!data || data.length < 2) return
          const status = data[0] & 0xf0
          const note = data[1]
          const vel = data[2] ?? 127
          if (status === 0x90 && vel > 0) saveKey(`MIDI:${note}`)
          if (status === 0xb0 && vel > 63) saveKey(`MIDI:CC${note}`)
        }
      })
    }).catch(() => {})

    return () => {
      if (midiAccess) midiAccess.inputs.forEach(input => { input.onmidimessage = null })
    }
  }, [isCapturing]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = () => {
    dispatch({ type: 'SET_SETTINGS', payload: form })
    saveToStorage('settings', form)
    onClose()
  }

  const testConnection = async () => {
    if (!window.spotmaster) {
      setTestResult('API not available in browser mode')
      return
    }
    setTestResult('...')
    const result = await window.spotmaster.vmixRequest({})
    setTestResult(result.success ? 'Conectado ao vMix.' : `Erro: ${result.error}`)
  }

  const defaultCaptureHint = [...navigator.getGamepads()].some(Boolean)
    ? 'Pressione tecla, botao do gamepad ou nota MIDI...'
    : 'Pressione qualquer tecla...'

  return (
    <Modal
      title={t.settings.title}
      onClose={onClose}
      maxWidth={560}
      bodyStyle={{ maxHeight: '70vh', overflowY: 'auto', gap: 20 }}
      actions={
        <>
          <Button variant="ghost" onClick={onClose}>{t.common.cancel}</Button>
          <Button variant="primary" onClick={handleSave}>{t.common.save}</Button>
        </>
      }
    >
      <Section title={t.settings.station}>
        <Field label={t.settings.stationName}>
          <input className="ui-input" value={form.stationName} onChange={(e) => set('stationName', e.target.value)} />
        </Field>
      </Section>

      <Section title={t.settings.vmix}>
        <FieldRow>
          <Field label={t.settings.vmixHost} className="settings-grow-2">
            <input className="ui-input" value={form.vmixHost} onChange={(e) => set('vmixHost', e.target.value)} placeholder="localhost" />
          </Field>
          <Field label={t.settings.vmixPort}>
            <input className="ui-input" type="number" value={form.vmixPort} onChange={(e) => set('vmixPort', parseInt(e.target.value) || 8088)} />
          </Field>
        </FieldRow>

        <Field label={t.settings.spotmasterInput}>
          <input
            className="ui-input"
            value={form.spotmasterInputName ?? 'VTMaster'}
            onChange={(e) => set('spotmasterInputName', e.target.value)}
            placeholder="VTMaster"
          />
        </Field>

        <div className="settings-inline-actions">
          <label className="settings-check">
            <input type="checkbox" checked={form.autoConnect} onChange={(e) => set('autoConnect', e.target.checked)} />
            {t.settings.autoConnect}
          </label>
          <label className="settings-check">
            <input type="checkbox" checked={form.autoPlay} onChange={(e) => set('autoPlay', e.target.checked)} />
            {t.settings.autoPlay}
          </label>
          <Button variant="secondary" size="sm" onClick={testConnection} className="settings-inline-push">
            {t.settings.testConnection}
          </Button>
        </div>

        {testResult && <div className="ui-card-note">{testResult}</div>}
      </Section>

      <Section title={t.settings.disparo}>
        <div className="settings-capture-row">
          <Field label={t.settings.disparoKey}>
            <div className={`settings-capture-box ${isCapturing ? 'is-capturing' : ''}`}>
              {isCapturing
                ? (captureHint || t.settings.disparoCapturing)
                : form.triggerKey
                  ? triggerToDisplay(form.triggerKey)
                  : t.settings.disparoNone}
            </div>
          </Field>

          <Button
            variant={isCapturing ? 'danger' : 'secondary'}
            onClick={() => {
              setIsCapturing(c => {
                const next = !c
                setCaptureHint(next ? defaultCaptureHint : '')
                return next
              })
            }}
          >
            {isCapturing ? t.settings.disparoCancelBtn : t.settings.disparoCaptureBtn}
          </Button>

          {form.triggerKey && !isCapturing && (
            <Button variant="ghost" onClick={() => set('triggerKey', null)}>
              {t.settings.disparoClearBtn}
            </Button>
          )}
        </div>

        <div className="ui-field-hint">{t.settings.disparoHint}</div>

        <div className="settings-badge-row">
          <Badge>Teclado</Badge>
          <Badge>Gamepad / Joystick</Badge>
          <Badge>MIDI</Badge>
        </div>
      </Section>

      <Section title={t.settings.appearance}>
        <FieldRow>
          <Field label={t.settings.theme}>
            <select
              className="ui-select"
              value={form.theme}
              onChange={(e) => set('theme', e.target.value as 'dark' | 'light')}
            >
              <option value="dark">{t.settings.themeDark}</option>
              <option value="light">{t.settings.themeLight}</option>
            </select>
          </Field>
          <Field label={t.settings.language}>
            <select
              className="ui-select"
              value={form.language}
              onChange={(e) => set('language', e.target.value as 'pt' | 'en')}
            >
              <option value="pt">Português (BR)</option>
              <option value="en">English</option>
            </select>
          </Field>
        </FieldRow>
      </Section>

      <div className="settings-brand-footer">
        <span>
          VTMaster
          {appVersion && <span className="settings-version-pill">v{appVersion}</span>}
          {' · Desenvolvido por '}
          <strong>RobsonCostaDV</strong>
        </span>
      </div>
    </Modal>
  )
}
