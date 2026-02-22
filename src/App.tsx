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
  FileText,
  List,
  BookOpen,
  Settings,
  Clapperboard,
} from 'lucide-react'
import {
  AppDock,
  AppFooter,
  AppHeader,
  AppSidebar,
  type AppDockButtonItem,
  type AppShellMenuItem,
  type AppShellMenuSection,
  type AppSidebarSection,
} from './components/app-shell'
import { EditorArea } from './components/editor/EditorArea'
import type { DocumentStats, FileImportMode } from './components/editor/editor-area.types'
import { colors, brandColors, gradients, highlightColors, semanticColors } from './constants/colors'
import { screenplayFormats } from './constants/formats'
import { insertMenuDefinitions, type EditorStyleFormatId } from './constants/insert-menu'
import { type ElementType, fromLegacyElementType, isElementType } from './extensions/classification-types'
import { loadFromStorage, saveToStorage, subscribeIsMobile, toast, useAutoSave, useIsMobile } from './hooks'
import {
  ACCEPTED_FILE_EXTENSIONS,
  DEFAULT_TYPING_SYSTEM_SETTINGS,
  minutesToMilliseconds,
  sanitizeTypingSystemSettings,
  type EditorEngineAdapter,
  type RunDocumentThroughPasteWorkflowOptions,
  type TypingSystemSettings,
} from './types'
import {
  buildFileOpenPipelineAction,
  buildProjectionGuardReport,
  buildStructuredBlocksFromText,
  extractImportedFile,
  pickImportFile,
  plainTextToScreenplayBlocks,
} from './utils/file-import'
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
const INSERT_MENU_ITEMS: readonly AppShellMenuItem[] = insertMenuDefinitions.map((definition) => {
  const metadata = screenplayFormats.find((format) => format.id === definition.id)
  const icon = FORMAT_ICON_GLYPH_BY_NAME[metadata?.icon ?? definition.icon] ?? '•'
  const actionId = `${definition.insertBehavior}:${definition.id}` as const
  return {
    label: `${icon} ${metadata?.label ?? definition.label}`,
    actionId,
    shortcut: metadata?.shortcut || undefined,
    accentColor: INSERT_ACCENT_COLOR_BY_ID[definition.id],
  }
})

