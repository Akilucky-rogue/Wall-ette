# 1.6.0 plan: one release, then paid plans

Agreed on 27 November 2026. 1.5.9 was never uploaded, so 1.6.0 carries it and
everything below that can be built and tested now. Essential and Plus follow
in the production release, after the 14-day closed test.

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

## Paid plans: Essential and Plus (production release)

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
- **Changes.** Upgrade any time; down to Essential only after the first
  year; switching monthly and yearly mid-term charges the difference. After
  moving down, extra accounts and older history become read-only, never
  deleted. Export and deletion stay on every plan.
- **What the website doesn't place** (defaults, 27 November 2026). Budgets,
  the savings goal and Left to spend, with bills, are Essential, and their
  settings move out of Flow. Plus has the Flow page, Rewind, the Recurring
  page with bill reminders, more accounts and full history. Data Studio
  reports and Pulse's Trends, Categories and Insights are in both.
- **Billing.** The `premium-billing` branch (built 24 November for
  Basic/Advanced) becomes two subscriptions, `essential` and `plus`, each
  with monthly and yearly base plans and a 30-day free-trial offer for new
  customers. Play never reuses a product ID, so the products are created only
  once this is final, after the payments profile (account owner).
- **Web.** Checkout on wall-ette.com through the payment gateway; the Android
  app can't point people there.
- **Spread** (on the website now; wired after payments). Referral: a month of
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
8. After the 14-day closed test: Essential and Plus, Spread, production.
