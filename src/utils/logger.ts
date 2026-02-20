export type LogLevel = 'info' | 'warn' | 'error' | 'debug'

export interface LogContext {
  scope?: string
  data?: unknown
}

const canDebug = import.meta.env.DEV

const withScope = (message: string, scope?: string): string => {
  if (!scope) return message
  return `[${scope}] ${message}`
}

export const logger = {
  info(message: string, context?: LogContext): void {
    // eslint-disable-next-line no-console
    console.info(withScope(message, context?.scope), context?.data ?? '')
  },

  warn(message: string, context?: LogContext): void {
    // eslint-disable-next-line no-console
    console.warn(withScope(message, context?.scope), context?.data ?? '')
  },

  error(message: string, context?: LogContext): void {
    // eslint-disable-next-line no-console
    console.error(withScope(message, context?.scope), context?.data ?? '')
  },

  debug(message: string, context?: LogContext): void {
    if (!canDebug) return
    // eslint-disable-next-line no-console
    console.debug(withScope(message, context?.scope), context?.data ?? '')
  },
}
