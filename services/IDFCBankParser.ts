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
import { log } from '../utils/log';
import { categorizeNarration, cleanNarration } from './categorize';
import { accountLast4 } from './accounts';

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
  /** Whether the statement printed these (0 is also a real balance). */
  openingKnown: boolean;
  closingKnown: boolean;
  accountNumber: string;
  statementPeriod: string;
  customerName: string;
}

interface ParseResult {
  transactions: Transaction[];
  summary: StatementSummary;
  /** "IDFC FIRST Bank", "HDFC Bank" or "Equitas Small Finance Bank". */
  bank: string;
  /** The account's last four digits, when the statement shows its number. */
  account: string | null;
  /** Where the opening and closing balances came from: printed, or the rows' running balance. */
  balancesFrom: 'statement' | 'rows';
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

      // The transactions table, found by its column names: IDFC FIRST's
      // "Transaction Date | Value Date | Particulars | … | Debit | Credit |
      // Balance", HDFC's "Date | Narration | Chq./Ref.No. | Value Dt |
      // Withdrawal Amt. | Deposit Amt. | Closing Balance".
      const columns = this.findColumns(data);
      if (!columns) {
        throw new Error('Could not find the transactions table: no row with Date, Debit (or Withdrawal) and Credit (or Deposit) columns.');
      }
      const bank = this.detectBank(data.slice(0, columns.header));
      const summary = this.extractSummary(data);

      const transactions: Transaction[] = [];
      for (const row of data.slice(columns.header + 1)) {
        if (!row) continue;
        const txn = this.parseTransaction(
          row[columns.date],
          columns.valueDate === undefined ? undefined : row[columns.valueDate],
          row[columns.narration],
          columns.ref === undefined ? undefined : row[columns.ref],
          row[columns.debit],
          row[columns.credit],
          columns.balance === undefined ? undefined : row[columns.balance],
          bank,
        );
        if (txn) transactions.push(txn);
      }

      // No balances printed (Equitas): the rows' own running balance gives
      // them, exactly, when every row follows from the one before.
      let balancesFrom: 'statement' | 'rows' = 'statement';
      if (!summary.openingKnown || !summary.closingKnown) {
        const derived = this.balancesFromRows(transactions);
        if (derived) {
          balancesFrom = 'rows';
          if (!summary.openingKnown) { summary.openingBalance = derived.opening; summary.openingKnown = true; }
          if (!summary.closingKnown) { summary.closingBalance = derived.closing; summary.closingKnown = true; }
        }
      }
      const account = this.accountLast4(data.slice(0, columns.header));

      // Validation
      const validation = this.validateTransactions(transactions, summary);

      log.debug(`Excel statement (${bank}): parsed ${transactions.length} transactions (valid: ${validation.isValid})`);
      if (!validation.isValid) {
        log.warn(`Excel statement: validation reported ${validation.errors.length} error(s), ${validation.warnings.length} warning(s)`);
      }

