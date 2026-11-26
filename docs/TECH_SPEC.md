# Wall-ette — Technical Specification

**Version:** 1.5.5 (versionCode 13) · **App ID:** `com.wallette.app` (Android; builds before Play and the iOS project use `com.wallet.walle`) · **Updated:** 20 November 2026
**Live web:** https://wall-ette.com · **Repo:** https://github.com/Akilucky-rogue/Wall-ette

Wall-ette is an offline-first personal finance tracker for web and Android. Users record
transactions manually or import real bank statements (PDF/Excel), and the app reconstructs a
balance-accurate ledger with local-only analytics. No ads, no analytics SDKs, no AI/API
calls — every insight is computed on the device. The Android app sends crash reports
(Crashlytics, from 1.5.5), which users can turn off.

---

## 1. Stack at a glance

| Layer | Technology | Version |
|---|---|---|
| UI framework | React + React DOM | 19.2 |
| Language | TypeScript (strict) | 5.8 |
| Build tool | Vite (`@vitejs/plugin-react` 5.1) | 7.3 |
| Styling | Tailwind CSS + PostCSS + Autoprefixer | 3.3 / 8.4 / 10.4 |
| Native shell | Capacitor | 8.6 |
| Backend | Firebase (Auth + Firestore + Hosting) | JS SDK 11.10 |
| PDF parsing | pdfjs-dist (worker bundled locally) | 5.4 |
| Excel parsing | SheetJS `xlsx` (pinned CDN tarball) | 0.20.3 |
| QR generation | `qrcode` (TOTP enrollment) | 1.5 |
| Android toolchain | AGP 8.13 · Gradle 8.14.3 · JDK 21 (Temurin) | SDK 24 → 35 |
| Fonts | Inter (text and figures) · Manrope (headings) · Material Symbols Outlined | Google Fonts CDN |

Dev-only: `typescript-plugin-css-modules` (typed CSS modules), `@types/*` for node/react/qrcode.

---

## 2. Frontend architecture

### 2.1 App shell & navigation
- **Single-shell state machine** — `App.tsx` switches screens via an `AppScreen` enum; no router
  library. Every screen is a `React.lazy` chunk, so the initial bundle stays lean
  (largest lazy chunks: ImportStatement ~412 kB incl. parsers, pdf.js ~404 kB, SpendAnalysis ~47 kB).
- **Product page (web only)** — visitors who aren't signed in see `components/Landing.tsx`
  (hero demo in `components/landing/StatementDemo.tsx`, screenshots in `public/landing/`, all
  sample data). "Sign in" sets `#signin` and shows the Auth screen, so Back returns to the page;
  Auth gets an "About Wall·ette" link back. The Android app never shows it, and only the
  Android app plays the launch splash. Search and link-preview tags live in `index.html`
  (`public/og-image.png` is the store feature graphic).
- **Gesture navigation** — app-wide swipe handling on the shell div: horizontal swipes move
  through `TAB_ORDER` (Home → Vault → Pulse → Self); sub-screens swipe back to their
  `BACK_TARGET` parent. Scrollable/interactive elements (`.overflow-x-auto`, inputs, svg,
  canvas) are excluded. Thresholds: ≥70 px, ≤600 ms, dx > 1.5·dy.
- **Android system back** — Capacitor `backButton` listener mirrors the same map:
  sub-screen → parent, tab → Home, Home → `minimizeApp()`.
- **Pages, not long scrolls** (1.5.6) — Pulse is a hub (`SpendAnalysis` with no `page`) that
  links to its own pages, `PULSE_TRENDS`, `PULSE_CATEGORIES`, `PULSE_RECURRING` and
  `PULSE_HEALTH` (Insights; the same component with `page` set); they share the month through
  `components/pulseView.ts`, a small `useSyncExternalStore` store. Everything Pulse shows comes
  from one pure analysis, `services/pulseAnalysis.ts` (§5, Pulse), drawn by `components/charts/`. Self is a hub (who you are, sign out) with `SELF_ACCOUNT`, `SELF_ALERTS`, `SELF_DATA`,
  `SELF_APPEARANCE` and `SELF_ABOUT` (`Profile` with `page` set); Money moved now sits under
  Your data. Home opens `LEFT_TO_SPEND` (§5); the 12-month balance chart moved from Home to
  Flow's Story (`components/BalanceTrend.tsx`, ending at the story's month).
  `components/Navigation.tsx` lists the screens each tab owns, so a page keeps its tab lit. The screen container is keyed by screen and plays a
  motion-safe entrance: deeper pages slide in from the right, Back slides the other way, tabs
  rise into place (`motionFor` in `App.tsx`; tailwind `page-in`, `page-back`, `tab-in`).
- **Splash & lock flow** — cold start on native boots into `SecurityLock` (biometric prompt)
  before the app renders; 15-minute inactivity and app-backgrounding re-lock the session.

