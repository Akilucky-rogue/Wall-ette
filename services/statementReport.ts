/**
 * The statement report (Data Studio): one self-contained HTML page that
 * opens anywhere and prints to PDF, in Wall-ette's own look (the stitched
 * wallet, Crimson Pro figures, small caps labels) and with the same numbers
 * as Pulse: every month in it is worked out by services/pulseAnalysis.ts, so
 * spending, what came in, what was kept and bills / everyday / one-offs mean
 * the same thing on the phone and on paper.
 *
 * Money moved between your own accounts, to family or to investments is
 * shown once, as cash flow, and left out of everything else.
 *
 * Pure (no React, no DOM): scripts/check-report.mjs builds reports from
 * made-up wallets and checks the figures add up.
 */
import { Transaction, TransactionType } from '../types';
import { analyzePulse, wholeShares, type Insight } from './pulseAnalysis';
import { analyzeIncome, detectRecurringCharges, prettyMerchant } from './analyticsService';
import { parseDay } from '../utils/dates';

export type ReportPeriod = 'MONTH' | 'QUARTER' | 'ALL';

export const PERIOD_LABELS: Record<ReportPeriod, string> = {
  MONTH: 'This month',
  QUARTER: 'Last 3 months',
  ALL: 'All time',
};

export interface ReportInput {
  transactions: Transaction[];
  /** Whether an entry counts as spending or income ('spend'), or is money moved ('moved'). */
  isMoved: (t: Transaction) => boolean;
  period: ReportPeriod;
  now?: Date;
  /** Rupees as the app shows them, whole units. */
  money: (n: number) => string;
  /** The currency amounts are shown in ('INR', 'USD', …). */
  currency: string;
  openingBalance: number;
  budgets?: Record<string, number>;
}

export interface ReportMonth { key: string; label: string; cameIn: number; spent: number; kept: number; keptPct: number | null }

export interface ReportData {
  periodLabel: string;
  /** First and last day covered ('YYYY-MM-DD'), or null with no entries. */
  from: string | null;
  to: string | null;
  entries: number;
  moneyIn: number;
  moneyOut: number;
  movedIn: number;
  movedOut: number;
  cameIn: number;
  spent: number;
  kept: number;
  keptPct: number | null;
  balance: number;
  months: ReportMonth[];
  split: { bills: number; everyday: number; oneOffs: number; shares: number[] };
  categories: { name: string; amount: number; count: number; share: number; topPayee: string | null }[];
  payees: { name: string; amount: number; count: number }[];
  biggestOut: Transaction[];
  biggestIn: Transaction[];
  insights: Insight[];
  insightsMonth: string;
}

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const monthLabel = (k: string, long = false) =>
  parseDay(`${k}-01`).toLocaleDateString('en-GB', long ? { month: 'long', year: 'numeric' } : { month: 'short', year: '2-digit' });
