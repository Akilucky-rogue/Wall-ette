# Wall·ette design system

How Wall·ette looks and why, for anyone adding a screen. The look is settled:
a calm, eco-inspired wallet with the brand's leaf-headed mascot, a stitched
wallet card for each screen's key figure, Manrope headings over Inter text
and figures, small caps labels, and little sprouts, lotuses and leaves around
the edges. New work follows it; it doesn't reinvent it.

The brand kit (identity board, guide, palettes and type) came in 1.5.9; its
marks live in `assets/brand` and `components/ui/Brand.tsx`, and the icon is
drawn by `scripts/brand-icons.mjs`.

Last reviewed for 1.5.9 (November 2026).

## Principles

1. **One wallet per screen.** Every screen opens with one stitched wallet card
   (`components/ui/Denim.tsx`) holding its key figure: Home's balance, Pulse's
   spending, Data Studio's period, Recurring's monthly total. Everything else
   sits on lit paper (`Card`).
2. **Minimal and premium.** A fine weave and one soft stitch, never more
   ornament on the wallet (no gold thread, rivets or seams: tried in 1.5.6 and
   dropped as too busy). Pockets are plain pressed-in panels.
3. **The mascot and the garden stay.** The icon, the wordmark and the mascot
   are the brand (`ui/Brand.tsx`): Welcome greets (sign-in, the splash, an
   empty wallet), Think sits with insights and empty screens, Review with
   statements, Encourage and Celebrate are kept for progress and real
   achievements. The dock carries a sprout and a lotus; screens keep their
   low-opacity leaves, rangoli, diya and potted plant (`ui/Decor.tsx`). They
   are part of the brand, not clutter, and stay clear of the mascot.
4. **Numbers are exact.** Whatever a screen, chart or report shows is worked
   out once (`services/pulseAnalysis.ts`, `services/statementReport.ts`) and
   checked by scripts (`check-pulse`, `check-report`, `check-entry`).

## Tokens

All colours resolve through CSS variables set by `utils/theme.ts` on `<html>`
(themes: the brand kit's Sage, Teal, Midnight and Terracotta, then Slate,
Techie and custom). Tailwind classes read them (`bg-white` is the card,
`text-premium-charcoal` the ink). `scripts/check-contrast.mjs` holds every
theme to 4.5:1 for text, the accent as text and behind text, and money out.