### 2.2 Theme engine (`utils/theme.ts`)
- Every color in the app resolves through **CSS variables** set on `<html>`:
  - `--c-*` channel triplets (`r g b`) feed Tailwind via `rgb(var(--c-x) / <alpha-value>)` —
    the entire utility palette (including remapped `white` and the `gray` scale) follows the theme;
  - `--*` hex aliases feed inline SVG/chart colors (`stroke="var(--sage)"`).
- **Six themes:** Sage (default), Midnight (dark), Slate, Terra, Techie (dark terminal-green),
  and Custom — a user-picked accent + light/dark base, derived at runtime with color-mix math.
- **Auto mode** follows `prefers-color-scheme` (light → Sage, dark → Midnight) with a live
  media-query listener. Choice persists per device in `localStorage`.
- Native side: on every Android version the page draws behind both system bars, so they
  show the theme color (see §6, Windowing); Capacitor's `SystemBars` sets their icon colors
  per theme. With a WebView older than 140, Capacitor pads the page instead and the bars
  stay cream with dark icons. A `theme-color` meta keeps browser chrome in sync on web.
- **Depth** (1.5.6) — one light source, above. `applyPalette` also sets `--shadow-rgb` (a warm
  shadow tone; black on dark themes), `--edge-hi` (a top-edge highlight), `--card-top`/
  `--card-bottom` (cards are a touch lighter at the top) and the wallet colours. Tailwind's
  `shadow-soft`, `shadow-raised`, `shadow-float` and `shadow-pressed` read them; tapping a card
  presses it in. `styles.css` adds `.icon-fill` (filled symbols), `.wallet` (Home's balance: a
  stitched card with a fine weave, `.wallet-pocket`, `.wallet-emboss`) and `.receipt` (a
  zigzag torn edge made with a mask; its shadow is a `drop-shadow` on `.receipt-lift`).
  Every screen uses the same page header (a back arrow, the title on the left) and opens with
  one wallet card for its key figure (`components/ui/Denim.tsx`); card labels are Wall-ette's
  small caps (`BUDGETS · NOVEMBER`); hairlines, dividers and switch tracks use the ink colour at
  low opacity (`border-premium-charcoal/[0.08]`), so they show on dark themes too. The dock keeps
  its sprout and lotus, and data screens their leaves, rangoli, diya and potted plant.
  `docs/DESIGN_SYSTEM.md` has the tokens, components, layouts and the 1.5.6 audit.
- **Charts** (1.5.6) — `--viz-in` (teal), `--viz-out` (clay) and its steps are the same in every
  theme, validated for colour blindness and contrast in light and dark. `components/charts/kit.tsx`
  gives each chart a card with a legend, a tooltip on hover, tap or keyboard focus, and a
  Numbers switch that shows the same figures as a table.
- **Wide screens** (1.5.6) — from 1024px the dock gives way to a rail on the left (logo, the four
  tabs, Add an entry, Import a statement); `App.tsx` pads the content for it and screens lay out
  on 12-column grids (Home and Pulse up to 1152px, forms and settings 672–768px).
- Deliberately theme-independent: mascot, splash art, exported statement HTML, and the
  shareable Wrapped card (brand-stable artifacts).

### 2.3 State management
Plain React context — no Redux/Zustand.
- **`AuthContext`** — Firebase Auth session state. Signing out and account deletion go
  through `services/session.ts`, which also removes the user's data from the device: the
  `localStorage` mirror (keys ending in `_<uid>`) and Firestore's offline cache, then
  reloads. On sign-out the cache is only cleared once unsynced changes reach the cloud
  (up to 4 s); offline, it stays so they sync at the next sign-in.
