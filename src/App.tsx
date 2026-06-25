import { useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState } from 'react'
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
import FolderZipOutlinedIcon from '@mui/icons-material/FolderZipOutlined'
import StyleOutlinedIcon from '@mui/icons-material/StyleOutlined'
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
import FileTree from './components/FileTree.tsx'
import LoadFromGitHub from './components/LoadFromGitHub.tsx'
import { SAMPLE } from './sample.ts'
import { initialWorkspace, workspaceReducer, workspaceRepoKey } from './workspace/reducer.ts'
import type { LoadResult } from './github/api.ts'
import { fetchRawFile } from './github/api.ts'
import { exportZip } from './workspace/zip.ts'
import {
  AssetResolverContext,
  identityResolver,
  makeAssetResolver,
  type AssetResolver,
} from './preview/assets.ts'
import { scopeCss } from './preview/css.ts'

const clone = <T,>(v: T): T => structuredClone(v)

type BlocksState = DocBlock[] | null
type BlocksUpdater = BlocksState | ((prev: BlocksState) => BlocksState)

// Each insert option carries a one-line description so the menu explains what the block
// is — not just its name. The icon is the same one the outline / block bar uses, so a
// block is recognisable in the menu before it exists on the page.
const INSERT_GROUPS: Array<{ label: string; items: Array<{ kind: InsertKind; label: string; desc: string }> }> = [
  {
    label: 'Structure',
    items: [
      { kind: 'frontmatter', label: 'Front matter', desc: 'Page metadata: title, description, status' },
      { kind: 'markdown', label: 'Markdown prose', desc: 'Formatted text paragraph' },
      { kind: 'admonition', label: 'Admonition', desc: 'Coloured callout — note, tip, warning…' },
      { kind: 'details', label: 'Details', desc: 'Collapsible disclosure section' },
      { kind: 'tabset', label: 'Content tabs', desc: 'Tabbed panes for alternatives' },
      { kind: 'grid', label: 'Grid cards', desc: 'Card grid for landing pages' },
    ],
  },
  {
    label: 'Technical content',
    items: [
      { kind: 'htmlTable', label: 'Nested HTML table', desc: 'Rich table with blocks in cells (pymdownx)' },
      { kind: 'markdownTable', label: 'Markdown data table', desc: 'Simple pipe table with column alignment' },
      { kind: 'code', label: 'Code block', desc: 'Syntax-highlighted code with title & line numbers' },
      { kind: 'snippet', label: 'Snippet include', desc: 'Embed another file inline (--8<--)' },
    ],
  },
  {
    label: 'Media and actions',
    items: [
      { kind: 'image', label: 'Image', desc: 'Figure with alt text and caption' },
      { kind: 'button', label: 'Button link', desc: 'Link styled as a call-to-action button' },
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

const HEADING_SELECTOR = '.prose h1, .prose h2, .prose h3'

function tocEqual(a: TocEntry[], b: TocEntry[]): boolean {
  return a.length === b.length && a.every((entry, i) =>
    entry.id === b[i].id && entry.text === b[i].text && entry.level === b[i].level,
  )
}

const triggerDownload = (blob: Blob, filename: string) => {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}

export default function App({ mode, onToggleMode }: { mode: Mode; onToggleMode: () => void }) {
  const [ws, dispatch] = useReducer(workspaceReducer, undefined, initialWorkspace)
  const [paste, setPaste] = useState('')
  const [showSource, setShowSource] = useState(false)
  const [preview, setPreview] = useState(false)
  const [insertAnchor, setInsertAnchor] = useState<HTMLElement | null>(null)
  const [exportAnchor, setExportAnchor] = useState<HTMLElement | null>(null)
  const [repoStyles, setRepoStyles] = useState(true)

  const mainRef = useRef<HTMLDivElement | null>(null)
  const contentRef = useRef<HTMLDivElement | null>(null)
  const [toc, setToc] = useState<TocEntry[]>([])
  const [activeHeading, setActiveHeading] = useState<string | null>(null)
  const [activeBlock, setActiveBlock] = useState<number | null>(null)

  const activePath = ws.activePath
  const activeFile = activePath ? ws.files.get(activePath) ?? null : null
  const blocks = activeFile?.history?.present ?? null
  const canUndo = (activeFile?.history?.past.length ?? 0) > 0
  const canRedo = (activeFile?.history?.future.length ?? 0) > 0

  const markdown = useMemo(() => (blocks ? serializeDocument(blocks) : ''), [blocks])

  const assignHeadingIds = useCallback((): HTMLElement[] => {
    const content = contentRef.current
    if (!content) return []
    const headingEls = Array.from(content.querySelectorAll(HEADING_SELECTOR)) as HTMLElement[]
    headingEls.forEach((el, i) => {
      if (!el.id) el.id = `zx-h-${i}`
    })
    return headingEls
  }, [])

  // RichMarkdown uses dangerouslySetInnerHTML. A parent state update can replace that HTML
  // and drop the synthetic heading IDs, so restore them after every render.
  useLayoutEffect(() => {
    assignHeadingIds()
  })

  const scrollToId = useCallback((id: string) => {
    const scroller = mainRef.current
    const el = document.getElementById(id)
    if (!scroller || !el) return
    const marginTop = Number.parseFloat(getComputedStyle(el).scrollMarginTop) || 0
    const targetTop = el.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop
    scroller.scrollTo({ top: Math.max(0, targetTop - marginTop), behavior: 'smooth' })
  }, [])

  // Resolve relative image paths in the preview against the active file's directory on
  // raw.githubusercontent.com. Identity (no rewriting) in paste/single-doc mode.
  const assetResolver = useMemo<AssetResolver>(
    () => (ws.meta && activeFile ? makeAssetResolver(ws.meta, activeFile.path) : identityResolver),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only the path matters, not the file object identity
    [ws.meta, activeFile?.path],
  )

  // The repo's extra_css adapted to style our rendered content (.prose) in both edit and
  // preview, scoped so it never reaches the editor chrome. A synthetic rule wires our
  // prose to the repo's body font (--md-text-font) the way Material's base does.
  const repoStyleCss = useMemo(() => {
    if (!ws.repoCss) return null
    const bodyFont =
      '.zx-repo-css .prose{font-family:var(--md-text-font),-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif}'
    return `${bodyFont}\n${scopeCss(ws.repoCss, '.zx-repo-css')}`
  }, [ws.repoCss])
  const stylesActive = repoStyles && Boolean(repoStyleCss)

  const commitBlocks = useCallback((updater: BlocksUpdater) => {
    if (!activePath) return
    dispatch({ type: 'commit', path: activePath, updater })
  }, [activePath])

  const openDocument = (src: string) => {
    dispatch({ type: 'openSingle', blocks: parseDocument(src) })
  }

  const replaceFromMarkdown = (src: string) => {
    commitBlocks(parseDocument(src))
  }

  const closeDocument = () => {
    if (dirtyCount > 0 && !window.confirm(
      `Discard unsaved edits in ${dirtyCount} file${dirtyCount > 1 ? 's' : ''}? Export a ZIP first to keep them.`,
    )) return
    dispatch({ type: 'reset' })
    setPaste('')
    setPreview(false)
    setShowSource(false)
    setInsertAnchor(null)
  }

  const undo = useCallback(() => {
    if (!activePath) return
    dispatch({ type: 'undo', path: activePath })
  }, [activePath])

  const redo = useCallback(() => {
    if (!activePath) return
    dispatch({ type: 'redo', path: activePath })
  }, [activePath])

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
    const name = activeFile ? activeFile.displayPath.split('/').pop() || 'document.md' : 'document.md'
    triggerDownload(new Blob([markdown], { type: 'text/markdown' }), name)
  }

  // ---- repo workspace ----
  const dirtyCount = useMemo(
    () => [...ws.files.values()].filter((f) => f.dirty).length,
    [ws.files],
  )
  const loadedCount = useMemo(
    () => [...ws.files.values()].filter((f) => f.history).length,
    [ws.files],
  )

  const loadRepo = (res: LoadResult) => {
    setPreview(false)
    setShowSource(false)
    setInsertAnchor(null)
    setRepoStyles(true)
    dispatch({ type: 'loadRepo', meta: res.meta, files: res.files, css: res.css })
  }

  const selectFile = (path: string) => {
    setInsertAnchor(null)
    dispatch({ type: 'setActive', path })
  }

  const exportWorkspaceZip = async (onlyDirty: boolean) => {
    if (!ws.meta) return
    const blob = await exportZip(ws.files, { onlyDirty })
    if (!blob) return
    const label = ws.meta.subPath ? ws.meta.subPath.split('/').pop() : ws.meta.repo
    triggerDownload(blob, `${label || 'docs'}${onlyDirty ? '-edited' : ''}.zip`)
  }

  // Lazily fetch a file's content the first time it is opened (raw host, not rate
  // limited). The in-flight ref dedupes concurrent fetches per repo+path (incl. React
  // StrictMode's double-invoke) without a cleanup that would cancel the very fetch this
  // run starts — dispatching fileLoading changes activeFile and re-triggers this effect,
  // so a cleanup-based guard would abort the request before it ever resolves.
  const inFlight = useRef<Set<string>>(new Set())
  useEffect(() => {
    if (!ws.meta || !activeFile || activeFile.state !== 'unloaded') return
    const path = activeFile.path
    const repoKey = workspaceRepoKey(ws.meta)
    const requestKey = `${repoKey}\0${path}`
    if (inFlight.current.has(requestKey)) return
    const { owner, repo, branch } = ws.meta
    inFlight.current.add(requestKey)
    dispatch({ type: 'fileLoading', path, repoKey })
    fetchRawFile(owner, repo, branch, path)
      .then((markdownText) => dispatch({ type: 'fileLoaded', path, repoKey, markdown: markdownText }))
      .catch((err) => dispatch({ type: 'fileError', path, repoKey, error: (err as Error).message }))
      .finally(() => inFlight.current.delete(requestKey))
  }, [ws.meta, activeFile])

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

  // Collect current headings and wire scroll-spy for both the TOC and the outline.
  useEffect(() => {
    if (!blocks) {
      setToc((prev) => (prev.length ? [] : prev))
      if (activeHeading !== null) setActiveHeading(null)
      if (activeBlock !== null) setActiveBlock(null)
      return
    }

    const content = contentRef.current
    const scroller = mainRef.current
    if (!content || !scroller) {
      setToc((prev) => (prev.length ? [] : prev))
      return
    }

    const headingEls = assignHeadingIds()
    const nextToc = headingEls.map((el) => ({
      id: el.id,
      text: el.textContent?.trim() || 'Untitled',
      level: Number(el.tagName[1]),
    }))
    setToc((prev) => (tocEqual(prev, nextToc) ? prev : nextToc))
    if (!headingEls.length && activeHeading !== null) setActiveHeading(null)

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
  }, [activeBlock, activeHeading, assignHeadingIds, blocks, markdown, toc])

  const bodyClass = showSource ? 'with-source' : toc.length ? '' : 'no-toc'

  return (
    <AssetResolverContext.Provider value={assetResolver}>
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
                        {group.items.map((item) => {
                          const Icon = OUTLINE_ICON[item.kind]
                          return (
                            <MenuItem key={item.kind} className="zx-insert-item" onClick={() => appendBlock(item.kind)}>
                              <Icon className="zx-insert-ico" />
                              <Box className="zx-insert-text">
                                <span className="zx-insert-label">{item.label}</span>
                                <span className="zx-insert-desc">{item.desc}</span>
                              </Box>
                            </MenuItem>
                          )
                        })}
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
              <Tooltip title={ws.mode === 'repo' ? 'Download this file' : 'Download .md'}>
                <IconButton size="small" onClick={download}>
                  <DownloadIcon />
                </IconButton>
              </Tooltip>
            </>
          )}
          {ws.mode === 'repo' && (
            <>
              {ws.repoCss && (
                <Tooltip title={repoStyles ? "Repo styles on — using the site's stylesheets" : 'Repo styles off'}>
                  <IconButton
                    size="small"
                    className={repoStyles ? 'zx-toggle-active' : ''}
                    onClick={() => setRepoStyles((v) => !v)}
                  >
                    <StyleOutlinedIcon />
                  </IconButton>
                </Tooltip>
              )}
              <Button
                size="small"
                variant="outlined"
                startIcon={<FolderZipOutlinedIcon />}
                disabled={loadedCount === 0}
                onClick={(e) => setExportAnchor(e.currentTarget)}
              >
                Export ZIP{dirtyCount > 0 ? ` · ${dirtyCount}` : ''}
              </Button>
              <Menu anchorEl={exportAnchor} open={Boolean(exportAnchor)} onClose={() => setExportAnchor(null)}>
                <MenuItem
                  disabled={dirtyCount === 0}
                  onClick={() => { setExportAnchor(null); void exportWorkspaceZip(true) }}
                >
                  Edited files ({dirtyCount})
                </MenuItem>
                <MenuItem
                  disabled={loadedCount === 0}
                  onClick={() => { setExportAnchor(null); void exportWorkspaceZip(false) }}
                >
                  All opened files ({loadedCount})
                </MenuItem>
              </Menu>
            </>
          )}
          {ws.mode !== 'empty' && (
            <Button size="small" onClick={closeDocument}>Close</Button>
          )}
          <Tooltip title="Toggle light/dark">
            <IconButton size="small" onClick={onToggleMode}>
              {mode === 'dark' ? <LightModeIcon /> : <DarkModeIcon />}
            </IconButton>
          </Tooltip>
        </Toolbar>
      </AppBar>

      {ws.mode === 'empty' ? (
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
              <Button variant="outlined" onClick={() => dispatch({ type: 'openSingle', blocks: [newBlock('frontmatter'), newBlock('markdown')] })}>
                Start blank
              </Button>
              <Button variant="outlined" onClick={() => { setPaste(SAMPLE); openDocument(SAMPLE) }}>
                Load sample
              </Button>
            </Box>
            <LoadFromGitHub onLoaded={loadRepo} />
          </Box>
        </div>
      ) : (
        <div className={`zx-body ${bodyClass}`}>
          <nav className="zx-sidebar zx-sidebar--primary">
            {ws.mode === 'repo' && ws.meta && (
              <>
                {ws.meta.truncated && (
                  <div className="zx-tree-warn">
                    Large repo — the file list may be incomplete.
                  </div>
                )}
                <div className="zx-side-title">
                  Files <span className="zx-side-sub">{ws.meta.owner}/{ws.meta.repo}</span>
                </div>
                <FileTree files={ws.files} activePath={activePath} onSelect={selectFile} />
              </>
            )}
            {blocks && (
              <>
                <div className="zx-side-title">{ws.mode === 'repo' ? 'Outline' : 'Document'}</div>
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
              </>
            )}
          </nav>

          <main className="zx-main" ref={mainRef}>
            {stylesActive && <style>{repoStyleCss}</style>}
            <div
              className={`zx-content${showSource ? ' wide' : ''}${preview ? ' zx-preview' : ''}${stylesActive ? ' zx-repo-css' : ''}`}
              data-md-color-scheme={stylesActive ? (mode === 'dark' ? 'slate' : 'default') : undefined}
              data-md-color-primary={stylesActive ? 'indigo' : undefined}
              data-md-color-accent={stylesActive ? 'indigo' : undefined}
              ref={contentRef}
            >
              {!blocks ? (
                <Box className="empty-doc">
                  {activeFile?.state === 'loading' ? (
                    <Typography variant="body2" sx={{ color: 'var(--muted)' }}>Loading file…</Typography>
                  ) : activeFile?.state === 'error' ? (
                    <Typography variant="body2" color="error">{activeFile.error}</Typography>
                  ) : (
                    <Typography variant="body2" sx={{ color: 'var(--muted)' }}>
                      Select a markdown file from the list to start editing.
                    </Typography>
                  )}
                </Box>
              ) : blocks.length === 0 ? (
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

          {showSource && blocks ? (
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
    </AssetResolverContext.Provider>
  )
}
