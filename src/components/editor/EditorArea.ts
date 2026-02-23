import { createScreenplayEditor, SCREENPLAY_ELEMENTS } from '../../editor'
import { applyPasteClassifierFlowToView } from '../../extensions/paste-classifier'
import { isElementType, type ElementType } from '../../extensions/classification-types'
import {
  CONTENT_HEIGHT_PX,
  FOOTER_HEIGHT_PX,
  PAGE_HEIGHT_PX,
  PAGE_MARGIN_BOTTOM_PX,
  PAGE_MARGIN_LEFT_PX,
  PAGE_MARGIN_RIGHT_PX,
  PAGE_MARGIN_TOP_PX,
  PAGE_WIDTH_PX,
} from '../../constants/page'
import {
  applyEditorFormatStyleVariables,
  LOCKED_EDITOR_FONT_FAMILY,
  LOCKED_EDITOR_FONT_SIZE,
  LOCKED_EDITOR_LINE_HEIGHT,
} from '../../constants/editor-format-styles'
import { htmlToScreenplayBlocks, screenplayBlocksToHtml, type ScreenplayBlock } from '../../utils/file-import'
import { FILMLANE_CLIPBOARD_MIME, type ClipboardOrigin, type EditorClipboardPayload } from '../../types/editor-clipboard'
import type { RunEditorCommandOptions } from '../../types/editor-engine'
import type { DocumentStats, EditorAreaProps, EditorCommand, EditorHandle, FileImportMode } from './editor-area.types'

