/**
 * @file App.tsx
 * @description المكون الجذري لتطبيق أفان تيتر — محرر السيناريو العربي.
 *   يجمع كل واجهات المستخدم (الترويسة، القائمة الرئيسية، الشريط الجانبي، شريط Dock،
 *   منطقة المحرر، الذيل) ويدير:
 *   - دورة حياة EditorArea (إنشاء/تدمير).
 *   - اختصارات لوحة المفاتيح العامة (Ctrl+0..7 للعناصر، Ctrl+S/O/N/Z/Y/B/I/U).
 *   - عمليات الملفات (فتح، إدراج، حفظ، تصدير HTML، طباعة).
 *   - توزيع أوامر القوائم عبر `handleMenuAction`.
 *   - عرض إحصائيات المستند (صفحات، كلمات، حروف، مشاهد) في الذيل.
 *
 * @architecture
 *   نمط هجين: React يدير الغلاف (shell) وحالة واجهة المستخدم،
 *   بينما `EditorArea` (فئة حتمية) تدير محرك Tiptap مباشرة.
 *   المكونات العرضية الصغيرة (`BackgroundGrid`, `DockIconButton`) معرّفة
 *   داخل هذا الملف وليس في ملفات منفصلة.
 *
 * @exports
 *   - `App` — المكون الجذري (named export).
 *
 * @dependencies
 *   - `components/editor/EditorArea` — محرك المحرر الحتمي.
 *   - `components/ui/hover-border-gradient` — مكون تأثير الحدود المتدرجة.
 *   - `utils/file-import/*` — خط أنابيب استيراد الملفات.
 *   - `extensions/classification-types` — أنواع عناصر السيناريو.
 *   - `lucide-react` — أيقونات الواجهة.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react'
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
import { colors, brandColors, gradients, highlightColors, semanticColors } from './constants/colors'
import { screenplayFormats } from './constants/formats'
import { insertMenuDefinitions, type EditorStyleFormatId } from './constants/insert-menu'
import { type ElementType, fromLegacyElementType, isElementType } from './extensions/classification-types'
import { toast } from './hooks'
import {
  ACCEPTED_FILE_EXTENSIONS,
  DEFAULT_TYPING_SYSTEM_SETTINGS,
  minutesToMilliseconds,
  sanitizeTypingSystemSettings,
  type EditorEngineAdapter,
  type RunDocumentThroughPasteWorkflowOptions,
  type TypingSystemSettings,
} from './types'
import { buildFileOpenPipelineAction, extractImportedFile, pickImportFile } from './utils/file-import'
import { logger } from './utils/logger'

/**
 * @description معرّفات أوامر القوائم — تُستخدم كمفاتيح موحدة لتوزيع الأوامر
 *   في `handleMenuAction`. تدعم الأوامر الثابتة (مثل `undo`) والديناميكية
 *   (مثل `format:action` و`insert-template:*`) عبر القوالب النصية.
 */
type InsertActionId = `insert-template:${EditorStyleFormatId}` | `photo-montage:${EditorStyleFormatId}`

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
  | InsertActionId

/**
 * @description ربط أرقام لوحة المفاتيح (0-7) بأنواع عناصر السيناريو
 *   لاختصارات Ctrl+رقم. المفتاح هو الرقم كسلسلة نصية.
 */
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

/** ربط نوع العنصر بتسميته العربية — يُعرض في ذيل الصفحة كمؤشر العنصر النشط */
const FORMAT_LABEL_BY_TYPE: Record<ElementType, string> = {
  basmala: screenplayFormats.find((format) => format.id === 'basmala')?.label ?? 'بسملة',
  sceneHeaderTopLine: screenplayFormats.find((format) => format.id === 'scene-header-top-line')?.label ?? 'سطر رأس المشهد',
  sceneHeader3: screenplayFormats.find((format) => format.id === 'scene-header-3')?.label ?? 'رأس المشهد (3)',
  action: screenplayFormats.find((format) => format.id === 'action')?.label ?? 'حدث / وصف',
  character: screenplayFormats.find((format) => format.id === 'character')?.label ?? 'شخصية',
  dialogue: screenplayFormats.find((format) => format.id === 'dialogue')?.label ?? 'حوار',
  parenthetical: screenplayFormats.find((format) => format.id === 'parenthetical')?.label ?? 'تعليمات حوار',
  transition: screenplayFormats.find((format) => format.id === 'transition')?.label ?? 'انتقال',
}

