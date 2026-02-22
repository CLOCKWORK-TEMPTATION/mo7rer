# تقرير تفعيل الملفات (جذر المستودع)

تاريخ التوثيق: 2026-02-21  
معيار الحكم: "مفعل في التطبيق" = يدخل مباشرة في التشغيل/البناء أو سلوك التطبيق عند `pnpm dev` و`pnpm build`.

## الدفعة 1

| الملف | مفعل في التطبيق؟ | دوره | سبب الوجود لو غير مفعل | توصية قرار |
|---|---|---|---|---|
| `.env` | نعم (شرطي) | يزوّد متغيرات البيئة للواجهة عبر `VITE_*`، ولخادم الاستيراد عبر `dotenv` عند تشغيل `server/file-import-server.mjs`. | — | الاحتفاظ به محليًا فقط (غير متعقّب في Git). |
| `.gitignore` | لا | يحدد ما يجب تجاهله في Git (logs, dist, env, إلخ). | ملف إدارة مستودع وليس جزءًا من تشغيل التطبيق. | الاحتفاظ به. |
| `.npmrc` | لا (تشغيل) / نعم (تثبيت) | يضبط Registry وتوكن حزمة Tiptap Pro أثناء `pnpm install`. | ملف بيئة تطوير لتثبيت التبعيات الخاصة. | الاحتفاظ به محليًا فقط (غير متعقّب). |
| `after-long-fill.png` | لا | صورة ثابتة غير مستوردة في الكود. | كانت لقطة اختبار/توثيق بصري قديم. | تم الحذف (قرار معتمد). |
| `dev-local.log` | لا | سجل تشغيل محلي. | ناتج مؤقت من تشغيل محلي وليس جزءًا من التطبيق. | الاحتفاظ محليًا فقط (غير متعقّب). |
| `index.html` | نعم | قالب الدخول الرئيسي لتطبيق Vite ويحمّل `src/main.tsx`. | — | الاحتفاظ به. |
| `package.json` | نعم | تعريف المشروع والسكريبتات والتبعيات (`dev`, `build`, `preview`). | — | الاحتفاظ به. |
| `pnpm-lock.yaml` | نعم (بناء/تثبيت) | يثبّت نسخ التبعيات لضمان reproducible installs في التطوير وCI. | — | الاحتفاظ به وتعقّبه. |
| `postcss.config.mjs` | نعم | يفعّل PostCSS plugins (`tailwindcss`, `autoprefixer`) أثناء معالجة CSS. | — | الاحتفاظ به. |
| `README.md` | لا | توثيق المشروع للمطورين. | ملف توثيق وليس جزء تشغيل. | الاحتفاظ به. |
| `tailwind.config.ts` | نعم | يحدد content scanning + theme tokens المستخدمة في CSS/Tailwind classes. | — | الاحتفاظ به. |
| `tmp_pdf_page1.png` | لا | صورة ثابتة غير مستوردة في الكود. | كان ناتجًا مؤقتًا من اختبار استخراج PDF/معاينة. | تم الحذف (قرار معتمد). |
| `tsconfig.json` | نعم (بناء/تحقق) | إعدادات TypeScript المستخدمة في `tsc` ضمن `pnpm build` وأدوات التطوير. | — | الاحتفاظ به. |
| `vite.config.ts` | نعم | إعدادات Vite (plugins, alias, dev server port). | — | الاحتفاظ به. |

## أدلة سريعة (References)

- متغيرات البيئة في الواجهة: `src/extensions/paste-classifier.ts:34`, `src/extensions/paste-classifier.ts:37`, `src/utils/file-import/extract/backend-extract.ts:8`  
- تحميل `.env` في السيرفر: `server/file-import-server.mjs:8`, `server/file-import-server.mjs:12`  
- نقطة الدخول من HTML: `index.html:13`  
- سكربتات التشغيل والبناء: `package.json:9`, `package.json:10`  
- تفعيل Tailwind في CSS (مصدر واحد): `src/styles/globals.css:1`, `src/main.tsx:21`, `src/styles/system.css:8`  
- plugins الخاصة بـ PostCSS: `postcss.config.mjs:4`, `postcss.config.mjs:5`

## ملاحظات قرار

تم اعتماد حذف `after-long-fill.png` و`tmp_pdf_page1.png` من المستودع لأنهما غير مستخدمين برمجيًا.

## الدفعة 2 (ملفات السكربتات)

| الملف | مفعل في التطبيق؟ | دوره | سبب الوجود لو غير مفعل | توصية قرار |
|---|---|---|---|---|
| `scripts/build-antiword-linux.ps1` | نعم (يدوي/تشغيلي) | يبني نسخة Linux من `antiword` عبر WSL (`gcc` + `make`) وينسخ الـ binary والـ Resources إلى `.tools/antiword-app/` لدعم تحويل ملفات `.doc` في Backend. | — | الاحتفاظ به. |
| `scripts/build-antiword-windows.ps1` | نعم (يدوي/تشغيلي) | يبني `antiword.exe` على Windows بعدة مسارات بديلة (MSVC ثم MSYS2 ثم Zig) ثم ينسخ المخرجات إلى `.tools/antiword-app/`. | — | الاحتفاظ به. |
| `scripts/build-antiword.ps1` | نعم (يدوي/تشغيلي) | سكربت orchestrator يشغّل Windows + Linux build مع تجميع التحذيرات بدل الإيقاف الكامل. | — | الاحتفاظ به. |
| `scripts/smoke-extract.ps1` | نعم (يدوي + CI) | Smoke test لواجهة `/api/file-extract` ويرسل ملفات `doc/docx/pdf` كـ Base64، ويتحقق من نجاح الاستجابة ومن `method` المتوقع لكل نوع ملف، ويُرجع exit code غير صفري عند الفشل. | — | تم التفعيل فعليًا بإضافة Fixtures وربطه في CI. |

## أدلة سريعة (الدفعة 2)

- تعريف أوامر NPM: `package.json:13`, `package.json:14`, `package.json:15`, `package.json:16`  
- استدعاء السكربت التجميعي لسكريبتَي النظامين: `scripts/build-antiword.ps1:8`, `scripts/build-antiword.ps1:9`  
- اعتماد Backend على antiword في DOC extraction: `server/file-import-server.mjs:321`, `server/file-import-server.mjs:374`, `server/file-import-server.mjs:570`  
- تعريف الأوامر التي تفعل الاختبار: `package.json:16`  
- وجود Fixtures: `tests/fixtures/regression/12.doc`, `tests/fixtures/regression/12.docx`, `tests/fixtures/regression/12.pdf`  
- ربط CI: `.github/workflows/smoke-extract.yml`

## الدفعة 3 (خدمة الاستخراج الخلفية)