const dayLabel = (d: string) => parseDay(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

/** The report's figures. */
export function reportData({ transactions, isMoved, period, now = new Date(), openingBalance, budgets = {}, money }: ReportInput): ReportData {
  const todayKey = monthKey(now);
  const startKey = period === 'MONTH' ? todayKey
    : period === 'QUARTER' ? monthKey(new Date(now.getFullYear(), now.getMonth() - 2, 1))
    : transactions.reduce((m, t) => (t.date.slice(0, 7) < m ? t.date.slice(0, 7) : m), todayKey);
  // The period runs from the first of its first month to the end of this month.
  const inPeriod = transactions.filter(t => t.date.slice(0, 7) >= startKey && t.date.slice(0, 7) <= todayKey);
  const counted = transactions.filter(t => !isMoved(t));

  let moneyIn = 0, moneyOut = 0, movedIn = 0, movedOut = 0, cameIn = 0, spent = 0;
  let from: string | null = null, to: string | null = null;
  for (const t of inPeriod) {
    if (!from || t.date < from) from = t.date;
    if (!to || t.date > to) to = t.date;
    const moved = isMoved(t);
    if (t.type === TransactionType.INCOME) { moneyIn += t.amount; if (moved) movedIn += t.amount; else cameIn += t.amount; }
    else { moneyOut += t.amount; if (moved) movedOut += t.amount; else spent += t.amount; }
  }
  let balance = openingBalance;
  for (const t of transactions) balance += t.type === TransactionType.INCOME ? t.amount : -t.amount;

  // Each month by Pulse's own analysis, oldest first.
  const months: ReportMonth[] = [];
  let bills = 0, everyday = 0, oneOffs = 0;
  let latest: ReturnType<typeof analyzePulse> | null = null;
  for (let d = parseDay(`${startKey}-01`); monthKey(d) <= todayKey; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
    const r = analyzePulse({ counted, month: d, now, money, budgets });
    months.push({ key: r.key, label: monthLabel(r.key), cameIn: r.cameIn, spent: r.spent, kept: r.kept, keptPct: r.keptPct });
    bills += r.split.bills; everyday += r.split.everyday; oneOffs += r.split.oneOffs;
    latest = r;
  }

  const byCat = new Map<string, { amount: number; count: number; payees: Map<string, number> }>();
  const byPayee = new Map<string, { amount: number; count: number }>();
  const outs: Transaction[] = [], ins: Transaction[] = [];
  for (const t of inPeriod) {
    if (isMoved(t)) continue;
    if (t.type === TransactionType.INCOME) { ins.push(t); continue; }
    outs.push(t);
    const payee = prettyMerchant(t.merchant || t.category);
    const c = byCat.get(t.category) ?? { amount: 0, count: 0, payees: new Map() };
    c.amount += t.amount; c.count++; c.payees.set(payee, (c.payees.get(payee) ?? 0) + t.amount);
    byCat.set(t.category, c);
    const p = byPayee.get(payee) ?? { amount: 0, count: 0 };
    p.amount += t.amount; p.count++;
    byPayee.set(payee, p);
  }
  const catRows = [...byCat.entries()].sort((a, b) => b[1].amount - a[1].amount || a[0].localeCompare(b[0]));
  const catShares = wholeShares(catRows.map(([, c]) => c.amount));

  return {
    periodLabel: PERIOD_LABELS[period],
    from, to,
    entries: inPeriod.length,
    moneyIn, moneyOut, movedIn, movedOut,
    cameIn, spent, kept: cameIn - spent,
    keptPct: cameIn > 0 ? Math.round(((cameIn - spent) / cameIn) * 100) : null,
    balance,
    months,
    split: { bills, everyday, oneOffs, shares: wholeShares([bills, everyday, oneOffs]) },
    categories: catRows.map(([name, c], i) => ({
      name, amount: c.amount, count: c.count, share: catShares[i],
      topPayee: [...c.payees.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
    })),
    payees: [...byPayee.entries()].map(([name, p]) => ({ name, ...p })).sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name)).slice(0, 10),
    biggestOut: [...outs].sort((a, b) => b.amount - a.amount).slice(0, 5),
    biggestIn: [...ins].sort((a, b) => b.amount - a.amount).slice(0, 5),
    insights: latest?.insights ?? [],
    insightsMonth: latest ? latest.name : '',
  };
}

// The report's colours: the app's light Sage theme and the chart palette
// (utils/theme.ts), fixed so the page prints the same from any theme.
const C = {
  bg: '#FAF9F6', card: '#FFFFFF', ink: '#333333', mut: '#8E8D8A', line: '#EFEDE8', line2: '#E8E5DE',
  sage: '#9BAE93', wallet: '#5D6758', wallet2: '#4B5247',
  in: '#1D7AA3', out: '#C0714A', out1: '#8A4A2C', out3: '#E2A685',
};

