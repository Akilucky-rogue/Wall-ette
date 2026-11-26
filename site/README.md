# wall-ette.com — the website

The Wall·ette website: product pages, pricing, Spread, the blog, resources and
the legal pages. It began as a Lovable project and now lives here, built as
static pages for Firebase Hosting, beside the web app at `/app`.

- **Stack:** TanStack Start (prerendered at build time, no server), React 19,
  Tailwind v4, shadcn/ui.
- **Accounts:** sign up, sign in and password reset use Firebase Auth in the
  browser: the same accounts as the app (`src/lib/firebase.ts`,
  `src/lib/auth-rules.ts`). Signing in hands over to `/app`.
- **Forms:** the contact form and the Monthly Check-in write to Firestore
  collections anyone may add to and no one may read (`src/lib/forms.ts`,
  `firestore.rules`); read them in the Firebase console.
- **Spread** (referrals, students, gifts) shows how it will work and opens
  with paid plans.
- **Status:** `src/lib/status-data.ts`, published by hand.
- **Images:** `public/img` (WebP where they were large PNGs).

## Work on it

```sh
cd site
npm ci            # .npmrc sets legacy-peer-deps
npm run dev       # http://localhost:5310
npm test
npm run build     # prerenders every linked page into dist/client
```

From the repo root, `npm run build:hosting` builds the website and the web app
into `hosting/`, and `npm run deploy` publishes it.

Pages are found by following links from the pages listed in
`vite.config.ts`: a page nothing links to must be added there.
