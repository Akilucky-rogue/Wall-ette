/**
 * The one plans sheet (components/PlansSheet.tsx), opened from any lock or
 * from Self → Your plan, and shown by components/PlansHost.tsx at the top of
 * the app so it outlives the lock that opened it: choosing a plan opens the
 * page underneath, and the sheet stays to say so.
 */
import { useSyncExternalStore } from 'react';
import type { LockReason } from '../components/PlanLock';

let open: { reason: LockReason | null } | null = null;
const subscribers = new Set<() => void>();
const set = (v: typeof open) => { open = v; subscribers.forEach(fn => fn()); };

export const openPlans = (reason: LockReason | null = null): void => set({ reason });
export const closePlans = (): void => set(null);

export function usePlansOpen(): { reason: LockReason | null } | null {
  return useSyncExternalStore(
    fn => { subscribers.add(fn); return () => { subscribers.delete(fn); }; },
    () => open,
  );
}
