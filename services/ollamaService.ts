// ═══════════════════════════════════════════════════════════════
// OLLAMA LOCAL PDF PARSER - FULLY OFFLINE
// Replaces Gemini for privacy-first, local-only parsing
// ═══════════════════════════════════════════════════════════════

// Ollama API endpoint (local)
const OLLAMA_BASE_URL = 'http://localhost:11434';

// Models to use (vision + math for maximum accuracy)
const EXTRACTION_MODEL = 'qwen3:8b';          // Text extraction fallback
const VISION_MODEL = 'qwen3-vl:8b';           // Best for PDFs - sees tables directly
const MATH_MODEL = 'deepseek-r1:8b';          // Chain-of-thought for math verification

// ═══════════════════════════════════════════════════════════════
// TRANSACTION TYPES (same as geminiService)
// ═══════════════════════════════════════════════════════════════
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

// ═══════════════════════════════════════════════════════════════
// OLLAMA API INTERFACE
// ═══════════════════════════════════════════════════════════════

interface OllamaResponse {
    model: string;
    created_at: string;
    response: string;
    done: boolean;
}

async function checkOllamaAvailable(): Promise<boolean> {
    try {
        const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`);
        return response.ok;
    } catch {
        return false;
    }
}

async function getAvailableModels(): Promise<string[]> {
    try {
        const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`);
        if (!response.ok) return [];
        const data = await response.json();
        return data.models?.map((m: any) => m.name) || [];
    } catch {
        return [];
    }
}

async function ollamaGenerate(model: string, prompt: string, format?: 'json'): Promise<string> {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model,
            prompt,
            stream: false,
            format: format,
            options: {
                temperature: 0,  // Deterministic for accuracy
                num_predict: 8192,
            }
        })
    });

    if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status}`);
    }

    const data: OllamaResponse = await response.json();
    return data.response;
}

// ═══════════════════════════════════════════════════════════════
// PDF TEXT EXTRACTION (using pdf.js)
// ═══════════════════════════════════════════════════════════════

// Convert base64 PDF to text pages using pdf.js
async function extractTextFromPDF(base64Data: string): Promise<string[]> {
    // Dynamic import of pdf.js
    const pdfjsLib = await import('pdfjs-dist');
    
    // Use unpkg CDN for reliable worker loading
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
    
    // Decode base64 to ArrayBuffer
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    
    // Load PDF
    const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
    const numPages = pdf.numPages;
    const pages: string[] = [];
    
    console.log(`📄 PDF has ${numPages} pages`);
    
    for (let i = 1; i <= numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        
        // Extract text with position info to preserve table structure
        const textItems = textContent.items as any[];
        
        // Sort by Y position (top to bottom), then X (left to right)
        textItems.sort((a, b) => {
            const yDiff = b.transform[5] - a.transform[5]; // Y is inverted
            if (Math.abs(yDiff) > 5) return yDiff;
            return a.transform[4] - b.transform[4]; // X position
        });
        
        // Group by rows (items with similar Y)
        const rows: Map<number, string[]> = new Map();
        let currentY = -1;
        
        for (const item of textItems) {
            const y = Math.round(item.transform[5] / 10) * 10; // Round to nearest 10
            if (y !== currentY) {
                currentY = y;
                rows.set(y, []);
            }
            rows.get(y)!.push(item.str);
        }
        
        // Join rows with tab separation to preserve columns
        const pageText = Array.from(rows.values())
            .map(row => row.join('\t'))
            .join('\n');
        
        pages.push(pageText);
    }
    
    return pages;
}

// ═══════════════════════════════════════════════════════════════
// STATEMENT HEADER EXTRACTION
// ═══════════════════════════════════════════════════════════════

async function extractStatementHeader(firstPageText: string): Promise<StatementHeader | null> {
    const prompt = `Extract the bank statement summary from this text. This is an IDFC FIRST Bank statement.

TEXT:
${firstPageText}

