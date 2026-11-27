/**
 * Reads the security log: one entry per lock-screen attempt, written by
 * components/SecurityLock.tsx (time, method, success). The bell on Home uses
 * the recent ones to tell you about failed unlock attempts. Only the owner
 * can read their log (firestore.rules), and account deletion erases it.
 */
import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore';
import { db } from './firebase';
import type { UnlockEvent } from './notifications';

/** The latest attempts, newest first. Entries still waiting for their server time are left out. */
export async function recentUnlocks(uid: string, max = 30): Promise<UnlockEvent[]> {
  const snap = await getDocs(query(collection(db, `users/${uid}/security_logs`), orderBy('timestamp', 'desc'), limit(max)));
  const events: UnlockEvent[] = [];
  snap.forEach(entry => {
    const data = entry.data();
    const at: unknown = data.timestamp?.toDate?.();
    if (!(at instanceof Date)) return;
    if (data.type !== 'UNLOCK_SUCCESS' && data.type !== 'UNLOCK_FAILURE') return;
    events.push({ at, ok: data.type === 'UNLOCK_SUCCESS', method: typeof data.method === 'string' ? data.method : undefined });
  });
  return events;
}
