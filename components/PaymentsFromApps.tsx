import React, { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { App as CapacitorApp } from '@capacitor/app';
import { AppScreen } from '../types';
import { PAYMENT_APPS, type PaymentApp } from '../services/paymentAlerts';
import {
  openAccessSettings, readerConnected, readerStatus, readerSupported, reconnectReader, setReaderOn, type ReaderStatus,
} from '../services/paymentAlertsBridge';
import { askFirst, getInbox, openToCheck, setAskFirst, subscribeInbox } from '../services/paymentInbox';
import { useBackHandler } from '../utils/backStack';
import { tick } from '../utils/haptics';
import PageHeader from './ui/PageHeader';
import PlanLock from './PlanLock';
import { usePlan } from '../services/plan';
import { canAdd } from '../services/planRules';

interface PaymentsFromAppsProps {
  onNavigate: (screen: AppScreen) => void;
}

const Toggle: React.FC<{ checked: boolean; onChange: () => void; label: string; disabled?: boolean }> = ({ checked, onChange, label, disabled }) => (
  <label className={`relative inline-flex items-center ${disabled ? 'opacity-50' : 'cursor-pointer'}`}>
    <input type="checkbox" className="sr-only peer" checked={checked} disabled={disabled} onChange={() => { tick(); onChange(); }} aria-label={label} />
    <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-sage"></div>
  </label>
);

const Card: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="bg-white rounded-3xl shadow-soft border border-black/[0.02] overflow-hidden divide-y divide-premium-charcoal/[0.06]">{children}</div>
);

const PAYMENT_APP_NAMES = 'Google Pay, PhonePe, Paytm, BHIM';

/** What is read and what isn't: shown before turning it on, and on the screen. */
const WhatItReads: React.FC = () => (
  <ul className="space-y-2.5">
    {[
      ['visibility', `It reads the payment notifications of ${PAYMENT_APP_NAMES} and the bank apps listed here: the amount, who it was with, the time and the last digits of an account. It works when Wall-ette is closed too.`],
      ['block', "It doesn't read any other app's notifications: not your messages, chats or emails, and never one-time passwords."],
      ['smartphone', 'The notification text is processed on this device and deleted once read. Payments it adds are saved to your wallet, like entries you type.'],
      ['toggle_off', "Turn it off here at any time, or remove Wall-ette's notification access in Android's settings."],
    ].map(([icon, text]) => (
      <li key={icon} className="flex gap-3 text-[13px] text-premium-charcoal leading-relaxed">
        <span className="material-symbols-outlined text-[18px] text-sage shrink-0 mt-0.5" aria-hidden="true">{icon}</span>
        <span>{text}</span>
      </li>
    ))}
  </ul>
);

/**
 * Asked before Android's notification access screen (Play's prominent
 * disclosure): what is read and why, and the person's choice.
 */
const Disclosure: React.FC<{ onContinue: () => void; onClose: () => void }> = ({ onContinue, onClose }) => {
  useBackHandler(true, onClose);
  return createPortal(
    <div className="fixed inset-0 bg-black/50 flex items-end md:items-center justify-center z-[100]" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="reader-disclosure-title"
        className="bg-white w-full max-w-[430px] rounded-t-[32px] md:rounded-[32px] px-6 pt-6 pb-[calc(1.5rem_+_var(--sab))] animate-slide-up max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="w-11 h-11 rounded-2xl bg-ocean-light flex items-center justify-center mb-3">
          <span className="material-symbols-outlined text-ocean text-[24px]" aria-hidden="true">bolt</span>
        </div>
        <h3 id="reader-disclosure-title" className="text-lg font-display font-bold text-premium-charcoal mb-1">Let Wall-ette read payment notifications?</h3>
        <p className="text-[13px] text-muted-taupe leading-relaxed mb-4">
          So each payment you make or receive is added to your wallet for you, without typing it in.
        </p>
        <WhatItReads />
        <button onClick={onContinue} className="mt-6 w-full bg-sage text-white py-3.5 rounded-2xl font-semibold shadow-soft active:scale-[0.98] transition-all">
          Continue
        </button>
        <button onClick={onClose} className="mt-2 w-full py-3 rounded-2xl text-[14px] font-semibold text-premium-charcoal">
          Not now
        </button>
        <p className="text-center text-[11px] text-muted-taupe mt-2">Next, Android asks you to allow notification access for Wall-ette.</p>
      </div>
    </div>,
    document.body,
  );
};

