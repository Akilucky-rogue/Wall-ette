/**
 * Google Play in-app updates (Android builds installed from Play).
 *
 * checkForUpdate() runs whenever the main screen appears, at start-up and
 * after every unlock (components/AppUpdates.tsx):
 * 1. Ask Play for update info. Debug builds, sideloaded APKs, phones without
 *    Play and offline phones fail here, and nothing happens.
 * 2. A finished download → offer "Restart" to install it; if the update is
 *    required, block the app until that restart.
 * 3. A required update → Google's full-screen update; if the user backs out,
 *    a screen that blocks the app until they update. Required means this
 *    build's versionCode is below `androidMinVersionCode` in the Firestore
 *    document config/app, or the release has in-app update priority 4–5.
 *    It only blocks when Play actually offers an update, so a minimum set
 *    too early (before the release reaches everyone) can't lock anyone out.
 * 4. Any other update → Google's dialog; it downloads in the background while
 *    the app stays usable. "No thanks" keeps that version quiet for 3 days.
 *
 * The state lives here rather than in React: the main screen unmounts each
 * time the app locks, but a download, or a required update the user backed
 * out of, carries on.
 */
import { Capacitor } from '@capacitor/core';
import { AppUpdate, AppUpdateResultCode, FlexibleUpdateInstallStatus } from '@capawesome/capacitor-app-update';
import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';
import { log } from '../utils/log';
import { needsMinimum, planUpdate, UpdateAvailability, type DeclinedUpdate } from './appUpdatePolicy';

export type UpdatePhase = 'idle' | 'downloading' | 'ready' | 'installing' | 'required';

export interface UpdateState {
  phase: UpdatePhase;
  /**
   * For `required`: the button runs Google's update (`play`), opens the store
   * page when that can't start (`store`), or installs a finished download (`restart`).
   */
  requiredVia: 'play' | 'store' | 'restart';
  /** Google's update screen is opening. */
  busy: boolean;
  error: string | null;
  /** The "Restart" banner was closed; it comes back at the next start-up. */
  bannerClosed: boolean;
}

let state: UpdateState = {
  phase: 'idle',
  requiredVia: 'play',
  busy: false,
  error: null,
  bannerClosed: false,
};
const subscribers = new Set<() => void>();

function set(patch: Partial<UpdateState>): void {
  state = { ...state, ...patch };
  subscribers.forEach(fn => fn());
}

/** For useSyncExternalStore. */
export function subscribe(fn: () => void): () => void {
  subscribers.add(fn);
  return () => { subscribers.delete(fn); };
}

export function getUpdateState(): UpdateState {
  return state;
}

/** In-app updates exist only on Android (Google Play). */
export const updatesSupported = (): boolean => Capacitor.getPlatform() === 'android';

const DECLINED_KEY = 'walletUpdateDeclined';
const CONFIG_TTL_MS = 10 * 60 * 1000;

let running: Promise<void> | null = null;
let listening = false;
/** The user backed out of a required update this session: show the blocking screen instead of reopening Google's. */
let leftRequiredUpdate = false;
let minimumCache: { value: number; at: number } | null = null;

export function checkForUpdate(): Promise<void> {
  if (!updatesSupported()) return Promise.resolve();
  if (!running) running = check().finally(() => { running = null; });
  return running;
}

async function check(): Promise<void> {
  let info;
  try {
    info = await AppUpdate.getAppUpdateInfo();
  } catch (e) {
    log.debug('Play update info unavailable', e);
    return;
  }

  const availability = info.updateAvailability;
  const installStatus = info.installStatus ?? FlexibleUpdateInstallStatus.UNKNOWN;
  const availableVersionCode = Number(info.availableVersionCode) || 0;
  const plan = planUpdate({
    availability,
    installStatus,
    currentVersionCode: Number(info.currentVersionCode) || 0,
    availableVersionCode,
    immediateAllowed: info.immediateUpdateAllowed === true,
    flexibleAllowed: info.flexibleUpdateAllowed === true,
    priority: info.updatePriority ?? 0,
    minVersionCode: needsMinimum(availability, installStatus) ? await minimumVersionCode() : 0,
    declined: readDeclined(),
    now: Date.now(),
  });

  switch (plan) {
    case 'ready':
      set({ phase: 'ready' });
      return;
    case 'ready-required':
      set({ phase: 'required', requiredVia: 'restart' });
      return;
    case 'immediate':
      if (leftRequiredUpdate) set({ phase: 'required', requiredVia: 'play' });
      else await runRequiredUpdate();
      return;
    case 'required-store':
      set({ phase: 'required', requiredVia: 'store' });
      return;
    case 'flexible':
      await offerUpdate(availableVersionCode);
      return;
    case 'none':
      // Required no longer applies (the minimum went down, say).
      if (state.phase === 'required') set({ phase: 'idle' });
      return;
  }
}

