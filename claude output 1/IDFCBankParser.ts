/**
 * IDFC FIRST Bank Statement Parser
 * 
 * CRITICAL ACCURACY RULES:
 * 1. Debit column = EXPENSE (money OUT)
 * 2. Credit column = INCOME (money IN)
 * 3. Validate against statement header totals
 * 4. Transaction date format: DD-MMM-YYYY or DD-Mon-YYYY
 */

import * as XLSX from 'xlsx';
import { Transaction } from './types';

interface StatementSummary {
  openingBalance: number;
  totalDebit: number;
  totalCredit: number;
  closingBalance: number;
  accountNumber: string;
  statementPeriod: string;
  customerName: string;
}

interface ParseResult {
  transactions: Transaction[];
  summary: StatementSummary;
  validation: {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  };
}

export class IDFCBankParser {
  
  /**
   * Parse IDFC Bank statement from Excel/CSV
   */
  static async parseExcel(file: File): Promise<ParseResult> {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
    
    // Get the main statement sheet
    const sheetName = workbook.SheetNames.find(name => 
      name.toLowerCase().includes('account') || 
      name.toLowerCase().includes('statement')
    ) || workbook.SheetNames[0];
    
    const worksheet = workbook.Sheets[sheetName];
    const data: any[][] = XLSX.utils.sheet_to_json(worksheet, { 
      header: 1, 
      raw: false,
      dateNF: 'DD-MMM-YYYY'
    });

    // Extract summary information
    const summary = this.extractSummary(data);
    
    // Find transaction data start row
    const headerRowIndex = data.findIndex(row => 
      row && row.some(cell => 
        cell && cell.toString().toLowerCase().includes('transaction date')
      )
    );

    if (headerRowIndex === -1) {
      throw new Error('Could not find transaction header row');
    }

    // Parse transactions starting from next row
    const transactions: Transaction[] = [];
    const transactionRows = data.slice(headerRowIndex + 1);

    for (const row of transactionRows) {
      if (!row || row.length < 7) continue;
      
      const [txnDate, valueDate, particulars, chequeNo, debit, credit, balance] = row;
      
      // Skip empty rows or footer rows
      if (!txnDate || !particulars) continue;
      if (particulars.toString().toLowerCase().includes('end of statement')) break;
      
      const transaction = this.parseTransaction(
        txnDate,
        valueDate,
        particulars,
        chequeNo,
        debit,
        credit,
        balance
      );
      
      if (transaction) {
        transactions.push(transaction);
      }
    }

    // Validation
    const validation = this.validateTransactions(transactions, summary);

    return {
      transactions,
      summary,
      validation
    };
  }

  /**
   * Parse IDFC Bank statement from PDF text
   */
  static parsePDF(pdfText: string): ParseResult {
    const lines = pdfText.split('\n');
    const summary = this.extractSummaryFromText(lines);
    const transactions: Transaction[] = [];

    // Find transaction section
    let inTransactionSection = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Start of transaction table
      if (line.includes('Transaction') && line.includes('Date') && line.includes('Particulars')) {
        inTransactionSection = true;
        continue;
      }

      // End of transactions
      if (line.includes('REGISTERED OFFICE') || line.includes('End of statement')) {
        inTransactionSection = false;
        continue;
      }

      if (inTransactionSection && line) {
        const transaction = this.parseTransactionFromPDFLine(line, lines, i);
        if (transaction) {
          transactions.push(transaction);
        }
      }
    }

    const validation = this.validateTransactions(transactions, summary);

