/**
 * @file toolbar.ts
 * @description شريط الأدوات القديم (Legacy Toolbar) المبني بـ Vanilla DOM.
 *   يوفر واجهة بديلة لشريط Dock في App.tsx، تتضمن:
 *   - قائمة منسدلة لاختيار نوع عنصر السيناريو.
 *   - أزرار تنسيق النص (غامق، مائل، تسطير).
 *   - مؤشر العنصر النشط حالياً.
 *
 * @remarks
 *   هذا الملف مستقل تماماً عن React — يعمل بالتلاعب المباشر بـ DOM.
 *   شريط Dock في `App.tsx` هو الشريط النشط حالياً؛ هذا الملف متاح كبديل.
 *
 * @dependencies
 *   - `@tiptap/core` — نوع `Editor` للربط مع المحرر.
 *   - `./editor` — `SCREENPLAY_ELEMENTS` لبناء خيارات القائمة المنسدلة.
 *
 * @usedBy
 *   - `components/editor/EditorArea.ts` — يمكنه استدعاء `createToolbar` اختيارياً.
 */
import type { Editor } from '@tiptap/core'
import { SCREENPLAY_ELEMENTS } from './editor'

/**
 * @description إنشاء شريط الأدوات القديم وربطه بالمحرر. يبني ثلاث مجموعات:
 *   1. قائمة منسدلة لاختيار نوع العنصر (بسملة، مشهد، حوار، إلخ).
 *   2. أزرار تنسيق النص: غامق (غ)، مائل (م)، تسطير (ت).
 *   3. مؤشر نصي يعرض نوع العنصر النشط حالياً.
 *   يسجّل مستمعي أحداث `selectionUpdate` و `transaction` لتحديث الحالة.
 *
 * @param {HTMLElement} toolbarEl — العنصر الحاوي الذي تُلحق به مكونات الشريط.
 * @param {Editor} editor — مثيل محرر Tiptap لربط الأوامر والأحداث.
 *
 * @sideEffects يُعدّل DOM داخل `toolbarEl` ويسجّل مستمعي أحداث على `editor`.
 *
 * @example
 * const toolbarEl = document.getElementById('toolbar')!
 * const editor = createScreenplayEditor(mountEl)
 * createToolbar(toolbarEl, editor)
 *
 * @example
 * // التحديث يحدث تلقائياً عند تغيير الاختيار في المحرر
 * editor.commands.setAction() // يُحدّث القائمة المنسدلة والمؤشر تلقائياً
 *
 * @example
 * // إزالة الشريط بالكامل
 * toolbarEl.innerHTML = ''
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
 * @description تحديث حالة جميع مكونات شريط الأدوات بناءً على حالة المحرر الحالية.
 *   يُفعّل/يُعطّل أصناف CSS على الأزرار، ويُحدّث نص مؤشر العنصر، ويضبط
 *   القيمة المختارة في القائمة المنسدلة.
 *
 * @param {Editor} editor — مثيل المحرر لقراءة حالة العنصر النشط.
 * @param {HTMLElement} toolbarEl — حاوي الشريط للبحث عن المكونات الفرعية.
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

/* ── مساعدات إنشاء عناصر DOM لشريط الأدوات ── */

/** إنشاء حاوي مجموعة أزرار بصنف `toolbar__group` */
function createGroup(): HTMLDivElement {
  const group = document.createElement('div')
  group.className = 'toolbar__group'
  return group
}

/**
 * إنشاء زر شريط أدوات مع محتوى HTML ومعالج نقر.
 * @param {string} html — محتوى HTML الداخلي للزر (مثل `<b>غ</b>`).
 * @param {() => void} onClick — دالة تُنفذ عند النقر.
 */
function createButton(html: string, onClick: () => void): HTMLButtonElement {
  const btn = document.createElement('button')
  btn.className = 'toolbar__btn'
  btn.innerHTML = html
  btn.addEventListener('click', onClick)
  return btn
}

/** إنشاء فاصل رأسي بين مجموعات الأزرار بصنف `toolbar__separator` */
function createSeparator(): HTMLDivElement {
  const sep = document.createElement('div')
  sep.className = 'toolbar__separator'
  return sep
}

/**
 * @description إنشاء قائمة منسدلة لاختيار نوع عنصر السيناريو. تُبنى ديناميكياً من
 *   `SCREENPLAY_ELEMENTS` وتربط حدث `change` بأمر تحويل الفقرة المقابل.
 *   اسم الأمر يُشتق بصيغة `set{PascalCase(name)}` (مثل `setAction`, `setDialogue`).
 *
 * @param {Editor} editor — مثيل المحرر لتنفيذ أوامر تحويل الفقرة.
 * @returns {HTMLSelectElement} عنصر القائمة المنسدلة الجاهز للإلحاق بالـ DOM.
 */
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
      ; (editor.commands[commandName] as () => boolean)()
    editor.commands.focus()
  })

  return select
}