| Group | Tokens | Use |
|---|---|---|
| Surfaces | `bg`, `card`, `card-alt`, `line`, `line-2` | Page, paper, hairlines |
| Ink | `ink`, `ink-2`, `mut`, `mut-2` | Text; `mut` for secondary text |
| Accent | `sage` (+ `-soft`, `-line`, `-deep`) | The theme's accent: active tab, buttons, actions, money in |
| Tints | `rose`, `lavender`, `sand` (+ `sand-ink`), `ocean`, `bluez` and their `-soft` | Icon chips and status tints; `rose` is money out (the brand's clay; berry in Terracotta) |
| Wallet | `wallet`, `wallet-2`, `wallet-ink`, `wallet-mut`, `wallet-stitch` | The stitched card (set per brand theme, else a deep shade of the accent) |
| Depth | `shadow-rgb`, `edge-hi`, `card-top`, `card-bottom` | Light from above |
| Charts | `viz-in` (teal), `viz-out` (clay), `viz-out-1`, `viz-out-3`, `viz-ctx` | Charts only; same in every theme |

Chart colours were picked to sit with the earthy themes and pass the dataviz
validator in light and dark: colour-blind separation, lightness band, chroma
and 3:1 contrast against the card. Light: teal `#1D7AA3`, clay `#C0714A`,
clay steps `#8A4A2C` / `#E2A685`. Dark: `#3D98BC`, `#C8744D`, `#A35A37` /
`#E2A584`. Text is never in a series colour.

### Type

| Role | Face and size |
|---|---|
| Page title, sheet and card headings | Manrope 22px (26px on desktop), bold; every `h1`–`h6` is Manrope |
| Wallet figure | Inter 40px (30px for a slim wallet), semibold, tabular, embossed |
| Pocket and tile figures | Inter 20–22px semibold, tabular |
| Buttons | Inter semibold |
| Logo | The wordmark artwork (`Wordmark`), never set as text |
| Card label | Inter 10px bold, uppercase, `tracking-widest`, muted: `BUDGETS · NOVEMBER` |
| Label action | Inter 10px semibold, uppercase, `tracking-wider`, sage: `EDIT`, `ALL INSIGHTS` |
| Row title | Inter 13–14px semibold |
| Body and notes | Inter 12–13px; 11px for chart ticks and fine print |
| Dock labels | Inter 10px bold, uppercase, `tracking-widest` |

### Shape and depth

Wallet 30px corners; cards 28px (`rounded-3xl`); chips and inputs 20px
(`rounded-2xl`); pills fully round. Shadows (`tailwind.config.cjs`): `soft`
for paper, `raised` for the wallet and primary buttons, `float` for sheets,
tooltips and the rail, `pressed` for switch tracks and wells.

## Components

| Component | File | Notes |
|---|---|---|
| `Denim`, `DenimLabel`, `DenimFigure`, `Pocket`, `DenimSwitch` | `ui/Denim.tsx` | The wallet card; `compact` for a slim strip |
| `Card`, `SectionTitle`, `IconChip`, `Segmented` | `ui/Paper.tsx` | Paper, the caps label row, tinted icon squares, pressed switches |
| `PageHeader` | `ui/PageHeader.tsx` | Title, way back, right-hand controls; sticky |
| `Navigation` | `Navigation.tsx` | Phones and tablets: the dock with its sprout and lotus. Desktops (≥1024px): a rail with the logo, the four tabs, Add an entry and Import |
| Chart kit | `charts/kit.tsx` | `ChartCard` (label, legend, Numbers/Chart switch to a table), `Tooltip`, `Legend`, `niceTicks` in the shown currency |
| Charts | `charts/*.tsx` | `MoneyInOut`, `PaceChart`, `SplitBar`, `RankedBars`, `UsualBars`, `WeekdayBars`, `CalendarHeat` |
| Brand | `ui/Brand.tsx` | `BrandIcon` (the app icon's tile), `Wordmark` (with a cream copy for dark themes), `Mascot` (welcome, think, encourage, celebrate, review), `TAGLINE` |
| Decorations | `ui/Decor.tsx` | `Sprout`, `LotusFlower`, `FloatingLeaf`, `RangoliCorner`, `Diya`, `PottedPlant`, `MandalaDots`, `Paisley` |

Every chart has a hover/tap tooltip, keyboard focus, a table of the same
numbers, solid hairline gridlines, bars of 24px at most with 4px rounded
ends, 2px lines and ringed dots.

## Layout

| Width | Layout |
|---|---|
| Phones (<768px) | One column, 430px at most, the dock floating at the bottom |
| Tablets (768–1023px) | Content up to 672–768px; Home's cards in two columns; the dock |
| Desktops (≥1024px) | The rail on the left; content beside it, 12-column grids: Home, Pulse and its pages up to 1152px, Flow, Rewind, Data Studio and Category split up to 1024px, Vault 896px, settings and forms 672–768px |

Every screen is checked for overflow and errors at 360, 820, 1024 and 1440px.

## Audit and critique (1.5.6)

What was found, and what was done about it.

| Finding | Severity | Done |
|---|---|---|
| Pulse's projection ran rent and one-offs forward, overstating the month several times on early days | Critical | Fixed: only everyday spending runs on; bills still due are added from their schedule |
| Budgets, the daily limit, the savings goal and Vault's edit and filters saved typed amounts as rupees when another currency was shown | Critical | Fixed: typed in the shown currency, saved in rupees to the paisa |
| Charts used sage and rose, which colour-blind readers can't tell apart, with dashed gridlines | Moderate | New validated chart palette; solid hairlines |
| Health check scored a made-up "health score" | Moderate | Replaced by Insights, from the same analysis as Pulse; "Ask Wall-ette" shown as coming soon |
| The 1.5.6 pass had dropped the dock's sprout and lotus, the caps labels and the data screens' decorations | Moderate | Restored as they were |
| The web app was a phone column on desktops, with the dock over content | Moderate | Side rail and desktop grids |
| Grey Tailwind shadows (`shadow-sm` … `shadow-2xl`) beside the lit ones | Minor | New work uses `soft`, `raised`, `float`; older screens still to move over |
| Several sizes of 8–9px text | Minor | 8px raised to 9px; keep new text at 10px or more |

Recommendations, not applied because they would change the approved look:

- **Pastel text contrast.** `text-sage`, `text-rose`, `text-lavender`,
  `text-sand` and `text-ocean` on white measure about 1.7–2.4:1 and `mut`
  3.3:1, under the 4.5:1 that small text needs. A deeper shade of each hue
  for text only (fills unchanged) would fix it app-wide from
  `tailwind.config.cjs` `textColor`; a version was tried in 1.5.6 and held
  back for a decision.
- **Icon chips.** Pastel icons on their own soft tint are about 1.6:1; the
  same deeper shades would lift them to 3:1.
