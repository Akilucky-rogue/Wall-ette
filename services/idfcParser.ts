// ═══════════════════════════════════════════════════════════════
// IDFC FIRST BANK STATEMENT PARSER - RULE-BASED (NO AI)
// Fast, accurate, deterministic parsing with balance validation
// ═══════════════════════════════════════════════════════════════

import { log } from '../utils/log';

type TransactionNature = 
    | 'CONSUMPTION'
    | 'TRANSFER'
    | 'CASH_OUT'
    | 'INVESTMENT_INFLOW'
    | 'INVESTMENT_OUTFLOW'
    | 'INVESTMENT_RETURN'
    | 'PASSIVE_INCOME'
    | 'SALARY'
    | 'UNCATEGORIZED';

type IncomeSource = 
    | 'Salary'
    | 'Choice'
    | 'Interest'
    | 'Dividends'
    | 'Freelance'
    | 'Rental'
    | 'MF_Redemption'
    | 'Refund'
    | 'Transfer'
    | 'Other';

interface RawTransaction {
    date: string;
    merchant: string;
    amount: number;
    type: "INCOME" | "EXPENSE";
    mode?: string;
    nature?: TransactionNature;
    category?: string;
    incomeSource?: IncomeSource;
    note?: string;
    balance?: number;
    isDuplicate?: boolean;
    duplicateOf?: string;
}

interface StatementHeader {
    bankName?: string;
    accountNumber?: string;
    statementPeriod?: { from: string; to: string };
    openingBalance: number;
    closingBalance: number;
    totalDebit: number;
    totalCredit: number;
}

interface ParsedStatement {
    header: StatementHeader;
    transactions: RawTransaction[];
    validationPassed: boolean;
    errors: string[];
}

// ═══════════════════════════════════════════════════════════════
// PDF TEXT EXTRACTION
// ═══════════════════════════════════════════════════════════════

interface PdfItem { text: string; x: number; y: number; w: number }

async function extractFromPDF(base64Data: string): Promise<{ text: string; pages: PdfItem[][] }> {
    // Worker is bundled by Vite (?url emits it as a local asset) instead of
    // being fetched from unpkg at runtime — works offline and on native
    // Android, and removes the CDN supply-chain dependency (audit Phase 3.4).
    const [pdfjsLib, worker] = await Promise.all([
        import('pdfjs-dist'),
        import('pdfjs-dist/build/pdf.worker.min.mjs?url')
    ]);
    pdfjsLib.GlobalWorkerOptions.workerSrc = worker.default;

    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }

    const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
    const numPages = pdf.numPages;
    let fullText = '';
    const pages: PdfItem[][] = [];

    for (let i = 1; i <= numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();

        // Positioned items — the column-aware table parser needs x/y/width.
        const items: PdfItem[] = (textContent.items as any[])
            .filter((it: any) => typeof it.str === 'string' && it.str.trim().length > 0)
            .map((it: any) => ({
                text: it.str.trim(),
                x: it.transform[4],
                y: it.transform[5],
                w: it.width || 0,
            }));
        pages.push(items);

        // Legacy flat text (header regexes + generic fallback parser).
        const sorted = [...items].sort((a, b) => {
            if (Math.abs(a.y - b.y) > 5) return b.y - a.y; // Top to bottom
            return a.x - b.x; // Left to right
        });
        let currentY = sorted[0]?.y;
        let line = '';
        for (const item of sorted) {
            if (Math.abs(item.y - currentY) > 5) {
                fullText += line + '\n';
                line = item.text;
                currentY = item.y;
            } else {
                line += (line ? ' ' : '') + item.text;
            }
        }
        fullText += line + '\n';
    }

    return { text: fullText, pages };
}

