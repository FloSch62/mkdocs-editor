import { createContext, useContext } from 'react'
import type { RepoMeta } from '../workspace/types.ts'

// Resolves asset paths (image src) found in rendered markdown to absolute URLs. In a repo
// workspace, relative paths are resolved against the active file's directory on
// raw.githubusercontent.com — exactly how MkDocs resolves page-relative links. In
// paste/single-doc mode the resolver is the identity (no repo to resolve against).

export type AssetResolver = (src: string) => string

const identity: AssetResolver = (s) => s
export { identity as identityResolver }

export const AssetResolverContext = createContext<AssetResolver>(identity)
export const useAssetResolver = (): AssetResolver => useContext(AssetResolverContext)

const RAW = 'https://raw.githubusercontent.com'

export function makeAssetResolver(meta: RepoMeta, filePath: string): AssetResolver {
  const dir = filePath.includes('/') ? filePath.slice(0, filePath.lastIndexOf('/')) : ''
  const base = `${RAW}/${meta.owner}/${meta.repo}/${meta.branch}/${dir ? `${dir}/` : ''}`
  return (src) => {
    if (!src) return src
    // Leave absolute URLs (scheme: or //), data:, and bare anchors untouched.
    if (/^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(src)) return src
    try {
      return new URL(src, base).href
    } catch {
      return src
    }
  }
}

// Rewrite every <img src="…"> in a rendered HTML string through the resolver. Cheap
// no-op when the resolver is the identity (paste/single-doc mode).
const IMG_SRC = /(<img\b[^>]*?\bsrc=)(["'])(.*?)\2/gi
export function resolveHtmlAssets(html: string, resolve: AssetResolver): string {
  if (resolve === identity) return html
  return html.replace(IMG_SRC, (_m, pre: string, q: string, url: string) => `${pre}${q}${resolve(url)}${q}`)
}
