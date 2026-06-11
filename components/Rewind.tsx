import React, { useMemo, useRef, useState } from 'react';
import { AppScreen, Transaction, TransactionType } from '../types';
import { useWallet } from '../context/WalletContext';
import { exportImage } from '../utils/exportFile';
import { log } from '../utils/log';
import { WallEMascot, FloatingLeaf, RangoliCorner, LotusFlower, Diya } from './SplashScreen';

interface RewindProps {
  onNavigate: (screen: AppScreen) => void;
}

interface YearAgg {
  inc: number;
  out: number;
  count: number;
  spendDays: Set<string>;
  merchants: Map<string, number>; // expense by merchant
  cats: Map<string, number>;
  monthsOut: number[]; // 12 buckets
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const Rewind: React.FC<RewindProps> = ({ onNavigate }) => {
  const { transactions, formatAmount, formatAmountCompact } = useWallet();
  const [wrapYear, setWrapYear] = useState<number | null>(null);
  const [sharing, setSharing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const fmt = (n: number) => formatAmount(n).split('.')[0];

  // ── One pass: lifetime + per-year aggregates + records ──
  const life = useMemo(() => {
    if (transactions.length === 0) return null;

    const years = new Map<number, YearAgg>();
    let totalInc = 0, totalOut = 0;
    let first = transactions[0].date, last = transactions[0].date;
    let maxExp: Transaction | null = null, maxInc: Transaction | null = null;
    const spendDates: string[] = [];

    for (const t of transactions) {
      const d = new Date(t.date);
      const y = d.getFullYear();
      let ya = years.get(y);
      if (!ya) {
        ya = { inc: 0, out: 0, count: 0, spendDays: new Set(), merchants: new Map(), cats: new Map(), monthsOut: Array(12).fill(0) };
        years.set(y, ya);
      }
      ya.count++;
      if (t.date < first) first = t.date;
      if (t.date > last) last = t.date;
      if (t.type === TransactionType.INCOME) {
        totalInc += t.amount; ya.inc += t.amount;
        if (!maxInc || t.amount > maxInc.amount) maxInc = t;
      } else {
        totalOut += t.amount; ya.out += t.amount;
        ya.monthsOut[d.getMonth()] += t.amount;
        ya.spendDays.add(t.date.slice(0, 10));
        spendDates.push(t.date.slice(0, 10));
        const mer = t.merchant || t.category;
        ya.merchants.set(mer, (ya.merchants.get(mer) || 0) + t.amount);
        ya.cats.set(t.category, (ya.cats.get(t.category) || 0) + t.amount);
        if (!maxExp || t.amount > maxExp.amount) maxExp = t;
      }
    }

    // Longest no-spend streak across the whole history
    const uniq = [...new Set(spendDates)].sort();
    let streak = 0, streakFrom = '', streakTo = '';
    for (let i = 1; i < uniq.length; i++) {
      const gap = (Date.parse(uniq[i]) - Date.parse(uniq[i - 1])) / 86400000 - 1;
      if (gap > streak) { streak = gap; streakFrom = uniq[i - 1]; streakTo = uniq[i]; }
    }

    const yearRows = [...years.entries()].sort((a, b) => a[0] - b[0]);
    const maxYearFlow = Math.max(...yearRows.map(([, v]) => Math.max(v.inc, v.out)), 1);

    // "On this day" across previous years
    const now = new Date();
    const md = `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const onThisDay = transactions
      .filter(t => t.date.slice(5, 10) === md && new Date(t.date).getFullYear() < now.getFullYear())
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .slice(0, 4);

    const spanDays = Math.round((Date.parse(last) - Date.parse(first)) / 86400000) + 1;

    return {
      first, last, spanDays,
      yearsCount: yearRows.length,
      totalInc, totalOut,
      lifeRate: totalInc > 0 ? Math.round(((totalInc - totalOut) / totalInc) * 100) : 0,
      txCount: transactions.length,
      maxExp, maxInc,
      streak: streak > 0 ? { days: streak, from: streakFrom, to: streakTo } : null,
      yearRows, maxYearFlow,
      onThisDay,
    };
  }, [transactions]);

  const wrapYears = useMemo(() => (life ? life.yearRows.map(([y]) => y).reverse() : []), [life]);
  const activeWrapYear = wrapYear ?? (wrapYears[0] ?? null);

  const wrapped = useMemo(() => {
    if (!life || activeWrapYear === null) return null;
    const ya = life.yearRows.find(([y]) => y === activeWrapYear)?.[1];
    if (!ya) return null;
    const topMerchant = [...ya.merchants.entries()].sort((a, b) => b[1] - a[1])[0] ?? null;
    const topCat = [...ya.cats.entries()].sort((a, b) => b[1] - a[1])[0] ?? null;
    let busiestMonth = 0;
    for (let i = 1; i < 12; i++) if (ya.monthsOut[i] > ya.monthsOut[busiestMonth]) busiestMonth = i;
    const isCurrent = activeWrapYear === new Date().getFullYear();
    const daysInYear = isCurrent
      ? Math.ceil((Date.now() - Date.parse(`${activeWrapYear}-01-01`)) / 86400000)
      : 365;
    return {
      year: activeWrapYear,
      inc: ya.inc, out: ya.out, saved: ya.inc - ya.out,
      rate: ya.inc > 0 ? Math.round(((ya.inc - ya.out) / ya.inc) * 100) : 0,
      txCount: ya.count,
      topMerchant, topCat,
      busiestMonth: MONTHS[busiestMonth],
      noSpendDays: Math.max(0, daysInYear - ya.spendDays.size),
      isCurrent,
    };
  }, [life, activeWrapYear]);

  // ── Wrapped card renderer (canvas → PNG → share) ──
  const shareWrapped = async () => {
    if (!wrapped || sharing) return;
    setSharing(true);
    try {
      const canvas = canvasRef.current ?? document.createElement('canvas');
      const W = 540, H = 960;
      canvas.width = W; canvas.height = H;
      const ctx = canvas.getContext('2d')!;

      // background
      ctx.fillStyle = '#FAF9F6';
      ctx.fillRect(0, 0, W, H);

      // soft sage blobs
      ctx.fillStyle = 'rgba(155,174,147,0.10)';
      ctx.beginPath(); ctx.arc(W - 40, 120, 140, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(30, H - 160, 120, 0, Math.PI * 2); ctx.fill();

      // robot mark
      const cx = W / 2, cy = 150, R = 64;
      const grad = ctx.createLinearGradient(cx, cy - R, cx, cy + R);
      grad.addColorStop(0, '#9BAE93'); grad.addColorStop(1, '#8B9E82');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
      const eye = (ex: number) => {
        const ew = 30, eh = 38;
        ctx.fillStyle = 'rgba(51,51,51,0.92)';
        ctx.beginPath();
        (ctx as any).roundRect ? (ctx as any).roundRect(ex, cy - eh / 2, ew, eh, 9) : ctx.rect(ex, cy - eh / 2, ew, eh);
        ctx.fill();
        ctx.fillStyle = '#E3EAE0';
        ctx.beginPath(); ctx.arc(ex + ew / 2, cy + 4, 9, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#9BAE93';
        ctx.beginPath(); ctx.arc(ex + ew / 2, cy + 4, 4.5, 0, Math.PI * 2); ctx.fill();
      };
      eye(cx - 36); eye(cx + 6);

      const center = (text: string, y: number, font: string, color: string) => {
        ctx.font = font; ctx.fillStyle = color; ctx.textAlign = 'center';
        ctx.fillText(text, W / 2, y);
      };

      center('W A L L · E T T E   W R A P P E D', 262, '600 15px Verdana, sans-serif', '#8E8D8A');
      center(String(wrapped.year), 340, 'bold 76px Georgia, serif', '#333333');

      // stats
      const row = (label: string, value: string, y: number, color = '#333333', big = false) => {
        ctx.font = '600 13px Verdana, sans-serif'; ctx.fillStyle = '#8E8D8A'; ctx.textAlign = 'center';
        ctx.fillText(label.toUpperCase(), W / 2, y);
        ctx.font = `bold ${big ? 44 : 32}px Georgia, serif`; ctx.fillStyle = color;
        ctx.fillText(value, W / 2, y + (big ? 50 : 40));
      };

      row('came in', `+${fmt(wrapped.inc)}`, 420, '#7d937a');
      row('went out', `−${fmt(wrapped.out)}`, 510, '#c98989');
      row(wrapped.saved >= 0 ? `kept · ${wrapped.rate}% of income` : 'overspent',
          `${wrapped.saved >= 0 ? '+' : '−'}${fmt(Math.abs(wrapped.saved))}`, 600,
          wrapped.saved >= 0 ? '#7d937a' : '#c98989', true);

      // divider
      ctx.strokeStyle = 'rgba(0,0,0,0.08)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(80, 690); ctx.lineTo(W - 80, 690); ctx.stroke();

      const small = (label: string, value: string, y: number) => {
        ctx.font = '600 11px Verdana, sans-serif'; ctx.fillStyle = '#8E8D8A'; ctx.textAlign = 'center';
        ctx.fillText(label.toUpperCase(), W / 2, y);
        ctx.font = 'bold 19px Georgia, serif'; ctx.fillStyle = '#333333';
        const v = value.length > 34 ? value.slice(0, 33) + '…' : value;
        ctx.fillText(v, W / 2, y + 26);
      };

      let sy = 726;
      if (wrapped.topMerchant) { small('most paid to', `${wrapped.topMerchant[0]}`, sy); sy += 62; }
      if (wrapped.topCat) { small('top category', `${wrapped.topCat[0]} · ${fmt(wrapped.topCat[1])}`, sy); sy += 62; }
      small('busiest month · no-spend days', `${wrapped.busiestMonth} · ${wrapped.noSpendDays} days`, sy);

      center('tallied to the rupee · wall-e-7a113.web.app', H - 28, '600 12px Verdana, sans-serif', '#b9b7b2');

      const base64 = canvas.toDataURL('image/png').split(',')[1];
      const outcome = await exportImage(`wall-ette-wrapped-${wrapped.year}.png`, base64);
      setToast(outcome === 'shared' ? 'Share sheet opened' : 'Wrapped card downloaded');
    } catch (e) {
      log.warn('Wrapped share failed');
      setToast('Could not create the card — try again');
    } finally {
      setSharing(false);
      setTimeout(() => setToast(null), 3000);
    }
  };

  return (
    <div className="relative flex h-auto min-h-screen w-full flex-col max-w-[430px] lg:max-w-3xl mx-auto overflow-x-hidden pb-32 bg-zen-bg">
      <FloatingLeaf className="top-24 right-6 opacity-40" delay={0.4} />
      <FloatingLeaf className="top-56 left-4 opacity-30" delay={1.5} color="#A8B89E" />
      <RangoliCorner className="absolute top-20 left-2 opacity-20" color="#8B9E82" />
      <LotusFlower className="absolute top-40 right-4 opacity-35" size="sm" color="#D4B896" />
      <Diya className="absolute bottom-44 left-8 opacity-30" />

      {/* Header */}
      <div className="flex items-center bg-zen-bg/80 backdrop-blur-md p-6 pb-2 justify-between sticky top-0 z-30">
        <button
          onClick={() => onNavigate(AppScreen.DASHBOARD)}
          className="flex w-10 items-center justify-start text-muted-taupe hover:text-sage transition-colors"
        >
          <span className="material-symbols-outlined text-[24px]">arrow_back_ios</span>
        </button>
        <h2 className="text-premium-charcoal text-xl font-serif font-semibold tracking-tight flex-1 text-center">Rewind</h2>
        <div className="relative flex w-10 items-center justify-end text-muted-taupe"></div>
      </div>

      {!life ? (
        <div className="flex flex-col items-center py-16 px-6 text-center">
          <WallEMascot mood="thinking" size="md" />
          <p className="text-premium-charcoal font-serif text-lg font-semibold mt-4">No history yet</p>
          <p className="text-muted-taupe text-[13px] mt-2 max-w-xs">Import your bank statements and Wall-ette will rebuild your entire money timeline.</p>
        </div>
      ) : (
        <div className="px-6 pt-2 space-y-4 lg:columns-2 lg:gap-x-5">
          {/* Lifetime hero */}
          <div className="bg-white rounded-3xl p-6 shadow-soft border border-black/[0.02] break-inside-avoid">
            <p className="text-[10px] uppercase tracking-widest text-muted-taupe font-bold mb-1">Your money since {new Date(life.first).getFullYear()}</p>
            <p className="text-premium-charcoal font-serif text-[26px] font-bold leading-tight">
              {life.yearsCount} {life.yearsCount === 1 ? 'year' : 'years'} · {life.txCount.toLocaleString('en-IN')} entries
            </p>
            <div className="grid grid-cols-3 gap-3 mt-4">
              <div>
                <p className="text-[9px] text-muted-taupe uppercase tracking-wider">Earned</p>
                <p className="text-[14px] font-serif font-bold text-sage whitespace-nowrap">{formatAmountCompact(life.totalInc)}</p>
              </div>
              <div>
                <p className="text-[9px] text-muted-taupe uppercase tracking-wider">Spent</p>
                <p className="text-[14px] font-serif font-bold text-rose whitespace-nowrap">{formatAmountCompact(life.totalOut)}</p>
              </div>
              <div>
                <p className="text-[9px] text-muted-taupe uppercase tracking-wider">Kept</p>
                <p className="text-[14px] font-serif font-bold text-premium-charcoal whitespace-nowrap">{life.lifeRate}%</p>
              </div>
            </div>
          </div>

          {/* Year by year */}
          <div className="bg-white rounded-3xl p-5 shadow-soft border border-black/[0.02] break-inside-avoid">
            <p className="text-[10px] uppercase tracking-widest text-muted-taupe font-bold mb-4">Year by year</p>
            <div className="space-y-2.5">
              {life.yearRows.map(([y, v]) => (
                <div key={y} className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-muted-taupe w-9 shrink-0">{y}</span>
                  <div className="flex-1 space-y-1 min-w-0">
                    <div className="h-1.5 bg-zen-bg rounded-full overflow-hidden">
                      <div className="h-full bg-sage rounded-full" style={{ width: `${Math.max(2, (v.inc / life.maxYearFlow) * 100)}%` }} />
                    </div>
                    <div className="h-1.5 bg-zen-bg rounded-full overflow-hidden">
                      <div className="h-full bg-rose/70 rounded-full" style={{ width: `${Math.max(2, (v.out / life.maxYearFlow) * 100)}%` }} />
                    </div>
                  </div>
                  <span className={`text-[10px] font-semibold shrink-0 tabular-nums w-16 text-right ${v.inc - v.out >= 0 ? 'text-sage' : 'text-rose'}`}>
                    {v.inc - v.out >= 0 ? '+' : '−'}{formatAmountCompact(Math.abs(v.inc - v.out))}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Records */}
          <div className="bg-white rounded-3xl p-5 shadow-soft border border-black/[0.02] break-inside-avoid">
            <p className="text-[10px] uppercase tracking-widest text-muted-taupe font-bold mb-4">All-time records</p>
            <div className="space-y-3">
              {life.maxExp && (
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full bg-rose-light text-rose flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[14px]">local_fire_department</span>
                  </div>
                  <p className="text-[12px] text-premium-charcoal leading-relaxed pt-1 min-w-0">
                    Biggest spend ever: <b>{fmt(life.maxExp.amount)}</b> — {life.maxExp.merchant || life.maxExp.category}, {new Date(life.maxExp.date).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}
                  </p>
                </div>
              )}
              {life.maxInc && (
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full bg-sage-light text-sage flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[14px]">emoji_events</span>
                  </div>
                  <p className="text-[12px] text-premium-charcoal leading-relaxed pt-1 min-w-0">
                    Biggest credit ever: <b>{fmt(life.maxInc.amount)}</b> — {life.maxInc.merchant || life.maxInc.category}, {new Date(life.maxInc.date).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}
                  </p>
                </div>
              )}
              {life.streak && (
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full bg-sand-light text-sand flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[14px]">self_improvement</span>
                  </div>
                  <p className="text-[12px] text-premium-charcoal leading-relaxed pt-1 min-w-0">
                    Longest no-spend streak: <b>{life.streak.days} days</b> ({new Date(life.streak.from).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })})
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* On this day */}
          {life.onThisDay.length > 0 && (
            <div className="bg-white rounded-3xl p-5 shadow-soft border border-black/[0.02] break-inside-avoid">
              <p className="text-[10px] uppercase tracking-widest text-muted-taupe font-bold mb-4">On this day</p>
              <div className="space-y-2.5">
                {life.onThisDay.map(t => (
                  <div key={t.id} className="flex items-center gap-2 min-w-0">
                    <span className="text-[10px] font-bold text-muted-taupe w-9 shrink-0">{new Date(t.date).getFullYear()}</span>
                    <span className="text-[11px] text-premium-charcoal truncate flex-1" title={t.merchant || t.category}>{t.merchant || t.category}</span>
                    <span className={`text-[11px] font-semibold shrink-0 tabular-nums ${t.type === TransactionType.EXPENSE ? 'text-rose' : 'text-sage'}`}>
                      {t.type === TransactionType.EXPENSE ? '-' : '+'}{formatAmountCompact(t.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Wrapped */}
          {wrapped && (
            <div className="bg-premium-charcoal rounded-3xl p-6 shadow-soft break-inside-avoid">
              <div className="flex items-center justify-between mb-4">
                <p className="text-[10px] uppercase tracking-widest text-white/60 font-bold">Wall·ette Wrapped</p>
                <div className="flex gap-1.5">
                  {wrapYears.slice(0, 4).map(y => (
                    <button
                      key={y}
                      onClick={() => setWrapYear(y)}
                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition-all ${activeWrapYear === y ? 'bg-sage text-white' : 'bg-white/10 text-white/60'}`}
                    >
                      {y}
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-white font-serif text-3xl font-bold">{wrapped.year}{wrapped.isCurrent ? <span className="text-white/40 text-base font-sans font-medium"> so far</span> : ''}</p>
              <div className="grid grid-cols-3 gap-3 mt-4 mb-5">
                <div>
                  <p className="text-[9px] text-white/50 uppercase tracking-wider">In</p>
                  <p className="text-[14px] font-serif font-bold text-sage-light whitespace-nowrap">{formatAmountCompact(wrapped.inc)}</p>
                </div>
                <div>
                  <p className="text-[9px] text-white/50 uppercase tracking-wider">Out</p>
                  <p className="text-[14px] font-serif font-bold text-rose-light whitespace-nowrap">{formatAmountCompact(wrapped.out)}</p>
                </div>
                <div>
                  <p className="text-[9px] text-white/50 uppercase tracking-wider">Kept</p>
                  <p className="text-[14px] font-serif font-bold text-white whitespace-nowrap">{wrapped.rate}%</p>
                </div>
              </div>
              <button
                onClick={shareWrapped}
                disabled={sharing}
                className="w-full bg-sage text-white py-3.5 rounded-2xl font-serif text-[15px] font-semibold active:scale-[0.98] transition-transform flex items-center justify-center gap-2 disabled:opacity-60"
              >
                <span className="material-symbols-outlined text-[18px]">{sharing ? 'progress_activity' : 'ios_share'}</span>
                {sharing ? 'Creating card…' : 'Share your Wrapped'}
              </button>
            </div>
          )}

          <canvas ref={canvasRef} className="hidden" />
        </div>
      )}

      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-premium-charcoal text-white px-6 py-3 rounded-full shadow-xl z-50 flex items-center gap-2">
          <span className="material-symbols-outlined text-sage text-[20px]">check_circle</span>
          <span className="text-[13px] font-medium font-serif">{toast}</span>
        </div>
      )}
    </div>
  );
};

export default Rewind;
