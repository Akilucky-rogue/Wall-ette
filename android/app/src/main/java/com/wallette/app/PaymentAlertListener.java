package com.wallette.app;

import android.app.Notification;
import android.content.ComponentName;
import android.content.pm.ApplicationInfo;
import android.os.Bundle;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;
import org.json.JSONException;
import org.json.JSONObject;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashSet;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Payments from payment and bank apps' notifications (from 1.6.0).
 *
 * Once the person allows notification access, Android hands this listener
 * every notification, whether Wall-ette is open or not. It keeps only those
 * from the apps in PACKAGES that show an amount, and only while the person
 * has "Payments from your apps" on; every other notification is dropped at
 * once, unread. It never reads a messaging app. What it keeps (the app,
 * title, text and times) waits in PaymentAlertStore, on the phone, until
 * Wall-ette opens and reads it; services/paymentAlerts.ts turns it into a
 * payment and the notice is deleted.
 *
 * Android 12+ lets the person choose which kinds of notification a listener
 * gets; the manifest asks for alerting and silent ones, not conversations.
 */
public class PaymentAlertListener extends NotificationListenerService {

    /** Must match PAYMENT_APPS in services/paymentAlerts.ts (scripts/check-payment-alerts.mjs checks). */
    static final Set<String> PACKAGES = Collections.unmodifiableSet(new HashSet<>(Arrays.asList(
        "com.google.android.apps.nbu.paisa.user", // Google Pay
        "com.phonepe.app",                        // PhonePe
        "net.one97.paytm",                        // Paytm
        "in.org.npci.upiapp",                     // BHIM
        "com.snapwork.hdfc",                      // HDFC Bank
        "com.sbi.lotusintouch",                   // YONO SBI
        "com.csam.icici.bank.imobile",            // ICICI iMobile
        "com.axis.mobile",                        // Axis Mobile
        "com.kotak.bank.mobile",                  // Kotak Bank
        "com.msf.kbank.mobile",                   // Kotak Bank (old app)
        "com.idfcfirstbank.optimus",              // IDFC FIRST Bank
        "com.infrasoft.uboi",                     // Union Bank Vyom
        "com.saraswatbank.retailbanking",         // Saraswat Bank GOMO NxT
        "com.saraswat.mobilebankingv2",           // Saraswat Bank (old app)
        "com.equitas.elevate"                     // Equitas
    )));

    /** An amount in rupees: only notifications that show one are kept. */
    private static final Pattern AMOUNT = Pattern.compile("(?:₹|\\b(?:rs\\.?|inr))\\s*:?\\s*[0-9]", Pattern.CASE_INSENSITIVE);
    /** One-time passwords are never kept, even from these apps. */
    private static final Pattern OTP = Pattern.compile("\\bOTP\\b|one[- ]time password|verification code", Pattern.CASE_INSENSITIVE);
    private static final int MAX_TEXT = 1000;

    /**
     * Debug builds only: a notification posted from the computer with
     * `adb shell cmd notification post <tag> <text>` and a tag of
     * "wallette-test:<package>" is read as if that app had posted it, so the
     * reader can be tried on an emulator without a payment app.
     */
    private static final String TEST_TAG = "wallette-test:";

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        keep(sbn);
    }

    @Override
    public void onListenerConnected() {
        PaymentAlertStore.markConnected(this, true);
        // Payments that arrived while the listener was cut off and still show.
        try {
            StatusBarNotification[] active = getActiveNotifications();
            if (active != null) for (StatusBarNotification sbn : active) keep(sbn);
        } catch (RuntimeException e) {
            // The system can refuse while it's still connecting; the next
            // payment arrives as usual.
        }
    }

    @Override
    public void onListenerDisconnected() {
        PaymentAlertStore.markConnected(this, false);
        // Ask Android to connect it again (a battery saver may have cut it off).
        requestRebind(new ComponentName(this, PaymentAlertListener.class));
    }

    private void keep(StatusBarNotification sbn) {
        if (sbn == null || !PaymentAlertStore.isOn(this)) return;
        String pkg = sbn.getPackageName();
        if (isDebuggable() && "com.android.shell".equals(pkg) && sbn.getTag() != null && sbn.getTag().startsWith(TEST_TAG)) {
            pkg = sbn.getTag().substring(TEST_TAG.length());
        }
        if (pkg == null || !PACKAGES.contains(pkg)) return;
        Notification n = sbn.getNotification();
        if (n == null || sbn.isOngoing() || (n.flags & Notification.FLAG_GROUP_SUMMARY) != 0) return;
        if (sbn.getPostTime() < PaymentAlertStore.since(this)) return;

        Bundle extras = n.extras;
        if (extras == null) return;
        String title = text(extras.getCharSequence(Notification.EXTRA_TITLE));
        String body = text(extras.getCharSequence(Notification.EXTRA_TEXT));
        String big = text(extras.getCharSequence(Notification.EXTRA_BIG_TEXT));
        String all = title + "\n" + body + "\n" + big;
        if (!AMOUNT.matcher(all).find() || OTP.matcher(all).find()) return;

        long when = n.when > 0 ? n.when : sbn.getPostTime();
        try {
            JSONObject notice = new JSONObject();
            notice.put("id", sbn.getKey() + "|" + when);
            notice.put("pkg", pkg);
            notice.put("key", sbn.getKey());
            notice.put("when", when);
            notice.put("posted", sbn.getPostTime());
            if (!title.isEmpty()) notice.put("title", title);
            if (!body.isEmpty()) notice.put("text", body);
            if (!big.isEmpty() && !big.equals(body)) notice.put("big", big);
            if (PaymentAlertStore.add(this, notice)) PaymentAlertsPlugin.noticeArrived();
        } catch (JSONException e) {
            // Not kept; nothing else to do.
        }
    }

    private boolean isDebuggable() {
        return (getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0;
    }

    private static String text(CharSequence s) {
        if (s == null) return "";
        String t = s.toString().trim();
        return t.length() > MAX_TEXT ? t.substring(0, MAX_TEXT) : t;
    }
}
