export const SCREENPLAY_BLOCK_FORMAT_IDS = [
  'basmala',
  'scene-header-top-line',
  'scene-header-1',
  'scene-header-2',
  'scene-header-3',
  'action',
  'character',
  'dialogue',
  'parenthetical',
  'transition',
] as const

export type ScreenplayFormatId = (typeof SCREENPLAY_BLOCK_FORMAT_IDS)[number]

export interface ScreenplayBlock {
  formatId: ScreenplayFormatId
  text: string
}

export interface ScreenplayPayloadV1 {
  version: 1
  blocks: ScreenplayBlock[]
  font: string
  size: string
  checksum: string
  createdAt: string
}

export const SCREENPLAY_PAYLOAD_VERSION = 1 as const
export const SCREENPLAY_PAYLOAD_TOKEN = 'FILMLANE_PAYLOAD_V1' as const

const MARKER_RE = new RegExp(
  String.raw`\[\[${SCREENPLAY_PAYLOAD_TOKEN}:([A-Za-z0-9+/=]+)\]\]`,
  'u',
)

const FORMAT_ID_SET = new Set<string>(SCREENPLAY_BLOCK_FORMAT_IDS)

const DATA_TYPE_TO_FORMAT_ID: Record<string, ScreenplayFormatId> = {
  basmala: 'basmala',
  'scene-header-top-line': 'scene-header-top-line',
  'scene-header-1': 'scene-header-1',
  'scene-header-2': 'scene-header-2',
  'scene-header-3': 'scene-header-3',
  action: 'action',
  character: 'character',
  dialogue: 'dialogue',
  parenthetical: 'parenthetical',
  transition: 'transition',
  sceneHeaderTopLine: 'scene-header-top-line',
  sceneHeader3: 'scene-header-3',
}

const normalizeBlockText = (value: string): string =>
  (value ?? '').replace(/\u00A0/g, ' ').replace(/\r/g, '')

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

const utf8ToBase64 = (value: string): string => {
  const bytes = new TextEncoder().encode(value)
  let binary = ''
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte)
  })
  return btoa(binary)
}

const base64ToUtf8 = (value: string): string => {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return new TextDecoder().decode(bytes)
}

