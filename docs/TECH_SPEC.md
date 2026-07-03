# Wall-ette — Technical Specification

**Version:** 1.5.1 (versionCode 8) · **App ID:** `com.wallet.walle` · **Updated:** 3 July 2026
**Live web:** https://wall-e-7a113.web.app · **Repo:** https://github.com/Akilucky-rogue/Wall-ette

Wall-ette is an offline-first personal finance tracker for web and Android. Users record
transactions manually or import real bank statements (PDF/Excel), and the app reconstructs a
balance-accurate ledger with local-only analytics. No ads, no trackers, no AI/API calls —
every insight is computed on the device.

---

## 1. Stack at a glance

| Layer | Technology | Version |
|---|---|---|
| UI framework | React + React DOM | 19.2 |
| Language | TypeScript (strict) | 5.8 |
| Build tool | Vite (`@vitejs/plugin-react` 5.1) | 7.3 |
| Styling | Tailwind CSS + PostCSS + Autoprefixer | 3.3 / 8.4 / 10.4 |
| Native shell | Capacitor | 8.4 |
| Backend | Firebase (Auth + Firestore + Hosting) | JS SDK 11.10 |
| PDF parsing | pdfjs-dist (worker bundled locally) | 5.4 |
| Excel parsing | SheetJS `xlsx` (pinned CDN tarball) | 0.20.3 |
| QR generation | `qrcode` (TOTP enrollment) | 1.5 |
| Android toolchain | AGP 8.13 · Gradle 8.14.3 · JDK 21 (Temurin) | SDK 24 → 35 |
| Fonts | Inter (sans) · Crimson Pro (serif) · Material Symbols Outlined | Google Fonts CDN |

Dev-only: `typescript-plugin-css-modules` (typed CSS modules), `@types/*` for node/react/qrcode.

---

## 2. Frontend architecture

### 2.1 App shell & navigation
- **Single-shell state machine** — `App.tsx` switches screens via an `AppScreen` enum; no router
  library. Every screen is a `React.lazy` chunk, so the initial bundle stays lean
  (largest lazy chunks: ImportStatement ~412 kB incl. parsers, pdf.js ~404 kB, SpendAnalysis ~47 kB).
- **Gesture navigation** — app-wide swipe handling on the shell div: horizontal swipes move
  through `TAB_ORDER` (Home → History → Analysis → Self); sub-screens swipe back to their
  `BACK_TARGET` parent. Scrollable/interactive elements (`.overflow-x-auto`, inputs, svg,
  canvas) are excluded. Thresholds: ≥70 px, ≤600 ms, dx > 1.5·dy.
- **Android system back** — Capacitor `backButton` listener mirrors the same map:
  sub-screen → parent, tab → Home, Home → `minimizeApp()`.
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
- Native side: `@capacitor/status-bar` recolors the Android status bar per theme; a
  `theme-color` meta keeps browser chrome in sync on web.
- Deliberately theme-independent: mascot, splash art, exported statement HTML, and the
  shareable Wrapped card (brand-stable artifacts).

### 2.3 State management
Plain React context — no Redux/Zustand.
- **`AuthContext`** — Firebase Auth session state.
- **`WalletContext`** — transactions, opening balance (+ `openingBalanceAsOf` anchor),
  budgets, savings goal, daily spend limit, currency. Includes batched bulk ops
  (`deleteTransactions` via Firestore `writeBatch` chunks) and an instant, optimistic
  `clearAllTransactions` (local state clears immediately; cloud deletion continues in the
  background).
- Device-local prefs (theme, biometric opt-in, banner dismissals) live in `localStorage`.

---

## 3. Backend (Firebase project `wall-e-7a113`)

| Service | Use |
|---|---|
| **Authentication** | Email/password sign-in. TOTP MFA (authenticator apps) is fully implemented via `TotpMultiFactorGenerator` + QR enrollment but parked behind a "Coming Soon" UI. |
| **Firestore** | Per-user data under `users/{uid}` (transactions, settings, security log, consent record). `persistentLocalCache` gives offline-first behavior with automatic sync. |
| **Security rules** | `firestore.rules` — strict per-UID isolation; a user can only read/write their own subtree. |
| **Hosting** | Serves `dist/` as an SPA (`** → /index.html` rewrite) plus the self-hosted APK at `/downloads/wall-ette.apk`. |

External network calls are limited to: Firebase, Google Fonts, and `exchangerate-api.com`
(public FX rates for the currency selector). Statement files never leave the device.

**Consent gate** — new registrations must accept Terms & Privacy (version `2026-06-11`);
acceptance is recorded with a server timestamp for auditability. Existing logins are unaffected.

---

## 4. Statement import engine

The heart of the app. Rule-based and deterministic — no AI, no network.

- **PDF path** (`services/idfcParser.ts`) — pdf.js text items carry x/y coordinates; header
  label midpoints define column intervals, wrapped description lines are re-glued, and each
  row's debit/credit type is **verified against the running balance column**. A generic
  balance-delta parser is the fallback for unknown layouts.
- **Excel path** (`services/IDFCBankParser.ts`) — SheetJS row parsing with IST-safe local
  date handling (`toLocalISO`, avoiding the UTC date-shift bug class).
