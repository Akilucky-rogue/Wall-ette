// ...imports...

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
import React, { useState, useRef, useEffect, useMemo } from 'react';
// Removed static import of XLSX to optimize initial load time
// import * as XLSX from 'xlsx'; 
import { AppScreen, Transaction, TransactionType } from '../types';
import { parseIDFCStatement } from '../services/idfcParser';
import IDFCBankParser from '../services/IDFCBankParser';
import { getSymbol } from '../currencyUtils';
import { useWallet } from '../context/WalletContext';
import { WallEEyes, FloatingLeaf, Sprout, RangoliCorner, PottedPlant, Diya } from './SplashScreen';
import styles from './ImportStatement.module.css';

// Comprehensive category list for better classification
const CATEGORIES = [
    'Groceries', 'Dining', 'Food Delivery', 'Coffee',
    'Transport', 'Fuel', 'Parking', 'Taxi', 'Metro', 'Flights',
    'Shopping', 'Electronics', 'Clothing', 'Furniture',
    'Entertainment', 'Movies', 'Streaming', 'Games',
    'Utilities', 'Electricity', 'Water', 'Gas', 'Internet', 'Phone',
    'Healthcare', 'Pharmacy', 'Doctor', 'Insurance',
    'Education', 'Books', 'Courses',
    'Bills', 'Rent', 'EMI', 'Loan', 'Credit Card',
    'Salary', 'Freelance', 'Bonus', 'Investment', 'Dividend', 'Interest',
    'Transfer', 'Cash', 'ATM',
    'Subscriptions', 'Gym', 'Charity',
    'Travel', 'Hotel', 'Vacation',
        'Personal Care', 'Beauty',
        'Pets', 'Gifts',
        'Other', 'Uncategorized'
];

// Check if two transactions are likely duplicates
const isDuplicateTransaction = (
  newTx: { date: string; amount: number; merchant?: string; type: TransactionType },
  existingTx: { date: string; amount: number; merchant?: string; type: TransactionType }
): boolean => {
  // Must match: same date, same amount, same type
  if (newTx.date !== existingTx.date) return false;
  if (Math.abs(newTx.amount - existingTx.amount) > 0.01) return false; // Allow tiny floating point diff
  if (newTx.type !== existingTx.type) return false;
  
  // Merchant comparison (fuzzy match)
    if (existingTx.merchant) {
        const newMerchant = normalizeMerchant(newTx.merchant || '');
        const existingMerchant = normalizeMerchant(existingTx.merchant);
    
    // Check if one contains the other or they're similar
    if (newMerchant.length > 3 && existingMerchant.length > 3) {
      if (newMerchant.includes(existingMerchant) || existingMerchant.includes(newMerchant)) {
        return true;
      }
      // Check first 6 chars match (for UPI IDs etc.)
      if (newMerchant.substring(0, 6) === existingMerchant.substring(0, 6)) {
        return true;
      }
    }
    // Exact match after normalization
    return newMerchant === existingMerchant;
  }
  
  // If no merchant in existing, just match date/amount/type
  return true;
};

