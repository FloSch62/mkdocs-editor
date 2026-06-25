// Client-side GitHub access. Two hosts are used:
//   - api.github.com   — REST API for repo metadata + the recursive file tree (rate
//                        limited: 60/hr unauthenticated, 5000/hr with a token).
//   - raw.githubusercontent.com — raw file content (CORS-enabled, NOT rate limited).
// Both send permissive CORS headers, so the app stays fully client-side.

import { parseGitHubUrl } from './url.ts'
import type { RepoMeta, WorkspaceFile } from '../workspace/types.ts'

const API_ROOT = 'https://api.github.com'
const RAW_ROOT = 'https://raw.githubusercontent.com'

export type GitHubErrorKind =
  | 'rate-limit'
  | 'not-found'
  | 'network'
  | 'forbidden'
  | 'bad-url'
  | 'unknown'

export class GitHubError extends Error {
  kind: GitHubErrorKind
  resetAt?: Date
  constructor(kind: GitHubErrorKind, message: string, resetAt?: Date) {
    super(message)
    this.name = 'GitHubError'
    this.kind = kind
    this.resetAt = resetAt
  }
}

export interface TreeEntry {
  path: string
  type: 'blob' | 'tree' | 'commit'
  sha: string
  size?: number
}

// Single fetch wrapper for the JSON API. Adds the recommended headers, an optional
// bearer token, and maps failures to a typed GitHubError.
async function apiRequest(path: string, token?: string): Promise<Response> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  }
  if (token) headers.Authorization = `Bearer ${token}`

  let res: Response
  try {
    res = await fetch(`${API_ROOT}${path}`, { headers })
  } catch (e) {
    throw new GitHubError('network', `Network error reaching GitHub: ${(e as Error).message}`)
  }

  if (res.ok) return res

  if (res.status === 404) {
    throw new GitHubError('not-found', 'Repository, branch, or path not found.')
  }
  if (res.status === 403 || res.status === 429) {
    const remaining = res.headers.get('X-RateLimit-Remaining')
    if (remaining === '0') {
      const reset = res.headers.get('X-RateLimit-Reset')
      const resetAt = reset ? new Date(Number(reset) * 1000) : undefined
      throw new GitHubError(
        'rate-limit',
        'GitHub API rate limit reached.',
        resetAt,
      )
    }
    throw new GitHubError('forbidden', 'GitHub denied the request (403).')
  }
  throw new GitHubError('unknown', `GitHub request failed (${res.status}).`)
}

// GET /repos/{owner}/{repo} → default_branch. Used when the URL has no explicit ref.
export async function fetchDefaultBranch(
  owner: string,
  repo: string,
  token?: string,
): Promise<string> {
  const res = await apiRequest(`/repos/${owner}/${repo}`, token)
  const data = await res.json()
  return data.default_branch as string
}

