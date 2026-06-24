// Quick structural round-trip check, runnable with `pnpm check` (node --experimental-strip-types).
// Parses the sample, re-serializes, re-parses, and asserts the two parses are deep-equal —
// i.e. the serializer is a faithful inverse of the parser (modulo whitespace/comments).
import { parseDocument, serializeDocument } from '../src/blocks.ts'
import { SAMPLE } from '../src/sample.ts'

const a = parseDocument(SAMPLE)
const round = serializeDocument(a)
const b = parseDocument(round)

const norm = (s: object) => JSON.stringify(s)
const ok = norm(a) === norm(b)

console.log('--- re-serialized ---\n')
console.log(round)
console.log('\n--- result ---')
if (!ok) {
  console.error('FAIL: round-trip is not stable')
  console.error('first parse :', norm(a))
  console.error('second parse:', norm(b))
  process.exit(1)
}
// Spot-check the structure we expect from the sample.
const tables = a.filter((s) => s.type === 'table')
const outer = tables[0] && tables[0].type === 'table' ? tables[0].table : null
const machines = outer?.rows.find((r) => r.cells[0]?.blocks.some((bk) => bk.type === 'text' && bk.md.includes('machines')))
const nested = machines?.cells[1]?.blocks.some((bk) => bk.type === 'table')
console.log(`tables: ${tables.length}, header cols: ${outer?.header.length}, rows: ${outer?.rows.length}, nested sub-table present: ${nested}`)
if (!nested) { console.error('FAIL: expected a nested sub-table in the machines cell'); process.exit(1) }
console.log('PASS: round-trip stable + nested table preserved')
