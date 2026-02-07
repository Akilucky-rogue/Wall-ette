import { GoogleGenAI, Type } from "@google/genai";

const apiKey = import.meta.env.VITE_GEMINI_API_KEY || '';

// Initialize only if key is present to avoid errors on load if not configured
let ai: GoogleGenAI | null = null;
if (apiKey) {
  ai = new GoogleGenAI({ apiKey });
}

// ═══════════════════════════════════════════════════════════════
// AI-POWERED FINANCIAL ANALYSIS (PULSE/INSIGHTS)
// ═══════════════════════════════════════════════════════════════

export interface FinancialInsight {
  summary: string;
  keyFindings: string[];
  recommendations: string[];
  anomalies: string[];
  savingsOpportunities: string[];
  budgetSuggestion: string;
  riskScore: number; // 0-100
}

/**
 * Comprehensive AI analysis of spending patterns
 */
export const analyzeFinancialHealth = async (
  transactions: Array<{date: string; merchant: string; amount: number; category: string; type: string}>,
  monthlyIncome?: number
): Promise<FinancialInsight> => {
  if (!ai) {
    return {
      summary: "AI analysis unavailable",
      keyFindings: ["Connect Gemini API to unlock AI insights"],
      recommendations: ["Set up your API key in environment variables"],
      anomalies: [],
      savingsOpportunities: [],
      budgetSuggestion: "Configure AI to get personalized budget recommendations",
      riskScore: 0
    };
  }

  try {
    // Prepare transaction summary
    const expenses = transactions.filter(t => t.type === 'EXPENSE');
    const income = transactions.filter(t => t.type === 'INCOME');
    
    const categorySpend = expenses.reduce((acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + t.amount;
      return acc;
    }, {} as Record<string, number>);
    
    const totalSpent = expenses.reduce((sum, t) => sum + t.amount, 0);
    const totalEarned = income.reduce((sum, t) => sum + t.amount, 0);
    
    const prompt = `You are an expert financial advisor. Analyze this financial data and provide actionable insights in JSON format:

TRANSACTION SUMMARY:
- Period: ${transactions.length > 0 ? `${transactions[0].date} to ${transactions[transactions.length-1].date}` : 'Current month'}
- Total Expenses: ₹${totalSpent.toFixed(2)}
- Total Income: ₹${totalEarned.toFixed(2)}
- Net: ₹${(totalEarned - totalSpent).toFixed(2)}
- Transaction Count: ${transactions.length}

SPENDING BY CATEGORY:
${Object.entries(categorySpend).map(([cat, amt]) => `- ${cat}: ₹${amt.toFixed(2)} (${((amt/totalSpent)*100).toFixed(1)}%)`).join('\n')}

TOP 10 TRANSACTIONS:
${expenses.slice(0, 10).map(t => `- ${t.date}: ${t.merchant} - ₹${t.amount} (${t.category})`).join('\n')}

Provide analysis in this exact JSON structure:
{
  "summary": "2-3 sentence overview of financial health",
  "keyFindings": ["finding1", "finding2", "finding3"],
  "recommendations": ["actionable advice1", "actionable advice2", "actionable advice3"],
  "anomalies": ["unusual pattern1", "unusual pattern2"],
  "savingsOpportunities": ["opportunity1", "opportunity2", "opportunity3"],
  "budgetSuggestion": "Specific monthly budget breakdown suggestion",
  "riskScore": 45
}

Be concise, specific, and actionable. Focus on Indian rupee context.`;

    const response = await ai.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: prompt,
      config: {
        systemInstruction: "You are a mindful, expert financial advisor specializing in personal finance for Indian users. Provide clear, actionable insights in valid JSON format only. Be encouraging but realistic.",
        responseMimeType: 'application/json'
      }
    });

    const analysis = JSON.parse(response.text);
    return analysis;
    
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    return {
      summary: "Analysis temporarily unavailable. Your spending data is processing.",
      keyFindings: ["Unable to analyze at this moment", "Try again in a few moments"],
      recommendations: ["Continue tracking your expenses", "Review your category breakdown manually"],
      anomalies: [],
      savingsOpportunities: ["Check your largest expense categories for optimization"],
      budgetSuggestion: "Set a budget for your top 3 spending categories",
      riskScore: 50
    };
  }
};

/**
 * Quick AI spending insight (single sentence)
 */
export const analyzeSpendingHabits = async (transactionsContext: string) => {
  if (!ai) return "AI service not configured.";
  
  try {
    const response = await ai.models.generateContent({
        model: 'gemini-1.5-flash',
        contents: `Analyze these spending habits and provide a brief, mindful insight: ${transactionsContext}`,
        config: {
            systemInstruction: "You are a mindful financial assistant. Keep responses short, calming, and insightful.",
        }
    });
    return response.text;
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Unable to generate insights at this moment.";
  }
};

export const categorizeTransaction = async (description: string) => {
    if (!ai) return "Uncategorized";
    
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-1.5-flash',
            contents: `Categorize this transaction description into a single word category (e.g., Groceries, Transport, Entertainment): ${description}`,
        });
        return response.text?.trim() || "Uncategorized";
    } catch (error) {
        return "Uncategorized";
    }
}

// ═══════════════════════════════════════════════════════════════
// BULLETPROOF BANK STATEMENT PARSER
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
// STEP C: TRANSACTION NATURE TYPES
// Classification is logical, not financial - nothing is ignored
// ═══════════════════════════════════════════════════════════════
type TransactionNature = 
    | 'CONSUMPTION'          // Merchant spending (Zomato, Amazon, etc.)
    | 'TRANSFER'             // Bank transfers (IFT, IMPS, NEFT, UPI to individuals)
    | 'CASH_OUT'             // ATM withdrawals - leaves system visibility
    | 'INVESTMENT_INFLOW'    // Credits from brokers (Choice, Zerodha, etc.)
    | 'INVESTMENT_OUTFLOW'   // Debits to brokers
    | 'INVESTMENT_RETURN'    // MF redemptions, dividends
    | 'PASSIVE_INCOME'       // Interest, cashback
    | 'SALARY'               // Regular salary credits
    | 'UNCATEGORIZED';       // Needs user classification

type IncomeSource = 
    | 'Salary'
    | 'Choice'               // Choice Equity / Broking
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
    type: "INCOME" | "EXPENSE";        // Direction: Debit=EXPENSE, Credit=INCOME
    mode?: string;                       // UPI, NEFT, IMPS, ATM, IFT, POS, RTGS, Other
    nature?: TransactionNature;          // Logical classification (STEP C)
    category?: string;
    incomeSource?: IncomeSource;         // Only for INCOME transactions
    note?: string;                       // Original description - NEVER altered
    balance?: number;                    // Post-transaction balance for verification
    isDuplicate?: boolean;               // Flag for possible duplicate
    duplicateOf?: string;                // Reference to original if duplicate
}

// Statement header metadata for validation
interface StatementHeader {
    bankName?: string;
    accountNumber?: string;
    statementPeriod?: { from: string; to: string };
    openingBalance: number;
    closingBalance: number;
    totalDebit: number;
    totalCredit: number;
}

// Extract statement header from first page
async function extractStatementHeader(data: string, mimeType: string): Promise<StatementHeader | null> {
    if (!ai) return null;
    
    try {
        const parts: any[] = [];
        parts.push({
            inlineData: {
                mimeType: mimeType,
                data: data
            }
        });
        
        parts.push({ text: `Extract the statement summary information from PAGE 1 of this bank statement.

Look for these fields (usually at the top or in a summary table):
- Opening Balance (starting balance at beginning of period)
- Closing Balance (ending balance at end of period)  
- Total Debit / Total Withdrawal (money that went OUT)
- Total Credit / Total Deposit (money that came IN)
- Statement Period (date range)

IMPORTANT: 
- Return the EXACT numbers shown in the statement
- Total Debit = sum of all withdrawals/debits
- Total Credit = sum of all deposits/credits
- Verify: Opening + Total Credit - Total Debit ≈ Closing

Return JSON:
{
  "bankName": "bank name",
  "openingBalance": number,
  "closingBalance": number,
  "totalDebit": number,
  "totalCredit": number,
  "periodFrom": "YYYY-MM-DD",
  "periodTo": "YYYY-MM-DD"
}

Return ONLY the JSON, nothing else.` });

        const response = await ai.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: { parts },
            config: {
                responseMimeType: "application/json",
                maxOutputTokens: 1024
            }
        });
        
        const text = response.text || '{}';
        const parsed = JSON.parse(text);
        
        console.log('📋 Statement Header Extracted:', parsed);
        
        // Validate the math: Opening + Credit - Debit ≈ Closing
        const calculatedClosing = parsed.openingBalance + parsed.totalCredit - parsed.totalDebit;
        const tolerance = Math.abs(parsed.closingBalance * 0.01); // 1% tolerance
        const mathValid = Math.abs(calculatedClosing - parsed.closingBalance) <= tolerance;
        
        if (!mathValid) {
            console.warn(`⚠️ Statement math check failed: ${parsed.openingBalance} + ${parsed.totalCredit} - ${parsed.totalDebit} = ${calculatedClosing}, expected ${parsed.closingBalance}`);
        } else {
            console.log(`✅ Statement math verified: Opening(${parsed.openingBalance}) + Credit(${parsed.totalCredit}) - Debit(${parsed.totalDebit}) = Closing(${parsed.closingBalance})`);
        }
        
        return {
            bankName: parsed.bankName,
            openingBalance: parsed.openingBalance || 0,
            closingBalance: parsed.closingBalance || 0,
            totalDebit: parsed.totalDebit || 0,
            totalCredit: parsed.totalCredit || 0,
            statementPeriod: parsed.periodFrom && parsed.periodTo ? {
                from: parsed.periodFrom,
                to: parsed.periodTo
            } : undefined
        };
    } catch (error) {
        console.error('Failed to extract statement header:', error);
        return null;
    }
}

