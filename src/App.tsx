import { useMemo, useState } from 'react'
import {
  AppBar,
  Box,
  Button,
  IconButton,
  Toolbar,
  Tooltip,
  Typography,
} from '@mui/material'
import LightModeIcon from '@mui/icons-material/LightMode'
import DarkModeIcon from '@mui/icons-material/DarkMode'
import CodeIcon from '@mui/icons-material/Code'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import DownloadIcon from '@mui/icons-material/Download'
import TableChartIcon from '@mui/icons-material/TableChart'
import type { Mode } from './main.tsx'
import {
  type Segment,
  newTable,
  parseDocument,
  serializeDocument,
} from './blocks.ts'
import { IconButton as MuiIconButton } from '@mui/material'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import TableEditor from './TableEditor.tsx'
import RichMarkdown from './RichMarkdown.tsx'
import { SAMPLE } from './sample.ts'

// A prose (non-table) segment: rendered via RichMarkdown (tabs / admonitions / snippet
// includes), with a hover pencil that flips to a raw-markdown textarea. Editing stays raw so
// the segment can hold arbitrary pymdownx blocks we render but don't structurally model.
function MarkdownSegment({ text, onChange }: { text: string; onChange: (t: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(text)
  if (editing) {
    return (
      <textarea
        className="prose-edit"
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => { setEditing(false); onChange(draft) }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { setEditing(false); onChange(draft) }
          if (e.key === 'Escape') { setEditing(false); setDraft(text) }
        }}
      />
    )
  }
  return (
    <div className="seg">
      <MuiIconButton
        className="seg-edit-btn"
        size="small"
        title="Edit markdown"
        onClick={() => { setDraft(text); setEditing(true) }}
      >
        <EditOutlinedIcon sx={{ fontSize: 16 }} />
      </MuiIconButton>
      <RichMarkdown text={text} />
    </div>
  )
}

export default function App({ mode, onToggleMode }: { mode: Mode; onToggleMode: () => void }) {
  const [segments, setSegments] = useState<Segment[] | null>(null)
  const [paste, setPaste] = useState('')
  const [showSource, setShowSource] = useState(false)

  const markdown = useMemo(() => (segments ? serializeDocument(segments) : ''), [segments])

  const load = (src: string) => setSegments(parseDocument(src))

  const updateSegment = (i: number, seg: Segment) =>
    setSegments((prev) => prev!.map((s, idx) => (idx === i ? seg : s)))

  const addTable = () =>
    setSegments((prev) => [...(prev ?? []), { type: 'table', table: newTable() }])

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
      <AppBar position="static" color="default" elevation={0} sx={{ borderBottom: '1px solid var(--line)', background: 'var(--panel)' }}>
        <Toolbar variant="dense" sx={{ gap: 1 }}>
          <TableChartIcon sx={{ color: 'var(--accent)' }} />
          <Typography variant="subtitle1" sx={{ fontWeight: 600, mr: 2 }}>
            MkDocs Table Editor
          </Typography>
          <Typography variant="caption" sx={{ color: 'var(--muted)', flexGrow: 1 }}>
            edit pymdownx blocks-HTML tables visually — no slash-counting
          </Typography>
          {segments && (
            <>
              <Button size="small" startIcon={<TableChartIcon />} onClick={addTable}>New table</Button>
              <Tooltip title="Toggle markdown source">
                <IconButton size="small" color={showSource ? 'primary' : 'default'} onClick={() => setShowSource((v) => !v)}>
                  <CodeIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Copy markdown"><IconButton size="small" onClick={copy}><ContentCopyIcon /></IconButton></Tooltip>
              <Tooltip title="Download .md"><IconButton size="small" onClick={download}><DownloadIcon /></IconButton></Tooltip>
              <Button size="small" onClick={() => { setSegments(null); setPaste('') }}>Close</Button>
            </>
          )}
          <Tooltip title="Toggle light/dark">
            <IconButton size="small" onClick={onToggleMode}>
              {mode === 'dark' ? <LightModeIcon /> : <DarkModeIcon />}
            </IconButton>
          </Tooltip>
        </Toolbar>
      </AppBar>

      {!segments ? (
        <div className="empty-state">
          <Box sx={{ display: 'grid', gap: 2, justifyItems: 'center' }}>
            <Typography variant="h6">Paste MkDocs / Zensical markdown</Typography>
            <Typography variant="body2" sx={{ color: 'var(--muted)', maxWidth: 560 }}>
              Including <code>pymdownx.blocks.html</code> tables — the nested{' '}
              <code>{'/// html | table'}</code> kind. They become an editable grid;
              everything else round-trips as plain markdown.
            </Typography>
            <textarea
              className="paste"
              placeholder="# Paste your .md here…"
              value={paste}
              onChange={(e) => setPaste(e.target.value)}
            />
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button variant="contained" disabled={!paste.trim()} onClick={() => load(paste)}>
                Open in editor
              </Button>
              <Button variant="outlined" onClick={() => { setPaste(SAMPLE); load(SAMPLE) }}>
                Load EDAADM sample
              </Button>
            </Box>
          </Box>
        </div>
      ) : (
        <div className={`app-body${showSource ? '' : ' single'}`}>
          <div className="pane">
            <div className="pane-title">Preview · click any cell or paragraph to edit</div>
            <div className="doc">
              {segments.map((seg, i) =>
                seg.type === 'md' ? (
                  <MarkdownSegment key={i} text={seg.text} onChange={(t) => updateSegment(i, { type: 'md', text: t })} />
                ) : (
                  <TableEditor key={i} table={seg.table} onChange={(t) => updateSegment(i, { type: 'table', table: t })} />
                ),
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
