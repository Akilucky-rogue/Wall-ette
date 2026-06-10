import React, { useMemo, useState } from 'react';
import { AppScreen, Transaction, TransactionType } from '../types';
import { useWallet } from '../context/WalletContext';
import { analyzeFinancialHealth } from '../services/insightsService';
import { detectRecurringCharges } from '../services/analyticsService';
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
      const recurring = detectRecurringCharges(transactions).slice(0, 6);
      const maxCat = stats.topCategories[0]?.[1] || 1;
      const periodLabel = PERIOD_LABELS[period];
      const generated = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

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

  ${stats.topCategories.length > 0 ? `<h2>Where the money went</h2>
  <table>${stats.topCategories.map(([name, amt]) => `
    <tr><td class="tname">${escapeHtml(name)}</td>
        <td><div class="bar" style="width:${Math.max(6, Math.round((amt / maxCat) * 100))}%"></div></td>
        <td class="tamt">${fmt(amt)}</td>
        <td class="tpct">${stats.expense > 0 ? Math.round((amt / stats.expense) * 100) : 0}%</td></tr>`).join('')}
  </table>` : ''}

  ${recurring.length > 0 ? `<h2>Recurring charges</h2>
  <table>${recurring.map(r => `
    <tr><td class="rname">${escapeHtml(r.name)}</td><td class="rcad">${r.cadence.toLowerCase()}</td>
        <td class="ramt">${fmt(r.amount)}</td>
        <td class="rmo">≈ ${fmt(r.monthlyCost)}/mo</td></tr>`).join('')}
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
