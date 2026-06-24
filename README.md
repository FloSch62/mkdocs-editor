# MkDocs / Zensical Editor

A small EDA-family web app (sibling to `cable-map` and `topo-builder`) for visually authoring
MkDocs Material / Zensical markdown. Paste a page, edit structured blocks, and copy or download
clean markdown back out.

The original nested `pymdownx.blocks.html` table editor is still the strongest path: recursive
tables are parsed into a real grid and serialized with slash depth recomputed. The app now also
models the common authoring blocks users reach for when creating polished docs pages.

## What it edits

- Front matter: title, description, icon, status, template, and hidden sidebars.
- Markdown prose with inline helper buttons for bold, italic, links, code, highlights, keyboard
  keys, and lists.
- Zensical slash blocks and common classic Material syntax for admonitions and content tabs.
- Details blocks, snippets, code blocks with Material options, images, button links, grid cards,
  Markdown data tables, and recursive blocks-HTML tables.
- Unknown/custom block syntax as raw markdown, so unsupported content is preserved instead of
  silently changed.

## How it works

- `src/blocks.ts` is the deterministic core. `parseDocument()` turns markdown into a typed block
  list; `serializeDocument()` regenerates markdown. The parser preserves code fences and keeps
  unknown blocks raw.
- `src/BlockEditor.tsx` provides the structured visual editor, block actions, shared Markdown
  mini-editor, front matter form, tabs/cards editors, code controls, and normal Markdown table
  editor.
- `src/TableEditor.tsx` remains the recursive nested table editor for `/// html | table`.
- `src/RichMarkdown.tsx` and `src/markdown.ts` provide display rendering for prose and block
  previews.
- `src/App.tsx` handles paste/import, the Insert menu, source-pane editing, copy, and download.

## Syntax defaults

New inserted blocks default to Zensical / PyMdown slash-fence syntax, for example:

```
/// note | Heads up
Write the callout content here.
///
```

Imported classic Material admonitions and tabs such as `!!! note` and `=== "Linux"` are parsed
and serialized in their original style where practical.

## Develop

```sh
pnpm install
pnpm dev        # http://localhost:5174
pnpm build      # tsc -b && vite build
pnpm lint       # oxlint
pnpm check      # parser/serializer round-trip fixtures
```

Click **Load EDAADM sample** in the empty state to load the real nested table excerpt, or
**Start blank** to build a new page from the Insert menu.

Like `cable-map`, this is a relative-base SPA, so it can later be packaged behind the EDA HTTP
proxy if it should ship as an in-cluster app. It is fully client-side and needs no backend.
