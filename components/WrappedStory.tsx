import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import wordmarkSvg from '../assets/brand/wordmark.svg?raw';
import { MONTH_LONG, MONTH_SHORT, WEEKDAY_LONG, percent, shortDay, type WrappedYear } from '../services/wrapped';
import { drawWrappedCard } from '../utils/wrappedCard';
import { exportImage } from '../utils/exportFile';
import { useBackHandler } from '../utils/backStack';
import { log } from '../utils/log';
import { SITE_HOST } from '../utils/site';
import { Mascot, mascotImage, type MascotPose } from './ui/Brand';

/** Each slide's denim: the theme's sage, or one of four brand shades. */
const SHADES = {
  sage: { '--wallet': '#5B7543', '--wallet-2': '#3E5430' },
  rose: { '--wallet': '#9A5442', '--wallet-2': '#6E3A2D' },
  plum: { '--wallet': '#66597F', '--wallet-2': '#463D5A' },
  ocean: { '--wallet': '#46697A', '--wallet-2': '#2F4A57' },
  sand: { '--wallet': '#85683F', '--wallet-2': '#5C4628' },
} as const;

interface Slide {
  id: string;
  shade: keyof typeof SHADES;
  /** Read out when the slide opens. */
  title: string;
  body: React.ReactNode;
}

const Pocket: React.FC<{ label: string; value: string; className?: string }> = ({ label, value, className = '' }) => (
  <div className={`wallet-pocket rounded-2xl px-4 py-3 min-w-0 ${className}`}>
    <p className="text-[12px] font-medium text-denim-mut">{label}</p>
    <p className="font-semibold text-[24px] leading-tight tabular-nums mt-0.5 truncate">{value}</p>
  </div>
);

const Big: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <h2 className={`font-display font-extrabold text-[34px] leading-[1.1] tracking-tight ${className}`}>{children}</h2>
);

const Line: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <p className={`text-[15px] leading-relaxed text-denim-mut ${className}`}>{children}</p>
);

/**
 * Wall·ette Wrapped as a story: one year in a few tap-through slides (tap the
 * right of the screen for the next, the left for the one before; arrow keys
 * and Esc on a keyboard; Back closes), ending on the card to share. Full
 * screen on a phone, a phone-sized panel on a wide screen. Nothing moves on
 * its own: each slide waits for a tap.
 */
