import XLSX from 'xlsx';
import fs from 'fs';

const filePath = 'IDFCFIRSTBankstatement_10001193553_173158314.xlsx';

try {
  // Read the workbook
  const workbook = XLSX.readFile(filePath);
  
  console.log('\n=== EXCEL FILE ANALYSIS ===\n');
  
  // 1. Check sheets
  console.log('SHEET NAMES:', workbook.SheetNames);
  console.log(`Total sheets: ${workbook.SheetNames.length}\n`);
  
  // Process each sheet
  workbook.SheetNames.forEach(sheetName => {
    console.log(`\n--- SHEET: ${sheetName} ---`);
    
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    
    console.log(`Total rows (including headers): ${data.length}`);
    console.log(`\nFirst 15 rows of data:`);
    data.slice(0, 15).forEach((row, idx) => {
      console.log(`Row ${idx}: ${JSON.stringify(row)}`);
    });
    
    console.log(`\nLast 15 rows of data:`);
    data.slice(-15).forEach((row, idx) => {
      console.log(`Row ${data.length - 15 + idx}: ${JSON.stringify(row)}`);
    });
    
    // Try to find summary section
    console.log(`\nSearching for summary information...`);
    const fullData = XLSX.utils.sheet_to_json(worksheet);
    
    // Also get raw text to find summary
    const range = XLSX.utils.decode_range(worksheet['!ref']);
    console.log(`\nWorksheet dimensions: ${range.s.c}-${range.e.c} columns, ${range.s.r}-${range.e.r} rows`);
    
    // Print rows that might contain summary (Opening, Closing, etc)
    data.forEach((row, idx) => {
      const rowStr = JSON.stringify(row).toLowerCase();
      if (rowStr.includes('opening') || rowStr.includes('closing') || rowStr.includes('debit') || rowStr.includes('credit') || rowStr.includes('balance')) {
        console.log(`Summary row ${idx}: ${JSON.stringify(row)}`);
      }
    });
  });
  
} catch (error) {
  console.error('Error reading Excel file:', error.message);
  process.exit(1);
}
