import React, { useState, useEffect, Suspense } from 'react';
import SecurityLock from './components/SecurityLock';
import Auth, { AuthType } from './components/Auth';
import Dashboard from './components/Dashboard';
import Navigation from './components/Navigation';
import SplashScreen, { SplashVariant } from './components/SplashScreen';
import { AppScreen } from './types';
import { WalletProvider } from './context/WalletContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

// Lazy Load Non-Critical Screens
const TransactionHistory = React.lazy(() => import('./components/TransactionHistory'));
const NewEntry = React.lazy(() => import('./components/NewEntry'));
const SpendAnalysis = React.lazy(() => import('./components/SpendAnalysis'));
const IncomeInsights = React.lazy(() => import('./components/IncomeInsights'));
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

  // Auto-logout when app goes to background (Mobile Security)
  useEffect(() => {
    if (!user) return;
    
    // Only enable on native mobile platforms
    if (Capacitor.isNativePlatform()) {
      const listener = CapacitorApp.addListener('appStateChange', ({ isActive }) => {
        if (!isActive) {
          // App went to background - auto logout for security
          console.log('🔒 App backgrounded - Auto logout triggered');
          import('./services/firebase').then(({ auth }) => {
            auth.signOut();
          });
        }
      });

      return () => {
        listener.remove();
      };
    }
  }, [user]);

  // Inactivity Lock Timer
  useEffect(() => {
    if (!user) return; // Don't lock if not logged in

    let timer: ReturnType<typeof setTimeout>;
    const resetTimer = () => {
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
      import('./services/firebase').then(({ auth }) => {
        auth.signOut();
        setIsLoggingOut(false);
        setCurrentScreen(AppScreen.DASHBOARD); // Reset to dashboard for next login
      });
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
      case AppScreen.INCOME_INSIGHTS:
        return <IncomeInsights onNavigate={handleNavigate} />;
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
          currentScreen === AppScreen.IGNORE_RULES ||
          currentScreen === AppScreen.INCOME_INSIGHTS
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