| الملف | مفعل في التطبيق؟ | دوره | سبب الوجود لو غير مفعل | توصية قرار |
|---|---|---|---|---|
| `server/file-import-server.mjs` | نعم (خدمة مستقلة Optional Runtime + CI) | خادم HTTP محلي لعمليات الاستيراد والمراجعة: 1) استخراج نص من `txt/fountain/fdx/docx/pdf/doc` عبر مسارات متعددة (`native`, `mammoth`, `mistral OCR`, `antiword`)، 2) endpoint مراجعة تصنيفات عبر Anthropic، 3) endpoint `health` لإعلان جاهزية OCR وantiword. | — | الاحتفاظ به كجزء أساسي من مسار استيراد الملفات والمراجعة. |

## أدلة سريعة (الدفعة 3)

- تشغيل الخدمة عبر سكربت npm: `package.json:12`  
- استهلاكها من الواجهة عبر `VITE_FILE_IMPORT_BACKEND_URL`: `src/utils/file-import/extract/backend-extract.ts:8`, `src/extensions/paste-classifier.ts:37`  
- نقاط النهاية الفعلية: `server/file-import-server.mjs:673`, `server/file-import-server.mjs:678`  
- تشغيلها داخل CI smoke: `.github/workflows/smoke-extract.yml:58`

## الدفعة 4 (ملفات التوثيق داخل docs)

| الملف | مفعل في التطبيق؟ | دوره | سبب الوجود لو غير مفعل | توصية قرار |
|---|---|---|---|---|
| `docs/_inventory_files.txt` | لا (Runtime) | جرد ملفات المشروع الناتج عن `git ls-files` لدعم أعمال التوثيق والتحليل البنيوي. | Artifact توثيقي/تحليلي وليس جزءًا من مسار تشغيل التطبيق. | الاحتفاظ به إذا فريق التوثيق يستخدمه باستمرار؛ وإلا يمكن إعادة توليده عند الحاجة فقط. |
| `docs/_tree_L4.txt` | لا (Runtime) | لقطة شجرة المجلدات حتى عمق 4 مستويات، تُستخدم كمرجع سريع أثناء التوثيق. | Artifact توثيقي/تحليلي وليس جزءًا من التنفيذ. | نفس قرار `_inventory_files.txt`: الاحتفاظ أو إعادة توليد عند الحاجة. |
| `docs/CORE_MECHANISM.md` | لا (Runtime) / نعم (توثيقيًا) | يشرح آلية العمل الأساسية ومسارات التنفيذ والـADRs والمخططات المعمارية. | مرجع هندسي للمطورين والتسليم المعرفي، وليس ملف تشغيل. | الاحتفاظ به وتحديثه عند أي تغييرات معمارية. |
| `docs/FILE_RELATIONS.md` | لا (Runtime) / نعم (توثيقيًا) | خرائط علاقات الملفات والمجلدات بناءً على import statements الفعلية. | مرجع صيانة وتتبّع اعتمادية، وليس جزءًا من runtime. | الاحتفاظ به وتحديثه عند تغييرات الهيكل/الاستيرادات. |
| `docs/PROGRESS.md` | لا (Runtime) / نعم (توثيقيًا) | سجل خطة وسير تقدم التوثيق + قوائم التحقق والمخرجات. | ملف إدارة عملية التوثيق الداخلية. | الاحتفاظ به فقط إذا مسار التوثيق مستمر داخل نفس المستودع. |

## أدلة سريعة (الدفعة 4)

- ربط ملفات docs من التوثيق الرئيسي الموحد: `README.md:277`, `README.md:278`, `README.md:279`  
- تعريف توليد `_inventory_files.txt` و`_tree_L4.txt`: `docs/PROGRESS.md:33`, `docs/PROGRESS.md:34`  
- جميع ملفات الدفعة 4 حالتها الحالية: `UNTRACKED` (لم تُضف بعد إلى Git)

## الدفعة 5 (مجلد src/components/editor)

| الملف | مفعل في التطبيق؟ | دوره | سبب الوجود لو غير مفعل | توصية قرار |
|---|---|---|---|---|
| `src/components/editor/ConfirmationDialog.ts` | لا (Runtime الحالي) | نافذة تأكيد تصنيف للسطر (اقتراح/إلغاء) عبر `ClassificationConfirmationDialog`. | مستخدم داخل المسار البديل `ScreenplayEditor` فقط، وهذا المسار غير مربوط حاليًا من `App.tsx`. | الاحتفاظ مؤقتًا إن كنتم ستعودون لمسار `ScreenplayEditor`، أو أرشفته/حذفه مع تنظيف التبعيات. |
| `src/components/editor/editor-area.types.ts` | نعم | تعريف عقود `EditorArea` (`EditorHandle`, `DocumentStats`, أوامر المحرر، أنماط الاستيراد). | — | الاحتفاظ به (ملف contract أساسي). |
| `src/components/editor/EditorArea.ts` | نعم | المحرك الفعلي الحالي للمحرر: إنشاء Tiptap، إدارة الاستيراد، الإحصائيات، pagination، widow-fix، وأوامر التنسيق. | — | الاحتفاظ به (قلب التحرير الحالي). |
| `src/components/editor/EditorFooter.ts` | لا (Runtime الحالي) | مكون ذيل حتمي يعرض الإحصائيات والعنصر الحالي. | مستخدم فقط عبر `ScreenplayEditor` غير المربوط حاليًا. | الاحتفاظ المؤقت أو دمج منطقه في React بالكامل ثم حذفه. |
| `src/components/editor/EditorHeader.ts` | لا (Runtime الحالي) | ترويسة حتمية بالقوائم المنسدلة وإجراءات الملف/المستخدم. | جزء من واجهة class-based البديلة، بينما الواجهة الحالية React داخل `App.tsx`. | مرشح للتنظيف إذا تم اعتماد React Shell نهائيًا. |
| `src/components/editor/EditorSidebar.ts` | لا (Runtime الحالي) | شريط جانبي حتمي مع أقسام وبحث وبطاقة مساعدة. | مستخدم فقط داخل `ScreenplayEditor`. | نفس قرار `EditorHeader.ts`. |
| `src/components/editor/EditorToolbar.ts` | لا (Runtime الحالي) | شريط أدوات حتمي (أيقونات + أفعال + format select). | غير مستخدم في المسار الحالي الذي يبني Toolbar React داخل `App.tsx`. | نفس قرار `EditorHeader.ts`. |
| `src/components/editor/index.ts` | لا (Runtime الحالي) | Barrel exports لتجميع مكونات `components/editor`. | لا يوجد أي import فعلي له في شجرة التشغيل الحالية. | يمكن إبقاؤه تحضيرًا لإعادة الاستعمال، أو حذفه إن لم يُستخدم. |
| `src/components/editor/ScreenplayEditor.ts` | لا (Runtime الحالي) | Orchestrator class-based يجمع `EditorHeader/Toolbar/Sidebar/Footer/EditorArea` في واجهة كاملة خارج React. | يبدو مسارًا معماريًا أقدم/بديلًا؛ غير مستدعى من `src/main.tsx`/`src/App.tsx`. | قرار مشترك مطلوب: إما تفعيله بدل `App.tsx` أو تنظيفه تدريجيًا. |

