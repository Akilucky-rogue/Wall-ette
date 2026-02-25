import XLSX from 'xlsx';

// Automatically use the latest IDFC bank statement file in the directory
import fs from 'fs';
import path from 'path';


const dir = '.';
const files = fs.readdirSync(dir)
  .filter(f => /^IDFCFIRSTBankstatement_.*\.xlsx$/.test(f))
  .map(f => ({ name: f, time: fs.statSync(path.join(dir, f)).mtime.getTime() }))
  .sort((a, b) => b.time - a.time);

if (files.length === 0) {
  console.error('No IDFCFIRSTBankstatement_*.xlsx file found in directory.');
  process.exit(1);
}

for (const fileObj of files) {
  const filePath = fileObj.name;
  console.log('\n==============================');
  console.log(`Analyzing file: ${filePath}`);
  console.log('==============================\n');
  try {
    const workbook = XLSX.readFile(filePath);
    const worksheet = workbook.Sheets['Account Statement'];
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });


    // Summary
    console.log('ROW 18 (Summary Headers):');
    console.log(JSON.stringify(data[18]));
    console.log('ROW 19 (Summary Values):');
    console.log(JSON.stringify(data[19]));

    const summaryRow = data[19];
    const openingBalance = parseFloat(summaryRow[0]);
    const totalDebit = parseFloat(summaryRow[1]);
    const totalCredit = parseFloat(summaryRow[2]);
    const closingBalance = parseFloat(summaryRow[3]);

    // Count transactions (and debit/credit)
    let transactionCount = 0;
    let debitCount = 0;
    let creditCount = 0;
    for (let i = 24; i < data.length; i++) {
      const row = data[i];
      if (row && row.length > 0 && row[0]) {
        if (row[0] && (typeof row[0] === 'string' && row[0].includes('-')) || (typeof row[0] === 'number')) {
          transactionCount++;
          if (row[4] && !isNaN(parseFloat(row[4]))) debitCount++;
          if (row[5] && !isNaN(parseFloat(row[5]))) creditCount++;
        }
      }
    }

    // Export summary as .summary.json
    const summaryObj = {
      openingBalance,
      totalDebit,
      totalCredit,
      closingBalance,
      transactionCount,
      period: 'All Time',
      file: filePath
    };
    const summaryPath = filePath + '.summary.json';
    try {
      fs.writeFileSync(summaryPath, JSON.stringify(summaryObj, null, 2));
      console.log(`Summary exported to ${summaryPath}`);
    } catch (e) {
      console.error('Failed to export summary:', e.message);
    }

    console.log('--- SUMMARY EXTRACTED ---');
    console.log(`Opening Balance: ${openingBalance}`);
    console.log(`Total Debit: ${totalDebit}`);
    console.log(`Total Credit: ${totalCredit}`);
    console.log(`Closing Balance: ${closingBalance}`);

    // Verify equation
    const calculatedClosing = openingBalance + totalCredit - totalDebit;
    const match = Math.abs(calculatedClosing - closingBalance) < 0.01;
    console.log('--- BALANCE VERIFICATION ---');
    console.log(`Formula: Opening + Credits - Debits = Closing`);
    console.log(`${openingBalance} + ${totalCredit} - ${totalDebit} = ${calculatedClosing}`);
    console.log(`Expected Closing: ${closingBalance}`);
    console.log(`Calculated Closing: ${calculatedClosing}`);
    console.log(`Match: ${match}`);
    console.log(`Difference: ${Math.abs(calculatedClosing - closingBalance)}`);

    // Transaction header
    let transactionHeaderIdx = -1;
    let transactionStartIdx = -1;
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      if (row[0] === 'Transaction Date' || row[0] === 'Transaction Date' && row[1] === 'Value Date') {
        transactionHeaderIdx = i;
        transactionStartIdx = i + 1;
        break;
      }
    }
    if (transactionStartIdx < 0) {
      for (let i = 15; i < 30; i++) {
        if (data[i] && data[i][0] && data[i][0].toString().includes('Date')) {
          // Potential header
        }
      }
    }

    console.log('--- TRANSACTION COUNT ---');
    console.log(`Total transactions found: ${transactionCount}`);
    console.log(`Debit transactions: ${debitCount}`);
    console.log(`Credit transactions: ${creditCount}`);

    // Sample transactions
    console.log('--- FIRST 3 TRANSACTIONS ---');
    for (let i = 0; i < 3; i++) {
      if (data[24 + i]) {
        console.log(`Txn ${i + 1}: Date: ${data[24 + i][0]}, Desc: ${(data[24 + i][2] || '').substring(0, 50)}..., Debit: ${data[24 + i][4]}, Credit: ${data[24 + i][5]}, Balance: ${data[24 + i][6]}`);
      }
    }
    console.log('--- LAST 3 TRANSACTIONS ---');
    for (let i = 2; i >= 0; i--) {
      const rowIdx = data.length - 3 + (2 - i);
      const row = data[rowIdx];
      if (row && Array.isArray(row)) {
        let desc = '';
        if (typeof row[2] === 'string') desc = row[2].substring(0, 50);
        else if (row[2] != null) desc = String(row[2]).substring(0, 50);
        console.log(`Txn ${i + 1}: Date: ${row[0]}, Desc: ${desc}..., Debit: ${row[4]}, Credit: ${row[5]}, Balance: ${row[6]}`);
      }
    }

    if (!match) {
      console.error(`❌ Balance mismatch in file: ${filePath}`);
    } else {
      console.log(`✅ Balance matches for file: ${filePath}`);
    }
  } catch (error) {
    console.error(`Error in file ${filePath}:`, error.message);
    console.error(error.stack);
  }
}
