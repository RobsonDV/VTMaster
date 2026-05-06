import pt from './pt'
import en from './en'
import type { Translations } from './pt'
import type { Language } from '../types'

export type { Translations }

const translations: Record<Language, Translations> = { pt, en }

export function getTranslations(lang: Language): Translations {
  return translations[lang] ?? translations.pt
}

export { pt, en }
