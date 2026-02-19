import React, { useState } from 'react';
import { AppScreen } from '../types';
import { useWallet } from '../context/WalletContext';
import { WallEEyes, FloatingLeaf, PottedPlant, RangoliCorner, LotusFlower, Diya } from './SplashScreen';

interface ExportReportsProps {
  onNavigate: (screen: AppScreen) => void;
}

const ExportReports: React.FC<ExportReportsProps> = ({ onNavigate }) => {
  const { transactions } = useWallet();
  const [format, setFormat] = useState<'PDF' | 'CSV' | 'JSON'>('CSV');

  const handleGenerateReport = () => {
      if (format === 'JSON') {
          const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(transactions, null, 2));
          const downloadAnchorNode = document.createElement('a');
          downloadAnchorNode.setAttribute("href", dataStr);
          downloadAnchorNode.setAttribute("download", "wallet_export.json");
          document.body.appendChild(downloadAnchorNode);
          downloadAnchorNode.click();
          downloadAnchorNode.remove();
      } else if (format === 'CSV') {
          const headers = ["ID", "Date", "Merchant", "Amount", "Type", "Category", "Note"];
          const rows = transactions.map(t => [
              t.id,
              new Date(t.date).toLocaleDateString('en-GB'),
              `"${t.merchant?.replace(/"/g, '""') || ''}"`,
              t.amount,
              t.type,
              `"${t.category.replace(/"/g, '""')}"`,
              `"${t.note?.replace(/"/g, '""') || ''}"`
          ]);
          
          const csvContent = "data:text/csv;charset=utf-8," 
              + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
          
          const encodedUri = encodeURI(csvContent);
          const link = document.createElement("a");
          link.setAttribute("href", encodedUri);
          link.setAttribute("download", "wallet_export.csv");
          document.body.appendChild(link);
          link.click();
          link.remove();
      } else {
          alert("PDF generation requires a backend service in this demo environment. Please try CSV or JSON.");
      }
  };

  return (
    <div className="relative flex min-h-screen w-full flex-col max-w-[430px] mx-auto overflow-x-hidden pb-32 bg-zen-cream">
      {/* Eco & Indian decorative elements */}
      <FloatingLeaf className="top-24 right-6 opacity-40" delay={0.4} />
      <FloatingLeaf className="top-52 left-4 opacity-30" delay={1.6} color="#A8B89E" />
      <PottedPlant className="absolute bottom-40 right-6 opacity-40" />
      <RangoliCorner className="absolute top-20 left-2 opacity-20" color="#8B9E82" />
      <LotusFlower className="absolute bottom-52 left-8 opacity-35" size="sm" />
      <Diya className="absolute top-48 right-4 opacity-40" />
      
      <header className="flex items-center bg-zen-cream/90 backdrop-blur-md p-6 pt-8 pb-4 justify-between sticky top-0 z-30">
        <button 
          onClick={() => onNavigate(AppScreen.DASHBOARD)}
          className="flex w-10 h-10 items-center justify-center text-zen-taupe hover:text-sage transition-colors"
        >
          <span className="material-symbols-outlined text-[28px]">chevron_left</span>
        </button>
        <h1 className="text-zen-charcoal text-2xl font-serif font-medium tracking-tight">Export & Reports</h1>
        <div className="w-10"></div>
      </header>

      <div className="px-8 pt-8 pb-10">
        <div className="flex items-start gap-4">
          {/* Mini WALL-E helper */}
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-sage to-sage/80 flex items-center justify-center shadow-md flex-shrink-0">
            <WallEEyes size="sm" />
          </div>
          <div className="flex-1">
            <h2 className="text-zen-charcoal font-serif text-2xl font-medium leading-tight mb-2">Mindful Archives</h2>
            <p className="text-zen-taupe text-[14px] leading-relaxed font-light">
              Preserve your financial journey with elegantly structured reports.
            </p>
          </div>
        </div>
      </div>

      <div className="px-8 space-y-10">
        <section>
          <h3 className="text-zen-taupe text-[11px] font-semibold uppercase tracking-[0.25em] mb-6 ml-1">Report Type</h3>
          <div className="grid grid-cols-1 gap-4">
            <label className="relative flex items-center justify-between p-5 bg-white rounded-3xl border-2 border-sage shadow-soft cursor-pointer transition-all">
              <div className="flex items-center gap-5">
                <div className="bg-sage-light text-sage w-12 h-12 rounded-2xl flex items-center justify-center">
                  <span className="material-symbols-outlined text-2xl">analytics</span>
                </div>
                <div>
                  <span className="font-serif text-lg font-medium text-zen-charcoal block">Full Insight Summary</span>
                  <span className="text-[11px] text-zen-taupe uppercase tracking-wider">Comprehensive View</span>
                </div>
              </div>
              <div className="w-6 h-6 rounded-full border-2 border-sage flex items-center justify-center">
                <div className="w-3 h-3 rounded-full bg-sage"></div>
              </div>
              <input defaultChecked className="hidden" name="report_type" type="radio" />
            </label>
          </div>
        </section>

        <section>
          <h3 className="text-zen-taupe text-[11px] font-semibold uppercase tracking-[0.25em] mb-6 ml-1">Export Format</h3>
          <div className="relative">
            <select 
                value={format}
                onChange={(e) => setFormat(e.target.value as any)}
                className="w-full bg-white border border-sage-border rounded-2xl px-6 py-5 text-zen-charcoal font-serif text-lg shadow-soft focus:ring-1 focus:ring-sage focus:border-sage appearance-none outline-none"
                title="Export format"
                aria-label="Export format"
              >
              <option value="CSV">CSV Spreadsheet</option>
              <option value="JSON">JSON Archive</option>
              <option value="PDF">PDF Document</option>
            </select>
            <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-sage">
              <span className="material-symbols-outlined">expand_more</span>
            </div>
          </div>
        </section>

        <div className="pt-6 pb-4">
          <button 
            onClick={handleGenerateReport}
            className="w-full bg-sage text-white py-6 rounded-4xl font-serif text-xl font-medium shadow-soft flex items-center justify-center gap-3 shadow-xl shadow-sage/10 group active:scale-95 transition-all"
          >
            <span className="material-symbols-outlined text-[24px] group-hover:rotate-12 transition-transform">auto_awesome</span>
            Generate Report
          </button>
          <p className="text-center text-zen-taupe text-[10px] mt-6 uppercase tracking-[0.2em] font-medium opacity-60">Preparing your data will take a moment</p>
        </div>
      </div>

      <div className="px-8 pt-12 pb-32">
        <div className="mt-8 text-center">
            <button 
                onClick={() => onNavigate(AppScreen.IMPORT)}
                className="text-sage text-xs font-semibold uppercase tracking-widest border-b border-sage/30 pb-1"
            >
                Switch to Import
            </button>
        </div>
      </div>
    </div>
  );
};

export default ExportReports;