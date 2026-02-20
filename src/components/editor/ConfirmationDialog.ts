import type { ElementType } from '../../extensions/classification-types'

interface ClassificationOption {
  value: ElementType
  label: string
}

const CLASSIFICATION_OPTIONS: readonly ClassificationOption[] = [
  { value: 'basmala', label: 'بسملة' },
  { value: 'sceneHeaderTopLine', label: 'سطر رأس المشهد' },
  { value: 'sceneHeader3', label: 'رأس المشهد (3)' },
  { value: 'action', label: 'حدث / وصف' },
  { value: 'character', label: 'شخصية' },
  { value: 'dialogue', label: 'حوار' },
  { value: 'parenthetical', label: 'تعليمات حوار' },
  { value: 'transition', label: 'انتقال' },
]

export interface ClassificationConfirmationPayload {
  line: string
  suggestedType: ElementType
  confidence: number
}

export interface ClassificationConfirmationDialogCallbacks {
  onConfirm: (finalType: ElementType) => void
  onCancel: () => void
}

export class ClassificationConfirmationDialog {
  readonly element: HTMLDivElement

  private readonly contentLine: HTMLParagraphElement
  private readonly confidenceText: HTMLParagraphElement
  private readonly selectElement: HTMLSelectElement
  private readonly callbacks: ClassificationConfirmationDialogCallbacks

  constructor(callbacks: ClassificationConfirmationDialogCallbacks) {
    this.callbacks = callbacks

    this.element = document.createElement('div')
    this.element.className = 'classification-dialog is-hidden'

    const panel = document.createElement('div')
    panel.className = 'classification-dialog__panel'

    const title = document.createElement('h3')
    title.className = 'classification-dialog__title'
    title.textContent = 'تأكيد التصنيف'

    this.confidenceText = document.createElement('p')
    this.confidenceText.className = 'classification-dialog__confidence'

    this.contentLine = document.createElement('p')
    this.contentLine.className = 'classification-dialog__line'

    this.selectElement = document.createElement('select')
    this.selectElement.className = 'classification-dialog__select'
    this.selectElement.dir = 'rtl'

    for (const option of CLASSIFICATION_OPTIONS) {
      const optionElement = document.createElement('option')
      optionElement.value = option.value
      optionElement.textContent = option.label
      this.selectElement.appendChild(optionElement)
    }

    const actions = document.createElement('div')
    actions.className = 'classification-dialog__actions'

    const cancelButton = document.createElement('button')
    cancelButton.className = 'classification-dialog__btn classification-dialog__btn--ghost'
    cancelButton.type = 'button'
    cancelButton.textContent = 'إلغاء'
    cancelButton.addEventListener('click', () => {
      this.close()
      this.callbacks.onCancel()
    })

    const confirmButton = document.createElement('button')
    confirmButton.className = 'classification-dialog__btn classification-dialog__btn--primary'
    confirmButton.type = 'button'
    confirmButton.textContent = 'تأكيد'
    confirmButton.addEventListener('click', () => {
      this.close()
      this.callbacks.onConfirm(this.selectElement.value as ElementType)
    })

    actions.appendChild(cancelButton)
    actions.appendChild(confirmButton)

    panel.appendChild(title)
    panel.appendChild(this.confidenceText)
    panel.appendChild(this.contentLine)
    panel.appendChild(this.selectElement)
    panel.appendChild(actions)

    this.element.appendChild(panel)

    this.element.addEventListener('click', (event) => {
      if (event.target === this.element) {
        this.close()
        this.callbacks.onCancel()
      }
    })
  }

  open(payload: ClassificationConfirmationPayload): void {
    this.contentLine.textContent = payload.line
    this.confidenceText.textContent = `الثقة الحالية: ${Math.round(payload.confidence)}%`
    this.selectElement.value = payload.suggestedType
    this.element.classList.remove('is-hidden')
  }

  close(): void {
    this.element.classList.add('is-hidden')
  }
}
