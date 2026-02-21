import type { CSSProperties } from 'react'

export const EDITOR_STYLE_FORMAT_IDS = [
  'basmala',
  'scene-header-1',
  'scene-header-2',
  'scene-header-3',
  'action',
  'character',
  'dialogue',
  'parenthetical',
  'transition',
  'scene-header-top-line',
] as const

export type EditorStyleFormatId = (typeof EDITOR_STYLE_FORMAT_IDS)[number]

export const LOCKED_EDITOR_FONT_FAMILY = "'AzarMehrMonospaced-San', monospace"
export const LOCKED_EDITOR_FONT_SIZE = '12pt'
export const LOCKED_EDITOR_LINE_HEIGHT = '15pt'

export const getFormatStyles = (
  formatType: EditorStyleFormatId | string,
  selectedSize: string = LOCKED_EDITOR_FONT_SIZE,
  selectedFont: string = 'AzarMehrMonospaced-San',
): CSSProperties => {
  const normalizedSize = selectedSize === LOCKED_EDITOR_FONT_SIZE ? selectedSize : LOCKED_EDITOR_FONT_SIZE
  const normalizedLineHeight = LOCKED_EDITOR_LINE_HEIGHT

  const baseStyles: CSSProperties = {
    fontFamily: selectedFont,
    fontSize: normalizedSize,
    direction: 'rtl',
    lineHeight: normalizedLineHeight,
    minHeight: normalizedLineHeight,
    fontWeight: 'bold',
  }

  const formatStyles: Record<string, CSSProperties> = {
    basmala: {
      textAlign: 'left',
      direction: 'rtl',
      width: '100%',
      fontWeight: 'normal',
      margin: '0 0 0 0',
    },
    'scene-header-top-line': {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'baseline',
      width: '100%',
      fontWeight: 'bold',
    },
    'scene-header-1': {
      fontWeight: 'bold',
      textTransform: 'uppercase',
    },
    'scene-header-2': {
      fontWeight: 'bold',
    },
    'scene-header-3': {
      textAlign: 'center',
      fontWeight: 'bold',
    },
    action: {
      textAlign: 'justify',
      textAlignLast: 'right',
      textJustify: 'inter-word',
      width: '100%',
      margin: '0',
    },
    character: {
      textAlign: 'center',
      margin: '0 auto',
    },
    parenthetical: {
      textAlign: 'center',
      margin: '0 auto',
    },
    dialogue: {
      width: '4.1in',
      textAlign: 'center',
      margin: '0 auto',
      fontWeight: 'normal',
      paddingLeft: '1.5em',
      paddingRight: '1em',
      paddingTop: '0.25em',
      paddingBottom: '0',
    },
    transition: {
      textAlign: 'center',
      margin: '0 auto',
    },
  }

  return { ...baseStyles, ...formatStyles[formatType] }
}

/**
 * =========================
 *  Spacing Rules (قواعد التباعد بين العناصر)
 * =========================
 *
 * القواعد:
 * - basmala → أي عنصر: لا سطر فارغ
 * - scene-header-2 → scene-header-3: سطر فارغ
 * - scene-header-3 → action: سطر فارغ
 * - action → action/character/transition: سطر فارغ
 * - character → dialogue/parenthetical: لا سطر فارغ (ممنوع!)
 * - dialogue → character/action/transition: سطر فارغ
 * - parenthetical → يتبع نفس قواعد dialogue
 * - transition → scene-header-1/scene-header-top-line: سطر فارغ
 */
export const getSpacingMarginTop = (
  previousFormat: string,
  currentFormat: string,
): string => {
  if (
    previousFormat === 'basmala' &&
    currentFormat === 'scene-header-top-line'
  ) {
    return '12pt'
  }

  if (previousFormat === 'basmala') {
    return '0'
  }

  if (previousFormat === 'character') {
    if (currentFormat === 'dialogue' || currentFormat === 'parenthetical') {
      return '0'
    }
  }

  if (previousFormat === 'parenthetical' && currentFormat === 'dialogue') {
    return '0'
  }

  if (
    previousFormat === 'scene-header-2' &&
    currentFormat === 'scene-header-3'
  ) {
    return '0'
  }

  if (previousFormat === 'scene-header-3' && currentFormat === 'action') {
    return '12pt'
  }

  if (previousFormat === 'action') {
    if (
      currentFormat === 'action' ||
      currentFormat === 'character' ||
      currentFormat === 'transition'
    ) {
      return '12pt'
    }
  }

  if (previousFormat === 'dialogue') {
    if (
      currentFormat === 'character' ||
      currentFormat === 'action' ||
      currentFormat === 'transition'
    ) {
      return '12pt'
    }
  }

  if (previousFormat === 'parenthetical') {
    if (
      currentFormat === 'character' ||
      currentFormat === 'action' ||
      currentFormat === 'transition'
    ) {
      return '0'
    }
  }

  if (previousFormat === 'transition') {
    if (
      currentFormat === 'scene-header-1' ||
      currentFormat === 'scene-header-top-line'
    ) {
      return '12pt'
    }
  }

  return ''
}

