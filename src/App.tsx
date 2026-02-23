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
  AlignLeft,
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
import type { InsertActionId } from './controllers/insert-menu-controller'
import { type ElementType } from './extensions/classification-types'
import { loadFromStorage, saveToStorage, subscribeIsMobile, toast, useAutoSave, useIsMobile, useMenuCommandResolver } from './hooks'
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
  extractImportedFile,
  pickImportFile,
} from './utils/file-import'
import { logger } from './utils/logger'

/**
 * @description معرّفات أوامر القوائم — تُستخدم كمفاتيح موحدة لتوزيع الأوامر
 *   في `handleMenuAction`. تدعم الأوامر الثابتة (مثل `undo`) والديناميكية
 *   (مثل `format:action` و`insert-template:*`) عبر القوالب النصية.
 */
type MenuActionId =
  | 'new-file'
  | 'open-file'
  | 'insert-file'
  | 'save-file'
  | 'print-file'
  | 'export-html'
  | 'export-docx'
  | 'export-pdf'
  | 'undo'
  | 'redo'
  | 'copy'
  | 'cut'
  | 'paste'
  | 'select-all'
  | 'bold'
  | 'italic'
  | 'underline'
  | 'align-right'
  | 'align-center'
  | 'align-left'
  | 'quick-cycle-format'
  | 'show-draft-info'
  | 'tool-auto-check'
  | 'tool-reclassify'
  | 'help-shortcuts'
  | 'about'
  | `format:${string}`
  | InsertActionId

type ExportFormat = 'html' | 'docx' | 'pdf'

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

const FORMAT_CYCLE_ORDER: readonly ElementType[] = [
  'basmala',
  'sceneHeaderTopLine',
  'sceneHeader3',
  'action',
  'character',
  'dialogue',
  'parenthetical',
  'transition',
]

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

const INSERT_ICON_GLYPH_BY_ID: Readonly<Record<EditorStyleFormatId, string>> = {
  basmala: '✧',
  'scene-header-1': '◫',
  'scene-header-2': '▭',
  'scene-header-3': '☰',
  action: '≡',
  character: '◉',
  dialogue: '◌',
  parenthetical: '☷',
  transition: '⟶',
  'scene-header-top-line': '▦',
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
  const actionId = `${definition.insertBehavior}:${definition.id}` as const
  return {
    label: definition.label,
    actionId,
    iconGlyph: INSERT_ICON_GLYPH_BY_ID[definition.id] ?? '•',
  }
})

const FORMAT_MENU_ITEMS: readonly AppShellMenuItem[] = [
  { label: 'غامق', actionId: 'bold', iconGlyph: 'B' },
  { label: 'مائل', actionId: 'italic', iconGlyph: 'I' },
  { label: 'محاذاة لليمين', actionId: 'align-right', iconGlyph: '≣' },
  { label: 'توسيط', actionId: 'align-center', iconGlyph: '≡' },
  { label: 'محاذاة لليسار', actionId: 'align-left', iconGlyph: '☰' },
]

const TOOL_MENU_ITEMS: readonly AppShellMenuItem[] = [
  { label: 'فحص تلقائي', actionId: 'tool-auto-check', iconGlyph: '⌁' },
  { label: 'إعادة تصنيف', actionId: 'tool-reclassify', iconGlyph: '↻' },
]

const HELP_MENU_ITEMS: readonly AppShellMenuItem[] = [
  { label: 'عن المحرر', actionId: 'about', iconGlyph: '?' },
  { label: 'اختصارات لوحة المفاتيح', actionId: 'help-shortcuts', iconGlyph: '⌨' },
]

