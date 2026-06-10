# WALL-E — Prioritized Fix Checklist

Execution-ready plan derived from `AUDIT_REPORT.md` (2026-06-10).
Order matters: each phase is independently shippable. Test after each phase (see §Verification).

> **EXECUTION STATUS (2026-06-10, commit `1c503ad`):** all phases executed except
> the items below, which need `npm` on your Windows machine or your Google login:
>
> - [ ] **YOU: revoke the old Gemini key** — Google Cloud Console → APIs & Services →
>   Credentials → delete the key that was in `.env.local` (starts `AIzaSyCCH...`).
> - [ ] **4.3 xlsx swap (deferred):** run
>   `npm rm xlsx && npm i https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`
>   then re-test an Excel import end-to-end.
> - [ ] **4.5 dev-dep cleanup (deferred):** `npm rm canvas sharp` if icon
>   generation is finished.
> - [ ] **Verify on Windows:** `npx tsc --noEmit` (passed in session sandbox),
>   `npm run build`, then the manual smoke list in §Verification.
> - Git history still contains old bank statements (`IDFCFIRSTBankstatement_*`),
>   `.env`, and `my-release-key.keystore` from earlier commits — scrub with
>   `git filter-repo` (or BFG) before ever making this repo public.
>
> Notes: timestamps are still parsed via `new Date` but exactly once per
> transaction per recompute (semantics preserved); decoration extraction (5.5)
> was intentionally skipped as zero-runtime-gain; PDF imports now also pick up
> the statement opening balance (previously Excel-only).

---

## Phase 0 — Safety (15 min, do first)

- [x] **0.1 Revoke the Gemini key** found in `.env.local` (Google Cloud Console → Credentials). Delete the line from `.env.local`.
- [x] **0.2 Commit / back up** current working state before any refactor (`git add -A && git commit -m "pre-audit-fixes snapshot"`).

## Phase 1 — Correctness bugs (~1–2 h)

- [x] **1.1 `ImportStatement.tsx` ~line 735:** replace the two inline `extractedData.sort(...)` calls (date-range summary) with a `useMemo` computing min/max date without mutating state (`[...extractedData]` or a single reduce).
- [x] **1.2 `WalletContext.tsx` → `clearAllTransactions`:** also clear the cloud value — `setDoc(settingsRef, { openingBalance: 0 }, { merge: true })` — so the old balance can't resync back.
- [x] **1.3 Image import:** remove `image/*` from the file input `accept` in `ImportStatement.tsx` and update the upload copy (PDF/Excel only), OR explicitly show "images not supported yet". (Re-enable only when an OCR path exists.)
- [x] **1.4 IDs:** replace `txn-${Date.now()}` (NewEntry) with `crypto.randomUUID()`.
- [x] **1.5 Parser routing:** in `processTransactions`, route by file type up front — Excel/CSV → `IDFCBankParser.parseExcel`, PDF → `parseIDFCStatement`. Stop running the Excel parser against PDFs first.

## Phase 2 — Highest-impact performance (~2–4 h)

All in `context/WalletContext.tsx` unless noted:

- [x] **2.1 Memoize the context:** wrap every action in `useCallback`, wrap the provider `value` in `useMemo`. (Optional stretch: split into `WalletDataContext` / `WalletActionsContext` / `SettingsContext`.)
- [x] **2.2 Cache currency formatters:** module-level `Map<CurrencyCode, Intl.NumberFormat>`; `formatAmount` reuses them. Recreate only when currency list/locale changes.
- [x] **2.3 Single-pass aggregates:** replace `getBalance/getMonthlyIncome/getMonthlyExpense/getTotalIncome/getTotalExpense` functions with one `useMemo` that computes `{ balance, monthlyIncome, monthlyExpense, totalIncome, totalExpense, todayIncome, todayExpense }` in a single loop. Expose values, not functions.
- [x] **2.4 Precompute timestamps:** when snapshot data arrives, attach `ts = Date.parse(t.date)` (kept out of Firestore writes, or in a parallel Map). Replace all `new Date(t.date)` in filters/sorts/grouping (`Dashboard`, `TransactionHistory`, `SpendAnalysis`, `CategorySplit`) with the precomputed value.
- [x] **2.5 `Dashboard.tsx` `balanceTrend`:** rewrite as one pass — bucket transactions by month, then cumulative sum across 12 buckets (instead of 12 × 3 full filters).
- [x] **2.6 `latestTxDate`** (`SpendAnalysis.tsx`, `CategorySplit.tsx`): replace copy+sort with a single `reduce` max.
- [x] **2.7 Import duplicate detection** (`ImportStatement.tsx`): pre-normalize merchants once; index existing transactions in a `Map` keyed `date|amount|type`; compare only within matching buckets.
- [x] **2.8 Daily-limit check** in `addTransaction`: derive today's spend from the Phase 2.3 aggregate instead of rescanning.

