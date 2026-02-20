import React from 'react'
import { ChevronLeft } from 'lucide-react'
import { HoverBorderGradient } from './ui/hover-border-gradient'
import { cn } from '../lib/utils'

export function SidebarButton({
  icon: Icon,
  label,
  active = false,
  hasItems = false,
  isOpen = false,
  onToggle,
  duration = 1,
}: {
  icon: React.ElementType
  label: string
  active?: boolean
  hasItems?: boolean
  isOpen?: boolean
  onToggle?: () => void
  duration?: number
}) {
  return (
    <HoverBorderGradient
      as="button"
      onClick={onToggle}
      containerClassName="w-full rounded-[var(--radius-lg)]"
      className={cn(
        'flex w-full items-center gap-2.5 px-3 py-2.5 transition-all duration-200',
        active
          ? 'bg-[var(--accent)] text-[var(--accent-foreground)]'
          : 'bg-[var(--card)]/50 text-[var(--muted-foreground)] hover:bg-[var(--accent)]/50 hover:text-[var(--foreground)]'
      )}
      duration={duration}
    >
      <Icon size={18} strokeWidth={1.5} className={cn('transition-colors', active && 'text-[var(--brand)]')} />
      <span className="flex-1 text-right text-[13px] font-medium">{label}</span>
      {hasItems && (
        <ChevronLeft
          size={16}
          className={cn(
            'text-[var(--muted-foreground)] transition-transform duration-300',
            isOpen ? '-rotate-90' : ''
          )}
        />
      )}
    </HoverBorderGradient>
  )
}