Look for:
- Opening Balance (starting balance)
- Closing Balance (ending balance)
- Total Debit / Total Withdrawal (money OUT)
- Total Credit / Total Deposit (money IN)
- Statement Period dates

Return ONLY valid JSON:
{
  "bankName": "IDFC FIRST Bank",
  "openingBalance": number,
  "closingBalance": number,
  "totalDebit": number,
  "totalCredit": number,
  "periodFrom": "YYYY-MM-DD",
  "periodTo": "YYYY-MM-DD"
}`;

    try {
        const response = await ollamaGenerate(EXTRACTION_MODEL, prompt, 'json');
        const parsed = JSON.parse(response);
        
        console.log('📋 Statement Header Extracted:', parsed);
        
        // Validate math
        const calculatedClosing = parsed.openingBalance + parsed.totalCredit - parsed.totalDebit;
        const mathValid = Math.abs(calculatedClosing - parsed.closingBalance) <= parsed.closingBalance * 0.01;
        
        if (mathValid) {
            console.log(`✅ Statement math verified`);
        } else {
            console.warn(`⚠️ Math check: ${parsed.openingBalance} + ${parsed.totalCredit} - ${parsed.totalDebit} = ${calculatedClosing}, expected ${parsed.closingBalance}`);
        }
        
        return {
            bankName: parsed.bankName,
            openingBalance: parsed.openingBalance || 0,
            closingBalance: parsed.closingBalance || 0,
            totalDebit: parsed.totalDebit || 0,
            totalCredit: parsed.totalCredit || 0,
            statementPeriod: parsed.periodFrom ? { from: parsed.periodFrom, to: parsed.periodTo } : undefined
        };
    } catch (error) {
        console.error('Failed to extract header:', error);
        return null;
    }
}

// ═══════════════════════════════════════════════════════════════
// TRANSACTION PARSING
// ═══════════════════════════════════════════════════════════════

const IDFC_EXTRACTION_PROMPT = `You are parsing an IDFC FIRST Bank statement. Extract ALL transactions from this text.

CRITICAL COLUMN RULES:
━━━━━━━━━━━━━━━━━━━━━━━
The statement has columns: Date | Particulars | Withdrawal(Dr) | Deposit(Cr) | Balance

• Amount in WITHDRAWAL column = type "EXPENSE" (money OUT)
• Amount in DEPOSIT column = type "INCOME" (money IN)

TRANSACTION EXAMPLES:
- "UPI-ZOMATO" with 450.00 in Withdrawal → EXPENSE
- "SALARY CREDIT" with 50000 in Deposit → INCOME
- "ATM CASH WDL" with 10000 in Withdrawal → EXPENSE
- "INT CR" with 123.45 in Deposit → INCOME

OUTPUT JSON ARRAY:
[
  {
    "date": "YYYY-MM-DD",
    "merchant": "Clean name (remove UPI-/NEFT- prefixes)",
    "amount": 1234.56,
    "type": "EXPENSE" or "INCOME",
    "mode": "UPI|NEFT|IMPS|ATM|POS|IFT|Other",
    "category": "Category name",
    "note": "Original description verbatim"
  }
]

CATEGORIES:
Expense: Groceries, Dining, Food Delivery, Transport, Fuel, Shopping, Streaming, Entertainment, Utilities, Phone, Healthcare, Insurance, EMI, Bills, Transfer, Cash/ATM, Investment
Income: Salary, Interest, Refund, Transfer, Investment, Dividends, Other