## أدلة سريعة (الدفعة 5)

- المسار الفعلي الحالي يستورد `EditorArea` مباشرة: `src/App.tsx:54`, `src/App.tsx:316`  
- اعتماد الأنواع من `editor-area.types.ts`: `src/App.tsx:56`  
- ملفات `EditorHeader/EditorToolbar/EditorSidebar/EditorFooter/ConfirmationDialog` مستوردة داخل `ScreenplayEditor` فقط: `src/components/editor/ScreenplayEditor.ts:8`, `src/components/editor/ScreenplayEditor.ts:9`, `src/components/editor/ScreenplayEditor.ts:10`, `src/components/editor/ScreenplayEditor.ts:12`, `src/components/editor/ScreenplayEditor.ts:13`, `src/components/editor/ScreenplayEditor.ts:15`  
- لا يوجد ربط فعلي لـ `ScreenplayEditor` أو `index.ts` في نقطة الدخول الحالية (`src/main.tsx` → `src/App.tsx`).

## الدفعة 6 (مجلد src/constants)

| الملف | مفعل في التطبيق؟ | دوره | سبب الوجود لو غير مفعل | توصية قرار |
|---|---|---|---|---|
| `src/constants/colors.ts` | نعم | لوحة ألوان/تدرجات جاهزة (`colors`, `brandColors`, `semanticColors`, `highlightColors`, `gradients`) وتُطبّق الآن كـ design tokens على الثيم الحالي. | — | الاحتفاظ به كمصدر ألوان مركزي. |
| `src/constants/editor-format-styles.ts` | نعم | تعريف نمط عناصر السيناريو + تثبيت خط/حجم/line-height + حقن متغيرات CSS عبر `applyEditorFormatStyleVariables`. | — | الاحتفاظ به (أساسي لسلوك المحرر الحالي). |
| `src/constants/fonts.ts` | لا (Runtime الحالي) | تعريف خيارات خطوط/أحجام جاهزة للقوائم (`fonts`, `textSizes`). | لا يوجد استيراد فعلي له في شجرة `src` الحالية؛ المسار الحالي يعتمد ثوابت الخط المقفل داخل `editor-format-styles.ts`. | مرشح للتنظيف أو لإعادة التفعيل إذا رجعنا لقائمة اختيار خط/حجم. |
| `src/constants/formats.ts` | نعم | metadata موحدة لعناصر السيناريو العشرة (labels/icons/shortcuts) وتُستخدم الآن في قائمة الإدراج والعرض المساند. | — | الاحتفاظ به كطبقة metadata الرسمية. |
| `src/constants/index.ts` | لا (Runtime الحالي) | Barrel exports لتجميع ثوابت `constants/*`. | مستورد فقط من `ScreenplayEditor` غير المفعّل حاليًا. | إبقاؤه إذا سنعيد تفعيل المعمارية القديمة؛ وإلا يمكن حذفه مع الملفات غير المستخدمة. |
| `src/constants/insert-menu.ts` | نعم | تعريفات عناصر قائمة الإدراج وسلوكها (`insert-template` / `photo-montage`) وتتحكم الآن فعليًا في قائمة "إضافة" وسلوك الإدراج. | — | الاحتفاظ به كمصدر سلوك الإدراج المركزي. |
| `src/constants/page.ts` | نعم | ثوابت أبعاد A4 والهوامش والمسافات المستخدمة في تقسيم الصفحات وحساب القياسات. | — | الاحتفاظ به (ثابت محوري للمحرر الحالي). |

## أدلة سريعة (الدفعة 6)

- تفعيل `colors.ts` داخل المسار الحالي: `src/App.tsx:57`, `src/App.tsx:418`  
- تفعيل `formats.ts` داخل المسار الحالي: `src/App.tsx:58`, `src/App.tsx:229`  
- تفعيل `insert-menu.ts` داخل المسار الحالي: `src/App.tsx:59`, `src/App.tsx:267`, `src/App.tsx:538`, `src/App.tsx:598`  
- استخدام `page.ts` في المحرر الفعلي: `src/components/editor/EditorArea.ts:14`, `src/editor.ts:45`  
- استخدام `editor-format-styles.ts` في المحرر الفعلي: `src/components/editor/EditorArea.ts:20`, `src/components/editor/EditorArea.ts:348`, `src/components/editor/EditorArea.ts:352`  
- `fonts.ts` ما زال غير مستورد فعليًا في مسار التشغيل الحالي.  
- استيراد barrel `constants/index.ts` ما زال يظهر فقط في مسار غير مفعل: `src/components/editor/ScreenplayEditor.ts:2`.

## الدفعة 7 (مجلد src/extensions)

