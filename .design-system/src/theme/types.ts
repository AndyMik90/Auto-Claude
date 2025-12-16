export type ColorTheme = 'default' | 'dusk' | 'lime' | 'ocean' | 'retro' | 'neo' | 'forest'
export type Mode = 'light' | 'dark'

export interface ThemeConfig {
  colorTheme: ColorTheme
  mode: Mode
}

export interface ThemePreviewColors {
  bg: string
  accent: string
  darkBg: string
  darkAccent?: string
}

export interface ColorThemeDefinition {
  id: ColorTheme
  name: string
  description: string
  previewColors: ThemePreviewColors
}