- **Order-independent correctness** — statements can be imported in *any* order:
  - stable content-hash transaction IDs;
  - count-aware duplicate claiming (each existing row absorbs at most one incoming duplicate;
    exact-merchant matches claim before fuzzy);
  - opening-balance anchoring to the earliest statement (`openingBalanceAsOf`);
  - forward/backward coverage-gap detection with optional single bridge adjustment
    (auto-deleted when a later import fills the window);
  - a tally card comparing the wallet balance *as of statement end* against the statement's
    own closing balance.
  - Validated by simulation: 300 shuffled import orders of 15 real statements converge to an
    identical, to-the-rupee ledger.
- **Review UI** — paginated review with per-row edit, category auto-suggestion (Indian
  merchant/UPI regex patterns), duplicate flags, and a confirm()-guarded "Include Anyway".

---

## 5. Analytics (all on-device)

- **`analyticsService.ts`** — `prettyMerchant` (strips UPI rails/refs/IFSC noise from
  narrations), Fee Hunter (`huntSavings`: rail-guarded bank-fee regexes, subscription price-creep
  with CV ≤ 0.15 stability gate, same-day repeats surfaced for review only), recurring-charge
  detection, income-stability tiers, daily-spend stats.
- **`insightsService.ts`** — savings rate, anomaly detection (3× median), 50/30/20 budget heuristic.
- **Moved-vs-spent separation** — Transfer Out / Adjustment / Investment count in cash-flow
  totals but are excluded from every *spending* analysis (reports, Category Split, heatmaps).
- **Feature screens** — Pulse (daily/heatmap), Category Split (interactive SVG donut with
  merchant drill-down), Income Insights, Fee Hunter, Rewind (lifetime timeline) with
  exportable "Wall·ette Wrapped" canvas cards.

---

## 6. Native Android build

| Item | Value |
|---|---|
| Capacitor plugins | app 8.0.1 · filesystem 8.1.2 · share 8.0.1 · status-bar 8.0.2 · `@aparajita/capacitor-biometric-auth` 10.0 |
| SDK levels | minSdk 24 · target/compileSdk 35 |
| Toolchain | Gradle 8.14.3 · AGP 8.13 · JDK 21 (Temurin); `patch-capacitor-gradle.ps1` pins plugin modules to Java 17 |
| Signing | PKCS12 keystore at `private/my-release-key.keystore`, wired via gitignored `android/key.properties` |
| Windowing | `windowOptOutEdgeToEdgeEnforcement` + fixed status/nav bar colors in `styles.xml`; status bar recolored at runtime per theme |
| Versioning | versionCode 7 · versionName 1.5.0 |

**iOS (parked):** `npm run ios` + `patch-ios.ps1` prepare the Xcode project; a manual-trigger
GitHub Actions workflow (`ios-build.yml`) produces an unsigned IPA on free macOS runners for
sideloading. Dormant by decision — Android + web are the active targets.

---

## 7. Build, deploy & distribution

`ship.ps1` — the one-command release pipeline:

1. `tsc` typecheck (aborts the ship on any error)
2. `npm run android:release` → Vite build → `cap sync android` → Gradle `assembleRelease` (auto-signed)
3. Stage APK into `dist/downloads/wall-ette.apk`
4. `firebase deploy` (web + hosted APK)
5. `adb install` to the connected phone (non-fatal if absent)
6. `git commit` + push

Web visitors on Android get an install banner (`AndroidInstallBanner`, UA-gated, dismissal
remembered) pointing at the hosted APK. iOS/desktop visitors see nothing.

Dev loop: `npm run dev` (Vite on port 8080) · `npm run build` · `npm run android:build` (debug APK).

---

## 8. Security posture

- Per-UID Firestore rules; offline cache cleared on uninstall.
- Biometric unlock (fingerprint/face, PIN/pattern fallback) at cold start and session re-lock;
  unlock attempts recorded to a per-user security log.
- Account recovery: anti-enumeration password-reset flow on the login screen (dedicated panel,
  30 s resend cooldown), a reset-link escape hatch on the lock screen, and in-app password
  change in Self → Security gated by fresh reauthentication with live strength rules.
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
├── services/              # firebase, parsers (idfcParser, IDFCBankParser), analytics, insights, mfa
├── utils/                 # theme engine, biometric, exportFile, log, currencyUtils
├── public/                # favicon, terms.html, privacy.html (deployed statics)
├── android/               # Capacitor Android project (signing via key.properties)
├── ios/                   # Capacitor iOS project (parked)
├── .github/workflows/     # ios-build.yml (manual, unsigned IPA)
├── scripts/               # Dev tools: parser debugging, icon generation
├── docs/                  # Living docs (this file) + docs/archive/ for historical reports
├── private/               # NEVER committed: statements, keystore, old builds
└── ship.ps1               # One-command release pipeline
```

---

## 10. Known limitations & roadmap

- **TOTP MFA** — built end-to-end, parked as "Coming Soon" (needs Firebase console MFA toggle before enabling the UI).
- **iOS** — pipeline exists, product decision parked.
- **Android navigation bar** — stays cream on dark themes (status bar follows the theme; the
  bottom bar needs an extra plugin — known cosmetic niggle).
- **Bank coverage** — first-class parser for IDFC FIRST (PDF + Excel); other banks fall back
  to the generic balance-delta parser.
- **Play Store** — submission checklist in `docs/PLAY_SUBMISSION.md`; plan is Play App Signing
  with a fresh upload key (the historical keystore exposure makes rotation prudent).
