import React, { useLayoutEffect, useMemo, useState } from 'react';
import { AppScreen, Transaction, TransactionType } from '../types';
import { useWallet } from '../context/WalletContext';
import { getSymbol, toBase, toShown, inputDigits } from '../utils/currencyUtils';
import { parseDay } from '../utils/dates';
import { takeSection } from '../utils/screenSection';
import { usePlan } from '../services/plan';
import { opens } from '../services/planRules';
import PlanLock from './PlanLock';
import { analyzeIncome, byLabel, flowColumn, StreamBadge, prettyMerchant } from '../services/analyticsService';
import { Mascot } from './ui/Brand';
import BalanceTrend from './BalanceTrend';
import { tick } from '../utils/haptics';
import Garden from './ui/Garden';

// Categories Flow doesn't offer a budget for (services/review.ts TO_REVIEW).
const NOT_BUDGETED = new Set(['Transfer Out', 'Transfer In', 'To review', 'Adjustment', 'Investment']);

interface IncomeInsightsProps {
  onNavigate: (screen: AppScreen) => void;
}

const BADGE_STYLES: Record<StreamBadge, { label: string; cls: string }> = {
  FIXED: { label: 'Fixed', cls: 'bg-sage-light text-sage' },
  RECURRING: { label: 'Recurring', cls: 'bg-blue-zen-light text-blue-zen' },
  OCCASIONAL: { label: 'Occasional', cls: 'bg-sand-light text-sand' },
  ONE_OFF: { label: 'One-off', cls: 'bg-gray-100 text-muted-taupe' },
};

const FLOW_COLORS = ['var(--sage)', 'var(--ocean)', 'var(--sand)', 'var(--lavender)', 'var(--rose)', 'var(--gold-1)'];

interface MonthAgg {
  inc: number;
  out: number;
  count: number;
  sources: Map<string, number>;
  cats: Map<string, number>;
  maxExp: Transaction | null;
  spendDays: Set<string>;
}

const monthLabel = (key: string, style: 'long' | 'short' = 'long') => {
  const d = new Date(+key.slice(0, 4), +key.slice(5) - 1, 1);
  return style === 'long'
    ? d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
    : d.toLocaleDateString('en-GB', { month: 'short' });
};

const prevMonthKey = (key: string) => {
  const y = +key.slice(0, 4), m = +key.slice(5);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
};