// Validate parsed transactions against statement header
function validateAndCorrectTransactions(
    transactions: RawTransaction[], 
    header: StatementHeader
): RawTransaction[] {
    // Calculate totals from parsed transactions
    let parsedDebit = 0;  // EXPENSE
    let parsedCredit = 0; // INCOME
    
    transactions.forEach(t => {
        if (t.type === 'EXPENSE') parsedDebit += t.amount;
        else if (t.type === 'INCOME') parsedCredit += t.amount;
    });
    
    console.log(`📊 Parsed Totals: Debit=${parsedDebit.toFixed(2)}, Credit=${parsedCredit.toFixed(2)}`);
    console.log(`📋 Statement Totals: Debit=${header.totalDebit.toFixed(2)}, Credit=${header.totalCredit.toFixed(2)}`);
    
    // Calculate discrepancies
    const debitDiff = parsedDebit - header.totalDebit;
    const creditDiff = parsedCredit - header.totalCredit;
    
    // If differences are opposite and roughly equal, types are swapped
    const tolerance = header.totalDebit * 0.05; // 5% tolerance
    
    if (Math.abs(debitDiff) > tolerance || Math.abs(creditDiff) > tolerance) {
        console.warn(`⚠️ Significant discrepancy detected!`);
        console.warn(`   Debit difference: ${debitDiff.toFixed(2)} (parsed ${parsedDebit.toFixed(2)}, expected ${header.totalDebit.toFixed(2)})`);
        console.warn(`   Credit difference: ${creditDiff.toFixed(2)} (parsed ${parsedCredit.toFixed(2)}, expected ${header.totalCredit.toFixed(2)})`);
        
        // Check if swapping would help
        const swappedDebit = parsedCredit;
        const swappedCredit = parsedDebit;
        const swappedDebitDiff = Math.abs(swappedDebit - header.totalDebit);
        const swappedCreditDiff = Math.abs(swappedCredit - header.totalCredit);
        
        if (swappedDebitDiff < Math.abs(debitDiff) && swappedCreditDiff < Math.abs(creditDiff)) {
            console.log('🔄 Types appear to be globally swapped - correcting all transactions...');
            return transactions.map(t => ({
                ...t,
                type: t.type === 'INCOME' ? 'EXPENSE' : 'INCOME'
            }));
        }
        
        // Try to identify and fix individual misclassified transactions
        console.log('🔧 Attempting to fix individual misclassified transactions...');
        return smartCorrectTransactions(transactions, header);
    }
    
    console.log('✅ Transaction totals match statement header within tolerance');
    return transactions;
}

// Smart correction using statement totals as ground truth
function smartCorrectTransactions(
    transactions: RawTransaction[], 
    header: StatementHeader
): RawTransaction[] {
    // Sort by amount (largest first) - big misclassifications have biggest impact
    const sortedByAmount = [...transactions].sort((a, b) => b.amount - a.amount);
    
    let currentDebit = transactions.filter(t => t.type === 'EXPENSE').reduce((sum, t) => sum + t.amount, 0);
    let currentCredit = transactions.filter(t => t.type === 'INCOME').reduce((sum, t) => sum + t.amount, 0);
    
    const targetDebit = header.totalDebit;
    const targetCredit = header.totalCredit;
    
    const correctedIds = new Set<number>();
    
    // Try swapping transactions to get closer to target
    for (let i = 0; i < sortedByAmount.length && correctedIds.size < 50; i++) {
        const t = sortedByAmount[i];
        const idx = transactions.indexOf(t);
        
        // Calculate what happens if we swap this transaction's type
        let newDebit = currentDebit;
        let newCredit = currentCredit;
        
        if (t.type === 'EXPENSE') {
            newDebit -= t.amount;
            newCredit += t.amount;
        } else {
            newCredit -= t.amount;
            newDebit += t.amount;
        }
        
        // Check if swap improves accuracy
        const currentError = Math.abs(currentDebit - targetDebit) + Math.abs(currentCredit - targetCredit);
        const newError = Math.abs(newDebit - targetDebit) + Math.abs(newCredit - targetCredit);
        
        if (newError < currentError - 1) { // Must improve by at least ₹1
            correctedIds.add(idx);
            currentDebit = newDebit;
            currentCredit = newCredit;
            console.log(`   Flipped: ${t.merchant} ₹${t.amount} (${t.type} → ${t.type === 'INCOME' ? 'EXPENSE' : 'INCOME'})`);
        }
    }
    
    console.log(`🔧 Corrected ${correctedIds.size} transactions`);
    console.log(`📊 Final Totals: Debit=${currentDebit.toFixed(2)}, Credit=${currentCredit.toFixed(2)}`);
    
    return transactions.map((t, idx) => {
        if (correctedIds.has(idx)) {
            return { ...t, type: t.type === 'INCOME' ? 'EXPENSE' : 'INCOME' };
        }
        return t;
    });
}

// Repair malformed JSON from AI responses
function repairJSON(jsonString: string): string {
    let repaired = jsonString.trim();
    
    // Remove markdown code blocks if present
    repaired = repaired.replace(/```json\s*/gi, '').replace(/```\s*/g, '');
    
    // Find the array boundaries
    const startIdx = repaired.indexOf('[');
    const endIdx = repaired.lastIndexOf(']');
    
    if (startIdx === -1) return '[]';
    
    // Extract just the array portion
    if (endIdx > startIdx) {
        repaired = repaired.substring(startIdx, endIdx + 1);
    } else {
        repaired = repaired.substring(startIdx) + ']';
    }
    
    // Fix common JSON issues
    // 1. Fix unterminated strings before commas/brackets
    repaired = repaired.replace(/([^"\\])("\s*[^":,\}\]"]*)(\s*[,\}\]])/g, '$1$2"$3');
    
    // 2. Fix missing quotes around property values
    repaired = repaired.replace(/:(\s*)([A-Za-z][A-Za-z0-9_]*)\s*([,\}])/g, ':$1"$2"$3');
    
    // 3. Remove trailing commas before ] or }
    repaired = repaired.replace(/,(\s*[\]\}])/g, '$1');
    
    // 4. Fix incomplete objects at the end
    const openBraces = (repaired.match(/\{/g) || []).length;
    const closeBraces = (repaired.match(/\}/g) || []).length;
    
    if (openBraces > closeBraces) {
        // Find the last complete object
        let lastCompleteIndex = repaired.length - 1;
        let depth = 0;
        
        for (let i = repaired.length - 1; i >= 0; i--) {
            if (repaired[i] === '}') depth++;
            if (repaired[i] === '{') depth--;
            if (depth === 0 && repaired[i] === '}') {
                lastCompleteIndex = i;
                break;
            }
        }
        
        // Truncate to last complete object
        repaired = repaired.substring(0, lastCompleteIndex + 1);
        if (!repaired.endsWith(']')) {
            repaired += ']';
        }
    }
    
    return repaired;
}

