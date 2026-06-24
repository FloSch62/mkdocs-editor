import { useRef, useState, type ReactNode } from 'react'
import {
  Box,
  Button,
  Chip,
  Divider,
  FormControlLabel,
  IconButton,
  MenuItem,
  Paper,
  Select,
  Switch,
  Tab,
  Tabs,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import ArticleOutlinedIcon from '@mui/icons-material/ArticleOutlined'
import CodeIcon from '@mui/icons-material/Code'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlineOutlined'
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined'
import FormatAlignCenterIcon from '@mui/icons-material/FormatAlignCenter'
import FormatAlignLeftIcon from '@mui/icons-material/FormatAlignLeft'
import FormatAlignRightIcon from '@mui/icons-material/FormatAlignRight'
import FormatBoldIcon from '@mui/icons-material/FormatBold'
import FormatItalicIcon from '@mui/icons-material/FormatItalic'
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted'
import GridViewOutlinedIcon from '@mui/icons-material/GridViewOutlined'
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined'
import InsertLinkIcon from '@mui/icons-material/InsertLink'
import KeyboardIcon from '@mui/icons-material/Keyboard'
import LinkIcon from '@mui/icons-material/Link'
import NotesOutlinedIcon from '@mui/icons-material/NotesOutlined'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import RawOnIcon from '@mui/icons-material/RawOn'
import SplitscreenOutlinedIcon from '@mui/icons-material/SplitscreenOutlined'
import TableChartOutlinedIcon from '@mui/icons-material/TableChartOutlined'
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined'
import type { SvgIconComponent } from '@mui/icons-material'
import {
  ADMONITION_KINDS,
  type Align,
  type DocBlock,
  type FrontMatterData,
  type GridCard,
  type MarkdownTable,
  type TabItem,
  newMarkdownTable,
  serializeDocument,
} from './blocks.ts'
import RichMarkdown from './RichMarkdown.tsx'
import { ADMONITION } from './admonitions.ts'
import TableEditor from './TableEditor.tsx'

const clone = <T,>(v: T): T => structuredClone(v)

function firstLine(text: string): string {
  const line = text.trim().split('\n')[0] ?? ''
  return line.length > 58 ? `${line.slice(0, 55)}...` : line
}

function blockTitle(block: DocBlock): { title: string; detail: string; Icon: SvgIconComponent } {
  switch (block.type) {
    case 'markdown':
      return { title: 'Markdown', detail: firstLine(block.text) || 'prose', Icon: NotesOutlinedIcon }
    case 'frontmatter':
      return { title: 'Front matter', detail: String(block.data.title ?? block.data.description ?? ''), Icon: ArticleOutlinedIcon }
    case 'htmlTable':
      return { title: 'Nested HTML table', detail: 'pymdownx.blocks.html', Icon: TableChartOutlinedIcon }
    case 'markdownTable':
      return { title: 'Data table', detail: `${block.table.headers.length} columns`, Icon: TableChartOutlinedIcon }
    case 'admonition':
      return { title: 'Admonition', detail: `${block.kind}${block.title ? ` · ${block.title}` : ''}`, Icon: WarningAmberOutlinedIcon }
    case 'details':
      return { title: 'Details', detail: block.title, Icon: SplitscreenOutlinedIcon }
    case 'tabset':
      return { title: 'Tabs', detail: block.tabs.map((t) => t.title).join(', '), Icon: SplitscreenOutlinedIcon }
    case 'snippet':
      return { title: 'Snippet include', detail: block.path, Icon: DescriptionOutlinedIcon }
    case 'code':
      return { title: 'Code block', detail: block.lang || 'plain text', Icon: CodeIcon }
    case 'image':
      return { title: 'Image', detail: block.src, Icon: ImageOutlinedIcon }
    case 'button':
      return { title: 'Button', detail: block.text, Icon: LinkIcon }
    case 'grid':
      return { title: 'Grid cards', detail: `${block.cards.length} cards`, Icon: GridViewOutlinedIcon }
    case 'raw':
      return { title: 'Raw block', detail: block.label, Icon: RawOnIcon }
  }
}

function BlockShell({
  block,
  children,
  isFirst,
  isLast,
  previewable,
  editing,
  onToggleEdit,
  onChange,
  onInsertAfter,
  onDuplicate,
  onDelete,
  onMove,
}: {
  block: DocBlock
  children: ReactNode
  isFirst: boolean
  isLast: boolean
  previewable: boolean
  editing: boolean
  onToggleEdit: () => void
  onChange: (b: DocBlock) => void
  onInsertAfter: () => void
  onDuplicate: () => void
  onDelete: () => void
  onMove: (dir: -1 | 1) => void
}) {
  const { title, detail, Icon } = blockTitle(block)
  const showForm = !previewable || editing
  return (
    <Paper variant="outlined" className={`block-card block-${block.type} ${showForm ? 'mode-form' : 'mode-preview'}${editing ? ' is-editing' : ''}`}>
      <Box className="block-bar">
        <Icon sx={{ fontSize: 18, color: 'var(--accent)' }} />
        <Box sx={{ minWidth: 0, flexGrow: 1 }}>
          <Box className="block-title">{title}</Box>
          {detail && <Box className="block-detail">{detail}</Box>}
        </Box>
        {previewable && (
          <Button
            size="small"
            className="block-edit-toggle"
            startIcon={editing ? <VisibilityOutlinedIcon sx={{ fontSize: 16 }} /> : <EditOutlinedIcon sx={{ fontSize: 16 }} />}
            onClick={onToggleEdit}
          >
            {editing ? 'Done' : 'Edit'}
          </Button>
        )}
        {block.type !== 'raw' && (
          <Tooltip title="Convert this block to raw Markdown">
            <IconButton size="small" onClick={() => onChange({ type: 'raw', label: title.toLowerCase(), text: serializeDocument([block]) })}>
              <RawOnIcon sx={{ fontSize: 17 }} />
            </IconButton>
          </Tooltip>
        )}
        <Tooltip title="Add paragraph after">
          <IconButton size="small" onClick={onInsertAfter}>
            <AddIcon sx={{ fontSize: 17 }} />
          </IconButton>
        </Tooltip>
        <Tooltip title="Duplicate">
          <IconButton size="small" onClick={onDuplicate}>
            <ContentCopyIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
        <Tooltip title="Move up">
          <span>
            <IconButton size="small" disabled={isFirst} onClick={() => onMove(-1)}>
              <ArrowUpwardIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Move down">
          <span>
            <IconButton size="small" disabled={isLast} onClick={() => onMove(1)}>
              <ArrowDownwardIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Delete">
          <IconButton size="small" onClick={onDelete}>
            <DeleteOutlineIcon sx={{ fontSize: 17 }} />
          </IconButton>
        </Tooltip>
      </Box>
      <Box className="block-body">{children}</Box>
    </Paper>
  )
}

function MarkdownMiniEditor({
  value,
  onChange,
  label = 'Markdown',
  minRows = 5,
}: {
  value: string
  onChange: (v: string) => void
  label?: string
  minRows?: number
}) {
  const ref = useRef<HTMLTextAreaElement | null>(null)

  const replaceSelection = (before: string, after = before, fallback = 'text') => {
    const el = ref.current
    if (!el) {
      onChange(`${value}${before}${fallback}${after}`)
      return
    }
    const start = el.selectionStart
    const end = el.selectionEnd
    const selected = value.slice(start, end) || fallback
    const next = `${value.slice(0, start)}${before}${selected}${after}${value.slice(end)}`
    onChange(next)
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(start + before.length, start + before.length + selected.length)
    })
  }

  const insertLine = (prefix: string, sample: string) => {
    const el = ref.current
    const start = el?.selectionStart ?? value.length
    const before = value.slice(0, start)
    const needsBreak = before && !before.endsWith('\n') ? '\n' : ''
    const next = `${before}${needsBreak}${prefix}${sample}${value.slice(start)}`
    onChange(next)
    requestAnimationFrame(() => ref.current?.focus())
  }

  return (
    <Box className="mini-editor">
      <Box className="mini-toolbar">
        <Box className="mini-label">{label}</Box>
        <Tooltip title="Bold">
          <IconButton size="small" onClick={() => replaceSelection('**')}>
            <FormatBoldIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
        <Tooltip title="Italic">
          <IconButton size="small" onClick={() => replaceSelection('_')}>
            <FormatItalicIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
        <Tooltip title="Inline code">
          <IconButton size="small" onClick={() => replaceSelection('`')}>
            <CodeIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
        <Tooltip title="Link">
          <IconButton size="small" onClick={() => replaceSelection('[', '](https://example.com)', 'label')}>
            <InsertLinkIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
        <Tooltip title="Highlight">
          <IconButton size="small" onClick={() => replaceSelection('==')}>
            <RawOnIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
        <Tooltip title="Keyboard key">
          <IconButton size="small" onClick={() => replaceSelection('++', '++', 'ctrl+c')}>
            <KeyboardIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
        <Tooltip title="Bullet list">
          <IconButton size="small" onClick={() => insertLine('- ', 'List item')}>
            <FormatListBulletedIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
      </Box>
      <textarea
        ref={ref}
        className="mini-md"
        rows={minRows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
      />
    </Box>
  )
}

