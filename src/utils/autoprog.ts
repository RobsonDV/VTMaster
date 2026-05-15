// ─────────────────────────────────────────────────────────────────────────────
// AutoProg — Motor de Geração de Blocos Musicais
// ─────────────────────────────────────────────────────────────────────────────
import type { MusicStyle, MusicSequence, PlayLog } from '../types'

export interface ScannedFile {
  filePath: string
  filename: string
  subfolder: string
}

export interface GeneratedMusicItem {
  filePath: string
  title: string       // nome do arquivo sem extensão
  artist: string      // extraído pela regra artistParseRule
  styleId: string
  duration?: number   // duração real em segundos, quando conhecida
}

/** Extrai o nome do artista de um arquivo com base na regra configurada */
export function extractArtist(
  filename: string,
  rule: MusicStyle['artistParseRule'],
  subfolder: string,
): string {
  const noExt = filename.replace(/\.[^.]+$/, '')
  switch (rule) {
    case 'filename_dash': {
      const idx = noExt.indexOf(' - ')
      return idx > 0 ? noExt.slice(0, idx).trim() : ''
    }
    case 'filename_underscore': {
      const idx = noExt.indexOf('_')
      return idx > 0 ? noExt.slice(0, idx).trim() : ''
    }
    case 'subfolder':
      return subfolder.split('/').pop()?.trim() || subfolder.trim() || ''
    default:
      return ''
  }
}

interface CandidateFile {
  file: ScannedFile
  noExt: string
  artist: string
  lastPlayedDate: string | null
  onCooldown: boolean
}

interface GenerateArgs {
  sequence: MusicSequence
  styles: MusicStyle[]
  playLog: PlayLog[]
  date: string  // YYYY-MM-DD — data alvo para verificação de cooldown
  scanFolder: (path: string, includeSubfolders: boolean) => Promise<ScannedFile[]>
  getDuration?: (filePath: string) => Promise<number | null | undefined> | number | null | undefined
}

/**
 * Gera uma lista de músicas para um bloco musical automático.
 *
 * Aplica:
 * - Cooldown por arquivo (não repetir dentro de N dias)
 * - Janela de artista (não repetir artista nas últimas N músicas)
 * - Seleção ponderada (arquivos não tocados recentemente têm mais chance)
 * - Fallback configurável quando todos os arquivos estão em cooldown
 */
