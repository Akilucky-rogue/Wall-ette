import React, { useMemo, useState } from 'react';
import { TransactionType } from '../types';
import { useWallet } from '../context/WalletContext';
import { prettyMerchant } from '../services/analyticsService';
import { walletCopies } from '../services/statementImport';
import { parseDay } from '../utils/dates';

/**
 * Statement rows in the wallet more than once, usually from importing an
 * overlapping statement with "Include anyway". Matched like the import check:
 * bank reference (or narration), date, direction and amount (audit L3).
 * Shown at the top of Vault only while there are copies; removing them keeps
 * one of each.
 */
const DuplicateEntries: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { transactions, deleteTransactions, formatAmountCompact } = useWallet();
  const [confirming, setConfirming] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  const found = useMemo(() => {
    const { copies, groups } = walletCopies(transactions);
    let net = 0;
    for (const t of copies) net += t.type === TransactionType.INCOME ? t.amount : -t.amount;
    return { copies, groups, net };
  }, [transactions]);

  if (done) {
    return (
      <div className={className}>
        <p className="flex items-center gap-2 rounded-2xl bg-sage-light px-4 py-3 text-[12px] font-medium text-premium-charcoal" role="status">
          <span className="material-symbols-outlined icon-fill text-sage text-[18px]" aria-hidden="true">check_circle</span>
          {done}
        </p>
      </div>
    );
  }
  if (found.copies.length === 0) return null;

  const n = found.copies.length;
  const remove = () => {
    if (!confirming) { setConfirming(true); return; }
    deleteTransactions(found.copies.map(t => t.id));
    setConfirming(false);
    setDone(`Removed ${n} extra ${n === 1 ? 'copy' : 'copies'}. Your balance is corrected.`);
  };

  return (
    <div className={className}>
      <div className="bg-white rounded-3xl p-5 shadow-soft border border-rose/20">
        <div className="flex items-start gap-3">
          <span className="w-9 h-9 rounded-2xl bg-rose-light text-rose flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined icon-fill text-[18px]" aria-hidden="true">content_copy</span>
          </span>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-premium-charcoal leading-snug">
              {found.groups === 1 ? 'A transaction is in your wallet twice' : `${found.groups} transactions are in your wallet twice`}
            </p>
            <p className="text-[12px] text-muted-taupe leading-snug mt-0.5">
              Usually from importing an overlapping statement.
              {Math.abs(found.net) >= 1 && ` They change your balance by ${formatAmountCompact(Math.abs(found.net))}.`}
            </p>
          </div>
        </div>
        <ul className="mt-3 space-y-1.5 max-h-40 overflow-y-auto">
          {found.copies.slice(0, 6).map(t => (
            <li key={t.id} className="flex items-center gap-2 min-w-0 text-[12px]">
              <span className="text-muted-taupe shrink-0 tabular-nums">
                {parseDay(t.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
              </span>
              <span className="text-premium-charcoal truncate flex-1" title={t.merchant || ''}>{prettyMerchant(t.merchant || t.category)}</span>
              <span className={`shrink-0 tabular-nums font-semibold ${t.type === TransactionType.EXPENSE ? 'text-rose' : 'text-sage'}`}>
                {t.type === TransactionType.EXPENSE ? '−' : '+'}{formatAmountCompact(t.amount)}
              </span>
            </li>
          ))}
          {n > 6 && <li className="text-[11px] text-muted-taupe">and {n - 6} more</li>}
        </ul>
        <div className="mt-4 flex gap-2">
          {confirming && (
            <button onClick={() => setConfirming(false)} className="flex-1 py-2.5 rounded-2xl bg-gray-100 text-muted-taupe text-[13px] font-semibold">
              Cancel
            </button>
          )}
          <button
            onClick={remove}
            className="flex-1 py-2.5 rounded-2xl bg-rose text-white text-[13px] font-semibold shadow-raised"
          >
            {confirming ? `Remove ${n} ${n === 1 ? 'copy' : 'copies'}` : 'Remove the extra copies'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DuplicateEntries;
