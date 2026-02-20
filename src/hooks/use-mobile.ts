const MOBILE_BREAKPOINT = 768

type MobileListener = (isMobile: boolean) => void

export const useIsMobile = (): boolean => {
  if (typeof window === 'undefined') return false
  return window.innerWidth < MOBILE_BREAKPOINT
}

export const subscribeIsMobile = (listener: MobileListener): (() => void) => {
  if (typeof window === 'undefined') {
    listener(false)
    return () => undefined
  }

  const mediaQuery = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
  const onChange = (): void => listener(window.innerWidth < MOBILE_BREAKPOINT)

  mediaQuery.addEventListener('change', onChange)
  onChange()

  return () => {
    mediaQuery.removeEventListener('change', onChange)
  }
}