/** The statement as one HTML page. */
export function buildStatementHtml(input: ReportInput): { html: string; data: ReportData } {
  const d = reportData(input);
  const m = input.money;
  const now = input.now ?? new Date();
  const generated = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const span = d.from && d.to ? `${dayLabel(d.from)} to ${dayLabel(d.to)}` : 'No entries';
  const sign = (n: number) => (n < 0 ? '−' : '');
  const pct = (n: number | null) => (n === null ? '–' : `${n}%`);
  const shareText = (s: number, amount: number) => (s === 0 && amount > 0 ? 'under 1%' : `${s}%`);

  // ── Money in and out, by month (SVG columns), drawn for a phone and for a
  // wider page so the labels stay readable at either size ──
  const chartMonths = d.months.slice(-12);
  const maxV = Math.max(1, ...chartMonths.map(x => Math.max(x.cameIn, x.spent)));
  const pow = 10 ** Math.floor(Math.log10(maxV / 3));
  const step = [1, 2, 2.5, 5, 10].map(s => s * pow).find(s => s >= maxV / 3) ?? pow * 10;
  const top = Math.ceil(maxV / step) * step;
  const ticks: number[] = [];
  for (let v = 0; v <= top + step / 2; v += step) ticks.push(v);
  const columns = (W: number, cls: string) => {
    const PLOT = 150, TOP = 10, AXIS = 22;
    // Room for the longest tick label (about 6.5px a character at 11px).
    const LEFT = Math.max(48, Math.ceil(Math.max(...ticks.map(t => m(t).length)) * 6.5) + 12);
    const y = (v: number) => TOP + PLOT - (v / top) * PLOT;
    const band = (W - LEFT) / Math.max(1, chartMonths.length);
    const bar = Math.max(4, Math.min(24, (band * 0.7 - 2) / 2));
    const col = (x: number, v: number, fill: string) => {
      const h = y(0) - y(v);
      if (h <= 0) return '';
      const r = Math.min(4, bar / 2, h);
      return `<path d="M${x},${y(0)}V${y(v) + r}A${r},${r} 0 0 1 ${x + r},${y(v)}H${x + bar - r}A${r},${r} 0 0 1 ${x + bar},${y(v) + r}V${y(0)}Z" fill="${fill}"/>`;
    };
    const every = Math.max(1, Math.ceil(chartMonths.length / Math.floor((W - LEFT) / 44)));
    return `<svg viewBox="0 0 ${W} ${TOP + PLOT + AXIS}" role="img" aria-label="Money in and out by month" class="chart ${cls}">
      ${ticks.map(t => `<line x1="${LEFT}" x2="${W}" y1="${y(t)}" y2="${y(t)}" stroke="${t === 0 ? C.line2 : C.line}" stroke-width="1"/>
      <text x="${LEFT - 8}" y="${y(t)}" dy="0.32em" text-anchor="end" class="tick">${esc(m(t))}</text>`).join('')}
      ${chartMonths.map((x, i) => {
        const gx = LEFT + i * band + (band - (bar * 2 + 2)) / 2;
        return col(gx, x.cameIn, C.in) + col(gx + bar + 2, x.spent, C.out)
          + ((chartMonths.length - 1 - i) % every === 0 ? `<text x="${LEFT + i * band + band / 2}" y="${TOP + PLOT + 16}" text-anchor="middle" class="tick">${esc(x.label)}</text>` : '');
      }).join('')}
    </svg>`;
  };
  const monthsSvg = chartMonths.length > 1 ? `
    ${columns(360, 'narrow')}${columns(680, 'wide-chart')}
    <div class="legend"><span><i style="background:${C.in}"></i>Came in</span><span><i style="background:${C.out}"></i>Spent</span></div>` : '';

  // ── Bills, everyday, one-offs (tall segmented bar) ──
  const parts = [
    { label: 'Bills', note: 'rent, utilities, subscriptions', v: d.split.bills, s: d.split.shares[0], fill: C.out1, ink: '#FFFFFF' },
    { label: 'Everyday', note: 'food, travel, shopping', v: d.split.everyday, s: d.split.shares[1], fill: C.out, ink: '#1A1A18' },
    { label: 'One-offs', note: 'large, unusual payments', v: d.split.oneOffs, s: d.split.shares[2], fill: C.out3, ink: '#1A1A18' },
  ];
  const splitHtml = d.spent > 0 ? `
    <div class="split" role="img" aria-label="${esc(parts.map(p => `${p.label} ${p.s}%`).join(', '))}">
      ${parts.filter(p => p.v > 0).map(p => `<div style="flex:${p.v};background:${p.fill};color:${p.ink}">${p.s >= 8 ? `${p.s}%` : ''}</div>`).join('')}
    </div>
    <table class="rows">${parts.map(p => `
      <tr><td><i class="key" style="background:${p.fill}"></i><b>${p.label}</b> <span class="mut">${p.note}</span></td>
          <td class="num"><b>${esc(m(p.v))}</b></td><td class="num mut">${shareText(p.s, p.v)}</td></tr>`).join('')}
    </table>` : '<p class="mut">Nothing spent in this period.</p>';

  const maxCat = Math.max(1, ...d.categories.map(c => c.amount));
  const maxPayee = Math.max(1, ...d.payees.map(p => p.amount));
  const toneLabel: Record<Insight['tone'], string> = { watch: 'Worth a look', good: 'Going well', info: 'Good to know' };
  const toneColor: Record<Insight['tone'], string> = { watch: '#C98989', good: '#7D937A', info: '#6F8E9C' };
  const eyes = `<span class="eyes" aria-hidden="true"><span><b></b></span><span><b></b></span></span>`;

  const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Wall-ette statement, ${esc(d.periodLabel.toLowerCase())}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Crimson+Pro:wght@400;600&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  *{box-sizing:border-box}
  body{margin:0;background:${C.bg};color:${C.ink};font:14px/1.55 Inter,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;-webkit-font-smoothing:antialiased;padding:24px 12px}
  .page{max-width:760px;margin:0 auto}
  .serif{font-family:'Crimson Pro',Georgia,'Times New Roman',serif}
  header{display:flex;align-items:center;gap:12px;margin:0 4px 20px}
  .logo{width:44px;height:44px;border-radius:50%;background:${C.sage};display:flex;align-items:center;justify-content:center;flex:none}
  .eyes{display:flex;gap:2px}.eyes>span{width:12px;height:15px;border-radius:5px;background:rgb(51 51 51/.9);display:flex;align-items:center;justify-content:center}
  .eyes b{width:7px;height:7px;border-radius:50%;background:#E3EAE0;box-shadow:inset 0 0 0 2px #E3EAE0,inset 0 0 0 4px ${C.sage}}
  h1{font:600 24px/1.1 'Crimson Pro',Georgia,serif;margin:0;letter-spacing:-.01em}
  .meta{color:${C.mut};font-size:12px}
  .label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:${C.mut};margin:0 0 12px}
  .wallet{position:relative;isolation:isolate;color:#FBFAF6;background:linear-gradient(155deg,${C.wallet} 0%,${C.wallet2} 100%);border-radius:30px;padding:24px 24px 20px;box-shadow:0 1px 2px rgb(62 52 40/.10),0 6px 12px -4px rgb(62 52 40/.14),0 22px 40px -16px rgb(62 52 40/.40);overflow:hidden;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .wallet::before{content:'';position:absolute;inset:0;border-radius:inherit;pointer-events:none;background-image:repeating-linear-gradient(45deg,rgb(255 255 255/.03) 0 1px,transparent 1px 4px),repeating-linear-gradient(-45deg,rgb(0 0 0/.035) 0 1px,transparent 1px 4px)}
  .wallet::after{content:'';position:absolute;inset:7px;border-radius:22px;border:1.5px dashed rgb(255 255 255/.24);pointer-events:none}
  .wallet .wl{font-size:12px;font-weight:500;letter-spacing:.025em;color:rgb(251 250 246/.85);margin:0}
  .wallet .fig{font:400 40px/1 'Crimson Pro',Georgia,serif;margin:16px 0 0;text-shadow:0 1px 0 rgb(0 0 0/.22)}
  .pockets{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-top:18px}
  .pocket{background:rgb(0 0 0/.16);box-shadow:inset 0 2px 4px rgb(0 0 0/.22),0 1px 0 rgb(255 255 255/.10);border-radius:20px;padding:12px 14px}
  .pocket p{margin:0}.pocket .pl{font-size:11px;font-weight:500;color:rgb(251 250 246/.85)}
  .pocket .pv{font:400 22px/1.2 'Crimson Pro',Georgia,serif;margin-top:4px}
  .pocket .pn{font-size:11px;color:rgb(251 250 246/.85);margin-top:2px}
  .card{background:${C.card};border-radius:28px;padding:20px;margin-top:16px;box-shadow:0 0 0 1px rgb(62 52 40/.035),0 1px 2px rgb(62 52 40/.06),0 10px 24px -12px rgb(62 52 40/.22);break-inside:avoid;page-break-inside:avoid}
  .grid2{display:grid;grid-template-columns:1fr;gap:0 16px}
  @media(min-width:700px){.grid2{grid-template-columns:1fr 1fr}.grid2 .card{margin-top:16px}}
  .mut{color:${C.mut}}
  table{width:100%;border-collapse:collapse;font-size:13px}
  th{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:${C.mut};text-align:left;padding:0 6px 8px}
  td{padding:8px 6px;border-top:1px solid ${C.line};vertical-align:middle}
  th.num,td.num{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
  .chart{width:100%;height:auto;display:block}.chart.wide-chart{display:none}
  @media(min-width:560px){.chart.narrow{display:none}.chart.wide-chart{display:block}}
  .tick{font:11px Inter,system-ui,sans-serif;fill:${C.mut}}
  .legend{display:flex;gap:16px;font-size:12px;color:${C.mut};margin:8px 0 4px}
  .legend i,.key{display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:6px;vertical-align:-1px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .split{display:flex;gap:2px;height:28px;margin-bottom:10px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .split div{border-radius:4px;font-size:12px;font-weight:600;padding:0 8px;display:flex;align-items:center;min-width:2px;overflow:hidden;white-space:nowrap}
  .rows td{border-top:none;padding:4px 0}
  .rank{list-style:none;margin:0;padding:0}
  .rank li{margin:0 0 12px}.rank .top{display:flex;justify-content:space-between;gap:12px;font-weight:600}
  .rank .bar{height:8px;border-radius:4px;background:${C.line};margin-top:6px;overflow:hidden;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .rank .bar i{display:block;height:100%;border-radius:4px;background:${C.out}}
  .rank .note{font-size:11px;color:${C.mut};margin-top:3px}
  .ins{list-style:none;margin:0;padding:0}
  .ins li{padding:10px 0;border-top:1px solid ${C.line}}.ins li:first-child{border-top:none;padding-top:0}
  .ins .t{font-weight:600}.ins .tone{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;margin-right:8px}
  .ins .d{font-size:12px;color:${C.mut};margin-top:2px}
  .note{font-size:12px;color:${C.mut};margin:12px 4px 0}
  footer{margin:28px 4px 8px;text-align:center;color:#B9B7B2;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.1em}
  td{overflow-wrap:anywhere}
  @media(max-width:520px){.wide{display:none}.card{padding:18px 16px}.wallet{padding:22px 20px 18px}}
  @media print{body{background:#fff;padding:0}.card{box-shadow:none;border:1px solid ${C.line}}@page{margin:14mm}}
</style></head><body><div class="page">

  <header>
    <span class="logo">${eyes}</span>
    <div><h1>Wall·ette statement</h1>
    <div class="meta">${esc(d.periodLabel)} · ${esc(span)} · ${d.entries} ${d.entries === 1 ? 'entry' : 'entries'} · made ${esc(generated)}${input.currency !== 'INR' ? ` · amounts in ${esc(input.currency)} at today's rate` : ''}</div></div>
  </header>

  <section class="wallet" aria-label="Spending">
    <p class="wl">Spent${input.period === 'MONTH' ? ` in ${esc(monthLabel(monthKey(now), true).split(' ')[0])} so far` : `, ${esc(d.periodLabel.toLowerCase())}`}</p>
    <p class="fig">${esc(m(d.spent))}</p>
    <div class="pockets">
      <div class="pocket"><p class="pl">Came in</p><p class="pv">+${esc(m(d.cameIn))}</p><p class="pn">${d.keptPct !== null ? `Kept ${sign(d.kept)}${esc(m(Math.abs(d.kept)))}, ${d.keptPct}%` : 'Nothing came in'}</p></div>
      ${d.months.length > 1 ? `<div class="pocket"><p class="pl">A month</p><p class="pv">${esc(m(d.spent / d.months.length))}</p><p class="pn">spent, over ${d.months.length} months</p></div>` : ''}
      <div class="pocket"><p class="pl">Balance now</p><p class="pv">${sign(d.balance)}${esc(m(Math.abs(d.balance)))}</p><p class="pn">with your opening balance</p></div>
    </div>
  </section>
  ${d.movedIn + d.movedOut > 0 ? `<p class="note">Money moved between your own accounts, to family or to investments: ${[d.movedOut > 0 ? `${esc(m(d.movedOut))} out` : '', d.movedIn > 0 ? `${esc(m(d.movedIn))} in` : ''].filter(Boolean).join(' and ')}. It isn't spending or income, so it's left out below. All money in: ${esc(m(d.moneyIn))}; all money out: ${esc(m(d.moneyOut))}.</p>` : ''}

  ${d.insights.length ? `<section class="card"><p class="label">What stands out${d.months.length > 1 ? ` in ${esc(d.insightsMonth)}` : ''}</p>
    <ul class="ins">${d.insights.map(i => `<li><span class="tone" style="color:${toneColor[i.tone]}">${toneLabel[i.tone]}</span><span class="t">${esc(i.title)}</span><div class="d">${esc(i.detail)}</div></li>`).join('')}</ul>
  </section>` : ''}

  ${d.months.length > 1 ? `<section class="card"><p class="label">Money in and out${d.months.length > 12 ? ' · last 12 months' : ''}</p>
    ${monthsSvg}
    <table><tr><th>Month</th><th class="num">Came in</th><th class="num">Spent</th><th class="num">Kept</th><th class="num">Kept %</th></tr>
    ${d.months.slice().reverse().map(x => `<tr><td>${esc(x.label)}</td><td class="num">${esc(m(x.cameIn))}</td><td class="num">${esc(m(x.spent))}</td><td class="num">${sign(x.kept)}${esc(m(Math.abs(x.kept)))}</td><td class="num mut">${pct(x.keptPct)}</td></tr>`).join('')}
    </table>
  </section>` : ''}

  <div class="grid2">
    <section class="card"><p class="label">Where it went</p>${splitHtml}</section>
    ${d.payees.length ? `<section class="card"><p class="label">Top payees</p><ul class="rank">${d.payees.slice(0, 6).map(p => `
      <li><div class="top"><span>${esc(p.name)}</span><span>${esc(m(p.amount))}</span></div><div class="bar"><i style="width:${Math.max(1.5, (p.amount / maxPayee) * 100).toFixed(1)}%"></i></div><div class="note">${p.count} ${p.count === 1 ? 'payment' : 'payments'}</div></li>`).join('')}</ul></section>` : ''}
  </div>

  ${d.categories.length ? `<section class="card"><p class="label">By category</p>
    <table><tr><th>Category</th><th class="num">Spent</th><th class="num">Share</th><th class="num wide">Payments</th><th class="wide">Most at</th></tr>
    ${d.categories.map(c => `<tr><td><b>${esc(c.name)}</b><div class="rank"><div class="bar" style="margin-top:4px"><i style="width:${Math.max(1.5, (c.amount / maxCat) * 100).toFixed(1)}%"></i></div></div></td><td class="num"><b>${esc(m(c.amount))}</b></td><td class="num mut">${shareText(c.share, c.amount)}</td><td class="num mut wide">${c.count}</td><td class="mut wide">${esc(c.topPayee ?? '–')}</td></tr>`).join('')}
    </table>
  </section>` : ''}

  ${recurringSection(input, m)}

  ${d.biggestOut.length ? `<section class="card"><p class="label">Biggest payments</p>
    <table><tr><th>Payee</th><th>Date</th><th class="num">Amount</th></tr>
    ${d.biggestOut.map(t => `<tr><td>${esc(prettyMerchant(t.merchant || t.category))} <span class="mut">${esc(t.category)}</span></td><td class="mut">${esc(dayLabel(t.date))}</td><td class="num"><b>−${esc(m(t.amount))}</b></td></tr>`).join('')}
    ${d.biggestIn.length ? `<tr><th colspan="3" style="padding-top:16px">Biggest amounts in</th></tr>${d.biggestIn.map(t => `<tr><td>${esc(prettyMerchant(t.merchant || t.category))} <span class="mut">${esc(t.category)}</span></td><td class="mut">${esc(dayLabel(t.date))}</td><td class="num"><b>+${esc(m(t.amount))}</b></td></tr>`).join('')}` : ''}
    </table>
  </section>` : ''}

  ${incomeSection(input, m)}

  <p class="note">Worked out on your device from your entries, the same way as Pulse. Kept is what came in minus what was spent. Bills are fixed costs and payees that charge on a schedule; one-offs are large, unusual payments.</p>
  <footer>Wall·ette · print this page to save it as a PDF</footer>
</div></body></html>`;
  return { html, data: d };
}

/** Recurring charges, all of them, with what they come to a month and a year. */
function recurringSection(input: ReportInput, m: (n: number) => string): string {
  const counted = input.transactions.filter(t => !input.isMoved(t));
  const list = detectRecurringCharges(counted, input.now ?? new Date(), Infinity);
  if (!list.length) return '';
  const monthly = list.reduce((s, r) => s + r.monthlyCost, 0);
  return `<section class="card"><p class="label">Recurring charges · about ${esc(m(monthly))} a month, ${esc(m(monthly * 12))} a year</p>
    <table><tr><th>Payee</th><th>How often</th><th class="num">Each time</th><th class="num">A month</th></tr>
    ${list.map(r => `<tr><td>${esc(prettyMerchant(r.name))}</td><td class="mut">${r.cadence.charAt(0)}${r.cadence.slice(1).toLowerCase()}</td><td class="num">${esc(m(r.amount))}</td><td class="num mut">${esc(m(r.monthlyCost))}</td></tr>`).join('')}
    </table></section>`;
}

/** Where income comes from, over the last twelve months. */
function incomeSection(input: ReportInput, m: (n: number) => string): string {
  const counted = input.transactions.filter(t => !input.isMoved(t));
  const a = analyzeIncome(counted);
  if (!a.streams.length) return '';
  const badge: Record<string, string> = { FIXED: 'Fixed', RECURRING: 'Recurring', OCCASIONAL: 'Occasional', ONE_OFF: 'One-off' };
  return `<section class="card"><p class="label">Income, last 12 months${a.stability ? ` · ${esc(a.stability.label.toLowerCase())}, about ${esc(m(a.stability.avgMonthly))} a month` : ''}</p>
    <table><tr><th>Source</th><th>Pattern</th><th class="num">Times</th><th class="num">Typical</th><th class="num">12 months</th></tr>
    ${a.streams.slice(0, 8).map(s => `<tr><td>${esc(prettyMerchant(s.name))}</td><td class="mut">${badge[s.badge] ?? ''}</td><td class="num mut">${s.occurrences}</td><td class="num">${esc(m(s.typicalAmount))}</td><td class="num"><b>${esc(m(s.total12m))}</b></td></tr>`).join('')}
    </table></section>`;
}

/** The CSV of a period's entries: ISO dates, rupees to the paisa, and how each one counts. */
export function transactionsCsv(transactions: Transaction[], isMoved: (t: Transaction) => boolean, period: ReportPeriod, now = new Date()): { csv: string; rows: number } {
  const todayKey = monthKey(now);
  const startKey = period === 'MONTH' ? todayKey : period === 'QUARTER' ? monthKey(new Date(now.getFullYear(), now.getMonth() - 2, 1)) : '';
  const cell = (s: string) => `"${s.replace(/"/g, '""')}"`;
  // A cell that starts like a formula is written as text (CSV injection).
  const safe = (s: string) => cell(/^[=+\-@\t\r]/.test(s) ? `'${s}` : s);
  const list = transactions.filter(t => !startKey || t.date.slice(0, 7) >= startKey).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const head = ['Date', 'Payee', 'Category', 'Type', 'Amount (INR)', 'Counts as', 'Note'];
  const rows = list.map(t => [
    t.date,
    safe(t.merchant || ''),
    safe(t.category),
    t.type === TransactionType.INCOME ? 'In' : 'Out',
    t.amount.toFixed(2),
    isMoved(t) ? 'Money moved' : t.type === TransactionType.INCOME ? 'Income' : 'Spending',
    safe(t.note || ''),
  ].join(','));
  return { csv: [head.join(','), ...rows].join('\n'), rows: rows.length };
}

