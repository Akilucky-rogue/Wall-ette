import React, { useState, useRef, useEffect, useMemo } from 'react';
// XLSX is only pulled in via IDFCBankParser, which lives in this lazy chunk.
import { AppScreen, Transaction, TransactionType, categoryOptions } from '../types';
import { parseStatementPdf, StatementLockedError } from '../services/idfcParser';
import IDFCBankParser from '../services/IDFCBankParser';
import { accountView, bridgeAdjustment, findDuplicates, fromExcel, importTally, mergeImport, staleAdjustments, suggestLegacy, tallyTone as tallyToneOf, toTransactions, unreadableRows, type StatementAccount, type StatementRow, type WalletLedger } from '../services/statementImport';
import { accountKey, accountLabel } from '../services/accounts';
import { useWallet } from '../context/WalletContext';
import { log } from '../utils/log';
import { parseDay } from '../utils/dates';
import { useBackHandler } from '../utils/backStack';
import { Mascot } from './ui/Brand';
import { Diya, FloatingLeaf, PottedPlant, RangoliCorner, Sprout } from './ui/Decor';
import ReviewPayees from './ReviewPayees';
import { reviewPayees, shownCategory, TO_REVIEW } from '../services/review';
import { receiptLines, type ImportReceipt } from '../services/importReceipt';
import styles from './ImportStatement.module.css';
import { capturedRows, carryOver, isCaptured } from '../services/captured';
import { useLimits } from '../services/plan';
import { takesAccount } from '../services/planRules';
import PlanLock from './PlanLock';

// Pagination settings
const ITEMS_PER_PAGE = 20;

/** A statement day as the rest of the app shows one: "18 Nov 2026". */
const showDay = (day: string) => parseDay(day).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

interface ImportStatementProps {
    onNavigate: (screen: AppScreen) => void;
}

/**
 * What an import did (services/importReceipt.ts): the statement's period,
 * the rows read and what became of them, and how the balance check read.
 */
