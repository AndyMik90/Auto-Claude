import { useState, useEffect } from 'react'
import { ThemeConfig, ColorTheme, Mode } from './types'
import { COLOR_THEMES } from './constants'

export function useTheme() {
  const [config, setConfig] = useState<ThemeConfig>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('design-system-theme-config')
      if (stored) {
        try {
          const parsed = JSON.parse(stored)
          // Validate that the stored theme still exists
          const themeExists = COLOR_THEMES.some(t => t.id === parsed.colorTheme)
          if (themeExists) {
            return parsed
          }
          // Fall back to default if theme was removed
          return {
            colorTheme: 'default' as ColorTheme,
            mode: parsed.mode || 'light'
          }
        } catch {}
      }
      return {
        colorTheme: 'default' as ColorTheme,
        mode: window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
      }
    }
    return { colorTheme: 'default', mode: 'light' }
  })

  useEffect(() => {
    const root = document.documentElement

    // Set color theme
    if (config.colorTheme === 'default') {
      root.removeAttribute('data-theme')
    } else {
      root.setAttribute('data-theme', config.colorTheme)
    }

    // Set mode
    if (config.mode === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }

    localStorage.setItem('design-system-theme-config', JSON.stringify(config))
  }, [config])

  const setColorTheme = (colorTheme: ColorTheme) => setConfig(c => ({ ...c, colorTheme }))
  const setMode = (mode: Mode) => setConfig(c => ({ ...c, mode }))
  const toggleMode = () => setConfig(c => ({ ...c, mode: c.mode === 'light' ? 'dark' : 'light' }))

  return {
    colorTheme: config.colorTheme,
    mode: config.mode,
    setColorTheme,
    setMode,
    toggleMode,
    themes: COLOR_THEMES
  }
}
