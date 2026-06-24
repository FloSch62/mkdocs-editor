import { parse as parseYaml, stringify as stringifyYaml } from 'yaml'

// blocks.ts — the deterministic core.
//
// The editor has two jobs:
// 1. keep the existing nested `pymdownx.blocks.html` table model precise, because slash
//    depth is structural there; and
// 2. lift the common MkDocs Material / Zensical authoring blocks into editable data.
//
// Unknown or custom syntax stays raw. The parser should never silently reinterpret content
// it does not understand.

export interface Cell {
  kind: 'th' | 'td'
  /** Verbatim attribute suffix, e.g. "[style='text-align: center;']" or "" */
  attrs: string
  /** Ordered cell content: markdown text runs and/or nested tables. */
  blocks: CellBlock[]
}
export type CellBlock = { type: 'text'; md: string } | { type: 'table'; table: Table }
export interface Row {
  attrs: string
  cells: Cell[]
}
export interface Table {
  attrs: string
  /** `th` cells declared directly under the table — the header row. */
  header: Cell[]
  rows: Row[]
}

export type SyntaxStyle = 'zensical' | 'classic'
export type Align = 'left' | 'center' | 'right'
export type AdmonitionCollapse = 'none' | 'closed' | 'open'

export interface MarkdownTable {
  headers: string[]
  aligns: Align[]
  rows: string[][]
}

export interface TabItem {
  title: string
  body: string
}

export interface GridCard {
  title: string
  body: string
  href: string
}

export type FrontMatterData = Record<string, unknown>

export type DocBlock =
  | { type: 'markdown'; text: string }
  | { type: 'frontmatter'; data: FrontMatterData }
  | { type: 'htmlTable'; table: Table }
  | { type: 'markdownTable'; table: MarkdownTable }
  | { type: 'admonition'; kind: string; title: string; body: string; collapse: AdmonitionCollapse; syntax: SyntaxStyle }
  | { type: 'details'; title: string; body: string; open: boolean; syntax: SyntaxStyle }
  | { type: 'tabset'; tabs: TabItem[]; syntax: SyntaxStyle }
  | { type: 'snippet'; path: string }
  | { type: 'code'; lang: string; title: string; body: string; attrs: string; copy: boolean; select: boolean; lineNumbers: boolean; highlight: string }
  | { type: 'image'; alt: string; src: string; title: string; caption: string }
  | { type: 'button'; text: string; href: string; primary: boolean }
  | { type: 'grid'; cards: GridCard[] }
  | { type: 'raw'; label: string; text: string }

export type Segment = DocBlock

export const ADMONITION_KINDS = [
  'note',
  'abstract',
  'summary',
  'info',
  'todo',
  'tip',
  'hint',
  'important',
  'success',
  'check',
  'question',
  'help',
  'warning',
  'caution',
  'attention',
  'failure',
  'danger',
  'error',
  'bug',
  'example',
  'quote',
  'cite',
]

const ADMONITIONS = new Set(ADMONITION_KINDS)

