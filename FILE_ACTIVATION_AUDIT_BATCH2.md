# تقرير تدقيق تفعيل الملفات — الدفعة 2

تاريخ التوثيق: 2026-02-22
نطاق التدقيق: `src/types/*` + `src/utils/*` + ملفات الجذر الرئيسية (`App.tsx`, `editor.ts`, `main.tsx`, `toolbar.ts`, `vite-env.d.ts`)
معيار الحكم: **"مفعّل"** = يُستورد فعلياً في سلسلة التشغيل عند `pnpm dev` أو `pnpm build` ويؤثر على سلوك التطبيق.

---

## الفهرس

1. [ملخص تنفيذي](#ملخص-تنفيذي)
2. [تقرير كل ملف بالتفصيل](#تقرير-كل-ملف-بالتفصيل)
   - [src/types/](#srctypes)
   - [src/utils/](#srcutils)
   - [ملفات الجذر](#ملفات-الجذر-src)
3. [جدول المقارنة التطويرية](#جدول-المقارنة-التطويرية)
4. [الخلاصة](#الخلاصة)

---

## ملخص تنفيذي

| التصنيف | العدد | الملفات |
|---|---|---|
| **مفعّل بالكامل** | 22 | غالبية الملفات |
| **مفعّل شرطياً** (يحتاج متغيرات بيئة) | 2 | `backend-extract.ts`, `agent-review.ts` (عبر paste-classifier) |
| **غير مفعّل** (موجود لكن لا يُستورد) | 1 | `toolbar.ts` |

---

## تقرير كل ملف بالتفصيل

---

### src/types/

---

#### 1. `src/types/screenplay.ts`

| البند | القيمة |
|---|---|
| **الحالة** | مفعّل بالكامل |
| **الدور** | يُعرّف النوعين الجوهريين: `LineType` (اتحاد 10 أنواع لعناصر السيناريو) و`DocumentStats` (إحصائيات المستند: كلمات، حروف، صفحات، مشاهد). |
| **المستهلكون** | `types/index.ts` (إعادة تصدير) ← `App.tsx` (عرض الإحصائيات في الذيل) ← `EditorArea.ts` (حساب الإحصائيات) ← `paste-classifier.ts` ← `structure-pipeline.ts` ← `classification-types.ts` |
| **مستوى النضج** | مكتمل 100%. هو الأساس الذي يُبنى عليه كل شيء. |

---

#### 2. `src/types/agent-review.ts`

| البند | القيمة |
|---|---|
| **الحالة** | مفعّل شرطياً |
| **الدور** | يُعرّف حمولات الطلب والاستجابة لنقطة النهاية `/api/agent/review` التي تستخدم Claude Opus 4.6 لمراجعة الأسطر المشبوهة بعد التصنيف المحلي. |
| **المستهلكون** | `types/index.ts` (إعادة تصدير) ← `extensions/paste-classifier.ts` (استدعاء HTTP فعلي بـ `fetch()` إلى `/api/agent/review`) |
| **سبب "شرطياً"** | الكود الكامل موجود في `paste-classifier.ts` (دوال `requestAgentReview()` و`applyRemoteAgentReview()`). **لكنه لا يعمل إلا عند:** (أ) ضبط `VITE_FILE_IMPORT_BACKEND_URL` أو `VITE_AGENT_REVIEW_BACKEND_URL`، (ب) تشغيل الخادم `server/file-import-server.mjs`، (ج) وجود `ANTHROPIC_API_KEY` في بيئة الخادم. بدون ذلك، يُرجع حالة `warning` أو `skipped` بصمت. |
| **الخادم** | موجود في `server/file-import-server.mjs` (سطر 638–653) — يستقبل الطلب ويُرسله إلى `https://api.anthropic.com/v1/messages` باستخدام Claude Opus. |
| **مستوى النضج** | العميل (Frontend) مكتمل. الخادم مكتمل. **ينقصه فقط التهيئة البيئية (.env).** |

---

#### 3. `src/types/editor-clipboard.ts`

| البند | القيمة |
|---|---|
| **الحالة** | مفعّل بالكامل |
| **الدور** | يُعرّف نظام الحافظة المخصص: MIME مخصص (`application/x-filmlane-blocks+json`)، أنواع مصدر النسخ (`selection`/`document`)، مصدر اللصق (`menu`/`shortcut`/`context`/`native`)، وحمولة الحافظة الداخلية. |
| **المستهلكون** | `types/index.ts` ← `components/editor/EditorArea.ts` (دوال `copySelectionToClipboard()`, `cutSelectionToClipboard()`, `pasteFromClipboard()`) ← `editor-area.types.ts` ← `editor-engine.ts` |
| **مستوى النضج** | مكتمل 100%. نظام حافظة يحفظ التصنيف عند النسخ الداخلي. |

---

#### 4. `src/types/editor-engine.ts`

| البند | القيمة |
|---|---|
| **الحالة** | مفعّل بالكامل |
| **الدور** | يُعرّف واجهة المُهايئ `EditorEngineAdapter` التي تفصل منطق واجهة المستخدم عن تنفيذ محرك Tiptap. تشمل: `insertBlocks()`, `replaceBlocks()`, `getBlocks()`, `runCommand()`, `hasSelection()`, `copySelectionToClipboard()`, `cutSelectionToClipboard()`, `pasteFromClipboard()`. |
| **المستهلكون** | `types/index.ts` ← `App.tsx` (سطر 713: `const engine = area as unknown as EditorEngineAdapter`) ← `editor-area.types.ts` |
| **مستوى النضج** | مكتمل. نمط Adapter ناضج يسمح بتبديل محرك التحرير نظرياً. |

---

#### 5. `src/types/external-modules.d.ts`

| البند | القيمة |
|---|---|
| **الحالة** | مفعّل بالكامل |
| **الدور** | إعلانات TypeScript لحزمتين خارجيتين بدون أنماط مدمجة: `mammoth` (استخراج نص DOCX) و`pdfjs-dist/legacy/build/pdf.mjs` (استخراج طبقة نص PDF). |
| **المستهلكون** | يُقرأ تلقائياً بواسطة TypeScript عند `import('mammoth')` و`import('pdfjs-dist/...')` في `browser-extract.ts`. |
| **مستوى النضج** | مكتمل. الحزمتان موجودتان في `package.json` (mammoth@^1.11.0, pdfjs-dist@^5.4.624). |

---

#### 6. `src/types/file-import.ts`

| البند | القيمة |
|---|---|
| **الحالة** | مفعّل بالكامل |
| **الدور** | يُعرّف كل أنماط نظام استيراد الملفات: 6 صيغ مدعومة، 7 طرق استخراج، نتائج الاستخراج، طلبات/استجابات الخادم، الامتدادات المقبولة، ودالة `getFileType()`. |
| **المستهلكون** | `types/index.ts` ← `App.tsx` ← `extract/index.ts` ← `browser-extract.ts` ← `backend-extract.ts` ← `preprocessor.ts` ← `open-pipeline.ts` ← `file-picker.ts` |
| **ملاحظة مهمة** | يُعرّف طريقتي استخراج `ocr-mistral` و`doc-converter-flow` كأنماط. **كلاهما مُنفّذ فعلياً في `server/file-import-server.mjs`** (Mistral OCR لـ PDF، Antiword لـ DOC). |
| **مستوى النضج** | مكتمل 100%. |

---

#### 7. `src/types/index.ts`

| البند | القيمة |
|---|---|
| **الحالة** | مفعّل بالكامل |
| **الدور** | ملف البرميل (barrel) — يُعيد تصدير جميع الأنماط من الوحدات الفرعية ليُتيح `import { ... } from '@/types'` بدلاً من مسارات فرعية متعددة. |
| **المستهلكون** | `App.tsx`, `paste-classifier.ts`, وأي ملف يستورد من `'../types'` أو `'@/types'` |
| **مستوى النضج** | مكتمل. يُصدّر كل شيء. |

---

#### 8. `src/types/structure-pipeline.ts`

| البند | القيمة |
|---|---|
| **الحالة** | مفعّل بالكامل |
| **الدور** | يُعرّف أنماط خط أنابيب الهيكلة: سياسات الدمج (`none`/`safe`/`aggressive`)، أدوار المصنّف (`label-only`/`limited-rewrite`)، نتائج المعالجة، وتقرير حارس الإسقاط. |
| **المستهلكون** | `types/index.ts` ← `utils/file-import/structure-pipeline.ts` (التنفيذ) ← `plain-text-to-blocks.ts` |
| **مستوى النضج** | مكتمل. السياسة الافتراضية `none` + `label-only` مُعرّفة ومُستخدمة. |

---

#### 9. `src/types/typing-system.ts`

| البند | القيمة |
|---|---|
| **الحالة** | مفعّل بالكامل |
| **الدور** | يُعرّف نظام الكتابة بثلاثة أوضاع: `plain` (بدون تصنيف)، `auto-deferred` (مؤجل يدوي)، `auto-live` (حي تلقائي). يشمل الإعدادات، التطهير، والتحويل. |
| **المستهلكون** | `types/index.ts` ← `App.tsx` (قراءة/كتابة localStorage، مؤقت الخمول الحي، دالة `runDocumentThroughPasteWorkflow()`) |
| **مستوى النضج** | مكتمل ومُدمج في App.tsx. الوضع الافتراضي `plain`. الوضع `auto-live` مربوط بمؤقت خمول حقيقي. |

---

### src/utils/

---

#### 10. `src/utils/cn.ts`

| البند | القيمة |
|---|---|
| **الحالة** | مفعّل بالكامل |
| **الدور** | إعادة تصدير دالة `cn()` من `lib/utils` — تجمع بين `clsx` و`tailwind-merge` لدمج أصناف CSS بذكاء. |
| **المستهلكون** | `components/ui/hover-border-gradient.tsx` (عبر مسار `lib/utils` المباشر) |
| **مستوى النضج** | سطر واحد. وظيفي. |

---

#### 11. `src/utils/logger.ts`

| البند | القيمة |
|---|---|
| **الحالة** | مفعّل بالكامل |
| **الدور** | مسجّل أحداث مركزي بأربعة مستويات (`info`/`warn`/`error`/`debug`). مستوى `debug` مقيّد ببيئة التطوير فقط. يدعم نطاقات (scopes). |
| **المستهلكون** | `App.tsx` (تسجيل أحداث استيراد الملفات ونظام الكتابة) ← `components/editor/ScreenplayEditor.ts` |
| **مستوى النضج** | أساسي لكنه وظيفي. لا يدعم مستويات تسجيل قابلة للتهيئة أو وجهات إخراج متعددة. |

---

#### 12. `src/utils/file-import/document-model.ts`

| البند | القيمة |
|---|---|
| **الحالة** | مفعّل بالكامل |
| **الدور** | **قلب نموذج المستند.** يُعرّف `ScreenplayBlock`، حمولة التصدير/الاستيراد `ScreenplayPayloadV1` (Base64 + FNV1a checksum)، وجميع التحويلات: كتل ↔ HTML (لـ Tiptap)، كتل ↔ Payload مشفّر (للتصدير بدون فقدان). |
| **المستهلكون** | تقريباً كل ملف في النظام: `editor-clipboard.ts`, `editor-engine.ts`, `file-import.ts`, `structure-pipeline.ts`, `open-pipeline.ts`, `browser-extract.ts`, `extract/index.ts`, `plain-text-to-blocks.ts`, `EditorArea.ts` |
| **مستوى النضج** | متقدم جداً. يدعم: تطبيع ثنائي الاتجاه، فكّ أسطر top-line المُركّبة، علامة حمولة مُضمّنة `[[FILMLANE_PAYLOAD_V1:...]]`، بصمة FNV1a. |

---

#### 13. `src/utils/file-import/file-picker.ts`

| البند | القيمة |
|---|---|
| **الحالة** | مفعّل بالكامل |
| **الدور** | يفتح نافذة اختيار ملف عبر `<input type="file">` مخفي ويُعيد `Promise<File | null>`. |
| **المستهلكون** | `utils/file-import/index.ts` ← `App.tsx` (`openFile()`) |
| **مستوى النضج** | بسيط ومكتمل. |

---

#### 14. `src/utils/file-import/preprocessor.ts`

| البند | القيمة |
|---|---|
| **الحالة** | مفعّل بالكامل |
| **الدور** | معالجة مسبقة للنصوص المستوردة: دمج أسطر مكسورة، إزالة تعداد نقطي، تطبيع مسافات ترويسات المشاهد، تطبيع حوار مُعلّم بنقاط، حساب جودة النص (0–1). |
| **المستهلكون** | `extract/index.ts` (`finalizeExtraction()` → `preprocessImportedTextForClassifier()`) |
| **مستوى النضج** | متقدم. يعالج 4 أنواع ملفات بقواعد مختلفة. خوارزمية الجودة تكتشف 4 شذوذات. |

---

#### 15. `src/utils/file-import/structure-pipeline.ts`

| البند | القيمة |
|---|---|
| **الحالة** | مفعّل بالكامل |
| **الدور** | **محرك التصنيف القائم على القواعد.** يُحوّل النص الخام إلى كتل سيناريو مُصنّفة عبر آلة حالة بـ 11 أولوية: بسملة ← ترويسات متوقعة ← top-line ← header-1 ← header-2 ← header-3 ← انتقال ← إشارة متحدث ← حوار ← فعل. يتضمن حارس إسقاط لمنع الكتابة التدميرية. |
| **المستهلكون** | `plain-text-to-blocks.ts` ← `extract/index.ts` (عبر barrel) |
| **مستوى النضج** | متقدم جداً. يستورد أنماط عربية من `extensions/arabic-patterns` و`extensions/text-utils`. |

---

#### 16. `src/utils/file-import/plain-text-to-blocks.ts`

| البند | القيمة |
|---|---|
| **الحالة** | مفعّل بالكامل |
| **الدور** | غلاف مبسّط حول `buildStructuredBlocksFromText()` يُعيد مصفوفة الكتل فقط بدون metadata. |
| **المستهلكون** | `utils/file-import/index.ts` (إعادة تصدير) |
| **مستوى النضج** | سطر واحد — وظيفي. |

---

#### 17. `src/utils/file-import/open-pipeline.ts`

| البند | القيمة |
|---|---|
| **الحالة** | مفعّل بالكامل |
| **الدور** | يبني إجراء فتح الملف النهائي من نتيجة الاستخراج: `import-structured-blocks` (كتل جاهزة) أو `import-classified-text` (نص يحتاج تصنيف) أو `reject` (ملف فارغ). يشمل بيانات قياس (telemetry) ورسائل تنبيه عربية. |
| **المستهلكون** | `App.tsx` (`openFile()` → `buildFileOpenPipelineAction()`) |
| **مستوى النضج** | مكتمل. اتحاد مميّز (discriminated union) نظيف. |

---

#### 18. `src/utils/file-import/extract/browser-extract.ts`

| البند | القيمة |
|---|---|
| **الحالة** | مفعّل بالكامل |
| **الدور** | استخراج النصوص داخل المتصفح: `txt`/`fountain`/`fdx` (قراءة نصية مع كشف ترميز ذكي UTF-8 → windows-1256 → ISO-8859-1)، `docx` (mammoth)، `pdf` (pdfjs-dist text layer). يفحص Filmlane Payload Marker قبل إرجاع النص. |
| **المستهلكون** | `extract/index.ts` |
| **مستوى النضج** | متقدم. كشف ترميز ثلاثي المراحل مصمّم خصيصاً للنصوص العربية. |

---

#### 19. `src/utils/file-import/extract/backend-extract.ts`

| البند | القيمة |
|---|---|
| **الحالة** | مفعّل شرطياً |
| **الدور** | استخراج النصوص عبر خادم Backend خارجي (REST API). يُرسل الملف بـ Base64 مع مهلة 45 ثانية. يُستخدم كبديل احتياطي عند فشل المتصفح أو انخفاض الجودة. |
| **المستهلكون** | `extract/index.ts` (يُستدعى عندما `isBackendExtractionConfigured()` يُرجع `true`) |
| **سبب "شرطياً"** | يعمل فقط عند ضبط `VITE_FILE_IMPORT_BACKEND_URL`. بدونه، يُتخطّى بصمت ويعتمد التطبيق على الاستخراج في المتصفح فقط. |
| **الخادم المقابل** | `server/file-import-server.mjs` — يدعم: DOC (Antiword)، DOCX (mammoth)، PDF (Mistral OCR)، TXT/Fountain/FDX (قراءة مباشرة). |

---

#### 20. `src/utils/file-import/extract/index.ts`

| البند | القيمة |
|---|---|
| **الحالة** | مفعّل بالكامل |
| **الدور** | **المنسّق المركزي للاستخراج.** يختار الاستراتيجية: DOC → Backend فقط، PDF → متصفح أولاً + فحص جودة (عتبة 0.42) + بديل Backend، أخرى → متصفح أولاً + بديل Backend. يُطبّق المعالجة المسبقة تلقائياً عبر `finalizeExtraction()`. |
| **المستهلكون** | `utils/file-import/index.ts` (إعادة تصدير) ← `App.tsx` |
| **مستوى النضج** | متقدم. استراتيجية ذكية مع fallback متعدد المستويات. |

---

#### 21. `src/utils/file-import/index.ts`

| البند | القيمة |
|---|---|
| **الحالة** | مفعّل بالكامل |
| **الدور** | ملف برميل يُعيد تصدير كل وحدات نظام استيراد الملفات. |
| **المستهلكون** | `App.tsx` |
| **مستوى النضج** | مكتمل. |

---

### ملفات الجذر (src/)

---

#### 22. `src/App.tsx`

| البند | القيمة |
|---|---|
| **الحالة** | مفعّل بالكامل |
| **الدور** | **المكون الجذري.** يجمع: الترويسة، القائمة الرئيسية (6 أقسام)، الشريط الجانبي، شريط Dock العائم (15 زر)، منطقة المحرر، الذيل. يدير: دورة حياة EditorArea، اختصارات لوحة المفاتيح (Ctrl+0..7)، عمليات الملفات، نظام الكتابة، إحصائيات المستند. |
| **المستهلكون** | `main.tsx` |
| **مستوى النضج** | مكتمل وشامل. 1067 سطر. نمط هجين: React (غلاف) + EditorArea (حتمي/Tiptap). |

---

#### 23. `src/editor.ts`

| البند | القيمة |
|---|---|
| **الحالة** | مفعّل بالكامل |
| **الدور** | **مصنع المحرر.** يُسجّل 10 امتدادات عناصر السيناريو + Pages (A4 pagination) + ScreenplayCommands + PasteClassifier + Bold/Italic/Underline. يُصدّر `createScreenplayEditor()` و`SCREENPLAY_ELEMENTS` (8 عناصر مع تسميات عربية). |
| **المستهلكون** | `components/editor/EditorArea.ts` (يستدعي `createScreenplayEditor()`) ← `toolbar.ts` (يستورد `SCREENPLAY_ELEMENTS`) |
| **مستوى النضج** | مكتمل. |

---

#### 24. `src/main.tsx`

| البند | القيمة |
|---|---|
| **الحالة** | مفعّل بالكامل |
| **الدور** | **نقطة الدخول.** يستورد الأنماط (6 ملفات CSS)، يُهيّئ مزود السمة (dark)، يُنشئ الإشعارات، يُركّب شجرة React على `#app` في `StrictMode`. |
| **المستهلكون** | `index.html` (عبر Vite) |
| **مستوى النضج** | مكتمل. |

---

#### 25. `src/toolbar.ts`

| البند | القيمة |
|---|---|
| **الحالة** | غير مفعّل (Legacy) |
| **الدور** | شريط أدوات قديم مبني بـ Vanilla DOM (بدون React). يوفر: قائمة منسدلة لنوع العنصر، أزرار تنسيق (غامق/مائل/تسطير)، مؤشر العنصر النشط. |
| **المستهلكون** | **لا أحد.** الدالة `createToolbar()` مُصدّرة لكن **لا يستوردها أي ملف** في المشروع. |
| **سبب الوجود** | كان الشريط الأول قبل بناء شريط Dock في `App.tsx`. الوثائق تصفه بـ "بديل اختياري" (`يمكنه استدعاء createToolbar اختيارياً`). |
| **مستوى النضج** | مكتمل وظيفياً لكنه **متقادم تماماً** — شريط Dock في App.tsx أكثر تطوراً بكثير (أيقونات Lucide، تأثيرات Hover Border Gradient، 15 زر مقابل 3). |

---

#### 26. `src/vite-env.d.ts`

| البند | القيمة |
|---|---|
| **الحالة** | مفعّل بالكامل |
| **الدور** | إعلان أنماط بيئة Vite. يوفّر تعريفات TypeScript لـ `import.meta.env.VITE_*` واستيراد الأصول الثابتة. يُولَّد تلقائياً بواسطة Vite. |
| **المستهلكون** | TypeScript compiler (ضمني) |
| **مستوى النضج** | قياسي — سطر واحد. |

---

## جدول المقارنة التطويرية

### المعيار

- **متطور عنّا**: الملف يُعرّف قدرات أو بنية تتجاوز ما هو مفعّل فعلياً في التطبيق حالياً (الكود جاهز لكن مُعطّل أو يحتاج تهيئة).
- **احنا متطورين عنه**: التطبيق تجاوز هذا الملف — هناك بديل أفضل يعمل فعلياً.
- **زيّنا بالظبط**: الملف يتطابق تماماً مع مستوى التطبيق — مكتمل ومُدمج ومُستخدم.
- **حاجات مش موجودة عندنا**: يُعرّف الملف ميزات أو واجهات لا يوجد لها تنفيذ أصلاً في الكود.

---

### الملفات اللي هي متطورة عنّا (الكود جاهز لكن مش شغّال بالكامل)

| الملف | السبب |
|---|---|
| `types/agent-review.ts` | نظام مراجعة الوكيل الذكي مكتمل (عميل + خادم + Claude Opus). **لكنه نائم** — يحتاج `ANTHROPIC_API_KEY` + `VITE_FILE_IMPORT_BACKEND_URL` + تشغيل الخادم. بدون ذلك، كل استدعاء يُرجع `skipped` أو `warning`. |
| `utils/file-import/extract/backend-extract.ts` | مسار الاستخراج عبر Backend مكتمل تماماً. الخادم يدعم: OCR Mistral لـ PDF، Antiword لـ DOC. **لكنه نائم** — بدون `VITE_FILE_IMPORT_BACKEND_URL`، التطبيق يعتمد فقط على الاستخراج في المتصفح. |
| `types/typing-system.ts` | يُعرّف 3 أوضاع كتابة. الوضع `auto-live` مربوط بمؤقت حقيقي في App.tsx. **لكن الوضع الافتراضي `plain`** ولا توجد واجهة مستخدم لتغييره (الإعدادات في الشريط الجانبي مُعطّلة). |

---

### الملفات اللي احنا متطورين عنها (التطبيق تجاوزها)

| الملف | السبب |
|---|---|
| `toolbar.ts` | شريط أدوات Vanilla DOM بـ 3 أزرار — **استُبدل بالكامل** بشريط Dock في App.tsx (React + 15 زر + أيقونات Lucide + تأثيرات بصرية). لا يُستورد من أي مكان. |
| `utils/cn.ts` | سطر واحد يُعيد تصدير `cn()` من `lib/utils`. المكونات تستورد مباشرة من `lib/utils` — هذا الملف إعادة تصدير غير ضرورية. |

---

### الملفات اللي زيّنا بالظبط (مكتملة ومتوافقة)

| الملف | ملاحظة |
|---|---|
| `types/screenplay.ts` | الأساس — 10 أنواع عناصر + إحصائيات المستند |
| `types/editor-clipboard.ts` | نظام حافظة مخصص يعمل بالكامل |
| `types/editor-engine.ts` | نمط Adapter مكتمل |
| `types/external-modules.d.ts` | إعلانات مطابقة للحزم المثبتة |
| `types/file-import.ts` | كل الأنماط مُستخدمة فعلياً |
| `types/index.ts` | برميل مكتمل |
| `types/structure-pipeline.ts` | أنماط مطابقة للتنفيذ |
| `utils/file-import/document-model.ts` | قلب النموذج — متقدم ومكتمل |
| `utils/file-import/file-picker.ts` | بسيط ومكتمل |
| `utils/file-import/preprocessor.ts` | معالجة ذكية للنصوص العربية |
| `utils/file-import/structure-pipeline.ts` | محرك تصنيف قائم على القواعد |
| `utils/file-import/plain-text-to-blocks.ts` | غلاف بسيط ومكتمل |
| `utils/file-import/open-pipeline.ts` | خط أنابيب فتح الملف |
| `utils/file-import/extract/browser-extract.ts` | استخراج متصفح مع كشف ترميز عربي |
| `utils/file-import/extract/index.ts` | منسّق ذكي مع fallback |
| `utils/file-import/index.ts` | برميل مكتمل |
| `utils/logger.ts` | مسجّل أساسي وظيفي |
| `App.tsx` | المكون الجذري الشامل |
| `editor.ts` | مصنع المحرر |
| `main.tsx` | نقطة الدخول |
| `vite-env.d.ts` | إعلان بيئة قياسي |

---

### حاجات مش موجودة عندنا أصلاً (مُعرّفة لكن بدون تنفيذ في Frontend)

| الميزة | أين مُعرّفة | الوضع |
|---|---|---|
| **OCR عبر Mistral** | `types/file-import.ts` (`'ocr-mistral'`) | **مُنفّذ فقط في الخادم** (`server/file-import-server.mjs` سطر 524–538). لا يوجد كود OCR في الواجهة الأمامية. الحزمة `@mistralai/mistralai` في `package.json` لكن لا تُستورد في `src/`. |
| **تحويل DOC عبر Antiword** | `types/file-import.ts` (`'doc-converter-flow'`) | **مُنفّذ فقط في الخادم** (`server/file-import-server.mjs` سطر 438–485). الواجهة ترفض DOC في المتصفح وتُحيل للخادم. |
| **واجهة تغيير إعدادات الكتابة** | `types/typing-system.ts` | الإعدادات مُخزّنة في localStorage ومقروءة، **لكن لا توجد واجهة UI لتغييرها**. قسم "الإعدادات" في الشريط الجانبي فارغ (`items: []`). |
| **سياسة الدمج `aggressive`** | `types/structure-pipeline.ts` | مُعرّفة كنوع لكن **لا يوجد كود ينفّذها**. السياسة الافتراضية `none` فقط. |
| **سياسة المصنّف `limited-rewrite`** | `types/structure-pipeline.ts` | مُعرّفة كنوع لكن **كل التنفيذ يستخدم `label-only`**. |
| **Puppeteer** | `package.json` | الحزمة مثبتة (`puppeteer@^24.37.5`) لكن **لا تُستورد في أي ملف** — على الأرجح مخطط لتصدير PDF عبر الخادم. |
| **Bubble Menu** | `package.json` | `@tiptap/extension-bubble-menu@^3.20.0` مثبتة لكن **لا تُستورد في `editor.ts`**. |
| **Table Extension** | `package.json` | `@tiptap/extension-table@^3.20.0` مثبتة لكن **لا تُستورد في `editor.ts`**. |

---

## الخلاصة

### حالة التطبيق العامة

التطبيق **ناضج بشكل كبير** في نظامه الأساسي:
- نظام التصنيف (paste-classifier + structure-pipeline) يعمل بالكامل على الواجهة.
- نظام استيراد الملفات يدعم 5 صيغ في المتصفح (txt, fountain, fdx, docx, pdf).
- نموذج المستند (document-model) متقدم مع تشفير/فك تشفير ثنائي الاتجاه.
- الحافظة المخصصة تحفظ التصنيف عند النسخ الداخلي.

### الفجوات الرئيسية

1. **التهيئة البيئية غائبة** — لا يوجد ملف `.env` أو `.env.example` في المستودع، مما يجعل كل الميزات المعتمدة على الخادم (OCR، Agent Review، DOC) غير مفعّلة افتراضياً.
2. **3 حزم مثبتة غير مستخدمة** في الواجهة الأمامية: `@mistralai/mistralai`, `@tiptap/extension-bubble-menu`, `@tiptap/extension-table`.
3. **`toolbar.ts` ملف ميت** — يمكن حذفه بأمان.
4. **لا توجد واجهة لإعدادات نظام الكتابة** — القيمة `plain` ثابتة عملياً.
5. **سياستا الدمج والمصنّف** (`aggressive`, `limited-rewrite`) مُعرّفتان بدون تنفيذ.