| الملف | مفعل في التطبيق؟ | دوره | سبب الوجود لو غير مفعل | توصية قرار |
|---|---|---|---|---|
| `src/extensions/action.ts` | نعم | تعريف عقدة `Action` في Tiptap + كواشف وصف/حدث (`isActionLine`, `collectActionEvidence`) المستخدمة في خط التصنيف. | — | الاحتفاظ به (أساسي). |
| `src/extensions/arabic-patterns.ts` | نعم | القاموس المركزي للـ Regex والقوائم اللغوية العربية (مشاهد/انتقال/حوار/أفعال) المستخدمة عبر امتدادات التصنيف + مسار استيراد البنية. | — | الاحتفاظ به (أساسي). |
| `src/extensions/basmala.ts` | نعم | عقدة `Basmala` + كاشف `isBasmalaLine` في مسار التصنيف. | — | الاحتفاظ به (أساسي). |
| `src/extensions/character.ts` | نعم | عقدة `Character` + منطق التعرف على أسماء الشخصيات + تحليل الحوار المضمّن + ضمان النقطتين. | — | الاحتفاظ به (أساسي). |
| `src/extensions/classification-core.ts` | نعم | محرك مراجعة ما بعد التصنيف (`PostClassificationReviewer`) لاكتشاف الشبهات وتصحيح بعض الحالات قبل الإخراج النهائي. | — | الاحتفاظ به (أساسي). |
| `src/extensions/classification-decision.ts` | نعم | طبقة حسم التعارض بين `action/dialogue/character` بنظام نقاط وسياق. | — | الاحتفاظ به (أساسي). |
| `src/extensions/classification-sequence-rules.ts` | نعم | قواعد تسلسل الأنواع + شدة الانتهاك + اقتراح النوع المتوقع التالي. | — | الاحتفاظ به (أساسي). |
| `src/extensions/classification-types.ts` | نعم | عقود الأنواع المركزية (`ElementType`, التحويل legacy/camelCase, interfaces) المستخدمة في الواجهة والمحرك. | — | الاحتفاظ به (Contract أساسي). |
| `src/extensions/context-memory-manager.ts` | نعم | ذاكرة سياق قصيرة أثناء التصنيف (تكرار الشخصيات + الأنواع الأخيرة) لدعم `HybridClassifier`. | — | الاحتفاظ به (أساسي). |
| `src/extensions/dialogue.ts` | نعم | عقدة `Dialogue` + كواشف احتمالية الحوار واستمرار الحوار. | — | الاحتفاظ به (أساسي). |
| `src/extensions/hybrid-classifier.ts` | نعم | مصنّف هجين احتياطي (regex + context + memory) للحالات الرمادية في التصنيف. | — | الاحتفاظ به (أساسي). |
| `src/extensions/line-repair.ts` | نعم | إصلاحات preprocessing (تنظيف HTML، دمج التفاف الحوار، إصلاح اسم شخصية مقسوم). | — | الاحتفاظ به (أساسي). |
| `src/extensions/parenthetical.ts` | نعم | عقدة `Parenthetical` + كاشف الأسطر بين أقواس. | — | الاحتفاظ به (أساسي). |
| `src/extensions/paste-classifier.ts` | نعم | الامتداد التنفيذي الرئيسي للتصنيف عند اللصق + تصنيف النص عبر `classifyText*` + مراجعة/تصحيح + تحويل إلى Nodes. | — | الاحتفاظ به (أساسي جداً). |
| `src/extensions/scene-header-1.ts` | نعم | عقدة `SceneHeader1` + كشف رقم المشهد. | — | الاحتفاظ به (أساسي). |
| `src/extensions/scene-header-2.ts` | نعم | عقدة `SceneHeader2` + كشف (زمن + داخلي/خارجي). | — | الاحتفاظ به (أساسي). |
| `src/extensions/scene-header-3.ts` | نعم | عقدة `SceneHeader3` + كشف الموقع التفصيلي السياقي. | — | الاحتفاظ به (أساسي). |
| `src/extensions/scene-header-top-line.ts` | نعم | عقدة مركبة (`sceneHeader1 + sceneHeader2`) + parsing/splitting + تنقل مفاتيح بين الجزأين. | — | الاحتفاظ به (أساسي). |
| `src/extensions/screenplay-commands.ts` | نعم | أوامر Tiptap المخصصة (`setAction`, `setSceneHeaderTopLine`...) واختصار Tab للتنقل بين عناصر السيناريو. | — | الاحتفاظ به (أساسي). |
| `src/extensions/text-utils.ts` | نعم | أدوات التطبيع والتنظيف وكواشف لغوية مساعدة تُستخدم عبر كل خط التصنيف. | — | الاحتفاظ به (أساسي). |
| `src/extensions/transition.ts` | نعم | عقدة `Transition` + كاشف أسطر الانتقال. | — | الاحتفاظ به (أساسي). |

## أدلة سريعة (الدفعة 7)

- تسجيل الامتدادات فعليًا داخل محرر Tiptap: `src/editor.ts:25`, `src/editor.ts:36`, `src/editor.ts:137`, `src/editor.ts:166`  
- استهلاك `paste-classifier` فعليًا في المحرك: `src/components/editor/EditorArea.ts:3`, `src/components/editor/EditorArea.ts:225`, `src/components/editor/EditorArea.ts:227`  
- ربط قلب التصنيف (review/decision/memory/hybrid/repair): `src/extensions/paste-classifier.ts:12`, `src/extensions/paste-classifier.ts:13`, `src/extensions/paste-classifier.ts:16`, `src/extensions/paste-classifier.ts:18`, `src/extensions/paste-classifier.ts:19`  
- تفعيل القدرات اللغوية المتقدمة داخل التصنيف: `src/extensions/paste-classifier.ts:5`, `src/extensions/paste-classifier.ts:98`, `src/extensions/paste-classifier.ts:99`, `src/extensions/paste-classifier.ts:167`  
- تفعيل مراجعة السطر المنفرد + تنسيق الحزمة للوكيل: `src/extensions/paste-classifier.ts:480`, `src/extensions/paste-classifier.ts:527`, `src/extensions/paste-classifier.ts:531`, `src/extensions/paste-classifier.ts:570`, `src/types/agent-review.ts:59`, `server/file-import-server.mjs:212`  
- استخدام `classification-types` في الواجهة والمحرك: `src/App.tsx:60`, `src/components/editor/EditorArea.ts:4`  
- استخدام `arabic-patterns` و`text-utils` في مسار استيراد البنية: `src/utils/file-import/structure-pipeline.ts:31`, `src/utils/file-import/structure-pipeline.ts:38`

## مقارنة الدفعة 7 مع الوضع الحالي

مرجع "الوضع الحالي" في التشغيل: `src/main.tsx` → `src/App.tsx` + `src/editor.ts` + `src/components/editor/EditorArea.ts`.

