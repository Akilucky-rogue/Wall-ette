# Wall-ette — Technical Specification

**Version:** 1.5.3 (versionCode 11) · **App ID:** `com.wallette.app` (Android; builds before Play and the iOS project use `com.wallet.walle`) · **Updated:** 19 November 2026
**Live web:** https://wall-ette.com · **Repo:** https://github.com/Akilucky-rogue/Wall-ette

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
- Native side: on Android 15+ the page draws behind both system bars, so they show the
  theme color (see §6, Windowing); Capacitor's `SystemBars` sets their icon colors per
  theme. On Android 14 and older `@capacitor/status-bar` tints the status bar and the
  navigation bar stays cream. A `theme-color` meta keeps browser chrome in sync on web.
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
| **Security rules** | `firestore.rules` — strict per-UID isolation; a user can only read/write their own subtree. Security log entries can be created and deleted by their owner (so account deletion erases them) but never edited. One shared read-only document, `config/app` (signed-in `get` only, edited in the console), holds app switches such as `androidMinVersionCode`. |
| **Hosting** | Serves `dist/` as an SPA (`** → /index.html` rewrite). The self-hosted APK at `/downloads/wall-ette.apk` was removed on 19 Nov 2026. |

External network calls are limited to: Firebase, Google Fonts, `exchangerate-api.com`
(public FX rates for the currency selector) and, on Android, Google Play's update check.
Statement files never leave the device.

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
| Capacitor plugins | app 8.0.1 · filesystem 8.1.2 · share 8.0.1 · status-bar 8.0.2 · `@aparajita/capacitor-biometric-auth` 10.0 · `@capawesome/capacitor-app-update` 8.1.1 (Play in-app updates) |
| SDK levels | minSdk 24 · target/compileSdk 36 (Play's minimum from 31 Aug 2026) |
| Toolchain | Gradle 8.14.3 · AGP 8.13 · JDK 21 (Temurin); `patch-capacitor-gradle.ps1` pins plugin modules to Java 17 |
| Signing | Website APK: PKCS12 keystore at `private/my-release-key.keystore` via gitignored `android/key.properties` (exposed in audit C2; due to be retired). Google Play: a new upload key via gitignored `android/upload.properties`, used by `npm run android:bundle` (`-Pplay`); see `docs/PLAY_SUBMISSION.md` |
| Windowing | Edge to edge on Android 15+ (target 36 has no opt-out). Capacitor's `SystemBars` passes the bar insets to CSS; `index.html` turns them into `--sat`/`--sab`, pads the body and paints strips under both bars. Fixed top/bottom UI must add `var(--sat)`/`var(--sab)`. The 3-button nav bar scrim is off (`enforceNavigationBarContrast`); the cream colors in `styles.xml` apply on Android 14 and older |
| Versioning | versionCode 11 · versionName 1.5.3, set only in `android/app/build.gradle`; `vite.config.ts` reads both into `__APP_VERSION__`/`__APP_BUILD__` for the web code (and stops the build if they're missing) |
| Updates | Google Play in-app updates (`services/appUpdates.ts`; rules in `services/appUpdatePolicy.ts`), checked each time the main screen appears. Flexible by default: Google's prompt, download in the background, then an "Update ready · Restart" banner; "No thanks" quiets that version for 3 days. Required below `config/app.androidMinVersionCode` or at in-app update priority 4+: Google's full-screen update, and a blocking screen if the user backs out — only when Play offers an update, so it fails open. "What's new" (`services/releaseNotes.ts`) shows once after an update, never on a new install. Checklist: `docs/PLAY_SUBMISSION.md` §9; tests: `scripts/check-app-updates.mjs` |

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
  `npx firebase-tools deploy --only hosting,firestore:rules`.
- **`ship.ps1` is retired** (it exits at once) until audit item 14 reworks it; it used to
  build and host the APK, deploy, install on the phone and `git add -A` + push.

Web visitors on Android get an install banner (`AndroidInstallBanner`, UA-gated, dismissal
remembered) that opens Google Play, shown only once `PLAY_LISTING_PUBLIC` in
`utils/site.ts` is true. iOS/desktop visitors see nothing.

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
- **Android navigation bar** — follows the theme on Android 15+; on Android 14 and older it
  stays cream on dark themes (recoloring it there needs an extra plugin — cosmetic niggle).
- **Bank coverage** — first-class parser for IDFC FIRST (PDF + Excel); other banks fall back
  to the generic balance-delta parser.
- **Play Store** — submission checklist in `docs/PLAY_SUBMISSION.md`: Play App Signing with
  a new upload key (the old keystore was exposed, audit C2); the build is wired for it, the
  key itself is created by hand.
