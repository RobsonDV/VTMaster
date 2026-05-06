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
}

let pollingInterval: ReturnType<typeof setInterval> | null = null
let currentHost = 'localhost'
let currentPort = 8088

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
      let data = ''
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => resolve({ success: true, data }))
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
  const getValue = (tag: string): string => {
    const match = xml.match(new RegExp(`<${tag}[^>]*>([^<]*)<\/${tag}>`))
    return match ? match[1].trim() : ''
  }

  const getAttr = (tag: string, attr: string): string => {
    const match = xml.match(new RegExp(`<${tag}[^>]*${attr}="([^"]*)"[^>]*>`))
    return match ? match[1] : ''
  }

  // Parse inputs
  const inputs: VmixInput[] = []
  const inputRegex = /<input\s([^>]*)>([^<]*)<\/input>/gi
  let inputMatch
  while ((inputMatch = inputRegex.exec(xml)) !== null) {
    const attrs = inputMatch[1]
    const getInputAttr = (attr: string): string => {
      const m = attrs.match(new RegExp(`${attr}="([^"]*)"`, 'i'))
      return m ? m[1] : ''
    }
    inputs.push({
      number: getInputAttr('number'),
      type: getInputAttr('type'),
      title: inputMatch[2] || getInputAttr('title'),
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

  const poll = async () => {
    const result = await makeVmixRequest({}, host, port)
    if (result.success && result.data) {
      try {
        const status = parseVmixStatus(result.data)
        onStatus(status)
      } catch {
        onStatus({ connected: false, error: 'Parse error' } as VmixStatus)
      }
    } else {
      onStatus({ connected: false, error: result.error } as VmixStatus)
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
  const poll = async () => {
    const result = await makeVmixRequest({}, host, port)
    if (result.success && result.data) {
      try { onStatus(parseVmixStatus(result.data)) } catch { /* ignore parse errors */ }
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