const IncomeInsights: React.FC<IncomeInsightsProps> = ({ onNavigate }) => {
  const {
    transactions, counted, flowOf, savePayeeRule, formatAmount, formatWhole, formatAmountCompact,
    budgets, savingsGoal, setBudget, setSavingsGoal, shownRate, shownCurrency,
  } = useWallet();

  // The story is Plus's; budgets and the savings goal (Goals) are every plan's.
  const storyOpen = opens(usePlan().access, 'flow-story');
  const [tab, setTab] = useState<'STORY' | 'GOALS'>(storyOpen ? 'STORY' : 'GOALS');
  // A budget or savings notification opens Goals (utils/screenSection.ts).
  useLayoutEffect(() => { if (takeSection('goals')) setTab('GOALS'); }, []);
  const [selectedMonthIdx, setSelectedMonthIdx] = useState<number | null>(null);
  const [storyMonth, setStoryMonth] = useState<string | null>(null);
  const [goalInput, setGoalInput] = useState<string | null>(null);

  // ── Income analysis (streams, stability, salary) ──
  // Real income only: money back from your own accounts, family or
  // investments is left out (audit H3). A stream is your pay once you say so
  // (a "My pay" rule) or the bank calls it salary; until then it's a guess
  // to confirm (audit M8).
  const analysis = useMemo(() => analyzeIncome(counted, new Date(), t => {
    const rule = flowOf(t).rule;
    if (rule?.kind === 'salary' || t.category === 'Salary') return true;
    return rule ? false : null;
  }), [counted, flowOf]);
  const { streams, stability, salary } = analysis;

  // ── One pass: aggregates for every month (real income and spending) ──
  const monthAgg = useMemo(() => {
    const map = new Map<string, MonthAgg>();
    for (const t of counted) {
      const d = parseDay(t.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      let m = map.get(key);
      if (!m) {
        m = { inc: 0, out: 0, count: 0, sources: new Map(), cats: new Map(), maxExp: null, spendDays: new Set() };
        map.set(key, m);
      }
      m.count++;
      if (t.type === TransactionType.INCOME) {
        m.inc += t.amount;
        const name = t.merchant || t.category;
        m.sources.set(name, (m.sources.get(name) || 0) + t.amount);
      } else {
        m.out += t.amount;
        m.cats.set(t.category, (m.cats.get(t.category) || 0) + t.amount);
        m.spendDays.add(t.date.slice(0, 10));
        if (!m.maxExp || t.amount > m.maxExp.amount) m.maxExp = t;
      }
    }
    return map;
  }, [counted]);

  const monthKeys = useMemo(
    () => [...monthAgg.keys()].sort((a, b) => (a < b ? 1 : -1)).slice(0, 12),
    [monthAgg]
  );

  const storyKey = storyMonth && monthAgg.has(storyMonth) ? storyMonth : (monthKeys[0] ?? null);
  // The story's month as a date, for the balance chart (stable while it's picked).
  const storyEnd = useMemo(() => (storyKey ? new Date(+storyKey.slice(0, 4), +storyKey.slice(5) - 1, 1) : new Date()), [storyKey]);
  const now = new Date();
  const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  // ── The Money Story for the selected month ──
  const story = useMemo(() => {
    if (!storyKey) return null;
    const m = monthAgg.get(storyKey)!;
    const prev = monthAgg.get(prevMonthKey(storyKey)) ?? null;
    const saved = m.inc - m.out;

    // Payees as the screen names them: one payee's narrations differ.
    const topSource = [...byLabel(m.sources, prettyMerchant).entries()].sort((a, b) => b[1] - a[1])[0] ?? null;
    const topCat = [...m.cats.entries()].sort((a, b) => b[1] - a[1])[0] ?? null;

    const isCurrent = storyKey === currentKey;
    const daysInMonth = isCurrent
      ? now.getDate()
      : new Date(+storyKey.slice(0, 4), +storyKey.slice(5), 0).getDate();
    const noSpendDays = Math.max(0, daysInMonth - m.spendDays.size);

    const lines: { icon: string; text: React.ReactNode; tone: 'pos' | 'neg' | 'mid' }[] = [];

    if (m.inc > 0) {
      lines.push({
        icon: 'south_west', tone: 'pos',
        text: <><b>{formatWhole(m.inc)}</b> came in{topSource ? <> — mostly from <b>{topSource[0]}</b> ({formatAmountCompact(topSource[1])})</> : null}.</>,
      });
    }
    if (m.out > 0) {
      lines.push({
        icon: 'north_east', tone: 'neg',
        text: <><b>{formatWhole(m.out)}</b> went out{topCat ? <>, led by <b>{topCat[0]}</b> ({formatAmountCompact(topCat[1])})</> : null}.</>,
      });
    }
    lines.push(saved >= 0
      ? {
          icon: 'savings', tone: 'pos',
          text: <>You kept <b>{formatWhole(saved)}</b>{m.inc > 0 ? <> — <b>{Math.round((saved / m.inc) * 100)}%</b> of income</> : null}.</>,
        }
      : {
          icon: 'warning', tone: 'neg',
          text: <>You spent <b>{formatWhole(Math.abs(saved))}</b> more than you earned{isCurrent ? ' so far this month' : ''}.</>,
        });
    if (m.maxExp) {
      lines.push({
        icon: 'local_fire_department', tone: 'mid',
        text: <>Largest single spend: <b>{prettyMerchant(m.maxExp.merchant || m.maxExp.category)}</b> — {formatWhole(m.maxExp.amount)} on {parseDay(m.maxExp.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}.</>,
      });
    }
    if (prev && prev.out > 0 && m.out > 0) {
      const delta = Math.round(((m.out - prev.out) / prev.out) * 100);
      if (Math.abs(delta) >= 3) {
        lines.push({
          icon: delta > 0 ? 'trending_up' : 'trending_down', tone: delta > 0 ? 'neg' : 'pos',
          text: <>Spending {delta > 0 ? 'up' : 'down'} <b>{Math.abs(delta)}%</b> vs {monthLabel(prevMonthKey(storyKey), 'short')}.</>,
        });
      }
    }
    if (noSpendDays > 0 && m.out > 0) {
      lines.push({
        icon: 'self_improvement', tone: 'pos',
        text: <><b>{noSpendDays}</b> no-spend {noSpendDays === 1 ? 'day' : 'days'}{isCurrent ? ' so far' : ''}.</>,
      });
    }

    return { m, saved, lines, isCurrent };
  }, [storyKey, monthAgg, currentKey, formatAmount, formatAmountCompact]);

  // ── Flow diagram for the selected story month ──
  const flowSvg = useMemo(() => {
    if (!storyKey) return null;
    const m = monthAgg.get(storyKey);
    if (!m || m.inc <= 0) return null;

    // Each name once: payees as the screen names them, and Other only as
    // the pool of smaller streams (services/analyticsService.ts).
    const left = flowColumn(byLabel(m.sources, prettyMerchant), m.inc, 4);
    const right = flowColumn(m.cats, m.out, 4);
    const savings = m.inc - m.out;
    if (savings > 0) right.push(['Saved', savings]);

    const W = 100, H = 100, COL = 6, GAP = 2;
    const leftTotal = left.reduce((s, [, v]) => s + v, 0);
    const rightTotal = right.reduce((s, [, v]) => s + v, 0);
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

    const leftNodes = stack(left, leftTotal);
    const rightNodes = stack(right, rightTotal);

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
          color: r.name === 'Saved' ? 'var(--sage)' : l.color,
          opacity: r.name === 'Saved' ? 0.5 : 0.3,
        });
        leftCursor[li] += slice;
        rCursor += slice;
      }
    }

    return { leftNodes, rightNodes, ribbons, W, H, COL };
  }, [storyKey, monthAgg]);

  // ── Goals: current calendar month vs budgets ──
  const goalData = useMemo(() => {
    const m = monthAgg.get(currentKey) ?? null;
    const saved = m ? m.inc - m.out : 0;
    const spent = (cat: string) => m?.cats.get(cat) ?? 0;
    const catNames = new Set<string>(Object.keys(budgets));
    // Transfers and payments still to review aren't spending to cap: they
    // show only if a budget was set for them before.
    if (m) [...m.cats.entries()].filter(([c]) => !NOT_BUDGETED.has(c)).sort((a, b) => b[1] - a[1]).slice(0, 8).forEach(([c]) => catNames.add(c));
    const rows = [...catNames]
      .map(c => ({ cat: c, spent: spent(c), budget: budgets[c] ?? 0 }))
      .sort((a, b) => b.spent - a.spent);
    return { saved, rows, hasData: !!m };
  }, [monthAgg, currentKey, budgets]);

  // ── 12-month income trend chart data ──
  const trend = stability?.monthlyTotals ?? null;
  const trendMax = trend ? Math.max(...trend.map(m => m.value), 1) : 1;

  const hasData = transactions.length > 0;

  return (
    <div className="relative flex h-auto min-h-screen w-full flex-col max-w-[430px] md:max-w-3xl lg:max-w-5xl mx-auto overflow-x-hidden pb-32 lg:pb-12 bg-zen-bg">
      <Garden />
      {/* Header */}
      <div className="flex items-center gap-2 bg-zen-bg/85 backdrop-blur-md px-5 pt-6 pb-3 sticky top-0 z-30">
        <button
          onClick={() => onNavigate(AppScreen.DASHBOARD)}
          className="w-10 h-10 -ml-2 flex items-center justify-center rounded-full text-premium-charcoal hover:bg-white/70 transition-colors"
          aria-label="Back to Home"
        >
          <span className="material-symbols-outlined text-[24px]" aria-hidden="true">arrow_back</span>
        </button>
        <h2 className="text-premium-charcoal text-[22px] font-display font-bold tracking-tight leading-tight">Flow</h2>
      </div>

      {!hasData ? (
        <div className="flex flex-col items-center py-16 px-6 text-center">
          <Mascot pose="think" height={112} />
          <p className="text-premium-charcoal font-display text-lg font-bold mt-4">Nothing to tell yet</p>
          <p className="text-muted-taupe text-[13px] mt-2 max-w-xs">
            Add entries or import a bank statement, and Wall-ette will write your money story and track your goals.
          </p>
          <button
            onClick={() => onNavigate(AppScreen.IMPORT)}
            className="mt-6 px-5 py-2.5 bg-sage text-white rounded-full text-sm font-semibold shadow-soft active:scale-95 transition-transform"
          >
            Import Statement
          </button>
        </div>
      ) : (
        <div className="px-6 pt-2">
          {/* Story / Goals switch */}
          <div className="bg-premium-charcoal/[0.06] shadow-pressed rounded-2xl p-1 flex mb-4" role="group" aria-label="Show">
            {(['STORY', 'GOALS'] as const).map(t => (
              <button
                key={t}
                onClick={() => { if (t !== tab) tick(); setTab(t); }}
                aria-pressed={tab === t}
                className={`flex-1 py-2.5 rounded-xl text-[12px] font-semibold transition-all flex items-center justify-center gap-1.5 ${
                  tab === t ? 'bg-white shadow-soft text-premium-charcoal' : 'text-muted-taupe hover:text-premium-charcoal'
                }`}
              >
                <span className={`material-symbols-outlined icon-fill text-[16px] ${tab === t ? 'text-sage' : ''}`} aria-hidden="true">
                  {t === 'STORY' ? 'auto_stories' : 'flag'}
                </span>
                {t === 'STORY' ? 'Story' : 'Goals'}
              </button>
            ))}
          </div>

          {tab === 'STORY' && !storyOpen && <PlanLock reason="flow-story" />}

          {tab === 'STORY' && storyOpen && (
            <div className="space-y-4 lg:columns-2 lg:gap-x-5">
              {/* Month selector */}
              <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 break-inside-avoid">
                {monthKeys.map(k => (
                  <button
                    key={k}
                    onClick={() => setStoryMonth(k)}
                    className={`px-4 py-2 rounded-full text-[11px] font-semibold whitespace-nowrap transition-all ${storyKey === k ? 'bg-premium-charcoal text-white shadow-sm' : 'bg-white border border-premium-charcoal/[0.08] text-muted-taupe hover:text-premium-charcoal'}`}
                  >
                    {monthLabel(k, 'short')} {k.slice(2, 4)}
                  </button>
                ))}
              </div>

              {/* The story */}
              {story && storyKey && (
                <div className="bg-white rounded-3xl p-5 shadow-soft border border-black/[0.02] break-inside-avoid mt-4 lg:mt-0">
                  <div className="flex items-baseline justify-between mb-1">
                    <p className="text-[10px] uppercase tracking-widest text-muted-taupe font-bold">The {monthLabel(storyKey)} story</p>
                    {story.isCurrent && <span className="text-[9px] text-sage font-bold uppercase tracking-wider">In progress</span>}
                  </div>
                  <p className={`text-2xl font-semibold mb-4 tabular-nums ${story.saved >= 0 ? 'text-sage' : 'text-rose'}`}>
                    {story.saved >= 0 ? '+' : '−'}{formatWhole(Math.abs(story.saved))}
                    <span className="text-[12px] font-sans font-medium text-muted-taupe ml-2">{story.saved >= 0 ? 'kept' : 'overspent'}</span>
                  </p>
                  <div className="space-y-3">
                    {story.lines.map((l, i) => (
                      <div key={i} className="flex items-start gap-3">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${l.tone === 'pos' ? 'bg-sage-light text-sage' : l.tone === 'neg' ? 'bg-rose-light text-rose' : 'bg-sand-light text-sand'}`}>
                          <span className="material-symbols-outlined text-[15px]">{l.icon}</span>
                        </div>
                        <p className="text-[13px] text-premium-charcoal leading-relaxed pt-1 min-w-0 break-words">{l.text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Money flow diagram for the story month */}
              {story && flowSvg && storyKey && (
                <div className="bg-white rounded-3xl p-5 shadow-soft border border-black/[0.02] break-inside-avoid">
                  <p className="text-[10px] uppercase tracking-widest text-muted-taupe font-bold mb-1">Money Flow</p>
                  <p className="text-[10px] text-muted-taupe mb-3">
                    {monthLabel(storyKey)} · in {formatAmountCompact(story.m.inc)} → out {formatAmountCompact(story.m.out)}{story.saved > 0 ? ` → saved ${formatAmountCompact(story.saved)}` : ''}
                  </p>

                  <div className="flex gap-2">
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
                              fill={n.name === 'Saved' ? 'var(--sage)' : 'var(--mut)'} fillOpacity={n.name === 'Saved' ? 1 : 0.55}>
                          <title>{n.name}</title>
                        </rect>
                      ))}
                    </svg>

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

                  <div className="mt-4 pt-3 border-t border-premium-charcoal/[0.08] grid grid-cols-2 gap-x-4 gap-y-1.5">
                    <div className="space-y-1.5">
                      <p className="text-[9px] uppercase tracking-widest text-muted-taupe font-bold">In</p>
                      {flowSvg.leftNodes.map((n, i) => (
                        <div key={i} className="flex items-center gap-1.5 min-w-0">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: n.color }} />
                          <span className="text-[10px] text-premium-charcoal truncate flex-1" title={n.name}>{n.name}</span>
                          <span className="text-[10px] text-muted-taupe shrink-0 tabular-nums">{formatAmountCompact(n.value)}</span>
                        </div>
                      ))}
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-[9px] uppercase tracking-widest text-muted-taupe font-bold">Out</p>
                      {flowSvg.rightNodes.map((n, i) => (
                        <div key={i} className="flex items-center gap-1.5 min-w-0">
                          <span className={`w-2 h-2 rounded-full shrink-0 ${n.name === 'Saved' ? 'bg-sage' : 'bg-[var(--mut)]/60'}`} />
                          <span className={`text-[10px] truncate flex-1 ${n.name === 'Saved' ? 'text-sage font-semibold' : 'text-premium-charcoal'}`} title={n.name}>{n.name}</span>
                          <span className="text-[10px] text-muted-taupe shrink-0 tabular-nums">{formatAmountCompact(n.value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Stability + Salary row */}
              <div className="grid grid-cols-2 gap-4 break-inside-avoid">
                {stability && (
                  <div className="bg-white rounded-3xl p-4 shadow-soft border border-black/[0.02] flex flex-col items-center">
                    <p className="text-[10px] uppercase tracking-widest text-muted-taupe font-bold self-start mb-2">Stability</p>
                    <svg viewBox="0 0 36 36" className="w-16 h-16 -rotate-90">
                      <circle cx="18" cy="18" r="14" fill="none" stroke="var(--sage-soft)" strokeWidth="4" />
                      <circle
                        cx="18" cy="18" r="14" fill="none"
                        stroke={stability.score >= 80 ? 'var(--sage)' : stability.score >= 50 ? 'var(--gold-2)' : 'var(--rose)'}
                        strokeWidth="4"
                        strokeDasharray={`${(stability.score / 100) * 88} 88`}
                        strokeLinecap="round"
                      />
                    </svg>
                    <p className="text-premium-charcoal text-xl font-semibold -mt-1 tabular-nums">{stability.score}</p>
                    <p className="text-[10px] text-muted-taupe">{stability.label} income</p>
                  </div>
                )}
                {salary && !salary.confirmed && salary.payee ? (
                  <div className="bg-white rounded-3xl p-4 shadow-soft border border-black/[0.02] flex flex-col">
                    <p className="text-[10px] uppercase tracking-widest text-muted-taupe font-bold mb-2">Your pay?</p>
                    <p className="text-[11px] text-premium-charcoal font-semibold truncate" title={salary.streamName}>
                      {prettyMerchant(salary.streamName)}
                    </p>
                    <p className="text-[10px] text-muted-taupe">~{formatWhole(salary.typicalAmount)} · usually day {salary.typicalDay}</p>
                    <div className="grid grid-cols-2 gap-2 mt-auto pt-3">
                      <button
                        onClick={() => savePayeeRule(salary.payee!, 'salary')}
                        className="bg-sage-light text-sage py-1.5 rounded-xl text-[11px] font-bold active:scale-95 transition-transform"
                      >
                        Yes
                      </button>
                      <button
                        onClick={() => savePayeeRule(salary.payee!, 'counts')}
                        className="bg-gray-50 text-premium-charcoal border border-premium-charcoal/[0.08] py-1.5 rounded-xl text-[11px] font-bold active:scale-95 transition-transform"
                      >
                        No
                      </button>
                    </div>
                  </div>
                ) : salary?.confirmed ? (
                  <div className="bg-white rounded-3xl p-4 shadow-soft border border-black/[0.02]">
                    <p className="text-[10px] uppercase tracking-widest text-muted-taupe font-bold mb-2">Next Pay</p>
                    <p className="text-premium-charcoal text-2xl font-semibold tabular-nums">
                      {salary.daysUntil === 0 ? 'Today' : `${salary.daysUntil}d`}
                    </p>
                    <p className="text-[10px] text-muted-taupe mt-1">
                      {salary.nextExpected.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} · usually day {salary.typicalDay}
                    </p>
                    <p className="text-[11px] text-sage font-semibold mt-2 truncate" title={salary.streamName}>
                      {prettyMerchant(salary.streamName)}
                    </p>
                    <p className="text-[10px] text-muted-taupe">~{formatWhole(salary.typicalAmount)}</p>
                  </div>
                ) : (
                  <div className="bg-white rounded-3xl p-4 shadow-soft border border-black/[0.02] flex flex-col justify-center">
                    <p className="text-[10px] uppercase tracking-widest text-muted-taupe font-bold mb-2">Avg / Month</p>
                    <p className="text-premium-charcoal text-xl font-semibold tabular-nums">
                      {formatWhole(stability?.avgMonthly ?? 0)}
                    </p>
                    <p className="text-[10px] text-muted-taupe mt-1">across active months</p>
                  </div>
                )}
              </div>

              {/* The balance over the 12 months up to the story's month */}
              {storyKey && (
                <BalanceTrend endMonth={storyEnd} className="break-inside-avoid" />
              )}

              {/* 12-month income trend */}
              {trend && (
                <div className="bg-white rounded-3xl p-5 shadow-soft border border-black/[0.02] break-inside-avoid">
                  <div className="flex justify-between items-center mb-3">
                    <p className="text-[10px] uppercase tracking-widest text-muted-taupe font-bold">12-Month Income</p>
                    {selectedMonthIdx !== null && (
                      <p className="text-[11px] font-semibold text-sage">
                        {trend[selectedMonthIdx].label}: {formatWhole(trend[selectedMonthIdx].value)}
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
                          <span className="text-[9px] font-bold text-muted-taupe uppercase">{m.label}</span>
                        ) : (
                          <span className="text-[8px]">&nbsp;</span>
                        )}
                      </button>
                    ))}
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
                            <p className="text-[13px] font-semibold text-premium-charcoal truncate" title={s.name}>{prettyMerchant(s.name)}</p>
                            <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0 ${BADGE_STYLES[s.badge].cls}`}>
                              {BADGE_STYLES[s.badge].label}
                            </span>
                          </div>
                          <p className="text-[10px] text-muted-taupe">
                            {s.occurrences}× · typical {formatWhole(s.typicalAmount)}
                            {s.badge === 'FIXED' ? ` · ~day ${s.typicalDay}` : ''}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-[13px] font-bold text-sage">{formatWhole(s.total12m)}</p>
                          <p className="text-[9px] text-muted-taupe">{s.sharePct}% of income</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === 'GOALS' && (
            <div className="space-y-4 lg:columns-2 lg:gap-x-5">
              {/* Savings goal */}
              <div className="bg-white rounded-3xl p-5 shadow-soft border border-black/[0.02] break-inside-avoid">
                <p className="text-[10px] uppercase tracking-widest text-muted-taupe font-bold mb-3">Savings goal · {monthLabel(currentKey, 'long')}</p>
                <div className="flex items-center gap-5">
                  <div className="relative w-20 h-20 shrink-0">
                    <svg viewBox="0 0 36 36" className="w-20 h-20 -rotate-90">
                      <circle cx="18" cy="18" r="14" fill="none" stroke="var(--sage-soft)" strokeWidth="4" />
                      {savingsGoal > 0 && (
                        <circle
                          cx="18" cy="18" r="14" fill="none"
                          stroke={goalData.saved >= savingsGoal ? 'var(--sage)' : goalData.saved > 0 ? 'var(--gold-2)' : 'var(--rose)'}
                          strokeWidth="4"
                          strokeDasharray={`${Math.min(1, Math.max(0, goalData.saved / savingsGoal)) * 88} 88`}
                          strokeLinecap="round"
                        />
                      )}
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-[13px] font-semibold text-premium-charcoal tabular-nums">
                        {savingsGoal > 0 ? `${Math.max(0, Math.round((goalData.saved / savingsGoal) * 100))}%` : '—'}
                      </span>
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-[15px] font-semibold tabular-nums ${goalData.saved >= 0 ? 'text-sage' : 'text-rose'}`}>
                      {goalData.saved >= 0 ? '+' : '−'}{formatAmountCompact(Math.abs(goalData.saved))} saved
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-[10px] text-muted-taupe uppercase tracking-wider shrink-0">Target</span>
                      <input
                        type="number"
                        inputMode="numeric"
                        placeholder={`Set ${getSymbol(shownCurrency)}`}
                        value={goalInput ?? (savingsGoal > 0 ? String(toShown(savingsGoal, shownRate, inputDigits(shownCurrency, shownRate))) : '')}
                        onChange={e => setGoalInput(e.target.value)}
                        onBlur={() => {
                          if (goalInput !== null) {
                            // Typed in the currency shown; saved in rupees.
                            if (goalInput !== String(toShown(savingsGoal, shownRate, inputDigits(shownCurrency, shownRate)))) setSavingsGoal(toBase(Math.max(0, parseFloat(goalInput) || 0), shownRate));
                            setGoalInput(null);
                          }
                        }}
                        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                        className="w-28 bg-zen-bg rounded-xl px-3 py-2 text-[13px] text-premium-charcoal outline-none focus:ring-1 focus:ring-sage border border-transparent focus:border-sage/30"
                      />
                    </div>
                    {savingsGoal > 0 && goalData.saved < savingsGoal && (
                      <p className="text-[10px] text-muted-taupe mt-2">
                        {formatAmountCompact(Math.max(0, savingsGoal - goalData.saved))} to go this month
                      </p>
                    )}
                    {savingsGoal > 0 && goalData.saved >= savingsGoal && (
                      <p className="text-[10px] text-sage font-semibold mt-2">Goal reached — well done!</p>
                    )}
                  </div>
                </div>
                <p className="text-[9px] text-muted-taupe mt-3 pt-3 border-t border-premium-charcoal/[0.08] leading-relaxed">
                  Tracked live: this month's income minus spending, recalculated with every entry,
                  import, and sync. Resets on the 1st of each month.
                </p>
              </div>

              {/* Category budgets */}
              <div className="bg-white rounded-3xl p-5 shadow-soft border border-black/[0.02] break-inside-avoid">
                <p className="text-[10px] uppercase tracking-widest text-muted-taupe font-bold mb-1">Category budgets</p>
                <p className="text-[10px] text-muted-taupe mb-4">
                  Spending this month vs your monthly cap. Bars fill automatically as you spend —
                  sand at 80%, red when over. Caps reset every month.
                </p>
                {goalData.rows.length === 0 ? (
                  <p className="text-[12px] text-muted-taupe italic">No spending this month yet.</p>
                ) : (
                  <div className="space-y-4">
                    {goalData.rows.map(r => (
                      <BudgetRow
                        key={r.cat}
                        cat={r.cat}
                        spent={r.spent}
                        budget={r.budget}
                        formatAmountCompact={formatAmountCompact}
                        shownRate={shownRate}
                        digits={inputDigits(shownCurrency, shownRate)}
                        symbol={getSymbol(shownCurrency)}
                        onSet={amt => setBudget(r.cat, amt)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

interface BudgetRowProps {
  cat: string;
  spent: number;
  /** In rupees. */
  budget: number;
  formatAmountCompact: (n: number) => string;
  shownRate: number;
  /** Decimals the shown currency can hold (inputDigits). */
  digits: number;
  symbol: string;
  /** Called with rupees. */
  onSet: (amount: number) => void;
}

const BudgetRow: React.FC<BudgetRowProps> = ({ cat, spent, budget, formatAmountCompact, shownRate, digits, symbol, onSet }) => {
  const [val, setVal] = useState<string | null>(null);
  const pct = budget > 0 ? spent / budget : 0;
  const over = budget > 0 && spent > budget;
  const barColor = !budget ? 'bg-gray-200' : over ? 'bg-rose' : pct >= 0.8 ? 'bg-sand' : 'bg-sage';

  return (
    <div>
      <div className="flex items-center gap-2 mb-1.5">
        <p className="text-[12px] font-semibold text-premium-charcoal truncate flex-1" title={cat}>{cat}</p>
        <span className="text-[11px] text-muted-taupe shrink-0 tabular-nums">
          {formatAmountCompact(spent)}{budget > 0 ? ` / ${formatAmountCompact(budget)}` : ''}
        </span>
        <input
          type="number"
          inputMode="numeric"
          placeholder={`Cap ${symbol}`}
          value={val ?? (budget > 0 ? String(toShown(budget, shownRate, digits)) : '')}
          onChange={e => setVal(e.target.value)}
          onBlur={() => {
            if (val !== null) {
              // Typed in the currency shown; saved in rupees.
              if (val !== String(toShown(budget, shownRate, digits))) onSet(toBase(Math.max(0, parseFloat(val) || 0), shownRate));
              setVal(null);
            }
          }}
          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
          className="w-20 bg-zen-bg rounded-lg px-2 py-1.5 text-[11px] text-premium-charcoal text-right outline-none focus:ring-1 focus:ring-sage border border-transparent focus:border-sage/30 shrink-0"
        />
      </div>
      <div className="h-2 bg-zen-bg rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: budget > 0 ? `${Math.min(100, Math.round(pct * 100))}%` : spent > 0 ? '4%' : '0%' }}
        />
      </div>
      {over && (
        <p className="text-[10px] text-rose font-semibold mt-1">
          Over by {formatAmountCompact(spent - budget)}
        </p>
      )}
    </div>
  );
};

export default IncomeInsights;
