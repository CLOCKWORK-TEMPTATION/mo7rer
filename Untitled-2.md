# الوكلاء المتعددون (Multi-agents) في Codex

تتيح ميزة **الوكلاء المتعددين** (Multi-agents) في Codex تشغيل عدة وكلاء فرعيين بالتوازي، ثم دمج نتائجهم في استجابة موحّدة.  
هذه المقاربة مناسبة جدًا للمهام الكبيرة القابلة للتجزئة، مثل: الاستكشاف الواسع لقاعدة الشيفرة، مراجعة PR متعددة المحاور، والتحليل الموازي للجودة والأمان.

---

## الفكرة الأساسية: لماذا نستخدم Multi-agents؟

حتى مع نوافذ سياق كبيرة، يظل للنموذج حدود عملية. عندما تمتلئ المحادثة الرئيسية بمخرجات وسيطة كثيرة (سجلات طويلة، تتبع أخطاء، ملاحظات استكشاف)، تنخفض موثوقية الجلسة تدريجيًا.

يُعبَّر عن ذلك غالبًا بمفهومين:

- **تلوث السياق** (Context Pollution): دفن المعلومات المهمة وسط ضجيج غير ضروري.
- **تدهور السياق** (Context Rot): تراجع جودة الأداء كلما تراكمت تفاصيل أقل صلة.

الحل مع Multi-agents:

- إبقاء الوكيل الرئيسي مركزًا على المتطلبات والقرارات والنتيجة النهائية.
- تفويض المهام الثقيلة إلى وكلاء فرعيين متخصصين بالتوازي.
- إرجاع **ملخصات مركّزة** بدل المخرجات الخام الطويلة.

> خلاصة عملية: استخدم التوازي أولًا في المهام كثيفة القراءة (استكشاف/تحليل/تلخيص).  
> أما المهام كثيفة الكتابة على نفس الملفات، فتعامل معها بحذر بسبب احتمالية التعارض.

---

## مصطلحات أساسية

- **Multi-agent**: سير عمل يشغّل عدة وكلاء معًا ويجمع نتائجهم.
- **Sub-agent**: وكيل فرعي مفوَّض لمهمة محددة.
- **Agent thread**: خيط الوكيل في CLI ويمكن الانتقال إليه عبر `/agent`.

---

## اختيار النموذج وجهد الاستدلال

### اختيار النموذج

- **`gpt-5.3-codex`**: مناسب للمهام التي تحتاج استدلالًا أقوى (مراجعات دقيقة، أمان، تنفيذ متعدد الخطوات).
- **`gpt-5.3-codex-spark`**: مناسب للسرعة والمهام الخفيفة نسبيًا (استكشاف سريع، مسح قرائي، تلخيص).

### جهد الاستدلال (`model_reasoning_effort`)

- **`high`**: للمنطق المعقد وتتبّع الحالات الحدّية.
- **`medium`**: خيار متوازن لمعظم المهام.
- **`low`**: للمهام المباشرة عندما تكون السرعة أهم.

> زيادة جهد الاستدلال تحسن الجودة عادةً في المهام المعقدة، لكنها ترفع الزمن والتكلفة الرمزية (tokens).

---

## تفعيل Multi-agents

الميزة **تجريبية** ويجب تفعيلها صراحة.

### 1) عبر CLI

- نفّذ `/experimental`
- فعّل خيار **Multi-agents**
- أعد تشغيل Codex

### 2) عبر ملف الإعداد

في `~/.codex/config.toml`:

```toml
[features]
multi_agent = true
```

> تظهر أنشطة الوكلاء المتعددين حاليًا بوضوح في CLI، والتكامل الأوسع في الواجهات الأخرى يتوسع تدريجيًا.

---

## سير العمل المعتاد

يقوم Codex تلقائيًا بالتنسيق بين الوكلاء، بما يشمل:

- إنشاء وكلاء فرعيين (Spawn)
- توجيه التعليمات والمتابعات
- الانتظار حتى اكتمال النتائج
- إغلاق الخيوط عند الانتهاء

وعند اكتمال الجميع، يعرض ردًا موحّدًا مجمّعًا.

---

## إدارة الوكلاء الفرعيين

- استخدم `/agent` للتنقل بين خيوط الوكلاء النشطة.
- يمكنك طلب:
  - توجيه وكيل أثناء التشغيل
  - إيقاف وكيل
  - إغلاق خيط مكتمل

---

## الموافقات والعزل (Approvals & Sandbox)

- الوكلاء الفرعيون يرثون سياسة العزل الحالية.
- يعملون بموافقات غير تفاعلية (Non-interactive approvals).
- إذا نفّذ وكيل فرعي إجراءً يتطلب موافقة جديدة، يفشل الإجراء وتظهر الرسالة في سير العمل الأب.
- يمكنك تخصيص وضع العزل لكل دور، مثل `read-only` لوكيل الاستكشاف.

---

## أدوار الوكلاء (Agent Roles)

تُعرّف الأدوار في قسم `[agents]` داخل الإعداد:

- على مستوى المستخدم: `~/.codex/config.toml`
- أو على مستوى المشروع: `.codex/config.toml`

الأدوار المدمجة افتراضيًا:

- `default`
- `worker`
- `explorer`

يمكن لكل دور تخصيص:

- `model`
- `model_reasoning_effort`
- `sandbox_mode`
- `developer_instructions`

### مخطط الحقول (Schema)

