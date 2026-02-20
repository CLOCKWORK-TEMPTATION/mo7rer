import { createScreenplayEditor, SCREENPLAY_ELEMENTS } from '../../editor'
import { ensureCharacterTrailingColon } from '../../extensions/character'
import { classifyText, classifyTextWithAgentReview } from '../../extensions/paste-classifier'
import { isElementType, type ClassifiedDraft, type ElementType } from '../../extensions/classification-types'
import { CONTENT_HEIGHT_PX, FOOTER_HEIGHT_PX, HEADER_HEIGHT_PX, PAGE_HEIGHT_PX } from '../../constants/page'
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
  private readonly sheet: HTMLDivElement
  private readonly body: HTMLDivElement
  private readonly overlays: HTMLDivElement
  private readonly pageNumber: HTMLDivElement
  private resizeObserver: ResizeObserver | null = null
  private estimatedPages = 1

  constructor(props: EditorAreaProps) {
    this.props = props

    const sheet = document.createElement('div')
    sheet.className = 'screenplay-sheet filmlane-sheet-paged'
    sheet.style.height = 'auto'
    sheet.style.overflow = 'hidden'
    sheet.style.minHeight = 'var(--page-height)'

    const overlays = document.createElement('div')
    overlays.className = 'filmlane-page-overlays'
    overlays.setAttribute('aria-hidden', 'true')

    const header = document.createElement('div')
    header.className = 'screenplay-sheet__header'

    const body = document.createElement('div')
    body.className = 'screenplay-sheet__body'

    const footer = document.createElement('div')
    footer.className = 'screenplay-sheet__footer'

    const pageNumber = document.createElement('div')
    pageNumber.className = 'screenplay-page-number'
    pageNumber.textContent = '1.'

    footer.appendChild(pageNumber)
    sheet.appendChild(overlays)
    sheet.appendChild(header)
    sheet.appendChild(body)
    sheet.appendChild(footer)

    props.mount.innerHTML = ''
    props.mount.appendChild(sheet)

    this.sheet = sheet
    this.body = body
    this.overlays = overlays
    this.pageNumber = pageNumber

    this.editor = createScreenplayEditor(body)

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
    this.editor.destroy()
  }

  private readonly handleEditorUpdate = (): void => {
    this.refreshPageModel()
    this.emitState()
    this.props.onContentChange?.(this.getAllText())
  }

  private readonly handleSelectionUpdate = (): void => {
    const current = this.getCurrentFormat()
    this.props.onFormatChange?.(current)
  }

  private readonly handleWindowResize = (): void => {
    this.refreshPageModel()
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

      this.resizeObserver?.disconnect()
      this.resizeObserver = new ResizeObserver(() => {
        this.refreshPageModel()
        this.emitState()
      })
      this.resizeObserver.observe(editorRoot)
    }

    attachObserver()
    window.setTimeout(attachObserver, 0)
  }

  private measurePageEstimate(): number {
    const editorRoot = this.body.querySelector<HTMLElement>('.filmlane-prosemirror-root, .ProseMirror')
    if (!editorRoot) return 1

    const pageBodyHeight = Math.max(1, CONTENT_HEIGHT_PX - 20)
    const contentHeight = Math.max(1, editorRoot.scrollHeight)
    return Math.max(1, Math.ceil(contentHeight / pageBodyHeight))
  }

  private renderPageOverlays(totalPages: number): void {
    this.overlays.innerHTML = ''
    const fragment = document.createDocumentFragment()

    for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
      const pageTop = PAGE_HEIGHT_PX * (pageNumber - 1)
      const pageBottom = PAGE_HEIGHT_PX * pageNumber

      if (pageNumber > 1) {
        const divider = document.createElement('div')
        divider.className = 'filmlane-page-divider'
        divider.style.top = `${pageTop}px`
        fragment.appendChild(divider)

        const headerBand = document.createElement('div')
        headerBand.className = 'filmlane-page-header-band'
        headerBand.style.top = `${pageTop}px`
        headerBand.style.height = `${HEADER_HEIGHT_PX}px`
        fragment.appendChild(headerBand)
      }

      const footerBand = document.createElement('div')
      footerBand.className = 'filmlane-page-footer-band'
      footerBand.style.top = `${pageBottom - FOOTER_HEIGHT_PX}px`
      footerBand.style.height = `${FOOTER_HEIGHT_PX}px`
      fragment.appendChild(footerBand)

      const marker = document.createElement('div')
      marker.className = 'filmlane-page-number-marker'
      marker.style.top = `${pageBottom - 58}px`
      marker.textContent = `${pageNumber}.`
      fragment.appendChild(marker)
    }

    this.overlays.appendChild(fragment)
  }

  private refreshPageModel(force = false): void {
    const nextPages = this.measurePageEstimate()
    if (!force && nextPages === this.estimatedPages) return

    this.estimatedPages = nextPages
    this.sheet.style.minHeight = `calc(var(--page-height) * ${this.estimatedPages})`
    this.renderPageOverlays(this.estimatedPages)
    this.pageNumber.textContent = `${this.estimatedPages}.`
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