// ═══════════════════════════════════════════════════════════════
// COLUMN-AWARE TABLE PARSER (primary PDF path)
// IDFC PDFs wrap each description onto a second line and only the
// x-position distinguishes Debit from Credit — line-based splitting
// cannot parse them. This rebuilds the table from item coordinates:
// column boundaries come from the header row ("Debit"/"Credit"/
// "Balance" midpoints), wrapped description lines are re-attached to
// their row, and INCOME/EXPENSE is verified against the running
// balance column. Validated row-for-row against the bank's own Excel
// exports of the same statements.
// ═══════════════════════════════════════════════════════════════

const DATE_TOKEN = /^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/;
const AMT_TOKEN = /^-?[\d,]+\.\d{2}$/;
const MONTH_NUM: Record<string, string> = {
    jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
};

interface TableRow { date: string; desc: string; deb: number | null; cre: number | null; bal: number | null }
interface TableResult {
    rows: TableRow[];
    summary: { opening: number; totDeb: number; totCre: number; closing: number } | null;
}

function parseIDFCTable(pages: PdfItem[][]): TableResult {
    const rows: TableRow[] = [];
    let summary: TableResult['summary'] = null;
    let bounds: { chqD: number; dc: number; cb: number; partX: number } | null = null;

    for (const items of pages) {
        // Bucket into visual lines (~4pt tolerance); pdf.js y grows upward,
        // so larger y = higher on the page.
        const buckets = new Map<number, PdfItem[]>();
        for (const it of items) {
            const key = Math.round(it.y / 4);
            const b = buckets.get(key);
            if (b) b.push(it); else buckets.set(key, [it]);
        }
        const keys = [...buckets.keys()].sort((a, b) => b - a);
        const lines = keys.map(k => buckets.get(k)!.sort((a, b) => a.x - b.x));

        for (let i = 0; i < lines.length; i++) {
            const ln = lines[i];
            const texts = ln.map(it => it.text);

            // Summary block: label line, values on the NEXT line.
            if (!summary && texts.includes('Opening') && texts.includes('Balance') && texts.join(' ').includes('Debit')) {
                const next = lines[i + 1];
                const nums = next ? next.filter(it => AMT_TOKEN.test(it.text)).map(it => parseAmount(it.text)) : [];
                if (nums.length === 4) {
                    summary = { opening: nums[0], totDeb: nums[1], totCre: nums[2], closing: nums[3] };
                }
                continue;
            }

            // Header row → derive column boundaries from label midpoints.
            if (texts.includes('Particulars') && texts.includes('Debit') && texts.includes('Credit')) {
                const cx: Record<string, number> = {};
                for (const it of ln) {
                    if (['Debit', 'Credit', 'Balance', 'Particulars', 'Cheque'].includes(it.text)) {
                        cx[it.text] = it.x + it.w / 2;
                    }
                }
                if (cx.Debit !== undefined && cx.Credit !== undefined && cx.Balance !== undefined) {
                    bounds = {
                        dc: (cx.Debit + cx.Credit) / 2,
                        cb: (cx.Credit + cx.Balance) / 2,
                        chqD: ((cx.Cheque ?? cx.Debit - 70) + cx.Debit) / 2,
                        partX: (cx.Particulars ?? 200) - 60,
                    };
                }
                continue;
            }
            if (!bounds) continue;

            const m = DATE_TOKEN.exec(texts[0]);
            const month = m ? MONTH_NUM[m[2].toLowerCase()] : undefined;
            if (m && month) {
                const date = `${m[3]}-${month}-${m[1].padStart(2, '0')}`;
                let deb: number | null = null, cre: number | null = null, bal: number | null = null;
                const desc: string[] = [];
                for (let j = 1; j < ln.length; j++) {
                    const it = ln[j];
                    const center = it.x + it.w / 2;
                    if (DATE_TOKEN.test(it.text) && center < bounds.partX) continue; // value-date column
                    if (AMT_TOKEN.test(it.text) && center > bounds.chqD) {
                        const v = parseAmount(it.text);
                        if (center < bounds.dc) deb = v;
                        else if (center < bounds.cb) cre = v;
                        else bal = v;
                    } else {
                        desc.push(it.text);
                    }
                }
                rows.push({ date, desc: desc.join(' '), deb, cre, bal });
            } else if (
                rows.length > 0 &&
                ln.every(it => it.x >= bounds!.partX - 25 && it.x < bounds!.chqD)
            ) {
                // Wrapped description line — glue back onto the open row.
                rows[rows.length - 1].desc += texts.join('');
            }
            // Anything else (footers, page numbers, in-table "Opening Balance"
            // marker) falls through harmlessly.
        }
    }

    return { rows, summary };
}

