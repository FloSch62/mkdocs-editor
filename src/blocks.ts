// blocks.ts — the deterministic core.
//
// MkDocs (Material) authors complex tables with the `pymdownx.blocks.html` extension:
// nested HTML tables expressed as slash fences where the *nesting depth is encoded as the
// number of slashes*. e.g.
//
//   /// html | table            <- depth 1 (3 slashes)
//   //// html | th[style=...]    <- depth 2
//   Top-level parameter
//   ////
//   //// html | tr
//   ///// html | td             <- depth 3
//   `version`
//   /////
//   ////
//   ///
//
// A cell (td) may itself contain a whole `////// html | table`, recursively. Hand-authoring
// this means counting slashes and balancing fences across six-plus levels — the "menace".
//
// This module parses that syntax into a typed tree (parseDocument) and regenerates it with
// correct slash depths (serializeDocument). The serializer is pure codegen: the user never
// counts a slash again. The round-trip is structurally lossless (it normalises whitespace
// and drops decorative HTML comments — both desirable once a GUI replaces hand-editing).

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
export type Segment = { type: 'md'; text: string } | { type: 'table'; table: Table }

// A fence opener: `/// html | tag[attrs]`. Tag is a bare word; everything after it (until
// EOL, trimmed) is the verbatim attribute suffix.
const OPEN = /^(\/{3,})\s+html\s*\|\s*([A-Za-z][\w-]*)\s*(.*?)\s*$/
// A fence closer: a line that is only slashes.
const CLOSE = /^(\/{3,})\s*$/
// A fenced code block delimiter (``` or ~~~) — table syntax inside a code sample is literal.
const FENCE = /^(\s*)(`{3,}|~{3,})\s*(.*)$/

interface GNode {
  tag: string
  attrs: string
  marker: number
  children: GChild[]
}
type GChild = GNode | { text: string }

// Parse one html block beginning at lines[i] (which must match OPEN). Returns the node and
// the index of the line *after* its closing fence.
function parseBlock(lines: string[], i: number): [GNode, number] {
  const m = OPEN.exec(lines[i])!
  const marker = m[1].length
  const node: GNode = { tag: m[2], attrs: m[3] ?? '', marker, children: [] }
  let j = i + 1
  while (j < lines.length) {
    const line = lines[j]
    const close = CLOSE.exec(line)
    if (close && close[1].length === marker) return [node, j + 1] // our own closer
    const open = OPEN.exec(line)
    if (open && open[1].length > marker) {
      const [child, next] = parseBlock(lines, j) // deeper fence => nested block
      node.children.push(child)
      j = next
      continue
    }
    node.children.push({ text: line }) // plain content line
    j++
  }
  return [node, j] // unterminated block: tolerate by closing at EOF
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
    else if (ch.tag === 'table') { flush(); blocks.push({ type: 'table', table: nodeToTable(ch) }) }
    // any other nested tag inside a cell is unexpected for this syntax — ignored
  }
  flush()
  return { kind, attrs: node.attrs, blocks }
}

function nodeToRow(node: GNode): Row {
  const cells: Cell[] = []
  for (const ch of node.children) {
    if ('text' in ch) continue // drop comments/whitespace between cells
    if (ch.tag === 'td' || ch.tag === 'th') cells.push(nodeToCell(ch, ch.tag as 'td' | 'th'))
  }
  return { attrs: node.attrs, cells }
}

function nodeToTable(node: GNode): Table {
  const header: Cell[] = []
  const rows: Row[] = []
  for (const ch of node.children) {
    if ('text' in ch) continue // drop comments/whitespace between structural children
    if (ch.tag === 'th') header.push(nodeToCell(ch, 'th'))
    else if (ch.tag === 'tr') rows.push(nodeToRow(ch))
    else if (ch.tag === 'td') rows.push({ attrs: '', cells: [nodeToCell(ch, 'td')] }) // bare td: wrap in a row
  }
  return { attrs: node.attrs, header, rows }
}

/** Parse a full markdown document into prose segments and editable table segments. */
export function parseDocument(src: string): Segment[] {
  const lines = src.replace(/\r\n?/g, '\n').split('\n')
  const segs: Segment[] = []
  let buf: string[] = []
  const flush = () => {
    if (buf.length) { segs.push({ type: 'md', text: buf.join('\n') }); buf = [] }
  }
  let fence: { char: string; len: number } | null = null
  let i = 0
  while (i < lines.length) {
    const fm = FENCE.exec(lines[i])
    if (fence) {
      if (fm && fm[2][0] === fence.char && fm[2].length >= fence.len && fm[3].trim() === '') fence = null
      buf.push(lines[i]); i++; continue
    }
    if (fm) { fence = { char: fm[2][0], len: fm[2].length }; buf.push(lines[i]); i++; continue }
    const open = OPEN.exec(lines[i])
    if (open && open[2] === 'table') {
      flush()
      const [node, next] = parseBlock(lines, i)
      segs.push({ type: 'table', table: nodeToTable(node) })
      i = next
      continue
    }
    buf.push(lines[i])
    i++
  }
  flush()
  return segs
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

/** Regenerate a markdown document from segments, with all fence depths recomputed. */
export function serializeDocument(segs: Segment[]): string {
  return segs
    .map((s) => (s.type === 'md' ? s.text : serializeTable(s.table, 3)))
    .join('\n')
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
