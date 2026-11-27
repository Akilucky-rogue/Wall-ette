# 1.6.0 plan: payments from SMS, and Wall-ette Premium

Agreed on 23 November 2026. Nothing here is built yet; 1.5.6 ships without it.

## Decisions

- **SMS capture** ships in 1.6.0, **off by default**, in its own release so a
  Play policy review can't hold up anything else.
- **Premium is "deeper insights".** Paid: Pulse's pages (Trends, Categories,
  Recurring, Insights), statement reports, Rewind and phone reminders. Free,
  always: tracking, Vault, manual entries, statement import, budgets, Left to
  spend and the Pulse hub.
- **Price:** ₹99 a month or ₹799 a year, with a **14-day free trial**.
- **Entries stored by month** (agreed 27 November 2026, after 1.5.9 ships):
  a wallet's entries move from one Firestore document each to one document
  per month, so the first sign-in on a device takes seconds, not a minute.

## SMS capture

What it does: when a bank or UPI SMS says money went out or came in, Wall-ette
reads it on the phone and, next time the app opens, asks "Add this?" for each
one. Nothing is added without a tap, and no SMS leaves the phone.

- **Policy.** `READ_SMS` / `RECEIVE_SMS` are restricted on Google Play. Money
  management from SMS is one of the allowed uses, granted through the
  Permissions Declaration Form with a video of the feature, a prominent
  in-app disclosure before the permission prompt, and a review. If Play turns
  it down, the release ships without the feature.
- **Reading.** A small Android plugin: a receiver for new SMS while the app is
  closed, and a read of the inbox since the last check when it opens. Only
  messages from bank and UPI senders (DLT sender IDs such as `XX-HDFCBK`)
  are parsed; all others are never opened by the parser, stored or sent.
- **Parsing.** On the phone, one set of patterns per bank, reusing the payee
  and reference parsing statement import already has
  (`services/narration.ts`), with checks like the statement parsers'
  (`scripts/verify-statements.mjs`).
- **Confirming.** A review sheet like statement import's: amount, payee,
  date, category; "Add" or "Not mine". Duplicates are matched against
  imported statements by bank reference, amount and day.
- **Control.** A switch in Self → Your data. Turning it off stops reading and
  forgets where it got to. The privacy policy and Data safety form gain an
  SMS section (processed on the device, not collected).

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

## Premium

- **Billing.** Google Play Billing through a Capacitor plugin. Candidates:
  RevenueCat (`@revenuecat/purchases-capacitor`, MIT; keeps the entitlement
  and trial state on its servers, keyed to the Firebase user, so the web app
  can honour it later) or Cap-go's `@capgo/native-purchases` (MPL-2.0; direct
  Play Billing, but purchase checks need our own server). RevenueCat is the
  simpler start; it means Data safety lists purchase history shared with a
  processor.
- **Play Console.** Selling needs a payments profile (tax and bank details:
  the account owner sets it up), then a subscription with two base plans,
  `premium-monthly` (₹99) and `premium-yearly` (₹799), each with a 14-day
  free-trial offer.
- **In the app.** A `usePremium()` hook; a locked page shows its wallet card
  and a short preview, with "Try it free for 14 days". Restore purchases in
  Self → About.
- **Web.** Premium on the web would need its own payments (for example
  Stripe); not in 1.6.0. The web app keeps the free features.
- **Open question for the owner:** whether people already using the paid
  features get a longer trial or keep them for a while.

## Order of work

0. Entries stored by month, with the move of existing wallets and the
   required update, in its own release before the rest.
1. Billing and the paywall behind a remote switch, tested with Play's
   licence testers.
2. SMS reading and parsing, checked on made-up messages for each bank.
3. The declaration form, policy pages, Data safety, release notes; then the
   closed test, then Production.
