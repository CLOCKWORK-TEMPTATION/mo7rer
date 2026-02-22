import { createHoverCard } from '../ui'

/**
 * @description واجهة قسم مفرد ضمن الشريط الجانبي يحتوي عنوان وعناصر داخلية.
 */
export interface SidebarSection {
  title: string
  items: readonly string[]
  icon?: string
}

const createSection = (section: SidebarSection): HTMLElement => {
  const details = document.createElement('details')
  details.className = 'filmlane-sidebar__section'

  const summary = document.createElement('summary')
  summary.className = 'filmlane-sidebar__section-trigger'

  const left = document.createElement('span')
  left.className = 'filmlane-sidebar__section-icon'
  left.textContent = section.icon ?? '▸'

  const label = document.createElement('span')
  label.className = 'filmlane-sidebar__section-label'
  label.textContent = section.title

  const chevron = document.createElement('span')
  chevron.className = 'filmlane-sidebar__section-chevron'
  chevron.textContent = '‹'

  summary.appendChild(left)
  summary.appendChild(label)
  summary.appendChild(chevron)
  details.appendChild(summary)

  if (section.items.length > 0) {
    const list = document.createElement('div')
    list.className = 'filmlane-sidebar__section-list'

    for (const item of section.items) {
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'filmlane-sidebar__item'
      button.textContent = item
      list.appendChild(button)
    }

    details.appendChild(list)
  }

  return details
}

/**
 * @description مكون واجهة الشريط الجانبي (Sidebar) لعرض الإعدادات أو القوائم الثانوية وأدوات البحث.
 *
 * @complexity الزمنية: O(s * i) لإنشائه، حيث s الأقسام و i عناصرها | المكانية: O(s * i).
 *
 * @sideEffects
 *   - يبني عناصر DOM للشريط الجانبي وفق المعطيات.
 *
 * @usedBy
 *   - `ScreenplayEditor` لوضعه في المساحة الجانبية للتحكم المستمر.
 */
export class EditorSidebar {
  readonly element: HTMLElement

  constructor(content?: HTMLElement) {
    const aside = document.createElement('aside')
    aside.className = 'filmlane-sidebar'

    if (content) {
      aside.appendChild(content)
    } else {
      const card = document.createElement('div')
      card.className = 'filmlane-sidebar__card'
      aside.appendChild(card)
    }

    this.element = aside
  }

  static fromSections(sections: readonly SidebarSection[]): EditorSidebar {
    const card = document.createElement('div')
    card.className = 'filmlane-sidebar__card'

    const search = document.createElement('label')
    search.className = 'filmlane-sidebar__search'
    const searchIcon = document.createElement('span')
    searchIcon.className = 'filmlane-sidebar__search-icon'
    searchIcon.textContent = '⌕'
    const searchInput = document.createElement('input')
    searchInput.type = 'text'
    searchInput.placeholder = 'بحث...'
    searchInput.className = 'filmlane-sidebar__search-input'
    search.appendChild(searchIcon)
    search.appendChild(searchInput)
    card.appendChild(search)

    const sectionWrap = document.createElement('div')
    sectionWrap.className = 'filmlane-sidebar__sections'
    for (const section of sections) {
      sectionWrap.appendChild(createSection(section))
    }

    const settings = createSection({ title: 'الإعدادات', items: [], icon: '⚙' })
    sectionWrap.appendChild(settings)
    card.appendChild(sectionWrap)

    const helperCard = createHoverCard(
      'تم تفعيل وضع التركيز الذكي. استمتع بتجربة كتابة خالية من المشتتات.',
      'filmlane-sidebar__helper-card'
    )
    const helperText = helperCard.querySelector('p')
    if (helperText) {
      helperText.className = 'filmlane-sidebar__helper'
    }
    card.appendChild(helperCard)

    return new EditorSidebar(card)
  }
}
