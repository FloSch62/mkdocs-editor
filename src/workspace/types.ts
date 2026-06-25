import type { DocBlock } from '../blocks.ts'

// Undo/redo history for a single document. Same shape as the original single-document
// reducer in App.tsx — each workspace file now owns one of these.
export interface DocumentHistory {
  past: DocBlock[][]
  present: DocBlock[] | null
  future: DocBlock[][]
}

export type FileLoadState = 'unloaded' | 'loading' | 'loaded' | 'error'

export interface WorkspaceFile {
  // Full repo path — the canonical Map key, e.g. "docs/intro.md".
  path: string
  // Path relative to the loaded subPath — used for the tree display and zip layout.
  displayPath: string
  // Blob sha from the git tree (version marker; not strictly needed yet).
  sha: string
  state: FileLoadState
  error?: string
  // null until the file's content is first fetched and parsed.
  history: DocumentHistory | null
  // Blocks as first parsed from the fetched content — the dirty baseline. null until loaded.
  baseline: DocBlock[] | null
  dirty: boolean
}

export interface RepoMeta {
  owner: string
  repo: string
  branch: string
  subPath: string
  // The git tree API truncates very large repos — surface it so the UI can warn.
  truncated: boolean
}

export type WorkspaceMode = 'empty' | 'single' | 'repo'

export interface WorkspaceState {
  meta: RepoMeta | null
  // Keyed by full path; insertion order follows the git tree order.
  files: Map<string, WorkspaceFile>
  activePath: string | null
  mode: WorkspaceMode
}
