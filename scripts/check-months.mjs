#!/usr/bin/env node
/**
 * Entries stored by month (services/months.ts, services/monthStore.ts).
 *
 * Checks, on made-up wallets, that:
 *   - every entry is laid out in its own month's document, the same way
 *     every time, and a month too big for one document spills into -2, -3
 *     with each part under the limit
 *   - saving an entry keeps it where it is; a new day in another month moves
 *     it; taking one out finds it, even before the layout knows it; an id in
 *     two documents is read once and taken out of the extra one at its next
 *     change
 *   - the REST format of the old documents reads back as the SDK would
 *     (amounts to the paisa), and UTC-timestamp days become local days
 *   - 20,000 entries read in well under a second
 *
 * With the Firestore emulator (FIRESTORE_EMULATOR_HOST set), also checks the
 * real thing against firestore.rules:
 *   - an entry saved again without a field loses that field (each entry is
 *     replaced whole), and two devices saving different entries of one month
 *     both keep theirs
 *   - taking out an entry from a month with no document yet is accepted
 *   - the move: once settings say 'moving', older versions can't add or
 *     change old entries; every old entry lands in its month to the paisa;
 *     the old documents go; running the move again changes nothing
 *   - nobody else can read or write a wallet's months, and month documents
 *     with odd ids or extra fields are refused
 *
 * Usage (after `npm ci`):
 *   node scripts/check-months.mjs
 *   npx firebase emulators:exec --only firestore --project demo-wallette "node scripts/check-months.mjs"
 *
 * Exits with code 1 if any check fails.
 */
import { build } from 'esbuild'; // installed with Vite
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

process.env.TZ = 'Asia/Kolkata';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// Inside the project, so the bundle finds Firebase in node_modules.
const cache = join(root, 'node_modules', '.cache');
mkdirSync(cache, { recursive: true });
const tmp = mkdtempSync(join(cache, 'wallette-months-'));
const entry = join(tmp, 'entry.ts');
writeFileSync(entry, [
  `export * from ${JSON.stringify(join(root, 'services', 'months.ts'))};`,
  `export * from ${JSON.stringify(join(root, 'services', 'monthStore.ts'))};`,
].join('\n'));
const bundle = join(tmp, 'months.mjs');
// Firebase stays outside the bundle, so the script and the code share one copy.
await build({ entryPoints: [entry], outfile: bundle, bundle: true, platform: 'node', format: 'esm', logLevel: 'error', external: ['firebase/*'] });
const M = await import(pathToFileURL(bundle).href);
rmSync(tmp, { recursive: true, force: true });

let failures = 0;
let checks = 0;
const eq = (label, actual, expected) => {
  checks++;
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a !== e) { failures++; if (failures <= 40) console.log(`  FAIL ${label}: got ${a}, expected ${e}`); }
};
const ok = (label, cond) => {
  checks++;
  if (!cond) { failures++; if (failures <= 40) console.log(`  FAIL ${label}`); }
};

// ── Made-up wallets ──────────────────────────────────────────────────────────
let seed = 7;
const rand = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const pad = n => String(n).padStart(2, '0');
const dayOf = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;
const CATS = ['Groceries', 'Dining', 'Rent', 'Salary', 'Transport', 'Subscriptions'];

function wallet(n, months = 30) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const m = i % months;
    const t = {
      id: i % 3 === 0 ? `import-${(i * 2654435761 >>> 0).toString(16).padStart(8, '0')}${i}` : `entry-${i}`,
      amount: Math.round(rand() * 5_000_000) / 100,
      type: i % 9 === 0 ? 'INCOME' : 'EXPENSE',
      category: CATS[i % CATS.length],
      date: dayOf(2024 + Math.floor((m + 3) / 12), ((m + 3) % 12) + 1, 1 + (i % 28)),
      merchant: `Payee ${i % 37}`,
    };
    if (i % 4 === 0) t.note = `UPI/${100000000000 + i}/Payee ${i % 37}/narration`;
    if (i % 11 === 0) t.account = 'hdfc-bank:1234';
    out.push(t);
  }
  return out;
}

