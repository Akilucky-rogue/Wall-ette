# 1.6.0 plan: one release, then paid plans

Agreed on 27 November 2026. 1.5.9 was never uploaded, so 1.6.0 carries it and
everything below that can be built and tested now. Essential and Plus are
built into 1.6.0 too, switched off (28 November 2026): testers try Google
Play billing on the closed test, and the production release switches them
on.

## Decisions

- **One upload.** 1.6.0 holds everything built for 1.5.9 (see
  `services/releaseNotes.ts`), entries stored by month, Accounts, payments
  from notifications with Share to Wall-ette, and the open review fixes.
  Your own bank (`PLAN_YOUR_BANK.md`) and Hub come after the production
  release.
- **Payments from notifications, not SMS** (27 November 2026). Wall-ette
  reads the notifications of payment and bank apps; SMS capture is parked.
- **Entries stored by month** (agreed 27 November 2026): a wallet's entries
  move from one Firestore document each to one document per month, so the
  first sign-in on a device takes seconds, not a minute. A required update.
- **Paid plans are Essential and Plus, exactly as on wall-ette.com**
  (`site/src/lib/plans.ts` in the website project). This replaces the earlier
  Premium (₹99 a month or ₹799 a year, 14-day trial) and Basic/Advanced ideas.

## Payments from notifications

What it does: once you allow notification access, Android hands Wall-ette
each notification from the payment and bank apps on an allowlist, whether
Wall-ette is open or closed. Each payment is saved on the phone and goes into
the wallet the next time Wall-ette opens.

- **Which apps.** An allowlist of package names: Google Pay
  (`com.google.android.apps.nbu.paisa.user`), PhonePe, Paytm, BHIM and the
  apps of the banks whose statements Wall-ette reads. Every other
  notification is dropped unread. Never a messaging app: Play forbids
  deriving SMS data by other means, and the Messages app's notifications are
  SMS.
- **Reading.** A small Android plugin (`NotificationListenerService`) keeps
  the app, title and text of allowlisted notifications in the app's own
  storage on the phone; they're parsed on the phone. Patterns are built from
  real notification wording the owner supplies with made-up names and
  amounts. The bank-alert parser on `feature/sms-capture` is the starting
  point for bank apps.
- **Adding.** Payments read with certainty (amount, direction, app) are added
  automatically, marked with the app they came from, and each can be undone;
  anything unclear waits as "Add this?". "Ask me first" in Self → Your data
  turns the automatic part off. Payments are matched against imported
  statements by reference, amount and day, so nothing counts twice.
- **Staying on.** Off until switched on in Self → Your data, after a
  disclosure screen that says what is read and why (Play's User Data policy
  wants it in the app, not only in the privacy policy); then Android's
  Notification access screen. On each open Wall-ette checks the listener is
  connected; if a battery saver cut it off, it says so and points to the
  setting. Force stop pauses it until the next open.
- **Limits.** Only notifications posted after it's on, and only payments an
  app notifies. Card, NEFT and autopay payments often come only by SMS:
  bank-app transaction alerts, Share to Wall-ette and statements cover those.
- **Share to Wall-ette.** An Android share target for text: share one message
  (from Messages or anywhere) and it opens as "Add this?". No permission.
- **Policy and listing.** No declaration form for notification access that we
  could find. Data safety: notification text stays on the phone (not
  collected); the payments added are financial info already declared. The
  privacy policy gains a notification-access section. Play Protect blocks
  sideloaded apps that ask for notification access, so this ships through
  Play only.

## SMS capture (parked)

Play allows SMS-based money management only as a temporary exception when
there's no alternative. FinVantage was refused because manual entry counted
as one, and notification capture is a stronger alternative still. A
sideloaded SMS build isn't an option either: in India, Play Protect blocks
internet-sideloaded apps that ask for SMS or notification access. The sender
filter and parser stay on `feature/sms-capture` for reuse.

## Entries stored by month