- **`WalletContext`** — transactions, opening balance (+ `openingBalanceAsOf` anchor),
  budgets, savings goal, daily spend limit, currency. Money is always saved in rupees; from
  1.5.6 amounts can be shown in any currency the rate feed knows (`utils/currencyUtils.ts`,
  Intl formatting with each currency's own decimals, rates cached as `fxRates_v2`). Anything
  typed (a new entry, an edit, a budget, the daily limit, the savings goal, Vault's amount
  filter) is in the shown currency and saved with `toBase` to the paisa; inputs show saved
  rupees with `toShown`, to the decimals the currency can hold (`inputDigits`: whole yen,
  won, rupiah and dong). An entry typed in another currency also keeps `typedAmount` and
  `typedCurrency`, so it reads back exactly as typed while shown in that currency
  (`formatEntry`). New entry builds the entry with `entryFromForm` (utils/entryAmount.ts)
  and saves once per tap (`scripts/check-entry.mjs`, `scripts/check-currency.mjs`). Every
  change to the list builds on the newest list (`listRef`), so two changes in a row can't
  undo each other. Includes batched bulk ops
  (`deleteTransactions` via Firestore `writeBatch` chunks) and an instant, optimistic
  `clearAllTransactions` (local state clears immediately; cloud deletion continues in the
  background).
- **Cloud writes** (audit M4) — every change, settings included, goes to Firestore whether
  online or not (settings used to skip the cloud offline and lose the change at the next
  sync), and also while the listeners have fallen back to the `localStorage` mirror. An
  import hands Firestore all its 500-row batches at once, so its offline queue holds the
  whole statement across restarts. Writes go through `services/cloudSaves.ts`, which keeps
  each one the server refuses (rules, daily quota) for `CloudSaveBanner`: "N changes didn't
  save", with Try again and Dismiss. Firestore has already undone a refused change on the
  device. A refusal of a write queued in an earlier session has no promise left to catch,
  so it's undone without the banner. Edits write the whole entry, so a retry also works
  for an entry the cloud never had. Each refusal also goes to Crashlytics as its kind and
  error code (`onRefused`, wired in `index.tsx`). Tests: `scripts/check-cloud-saves.mjs`.
- **Crash reports** (1.5.5) — Firebase Crashlytics on Android. The native SDK reports app
  crashes; `services/crashReports.ts` adds WebView errors (uncaught errors, unhandled
  rejections) and handled problems, with screen names as breadcrumbs. Messages pass
  through `services/crashFormat.ts`, which masks emails, ids and any number that could be
  an amount or an account or reference number; no user id is set. At most 20 reports a
  session, each once. On in release builds, off in debug (`firebase_crashlytics_collection_enabled`
  from a build-type placeholder); Profile → Crash Reports turns it off on a device
  (`localStorage` `crashReports`, plus `setEnabled` and `deleteUnsentReports`). Web builds
  send nothing. JS frames point into the minified bundle; the version code says which build.
  Turning reports back on first deletes whatever the SDK kept while they were off.
  Tests: `scripts/check-crash-reports.mjs`.
- **Lost WebView renderer** — when the renderer crashes or Android kills it for memory,
  Chromium kills the app unless someone handles it, and Crashlytics never sees that.
  `MainActivity` handles it: reports a `RendererGone` non-fatal, takes the dead WebView out
  and recreates the activity (it opens locked, as after a restart). A second loss within 30
  seconds lets the app close, so a renderer that dies on load can't loop.
- Device-local prefs (theme, biometric opt-in, banner dismissals) live in `localStorage`.

---

## 3. Backend (Firebase project `wall-e-7a113`)

| Service | Use |
|---|---|
| **Authentication** | Email/password sign-in (Identity Platform). Email enumeration protection is **off** (20 Nov 2026), so Forgot Password can say when no account uses an address; sign-up already revealed that. Password policy, enforced by Firebase: 8+ characters with upper and lower case, a number and a symbol, for new passwords only (existing ones still sign in). Reset emails come from `noreply@wall-e-7a113.firebaseapp.com` through Firebase's own page. TOTP MFA (authenticator apps) is fully implemented via `TotpMultiFactorGenerator` + QR enrollment but parked behind a "Coming Soon" UI. |
| **Firestore** | Per-user data under `users/{uid}` (transactions, settings, security log, consent record). `persistentLocalCache` gives offline-first behavior with automatic sync. |
| **Security rules** | `firestore.rules` — strict per-UID isolation; a user can only read/write their own subtree. Security log entries can be created and deleted by their owner (so account deletion erases them) but never edited. One shared read-only document, `config/app` (signed-in `get` only, edited in the console), holds app switches such as `androidMinVersionCode`. |
| **Hosting** | Serves `dist/` as an SPA (`** → /index.html` rewrite). The self-hosted APK at `/downloads/wall-ette.apk` was removed on 19 Nov 2026. |

External network calls are limited to: Firebase, Google Fonts, `exchangerate-api.com`
(public FX rates for the currency selector) and, on Android, Google Play's update check and
Firebase Crashlytics' crash reports.
Statement files never leave the device.

**Consent gate** — new registrations must accept Terms & Privacy (version `2026-06-11`);
acceptance is recorded with a server timestamp for auditability. Existing logins are unaffected.

---

## 4. Statement import engine

The heart of the app. Rule-based and deterministic — no AI, no network.

- **Banks** — IDFC FIRST (PDF and Excel), HDFC (Excel), and PDFs from Kotak Mahindra,
  Saraswat Co-operative, Union Bank of India and State Bank of India, each read in its own
  layout and checked to the paisa: every row against the running balance, and the bank's
  printed totals and closing balance where it prints them (Union Bank prints none).
  Anything else goes through a generic reader that follows the running balance.
- **PDF path** (`services/idfcParser.ts`, `parseStatementPdf`) — pdf.js text items carry x/y
  coordinates. The account's own IFSC, by its label, picks the bank (a name in a narration
  can't); `services/bankPdfLayouts.ts` holds the four other banks' layouts: the date format,
  where the narration sits (Union and SBI print lines above the date as well as below), how
  amounts are written ("99.00(Dr)", "25122 CR"), how lines wrap, and where the totals are.
  There, the running balance alone decides money in or out, and newest-first statements are
  read in date order. IDFC FIRST keeps its column parser: header label midpoints define
  column intervals, wrapped description lines are re-glued, and each row's type is verified
  against the balance. Password-locked PDFs (usual for statements sent by email) ask for
  their password, which stays in memory; a PDF with no text (Print to PDF, scans) says how to
  get a usable one.
- **Excel path** (`services/IDFCBankParser.ts`) — SheetJS rows. The table is found by its
  column names (IDFC FIRST's "Transaction Date … Debit | Credit | Balance", HDFC's
  "Date | Narration … Withdrawal Amt. | Deposit Amt. | Closing Balance") and the summary by
  its labels, above or below the table. Dates are read day-first ("01/02/26" is 1 February)
  as local dates (`toLocalISO`, avoiding the UTC date-shift bug class), and the running
  balance is checked row by row.
- **Narrations** (`services/narration.ts`) — fields split on "/" (IDFC FIRST, Kotak, SBI,
  Union, Saraswat), ":" (some IMPS and ACH rows) or "-" (HDFC), with "MB/" and "IB/" channel
  prefixes dropped, for the payee (`services/spend.ts`) and the bank reference below.
- **Checks** — `scripts/check-bank-statements.mjs` (made-up statements in every layout) and
  `scripts/verify-statements.mjs <folder>` (real statements, to the paisa; counts only).
- **Order-independent correctness** — statements can be imported in *any* order:
  - one key per transaction (`services/statementImport.ts`, audit L1–L3): the bank's
    reference from the narration (the 12-digit RRN on UPI and IMPS, the UTR on NEFT and
    RTGS; spaces from PDF line wraps ignored), or the narration's first 48 letters and digits
    where there's none, plus date, direction and amount. The same in the PDF and the Excel
    export;
  - stable ids: `import-` + the first 32 hex digits of the key's SHA-256, with identical rows
    in one statement numbered in order, so a row keeps its id in every statement and format
    and an import skips rows the wallet already has under that id;
  - count-aware duplicate claiming across the whole statement. A row the wallet has under its
    own id claims that entry first, so of two identical lines only the one the wallet holds is
    flagged and the other is imported; then, strongest first: same bank reference, then same
    narration, then one narration containing the other (or a wallet entry with no payee). Rows
    whose references differ never match, so same-day payments of the same amount to different
    payees aren't swapped;
  - Vault's duplicate cleaner (`components/DuplicateEntries.tsx`) groups imported rows by the
    same key and never removes rows with stable ids (they're all real); typed entries are left
    alone. Tests and a before/after replay over real statements: `scripts/check-duplicates.mjs`;
  - opening-balance anchoring to the earliest statement (`openingBalanceAsOf`); a statement's
    opening and closing are passed on only when it prints them (`openingKnown`,
    `closingKnown`), so a new account's 0.00 counts and an unknown figure doesn't;
  - one step from staged rows to the wallet (`mergeImport` in services/statementImport.ts,
    which `importTransactions` runs): rows the wallet has are skipped, stale adjustments come
    out in the same update, and the opening moves when this is the earliest statement;
  - forward/backward coverage-gap detection with optional single bridge adjustment, dated
    on the first missing day and named by the period it stands for, so importing any
    statement that covers part of that period removes it (`staleAdjustments`);
  - a tally card (`importTally`) that runs `mergeImport` itself and compares the wallet
    balance *as of statement end* with the statement's own closing balance, to the paisa.
    It also checks the statement on its own (`statementCheck`): opening + every row read =
    closing, no row left unticked that the wallet lacks, none ticked that it already has.
    `tallyTone` reads 'ok' when the wallet will match the bank, 'note' when the statement
    checks out but the wallet also holds other accounts, cash or typed entries (so its total
    can't equal one account's closing), and 'off' only when the import itself is short; the
    card then names the cause (rows that don't add up, rows left out, rows counted twice);
  - rows the reader couldn't place (no real day or no debit/credit side) are counted and
    named on the review; a row with no narration is imported as "Unknown" rather than
    dropped (`unreadableRows`, `importable`).
  - End to end: `scripts/check-import.mjs` runs the app's readers, `toTransactions`, the
    duplicate check, `importTally` and `mergeImport` on every statement in a folder (rows,
    debits and credits to the paisa, dates, ids, balance into an empty wallet, re-import),
    then per account in date order, reverse and random orders, and a gap bridged and filled;
    plus a wallet holding two accounts and cash (the check reads 'note', never 'off') and
    rows left out, ticked twice or missed by the reader (each reads 'off', by name).
  - Validated by simulation: 300 shuffled import orders of 15 real statements converge to an
    identical, to-the-rupee ledger.
- **Review UI** — paginated review with per-row edit, category auto-suggestion (Indian
  merchant/UPI regex patterns), duplicate flags, and a confirm()-guarded "Include Anyway".

---

## 5. Analytics (all on-device)

- **`analyticsService.ts`** — `prettyMerchant` (the payee after the payment rail, skipping UPI
  handles; a short code like "MF SIP" gives way to a fuller name; tidied by `utils/names.ts`
  `tidyName`, which title-cases but keeps acronyms and initials), `priceRises` (a payee charged
  a steady amount at least 4 times over 120+ days, CV ≤ 0.15, whose latest charge is up 5% and
  ₹10 or more), recurring-charge detection, income-stability tiers, daily-spend stats.
  `utils/names.ts` `paymentRail` names the rail (UPI, NEFT, Card, ATM…) for list rows.
- **Left to spend** (`services/leftToSpend.ts`, from 1.5.6) — what can still be spent before
  the next pay. The period runs from the last pay to the next when the pay stream is confirmed
  and paid within 45 days, else through the calendar month. Left = came in − spent − sent to
  family and invested − bills still to come − (savings goal − invested this period). Money
  between your own accounts, payees not counted and adjustments are left out both ways. Bills
  are recurring charges expected from today to the end of the period (up to 7 days late still
  counts; weekly and fortnightly ones repeat). When this month's pay day has passed with no pay
  (a pay up to 5 days early counts), it covers today only. Checked by
  `scripts/check-left-to-spend.mjs`; shown on Home (`components/LeftToSpendCard.tsx`) and on its
  own page (`components/LeftToSpend.tsx`).
- **Pulse** (`services/pulseAnalysis.ts`, from 1.5.6) — one pure analysis of a month that every
  Pulse page, the hub's wallet and the statement report draw from: six months of money in and
  out; spending added up day by day; bills (fixed-cost categories, and payees that charge on a
  schedule outside everyday categories), everyday spending and one-offs (at least 3× the month's
  median payment and ₹2,000); each category against its usual; payees; weekdays; and insights
  ordered worth a look, going well, good to know. Accuracy rules: the projection runs only
  everyday spending forward at its daily rate and adds bills still due from their schedule (rent
  and one-offs already paid are counted once); the live month is compared with the same day of
  the month before; "usual" and averages use only months the data fully covers (a first month
  starting after the 7th, or a last one ending more than 7 days early, is left out); when the
  newest entry is more than 3 days old the live month is read up to it and says so; shares are
  whole percents that add up to 100 (largest remainder). Checked by `scripts/check-pulse.mjs`:
  a hand-worked example plus invariants on 300 random wallets (about 20,000 checks).
- **Statement report** (`services/statementReport.ts`, from 1.5.6) — Data Studio's HTML
  statement and CSV, built from Pulse's analysis month by month, so the figures match. The page
  uses the app's look (the stitched wallet, Manrope headings, Inter figures, caps labels), escapes every
  payee and note, and prints to PDF; the CSV has ISO dates, rupees to the paisa, how each entry
  counts (spending, income or money moved) and writes formula-like text as text. Checked by
  `scripts/check-report.mjs`. The old health check (`insightsService.ts`) is gone.
- **Full backup and restore** (`services/backup.ts`, from 1.5.8) — Data Studio's backup is
  version 2: every entry plus the opening balance and its day, budgets, the savings goal, the
  daily limit and the Money moved rules (version 1, up to 1.5.7, held entries and the opening
  balance). **Restore from a backup** reads either version and only adds: entries the wallet
  has (same id) are skipped and nothing is deleted. Every row is rebuilt field by field from
  the file, so only an entry's own fields come back; ids must be usable as Firestore document
  ids, and malformed rows or repeated ids are counted and left out. A sheet
  (`components/RestoreBackupSheet.tsx`) says what will happen before anything is written:
  entries to add, entries already there, rows left out, and the settings, which are restored
  only when ticked (ticked by default for an empty wallet). Entries go in through
  `importTransactions`, settings through `restoreSettings` (budgets, goal and limit in the
  file replace those here; Money moved rules are added unless one with the same match is
  here). Checked by `scripts/check-restore.mjs`.
- **To review** (`services/review.ts`, from 1.5.8) — a statement transfer out the importer
  couldn't name (stored as Transfer Out) and no payee rule covers shows as "To review" on every
  screen, because WalletContext's `transactions` are each entry under the category it reads as
  (`withShownCategories`); `storedTransactions` are the entries as saved, and backups use them.
  A rule that counts may carry a category (`PayeeRule.category`: a landlord's payments as Rent),
  which its payments show under. Nothing stored changes: an Edit saved without changing the
  category keeps the stored one (`categoryToStore`). After each import, and in Money moved, the
  review (`components/ReviewPayees.tsx`) lists the payees still to review with a guess from the
  name (investment, rent or maintenance, software, family); a tap saves the rule. While
  payments to review are a quarter or more of a month's spending, Pulse doesn't compare that
  month with the one before (`PulseResult.review`). Checked by `check-spend` and `check-pulse`.
- **Reversals** (`services/reversals.ts`, from 1.5.8) — a credit that says it reverses or refunds
  a payment and names the same bank reference ("UPI/REV/…", "REV/UPI/…", HDFC's "REV-UPI-…")
  for the same amount, on or after the payment's day, cancels it: both are money moved
  ("Reversed"), so neither counts as spending or income. Each payment pairs once.
- **Redemption proceeds** (from 1.5.8) — fund redemptions are filed as Redemption proceeds, not
  Investment Returns, and are money moved (your own money coming back).
- **Payee names** (from 1.5.8) — a bank's four-letter code before the payee (IDFC IMPS), a UPI
  ID, or a payment gateway's code (PayU, BillDesk) is no longer read as the payee; HDFC's UPI
  Lite top-ups read "UPI Lite top-up"; a narration with nothing but numbers shows its rail
  ("UPI payment"). Vault shows the bank's whole narration once, under "From the bank".
- **Import receipts** (`services/importReceipt.ts`, from 1.5.8) — every import leaves a receipt:
  the statement's period, rows read, added, skipped as already in the wallet, left out on the
  review, unreadable, adjustments replaced, and how the balance check read (with the bank's
  closing balance and the difference). The last 20 are kept in the account's settings
  (`importReceipts`) and on the device; Import lists the last three. No payees, narrations or
  file names.
- **First use** (from 1.5.8) — a wallet with no entries and no opening balance opens on "Start
  your wallet" (import, add an entry, or restore a backup); Vault tells an empty wallet from a
  search that matches nothing; Pulse runs no projection for a month with no spending. Home's
  figure reads "Balance from your entries" (or "Balance on <day>" for an earlier month), the
  status reads "Saved to your account" with "Data through <newest entry's day>", and the
  Month / All time switch sits with the pockets it sets.
- **Contrast** (from 1.5.8) — secondary text is #72716E (Sage), #6B7179 (Slate) and #796E66
  (Terra) in the light themes, at least 4.6:1 on every surface; no text is drawn fainter than
  that. Checked by `scripts/check-contrast.mjs`.
- **Moved-vs-spent separation** — Transfer Out / Adjustment / Investment count in cash-flow
  totals but are excluded from every *spending* analysis (reports, Category Split, heatmaps).
- **Feature screens** — Pulse (a hub and pages: Trends, Categories, Recurring with price rises,
  Insights, with "Ask Wall-ette" marked coming soon), Category Split (interactive SVG donut with merchant drill-down), Income
  Insights (Flow), Left to spend, Rewind (lifetime timeline) with exportable "Wall·ette
  Wrapped" canvas cards. Fee Hunter was removed in 1.5.6.
- **Notifications** (from 1.5.6) — the bell on Home (`components/NotificationCenter.tsx`).
  `services/notifications.ts` builds them on the device from data the app already has:
  failed unlock attempts from the security log (`services/securityLog.ts` reads the latest 30;
  a wrong password followed within 5 minutes by an unlock is a typo and left out), categories
  at 80% and over their budget this month, today's spending over the daily limit, entries
  imported twice, price rises still being charged (last charged within 45 days), recurring
  charges due in the next 3 days, an import reminder when the
  newest entry is 30 days old, last month's savings against the goal (once the data reaches
  this month), a downloaded update and this version's release notes. Each notification's id
  names its subject (`budget:Dining:2026-11:over`, `due:<payee>:<day>`), so new ones stand out;
  seen and dismissed ids are kept in `localStorage` under `walletNotifications_<uid>`, which
  sign-out removes. Tapping one opens its screen: `utils/screenSection.ts` opens Flow on Goals,
  and price rises and bills due open Pulse's Recurring page. Nothing new is collected or sent, so the Data safety
  answers don't change. Checked by `scripts/check-notifications.mjs`.
- **Phone notifications** (from 1.5.6, Android, off until switched on in Self → Alerts and
  limits) — `services/phoneNotifications.ts` plans them, `services/phoneNotifier.ts` posts
  them, `components/PhoneNotifications.tsx` re-plans 2.5 s after the wallet changes. Bills: a
  reminder at 18:00 the evening before a recurring charge is due (09:00 that day once the
  evening has passed), for the next 7 days, at most 8; each re-plan replaces the waiting ones,
  so a paid or stopped bill loses its reminder. Alerts: the bell's budget and daily-limit notes,
  each shown once (ids remembered in `walletPhoneShown_<uid>` for 60 days); switching on counts
  the ones already there as shown. Tapping one opens its screen (after the lock). Sign-out and
  account deletion cancel waiting reminders and clear shown ones. Checked by
  `scripts/check-phone-notifications.mjs`.
- **Haptics** (`utils/haptics.ts`, from 1.5.6) — a light tick on tab changes and switches, a
  success buzz on saving an entry, a warning buzz on removing; Android only, off with Self →
  Appearance → Vibration (`walletHaptics`, per device).

---

## 6. Native Android build

| Item | Value |
|---|---|
| Capacitor plugins | core 8.6.2 (its `SystemBars` styles the bars) · app 8.0.1 · filesystem 8.1.2 · share 8.0.1 · haptics 8.0.2 · local-notifications 8.3.1 · `@aparajita/capacitor-biometric-auth` 10.0 · `@capawesome/capacitor-app-update` 8.1.1 (Play in-app updates) · `@capacitor-firebase/crashlytics` 8.6.0 (crash reports; Gradle: `firebase-crashlytics-gradle` 3.0.8, `google-services` 4.4.4) |
| Firebase (native) | Android app `com.wallette.app`, registered 20 Nov 2026 (`1:881370415293:android:b9d1da6f023d700e1877d4`). Its `android/app/google-services.json` is gitignored, and the build stops with the command to download it if it's missing |
| SDK levels | minSdk 24 · target/compileSdk 36 (Play's minimum from 31 Aug 2026) |
| Toolchain | Gradle 8.14.3 · AGP 8.13 · JDK 21 (Temurin); `patch-capacitor-gradle.ps1` pins plugin modules to Java 17 |
| Signing | Website APK: PKCS12 keystore at `private/my-release-key.keystore` via gitignored `android/key.properties` (exposed in audit C2; due to be retired). Google Play: a new upload key via gitignored `android/upload.properties`, used by `npm run android:bundle` (`-Pplay`); see `docs/PLAY_SUBMISSION.md` |
| Windowing | Edge to edge on every version: `MainActivity` calls `EdgeToEdge.enable` with transparent bars (Android 15+ is edge to edge anyway). Capacitor's `SystemBars` passes the bar insets to CSS on WebView 140+; `index.html` turns them into `--sat`/`--sab`, pads the body and paints strips under both bars. Older WebViews get the insets as padding and the cream window background shows behind the bars. Fixed top/bottom UI must add `var(--sat)`/`var(--sab)`. The 3-button nav bar scrim is off. No `statusBarColor`/`navigationBarColor` in `styles.xml` and no StatusBar plugin (Android 15 deprecated those calls); Play may still list androidx's own `EdgeToEdge`, which uses them below Android 15 |
| Code shrinking | Release builds run R8 (`proguard-android-optimize.txt`): shrinking, optimisation and obfuscation of the Java/Kotlin side, for Play's DEX optimisation check. Capacitor's consumer rules keep the plugin classes the bridge finds by name; `proguard-rules.pro` keeps `@JavascriptInterface` methods and line numbers. The Crashlytics Gradle plugin uploads the mapping file on each release build (needs network), and the bundle carries it for Play. Debug builds aren't minified |
| Backups & screen | `allowBackup="false"`, plus `res/xml/data_extraction_rules.xml` (Android 12+) and `backup_rules.xml` (11 and earlier) excluding every domain, so neither Google backups nor phone-to-phone transfers copy the WebView's data (mirror, Firestore cache, sign-in). `MainActivity` sets `FLAG_SECURE` in release builds: no screenshots, recordings or recent-apps preview. Debug builds leave capture on for store screenshots (audit M11) |
| Phone notifications | `@capacitor/local-notifications` (from 1.5.6): one channel, "Bills and budgets" (importance default, private on the lock screen), the status-bar icon `res/drawable/ic_stat_wallette.xml`. Inexact alarms only (`isExactNotification: false`); the manifest removes the plugin's `SCHEDULE_EXACT_ALARM`, so Android never shows the "Alarms & reminders" screen. `POST_NOTIFICATIONS` is asked for when the switch in Self → Alerts and limits is turned on |
| Versioning | versionCode 14 · versionName 1.5.6, set only in `android/app/build.gradle`; `vite.config.ts` reads both into `__APP_VERSION__`/`__APP_BUILD__` for the web code (and stops the build if they're missing) |
| Updates | Google Play in-app updates (`services/appUpdates.ts`; rules in `services/appUpdatePolicy.ts`), checked each time the main screen appears. Flexible by default: Google's prompt, download in the background, then an "Update ready · Restart" banner; "No thanks" quiets that version for 3 days. Required below `config/app.androidMinVersionCode` or at in-app update priority 4+: Google's full-screen update, and a blocking screen if the user backs out — only when Play offers an update, so it fails open. From 1.5.7 each check records what Play answered (`finding`: latest, available, downloading, ready, not-from-play, unavailable): the bell lists an update Play has even after "No thanks" ("Update available" → Google's dialog, else its full-screen update, else the store page), and Self → About has **Check for updates**, which asks again, skips the 3-day quiet and says the answer. Play only answers for a copy it installed: a build from Android Studio or an APK gets Install Error −10 (`ERROR_APP_NOT_OWNED`) and About says so. "What's new" (`services/releaseNotes.ts`) shows once after an update, never on a new install. Checklist: `docs/PLAY_SUBMISSION.md` §9; tests: `scripts/check-app-updates.mjs` |

**iOS (parked):** `npm run ios` + `patch-ios.ps1` prepare the Xcode project; a manual-trigger
GitHub Actions workflow (`ios-build.yml`) produces an unsigned IPA on free macOS runners for
sideloading. Dormant by decision — Android + web are the active targets.

---

## 7. Build, deploy & distribution

- **Android:** Google Play only. `npm run android:bundle` builds the signed AAB, uploaded in
  Play Console; `docs/PLAY_SUBMISSION.md` §9 is the per-release checklist. The website APK
  is retired: any new one would be `com.wallette.app` signed with the old key, which
  blocks installing the Play version.
- **Website and Firestore rules:** `npm run build`, then
  `npx firebase-tools deploy --only hosting,firestore:rules`. `npm run deploy` builds and
  deploys the website alone. wall-ette.com is Firebase Hosting; the Cloudflare Worker
  `wall-et` (`wrangler.jsonc`, July) is not the site, and `wrangler deploy` updates only
  that Worker.
- **`ship.ps1` is retired** (it exits at once) until audit item 14 reworks it; it used to
  build and host the APK, deploy, install on the phone and `git add -A` + push.

Web visitors on Android get an install banner (`AndroidInstallBanner`, UA-gated, dismissal
remembered) that opens Google Play, shown only once `PLAY_LISTING_PUBLIC` in
`utils/site.ts` is true. iOS/desktop visitors see nothing.

Dev loop: `npm run dev` (Vite on port 8080) · `npm run build` · `npm run android:build` (debug APK).

---

## 8. Security posture

- Per-UID Firestore rules; offline cache cleared on uninstall, sign-out and account deletion,
  and kept out of Android backups and device transfers. Release builds block screen capture.
- Biometric unlock (fingerprint/face, PIN/pattern fallback) at cold start and session re-lock;
  unlock attempts recorded to a per-user security log.
- Account recovery: password-reset panel on the login screen (says when no account uses the
  address, suggests fixes for mistyped mail domains, 30 s resend cooldown; shared logic in
  `services/passwordReset.ts`), a reset link on the lock screen, and in-app password change in
  Self → Security gated by fresh reauthentication with live strength rules. Firebase's
  password policy holds new passwords to the sign-up rules.
- Statement parsing is fully client-side; documents are never uploaded.
- No secrets in the repo: `.env` intentionally empty (documented no-secrets policy — `VITE_*`
  vars are public by nature), keystore lives in gitignored `private/`, and git history was
  scrubbed of statements/keys with `git-filter-repo` (July 2026).
- Firebase web config in `services/firebase.ts` is a public identifier by design, secured by rules.

---

## 9. Repository layout

```
/
├── App.tsx                # Shell: screen switch, gestures, lock, back handling
├── components/            # Screens + UI (lazy-loaded)
├── context/               # AuthContext, WalletContext
├── services/              # firebase, parsers (idfcParser, bankPdfLayouts, IDFCBankParser), analytics, insights, mfa
├── utils/                 # theme engine, biometric, exportFile, log, currencyUtils
├── public/                # favicon, terms.html, privacy.html (deployed statics)
├── android/               # Capacitor Android project (signing via key.properties / upload.properties)
├── ios/                   # Capacitor iOS project (parked)
├── .github/workflows/     # ios-build.yml (manual, unsigned IPA)
├── scripts/               # Dev tools: parser debugging, icon generation
├── docs/                  # Living docs (this file) + docs/archive/ for historical reports
├── private/               # NEVER committed: statements, keystore, old builds
└── ship.ps1               # Old release pipeline, retired for now (§7)
```

---

## 10. Known limitations & roadmap

- **TOTP MFA** — built end-to-end, parked as "Coming Soon" (needs Firebase console MFA toggle before enabling the UI).
- **iOS** — pipeline exists, product decision parked.
- **Android system bars** — follow the theme on every version with WebView 140+; with an
  older WebView they stay cream (Capacitor pads the page there).
- **Bank coverage** — IDFC FIRST (PDF + Excel), HDFC (Excel) and Kotak, Saraswat, Union Bank
  and SBI PDFs are read in their own layouts; other banks fall back to the generic
  balance-delta parser. HDFC PDFs saved with "Print to PDF" have no text: import the Excel.
- **Play Store** — submission checklist in `docs/PLAY_SUBMISSION.md`: Play App Signing with
  a new upload key (the old keystore was exposed, audit C2); the build is wired for it, the
  key itself is created by hand.
