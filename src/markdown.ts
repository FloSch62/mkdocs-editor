import { marked } from 'marked'
import { resolveIcon } from './preview/icons.ts'

// Render a markdown fragment (prose segment or a single table cell) to HTML for the preview.
// `breaks: true` honours single-newline and trailing-space line breaks the way Material for
// MkDocs renders cell bodies. This is display-only; the source of truth stays the raw md.
marked.setOptions({ breaks: true, gfm: true })

// MkDocs-Material icon shortcodes — `:material-rocket-launch-outline:{ .lg .middle }`,
// `:octicons-cpu-16:`, `:simple-nokia:`, `:fontawesome-brands-docker:`. We emit an empty
// placeholder span carrying the icon name + any attr_list classes; the SVG is fetched and
// inlined after render (see preview/icons.ts). Only these four known prefixes match, so
// ordinary text with colons (URLs, ratios, `key: value`) is never touched.
const ICON_RE = /^:((?:material|fontawesome|octicons|simple)-[a-z0-9-]+):(?:\{\s*([^}]*?)\s*\})?/
const CRITIC_MARK_RE = /^\{==([\s\S]+?)==\}/
const FOOTNOTE_REF_RE = /^\[\^([^\]]+)\]/
const MACRO_RE = /^-\{\{\s*([A-Za-z_][\w]*)\((.*?)\)\s*\}\}-\s*(?:\n|$)/

marked.use({
  extensions: [
    {
      name: 'mkdocsIcon',
      level: 'inline',
      start(src: string) {
        const i = src.indexOf(':')
        return i === -1 ? undefined : i
      },
      tokenizer(src: string) {
        const m = ICON_RE.exec(src)
        if (!m) return undefined
        return { type: 'mkdocsIcon', raw: m[0], icon: m[1], attrs: m[2] ?? '' }
      },
      renderer(token) {
        const classes = (String(token.attrs).match(/\.[\w-]+/g) ?? []).map((c) => c.slice(1))
        const cls = ['twemoji', ...classes].join(' ')
        // Inline the SVG when cached; otherwise an empty span that fills on a later
        // re-render once the on-demand fetch (kicked off here) resolves.
        const svg = resolveIcon(String(token.icon)) ?? ''
        return `<span class="${cls}">${svg}</span>`
      },
    },
    {
      name: 'criticMark',
      level: 'inline',
      start(src: string) {
        const i = src.indexOf('{==')
        return i === -1 ? undefined : i
      },
      tokenizer(src: string) {
        const m = CRITIC_MARK_RE.exec(src)
        if (!m) return undefined
        return { type: 'criticMark', raw: m[0], text: m[1], tokens: this.lexer.inlineTokens(m[1]) }
      },
      renderer(token) {
        return `<mark class="critic">${this.parser.parseInline(token.tokens ?? [])}</mark>`
      },
    },
    {
      name: 'footnoteRef',
      level: 'inline',
      start(src: string) {
        const i = src.indexOf('[^')
        return i === -1 ? undefined : i
      },
      tokenizer(src: string) {
        const m = FOOTNOTE_REF_RE.exec(src)
        if (!m) return undefined
        const id = slugId(m[1])
        return { type: 'footnoteRef', raw: m[0], label: m[1], id }
      },
      renderer(token) {
        const label = escapeHtml(String(token.label))
        const id = escapeHtml(String(token.id))
        return `<sup id="fnref:${id}"><a class="footnote-ref" href="#fn:${id}">${label}</a></sup>`
      },
    },
    {
      name: 'mkdocsMacro',
      level: 'block',
      start(src: string) {
        const i = src.indexOf('-{{')
        return i === -1 ? undefined : i
      },
      tokenizer(src: string) {
        const m = MACRO_RE.exec(src)
        if (!m) return undefined
        return { type: 'mkdocsMacro', raw: m[0], name: m[1], args: m[2] }
      },
      renderer(token) {
        return renderMacro(String(token.name), String(token.args))
      },
    },
  ],
})