Why: signing in on a device for the first time, or after signing out (which
clears the device's copy), Firestore stores every entry in its on-device
cache. Measured on the emulator on 27 November 2026 with a wallet of about
2,700 entries: the download took 3 s (2.5 MB), storing it took 51 s, about
16,000 IndexedDB operations (8,000 puts, 5,400 deletes, 5,400 cursors and
2,700 gets) at around 3 ms each in an Android WebView, with the main thread
80–96% busy; drawing Home took 3 s more. Wall·ette's own code was about half
a second of it. 1.5.9 shows "Getting your wallet" meanwhile and starts the
download under the welcome splash (`walletLoaded`, `utils/timing.ts`).

- **Shape.** `users/{uid}/months/{YYYY-MM}` with `entries: { [id]: entry }`,
  about 30 documents for that wallet instead of 2,700. Adding or editing an
  entry writes its own field (`setDoc` with merge); deleting removes it
  (`deleteField()`); moving an entry to another month is one batch. Imports
  write one document per month. The `entries` map is exempt from indexing.
- **Size.** A document holds up to 1 MB, roughly 2,500 entries; a month
  with more spills into `YYYY-MM-2`.
- **Rules.** Rules can't check a map entry by entry, so month documents are
  checked for owner and size; each entry's fields (amount above zero, type)
  are checked in the app before writing, and by the move's check script.
- **Moving existing wallets.** Once per account, on whichever device opens
  the new version first: read the old entries (from the device's cache when
  it has them, otherwise through Firestore's REST API, which skips the
  cache), write the months, then delete the old documents through the REST
  API (through the SDK, reading or deleting them costs the same minute
  again). Marked done in `settings`, so it runs once, and safe to repeat if
  it's interrupted.
- **Older versions** would keep writing to the old place, so the release
  that moves the wallets is a required update (`config/app`, or Play's
  in-app update priority); the web app ships the same day.
- **Checks:** a script that moves made-up wallets and compares every entry
  to the paisa, a timing on the emulator before and after, and Backup,
  Restore, Clear all and CSV export against month documents.

## Accounts

1.5.9 tags imported rows with their account (`Transaction.account`: bank and
last four digits) and keeps each account's opening balance
(`services/accounts.ts`), but no screen shows them.

- **Accounts screen** (Self → Your data → Accounts): each account's name,
  balance and latest statement day, and the entries outside any account
  (typed in, or imported before accounts were told apart).
- **Vault filter** by account.
- Groundwork for the plans: Essential holds one account, Plus any number.

## Review fixes in 1.6.0

Own-name transfers sorted as money moved; pay day from salary rather than the
largest repeating credit; recurring false positives; budgets no longer offered
for Transfer Out or To review; payee fragments; the message for Play's update
error -6; "Kept 0%"; comma and minus formatting. Website: the hydration
error #418, and the privacy policy line about turning on two-step sign-in.

## Paid plans: Essential and Plus (built in 1.6.0, on at production)

As on wall-ette.com (`site/src/lib/plans.ts`, `routes/pricing.tsx`):

| Plan | Monthly | Yearly | Holds |
| --- | --- | --- | --- |
| Essential | ₹49 | ₹449 | Statement imports, Vault, Pulse and categories, transfers, Left to spend; 1 bank account; 12 months of history |
| Plus | ₹99 | ₹899 | Everything in Essential; unlimited accounts and full history; Flow and Rewind; Recurring; priority support and bank requests |

- **Trial.** New members get 30 days at ₹0 on either plan, with card or UPI
  details; the first charge is on day 31. On Android that's a free-trial
  offer on each base plan (Play asks for a payment method too), so the
  server-granted free month in the earlier plan is dropped. A restart counts
  as month one; the free month is for new members only.
- **Changes,** as Google Play makes them (`changeOf` in
  `services/planRules.ts`). Essential to Plus on the same period: straight
  away, the difference charged for the rest of it (`CHARGE_PRORATED_PRICE`).
  Monthly to yearly, or up to Plus on another period: straight away at the
  new plan's full price, the unused time added on (`CHARGE_FULL_PRICE`).
  Down to Essential (after the first year) and yearly to monthly: at the
  next renewal (`DEFERRED`). After moving down, extra accounts and older
  history become read-only, never deleted. Export and deletion stay on
  every plan, and with no plan.
- **What the website doesn't place,** as built. Plus only: Flow's Story tab,
  Rewind, the Recurring page with its bill reminders and price-rise notes,
  more accounts, full history and priority support. Flow's Goals (budgets,
  the savings goal), Left to spend with bills, Data Studio and Pulse's pages
  are in both. Essential's limits: Pulse looks at this month and the 11
  before; older entries and a second bank account's stay in Vault,
  read-only (deleting always works); an import of another account's
  statement is refused, older rows of the kept account are saved read-only;
  New entry can't be dated before the 12 months. With no plan: everything
  reads, exports and deletes; nothing is added, and payments from apps wait.
