import type {
  AppSettings,
  ClientSpot,
  CommercialBlock,
  PlaylistItem,
  ProgramSlot,
  VmixActionItem,
  VmixInput,
  VmixStatus,
} from '../types'
import { formatDuration, today } from './time'
import {
  getVmixCommandDefinition,
  validateVmixAction as validateCatalogVmixAction,
} from './vmixCommandCatalog'

export type PreflightSeverity = 'error' | 'warning' | 'info'

export interface PreflightIssue {
  id: string
  severity: PreflightSeverity
  title: string
  detail: string
  time?: string
  itemId?: string
  action?: string
}

export interface PreflightSummary {
  checkedAt: string
  issues: PreflightIssue[]
  errorCount: number
  warningCount: number
  infoCount: number
}

export interface SchedulePreflightInput {
  date: string
  schedule: PlaylistItem[]
  weekSlots: ProgramSlot[]
  commercialBlocks: CommercialBlock[]
  clientSpots: ClientSpot[]
  vmixStatus: VmixStatus
  settings: AppSettings
  fileExists?: (filePaths: string[]) => Promise<Record<string, boolean>>
}

function norm(value: string | number | undefined | null): string {
  return String(value ?? '').trim().toLowerCase()
}

function timeToSeconds(time: string | undefined): number | null {
  if (!time) return null
  const parts = time.split(':').map(Number)
  if (parts.length < 2 || parts.some(n => !Number.isFinite(n))) return null
  return (parts[0] * 3600) + (parts[1] * 60) + (parts[2] ?? 0)
}

function inputMatches(value: string | undefined, inputs: VmixInput[] | undefined): boolean {
  const wanted = norm(value)
  if (!wanted || !inputs?.length) return false
  return inputs.some(input => {
    return [
      input.number,
      input.key,
      input.title,
      input.shortTitle,
    ].some(candidate => norm(candidate) === wanted)
  })
}

function validateVmixAction(
  action: VmixActionItem | undefined,
  sourceId: string,
  label: string,
  add: (issue: Omit<PreflightIssue, 'id'> & { id?: string }) => void,
  vmixStatus: VmixStatus,
): void {
  if (!action?.function) {
    add({
      id: `${sourceId}:vmix-action-missing`,
      severity: 'error',
      title: 'Acao vMix sem funcao',
      detail: `${label} precisa ter uma funcao vMix definida.`,
    })
    return
  }

  const definition = getVmixCommandDefinition(action.function)
  if (definition.category === 'unknown') {
    add({
      id: `${sourceId}:vmix-action-unknown`,
      severity: 'warning',
      title: `Funcao vMix nao catalogada: ${action.function}`,
      detail: 'O comando sera enviado ao vMix, mas ainda nao existe regra de validacao para ele.',
    })
  }

  for (const issue of validateCatalogVmixAction(action)) {
    add({
      id: `${sourceId}:vmix-action-${issue.field}`,
      severity: 'error',
      title: issue.message,
      detail: `${label} precisa ser corrigido antes de ir ao ar.`,
    })
  }

  if (vmixStatus.connected && action.input && vmixStatus.inputs?.length && !inputMatches(action.input, vmixStatus.inputs)) {
    add({
      id: `${sourceId}:vmix-action-input-not-found`,
      severity: 'warning',
      title: `Input vMix nao encontrado: ${action.input}`,
      detail: `${label} usa um input que nao apareceu no XML atual do vMix.`,
    })
  }
}

