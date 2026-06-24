import { useRef, useState } from 'react'
import {
  Box,
  Button,
  IconButton,
  Paper,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlineOutlined'
import ViewColumnOutlinedIcon from '@mui/icons-material/ViewColumnOutlined'
import TableRowsOutlinedIcon from '@mui/icons-material/TableRowsOutlined'
import GridOnOutlinedIcon from '@mui/icons-material/GridOnOutlined'
import NotesIcon from '@mui/icons-material/Notes'
import FormatAlignLeftIcon from '@mui/icons-material/FormatAlignLeft'
import FormatAlignCenterIcon from '@mui/icons-material/FormatAlignCenter'
import FormatAlignRightIcon from '@mui/icons-material/FormatAlignRight'
import TableChartOutlinedIcon from '@mui/icons-material/TableChartOutlined'
import { renderMarkdown } from './markdown.ts'
import { type Cell, type Table, columnCount, emptyCell, newTable } from './blocks.ts'

const clone = <T,>(v: T): T => structuredClone(v)

function alignOf(attrs: string): 'left' | 'center' | 'right' {
  const m = /text-align:\s*(left|center|right)/.exec(attrs)
  return (m?.[1] as 'left' | 'center' | 'right') ?? 'left'
}
const withAlign = (a: string) => (a === 'left' ? '' : `[style='text-align: ${a};']`)

// One cell: ordered markdown text runs and/or nested tables, each editable in place.
function CellView({ cell, onChange }: { cell: Cell; onChange: (c: Cell) => void }) {
  const [edit, setEdit] = useState<{ idx: number; value: string } | null>(null)
  const skipNextCommit = useRef(false)

  const commit = () => {
    if (skipNextCommit.current) {
      skipNextCommit.current = false
      return
    }
    if (!edit) return
    const next = clone(cell)
    if (edit.value.trim()) next.blocks[edit.idx] = { type: 'text', md: edit.value }
    else next.blocks.splice(edit.idx, 1)
    setEdit(null)
    onChange(next)
  }
  const mutate = (fn: (c: Cell) => void) => { const next = clone(cell); fn(next); onChange(next) }
  const removeBlock = (idx: number) => {
    setEdit((cur) => {
      if (!cur) return null
      if (cur.idx === idx) return null
      return cur.idx > idx ? { ...cur, idx: cur.idx - 1 } : cur
    })
    mutate((c) => c.blocks.splice(idx, 1))
  }
  const addTextBlock = () => {
    const idx = cell.blocks.length
    const next = clone(cell)
    next.blocks.push({ type: 'text', md: '' })
    onChange(next)
    skipNextCommit.current = false
    setEdit({ idx, value: '' })
  }
  const cancelEdit = () => {
    if (!edit) return
    const original = cell.blocks[edit.idx]
    skipNextCommit.current = true
    setEdit(null)
    if (original?.type === 'text' && original.md === '') removeBlock(edit.idx)
  }

  return (
    <Box className="cell">
      {cell.blocks.map((b, i) =>
        b.type === 'text' ? (
          edit?.idx === i ? (
            <TextField
              key={i}
              multiline
              fullWidth
              size="small"
              autoFocus
              value={edit.value}
              onChange={(e) => setEdit({ idx: i, value: e.target.value })}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) commit()
                if (e.key === 'Escape') cancelEdit()
              }}
              sx={{ '& .MuiInputBase-input': { fontSize: 14 } }}
            />
          ) : (
            <Box key={i} className="cell-text-block">
              <Box
                className={`cell-rendered${b.md.trim() ? '' : ' empty'}`}
                title="Click to edit · ⌘/Ctrl+Enter to save · Esc to cancel"
                onClick={() => { skipNextCommit.current = false; setEdit({ idx: i, value: b.md }) }}
                dangerouslySetInnerHTML={{ __html: renderMarkdown(b.md) }}
              />
              <Tooltip title="Remove text block">
                <IconButton
                  className="cell-block-action"
                  size="small"
                  onClick={(e) => { e.stopPropagation(); removeBlock(i) }}
                >
                  <DeleteOutlineIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
            </Box>
          )
        ) : (
          <Box key={i} sx={{ mt: 0.75 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.25 }}>
              <TableChartOutlinedIcon sx={{ fontSize: 15, color: 'var(--muted)' }} />
              <Box sx={{ fontSize: 11, color: 'var(--muted)', flexGrow: 1 }}>nested table</Box>
              <Tooltip title="Remove nested table">
                <IconButton size="small" onClick={() => removeBlock(i)}>
                  <DeleteOutlineIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
            </Box>
            <TableEditor table={b.table} onChange={(t) => mutate((c) => { c.blocks[i] = { type: 'table', table: t } })} />
          </Box>
        ),
      )}

      <Box className="cell-foot">
        <Tooltip title="Add text block">
          <IconButton size="small" onClick={addTextBlock}>
            <NotesIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
        <Tooltip title="Insert nested table">
          <IconButton size="small" onClick={() => mutate((c) => c.blocks.push({ type: 'table', table: newTable() }))}>
            <GridOnOutlinedIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
        {cell.kind === 'th' && (
          <ToggleButtonGroup
            size="small"
            exclusive
            value={alignOf(cell.attrs)}
            onChange={(_, v) => v && onChange({ ...cell, attrs: withAlign(v) })}
            sx={{ ml: 0.5, '& .MuiToggleButton-root': { p: 0.25, border: 'none' } }}
          >
            <ToggleButton value="left"><FormatAlignLeftIcon sx={{ fontSize: 15 }} /></ToggleButton>
            <ToggleButton value="center"><FormatAlignCenterIcon sx={{ fontSize: 15 }} /></ToggleButton>
            <ToggleButton value="right"><FormatAlignRightIcon sx={{ fontSize: 15 }} /></ToggleButton>
          </ToggleButtonGroup>
        )}
      </Box>
    </Box>
  )
}

