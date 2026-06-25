// Adapt a repository's `extra_css` so it styles the editor's rendered content (the same
// `.prose` shown in both edit and preview) without touching the editor chrome. A MkDocs
// theme stylesheet targets Material's DOM, so we rewrite it to ours:
//   - `.md-typeset` → `.prose` (our typeset container)
//   - root selectors (`:root`, `:root>*`, `html`, `body`, `*`) → the scope wrapper, so
//     `--md-*` variable overrides land on the wrapper and cascade into `.prose`
//   - leading `[data-md-color-scheme|primary|accent=…]` selectors merge onto the wrapper
//     (the wrapper carries those attributes), so per-scheme rules — e.g. blue headings in
//     light, white in dark — resolve correctly
//   - every other selector is nested under the wrapper

function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '')
}

function splitSelectorList(sel: string): string[] {
  const parts: string[] = []
  let depth = 0
  let start = 0
  for (let i = 0; i < sel.length; i++) {
    const c = sel[i]
    if (c === '(' || c === '[') depth++
    else if (c === ')' || c === ']') depth--
    else if (c === ',' && depth === 0) {
      parts.push(sel.slice(start, i))
      start = i + 1
    }
  }
  parts.push(sel.slice(start))
  return parts
}

const ROOT_SELECTOR = /^(?::root\s*>\s*\*|:root|html|body|\*)/
const SCHEME_PREFIX = /^(?:\[data-md-color-[^\]]*\])+/

function scopeSelector(sel: string, scope: string): string {
  let s = sel.trim()
  if (!s) return s
  s = s.replace(/\.md-typeset\b/g, '.prose')

  const root = ROOT_SELECTOR.exec(s)
  if (root) {
    // `:root` / `html` / `body` / `*` (plus any trailing attrs) → the wrapper itself.
    return scope + s.slice(root[0].length)
  }
  const scheme = SCHEME_PREFIX.exec(s)
  if (scheme) {
    // `[data-md-color-scheme=slate] .prose h1` → `.zx-repo-css[…] .prose h1`
    return scope + scheme[0] + s.slice(scheme[0].length)
  }
  if (!s.startsWith(scope)) s = `${scope} ${s}`
  return s
}

const NESTED_AT = new Set(['media', 'supports', 'container', 'layer'])

function scopeRules(css: string, scope: string): string {
  let out = ''
  let i = 0
  const n = css.length
  while (i < n) {
    let j = i
    while (j < n && css[j] !== '{' && css[j] !== '}' && css[j] !== ';') j++
    const prelude = css.slice(i, j).trim()

    if (j >= n) {
      if (prelude) out += prelude
      break
    }
    if (css[j] === ';') {
      if (prelude) out += `${prelude};\n`
      i = j + 1
      continue
    }
    if (css[j] === '}') {
      i = j + 1
      continue
    }

    const bodyStart = j + 1
    let depth = 1
    let k = bodyStart
    while (k < n && depth > 0) {
      if (css[k] === '{') depth++
      else if (css[k] === '}') depth--
      k++
    }
    const body = css.slice(bodyStart, k - 1)

    if (prelude.startsWith('@')) {
      const name = prelude.slice(1).split(/[\s({]/)[0].toLowerCase()
      if (NESTED_AT.has(name)) {
        out += `${prelude}{${scopeRules(body, scope)}}`
      } else {
        // @font-face, @keyframes, @page, … — global by nature, keep as-is.
        out += `${prelude}{${body}}`
      }
    } else {
      const scoped = splitSelectorList(prelude)
        .map((s) => scopeSelector(s, scope))
        .filter(Boolean)
        .join(', ')
      out += `${scoped}{${body}}`
    }
    i = k
  }
  return out
}

export function scopeCss(css: string, scope: string): string {
  return scopeRules(stripComments(css), scope)
}
