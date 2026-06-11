import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { EmailAuthProvider, reauthenticateWithCredential, type MultiFactorResolver } from 'firebase/auth';
import { collection, doc, deleteDoc, getDocs, writeBatch } from 'firebase/firestore';
import { AppScreen } from '../types';
import { useWallet } from '../context/WalletContext';
import { useAuth } from '../context/AuthContext';
import { auth, db } from '../services/firebase';
import {
  isTotpEnrolled, startTotpEnrollment, finishTotpEnrollment, unenrollTotp,
  isMfaRequiredError, mfaResolverFromError, resolveTotpSignIn, mfaErrorMessage,
  type TotpEnrollmentStart,
} from '../services/mfa';
import { isBiometricAvailable, isBiometricEnabled, setBiometricEnabled, authenticateBiometric, isNative } from '../utils/biometric';
import { log } from '../utils/log';
import { WallEEyes, FloatingLeaf, LotusFlower, MandalaDots, PottedPlant, RangoliCorner } from './SplashScreen';
import CurrencySelector from './CurrencySelector';

interface ProfileProps {
  onNavigate: (screen: AppScreen) => void;
  onLogout?: () => void;
}

const Row: React.FC<{ icon: string; iconCls: string; title: string; sub: string; children?: React.ReactNode; onClick?: () => void }> =
  ({ icon, iconCls, title, sub, children, onClick }) => (
  <div className={`flex items-center justify-between gap-3 ${onClick ? 'cursor-pointer group' : ''}`} onClick={onClick}>
    <div className="flex items-center gap-3 min-w-0">
      <div className={`p-2 rounded-xl shrink-0 ${iconCls}`}>
        <span className="material-symbols-outlined text-[20px]">{icon}</span>
      </div>
      <div className="min-w-0">
        <p className={`text-premium-charcoal font-serif font-medium text-[15px] ${onClick ? 'group-hover:text-sage transition-colors' : ''}`}>{title}</p>
        <p className="text-muted-taupe text-[10px] leading-relaxed">{sub}</p>
      </div>
    </div>
    <div className="shrink-0">{children}</div>
  </div>
);

const Toggle: React.FC<{ checked: boolean; onChange: () => void; label: string }> = ({ checked, onChange, label }) => (
  <label className="relative inline-flex items-center cursor-pointer">
    <input type="checkbox" className="sr-only peer" checked={checked} onChange={onChange} aria-label={label} />
    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-sage"></div>
  </label>
);

