// Shared inline-markdown formatting, used by the prose mini-editor and by table cells so
// the same Bold / Italic / Code / Link / Highlight / Keyboard actions (and their keyboard
// shortcuts) work everywhere — including inside tables, which previously had no toolbar.
import { useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react'
import { Box, IconButton, TextField, Tooltip } from '@mui/material'
import type { SxProps, Theme } from '@mui/material'
import FormatBoldIcon from '@mui/icons-material/FormatBold'
import FormatItalicIcon from '@mui/icons-material/FormatItalic'
import CodeIcon from '@mui/icons-material/Code'
import InsertLinkIcon from '@mui/icons-material/InsertLink'
import RawOnIcon from '@mui/icons-material/RawOn'
import KeyboardIcon from '@mui/icons-material/Keyboard'
import type { SvgIconComponent } from '@mui/icons-material'

type Editable = HTMLTextAreaElement | HTMLInputElement

export interface WrapAction {
  before: string
  after: string
  fallback: string
  /** lower-case key for the Ctrl/Cmd shortcut, if any */
  shortcut?: string
  title: string
  Icon: SvgIconComponent
}

// The wrapping formats offered in every markdown field. Each toggles: applying it to text
// that already carries the markers strips them again rather than nesting a second pair.
export const WRAP_ACTIONS: WrapAction[] = [
  { before: '**', after: '**', fallback: 'text', shortcut: 'b', title: 'Bold (Ctrl+B)', Icon: FormatBoldIcon },
  { before: '_', after: '_', fallback: 'text', shortcut: 'i', title: 'Italic (Ctrl+I)', Icon: FormatItalicIcon },
  { before: '`', after: '`', fallback: 'code', shortcut: 'e', title: 'Inline code (Ctrl+E)', Icon: CodeIcon },
  { before: '[', after: '](https://example.com)', fallback: 'label', shortcut: 'k', title: 'Link (Ctrl+K)', Icon: InsertLinkIcon },
  { before: '==', after: '==', fallback: 'text', title: 'Highlight', Icon: RawOnIcon },
  { before: '++', after: '++', fallback: 'ctrl+c', title: 'Keyboard key', Icon: KeyboardIcon },
]

// Toggle a wrapping format around the field's current selection: wrap it when absent, strip
// it when the markers are already there — whether they sit inside the selection (the user
// selected "**bold**") or hug it ("**[bold]**"). Returns the new text and where to put the
// selection afterwards.
export function toggleWrap(el: Editable, value: string, before: string, after = before, fallback = 'text') {
  const start = el.selectionStart ?? value.length
  const end = el.selectionEnd ?? start
  const selected = value.slice(start, end)

  if (selected.length >= before.length + after.length && selected.startsWith(before) && selected.endsWith(after)) {
    const inner = selected.slice(before.length, selected.length - after.length)
    return { value: value.slice(0, start) + inner + value.slice(end), start, end: start + inner.length }
  }

  if (
    start >= before.length &&
    value.slice(start - before.length, start) === before &&
    value.slice(end, end + after.length) === after
  ) {
    return {
      value: value.slice(0, start - before.length) + selected + value.slice(end + after.length),
      start: start - before.length,
      end: end - before.length,
    }
  }

  const text = selected || fallback
  return {
    value: value.slice(0, start) + before + text + after + value.slice(end),
    start: start + before.length,
    end: start + before.length + text.length,
  }
}

// Selection-aware markdown formatting for a single textarea/input. Returns a ref to attach,
// an `apply` that runs a wrap action, and an `onKeyDown` that maps Ctrl/Cmd shortcuts.
export function useMarkdownFormat<T extends Editable = Editable>(value: string, onChange: (v: string) => void) {
  const ref = useRef<T | null>(null)
  const apply = (action: Pick<WrapAction, 'before' | 'after' | 'fallback'>) => {
    const el = ref.current
    if (!el) {
      onChange(`${value}${action.before}${action.fallback}${action.after}`)
      return
    }
    const res = toggleWrap(el, value, action.before, action.after, action.fallback)
    onChange(res.value)
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(res.start, res.end)
    })
  }
  const onKeyDown = (e: KeyboardEvent) => {
    if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey) return
    const action = WRAP_ACTIONS.find((a) => a.shortcut === e.key.toLowerCase())
    if (action) {
      e.preventDefault()
      apply(action)
    }
  }
  return { ref, apply, onKeyDown }
}

// The row of formatting buttons. `onMouseDown` is prevented so clicking a button never blurs
// the field — the selection (and any focus-revealed toolbar) survives the click.
export function MarkdownFormatBar({ apply, children }: { apply: (a: WrapAction) => void; children?: ReactNode }) {
  return (
    <>
      {WRAP_ACTIONS.map((a) => (
        <Tooltip key={a.title} title={a.title}>
          <IconButton size="small" onMouseDown={(e) => e.preventDefault()} onClick={() => apply(a)}>
            <a.Icon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
      ))}
      {children}
    </>
  )
}

// A table-cell text field that reveals a compact formatting toolbar while focused, so the
// same styling controls are available inside tables. Keyboard shortcuts work without it.
export function RichCell({
  value,
  onChange,
  multiline = true,
  fullWidth = true,
  autoFocus,
  placeholder,
  onBlur,
  onKeyDown: extraKeyDown,
  inputStyle,
  sx,
}: {
  value: string
  onChange: (v: string) => void
  multiline?: boolean
  fullWidth?: boolean
  autoFocus?: boolean
  placeholder?: string
  onBlur?: () => void
  onKeyDown?: (e: KeyboardEvent) => void
  inputStyle?: CSSProperties
  sx?: SxProps<Theme>
}) {
  const { ref, apply, onKeyDown } = useMarkdownFormat(value, onChange)
  const [focused, setFocused] = useState(false)
  return (
    <Box className="rich-cell">
      <TextField
        inputRef={ref}
        fullWidth={fullWidth}
        multiline={multiline}
        size="small"
        autoFocus={autoFocus}
        value={value}
        placeholder={placeholder}
        sx={sx}
        slotProps={{ htmlInput: { style: inputStyle } }}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          onKeyDown(e)
          if (!e.defaultPrevented) extraKeyDown?.(e)
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false)
          onBlur?.()
        }}
      />
      {focused && (
        <Box className="rich-cell-bar">
          <MarkdownFormatBar apply={apply} />
        </Box>
      )}
    </Box>
  )
}