function tableToTransactions(table: TableResult): RawTransaction[] {
    const out: RawTransaction[] = [];
    let prev: number | null = table.summary ? table.summary.opening : null;

    for (const r of table.rows) {
        const amount = r.deb ?? r.cre;
        if (amount === null || amount <= 0) {
            if (r.bal !== null) prev = r.bal;
            continue;
        }
        // Column position decides the type; the running balance verifies it.
        let type: 'INCOME' | 'EXPENSE' = r.deb !== null ? 'EXPENSE' : 'INCOME';
        if (prev !== null && r.bal !== null) {
            const delta = r.bal - prev;
            if (Math.abs(Math.abs(delta) - amount) <= 0.01) {
                type = delta > 0 ? 'INCOME' : 'EXPENSE';
            }
        }
        if (r.bal !== null) prev = r.bal;

        const c = classifyTransaction(r.desc, type === 'INCOME');
        out.push({
            date: r.date,
            // Full narration, same as the Excel path — keeps dedup and
            // merchant grouping identical across both import formats.
            merchant: r.desc.substring(0, 100) || c.merchant,
            amount,
            type,
            nature: c.nature,
            category: c.category,
            incomeSource: c.incomeSource,
            balance: r.bal ?? undefined,
            note: r.desc,
        });
    }
    return out;
}

// ═══════════════════════════════════════════════════════════════
// IDFC-SPECIFIC PATTERNS
// ═══════════════════════════════════════════════════════════════

// IDFC transaction line patterns:
// Date | Description | Chq/Ref No | Value Date | Withdrawal | Deposit | Balance
// 01 Jan 24 | UPI-MERCHANT NAME | 123456789 | 01 Jan 24 | 1,234.56 | | 10,234.56

