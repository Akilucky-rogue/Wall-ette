import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { BackupSettings, RestorePlan } from '../services/backup';
import { accountLabel } from '../services/accounts';

interface RestoreBackupSheetProps {
  plan: RestorePlan;
  /** The wallet had no entries: settings start ticked. */
  walletEmpty: boolean;
  /** Rupees as the person reads amounts (formatWhole). */
  money: (inr: number) => string;
  onRestore: (withSettings: boolean) => void;
  onClose: () => void;
}

const dayText = (day: string) => {
  const [y, m, d] = day.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};
const count = (n: number, one: string, many: string) => `${n.toLocaleString('en-IN')} ${n === 1 ? one : many}`;

const listText = (parts: string[]) =>
  parts.length <= 1 ? parts.join('') : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;

export function settingsText(s: BackupSettings, money: (inr: number) => string): string {
  const parts: string[] = [];
  // The opening balance from before 1.5.9 told accounts apart; zero with
  // accounts saved means there's none left to restore.
  if (s.openingBalance !== undefined && !(s.accounts && s.openingBalance === 0 && !s.openingBalanceAsOf)) {
    parts.push(`opening balance ${money(s.openingBalance)}${s.openingBalanceAsOf ? ` from ${dayText(s.openingBalanceAsOf)}` : ''}`);
  }
  if (s.accounts) {
    const list = Object.values(s.accounts);
    parts.push(list.length === 1
      ? `${accountLabel(list[0])}'s opening balance ${money(list[0].opening)}`
      : `opening balances for ${list.length} accounts`);
  }
  if (s.budgets) parts.push(count(Object.keys(s.budgets).length, 'budget', 'budgets'));
  if (s.savingsGoal) parts.push(`savings goal ${money(s.savingsGoal)}`);
  if (s.dailyLimit) parts.push(`daily limit ${money(s.dailyLimit)}`);
  if (s.payeeRules) parts.push(count(s.payeeRules.length, 'Money moved rule', 'Money moved rules'));
  const text = listText(parts);
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** What restoring a backup file will do, and the button that does it. */
const RestoreBackupSheet: React.FC<RestoreBackupSheetProps> = ({ plan, walletEmpty, money, onRestore, onClose }) => {
  const [withSettings, setWithSettings] = useState(walletEmpty && plan.hasSettings);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const total = plan.add.length + plan.already;
  const left = plan.unreadable + plan.repeated;
  const canRestore = plan.add.length > 0 || (withSettings && plan.hasSettings);
  const action = plan.add.length > 0
    ? `Add ${count(plan.add.length, 'entry', 'entries')}`
    : 'Restore settings';

  return createPortal(
    <div className="fixed inset-0 bg-black/50 flex items-end md:items-center justify-center z-[100]" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="restore-title"
        className="bg-white w-full max-w-[430px] rounded-t-[32px] md:rounded-[32px] px-6 pt-6 pb-[calc(1.5rem_+_var(--sab))] animate-slide-up max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-sand-light flex items-center justify-center">
              <span className="material-symbols-outlined text-sand-ink text-[22px]" aria-hidden="true">settings_backup_restore</span>
            </div>
            <h3 id="restore-title" className="text-lg font-serif font-semibold text-premium-charcoal">Restore from a backup</h3>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center" aria-label="Close">
            <span className="material-symbols-outlined text-muted-taupe" aria-hidden="true">close</span>
          </button>
        </div>

        <p className="text-[13px] text-premium-charcoal leading-relaxed">
          {plan.exportedAt && <>Saved on {new Date(plan.exportedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}. </>}
          {total > 0
            ? <>{count(total, 'entry', 'entries')}{plan.from && plan.to ? `, from ${dayText(plan.from)} to ${dayText(plan.to)}` : ''}.</>
            : <>No entries, only settings.</>}
        </p>

        <ul className="mt-3 space-y-2">
          {plan.add.length > 0 && (
            <li className="flex gap-3 text-[13px] text-premium-charcoal leading-relaxed">
              <span className="mt-[7px] w-1.5 h-1.5 rounded-full bg-sage shrink-0" aria-hidden="true" />
              {count(plan.add.length, 'entry', 'entries')} will be added.
            </li>
          )}
          {plan.already > 0 && (
            <li className="flex gap-3 text-[13px] text-premium-charcoal leading-relaxed">
              <span className="mt-[7px] w-1.5 h-1.5 rounded-full bg-muted-taupe shrink-0" aria-hidden="true" />
              {plan.add.length === 0
                ? 'Every entry in this backup is already in your wallet.'
                : `${count(plan.already, 'entry is', 'entries are')} already in your wallet and will be skipped.`}
            </li>
          )}
          {left > 0 && (
            <li className="flex gap-3 text-[13px] text-premium-charcoal leading-relaxed">
              <span className="mt-[7px] w-1.5 h-1.5 rounded-full bg-rose shrink-0" aria-hidden="true" />
              {count(left, "row in the file isn't a valid entry", "rows in the file aren't valid entries")} and will be left out.
            </li>
          )}
        </ul>

        {plan.hasSettings && (
          <label className="mt-5 flex gap-3 items-start rounded-2xl bg-zen-cream/70 px-4 py-3.5 cursor-pointer">
            <input
              type="checkbox"
              className="mt-0.5 w-4 h-4 shrink-0 accent-sage"
              checked={withSettings}
              onChange={e => setWithSettings(e.target.checked)}
            />
            <span className="min-w-0">
              <span className="block text-[13px] font-semibold text-premium-charcoal">Also restore settings</span>
              <span className="block text-[12px] text-muted-taupe leading-relaxed mt-0.5">
                {settingsText(plan.settings, money)}. These replace the same settings in your wallet.
              </span>
            </span>
          </label>
        )}

        <button
          onClick={() => onRestore(withSettings && plan.hasSettings)}
          disabled={!canRestore}
          className="mt-6 w-full bg-sage text-white py-3.5 rounded-2xl font-serif font-medium shadow-soft active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {canRestore ? action : 'Nothing to restore'}
        </button>
        <p className="text-center text-[11px] text-muted-taupe mt-3">Nothing in your wallet is deleted.</p>
      </div>
    </div>,
    document.body,
  );
};

export default RestoreBackupSheet;