// Parse JSON with multiple fallback strategies
function safeParseJSON(jsonString: string): RawTransaction[] {
    // Strategy 1: Direct parse
    try {
        return JSON.parse(jsonString);
    } catch (e) {
        console.warn('Direct parse failed, attempting repair...');
    }
    
    // Strategy 2: Repair and parse
    try {
        const repaired = repairJSON(jsonString);
        return JSON.parse(repaired);
    } catch (e) {
        console.warn('Repaired parse failed, attempting line-by-line extraction...');
    }
    
    // Strategy 3: Extract individual objects using regex
    try {
        const objectMatches = jsonString.match(/\{[^{}]*"date"[^{}]*"amount"[^{}]*\}/g);
        if (objectMatches && objectMatches.length > 0) {
            const transactions: RawTransaction[] = [];
            for (const match of objectMatches) {
                try {
                    const obj = JSON.parse(match);
                    if (obj.date && obj.amount && obj.type) {
                        transactions.push(obj);
                    }
                } catch (e) {
                    // Skip malformed object
                }
            }
            if (transactions.length > 0) {
                console.log(`Extracted ${transactions.length} transactions via regex`);
                return transactions;
            }
        }
    } catch (e) {
        console.warn('Regex extraction failed');
    }
    
    // Strategy 4: Return empty array as last resort
    console.error('All JSON parsing strategies failed');
    return [];
}

// ═══════════════════════════════════════════════════════════════
// POST-PROCESSING FOR ACCURACY
// ═══════════════════════════════════════════════════════════════

// Keywords that indicate INCOME (should NEVER be EXPENSE)
// Keywords that STRONGLY indicate INCOME (money coming IN)
const INCOME_KEYWORDS = [
    'salary', 'sal cr', 'wages', 'payroll', 'stipend',
    'interest credited', 'int cr', 'int.cr', 'savings interest',
    'refund', 'reversal', 'cashback', 'cash back',
    'received', 'recd', 'inward', 'inw ',
    'dividend', 'div cr',
    'bonus', 'reward', 'incentive', 'reimbursement',
    'rent received', 'maturity', 'pension',
    'neft cr', 'imps cr', 'upi cr', 'rtgs cr',
    'credit - ', 'by transfer', 'by clg',
    'from ', // "transfer from" patterns
];

// Keywords that STRONGLY indicate EXPENSE (money going OUT)  
const EXPENSE_KEYWORDS = [
    'purchase', 'payment', 'paid', 'paying',
    'withdrawal', 'wdl', 'atm', 'cash wdl',
    'pos ', 'ecom', 'buy', 'buying',
    'debit', 'debited', 'dr ', ' dr',
    'charge', 'charges', 'fee', 'fees',
    'subscription', 'emi', 'bill pay', 'billpay',
    'outward', 'spent', 'spending',
    'online txn', 'online transaction',
    'neft dr', 'imps dr', 'upi dr', 'rtgs dr',
    'to ', // "transfer to" patterns (but not "interest to date")
    'upi-', 'upi/', 'neft-', 'imps-', // Payment prefixes
    'mmt/', 'paytm', 'gpay', 'phonepe', 'amazon pay',
    'zomato', 'swiggy', 'uber', 'ola', // Common merchants
];

// Keywords to IGNORE when checking income/expense (ambiguous)
const IGNORE_KEYWORDS = [
    'credit card', 'hdfc credit', 'icici credit', 'sbi credit', 'axis credit', // Credit card payments = expense
    'to date', 'from date', // Date references
];

// ═══════════════════════════════════════════════════════════════
// STEP C: TRANSACTION CLASSIFICATION LOGIC
// Classification is logical, not financial - NOTHING is ignored
// ═══════════════════════════════════════════════════════════════

// Known merchants for CONSUMPTION classification
const MERCHANT_MAP: Record<string, string> = {
    // Food Delivery
    'zomato': 'Food Delivery', 'swiggy': 'Food Delivery', 'eatsure': 'Food Delivery',
    'dunzo': 'Food Delivery', 'zepto': 'Food Delivery', 'blinkit': 'Groceries',
    // Groceries
    'bigbasket': 'Groceries', 'jiomart': 'Groceries', 'dmart': 'Groceries',
    'instamart': 'Groceries', 'grofers': 'Groceries', 'spencers': 'Groceries',
    // Shopping
    'amazon': 'Shopping', 'flipkart': 'Shopping', 'myntra': 'Shopping',
    'meesho': 'Shopping', 'ajio': 'Shopping', 'nykaa': 'Shopping',
    // Transport
    'uber': 'Transport', 'ola': 'Transport', 'rapido': 'Transport',
    'irctc': 'Travel', 'redbus': 'Travel', 'makemytrip': 'Travel',
    // Digital Services
    'google': 'Digital', 'apple': 'Digital', 'microsoft': 'Digital',
    'netflix': 'Streaming', 'hotstar': 'Streaming', 'spotify': 'Streaming',
    'prime video': 'Streaming', 'youtube': 'Streaming', 'zee5': 'Streaming',
    // Telecom
    'jio': 'Phone', 'airtel': 'Phone', 'vodafone': 'Phone', 'vi ': 'Phone',
    // Utilities
    'bescom': 'Utilities', 'bsnl': 'Utilities', 'tata power': 'Utilities',
    // Food/Dining
    'dominos': 'Dining', 'mcdonalds': 'Dining', 'kfc': 'Dining',
    'starbucks': 'Dining', 'ccd': 'Dining', 'pizza hut': 'Dining',
    // Fuel
    'bpcl': 'Fuel', 'hpcl': 'Fuel', 'iocl': 'Fuel', 'indian oil': 'Fuel',
    'petrol': 'Fuel', 'diesel': 'Fuel', 'reliance fuel': 'Fuel',
};

// Investment/Broker keywords
const INVESTMENT_KEYWORDS = [
    'choice', 'equity', 'broking', 'broker',
    'zerodha', 'groww', 'upstox', 'angel', 'kite',
    'mutual fund', 'mf ', 'prudential', 'icici pru',
    'hdfc mf', 'sbi mf', 'axis mf', 'redemption',
    'dividend', 'nse', 'bse', 'cdsl', 'nsdl'
];

/**
 * STEP C: Classify transaction nature and assign income source
 * This implements the exact decision tree from the spec
 * 
 * IMPORTANT: Nothing is filtered or ignored - only classified
 */
function classifyTransactionNature(t: RawTransaction): RawTransaction {
    const desc = (t.note || t.merchant || '').toLowerCase();
    const merchant = t.merchant.toLowerCase();
    const combined = `${desc} ${merchant}`;
    
    let nature: TransactionNature = 'UNCATEGORIZED';
    let incomeSource: IncomeSource | undefined;
    let suggestedCategory = t.category || 'Uncategorized';
    
    // ═══════════════════════════════════════════════════════════════
    // STEP 2: Determine Transaction Nature (Logical, Not Financial)
    // ═══════════════════════════════════════════════════════════════
    
    // Rule 2.1 — Identify Cash Movement
    if (combined.includes('atm') || combined.includes('atm-nfs') || 
        combined.includes('cash withdrawal') || combined.includes('cash wdl') ||
        combined.includes('nfs wdl')) {
        nature = 'CASH_OUT';
        suggestedCategory = 'Cash/ATM';
    }
    // Rule 2.3 — Identify Market / Investment Flows (check before transfers)
    else if (INVESTMENT_KEYWORDS.some(kw => combined.includes(kw))) {
        if (t.type === 'INCOME') {
            // Credit from broker = Investment inflow
            if (combined.includes('redemption') || combined.includes('dividend')) {
                nature = 'INVESTMENT_RETURN';
                incomeSource = combined.includes('dividend') ? 'Dividends' : 'MF_Redemption';
            } else {
                nature = 'INVESTMENT_INFLOW';
                incomeSource = combined.includes('choice') ? 'Choice' : 'Other';
            }
            suggestedCategory = 'Investment';
        } else {
            // Debit to broker = Investment outflow
            nature = 'INVESTMENT_OUTFLOW';
            suggestedCategory = 'Investment';
        }
    }
    // Rule 2.4 — Identify Mutual Fund Activity
    else if (combined.includes('mutual fund') || combined.includes(' mf ') || 
             combined.includes('prudential') || combined.includes('icici pru')) {
        if (t.type === 'INCOME') {
            nature = 'INVESTMENT_RETURN';
            incomeSource = 'MF_Redemption';
        } else {
            nature = 'INVESTMENT_OUTFLOW';
        }
        suggestedCategory = 'Investment';
    }
    // Rule 2.5 — Identify Interest / Passive Income
    else if (combined.includes('interest') || combined.includes('int cr') || 
             combined.includes('int.cr') || combined.includes('savings interest')) {
        nature = 'PASSIVE_INCOME';
        incomeSource = 'Interest';
        suggestedCategory = 'Interest';
    }
    // Identify Salary
    else if (combined.includes('salary') || combined.includes('sal cr') || 
             combined.includes('payroll') || combined.includes('wages')) {
        nature = 'SALARY';
        incomeSource = 'Salary';
        suggestedCategory = 'Salary';
    }
    // Rule 2.2 — Identify Bank Transfers (IFT, IMPS, NEFT, UPI to individuals)
    else if (combined.includes('ift') || 
             (combined.includes('imps') && !isKnownMerchant(combined)) ||
             (combined.includes('neft') && !isKnownMerchant(combined)) ||
             (combined.includes('upi') && !isKnownMerchant(combined) && isPersonTransfer(combined))) {
        nature = 'TRANSFER';
        if (t.type === 'INCOME') {
            incomeSource = 'Transfer';
        }
        suggestedCategory = 'Transfer';
    }
    // Rule 2.6 — Identify Merchant Spending
    else if (isKnownMerchant(combined)) {
        nature = 'CONSUMPTION';
        suggestedCategory = getMerchantCategory(combined);
    }
    // Check for refunds
    else if (combined.includes('refund') || combined.includes('reversal') || 
             combined.includes('cashback') || combined.includes('cash back')) {
        nature = 'PASSIVE_INCOME';
        incomeSource = 'Refund';
        suggestedCategory = 'Refund';
    }
    // Default handling based on mode
    else {
        // UPI payments to merchants are typically consumption
        if (t.mode === 'UPI' && t.type === 'EXPENSE') {
            nature = 'CONSUMPTION';
        } else if (t.mode === 'POS') {
            nature = 'CONSUMPTION';
        } else if (t.type === 'INCOME' && (t.mode === 'NEFT' || t.mode === 'IMPS' || t.mode === 'RTGS')) {
            nature = 'TRANSFER';
            incomeSource = 'Transfer';
        } else {
            nature = 'UNCATEGORIZED';
        }
    }
    
    // ═══════════════════════════════════════════════════════════════
    // STEP 4: Income Source Assignment (Only for Credits)
    // ═══════════════════════════════════════════════════════════════
    if (t.type === 'INCOME' && !incomeSource) {
        // Assign default income source based on nature
        switch (nature) {
            case 'INVESTMENT_INFLOW':
                incomeSource = combined.includes('choice') ? 'Choice' : 'Other';
                break;
            case 'INVESTMENT_RETURN':
                incomeSource = combined.includes('dividend') ? 'Dividends' : 'MF_Redemption';
                break;
            case 'PASSIVE_INCOME':
                incomeSource = 'Interest';
                break;
            case 'SALARY':
                incomeSource = 'Salary';
                break;
            case 'TRANSFER':
                incomeSource = 'Transfer';
                break;
            default:
                incomeSource = 'Other';
        }
    }
    
    return {
        ...t,
        nature,
        incomeSource: t.type === 'INCOME' ? incomeSource : undefined,
        category: suggestedCategory
    };
}

