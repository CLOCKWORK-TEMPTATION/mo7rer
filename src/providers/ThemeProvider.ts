export type Theme = 'light' | 'dark'

export interface ThemeProviderOptions {
  attribute?: 'class' | 'data-theme'
  defaultTheme?: Theme
  storageKey?: string
  enableSystem?: boolean
}

const resolveSystemTheme = (): Theme =>
  window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'

export class ThemeProvider {
  private readonly options: Required<ThemeProviderOptions>
  private currentTheme: Theme

  constructor(options: ThemeProviderOptions = {}) {
    this.options = {
      attribute: options.attribute ?? 'class',
      defaultTheme: options.defaultTheme ?? 'dark',
      storageKey: options.storageKey ?? 'filmlane.theme',
      enableSystem: options.enableSystem ?? false,
    }

    this.currentTheme = this.options.defaultTheme
  }

  init(): Theme {
    if (typeof window === 'undefined') return this.currentTheme

    const fromStorage = window.localStorage.getItem(this.options.storageKey)
    const initial = fromStorage === 'light' || fromStorage === 'dark'
      ? (fromStorage as Theme)
      : this.options.enableSystem
        ? resolveSystemTheme()
        : this.options.defaultTheme

    this.setTheme(initial)
    return initial
  }

  setTheme(theme: Theme): void {
    this.currentTheme = theme

    if (typeof document === 'undefined') return

    const root = document.documentElement
    if (this.options.attribute === 'class') {
      root.classList.remove('light', 'dark')
      root.classList.add(theme)
    } else {
      root.setAttribute('data-theme', theme)
    }

    if (typeof window !== 'undefined') {
      window.localStorage.setItem(this.options.storageKey, theme)
    }
  }

  getTheme(): Theme {
    return this.currentTheme
  }

  toggleTheme(): Theme {
    const next = this.currentTheme === 'dark' ? 'light' : 'dark'
    this.setTheme(next)
    return next
  }
}

export const createThemeProvider = (options: ThemeProviderOptions = {}): ThemeProvider => {
  const provider = new ThemeProvider(options)
  provider.init()
  return provider
}
