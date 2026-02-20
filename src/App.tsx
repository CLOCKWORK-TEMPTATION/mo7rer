import React, { useEffect, useRef, useState } from 'react'
import {
  Film,
  Download,
  Upload,
  Save,
  Info,
  Undo2,
  Redo2,
  Bold,
  Italic,
  AlignRight,
  AlignCenter,
  Stethoscope,
  Lightbulb,
  MessageSquare,
  User,
  Search,
  FileText,
  List,
  BookOpen,
  Settings,
  Sparkles,
  ChevronLeft,
  Printer,
  FileCode,
} from 'lucide-react'
import { EditorArea } from './components/editor/EditorArea'
import type { DocumentStats, FileImportMode } from './components/editor/editor-area.types'
import { HoverBorderGradient } from './components/ui/hover-border-gradient'
import { SCREENPLAY_ELEMENTS } from './editor'
import { type ElementType, isElementType } from './extensions/classification-types'
import { toast } from './hooks'
import { ACCEPTED_FILE_EXTENSIONS } from './types'
import { buildFileOpenPipelineAction, extractImportedFile, pickImportFile } from './utils/file-import'
import { logger } from './utils/logger'

type MenuActionId =
  | 'new-file'
  | 'open-file'
  | 'insert-file'
  | 'save-file'
  | 'print-file'
  | 'export-html'
  | 'undo'
  | 'redo'
  | 'copy'
  | 'cut'
  | 'paste'
  | 'select-all'
  | 'bold'
  | 'italic'
  | 'underline'
  | 'about'
  | `format:${string}`

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

interface MenuSection {
  label: string
  items: readonly { label: string; actionId: MenuActionId }[]
}

const MENU_SECTIONS: readonly MenuSection[] = [
  {
    label: 'ملف',
    items: [
      { label: 'مستند جديد', actionId: 'new-file' },
      { label: 'فتح...', actionId: 'open-file' },
      { label: 'إدراج ملف...', actionId: 'insert-file' },
      { label: 'حفظ', actionId: 'save-file' },
      { label: 'طباعة', actionId: 'print-file' },
      { label: 'تصدير HTML', actionId: 'export-html' },
    ],
  },
  {
    label: 'تعديل',
    items: [
      { label: 'تراجع', actionId: 'undo' },
      { label: 'إعادة', actionId: 'redo' },
      { label: 'قص', actionId: 'cut' },
      { label: 'نسخ', actionId: 'copy' },
      { label: 'لصق', actionId: 'paste' },
      { label: 'تحديد الكل', actionId: 'select-all' },
    ],
  },
  {
    label: 'إدراج',
    items: [
      { label: 'مشهد جديد', actionId: 'format:sceneHeaderTopLine' },
      { label: 'حدث/وصف', actionId: 'format:action' },
      { label: 'حوار', actionId: 'format:dialogue' },
    ],
  },
  {
    label: 'تنسيق',
    items: [
      { label: 'عريض', actionId: 'bold' },
      { label: 'مائل', actionId: 'italic' },
      { label: 'تحته خط', actionId: 'underline' },
    ],
  },
  {
    label: 'أدوات',
    items: [
      { label: 'فحص تلقائي', actionId: 'about' },
      { label: 'إعادة تصنيف', actionId: 'about' },
    ],
  },
  {
    label: 'مساعدة',
    items: [{ label: 'عن المحرر', actionId: 'about' }],
  },
]

/* ── Toolbar button config ── */
interface DockButtonItem {
  actionId: MenuActionId
  icon: React.ElementType
  title: string
  colorClass?: string
}