// Entries as their month documents would hold them.
const docsFrom = changes => {
  const docs = new Map();
  for (const c of changes) {
    const d = docs.get(c.docId) ?? {};
    for (const [id, t] of Object.entries(c.set)) d[id] = t;
    for (const id of c.remove) delete d[id];
    docs.set(c.docId, d);
  }
  return [...docs].map(([id, entries]) => ({ id, entries }));
};
const byId = list => [...list].sort((a, b) => (a.id < b.id ? -1 : 1));

// ── Days and document ids ────────────────────────────────────────────────────
eq('monthOf a day', M.monthOf('2026-11-27'), '2026-11');
eq('monthOf a UTC timestamp', M.monthOf('2025-03-01T18:30:00.000Z'), '2025-03');
eq('monthOf nonsense', M.monthOf('soon'), '0000-00');
eq('first part', M.partId('2026-11', 1), '2026-11');
eq('second part', M.partId('2026-11', 2), '2026-11-2');
ok('month ids', ['2026-11', '2026-11-2', '0000-00'].every(id => M.MONTH_DOC_ID.test(id)));
ok('odd ids', ['2026-1', 'november', '2026-11-', '../x'].every(id => !M.MONTH_DOC_ID.test(id)));
ok('reserved ids stay out', !M.storableId('__name__') && !M.storableId('') && M.storableId('entry-1'));

// ── A whole wallet laid out ──────────────────────────────────────────────────
{
  const w = wallet(2700);
  const { changes, layout } = M.layOut(w);
  const docs = docsFrom(changes);
  eq('one document a month', docs.length, 30);
  ok('every document named for its month', docs.every(d => Object.values(d.entries).every(t => M.monthOf(t.date) === d.id)));
  const read = M.readMonths(docs);
  eq('every entry once', read.entries.length, 2700);
  eq('entries read back exactly', byId(read.entries), byId(w));
  ok('every document under the limit', [...layout.sizes.values()].every(s => s <= M.MONTH_DOC_LIMIT));
  eq('laid out the same way again', M.layOut([...w].reverse()).changes.map(c => [c.docId, Object.keys(c.set).sort()]).sort(),
    changes.map(c => [c.docId, Object.keys(c.set).sort()]).sort());
  const average = [...layout.sizes.values()].reduce((a, b) => a + b, 0) / 2700;
  ok(`about 200 bytes an entry (${Math.round(average)})`, average > 100 && average < 400);
}

// ── A month too big for one document ─────────────────────────────────────────
{
  const big = [];
  for (let i = 0; i < 6000; i++) {
    big.push({ id: `big-${i}`, amount: 10 + i, type: 'EXPENSE', category: 'Dining', date: dayOf(2026, 5, 1 + (i % 30)), merchant: `Payee ${i}`, note: 'x'.repeat(200) });
  }
  const { changes, layout } = M.layOut(big);
  const ids = changes.map(c => c.docId).sort();
  ok(`spills into parts (${ids.join(', ')})`, ids.length >= 2 && ids[0] === '2026-05' && ids.includes('2026-05-2'));
  ok('each part under the limit', [...layout.sizes.values()].every(s => s <= M.MONTH_DOC_LIMIT));
  const read = M.readMonths(docsFrom(changes));
  eq('every spilled entry once', read.entries.length, 6000);
  // A new entry goes where there's room, not into a full first part.
  const extra = { id: 'big-new', amount: 1, type: 'EXPENSE', category: 'Dining', date: '2026-05-31', note: 'x'.repeat(200) };
  const [c] = M.planChanges(layout, [extra]);
  ok(`a new entry goes to a part with room (${c.docId})`, c.docId !== '2026-05' && c.docId.startsWith('2026-05'));
}

