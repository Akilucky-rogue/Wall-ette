import { useSyncExternalStore } from 'react';

/**
 * What Pulse shows: the month and Expenses or Income. Shared by Pulse and its
 * pages (Trends, Categories, Recurring, Health check), so a page opens on the
 * month the hub shows and changing it on a page carries back. Held for the
 * app's run; sign-out reloads the app, which starts it over.
 *
 * `month` null follows the newest data: the month of the latest transaction.
 */
export type PulseTab = 'EXPENSE' | 'INCOME';
export interface PulseView { month: Date | null; tab: PulseTab }

let view: PulseView = { month: null, tab: 'EXPENSE' };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(l => l());

export const pulseView = {
  get: (): PulseView => view,
  setMonth(month: Date | null) { view = { ...view, month }; emit(); },
  setTab(tab: PulseTab) { view = { ...view, tab }; emit(); },
  subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
};

export function usePulseView(): PulseView {
  return useSyncExternalStore(pulseView.subscribe, pulseView.get);
}
