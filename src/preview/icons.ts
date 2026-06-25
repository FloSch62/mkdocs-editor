// Resolve MkDocs-Material icon shortcodes (`:material-rocket-launch-outline:`,
// `:octicons-cpu-16:`, `:simple-nokia:`, `:fontawesome-brands-docker:`) to inline SVGs,
// fetched on demand from jsdelivr and cached. The SVG is inlined into the rendered HTML
// (not injected imperatively) so React owns it and re-renders never drop it: the marked
// renderer calls resolveIcon() — a hit inlines the SVG, a miss returns null and kicks off
// a fetch that, on completion, bumps a version the prose renderer subscribes to, causing a
// re-render that now inlines the loaded icon. Only icons actually on the page are fetched.

const CDN = 'https://cdn.jsdelivr.net/npm'

// Map a shortcode name to the SVG URL of its source icon package.
export function iconUrl(name: string): string | null {
  let m = /^material-(.+)$/.exec(name)
  if (m) return `${CDN}/@mdi/svg/svg/${m[1]}.svg`
  m = /^octicons-(.+)$/.exec(name) // name already includes the size suffix, e.g. cpu-16
  if (m) return `${CDN}/@primer/octicons/build/svg/${m[1]}.svg`
  m = /^simple-(.+)$/.exec(name)
  if (m) return `${CDN}/simple-icons/icons/${m[1]}.svg`
  m = /^fontawesome-(brands|solid|regular)-(.+)$/.exec(name)
  if (m) return `${CDN}/@fortawesome/fontawesome-free/svgs/${m[1]}/${m[2]}.svg`
  return null
}

// Keep only a bare <svg>…</svg>, drop intrinsic width/height (so CSS sizes it), and
// refuse anything that smells like script (icon packages are pure path data).
function sanitizeSvg(svg: string): string | null {
  const trimmed = svg.trim()
  if (!/^<svg[\s>]/i.test(trimmed) || /<script/i.test(trimmed)) return null
  return trimmed.replace(/<svg([^>]*)>/i, (_m, attrs: string) => `<svg${attrs.replace(/\s(?:width|height)="[^"]*"/gi, '')}>`)
}

// '' = resolved but unavailable; string = svg markup; absent = not yet fetched.
const cache = new Map<string, string>()
const inflight = new Set<string>()
const listeners = new Set<() => void>()
let version = 0

function notify() {
  version += 1
  listeners.forEach((l) => l())
}

export function subscribeIcons(cb: () => void): () => void {
  listeners.add(cb)
  return () => listeners.delete(cb)
}
export function iconsVersion(): number {
  return version
}

// Synchronous: return inline SVG if cached, else null and start a one-time fetch.
export function resolveIcon(name: string): string | null {
  const cached = cache.get(name)
  if (cached !== undefined) return cached || null
  if (!inflight.has(name)) {
    inflight.add(name)
    const url = iconUrl(name)
    const p: Promise<string | null> = url
      ? fetch(url)
          .then((r) => (r.ok ? r.text() : null))
          .then((svg) => (svg ? sanitizeSvg(svg) : null))
          .catch(() => null)
      : Promise.resolve(null)
    void p.then((svg) => {
      cache.set(name, svg ?? '')
      inflight.delete(name)
      notify()
    })
  }
  return null
}