const FENCE = /^(\s*)(`{3,}|~{3,})\s*(.*)$/
const DIV_OPEN = /^(\s*)<div\b([^>]*)>\s*$/
const DIV_CLOSE = /^\s*<\/div>\s*$/
const BLOCK_OPEN = /^(\s*)(\/{3,})\s+([A-Za-z][\w-]*)\s*(?:\|\s*(.*?))?\s*$/
const BLOCK_CLOSE = /^(\s*)(\/{3,})\s*$/
const REF_DEF = /^[ \t]{0,3}\[(?!\^)([^\]]+)\]:[ \t]*(\S.*)$/
const FOOTNOTE_DEF = /^[ \t]{0,3}\[\^([^\]]+)\]:[ \t]*(.*)$/
const ADMONITION_KINDS = new Set([
  'note', 'abstract', 'summary', 'info', 'todo', 'tip', 'hint', 'important',
  'success', 'check', 'question', 'help', 'warning', 'caution', 'attention',
  'failure', 'danger', 'error', 'bug', 'example', 'quote', 'cite',
])
const RICH_BLOCK_KINDS = new Set(['html', 'tab', 'details', 'admonition', ...ADMONITION_KINDS])

let generatedId = 0

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

function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/'/g, '&#39;')
}

function slugId(s: string): string {
  return s.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'note'
}

function admonitionClass(kind: string): string {
  return kind.replace(/[^A-Za-z0-9_-]/g, '-')
}

interface RenderOptions {
  referenceDefinitions?: string
  renderFootnotes?: boolean
}

function splitConfig(md: string): { config: Record<string, string>; body: string } {
  const config: Record<string, string> = {}
  const lines = md.split('\n')
  let k = 0
  while (k < lines.length && /^\s*(type|open|attrs|class|id|markdown|summary):\s*/.test(lines[k])) {
    const m = /^\s*([\w-]+):\s*(.+?)\s*$/.exec(lines[k])
    if (m) config[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
    k++
  }
  const body = lines.slice(k).join('\n').replace(/^\n+/, '').replace(/\n+$/, '')
  return { config, body }
}

function renderAdmonition(kind: string, title: string | null, md: string, opts: RenderOptions): string {
  let type = kind === 'admonition' ? 'note' : kind
  const parsed = splitConfig(md)
  if (parsed.config.type) type = parsed.config.type
  const label = title || (type === 'note' ? 'Note' : type)
  return `<div class="admonition ${admonitionClass(type)}"><p class="admonition-title">${escapeHtml(label)}</p>${renderMarkdown(parsed.body, opts)}</div>`
}

function renderDetails(title: string | null, md: string, opts: RenderOptions): string {
  const parsed = splitConfig(md)
  const type = parsed.config.type || 'note'
  const open = /^(true|yes|1)$/i.test(parsed.config.open ?? '')
  const label = title || parsed.config.summary || 'Details'
  return `<details class="admonition ${admonitionClass(type)}"${open ? ' open' : ''}><summary class="admonition-title">${escapeHtml(label)}</summary><div class="admonition-body">${renderMarkdown(parsed.body, opts)}</div></details>`
}

function htmlSpec(spec: string): { tag: string; attrs: string } | null {
  const trimmed = spec.trim()
  const m = /^([A-Za-z][\w-]*)((?:[.#][A-Za-z0-9_-]+)*)(.*)$/.exec(trimmed)
  if (!m) return null
  const tag = m[1].toLowerCase()
  if (!/^(div|section|article|aside|figure|figcaption|table|thead|tbody|tr|td|th)$/.test(tag)) return null
  const classes = [...m[2].matchAll(/\.([A-Za-z0-9_-]+)/g)].map((c) => c[1])
  const id = /#([A-Za-z0-9_-]+)/.exec(m[2])?.[1]
  let attrs = ''
  if (id) attrs += ` id="${escapeAttr(id)}"`
  if (classes.length) attrs += ` class="${classes.map(escapeAttr).join(' ')}"`
  attrs += (m[3] ?? '').replace(/\s*\bmarkdown\b/g, '')
  return { tag, attrs }
}

function renderHtmlBlock(spec: string, md: string, opts: RenderOptions): string {
  const parsed = htmlSpec(spec)
  if (!parsed) return renderMarkdown(md, opts)
  return `<${parsed.tag}${parsed.attrs}>${renderMarkdown(md, opts)}</${parsed.tag}>`
}

function renderTabs(tabs: Array<{ title: string; body: string }>, opts: RenderOptions): string {
  const name = `zx-tabs-${++generatedId}`
  const items = tabs.map((tab, i) => {
    const id = `${name}-${i}`
    return [
      `<input type="radio" name="${name}" id="${id}"${i === 0 ? ' checked' : ''}>`,
      `<label for="${id}">${escapeHtml(tab.title || 'Tab')}</label>`,
      `<div class="zx-tabbed-content">${renderMarkdown(tab.body, opts)}</div>`,
    ].join('')
  }).join('')
  return `<div class="zx-tabbed-set">${items}</div>`
}

function parseMacroArgs(src: string): Record<string, string> {
  const args: Record<string, string> = {}
  const re = /(\w+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^,\s]+))/g
  let m: RegExpExecArray | null
  while ((m = re.exec(src))) args[m[1]] = m[2] ?? m[3] ?? m[4] ?? ''
  return args
}

function renderMacro(name: string, src: string): string {
  const args = parseMacroArgs(src)
  if (name === 'youtube' && args.url) {
    return `<div class="zx-media zx-media-youtube"><iframe src="${escapeAttr(args.url)}" title="YouTube video" loading="lazy" allowfullscreen></iframe></div>`
  }
  if (name === 'video' && args.url) {
    const title = args.title ? `<figcaption>${escapeHtml(args.title)}</figcaption>` : ''
    return `<figure class="zx-media"><video controls playsinline><source src="${escapeAttr(args.url)}"></video>${title}</figure>`
  }
  // Build-time helpers such as js_script() and diagram() cannot be faithfully expanded in
  // the browser-only editor. Suppress the raw macro syntax so it doesn't leak into prose.
  if (name === 'js_script' || name === 'diagram') return ''
  return ''
}

function parseFootnotes(md: string): { md: string; defs: Array<{ id: string; label: string; body: string }> } {
  const lines = md.replace(/\r\n?/g, '\n').split('\n')
  const out: string[] = []
  const defs: Array<{ id: string; label: string; body: string }> = []
  for (let i = 0; i < lines.length;) {
    const m = FOOTNOTE_DEF.exec(lines[i])
    if (!m) { out.push(lines[i]); i++; continue }
    const body: string[] = [m[2] ?? '']
    i++
    while (i < lines.length) {
      if (FOOTNOTE_DEF.test(lines[i])) break
      if (lines[i].trim() === '') { body.push(''); i++; continue }
      if (/^(?: {4}|\t)/.test(lines[i])) {
        body.push(lines[i].replace(/^(?: {4}|\t)/, ''))
        i++
        continue
      }
      break
    }
    defs.push({ id: slugId(m[1]), label: m[1], body: body.join('\n').trim() })
  }
  return { md: out.join('\n'), defs }
}

function renderFootnoteList(defs: Array<{ id: string; label: string; body: string }>, opts: RenderOptions): string {
  if (!defs.length) return ''
  const items = defs.map((def) => {
    const body = def.body ? renderMarkdown(def.body, { ...opts, renderFootnotes: false }) : ''
    return `<li id="fn:${escapeAttr(def.id)}">${body}<a class="footnote-backref" href="#fnref:${escapeAttr(def.id)}" aria-label="Back to reference">↩</a></li>`
  }).join('')
  return `<div class="footnote"><hr><ol>${items}</ol></div>`
}

function readSlashBlock(lines: string[], i: number): { kind: string; title: string | null; indent: string; marker: string; body: string; next: number } | null {
  const open = BLOCK_OPEN.exec(lines[i])
  if (!open) return null
  const indent = open[1] ?? ''
  const marker = open[2] ?? ''
  const kind = open[3].toLowerCase()
  let j = i + 1
  let innerFence: { char: string; len: number } | null = null
  let nested = 0
  while (j < lines.length) {
    const inner = lines[j]
    const ifm = FENCE.exec(inner)
    if (innerFence) {
      if (ifm && ifm[2][0] === innerFence.char && ifm[2].length >= innerFence.len && ifm[3].trim() === '') innerFence = null
      j++; continue
    }
    if (ifm) { innerFence = { char: ifm[2][0], len: ifm[2].length }; j++; continue }
    const close = BLOCK_CLOSE.exec(inner)
    if (nested > 0) {
      const nestedOpen = BLOCK_OPEN.exec(inner)
      if (nestedOpen && nestedOpen[1] === indent && nestedOpen[2].length >= marker.length) nested++
      else if (close && close[1] === indent && close[2].length === marker.length) nested--
      j++
      continue
    }
    if (close && close[1] === indent && close[2].length === marker.length) break
    const nestedOpen = BLOCK_OPEN.exec(inner)
    if (nestedOpen && nestedOpen[1] === indent && nestedOpen[2].length >= marker.length) {
      nested++
      j++
      continue
    }
    j++
  }
  if (j >= lines.length) return null
  return {
    kind,
    title: open[4]?.trim() || null,
    indent,
    marker,
    body: removeIndent(lines.slice(i + 1, j), indent),
    next: j + 1,
  }
}

function blockPlaceholders(md: string, opts: RenderOptions): { md: string; html: string[] } {
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
    if (!open || !RICH_BLOCK_KINDS.has(kind)) { out.push(line); i++; continue }
    const block = readSlashBlock(lines, i)
    if (!block) { out.push(line); i++; continue }
    const id = html.length
    if (kind === 'tab') {
      const tabs: Array<{ title: string; body: string }> = [{ title: block.title || 'Tab', body: block.body }]
      let next = block.next
      while (next < lines.length) {
        const blanks: string[] = []
        while (lines[next]?.trim() === '') { blanks.push(lines[next]); next++ }
        const maybe = readSlashBlock(lines, next)
        if (!maybe || maybe.kind !== 'tab' || maybe.indent !== block.indent || maybe.marker.length !== block.marker.length) {
          next -= blanks.length
          break
        }
        tabs.push({ title: maybe.title || 'Tab', body: maybe.body })
        next = maybe.next
      }
      html.push(renderTabs(tabs, opts))
      out.push(`${block.indent}<div data-md-block="${id}"></div>`)
      i = next
      continue
    }
    if (kind === 'details') html.push(renderDetails(block.title, block.body, opts))
    else if (kind === 'html') html.push(renderHtmlBlock(block.title ?? 'div', block.body, opts))
    else html.push(renderAdmonition(kind, block.title, block.body, opts))
    out.push(`${block.indent}<div data-md-block="${id}"></div>`)
    i = block.next
  }

  return { md: out.join('\n'), html }
}

function htmlDivPlaceholders(md: string, opts: RenderOptions): { md: string; html: string[] } {
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
    html.push(`<div${open[2]}>${renderMarkdown(innerMd, opts)}</div>`)
    out.push(`${open[1]}<div data-md-html="${id}"></div>`)
    i = j + 1
  }

  return { md: out.join('\n'), html }
}

export function extractReferenceDefinitions(md: string): string {
  return md.replace(/\r\n?/g, '\n').split('\n').filter((line) => REF_DEF.test(line)).join('\n')
}

export function renderMarkdown(md: string, opts: RenderOptions = {}): string {
  if (!md.trim()) return ''
  const footnotes = opts.renderFootnotes === false ? { md, defs: [] } : parseFootnotes(md)
  const blocks = blockPlaceholders(footnotes.md, opts)
  const placeholders = htmlDivPlaceholders(blocks.md, opts)
  const refs = opts.referenceDefinitions?.trim()
  const source = refs ? `${placeholders.md}\n\n${refs}` : placeholders.md
  let rendered = marked.parse(source, { async: false })
  placeholders.html.forEach((html, i) => {
    rendered = rendered.replace(new RegExp(`<div data-md-html="${i}"></div>`, 'g'), html)
  })
  blocks.html.forEach((html, i) => {
    rendered = rendered.replace(new RegExp(`<div data-md-block="${i}"></div>`, 'g'), html)
  })
  return rendered + renderFootnoteList(footnotes.defs, opts)
}
