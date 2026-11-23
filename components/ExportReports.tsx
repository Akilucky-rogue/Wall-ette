import React, { useMemo, useState } from 'react';
import { AppScreen, TransactionType } from '../types';
import { useWallet } from '../context/WalletContext';
import { localDay } from '../utils/dates';
import { exportFile } from '../utils/exportFile';
import { log } from '../utils/log';
import { buildStatementHtml, PERIOD_LABELS, transactionsCsv, type ReportPeriod } from '../services/statementReport';
import { WallEEyes, FloatingLeaf, PottedPlant, RangoliCorner, LotusFlower, Diya } from './SplashScreen';
import PageHeader from './ui/PageHeader';
import { Denim, DenimFigure, DenimLabel, Pocket } from './ui/Denim';
import { Card, IconChip, SectionTitle, Segmented } from './ui/Paper';

interface ExportReportsProps {
  onNavigate: (screen: AppScreen) => void;
}

type Period = ReportPeriod;

const ExportReports: React.FC<ExportReportsProps> = ({ onNavigate }) => {
  const { transactions, flowOf, openingBalance, formatWhole, formatAmountCompact, shownCurrency, budgets } = useWallet();
  const [period, setPeriod] = useState<Period>('MONTH');
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const isMoved = useMemo(() => (t: Parameters<typeof flowOf>[0]) => flowOf(t).flow === 'moved', [flowOf]);

  // The period's figures, the same ones the statement prints.
  const summary = useMemo(() => {
    const now = new Date();
    const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const start = period === 'MONTH' ? key(now) : period === 'QUARTER' ? key(new Date(now.getFullYear(), now.getMonth() - 2, 1)) : '';
    let entries = 0, cameIn = 0, spent = 0;
    for (const t of transactions) {
      if (start && t.date.slice(0, 7) < start) continue;
      entries++;
      if (isMoved(t)) continue;
      if (t.type === TransactionType.INCOME) cameIn += t.amount; else spent += t.amount;
    }
    return { entries, cameIn, spent };
  }, [transactions, isMoved, period]);

  const stamp = localDay();
  const periodSlug = period.toLowerCase();

  // ── Exporters ──────────────────────────────────────────────────────────────

  const exportCsv = async () => {
    if (busy) return;
    setBusy('csv');
    try {
      const { csv } = transactionsCsv(transactions, isMoved, period);
      const outcome = await exportFile(`wall-ette-transactions-${periodSlug}-${stamp}.csv`, 'text/csv;charset=utf-8;', csv);
      showToast(outcome === 'shared' ? 'Share sheet opened — pick where to save' : 'Spreadsheet downloaded');
    } catch {
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
      const { html } = buildStatementHtml({
        transactions, isMoved, period, money: formatWhole, currency: shownCurrency, openingBalance, budgets,
      });
      const outcome = await exportFile(`wall-ette-statement-${periodSlug}-${stamp}.html`, 'text/html;charset=utf-8;', html);
      showToast(outcome === 'shared' ? 'Share sheet opened — pick where to save' : 'Statement downloaded — open it, then print to PDF if needed');
    } catch {
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
      title: 'Statement report',
      desc: 'Money in and out, where it went, recurring charges and what stands out, worked out like Pulse. Opens anywhere; print it to save a PDF.',
      meta: `${PERIOD_LABELS[period]} · HTML`,
      action: exportStatement,
      needsEntries: true,
    },
    {
      id: 'csv',
      icon: 'table_view',
      iconCls: 'bg-blue-zen-light text-blue-zen',
      title: 'Transactions spreadsheet',
      desc: 'Every entry in the period with its date, payee, category, rupee amount and whether it counts as spending, income or money moved.',
      meta: `${PERIOD_LABELS[period]} · ${summary.entries} rows · CSV`,
      action: exportCsv,
      needsEntries: true,
    },
    {
      id: 'backup',
      icon: 'cloud_download',
      iconCls: 'bg-sand-light text-sand-ink',
      title: 'Full backup',
      desc: 'A complete copy of everything, including your opening balance, that Wall-ette can read back.',
      meta: `All time · ${transactions.length} entries · JSON`,
      action: exportBackup,
      needsEntries: false,
    },
  ];

  return (
    <div className="relative flex min-h-screen w-full flex-col max-w-[430px] lg:max-w-5xl mx-auto overflow-x-hidden pb-32 lg:pb-12 bg-zen-bg">
      {/* Eco & Indian decorative elements */}
      <FloatingLeaf className="top-24 right-6 opacity-40" delay={0.4} />
      <FloatingLeaf className="top-52 left-4 opacity-30" delay={1.6} color="#A8B89E" />
      <PottedPlant className="absolute bottom-40 right-6 opacity-40" />
      <RangoliCorner className="absolute top-20 left-2 opacity-20" color="#8B9E82" />
      <LotusFlower className="absolute bottom-52 left-8 opacity-35" size="sm" />
      <Diya className="absolute top-48 right-4 opacity-40" />

      <PageHeader title="Data Studio" onBack={() => onNavigate(AppScreen.DASHBOARD)} backLabel="Back to Home" />

      <div className="px-5 lg:px-8 pt-1 grid grid-cols-1 gap-4 lg:grid-cols-12 lg:items-start">
        <div className="space-y-4 lg:col-span-5">
          {/* Import / Export */}
          <div className="bg-premium-charcoal/[0.06] shadow-pressed rounded-2xl p-1 flex" role="group" aria-label="Import or export">
            <button
              onClick={() => onNavigate(AppScreen.IMPORT)}
              className="flex-1 py-2.5 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 text-muted-taupe hover:text-premium-charcoal"
            >
              <span className="material-symbols-outlined text-[16px]" aria-hidden="true">download</span>
              Import
            </button>
            <button
              aria-pressed="true"
              className="flex-1 py-2.5 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 bg-white shadow-soft text-premium-charcoal"
            >
              <span className="material-symbols-outlined icon-fill text-sage text-[16px]" aria-hidden="true">upload</span>
              Export
            </button>
          </div>

          {/* The period's figures, on the wallet */}
          <Denim aria-label={`${PERIOD_LABELS[period]} in figures`}>
            <div className="flex items-center justify-between gap-3">
              <DenimLabel className="tracking-wide">{PERIOD_LABELS[period]}</DenimLabel>
              <span className="w-9 h-9 rounded-full bg-black/15 flex items-center justify-center shrink-0"><WallEEyes size="sm" /></span>
            </div>
            <DenimFigure className="mt-3">{summary.entries.toLocaleString('en-IN')} <span className="text-[22px]">{summary.entries === 1 ? 'entry' : 'entries'}</span></DenimFigure>
            <div className="grid grid-cols-2 gap-2.5 mt-4">
              <Pocket label="Came in" icon="south_west" value={`+${formatAmountCompact(summary.cameIn)}`} note="income" />
              <Pocket label="Spent" icon="north_east" value={`−${formatAmountCompact(summary.spent)}`} note="money moved left out" />
            </div>
          </Denim>

          <Segmented
            label="Report period"
            value={period}
            onChange={setPeriod}
            options={(Object.keys(PERIOD_LABELS) as Period[]).map(p => ({ value: p, label: PERIOD_LABELS[p] }))}
          />
        </div>

        <div className="space-y-4 lg:col-span-7">
          <Card flush>
            <div className="px-5 pt-5">
              <SectionTitle>Reports and backups</SectionTitle>
            </div>
            <ul className="divide-y divide-premium-charcoal/[0.06]">
              {cards.map(card => (
                <li key={card.id}>
                  <button
                    onClick={card.action}
                    disabled={busy !== null || (card.needsEntries && summary.entries === 0)}
                    className="w-full text-left px-5 py-4 flex items-center gap-4 transition-colors hover:bg-zen-cream/60 active:bg-zen-cream disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${card.iconCls}`}>
                      {busy === card.id
                        ? <span className="size-5 rounded-full border-2 border-current border-t-transparent animate-spin inline-block" aria-label="Working" />
                        : <span className="material-symbols-outlined icon-fill text-[24px]" aria-hidden="true">{card.icon}</span>}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block font-serif text-[17px] font-semibold text-premium-charcoal">{card.title}</span>
                      <span className="block text-[12px] text-muted-taupe leading-relaxed mt-0.5">{card.desc}</span>
                      <span className="block text-[10px] text-sage font-bold uppercase tracking-wider mt-1.5">{card.meta}</span>
                    </span>
                    <span className="material-symbols-outlined text-muted-taupe/60 text-[20px] shrink-0" aria-hidden="true">chevron_right</span>
                  </button>
                </li>
              ))}
            </ul>
          </Card>
          {summary.entries === 0 && (
            <p className="text-center text-muted-taupe text-[12px] py-1">
              No entries in {PERIOD_LABELS[period].toLowerCase()}. Pick another period or import a statement first.
            </p>
          )}
          <p className="text-[11px] text-muted-taupe leading-relaxed px-1">
            On the web, files save to your downloads; on Android, the share sheet opens so you can pick where they go. Amounts in the statement are shown in {shownCurrency}{shownCurrency !== 'INR' ? " at today's rate" : ''}; the spreadsheet and backup keep the rupees exactly as saved.
          </p>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div role="status" className="fixed bottom-[calc(7rem_+_var(--sab))] left-1/2 -translate-x-1/2 bg-premium-charcoal text-white text-xs font-medium px-5 py-3 rounded-full shadow-float z-[100] animate-slide-up max-w-[90%] text-center">
          {toast}
        </div>
      )}
    </div>
  );
};

export default ExportReports;
