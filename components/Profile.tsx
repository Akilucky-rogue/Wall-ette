import React, { useState, useEffect, useSyncExternalStore } from 'react';
import QRCode from 'qrcode';
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword, type MultiFactorResolver } from 'firebase/auth';
import { collection, doc, deleteDoc, getDocs, writeBatch } from 'firebase/firestore';
import { AppScreen } from '../types';
import { useWallet } from '../context/WalletContext';
import { inputDigits, toBase, toShown } from '../utils/currencyUtils';
import { useAuth } from '../context/AuthContext';
import { db } from '../services/firebase';
import {
  isTotpEnrolled, startTotpEnrollment, finishTotpEnrollment, unenrollTotp,
  isMfaRequiredError, mfaResolverFromError, resolveTotpSignIn, mfaErrorMessage,
  type TotpEnrollmentStart,
} from '../services/mfa';
import { isBiometricAvailable, isBiometricEnabled, setBiometricEnabled, authenticateBiometric, isNative } from '../utils/biometric';
import { log } from '../utils/log';
import { PRIVACY_URL, TERMS_URL } from '../utils/site';
import { BrandIcon, TAGLINE, Wordmark } from './ui/Brand';
import CurrencySelector from './CurrencySelector';
import WhatsNewSheet from './WhatsNewSheet';
import { latestNotes } from '../services/releaseNotes';
import {
  checkForUpdate, getUpdateState, installUpdate, restartToUpdate, subscribe as subscribeUpdates, updatesSupported,
} from '../services/appUpdates';
import type { UpdateFinding } from '../services/appUpdatePolicy';
import { forgetDeletedAccount, signOutOfDevice } from '../services/session';
import { googleErrorMessage, hasPassword, isGoogleCancel, reauthenticateWithGoogle, signsInWithGoogle } from '../services/googleSignIn';
import { crashReportsOn, setCrashReports } from '../services/crashReports';
import { setThemeMode, getThemeMode, getCustomTheme, themeSwatches, type ThemeMode, type CustomTheme } from '../utils/theme';
import { openAt } from '../utils/screenSection';
import {
  currentAlerts, loadShown, markShown, phoneNotificationsOn, saveShown, setPhoneNotificationsOn, subscribePhoneSwitch,
} from '../services/phoneNotifications';
import { askPhonePermission, clearPhoneNotes, phonePermission } from '../services/phoneNotifier';
import { hapticsOn, setHapticsOn, tick } from '../utils/haptics';

/** Self is a hub (who you are, and links) and a page for each group of settings. */
export type SelfPage = 'hub' | 'account' | 'alerts' | 'data' | 'appearance' | 'about';

const PAGE_TITLE: Record<SelfPage, string> = {
  hub: 'Self',
  account: 'Account and security',
  alerts: 'Alerts and limits',
  data: 'Your data',
  appearance: 'Appearance',
  about: 'About',
};

interface ProfileProps {
  onNavigate: (screen: AppScreen) => void;
  onLogout?: () => void;
  page?: SelfPage;
}

