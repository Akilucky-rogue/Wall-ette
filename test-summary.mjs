import XLSX from 'xlsx';

const file = 'IDFCFIRSTBankstatement_10001193553_122247562.xlsx';
const wb = XLSX.readFile(file);
const ws = wb.Sheets[wb.SheetNames[0]];
const data = XLSX.utils.sheet_to_json(ws, {header: 1, raw: false});

console.log('Testing Summary Extraction...');
console.log('\nFirst 30 rows:');
data.slice(0, 25).forEach((row, i) => {
  console.log(`Row ${i}:`, row);
});

// Test actual summary row (row 18-19 based on our earlier testing)
console.log('\n=== SUMMARY ROW ===');
console.log('Row 18:', data[18]);
console.log('Row 19:', data[19]);

// Check what parseAmount would return
function parseAmount(amountStr) {
  if (!amountStr) return 0;
  const cleaned = amountStr.toString().replace(/,/g, '');
  return parseFloat(cleaned) || 0;
}

console.log('\n=== PARSED AMOUNTS ===');
if (data[19]) {
  console.log('Opening Balance raw:', data[19][0], '=> parsed:', parseAmount(data[19][0]));
  console.log('Total Debit raw:', data[19][1], '=> parsed:', parseAmount(data[19][1]));
  console.log('Total Credit raw:', data[19][2], '=> parsed:', parseAmount(data[19][2]));
  console.log('Closing Balance raw:', data[19][3], '=> parsed:', parseAmount(data[19][3]));
}