const ImportStatement: React.FC<ImportStatementProps> = ({ onNavigate }) => {
  const { currency, importTransactions, transactions: existingTransactions, setOpeningBalance } = useWallet();
  
  // Helper: Convert category to transaction nature
  const getTransactionNature = (category: string, type: string): string => {
    const cat = category.toLowerCase();
    
    if (type === 'income') {
      if (cat.includes('salary')) return 'SALARY';
      if (cat.includes('investment') || cat.includes('interest') || cat.includes('dividend')) return 'INVESTMENT_RETURN';
      if (cat.includes('refund')) return 'REFUND';
      if (cat.includes('transfer')) return 'TRANSFER';
      return 'PASSIVE_INCOME';
    }
    
    if (cat.includes('cash') || cat.includes('atm')) return 'CASH_OUT';
    if (cat.includes('transfer')) return 'TRANSFER';
    if (cat.includes('investment')) return 'INVESTMENT_OUTFLOW';
    
    return 'CONSUMPTION';
  };
  
  // Stages: IDLE (Upload), PROCESSING (AI Loading), REVIEW (Selection)
  const [stage, setStage] = useState<'IDLE' | 'PROCESSING' | 'REVIEW'>('IDLE');
  const [loadingMessage, setLoadingMessage] = useState('Initializing...');
  
  const [extractedData, setExtractedData] = useState<Transaction[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [duplicateIds, setDuplicateIds] = useState<Set<string>>(new Set());
  const [showDuplicateInfo, setShowDuplicateInfo] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [parsedOpeningBalance, setParsedOpeningBalance] = useState<number | undefined>(undefined);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Edit modal state
  const [editingTx, setEditingTx] = useState<EditingTransaction | null>(null);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  
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

  // Reset page when data changes
  useEffect(() => {
    setCurrentPage(1);
  }, [extractedData]);

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

  // Map raw transactions to internal Transaction type
    const mapRawToTransactions = (rawTransactions: any[]): Transaction[] => {
        const valid: Transaction[] = [];
        rawTransactions.forEach((t: any, index: number) => {
            let reason = '';
            if (!t.date || !t.amount || !t.type || !t.merchant) reason = 'Missing required field';
            else if (!/^\d{4}-\d{2}-\d{2}$/.test(t.date)) reason = `Invalid date format: ${t.date}`;
            else if (typeof t.amount !== 'number' || t.amount <= 0) reason = `Invalid amount: ${t.amount}`;
            else if (t.type !== 'INCOME' && t.type !== 'EXPENSE') reason = `Invalid type: ${t.type}`;
            if (reason) {
                // Log skipped transaction and reason
                // eslint-disable-next-line no-console
                console.warn('[IMPORT] Skipped transaction:', { ...t, index }, 'Reason:', reason);
                return;
            }
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

  const processTransactions = async (data: string, mimeType: string, rawText?: string) => {
    try {
        console.log('📤 processTransactions called');
        console.log('   File ref available:', !!fileInputRef.current?.files?.[0]);
        console.log('   File name:', fileInputRef.current?.files?.[0]?.name);
        console.log('   File size:', fileInputRef.current?.files?.[0]?.size);
        console.log('   MimeType param:', mimeType);
        
        // ═══════════════════════════════════════════════════════════════
        // PARSING PRIORITY (RULE-BASED ONLY):
        // 1. IDFCBankParser (Excel/CSV + PDF)
        // 2. idfcParser (PDF + validation)
        // ═══════════════════════════════════════════════════════════════
        
        let rawTransactions: any[] = [];
        let parserUsed = '';
        
        // TRY 1: IDFC BANK PARSER (EXCEL/CSV/PDF WITH ENHANCED FEATURES)
        if (fileInputRef.current?.files?.[0]) {
            try {
                console.log('🏦 Trying IDFCBankParser (Excel/CSV/PDF)...');
                updateProgress("Parsing with enhanced IDFC parser...");
                
                const file = fileInputRef.current.files[0];
                const result = await IDFCBankParser.parseExcel(file);
                
                if (result.transactions.length > 0) {
                    console.log(`✅ IDFCBankParser succeeded: ${result.transactions.length} transactions`);
                    console.log(`   Validation: ${result.validation.isValid ? '✅ PASSED' : '⚠️ WARNINGS'}`);
                    console.log(`   Summary: ${result.summary.customerName} (${result.summary.accountNumber})`);
                    
                    if (result.validation.errors.length > 0) {
                        console.warn('   Errors:', result.validation.errors);
                    }
                    if (result.validation.warnings.length > 0) {
                        console.warn('   Warnings:', result.validation.warnings);
                    }
                    
                    // Convert to app format
                    rawTransactions = result.transactions.map((t: any) => ({
                        date: t.date,
                        merchant: t.description.substring(0, 100),
                        amount: t.amount,
                        type: t.type.toUpperCase() === 'INCOME' ? 'INCOME' : 'EXPENSE',
                        category: t.category,
                        note: t.notes || t.description
                    }));
                    
                    parserUsed = '🏦 Enhanced IDFC Parser';
                    setParserUsed(parserUsed);
                    
                    updateProgress(`✅ ${rawTransactions.length} transactions (${result.summary.customerName})`);
                    
                    // Store opening balance for later use in confirmImport
                    console.log('🔍 Opening balance check - Existing transactions:', existingTransactions.length, 'Statement opening:', result.summary.openingBalance);
                    if (result.summary.openingBalance !== undefined && existingTransactions.length === 0) {
                        console.log('💰 Storing opening balance for import:', result.summary.openingBalance);
                        setParsedOpeningBalance(result.summary.openingBalance);
                        console.log('💰 Opening balance stored in state');
                    } else if (existingTransactions.length > 0) {
                        console.log('📝 Skipping opening balance (preserving existing - already have', existingTransactions.length, 'transactions)');
                    } else {
                        console.warn('⚠️ Opening balance undefined in parsed result:', result.summary);
                    }
                }
            } catch (bankParserError: any) {
                console.error('❌ IDFCBankParser failed:', bankParserError);
                console.error('   Error message:', bankParserError.message);
                console.error('   Stack:', bankParserError.stack);
            }
        }
        
        // TRY 2: IDFC RULE-BASED PARSER (PDF VALIDATION FALLBACK)
        if (rawTransactions.length === 0 && mimeType.includes('pdf')) {
            try {
                console.log('🏦 Trying IDFC rule-based parser (validation)...');
                updateProgress("Validating with rule-based parser...");
                
                const result = await parseIDFCStatement(data);
                
                if (result.transactions.length > 0) {
                    console.log(`✅ Rule-based parser succeeded: ${result.transactions.length} transactions`);
                    console.log(`   Balance validation: ${result.validationPassed ? '✅ PASSED' : '⚠️ WARNINGS'}`);
                    
                    rawTransactions = result.transactions;
                    parserUsed = '🏦 Rule-based (Validation)';
                    setParserUsed(parserUsed);
                    
                    if (result.validationPassed) {
                        updateProgress(`Verified ${rawTransactions.length} with balance validation ✓`);
                    }
                }
            } catch (idfcError: any) {
                console.error('❌ Rule-based parser failed:', idfcError);
                console.error('   Error message:', idfcError.message);
            }
        }
        
        if (!rawTransactions || rawTransactions.length === 0) {
            throw new Error("Could not parse this statement. Try uploading a clear PDF or Excel file from your IDFC bank statement.");
        }
        
        console.log(`✅ Parsed using: ${parserUsed}`);
        updateProgress(`Found ${rawTransactions.length} transactions using ${parserUsed}`);

        // Map to internal Transaction type (validation already done in parsers)
        const mappedTransactions: Transaction[] = rawTransactions
            .filter((t: any) => {
                // Final validation check
                if (!t.date || !t.amount || !t.type || !t.merchant) return false;
                if (!/^\d{4}-\d{2}-\d{2}$/.test(t.date)) return false;
                if (typeof t.amount !== 'number' || t.amount <= 0) return false;
                if (t.type !== 'INCOME' && t.type !== 'EXPENSE') return false;
                return true;
            })
            .map((t: any, index: number) => {
                const cleanMerchant = (t.merchant || 'unknown').replace(/[^a-zA-Z0-9\s]/g, '').toLowerCase();
                const idString = `${t.date}-${t.amount}-${cleanMerchant}-${t.type}-${index}`;
                
                let hash = 0;
                for (let i = 0; i < idString.length; i++) {
                    const char = idString.charCodeAt(i);
                    hash = ((hash << 5) - hash) + char;
                    hash = hash & hash;
                }
                const uniqueId = `import-${Math.abs(hash)}`;

                return {
                    id: uniqueId,
                    date: t.date,
                    merchant: t.merchant.trim(),
                    amount: Math.abs(t.amount),
                    type: t.type === 'INCOME' ? TransactionType.INCOME : TransactionType.EXPENSE,
                    category: t.category?.trim() || 'Uncategorized',
                    note: t.note?.trim() || ''
                };
            });

        if (mappedTransactions.length === 0) {
            throw new Error("No valid transactions found. Please ensure the PDF is a clear bank statement.");
        }

        console.log(`✅ Imported ${mappedTransactions.length} transactions (${mappedTransactions.filter(t => t.type === TransactionType.INCOME).length} income, ${mappedTransactions.filter(t => t.type === TransactionType.EXPENSE).length} expense)`);
        
        // Detect duplicates against existing transactions
        const foundDuplicates = new Set<string>();
        mappedTransactions.forEach(newTx => {
          const isDupe = existingTransactions.some(existingTx => 
            isDuplicateTransaction(newTx, existingTx)
          );
          if (isDupe) {
            foundDuplicates.add(newTx.id);
          }
        });
        
        console.log(`🔍 Found ${foundDuplicates.size} potential duplicates`);
        setDuplicateIds(foundDuplicates);
        
        setExtractedData(mappedTransactions);
        // Select all EXCEPT duplicates by default
        const nonDuplicateIds = new Set(mappedTransactions.filter(t => !foundDuplicates.has(t.id)).map(t => t.id));
        setSelectedIds(nonDuplicateIds);
        setShowDuplicateInfo(foundDuplicates.size > 0);
        setStage('REVIEW');
    } catch (err: any) {
        console.error('Import error:', err);
        setError(err.message || "Could not parse the statement. Please ensure it's a valid bank statement.");
        setStage('IDLE');
        console.error(err);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        console.log('🎯 handleFileSelect triggered');
        console.log('   File detected:', !!file);
        console.log('   File name:', file?.name);
        console.log('   File size:', file?.size);
        console.log('   File type:', file?.type);

        if (!file) {
            console.warn('❌ No file found in input!');
            setError('No file found in input!');
            return;
        }

        console.log('✅ File selected:', file.name);
        setStage('PROCESSING');
        setError(null);
        setExtractedData([]);
        updateProgress("Reading file...");

        // Check for Excel files
        if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls') || file.type.includes('sheet') || file.type.includes('excel')) {
            console.log('📊 Excel file detected, using IDFCBankParser directly');
            try {
                updateProgress("Parsing Excel with enhanced IDFC parser...");
                // Try to get arrayBuffer and catch errors
                let result;
                try {
                    if (!file.arrayBuffer) throw new Error('File API arrayBuffer not supported in this environment.');
                    result = await IDFCBankParser.parseExcel(file);
                } catch (arrayBufferErr) {
                    console.error('❌ arrayBuffer or XLSX error:', arrayBufferErr);
                    setError('File reading or parsing failed. This may not be supported on your device. Try a different file or format.');
                    setStage('IDLE');
                    return;
                }
                if (result.transactions.length > 0) {
                    // ...existing code...
                } else {
                    throw new Error("No transactions found in Excel file.");
                }
            } catch (err: any) {
                console.error('❌ Excel parsing error:', err);
                setError("Failed to parse Excel file: " + (err.message || "Unknown error"));
                setStage('IDLE');
            }
        } else {
            console.log('📄 Non-Excel file detected, using PDF/Image parser, type:', file.type);
            // Fallback to Image/PDF processing
            try {
                const base64 = await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => {
                        try {
                            const result = reader.result as string;
                            const base64String = result.split(',')[1];
                            console.log('✅ File read as base64, length:', base64String.length);
                            resolve(base64String);
                        } catch (readerErr) {
                            console.error('❌ Error processing file as base64:', readerErr);
                            setError('Failed to process file as base64.');
                            setStage('IDLE');
                            reject(readerErr);
                        }
                    };
                    reader.onerror = (err) => {
                        console.error('❌ FileReader error:', err);
                        setError('FileReader error: ' + err);
                        setStage('IDLE');
                        reject(err);
                    };
                    try {
                        reader.readAsDataURL(file);
                    } catch (fileReadErr) {
                        console.error('❌ readAsDataURL error:', fileReadErr);
                        setError('readAsDataURL error: ' + fileReadErr);
                        setStage('IDLE');
                        reject(fileReadErr);
                    }
                });
                console.log('🚀 Calling processTransactions with base64 data');
                await processTransactions(base64, file.type);
            } catch (err) {
                console.error('❌ File reading error:', err);
                let errorMsg = "Failed to read file: Unknown error";
                if (typeof err === "string") {
                    errorMsg = err;
                } else if (err && typeof err === "object" && "message" in err) {
                    errorMsg = (err as { message?: string }).message || errorMsg;
                } else if (err && typeof err === "object" && "toString" in err) {
                    errorMsg = (err as { toString: () => string }).toString();
                }
                setError(errorMsg);
                setStage('IDLE');
            }
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
      console.log('🎬 confirmImport triggered');
      console.log('   Total transactions in review:', extractedData.length);
      console.log('   Selected IDs count:', selectedIds.size);
      
      const toImport = extractedData.filter(t => selectedIds.has(t.id));
      
      console.log('🎬 Filter result:', toImport.length, 'transactions to import');
      console.log('🎬 First transaction:', toImport[0]);
      console.log('🎬 Last transaction:', toImport[toImport.length - 1]);
      
      if (toImport.length === 0) {
        console.warn('🎬 No transactions selected - aborting import');
        return;
      }
      
      console.log('🔄 IMPORTING:', {
        count: toImport.length,
        dates: toImport.slice(0, 3).map(t => t.date),
        types: toImport.slice(0, 3).map(t => t.type),
        amounts: toImport.slice(0, 3).map(t => t.amount),
        merchants: toImport.slice(0, 3).map(t => t.merchant)
      });
      
      console.log('🎬 Calling importTransactions...');
      console.log('💰 DEBUG: parsedOpeningBalance value RIGHT NOW:', parsedOpeningBalance);
      // Pass opening balance to import function - it will set it before transactions
      importTransactions(toImport, parsedOpeningBalance);
      
      console.log('🎬 importTransactions called. Now navigating to Dashboard...');
      onNavigate(AppScreen.DASHBOARD);
      
      console.log('🎬 Navigation completed to Dashboard');
  }

  const handleDiscard = () => {
      setExtractedData([]);
      setSelectedIds(new Set());
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
                <p className="text-muted-taupe text-[13px] font-medium leading-relaxed mb-8 text-center px-4">
                Upload your IDFC bank statement (PDF, Excel, or Image). Fast, rule-based parsing without AI.
                </p>
                
                <div 
                    onClick={handleDropAreaClick}
                    className={`relative w-full aspect-[4/3] rounded-4xl flex flex-col items-center justify-center gap-4 bg-white/30 border-2 border-dashed border-sage/20 hover:border-sage/40 transition-all active:scale-[0.98] cursor-pointer`}
                >
                    {/* WALL-E Upload Helper */}
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
                        <p className="text-muted-taupe text-xs mt-1">Excel, PDF, PNG, or JPG</p>
                        <p className="text-[10px] text-muted-taupe/60 mt-2 italic">"Let me analyze your finances!"</p>
                    </div>
                    <input 
                        ref={fileInputRef}
                        accept=".pdf,.xlsx,.xls,image/*" 
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
                {/* WALL-E Processing Animation */}
                <div className="relative mb-8">
                    {/* Outer spinning ring */}
                    <div className="absolute inset-0 w-28 h-28 border-4 border-sage-light rounded-full"></div>
                    <div className="absolute inset-0 w-28 h-28 border-4 border-sage rounded-full border-t-transparent animate-spin"></div>
                    
                    {/* WALL-E face in center */}
                    <div className="w-28 h-28 rounded-full bg-gradient-to-br from-sage to-sage/80 flex items-center justify-center shadow-xl">
                      <WallEEyes size="lg" animate={true} />
                    </div>
                    
                    {/* Sparkles */}
                    <div className="absolute -top-2 -right-2 text-lg animate-pulse">✨</div>
                    <div className="absolute -bottom-1 -left-3 text-sm animate-pulse animation-delay-03s">✨</div>
                </div>
                <h3 className="text-xl font-serif font-semibold text-premium-charcoal mb-2">{loadingMessage}</h3>
                <p className="text-muted-taupe text-xs animate-pulse">WALL-E is analyzing your document</p>
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
                
                <div className="flex justify-between items-end mb-6 px-2">
                    <div>
                        <h3 className="text-premium-charcoal text-lg font-serif font-semibold">Review Transactions</h3>
                        <p className="text-muted-taupe text-xs mt-1">
                            {selectedIds.size} of {extractedData.length} selected
                            {duplicateIds.size > 0 && (
                                <span className="text-blue-500 ml-1">({duplicateIds.size} duplicates)</span>
                            )}
                        </p>
                        {extractedData.length > 0 && (
                            <div className="text-[10px] text-muted-taupe mt-2 space-y-0.5">
                                <p>💰 Income: {extractedData.filter(t => t.type === TransactionType.INCOME).reduce((a, t) => a + t.amount, 0).toFixed(2)}</p>
                                <p>💸 Expense: {extractedData.filter(t => t.type === TransactionType.EXPENSE).reduce((a, t) => a + t.amount, 0).toFixed(2)}</p>
                                <p>📅 Dates: {extractedData.length > 0 ? extractedData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0].date + ' to ' + extractedData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0].date : 'N/A'}</p>
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