function FieldGrid({ children }: { children: ReactNode }) {
  return <Box className="field-grid">{children}</Box>
}

// Icon + label for the admonition kind dropdown — same icon/colour the rendered callout uses.
function AdmonitionOption({ kind }: { kind: string }) {
  const meta = ADMONITION[kind] ?? ADMONITION.note
  const Ico = meta.Icon
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
      <Ico sx={{ fontSize: 18, color: meta.color, flexShrink: 0 }} />
      <span style={{ textTransform: 'capitalize', overflow: 'hidden', textOverflow: 'ellipsis' }}>{kind}</span>
    </Box>
  )
}

// Serialize a block for preview, coercing slash-block syntax so RichMarkdown can render it
// (it understands `///` blocks, not the classic `!!!` / `===` forms).
function previewMarkdown(block: DocBlock): string {
  let b: DocBlock = 'syntax' in block ? { ...block, syntax: 'zensical' } : block
  // a collapsible admonition serializes to classic `???` syntax, which RichMarkdown can't
  // render — show it as a static callout in the preview instead.
  if (b.type === 'admonition') b = { ...b, collapse: 'none' }
  return serializeDocument([b])
}

// Blocks that render their published docs output by default and reveal a form on Edit.
const PREVIEWABLE = new Set<DocBlock['type']>(['markdown', 'admonition', 'details', 'tabset', 'code'])
// Of those, the ones with no internal interactivity can also be clicked anywhere to edit;
// tabs / details stay clickable for their own controls, so they edit via the toolbar button.
const CLICK_TO_EDIT = new Set<DocBlock['type']>(['markdown', 'admonition', 'code'])

