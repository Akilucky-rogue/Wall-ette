import XLSX from 'xlsx';

const file = 'IDFCFIRSTBankstatement_10001193553_122247562.xlsx';
const wb = XLSX.readFile(file);
const ws = wb.Sheets[wb.SheetNames[0]];
const data = XLSX.utils.sheet_to_json(ws, {header: 1, raw: false});

console.log('Testing IDFCBankParser logic...');
console.log('Total rows:', data.length);

// Find header
const headerRowIndex = data.findIndex(row => 
  row && row.some(cell => 
    cell && cell.toString().toLowerCase().includes('transaction date')
  )
);

console.log('Header row index:', headerRowIndex);

if (headerRowIndex === -1) {
  console.error('ERROR: Header row not found!');
  console.log('Checking all rows for "transaction"...');
  data.forEach((row, i) => {
    if (row && row.join('').toLowerCase().includes('transaction')) {
      console.log('Row', i, ':', row.slice(0, 7).join(' | '));
    }
  });
} else {
  console.log('✅ Header found');
  console.log('Headers:', data[headerRowIndex].slice(0, 7).join(' | '));
  
  // Check transaction rows
  const txnRows = data.slice(headerRowIndex + 1);
  const validTxns = txnRows.filter(row => 
    row && row.length > 3 && row[0] && row[0].toString().trim()
  );
  
  console.log('Transaction rows found:', validTxns.length);
  console.log('First 3 transactions:');
  validTxns.slice(0, 3).forEach((t, i) => {
    console.log(i+1, '|', 'Date:', t[0], '| Desc:', t[2]?.substring(0, 30), '| Debit:', t[4], '| Credit:', t[5], '| Balance:', t[6]);
  });
}