function validateScheduleItems(input: SchedulePreflightInput, add: (issue: Omit<PreflightIssue, 'id'> & { id?: string }) => void): void {
  const usesVmix = input.schedule.some(item => !!item.filePath || !!item.inputName || item.type === 'vmix_action')
  if (usesVmix && !input.vmixStatus.connected) {
    add({
      id: 'vmix:offline',
      severity: 'error',
      title: 'vMix desconectado',
      detail: `Conecte o vMix em ${input.settings.vmixHost}:${input.settings.vmixPort} antes de iniciar itens com midia, inputs ou comandos.`,
    })
  }

  if (usesVmix && input.vmixStatus.connected && !input.vmixStatus.inputs?.length) {
    add({
      id: 'vmix:no-input-list',
      severity: 'warning',
      title: 'vMix conectado sem lista de inputs',
      detail: 'A conexao respondeu, mas a lista de inputs nao esta disponivel para validar nomes e numeros.',
    })
  }

  input.schedule.forEach((item, index) => {
    const label = `"${item.title}"${item.scheduledTime ? ` em ${item.scheduledTime.slice(0, 5)}` : ''}`
    const hasPlayableContent = !!item.filePath || !!item.inputName || item.type === 'vmix_action' || item.type === 'pause'

    if (!hasPlayableContent) {
      add({
        id: `${item.id}:empty-content`,
        severity: 'warning',
        title: 'Item sem conteudo',
        detail: `${label} nao tem arquivo, input vMix nem comando. Ele sera pulado na execucao.`,
        itemId: item.id,
        time: item.scheduledTime?.slice(0, 5),
        action: 'Adicionar arquivo ou input',
      })
    }

    if ((item.filePath || item.inputName) && (!Number.isFinite(item.duration) || item.duration <= 0)) {
      add({
        id: `${item.id}:zero-duration`,
        severity: item.mediaType === 'image' ? 'info' : 'warning',
        title: 'Duracao nao lida',
        detail: `${label} esta com duracao zerada. Use "Ler Tempos" para evitar estimativa ruim do bloco.`,
        itemId: item.id,
        time: item.scheduledTime?.slice(0, 5),
        action: 'Ler tempos',
      })
    }

    if (item.inputName && input.vmixStatus.connected && input.vmixStatus.inputs?.length && !inputMatches(item.inputName, input.vmixStatus.inputs)) {
      add({
        id: `${item.id}:input-not-found`,
        severity: 'error',
        title: `Input vMix nao encontrado: ${item.inputName}`,
        detail: `${label} aponta para um input que nao existe no projeto vMix aberto agora.`,
        itemId: item.id,
        time: item.scheduledTime?.slice(0, 5),
        action: 'Corrigir input',
      })
    }

    if (item.type === 'vmix_action') {
      validateVmixAction(item.vmixAction, item.id || `item-${index}`, label, add, input.vmixStatus)
    }
  })
}

async function validateFiles(input: SchedulePreflightInput, add: (issue: Omit<PreflightIssue, 'id'> & { id?: string }) => void): Promise<void> {
  const filePaths = [...new Set(input.schedule.map(item => item.filePath).filter((path): path is string => !!path))]
  if (filePaths.length === 0) return

  if (!input.fileExists) {
    add({
      id: 'files:not-checked',
      severity: 'info',
      title: 'Arquivos nao verificados',
      detail: 'A ponte Electron de verificacao de arquivos nao esta disponivel nesta sessao.',
    })
    return
  }

  let existsMap: Record<string, boolean>
  try {
    existsMap = await input.fileExists(filePaths)
  } catch {
    add({
      id: 'files:check-failed',
      severity: 'warning',
      title: 'Falha ao verificar arquivos',
      detail: 'Nao foi possivel consultar o disco antes da execucao.',
    })
    return
  }

  for (const item of input.schedule) {
    if (!item.filePath || existsMap[item.filePath]) continue
    add({
      id: `${item.id}:file-missing`,
      severity: 'error',
      title: 'Arquivo nao encontrado',
      detail: `"${item.title}" aponta para ${item.filePath}.`,
      itemId: item.id,
      time: item.scheduledTime?.slice(0, 5),
      action: 'Localizar arquivo',
    })
  }
}

