import React, { useState, useEffect, useMemo, useRef, Suspense } from 'react';

import SecurityLock from './components/SecurityLock';
import AndroidInstallBanner from './components/AndroidInstallBanner';
import AppUpdates from './components/AppUpdates';
import CloudSaveBanner from './components/CloudSaveBanner';
import PhoneNotifications from './components/PhoneNotifications';
import PaymentIntake from './components/PaymentIntake';
import PlanGate from './components/PlanGate';
import PlansHost from './components/PlansHost';
import Auth, { AuthType } from './components/Auth';
import Dashboard from './components/Dashboard';
import Navigation from './components/Navigation';
import SplashScreen, { SplashVariant } from './components/SplashScreen';
import { AppScreen } from './types';
import { WalletProvider } from './context/WalletContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { consumeQuietStart, signOutOfDevice } from './services/session';
import { breadcrumb } from './services/crashReports';
import { onPhoneNoteTap } from './services/phoneNotifier';
import { openAt } from './utils/screenSection';
import { lockHeld, resumed } from './utils/externalFlow';
import { watchPlan } from './services/plan';
import { closeNewestPanel } from './utils/backStack';
import { markTiming } from './utils/timing';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

// Lazy Load Non-Critical Screens
const TransactionHistory = React.lazy(() => import('./components/TransactionHistory'));
const NewEntry = React.lazy(() => import('./components/NewEntry'));
const SpendAnalysis = React.lazy(() => import('./components/SpendAnalysis'));
const IncomeInsights = React.lazy(() => import('./components/IncomeInsights'));
const CategorySplit = React.lazy(() => import('./components/CategorySplit'));
const MoneyMoved = React.lazy(() => import('./components/MoneyMoved'));
const BankAccounts = React.lazy(() => import('./components/BankAccounts'));
const PaymentsFromApps = React.lazy(() => import('./components/PaymentsFromApps'));
const YourPlan = React.lazy(() => import('./components/YourPlan'));
const ImportStatement = React.lazy(() => import('./components/ImportStatement'));
const ExportReports = React.lazy(() => import('./components/ExportReports'));
const Rewind = React.lazy(() => import('./components/Rewind'));
const LeftToSpend = React.lazy(() => import('./components/LeftToSpend'));
const Profile = React.lazy(() => import('./components/Profile'));
// On the web the app lives at wall-ette.com/app; the website around it
// (site/) is the product page. Visitors who aren't signed in see sign-in,
// with a way back to the website. Only the Android app plays the launch splash.
const IS_WEB = !Capacitor.isNativePlatform();
// Links from before the app moved to /app ("wall-ette.com/#signin") arrive here.
const SIGN_IN_HASH = '#signin';
const WEBSITE_URL = '/';

// ── Swipe navigation ──────────────────────────────────────────────────────
// Swipe left/right on the four main tabs to move between them; swipe right
// on a sub-screen to go back. Swipes that start on horizontally scrollable
// strips, charts, or text fields are ignored so nothing fights the content.
const TAB_ORDER = [AppScreen.DASHBOARD, AppScreen.HISTORY, AppScreen.ANALYSIS, AppScreen.SELF];
const BACK_TARGET: Partial<Record<AppScreen, AppScreen>> = {
  [AppScreen.IMPORT]: AppScreen.DASHBOARD,
  [AppScreen.EXPORT]: AppScreen.DASHBOARD,
  [AppScreen.INCOME_INSIGHTS]: AppScreen.DASHBOARD,
  [AppScreen.CATEGORY_SPLIT]: AppScreen.PULSE_CATEGORIES,
  [AppScreen.PULSE_TRENDS]: AppScreen.ANALYSIS,
  [AppScreen.PULSE_CATEGORIES]: AppScreen.ANALYSIS,
  [AppScreen.PULSE_RECURRING]: AppScreen.ANALYSIS,
  [AppScreen.PULSE_HEALTH]: AppScreen.ANALYSIS,
  [AppScreen.SELF_ACCOUNT]: AppScreen.SELF,
  [AppScreen.SELF_ALERTS]: AppScreen.SELF,
  [AppScreen.SELF_DATA]: AppScreen.SELF,
  [AppScreen.SELF_APPEARANCE]: AppScreen.SELF,
  [AppScreen.SELF_ABOUT]: AppScreen.SELF,
  // Money moved opens from Home, Pulse, Category split, the Vault and Your
  // data; Back returns to whichever it came from (AppContent's backOf).
  [AppScreen.MONEY_MOVED]: AppScreen.SELF_DATA,
  [AppScreen.BANK_ACCOUNTS]: AppScreen.SELF_DATA,
  [AppScreen.PAYMENT_APPS]: AppScreen.SELF_DATA,
  [AppScreen.SELF_PLAN]: AppScreen.SELF,
  [AppScreen.REWIND]: AppScreen.DASHBOARD,
  [AppScreen.LEFT_TO_SPEND]: AppScreen.DASHBOARD,
};

