import React, { useMemo, useState } from 'react';
import { AppScreen, TransactionType } from '../types';
import { useWallet } from '../context/WalletContext';
import { localDay, parseDay } from '../utils/dates';
import { Mascot } from './ui/Brand';
import { pulseView, usePulseView } from './pulseView';
import { tick } from '../utils/haptics';
import { openAt, type ScreenSection } from '../utils/screenSection';
import { analyzePulse, keptShare, type Insight, type PulseResult } from '../services/pulseAnalysis';
import { detectRecurringCharges, priceRises, prettyMerchant } from '../services/analyticsService';
import UnsortedTransfers from './UnsortedTransfers';
import PageHeader from './ui/PageHeader';
import { Denim, DenimFigure, DenimLabel, Pocket } from './ui/Denim';
import { Card, IconChip, SectionTitle } from './ui/Paper';
import MoneyInOut from './charts/MoneyInOut';
import PaceChart from './charts/PaceChart';
import { CalendarHeat, RankedBars, SplitBar, UsualBars, WeekdayBars } from './charts/SpendCharts';
import PlanLock from './PlanLock';
import { useLimits } from '../services/plan';
import { opens } from '../services/planRules';
import { openPlans } from '../services/planSheet';

/** Pulse is a hub (the month at a glance) with a page for each topic. */
export type PulsePage = 'hub' | 'trends' | 'categories' | 'recurring' | 'health';

interface SpendAnalysisProps {
  onNavigate: (screen: AppScreen) => void;
  page?: PulsePage;
}

const PAGE_TITLE: Record<PulsePage, string> = {
  hub: 'Pulse', trends: 'Trends', categories: 'Categories', recurring: 'Recurring', health: 'Insights',
};

const TONE: Record<Insight['tone'], { tint: string; group: string }> = {
  watch: { tint: 'bg-rose-light text-rose', group: 'Worth a look' },
  good: { tint: 'bg-sage-light text-sage', group: 'Going well' },
  info: { tint: 'bg-ocean-light text-ocean', group: 'Good to know' },
};

const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const shortDay = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

