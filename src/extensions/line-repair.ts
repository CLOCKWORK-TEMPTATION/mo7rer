import type { ElementType } from './classification-types'
import { CHARACTER_RE } from './arabic-patterns'
import { normalizeLine, stripLeadingBullets } from './text-utils'

const HTML_TAG_RE = /<[^>]+>/g

export const extractPlainTextFromHtmlLikeLine = (line: string): string => {
  const raw = (line ?? '').trim()
  if (!raw || !/[<>]/.test(raw)) return raw

  return raw
    .replace(HTML_TAG_RE, ' ')
    .replace(/\u00A0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export const parseBulletLine = (line: string): string => {
  const plain = extractPlainTextFromHtmlLikeLine(line)
  return normalizeLine(stripLeadingBullets(plain))
}

/**
 * دمج التفاف السطر للحوار فقط عندما يبدو استكمالًا لنفس الجملة.
 */
export const shouldMergeWrappedLines = (
  previousLine: string,
  currentLine: string,
  previousType?: ElementType
): boolean => {
  const prev = normalizeLine(previousLine)
  const curr = normalizeLine(currentLine)
  if (!prev || !curr) return false
  if (previousType !== 'dialogue') return false
  if (/^[-–—•●○]/.test(prev) || /^[-–—•●○]/.test(curr)) return false
  if (/[:：]\s*$/.test(curr)) return false

  const prevEndsSentence = /[.!؟?!…»"]\s*$/.test(prev)
  const startsAsContinuation = /^(?:\.{3}|…|،|(?:و|ثم)\s+)/.test(curr)
  return startsAsContinuation && !prevEndsSentence
}

/**
 * يحاول دمج اسم شخصية منقسم على سطرين (حالة شائعة في نسخ Word/PDF).
 */
export const mergeBrokenCharacterName = (
  previousLine: string,
  currentLine: string
): string | null => {
  const prevRaw = parseBulletLine(previousLine)
  const currRaw = parseBulletLine(currentLine)

  if (!prevRaw || !currRaw) return null
  if (/[.!؟"]$/.test(prevRaw)) return null
  if (!/[:：]\s*$/.test(currRaw)) return null

  const prevNamePart = prevRaw.replace(/[:：]+\s*$/, '').trim()
  const currNamePart = currRaw.replace(/[:：]+\s*$/, '').trim()
  if (!prevNamePart || !currNamePart) return null

  if (prevNamePart.length > 25) return null
  if (currNamePart.split(/\s+/).filter(Boolean).length > 3) return null
  if (prevNamePart.length + currNamePart.length > 32) return null

  const directMerge = `${prevNamePart}${currNamePart}`
  const spaceMerge = `${prevNamePart} ${currNamePart}`

  if (CHARACTER_RE.test(`${directMerge}:`) && !/[.!؟,،"«»]/.test(directMerge)) {
    return `${directMerge}:`
  }

  if (CHARACTER_RE.test(`${spaceMerge}:`) && !/[.!؟,،"«»]/.test(spaceMerge)) {
    return `${spaceMerge}:`
  }

  return null
}

