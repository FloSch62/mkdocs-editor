import { marked } from 'marked'

// Render a markdown fragment (prose segment or a single table cell) to HTML for the preview.
// `breaks: true` honours single-newline and trailing-space line breaks the way Material for
// MkDocs renders cell bodies. This is display-only; the source of truth stays the raw md.
marked.setOptions({ breaks: true, gfm: true })

export function renderMarkdown(md: string): string {
  if (!md.trim()) return ''
  return marked.parse(md, { async: false })
}
