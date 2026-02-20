import type { ToastActionElement, ToastProps } from '../components/ui/toast'

const TOAST_LIMIT = 3
const TOAST_REMOVE_DELAY = 5000

export interface ToasterToast extends ToastProps {
  id: string
  title?: string
  description?: string
  action?: ToastActionElement
}

interface State {
  toasts: ToasterToast[]
}

type Listener = (state: State) => void

const listeners: Listener[] = []
let state: State = { toasts: [] }
let counter = 0

const notify = (): void => {
  for (const listener of listeners) {
    listener(state)
  }
}

const genId = (): string => {
  counter = (counter + 1) % Number.MAX_SAFE_INTEGER
  return counter.toString()
}

const removeToast = (toastId: string): void => {
  state = {
    ...state,
    toasts: state.toasts.filter((toastItem) => toastItem.id !== toastId),
  }
  notify()
}

export const dismissToast = (toastId?: string): void => {
  if (!toastId) {
    const ids = state.toasts.map((item) => item.id)
    for (const id of ids) {
      window.setTimeout(() => removeToast(id), 0)
    }
    return
  }

  window.setTimeout(() => removeToast(toastId), 0)
}

export const toast = (props: Omit<ToasterToast, 'id'>): { id: string; dismiss: () => void } => {
  const id = genId()
  const next: ToasterToast = {
    ...props,
    id,
    open: true,
    onOpenChange: (open) => {
      if (!open) {
        dismissToast(id)
      }
    },
  }

  state = {
    ...state,
    toasts: [next, ...state.toasts].slice(0, TOAST_LIMIT),
  }
  notify()

  window.setTimeout(() => {
    removeToast(id)
  }, props.duration ?? TOAST_REMOVE_DELAY)

  return {
    id,
    dismiss: () => dismissToast(id),
  }
}

export const subscribeToastState = (listener: Listener): (() => void) => {
  listeners.push(listener)
  listener(state)

  return () => {
    const index = listeners.indexOf(listener)
    if (index >= 0) {
      listeners.splice(index, 1)
    }
  }
}

export const useToast = () => ({
  getState: (): State => state,
  subscribe: subscribeToastState,
  toast,
  dismiss: dismissToast,
})
