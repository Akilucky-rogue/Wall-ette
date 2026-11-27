/**
 * The Android side of payments from your apps and Share to Wall-ette
 * (android/…/PaymentAlertsPlugin.java). Android only: on the web and iOS
 * every call does nothing and the reader reads as unsupported.
 */
import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import type { Notice } from './paymentAlerts';

export interface ReaderStatus {
  /** This is the Android app, and it has the reader. */
  supported: boolean;
  /** Android's notification access is allowed for Wall-ette. */
  access: boolean;
  /** The person has "Payments from your apps" on. */
  on: boolean;
  /** When Android last connected and cut off the listener (ms; 0 never). */
  connectedAt: number;
  disconnectedAt: number;
  /** Notifications kept and not read yet. */
  pending: number;
  /** The packages of the apps it reads that are on this phone. */
  installed: string[];
}

interface PaymentAlertsPlugin {
  status(): Promise<Omit<ReaderStatus, 'supported'>>;
  setOn(options: { on: boolean }): Promise<void>;
  openAccessSettings(): Promise<void>;
  reconnect(): Promise<void>;
  pending(): Promise<{ notices: Notice[] }>;
  acknowledge(options: { ids: string[] }): Promise<void>;
  takeShared(): Promise<{ text?: string }>;
  addListener(event: 'notice' | 'shared', listener: () => void): Promise<PluginListenerHandle>;
}

const Native = registerPlugin<PaymentAlertsPlugin>('PaymentAlerts');

/** The Android app with the reader (1.6.0 and later). */
export const readerSupported = (): boolean =>
  Capacitor.getPlatform() === 'android' && Capacitor.isPluginAvailable('PaymentAlerts');

const OFF: ReaderStatus = { supported: false, access: false, on: false, connectedAt: 0, disconnectedAt: 0, pending: 0, installed: [] };

export async function readerStatus(): Promise<ReaderStatus> {
  if (!readerSupported()) return OFF;
  try {
    const s = await Native.status();
    return { ...OFF, ...s, supported: true, installed: Array.isArray(s.installed) ? s.installed : [] };
  } catch {
    return { ...OFF, supported: true };
  }
}

/**
 * Whether the listener is connected: allowed, and Android connected it after
 * it last cut it off. Android connects it a moment after access is allowed,
 * so a listener never connected yet counts as connected.
 */
export const readerConnected = (s: ReaderStatus): boolean =>
  s.access && (s.connectedAt === 0 || s.connectedAt >= s.disconnectedAt);

export const setReaderOn = async (on: boolean): Promise<void> => {
  if (readerSupported()) await Native.setOn({ on });
};

export const openAccessSettings = async (): Promise<void> => {
  if (readerSupported()) await Native.openAccessSettings();
};

export const reconnectReader = async (): Promise<void> => {
  if (readerSupported()) await Native.reconnect();
};

export async function pendingNotices(): Promise<Notice[]> {
  if (!readerSupported()) return [];
  try {
    const { notices } = await Native.pending();
    return Array.isArray(notices) ? notices.filter(n => n && typeof n.id === 'string' && typeof n.pkg === 'string' && Number.isFinite(n.posted)) : [];
  } catch {
    return [];
  }
}

export const acknowledgeNotices = async (ids: string[]): Promise<void> => {
  if (readerSupported() && ids.length > 0) await Native.acknowledge({ ids });
};

/** Text shared to Wall-ette and not taken yet. */
export async function takeSharedText(): Promise<string | null> {
  if (!readerSupported()) return null;
  try {
    const { text } = await Native.takeShared();
    return typeof text === 'string' && text.trim() ? text : null;
  } catch {
    return null;
  }
}

/** Calls back when a payment notification is kept or text is shared while the app runs. */
export function onReaderEvent(listener: () => void): () => void {
  if (!readerSupported()) return () => {};
  const handles: Promise<PluginListenerHandle>[] = [Native.addListener('notice', listener), Native.addListener('shared', listener)];
  return () => { for (const h of handles) void h.then(x => x.remove()).catch(() => {}); };
}