const DOCK_BUTTONS: readonly DockButtonItem[] = [
  { actionId: 'about', icon: Info, title: 'معلومات' },
  { actionId: 'undo', icon: Undo2, title: 'تراجع' },
  { actionId: 'redo', icon: Redo2, title: 'إعادة' },
  { actionId: 'italic', icon: Italic, title: 'مائل', colorClass: 'text-violet-400' },
  { actionId: 'bold', icon: Bold, title: 'عريض', colorClass: 'text-teal-400' },
  { actionId: 'open-file', icon: Upload, title: 'فتح ملف', colorClass: 'text-amber-400' },
  { actionId: 'insert-file', icon: Film, title: 'إدراج ملف', colorClass: 'text-rose-400' },
  { actionId: 'save-file', icon: Save, title: 'حفظ', colorClass: 'text-sky-400' },
  { actionId: 'print-file', icon: Printer, title: 'طباعة' },
  { actionId: 'export-html', icon: Download, title: 'تصدير', colorClass: 'text-emerald-400' },
  { actionId: 'about', icon: Stethoscope, title: 'فحص', colorClass: 'text-pink-400' },
  { actionId: 'about', icon: Lightbulb, title: 'اقتراحات', colorClass: 'text-yellow-300' },
  { actionId: 'about', icon: MessageSquare, title: 'ملاحظات' },
  { actionId: 'export-html', icon: FileCode, title: 'تصدير HTML', colorClass: 'text-cyan-400' },
]

/* ── Sidebar sections config ── */
const SIDEBAR_SECTIONS = [
  { id: 'docs', label: 'المستندات الأخيرة', icon: FileText, items: ['سيناريو فيلم.docx', 'مسودة الحلقة الأولى.docx', 'مشاهد مُصنفة.txt'] },
  { id: 'projects', label: 'المشاريع', icon: List, items: ['فيلم الرحلة', 'مسلسل الحارة', 'ورشة أفان تيتر'] },
  { id: 'library', label: 'المكتبة', icon: BookOpen, items: ['قوالب المشاهد', 'الشخصيات', 'الملاحظات'] },
  { id: 'settings', label: 'الإعدادات', icon: Settings, items: [] },
] as const