const cssValue = (value: CSSProperties[keyof CSSProperties] | undefined, fallback = '0'): string => {
  if (value === undefined || value === null) return fallback
  return typeof value === 'number' ? `${value}` : String(value)
}

export const applyEditorFormatStyleVariables = (style: CSSStyleDeclaration): void => {
  const stylesByFormat: Record<EditorStyleFormatId, CSSProperties> = {
    basmala: getFormatStyles('basmala'),
    'scene-header-1': getFormatStyles('scene-header-1'),
    'scene-header-2': getFormatStyles('scene-header-2'),
    'scene-header-3': getFormatStyles('scene-header-3'),
    action: getFormatStyles('action'),
    character: getFormatStyles('character'),
    dialogue: getFormatStyles('dialogue'),
    parenthetical: getFormatStyles('parenthetical'),
    transition: getFormatStyles('transition'),
    'scene-header-top-line': getFormatStyles('scene-header-top-line'),
  }

  style.setProperty('--editor-font-family', LOCKED_EDITOR_FONT_FAMILY)
  style.setProperty('--editor-font-size', LOCKED_EDITOR_FONT_SIZE)
  style.setProperty('--editor-line-height', LOCKED_EDITOR_LINE_HEIGHT)

  style.setProperty('--fmt-basmala-margin', cssValue(stylesByFormat.basmala.margin, '0'))
  style.setProperty('--fmt-basmala-padding', cssValue(stylesByFormat.basmala.padding, '0'))

  style.setProperty('--fmt-scene-header-top-line-margin-top', cssValue(stylesByFormat['scene-header-top-line'].marginTop, '0'))
  style.setProperty('--fmt-scene-header-top-line-padding', cssValue(stylesByFormat['scene-header-top-line'].padding, '0'))

  style.setProperty('--fmt-scene-header-3-padding', cssValue(stylesByFormat['scene-header-3'].padding, '0'))
  style.setProperty('--fmt-scene-header-3-margin-bottom', cssValue(stylesByFormat['scene-header-3'].marginBottom, '0'))

  style.setProperty('--fmt-action-margin', cssValue(stylesByFormat.action.margin, '0'))
  style.setProperty('--fmt-action-padding', cssValue(stylesByFormat.action.padding, '0'))

  style.setProperty('--fmt-character-margin', cssValue(stylesByFormat.character.margin, '0 auto'))
  style.setProperty('--fmt-character-padding', cssValue(stylesByFormat.character.padding, '0'))

  style.setProperty('--fmt-parenthetical-margin', cssValue(stylesByFormat.parenthetical.margin, '0 auto'))
  style.setProperty('--fmt-parenthetical-padding', cssValue(stylesByFormat.parenthetical.padding, '0'))

  style.setProperty('--fmt-dialogue-width', cssValue(stylesByFormat.dialogue.width, '4.1in'))
  style.setProperty('--fmt-dialogue-margin', cssValue(stylesByFormat.dialogue.margin, '0 auto'))
  style.setProperty('--fmt-dialogue-padding-left', cssValue(stylesByFormat.dialogue.paddingLeft, '1.5em'))
  style.setProperty('--fmt-dialogue-padding-right', cssValue(stylesByFormat.dialogue.paddingRight, '1em'))
  style.setProperty('--fmt-dialogue-padding-top', cssValue(stylesByFormat.dialogue.paddingTop, '0.25em'))
  style.setProperty('--fmt-dialogue-padding-bottom', cssValue(stylesByFormat.dialogue.paddingBottom, '0'))

  style.setProperty('--fmt-transition-margin', cssValue(stylesByFormat.transition.margin, '0 auto'))
  style.setProperty('--fmt-transition-padding', cssValue(stylesByFormat.transition.padding, '0'))
}
