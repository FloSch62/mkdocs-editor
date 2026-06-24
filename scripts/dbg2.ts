import { readFileSync } from 'node:fs'
import { parseDocument } from '../src/blocks.ts'

const OPEN = /^(\/{3,})\s+([A-Za-z][\w-]*)\s*(?:\|\s*(.*?))?\s*$/
const CLOSE = /^(\/{3,})\s*$/
const SNIPPET = /^\s*--8<--\s+"(.+?)"\s*$/
const FENCE = /^(\s*)(`{3,}|~{3,})\s*(.*)$/
type N = { type: 'md'; text: string } | { type: 'block'; kind: string; title: string | null; children: N[] } | { type: 'snippet'; path: string }
const ADM: Record<string, boolean> = { note: true }
function normAd(title: string | null, children: N[]) {
  let type = 'note'; const rest = children.slice()
  if (rest[0]?.type === 'md') {
    const ls = rest[0].text.split('\n'); let k = 0
    while (k < ls.length && /^\s*(type|attrs|class|id|markdown|summary):\s*/.test(ls[k])) { const m = /^\s*type:\s*(.+)$/.exec(ls[k]); if (m) type = m[1].trim(); k++ }
    const remain = ls.slice(k).join('\n'); if (remain.trim()) rest[0] = { type: 'md', text: remain }; else rest.shift()
  }
  if (!ADM[type]) type = 'note'
  return { kind: type, title, children: rest }
}
function parseUntil(lines: string[], start: number, marker: number): [N[], number] {
  const nodes: N[] = []; let buf: string[] = []; let fence: { char: string; len: number } | null = null
  const flush = () => { if (buf.length && buf.join('\n').trim() !== '') nodes.push({ type: 'md', text: buf.join('\n') }); buf = [] }
  let i = start
  while (i < lines.length) {
    const line = lines[i]; const fm = FENCE.exec(line)
    if (fence) { if (fm && fm[2][0] === fence.char && fm[2].length >= fence.len && fm[3].trim() === '') fence = null; buf.push(line); i++; continue }
    if (fm) { fence = { char: fm[2][0], len: fm[2].length }; buf.push(line); i++; continue }
    const close = CLOSE.exec(line); if (marker > 0 && close && close[1].length === marker) { flush(); return [nodes, i + 1] }
    const open = OPEN.exec(line)
    if (open && open[1].length > marker) { flush(); const [ch, next] = parseUntil(lines, i + 1, open[1].length); const kind = open[2].toLowerCase(); const title = open[3]?.trim() || null; nodes.push({ type: 'block', ...(kind === 'admonition' ? normAd(title, ch) : { kind, title, children: ch }) }); i = next; continue }
    const snip = SNIPPET.exec(line); if (snip) { flush(); nodes.push({ type: 'snippet', path: snip[1] }); i++; continue }
    buf.push(line); i++
  }
  flush(); return [nodes, i]
}

const segs = parseDocument(readFileSync('/home/flschwar/projects/eda/docs/docs/software-install/deploying-eda/setting-up-the-eda-virtual-machine-nodes.md', 'utf8'))
const prose = (segs[2] as { text: string }).text
const [nodes] = parseUntil(prose.split('\n'), 0, 0)
function walk(ns: N[], path: string) {
  for (const n of ns) {
    if (n.type === 'md' && n.text.includes('subtle-note')) console.log('LEAK md @', path, ':', JSON.stringify(n.text.slice(0, 100)))
    if (n.type === 'block') { console.log('block', n.kind, '|', n.title); walk(n.children, path + '>' + n.kind) }
  }
}
walk(nodes, 'root')
