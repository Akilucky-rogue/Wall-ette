/**
 * Posts the phone notifications planned in services/phoneNotifications.ts,
 * through @capacitor/local-notifications. Android only; on the web every call
 * does nothing.
 *
 * Reminders use inexact alarms (`isExactNotification: false`): a bill
 * reminder a few minutes late is fine, and Wall-ette doesn't ask for the
 * "Alarms & reminders" permission (the app's manifest removes it). They go on
 * one channel, "Bills and budgets", hidden on a locked screen.
 */
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import type { AppScreen } from '../types';
import type { ScreenSection } from '../utils/screenSection';
import type { PhoneNote } from './phoneNotifications';
import { log } from '../utils/log';

const CHANNEL = 'bills-budgets';
/** Drawable in android/app/src/main/res/drawable: a white wallet. */
const SMALL_ICON = 'ic_stat_wallette';
const ICON_COLOR = '#7D937A';

const native = (): boolean => Capacitor.isNativePlatform();

export type PhonePermission = 'granted' | 'denied' | 'prompt' | 'unavailable';

/** Whether Android lets Wall-ette post notifications. */
export async function phonePermission(): Promise<PhonePermission> {
  if (!native()) return 'unavailable';
  try {
    const { display } = await LocalNotifications.checkPermissions();
    return display === 'granted' ? 'granted' : display === 'denied' ? 'denied' : 'prompt';
  } catch {
    return 'unavailable';
  }
}

/** Asks Android 13+ for permission (earlier versions allow it). True when allowed. */
export async function askPhonePermission(): Promise<boolean> {
  if (!native()) return false;
  try {
    if ((await LocalNotifications.checkPermissions()).display === 'granted') return true;
    return (await LocalNotifications.requestPermissions()).display === 'granted';
  } catch (e) {
    log.warn('Notification permission request failed', e);
    return false;
  }
}

let channelReady = false;
async function ensureChannel(): Promise<void> {
  if (channelReady) return;
  await LocalNotifications.createChannel({
    id: CHANNEL,
    name: 'Bills and budgets',
    description: 'Bills due soon, budgets running out and your daily limit',
    importance: 3,
    visibility: 0, // private: the lock screen shows that there is one, not what it says
  });
  channelReady = true;
}

/**
 * Replaces the waiting bill reminders with `bills` and shows `alerts` now.
 * Does nothing without permission (it never asks from here).
 */
export async function postPhoneNotes(bills: PhoneNote[], alerts: PhoneNote[]): Promise<boolean> {
  if (!native()) return false;
  try {
    if ((await LocalNotifications.checkPermissions()).display !== 'granted') return false;
    await ensureChannel();
    const { notifications: pending } = await LocalNotifications.getPending();
    const stale = pending.filter(n => n.extra?.kind === 'bill');
    if (stale.length) await LocalNotifications.cancel({ notifications: stale.map(n => ({ id: n.id })) });
    const list = [...bills, ...alerts].map(n => ({
      id: n.id,
      title: n.title,
      body: n.body,
      largeBody: n.body,
      schedule: n.at ? { at: n.at, allowWhileIdle: true } : undefined,
      channelId: CHANNEL,
      smallIcon: SMALL_ICON,
      iconColor: ICON_COLOR,
      autoCancel: true,
      isExactNotification: false,
      extra: { kind: n.kind, screen: n.screen, section: n.section ?? null },
    }));
    if (list.length) await LocalNotifications.schedule({ notifications: list });
    return true;
  } catch (e) {
    log.warn('Could not post phone notifications', e);
    return false;
  }
}

/** Takes back every waiting reminder and clears shown ones: switching off, signing out. */
export async function clearPhoneNotes(): Promise<void> {
  if (!native()) return;
  try {
    const { notifications } = await LocalNotifications.getPending();
    if (notifications.length) await LocalNotifications.cancel({ notifications: notifications.map(n => ({ id: n.id })) });
    await LocalNotifications.removeAllDeliveredNotifications();
  } catch (e) {
    log.warn('Could not clear phone notifications', e);
  }
}

/** Calls `open` with the screen a tapped notification points to. Returns a remover. */
export function onPhoneNoteTap(open: (screen: AppScreen, section?: ScreenSection) => void): () => void {
  if (!native()) return () => {};
  const handle = LocalNotifications.addListener('localNotificationActionPerformed', action => {
    const extra = action.notification?.extra;
    if (extra?.screen) open(extra.screen as AppScreen, (extra.section ?? undefined) as ScreenSection | undefined);
  });
  return () => { void handle.then(h => h.remove()); };
}