// GET /repos/{owner}/{repo}/git/trees/{branch}?recursive=1 → the entire file tree.
export async function fetchTree(
  owner: string,
  repo: string,
  branch: string,
  token?: string,
): Promise<{ entries: TreeEntry[]; truncated: boolean }> {
  const res = await apiRequest(
    `/repos/${owner}/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
    token,
  )
  const data = await res.json()
  return { entries: (data.tree ?? []) as TreeEntry[], truncated: Boolean(data.truncated) }
}

// Raw file content. Deliberately unauthenticated: the raw host doesn't need a token,
// isn't rate limited, and an Authorization header can trip its CORS handling.
export async function fetchRawFile(
  owner: string,
  repo: string,
  branch: string,
  path: string,
): Promise<string> {
  const url = `${RAW_ROOT}/${owner}/${repo}/${encodeURIComponent(branch)}/${path
    .split('/')
    .map(encodeURIComponent)
    .join('/')}`
  let res: Response
  try {
    res = await fetch(url)
  } catch (e) {
    throw new GitHubError('network', `Network error fetching file: ${(e as Error).message}`)
  }
  if (res.status === 404) throw new GitHubError('not-found', `File not found: ${path}`)
  if (!res.ok) throw new GitHubError('unknown', `Failed to fetch ${path} (${res.status}).`)
  return res.text()
}

const isMarkdown = (path: string): boolean =>
  path.endsWith('.md') || path.endsWith('.markdown')

// Pull `extra_css` (and `docs_dir`) out of mkdocs.yml with a tolerant line scan rather
// than a real YAML parse — mkdocs configs use Python-specific `!!python/...` tags that
// break standard YAML parsers.
function parseExtraCss(yml: string): { docsDir: string; css: string[] } {
  const lines = yml.replace(/\r\n?/g, '\n').split('\n')
  let docsDir = 'docs'
  const css: string[] = []
  for (let i = 0; i < lines.length; i++) {
    const dm = /^docs_dir:\s*(.+?)\s*$/.exec(lines[i])
    if (dm) docsDir = dm[1].replace(/^["']|["']$/g, '').replace(/\/$/, '')
    if (/^extra_css:\s*$/.test(lines[i])) {
      for (let j = i + 1; j < lines.length; j++) {
        if (lines[j].trim() === '' || /^\s*#/.test(lines[j])) continue
        const im = /^\s*-\s*(.+?)\s*$/.exec(lines[j])
        if (im) css.push(im[1].replace(/^["']|["']$/g, ''))
        else break // dedented to the next top-level key
      }
    }
  }
  return { docsDir, css }
}

async function fetchMkdocsConfig(owner: string, repo: string, branch: string): Promise<string | null> {
  const tryFetch = (name: string) => fetchRawFile(owner, repo, branch, name).catch(() => null)
  // mkdocs.yml is by far the common spelling; fall back to mkdocs.yaml only if absent.
  return (await tryFetch('mkdocs.yml')) ?? (await tryFetch('mkdocs.yaml'))
}

// Fetch and concatenate the repo's extra_css (best effort — returns null if absent).
export async function fetchRepoStyles(
  owner: string,
  repo: string,
  branch: string,
): Promise<string | null> {
  const yml = await fetchMkdocsConfig(owner, repo, branch)
  if (!yml) return null
  const { docsDir, css } = parseExtraCss(yml)
  const local = css.filter((p) => !/^https?:\/\//i.test(p))
  if (local.length === 0) return null
  const texts = await Promise.all(
    local.map((p) => fetchRawFile(owner, repo, branch, `${docsDir}/${p}`).catch(() => '')),
  )
  const combined = texts.filter(Boolean).join('\n\n')
  return combined.trim() ? combined : null
}

export interface LoadResult {
  meta: RepoMeta
  files: WorkspaceFile[]
  // Concatenated repo stylesheets (raw, unscoped) — null when the repo has none.
  css: string | null
}

// Orchestrates a full load: parse the URL, resolve the branch if needed, fetch the
// recursive tree, and return the markdown files (content unfetched — loaded lazily).
export async function loadRepoMarkdown(input: string, token?: string): Promise<LoadResult> {
  const target = parseGitHubUrl(input)
  if (!target) {
    throw new GitHubError('bad-url', 'Not a recognizable GitHub repo URL.')
  }

  const branch = target.branch ?? (await fetchDefaultBranch(target.owner, target.repo, token))
  // Fetch the file tree and the repo stylesheets in parallel (styles are best effort).
  const [{ entries, truncated }, css] = await Promise.all([
    fetchTree(target.owner, target.repo, branch, token),
    fetchRepoStyles(target.owner, target.repo, branch).catch(() => null),
  ])

  const subPath = target.subPath.replace(/\/$/, '')
  const prefix = subPath ? `${subPath}/` : ''

  const files: WorkspaceFile[] = entries
    .filter((e) => e.type === 'blob' && isMarkdown(e.path) && e.path.startsWith(prefix))
    .map((e) => ({
      path: e.path,
      displayPath: prefix ? e.path.slice(prefix.length) : e.path,
      sha: e.sha,
      state: 'unloaded' as const,
      history: null,
      baseline: null,
      dirty: false,
    }))

  if (files.length === 0) {
    throw new GitHubError(
      'not-found',
      subPath
        ? `No markdown files found under "${subPath}".`
        : 'No markdown files found in this repository.',
    )
  }

  return {
    meta: { owner: target.owner, repo: target.repo, branch, subPath, truncated },
    files,
    css,
  }
}
