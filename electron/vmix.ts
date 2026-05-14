import http from 'http'

// ─────────────────────────────────────────────────────────────────────────────
// vMix HTTP API Integration
// Documentation: https://www.vmix.com/help/index.htm#HTTPAPI.html
// ─────────────────────────────────────────────────────────────────────────────

export interface VmixStatus {
  connected: boolean
  version?: string
  edition?: string
  inputs?: VmixInput[]
  activeInput?: string
  previewInput?: string
  recording?: boolean
  streaming?: boolean
  external?: boolean
  fadeToBlack?: boolean
}

export interface VmixInput {
  number: string
  type: string
  title: string
  shortTitle: string
  state: string
  duration: number
  position: number
  key: string        // vMix GUID — stable across input renumbering
}

let pollingInterval: ReturnType<typeof setInterval> | null = null
let currentHost = 'localhost'
let currentPort = 8088

// Hash compacto do status para deduplicar emissões IPC idênticas
function statusHash(s: VmixStatus): string {
  if (!s.connected) return `off|${(s as VmixStatus & { error?: string }).error ?? ''}`
  const inputsPart = (s.inputs ?? [])
    .map(i => `${i.number}:${i.key}:${i.type}:${i.title}:${i.state}:${i.duration}`)
    .join('|')
  return `${s.version}|${s.activeInput}|${s.previewInput}|${s.recording}|${s.streaming}|${s.fadeToBlack}|${inputsPart}`
}

