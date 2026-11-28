import React, { useMemo, useState } from 'react';
import { AppScreen, PayeeKind, TransactionType } from '../types';
import { useWallet } from '../context/WalletContext';
import { flowClassifier, matchText, MIN_MATCH, suggestPayees } from '../services/spend';
import { parseDay } from '../utils/dates';
import ReviewPayees from './ReviewPayees';
import Garden from './ui/Garden';

interface MoneyMovedProps {
  onNavigate: (screen: AppScreen) => void;
  /** The screen it was opened from; Back returns there. */
  backTo?: AppScreen;
}

// Static class strings: dynamic Tailwind names are purged at build time.
const KIND_INFO: Record<PayeeKind, { label: string; icon: string; cls: string }> = {
  mine:       { label: 'My account',  icon: 'account_balance', cls: 'bg-sage-light text-sage' },
  family:     { label: 'Family',      icon: 'diversity_3',     cls: 'bg-lavender-light text-lavender' },
  investment: { label: 'Investments', icon: 'trending_up',     cls: 'bg-ocean-light text-ocean' },
  ignore:     { label: 'Not counted', icon: 'visibility_off',  cls: 'bg-gray-100 text-muted-taupe' },
  counts:     { label: 'Counts',      icon: 'payments',        cls: 'bg-rose-light text-rose' },
  salary:     { label: 'My pay',      icon: 'work',            cls: 'bg-sand-light text-sand' },
};

// What a suggestion's buttons set, left to right; the last one keeps it counted.
const SORT_KINDS: PayeeKind[] = ['mine', 'family', 'investment'];
const SHORT_LABEL: Partial<Record<PayeeKind, string>> = { mine: 'Mine', family: 'Family', investment: 'Invest' };
const RULE_KINDS: PayeeKind[] = ['mine', 'family', 'investment', 'ignore', 'counts', 'salary'];

const SHOW_FIRST = 6;

// What Back names, by where it goes.
const BACK_LABEL: Partial<Record<AppScreen, string>> = {
  [AppScreen.DASHBOARD]: 'Back to Home',
  [AppScreen.HISTORY]: 'Back to the Vault',
  [AppScreen.ANALYSIS]: 'Back to Pulse',
  [AppScreen.CATEGORY_SPLIT]: 'Back to Category split',
  [AppScreen.SELF_DATA]: 'Back to Your data',
};

