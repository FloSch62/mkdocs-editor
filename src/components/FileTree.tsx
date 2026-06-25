import { useMemo, useState } from 'react'
import { IconButton, InputAdornment, TextField, Tooltip } from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined'
import ArticleOutlinedIcon from '@mui/icons-material/ArticleOutlined'
import SearchIcon from '@mui/icons-material/Search'
import CloseIcon from '@mui/icons-material/Close'
import UnfoldMoreIcon from '@mui/icons-material/UnfoldMore'
import UnfoldLessIcon from '@mui/icons-material/UnfoldLess'
import type { WorkspaceFile } from '../workspace/types.ts'

// Nested tree built from the flat list of files (keyed by relative displayPath). Folders
// are collapsed by default; open/closed state lives here (not per-folder) so the
// expand/collapse-all control and search can drive every folder at once. Searching
// filters the files and force-opens whatever remains.

interface FolderNode {
  name: string
  path: string // full folder path within the tree, e.g. "apps/aaa"
  folders: Map<string, FolderNode>
  files: WorkspaceFile[]
}

function buildTree(files: Iterable<WorkspaceFile>): FolderNode {
  const root: FolderNode = { name: '', path: '', folders: new Map(), files: [] }
  for (const file of files) {
    const parts = file.displayPath.split('/')
    let node = root
    let acc = ''
    for (const dir of parts.slice(0, -1)) {
      acc = acc ? `${acc}/${dir}` : dir
      let child = node.folders.get(dir)
      if (!child) {
        child = { name: dir, path: acc, folders: new Map(), files: [] }
        node.folders.set(dir, child)
      }
      node = child
    }
    node.files.push(file)
  }
  return root
}

// Every folder path in the tree — used to "expand all" in one shot.
function allFolderPaths(files: Iterable<WorkspaceFile>): Set<string> {
  const set = new Set<string>()
  for (const file of files) {
    const parts = file.displayPath.split('/')
    let acc = ''
    for (let i = 0; i < parts.length - 1; i++) {
      acc = acc ? `${acc}/${parts[i]}` : parts[i]
      set.add(acc)
    }
  }
  return set
}

const byName = (a: { name: string }, b: { name: string }) =>
  a.name.localeCompare(b.name, undefined, { numeric: true })

function FileRow({
  file,
  depth,
  active,
  onSelect,
}: {
  file: WorkspaceFile
  depth: number
  active: boolean
  onSelect: (path: string) => void
}) {
  const name = file.displayPath.split('/').pop() ?? file.displayPath
  return (
    <button
      className={`zx-nav-item zx-tree-file${active ? ' active' : ''}`}
      style={{ paddingLeft: 8 + depth * 14 }}
      onClick={() => onSelect(file.path)}
      title={file.displayPath}
    >
      <ArticleOutlinedIcon className="zx-nav-ico" />
      <span className="zx-nav-label">{name}</span>
      {file.dirty && <span className="zx-dirty-dot" title="Unsaved edits" />}
      {file.state === 'error' && <span className="zx-dirty-dot zx-dirty-dot--error" title={file.error} />}
    </button>
  )
}

function Folder({
  node,
  depth,
  isOpen,
  onToggle,
  activePath,
  onSelect,
}: {
  node: FolderNode
  depth: number
  isOpen: (path: string) => boolean
  onToggle: (path: string) => void
  activePath: string | null
  onSelect: (path: string) => void
}) {
  const folders = useMemo(() => [...node.folders.values()].toSorted(byName), [node.folders])
  const files = useMemo(
    () => node.files.toSorted((a, b) => byName({ name: a.displayPath }, { name: b.displayPath })),
    [node.files],
  )
  // The synthetic root node has no name and is always rendered open.
  const open = node.name ? isOpen(node.path) : true

  return (
    <>
      {node.name && (
        <button
          className="zx-nav-item zx-tree-folder"
          style={{ paddingLeft: 8 + (depth - 1) * 14 }}
          onClick={() => onToggle(node.path)}
        >
          {open ? <ExpandMoreIcon className="zx-tree-caret" /> : <ChevronRightIcon className="zx-tree-caret" />}
          <FolderOutlinedIcon className="zx-nav-ico" />
          <span className="zx-nav-label">{node.name}</span>
        </button>
      )}
      {open && (
        <>
          {folders.map((child) => (
            <Folder
              key={child.path}
              node={child}
              depth={depth + 1}
              isOpen={isOpen}
              onToggle={onToggle}
              activePath={activePath}
              onSelect={onSelect}
            />
          ))}
          {files.map((file) => (
            <FileRow
              key={file.path}
              file={file}
              depth={depth}
              active={file.path === activePath}
              onSelect={onSelect}
            />
          ))}
        </>
      )}
    </>
  )
}

export default function FileTree({
  files,
  activePath,
  onSelect,
}: {
  files: Map<string, WorkspaceFile>
  activePath: string | null
  onSelect: (path: string) => void
}) {
  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set()) // collapsed by default

  const q = query.trim().toLowerCase()
  const searching = q.length > 0

  const fileList = useMemo(() => [...files.values()], [files])
  const allFolders = useMemo(() => allFolderPaths(fileList), [fileList])
  const filtered = useMemo(
    () => (searching ? fileList.filter((f) => f.displayPath.toLowerCase().includes(q)) : fileList),
    [fileList, q, searching],
  )
  const tree = useMemo(() => buildTree(filtered), [filtered])

  const allExpanded = allFolders.size > 0 && expanded.size >= allFolders.size
  const toggleAll = () => setExpanded(allExpanded ? new Set() : new Set(allFolders))
  const toggle = (path: string) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  // While searching, every surviving folder is forced open so matches are visible.
  const isOpen = (path: string) => searching || expanded.has(path)

  return (
    <div className="zx-filetree">
      <div className="zx-tree-tools">
        <TextField
          size="small"
          fullWidth
          placeholder="Filter files…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" sx={{ opacity: 0.6 }} />
                </InputAdornment>
              ),
              endAdornment: query ? (
                <InputAdornment position="end">
                  <IconButton size="small" edge="end" onClick={() => setQuery('')} aria-label="Clear filter">
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </InputAdornment>
              ) : undefined,
            },
          }}
        />
        <Tooltip title={searching ? 'Showing all matches' : allExpanded ? 'Collapse all' : 'Expand all'}>
          <span>
            <IconButton size="small" onClick={toggleAll} disabled={searching}>
              {allExpanded ? <UnfoldLessIcon fontSize="small" /> : <UnfoldMoreIcon fontSize="small" />}
            </IconButton>
          </span>
        </Tooltip>
      </div>

      {filtered.length === 0 ? (
        <div className="zx-tree-empty">No files match “{query.trim()}”.</div>
      ) : (
        <Folder
          node={tree}
          depth={0}
          isOpen={isOpen}
          onToggle={toggle}
          activePath={activePath}
          onSelect={onSelect}
        />
      )}
    </div>
  )
}
