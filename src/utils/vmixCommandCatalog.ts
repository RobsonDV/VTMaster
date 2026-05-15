import type { VmixActionItem, VmixCommandCategory, VmixCommandRisk } from '../types'

export interface VmixCommandDefinition {
  functionName: string
  label: string
  category: VmixCommandCategory
  risk: VmixCommandRisk
  requiresInput?: boolean
  requiresValue?: boolean
  valueLabel?: string
  retryable?: boolean
  hidden?: boolean
}

export interface VmixCommandValidationIssue {
  field: 'function' | 'input' | 'value' | 'duration' | 'selectedName' | 'selectedIndex' | 'mix'
  message: string
}

export const VMIX_COMMAND_CATALOG: VmixCommandDefinition[] = [
  { functionName: 'AddInput', label: 'Adicionar input', category: 'input', risk: 'medium', requiresValue: true, valueLabel: 'tipo|arquivo', retryable: false, hidden: true },
  { functionName: 'RemoveInput', label: 'Remover input', category: 'input', risk: 'high', requiresInput: true, retryable: true, hidden: true },
  { functionName: 'PreviewInput', label: 'Mandar para preview', category: 'playback', risk: 'medium', requiresInput: true, retryable: true, hidden: true },
  { functionName: 'PlayInput', label: 'Reproduzir input', category: 'playback', risk: 'medium', requiresInput: true, retryable: true },
  { functionName: 'Pause', label: 'Pausar input', category: 'playback', risk: 'medium', requiresInput: true, retryable: true },
  { functionName: 'SetPosition', label: 'Definir posicao', category: 'playback', risk: 'low', requiresInput: true, requiresValue: true, valueLabel: 'posicao', retryable: true, hidden: true },
  { functionName: 'Cut', label: 'Corte seco', category: 'transition', risk: 'medium', retryable: true },
  { functionName: 'Fade', label: 'Fade', category: 'transition', risk: 'medium', requiresValue: true, valueLabel: 'duracao em ms', retryable: true },
  { functionName: 'Merge', label: 'Merge', category: 'transition', risk: 'medium', retryable: true },
  { functionName: 'AudioOff', label: 'Desligar audio', category: 'audio', risk: 'medium', requiresInput: true, retryable: true },
  { functionName: 'AudioOn', label: 'Ligar audio', category: 'audio', risk: 'medium', requiresInput: true, retryable: true },
  { functionName: 'SetVolume', label: 'Volume', category: 'audio', risk: 'medium', requiresInput: true, requiresValue: true, valueLabel: 'volume 0-100', retryable: true },
  { functionName: 'OverlayInput1', label: 'Overlay 1 on', category: 'overlay', risk: 'medium', requiresInput: true, retryable: true },
  { functionName: 'OverlayInput2', label: 'Overlay 2 on', category: 'overlay', risk: 'medium', requiresInput: true, retryable: true },
  { functionName: 'OverlayInput3', label: 'Overlay 3 on', category: 'overlay', risk: 'medium', requiresInput: true, retryable: true },
  { functionName: 'OverlayInput4', label: 'Overlay 4 on', category: 'overlay', risk: 'medium', requiresInput: true, retryable: true },
  { functionName: 'OverlayInput1Out', label: 'Overlay 1 off', category: 'overlay', risk: 'low', retryable: true },
  { functionName: 'OverlayInput2Out', label: 'Overlay 2 off', category: 'overlay', risk: 'low', retryable: true },
  { functionName: 'OverlayInput3Out', label: 'Overlay 3 off', category: 'overlay', risk: 'low', retryable: true },
  { functionName: 'OverlayInput4Out', label: 'Overlay 4 off', category: 'overlay', risk: 'low', retryable: true },
  { functionName: 'OverlayInputAllOff', label: 'Todos overlays off', category: 'overlay', risk: 'medium', retryable: true },
  { functionName: 'StartRecording', label: 'Iniciar gravacao', category: 'recording', risk: 'high', retryable: true },
  { functionName: 'StopRecording', label: 'Parar gravacao', category: 'recording', risk: 'high', retryable: true },
  { functionName: 'StartStreaming', label: 'Iniciar streaming', category: 'streaming', risk: 'high', retryable: true },
  { functionName: 'StopStreaming', label: 'Parar streaming', category: 'streaming', risk: 'high', retryable: true },
  { functionName: 'External', label: 'Alternar External', category: 'output', risk: 'high', retryable: true },
  { functionName: 'SetOutput2', label: 'Output 2', category: 'output', risk: 'high', requiresValue: true, valueLabel: 'fonte', retryable: true },
  { functionName: 'SetOutput3', label: 'Output 3', category: 'output', risk: 'high', requiresValue: true, valueLabel: 'fonte', retryable: true },
  { functionName: 'SetOutput4', label: 'Output 4', category: 'output', risk: 'high', requiresValue: true, valueLabel: 'fonte', retryable: true },
  { functionName: 'SetText', label: 'Texto de titulo', category: 'title', risk: 'low', requiresInput: true, requiresValue: true, valueLabel: 'texto', retryable: true },
  { functionName: 'SetImage', label: 'Imagem de titulo', category: 'title', risk: 'low', requiresInput: true, requiresValue: true, valueLabel: 'arquivo', retryable: true },
  { functionName: 'SetTextVisibleOn', label: 'Texto visivel on', category: 'title', risk: 'low', requiresInput: true, retryable: true },
  { functionName: 'SetTextVisibleOff', label: 'Texto visivel off', category: 'title', risk: 'low', requiresInput: true, retryable: true },
  { functionName: 'BrowserNavigate', label: 'Navegar browser', category: 'browser', risk: 'medium', requiresInput: true, requiresValue: true, valueLabel: 'URL', retryable: true },
  { functionName: 'ScriptStart', label: 'Iniciar script', category: 'script', risk: 'high', requiresValue: true, valueLabel: 'nome do script', retryable: true },
]