TEXT TO PARSE:
`;

async function parsePageTransactions(pageText: string, pageNum: number): Promise<RawTransaction[]> {
    const prompt = IDFC_EXTRACTION_PROMPT + pageText + `\n\nThis is page ${pageNum}. Return JSON array only.`;
    
    try {
        const response = await ollamaGenerate(EXTRACTION_MODEL, prompt, 'json');
        const transactions = safeParseJSON(response);
        
        return transactions.filter(t => {
            if (!t.date || !t.amount || !t.type) return false;
            if (typeof t.amount !== 'number' || t.amount <= 0) return false;
            if (t.type !== 'INCOME' && t.type !== 'EXPENSE') return false;
            return true;
        }).map(t => fullPostProcess(t));
    } catch (error) {
        console.warn(`Page ${pageNum} parsing failed:`, error);
        return [];
    }
}

// ═══════════════════════════════════════════════════════════════
// JSON PARSING UTILITIES
// ═══════════════════════════════════════════════════════════════

function safeParseJSON(jsonString: string): RawTransaction[] {
    // Strategy 1: Direct parse
    try {
        const parsed = JSON.parse(jsonString);
        return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
        console.warn('Direct parse failed, attempting repair...');
    }
    
    // Strategy 2: Extract JSON array from response
    try {
        const match = jsonString.match(/\[[\s\S]*\]/);
        if (match) {
            return JSON.parse(match[0]);
        }
    } catch (e) {
        console.warn('Array extraction failed');
    }
    
    // Strategy 3: Extract individual objects
    try {
        const objectMatches = jsonString.match(/\{[^{}]*"date"[^{}]*"amount"[^{}]*\}/g);
        if (objectMatches) {
            const transactions: RawTransaction[] = [];
            for (const match of objectMatches) {
                try {
                    const obj = JSON.parse(match);
                    if (obj.date && obj.amount && obj.type) {
                        transactions.push(obj);
                    }
                } catch (e) {}
            }
            return transactions;
        }
    } catch (e) {}
    
    return [];
}

// ═══════════════════════════════════════════════════════════════
// POST-PROCESSING (same logic as geminiService)
// ═══════════════════════════════════════════════════════════════

const MERCHANT_MAP: Record<string, string> = {
    'zomato': 'Food Delivery', 'swiggy': 'Food Delivery',
    'bigbasket': 'Groceries', 'blinkit': 'Groceries', 'zepto': 'Groceries',
    'amazon': 'Shopping', 'flipkart': 'Shopping', 'myntra': 'Shopping',
    'uber': 'Transport', 'ola': 'Transport', 'rapido': 'Transport',
    'netflix': 'Streaming', 'hotstar': 'Streaming', 'spotify': 'Streaming',
    'jio': 'Phone', 'airtel': 'Phone', 'vi': 'Phone',
    'bescom': 'Utilities', 'bpcl': 'Fuel', 'hpcl': 'Fuel',
};

const INVESTMENT_KEYWORDS = [
    'choice', 'equity', 'broking', 'zerodha', 'groww', 'upstox',
    'mutual fund', 'mf ', 'prudential', 'redemption', 'dividend'
];

function classifyTransactionNature(t: RawTransaction): RawTransaction {
    const desc = (t.note || t.merchant || '').toLowerCase();
    const combined = `${desc} ${t.merchant.toLowerCase()}`;
    
    let nature: TransactionNature = 'UNCATEGORIZED';
    let incomeSource: IncomeSource | undefined;
    let category = t.category || 'Uncategorized';
    
    // ATM/Cash
    if (combined.includes('atm') || combined.includes('cash wdl')) {
        nature = 'CASH_OUT';
        category = 'Cash/ATM';
    }
    // Investment
    else if (INVESTMENT_KEYWORDS.some(kw => combined.includes(kw))) {
        if (t.type === 'INCOME') {
            nature = combined.includes('dividend') ? 'INVESTMENT_RETURN' : 'INVESTMENT_INFLOW';
            incomeSource = combined.includes('choice') ? 'Choice' : 'Other';
        } else {
            nature = 'INVESTMENT_OUTFLOW';
        }
        category = 'Investment';
    }
    // Interest
    else if (combined.includes('interest') || combined.includes('int cr')) {
        nature = 'PASSIVE_INCOME';
        incomeSource = 'Interest';
        category = 'Interest';
    }
    // Salary
    else if (combined.includes('salary') || combined.includes('payroll')) {
        nature = 'SALARY';
        incomeSource = 'Salary';
        category = 'Salary';
    }
    // Transfer
    else if (combined.includes('ift') || combined.includes('neft') || combined.includes('imps')) {
        nature = 'TRANSFER';
        if (t.type === 'INCOME') incomeSource = 'Transfer';
        category = 'Transfer';
    }
    // Merchant spending
    else if (Object.keys(MERCHANT_MAP).some(m => combined.includes(m))) {
        nature = 'CONSUMPTION';
        for (const [merchant, cat] of Object.entries(MERCHANT_MAP)) {
            if (combined.includes(merchant)) {
                category = cat;
                break;
            }
        }
    }
    // Refunds
    else if (combined.includes('refund') || combined.includes('cashback')) {
        nature = 'PASSIVE_INCOME';
        incomeSource = 'Refund';
        category = 'Refund';
    }
    // Default
    else {
        if (t.mode === 'UPI' && t.type === 'EXPENSE') nature = 'CONSUMPTION';
        else if (t.mode === 'POS') nature = 'CONSUMPTION';
    }
    
    return {
        ...t,
        nature,
        incomeSource: t.type === 'INCOME' ? incomeSource : undefined,
        category
    };
}

function postProcessTransaction(t: RawTransaction): RawTransaction {
    const combined = `${(t.note || '')} ${t.merchant}`.toLowerCase();
    let correctedType = t.type;
    
    // Force correct types for known patterns
    if (combined.includes('salary') || combined.includes('payroll')) correctedType = 'INCOME';
    if (combined.includes('atm') || combined.includes('cash wdl')) correctedType = 'EXPENSE';
    if (combined.includes('interest') && combined.includes('cr')) correctedType = 'INCOME';
    if (combined.includes('refund') || combined.includes('cashback')) correctedType = 'INCOME';
    if (combined.includes('credit card') && combined.includes('bill')) correctedType = 'EXPENSE';
    
    // Clean merchant name
    let cleanedMerchant = t.merchant
        .replace(/^(UPI[-\/]?|NEFT[-\/]?|IMPS[-\/]?|RTGS[-\/]?|POS\s*)/gi, '')
        .replace(/[-\/]?\d{10,}[-\/]?/g, '')
        .replace(/@[a-z]+$/i, '')
        .replace(/\s+/g, ' ')
        .trim();
    
    if (cleanedMerchant) {
        cleanedMerchant = cleanedMerchant.split(' ')
            .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
            .join(' ');
    } else {
        cleanedMerchant = t.merchant;
    }
    
    return { ...t, type: correctedType, merchant: cleanedMerchant };
}

function fullPostProcess(t: RawTransaction): RawTransaction {
    const typeFixed = postProcessTransaction(t);
    return classifyTransactionNature(typeFixed);
}

// ═══════════════════════════════════════════════════════════════
// VALIDATION AGAINST HEADER
// ═══════════════════════════════════════════════════════════════

function validateTransactions(transactions: RawTransaction[], header: StatementHeader): RawTransaction[] {
    let parsedDebit = transactions.filter(t => t.type === 'EXPENSE').reduce((s, t) => s + t.amount, 0);
    let parsedCredit = transactions.filter(t => t.type === 'INCOME').reduce((s, t) => s + t.amount, 0);
    
    console.log(`📊 Parsed: Debit=${parsedDebit.toFixed(2)}, Credit=${parsedCredit.toFixed(2)}`);
    console.log(`📋 Expected: Debit=${header.totalDebit.toFixed(2)}, Credit=${header.totalCredit.toFixed(2)}`);
    
    const tolerance = header.totalDebit * 0.05;
    
    if (Math.abs(parsedDebit - header.totalDebit) > tolerance || 
        Math.abs(parsedCredit - header.totalCredit) > tolerance) {
        
        // Check if swapping helps
        if (Math.abs(parsedCredit - header.totalDebit) < Math.abs(parsedDebit - header.totalDebit)) {
            console.log('🔄 Types appear swapped - correcting...');
            return transactions.map(t => ({
                ...t,
                type: t.type === 'INCOME' ? 'EXPENSE' : 'INCOME'
            }));
        }
    }
    
    console.log('✅ Validation passed');
    return transactions;
}

// ═══════════════════════════════════════════════════════════════
// DEEPSEEK-R1 MATH VERIFICATION (Chain-of-Thought)
// ═══════════════════════════════════════════════════════════════

async function verifyMathWithDeepSeek(
    transactions: RawTransaction[], 
    header: StatementHeader
): Promise<{ valid: boolean; issues: string[]; corrections: Map<number, 'INCOME' | 'EXPENSE'> }> {
    const models = await getAvailableModels();
    if (!models.some(m => m.includes('deepseek'))) {
        console.log('⚠️ DeepSeek-R1 not available, skipping math verification');
        return { valid: true, issues: [], corrections: new Map() };
    }
    
    const totalDebit = transactions.filter(t => t.type === 'EXPENSE').reduce((s, t) => s + t.amount, 0);
    const totalCredit = transactions.filter(t => t.type === 'INCOME').reduce((s, t) => s + t.amount, 0);
    
    // Create a summary for DeepSeek to analyze
    const largeTransactions = transactions
        .filter(t => t.amount > 10000)
        .map((t, i) => `[${i}] ${t.date} | ${t.merchant} | ₹${t.amount} | ${t.type} | "${t.note?.substring(0, 50) || ''}"`)
        .join('\n');
    
    const prompt = `You are a precise accounting auditor. Verify this bank statement data.

