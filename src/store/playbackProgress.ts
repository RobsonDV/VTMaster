// Store externo (fora do AppContext) para o progresso de playback.
// Atualizado pelo fast-polling do vMix (~500 ms) — isolado para não disparar
// re-render global do AppContext a cada tick. Componentes que precisam só do
// progresso usam `usePlaybackProgress()`; outros componentes não re-renderizam.

import { useSyncExternalStore } from 'react'

export type PlaybackProgress = {
  inputNum: string
  position: number
  duration: number
} | null

let current: PlaybackProgress = null
const listeners = new Set<() => void>()

export function setPlaybackProgress(next: PlaybackProgress): void {
  // Evita notificar quando nada mudou
  if (current === next) return
  if (
    current && next &&
    current.inputNum === next.inputNum &&
    current.position === next.position &&
    current.duration === next.duration
  ) return
  current = next
  for (const l of listeners) l()
}

export function getPlaybackProgress(): PlaybackProgress {
  return current
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export function usePlaybackProgress(): PlaybackProgress {
  return useSyncExternalStore(subscribe, getPlaybackProgress, getPlaybackProgress)
}