const PATTERNS = {
    // Date: DD MMM YY or DD-MMM-YY or DD/MM/YY
    date: /(\d{1,2}[\s\-\/](Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[\s\-\/]\d{2,4})/i,
    
    // Amount: handles Indian format with commas (1,23,456.78)
    amount: /(\d{1,3}(?:,\d{2,3})*(?:\.\d{2})?)/,
    
    // Account number
    accountNum: /Account\s*No[:\s]+(\d+)/i,
    
    // Statement period — named-month or ISO ("2026-06-01 TO 2026-06-11")
    period: /(?:Statement\s*Period|From)[:\s]+(\d{1,2}[\s\-\/]\w{3}[\s\-\/]\d{2,4})\s*(?:to|To|-)\s*(\d{1,2}[\s\-\/]\w{3}[\s\-\/]\d{2,4})/i,
    periodIso: /(?:Statement\s*Period)[:\s]+(\d{4}-\d{2}-\d{2})\s*(?:to|TO)\s*(\d{4}-\d{2}-\d{2})/i,
    
    // Opening balance
    openingBalance: /Opening\s*Balance[:\s]+([\d,]+\.?\d*)/i,
    
    // Closing balance
    closingBalance: /Closing\s*Balance[:\s]+([\d,]+\.?\d*)/i,
    
    // Total debit/credit
    totalDebit: /Total\s*(?:Debit|Withdrawals?)[:\s]+([\d,]+\.?\d*)/i,
    totalCredit: /Total\s*(?:Credit|Deposits?)[:\s]+([\d,]+\.?\d*)/i,
};

// ═══════════════════════════════════════════════════════════════
// MERCHANT & CATEGORY CLASSIFICATION
// ═══════════════════════════════════════════════════════════════

const CATEGORY_RULES = {
    // UPI patterns
    UPI: {
        pattern: /UPI[\/\-\s]+(.*?)(?:\s*REF|$)/i,
        category: 'CONSUMPTION',
        extractMerchant: (desc: string) => {
            const match = desc.match(/UPI[\/\-\s]+(.*?)(?:\s*REF|$)/i);
            return match ? match[1].trim() : 'UPI Payment';
        }
    },
    
    // Salary
    SALARY: {
        pattern: /salary|payroll|wages/i,
        category: 'SALARY',
        type: 'INCOME' as const,
        incomeSource: 'Salary' as const
    },
    
    // Interest
    INTEREST: {
        pattern: /int\.?\s*(?:paid|cr)|interest\s*(?:credit|paid)/i,
        category: 'PASSIVE_INCOME',
        type: 'INCOME' as const,
        incomeSource: 'Interest' as const
    },
    
    // ATM
    ATM: {
        pattern: /ATM\s*WDL|ATM\s*WD|CASH\s*WITHDRAWAL/i,
        category: 'CASH_OUT'
    },
    
    // Transfer
    TRANSFER: {
        pattern: /NEFT|IMPS|RTGS|TRANSFER|TRF/i,
        category: 'TRANSFER'
    },
    
    // Investment
    INVESTMENT: {
        pattern: /MUTUAL\s*FUND|MF|SIP|STOCK|EQUITY|DEMAT/i,
        category: 'INVESTMENT_OUTFLOW',
        categoryIn: 'INVESTMENT_INFLOW'
    },
    
    // Bill payments
    BILLS: {
        pattern: /ELECTRICITY|WATER|GAS|MOBILE|RECHARGE|BROADBAND|DTH/i,
        category: 'CONSUMPTION'
    },
    
    // Refund
    REFUND: {
        pattern: /REFUND|REVERSAL|CHARGEBACK/i,
        type: 'INCOME' as const,
        incomeSource: 'Refund' as const
    }
};

function classifyTransaction(description: string, isCredit: boolean): {
    merchant: string;
    nature: TransactionNature;
    category?: string;
    type: 'INCOME' | 'EXPENSE';
    incomeSource?: IncomeSource;
} {
    const desc = description.toUpperCase();
    
    // Check each rule
    for (const [key, rule] of Object.entries(CATEGORY_RULES)) {
        if (rule.pattern.test(description)) {
            // Extract merchant - use extractMerchant if available, otherwise use default logic
            const merchant = ('extractMerchant' in rule && typeof rule.extractMerchant === 'function')
                ? rule.extractMerchant(description)
                : description.split(/REF|CHQ|TXNID/i)[0].trim();
            
            // Get nature/category
            const nature = (isCredit && 'categoryIn' in rule && rule.categoryIn) 
                ? rule.categoryIn as TransactionNature
                : ('category' in rule ? rule.category as TransactionNature : 'UNCATEGORIZED');
            
            return {
                merchant: merchant || description.substring(0, 50),
                nature: nature || 'UNCATEGORIZED',
                type: ('type' in rule ? rule.type : (isCredit ? 'INCOME' : 'EXPENSE')) as 'INCOME' | 'EXPENSE',
                incomeSource: 'incomeSource' in rule ? rule.incomeSource : undefined
            };
        }
    }
    
    // Default classification
    return {
        merchant: description.substring(0, 50),
        nature: 'UNCATEGORIZED',
        type: isCredit ? 'INCOME' : 'EXPENSE'
    };
}

// ═══════════════════════════════════════════════════════════════
// AMOUNT PARSING
// ═══════════════════════════════════════════════════════════════

function parseAmount(amountStr: string): number {
    if (!amountStr) return 0;
    // Remove commas and parse
    const cleaned = amountStr.replace(/,/g, '');
    return parseFloat(cleaned) || 0;
}

// ═══════════════════════════════════════════════════════════════
// DATE PARSING
// ═══════════════════════════════════════════════════════════════

function parseDate(dateStr: string): string {
    const monthMap: { [key: string]: string } = {
        'jan': '01', 'feb': '02', 'mar': '03', 'apr': '04',
        'may': '05', 'jun': '06', 'jul': '07', 'aug': '08',
        'sep': '09', 'oct': '10', 'nov': '11', 'dec': '12'
    };
    
    // DD MMM YY format
    const match = dateStr.match(/(\d{1,2})[\s\-\/](\w{3})[\s\-\/](\d{2,4})/i);
    if (match) {
        const day = match[1].padStart(2, '0');
        const month = monthMap[match[2].toLowerCase()];
        let year = match[3];
        
        // Convert 2-digit year to 4-digit
        if (year.length === 2) {
            year = parseInt(year) > 50 ? '19' + year : '20' + year;
        }
        
        return `${year}-${month}-${day}`;
    }
    
    return dateStr;
}

// ═══════════════════════════════════════════════════════════════
// TRANSACTION TABLE PARSER
// ═══════════════════════════════════════════════════════════════

function parseTransactionLines(text: string): RawTransaction[] {
    const transactions: RawTransaction[] = [];
    const lines = text.split('\n');
    
    // IDFC format: Date | Description | Chq/Ref | Value Date | Withdrawal/Debit | Deposit/Credit | Balance
    // First, find the header line to identify column positions
    let headerFound = false;
    let debitColIndex = -1;
    let creditColIndex = -1;
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // Look for header row with column names
        if (/debit|withdrawal/i.test(line) && /credit|deposit/i.test(line)) {
            // Split by multiple spaces to identify columns
            const headerParts = line.split(/\s{2,}|\t+/);

            // Find column indices
            for (let j = 0; j < headerParts.length; j++) {
                const col = headerParts[j].toLowerCase();
                if (/debit|withdrawal/i.test(col)) {
                    debitColIndex = j;
                }
                if (/credit|deposit/i.test(col)) {
                    creditColIndex = j;
                }
            }

            headerFound = true;
            break;
        }
    }

    if (!headerFound) {
        log.warn('IDFC PDF: no table header found, using default column positions');
        debitColIndex = -3;  // 3rd from end
        creditColIndex = -2; // 2nd from end
    }

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        // Skip empty lines and headers
        if (!line || /^(Date|Transaction|S\.?No|Chq|Debit|Credit|Balance|Withdrawal|Deposit)/i.test(line)) continue;
        
        // Match transaction line - starts with date
        const dateMatch = line.match(/^(\d{1,2}[\s\-\/]\w{3}[\s\-\/]\d{2,4})/i);
        if (!dateMatch) continue;
        
        try {
            // Split by multiple spaces or tabs
            const parts = line.split(/\s{2,}|\t+/).filter(p => p.trim());
            
            if (parts.length < 4) continue; // Need at least date, desc, and amounts
            
            const date = parseDate(parts[0]);
            const description = parts[1] || 'Unknown';
            
            // Extract amounts using detected column indices
            let withdrawal = 0;
            let deposit = 0;
            let balance = 0;
            
            if (debitColIndex >= 0 && creditColIndex >= 0) {
                // Use absolute indices
                withdrawal = parseAmount(parts[debitColIndex] || '0');
                deposit = parseAmount(parts[creditColIndex] || '0');
                balance = parseAmount(parts[parts.length - 1] || '0'); // Balance is usually last
            } else {
                // Use relative indices (from end)
                withdrawal = parseAmount(parts[parts.length + debitColIndex] || '0');
                deposit = parseAmount(parts[parts.length + creditColIndex] || '0');
                balance = parseAmount(parts[parts.length - 1] || '0');
            }
            
            const amount = withdrawal > 0 ? withdrawal : deposit;
            const isCredit = deposit > 0 && withdrawal === 0;
            
            if (amount === 0) continue;
            
            const classification = classifyTransaction(description, isCredit);

            transactions.push({
                date,
                merchant: classification.merchant,
                amount,
                type: classification.type,
                nature: classification.nature,
                category: classification.category,
                incomeSource: classification.incomeSource,
                balance,
                note: description
            });
        } catch (error) {
            // Do not log line content — statement lines contain PII.
            log.warn('IDFC PDF: failed to parse a statement line');
        }
    }

    return transactions;
}