// Rendered docs output for a previewable block. Click-to-edit where it won't fight the
// block's own controls; otherwise the toolbar Edit button is the way in.
function RenderedPreview({ block, onEdit }: { block: DocBlock; onEdit: () => void }) {
  const md = previewMarkdown(block)
  const body = md.trim()
    ? <RichMarkdown text={md} />
    : <Box sx={{ color: 'var(--muted)', fontStyle: 'italic' }}>Empty {block.type} — choose Edit to add content</Box>
  if (CLICK_TO_EDIT.has(block.type)) {
    return (
      <Box className="render-preview">
        <Box
          className="zx-prose-block"
          role="button"
          tabIndex={0}
          onClick={onEdit}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onEdit() } }}
        >
          <span className="zx-edit-hint"><EditOutlinedIcon sx={{ fontSize: 12 }} /> Edit</span>
          {body}
        </Box>
      </Box>
    )
  }
  return <Box className="render-preview zx-render-first">{body}</Box>
}

function FrontmatterEditor({ block, onChange }: { block: Extract<DocBlock, { type: 'frontmatter' }>; onChange: (b: DocBlock) => void }) {
  const set = (key: string, value: unknown) => {
    const data: FrontMatterData = { ...block.data, [key]: value }
    onChange({ ...block, data })
  }
  const hide = Array.isArray(block.data.hide) ? block.data.hide.join(', ') : String(block.data.hide ?? '')
  return (
    <>
      <FieldGrid>
        <TextField size="small" label="Title" value={String(block.data.title ?? '')} onChange={(e) => set('title', e.target.value)} />
        <TextField size="small" label="Description" value={String(block.data.description ?? '')} onChange={(e) => set('description', e.target.value)} />
        <TextField size="small" label="Icon" value={String(block.data.icon ?? '')} onChange={(e) => set('icon', e.target.value)} placeholder="lucide/braces" />
        <TextField size="small" label="Status" value={String(block.data.status ?? '')} onChange={(e) => set('status', e.target.value)} placeholder="new" />
        <TextField size="small" label="Template" value={String(block.data.template ?? '')} onChange={(e) => set('template', e.target.value)} />
        <TextField
          size="small"
          label="Hide"
          value={hide}
          onChange={(e) => set('hide', e.target.value.split(',').map((v) => v.trim()).filter(Boolean))}
          placeholder="navigation, toc"
        />
      </FieldGrid>
      <Box className="hint-line">Unknown front matter keys are preserved; edit them in the source pane when needed.</Box>
    </>
  )
}

