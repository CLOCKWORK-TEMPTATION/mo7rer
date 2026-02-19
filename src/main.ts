// استيراد الأنماط
import './styles/main.css'
import './styles/toolbar.css'
import './styles/page.css'

// استيراد المحرر وشريط الأدوات
import { createScreenplayEditor } from './editor'
import { createToolbar } from './toolbar'

/**
 * نقطة الدخول الرئيسية - تهيئة محرر السيناريو
 */
function init(): void {
  const editorElement = document.getElementById('editor')
  const toolbarElement = document.getElementById('toolbar')

  if (!editorElement || !toolbarElement) {
    console.error('لم يتم العثور على عناصر المحرر أو شريط الأدوات')
    return
  }

  // إنشاء المحرر
  const editor = createScreenplayEditor(editorElement)

  // إنشاء شريط الأدوات
  createToolbar(toolbarElement, editor)

  // إضافة اختصارات لوحة المفاتيح لتغيير نوع العنصر
  document.addEventListener('keydown', (e: KeyboardEvent) => {
    if (!e.ctrlKey) return

    const shortcuts: Record<string, string> = {
      '0': 'setBasmala',
      '1': 'setSceneHeaderTopLine',
      '2': 'setSceneHeader3',
      '3': 'setAction',
      '4': 'setCharacter',
      '5': 'setDialogue',
      '6': 'setParenthetical',
      '7': 'setTransition',
    }

    const command = shortcuts[e.key]
    if (command) {
      e.preventDefault()
      const commandFn = editor.commands[command as keyof typeof editor.commands] as (() => boolean) | undefined
      if (commandFn) {
        commandFn()
      }
    }
  })

  // عرض رسالة في وحدة التحكم
  console.log('✅ محرر السيناريو جاهز للعمل')
  console.log('💡 استخدم Tab للتنقل بين أنواع العناصر')
  console.log('💡 استخدم Ctrl+0 إلى Ctrl+8 لاختيار نوع العنصر مباشرة')
}

// تشغيل عند جاهزية الصفحة
document.addEventListener('DOMContentLoaded', init)