// ═══════════════════════════════════════════════════════════════
// HEADER EXTRACTION
// ═══════════════════════════════════════════════════════════════

function extractHeader(text: string): StatementHeader {
    const header: StatementHeader = {
        openingBalance: 0,
        closingBalance: 0,
        totalDebit: 0,
        totalCredit: 0
    };
    
    // Extract account number (never logged — PII)
    const accMatch = text.match(PATTERNS.accountNum);
    if (accMatch) {
        header.accountNumber = accMatch[1];
    }

    // Extract period (named-month first, ISO format second)
    const periodMatch = text.match(PATTERNS.period);
    if (periodMatch) {
        header.statementPeriod = {
            from: parseDate(periodMatch[1]),
            to: parseDate(periodMatch[2])
        };
    } else {
        const iso = text.match(PATTERNS.periodIso);
        if (iso) header.statementPeriod = { from: iso[1], to: iso[2] };
    }

    // Extract balances
    const openingMatch = text.match(PATTERNS.openingBalance);
    if (openingMatch) {
        header.openingBalance = parseAmount(openingMatch[1]);
    }

    const closingMatch = text.match(PATTERNS.closingBalance);
    if (closingMatch) {
        header.closingBalance = parseAmount(closingMatch[1]);
    }

    // Extract totals
    const debitMatch = text.match(PATTERNS.totalDebit);
    if (debitMatch) {
        header.totalDebit = parseAmount(debitMatch[1]);
    }

    const creditMatch = text.match(PATTERNS.totalCredit);
    if (creditMatch) {
        header.totalCredit = parseAmount(creditMatch[1]);
    }

    header.bankName = 'IDFC FIRST Bank';
    
    return header;
}

