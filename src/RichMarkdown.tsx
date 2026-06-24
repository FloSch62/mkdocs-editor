import { useState, type ReactNode } from 'react'
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Chip,
  Tab,
  Tabs,
} from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined'
import { renderMarkdown } from './markdown.ts'
import { ADMONITION } from './admonitions.ts'

// ---- parse pymdownx blocks within a prose markdown fragment ----
//
// Material for MkDocs / Zensical use `pymdownx.blocks.*` and `pymdownx.snippets`:
//   /// tab | Title        (tabbed content; consecutive tabs form one switcher)
//   /// note | Title       (admonitions: note/tip/warning/danger/…)
//   /// details | Title    (collapsible)
//   --8<-- "path"          (snippet include, resolved at build time)
// Nesting depth is the slash count, same as the table syntax. We render these so the preview
// matches the published page; editing remains raw-markdown per segment (see App).

type RichNode =
  | { type: 'md'; text: string }
  | { type: 'block'; kind: string; title: string | null; children: RichNode[] }
  | { type: 'snippet'; path: string }

const OPEN = /^(\s*)(\/{3,})\s+([A-Za-z][\w-]*)\s*(?:\|\s*(.*?))?\s*$/
const CLOSE = /^(\s*)(\/{3,})\s*$/
const SNIPPET = /^\s*--8<--\s+"(.+?)"\s*$/
// A fenced code block delimiter: ``` or ~~~ (optionally indented, optional info string).
const FENCE = /^(\s*)(`{3,}|~{3,})\s*(.*)$/

function parseRich(text: string): RichNode[] {
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  const [nodes] = parseUntil(lines, 0, 0, '')
  return nodes
}

// The generic `/// admonition | Title` block carries its style on a `type: …` config line
// (and possibly `attrs:`/`class:` lines). Strip those config lines and resolve the style.
function normalizeAdmonition(title: string | null, children: RichNode[]): { kind: string; title: string | null; children: RichNode[] } {
  let type = 'note'
  const rest = children.slice()
  if (rest[0]?.type === 'md') {
    const ls = rest[0].text.split('\n')
    let k = 0
    while (k < ls.length && /^\s*(type|attrs|class|id|markdown|summary):\s*/.test(ls[k])) {
      const m = /^\s*type:\s*(.+)$/.exec(ls[k])
      if (m) type = m[1].trim().replace(/^["']|["']$/g, '')
      k++
    }
    const remain = ls.slice(k).join('\n')
    if (remain.trim()) rest[0] = { type: 'md', text: remain }
    else rest.shift()
  }
  if (!ADMONITION[type]) type = 'note' // custom types (e.g. "subtle-note") fall back to note
  return { kind: type, title, children: rest }
}

// Parse nodes until a closing fence of `marker` length (0 = top level / EOF). Fenced code
// blocks are passed through verbatim so `///` / `--8<--` *inside* a code sample are never
// mistaken for block syntax.
function stripIndent(line: string, indent: string): string {
  return indent && line.startsWith(indent) ? line.slice(indent.length) : line
}

function isChildBlock(openIndent: string, openMarker: number, parentIndent: string, parentMarker: number): boolean {
  return openIndent === parentIndent && openMarker > parentMarker
}

function parseUntil(lines: string[], start: number, marker: number, indent: string): [RichNode[], number] {
  const nodes: RichNode[] = []
  let buf: string[] = []
  let fence: { char: string; len: number } | null = null
  const flush = () => {
    if (buf.length && buf.join('\n').trim() !== '') nodes.push({ type: 'md', text: buf.join('\n') })
    buf = []
  }
  let i = start
  while (i < lines.length) {
    const line = lines[i]
    const fm = FENCE.exec(line)
    if (fence) {
      // inside a code block: only its matching closing delimiter ends it
      if (fm && fm[2][0] === fence.char && fm[2].length >= fence.len && fm[3].trim() === '') fence = null
      buf.push(stripIndent(line, indent)); i++; continue
    }
    if (fm) { fence = { char: fm[2][0], len: fm[2].length }; buf.push(stripIndent(line, indent)); i++; continue }
    const close = CLOSE.exec(line)
    if (marker > 0 && close && close[1] === indent && close[2].length === marker) { flush(); return [nodes, i + 1] }
    const open = OPEN.exec(line)
    if (open && isChildBlock(open[1], open[2].length, indent, marker)) {
      flush()
      const [children, next] = parseUntil(lines, i + 1, open[2].length, open[1])
      const kind = open[3].toLowerCase()
      const title = open[4]?.trim() || null
      nodes.push({ type: 'block', ...(kind === 'admonition' ? normalizeAdmonition(title, children) : { kind, title, children }) })
      i = next
      continue
    }
    const snip = SNIPPET.exec(line)
    if (snip) { flush(); nodes.push({ type: 'snippet', path: snip[1] }); i++; continue }
    buf.push(stripIndent(line, indent))
    i++
  }
  flush()
  return [nodes, i]
}

function Md({ text }: { text: string }) {
  if (!text.trim()) return null
  return <div className="prose" dangerouslySetInnerHTML={{ __html: renderMarkdown(text) }} />
}

function Snippet({ path }: { path: string }) {
  return (
    <Chip
      size="small"
      icon={<DescriptionOutlinedIcon />}
      label={path}
      variant="outlined"
      sx={{
        my: 0.75, fontFamily: 'ui-monospace, monospace', fontSize: 12,
        borderStyle: 'dashed', color: 'var(--muted)', borderColor: 'var(--line)',
      }}
      title="Snippet include — resolved by MkDocs at build time"
    />
  )
}

const isBlank = (n: RichNode) => n.type === 'md' && n.text.trim() === ''

function htmlDivClassName(title: string | null): string | null {
  const target = title?.trim()
  if (!target) return null
  const m = /^div((?:\.[A-Za-z0-9_-]+)+)$/.exec(target)
  if (!m) return null
  return m[1].slice(1).replace(/\./g, ' ')
}

function Admonition({ kind, title, nodes }: { kind: string; title: string | null; nodes: RichNode[] }) {
  const meta = ADMONITION[kind] ?? ADMONITION.note
  const { color, Icon } = meta
  return (
    <Box
      sx={{
        my: '1.5625em', fontSize: '12.8px',
        borderRadius: '8px', borderLeft: `3px solid ${color}`,
        background: `color-mix(in srgb, ${color} 10%, var(--md-default-bg-color))`,
        px: '0.9rem', pt: '0.3rem', pb: '0.6rem',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: '0.4em', mb: '0.7em', fontWeight: 700, color: 'var(--md-default-fg-color)' }}>
        <Icon sx={{ color, fontSize: 18 }} />
        <span style={{ textTransform: title ? 'none' : 'capitalize' }}>{title ?? kind}</span>
      </Box>
      <Box sx={{ '& > .prose:first-of-type': { mt: 0 }, '& > .prose:last-of-type': { mb: 0 } }}>
        <RichNodes nodes={nodes} />
      </Box>
    </Box>
  )
}

function Details({ title, nodes }: { title: string | null; nodes: RichNode[] }) {
  return (
    <Accordion
      disableGutters
      elevation={0}
      sx={{ my: '1.5625em', border: '1px solid var(--line)', borderRadius: '8px !important', background: 'var(--panel)', '&:before': { display: 'none' } }}
    >
      <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ fontWeight: 700, minHeight: 44 }}>
        {title ?? 'Details'}
      </AccordionSummary>
      <AccordionDetails sx={{ pt: 0 }}>
        <RichNodes nodes={nodes} />
      </AccordionDetails>
    </Accordion>
  )
}

function TabGroup({ tabs }: { tabs: Array<{ title: string; children: RichNode[] }> }) {
  const [val, setVal] = useState(0)
  return (
    <Box sx={{ my: '1em', border: '1px solid var(--line)', borderRadius: '8px', overflow: 'hidden', background: 'transparent' }}>
      <Tabs
        value={val}
        onChange={(_, v) => setVal(v)}
        variant="scrollable"
        scrollButtons="auto"
        sx={{ minHeight: 42, borderBottom: '1px solid var(--line)', px: 1, background: 'var(--zx-surface-hover)' }}
      >
        {tabs.map((t, i) => (
          <Tab key={i} label={t.title} sx={{ minHeight: 42, textTransform: 'none', fontWeight: 500 }} />
        ))}
      </Tabs>
      {tabs.map((t, i) => (
        <Box key={i} hidden={val !== i} sx={{ px: 2, py: 1.5 }}>
          {val === i && <RichNodes nodes={t.children} />}
        </Box>
      ))}
    </Box>
  )
}

function HtmlBlock({ title, nodes }: { title: string | null; nodes: RichNode[] }) {
  const className = htmlDivClassName(title)
  if (!className) return <RichNodes nodes={nodes} />
  return <div className={className}><RichNodes nodes={nodes} /></div>
}

// Render a node list, grouping consecutive `tab` blocks (ignoring blank md between them)
// into a single tab switcher — exactly how MkDocs collapses sibling tabs.
function RichNodes({ nodes }: { nodes: RichNode[] }) {
  const out: ReactNode[] = []
  let i = 0
  while (i < nodes.length) {
    const n = nodes[i]
    if (n.type === 'block' && n.kind === 'tab') {
      const group: Array<{ title: string; children: RichNode[] }> = []
      while (i < nodes.length) {
        const m = nodes[i]
        if (m.type === 'block' && m.kind === 'tab') { group.push({ title: m.title ?? 'Tab', children: m.children }); i++; continue }
        if (isBlank(m)) { i++; continue }
        break
      }
      out.push(<TabGroup key={`tabs-${i}`} tabs={group} />)
      continue
    }
    if (n.type === 'snippet') out.push(<Snippet key={i} path={n.path} />)
    else if (n.type === 'md') { if (!isBlank(n)) out.push(<Md key={i} text={n.text} />) }
    else if (n.kind === 'details') out.push(<Details key={i} title={n.title} nodes={n.children} />)
    else if (ADMONITION[n.kind]) out.push(<Admonition key={i} kind={n.kind} title={n.title} nodes={n.children} />)
    else if (n.kind === 'html') out.push(<HtmlBlock key={i} title={n.title} nodes={n.children} />)
    else {
      // unknown block: show its body with a small type label so nothing is silently lost
      out.push(
        <Box key={i} sx={{ my: 1.5, border: '1px dashed var(--line)', borderRadius: 1.5, p: 1.5 }}>
          <Box sx={{ fontSize: 11, color: 'var(--muted)', mb: 0.5 }}>{n.kind}{n.title ? ` · ${n.title}` : ''}</Box>
          <RichNodes nodes={n.children} />
        </Box>,
      )
    }
    i++
  }
  return <>{out}</>
}

export default function RichMarkdown({ text }: { text: string }) {
  return <RichNodes nodes={parseRich(text)} />
}
