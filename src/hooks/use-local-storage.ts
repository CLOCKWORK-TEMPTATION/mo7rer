const loadJson = <T>(key: string, fallback: T): T => {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

const saveJson = <T>(key: string, value: T): void => {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // ignore storage errors
  }
}

const timeoutMap = new Map<string, number>()

export const useAutoSave = <T>(key: string, value: T, delay = 3000): void => {
  if (typeof window === 'undefined') return

  const pending = timeoutMap.get(key)
  if (pending !== undefined) {
    window.clearTimeout(pending)
  }

  const timeoutId = window.setTimeout(() => {
    saveJson(key, value)
    timeoutMap.delete(key)
  }, delay)

  timeoutMap.set(key, timeoutId)
}

export const loadFromStorage = <T>(key: string, defaultValue: T): T => loadJson<T>(key, defaultValue)

export const saveToStorage = <T>(key: string, value: T): void => saveJson(key, value)