const fnv1a = (input: string): string => {
  let hash = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

const normalizeFormatId = (value: string): ScreenplayFormatId | null => {
  if (!value) return null
  if (value in DATA_TYPE_TO_FORMAT_ID) {
    return DATA_TYPE_TO_FORMAT_ID[value]
  }
  if (FORMAT_ID_SET.has(value)) {
    return value as ScreenplayFormatId
  }
  return null
}

const getFormatIdFromElement = (element: Element): ScreenplayFormatId | null => {
  const dataType = element.getAttribute('data-type')
  if (dataType) {
    const normalized = normalizeFormatId(dataType)
    if (normalized) return normalized
  }

  const classNames = Array.from(element.classList)
  for (const className of classNames) {
    if (!className.startsWith('format-')) continue
    const rawId = className.slice('format-'.length)
    const normalized = normalizeFormatId(rawId)
    if (normalized) return normalized
  }

  return null
}

const splitLegacyTopLineText = (
  text: string,
): Array<{ formatId: 'scene-header-1' | 'scene-header-2'; text: string }> => {
  const normalized = normalizeBlockText(text).replace(/\s+/g, ' ').trim()
  if (!normalized) return []

  const pairMatch = normalized.match(
    /^((?:مشهد|scene)\s*[0-9٠-٩]+)\s*(?:[-–—:،]\s*|\s+)(.+)$/iu,
  )
  if (pairMatch) {
    return [
      { formatId: 'scene-header-1', text: pairMatch[1].trim() },
      { formatId: 'scene-header-2', text: pairMatch[2].trim() },
    ]
  }

  if (/^(?:مشهد|scene)\s*[0-9٠-٩]+/iu.test(normalized)) {
    return [{ formatId: 'scene-header-1', text: normalized }]
  }

  return [{ formatId: 'scene-header-2', text: normalized }]
}

const normalizeIncomingBlocks = (blocks: ScreenplayBlock[]): ScreenplayBlock[] => {
  const normalizedBlocks: ScreenplayBlock[] = []

  for (const block of blocks) {
    const formatId = normalizeFormatId(block.formatId)
    if (!formatId) continue

    if (formatId === 'scene-header-top-line') {
      normalizedBlocks.push(...splitLegacyTopLineText(block.text))
      continue
    }

    normalizedBlocks.push({
      formatId,
      text: normalizeBlockText(block.text),
    })
  }

  return normalizedBlocks
}

const toLineTextsFromNode = (element: Element): string[] => {
  const rawText =
    element instanceof HTMLElement && typeof element.innerText === 'string'
      ? element.innerText
      : element.textContent || ''

  const lines = normalizeBlockText(rawText)
    .split('\n')
    .map((line) => line.trim())

  return lines.length > 0 ? lines : ['']
}

const computePayloadChecksum = (
  payload: Omit<ScreenplayPayloadV1, 'checksum'>,
): string => {
  return fnv1a(JSON.stringify(payload))
}

export const ensurePayloadChecksum = (
  payload: Omit<ScreenplayPayloadV1, 'checksum'> & { checksum?: string },
): ScreenplayPayloadV1 => {
  const unsignedPayload = {
    version: SCREENPLAY_PAYLOAD_VERSION,
    blocks: normalizeIncomingBlocks(payload.blocks),
    font: payload.font,
    size: payload.size,
    createdAt: payload.createdAt,
  } as const

  return {
    ...unsignedPayload,
    checksum: computePayloadChecksum(unsignedPayload),
  }
}

export const buildPayloadMarker = (encodedPayload: string): string =>
  `[[${SCREENPLAY_PAYLOAD_TOKEN}:${encodedPayload}]]`

export const extractEncodedPayloadMarker = (text: string): string | null => {
  const match = (text ?? '').match(MARKER_RE)
  return match?.[1] ?? null
}

export const encodeScreenplayPayload = (payload: ScreenplayPayloadV1): string =>
  utf8ToBase64(JSON.stringify(payload))

export const decodeScreenplayPayload = (
  encodedPayload: string,
): ScreenplayPayloadV1 | null => {
  try {
    const decoded = base64ToUtf8(encodedPayload)
    const parsed = JSON.parse(decoded) as Partial<ScreenplayPayloadV1>

    if (
      parsed?.version !== SCREENPLAY_PAYLOAD_VERSION ||
      !Array.isArray(parsed.blocks) ||
      typeof parsed.font !== 'string' ||
      typeof parsed.size !== 'string' ||
      typeof parsed.createdAt !== 'string' ||
      typeof parsed.checksum !== 'string'
    ) {
      return null
    }

    const sanitizedBlocks: ScreenplayBlock[] = []
    for (const block of parsed.blocks) {
      if (!block || typeof block !== 'object') continue
      if (typeof block.text !== 'string' || typeof block.formatId !== 'string') continue

      const normalized = normalizeFormatId(block.formatId)
      if (!normalized) continue

      sanitizedBlocks.push({
        formatId: normalized,
        text: normalizeBlockText(block.text),
      })
    }

    const rebuilt = ensurePayloadChecksum({
      version: SCREENPLAY_PAYLOAD_VERSION,
      blocks: sanitizedBlocks,
      font: parsed.font,
      size: parsed.size,
      createdAt: parsed.createdAt,
    })

    if (rebuilt.checksum !== parsed.checksum) {
      return null
    }

    return rebuilt
  } catch {
    return null
  }
}

export const extractPayloadFromText = (text: string): ScreenplayPayloadV1 | null => {
  const encoded = extractEncodedPayloadMarker(text)
  if (!encoded) return null
  return decodeScreenplayPayload(encoded)
}

export const htmlToScreenplayBlocks = (html: string): ScreenplayBlock[] => {
  if (!html || !html.trim()) return []
  if (typeof DOMParser === 'undefined') return []

  const parser = new DOMParser()
  const documentRef = parser.parseFromString(
    `<div id="screenplay-model-root">${html}</div>`,
    'text/html',
  )
  const root = documentRef.getElementById('screenplay-model-root')
  if (!root) return []

  const blocks: ScreenplayBlock[] = []

  root.childNodes.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const textLines = normalizeBlockText(node.textContent || '')
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0)

      textLines.forEach((line) => {
        blocks.push({ formatId: 'action', text: line })
      })
      return
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return

    const element = node as HTMLElement
    const formatId = getFormatIdFromElement(element) ?? 'action'

    if (formatId === 'scene-header-top-line') {
      const directChildren = Array.from(element.children)
      const sceneHeader1 = directChildren.find((child) => {
        const id = getFormatIdFromElement(child)
        return id === 'scene-header-1'
      })
      const sceneHeader2 = directChildren.find((child) => {
        const id = getFormatIdFromElement(child)
        return id === 'scene-header-2'
      })

      if (sceneHeader1) {
        toLineTextsFromNode(sceneHeader1).forEach((line) => {
          blocks.push({ formatId: 'scene-header-1', text: line })
        })
      }

      if (sceneHeader2) {
        toLineTextsFromNode(sceneHeader2).forEach((line) => {
          blocks.push({ formatId: 'scene-header-2', text: line })
        })
      }

      if (!sceneHeader1 && !sceneHeader2) {
        blocks.push(...splitLegacyTopLineText(element.textContent || ''))
      }

      return
    }

    toLineTextsFromNode(element).forEach((line) => {
      blocks.push({ formatId, text: line })
    })
  })

  return normalizeIncomingBlocks(blocks)
}

