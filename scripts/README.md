# Dev Scripts

One-off development and debugging tools. None of these ship with the app.

| Script | Purpose |
|---|---|
| `verify-statements.mjs` | Regression check: runs the real PDF and Excel parsers over every statement in a folder and checks totals against the bank, to the paisa |
| `check-dates.mjs` | Regression check: transaction dates stay on the day picked, in several time zones (audit H4) |
| `check-spend.mjs` | Regression check: payee rules and defaults decide what counts as spending, income or money moved (audit H3, M8, M9) |
| `check-app-updates.mjs` | Regression check: when the app offers, requires or skips a Google Play update, when "What's new" appears, and that the release notes match `android/app/build.gradle` |
| `check-duplicates.mjs` | Regression check: bank references, transaction keys, stable import ids and duplicate matching on made-up narrations (audit L1–L3). Given a statements folder, also replays the audit's re-import tests on real statements, before and after, printing counts only |
| `check-cloud-saves.mjs` | Regression check: refused cloud writes are kept for the "didn't save" banner, sent again by Try again, and dropped on Dismiss or a new sign-in (audit M4) |
| `test-parser.mjs`, `test-summary.mjs` | Exercise the IDFC statement parsers against local statement files |
| `analyze-excel.mjs`, `analyze-excel-detailed.mjs` | Inspect raw Excel statement structure while developing the parser |
| `analyze-last-transactions.mjs`, `compare-dashboard-vs-statement.mjs` | Reconciliation checks between parsed data and statement totals |
| `generate-icon.html`, `generate-icons.cjs`, `resize-icon.cjs` | App icon generation. **Note:** the icon scripts need `npm i -D canvas sharp` (removed from devDependencies during the dependency cleanup) |

Statement files used by these scripts live in `../private/statements/` (gitignored — personal data).
