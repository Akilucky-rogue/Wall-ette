#!/usr/bin/env node
/**
 * Android's back button and open panels (utils/backStack.ts).
 *
 * Checks that back closes the newest open sheet, dialog or panel first, one
 * per press, before it moves between screens; that a panel closed some other
 * way (its Close button, a tap outside) no longer takes a press; and that a
 * panel that can't close yet (it is saving) stays open and still takes the
 * press, so back never leaves the screen under it.
 *
 * Usage (after `npm ci`):
 *   node scripts/check-back-button.mjs
 *
 * Exits with code 1 if any check fails.
 */
import { build } from 'esbuild'; // installed with Vite
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tmp = mkdtempSync(join(tmpdir(), 'wallette-back-'));
const bundle = join(tmp, 'back.mjs');
await build({
  entryPoints: [join(root, 'utils', 'backStack.ts')],
  outfile: bundle, bundle: true, platform: 'node', format: 'esm', logLevel: 'error',
});
const { addPanel, closeNewestPanel } = await import(pathToFileURL(bundle).href);
rmSync(tmp, { recursive: true, force: true });

let failures = 0;
let checks = 0;
const eq = (label, actual, expected) => {
  checks++;
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a !== e) { failures++; console.log(`  FAIL ${label}: got ${a}, expected ${e}`); }
};

// A panel as the screens have one: open, and closed by its own close.
const closed = [];
const panel = (name, { busy = () => false } = {}) => {
  const p = { name, open: true };
  p.remove = addPanel(() => {
    if (busy()) return;
    p.open = false;
    closed.push(name);
    p.remove(); // the screen's effect cleanup, once the panel is gone
  });
  return p;
};

// Nothing open: back is for the screens.
eq('nothing open: back moves between screens', closeNewestPanel(), false);

// Notifications, then What's new opened from it: newest first, one per press.
const bell = panel('notifications');
const notes = panel('whats-new');
eq('back closes the newest panel', [closeNewestPanel(), closed], [true, ['whats-new']]);
eq('… then the one under it', [closeNewestPanel(), closed], [true, ['whats-new', 'notifications']]);
eq('… then back is for the screens again', closeNewestPanel(), false);
eq('both panels closed', [bell.open, notes.open], [false, false]);

// Closed another way: its Close button, or a tap outside.
closed.length = 0;
const filters = panel('filters');
const edit = panel('edit-entry');
edit.open = false; edit.remove();
eq('a panel closed by its button takes no press', [closeNewestPanel(), closed], [true, ['filters']]);
eq('removing twice is harmless', (() => { edit.remove(); filters.remove(); return closeNewestPanel(); })(), false);

// Saving: back is taken, nothing closes, the screen stays.
closed.length = 0;
let saving = true;
const save = panel('edit-entry', { busy: () => saving });
eq('a busy panel takes the press and stays open', [closeNewestPanel(), save.open, closed], [true, true, []]);
saving = false;
eq('… and closes once the save is done', [closeNewestPanel(), save.open, closed], [true, false, ['edit-entry']]);
eq('… then back is for the screens', closeNewestPanel(), false);

// A panel closed out of order (the older one) leaves the newer one on top.
closed.length = 0;
const older = panel('currency');
const newer = panel('delete-account');
older.open = false; older.remove();
eq('the newer panel is still on top', [closeNewestPanel(), closed], [true, ['delete-account']]);
eq('… and nothing is left', [closeNewestPanel(), newer.open], [false, false]);

console.log(`${checks - failures}/${checks} checks passed.`);
process.exit(failures > 0 ? 1 : 0);