/**
 * Self → Your data → Payments from your apps (Android): turning the reader
 * on (after the disclosure) and off, whether it's connected, Ask me first,
 * the payments waiting for a tap, and the apps it reads.
 */
const PaymentsFromApps: React.FC<PaymentsFromAppsProps> = ({ onNavigate }) => {
  const supported = readerSupported();
  const adding = canAdd(usePlan().access);
  const [status, setStatus] = useState<ReaderStatus | null>(null);
  const [disclosure, setDisclosure] = useState(false);
  const [ask, setAsk] = useState(askFirst);
  const [busy, setBusy] = useState(false);
  const { toCheck } = useSyncExternalStore(subscribeInbox, getInbox);

  const refresh = useCallback(async () => { setStatus(await readerStatus()); }, []);

  useEffect(() => {
    if (!supported) return;
    void refresh();
    // Back from Android's settings: read the state again.
    const handle = CapacitorApp.addListener('resume', () => { void refresh(); });
    const onVisible = () => { if (document.visibilityState === 'visible') void refresh(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      void handle.then(h => h.remove()).catch(() => {});
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [supported, refresh]);

  const turnOn = async () => {
    setDisclosure(false);
    setBusy(true);
    try {
      await setReaderOn(true);
      const s = await readerStatus();
      setStatus(s);
      if (!s.access) await openAccessSettings();
    } finally {
      setBusy(false);
    }
  };
  const turnOff = async () => {
    setBusy(true);
    try {
      await setReaderOn(false);
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const on = !!status?.on;
  const connected = !!status && readerConnected(status);
  const state: { tone: 'sage' | 'rose' | 'muted'; text: string } | null = !status ? null
    : !status.on ? { tone: 'muted', text: status.access ? "Off. Wall-ette still has notification access in Android's settings; you can remove it there." : 'Off.' }
    : !status.access ? { tone: 'rose', text: "Waiting for notification access. Allow it for Wall-ette in Android's settings." }
    : connected ? { tone: 'sage', text: 'On. Payments from these apps are added for you.' }
    : { tone: 'rose', text: 'Not connected. Your phone may have stopped it to save battery.' };

  const installed = new Set(status?.installed ?? []);
  const isHere = (a: PaymentApp) => a.packages.some(p => installed.has(p));
  const appRow = (a: PaymentApp) => {
    const here = isHere(a);
    return (
      <li key={a.id} className="flex items-center justify-between gap-3 px-4 py-3">
        <span className="text-[14px] text-premium-charcoal">{a.name}</span>
        <span className={`text-[12px] ${here ? 'text-sage font-semibold' : 'text-muted-taupe'}`}>{here ? 'On this phone' : 'Not installed'}</span>
      </li>
    );
  };

  return (
    <div className="relative flex h-auto min-h-screen w-full flex-col max-w-[430px] md:max-w-2xl mx-auto overflow-x-hidden pb-32 lg:pb-12 bg-zen-bg">
      <PageHeader title="Payments from your apps" onBack={() => onNavigate(AppScreen.SELF_DATA)} backLabel="Back to Your data" />

      <div className="px-6 pt-4 pb-4">
        <p className="text-muted-taupe text-[14px] leading-relaxed">
          Wall-ette can read the notifications your payment and bank apps show when money moves, and add each payment for you. Ones it isn't sure about wait for a tap.
        </p>
      </div>

      {!supported ? (
        <section className="px-6">
          <div className="bg-white rounded-3xl shadow-soft border border-black/[0.02] px-5 py-5">
            <p className="text-premium-charcoal text-[15px] font-semibold mb-1">In the Android app</p>
            <p className="text-muted-taupe text-[13px] leading-relaxed">
              Reading payment notifications works in Wall-ette for Android, from version 1.6.0. Here, add payments in New Entry or import a statement.
            </p>
          </div>
        </section>
      ) : (
        <div className="px-6 space-y-4">
          {!adding && <PlanLock reason="payments-paused" compact />}
          <Card>
            <div className="flex items-center justify-between gap-3 px-4 py-3.5">
              <span className="min-w-0">
                <span className="block text-[14px] font-semibold text-premium-charcoal">Read payment notifications</span>
                {state && (
                  <span className={`block text-[12px] leading-snug mt-0.5 ${state.tone === 'sage' ? 'text-sage' : state.tone === 'rose' ? 'text-rose' : 'text-muted-taupe'}`} role="status">
                    {state.text}
                  </span>
                )}
              </span>
              <Toggle checked={on} disabled={!status || busy} onChange={() => { if (on) void turnOff(); else setDisclosure(true); }} label="Read payment notifications" />
            </div>
            {on && status && !status.access && (
              <button onClick={() => { void openAccessSettings(); }} className="w-full px-4 py-3 text-left text-[14px] font-semibold text-sage active:bg-zen-cream">
                Allow notification access
              </button>
            )}
            {on && status?.access && !connected && (
              <div className="px-4 py-3">
                <button onClick={() => { void reconnectReader().then(refresh); }} className="text-[14px] font-semibold text-sage">Reconnect</button>
                <p className="text-[12px] text-muted-taupe leading-snug mt-1">
                  If it keeps stopping, let Wall-ette run in the background: Android's Settings → Apps → Wall-ette → Battery → Unrestricted.
                </p>
              </div>
            )}
            <div className="flex items-center justify-between gap-3 px-4 py-3.5">
              <span className="min-w-0">
                <span className="block text-[14px] font-semibold text-premium-charcoal">Ask me first</span>
                <span className="block text-[12px] text-muted-taupe leading-snug">Every payment waits for a tap, even ones it's sure about</span>
              </span>
              <Toggle checked={ask} onChange={() => { setAskFirst(!ask); setAsk(!ask); }} label="Ask me first" />
            </div>
            <button onClick={() => openToCheck()} className="w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left active:bg-zen-cream">
              <span>
                <span className="block text-[14px] font-semibold text-premium-charcoal">Payments to check</span>
                <span className="block text-[12px] text-muted-taupe">{toCheck.length === 0 ? 'None waiting' : `${toCheck.length} waiting for a tap`}</span>
              </span>
              <span className="material-symbols-outlined text-[20px] text-muted-taupe" aria-hidden="true">chevron_right</span>
            </button>
          </Card>

          {[['Payment apps it reads', PAYMENT_APPS.filter(a => !a.bank)], ['Bank apps it reads', PAYMENT_APPS.filter(a => a.bank)]].map(([title, list]) => (
            <div key={title as string}>
              <h3 className="px-1 mb-2 text-[13px] font-semibold text-premium-charcoal">{title as string}</h3>
              <Card>
                <ul className="divide-y divide-premium-charcoal/[0.06]">
                  {/* The ones on this phone first. */}
                  {[...(list as PaymentApp[])].sort((a, b) => Number(isHere(b)) - Number(isHere(a))).map(appRow)}
                </ul>
              </Card>
            </div>
          ))}

          <div className="bg-white rounded-3xl shadow-soft border border-black/[0.02] px-5 py-5">
            <h3 className="text-[14px] font-semibold text-premium-charcoal mb-3">What it reads</h3>
            <WhatItReads />
          </div>

          <p className="px-1 text-[12px] text-muted-taupe leading-relaxed">
            Some payments only come by SMS, which Wall-ette doesn't read. Share the message to Wall-ette from your messages app (Share → Wall-ette) and it asks whether to add it, or import a statement.
          </p>
          {status?.access && !on && (
            <button onClick={() => { void openAccessSettings(); }} className="px-1 text-[13px] font-semibold text-sage">
              Remove notification access
            </button>
          )}
        </div>
      )}

      {disclosure && <Disclosure onContinue={() => { void turnOn(); }} onClose={() => setDisclosure(false)} />}
    </div>
  );
};

export default PaymentsFromApps;