// ═══════════════════════════════════════════════════════════════
// BALANCE VALIDATION
// ═══════════════════════════════════════════════════════════════

function validateBalances(header: StatementHeader, transactions: RawTransaction[]): {
    passed: boolean;
    errors: string[];
} {
    const errors: string[] = [];
    
    // Validate running balance
    let runningBalance = header.openingBalance;
    
    for (let i = 0; i < transactions.length; i++) {
        const txn = transactions[i];
        
        if (txn.type === 'INCOME') {
            runningBalance += txn.amount;
        } else {
            runningBalance -= txn.amount;
        }
        
        // Check if calculated balance matches statement balance (within 0.01 tolerance)
        if (txn.balance && Math.abs(runningBalance - txn.balance) > 0.01) {
            errors.push(
                `Balance mismatch at transaction ${i + 1}: ` +
                `Expected ${runningBalance.toFixed(2)}, ` +
                `Found ${txn.balance.toFixed(2)}`
            );
        }
    }
    
    // Validate closing balance
    if (header.closingBalance && Math.abs(runningBalance - header.closingBalance) > 0.01) {
        errors.push(
            `Closing balance mismatch: ` +
            `Calculated ${runningBalance.toFixed(2)}, ` +
            `Statement shows ${header.closingBalance.toFixed(2)}`
        );
    }
    
    // Validate total credits and debits
    const totalCredits = transactions
        .filter(t => t.type === 'INCOME')
        .reduce((sum, t) => sum + t.amount, 0);
    
    const totalDebits = transactions
        .filter(t => t.type === 'EXPENSE')
        .reduce((sum, t) => sum + t.amount, 0);
    
    if (header.totalCredit && Math.abs(totalCredits - header.totalCredit) > 0.01) {
        errors.push(
            `Total credits mismatch: ` +
            `Calculated ${totalCredits.toFixed(2)}, ` +
            `Statement shows ${header.totalCredit.toFixed(2)}`
        );
    }
    
    if (header.totalDebit && Math.abs(totalDebits - header.totalDebit) > 0.01) {
        errors.push(
            `Total debits mismatch: ` +
            `Calculated ${totalDebits.toFixed(2)}, ` +
            `Statement shows ${header.totalDebit.toFixed(2)}`
        );
    }
    
    return {
        passed: errors.length === 0,
        errors
    };
}

