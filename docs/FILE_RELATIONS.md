# خرائط علاقات الملفات — أفان تيتر (Avan Titre)

> آخر تحديث: 2026-02-22
> مبنية على الاستيرادات الفعلية (import statements) وليس على افتراضات.

---

## 1. خريطة التبعيات العامة بين المجلدات

```mermaid
flowchart TD
    MAIN[main.tsx] --> APP[App.tsx]
    MAIN --> STYLES[styles/]

    APP --> CE[components/editor/]
    APP --> CU[components/ui/]
    APP --> HOOKS[hooks/]
    APP --> PROV[providers/]
    APP --> CONST[constants/]
    APP --> TYPES[types/]
    APP --> LIB[lib/]

    CE --> EXT[extensions/]
    CE --> CONST
    CE --> TYPES
    CE --> CU
    CE --> HOOKS
    CE --> UFI[utils/file-import/]

    EXT --> CONST
    EXT --> TYPES
    EXT --> UTILS[utils/]

    UFI --> TYPES
    UFI --> EXT
    UFI --> UTILS

    CU --> LIB

    PROV --> TYPES

    style MAIN fill:#029784,color:#fff
    style EXT fill:#40A5B3,color:#fff
    style CE fill:#746842,color:#fff
```

---

## 2. خريطة استيرادات `main.tsx` — نقطة الدخول

```mermaid
flowchart LR
    main[main.tsx] --> App[App.tsx]
    main --> g[styles/globals.css]
    main --> m[styles/main.css]
    main --> p[styles/page.css]
    main --> s[styles/shell.css]
    main --> t[styles/toolbar.css]
    main --> u[styles/ui-kit.css]
```

---

## 3. خريطة استيرادات `App.tsx` — المكون الجذر

```mermaid
flowchart TD
    App[App.tsx] --> SE[ScreenplayEditor]
    App --> TP[ThemeProvider]
    App --> UIIdx[components/ui/index]
    App --> HooksIdx[hooks/index]
    App --> ConstIdx[constants/index]
    App --> TypesIdx[types/index]
    App --> LibUtils[lib/utils]

    SE --> EA[EditorArea]
    SE --> EH[EditorHeader]
    SE --> ET[EditorToolbar]
    SE --> EF[EditorFooter]
    SE --> ES[EditorSidebar]
    SE --> CD[ConfirmationDialog]
    SE --> EditorFactory[editor.ts]
    SE --> FI[utils/file-import/index]
```

---

## 4. خريطة `components/editor/` — مكونات المحرر

```mermaid
flowchart TD
    subgraph components/editor
        IDX[index.ts] --> SE[ScreenplayEditor]
        IDX --> EA[EditorArea]
        IDX --> EH[EditorHeader]
        IDX --> ET[EditorToolbar]
        IDX --> EF[EditorFooter]
        IDX --> ES[EditorSidebar]
        IDX --> CD[ConfirmationDialog]
        IDX --> EAT[editor-area.types]
    end

    SE --> EA
    SE --> EH
    SE --> ET
    SE --> EF
    SE --> ES
    SE --> CD
    SE --> EditorTS[editor.ts]
    SE --> Formats[constants/formats]
    SE --> FmtStyles[constants/editor-format-styles]
    SE --> InsMenu[constants/insert-menu]
    SE --> FileImport[utils/file-import/]
    SE --> TypesScreenplay[types/screenplay]
    SE --> TypesEngine[types/editor-engine]

    EA --> EditorTS
    EA --> PageConst[constants/page]
    EA --> EAT

    EH --> Formats
    ET --> Formats
    ET --> FmtStyles
    EF --> EAT

    CD --> TypesScreenplay
    CD --> Formats
```

---

## 5. خريطة `extensions/` — خط أنابيب التصنيف والعُقد

