import type { SpotType, VmixInput } from '../types'

export const INPUT_TYPE_LABELS: Record<string, string> = {
  Video: 'Vídeo',
  Camera: 'Câmera',
  NDI: 'NDI',
  VirtualSet: 'Cenário Virtual',
  Mix: 'Mix',
  Colour: 'Cor sólida',
  GT: 'Gráfico GT',
  Browser: 'Browser',
  Image: 'Imagem',
  AudioFile: 'Áudio',
  Flash: 'Flash',
  PowerPoint: 'PowerPoint',
  VideoList: 'Lista de Vídeos',
  Xaml: 'XAML',
  DVDInput: 'DVD',
}

export function spotTypeForVmix(type: string): SpotType {
  if (type === 'Camera' || type === 'NDI') return 'programa'
  if (type === 'Video' || type === 'VideoList') return 'spot'
  if (type === 'GT' || type === 'Browser' || type === 'Xaml') return 'vinheta'
  return 'outros'
}

export function parseVmixInputs(xml: string): VmixInput[] {
  const inputs: VmixInput[] = []
  const regex = /<input\b([^>/]*)(?:\/>|>([\s\S]*?)<\/input>)/gi
  let m
  while ((m = regex.exec(xml)) !== null) {
    const attrs = m[1]
    const innerText = (m[2] ?? '').trim()
    const get = (attr: string) => {
      const r = attrs.match(new RegExp(`${attr}="([^"]*)"`, 'i'))
      return r ? r[1] : ''
    }
    const num = get('number')
    if (!num) continue
    inputs.push({
      number: num,
      key: get('key'),
      type: get('type'),
      title: innerText || get('title') || get('shortTitle') || `Input ${num}`,
      shortTitle: get('shortTitle'),
      state: get('state'),
      duration: parseInt(get('duration') || '0'),
      position: parseInt(get('position') || '0'),
    })
  }
  return inputs
}
