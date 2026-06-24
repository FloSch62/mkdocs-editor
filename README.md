# MkDocs Table Editor

A small EDA-family web app (sibling to `cable-map` and `topo-builder`) for **editing
MkDocs / Zensical markdown — including the nested `pymdownx.blocks.html` tables — visually,
in the preview**. You paste markdown, edit cells/paragraphs in place, and copy clean markdown
back out. No slash-counting.

## Why

Material for MkDocs authors complex tables with `pymdownx.blocks.html`, where **nesting depth
is encoded as the number of slashes**:

```
/// html | table
//// html | th[style='text-align: center;']
Top-level parameter
////
//// html | tr
///// html | td
`version`
/////
////
///
```

A cell (`td`) can contain a whole nested `////// html | table`, recursively (see the EDAADM
`machines` row in `nokia-eda/docs`). Hand-editing means counting slashes and balancing fences
across six-plus levels — the "menace". This app turns that into a grid and regenerates the
fences as pure codegen.

## How it works

- `src/blocks.ts` — the deterministic core. `parseDocument()` turns markdown into prose
  segments + a typed table tree; `serializeDocument()` regenerates the blocks-HTML with all
  slash depths recomputed. The round-trip is **structurally lossless** — it normalises
  whitespace and drops decorative HTML comments (both desirable once a GUI replaces hand
  editing). It is the one load-bearing piece and is intentionally not an LLM: a save must be
  deterministic and reversible.
- `src/TableEditor.tsx` — a **recursive** editable grid. A cell renders an ordered list of
  markdown text runs and/or nested tables, so tables-inside-cells just work (the thing
  Excel-style editors can't do). Add/delete rows and columns, set header alignment, insert a
  nested table in any cell.
- `src/RichMarkdown.tsx` — renders the other `pymdownx.blocks.*` constructs so the preview
  matches the published page: `/// tab |` → a MUI tab switcher (consecutive tabs grouped),
  admonitions (`/// note|tip|warning|danger|…`) → coloured callouts, `/// details |` →
  collapsible accordion, and `--8<-- "path"` snippet includes → an include chip.
- `src/App.tsx` — paste-to-import, click-to-edit cells, hover-pencil edit for prose, a
  toggleable live markdown-source pane, and copy/download `.md`.
- `src/markdown.ts` — `marked` for display-only rendering of prose and cell bodies.

## Scope / limitations

- Tables (`/// html | table`) are structurally modelled and editable cell-by-cell, nesting
  and all. Other block types (tabs, admonitions, details, snippets) are **rendered** for the
  preview but edited as raw markdown (hover the pencil) — they round-trip verbatim.
- A table nested inside a non-table block isn't promoted to the grid editor.
- HTML comments inside tables are dropped on round-trip; output slash counts and whitespace
  are normalised (re-renders identically in MkDocs).

## Develop

```sh
pnpm install
pnpm dev        # http://localhost:5174
pnpm build      # tsc -b && vite build
pnpm lint       # oxlint
pnpm check      # parser/serializer round-trip check against the EDAADM sample
```

Click **Load EDAADM sample** in the empty state to load the real nested table excerpt.

Like `cable-map`, this is a relative-base SPA, so it can later be packaged behind the EDA HTTP
proxy if it should ship as an in-cluster app — but it is fully client-side and needs no
backend.
