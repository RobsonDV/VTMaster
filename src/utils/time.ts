// ─────────────────────────────────────────────────────────────────────────────
// Time utilities for SpotMaster
// ─────────────────────────────────────────────────────────────────────────────

/** Returns current time as HH:MM:SS (always zero-padded) */
export function now(): string {
  const d = new Date()
  const h = String(d.getHours()).padStart(2, '0')
  const m = String(d.getMinutes()).padStart(2, '0')
  const s = String(d.getSeconds()).padStart(2, '0')
  return `${h}:${m}:${s}`
}

/** Formats seconds as MM:SS or HH:MM:SS */
export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) {
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

/** Same as formatDuration — alias for readability */
export function formatTime(seconds: number): string {
  return formatDuration(seconds)
}

/** Parses HH:MM:SS or MM:SS string to seconds */
export function parseDuration(str: string): number {
  const parts = str.split(':').map(Number)
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  return parseInt(str) || 0
}

/** Formats a date string YYYY-MM-DD to local format */
export function formatDate(dateStr: string, lang: 'pt' | 'en' = 'pt'): string {
  const [y, m, d] = dateStr.split('-')
  if (lang === 'pt') return `${d}/${m}/${y}`
  return `${m}/${d}/${y}`
}

/** Formats a Date as YYYY-MM-DD using the local timezone, never UTC. */
export function dateToLocalYmd(date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Returns today's date as YYYY-MM-DD (local timezone, not UTC) */
export function today(): string {
  return dateToLocalYmd()
}