const FORMAT_ICON_GLYPH_BY_NAME: Readonly<Record<string, string>> = {
  'book-heart': '﷽',
  'separator-horizontal': '🎬',
  film: '🎞',
  'map-pin': '📍',
  camera: '📷',
  feather: '📝',
  'user-square': '👤',
  parentheses: '()',
  'message-circle': '💬',
  'fast-forward': '⏩',
}

const INSERT_ACCENT_COLOR_BY_ID: Readonly<Record<EditorStyleFormatId, string>> = {
  basmala: semanticColors.creative,
  'scene-header-top-line': semanticColors.info,
  'scene-header-1': semanticColors.info,
  'scene-header-2': semanticColors.technical,
  'scene-header-3': semanticColors.secondary,
  action: semanticColors.primary,
  character: semanticColors.success,
  dialogue: semanticColors.warning,
  parenthetical: semanticColors.accent,
  transition: semanticColors.error,
}

const INSERT_DEFINITION_BY_ID = insertMenuDefinitions.reduce<Record<EditorStyleFormatId, (typeof insertMenuDefinitions)[number]>>(
  (acc, definition) => {
    acc[definition.id] = definition
    return acc
  },
  {} as Record<EditorStyleFormatId, (typeof insertMenuDefinitions)[number]>,
)

/**
 * @description بناء مستند HTML كامل (مع DOCTYPE و head) من محتوى body المحرر.
 *   يُستخدم عند تصدير السيناريو كملف HTML مستقل مع دعم RTL وترميز UTF-8.
 *
 * @param {string} bodyHtml — محتوى HTML الخام من المحرر.
 * @returns {string} مستند HTML كامل جاهز للتنزيل.
 */
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

/**
 * @description تنزيل ملف نصي على جهاز المستخدم عبر إنشاء Blob URL مؤقت
 *   وعنصر `<a>` وهمي. يُحرر الـ URL فوراً بعد التنزيل لتجنب تسرب الذاكرة.
 *
 * @param {string} fileName — اسم الملف المُنزّل (مثل `screenplay.html`).
 * @param {string} content — المحتوى النصي للملف.
 * @param {string} mimeType — نوع MIME (مثل `text/html;charset=utf-8`).
 */
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

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

const buildSceneHeaderTopLineHtml = (header1: string, header2: string): string => {
  const safeHeader1 = escapeHtml(header1.trim())
  const safeHeader2 = escapeHtml(header2.trim())
  return `<div data-type="scene-header-top-line"><div data-type="scene-header-1">${safeHeader1}</div><div data-type="scene-header-2">${safeHeader2}</div></div>`
}

/** مكون خلفية الشبكة الزخرفية — يعرض شبكة نقطية مع توهجات ضبابية ملونة */
const BackgroundGrid = (): React.JSX.Element => (
  <div className="app-bg-grid pointer-events-none fixed inset-0 z-0">
    <div className="absolute inset-0 bg-neutral-950 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]" />
    <div className="absolute left-0 right-0 top-0 -z-10 m-auto h-[310px] w-[310px] rounded-full opacity-20 blur-[100px]" style={{ backgroundColor: semanticColors.info }} />
    <div className="absolute bottom-0 right-0 -z-10 m-auto h-[310px] w-[310px] rounded-full opacity-20 blur-[100px]" style={{ backgroundColor: brandColors.jungleGreen }} />
  </div>
)

/** واجهة قسم في القائمة الرئيسية — تحتوي تسمية وقائمة عناصر مع معرّفات أوامر */
interface MenuItem {
  label: string
  actionId: MenuActionId
  shortcut?: string
  accentColor?: string
}