const CATALOG_BY_FUNCTION = new Map(
  VMIX_COMMAND_CATALOG.map(def => [def.functionName.toLowerCase(), def]),
)

export const VMIX_ACTION_COMMANDS = VMIX_COMMAND_CATALOG.filter(def => !def.hidden)

export function getVmixCommandDefinition(functionName: string | undefined): VmixCommandDefinition {
  if (!functionName) {
    return {
      functionName: '',
      label: 'Funcao ausente',
      category: 'unknown',
      risk: 'medium',
    }
  }
  return CATALOG_BY_FUNCTION.get(functionName.toLowerCase()) ?? {
    functionName,
    label: functionName,
    category: 'unknown',
    risk: 'medium',
  }
}

export function buildVmixCommandParams(action: VmixActionItem): Record<string, string> {
  const params: Record<string, string> = { Function: action.function }
  if (action.input) params.Input = action.input
  if (action.value !== undefined && action.value !== '') params.Value = action.value
  if (action.duration !== undefined && action.duration !== '') params.Duration = action.duration
  if (action.selectedName) params.SelectedName = action.selectedName
  if (action.selectedIndex) params.SelectedIndex = action.selectedIndex
  if (action.mix) params.Mix = action.mix
  return params
}

export function validateVmixCommandParams(params: Record<string, string>): VmixCommandValidationIssue[] {
  const fn = params.Function
  if (!fn?.trim()) return [{ field: 'function', message: 'Funcao vMix obrigatoria.' }]

  const definition = getVmixCommandDefinition(fn)
  const issues: VmixCommandValidationIssue[] = []
  if (definition.requiresInput && !params.Input?.trim()) {
    issues.push({ field: 'input', message: `${fn} precisa de Input.` })
  }
  if (definition.requiresValue && !params.Value?.trim()) {
    issues.push({ field: 'value', message: `${fn} precisa de ${definition.valueLabel ?? 'Value'}.` })
  }
  return issues
}

export function validateVmixAction(action: VmixActionItem | undefined): VmixCommandValidationIssue[] {
  if (!action) return [{ field: 'function', message: 'Acao vMix ausente.' }]
  return validateVmixCommandParams(buildVmixCommandParams(action))
}
