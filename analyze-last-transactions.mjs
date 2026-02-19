import XLSX from 'xlsx';

const filePath = 'IDFCFIRSTBankstatement_10001193553_173158314.xlsx';

try {
  const workbook = XLSX.readFile(filePath);
  const worksheet = workbook.Sheets['Account Statement'];
  const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
  
  // Find where transaction data really ends
  let lastTransactionIdx = -1;
  for (let i = data.length - 1; i >= 0; i--) {
    const row = data[i];
    if (row && row[0] && (typeof row[0] === 'string' && row[0].includes('-'))) {
      lastTransactionIdx = i;
      break;
    }
  }
  
  console.log(`\n=== LAST 10 TRANSACTIONS ===`);
  const startIdx = Math.max(24, lastTransactionIdx - 9);
  
  for (let i = startIdx; i <= lastTransactionIdx; i++) {
    const row = data[i];
    if (row && row.length > 0) {
      const date = row[0] || '';
      const valueDate = row[1] || '';
      const particulars = (row[2] && typeof row[2] === 'string') ? row[2].substring(0, 45) : (row[2] || '');
      const cheque = row[3] || '';
      const debit = row[4] ? parseFloat(row[4]).toFixed(2) : '';
      const credit = row[5] ? parseFloat(row[5]).toFixed(2) : '';
      const balance = row[6] ? parseFloat(row[6]).toFixed(2) : '';
      
      console.log(`${i - 23}. ${date} | ${valueDate} | ${particulars} | Debit: ${debit} | Credit: ${credit} | Balance: ${balance}`);
    }
  }
  
} catch (error) {
  console.error('Error:', error.message);
}