// ── Changes ──────────────────────────────────────────────────────────────────
{
  const w = wallet(300, 6);
  const { changes, layout } = M.layOut(w);
  let docs = docsFrom(changes);
  const apply = cs => { docs = docsFrom([...docs.map(d => ({ docId: d.id, set: d.entries, remove: [] })), ...cs]); };

  const t = w[10];
  const home = M.monthOf(t.date);
  const same = M.planChanges(layout, [{ ...t, amount: 12.34 }]);
  eq('an edit in the same month stays', same.map(c => [c.docId, Object.keys(c.set), c.remove]), [[home, [t.id], []]]);
  apply(same);

  const moved = { ...t, date: '2027-01-15' };
  const move = M.planChanges(layout, [moved]);
  eq('a new month moves it', move.map(c => [c.docId, Object.keys(c.set), c.remove]).sort(),
    [['2027-01', [t.id], []], [home, [], [t.id]]].sort());
  apply(move);
  let read = M.readMonths(docs);
  eq('moved entry read once, in its new month', read.entries.filter(e => e.id === t.id).map(e => e.date), ['2027-01-15']);

  const gone = M.planChanges(layout, [], [moved]);
  eq('a take-out finds it', gone.map(c => [c.docId, c.remove]), [['2027-01', [t.id]]]);
  apply(gone);
  read = M.readMonths(docs);
  ok('taken out', !read.entries.some(e => e.id === t.id));
  ok('layout forgets it', !layout.docsOf.has(t.id));

  const unknown = M.planChanges(M.emptyLayout(), [], [{ id: 'not-seen', date: '2026-02-03' }]);
  eq('an entry the layout doesn\'t know is taken out of its month', unknown.map(c => [c.docId, c.remove]), [['2026-02', ['not-seen']]]);

  const fresh = { id: 'typed-1', amount: 99, type: 'EXPENSE', category: 'Dining', date: '2026-03-04' };
  eq('a new entry goes to its month', M.planChanges(layout, [fresh]).map(c => c.docId), ['2026-03']);
  eq('saving it again changes the same document', M.planChanges(layout, [{ ...fresh, amount: 100 }]).map(c => c.docId), ['2026-03']);
  eq('set then take out in one change', M.planChanges(layout, [{ id: 'blip', amount: 1, type: 'EXPENSE', category: 'Dining', date: '2026-03-05' }], [{ id: 'blip', date: '2026-03-05' }])
    .map(c => [c.docId, Object.keys(c.set), c.remove]), [['2026-03', [], ['blip']]]);
}

// ── An id in two documents (a move cut short and run again) ─────────────────
{
  const t = { id: 'dup', amount: 5, type: 'EXPENSE', category: 'Dining', date: '2026-04-02' };
  const misplaced = { ...t, amount: 4 };
  const { entries, layout } = M.readMonths([{ id: '2026-03', entries: { dup: misplaced } }, { id: '2026-04', entries: { dup: t } }]);
  eq('read once, from the matching month', entries.map(e => [e.id, e.amount]), [['dup', 5]]);
  eq('whatever order the documents come in', M.readMonths([{ id: '2026-04', entries: { dup: t } }, { id: '2026-03', entries: { dup: misplaced } }]).entries.map(e => e.amount), [5]);
  const parts = [{ id: '2026-04', entries: { dup: { ...t, amount: 6 } } }, { id: '2026-04-2', entries: { dup: t } }];
  eq('two parts of one month: the later part', [M.readMonths(parts).entries[0].amount, M.readMonths([...parts].reverse()).entries[0].amount], [5, 5]);
  eq('layout knows both', layout.docsOf.get('dup'), ['2026-03', '2026-04']);
  const next = M.planChanges(layout, [{ ...t, note: 'lunch' }]);
  eq('next change takes out the extra copy', next.map(c => [c.docId, Object.keys(c.set), c.remove]).sort(),
    [['2026-03', [], ['dup']], ['2026-04', ['dup'], []]].sort());
}

