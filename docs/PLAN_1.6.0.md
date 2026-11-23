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

1. Billing and the paywall behind a remote switch, tested with Play's
   licence testers.
2. SMS reading and parsing, checked on made-up messages for each bank.
3. The declaration form, policy pages, Data safety, release notes; then the
   closed test, then Production.