      return {
        transactions,
        summary,
        bank,
        account,
        balancesFrom,
        validation
      };
    } catch (error: any) {
      log.warn('Excel statement parsing failed:', error?.message);
      throw new Error(`Excel parsing failed: ${error.message}`);
    }
  }

  /** Where each column is, from the table's header row. */
  private static findColumns(data: any[][]): {
    header: number; date: number; valueDate?: number; narration: number; ref?: number;
    debit: number; credit: number; balance?: number;
  } | null {
    for (let i = 0; i < Math.min(80, data.length); i++) {
      const cells = (data[i] || []).map(c => (c ?? '').toString().trim().toLowerCase().replace(/\s+/g, ' '));
      const find = (test: RegExp, not?: RegExp) => {
        const at = cells.findIndex(c => c && test.test(c) && !(not && not.test(c)));
        return at === -1 ? undefined : at;
      };
      const date = find(/^(transaction |txn\.? |tran\.? )?date$|^dt$/);
      const narration = find(/particulars|narration|description|remarks|details/);
      const debit = find(/withdrawal|debit|^dr\.?( amount)?$/);
      const credit = find(/deposit|credit|^cr\.?( amount)?$/);
      if (date === undefined || narration === undefined || debit === undefined || credit === undefined) continue;
      return {
        header: i,
        date,
        valueDate: find(/^value d(a)?t(e)?\.?$/),
        narration,
        ref: find(/chq|cheque|ref/),
        debit,
        credit,
        balance: find(/balance/),
      };
    }
    return null;
  }

  /** The bank, from the rows above the table (name or IFSC). */
  private static detectBank(rows: any[][]): string {
    const text = rows.map(r => (r || []).join(' ')).join(' ');
    if (/HDFC\s*BANK|IFSC[^A-Z]{0,20}HDFC0/i.test(text)) return 'HDFC Bank';
    // Equitas's Excel table has the same columns Wall-ette reads for IDFC FIRST.
    if (/EQUITAS|IFSC[^A-Z]{0,20}ESFB0/i.test(text)) return 'Equitas Small Finance Bank';
    return 'IDFC FIRST Bank';
  }

  /**
   * The account's last four digits, from the rows above the table: "Account
   * No : 501000…1234" (HDFC), "Account No" with the number in the cells
   * beside it (Equitas), the number beside "Account" (IDFC FIRST). Only the
   * last four are kept: enough to tell a wallet's accounts apart, never the
   * number itself.
   */
  static accountLast4(rows: any[][]): string | null {
    return accountLast4(rows.map(r => (r || []).map(c => (c ?? '').toString()).join(' ')).join(' \n '));
  }

  /**
   * Opening and closing balances from the rows' own running balance, for a
   * statement that doesn't print them (Equitas's Excel). Only when every row
   * has a balance and each one follows from the last to the paisa, in file
   * order (oldest first) or reverse (newest first); else null.
   */
  static balancesFromRows(rows: readonly Pick<Transaction, 'amount' | 'type' | 'balance'>[]): { opening: number; closing: number } | null {
    if (rows.length === 0 || rows.some(r => r.balance === undefined || !Number.isFinite(r.balance))) return null;
    const paise = (n: number) => Math.round(n * 100);
    const signed = (r: Pick<Transaction, 'amount' | 'type'>) => (r.type === 'income' ? 1 : -1) * paise(r.amount);
    const chains = (list: readonly Pick<Transaction, 'amount' | 'type' | 'balance'>[]) =>
      list.every((r, i) => i === 0 || paise(list[i - 1].balance!) + signed(r) === paise(r.balance!));
    const ordered = chains(rows) ? rows : chains([...rows].reverse()) ? [...rows].reverse() : null;
    if (!ordered) return null;
    const first = ordered[0];
    const last = ordered[ordered.length - 1];
    return { opening: (paise(first.balance!) - signed(first)) / 100, closing: paise(last.balance!) / 100 };
  }

  // NOTE (audit Phase 5.2): the unused parsePDF / extractSummaryFromText /
  // parseTransactionFromPDFLine trio was removed — PDF statements are handled
  // by services/idfcParser.ts (parseIDFCStatement), which was the only path
  // ever exercised.

  /**
   * Extract summary from Excel data
   */
  private static extractSummary(data: any[][]): StatementSummary {
    let openingBalance = 0;
    let totalDebit = 0;
    let totalCredit = 0;
    let closingBalance = 0;
    let openingKnown = false;
    let closingKnown = false;
    let accountNumber = '';
    let statementPeriod = '';
    let customerName = '';

    // The summary's labels with the figures in the row below, same columns:
    // IDFC FIRST puts it above the table ("Opening Balance | Total Debit |
    // Total Credit | Closing Balance"), HDFC below ("Opening Balance | Debits
    // | Credits | Closing Bal", under "STATEMENT SUMMARY").
    for (let i = 0; i < data.length - 1; i++) {
      const labels = (data[i] || []).map(c => (c ?? '').toString().trim().toLowerCase());
      const opening = labels.findIndex(c => /^opening bal/.test(c));
      const debits = labels.findIndex(c => /^(total )?debits?$/.test(c));
      const credits = labels.findIndex(c => /^(total )?credits?$/.test(c));
      if (opening === -1 || debits === -1 || credits === -1) continue;
      const closing = labels.findIndex(c => /^closing bal/.test(c));
      const values = data[i + 1] || [];
      openingBalance = this.parseAmount(values[opening]);
      openingKnown = (values[opening] ?? '').toString().trim() !== '';
      totalDebit = this.parseAmount(values[debits]);
      totalCredit = this.parseAmount(values[credits]);
      if (closing !== -1) {
        closingBalance = this.parseAmount(values[closing]);
        closingKnown = (values[closing] ?? '').toString().trim() !== '';
      }
      break;
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
      openingKnown,
      closingKnown,
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
    balance: any,
    bank: string
  ): Transaction | null {
    
    // Parse date
    const date = this.parseDate(txnDate);
    if (!date) return null;
    const parsedValueDate = this.parseDate(valueDate);

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
    const description = cleanNarration(particulars?.toString() || '');
    
    // Auto-categorize (same rules as the PDF parser)
    const category = categorizeNarration(description, type);

    // Extract metadata
    const metadata = this.extractMetadata(description);

    return {
      id: this.generateId(),
      // LOCAL date, not toISOString(): parseDate returns local midnight, and
      // toISOString() converts to UTC — which shifted every transaction one
      // day earlier for IST users (a 17-Jun txn became 16-Jun).
      date: this.toLocalISO(date),
      description,
      amount,
      type,
      category,
      paymentMethod: this.detectPaymentMethod(description),
      notes: metadata.notes,
      tags: metadata.tags,
      balance: balance === undefined || balance === null || balance === '' ? undefined : this.parseAmount(balance),
      valueDate: parsedValueDate ? this.toLocalISO(parsedValueDate) : undefined,
      chequeNumber: chequeNo?.toString() || undefined,
      source: bank,
      rawData: {
        particulars: particulars?.toString(),
        debit: debitAmount,
        credit: creditAmount
      }
    };
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

    // No note of its own: the row keeps the bank's narration in full as its
    // note (fromExcel), as PDF rows do. (Up to 1.5.8 this saved "UPI ID: DR",
    // the debit marker read as an ID; Vault's details skip those.)
    return { notes, tags };
  }

  /**
   * Parse date from various formats
   */
  private static parseDate(dateStr: any): Date | null {
    if (!dateStr) return null;
    if (dateStr instanceof Date) return isNaN(dateStr.getTime()) ? null : dateStr;

    const str = dateStr.toString().trim();
    const months: { [key: string]: number } = {
      'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'may': 4, 'jun': 5,
      'jul': 6, 'aug': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dec': 11
    };
    const year = (y: string) => (y.length === 2 ? 2000 + parseInt(y) : parseInt(y));
    const valid = (y: number, m: number, d: number) => {
      const date = new Date(y, m, d);
      return date.getMonth() === m && date.getDate() === d ? date : null;
    };

    // DD-MMM-YYYY (IDFC FIRST), also DD MMM YY
    const named = /^(\d{1,2})[\s\-\/]([A-Za-z]{3})[A-Za-z]*[\s\-\/,]+(\d{2}|\d{4})$/.exec(str);
    if (named) {
      const month = months[named[2].toLowerCase()];
      return month === undefined ? null : valid(year(named[3]), month, parseInt(named[1]));
    }

    // DD/MM/YY or DD/MM/YYYY (HDFC). Indian statements put the day first;
    // new Date() would read 01/02/26 as January 2nd.
    const numeric = /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2}|\d{4})$/.exec(str);
    if (numeric) return valid(year(numeric[3]), parseInt(numeric[2]) - 1, parseInt(numeric[1]));

    // YYYY-MM-DD
    const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(str);
    if (iso) return valid(parseInt(iso[1]), parseInt(iso[2]) - 1, parseInt(iso[3]));

    return null;
  }

  /** Format a local-time Date as YYYY-MM-DD without UTC conversion. */
  private static toLocalISO(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
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

    // Each row's balance must move by its amount, the way its column says.
    let prev: number | undefined;
    let breaks = 0;
    for (const t of transactions) {
      if (t.balance === undefined) { prev = undefined; continue; }
      if (prev !== undefined) {
        const expected = prev + (t.type === 'income' ? t.amount : -t.amount);
        if (Math.abs(expected - t.balance) > tolerance) breaks++;
      }
      prev = t.balance;
    }
    if (breaks > 0) errors.push(`The running balance doesn't add up at ${breaks} row(s).`);

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
