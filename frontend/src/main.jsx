import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { LanguageCurrencyProvider } from './context/LanguageCurrencyContext.jsx'
import { ThemeProvider } from './context/ThemeContext.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import { initNumpadFix } from './utils/numpadFix.js'

initNumpadFix();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <LanguageCurrencyProvider>
          <App />
        </LanguageCurrencyProvider>
      </ThemeProvider>
    </ErrorBoundary>
  </StrictMode>,
)
