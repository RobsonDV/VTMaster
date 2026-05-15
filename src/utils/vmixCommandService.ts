import type { VmixActionItem, VmixCommandMeta, VmixRequestResult } from '../types'
import {
  buildVmixCommandParams,
  getVmixCommandDefinition,
  validateVmixCommandParams,
} from './vmixCommandCatalog'

export interface ExecuteVmixCommandOptions {
  input?: string
  value?: string
  duration?: string
  selectedName?: string
  selectedIndex?: string
  mix?: string
  params?: Record<string, string>
  meta?: VmixCommandMeta
  retries?: number
  retryDelayMs?: number
  validate?: boolean
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function buildParams(functionName: string, options: ExecuteVmixCommandOptions): Record<string, string> {
  const params: Record<string, string> = { Function: functionName, ...(options.params ?? {}) }
  if (options.input) params.Input = options.input
  if (options.value !== undefined && options.value !== '') params.Value = options.value
  if (options.duration !== undefined && options.duration !== '') params.Duration = options.duration
  if (options.selectedName) params.SelectedName = options.selectedName
  if (options.selectedIndex) params.SelectedIndex = options.selectedIndex
  if (options.mix) params.Mix = options.mix
  return params
}

function commandMeta(functionName: string, meta: VmixCommandMeta | undefined, attempt: number): VmixCommandMeta {
  const definition = getVmixCommandDefinition(functionName)
  return {
    source: meta?.source ?? 'vmix-command-service',
    category: meta?.category ?? definition.category,
    risk: meta?.risk ?? definition.risk,
    itemId: meta?.itemId,
    itemTitle: meta?.itemTitle,
    scheduleDate: meta?.scheduleDate,
    scheduledTime: meta?.scheduledTime,
    queue: meta?.queue,
    attempt,
  }
}

export async function requestVmixXml(): Promise<VmixRequestResult> {
  if (!window.spotmaster) return { success: false, error: 'Electron bridge indisponivel.' }
  return window.spotmaster.vmixRequest({})
}

export async function executeVmixCommand(functionName: string, options: ExecuteVmixCommandOptions = {}): Promise<VmixRequestResult> {
  if (!window.spotmaster) return { success: false, error: 'Electron bridge indisponivel.' }

  const params = buildParams(functionName, options)
  if (options.validate !== false) {
    const issues = validateVmixCommandParams(params)
    if (issues.length > 0) {
      return { success: false, error: issues.map(issue => issue.message).join(' ') }
    }
  }

  const definition = getVmixCommandDefinition(functionName)
  const maxRetries = options.retries ?? (definition.retryable ? 1 : 0)
  let lastResult: VmixRequestResult = { success: false, error: 'Comando nao executado.' }

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    lastResult = await window.spotmaster.vmixRequest(params, commandMeta(functionName, options.meta, attempt))
    if (lastResult.success) return lastResult
    if (attempt <= maxRetries) await sleep(options.retryDelayMs ?? 180)
  }

  return lastResult
}

export async function executeVmixAction(action: VmixActionItem, meta?: VmixCommandMeta, options: Omit<ExecuteVmixCommandOptions, 'params' | 'meta'> = {}): Promise<VmixRequestResult> {
  const params = buildVmixCommandParams(action)
  return executeVmixCommand(action.function, {
    ...options,
    params,
    meta,
  })
}