const ReceiptCard: React.FC<{ receipt: ImportReceipt; money: (n: number) => string; heading?: string; showWhen?: boolean }> = ({ receipt: r, money, heading, showWhen }) => {
  const check = r.check === 'ok'
    ? { icon: 'check_circle', cls: 'text-sage', text: `Matches the bank's closing balance${r.closing !== undefined ? ` of ${money(r.closing)}` : ''} on ${showDay(r.to)}.` }
    : r.check === 'note'
      ? { icon: 'info', cls: 'text-ocean', text: "The statement adds up row for row. Your wallet also holds other accounts or entries, so its balance can't equal this closing balance." }
      : r.check === 'off'
        ? { icon: 'error', cls: 'text-rose', text: `Off by ${money(Math.abs(r.difference ?? 0))} against the bank's closing balance on ${showDay(r.to)}.` }
        : { icon: 'help', cls: 'text-muted-taupe', text: "This statement doesn't print a closing balance, so there was nothing to check it against." };
  const when = new Date(r.at);
  return (
    <div className="bg-white rounded-3xl p-5 shadow-soft border border-black/[0.02]">
      {heading && <p className="font-display text-[20px] font-bold text-premium-charcoal mb-0.5">{heading}</p>}
      <p className="text-[12px] text-muted-taupe">
        {r.bank ?? 'Statement'}{r.last4 ? ` ••${r.last4}` : ''} {r.format} · {showDay(r.from)} to {showDay(r.to)}
      </p>
      <ul className="mt-3 space-y-1 text-[13px] text-premium-charcoal leading-snug">
        {receiptLines(r, money).map(line => <li key={line}>{line}</li>)}
      </ul>
      <p className="mt-3 flex items-start gap-2 text-[12px] text-premium-charcoal leading-snug">
        <span className={`material-symbols-outlined text-[18px] shrink-0 ${check.cls}`} aria-hidden="true">{check.icon}</span>
        <span><b>Balance check:</b> {check.text}</span>
      </p>
      <p className="mt-2 flex items-start gap-2 text-[12px] text-premium-charcoal leading-snug">
        <span className={`material-symbols-outlined text-[18px] shrink-0 ${r.toReview !== undefined ? 'text-ocean' : 'text-sage'}`} aria-hidden="true">
          {r.toReview !== undefined ? 'info' : 'check_circle'}
        </span>
        <span><b>Categories:</b> {r.toReview !== undefined ? `${money(r.toReview)} of payments left to name.` : 'every payment has a category.'}</span>
      </p>
      {showWhen && (
        <p className="mt-2 text-[11px] text-muted-taupe">
          Imported {when.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}, {when.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
        </p>
      )}
    </div>
  );
};

/** The five steps of an import, in order. */
const IMPORT_STEPS = ['Format', 'Statement', 'Balance', 'Categories', 'Summary'] as const;

/** Where the import is: the step done so far filled, its name in bold. */
const ImportSteps: React.FC<{ current: number }> = ({ current }) => (
  <ol className="flex items-start gap-1.5 mb-6" aria-label={`Step ${current + 1} of ${IMPORT_STEPS.length}: ${IMPORT_STEPS[current]}`}>
    {IMPORT_STEPS.map((label, i) => (
      <li key={label} className="flex-1 min-w-0" aria-current={i === current ? 'step' : undefined}>
        <div className={`h-1 rounded-full ${i <= current ? 'bg-sage' : 'bg-sage/15'}`} />
        <p className={`mt-1.5 text-[10px] leading-tight truncate ${i === current ? 'text-premium-charcoal font-semibold' : 'text-muted-taupe'}`}>{label}</p>
      </li>
    ))}
  </ol>
);

/** A status on its own line: the balance check's, or the categories'. */
const StatusLine: React.FC<{ label: string; tone: 'ok' | 'info' | 'warn' | 'muted'; text: string; action?: React.ReactNode }> = ({ label, tone, text, action }) => (
  <div className="flex items-start gap-2.5 rounded-2xl bg-white/70 border border-black/[0.04] px-4 py-3">
    <span className={`material-symbols-outlined text-[18px] mt-0.5 shrink-0 ${tone === 'ok' ? 'text-sage' : tone === 'info' ? 'text-ocean' : tone === 'warn' ? 'caution-mark' : 'text-muted-taupe'}`} aria-hidden="true">
      {tone === 'ok' ? 'check_circle' : tone === 'info' ? 'info' : tone === 'warn' ? 'error' : 'help'}
    </span>
    <p className="flex-1 min-w-0 text-[12px] text-premium-charcoal leading-snug"><b>{label}:</b> {text}</p>
    {action}
  </div>
);

interface EditingTransaction {
    id: string;
    merchant: string;
    category: string;
    amount: number;
    type: TransactionType;
    date: string;
}

const ImportStatement: React.FC<ImportStatementProps> = ({ onNavigate }) => {
  const {
      importTransactions, transactions: existingTransactions, storedTransactions,
      unassignedOpening, openingBalanceAsOf, accounts, formatAmount,
      flowOf, importReceipts, saveImportReceipt,
  } = useWallet();
  // Essential's limits (services/planRules.ts): one bank account, and rows
  // older than its 12 months saved read-only. Open everything until paid
  // plans are switched on.
  const limits = useLimits(accounts);

  // Stages: IDLE (choose a file), PROCESSING (reading it), REVIEW (the rows),
  // DONE (the receipt, and the payments to review)
  const [stage, setStage] = useState<'IDLE' | 'PROCESSING' | 'REVIEW' | 'DONE'>('IDLE');
  // The five steps the person sees (ImportSteps): the format, then the
  // statement (IDLE), the balance check and the categories (REVIEW, each with
  // its own status), then the summary (DONE).
  const [format, setFormat] = useState<'PDF' | 'Excel' | null>(null);
  const [reviewStep, setReviewStep] = useState<'balance' | 'categories'>('balance');
  // The bank the reader recognised and the file's format, for the receipt.
  const [source, setSource] = useState<{ bank: string | null; format: 'PDF' | 'Excel' }>({ bank: null, format: 'PDF' });
  const [receipt, setReceipt] = useState<ImportReceipt | null>(null);
  const [importedIds, setImportedIds] = useState<ReadonlySet<string>>(new Set());
  const toReviewAfter = useMemo(
    () => (stage === 'DONE' ? reviewPayees(existingTransactions, flowOf, importedIds) : []),
    [stage, existingTransactions, flowOf, importedIds],
  );
  const [loadingMessage, setLoadingMessage] = useState('Initializing...');
  
  const [extractedData, setExtractedData] = useState<Transaction[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [duplicateIds, setDuplicateIds] = useState<Set<string>>(new Set());
  // Rows that stand for payments read from your apps: row id → that entry's id
  // (services/captured.ts). Ticked, each takes its entry's place.
  const [replacing, setReplacing] = useState<ReadonlyMap<string, string>>(new Map());
  const replaces = useMemo(
    () => [...replacing].filter(([row]) => selectedIds.has(row)).map(([, entry]) => entry),
    [replacing, selectedIds],
  );
  const [showDuplicateInfo, setShowDuplicateInfo] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [parsedOpeningBalance, setParsedOpeningBalance] = useState<number | undefined>(undefined);
  const [parsedClosingBalance, setParsedClosingBalance] = useState<number | undefined>(undefined);
  // The account the statement is from (its bank and the last four digits of
  // its number), when it shows the number. Each account keeps its own
  // opening balance, so a wallet with several tallies each one.
  const [statementAccount, setStatementAccount] = useState<{ bank: string; last4: string } | null>(null);
  // Whether the opening balance the wallet kept from before 1.5.9 is this
  // account's; null goes by the suggestion.
  const [legacyChoice, setLegacyChoice] = useState<'same' | 'separate' | null>(null);
  // Rows with money on them the statement reader couldn't place (no day or
  // direction). Not imported; the review says how many.
  const [unreadable, setUnreadable] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Edit modal state
  const [editingTx, setEditingTx] = useState<EditingTransaction | null>(null);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);

  // Bridge a detected coverage gap with a single adjustment entry
  const [bridgeGap, setBridgeGap] = useState(false);
  
  // Parser tracking
  const [parserUsed, setParserUsed] = useState<string>('');

  // A password-locked PDF waiting for its password (kept only in memory).
  const [locked, setLocked] = useState<{ base64: string; wrong: boolean } | null>(null);
  const [pdfPassword, setPdfPassword] = useState('');

  // Flip all types (in case AI got it wrong)
  const flipAllTypes = () => {
    setExtractedData(prev => prev.map(t => ({
      ...t,
      type: t.type === TransactionType.INCOME ? TransactionType.EXPENSE : TransactionType.INCOME
    })));
  };

  // Calculate paginated data
  const totalPages = Math.ceil(extractedData.length / ITEMS_PER_PAGE);
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return extractedData.slice(start, start + ITEMS_PER_PAGE);
  }, [extractedData, currentPage]);

  // Review header summary in one pass — the previous version called
  // extractedData.sort() inline in JSX, mutating state on every render
  // (audit Phase 1.1).
  const reviewSummary = useMemo(() => {
    if (extractedData.length === 0) return null;
    let incomeSum = 0, expenseSum = 0;
    let minDate = extractedData[0].date, maxDate = extractedData[0].date;
    for (const t of extractedData) {
      if (t.type === TransactionType.INCOME) incomeSum += t.amount;
      else expenseSum += t.amount;
      if (t.date < minDate) minDate = t.date;
      if (t.date > maxDate) maxDate = t.date;
    }
    return { incomeSum, expenseSum, minDate, maxDate };
  }, [extractedData]);

  // Reset page when data changes
  useEffect(() => {
    setCurrentPage(1);
  }, [extractedData]);

  // ── Balance tally (issue: imported data must reconcile) ──────────────────
  // The wallet as this import will leave it (services/statementImport.ts
  // works it out with the same merge the import runs) against the bank's
  // closing balance, both on the statement's last day, to the paisa. Also
  // finds a stretch with no statement on either side of the wallet's entries,
  // and checks the statement on its own: opening + rows = closing, with every
  // row in the wallet once. A wallet that also holds other accounts or cash
  // can't equal one account's closing, so that check is what proves its import.
  const wallet = useMemo<WalletLedger>(
    () => ({ transactions: existingTransactions, openingBalance: unassignedOpening, openingBalanceAsOf, accounts }),
    [existingTransactions, unassignedOpening, openingBalanceAsOf, accounts],
  );
  // For an account the wallet doesn't know yet, in a wallet that kept an
  // opening balance from before 1.5.9: whether that balance is this
  // account's (services/statementImport.ts suggestLegacy). Review asks.
  const legacySuggestion = useMemo(() => {
    if (!statementAccount || !reviewSummary) return null;
    return suggestLegacy({
      wallet, account: statementAccount, rows: extractedData,
      minDate: reviewSummary.minDate, maxDate: reviewSummary.maxDate,
      opening: parsedOpeningBalance, closing: parsedClosingBalance,
    });
  }, [wallet, statementAccount, reviewSummary, extractedData, parsedOpeningBalance, parsedClosingBalance]);
  const legacy = legacySuggestion ? (legacyChoice ?? legacySuggestion) : null;
  const account = useMemo<StatementAccount | undefined>(
    () => (statementAccount ? { ...statementAccount, ...(legacy ? { legacy } : {}) } : undefined),
    [statementAccount, legacy],
  );
  const rowIds = useMemo(() => new Set(extractedData.map(t => t.id)), [extractedData]);

  const tally = useMemo(() => {
    if (!reviewSummary) return null;
    return importTally({
      wallet,
      selected: extractedData.filter(t => selectedIds.has(t.id)),
      rows: extractedData,
      duplicates: duplicateIds,
      minDate: reviewSummary.minDate,
      maxDate: reviewSummary.maxDate,
      opening: parsedOpeningBalance,
      closing: parsedClosingBalance,
      bridge: bridgeGap,
      account,
      replaces,
    });
  }, [parsedClosingBalance, parsedOpeningBalance, reviewSummary, extractedData, selectedIds, duplicateIds,
      wallet, bridgeGap, account, replaces]);
  // What the import does to the account itself: its opening balance (set,
  // moved to an earlier statement, or kept) and the entries from before
  // 1.5.9 it marks as the account's. Worked out with the import's own merge.
  const accountPlan = useMemo(() => {
    if (!account || !reviewSummary) return null;
    const key = accountKey(account.bank, account.last4);
    const r = mergeImport(wallet, [], { opening: parsedOpeningBalance, statementStart: reviewSummary.minDate, account, rowIds });
    return { known: wallet.accounts?.[key] ?? null, next: r.account?.anchor ?? null, marks: r.retagged.length };
  }, [account, reviewSummary, wallet, parsedOpeningBalance, rowIds]);
  // Importing a statement again, with every row already in the wallet,
  // still sets the account's opening balance or marks its entries.
  const nothingToAdd = selectedIds.size === 0;
  // Essential: a statement of a second bank account isn't taken; rows older
  // than its 12 months are taken, read-only (planRules.ts editable).
  const secondAccount = limits.access === 'essential' && !takesAccount(limits, statementAccount ? accountKey(statementAccount.bank, statementAccount.last4) : null);
  const olderRows = limits.access === 'essential'
    ? extractedData.filter(t => selectedIds.has(t.id) && t.date.slice(0, 10) < limits.from).length
    : 0;
  const canUpdate = !!accountPlan && (!!accountPlan.next || accountPlan.marks > 0);
  const accountNote = (): string => {
    if (!account || !accountPlan) return '';
    const { known, next } = accountPlan;
    const when = (asOf: string | null) => (asOf ? ` on ${showDay(asOf)}` : '');
    const noOpening = "This statement doesn't show the balance it started with, so your balance counts only its entries.";
    // The answer to whose the opening balance from before 1.5.9 is.
    if (legacySuggestion && legacy === 'same') {
      const earlier = next && next.opening !== unassignedOpening
        ? ` This statement starts earlier, so the account opens at ${formatAmount(next.opening)}${when(next.asOf)} instead.`
        : '';
      return `Then that balance, and the entries you imported before, are this account's.${earlier} The balance check below shows whether that adds up.`;
    }
    if (legacySuggestion) {
      return next
        ? `Then this account gets its own opening balance, ${formatAmount(next.opening)}${when(next.asOf)}, and that one stays with your other entries.`
        : `Then that one stays with your other entries. ${noOpening}`;
    }
    if (next && !known) return `New in your wallet. Its opening balance, ${formatAmount(next.opening)}${when(next.asOf)}, is added to your balance.`;
    if (next) return `This statement starts before any other from this account in your wallet, so the account's opening balance becomes ${formatAmount(next.opening)}${when(next.asOf)}.`;
    if (known) return `Already in your wallet, with an opening balance of ${formatAmount(known.opening)}${when(known.asOf)}.`;
    return `New in your wallet. ${noOpening}`;
  };

  // Card tone (services/statementImport.ts tallyTone): 'ok' when the wallet
  // will match the bank; 'note' when the statement checks out row for row but
  // the wallet's total covers more than this account; 'off' when the import
  // itself is short.
  const tallyBridged = !!(tally?.gap && bridgeGap && tally.matched);
  const statementChecks = tally?.statement?.complete === true;
  const tallyTone = tally ? tallyToneOf(tally, bridgeGap) : null;

  // The card's words: what's wrong with the import itself first, then how
  // the wallet's total relates to this one account.
  // The two statuses of a review, kept apart: does the statement add up
  // (the balance check), and what's still to name (the categories).
  const balanceStatus: { tone: 'ok' | 'info' | 'warn' | 'muted'; text: string } =
    tallyTone === 'ok' ? { tone: 'ok', text: "matches the bank's closing balance." }
    : tallyTone === 'note' ? { tone: 'info', text: 'the statement adds up row for row. Your wallet also holds other accounts, so its balance differs.' }
    : tallyTone === 'off' ? { tone: 'warn', text: "doesn't match the bank's closing balance yet." }
    : { tone: 'muted', text: "this statement shows no closing balance to check against." };
  const toNameCount = useMemo(
    () => extractedData.filter(t => selectedIds.has(t.id) && t.type === TransactionType.EXPENSE && shownCategory(t, flowOf(t)) === TO_REVIEW).length,
    [extractedData, selectedIds, flowOf],
  );
  const categoryStatus: { tone: 'ok' | 'info'; text: string } = toNameCount > 0
    ? { tone: 'info', text: `${toNameCount} ${toNameCount === 1 ? 'payment is a transfer' : 'payments are transfers'} Wall-ette can't name yet. You can say what they were after importing.` }
    : { tone: 'ok', text: 'every row has a category.' };

  const tallyMessage = (): string => {
    if (!tally) return '';
    const amount = (n: number) => formatAmount(Math.abs(n));
    const st = tally.statement;
    if (tallyTone === 'ok') {
      if (tallyBridged) return '✓ Bridged: with the adjustment entry, your balance will match the bank.';
      if (account) {
        return `✓ ${accountLabel(account)} tallies with the bank${tally.hasNewer ? ` as of ${showDay(tally.endDate)}` : ''}. Your wallet's balance after import: ${formatAmount(tally.projectedFinal)}.`;
      }
      if (tally.hasNewer) return `✓ Tallies with the bank as of ${showDay(tally.endDate)}. Final balance after import: ${formatAmount(tally.projectedFinal)}.`;
      return '✓ Tallies with the statement. Your balance will be accurate after import.';
    }
    if (st && !st.addsUp) {
      return `The rows read don't add up to the bank's closing balance: ${amount(st.unexplained)} is unaccounted for. If money in and out look swapped, try Flip types; if rows are missing, try your bank's Excel download.`;
    }
    if (st && st.twice.count > 0) {
      const n = st.twice.count;
      return `${n === 1 ? '1 row your wallet already has is' : `${n} rows your wallet already has are`} ticked again and would count twice (${amount(st.twice.net)}). Untick ${n === 1 ? "it unless it's a separate payment" : "them unless they're separate payments"}.`;
    }
    if (st && st.leftOut.count > 0) {
      const n = st.leftOut.count;
      return `${n === 1 ? '1 unticked row' : `${n} unticked rows`} (${amount(st.leftOut.net)}) won't be imported, so your wallet will miss ${n === 1 ? 'it' : 'them'}.`;
    }
    const checked = statementChecks ? "✓ Every row adds up to the bank's closing balance, to the paisa. " : '';
    if (account && tally.gap) {
      // Checked on this account's own entries: other accounts and entries
      // typed in don't count, so a gap is this account's.
      const g = tally.gap;
      const label = accountLabel(account);
      if (g.direction === 'after') {
        return `${checked}${label} stands at ${formatAmount(parsedOpeningBalance! - g.amount)} in your wallet on ${showDay(g.from)}, but the bank opened this statement at ${formatAmount(parsedOpeningBalance!)}. ${amount(g.amount)} of this account's activity between ${showDay(g.from)} and ${showDay(g.to)} hasn't been imported: import that period's statement (any order works).`;
      }
      return `${checked}This statement ends ${showDay(g.from)} at ${formatAmount(tally.closing)}, and ${label}'s entries in your wallet resume ${showDay(g.to)} from ${formatAmount(tally.closing + g.amount)}. ${amount(g.amount)} in between hasn't been imported: import that statement (any order works).`;
    }
    const others = "That's expected if your wallet also tracks other accounts or cash.";
    if (tally.gap && tally.gap.direction === 'after') {
      return `${checked}Your wallet stands at ${formatAmount(parsedOpeningBalance! - tally.gap.amount)}, but this account opened the period at ${formatAmount(parsedOpeningBalance!)}. ${others} If it tracks only this account, ${amount(tally.gap.amount)} of activity between ${showDay(tally.gap.from)} and ${showDay(tally.gap.to)} hasn't been imported: import that period's statement (any order works).`;
    }
    if (tally.gap) {
      return `${checked}This statement ends ${showDay(tally.gap.from)} at ${formatAmount(tally.closing)}, and your records resume ${showDay(tally.gap.to)} from ${formatAmount(tally.closing + tally.gap.amount)}. ${others} If it tracks only this account, ${amount(tally.gap.amount)} in between hasn't been imported: import that statement (any order works).`;
    }
    const side = tally.diff > 0 ? 'higher' : 'lower';
    if (account) {
      const label = accountLabel(account);
      const why = legacy === 'same'
        ? " It counts the entries imported before 1.5.9 as this account's: if some are another account's, choose \"Another account\" above."
        : ' Check the rows left unticked, or import the statements on either side of this one.';
      return `${checked}On ${showDay(tally.endDate)}, ${label} will read ${amount(tally.diff)} ${side} in your wallet than the bank's closing balance.${why}`;
    }
    if (statementChecks) {
      // No gap, so the difference can't be a missing stretch of this account:
      // it's money in the wallet from outside this statement.
      return `${checked}On ${showDay(tally.endDate)} your wallet will be ${amount(tally.diff)} ${side} than this account, because it also holds money from outside this statement: other accounts, cash, or entries you added yourself.`;
    }
    return `Your wallet will be ${amount(tally.diff)} ${side} than the statement's closing on ${showDay(tally.endDate)}. ${others} If it tracks only this account, check unticked rows or try Flip types.`;
  };

  // A wallet from before 1.5.9 with statements from more than one bank:
  // importing each again gives every account its own opening balance.
  const reimportHint = useMemo(
    () => Object.keys(accounts).length === 0
      && new Set(importReceipts.map(r => r.bank ?? '')).size > 1
      && existingTransactions.some(t => t.id.startsWith('import-') && !t.account),
    [accounts, importReceipts, existingTransactions],
  );

  // Helper to update loading messages
  const updateProgress = (msg: string) => setLoadingMessage(msg);

  // Open edit modal for a transaction
  const openEditModal = (tx: Transaction, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent toggle selection
    setEditingTx({
      id: tx.id,
      merchant: tx.merchant || '',
      category: tx.category,
      amount: tx.amount,
      type: tx.type,
      date: tx.date,
    });
  };

  // Save edited transaction
  const saveEdit = () => {
    if (!editingTx) return;
    setExtractedData(prev => prev.map(t => 
      t.id === editingTx.id 
        ? { ...t, merchant: editingTx.merchant, category: editingTx.category, amount: editingTx.amount, type: editingTx.type, date: editingTx.date }
        : t
    ));
    setEditingTx(null);
  };

  // Cancel edit
  const cancelEdit = () => setEditingTx(null);
  useBackHandler(!!editingTx, cancelEdit);

  // Shared staging: map raw parser output -> validate -> detect duplicates ->
  // populate the review screen. Used by both Excel and PDF paths
  // (audit Phases 1.5 + 2.7 — was duplicated inline three times).
  const stageForReview = async (raw: StatementRow[], parserLabel: string) => {
      const mappedTransactions = await toTransactions(raw);
      setUnreadable(unreadableRows(raw));
      if (mappedTransactions.length === 0) {
          throw new Error('No transactions found in this statement. Check it lists transactions with dates and amounts.');
      }

      // Payments read from your apps aren't duplicates: the statement's row
      // takes the place of each (services/captured.ts).
      const foundDuplicates = findDuplicates(mappedTransactions, existingTransactions.filter(t => !isCaptured(t)));
      const standsFor = capturedRows(mappedTransactions.filter(t => !foundDuplicates.has(t.id)), existingTransactions);
      setReplacing(standsFor);
      // A row that takes an app entry's place keeps the category and note it
      // was given from here on: the review shows them, and a change made in
      // the review is the one that's saved.
      const stored = new Map(storedTransactions.map(t => [t.id, t]));
      const staged = mappedTransactions.map(t => {
          const entry = stored.get(standsFor.get(t.id) ?? '');
          return entry ? carryOver(t, entry) : t;
      });

      log.debug(`Import staged: ${staged.length} transactions, ${foundDuplicates.size} duplicates (${parserLabel})`);

      setParserUsed(parserLabel);
      setDuplicateIds(foundDuplicates);
      setExtractedData(staged);
      // Select all EXCEPT duplicates by default
      setSelectedIds(new Set(staged.filter(t => !foundDuplicates.has(t.id)).map(t => t.id)));
      setShowDuplicateInfo(foundDuplicates.size > 0);
      setReviewStep('balance');
      setStage('REVIEW');
  };

  // Remember the statement's opening/closing balances for the tally card and
  // for confirmImport. The context decides whether the opening actually
  // applies (it anchors to the earliest statement ever imported).
  const storeStatementMeta = (opening: number | undefined, closing: number | undefined) => {
      setParsedOpeningBalance(opening);
      setParsedClosingBalance(closing);
  };

  // PDF path: the bank's own layout where Wall-ette knows it (IDFC FIRST,
  // Kotak, Saraswat, Union Bank, SBI), else the generic reader.
  const processPdf = async (base64: string, password?: string) => {
    try {
        updateProgress('Parsing PDF statement...');
        const result = await parseStatementPdf(base64, password);
        setLocked(null);
        setPdfPassword('');

        if (result.transactions.length === 0) {
            throw new Error("Couldn't find transactions in this PDF. If your bank offers an Excel download, try that.");
        }

        // 0 is a real balance (a new account); unknown is undefined.
        storeStatementMeta(
            result.header.openingKnown ? result.header.openingBalance : undefined,
            result.header.closingKnown ? result.header.closingBalance : undefined
        );
        updateProgress(result.validationPassed
            ? `Verified ${result.transactions.length} transactions with balance validation ✓`
            : `Found ${result.transactions.length} transactions`);

        const bank = result.header.bankName;
        const known = bank && bank !== 'Generic (auto-detected)' ? bank : null;
        setSource({ bank: known, format: 'PDF' });
        setStatementAccount(known && result.header.accountLast4 ? { bank: known, last4: result.header.accountLast4 } : null);
        await stageForReview(result.transactions,
            bank === 'Generic (auto-detected)'
                ? 'Generic PDF parser (verify amounts)'
                : `${bank ?? 'Bank'} PDF${result.validationPassed ? ' · every row matches the balance' : ' (verify amounts)'}`);
    } catch (err: any) {
        if (err instanceof StatementLockedError) {
            // Ask for the PDF's password, then read it again.
            setLocked({ base64, wrong: err.wrong });
            setError(null);
            setStage('IDLE');
            return;
        }
        log.warn('PDF import failed:', err?.message);
        setError(err.message || "Could not parse the statement. Please ensure it's a valid bank statement.");
        setStage('IDLE');
    }
  };

  const unlockPdf = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!locked || !pdfPassword) return;
    setStage('PROCESSING');
    setError(null);
    await processPdf(locked.base64, pdfPassword);
  };

  // Excel path: enhanced IDFC parser (xlsx)
  const processExcel = async (file: File) => {
    try {
        updateProgress('Parsing Excel statement...');
        if (!file.arrayBuffer) throw new Error('File API arrayBuffer not supported in this environment.');

        const result = await IDFCBankParser.parseExcel(file);
        if (result.transactions.length === 0) {
            throw new Error('No transactions found in Excel file.');
        }

        storeStatementMeta(
            result.summary.openingKnown ? result.summary.openingBalance : undefined,
            result.summary.closingKnown ? result.summary.closingBalance : undefined
        );
        setSource({ bank: result.bank || null, format: 'Excel' });
        setStatementAccount(result.bank && result.account ? { bank: result.bank, last4: result.account } : null);
        await stageForReview(fromExcel(result.transactions),
            `${result.bank} Excel${!result.validation.isValid ? ' (verify amounts)' : result.balancesFrom === 'rows' ? ' · every row matches its balance' : ' · totals match the bank'}`);
    } catch (err: any) {
        log.warn('Excel import failed:', err?.message);
        setError('Failed to parse Excel file: ' + (err.message || 'Unknown error'));
        setStage('IDLE');
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) {
            setError('No file found in input!');
            return;
        }

        setStage('PROCESSING');
        setError(null);
        setLocked(null);
        setPdfPassword('');
        setExtractedData([]);
        setStatementAccount(null);
        setLegacyChoice(null);
        updateProgress('Reading file...');

        const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls')
            || file.type.includes('sheet') || file.type.includes('excel');

        if (isExcel) {
            await processExcel(file);
            return;
        }

        // PDF path — read as base64 for pdf.js
        try {
            const base64 = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => {
                    try {
                        const result = reader.result as string;
                        resolve(result.split(',')[1]);
                    } catch (readerErr) {
                        reject(readerErr);
                    }
                };
                reader.onerror = () => reject(new Error('Could not read the selected file.'));
                reader.readAsDataURL(file);
            });
            await processPdf(base64);
        } catch (err) {
            let errorMsg = 'Failed to read file: Unknown error';
            if (typeof err === 'string') errorMsg = err;
            else if (err && typeof err === 'object' && 'message' in err) {
                errorMsg = (err as { message?: string }).message || errorMsg;
            }
            setError(errorMsg);
            setStage('IDLE');
        }
  };

  const handleDropAreaClick = () => {
    if (stage === 'IDLE') {
        fileInputRef.current?.click();
    }
  };

  // Step 1: the format picked opens the file picker for it straight away.
  const chooseFormat = (f: 'PDF' | 'Excel') => {
    setFormat(f);
    setError(null);
    const input = fileInputRef.current;
    if (input) {
      input.accept = f === 'Excel' ? '.xlsx,.xls' : '.pdf';
      input.click();
    }
  };

  const toggleSelection = (id: string) => {
      const newSet = new Set(selectedIds);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      setSelectedIds(newSet);
  };

  const toggleAll = () => {
      if (selectedIds.size === extractedData.length) {
          setSelectedIds(new Set());
      } else {
          setSelectedIds(new Set(extractedData.map(t => t.id)));
      }
  };

  const confirmImport = () => {
      if (secondAccount) return;
      // Rows that take an app entry's place got its category and note when
      // staged (stageForReview); what the review shows is what's saved.
      const toImport = extractedData.filter(t => selectedIds.has(t.id));
      if (!reviewSummary || (toImport.length === 0 && !canUpdate)) return;

      // One adjustment entry that stands in for a missing statement window,
      // so the running balance matches the bank to the paisa.
      if (bridgeGap && tally?.gap) toImport.unshift(bridgeAdjustment(tally.gap));

      // Adjustments that stood in for a period this statement covers come out
      // in the same step, so its real rows don't count on top of them (with
      // the account known, only the account's own).
      const stale = tally
        ? tally.stale
        : staleAdjustments(accountView(wallet, account, { rows: extractedData, from: reviewSummary.minDate, to: reviewSummary.maxDate }).transactions, reviewSummary.minDate, reviewSummary.maxDate);

      log.debug(`Importing ${toImport.length} of ${extractedData.length} reviewed transactions, replacing ${stale.length} adjustment(s)`);
      // Opening balance + statement start let the context anchor each
      // account's balance to its earliest statement, so statements tally in
      // any order; every row read lets it mark the account's earlier entries.
      const result = importTransactions(toImport, {
          opening: parsedOpeningBalance,
          statementStart: reviewSummary.minDate,
          removeIds: [...stale, ...replaces],
          account,
          rowIds: extractedData.map(t => t.id),
      });

      // The receipt: what this import did, kept with the account's settings.
      const toReview = toImport
        .filter(t => t.type === TransactionType.EXPENSE && shownCategory(t, flowOf(t)) === TO_REVIEW)
        .reduce((sum, t) => sum + t.amount, 0);
      const done: ImportReceipt = {
          id: `receipt-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`}`,
          at: new Date().toISOString(),
          bank: source.bank,
          ...(statementAccount ? { last4: statementAccount.last4 } : {}),
          format: source.format,
          from: reviewSummary.minDate.slice(0, 10),
          to: reviewSummary.maxDate.slice(0, 10),
          rows: extractedData.length,
          added: result.added,
          duplicates: extractedData.filter(t => duplicateIds.has(t.id) && !selectedIds.has(t.id)).length,
          leftOut: extractedData.filter(t => !duplicateIds.has(t.id) && !selectedIds.has(t.id)).length,
          unreadable,
          replaced: Math.max(0, result.removed - replaces.length),
          bridged: !!(bridgeGap && tally?.gap),
          check: tally ? tallyToneOf(tally, bridgeGap) : null,
          ...(tally ? { closing: tally.closing, difference: tally.diff } : {}),
          ...(toReview > 0 ? { toReview: Math.round(toReview * 100) / 100 } : {}),
          ...(result.openingSet && accountPlan?.next ? { opening: accountPlan.next.opening } : {}),
          ...(result.retagged > 0 ? { marked: result.retagged } : {}),
          ...(replaces.length > 0 ? { fromApps: replaces.length } : {}),
      };
      saveImportReceipt(done);
      setReceipt(done);
      setImportedIds(new Set(toImport.map(t => t.id)));
      setStage('DONE');
      window.scrollTo(0, 0);
  }

  const handleDiscard = () => {
      setReceipt(null);
      setImportedIds(new Set());
      setUnreadable(0);
      setExtractedData([]);
      setSelectedIds(new Set());
      setParsedOpeningBalance(undefined);
      setParsedClosingBalance(undefined);
      setStatementAccount(null);
      setLegacyChoice(null);
      setBridgeGap(false);
      setStage('IDLE');
  }

  return (
    <div className="relative flex min-h-screen w-full flex-col max-w-[430px] md:max-w-2xl mx-auto overflow-x-hidden pb-24 bg-zen-bg">
      {/* Eco & Indian decorative elements */}
      <FloatingLeaf className="top-24 right-5 opacity-35" />
      <FloatingLeaf className="top-48 left-4 opacity-25" color="var(--sage-3)" />
      <Sprout className="absolute top-36 left-6 opacity-40" />
      <PottedPlant className="absolute bottom-32 right-6 opacity-35" />
      <RangoliCorner className="absolute top-20 right-2 opacity-20" color="var(--gold-1)" mirror />
      <Diya className="absolute bottom-40 left-8 opacity-30" />

      <div className="flex items-center gap-2 bg-zen-bg/85 backdrop-blur-md px-5 pt-6 pb-3 sticky top-0 z-30">
        <button
          onClick={() => onNavigate(AppScreen.DASHBOARD)}
          className="w-10 h-10 -ml-2 flex items-center justify-center rounded-full text-premium-charcoal hover:bg-white/70 transition-colors"
          aria-label="Back to Home"
        >
          <span className="material-symbols-outlined text-[24px]" aria-hidden="true">arrow_back</span>
        </button>
        <h2 className="text-premium-charcoal text-[22px] font-display font-bold tracking-tight leading-tight flex-1 truncate">Import a statement</h2>
      </div>

      <div className="flex flex-col px-6 py-6 flex-1">
        
        {stage === 'IDLE' && (
            <>
                {/* Import / Export slider (matches Data Studio) */}
                <div className="bg-white rounded-2xl p-1 flex shadow-sm border border-premium-charcoal/[0.08] mb-6">
                    <button
                        className="flex-1 py-2.5 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 bg-sage/10 text-sage shadow-sm"
                    >
                        <span className="material-symbols-outlined text-[16px]">download</span>
                        Import
                    </button>
                    <button
                        onClick={() => onNavigate(AppScreen.EXPORT)}
                        className="flex-1 py-2.5 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 text-muted-taupe hover:text-premium-charcoal"
                    >
                        <span className="material-symbols-outlined text-[16px]">upload</span>
                        Export
                    </button>
                </div>

                <ImportSteps current={format ? 1 : 0} />

                {!format ? (
                    <>
                        <h3 className="text-premium-charcoal text-lg font-display font-bold mb-1">Choose a supported format</h3>
                        <p className="text-muted-taupe text-[13px] leading-relaxed mb-5">
                            The statement your bank gives you, from IDFC FIRST, HDFC, SBI, Kotak, Union Bank, Saraswat Bank or Equitas. Processed on this device, without AI; the file is never uploaded.
                        </p>
                        <div className="space-y-3 mb-2">
                            {([
                                ['PDF', 'picture_as_pdf', 'PDF statement', "The one your bank emails or lets you download. Password-locked PDFs are fine. Other banks' PDFs often work too."],
                                ['Excel', 'table_view', 'Excel statement', 'An .xlsx or .xls file from your net banking.'],
                            ] as const).map(([f, icon, title, sub]) => (
                                <button
                                    key={f}
                                    onClick={() => chooseFormat(f)}
                                    className="w-full flex items-center gap-4 bg-white rounded-3xl px-5 py-4 text-left shadow-soft border border-black/[0.02] active:scale-[0.99] transition-transform"
                                >
                                    <span className="w-11 h-11 rounded-2xl bg-sage-light text-sage flex items-center justify-center shrink-0">
                                        <span className="material-symbols-outlined text-[22px]" aria-hidden="true">{icon}</span>
                                    </span>
                                    <span className="flex-1 min-w-0">
                                        <span className="block text-[15px] font-semibold text-premium-charcoal">{title}</span>
                                        <span className="block text-[12px] text-muted-taupe leading-snug mt-0.5">{sub}</span>
                                    </span>
                                    <span className="material-symbols-outlined text-[20px] text-muted-taupe" aria-hidden="true">chevron_right</span>
                                </button>
                            ))}
                        </div>
                    </>
                ) : (
                <>
                <div className="flex items-start justify-between gap-3 mb-6">
                    <div>
                        <h3 className="text-premium-charcoal text-lg font-display font-bold mb-1">Choose statement</h3>
                        <p className="text-muted-taupe text-[13px] leading-relaxed">
                            {format === 'PDF' ? 'A PDF statement from your bank.' : 'An Excel statement (.xlsx or .xls) from your bank.'} Processed on this device, without AI; the file is never uploaded.
                        </p>
                    </div>
                    <button onClick={() => setFormat(null)} className="shrink-0 text-[13px] font-semibold text-sage pt-1">Change format</button>
                </div>

                {reimportHint && (
                    <div className="mb-6 p-4 rounded-2xl bg-white/70 border border-sage/20 flex items-start gap-3">
                        <span className="material-symbols-outlined text-sage text-[20px] mt-0.5" aria-hidden="true">account_balance</span>
                        <p className="text-[12px] text-premium-charcoal leading-relaxed">
                            <b>Statements from more than one bank?</b> Wall·ette now keeps each account's own opening balance. Import each account's statement again so your balance counts every one. Rows already in your wallet aren't added twice.
                        </p>
                    </div>
                )}
                
                <div
                    onClick={handleDropAreaClick}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleDropAreaClick(); } }}
                    role="button"
                    tabIndex={0}
                    aria-label="Choose a statement file"
                    className={`relative w-full aspect-[4/3] rounded-4xl flex flex-col items-center justify-center gap-4 bg-white/30 border-2 border-dashed border-sage/20 hover:border-sage/40 transition-all active:scale-[0.98] cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage`}
                >
                    <Mascot pose="review" height={116} />
                    <div className="text-center px-6">
                        <p className="text-premium-charcoal font-display text-lg font-bold inline-flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-sage text-[20px]" aria-hidden="true">folder_open</span>
                            Choose statement
                        </p>
                        <p className="text-muted-taupe text-xs mt-1">{format === 'PDF' ? 'PDF' : 'Excel (.xlsx or .xls)'}</p>
                    </div>
                </div>

                {locked && (
                    <form onSubmit={unlockPdf} className="mt-6 p-4 bg-white/60 border border-sage/20 rounded-2xl animate-slide-up">
                        <p className="text-premium-charcoal text-sm font-semibold flex items-center gap-2">
                            <span className="material-symbols-outlined text-sage text-[18px]">lock</span>
                            This PDF is locked
                        </p>
                        <p className="text-muted-taupe text-xs mt-1 leading-relaxed">
                            {locked.wrong
                                ? "That password didn't open it. The email the statement came with usually says what to use, often your customer ID or date of birth."
                                : 'Enter the password your bank set for it. Wall-ette uses it only to open this file and never saves it.'}
                        </p>
                        <div className="flex gap-2 mt-3">
                            <input
                                type="password"
                                autoComplete="off"
                                value={pdfPassword}
                                onChange={e => setPdfPassword(e.target.value)}
                                className="flex-1 min-w-0 bg-zen-bg rounded-xl px-4 py-2.5 text-premium-charcoal text-sm outline-none focus:ring-1 focus:ring-sage"
                                placeholder="PDF password"
                                aria-label="PDF password"
                                autoFocus
                            />
                            <button
                                type="submit"
                                disabled={!pdfPassword}
                                className="px-4 py-2.5 rounded-xl bg-sage text-white text-sm font-semibold disabled:opacity-50"
                            >
                                Open
                            </button>
                        </div>
                    </form>
                )}

                </>
                )}

                <input
                    ref={fileInputRef}
                    accept={format === 'Excel' ? '.xlsx,.xls' : format === 'PDF' ? '.pdf' : '.pdf,.xlsx,.xls'}
                    className="hidden"
                    type="file"
                    onChange={handleFileSelect}
                    title="Choose a bank statement file"
                    aria-label="Choose a bank statement file"
                />

                {error && (
                    <div className="mt-6 p-4 bg-rose-light/30 border border-rose/20 rounded-2xl flex gap-3 items-center animate-slide-up">
                        <span className="material-symbols-outlined text-rose">error</span>
                        <p className="text-rose text-xs font-medium">{error}</p>
                    </div>
                )}

                {/* What earlier imports did */}
                {importReceipts.length > 0 && (
                    <section className="mt-8" aria-labelledby="recent-imports">
                        <h3 id="recent-imports" className="text-muted-taupe text-[11px] font-bold uppercase tracking-[0.2em] mb-3 pl-1">Recent imports</h3>
                        <div className="space-y-3">
                            {importReceipts.slice(0, 3).map(r => <ReceiptCard key={r.id} receipt={r} money={formatAmount} showWhen />)}
                        </div>
                    </section>
                )}
            </>
        )}

        {stage === 'DONE' && receipt && (
            <div className="space-y-6 animate-slide-up">
                <ImportSteps current={4} />
                <ReceiptCard receipt={receipt} money={formatAmount} heading={receipt.added > 0 ? 'Imported' : receipt.opening !== undefined ? 'Opening balance set' : receipt.marked ? 'Entries updated' : 'Nothing new to add'} />

                {/* The payments this statement leaves to review */}
                {toReviewAfter.length > 0 && (
                    <section aria-labelledby="review-title">
                        <h3 id="review-title" className="font-display text-[20px] font-bold text-premium-charcoal px-1">What were these payments?</h3>
                        <p className="text-muted-taupe text-[13px] leading-relaxed mt-1 mb-4 px-1">
                            {toReviewAfter.length === 1 ? 'One payee' : `${toReviewAfter.length} payees`} in this statement {toReviewAfter.length === 1 ? 'is a transfer' : 'are transfers'} Wall-ette can't name. They count as spending until you say what they were; your answer covers every payment to that payee, now and in later statements.
                        </p>
                        <ReviewPayees onlyIds={importedIds} first={5} />
                    </section>
                )}

                <div className="flex gap-3">
                    <button
                        onClick={() => onNavigate(AppScreen.DASHBOARD)}
                        className="flex-1 bg-sage text-white font-semibold py-3.5 rounded-full shadow-soft active:scale-[0.99] transition-transform"
                    >
                        Done
                    </button>
                    <button
                        onClick={handleDiscard}
                        className="flex-1 bg-white text-sage border border-sage/30 font-semibold py-3.5 rounded-full shadow-soft active:scale-[0.99] transition-transform"
                    >
                        Import another
                    </button>
                </div>
            </div>
        )}

        {stage === 'PROCESSING' && (
            <div className="flex flex-col items-center justify-center flex-1 h-[60vh] animate-slide-up">
                <div className="w-full self-stretch"><ImportSteps current={1} /></div>
                <div className="mb-7">
                    <Mascot pose="review" height={148} className="animate-pulse motion-reduce:animate-none" />
                </div>
                <h3 className="text-xl font-display font-bold text-premium-charcoal mb-2">{loadingMessage}</h3>
                <p className="text-muted-taupe text-xs">Processed on this device. The file is never uploaded.</p>
                <div className="mt-5 h-6 w-6 rounded-full border-[3px] border-sage/20 border-t-sage animate-spin" aria-hidden="true" />
            </div>
        )}

        {stage === 'REVIEW' && (
            <div className="flex flex-col h-full animate-slide-up">
                <ImportSteps current={reviewStep === 'balance' ? 2 : 3} />
                {reviewStep === 'balance' ? (
                <>
                <div className="flex items-start justify-between gap-3 mb-4">
                    <div>
                        <h3 className="text-premium-charcoal text-lg font-display font-bold">Review the balance check</h3>
                        <p className="text-muted-taupe text-[13px] leading-relaxed mt-1">Whether the statement adds up, and what importing it does to your balance. Categories come next.</p>
                    </div>
                    <button onClick={handleDiscard} className="shrink-0 text-rose text-[13px] font-semibold pt-1">Discard</button>
                </div>
                <div className="mb-4"><StatusLine label="Balance check" tone={balanceStatus.tone} text={balanceStatus.text} /></div>
                {secondAccount && <div className="mb-4"><PlanLock reason="second-account" compact /></div>}
                {!secondAccount && olderRows > 0 && (
                    <p className="mb-4 text-xs text-premium-charcoal leading-relaxed p-3 rounded-2xl bg-sand-light/70" role="status">
                        {olderRows === 1 ? 'One row is' : `${olderRows} rows are`} from before Essential's 12 months. {olderRows === 1 ? 'It is' : 'They are'} saved read-only; Plus keeps your full history editable.
                    </p>
                )}
                {/* Rows for payments read from your apps: the row takes the entry's place */}
                {replaces.length > 0 && (
                    <div className="mb-4 p-4 rounded-2xl bg-ocean-light/60 border border-ocean/20 animate-slide-up" role="status">
                        <div className="flex items-start gap-3">
                            <span className="material-symbols-outlined text-ocean text-[20px] mt-0.5" aria-hidden="true">bolt</span>
                            <p className="flex-1 text-xs text-premium-charcoal leading-relaxed">
                                {replaces.length === 1 ? 'One row is a payment' : `${replaces.length} rows are payments`} Wall-ette read from your apps.
                                Importing puts the statement's {replaces.length === 1 ? 'row' : 'rows'} in {replaces.length === 1 ? 'its' : 'their'} place, keeping the categories and notes you gave {replaces.length === 1 ? 'it' : 'them'}, so nothing counts twice.
                            </p>
                        </div>
                    </div>
                )}
                {/* Duplicate detection notification */}
                {showDuplicateInfo && duplicateIds.size > 0 && (
                    <div className="mb-4 p-4 rounded-2xl bg-blue-50 border border-blue-200 animate-slide-up">
                        <div className="flex items-start gap-3">
                            <span className="material-symbols-outlined text-blue-600 text-[20px] mt-0.5">content_copy</span>
                            <div className="flex-1">
                                <p className="text-sm font-semibold text-blue-900 mb-1">
                                    {duplicateIds.size} Duplicate{duplicateIds.size > 1 ? 's' : ''} Detected
                                </p>
                                <p className="text-xs text-blue-700 leading-relaxed">
                                    These are already in your wallet: same date and amount, and the same bank reference (or payee, where the bank gives none). They've been deselected so nothing counts twice.
                                </p>
                                <div className="flex items-center gap-3 mt-3">
                                    <button
                                        onClick={() => {
                                            // One tap here once silently double-counted six weeks of
                                            // data — make the consequence explicit first.
                                            let dupNet = 0;
                                            for (const t of extractedData) {
                                                if (!duplicateIds.has(t.id)) continue;
                                                dupNet += t.type === TransactionType.INCOME ? t.amount : -t.amount;
                                            }
                                            const ok = window.confirm(
                                                `These ${duplicateIds.size} entries already exist in your wallet. ` +
                                                `Including them AGAIN will double-count them and shift your balance by ` +
                                                `${formatAmount(Math.abs(dupNet))}. Only do this if you're sure they are ` +
                                                `genuinely separate transactions.\n\nInclude them anyway?`
                                            );
                                            if (!ok) return;
                                            const newSelected = new Set(selectedIds);
                                            duplicateIds.forEach(id => newSelected.add(id));
                                            setSelectedIds(newSelected);
                                        }}
                                        className="text-[10px] font-bold uppercase tracking-wider text-blue-600 hover:text-blue-800"
                                    >
                                        Include anyway
                                    </button>
                                    <button
                                        onClick={() => setShowDuplicateInfo(false)}
                                        className="text-[10px] font-bold uppercase tracking-wider text-blue-400 hover:text-blue-600"
                                    >
                                        Dismiss
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                
                {unreadable > 0 && (
                    <div role="alert" className="mb-4 p-4 rounded-2xl caution border flex items-start gap-3">
                        <span className="material-symbols-outlined caution-mark text-[20px] mt-0.5" aria-hidden="true">warning</span>
                        <p className="text-xs caution-ink leading-relaxed">
                            <b>{unreadable} row{unreadable > 1 ? 's' : ''} couldn't be read</b> (no date or no debit/credit side), so {unreadable > 1 ? "they aren't" : "it isn't"} in the list below. The balance check shows what that leaves out. Try your bank's Excel download for this period, or add {unreadable > 1 ? 'them' : 'it'} in New entry.
                        </p>
                    </div>
                )}

                {/* The statement's account, and what the import does to it */}
                {statementAccount && (
                    <div className="mb-4 p-4 rounded-2xl bg-white/70 border border-sage/20 animate-slide-up">
                        <p className="text-[13px] font-semibold text-premium-charcoal flex items-center gap-2">
                            <span className="material-symbols-outlined text-sage text-[18px]" aria-hidden="true">account_balance</span>
                            {accountLabel(statementAccount)}
                        </p>
                        {!legacySuggestion && <p className="text-[12px] text-muted-taupe mt-1 leading-relaxed">{accountNote()}</p>}
                        {legacySuggestion && (
                            <fieldset className="mt-3">
                                <legend className="text-[12px] text-premium-charcoal leading-relaxed mt-1">
                                    Your wallet has an opening balance of {formatAmount(unassignedOpening)}{openingBalanceAsOf ? ` from ${showDay(openingBalanceAsOf)}` : ''}, saved before Wall·ette told accounts apart. Is it this account's?
                                </legend>
                                <div className="mt-2 grid grid-cols-2 gap-2">
                                    {(['same', 'separate'] as const).map(v => (
                                        <label
                                            key={v}
                                            className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[12px] font-semibold cursor-pointer border transition-colors focus-within:ring-2 focus-within:ring-sage ${
                                                legacy === v ? 'bg-sage text-white border-sage' : 'bg-white text-premium-charcoal border-sage/20'
                                            }`}
                                        >
                                            <input
                                                type="radio"
                                                name="legacy-opening"
                                                value={v}
                                                checked={legacy === v}
                                                onChange={() => setLegacyChoice(v)}
                                                className="sr-only"
                                            />
                                            {v === 'same' ? 'This account' : 'Another account'}
                                        </label>
                                    ))}
                                </div>
                                <p className="text-[12px] text-muted-taupe mt-2 leading-relaxed">{accountNote()}</p>
                            </fieldset>
                        )}
                    </div>
                )}

                {/* Balance tally — statement closing vs wallet after import */}
                {tally && (
                    <div className={`mb-4 p-4 rounded-2xl border animate-slide-up ${
                        tallyTone === 'ok' ? 'bg-sage-light/30 border-sage/20'
                        : tallyTone === 'note' ? 'bg-white/70 border-sage/20'
                        : 'caution'
                    }`}>
                        <div className="flex items-center gap-2 mb-3">
                            <span className={`material-symbols-outlined text-[18px] ${
                                tallyTone === 'off' ? 'caution-mark' : 'text-sage'
                            }`} aria-hidden="true">
                                {tallyTone === 'off' ? 'error' : 'task_alt'}
                            </span>
                            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-taupe">Balance check</p>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <p className="text-[10px] text-muted-taupe uppercase tracking-wider">Statement closing</p>
                                <p className="text-[15px] font-semibold text-premium-charcoal tabular-nums">{formatAmount(tally.closing)}</p>
                            </div>
                            <span className="material-symbols-outlined text-muted-taupe/40 text-[18px]">arrow_forward</span>
                            <div className="text-right">
                                <p className="text-[10px] text-muted-taupe uppercase tracking-wider">
                                    {account
                                        ? (tally.hasNewer ? `This account on ${showDay(tally.endDate)}` : 'This account after import')
                                        : (tally.hasNewer ? `Wallet on ${showDay(tally.endDate)}` : 'Wallet after import')}
                                </p>
                                <p className={`text-[15px] font-semibold tabular-nums ${
                                    tallyTone === 'ok' ? 'text-sage' : tallyTone === 'note' ? 'text-premium-charcoal' : 'caution-ink'
                                }`}>{formatAmount(tally.projected)}</p>
                            </div>
                        </div>
                        <p className={`text-[10px] mt-3 leading-relaxed ${
                            tallyTone === 'ok' ? 'text-sage' : tallyTone === 'note' ? 'text-zen-charcoal' : 'caution-ink'
                        }`}>
                            {tallyMessage()}
                        </p>
                        {tally.gap && (
                            <label className={`mt-3 flex items-start gap-2.5 p-3 rounded-xl bg-white/70 border cursor-pointer ${
                                tallyTone === 'off' ? 'border-[color:var(--amber-2)]' : 'border-sage/20'
                            }`}>
                                <input
                                    type="checkbox"
                                    checked={bridgeGap}
                                    onChange={e => setBridgeGap(e.target.checked)}
                                    className="mt-0.5 w-4 h-4 accent-[var(--sage)] shrink-0"
                                />
                                <span className="text-[10px] leading-relaxed text-premium-charcoal">
                                    {account
                                        ? <><b>Can't get that statement?</b> Add one {tally.gap.amount >= 0 ? 'income' : 'expense'} adjustment of {formatAmount(Math.abs(tally.gap.amount))} so this account's balance matches the bank.</>
                                        : <><b>Tracking only this account, and can't get that statement?</b> Add one {tally.gap.amount >= 0 ? 'income' : 'expense'} adjustment of {formatAmount(Math.abs(tally.gap.amount))} so your balance matches the bank. Leave this off if your wallet also holds other accounts or cash.</>}
                                </span>
                            </label>
                        )}
                    </div>
                )}

                {/* What the statement holds */}
                <div className="mb-4 p-4 rounded-2xl bg-white/70 border border-black/[0.04]">
                        {reviewSummary && (
                            <div className="text-[12px] text-muted-taupe space-y-1">
                                <p>💰 Income: {formatAmount(reviewSummary.incomeSum)}</p>
                                <p>💸 Expense: {formatAmount(reviewSummary.expenseSum)}</p>
                                <p>📅 Covers: {showDay(reviewSummary.minDate)} to {showDay(reviewSummary.maxDate)}</p>
                                {parsedOpeningBalance !== undefined && (
                                    <p>🏦 Opens {formatAmount(parsedOpeningBalance)}{parsedClosingBalance !== undefined ? ` → closes ${formatAmount(parsedClosingBalance)}` : ''}</p>
                                )}
                                {duplicateIds.size > 0 && (
                                    <p className="text-blue-500">🔄 Duplicates: {duplicateIds.size} (auto-skipped)</p>
                                )}
                                {parserUsed && (
                                    <p className="text-sage font-semibold">✨ Parser: {parserUsed}</p>
                                )}
                            </div>
                        )}
                </div>
                </>
                ) : (
                <>
                <div className="mb-4 space-y-2">
                    <StatusLine label="Categories" tone={categoryStatus.tone} text={categoryStatus.text} />
                    <StatusLine label="Balance check" tone={balanceStatus.tone} text={balanceStatus.text}
                        action={<button onClick={() => setReviewStep('balance')} className="shrink-0 text-[12px] font-semibold text-sage">Review</button>} />
                </div>
                <div className="flex justify-between items-end mb-6 px-2">
                    <div>
                        <h3 className="text-premium-charcoal text-lg font-display font-bold">Review categories</h3>
                        <p className="text-muted-taupe text-xs mt-1">
                            {selectedIds.size} of {extractedData.length} rows ticked to import. Tap a row to change its category.
                        </p>
                    </div>
                    <button onClick={handleDiscard} className="text-rose text-[13px] font-semibold pb-1">Discard</button>
                </div>
                <div className="flex items-center justify-between mb-4 px-2">
                     <div className="flex items-center gap-4">
                         <button 
                            onClick={toggleAll}
                            className="text-[10px] font-bold uppercase tracking-wider text-sage hover:text-sage/80"
                         >
                            {selectedIds.size === extractedData.length ? 'Deselect All' : 'Select All'}
                         </button>
                         <button 
                            onClick={flipAllTypes}
                            className="text-[10px] font-bold uppercase tracking-wider text-blue-500 hover:text-blue-600 flex items-center gap-1"
                            title="If balance looks wrong, flip Income/Expense types"
                         >
                            <span className="material-symbols-outlined text-[12px]">swap_vert</span>
                            Flip types
                         </button>
                     </div>
                     
                     {/* Pagination indicator */}
                     {totalPages > 1 && (
                         <span className="text-[10px] text-muted-taupe">
                             Page {currentPage} of {totalPages}
                         </span>
                     )}
                </div>

                <div className="space-y-3 pb-40">
                    {paginatedData.map((t) => {
                        const isDuplicate = duplicateIds.has(t.id);
                        return (
                        <div 
                            key={t.id} 
                            onClick={() => toggleSelection(t.id)}
                            className={`p-4 rounded-3xl border flex items-center justify-between transition-all cursor-pointer relative ${
                                isDuplicate 
                                    ? (selectedIds.has(t.id) ? 'bg-blue-50 border-blue-300 shadow-soft' : 'bg-blue-50/50 border-blue-200 opacity-70')
                                    : (selectedIds.has(t.id) ? 'bg-white border-sage/30 shadow-soft' : 'bg-gray-50 border-transparent opacity-60')
                            }`}
                        >
                            {/* Duplicate badge */}
                            {isDuplicate && (
                                <div className="absolute -top-2 -right-2 bg-blue-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider shadow-sm">
                                    Duplicate
                                </div>
                            )}
                            
                            <div className="flex items-center gap-3 overflow-hidden">
                                <div className={`shrink-0 w-6 h-6 rounded-full border flex items-center justify-center transition-colors ${
                                    selectedIds.has(t.id) 
                                        ? (isDuplicate ? 'bg-blue-500 border-blue-500' : 'bg-sage border-sage')
                                        : 'bg-transparent border-gray-300'
                                }`}>
                                    {selectedIds.has(t.id) && <span className="material-symbols-outlined text-white text-[14px]">check</span>}
                                </div>
                                
                                <div className={`shrink-0 w-10 h-10 rounded-2xl flex items-center justify-center ${t.type === TransactionType.EXPENSE ? 'bg-rose-light text-rose' : 'bg-sage-light text-sage'}`}>
                                    <span className="material-symbols-outlined text-[20px]">
                                        {t.type === TransactionType.EXPENSE ? 'arrow_downward' : 'arrow_upward'}
                                    </span>
                                </div>
                                <div className="min-w-0">
                                    <p className="text-premium-charcoal font-semibold text-[14px] truncate">{t.merchant}</p>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] bg-gray-100 text-muted-taupe px-2 py-0.5 rounded-full uppercase tracking-wide">{t.category}</span>
                                        <span className="text-[10px] text-muted-taupe">{t.date}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                <button
                                    onClick={(e) => openEditModal(t, e)}
                                    className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
                                    title="Edit transaction"
                                >
                                    <span className="material-symbols-outlined text-[16px] text-muted-taupe">edit</span>
                                </button>
                                <div className="text-right">
                                    <p className={`font-semibold tabular-nums ${t.type === TransactionType.EXPENSE ? 'text-rose' : 'text-sage'}`}>
                                        {t.type === TransactionType.EXPENSE ? '-' : '+'}₹{t.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )})}
                </div>

                </>
                )}

                {/* Edit Modal */}
                {editingTx && (
                    <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-[100]" onClick={cancelEdit}>
                        <div 
                            className="bg-white w-full max-w-[430px] rounded-t-[32px] px-6 pt-6 pb-[calc(1.5rem_+_var(--sab))] animate-slide-up"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-lg font-display font-bold text-premium-charcoal">Edit transaction</h3>
                                <button onClick={cancelEdit} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                                    <span className="material-symbols-outlined text-muted-taupe">close</span>
                                </button>
                            </div>
                            
                            {/* Merchant Name */}
                            <div className="mb-4">
                                <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-taupe mb-2">Merchant</label>
                                <input
                                    type="text"
                                    value={editingTx.merchant}
                                    onChange={e => setEditingTx({...editingTx, merchant: e.target.value})}
                                    className="w-full px-4 py-3 rounded-2xl border border-gray-200 bg-gray-50 text-premium-charcoal font-medium focus:outline-none focus:border-sage"
                                    placeholder="Merchant name"
                                    title="Merchant name"
                                    aria-label="Merchant name"
                                />
                            </div>
                            
                            {/* Amount */}
                            <div className="mb-4">
                                <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-taupe mb-2">Amount</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-taupe">₹</span>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={editingTx.amount}
                                        onChange={e => setEditingTx({...editingTx, amount: Math.round(Math.abs(parseFloat(e.target.value) || 0) * 100) / 100})}
                                        className="w-full pl-8 pr-4 py-3 rounded-2xl border border-gray-200 bg-gray-50 text-premium-charcoal font-medium focus:outline-none focus:border-sage"
                                        placeholder="Amount"
                                        title="Amount"
                                        aria-label="Amount"
                                    />
                                </div>
                            </div>
                            
                            {/* Type Toggle */}
                            <div className="mb-4">
                                <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-taupe mb-2">Type</label>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setEditingTx({...editingTx, type: TransactionType.EXPENSE})}
                                        className={`flex-1 py-3 rounded-2xl font-semibold transition-all ${editingTx.type === TransactionType.EXPENSE ? 'bg-rose text-white' : 'bg-gray-100 text-muted-taupe'}`}
                                    >
                                        Expense
                                    </button>
                                    <button
                                        onClick={() => setEditingTx({...editingTx, type: TransactionType.INCOME})}
                                        className={`flex-1 py-3 rounded-2xl font-semibold transition-all ${editingTx.type === TransactionType.INCOME ? 'bg-sage text-white' : 'bg-gray-100 text-muted-taupe'}`}
                                    >
                                        Income
                                    </button>
                                </div>
                            </div>
                            
                            {/* Category Dropdown */}
                            <div className="mb-4">
                                <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-taupe mb-2">Category</label>
                                                                <select
                                                                        value={editingTx.category}
                                                                        onChange={e => setEditingTx({...editingTx, category: e.target.value})}
                                                                        className={styles.categorySelect}
                                                                        title="Category"
                                                                        aria-label="Category"
                                                                >
                                    {categoryOptions(editingTx.category).map(cat => (
                                        <option key={cat} value={cat}>{cat}</option>
                                    ))}
                                </select>
                            </div>
                            
                            {/* Date */}
                            <div className="mb-6">
                                <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-taupe mb-2">Date</label>
                                <input
                                    type="date"
                                    value={editingTx.date}
                                    onChange={e => setEditingTx({...editingTx, date: e.target.value})}
                                    className="w-full px-4 py-3 rounded-2xl border border-gray-200 bg-gray-50 text-premium-charcoal font-medium focus:outline-none focus:border-sage"
                                    placeholder="Date"
                                    title="Date"
                                    aria-label="Date"
                                />
                            </div>
                            
                            {/* Save Button */}
                            <button
                                onClick={saveEdit}
                                className="w-full bg-sage text-white font-semibold py-4 rounded-[24px] shadow-soft active:scale-[0.99] transition-transform flex items-center justify-center gap-2"
                            >
                                <span className="material-symbols-outlined text-[20px]" aria-hidden="true">check</span>
                                Save changes
                            </button>
                        </div>
                    </div>
                )}

                {/* The page shows solid behind the pager and the button, fading
                    out only above them, so rows scrolling underneath don't
                    show through between the page numbers. */}
                <div className="fixed bottom-0 left-0 right-0 lg:left-[240px] px-6 pt-10 pb-[calc(1.5rem_+_var(--sab))] bg-gradient-to-t from-zen-bg via-zen-bg via-75% to-transparent z-50 max-w-[430px] md:max-w-2xl mx-auto">
                    {/* Pagination controls */}
                    {reviewStep === 'categories' && totalPages > 1 && (
                        <div className="flex items-center justify-center gap-3 mb-4">
                            <button
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="w-10 h-10 rounded-full bg-white border border-gray-200 flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
                            >
                                <span className="material-symbols-outlined text-[18px] text-premium-charcoal">chevron_left</span>
                            </button>
                            
                            <div className="flex items-center gap-1">
                                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                    let pageNum: number;
                                    if (totalPages <= 5) {
                                        pageNum = i + 1;
                                    } else if (currentPage <= 3) {
                                        pageNum = i + 1;
                                    } else if (currentPage >= totalPages - 2) {
                                        pageNum = totalPages - 4 + i;
                                    } else {
                                        pageNum = currentPage - 2 + i;
                                    }
                                    return (
                                        <button
                                            key={pageNum}
                                            onClick={() => setCurrentPage(pageNum)}
                                            className={`w-8 h-8 rounded-full text-sm font-semibold transition-all ${currentPage === pageNum ? 'bg-sage text-white' : 'bg-white text-muted-taupe hover:bg-gray-100'}`}
                                        >
                                            {pageNum}
                                        </button>
                                    );
                                })}
                            </div>
                            
                            <button
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                                className="w-10 h-10 rounded-full bg-white border border-gray-200 flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
                            >
                                <span className="material-symbols-outlined text-[18px] text-premium-charcoal">chevron_right</span>
                            </button>
                        </div>
                    )}
                    
                    {reviewStep === 'balance' ? (
                    <button
                        onClick={() => { setReviewStep('categories'); window.scrollTo(0, 0); }}
                        disabled={secondAccount}
                        className="w-full bg-sage text-white font-semibold py-4 rounded-[24px] shadow-soft active:scale-[0.99] transition-transform flex items-center justify-center gap-2 hover:bg-sage/90 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Continue to categories
                        <span className="material-symbols-outlined text-[20px]" aria-hidden="true">arrow_forward</span>
                    </button>
                    ) : (
                    <button 
                        onClick={confirmImport}
                        disabled={nothingToAdd && !canUpdate}
                        className="w-full bg-sage text-white font-semibold py-4 rounded-[24px] shadow-soft active:scale-[0.99] transition-transform flex items-center justify-center gap-2 hover:bg-sage/90 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <span className="material-symbols-outlined text-[20px]" aria-hidden="true">check</span>
                        {!nothingToAdd
                            ? `Import ${selectedIds.size} Transactions`
                            : accountPlan?.next
                                ? "Set this account's opening balance"
                                : canUpdate
                                    ? `Mark ${accountPlan!.marks} ${accountPlan!.marks === 1 ? 'entry' : 'entries'} as this account's`
                                    : 'Import 0 Transactions'}
                    </button>
                    )}
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

export default ImportStatement;
