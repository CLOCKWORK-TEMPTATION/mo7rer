import { ACCEPTED_FILE_EXTENSIONS } from '../../types/file-import'

export const pickImportFile = (
  accept: string = ACCEPTED_FILE_EXTENSIONS,
): Promise<File | null> =>
  new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = accept

    input.onchange = () => {
      resolve(input.files?.[0] ?? null)
    }

    input.click()
  })
