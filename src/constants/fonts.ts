export interface FontOption {
  value: string
  label: string
}

export interface TextSizeOption {
  value: string
  label: string
}

export const fonts: readonly FontOption[] = [
  { value: 'AzarMehrMonospaced-San', label: 'أزار مهر أحادي' },
]

export const textSizes: readonly TextSizeOption[] = [{ value: '12pt', label: '12' }]
