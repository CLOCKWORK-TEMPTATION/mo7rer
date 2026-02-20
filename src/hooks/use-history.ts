export interface HistoryController<T> {
  getState: () => T
  set: (action: T | ((prev: T) => T)) => T
  undo: () => T
  redo: () => T
  canUndo: () => boolean
  canRedo: () => boolean
  subscribe: (listener: (state: T) => void) => () => void
}

export const useHistory = <T>(initialState: T): HistoryController<T> => {
  let index = 0
  const history: T[] = [initialState]
  const listeners: Array<(state: T) => void> = []

  const notify = (): void => {
    const state = history[index]
    for (const listener of listeners) {
      listener(state)
    }
  }

  const getState = (): T => history[index]

  const set = (action: T | ((prev: T) => T)): T => {
    const prev = history[index]
    const next = typeof action === 'function' ? (action as (prev: T) => T)(prev) : action

    history.splice(index + 1)
    history.push(next)
    index = history.length - 1
    notify()
    return next
  }

  const undo = (): T => {
    if (index > 0) {
      index -= 1
      notify()
    }
    return history[index]
  }

  const redo = (): T => {
    if (index < history.length - 1) {
      index += 1
      notify()
    }
    return history[index]
  }

  const subscribe = (listener: (state: T) => void): (() => void) => {
    listeners.push(listener)
    listener(history[index])
    return () => {
      const at = listeners.indexOf(listener)
      if (at >= 0) {
        listeners.splice(at, 1)
      }
    }
  }

  return {
    getState,
    set,
    undo,
    redo,
    canUndo: () => index > 0,
    canRedo: () => index < history.length - 1,
    subscribe,
  }
}
