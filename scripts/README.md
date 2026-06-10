# Dev Scripts

One-off development and debugging tools. None of these ship with the app.

| Script | Purpose |
|---|---|
| `test-parser.mjs`, `test-summary.mjs` | Exercise the IDFC statement parsers against local statement files |
| `analyze-excel.mjs`, `analyze-excel-detailed.mjs` | Inspect raw Excel statement structure while developing the parser |
| `analyze-last-transactions.mjs`, `compare-dashboard-vs-statement.mjs` | Reconciliation checks between parsed data and statement totals |
| `generate-icon.html`, `generate-icons.cjs`, `resize-icon.cjs` | App icon generation. **Note:** the icon scripts need `npm i -D canvas sharp` (removed from devDependencies during the dependency cleanup) |

Statement files used by these scripts live in `../private/statements/` (gitignored — personal data).
