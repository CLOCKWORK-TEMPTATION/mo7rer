import { Editor } from '@tiptap/core'
import { Basmala } from './extensions/basmala'
import { SceneHeaderTopLine } from './extensions/scene-header-top-line'
import { SceneHeader1 } from './extensions/scene-header-1'
import { SceneHeader2 } from './extensions/scene-header-2'
import { SceneHeader3 } from './extensions/scene-header-3'
import { Action } from './extensions/action'
import { Character } from './extensions/character'
import { Dialogue } from './extensions/dialogue'
import { Parenthetical } from './extensions/parenthetical'
import { Transition } from './extensions/transition'
import { ScreenplayCommands } from './extensions/screenplay-commands'
import { PasteClassifier } from './extensions/paste-classifier'
import { Pages } from '@tiptap-pro/extension-pages'
import {
  FOOTER_HEIGHT_PX,
  PAGE_GAP_PX,
  PAGE_HEIGHT_PX,
  PAGE_MARGIN_LEFT_PX,
  PAGE_MARGIN_RIGHT_PX,
  PAGE_WIDTH_PX,
} from './constants/page'

// الامتدادات الأساسية من Tiptap
import Document from '@tiptap/extension-document'
import Text from '@tiptap/extension-text'
import Bold from '@tiptap/extension-bold'
import Italic from '@tiptap/extension-italic'
import Underline from '@tiptap/extension-underline'

/**
 * عناصر السيناريو مع التسميات العربية
 */
export const SCREENPLAY_ELEMENTS = [
  { name: 'basmala', label: 'بسملة', shortcut: 'Ctrl+0', icon: '﷽' },
  { name: 'sceneHeaderTopLine', label: 'سطر رأس المشهد', shortcut: 'Ctrl+1', icon: '🎬' },
  { name: 'sceneHeader3', label: 'رأس المشهد (3)', shortcut: 'Ctrl+2', icon: '📍' },
  { name: 'action', label: 'حركة (Action)', shortcut: 'Ctrl+3', icon: '📝' },
  { name: 'character', label: 'شخصية (Character)', shortcut: 'Ctrl+4', icon: '👤' },
  { name: 'dialogue', label: 'حوار (Dialogue)', shortcut: 'Ctrl+5', icon: '💬' },
  { name: 'parenthetical', label: 'توصيف (Parenthetical)', shortcut: 'Ctrl+6', icon: '🎭' },
  { name: 'transition', label: 'انتقال (Transition)', shortcut: 'Ctrl+7', icon: '🔀' },
] as const

const SCREENPLAY_PAGE_FORMAT = {
  id: 'FilmlaneA4',
  width: PAGE_WIDTH_PX,
  height: PAGE_HEIGHT_PX,
  margins: {
    // Vertical reservation is handled by Pages header/footer blocks.
    top: 0,
    right: PAGE_MARGIN_RIGHT_PX,
    bottom: 0,
    left: PAGE_MARGIN_LEFT_PX,
  },
} as const

const PAGES_HEADER_HEIGHT_PX = 77
const PAGES_HEADER_TEMPLATE_V2 = `<div class="filmlane-pages-header-spacer-v2" style="min-height:${PAGES_HEADER_HEIGHT_PX}px;"></div>`
const PAGES_FOOTER_TEMPLATE = `<div class="filmlane-pages-footer-spacer" style="min-height:${FOOTER_HEIGHT_PX}px;"><span class="filmlane-pages-footer-number">{page}.</span></div>`

/**
 * إنشاء محرر السيناريو
 */
export function createScreenplayEditor(element: HTMLElement): Editor {
  // تخصيص مستند (Document) لقبول عناصر السيناريو فقط
  const ScreenplayDocument = Document.extend({
    content: '(basmala | sceneHeaderTopLine | sceneHeader3 | action | character | dialogue | parenthetical | transition)+',
  })

  const editor = new Editor({
    element,
    extensions: [
      ScreenplayDocument,
      Text,
      Bold,
      Italic,
      Underline,
      Pages.configure({
        pageFormat: SCREENPLAY_PAGE_FORMAT,
        pageGap: PAGE_GAP_PX,
        headerTopMargin: 0,
        footerBottomMargin: 0,
        pageBreakBackground: '#060808',
        header: PAGES_HEADER_TEMPLATE_V2,
        footer: PAGES_FOOTER_TEMPLATE,
      }),
      // عناصر السيناريو المخصصة
      Basmala,
      SceneHeaderTopLine,
      SceneHeader1,
      SceneHeader2,
      SceneHeader3,
      Action,
      Character,
      Dialogue,
      Parenthetical,
      Transition,
      // أوامر السيناريو واختصارات لوحة المفاتيح
      ScreenplayCommands,
      // تصنيف النص الملصوق تلقائياً
      PasteClassifier,
    ],
    content: getDefaultContent(),
    editorProps: {
      attributes: {
        class: 'tiptap',
        spellcheck: 'true',
        dir: 'rtl',
      },
    },
    autofocus: true,
  })

  return editor
}

/**
 * المحتوى الافتراضي عند فتح المحرر
 */
function getDefaultContent(): string {
  return `
    <div data-type="basmala">بسم الله الرحمن الرحيم</div>
    <div data-type="scene-header-top-line"><div data-type="scene-header-1">مشهد 1</div><div data-type="scene-header-2">ليل - خارجي</div></div>
    <div data-type="scene-header-3">شقة سيد - غرفة النوم</div>
    <div data-type="action">الغرفة مضاءة بنور خافت. أحمد يجلس على الأريكة يقرأ كتابًا. الهدوء يعمّ المكان إلا من صوت ساعة الحائط.</div>
    <div data-type="action">ينظر إلى الباب بتوجس</div>
    <div data-type="character">أحمد:</div>
    <div data-type="dialogue">من هناك؟</div>
    <div data-type="action">يُسمع طرق على الباب. أحمد يضع الكتاب جانبًا وينهض ببطء.</div>
    <div data-type="transition">قطع إلى:</div>
    <div data-type="scene-header-top-line"><div data-type="scene-header-1">مشهد 2</div><div data-type="scene-header-2">ليل - خارجي</div></div>
    <div data-type="scene-header-3">أمام المنزل - الباب الرئيسي</div>
    <div data-type="action">سارة تقف أمام الباب، تحمل حقيبة سفر. تبدو مرهقة.</div>
  `.trim()
}
