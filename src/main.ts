import './styles/globals.css'
import './styles/ui-kit.css'
import './styles/main.css'
import './styles/page.css'
import './styles/toolbar.css'
import './styles/shell.css'

import { mountScreenplayEditor } from './components/editor'
import { createToaster } from './components/ui'
import { createThemeProvider } from './providers'

function init(): void {
  const app = document.getElementById('app')
  if (!app) {
    console.error('تعذر العثور على عنصر التطبيق #app')
    return
  }

  createThemeProvider({
    attribute: 'class',
    defaultTheme: 'dark',
    enableSystem: false,
    storageKey: 'filmlane.theme',
  })

  const toaster = createToaster()
  document.body.appendChild(toaster.element)

  mountScreenplayEditor(app)
}

document.addEventListener('DOMContentLoaded', init)
