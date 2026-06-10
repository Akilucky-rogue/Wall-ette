# Wall-ette — Project Audit Report

**Date:** 2026-06-10
**Scope:** Full source audit (all `.ts`/`.tsx`, configs, rules, build output). No code was changed.
**Companion file:** `FIX_CHECKLIST.md` (prioritized, execution-ready)

---

## 1. Project Summary

| Aspect | Detail |
|---|---|
| Stack | React 19 + Vite 7 + Tailwind 3, TypeScript 5.8 |
| Mobile | Capacitor 8 (Android), `webDir: dist` |
| Backend | Firebase Auth + Firestore (`persistentLocalCache` enabled), no server code |
| Deployed | https://wall-e-7a113.web.app |
| Import pipeline | Rule-based IDFC parsers — `services/IDFCBankParser.ts` (Excel/CSV), `services/idfcParser.ts` (PDF via pdfjs-dist) |
| Insights | `services/geminiService.ts` — fully local/offline despite the name (Gemini API removed after key leak) |
| State | `context/AuthContext.tsx`, `context/WalletContext.tsx` (god-object: data + CRUD + sync + FX + formatting) |
| Screens | Dashboard, History (Vault), NewEntry, SpendAnalysis (Pulse), CategorySplit, IncomeInsights (stub), IgnoreRules, Import, Export, Profile |

**What's already good:** lazy loading + code splitting works (verified in `dist/assets` — separate chunks per screen + pdf chunk), Firestore rules are correctly per-user scoped with field validation, Firestore offline cache is enabled, console.log/info/debug are stripped in prod builds, batched writes are chunked at the 500 limit.

---

## 2. Critical Findings (fix before optimizing)

### 2.1 Live API key in `.env.local`
`VITE_GEMINI_API_KEY=AIzaSy...` still present. Nothing references it, and `*.local` is gitignored, but this app has leaked a key before. **Revoke it in Google Cloud Console.**

### 2.2 `clearAllTransactions` resurrects opening balance
`WalletContext.tsx` — resets `openingBalance` in local state + localStorage only. The Firestore `settings/preferences` doc keeps the old value, so the next snapshot restores it. Cloud delete is missing.

### 2.3 State mutation in render — `ImportStatement.tsx` (~line 735)
The "Dates: X to Y" summary calls `extractedData.sort(...)` **twice inline in JSX**. `.sort()` mutates the state array in place on every render of the review screen (also reorders pagination unexpectedly).

### 2.4 Image import is a dead feature
File input accepts `image/*`, but since the AI path was removed there is no OCR. Image uploads always fail after a fake "processing" animation.

### 2.5 Simulated security presented as real
- `SecurityLock.tsx`: MFA accepts **any** 6-digit code; biometric unlock is a `setTimeout` that always succeeds.
- README claims "Fully Secured". Either implement (WebAuthn / Firebase MFA) or label as demo.

---

## 3. Runtime Performance (highest-impact wins)

All in or caused by `context/WalletContext.tsx`:

1. **No memoization anywhere.** The context `value` is a new object every render; every function is recreated each render. Any state change (including the hourly FX refetch) re-renders **every** consumer screen. Fix: `useMemo` the value, `useCallback` the actions — or split into WalletData / WalletActions / Settings contexts.
2. **`formatAmount` builds `new Intl.NumberFormat` per call.** Intl construction is expensive and this is called dozens of times per Dashboard render. Cache one formatter per currency code.
3. **Repeated full-array scans.** `getBalance/getMonthlyIncome/getMonthlyExpense/getTotalIncome/getTotalExpense` each scan all transactions per call. `Dashboard.tsx` adds ~10 more separate passes; `balanceTrend` alone does 12 months × 3 filters with `new Date()` per transaction (~36n Date allocations). Fix: one single-pass aggregation `useMemo`.
4. **`new Date(t.date)` re-parsed everywhere** (filters, sorts, grouping in History/Dashboard/SpendAnalysis/CategorySplit). Compute epoch ms once per transaction at load.
5. **`latestTxDate`** (`SpendAnalysis.tsx`, `CategorySplit.tsx`): copies and sorts the entire array to find a max — O(n log n) vs a single O(n) `reduce`.
6. **Import duplicate detection** is O(new × existing) with `normalizeMerchant` recomputed per comparison. Pre-normalize once; index existing transactions in a `Map` keyed `date|amount|type`.
7. **`addTransaction` daily-limit check** rescans all transactions with `toDateString()` per item on every add.
8. Minor: inactivity-lock effect re-subscribes 4 window listeners on each lock flip; un-throttled `mousemove` resets a timer continuously; `appStateChange` listener re-registers on every screen change (dep: `currentScreen`).

---

## 4. Storage & Network