// ── The old documents, in Firestore's REST format ───────────────────────────
{
  const restDoc = {
    name: 'projects/p/databases/(default)/documents/users/u1/transactions/import-abc',
    fields: {
      id: { stringValue: 'import-abc' },
      amount: { doubleValue: 1234.56 },
      type: { stringValue: 'EXPENSE' },
      category: { stringValue: 'Groceries' },
      date: { stringValue: '2025-03-01T18:30:00.000Z' },
      merchant: { stringValue: 'Big Basket' },
      typedAmount: { integerValue: '15' },
      typedCurrency: { stringValue: 'USD' },
      extra: { mapValue: { fields: { a: { booleanValue: true }, b: { nullValue: null } } } },
      list: { arrayValue: { values: [{ stringValue: 'x' }] } },
      at: { timestampValue: '2025-03-02T04:00:00Z' },
    },
    updateTime: '2026-11-27T07:00:00Z',
  };
  const e = M.entryFromRest(restDoc);
  eq('REST entry', e, {
    id: 'import-abc', amount: 1234.56, type: 'EXPENSE', category: 'Groceries', date: '2025-03-01T18:30:00.000Z',
    merchant: 'Big Basket', typedAmount: 15, typedCurrency: 'USD', extra: { a: true, b: null }, list: ['x'], at: '2025-03-02T04:00:00Z',
  });
  eq('the id comes from the document name', M.entryFromRest({ name: 'a/b/transactions/xyz', fields: { id: { stringValue: 'other' } } }).id, 'xyz');
  eq('a UTC midnight becomes its day', M.withLocalDay({ id: 'a', date: '2025-03-01T18:30:00.000Z' }).date, '2025-03-02');
  eq('a local day stays', M.withLocalDay({ id: 'a', date: '2025-03-01' }).date, '2025-03-01');
  const moved = M.layOut([e]);
  eq('moved under its local day\'s month', moved.changes.map(c => c.docId), ['2025-03']);
}

// ── Speed ────────────────────────────────────────────────────────────────────
{
  const w = wallet(20000, 60);
  const { changes } = M.layOut(w);
  const docs = docsFrom(changes);
  const t0 = performance.now();
  const read = M.readMonths(docs);
  const ms = performance.now() - t0;
  ok(`20,000 entries read in ${Math.round(ms)} ms`, ms < 1000 && read.entries.length === 20000);
  const t1 = performance.now();
  M.planChanges(read.layout, wallet(2000, 12).map(t => ({ ...t, id: `n-${t.id}` })));
  const ms2 = performance.now() - t1;
  ok(`a 2,000-row import planned in ${Math.round(ms2)} ms`, ms2 < 500);
}

console.log(`months: ${checks - failures}/${checks} checks passed`);

