# MkDocs / Zensical Editor

**Live app:** <https://flosch62.github.io/mkdocs-editor/>

Small client-side editor for authoring MkDocs Material / Zensical markdown. Paste a page,
edit structured blocks, then copy or download clean markdown.

## Supports

- Front matter, prose, admonitions, tabs, details, snippets, code, images, buttons, grids, and tables.
- Zensical slash blocks plus common classic Material syntax.
- Recursive `pymdownx.blocks.html` tables with depth-safe serialization.
- Unknown/custom syntax preserved as raw markdown.

## Develop

```sh
pnpm install
pnpm dev      # http://localhost:5174
pnpm build
pnpm lint
pnpm check
```