// ═══════════════════════════════════════════════════════════════
// GENERIC BANK PDF FALLBACK
// Not every bank exports the IDFC table layout. This pass works for
// most Indian bank PDFs by reading each line as
//   <date> <description> [amount] [running balance]
// and inferring INCOME/EXPENSE from the running-balance delta —
// the most reliable signal across banks. Explicit Cr/Dr markers
// take priority when present.
// ═══════════════════════════════════════════════════════════════

// Amounts in statements carry 2 decimals; reference numbers don't —
// requiring the decimals keeps txn ids/refs out of the amount list.
const GENERIC_AMOUNT = /\d{1,3}(?:,\d{2,3})*\.\d{2}/g;
const GENERIC_DATE = /(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})|(\d{1,2}[\s\-\/][A-Za-z]{3,9}[\s\-\/,]+\d{2,4})/;

function parseDateFlexible(str: string): string | null {
    // DD MMM YYYY (existing helper handles it)
    const named = parseDate(str);
    if (/^\d{4}-\d{2}-\d{2}$/.test(named)) return named;

    // Numeric DD/MM/YYYY or DD-MM-YY (Indian banks are day-first)
    const m = str.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/);
    if (m) {
        const day = m[1].padStart(2, '0');
        const month = m[2].padStart(2, '0');
        let year = m[3];
        if (year.length === 2) year = parseInt(year) > 50 ? '19' + year : '20' + year;
        if (parseInt(month) >= 1 && parseInt(month) <= 12 && parseInt(day) >= 1 && parseInt(day) <= 31) {
            return `${year}-${month}-${day}`;
        }
    }
    return null;
}

