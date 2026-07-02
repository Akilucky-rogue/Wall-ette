import React, { useMemo, useState } from 'react';
import { AppScreen, Transaction, TransactionType } from '../types';
import { useWallet } from '../context/WalletContext';
import { analyzeFinancialHealth } from '../services/insightsService';
import { detectRecurringCharges, analyzeIncome } from '../services/analyticsService';
import { exportFile } from '../utils/exportFile';
import { log } from '../utils/log';
import { WallEEyes, FloatingLeaf, PottedPlant, RangoliCorner, LotusFlower, Diya } from './SplashScreen';

interface ExportReportsProps {
  onNavigate: (screen: AppScreen) => void;
}

type Period = 'MONTH' | 'QUARTER' | 'ALL';

const PERIOD_LABELS: Record<Period, string> = {
  MONTH: 'This Month',
  QUARTER: 'Last 3 Months',
  ALL: 'All Time',
};

const escapeHtml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const csvCell = (s: string): string => `"${s.replace(/"/g, '""')}"`;

const ExportReports: React.FC<ExportReportsProps> = ({ onNavigate }) => {
  const { transactions, openingBalance, formatAmount } = useWallet();
  const [period, setPeriod] = useState<Period>('MONTH');
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  // ── Period filtering + stats (one pass) ────────────────────────────────────
  const periodStart = useMemo(() => {
    const now = new Date();
    if (period === 'MONTH') return new Date(now.getFullYear(), now.getMonth(), 1);
    if (period === 'QUARTER') return new Date(now.getFullYear(), now.getMonth() - 2, 1);
    return null; // ALL
  }, [period]);

  const { periodTxs, stats } = useMemo(() => {
    const txs: Transaction[] = [];
    let income = 0, expense = 0;
    const cats = new Map<string, number>();

    for (const t of transactions) {
      if (periodStart && new Date(t.date) < periodStart) continue;
      txs.push(t);
      if (t.type === TransactionType.INCOME) income += t.amount;
      else {
        expense += t.amount;
        cats.set(t.category, (cats.get(t.category) || 0) + t.amount);
      }
    }

    const topCategories = [...cats.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
    return {
      periodTxs: txs,
      stats: {
        income,
        expense,
        net: income - expense,
        savingsRate: income > 0 ? Math.round(((income - expense) / income) * 100) : null,
        topCategories,
        count: txs.length,
      },
    };
  }, [transactions, periodStart]);

  const currentBalance = useMemo(() => {
    let net = 0;
    for (const t of transactions) net += t.type === TransactionType.INCOME ? t.amount : -t.amount;
    return openingBalance + net;
  }, [transactions, openingBalance]);

  const stamp = new Date().toISOString().split('T')[0];
  const periodSlug = period.toLowerCase();
  const fmt = (n: number) => formatAmount(n).split('.')[0];

  // ── Exporters ──────────────────────────────────────────────────────────────

  const exportCsv = async () => {
    if (busy) return;
    setBusy('csv');
    try {
      const headers = ['Date', 'Merchant', 'Category', 'Type', 'Amount', 'Note'];
      const rows = periodTxs.map(t => [
        new Date(t.date).toLocaleDateString('en-GB'),
        csvCell(t.merchant || ''),
        csvCell(t.category),
        t.type,
        t.amount.toFixed(2),
        csvCell(t.note || ''),
      ].join(','));
      const csv = [headers.join(','), ...rows].join('\n');
      const outcome = await exportFile(`wall-ette-transactions-${periodSlug}-${stamp}.csv`, 'text/csv;charset=utf-8;', csv);
      showToast(outcome === 'shared' ? 'Share sheet opened — pick where to save' : 'CSV downloaded');
    } catch (e) {
      log.warn('CSV export failed');
      showToast('Export failed — please try again');
    } finally {
      setBusy(null);
    }
  };

  const exportStatement = async () => {
    if (busy) return;
    setBusy('statement');
    try {
      const insights = await analyzeFinancialHealth(
        periodTxs.map(t => ({ ...t, merchant: t.merchant || '' }))
      );
      const recurring = detectRecurringCharges(transactions).slice(0, 8);
      const maxCat = stats.topCategories[0]?.[1] || 1;
      const periodLabel = PERIOD_LABELS[period];
      const generated = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

      // ── Deep-dive stats (single pass over the period) ──────────────────
      const byMonth = new Map<string, { inc: number; out: number }>();
      const byCat = new Map<string, { total: number; count: number; merchants: Map<string, number> }>();
      const byMerchant = new Map<string, { total: number; count: number }>();
      const byDay = new Map<string, number>();
      const weekday = Array.from({ length: 7 }, () => ({ sum: 0, days: new Set<string>() }));
      const expensesArr: Transaction[] = [];
      const incomesArr: Transaction[] = [];
      let firstDay: string | null = null, lastDay: string | null = null;

      for (const t of periodTxs) {
        const d = new Date(t.date);
        const mk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const m = byMonth.get(mk) || { inc: 0, out: 0 };
        const dayKey = t.date.slice(0, 10);
        if (!firstDay || dayKey < firstDay) firstDay = dayKey;
        if (!lastDay || dayKey > lastDay) lastDay = dayKey;
        if (t.type === TransactionType.INCOME) {
          m.inc += t.amount; incomesArr.push(t);
        } else {
          m.out += t.amount;
          const c = byCat.get(t.category) || { total: 0, count: 0, merchants: new Map<string, number>() };
          c.total += t.amount; c.count++;
          const mer = t.merchant || 'Unknown';
          c.merchants.set(mer, (c.merchants.get(mer) || 0) + t.amount);
          byCat.set(t.category, c);
          // Transfers/adjustments/investments are money MOVED, not money
          // SPENT — kept in cash-flow totals, out of spending analysis.
          const isTransferCat = t.category === 'Transfer Out' || t.category === 'Adjustment' || t.category === 'Investment';
          if (!isTransferCat) {
            expensesArr.push(t);
            const bm = byMerchant.get(mer) || { total: 0, count: 0 };
            bm.total += t.amount; bm.count++; byMerchant.set(mer, bm);
            byDay.set(dayKey, (byDay.get(dayKey) || 0) + t.amount);
            const wd = (d.getDay() + 6) % 7; // Mon=0
            weekday[wd].sum += t.amount; weekday[wd].days.add(dayKey);
          }
        }
        byMonth.set(mk, m);
      }
      const transfersOut = (byCat.get('Transfer Out')?.total || 0)
        + (byCat.get('Adjustment')?.total || 0)
        + (byCat.get('Investment')?.total || 0);
      const spendExpense = Math.max(0, stats.expense - transfersOut);

      const months = [...byMonth.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1));
      // Charts/tables stay readable on long periods: monthly view caps at the
      // last 24 months; longer histories get a year-by-year table instead.
      const chartMonths = months.slice(-24);
      const labelStep = Math.max(1, Math.ceil(chartMonths.length / 12));
      const yearAgg = new Map<string, { inc: number; out: number }>();
      for (const [k, m] of months) {
        const y = k.slice(0, 4);
        const e = yearAgg.get(y) || { inc: 0, out: 0 };
        e.inc += m.inc; e.out += m.out; yearAgg.set(y, e);
      }
      const yearRows = [...yearAgg.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1));

      const SPEND_EXCLUDE = new Set(['Transfer Out', 'Adjustment', 'Investment']);
      const topSpendCats: [string, number][] = [...byCat.entries()]
        .filter(([name]) => !SPEND_EXCLUDE.has(name))
        .sort((a, b) => b[1].total - a[1].total)
        .slice(0, 6)
        .map(([name, c]) => [name, c.total]);
      const maxSpendCat = topSpendCats[0]?.[1] || 1;

      const catRows = [...byCat.entries()]
        .filter(([name]) => !SPEND_EXCLUDE.has(name))
        .sort((a, b) => b[1].total - a[1].total).slice(0, 6)
        .map(([name, c]) => ({
          name, total: c.total, count: c.count, avg: c.total / c.count,
          topMerchant: [...c.merchants.entries()].sort((x, y) => y[1] - x[1])[0],
        }));
      const merchantRows = [...byMerchant.entries()].sort((a, b) => b[1].total - a[1].total).slice(0, 10);
      const top5exp = [...expensesArr].sort((a, b) => b.amount - a.amount).slice(0, 5);
      const top5inc = [...incomesArr].sort((a, b) => b.amount - a.amount).slice(0, 5);
      const peakDay = [...byDay.entries()].sort((a, b) => b[1] - a[1])[0] || null;
      const spanDays = firstDay && lastDay
        ? Math.round((+new Date(lastDay) - +new Date(firstDay)) / 86400000) + 1 : 0;
      const activeSpendDays = byDay.size;
      const noSpendDays = Math.max(0, spanDays - activeSpendDays);
      const avgPerActiveDay = activeSpendDays ? spendExpense / activeSpendDays : 0;
      const WD = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      const weekdayAvg = weekday.map(w => (w.days.size ? w.sum / w.days.size : 0));
      const maxWd = Math.max(...weekdayAvg, 1);
      const ml = (k: string) =>
        new Date(+k.slice(0, 4), +k.slice(5) - 1, 1).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
      const dl = (s: string) =>
        new Date(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
      const recurringAnnual = recurring.reduce((s, r) => s + r.monthlyCost * 12, 0);
      const incomeAnalysis = analyzeIncome(transactions); // 12-month view
      const BADGE: Record<string, string> = { FIXED: 'fixed', RECURRING: 'recurring', OCCASIONAL: 'occasional', ONE_OFF: 'one-off' };

      // ── Chart data (pure CSS/SVG — the export stays self-contained) ────
      const PALETTE = ['#9BAE93', '#D4A5A5', '#D4B896', '#9CB5C1', '#B8B5D0', '#C4A98E'];
      let donutAcc = 0;
      const donutSegs = topSpendCats.map(([, v], i) => {
        const p = spendExpense > 0 ? (v / spendExpense) * 100 : 0;
        const seg = `${PALETTE[i % PALETTE.length]} ${donutAcc.toFixed(2)}% ${(donutAcc + p).toFixed(2)}%`;
        donutAcc += p;
        return seg;
      });
      if (donutAcc < 99.9) donutSegs.push(`#EFEDE8 ${donutAcc.toFixed(2)}% 100%`);
      const donutCss = `background:conic-gradient(${donutSegs.join(',')})`;

      const maxMonthFlow = Math.max(...chartMonths.map(([, m]) => Math.max(m.inc, m.out)), 1);

      const dayEntries = [...byDay.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).slice(-92);
      const maxDaySpend = Math.max(...dayEntries.map(([, v]) => v), 1);
      const dayBarW = 100 / Math.max(dayEntries.length, 1);
      const daySvgBars = dayEntries.map(([, v], i) => {
        const h = Math.max(1.5, (v / maxDaySpend) * 96);
        return `<rect x="${(i * dayBarW).toFixed(2)}" y="${(100 - h).toFixed(2)}" width="${(dayBarW * 0.72).toFixed(2)}" height="${h.toFixed(2)}" rx="0.6" fill="#D4A5A5"/>`;
      }).join('');

      const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Wall-ette Statement — ${escapeHtml(periodLabel)}</title>
<style>
  *{box-sizing:border-box}
  body{font-family:Georgia,'Times New Roman',serif;background:#FAF9F6;color:#333;margin:0;padding:20px 8px}
  .page{max-width:680px;margin:0 auto;background:#fff;border-radius:24px;padding:28px 18px;box-shadow:0 4px 20px rgba(0,0,0,.05);overflow:hidden}
  @media(min-width:560px){body{padding:32px 16px}.page{padding:40px}}
  h1{font-size:24px;margin:0}.dot{color:#9BAE93}
  .sub{color:#8E8D8A;font-size:13px;margin-top:4px;overflow-wrap:anywhere}
  .grid{display:flex;gap:12px;margin:28px 0;flex-wrap:wrap}
  .card{flex:1 1 130px;min-width:0;background:#FAF9F6;border-radius:16px;padding:14px}
  .card .l{font-size:10px;text-transform:uppercase;letter-spacing:.12em;color:#8E8D8A}
  .card .v{font-size:17px;font-weight:700;margin-top:6px;overflow-wrap:anywhere}
  .pos{color:#7d937a}.neg{color:#c98989}
  h2{font-size:13px;text-transform:uppercase;letter-spacing:.15em;color:#8E8D8A;margin:32px 0 12px;border-bottom:1px solid #eee;padding-bottom:8px}
  table{width:100%;border-collapse:collapse;font-size:13px;table-layout:fixed}
  td{padding:8px 4px;border-bottom:1px solid #f3f1ec;overflow-wrap:anywhere;vertical-align:middle}
  .tname{width:30%}.tamt{width:25%;text-align:right;font-weight:700;font-variant-numeric:tabular-nums}.tpct{width:13%;text-align:right;color:#8E8D8A}
  .rname{width:34%}.rcad{width:16%;color:#8E8D8A}.ramt{width:25%;text-align:right;font-weight:700;font-variant-numeric:tabular-nums}.rmo{width:25%;text-align:right;color:#8E8D8A;font-variant-numeric:tabular-nums}
  .num{text-align:right;font-variant-numeric:tabular-nums}
  .muted{color:#8E8D8A}
  .charts{display:flex;gap:24px;align-items:center;flex-wrap:wrap;margin:20px 0 8px}
  .donut{width:132px;height:132px;border-radius:50%;position:relative;flex:0 0 auto}
  .donut::after{content:'';position:absolute;inset:34px;background:#fff;border-radius:50%}
  .dlegend{flex:1;min-width:170px}
  .dlegend div{display:flex;align-items:center;gap:8px;font-size:12px;margin:4px 0;min-width:0}
  .dlegend .nm{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .dot2{width:10px;height:10px;border-radius:50%;flex:0 0 auto}
  .mchart{display:flex;align-items:flex-end;gap:6px;height:120px;margin:14px 0 4px}
  .mcol{flex:1;display:flex;align-items:flex-end;gap:2px;height:100%;min-width:0}
  .mbar{flex:1;border-radius:3px 3px 0 0;min-height:2px}
  .mlabels{display:flex;gap:6px}
  .mlabels span{flex:1;text-align:center;font-size:9px;color:#8E8D8A;text-transform:uppercase;overflow:hidden}
  .chartnote{font-size:10px;color:#8E8D8A;margin-top:6px}
  th{font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:#8E8D8A;text-align:left;padding:6px 4px;border-bottom:1px solid #eee;font-weight:600}
  th.num{text-align:right}
  .wbar{height:5px;border-radius:3px;background:#C4A98E;opacity:.65;max-width:100%}
  .bar{height:6px;border-radius:3px;background:#9BAE93;opacity:.7;max-width:100%}
  ul{padding-left:18px;font-size:14px;line-height:1.7;color:#444}
  li,p{overflow-wrap:anywhere}
  .foot{margin-top:36px;text-align:center;color:#b9b7b2;font-size:11px;letter-spacing:.1em;text-transform:uppercase}
  @media print{body{background:#fff;padding:0}.page{box-shadow:none}}
</style></head><body><div class="page">
  <h1>Wall<span class="dot">·</span>ette <span style="font-weight:400">Statement</span></h1>
  <div class="sub">${escapeHtml(periodLabel)} · generated ${generated} · ${stats.count} transactions</div>

  <div class="grid">
    <div class="card"><div class="l">Income</div><div class="v pos">+${fmt(stats.income)}</div></div>
    <div class="card"><div class="l">Expenses</div><div class="v neg">−${fmt(stats.expense)}</div></div>
    <div class="card"><div class="l">Net</div><div class="v ${stats.net >= 0 ? 'pos' : 'neg'}">${stats.net >= 0 ? '+' : '−'}${fmt(Math.abs(stats.net))}</div></div>
    <div class="card"><div class="l">Current Balance</div><div class="v">${fmt(currentBalance)}</div></div>
  </div>
  ${stats.savingsRate !== null ? `<div class="sub">Savings rate this period: <b>${stats.savingsRate}%</b></div>` : ''}

  ${transfersOut > 0 ? `<div class="sub" style="margin-top:8px">Transfers &amp; investments moved: <b>${fmt(transfersOut)}</b> — money moved, not spent, so it's excluded from the spending analysis below.</div>` : ''}

  ${topSpendCats.length > 0 ? `<h2>Spending split · ${fmt(spendExpense)} actually spent</h2>
  <div class="charts">
    <div class="donut" style="${donutCss}"></div>
    <div class="dlegend">
      ${topSpendCats.map(([name, amt], i) => `
      <div><span class="dot2" style="background:${PALETTE[i % PALETTE.length]}"></span>
        <span class="nm">${escapeHtml(name)}</span>
        <b>${fmt(amt)}</b>
        <span class="muted">${spendExpense > 0 ? Math.round((amt / spendExpense) * 100) : 0}%</span></div>`).join('')}
      ${donutAcc < 99.9 ? `<div><span class="dot2" style="background:#EFEDE8"></span><span class="nm">Everything else</span><b>${fmt(Math.max(0, spendExpense - topSpendCats.reduce((s, [, v]) => s + v, 0)))}</b></div>` : ''}
    </div>
  </div>` : ''}

  ${yearRows.length > 1 ? `<h2>Year by year</h2>
  <table>
    <tr><th style="width:18%">Year</th><th class="num">In</th><th class="num">Out</th><th class="num">Net</th></tr>
    ${yearRows.map(([y, m]) => `
    <tr><td>${y}</td><td class="num pos">+${fmt(m.inc)}</td><td class="num neg">−${fmt(m.out)}</td>
        <td class="num" style="font-weight:700;color:${m.inc - m.out >= 0 ? '#7d937a' : '#c98989'}">${m.inc - m.out >= 0 ? '+' : '−'}${fmt(Math.abs(m.inc - m.out))}</td></tr>`).join('')}
  </table>` : ''}

  ${chartMonths.length > 1 ? `<h2>Money in vs out by month${months.length > 24 ? ' · last 24 months' : ''}</h2>
  <div class="mchart">
    ${chartMonths.map(([, m]) => `
    <div class="mcol">
      <div class="mbar" style="background:#9BAE93;height:${Math.max(2, (m.inc / maxMonthFlow) * 100).toFixed(1)}%"></div>
      <div class="mbar" style="background:#D4A5A5;height:${Math.max(2, (m.out / maxMonthFlow) * 100).toFixed(1)}%"></div>
    </div>`).join('')}
  </div>
  <div class="mlabels">${chartMonths.map(([k], i) => `<span>${i % labelStep === 0 ? ml(k) : ''}</span>`).join('')}</div>
  <div class="chartnote"><span style="color:#7d937a">■</span> in &nbsp; <span style="color:#c98989">■</span> out</div>` : ''}

  ${chartMonths.length > 1 ? `<h2>Month by month${months.length > 24 ? ' · last 24' : ''}</h2>
  <table>
    <tr><th style="width:20%">Month</th><th class="num">In</th><th class="num">Out</th><th class="num">Net</th><th class="num" style="width:14%">Saved</th></tr>
    ${chartMonths.map(([k, m]) => `
    <tr><td>${ml(k)}</td><td class="num pos">+${fmt(m.inc)}</td><td class="num neg">−${fmt(m.out)}</td>
        <td class="num" style="font-weight:700;color:${m.inc - m.out >= 0 ? '#7d937a' : '#c98989'}">${m.inc - m.out >= 0 ? '+' : '−'}${fmt(Math.abs(m.inc - m.out))}</td>
        <td class="num muted">${m.inc > 0 ? Math.round(((m.inc - m.out) / m.inc) * 100) + '%' : '—'}</td></tr>`).join('')}
  </table>` : ''}

  ${topSpendCats.length > 0 ? `<h2>Where the money went</h2>
  <table>${topSpendCats.map(([name, amt]) => `
    <tr><td class="tname">${escapeHtml(name)}</td>
        <td><div class="bar" style="width:${Math.max(6, Math.round((amt / maxSpendCat) * 100))}%"></div></td>
        <td class="tamt">${fmt(amt)}</td>
        <td class="tpct">${spendExpense > 0 ? Math.round((amt / spendExpense) * 100) : 0}%</td></tr>`).join('')}
  </table>` : ''}

  ${catRows.length > 0 ? `<h2>Category deep dive</h2>
  <table>
    <tr><th style="width:26%">Category</th><th class="num">Total</th><th class="num" style="width:11%">Txns</th><th class="num">Avg</th><th style="width:28%">Top merchant</th></tr>
    ${catRows.map(c => `
    <tr><td>${escapeHtml(c.name)}</td><td class="num" style="font-weight:700">${fmt(c.total)}</td>
        <td class="num muted">${c.count}</td><td class="num muted">${fmt(c.avg)}</td>
        <td class="muted">${escapeHtml(c.topMerchant ? c.topMerchant[0] : '—')}</td></tr>`).join('')}
  </table>` : ''}

  ${merchantRows.length > 0 ? `<h2>Top merchants</h2>
  <table>
    <tr><th style="width:42%">Merchant</th><th class="num" style="width:12%">Txns</th><th class="num">Total</th><th class="num">Avg</th></tr>
    ${merchantRows.map(([name, m]) => `
    <tr><td>${escapeHtml(name)}</td><td class="num muted">${m.count}</td>
        <td class="num" style="font-weight:700">${fmt(m.total)}</td><td class="num muted">${fmt(m.total / m.count)}</td></tr>`).join('')}
  </table>` : ''}

  <h2>Spending behaviour</h2>
  <div class="grid">
    <div class="card"><div class="l">Avg / spending day</div><div class="v">${fmt(avgPerActiveDay)}</div></div>
    <div class="card"><div class="l">Days with spending</div><div class="v">${activeSpendDays}<span style="font-size:12px;color:#8E8D8A"> / ${spanDays}</span></div></div>
    <div class="card"><div class="l">No-spend days</div><div class="v pos">${noSpendDays}</div></div>
    ${peakDay ? `<div class="card"><div class="l">Heaviest day</div><div class="v neg">${fmt(peakDay[1])}</div><div class="l" style="margin-top:4px;text-transform:none;letter-spacing:0">${dl(peakDay[0])}</div></div>` : ''}
  </div>
  <table>${WD.map((d, i) => `
    <tr><td style="width:18%" class="muted">${d}</td>
        <td><div class="wbar" style="width:${Math.max(3, Math.round((weekdayAvg[i] / maxWd) * 100))}%"></div></td>
        <td class="num" style="width:26%">${fmt(weekdayAvg[i])}<span class="muted" style="font-weight:400">/day</span></td></tr>`).join('')}
  </table>

  ${dayEntries.length > 3 ? `<h2>Daily spending${dayEntries.length === 92 ? ' · last 92 days' : ''}</h2>
  <svg viewBox="0 0 100 100" preserveAspectRatio="none" style="width:100%;height:90px;display:block">${daySvgBars}</svg>
  <div class="chartnote">${escapeHtml(dayEntries[0][0])} → ${escapeHtml(dayEntries[dayEntries.length - 1][0])} · tallest bar ${fmt(maxDaySpend)}</div>` : ''}

  ${top5exp.length > 0 ? `<h2>Biggest movements</h2>
  <table>
    <tr><th>Largest expenses</th><th style="width:24%" class="muted">Date</th><th class="num" style="width:26%">Amount</th></tr>
    ${top5exp.map(t => `
    <tr><td>${escapeHtml(t.merchant || t.category)}</td><td class="muted">${dl(t.date)}</td>
        <td class="num neg" style="font-weight:700">−${fmt(t.amount)}</td></tr>`).join('')}
    ${top5inc.length > 0 ? `<tr><th>Largest credits</th><th></th><th></th></tr>
    ${top5inc.map(t => `
    <tr><td>${escapeHtml(t.merchant || t.category)}</td><td class="muted">${dl(t.date)}</td>
        <td class="num pos" style="font-weight:700">+${fmt(t.amount)}</td></tr>`).join('')}` : ''}
  </table>` : ''}

  ${recurring.length > 0 ? `<h2>Recurring charges</h2>
  <table>${recurring.map(r => `
    <tr><td class="rname">${escapeHtml(r.name)}</td><td class="rcad">${r.cadence.toLowerCase()}</td>
        <td class="ramt">${fmt(r.amount)}</td>
        <td class="rmo">≈ ${fmt(r.monthlyCost)}/mo</td></tr>`).join('')}
  </table>
  <div class="sub" style="margin-top:8px">These subscriptions project to <b>≈ ${fmt(recurringAnnual)}/year</b>.</div>` : ''}

  ${incomeAnalysis.streams.length > 0 ? `<h2>Income streams · 12-month view</h2>
  ${incomeAnalysis.stability ? `<div class="sub" style="margin-bottom:8px">Stability score <b>${incomeAnalysis.stability.score}/100</b> (${incomeAnalysis.stability.label}) · average ${fmt(incomeAnalysis.stability.avgMonthly)}/month</div>` : ''}
  <table>
    <tr><th style="width:34%">Source</th><th style="width:18%">Pattern</th><th class="num" style="width:10%">×</th><th class="num">Typical</th><th class="num">12-mo total</th></tr>
    ${incomeAnalysis.streams.slice(0, 8).map(s => `
    <tr><td>${escapeHtml(s.name)}</td><td class="muted">${BADGE[s.badge] || ''}</td>
        <td class="num muted">${s.occurrences}</td><td class="num">${fmt(s.typicalAmount)}</td>
        <td class="num pos" style="font-weight:700">${fmt(s.total12m)}</td></tr>`).join('')}
  </table>` : ''}

  <h2>Insights</h2>
  <p style="font-size:14px;line-height:1.7">${escapeHtml(insights.summary)}</p>
  <ul>
    ${insights.keyFindings.map(f => `<li>${escapeHtml(f)}</li>`).join('')}
    ${insights.recommendations.map(r => `<li>${escapeHtml(r)}</li>`).join('')}
  </ul>
  ${insights.anomalies.length > 0 ? `<h2>Unusual transactions</h2><ul>${insights.anomalies.map(a => `<li>${escapeHtml(a)}</li>`).join('')}</ul>` : ''}

  <div class="foot">Wall·ette · your mindful money companion · print this page to save as PDF</div>
</div></body></html>`;

      const outcome = await exportFile(`wall-ette-statement-${periodSlug}-${stamp}.html`, 'text/html;charset=utf-8;', html);
      showToast(outcome === 'shared' ? 'Share sheet opened — pick where to save' : 'Statement downloaded — open it, then print to PDF if needed');
    } catch (e) {
      log.warn('Statement export failed');
      showToast('Export failed — please try again');
    } finally {
      setBusy(null);
    }
  };

  const exportBackup = async () => {
    if (busy) return;
    setBusy('backup');
    try {
      const backup = {
        app: 'Wall-ette',
        version: 1,
        exportedAt: new Date().toISOString(),
        openingBalance,
        transactionCount: transactions.length,
        transactions,
      };
      const outcome = await exportFile(`wall-ette-backup-${stamp}.json`, 'application/json;charset=utf-8;', JSON.stringify(backup, null, 2));
      showToast(outcome === 'shared' ? 'Share sheet opened — pick where to save' : 'Backup downloaded');
    } catch (e) {
      log.warn('Backup export failed');
      showToast('Export failed — please try again');
    } finally {
      setBusy(null);
    }
  };

  // ── UI ─────────────────────────────────────────────────────────────────────

  const cards = [
    {
      id: 'statement',
      icon: 'description',
      iconCls: 'bg-sage-light text-sage',
      title: 'Statement Report',
      desc: 'Readable report: totals, categories, recurring charges, insights. Open anywhere, print to PDF.',
      meta: `${PERIOD_LABELS[period]} · HTML`,
      action: exportStatement,
    },
    {
      id: 'csv',
      icon: 'table_view',
      iconCls: 'bg-blue-zen-light text-blue-zen',
      title: 'Transactions Spreadsheet',
      desc: 'Every transaction in the period — opens in Excel and Google Sheets.',
      meta: `${PERIOD_LABELS[period]} · ${stats.count} rows · CSV`,
      action: exportCsv,
    },
    {
      id: 'backup',
      icon: 'cloud_download',
      iconCls: 'bg-sand-light text-sand',
      title: 'Full Backup',
      desc: 'Complete machine-readable copy of all data, including opening balance.',
      meta: `All time · ${transactions.length} transactions · JSON`,
      action: exportBackup,
    },
  ];

  return (
    <div className="relative flex min-h-screen w-full flex-col max-w-[430px] md:max-w-2xl mx-auto overflow-x-hidden pb-32 bg-zen-cream">
      {/* Eco & Indian decorative elements */}
      <FloatingLeaf className="top-24 right-6 opacity-40" delay={0.4} />
      <FloatingLeaf className="top-52 left-4 opacity-30" delay={1.6} color="#A8B89E" />
      <PottedPlant className="absolute bottom-40 right-6 opacity-40" />
      <RangoliCorner className="absolute top-20 left-2 opacity-20" color="#8B9E82" />
      <LotusFlower className="absolute bottom-52 left-8 opacity-35" size="sm" />
      <Diya className="absolute top-48 right-4 opacity-40" />

      <header className="flex items-center bg-zen-cream/90 backdrop-blur-md p-6 pt-8 pb-4 justify-between sticky top-0 z-30">
        <button
          onClick={() => onNavigate(AppScreen.DASHBOARD)}
          className="flex w-10 h-10 items-center justify-center text-zen-taupe hover:text-sage transition-colors"
        >
          <span className="material-symbols-outlined text-[28px]">chevron_left</span>
        </button>
        <h1 className="text-zen-charcoal text-2xl font-serif font-medium tracking-tight">Data Studio</h1>
        <div className="w-10"></div>
      </header>

      {/* Import / Export slider */}
      <div className="px-8 pt-2 pb-4">
        <div className="bg-white rounded-2xl p-1 flex shadow-sm border border-black/5">
          <button
            onClick={() => onNavigate(AppScreen.IMPORT)}
            className="flex-1 py-2.5 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 text-muted-taupe hover:text-premium-charcoal"
          >
            <span className="material-symbols-outlined text-[16px]">download</span>
            Import
          </button>
          <button
            className="flex-1 py-2.5 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 bg-sage/10 text-sage shadow-sm"
          >
            <span className="material-symbols-outlined text-[16px]">upload</span>
            Export
          </button>
        </div>
      </div>

      {/* Intro + mascot */}
      <div className="px-8 pb-6">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-sage to-sage/80 flex items-center justify-center shadow-md flex-shrink-0">
            <WallEEyes size="sm" />
          </div>
          <div className="flex-1">
            <h2 className="text-zen-charcoal font-serif text-2xl font-medium leading-tight mb-1">Mindful Archives</h2>
            <p className="text-zen-taupe text-[13px] leading-relaxed font-light">
              Reports save to your downloads on the web, and open the share sheet on Android.
            </p>
          </div>
        </div>
      </div>

      {/* Period selector */}
      <div className="px-8 pb-6">
        <h3 className="text-zen-taupe text-[11px] font-semibold uppercase tracking-[0.25em] mb-3 ml-1">Report Period</h3>
        <div className="bg-white rounded-2xl p-1 flex shadow-sm border border-black/5">
          {(Object.keys(PERIOD_LABELS) as Period[]).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`flex-1 py-2.5 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all ${
                period === p ? 'bg-sage/10 text-sage shadow-sm' : 'text-muted-taupe hover:text-premium-charcoal'
              }`}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>
        <p className="text-[10px] text-zen-taupe mt-2 ml-1">
          {stats.count} transactions · {fmt(stats.income)} in · {fmt(stats.expense)} out
        </p>
      </div>

      {/* Export cards */}
      <div className="px-8 space-y-4">
        {cards.map(card => (
          <button
            key={card.id}
            onClick={card.action}
            disabled={busy !== null || (card.id !== 'backup' && stats.count === 0)}
            className="w-full text-left bg-white rounded-3xl border border-black/[0.04] shadow-soft p-5 flex items-center gap-4 transition-all active:scale-[0.99] hover:border-sage/30 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${card.iconCls}`}>
              {busy === card.id
                ? <span className="size-5 rounded-full border-2 border-current border-t-transparent animate-spin inline-block" />
                : <span className="material-symbols-outlined text-2xl">{card.icon}</span>}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-serif text-[16px] font-semibold text-zen-charcoal">{card.title}</p>
              <p className="text-[11px] text-zen-taupe leading-relaxed mt-0.5">{card.desc}</p>
              <p className="text-[9px] text-sage font-bold uppercase tracking-wider mt-1.5">{card.meta}</p>
            </div>
            <span className="material-symbols-outlined text-muted-taupe text-[20px] shrink-0">arrow_forward</span>
          </button>
        ))}
        {stats.count === 0 && (
          <p className="text-center text-zen-taupe text-xs italic py-2">
            No transactions in {PERIOD_LABELS[period].toLowerCase()} — switch the period or import a statement first.
          </p>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-28 left-1/2 -translate-x-1/2 bg-premium-charcoal text-white text-xs font-medium px-5 py-3 rounded-full shadow-xl z-[100] animate-slide-up max-w-[90%] text-center">
          {toast}
        </div>
      )}
    </div>
  );
};

export default ExportReports;
