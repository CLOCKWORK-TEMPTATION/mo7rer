# Filmlane DOCX Transplant Mapping

## Scope

- الهدف: نقل منطق DOCX من Filmlane إلى بنية مشروعنا (Vite + Node backend) مع الحفاظ على السلوك المكافئ.
- النطاق: فتح/إدراج/حفظ DOCX + مرور metadata البنيوي (`structuredBlocks`, `payloadVersion`, `qualityScore`, `normalizationApplied`).
- الاختبارات: غير منقولة في هذه الدفعة (حسب القرار).

## Source To Target Mapping

| Filmlane Source                                               | Our Target                                                                 | Status                                                         |
| ------------------------------------------------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `src/app/api/files/extract/route.ts`                          | `server/file-import-server.mjs`                                            | implemented                                                    |
| `DOCUMENTATION.md` + `src/components/editor/DOCUMENTATION.md` | `docs/filmlane-docx-transplant.md`                                         | implemented                                                    |
| `src/components/editor/ScreenplayEditor.tsx`                  | `src/App.tsx`                                                              | implemented                                                    |
| `src/types/external-modules.d.ts`                             | `src/types/external-modules.d.ts`                                          | implemented                                                    |
| `src/types/file-import.ts`                                    | `src/types/file-import.ts`                                                 | implemented                                                    |
| `src/types/screenplay.ts`                                     | `src/types/screenplay.ts`                                                  | no DOCX-specific delta required                                |
| `src/utils/Arabic-Screenplay-Classifier-Agent.ts`             | `src/extensions/Arabic-Screenplay-Classifier-Agent.ts`                     | implemented (compatibility surface for this repo architecture) |
| `src/utils/classification-core.ts`                            | `src/extensions/classification-core.ts`                                    | no DOCX-specific delta required                                |
| `src/utils/doc-converter-flow.ts`                             | `server/doc-converter-flow.mjs`                                            | implemented                                                    |
| `src/utils/docx-to-txt.ts`                                    | `server/docx-to-txt.mjs`                                                   | implemented                                                    |
| `src/utils/exporters.ts`                                      | `src/utils/exporters.ts`                                                   | implemented                                                    |
| `src/utils/file-extraction.ts`                                | `src/utils/file-import/extract/index.ts` + `server/file-import-server.mjs` | implemented                                                    |
| `src/utils/file-import-preprocessor.ts`                       | `src/utils/file-import/preprocessor.ts`                                    | implemented                                                    |
| `src/utils/file-open-pipeline.ts`                             | `src/utils/file-import/open-pipeline.ts`                                   | implemented                                                    |
| `src/utils/file-operations.ts`                                | `src/utils/file-import/file-picker.ts` + `src/App.tsx`                     | implemented via file-picker + app flow                         |
| `src/utils/index.ts`                                          | `src/utils/file-import/index.ts` + `src/types/index.ts`                    | already aligned, no extra DOCX export barrel needed            |

## Mandatory Architecture Differences

1. Filmlane كان يستخدم Next.js route (`/api/files/extract`) بينما مشروعنا يستخدم Node server endpoint (`/api/file-extract` و`/api/files/extract`).
2. تم الحفاظ على منطق DOCX نفسه (`mammoth.extractRawText`) مع ترجمة نقاط الربط إلى `extractFileWithBackend` في الواجهة.
3. `Ctrl+S` في مشروعنا أصبح يحفظ DOCX افتراضيًا من خلال `exportToDocx` بدل HTML.

## Runtime Notes

- DOCX import يعتمد على backend endpoint.
- DOCX export يضيف payload marker مخفي داخل الملف لدعم الاسترجاع البنيوي.