const hashText = (value: string): string => {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

const isValidClipboardPayload = (value: unknown): value is EditorClipboardPayload => {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<EditorClipboardPayload>
  if (typeof candidate.plainText !== 'string') return false
  if (typeof candidate.hash !== 'string') return false
  if (typeof candidate.createdAt !== 'string') return false
  if (candidate.sourceKind !== 'selection' && candidate.sourceKind !== 'document') return false
  if (candidate.blocks && !Array.isArray(candidate.blocks)) return false
  return true
}

const commandNameByFormat: Record<ElementType, string> = {
  basmala: 'setBasmala',
  sceneHeaderTopLine: 'setSceneHeaderTopLine',
  sceneHeader3: 'setSceneHeader3',
  action: 'setAction',
  character: 'setCharacter',
  dialogue: 'setDialogue',
  parenthetical: 'setParenthetical',
  transition: 'setTransition',
}

const formatLabelByType: Record<ElementType, string> = {
  basmala: 'بسملة',
  sceneHeaderTopLine: 'سطر رأس المشهد',
  sceneHeader3: 'رأس المشهد (3)',
  action: 'حدث / وصف',
  character: 'شخصية',
  dialogue: 'حوار',
  parenthetical: 'تعليمات حوار',
  transition: 'انتقال',
}

/**
 * @description المكون الرئيسي لمنطقة تحرير السيناريو. يدير كائن Tiptap ومزامنة التنسيقات ويراقب تغييرات الصفحة (Layout).
 *
 * @complexity الزمنية: O(1) للتهيئة الأساسية | المكانية: O(n) استناداً لحجم المستند.
 *
 * @sideEffects
 *   - يتفاعل بشكل كثيف مع الـ DOM (تحديث أحجام، ومراقبة تغيرات).
 *   - قد يُنشأ ResizeObserver.
 *
 * @usedBy
 *   - `ScreenplayEditor` لربط منطقة الكتابة بالترويسة وأدوات أخرى.
 *
 * @example
 * ```typescript
 * const area = new EditorArea({ mount: div, onContentChange: (text) => console.log(text) });
 * area.getHandle().clear();
 * ```
 */
export class EditorArea implements EditorHandle {
  readonly editor

  private readonly props: EditorAreaProps
  private readonly body: HTMLDivElement
  private readonly hasPagesExtension: boolean
  private resizeObserver: ResizeObserver | null = null
  private paginationObserver: MutationObserver | null = null
  private characterWidowFixRaf: number | null = null
  private applyingCharacterWidowFix = false
  private estimatedPages = 1

  constructor(props: EditorAreaProps) {
    this.props = props

    const sheet = document.createElement('div')
    sheet.className = 'screenplay-sheet filmlane-sheet-paged'
    sheet.style.height = 'auto'
    sheet.style.overflow = 'hidden'
    sheet.style.minHeight = 'var(--page-height)'

    const body = document.createElement('div')
    body.className = 'screenplay-sheet__body'

    this.applyLockedLayoutMetrics(sheet)
    this.applyLockedEditorTypography(body)
    sheet.appendChild(body)

    props.mount.innerHTML = ''
    props.mount.appendChild(sheet)

    this.body = body

    this.editor = createScreenplayEditor(body)
    this.hasPagesExtension = this.editor.extensionManager.extensions.some((extension) => extension.name === 'pages')

    this.editor.on('update', this.handleEditorUpdate)
    this.editor.on('selectionUpdate', this.handleSelectionUpdate)
    this.editor.on('transaction', this.handleSelectionUpdate)

    this.bindPageModelObservers()
    this.refreshPageModel(true)
    this.emitState()
  }

  getAllText = (): string => this.editor.getText()

  getAllHtml = (): string => this.editor.getHTML()

  focusEditor = (): void => {
    this.editor.commands.focus('end')
  }

  clear = (): void => {
    this.editor.commands.setContent('<div data-type="action"></div>')
    this.editor.commands.focus('start')
    this.refreshPageModel(true)
    this.emitState()
  }

  runCommand = (commandInput: EditorCommand | RunEditorCommandOptions): boolean => {
    const command = typeof commandInput === 'string' ? commandInput : commandInput.command

    switch (command) {
      case 'bold':
        return this.editor.chain().focus().toggleBold().run()
      case 'italic':
        return this.editor.chain().focus().toggleItalic().run()
      case 'underline':
        return this.editor.chain().focus().toggleUnderline().run()
      case 'align-right':
        return this.applyTextAlignCommand('right')
      case 'align-center':
        return this.applyTextAlignCommand('center')
      case 'align-left':
        return this.applyTextAlignCommand('left')
      case 'undo': {
        const undo = (this.editor.commands as Record<string, unknown>).undo
        return typeof undo === 'function' ? (undo as () => boolean)() : false
      }
      case 'redo': {
        const redo = (this.editor.commands as Record<string, unknown>).redo
        return typeof redo === 'function' ? (redo as () => boolean)() : false
      }
      case 'select-all':
        this.editor.commands.selectAll()
        return true
      case 'focus-end':
        this.editor.commands.focus('end')
        return true
      default:
        return false
    }
  }

  private applyTextAlignCommand(alignment: 'left' | 'center' | 'right'): boolean {
    const chain = this.editor.chain().focus() as unknown as {
      setTextAlign?: (value: 'left' | 'center' | 'right') => { run: () => boolean }
      run: () => boolean
    }

    if (typeof chain.setTextAlign === 'function') {
      const result = chain.setTextAlign(alignment).run()
      if (result) return true
    }

    const setTextAlign = (this.editor.commands as Record<string, unknown>).setTextAlign
    if (typeof setTextAlign === 'function') {
      const result = (setTextAlign as (value: 'left' | 'center' | 'right') => boolean)(alignment)
      if (result) return true
    }

    return this.applyTextAlignDomFallback(alignment)
  }

  private applyTextAlignDomFallback(alignment: 'left' | 'center' | 'right'): boolean {
    const domSelection =
      typeof window !== 'undefined' && typeof window.getSelection === 'function'
        ? window.getSelection()
        : null

    let targetElement: HTMLElement | null = null
    const anchorNode = domSelection?.anchorNode ?? null

    if (anchorNode) {
      const anchorElement =
        anchorNode instanceof HTMLElement ? anchorNode : anchorNode.parentElement
      targetElement = anchorElement?.closest<HTMLElement>('[data-type]') ?? null
    }

    if (!targetElement) {
      const fromPos = this.editor.state.selection.from
      const nodeAtPos = this.editor.view.nodeDOM(fromPos)
      const baseElement =
        nodeAtPos instanceof HTMLElement ? nodeAtPos : nodeAtPos?.parentElement ?? null
      targetElement = baseElement?.closest<HTMLElement>('[data-type]') ?? null
    }

    if (!targetElement) return false

    targetElement.style.textAlign = alignment
    if (targetElement.getAttribute('data-type') === 'action') {
      if (alignment === 'right') {
        targetElement.style.textAlignLast = 'right'
        targetElement.style.setProperty('text-justify', 'inter-word')
      } else {
        targetElement.style.textAlignLast = 'auto'
        targetElement.style.setProperty('text-justify', 'auto')
      }
    }

    return true
  }

  setFormat = (format: ElementType): boolean => {
    const commandName = commandNameByFormat[format]
    const command = (this.editor.commands as Record<string, unknown>)[commandName]
    if (typeof command !== 'function') return false
    return (command as () => boolean)()
  }

  getCurrentFormat = (): ElementType | null => {
    for (const item of SCREENPLAY_ELEMENTS) {
      if (!isElementType(item.name)) continue
      if (this.editor.isActive(item.name)) return item.name
    }
    return null
  }

  getCurrentFormatLabel = (): string => {
    const format = this.getCurrentFormat()
    return format ? formatLabelByType[format] : '—'
  }

  importClassifiedText = async (text: string, mode: FileImportMode = 'replace'): Promise<void> => {
    // ضمان تفعيل دورة القياس في امتداد الصفحات قبل/بعد إدراج النص.
    this.editor.commands.focus(mode === 'replace' ? 'start' : 'end')

    const state = this.editor.view.state
    const replaceAllFrom = 0
    const replaceAllTo = state.doc.content.size
    const from = mode === 'replace' ? replaceAllFrom : state.selection.from
    const to = mode === 'replace' ? replaceAllTo : state.selection.to

    const applied = await applyPasteClassifierFlowToView(this.editor.view, text, {
      from,
      to,
    })
    if (!applied) return

    this.editor.commands.focus(mode === 'replace' ? 'start' : 'end')
    this.refreshPageModel(true)
    this.scheduleCharacterWidowFix()
    this.emitState()

    if (typeof window !== 'undefined') {
      window.requestAnimationFrame(() => {
        this.refreshPageModel(true)
        this.scheduleCharacterWidowFix()
        this.emitState()
      })
    }
  }

  importStructuredBlocks = (blocks: ScreenplayBlock[], mode: FileImportMode = 'replace'): void => {
    if (!blocks || blocks.length === 0) return

    const html = screenplayBlocksToHtml(blocks)
    if (!html.trim()) return

    if (mode === 'replace') {
      this.editor.commands.setContent(html)
    } else {
      this.editor.chain().focus().insertContent(html).run()
    }

    this.refreshPageModel(true)
    this.emitState()
  }

  getBlocks = (): ScreenplayBlock[] => htmlToScreenplayBlocks(this.getAllHtml())

  hasSelection = (): boolean => !this.editor.state.selection.empty

  copySelectionToClipboard = async (): Promise<boolean> => {
    if (typeof navigator === 'undefined' || !navigator.clipboard) return false

    const hasSelection = this.hasSelection()
    const plainText = hasSelection
      ? this.editor.state.doc.textBetween(
          this.editor.state.selection.from,
          this.editor.state.selection.to,
          '\n'
        )
      : this.getAllText()

    if (!plainText.trim()) return false

    const payload: EditorClipboardPayload = {
      plainText,
      blocks: hasSelection ? undefined : this.getBlocks(),
      sourceKind: hasSelection ? 'selection' : 'document',
      hash: hashText(plainText),
      createdAt: new Date().toISOString(),
    }

    const serializedPayload = JSON.stringify(payload)

    try {
      if (typeof ClipboardItem !== 'undefined' && typeof navigator.clipboard.write === 'function') {
        const clipboardItem = new ClipboardItem({
          'text/plain': new Blob([plainText], { type: 'text/plain' }),
          [FILMLANE_CLIPBOARD_MIME]: new Blob([serializedPayload], { type: FILMLANE_CLIPBOARD_MIME }),
        })
        await navigator.clipboard.write([clipboardItem])
        return true
      }
    } catch {
      // fallback to plain text write when custom MIME fails.
    }

    if (typeof navigator.clipboard.writeText === 'function') {
      await navigator.clipboard.writeText(plainText)
      return true
    }

    return false
  }

  cutSelectionToClipboard = async (): Promise<boolean> => {
    if (!this.hasSelection()) return false

    const copied = await this.copySelectionToClipboard()
    if (!copied) return false

    return this.editor.chain().focus().deleteSelection().run()
  }

  pasteFromClipboard = async (origin: ClipboardOrigin): Promise<boolean> => {
    void origin
    if (typeof navigator === 'undefined' || !navigator.clipboard) return false

    try {
      if (typeof navigator.clipboard.read === 'function') {
        const items = await navigator.clipboard.read()
        for (const item of items) {
          if (item.types.includes(FILMLANE_CLIPBOARD_MIME)) {
            const payloadBlob = await item.getType(FILMLANE_CLIPBOARD_MIME)
            const payloadText = await payloadBlob.text()
            const parsed = JSON.parse(payloadText) as unknown
            if (isValidClipboardPayload(parsed) && parsed.hash === hashText(parsed.plainText)) {
              if (parsed.blocks && parsed.blocks.length > 0) {
                this.importStructuredBlocks(parsed.blocks, 'insert')
                return true
              }

              if (parsed.plainText.trim()) {
                await this.importClassifiedText(parsed.plainText, 'insert')
                return true
              }
            }
          }

          if (item.types.includes('text/plain')) {
            const plainBlob = await item.getType('text/plain')
            const text = await plainBlob.text()
            if (text.trim()) {
              await this.importClassifiedText(text, 'insert')
              return true
            }
          }
        }
      }
    } catch {
      // fallback to readText below.
    }

    if (typeof navigator.clipboard.readText !== 'function') return false

    const text = await navigator.clipboard.readText()
    if (!text.trim()) return false

    await this.importClassifiedText(text, 'insert')
    return true
  }

  destroy(): void {
    this.editor.off('update', this.handleEditorUpdate)
    this.editor.off('selectionUpdate', this.handleSelectionUpdate)
    this.editor.off('transaction', this.handleSelectionUpdate)
    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', this.handleWindowResize)
    }
    this.resizeObserver?.disconnect()
    this.resizeObserver = null
    this.paginationObserver?.disconnect()
    this.paginationObserver = null
    if (typeof window !== 'undefined' && this.characterWidowFixRaf !== null) {
      window.cancelAnimationFrame(this.characterWidowFixRaf)
      this.characterWidowFixRaf = null
    }
    this.editor.destroy()
  }

  private readonly handleEditorUpdate = (): void => {
    this.refreshPageModel()
    this.scheduleCharacterWidowFix()
    this.emitState()
    this.props.onContentChange?.(this.getAllText())
  }

  private readonly handleSelectionUpdate = (): void => {
    const current = this.getCurrentFormat()
    this.props.onFormatChange?.(current)
  }

  private readonly handleWindowResize = (): void => {
    this.refreshPageModel()
    this.scheduleCharacterWidowFix()
    this.emitState()
  }

  private bindPageModelObservers(): void {
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', this.handleWindowResize)
    }

    if (typeof ResizeObserver === 'undefined') return

    const attachObserver = (): void => {
      const editorRoot = this.body.querySelector<HTMLElement>('.filmlane-prosemirror-root, .ProseMirror')
      if (!editorRoot) return

      this.applyLockedEditorTypography(editorRoot)
      this.resizeObserver?.disconnect()
      this.resizeObserver = new ResizeObserver(() => {
        this.refreshPageModel()
        this.scheduleCharacterWidowFix()
        this.emitState()
      })
      this.resizeObserver.observe(editorRoot)
    }

    attachObserver()
    window.setTimeout(attachObserver, 0)

    if (typeof MutationObserver === 'undefined') return

    this.paginationObserver?.disconnect()
    this.paginationObserver = new MutationObserver(() => {
      if (this.applyingCharacterWidowFix) return
      const editorRoot = this.body.querySelector<HTMLElement>('.filmlane-prosemirror-root, .ProseMirror')
      if (editorRoot) {
        this.applyLockedEditorTypography(editorRoot)
      }
      this.refreshPageModel()
      this.scheduleCharacterWidowFix()
      this.emitState()
    })
    this.paginationObserver.observe(this.body, {
      childList: true,
      subtree: true,
    })
  }

  private applyLockedLayoutMetrics(sheet: HTMLDivElement): void {
    sheet.style.setProperty('--page-width', `${PAGE_WIDTH_PX}px`)
    sheet.style.setProperty('--page-height', `${PAGE_HEIGHT_PX}px`)
    sheet.style.setProperty('--page-header-height', '77px')
    sheet.style.setProperty('--page-footer-height', `${FOOTER_HEIGHT_PX}px`)
    sheet.style.setProperty('--page-margin-top', `${PAGE_MARGIN_TOP_PX}px`)
    sheet.style.setProperty('--page-margin-bottom', `${PAGE_MARGIN_BOTTOM_PX}px`)
    sheet.style.setProperty('--page-margin-left', `${PAGE_MARGIN_LEFT_PX}px`)
    sheet.style.setProperty('--page-margin-right', `${PAGE_MARGIN_RIGHT_PX}px`)
    applyEditorFormatStyleVariables(sheet.style)
  }

  private applyLockedEditorTypography(target: HTMLElement): void {
    target.style.setProperty('font-family', LOCKED_EDITOR_FONT_FAMILY, 'important')
    target.style.setProperty('font-size', LOCKED_EDITOR_FONT_SIZE, 'important')
    target.style.setProperty('line-height', LOCKED_EDITOR_LINE_HEIGHT, 'important')
    target.style.setProperty('direction', 'rtl')
    target.style.setProperty('font-weight', '700')
  }

  private measurePageEstimate(): number {
    const editorRoot = this.body.querySelector<HTMLElement>('.filmlane-prosemirror-root, .ProseMirror')
    if (!editorRoot) return 1

    const pageBodyHeight = Math.max(1, CONTENT_HEIGHT_PX)
    const contentHeight = Math.max(1, editorRoot.scrollHeight)
    return Math.max(1, Math.ceil(contentHeight / pageBodyHeight))
  }

  private getPagesFromExtensionStorage(): number | null {
    const storage = this.editor.storage as { pages?: { getPageCount?: () => number } }
    const pages = storage.pages?.getPageCount?.()
    if (typeof pages !== 'number' || !Number.isFinite(pages)) return null
    return Math.max(1, Math.floor(pages))
  }

  private refreshPageModel(force = false): void {
    const pagesFromStorage = this.getPagesFromExtensionStorage()
    const nextPages =
      pagesFromStorage ??
      (this.hasPagesExtension ? this.estimatedPages : this.measurePageEstimate())

    if (!force && nextPages === this.estimatedPages) return

    this.estimatedPages = nextPages
  }

  private scheduleCharacterWidowFix(): void {
    if (typeof window === 'undefined') return
    if (this.characterWidowFixRaf !== null) {
      window.cancelAnimationFrame(this.characterWidowFixRaf)
    }

    this.characterWidowFixRaf = window.requestAnimationFrame(() => {
      this.characterWidowFixRaf = null
      this.applyCharacterWidowFix()
    })
  }

  private applyCharacterWidowFix(): void {
    if (this.applyingCharacterWidowFix) return

    const editorRoot = this.body.querySelector<HTMLElement>('.filmlane-prosemirror-root, .ProseMirror')
    if (!editorRoot) return

    // ── 1. مسح جميع الإصلاحات السابقة لإعادة التخطيط لحالته الطبيعية ──
    const previouslyFixed = editorRoot.querySelectorAll<HTMLElement>('[data-character-widow-fix]')
    for (const el of previouslyFixed) {
      const prop = el.getAttribute('data-character-widow-fix') || 'margin-top'
      el.style.removeProperty(prop)
      el.removeAttribute('data-character-widow-fix')
    }

    // فرض إعادة تدفق متزامنة لضمان دقة الإحداثيات بعد المسح
    void editorRoot.offsetHeight

    // ── 2. تجميع جميع عناصر كتل المحتوى ──
    const allBlocks = Array.from(
      editorRoot.querySelectorAll<HTMLElement>('[data-type]')
    )
    if (allBlocks.length === 0) return

    // ── 3. كشف عناصر الشخصية "اليتيمة" (المعزولة في أسفل الصفحة) ──
    const pagesStorage = this.editor.storage as {
      pages?: { getPageForPosition?: (pos: number) => number }
    }
    const getPageFn = pagesStorage.pages?.getPageForPosition

    let hasAdjustment = false

    for (let i = 0; i < allBlocks.length; i += 1) {
      const current = allBlocks[i]
      if (current.getAttribute('data-type') !== 'character') continue

      // إيجاد حاوي الصفحة لعنصر الشخصية هذا
      const page = current.closest('.tiptap-page')
      if (!page) continue

      const charRect = current.getBoundingClientRect()
      const footer = page.querySelector('.tiptap-page-footer')
      const contentBottom = footer
        ? footer.getBoundingClientRect().top
        : page.getBoundingClientRect().bottom
      const spaceBelow = contentBottom - charRect.bottom

      // الكتلة السابقة والتالية بترتيب المستند
      const prev = i > 0 ? allBlocks[i - 1] : null
      const next = i + 1 < allBlocks.length ? allBlocks[i + 1] : null

      let isWidow = false

      // ── أولاً: الفحص الهندسي ──
      // إذا كانت المساحة المتبقية في الصفحة بعد الشخصية أقل من
      // 1.5 ضعف ارتفاع السطر، فلا مكان للحوار → الشخصية يتيمة.
      // نستخدم 1.5 × الارتفاع لضمان مساحة كافية لسطر حوار واحد على الأقل.
      if (spaceBelow >= 0 && spaceBelow < charRect.height * 1.5) {
        isWidow = true
      }

      // ── ثانياً: واجهة برمجة امتداد الصفحات ──
      if (
        !isWidow &&
        next &&
        typeof getPageFn === 'function'
      ) {
        try {
          const p1 = getPageFn(this.editor.view.posAtDOM(current, 0))
          const p2 = getPageFn(this.editor.view.posAtDOM(next, 0))
          if (p1 !== p2) isWidow = true
        } catch { /* fall through to DOM method */ }
      }

      // ── TERTIARY: DOM page containers ──
      if (!isWidow && next) {
        const nextPage = next.closest('.tiptap-page')
        if (page && nextPage && page !== nextPage) isWidow = true
      }

      if (!isWidow) continue

      // ── 4. دفع الشخصية لتجاوز منطقة محتوى الصفحة الحالية ──
      // لمنع فجوة بصرية كبيرة أعلى الصفحة التالية، نفضّل إضافة
      // `margin-bottom` للعنصر السابق في نفس الصفحة. إذا تعذّر ذلك،
      // نرجع لإضافة `margin-top` على عنصر الشخصية نفسه.
      const prevPage = prev ? prev.closest('.tiptap-page') : null
      const effectiveSpaceBelow = Math.max(0, spaceBelow)

      let pushTarget = current
      let targetProp = 'margin-top'
      let pushAmount = Math.ceil(effectiveSpaceBelow + charRect.height) + 4

      if (prev && prevPage === page) {
        pushTarget = prev
        targetProp = 'margin-bottom'
        // يكفي دفع الحافة السفلية للعنصر الحالي لتجاوز حد الصفحة
        pushAmount = Math.ceil(effectiveSpaceBelow) + 4
      }

      pushTarget.style.setProperty(targetProp, `${pushAmount}px`, 'important')
      pushTarget.setAttribute('data-character-widow-fix', targetProp)
      hasAdjustment = true
    }

    if (!hasAdjustment) return

    // ── 5. حارس: إطارا رسوم متحركة مزدوجان لإتمام إعادة تدفق امتداد الصفحات قبل إعادة الفحص ──
    this.applyingCharacterWidowFix = true
    if (typeof window !== 'undefined') {
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          this.applyingCharacterWidowFix = false
        })
      })
    } else {
      this.applyingCharacterWidowFix = false
    }
  }

  private emitState(): void {
    const text = this.getAllText()
    const words = text.trim().length > 0 ? text.trim().split(/\s+/).length : 0
    const characters = text.replace(/\s+/g, '').length
    const pages = this.estimatedPages

    const html = this.getAllHtml()
    const scenes = (html.match(/data-type="scene-header-top-line"|data-type="scene-header-3"/g) ?? []).length

    const stats: DocumentStats = {
      words,
      characters,
      pages,
      scenes,
    }

    this.props.onStatsChange?.(stats)
    this.props.onFormatChange?.(this.getCurrentFormat())
  }
}
