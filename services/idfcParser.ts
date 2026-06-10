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

async function extractTextFromPDF(base64Data: string): Promise<string> {
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
    
    for (let i = 1; i <= numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        
        // Sort items by position (top to bottom, left to right)
        const items = textContent.items.map((item: any) => ({
            text: item.str,
            y: item.transform[5],
            x: item.transform[4]
        }));
        
        items.sort((a, b) => {
            if (Math.abs(a.y - b.y) > 5) return b.y - a.y; // Top to bottom
            return a.x - b.x; // Left to right
        });
        
        let currentY = items[0]?.y;
        let line = '';
        
        for (const item of items) {
            if (Math.abs(item.y - currentY) > 5) {
                fullText += line + '\n';
                line = item.text;
                currentY = item.y;
            } else {
                line += ' ' + item.text;
            }
        }
        fullText += line + '\n';
    }
    
    return fullText;
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
    
    // Statement period
    period: /(?:Statement\s*Period|From)[:\s]+(\d{1,2}[\s\-\/]\w{3}[\s\-\/]\d{2,4})\s*(?:to|To|-)\s*(\d{1,2}[\s\-\/]\w{3}[\s\-\/]\d{2,4})/i,
    
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

    // Extract period
    const periodMatch = text.match(PATTERNS.period);
    if (periodMatch) {
        header.statementPeriod = {
            from: parseDate(periodMatch[1]),
            to: parseDate(periodMatch[2])
        };
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
// MAIN PARSER FUNCTION
// ═══════════════════════════════════════════════════════════════

export async function parseIDFCStatement(base64Data: string): Promise<ParsedStatement> {
    const startTime = Date.now();

    try {
        // Extract text from PDF
        const text = await extractTextFromPDF(base64Data);

        // Extract header info
        const header = extractHeader(text);

        // Parse transactions
        const transactions = parseTransactionLines(text);

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