const MoneyMoved: React.FC<MoneyMovedProps> = ({ onNavigate, backTo = AppScreen.SELF_DATA }) => {
  const { transactions, payeeRules, flowOf, savePayeeRule, deletePayeeRule, formatAmountCompact } = useWallet();
  const [showAll, setShowAll] = useState(false);
  const [newMatch, setNewMatch] = useState('');
  const [newKind, setNewKind] = useState<PayeeKind>('family');

  // Payees only money comes in from, still counted as income (money out is reviewed above them)
  const incoming = useMemo(() => suggestPayees(transactions, flowOf).filter(s => s.out === 0), [transactions, flowOf]);

  // What each rule covers, and the total left out of spending and income
  const { perRule, movedOut, movedIn } = useMemo(() => {
    const perRule = new Map<string, { count: number; total: number }>();
    let movedOut = 0, movedIn = 0;
    for (const t of transactions) {
      const info = flowOf(t);
      if (info.rule) {
        const e = perRule.get(info.rule.id) ?? { count: 0, total: 0 };
        e.count++; e.total += t.amount;
        perRule.set(info.rule.id, e);
      }
      if (info.flow === 'moved') {
        if (t.type === TransactionType.INCOME) movedIn += t.amount; else movedOut += t.amount;
      }
    }
    return { perRule, movedOut, movedIn };
  }, [transactions, flowOf]);

  // Live preview for the rule being typed
  const preview = useMemo(() => {
    if (matchText(newMatch).length < MIN_MATCH) return null;
    const probe = flowClassifier([{ id: 'preview', match: newMatch, kind: newKind }]);
    let count = 0, total = 0;
    for (const t of transactions) {
      if (probe(t).rule) { count++; total += t.amount; }
    }
    return { count, total };
  }, [newMatch, newKind, transactions]);

  const rules = useMemo(
    () => [...payeeRules].sort((a, b) =>
      RULE_KINDS.indexOf(a.kind) - RULE_KINDS.indexOf(b.kind) || a.match.localeCompare(b.match)),
    [payeeRules]
  );

  const addRule = () => {
    if (!preview) return;
    savePayeeRule(newMatch, newKind);
    setNewMatch('');
  };

  const shownIncoming = showAll ? incoming : incoming.slice(0, SHOW_FIRST);
  const dayLabel = (day: string) =>
    parseDay(day).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <div className="relative flex h-auto min-h-screen w-full flex-col max-w-[430px] md:max-w-2xl mx-auto overflow-x-hidden pb-32 lg:pb-12 bg-zen-bg">
      <Garden />
      <div className="flex items-center gap-2 bg-zen-bg/85 backdrop-blur-md px-5 pt-6 pb-3 sticky top-0 z-30">
        <button
          onClick={() => onNavigate(backTo)}
          className="w-10 h-10 -ml-2 flex items-center justify-center rounded-full text-premium-charcoal hover:bg-white/70 transition-colors"
          aria-label={BACK_LABEL[backTo] ?? 'Back'}
        >
          <span className="material-symbols-outlined text-[24px]" aria-hidden="true">arrow_back</span>
        </button>
        <h2 className="text-premium-charcoal text-[22px] font-display font-bold tracking-tight leading-tight">Money moved</h2>
      </div>

      <div className="px-6 pt-6 pb-4">
        <h1 className="text-premium-charcoal font-display font-bold text-[28px] leading-tight mb-3">Moved, not spent</h1>
        <p className="text-muted-taupe text-[14px] leading-relaxed">
          Money sent to your own accounts, family or investments isn't spending, and money coming back from them isn't income.
          Sort a payee once and every payment to or from it is left out of both. Your balance still counts it.
        </p>
        {(movedOut > 0 || movedIn > 0) && (
          <div className="mt-4 bg-white rounded-2xl px-4 py-3 shadow-soft border border-black/[0.02] flex items-center justify-between">
            <span className="text-[11px] uppercase tracking-wider text-muted-taupe font-bold">Not counted</span>
            <span className="text-[13px] text-premium-charcoal font-semibold tabular-nums">
              {formatAmountCompact(movedOut)} out · {formatAmountCompact(movedIn)} in
            </span>
          </div>
        )}
      </div>

      {/* To review: payments to payees no rule covers yet (services/review.ts) */}
      <section className="px-6 pb-2">
        <h3 className="text-muted-taupe text-[11px] font-bold uppercase tracking-[0.2em] mb-1 pl-1">To review</h3>
        <p className="text-muted-taupe text-[12px] mb-3 pl-1">
          These payments count as spending until you say what they were.
        </p>
        <ReviewPayees />
      </section>

      {/* Money in from payees no rule covers yet, with nothing going out to them */}
      {incoming.length > 0 && (
        <section className="px-6 pt-4 pb-2">
          <h3 className="text-muted-taupe text-[11px] font-bold uppercase tracking-[0.2em] mb-1 pl-1">Money in to sort</h3>
          <p className="text-muted-taupe text-[12px] mb-3 pl-1">
            These transfers count as income until you sort them.
          </p>
          <div className="space-y-3">
            {shownIncoming.map(s => (
              <div key={s.match} className="bg-white p-4 rounded-3xl border border-black/[0.02] shadow-soft">
                <p className="text-premium-charcoal font-semibold text-[15px] truncate" title={s.name}>{s.name}</p>
                <p className="text-muted-taupe text-[11px] mt-0.5">
                  {formatAmountCompact(s.in)} in · {s.count} {s.count === 1 ? 'payment' : 'payments'} · last {dayLabel(s.last)}
                </p>
                <div className="grid grid-cols-4 gap-2 mt-3">
                  {SORT_KINDS.map(kind => (
                    <button
                      key={kind}
                      onClick={() => savePayeeRule(s.name, kind)}
                      className={`${KIND_INFO[kind].cls} py-2 rounded-xl text-[11px] font-bold active:scale-95 transition-transform`}
                    >
                      {SHORT_LABEL[kind]}
                    </button>
                  ))}
                  <button
                    onClick={() => savePayeeRule(s.name, 'counts')}
                    className="bg-gray-50 text-premium-charcoal border border-premium-charcoal/[0.08] py-2 rounded-xl text-[11px] font-bold active:scale-95 transition-transform"
                    title="Keep counting these as income"
                  >
                    Income
                  </button>
                </div>
              </div>
            ))}
          </div>
          {incoming.length > SHOW_FIRST && (
            <button
              onClick={() => setShowAll(v => !v)}
              className="w-full mt-3 text-[11px] font-semibold text-sage uppercase tracking-wider py-2"
            >
              {showAll ? 'Show fewer' : `Show ${incoming.length - SHOW_FIRST} more`}
            </button>
          )}
        </section>
      )}

      {/* Your rules */}
      <section className="px-6 pt-6">
        <h3 className="text-muted-taupe text-[11px] font-bold uppercase tracking-[0.2em] mb-3 pl-1">Your rules</h3>
        {rules.length === 0 ? (
          <p className="text-muted-taupe text-[13px] italic pl-1">
            No rules yet. Sort a payee above, or add a word that appears in its payments below.
          </p>
        ) : (
          <div className="bg-white rounded-3xl border border-black/[0.02] shadow-soft divide-y divide-premium-charcoal/[0.06]">
            {rules.map(rule => {
              const info = KIND_INFO[rule.kind];
              const stats = perRule.get(rule.id);
              return (
                <div key={rule.id} className="flex items-center gap-3 p-4">
                  <div className={`${info.cls} p-2 rounded-2xl shrink-0`}>
                    <span className="material-symbols-outlined text-[20px]">{info.icon}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-premium-charcoal font-semibold text-[14px] truncate" title={rule.match}>{rule.match}</p>
                    <p className="text-muted-taupe text-[10px]">
                      {rule.kind === 'counts' && rule.category && <>Shown as {rule.category} · </>}
                      {stats ? `${stats.count} ${stats.count === 1 ? 'payment' : 'payments'} · ${formatAmountCompact(stats.total)}` : 'No payments match yet'}
                    </p>
                  </div>
                  <select
                    value={rule.kind}
                    onChange={e => savePayeeRule(rule.match, e.target.value as PayeeKind, e.target.value === 'counts' ? rule.category : undefined)}
                    className="text-[11px] font-semibold text-premium-charcoal bg-gray-50 border border-premium-charcoal/[0.08] rounded-lg px-2 py-1.5"
                    aria-label={`How payments matching ${rule.match} count`}
                  >
                    {RULE_KINDS.map(k => <option key={k} value={k}>{KIND_INFO[k].label}</option>)}
                  </select>
                  <button
                    onClick={() => deletePayeeRule(rule.id)}
                    className="text-muted-taupe hover:text-rose p-1"
                    aria-label={`Delete the rule for ${rule.match}`}
                  >
                    <span className="material-symbols-outlined text-[18px]">close</span>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Add a rule by hand */}
      <section className="px-6 pt-6">
        <h3 className="text-muted-taupe text-[11px] font-bold uppercase tracking-[0.2em] mb-3 pl-1">Add a rule</h3>
        <div className="bg-white p-4 rounded-3xl border border-black/[0.02] shadow-soft space-y-3">
          <input
            type="text"
            value={newMatch}
            onChange={e => setNewMatch(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') addRule(); }}
            placeholder="A name or word in the payee, e.g. ravi"
            className="w-full px-4 py-2.5 rounded-xl border border-sage-border focus:outline-none focus:ring-2 focus:ring-sage text-premium-charcoal text-[14px] bg-white"
            aria-label="Name or word to match"
          />
          <div className="flex gap-2">
            <select
              value={newKind}
              onChange={e => setNewKind(e.target.value as PayeeKind)}
              className="flex-1 text-[13px] font-semibold text-premium-charcoal bg-gray-50 border border-premium-charcoal/[0.08] rounded-xl px-3 py-2.5"
              aria-label="How matching payments count"
            >
              {RULE_KINDS.map(k => <option key={k} value={k}>{KIND_INFO[k].label}</option>)}
            </select>
            <button
              onClick={addRule}
              disabled={!preview}
              className="bg-sage text-white px-5 rounded-xl text-[13px] font-bold disabled:opacity-40 active:scale-95 transition-transform"
            >
              Add
            </button>
          </div>
          <p className="text-[11px] text-muted-taupe min-h-[16px]">
            {preview
              ? preview.count > 0
                ? `Matches ${preview.count} ${preview.count === 1 ? 'payment' : 'payments'} · ${formatAmountCompact(preview.total)}`
                : 'Matches nothing yet; it will apply to future imports.'
              : 'Whole words only, so "dad" won\'t match "Dadar".'}
          </p>
        </div>
      </section>
    </div>
  );
};

export default MoneyMoved;
