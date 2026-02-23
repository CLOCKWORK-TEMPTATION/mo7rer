---
description: تشغيل workflow الهجرة إلى FSD باستخدام الـ prompt والـ YAML المخصصين
auto_execution_mode: 3
---

# FSD Migration Workflow Runner

يستخدم هذا الـ Workflow ملفين أساسيين:
- **Prompt**: `.uix/prompts/run-fsd-migration.txt`
- **Workflow Definition**: `.uix/workflows/fsd-structure-migration-workflow.yaml`

## المتطلبات المسبقة

// turbo
1. التأكد من وجود Git repo نظيف
```bash
git status
git add -A && git commit -m "checkpoint: pre-fsd-migration" || echo "no changes"
```

2. التحقق من وجود الملفات المطلوبة
```bash
test -f .uix/prompts/run-fsd-migration.txt && echo "✅ Prompt exists"
test -f .uix/workflows/fsd-structure-migration-workflow.yaml && echo "✅ Workflow exists"
```

## خطوات التنفيذ

### الخطوة 1: تحميل الـ Prompt
اقرأ محتوى `.uix/prompts/run-fsd-migration.txt` كتعليمات Orchestrator.

### الخطوة 2: تحميل Workflow YAML
اقرأ `.uips/workflows/fsd-structure-migration-workflow.yaml` لفهم:
- ترتيب الـ Agents (10 Agents)
- الأ phases (14 phase)
- الـ Checkpoints بعد كل phase
- الـ Stop on failure policy

### الخطوة 3: إنشاء Git Branch
```bash
git checkout -b refactor/fsd-migration-$(date +%s)
```

### الخطوة 4: تنفيذ الـ Agents بالترتيب

按照这个顺序执行:

| # | Agent | Phase(s) | Critical |
|---|-------|----------|----------|
| 1 | BaselineAgent | 1-2 | ✅ |
| 2 | StructureAgent | 3-4 | ✅ |
| 3 | TypeSafetyAgent | 5 | ✅ |
| 4 | EditorAgent | 6 | ⚠️ Tiptap Behavior |
| 5 | UIAgent | 7 | ✅ |
| 6 | FeatureAgent | 8-9 | ✅ |
| 7 | AppWiringAgent | 10 | ✅ |
| 8 | CleanupAgent | 11 | ✅ |
| 9 | QAAgent | 12-13 | ✅ |
| 10 | ReportAgent | 14 | - |

### الخطوة 5: Checkpoints بعد كل Phase
بعد كل phase تحقق من:
- [ ] `pnpm run build` نجح
- [ ] `pnpm run lint` نجح  
- [ ] `pnpm run test` نجح (إن وجد)

### الخطوة 6: Final Report
أنشئ ملف `docs/fsd-migration-report.md` يحتوي على:
1. Executive Summary
2. Created/Moved/Modified Files
3. Fixed Violations
4. Deferred Issues
5. Build/Lint/Test Results
6. Remaining Risks
7. Next Steps

## سلامة حرجة (Critical Guarantees)

- ⚠️ **Tiptap behavior MUST remain unchanged**
- ⚠️ **Editor formatting, shortcuts, and JSON output MUST be verified**
- ⚠️ **Pages MUST remain thin**
- ⚠️ **Boundaries MUST be enforced**
- ⚠️ **Aliases MUST replace relative imports**
- ⚠️ **Dead code removal ONLY in cleanup phase**

## في حالة Failure

إذا فشل أي phase:
1. توقف فوراً (Halt)
2. سجّل الـ error
3. لا تنتقل للـ agent التالي
4. اعرض الـ stack trace

## Post-Execution

// turbo
```bash
git add -A
git commit -m "refactor: complete FSD architecture migration"
git push origin HEAD
```

## مراجع

- Prompt: `@.uix/prompts/run-fsd-migration.txt`
- Workflow: `@.uix/workflows/fsd-structure-migration-workflow.yaml`
- Original Workflow: `@.windsurf/workflows/multi-agent-workflow-runner.md`