// How a screen enters (tailwind animations, motion-safe only): deeper pages
// slide in from the right, going back slides in from the left, and tabs rise
// a little into place.
function motionFor(prev: AppScreen, next: AppScreen, backOf: (screen: AppScreen) => AppScreen | undefined): string {
  if (prev === next) return '';
  if (backOf(next) === prev || next === AppScreen.NEW_ENTRY || next === AppScreen.IMPORT) return 'motion-safe:animate-page-in';
  if (backOf(prev) === next) return 'motion-safe:animate-page-back';
  return 'motion-safe:animate-tab-in';
}

// Full-screen flows on phones: no dock (the rail on wide screens stays).
const DOCKLESS = new Set<AppScreen>([AppScreen.NEW_ENTRY, AppScreen.IMPORT]);

// Sign-out and account deletion clear this device's data and reload the app;
// that start-up skips the launch splash (services/session.ts). Read once per
// page load, outside React.
const QUIET_START = consumeQuietStart();

function AppContent() {
  const { user, loading } = useAuth();
  // Native cold start opens LOCKED: a signed-in session resumes behind the
  // biometric/password gate instead of straight onto the dashboard. This is
  // what makes "biometric login" real — open app → fingerprint → in.
  // The test build (__QA_BUILD__) opens unlocked and never locks: it holds a
  // made-up account and is driven from a computer while it's tried out.
  const [isLocked, setIsLocked] = useState(() => Capacitor.isNativePlatform() && !__QA_BUILD__);
  const [currentScreen, setCurrentScreen] = useState<AppScreen>(AppScreen.DASHBOARD);
  // The screen before this one, for the entrance motion.
  const shownScreenRef = useRef<AppScreen>(AppScreen.DASHBOARD);
  // Where Money moved was opened from, for its Back.
  const movedFromRef = useRef<AppScreen>(AppScreen.SELF_DATA);
  const backOf = (screen: AppScreen): AppScreen | undefined =>
    screen === AppScreen.MONEY_MOVED ? movedFromRef.current : BACK_TARGET[screen];
  const screenMotion = useMemo(() => motionFor(shownScreenRef.current, currentScreen, backOf), [currentScreen]);
  useEffect(() => { shownScreenRef.current = currentScreen; }, [currentScreen]);
  const [showSplash, setShowSplash] = useState(!QUIET_START && !IS_WEB);
  const [splashVariant, setSplashVariant] = useState<SplashVariant>('launch');
  const [authSplashPending, setAuthSplashPending] = useState<AuthType | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  // Signed in during this run (a new install or a fresh login) rather than
  // resuming a saved session. AppUpdates uses it to tell a new install from
  // an update.
  const [signedInThisRun, setSignedInThisRun] = useState(false);

  // Signed in, the address drops "#signin" so it no longer reads as the
  // sign-in page. replaceState fires no hashchange.
  useEffect(() => {
    if (!IS_WEB || loading) return;
    if (user && window.location.hash === SIGN_IN_HASH) {
      window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search);
    }
  }, [user, loading]);

  // Ref mirror so long-lived native listeners read the current screen without
  // re-registering on every navigation (audit Phase 6.2).
  const currentScreenRef = useRef(currentScreen);
  currentScreenRef.current = currentScreen;

  // The screens leading up to a crash, in its report (Android).
  useEffect(() => { breadcrumb(`screen ${currentScreen}`); }, [currentScreen]);

  // The member's plan (services/plan.ts): Essential, Plus or none, once paid
  // plans are switched on; until then everything stays open.
  useEffect(() => { watchPlan(user?.uid ?? null); }, [user]);

  // Lock the app when it goes to background on native (Mobile Security).
  // We lock (requiring re-authentication on resume) rather than sign the user
  // out, so returning from a notification or quick context switch doesn't
  // nuke in-progress work. The IMPORT screen is exempt because the native
  // file picker briefly backgrounds the app.
  useEffect(() => {
    if (!user) return;
    if (!Capacitor.isNativePlatform()) return;

    let listenerHandle: any = null;
    let backHandle: any = null;
    (async () => {
      listenerHandle = await CapacitorApp.addListener('appStateChange', ({ isActive }) => {
        if (isActive) { resumed(); return; }
        // Android's notification access screen, opened from Payments from
        // your apps, backgrounds the app the same way the file picker does;
        // so do Google Play's purchase sheet and subscriptions page
        // (utils/externalFlow.ts).
        if (!__QA_BUILD__ && !lockHeld() && currentScreenRef.current !== AppScreen.IMPORT && currentScreenRef.current !== AppScreen.PAYMENT_APPS) {
          setIsLocked(true);
        }
      });

      // System back gesture / back button: navigate WITHIN the app instead
      // of exiting. An open sheet, dialog or panel closes first
      // (utils/backStack.ts); then sub-screen → its parent; any tab → Home;
      // Home → minimize (Android convention for a "root" screen), which also
      // engages the background lock.
      backHandle = await CapacitorApp.addListener('backButton', () => {
        if (closeNewestPanel()) return;
        const cur = currentScreenRef.current;
        const back = backOf(cur);
        if (back) {
          setCurrentScreen(back);
          window.scrollTo(0, 0);
        } else if (cur === AppScreen.NEW_ENTRY) {
          setCurrentScreen(AppScreen.DASHBOARD);
          window.scrollTo(0, 0);
        } else if (cur !== AppScreen.DASHBOARD) {
          setCurrentScreen(AppScreen.DASHBOARD);
          window.scrollTo(0, 0);
        } else {
          CapacitorApp.minimizeApp();
        }
      });
    })();
    return () => {
      if (listenerHandle && typeof listenerHandle.remove === 'function') {
        listenerHandle.remove();
      }
      if (backHandle && typeof backHandle.remove === 'function') {
        backHandle.remove();
      }
    };
  }, [user]);

  // A tapped phone notification opens its screen, behind the lock when the
  // app was in the background (services/phoneNotifier.ts).
  useEffect(() => {
    if (!user) return;
    return onPhoneNoteTap((screen, section) => {
      if (section) openAt(section);
      setCurrentScreen(screen);
      window.scrollTo(0, 0);
    });
  }, [user]);

  // Inactivity Lock Timer (throttled — mousemove fires continuously, so only
  // reset the countdown at most once per second; audit Phase 6.2)
  useEffect(() => {
    if (!user) return; // Don't lock if not logged in

    let timer: ReturnType<typeof setTimeout>;
    let lastReset = 0;
    const resetTimer = () => {
      const now = Date.now();
      if (now - lastReset < 1000) return;
      lastReset = now;
      if (timer) clearTimeout(timer);
      if (!isLocked) {
        timer = setTimeout(() => {
          setIsLocked(true);
        }, 15 * 60 * 1000); // 15 minutes as per spec
      }
    };

    window.addEventListener('mousemove', resetTimer);
    window.addEventListener('click', resetTimer);
    window.addEventListener('keypress', resetTimer);
    window.addEventListener('touchstart', resetTimer);

    resetTimer();

    return () => {
      clearTimeout(timer);
      window.removeEventListener('mousemove', resetTimer);
      window.removeEventListener('click', resetTimer);
      window.removeEventListener('keypress', resetTimer);
      window.removeEventListener('touchstart', resetTimer);
    };
  }, [isLocked, user]);

  const handleUnlock = () => {
    setIsLocked(false);
  };

  // Swipe gesture handling (attached to the app shell below)
  const swipeRef = useRef<{ x: number; y: number; t: number; skip: boolean } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    const el = e.target as HTMLElement;
    const skip = !!el.closest('.overflow-x-auto, .no-scrollbar, svg, input, textarea, select, canvas');
    swipeRef.current = { x: t.clientX, y: t.clientY, t: Date.now(), skip };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const s = swipeRef.current;
    swipeRef.current = null;
    if (!s || s.skip) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - s.x;
    const dy = t.clientY - s.y;
    // Fast, clearly horizontal, decisive swipes only.
    if (Date.now() - s.t > 600) return;
    if (Math.abs(dx) < 70 || Math.abs(dy) > 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    const cur = currentScreenRef.current;
    const tabIdx = TAB_ORDER.indexOf(cur);
    if (tabIdx !== -1) {
      const next = dx < 0 ? tabIdx + 1 : tabIdx - 1;
      if (next >= 0 && next < TAB_ORDER.length) handleNavigate(TAB_ORDER[next]);
    } else if (dx > 0) {
      const back = backOf(cur);
      if (back) handleNavigate(back);
    }
  };

  const handleNavigate = (screen: AppScreen) => {
    const from = currentScreenRef.current;
    if (screen === AppScreen.MONEY_MOVED && from !== AppScreen.MONEY_MOVED) movedFromRef.current = from;
    setCurrentScreen(screen);
    window.scrollTo(0,0);
  };

  const LoadingFallback = () => (
      <div className="h-full min-h-page bg-zen-bg flex items-center justify-center">
           <div className="h-10 w-10 rounded-full border-4 border-sage/20 border-t-sage animate-spin"></div>
      </div>
  );

  // Handle auth success - trigger splash before showing app
  const handleAuthSuccess = (type: AuthType) => {
    markTiming('signin:done');
    // The user JUST authenticated with their password — don't bounce them
    // into the session lock on top of it.
    setIsLocked(false);
    setSignedInThisRun(true);
    setAuthSplashPending(type);
    setSplashVariant(type);
    setShowSplash(true);
  };

  const handleSplashComplete = () => {
    setShowSplash(false);
    setAuthSplashPending(null);
    // If logging out, actually sign out after splash completes. That can take
    // a few seconds (unsynced changes get a chance to reach the cloud first)
    // and usually ends in a reload; the spinner covers it.
    if (isLoggingOut) {
      setIsLoggingOut(false);
      setSigningOut(true);
      setCurrentScreen(AppScreen.DASHBOARD); // Reset to dashboard for next login
      void signOutOfDevice().finally(() => setSigningOut(false));
    }
  };

  // Handle logout - show splash first, then sign out
  const handleLogout = () => {
    setIsLoggingOut(true);
    setSplashVariant('logout');
    setShowSplash(true);
  };

  // Show splash screen on initial load or after auth
  if (showSplash) {
    const splash = <SplashScreen variant={splashVariant} onComplete={handleSplashComplete} />;
    // After signing in, the wallet starts on its way under the welcome
    // splash: the same WalletProvider stays mounted into the app below, so a
    // device signing in for the first time has its entries two seconds sooner.
    return user && (splashVariant === 'login' || splashVariant === 'register')
      ? <WalletProvider>{splash}</WalletProvider>
      : splash;
  }

  if (loading || signingOut) {
      return <LoadingFallback />;
  }

  if (!user) {
      return (
        <>
          {IS_WEB && (
            <a
              href={WEBSITE_URL}
              className="fixed left-4 top-[calc(var(--sat)_+_1rem)] z-50 flex items-center gap-1 rounded-full bg-white/80 px-3.5 py-2 text-[13px] font-medium text-zen-charcoal shadow-soft backdrop-blur hover:text-premium-charcoal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage"
            >
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">arrow_back</span>
              About Wall·ette
            </a>
          )}
          <Auth onAuthSuccess={handleAuthSuccess} />
          <AndroidInstallBanner />
        </>
      );
  }

  if (isLocked) {
    return <SecurityLock onUnlock={handleUnlock} />;
  }

  const renderScreen = () => {
    switch (currentScreen) {
      case AppScreen.DASHBOARD:
        return <Dashboard onNavigate={handleNavigate} />;
      case AppScreen.HISTORY:
        return <TransactionHistory onNavigate={handleNavigate} />;
      case AppScreen.NEW_ENTRY:
        return (
          <PlanGate adds="add" title="New entry" back={AppScreen.DASHBOARD} onNavigate={handleNavigate}>
            <NewEntry onNavigate={handleNavigate} />
          </PlanGate>
        );
      case AppScreen.ANALYSIS:
        return <SpendAnalysis onNavigate={handleNavigate} />;
      case AppScreen.PULSE_TRENDS:
        return <SpendAnalysis onNavigate={handleNavigate} page="trends" />;
      case AppScreen.PULSE_CATEGORIES:
        return <SpendAnalysis onNavigate={handleNavigate} page="categories" />;
      case AppScreen.PULSE_RECURRING:
        return (
          <PlanGate feature="recurring" title="Recurring" back={AppScreen.ANALYSIS} onNavigate={handleNavigate}>
            <SpendAnalysis onNavigate={handleNavigate} page="recurring" />
          </PlanGate>
        );
      case AppScreen.PULSE_HEALTH:
        return <SpendAnalysis onNavigate={handleNavigate} page="health" />;
      case AppScreen.INCOME_INSIGHTS:
        return <IncomeInsights onNavigate={handleNavigate} />;
      case AppScreen.CATEGORY_SPLIT:
        return <CategorySplit onNavigate={handleNavigate} />;
      case AppScreen.MONEY_MOVED:
        return <MoneyMoved onNavigate={handleNavigate} backTo={movedFromRef.current} />;
      case AppScreen.BANK_ACCOUNTS:
        return <BankAccounts onNavigate={handleNavigate} />;
      case AppScreen.PAYMENT_APPS:
        return <PaymentsFromApps onNavigate={handleNavigate} />;
      case AppScreen.IMPORT:
        return (
          <PlanGate adds="import" title="Import a statement" back={AppScreen.DASHBOARD} onNavigate={handleNavigate}>
            <ImportStatement onNavigate={handleNavigate} />
          </PlanGate>
        );
      case AppScreen.EXPORT:
        return <ExportReports onNavigate={handleNavigate} />;
      case AppScreen.REWIND:
        return (
          <PlanGate feature="rewind" title="Rewind" back={AppScreen.DASHBOARD} onNavigate={handleNavigate}>
            <Rewind onNavigate={handleNavigate} />
          </PlanGate>
        );
      case AppScreen.LEFT_TO_SPEND:
        return <LeftToSpend onNavigate={handleNavigate} />;
      case AppScreen.SELF:
        return <Profile onNavigate={handleNavigate} onLogout={handleLogout} />;
      case AppScreen.SELF_ACCOUNT:
        return <Profile onNavigate={handleNavigate} onLogout={handleLogout} page="account" />;
      case AppScreen.SELF_ALERTS:
        return <Profile onNavigate={handleNavigate} onLogout={handleLogout} page="alerts" />;
      case AppScreen.SELF_DATA:
        return <Profile onNavigate={handleNavigate} onLogout={handleLogout} page="data" />;
      case AppScreen.SELF_APPEARANCE:
        return <Profile onNavigate={handleNavigate} onLogout={handleLogout} page="appearance" />;
      case AppScreen.SELF_ABOUT:
        return <Profile onNavigate={handleNavigate} onLogout={handleLogout} page="about" />;
      case AppScreen.SELF_PLAN:
        return <YourPlan onNavigate={handleNavigate} />;
      default:
        return <Dashboard onNavigate={handleNavigate} />;
    }
  };

  return (
    <WalletProvider>
      <div
        className="font-sans antialiased text-premium-charcoal bg-zen-bg min-h-page"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {/* Wide screens leave room for the navigation rail on the left
            (components/Navigation.tsx); phones and tablets use the dock. */}
        <div className="lg:pl-[240px]">
          <Suspense fallback={<LoadingFallback />}>
            {/* Keyed by screen, so each change plays its entrance: a page slides
                in over the one it opens from, going back slides the other way,
                tabs rise into place (tailwind animations; off with reduced motion). */}
            <div key={currentScreen} className={screenMotion}>
              {renderScreen()}
            </div>
          </Suspense>
        </div>
        <Navigation currentScreen={currentScreen} onNavigate={handleNavigate} showDock={!DOCKLESS.has(currentScreen)} />
        <AndroidInstallBanner />
      </div>
      {/* Outside the shell so swipes on its sheet or screen don't change tabs. */}
      <AppUpdates signedInThisRun={signedInThisRun} />
      <CloudSaveBanner />
      <PhoneNotifications />
      <PaymentIntake />
      <PlansHost />
    </WalletProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}