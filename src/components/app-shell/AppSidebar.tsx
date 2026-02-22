import React from 'react'
import { HoverBorderGradient } from '../ui/hover-border-gradient'

export interface AppSidebarSection {
  id: string
  label: string
  icon: React.ElementType
  items: readonly string[]
}

interface AppSidebarProps {
  sections: readonly AppSidebarSection[]
  openSectionId: string | null
  onToggleSection: (sectionId: string) => void
  settingsPanel: React.ReactNode
}

export function AppSidebar({
  sections,
  openSectionId,
  onToggleSection,
  settingsPanel,
}: AppSidebarProps): React.JSX.Element {
  return (
    <aside className="app-sidebar hidden w-72 flex-col p-6 lg:flex">
      <HoverBorderGradient
        as="div"
        duration={1}
        containerClassName="h-full w-full rounded-3xl"
        className="flex h-full w-full flex-col items-stretch rounded-[inherit] bg-neutral-900/60 p-4 backdrop-blur-2xl"
      >
        <div className="group relative mb-8">
          <HoverBorderGradient
            as="div"
            duration={1}
            containerClassName="w-full rounded-xl group"
            className="flex w-full items-center gap-2 rounded-[inherit] bg-neutral-900/90 px-3 py-3"
          >
            <span className="size-4 text-center text-[var(--muted-foreground)] transition-colors group-focus-within:text-[var(--brand)]">
              ⌕
            </span>
            <input
              type="text"
              placeholder="بحث..."
              className="w-full border-none bg-transparent text-[13px] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none"
            />
            <kbd className="hidden rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] text-neutral-400 group-hover:block">
              ⌘K
            </kbd>
          </HoverBorderGradient>
        </div>

        <div className="space-y-2">
          {sections.map((section) => {
            const SIcon = section.icon
            const isOpen = openSectionId === section.id
            return (
              <div key={section.id} className="mb-2">
                <HoverBorderGradient
                  as="button"
                  duration={1}
                  containerClassName="w-full rounded-xl"
                  className={`group flex w-full items-center gap-3 rounded-[inherit] bg-neutral-900/90 p-3 transition-all duration-200 ${
                    isOpen ? 'text-white' : 'text-neutral-500 hover:text-neutral-200'
                  }`}
                  onClick={() => onToggleSection(section.id)}
                >
                  <SIcon
                    className={`size-[18px] transition-colors ${
                      isOpen
                        ? 'text-neutral-300'
                        : 'text-neutral-500 group-hover:text-neutral-200'
                    }`}
                  />
                  <span className="flex-1 text-right text-sm font-medium">{section.label}</span>
                  {section.items.length > 0 && (
                    <span
                      className={`text-neutral-600 transition-transform duration-300 ${
                        isOpen ? '-rotate-90' : ''
                      }`}
                    >
                      ‹
                    </span>
                  )}
                </HoverBorderGradient>

                {isOpen && section.items.length > 0 && (
                  <div className="mt-2 space-y-1 pr-4">
                    {section.items.map((item) => (
                      <button
                        key={`${section.id}-${item}`}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-neutral-400 transition-colors hover:bg-white/5 hover:text-white"
                      >
                        <span className="h-1 w-1 rounded-full bg-neutral-600" />
                        {item}
                      </button>
                    ))}
                  </div>
                )}

                {isOpen && section.id === 'settings' && settingsPanel}
              </div>
            )
          })}
        </div>

        <div className="mt-auto">
          <HoverBorderGradient
            as="div"
            duration={1}
            containerClassName="w-full rounded-2xl"
            className="flex w-full flex-col items-start rounded-[inherit] bg-neutral-900/90 p-4"
          >
            <span className="mb-2 text-base text-primary">✦</span>
            <p className="text-xs font-light leading-relaxed text-[var(--muted-foreground)]">
              تم تفعيل وضع التركيز الذكي. استمتع بتجربة كتابة خالية من المشتتات.
            </p>
          </HoverBorderGradient>
        </div>
      </HoverBorderGradient>
    </aside>
  )
}