| الملف | التصنيف المقارن | الخلاصة |
|---|---|---|
| `src/extensions/action.ts` | زينا بالظبط | جزء مباشر من العقد والتصنيف المفعّل. |
| `src/extensions/arabic-patterns.ts` | زينا بالظبط | القدرات اللغوية المتقدمة أصبحت مفعّلة فعليًا في مسار التصنيف (`detectDialect` + `convertHindiToArabic` + إشارات التاريخ/الوقت). |
| `src/extensions/basmala.ts` | زينا بالظبط | عقدة/كشف مفعّل في المسار الحالي. |
| `src/extensions/character.ts` | زينا بالظبط | عقدة + كشف شخصيات مفعّل. |
| `src/extensions/classification-core.ts` | زينا بالظبط | النواة المتقدمة أصبحت مستخدمة فعليًا عبر `reviewSingleLine` في التحقق الدقيق و`formatForLLM` في طلب مراجعة الوكيل. |
| `src/extensions/classification-decision.ts` | زينا بالظبط | مفعّل ضمن قرار التصنيف في `paste-classifier`. |
| `src/extensions/classification-sequence-rules.ts` | زينا بالظبط | مفعّل عبر `classification-core` لكشف انتهاكات التسلسل. |
| `src/extensions/classification-types.ts` | زينا بالظبط | Contract فعّال ومستخدم على مستوى الواجهة والمحرك. |
| `src/extensions/context-memory-manager.ts` | زينا بالظبط | مفعّل عبر `paste-classifier` + `hybrid-classifier`. |
| `src/extensions/dialogue.ts` | زينا بالظبط | عقدة/منطق حوار مفعّل. |
| `src/extensions/hybrid-classifier.ts` | زينا بالظبط | مفعّل داخل خط التصنيف كمرحلة fallback ذكية. |
| `src/extensions/line-repair.ts` | زينا بالظبط | مفعّل في preprocessing قبل التصنيف. |
| `src/extensions/parenthetical.ts` | زينا بالظبط | عقدة/كشف مفعّل. |
| `src/extensions/paste-classifier.ts` | زينا بالظبط | الامتداد التنفيذي الأساسي للتصنيف الحالي. |
| `src/extensions/scene-header-1.ts` | زينا بالظبط | عقدة مفعّلة ضمن top-line. |
| `src/extensions/scene-header-2.ts` | زينا بالظبط | عقدة مفعّلة ضمن top-line. |
| `src/extensions/scene-header-3.ts` | زينا بالظبط | عقدة/كشف مفعّل. |
| `src/extensions/scene-header-top-line.ts` | زينا بالظبط | عقدة مركبة مفعّلة. |
| `src/extensions/screenplay-commands.ts` | زينا بالظبط | أوامر التنسيق Tab-setters مفعّلة. |
| `src/extensions/text-utils.ts` | زينا بالظبط | طبقة أدوات مركزية مستخدمة في كل المسار. |
| `src/extensions/transition.ts` | زينا بالظبط | عقدة/كشف انتقال مفعّل. |

**تصنيف مباشر حسب طلبك**

- متطور عنا (جزئيًا): لا يوجد بعد التفعيل الأخير.
- احنا متطورين عنه: لا يوجد ضمن هذه الدفعة.
- زينا بالظبط: كل ملفات الدفعة 7 (21 ملفًا).

**حاجات مش موجودة عندنا أصلًا (كسلوك مُنتجي ظاهر الآن)**

- لا يوجد عناصر غير مفعلة من نفس المجموعة المتقدمة بعد التفعيل الأخير داخل مسار التصنيف الحالي.

## مقارنة الدفعة 6 مع الوضع الحالي

مرجع "الوضع الحالي" في التشغيل: `src/main.tsx` → `src/App.tsx` + `src/components/editor/EditorArea.ts`.

| الملف | التصنيف المقارن | الخلاصة |
|---|---|---|
| `src/constants/colors.ts` | زينا بالظبط | Design tokens أصبحت مفعلة فعليًا في المسار الحالي وتطبّق على متغيرات الثيم. |
| `src/constants/editor-format-styles.ts` | زينا بالظبط | هذا ملف فعّال الآن وهو المرجع الحالي لخط/حجم/line-height وأنماط عناصر السيناريو. |
| `src/constants/fonts.ts` | احنا متطورين عنه | يعرّف قائمة خيارات لكن فعليًا خيار واحد فقط (خط واحد/حجم واحد) وغير موصول بالواجهة؛ الوضع الحالي يطبّق القيم المقفلة مباشرة من محرك التحرير. |
| `src/constants/formats.ts` | زينا بالظبط | metadata العشرة أصبحت موصولة فعليًا في واجهة الإدراج الحالية. |
| `src/constants/index.ts` | احنا متطورين عنه | barrel غير مستخدم فعليًا في runtime الحالي (إلا عبر `ScreenplayEditor` غير النشط). |
| `src/constants/insert-menu.ts` | زينا بالظبط | Insert menu الديناميكية + قوالب الإدراج + سلوك `photo-montage` أصبحت مفعلة في التطبيق الحالي. |
| `src/constants/page.ts` | زينا بالظبط | ثابت محوري مستخدم فعليًا في pagination والقياسات داخل المحرر الحالي. |

**تصنيف مباشر حسب طلبك**

- متطور عنا: لا يوجد حاليًا ضمن الدفعة 6 بعد التفعيل.
- احنا متطورين عنه: `src/constants/fonts.ts`, `src/constants/index.ts`.
- زينا بالظبط: `src/constants/colors.ts`, `src/constants/editor-format-styles.ts`, `src/constants/formats.ts`, `src/constants/insert-menu.ts`, `src/constants/page.ts`.

**حاجات كانت مش موجودة واتفعّلت الآن**

- Insert Menu ديناميكية بقوالب جاهزة + سلوك `photo-montage`.
- طبقة Design Tokens TypeScript مركزية للألوان الدلالية والهايلايت.
- Metadata موحدة للعناصر العشرة (labels/icons/shortcuts) مربوطة فعليًا بالواجهة.

## مقارنة الدفعة 5 مع الوضع الحالي

مرجع "الوضع الحالي" في التشغيل: `src/main.tsx` → `src/App.tsx` مع محرك `src/components/editor/EditorArea.ts`.

| الملف | التصنيف المقارن | الخلاصة |
|---|---|---|
| `src/components/editor/ScreenplayEditor.ts` | متطور عنا جزئيًا / ونحن متطورون عنه جزئيًا | متطور تنظيميًا لأنه يفصل الـ shell إلى مكونات مستقلة (Header/Toolbar/Sidebar/Footer). نحن متطورون عنه تشغيلًا لأنه غير موصول فعليًا بالـ runtime الحالي ومعلّق عليه تدفق قديم. |
| `src/components/editor/EditorHeader.ts` | نحن متطورون عنه | مكوّن حتمي غير مستخدم. الواجهة الحالية تبني الهيدر داخل React وتنفذه فعليًا. |
| `src/components/editor/EditorToolbar.ts` | نحن متطورون عنه | مكوّن حتمي غير مستخدم. بعض الأوامر فيه placeholder وغير مفعلة في مسار التشغيل الحالي. |
| `src/components/editor/EditorSidebar.ts` | نحن متطورون عنه | Sidebar حتمي غير موصول. الـ Sidebar الحالي React ومندمج مع حالة التطبيق. |
| `src/components/editor/EditorFooter.ts` | نحن متطورون عنه | Footer حتمي غير موصول، بينما الـ Footer الحالي مفعّل ويرتبط مباشرة بحالة الإحصائيات في `App.tsx`. |
| `src/components/editor/ConfirmationDialog.ts` | نحن متطورون عنه | Dialog موجود لكن غير موصول بمسار استخدام فعلي في التشغيل الحالي. |
| `src/components/editor/index.ts` | نحن متطورون عنه | Barrel غير مستخدم فعليًا؛ لا يضيف قيمة تشغيلية حالية. |
| `src/components/editor/EditorArea.ts` | زينا بالظبط | هذا هو نفس المحرك النشط فعليًا الآن (القلب التشغيلي الحالي). |
| `src/components/editor/editor-area.types.ts` | زينا بالظبط | عقود الأنواع نفسها المستخدمة حاليًا مع `EditorArea` و`App.tsx`. |