| الحقل | النوع | مطلوب؟ | الوصف |
|---|---|:---:|---|
| `agents.max_threads` | number | لا | الحد الأقصى لخيوط الوكلاء المتزامنة |
| `[agents.<name>]` | table | لا | تعريف دور باسم مخصص |
| `agents.<name>.description` | string | لا | وصف بشري يساعد Codex على اختيار الدور |
| `agents.<name>.config_file` | string (path) | لا | ملف إعداد TOML خاص بهذا الدور |

### ملاحظات مهمة

- أي حقول غير معروفة داخل `[agents.<name>]` تُرفض.
- المسارات النسبية لـ `config_file` تُفسَّر نسبةً إلى ملف `config.toml` الذي عرّف الدور.
- إذا طابق اسم الدور اسم دور مدمج، فتعريفك أنت يأخذ الأولوية.
- فشل تحميل ملف إعداد الدور قد يسبب فشل إنشاء الوكلاء.
- أي إعداد غير معرّف على مستوى الدور يُورّث من الجلسة الأب.

---

## مثال إعدادات كامل

### `~/.codex/config.toml`

```toml
[agents.default]
description = "General-purpose helper."

[agents.reviewer]
description = "Find security, correctness, and test risks in code."
config_file = "agents/reviewer.toml"

[agents.explorer]
description = "Fast codebase explorer for read-heavy tasks."
config_file = "agents/custom-explorer.toml"
```

### `~/.codex/agents/reviewer.toml`

```toml
model = "gpt-5.3-codex"
model_reasoning_effort = "high"
developer_instructions = "Focus on high priority issues, write tests to validate hypothesis before flagging an issue. When finding security issues give concrete steps on how to reproduce the vulnerability."
```

### `~/.codex/agents/custom-explorer.toml`

```toml
model = "gpt-5.3-codex-spark"
model_reasoning_effort = "medium"
sandbox_mode = "read-only"
```

---

## كيف يرتبط Multi-agents بإعدادات Codex العامة؟

### 1) أماكن الإعدادات وترتيب الأولوية

يحمل Codex الإعدادات من عدة طبقات، والأولوية (من الأعلى للأدنى) غالبًا:

1. معاملات CLI و`--config`
2. إعدادات الملف الشخصي (Profile)
3. إعدادات المشروع `.codex/config.toml` (في المشاريع الموثوقة)
4. إعداد المستخدم `~/.codex/config.toml`
5. إعداد النظام (إن وُجد)
6. القيم الافتراضية الداخلية

### 2) مفاتيح شائعة تؤثر على سلوك الوكلاء

```toml
model = "gpt-5.3-codex"
approval_policy = "on-request"
sandbox_mode = "workspace-write"
model_reasoning_effort = "high"
web_search = "cached"
```

### 3) أهم أعلام الميزات (Feature Flags)

```toml
[features]
multi_agent = true
shell_snapshot = true
unified_exec = false
runtime_metrics = false
```

> ملاحظة: بعض المفاتيح القديمة ما زالت موجودة لأسباب توافقية، لكن الأفضل استخدام المفاتيح الأحدث الموصى بها.

---

## مرجع سريع مختصر (للعمل اليومي)

### إعدادات مرتبطة مباشرةً بـ Multi-agents

- `features.multi_agent`
- `agents.max_threads`
- `agents.<name>.description`
- `agents.<name>.config_file`

### إعدادات داعمة للجودة والأمان

- `approval_policy`
- `sandbox_mode`
- `sandbox_workspace_write.*`
- `shell_environment_policy.*`

### إعدادات مفيدة للمراقبة والتشغيل

- `[otel]` للتتبّع والمرصودية (Observability)
- `[history]` لإدارة حفظ السجل
- `notify` و`[tui]` للإشعارات وتجربة CLI

---

## أفضل ممارسات عملية

1. ابدأ بأدوار بسيطة: `explorer` و`reviewer` قبل زيادة التعقيد.
2. خصّص `explorer` على `read-only` لتقليل المخاطر.
3. اجعل مخرجات الوكلاء الفرعيين مختصرة ومركزة.
4. لا تشغّل عدة وكلاء كتابة على الملفات نفسها في الوقت ذاته.
5. ثبّت إعدادات الأمان (الموافقات/العزل) قبل التوسع في الأتمتة.
6. استخدم `model_reasoning_effort = high` فقط حيث يلزم.

---

## مثال طلب جاهز للمراجعة المتوازية

يمكنك استخدام صياغة مثل:

```text
أريد مراجعة هذا الفرع مقابل main. شغّل وكيلاً لكل نقطة، انتظر النتائج كلها، ثم قدّم ملخصًا مستقلًا لكل نقطة:
1) الأمان
2) جودة الشيفرة
3) العلل
4) حالات السباق
5) تذبذب الاختبارات
6) قابلية الصيانة
```

---

## روابط مرجعية رسمية

- Multi-agents: https://developers.openai.com/codex/multi-agent
- مفاهيم Multi-agents: https://developers.openai.com/codex/concepts/multi-agents
- Config basics: https://developers.openai.com/codex/config-basic
- Configuration reference: https://developers.openai.com/codex/config-reference
- Advanced configuration: https://developers.openai.com/codex/config-advanced
- Models: https://developers.openai.com/codex/models

---

## خلاصة

ميزة **Multi-agents** تمنحك قابلية توسّع قوية في Codex عبر توزيع المهام على وكلاء متخصصين، مع الحفاظ على تركيز الجلسة الرئيسية.  
أعلى عائد يظهر عندما تضبط بدقة: **الأدوار، النموذج، جهد الاستدلال، وسياسات العزل والموافقات**.