STATEMENT HEADER (Ground Truth):
- Opening Balance: ₹${header.openingBalance.toLocaleString('en-IN')}
- Total Debit (Withdrawals): ₹${header.totalDebit.toLocaleString('en-IN')}
- Total Credit (Deposits): ₹${header.totalCredit.toLocaleString('en-IN')}
- Closing Balance: ₹${header.closingBalance.toLocaleString('en-IN')}

PARSED TOTALS:
- Parsed Expenses (Debit): ₹${totalDebit.toLocaleString('en-IN')}
- Parsed Income (Credit): ₹${totalCredit.toLocaleString('en-IN')}

DISCREPANCY:
- Debit Difference: ₹${Math.abs(totalDebit - header.totalDebit).toLocaleString('en-IN')} (${totalDebit > header.totalDebit ? 'over' : 'under'})
- Credit Difference: ₹${Math.abs(totalCredit - header.totalCredit).toLocaleString('en-IN')} (${totalCredit > header.totalCredit ? 'over' : 'under'})

LARGE TRANSACTIONS (>₹10,000):
${largeTransactions || 'None'}

TASK: Think step-by-step.
1. Verify: Opening + Credit - Debit = Closing?
2. If totals don't match, identify which transactions might be misclassified
3. Common errors: Salary marked as Expense, ATM marked as Income, Refunds marked as Expense