**تصنيف مباشر حسب طلبك**

- متطور عنا بشكل كامل: لا يوجد.
- متطور عنا جزئيًا: `src/components/editor/ScreenplayEditor.ts` (من ناحية التفكيك المعماري فقط).
- احنا متطورين عنه: `src/components/editor/ConfirmationDialog.ts`, `src/components/editor/EditorHeader.ts`, `src/components/editor/EditorToolbar.ts`, `src/components/editor/EditorSidebar.ts`, `src/components/editor/EditorFooter.ts`, `src/components/editor/index.ts`.
- زينا بالظبط: `src/components/editor/EditorArea.ts`, `src/components/editor/editor-area.types.ts`.

## الدفعة 8 (مجلدات hooks/lib/providers)

| الملف | مفعل في التطبيق؟ | دوره | سبب الوجود لو غير مفعل | توصية قرار |
|---|---|---|---|---|
| `src/hooks` | نعم (جزئيًا) | حاوية أدوات الحالة الجانبية (toast/history/local-storage/mobile). | — | الاحتفاظ به مع تنظيف الجزئيات غير المربوطة. |
| `src/hooks/index.ts` | نعم | Barrel يجمع exports للـ hooks ويُستخدم فعليًا في استيراد `toast`. | — | الاحتفاظ به (Active contract). |
| `src/hooks/use-history.ts` | لا (Runtime الحالي) | History controller عام (undo/redo) مستقل عن React. | يوجد كبديل بنيوي/أداة مساعدة، لكن المحرك الحالي يعتمد تاريخ Tiptap الداخلي عبر أوامر المحرر. | إمّا ربطه بحالة UI عامة خارج المحرر أو حذفه لتقليل الكود غير المستخدم. |
| `src/hooks/use-local-storage.ts` | لا (Runtime الحالي) | أدوات حفظ تلقائي/تحميل/حفظ من `localStorage` (autosave + debounce). | مُجهّز لميزة مسودات محلية لكنها غير موصولة حاليًا بمسار `App`/`EditorArea`. | قرار لاحق: تفعيله لمسودات تلقائية أو إبقاؤه كتحضير. |
| `src/hooks/use-mobile.ts` | لا (Runtime الحالي) | كاشف mobile + اشتراك `matchMedia` لتغيّر breakpoints. | الواجهة الحالية تعتمد responsive CSS مباشرة دون state hook مخصص للجوال. | تفعيله فقط عند الحاجة لسلوك JS يعتمد على حجم الشاشة؛ غير ذلك يمكن أرشفته. |
| `src/hooks/use-toast.ts` | نعم | نظام toast مركزي (state + subscribe + dismiss + toast API) يُغذي طبقة Toaster والواجهة. | — | الاحتفاظ به (أساسي). |
| `src/lib` | نعم | حاوية مكتبة الأدوات المشتركة. | — | الاحتفاظ به. |
| `src/lib/utils.ts` | نعم | دالة `cn` (دمج clsx + tailwind-merge) المستخدمة في مكونات UI. | — | الاحتفاظ به (أساسي). |
| `src/providers` | نعم | حاوية مزودات التطبيق (Theme). | — | الاحتفاظ به. |
| `src/providers/index.ts` | نعم | Barrel للمزودات ويُستخدم في نقطة الدخول. | — | الاحتفاظ به. |
| `src/providers/ThemeProvider.ts` | نعم | مزود ثيم class-based يطبق السمة على `<html>` ويُدير التخزين المحلي والتبديل. | — | الاحتفاظ به (أساسي). |

## أدلة سريعة (الدفعة 8)

- استدعاء providers من نقطة الدخول: `src/main.tsx:32`, `src/main.tsx:39`  
- تفعيل toaster وربطه بـ toast state: `src/main.tsx:47`, `src/components/ui/toaster.ts:1`, `src/components/ui/toaster.ts:20`, `src/components/ui/toaster.ts:33`  
- استيراد `toast` عبر barrel hooks في المسار الحالي: `src/App.tsx:61`  
- استخدام `cn` من `lib/utils` داخل UI فعلي: `src/components/ui/hover-border-gradient.tsx:3`, `src/App.tsx:55`  
- عدم وجود استدعاءات فعلية خارجية حاليًا لـ `use-history/use-local-storage/use-mobile` (نتيجة مسح الاستيرادات الحالي في `src`).

## مقارنة الدفعة 8 مع الوضع الحالي

مرجع "الوضع الحالي" في التشغيل: `src/main.tsx` → `src/App.tsx` + `src/components/editor/EditorArea.ts`.

| الملف | التصنيف المقارن | الخلاصة |
|---|---|---|
| `src/hooks` | زينا بالظبط (جزئيًا) | المجلد مفعّل لكن يحتوي ملفات غير موصولة حاليًا. |
| `src/hooks/index.ts` | زينا بالظبط | Barrel فعّال ويغذي استيراد `toast` في `App`. |
| `src/hooks/use-history.ts` | احنا متطورين عنه | المحرك الحالي يستخدم تاريخ Tiptap الحقيقي داخل `EditorArea` بدل history controller منفصل غير مربوط. |
| `src/hooks/use-local-storage.ts` | متطور عنا جزئيًا | يقدّم autosave/restore محلي كقدرة جاهزة لكن غير مفعّلة في المنتج الحالي. |
| `src/hooks/use-mobile.ts` | متطور عنا جزئيًا | يقدّم state/reactive mobile detection غير مُستخدم حاليًا (الاعتماد الحالي على CSS responsive فقط). |
| `src/hooks/use-toast.ts` | زينا بالظبط | مفعّل فعليًا ويخدم App + Toaster. |
| `src/lib` | زينا بالظبط | المجلد فعّال عبر `utils.ts`. |
| `src/lib/utils.ts` | زينا بالظبط | `cn` مستخدمة فعليًا في UI. |
| `src/providers` | زينا بالظبط | مفعّل بالكامل من نقطة الدخول. |
| `src/providers/index.ts` | زينا بالظبط | فعال كواجهة استيراد للمزودات. |
| `src/providers/ThemeProvider.ts` | زينا بالظبط | فعال في تهيئة الثيم قبل تركيب React. |

**تصنيف مباشر حسب طلبك**

- متطور عنا (جزئيًا): `src/hooks/use-local-storage.ts`, `src/hooks/use-mobile.ts`.
- احنا متطورين عنه: `src/hooks/use-history.ts`.
- زينا بالظبط: `src/hooks`, `src/hooks/index.ts`, `src/hooks/use-toast.ts`, `src/lib`, `src/lib/utils.ts`, `src/providers`, `src/providers/index.ts`, `src/providers/ThemeProvider.ts`.

