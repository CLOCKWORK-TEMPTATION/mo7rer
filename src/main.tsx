import './styles/globals.css'
import './styles/ui-kit.css'
import './styles/main.css'
import './styles/page.css'
import './styles/toolbar.css'
import './styles/shell.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { createToaster } from './components/ui'
import { createThemeProvider } from './providers'

createThemeProvider({
  attribute: 'class',
  defaultTheme: 'dark',
  enableSystem: false,
  storageKey: 'filmlane.theme',
})

const toaster = createToaster()
document.body.appendChild(toaster.element)

const root = document.getElementById('app')
if (root) {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
} else {
  console.error('تعذر العثور على عنصر التطبيق #app')
}