```mermaid
flowchart TD
    subgraph العُقد المخصصة
        BASM[basmala]
        SH1[scene-header-1]
        SH2[scene-header-2]
        SH3[scene-header-3]
        SHTL[scene-header-top-line]
        ACT[action]
        CHAR[character]
        DLG[dialogue]
        PAREN[parenthetical]
        TRANS[transition]
    end

    subgraph خط_التصنيف
        AP[arabic-patterns]
        CT[classification-types]
        CC[classification-core]
        CD_EXT[classification-decision]
        CSR[classification-sequence-rules]
        CMM[context-memory-manager]
        HC[hybrid-classifier]
        PC[paste-classifier]
        LR_EXT[line-repair]
        TU[text-utils]
        SCC[screenplay-commands]
    end

    HC --> AP
    HC --> CT
    HC --> CC
    HC --> CD_EXT
    HC --> CSR
    HC --> CMM

    PC --> HC
    PC --> CT
    PC --> CMM

    CC --> CT
    CC --> AP
    CD_EXT --> CT
    CSR --> CT

    SCC --> CT

    BASM --> SCC
    SH1 --> SCC
    SH2 --> SCC
    SH3 --> SCC
    SHTL --> SCC
    ACT --> SCC
    CHAR --> SCC
    DLG --> SCC
    PAREN --> SCC
    TRANS --> SCC

    LR_EXT --> AP
    LR_EXT --> CT

    style AP fill:#029784,color:#fff
    style HC fill:#40A5B3,color:#fff
    style PC fill:#746842,color:#fff
```

---

## 6. خريطة `utils/file-import/` — خط أنابيب الاستيراد

```mermaid
flowchart TD
    subgraph utils/file-import
        IDX_FI[index.ts] --> FP[file-picker]
        IDX_FI --> OP[open-pipeline]
        IDX_FI --> DM[document-model]

        OP --> FP
        OP --> EXT_IDX[extract/index]
        OP --> PP[preprocessor]
        OP --> SP[structure-pipeline]
        OP --> PTB[plain-text-to-blocks]
        OP --> DM

        EXT_IDX --> BE[extract/backend-extract]
        EXT_IDX --> BRE[extract/browser-extract]

        SP --> PTB
    end

    OP --> HC_EXT[extensions/hybrid-classifier]
    OP --> PC_EXT[extensions/paste-classifier]
    OP --> TYPES_FI[types/file-import]
    OP --> TYPES_SP[types/structure-pipeline]
    DM --> TYPES_SC[types/screenplay]

    style OP fill:#029784,color:#fff
    style DM fill:#40A5B3,color:#fff
```

---

## 7. خريطة `constants/` — الثوابت

```mermaid
flowchart TD
    subgraph constants
        IDX_C[index.ts] --> COL[colors]
        IDX_C --> FNT[fonts]
        IDX_C --> FMT[formats]
        IDX_C --> EFS[editor-format-styles]
        IDX_C --> PG[page]
        IDX_C --> IM[insert-menu]
    end

    EFS --> FMT
    IM --> EFS

    FMT -.->|يُصدّر| FormatId[EditorStyleFormatId]
    EFS -.->|يستخدم| FormatId
    IM -.->|يستخدم| FormatId
```

---

## 8. خريطة `types/` — الأنماط

```mermaid
flowchart TD
    subgraph types
        IDX_T[index.ts] --> SC[screenplay]
        IDX_T --> EE[editor-engine]
        IDX_T --> FI[file-import]
        IDX_T --> SPT[structure-pipeline]
        IDX_T --> AR[agent-review]
        IDX_T --> EC[editor-clipboard]
        IDX_T --> TS[typing-system]
    end

    EE --> SC
    FI --> SC
    SPT --> SC
    AR --> SC
    EC --> SC
```

---

## 9. خريطة `hooks/`

```mermaid
flowchart TD
    subgraph hooks
        IDX_H[index.ts] --> UH[use-history]
        IDX_H --> ULS[use-local-storage]
        IDX_H --> UT[use-toast]
        IDX_H --> UM[use-mobile]
    end

    UH -.->|generic T| مستقل
    ULS -.->|localStorage| مستقل
    UT -.->|pub-sub| مستقل
    UM -.->|matchMedia| مستقل
```

