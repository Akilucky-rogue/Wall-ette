import React, { useMemo, useState } from 'react';
import { AppScreen, TransactionType } from '../types';
import { useWallet } from '../context/WalletContext';
import { analyzeIncome, StreamBadge } from '../services/analyticsService';
import { WallEMascot, FloatingLeaf, LotusFlower, RangoliCorner, MandalaDots } from './SplashScreen';

interface IncomeInsightsProps {
  onNavigate: (screen: AppScreen) => void;
}

const BADGE_STYLES: Record<StreamBadge, { label: string; cls: string }> = {
  FIXED: { label: 'Fixed', cls: 'bg-sage-light text-sage' },
  RECURRING: { label: 'Recurring', cls: 'bg-blue-zen-light text-blue-zen' },
  OCCASIONAL: { label: 'Occasional', cls: 'bg-sand-light text-sand' },
  ONE_OFF: { label: 'One-off', cls: 'bg-gray-100 text-muted-taupe' },
};

const FLOW_COLORS = ['#9BAE93', '#9CB5C1', '#D6C6B2', '#B8B5D0', '#D4A5A5', '#C4A98E'];

const IncomeInsights: React.FC<IncomeInsightsProps> = ({ onNavigate }) => {
  const { transactions, formatAmount, formatAmountCompact } = useWallet();
  const [selectedMonthIdx, setSelectedMonthIdx] = useState<number | null>(null);

  // ── Income analysis (streams, stability, salary) ──
  const analysis = useMemo(() => analyzeIncome(transactions), [transactions]);
  const { streams, stability, salary } = analysis;

  // ── Money-flow data: latest month that has any income ──
  const flow = useMemo(() => {
    // Find the most recent month with income
    let latestKey = -1;
    for (const t of transactions) {
      if (t.type !== TransactionType.INCOME) continue;
      const d = new Date(t.date);
      const k = d.getFullYear() * 12 + d.getMonth();
      if (k > latestKey) latestKey = k;
    }
    if (latestKey === -1) return null;

    const sources = new Map<string, number>();
    const categories = new Map<string, number>();
    let incomeTotal = 0;
    let expenseTotal = 0;

    for (const t of transactions) {
      const d = new Date(t.date);
      if (d.getFullYear() * 12 + d.getMonth() !== latestKey) continue;
      if (t.type === TransactionType.INCOME) {
        const name = t.merchant || t.category;
        sources.set(name, (sources.get(name) || 0) + t.amount);
        incomeTotal += t.amount;
      } else {
        categories.set(t.category, (categories.get(t.category) || 0) + t.amount);
        expenseTotal += t.amount;
      }
    }

    // Keep only streams worth a visual slot (≥4% of the column) — everything
    // smaller pools into "Other" so tiny flows can't shred the diagram.
    const topShare = (m: Map<string, number>, total: number, maxN: number): [string, number][] => {
      const sorted = [...m.entries()].sort((a, b) => b[1] - a[1]);
      const top: [string, number][] = [];
      let rest = 0;
      for (const [name, v] of sorted) {
        if (top.length < maxN && total > 0 && v / total >= 0.04) top.push([name, v]);
        else rest += v;
      }
      if (top.length === 0 && sorted.length > 0) { top.push(sorted[0]); rest -= sorted[0][1]; }
      if (rest > 0.005) top.push(['Other', rest]);
      return top;
    };

    const left = topShare(sources, incomeTotal, 4);
    const right = topShare(categories, expenseTotal, 4);
    const savings = incomeTotal - expenseTotal;
    if (savings > 0) right.push(['Saved', savings]);

    const monthLabel = new Date(Math.floor(latestKey / 12), latestKey % 12, 1)
      .toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

    return { left, right, incomeTotal, expenseTotal, savings, monthLabel };
  }, [transactions]);

  // ── Flow diagram geometry (two stacked columns + ribbons) ──
  const flowSvg = useMemo(() => {
    if (!flow || flow.incomeTotal <= 0) return null;
    const W = 100, H = 100, COL = 6, GAP = 2;
    const leftTotal = flow.left.reduce((s, [, v]) => s + v, 0);
    const rightTotal = flow.right.reduce((s, [, v]) => s + v, 0);
    if (leftTotal <= 0 || rightTotal <= 0) return null;

    const stack = (items: [string, number][], total: number) => {
      const usable = H - GAP * (items.length - 1);
      let y = 0;
      return items.map(([name, v], i) => {
        const h = Math.max(3, (v / total) * usable);
        const node = { name, value: v, y, h, color: FLOW_COLORS[i % FLOW_COLORS.length] };
        y += h + GAP;
        return node;
      });
    };

    const leftNodes = stack(flow.left, leftTotal);
    const rightNodes = stack(flow.right, rightTotal);

    // Ribbons: distribute each right node's height across left nodes
    // proportionally to left node sizes (income is pooled).
    const ribbons: { d: string; color: string; opacity: number }[] = [];
    const leftCursor = leftNodes.map(n => n.y);
    for (const r of rightNodes) {
      let rCursor = r.y;
      for (let li = 0; li < leftNodes.length; li++) {
        const l = leftNodes[li];
        const slice = (l.value / leftTotal) * r.h;
        if (slice < 0.5) continue;
        const x1 = COL, x2 = W - COL;
        const y1a = leftCursor[li], y1b = leftCursor[li] + slice;
        const y2a = rCursor, y2b = rCursor + slice;
        const c = (x1 + x2) / 2;
        ribbons.push({
          d: `M ${x1} ${y1a} C ${c} ${y1a}, ${c} ${y2a}, ${x2} ${y2a} L ${x2} ${y2b} C ${c} ${y2b}, ${c} ${y1b}, ${x1} ${y1b} Z`,
          color: r.name === 'Saved' ? '#9BAE93' : l.color,
          opacity: r.name === 'Saved' ? 0.5 : 0.3,
        });
        leftCursor[li] += slice;
        rCursor += slice;
      }
    }

    return { leftNodes, rightNodes, ribbons, W, H, COL };
  }, [flow]);

  // ── 12-month income trend chart data ──
  const trend = stability?.monthlyTotals ?? null;
  const trendMax = trend ? Math.max(...trend.map(m => m.value), 1) : 1;

  const hasIncome = analysis.totalIncome12m > 0;

  return (
    <div className="relative flex h-auto min-h-screen w-full flex-col max-w-[430px] lg:max-w-3xl mx-auto overflow-x-hidden pb-32 bg-zen-bg">
      {/* Eco & Indian decorative elements */}
      <FloatingLeaf className="top-24 right-6 opacity-40" delay={0.4} />
      <FloatingLeaf className="top-56 left-4 opacity-30" delay={1.5} color="#A8B89E" />
      <RangoliCorner className="absolute top-20 left-2 opacity-20" color="#8B9E82" />
      <LotusFlower className="absolute top-40 right-4 opacity-35" size="sm" color="#D4B896" />
      <MandalaDots className="absolute bottom-44 left-6 opacity-20" />

      {/* Header */}
      <div className="flex items-center bg-zen-bg/80 backdrop-blur-md p-6 pb-2 justify-between sticky top-0 z-30">
        <button
          onClick={() => onNavigate(AppScreen.DASHBOARD)}
          className="flex w-10 items-center justify-start text-muted-taupe hover:text-sage transition-colors"
        >
          <span className="material-symbols-outlined text-[24px]">arrow_back_ios</span>
        </button>
        <h2 className="text-premium-charcoal text-xl font-serif font-semibold tracking-tight flex-1 text-center">Income Flow</h2>
        <div className="relative flex w-10 items-center justify-end text-muted-taupe"></div>
      </div>

      {!hasIncome ? (
        <div className="flex flex-col items-center py-16 px-6 text-center">
          <WallEMascot mood="thinking" size="md" />
          <p className="text-premium-charcoal font-serif text-lg font-semibold mt-4">No income recorded yet</p>
          <p className="text-muted-taupe text-[13px] mt-2 max-w-xs">
            Add income entries or import a bank statement, and Wall-ette will map your income streams, stability, and where the money flows.
          </p>
          <button
            onClick={() => onNavigate(AppScreen.IMPORT)}
            className="mt-6 px-5 py-2.5 bg-sage text-white rounded-full text-sm font-semibold shadow-soft active:scale-95 transition-transform"
          >
            Import Statement
          </button>
        </div>
      ) : (
        <div className="px-6 space-y-4 pt-2 lg:columns-2 lg:gap-x-5">

          {/* Stability + Salary row */}
          <div className="grid grid-cols-2 gap-4 break-inside-avoid">
            {stability && (
              <div className="bg-white rounded-3xl p-4 shadow-soft border border-black/[0.02] flex flex-col items-center">
                <p className="text-[10px] uppercase tracking-widest text-muted-taupe font-bold self-start mb-2">Stability</p>
                <svg viewBox="0 0 36 36" className="w-16 h-16 -rotate-90">
                  <circle cx="18" cy="18" r="14" fill="none" stroke="#E3EAE0" strokeWidth="4" />
                  <circle
                    cx="18" cy="18" r="14" fill="none"
                    stroke={stability.score >= 80 ? '#9BAE93' : stability.score >= 50 ? '#D4B896' : '#D4A5A5'}
                    strokeWidth="4"
                    strokeDasharray={`${(stability.score / 100) * 88} 88`}
                    strokeLinecap="round"
                  />
                </svg>
                <p className="text-premium-charcoal font-serif text-xl font-bold -mt-1">{stability.score}</p>
                <p className="text-[10px] text-muted-taupe">{stability.label} income</p>
              </div>
            )}
            {salary ? (
              <div className="bg-white rounded-3xl p-4 shadow-soft border border-black/[0.02]">
                <p className="text-[10px] uppercase tracking-widest text-muted-taupe font-bold mb-2">Next Pay</p>
                <p className="text-premium-charcoal font-serif text-2xl font-bold">
                  {salary.daysUntil === 0 ? 'Today' : `${salary.daysUntil}d`}
                </p>
                <p className="text-[10px] text-muted-taupe mt-1">
                  {salary.nextExpected.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} · usually day {salary.typicalDay}
                </p>
                <p className="text-[11px] text-sage font-semibold mt-2 truncate" title={salary.streamName}>
                  {salary.streamName}
                </p>
                <p className="text-[10px] text-muted-taupe">~{formatAmount(salary.typicalAmount).split('.')[0]}</p>
              </div>
            ) : (
              <div className="bg-white rounded-3xl p-4 shadow-soft border border-black/[0.02] flex flex-col justify-center">
                <p className="text-[10px] uppercase tracking-widest text-muted-taupe font-bold mb-2">Avg / Month</p>
                <p className="text-premium-charcoal font-serif text-xl font-bold">
                  {formatAmount(stability?.avgMonthly ?? 0).split('.')[0]}
                </p>
                <p className="text-[10px] text-muted-taupe mt-1">across active months</p>
              </div>
            )}
          </div>

          {/* 12-month income trend */}
          {trend && (
            <div className="bg-white rounded-3xl p-5 shadow-soft border border-black/[0.02] break-inside-avoid">
              <div className="flex justify-between items-center mb-3">
                <p className="text-[10px] uppercase tracking-widest text-muted-taupe font-bold">12-Month Income</p>
                {selectedMonthIdx !== null && (
                  <p className="text-[11px] font-semibold text-sage">
                    {trend[selectedMonthIdx].label}: {formatAmount(trend[selectedMonthIdx].value).split('.')[0]}
                  </p>
                )}
              </div>
              <div className="flex items-end justify-between gap-1 h-24">
                {trend.map((m, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedMonthIdx(selectedMonthIdx === i ? null : i)}
                    className="flex-1 flex flex-col items-center gap-1 group"
                    title={`${m.label}: ${formatAmount(m.value)}`}
                  >
                    <div className="w-full h-20 flex items-end">
                      <div
                        className={`w-full rounded-t transition-all ${selectedMonthIdx === i ? 'bg-sage' : 'bg-sage/40 group-hover:bg-sage/60'}`}
                        style={{ height: `${m.value > 0 ? Math.max(6, (m.value / trendMax) * 100) : 2}%` }}
                      />
                    </div>
                    {i % 3 === 0 || i === trend.length - 1 ? (
                      <span className="text-[8px] font-bold text-muted-taupe uppercase">{m.label}</span>
                    ) : (
                      <span className="text-[8px]">&nbsp;</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Money flow diagram */}
          {flow && flowSvg && (
            <div className="bg-white rounded-3xl p-5 shadow-soft border border-black/[0.02] break-inside-avoid">
              <p className="text-[10px] uppercase tracking-widest text-muted-taupe font-bold mb-1">Money Flow</p>
              <p className="text-[10px] text-muted-taupe mb-3">{flow.monthLabel} · in {formatAmount(flow.incomeTotal).split('.')[0]} → out {formatAmount(flow.expenseTotal).split('.')[0]}{flow.savings > 0 ? ` → saved ${formatAmount(flow.savings).split('.')[0]}` : ''}</p>

              <div className="flex gap-2">
                {/* Left labels — w-full keeps long names truncating inside
                    their 88px column instead of bleeding off-screen */}
                <div className="w-[88px] relative h-44 shrink-0">
                  {flowSvg.leftNodes.map((n, i) => (
                    n.h >= 9 && (
                    <div key={i} className="absolute left-0 w-full flex flex-col justify-center text-right pr-1 overflow-hidden"
                         style={{ top: `${n.y}%`, height: `${n.h}%` }}>
                      <span className="block text-[9px] font-semibold text-premium-charcoal truncate leading-tight" title={n.name}>{n.name}</span>
                      <span className="block text-[8px] text-muted-taupe truncate">{formatAmountCompact(n.value)}</span>
                    </div>
                  )))}
                </div>

                {/* Ribbons */}
                <svg viewBox={`0 0 ${flowSvg.W} ${flowSvg.H}`} preserveAspectRatio="none" className="flex-1 h-44">
                  {flowSvg.ribbons.map((r, i) => (
                    <path key={i} d={r.d} fill={r.color} fillOpacity={r.opacity} />
                  ))}
                  {flowSvg.leftNodes.map((n, i) => (
                    <rect key={`l${i}`} x={0} y={n.y} width={flowSvg.COL} height={n.h} rx={1.5} fill={n.color}>
                      <title>{n.name}</title>
                    </rect>
                  ))}
                  {flowSvg.rightNodes.map((n, i) => (
                    <rect key={`r${i}`} x={flowSvg.W - flowSvg.COL} y={n.y} width={flowSvg.COL} height={n.h} rx={1.5}
                          fill={n.name === 'Saved' ? '#9BAE93' : '#8E8D8A'} fillOpacity={n.name === 'Saved' ? 1 : 0.55}>
                      <title>{n.name}</title>
                    </rect>
                  ))}
                </svg>

                {/* Right labels */}
                <div className="w-[88px] relative h-44 shrink-0">
                  {flowSvg.rightNodes.map((n, i) => (
                    n.h >= 9 && (
                    <div key={i} className="absolute left-0 w-full flex flex-col justify-center pl-1 overflow-hidden"
                         style={{ top: `${n.y}%`, height: `${n.h}%` }}>
                      <span className={`block text-[9px] font-semibold truncate leading-tight ${n.name === 'Saved' ? 'text-sage' : 'text-premium-charcoal'}`} title={n.name}>{n.name}</span>
                      <span className="block text-[8px] text-muted-taupe truncate">{formatAmountCompact(n.value)}</span>
                    </div>
                  )))}
                </div>
              </div>

              {/* Legend — every flow gets a readable line, including the
                  small ones whose in-diagram labels are hidden */}
              <div className="mt-4 pt-3 border-t border-black/5 grid grid-cols-2 gap-x-4 gap-y-1.5">
                <div className="space-y-1.5">
                  <p className="text-[8px] uppercase tracking-widest text-muted-taupe font-bold">In</p>
                  {flowSvg.leftNodes.map((n, i) => (
                    <div key={i} className="flex items-center gap-1.5 min-w-0">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: n.color }} />
                      <span className="text-[10px] text-premium-charcoal truncate flex-1" title={n.name}>{n.name}</span>
                      <span className="text-[10px] text-muted-taupe shrink-0 tabular-nums">{formatAmountCompact(n.value)}</span>
                    </div>
                  ))}
                </div>
                <div className="space-y-1.5">
                  <p className="text-[8px] uppercase tracking-widest text-muted-taupe font-bold">Out</p>
                  {flowSvg.rightNodes.map((n, i) => (
                    <div key={i} className="flex items-center gap-1.5 min-w-0">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${n.name === 'Saved' ? 'bg-sage' : 'bg-[#8E8D8A]/60'}`} />
                      <span className={`text-[10px] truncate flex-1 ${n.name === 'Saved' ? 'text-sage font-semibold' : 'text-premium-charcoal'}`} title={n.name}>{n.name}</span>
                      <span className="text-[10px] text-muted-taupe shrink-0 tabular-nums">{formatAmountCompact(n.value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Income streams */}
          {streams.length > 0 && (
            <div className="bg-white rounded-3xl p-5 shadow-soft border border-black/[0.02] break-inside-avoid">
              <p className="text-[10px] uppercase tracking-widest text-muted-taupe font-bold mb-4">Income Streams · last 12 months</p>
              <div className="space-y-3">
                {streams.map((s, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-2xl bg-sage-light text-sage flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-[18px]">
                        {s.badge === 'FIXED' ? 'business_center' : s.badge === 'RECURRING' ? 'autorenew' : 'payments'}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-[13px] font-semibold text-premium-charcoal truncate">{s.name}</p>
                        <span className={`text-[8px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0 ${BADGE_STYLES[s.badge].cls}`}>
                          {BADGE_STYLES[s.badge].label}
                        </span>
                      </div>
                      <p className="text-[10px] text-muted-taupe">
                        {s.occurrences}× · typical {formatAmount(s.typicalAmount).split('.')[0]}
                        {s.badge === 'FIXED' ? ` · ~day ${s.typicalDay}` : ''}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[13px] font-bold text-sage">{formatAmount(s.total12m).split('.')[0]}</p>
                      <p className="text-[9px] text-muted-taupe">{s.sharePct}% of income</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default IncomeInsights;
