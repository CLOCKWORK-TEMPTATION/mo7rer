/**
 * @module utils/file-import/extract/docx-html-to-text
 * @description تحويل HTML الناتج من Mammoth إلى نص خام حتمي مع الحفاظ
 * على فواصل الأسطر الدلالية (خصوصًا `<br />` داخل الفقرة).
 */

const NAMED_HTML_ENTITIES = {
  nbsp: '\u00A0',
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  '#39': "'",
}

const decodeHtmlEntity = (entity) => {
  if (!entity) return ''

  const normalized = entity.toLowerCase()
  if (Object.prototype.hasOwnProperty.call(NAMED_HTML_ENTITIES, normalized)) {
    return NAMED_HTML_ENTITIES[normalized]
  }

  if (normalized.startsWith('#x')) {
    const codePoint = Number.parseInt(normalized.slice(2), 16)
    if (Number.isFinite(codePoint)) {
      return String.fromCodePoint(codePoint)
    }
    return `&${entity};`
  }

  if (normalized.startsWith('#')) {
    const codePoint = Number.parseInt(normalized.slice(1), 10)
    if (Number.isFinite(codePoint)) {
      return String.fromCodePoint(codePoint)
    }
    return `&${entity};`
  }

  return `&${entity};`
}

const decodeHtmlEntities = (value) =>
  String(value ?? '').replace(/&([a-zA-Z0-9#]+);/g, (_match, entity) =>
    decodeHtmlEntity(entity),
  )

const normalizeInlineSpaces = (value) => String(value ?? '').replace(/\s+/g, ' ').trim()

const isLikelySpeakerName = (value) => {
  const name = normalizeInlineSpaces(value)
  if (!name || name.length > 28) return false
  if (name.split(' ').length > 4) return false
  if (!/^[\p{L}\p{N}\s]+$/u.test(name)) return false
  if (/^(?:مشهد|scene|قطع|انتقال|داخلي|خارجي)$/iu.test(name)) return false
  return true
}

const startsWithSpeakerCue = (line) => {
  const normalized = normalizeInlineSpaces(line)
  const match = normalized.match(/^([^:：]{1,30})\s*[:：]\s+\S+/u)
  if (!match) return false
  return isLikelySpeakerName(match[1] ?? '')
}

const countInlineCueCollisions = (line) => {
  const normalized = normalizeInlineSpaces(line)
  if (!normalized || startsWithSpeakerCue(normalized)) return 0
  if (!normalized.includes(':') && !normalized.includes('：')) return 0

  const regex = /([^:：\n]{1,30})\s*[:：]\s+\S+/gu
  let collisions = 0
  let match
  while ((match = regex.exec(normalized)) !== null) {
    const speakerName = match[1] ?? ''
    if (!isLikelySpeakerName(speakerName)) continue
    const prefix = normalized.slice(0, match.index).trim()
    const prefixWordCount = prefix ? prefix.split(/\s+/).filter(Boolean).length : 0
    if (prefixWordCount >= 4) {
      collisions += 1
    }
  }

  return collisions
}

const countMergedThenArtifacts = (line) => {
  const normalized = String(line ?? '')
  const matches = normalized.match(/\Sثم\s+/gu)
  return matches ? matches.length : 0
}

const scoreDocxTextCandidate = (text) => {
  const normalized = normalizeExtractedDocxText(text)
  const lines = normalized.split('\n').map((line) => line.trim()).filter(Boolean)
  const cueStarts = lines.reduce((count, line) => count + (startsWithSpeakerCue(line) ? 1 : 0), 0)
  const inlineCueCollisions = lines.reduce((count, line) => count + countInlineCueCollisions(line), 0)
  const mergedThenArtifacts = lines.reduce((count, line) => count + countMergedThenArtifacts(line), 0)
  const veryLongLines = lines.reduce((count, line) => count + (line.length > 220 ? 1 : 0), 0)
  const blankSeparators = (normalized.match(/\n{2,}/g) ?? []).length

  const score =
    cueStarts * 4 +
    blankSeparators * 1.5 -
    inlineCueCollisions * 5 -
    mergedThenArtifacts * 6 -
    veryLongLines * 0.35

  return {
    text: normalized,
    score,
    metrics: {
      cueStarts,
      blankSeparators,
      inlineCueCollisions,
      mergedThenArtifacts,
      veryLongLines,
    },
  }
}

export const normalizeExtractedDocxText = (value) =>
  String(value ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\u2028|\u2029/g, '\n')
    .replace(/\u0000/g, '')
    .replace(/\u000B/g, '\n')
    .replace(/\f/g, '\n')
    .replace(/^\uFEFF/, '')
    .replace(/[\u200B\u200C\u200D\u200E\u200F\u061C\u2060\uFEFF\u00AD]/g, '')
    .replace(/\u00A0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

export const convertDocxHtmlToText = (html) => {
  const source = String(html ?? '')
  const withoutComments = source.replace(/<!--[\s\S]*?-->/g, '')
  const withoutScripts = withoutComments
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')

  const withLineBreaks = withoutScripts
    // `<br>` في DOCX يمثل سطرًا ناعمًا (Shift+Enter) داخل نفس الفقرة،
    // وليس حدًا بين عناصر بنيوية. نحوّله إلى سطر واحد فقط.
    .replace(/<br\s*\/?>/gi, '\n')
    // إغلاق عناصر الكتلة: سطر واحد فقط، ونترك لـ mergeWrappedLines
    // قرار الدمج أو الفصل حسب السياق البنيوي.
    .replace(
      /<\/(?:p|div|li|tr|h[1-6]|blockquote|section|article|ul|ol|table|thead|tbody|tfoot)>/gi,
      '\n',
    )

  const noTags = withLineBreaks.replace(/<[^>]+>/g, '')
  const decoded = decodeHtmlEntities(noTags)
  return normalizeExtractedDocxText(decoded)
}

export const chooseBestDocxTextCandidate = (candidates) => {
  if (!Array.isArray(candidates) || candidates.length === 0) {
    return null
  }

  const scored = candidates
    .map((candidate) => {
      const evaluated = scoreDocxTextCandidate(candidate.text)
      return {
        ...candidate,
        text: evaluated.text,
        score: evaluated.score,
        metrics: evaluated.metrics,
      }
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      if (b.metrics.cueStarts !== a.metrics.cueStarts) {
        return b.metrics.cueStarts - a.metrics.cueStarts
      }
      if (a.metrics.inlineCueCollisions !== b.metrics.inlineCueCollisions) {
        return a.metrics.inlineCueCollisions - b.metrics.inlineCueCollisions
      }
      if (a.metrics.mergedThenArtifacts !== b.metrics.mergedThenArtifacts) {
        return a.metrics.mergedThenArtifacts - b.metrics.mergedThenArtifacts
      }
      const aNewlines = (a.text.match(/\n/g) ?? []).length
      const bNewlines = (b.text.match(/\n/g) ?? []).length
      return bNewlines - aNewlines
    })

  return scored[0] ?? null
}
