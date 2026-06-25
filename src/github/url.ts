// Parse a GitHub URL (or `owner/repo` shorthand) into the pieces we need to fetch a
// docs tree. We accept the two shapes the user cares about — a repo root and a
// `/tree/<branch>/<subPath>` subdirectory link — plus a few common variants so pasting
// is forgiving.

export interface GitHubTarget {
  owner: string
  repo: string
  // Absent when the URL points at a repo root with no ref — the caller resolves the
  // repository's default branch in that case.
  branch?: string
  // Directory to scope the docs to, relative to the repo root. '' means the whole repo.
  subPath: string
}

// Strip a trailing slash and an optional `.git` suffix from a repo segment.
const cleanRepo = (repo: string): string => repo.replace(/\.git$/, '')
const decodeSegment = (segment: string): string => {
  try {
    return decodeURIComponent(segment)
  } catch {
    return segment
  }
}

export function buildGitHubTreeUrl(target: Required<GitHubTarget>): string {
  const root = [
    'https://github.com',
    encodeURIComponent(target.owner),
    encodeURIComponent(target.repo),
    'tree',
    encodeURIComponent(target.branch),
  ].join('/')
  const path = target.subPath
    .split('/')
    .filter(Boolean)
    .map(encodeURIComponent)
    .join('/')
  return path ? `${root}/${path}` : root
}

export function parseGitHubUrl(input: string): GitHubTarget | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  // `owner/repo` shorthand (no scheme, no host) — e.g. `nokia-eda/docs`.
  const shorthand = trimmed.match(/^([\w.-]+)\/([\w.-]+)$/)
  if (shorthand) {
    return { owner: shorthand[1], repo: cleanRepo(shorthand[2]), subPath: '' }
  }

  let url: URL
  try {
    // Allow scheme-less `github.com/...` paste by defaulting the scheme.
    url = new URL(/^https?:\/\//.test(trimmed) ? trimmed : `https://${trimmed}`)
  } catch {
    return null
  }

  if (url.hostname !== 'github.com' && url.hostname !== 'www.github.com') return null

  const segments = url.pathname.split('/').filter(Boolean).map(decodeSegment)
  if (segments.length < 2) return null

  const [owner, rawRepo, kind, ...rest] = segments
  const repo = cleanRepo(rawRepo)

  // Repo root: github.com/{owner}/{repo}
  if (!kind) return { owner, repo, subPath: '' }

  // Subdirectory or file: /tree/<ref>/<path...> or /blob/<ref>/<path...>.
  // The ref may itself contain slashes (e.g. `feature/x`), which makes the split
  // ambiguous — we take the first segment as the branch and let the caller fall back
  // to default-branch resolution if the tree fetch 404s.
  if ((kind === 'tree' || kind === 'blob') && rest.length >= 1) {
    const [branch, ...pathParts] = rest
    let subPath = pathParts.join('/')
    // A /blob/ link points at a file; scope to its parent directory.
    if (kind === 'blob' && subPath) {
      const lastSlash = subPath.lastIndexOf('/')
      subPath = lastSlash === -1 ? '' : subPath.slice(0, lastSlash)
    }
    return { owner, repo, branch, subPath }
  }

  // Any other github.com path (issues, pulls, etc.) — treat as the repo root.
  return { owner, repo, subPath: '' }
}