1. **Triple persistence is redundant.** React state + a **full `JSON.stringify` of all transactions to localStorage on every snapshot/add/edit/delete** + Firestore's own IndexedDB persistent cache. Firestore already provides offline. Drop the localStorage mirror (or debounce it and keep it only as a backend-unavailable fallback).
2. **Double state-set per write:** optimistic update then `onSnapshot` echo — each write sets state (and re-serializes to localStorage) twice.
3. **FX rates:** stores ~160 currency rates in state when 4 are supported; hourly refetch changes context identity → app-wide re-render. Filter to `INR/USD/EUR/GBP`, persist with TTL, refetch only when stale.
4. **`initUserProfile`:** `getDoc` + `updateDoc` (2 round trips) at every startup → single fire-and-forget `setDoc(..., { merge: true })`.
5. **pdf.js worker loads from unpkg CDN at runtime** (`idfcParser.ts`) → breaks offline/native Android and is a supply-chain risk. Bundle locally via `?url` import.

---

## 5. Bundle & Page Load (`index.html` → shipped in `dist/index.html`)

1. **Stale importmap shipped to production** pointing react / firebase **10.8.0** (installed: 11.x) / xlsx / `@google/genai` at CDNs. Unused by the bundled code — dead weight, version confusion, supply-chain surface. Remove.
2. **Dead resource links → 404 on every load:** `/dist/output.css`, `/index.css`, `/favicon.png` (none exist).
3. **Fonts:** two render-blocking Google Fonts stylesheets, no `preconnect`; Material Symbols pulls the full variable axis range; icons vanish offline on Android. Self-host subset (or at minimum add preconnect + `display=swap` icon subset).
4. **`xlsx@0.18.5` (npm)** is abandoned with known CVEs (CVE-2023-30533 prototype pollution, CVE-2024-22363 ReDoS). It is lazily chunked (good), but migrate to the maintained SheetJS dist or `exceljs`.
5. **`dist/` contains stale duplicate chunks** from older builds — enable `build.emptyOutDir` / clean before deploy.
6. `canvas` + `sharp` in devDependencies are heavy native deps apparently used only for one-off icon generation (`generate-icon.html`).

---

## 6. Code Health

- **~158 `console.*` calls.** Prod build strips `log/info/debug` but keeps `warn`/`error`, several of which print **account numbers, customer names, balances** (parsers, WalletContext). Route through a no-op-in-prod logger.
- **Dead code:** `mapRawToTransactions` and `getTransactionNature` (ImportStatement), `IDFCBankParser.parsePDF` (never called), `IncomeInsights` stub screen (still navigable from Dashboard "Flow"), unused `displayLimit` state + leftover stream-of-thought comments in `Profile.tsx`, code-before-imports at the top of `ImportStatement.tsx`.
- **Parser routing waste:** for PDFs, the flow first runs the *Excel* parser against the PDF (guaranteed throw) before the real PDF parser. Route by file type upfront; the ID-hash + validation mapping logic is duplicated 3×.
- **ID collisions possible:** `txn-${Date.now()}` (NewEntry) — use `crypto.randomUUID()`.
- **Docs sprawl:** 13+ overlapping root markdown files; README still advertises Gemini 3 Pro parsing that no longer exists and instructs creating a Gemini key.
- `AuthContext` gates children on `!loading` while `App.tsx` also checks `loading` (double gate, dead branch).
- `geminiService.ts` name is misleading — it is a local analyzer; rename to `insightsService.ts`.

---

## 7. Gemma 4 12B Relevance Assessment

Re: https://developers.googleblog.com/gemma-4-12b-the-developer-guide/

**Verdict: not useful for the app as shipped; marginally useful for development.**

- **Production: no.** Gemma 4 12B needs ~16GB VRAM/unified memory — it runs on a dev laptop, not in an Android WebView, and this architecture deliberately has no backend to host it. Self-hosting a GPU server contradicts the Firebase-only design. If AI categorization should return to production safely (without the previous key-in-bundle failure mode), **Firebase AI Logic** is the architecture-fit answer.
- **Development: maybe.** `litert-lm serve` exposes an OpenAI-compatible local server — usable to batch-test categorization/parsing of real bank statements fully offline (bank data never leaves the machine, no key to leak), or as a free local coding agent.
- **Future:** native image input fits the currently-broken image/receipt import, and the encoder-free architecture simplifies LoRA fine-tuning on statement screenshots — but only with a desktop companion or server. For on-device Android AI, the right family is the small Gemma edge models (E2B/E4B via Google AI Edge), not 12B.

---

## 8. Bottom Line

The three changes that remove most perceptible sluggishness, at near-zero risk:

1. Memoize `WalletContext` (value + actions) and cache `Intl.NumberFormat` instances.
2. Drop/debounce the localStorage transaction mirror (Firestore cache already covers offline).
3. Clean `index.html` (importmap + dead links + font preconnect).

See `FIX_CHECKLIST.md` for the full ordered plan.
