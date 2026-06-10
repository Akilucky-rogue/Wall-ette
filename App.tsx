import React, { useState, useEffect, useRef, Suspense } from 'react';

import SecurityLock from './components/SecurityLock';
import Auth, { AuthType } from './components/Auth';
import Dashboard from './components/Dashboard';
import Navigation from './components/Navigation';
import SplashScreen, { SplashVariant } from './components/SplashScreen';
import { AppScreen } from './types';
import { WalletProvider } from './context/WalletContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { auth } from './services/firebase';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

// Lazy Load Non-Critical Screens
const TransactionHistory = React.lazy(() => import('./components/TransactionHistory'));
const NewEntry = React.lazy(() => import('./components/NewEntry'));
const SpendAnalysis = React.lazy(() => import('./components/SpendAnalysis'));
const CategorySplit = React.lazy(() => import('./components/CategorySplit'));
const IgnoreRules = React.lazy(() => import('./components/IgnoreRules'));
const ImportStatement = React.lazy(() => import('./components/ImportStatement'));
const ExportReports = React.lazy(() => import('./components/ExportReports'));
const Profile = React.lazy(() => import('./components/Profile'));

function AppContent() {
  const { user, loading } = useAuth();
  const [isLocked, setIsLocked] = useState(false);
  const [currentScreen, setCurrentScreen] = useState<AppScreen>(AppScreen.DASHBOARD);
  const [showSplash, setShowSplash] = useState(true);
  const [splashVariant, setSplashVariant] = useState<SplashVariant>('launch');
  const [authSplashPending, setAuthSplashPending] = useState<AuthType | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Ref mirror so long-lived native listeners read the current screen without
  // re-registering on every navigation (audit Phase 6.2).
  const currentScreenRef = useRef(currentScreen);
  currentScreenRef.current = currentScreen;

  // Lock the app when it goes to background on native (Mobile Security).
  // We lock (requiring re-authentication on resume) rather than sign the user
  // out, so returning from a notification or quick context switch doesn't
  // nuke in-progress work. The IMPORT screen is exempt because the native
  // file picker briefly backgrounds the app.
  useEffect(() => {
    if (!user) return;
    if (!Capacitor.isNativePlatform()) return;

    let listenerHandle: any = null;
    (async () => {
      listenerHandle = await CapacitorApp.addListener('appStateChange', ({ isActive }) => {
        if (!isActive && currentScreenRef.current !== AppScreen.IMPORT) {
          setIsLocked(true);
        }
      });
    })();
    return () => {
      if (listenerHandle && typeof listenerHandle.remove === 'function') {
        listenerHandle.remove();
      }
    };
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

  const handleNavigate = (screen: AppScreen) => {
    setCurrentScreen(screen);
    window.scrollTo(0,0);
  };

  const LoadingFallback = () => (
      <div className="h-full min-h-screen bg-zen-bg flex items-center justify-center">
           <div className="size-10 rounded-full border-4 border-sage/20 border-t-sage animate-spin"></div>
      </div>
  );

  // Handle auth success - trigger splash before showing app
  const handleAuthSuccess = (type: AuthType) => {
    setAuthSplashPending(type);
    setSplashVariant(type);
    setShowSplash(true);
  };

  const handleSplashComplete = () => {
    setShowSplash(false);
    setAuthSplashPending(null);
    // If logging out, actually sign out after splash completes
    if (isLoggingOut) {
      auth.signOut();
      setIsLoggingOut(false);
      setCurrentScreen(AppScreen.DASHBOARD); // Reset to dashboard for next login
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
    return <SplashScreen variant={splashVariant} onComplete={handleSplashComplete} />;
  }

  if (loading) {
      return <LoadingFallback />;
  }

  if (!user) {
      return <Auth onAuthSuccess={handleAuthSuccess} />;
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
        return <NewEntry onNavigate={handleNavigate} />;
      case AppScreen.ANALYSIS:
        return <SpendAnalysis onNavigate={handleNavigate} />;
      case AppScreen.CATEGORY_SPLIT:
        return <CategorySplit onNavigate={handleNavigate} />;
      case AppScreen.IGNORE_RULES:
        return <IgnoreRules onNavigate={handleNavigate} />;
      case AppScreen.IMPORT:
        return <ImportStatement onNavigate={handleNavigate} />;
      case AppScreen.EXPORT:
        return <ExportReports onNavigate={handleNavigate} />;
      case AppScreen.SELF:
        return <Profile onNavigate={handleNavigate} onLogout={handleLogout} />;
      default:
        return <Dashboard onNavigate={handleNavigate} />;
    }
  };

  return (
    <WalletProvider>
      <div className="font-sans antialiased text-premium-charcoal bg-zen-bg min-h-screen">
        <Suspense fallback={<LoadingFallback />}>
            {renderScreen()}
        </Suspense>
        {(currentScreen === AppScreen.DASHBOARD ||
          currentScreen === AppScreen.HISTORY ||
          currentScreen === AppScreen.ANALYSIS ||
          currentScreen === AppScreen.CATEGORY_SPLIT ||
          currentScreen === AppScreen.SELF ||
          currentScreen === AppScreen.EXPORT ||
          currentScreen === AppScreen.IGNORE_RULES
        ) && (
          <Navigation currentScreen={currentScreen} onNavigate={handleNavigate} />
        )}
      </div>
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