interface MenuSection {
  label: string
  items: readonly MenuItem[]
}

const INSERT_MENU_ITEMS: readonly MenuItem[] = insertMenuDefinitions.map((definition) => {
  const metadata = screenplayFormats.find((format) => format.id === definition.id)
  const icon = FORMAT_ICON_GLYPH_BY_NAME[metadata?.icon ?? definition.icon] ?? '•'
  const actionId = `${definition.insertBehavior}:${definition.id}` as MenuActionId
  return {
    label: `${icon} ${metadata?.label ?? definition.label}`,
    actionId,
    shortcut: metadata?.shortcut || undefined,
    accentColor: INSERT_ACCENT_COLOR_BY_ID[definition.id],
  }
})

/** أقسام القائمة الرئيسية: ملف، تعديل، إضافة، تنسيق، أدوات، مساعدة */
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
    items: INSERT_MENU_ITEMS,
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

/* ── تهيئة أزرار شريط Dock العائم ── */

/** واجهة زر في شريط Dock — أيقونة + عنوان + معرّف أمر */
interface DockButtonItem {
  actionId: MenuActionId
  icon: React.ElementType
  title: string
}

/** قائمة أزرار شريط Dock العائم — مرتبة حسب المجموعة: وسائط، أدوات، إجراءات، تنسيق، معلومات */
const DOCK_BUTTONS: readonly DockButtonItem[] = [
  // وسائط وتصدير
  { actionId: 'about', icon: Clapperboard, title: 'تبديل التنسيق المباشر' },
  { actionId: 'export-html', icon: Download, title: 'تصدير PDF' },
  // أدوات
  { actionId: 'about', icon: Stethoscope, title: 'تحليل السيناريو' },
  { actionId: 'about', icon: Lightbulb, title: 'اقتراحات الذكاء الاصطناعي' },
  // إجراءات
  { actionId: 'about', icon: MessageSquare, title: 'الملاحظات' },
  { actionId: 'about', icon: History, title: 'سجل التغييرات' },
  { actionId: 'open-file', icon: Upload, title: 'فتح ملف' },
  { actionId: 'save-file', icon: Save, title: 'حفظ الملف' },
  // تنسيق
  { actionId: 'undo', icon: Undo2, title: 'تراجع' },
  { actionId: 'redo', icon: Redo2, title: 'إعادة' },
  { actionId: 'bold', icon: Bold, title: 'غامق' },
  { actionId: 'italic', icon: Italic, title: 'مائل' },
  { actionId: 'about', icon: AlignRight, title: 'محاذاة لليمين' },
  { actionId: 'about', icon: AlignCenter, title: 'توسيط' },
  // معلومات
  { actionId: 'about', icon: Info, title: 'مساعدة' },
]

/** خصائص مكون زر أيقونة Dock */
interface DockIconButtonProps {
  icon: React.ElementType
  title: string
  onClick: () => void
}

/** مكون زر أيقونة في شريط Dock مع تأثير حدود متدرجة عند التحويم */
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

/* ── تهيئة أقسام الشريط الجانبي ── */

/** أقسام الشريط الجانبي: المستندات الأخيرة، المشاريع، المكتبة، الإعدادات */
const SIDEBAR_SECTIONS = [
  { id: 'docs', label: 'المستندات الأخيرة', icon: FileText, items: ['سيناريو فيلم.docx', 'مسودة الحلقة الأولى.docx', 'مشاهد مُصنفة.txt'] },
  { id: 'projects', label: 'المشاريع', icon: List, items: ['فيلم الرحلة', 'مسلسل الحارة', 'ورشة أفان تيتر'] },
  { id: 'library', label: 'المكتبة', icon: BookOpen, items: ['قوالب المشاهد', 'الشخصيات', 'الملاحظات'] },
  { id: 'settings', label: 'الإعدادات', icon: Settings, items: [] },
] as const

const TYPING_SETTINGS_STORAGE_KEY = 'filmlane.typing-system.settings'

