import { readFileSync } from 'node:fs'
import { parseDocument } from '../src/blocks.ts'
const src = readFileSync('/home/flschwar/projects/eda/docs/docs/software-install/deploying-eda/setting-up-the-eda-virtual-machine-nodes.md','utf8')
const segs = parseDocument(src)
console.log('segments:', segs.map(s => s.type))
const prose = segs.filter(s => s.type === 'md').map(s => s.text)
// find which md segment contains 'subtle-note' and show its context
prose.forEach((t, i) => {
  const idx = t.indexOf('subtle-note')
  console.log(`md[${i}] len=${t.length} hasSubtle=${idx >= 0}`)
})
