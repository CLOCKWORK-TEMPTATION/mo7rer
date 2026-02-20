import React, { useEffect, useRef, useState } from 'react'
import {
  Download,
  Upload,
  Save,
  History,
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
  Clapperboard,
} from 'lucide-react'
import { EditorArea } from './components/editor/EditorArea'
import { HoverBorderGradient } from './components/ui/hover-border-gradient'
import type { DocumentStats, FileImportMode } from './components/editor/editor-area.types'
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

const BackgroundGrid = (): React.JSX.Element => (
  <div className="pointer-events-none fixed inset-0 z-0">
    <div className="absolute inset-0 bg-neutral-950 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]" />
    <div className="absolute left-0 right-0 top-0 -z-10 m-auto h-[310px] w-[310px] rounded-full bg-[#0F4C8A] opacity-20 blur-[100px]" />
    <div className="absolute bottom-0 right-0 -z-10 m-auto h-[310px] w-[310px] rounded-full bg-[#029784] opacity-20 blur-[100px]" />
  </div>
)

interface MenuSection {
  label: string
  items: readonly { label: string; actionId: MenuActionId }[]
}

const MENU_SECTIONS: readonly MenuSection[] = [
  {
    label: 'مـلــــف',
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
    label: 'تعديـــل',
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
    label: 'إضافـــــة',
    items: [
      { label: 'مشهد جديد', actionId: 'format:sceneHeaderTopLine' },
      { label: 'حدث/وصف', actionId: 'format:action' },
      { label: 'حوار', actionId: 'format:dialogue' },
    ],
  },
  {
    label: 'تنسيـــق',
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
}

const DOCK_BUTTONS: readonly DockButtonItem[] = [
  // Media/Export
  { actionId: 'about', icon: Clapperboard, title: 'تبديل التنسيق المباشر' },
  { actionId: 'export-html', icon: Download, title: 'تصدير PDF' },
  // Tools
  { actionId: 'about', icon: Stethoscope, title: 'تحليل السيناريو' },
  { actionId: 'about', icon: Lightbulb, title: 'اقتراحات الذكاء الاصطناعي' },
  // Actions
  { actionId: 'about', icon: MessageSquare, title: 'الملاحظات' },
  { actionId: 'about', icon: History, title: 'سجل التغييرات' },
  { actionId: 'open-file', icon: Upload, title: 'فتح ملف' },
  { actionId: 'save-file', icon: Save, title: 'حفظ الملف' },
  // Formatting
  { actionId: 'undo', icon: Undo2, title: 'تراجع' },
  { actionId: 'redo', icon: Redo2, title: 'إعادة' },
  { actionId: 'bold', icon: Bold, title: 'غامق' },
  { actionId: 'italic', icon: Italic, title: 'مائل' },
  { actionId: 'about', icon: AlignRight, title: 'محاذاة لليمين' },
  { actionId: 'about', icon: AlignCenter, title: 'توسيط' },
  // Info
  { actionId: 'about', icon: Info, title: 'مساعدة' },
]

interface DockIconButtonProps {
  icon: React.ElementType
  title: string
  onClick: () => void
}

function DockIconButton({ icon: Icon, title, onClick }: DockIconButtonProps): React.JSX.Element {
  return (
    <div className="relative z-10 flex h-10 w-10 items-center justify-center">
      <HoverBorderGradient
        as="button"
        onClick={onClick}
        title={title}
        containerClassName="h-full w-full rounded-full"
        className="flex h-full w-full items-center justify-center rounded-[inherit] bg-neutral-900/90 p-0 text-neutral-400 transition-all duration-200 hover:bg-neutral-800 hover:text-white active:scale-95"
        duration={1}
      >
        <Icon className="size-[18px]" strokeWidth={1.75} />
      </HoverBorderGradient>
    </div>
  )
}

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
    <div className="flex h-screen flex-col overflow-hidden bg-[var(--background)] font-['Cairo'] text-[var(--foreground)] selection:bg-[var(--brand)]/30" dir="rtl">
      <BackgroundGrid />

      {/* ── Header ── */}
      <header className="relative z-40 flex h-[60px] flex-shrink-0 items-center justify-between bg-[var(--card)]/80 px-7 backdrop-blur-2xl">
        {/* Right side: Brand + Nav */}
        <div className="flex items-center gap-3">
          <HoverBorderGradient
            as="div"
            duration={1}
            containerClassName="h-11 rounded-full"
            className="flex h-full items-center gap-1.5 rounded-[inherit] bg-neutral-950/80 p-1.5 backdrop-blur-2xl"
          >
            <HoverBorderGradient
              as="div"
              duration={1}
              containerClassName="h-full rounded-full"
              className="flex h-full items-center gap-2.5 rounded-[inherit] bg-neutral-900/90 px-5"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-[#0F4C8A] shadow-[0_0_6px_rgba(15,76,138,0.5)]" />
              <span className="bg-gradient-to-r from-[#0F4C8A]/60 to-[#0F4C8A] bg-clip-text text-[15px] font-bold text-transparent transition-all duration-300 group-hover:to-accent">أفان تيتر</span>
            </HoverBorderGradient>
          </HoverBorderGradient>

          <HoverBorderGradient
            as="div"
            duration={1}
            containerClassName="relative z-50 h-11 rounded-full"
            className="flex h-full items-center gap-1.5 rounded-[inherit] bg-neutral-950/80 p-1.5 backdrop-blur-2xl"
          >
            {MENU_SECTIONS.map((section) => (
              <div
                key={section.label}
                className="group relative h-full"
                onClick={(event) => { event.stopPropagation() }}
              >
                <HoverBorderGradient
                  as="button"
                  duration={1}
                  containerClassName="h-full rounded-full"
                  className={`flex h-full min-w-[72px] justify-center items-center rounded-[inherit] px-4 text-[13px] font-medium transition-all ${
                    activeMenu === section.label
                      ? 'bg-neutral-800 text-white'
                      : 'bg-neutral-900/90 text-neutral-400 hover:bg-neutral-800 group-hover:text-white'
                  }`}
                  onClick={() => setActiveMenu((prev) => (prev === section.label ? null : section.label))}
                >
                  {section.label}
                </HoverBorderGradient>

                {activeMenu === section.label && (
                  <div className="absolute right-0 top-full z-50 mt-2 w-48 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--popover)]/95 p-1 shadow-[0_20px_60px_-10px_rgba(0,0,0,0.8)] backdrop-blur-2xl">
                    {section.items.map((item) => (
                      <button
                        key={`${section.label}-${item.label}`}
                        onClick={() => void handleMenuAction(item.actionId)}
                        className="flex w-full items-center rounded-[var(--radius-md)] px-3 py-2 text-right text-[13px] text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)]/50 hover:text-[var(--foreground)]"
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </HoverBorderGradient>
        </div>

        {/* Left side: Status + User + Edition badge — shared container like nav */}
        <HoverBorderGradient
          as="div"
          duration={1}
          containerClassName="h-11 rounded-full"
          className="flex h-full items-center gap-1.5 rounded-[inherit] bg-neutral-950/80 p-1.5 backdrop-blur-2xl"
        >
          <HoverBorderGradient
            as="div"
            duration={1}
            containerClassName="h-full rounded-full"
            className="flex h-full items-center gap-2 rounded-[inherit] bg-neutral-900/90 px-4 text-[11px] font-bold uppercase tracking-wider text-ring"
          >
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ring" />
            Online
          </HoverBorderGradient>

          <HoverBorderGradient
            as="div"
            duration={1}
            containerClassName="h-full w-8 cursor-pointer rounded-full"
            className="flex h-full w-full items-center justify-center rounded-[inherit] bg-neutral-900/90 p-0"
          >
            <User className="size-4 text-neutral-300" />
          </HoverBorderGradient>

          <HoverBorderGradient
            as="div"
            duration={1}
            containerClassName="group h-full cursor-pointer rounded-full"
            className="flex h-full items-center gap-2.5 rounded-[inherit] bg-neutral-900/90 px-5 leading-none"
          >
            <span className="bg-gradient-to-r from-[#029784]/60 to-[#029784] bg-clip-text text-[15px] font-bold text-transparent transition-all duration-300 group-hover:to-[#40A5B3]">النسخة</span>
            <span className="flex h-1.5 w-1.5">
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#029784]" />
            </span>
          </HoverBorderGradient>
        </HoverBorderGradient>
      </header>

      {/* ── Main area ── */}
      <div className="relative z-10 flex flex-1 overflow-hidden">
        {/* ── Sidebar ── */}
        <aside className="hidden w-72 flex-col p-6 lg:flex">
          <HoverBorderGradient
            as="div"
            duration={1}
            containerClassName="h-full w-full rounded-3xl"
            className="flex h-full w-full flex-col items-stretch rounded-[inherit] bg-neutral-900/60 p-4 backdrop-blur-2xl"
          >
            {/* Search */}
            <div className="group relative mb-8">
              <HoverBorderGradient
                as="div"
                duration={1}
                containerClassName="w-full rounded-xl group"
                className="flex w-full items-center gap-2 rounded-[inherit] bg-neutral-900/90 px-3 py-3"
              >
                <Search className="size-4 text-[var(--muted-foreground)] transition-colors group-focus-within:text-[var(--brand)]" />
                <input
                  type="text"
                  placeholder="بحث..."
                  className="w-full border-none bg-transparent text-[13px] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none"
                />
                <kbd className="hidden rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] text-neutral-400 group-hover:block">⌘K</kbd>
              </HoverBorderGradient>
            </div>

            {/* Sections */}
            <div className="space-y-2">
              {SIDEBAR_SECTIONS.map((section) => {
                const SIcon = section.icon
                const isOpen = openSidebarItem === section.id
                return (
                  <div key={section.id} className="mb-2">
                    <HoverBorderGradient
                      as="button"
                      duration={1}
                      containerClassName="w-full rounded-xl"
                      className={`group flex w-full items-center gap-3 rounded-[inherit] bg-neutral-900/90 p-3 transition-all duration-200 ${
                        isOpen ? 'text-white' : 'text-neutral-500 hover:text-neutral-200'
                      }`}
                      onClick={() => setOpenSidebarItem((prev) => (prev === section.id ? null : section.id))}
                    >
                      <SIcon className={`size-[18px] transition-colors ${isOpen ? 'text-neutral-300' : 'text-neutral-500 group-hover:text-neutral-200'}`} />
                      <span className="flex-1 text-right text-sm font-medium">{section.label}</span>
                      {section.items.length > 0 && (
                        <ChevronLeft className={`size-4 text-neutral-600 transition-transform duration-300 ${isOpen ? '-rotate-90' : ''}`} />
                      )}
                    </HoverBorderGradient>
                    {isOpen && section.items.length > 0 && (
                      <div className="mt-2 space-y-1 pr-4">
                        {section.items.map((item) => (
                          <button
                            key={`${section.id}-${item}`}
                            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-neutral-400 transition-colors hover:bg-white/5 hover:text-white"
                          >
                            <span className="h-1 w-1 rounded-full bg-neutral-600" />
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
              <HoverBorderGradient
                as="div"
                duration={1}
                containerClassName="w-full rounded-2xl"
                className="flex w-full flex-col items-start rounded-[inherit] bg-neutral-900/90 p-4"
              >
                <Sparkles className="mb-2 size-5 text-primary" />
                <p className="text-xs font-light leading-relaxed text-[var(--muted-foreground)]">تم تفعيل وضع التركيز الذكي. استمتع بتجربة كتابة خالية من المشتتات.</p>
              </HoverBorderGradient>
            </div>
          </HoverBorderGradient>
        </aside>

        {/* ── Editor + Toolbar ── */}
        <main className="relative flex flex-1 flex-col overflow-hidden">
          {/* Floating dock toolbar */}
          <div className="pointer-events-none absolute left-0 right-0 top-0 z-40 flex justify-center pt-3">
            <div className="pointer-events-auto">
              <HoverBorderGradient
                as="div"
                duration={1}
                containerClassName="mx-auto rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.4)]"
                className="flex h-16 items-end gap-3.5 rounded-[inherit] bg-neutral-950/80 px-5 pb-3 backdrop-blur-2xl"
              >
                {DOCK_BUTTONS.map((button, index) => {
                  return (
                    <React.Fragment key={`${button.title}-${index}`}>
                      <DockIconButton
                        icon={button.icon}
                        title={button.title}
                        onClick={() => void handleMenuAction(button.actionId)}
                      />
                      {(index === 1 || index === 3 || index === 7 || index === 13) && (
                        <div className="mx-3 mb-4 h-5 w-px bg-gradient-to-b from-transparent via-neutral-600/50 to-transparent" />
                      )}
                    </React.Fragment>
                  )
                })}
              </HoverBorderGradient>
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
      <footer className="relative z-40 flex-shrink-0 border-t border-white/[0.04] bg-neutral-950/80 px-4 py-1 text-[11px] backdrop-blur-2xl" style={{ direction: 'rtl' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 text-[var(--muted-foreground)]">
            <span>{stats.pages} صفحة</span>
            <span className="hidden sm:inline">{stats.words} كلمة</span>
            <span className="hidden md:inline">{stats.characters} حرف</span>
            <span className="hidden sm:inline">{stats.scenes} مشهد</span>
          </div>
          <div className="flex items-center gap-2 text-[var(--muted-foreground)]">
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