/** Google's full-screen update. Play restarts the app once it installs. */
async function runRequiredUpdate(): Promise<void> {
  set({ phase: 'required', requiredVia: 'play', busy: true, error: null });
  try {
    const { code } = await AppUpdate.performImmediateUpdate();
    if (code !== AppUpdateResultCode.OK) leftRequiredUpdate = true;
  } catch (e) {
    leftRequiredUpdate = true;
    log.warn('Required update did not start', e);
  } finally {
    set({ busy: false });
  }
}

/** The button on the blocking screen. */
export async function updateNow(): Promise<void> {
  if (state.busy) return;
  if (state.requiredVia === 'restart') {
    set({ busy: true, error: null });
    try {
      await AppUpdate.completeFlexibleUpdate();
    } catch (e) {
      log.warn('Installing the update failed', e);
      set({ error: "Couldn't install it. Free up some space, then try again." });
    } finally {
      set({ busy: false });
    }
    return;
  }
  if (state.requiredVia === 'play') {
    try {
      // The plugin needs fresh info before every update flow.
      const info = await AppUpdate.getAppUpdateInfo();
      if (info.updateAvailability === UpdateAvailability.AVAILABLE && info.immediateUpdateAllowed) {
        await runRequiredUpdate();
        return;
      }
    } catch (e) {
      log.warn('Play update info unavailable', e);
    }
  }
  try {
    set({ error: null });
    await AppUpdate.openAppStore();
  } catch (e) {
    log.warn('Could not open Google Play', e);
    set({ error: "Couldn't open Google Play. Open it yourself and update Wall-ette there." });
  }
}

/** Google's flexible dialog: "Update" downloads in the background. */
async function offerUpdate(availableVersionCode: number): Promise<void> {
  await listenForDownload();
  try {
    const { code } = await AppUpdate.startFlexibleUpdate();
    if (code === AppUpdateResultCode.OK) {
      if (state.phase === 'idle') set({ phase: 'downloading' });
    } else if (code === AppUpdateResultCode.CANCELED) {
      writeDeclined(availableVersionCode);
    }
  } catch (e) {
    log.warn('Update dialog did not open', e);
  }
}

async function listenForDownload(): Promise<void> {
  if (listening) return;
  listening = true;
  try {
    await AppUpdate.addListener('onFlexibleUpdateStateChange', ({ installStatus }) => {
      switch (installStatus) {
        case FlexibleUpdateInstallStatus.DOWNLOADING:
          if (state.phase === 'idle') set({ phase: 'downloading' });
          break;
        case FlexibleUpdateInstallStatus.DOWNLOADED:
          // Became required while downloading: keep blocking, now with a restart.
          if (state.phase === 'required') set({ requiredVia: 'restart' });
          else set({ phase: 'ready', bannerClosed: false });
          break;
        case FlexibleUpdateInstallStatus.FAILED:
        case FlexibleUpdateInstallStatus.CANCELED:
          set({ phase: 'idle' });
          break;
      }
    });
  } catch (e) {
    listening = false;
    log.warn('Update download events unavailable', e);
  }
}

/** "Restart" on the banner: Play installs the download and reopens the app. */
export async function restartToUpdate(): Promise<void> {
  if (state.phase !== 'ready') return;
  set({ phase: 'installing', error: null });
  try {
    await AppUpdate.completeFlexibleUpdate();
  } catch (e) {
    log.warn('Installing the update failed', e);
    set({ phase: 'ready', error: "Couldn't install it. Free up some space, then try again." });
  }
}

export function closeBanner(): void {
  set({ bannerClosed: true });
}

/** `androidMinVersionCode` from config/app; 0 when it's missing, unreadable or offline. */
async function minimumVersionCode(): Promise<number> {
  if (minimumCache && Date.now() - minimumCache.at < CONFIG_TTL_MS) return minimumCache.value;
  let value = 0;
  try {
    const snap = await getDoc(doc(db, 'config', 'app'));
    const v: unknown = snap.get('androidMinVersionCode');
    if (typeof v === 'number' && Number.isFinite(v)) value = v;
  } catch (e) {
    // Offline, or the config/app rule isn't deployed yet.
    log.debug('App config unavailable', e);
  }
  minimumCache = { value, at: Date.now() };
  return value;
}

function readDeclined(): DeclinedUpdate | null {
  try {
    const raw = localStorage.getItem(DECLINED_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as Partial<DeclinedUpdate>;
    return typeof d.code === 'number' && typeof d.at === 'number' ? { code: d.code, at: d.at } : null;
  } catch {
    return null;
  }
}

function writeDeclined(code: number): void {
  try {
    localStorage.setItem(DECLINED_KEY, JSON.stringify({ code, at: Date.now() }));
  } catch { /* storage unavailable */ }
}