const SpendAnalysis: React.FC<SpendAnalysisProps> = ({ onNavigate, page = 'hub' }) => {
  // Pulse analyses real spending and income only: money moved to your own
  // accounts, family or investments is left out (audit H3).
  const { counted: all, formatWhole, formatAmountCompact, budgets, dailyLimit, accounts } = useWallet();
  // Essential (and no plan) look at the last 12 months; older entries stay
  // saved, in Vault, read-only (services/planRules.ts).
  const limits = useLimits(accounts);
  const fullHistory = opens(limits.access, 'full-history');
  const floorKey = fullHistory ? '' : limits.from.slice(0, 7);
  const counted = useMemo(
    () => (fullHistory ? all : all.filter(t => t.date.slice(0, 10) >= limits.from)),
    [all, fullHistory, limits.from],
  );
  const olderHidden = counted.length < all.length;
  const recurringOpen = opens(limits.access, 'recurring');
  const view = usePulseView();
  const [heatDay, setHeatDay] = useState<number | null>(null);
  const now = new Date();

  // The months the data covers; until one is picked, Pulse shows the newest
  // data's month (never a month after this one).
  const { firstKey, newestKey } = useMemo(() => {
    let first = '', newest = '';
    for (const t of counted) {
      const d = t.date.slice(0, 10);
      if (!first || d < first) first = d;
      if (d > newest) newest = d;
    }
    return { firstKey: first.slice(0, 7), newestKey: newest.slice(0, 7) };
  }, [counted]);
  const nowKey = monthKey(now);
  const picked = view.month
    ?? (newestKey && newestKey < nowKey ? parseDay(`${newestKey}-01`) : new Date(now.getFullYear(), now.getMonth(), 1));
  // A month picked on Plus, before Essential's 12 months, opens at their start.
  const selected = floorKey && monthKey(picked) < floorKey ? parseDay(`${floorKey}-01`) : picked;
  const selKey = monthKey(selected);

  const r = useMemo(
    () => analyzePulse({ counted, month: selected, money: formatWhole, budgets }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [counted, selKey, formatWhole, budgets],
  );

  // Recurring charges for the hub's preview (hooks stay above the pages' early returns).
  const recurringCount = useMemo(() => (recurringOpen ? detectRecurringCharges(counted, new Date(), Infinity) : []), [counted, recurringOpen]);
  const recurringMonthly = recurringCount.reduce((s, c) => s + c.monthlyCost, 0);

  // Back from the first month Essential shows, with older ones saved: say why it stops.
  const atFloor = !!floorKey && olderHidden && selKey <= (firstKey || floorKey);
  const goMonth = (offset: number) => {
    if (offset < 0 && atFloor) { openPlans('history'); return; }
    tick();
    setHeatDay(null);
    pulseView.setMonth(new Date(selected.getFullYear(), selected.getMonth() + offset, 1));
  };
  const canBack = (!!firstKey && selKey > firstKey) || atFloor;
  const canForward = selKey < nowKey;

  const open = (screen: AppScreen, section?: ScreenSection) => { if (section) openAt(section); onNavigate(screen); };

  const monthSwitch = (
    <div className="flex items-center rounded-full bg-white shadow-soft border border-black/[0.03] px-1 py-1 shrink-0">
      <button onClick={() => goMonth(-1)} disabled={!canBack} className="w-8 h-8 rounded-full flex items-center justify-center text-muted-taupe hover:text-sage hover:bg-zen-cream disabled:opacity-30" aria-label="Previous month">
        <span className="material-symbols-outlined text-[18px]" aria-hidden="true">chevron_left</span>
      </button>
      <button onClick={() => { setHeatDay(null); pulseView.setMonth(null); }} className="px-1.5 text-[12px] font-semibold text-premium-charcoal tabular-nums" title="Go to the newest month">
        {selected.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}
      </button>
      <button onClick={() => goMonth(1)} disabled={!canForward} className="w-8 h-8 rounded-full flex items-center justify-center text-muted-taupe hover:text-sage hover:bg-zen-cream disabled:opacity-30" aria-label="Next month">
        <span className="material-symbols-outlined text-[18px]" aria-hidden="true">chevron_right</span>
      </button>
    </div>
  );

  const shell = (body: React.ReactNode) => (
    <div className="eco-frame relative flex h-auto min-h-screen w-full flex-col max-w-[430px] lg:max-w-6xl mx-auto overflow-x-hidden pb-32 lg:pb-12 bg-zen-bg">
      <PageHeader
        title={PAGE_TITLE[page]}
        onBack={page === 'hub' ? undefined : () => onNavigate(AppScreen.ANALYSIS)}
        backLabel="Back to Pulse"
        right={page === 'recurring' ? undefined : monthSwitch}
      />
      {body}
    </div>
  );

  if (page === 'trends') return shell(<Trends r={r} onNavigate={onNavigate} heatDay={heatDay} setHeatDay={setHeatDay} />);
  if (page === 'categories') return shell(<Categories r={r} onNavigate={onNavigate} />);
  if (page === 'recurring') return shell(<Recurring />);
  if (page === 'health') return shell(<Insights r={r} open={open} />);

  // ── The hub ─────────────────────────────────────────────────────────────
  const empty = r.spent === 0 && r.cameIn === 0;
  const p = r.pace;
  const top = r.insights.filter(i => !(i.id === 'pace' && p.projected !== null)).slice(0, 3);
  const todaySpent = r.isCurrent && p.today ? r.daily[p.today - 1] ?? 0 : 0;
  const compareLine = r.compare
    ? r.compare.kind === 'sameDay'
      ? `${Math.abs(r.compare.change)}% ${r.compare.change >= 0 ? 'more' : 'less'} than by this day in ${r.prevName}`
      : `${Math.abs(r.compare.change)}% ${r.compare.change >= 0 ? 'more' : 'less'} than ${r.prevName}`
    : null;
  const usualTop = r.usual.find(u => Math.round(u.delta) !== 0);
  const busiest = r.daily.reduce((b, v, i) => (v > r.daily[b] ? i : b), 0);
  const pages = [
    {
      screen: AppScreen.PULSE_TRENDS, title: 'Trends', icon: 'show_chart', tint: 'bg-ocean-light text-ocean',
      preview: p.projected !== null ? `On course for ${formatWhole(p.projected)}`
        : r.daily[busiest] > 0 ? `Biggest day ${busiest + 1} ${shortDay(selected).split(' ')[1]}, ${formatAmountCompact(r.daily[busiest])}` : 'Day by day, week by week',
    },
    {
      screen: AppScreen.PULSE_CATEGORIES, title: 'Categories', icon: 'donut_large', tint: 'bg-sage-light text-sage',
      preview: usualTop ? `${usualTop.category} ${usualTop.delta > 0 ? 'up' : 'down'} ${formatWhole(Math.abs(usualTop.delta))} on usual`
        : r.categories[0] ? `${r.categories[0].name} leads at ${r.categories[0].share}%` : 'Where your money goes',
    },
    {
      screen: AppScreen.PULSE_RECURRING, title: 'Recurring', icon: 'autorenew', tint: 'bg-lavender-light text-lavender',
      preview: !recurringOpen ? 'Bills and subscriptions, in Plus'
        : recurringCount.length > 0 ? `${recurringCount.length} ${recurringCount.length === 1 ? 'charge' : 'charges'}, about ${formatAmountCompact(recurringMonthly)} a month` : 'Bills and subscriptions',
    },
    {
      screen: AppScreen.PULSE_HEALTH, title: 'Insights', icon: 'lightbulb', tint: 'bg-sand-light text-sand-ink',
      preview: r.insights.length > 0 ? `${r.insights.length} ${r.insights.length === 1 ? 'finding' : 'findings'} for ${r.name}` : 'What stands out',
    },
  ];

  return shell(
    <div className="px-5 lg:px-8 pt-1 grid grid-cols-1 gap-4 lg:grid-cols-12 lg:items-start">
      {/* The month's key figure, on the wallet */}
      <Denim className="lg:col-span-7" aria-label={`Spending in ${r.name}`}>
        <div className="flex items-center justify-between gap-3">
          <DenimLabel className="tracking-wide">{r.isCurrent ? `Spent in ${r.name} so far` : `Spent in ${r.name}`}</DenimLabel>
          {p.behind && p.through > 0 && <DenimLabel className="text-[11px]">Entries up to {p.through} {shortDay(selected).split(' ')[1]}</DenimLabel>}
        </div>
        <DenimFigure className="mt-4">{formatWhole(r.spent)}</DenimFigure>
        <p className="text-[12px] font-medium text-denim-mut mt-3 min-h-[18px]">
          {empty ? `No entries for ${r.name}`
            : r.review ? (r.review.amount >= 1000 ? `${formatWhole(r.review.amount)} of this is still to review` : `${r.prevName} has ${formatWhole(r.review.prevAmount)} still to review`)
            : compareLine ?? (r.isCurrent ? `Day ${p.through} of ${p.daysInMonth}` : `${p.daysInMonth} days`)}
        </p>
        <div className="grid grid-cols-2 gap-2.5 mt-4">
          <Pocket
            label="Came in" icon="south_west"
            value={`+${formatAmountCompact(r.cameIn)}`}
            note={r.cameIn > 0 ? (r.kept >= 0 ? `Kept ${formatAmountCompact(r.kept)}, ${keptShare(r.kept, r.cameIn)}` : `${formatAmountCompact(-r.kept)} more out`) : 'Nothing yet'}
          />
          {r.isCurrent ? (
            p.projected !== null ? (
              <Pocket label="On course for" icon="speed" value={formatAmountCompact(p.projected)} note={`by ${p.daysInMonth} ${shortDay(selected).split(' ')[1]}`} />
            ) : (
              <Pocket label="Today" icon="today" value={`−${formatAmountCompact(todaySpent)}`} note={dailyLimit > 0 ? `Daily limit ${formatAmountCompact(dailyLimit)}` : shortDay(now)} />
            )
          ) : (
            <Pocket label="A day" icon="calendar_month" value={formatAmountCompact(r.spent / p.daysInMonth)} note={`over ${p.daysInMonth} days`} />
          )}
        </div>
      </Denim>

      {/* Transfers to unsorted payees count as spending until sorted (audit H3);
          on wide screens, a full-width line above everything */}
      <UnsortedTransfers onNavigate={onNavigate} className="lg:col-span-12 lg:order-first" />

      {/* What stands out: the top findings */}
      <Card className="lg:col-span-5">
        <SectionTitle action={r.insights.length > 0 ? { label: 'All insights', onClick: () => onNavigate(AppScreen.PULSE_HEALTH) } : undefined}>
          What stands out
        </SectionTitle>
        {empty ? (
          <div className="flex flex-col items-center text-center py-4">
            <Mascot pose="think" height={84} />
            <p className="text-[13px] text-muted-taupe mt-3 max-w-[260px] leading-relaxed">Add an entry or import a statement and this month's findings show up here.</p>
            <div className="flex gap-2 mt-4">
              <button onClick={() => onNavigate(AppScreen.NEW_ENTRY)} className="px-4 py-2 rounded-full bg-sage text-white text-[12px] font-semibold shadow-soft">Add an entry</button>
              <button onClick={() => onNavigate(AppScreen.IMPORT)} className="px-4 py-2 rounded-full bg-white text-premium-charcoal text-[12px] font-semibold shadow-soft border border-premium-charcoal/[0.08]">Import</button>
            </div>
          </div>
        ) : top.length === 0 ? (
          <p className="text-[13px] text-muted-taupe">Nothing unusual in {r.name}.</p>
        ) : (
          <ul className="divide-y divide-premium-charcoal/[0.06] -my-1">
            {top.map(i => <InsightRow key={i.id} insight={i} open={open} />)}
          </ul>
        )}
      </Card>


      <MoneyInOut className="lg:col-span-7" months={r.months} selectedKey={r.key} liveKey={nowKey} />
      <SplitBar className="lg:col-span-5" split={r.split} spent={r.spent} />

      {/* Pages: each topic on its own screen */}
      <nav className="lg:col-span-12" aria-label="More in Pulse">
        <ul className="bg-white rounded-3xl shadow-soft border border-black/[0.02] overflow-hidden divide-y lg:divide-y-0 lg:grid lg:grid-cols-4 divide-premium-charcoal/[0.06]">
          {pages.map(row => (
            <li key={row.screen}>
              <button onClick={() => onNavigate(row.screen)} className="w-full flex items-center gap-3 px-4 py-3.5 text-left active:bg-zen-cream hover:bg-zen-cream/60 transition-colors">
                <IconChip icon={row.icon} tint={row.tint} />
                <span className="flex-1 min-w-0">
                  <span className="block text-[14px] font-semibold text-premium-charcoal">{row.title}</span>
                  <span className="block text-[12px] text-muted-taupe truncate">{row.preview}</span>
                </span>
                <span className="material-symbols-outlined text-muted-taupe/60 text-[20px] shrink-0" aria-hidden="true">chevron_right</span>
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {olderHidden && <PlanLock reason="history" compact className="lg:col-span-12" />}

      <AskSoon className="lg:col-span-12" />
    </div>,
  );
};

/** One finding: its icon in the tone's tint, the line, the detail, and where to look. */
const InsightRow: React.FC<{ insight: Insight; open: (screen: AppScreen, section?: ScreenSection) => void }> = ({ insight, open }) => (
  <li className="flex items-start gap-3 py-3">
    <IconChip icon={insight.icon} tint={TONE[insight.tone].tint} size="sm" />
    <div className="flex-1 min-w-0">
      <p className="text-[14px] font-semibold text-premium-charcoal leading-snug">{insight.title}</p>
      <p className="text-[12px] text-muted-taupe leading-relaxed mt-0.5">{insight.detail}</p>
      {insight.action && (
        <button
          onClick={() => open(insight.action!.screen, insight.action!.section)}
          className="mt-1.5 text-[10px] text-sage font-semibold uppercase tracking-wider hover:underline"
        >
          {insight.action.label}
        </button>
      )}
    </div>
  </li>
);

/**
 * Ask Wall-ette: questions about your money in plain words. Not built yet,
 * so it says so; nothing on this card is pretend.
 */
const AskSoon: React.FC<{ className?: string; full?: boolean }> = ({ className = '', full = false }) => (
  <div className={`rounded-3xl border border-dashed border-premium-charcoal/[0.14] px-5 py-4 ${className}`}>
    <div className="flex items-center gap-3">
      <IconChip icon="forum" tint="bg-lavender-light text-lavender" size="sm" />
      <div className="flex-1 min-w-0">
        <p className="text-[14px] font-semibold text-premium-charcoal">Ask Wall-ette</p>
        <p className="text-[12px] text-muted-taupe leading-snug">Questions about your money, answered in plain words.</p>
      </div>
      <span className="text-[10px] uppercase tracking-widest text-muted-taupe font-bold shrink-0">Coming soon</span>
    </div>
    {full && (
      <ul className="mt-3 space-y-1.5 pl-11 text-[12px] text-muted-taupe">
        <li>“How much did I spend on food in the last three months?”</li>
        <li>“Which subscriptions went up this year?”</li>
        <li>“Can I afford a trip in March?”</li>
      </ul>
    )}
  </div>
);

// ── Trends ────────────────────────────────────────────────────────────────

const Trends: React.FC<{
  r: PulseResult;
  onNavigate: (screen: AppScreen) => void;
  heatDay: number | null;
  setHeatDay: (d: number | null) => void;
}> = ({ r, onNavigate, heatDay, setHeatDay }) => {
  const { counted, formatWhole } = useWallet();
  const [y, m] = [+r.key.slice(0, 4), +r.key.slice(5) - 1];
  const through = r.pace.through;
  const entries = useMemo(
    () => counted.filter(t => t.type === TransactionType.EXPENSE && t.date.slice(0, 7) === r.key),
    [counted, r.key],
  );
  const spentThrough = through > 0 ? r.pace.now[through - 1] ?? 0 : 0;
  const entriesThrough = entries.filter(t => +t.date.slice(8, 10) <= through);
  const monthShort = parseDay(`${r.key}-01`).toLocaleDateString('en-GB', { month: 'short' });
  const tiles = [
    { label: 'Payments', value: entriesThrough.length.toLocaleString('en-IN') },
    { label: 'A day', value: through > 0 ? formatWhole(spentThrough / through) : '–', note: `over ${through} ${through === 1 ? 'day' : 'days'}` },
    { label: 'A payment', value: entriesThrough.length ? formatWhole(spentThrough / entriesThrough.length) : '–', note: 'on average' },
  ];
  const dayList = heatDay !== null
    ? entries.filter(t => +t.date.slice(8, 10) === heatDay).sort((a, b) => b.amount - a.amount)
    : [];
  return (
    <div className="px-5 lg:px-8 pt-1 grid grid-cols-1 gap-4 lg:grid-cols-12 lg:items-start">
      <div className="grid grid-cols-3 gap-2.5 lg:col-span-12">
        {tiles.map(t => (
          <Card key={t.label} className="!p-3.5 text-center">
            <p className="text-[10px] uppercase tracking-widest text-muted-taupe font-bold">{t.label}</p>
            <p className="font-semibold text-[20px] leading-tight text-premium-charcoal mt-1 truncate tabular-nums">{t.value}</p>
            {t.note && <p className="text-[11px] text-muted-taupe truncate">{t.note}</p>}
          </Card>
        ))}
      </div>
      <PaceChart className="lg:col-span-7" pace={r.pace} compare={r.compare} monthName={r.name} prevName={r.prevName} monthShort={monthShort} />
      <CalendarHeat className="lg:col-span-5" daily={r.daily} year={y} month={m} through={through} selected={heatDay} onSelect={setHeatDay}>
        {heatDay !== null && (
          <div className="mt-3 pt-3 border-t border-premium-charcoal/[0.08]">
            <p className="text-[10px] uppercase tracking-widest text-muted-taupe font-bold mb-2">
              {heatDay} {monthShort} · {formatWhole(r.daily[heatDay - 1] ?? 0)}
            </p>
            {dayList.length === 0 ? (
              <p className="text-[12px] text-muted-taupe">Nothing spent on this day.</p>
            ) : (
              <ul className="space-y-2">
                {dayList.slice(0, 6).map(t => (
                  <li key={t.id} className="flex items-center gap-2 min-w-0 text-[12px]">
                    <span className="text-premium-charcoal truncate flex-1" title={t.merchant || t.category}>{prettyMerchant(t.merchant || t.category)}</span>
                    <span className="text-muted-taupe shrink-0">{t.category}</span>
                    <span className="font-semibold text-premium-charcoal shrink-0 tabular-nums">−{formatWhole(t.amount)}</span>
                  </li>
                ))}
                {dayList.length > 6 && (
                  <li>
                    <button onClick={() => onNavigate(AppScreen.HISTORY)} className="text-[10px] text-sage font-semibold uppercase tracking-wider hover:underline">
                      {dayList.length - 6} more in Vault
                    </button>
                  </li>
                )}
              </ul>
            )}
          </div>
        )}
      </CalendarHeat>
      <WeekdayBars className="lg:col-span-7" weekdays={r.weekdays} />
    </div>
  );
};

// ── Categories ────────────────────────────────────────────────────────────

const Categories: React.FC<{ r: PulseResult; onNavigate: (screen: AppScreen) => void }> = ({ r, onNavigate }) => {
  const names = [...r.baseline].reverse().map(k => parseDay(`${k}-01`).toLocaleDateString('en-GB', { month: 'short' }));
  const span = names.length === 1 ? names[0] : names.length === 2 ? `${names[0]} and ${names[1]}` : `${names[0]}–${names[names.length - 1]}`;
  const baselineNote = r.usual.length
    ? r.isCurrent
      ? `Up to day ${r.pace.through}, against the same days of ${span}${names.length > 1 ? ' on average' : ''}`
      : `Against ${span}${names.length > 1 ? ', a month on average' : ''}`
    : '';
  return (
    <div className="px-5 lg:px-8 pt-1 grid grid-cols-1 gap-4 lg:grid-cols-12 lg:items-start">
      <SplitBar className="lg:col-span-5" split={r.split} spent={r.spent} />
      {r.usual.length > 0 ? (
        <UsualBars className="lg:col-span-7" rows={r.usual} basis={baselineNote} />
      ) : (
        <Card className="lg:col-span-7">
          <SectionTitle>Compared with your usual</SectionTitle>
          <p className="text-[13px] text-muted-taupe leading-relaxed">Once your entries cover a full month before {r.name}, each category is compared with its usual here.</p>
        </Card>
      )}
      <RankedBars
        className="lg:col-span-7"
        title="By category"
        head={['Category', 'Spent']}
        rows={r.categories.map(c => ({ name: c.name, amount: c.amount, note: `${c.count} ${c.count === 1 ? 'payment' : 'payments'}, ${c.share === 0 && c.amount > 0 ? 'under 1' : c.share}%` }))}
        footer={r.categories.length > 0 ? (
          <button onClick={() => onNavigate(AppScreen.CATEGORY_SPLIT)} className="text-[10px] text-sage font-semibold uppercase tracking-wider hover:underline">See the split as a chart</button>
        ) : undefined}
      />
      <RankedBars
        className="lg:col-span-5"
        title="Top payees"
        head={['Payee', 'Spent']}
        rows={r.payees.map(p => ({ name: p.name, amount: p.amount, note: `${p.count} ${p.count === 1 ? 'payment' : 'payments'}` }))}
      />
    </div>
  );
};

// ── Recurring ─────────────────────────────────────────────────────────────

const ICONS: [RegExp, string][] = [
  [/rent|house|emi|loan/i, 'home'], [/food|dining|grocer|coffee/i, 'restaurant'], [/health|medical|pharma|doctor/i, 'medication'],
  [/transport|fuel|taxi|metro|train/i, 'commute'], [/shop|clothing|electronics/i, 'shopping_bag'], [/stream|music|movie|entertain|game/i, 'movie'],
  [/utilit|electric|water|gas|bill/i, 'receipt_long'], [/phone|internet/i, 'smartphone'], [/educat|course|book/i, 'school'],
  [/insurance/i, 'shield'], [/gym/i, 'fitness_center'], [/subscri/i, 'subscriptions'],
];
const iconFor = (category: string) => ICONS.find(([re]) => re.test(category))?.[1] ?? 'autorenew';

const Recurring: React.FC = () => {
  const { counted, formatWhole, formatAmountCompact } = useWallet();
  const recurring = useMemo(() => detectRecurringCharges(counted, new Date(), Infinity), [counted]);
  const rises = useMemo(() => priceRises(counted), [counted]);
  const monthly = recurring.reduce((s, c) => s + c.monthlyCost, 0);
  const today = localDay();
  return (
    <div className="px-5 lg:px-8 pt-1 grid grid-cols-1 gap-4 lg:grid-cols-12 lg:items-start">
      {recurring.length === 0 ? (
        <Card className="text-center lg:col-span-7">
          <span className="material-symbols-outlined icon-fill text-lavender text-[28px]" aria-hidden="true">autorenew</span>
          <p className="font-display text-[18px] font-bold text-premium-charcoal mt-2">No regular charges yet</p>
          <p className="text-[12px] text-muted-taupe mt-1 leading-relaxed">
            Bills and subscriptions show up here once a payee charges you about the same amount on a regular schedule.
          </p>
        </Card>
      ) : (
        <div className="space-y-4 lg:col-span-7">
          <Denim compact aria-label="Recurring charges">
            <div className="flex items-end justify-between gap-3">
              <div>
                <DenimLabel className="tracking-wide">Every month, about</DenimLabel>
                <DenimFigure size="md" className="mt-1.5">{formatWhole(monthly)}</DenimFigure>
              </div>
              <p className="text-[12px] text-denim-mut text-right">
                {recurring.length} {recurring.length === 1 ? 'charge' : 'charges'}<br />
                {formatAmountCompact(monthly * 12)} a year
              </p>
            </div>
          </Denim>
          <Card flush>
            <ul className="divide-y divide-premium-charcoal/[0.06]">
              {[...recurring].sort((a, b) => a.nextExpected.getTime() - b.nextExpected.getTime()).map(c => {
                const due = localDay(c.nextExpected);
                const days = Math.round((parseDay(due).getTime() - parseDay(today).getTime()) / 86400000);
                const next = days < 0 ? `was due ${shortDay(c.nextExpected)}` : days === 0 ? 'due today' : days === 1 ? 'due tomorrow' : `next ${shortDay(c.nextExpected)}`;
                return (
                  <li key={`${c.name}:${c.cadence}`} className="flex items-center gap-3 px-4 py-3">
                    <IconChip icon={iconFor(c.category)} tint="bg-lavender-light text-lavender" size="sm" />
                    <span className="flex-1 min-w-0">
                      <span className="block text-[14px] font-semibold text-premium-charcoal truncate" title={c.name}>{prettyMerchant(c.name)}</span>
                      <span className={`block text-[11px] truncate ${days >= 0 && days <= 3 ? 'text-premium-charcoal font-medium' : 'text-muted-taupe'}`}>
                        {c.cadence.charAt(0) + c.cadence.slice(1).toLowerCase()} · {next}
                      </span>
                    </span>
                    <span className="text-right shrink-0">
                      <span className="block text-[14px] font-semibold text-premium-charcoal tabular-nums">{formatWhole(c.amount)}</span>
                      {c.cadence !== 'MONTHLY' && <span className="block text-[11px] text-muted-taupe tabular-nums">{formatAmountCompact(c.monthlyCost)} a month</span>}
                    </span>
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>
      )}
      {rises.length > 0 && (
        <Card className="lg:col-span-5">
          <SectionTitle>Gone up in price</SectionTitle>
          <p className="text-[12px] text-muted-taupe -mt-1.5 mb-3">Same payee, same rhythm, a higher amount than before.</p>
          <ul className="space-y-3">
            {rises.slice(0, 6).map(rise => (
              <li key={rise.key} className="flex items-center gap-3">
                <IconChip icon="trending_up" tint="bg-rose-light text-rose" size="sm" />
                <span className="flex-1 min-w-0">
                  <span className="block text-[14px] font-semibold text-premium-charcoal truncate" title={rise.name}>{prettyMerchant(rise.name)}</span>
                  <span className="block text-[11px] text-muted-taupe tabular-nums">{formatAmountCompact(rise.from)} → {formatAmountCompact(rise.to)} a month</span>
                </span>
                <span className="text-[12px] font-semibold text-premium-charcoal tabular-nums shrink-0">+{formatAmountCompact(rise.annualExtra)} a year</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
};

// ── Insights ──────────────────────────────────────────────────────────────

const Insights: React.FC<{ r: PulseResult; open: (screen: AppScreen, section?: ScreenSection) => void }> = ({ r, open }) => {
  const groups = (['watch', 'good', 'info'] as const)
    .map(tone => ({ tone, items: r.insights.filter(i => i.tone === tone) }))
    .filter(g => g.items.length > 0);
  return (
    <div className="px-5 lg:px-8 pt-1 grid grid-cols-1 gap-4 lg:grid-cols-12 lg:items-start">
      <div className="space-y-4 lg:col-span-7">
        {groups.length === 0 ? (
          <Card className="flex flex-col items-center text-center py-8">
            <Mascot pose="think" height={84} />
            <p className="text-[13px] text-muted-taupe mt-3 max-w-[280px] leading-relaxed">Nothing stands out in {r.name} yet. Findings show up as your entries build up.</p>
          </Card>
        ) : groups.map(g => (
          <Card key={g.tone}>
            <SectionTitle>{TONE[g.tone].group}</SectionTitle>
            <ul className="divide-y divide-premium-charcoal/[0.06] -my-1">
              {g.items.map(i => <InsightRow key={i.id} insight={i} open={open} />)}
            </ul>
          </Card>
        ))}
        <p className="text-[11px] text-muted-taupe leading-relaxed px-1">
          Processed on this device from your entries; money moved between your own accounts, to family or to investments isn't counted as spending.
        </p>
      </div>
      <AskSoon className="lg:col-span-5" full />
    </div>
  );
};

export default SpendAnalysis;
