/**
 * PDF Parser for IDFC FIRST Bank Statements
 * Uses pdf-parse library for accurate text extraction
 */

import * as pdfParse from 'pdf-parse';

export class PDFParser {
  
  /**
   * Extract text from PDF buffer
   */
  static async extractText(buffer: ArrayBuffer): Promise<string> {
    const data = await pdfParse(Buffer.from(buffer));
    return data.text;
  }

  /**
   * Parse IDFC statement from PDF with high accuracy
   */
  static parseIDFCStatement(pdfText: string): {
    summary: any;
    transactions: any[];
  } {
    const lines = pdfText.split('\n').map(l => l.trim()).filter(l => l);

    // Extract summary
    const summary = this.extractSummary(lines);
    
    // Extract transactions
    const transactions = this.extractTransactions(lines);

    return { summary, transactions };
  }

  /**
   * Extract statement summary from PDF text
   */
  private static extractSummary(lines: string[]): any {
    let accountNumber = '';
    let customerName = '';
    let statementPeriod = '';
    let openingBalance = 0;
    let totalDebit = 0;
    let totalCredit = 0;
    let closingBalance = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Extract account details
      if (line.includes('ACCOUNT NO')) {
        accountNumber = line.split(':')[1]?.trim() || '';
      }
      if (line.includes('CUSTOMER NAME')) {
        customerName = line.split(':')[1]?.trim() || '';
      }
      if (line.includes('STATEMENT PERIOD')) {
        statementPeriod = line.split(':')[1]?.trim() || '';
      }

      // Extract summary numbers
      // Look for line with Opening Balance, Total Debit, Total Credit, Closing Balance
      if (line.includes('Opening Balance') && line.includes('Total Debit')) {
        // Next line should have the values
        const nextLine = lines[i + 1];
        const numbers = nextLine.match(/([\d,]+\.[\d]{2})/g);
        if (numbers && numbers.length >= 4) {
          openingBalance = this.parseAmount(numbers[0]);
          totalDebit = this.parseAmount(numbers[1]);
          totalCredit = this.parseAmount(numbers[2]);
          closingBalance = this.parseAmount(numbers[3]);
        }
      }
    }

    return {
      accountNumber,
      customerName,
      statementPeriod,
      openingBalance,
      totalDebit,
      totalCredit,
      closingBalance
    };
  }

  /**
   * Extract transactions from PDF text
   */
  private static extractTransactions(lines: string[]): any[] {
    const transactions: any[] = [];
    let inTransactionSection = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Start of transaction section
      if (line.includes('Transaction') && line.includes('Date') && line.includes('Particulars')) {
        inTransactionSection = true;
        continue;
      }

      // End of transaction section
      if (line.includes('REGISTERED OFFICE') || line.includes('End of statement') || 
          line.includes('IMPORTANT MESSAGE')) {
        inTransactionSection = false;
        break;
      }

      if (!inTransactionSection) continue;

      // Parse transaction line
      // Format: DD-MMM-YYYY DD-MMM-YYYY Description Amount(Debit or Credit) Balance
      const dateMatch = line.match(/^(\d{2}-[A-Za-z]{3}-\d{4})\s+(\d{2}-[A-Za-z]{3}-\d{4})\s+(.+)/);
      
      if (dateMatch) {
        const [, txnDate, valueDate, rest] = dateMatch;
        
        // Extract amounts from rest of line
        const amounts = rest.match(/([\d,]+\.[\d]{2})/g);
        if (!amounts || amounts.length < 2) continue;

        // Last amount is balance, second-to-last is transaction amount
        const balance = amounts[amounts.length - 1];
        const transactionAmount = amounts[amounts.length - 2];

        // Extract description (everything before the amounts)
        const amountPattern = new RegExp(`\\s+(${amounts.join('|').replace(/\./g, '\\.')})\\s*`, 'g');
        const description = rest.replace(amountPattern, '').trim();

        // Determine if debit or credit
        const isDebit = description.includes('/DR/') || 
                       !description.includes('/CR/') && 
                       description.toUpperCase().includes('UPI') ||
                       description.toUpperCase().includes('IFT');

        const transaction = {
          date: txnDate,
          valueDate,
          description,
          amount: this.parseAmount(transactionAmount),
          type: isDebit ? 'expense' : 'income',
          balance: this.parseAmount(balance),
          isDebit,
          isCredit: !isDebit
        };

        transactions.push(transaction);
      }
    }

    return transactions;
  }

  /**
   * Parse amount from string
   */
  private static parseAmount(value: string): number {
    if (!value) return 0;
    const cleaned = value.replace(/,/g, '').trim();
    return parseFloat(cleaned) || 0;
  }

  /**
   * Alternative: Extract using regex patterns for more robust parsing
   */
  static extractTransactionsAdvanced(pdfText: string): any[] {
    const transactions: any[] = [];

    // Pattern: Date(DD-Mon-YYYY) Date Description Debit/Credit Balance
    const pattern = /(\d{2}-[A-Za-z]{3}-\d{4})\s+(\d{2}-[A-Za-z]{3}-\d{4})\s+(.+?)\s+([\d,]+\.[\d]{2})\s+([\d,]+\.[\d]{2})$/gm;
    
    let match;
    while ((match = pattern.exec(pdfText)) !== null) {
      const [, txnDate, valueDate, description, amount, balance] = match;

      // Determine type based on description
      const isDebit = description.includes('/DR/') || description.includes('UPI/DR') || 
                     description.includes('IFT/') && !description.includes('/CR/');

      transactions.push({
        date: txnDate,
        valueDate,
        description: description.trim(),
        amount: this.parseAmount(amount),
        type: isDebit ? 'expense' : 'income',
        balance: this.parseAmount(balance)
      });
    }

    return transactions;
  }
}

/**
 * Browser-compatible PDF parser (no Node.js dependencies)
 */
export class BrowserPDFParser {
  
  /**
   * Extract text from PDF using PDF.js (browser-compatible)
   */
  static async extractTextBrowser(file: File): Promise<string> {
    // Import PDF.js dynamically
    const pdfjsLib = await import('pdfjs-dist');
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    
    let fullText = '';

    // Extract text from each page
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');
      
      fullText += pageText + '\n';
    }

    return fullText;
  }

  /**
   * Parse IDFC statement from extracted PDF text
   */
  static parseIDFCFromText(text: string): {
    summary: any;
    transactions: any[];
  } {
    return PDFParser.parseIDFCStatement(text);
  }
}

/**
 * Usage Examples:
 * 
 * // Server-side (Node.js)
 * const buffer = fs.readFileSync('statement.pdf');
 * const text = await PDFParser.extractText(buffer);
 * const { summary, transactions } = PDFParser.parseIDFCStatement(text);
 * 
 * // Browser-side
 * const file = event.target.files[0];
 * const text = await BrowserPDFParser.extractTextBrowser(file);
 * const { summary, transactions } = BrowserPDFParser.parseIDFCFromText(text);
 */
