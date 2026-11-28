import React, { useEffect, useMemo, useState } from 'react';
import { AppScreen, TransactionType } from '../types';
import { useWallet } from '../context/WalletContext';
import { byNewest, localDay, parseDay } from '../utils/dates';
import { prettyMerchant } from '../services/analyticsService';
import { paymentRail } from '../utils/names';
import { openAt } from '../utils/screenSection';
import { tick } from '../utils/haptics';
import CurrencySelector from './CurrencySelector';
import UnsortedTransfers from './UnsortedTransfers';
import PaymentsToCheckCard from './PaymentsToCheckCard';
import NotificationCenter from './NotificationCenter';
import LeftToSpendCard from './LeftToSpendCard';
import WalletArriving from './WalletArriving';
import { markTiming } from '../utils/timing';
import { BrandIcon, Mascot, Wordmark } from './ui/Brand';
import styles from './Dashboard.module.css';

interface DashboardProps {
  onNavigate: (screen: AppScreen) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const {
    getDailyIncome, getDailyExpense, transactions, counted, flowOf, formatAmount, formatWhole, formatEntry,
    formatAmountCompact, isCloudSyncing, isOnline, refresh, openingBalance, budgets, walletLoaded,
  } = useWallet();

  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = () => {
    if (refreshing) return;
    setRefreshing(true);
    refresh();
    setTimeout(() => setRefreshing(false), 900);
  };