function parseGenericTransactionLines(text: string, openingBalance: number): RawTransaction[] {
    interface Row { date: string; desc: string; amounts: number[]; crdr: 'CR' | 'DR' | null; }
    const rows: Row[] = [];

    for (const rawLine of text.split('\n')) {
        const line = rawLine.trim();
        if (!line || line.length < 12) continue;
        if (/^(date|txn|transaction|particulars|narration|description|chq|debit|credit|withdrawal|deposit|balance|opening|closing|total|page \d)/i.test(line)) continue;

        const dateMatch = line.match(GENERIC_DATE);
        if (!dateMatch || line.indexOf(dateMatch[0]) > 20) continue; // date should lead the row
        const date = parseDateFlexible(dateMatch[0]);
        if (!date) continue;

        const amountMatches = [...line.matchAll(GENERIC_AMOUNT)].map(m => m[0]);
        if (amountMatches.length === 0) continue;
        const amounts = amountMatches.map(parseAmount).filter(a => a > 0);
        if (amounts.length === 0) continue;

        // Explicit Cr/Dr marker (e.g., "1,234.00 Cr")
        const crdrMatch = line.match(/\d\s*\(?(cr|dr)\b\.?\)?/i);
        const crdr = crdrMatch ? (crdrMatch[1].toUpperCase() as 'CR' | 'DR') : null;

        // Description = the line minus date, amounts, and markers
        let desc = line.replace(dateMatch[0], '');
        for (const a of amountMatches) desc = desc.replace(a, '');
        desc = desc.replace(/\b(cr|dr)\b\.?/gi, '').replace(/\s{2,}/g, ' ').trim();

        rows.push({ date, desc: desc.substring(0, 100) || 'Unknown', amounts, crdr });
    }

    if (rows.length === 0) return [];

    // Decide whether the LAST amount per row is a running balance:
    // in balance mode, |balance[i] − balance[i−1]| equals the txn amount.
    let prev = openingBalance > 0 ? openingBalance : null;
    let matches = 0, comparable = 0;
    for (const r of rows) {
        if (r.amounts.length < 2 || prev === null) { prev = r.amounts[r.amounts.length - 1]; continue; }
        const bal = r.amounts[r.amounts.length - 1];
        const amt = r.amounts[r.amounts.length - 2];
        comparable++;
        if (Math.abs(Math.abs(bal - prev) - amt) <= 0.02) matches++;
        prev = bal;
    }
    const balanceMode = comparable >= 3 && matches / comparable > 0.6;

    const transactions: RawTransaction[] = [];
    let prevBal = openingBalance > 0 ? openingBalance : null;

    for (const r of rows) {
        let amount: number;
        let balance: number | undefined;
        let isCredit: boolean | null = r.crdr ? r.crdr === 'CR' : null;

        if (balanceMode && r.amounts.length >= 2) {
            balance = r.amounts[r.amounts.length - 1];
            amount = r.amounts[r.amounts.length - 2];
            if (isCredit === null && prevBal !== null) {
                isCredit = balance > prevBal;
            }
            prevBal = balance;
        } else {
            amount = r.amounts[0];
        }

        if (isCredit === null) {
            // Last resort: keyword heuristic
            isCredit = /credit|deposit|refund|reversal|salary|interest|cashback|received/i.test(r.desc);
        }

        const classification = classifyTransaction(r.desc, isCredit);
        transactions.push({
            date: r.date,
            merchant: classification.merchant,
            amount,
            // Balance-delta / Cr-Dr signal outranks keyword classification
            type: isCredit ? 'INCOME' : 'EXPENSE',
            nature: classification.nature,
            category: classification.category,
            incomeSource: classification.incomeSource,
            balance,
            note: r.desc
        });
    }

    log.debug(`Generic PDF: ${transactions.length} rows, balanceMode=${balanceMode}`);
    return transactions;
}

// ═══════════════════════════════════════════════════════════════
// MAIN PARSER FUNCTION
// ═══════════════════════════════════════════════════════════════

export async function parseIDFCStatement(base64Data: string): Promise<ParsedStatement> {
    const startTime = Date.now();

    try {
        // Extract positioned items + flat text from the PDF
        const { text, pages } = await extractFromPDF(base64Data);

        // Extract header info from flat text (period, account no, …)
        const header = extractHeader(text);

        // 1) Column-aware IDFC table parser (coordinates — handles wrapped
        //    descriptions and x-position Debit/Credit columns exactly).
        // 2) Legacy line parser. 3) Generic bank fallback.
        let transactions: RawTransaction[];
        const table = parseIDFCTable(pages);
        if (table.rows.length > 0) {
            if (table.summary) {
                header.openingBalance = table.summary.opening;
                header.totalDebit = table.summary.totDeb;
                header.totalCredit = table.summary.totCre;
                header.closingBalance = table.summary.closing;
            }
            transactions = tableToTransactions(table);
        } else {
            transactions = parseTransactionLines(text);
            if (transactions.length === 0) {
                transactions = parseGenericTransactionLines(text, header.openingBalance);
                if (transactions.length > 0) header.bankName = 'Generic (auto-detected)';
            }
        }

        // Validate mathematical accuracy
        const validation = validateBalances(header, transactions);

        log.debug(`IDFC PDF: parsed ${transactions.length} transactions in ${Date.now() - startTime}ms`);
        if (!validation.passed) {
            log.warn(`IDFC PDF: balance validation reported ${validation.errors.length} issue(s)`);
        }

        return {
            header,
            transactions,
            validationPassed: validation.passed,
            errors: validation.errors
        };

    } catch (error) {
        log.error('IDFC parser error'); // no payload — may contain statement content
        throw error;
    }
}

// ═══════════════════════════════════════════════════════════════
// EXPORT
// ═══════════════════════════════════════════════════════════════

export default { parseIDFCStatement };
