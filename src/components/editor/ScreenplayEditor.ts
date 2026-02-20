import { SCREENPLAY_ELEMENTS } from '../../editor'
import { gradients } from '../../constants'
import { isElementType, type ElementType } from '../../extensions/classification-types'
import { toast } from '../../hooks'
import { ACCEPTED_FILE_EXTENSIONS } from '../../types'
import { buildFileOpenPipelineAction, extractImportedFile, pickImportFile } from '../../utils/file-import'
import { logger } from '../../utils/logger'
import { ClassificationConfirmationDialog } from './ConfirmationDialog'
import { EditorArea } from './EditorArea'
import { EditorFooter } from './EditorFooter'
import type { HeaderActionId } from './EditorHeader'
import { EditorHeader } from './EditorHeader'
import { EditorSidebar } from './EditorSidebar'
import type { ToolbarActionId } from './EditorToolbar'
import { EditorToolbar } from './EditorToolbar'
import { createBackgroundRippleEffect, createNoiseBackground } from '../ui'

const SHORTCUT_FORMAT_BY_DIGIT: Record<string, ElementType> = {
  '0': 'basmala',
  '1': 'sceneHeaderTopLine',
  '2': 'sceneHeader3',
  '3': 'action',
  '4': 'character',
  '5': 'dialogue',
  '6': 'parenthetical',
  '7': 'transition',
}

const FORMAT_LABEL_BY_TYPE: Record<ElementType, string> = {
  basmala: 'بسملة',
  sceneHeaderTopLine: 'سطر رأس المشهد',
  sceneHeader3: 'رأس المشهد (3)',
  action: 'حدث / وصف',
  character: 'شخصية',
  dialogue: 'حوار',
  parenthetical: 'تعليمات حوار',
  transition: 'انتقال',
}

const SIDEBAR_SECTIONS = [
  {
    title: 'المستندات الأخيرة',
    icon: '📄',
    items: ['سيناريو فيلم.docx', 'مسودة الحلقة الأولى.docx', 'مشاهد مُصنفة.txt'],
  },
  {
    title: 'المشاريع',
    icon: '☰',
    items: ['فيلم الرحلة', 'مسلسل الحارة', 'ورشة أفان تيتر'],
  },
  {
    title: 'المكتبة',
    icon: '↥',
    items: ['قوالب المشاهد', 'الشخصيات', 'الملاحظات'],
  },
] as const

const buildFullHtmlDocument = (bodyHtml: string): string => `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>تصدير محرر السيناريو</title>
</head>
<body>
${bodyHtml}
</body>
</html>`