const renderTopLineBlock = (header1: string, header2: string): string => {
  const top = normalizeBlockText(header1).trim()
  const bottom = normalizeBlockText(header2).trim()
  return `<div data-type="scene-header-top-line"><div data-type="scene-header-1">${
    top ? escapeHtml(top) : ''
  }</div><div data-type="scene-header-2">${bottom ? escapeHtml(bottom) : ''}</div></div>`
}

export const screenplayBlocksToHtml = (blocks: ScreenplayBlock[]): string => {
  const normalized = normalizeIncomingBlocks(
    (blocks ?? []).filter(
      (block): block is ScreenplayBlock =>
        Boolean(block) &&
        typeof block.text === 'string' &&
        typeof block.formatId === 'string',
    ),
  )

  const html: string[] = []

  for (let i = 0; i < normalized.length; i++) {
    const current = normalized[i]
    const next = normalized[i + 1]

    if (current.formatId === 'scene-header-top-line') {
      const parts = splitLegacyTopLineText(current.text)
      const header1 = parts.find((part) => part.formatId === 'scene-header-1')?.text ?? ''
      const header2 = parts.find((part) => part.formatId === 'scene-header-2')?.text ?? ''
      html.push(renderTopLineBlock(header1, header2))
      continue
    }

    if (current.formatId === 'scene-header-1') {
      if (next && next.formatId === 'scene-header-2') {
        html.push(renderTopLineBlock(current.text, next.text))
        i += 1
        continue
      }
      html.push(renderTopLineBlock(current.text, ''))
      continue
    }

    if (current.formatId === 'scene-header-2') {
      html.push(renderTopLineBlock('', current.text))
      continue
    }

    const text = normalizeBlockText(current.text)
    const htmlText = text ? escapeHtml(text).replace(/\n/g, '<br>') : ''
    html.push(`<div data-type="${current.formatId}">${htmlText}</div>`)
  }

  return html.join('')
}

export const createPayloadFromBlocks = (
  blocks: ScreenplayBlock[],
  options?: {
    font?: string
    size?: string
    createdAt?: string
  },
): ScreenplayPayloadV1 => {
  return ensurePayloadChecksum({
    version: SCREENPLAY_PAYLOAD_VERSION,
    blocks: normalizeIncomingBlocks(blocks),
    font: options?.font ?? 'AzarMehrMonospaced-San',
    size: options?.size ?? '12pt',
    createdAt: options?.createdAt ?? new Date().toISOString(),
  })
}

export const createPayloadFromHtml = (
  html: string,
  options?: {
    font?: string
    size?: string
    createdAt?: string
  },
): ScreenplayPayloadV1 => {
  const blocks = htmlToScreenplayBlocks(html)
  return createPayloadFromBlocks(blocks, options)
}