/** أقسام القائمة الرئيسية: ملف، تعديل، إضافة، تنسيق، أدوات، مساعدة */
const MENU_SECTIONS: readonly AppShellMenuSection[] = [
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
/** قائمة أزرار شريط Dock العائم — مرتبة حسب المجموعة: وسائط، أدوات، إجراءات، تنسيق، معلومات */
const DOCK_BUTTONS: readonly AppDockButtonItem[] = [
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

/* ── تهيئة أقسام الشريط الجانبي ── */

/** أقسام الشريط الجانبي: المستندات الأخيرة، المشاريع، المكتبة، الإعدادات */
const SIDEBAR_SECTIONS: readonly AppSidebarSection[] = [
  { id: 'docs', label: 'المستندات الأخيرة', icon: FileText, items: ['سيناريو فيلم.docx', 'مسودة الحلقة الأولى.docx', 'مشاهد مُصنفة.txt'] },
  { id: 'projects', label: 'المشاريع', icon: List, items: ['فيلم الرحلة', 'مسلسل الحارة', 'ورشة أفان تيتر'] },
  { id: 'library', label: 'المكتبة', icon: BookOpen, items: ['قوالب المشاهد', 'الشخصيات', 'الملاحظات'] },
  { id: 'settings', label: 'الإعدادات', icon: Settings, items: [] },
] as const

const TYPING_SETTINGS_STORAGE_KEY = 'filmlane.typing-system.settings'
const AUTOSAVE_DRAFT_STORAGE_KEY = 'filmlane.autosave.document-text.v1'
const TYPING_MODE_OPTIONS: ReadonlyArray<{
  value: TypingSystemSettings['typingSystemMode']
  label: string
  description: string
}> = [
  {
    value: 'plain',
    label: 'يدوي (Plain)',
    description: 'لا يتم تشغيل التصنيف التلقائي أثناء الكتابة.',
  },
  {
    value: 'auto-deferred',
    label: 'مؤجل (Auto Deferred)',
    description: 'يشغّل إعادة المعالجة يدويًا بعد اللصق.',
  },
  {
    value: 'auto-live',
    label: 'حي (Auto Live)',
    description: 'يشغّل إعادة المعالجة تلقائيًا بعد مهلة خمول.',
  },
]

const toLiveIdleMinutesLabel = (minutes: number): string =>
  `${minutes} ${minutes === 1 ? 'دقيقة' : 'دقائق'}`

interface EditorAutosaveSnapshot {
  text: string
  updatedAt: string
}

const readTypingSystemSettings = (): TypingSystemSettings => {
  const parsed = loadFromStorage<Partial<TypingSystemSettings> | null>(
    TYPING_SETTINGS_STORAGE_KEY,
    null,
  )
  return sanitizeTypingSystemSettings(parsed ?? DEFAULT_TYPING_SYSTEM_SETTINGS)
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
  const hasRestoredAutosaveRef = useRef(false)

  const [stats, setStats] = useState<DocumentStats>({ pages: 1, words: 0, characters: 0, scenes: 0 })
  const [currentFormat, setCurrentFormat] = useState<ElementType | null>(null)
  const [activeMenu, setActiveMenu] = useState<string | null>(null)
  const [openSidebarItem, setOpenSidebarItem] = useState<string | null>(null)
  const [documentText, setDocumentText] = useState('')
  const [isMobile, setIsMobile] = useState<boolean>(() => useIsMobile())
  const [typingSystemSettings, setTypingSystemSettings] = useState<TypingSystemSettings>(() =>
    readTypingSystemSettings(),
  )

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

  useEffect(() => {
    return subscribeIsMobile((nextIsMobile) => {
      setIsMobile(nextIsMobile)
      if (nextIsMobile) {
        setOpenSidebarItem(null)
      }
    })
  }, [])

  useEffect(() => {
    const area = editorAreaRef.current
    if (!area) return
    if (hasRestoredAutosaveRef.current) return

    const snapshot = loadFromStorage<EditorAutosaveSnapshot | null>(
      AUTOSAVE_DRAFT_STORAGE_KEY,
      null,
    )
    hasRestoredAutosaveRef.current = true

    if (!snapshot?.text?.trim()) return

    void area.importClassifiedText(snapshot.text, 'replace').then(() => {
      toast({
        title: 'تمت استعادة المسودة',
        description: 'استرجعنا آخر نسخة محفوظة تلقائيًا.',
      })
    })
  }, [])

  /* ── إغلاق القوائم عند النقر خارجها ── */
  useEffect(() => {
    const closeMenus = (): void => setActiveMenu(null)
    document.addEventListener('click', closeMenus)
    return () => document.removeEventListener('click', closeMenus)
  }, [])

  useEffect(() => {
    saveToStorage(TYPING_SETTINGS_STORAGE_KEY, typingSystemSettings)
  }, [typingSystemSettings])

  useEffect(() => {
    const normalizedText = documentText.trim()
    if (!normalizedText) return

    useAutoSave<EditorAutosaveSnapshot>(
      AUTOSAVE_DRAFT_STORAGE_KEY,
      {
        text: normalizedText,
        updatedAt: new Date().toISOString(),
      },
      1500,
    )
  }, [documentText])

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

  const fileImportBackendEndpoint =
    (import.meta.env.VITE_FILE_IMPORT_BACKEND_URL as string | undefined)?.trim() ?? ''
  const explicitAgentReviewEndpoint =
    (import.meta.env.VITE_AGENT_REVIEW_BACKEND_URL as string | undefined)?.trim() ?? ''
  const hasFileImportBackend = fileImportBackendEndpoint.length > 0
  const hasAgentReviewBackend =
    explicitAgentReviewEndpoint.length > 0 || hasFileImportBackend

  const handleTypingModeChange = (nextMode: TypingSystemSettings['typingSystemMode']): void => {
    setTypingSystemSettings((current) =>
      sanitizeTypingSystemSettings({
        ...current,
        typingSystemMode: nextMode,
      }),
    )

    if (nextMode !== 'auto-live' && liveTypingWorkflowTimeoutRef.current !== null) {
      window.clearTimeout(liveTypingWorkflowTimeoutRef.current)
      liveTypingWorkflowTimeoutRef.current = null
    }

    logger.info('Typing system mode updated', {
      scope: 'typing-system',
      data: { mode: nextMode },
    })
  }

  const handleLiveIdleMinutesChange = (nextMinutes: number): void => {
    setTypingSystemSettings((current) =>
      sanitizeTypingSystemSettings({
        ...current,
        liveIdleMinutes: nextMinutes,
      }),
    )
  }

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
      let appliedPipeline: 'open-pipeline-structured' | 'structure-pipeline' | 'paste-classifier' =
        'paste-classifier'
      let projectionGuardReasons: string[] | null = null

      if (action.kind === 'reject') {
        toast(action.toast)
        return
      }

      if (action.kind === 'import-structured-blocks') {
        area.importStructuredBlocks(action.blocks, mode)
        appliedPipeline = 'open-pipeline-structured'
      } else {
        const structuredResult = buildStructuredBlocksFromText(action.text, {
          mergePolicy: 'safe',
          classifierRole: 'label-only',
        })

        const structuredBlocks = plainTextToScreenplayBlocks(action.text, structuredResult.policy)
        const projectionGuard = buildProjectionGuardReport({
          inputLineCount: structuredResult.normalizedLines.length,
          currentBlocks: mode === 'replace' ? area.getBlocks() : undefined,
          nextBlocks: structuredBlocks,
          policy: structuredResult.policy,
        })
        projectionGuardReasons = projectionGuard.reasons

        if (structuredBlocks.length > 0 && (mode === 'insert' || projectionGuard.accepted)) {
          area.importStructuredBlocks(structuredBlocks, mode)
          appliedPipeline = 'structure-pipeline'
        } else if (mode === 'replace' && !projectionGuard.accepted) {
          toast({
            title: 'تم إيقاف الاستبدال لحماية المستند',
            description:
              'نتيجة الهيكلة كانت منخفضة الجودة مقارنة بالمحتوى الحالي. استخدم "إدراج ملف" أو راجع الملف المستورد.',
            variant: 'destructive',
          })

          logger.warn('Projection guard prevented replace import', {
            scope: 'file-import',
            data: {
              mode,
              reasons: projectionGuard.reasons,
              inputLineCount: projectionGuard.inputLineCount,
              outputBlockCount: projectionGuard.outputBlockCount,
            },
          })
          return
        } else {
          await area.importClassifiedText(action.text, mode)
          appliedPipeline = 'paste-classifier'
        }
      }

      const toastDescription =
        appliedPipeline === 'structure-pipeline'
          ? `${action.toast.description}\nتم تمرير النص عبر Structure Pipeline قبل الإدراج.`
          : action.toast.description

      toast({
        ...action.toast,
        description: toastDescription,
      })

      logger.info('File import pipeline completed', {
        scope: 'file-import',
        data: {
          ...action.telemetry,
          appliedPipeline,
          projectionGuardReasons,
        },
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

  const activeTypingMode = TYPING_MODE_OPTIONS.find(
    (option) => option.value === typingSystemSettings.typingSystemMode,
  )

  const currentFormatLabel = currentFormat ? FORMAT_LABEL_BY_TYPE[currentFormat] : '—'

  const settingsPanel = (
    <div className="mt-2 space-y-3 rounded-xl border border-white/10 bg-neutral-900/70 p-3 text-right">
      <div className="space-y-1">
        <label className="block text-xs font-semibold text-neutral-200">وضع نظام الكتابة</label>
        <select
          className="w-full rounded-lg border border-white/10 bg-neutral-950/80 px-3 py-2 text-xs text-neutral-100 outline-none focus:border-[var(--brand)]"
          value={typingSystemSettings.typingSystemMode}
          onChange={(event) =>
            handleTypingModeChange(
              event.target.value as TypingSystemSettings['typingSystemMode'],
            )
          }
        >
          {TYPING_MODE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <p className="text-[11px] text-neutral-400">{activeTypingMode?.description ?? ''}</p>
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between text-[11px] text-neutral-300">
          <span>{toLiveIdleMinutesLabel(typingSystemSettings.liveIdleMinutes)}</span>
          <span>مهلة المعالجة الحية</span>
        </div>
        <input
          type="range"
          min={1}
          max={15}
          step={1}
          value={typingSystemSettings.liveIdleMinutes}
          onChange={(event) => handleLiveIdleMinutesChange(Number(event.target.value))}
          className="w-full accent-[var(--brand)]"
        />
        <div className="flex items-center justify-between text-[10px] text-neutral-500">
          <span>1</span>
          <span>15</span>
        </div>
      </div>

      <button
        type="button"
        className="w-full rounded-lg border border-white/10 bg-neutral-950/80 px-3 py-2 text-xs text-neutral-200 transition-colors hover:border-[var(--brand)] hover:text-white"
        onClick={() => {
          void runDocumentThroughPasteWorkflow({
            source: 'manual-deferred',
            reviewProfile: 'interactive',
            policyProfile: 'strict-structure',
          })
        }}
      >
        تشغيل المعالجة الآن
      </button>

      <div className="space-y-1 text-[10px] text-neutral-400">
        <div className="flex items-center justify-between">
          <span
            className={`h-2 w-2 rounded-full ${hasFileImportBackend ? 'bg-emerald-400' : 'bg-amber-400'}`}
          />
          <span>Backend File Extract: {hasFileImportBackend ? 'Configured' : 'Not configured'}</span>
        </div>
        <div className="flex items-center justify-between">
          <span
            className={`h-2 w-2 rounded-full ${hasAgentReviewBackend ? 'bg-emerald-400' : 'bg-amber-400'}`}
          />
          <span>
            Agent Review Route: {hasAgentReviewBackend ? 'Reachable by config' : 'Not configured'}
          </span>
        </div>
      </div>
    </div>
  )

  /* ──────────────────────── JSX ──────────────────────── */
  return (
    <div
      className="app-root flex h-screen flex-col overflow-hidden bg-[var(--background)] font-['Cairo'] text-[var(--foreground)] selection:bg-[var(--brand)]/30"
      dir="rtl"
    >
      <BackgroundGrid />

      <AppHeader
        menuSections={MENU_SECTIONS}
        activeMenu={activeMenu}
        onToggleMenu={(sectionLabel) =>
          setActiveMenu((prev) => (prev === sectionLabel ? null : sectionLabel))
        }
        onAction={(actionId) => {
          void handleMenuAction(actionId as MenuActionId)
        }}
        infoDotColor={semanticColors.info}
        brandGradient={gradients.jungle}
        onlineDotColor={brandColors.jungleGreen}
      />

      <div className="app-main relative z-10 flex flex-1 overflow-hidden">
        <AppSidebar
          sections={SIDEBAR_SECTIONS}
          openSectionId={openSidebarItem}
          onToggleSection={(sectionId) =>
            setOpenSidebarItem((prev) => (prev === sectionId ? null : sectionId))
          }
          settingsPanel={settingsPanel}
        />

        <main className="app-editor-main relative flex flex-1 flex-col overflow-hidden">
          <AppDock
            buttons={DOCK_BUTTONS}
            isMobile={isMobile}
            onAction={(actionId) => {
              void handleMenuAction(actionId as MenuActionId)
            }}
          />

          <div className="app-editor-scroll scrollbar-none flex flex-1 justify-center overflow-y-auto p-8 pt-20">
            <div className="app-editor-shell relative -mt-4 w-full max-w-[850px] pb-20">
              <div ref={editorMountRef} className="editor-area app-editor-host" />
            </div>
          </div>
        </main>
      </div>

      <AppFooter
        stats={stats}
        currentFormatLabel={currentFormatLabel}
        isMobile={isMobile}
      />

      <div className="sr-only">
        {screenplayFormats.map((format) => (
          <span key={format.id}>{format.label}</span>
        ))}
      </div>
    </div>
  )
}
