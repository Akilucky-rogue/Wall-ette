import { useEffect, useSyncExternalStore } from 'react';
import { useWallet } from '../context/WalletContext';
import { useAuth } from '../context/AuthContext';
import {
  billReminders, currentAlerts, loadShown, markShown, newAlerts, phoneNotificationsOn, saveShown, subscribePhoneSwitch,
} from '../services/phoneNotifications';
import { postPhoneNotes } from '../services/phoneNotifier';
import { usePlan } from '../services/plan';
import { opens } from '../services/planRules';

/** How long the wallet has to sit still before the phone's notes are planned again (imports change it many times). */
const SETTLE_MS = 2500;

/**
 * Keeps the phone's bill reminders and budget alerts in step with the wallet
 * (services/phoneNotifications.ts), while phone notifications are switched
 * on. Renders nothing.
 */
const PhoneNotifications: React.FC = () => {
  const { counted, budgets, dailyLimit, formatWhole } = useWallet();
  const uid = useAuth().user?.uid ?? null;
  const on = useSyncExternalStore(subscribePhoneSwitch, () => (uid ? phoneNotificationsOn(uid) : false));
  // Bill reminders come from recurring tracking: Plus, or before plans start.
  const recurring = opens(usePlan().access, 'recurring');

  useEffect(() => {
    if (!uid || !on) return;
    const timer = setTimeout(() => {
      const now = new Date();
      const money = formatWhole;
      const bills = recurring ? billReminders(counted, now, money) : [];
      const fresh = newAlerts(currentAlerts({ counted, budgets, dailyLimit, now, money }), loadShown(uid));
      void postPhoneNotes(bills, fresh).then(posted => {
        if (posted && fresh.length) saveShown(uid, markShown(loadShown(uid), fresh.map(a => a.key), Date.now()));
      });
    }, SETTLE_MS);
    return () => clearTimeout(timer);
  }, [uid, on, counted, budgets, dailyLimit, formatWhole, recurring]);

  return null;
};

export default PhoneNotifications;
