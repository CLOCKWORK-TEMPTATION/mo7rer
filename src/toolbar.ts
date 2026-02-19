import type { Editor } from '@tiptap/core'
import { SCREENPLAY_ELEMENTS } from './editor'

/**
 * إنشاء شريط الأدوات
 */
export function createToolbar(toolbarEl: HTMLElement, editor: Editor): void {
  // مجموعة القائمة المنسدلة لاختيار العنصر
  const elementsGroup = createGroup()
  const elementSelect = createElementSelect(editor)
  elementsGroup.appendChild(elementSelect)
  toolbarEl.appendChild(elementsGroup)

  // فاصل
  toolbarEl.appendChild(createSeparator())

  // مجموعة التنسيق
  const formatGroup = createGroup()

  const boldBtn = createButton('<b>غ</b>', () => {
    editor.chain().focus().toggleBold().run()
  })
  boldBtn.title = 'غامق (Ctrl+B)'

  const italicBtn = createButton('<i>م</i>', () => {
    editor.chain().focus().toggleItalic().run()
  })
  italicBtn.title = 'مائل (Ctrl+I)'

  const underlineBtn = createButton('<u>ت</u>', () => {
    editor.chain().focus().toggleUnderline().run()
  })
  underlineBtn.title = 'تسطير (Ctrl+U)'

  formatGroup.appendChild(boldBtn)
  formatGroup.appendChild(italicBtn)
  formatGroup.appendChild(underlineBtn)
  toolbarEl.appendChild(formatGroup)

  // مؤشر العنصر الحالي
  const currentElementIndicator = document.createElement('div')
  currentElementIndicator.className = 'toolbar__current-element'
  currentElementIndicator.id = 'current-element'
  currentElementIndicator.innerHTML = '<span class="label">العنصر:</span> <span class="value">—</span>'
  toolbarEl.appendChild(currentElementIndicator)

  // تحديث حالة الأزرار عند تغيير الاختيار
  editor.on('selectionUpdate', () => updateToolbarState(editor, toolbarEl))
  editor.on('transaction', () => updateToolbarState(editor, toolbarEl))
}

/**
 * تحديث حالة شريط الأدوات
 */
function updateToolbarState(editor: Editor, toolbarEl: HTMLElement): void {
  // تحديث أزرار التنسيق
  const buttons = toolbarEl.querySelectorAll('.toolbar__btn')
  buttons.forEach((btn) => {
    const element = (btn as HTMLElement).dataset.element
    if (element) {
      btn.classList.toggle('is-active', editor.isActive(element))
    }
  })

  // تحديث مؤشر العنصر الحالي
  const indicator = toolbarEl.querySelector('#current-element .value')
  if (indicator) {
    const activeElement = SCREENPLAY_ELEMENTS.find((el) => editor.isActive(el.name))
    indicator.textContent = activeElement ? `${activeElement.icon} ${activeElement.label}` : '—'
  }

  // تحديث القائمة المنسدلة
  const select = toolbarEl.querySelector('.toolbar__select') as HTMLSelectElement | null
  if (select) {
    const activeElement = SCREENPLAY_ELEMENTS.find((el) => editor.isActive(el.name))
    select.value = activeElement?.name ?? ''
  }
}

/**
 * مساعدات إنشاء عناصر شريط الأدوات
 */
function createGroup(): HTMLDivElement {
  const group = document.createElement('div')
  group.className = 'toolbar__group'
  return group
}

function createButton(html: string, onClick: () => void): HTMLButtonElement {
  const btn = document.createElement('button')
  btn.className = 'toolbar__btn'
  btn.innerHTML = html
  btn.addEventListener('click', onClick)
  return btn
}

function createSeparator(): HTMLDivElement {
  const sep = document.createElement('div')
  sep.className = 'toolbar__separator'
  return sep
}

function createElementSelect(editor: Editor): HTMLSelectElement {
  const select = document.createElement('select')
  select.className = 'toolbar__select'

  const defaultOpt = document.createElement('option')
  defaultOpt.value = ''
  defaultOpt.textContent = '— نوع العنصر —'
  defaultOpt.disabled = true
  select.appendChild(defaultOpt)

  SCREENPLAY_ELEMENTS.forEach((el) => {
    const opt = document.createElement('option')
    opt.value = el.name
    opt.textContent = `${el.icon} ${el.label}`
    select.appendChild(opt)
  })

  select.addEventListener('change', () => {
    const value = select.value
    const commandName = `set${value.charAt(0).toUpperCase() + value.slice(1)}` as keyof typeof editor.commands
    ;(editor.commands[commandName] as () => boolean)()
    editor.commands.focus()
  })

  return select
}