// ── With the Firestore emulator ─────────────────────────────────────────────
const host = process.env.FIRESTORE_EMULATOR_HOST;
if (host) {
  const [hostname, port] = host.split(':');
  const { initializeApp, deleteApp } = await import('firebase/app');
  const F = await import('firebase/firestore');
  F.setLogLevel('silent'); // the refusals below are on purpose
  const projectId = process.env.GCLOUD_PROJECT || 'demo-wallette';
  const before = checks - failures;

  const client = (uid, name) => {
    const app = initializeApp({ projectId, apiKey: 'demo' }, name);
    const db = F.initializeFirestore(app, {});
    F.connectFirestoreEmulator(db, hostname, Number(port), { mockUserToken: { sub: uid, user_id: uid } });
    return { app, db };
  };
  const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
  const tokenFor = uid => {
    const iat = Math.floor(Date.now() / 1000);
    return `${b64({ alg: 'none', type: 'JWT' })}.${b64({
      iss: `https://securetoken.google.com/${projectId}`, aud: projectId, iat, exp: iat + 3600, auth_time: iat,
      sub: uid, user_id: uid, firebase: { sign_in_provider: 'custom', identities: {} },
    })}.`;
  };
  const rest = uid => ({ projectId, base: `http://${host}/v1`, token: async () => tokenFor(uid) });
  const refused = async (label, p) => {
    try { await p; ok(`${label} (should be refused)`, false); }
    catch (e) { eq(`${label} refused`, e?.code ?? e?.message, 'permission-denied'); }
  };
  const monthEntries = async (db, uid) => {
    const snap = await F.getDocs(F.collection(db, `users/${uid}/months`));
    return M.readMonths(snap.docs.map(d => ({ id: d.id, entries: d.get('entries') })));
  };

  const sortedKeys = o => Object.fromEntries(Object.entries(o ?? {}).sort(([x], [y]) => (x < y ? -1 : 1)));
  // A clean emulator, so the script can run again against one left running.
  await fetch(`http://${host}/emulator/v1/projects/${projectId}/databases/(default)/documents`, { method: 'DELETE' });

  const a = client('u1', 'a');
  const b = client('u1', 'b');
  const other = client('u2', 'other');
  try {
    // Each entry is replaced whole, and devices don't overwrite each other.
    const layoutA = M.emptyLayout();
    await M.saveToMonths(a.db, 'u1', layoutA, [{ id: 'e1', amount: 10, type: 'EXPENSE', category: 'Dining', date: '2026-11-02', note: 'lunch' }]);
    await M.saveToMonths(a.db, 'u1', layoutA, [{ id: 'e1', amount: 11, type: 'EXPENSE', category: 'Dining', date: '2026-11-02' }]);
    let read = await monthEntries(b.db, 'u1');
    eq('saved again without a note, the note is gone', sortedKeys(read.entries.find(e => e.id === 'e1')), sortedKeys({ id: 'e1', amount: 11, type: 'EXPENSE', category: 'Dining', date: '2026-11-02' }));
    await Promise.all([
      M.saveToMonths(a.db, 'u1', layoutA, [{ id: 'e2', amount: 20, type: 'EXPENSE', category: 'Dining', date: '2026-11-03' }]),
      M.saveToMonths(b.db, 'u1', M.emptyLayout(), [{ id: 'e3', amount: 30, type: 'INCOME', category: 'Salary', date: '2026-11-04' }]),
    ]);
    read = await monthEntries(a.db, 'u1');
    eq('two devices, one month, both kept', read.entries.map(e => e.id).sort(), ['e1', 'e2', 'e3']);
    await M.saveToMonths(a.db, 'u1', M.emptyLayout(), [], [{ id: 'nothing', date: '2019-01-01' }]);
    ok('taking out from a month with no document is accepted', true);
    const empty = await F.getDoc(F.doc(a.db, 'users/u1/months/2019-01'));
    ok(`and leaves at most an empty document (${JSON.stringify(empty.data() ?? null)})`, !empty.exists() || Object.keys(empty.get('entries') ?? {}).length === 0);
    await M.saveToMonths(a.db, 'u1', layoutA, [], [{ id: 'e2', date: '2026-11-03' }]);
    read = await monthEntries(b.db, 'u1');
    eq('take-out', read.entries.map(e => e.id).sort(), ['e1', 'e3']);

    // Rules.
    await refused('another user reading', F.getDocs(F.collection(other.db, 'users/u1/months')));
    await refused('another user writing', F.setDoc(F.doc(other.db, 'users/u1/months/2026-11'), { entries: {} }));
    await refused('an odd month id', F.setDoc(F.doc(a.db, 'users/u1/months/november'), { entries: {} }));
    await refused('an extra field', F.setDoc(F.doc(a.db, 'users/u1/months/2026-10'), { entries: {}, other: 1 }));
    await refused('entries that aren\'t a map', F.setDoc(F.doc(a.db, 'users/u1/months/2026-10'), { entries: 'x' }));

    // The move, for a wallet with 400 entries in the old collection.
    const uid = 'mover';
    const m = client(uid, 'm');
    const old = wallet(400, 14).map((t, i) => (i % 50 === 0 ? { ...t, date: `${t.date}T00:00:00.000Z` } : t));
    for (let i = 0; i < old.length; i += 400) {
      const batch = F.writeBatch(m.db);
      old.slice(i, i + 400).forEach(t => batch.set(F.doc(m.db, `users/${uid}/transactions/${t.id}`), t));
      await batch.commit();
    }
    const settings = F.doc(m.db, `users/${uid}/settings/preferences`);
    await F.setDoc(settings, { entriesIn: 'moving' }, { merge: true });
    await refused('an older version adding an entry while moving',
      F.setDoc(F.doc(m.db, `users/${uid}/transactions/late`), { id: 'late', amount: 1, type: 'EXPENSE', category: 'Dining', date: '2026-01-01' }));
    await refused('an older version changing one',
      F.setDoc(F.doc(m.db, `users/${uid}/transactions/${old[1].id}`), { ...old[1], amount: 2 }));
    const moved = await M.moveToMonths(m.db, uid, rest(uid));
    eq('every old entry moved', moved.entries.length, 400);
    eq('old names to delete', moved.oldNames.length, 400);
    await F.setDoc(settings, { entriesIn: 'months' }, { merge: true });
    read = await monthEntries(m.db, uid);
    const expected = byId(old.map(M.withLocalDay));
    eq('moved to the paisa, with local days', byId(read.entries), expected);
    const total = list => Math.round(list.reduce((s, t) => s + (t.type === 'INCOME' ? t.amount : -t.amount), 0) * 100);
    eq('balance to the paisa', total(read.entries), total(old));
    const left = await M.clearOldEntries(m.db, uid, rest(uid), read.layout, moved.oldNames);
    eq('old documents counted', left, 400);
    eq('old collection empty', (await M.listOldEntries(rest(uid), uid)).length, 0);
    const again = await M.moveToMonths(m.db, uid, rest(uid));
    eq('running the move again finds nothing', again.entries.length, 0);
    eq('and changes nothing', byId((await monthEntries(m.db, uid)).entries), expected);
    await refused('an older version adding an entry after the move',
      F.setDoc(F.doc(m.db, `users/${uid}/transactions/later`), { id: 'later', amount: 1, type: 'EXPENSE', category: 'Dining', date: '2026-01-01' }));
    await refused('another user listing old entries', M.listOldEntries(rest('u2'), uid).catch(e => { throw Object.assign(e, { code: e.status === 403 ? 'permission-denied' : e.code }); }));

    // A stray: an old document no read saw is saved to its month before it goes.
    await F.setDoc(settings, { entriesIn: '' }, { merge: true });
    await F.setDoc(F.doc(m.db, `users/${uid}/transactions/stray`), { id: 'stray', amount: 7, type: 'EXPENSE', category: 'Dining', date: '2026-06-06' });
    await F.setDoc(settings, { entriesIn: 'months' }, { merge: true });
    const layoutNow = (await monthEntries(m.db, uid)).layout;
    eq('cleanup finds the stray', await M.clearOldEntries(m.db, uid, rest(uid), layoutNow), 1);
    ok('stray saved to its month', (await monthEntries(m.db, uid)).entries.some(e => e.id === 'stray' && e.date === '2026-06-06'));

    // Clear all / account deletion: every month document goes.
    await M.deleteMonths(m.db, uid, [], true);
    eq('every month document deleted', (await F.getDocs(F.collection(m.db, `users/${uid}/months`))).size, 0);
    await deleteApp(m.app);
  } catch (e) {
    failures++;
    console.log('  FAIL emulator run stopped:', e?.code || e?.message || e);
  } finally {
    await Promise.all([a.app, b.app, other.app].map(app => deleteApp(app).catch(() => {})));
  }
  console.log(`months (emulator): ${checks - failures - before} more checks passed`);
}

if (failures > 0) {
  console.log(`${failures} check(s) failed`);
  process.exit(1);
}
process.exit(0);
