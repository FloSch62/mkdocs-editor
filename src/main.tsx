import { StrictMode, useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { ThemeProvider, createTheme, CssBaseline, alpha } from '@mui/material'
import './index.css'
import './app.css'
import App from './App.tsx'

export type Mode = 'light' | 'dark'

const dark = {
  primary: '#fbbf24',
  secondary: '#2dd4bf',
  bgDefault: '#1b1b1f',
  bgPaper: '#232328',
  sidebar: '#151518',
  divider: 'rgba(255, 255, 255, 0.08)',
  textPrimary: '#e6e6ea',
  textSecondary: '#9d9da7',
  success: '#4ade80',
  warning: '#e7b341',
  error: '#f87171',
  info: '#60a5fa',
  scrollThumb: 'rgba(255, 255, 255, 0.16)',
  scrollThumbHover: 'rgba(255, 255, 255, 0.30)',
  tooltipBg: '#2e2e34',
} as const

const light = {
  primary: '#d97706',
  secondary: '#0d9488',
  bgDefault: '#fafafa',
  bgPaper: '#ffffff',
  sidebar: '#f4f4f5',
  divider: 'rgba(0, 0, 0, 0.08)',
  textPrimary: '#1c1c21',
  textSecondary: '#6e6e78',
  success: '#16a34a',
  warning: '#b07a10',
  error: '#dc2626',
  info: '#2563eb',
  scrollThumb: 'rgba(0, 0, 0, 0.18)',
  scrollThumbHover: 'rgba(0, 0, 0, 0.34)',
  tooltipBg: '#2e2e34',
} as const

const makeTheme = (mode: Mode) => {
  const isDark = mode === 'dark'
  const c = isDark ? dark : light
  return createTheme({
    cssVariables: true,
    palette: {
      mode,
      primary: { main: c.primary },
      secondary: { main: c.secondary },
      error: { main: c.error },
      warning: { main: c.warning },
      success: { main: c.success },
      info: { main: c.info },
      background: { default: c.bgDefault, paper: c.bgPaper },
      text: { primary: c.textPrimary, secondary: c.textSecondary },
      divider: c.divider,
    },
    shape: { borderRadius: 8 },
    typography: {
      fontFamily: '"Inter", -apple-system, "Segoe UI", "Roboto", "Helvetica", "Arial", sans-serif',
      fontSize: 13,
      h5: { fontWeight: 600, letterSpacing: -0.2 },
      h6: { fontWeight: 600, letterSpacing: -0.2 },
      subtitle1: { fontWeight: 600 },
      subtitle2: { fontWeight: 600 },
      button: { fontWeight: 550 },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          '*': { scrollbarWidth: 'thin', scrollbarColor: `${c.scrollThumb} transparent` },
          '*::-webkit-scrollbar': { width: 10, height: 10 },
          '*::-webkit-scrollbar-track': { background: 'transparent' },
          '*::-webkit-scrollbar-thumb': {
            backgroundColor: c.scrollThumb,
            borderRadius: 8,
            border: '2px solid transparent',
            backgroundClip: 'content-box',
            '&:hover': { backgroundColor: c.scrollThumbHover },
          },
          '*::-webkit-scrollbar-corner': { background: 'transparent' },
          '::selection': { backgroundColor: alpha(c.primary, 0.3) },
        },
      },
      MuiAppBar: {
        defaultProps: { elevation: 0 },
        styleOverrides: { root: { backgroundColor: c.sidebar } },
      },
      MuiPaper: {
        defaultProps: { elevation: 0 },
        styleOverrides: { root: { backgroundImage: 'none' } },
      },
      MuiButton: {
        defaultProps: { size: 'small' },
        styleOverrides: { root: { textTransform: 'none', borderRadius: 7 } },
      },
      MuiTextField: { defaultProps: { size: 'small' } },
      MuiChip: { defaultProps: { size: 'small' }, styleOverrides: { root: { fontWeight: 500 } } },
      MuiTooltip: {
        defaultProps: { arrow: true },
        styleOverrides: {
          tooltip: { backgroundColor: c.tooltipBg, fontSize: 12, padding: '6px 10px', borderRadius: 6 },
          arrow: { color: c.tooltipBg },
        },
      },
      MuiMenu: {
        styleOverrides: {
          paper: {
            borderRadius: 10,
            border: `1px solid ${c.divider}`,
            boxShadow: isDark ? '0 8px 28px rgba(0, 0, 0, 0.5)' : '0 8px 28px rgba(0, 0, 0, 0.12)',
          },
        },
      },
      MuiTab: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            fontWeight: 550,
            minHeight: 40,
            color: c.textSecondary,
            '&.Mui-selected': { color: c.textPrimary },
          },
        },
      },
      MuiTabs: {
        styleOverrides: {
          root: { minHeight: 40 },
          indicator: { height: 2, borderRadius: '2px 2px 0 0', backgroundColor: c.textPrimary },
        },
      },
    },
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
