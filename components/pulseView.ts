import { useSyncExternalStore } from 'react';

/**
 * The month Pulse shows, shared by Pulse and its pages (Trends, Categories,
 * Recurring, Insights), so a page opens on the month the hub shows and
 * changing it on a page carries back. Held for the app's run; sign-out
 * reloads the app, which starts it over.
 *
 * `month` null follows the newest data: the month of the latest entry (never
 * later than this month).
 */
export interface PulseView { month: Date | null }

let view: PulseView = { month: null };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(l => l());

export const pulseView = {
  get: (): PulseView => view,
  setMonth(month: Date | null) { view = { month }; emit(); },
  subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
};

export function usePulseView(): PulseView {
  return useSyncExternalStore(pulseView.subscribe, pulseView.get);
}
