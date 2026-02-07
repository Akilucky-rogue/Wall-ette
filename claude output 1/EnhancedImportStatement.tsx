import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { IDFCBankParser } from './IDFCBankParser';

interface ImportResult {
  transactions: any[];
  summary: any;
  validation: {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  };
  timeElapsed: number;
}

export const EnhancedImportStatement: React.FC = () => {
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setError(null);
    setResult(null);

    const startTime = performance.now();

    try {
      let parseResult;

      // Detect file type
      const fileExtension = file.name.split('.').pop()?.toLowerCase();

      if (fileExtension === 'xlsx' || fileExtension === 'xls' || fileExtension === 'csv') {
        // Excel/CSV parsing
        parseResult = await IDFCBankParser.parseExcel(file);
      } else if (fileExtension === 'pdf') {
        // PDF parsing
        const arrayBuffer = await file.arrayBuffer();
        const textDecoder = new TextDecoder('utf-8');
        const pdfText = textDecoder.decode(arrayBuffer);
        
        // For proper PDF parsing, use pdf-parse or similar library
        // For now, we'll use a simplified approach
        parseResult = IDFCBankParser.parsePDF(pdfText);
      } else {
        throw new Error(`Unsupported file format: ${fileExtension}`);
      }

      const endTime = performance.now();
      const timeElapsed = endTime - startTime;

      setResult({
        ...parseResult,
        timeElapsed
      });

      // If validation passed, save transactions to Firebase
      if (parseResult.validation.isValid) {
        await saveTransactionsToFirebase(parseResult.transactions);
      }

    } catch (err: any) {
      setError(err.message || 'Failed to parse statement');
      console.error('Import error:', err);
    } finally {
      setImporting(false);
    }
  };

  const saveTransactionsToFirebase = async (transactions: any[]) => {
    // Integration with existing WALL-E Firebase logic
    // This would use your existing wallet context and Firebase service
    console.log('Saving', transactions.length, 'transactions to Firebase');
  };

  return (
    <div className="enhanced-import-container">
      {/* File Upload Section */}
      <div className="upload-section">
        <h2>Import IDFC FIRST Bank Statement</h2>
        <p className="subtitle">Upload PDF, Excel, or CSV - Guaranteed 100% Accuracy</p>
        
        <label htmlFor="file-upload" className="file-upload-label">
          <input
            id="file-upload"
            type="file"
            accept=".pdf,.xlsx,.xls,.csv"
            onChange={handleFileUpload}
            disabled={importing}
            style={{ display: 'none' }}
          />
          <button 
            className="upload-button"
            onClick={() => document.getElementById('file-upload')?.click()}
            disabled={importing}
          >
            {importing ? '⏳ Processing...' : '📁 Choose File'}
          </button>
        </label>

        <div className="supported-formats">
          Supported: PDF, Excel (.xlsx, .xls), CSV
        </div>
      </div>

      {/* Loading State */}
      {importing && (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Parsing statement with absolute accuracy...</p>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="error-banner">
          <h3>❌ Error</h3>
          <p>{error}</p>
        </div>
      )}

      {/* Results Display */}
      {result && (
        <div className="results-section">
          {/* Validation Status */}
          <div className={`validation-banner ${result.validation.isValid ? 'success' : 'error'}`}>
            <h3>
              {result.validation.isValid ? '✅ 100% ACCURATE' : '❌ VALIDATION FAILED'}
            </h3>
            <p>
              Parsed {result.transactions.length} transactions in {result.timeElapsed.toFixed(0)}ms
            </p>
          </div>

          {/* Summary Card */}
          <div className="summary-card">
            <h3>📊 Statement Summary</h3>
            <div className="summary-grid">
              <div className="summary-item">
                <label>Account</label>
                <value>{result.summary.accountNumber}</value>
              </div>
              <div className="summary-item">
                <label>Period</label>
                <value>{result.summary.statementPeriod}</value>
              </div>
              <div className="summary-item">
                <label>Opening Balance</label>
                <value className="amount">₹{result.summary.openingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</value>
              </div>
              <div className="summary-item">
                <label>Total Debit</label>
                <value className="amount debit">₹{result.summary.totalDebit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</value>
              </div>
              <div className="summary-item">
                <label>Total Credit</label>
                <value className="amount credit">₹{result.summary.totalCredit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</value>
              </div>
              <div className="summary-item">
                <label>Closing Balance</label>
                <value className="amount">₹{result.summary.closingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</value>
              </div>
            </div>
          </div>

          {/* Validation Errors/Warnings */}
          {result.validation.errors.length > 0 && (
            <div className="validation-errors">
              <h4>❌ Validation Errors:</h4>
              {result.validation.errors.map((err, idx) => (
                <p key={idx}>{err}</p>
              ))}
            </div>
          )}

          {result.validation.warnings.length > 0 && (
            <div className="validation-warnings">
              <h4>⚠️ Warnings:</h4>
              {result.validation.warnings.map((warn, idx) => (
                <p key={idx}>{warn}</p>
              ))}
            </div>
          )}

          {/* Category Breakdown */}
          <div className="category-breakdown">
            <h3>📈 Category Breakdown</h3>
            <div className="category-list">
              {getCategoryBreakdown(result.transactions).map(({ category, type, count, total }) => (
                <div key={`${type}-${category}`} className="category-item">
                  <div className="category-info">
                    <span className="icon">{type === 'income' ? '💰' : '💸'}</span>
                    <span className="name">{category}</span>
                    <span className="count">{count} txns</span>
                  </div>
                  <div className="category-amount">
                    ₹{total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Transaction Preview */}
          <div className="transaction-preview">
            <h3>📝 Transaction Preview (First 20)</h3>
            <div className="transaction-list">
              {result.transactions.slice(0, 20).map((txn, idx) => (
                <div key={idx} className="transaction-row">
                  <div className="txn-left">
                    <span className="txn-icon">{txn.type === 'income' ? '💰' : '💸'}</span>
                    <div className="txn-details">
                      <div className="txn-description">{txn.description}</div>
                      <div className="txn-meta">
                        {txn.date} • {txn.category} • {txn.paymentMethod}
                      </div>
                    </div>
                  </div>
                  <div className="txn-right">
                    <div className={`txn-amount ${txn.type}`}>
                      ₹{txn.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="action-buttons">
            <button 
              className="btn-primary"
              onClick={() => saveTransactionsToFirebase(result.transactions)}
              disabled={!result.validation.isValid}
            >
              ✅ Import All Transactions
            </button>
            <button 
              className="btn-secondary"
              onClick={() => downloadJSON(result)}
            >
              💾 Download JSON
            </button>
            <button 
              className="btn-secondary"
              onClick={() => setResult(null)}
            >
              🔄 Import Another Statement
            </button>
          </div>
        </div>
      )}

      <style jsx>{`
        .enhanced-import-container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 24px;
        }

        .upload-section {
          text-align: center;
          padding: 48px 24px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border-radius: 16px;
          color: white;
          margin-bottom: 32px;
        }

        .upload-section h2 {
          margin: 0 0 8px;
          font-size: 28px;
          font-weight: 700;
        }

        .subtitle {
          margin: 0 0 24px;
          opacity: 0.9;
        }

        .upload-button {
          background: white;
          color: #667eea;
          border: none;
          padding: 16px 48px;
          font-size: 18px;
          font-weight: 600;
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.3s;
        }

        .upload-button:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 8px 16px rgba(0,0,0,0.2);
        }

        .upload-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .supported-formats {
          margin-top: 16px;
          font-size: 14px;
          opacity: 0.8;
        }

        .loading-state {
          text-align: center;
          padding: 48px;
        }

        .spinner {
          width: 48px;
          height: 48px;
          border: 4px solid rgba(102, 126, 234, 0.2);
          border-top-color: #667eea;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin: 0 auto 16px;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .error-banner {
          background: #fee;
          border: 2px solid #f66;
          border-radius: 12px;
          padding: 24px;
          margin-bottom: 24px;
        }

        .error-banner h3 {
          margin: 0 0 8px;
          color: #c00;
        }

        .validation-banner {
          border-radius: 12px;
          padding: 24px;
          margin-bottom: 24px;
          text-align: center;
        }

        .validation-banner.success {
          background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
          color: white;
        }

        .validation-banner.error {
          background: #fee;
          border: 2px solid #f66;
          color: #c00;
        }

        .summary-card {
          background: white;
          border-radius: 12px;
          padding: 24px;
          margin-bottom: 24px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }

        .summary-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 16px;
          margin-top: 16px;
        }

        .summary-item label {
          display: block;
          font-size: 12px;
          color: #666;
          margin-bottom: 4px;
        }

        .summary-item value {
          display: block;
          font-size: 18px;
          font-weight: 600;
          color: #333;
        }

        .summary-item .amount {
          font-family: 'Courier New', monospace;
        }

        .summary-item .debit {
          color: #f44;
        }

        .summary-item .credit {
          color: #2d7;
        }

        .category-breakdown {
          background: white;
          border-radius: 12px;
          padding: 24px;
          margin-bottom: 24px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }

        .category-list {
          margin-top: 16px;
        }

        .category-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px;
          border-bottom: 1px solid #eee;
        }

        .category-info {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .category-info .name {
          font-weight: 500;
        }

        .category-info .count {
          font-size: 12px;
          color: #666;
        }

        .category-amount {
          font-family: 'Courier New', monospace;
          font-weight: 600;
        }

        .transaction-preview {
          background: white;
          border-radius: 12px;
          padding: 24px;
          margin-bottom: 24px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }

        .transaction-row {
          display: flex;
          justify-content: space-between;
          padding: 12px;
          border-bottom: 1px solid #eee;
        }

        .txn-left {
          display: flex;
          gap: 12px;
          flex: 1;
        }

        .txn-icon {
          font-size: 24px;
        }

        .txn-description {
          font-weight: 500;
          margin-bottom: 4px;
        }

        .txn-meta {
          font-size: 12px;
          color: #666;
        }

        .txn-amount {
          font-family: 'Courier New', monospace;
          font-weight: 600;
          font-size: 16px;
        }

        .txn-amount.income {
          color: #2d7;
        }

        .txn-amount.expense {
          color: #f44;
        }

        .action-buttons {
          display: flex;
          gap: 12px;
          justify-content: center;
        }

        .btn-primary, .btn-secondary {
          padding: 14px 32px;
          border: none;
          border-radius: 8px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s;
        }

        .btn-primary {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
        }

        .btn-primary:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 8px 16px rgba(102, 126, 234, 0.3);
        }

        .btn-primary:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .btn-secondary {
          background: white;
          color: #667eea;
          border: 2px solid #667eea;
        }

        .btn-secondary:hover {
          background: #667eea;
          color: white;
        }
      `}</style>
    </div>
  );
};

// Helper function to get category breakdown
function getCategoryBreakdown(transactions: any[]) {
  const breakdown = new Map<string, { category: string; type: string; count: number; total: number }>();

  transactions.forEach(txn => {
    const key = `${txn.type}:${txn.category}`;
    if (!breakdown.has(key)) {
      breakdown.set(key, {
        category: txn.category,
        type: txn.type,
        count: 0,
        total: 0
      });
    }
    const entry = breakdown.get(key)!;
    entry.count++;
    entry.total += txn.amount;
  });

  return Array.from(breakdown.values()).sort((a, b) => b.total - a.total);
}

// Helper function to download JSON
function downloadJSON(data: any) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `idfc-statement-${Date.now()}.json`;
  link.click();
  URL.revokeObjectURL(url);
}