export async function generateMusicBlock(args: GenerateArgs): Promise<GeneratedMusicItem[]> {
  const { sequence, styles, playLog, date, scanFolder, getDuration } = args
  const styleMap = new Map(styles.map(s => [s.id, s]))

  // Mapa: título → data mais recente em que foi tocado
  const lastPlayedByTitle = new Map<string, string>()
  for (const log of playLog) {
    if (log.status !== 'aired') continue
    const prev = lastPlayedByTitle.get(log.title)
    if (!prev || log.date > prev) lastPlayedByTitle.set(log.title, log.date)
  }

  // Escaneia e cacheia as pastas de cada estilo
  const styleCandidates = new Map<string, CandidateFile[]>()
  for (const seqItem of sequence.items) {
    if (styleCandidates.has(seqItem.styleId)) continue
    const style = styleMap.get(seqItem.styleId)
    if (!style) continue

    let files: ScannedFile[]
    try {
      files = await scanFolder(style.folderPath, style.includeSubfolders)
    } catch {
      files = []
    }

    const cooldownCutoff = new Date(date)
    cooldownCutoff.setDate(cooldownCutoff.getDate() - style.cooldownDays)
    const cutoffStr = cooldownCutoff.toISOString().slice(0, 10)

    const candidates: CandidateFile[] = files.map(f => {
      const noExt = f.filename.replace(/\.[^.]+$/, '')
      const artist = extractArtist(f.filename, style.artistParseRule, f.subfolder)
      const lp = lastPlayedByTitle.get(noExt) ?? lastPlayedByTitle.get(f.filename) ?? null
      const onCooldown = style.cooldownDays > 0 && !!lp && lp >= cutoffStr
      return { file: f, noExt, artist, lastPlayedDate: lp, onCooldown }
    })
    styleCandidates.set(seqItem.styleId, candidates)
  }

  // Expande o ciclo de estilos em lista plana: [Dance, Dance, Flashback, Dance, Dance, Flashback, ...]
  const expandedSeq: string[] = []
  for (const si of sequence.items) {
    for (let i = 0; i < si.count; i++) expandedSeq.push(si.styleId)
  }
  if (expandedSeq.length === 0) return []

  // ── Mapa título → artista (para cruzar com o playLog) ─────────────────────
  const titleToArtist = new Map<string, string>()
  for (const pool of styleCandidates.values()) {
    for (const c of pool) {
      if (c.artist) {
        titleToArtist.set(c.noExt, c.artist)
        titleToArtist.set(c.file.filename, c.artist)
      }
    }
  }

  // ── Veiculações de hoje (para janela cross-bloco e limite diário) ──────────
  const todayPlayed = playLog
    .filter(l => l.date === date && l.status === 'aired')
    .sort((a, b) => a.actualTime.localeCompare(b.actualTime))

  // Contagem de veiculações por artista HOJE (histórico + o que ainda vai ser gerado)
  const artistCountToday = new Map<string, number>()
  const dailyLimit = sequence.maxSameDayArtistPlays ?? 0
  for (const log of todayPlayed) {
    const artist = titleToArtist.get(log.title)
    if (artist) artistCountToday.set(artist, (artistCountToday.get(artist) ?? 0) + 1)
  }

  const result: GeneratedMusicItem[] = []
  const usedPaths = new Set<string>()

  // Janela de artista pré-populada com o histórico de hoje (memória cross-bloco)
  // Isso impede que um artista que já tocou em um bloco anterior no dia
  // toque novamente no início do próximo bloco.
  const usedArtistsWindow: string[] = []
  if (sequence.noSameArtistWindow > 0) {
    for (const log of todayPlayed) {
      const artist = titleToArtist.get(log.title)
      if (artist) usedArtistsWindow.push(artist)
    }
  }

  const countMode = sequence.targetMode === 'count'
  const targetCount = countMode ? Math.max(1, sequence.targetValue) : Number.POSITIVE_INFINITY
  const targetDurationSeconds = countMode ? 0 : Math.max(1, sequence.targetValue) * 60
  const totalCandidates = [...styleCandidates.values()].reduce((acc, pool) => acc + pool.length, 0)
  // Usado apenas para impedir loop infinito quando filtros/cooldown deixam pouca opção.
  const maxAttempts = (countMode ? targetCount : Math.max(totalCandidates, expandedSeq.length)) * 5 + 20
  const fallbackUnknownDuration = 180
  let totalDuration = 0
  let seqIdx = 0
  let totalAttempts = 0

  while (
    result.length < targetCount &&
    (countMode || totalDuration < targetDurationSeconds) &&
    usedPaths.size < totalCandidates &&
    totalAttempts < maxAttempts
  ) {
    totalAttempts++
    const styleId = expandedSeq[seqIdx % expandedSeq.length]
    seqIdx++

    const style = styleMap.get(styleId)
    if (!style) continue

    const pool = styleCandidates.get(styleId) ?? []
    if (pool.length === 0) continue

    // 1. Não usar arquivos já escolhidos nesta geração
    let eligible = pool.filter(c => !usedPaths.has(c.file.filePath))

    // 2. Filtro de cooldown
    const notOnCooldown = eligible.filter(c => !c.onCooldown)
    if (notOnCooldown.length > 0) {
      eligible = notOnCooldown
    } else {
      // Fallback: ignore_cooldown → usa tudo; skip → pula este slot; alert → usa tudo
      if (sequence.fallback === 'skip') continue
      // ignore_cooldown ou alert: usa eligible completo (pode incluir arquivos em cooldown)
    }

    // 3. Filtro de janela de artista (sem o bug do eligible.length > 1)
    // Aplica mesmo com 1 candidato: se não houver alternativa, o guard
    // "if (withoutSame.length > 0)" mantém eligible inalterado (aceita o artista).
    if (sequence.noSameArtistWindow > 0) {
      const recent = new Set(
        usedArtistsWindow.slice(-sequence.noSameArtistWindow).filter(Boolean)
      )
      const withoutSame = eligible.filter(c => !c.artist || !recent.has(c.artist))
      if (withoutSame.length > 0) eligible = withoutSame
    }

    // 4. Limite diário por artista — exclui artistas que já atingiram o teto do dia
    // Isso atua como um filtro DURO: artista que já tocou N vezes hoje não entra mais,
    // independente da janela de N músicas. Protege contra repetição cross-bloco.
    if (dailyLimit > 0) {
      const withoutOverLimit = eligible.filter(c => {
        if (!c.artist) return true
        return (artistCountToday.get(c.artist) ?? 0) < dailyLimit
      })
      if (withoutOverLimit.length > 0) eligible = withoutOverLimit
    }

    if (eligible.length === 0) continue

    // 4. Seleção ponderada: arquivos não tocados recentemente têm peso maior
    const todayMs = new Date(date).getTime()
    const weights = eligible.map(c => {
      if (!c.lastPlayedDate) return 30
      const days = Math.max(0, (todayMs - new Date(c.lastPlayedDate).getTime()) / 86_400_000)
      return Math.max(1, Math.min(30, Math.ceil(days)))
    })
    const totalW = weights.reduce((a, b) => a + b, 0)
    let rand = Math.random() * totalW
    let chosen = eligible[0]
    for (let i = 0; i < eligible.length; i++) {
      rand -= weights[i]
      if (rand <= 0) { chosen = eligible[i]; break }
    }

    usedPaths.add(chosen.file.filePath)
    if (chosen.artist) {
      usedArtistsWindow.push(chosen.artist)
      // Atualiza o contador diário para bloquear artistas que atingem o teto
      if (dailyLimit > 0) {
        artistCountToday.set(chosen.artist, (artistCountToday.get(chosen.artist) ?? 0) + 1)
      }
      // Mantém a janela em tamanho razoável para não crescer indefinidamente
      if (usedArtistsWindow.length > sequence.noSameArtistWindow * 3 + 30) {
        usedArtistsWindow.shift()
      }
    }

    let realDuration: number | undefined
    if (!countMode && getDuration) {
      try {
        const dur = await getDuration(chosen.file.filePath)
        if (typeof dur === 'number' && isFinite(dur) && dur > 0) {
          realDuration = Math.round(dur)
        }
      } catch {
        realDuration = undefined
      }
    }
    if (!countMode) totalDuration += realDuration ?? fallbackUnknownDuration

    result.push({
      filePath: chosen.file.filePath,
      title: chosen.noExt,
      artist: chosen.artist,
      styleId,
      ...(realDuration ? { duration: realDuration } : {}),
    })
  }

  return result
}
