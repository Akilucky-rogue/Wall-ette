# Wall-ette — Google Play Submission Guide

Everything needed to publish, in order. Items marked **[YOU]** need your account/judgment;
everything else is already prepared in the repo.

---

## 0. One-time accounts

- [ ] **[YOU]** Google Play Console developer account — https://play.google.com/console — $25 one-time, identity verification takes 1–2 days.

## 1. Signing (prepared)

- Gradle now signs release builds automatically when `android/key.properties` exists.
- [ ] **[YOU]** Find your key alias: `keytool -list -keystore my-release-key.keystore` (from project root, prompts for store password).
- [ ] **[YOU]** `Copy-Item android\key.properties.example android\key.properties` and fill in the password(s) + alias. The file is gitignored.
- When Play asks about **Play App Signing** during app creation: accept it (Google holds the final signing key; your keystore becomes the *upload key*). Recommended — it makes a lost keystore recoverable.

## 2. Build the AAB (prepared)

```powershell
npm run android:bundle
```
Output: `android\app\build\outputs\bundle\release\app-release.aab` (signed, versionCode 2 / versionName 1.1.0).
Each future upload must bump `versionCode` in `android/app/build.gradle`.

## 3. Privacy policy (prepared)

- Hosted at: **https://wall-e-7a113.web.app/privacy.html** (deploy hosting once after this commit).
- Paste that URL in Play Console → App content → Privacy policy.

## 4. Data safety form — answers that match the app

| Question | Answer |
|---|---|
| Does your app collect or share user data? | Collects: yes. Shares: **no** |
| Email address | Collected · App functionality (account management) · Not shared |
| Financial info → "Other financial info" | Collected (user-entered/imported transactions) · App functionality · Not shared |
| Data encrypted in transit? | **Yes** (Firebase TLS) |
| Can users request deletion? | **Yes** — in-app Clear All + email akshatbvora@gmail.com (per privacy policy) |
| Data processed ephemerally? | No |
| Ads / advertising ID | **None** |

## 5. Store listing — ready to paste

**App name:** Wall-ette
**Category:** Finance · **Tags:** personal finance, expense tracker
**Contact email:** akshatbvora@gmail.com

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

## 6. Remaining Play Console forms (~20 min, all simple)

- [ ] Content rating questionnaire → finance app, no objectionable content → rates "Everyone".
- [ ] Target audience: 18+ (finance) or 13+; pick 18+ to keep it simple.
- [ ] App access: provide a **test account** (create a dummy email/password in the app) so reviewers can log in. Note in the access instructions: "Statement import is optional; sample data can be added via New Entry."
- [ ] Government apps / financial features declaration: Wall-ette is a **personal expense tracker** — it does NOT provide loans, banking, investments, or money transfer. Declare "None of the above" in the Financial features form.
- [ ] Countries: start with India (+ anywhere else you like).

## 7. Rollout

- [ ] Upload the AAB to **Internal testing** first, install via the test link on your own phone, sanity-check.
- [ ] Promote to **Production** → submit for review. First review typically 1–7 days.

## Done already (for the reviewer's benefit)

- Target SDK 35 ✓ (meets current Play policy)
- No simulated security features (demo MFA/biometric removed in v1.1.0)
- Privacy policy live and accurate ✓ · No ads SDK ✓ · Data safety answers match actual behavior ✓