function validateCommercialBlocks(input: SchedulePreflightInput, add: (issue: Omit<PreflightIssue, 'id'> & { id?: string }) => void): void {
  const blockById = new Map(input.commercialBlocks.map(block => [block.id, block]))
  const spotsByClient = new Map<string, ClientSpot[]>()
  for (const spot of input.clientSpots) {
    const list = spotsByClient.get(spot.clientId) ?? []
    list.push(spot)
    spotsByClient.set(spot.clientId, list)
  }

  for (const slot of input.weekSlots) {
    if (slot.type !== 'bloco_comercial') continue

    if (!slot.commercialBlockId) {
      add({
        id: `${slot.id}:commercial-block-missing-link`,
        severity: 'warning',
        title: 'Horario comercial sem bloco vinculado',
        detail: `"${slot.title}" em ${slot.scheduledTime.slice(0, 5)} nao possui bloco comercial associado.`,
        time: slot.scheduledTime.slice(0, 5),
      })
      continue
    }

    const block = blockById.get(slot.commercialBlockId)
    if (!block) {
      add({
        id: `${slot.id}:commercial-block-not-found`,
        severity: 'error',
        title: 'Bloco comercial inexistente',
        detail: `"${slot.title}" referencia um bloco que nao existe mais.`,
        time: slot.scheduledTime.slice(0, 5),
      })
      continue
    }

    if (!block.enabled) {
      add({
        id: `${slot.id}:commercial-block-disabled`,
        severity: 'warning',
        title: 'Bloco comercial desativado',
        detail: `"${block.name}" esta vinculado a grade, mas esta desativado.`,
        time: slot.scheduledTime.slice(0, 5),
      })
    }

    if (block.items.length === 0) {
      add({
        id: `${slot.id}:commercial-block-empty`,
        severity: 'warning',
        title: 'Bloco comercial vazio',
        detail: `"${block.name}" nao tem itens configurados.`,
        time: slot.scheduledTime.slice(0, 5),
      })
    }

    for (const blockItem of block.items) {
      const label = `Item ${blockItem.order} do bloco "${block.name}"`
      if (blockItem.type === 'spot_client') {
        if (!blockItem.clientId) {
          add({
            id: `${block.id}:${blockItem.id}:client-missing`,
            severity: 'error',
            title: 'Item comercial sem cliente',
            detail: `${label} precisa de um cliente.`,
            time: slot.scheduledTime.slice(0, 5),
          })
          continue
        }

        const clientSpots = spotsByClient.get(blockItem.clientId) ?? []
        if (clientSpots.length === 0) {
          add({
            id: `${block.id}:${blockItem.id}:client-without-spots`,
            severity: 'error',
            title: 'Cliente sem spots cadastrados',
            detail: `${label} aponta para um cliente sem midias disponiveis.`,
            time: slot.scheduledTime.slice(0, 5),
          })
        } else if ((blockItem.spotsCount ?? 1) > clientSpots.length) {
          add({
            id: `${block.id}:${blockItem.id}:client-spots-low`,
            severity: 'info',
            title: 'Rodizio com poucas midias',
            detail: `${label} pede ${blockItem.spotsCount ?? 1} insercoes, mas o cliente tem ${clientSpots.length} midia(s).`,
            time: slot.scheduledTime.slice(0, 5),
          })
        }
      }

      if (blockItem.type === 'vmix_input' && !blockItem.inputName?.trim()) {
        add({
          id: `${block.id}:${blockItem.id}:vmix-input-empty`,
          severity: 'error',
          title: 'Input vMix vazio no bloco',
          detail: `${label} precisa do nome ou numero do input.`,
          time: slot.scheduledTime.slice(0, 5),
        })
      }

      if (blockItem.type === 'vmix_action') {
        validateVmixAction(blockItem.vmixAction, `${block.id}:${blockItem.id}`, label, add, input.vmixStatus)
      }
    }
  }

  const linkedBlockIds = new Set(
    input.weekSlots
      .filter(slot => slot.type === 'bloco_comercial' && !!slot.commercialBlockId)
      .map(slot => slot.commercialBlockId as string),
  )

  for (const block of input.commercialBlocks) {
    if (!block.enabled || linkedBlockIds.has(block.id)) continue
    const blockTime = block.scheduledTime?.slice(0, 5) ?? ''
    if (block.items.length === 0) {
      add({
        id: `${block.id}:standalone-commercial-block-empty`,
        severity: 'warning',
        title: 'Bloco comercial autonomo vazio',
        detail: `"${block.name}" nao esta vinculado a grade, mas pode ser pre-carregado pelo autoplay comercial e nao tem itens.`,
        time: blockTime,
      })
    }

    for (const blockItem of block.items) {
      const label = `Item ${blockItem.order} do bloco autonomo "${block.name}"`
      if (blockItem.type === 'spot_client') {
        if (!blockItem.clientId) {
          add({
            id: `${block.id}:${blockItem.id}:standalone-client-missing`,
            severity: 'error',
            title: 'Item comercial autonomo sem cliente',
            detail: `${label} precisa de um cliente.`,
            time: blockTime,
          })
          continue
        }
        const clientSpots = spotsByClient.get(blockItem.clientId) ?? []
        if (clientSpots.length === 0) {
          add({
            id: `${block.id}:${blockItem.id}:standalone-client-without-spots`,
            severity: 'error',
            title: 'Cliente sem spots em bloco autonomo',
            detail: `${label} aponta para um cliente sem midias disponiveis.`,
            time: blockTime,
          })
        }
      }

      if (blockItem.type === 'vmix_input' && !blockItem.inputName?.trim()) {
        add({
          id: `${block.id}:${blockItem.id}:standalone-vmix-input-empty`,
          severity: 'error',
          title: 'Input vMix vazio em bloco autonomo',
          detail: `${label} precisa do nome ou numero do input.`,
          time: blockTime,
        })
      }

      if (blockItem.type === 'vmix_action') {
        validateVmixAction(blockItem.vmixAction, `${block.id}:${blockItem.id}:standalone`, label, add, input.vmixStatus)
      }
    }
  }
}