  // Lifetime hook for Rewind.
  // Sorted desc — the last element is the earliest transaction.
  const sinceYear = transactions.length > 0
    ? parseDay(transactions[transactions.length - 1].date).getFullYear()
    : null;
  const [periodMode, setPeriodMode] = useState<'MONTH' | 'ALL'>('MONTH'); // 'MONTH' or 'ALL'
  const [selectedDate, setSelectedDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  // Helper: today's month start
  const currentMonthStart = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }, []);

  // --- Period figures (single pass) ---
  // The balance counts every transaction. Income and expenses count only
  // real income and spending: money moved to your own accounts, family or
  // investments is left out (audit H3), so the savings rate means something.
  const { income, expenses, credits, payments, balance, periodLabel } = useMemo(() => {
    const all = periodMode === 'ALL';
    const month = selectedDate.getMonth();
    const year = selectedDate.getFullYear();
    const monthStart = new Date(year, month, 1);

    let net = 0;              // every transaction up to the end of the period
    let periodIncome = 0;
    let periodExpenses = 0;
    let credits = 0;
    let payments = 0;

    for (const t of transactions) {
      const txDate = parseDay(t.date);
      const inPeriod = all || (txDate.getMonth() === month && txDate.getFullYear() === year);
      if (!inPeriod && txDate >= monthStart) continue; // after the selected month
      const isIncome = t.type === TransactionType.INCOME;
      net += isIncome ? t.amount : -t.amount;
      if (inPeriod && flowOf(t).flow !== 'moved') {
        if (isIncome) { periodIncome += t.amount; credits++; }
        else { periodExpenses += t.amount; payments++; }
      }
    }

    return {
      income: periodIncome,
      expenses: periodExpenses,
      credits,
      payments,
      balance: openingBalance + net,
      periodLabel: all ? 'All Time' : `${selectedDate.toLocaleString('default', { month: 'short' })} ${year}`,
    };
  }, [transactions, flowOf, openingBalance, periodMode, selectedDate]);

  // Today's figures belong under the cards only while they show this month.
  const showingThisMonth = periodMode === 'MONTH' && selectedDate.getTime() === currentMonthStart.getTime();

  // "24 Nov", with the year when it isn't this one.
  const dayText = (d: Date) => d.toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', ...(d.getFullYear() === new Date().getFullYear() ? {} : { year: 'numeric' }),
  });
  // What the big figure is: the balance the entries add up to (opening
  // balance included), now, or at the end of an earlier month picked below.
  // With no entries at all, the figure is only the opening balance (a
  // statement's, kept after its entries went, or a restored one): say so,
  // rather than call it a balance "from your entries" (1.6.1).
  const balanceLabel = transactions.length === 0 && openingBalance !== 0
    ? 'Opening balance'
    : periodMode === 'ALL' || showingThisMonth
      ? 'Balance from your entries'
      : `Balance on ${dayText(new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0))}`;
  // How far the entries reach: the wallet holds what was imported or added,
  // it isn't a live bank feed.
  const dataThrough = useMemo(() => {
    let newest = '';
    for (const t of transactions) if (t.date > newest) newest = t.date;
    return newest ? parseDay(newest.slice(0, 10)) : null;
  }, [transactions]);
  const status = refreshing ? 'Refreshing…'
    : isCloudSyncing ? 'Saved to your account'
    : isOnline ? "Can't reach your account · Retry"
    : 'Offline · saved on this device';
  // Still on its way from the cloud (signed in on this device for the first
  // time, or after signing out): say so, rather than show an empty wallet.
  const arriving = !walletLoaded && transactions.length === 0;
  useEffect(() => { if (walletLoaded) markTiming('wallet:shown', 'signin:done'); }, [walletLoaded]);
  // A wallet with nothing in it yet opens on what to do first.
  const isNewWallet = !arriving && transactions.length === 0 && openingBalance === 0;
  const openRestore = () => { openAt('restore'); onNavigate(AppScreen.EXPORT); };
  const monthLong = selectedDate.toLocaleString('en-GB', { month: 'long' });

  // --- Budgets: this calendar month's spending against each category's budget ---
  const budgetRows = useMemo(() => {
    const month = localDay().slice(0, 7);
    const spent = new Map<string, number>();
    for (const t of counted) {
      if (t.type !== TransactionType.EXPENSE || !t.date.startsWith(month)) continue;
      spent.set(t.category, (spent.get(t.category) ?? 0) + t.amount);
    }
    return Object.entries(budgets)
      .filter(([, budget]) => budget > 0)
      .map(([category, budget]) => ({ category, budget, used: spent.get(category) ?? 0 }))
      .sort((a, b) => b.used / b.budget - a.used / a.budget);
  }, [counted, budgets]);
  const openGoals = () => { openAt('goals'); onNavigate(AppScreen.INCOME_INSIGHTS); };

  // --- Savings Rate ---
  const savingsRate = useMemo(() => {
    if (income === 0) return 0;
    return Math.max(0, Math.round(((income - expenses) / income) * 100));
  }, [income, expenses]);
  // More went out than came in: said as that, never as "Kept 0%". Something
  // kept that rounds to 0% reads "<1%".
  const overspent = income > 0 && expenses > income;
  const keptLabel = income > expenses && savingsRate === 0 ? '<1' : String(savingsRate);

  // --- Top Spend for the period: spending only (audit M7 — it used to add
  // up income too, so Transfer In topped the card) ---
  const categoryBreakdown = useMemo(() => {
    const all = periodMode === 'ALL';
    const month = selectedDate.getMonth();
    const year = selectedDate.getFullYear();

    const cats: Record<string, number> = {};
    for (const t of counted) {
      if (t.type !== TransactionType.EXPENSE) continue;
      if (!all) {
        const txDate = parseDay(t.date);
        if (txDate.getMonth() !== month || txDate.getFullYear() !== year) continue;
      }
      cats[t.category] = (cats[t.category] || 0) + t.amount;
    }

    return Object.entries(cats)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([name, amount]) => ({ name, amount }));
  }, [counted, periodMode, selectedDate]);

  // Derived helpers for UI logic
  const showAllTime = periodMode === 'ALL';

  // Recent transactions (latest 5)
  const recentTransactions = useMemo(() => {
    return [...transactions]
      .sort(byNewest)
      .slice(0, 5);
  }, [transactions]);


  // Category colors (using CSS module classes to avoid Tailwind purge issues)
  const CAT_COLORS = ['var(--sage)', 'var(--rose)', 'var(--amber)', 'var(--sage-3)', '#94BFCA'] as const;

  // Icons helper
  const getIconForCategory = (cat: string) => {
    const lower = cat.toLowerCase();
    if(lower.includes('salary')) return 'business_center';
    if(lower.includes('freelance')) return 'brush';
    if(lower.includes('invest') || lower.includes('stak')) return 'token';
    return 'payments';
  };

  const quickServices = (
    <>
          <h3 className="text-premium-charcoal text-[15px] font-display font-bold tracking-tight mb-5">Quick services</h3>
          <div className="grid grid-cols-3 gap-4">
            <button
              onClick={() => onNavigate(AppScreen.NEW_ENTRY)}
              className="flex flex-col items-center gap-3 bg-white p-4 rounded-3xl border border-black/[0.02] shadow-soft active:scale-95 transition-transform"
            >
              <div className="bg-sage-light text-sage p-3 rounded-2xl">
                <span className="material-symbols-outlined">add_box</span>
              </div>
              <span className="text-[11px] font-semibold text-muted-taupe uppercase tracking-tighter">Add</span>
            </button>
            <button
              onClick={() => onNavigate(AppScreen.EXPORT)}
              className="flex flex-col items-center gap-3 bg-white p-4 rounded-3xl border border-black/[0.02] shadow-soft active:scale-95 transition-transform"
            >
              <div className="bg-rose-light text-rose p-3 rounded-2xl">
                <span className="material-symbols-outlined">description</span>
              </div>
              <span className="text-[11px] font-semibold text-muted-taupe uppercase tracking-tighter">Report</span>
            </button>
            <button
              onClick={() => onNavigate(AppScreen.INCOME_INSIGHTS)}
              className="flex flex-col items-center gap-3 bg-white p-4 rounded-3xl border border-black/[0.02] shadow-soft active:scale-95 transition-transform"
            >
              <div className="bg-blue-zen-light text-blue-zen p-3 rounded-2xl">
                <span className="material-symbols-outlined">bubble_chart</span>
              </div>
              <span className="text-[11px] font-semibold text-muted-taupe uppercase tracking-tighter">Flow</span>
            </button>
            <button
              onClick={() => onNavigate(AppScreen.IMPORT)}
              className="flex flex-col items-center gap-3 bg-white p-4 rounded-3xl border border-black/[0.02] shadow-soft active:scale-95 transition-transform"
            >
              <div className="bg-sand-light text-sand p-3 rounded-2xl">
                <span className="material-symbols-outlined">upload_file</span>
              </div>
              <span className="text-[11px] font-semibold text-muted-taupe uppercase tracking-tighter">Import</span>
            </button>
            <button
              onClick={() => onNavigate(AppScreen.REWIND)}
              className="flex flex-col items-center gap-3 bg-white p-4 rounded-3xl border border-black/[0.02] shadow-soft active:scale-95 transition-transform"
            >
              <div className="bg-lavender/10 text-lavender p-3 rounded-2xl">
                <span className="material-symbols-outlined">history</span>
              </div>
              <span className="text-[11px] font-semibold text-muted-taupe uppercase tracking-tighter">Rewind</span>
            </button>
            <button
              onClick={() => onNavigate(AppScreen.LEFT_TO_SPEND)}
              className="flex flex-col items-center gap-3 bg-white p-4 rounded-3xl border border-black/[0.02] shadow-soft active:scale-95 transition-transform"
            >
              <div className="bg-ocean-light text-ocean p-3 rounded-2xl">
                <span className="material-symbols-outlined">account_balance_wallet</span>
              </div>
              <span className="text-[11px] font-semibold text-muted-taupe uppercase tracking-tighter text-center leading-tight">Left to spend</span>
            </button>
          </div>
    </>
  );

  const startPanel = (
    <section className="px-5 pt-3 pb-2 lg:px-0 lg:col-span-7" aria-labelledby="start-title">
      <div className="bg-white rounded-[30px] p-6 shadow-raised border border-black/[0.02]">
        <div className="flex items-end justify-between gap-3">
          <h1 id="start-title" className="font-display text-[24px] leading-tight font-bold text-premium-charcoal pb-2">Start your wallet</h1>
          <Mascot pose="welcome" height={88} className="-mt-2 -mr-1" />
        </div>
        <p className="text-[13px] text-muted-taupe leading-relaxed mt-2 max-w-[52ch]">
          Import a bank statement to bring in months of entries at once, or add one by hand. Statements are processed on this device and checked against the bank's balance before anything is saved.
        </p>
        {openingBalance !== 0 && (
          <p className="text-[13px] text-premium-charcoal leading-relaxed mt-3 bg-sage-light/50 rounded-2xl px-4 py-3">
            The {formatWhole(openingBalance)} above is an opening balance: there are no entries yet. Entries you import or add start from it.{' '}
            <button onClick={() => onNavigate(AppScreen.BANK_ACCOUNTS)} className="font-semibold text-sage hover:underline underline-offset-2">
              See which account it's from
            </button>
          </p>
        )}
        <div className="flex flex-col sm:flex-row gap-2.5 mt-5">
          <button
            onClick={() => onNavigate(AppScreen.IMPORT)}
            className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full bg-sage text-white text-[14px] font-semibold shadow-soft active:scale-[0.98] transition-transform"
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">upload_file</span>
            Import a statement
          </button>
          <button
            onClick={() => onNavigate(AppScreen.NEW_ENTRY)}
            className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full bg-white border border-sage/30 text-sage text-[14px] font-semibold shadow-soft active:scale-[0.98] transition-transform"
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">add</span>
            Add an entry
          </button>
        </div>
        <button onClick={openRestore} className="mt-4 text-[12px] text-muted-taupe hover:text-sage hover:underline underline-offset-2">
          Have a Wall-ette backup? Restore it in Data Studio
        </button>
      </div>
    </section>
  );

  return (
    <div className="relative flex min-h-screen w-full flex-col max-w-[430px] md:max-w-3xl lg:max-w-6xl mx-auto overflow-x-hidden pb-24 lg:pb-12 bg-zen-bg">
      {/* Header */}
      <div className="flex items-center bg-zen-bg/80 backdrop-blur-md p-6 lg:px-8 pb-2 sticky top-0 z-30">
        {/* Left: Logo and Name */}
        <div className="flex items-center gap-3 min-w-0">
          <BrandIcon size={36} />
          <Wordmark height={17} />
        </div>
        {/* Right: currency and the notification bell */}
        <div className="relative flex items-center ml-auto min-w-0 gap-2">
          <CurrencySelector />
          <NotificationCenter onNavigate={onNavigate} />
        </div>
      </div>

      {/* The wallet: the balance for the period picked, with what came in and
          went out in its two pockets (styles.css .wallet) */}
      <div className="lg:grid lg:grid-cols-12 lg:gap-6 lg:px-8 lg:items-start">
      {arriving ? (
        <section className="px-5 pt-3 pb-2 lg:px-0 lg:col-span-7" aria-label="Your wallet">
          <div className="bg-white rounded-[30px] px-6 py-8 shadow-raised border border-black/[0.02]">
            <WalletArriving isOnline={isOnline} />
          </div>
        </section>
      ) : isNewWallet ? startPanel : (
      <section className="px-5 pt-3 pb-2 lg:px-0 lg:col-span-7" aria-label="Balance">
        <div className="wallet rounded-[30px] px-6 pt-6 pb-5 shadow-raised overflow-hidden">
          <p className="relative text-[12px] font-medium tracking-wide" style={{ color: 'var(--wallet-mut)' }}>{balanceLabel}</p>

          <h1 className="relative wallet-emboss font-sans font-semibold text-[40px] leading-none tabular-nums mt-3 truncate">
            {formatWhole(balance)}
          </h1>

          {/* Saved to the account (tap to refresh), and how far the entries reach */}
          <div className="relative flex flex-wrap items-center gap-x-1.5 mt-3 text-[11px] font-medium" style={{ color: 'var(--wallet-mut)' }}>
            <button
              onClick={handleRefresh}
              className="inline-flex items-center gap-1.5 -ml-1 px-1 py-1 rounded-full hover:bg-black/10 transition-colors"
              title="Refresh"
            >
              <span
                aria-hidden="true"
                className={`w-1.5 h-1.5 rounded-full ${refreshing ? 'motion-safe:animate-pulse' : ''}`}
                style={{ background: refreshing || isCloudSyncing ? '#BFE3AE' : isOnline ? '#F2B8B5' : 'var(--wallet-mut)' }}
              />
              {status}
            </button>
            {dataThrough && (
              <span className="tabular-nums"><span aria-hidden="true" className="mr-1.5">·</span>Data through {dayText(dataThrough)}</span>
            )}
          </div>

          {/* The period the two pockets below cover */}
          <div className="relative flex items-center justify-between gap-2 mt-4 min-h-[30px]">
            <div className="flex items-center rounded-full bg-black/20 shadow-pressed p-0.5 text-[11px] font-semibold" role="group" aria-label="Income and spending for">
              {(['MONTH', 'ALL'] as const).map(mode => (
                <button
                  key={mode}
                  onClick={() => {
                    if (mode !== periodMode) tick();
                    setPeriodMode(mode);
                    if (mode === 'MONTH') setSelectedDate(currentMonthStart);
                  }}
                  aria-pressed={periodMode === mode}
                  className={`px-3 py-1 rounded-full transition-all ${periodMode === mode ? 'shadow-sm' : 'opacity-80 hover:opacity-100'}`}
                  style={periodMode === mode ? { background: 'var(--wallet-ink)', color: 'var(--wallet-2)' } : undefined}
                >
                  {mode === 'MONTH' ? 'Month' : 'All time'}
                </button>
              ))}
            </div>
            {periodMode === 'MONTH' && (
              <div className="flex items-center text-[12px] font-semibold">
                <button
                  className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-black/10"
                  onClick={() => setSelectedDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                  aria-label="Previous month"
                >
                  <span className="material-symbols-outlined text-[18px]" aria-hidden="true">chevron_left</span>
                </button>
                <span className="px-1 select-none tabular-nums">{periodLabel}</span>
                <button
                  className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-black/10 disabled:opacity-30"
                  onClick={() => setSelectedDate(prev => {
                    const next = new Date(prev.getFullYear(), prev.getMonth() + 1, 1);
                    return next > currentMonthStart ? prev : next;
                  })}
                  disabled={showingThisMonth}
                  aria-label="Next month"
                >
                  <span className="material-symbols-outlined text-[18px]" aria-hidden="true">chevron_right</span>
                </button>
              </div>
            )}
          </div>

          <div className="relative grid grid-cols-2 gap-2.5 mt-2.5">
            {([
              { label: 'Income', amount: income, sign: '+', icon: 'south_west', today: getDailyIncome(), count: credits, noun: 'credit' },
              { label: 'Spending', amount: expenses, sign: '−', icon: 'north_east', today: getDailyExpense(), count: payments, noun: 'payment' },
            ] as const).map(pocket => (
              <div key={pocket.label} className="wallet-pocket rounded-2xl px-3.5 py-3 min-w-0">
                <p className="flex items-center gap-1 text-[11px] font-medium" style={{ color: 'var(--wallet-mut)' }}>
                  <span className="material-symbols-outlined text-[14px]" aria-hidden="true">{pocket.icon}</span>
                  {pocket.label}
                </p>
                <p className="font-semibold text-[22px] leading-tight tabular-nums mt-1 truncate">
                  {pocket.sign}{formatAmountCompact(pocket.amount)}
                </p>
                <p className="text-[11px] tabular-nums truncate mt-0.5" style={{ color: 'var(--wallet-mut)' }}>
                  {showingThisMonth
                    ? `Today ${pocket.sign}${formatAmountCompact(pocket.today)}`
                    : `${pocket.count.toLocaleString('en-IN')} ${pocket.noun}${pocket.count === 1 ? '' : 's'}`}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
      )}
      <div className="hidden lg:block lg:col-span-5 lg:pt-3">
        {quickServices}
      </div>
      </div>

      {/* Wider screens: cards flow into two columns, three on desktops;
          phones/APK keep the single column (CSS columns are inert below md). */}
      <div className="md:columns-2 md:gap-x-0 lg:columns-3 lg:px-2">
      {transactions.length === 0 && !isNewWallet && !arriving && <div className="break-inside-avoid">{startPanel}</div>}

      {/* Payments read from your apps that wait for a tap (Android): first, as they need you */}
      <PaymentsToCheckCard className="px-6 pt-2 break-inside-avoid" />

      {/* What's left until pay day, once something has come in */}
      <LeftToSpendCard onNavigate={onNavigate} className="px-6 pt-2 break-inside-avoid" />

      {/* Budgets this month (set in Flow → Goals) */}
      {arriving ? null : budgetRows.length > 0 ? (
        <div className="px-6 pt-2 break-inside-avoid">
          <div className="bg-white rounded-3xl p-5 shadow-soft border border-black/[0.02]">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] uppercase tracking-widest text-muted-taupe font-bold">
                Budgets · {new Date().toLocaleString('en-GB', { month: 'long' })}
              </p>
              <button onClick={openGoals} className="text-[10px] text-sage font-semibold uppercase tracking-wider hover:underline">Edit</button>
            </div>
            <div className="space-y-3">
              {budgetRows.slice(0, 4).map(r => {
                const pct = r.used / r.budget;
                const over = r.used > r.budget;
                return (
                  <button key={r.category} onClick={openGoals} className="block w-full text-left">
                    <span className="flex items-baseline justify-between gap-2 text-[12px]">
                      <span className="font-semibold text-premium-charcoal truncate">{r.category}</span>
                      <span className={`tabular-nums shrink-0 ${over ? 'text-rose font-semibold' : 'text-muted-taupe'}`}>
                        {over
                          ? `${formatAmountCompact(r.used - r.budget)} over`
                          : `${formatAmountCompact(r.used)} of ${formatAmountCompact(r.budget)}`}
                      </span>
                    </span>
                    <span className="mt-1.5 block h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <span
                        className={`block h-full rounded-full ${over ? 'bg-rose' : pct >= 0.8 ? 'bg-sand' : 'bg-sage'}`}
                        style={{ width: `${Math.min(100, Math.round(pct * 100))}%` }}
                      />
                    </span>
                  </button>
                );
              })}
            </div>
            {budgetRows.length > 4 && (
              <button onClick={openGoals} className="mt-3 text-[11px] text-muted-taupe hover:text-sage">
                {budgetRows.length - 4} more in Flow
              </button>
            )}
          </div>
        </div>
      ) : transactions.length > 0 && (
        <div className="px-6 pt-2 break-inside-avoid">
          <button
            onClick={openGoals}
            className="w-full flex items-center gap-3 rounded-2xl border border-dashed border-sage/30 px-4 py-3 text-left hover:bg-white/60 transition-colors"
          >
            <span className="material-symbols-outlined text-sage text-[20px] shrink-0" aria-hidden="true">donut_large</span>
            <span className="flex-1 min-w-0 text-[12px] text-muted-taupe leading-snug">Set monthly budgets, and see how each category is doing here.</span>
            <span className="material-symbols-outlined text-muted-taupe text-[18px] shrink-0" aria-hidden="true">chevron_right</span>
          </button>
        </div>
      )}
      {/* Transfers to unsorted payees count as spending until sorted (audit H3) */}
      <UnsortedTransfers onNavigate={onNavigate} className="px-6 pt-2 break-inside-avoid" />
      {/* Rewind: the whole history, once there's enough of it */}
      {sinceYear !== null && transactions.length > 50 && (
        <div className="px-6 pt-2 pb-1 break-inside-avoid">
          <button
            onClick={() => onNavigate(AppScreen.REWIND)}
            className="w-full bg-white rounded-3xl p-4 shadow-soft border border-black/[0.02] flex items-center gap-3 text-left"
          >
            <div className="w-10 h-10 rounded-2xl bg-sage-light text-sage flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined icon-fill text-[20px]" aria-hidden="true">history</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-premium-charcoal text-[13px] font-semibold">Your money since {sinceYear}</p>
              <p className="text-muted-taupe text-[11px] truncate">{transactions.length.toLocaleString('en-IN')} entries · all-time records · Wrapped</p>
            </div>
            <span className="material-symbols-outlined text-muted-taupe/50 text-[18px] shrink-0" aria-hidden="true">chevron_right</span>
          </button>
        </div>
      )}
      {/* Quick services (on wide screens they sit beside the wallet instead) */}
      <div className="px-6 py-8 break-inside-avoid lg:hidden">
        {quickServices}
      </div>
      {/* Savings Rate + Category Breakdown */}
      {(income > 0 || categoryBreakdown.length > 0) && (
        <div className="px-6 py-2 mb-2 grid grid-cols-2 gap-4 break-inside-avoid">
          {/* Savings Rate */}
          {income > 0 && (
            <div className="bg-white rounded-3xl p-5 shadow-soft border border-black/[0.02] flex flex-col items-center gap-3">
              <p className="text-[10px] uppercase tracking-widest text-muted-taupe font-bold self-start">{overspent ? 'More out than in' : showingThisMonth ? 'Kept so far' : 'Kept'}</p>
              <svg viewBox="0 0 36 36" className="w-16 h-16 -rotate-90">
                <circle cx="18" cy="18" r="14" fill="none" stroke="var(--sage-soft)" strokeWidth="4" />
                <circle
                  cx="18" cy="18" r="14" fill="none" stroke={overspent ? 'var(--rose)' : 'var(--sage)'} strokeWidth="4"
                  strokeDasharray={`${overspent ? 88 : (savingsRate / 100) * 88} 88`}
                  strokeLinecap="round"
                  className={styles.savingsGauge}
                />
              </svg>
              {overspent
                ? <p className="text-rose text-xl font-semibold -mt-2 tabular-nums">{formatAmountCompact(expenses - income)}</p>
                : <p className="text-premium-charcoal text-xl font-semibold -mt-2 tabular-nums">{keptLabel}%</p>}
              <p className="text-[10px] text-muted-taupe text-center leading-snug">
                {overspent
                  ? (showingThisMonth ? 'more spent than came in so far' : 'more spent than came in')
                  : showingThisMonth ? "of this month's income" : showAllTime ? 'of all income' : `of ${monthLong}'s income`}
              </p>
            </div>
          )}
          {/* Top Categories */}
          {categoryBreakdown.length > 0 && (
            <div className="bg-white rounded-3xl p-5 shadow-soft border border-black/[0.02]">
              <p className="text-[10px] uppercase tracking-widest text-muted-taupe font-bold mb-3">Top Spend</p>
              <div className="space-y-2">
                {categoryBreakdown.slice(0, income > 0 ? 3 : 5).map((cat, i) => (
                  <div key={cat.name} className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: CAT_COLORS[i % CAT_COLORS.length] }} />
                    <span className="text-[11px] text-premium-charcoal font-medium flex-1 truncate" title={cat.name}>{cat.name}</span>
                    <span className="text-[10px] text-muted-taupe flex-shrink-0 tabular-nums">{formatAmountCompact(cat.amount as number)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Recent Transactions */}
      {recentTransactions.length > 0 && (
        <div className="px-6 py-2 mb-2 break-inside-avoid">
          <div className="bg-white rounded-3xl p-5 shadow-soft border border-black/[0.02]">
            <div className="flex items-center justify-between mb-4">
              <p className="text-[10px] uppercase tracking-widest text-muted-taupe font-bold">Recent</p>
              <button
                onClick={() => onNavigate(AppScreen.HISTORY)}
                className="text-[10px] text-sage font-semibold uppercase tracking-wider hover:underline"
              >
                View all
              </button>
            </div>
            <div className="space-y-3">
              {recentTransactions.map(tx => (
                <div key={tx.id} className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${tx.type === TransactionType.INCOME ? 'bg-sage-light text-sage' : 'bg-rose-light text-rose'}`}>
                    <span className="material-symbols-outlined text-[15px]">
                      {tx.type === TransactionType.INCOME ? 'arrow_upward' : 'arrow_downward'}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-premium-charcoal truncate" title={tx.merchant || undefined}>
                      {tx.merchant ? prettyMerchant(tx.merchant) : tx.category}
                    </p>
                    <p className="text-[10px] text-muted-taupe truncate">
                      {[paymentRail(tx.merchant), tx.category, parseDay(tx.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <span className={`text-[13px] font-bold flex-shrink-0 ${tx.type === TransactionType.INCOME ? 'text-sage' : 'text-rose'}`}>
                    {tx.type === TransactionType.INCOME ? '+' : '-'}{formatEntry(tx, true)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      </div>{/* /md:columns-2 */}
    </div>
  );
};

export default Dashboard;