const downloadTextFile = (fileName: string, content: string, mimeType: string): void => {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

export class ScreenplayEditor {
  private readonly editorArea: EditorArea
  private readonly toolbar: EditorToolbar
  private readonly footer: EditorFooter

  constructor(root: HTMLElement) {
    root.innerHTML = ''
    root.className = 'filmlane-root'
    root.style.setProperty('--filmlane-brand-gradient', gradients.jungleFull)

    const background = document.createElement('div')
    background.className = 'filmlane-bg-grid'
    const noise = createNoiseBackground('filmlane-bg-noise')

    const header = new EditorHeader((actionId) => this.handleHeaderAction(actionId))
    const toolbar = new EditorToolbar((actionId) => this.handleToolbarAction(actionId))
    const sidebar = EditorSidebar.fromSections(SIDEBAR_SECTIONS)
    const footer = new EditorFooter()
    this.toolbar = toolbar
    this.footer = footer

    const main = document.createElement('div')
    main.className = 'filmlane-main'

    const panel = document.createElement('section')
    panel.className = 'filmlane-editor-panel'
    const ripple = createBackgroundRippleEffect({ rows: 10, cols: 12, cellSize: 56, className: 'filmlane-ripple' })
    const dock = document.createElement('div')
    dock.className = 'filmlane-toolbar-dock'

    const editorHost = document.createElement('div')
    editorHost.className = 'editor-area screenplay-container'

    this.editorArea = new EditorArea({
      mount: editorHost,
      onStatsChange: (stats) => footer.setStats(stats),
      onFormatChange: (format) => this.handleFormatChange(format),
    })

    const confirmationDialog = new ClassificationConfirmationDialog({
      onConfirm: () => undefined,
      onCancel: () => undefined,
    })

    panel.appendChild(ripple)
    dock.appendChild(toolbar.element)
    panel.appendChild(dock)
    panel.appendChild(editorHost)

    main.appendChild(sidebar.element)
    main.appendChild(panel)

    root.appendChild(background)
    root.appendChild(noise)
    root.appendChild(header.element)
    root.appendChild(main)
    root.appendChild(footer.element)
    root.appendChild(confirmationDialog.element)

    this.bindShortcuts()
    this.handleFormatChange(this.editorArea.getCurrentFormat())
  }

  private handleFormatChange(format: ElementType | null): void {
    this.toolbar.setCurrentFormat(format)
    this.footer.setCurrentFormatLabel(format ? FORMAT_LABEL_BY_TYPE[format] : '—')
  }

  private handleHeaderAction(actionId: HeaderActionId): void {
    switch (actionId) {
      case 'new-file':
        this.editorArea.clear()
        toast({ title: 'مستند جديد', description: 'تم إنشاء مستند فارغ.' })
        break
      case 'open-file':
        void this.openFile('replace')
        break
      case 'insert-file':
        void this.openFile('insert')
        break
      case 'save-file':
      case 'save-as-file':
        this.saveHtml()
        break
      case 'print-file':
        window.print()
        break
      case 'export-html':
        this.saveHtml('screenplay-export.html')
        break
      case 'copy':
        document.execCommand('copy')
        break
      case 'cut':
        document.execCommand('cut')
        break
      case 'paste':
        void this.pasteFromClipboard()
        break
      case 'select-all':
        this.editorArea.editor.commands.selectAll()
        break
      case 'about':
        toast({
          title: 'حول المحرر',
          description: 'أفان تيتر - محرر سيناريو عربي مبني على Tiptap.',
        })
        break
      case 'user-profile':
        toast({ title: 'الملف الشخصي', description: 'ميزة الملف الشخصي ستتوفر في الإصدار القادم.' })
        break
      case 'user-settings':
        toast({ title: 'الإعدادات', description: 'لوحة الإعدادات قيد الدمج.' })
        break
      case 'user-logout':
        toast({ title: 'تسجيل الخروج', description: 'لا توجد جلسة مستخدم مفعّلة في هذا الإصدار.' })
        break
      default:
        break
    }
  }

  private handleToolbarAction(actionId: ToolbarActionId): void {
    if (actionId.startsWith('format:')) {
      const maybeFormat = actionId.replace('format:', '')
      if (isElementType(maybeFormat)) {
        this.editorArea.setFormat(maybeFormat)
      }
      return
    }

    switch (actionId) {
      case 'open-file':
        void this.openFile('replace')
        break
      case 'insert-file':
        void this.openFile('insert')
        break
      case 'save-file':
        this.saveHtml()
        break
      case 'download-file':
        this.saveHtml('screenplay-export.html')
        break
      case 'upload-file':
        void this.openFile('insert')
        break
      case 'print-file':
        window.print()
        break
      case 'export-html':
        this.saveHtml('screenplay-export.html')
        break
      case 'undo':
      case 'redo':
      case 'bold':
      case 'italic':
      case 'underline':
        this.editorArea.runCommand(actionId)
        break
      case 'check':
        toast({ title: 'فحص', description: 'ميزة الفحص المتقدم قيد التفعيل.' })
        break
      case 'ideas':
        toast({ title: 'أفكار', description: 'مولد الأفكار سيتاح قريبًا.' })
        break
      case 'messages':
        toast({ title: 'رسائل', description: 'مركز الرسائل غير مفعل بعد.' })
        break
      case 'history':
        toast({ title: 'السجل', description: 'استعراض النسخ السابقة قيد التطوير.' })
        break
      case 'justify-right':
      case 'justify-center':
      case 'justify-left':
        toast({ title: 'تنسيق', description: 'المحاذاة متاحة بصريًا عبر عناصر السيناريو الحالية.' })
        break
      case 'help':
        this.showHelp()
        break
      case 'info':
        toast({
          title: 'معلومات',
          description: 'أفان تيتر - بيئة كتابة وتصنيف سيناريو عربي.',
        })
        break
      default:
        break
    }
  }

  private showHelp(): void {
    const shortcuts = SCREENPLAY_ELEMENTS.map((item) => `${item.shortcut}: ${item.label}`).join('\n')
    toast({
      title: 'الاختصارات',
      description: `Ctrl+S حفظ | Ctrl+O فتح | Ctrl+N جديد | ${shortcuts}`,
    })
  }

  private async openFile(mode: 'replace' | 'insert'): Promise<void> {
    const file = await pickImportFile(ACCEPTED_FILE_EXTENSIONS)
    if (!file) return

    try {
      const extraction = await extractImportedFile(file)
      const action = buildFileOpenPipelineAction(extraction, mode)

      if (action.kind === 'reject') {
        toast(action.toast)
        return
      }

      if (action.kind === 'import-structured-blocks') {
        this.editorArea.importStructuredBlocks(action.blocks, mode)
      } else {
        await this.editorArea.importClassifiedText(action.text, mode)
      }

      toast(action.toast)
      logger.info('File import pipeline completed', {
        scope: 'file-import',
        data: action.telemetry,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'حدث خطأ غير معروف أثناء فتح الملف.'
      toast({
        title: mode === 'replace' ? 'تعذر فتح الملف' : 'تعذر إدراج الملف',
        description: message,
        variant: 'destructive',
      })
      logger.error('File import pipeline failed', {
        scope: 'file-import',
        data: error,
      })
    }
  }

  private saveHtml(fileName = 'screenplay.html'): void {
    const html = this.editorArea.getAllHtml().trim()
    if (!html) {
      toast({ title: 'لا يوجد محتوى', description: 'اكتب شيئًا أولًا قبل الحفظ.', variant: 'destructive' })
      return
    }
    const fullDoc = buildFullHtmlDocument(html)
    downloadTextFile(fileName, fullDoc, 'text/html;charset=utf-8')
    toast({ title: 'تم الحفظ', description: `تم تصدير الملف ${fileName}.` })
  }

  private async pasteFromClipboard(): Promise<void> {
    if (!navigator.clipboard?.readText) {
      document.execCommand('paste')
      toast({ title: 'تنبيه', description: 'تم استخدام لصق المتصفح الافتراضي.' })
      return
    }

    const text = await navigator.clipboard.readText()
    if (!text.trim()) {
      toast({ title: 'الحافظة فارغة', description: 'لا يوجد نص للصق.', variant: 'destructive' })
      return
    }
    await this.editorArea.importClassifiedText(text, 'insert')
    toast({ title: 'تم اللصق', description: 'تم تمرير النص عبر المصنف وإدراجه.' })
  }

  private bindShortcuts(): void {
    document.addEventListener('keydown', this.handleGlobalShortcut)
  }

  destroy(): void {
    document.removeEventListener('keydown', this.handleGlobalShortcut)
    this.editorArea.destroy()
  }

  private readonly handleGlobalShortcut = (event: KeyboardEvent): void => {
    if (!(event.ctrlKey || event.metaKey)) return

    const key = event.key.toLowerCase()

    if (key in SHORTCUT_FORMAT_BY_DIGIT) {
      const format = SHORTCUT_FORMAT_BY_DIGIT[key]
      event.preventDefault()
      this.editorArea.setFormat(format)
      return
    }

    switch (key) {
      case 's':
        event.preventDefault()
        this.saveHtml()
        break
      case 'o':
        event.preventDefault()
        void this.openFile('replace')
        break
      case 'n':
        event.preventDefault()
        this.editorArea.clear()
        break
      case 'z':
        event.preventDefault()
        this.editorArea.runCommand('undo')
        break
      case 'y':
        event.preventDefault()
        this.editorArea.runCommand('redo')
        break
      case 'b':
        event.preventDefault()
        this.editorArea.runCommand('bold')
        break
      case 'i':
        event.preventDefault()
        this.editorArea.runCommand('italic')
        break
      case 'u':
        event.preventDefault()
        this.editorArea.runCommand('underline')
        break
      default:
        break
    }
  }

}

export const mountScreenplayEditor = (root: HTMLElement): ScreenplayEditor => new ScreenplayEditor(root)