// A fence opener: `/// html | tag[attrs]`. Tag is a bare word; everything after it (until
// EOL, trimmed) is the verbatim attribute suffix.
const HTML_OPEN = /^(\s*)(\/{3,})\s+html\s*\|\s*([A-Za-z][\w-]*)\s*(.*?)\s*$/
// A generic Zensical/PyMdown Blocks opener: `/// note | Title`.
const BLOCK_OPEN = /^(\s*)(\/{3,})\s+([A-Za-z][\w-]*)\s*(?:\|\s*(.*?))?\s*$/
// A fence closer: a line that is only slashes.
const CLOSE = /^(\s*)(\/{3,})\s*$/
// A fenced code block delimiter (``` or ~~~) — block syntax inside code is literal.
const FENCE = /^(\s*)(`{3,}|~{3,})\s*(.*)$/
const SNIPPET = /^\s*--8<--\s+"(.+?)"\s*$/
const CLASSIC_ADMONITION = /^(\s*)(!!!|\?\?\?\+?)\s+([A-Za-z][\w-]*)(?:\s+"([^"]*)")?\s*$/
const CLASSIC_TAB = /^(\s*)===\s+"(.+?)"\s*$/
const IMAGE = /^\s*!\[([^\]]*)\]\((\S+?)(?:\s+"([^"]*)")?\)\s*$/
const BUTTON = /^\s*\[([^\]]+)\]\(([^)]+)\)\{([^}]*\bmd-button\b[^}]*)\}\s*$/

interface GNode {
  tag: string
  attrs: string
  marker: number
  children: GChild[]
}
type GChild = GNode | { text: string }

const trimOuterBlankLines = (s: string): string => {
  const lines = s.replace(/\r\n?/g, '\n').split('\n')
  while (lines.length && lines[0].trim() === '') lines.shift()
  while (lines.length && lines[lines.length - 1].trim() === '') lines.pop()
  return lines.join('\n')
}

const escapePipe = (s: string): string => s.replace(/\\/g, '\\\\').replace(/\|/g, '\\|')

function parseBlock(lines: string[], i: number): [GNode, number] {
  const m = HTML_OPEN.exec(lines[i])!
  const marker = m[2].length
  const node: GNode = { tag: m[3], attrs: m[4] ?? '', marker, children: [] }
  let j = i + 1
  while (j < lines.length) {
    const line = lines[j]
    const close = CLOSE.exec(line)
    if (close && close[1] === m[1] && close[2].length === marker) return [node, j + 1]
    const open = HTML_OPEN.exec(line)
    if (open && open[1] === m[1] && open[2].length > marker) {
      const [child, next] = parseBlock(lines, j)
      node.children.push(child)
      j = next
      continue
    }
    node.children.push({ text: line })
    j++
  }
  return [node, j]
}

function nodeToCell(node: GNode, kind: 'th' | 'td'): Cell {
  const blocks: CellBlock[] = []
  let buf: string[] = []
  const flush = () => {
    const md = buf.join('\n').replace(/^\n+/, '').replace(/\n+$/, '')
    if (md.trim() !== '') blocks.push({ type: 'text', md })
    buf = []
  }
  for (const ch of node.children) {
    if ('text' in ch) buf.push(ch.text)
    else if (ch.tag === 'table') {
      flush()
      blocks.push({ type: 'table', table: nodeToTable(ch) })
    }
  }
  flush()
  return { kind, attrs: node.attrs, blocks }
}

function nodeToRow(node: GNode): Row {
  const cells: Cell[] = []
  for (const ch of node.children) {
    if ('text' in ch) continue
    if (ch.tag === 'td' || ch.tag === 'th') cells.push(nodeToCell(ch, ch.tag as 'td' | 'th'))
  }
  return { attrs: node.attrs, cells }
}

function nodeToTable(node: GNode): Table {
  const header: Cell[] = []
  const rows: Row[] = []
  for (const ch of node.children) {
    if ('text' in ch) continue
    if (ch.tag === 'th') header.push(nodeToCell(ch, 'th'))
    else if (ch.tag === 'tr') rows.push(nodeToRow(ch))
    else if (ch.tag === 'td') rows.push({ attrs: '', cells: [nodeToCell(ch, 'td')] })
  }
  return { attrs: node.attrs, header, rows }
}

function readSlashBlock(lines: string[], i: number): { raw: string; kind: string; title: string; body: string; next: number } {
  const open = BLOCK_OPEN.exec(lines[i])!
  const blockIndent = open[1]
  const marker = open[2].length
  const kind = open[3].toLowerCase()
  const title = open[4]?.trim() ?? ''
  let fence: { char: string; len: number } | null = null
  let j = i + 1
  while (j < lines.length) {
    const fm = FENCE.exec(lines[j])
    if (fence) {
      if (fm && fm[2][0] === fence.char && fm[2].length >= fence.len && fm[3].trim() === '') fence = null
      j++
      continue
    }
    if (fm) {
      fence = { char: fm[2][0], len: fm[2].length }
      j++
      continue
    }
    const close = CLOSE.exec(lines[j])
    if (close && close[1] === blockIndent && close[2].length === marker) break
    j++
  }
  const end = j < lines.length ? j + 1 : j
  const bodyLines = lines.slice(i + 1, j).map((line) => blockIndent && line.startsWith(blockIndent) ? line.slice(blockIndent.length) : line)
  return { raw: lines.slice(i, end).join('\n'), kind, title, body: trimOuterBlankLines(bodyLines.join('\n')), next: end }
}

function readIndentedBody(lines: string[], i: number, baseIndent: string): [string, number] {
  const bodyIndent = `${baseIndent}    `
  const body: string[] = []
  let j = i
  while (j < lines.length) {
    const line = lines[j]
    if (line.trim() === '') {
      body.push('')
      j++
      continue
    }
    if (line.startsWith(bodyIndent)) {
      body.push(line.slice(bodyIndent.length))
      j++
      continue
    }
    break
  }
  return [trimOuterBlankLines(body.join('\n')), j]
}

function parseFrontMatter(lines: string[]): [DocBlock | null, number] {
  if (lines[0]?.trim() !== '---') return [null, 0]
  let end = -1
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') {
      end = i
      break
    }
  }
  if (end < 0) return [null, 0]
  const text = lines.slice(1, end).join('\n')
  try {
    const parsed = parseYaml(text)
    const data = parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as FrontMatterData
      : { value: parsed }
    return [{ type: 'frontmatter', data }, end + 1]
  } catch {
    return [{ type: 'raw', label: 'front matter', text: lines.slice(0, end + 1).join('\n') }, end + 1]
  }
}

function splitPipeCells(line: string): string[] {
  const s = line.trim().replace(/^\|/, '').replace(/\|$/, '')
  const cells: string[] = []
  let cur = ''
  let escaped = false
  for (const ch of s) {
    if (escaped) {
      cur += ch
      escaped = false
    } else if (ch === '\\') {
      escaped = true
    } else if (ch === '|') {
      cells.push(cur.trim())
      cur = ''
    } else {
      cur += ch
    }
  }
  cells.push(cur.trim())
  return cells
}

function parseAlign(cell: string): Align | null {
  const v = cell.trim()
  if (!/^:?-{3,}:?$/.test(v)) return null
  if (v.startsWith(':') && v.endsWith(':')) return 'center'
  if (v.endsWith(':')) return 'right'
  return 'left'
}

function parseMarkdownTableAt(lines: string[], i: number): [MarkdownTable, number] | null {
  if (!lines[i]?.includes('|') || !lines[i + 1]?.includes('|')) return null
  const headers = splitPipeCells(lines[i])
  const aligns = splitPipeCells(lines[i + 1]).map(parseAlign)
  if (!headers.length || aligns.some((a) => !a)) return null
  const rows: string[][] = []
  let j = i + 2
  while (j < lines.length && lines[j].trim() !== '' && lines[j].includes('|')) {
    const cells = splitPipeCells(lines[j])
    rows.push(Array.from({ length: headers.length }, (_, idx) => cells[idx] ?? ''))
    j++
  }
  return [{ headers, aligns: aligns as Align[], rows }, j]
}

function parseCodeInfo(info: string): Pick<Extract<DocBlock, { type: 'code' }>, 'lang' | 'title' | 'attrs' | 'copy' | 'select' | 'lineNumbers' | 'highlight'> {
  const out = { lang: '', title: '', attrs: '', copy: false, select: false, lineNumbers: false, highlight: '' }
  const trimmed = info.trim()
  if (!trimmed) return out
  const attrBody = trimmed.startsWith('{') && trimmed.endsWith('}') ? trimmed.slice(1, -1).trim() : trimmed
  const title = /\btitle=(?:"([^"]*)"|'([^']*)'|([^\s}]+))/.exec(attrBody)
  const highlight = /\bhl_lines=(?:"([^"]*)"|'([^']*)'|([^\s}]+))/.exec(attrBody)
  out.title = title?.[1] ?? title?.[2] ?? title?.[3] ?? ''
  out.highlight = highlight?.[1] ?? highlight?.[2] ?? highlight?.[3] ?? ''
  out.copy = /(?:^|\s)\.copy(?:\s|$)/.test(attrBody)
  out.select = /(?:^|\s)\.select(?:\s|$)/.test(attrBody)
  out.lineNumbers = /(?:^|\s)(?:\.linenums|linenums=(?:"?1"?|true))(?:\s|$)/.test(attrBody)
  const classLang = /(?:^|\s)\.([A-Za-z0-9_-]+)(?:\s|$)/.exec(attrBody)
  const plainLang = /^[A-Za-z0-9_-]+/.exec(attrBody)
  out.lang = classLang?.[1] ?? plainLang?.[0] ?? ''
  out.attrs = attrBody
    .replace(/(?:^|\s)\.[A-Za-z0-9_-]+/g, '')
    .replace(/\btitle=(?:"[^"]*"|'[^']*'|[^\s}]+)/g, '')
    .replace(/\bhl_lines=(?:"[^"]*"|'[^']*'|[^\s}]+)/g, '')
    .replace(/\blinenums=(?:"?1"?|true)/g, '')
    .trim()
  return out
}

function parseCodeBlockAt(lines: string[], i: number): [DocBlock, number] | null {
  const open = FENCE.exec(lines[i])
  if (!open) return null
  const char = open[2][0]
  const len = open[2].length
  let j = i + 1
  while (j < lines.length) {
    const close = FENCE.exec(lines[j])
    if (close && close[2][0] === char && close[2].length >= len && close[3].trim() === '') break
    j++
  }
  const end = j < lines.length ? j + 1 : j
  return [{ type: 'code', ...parseCodeInfo(open[3]), body: lines.slice(i + 1, j).join('\n') }, end]
}

function parseGrid(body: string): GridCard[] {
  const cards: GridCard[] = []
  const chunks = body.split(/\n(?=-\s+)/)
  for (const chunk of chunks) {
    const lines = chunk.split('\n')
    const first = lines.shift()?.trim() ?? ''
    const link = /^-\s+\[([^\]]+)\]\(([^)]+)\)\s*$/.exec(first)
    const strong = /^-\s+\*\*([^*]+)\*\*\s*$/.exec(first)
    if (!link && !strong) continue
    cards.push({
      title: link?.[1] ?? strong?.[1] ?? 'Card',
      href: link?.[2] ?? '',
      body: trimOuterBlankLines(lines.map((line) => line.replace(/^ {2,4}/, '')).join('\n')),
    })
  }
  return cards.length ? cards : [{ title: 'Card', href: '', body: body.trim() }]
}

function zensicalBlock(kind: string, title: string, body: string): string {
  const head = title.trim() ? `/// ${kind} | ${title.trim()}` : `/// ${kind}`
  return [head, body.trim(), '///'].join('\n')
}