// ─────────────────────────────────────────────────────────────────────────────
// HTTP request to vMix API
// ─────────────────────────────────────────────────────────────────────────────
export function makeVmixRequest(
  params: Record<string, string>,
  host = currentHost,
  port = currentPort
): Promise<{ success: boolean; data?: string; error?: string }> {
  return new Promise((resolve) => {
    const query = new URLSearchParams(params).toString()
    const options = {
      hostname: host,
      port,
      path: query ? `/api/?${query}` : '/api/',

      method: 'GET',
      timeout: 3000,
    }

    const req = http.request(options, (res) => {
      const chunks: Buffer[] = []
      res.on('data', (chunk: Buffer) => { chunks.push(chunk) })
      res.on('end', () => resolve({ success: true, data: Buffer.concat(chunks).toString('utf8') }))
    })

    req.on('error', (err) => resolve({ success: false, error: err.message }))
    req.on('timeout', () => {
      req.destroy()
      resolve({ success: false, error: 'Request timeout' })
    })

    req.end()
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Parse vMix XML status response
// ─────────────────────────────────────────────────────────────────────────────
function parseVmixStatus(xml: string): VmixStatus {
  // Aceita <tag>valor</tag> e <tag/> (self-closing → string vazia).
  // Suporta atributos no elemento de abertura.
  const getValue = (tag: string): string => {
    const match = xml.match(new RegExp(`<${tag}\\b[^>]*>([^<]*)<\\/${tag}>`, 'i'))
    if (match) return match[1].trim()
    // Self-closing fallback
    if (new RegExp(`<${tag}\\b[^>]*\\/>`, 'i').test(xml)) return ''
    return ''
  }

  const getAttr = (tag: string, attr: string): string => {
    const tagMatch = xml.match(new RegExp(`<${tag}\\b([^>]*)\\/?>`, 'i'))
    if (!tagMatch) return ''
    const attrMatch = tagMatch[1].match(new RegExp(`\\b${attr}="([^"]*)"`, 'i'))
    return attrMatch ? attrMatch[1] : ''
  }

  // Parse inputs — defensivamente tolerante:
  //   <input attrs>content</input>   (formato clássico do vMix)
  //   <input attrs/>                 (self-closing — versões recentes/otimizadas)
  //   <input attrs >content</input>  (com espaços extras antes do >)
  const inputs: VmixInput[] = []
  const inputRegex = /<input\b([^>/]*)(?:\/>|>([\s\S]*?)<\/input>)/gi
  let inputMatch
  while ((inputMatch = inputRegex.exec(xml)) !== null) {
    const attrs = inputMatch[1]
    const innerText = (inputMatch[2] ?? '').trim()
    const getInputAttr = (attr: string): string => {
      const m = attrs.match(new RegExp(`\\b${attr}="([^"]*)"`, 'i'))
      return m ? m[1] : ''
    }
    inputs.push({
      number: getInputAttr('number'),
      key:    getInputAttr('key'),
      type: getInputAttr('type'),
      title: innerText || getInputAttr('title'),
      shortTitle: getInputAttr('shortTitle'),
      state: getInputAttr('state'),
      duration: parseInt(getInputAttr('duration') || '0'),
      position: parseInt(getInputAttr('position') || '0'),
    })
  }

  return {
    connected: true,
    version: getValue('version'),
    edition: getValue('edition'),
    inputs,
    activeInput: getAttr('active', 'number') || getValue('active'),
    previewInput: getAttr('preview', 'number') || getValue('preview'),
    recording: getValue('recording') === 'True',
    streaming: getValue('streaming') === 'True',
    external: getValue('external') === 'True',
    fadeToBlack: getValue('fadeToBlack') === 'True',
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Polling: fetches vMix status every 2 seconds and calls callback
// ─────────────────────────────────────────────────────────────────────────────
export function startVmixPolling(
  host: string,
  port: number,
  onStatus: (status: VmixStatus) => void
): void {
  stopVmixPolling()
  currentHost = host
  currentPort = port

  // Backoff counters: when vMix is offline for 3+ consecutive polls, skip
  // 4 out of every 5 ticks → effective interval ~10 s instead of 2 s.
  // Resets instantly on reconnect so the first successful response fires normally.
  let consecutiveFailures = 0
  let backoffCounter = 0
  let lastHash = ''
  const emit = (status: VmixStatus) => {
    const h = statusHash(status)
    if (h === lastHash) return
    lastHash = h
    onStatus(status)
  }

  const poll = async () => {
    backoffCounter++
    if (consecutiveFailures >= 3 && backoffCounter % 5 !== 0) return

    const result = await makeVmixRequest({}, host, port)
    if (result.success && result.data) {
      consecutiveFailures = 0
      try {
        const status = parseVmixStatus(result.data)
        emit(status)
      } catch {
        emit({ connected: false, error: 'Parse error' } as VmixStatus)
      }
    } else {
      consecutiveFailures++
      emit({ connected: false, error: result.error } as VmixStatus)
    }
  }

  // First call immediately
  poll()
  pollingInterval = setInterval(poll, 2000)
}

export function stopVmixPolling(): void {
  if (pollingInterval) {
    clearInterval(pollingInterval)
    pollingInterval = null
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Fast polling: polls every 500ms — used during active playback so the
// renderer can track position/progress and detect end-of-clip accurately
// ─────────────────────────────────────────────────────────────────────────────
let fastPollingInterval: ReturnType<typeof setInterval> | null = null

export function startVmixFastPolling(
  host: string,
  port: number,
  onStatus: (status: VmixStatus) => void
): void {
  stopVmixFastPolling()
  let lastFastHash = ''
  // Hash dedicado: inclui position de inputs (que muda a cada tick durante playback).
  // Em idle (sem clip tocando) os hashes se repetem e pulamos a emissão IPC.
  const fastHash = (s: VmixStatus): string => {
    if (!s.connected) return 'off'
    const inputsPart = (s.inputs ?? [])
      .map(i => `${i.number}:${i.state}:${i.position}:${i.duration}`)
      .join('|')
    return `${s.activeInput}|${inputsPart}`
  }
  const poll = async () => {
    const result = await makeVmixRequest({}, host, port)
    if (result.success && result.data) {
      try {
        const status = parseVmixStatus(result.data)
        const h = fastHash(status)
        if (h === lastFastHash) return
        lastFastHash = h
        onStatus(status)
      } catch { /* ignore parse errors */ }
    }
  }
  poll()
  fastPollingInterval = setInterval(poll, 500)
}

export function stopVmixFastPolling(): void {
  if (fastPollingInterval) {
    clearInterval(fastPollingInterval)
    fastPollingInterval = null
  }
}