**حاجات مش موجودة عندنا أصلًا (كسلوك مُنتجي ظاهر الآن)**

- حفظ تلقائي لمسودات المحرر إلى `localStorage` واسترجاعها عند العودة.
- سلوك واجهة معتمد على حالة جوال reactively عبر JS (`matchMedia` subscriptions) وليس CSS فقط.

## الدفعة 9 (مجلد src/types)

| الملف | مفعل في التطبيق؟ | دوره | سبب الوجود لو غير مفعل | توصية قرار |
|---|---|---|---|---|
| `src/types` | نعم (جزئيًا) | حاوية عقود الأنواع المركزية للتصنيف/الاستيراد/الأنظمة المساندة. | — | الاحتفاظ به مع تنظيف الأنواع غير المربوطة أو تفعيلها. |
| `src/types/agent-review.ts` | نعم | عقود طلب/استجابة مراجعة الوكيل لنقطة `/api/agent/review` (بما فيها `reviewPacketText`). | — | الاحتفاظ به (أساسي). |
| `src/types/editor-clipboard.ts` | نعم | عقود MIME مخصص للحافظة + Payload من كتل السيناريو، ومفعلة الآن فعليًا في `EditorArea` لنسخ/لصق داخلي مع `FILMLANE_CLIPBOARD_MIME`. | — | الاحتفاظ به (مفعّل). |
| `src/types/editor-engine.ts` | نعم | واجهة `EditorEngineAdapter` مفعلة الآن كعقد تشغيل فعلي في `App` (runCommand/copy/cut/paste عبر adapter). | — | الاحتفاظ به (مفعّل). |
| `src/types/external-modules.d.ts` | نعم (Build/TypeCheck) | تعريفات TypeScript للوحدات الخارجية (`mammoth`, `pdfjs-dist/legacy/build/pdf.mjs`) المستخدمة في الاستيراد داخل المتصفح. | — | الاحتفاظ به (أساسي لاستقرار النوع أثناء البناء). |
| `src/types/file-import.ts` | نعم | عقود نظام استيراد الملفات (الأنواع، النتائج، الطلب/الاستجابة، `ACCEPTED_FILE_EXTENSIONS`, `getFileType`). | — | الاحتفاظ به (أساسي). |
| `src/types/index.ts` | نعم | Barrel موحد لتصدير أنواع `types/*` ويُستخدم مباشرة في `App` و`paste-classifier` ومسارات أخرى. | — | الاحتفاظ به (Active contract). |
| `src/types/screenplay.ts` | نعم | أنواع السيناريو الأساسية (`LineType`, `DocumentStats`)؛ يُستخدم `LineType` فعليًا في مسار مراجعة التصنيف. | — | الاحتفاظ به. |
| `src/types/structure-pipeline.ts` | نعم | عقود سياسة/نتيجة خط الهيكلة وحارس الإسقاط لنظام استيراد الملفات. | — | الاحتفاظ به (أساسي). |
| `src/types/typing-system.ts` | نعم | عقود أوضاع الكتابة الذكية مفعلة الآن: تحميل/تطبيع إعدادات النظام + تشغيل auto-live وauto-deferred workflows في `App`. | — | الاحتفاظ به (مفعّل). |

## أدلة سريعة (الدفعة 9)

- استخدام `types/index.ts` مباشرة في المسار الحالي: `src/App.tsx:62`, `src/extensions/paste-classifier.ts:25`, `src/components/editor/ScreenplayEditor.ts:5`  
- تفعيل `agent-review.ts` في مسار المراجعة: `src/extensions/paste-classifier.ts:389`, `src/extensions/paste-classifier.ts:390`, `src/extensions/paste-classifier.ts:567`, `src/extensions/paste-classifier.ts:570`, `server/file-import-server.mjs:212`  
- تفعيل `file-import.ts` في خط الاستيراد: `src/utils/file-import/file-picker.ts:6`, `src/utils/file-import/open-pipeline.ts:12`, `src/utils/file-import/extract/index.ts:14`, `src/utils/file-import/extract/backend-extract.ts:16`, `src/utils/file-import/extract/browser-extract.ts:17`  
- تفعيل `structure-pipeline.ts` في خط الهيكلة: `src/utils/file-import/structure-pipeline.ts:21`, `src/utils/file-import/plain-text-to-blocks.ts:6`  
- تفعيل `external-modules.d.ts` عبر استهلاك الوحدات المعرفة: `src/types/external-modules.d.ts:1`, `src/types/external-modules.d.ts:11`, `src/utils/file-import/extract/browser-extract.ts:87`, `src/utils/file-import/extract/browser-extract.ts:113`  
- تفعيل `editor-clipboard.ts` و`editor-engine.ts` في المسار الحالي: `src/components/editor/editor-area.types.ts:39`, `src/components/editor/editor-area.types.ts:48`, `src/components/editor/EditorArea.ts:22`, `src/components/editor/EditorArea.ts:294`, `src/components/editor/EditorArea.ts:348`, `src/App.tsx:713`, `src/App.tsx:771`  
- تفعيل `typing-system.ts` في المسار الحالي: `src/App.tsx:64`, `src/App.tsx:65`, `src/App.tsx:66`, `src/App.tsx:368`, `src/App.tsx:459`, `src/App.tsx:515`, `src/App.tsx:774`

## مقارنة الدفعة 9 مع الوضع الحالي

مرجع "الوضع الحالي" في التشغيل: `src/main.tsx` → `src/App.tsx` + `src/components/editor/EditorArea.ts`.

| الملف | التصنيف المقارن | الخلاصة |
|---|---|---|
| `src/types` | زينا بالظبط | مجلد فعّال بالكامل في المسار الحالي. |
| `src/types/agent-review.ts` | زينا بالظبط | عقود مستخدمة فعليًا في pipeline مراجعة الوكيل. |
| `src/types/editor-clipboard.ts` | زينا بالظبط | بروتوكول الحافظة الداخلي (MIME + payload) مفعّل فعليًا. |
| `src/types/editor-engine.ts` | زينا بالظبط | `EditorEngineAdapter` مفعّل فعليًا في توزيع أوامر App. |
| `src/types/external-modules.d.ts` | زينا بالظبط | يدعم البناء والتحقق النوعي لعمليات استيراد ديناميكية فعليًا. |
| `src/types/file-import.ts` | زينا بالظبط | عقود الاستيراد مفعّلة ومستخدمة في كامل خط الاستيراد. |
| `src/types/index.ts` | زينا بالظبط | Barrel فعّال ومستخدم من runtime paths. |
| `src/types/screenplay.ts` | زينا بالظبط | `LineType` مستخدم فعليًا في مسار المراجعة. |
| `src/types/structure-pipeline.ts` | زينا بالظبط | مفعّل في خط هيكلة الاستيراد. |
| `src/types/typing-system.ts` | زينا بالظبط | وضع الكتابة الحي/المؤجل وإعداداته أصبح مفعّلًا في App. |

