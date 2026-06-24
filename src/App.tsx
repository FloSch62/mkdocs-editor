import { useMemo, useState } from 'react'
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
import AutoAwesomeMosaicIcon from '@mui/icons-material/AutoAwesomeMosaic'
import type { Mode } from './main.tsx'
import {
  type DocBlock,
  type InsertKind,
  newBlock,
  parseDocument,
  serializeDocument,
} from './blocks.ts'
import BlockEditor from './BlockEditor.tsx'
import { SAMPLE } from './sample.ts'

const clone = <T,>(v: T): T => structuredClone(v)

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

export default function App({ mode, onToggleMode }: { mode: Mode; onToggleMode: () => void }) {
  const [blocks, setBlocks] = useState<DocBlock[] | null>(null)
  const [paste, setPaste] = useState('')
  const [showSource, setShowSource] = useState(false)
  const [insertAnchor, setInsertAnchor] = useState<HTMLElement | null>(null)

  const markdown = useMemo(() => (blocks ? serializeDocument(blocks) : ''), [blocks])

  const load = (src: string) => setBlocks(parseDocument(src))

  const updateBlock = (i: number, block: DocBlock) =>
    setBlocks((prev) => prev!.map((b, idx) => (idx === i ? block : b)))

  const insertBlockAt = (idx: number, block: DocBlock) =>
    setBlocks((prev) => {
      const next = [...(prev ?? [])]
      next.splice(idx, 0, block)
      return next
    })

  const appendBlock = (kind: InsertKind) => {
    insertBlockAt(blocks?.length ?? 0, newBlock(kind))
    setInsertAnchor(null)
  }

  const duplicateBlock = (idx: number) => setBlocks((prev) => {
    const next = [...prev!]
    next.splice(idx + 1, 0, clone(next[idx]))
    return next
  })

  const deleteBlock = (idx: number) => setBlocks((prev) => prev!.filter((_, i) => i !== idx))

  const moveBlock = (idx: number, dir: -1 | 1) => setBlocks((prev) => {
    const next = [...prev!]
    const target = idx + dir
    if (target < 0 || target >= next.length) return next
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

  return (
    <div className="app-shell">
      <AppBar position="static" color="default" elevation={0} sx={{ borderBottom: '1px solid var(--line)', background: 'var(--sidebar)' }}>
        <Toolbar variant="dense" sx={{ gap: 1 }}>
          <AutoAwesomeMosaicIcon sx={{ color: 'var(--accent)' }} />
          <Typography variant="subtitle1" sx={{ fontWeight: 600, mr: 2 }}>
            MkDocs / Zensical Editor
          </Typography>
          <Typography variant="caption" sx={{ color: 'var(--muted)', flexGrow: 1 }}>
            build Material docs blocks visually, including nested tables
          </Typography>
          {blocks && (
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
              <Tooltip title="Toggle markdown source">
                <IconButton size="small" color={showSource ? 'primary' : 'default'} onClick={() => setShowSource((v) => !v)}>
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
              <Button size="small" onClick={() => { setBlocks(null); setPaste('') }}>Close</Button>
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
              <Button variant="contained" disabled={!paste.trim()} onClick={() => load(paste)}>
                Open in editor
              </Button>
              <Button variant="outlined" onClick={() => setBlocks([newBlock('frontmatter'), newBlock('markdown')])}>
                Start blank
              </Button>
              <Button variant="outlined" onClick={() => { setPaste(SAMPLE); load(SAMPLE) }}>
                Load sample
              </Button>
            </Box>
          </Box>
        </div>
      ) : (
        <div className={`app-body${showSource ? '' : ' single'}`}>
          <div className="pane">
            <div className="pane-title">Visual editor · add blocks from the Insert menu</div>
            <div className="doc">
              {blocks.length === 0 ? (
                <Box className="empty-doc">
                  <Typography variant="body2" sx={{ color: 'var(--muted)' }}>This document is empty.</Typography>
                  <Button sx={{ mt: 1 }} size="small" variant="contained" onClick={() => insertBlockAt(0, newBlock('markdown'))}>
                    Add paragraph
                  </Button>
                </Box>
              ) : (
                blocks.map((block, i) => (
                  <BlockEditor
                    key={i}
                    block={block}
                    index={i}
                    total={blocks.length}
                    onChange={(next) => updateBlock(i, next)}
                    onInsertAfter={() => insertBlockAt(i + 1, newBlock('markdown'))}
                    onDuplicate={() => duplicateBlock(i)}
                    onDelete={() => deleteBlock(i)}
                    onMove={(dir) => moveBlock(i, dir)}
                  />
                ))
              )}
            </div>
          </div>
          {showSource && (
            <div className="pane">
              <div className="pane-title">Markdown source · regenerated on every edit</div>
              <textarea
                className="source"
                value={markdown}
                onChange={(e) => load(e.target.value)}
                spellCheck={false}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
