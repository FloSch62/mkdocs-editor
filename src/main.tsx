import { StrictMode, useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material'
import './nokia-fonts.css'
import './index.css'
import './app.css'
import App from './App.tsx'

export type Mode = 'light' | 'dark'

// Theme lifted from eda-labs/cable-map for visual consistency across the EDA app family.
const makeTheme = (mode: Mode) => {
  const dark = mode === 'dark'
  return createTheme({
    cssVariables: true,
    palette: {
      mode,
      primary: { main: '#6098FF' },
      error: { main: '#FF6363' },
      warning: { main: '#FFAC0A' },
      success: { main: '#00A87E' },
      info: { main: '#90B7FF' },
      background: dark ? { default: '#1A222E', paper: '#101824' } : { default: '#EEF1F5', paper: '#FFFFFF' },
      text: dark ? { primary: '#ffffff', secondary: '#C9CED6' } : { primary: '#0B1119', secondary: '#5A6472' },
      divider: dark ? '#4A5361B2' : '#D5DAE1',
    },
    shape: { borderRadius: 4 },
    typography: { fontFamily: '"NokiaPureText", "Roboto", "Helvetica", "Arial", sans-serif' },
  })
}

const THEME_KEY = 'mkdocs-editor-theme'
const initialMode = (): Mode => {
  const saved = localStorage.getItem(THEME_KEY)
  if (saved === 'light' || saved === 'dark') return saved
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

function Root() {
  const [mode, setMode] = useState<Mode>(initialMode)
  const theme = useMemo(() => makeTheme(mode), [mode])
  useEffect(() => {
    document.documentElement.dataset.theme = mode
    localStorage.setItem(THEME_KEY, mode)
  }, [mode])
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <App mode={mode} onToggleMode={() => setMode((m) => (m === 'dark' ? 'light' : 'dark'))} />
    </ThemeProvider>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
