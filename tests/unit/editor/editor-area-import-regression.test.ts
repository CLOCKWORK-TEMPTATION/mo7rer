import { beforeEach, describe, expect, it, vi } from 'vitest'

const doubles = vi.hoisted(() => {
  const stripTags = (value: string): string => value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  let html = '<div data-type="action"></div>'
  let text = ''

  const chain = {
    focus: vi.fn(() => chain),
    insertContent: vi.fn((value: string) => {
      html += value
      text = `${text} ${stripTags(value)}`.trim()
      return chain
    }),
    run: vi.fn(() => true),
  }

  const editor = {
    commands: {
      setContent: vi.fn((value: string) => {
        html = value
        text = stripTags(value)
      }),
      focus: vi.fn(),
      selectAll: vi.fn(),
    },
    chain: vi.fn(() => chain),
    extensionManager: { extensions: [] as Array<{ name: string }> },
    on: vi.fn(),
    off: vi.fn(),
    getText: vi.fn(() => text),
    getHTML: vi.fn(() => html),
    isActive: vi.fn(() => false),
    storage: {},
    view: {
      state: {
        selection: { from: 2, to: 4 },
        doc: {
          content: {
            size: 10,
          },
        },
      },
      dispatch: vi.fn(),
      isDestroyed: false,
    },
    state: {
      selection: { empty: true, from: 0, to: 0 },
      doc: {
        textBetween: vi.fn(() => ''),
      },
    },
    destroy: vi.fn(),
  }

  const applyPasteClassifierFlowToView = vi.fn<
    (view: unknown, text: string, options?: { from?: number; to?: number }) => Promise<boolean>
  >()

  return {
    editor,
    chain,
    applyPasteClassifierFlowToView,
    reset: () => {
      html = '<div data-type="action"></div>'
      text = ''
      chain.focus.mockClear()
      chain.insertContent.mockClear()
      chain.run.mockClear()
      editor.commands.setContent.mockClear()
      editor.chain.mockClear()
      editor.on.mockClear()
      editor.off.mockClear()
      editor.destroy.mockClear()
      applyPasteClassifierFlowToView.mockReset()
    },
  }
})

vi.mock('../../../src/editor', () => ({
  createScreenplayEditor: vi.fn(() => doubles.editor),
  SCREENPLAY_ELEMENTS: [],
}))

vi.mock('../../../src/extensions/paste-classifier', () => ({
  applyPasteClassifierFlowToView: doubles.applyPasteClassifierFlowToView,
}))

import { EditorArea } from '../../../src/components/editor/EditorArea'

describe('EditorArea import regression', () => {
  beforeEach(() => {
    doubles.reset()
  })

  it('fails hard when remote review path fails', async () => {
    doubles.applyPasteClassifierFlowToView.mockRejectedValueOnce(new Error('agent down'))

    const mount = document.createElement('div')
    document.body.appendChild(mount)
    const area = new EditorArea({ mount })

    await expect(area.importClassifiedText('مرحبا', 'replace')).rejects.toThrow('agent down')
    expect(doubles.applyPasteClassifierFlowToView).toHaveBeenCalledWith(
      doubles.editor.view,
      'مرحبا',
      expect.objectContaining({ from: 0, to: 10 }),
    )

    expect(doubles.editor.commands.setContent).not.toHaveBeenCalled()

    area.destroy()
    mount.remove()
  })

  it('imports structured blocks in insert mode through editor chain', () => {
    const mount = document.createElement('div')
    document.body.appendChild(mount)
    const area = new EditorArea({ mount })

    area.importStructuredBlocks([{ formatId: 'dialogue', text: 'هذا اختبار' }], 'insert')
    expect(doubles.chain.insertContent).toHaveBeenCalledTimes(1)
    expect(String(doubles.chain.insertContent.mock.calls[0]?.[0])).toContain('data-type="dialogue"')

    area.destroy()
    mount.remove()
  })

  it('ignores empty structured blocks payload', () => {
    const mount = document.createElement('div')
    document.body.appendChild(mount)
    const area = new EditorArea({ mount })

    area.importStructuredBlocks([], 'replace')
    expect(doubles.editor.commands.setContent).not.toHaveBeenCalled()

    area.destroy()
    mount.remove()
  })
})
