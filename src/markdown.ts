import { marked } from 'marked'

// Render a markdown fragment (prose segment or a single table cell) to HTML for the preview.
// `breaks: true` honours single-newline and trailing-space line breaks the way Material for
// MkDocs renders cell bodies. This is display-only; the source of truth stays the raw md.
marked.setOptions({ breaks: true, gfm: true })

const FENCE = /^(\s*)(`{3,}|~{3,})\s*(.*)$/
const DIV_OPEN = /^(\s*)<div\b([^>]*)>\s*$/
const DIV_CLOSE = /^\s*<\/div>\s*$/
const BLOCK_OPEN = /^(\s*)(\/{3,})\s+([A-Za-z][\w-]*)\s*(?:\|\s*(.*?))?\s*$/
const BLOCK_CLOSE = /^(\s*)(\/{3,})\s*$/
const ADMONITION_KINDS = new Set([
  'note', 'abstract', 'summary', 'info', 'todo', 'tip', 'hint', 'important',
  'success', 'check', 'question', 'help', 'warning', 'caution', 'attention',
  'failure', 'danger', 'error', 'bug', 'example', 'quote', 'cite',
])

function divRendersMarkdown(attrs: string): boolean {
  return /\bmarkdown\b/.test(attrs) || /\bclass\s*=\s*(?:"[^"]*\bembed-result\b[^"]*"|'[^']*\bembed-result\b[^']*'|[^\s>]*\bembed-result\b[^\s>]*)/.test(attrs)
}

function removeIndent(lines: string[], indent: string): string {
  if (!indent) return lines.join('\n')
  return lines.map((line) => (line.startsWith(indent) ? line.slice(indent.length) : line)).join('\n')
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function admonitionClass(kind: string): string {
  return kind.replace(/[^A-Za-z0-9_-]/g, '-')
}

function renderAdmonition(kind: string, title: string | null, md: string): string {
  let type = kind === 'admonition' ? 'note' : kind
  let body = md
  const lines = md.split('\n')
  let k = 0
  while (k < lines.length && /^\s*(type|attrs|class|id|markdown|summary):\s*/.test(lines[k])) {
    const m = /^\s*type:\s*(.+)$/.exec(lines[k])
    if (m) type = m[1].trim().replace(/^["']|["']$/g, '')
    k++
  }
  body = lines.slice(k).join('\n').replace(/^\n+/, '').replace(/\n+$/, '')
  const label = title || (type === 'note' ? 'Note' : type)
  return `<div class="admonition ${admonitionClass(type)}"><p class="admonition-title">${escapeHtml(label)}</p>${renderMarkdown(body)}</div>`
}

function blockPlaceholders(md: string): { md: string; html: string[] } {
  const lines = md.replace(/\r\n?/g, '\n').split('\n')
  const out: string[] = []
  const html: string[] = []
  let fence: { char: string; len: number } | null = null

  for (let i = 0; i < lines.length;) {
    const line = lines[i]
    const fm = FENCE.exec(line)
    if (fence) {
      if (fm && fm[2][0] === fence.char && fm[2].length >= fence.len && fm[3].trim() === '') fence = null
      out.push(line); i++; continue
    }
    if (fm) { fence = { char: fm[2][0], len: fm[2].length }; out.push(line); i++; continue }

    const open = BLOCK_OPEN.exec(line)
    const kind = open?.[3]?.toLowerCase() ?? ''
    if (!open || !(kind === 'admonition' || ADMONITION_KINDS.has(kind))) { out.push(line); i++; continue }
    const indent = open[1] ?? ''
    const marker = open[2] ?? ''

    let j = i + 1
    let innerFence: { char: string; len: number } | null = null
    while (j < lines.length) {
      const inner = lines[j]
      const ifm = FENCE.exec(inner)
      if (innerFence) {
        if (ifm && ifm[2][0] === innerFence.char && ifm[2].length >= innerFence.len && ifm[3].trim() === '') innerFence = null
        j++; continue
      }
      if (ifm) { innerFence = { char: ifm[2][0], len: ifm[2].length }; j++; continue }
      const close = BLOCK_CLOSE.exec(inner)
      if (close && close[1] === indent && close[2].length === marker.length) break
      j++
    }

    if (j >= lines.length) { out.push(line); i++; continue }

    const id = html.length
    const body = removeIndent(lines.slice(i + 1, j), indent)
    html.push(renderAdmonition(kind, open[4]?.trim() || null, body))
    out.push(`${indent}<div data-md-block="${id}"></div>`)
    i = j + 1
  }

  return { md: out.join('\n'), html }
}

function htmlDivPlaceholders(md: string): { md: string; html: string[] } {
  const lines = md.replace(/\r\n?/g, '\n').split('\n')
  const out: string[] = []
  const html: string[] = []
  let fence: { char: string; len: number } | null = null

  for (let i = 0; i < lines.length;) {
    const line = lines[i]
    const fm = FENCE.exec(line)
    if (fence) {
      if (fm && fm[2][0] === fence.char && fm[2].length >= fence.len && fm[3].trim() === '') fence = null
      out.push(line); i++; continue
    }
    if (fm) { fence = { char: fm[2][0], len: fm[2].length }; out.push(line); i++; continue }

    const open = DIV_OPEN.exec(line)
    if (!open || !divRendersMarkdown(open[2])) { out.push(line); i++; continue }

    let depth = 1
    let j = i + 1
    let innerFence: { char: string; len: number } | null = null
    while (j < lines.length) {
      const inner = lines[j]
      const ifm = FENCE.exec(inner)
      if (innerFence) {
        if (ifm && ifm[2][0] === innerFence.char && ifm[2].length >= innerFence.len && ifm[3].trim() === '') innerFence = null
        j++; continue
      }
      if (ifm) { innerFence = { char: ifm[2][0], len: ifm[2].length }; j++; continue }
      if (DIV_OPEN.test(inner)) depth++
      else if (DIV_CLOSE.test(inner) && --depth === 0) break
      j++
    }

    if (j >= lines.length) { out.push(line); i++; continue }

    const id = html.length
    const innerMd = removeIndent(lines.slice(i + 1, j), open[1])
    html.push(`<div${open[2]}>${renderMarkdown(innerMd)}</div>`)
    out.push(`${open[1]}<div data-md-html="${id}"></div>`)
    i = j + 1
  }

  return { md: out.join('\n'), html }
}

export function renderMarkdown(md: string): string {
  if (!md.trim()) return ''
  const blocks = blockPlaceholders(md)
  const placeholders = htmlDivPlaceholders(blocks.md)
  let rendered = marked.parse(placeholders.md, { async: false })
  placeholders.html.forEach((html, i) => {
    rendered = rendered.replace(new RegExp(`<div data-md-html="${i}"></div>`, 'g'), html)
  })
  blocks.html.forEach((html, i) => {
    rendered = rendered.replace(new RegExp(`<div data-md-block="${i}"></div>`, 'g'), html)
  })
  return rendered
}