**تصنيف مباشر حسب طلبك**

- متطور عنا (جزئيًا): لا يوجد بعد التفعيل.
- احنا متطورين عنه: لا يوجد ضمن هذه الدفعة.
- زينا بالظبط: كل ملفات الدفعة 9.

**حاجات مش موجودة عندنا أصلًا (كسلوك مُنتجي ظاهر الآن)**

- لا يوجد عناصر غير مفعلة حاليًا ضمن هذه الدفعة بعد التفعيل الأخير.

## حاجات مهمة نرجعلها في الاخر

1. [تم جزئيًا] ملفات متطورة عنا (جزئيًا) في التفكيك المعماري:
   - تم نقل تفكيك الـ shell في مسار React الحالي إلى مكونات مستقلة:
     - `src/components/app-shell/AppHeader.tsx`
     - `src/components/app-shell/AppSidebar.tsx`
     - `src/components/app-shell/AppDock.tsx`
     - `src/components/app-shell/AppFooter.tsx`
   - المتبقي (اختياري): استكمال فصل منطق القوائم/الأوامر في طبقات hook/controller مستقلة إذا أردنا مزيدًا من العزل.

2. [تم] تشغيل محلي تلقائي:
   - تمت إضافة سكربت `dev:full` في `package.json` لتشغيل الواجهة + `file-import-server` معًا أثناء التطوير المحلي.
   - هذا مناسب للتطوير فقط وليس للإنتاج.

3. [قيد تجهيز النشر] النشر على Railway:
   - الأفضل فصل النشر إلى خدمتين: `frontend` و `file-import backend`.
   - خدمة الـbackend تبدأ بـ `node server/file-import-server.mjs`.
   - دعم ملفات `DOC` يتطلب توفر `antiword` في بيئة التشغيل (غالبًا عبر Dockerfile).
   - `VITE_FILE_IMPORT_BACKEND_URL` يجب أن يشير إلى رابط backend المنشور وقت بناء الواجهة.

4. [قرار مؤجل] Docker في Railway:
   - نحدد لاحقًا: هل سنعتمد Docker لخدمة backend على Railway لضمان توفر `antiword` في الإنتاج.

5. [تم] تفعيل `structure-pipeline.ts` + `plain-text-to-blocks.ts`:
   - تم ربط تدفق فتح الملفات فعليًا بـ `buildStructuredBlocksFromText` + `buildProjectionGuardReport`.
   - تم تفعيل مستهلك runtime واضح لـ `plainTextToScreenplayBlocks`.
   - تم توحيد إشارات التاريخ/الوقت/الأرقام داخل `src/utils/file-import/structure-pipeline.ts` لتقارب أعلى مع منطق `paste-classifier`.

6. [تم] خصائص hooks المتقدمة:
   - `src/hooks/use-local-storage.ts` و`src/hooks/use-mobile.ts` متطورين جزئيًا عن السلوك الحالي.
   - تم تفعيل autosave فعليًا للمحتوى في `localStorage` مع استعادة تلقائية للمسودة عند بدء التطبيق.
   - تم تفعيل mobile reactive behavior عبر `subscribeIsMobile` وضبط الواجهة (إخفاء فتحات جانبية وتقليل Dock على الجوال).

7. [تم] عقود `src/types` غير المفعلة سابقًا + UX:
   - تم تفعيل `src/types/editor-clipboard.ts`, `src/types/editor-engine.ts`, `src/types/typing-system.ts` فعليًا في runtime.
   - تم تنفيذ واجهة إعدادات مرئية لنظام الكتابة (تغيير `TypingSystemMode` و `liveIdleMinutes`) بدل الاعتماد على localStorage فقط.
   - تم إضافة مؤشرات حالة config للـ backend/agent-review داخل إعدادات الواجهة.

8. [تم] توحيد نظام الأنماط (CSS) بمصدر حقيقة واحد:
   - تم إنشاء مدخل موحّد: `src/styles/system.css` وأصبح هو الاستيراد الوحيد من `src/main.tsx`.
   - تم اعتماد `src/styles/globals.css` كمصدر الحقيقة لتوكنز التصميم والخطوط والـ base reset.
   - تم فصل المسؤوليات: `page.css` لنموذج صفحة السيناريو، `ui-kit.css` للتأثيرات/اليوتيليتي، و`toolbar.css` + `shell.css` كطبقة توافق legacy.
   - تم حذف تكرارات `:root` و`@tailwind` من الملفات الفرعية لمنع تضارب القيم بين أكثر من ملف.
   - تم تنفيذ تصفية نهائية لكلاسات legacy غير المستخدمة:
     - `src/styles/shell.css` أصبح يحتوي فقط أنماط `ui-toaster/ui-toast` المستخدمة فعليًا في runtime الحالي.
     - `src/styles/toolbar.css` تحوّل إلى deprecated stub بعد إزالة كل `.toolbar*` legacy classes.

## مقارنة خارجية مع Filmlane (مرجع سريع)

- التقرير الكامل: `docs/COMPARISON_OUR_APP_VS_FILMLANE.md`
- نطاق المقارنة: `E:\محرر\src` مقابل `E:\yarab we elnby\New folder (2)\Filmlane\src`
- تاريخ المقارنة: 2026-02-22

### أهم النتائج العليا
1. **متطور عندهم:** تغطية الاختبارات (29 test files منها 6 integration) + hardening لمسارات file-import.
2. **متطور عندهم:** API routes مدمجة داخل التطبيق (`/api/files/extract`, `/api/agent/review`) بدل خدمة منفصلة.
3. **متطور عندنا:** فصل shell إلى مكونات React مستقلة داخل `src/components/app-shell/*`.
4. **متطور عندنا:** توحيد CSS entrypoint في `src/styles/system.css` مع تنظيف legacy في `shell.css` و`toolbar.css`.
5. **متساوي تقريبًا:** طبقة constants الأساسية (`colors`, `formats`, `insert-menu`, `page`).
6. **غير موجود عندنا أصلًا:** طبقة `src/ai/*` و`src/ml/*` في Filmlane (تحتاج قرار منتجي قبل النقل).

### توصية تنفيذ مختصرة
- أولوية P0 الحالية: نقل **منهج الاختبارات** لمسارات `structure-pipeline`, `plain-text-to-blocks`, `open-pipeline` قبل أي نقل معماري كبير.
