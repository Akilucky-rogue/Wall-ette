import React from 'react';
import { AppScreen } from '../types';
import { useWallet } from '../context/WalletContext';
import { prettyMerchant } from '../services/analyticsService';
import { addDays, localDay, parseDay } from '../utils/dates';
import { openAt } from '../utils/screenSection';
import { shortDay, UsageBar, useLeftToSpend } from './LeftToSpendCard';

const dueLabel = (day: string) => {
  const today = localDay();
  if (day <= today) return 'Due today';
  if (day === addDays(today, 1)) return 'Due tomorrow';
  return `Due ${parseDay(day).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}`;
};

interface LeftToSpendProps {
  onNavigate: (screen: AppScreen) => void;
}

/** The page: the figure, how it adds up, and the bills still to come. */
const LeftToSpendPage: React.FC<LeftToSpendProps> = ({ onNavigate }) => {
  const { formatWhole, savingsGoal } = useWallet();
  const left = useLeftToSpend();
  const money = formatWhole;
  const movedLabel = !left || left.invested === 0 ? 'Sent to family' : left.invested >= left.moved ? 'Invested' : 'Sent to family and invested';
  const goals = () => { openAt('goals'); onNavigate(AppScreen.INCOME_INSIGHTS); };

  return (
    <div className="relative flex min-h-screen w-full flex-col max-w-[430px] md:max-w-2xl mx-auto overflow-x-hidden pb-32 lg:pb-12 bg-zen-bg">
      <div className="flex items-center gap-2 bg-zen-bg/85 backdrop-blur-md px-5 pt-6 pb-3 sticky top-0 z-30">
        <button
          onClick={() => onNavigate(AppScreen.DASHBOARD)}
          className="w-10 h-10 -ml-2 flex items-center justify-center rounded-full text-premium-charcoal hover:bg-white/70 transition-colors"
          aria-label="Back to Home"
        >
          <span className="material-symbols-outlined text-[24px]" aria-hidden="true">arrow_back</span>
        </button>
        <div className="min-w-0">
          <h2 className="text-premium-charcoal text-[22px] font-display font-bold tracking-tight leading-tight">Left to spend</h2>
          {left && (
            <p className="text-[12px] text-muted-taupe">
              {left.basis === 'pay' ? `Pay to pay · ${shortDay(left.from)} to ${shortDay(left.until)}` : `${parseDay(left.from).toLocaleDateString('en-GB', { month: 'long' })}`}
            </p>
          )}
        </div>
      </div>

      {!left ? (
        <div className="px-6 pt-6">
          <div className="bg-white rounded-3xl p-6 shadow-soft border border-black/[0.02] text-center">
            <span className="material-symbols-outlined icon-fill text-sage text-[30px]" aria-hidden="true">account_balance_wallet</span>
            <p className="font-display text-[17px] font-bold text-premium-charcoal mt-2">Nothing has come in yet</p>
            <p className="text-[12px] text-muted-taupe mt-1 leading-relaxed">
              Once your pay or other money comes in, this shows what you can still spend after bills and your savings goal.
            </p>
            <button onClick={() => onNavigate(AppScreen.IMPORT)} className="mt-4 px-5 py-2.5 rounded-full bg-sage text-white text-[13px] font-semibold shadow-raised">
              Import a statement
            </button>
          </div>
        </div>
      ) : (
        <div className="px-6 pt-3 space-y-4">
          {/* The figure */}
          <div className="bg-white rounded-[28px] p-6 shadow-raised border border-black/[0.02]">
            {left.left >= 0 ? (
              <>
                <p className="font-semibold text-[44px] leading-none text-premium-charcoal tabular-nums">{money(left.left)}</p>
                <p className="text-[13px] text-muted-taupe mt-2">
                  About <span className="text-premium-charcoal font-semibold">{money(left.perDay)} a day</span>
                  {left.daysLeft === 1 ? ' for today' : ` for the next ${left.daysLeft} days`}.
                </p>
              </>
            ) : (
              <>
                <p className="font-semibold text-[44px] leading-none text-rose tabular-nums">{money(-left.left)} over</p>
                <p className="text-[13px] text-muted-taupe mt-2 leading-relaxed">
                  Spending, bills and your savings goal come to more than came in {left.basis === 'pay' ? 'since your last pay' : 'this month'}.
                </p>
              </>
            )}
            <div className="mt-5"><UsageBar left={left} /></div>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-taupe">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-rose" />Spent</span>
              {left.moved > 0 && <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-lavender" />{movedLabel}</span>}
              {left.billsTotal > 0 && <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-sand" />Bills to come</span>}
              {left.toSetAside > 0 && <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-sage" />Savings goal</span>}
            </div>
          </div>

          {(left.behind || left.payLate || left.basis === 'month') && (
            <div className="rounded-2xl bg-sand-light px-4 py-3 text-[12px] text-premium-charcoal leading-relaxed space-y-1.5">
              {left.payLate && <p>Your pay usually arrives by now and isn't in yet. This counts today only.</p>}
              {left.behind && (
                <p>
                  Worked out from entries up to {shortDay(left.newest)}.{' '}
                  <button onClick={() => onNavigate(AppScreen.IMPORT)} className="font-semibold text-sage underline-offset-2 hover:underline">Import your latest statement</button>
                  {' '}for an up-to-date figure.
                </p>
              )}
              {left.basis === 'month' && (
                <p>
                  Wall-ette doesn't know your pay yet, so this covers the calendar month.{' '}
                  <button onClick={() => onNavigate(AppScreen.INCOME_INSIGHTS)} className="font-semibold text-sage underline-offset-2 hover:underline">Confirm your pay in Flow</button>
                  {' '}to count from pay day to pay day.
                </p>
              )}
            </div>
          )}

          {/* How it adds up, on a receipt with a torn edge (styles.css) */}
          <div className="receipt-lift">
          <div className="receipt rounded-t-3xl px-5 pt-5">
            <p className="text-[13px] font-semibold text-premium-charcoal mb-3">How it adds up</p>
            <dl className="space-y-2.5 text-[13px]">
              <div className="flex justify-between gap-3">
                <dt className="text-muted-taupe">{left.basis === 'pay' ? `Came in since ${shortDay(left.from)}` : 'Came in this month'}</dt>
                <dd className="whitespace-nowrap tabular-nums text-sage font-semibold">+{money(left.cameIn)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-taupe">Spent</dt>
                <dd className="whitespace-nowrap tabular-nums text-premium-charcoal">−{money(left.spent)}</dd>
              </div>
              {left.moved > 0 && (
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-taupe">{movedLabel}</dt>
                  <dd className="whitespace-nowrap tabular-nums text-premium-charcoal">−{money(left.moved)}</dd>
                </div>
              )}
              <div className="flex justify-between gap-3">
                <dt className="text-muted-taupe">Bills still to come</dt>
                <dd className="whitespace-nowrap tabular-nums text-premium-charcoal">−{money(left.billsTotal)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-taupe min-w-0">
                  <span className="block">Savings goal to set aside</span>
                  <span className="block text-[11px] mt-0.5">
                    {left.invested > 0 && savingsGoal > 0 && <>{money(savingsGoal)} goal, less {money(Math.min(savingsGoal, left.invested))} invested. </>}
                    <button onClick={goals} className="text-sage font-semibold hover:underline">{savingsGoal > 0 ? 'Change goal' : 'Set a goal'}</button>
                  </span>
                </dt>
                <dd className="whitespace-nowrap tabular-nums text-premium-charcoal">−{money(left.toSetAside)}</dd>
              </div>
              <div className="flex justify-between gap-3 pt-3 border-t border-dashed border-premium-charcoal/15">
                <dt className="font-semibold text-premium-charcoal">Left to spend</dt>
                <dd className={`whitespace-nowrap tabular-nums font-semibold ${left.left < 0 ? 'text-rose' : 'text-premium-charcoal'}`}>
                  {left.left < 0 ? '−' : ''}{money(Math.abs(left.left))}
                </dd>
              </div>
            </dl>
          </div>
          </div>

          {/* Bills still to come */}
          <div className="bg-white rounded-3xl shadow-soft border border-black/[0.02] overflow-hidden">
            <p className="px-5 pt-5 pb-2 text-[13px] font-semibold text-premium-charcoal">
              Bills before {left.payLate ? 'your pay' : shortDay(left.until)}
            </p>
            {left.bills.length === 0 ? (
              <p className="px-5 pb-5 text-[12px] text-muted-taupe">No regular bills are due before then.</p>
            ) : (
              <ul className="divide-y divide-premium-charcoal/[0.06]">
                {left.bills.map((b, i) => (
                  <li key={i} className="flex items-center gap-3 px-5 py-3">
                    <span className="w-9 h-9 rounded-2xl bg-sand-light text-sand-ink flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined icon-fill text-[18px]" aria-hidden="true">event</span>
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-[14px] font-semibold text-premium-charcoal truncate" title={b.name}>{prettyMerchant(b.name)}</span>
                      <span className="block text-[11px] text-muted-taupe">{b.wasDue ? `Was due ${shortDay(b.wasDue)}` : dueLabel(b.due)}</span>
                    </span>
                    <span className="text-[14px] font-semibold text-premium-charcoal tabular-nums shrink-0">{money(b.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <p className="text-[11px] text-muted-taupe leading-relaxed px-1">
            Money between your own accounts isn't counted. Bills are the payments that repeat in your history.
            Worked out on your phone.
          </p>
        </div>
      )}
    </div>
  );
};

export default LeftToSpendPage;