/** A setting: icon, name, what it does, and its control. Tappable when it opens something. */
const Row: React.FC<{ icon: string; iconCls: string; title: string; sub: string; children?: React.ReactNode; onClick?: () => void }> =
  ({ icon, iconCls, title, sub, children, onClick }) => {
  const inner = (
    <>
      <span className="flex items-center gap-3 min-w-0">
        <span className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${iconCls}`}>
          <span className="material-symbols-outlined icon-fill text-[20px]" aria-hidden="true">{icon}</span>
        </span>
        <span className="min-w-0">
          <span className="block text-[14px] font-semibold text-premium-charcoal">{title}</span>
          <span className="block text-[12px] text-muted-taupe leading-snug">{sub}</span>
        </span>
      </span>
      <span className="shrink-0">{children}</span>
    </>
  );
  return onClick
    ? <button onClick={onClick} className="w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left active:bg-zen-cream transition-colors">{inner}</button>
    : <div className="flex items-center justify-between gap-3 px-4 py-3.5">{inner}</div>;
};

/** Rows on one card, with hairlines between them. */
const Card: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="bg-white rounded-3xl shadow-soft border border-black/[0.02] overflow-hidden divide-y divide-premium-charcoal/[0.06]">
    {children}
  </div>
);

const Toggle: React.FC<{ checked: boolean; onChange: () => void; label: string }> = ({ checked, onChange, label }) => (
  <label className="relative inline-flex items-center cursor-pointer">
    <input type="checkbox" className="sr-only peer" checked={checked} onChange={() => { tick(); onChange(); }} aria-label={label} />
    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-sage"></div>
  </label>
);

/** What Self → About says after a check (services/appUpdates.ts). */
const UPDATE_LINES: Record<UpdateFinding, string> = {
  latest: 'You have the latest version.',
  available: 'A newer version is on Google Play.',
  downloading: "The update is downloading. You'll be asked to restart when it's ready.",
  ready: 'The update has downloaded. Restart to install it.',
  'not-from-play': "This copy wasn't installed from Google Play, so it can't update itself. Install Wall-ette from Google Play to get updates.",
  unavailable: "Couldn't reach Google Play. Check your connection and try again.",
};

/** Asks Google Play again, even for a version turned down with "No thanks". */
const UpdateCheckButton: React.FC = () => {
  const { checking } = useSyncExternalStore(subscribeUpdates, getUpdateState);
  return (
    <button
      onClick={() => { void checkForUpdate(true); }}
      disabled={checking}
      className="px-4 py-2 rounded-full bg-sage-light text-sage text-[13px] font-semibold shadow-soft disabled:opacity-60"
    >
      {checking ? 'Checking…' : 'Check for updates'}
    </button>
  );
};

/** Play's answer to the last check, and what can be done about it. */
const UpdateCheckResult: React.FC = () => {
  const { finding, checking, phase } = useSyncExternalStore(subscribeUpdates, getUpdateState);
  if (!finding || checking) return null;
  return (
    <div className="mt-3 flex flex-col items-center gap-2.5">
      <p role="status" className="text-[12px] text-muted-taupe leading-relaxed max-w-[280px]">{UPDATE_LINES[finding]}</p>
      {finding === 'available' && phase === 'idle' && (
        <button onClick={() => { void installUpdate(); }} className="px-5 py-2 rounded-full bg-sage text-white text-[13px] font-semibold shadow-soft">
          Update
        </button>
      )}
      {finding === 'ready' && phase === 'ready' && (
        <button onClick={() => { void restartToUpdate(); }} className="px-5 py-2 rounded-full bg-sage text-white text-[13px] font-semibold shadow-soft">
          Restart to update
        </button>
      )}
    </div>
  );
};

// Same strength rules as sign-up (Auth.tsx) — keep in sync.
const PW_RULES: { label: string; test: (s: string) => boolean }[] = [
  { label: '8+ characters', test: s => s.length >= 8 },
  { label: 'Uppercase letter', test: s => /[A-Z]/.test(s) },
  { label: 'Lowercase letter', test: s => /[a-z]/.test(s) },
  { label: 'Number', test: s => /\d/.test(s) },
  { label: 'Special (@$!%*?&)', test: s => /[@$!%*?&]/.test(s) },
];

const Profile: React.FC<ProfileProps> = ({ onNavigate, onLogout, page = 'hub' }) => {
  const { user } = useAuth();
  const {
    dailyLimit, setDailyLimit, formatAmount, formatWhole, lastLoginTime, transactions, getMonthlyIncome, getMonthlyExpense,
    clearAllTransactions, currency, counted, budgets, shownRate, shownCurrency,
  } = useWallet();

  const [notesOpen, setNotesOpen] = useState(false);

  // ── Daily limit: typed in the currency shown, saved in rupees ──
  const shownLimit = dailyLimit > 0 ? String(toShown(dailyLimit, shownRate, inputDigits(shownCurrency, shownRate))) : '';
  const [limitInput, setLimitInput] = useState(shownLimit);
  const [limitSaved, setLimitSaved] = useState(false);
  useEffect(() => { setLimitInput(shownLimit); }, [shownLimit]);
  const handleSaveLimit = () => {
    const val = parseFloat(limitInput);
    if (limitInput.trim() === '' || isNaN(val) || val <= 0) { setDailyLimit(0); setLimitInput(''); }
    else if (limitInput !== shownLimit) setDailyLimit(toBase(val, shownRate));
    setLimitSaved(true);
    setTimeout(() => setLimitSaved(false), 1200);
  };

  // ── Phone notifications (Android, this device; services/phoneNotifications.ts) ──
  const uid = user?.uid ?? null;
  const phoneOn = useSyncExternalStore(subscribePhoneSwitch, () => (uid ? phoneNotificationsOn(uid) : false));
  const [phoneMsg, setPhoneMsg] = useState('');
  useEffect(() => {
    // Switched on here, but Android's permission was taken away since.
    if (!phoneOn) return;
    let live = true;
    phonePermission().then(p => {
      if (live) setPhoneMsg(p === 'granted' || p === 'unavailable' ? '' : "Android isn't letting Wall-ette show notifications. Allow them for Wall-ette in your phone's settings.");
    });
    return () => { live = false; };
  }, [phoneOn]);
  const togglePhone = async () => {
    if (!uid) return;
    if (phoneOn) {
      setPhoneNotificationsOn(uid, false);
      setPhoneMsg('');
      void clearPhoneNotes();
      return;
    }
    if (!(await askPhonePermission())) {
      setPhoneMsg("Android didn't allow notifications. Allow them for Wall-ette in your phone's settings, then switch this on.");
      return;
    }
    // Budgets and limits already past count as shown, so switching on
    // doesn't bring a burst of old news; new ones come from now on.
    const now = new Date();
    const money = formatWhole;
    const already = currentAlerts({ counted, budgets, dailyLimit, now, money }).map(a => a.key);
    saveShown(uid, markShown(loadShown(uid), already, now.getTime()));
    setPhoneMsg('');
    setPhoneNotificationsOn(uid, true);
  };

  // ── Change password (reauthenticate, then update) ──
  const [pwModal, setPwModal] = useState(false);
  const [pwCurrent, setPwCurrent] = useState('');
  const [pwNew, setPwNew] = useState('');
  const [pwConfirm, setPwConfirm] = useState('');
  const [pwBusy, setPwBusy] = useState(false);
  const [pwError, setPwError] = useState('');
  const [pwDone, setPwDone] = useState(false);
  const pwRulesOk = PW_RULES.every(r => r.test(pwNew));
  const pwValid = pwRulesOk && pwNew === pwConfirm && pwCurrent.length > 0;

  const openPwModal = () => {
    setPwCurrent(''); setPwNew(''); setPwConfirm('');
    setPwError(''); setPwDone(false); setPwModal(true);
  };

  const changePassword = async () => {
    if (!user?.email || pwBusy || !pwValid) return;
    if (pwNew === pwCurrent) { setPwError('New password must be different from the current one.'); return; }
    setPwBusy(true);
    setPwError('');
    try {
      // Fresh credential proof is required by Firebase before a password change.
      await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, pwCurrent));
      await updatePassword(user, pwNew);
      setPwDone(true);
      setTimeout(() => setPwModal(false), 1800);
    } catch (err: any) {
      const code = err?.code || '';
      if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        setPwError('Current password is incorrect.');
      } else if (code === 'auth/weak-password' || code === 'auth/password-does-not-meet-requirements') {
        setPwError('New password is too weak. It needs everything in the list above.');
      } else if (code === 'auth/network-request-failed') {
        setPwError("You're offline. Connect to the internet and try again.");
      } else if (code === 'auth/too-many-requests') {
        setPwError('Too many attempts — please try again in a few minutes.');
      } else {
        log.warn('Password change failed');
        setPwError('Could not change the password. Please try again.');
      }
    } finally {
      setPwBusy(false);
    }
  };

  // ── Appearance (device-local preference) ──
  const [themeMode, setThemeModeState] = useState<ThemeMode>(getThemeMode());
  const [customTheme, setCustomTheme] = useState<CustomTheme>(getCustomTheme());
  const pickTheme = (mode: ThemeMode) => {
    setThemeModeState(mode);
    setThemeMode(mode, mode === 'custom' ? customTheme : undefined);
  };
  const updateCustom = (patch: Partial<CustomTheme>) => {
    const next = { ...customTheme, ...patch };
    setCustomTheme(next);
    setThemeModeState('custom');
    setThemeMode('custom', next);
  };

  // ── Biometric unlock (device-local) ──
  const [bioSupported, setBioSupported] = useState(false);
  const [bioOn, setBioOn] = useState(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ok = await isBiometricAvailable();
      if (cancelled) return;
      setBioSupported(ok);
      if (user) setBioOn(isBiometricEnabled(user.uid));
    })();
    return () => { cancelled = true; };
  }, [user]);

  const toggleBiometric = async () => {
    if (!user) return;
    if (bioOn) {
      setBiometricEnabled(user.uid, false);
      setBioOn(false);
    } else {
      // Confirm the sensor works before trusting it as an unlock method
      const ok = await authenticateBiometric('Confirm to enable biometric unlock');
      if (ok) { setBiometricEnabled(user.uid, true); setBioOn(true); }
    }
  };

  // ── Vibration on taps (Android, this device) ──
  const [buzz, setBuzz] = useState(hapticsOn);
  const toggleBuzz = () => { setHapticsOn(!buzz); setBuzz(!buzz); };

  // ── Crash reports (Android, device-local) ──
  const [crashOn, setCrashOn] = useState(crashReportsOn);
  const toggleCrashReports = () => {
    const next = !crashOn;
    setCrashOn(next);
    void setCrashReports(next);
  };

  // ── Two-factor (TOTP) ──
  const [mfaOn, setMfaOn] = useState(false);
  useEffect(() => { if (user) setMfaOn(isTotpEnrolled(user)); }, [user]);

  const [mfaModal, setMfaModal] = useState(false);
  const [enrollment, setEnrollment] = useState<TotpEnrollmentStart | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [mfaCode, setMfaCode] = useState('');
  const [mfaBusy, setMfaBusy] = useState(false);
  const [mfaError, setMfaError] = useState('');

  const openMfaEnroll = async () => {
    if (!user) return;
    setMfaModal(true); setMfaError(''); setMfaCode(''); setEnrollment(null); setQrDataUrl('');
    setMfaBusy(true);
    try {
      const start = await startTotpEnrollment(user);
      setEnrollment(start);
      try {
        const url = await QRCode.toDataURL(start.uri, { width: 220, margin: 1, color: { dark: '#333333', light: '#FFFFFF' } });
        setQrDataUrl(url);
      } catch { /* QR optional — manual key shown regardless */ }
    } catch (e: any) {
      setMfaError(mfaErrorMessage(e));
    } finally {
      setMfaBusy(false);
    }
  };

  const confirmMfaEnroll = async () => {
    if (!user || !enrollment) return;
    setMfaBusy(true); setMfaError('');
    try {
      await finishTotpEnrollment(user, enrollment.secret, mfaCode);
      setMfaOn(true);
      setMfaModal(false);
    } catch (e: any) {
      setMfaError(mfaErrorMessage(e));
    } finally {
      setMfaBusy(false);
    }
  };

  const disableMfa = async () => {
    if (!user) return;
    setMfaBusy(true); setMfaError('');
    try {
      await unenrollTotp(user);
      setMfaOn(false);
      setMfaModal(false);
    } catch (e: any) {
      setMfaError(mfaErrorMessage(e));
    } finally {
      setMfaBusy(false);
    }
  };

  // ── Delete account ──
  const [delOpen, setDelOpen] = useState(false);
  const [delConfirm, setDelConfirm] = useState('');
  const [delPassword, setDelPassword] = useState('');
  const [delTotp, setDelTotp] = useState('');
  const [delResolver, setDelResolver] = useState<MultiFactorResolver | null>(null);
  const [delBusy, setDelBusy] = useState(false);
  const [delError, setDelError] = useState('');

  const wipeCloudData = async (uid: string) => {
    // waitForCloud: deletes must finish BEFORE the auth user is removed,
    // otherwise security rules orphan the remaining docs.
    await clearAllTransactions(true);
    try { await deleteDoc(doc(db, `users/${uid}/settings/preferences`)); } catch { /* may not exist */ }
    try {
      const logs = await getDocs(collection(db, `users/${uid}/security_logs`));
      for (let i = 0; i < logs.docs.length; i += 400) {
        const batch = writeBatch(db);
        logs.docs.slice(i, i + 400).forEach(d => batch.delete(d.ref));
        await batch.commit();
      }
    } catch { /* best-effort */ }
    try { await deleteDoc(doc(db, 'users', uid)); } catch { /* best-effort */ }
  };

  // An account made with Google has no password: deleting it is confirmed
  // with Google instead.
  const delWithPassword = hasPassword(user) || !signsInWithGoogle(user);

  const handleDeleteAccount = async () => {
    if (!user || !user.email || delConfirm.toUpperCase() !== 'DELETE') return;
    setDelBusy(true); setDelError('');
    try {
      if (delResolver) {
        await resolveTotpSignIn(delResolver, delTotp);
      } else {
        try {
          if (delWithPassword) await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, delPassword));
          else await reauthenticateWithGoogle(user);
        } catch (e: any) {
          if (isMfaRequiredError(e)) { setDelResolver(mfaResolverFromError(e)); setDelBusy(false); return; }
          if (!delWithPassword) {
            if (!isGoogleCancel(e)) setDelError(googleErrorMessage(e));
            setDelBusy(false);
            return;
          }
          throw e;
        }
      }
      const uid = user.uid;
      try {
        await wipeCloudData(uid);
      } catch {
        throw new Error("Couldn't erase your data from the cloud, so the account wasn't deleted. Check your connection and try again.");
      }
      await user.delete();
      // Then this device's copy (audit M2); the app reloads to the Auth screen.
      await forgetDeletedAccount(uid);
    } catch (e: any) {
      log.warn('Account deletion failed:', e?.code);
      setDelError(e?.code === 'auth/wrong-password' || e?.code === 'auth/invalid-credential'
        ? 'Incorrect password.' : mfaErrorMessage(e));
    } finally {
      setDelBusy(false);
    }
  };

  // ── Derived account info ──
  const memberSince = user?.metadata?.creationTime
    ? new Date(user.metadata.creationTime).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
    : '—';
  const monthlyNet = getMonthlyIncome() - getMonthlyExpense();
  const money = formatWhole;
  const lastSignIn = lastLoginTime
    ? `${lastLoginTime.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}, ${lastLoginTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    : 'just now';
  const themeName = themeMode === 'auto'
    ? 'Matches your phone'
    : `${themeSwatches().find(s => s.id === themeMode)?.name ?? 'Sage'} theme`;
  const chevron = <span className="material-symbols-outlined text-muted-taupe/60 text-[20px]" aria-hidden="true">chevron_right</span>;
  const external = <span className="material-symbols-outlined text-muted-taupe/60 text-[18px]" aria-hidden="true">open_in_new</span>;

  const pages: { screen: AppScreen; title: string; icon: string; tint: string; preview: string }[] = [
    {
      screen: AppScreen.SELF_ACCOUNT, title: PAGE_TITLE.account, icon: 'shield_person', tint: 'bg-sage-light text-sage',
      preview: isNative() && bioOn ? 'Biometric unlock is on' : 'Password, unlock and sign-in',
    },
    {
      screen: AppScreen.SELF_ALERTS, title: PAGE_TITLE.alerts, icon: 'notifications', tint: 'bg-rose-light text-rose',
      preview: isNative()
        ? `Notifications ${phoneOn ? 'on' : 'off'}, ${dailyLimit > 0 ? `daily limit ${money(dailyLimit)}` : 'no daily limit'}`
        : dailyLimit > 0 ? `Daily limit ${money(dailyLimit)}` : 'No daily limit set',
    },
    {
      screen: AppScreen.SELF_DATA, title: PAGE_TITLE.data, icon: 'folder_open', tint: 'bg-lavender-light text-lavender',
      preview: 'Import, export and money moved',
    },
    {
      screen: AppScreen.SELF_APPEARANCE, title: PAGE_TITLE.appearance, icon: 'palette', tint: 'bg-ocean-light text-ocean',
      preview: `${themeName}, amounts in ${currency}`,
    },
    {
      screen: AppScreen.SELF_ABOUT, title: PAGE_TITLE.about, icon: 'info', tint: 'bg-sand-light text-sand-ink',
      preview: `Version ${__APP_VERSION__}`,
    },
  ];

  return (
    <div className="relative flex min-h-screen w-full flex-col max-w-[430px] md:max-w-2xl lg:max-w-3xl mx-auto overflow-x-hidden pb-32 lg:pb-12 bg-zen-bg">
      {/* Header: Self, or the page's title with a way back */}
      <div className="flex items-center gap-2 bg-zen-bg/85 backdrop-blur-md px-5 pt-6 pb-3 sticky top-0 z-30">
        {page !== 'hub' && (
          <button
            onClick={() => onNavigate(AppScreen.SELF)}
            className="w-10 h-10 -ml-2 flex items-center justify-center rounded-full text-premium-charcoal hover:bg-white/70 transition-colors"
            aria-label="Back to Self"
          >
            <span className="material-symbols-outlined text-[24px]" aria-hidden="true">arrow_back</span>
          </button>
        )}
        <h2 className="text-premium-charcoal text-[22px] font-display font-bold tracking-tight leading-tight truncate">{PAGE_TITLE[page]}</h2>
      </div>

      {page === 'hub' && (
        <div className="px-6 pt-2 space-y-4">
          {/* You */}
          <div className="bg-white rounded-[28px] p-5 shadow-raised border border-black/[0.02]">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-sage-light text-sage flex items-center justify-center shadow-soft shrink-0" aria-hidden="true">
                <span className="font-display text-[26px] font-bold uppercase">{(user?.email ?? '?').charAt(0)}</span>
              </div>
              <div className="min-w-0">
                <p className="font-display text-[20px] font-bold text-premium-charcoal truncate">{user?.email?.split('@')[0]}</p>
                <p className="text-[12px] text-muted-taupe truncate">{user?.email}</p>
              </div>
            </div>
            <dl className="mt-5 grid grid-cols-3 divide-x divide-premium-charcoal/[0.08] rounded-2xl bg-zen-bg/70 shadow-pressed py-3">
              <div className="text-center px-2 min-w-0">
                <dt className="text-[11px] text-muted-taupe">Entries</dt>
                <dd className="text-[17px] font-semibold text-premium-charcoal tabular-nums">{transactions.length.toLocaleString('en-IN')}</dd>
              </div>
              <div className="text-center px-2 min-w-0">
                <dt className="text-[11px] text-muted-taupe">This month</dt>
                <dd className={`text-[17px] font-semibold tabular-nums truncate ${monthlyNet >= 0 ? 'text-sage' : 'text-rose'}`}>
                  {monthlyNet >= 0 ? '+' : '−'}{money(Math.abs(monthlyNet))}
                </dd>
              </div>
              <div className="text-center px-2 min-w-0">
                <dt className="text-[11px] text-muted-taupe">Member since</dt>
                <dd className="text-[17px] font-semibold text-premium-charcoal">{memberSince}</dd>
              </div>
            </dl>
            <p className="mt-3 text-[11px] text-muted-taupe text-center">Last signed in {lastSignIn}</p>
          </div>

          {/* Pages */}
          <nav aria-label="Settings">
            <ul className="bg-white rounded-3xl shadow-soft border border-black/[0.02] overflow-hidden divide-y divide-premium-charcoal/[0.06]">
              {pages.map(row => (
                <li key={row.screen}>
                  <button
                    onClick={() => onNavigate(row.screen)}
                    className="w-full flex items-center gap-3 px-4 py-3.5 text-left active:bg-zen-cream transition-colors"
                  >
                    <span className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${row.tint}`}>
                      <span className="material-symbols-outlined icon-fill text-[20px]" aria-hidden="true">{row.icon}</span>
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-[14px] font-semibold text-premium-charcoal">{row.title}</span>
                      <span className="block text-[12px] text-muted-taupe truncate">{row.preview}</span>
                    </span>
                    {chevron}
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          <button
            onClick={() => onLogout ? onLogout() : void signOutOfDevice()}
            className="w-full bg-white text-rose py-3.5 rounded-3xl font-semibold text-[14px] shadow-soft border border-rose/15 flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-[20px]" aria-hidden="true">logout</span>
            Sign out
          </button>
        </div>
      )}

      {page === 'account' && (
        <div className="px-6 pt-2 space-y-4">
          <Card>
            {isNative() && (
              <Row icon="fingerprint" iconCls="bg-sage-light text-sage" title="Biometric unlock"
                   sub={bioSupported ? 'Use your fingerprint or face to unlock Wall-ette' : 'No fingerprint or face is set up on this phone'}>
                {bioSupported && <Toggle checked={bioOn} onChange={toggleBiometric} label="Biometric unlock" />}
              </Row>
            )}
            {hasPassword(user) && (
              <Row icon="password" iconCls="bg-lavender-light text-lavender" title="Change password"
                   sub="Enter your current password, then a new one" onClick={openPwModal}>
                {chevron}
              </Row>
            )}
            <Row icon="shield_lock" iconCls="bg-blue-zen-light text-blue-zen" title="Two-factor sign-in"
                 sub="A code from an authenticator app">
              <span className="text-[11px] font-semibold px-3 py-1.5 rounded-full bg-zen-bg text-muted-taupe shadow-pressed">Coming soon</span>
            </Row>
          </Card>
          <p className="text-[12px] text-muted-taupe px-1">
            Signed in as {user?.email}{signsInWithGoogle(user) ? (hasPassword(user) ? ', with Google or your password' : ' with Google') : ''}. Last signed in {lastSignIn}.
          </p>

          <div className="pt-4">
            <button
              onClick={() => { setDelOpen(true); setDelConfirm(''); setDelPassword(''); setDelTotp(''); setDelResolver(null); setDelError(''); }}
              className="w-full rounded-3xl border border-rose/25 px-5 py-4 text-left hover:bg-rose-light/30 transition-colors"
            >
              <span className="block text-[14px] font-semibold text-rose">Delete account and all data</span>
              <span className="block text-[12px] text-muted-taupe mt-0.5 leading-snug">
                Erases your entries, settings and sign-in history from the cloud and this phone, then deletes the account.
              </span>
            </button>
          </div>
        </div>
      )}

      {page === 'alerts' && (
        <div className="px-6 pt-2 space-y-4">
          {isNative() && (
            <Card>
              <Row icon="notifications_active" iconCls="bg-ocean-light text-ocean" title="Phone notifications"
                   sub="Bills due tomorrow, budgets and your daily limit. Made on this phone; nothing is sent.">
                <Toggle checked={phoneOn} onChange={() => { void togglePhone(); }} label="Phone notifications" />
              </Row>
              {phoneMsg && <p className="px-4 py-3 text-[12px] text-rose leading-snug" role="status">{phoneMsg}</p>}
            </Card>
          )}
          <Card>
            <Row icon="speed" iconCls="bg-rose-light text-rose" title="Daily spend limit"
                 sub="The bell warns you when today's spending goes past it">
              <div className="relative flex items-center">
                <input
                  id="daily-limit-input"
                  type="number"
                  inputMode="numeric"
                  min="0"
                  value={limitInput}
                  onChange={e => { const val = e.target.value; if (/^\d*\.?\d{0,2}$/.test(val)) setLimitInput(val); setLimitSaved(false); }}
                  onBlur={handleSaveLimit}
                  placeholder="No limit"
                  title="Daily spend limit"
                  aria-label="Daily spend limit"
                  className="w-24 text-right bg-zen-bg shadow-pressed border-none rounded-xl py-2 px-3 text-sm font-semibold text-premium-charcoal outline-none focus:ring-1 focus:ring-sage transition-colors"
                />
                {limitSaved && <span className="absolute -left-5 text-sage text-xs" aria-live="polite" title="Saved">✔</span>}
              </div>
            </Row>
            <Row icon="donut_large" iconCls="bg-sage-light text-sage" title="Budgets and savings goal"
                 sub="Set in Flow. The bell tells you when a budget is nearly used up."
                 onClick={() => { openAt('goals'); onNavigate(AppScreen.INCOME_INSIGHTS); }}>
              {chevron}
            </Row>
          </Card>
        </div>
      )}

      {page === 'data' && (
        <div className="px-6 pt-2 space-y-4">
          <Card>
            <Row icon="upload_file" iconCls="bg-sage-light text-sage" title="Import a statement" sub="A bank statement, PDF or Excel" onClick={() => onNavigate(AppScreen.IMPORT)}>
              {chevron}
            </Row>
            <Row icon="description" iconCls="bg-blue-zen-light text-blue-zen" title="Export and reports" sub="Statements, CSV and a full backup" onClick={() => onNavigate(AppScreen.EXPORT)}>
              {chevron}
            </Row>
            <Row icon="swap_horiz" iconCls="bg-lavender-light text-lavender" title="Money moved" sub="Your own accounts, family and investments" onClick={() => onNavigate(AppScreen.MONEY_MOVED)}>
              {chevron}
            </Row>
          </Card>
          {isNative() && (
            <Card>
              <Row icon="bug_report" iconCls="bg-sand-light text-sand-ink" title="Crash reports"
                   sub="Errors go to Firebase Crashlytics, never your transactions">
                <Toggle checked={crashOn} onChange={toggleCrashReports} label="Send crash reports" />
              </Row>
            </Card>
          )}
        </div>
      )}

      {page === 'appearance' && (
        <div className="px-6 pt-2 space-y-4">
          <Card>
            <Row icon="brightness_auto" iconCls="bg-ocean-light text-ocean" title="Match your phone" sub="Light or dark, as your phone is set">
              <Toggle checked={themeMode === 'auto'} onChange={() => pickTheme(themeMode === 'auto' ? 'sage' : 'auto')} label="Match system theme" />
            </Row>
            <div className={`px-4 py-4 ${themeMode === 'auto' ? 'opacity-40 pointer-events-none' : ''}`}>
              <div className="grid grid-cols-3 gap-2.5">
                {themeSwatches().map(s => (
                  <button
                    key={s.id}
                    onClick={() => pickTheme(s.id)}
                    aria-pressed={themeMode === s.id}
                    className={`rounded-2xl p-2.5 border text-left transition-all shadow-soft ${themeMode === s.id ? 'border-sage ring-2 ring-sage/40' : 'border-black/[0.08]'}`}
                    style={{ background: s.bg }}
                  >
                    <span className="flex items-center gap-1 mb-1.5">
                      <span className="w-4 h-4 rounded-full border border-premium-charcoal/[0.12]" style={{ background: s.accent }} />
                      <span className="w-2.5 h-2.5 rounded-full opacity-60" style={{ background: s.ink }} />
                    </span>
                    <span className="block text-[11px] font-semibold" style={{ color: s.ink }}>{s.name}</span>
                  </button>
                ))}
              </div>
              {themeMode === 'custom' && (
                <div className="mt-4 flex items-center justify-between gap-3">
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="color"
                      value={customTheme.accent}
                      onChange={e => updateCustom({ accent: e.target.value })}
                      className="w-9 h-9 rounded-xl border border-premium-charcoal/[0.12] bg-transparent cursor-pointer p-0.5"
                      aria-label="Custom accent color"
                    />
                    <span className="text-[12px] text-muted-taupe">Accent color</span>
                  </label>
                  <div className="flex rounded-xl overflow-hidden border border-black/[0.08] text-[11px] font-semibold">
                    <button onClick={() => updateCustom({ dark: false })} className={`px-3 py-1.5 transition-colors ${!customTheme.dark ? 'bg-sage text-white' : 'text-muted-taupe'}`}>Light</button>
                    <button onClick={() => updateCustom({ dark: true })} className={`px-3 py-1.5 transition-colors ${customTheme.dark ? 'bg-sage text-white' : 'text-muted-taupe'}`}>Dark</button>
                  </div>
                </div>
              )}
            </div>
          </Card>
          <Card>
            <Row icon="currency_exchange" iconCls="bg-sand-light text-sand-ink" title="Show amounts in" sub="Converted at live exchange rates; saved in INR">
              <CurrencySelector />
            </Row>
            {isNative() && (
              <Row icon="vibration" iconCls="bg-lavender-light text-lavender" title="Vibration" sub="A light tap when you switch tabs, save or remove">
                <Toggle checked={buzz} onChange={toggleBuzz} label="Vibration" />
              </Row>
            )}
          </Card>
        </div>
      )}

      {page === 'about' && (
        <div className="px-6 pt-2 space-y-4">
          <div className="bg-white rounded-[28px] p-6 shadow-raised border border-black/[0.02] flex flex-col items-center text-center">
            <BrandIcon size={64} className="drop-shadow-sm" />
            <h3 className="mt-4"><Wordmark height={26} /></h3>
            <p className="mt-1.5 text-[13px] font-medium text-muted-taupe">{TAGLINE}</p>
            <p className="mt-1 text-[12px] text-muted-taupe tabular-nums">Version {__APP_VERSION__} ({__APP_BUILD__})</p>
            {isNative() && (
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <button onClick={() => setNotesOpen(true)} className="px-4 py-2 rounded-full bg-sage-light text-sage text-[13px] font-semibold shadow-soft">
                  What's new
                </button>
                {updatesSupported() && <UpdateCheckButton />}
              </div>
            )}
            {isNative() && updatesSupported() && <UpdateCheckResult />}
          </div>
          <Card>
            <Row icon="policy" iconCls="bg-sand-light text-sand-ink" title="Privacy policy" sub="How your data is handled"
                 onClick={() => window.open(PRIVACY_URL, '_blank')}>
              {external}
            </Row>
            <Row icon="gavel" iconCls="bg-sage-light text-sage" title="Terms and conditions" sub="The agreement you accepted"
                 onClick={() => window.open(TERMS_URL, '_blank')}>
              {external}
            </Row>
          </Card>
        </div>
      )}

      {notesOpen && <WhatsNewSheet notes={latestNotes(__APP_BUILD__)} onClose={() => setNotesOpen(false)} />}

      {/* ── 2FA modal ── */}
      {mfaModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end md:items-center justify-center z-[100]" onClick={() => !mfaBusy && setMfaModal(false)}>
          <div className="bg-white w-full max-w-[430px] rounded-t-[32px] md:rounded-[32px] px-6 pt-6 pb-[calc(1.5rem_+_var(--sab))] animate-slide-up max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-display font-bold text-premium-charcoal">Two-factor authentication</h3>
              <button onClick={() => setMfaModal(false)} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center" disabled={mfaBusy}>
                <span className="material-symbols-outlined text-muted-taupe">close</span>
              </button>
            </div>

            {mfaError && <div className="mb-4 p-3 bg-rose-light/40 border border-rose/20 rounded-xl text-rose text-xs font-medium leading-relaxed">{mfaError}</div>}

            {mfaOn ? (
              <>
                <p className="text-[13px] text-muted-taupe leading-relaxed mb-5">
                  Your account requires an authenticator code at every sign-in. Disabling removes this protection.
                </p>
                <button onClick={disableMfa} disabled={mfaBusy}
                        className="w-full bg-rose text-white py-3.5 rounded-2xl font-semibold shadow-soft active:scale-[0.98] transition-all disabled:opacity-50">
                  {mfaBusy ? 'Removing…' : 'Turn off two-factor authentication'}
                </button>
              </>
            ) : mfaBusy && !enrollment ? (
              <div className="flex justify-center py-10">
                <div className="h-8 w-8 rounded-full border-4 border-sage/20 border-t-sage animate-spin" />
              </div>
            ) : enrollment ? (
              <>
                <p className="text-[12px] text-muted-taupe leading-relaxed mb-4">
                  1. Scan with Google Authenticator, Authy, or any TOTP app — or enter the key manually.
                </p>
                {qrDataUrl && (
                  <div className="flex justify-center mb-4">
                    <img src={qrDataUrl} alt="2FA QR code" className="rounded-xl border border-premium-charcoal/[0.08]" width={200} height={200} />
                  </div>
                )}
                <div className="bg-zen-bg rounded-xl px-4 py-3 mb-5">
                  <p className="text-[9px] uppercase tracking-wider text-muted-taupe font-bold mb-1">Manual key</p>
                  <p className="text-[12px] font-mono text-premium-charcoal break-all select-all">{enrollment.secretKey}</p>
                </div>
                <p className="text-[12px] text-muted-taupe leading-relaxed mb-2">2. Enter the 6-digit code the app shows:</p>
                <input
                  type="text" inputMode="numeric" maxLength={6} value={mfaCode}
                  onChange={e => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="w-full text-center bg-zen-bg rounded-2xl px-5 py-3.5 text-premium-charcoal text-xl tracking-[0.5em] font-mono outline-none focus:ring-1 focus:ring-sage mb-4"
                  placeholder="000000"
                />
                <button onClick={confirmMfaEnroll} disabled={mfaBusy || mfaCode.length < 6}
                        className="w-full bg-sage text-white py-3.5 rounded-2xl font-semibold shadow-soft active:scale-[0.98] transition-all disabled:opacity-50">
                  {mfaBusy ? 'Verifying…' : 'Activate'}
                </button>
              </>
            ) : null}
          </div>
        </div>
      )}

      {/* ── Change password modal ── */}
      {pwModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end md:items-center justify-center z-[100]" onClick={() => !pwBusy && setPwModal(false)}>
          <div className="bg-white w-full max-w-[430px] rounded-t-[32px] md:rounded-[32px] px-6 pt-6 pb-[calc(1.5rem_+_var(--sab))] animate-slide-up max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-display font-bold text-premium-charcoal">Change password</h3>
              <button onClick={() => setPwModal(false)} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center" disabled={pwBusy} aria-label="Close">
                <span className="material-symbols-outlined text-muted-taupe">close</span>
              </button>
            </div>

            {pwDone ? (
              <div className="p-5 bg-sage-light/40 border border-sage/20 rounded-2xl text-center">
                <span className="material-symbols-outlined text-sage text-[36px] mb-1">check_circle</span>
                <p className="text-[14px] font-semibold text-premium-charcoal">Password changed</p>
                <p className="text-[12px] text-muted-taupe mt-1">Use the new password from your next sign-in.</p>
              </div>
            ) : (
              <>
                {pwError && <div className="mb-4 p-3 bg-rose-light/40 border border-rose/20 rounded-xl text-rose text-xs font-medium leading-relaxed">{pwError}</div>}

                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-bold text-muted-taupe uppercase tracking-wider mb-1.5 ml-2">Current password</label>
                    <input type="password" value={pwCurrent} onChange={e => setPwCurrent(e.target.value)}
                           autoComplete="current-password" autoFocus
                           className="w-full bg-zen-bg rounded-2xl px-5 py-3.5 text-premium-charcoal text-sm outline-none focus:ring-1 focus:ring-sage border border-transparent focus:border-sage/30 transition-all"
                           placeholder="••••••••" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-muted-taupe uppercase tracking-wider mb-1.5 ml-2">New password</label>
                    <input type="password" value={pwNew} onChange={e => setPwNew(e.target.value)}
                           autoComplete="new-password"
                           className="w-full bg-zen-bg rounded-2xl px-5 py-3.5 text-premium-charcoal text-sm outline-none focus:ring-1 focus:ring-sage border border-transparent focus:border-sage/30 transition-all"
                           placeholder="••••••••" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-muted-taupe uppercase tracking-wider mb-1.5 ml-2">Confirm new password</label>
                    <input type="password" value={pwConfirm} onChange={e => setPwConfirm(e.target.value)}
                           autoComplete="new-password"
                           className="w-full bg-zen-bg rounded-2xl px-5 py-3.5 text-premium-charcoal text-sm outline-none focus:ring-1 focus:ring-sage border border-transparent focus:border-sage/30 transition-all"
                           placeholder="••••••••" />
                    {pwConfirm.length > 0 && pwNew !== pwConfirm && (
                      <p className="text-[11px] text-rose mt-1.5 ml-2">Passwords don't match yet.</p>
                    )}
                  </div>
                </div>

                {/* Live strength checklist (same rules as sign-up) */}
                <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 mt-4 mb-5 px-1">
                  {PW_RULES.map(r => {
                    const ok = r.test(pwNew);
                    return (
                      <div key={r.label} className="flex items-center gap-1.5">
                        <span className={`material-symbols-outlined text-[14px] ${ok ? 'text-sage' : 'text-muted-taupe/50'}`}>
                          {ok ? 'check_circle' : 'radio_button_unchecked'}
                        </span>
                        <span className={`text-[11px] ${ok ? 'text-premium-charcoal' : 'text-muted-taupe'}`}>{r.label}</span>
                      </div>
                    );
                  })}
                </div>

                <button
                  onClick={changePassword}
                  disabled={pwBusy || !pwValid}
                  className="w-full bg-sage text-white py-3.5 rounded-2xl font-semibold shadow-soft active:scale-[0.98] transition-all disabled:opacity-50"
                >
                  {pwBusy ? 'Updating…' : 'Update Password'}
                </button>
                <p className="text-[10px] text-muted-taupe text-center mt-3 leading-relaxed">
                  Forgot the current one? Sign out and use "Forgot Password?" on the login screen.
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Delete account modal ── */}
      {delOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-end md:items-center justify-center z-[100]" onClick={() => !delBusy && setDelOpen(false)}>
          <div className="bg-white w-full max-w-[430px] rounded-t-[32px] md:rounded-[32px] px-6 pt-6 pb-[calc(1.5rem_+_var(--sab))] animate-slide-up" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-display font-bold text-rose mb-2">Delete account</h3>
            <p className="text-[12px] text-muted-taupe leading-relaxed mb-4">
              This permanently erases your account and every transaction from the cloud. There is no undo.
              Consider exporting a backup first.
            </p>
            {delError && <div className="mb-4 p-3 bg-rose-light/40 border border-rose/20 rounded-xl text-rose text-xs font-medium leading-relaxed">{delError}</div>}

            {delResolver ? (
              <>
                <p className="text-[12px] text-muted-taupe mb-2">Enter your authenticator code to confirm:</p>
                <input type="text" inputMode="numeric" maxLength={6} value={delTotp}
                       onChange={e => setDelTotp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                       className="w-full text-center bg-zen-bg rounded-2xl px-5 py-3.5 text-xl tracking-[0.5em] font-mono outline-none focus:ring-1 focus:ring-rose mb-4"
                       placeholder="000000" />
              </>
            ) : (
              <>
                <input type="text" value={delConfirm} onChange={e => setDelConfirm(e.target.value)}
                       className="w-full bg-zen-bg rounded-2xl px-5 py-3.5 text-sm outline-none focus:ring-1 focus:ring-rose mb-3"
                       placeholder='Type "DELETE" to confirm' />
                {delWithPassword ? (
                  <input type="password" value={delPassword} onChange={e => setDelPassword(e.target.value)}
                         className="w-full bg-zen-bg rounded-2xl px-5 py-3.5 text-sm outline-none focus:ring-1 focus:ring-rose mb-4"
                         placeholder="Your password" />
                ) : (
                  <p className="text-[12px] text-muted-taupe mb-4">Google will ask you to confirm it's you.</p>
                )}
              </>
            )}

            <button
              onClick={handleDeleteAccount}
              disabled={delBusy || (delResolver ? delTotp.length < 6 : (delConfirm.toUpperCase() !== 'DELETE' || (delWithPassword && delPassword.length === 0)))}
              className="w-full bg-rose text-white py-3.5 rounded-2xl font-semibold shadow-soft active:scale-[0.98] transition-all disabled:opacity-50 mb-2"
            >
              {delBusy ? 'Deleting…' : 'Permanently Delete Everything'}
            </button>
            <button onClick={() => setDelOpen(false)} disabled={delBusy}
                    className="w-full text-muted-taupe py-2 text-xs font-medium uppercase tracking-wider hover:text-premium-charcoal">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Profile;
