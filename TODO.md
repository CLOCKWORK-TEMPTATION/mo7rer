# قائمة المهام

## 🧪 الاختبارات (Testing)

### تغطية مسارات الاستيراد والتحرير
- [x] إنشاء اختبارات وحدة (unit) لمسارات الاستيراد/التحرير
- [x] إنشاء اختبارات تكامل (integration) لـ `file-extraction` و `file-open-pipeline`
- [x] إضافة اختبارات انحدار (regression) لعمليات import في `EditorArea`

### Test Harness
- [x] بناء test harness لـ `structure-pipeline`
- [x] بناء test harness لـ `plain-text-to-blocks`
- [x] بناء test harness لـ `open-pipeline` مع integration smoke على تدفق الاستيراد

### استيراد الملفات
- [x] إضافة/تعزيز اختبارات regression لاستيراد DOC/DOCX/PDF
- [x] ضمان عدم حدوث تراجعات متكررة في معالجة الملفات

---

## 🔧 البنية التحتية (Infrastructure)

### API & Backend
- [x] دمج مسارات review/extract داخل نفس runtime
- [x] إنشاء routes مكافئة لـ `/api/files/extract` و `/api/agent/review`
- [x] إضافة عقود تحقق أقوى لطلب/استجابة `agent-review` و `extract`
- [x] الحفاظ على نموذج backend المنفصل الحالي

### Hardening & Contracts
- [x] نقل/إعادة تنفيذ أجزاء hardening من `file-extraction` و `file-open-pipeline`
- [x] توافق كامل مع عقود `types/file-import.ts`

### Logger & Telemetry
- [x] تبنّي أجزاء مناسبة من `src/utils/logger.ts`

---

## 📦 الميزات (Features)

### التصدير
- [x] بناء export layer مستقلة لتصدير PDF/DOCX
- [x] اتباع نهج مشابه لـ `src/utils/exporters.ts`

### AI & ML (تقييم)
- [x] تقييم تبنّي AI flows من `src/ai/*`
- [x] تقييم تبنّي ML local من `src/ml/*`
- [x] انتظار توضيح احتياج المنتج قبل التنفيذ

### Utilities إضافية (تقييم)
- [x] تقييم `storage.ts`
- [x] تقييم `typing-workflow-rules.ts`
- [x] تقييم `context-window.ts`

---

## 🏗️ الهيكلة المعمارية (Architecture)

### App Shell ✅
- [x] نقل تفكيك shell إلى مكونات مستقلة:
  - `src/components/app-shell/AppHeader.tsx`
  - `src/components/app-shell/AppSidebar.tsx`
  - `src/components/app-shell/AppDock.tsx`
  - `src/components/app-shell/AppFooter.tsx`

### القوائم والأوامر
- [x] استكمال فصل منطق القوائم/الأوامر
- [x] نقل إلى طبقات `hooks/controllers` مستقلة

---

## 📝 ملاحظات

- المهام المكتملة تُشطب بوضع `[x]`
- المهام ذات الأولوية المنخفضة مُدرجة تحت "تقييم"
- [ ] قبل النشر مباشرة (Railway): تأكيد توفر `antiword` داخل بيئة السيرفر (`ANTIWORD_PATH=antiword` و `ANTIWORDHOME=/usr/share/antiword`) ثم التحقق من `/health` أن `antiwordBinaryAvailable=true` و `antiwordHomeExists=true`.
