import React, { useState, useRef, useEffect, useMemo } from 'react';
// XLSX is only pulled in via IDFCBankParser, which lives in this lazy chunk.
import { AppScreen, Transaction, TransactionType, CATEGORIES } from '../types';
import { parseIDFCStatement } from '../services/idfcParser';
import IDFCBankParser from '../services/IDFCBankParser';
import { getSymbol } from '../currencyUtils';
import { useWallet } from '../context/WalletContext';
import { log } from '../utils/log';
import { WallEEyes, FloatingLeaf, Sprout, RangoliCorner, PottedPlant, Diya } from './SplashScreen';
import styles from './ImportStatement.module.css';

// Pagination settings
const ITEMS_PER_PAGE = 20;

interface ImportStatementProps {
    onNavigate: (screen: AppScreen) => void;
}

interface EditingTransaction {
    id: string;
    merchant: string;
    category: string;
    amount: number;
    type: TransactionType;
    date: string;
}

// Normalize merchant name for comparison
const normalizeMerchant = (merchant: string): string => {
    return merchant
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '') // Remove special chars
        .replace(/\d+/g, '')       // Remove numbers (transaction IDs, etc.)
        .trim();
};

// Fuzzy merchant equivalence (same rules as before: containment, shared
// 6-char prefix for UPI ids, or exact normalized match).
const merchantsMatch = (a: string, b: string): boolean => {
    if (a.length > 3 && b.length > 3) {
        if (a.includes(b) || b.includes(a)) return true;
        if (a.substring(0, 6) === b.substring(0, 6)) return true;
    }
    return a === b;
};

interface DupCandidate { amount: number; merchant: string | null; used: boolean } // merchant pre-normalized

// Index existing transactions by `date|type` so duplicate detection is
// O(new × bucket) instead of O(new × all existing), with each merchant
// normalized exactly once (audit Phase 2.7).
const buildDuplicateIndex = (existing: Transaction[]): Map<string, DupCandidate[]> => {
    const index = new Map<string, DupCandidate[]>();
    for (const t of existing) {
        const key = `${t.date}|${t.type}`;
        let bucket = index.get(key);
        if (!bucket) { bucket = []; index.set(key, bucket); }
        bucket.push({ amount: t.amount, merchant: t.merchant ? normalizeMerchant(t.merchant) : null, used: false });
    }
    return index;
};

// COUNT-AWARE matching: each existing transaction can absorb exactly ONE
// incoming duplicate. If a statement has two legit ₹249 payments and the
// wallet only has one, the second stays selected instead of being lost.
// Exact-merchant matches are claimed before fuzzy ones.
const claimDuplicate = (tx: Transaction, index: Map<string, DupCandidate[]>): boolean => {
    const bucket = index.get(`${tx.date}|${tx.type}`);
    if (!bucket) return false;
    const txMerchant = normalizeMerchant(tx.merchant || '');
    // Pass 1: exact normalized-merchant match
    for (const cand of bucket) {
        if (cand.used || Math.abs(tx.amount - cand.amount) > 0.01) continue;
        if (cand.merchant !== null && cand.merchant === txMerchant) {
            cand.used = true;
            return true;
        }
    }
    // Pass 2: fuzzy (containment / shared prefix) or merchant-less existing rows
    for (const cand of bucket) {
        if (cand.used || Math.abs(tx.amount - cand.amount) > 0.01) continue;
        if (cand.merchant === null || merchantsMatch(txMerchant, cand.merchant)) {
            cand.used = true;
            return true;
        }
    }
    return false;
};

