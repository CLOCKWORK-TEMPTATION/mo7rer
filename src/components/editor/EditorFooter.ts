import type { DocumentStats } from './editor-area.types'

/**
 * @description مكون واجهة ذيل المحرر (Footer) لعرض الإحصائيات (كلمات، أحرف، صفحات، مشاهد) والعنصر النصي النشط حالياً.
 *
 * @complexity الزمنية: O(1) للتحديث | المكانية: O(1)
 *
 * @sideEffects
 *   - ينشئ عناصر الـ DOM ويحدّث محتواها النصي مباشرة.
 *
 * @usedBy
 *   - `ScreenplayEditor` لربطه بنهاية المحرر لتحديث حالته باستمرار.
 */
export class EditorFooter {
  readonly element: HTMLElement

  private readonly pagesEl: HTMLElement
  private readonly wordsEl: HTMLElement
  private readonly charsEl: HTMLElement
  private readonly scenesEl: HTMLElement
  private readonly formatEl: HTMLElement

  constructor() {
    const footer = document.createElement('footer')
    footer.className = 'filmlane-footer'

    const statsWrap = document.createElement('div')
    statsWrap.className = 'filmlane-footer__stats'

    this.pagesEl = document.createElement('span')
    this.pagesEl.className = 'filmlane-footer__pages'
    this.wordsEl = document.createElement('span')
    this.wordsEl.className = 'filmlane-footer__optional-sm'
    this.charsEl = document.createElement('span')
    this.charsEl.className = 'filmlane-footer__optional-md'
    this.scenesEl = document.createElement('span')
    this.scenesEl.className = 'filmlane-footer__optional-sm'

    statsWrap.appendChild(this.pagesEl)
    statsWrap.appendChild(this.wordsEl)
    statsWrap.appendChild(this.charsEl)
    statsWrap.appendChild(this.scenesEl)

    const formatWrap = document.createElement('div')
    formatWrap.className = 'filmlane-footer__format'
    formatWrap.textContent = 'العنصر الحالي: '

    this.formatEl = document.createElement('span')
    this.formatEl.textContent = '—'
    formatWrap.appendChild(this.formatEl)

    footer.appendChild(statsWrap)
    footer.appendChild(formatWrap)

    this.element = footer
    this.setStats({ pages: 1, words: 0, characters: 0, scenes: 0 })
  }

  setStats(stats: DocumentStats): void {
    this.pagesEl.textContent = `${stats.pages} صفحة`
    this.wordsEl.textContent = `${stats.words} كلمة`
    this.charsEl.textContent = `${stats.characters} حرف`
    this.scenesEl.textContent = `${stats.scenes} مشهد`
  }

  setCurrentFormatLabel(label: string): void {
    this.formatEl.textContent = label || '—'
  }
}
