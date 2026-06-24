import { StrictMode, useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { ThemeProvider, createTheme, CssBaseline, alpha } from '@mui/material'
import './index.css'
import './app.css'
import App from './App.tsx'

export type Mode = 'light' | 'dark'

// zensical slate (dark) — hue 225, brand orange #ff7735
const dark = {
  primary: '#ff7735',
  secondary: '#ff9457',
  bgDefault: 'hsl(225, 15%, 5%)',
  bgPaper: 'hsl(225, 16%, 9%)',
  sidebar: 'hsl(225, 15%, 5%)',
  divider: 'hsla(225, 15%, 90%, 0.12)',
  textPrimary: 'hsla(225, 15%, 90%, 0.9)',
  textSecondary: 'hsla(225, 15%, 90%, 0.56)',
  success: '#00c853',
  warning: '#ff9100',
  error: '#ff5252',
  info: '#00b8d4',
  scrollThumb: 'hsla(225, 15%, 90%, 0.16)',
  scrollThumbHover: 'hsla(225, 15%, 90%, 0.3)',
  tooltipBg: 'hsl(225, 15%, 16%)',
} as const

// zensical default (light) — Material defaults, brand orange #ff7735
const light = {
  primary: '#ff7735',
  secondary: '#f15a12',
  bgDefault: '#ffffff',
  bgPaper: '#ffffff',
  sidebar: '#fafafa',
  divider: 'rgba(0, 0, 0, 0.09)',
  textPrimary: 'rgba(0, 0, 0, 0.87)',
  textSecondary: 'rgba(0, 0, 0, 0.54)',
  success: '#00b341',
  warning: '#e67700',
  error: '#e53935',
  info: '#0097a7',
  scrollThumb: 'rgba(0, 0, 0, 0.18)',
  scrollThumbHover: 'rgba(0, 0, 0, 0.34)',
  tooltipBg: 'hsl(225, 15%, 16%)',
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
        styleOverrides: { root: { backgroundColor: 'var(--header-bg)', color: 'var(--header-fg)' } },
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
          indicator: { height: 2, borderRadius: '2px 2px 0 0', backgroundColor: c.primary },
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
