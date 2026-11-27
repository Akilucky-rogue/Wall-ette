package com.wallette.app;

import android.content.Context;
import android.content.SharedPreferences;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;
import java.util.Iterator;

/**
 * Where PaymentAlertListener keeps payment notifications until Wall-ette
 * reads them: this app's private storage on the phone, never backed up
 * (AndroidManifest.xml allowBackup="false"). Each notice is deleted once the
 * app has read it (acknowledge); its id is remembered for a week so the same
 * notification, still showing when the listener reconnects, isn't read twice.
 * The listener and the plugin call in from different threads, so every
 * change happens under one lock.
 */
final class PaymentAlertStore {
    private static final String PREFS = "wallette_payment_alerts";
    private static final String ON = "on";
    private static final String SINCE = "since";
    private static final String PENDING = "pending";
    private static final String SEEN = "seen";
    private static final String CONNECTED = "connected";
    private static final String DISCONNECTED = "disconnected";

    /** At most this many unread notices; the oldest go first. */
    static final int MAX_PENDING = 300;
    private static final long WEEK_MS = 7L * 24 * 60 * 60 * 1000;
    private static final Object LOCK = new Object();

    private PaymentAlertStore() {}

    private static SharedPreferences prefs(Context context) {
        return context.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    /** Whether the person has the feature on, and since when (ms; 0 when off). */
    static boolean isOn(Context context) {
        return prefs(context).getBoolean(ON, false);
    }

    static long since(Context context) {
        return prefs(context).getLong(SINCE, 0);
    }

    /** Turning it off forgets every unread notice. */
    static void setOn(Context context, boolean on) {
        synchronized (LOCK) {
            SharedPreferences p = prefs(context);
            if (on == p.getBoolean(ON, false)) return;
            SharedPreferences.Editor e = p.edit().putBoolean(ON, on);
            if (on) e.putLong(SINCE, System.currentTimeMillis());
            else e.remove(SINCE).remove(PENDING).remove(SEEN);
            e.apply();
        }
    }

    static void markConnected(Context context, boolean connected) {
        prefs(context).edit().putLong(connected ? CONNECTED : DISCONNECTED, System.currentTimeMillis()).apply();
    }

    static long connectedAt(Context context) {
        return prefs(context).getLong(CONNECTED, 0);
    }

    static long disconnectedAt(Context context) {
        return prefs(context).getLong(DISCONNECTED, 0);
    }

    private static JSONArray array(SharedPreferences p, String key) {
        try {
            return new JSONArray(p.getString(key, "[]"));
        } catch (JSONException e) {
            return new JSONArray();
        }
    }

    private static JSONObject object(SharedPreferences p, String key) {
        try {
            return new JSONObject(p.getString(key, "{}"));
        } catch (JSONException e) {
            return new JSONObject();
        }
    }

    /**
     * Keeps one notice. An update of a notice not read yet replaces it; one
     * the app has already read is ignored. Returns whether it was kept.
     */
    static boolean add(Context context, JSONObject notice) {
        synchronized (LOCK) {
            SharedPreferences p = prefs(context);
            if (!p.getBoolean(ON, false)) return false;
            String id = notice.optString("id");
            if (id.isEmpty() || object(p, SEEN).has(id)) return false;
            JSONArray pending = array(p, PENDING);
            JSONArray next = new JSONArray();
            for (int i = 0; i < pending.length(); i++) {
                JSONObject n = pending.optJSONObject(i);
                if (n != null && !id.equals(n.optString("id"))) next.put(n);
            }
            next.put(notice);
            while (next.length() > MAX_PENDING) next.remove(0);
            p.edit().putString(PENDING, next.toString()).apply();
            return true;
        }
    }

    /** Every unread notice, oldest first. */
    static JSONArray pending(Context context) {
        synchronized (LOCK) {
            return array(prefs(context), PENDING);
        }
    }

    static int pendingCount(Context context) {
        return pending(context).length();
    }

    /** Forgets the notices the app has read, remembering their ids for a week. */
    static void acknowledge(Context context, JSONArray ids) {
        synchronized (LOCK) {
            SharedPreferences p = prefs(context);
            long now = System.currentTimeMillis();
            JSONObject seen = object(p, SEEN);
            for (Iterator<String> it = seen.keys(); it.hasNext(); ) {
                if (now - seen.optLong(it.next(), 0) > WEEK_MS) it.remove();
            }
            JSONArray pending = array(p, PENDING);
            JSONArray next = new JSONArray();
            for (int i = 0; i < pending.length(); i++) {
                JSONObject n = pending.optJSONObject(i);
                if (n == null) continue;
                String id = n.optString("id");
                boolean read = false;
                for (int j = 0; j < ids.length(); j++) {
                    if (id.equals(ids.optString(j))) { read = true; break; }
                }
                if (!read) next.put(n);
            }
            try {
                for (int j = 0; j < ids.length(); j++) seen.put(ids.optString(j), now);
            } catch (JSONException ignored) {
                // A key can't be null here; nothing to do.
            }
            p.edit().putString(PENDING, next.toString()).putString(SEEN, seen.toString()).apply();
        }
    }
}
