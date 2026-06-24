import RichMarkdown from './RichMarkdown.tsx'
import {
  type Cell,
  type DocBlock,
  type Table,
  columnCount,
  serializeDocument,
} from './blocks.ts'

// A chrome-free, read-only render of the whole document — what the page looks like once
// published by zensical. Most blocks round-trip through RichMarkdown; the ones that don't
// (nested pymdownx tables, buttons, grid cards) get a dedicated read-only renderer, and
// front matter is hidden the way it is on a real page.

function blockMarkdown(block: DocBlock): string {
  // coerce slash-block syntax / collapse so RichMarkdown can render it (it speaks `///`)
  let b: DocBlock = 'syntax' in block ? { ...block, syntax: 'zensical' } : block
  if (b.type === 'admonition') b = { ...b, collapse: 'none' }
  return serializeDocument([b])
}

function ReadOnlyCell({ cell }: { cell: Cell }) {
  return (
    <>
      {cell.blocks.map((blk, i) =>
        blk.type === 'text'
          ? <RichMarkdown key={i} text={blk.md} />
          : <ReadOnlyTable key={i} table={blk.table} />,
      )}
    </>
  )
}

function ReadOnlyTable({ table }: { table: Table }) {
  const cols = columnCount(table)
  return (
    <table>
      {table.header.length > 0 && (
        <thead>
          <tr>{table.header.map((c, i) => <th key={i}><ReadOnlyCell cell={c} /></th>)}</tr>
        </thead>
      )}
      <tbody>
        {table.rows.map((row, r) => (
          <tr key={r}>
            {Array.from({ length: cols }, (_, c) => (
              <td key={c}>{row.cells[c] ? <ReadOnlyCell cell={row.cells[c]} /> : null}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function GridCards({ cards }: { cards: Array<{ title: string; href: string; body: string }> }) {
  return (
    <div className="grid cards">
      <ul>
        {cards.map((card, i) => (
          <li key={i}>
            <p>{card.href ? <a href={card.href}><strong>{card.title}</strong></a> : <strong>{card.title}</strong>}</p>
            {card.body.trim() && <RichMarkdown text={card.body} />}
          </li>
        ))}
      </ul>
    </div>
  )
}

function BlockView({ block }: { block: DocBlock }) {
  switch (block.type) {
    case 'frontmatter':
      return null
    case 'htmlTable':
      return <div className="prose"><ReadOnlyTable table={block.table} /></div>
    case 'button':
      return (
        <div className="prose">
          <a className={`md-button${block.primary ? ' md-button--primary' : ''}`} href={block.href}>
            {block.text || 'Button'}
          </a>
        </div>
      )
    case 'grid':
      return <div className="prose"><GridCards cards={block.cards} /></div>
    default:
      return <RichMarkdown text={blockMarkdown(block)} />
  }
}

export default function DocPreview({ blocks }: { blocks: DocBlock[] }) {
  return (
    <>
      {blocks.map((block, i) => (
        <div key={i} id={`zx-block-${i}`} data-zx-block={i}>
          <BlockView block={block} />
        </div>
      ))}
    </>
  )
}