const Profile: React.FC<ProfileProps> = ({ onNavigate, onLogout }) => {
  const { user } = useAuth();
  const { dailyLimit, setDailyLimit, formatAmount, lastLoginTime, transactions, getMonthlyIncome, getMonthlyExpense, clearAllTransactions } = useWallet();

  // ── Daily limit (unchanged behavior) ──
  const [limitInput, setLimitInput] = useState(dailyLimit > 0 ? dailyLimit.toString() : '');
  const [limitSaved, setLimitSaved] = useState(false);
  useEffect(() => { setLimitInput(dailyLimit > 0 ? dailyLimit.toString() : ''); }, [dailyLimit]);
  const handleSaveLimit = () => {
    let val = parseFloat(limitInput);
    if (limitInput.trim() === '' || isNaN(val)) { setDailyLimit(0); setLimitInput(''); }
    else { if (val < 0) val = 0; setDailyLimit(val); setLimitInput(val === 0 ? '' : val.toString()); }
    setLimitSaved(true);
    setTimeout(() => setLimitSaved(false), 1200);
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
    await clearAllTransactions();
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

  const handleDeleteAccount = async () => {
    if (!user || !user.email || delConfirm.toUpperCase() !== 'DELETE') return;
    setDelBusy(true); setDelError('');
    try {
      if (delResolver) {
        await resolveTotpSignIn(delResolver, delTotp);
      } else {
        try {
          await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, delPassword));
        } catch (e: any) {
          if (isMfaRequiredError(e)) { setDelResolver(mfaResolverFromError(e)); setDelBusy(false); return; }
          throw e;
        }
      }
      await wipeCloudData(user.uid);
      setBiometricEnabled(user.uid, false);
      await user.delete();
      // onAuthStateChanged fires with null → app returns to the Auth screen
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

  return (
    <div className="relative flex min-h-screen w-full flex-col max-w-[430px] md:max-w-2xl mx-auto overflow-x-hidden pb-32 bg-zen-bg">
      {/* Eco & Indian decorative elements */}
      <FloatingLeaf className="top-24 right-6 opacity-40" delay={0.5} />
      <FloatingLeaf className="top-56 left-4 opacity-30" delay={1.6} color="#A8B89E" />
      <RangoliCorner className="absolute top-20 left-2 opacity-20" color="#8B9E82" />
      <LotusFlower className="absolute top-44 right-3 opacity-30" size="sm" color="#D4B896" />
      <MandalaDots className="absolute bottom-52 left-6 opacity-20" />
      <PottedPlant className="absolute bottom-40 right-6 opacity-35" />

      {/* Header */}
      <div className="flex items-center bg-zen-bg/80 backdrop-blur-md p-6 pb-2 justify-between sticky top-0 z-30">
        <div className="w-10" />
        <h2 className="text-premium-charcoal text-xl font-serif font-semibold tracking-tight flex-1 text-center">Self</h2>
        <div className="w-10" />
      </div>

      {/* Hero */}
      <div className="flex flex-col items-center pt-6 pb-4 relative">
        <div className="relative">
          <div className="absolute -top-2 -left-6 rotate-45"><LotusFlower size="sm" color="#E8A5A5" className="opacity-50" /></div>
          <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-sage to-sage/80 flex items-center justify-center border-4 border-white shadow-lg">
            <WallEEyes size="lg" />
            <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-gradient-to-br from-amber-300 to-amber-400 flex items-center justify-center border-2 border-white shadow-md">
              <span className="text-amber-700 text-xs font-bold">₹</span>
            </div>
          </div>
        </div>
        <h3 className="text-premium-charcoal font-serif text-xl font-semibold mt-4">{user?.email?.split('@')[0]}</h3>
        <p className="text-muted-taupe text-xs">{user?.email}</p>

        {/* Quick stats */}
        <div className="mt-5 grid grid-cols-3 gap-2 px-6 w-full">
          <div className="bg-white px-3 py-3 rounded-2xl border border-black/5 shadow-sm flex flex-col items-center">
            <span className="text-[9px] text-muted-taupe uppercase tracking-wider">Entries</span>
            <span className="text-sm font-serif font-bold text-premium-charcoal mt-0.5">{transactions.length}</span>
          </div>
          <div className="bg-white px-3 py-3 rounded-2xl border border-black/5 shadow-sm flex flex-col items-center">
            <span className="text-[9px] text-muted-taupe uppercase tracking-wider">This Month</span>
            <span className={`text-sm font-serif font-bold mt-0.5 ${monthlyNet >= 0 ? 'text-sage' : 'text-rose'}`}>
              {monthlyNet >= 0 ? '+' : '−'}{formatAmount(Math.abs(monthlyNet)).split('.')[0]}
            </span>
          </div>
          <div className="bg-white px-3 py-3 rounded-2xl border border-black/5 shadow-sm flex flex-col items-center">
            <span className="text-[9px] text-muted-taupe uppercase tracking-wider">Member Since</span>
            <span className="text-sm font-serif font-bold text-premium-charcoal mt-0.5">{memberSince}</span>
          </div>
        </div>
        <p className="text-[10px] text-muted-taupe mt-3">
          Last login: {lastLoginTime ? lastLoginTime.toLocaleDateString('en-GB') + ' ' + lastLoginTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'}
        </p>
      </div>

      <div className="px-6 space-y-6 md:columns-2 md:gap-x-5 md:space-y-0">
          {/* Security */}
          <section className="break-inside-avoid md:mb-5">
              <h4 className="text-muted-taupe text-[11px] font-bold uppercase tracking-[0.2em] mb-4 pl-1">Security</h4>
              <div className="bg-white p-5 rounded-3xl border border-black/[0.02] shadow-soft space-y-6">
                  {isNative() && (
                    <Row icon="fingerprint" iconCls="bg-sage-light text-sage" title="Biometric Unlock"
                         sub={bioSupported ? 'Use fingerprint/face to unlock the session' : 'No biometrics enrolled on this device'}>
                      {bioSupported && <Toggle checked={bioOn} onChange={toggleBiometric} label="Biometric unlock" />}
                    </Row>
                  )}

                  <Row icon="shield_lock" iconCls="bg-blue-zen-light text-blue-zen" title="Two-Factor Auth"
                       sub={mfaOn ? 'Authenticator app enabled' : 'Require an authenticator code at sign-in'}>
                      <button
                        onClick={() => (mfaOn ? (setMfaModal(true), setMfaError('')) : openMfaEnroll())}
                        className={`text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-full ${mfaOn ? 'bg-sage-light text-sage' : 'bg-gray-100 text-muted-taupe hover:bg-gray-200'}`}
                      >
                        {mfaOn ? 'Enabled' : 'Set Up'}
                      </button>
                  </Row>

                  <Row icon="remove_circle" iconCls="bg-rose-light text-rose" title="Daily Spend Limit" sub="Block expenses past this amount (base currency)">
                      <div className="relative flex items-center">
                        <input
                          id="daily-limit-input"
                          type="number"
                          min="0"
                          value={limitInput}
                          onChange={e => { const val = e.target.value; if (/^\d*$/.test(val) || val === '') setLimitInput(val); setLimitSaved(false); }}
                          onBlur={handleSaveLimit}
                          placeholder="No Limit"
                          title="Daily spend limit"
                          aria-label="Daily spend limit"
                          className="w-24 text-right bg-zen-bg border-none rounded-lg py-1.5 px-2 text-sm font-semibold text-premium-charcoal outline-none focus:ring-1 focus:ring-sage transition-colors"
                        />
                        {limitSaved && <span className="absolute -left-4 text-sage text-xs" aria-live="polite" title="Saved">✔</span>}
                      </div>
                  </Row>
              </div>
          </section>

          {/* Preferences */}
          <section className="break-inside-avoid md:mb-5">
              <h4 className="text-muted-taupe text-[11px] font-bold uppercase tracking-[0.2em] mb-4 pl-1">Preferences</h4>
              <div className="bg-white p-5 rounded-3xl border border-black/[0.02] shadow-soft">
                  <Row icon="currency_exchange" iconCls="bg-sand-light text-sand" title="Display Currency" sub="Live exchange rates, INR base">
                      <CurrencySelector />
                  </Row>
              </div>
          </section>

          {/* Data */}
          <section className="break-inside-avoid md:mb-5">
              <h4 className="text-muted-taupe text-[11px] font-bold uppercase tracking-[0.2em] mb-4 pl-1">Data & Privacy</h4>
              <div className="bg-white p-5 rounded-3xl border border-black/[0.02] shadow-soft space-y-6">
                  <Row icon="download" iconCls="bg-sage-light text-sage" title="Import Statement" sub="IDFC PDF or Excel" onClick={() => onNavigate(AppScreen.IMPORT)}>
                      <span className="material-symbols-outlined text-muted-taupe text-[20px]">chevron_right</span>
                  </Row>
                  <Row icon="upload" iconCls="bg-blue-zen-light text-blue-zen" title="Export & Reports" sub="Statement, CSV, full backup" onClick={() => onNavigate(AppScreen.EXPORT)}>
                      <span className="material-symbols-outlined text-muted-taupe text-[20px]">chevron_right</span>
                  </Row>
                  <Row icon="filter_alt" iconCls="bg-lavender-light text-lavender" title="Ignore Rules" sub="Exclude transfers & reimbursables" onClick={() => onNavigate(AppScreen.IGNORE_RULES)}>
                      <span className="material-symbols-outlined text-muted-taupe text-[20px]">chevron_right</span>
                  </Row>
                  <Row icon="policy" iconCls="bg-sand-light text-sand" title="Privacy Policy" sub="How your data is handled"
                       onClick={() => window.open('https://wall-e-7a113.web.app/privacy.html', '_blank')}>
                      <span className="material-symbols-outlined text-muted-taupe text-[20px]">open_in_new</span>
                  </Row>
              </div>
          </section>

          {/* Account */}
          <section className="break-inside-avoid md:mb-5">
              <h4 className="text-muted-taupe text-[11px] font-bold uppercase tracking-[0.2em] mb-4 pl-1">Account</h4>
              <div className="space-y-3">
                  <button
                    onClick={() => onLogout ? onLogout() : auth.signOut()}
                    className="w-full bg-white border border-rose/20 text-rose py-4 rounded-3xl font-serif font-medium shadow-sm hover:bg-rose-light/20 transition-all flex items-center justify-center gap-2"
                  >
                      <span className="material-symbols-outlined">logout</span>
                      Sign Out
                  </button>
                  <button
                    onClick={() => { setDelOpen(true); setDelConfirm(''); setDelPassword(''); setDelTotp(''); setDelResolver(null); setDelError(''); }}
                    className="w-full text-muted-taupe/70 py-2 text-[11px] font-medium uppercase tracking-wider hover:text-rose transition-colors"
                  >
                      Delete account & all data
                  </button>
              </div>
          </section>
      </div>

      <div className="mt-10 text-center">
        <p className="text-[10px] text-muted-taupe uppercase tracking-widest opacity-50">Wall-ette v1.2.0</p>
      </div>

      {/* ── 2FA modal ── */}
      {mfaModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end md:items-center justify-center z-[100]" onClick={() => !mfaBusy && setMfaModal(false)}>
          <div className="bg-white w-full max-w-[430px] rounded-t-[32px] md:rounded-[32px] p-6 animate-slide-up max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-serif font-semibold text-premium-charcoal">Two-Factor Auth</h3>
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
                        className="w-full bg-rose text-white py-3.5 rounded-2xl font-serif font-medium shadow-soft active:scale-[0.98] transition-all disabled:opacity-50">
                  {mfaBusy ? 'Removing…' : 'Disable Two-Factor Auth'}
                </button>
              </>
            ) : mfaBusy && !enrollment ? (
              <div className="flex justify-center py-10">
                <div className="size-8 rounded-full border-4 border-sage/20 border-t-sage animate-spin" />
              </div>
            ) : enrollment ? (
              <>
                <p className="text-[12px] text-muted-taupe leading-relaxed mb-4">
                  1. Scan with Google Authenticator, Authy, or any TOTP app — or enter the key manually.
                </p>
                {qrDataUrl && (
                  <div className="flex justify-center mb-4">
                    <img src={qrDataUrl} alt="2FA QR code" className="rounded-xl border border-black/5" width={200} height={200} />
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
                        className="w-full bg-sage text-white py-3.5 rounded-2xl font-serif font-medium shadow-soft active:scale-[0.98] transition-all disabled:opacity-50">
                  {mfaBusy ? 'Verifying…' : 'Activate'}
                </button>
              </>
            ) : null}
          </div>
        </div>
      )}

      {/* ── Delete account modal ── */}
      {delOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-end md:items-center justify-center z-[100]" onClick={() => !delBusy && setDelOpen(false)}>
          <div className="bg-white w-full max-w-[430px] rounded-t-[32px] md:rounded-[32px] p-6 animate-slide-up" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-serif font-semibold text-rose mb-2">Delete Account</h3>
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
                <input type="password" value={delPassword} onChange={e => setDelPassword(e.target.value)}
                       className="w-full bg-zen-bg rounded-2xl px-5 py-3.5 text-sm outline-none focus:ring-1 focus:ring-rose mb-4"
                       placeholder="Your password" />
              </>
            )}

            <button
              onClick={handleDeleteAccount}
              disabled={delBusy || (delResolver ? delTotp.length < 6 : (delConfirm.toUpperCase() !== 'DELETE' || delPassword.length === 0))}
              className="w-full bg-rose text-white py-3.5 rounded-2xl font-serif font-medium shadow-soft active:scale-[0.98] transition-all disabled:opacity-50 mb-2"
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
