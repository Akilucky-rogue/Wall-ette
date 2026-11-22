import React from 'react';

/**
 * The product page's hero: lines from an IDFC FIRST statement, each followed
 * by what Wall-ette makes of it. Payees and categories are what
 * services/spend.ts (payeeName) and services/categorize.ts return for these
 * narrations; the data is made up. The transfer to the user's own account is
 * shown as money moved, so it stays out of "Spent".
 */
interface Row {
  date: string;
  raw: string;
  amount: number;
  credit?: boolean;
  payee: string;
  category: string;
  /** Marked as one of the user's own accounts in Money Moved. */
  moved?: boolean;
}

const ROWS: Row[] = [
  { date: '01 Nov', raw: 'NEFT/CR/IN2263421789/ORBIT SOFTWARE PVT LTD/SALARY NOV 2026', amount: 85000, credit: true, payee: 'ORBIT SOFTWARE PVT LTD', category: 'Salary' },
  { date: '03 Nov', raw: 'UPI/DR/631245781122/KAPOOR HOMES/HDFC/kapoorhomes@hdfcbank/RENT', amount: 24000, payee: 'KAPOOR HOMES', category: 'Rent' },
  { date: '05 Nov', raw: 'IFT/10000123456/AARAV SHARMA/631245/Savings', amount: 20000, payee: 'AARAV SHARMA', category: 'Transfer Out', moved: true },
  { date: '08 Nov', raw: 'UPI/DR/631245789012/SWIGGY/YESB/swiggy.upi@yesb/Payment', amount: 486, payee: 'SWIGGY', category: 'Food Delivery' },
  { date: '12 Nov', raw: 'UPI/DR/631245780045/ZEPTO/ICIC/zeptonow@icici/UPI', amount: 1284, payee: 'ZEPTO', category: 'Groceries' },
];

const plain = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const rupees = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });

const spent = ROWS.filter(r => !r.credit && !r.moved).reduce((s, r) => s + r.amount, 0);
const moved = ROWS.filter(r => r.moved).reduce((s, r) => s + r.amount, 0);
const cameIn = ROWS.filter(r => r.credit).reduce((s, r) => s + r.amount, 0);

const StatementDemo: React.FC = () => (
  <figure className="wl-demo relative">
    <div className="relative rounded-[22px] border border-sage-border bg-zen-cream shadow-[0_30px_60px_-30px_rgba(60,70,55,0.35)] overflow-hidden">
      {/* Printout header */}
      <div className="flex items-baseline justify-between gap-4 px-5 sm:px-6 pt-5 pb-3 border-b border-dashed border-sage-border font-mono text-[11px] text-zen-charcoal/80">
        <span>Account statement</span>
        <span className="hidden sm:inline">01-11-2026 to 30-11-2026</span>
      </div>

      <ol className="wl-ruled divide-y divide-sage-border/60">
        {ROWS.map((r, i) => (
          <li key={r.raw} className="px-5 sm:px-6 py-3" style={{ ['--i' as string]: i }}>
            <div className="flex items-baseline gap-3 font-mono text-[11.5px] leading-5 text-zen-charcoal/80">
              <span className="shrink-0 tabular-nums">{r.date}</span>
              <span className="min-w-0 flex-1 truncate">{r.raw}</span>
              <span className="shrink-0 tabular-nums">{plain.format(r.amount)} {r.credit ? 'Cr' : 'Dr'}</span>
            </div>
            <div className="wl-read mt-2 flex items-center gap-3 border-l-2 border-sage pl-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-semibold text-premium-charcoal">{r.payee}</p>
                <p className="text-[12.5px] text-zen-charcoal/80">
                  {r.moved ? 'My accounts, not counted as spending' : r.category}
                </p>
              </div>
              <span className={`shrink-0 tabular-nums text-[14px] font-semibold ${
                r.credit ? 'text-[color:var(--sage-deep)]' : r.moved ? 'text-zen-charcoal/80' : 'text-premium-charcoal'
              }`}>
                {r.credit ? '+' : r.moved ? '' : '−'}{rupees.format(r.amount)}
              </span>
            </div>
          </li>
        ))}
      </ol>

      {/* What the month adds up to */}
      <dl className="wl-sum grid grid-cols-3 gap-2 bg-white px-5 sm:px-6 py-4 border-t border-sage-border">
        <div>
          <dt className="text-[12px] text-zen-charcoal/80">Spent</dt>
          <dd className="font-serif text-[22px] leading-tight text-premium-charcoal tabular-nums">{rupees.format(spent)}</dd>
        </div>
        <div>
          <dt className="text-[12px] text-zen-charcoal/80">Moved</dt>
          <dd className="font-serif text-[22px] leading-tight text-zen-charcoal/80 tabular-nums">{rupees.format(moved)}</dd>
        </div>
        <div>
          <dt className="text-[12px] text-zen-charcoal/80">Came in</dt>
          <dd className="font-serif text-[22px] leading-tight text-[color:var(--sage-deep)] tabular-nums">{rupees.format(cameIn)}</dd>
        </div>
      </dl>
    </div>
    <figcaption className="mt-3 text-[12.5px] text-zen-charcoal/80">
      Five lines from an IDFC FIRST statement, and how Wall·ette reads them. Sample data.
    </figcaption>
  </figure>
);

export default StatementDemo;
