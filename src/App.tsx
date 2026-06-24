import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import {
  AppBar,
  Box,
  Button,
  Divider,
  IconButton,
  ListSubheader,
  Menu,
  MenuItem,
  Toolbar,
  Tooltip,
  Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import LightModeIcon from '@mui/icons-material/LightMode'
import DarkModeIcon from '@mui/icons-material/DarkMode'
import CodeIcon from '@mui/icons-material/Code'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import DownloadIcon from '@mui/icons-material/Download'
import RedoIcon from '@mui/icons-material/Redo'
import UndoIcon from '@mui/icons-material/Undo'
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import ArticleOutlinedIcon from '@mui/icons-material/ArticleOutlined'
import NotesOutlinedIcon from '@mui/icons-material/NotesOutlined'
import TableChartOutlinedIcon from '@mui/icons-material/TableChartOutlined'
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined'
import UnfoldMoreOutlinedIcon from '@mui/icons-material/UnfoldMoreOutlined'
import TabOutlinedIcon from '@mui/icons-material/TabOutlined'
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined'
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined'
import LinkIcon from '@mui/icons-material/Link'
import GridViewOutlinedIcon from '@mui/icons-material/GridViewOutlined'
import RawOnIcon from '@mui/icons-material/RawOn'
import type { SvgIconComponent } from '@mui/icons-material'
import type { Mode } from './main.tsx'
import {
  type DocBlock,
  type InsertKind,
  newBlock,
  parseDocument,
  serializeDocument,
} from './blocks.ts'
import BlockEditor from './BlockEditor.tsx'
import DocPreview from './DocPreview.tsx'
import ZensicalLogo from './ZensicalLogo.tsx'
import { SAMPLE } from './sample.ts'

const clone = <T,>(v: T): T => structuredClone(v)

const HISTORY_LIMIT = 100

type BlocksState = DocBlock[] | null
type BlocksUpdater = BlocksState | ((prev: BlocksState) => BlocksState)

interface DocumentHistory {
  past: DocBlock[][]
  present: BlocksState
  future: DocBlock[][]
}

type HistoryAction =
  | { type: 'commit'; updater: BlocksUpdater }
  | { type: 'reset'; blocks: BlocksState }
  | { type: 'undo' }
  | { type: 'redo' }

const snapshot = (blocks: DocBlock[]): DocBlock[] => clone(blocks)

function sameBlocks(a: BlocksState, b: BlocksState): boolean {
  if (a === b) return true
  if (!a || !b) return a === b
  return JSON.stringify(a) === JSON.stringify(b)
}

function documentHistoryReducer(state: DocumentHistory, action: HistoryAction): DocumentHistory {
  switch (action.type) {
    case 'reset':
      return {
        past: [],
        present: action.blocks ? snapshot(action.blocks) : null,
        future: [],
      }
    case 'commit': {
      const nextValue = typeof action.updater === 'function'
        ? action.updater(state.present)
        : action.updater
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

const INSERT_GROUPS: Array<{ label: string; items: Array<{ kind: InsertKind; label: string }> }> = [
  {
    label: 'Structure',
    items: [
      { kind: 'frontmatter', label: 'Front matter' },
      { kind: 'markdown', label: 'Markdown prose' },
      { kind: 'admonition', label: 'Admonition' },
      { kind: 'details', label: 'Details' },
      { kind: 'tabset', label: 'Content tabs' },
      { kind: 'grid', label: 'Grid cards' },
    ],
  },
  {
    label: 'Technical content',
    items: [
      { kind: 'htmlTable', label: 'Nested HTML table' },
      { kind: 'markdownTable', label: 'Markdown data table' },
      { kind: 'code', label: 'Code block' },
      { kind: 'snippet', label: 'Snippet include' },
    ],
  },
  {
    label: 'Media and actions',
    items: [
      { kind: 'image', label: 'Image' },
      { kind: 'button', label: 'Button link' },
    ],
  },
]

// ---- document outline (left rail) ----
const OUTLINE_ICON: Record<DocBlock['type'], SvgIconComponent> = {
  markdown: NotesOutlinedIcon,
  frontmatter: ArticleOutlinedIcon,
  htmlTable: TableChartOutlinedIcon,
  markdownTable: TableChartOutlinedIcon,
  admonition: WarningAmberOutlinedIcon,
  details: UnfoldMoreOutlinedIcon,
  tabset: TabOutlinedIcon,
  snippet: DescriptionOutlinedIcon,
  code: CodeIcon,
  image: ImageOutlinedIcon,
  button: LinkIcon,
  grid: GridViewOutlinedIcon,
  raw: RawOnIcon,
}

function firstHeading(text: string): string | null {
  const m = text.match(/^#{1,6}\s+(.+?)\s*#*\s*$/m)
  return m ? m[1].replace(/[*`_]/g, '').trim() : null
}
function firstLine(text: string): string {
  const line = text.trim().split('\n').find((l) => l.trim()) ?? ''
  const clean = line.replace(/[#*`_>]/g, '').trim()
  return clean.length > 42 ? `${clean.slice(0, 40)}…` : clean
}

function outlineLabel(block: DocBlock): string {
  switch (block.type) {
    case 'markdown': return firstHeading(block.text) ?? firstLine(block.text) ?? 'Paragraph'
    case 'frontmatter': return String(block.data.title ?? 'Front matter')
    case 'htmlTable': return 'Nested table'
    case 'markdownTable': return 'Data table'
    case 'admonition': return block.title || block.kind
    case 'details': return block.title || 'Details'
    case 'tabset': return block.tabs.map((t) => t.title).filter(Boolean).join(' / ') || 'Tabs'
    case 'snippet': return block.path
    case 'code': return block.title || `Code · ${block.lang || 'text'}`
    case 'image': return block.alt || 'Image'
    case 'button': return block.text || 'Button'
    case 'grid': return 'Grid cards'
    case 'raw': return block.label || 'Raw block'
  }
}

interface TocEntry { id: string; text: string; level: number }

const scrollToId = (id: string) =>
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

export default function App({ mode, onToggleMode }: { mode: Mode; onToggleMode: () => void }) {
  const [history, dispatchHistory] = useReducer(documentHistoryReducer, {
    past: [],
    present: null,
    future: [],
  })
  const [paste, setPaste] = useState('')
  const [showSource, setShowSource] = useState(false)
  const [preview, setPreview] = useState(false)
  const [insertAnchor, setInsertAnchor] = useState<HTMLElement | null>(null)

  const mainRef = useRef<HTMLDivElement | null>(null)
  const contentRef = useRef<HTMLDivElement | null>(null)
  const [toc, setToc] = useState<TocEntry[]>([])
  const [activeHeading, setActiveHeading] = useState<string | null>(null)
  const [activeBlock, setActiveBlock] = useState<number | null>(null)

  const blocks = history.present
  const canUndo = history.past.length > 0
  const canRedo = history.future.length > 0

  const markdown = useMemo(() => (blocks ? serializeDocument(blocks) : ''), [blocks])

  const commitBlocks = useCallback((updater: BlocksUpdater) => {
    dispatchHistory({ type: 'commit', updater })
  }, [])

  const openDocument = (src: string) => {
    dispatchHistory({ type: 'reset', blocks: parseDocument(src) })
  }

  const replaceFromMarkdown = (src: string) => {
    commitBlocks(parseDocument(src))
  }

  const closeDocument = () => {
    dispatchHistory({ type: 'reset', blocks: null })
    setPaste('')
    setPreview(false)
    setShowSource(false)
    setInsertAnchor(null)
  }

  const undo = useCallback(() => {
    dispatchHistory({ type: 'undo' })
  }, [])

  const redo = useCallback(() => {
    dispatchHistory({ type: 'redo' })
  }, [])

  const updateBlock = (i: number, block: DocBlock) =>
    commitBlocks((prev) => prev!.map((b, idx) => (idx === i ? block : b)))

  const insertBlockAt = (idx: number, block: DocBlock) =>
    commitBlocks((prev) => {
      const next = [...(prev ?? [])]
      next.splice(idx, 0, block)
      return next
    })

  const appendBlock = (kind: InsertKind) => {
    insertBlockAt(blocks?.length ?? 0, newBlock(kind))
    setInsertAnchor(null)
  }

  const duplicateBlock = (idx: number) => commitBlocks((prev) => {
    const next = [...prev!]
    next.splice(idx + 1, 0, clone(next[idx]))
    return next
  })

  const deleteBlock = (idx: number) => commitBlocks((prev) => prev!.filter((_, i) => i !== idx))

  const moveBlock = (idx: number, dir: -1 | 1) => commitBlocks((prev) => {
    const next = [...prev!]
    const target = idx + dir
    if (target < 0 || target >= next.length) return prev
    const [item] = next.splice(idx, 1)
    next.splice(target, 0, item)
    return next
  })

  const copy = () => navigator.clipboard?.writeText(markdown)
  const download = () => {
    const blob = new Blob([markdown], { type: 'text/markdown' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'document.md'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  useEffect(() => {
    if (!blocks) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey) return
      const key = event.key.toLowerCase()
      if (key === 'z' && event.shiftKey && canRedo) {
        event.preventDefault()
        redo()
      } else if (key === 'z' && !event.shiftKey && canUndo) {
        event.preventDefault()
        undo()
      } else if (key === 'y' && !event.shiftKey && canRedo) {
        event.preventDefault()
        redo()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [blocks, canRedo, canUndo, redo, undo])

  // Collect the on-page headings and wire scroll-spy for both the TOC and the outline.
  // Re-runs whenever the rendered markdown changes.
  useEffect(() => {
    const content = contentRef.current
    const scroller = mainRef.current
    if (!content || !scroller) { setToc([]); return }

    const headingEls = Array.from(
      content.querySelectorAll('.prose h1, .prose h2, .prose h3'),
    ) as HTMLElement[]
    headingEls.forEach((el, i) => { if (!el.id) el.id = `zx-h-${i}` })
    setToc(headingEls.map((el) => ({
      id: el.id,
      text: el.textContent?.trim() || 'Untitled',
      level: Number(el.tagName[1]),
    })))

    const blockEls = Array.from(content.querySelectorAll('[data-zx-block]')) as HTMLElement[]
    const visibleH = new Set<Element>()
    const visibleB = new Set<Element>()
    const headingObs = new IntersectionObserver((entries) => {
      entries.forEach((e) => (e.isIntersecting ? visibleH.add(e.target) : visibleH.delete(e.target)))
      const top = headingEls.find((el) => visibleH.has(el))
      if (top) setActiveHeading(top.id)
    }, { root: scroller, rootMargin: '-64px 0px -72% 0px', threshold: 0 })
    const blockObs = new IntersectionObserver((entries) => {
      entries.forEach((e) => (e.isIntersecting ? visibleB.add(e.target) : visibleB.delete(e.target)))
      const top = blockEls.find((el) => visibleB.has(el))
      if (top) setActiveBlock(Number(top.dataset.zxBlock))
    }, { root: scroller, rootMargin: '-64px 0px -72% 0px', threshold: 0 })
    headingEls.forEach((el) => headingObs.observe(el))
    blockEls.forEach((el) => blockObs.observe(el))
    return () => { headingObs.disconnect(); blockObs.disconnect() }
  }, [markdown])

  const bodyClass = showSource ? 'with-source' : toc.length ? '' : 'no-toc'

  return (
    <div className="app-shell">
      <AppBar className="zx-header" position="static" elevation={0}>
        <Toolbar variant="dense" sx={{ gap: 1 }}>
          <Box className="zx-brand">
            <ZensicalLogo size={24} className="zx-brand-logo" />
            <Typography variant="subtitle1" className="zx-brand-name">
              Zensical <span className="zx-brand-sep">Editor</span>
            </Typography>
          </Box>
          <Box className="zx-header-spacer" />
          {blocks && (
            <>
              <Button
                size="small"
                variant="outlined"
                className="zx-mode-toggle"
                startIcon={preview ? <EditOutlinedIcon /> : <VisibilityOutlinedIcon />}
                onClick={() => setPreview((v) => !v)}
              >
                {preview ? 'Edit' : 'Preview'}
              </Button>
              <Tooltip title="Undo (Ctrl+Z)">
                <span>
                  <IconButton size="small" disabled={!canUndo} onClick={undo}>
                    <UndoIcon />
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title="Redo (Ctrl+Y / Ctrl+Shift+Z)">
                <span>
                  <IconButton size="small" disabled={!canRedo} onClick={redo}>
                    <RedoIcon />
                  </IconButton>
                </span>
              </Tooltip>
              {!preview && (
                <>
                  <Button size="small" startIcon={<AddIcon />} onClick={(e) => setInsertAnchor(e.currentTarget)}>
                    Insert
                  </Button>
                  <Menu anchorEl={insertAnchor} open={Boolean(insertAnchor)} onClose={() => setInsertAnchor(null)}>
                    {INSERT_GROUPS.map((group, groupIdx) => (
                      <Box key={group.label}>
                        {groupIdx > 0 && <Divider />}
                        <ListSubheader>{group.label}</ListSubheader>
                        {group.items.map((item) => (
                          <MenuItem key={item.kind} onClick={() => appendBlock(item.kind)}>
                            {item.label}
                          </MenuItem>
                        ))}
                      </Box>
                    ))}
                  </Menu>
                </>
              )}
              <Tooltip title="Toggle markdown source">
                <IconButton size="small" className={showSource ? 'zx-toggle-active' : ''} onClick={() => setShowSource((v) => !v)}>
                  <CodeIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Copy markdown">
                <IconButton size="small" onClick={copy}>
                  <ContentCopyIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Download .md">
                <IconButton size="small" onClick={download}>
                  <DownloadIcon />
                </IconButton>
              </Tooltip>
              <Button size="small" onClick={closeDocument}>Close</Button>
            </>
          )}
          <Tooltip title="Toggle light/dark">
            <IconButton size="small" onClick={onToggleMode}>
              {mode === 'dark' ? <LightModeIcon /> : <DarkModeIcon />}
            </IconButton>
          </Tooltip>
        </Toolbar>
      </AppBar>

      {!blocks ? (
        <div className="empty-state">
          <Box sx={{ display: 'grid', gap: 2, justifyItems: 'center' }}>
            <ZensicalLogo size={56} gradient className="empty-logo" />
            <Typography variant="h6">Paste MkDocs / Zensical markdown</Typography>
            <Typography variant="body2" sx={{ color: 'var(--muted)', maxWidth: 640 }}>
              Open an existing page or start from a blank document. Zensical slash blocks,
              classic Material callouts and tabs, Markdown tables, code blocks, snippets,
              images, buttons, front matter, and nested <code>pymdownx.blocks.html</code>
              {' '}tables become editable blocks.
            </Typography>
            <textarea
              className="paste"
              placeholder="# Paste your .md here..."
              value={paste}
              onChange={(e) => setPaste(e.target.value)}
            />
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: 'center' }}>
              <Button variant="contained" disabled={!paste.trim()} onClick={() => openDocument(paste)}>
                Open in editor
              </Button>
              <Button variant="outlined" onClick={() => dispatchHistory({ type: 'reset', blocks: [newBlock('frontmatter'), newBlock('markdown')] })}>
                Start blank
              </Button>
              <Button variant="outlined" onClick={() => { setPaste(SAMPLE); openDocument(SAMPLE) }}>
                Load sample
              </Button>
            </Box>
          </Box>
        </div>
      ) : (
        <div className={`zx-body ${bodyClass}`}>
          <nav className="zx-sidebar zx-sidebar--primary">
            <div className="zx-side-title">Document</div>
            {blocks.map((block, i) => {
              const Icon = OUTLINE_ICON[block.type]
              return (
                <button
                  key={i}
                  className={`zx-nav-item${activeBlock === i ? ' active' : ''}`}
                  onClick={() => scrollToId(`zx-block-${i}`)}
                >
                  <Icon className="zx-nav-ico" />
                  <span className="zx-nav-label">{outlineLabel(block)}</span>
                </button>
              )
            })}
          </nav>

          <main className="zx-main" ref={mainRef}>
            <div className={`zx-content${showSource ? ' wide' : ''}${preview ? ' zx-preview' : ''}`} ref={contentRef}>
              {blocks.length === 0 ? (
                <Box className="empty-doc">
                  <Typography variant="body2" sx={{ color: 'var(--muted)' }}>This document is empty.</Typography>
                  <Button sx={{ mt: 1 }} size="small" variant="contained" onClick={() => insertBlockAt(0, newBlock('markdown'))}>
                    Add paragraph
                  </Button>
                </Box>
              ) : preview ? (
                <DocPreview blocks={blocks} />
              ) : (
                blocks.map((block, i) => (
                  <div key={i} id={`zx-block-${i}`} data-zx-block={i}>
                    <BlockEditor
                      block={block}
                      index={i}
                      total={blocks.length}
                      onChange={(next) => updateBlock(i, next)}
                      onInsertAfter={() => insertBlockAt(i + 1, newBlock('markdown'))}
                      onDuplicate={() => duplicateBlock(i)}
                      onDelete={() => deleteBlock(i)}
                      onMove={(dir) => moveBlock(i, dir)}
                    />
                  </div>
                ))
              )}
            </div>
          </main>

          {showSource ? (
            <div className="zx-source-pane">
              <div className="zx-source-title">Markdown source · regenerated on every edit</div>
              <textarea
                className="source"
                value={markdown}
                onChange={(e) => replaceFromMarkdown(e.target.value)}
                spellCheck={false}
              />
            </div>
          ) : (
            <aside className="zx-sidebar zx-sidebar--secondary">
              <div className="zx-side-title">On this page</div>
              <div className="zx-toc-list">
                {toc.length === 0 ? (
                  <div className="zx-toc-empty">No headings yet</div>
                ) : (
                  toc.map((entry) => (
                    <button
                      key={entry.id}
                      className={`zx-toc-item lvl-${entry.level}${activeHeading === entry.id ? ' active' : ''}`}
                      onClick={() => scrollToId(entry.id)}
                    >
                      {entry.text}
                    </button>
                  ))
                )}
              </div>
            </aside>
          )}
        </div>
      )}
    </div>
  )
}
