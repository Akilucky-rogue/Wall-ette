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

The keystore in `private/` was exposed in an old pull request (audit C2), so Google Play gets a new upload key. The website APK still signs with the old key (`android/key.properties`). Since the app ID moved to `com.wallette.app`, old installs can't update in place anyway, so that key can be retired: sign website APKs with a new key, or link to Google Play once the app is live.

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

It also needs `android/app/google-services.json`, the Android app's Firebase config for Crashlytics (from 1.5.5). The Android app `com.wallette.app` was registered in Firebase on 20 Nov. The file is gitignored like the signing files, and the build stops with the command to fetch it again:
```powershell
npx firebase-tools apps:sdkconfig ANDROID 1:881370415293:android:b9d1da6f023d700e1877d4 --project wall-e-7a113 --out android/app/google-services.json
```
The release build runs R8 (from 1.5.5), and the Crashlytics Gradle plugin uploads its mapping file, so the build needs a network connection. The bundle carries the mapping file for Play too: nothing to upload by hand under "Deobfuscation files".

Each upload must bump `versionCode` (and `versionName`) in `android/app/build.gradle`. Section 9 has the checklist for every update.

**Play Console notes on release 12 (1.5.4), 20 Nov:**
- *DEX code optimization below our threshold: Obfuscation 1%* (fix by Feb 2027): R8 is on from 1.5.5. The percentage updates once Play has analysed that release.
- *Edge-to-edge may not display for all users*: from 1.5.5 `MainActivity` calls `EdgeToEdge.enable`, as the note suggests.
- *Your app uses deprecated APIs or parameters for edge-to-edge*: the StatusBar plugin and the theme's bar colours that set them are gone in 1.5.5. androidx's own `EdgeToEdge` still calls the deprecated setters on Android 14 and older, so Play may keep naming `androidx.activity.EdgeToEdgeApi…`; that's Google's recommended code, and the note doesn't block releases.

## 3. Web address

The app, the privacy policy and the terms point to **wall-ette.com**. The contact email stays **akshatbvora@gmail.com**.

- [x] **[YOU]** Firebase console → Hosting → **Add custom domain** → `wall-ette.com`. DNS at GoDaddy: A `@` → `199.36.158.100`, TXT `@` → `hosting-site=wall-e-7a113`, CNAME `www` → `wall-e-7a113.web.app`.
- [x] **[YOU]** `www.wall-ette.com`, `wall-ette.in` and `www.wall-ette.in` added the same way, each **redirecting** to `wall-ette.com`.
- [x] **[YOU]** Firebase console → Authentication → Settings → **Authorized domains**: `wall-ette.com` and `www.wall-ette.com` added.
- [ ] **[YOU]** If the Firebase web API key is restricted to certain websites (Google Cloud console → APIs & Services → Credentials), add `https://wall-ette.com/*`.
- `https://wall-e-7a113.web.app` keeps serving the same site. Web users who move to the new address sign in again there, because browser storage is per domain.

## 4. Privacy policy and account deletion (prepared)

- Privacy policy: **https://wall-ette.com/privacy.html** → Play Console → App content → Privacy policy.
- Delete account URL (asked in the Data safety form): **https://wall-ette.com/privacy.html#delete**. That section describes deleting the account in the app (Self → Delete account & all data up to 1.5.5; Self → Account and security → Delete account and all data from 1.5.6) and by email.
- [x] **Website and Firestore rules deployed on 19 Nov** (`npm run build`, then `npx firebase-tools deploy --only hosting,firestore:rules`): the current privacy policy is live, and account deletion erases the security log (audit M3). Deploy the same way after changing either; `npm run deploy` does the website alone. Don't use `ship.ps1`, it's retired.
- [x] **Website deployed again on 20 Nov** (hosting only): the privacy policy of 20 Nov describes crash reports (Crashlytics), the product page no longer says "no trackers" and lists the banks Wall-ette reads, and the web app has the new Forgot Password and statement import.
- [x] **Website deployed again on 26 Nov** (hosting only): the privacy policy of 25 Nov lists payee rules and import receipts among the app settings, and the web app is 1.5.8.
- [x] **Data safety form and full description updated in Play Console on 20 Nov** to match sections 5 and 6, and saved. Not sent yet, so 1.5.5's review isn't pushed back.
- [ ] **[YOU]** Once 1.5.5 is approved: Publishing overview → **Send 2 changes for review** (Data safety, full description).
- The old APK at `/downloads/wall-ette.apk` is gone. The site's "Get the Android app" banner stays hidden until the Play listing is public (section 8).