// Helper: Check if description contains a known merchant
function isKnownMerchant(desc: string): boolean {
    return Object.keys(MERCHANT_MAP).some(merchant => desc.includes(merchant));
}

// Helper: Get category for known merchant
function getMerchantCategory(desc: string): string {
    for (const [merchant, category] of Object.entries(MERCHANT_MAP)) {
        if (desc.includes(merchant)) return category;
    }
    return 'Shopping';
}

// Helper: Check if UPI transfer is to a person (not merchant)
function isPersonTransfer(desc: string): boolean {
    // Person transfers typically have names, not merchant patterns
    // Merchants usually have @axis, @paytm, @ybl patterns with company names
    const merchantPatterns = [
        'razorpay', 'paytm', 'phonepe', 'googlepay', 'amazonpay',
        '@axis', '@icici', '@hdfc', '@ybl', '@sbi',
        'merchant', 'pvt ltd', 'private limited', 'llp', 'technologies'
    ];
    
    // If it looks like a merchant, it's not a person transfer
    if (merchantPatterns.some(p => desc.includes(p))) {
        // But check if it's specifically a person (like family)
        const personIndicators = ['dad', 'mom', 'wife', 'husband', 'brother', 'sister', 'family'];
        return personIndicators.some(p => desc.includes(p));
    }
    
    return true; // Default to person transfer if no merchant patterns found
}

// ═══════════════════════════════════════════════════════════════
// DUPLICATE DETECTION
// Duplicates are FLAGGED, never removed automatically
// ═══════════════════════════════════════════════════════════════

/**
 * Detect possible duplicates in transaction list
 * Returns transactions with isDuplicate flag set
 */
function detectDuplicates(transactions: RawTransaction[]): RawTransaction[] {
    const result: RawTransaction[] = [];
    
    for (let i = 0; i < transactions.length; i++) {
        const current = transactions[i];
        let isDuplicate = false;
        let duplicateOf: string | undefined;
        
        // Check against previous transactions only (not future ones)
        for (let j = 0; j < i; j++) {
            const other = transactions[j];
            
            if (arePossibleDuplicates(current, other)) {
                isDuplicate = true;
                duplicateOf = `${other.date}-${other.merchant}-${other.amount}`;
                break;
            }
        }
        
        result.push({
            ...current,
            isDuplicate,
            duplicateOf
        });
    }
    
    const duplicateCount = result.filter(t => t.isDuplicate).length;
    if (duplicateCount > 0) {
        console.log(`⚠️ Detected ${duplicateCount} possible duplicate transactions`);
    }
    
    return result;
}

/**
 * Check if two transactions are possible duplicates
 * Criteria: same date (±1 day), same amount, same direction, similar description
 */
function arePossibleDuplicates(a: RawTransaction, b: RawTransaction): boolean {
    // Same amount
    if (a.amount !== b.amount) return false;
    
    // Same direction (type)
    if (a.type !== b.type) return false;
    
    // Same date (±1 day)
    const dateA = new Date(a.date);
    const dateB = new Date(b.date);
    const dayDiff = Math.abs(dateA.getTime() - dateB.getTime()) / (1000 * 60 * 60 * 24);
    if (dayDiff > 1) return false;
    
    // Description similarity > 85%
    const similarity = calculateSimilarity(
        (a.note || a.merchant || '').toLowerCase(),
        (b.note || b.merchant || '').toLowerCase()
    );
    
    return similarity > 0.85;
}

/**
 * Calculate string similarity (simple Jaccard-like approach)
 */
