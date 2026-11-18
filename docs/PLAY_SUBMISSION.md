# Wall-ette — Google Play Submission Guide

Everything needed to publish, in order. Items marked **[YOU]** need your account/judgment;
everything else is already prepared in the repo.

---

## 0. One-time accounts

- [x] **[YOU]** Google Play Console developer account (personal) — https://play.google.com/console — verified.
- [ ] **[YOU]** Trader status: Play Console → Manage account → Account details → About you. It covers every app on the account, not just Wall-ette, and can be changed later.
  - Recommended: **trader**. Paid memberships are planned, and Google counts payments you "receive or intend to receive" as a sign of trading.
  - On a personal account, a trader's phone number and address are shown on the store page to all users from 1 March 2027, and each app needs a terms link (`https://wall-ette.com/terms.html`).
  - To show business details instead: register the business, get a free D-U-N-S number, verify `wall-ette.com` as its website, then convert this account to an organization account (one way only).

## 1. Signing: a new upload key

The keystore in `private/` was exposed in an old pull request (audit C2), so Google Play gets a new upload key. The website APK keeps the old key (`android/key.properties`), so phones that installed it still take updates.

- [x] **[YOU]** Create the upload key outside the repo folder. keytool asks for a password: make it long, and save it in your password manager.
  ```powershell
  New-Item -ItemType Directory "$env:USERPROFILE\wallette-keys" -Force
  keytool -genkeypair -v -keystore "$env:USERPROFILE\wallette-keys\wallette-upload.jks" -alias upload -keyalg RSA -keysize 2048 -validity 10000
  ```
- [x] **[YOU]** `Copy-Item android\upload.properties.example android\upload.properties`, then set `storeFile` to the keystore's full path, with forward slashes, and both passwords (the same password, for keytool's default keystore type). The file is gitignored. Check it with `cd android; .\gradlew :app:signingReport -Pplay`: the release variant should show `wallette-upload.jks` and alias `upload`.
- [x] **[YOU]** Back up `wallette-upload.jks` somewhere other than this PC.
- When Play asks about **Play App Signing** during app creation: accept it. Google holds the app signing key and your keystore is only the *upload key*, so Play support can reset it if it's ever lost.

## 2. Build the AAB

```powershell
npm run android:bundle
```
Output: `android\app\build\outputs\bundle\release\app-release.aab`, signed with the upload key. The build stops with a message if `android/upload.properties` is missing.
Each upload must bump `versionCode` (and `versionName`) in `android/app/build.gradle`.

## 3. Web address

The app, the privacy policy and the terms point to **wall-ette.com**. The contact email stays **akshatbvora@gmail.com**.

- [x] **[YOU]** Firebase console → Hosting → **Add custom domain** → `wall-ette.com`. DNS at GoDaddy: A `@` → `199.36.158.100`, TXT `@` → `hosting-site=wall-e-7a113`, CNAME `www` → `wall-e-7a113.web.app`.
- [x] **[YOU]** `www.wall-ette.com`, `wall-ette.in` and `www.wall-ette.in` added the same way, each **redirecting** to `wall-ette.com`.
- [x] **[YOU]** Firebase console → Authentication → Settings → **Authorized domains**: `wall-ette.com` and `www.wall-ette.com` added.
- [ ] **[YOU]** If the Firebase web API key is restricted to certain websites (Google Cloud console → APIs & Services → Credentials), add `https://wall-ette.com/*`.
- `https://wall-e-7a113.web.app` keeps serving the same site. Web users who move to the new address sign in again there, because browser storage is per domain.

## 4. Privacy policy and account deletion (prepared)

- Privacy policy: **https://wall-ette.com/privacy.html** → Play Console → App content → Privacy policy.
- Delete account URL (asked in the Data safety form): **https://wall-ette.com/privacy.html#delete**. That section describes deleting the account in the app (Profile → Delete account & all data) and by email.
- The live pages are the June version until the next hosting deploy; the new deletion section goes live with it.

## 5. Data safety form — answers that match the app

| Question | Answer |
|---|---|
| Does your app collect or share user data? | Collects: yes. Shares: **no** |
| Email address | Collected · App functionality (account management) · Not shared |
| Financial info → "Other financial info" | Collected (user-entered/imported transactions) · App functionality · Not shared |
| App activity → "App interactions" | Collected (unlock attempts: time and method, for the in-app security log) · App functionality; Fraud prevention, security, and compliance · Not shared |
| Data encrypted in transit? | **Yes** (Firebase TLS) |
| Can users request deletion? | **Yes** — in the app (Profile → Delete account & all data), or by email to akshatbvora@gmail.com; URL in section 4 |
| Data processed ephemerally? | No |
| Ads / advertising ID | **None** |

