import type { RepoMeta, WorkspaceFile } from '../workspace/types.ts'
import { buildGitHubTreeUrl } from './url.ts'

const REPO_PARAM = 'repo'
const FILE_PARAM = 'file'

export interface SharedRepoState {
  repoUrl: string
  filePath: string | null
}

const cleanPath = (path: string): string => path.trim().replace(/^\/+/, '')

export function parseSharedRepoState(search: string): SharedRepoState | null {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  const repoUrl = params.get(REPO_PARAM)?.trim()
  if (!repoUrl) return null

  const filePath = params.get(FILE_PARAM)
  return {
    repoUrl,
    filePath: filePath ? cleanPath(filePath) || null : null,
  }
}

export function findSharedFile(files: WorkspaceFile[], filePath: string | null): WorkspaceFile | null {
  if (!filePath) return null
  const clean = cleanPath(filePath)
  return files.find((file) => file.displayPath === clean || file.path === clean) ?? null
}

export function buildShareUrl(href: string, meta: RepoMeta, activeFile: WorkspaceFile | null): string {
  const url = new URL(href)
  url.searchParams.set(REPO_PARAM, buildGitHubTreeUrl(meta))
  const filePath = activeFile?.displayPath || activeFile?.path
  if (filePath) url.searchParams.set(FILE_PARAM, filePath)
  else url.searchParams.delete(FILE_PARAM)
  return url.href
}

export function clearShareUrl(href: string): string {
  const url = new URL(href)
  url.searchParams.delete(REPO_PARAM)
  url.searchParams.delete(FILE_PARAM)
  return url.href
}
