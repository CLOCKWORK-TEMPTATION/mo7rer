import { createDropdownMenu } from '../ui'

/**
 * @description مُعرفات الإجراءات (Actions) الممكنة من ترويسة المحرر.
 */
export type HeaderActionId =
  | 'new-file'
  | 'open-file'
  | 'insert-file'
  | 'save-file'
  | 'save-as-file'
  | 'print-file'
  | 'export-html'
  | 'copy'
  | 'cut'
  | 'paste'
  | 'select-all'
  | 'about'
  | 'user-profile'
  | 'user-settings'
  | 'user-logout'

/**
 * @description مكون ترويسة المحرر (Header) الذي يحتوي على قوائم منسدلة وأزرار تحكم علوية مثل "ملف"، "تعديل"، ومعلومات المستخدم.
 *
 * @complexity الزمنية: O(1) | المكانية: O(1)
 *
 * @sideEffects
 *   - ينشئ عناصر الـ DOM للقوائم في الذاكرة.
 *   - يستدعي دالة المتصل (onAction) عند النقر.
 *
 * @usedBy
 *   - `ScreenplayEditor` للتحكم العام وإدارة الملفات.
 */
export class EditorHeader {
  readonly element: HTMLElement

  constructor(onAction: (actionId: HeaderActionId) => void) {
    const menuSections: ReadonlyArray<{ label: string; actions: ReadonlyArray<{ id: HeaderActionId; label: string }> }> = [
      {
        label: 'مـلــــف',
        actions: [
          { id: 'new-file', label: 'جديد' },
          { id: 'open-file', label: 'فتح...' },
          { id: 'insert-file', label: 'إدراج ملف...' },
          { id: 'save-file', label: 'حفظ' },
          { id: 'save-as-file', label: 'حفظ باسم...' },
          { id: 'print-file', label: 'طباعة' },
          { id: 'export-html', label: 'تصدير HTML' },
        ],
      },
      {
        label: 'تعديـــل',
        actions: [
          { id: 'copy', label: 'نسخ' },
          { id: 'cut', label: 'قص' },
          { id: 'paste', label: 'لصق' },
          { id: 'select-all', label: 'تحديد الكل' },
        ],
      },
      {
        label: 'إضافـــــة',
        actions: [
          { id: 'insert-file', label: 'إضافة ملف...' },
          { id: 'open-file', label: 'فتح مرجع...' },
        ],
      },
      {
        label: 'تنسيـــق',
        actions: [
          { id: 'save-file', label: 'حفظ التنسيق الحالي' },
          { id: 'save-as-file', label: 'حفظ كقالب...' },
        ],
      },
      {
        label: 'أدوات',
        actions: [
          { id: 'print-file', label: 'طباعة' },
          { id: 'export-html', label: 'تصدير' },
        ],
      },
      {
        label: 'مساعدة',
        actions: [{ id: 'about', label: 'عن المحرر' }],
      },
    ]

    const header = document.createElement('header')
    header.className = 'filmlane-header'

    const rightBrand = document.createElement('div')
    rightBrand.className = 'filmlane-header__brand'
    rightBrand.textContent = 'أفان تيتر'

    const nav = document.createElement('nav')
    nav.className = 'filmlane-header__menus'
    for (const section of menuSections) {
      nav.appendChild(
        createDropdownMenu<HeaderActionId>({
          label: section.label,
          className: 'filmlane-header__menu',
          onAction,
          actions: section.actions,
        })
      )
    }

    const controls = document.createElement('div')
    controls.className = 'filmlane-header__controls'

    const status = document.createElement('div')
    status.className = 'filmlane-header__status'
    const statusDot = document.createElement('span')
    statusDot.className = 'filmlane-header__status-dot'
    const statusText = document.createElement('span')
    statusText.textContent = 'Online'
    status.appendChild(statusDot)
    status.appendChild(statusText)

    const userMenu = createDropdownMenu<HeaderActionId>({
      label: '👤',
      className: 'filmlane-header__user',
      onAction,
      actions: [
        { id: 'user-profile', label: 'الملف الشخصي' },
        { id: 'user-settings', label: 'الإعدادات' },
        { id: 'user-logout', label: 'تسجيل الخروج' },
      ],
    })

    controls.appendChild(status)
    controls.appendChild(userMenu)

    const leftBrand = document.createElement('div')
    leftBrand.className = 'filmlane-header__brand filmlane-header__brand--secondary'
    leftBrand.textContent = 'النسخة'

    header.appendChild(rightBrand)
    header.appendChild(nav)
    header.appendChild(controls)
    header.appendChild(leftBrand)

    this.element = header
  }
}