function calculateSimilarity(str1: string, str2: string): number {
    if (str1 === str2) return 1;
    if (!str1 || !str2) return 0;
    
    // Tokenize
    const tokens1 = new Set(str1.split(/\s+/).filter(t => t.length > 2));
    const tokens2 = new Set(str2.split(/\s+/).filter(t => t.length > 2));
    
    if (tokens1.size === 0 || tokens2.size === 0) return 0;
    
    // Calculate intersection
    let intersection = 0;
    tokens1.forEach(t => {
        if (tokens2.has(t)) intersection++;
    });
    
    // Jaccard similarity
    const union = tokens1.size + tokens2.size - intersection;
    return intersection / union;
}
function postProcessTransaction(t: RawTransaction): RawTransaction {
    const noteLower = (t.note || t.merchant || '').toLowerCase();
    const merchantLower = t.merchant.toLowerCase();
    const combined = `${noteLower} ${merchantLower}`;
    
    // Fix type based on keywords in description
    let correctedType = t.type;
    
    // First, check for ambiguous keywords that should be ignored
    const hasIgnoreKeyword = IGNORE_KEYWORDS.some(kw => combined.includes(kw));
    
    // If "credit card" is mentioned, it's likely a credit card BILL PAYMENT (expense)
    if (combined.includes('credit card') || combined.includes('hdfc credit') || 
        combined.includes('icici credit') || combined.includes('sbi credit')) {
        correctedType = 'EXPENSE';
    }
    // Salary/wages should ALWAYS be income
    else if (combined.includes('salary') || combined.includes('wages') || 
             combined.includes('payroll') || combined.includes('sal cr')) {
        correctedType = 'INCOME';
    }
    // ATM withdrawal should ALWAYS be expense
    else if (combined.includes('atm') || combined.includes('cash wdl') || 
             (combined.includes('withdrawal') && !combined.includes('refund'))) {
        correctedType = 'EXPENSE';
    }
    // Interest credit should be income
    else if (combined.includes('interest') && 
             (combined.includes(' cr') || combined.includes('credited') || combined.includes('int cr'))) {
        correctedType = 'INCOME';
    }
    // Refunds should be income
    else if (combined.includes('refund') || combined.includes('reversal') || 
             combined.includes('cashback') || combined.includes('cash back')) {
        correctedType = 'INCOME';
    }
    // UPI/NEFT/IMPS with specific direction indicators
    else if (combined.includes('neft cr') || combined.includes('imps cr') || 
             combined.includes('upi cr') || combined.includes('rtgs cr') ||
             combined.includes('by transfer') || combined.includes('by clg')) {
        correctedType = 'INCOME';
    }
    else if (combined.includes('neft dr') || combined.includes('imps dr') || 
             combined.includes('upi dr') || combined.includes('rtgs dr')) {
        correctedType = 'EXPENSE';
    }
    // UPI payments (UPI-merchant pattern) are almost always expenses
    else if ((combined.match(/upi[-\/]/) || combined.match(/imps[-\/]/) || combined.match(/neft[-\/]/)) &&
             !combined.includes('refund') && !combined.includes(' cr') && !combined.includes('received')) {
        correctedType = 'EXPENSE';
    }
    // Check for "to" vs "from" patterns (careful with false positives)
    else if ((combined.includes('transfer to ') || combined.includes(' to ')) && 
             !combined.includes('interest to') && !combined.includes('from ')) {
        correctedType = 'EXPENSE';
    }
    else if (combined.includes('from ') && !combined.includes(' to ') && 
             (combined.includes('transfer') || combined.includes('neft') || combined.includes('imps'))) {
        correctedType = 'INCOME';
    }
    // Check for strong income/expense keywords (only if no ignore keywords present)
    else if (!hasIgnoreKeyword) {
        const hasIncomeKeyword = INCOME_KEYWORDS.some(kw => combined.includes(kw));
        const hasExpenseKeyword = EXPENSE_KEYWORDS.some(kw => combined.includes(kw));
        
        if (hasIncomeKeyword && !hasExpenseKeyword) {
            correctedType = 'INCOME';
        } else if (hasExpenseKeyword && !hasIncomeKeyword) {
            correctedType = 'EXPENSE';
        }
    }
    
    // Fix category based on corrected type
    let correctedCategory = t.category || 'Uncategorized';
    if (correctedType === 'INCOME') {
        if (combined.includes('salary') || combined.includes('payroll')) {
            correctedCategory = 'Salary';
        } else if (combined.includes('interest')) {
            correctedCategory = 'Interest';
        } else if (combined.includes('refund')) {
            correctedCategory = 'Refund';
        } else if (combined.includes('cashback')) {
            correctedCategory = 'Cashback';
        } else if (combined.includes('dividend')) {
            correctedCategory = 'Investment';
        } else if (combined.includes('rent')) {
            correctedCategory = 'Rent';
        } else if (correctedCategory === 'Uncategorized' || ['Shopping', 'Dining', 'Transport', 'Bills', 'Groceries', 'Food Delivery'].includes(correctedCategory)) {
            // These categories don't make sense for income
            correctedCategory = 'Transfer';
        }
    }
    
    // Clean merchant name further
    let cleanedMerchant = t.merchant
        .replace(/^(UPI[-\/]?|NEFT[-\/]?|IMPS[-\/]?|RTGS[-\/]?|POS\s*)/gi, '')
        .replace(/[-\/]?\d{10,}[-\/]?/g, '') // Remove long numbers
        .replace(/@[a-z]+$/i, '') // Remove UPI handles
        .replace(/\s+/g, ' ')
        .trim();
    
    // Capitalize properly
    if (cleanedMerchant) {
        cleanedMerchant = cleanedMerchant.split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
    } else {
        cleanedMerchant = t.merchant; // Keep original if cleaning failed
    }
    
    return {
        ...t,
        type: correctedType,
        category: correctedCategory,
        merchant: cleanedMerchant
    };
}

/**
 * Full post-processing pipeline:
 * 1. Fix type based on keywords
 * 2. Classify transaction nature (STEP C)
 * 3. Clean merchant name
 */
function fullPostProcess(t: RawTransaction): RawTransaction {
    // Step 1: Basic type correction
    const typeFixed = postProcessTransaction(t);
    
    // Step 2: STEP C classification (nature + income source)
    const classified = classifyTransactionNature(typeFixed);
    
    return classified;
}

// ═══════════════════════════════════════════════════════════════
// FAST PARALLEL PDF PARSING - 2 pages at a time, parallel execution
// ═══════════════════════════════════════════════════════════════

interface ChunkResult {
    transactions: RawTransaction[];
    chunk: string;
    success: boolean;
}