## 6. Store listing — ready to paste

**App name:** Wall-ette · **Package name:** `com.wallet.walle` (permanent; it must match the AAB)
**Category:** Finance · **Tags:** personal finance, expense tracker
**Contact email:** akshatbvora@gmail.com (shown publicly on Google Play) · **Website:** https://wall-ette.com

**Short description (≤80 chars):**
> Mindful expense tracker: import bank statements, get insights, stay on budget.

**Full description:**
> Wall-ette is a calm, private way to understand your money.
>
> 🌿 MINDFUL BY DESIGN — A zen, clutter-free interface that makes checking your finances a pleasant ritual instead of a chore.
>
> 📄 IMPORT YOUR BANK STATEMENTS — Drop in an IDFC FIRST Bank PDF or Excel statement and Wall-ette parses every transaction on your device — the file never leaves your phone. Automatic categorization tuned for Indian merchants and UPI, with duplicate detection built in.
>
> 📊 INSIGHTS THAT MEAN SOMETHING — A live Pulse of your spending: month-over-month category shifts, a daily spending heatmap, weekday patterns, budget pace projection, and automatic detection of recurring charges and subscriptions.
>
> 💼 KNOW YOUR INCOME — Income stream classification (fixed / recurring / one-off), an income stability score, next-pay countdown, and a money-flow diagram from sources to spending to savings.
>
> 🔐 PRIVATE & SECURE — Email + password sign-in, automatic session lock, per-user encrypted cloud sync via Google Firebase, full offline support. All insights are computed locally — no AI services, no ads, no data selling. Export or back up everything, anytime.
>
> 💱 MULTI-CURRENCY — INR, USD, EUR and GBP with live exchange rates.
>
> Wall-ette — your mindful money companion.

**Graphics (in `store-assets/`):**
- [x] App icon 512×512 — `store-assets/icon-512.png`
- [x] Feature graphic 1024×500 — `store-assets/feature-graphic-1024x500.png`
- [ ] **[YOU]** 2–8 phone screenshots (just screenshot the installed app: Dashboard, Pulse, Flow, Import).

## 7. Remaining Play Console forms (~20 min, all simple)

- [ ] Content rating questionnaire → finance app, no objectionable content → rates "Everyone".
- [ ] Target audience: 18+ (finance) or 13+; pick 18+ to keep it simple.
- [ ] App access: provide a **test account** (create a dummy email/password in the app) so reviewers can log in. Note in the access instructions: "Statement import is optional; sample data can be added via New Entry."
- [ ] Ads: **No**. Advertising ID: **No** (the app doesn't use it).
- [ ] Government apps: No. Financial features: Wall-ette is a **personal expense tracker** — it does NOT provide loans, banking, payments, investments or advice. Declare "My app doesn't provide any financial features".
- [ ] Countries: start with India (+ anywhere else you like).

## 8. Testing and release

A new personal account can't release to Production until a closed test has had **at least 12 testers opted in for 14 days in a row**.

- [ ] **Internal testing:** upload the AAB and install it from the test link on your phone. Uninstall the website APK first: apps from Play carry Google's signature, so the two can't update each other. Your data comes back after you sign in.
- [ ] **Closed testing:** add the testers by email list or Google Group and send them the opt-in link. They must stay opted in for 14 days in a row (leaving restarts their count). Keep notes of their feedback.
- [ ] Dashboard → **Apply for production**. It asks about the closed test (recruiting, engagement, feedback), the app (audience, value, expected installs) and readiness (what you changed after testing). Review usually takes up to 7 days.
- [ ] **Production:** create the release and submit it for review (typically 1–7 days).

Later, paid memberships go through Google Play's billing: set up a merchant payments profile in Play Console before adding them as subscriptions.

## Done already (for the reviewer's benefit)

- Target SDK 36 ✓ (Play's requirement since 31 Aug 2026)
- No simulated security features (demo MFA/biometric removed in v1.1.0)
- Privacy policy live and accurate ✓ · No ads SDK ✓ · Data safety answers match actual behavior ✓
