import { createScreenplayEditor, SCREENPLAY_ELEMENTS } from '../../editor'
import { ensureCharacterTrailingColon } from '../../extensions/character'
import { classifyText, classifyTextWithAgentReview } from '../../extensions/paste-classifier'
import { isElementType, type ClassifiedDraft, type ElementType } from '../../extensions/classification-types'
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
import { screenplayBlocksToHtml, type ScreenplayBlock } from '../../utils/file-import'
import type { DocumentStats, EditorAreaProps, EditorCommand, EditorHandle, FileImportMode } from './editor-area.types'

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

const classifiedLineToHtml = (item: ClassifiedDraft): string => {
  switch (item.type) {
    case 'sceneHeaderTopLine': {
      const h1 = escapeHtml(item.header1 ?? '')
      const h2 = escapeHtml(item.header2 ?? '')
      return `<div data-type="scene-header-top-line"><div data-type="scene-header-1">${h1}</div><div data-type="scene-header-2">${h2}</div></div>`
    }

    case 'character': {
      const text = escapeHtml(ensureCharacterTrailingColon(item.text))
      return `<div data-type="character">${text}</div>`
    }

    case 'sceneHeader3':
      return `<div data-type="scene-header-3">${escapeHtml(item.text)}</div>`

    case 'basmala':
      return `<div data-type="basmala">${escapeHtml(item.text)}</div>`

    case 'action':
      return `<div data-type="action">${escapeHtml(item.text)}</div>`

    case 'dialogue':
      return `<div data-type="dialogue">${escapeHtml(item.text)}</div>`

    case 'parenthetical':
      return `<div data-type="parenthetical">${escapeHtml(item.text)}</div>`

    case 'transition':
      return `<div data-type="transition">${escapeHtml(item.text)}</div>`

    default:
      return `<div data-type="action">${escapeHtml(item.text)}</div>`
  }
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

  runCommand = (command: EditorCommand): boolean => {
    switch (command) {
      case 'bold':
        return this.editor.chain().focus().toggleBold().run()
      case 'italic':
        return this.editor.chain().focus().toggleItalic().run()
      case 'underline':
        return this.editor.chain().focus().toggleUnderline().run()
      case 'undo': {
        const undo = (this.editor.commands as Record<string, unknown>).undo
        return typeof undo === 'function' ? (undo as () => boolean)() : false
      }
      case 'redo': {
        const redo = (this.editor.commands as Record<string, unknown>).redo
        return typeof redo === 'function' ? (redo as () => boolean)() : false
      }
      default:
        return false
    }
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
    let classified: ClassifiedDraft[]
    try {
      classified = await classifyTextWithAgentReview(text)
    } catch {
      classified = classifyText(text)
    }

    if (classified.length === 0) return

    const html = classified.map(classifiedLineToHtml).join('')

    if (mode === 'replace') {
      this.editor.commands.setContent(html)
    } else {
      this.editor.chain().focus().insertContent(html).run()
    }

    this.refreshPageModel(true)
    this.emitState()
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

    // ── 1. Clear all previous fixes so layout returns to its "natural" state ──
    const previouslyFixed = editorRoot.querySelectorAll<HTMLElement>('[data-character-widow-fix]')
    for (const el of previouslyFixed) {
      el.style.removeProperty('margin-top')
      el.removeAttribute('data-character-widow-fix')
    }

    // Force synchronous reflow so bounding-rects are accurate after clearing
    void editorRoot.offsetHeight

    // ── 2. Collect all content block elements (nested inside .tiptap-page containers) ──
    const allBlocks = Array.from(
      editorRoot.querySelectorAll<HTMLElement>('[data-type]')
    )
    if (allBlocks.length < 2) return

    // ── 3. Detect character elements split from their dialogue/parenthetical ──
    const pagesStorage = this.editor.storage as {
      pages?: { getPageForPosition?: (pos: number) => number }
    }
    const getPageFn = pagesStorage.pages?.getPageForPosition

    let hasAdjustment = false

    for (let i = 0; i < allBlocks.length - 1; i += 1) {
      const current = allBlocks[i]
      const next = allBlocks[i + 1]

      if (current.getAttribute('data-type') !== 'character') continue
      const nextType = next.getAttribute('data-type')
      if (nextType !== 'dialogue' && nextType !== 'parenthetical') continue

      // ── 3a. Check if they sit on different pages ──
      let isSplit = false

      // Method A: Pages extension API (most reliable)
      if (!isSplit && typeof getPageFn === 'function') {
        try {
          const p1 = getPageFn(this.editor.view.posAtDOM(current, 0))
          const p2 = getPageFn(this.editor.view.posAtDOM(next, 0))
          isSplit = p1 !== p2
        } catch { /* fall through to DOM method */ }
      }

      // Method B: DOM page containers
      if (!isSplit) {
        const currentPage = current.closest('.tiptap-page')
        const nextPage = next.closest('.tiptap-page')
        isSplit = !!(currentPage && nextPage && currentPage !== nextPage)
      }

      if (!isSplit) continue

      // ── 4. Calculate the push needed to move the character off its current page ──
      const page = current.closest('.tiptap-page')
      if (!page) continue

      const charRect = current.getBoundingClientRect()
      const footer = page.querySelector('.tiptap-page-footer')
      const contentBottom = footer
        ? footer.getBoundingClientRect().top
        : page.getBoundingClientRect().bottom
      const spaceBelow = contentBottom - charRect.bottom

      if (spaceBelow < 0) continue

      const pushAmount = Math.ceil(spaceBelow) + 2
      current.style.setProperty('margin-top', `${pushAmount}px`)
      current.setAttribute('data-character-widow-fix', '1')
      hasAdjustment = true
    }

    if (!hasAdjustment) return

    // ── 5. Guard: double-RAF so Pages extension reflow completes before we re-check ──
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
