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

      log.debug(`IDFC Excel: parsed ${transactions.length} transactions (valid: ${validation.isValid})`);
      if (!validation.isValid) {
        log.warn(`IDFC Excel: validation reported ${validation.errors.length} error(s), ${validation.warnings.length} warning(s)`);
      }

      return {
        transactions,
        summary,
        validation
      };
    } catch (error: any) {
      log.warn('IDFC Excel parsing failed:', error?.message);
      throw new Error(`Excel parsing failed: ${error.message} | Please ensure the file is a valid IDFC statement with "Transaction Date" column.`);
    }
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

    // Extract values from summary
    if (summaryValueRow > -1 && data[summaryValueRow]) {
      const valueRow = data[summaryValueRow];

      // Parse values based on column position
      if (valueRow[0]) openingBalance = this.parseAmount(valueRow[0]);
      if (valueRow[1]) totalDebit = this.parseAmount(valueRow[1]);
      if (valueRow[2]) totalCredit = this.parseAmount(valueRow[2]);
      if (valueRow[3]) closingBalance = this.parseAmount(valueRow[3]);
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
    const description = this.cleanDescription(particulars?.toString() || '');
    
    // Auto-categorize
    const category = this.categorizeTransaction(description, type);

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
      balance: this.parseAmount(balance),
      valueDate: parsedValueDate ? this.toLocalISO(parsedValueDate) : undefined,
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
   * Categorize transaction based on description with comprehensive Indian merchant/UPI patterns
   */
  private static categorizeTransaction(description: string, type: string): string {
    const desc = description.toLowerCase();

    // ── INCOME categories ────────────────────────────────────────────────────
    if (type === 'income') {
      if (desc.match(/\bsal\b|salary|payroll|stipend|ctc/)) return 'Salary';
      if (desc.match(/bonus|incentive|reward|cashback|cb\b/)) return 'Bonus';
      if (desc.match(/dividend|mutual.?fund|\bmf\b|sip.?return|nav/)) return 'Investment Returns';
      if (desc.match(/interest|fd.?int|recurring.?dep|int.?cr/)) return 'Interest Income';
      if (desc.match(/refund|reversal|chargeback|return|rfd/)) return 'Refunds';
      if (desc.match(/freelance|invoice|consulting|payment.?received/)) return 'Freelance';
      if (desc.match(/rent.?received|rental.?income/)) return 'Rental Income';
      // Generic transfers in — keep as last resort
      return 'Transfer In';
    }

    // ── EXPENSE: Food & Dining ───────────────────────────────────────────────
    if (desc.match(/zomato|swiggy|dunzo|magicpin|eatsure|box8|freshmenu|rebel.?foods/))
      return 'Food Delivery';
    if (desc.match(/dominos|dominoes|pizza.?hut|kfc|mcdonalds|mcd\b|burger.?king|subway|starbucks|cafe.?coffee|ccd\b|barista|chaayos|naturals.?ice/))
      return 'Dining';
    if (desc.match(/restaurant|dhaba|hotel.?food|biryani|thali|mess\b|canteen|cafeteria/))
      return 'Dining';

    // ── EXPENSE: Groceries ───────────────────────────────────────────────────
    if (desc.match(/blinkit|zepto|bigbasket|big.?basket|jiomart|milkbasket|supr.?daily|grofers|instamart/))
      return 'Groceries';
    if (desc.match(/dmart|d.?mart|reliance.?fresh|reliance.?smart|more.?supermarket|spencers|star.?bazaar|lulu.?mart|nature.?basket/))
      return 'Groceries';
    if (desc.match(/\bgrocery\b|kirana|provision|supermarket|hypermarket/))
      return 'Groceries';

    // ── EXPENSE: Transport ───────────────────────────────────────────────────
    if (desc.match(/uber|ola.?cab|rapido|meru|taxi\b|cab\b/))
      return 'Taxi & Cab';
    if (desc.match(/irctc|indian.?railway|railway|train.?ticket/))
      return 'Train';
    if (desc.match(/\bair\b.*ticket|airline|indigo|air.?india|spicejet|vistara|goair|akasa|flight/))
      return 'Flights';
    if (desc.match(/metro|dmrc|bmrc|nmrc|cmrl|smartcard.?recharge/))
      return 'Metro';
    if (desc.match(/petrol|fuel|hpcl|bpcl|iocl|indian.?oil|hp.?pump|shell.?pump/))
      return 'Fuel';
    if (desc.match(/parking|fastag|toll|highway/))
      return 'Transport';
    if (desc.match(/bus\b|ksrtc|msrtc|apsrtc|tsrtc|redbus/))
      return 'Transport';

    // ── EXPENSE: Shopping ────────────────────────────────────────────────────
    if (desc.match(/amazon|flipkart|myntra|ajio|meesho|nykaa|tatacliq|tata.?cliq|snapdeal|shopsy|jiomart.?shop/))
      return 'Online Shopping';
    if (desc.match(/\bh&m\b|zara|uniqlo|westside|max.?fashion|pantaloons|lifestyle|shoppers.?stop|trends\b/))
      return 'Clothing';
    if (desc.match(/apple.?store|croma|vijay.?sales|reliance.?digital|samsung|oneplus|laptop|mobile.?purchase/))
      return 'Electronics';
    if (desc.match(/ikea|pepperfry|urban.?ladder|hometown|furniture/))
      return 'Furniture';

    // ── EXPENSE: Entertainment ───────────────────────────────────────────────
    if (desc.match(/netflix|hotstar|disney\+|zee5|sonyliv|jiocinema|primevideo|amazon.?prime|hulu|apple.?tv/))
      return 'Streaming';
    if (desc.match(/spotify|gaana|wynk|jiosaavn|apple.?music|youtube.?premium/))
      return 'Music';
    if (desc.match(/bookmyshow|pvr|inox|cinepolis|movie.?ticket/))
      return 'Movies';
    if (desc.match(/steam\b|playstation|xbox|nintendo|game\b|gaming/))
      return 'Games';

    // ── EXPENSE: Telecom ─────────────────────────────────────────────────────
    if (desc.match(/jio\b|airtel|bsnl|\bvi\b|vodafone|idea.?vodafone|tata.?docomo|recharge|mobile.?bill|postpaid/))
      return 'Phone & Internet';
    if (desc.match(/jiofib|hathway|act.?fibre|you.?broadband|airtel.?fiber|broadband|internet.?bill/))
      return 'Phone & Internet';

    // ── EXPENSE: Utilities ───────────────────────────────────────────────────
    if (desc.match(/electricity|bescom|mseb|tata.?power|adani.?elec|torrent.?power|bwssb|water.?bill|piped.?gas|mgl\b|igl\b|adani.?gas/))
      return 'Utilities';
    if (desc.match(/gas.?bill|lpg|cooking.?gas|indane|hp.?gas|bharat.?gas/))
      return 'Utilities';

    // ── EXPENSE: Housing ─────────────────────────────────────────────────────
    if (desc.match(/\brent\b|rental|lease|maintenance.?society|society.?maint|housing.?society|apartment/))
      return 'Rent';

    // ── EXPENSE: Healthcare ──────────────────────────────────────────────────
    if (desc.match(/pharmeasy|1mg|apollo.?pharma|medplus|netmeds|tata.?1mg|pharmacy|medical.?store/))
      return 'Pharmacy';
    if (desc.match(/hospital|clinic|doctor|dr\.\s|consultant.?fee|apollo\b|fortis|manipal|max.?hospital|aiims/))
      return 'Doctor & Hospital';
    if (desc.match(/diagnostic|lab.?test|blood.?test|thyrocare|srl.?diagnost|lal.?path/))
      return 'Healthcare';

    // ── EXPENSE: Insurance ───────────────────────────────────────────────────
    if (desc.match(/lic\b|hdfc.?life|icici.?pru|sbi.?life|max.?life|bajaj.?allianz|tata.?aia|insurance|premium.?due/))
      return 'Insurance';
    if (desc.match(/health.?insur|car.?insur|bike.?insur|term.?plan/))
      return 'Insurance';

    // ── EXPENSE: Investments ─────────────────────────────────────────────────
    if (desc.match(/zerodha|groww|kuvera|paytm.?money|coin.?zerodha|angel.?broking|motilaloswal|hdfc.?sec|icicidirect|upstox|trftochoice|choice.?equity|razorpaytp.*choice/))
      return 'Investment';
    if (desc.match(/mutual.?fund|\bsip\b|\bmf\b|nfo\b|nav\b|demat/))
      return 'Investment';
    if (desc.match(/fd\b|fixed.?deposit|recurring.?deposit|\brd\b/))
      return 'Investment';

    // ── EXPENSE: Loans & EMI ─────────────────────────────────────────────────
    if (desc.match(/\bemi\b|loan.?emi|equated|home.?loan|car.?loan|personal.?loan|education.?loan|hl\b|pl\b/))
      return 'Loan & EMI';
    if (desc.match(/credit.?card.?bill|cc.?payment|card.?due|amex|hdfc.?cc|sbi.?card/))
      return 'Credit Card';

    // ── EXPENSE: Education ───────────────────────────────────────────────────
    if (desc.match(/school.?fee|college.?fee|tuition|coaching|byju|unacademy|vedantu|coursera|udemy|upgrad/))
      return 'Education';

    // ── EXPENSE: Personal Care ───────────────────────────────────────────────
    if (desc.match(/salon|spa\b|haircut|beauty|nykaa.?fashion|mamaearth|wow.?skin/))
      return 'Personal Care';

    // ── EXPENSE: ATM / Cash ──────────────────────────────────────────────────
    if (desc.match(/\batm\b|cash.?withdrawal|cwl\b/))
      return 'Cash Withdrawal';

    // ── EXPENSE: Subscriptions ───────────────────────────────────────────────
    if (desc.match(/subscription|renewal|annual.?plan|membership/))
      return 'Subscriptions';
    if (desc.match(/gym\b|fitness|cult.?fit|gold.?gym|anytime.?fitness/))
      return 'Gym';

    // ── EXPENSE: Transfers (classify last — very broad) ──────────────────────
    if (desc.match(/\bneft\b|\brtgs\b|\bimps\b|\bift\b|\bupi\b/))
      return 'Transfer Out';

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
   * Clean up description text — preserve UPI IDs, merchant names, and useful punctuation
   */
  private static cleanDescription(text: string): string {
    return text
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s\-\/@.:]/g, '') // Keep @, ., :, / for UPI IDs and transfer references
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