function MarkdownTableEditor({ table, onChange }: { table: MarkdownTable; onChange: (t: MarkdownTable) => void }) {
  const cols = Math.max(1, table.headers.length, ...table.rows.map((r) => r.length))
  const mutate = (fn: (t: MarkdownTable) => void) => {
    const next = clone(table)
    while (next.headers.length < cols) next.headers.push('')
    while (next.aligns.length < cols) next.aligns.push('left')
    for (const row of next.rows) while (row.length < cols) row.push('')
    fn(next)
    onChange(next)
  }
  const setCell = (r: number, c: number, value: string) => mutate((t) => { t.rows[r][c] = value })
  const addRow = () => mutate((t) => t.rows.push(Array.from({ length: cols }, () => '')))
  const addColumn = () => mutate((t) => {
    t.headers.push('Column')
    t.aligns.push('left')
    for (const row of t.rows) row.push('')
  })
  const deleteColumn = (idx: number) => mutate((t) => {
    if (t.headers.length <= 1) return
    t.headers.splice(idx, 1)
    t.aligns.splice(idx, 1)
    for (const row of t.rows) row.splice(idx, 1)
  })
  const deleteRow = (idx: number) => mutate((t) => t.rows.splice(idx, 1))
  const rows = table.rows.length ? table.rows : [['', '']]
  return (
    <Paper variant="outlined" className="tbl-card md-table-card">
      <Box className="tbl-bar">
        <TableChartOutlinedIcon sx={{ fontSize: 16, color: 'var(--accent)' }} />
        <Box sx={{ flexGrow: 1, fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>markdown data table</Box>
        <Button size="small" onClick={addColumn}>Column</Button>
        <Button size="small" onClick={addRow}>Row</Button>
      </Box>
      <Box sx={{ overflowX: 'auto' }}>
        <table className="tbl">
          <thead>
            <tr>
              <th className="gutter" />
              {Array.from({ length: cols }, (_, c) => (
                <th key={c}>
                  <Box className="cell">
                    <TextField
                      fullWidth
                      size="small"
                      value={table.headers[c] ?? ''}
                      onChange={(e) => mutate((t) => { t.headers[c] = e.target.value })}
                    />
                    <Box className="cell-foot force-visible">
                      <ToggleButtonGroup
                        size="small"
                        exclusive
                        value={table.aligns[c] ?? 'left'}
                        onChange={(_alignEvent, v: Align | null) => v && mutate((t) => { t.aligns[c] = v })}
                      >
                        <ToggleButton value="left"><FormatAlignLeftIcon sx={{ fontSize: 15 }} /></ToggleButton>
                        <ToggleButton value="center"><FormatAlignCenterIcon sx={{ fontSize: 15 }} /></ToggleButton>
                        <ToggleButton value="right"><FormatAlignRightIcon sx={{ fontSize: 15 }} /></ToggleButton>
                      </ToggleButtonGroup>
                      {cols > 1 && (
                        <Tooltip title="Delete column">
                          <IconButton size="small" onClick={() => deleteColumn(c)}>
                            <DeleteOutlineIcon sx={{ fontSize: 16 }} />
                          </IconButton>
                        </Tooltip>
                      )}
                    </Box>
                  </Box>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, r) => (
              <tr key={r}>
                <td className="gutter">
                  <Tooltip title="Delete row">
                    <IconButton size="small" onClick={() => deleteRow(r)}>
                      <DeleteOutlineIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Tooltip>
                </td>
                {Array.from({ length: cols }, (_, c) => (
                  <td key={c}>
                    <Box className="cell">
                      <TextField
                        fullWidth
                        multiline
                        size="small"
                        value={row[c] ?? ''}
                        onChange={(e) => setCell(r, c, e.target.value)}
                      />
                    </Box>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </Box>
    </Paper>
  )
}

function TabsEditor({ block, onChange }: { block: Extract<DocBlock, { type: 'tabset' }>; onChange: (b: DocBlock) => void }) {
  const [active, setActive] = useState(0)
  const idx = Math.min(active, Math.max(block.tabs.length - 1, 0))
  const current = block.tabs[idx] ?? { title: 'Tab', body: '' }
  const updateTab = (patch: Partial<TabItem>) => {
    const tabs = block.tabs.length ? clone(block.tabs) : [{ title: 'Tab', body: '' }]
    tabs[idx] = { ...tabs[idx], ...patch }
    onChange({ ...block, tabs })
  }
  const add = () => {
    const tabs = [...block.tabs, { title: `Tab ${block.tabs.length + 1}`, body: 'Tab content.' }]
    onChange({ ...block, tabs })
    setActive(tabs.length - 1)
  }
  const remove = () => {
    const tabs = block.tabs.filter((_, i) => i !== idx)
    onChange({ ...block, tabs: tabs.length ? tabs : [{ title: 'Tab', body: '' }] })
    setActive(Math.max(0, idx - 1))
  }
  return (
    <>
      <Box className="inline-row">
        <Select size="small" value={block.syntax} onChange={(e) => onChange({ ...block, syntax: e.target.value as 'zensical' | 'classic' })}>
          <MenuItem value="zensical">Zensical slash blocks</MenuItem>
          <MenuItem value="classic">Classic Material tabs</MenuItem>
        </Select>
        <Button size="small" startIcon={<AddIcon />} onClick={add}>Tab</Button>
        <Button size="small" startIcon={<DeleteOutlineIcon />} onClick={remove}>Delete tab</Button>
      </Box>
      <Tabs value={idx} onChange={(_tabEvent, v) => setActive(v)} variant="scrollable" scrollButtons="auto" sx={{ minHeight: 38 }}>
        {block.tabs.map((tab, i) => <Tab key={i} label={tab.title || `Tab ${i + 1}`} sx={{ minHeight: 38, textTransform: 'none' }} />)}
      </Tabs>
      <TextField sx={{ mt: 1 }} fullWidth size="small" label="Tab label" value={current.title} onChange={(e) => updateTab({ title: e.target.value })} />
      <MarkdownMiniEditor label="Tab content" value={current.body} onChange={(body) => updateTab({ body })} />
    </>
  )
}

function GridEditor({ block, onChange }: { block: Extract<DocBlock, { type: 'grid' }>; onChange: (b: DocBlock) => void }) {
  const [active, setActive] = useState(0)
  const idx = Math.min(active, Math.max(block.cards.length - 1, 0))
  const card = block.cards[idx] ?? { title: 'Card', href: '', body: '' }
  const updateCard = (patch: Partial<GridCard>) => {
    const cards = block.cards.length ? clone(block.cards) : [{ title: 'Card', href: '', body: '' }]
    cards[idx] = { ...cards[idx], ...patch }
    onChange({ ...block, cards })
  }
  const add = () => {
    const cards = [...block.cards, { title: `Card ${block.cards.length + 1}`, href: '', body: 'Card body.' }]
    onChange({ ...block, cards })
    setActive(cards.length - 1)
  }
  const remove = () => {
    const cards = block.cards.filter((_, i) => i !== idx)
    onChange({ ...block, cards: cards.length ? cards : [{ title: 'Card', href: '', body: '' }] })
    setActive(Math.max(0, idx - 1))
  }
  return (
    <>
      <Box className="inline-row">
        <Button size="small" startIcon={<AddIcon />} onClick={add}>Card</Button>
        <Button size="small" startIcon={<DeleteOutlineIcon />} onClick={remove}>Delete card</Button>
      </Box>
      <Tabs value={idx} onChange={(_gridEvent, v) => setActive(v)} variant="scrollable" scrollButtons="auto" sx={{ minHeight: 38 }}>
        {block.cards.map((c, i) => <Tab key={i} label={c.title || `Card ${i + 1}`} sx={{ minHeight: 38, textTransform: 'none' }} />)}
      </Tabs>
      <FieldGrid>
        <TextField size="small" label="Title" value={card.title} onChange={(e) => updateCard({ title: e.target.value })} />
        <TextField size="small" label="Link" value={card.href} onChange={(e) => updateCard({ href: e.target.value })} />
      </FieldGrid>
      <MarkdownMiniEditor label="Card body" value={card.body} onChange={(body) => updateCard({ body })} />
    </>
  )
}

function blockEditorBody(block: DocBlock, onChange: (b: DocBlock) => void): ReactNode {
  switch (block.type) {
    case 'markdown':
      return <MarkdownMiniEditor value={block.text} onChange={(text) => onChange({ ...block, text })} />
    case 'frontmatter':
      return <FrontmatterEditor block={block} onChange={onChange} />
    case 'htmlTable':
      return <TableEditor table={block.table} onChange={(table) => onChange({ ...block, table })} />
    case 'markdownTable':
      return <MarkdownTableEditor table={block.table} onChange={(table) => onChange({ ...block, table })} />
    case 'admonition':
      return (
        <>
          <FieldGrid>
            <Select
              size="small"
              value={block.kind}
              onChange={(e) => onChange({ ...block, kind: e.target.value })}
              renderValue={(k) => <AdmonitionOption kind={k} />}
            >
              {ADMONITION_KINDS.map((k) => (
                <MenuItem key={k} value={k}><AdmonitionOption kind={k} /></MenuItem>
              ))}
            </Select>
            <TextField size="small" label="Title" value={block.title} onChange={(e) => onChange({ ...block, title: e.target.value })} />
            <Select size="small" value={block.syntax} onChange={(e) => onChange({ ...block, syntax: e.target.value as 'zensical' | 'classic' })}>
              <MenuItem value="zensical">Zensical slash block</MenuItem>
              <MenuItem value="classic">Classic Material</MenuItem>
            </Select>
            <Select size="small" value={block.collapse} onChange={(e) => onChange({ ...block, collapse: e.target.value as typeof block.collapse })}>
              <MenuItem value="none">Static</MenuItem>
              <MenuItem value="closed">Collapsible closed</MenuItem>
              <MenuItem value="open">Collapsible open</MenuItem>
            </Select>
          </FieldGrid>
          <MarkdownMiniEditor label="Admonition content" value={block.body} onChange={(body) => onChange({ ...block, body })} />
        </>
      )
    case 'details':
      return (
        <>
          <FieldGrid>
            <TextField size="small" label="Summary" value={block.title} onChange={(e) => onChange({ ...block, title: e.target.value })} />
            <FormControlLabel control={<Switch checked={block.open} onChange={(e) => onChange({ ...block, open: e.target.checked })} />} label="Open by default" />
          </FieldGrid>
          <MarkdownMiniEditor label="Details content" value={block.body} onChange={(body) => onChange({ ...block, body })} />
        </>
      )
    case 'tabset':
      return <TabsEditor block={block} onChange={onChange} />
    case 'snippet':
      return (
        <>
          <TextField fullWidth size="small" label="Included file path" value={block.path} onChange={(e) => onChange({ ...block, path: e.target.value })} />
          <Chip sx={{ mt: 1 }} size="small" icon={<DescriptionOutlinedIcon />} label={block.path} variant="outlined" />
        </>
      )
    case 'code':
      return (
        <>
          <FieldGrid>
            <TextField size="small" label="Language" value={block.lang} onChange={(e) => onChange({ ...block, lang: e.target.value })} />
            <TextField size="small" label="Title" value={block.title} onChange={(e) => onChange({ ...block, title: e.target.value })} />
            <TextField size="small" label="Highlighted lines" value={block.highlight} onChange={(e) => onChange({ ...block, highlight: e.target.value })} placeholder="1 3-5" />
            <TextField size="small" label="Extra attrs" value={block.attrs} onChange={(e) => onChange({ ...block, attrs: e.target.value })} />
          </FieldGrid>
          <Box className="inline-row">
            <FormControlLabel control={<Switch checked={block.copy} onChange={(e) => onChange({ ...block, copy: e.target.checked })} />} label="Copy" />
            <FormControlLabel control={<Switch checked={block.select} onChange={(e) => onChange({ ...block, select: e.target.checked })} />} label="Select" />
            <FormControlLabel control={<Switch checked={block.lineNumbers} onChange={(e) => onChange({ ...block, lineNumbers: e.target.checked })} />} label="Line numbers" />
          </Box>
          <textarea className="code-edit" value={block.body} onChange={(e) => onChange({ ...block, body: e.target.value })} spellCheck={false} />
        </>
      )
    case 'image':
      return (
        <>
          <FieldGrid>
            <TextField size="small" label="Alt text" value={block.alt} onChange={(e) => onChange({ ...block, alt: e.target.value })} />
            <TextField size="small" label="Source" value={block.src} onChange={(e) => onChange({ ...block, src: e.target.value })} />
            <TextField size="small" label="Title" value={block.title} onChange={(e) => onChange({ ...block, title: e.target.value })} />
            <TextField size="small" label="Caption" value={block.caption} onChange={(e) => onChange({ ...block, caption: e.target.value })} />
          </FieldGrid>
          <Box className="image-preview">
            <ImageOutlinedIcon sx={{ fontSize: 26 }} />
            <Box sx={{ minWidth: 0 }}>
              <Box>{block.alt || 'Image'}</Box>
              <Box className="block-detail">{block.src}</Box>
            </Box>
          </Box>
        </>
      )
    case 'button':
      return (
        <>
          <FieldGrid>
            <TextField size="small" label="Label" value={block.text} onChange={(e) => onChange({ ...block, text: e.target.value })} />
            <TextField size="small" label="Link" value={block.href} onChange={(e) => onChange({ ...block, href: e.target.value })} />
            <FormControlLabel control={<Switch checked={block.primary} onChange={(e) => onChange({ ...block, primary: e.target.checked })} />} label="Primary" />
          </FieldGrid>
          <Button sx={{ mt: 1 }} variant={block.primary ? 'contained' : 'outlined'} endIcon={<OpenInNewIcon />} href={block.href}>
            {block.text || 'Button'}
          </Button>
        </>
      )
    case 'grid':
      return <GridEditor block={block} onChange={onChange} />
    case 'raw':
      return (
        <>
          <TextField sx={{ mb: 1 }} fullWidth size="small" label="Label" value={block.label} onChange={(e) => onChange({ ...block, label: e.target.value })} />
          <textarea className="raw-edit" value={block.text} onChange={(e) => onChange({ ...block, text: e.target.value })} spellCheck={false} />
        </>
      )
  }
}

export default function BlockEditor({
  block,
  index,
  total,
  onChange,
  onInsertAfter,
  onDuplicate,
  onDelete,
  onMove,
}: {
  block: DocBlock
  index: number
  total: number
  onChange: (b: DocBlock) => void
  onInsertAfter: () => void
  onDuplicate: () => void
  onDelete: () => void
  onMove: (dir: -1 | 1) => void
}) {
  const previewable = PREVIEWABLE.has(block.type)
  const [editing, setEditing] = useState(false)
  const showForm = !previewable || editing
  return (
    <>
      <BlockShell
        block={block}
        isFirst={index === 0}
        isLast={index === total - 1}
        previewable={previewable}
        editing={editing}
        onToggleEdit={() => setEditing((e) => !e)}
        onChange={onChange}
        onInsertAfter={onInsertAfter}
        onDuplicate={onDuplicate}
        onDelete={onDelete}
        onMove={onMove}
      >
        {showForm ? (
          <>
            {blockEditorBody(block, onChange)}
            {previewable && editing && (
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
                <Button size="small" startIcon={<VisibilityOutlinedIcon sx={{ fontSize: 16 }} />} onClick={() => setEditing(false)}>
                  Done
                </Button>
              </Box>
            )}
          </>
        ) : (
          <RenderedPreview block={block} onEdit={() => setEditing(true)} />
        )}
      </BlockShell>
      {index < total - 1 && <Divider className="block-divider" />}
    </>
  )
}

export function emptyMarkdownTableBlock(): DocBlock {
  return { type: 'markdownTable', table: newMarkdownTable() }
}
