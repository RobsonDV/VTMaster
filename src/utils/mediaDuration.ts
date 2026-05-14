// Leitura de duração de arquivos de mídia local via HTML5 <video>/<audio>.
// Usa o custom protocol `local-media://` registrado em electron/main.ts.
//
// Por que pool? Quando o app gera a programação automática (50-100 músicas),
// criar tantas Promises em paralelo satura o decoder do Chromium e várias
// leituras dão timeout. Um pool de 4 simultâneas é o sweet-spot:
// rápido o suficiente e estável.

const IMAGE_EXTS = new Set([
  'jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'tiff', 'tif', 'ico',
])
const AUDIO_EXTS = new Set([
  'mp3', 'wav', 'aac', 'ogg', 'flac', 'm4a', 'wma', 'opus', 'aiff', 'aif',
])

export function detectMediaType(filePath: string): 'video' | 'audio' | 'image' {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? ''
  if (IMAGE_EXTS.has(ext)) return 'image'
  if (AUDIO_EXTS.has(ext)) return 'audio'
  return 'video'
}

export function mediaDurationCacheKey(filePath: string): string {
  return filePath.replace(/\\/g, '/')
}

export function toLocalMediaUrl(filePath: string): string {
  return 'local-media:///' + mediaDurationCacheKey(filePath)
    .split('/')
    .map(part => encodeURIComponent(part))
    .join('/')
}

async function readNativeMediaDuration(filePath: string): Promise<number | null> {
  try {
    const duration = await window.spotmaster?.readMediaDuration?.(filePath)
    return typeof duration === 'number' && isFinite(duration) && duration > 0
      ? Math.round(duration)
      : null
  } catch {
    return null
  }
}

/** Lê a duração (segundos arredondados) de UM arquivo. Retorna null em falha/timeout. */
export function readMediaDuration(
  filePath: string,
  type: 'video' | 'audio',
  timeoutMs = 10_000,
): Promise<number | null> {
  return new Promise(resolve => {
    const el = document.createElement(
      type === 'audio' ? 'audio' : 'video',
    ) as HTMLVideoElement
    el.preload = 'metadata'
    let settled = false
    const cleanup = () => {
      el.onloadedmetadata = null
      el.onerror = null
      try { el.pause() } catch { /* noop */ }
      el.removeAttribute('src')
      try { el.load() } catch { /* noop */ }
    }
    const finish = async (duration: number | null, tryNativeFallback: boolean) => {
      if (settled) return
      clearTimeout(timer)
      cleanup()

      let finalDuration = duration
      if ((!finalDuration || finalDuration <= 0) && tryNativeFallback) {
        finalDuration = await readNativeMediaDuration(filePath)
      }

      if (settled) return
      settled = true
      resolve(finalDuration && finalDuration > 0 ? Math.round(finalDuration) : null)
    }

    const timer = setTimeout(() => { void finish(null, true) }, timeoutMs)
    el.onloadedmetadata = () => {
      const d = el.duration
      void finish(isFinite(d) && d > 0 ? Math.round(d) : null, true)
    }
    el.onerror = () => { void finish(null, true) }
    el.src = toLocalMediaUrl(filePath)
  })
}

/** Lê durações em LOTE com pool de concorrência limitada (default 4).
 *  Garante que arquivos lentos não bloqueiem o batch inteiro e evita saturação
 *  do decoder do Chromium ao gerar programações automáticas grandes. */
export async function readMediaDurationBatch<T extends { filePath?: string }>(
  items: T[],
  onDuration: (item: T, duration: number) => void,
  options: { concurrency?: number; timeoutMs?: number; onProgress?: (done: number, total: number) => void } = {},
): Promise<void> {
  const { concurrency = 4, timeoutMs = 10_000, onProgress } = options
  // Só vídeo e áudio; imagens não têm duração intrínseca.
  const queue = items.filter(i => {
    if (!i.filePath) return false
    return detectMediaType(i.filePath) !== 'image'
  })
  const total = queue.length
  let done = 0

  let cursor = 0
  const workers: Promise<void>[] = []
  for (let w = 0; w < Math.min(concurrency, queue.length); w++) {
    workers.push((async () => {
      while (true) {
        const idx = cursor++
        if (idx >= queue.length) return
        const item = queue[idx]
        const mt = detectMediaType(item.filePath!)
        if (mt === 'image') continue
        const dur = await readMediaDuration(item.filePath!, mt, timeoutMs)
        if (dur && dur > 0) onDuration(item, dur)
        done++
        onProgress?.(done, total)
      }
    })())
  }
  await Promise.all(workers)
}
