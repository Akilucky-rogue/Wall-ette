/**
 * Named moments in a performance trace (Chrome DevTools → Performance, or
 * `performance.getEntriesByType('measure')`), such as how long a wallet takes
 * to arrive after signing in. Marks hold no personal data, cost next to
 * nothing, and do nothing where the browser has no User Timing.
 */
export function markTiming(name: string, since?: string): void {
  try {
    performance.mark(name);
    if (since && performance.getEntriesByName(since, 'mark').length > 0) {
      performance.measure(`${since} → ${name}`, since, name);
    }
  } catch { /* no User Timing here */ }
}
