export const THEMES = {
  LIGHT: 'cupcake',
  DARK: 'dracula',
} as const

export type Theme = typeof THEMES[keyof typeof THEMES]

export const DEFAULT_THEME = THEMES.LIGHT

export const THEME_STORAGE_KEY = 'theme'

export const THEME_OPTIONS = [
  { value: 'default', label: 'System Default' },
  { value: THEMES.LIGHT, label: 'Light' },
  { value: THEMES.DARK, label: 'Dark' },
] as const