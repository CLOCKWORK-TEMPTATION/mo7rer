import React from 'react'
import { User } from 'lucide-react'
import { HoverBorderGradient } from '../ui/hover-border-gradient'

export interface AppShellMenuItem {
  label: string
  actionId: string
  shortcut?: string
  accentColor?: string
}

export interface AppShellMenuSection {
  label: string
  items: readonly AppShellMenuItem[]
}

interface AppHeaderProps {
  menuSections: readonly AppShellMenuSection[]
  activeMenu: string | null
  onToggleMenu: (sectionLabel: string) => void
  onAction: (actionId: string) => void
  infoDotColor: string
  brandGradient: string
  onlineDotColor: string
}

export function AppHeader({
  menuSections,
  activeMenu,
  onToggleMenu,
  onAction,
  infoDotColor,
  brandGradient,
  onlineDotColor,
}: AppHeaderProps): React.JSX.Element {
  return (
    <header className="app-header relative z-40 flex h-[60px] flex-shrink-0 items-center justify-between bg-[var(--card)]/80 px-7 backdrop-blur-2xl">
      <div className="flex items-center gap-3">
        <HoverBorderGradient
          as="div"
          duration={1}
          containerClassName="h-11 rounded-full"
          className="flex h-full items-center gap-1.5 rounded-[inherit] bg-neutral-950/80 p-1.5 backdrop-blur-2xl"
        >
          <HoverBorderGradient
            as="div"
            duration={1}
            containerClassName="h-full rounded-full"
            className="flex h-full items-center gap-2.5 rounded-[inherit] bg-neutral-900/90 px-5"
          >
            <span
              className="h-1.5 w-1.5 rounded-full shadow-[0_0_6px_rgba(15,76,138,0.5)]"
              style={{ backgroundColor: infoDotColor }}
            />
            <span
              className="bg-clip-text text-[15px] font-bold text-transparent transition-all duration-300"
              style={{ backgroundImage: brandGradient }}
            >
              أفان تيتر
            </span>
          </HoverBorderGradient>
        </HoverBorderGradient>

        <HoverBorderGradient
          as="div"
          duration={1}
          containerClassName="relative z-50 h-11 rounded-full"
          className="flex h-full items-center gap-1.5 rounded-[inherit] bg-neutral-950/80 p-1.5 backdrop-blur-2xl"
        >
          {menuSections.map((section) => (
            <div
              key={section.label}
              className="group relative h-full"
              onClick={(event) => {
                event.stopPropagation()
              }}
            >
              <HoverBorderGradient
                as="button"
                duration={1}
                containerClassName="h-full rounded-full"
                className={`flex h-full min-w-[72px] justify-center items-center rounded-[inherit] px-4 text-[13px] font-medium transition-all ${
                  activeMenu === section.label
                    ? 'bg-neutral-800 text-white'
                    : 'bg-neutral-900/90 text-neutral-400 hover:bg-neutral-800 group-hover:text-white'
                }`}
                onClick={() => onToggleMenu(section.label)}
              >
                {section.label}
              </HoverBorderGradient>

              {activeMenu === section.label && (
                <div className="absolute right-0 top-full z-50 mt-2 w-72 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--popover)]/95 p-1 shadow-[0_20px_60px_-10px_rgba(0,0,0,0.8)] backdrop-blur-2xl">
                  {section.items.map((item) => (
                    <button
                      key={`${section.label}-${item.label}`}
                      onClick={() => onAction(item.actionId)}
                      className="flex w-full items-center gap-2 rounded-[var(--radius-md)] px-3 py-2 text-right text-[13px] text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)]/50 hover:text-[var(--foreground)]"
                    >
                      {item.accentColor && (
                        <span
                          className="h-2 w-2 flex-shrink-0 rounded-full"
                          style={{ backgroundColor: item.accentColor }}
                        />
                      )}
                      <span className="flex-1 text-right">{item.label}</span>
                      {item.shortcut && (
                        <span className="text-[10px] text-[var(--muted-foreground)]">{item.shortcut}</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </HoverBorderGradient>
      </div>

      <HoverBorderGradient
        as="div"
        duration={1}
        containerClassName="h-11 rounded-full"
        className="flex h-full items-center gap-1.5 rounded-[inherit] bg-neutral-950/80 p-1.5 backdrop-blur-2xl"
      >
        <HoverBorderGradient
          as="div"
          duration={1}
          containerClassName="h-full rounded-full"
          className="flex h-full items-center gap-2 rounded-[inherit] bg-neutral-900/90 px-4 text-[11px] font-bold uppercase tracking-wider text-ring"
        >
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ring" />
          Online
        </HoverBorderGradient>

        <HoverBorderGradient
          as="div"
          duration={1}
          containerClassName="h-full w-8 cursor-pointer rounded-full"
          className="flex h-full w-full items-center justify-center rounded-[inherit] bg-neutral-900/90 p-0"
        >
          <User className="size-4 text-neutral-300" />
        </HoverBorderGradient>

        <HoverBorderGradient
          as="div"
          duration={1}
          containerClassName="group h-full cursor-pointer rounded-full"
          className="flex h-full items-center gap-2.5 rounded-[inherit] bg-neutral-900/90 px-5 leading-none"
        >
          <span
            className="bg-clip-text text-[15px] font-bold text-transparent transition-all duration-300"
            style={{ backgroundImage: brandGradient }}
          >
            النسخة
          </span>
          <span className="flex h-1.5 w-1.5">
            <span
              className="relative inline-flex h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: onlineDotColor }}
            />
          </span>
        </HoverBorderGradient>
      </HoverBorderGradient>
    </header>
  )
}