export function App(): React.JSX.Element {
  const editorMountRef = useRef<HTMLDivElement | null>(null)
  const editorAreaRef = useRef<EditorArea | null>(null)

  const [stats, setStats] = useState<DocumentStats>({ pages: 1, words: 0, characters: 0, scenes: 0 })
  const [currentFormat, setCurrentFormat] = useState<ElementType | null>(null)
  const [activeMenu, setActiveMenu] = useState<string | null>(null)
  const [openSidebarItem, setOpenSidebarItem] = useState<string | null>(null)

  /* ── Mount/destroy the EditorArea exactly once ── */
  useEffect(() => {
    const mount = editorMountRef.current
    if (!mount) return

    const editorArea = new EditorArea({
      mount,
      onStatsChange: (nextStats) => setStats(nextStats),
      onFormatChange: (format) => setCurrentFormat(format),
    })
    editorAreaRef.current = editorArea

    return () => {
      editorArea.destroy()
      editorAreaRef.current = null
    }
  }, [])

  /* ── Close menus on outside click ── */
  useEffect(() => {
    const closeMenus = (): void => setActiveMenu(null)
    document.addEventListener('click', closeMenus)
    return () => document.removeEventListener('click', closeMenus)
  }, [])

  /* ── Global keyboard shortcuts ── */
  useEffect(() => {
    const handleGlobalShortcut = (event: KeyboardEvent): void => {
      if (!(event.ctrlKey || event.metaKey)) return
      const area = editorAreaRef.current
      if (!area) return

      const key = event.key.toLowerCase()

      if (key in SHORTCUT_FORMAT_BY_DIGIT) {
        event.preventDefault()
        area.setFormat(SHORTCUT_FORMAT_BY_DIGIT[key])
        return
      }

      switch (key) {
        case 's':
          event.preventDefault()
          void handleMenuAction('save-file')
          break
        case 'o':
          event.preventDefault()
          void handleMenuAction('open-file')
          break
        case 'n':
          event.preventDefault()
          void handleMenuAction('new-file')
          break
        case 'z':
          event.preventDefault()
          area.runCommand('undo')
          break
        case 'y':
          event.preventDefault()
          area.runCommand('redo')
          break
        case 'b':
          event.preventDefault()
          area.runCommand('bold')
          break
        case 'i':
          event.preventDefault()
          area.runCommand('italic')
          break
        case 'u':
          event.preventDefault()
          area.runCommand('underline')
          break
        default:
          break
      }
    }

    document.addEventListener('keydown', handleGlobalShortcut)
    return () => document.removeEventListener('keydown', handleGlobalShortcut)
  }, [])

  /* ── File operations ── */
  const openFile = async (mode: FileImportMode): Promise<void> => {
    const area = editorAreaRef.current
    if (!area) return

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
        area.importStructuredBlocks(action.blocks, mode)
      } else {
        await area.importClassifiedText(action.text, mode)
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

  const saveHtml = (fileName = 'screenplay.html'): void => {
    const area = editorAreaRef.current
    if (!area) return

    const html = area.getAllHtml().trim()
    if (!html) {
      toast({ title: 'لا يوجد محتوى', description: 'اكتب شيئًا أولًا قبل الحفظ.', variant: 'destructive' })
      return
    }
    const fullDoc = buildFullHtmlDocument(html)
    downloadTextFile(fileName, fullDoc, 'text/html;charset=utf-8')
    toast({ title: 'تم الحفظ', description: `تم تصدير الملف ${fileName}.` })
  }

  /* ── Menu action dispatcher ── */
  const handleMenuAction = async (actionId: MenuActionId): Promise<void> => {
    const area = editorAreaRef.current
    if (!area) return

    setActiveMenu(null)

    if (actionId.startsWith('format:')) {
      const maybeFormat = actionId.replace('format:', '')
      if (isElementType(maybeFormat)) {
        area.setFormat(maybeFormat)
      }
      return
    }

    switch (actionId) {
      case 'new-file':
        area.clear()
        toast({ title: 'مستند جديد', description: 'تم إنشاء مستند فارغ.' })
        break
      case 'open-file':
        await openFile('replace')
        break
      case 'insert-file':
        await openFile('insert')
        break
      case 'save-file':
        saveHtml()
        break
      case 'print-file':
        window.print()
        break
      case 'export-html':
        saveHtml('screenplay-export.html')
        break
      case 'undo':
      case 'redo':
      case 'bold':
      case 'italic':
      case 'underline':
        area.runCommand(actionId)
        break
      case 'copy':
        document.execCommand('copy')
        break
      case 'cut':
        document.execCommand('cut')
        break
      case 'paste': {
        try {
          const text = navigator.clipboard?.readText ? await navigator.clipboard.readText() : ''
          if (text.trim()) {
            await area.importClassifiedText(text, 'insert')
            toast({ title: 'تم اللصق', description: 'تم تمرير النص عبر المصنف وإدراجه.' })
            break
          }
          document.execCommand('paste')
        } catch {
          document.execCommand('paste')
        }
        break
      }
      case 'select-all':
        area.editor.commands.selectAll()
        break
      case 'about':
        toast({
          title: 'أفان تيتر',
          description: 'واجهة Aceternity + محرك تصنيف Tiptap مفعلين معًا.',
        })
        break
      default:
        break
    }
  }

  /* ──────────────────────── JSX ──────────────────────── */
  return (
    <div className="selection:bg-teal-500/30 flex h-screen flex-col overflow-hidden bg-[#0a0f0d] font-['Cairo'] text-neutral-200" dir="rtl">
      {/* Background effects */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute inset-0 bg-[#0a0f0d]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808008_1px,transparent_1px),linear-gradient(to_bottom,#80808008_1px,transparent_1px)] bg-[size:24px_24px]" />
        <div className="absolute left-1/2 top-[10%] -translate-x-1/2 h-[600px] w-[600px] rounded-full bg-[#029784] opacity-[0.07] blur-[150px]" />
        <div className="absolute bottom-[5%] right-[5%] h-[400px] w-[400px] rounded-full bg-[#40a5b3] opacity-[0.04] blur-[120px]" />
      </div>

      {/* ── Header ── */}
      <header className="relative z-40 flex h-[52px] flex-shrink-0 items-center justify-between border-b border-white/[0.06] bg-[#0d1210]/80 px-5 backdrop-blur-2xl">
        {/* Right side: Brand + Nav */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3.5 py-1.5">
            <span className="h-2 w-2 rounded-full bg-[#029784] shadow-[0_0_6px_rgba(2,151,132,0.5)]" />
            <span className="bg-gradient-to-l from-[#029784] to-[#5eead4] bg-clip-text text-lg font-bold text-transparent">أفان تيتر</span>
          </div>

          <nav className="relative flex items-center gap-0.5 rounded-full border border-white/[0.06] bg-white/[0.02] p-1 backdrop-blur-md">
            {MENU_SECTIONS.map((section) => (
              <div
                key={section.label}
                className="relative"
                onClick={(event) => { event.stopPropagation() }}
              >
                <button
                  className={`rounded-full px-3.5 py-1 text-[13px] font-medium transition-all ${
                    activeMenu === section.label
                      ? 'bg-white/[0.08] text-white'
                      : 'text-neutral-400 hover:bg-white/[0.04] hover:text-neutral-200'
                  }`}
                  onClick={() => setActiveMenu((prev) => (prev === section.label ? null : section.label))}
                >
                  {section.label}
                </button>

                {activeMenu === section.label && (
                  <div className="absolute right-0 top-full z-50 mt-2 w-48 overflow-hidden rounded-xl border border-white/[0.08] bg-[#131a17]/95 p-1 shadow-[0_20px_60px_-10px_rgba(0,0,0,0.8)] backdrop-blur-2xl">
                    {section.items.map((item) => (
                      <button
                        key={`${section.label}-${item.label}`}
                        onClick={() => void handleMenuAction(item.actionId)}
                        className="flex w-full items-center rounded-lg px-3 py-2 text-right text-[13px] text-neutral-400 transition-colors hover:bg-white/[0.06] hover:text-white"
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </nav>
        </div>

        {/* Left side: Status + User + Edition badge */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 rounded-full border border-[#029784]/25 bg-[#029784]/[0.08] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-[#029784]">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#029784]" />
            Online
          </div>
          <div className="flex h-8 w-8 items-center justify-center rounded-full border border-white/[0.08] bg-gradient-to-br from-neutral-800 to-neutral-700">
            <User className="h-4 w-4 text-neutral-300" />
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5">
            <span className="bg-gradient-to-l from-[#029784] to-[#5eead4] bg-clip-text text-lg font-bold text-transparent">النسخة</span>
            <span className="h-2 w-2 rounded-full bg-[#029784] shadow-[0_0_6px_rgba(2,151,132,0.5)]" />
          </div>
        </div>
      </header>

      {/* ── Main area ── */}
      <div className="relative z-10 flex flex-1 overflow-hidden">
        {/* ── Sidebar ── */}
        <aside className="hidden w-64 flex-col p-4 xl:flex">
          <div className="flex h-full w-full flex-col items-stretch rounded-2xl border border-white/[0.06] bg-[#0d1210]/60 p-3.5 backdrop-blur-xl">
            {/* Search */}
            <div className="mb-5">
              <div className="flex w-full items-center gap-2 rounded-xl border border-white/[0.06] bg-black/30 px-3 py-2">
                <Search className="h-3.5 w-3.5 text-neutral-600" />
                <input
                  type="text"
                  placeholder="بحث..."
                  className="w-full border-none bg-transparent text-[13px] text-white placeholder:text-neutral-600 focus:outline-none"
                />
                <kbd className="rounded border border-white/[0.08] bg-white/[0.04] px-1 py-0.5 text-[10px] text-neutral-600">K</kbd>
              </div>
            </div>

            {/* Sections */}
            <div className="space-y-0.5">
              {SIDEBAR_SECTIONS.map((section) => {
                const SIcon = section.icon
                return (
                  <div key={section.id}>
                    <button
                      className="group flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-neutral-400 transition-all hover:bg-white/[0.04] hover:text-white"
                      onClick={() => setOpenSidebarItem((prev) => (prev === section.id ? null : section.id))}
                    >
                      <SIcon className="h-[18px] w-[18px] text-neutral-500 transition-colors group-hover:text-[#029784]" />
                      <span className="flex-1 text-right text-[13px] font-medium">{section.label}</span>
                      {section.items.length > 0 && (
                        <ChevronLeft className={`h-3.5 w-3.5 text-neutral-600 transition-transform ${openSidebarItem === section.id ? '-rotate-90' : ''}`} />
                      )}
                    </button>
                    {openSidebarItem === section.id && section.items.length > 0 && (
                      <div className="mt-0.5 space-y-0.5 pr-4">
                        {section.items.map((item) => (
                          <button
                            key={`${section.id}-${item}`}
                            className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-[12px] text-neutral-500 transition-colors hover:bg-white/[0.04] hover:text-neutral-300"
                          >
                            <span className="h-1 w-1 rounded-full bg-neutral-700" />
                            {item}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* AI Focus card */}
            <div className="mt-auto">
              <div className="flex w-full flex-col items-start rounded-2xl border border-[#029784]/20 bg-gradient-to-br from-[#029784]/[0.08] to-[#40a5b3]/[0.04] p-3.5">
                <Sparkles className="mb-1.5 h-5 w-5 text-[#029784]" />
                <p className="text-[11px] font-light leading-relaxed text-neutral-500">تم تفعيل وضع التركيز الذكي. استمتع بتجربة كتابة خالية من المشتتات.</p>
              </div>
            </div>
          </div>
        </aside>

        {/* ── Editor + Toolbar ── */}
        <main className="relative flex flex-1 flex-col overflow-hidden">
          {/* Floating dock toolbar */}
          <div className="pointer-events-none absolute left-0 right-0 top-0 z-40 flex justify-center pt-3">
            <div className="pointer-events-auto">
              <div className="flex h-12 items-center gap-1 rounded-2xl border border-white/[0.08] bg-[#0d1210]/90 px-2.5 shadow-[0_8px_30px_rgba(0,0,0,0.4)] backdrop-blur-2xl">
                {DOCK_BUTTONS.map((button, index) => {
                  const BIcon = button.icon
                  return (
                    <React.Fragment key={`${button.title}-${index}`}>
                      <button
                        className={`group flex h-8 w-8 items-center justify-center rounded-lg transition-all hover:bg-white/[0.08] active:scale-95 ${button.colorClass || 'text-neutral-500 hover:text-neutral-200'}`}
                        title={button.title}
                        onClick={() => void handleMenuAction(button.actionId)}
                      >
                        <BIcon className="h-4 w-4" strokeWidth={1.75} />
                      </button>
                      {(index === 0 || index === 2 || index === 4 || index === 6 || index === 9 || index === 11) && (
                        <div className="mx-0.5 h-4 w-px bg-white/[0.06]" />
                      )}
                    </React.Fragment>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Editor content area */}
          <div className="scrollbar-none flex flex-1 justify-center overflow-y-auto p-8 pt-20">
            <div className="relative -mt-4 w-full max-w-[850px] pb-20">
              <div ref={editorMountRef} className="editor-area screenplay-container" />
            </div>
          </div>
        </main>
      </div>

      {/* ── Footer ── */}
      <footer className="relative z-40 flex-shrink-0 border-t border-white/[0.06] bg-[#0d1210]/80 px-4 py-1 text-[11px] backdrop-blur-2xl" style={{ direction: 'rtl' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 text-neutral-600">
            <span>{stats.pages} صفحة</span>
            <span className="hidden sm:inline">{stats.words} كلمة</span>
            <span className="hidden md:inline">{stats.characters} حرف</span>
            <span className="hidden sm:inline">{stats.scenes} مشهد</span>
          </div>
          <div className="flex items-center gap-2 text-neutral-600">
            <span>{currentFormat ? FORMAT_LABEL_BY_TYPE[currentFormat] : '—'}</span>
          </div>
        </div>
      </footer>

      {/* Screen reader content */}
      <div className="sr-only">
        {SCREENPLAY_ELEMENTS.map((element) => (
          <span key={element.name}>{element.label}</span>
        ))}
      </div>
    </div>
  )
}
