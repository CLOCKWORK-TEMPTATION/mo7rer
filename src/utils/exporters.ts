import { jsPDF } from "jspdf";
import {
  buildPayloadMarker,
  createPayloadFromBlocks,
  encodeScreenplayPayload,
  htmlToScreenplayBlocks,
  type ScreenplayBlock,
} from "./file-import/document-model";

interface ExportRequest {
  html: string;
  fileNameBase?: string;
  title?: string;
}

interface ExportToDocxOptions {
  blocks?: ScreenplayBlock[];
}

const DEFAULT_EXPORT_FILE_BASE = "screenplay";
const DEFAULT_DOCX_FONT = "AzarMehrMonospaced-San";
const DEFAULT_DOCX_SIZE_HALF_POINTS = 24;

type DocxParagraphPreset = {
  alignment: "right" | "center" | "left" | "justify";
  bold?: boolean;
  italics?: boolean;
  spacingBeforePt?: number;
  spacingAfterPt?: number;
  indentStartTwip?: number;
  indentEndTwip?: number;
};

const downloadBlob = (fileName: string, blob: Blob): void => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};

export const sanitizeExportFileBaseName = (fileNameBase?: string): string => {
  const candidate = (fileNameBase ?? DEFAULT_EXPORT_FILE_BASE).trim();
  const normalized = candidate
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, "-");
  return normalized || DEFAULT_EXPORT_FILE_BASE;
};

const pointsToTwips = (value: number): number =>
  Math.max(0, Math.round(value * 20));

const normalizeText = (value: string): string =>
  (value ?? "")
    .replace(/\u00A0/g, " ")
    .replace(/\r/g, "")
    .trim();

const resolveBlocksForExport = (
  content: string,
  blocks?: ScreenplayBlock[]
): ScreenplayBlock[] => {
  if (Array.isArray(blocks) && blocks.length > 0) {
    return blocks;
  }
  return htmlToScreenplayBlocks(content);
};

const getDocxPresetForFormat = (
  formatId: ScreenplayBlock["formatId"]
): DocxParagraphPreset => {
  switch (formatId) {
    case "basmala":
      return {
        alignment: "center",
        bold: true,
        spacingAfterPt: 10,
      };
    case "scene-header-1":
      return {
        alignment: "right",
        bold: true,
        spacingBeforePt: 8,
        spacingAfterPt: 6,
      };
    case "scene-header-2":
      return {
        alignment: "right",
        spacingAfterPt: 4,
      };
    case "scene-header-3":
      return {
        alignment: "center",
        spacingAfterPt: 4,
      };
    case "scene-header-top-line":
      return {
        alignment: "right",
        spacingAfterPt: 6,
      };
    case "character":
      return {
        alignment: "center",
        bold: true,
        spacingBeforePt: 8,
        spacingAfterPt: 2,
      };
    case "dialogue":
      return {
        alignment: "right",
        spacingAfterPt: 6,
        indentStartTwip: 960,
        indentEndTwip: 720,
      };
    case "parenthetical":
      return {
        alignment: "center",
        italics: true,
        spacingAfterPt: 4,
      };
    case "transition":
      return {
        alignment: "left",
        bold: true,
        spacingBeforePt: 6,
        spacingAfterPt: 6,
      };
    case "action":
      return {
        alignment: "justify",
        spacingAfterPt: 6,
      };
    default:
      return {
        alignment: "right",
        spacingAfterPt: 6,
      };
  }
};

const mapAlignment = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  AlignmentType: any,
  alignment: DocxParagraphPreset["alignment"]
) => {
  switch (alignment) {
    case "center":
      return AlignmentType.CENTER;
    case "left":
      return AlignmentType.LEFT;
    case "justify":
      return AlignmentType.JUSTIFIED;
    default:
      return AlignmentType.RIGHT;
  }
};