export default function TableEditor({ table, onChange }: { table: Table; onChange: (t: Table) => void }) {
  const cols = Math.max(1, columnCount(table))
  const mutate = (fn: (t: Table) => void) => { const next = clone(table); fn(next); onChange(next) }

  const setHeader = (i: number, c: Cell) =>
    mutate((t) => { while (t.header.length < cols) t.header.push(emptyCell('th')); t.header[i] = c })
  const setCell = (r: number, ci: number, c: Cell) =>
    mutate((t) => { while (t.rows[r].cells.length <= ci) t.rows[r].cells.push(emptyCell('td')); t.rows[r].cells[ci] = c })

  // Keep the header in step with the columns only when the table actually has one — many
  // blocks-HTML tables are headerless (rows of td only), and we must not inject phantom th.
  const hasHeader = table.header.length > 0
  const addColumn = () => mutate((t) => { if (t.header.length) t.header.push(emptyCell('th')); for (const row of t.rows) row.cells.push(emptyCell('td')) })
  const deleteColumn = (i: number) => mutate((t) => { if (t.header.length) t.header.splice(i, 1); for (const row of t.rows) row.cells.splice(i, 1) })
  const addRow = (at: number) => mutate((t) => t.rows.splice(at, 0, { attrs: '', cells: Array.from({ length: cols }, () => emptyCell('td')) }))
  const deleteRow = (i: number) => mutate((t) => t.rows.splice(i, 1))
  const addHeader = () => mutate((t) => { t.header = Array.from({ length: cols }, () => emptyCell('th')) })
  const removeHeader = () => mutate((t) => { t.header = [] })

  const header = Array.from({ length: cols }, (_, i) => table.header[i] ?? emptyCell('th'))

  return (
    <Paper variant="outlined" className="tbl-card">
      <Box className="tbl-bar">
        <TableChartOutlinedIcon sx={{ fontSize: 16, color: 'var(--accent)' }} />
        <Box sx={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', flexGrow: 1 }}>table</Box>
        {!hasHeader && <Button size="small" onClick={addHeader}>Header</Button>}
        <Button size="small" startIcon={<ViewColumnOutlinedIcon />} onClick={addColumn}>Column</Button>
        <Button size="small" startIcon={<TableRowsOutlinedIcon />} onClick={() => addRow(table.rows.length)}>Row</Button>
      </Box>

      <Box sx={{ overflowX: 'auto' }}>
        <table className="tbl">
          {hasHeader && <thead>
            <tr>
              <th className="gutter">
                <Tooltip title="Remove header row">
                  <IconButton className="row-actions" size="small" onClick={removeHeader}>
                    <DeleteOutlineIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </Tooltip>
              </th>
              {header.map((h, i) => (
                <th key={i} style={{ textAlign: alignOf(h.attrs) }}>
                  <Box className="th-inner">
                    <CellView cell={h} onChange={(c) => setHeader(i, c)} />
                    {cols > 1 && (
                      <Tooltip title="Delete column">
                        <IconButton className="hover-action" size="small" onClick={() => deleteColumn(i)}>
                          <DeleteOutlineIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Box>
                </th>
              ))}
            </tr>
          </thead>}
          <tbody>
            {table.rows.map((row, r) => (
              <tr key={r}>
                <td className="gutter">
                  <Box className="row-actions">
                    <Tooltip title="Add row below">
                      <IconButton size="small" onClick={() => addRow(r + 1)}><AddIcon sx={{ fontSize: 16 }} /></IconButton>
                    </Tooltip>
                    <Tooltip title="Delete row">
                      <IconButton size="small" onClick={() => deleteRow(r)}><DeleteOutlineIcon sx={{ fontSize: 16 }} /></IconButton>
                    </Tooltip>
                  </Box>
                </td>
                {Array.from({ length: cols }, (_, ci) => (
                  <td key={ci}>
                    <CellView cell={row.cells[ci] ?? emptyCell('td')} onChange={(c) => setCell(r, ci, c)} />
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