- **Billing,** built (fd9df95 and the app commit): subscriptions `essential`
  and `plus`, base plans `essential-monthly`, `essential-yearly`,
  `plus-monthly`, `plus-yearly`, a `free-month` offer (30 days, new
  customers) on each. Cloud Functions in asia-south1 check every purchase
  with Google Play, follow its real-time notifications on the `play-billing`
  topic and keep `entitlements/{uid}`, which only they write. Play never
  reuses a product ID, so the products are created once, after the
  payments profile, exactly as `PLAY_SUBMISSION.md` §5c lists.
- **The switch.** `config/app.plansLive` (false in 1.6.0) turns plans on
  for everyone; `planTesters/{uid}` turns them on for one tester first
  (`scripts/plans-admin.mjs tester`). In test builds, Self → About →
  Preview a plan shows each state without the server.
- **Reminders.** From day 25 of the free month the bell says when it ends
  and what Google Play then charges (Google Play emails too); also a payment
  Play couldn't take, and a plan that won't renew.
- **Web.** Checkout on wall-ette.com through the payment gateway; the Android
  app can't point people there.
- **Spread** (built in 1.6.0 with the plans, in Self → Your plan). Referral: a month of
  each person's own plan after the friend's first paid month, not stacked on
  the trial. Students 18+: Essential until the verified course end date,
  checked every 12 months, no card. Institution codes. Annual gifts at 5%
  (1–4), 10% (5–19) and 15% (20 or more) off. Gifts and student access are
  entitlements Wall-ette's server grants.
- **Per sale**, after Google's 15% fee and the 0.1% income tax it withholds:
  Essential ₹41.6 a month or ₹381.2 a year; Plus ₹84.1 or ₹763.3. Once
  GST-registered: ₹34.1, ₹312.7, ₹68.9 and ₹626.1.
- **Open question for the owner:** what the closed test's testers get at
  launch.

## Order of work

1. This plan and the two Claude docs. **Done.**
2. Entries stored by month, with the move of existing wallets. **Done** (29b6326).
3. Accounts. **Done** (e443dce).
4. Payments from notifications and Share to Wall-ette. **Built** (2426632):
   checked on made-up notifications in each app's style and in the UI
   harness; to try on the test emulator and on the owner's phone (a test
   build, "Wall-ette Test", installs beside the Play app). The payment
   apps' real wording is still to confirm; IDFC FIRST's alerts follow real
   ones.
5. Review fixes. Some done (84f0b9d); the rest need a read-only look at
   the owner's wallet.
6. Asked on 27 Nov and done: the import in five steps (format, statement,
   balance check, categories, summary) with the two statuses apart
   (4f1d211); on the website, every plan rule in one place, unambiguous
   billing changes, and a privacy policy that names providers and says who
   can see your data (1ee886b).
7. The 1.6.0 release (versionCode 18; one What's new entry): Data safety
   check, bundle; the Firestore rules deploy, web deploy and push on the
   owner's go.
8. Asked on 28 Nov: the website's features in 1.6.0, switched off.
   Essential and Plus, Spread, the plan screens and locks, Essential's
   limits and the reminders are built; the server is ready to deploy.
9. After the 14-day closed test, with testers' purchases tried: switch on
   `plansLive` with the production release.