export const exportToDocx = async (
  content: string,
  filename: string = "screenplay.docx",
  options?: ExportToDocxOptions
): Promise<void> => {
  const { AlignmentType, Document, Packer, Paragraph, TextRun } =
    await import("docx");

  const blocks = resolveBlocksForExport(content, options?.blocks);
  const payload = createPayloadFromBlocks(blocks, {
    font: "AzarMehrMonospaced-San",
    size: "12pt",
  });
  const payloadMarker = buildPayloadMarker(encodeScreenplayPayload(payload));

  const paragraphs = blocks.map((block) => {
    const preset = getDocxPresetForFormat(block.formatId);
    return new Paragraph({
      bidirectional: true,
      alignment: mapAlignment(AlignmentType, preset.alignment),
      spacing: {
        before: pointsToTwips(preset.spacingBeforePt ?? 0),
        after: pointsToTwips(preset.spacingAfterPt ?? 0),
      },
      indent: {
        start: preset.indentStartTwip,
        end: preset.indentEndTwip,
      },
      children: [
        new TextRun({
          text: normalizeText(block.text),
          font: DEFAULT_DOCX_FONT,
          size: DEFAULT_DOCX_SIZE_HALF_POINTS,
          bold: preset.bold,
          italics: preset.italics,
        }),
      ],
    });
  });

  if (paragraphs.length === 0) {
    paragraphs.push(
      new Paragraph({
        bidirectional: true,
        children: [
          new TextRun({
            text: "",
            font: DEFAULT_DOCX_FONT,
            size: DEFAULT_DOCX_SIZE_HALF_POINTS,
          }),
        ],
      })
    );
  }

  // Marker مخفي لاسترجاع payload 1:1 عند إعادة فتح الملف.
  paragraphs.push(
    new Paragraph({
      bidirectional: true,
      spacing: { before: 0, after: 0 },
      children: [
        new TextRun({
          text: payloadMarker,
          color: "FFFFFF",
          size: 2,
          font: DEFAULT_DOCX_FONT,
        }),
      ],
    })
  );

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1440,
              right: 1440,
              bottom: 1440,
              left: 1440,
            },
          },
        },
        children: paragraphs,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const buildFullHtmlDocument = (
  bodyHtml: string,
  title = "تصدير محرر السيناريو"
): string => `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <style>
    body {
      margin: 0 auto;
      width: min(794px, 100%);
      padding: 28px;
      direction: rtl;
      text-align: right;
      font-family: 'Cairo', system-ui, sans-serif;
      line-height: 1.8;
      color: #0f172a;
      background: #ffffff;
      box-sizing: border-box;
    }
    [data-type='character'], [data-type='scene-header-1'], [data-type='scene-header-2'], [data-type='scene-header-3'], [data-type='basmala'], [data-type='transition'] {
      font-weight: 700;
    }
    [data-type='scene-header-top-line'] {
      margin: 0 0 12px 0;
    }
    [data-type] {
      margin-bottom: 10px;
      white-space: pre-wrap;
    }
  </style>
</head>
<body>
${bodyHtml}
</body>
</html>`;

export const exportAsHtml = (request: ExportRequest): void => {
  const fileBase = sanitizeExportFileBaseName(request.fileNameBase);
  const fullDoc = buildFullHtmlDocument(request.html, request.title);
  const blob = new Blob([fullDoc], { type: "text/html;charset=utf-8" });
  downloadBlob(`${fileBase}.html`, blob);
};

export const exportAsPdf = async (request: ExportRequest): Promise<void> => {
  const fileBase = sanitizeExportFileBaseName(request.fileNameBase);
  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.left = "-10000px";
  container.style.top = "0";
  container.style.width = "794px";
  container.style.background = "#fff";
  container.style.direction = "rtl";
  container.style.padding = "24px";
  container.innerHTML = request.html;
  document.body.appendChild(container);

  try {
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "pt",
      format: "a4",
      compress: true,
    });
    pdf.setR2L(true);

    await pdf.html(container, {
      x: 24,
      y: 24,
      margin: [24, 24, 24, 24],
      autoPaging: "text",
      width: 547,
      windowWidth: 794,
      html2canvas: {
        scale: 1.2,
      },
    });

    pdf.save(`${fileBase}.pdf`);
  } finally {
    container.remove();
  }
};
