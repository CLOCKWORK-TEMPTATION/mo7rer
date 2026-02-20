import { SCREENPLAY_ELEMENTS } from '../../editor'

export type ToolbarActionId =
  | 'open-file'
  | 'insert-file'
  | 'save-file'
  | 'print-file'
  | 'export-html'
  | 'download-file'
  | 'upload-file'
  | 'undo'
  | 'redo'
  | 'bold'
  | 'italic'
  | 'underline'
  | 'justify-left'
  | 'justify-right'
  | 'justify-center'
  | 'check'
  | 'ideas'
  | 'messages'
  | 'history'
  | 'help'
  | 'info'
  | `format:${string}`

interface IconButtonSpec {
  actionId: ToolbarActionId
  icon: string
  title: string
  group?: 'media' | 'tools' | 'actions' | 'format' | 'info'
  tone?: 'default' | 'accent' | 'warn' | 'muted'
}

const makeIconButton = (onAction: (actionId: ToolbarActionId) => void, spec: IconButtonSpec): HTMLButtonElement => {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = `filmlane-toolbar__btn filmlane-toolbar__btn--icon filmlane-toolbar__btn--${spec.tone ?? 'default'}`
  button.title = spec.title
  button.setAttribute('aria-label', spec.title)
  button.dataset.group = spec.group ?? 'media'
  button.dataset.action = spec.actionId
  button.addEventListener('click', () => onAction(spec.actionId))

  const icon = document.createElement('span')
  icon.className = 'filmlane-toolbar__icon'
  icon.textContent = spec.icon
  button.appendChild(icon)

  return button
}

export class EditorToolbar {
  readonly element: HTMLElement

  private readonly formatSelect: HTMLSelectElement

  constructor(onAction: (actionId: ToolbarActionId) => void) {
    const toolbar = document.createElement('div')
    toolbar.className = 'filmlane-toolbar filmlane-toolbar--dock'

    const filmBadge = document.createElement('div')
    filmBadge.className = 'filmlane-toolbar__film-badge'
    filmBadge.textContent = '🎞'
    filmBadge.title = 'Filmlane'
    toolbar.appendChild(filmBadge)

    const actions: readonly IconButtonSpec[] = [
      { actionId: 'info', icon: 'ⓘ', title: 'معلومات', group: 'info', tone: 'muted' },

      { actionId: 'justify-left', icon: '≡', title: 'محاذاة يسار', group: 'format', tone: 'default' },
      { actionId: 'justify-right', icon: '☰', title: 'محاذاة يمين', group: 'format', tone: 'default' },
      { actionId: 'justify-center', icon: '≣', title: 'توسيط', group: 'format', tone: 'default' },
      { actionId: 'italic', icon: 'I', title: 'مائل', group: 'format', tone: 'accent' },
      { actionId: 'bold', icon: 'B', title: 'عريض', group: 'format', tone: 'accent' },
      { actionId: 'undo', icon: '↶', title: 'تراجع', group: 'format', tone: 'muted' },
      { actionId: 'redo', icon: '↷', title: 'إعادة', group: 'format', tone: 'muted' },

      { actionId: 'save-file', icon: '💾', title: 'حفظ', group: 'actions', tone: 'default' },
      { actionId: 'upload-file', icon: '⤴', title: 'إدراج ملف', group: 'actions', tone: 'default' },
      { actionId: 'history', icon: '🕘', title: 'السجل', group: 'actions', tone: 'muted' },
      { actionId: 'messages', icon: '💬', title: 'رسائل', group: 'actions', tone: 'accent' },

      { actionId: 'ideas', icon: '💡', title: 'أفكار', group: 'tools', tone: 'accent' },
      { actionId: 'check', icon: '🩺', title: 'فحص النص', group: 'tools', tone: 'warn' },

      { actionId: 'download-file', icon: '⬇', title: 'تحميل', group: 'media', tone: 'accent' },
      { actionId: 'print-file', icon: '🖨', title: 'طباعة', group: 'media', tone: 'default' },
      { actionId: 'open-file', icon: '📂', title: 'فتح ملف', group: 'media', tone: 'default' },
      { actionId: 'help', icon: '?', title: 'مساعدة', group: 'info', tone: 'muted' },
    ]

    let prevGroup: IconButtonSpec['group'] | null = null
    for (const action of actions) {
      if (prevGroup !== null && action.group !== prevGroup) {
        toolbar.appendChild(this.makeSeparator())
      }
      toolbar.appendChild(makeIconButton(onAction, action))
      prevGroup = action.group ?? null
    }

    this.formatSelect = document.createElement('select')
    this.formatSelect.className = 'filmlane-toolbar__select filmlane-toolbar__select--hidden'
    for (const element of SCREENPLAY_ELEMENTS) {
      const option = document.createElement('option')
      option.value = element.name
      option.textContent = element.label
      this.formatSelect.appendChild(option)
    }
    this.formatSelect.addEventListener('change', () => onAction(`format:${this.formatSelect.value}`))
    toolbar.appendChild(this.formatSelect)

    this.element = toolbar
  }

  setCurrentFormat(format: string | null): void {
    if (!format) return
    this.formatSelect.value = format
  }

  private makeSeparator(): HTMLDivElement {
    const divider = document.createElement('div')
    divider.className = 'filmlane-toolbar__separator'
    return divider
  }
}