    return {
      transactions,
      summary,
      validation
    };
  }

  /**
   * Extract summary from Excel data
   */
  private static extractSummary(data: any[][]): StatementSummary {
    let openingBalance = 0;
    let totalDebit = 0;
    let totalCredit = 0;
    let closingBalance = 0;
    let accountNumber = '';
    let statementPeriod = '';
    let customerName = '';

    for (let i = 0; i < Math.min(30, data.length); i++) {
      const row = data[i];
      if (!row) continue;

      const firstCell = row[0]?.toString().toLowerCase() || '';
      
      if (firstCell.includes('account number')) {
        accountNumber = row[1]?.toString() || '';
      }
      if (firstCell.includes('statement period')) {
        statementPeriod = row[1]?.toString() || '';
      }
      if (firstCell.includes('customer name')) {
        customerName = row[1]?.toString() || '';
      }
      if (firstCell.includes('opening balance')) {
        const summaryRow = data[i + 1];
        if (summaryRow) {
          openingBalance = this.parseAmount(summaryRow[0]);
          totalDebit = this.parseAmount(summaryRow[1]);
          totalCredit = this.parseAmount(summaryRow[2]);
          closingBalance = this.parseAmount(summaryRow[3]);
        }
      }
    }

    return {
      openingBalance,
      totalDebit,
      totalCredit,
      closingBalance,
      accountNumber,
      statementPeriod,
      customerName
    };
  }

  /**
   * Extract summary from PDF text
   */
  private static extractSummaryFromText(lines: string[]): StatementSummary {
    let openingBalance = 0;
    let totalDebit = 0;
    let totalCredit = 0;
    let closingBalance = 0;
    let accountNumber = '';
    let statementPeriod = '';
    let customerName = '';

    for (const line of lines) {
      if (line.includes('ACCOUNT NO')) {
        accountNumber = line.split(':')[1]?.trim() || '';
      }
      if (line.includes('STATEMENT PERIOD')) {
        statementPeriod = line.split(':')[1]?.trim() || '';
      }
      if (line.includes('CUSTOMER NAME')) {
        customerName = line.split(':')[1]?.trim() || '';
      }
      
      // Look for summary line with 4 numbers
      const numbers = line.match(/[\d,]+\.[\d]{2}/g);
      if (numbers && numbers.length === 4 && 
          (line.includes('Opening') || line.toLowerCase().includes('total debit'))) {
        openingBalance = this.parseAmount(numbers[0]);
        totalDebit = this.parseAmount(numbers[1]);
        totalCredit = this.parseAmount(numbers[2]);
        closingBalance = this.parseAmount(numbers[3]);
      }
    }

    return {
      openingBalance,
      totalDebit,
      totalCredit,
      closingBalance,
      accountNumber,
      statementPeriod,
      customerName
    };
  }

  /**
   * Parse single transaction row - CRITICAL ACCURACY
   */
  private static parseTransaction(
    txnDate: any,
    valueDate: any,
    particulars: any,
    chequeNo: any,
    debit: any,
    credit: any,
    balance: any
  ): Transaction | null {
    
    // Parse date
    const date = this.parseDate(txnDate);
    if (!date) return null;

    // Parse amounts - CRITICAL: Debit = EXPENSE, Credit = INCOME
    const debitAmount = this.parseAmount(debit);
    const creditAmount = this.parseAmount(credit);

    // Determine transaction type
    const isExpense = debitAmount > 0; // Money OUT
    const isIncome = creditAmount > 0;  // Money IN

    if (!isExpense && !isIncome) return null;

    const amount = isExpense ? debitAmount : creditAmount;
    const type = isExpense ? 'expense' : 'income';
    
    // Extract description
    const description = this.cleanDescription(particulars?.toString() || '');
    
    // Auto-categorize
    const category = this.categorizeTransaction(description, type);

    // Extract metadata
    const metadata = this.extractMetadata(description);

    return {
      id: this.generateId(),
      date: date.toISOString().split('T')[0],
      description,
      amount,
      type,
      category,
      paymentMethod: this.detectPaymentMethod(description),
      notes: metadata.notes,
      tags: metadata.tags,
      balance: this.parseAmount(balance),
      valueDate: this.parseDate(valueDate)?.toISOString().split('T')[0],
      chequeNumber: chequeNo?.toString() || undefined,
      source: 'IDFC FIRST Bank',
      rawData: {
        particulars: particulars?.toString(),
        debit: debitAmount,
        credit: creditAmount
      }
    };
  }

  /**
   * Parse transaction from PDF line
   */
  private static parseTransactionFromPDFLine(
    line: string,
    allLines: string[],
    currentIndex: number
  ): Transaction | null {
    // PDF format: Date Date Particulars ChequeNo Debit Credit Balance
    // Example: 01-Feb-2026 01-Feb-2026 UPI/DR/639804151140/SURENDRA... 120.00 1,32,582.54
    
    const parts = line.split(/\s+/);
    if (parts.length < 5) return null;

    // Try to parse date
    const dateMatch = line.match(/(\d{2}-[A-Za-z]{3}-\d{4})/);
    if (!dateMatch) return null;

    const date = this.parseDate(dateMatch[1]);
    if (!date) return null;

    // Extract amounts from end of line
    const amounts = line.match(/([\d,]+\.[\d]{2})/g);
    if (!amounts || amounts.length < 2) return null;

    // Last number is balance, second-to-last is debit or credit
    const balance = amounts[amounts.length - 1];
    const transactionAmount = amounts[amounts.length - 2];

    // Extract particulars (middle section)
    const particularsMatch = line.match(/\d{4}\s+(.+?)\s+([\d,]+\.[\d]{2})/);
    const particulars = particularsMatch ? particularsMatch[1] : '';

    // Determine if debit or credit by checking if particulars contains DR or CR
    const isDebit = particulars.includes('/DR/') || !particulars.includes('/CR/');
    
    return this.parseTransaction(
      dateMatch[1],
      dateMatch[1],
      particulars,
      null,
      isDebit ? transactionAmount : null,
      !isDebit ? transactionAmount : null,
      balance
    );
  }

  /**
   * Categorize transaction based on description
   */
  private static categorizeTransaction(description: string, type: string): string {
    const desc = description.toLowerCase();

    // INCOME categories
    if (type === 'income') {
      if (desc.includes('salary') || desc.includes('payroll')) return 'Salary';
      if (desc.includes('dividend') || desc.includes('mutual fund') || desc.includes('redemption')) 
        return 'Investment Returns';
      if (desc.includes('interest')) return 'Interest Income';
      if (desc.includes('refund')) return 'Refunds';
      if (desc.includes('ift') || desc.includes('neft') || desc.includes('imps')) return 'Transfers In';
      return 'Other Income';
    }

    // EXPENSE categories
    if (desc.includes('zomato') || desc.includes('swiggy') || desc.includes('food')) 
      return 'Food & Dining';
    if (desc.includes('blinkit') || desc.includes('zepto') || desc.includes('grocery')) 
      return 'Groceries';
    if (desc.includes('uber') || desc.includes('ola') || desc.includes('metro') || desc.includes('petrol')) 
      return 'Transportation';
    if (desc.includes('amazon') || desc.includes('flipkart') || desc.includes('shopping')) 
      return 'Shopping';
    if (desc.includes('netflix') || desc.includes('spotify') || desc.includes('prime') || desc.includes('google play')) 
      return 'Entertainment';
    if (desc.includes('electricity') || desc.includes('water') || desc.includes('gas') || desc.includes('broadband')) 
      return 'Utilities';
    if (desc.includes('rent') || desc.includes('maintenance')) 
      return 'Housing';
    if (desc.includes('hospital') || desc.includes('pharmacy') || desc.includes('doctor')) 
      return 'Healthcare';
    if (desc.includes('ift') || desc.includes('neft') || desc.includes('imps') || desc.includes('transfer')) 
      return 'Transfers Out';
    if (desc.includes('atm')) 
      return 'Cash Withdrawal';
    if (desc.includes('insurance')) 
      return 'Insurance';
    if (desc.includes('loan') || desc.includes('emi')) 
      return 'Loans & EMI';
    if (desc.includes('investment') || desc.includes('mutual') || desc.includes('stock')) 
      return 'Investments';
    
    return 'Other';
  }

  /**
   * Detect payment method
   */
  private static detectPaymentMethod(description: string): string {
    const desc = description.toLowerCase();
    
    if (desc.includes('upi')) return 'UPI';
    if (desc.includes('neft')) return 'NEFT';
    if (desc.includes('rtgs')) return 'RTGS';
    if (desc.includes('imps')) return 'IMPS';
    if (desc.includes('ift')) return 'Internal Transfer';
    if (desc.includes('cheque')) return 'Cheque';
    if (desc.includes('atm')) return 'ATM';
    if (desc.includes('pos')) return 'Card';
    if (desc.includes('ach')) return 'ACH';
    
    return 'Bank Transfer';
  }

  /**
   * Extract metadata from description
   */
  private static extractMetadata(description: string): { notes: string; tags: string[] } {
    const tags: string[] = [];
    let notes = '';

    // Extract UPI ID
    const upiMatch = description.match(/\/([a-z0-9._-]+@[a-z]+)\//i);
    if (upiMatch) {
      tags.push(`UPI:${upiMatch[1]}`);
    }

    // Extract merchant names
    const merchantMatch = description.match(/\/([\w\s]+?)\//g);
    if (merchantMatch) {
      merchantMatch.forEach(m => {
        const merchant = m.replace(/\//g, '').trim();
        if (merchant.length > 2 && !merchant.match(/^\d+$/)) {
          tags.push(merchant);
        }
      });
    }

    return { notes, tags };
  }

  /**
   * Clean up description text
   */
  private static cleanDescription(text: string): string {
    return text
      .replace(/\s+/g, ' ')
      .replace(/\/+/g, '/')
      .trim();
  }

  /**
   * Parse date from various formats
   */
  private static parseDate(dateStr: any): Date | null {
    if (!dateStr) return null;
    
    if (dateStr instanceof Date) return dateStr;
    
    const str = dateStr.toString().trim();
    
    // Try DD-MMM-YYYY format (e.g., "01-Feb-2026")
    const monthMap: { [key: string]: number } = {
      'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'may': 4, 'jun': 5,
      'jul': 6, 'aug': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dec': 11
    };

    const ddMmmYyyyMatch = str.match(/(\d{1,2})-([A-Za-z]{3})-(\d{4})/);
    if (ddMmmYyyyMatch) {
      const [, day, month, year] = ddMmmYyyyMatch;
      const monthNum = monthMap[month.toLowerCase()];
      if (monthNum !== undefined) {
        return new Date(parseInt(year), monthNum, parseInt(day));
      }
    }

    // Try standard date parsing
    const date = new Date(str);
    if (!isNaN(date.getTime())) {
      return date;
    }

    return null;
  }

  /**
   * Parse amount from string/number
   */
  private static parseAmount(value: any): number {
    if (typeof value === 'number') return value;
    if (!value) return 0;
    
    const str = value.toString().replace(/,/g, '').trim();
    const num = parseFloat(str);
    
    return isNaN(num) ? 0 : num;
  }

  /**
   * Validate parsed transactions against summary
   */
  private static validateTransactions(
    transactions: Transaction[],
    summary: StatementSummary
  ): { isValid: boolean; errors: string[]; warnings: string[] } {
    
    const errors: string[] = [];
    const warnings: string[] = [];

    // Calculate totals
    const calculatedDebit = transactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);
    
    const calculatedCredit = transactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);

    // Validate totals (allow 0.01 difference for rounding)
    const debitDiff = Math.abs(calculatedDebit - summary.totalDebit);
    const creditDiff = Math.abs(calculatedCredit - summary.totalCredit);

    if (debitDiff > 0.01) {
      errors.push(
        `Debit mismatch: Calculated ${calculatedDebit.toFixed(2)} vs ` +
        `Statement ${summary.totalDebit.toFixed(2)} (diff: ${debitDiff.toFixed(2)})`
      );
    }

    if (creditDiff > 0.01) {
      errors.push(
        `Credit mismatch: Calculated ${calculatedCredit.toFixed(2)} vs ` +
        `Statement ${summary.totalCredit.toFixed(2)} (diff: ${creditDiff.toFixed(2)})`
      );
    }

    // Validate balance calculation
    const expectedClosing = summary.openingBalance - calculatedDebit + calculatedCredit;
    const balanceDiff = Math.abs(expectedClosing - summary.closingBalance);
    
    if (balanceDiff > 0.01) {
      warnings.push(
        `Balance calculation: Opening ${summary.openingBalance.toFixed(2)} ` +
        `- Debit ${calculatedDebit.toFixed(2)} + Credit ${calculatedCredit.toFixed(2)} ` +
        `= ${expectedClosing.toFixed(2)} vs Statement ${summary.closingBalance.toFixed(2)}`
      );
    }

    // Check for duplicate transactions
    const descriptions = new Map<string, number>();
    transactions.forEach(t => {
      const key = `${t.date}-${t.amount}-${t.description}`;
      descriptions.set(key, (descriptions.get(key) || 0) + 1);
    });

    const duplicates = Array.from(descriptions.entries())
      .filter(([, count]) => count > 1)
      .map(([key]) => key);

    if (duplicates.length > 0) {
      warnings.push(`Found ${duplicates.length} potential duplicate transactions`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Generate unique transaction ID
   */
  private static generateId(): string {
    return `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Type definitions
interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  category: string;
  paymentMethod: string;
  notes?: string;
  tags?: string[];
  balance?: number;
  valueDate?: string;
  chequeNumber?: string;
  source?: string;
  rawData?: any;
}