const readTypingSystemSettings = (): TypingSystemSettings => {
  if (typeof window === 'undefined') return DEFAULT_TYPING_SYSTEM_SETTINGS

  try {
    const raw = window.localStorage.getItem(TYPING_SETTINGS_STORAGE_KEY)
    if (!raw) return DEFAULT_TYPING_SYSTEM_SETTINGS
    const parsed = JSON.parse(raw) as Partial<TypingSystemSettings>
    return sanitizeTypingSystemSettings(parsed)
  } catch {
    return DEFAULT_TYPING_SYSTEM_SETTINGS
  }
}

/**
 * @description المكون الجذري للتطبيق (App Component). يجمع كل الواجهات (الترويسة، الشريط الجانبي، منطقة المحرر، الذيل) ويدير حالة النسخة والإحصائيات والأحداث العامة.
 *
 * @complexity الزمنية: O(1) للتصيير (Render) | المكانية: O(1) لحفظ المراجع والحالة محلياً.
 *
 * @sideEffects
 *   - ينشئ دورة حياة مفردة لـ `EditorArea`.
 *   - يسجل مستمعي أحداث `keydown` و `click` على الـ `document`.
 *
 * @usedBy
 *   - `main.tsx` لتركيب شجرة React.
 */
export function App(): React.JSX.Element {
  const editorMountRef = useRef<HTMLDivElement | null>(null)
  const editorAreaRef = useRef<EditorArea | null>(null)
  const photoMontageCounterRef = useRef(1)
  const liveTypingWorkflowTimeoutRef = useRef<number | null>(null)
  const applyingTypingWorkflowRef = useRef(false)
  const lastLiveWorkflowTextRef = useRef('')

  const [stats, setStats] = useState<DocumentStats>({ pages: 1, words: 0, characters: 0, scenes: 0 })
  const [currentFormat, setCurrentFormat] = useState<ElementType | null>(null)
  const [activeMenu, setActiveMenu] = useState<string | null>(null)
  const [openSidebarItem, setOpenSidebarItem] = useState<string | null>(null)
  const [documentText, setDocumentText] = useState('')
  const [typingSystemSettings] = useState<TypingSystemSettings>(() => readTypingSystemSettings())

  /* ── تركيب/تدمير EditorArea مرة واحدة فقط ── */
  useEffect(() => {
    const mount = editorMountRef.current
    if (!mount) return

    const editorArea = new EditorArea({
      mount,
      onContentChange: (text) => setDocumentText(text),
      onStatsChange: (nextStats) => setStats(nextStats),
      onFormatChange: (format) => setCurrentFormat(format),
    })
    editorAreaRef.current = editorArea

    return () => {
      editorArea.destroy()
      editorAreaRef.current = null
    }
  }, [])

  /* ── إغلاق القوائم عند النقر خارجها ── */
  useEffect(() => {
    const closeMenus = (): void => setActiveMenu(null)
    document.addEventListener('click', closeMenus)
    return () => document.removeEventListener('click', closeMenus)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(TYPING_SETTINGS_STORAGE_KEY, JSON.stringify(typingSystemSettings))
  }, [typingSystemSettings])

  /* ── تفعيل Design Tokens من constants/colors.ts ── */
  useEffect(() => {
    const rootStyle = document.documentElement.style
    rootStyle.setProperty('--brand', brandColors.jungleGreen)
    rootStyle.setProperty('--brand-teal', brandColors.teal)
    rootStyle.setProperty('--brand-bronze', brandColors.bronze)
    rootStyle.setProperty('--ring', brandColors.jungleGreen)
    rootStyle.setProperty('--accent', semanticColors.secondary)
    rootStyle.setProperty('--accent-success', semanticColors.success)
    rootStyle.setProperty('--accent-warning', semanticColors.warning)
    rootStyle.setProperty('--accent-error', semanticColors.error)
    rootStyle.setProperty('--accent-creative', semanticColors.creative)
    rootStyle.setProperty('--accent-technical', semanticColors.technical)
    rootStyle.setProperty('--filmlane-brand-gradient', gradients.jungleFull)
    rootStyle.setProperty('--filmlane-brand-gradient-soft', gradients.jungle)
    rootStyle.setProperty('--filmlane-highlight-primary', highlightColors[0])
    rootStyle.setProperty('--filmlane-highlight-secondary', highlightColors[1])
    rootStyle.setProperty('--filmlane-palette-dark', colors[0])
  }, [])

  const runDocumentThroughPasteWorkflow = useCallback(
    async (options: RunDocumentThroughPasteWorkflowOptions): Promise<void> => {
      const area = editorAreaRef.current
      if (!area) return

      const fullText = area.getAllText().trim()
      if (!fullText) return

      if (options.source === 'live-idle' && fullText === lastLiveWorkflowTextRef.current) {
        return
      }

      if (applyingTypingWorkflowRef.current) return
      applyingTypingWorkflowRef.current = true

      try {
        await area.importClassifiedText(fullText, 'replace')
        lastLiveWorkflowTextRef.current = area.getAllText().trim()

        logger.info('Typing workflow executed', {
          scope: 'typing-system',
          data: {
            source: options.source,
            reviewProfile: options.reviewProfile,
            policyProfile: options.policyProfile,
          },
        })

        if (!options.suppressToasts) {
          toast({
            title: options.source === 'live-idle' ? 'تمت المعالجة الحية' : 'تمت المعالجة المؤجلة',
            description: 'تم تمرير كامل المستند عبر مصنف اللصق وتحديث البنية.',
          })
        }
      } catch (error) {
        logger.error('Typing workflow failed', {
          scope: 'typing-system',
          data: error,
        })
        if (!options.suppressToasts) {
          toast({
            title: 'تعذر تشغيل نظام الكتابة',
            description: error instanceof Error ? error.message : 'حدث خطأ غير معروف أثناء المعالجة.',
            variant: 'destructive',
          })
        }
      } finally {
        applyingTypingWorkflowRef.current = false
      }
    },
    [],
  )

  useEffect(() => {
    if (typeof window === 'undefined') return

    const liveIdleDelayMs = minutesToMilliseconds(typingSystemSettings.liveIdleMinutes)
    if (typingSystemSettings.typingSystemMode !== 'auto-live') {
      if (liveTypingWorkflowTimeoutRef.current !== null) {
        window.clearTimeout(liveTypingWorkflowTimeoutRef.current)
        liveTypingWorkflowTimeoutRef.current = null
      }
      return
    }

    const normalizedText = documentText.trim()
    if (!normalizedText) return
    if (applyingTypingWorkflowRef.current) return
    if (normalizedText === lastLiveWorkflowTextRef.current) return

    if (liveTypingWorkflowTimeoutRef.current !== null) {
      window.clearTimeout(liveTypingWorkflowTimeoutRef.current)
    }

    liveTypingWorkflowTimeoutRef.current = window.setTimeout(() => {
      liveTypingWorkflowTimeoutRef.current = null
      void runDocumentThroughPasteWorkflow({
        source: 'live-idle',
        reviewProfile: 'silent-live',
        policyProfile: 'strict-structure',
        suppressToasts: true,
      })
    }, liveIdleDelayMs)

    return () => {
      if (liveTypingWorkflowTimeoutRef.current !== null) {
        window.clearTimeout(liveTypingWorkflowTimeoutRef.current)
        liveTypingWorkflowTimeoutRef.current = null
      }
    }
  }, [documentText, runDocumentThroughPasteWorkflow, typingSystemSettings])

  /* ── اختصارات لوحة المفاتيح العامة ── */
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

  /* ── عمليات الملفات ── */
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

  const runInsertMenuAction = (actionId: InsertActionId, area: EditorArea): void => {
    const [behavior, rawId] = actionId.split(':') as ['insert-template' | 'photo-montage', EditorStyleFormatId]
    const definition = INSERT_DEFINITION_BY_ID[rawId]
    const template = (definition.defaultTemplate ?? '').trim()
    const sceneHeader1Template = (INSERT_DEFINITION_BY_ID['scene-header-1'].defaultTemplate ?? 'مشهد 1:').trim()
    const sceneHeader2Template = (INSERT_DEFINITION_BY_ID['scene-header-2'].defaultTemplate ?? 'داخلي - المكان - الوقت').trim()

    if (behavior === 'photo-montage') {
      const montageNumber = photoMontageCounterRef.current
      photoMontageCounterRef.current += 1
      const montageHeader = `فوتو مونتاج ${montageNumber}`
      area.editor.chain().focus().insertContent(buildSceneHeaderTopLineHtml(montageHeader, 'مشاهد متتابعة')).run()
      toast({ title: 'تم إدراج فوتو مونتاج', description: `تم إنشاء ${montageHeader}.` })
      return
    }

    if (definition.id === 'scene-header-1') {
      area.editor.chain().focus().insertContent(buildSceneHeaderTopLineHtml(template || sceneHeader1Template, sceneHeader2Template)).run()
      toast({ title: 'تم الإدراج', description: 'تم إدراج رأس المشهد (1) ضمن سطر رأس المشهد.' })
      return
    }

    if (definition.id === 'scene-header-2') {
      area.editor.chain().focus().insertContent(buildSceneHeaderTopLineHtml(sceneHeader1Template, template || sceneHeader2Template)).run()
      toast({ title: 'تم الإدراج', description: 'تم إدراج رأس المشهد (2) ضمن سطر رأس المشهد.' })
      return
    }

    const mappedElementType = fromLegacyElementType(definition.id)
    if (!mappedElementType) {
      toast({
        title: 'تعذر الإدراج',
        description: `نوع الإدراج ${definition.id} غير مدعوم في المحرك الحالي.`,
        variant: 'destructive',
      })
      return
    }

    area.setFormat(mappedElementType)
    if (template) {
      area.editor.chain().focus().insertContent(escapeHtml(template)).run()
    }
    toast({ title: 'تم الإدراج', description: `تم إدراج قالب ${definition.label}.` })
  }

  /* ── Menu action dispatcher ── */
  const handleMenuAction = async (actionId: MenuActionId): Promise<void> => {
    const area = editorAreaRef.current
    if (!area) return
    const engine = area as unknown as EditorEngineAdapter

    setActiveMenu(null)

    if (actionId.startsWith('format:')) {
      const maybeFormat = actionId.replace('format:', '')
      if (isElementType(maybeFormat)) {
        area.setFormat(maybeFormat)
      }
      return
    }

    if (actionId.startsWith('insert-template:') || actionId.startsWith('photo-montage:')) {
      runInsertMenuAction(actionId as InsertActionId, area)
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
        engine.runCommand({ command: actionId })
        break
      case 'bold':
      case 'italic':
      case 'underline':
        area.runCommand(actionId)
        break
      case 'copy':
        if (!(await engine.copySelectionToClipboard())) {
          document.execCommand('copy')
        }
        break
      case 'cut':
        if (!(await engine.cutSelectionToClipboard())) {
          document.execCommand('cut')
        }
        break
      case 'paste': {
        try {
          const pasted = await engine.pasteFromClipboard('menu')
          if (pasted) {
            toast({ title: 'تم اللصق', description: 'تم تمرير النص عبر المصنف وإدراجه.' })
            if (typingSystemSettings.typingSystemMode === 'auto-deferred') {
              void runDocumentThroughPasteWorkflow({
                source: 'manual-deferred',
                reviewProfile: 'interactive',
                policyProfile: 'interactive-legacy',
              })
            }
            break
          }
          document.execCommand('paste')
        } catch {
          document.execCommand('paste')
        }
        break
      }
      case 'select-all':
        engine.runCommand({ command: 'select-all' })
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
    <div className="app-root flex h-screen flex-col overflow-hidden bg-[var(--background)] font-['Cairo'] text-[var(--foreground)] selection:bg-[var(--brand)]/30" dir="rtl">
      <BackgroundGrid />

      {/* ── Header ── */}
      <header className="app-header relative z-40 flex h-[60px] flex-shrink-0 items-center justify-between bg-[var(--card)]/80 px-7 backdrop-blur-2xl">
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
              <span className="h-1.5 w-1.5 rounded-full shadow-[0_0_6px_rgba(15,76,138,0.5)]" style={{ backgroundColor: semanticColors.info }} />
              <span
                className="bg-clip-text text-[15px] font-bold text-transparent transition-all duration-300"
                style={{ backgroundImage: gradients.jungle }}
              >
                أفان تيتر
              </span>
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
                  className={`flex h-full min-w-[72px] justify-center items-center rounded-[inherit] px-4 text-[13px] font-medium transition-all ${activeMenu === section.label
                      ? 'bg-neutral-800 text-white'
                      : 'bg-neutral-900/90 text-neutral-400 hover:bg-neutral-800 group-hover:text-white'
                    }`}
                  onClick={() => setActiveMenu((prev) => (prev === section.label ? null : section.label))}
                >
                  {section.label}
                </HoverBorderGradient>

                {activeMenu === section.label && (
                  <div className="absolute right-0 top-full z-50 mt-2 w-72 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--popover)]/95 p-1 shadow-[0_20px_60px_-10px_rgba(0,0,0,0.8)] backdrop-blur-2xl">
                    {section.items.map((item) => (
                      <button
                        key={`${section.label}-${item.label}`}
                        onClick={() => void handleMenuAction(item.actionId)}
                        className="flex w-full items-center gap-2 rounded-[var(--radius-md)] px-3 py-2 text-right text-[13px] text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)]/50 hover:text-[var(--foreground)]"
                      >
                        {item.accentColor && (
                          <span
                            className="h-2 w-2 flex-shrink-0 rounded-full"
                            style={{ backgroundColor: item.accentColor }}
                          />
                        )}
                        <span className="flex-1 text-right">{item.label}</span>
                        {item.shortcut && <span className="text-[10px] text-[var(--muted-foreground)]">{item.shortcut}</span>}
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
            <span className="bg-clip-text text-[15px] font-bold text-transparent transition-all duration-300" style={{ backgroundImage: gradients.jungleFull }}>النسخة</span>
            <span className="flex h-1.5 w-1.5">
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full" style={{ backgroundColor: brandColors.jungleGreen }} />
            </span>
          </HoverBorderGradient>
        </HoverBorderGradient>
      </header>

      {/* ── Main area ── */}
      <div className="app-main relative z-10 flex flex-1 overflow-hidden">
        {/* ── Sidebar ── */}
        <aside className="app-sidebar hidden w-72 flex-col p-6 lg:flex">
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
                      className={`group flex w-full items-center gap-3 rounded-[inherit] bg-neutral-900/90 p-3 transition-all duration-200 ${isOpen ? 'text-white' : 'text-neutral-500 hover:text-neutral-200'
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
        <main className="app-editor-main relative flex flex-1 flex-col overflow-hidden">
          {/* Floating dock toolbar */}
          <div className="app-dock pointer-events-none absolute left-0 right-0 top-0 z-40 flex justify-center pt-3">
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
          <div className="app-editor-scroll scrollbar-none flex flex-1 justify-center overflow-y-auto p-8 pt-20">
            <div className="app-editor-shell relative -mt-4 w-full max-w-[850px] pb-20">
              <div ref={editorMountRef} className="editor-area app-editor-host" />
            </div>
          </div>
        </main>
      </div>

      {/* ── Footer ── */}
      <footer className="app-footer relative z-40 flex-shrink-0 border-t border-white/[0.04] bg-neutral-950/80 px-4 py-1 text-[11px] backdrop-blur-2xl" style={{ direction: 'rtl' }}>
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
        {screenplayFormats.map((format) => (
          <span key={format.id}>{format.label}</span>
        ))}
      </div>
    </div>
  )
}
