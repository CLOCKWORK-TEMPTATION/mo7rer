/**
 * @module extensions/basmala
 * @description
 * عنصر البسملة (Basmala) — "بسم الله الرحمن الرحيم".
 *
 * يُصدّر:
 * - {@link isBasmalaLine} — كاشف أسطر البسملة (4 تعبيرات نمطية مُركّبة)
 * - {@link Basmala} — عقدة Tiptap للبسملة
 *
 * سلوك Enter: الانتقال إلى {@link SceneHeaderTopLine} (رأس مشهد).
 */
import { Node, mergeAttributes } from "@tiptap/core";
import {
  BASMALA_ALLAH_RE,
  BASMALA_BASM_RE,
  BASMALA_RAHIM_RE,
  BASMALA_RAHMAN_RE,
} from "./arabic-patterns";
import { normalizeLine } from "./text-utils";

/**
 * يفحص ما إذا كان السطر بسملة — يتطلب وجود "بسم" + "الله" + ("الرحمن" أو "الرحيم").
 * يُنظّف الأقواس والمحارف غير المرئية قبل الفحص.
 *
 * @param text - النص الخام للسطر
 * @returns `true` إذا طابق نمط البسملة
 */
export const isBasmalaLine = (text: string): boolean => {
  const cleaned = (text ?? "")
    .replace(/[{}()\[\]﴾﴿]/g, "")
    .replace(/[\u200f\u200e\ufeff]/g, "")
    .trim();

  const normalized = normalizeLine(cleaned);
  if (!normalized) return false;

  return (
    BASMALA_BASM_RE.test(normalized) &&
    BASMALA_ALLAH_RE.test(normalized) &&
    (BASMALA_RAHMAN_RE.test(normalized) || BASMALA_RAHIM_RE.test(normalized))
  );
};

/**
 * البسملة (Basmala)
 * "بسم الله الرحمن الرحيم"
 */
export const Basmala = Node.create({
  name: "basmala",
  group: "block",
  content: "inline*",
  defining: true,

  parseHTML() {
    return [{ tag: 'div[data-type="basmala"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-type": "basmala",
        class: "screenplay-basmala",
      }),
      0,
    ];
  },

  addKeyboardShortcuts() {
    return {
      // بعد البسملة ينتقل إلى رأس المشهد
      Enter: ({ editor }) => {
        if (!editor.isActive("basmala")) return false;
        return editor
          .chain()
          .focus()
          .splitBlock()
          .setSceneHeaderTopLine()
          .run();
      },
    };
  },
});