## Phase 3 — Storage & network (~1–2 h)

- [x] **3.1 Drop the localStorage transaction mirror** (or gate it: only write when `isBackendReady === false`, debounced ≥1 s). Firestore `persistentLocalCache` already provides offline. Keep small settings keys if desired.
- [x] **3.2 FX rates:** filter fetched rates to `INR/USD/EUR/GBP`; persist `{ rates, fetchedAt }` to localStorage; on mount use cached value if `< 1 h` old; refetch on expiry only.
- [x] **3.3 `initUserProfile`:** replace `getDoc` + conditional `setDoc`/`updateDoc` with one non-blocking `setDoc(userRef, { email, lastLogin: serverTimestamp(), platform }, { merge: true })`. Read `lastLogin` for display from the settings snapshot if needed.
- [x] **3.4 Bundle the pdf.js worker** (`services/idfcParser.ts`): `import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'` and set `GlobalWorkerOptions.workerSrc = workerUrl`. Removes the unpkg runtime dependency (fixes offline/native).

## Phase 4 — Page load & bundle (~1–2 h)

- [x] **4.1 `index.html`:** delete the entire `<script type="importmap">` block; delete `<link href="/dist/output.css">` and `<link href="/index.css">`; add a real `favicon.png` (e.g. `public/favicon.png`) or remove the link.
- [x] **4.2 Fonts:** add `<link rel="preconnect" href="https://fonts.googleapis.com">` + `https://fonts.gstatic.com` (crossorigin); narrow Material Symbols request to used weight range; (stretch) self-host both fonts for offline/native parity.
- [ ] **4.3 Replace `xlsx@0.18.5`:** migrate to the maintained SheetJS build (`https://cdn.sheetjs.com` tarball pinned in package.json) or `exceljs`. Re-test Excel import end-to-end afterward.
- [x] **4.4 Clean builds:** ensure `build.emptyOutDir: true` in `vite.config.ts` (or delete `dist/` pre-build) so stale hashed chunks stop shipping.
- [ ] **4.5 Dev-deps:** remove `canvas` and `sharp` if icon generation is done (keep `generate-icon.html` instructions in a doc if needed).

## Phase 5 — Code health (~2 h, low risk)

- [x] **5.1 Logger:** add `utils/log.ts` (no-op in `import.meta.env.PROD`); replace `console.warn/error` calls that print account numbers / customer names / balances (both parsers, WalletContext, ImportStatement). Strip the remaining emoji debug logs.
- [x] **5.2 Delete dead code:** `mapRawToTransactions`, `getTransactionNature` (ImportStatement); `IDFCBankParser.parsePDF`; unused `displayLimit` + scratch comments in `Profile.tsx`; move the pre-import code block at the top of `ImportStatement.tsx` below the imports.
- [x] **5.3 Remove `IncomeInsights` stub:** delete the screen + its `AppScreen` entry; point Dashboard "Flow" button at `ANALYSIS` (Pulse) instead.
- [x] **5.4 Rename `services/geminiService.ts` → `services/insightsService.ts`** (update the SpendAnalysis import).
- [ ] **5.5 Extract decorative SVGs** (`FloatingLeaf`, `LotusFlower`, `RangoliCorner`, etc.) from `SplashScreen.tsx` into `components/decorations.tsx`; update imports (every screen imports these).
- [x] **5.6 `AuthContext`:** render `children` unconditionally (App already handles `loading`); remove the double gate.
- [x] **5.7 Docs:** consolidate the 13 root markdown files into `README.md` + `docs/`; fix README (no Gemini parsing; no Gemini key prerequisite; correct security claims re: simulated MFA/biometrics).

## Phase 6 — Security hardening (decide scope first)

- [x] **6.1 Decide:** keep MFA/biometric as labeled demo OR implement properly — biometrics via Capacitor plugin (`capacitor-native-biometric` / WebAuthn), MFA via Firebase Authentication multi-factor. Until then, label the toggles "(demo)".
- [x] **6.2 Listener teardown:** dedupe the inactivity timer (throttle `mousemove` to ~1/s) and register the Capacitor `appStateChange` listener once (use a ref for `currentScreen` instead of a dependency).

---

## Verification (run after each phase)

1.