// Validate raw parser output and map to the app's Transaction shape with a
// stable content hash id. Shared by the Excel and PDF paths (was duplicated 3x).
const mapRawToTransactions = (rawTransactions: any[]): Transaction[] => {
    const valid: Transaction[] = [];
    rawTransactions.forEach((t: any, index: number) => {
        if (!t.date || !t.amount || !t.type || !t.merchant) return;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(t.date)) return;
        if (typeof t.amount !== 'number' || t.amount <= 0) return;
        if (t.type !== 'INCOME' && t.type !== 'EXPENSE') return;

        const cleanMerchant = (t.merchant || 'unknown').replace(/[^a-zA-Z0-9\s]/g, '').toLowerCase();
        const idString = `${t.date}-${t.amount}-${cleanMerchant}-${t.type}-${index}`;
        let hash = 0;
        for (let i = 0; i < idString.length; i++) {
            const char = idString.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        valid.push({
            id: `import-${Math.abs(hash)}`,
            date: t.date,
            merchant: t.merchant.trim(),
            amount: Math.abs(t.amount),
            type: t.type === 'INCOME' ? TransactionType.INCOME : TransactionType.EXPENSE,
            category: t.category?.trim() || 'Uncategorized',
            note: t.note?.trim() || ''
        });
    });
    return valid;
};

