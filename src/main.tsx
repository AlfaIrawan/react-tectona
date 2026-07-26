import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { initializeAnimationSpeed } from './lib/animationUtils'
import { initTelemetry } from './lib/tracing'
import { initRum } from './lib/rum'
import { selfRegisterWithRegistryCore } from './lib/selfRegister'
import { initPwa } from './lib/pwa/initPwa'

// Ensure light mode is set immediately before React renders
if (typeof window !== 'undefined') {
  // Check if user has a saved preference
  const savedTheme = localStorage.getItem('ai_monitor_theme')
  const themeData = savedTheme ? JSON.parse(savedTheme) : { state: { theme: 'light' } }
  const theme = themeData?.state?.theme || 'light'
  
  // Apply theme immediately
  document.documentElement.classList.remove('light', 'dark')
  if (theme === 'system') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    document.documentElement.classList.add(prefersDark ? 'dark' : 'light')
  } else {
    document.documentElement.classList.add(theme)
  }

  // Initialize animation speed and accent from preferences
  const savedPreferences = localStorage.getItem('ai_monitor_preferences')
  const preferencesData = savedPreferences ? JSON.parse(savedPreferences) : { state: { preferences: {} } }
  const prefs = preferencesData?.state?.preferences || {}
  const animationSpeed = prefs.animationSpeed || 300
  const fontSize = prefs.fontSize || 14
  const rawAccent = prefs.accentColor
  const validAccents = ['gradient', 'deep-cosmic', 'indigo-command', 'frosted-steel', 'blue-granite']
  const accentColor = validAccents.includes(rawAccent) ? rawAccent : 'gradient'
  if (accentColor) {
    document.documentElement.dataset.accent = accentColor
  }

  // Initialize animation speed
  initializeAnimationSpeed(animationSpeed)

  // Apply font size
  document.documentElement.style.fontSize = `${fontSize}px`
}

async function bootstrap() {
  initPwa()
  await initTelemetry()
  void selfRegisterWithRegistryCore()
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
  initRum()
}
bootstrap()