Return JSON:
{
  "valid": boolean,
  "mathCheck": "Opening(X) + Credit(Y) - Debit(Z) = Calculated(W) vs Closing(C)",
  "issues": ["issue1", "issue2"],
  "suspiciousTransactions": [{"index": 0, "reason": "Salary should be INCOME", "correctType": "INCOME"}]
}`;

    try {
        console.log('🧮 Running DeepSeek-R1 math verification...');
        const response = await ollamaGenerate(MATH_MODEL, prompt, 'json');
        const result = JSON.parse(response);
        
        console.log(`🧮 DeepSeek Result: ${result.valid ? '✅ Valid' : '❌ Issues Found'}`);
        if (result.mathCheck) console.log(`   ${result.mathCheck}`);
        if (result.issues?.length) {
            result.issues.forEach((issue: string) => console.log(`   ⚠️ ${issue}`));
        }
        
        const corrections = new Map<number, 'INCOME' | 'EXPENSE'>();
        if (result.suspiciousTransactions) {
            result.suspiciousTransactions.forEach((s: any) => {
                if (typeof s.index === 'number' && s.correctType) {
                    corrections.set(s.index, s.correctType);
                }
            });
        }
        
        return {
            valid: result.valid ?? true,
            issues: result.issues ?? [],
            corrections
        };
    } catch (error) {
        console.warn('DeepSeek verification failed:', error);
        return { valid: true, issues: [], corrections: new Map() };
    }
}

// Apply DeepSeek corrections to transactions
function applyMathCorrections(
    transactions: RawTransaction[], 
    corrections: Map<number, 'INCOME' | 'EXPENSE'>
): RawTransaction[] {
    if (corrections.size === 0) return transactions;
    
    console.log(`🔧 Applying ${corrections.size} corrections from DeepSeek-R1...`);
    
    return transactions.map((t, i) => {
        const correction = corrections.get(i);
        if (correction && correction !== t.type) {
            console.log(`   Fixed: ${t.merchant} ₹${t.amount} (${t.type} → ${correction})`);
            return { ...t, type: correction };
        }
        return t;
    });
}

// ═══════════════════════════════════════════════════════════════
// DUPLICATE DETECTION
// ═══════════════════════════════════════════════════════════════

function detectDuplicates(transactions: RawTransaction[]): RawTransaction[] {
    const result: RawTransaction[] = [];
    
    for (let i = 0; i < transactions.length; i++) {
        const current = transactions[i];
        let isDuplicate = false;
        let duplicateOf: string | undefined;
        
        for (let j = 0; j < i; j++) {
            const other = transactions[j];
            
            if (current.amount === other.amount && 
                current.type === other.type &&
                Math.abs(new Date(current.date).getTime() - new Date(other.date).getTime()) <= 86400000) {
                isDuplicate = true;
                duplicateOf = `${other.date}-${other.merchant}-${other.amount}`;
                break;
            }
        }
        
        result.push({ ...current, isDuplicate, duplicateOf });
    }
    
    return result;
}

// ═══════════════════════════════════════════════════════════════
// MAIN EXPORT FUNCTIONS
// ═══════════════════════════════════════════════════════════════

export const parseBankStatement = async (data: string, mimeType: string): Promise<RawTransaction[]> => {
    // Check Ollama availability
    const available = await checkOllamaAvailable();
    if (!available) {
        throw new Error('Ollama is not running. Start Ollama with: ollama serve');
    }
    
    // Check model availability
    const models = await getAvailableModels();
    const hasExtractionModel = models.some(m => 
        m.includes('qwen') || m.includes('llama') || m.includes('mistral')
    );
    if (!hasExtractionModel) {
        throw new Error(`No extraction model found. Install with: ollama pull qwen2.5-vl:7b`);
    }
    
    // Log available models
    const hasVision = models.some(m => m.includes('-vl') || m.includes('vision'));
    const hasMath = models.some(m => m.includes('deepseek'));
    console.log(`🦙 Models: Vision=${hasVision ? '✅' : '❌'} | Math=${hasMath ? '✅' : '❌'}`);
    
    console.log('🦙 OLLAMA LOCAL PARSER - Starting...');
    const startTime = Date.now();
    
    let transactions: RawTransaction[] = [];
    let statementHeader: StatementHeader | null = null;
    
    if (mimeType === 'application/pdf') {
        // Extract text from PDF
        console.log('📄 Extracting text from PDF...');
        const pages = await extractTextFromPDF(data);
        console.log(`📄 Extracted ${pages.length} pages`);
        
        // Extract header from first page
        console.log('📋 STEP A: Extracting statement header...');
        statementHeader = await extractStatementHeader(pages[0]);
        
        if (statementHeader) {
            console.log('═══════════════════════════════════════════════════════');
            console.log('📋 EXPECTED TOTALS:');
            console.log(`   Total Debit:  ₹${statementHeader.totalDebit.toLocaleString('en-IN')}`);
            console.log(`   Total Credit: ₹${statementHeader.totalCredit.toLocaleString('en-IN')}`);
            console.log('═══════════════════════════════════════════════════════');
        }
        
        // Parse each page
        console.log('📑 STEP B: Parsing transactions page by page...');
        for (let i = 0; i < pages.length; i++) {
            console.log(`   Processing page ${i + 1}/${pages.length}...`);
            const pageTxns = await parsePageTransactions(pages[i], i + 1);
            console.log(`   ✅ Page ${i + 1}: ${pageTxns.length} transactions`);
            transactions.push(...pageTxns);
        }
        
        // Deduplicate
        const seen = new Set<string>();
        transactions = transactions.filter(t => {
            const key = `${t.date}-${t.amount.toFixed(2)}-${t.type}-${(t.note || '').substring(0, 30)}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
        
    } else {
        // CSV/Text - parse directly
        const prompt = IDFC_EXTRACTION_PROMPT + data + '\n\nReturn JSON array only.';
        const response = await ollamaGenerate(EXTRACTION_MODEL, prompt, 'json');
        transactions = safeParseJSON(response).map(t => fullPostProcess(t));
    }
    
    // Validate against header
    if (statementHeader && statementHeader.totalDebit > 0) {
        console.log('🔍 STEP C: Validating against header...');
        transactions = validateTransactions(transactions, statementHeader);
        
        // STEP D: DeepSeek-R1 math verification (if available)
        console.log('🧮 STEP D: DeepSeek-R1 math verification...');
        const mathResult = await verifyMathWithDeepSeek(transactions, statementHeader);
        
        if (!mathResult.valid && mathResult.corrections.size > 0) {
            transactions = applyMathCorrections(transactions, mathResult.corrections);
            // Re-validate after corrections
            transactions = validateTransactions(transactions, statementHeader);
        }
    }
    
    // Detect duplicates
    transactions = detectDuplicates(transactions);
    
    // Final stats
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const expenses = transactions.filter(t => t.type === 'EXPENSE');
    const income = transactions.filter(t => t.type === 'INCOME');
    
    console.log('═══════════════════════════════════════════════════════');
    console.log(`📊 PARSING COMPLETE (${elapsed}s)`);
    console.log(`   Total: ${transactions.length} transactions`);
    console.log(`   Expenses: ${expenses.length} | ₹${expenses.reduce((s, t) => s + t.amount, 0).toLocaleString('en-IN')}`);
    console.log(`   Income: ${income.length} | ₹${income.reduce((s, t) => s + t.amount, 0).toLocaleString('en-IN')}`);
    console.log('═══════════════════════════════════════════════════════');
    
    return transactions;
};

export const analyzeSpendingHabits = async (transactionsContext: string): Promise<string> => {
    const available = await checkOllamaAvailable();
    if (!available) return "Ollama is not running.";
    
    const prompt = `Analyze these spending habits and provide a brief, mindful insight (2-3 sentences max):

${transactionsContext}

Keep your response calming and insightful.`;
    
    try {
        return await ollamaGenerate(EXTRACTION_MODEL, prompt);
    } catch {
        return "Unable to generate insights.";
    }
};

export const categorizeTransaction = async (description: string): Promise<string> => {
    const available = await checkOllamaAvailable();
    if (!available) return "Uncategorized";
    
    const prompt = `Categorize this transaction into ONE word (Groceries, Transport, Entertainment, Dining, Shopping, Bills, Healthcare, etc.):
${description}

Reply with just the category name.`;
    
    try {
        const response = await ollamaGenerate(EXTRACTION_MODEL, prompt);
        return response.trim().split('\n')[0] || "Uncategorized";
    } catch {
        return "Uncategorized";
    }
};

// Export status check function
export const checkOllamaStatus = async (): Promise<{ available: boolean; models: string[] }> => {
    const available = await checkOllamaAvailable();
    const models = available ? await getAvailableModels() : [];
    return { available, models };
};