/** أقسام القائمة الرئيسية: ملف، تعديل، إضافة، تنسيق، أدوات، مساعدة */
const MENU_SECTIONS: readonly AppShellMenuSection[] = [
  {
    label: 'ملف',
    items: [
      { label: 'مستند جديد', actionId: 'new-file' },
      { label: 'فتح...', actionId: 'open-file' },
      { label: 'إدراج ملف...', actionId: 'insert-file' },
      { label: 'حفظ', actionId: 'save-file' },
      { label: 'طباعة', actionId: 'print-file' },
      { label: 'تصدير HTML', actionId: 'export-html' },
      { label: 'تصدير DOCX', actionId: 'export-docx' },
      { label: 'تصدير PDF', actionId: 'export-pdf' },
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
    label: 'إضافة',
    items: INSERT_MENU_ITEMS,
  },
  {
    label: 'تنسيق',
    items: FORMAT_MENU_ITEMS,
  },
  {
    label: 'أدوات',
    items: TOOL_MENU_ITEMS,
  },
  {
    label: 'مساعدة',
    items: HELP_MENU_ITEMS,
  },
]

/* ── تهيئة أزرار شريط Dock العائم ── */

/** واجهة زر في شريط Dock — أيقونة + عنوان + معرّف أمر */
/** قائمة أزرار شريط Dock العائم — مرتبة حسب المجموعة: وسائط، أدوات، إجراءات، تنسيق، معلومات */
const DOCK_BUTTONS: readonly AppDockButtonItem[] = [
  // وسائط وتصدير
  { actionId: 'quick-cycle-format', icon: Clapperboard, title: 'تبديل التنسيق المباشر' },
  { actionId: 'export-pdf', icon: Download, title: 'تصدير PDF' },
  // أدوات
  { actionId: 'tool-auto-check', icon: Stethoscope, title: 'تحليل السيناريو' },
  { actionId: 'tool-reclassify', icon: Lightbulb, title: 'إعادة تصنيف المستند' },
  // إجراءات
  { actionId: 'help-shortcuts', icon: MessageSquare, title: 'الاختصارات' },
  { actionId: 'show-draft-info', icon: History, title: 'معلومات المسودة' },
  { actionId: 'open-file', icon: Upload, title: 'فتح ملف' },
  { actionId: 'save-file', icon: Save, title: 'حفظ الملف' },
  // تنسيق
  { actionId: 'undo', icon: Undo2, title: 'تراجع' },
  { actionId: 'redo', icon: Redo2, title: 'إعادة' },
  { actionId: 'bold', icon: Bold, title: 'غامق' },
  { actionId: 'italic', icon: Italic, title: 'مائل' },
  { actionId: 'align-right', icon: AlignRight, title: 'محاذاة لليمين' },
  { actionId: 'align-center', icon: AlignCenter, title: 'توسيط' },
  { actionId: 'align-left', icon: AlignLeft, title: 'محاذاة لليسار' },
  // معلومات
  { actionId: 'about', icon: Info, title: 'عن المحرر' },
]

/* ── تهيئة أقسام الشريط الجانبي ── */

/** أقسام الشريط الجانبي: المستندات الأخيرة، المشاريع، المكتبة، الإعدادات */
const SIDEBAR_SECTIONS: readonly AppSidebarSection[] = [
  { id: 'docs', label: 'المستندات الأخيرة', icon: FileText, items: ['سيناريو فيلم.docx', 'مسودة الحلقة الأولى.docx', 'مشاهد مُصنفة.txt'] },
  { id: 'projects', label: 'المشاريع', icon: List, items: ['فيلم الرحلة', 'مسلسل الحارة', 'ورشة أفان تيتر'] },
  { id: 'library', label: 'المكتبة', icon: BookOpen, items: ['قوالب المشاهد', 'الشخصيات', 'الملاحظات'] },
  { id: 'settings', label: 'الإعدادات', icon: Settings, items: [] },
] as const

const PROJECT_TEMPLATE_BY_NAME = {
  'فيلم الرحلة': {
    sceneHeader1: 'مشهد 1',
    sceneHeader2: 'ليل - خارجي',
    sceneHeader3: 'محطة القطار',
    action: 'البطل يجر حقيبته الثقيلة ويتطلع إلى القطار الأخير قبل المغادرة.',
  },
  'مسلسل الحارة': {
    sceneHeader1: 'مشهد 1',
    sceneHeader2: 'نهار - خارجي',
    sceneHeader3: 'الحارة القديمة',
    action: 'أصوات الباعة تختلط مع ضحكات الأطفال بينما تتحرك الكاميرا بين الأزقة.',
  },
  'ورشة أفان تيتر': {
    sceneHeader1: 'مشهد 1',
    sceneHeader2: 'نهار - داخلي',
    sceneHeader3: 'قاعة التدريب',
    action: 'المشاركون يفتحون حواسيبهم وتبدأ جلسة الكتابة الجماعية على السبورة.',
  },
} as const

const LIBRARY_ACTION_BY_ITEM = {
  'قوالب المشاهد': 'insert-template:scene-header-1',
  'الشخصيات': 'insert-template:character',
  'الملاحظات': 'insert-template:action',
} as const satisfies Record<string, InsertActionId>

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

    const rafId = window.requestAnimationFrame(() => {
      void area
        .importClassifiedText(snapshot.text, 'replace')
        .then(() => {
          toast({
            title: 'تمت استعادة المسودة',
            description: 'استرجعنا آخر نسخة محفوظة تلقائيًا.',
          })
        })
        .catch((error) => {
          logger.warn('Autosave restore skipped due early editor lifecycle error', {
            scope: 'autosave',
            data: error,
          })
        })
    })

    return () => {
      window.cancelAnimationFrame(rafId)
    }
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
    (import.meta.env.VITE_FILE_IMPORT_BACKEND_URL as string | undefined)?.trim() ||
    (import.meta.env.DEV ? 'http://127.0.0.1:8787/api/file-extract' : '')
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
      let appliedPipeline: 'open-pipeline-structured' | 'paste-classifier' = 'paste-classifier'

      if (action.kind === 'reject') {
        toast(action.toast)
        return
      }

      if (action.kind === 'import-structured-blocks') {
        area.importStructuredBlocks(action.blocks, mode)
        appliedPipeline = 'open-pipeline-structured'
      } else {
        // open/import for raw text mirrors paste-classifier in a single pass.
        await area.importClassifiedText(action.text, mode)
        appliedPipeline = 'paste-classifier'
      }

      toast({
        ...action.toast,
      })

      logger.info('File import pipeline completed', {
        scope: 'file-import',
        data: {
          ...action.telemetry,
          appliedPipeline,
        },
      })
    } catch (error) {
      const rawMessage =
        error instanceof Error ? error.message : 'حدث خطأ غير معروف أثناء فتح الملف.'
      const fileExtension = file.name.split('.').pop()?.toLowerCase() ?? ''
      const backendRelatedFailure =
        /failed to fetch|backend|connection|timed out|err_connection_refused/i.test(rawMessage) &&
        (fileExtension === 'doc' || fileExtension === 'pdf')
      const message = backendRelatedFailure
        ? `${rawMessage}\nفي التطوير المحلي: استخدم pnpm dev (يشغّل backend تلقائيًا).`
        : rawMessage
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

  const runExport = async (format: ExportFormat, fileBase?: string): Promise<void> => {
    const area = editorAreaRef.current
    if (!area) return

    const html = area.getAllHtml().trim()
    if (!html) {
      toast({ title: 'لا يوجد محتوى', description: 'اكتب شيئًا أولًا قبل الحفظ.', variant: 'destructive' })
      return
    }

    try {
      const { exportDocument } = await import('./utils/exporters')
      await exportDocument(
        {
          html,
          text: area.getAllText(),
          blocks: area.getBlocks(),
          fileNameBase: fileBase,
          title: 'تصدير محرر السيناريو',
        },
        format,
      )

      const labelByFormat: Record<ExportFormat, string> = {
        html: 'HTML',
        docx: 'DOCX',
        pdf: 'PDF',
      }
      toast({
        title: 'تم التصدير',
        description: `تم تصدير الملف بصيغة ${labelByFormat[format]}.`,
      })
    } catch (error) {
      toast({
        title: 'تعذر التصدير',
        description: error instanceof Error ? error.message : 'حدث خطأ غير معروف أثناء التصدير.',
        variant: 'destructive',
      })
      logger.error('Document export failed', {
        scope: 'export',
        data: { format, error },
      })
    }
  }

  const resolveMenuCommand = useMenuCommandResolver(editorAreaRef, toast)

  /* ── Menu action dispatcher ── */
  const handleMenuAction = async (actionId: MenuActionId): Promise<void> => {
    const area = editorAreaRef.current
    if (!area) return
    const engine = area as unknown as EditorEngineAdapter

    setActiveMenu(null)

    if (resolveMenuCommand(actionId)) {
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
        await runExport('html', 'screenplay')
        break
      case 'print-file':
        window.print()
        break
      case 'export-html':
        await runExport('html', 'screenplay-export')
        break
      case 'export-docx':
        await runExport('docx', 'screenplay-export')
        break
      case 'export-pdf':
        await runExport('pdf', 'screenplay-export')
        break
      case 'undo':
      case 'redo':
        engine.runCommand({ command: actionId })
        break
      case 'bold':
      case 'italic':
      case 'underline':
      case 'align-right':
      case 'align-center':
      case 'align-left':
        area.runCommand(actionId)
        break
      case 'quick-cycle-format': {
        const current = area.getCurrentFormat()
        const currentIndex = current ? FORMAT_CYCLE_ORDER.indexOf(current) : -1
        const nextFormat =
          currentIndex >= 0
            ? FORMAT_CYCLE_ORDER[(currentIndex + 1) % FORMAT_CYCLE_ORDER.length]
            : FORMAT_CYCLE_ORDER[0]

        area.setFormat(nextFormat)
        toast({
          title: 'تبديل التنسيق',
          description: `تم التحويل إلى: ${FORMAT_LABEL_BY_TYPE[nextFormat]}`,
        })
        break
      }
      case 'show-draft-info': {
        const snapshot = loadFromStorage<EditorAutosaveSnapshot | null>(
          AUTOSAVE_DRAFT_STORAGE_KEY,
          null,
        )
        if (!snapshot?.updatedAt) {
          toast({
            title: 'معلومات المسودة',
            description: 'لا توجد مسودة محفوظة تلقائيًا حتى الآن.',
          })
          break
        }

        const updatedAtLabel = new Date(snapshot.updatedAt).toLocaleString('ar-EG')
        toast({
          title: 'معلومات المسودة',
          description: `آخر حفظ تلقائي: ${updatedAtLabel}`,
        })
        break
      }
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
      case 'help-shortcuts':
        toast({
          title: 'اختصارات سريعة',
          description:
            'Ctrl+S حفظ، Ctrl+O فتح، Ctrl+N مستند جديد، Ctrl+Z تراجع، Ctrl+Y إعادة، Ctrl+B/I/U تنسيق.',
        })
        break
      case 'tool-auto-check':
        await runDocumentThroughPasteWorkflow({
          source: 'manual-deferred',
          reviewProfile: 'interactive',
          policyProfile: 'strict-structure',
        })
        break
      case 'tool-reclassify':
        await runDocumentThroughPasteWorkflow({
          source: 'manual-deferred',
          reviewProfile: 'interactive',
          policyProfile: 'interactive-legacy',
        })
        break
      default:
        break
    }
  }

  const handleSidebarItemAction = async (
    sectionId: string,
    itemLabel: string,
  ): Promise<void> => {
    const area = editorAreaRef.current
    if (!area) return

    if (sectionId === 'docs') {
      const mode: FileImportMode = itemLabel.endsWith('.txt') ? 'insert' : 'replace'
      toast({
        title: 'اختر الملف',
        description: `سيتم ${mode === 'replace' ? 'فتح' : 'إدراج'} "${itemLabel}" بعد اختياره من جهازك.`,
      })
      await openFile(mode)
      return
    }

    if (sectionId === 'projects') {
      const template =
        PROJECT_TEMPLATE_BY_NAME[itemLabel as keyof typeof PROJECT_TEMPLATE_BY_NAME]
      if (!template) {
        toast({
          title: 'المشروع غير متاح',
          description: `لا يوجد قالب جاهز للمشروع "${itemLabel}".`,
          variant: 'destructive',
        })
        return
      }

      const html = `
        <div data-type="scene-header-top-line"><div data-type="scene-header-1">${template.sceneHeader1}</div><div data-type="scene-header-2">${template.sceneHeader2}</div></div>
        <div data-type="scene-header-3">${template.sceneHeader3}</div>
        <div data-type="action">${template.action}</div>
      `.trim()

      area.editor.commands.setContent(html)
      area.editor.commands.focus('end')
      toast({
        title: 'تم تحميل المشروع',
        description: `تم فتح قالب "${itemLabel}" داخل المحرر.`,
      })
      return
    }

    if (sectionId === 'library') {
      const actionId = LIBRARY_ACTION_BY_ITEM[itemLabel as keyof typeof LIBRARY_ACTION_BY_ITEM]
      if (actionId) {
        await handleMenuAction(actionId)
        return
      }
    }

    toast({
      title: 'إجراء غير معرف',
      description: `لا يوجد إجراء مرتبط بالعنصر "${itemLabel}" حالياً.`,
      variant: 'destructive',
    })
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
          onItemAction={(sectionId, itemLabel) => {
            void handleSidebarItemAction(sectionId, itemLabel)
          }}
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
