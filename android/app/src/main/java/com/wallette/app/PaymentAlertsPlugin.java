package com.wallette.app;

import android.content.ActivityNotFoundException;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.provider.Settings;
import androidx.core.app.NotificationManagerCompat;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.lang.ref.WeakReference;
import org.json.JSONException;

/**
 * The app's side of payments from notifications and of Share to Wall-ette
 * (services/paymentAlertsBridge.ts): whether notification access is allowed
 * and the listener connected, turning the feature on and off, Android's
 * access screen, the notices waiting to be read, and text shared to the app.
 * Events: "notice" when a payment notification is kept while the app is
 * running, "shared" when text is shared to it.
 */
@CapacitorPlugin(name = "PaymentAlerts")
public class PaymentAlertsPlugin extends Plugin {

    private static WeakReference<PaymentAlertsPlugin> current = new WeakReference<>(null);
    /** Text shared to the app and not yet taken. */
    private static String shared;
    private static final int MAX_SHARED = 5000;

    @Override
    public void load() {
        current = new WeakReference<>(this);
    }

    static void noticeArrived() {
        PaymentAlertsPlugin plugin = current.get();
        if (plugin != null) plugin.notifyListeners("notice", new JSObject());
    }

    static void shareArrived(CharSequence text) {
        if (text == null) return;
        String t = text.toString().trim();
        if (t.isEmpty()) return;
        synchronized (PaymentAlertsPlugin.class) {
            shared = t.length() > MAX_SHARED ? t.substring(0, MAX_SHARED) : t;
        }
        PaymentAlertsPlugin plugin = current.get();
        if (plugin != null) plugin.notifyListeners("shared", new JSObject());
    }

    private Context context() {
        return getContext().getApplicationContext();
    }

    private boolean hasAccess() {
        return NotificationManagerCompat.getEnabledListenerPackages(context()).contains(context().getPackageName());
    }

    @PluginMethod
    public void status(PluginCall call) {
        Context c = context();
        JSObject r = new JSObject();
        r.put("access", hasAccess());
        r.put("on", PaymentAlertStore.isOn(c));
        r.put("connectedAt", PaymentAlertStore.connectedAt(c));
        r.put("disconnectedAt", PaymentAlertStore.disconnectedAt(c));
        r.put("pending", PaymentAlertStore.pendingCount(c));
        JSArray installed = new JSArray();
        PackageManager pm = c.getPackageManager();
        for (String pkg : PaymentAlertListener.PACKAGES) {
            try {
                pm.getPackageInfo(pkg, 0);
                installed.put(pkg);
            } catch (PackageManager.NameNotFoundException ignored) {
                // Not on this phone.
            }
        }
        r.put("installed", installed);
        call.resolve(r);
    }

    @PluginMethod
    public void setOn(PluginCall call) {
        boolean on = Boolean.TRUE.equals(call.getBoolean("on", false));
        PaymentAlertStore.setOn(context(), on);
        if (on && hasAccess()) {
            PaymentAlertListener.requestRebind(new ComponentName(context(), PaymentAlertListener.class));
        }
        call.resolve();
    }

    /** Android's notification access screen: this app's own page where Android has one. */
    @PluginMethod
    public void openAccessSettings(PluginCall call) {
        Intent intent;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            intent = new Intent(Settings.ACTION_NOTIFICATION_LISTENER_DETAIL_SETTINGS);
            intent.putExtra(Settings.EXTRA_NOTIFICATION_LISTENER_COMPONENT_NAME,
                new ComponentName(context(), PaymentAlertListener.class).flattenToString());
        } else {
            intent = new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS);
        }
        try {
            getActivity().startActivity(intent);
        } catch (ActivityNotFoundException e) {
            try {
                getActivity().startActivity(new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS));
            } catch (ActivityNotFoundException e2) {
                call.reject("This phone has no notification access screen.");
                return;
            }
        }
        call.resolve();
    }

    /** Asks Android to connect the listener again (after a battery saver cut it off). */
    @PluginMethod
    public void reconnect(PluginCall call) {
        if (hasAccess()) PaymentAlertListener.requestRebind(new ComponentName(context(), PaymentAlertListener.class));
        call.resolve();
    }

    @PluginMethod
    public void pending(PluginCall call) {
        JSObject r = new JSObject();
        try {
            r.put("notices", new JSArray(PaymentAlertStore.pending(context()).toString()));
        } catch (JSONException e) {
            r.put("notices", new JSArray());
        }
        call.resolve(r);
    }

    @PluginMethod
    public void acknowledge(PluginCall call) {
        JSArray ids = call.getArray("ids");
        if (ids != null) PaymentAlertStore.acknowledge(context(), ids);
        call.resolve();
    }

    @PluginMethod
    public void takeShared(PluginCall call) {
        String text;
        synchronized (PaymentAlertsPlugin.class) {
            text = shared;
            shared = null;
        }
        JSObject r = new JSObject();
        if (text != null) r.put("text", text);
        call.resolve(r);
    }
}