## 5. Data safety form — answers that match the app

| Question | Answer |
|---|---|
| Does your app collect or share user data? | Collects: yes. Shares: **no** |
| Email address | Collected · App functionality (account management) · Not shared |
| Name (from 1.5.9) | Collected, **optional** (only for people who sign in with Google: Google sends their name and profile-picture address with the sign-in; kept in Firebase Authentication's sign-in record) · App functionality (account management) · Not shared |
| Financial info → "Other financial info" | Collected (user-entered/imported transactions; from 1.5.9 also each bank account's opening balance, bank name and the last four digits of its number, to tell accounts apart; from 1.6.0 also payments read from payment and bank apps' notifications, once added: amount, day, payee, reference and the app) · App functionality · Not shared |
| App activity → "App interactions" | Collected (unlock attempts: time and method, for the in-app security log) · App functionality; Fraud prevention, security, and compliance · Not shared |
| App info and performance (from 1.5.3) | Google's in-app updates library sends device metadata, the app version and the list of installed modules to Google Play to find updates; Google says it's encrypted and not shared ([In-app updates → Data safety](https://developer.android.com/guide/playcore/in-app-updates)). `play-services-base`, which it pulls in, collects nothing. Google leaves the answer to you; the cautious one is Collected → "Other app performance data" · App functionality · Not shared |
| App info and performance → "Crash logs" (from 1.5.5) | Collected (Firebase Crashlytics: the stack trace, app state, masked error message and recent screen names when the app crashes or reports an error) · Analytics (Play's purpose for diagnosing and fixing crashes) · Not shared (Google processes it for us) · Optional: Self → Crash reports (Self → Your data from 1.5.6) turns it off |
| App info and performance → "Diagnostics" (from 1.5.5) | Collected (device details at the time of a crash, such as model, Android version, free memory and storage) · Analytics · Not shared · Optional |
| Device or other IDs (from 1.5.5) | Collected (the Crashlytics installation ID, which counts how many installs a crash affects; no user ID is set) · Analytics · Not shared · Optional |
| Account creation | **Username and password**, and from 1.5.9 **OAuth** (Sign in with Google). Two-factor sign-in is still Coming Soon; the fingerprint unlock is on the device, not a way to sign in |
| Personal info | **Email address**, and from 1.5.9 **Name** for Google sign-ins (above). No phone number is asked for, and statement files are processed on the device, so Files and docs isn't collected either |
| Data encrypted in transit? | **Yes** (Firebase TLS) |
| Can users request deletion? | **Yes** — in the app (Self → Account and security → Delete account and all data from 1.5.6), or by email to akshatbvora@gmail.com; URL in section 4 |
| Data processed ephemerally? | No |
| Ads / advertising ID | **None** |

From 1.5.6 the app can show phone notifications (bill reminders, budget and daily-limit alerts), switched on in Self → Alerts and limits. They are made on the device from data the app already holds, so nothing new is collected and these answers don't change. The manifest gains `POST_NOTIFICATIONS` (asked for on Android 13+ when switched on), `RECEIVE_BOOT_COMPLETED` and `WAKE_LOCK` (reminders survive a restart) and `VIBRATE` (taps); `SCHEDULE_EXACT_ALARM`, which the notifications plugin declares, is removed, so there is no exact-alarm declaration to make.

## 5b. Payments from your apps (from 1.6.0)

- **Notification access** (`BIND_NOTIFICATION_LISTENER_SERVICE`, granted by the person in Android's settings) has no Play declaration form. The in-app disclosure (Self → Your data → Payments from your apps, shown before Android's access screen) says what is read and why, as the User Data policy asks; the privacy policy has a section on it (wall-ette.com/privacy#payments-from-apps).
- **Data safety:** notification text is processed on the device and never leaves it, so it isn't "collected". Payments it adds go to the wallet like typed entries: Financial info → Other financial info, already declared (row above). No answers change otherwise.
- **SMS:** not read, by any route. The reader skips every app not on its list, messaging apps included (Play forbids deriving SMS data by other means). Share to Wall-ette only takes text the person shares.
- **Sideloading:** in India, Play Protect blocks apps that ask for notification access when installed from a browser, messaging app or file manager; Play installs (and adb, for testing) are unaffected.
- **Release notes / listing:** say it's optional and off until turned on.

## 5c. Paid plans: Essential and Plus (built in 1.6.0, switched off)

1.6.0 carries Google Play billing (`@capgo/native-purchases`, which adds `com.android.vending.BILLING`), the plan screens and the server, all dormant while `config/app.plansLive` is false: everything stays open and no plan screen shows. A tester listed with `node scripts/plans-admin.mjs tester <email>` sees plans before everyone else. Steps, in order (Play Console and Firebase steps are the account owner's):

**Data safety (with the 1.6.0 upload, since testers can buy):**

| Question | Answer |
|---|---|
| Financial info → "Purchase history" | Collected · App functionality · Not shared. Which plan and period, its dates and state, and Google Play's purchase token, read from Google Play by the server. Payment details stay with Google Play |
| Personal info → "Email address" | Already declared. Also used for student checks by institution email (App functionality): the address is in the email we send, deleted within two days; after that only a hash is kept |
| Personal info → "Other info" | Collected, **optional** · App functionality · Not shared: institution, course and course end date, only from people who ask for a student review |

**Play Console (after the payments profile, and after a build with the BILLING permission is uploaded to a track):**

1. Monetize with Play → Products → **Subscriptions** → Create subscription, twice. Product IDs can never be reused, so type them exactly:
   - `essential`, name "Wall·ette Essential", with base plans `essential-monthly` (auto-renewing, 1 month, ₹49) and `essential-yearly` (auto-renewing, 1 year, ₹449).
   - `plus`, name "Wall·ette Plus", with base plans `plus-monthly` (₹99) and `plus-yearly` (₹899).
   - Prices are what people pay, as on wall-ette.com. Set India; check the buyer price Play shows for India matches before activating.
2. On each of the four base plans, add an offer with ID `free-month`: eligibility **New customer acquisition → Never had any subscription** (the free month is for new members only; a restart pays from day one), one phase **Free trial, 30 days**. Activate the base plans and the offers.
3. Keep Play's **grace period** and **account hold** on (the defaults). The app tells members when Google Play couldn't take a payment.
4. Settings → **License testing**: add the testers' Google accounts. Their purchases are free and renew in minutes; the server marks them as tests.
5. Users and permissions → invite the Cloud Functions service account (`881370415293-compute@developer.gserviceaccount.com`, wall-e-7a113's default compute account) with access to Wall-ette: *View app information*, *View financial data, orders and cancellation survey responses* and *Manage orders and subscriptions*. Without it the server can't read or acknowledge purchases, and Google Play refunds purchases that aren't acknowledged within 3 days.
6. Monetize with Play → Monetization setup → **Real-time developer notifications**: topic `projects/wall-e-7a113/topics/play-billing`, content *Subscriptions and voided purchases*, then **Send test notification**.

**Firebase / Google Cloud (wall-e-7a113, the owner's go each):**

1. The Blaze plan, which Cloud Functions and the scheduler need: **on already**.
2. The Google Play Android Developer API, Cloud Pub/Sub and Cloud Scheduler: **enabled 28 Nov 2026**, with the APIs `firebase deploy` turned on.
3. Pub/Sub topic `play-billing`: **created 28 Nov 2026**, with the **Pub/Sub Publisher** role on it for `google-play-developer-notifications@system.gserviceaccount.com`, so Google Play can send to it.
4. `firebase deploy --only functions,firestore:rules,firestore:indexes` (functions in us-central1, next to the database in nam5): **deployed 28 Nov 2026** from commit 103fd2c, 11 functions and the 1.6.0 rules and indexes. The first deploy of 2nd gen functions on a project fails while Google sets up its service agents: retry after a few minutes. If a callable function then answers 403 to a request without sign-in, its Cloud Run service lacks the public invoker that `firebase deploy` adds on create: `gcloud run services add-iam-policy-binding <name> --region us-central1 --member=allUsers --role=roles/run.invoker` (the functions check sign-in themselves; a working one answers 401).
   Old container images are deleted after 1 day (`firebase functions:artifacts:setpolicy --location us-central1 --days 1`, **set 28 Nov 2026**); running functions don't need them.
5. Only for student checks by email: install the **Trigger Email from Firestore** extension on the `mail` collection with an email service, name that service in the privacy policy, then set `config/students` → `emailChecks: true` and `domains` (for example `["ac.in", "edu.in", "edu"]`).

**Try it, then switch on:**

- Testers: `node scripts/plans-admin.mjs tester <email>`, then sign out and in. Buy, move up, move to yearly, cancel and restore on the closed-test build; Self → Your plan shows the state.
- Production: Firebase console → Firestore → `config/app` → boolean `plansLive` = true, with the release that announces paid plans. Everything stays as it is for members until then.

## 5a. Sign in with Google (from 1.5.9) — set up before building the 1.5.9 bundle

The app signs in with Google through Android's own account picker (Credential Manager), then Firebase (`services/googleSignIn.ts`); the web app and website use Firebase's Google popup. Nothing here is a secret.

- [x] Firebase console → Authentication → Sign-in method → **Google** is on; support email akshatbvora@gmail.com. Its "Web client ID" reads `881370415293-3n8j6fo1j38ch0mq1m2588osgpp2ddub.apps.googleusercontent.com` (`GOOGLE_WEB_CLIENT_ID` in `services/googleSignIn.ts`). Checked 27 Nov 2026.
- [x] Firebase console → Project settings → Your apps → Android `com.wallette.app` → SHA certificate fingerprints: SHA-1 and SHA-256 for each key that signs a copy people install (added 27 Nov 2026; Firebase made an Android OAuth client for each SHA-1):
  - the **Play app signing key** (Play Console → Test and release → App integrity → App signing): every copy installed from Google Play. Its key is "Quantum-ready", so there are three: the classical key and the post-quantum key now in use, and the previous key;
  - the **upload key**: a bundle you install yourself;
  - the PC's **debug key**: builds from Android Studio, such as the emulator's.
  Without the right one, Google's picker says Wall·ette isn't set up (`[28444] Developer console is not set up correctly`). A new fingerprint can take a while to work, sometimes hours. If Play's app signing key changes again, add the new key's fingerprints here too.
- [x] Authentication → Settings → **Authorized domains**: `wall-ette.com` and `www.wall-ette.com` are there (with `localhost` and the two Firebase domains), so the popup works on the website and the web app. "Link accounts that use the same email" is on (the default).
- [x] Google Cloud console (project wall-e-7a113) → Google Auth Platform → **Branding**: app name "Wall·ette" (it read "project-881370415293", Google's placeholder, which Google shows to everyone who signs in: "to continue to …"; Firebase's Google provider calls the same name "Public-facing name for project"), with the links wall-ette.com, wall-ette.com/privacy and wall-ette.com/terms and the authorized domain `wall-ette.com`. Changed by the owner, 27 Nov 2026. Support email is set. Leave the logo empty: adding one starts a Google review. **Audience**: External, **In production** (in Testing only listed test users could sign in). With only the email and profile scopes no Google review is needed.
- [x] Play Console → **Data safety**: "OAuth" under account creation, and Name (collected, not shared, not ephemeral, optional; App functionality and Account management, like Email address). Saved 27 Nov 2026 and checked; Managed publishing is off, so it goes for review when submitted from Publishing overview.
- Accounts: a Google sign-in with the same Gmail address as an existing email-and-password account opens that same wallet. If that email address was never verified, Firebase replaces the password with Google for it (Google is trusted for Gmail addresses), so from then on it unlocks with Google: the lock screen, Change password and Delete account follow whichever ways in the account has.

## 6. Store listing — ready to paste

**App name:** Wall-ette · **Package name:** `com.wallette.app` (permanent; it must match the AAB)
**Category:** Finance · **Tags:** personal finance, expense tracker
**Contact email:** akshatbvora@gmail.com (shown publicly on Google Play) · **Website:** https://wall-ette.com

**Short description (≤80 chars):**
> Mindful expense tracker: import bank statements, get insights, stay on budget.

For 1.5.9 (the brand kit), replace it with:
> Your personal finance companion: import bank statements, see where money goes.

**Full description:**
> Wall-ette is a calm, private way to understand your money.
>
> 🌿 MINDFUL BY DESIGN — A zen, clutter-free interface that makes checking your finances a pleasant ritual instead of a chore.
>
> 📄 IMPORT YOUR BANK STATEMENTS — Drop in a PDF or Excel statement from IDFC FIRST, HDFC, SBI, Kotak, Union Bank or Saraswat Bank, and Wall-ette reads every transaction on your device and checks it against the running balance — the file never leaves your phone. Other banks' PDFs often work too. Automatic categorization tuned for Indian merchants and UPI, with duplicate detection built in.
>
> 📊 INSIGHTS THAT MEAN SOMETHING — A live Pulse of your spending: month-over-month category shifts, a daily spending heatmap, weekday patterns, budget pace projection, and automatic detection of recurring charges and subscriptions.
>
> 💼 KNOW YOUR INCOME — Income stream classification (fixed / recurring / one-off), an income stability score, next-pay countdown, and a money-flow diagram from sources to spending to savings.
>
> 💸 KNOW WHAT'S LEFT — Left to spend shows what you can still spend before your next pay, once bills still to come and your savings goal are set aside. Optional reminders the evening before a bill is due.
>
> 🔐 PRIVATE & SECURE — Email + password sign-in, automatic session lock, per-user encrypted cloud sync via Google Firebase, full offline support. All insights are computed locally — no AI services, no ads, no data selling. Export or back up everything, anytime.
>
> 💱 ANY CURRENCY, LIVE RATES — Show amounts in any currency, converted at live exchange rates. Everything stays saved in rupees, to the paisa.
>
> Wall-ette — your mindful money companion.

For 1.5.9, three changes to paste: the first paragraph becomes "🌿 CALM BY DESIGN — Wall·ette's sage look, a choice of colour themes and a friendly mascot make checking your money a pleasant ritual instead of a chore."; the bank list in the import paragraph becomes "IDFC FIRST, HDFC, SBI, Kotak, Union Bank, Saraswat Bank or Equitas"; and the last line becomes "Wall·ette — your personal finance companion."

The "KNOW WHAT'S LEFT" paragraph went into the listing with 1.5.6 (24 Nov 2026). The currency line was rewritten on 25 Nov 2026: the old one named only INR, USD, EUR and GBP, but since 1.5.6 any currency can be shown, at live rates. The owner put it into the listing on 25 Nov 2026 (Play Console → Grow users → Store presence → Main store listing → Full description).

**Graphics (in `store-assets/`):**
- [x] App icon 512×512 — `store-assets/icon-512.png` (1.5.9: the brand kit's icon, drawn by `scripts/brand-icons.mjs`; upload it with the 1.5.9 release)
- [x] Feature graphic 1024×500 — `store-assets/feature-graphic-1024x500.png` (1.5.9: the mascot, wordmark and tagline; upload it with the 1.5.9 release)
- [x] Phone screenshots for the 1.5.6 look — `store-assets/screenshots-1.5.6/` (8 × 1080×1920: Home, Pulse, Left to spend, Trends, Categories, Import, Vault, Flow). Sample data only, never a real account. The Play build blocks screenshots (audit M11), so they're taken from the web build with made-up data (the 19 Nov set in `store-assets/screenshots/` is the old look).
- [ ] Phone screenshots for the 1.5.9 brand look — `store-assets/screenshots-1.5.9/`, the same eight screens with the same made-up data; upload them with the 1.5.9 release to replace the 1.5.6 set.

## 7. Remaining Play Console forms (~20 min, all simple)

- [ ] Content rating questionnaire → finance app, no objectionable content → rates "Everyone".
- [ ] Target audience: 18+ (finance) or 13+; pick 18+ to keep it simple.
- [ ] App access: provide a **test account** (create a dummy email/password in the app) so reviewers can log in. Note in the access instructions: "Statement import is optional; sample data can be added via New Entry."
- [ ] Ads: **No**. Advertising ID: **No** (the app doesn't use it).
- [ ] Government apps: No. Financial features: Wall-ette is a **personal expense tracker** — it does NOT provide loans, banking, payments, investments or advice. Declare "My app doesn't provide any financial features".
- [ ] Countries: start with India (+ anywhere else you like).

## 8. Testing and release

A new personal account can't release to Production until a closed test has had **at least 12 testers opted in for 14 days in a row**.

- [ ] **Internal testing:** upload the AAB and install it from the test link on your phone. It installs next to the old sideloaded Wall-ette (`com.wallet.walle`), so sign in on it, then uninstall the old one; your data comes back from the cloud. A local build of `com.wallette.app` has a different signature, so uninstall that first.
- [ ] **Closed testing:** add the testers by email list or Google Group and send them the opt-in link. They must stay opted in for 14 days in a row (leaving restarts their count). Keep notes of their feedback.
- [ ] Dashboard → **Apply for production**. It asks about the closed test (recruiting, engagement, feedback), the app (audience, value, expected installs) and readiness (what you changed after testing). Review usually takes up to 7 days.
- [ ] **Production:** create the release and submit it for review (typically 1–7 days).
- [ ] Once Production is live: set `PLAY_LISTING_PUBLIC = true` in `utils/site.ts` and deploy the website, so wall-ette.com shows Android visitors a banner that opens Google Play.

Paid plans go through Google Play's billing: set up a merchant payments profile in Play Console, then follow section 5c.

## 9. Shipping an update

Play installs updates by itself. From 1.5.3 the app also offers them (Google's prompt, then an **Update ready · Restart** banner) and shows **What's new** once after an update (also under Self → About → What's new from 1.5.6). For each release:

1. Bump `versionCode` (+1) and `versionName` in `android/app/build.gradle`. The web code reads both from there (Profile, splash screen, What's new).
2. Add an entry at the top of `RELEASE_NOTES` in `services/releaseNotes.ts`: the new versionCode and versionName, one short sentence per change. Leave it out if there's nothing to announce; the card then stays hidden.
3. `node scripts/check-app-updates.mjs` checks the notes against `build.gradle`.
4. `npm run android:bundle`, upload the AAB to the track, and paste the same lines into **Release notes** (500 characters at most).
5. Production: roll out to a percentage first if you like, then 100%.

**When the app doesn't offer an update** (check in Self → About → Check for updates, from 1.5.7):
- *"This copy wasn't installed from Google Play"*: the phone has a build from Android Studio or an APK. Play can't update it, and a Play copy won't install over it (different signature). Uninstall it, then install Wall-ette from the Play test link; the data comes back from the cloud.
- *"You have the latest version"* while Play Console shows a newer release: the Play Store app hasn't noticed it yet. Open Play Store → profile → Manage apps & device (that refreshes the list), then check again. Right after approval this can take a few hours.
- No prompt at all, but the app is already on the new version: Play updated it in the background first; What's new appears once instead.

**Requiring an update** (a bug that damages data, or a Firestore change old versions can't handle):

- [ ] One time: deploy the rules (`firebase deploy --only firestore:rules`) so signed-in users can read `config/app`. Until then the app treats the minimum as 0.
- When the fixed release is at 100%: Firebase console → Firestore → collection `config`, document `app`, number field `androidMinVersionCode` = that release's versionCode. Older builds open Google's full-screen update, and a **Time to update** screen if the user backs out.
- The app only blocks when Google Play offers it an update, so setting the minimum too early locks nobody out; it waits until Play has the release for them. Set it to 0 to switch it off. Builds before 1.5.3 don't read it.

**Testing the update prompt:** it only works for an app installed from Google Play with the Play signing key, never a local build. With internal app sharing (Play Console → Internal app sharing): install build N from its link; upload build N+1 (higher versionCode), open its link but don't install it from the Play page; then open Wall-ette from the home screen and Google's prompt appears. The Google account must have installed the app from Play at least once. Steps: [Test in-app updates](https://developer.android.com/guide/playcore/in-app-updates/test).

## Done already (for the reviewer's benefit)

- Target SDK 36 ✓ (Play's requirement since 31 Aug 2026)
- No simulated security features (demo MFA/biometric removed in v1.1.0)
- Privacy policy live and accurate ✓ · Account deletion erases cloud data and the copy on the device ✓ · No ads SDK ✓ · Data safety answers match actual behavior ✓