// Process PDF in small parallel chunks for speed AND accuracy
async function parseWithChunking(data: string, mimeType: string): Promise<{ transactions: RawTransaction[], method: 'chunked' | 'single' }> {
    console.log('📑 Starting FAST PARALLEL PDF parsing...');
    const startTime = Date.now();
    
    // Process 2 pages at a time for maximum accuracy
    // Run up to 4 parallel requests for speed
    const pageChunks = [
        { start: 1, end: 2 },
        { start: 3, end: 4 },
        { start: 5, end: 6 },
        { start: 7, end: 8 },
        { start: 9, end: 10 },
        { start: 11, end: 12 },
        { start: 13, end: 14 },
        { start: 15, end: 16 },
        { start: 17, end: 18 },
        { start: 19, end: 20 },
        { start: 21, end: 22 },
        { start: 23, end: 24 },
        { start: 25, end: 26 },
        { start: 27, end: 28 },
        { start: 29, end: 30 },
    ];
    
    const allTransactions: RawTransaction[] = [];
    const PARALLEL_LIMIT = 4; // Process 4 chunks at a time
    
    // Process in batches of PARALLEL_LIMIT
    for (let i = 0; i < pageChunks.length; i += PARALLEL_LIMIT) {
        const batch = pageChunks.slice(i, i + PARALLEL_LIMIT);
        
        console.log(`🔄 Processing batch ${Math.floor(i/PARALLEL_LIMIT) + 1}/${Math.ceil(pageChunks.length/PARALLEL_LIMIT)}...`);
        
        const promises = batch.map(async (chunk) => {
            try {
                const result = await parseChunkFast(data, mimeType, chunk.start, chunk.end);
                console.log(`   ✅ Pages ${chunk.start}-${chunk.end}: ${result.length} transactions`);
                return result;
            } catch (error: any) {
                console.warn(`   ⚠️ Pages ${chunk.start}-${chunk.end} failed`);
                return [];
            }
        });
        
        const results = await Promise.all(promises);
        results.forEach(txns => allTransactions.push(...txns));
        
        // Small delay between batches
        if (i + PARALLEL_LIMIT < pageChunks.length) {
            await new Promise(resolve => setTimeout(resolve, 300));
        }
    }
    
    // Deduplicate
    const seen = new Set<string>();
    const uniqueTransactions = allTransactions.filter(t => {
        const key = `${t.date}-${t.amount.toFixed(2)}-${t.type}-${(t.note || '').substring(0, 30)}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
    
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`📊 Parsing complete in ${elapsed}s: ${uniqueTransactions.length} transactions`);
    
    return { transactions: uniqueTransactions, method: 'chunked' };
}

// Fast chunk parser - minimal prompt, quick response
async function parseChunkFast(data: string, mimeType: string, startPage: number, endPage: number): Promise<RawTransaction[]> {
    const parts: any[] = [
        {
            inlineData: {
                mimeType: mimeType,
                data: data 
            }
        }
    ];
    
    const prompt = `Extract transactions from pages ${startPage}-${endPage} ONLY.

RULES:
- Debit column amount = type "EXPENSE"
- Credit column amount = type "INCOME"  
- Date format: YYYY-MM-DD
- Return [] if no transactions on these pages

JSON format per transaction:
{"date":"2026-01-01","merchant":"Zomato","amount":450.00,"type":"EXPENSE","mode":"UPI","category":"Food","note":"UPI-ZOMATO-xxx"}

Return JSON array only.`;
    
    parts.push({ text: prompt });
    
    const response = await ai!.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: { parts },
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        date: { type: Type.STRING },
                        merchant: { type: Type.STRING },
                        amount: { type: Type.NUMBER },
                        type: { type: Type.STRING, enum: ["INCOME", "EXPENSE"] },
                        mode: { type: Type.STRING },
                        category: { type: Type.STRING },
                        note: { type: Type.STRING }
                    },
                    required: ["date", "merchant", "amount", "type"]
                }
            },
            maxOutputTokens: 8192
        }
    });
    
    const responseText = response.text || '[]';
    const transactions = safeParseJSON(responseText);
    
    // Validate and post-process
    return transactions.filter(t => {
        if (!t.date || !t.amount || !t.type) return false;
        if (typeof t.amount !== 'number' || t.amount <= 0) return false;
        if (t.type !== 'INCOME' && t.type !== 'EXPENSE') return false;
        return true;
    }).map(t => fullPostProcess(t));
}

// Main parsing function - fast parallel processing
export const parseBankStatement = async (data: string, mimeType: string): Promise<RawTransaction[]> => {
    if (!ai) throw new Error("AI service not configured");

    const MAX_RETRIES = 3;
    let lastError: Error | null = null;
    let statementHeader: StatementHeader | null = null;
    
    // STEP A: Extract statement header for validation (for PDFs)
    if (mimeType === 'application/pdf') {
        console.log('📋 STEP A: Extracting statement header...');
        statementHeader = await extractStatementHeader(data, mimeType);
        
        if (statementHeader) {
            console.log('═══════════════════════════════════════════════════════');
            console.log('📋 EXPECTED TOTALS:');
            console.log(`   Total Debit:  ₹${statementHeader.totalDebit.toLocaleString('en-IN')}`);
            console.log(`   Total Credit: ₹${statementHeader.totalCredit.toLocaleString('en-IN')}`);
            console.log('═══════════════════════════════════════════════════════');
        }
    }
    
    let transactions: RawTransaction[] = [];
    
    // STEP B: Fast parallel chunk parsing
    if (mimeType === 'application/pdf') {
        console.log('📑 STEP B: Fast parallel parsing...');
        try {
            const { transactions: parsedTx } = await parseWithChunking(data, mimeType);
            transactions = parsedTx;
        } catch (error: any) {
            console.warn('⚠️ Parallel parsing failed:', error.message);
        }
    }
    
    // Fallback for non-PDFs or if chunked failed
    if (transactions.length === 0) {
        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                console.log(`🔄 Parsing attempt ${attempt}/${MAX_RETRIES}...`);
                
                const result = await attemptParse(data, mimeType, attempt);
                
                if (result.length > 0) {
                    console.log(`✅ Successfully parsed ${result.length} transactions on attempt ${attempt}`);
                    transactions = result;
                    break;
                }
            } catch (error: any) {
                lastError = error;
                console.warn(`⚠️ Attempt ${attempt} failed:`, error.message);
                
                // Wait before retry (exponential backoff)
                if (attempt < MAX_RETRIES) {
                    await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
                }
            }
        }
    }
    
    if (transactions.length === 0) {
        throw lastError || new Error("Failed to parse bank statement after multiple attempts");
    }
    
    // STEP C: Validate and correct transactions against statement header
    if (statementHeader && statementHeader.totalDebit > 0) {
        console.log('🔍 STEP C: Validating transactions against statement header...');
        transactions = validateAndCorrectTransactions(transactions, statementHeader);
        
        // Final verification
        const finalDebit = transactions.filter(t => t.type === 'EXPENSE').reduce((sum, t) => sum + t.amount, 0);
        const finalCredit = transactions.filter(t => t.type === 'INCOME').reduce((sum, t) => sum + t.amount, 0);
        
        // Mode breakdown
        const modeBreakdown: Record<string, { count: number; amount: number }> = {};
        transactions.forEach(t => {
            const mode = t.mode || 'Unknown';
            if (!modeBreakdown[mode]) modeBreakdown[mode] = { count: 0, amount: 0 };
            modeBreakdown[mode].count++;
            modeBreakdown[mode].amount += t.amount;
        });
        
        console.log('═══════════════════════════════════════════════════════');
        console.log('📊 FINAL VALIDATION:');
        console.log(`   Total Transactions: ${transactions.length}`);
        console.log(`   Expenses: ${transactions.filter(t => t.type === 'EXPENSE').length} txns | ₹${finalDebit.toLocaleString('en-IN')}`);
        console.log(`   Income:   ${transactions.filter(t => t.type === 'INCOME').length} txns | ₹${finalCredit.toLocaleString('en-IN')}`);
        console.log('───────────────────────────────────────────────────────');
        console.log('   📋 Mode Breakdown:');
        Object.entries(modeBreakdown)
            .sort((a, b) => b[1].count - a[1].count)
            .forEach(([mode, stats]) => {
                console.log(`      ${mode}: ${stats.count} txns | ₹${stats.amount.toLocaleString('en-IN')}`);
            });
        console.log('───────────────────────────────────────────────────────');
        console.log(`   Expected Debit:  ₹${statementHeader.totalDebit.toLocaleString('en-IN')}`);
        console.log(`   Expected Credit: ₹${statementHeader.totalCredit.toLocaleString('en-IN')}`);
        
        const debitAccuracy = statementHeader.totalDebit > 0 ? ((1 - Math.abs(finalDebit - statementHeader.totalDebit) / statementHeader.totalDebit) * 100) : 100;
        const creditAccuracy = statementHeader.totalCredit > 0 ? ((1 - Math.abs(finalCredit - statementHeader.totalCredit) / statementHeader.totalCredit) * 100) : 100;
        
        console.log(`   Debit Accuracy:  ${debitAccuracy.toFixed(1)}%`);
        console.log(`   Credit Accuracy: ${creditAccuracy.toFixed(1)}%`);
        console.log('═══════════════════════════════════════════════════════');
    }
    
    // Nature breakdown (STEP C classification results)
    const natureBreakdown: Record<string, { count: number; amount: number }> = {};
    transactions.forEach(t => {
        const nature = t.nature || 'UNCATEGORIZED';
        if (!natureBreakdown[nature]) natureBreakdown[nature] = { count: 0, amount: 0 };
        natureBreakdown[nature].count++;
        natureBreakdown[nature].amount += t.amount;
    });
    
    console.log('═══════════════════════════════════════════════════════');
    console.log('🧠 STEP C: TRANSACTION NATURE CLASSIFICATION:');
    Object.entries(natureBreakdown)
        .sort((a, b) => b[1].count - a[1].count)
        .forEach(([nature, stats]) => {
            console.log(`   ${nature}: ${stats.count} txns | ₹${stats.amount.toLocaleString('en-IN')}`);
        });
    console.log('═══════════════════════════════════════════════════════');
    
    // Detect duplicates (flag, don't remove)
    transactions = detectDuplicates(transactions);
    
    return transactions;
};

async function attemptParse(data: string, mimeType: string, attempt: number): Promise<RawTransaction[]> {
    const parts: any[] = [];
    
    // Prepare the document
    if (mimeType === 'text/csv' || mimeType === 'text/plain') {
        parts.push({ text: `Bank statement data:\n${data}` });
    } else {
        parts.push({
            inlineData: {
                mimeType: mimeType,
                data: data 
            }
        });
    }

    // Comprehensive category mapping instructions
    const categoryInstructions = `
CATEGORIZATION RULES (use these keywords to determine category):

═══ EXPENSE CATEGORIES ═══
- Groceries: BigBasket, DMart, Reliance Fresh, Spencer's, Star Bazaar, grocery, supermarket, kirana, JioMart
- Dining: Restaurant, cafe, dine-in, Dominos, Pizza Hut, McDonalds, KFC, Starbucks, CCD (ONLY for eating at restaurant)
- Food Delivery: Zomato, Swiggy, EatSure, Dunzo, Blinkit, Zepto, Instamart (for home delivery orders)
- Transport: Uber, Ola, Rapido, Metro, IRCTC, RedBus, cab, taxi, train, auto
- Fuel: Petrol, Diesel, HP, BPCL, IOCL, Shell, fuel station
- Shopping: Flipkart, Myntra, Meesho, Nykaa, Ajio, retail, mall, store
- Electronics: Amazon (electronics), Croma, Reliance Digital, Vijay Sales, Apple, Samsung, laptop, phone
- Streaming: Netflix, Prime Video, Hotstar, Spotify, YouTube Premium, Apple Music, JioCinema, Zee5 (recurring subscriptions)
- Entertainment: BookMyShow, PVR, INOX, Cinepolis, movies, concerts, events, gaming (one-time entertainment)
- Utilities: Electricity, Water, Gas, BESCOM, CESC, Mahanagar Gas, Tata Power
- Phone: Jio, Airtel, Vi, Vodafone, BSNL, mobile recharge
- Internet: Broadband, WiFi, ACT Fibernet, Hathway
- Healthcare: Hospital, Clinic, Pharmacy, Apollo, Medplus, 1mg, PharmEasy, Practo, doctor, medical
- Insurance: LIC, ICICI Prudential, HDFC Life, Max Life, health insurance, premium
- Education: School, College, University, Udemy, Coursera, Unacademy, BYJU, fees
- Rent: Rent payment, house rent, HRA, landlord
- EMI: EMI payment, loan EMI, car loan, home loan, personal loan
- Bills: Credit card bill, maintenance, society charges
- Subscriptions: Membership, annual fee, renewal
- Personal Care: Salon, spa, parlor, grooming, haircut, beauty, Urban Company
- Pets: Pet supplies, vet, veterinary, pet shop, dog/cat food
- Home: Furniture, home decor, Pepperfry, Urban Ladder, repairs, plumber, electrician
- Fitness: Gym, Cult Fit, sports equipment, yoga, workout
- Kids: Toys, school supplies, FirstCry, baby products, diapers
- Travel: Hotel, flight, Booking.com, MakeMyTrip, Goibibo, Airbnb, OYO, vacation
- Gifts: Gift, donation, charity, Ferns N Petals
- Cash: ATM withdrawal, self withdrawal (DO NOT include in spending analysis)
- Transfer: NEFT, IMPS, RTGS, person-to-person transfers

═══ INCOME CATEGORIES ═══
- Salary: Salary credit, payroll, wages, stipend
- Freelance: Freelance payment, consulting fee, honorarium, contract work
- Dividends: Dividend payout, Choice, Choice Equity, Choice Broking
- Investment: Mutual fund redemption, SIP, stocks sale, Zerodha, Groww
- Interest: Interest credit, FD interest, savings interest, RD interest
- Refund: Refund, reversal, cashback
- Rental Income: Rent received from tenant
- Transfer: Money received via UPI/NEFT/IMPS

- Uncategorized: Use ONLY if no other category fits`;

    // Use different prompts based on attempt number for resilience
    const prompts = [
        // Attempt 1: Highly structured extraction with clear column understanding
        `You are a precise IDFC FIRST Bank / Indian bank statement parser. Extract ALL transactions.

CRITICAL: THE STATEMENT HAS SEPARATE COLUMNS FOR DEBIT AND CREDIT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
| Date | Transaction Details | Withdrawal(Dr) | Deposit(Cr) | Balance |

TRANSACTION TYPE RULES (THIS IS CRUCIAL):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Amount in WITHDRAWAL column (Dr) → type = "EXPENSE" (money OUT)
• Amount in DEPOSIT column (Cr) → type = "INCOME" (money IN)
• Look at WHICH COLUMN has the amount, NOT the description text

VERIFICATION (use bank summary to verify):
- Total of all EXPENSE amounts should ≈ Total Debit in statement summary
- Total of all INCOME amounts should ≈ Total Credit in statement summary

EXPENSE EXAMPLES (Withdrawal/Dr column has amount):
- "UPI-ZOMATO-xxx" with amount in Dr column → EXPENSE
- "ATM CASH WDL" with amount in Dr column → EXPENSE  
- "NEFT-TO-JOHN" with amount in Dr column → EXPENSE
- "EMI Debit" with amount in Dr column → EXPENSE
- "Credit Card Bill Pay" with amount in Dr column → EXPENSE (paying CC bill is expense!)

INCOME EXAMPLES (Deposit/Cr column has amount):
- "SALARY CREDIT" with amount in Cr column → INCOME
- "INT CR" (interest credit) with amount in Cr column → INCOME
- "NEFT-FROM-FRIEND" with amount in Cr column → INCOME
- "REFUND-AMAZON" with amount in Cr column → INCOME
- "CASHBACK" with amount in Cr column → INCOME
- Investment returns

OUTPUT FORMAT:
━━━━━━━━━━━━━
JSON array with each transaction having:
{
  "date": "YYYY-MM-DD",           // Convert "01-Apr-2025" → "2025-04-01"
  "merchant": "Clean Name",        // "UPI-ZOMATO-xxx" → "Zomato"
  "amount": 1234.56,              // Positive number only
  "type": "EXPENSE" or "INCOME",  // Based on which column the amount is in
  "category": "Category Name",    // Best matching category
  "note": "Original description"  // The raw transaction narration
}

${categoryInstructions}

EXTRACTION RULES:
• Extract EVERY transaction row
• Skip: Opening Balance, Closing Balance, page headers/footers
• NEVER put Balance column value as transaction amount
• Clean merchant names thoroughly

Return ONLY the JSON array.`,

        // Attempt 2: Simplified but accurate
        `Parse this bank statement and return transactions as JSON array.

CRITICAL TYPE RULES:
- Withdrawal/Debit amount = "EXPENSE" (money going OUT)
- Deposit/Credit amount = "INCOME" (money coming IN)
- Salary is ALWAYS "INCOME"
- ATM withdrawal is ALWAYS "EXPENSE"
- Refund/Cashback is ALWAYS "INCOME"

Format: {"date":"YYYY-MM-DD","merchant":"clean name","amount":number,"type":"INCOME"|"EXPENSE","category":"string","note":"original text"}

${categoryInstructions}

Convert dates (01-Apr-2025 → 2025-04-01).
Clean merchants (remove UPI/NEFT/IMPS prefixes).
Return JSON array only.`,

        // Attempt 3: Minimal
        `Extract transactions: [{"date":"YYYY-MM-DD","merchant":"string","amount":number,"type":"INCOME"|"EXPENSE","category":"string","note":"string"}]
Withdrawal/Debit=EXPENSE, Deposit/Credit=INCOME. Salary=INCOME. ATM=EXPENSE. Refund=INCOME.
Categories: Salary, Dining, Shopping, Transport, Bills, Transfer, ATM, EMI, Investment, Utilities, Healthcare, Entertainment, Groceries, Other.
Return JSON only.`
    ];

    parts.push({ text: prompts[Math.min(attempt - 1, prompts.length - 1)] });

    // Choose model based on attempt (using only available models)
    const models = ['gemini-1.5-flash', 'gemini-1.5-flash', 'gemini-1.5-flash'];
    const model = models[Math.min(attempt - 1, models.length - 1)];

    const response = await ai!.models.generateContent({
        model: model,
        contents: { parts },
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        date: { type: Type.STRING },
                        merchant: { type: Type.STRING },
                        amount: { type: Type.NUMBER },
                        type: { type: Type.STRING, enum: ["INCOME", "EXPENSE"] },
                        category: { type: Type.STRING },
                        note: { type: Type.STRING }
                    },
                    required: ["date", "merchant", "amount", "type"]
                }
            },
            // Increased token limit for large statements (30+ pages)
            maxOutputTokens: 65536
        }
    });
    
    const responseText = response.text || '[]';
    console.log(`📄 Response length: ${responseText.length} chars, Model: ${model}`);
    
    // Parse with our robust parser
    const transactions = safeParseJSON(responseText);
    console.log(`📊 Parsed ${transactions.length} transactions from response`);
    
    // Validate and post-process each transaction
    const validTransactions = transactions.filter(t => {
        if (!t.date || !t.amount || !t.type || !t.merchant) {
            console.log(`⚠️ Skipped invalid transaction (missing fields):`, t);
            return false;
        }
        if (typeof t.amount !== 'number' || t.amount <= 0) {
            console.log(`⚠️ Skipped invalid transaction (bad amount):`, t);
            return false;
        }
        if (t.type !== 'INCOME' && t.type !== 'EXPENSE') {
            console.log(`⚠️ Skipped invalid transaction (bad type):`, t);
            return false;
        }
        return true;
    });
    
    console.log(`✅ Valid transactions: ${validTransactions.length}/${transactions.length}`);
    
    // Apply STEP C: Full post-processing with nature classification
    return validTransactions.map(t => fullPostProcess(t));
}

// ═══════════════════════════════════════════════════════════════
// LOCAL FALLBACK PARSER (No API calls - works offline)
// ═══════════════════════════════════════════════════════════════

// Category keywords for local categorization
const CATEGORY_KEYWORDS: Record<string, string[]> = {
    // ═══ EXPENSE CATEGORIES ═══
    'Groceries': ['bigbasket', 'dmart', 'reliance fresh', 'spencer', 'star bazaar', 'grocery', 'supermarket', 'kirana', 'more retail', 'nature basket', 'jiomart'],
    'Dining': ['restaurant', 'cafe', 'food court', 'dominos', 'pizza hut', 'mcdonalds', 'kfc', 'starbucks', 'ccd', 'burger king', 'subway', 'haldiram', 'biryani', 'dine in', 'dine-in'],
    'Food Delivery': ['zomato', 'swiggy', 'eatsure', 'dunzo', 'food order', 'blinkit', 'zepto', 'instamart', 'box8', 'faasos'],
    'Transport': ['uber', 'ola', 'rapido', 'metro', 'irctc', 'redbus', 'makemytrip', 'cleartrip', 'cab', 'taxi', 'train', 'goibibo', 'namma yatri', 'auto'],
    'Fuel': ['petrol', 'diesel', 'hp ', 'bpcl', 'iocl', 'shell', 'fuel', 'indian oil', 'bharat petroleum', 'reliance petrol'],
    'Shopping': ['flipkart', 'myntra', 'meesho', 'nykaa', 'ajio', 'retail', 'mall', 'store', 'decathlon', 'ikea', 'shoppers stop', 'westside', 'max fashion', 'pantaloons'],
    'Electronics': ['croma', 'reliance digital', 'vijay sales', 'apple', 'samsung', 'oneplus', 'mobile store', 'amazon', 'laptop', 'phone purchase'],
    'Streaming': ['netflix', 'prime video', 'hotstar', 'spotify', 'youtube premium', 'apple music', 'jio cinema', 'zee5', 'sony liv', 'disney'],
    'Entertainment': ['bookmyshow', 'pvr', 'inox', 'cinepolis', 'multiplex', 'movie', 'concert', 'event', 'amusement', 'gaming'],
    'Utilities': ['electricity', 'water', 'gas', 'bescom', 'cesc', 'mahanagar gas', 'torrent power', 'tata power', 'piped gas'],
    'Phone': ['jio', 'airtel', 'vi ', 'vodafone', 'bsnl', 'mobile recharge', 'postpaid', 'prepaid'],
    'Internet': ['broadband', 'wifi', 'act fibernet', 'hathway', 'excitel', 'tikona', 'airtel xstream'],
    'Healthcare': ['hospital', 'clinic', 'pharmacy', 'apollo', 'medplus', '1mg', 'pharmeasy', 'practo', 'doctor', 'medical', 'diagnostic', 'lab', 'netmeds', 'tata health'],
    'Insurance': ['lic', 'icici prudential', 'hdfc life', 'max life', 'insurance', 'premium', 'policy', 'star health', 'care health'],
    'Education': ['school', 'college', 'university', 'udemy', 'coursera', 'unacademy', 'byju', 'education', 'fees', 'tuition', 'linkedin learning'],
    'Rent': ['rent', 'house rent', 'hra', 'landlord', 'rental', 'pg rent', 'hostel'],
    'EMI': ['emi', 'loan', 'car loan', 'home loan', 'personal loan', 'repayment', 'credit card emi'],
    'Bills': ['credit card', 'utility', 'maintenance', 'society', 'bill payment', 'water bill', 'electricity bill'],
    'Subscriptions': ['subscription', 'membership', 'annual fee', 'renewal'],
    'Personal Care': ['salon', 'spa', 'parlor', 'parlour', 'grooming', 'haircut', 'beauty', 'urban company', 'looks salon', 'naturals'],
    'Pets': ['pet', 'vet', 'veterinary', 'pet shop', 'dog food', 'cat food', 'heads up for tails', 'petsy'],
    'Home': ['furniture', 'home decor', 'pepperfry', 'urban ladder', 'hometown', 'repair', 'plumber', 'electrician', 'carpenter', 'interior'],
    'Fitness': ['gym', 'cult fit', 'fitness', 'sports', 'yoga', 'crossfit', 'decathlon', 'workout'],
    'Kids': ['toys', 'school supplies', 'firstcry', 'hopscotch', 'baby', 'diapers', 'kids clothes'],
    'Travel': ['hotel', 'flight', 'booking.com', 'airbnb', 'oyo', 'vacation', 'trip', 'travel', 'goibibo', 'yatra'],
    'Gifts': ['gift', 'donation', 'charity', 'contribution', 'ferns n petals', 'igp'],
    'Cash': ['atm', 'cash withdrawal', 'self withdrawal'],
    'Transfer': ['neft', 'imps', 'rtgs', 'fund transfer'],
    
    // ═══ INCOME CATEGORIES ═══
    'Salary': ['salary', 'payroll', 'wages', 'stipend'],
    'Freelance': ['freelance', 'consulting', 'honorarium', 'contract payment', 'gig'],
    'Dividends': ['dividend', 'choice', 'choice equity', 'choice broking', 'payout'],
    'Investment': ['mutual fund', 'sip', 'stocks', 'zerodha', 'groww', 'investment', 'kuvera', 'coin', 'upstox', 'mf redemption'],
    'Interest': ['interest', 'fd interest', 'savings interest', 'deposit interest', 'rd interest'],
    'Refund': ['refund', 'reversal', 'cashback', 'returned'],
    'Rental Income': ['rent received', 'rental income', 'tenant'],
};

// Categorize based on keywords
function categorizeLocally(description: string): string {
    const lower = description.toLowerCase();
    for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
        for (const keyword of keywords) {
            if (lower.includes(keyword)) {
                return category;
            }
        }
    }
    return 'Uncategorized';
}

// Clean merchant name
function cleanMerchantName(raw: string): string {
    // Remove common prefixes
    let clean = raw
        .replace(/^(UPI[-\/]?|NEFT[-\/]?|IMPS[-\/]?|RTGS[-\/]?|BY TRANSFER[-\/]?|POS\s+)/gi, '')
        .replace(/[-\/]?\d{12,}[-\/]?/g, '') // Remove long numbers (UPI IDs)
        .replace(/[A-Z0-9]{20,}/g, '') // Remove very long alphanumeric strings
        .replace(/\s+/g, ' ')
        .trim();
    
    // Extract first meaningful part
    const parts = clean.split(/[-\/]/);
    if (parts.length > 0 && parts[0].trim()) {
        clean = parts[0].trim();
    }
    
    // Capitalize first letter of each word
    clean = clean.split(' ').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    ).join(' ');
    
    return clean || 'Unknown';
}

// Parse date from various formats
function parseDate(dateStr: string): string | null {
    // Common formats: DD-Mon-YYYY, DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD
    const patterns = [
        // DD-Mon-YYYY (e.g., 03-Jul-2025)
        { regex: /(\d{1,2})[-\/]([A-Za-z]{3})[-\/](\d{4})/, handler: (m: RegExpMatchArray) => {
            const months: Record<string, string> = { jan:'01', feb:'02', mar:'03', apr:'04', may:'05', jun:'06', jul:'07', aug:'08', sep:'09', oct:'10', nov:'11', dec:'12' };
            return `${m[3]}-${months[m[2].toLowerCase()] || '01'}-${m[1].padStart(2, '0')}`;
        }},
        // DD/MM/YYYY or DD-MM-YYYY
        { regex: /(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/, handler: (m: RegExpMatchArray) => {
            return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
        }},
        // YYYY-MM-DD (already correct format)
        { regex: /(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/, handler: (m: RegExpMatchArray) => {
            return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
        }},
    ];
    
    for (const { regex, handler } of patterns) {
        const match = dateStr.match(regex);
        if (match) {
            return handler(match);
        }
    }
    return null;
}

// Parse amount from string (handles commas, currency symbols)
function parseAmount(amountStr: string): number | null {
    // Remove currency symbols and commas
    const cleaned = amountStr.replace(/[₹$€£,\s]/g, '').replace(/^-/, '');
    const num = parseFloat(cleaned);
    return isNaN(num) || num <= 0 ? null : num;
}

// Local CSV/Text parser (fallback)
export function parseStatementLocally(text: string): { transactions: RawTransaction[], usedFallback: boolean } {
    console.log('🔧 Using LOCAL parser (fallback mode)...');
    const transactions: RawTransaction[] = [];
    const lines = text.split('\n');
    
    // Transaction line patterns for various bank formats
    // Pattern: Date ... Description ... Debit/Credit Amount ... Balance
    const transactionPatterns = [
        // IDFC Bank style: Date | Description | Debit | Credit | Balance
        /^(\d{1,2}[-\/][A-Za-z]{3}[-\/]\d{4}|\d{1,2}[-\/]\d{1,2}[-\/]\d{4})\s+(.+?)\s+([\d,]+\.?\d*)\s+([\d,]+\.?\d*)?\s*([\d,]+\.?\d*)$/,
        // Generic: Date Description Amount
        /^(\d{1,2}[-\/][A-Za-z]{3}[-\/]\d{4}|\d{1,2}[-\/]\d{1,2}[-\/]\d{4})\s+(.+?)\s+([\d,]+\.?\d*)\s*(CR|DR)?$/i,
    ];
    
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.length < 10) continue;
        
        // Try each pattern
        for (const pattern of transactionPatterns) {
            const match = trimmed.match(pattern);
            if (match) {
                const date = parseDate(match[1]);
                if (!date) continue;
                
                const description = match[2]?.trim() || '';
                const merchant = cleanMerchantName(description);
                
                // Determine type and amount
                let amount: number | null = null;
                let type: 'INCOME' | 'EXPENSE' = 'EXPENSE';
                
                if (match[4]) {
                    // Separate debit/credit columns
                    const debit = parseAmount(match[3]);
                    const credit = parseAmount(match[4]);
                    
                    if (credit && credit > 0) {
                        amount = credit;
                        type = 'INCOME';
                    } else if (debit && debit > 0) {
                        amount = debit;
                        type = 'EXPENSE';
                    }
                } else {
                    // Single amount column with CR/DR indicator
                    amount = parseAmount(match[3]);
                    if (match[4]?.toUpperCase() === 'CR') {
                        type = 'INCOME';
                    }
                }
                
                if (amount && amount > 0) {
                    transactions.push({
                        date,
                        merchant,
                        amount,
                        type,
                        category: categorizeLocally(description),
                        note: description
                    });
                }
                break;
            }
        }
    }
    
    console.log(`🔧 Local parser found ${transactions.length} transactions`);
    return { transactions, usedFallback: true };
}