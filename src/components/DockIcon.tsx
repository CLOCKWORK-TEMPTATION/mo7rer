import React from 'react'
import { HoverBorderGradient } from './ui/hover-border-gradient'
import { cn } from '../lib/utils'

export function DockIcon({
  icon: Icon,
  onClick,
  onMouseDown,
  active = false,
  className,
}: {
  icon: React.ElementType
  onClick?: () => void
  onMouseDown?: (e: React.MouseEvent<HTMLButtonElement>) => void
  active?: boolean
  className?: string
}) {
  return (
    <div className="relative z-10 flex h-10 w-10 items-center justify-center">
      <HoverBorderGradient
        as="button"
        onClick={onClick}
        onMouseDown={onMouseDown}
        containerClassName="h-full w-full rounded-full"
        className={cn(
          'flex h-full w-full items-center justify-center p-0 transition-all duration-200',
          active
            ? 'bg-[var(--brand)] text-white'
            : 'bg-[var(--card)] text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]',
          className
        )}
      >
        <Icon size={20} strokeWidth={1.5} />
      </HoverBorderGradient>
      {active && (
        <div className="absolute -bottom-2 h-1 w-1 rounded-full bg-[var(--brand)] blur-[1px]" />
      )}
    </div>
  )
}