const ImportStatement: React.FC<ImportStatementProps> = ({ onNavigate }) => {
  const {
      currency, importTransactions, transactions: existingTransactions,
      getBalance, openingBalance, openingBalanceAsOf, formatAmount, deleteTransaction
  } = useWallet();

  // Stages: IDLE (Upload), PROCESSING (AI Loading), REVIEW (Selection)
  const [stage, setStage] = useState<'IDLE' | 'PROCESSING' | 'REVIEW'>('IDLE');
  const [loadingMessage, setLoadingMessage] = useState('Initializing...');
  
  const [extractedData, setExtractedData] = useState<Transaction[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [duplicateIds, setDuplicateIds] = useState<Set<string>>(new Set());
  const [showDuplicateInfo, setShowDuplicateInfo] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [parsedOpeningBalance, setParsedOpeningBalance] = useState<number | undefined>(undefined);
  const [parsedClosingBalance, setParsedClosingBalance] = useState<number | undefined>(undefined);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Edit modal state
  const [editingTx, setEditingTx] = useState<EditingTransaction | null>(null);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);

  // Bridge a detected coverage gap with a single adjustment entry
  const [bridgeGap, setBridgeGap] = useState(false);
  
  // Parser tracking
  const [parserUsed, setParserUsed] = useState<string>('');

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
  // Projects the wallet balance after this import and compares it with the
  // statement's own closing balance. Only meaningful when this statement is
  // the newest data in the wallet — older back-fills show an info note instead.
  const tally = useMemo(() => {
    if (parsedClosingBalance === undefined || !reviewSummary) return null;

    let selectedNet = 0;
    for (const t of extractedData) {
      if (!selectedIds.has(t.id)) continue;
      selectedNet += t.type === TransactionType.INCOME ? t.amount : -t.amount;
    }

    // Mirror the context's opening-balance anchoring to predict the new opening.
    let openingDelta = 0;
    if (parsedOpeningBalance !== undefined) {
      let applies = false;
      if (existingTransactions.length === 0) {
        applies = true;
      } else if (openingBalanceAsOf) {
        applies = reviewSummary.minDate < openingBalanceAsOf;
      } else {
        const earliest = existingTransactions.reduce(
          (m, t) => (t.date < m ? t.date : m), existingTransactions[0].date);
        applies = reviewSummary.minDate <= earliest;
      }
      if (applies) openingDelta = parsedOpeningBalance - openingBalance;
    }

    // Sorted desc in context — [0] is latest, [len-1] is earliest.
    const latestExisting = existingTransactions.length > 0 ? existingTransactions[0].date : null;
    const earliestExisting = existingTransactions.length > 0
      ? existingTransactions[existingTransactions.length - 1].date : null;
    const isNewest = !latestExisting || reviewSummary.maxDate >= latestExisting;

    // Coverage-gap detection — works whichever order statements arrive in:
    //  • importing a LATER period: its opening should equal the wallet's
    //    current balance; a difference = un-imported months in between.
    //  • importing an EARLIER period: its closing should equal the wallet's
    //    opening anchor; a difference = a hole between this statement's end
    //    and where the wallet's records resume.
    let gap: { amount: number; from: string; to: string; at: string; direction: 'after' | 'before' } | null = null;
    if (
      parsedOpeningBalance !== undefined &&
      latestExisting &&
      reviewSummary.minDate > latestExisting.slice(0, 10)
    ) {
      const gapAmount = parsedOpeningBalance - getBalance();
      if (Math.abs(gapAmount) > 1) {
        gap = { amount: gapAmount, from: latestExisting.slice(0, 10), to: reviewSummary.minDate, at: reviewSummary.minDate, direction: 'after' };
      }
    } else if (
      parsedClosingBalance !== undefined &&
      earliestExisting &&
      reviewSummary.maxDate < earliestExisting.slice(0, 10) &&
      openingBalanceAsOf
    ) {
      const gapAmount = openingBalance - parsedClosingBalance;
      if (Math.abs(gapAmount) > 1) {
        gap = { amount: gapAmount, from: reviewSummary.maxDate, to: openingBalanceAsOf.slice(0, 10), at: reviewSummary.maxDate, direction: 'before' };
      }
    }

    const bridge = bridgeGap && gap ? gap.amount : 0;
    const projectedFinal = getBalance() + selectedNet + openingDelta + bridge;

    // The bank's closing figure only knows about money up to the statement's
    // last day — so the honest check is the wallet balance AS OF that day.
    // Existing transactions dated later are excluded from the comparison
    // (but still part of the final balance). This makes the check exact for
    // overlapping statements and any import order.
    let futureNet = 0;
    for (const t of existingTransactions) {
      if (t.date.slice(0, 10) > reviewSummary.maxDate) {
        futureNet += t.type === TransactionType.INCOME ? t.amount : -t.amount;
      }
    }
    const projectedAtEnd = projectedFinal - futureNet;
    const diff = projectedAtEnd - parsedClosingBalance;

    return {
      projected: projectedAtEnd,
      projectedFinal,
      hasNewer: futureNet !== 0,
      endDate: reviewSummary.maxDate,
      closing: parsedClosingBalance,
      diff,
      matched: Math.abs(diff) <= 1,
      isNewest,
      gap,
    };
  }, [parsedClosingBalance, parsedOpeningBalance, reviewSummary, extractedData, selectedIds,
      existingTransactions, openingBalanceAsOf, openingBalance, getBalance, bridgeGap]);

  // Card tone: gap (bridged → ok), tallied, or off.
  const tallyBridged = !!(tally?.gap && bridgeGap && tally.matched);
  const tallyTone: 'ok' | 'gap' | 'off' | null =
    !tally ? null
    : tally.gap ? (tallyBridged ? 'ok' : 'gap')
    : tally.matched ? 'ok'
    : 'off';

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

  // Shared staging: map raw parser output -> validate -> detect duplicates ->
  // populate the review screen. Used by both Excel and PDF paths
  // (audit Phases 1.5 + 2.7 — was duplicated inline three times).
  const stageForReview = (raw: any[], parserLabel: string) => {
      const mappedTransactions = mapRawToTransactions(raw);
      if (mappedTransactions.length === 0) {
          throw new Error('No valid transactions found. Please ensure the file is a clear IDFC bank statement.');
      }

      const dupIndex = buildDuplicateIndex(existingTransactions);
      const foundDuplicates = new Set<string>();
      for (const tx of mappedTransactions) {
          if (claimDuplicate(tx, dupIndex)) foundDuplicates.add(tx.id);
      }

      log.debug(`Import staged: ${mappedTransactions.length} transactions, ${foundDuplicates.size} duplicates (${parserLabel})`);

      setParserUsed(parserLabel);
      setDuplicateIds(foundDuplicates);
      setExtractedData(mappedTransactions);
      // Select all EXCEPT duplicates by default
      setSelectedIds(new Set(mappedTransactions.filter(t => !foundDuplicates.has(t.id)).map(t => t.id)));
      setShowDuplicateInfo(foundDuplicates.size > 0);
      setStage('REVIEW');
  };

  // Remember the statement's opening/closing balances for the tally card and
  // for confirmImport. The context decides whether the opening actually
  // applies (it anchors to the earliest statement ever imported).
  const storeStatementMeta = (opening: number | undefined, closing: number | undefined) => {
      setParsedOpeningBalance(opening);
      setParsedClosingBalance(closing);
  };

  // PDF path: rule-based IDFC parser only (audit Phase 1.5 — previously the
  // Excel parser was attempted against the PDF bytes first, a guaranteed throw).
  const processPdf = async (base64: string) => {
    try {
        updateProgress('Parsing PDF statement...');
        const result = await parseIDFCStatement(base64);

        if (result.transactions.length === 0) {
            throw new Error('Could not parse this statement. Try uploading a clear PDF or Excel file from your IDFC bank statement.');
        }

        storeStatementMeta(
            result.header.openingBalance || undefined,
            result.header.closingBalance || undefined
        );
        updateProgress(result.validationPassed
            ? `Verified ${result.transactions.length} transactions with balance validation ✓`
            : `Found ${result.transactions.length} transactions`);

        stageForReview(result.transactions,
            result.header.bankName === 'Generic (auto-detected)'
                ? 'Generic PDF parser (verify amounts)'
                : 'Rule-based PDF parser');
    } catch (err: any) {
        log.warn('PDF import failed:', err?.message);
        setError(err.message || "Could not parse the statement. Please ensure it's a valid bank statement.");
        setStage('IDLE');
    }
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

        storeStatementMeta(result.summary.openingBalance, result.summary.closingBalance || undefined);

        // Convert parser output to the shared raw shape
        const raw = result.transactions.map((t: any) => ({
            date: t.date,
            merchant: (t.description || 'Unknown').substring(0, 100),
            amount: t.amount,
            type: t.type?.toUpperCase() === 'INCOME' ? 'INCOME' : 'EXPENSE',
            category: t.category,
            note: t.notes || t.description
        }));

        stageForReview(raw, 'Enhanced IDFC parser (Excel)');
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
        setExtractedData([]);
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
      const toImport = extractedData.filter(t => selectedIds.has(t.id));
      if (toImport.length === 0) return;

      // One adjustment entry that stands in for a missing statement window,
      // so the running balance matches the bank to the rupee.
      if (bridgeGap && tally?.gap) {
          const g = tally.gap;
          toImport.unshift({
              id: `adjust-${g.from}-${g.to}-${Math.round(Math.abs(g.amount) * 100)}`,
              date: g.at,
              merchant: 'Balance adjustment — missing statement period',
              amount: Math.abs(g.amount),
              type: g.amount >= 0 ? TransactionType.INCOME : TransactionType.EXPENSE,
              category: 'Adjustment',
              note: `Bridges un-imported period ${g.from} → ${g.to}. Delete this if you import that statement later.`
          });
      }

      // Stale bridge adjustments: this statement now covers a window an
      // earlier adjustment entry was standing in for — remove those so the
      // real rows don't double-count on top of the placeholder.
      if (reviewSummary) {
          const stale = existingTransactions.filter(t =>
              t.id.startsWith('adjust-') &&
              t.date.slice(0, 10) >= reviewSummary.minDate &&
              t.date.slice(0, 10) <= reviewSummary.maxDate
          );
          for (const t of stale) deleteTransaction(t.id);
          if (stale.length > 0) log.debug(`Removed ${stale.length} stale bridge adjustment(s)`);
      }

      log.debug(`Importing ${toImport.length} of ${extractedData.length} reviewed transactions`);
      // Opening balance + statement start let the context anchor the balance
      // to the earliest statement, so multi-statement imports always tally.
      importTransactions(toImport, parsedOpeningBalance, reviewSummary?.minDate);
      onNavigate(AppScreen.DASHBOARD);
  }

  const handleDiscard = () => {
      setExtractedData([]);
      setSelectedIds(new Set());
      setParsedOpeningBalance(undefined);
      setParsedClosingBalance(undefined);
      setBridgeGap(false);
      setStage('IDLE');
  }

  return (
    <div className="relative flex min-h-screen w-full flex-col max-w-[430px] mx-auto overflow-x-hidden pb-24 bg-zen-bg">
      {/* Eco & Indian decorative elements */}
      <FloatingLeaf className="top-24 right-5 opacity-35" delay={0.5} />
      <FloatingLeaf className="top-48 left-4 opacity-25" delay={1.8} color="#A8B89E" />
      <Sprout className="absolute top-36 left-6 opacity-40" />
      <PottedPlant className="absolute bottom-32 right-6 opacity-35" />
      <RangoliCorner className="absolute top-20 right-2 opacity-20" color="#C4A98E" mirror />
      <Diya className="absolute bottom-40 left-8 opacity-30" />
      
      <div className="flex items-center bg-zen-bg/80 backdrop-blur-md p-6 pb-2 justify-between sticky top-0 z-30">
        <button 
          onClick={() => onNavigate(AppScreen.DASHBOARD)}
          className="text-muted-taupe flex size-10 shrink-0 items-center justify-start hover:text-sage transition-colors"
        >
          <span className="material-symbols-outlined text-[24px]">chevron_left</span>
        </button>
        <h2 className="text-premium-charcoal text-xl font-serif font-semibold tracking-tight flex-1 text-center">Import Statement</h2>
        <div className="flex w-10 items-center justify-end text-muted-taupe">
          <button className="flex items-center justify-center rounded-full h-10 w-10 bg-white/50 border border-black/5 hover:bg-white transition-colors">
            <span className="material-symbols-outlined text-[20px]">help_outline</span>
          </button>
        </div>
      </div>

      <div className="flex flex-col px-6 py-6 flex-1">
        
        {stage === 'IDLE' && (
            <>
                {/* Import / Export slider (matches Data Studio) */}
                <div className="bg-white rounded-2xl p-1 flex shadow-sm border border-black/5 mb-6">
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

                <p className="text-muted-taupe text-[13px] font-medium leading-relaxed mb-8 text-center px-4">
                Upload your IDFC bank statement (PDF or Excel). Fast, rule-based parsing without AI.
                </p>
                
                <div 
                    onClick={handleDropAreaClick}
                    className={`relative w-full aspect-[4/3] rounded-4xl flex flex-col items-center justify-center gap-4 bg-white/30 border-2 border-dashed border-sage/20 hover:border-sage/40 transition-all active:scale-[0.98] cursor-pointer`}
                >
                    {/* Wall-ette Upload Helper */}
                    <div className="relative">
                      <div className="w-20 h-20 rounded-full bg-gradient-to-br from-sage to-sage/80 flex items-center justify-center shadow-lg">
                        <WallEEyes size="md" />
                      </div>
                      {/* Upload arrow */}
                      <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-white shadow-md flex items-center justify-center border-2 border-sage-light">
                        <span className="material-symbols-outlined text-sage text-[18px]">upload</span>
                      </div>
                    </div>
                    <div className="text-center px-6">
                        <p className="text-premium-charcoal font-serif text-lg font-semibold">Tap to Upload</p>
                        <p className="text-muted-taupe text-xs mt-1">Excel (.xlsx/.xls) or PDF</p>
                        <p className="text-[10px] text-muted-taupe/60 mt-2 italic">"Let me analyze your finances!"</p>
                    </div>
                    <input
                        ref={fileInputRef}
                        accept=".pdf,.xlsx,.xls"
                        className="hidden"
                        type="file"
                        onChange={handleFileSelect}
                        title="Upload bank statement file"
                        aria-label="Upload bank statement file"
                    />
                </div>

                {error && (
                    <div className="mt-6 p-4 bg-rose-light/30 border border-rose/20 rounded-2xl flex gap-3 items-center animate-slide-up">
                        <span className="material-symbols-outlined text-rose">error</span>
                        <p className="text-rose text-xs font-medium">{error}</p>
                    </div>
                )}
            </>
        )}

        {stage === 'PROCESSING' && (
            <div className="flex flex-col items-center justify-center flex-1 h-[60vh] animate-slide-up">
                {/* Wall-ette Processing Animation */}
                <div className="relative mb-8">
                    {/* Outer spinning ring */}
                    <div className="absolute inset-0 w-28 h-28 border-4 border-sage-light rounded-full"></div>
                    <div className="absolute inset-0 w-28 h-28 border-4 border-sage rounded-full border-t-transparent animate-spin"></div>
                    
                    {/* Wall-ette face in center */}
                    <div className="w-28 h-28 rounded-full bg-gradient-to-br from-sage to-sage/80 flex items-center justify-center shadow-xl">
                      <WallEEyes size="lg" animate={true} />
                    </div>
                    
                    {/* Sparkles */}
                    <div className="absolute -top-2 -right-2 text-lg animate-pulse">✨</div>
                    <div className="absolute -bottom-1 -left-3 text-sm animate-pulse animation-delay-03s">✨</div>
                </div>
                <h3 className="text-xl font-serif font-semibold text-premium-charcoal mb-2">{loadingMessage}</h3>
                <p className="text-muted-taupe text-xs animate-pulse">Wall-ette is analyzing your document</p>
                <p className="text-[10px] text-muted-taupe/50 mt-3 italic">"Processing... beep boop!"</p>
            </div>
        )}

        {stage === 'REVIEW' && (
            <div className="flex flex-col h-full animate-slide-up">
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
                                    These transactions already exist in your wallet (same date, amount & merchant). They've been auto-deselected to prevent double-counting.
                                </p>
                                <div className="flex items-center gap-3 mt-3">
                                    <button
                                        onClick={() => {
                                            // Select all duplicates
                                            const newSelected = new Set(selectedIds);
                                            duplicateIds.forEach(id => newSelected.add(id));
                                            setSelectedIds(newSelected);
                                        }}
                                        className="text-[10px] font-bold uppercase tracking-wider text-blue-600 hover:text-blue-800"
                                    >
                                        Include Anyway
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
                
                {/* Balance tally — statement closing vs wallet after import */}
                {tally && (
                    <div className={`mb-4 p-4 rounded-2xl border animate-slide-up ${
                        tallyTone === 'ok' ? 'bg-sage-light/30 border-sage/20' : 'bg-amber-50 border-amber-200'
                    }`}>
                        <div className="flex items-center gap-2 mb-3">
                            <span className={`material-symbols-outlined text-[18px] ${
                                tallyTone === 'ok' ? 'text-sage' : 'text-amber-600'
                            }`}>
                                {tallyTone === 'ok' ? 'task_alt' : 'error'}
                            </span>
                            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-taupe">Balance Check</p>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <p className="text-[10px] text-muted-taupe uppercase tracking-wider">Statement closing</p>
                                <p className="text-[15px] font-serif font-bold text-premium-charcoal">{formatAmount(tally.closing)}</p>
                            </div>
                            <span className="material-symbols-outlined text-muted-taupe/40 text-[18px]">arrow_forward</span>
                            <div className="text-right">
                                <p className="text-[10px] text-muted-taupe uppercase tracking-wider">
                                    {tally.hasNewer ? `Wallet on ${tally.endDate}` : 'Wallet after import'}
                                </p>
                                <p className={`text-[15px] font-serif font-bold ${
                                    tallyTone === 'ok' ? 'text-sage' : 'text-amber-600'
                                }`}>{formatAmount(tally.projected)}</p>
                            </div>
                        </div>
                        <p className={`text-[10px] mt-3 leading-relaxed ${
                            tallyTone === 'ok' ? 'text-sage' : 'text-amber-700'
                        }`}>
                            {tallyTone === 'ok' && tallyBridged
                                ? '✓ Bridged — with the adjustment entry, your balance will match the bank.'
                                : tallyTone === 'ok' && tally.hasNewer
                                ? `✓ Tallies with the bank as of ${tally.endDate}. Final balance after import: ${formatAmount(tally.projectedFinal)}.`
                                : tallyTone === 'ok'
                                ? '✓ Tallies with the statement. Your balance will be accurate after import.'
                                : tally.gap && tally.gap.direction === 'after'
                                ? `The bank says this period started at ${formatAmount(parsedOpeningBalance!)}, but your wallet stands at ${formatAmount(getBalance())}. ${formatAmount(Math.abs(tally.gap.amount))} of activity between ${tally.gap.from} and ${tally.gap.to} hasn't been imported. Best fix: download that period's statement from your bank and import it (any order works).`
                                : tally.gap
                                ? `This statement ends ${tally.gap.from} at ${formatAmount(tally.closing)}, but your records resume ${tally.gap.to} from an opening of ${formatAmount(openingBalance)}. ${formatAmount(Math.abs(tally.gap.amount))} in between hasn't been imported — grab the statement covering that window (any order works).`
                                : `Off by ${formatAmount(Math.abs(tally.diff))} as of ${tally.endDate}. Check deselected rows, try Flip Types — or your bank may have posted transactions after this statement was downloaded.`}
                        </p>
                        {tally.gap && (
                            <label className="mt-3 flex items-start gap-2.5 p-3 rounded-xl bg-white/70 border border-amber-200 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={bridgeGap}
                                    onChange={e => setBridgeGap(e.target.checked)}
                                    className="mt-0.5 w-4 h-4 accent-[#9BAE93] shrink-0"
                                />
                                <span className="text-[10px] leading-relaxed text-premium-charcoal">
                                    <b>Can't get that statement?</b> Add a single {tally.gap.amount >= 0 ? 'income' : 'expense'} adjustment of {formatAmount(Math.abs(tally.gap.amount))} to bridge the gap so your balance matches the bank.
                                </span>
                            </label>
                        )}
                    </div>
                )}

                <div className="flex justify-between items-end mb-6 px-2">
                    <div>
                        <h3 className="text-premium-charcoal text-lg font-serif font-semibold">Review Transactions</h3>
                        <p className="text-muted-taupe text-xs mt-1">
                            {selectedIds.size} of {extractedData.length} selected
                            {duplicateIds.size > 0 && (
                                <span className="text-blue-500 ml-1">({duplicateIds.size} duplicates)</span>
                            )}
                        </p>
                        {reviewSummary && (
                            <div className="text-[10px] text-muted-taupe mt-2 space-y-0.5">
                                <p>💰 Income: {formatAmount(reviewSummary.incomeSum)}</p>
                                <p>💸 Expense: {formatAmount(reviewSummary.expenseSum)}</p>
                                <p>📅 Covers: {reviewSummary.minDate} to {reviewSummary.maxDate}</p>
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
                    <button 
                        onClick={handleDiscard}
                        className="text-rose text-xs font-bold uppercase tracking-widest border-b border-rose/30 pb-1"
                    >
                        Discard
                    </button>
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
                            Flip Types
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
                                <div className="absolute -top-2 -right-2 bg-blue-500 text-white text-[8px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider shadow-sm">
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
                                    <p className="text-premium-charcoal font-serif font-semibold text-[14px] truncate">{t.merchant}</p>
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
                                    <p className={`font-serif font-bold ${t.type === TransactionType.EXPENSE ? 'text-rose' : 'text-sage'}`}>
                                        {t.type === TransactionType.EXPENSE ? '-' : '+'}{getSymbol(currency)}{t.amount.toFixed(2)}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )})}
                </div>

                {/* Edit Modal */}
                {editingTx && (
                    <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-[100]" onClick={cancelEdit}>
                        <div 
                            className="bg-white w-full max-w-[430px] rounded-t-[32px] p-6 animate-slide-up"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-lg font-serif font-semibold text-premium-charcoal">Edit Transaction</h3>
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
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-taupe">{getSymbol(currency)}</span>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={editingTx.amount}
                                        onChange={e => setEditingTx({...editingTx, amount: Math.abs(parseFloat(e.target.value) || 0)})}
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
                                    {CATEGORIES.map(cat => (
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
                                className="w-full bg-sage text-white font-serif font-semibold py-4 rounded-[24px] shadow-soft active:scale-[0.99] transition-transform flex items-center justify-center gap-2"
                            >
                                <span className="material-symbols-outlined text-[20px]">check</span>
                                Save Changes
                            </button>
                        </div>
                    </div>
                )}

                <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-zen-bg via-zen-bg to-transparent z-50 max-w-[430px] mx-auto">
                    {/* Pagination controls */}
                    {totalPages > 1 && (
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
                    
                    <button 
                        onClick={confirmImport}
                        disabled={selectedIds.size === 0}
                        className="w-full bg-sage text-white font-serif font-semibold py-4 rounded-[24px] shadow-soft active:scale-[0.99] transition-transform flex items-center justify-center gap-2 hover:bg-sage/90 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <span className="material-symbols-outlined text-[20px]">check</span>
                        Import {selectedIds.size} Transactions
                    </button>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};


export default ImportStatement;
