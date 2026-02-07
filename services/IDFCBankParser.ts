/**
 * IDFC FIRST Bank Statement Parser
 * Enhanced version with Excel/CSV/PDF support
 * 
 * CRITICAL ACCURACY RULES:
 * 1. Debit column = EXPENSE (money OUT)
 * 2. Credit column = INCOME (money IN)
 * 3. Validate against statement header totals
 * 4. Transaction date format: DD-MMM-YYYY or DD-Mon-YYYY
 */

import * as XLSX from 'xlsx';

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
    try {
      console.log('📊 parseExcel called with file:', file.name, 'size:', file.size, 'type:', file.type);
      
      const buffer = await file.arrayBuffer();
      console.log('📊 File buffer size:', buffer.byteLength);
      
      const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
      
      console.log('📊 Excel sheets found:', workbook.SheetNames);
      
      // Get the main statement sheet
      const sheetName = workbook.SheetNames.find(name => 
        name.toLowerCase().includes('account') || 
        name.toLowerCase().includes('statement')
      ) || workbook.SheetNames[0];
      
      console.log('📊 Using sheet:', sheetName);
      
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

      console.log('📊 Header row index:', headerRowIndex);
      if (headerRowIndex > -1) {
        console.log('📊 Headers:', data[headerRowIndex].slice(0, 7).join(' | '));
      }

      if (headerRowIndex === -1) {
        throw new Error('Could not find transaction header row. Expected "Transaction Date" column in Excel.');
      }

      // Parse transactions starting from next row
      const transactions: Transaction[] = [];
      const transactionRows = data.slice(headerRowIndex + 1);

      for (const row of transactionRows) {
        if (!row || row.length < 6) continue;
        
        const txn = this.parseTransaction(
          row[0], // Transaction Date
          row[1], // Value Date
          row[2], // Particulars
          row[3], // Cheque No
          row[4], // Debit
          row[5], // Credit
          row[6]  // Balance
        );
        
        if (txn) transactions.push(txn);
      }

      // Validation
      const validation = this.validateTransactions(transactions, summary);

      console.log(`✅ Parsed ${transactions.length} transactions from Excel`);
      console.log('🔍 Validation result:', validation);
      console.log('   Errors:', validation.errors);
      console.log('   Warnings:', validation.warnings);

      return {
        transactions,
        summary,
        validation
      };
    } catch (error: any) {
      console.error('❌ Excel parsing error:', error);
      throw new Error(`Excel parsing failed: ${error.message} | Please ensure the file is a valid IDFC statement with "Transaction Date" column.`);
    }
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
      
      if (line.includes('Transaction') && line.includes('Date') && line.includes('Particulars')) {
        inTransactionSection = true;
        continue;
      }
      
      if (line.includes('REGISTERED OFFICE') || line.includes('End of statement')) {
        inTransactionSection = false;
        break;
      }

      if (!inTransactionSection) continue;

      const txn = this.parseTransactionFromPDFLine(line, lines, i);
      if (txn) transactions.push(txn);
    }

    const validation = this.validateTransactions(transactions, summary);

    console.log(`✅ Parsed ${transactions.length} transactions from PDF`);

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

    // Find summary row by looking for "Opening Balance" label
    let summaryLabelRow = -1;
    let summaryValueRow = -1;

    for (let i = 0; i < Math.min(30, data.length); i++) {
      const row = data[i];
      if (!row) continue;

      const rowText = row.join(' | ').toLowerCase();
      
      // Find header row with balance labels
      if (rowText.includes('opening balance') && rowText.includes('total debit')) {
        summaryLabelRow = i;
        summaryValueRow = i + 1; // Values are typically in next row
        break;
      }
    }

    console.log('📊 Summary rows found - Labels:', summaryLabelRow, 'Values:', summaryValueRow);

    // Extract values from summary
    if (summaryValueRow > -1 && data[summaryValueRow]) {
      const valueRow = data[summaryValueRow];
      console.log('📊 Summary values row:', valueRow.slice(0, 4));
      
      // Parse values based on column position
      if (valueRow[0]) openingBalance = this.parseAmount(valueRow[0]);
      if (valueRow[1]) totalDebit = this.parseAmount(valueRow[1]);
      if (valueRow[2]) totalCredit = this.parseAmount(valueRow[2]);
      if (valueRow[3]) closingBalance = this.parseAmount(valueRow[3]);
      
      console.log('📊 Parsed - Opening:', openingBalance, 'Debit:', totalDebit, 'Credit:', totalCredit, 'Closing:', closingBalance);
    }

    // Extract other metadata from earlier rows
    for (let i = 0; i < Math.min(20, data.length); i++) {
      const row = data[i];
      if (!row) continue;

      const rowText = row.join(' ').toLowerCase();
      
      if (rowText.includes('account') && row[1] && /^\d{10,}$/.test(row[1]?.toString())) {
        accountNumber = row[1].toString();
      }
      
      if (rowText.includes('customer name') && row[1]) {
        customerName = row[1].toString();
      }
      
      if (rowText.includes('statement period') && row[1]) {
        statementPeriod = row[1].toString();
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
      const lowerLine = line.toLowerCase();

      if (lowerLine.includes('account') && /\d{10,}/.test(line)) {
        accountNumber = line.match(/(\d{10,})/)?.[1] || '';
      }

      if (lowerLine.includes('customer name')) {
        customerName = line.split(':')[1]?.trim() || '';
      }

      if (lowerLine.includes('opening balance')) {
        const match = line.match(/([\d,]+\.[\d]{2})/);
        if (match) openingBalance = this.parseAmount(match[1]);
      }

      if (lowerLine.includes('total') && lowerLine.includes('debit')) {
        const match = line.match(/([\d,]+\.[\d]{2})/);
        if (match) totalDebit = this.parseAmount(match[1]);
      }

      if (lowerLine.includes('total') && lowerLine.includes('credit')) {
        const match = line.match(/([\d,]+\.[\d]{2})/);
        if (match) totalCredit = this.parseAmount(match[1]);
      }

      if (lowerLine.includes('closing balance')) {
        const match = line.match(/([\d,]+\.[\d]{2})/);
        if (match) closingBalance = this.parseAmount(match[1]);
      }

      if (lowerLine.includes('statement period')) {
        statementPeriod = line.split(':')[1]?.trim() || '';
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
    const isExpense = debitAmount > 0;
    const isIncome = creditAmount > 0;

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

    const balance = amounts[amounts.length - 1];
    const transactionAmount = amounts[amounts.length - 2];

    // Extract particulars (middle section)
    const particularsMatch = line.match(/\d{4}\s+(.+?)\s+([\d,]+\.[\d]{2})/);
    const particulars = particularsMatch ? particularsMatch[1] : '';

    // Determine if debit or credit
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
      if (desc.includes('dividend') || desc.includes('mutual fund') || desc.includes('mf')) return 'Investment Returns';
      if (desc.includes('interest')) return 'Interest Income';
      if (desc.includes('refund') || desc.includes('reversal')) return 'Refunds';
      if (desc.includes('neft') || desc.includes('rtgs') || desc.includes('imps') || desc.includes('ift')) return 'Transfers In';
      return 'Other Income';
    }

    // EXPENSE categories
    if (desc.includes('zomato') || desc.includes('swiggy') || desc.includes('food') || desc.includes('restaurant')) 
      return 'Food & Dining';
    if (desc.includes('blinkit') || desc.includes('zepto') || desc.includes('grocery') || desc.includes('bigbasket')) 
      return 'Groceries';
    if (desc.includes('uber') || desc.includes('ola') || desc.includes('metro') || desc.includes('petrol') || desc.includes('fuel')) 
      return 'Transportation';
    if (desc.includes('amazon') || desc.includes('flipkart') || desc.includes('shopping') || desc.includes('myntra')) 
      return 'Shopping';
    if (desc.includes('netflix') || desc.includes('spotify') || desc.includes('prime') || desc.includes('google play')) 
      return 'Entertainment';
    if (desc.includes('electricity') || desc.includes('water') || desc.includes('gas') || desc.includes('broadband')) 
      return 'Utilities';
    if (desc.includes('rent') || desc.includes('lease')) return 'Housing';
    if (desc.includes('hospital') || desc.includes('pharmacy') || desc.includes('doctor') || desc.includes('medical')) 
      return 'Healthcare';
    if (desc.includes('neft') || desc.includes('rtgs') || desc.includes('imps') || desc.includes('ift')) 
      return 'Transfers Out';
    if (desc.includes('atm') || desc.includes('cash withdrawal')) return 'Cash Withdrawal';
    if (desc.includes('insurance')) return 'Insurance';
    if (desc.includes('emi') || desc.includes('loan')) return 'Loans & EMI';
    if (desc.includes('mutual fund') || desc.includes('mf') || desc.includes('stock') || desc.includes('invest')) 
      return 'Investments';
    
    return 'Other';
  }

  /**
   * Detect payment method
   */
  private static detectPaymentMethod(description: string): string {
    const desc = description.toUpperCase();
    
    if (desc.includes('UPI')) return 'UPI';
    if (desc.includes('NEFT')) return 'NEFT';
    if (desc.includes('RTGS')) return 'RTGS';
    if (desc.includes('IMPS')) return 'IMPS';
    if (desc.includes('IFT')) return 'Internal Transfer';
    if (desc.includes('CHQ') || desc.includes('CHEQUE')) return 'Cheque';
    if (desc.includes('ATM')) return 'ATM';
    if (desc.includes('POS') || desc.includes('CARD')) return 'Card (POS)';
    
    return 'Other';
  }

  /**
   * Extract metadata from description
   */
  private static extractMetadata(description: string): { notes: string; tags: string[] } {
    const tags: string[] = [];
    let notes = '';

    if (description.includes('UPI')) tags.push('digital');
    if (description.includes('NEFT') || description.includes('RTGS')) tags.push('transfer');
    if (description.includes('ATM')) tags.push('cash');

    // Extract UPI ID if present
    const upiMatch = description.match(/UPI[\/\-]([A-Z0-9]+)/i);
    if (upiMatch) notes = `UPI ID: ${upiMatch[1]}`;

    return { notes, tags };
  }

  /**
   * Clean up description text
   */
  private static cleanDescription(text: string): string {
    return text
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s\-\/]/g, '')
      .trim();
  }

  /**
   * Parse date from various formats
   */
  private static parseDate(dateStr: any): Date | null {
    if (!dateStr) return null;

    const str = dateStr.toString().trim();
    
    // Try DD-MMM-YYYY format
    const ddMmmYyyy = /(\d{2})-([A-Za-z]{3})-(\d{4})/.exec(str);
    if (ddMmmYyyy) {
      const months: { [key: string]: number } = {
        'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'may': 4, 'jun': 5,
        'jul': 6, 'aug': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dec': 11
      };
      const month = months[ddMmmYyyy[2].toLowerCase()];
      if (month !== undefined) {
        return new Date(parseInt(ddMmmYyyy[3]), month, parseInt(ddMmmYyyy[1]));
      }
    }

    // Try other common formats
    const date = new Date(str);
    if (!isNaN(date.getTime())) return date;

    return null;
  }

  /**
   * Parse amount from string/number
   */
  private static parseAmount(value: any): number {
    if (!value) return 0;
    const cleaned = value.toString().replace(/,/g, '').trim();
    return parseFloat(cleaned) || 0;
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
    const totalDebit = transactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);

    const totalCredit = transactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);

    // Validate totals with tolerance of ±0.01
    const tolerance = 0.01;

    if (summary.totalDebit && Math.abs(totalDebit - summary.totalDebit) > tolerance) {
      errors.push(
        `Debit mismatch: Expected ₹${summary.totalDebit.toFixed(2)}, ` +
        `got ₹${totalDebit.toFixed(2)} (difference: ₹${Math.abs(totalDebit - summary.totalDebit).toFixed(2)})`
      );
    }

    if (summary.totalCredit && Math.abs(totalCredit - summary.totalCredit) > tolerance) {
      errors.push(
        `Credit mismatch: Expected ₹${summary.totalCredit.toFixed(2)}, ` +
        `got ₹${totalCredit.toFixed(2)} (difference: ₹${Math.abs(totalCredit - summary.totalCredit).toFixed(2)})`
      );
    }

    // Validate balance
    const calculatedClosing = summary.openingBalance + totalCredit - totalDebit;
    if (summary.closingBalance && Math.abs(calculatedClosing - summary.closingBalance) > tolerance) {
      warnings.push(
        `Balance calculation off by ₹${Math.abs(calculatedClosing - summary.closingBalance).toFixed(2)}`
      );
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

export default IDFCBankParser;
