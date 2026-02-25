import fs from 'fs';
import path from 'path';

// Utility to compare two numbers with tolerance
function nearlyEqual(a, b, tol = 0.01) {
  return Math.abs(a - b) < tol;
}

// Load dashboard summary
const dashboardSummaryPath = './dashboard_summary.json';
if (!fs.existsSync(dashboardSummaryPath)) {
  console.error('dashboard_summary.json not found. Export it from the app first.');
  process.exit(1);
}
const dashboard = JSON.parse(fs.readFileSync(dashboardSummaryPath, 'utf-8'));

// Find all statement files and analyze their summary
const dir = '.';
const files = fs.readdirSync(dir)
  .filter(f => /^IDFCFIRSTBankstatement_.*\.xlsx\.summary\.json$/.test(f));

if (files.length === 0) {
  console.error('No statement summary files found. Run analyze-excel-detailed.mjs and save the summary as .summary.json for each statement.');
  process.exit(1);
}

let allPass = true;

for (const file of files) {
  const statement = JSON.parse(fs.readFileSync(file, 'utf-8'));
  console.log(`\nComparing dashboard vs statement: ${file}`);

  const checks = [
    ['Opening Balance', dashboard.openingBalance, statement.openingBalance],
    ['Total Debit', dashboard.totalDebit, statement.totalDebit],
    ['Total Credit', dashboard.totalCredit, statement.totalCredit],
    ['Closing Balance', dashboard.closingBalance, statement.closingBalance],
    ['Transaction Count', dashboard.transactionCount, statement.transactionCount],
  ];

  let filePass = true;
  for (const [label, dashVal, stmtVal] of checks) {
    const pass = nearlyEqual(dashVal, stmtVal);
    if (!pass) filePass = false;
    console.log(`${label.padEnd(18)}: Dashboard = ${dashVal} | Statement = ${stmtVal} | ${pass ? '✅' : '❌'}`);
  }
  if (filePass) {
    console.log('Result: ✅ All fields match!');
  } else {
    console.log('Result: ❌ Mismatch detected!');
    allPass = false;
  }
}

if (allPass) {
  console.log('\nAll dashboard summaries match the statement summaries.');
} else {
  console.log('\nSome mismatches found. Please review the details above.');
}