function indentBody(body: string): string {
  return body.split('\n').map((line) => line ? `    ${line}` : '').join('\n')
}

/** Parse a full markdown document into editable MkDocs/Zensical blocks. */
export function parseDocument(src: string): DocBlock[] {
  const lines = src.replace(/\r\n?/g, '\n').split('\n')
  const blocks: DocBlock[] = []
  let i = 0
  const [frontmatter, afterFrontmatter] = parseFrontMatter(lines)
  if (frontmatter) {
    blocks.push(frontmatter)
    i = afterFrontmatter
    if (lines[i]?.trim() === '') i++
  }

  let buf: string[] = []
  const flush = () => {
    const text = trimOuterBlankLines(buf.join('\n'))
    if (text.trim()) blocks.push({ type: 'markdown', text })
    buf = []
  }

  while (i < lines.length) {
    const line = lines[i]
    if (line.trim() === '') {
      buf.push(line)
      i++
      continue
    }

    const code = parseCodeBlockAt(lines, i)
    if (code) {
      flush()
      blocks.push(code[0])
      i = code[1]
      continue
    }

    const snippet = SNIPPET.exec(line)
    if (snippet) {
      flush()
      blocks.push({ type: 'snippet', path: snippet[1] })
      i++
      continue
    }

    const html = HTML_OPEN.exec(line)
    if (html && html[3] === 'table') {
      flush()
      const [node, next] = parseBlock(lines, i)
      blocks.push({ type: 'htmlTable', table: nodeToTable(node) })
      i = next
      continue
    }

    const open = BLOCK_OPEN.exec(line)
    if (open) {
      const kind = open[3].toLowerCase()
      if (kind === 'tab') {
        flush()
        const tabs: TabItem[] = []
        let next = i
        while (next < lines.length) {
          const tabOpen = BLOCK_OPEN.exec(lines[next])
          if (!tabOpen || tabOpen[3].toLowerCase() !== 'tab') break
          const tab = readSlashBlock(lines, next)
          tabs.push({ title: tab.title || 'Tab', body: tab.body })
          next = tab.next
          while (lines[next]?.trim() === '') next++
        }
        blocks.push({ type: 'tabset', tabs, syntax: 'zensical' })
        i = next
        continue
      }
      if (kind === 'details') {
        flush()
        const block = readSlashBlock(lines, i)
        const bodyLines = block.body.split('\n')
        let openByDefault = false
        let k = 0
        while (k < bodyLines.length && /^\s*(open|attrs|class|id|markdown|summary):\s*/.test(bodyLines[k])) {
          const openOption = /^\s*open:\s*(.+)$/.exec(bodyLines[k])
          if (openOption) openByDefault = /^(true|yes|1)$/i.test(openOption[1].trim())
          k++
        }
        blocks.push({ type: 'details', title: block.title || 'Details', body: trimOuterBlankLines(bodyLines.slice(k).join('\n')), open: openByDefault, syntax: 'zensical' })
        i = block.next
        continue
      }
      if (kind === 'html' && /^div(?:\.grid)?(?:\.cards)?/.test(open[4] ?? '')) {
        flush()
        const block = readSlashBlock(lines, i)
        blocks.push({ type: 'grid', cards: parseGrid(block.body) })
        i = block.next
        continue
      }
      if (kind === 'admonition' || ADMONITIONS.has(kind)) {
        flush()
        const block = readSlashBlock(lines, i)
        let actualKind = kind === 'admonition' ? 'note' : kind
        let body = block.body
        const bodyLines = body.split('\n')
        let k = 0
        while (k < bodyLines.length && /^\s*(type|attrs|class|id|markdown|summary):\s*/.test(bodyLines[k])) {
          const type = /^\s*type:\s*(.+)$/.exec(bodyLines[k])
          if (type) actualKind = type[1].trim().replace(/^["']|["']$/g, '')
          k++
        }
        body = trimOuterBlankLines(bodyLines.slice(k).join('\n'))
        blocks.push({ type: 'admonition', kind: actualKind, title: block.title, body, collapse: 'none', syntax: 'zensical' })
        i = block.next
        continue
      }
      flush()
      const block = readSlashBlock(lines, i)
      blocks.push({ type: 'raw', label: kind, text: block.raw })
      i = block.next
      continue
    }

    const classic = CLASSIC_ADMONITION.exec(line)
    if (classic) {
      flush()
      const [body, next] = readIndentedBody(lines, i + 1, classic[1])
      const marker = classic[2]
      const collapse: AdmonitionCollapse = marker === '???' ? 'closed' : marker === '???+' ? 'open' : 'none'
      blocks.push({ type: 'admonition', kind: classic[3], title: classic[4] ?? '', body, collapse, syntax: 'classic' })
      i = next
      continue
    }

    const classicTab = CLASSIC_TAB.exec(line)
    if (classicTab) {
      flush()
      const tabs: TabItem[] = []
      let next = i
      while (next < lines.length) {
        const tab = CLASSIC_TAB.exec(lines[next])
        if (!tab) break
        const [body, afterBody] = readIndentedBody(lines, next + 1, tab[1])
        tabs.push({ title: tab[2], body })
        next = afterBody
        while (lines[next]?.trim() === '') next++
      }
      blocks.push({ type: 'tabset', tabs, syntax: 'classic' })
      i = next
      continue
    }

    const mdTable = parseMarkdownTableAt(lines, i)
    if (mdTable) {
      flush()
      blocks.push({ type: 'markdownTable', table: mdTable[0] })
      i = mdTable[1]
      continue
    }

    const image = IMAGE.exec(line)
    if (image) {
      flush()
      blocks.push({ type: 'image', alt: image[1], src: image[2], title: image[3] ?? '', caption: '' })
      i++
      continue
    }

    const button = BUTTON.exec(line)
    if (button) {
      flush()
      blocks.push({ type: 'button', text: button[1], href: button[2], primary: /\bmd-button--primary\b/.test(button[3]) })
      i++
      continue
    }

    buf.push(line)
    i++
  }
  flush()
  return blocks
}

// ---- serialize ----

const slashes = (d: number) => '/'.repeat(d)

function serializeCell(c: Cell, depth: number): string {
  const m = slashes(depth)
  const children = c.blocks.map((b) =>
    b.type === 'text' ? b.md : serializeTable(b.table, depth + 1),
  )
  return [`${m} html | ${c.kind}${c.attrs}`, children.join('\n\n'), m].join('\n')
}

function serializeRow(r: Row, depth: number): string {
  const m = slashes(depth)
  const cells = r.cells.map((c) => serializeCell(c, depth + 1))
  return [`${m} html | tr${r.attrs}`, cells.join('\n\n'), m].join('\n')
}

function serializeTable(t: Table, depth: number): string {
  const m = slashes(depth)
  const children = [
    ...t.header.map((h) => serializeCell(h, depth + 1)),
    ...t.rows.map((r) => serializeRow(r, depth + 1)),
  ]
  return [`${m} html | table${t.attrs}`, children.join('\n\n'), m].join('\n')
}

function serializeMarkdownTable(t: MarkdownTable): string {
  const cols = Math.max(t.headers.length, ...t.rows.map((r) => r.length), 1)
  const headers = Array.from({ length: cols }, (_, i) => escapePipe(t.headers[i] ?? ''))
  const aligns = Array.from({ length: cols }, (_, i) => {
    const a = t.aligns[i] ?? 'left'
    if (a === 'center') return ':---:'
    if (a === 'right') return '---:'
    return ':---'
  })
  const rows = t.rows.map((row) => `| ${Array.from({ length: cols }, (_, i) => escapePipe(row[i] ?? '')).join(' | ')} |`)
  return [`| ${headers.join(' | ')} |`, `| ${aligns.join(' | ')} |`, ...rows].join('\n')
}

function serializeCode(b: Extract<DocBlock, { type: 'code' }>): string {
  const attrs = new Set(b.attrs.split(/\s+/).filter(Boolean))
  if (b.lang) attrs.add(`.${b.lang}`)
  if (b.copy) attrs.add('.copy')
  if (b.select) attrs.add('.select')
  if (b.lineNumbers) attrs.add('.linenums')
  const attrList = [...attrs]
  if (b.title.trim()) attrList.push(`title="${b.title.trim().replace(/"/g, '\\"')}"`)
  if (b.highlight.trim()) attrList.push(`hl_lines="${b.highlight.trim().replace(/"/g, '\\"')}"`)
  const info = attrList.length ? `{ ${attrList.join(' ')} }` : ''
  return [`\`\`\` ${info}`.trimEnd(), b.body, '```'].join('\n')
}

function serializeBlock(block: DocBlock): string {
  switch (block.type) {
    case 'markdown':
      return block.text.trim()
    case 'frontmatter': {
      const yaml = stringifyYaml(block.data).trimEnd()
      return ['---', yaml, '---'].join('\n')
    }
    case 'htmlTable':
      return serializeTable(block.table, 3)
    case 'markdownTable':
      return serializeMarkdownTable(block.table)
    case 'admonition':
      if (block.syntax === 'classic' || block.collapse !== 'none') {
        const marker = block.collapse === 'closed' ? '???' : block.collapse === 'open' ? '???+' : '!!!'
        const title = block.title.trim() ? ` "${block.title.trim().replace(/"/g, '\\"')}"` : ''
        return [`${marker} ${block.kind}${title}`, '', indentBody(block.body.trim())].join('\n')
      }
      return zensicalBlock(block.kind, block.title, block.body)
    case 'details':
      return zensicalBlock('details', block.title, block.open ? `    open: true\n\n${block.body.trim()}` : block.body)
    case 'tabset':
      return block.tabs.map((tab) => {
        if (block.syntax === 'classic') return [`=== "${tab.title.replace(/"/g, '\\"')}"`, '', indentBody(tab.body.trim())].join('\n')
        return zensicalBlock('tab', tab.title, tab.body)
      }).join('\n\n')
    case 'snippet':
      return `--8<-- "${block.path}"`
    case 'code':
      return serializeCode(block)
    case 'image': {
      const title = block.title.trim() ? ` "${block.title.trim().replace(/"/g, '\\"')}"` : ''
      const image = `![${block.alt}](${block.src}${title})`
      return block.caption.trim() ? `${image}\n\n*${block.caption.trim()}*` : image
    }
    case 'button':
      return `[${block.text}](${block.href}){ .md-button${block.primary ? ' .md-button--primary' : ''} }`
    case 'grid': {
      const body = block.cards.map((card) => {
        const head = card.href.trim() ? `- [${card.title}](${card.href})` : `- **${card.title}**`
        const cardBody = card.body.trim() ? `\n\n${indentBody(card.body.trim()).replace(/^/gm, '')}` : ''
        return `${head}${cardBody}`
      }).join('\n\n')
      return zensicalBlock('html | div.grid.cards', '', body)
    }
    case 'raw':
      return block.text
  }
}

/** Regenerate a markdown document from blocks. */
export function serializeDocument(blocks: DocBlock[]): string {
  return blocks.map(serializeBlock).filter((s) => s.trim()).join('\n\n')
}

// ---- model helpers (used by the editor) ----

export const emptyCell = (kind: 'th' | 'td'): Cell => ({
  kind,
  attrs: kind === 'th' ? "[style='text-align: center;']" : '',
  blocks: [{ type: 'text', md: '' }],
})

/** Number of columns a table presents (max of header / widest row). */
export function columnCount(t: Table): number {
  return Math.max(t.header.length, ...t.rows.map((r) => r.cells.length), 0)
}

export function newTable(): Table {
  return {
    attrs: '',
    header: [emptyCell('th'), emptyCell('th')],
    rows: [{ attrs: '', cells: [emptyCell('td'), emptyCell('td')] }],
  }
}

export function newMarkdownTable(): MarkdownTable {
  return {
    headers: ['Name', 'Description'],
    aligns: ['left', 'left'],
    rows: [['`key`', 'Describe the value']],
  }
}

export type InsertKind =
  | 'markdown'
  | 'frontmatter'
  | 'htmlTable'
  | 'markdownTable'
  | 'admonition'
  | 'details'
  | 'tabset'
  | 'snippet'
  | 'code'
  | 'image'
  | 'button'
  | 'grid'

export function newBlock(kind: InsertKind): DocBlock {
  switch (kind) {
    case 'markdown':
      return { type: 'markdown', text: 'New paragraph.' }
    case 'frontmatter':
      return { type: 'frontmatter', data: { title: 'Page title', description: '', status: 'new' } }
    case 'htmlTable':
      return { type: 'htmlTable', table: newTable() }
    case 'markdownTable':
      return { type: 'markdownTable', table: newMarkdownTable() }
    case 'admonition':
      return { type: 'admonition', kind: 'note', title: 'Note', body: 'Write the callout content here.', collapse: 'none', syntax: 'zensical' }
    case 'details':
      return { type: 'details', title: 'Details', body: 'Write the collapsible content here.', open: false, syntax: 'zensical' }
    case 'tabset':
      return { type: 'tabset', syntax: 'zensical', tabs: [{ title: 'Option A', body: 'Content for option A.' }, { title: 'Option B', body: 'Content for option B.' }] }
    case 'snippet':
      return { type: 'snippet', path: 'docs/example.md' }
    case 'code':
      return { type: 'code', lang: 'yaml', title: '', body: 'key: value', attrs: '', copy: false, select: false, lineNumbers: false, highlight: '' }
    case 'image':
      return { type: 'image', alt: 'Screenshot', src: 'assets/screenshot.png', title: '', caption: '' }
    case 'button':
      return { type: 'button', text: 'Open documentation', href: 'https://example.com', primary: true }
    case 'grid':
      return { type: 'grid', cards: [{ title: 'Card title', href: '', body: 'Card body.' }, { title: 'Another card', href: '', body: 'More content.' }] }
  }
}
