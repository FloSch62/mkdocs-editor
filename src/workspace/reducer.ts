// The workspace owns many files, each with its own undo/redo history. The single-file
// history machine (lifted unchanged from the original App.tsx) is reused per file; the
// workspace just routes commit/undo/redo to whichever file is active and tracks which
// file is open. Paste/blank/sample documents are modeled as a one-file workspace so the
// editor has exactly one shape to render.

import { parseDocument, serializeDocument, type DocBlock } from '../blocks.ts'
import type {
  DocumentHistory,
  RepoMeta,
  WorkspaceFile,
  WorkspaceState,
} from './types.ts'

export const HISTORY_LIMIT = 100
const SINGLE_PATH = 'document.md'

const clone = <T,>(v: T): T => structuredClone(v)
const snapshot = (blocks: DocBlock[]): DocBlock[] => clone(blocks)

export function sameBlocks(a: DocBlock[] | null, b: DocBlock[] | null): boolean {
  if (a === b) return true
  if (!a || !b) return a === b
  return JSON.stringify(a) === JSON.stringify(b)
}

type BlocksState = DocBlock[] | null
type BlocksUpdater = BlocksState | ((prev: BlocksState) => BlocksState)

type HistoryAction =
  | { type: 'commit'; updater: BlocksUpdater }
  | { type: 'reset'; blocks: BlocksState }
  | { type: 'undo' }
  | { type: 'redo' }

// --- single-document history reducer (unchanged behavior) ---
export function documentHistoryReducer(
  state: DocumentHistory,
  action: HistoryAction,
): DocumentHistory {
  switch (action.type) {
    case 'reset':
      return {
        past: [],
        present: action.blocks ? snapshot(action.blocks) : null,
        future: [],
      }
    case 'commit': {
      const nextValue =
        typeof action.updater === 'function' ? action.updater(state.present) : action.updater
      const next = nextValue ? snapshot(nextValue) : null
      if (sameBlocks(state.present, next)) return state
      if (!state.present || !next) return { past: [], present: next, future: [] }
      return {
        past: [...state.past, snapshot(state.present)].slice(-HISTORY_LIMIT),
        present: next,
        future: [],
      }
    }
    case 'undo': {
      const previous = state.past.at(-1)
      if (!previous || !state.present) return state
      return {
        past: state.past.slice(0, -1),
        present: snapshot(previous),
        future: [snapshot(state.present), ...state.future].slice(0, HISTORY_LIMIT),
      }
    }
    case 'redo': {
      const next = state.future[0]
      if (!next || !state.present) return state
      return {
        past: [...state.past, snapshot(state.present)].slice(-HISTORY_LIMIT),
        present: snapshot(next),
        future: state.future.slice(1),
      }
    }
  }
}

const emptyHistory = (): DocumentHistory => ({ past: [], present: null, future: [] })

export function initialWorkspace(): WorkspaceState {
  return { meta: null, files: new Map(), activePath: null, mode: 'empty' }
}

// --- workspace reducer ---
export type WorkspaceAction =
  // empty/single-document entry points
  | { type: 'reset' }
  | { type: 'openSingle'; blocks: DocBlock[] }
  // repo loading
  | { type: 'loadRepo'; meta: RepoMeta; files: WorkspaceFile[] }
  | { type: 'setActive'; path: string }
  | { type: 'fileLoading'; path: string }
  | { type: 'fileLoaded'; path: string; markdown: string }
  | { type: 'fileError'; path: string; error: string }
  // active-file editing (forwarded to that file's history)
  | { type: 'commit'; path: string; updater: BlocksUpdater }
  | { type: 'undo'; path: string }
  | { type: 'redo'; path: string }

// Replace a single file and return a fresh state (new Map) so React re-renders.
function withFile(
  state: WorkspaceState,
  path: string,
  update: (file: WorkspaceFile) => WorkspaceFile,
): WorkspaceState {
  const current = state.files.get(path)
  if (!current) return state
  const next = update(current)
  if (next === current) return state
  const files = new Map(state.files)
  files.set(path, next)
  return { ...state, files }
}

// Route a history action to the active/target file and refresh its dirty flag.
function applyHistory(
  state: WorkspaceState,
  path: string,
  action: HistoryAction,
): WorkspaceState {
  return withFile(state, path, (file) => {
    if (!file.history) return file
    const history = documentHistoryReducer(file.history, action)
    if (history === file.history) return file
    return { ...file, history, dirty: !sameBlocks(history.present, file.baseline) }
  })
}

export function workspaceReducer(
  state: WorkspaceState,
  action: WorkspaceAction,
): WorkspaceState {
  switch (action.type) {
    case 'reset':
      return initialWorkspace()

    case 'openSingle': {
      const file: WorkspaceFile = {
        path: SINGLE_PATH,
        displayPath: SINGLE_PATH,
        sha: '',
        state: 'loaded',
        history: { past: [], present: snapshot(action.blocks), future: [] },
        baseline: snapshot(action.blocks),
        dirty: false,
      }
      return {
        meta: null,
        files: new Map([[SINGLE_PATH, file]]),
        activePath: SINGLE_PATH,
        mode: 'single',
      }
    }

    case 'loadRepo': {
      const files = new Map<string, WorkspaceFile>()
      for (const f of action.files) files.set(f.path, f)
      return { meta: action.meta, files, activePath: null, mode: 'repo' }
    }

    case 'setActive':
      if (!state.files.has(action.path)) return state
      return { ...state, activePath: action.path }

    case 'fileLoading':
      return withFile(state, action.path, (file) =>
        file.state === 'loaded' || file.state === 'loading'
          ? file
          : { ...file, state: 'loading', error: undefined },
      )

    case 'fileLoaded': {
      const blocks = parseDocument(action.markdown)
      return withFile(state, action.path, (file) => ({
        ...file,
        state: 'loaded',
        error: undefined,
        history: { past: [], present: snapshot(blocks), future: [] },
        baseline: snapshot(blocks),
        dirty: false,
      }))
    }

    case 'fileError':
      return withFile(state, action.path, (file) => ({
        ...file,
        state: 'error',
        error: action.error,
      }))

    case 'commit':
      return applyHistory(state, action.path, { type: 'commit', updater: action.updater })
    case 'undo':
      return applyHistory(state, action.path, { type: 'undo' })
    case 'redo':
      return applyHistory(state, action.path, { type: 'redo' })
  }
}

// Serialize a file's current blocks to markdown (used for download + zip export).
export function fileMarkdown(file: WorkspaceFile): string {
  return file.history?.present ? serializeDocument(file.history.present) : ''
}

export { emptyHistory }