function validateTimePlan(input: SchedulePreflightInput, add: (issue: Omit<PreflightIssue, 'id'> & { id?: string }) => void): void {
  const timeCounts = new Map<string, number>()
  for (const slot of input.weekSlots) {
    const time = slot.scheduledTime.slice(0, 5)
    timeCounts.set(time, (timeCounts.get(time) ?? 0) + 1)
  }
  for (const [time, count] of timeCounts) {
    if (count > 1) {
      add({
        id: `week-slots:${time}:duplicate`,
        severity: 'warning',
        title: 'Horarios duplicados na grade',
        detail: `${count} slots da estrutura semanal usam ${time}.`,
        time,
      })
    }
  }

  const groupDurations = new Map<string, number>()
  for (const item of input.schedule) {
    const time = item.scheduledTime?.slice(0, 5)
    if (!time) continue
    groupDurations.set(time, (groupDurations.get(time) ?? 0) + Math.max(0, item.duration ?? 0))
  }

  const times = [...groupDurations.keys()].sort()
  for (let i = 0; i < times.length - 1; i++) {
    const current = times[i]
    const next = times[i + 1]
    const currentSec = timeToSeconds(current)
    const nextSec = timeToSeconds(next)
    if (currentSec == null || nextSec == null || nextSec <= currentSec) continue

    const available = nextSec - currentSec
    const duration = groupDurations.get(current) ?? 0
    if (duration > available + 30) {
      add({
        id: `time-plan:${current}:overrun`,
        severity: 'warning',
        title: 'Bloco pode invadir o proximo horario',
        detail: `O bloco ${current} soma ${formatDuration(duration)}, mas ha ${formatDuration(available)} ate ${next}.`,
        time: current,
      })
    }
  }

  if (input.date === today()) {
    const now = new Date()
    const nowSec = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds()
    const stalePending = input.schedule.filter(item => {
      if (item.status !== 'pending') return false
      const itemSec = timeToSeconds(item.scheduledTime)
      return itemSec != null && itemSec < nowSec - 3600
    })
    if (stalePending.length > 0) {
      add({
        id: 'time-plan:old-pending',
        severity: 'info',
        title: 'Itens pendentes antigos',
        detail: `${stalePending.length} item(ns) pendente(s) ficaram mais de 1 hora para tras. Ao iniciar pelo bloco atual, eles serao pulados.`,
      })
    }
  }
}

export async function runSchedulePreflight(input: SchedulePreflightInput): Promise<PreflightSummary> {
  const issues: PreflightIssue[] = []
  const add = (issue: Omit<PreflightIssue, 'id'> & { id?: string }) => {
    issues.push({
      ...issue,
      id: issue.id ?? `issue-${issues.length + 1}`,
    })
  }

  if (input.schedule.length === 0) {
    add({
      id: 'schedule:empty',
      severity: 'error',
      title: 'Programacao vazia',
      detail: 'Gere a programacao do dia antes de iniciar o playout.',
      action: 'Gerar da Estrutura',
    })
  }

  validateScheduleItems(input, add)
  await validateFiles(input, add)
  validateCommercialBlocks(input, add)
  validateTimePlan(input, add)

  return {
    checkedAt: new Date().toISOString(),
    issues,
    errorCount: issues.filter(issue => issue.severity === 'error').length,
    warningCount: issues.filter(issue => issue.severity === 'warning').length,
    infoCount: issues.filter(issue => issue.severity === 'info').length,
  }
}
