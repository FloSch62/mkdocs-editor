// Quick structural round-trip check, runnable with `pnpm check` (node --experimental-strip-types).
// Parses the sample, re-serializes, re-parses, and asserts the two parses are deep-equal —
// i.e. the serializer is a faithful inverse of the parser (modulo whitespace/comments).
import { parseDocument, serializeDocument } from '../src/blocks.ts'
import { parseGitHubUrl } from '../src/github/url.ts'
import { SAMPLE } from '../src/sample.ts'

const FEATURE_SAMPLE = `---
title: Feature page
description: Structured editing fixture
hide:
  - toc
---

# Feature page

!!! warning "Classic warning"

    Body with ==mark==.

???+ tip "Open tip"

    Keep this open.

/// details | Extra
    open: true

Extra body.
///

=== "Linux"

    \`\`\` bash
    echo "/// note"
    \`\`\`

=== "macOS"

    Use ++cmd+c++.

| Method | Description |
| :--- | ---: |
| GET | Fetch |

\`\`\` { .yaml .copy .select .linenums title="Config" hl_lines="1" }
key: value
\`\`\`

--8<-- "docs/include.md"

![Topology](assets/topology.png "Topology")

[Launch](https://example.com){ .md-button .md-button--primary }

/// html | div.grid.cards

- [Install](install.md)

    Install the app.

- **Operate**

    Run operations.
///

/// custom | keep me
Do not model this.
///
`

function assertStable(name: string, src: string) {
  const first = parseDocument(src)
  const round = serializeDocument(first)
  const second = parseDocument(round)
  if (JSON.stringify(first) !== JSON.stringify(second)) {
    console.error(`FAIL: ${name} round-trip is not stable`)
    console.error('first parse :', JSON.stringify(first))
    console.error('second parse:', JSON.stringify(second))
    process.exit(1)
  }
  return first
}

function assertGitHubTarget(name: string, input: string, expected: object) {
  const actual = parseGitHubUrl(input)
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    console.error(`FAIL: ${name} parsed incorrectly`)
    console.error('expected:', JSON.stringify(expected))
    console.error('actual  :', JSON.stringify(actual))
    process.exit(1)
  }
}

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
const tables = a.filter((s) => s.type === 'htmlTable')
const outer = tables[0] && tables[0].type === 'htmlTable' ? tables[0].table : null
const services = outer?.rows.find((r) => r.cells[0]?.blocks.some((bk) => bk.type === 'text' && bk.md.includes('services')))
const nested = services?.cells[1]?.blocks.some((bk) => bk.type === 'table')
const callouts = a.filter((s) => s.type === 'admonition').length
const tabsets = a.filter((s) => s.type === 'tabset').length
const details = a.filter((s) => s.type === 'details').length
console.log(`tables: ${tables.length}, header cols: ${outer?.header.length}, rows: ${outer?.rows.length}, nested sub-table present: ${nested}`)
console.log(`structured blocks: admonitions=${callouts}, tabsets=${tabsets}, details=${details}`)
if (!nested) { console.error('FAIL: expected a nested sub-table in the services cell'); process.exit(1) }
if (callouts < 1 || tabsets < 1 || details < 1) {
  console.error('FAIL: expected sample admonition, tabset, and details blocks to be structured')
  process.exit(1)
}

const features = assertStable('feature fixture', FEATURE_SAMPLE)
const expectedTypes = ['frontmatter', 'admonition', 'details', 'tabset', 'markdownTable', 'code', 'snippet', 'image', 'button', 'grid', 'raw']
for (const type of expectedTypes) {
  if (!features.some((block) => block.type === type)) {
    console.error(`FAIL: expected feature fixture to include a structured ${type} block`)
    process.exit(1)
  }
}
console.log(`feature blocks: ${features.map((block) => block.type).join(', ')}`)
assertGitHubTarget('root-level blob URL', 'https://github.com/o/r/blob/main/README.md', {
  owner: 'o',
  repo: 'r',
  branch: 'main',
  subPath: '',
})
assertGitHubTarget('nested blob URL', 'https://github.com/o/r/blob/main/docs/README.md', {
  owner: 'o',
  repo: 'r',
  branch: 'main',
  subPath: 'docs',
})
console.log('PASS: round-trip stable + structured blocks preserved')
