import XLSX from 'xlsx';

const filePath = 'IDFCFIRSTBankstatement_10001193553_173158314.xlsx';

try {
  const workbook = XLSX.readFile(filePath);
  const worksheet = workbook.Sheets['Account Statement'];
  const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
  
  console.log('\n=== DETAILED EXCEL ANALYSIS ===\n');
  
  // Find the summary row (line 18)
  console.log('ROW 18 (Summary Headers):');
  console.log(JSON.stringify(data[18]));
  
  console.log('\nROW 19 (Summary Values):');
  console.log(JSON.stringify(data[19]));
  
  // Extract actual values
  const summaryRow = data[19];
  const openingBalance = parseFloat(summaryRow[0]);
  const totalDebit = parseFloat(summaryRow[1]);
  const totalCredit = parseFloat(summaryRow[2]);
  const closingBalance = parseFloat(summaryRow[3]);
  
  console.log('\n=== SUMMARY EXTRACTED ===');
  console.log(`Opening Balance: ${openingBalance}`);
  console.log(`Total Debit: ${totalDebit}`);
  console.log(`Total Credit: ${totalCredit}`);
  console.log(`Closing Balance: ${closingBalance}`);
  
  // Verify equation
  console.log('\n=== BALANCE VERIFICATION ===');
  const calculatedClosing = openingBalance + totalCredit - totalDebit;
  console.log(`Formula: Opening + Credits - Debits = Closing`);
  console.log(`${openingBalance} + ${totalCredit} - ${totalDebit} = ${calculatedClosing}`);
  console.log(`Expected Closing: ${closingBalance}`);
  console.log(`Calculated Closing: ${calculatedClosing}`);
  console.log(`Match: ${Math.abs(calculatedClosing - closingBalance) < 0.01}`);
  console.log(`Difference: ${Math.abs(calculatedClosing - closingBalance)}`);
  
  // Find transaction header row
  console.log('\n=== TRANSACTION DATA ===');
  let transactionHeaderIdx = -1;
  let transactionStartIdx = -1;
  
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    if (row[0] === 'Transaction Date' || row[0] === 'Transaction Date' && row[1] === 'Value Date') {
      transactionHeaderIdx = i;
      transactionStartIdx = i + 1;
      console.log(`Transaction header row: ${i}`);
      console.log(`Headers: ${JSON.stringify(row)}`);
      break;
    }
  }
  
  if (transactionStartIdx < 0) {
    // Search more broadly
    for (let i = 15; i < 30; i++) {
      if (data[i] && data[i][0] && data[i][0].toString().includes('Date')) {
        console.log(`Found potential transaction header at row ${i}: ${JSON.stringify(data[i])}`);
      }
    }
  }
  
  // Find where transaction data ends
  console.log(`\nFinal rows (looking for totals):`)
  for (let i = data.length - 20; i < data.length; i++) {
    if (i >= 0) {
      console.log(`Row ${i}: ${JSON.stringify(data[i])}`);
    }
  }
  
  // Count actual transactions (non-header, non-empty rows between header and end)
  let transactionCount = 0;
  let debitCount = 0;
  let creditCount = 0;
  
  for (let i = 24; i < data.length; i++) {
    const row = data[i];
    if (row && row.length > 0 && row[0]) {
      // Check if it looks like a transaction (has a date)
      if (row[0] && (typeof row[0] === 'string' && row[0].includes('-')) || (typeof row[0] === 'number')) {
        transactionCount++;
        // Column 4 is debit, column 5 is credit (0-indexed)
        if (row[4] && !isNaN(parseFloat(row[4]))) {
          debitCount++;
        }
        if (row[5] && !isNaN(parseFloat(row[5]))) {
          creditCount++;
        }
      }
    }
  }
  
  console.log(`\n=== TRANSACTION COUNT ===`);
  console.log(`Total transactions found: ${transactionCount}`);
  console.log(`Debit transactions: ${debitCount}`);
  console.log(`Credit transactions: ${creditCount}`);
  
  // Sample first 10 and last 10 transactions
  console.log(`\n=== FIRST 10 TRANSACTIONS (from row 24) ===`);
  for (let i = 0; i < 10; i++) {
    if (data[24 + i]) {
      console.log(`Txn ${i + 1}: Date: ${data[24 + i][0]}, Description: ${(data[24 + i][2] || '').substring(0, 50)}..., Debit: ${data[24 + i][4]}, Credit: ${data[24 + i][5]}, Balance: ${data[24 + i][6]}`);
    }
  }
  
  console.log(`\n=== LAST 10 TRANSACTIONS ===`);
  for (let i = 9; i >= 0; i--) {
    const rowIdx = data.length - 10 + (9 - i);
    if (data[rowIdx]) {
      console.log(`Txn ${i + 1}: Date: ${data[rowIdx][0]}, Description: ${(data[rowIdx][2] || '').substring(0, 50)}..., Debit: ${data[rowIdx][4]}, Credit: ${data[rowIdx][5]}, Balance: ${data[rowIdx][6]}`);
    }
  }
  
} catch (error) {
  console.error('Error:', error.message);
  console.error(error.stack);
  process.exit(1);
}
