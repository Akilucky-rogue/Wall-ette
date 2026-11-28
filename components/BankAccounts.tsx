import React, { useMemo } from 'react';
import { AppScreen } from '../types';
import { useWallet } from '../context/WalletContext';
import { accountSummaries, type AccountSummary } from '../services/accounts';
import { showAccountInVault } from '../utils/vaultAccount';
import { parseDay } from '../utils/dates';
import { useLimits } from '../services/plan';
import { openPlans } from '../services/planSheet';

interface BankAccountsProps {
  onNavigate: (screen: AppScreen) => void;
}

// "24 Nov", or "24 Nov 2025" for an earlier year.
const shortDay = (day: string): string => {
  const d = parseDay(day);
  const thisYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString('en-IN', thisYear ? { day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short', year: 'numeric' });
};

const entriesLine = (s: AccountSummary): string =>
  `${s.entries.toLocaleString('en-IN')} ${s.entries === 1 ? 'entry' : 'entries'}${s.latest ? ` · latest ${shortDay(s.latest)}` : ''}`;

/**
 * Self → Your data → Bank accounts: each account Wall-ette has read a
 * statement from, with its balance (its opening balance plus its entries,
 * services/accounts.ts), and what no account claims. Tapping one opens Vault
 * with just its entries.
 */
const BankAccounts: React.FC<BankAccountsProps> = ({ onNavigate }) => {
  const { transactions, accounts, unassignedOpening, formatAmount } = useWallet();
  const { accounts: list, other, total } = useMemo(
    () => accountSummaries(transactions, accounts, unassignedOpening),
    [transactions, accounts, unassignedOpening],
  );
  // Essential keeps one account to add to and edit; the rest stay, read-only.
  const limits = useLimits(accounts);
  const kept = limits.access === 'essential' ? list.find(s => s.key === limits.account) ?? null : null;
  const readOnly = (s: AccountSummary) => !!kept && s.key !== kept.key;

  const open = (key: string) => {
    showAccountInVault(key);
    onNavigate(AppScreen.HISTORY);
  };

  // The name gets the whole width, then the balance, then its entries.
  const row = (s: AccountSummary, icon: string, iconCls: string, sub: string) => (
    <button
      key={s.key}
      type="button"
      onClick={() => open(s.key)}
      className="w-full flex items-center gap-3 px-4 py-4 text-left hover:bg-sage-light/20 transition-colors"
    >
      <span className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center ${iconCls}`} aria-hidden="true">
        <span className="material-symbols-outlined text-[20px]">{icon}</span>
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-[14px] font-semibold text-premium-charcoal leading-snug break-words">{s.label}</span>
        <span className={`block mt-0.5 text-[18px] font-display font-bold tabular-nums ${s.balance < 0 ? 'text-rose' : 'text-premium-charcoal'}`}>
          {formatAmount(s.balance)}
        </span>
        <span className="block mt-0.5 text-[12px] text-muted-taupe">{sub}</span>
      </span>
      <span className="material-symbols-outlined text-[20px] text-muted-taupe shrink-0" aria-hidden="true">chevron_right</span>
    </button>
  );

  return (
    <div className="eco-frame relative flex h-auto min-h-screen w-full flex-col max-w-[430px] md:max-w-2xl mx-auto overflow-x-hidden pb-32 lg:pb-12 bg-zen-bg">
      <div className="flex items-center gap-2 bg-zen-bg/85 backdrop-blur-md px-5 pt-6 pb-3 sticky top-0 z-30">
        <button
          onClick={() => onNavigate(AppScreen.SELF_DATA)}
          className="w-10 h-10 -ml-2 flex items-center justify-center rounded-full text-premium-charcoal hover:bg-white/70 transition-colors"
          aria-label="Back to Your data"
        >
          <span className="material-symbols-outlined text-[24px]" aria-hidden="true">arrow_back</span>
        </button>
        <h2 className="text-premium-charcoal text-[22px] font-display font-bold tracking-tight leading-tight">Bank accounts</h2>
      </div>

      <div className="px-6 pt-6 pb-4">
        <h1 className="text-premium-charcoal font-display font-bold text-[28px] leading-tight mb-3">Where your money is</h1>
        <p className="text-muted-taupe text-[14px] leading-relaxed">
          Each account's balance is what it held before its first statement here, plus every entry since. Tap one to see its entries in Vault.
        </p>
      </div>

      {list.length === 0 ? (
        <section className="px-6">
          <div className="bg-white rounded-2xl shadow-soft border border-black/[0.02] px-5 py-6">
            <p className="text-premium-charcoal text-[15px] font-semibold mb-1">No bank accounts yet</p>
            <p className="text-muted-taupe text-[13px] leading-relaxed mb-4">
              Import a statement that shows its account number, and the account appears here with its balance.
            </p>
            <button
              type="button"
              onClick={() => onNavigate(AppScreen.IMPORT)}
              className="px-4 py-2.5 rounded-xl bg-sage text-white text-[14px] font-semibold shadow-soft"
            >
              Import a statement
            </button>
          </div>
        </section>
      ) : (
        <section className="px-6 space-y-3">
          <div className="bg-white rounded-2xl shadow-soft border border-black/[0.02] divide-y divide-black/[0.04] overflow-hidden">
            {list.map(s => row(s, readOnly(s) ? 'lock' : 'account_balance', 'bg-sage-light text-sage', readOnly(s) ? `${entriesLine(s)} · read-only` : entriesLine(s)))}
          </div>
          {kept && list.some(readOnly) && (
            <p className="text-muted-taupe text-[12px] leading-relaxed px-1">
              Essential holds one bank account: {kept.label}. The others stay saved and read-only.{' '}
              <button type="button" onClick={() => openPlans('read-only')} className="text-sage font-semibold hover:underline">See Plus</button>
            </p>
          )}
          {other && (
            <>
              <div className="bg-white rounded-2xl shadow-soft border border-black/[0.02] overflow-hidden">
                {row(other, 'edit_note', 'bg-lavender-light text-lavender', entriesLine(other))}
              </div>
              <p className="text-muted-taupe text-[12px] leading-relaxed px-1">
                Other entries are ones you typed in, payments read from your apps until a statement brings them, and rows from statements that don't show an account number.
              </p>
            </>
          )}
          <div className="flex items-center justify-between px-1 pt-1">
            <span className="text-muted-taupe text-[13px]">Together, your balance on Home</span>
            <span className="text-premium-charcoal text-[15px] font-semibold tabular-nums">{formatAmount(total)}</span>
          </div>
        </section>
      )}
    </div>
  );
};

export default BankAccounts;
