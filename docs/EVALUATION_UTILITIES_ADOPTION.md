# تقييم Utilities إضافية

تاريخ التقييم: 2026-02-22  
النطاق: `storage.ts` و `typing-workflow-rules.ts` و `context-window.ts` (كمفاهيم تبنّي).

## الخلاصة

- `storage`:
  - الحالة الحالية كافية للإنتاج عبر:
    - `src/hooks/use-local-storage.ts`
    - autosave + restore في `src/App.tsx`
  - لا توجد فجوة حرجة تمنع الإنتاج الآن.
- `typing-workflow-rules`:
  - السلوك الحالي مفعل عبر:
    - `typingSystemMode` (`plain`, `auto-deferred`, `auto-live`)
    - `runDocumentThroughPasteWorkflow` في `src/App.tsx`
  - لا حاجة حالية لملف rules منفصل إضافي طالما القواعد مستقرة.
- `context-window`:
  - توجد تغطية سياقية وظيفية في طبقات التصنيف الحالية:
    - `src/extensions/context-memory-manager.ts`
    - `src/extensions/classification-core.ts`
  - يمكن إضافة `context-window` لاحقًا عند احتياج دقيق لإدارة token budgets مع LLM.

## قرار الإنتاج

- **لا تبنّي إلزامي حاليًا** لهذه الملفات كنسخ جديدة.
- **تبنّي المفهوم تم بالفعل** بشكل مكافئ داخل المسار الحالي.
- القرار: الاحتفاظ بالوضع الحالي + إعادة تقييم فقط عند ظهور متطلبات جديدة.

## نقاط متابعة

1. عند زيادة حجم المستندات أو latency في `auto-live`: نضيف طبقة rules منفصلة.
2. عند إدخال LLM طويل السياق: نفعّل `context-window` كطبقة مستقلة.
3. عند تعدد مصادر التخزين (cloud drafts): نفصل `storage` إلى service مستقل.