كل خطاف مستقل تماماً — لا تبعيات متبادلة.

---

## 10. أهم 3 تدفقات للمستخدم

### التدفق 1: الكتابة المباشرة

```
المستخدم → App.tsx → ScreenplayEditor → EditorArea → Tiptap Instance
  → [Enter] → Node Extension (addKeyboardShortcuts) → إنشاء عقدة جديدة
  → [Tab] → ScreenplayCommands → تدوير النوع
```

### التدفق 2: استيراد ملف

```
المستخدم → App.tsx → ScreenplayEditor.openFile()
  → file-picker → extract (backend|browser) → preprocessor
  → structure-pipeline | plain-text-to-blocks
  → hybrid-classifier (لكل سطر)
  → document-model → EditorArea.importBlocks()
```

### التدفق 3: لصق نص

```
المستخدم → Ctrl+V → EditorArea (paste event)
  → ScreenplayEditor.pasteFromClipboard()
  → [تحقق MIME مخصص] → إذا filmlane-blocks: إدراج مباشر
  → إذا نص عادي: paste-classifier → hybrid-classifier → إدراج مُصنّف
```

---

## 11. التسلسل الهرمي للواجهة البصرية

```mermaid
flowchart TD
    ROOT[App.tsx — React Root] --> SE_VIS[ScreenplayEditor]

    SE_VIS --> HEADER[EditorHeader]
    SE_VIS --> MAIN_AREA[المنطقة الرئيسية]
    SE_VIS --> FOOTER[EditorFooter]

    MAIN_AREA --> SIDEBAR[EditorSidebar]
    MAIN_AREA --> EDITOR_WRAP[غلاف المحرر]

    EDITOR_WRAP --> TOOLBAR[EditorToolbar]
    EDITOR_WRAP --> EDITOR[EditorArea — Tiptap]

    SE_VIS --> DIALOGS[ConfirmationDialog]

    HEADER --> MENUS[6 قوائم منسدلة]
    HEADER --> USER[قائمة المستخدم]
    HEADER --> STATUS[مؤشر الاتصال]

    TOOLBAR --> ICONS[18 زر أيقوني في 5 مجموعات]
    TOOLBAR --> FMT_SEL[محدد التنسيق]

    FOOTER --> STATS[إحصائيات: صفحات/كلمات/أحرف/مشاهد]
    FOOTER --> CUR_FMT[التنسيق الحالي]
```

---

## 12. جدول الاعتمادات الخارجية المباشرة

| الملف | يعتمد على (خارجي) |
|-------|-------------------|
| `editor.ts` | `@tiptap/core`, `@tiptap/starter-kit` |
| `EditorArea.ts` | `@tiptap/core` (Editor instance) |
| `components/ui/_factory.ts` | `@radix-ui/*` (عبر التغليف) |
| `components/ui/*.ts` | `@radix-ui/*` (مكونات فردية) |
| `lib/utils.ts` | `clsx`, `tailwind-merge` |
| `hooks/use-toast.ts` | لا شيء (تنفيذ محلي بالكامل) |
| `providers/ThemeProvider.ts` | لا شيء (تنفيذ محلي بالكامل) |
| `main.tsx` | `react`, `react-dom` |
| `App.tsx` | `react` |

---

## 13. الملفات الأكثر استيراداً (Hub Files)

| الملف | عدد الملفات التي تستورده |
|-------|-------------------------|
| `types/screenplay.ts` | ~15+ |
| `extensions/classification-types.ts` | ~10+ |
| `extensions/arabic-patterns.ts` | ~8+ |
| `constants/formats.ts` | ~7+ |
| `constants/editor-format-styles.ts` | ~5+ |
| `lib/utils.ts` | ~50+ (كل مكونات ui/) |
| `extensions/screenplay-commands.ts` | 10 (كل عُقد السيناريو) |
