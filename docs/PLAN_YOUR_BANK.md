# Plan: your own bank

**Status (25 Nov 2026):** asked for by the owner; designed, not started. It
comes after 1.5.8 and SMS capture, before Hub phase 1 (release order in the
"Wall-ette next steps" doc).

People whose bank Wall-ette can't read yet set it up once: they say which
column is which, Wall-ette proves the mapping against the statement's own
balances, and saves it to their account for every later statement from that
bank. Only the layout is saved, never a row.

## Excel and CSV statements (first)

- **Where it starts.** `IDFCBankParser.findColumns` looks for a row with Date,
  Debit (or Withdrawal) and Credit (or Deposit). When it finds none, the
  import stops today with "Could not find the transactions table". Instead,
  the set-up sheet opens.
- **The sheet.** The first dozen rows as a grid. The person taps the heading
  row, then picks: Date (the format is guessed from the cells and shown for
  confirming), Narration (one column, or two joined), Money out and Money in,
  or one Amount with a Dr/Cr column or a sign, Balance (strongly suggested),
  and Reference (optional).
- **Proof before anything is added.** With a balance column, every row must
  give balance = previous balance + in − out to the paisa, and the last must
  match the closing balance when the file states one: the same check the
  built-in banks get (`statementCheck`). A row that breaks it is shown with
  its numbers so the mapping can be fixed. Without a balance column the
  sheet shows totals in and out, and the person confirms them against the
  statement.
- **Saved.** `users/{uid}/bankProfiles/{id}`: name, the heading signature
  (the heading cells, normalised and joined), column choices, date format,
  amount mode, created date. No rows, amounts or names. Rules: the owner
  reads and writes their own; shape and size checked (under 4 KB). Account
  deletion removes them.
- **Next time.** A file whose heading signature matches a profile imports
  with no questions; the review says "Read with your <name> set-up", with
  "Change set-up". Profiles are listed in Self → Your data to rename or
  delete.
- **CSV.** The xlsx library already reads CSV; the file picker gains `.csv`.
- **Checks.** `scripts/check-bank-profile.mjs` on made-up statements in three
  layouts (separate in/out columns; one amount with Dr/Cr; one signed
  amount): a right mapping passes the balance proof, wrong ones are caught,
  and signatures match across files of different lengths.

## PDF statements

`bankPdfLayouts.detectBank` knows each built-in layout; anything else goes to
the generic line reader. For an unknown PDF the set-up suggests the bank's
Excel or CSV download (most Indian banks offer one in net banking), which
reads exactly. Mapping a PDF's columns by position can come later, with the
same balance proof.

## Bank apps (once notification capture ships)

SMS capture is parked (see `PLAN_1.6.0.md`), so new banks arrive through
their apps' notifications instead. A bank's app that isn't on Wall-ette's
allowlist can be added in Self → Your data (never a messaging app). Its
first payments wait as "Add this?" with what the parser read; corrections are
kept per app as small hints (which amount is the payment, where the payee
sits). The notification text stays on the phone.

## Later, opt-in: share a layout

With the person's OK, send only the heading signature and the mapping (no
rows, amounts or names) to a `bankLayouts` collection that only functions
write. Each is reviewed by hand before it becomes a built-in bank.