const WrappedStory: React.FC<{
  year: WrappedYear;
  money: (n: number) => string;
  onClose: () => void;
}> = ({ year: y, money, onClose }) => {
  const [index, setIndex] = useState(0);
  const [showAmounts, setShowAmounts] = useState(false);
  const [card, setCard] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const kept = y.kept >= 0;
  const yearWord = `${y.year}${y.current ? ' so far' : ''}`;

  const slides = useMemo<Slide[]>(() => {
    const list: Slide[] = [];
    list.push({
      id: 'intro', shade: 'sage', title: `Your ${yearWord}, tallied`,
      body: (
        <div className="flex flex-col items-center text-center gap-5 pt-6">
          <Mascot pose="welcome" height={190} />
          <div>
            <p className="text-[15px] font-medium text-denim-mut">Wall·ette Wrapped</p>
            <Big className="mt-1 text-[44px]">Your {y.year}{y.current ? <span className="block text-[22px] font-semibold text-denim-mut mt-1">so far</span> : null}</Big>
          </div>
          <Line className="max-w-[30ch]">
            {y.entries.toLocaleString('en-IN')} {y.entries === 1 ? 'entry' : 'entries'}, {shortDay(y.from, y.year)} to {shortDay(y.to, y.year)}.
          </Line>
        </div>
      ),
    });
    list.push({
      id: 'kept', shade: 'sage', title: y.rate === null ? 'What came in and went out' : kept ? `You kept ${percent(y.rate / 100)}` : 'More went out than came in',
      body: (
        <div className="flex flex-col gap-5">
          <Mascot pose={(kept ? 'celebrate' : 'encourage') as MascotPose} height={150} className="self-end -mb-2" />
          {y.rate === null ? (
            <Big>{y.out > 0 ? 'Nothing came in this year, or it isn\'t in Wall·ette yet.' : 'Nothing went out.'}</Big>
          ) : kept ? (
            <Big>You kept {percent(y.rate / 100)} of what came in.</Big>
          ) : (
            <Big>{money(-y.kept)} more went out than came in.</Big>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Pocket label="Came in" value={money(y.inc)} />
            <Pocket label="Went out" value={money(y.out)} />
          </div>
          <Line>
            {kept
              ? `${money(y.kept)} stayed with you. Money you moved to your own accounts isn't counted either way.`
              : "It happens. An account that isn't in Wall·ette yet can change this, and money you moved to your own accounts isn't counted."}
          </Line>
        </div>
      ),
    });
    if (y.categories.length > 0) {
      list.push({
        id: 'where', shade: 'rose', title: 'Where it went',
        body: (
          <div className="flex flex-col gap-6">
            <Big>Where it went</Big>
            <ul className="space-y-5">
              {y.categories.map(c => (
                <li key={c.name}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-[17px] font-semibold truncate">{c.name}</span>
                    <span className="text-[15px] tabular-nums text-denim-mut shrink-0">{money(c.amount)}</span>
                  </div>
                  <div className="mt-2 h-3 rounded-full bg-black/20 overflow-hidden" aria-hidden="true">
                    <div className="h-full rounded-full bg-[#F6D9CF]" style={{ width: `${Math.max(3, c.share * 100)}%` }} />
                  </div>
                  <p className="mt-1 text-[13px] text-denim-mut">{percent(c.share)} of your spending</p>
                </li>
              ))}
            </ul>
          </div>
        ),
      });
    }
    if (y.payees.length > 0) {
      list.push({
        id: 'payees', shade: 'plum', title: 'Most paid to',
        body: (
          <div className="flex flex-col gap-6">
            <Big>Most paid to</Big>
            <ol className="space-y-3">
              {y.payees.map((p, i) => (
                <li key={p.name} className="wallet-pocket rounded-2xl px-4 py-3 flex items-center gap-3">
                  <span className="font-display font-extrabold text-[26px] w-6 text-center text-denim-mut" aria-hidden="true">{i + 1}</span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[17px] font-semibold truncate">{p.name}</span>
                    <span className="block text-[13px] text-denim-mut">{p.count} {p.count === 1 ? 'payment' : 'payments'}</span>
                  </span>
                  <span className="text-[16px] font-semibold tabular-nums shrink-0">{money(p.amount)}</span>
                </li>
              ))}
            </ol>
            {y.regular && <Line>Your regular: {y.regular.name}, {y.regular.count} times.</Line>}
          </div>
        ),
      });
    }
    if (y.busiestMonth !== null) {
      const max = Math.max(...y.months, 1);
      list.push({
        id: 'months', shade: 'ocean', title: `Your busiest month was ${MONTH_LONG[y.busiestMonth]}`,
        body: (
          <div className="flex flex-col gap-6">
            <Big>{MONTH_LONG[y.busiestMonth]} was your busiest month.</Big>
            <div className="wallet-pocket rounded-2xl px-3 pt-4 pb-2" role="img"
                 aria-label={`Spending by month, ${MONTH_LONG[y.busiestMonth]} the most at ${money(y.months[y.busiestMonth])}`}>
              <div className="flex items-end gap-1.5 h-36">
                {y.months.map((v, m) => (
                  <div key={m} className="flex-1 flex flex-col items-center justify-end h-full">
                    <div
                      className={`w-full rounded-t-md rounded-b-sm ${m === y.busiestMonth ? 'bg-[#CFE3EA]' : 'bg-white/30'}`}
                      style={{ height: v > 0 ? `${Math.max(6, (v / max) * 100)}%` : '3px' }}
                    />
                  </div>
                ))}
              </div>
              <div className="flex gap-1.5 mt-1.5">
                {MONTH_SHORT.map((m, i) => (
                  <span key={m} className={`flex-1 text-center text-[10px] font-semibold ${i === y.busiestMonth ? '' : 'text-denim-mut'}`}>{m[0]}</span>
                ))}
              </div>
            </div>
            <Line>
              {money(y.months[y.busiestMonth])} went out in {MONTH_LONG[y.busiestMonth]}.
              {y.weekendShare !== null && ` ${percent(y.weekendShare)} of the year's spending happened on weekends`}
              {y.busiestWeekday !== null && `, and ${WEEKDAY_LONG[y.busiestWeekday]}s cost the most.`}
            </Line>
          </div>
        ),
      });
    }
    list.push({
      id: 'quiet', shade: 'sand', title: `${y.noSpendDays} days without spending`,
      body: (
        <div className="flex flex-col gap-5">
          <Mascot pose="think" height={140} className="self-end -mb-2" />
          <p className="font-display font-extrabold text-[84px] leading-none tabular-nums">{y.noSpendDays.toLocaleString('en-IN')}</p>
          <Big className="text-[28px]">{y.noSpendDays === 1 ? 'day' : 'days'} without spending</Big>
          <Line>Between {shortDay(y.from, y.year)} and {shortDay(y.to, y.year)}, the days your entries cover.</Line>
          {y.quietest && (
            <div className="wallet-pocket rounded-2xl px-4 py-3">
              <p className="text-[12px] font-medium text-denim-mut">Longest quiet stretch</p>
              <p className="text-[18px] font-semibold mt-0.5">
                {y.quietest.days} {y.quietest.days === 1 ? 'day' : 'days'}, {shortDay(y.quietest.from, y.year)}{y.quietest.days > 1 ? ` to ${shortDay(y.quietest.to, y.year)}` : ''}
              </p>
            </div>
          )}
        </div>
      ),
    });
    if (y.biggest) {
      list.push({
        id: 'biggest', shade: 'rose', title: 'Your biggest purchase',
        body: (
          <div className="flex flex-col gap-4 pt-6">
            <p className="text-[15px] font-medium text-denim-mut">Your biggest purchase</p>
            <p className="wallet-emboss font-display font-extrabold text-[52px] leading-none tabular-nums break-words">{money(y.biggest.amount)}</p>
            <Big className="text-[26px]">{y.biggest.name}</Big>
            <Line>{shortDay(y.biggest.date, y.year)}</Line>
          </div>
        ),
      });
    }
    list.push({ id: 'card', shade: 'sage', title: 'Your card to share', body: null });
    return list;
  }, [y, money, kept, yearWord]);

  const last = slides.length - 1;
  const go = (to: number) => setIndex(Math.max(0, Math.min(last, to)));
  useBackHandler(true, onClose);
  useEffect(() => {
    dialogRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') setIndex(i => Math.min(last, i + 1));
      else if (e.key === 'ArrowLeft') setIndex(i => Math.max(0, i - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [last, onClose]);

  // The card: drawn when the last slide opens, again when amounts are switched.
  const onCard = slides[index]?.id === 'card';
  useEffect(() => {
    if (!onCard) return;
    let gone = false;
    const canvas = canvasRef.current ?? (canvasRef.current = document.createElement('canvas'));
    drawWrappedCard(canvas, {
      year: y, money, showAmounts,
      mascot: mascotImage(kept ? 'celebrate' : 'encourage'),
      wordmarkSvg, host: SITE_HOST,
    })
      .then(() => { if (!gone) setCard(canvas.toDataURL('image/png')); })
      .catch(e => { log.warn('Wrapped card failed', e?.message); if (!gone) setNote("Couldn't draw the card. Try again."); });
    return () => { gone = true; };
  }, [onCard, showAmounts, y, money, kept]);

  const share = async () => {
    if (!card || sharing) return;
    setSharing(true);
    try {
      const outcome = await exportImage(`wall-ette-wrapped-${y.year}.png`, card.split(',')[1]);
      setNote(outcome === 'shared' ? null : 'Card downloaded.');
    } catch {
      setNote("Couldn't share the card. Try again.");
    } finally {
      setSharing(false);
    }
  };

  // Tap the left third for the slide before, anywhere else for the next.
  const onTap = (e: React.MouseEvent<HTMLDivElement>) => {
    if (onCard) return;
    const box = e.currentTarget.getBoundingClientRect();
    go(e.clientX - box.left < box.width / 3 ? index - 1 : index + 1);
  };

  const slide = slides[index];
  return createPortal(
    <div className="fixed inset-0 z-[120] bg-black/70 flex items-stretch md:items-center justify-center">
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={`Wall·ette Wrapped ${yearWord}`}
        className="wallet relative w-full md:max-w-[420px] md:h-[min(860px,92vh)] md:rounded-[30px] overflow-hidden flex flex-col outline-none"
        style={SHADES[slide.shade] as React.CSSProperties}
      >
        {/* Progress and close */}
        <div className="relative z-10 px-4 pt-[calc(var(--sat)_+_14px)] md:pt-4">
          <div className="flex gap-1" aria-hidden="true">
            {slides.map((s, i) => (
              <span key={s.id} className={`h-1 flex-1 rounded-full ${i <= index ? 'bg-white/90' : 'bg-white/25'}`} />
            ))}
          </div>
          <div className="flex items-center justify-between mt-3">
            <p className="text-[12px] font-semibold text-denim-mut">Wrapped {yearWord} · {index + 1} of {slides.length}</p>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => go(index - 1)} disabled={index === 0} className="sr-only focus:not-sr-only focus:px-2 focus:py-1 rounded-lg bg-black/20 text-[12px]">Previous</button>
              <button type="button" onClick={() => go(index + 1)} disabled={index === last} className="sr-only focus:not-sr-only focus:px-2 focus:py-1 rounded-lg bg-black/20 text-[12px]">Next</button>
              <button type="button" onClick={onClose} aria-label="Close Wrapped" className="w-9 h-9 rounded-full bg-black/20 flex items-center justify-center">
                <span className="material-symbols-outlined text-[20px]" aria-hidden="true">close</span>
              </button>
            </div>
          </div>
        </div>

        {/* The slide */}
        <div className="relative z-10 flex-1 min-h-0 px-6 pb-[calc(var(--sab)_+_20px)] md:pb-6 overflow-y-auto" onClick={onTap}>
          <div key={slide.id} className="motion-safe:animate-tab-in h-full flex flex-col" aria-live="polite">
            {slide.id !== 'card' ? (
              <>
                <div className="flex-1 flex flex-col justify-center py-4">{slide.body}</div>
                {index === 0 && (
                  <p className="text-center text-[13px] text-denim-mut pb-2 flex items-center justify-center gap-1">
                    Tap to continue <span className="material-symbols-outlined text-[18px]" aria-hidden="true">chevron_right</span>
                  </p>
                )}
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center gap-4 py-3">
                <h2 className="sr-only">Your card to share</h2>
                <div className="flex-1 min-h-0 w-full flex items-center justify-center">
                  {card ? (
                    <img src={card} alt={`Your Wrapped card for ${yearWord}`} className="max-h-full max-w-full rounded-2xl shadow-raised object-contain" />
                  ) : (
                    <p className="text-denim-mut text-[14px]" role="status">Drawing your card…</p>
                  )}
                </div>
                <label className="flex items-center justify-between gap-3 w-full wallet-pocket rounded-2xl px-4 py-3 cursor-pointer">
                  <span className="min-w-0">
                    <span className="block text-[14px] font-semibold" id="wrapped-amounts-label">Show amounts on the card</span>
                    <span className="block text-[12px] text-denim-mut">Off, it shows shares and days only. Payees are never on it.</span>
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={showAmounts}
                    aria-labelledby="wrapped-amounts-label"
                    onClick={() => setShowAmounts(v => !v)}
                    className={`relative w-11 h-6 rounded-full shrink-0 transition-colors ${showAmounts ? 'bg-[#C9D8A8]' : 'bg-black/30'}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${showAmounts ? 'translate-x-5' : ''}`} />
                  </button>
                </label>
                <div className="grid grid-cols-2 gap-3 w-full">
                  <button type="button" onClick={() => go(0)} className="py-3.5 rounded-2xl bg-black/20 text-[15px] font-semibold">Watch again</button>
                  <button type="button" onClick={() => { void share(); }} disabled={!card || sharing} className="py-3.5 rounded-2xl bg-[#FBFAF6] text-[#3E5430] text-[15px] font-semibold disabled:opacity-60 flex items-center justify-center gap-2">
                    <span className="material-symbols-outlined text-[18px]" aria-hidden="true">ios_share</span>
                    {sharing ? 'Opening…' : 'Share card'}
                  </button>
                </div>
                {note && <p role="status" className="text-[13px] text-denim-mut">{note}</p>}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default WrappedStory;
