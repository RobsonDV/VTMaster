import type { AudioStyle, MusicStyle, VideoStyle } from '../types'
import type { AutoProgStyleSource } from './autoprog'

export function buildAutoProgStyleSources(args: {
  audioStyles: AudioStyle[]
  videoStyles: VideoStyle[]
  legacyMusicStyles?: MusicStyle[]
}): AutoProgStyleSource[] {
  const legacy = args.legacyMusicStyles ?? []
  return [
    ...args.audioStyles.map(style => ({
      id: style.id,
      name: style.name,
      folderPath: style.folderPath,
      includeSubfolders: style.includeSubfolders,
      color: style.color,
      mediaType: 'audio' as const,
      artistParseRule: 'filename_dash' as const,
      cooldownDays: 0,
      isVinheta: style.isVinheta ?? false,
    })),
    ...args.videoStyles.map(style => ({
      id: style.id,
      name: style.name,
      folderPath: style.folderPath,
      includeSubfolders: style.includeSubfolders,
      color: style.color,
      mediaType: 'video' as const,
      cooldownDays: 0,
    })),
    ...legacy.map(style => ({
      id: style.id,
      name: `${style.name} (legado)`,
      folderPath: style.folderPath,
      includeSubfolders: style.includeSubfolders,
      color: style.color,
      mediaType: 'video' as const,
      cooldownDays: style.cooldownDays,
    })),
  ].filter(style => !!style.folderPath)
}

export function styleSourceKey(mediaType: 'audio' | 'video', styleId: string): string {
  return `${mediaType}:${styleId}`
}

export function parseStyleSourceKey(value: string): { mediaType: 'audio' | 'video'; styleId: string } {
  const [kind, ...rest] = value.split(':')
  return {
    mediaType: kind === 'video' ? 'video' : 'audio',
    styleId: rest.join(':') || value,
  }
}
