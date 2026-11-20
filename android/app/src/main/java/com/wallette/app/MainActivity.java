package com.wallette.app;

import android.content.pm.ApplicationInfo;
import android.os.Bundle;
import android.os.SystemClock;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.WebViewListener;
import com.google.firebase.crashlytics.FirebaseCrashlytics;

public class MainActivity extends BridgeActivity {

    // When this process last recovered from losing the WebView's renderer
    // (elapsedRealtime ms; -1 = never). Static, so it outlives recreate().
    private static long lastRendererLoss = -1;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // Balances and statements stay out of screenshots, screen recordings
        // and the recent-apps preview (audit M11). Set before the WebView is
        // created so no frame is shown without it. Debug builds leave screen
        // capture on, so test and store screenshots can still be taken there.
        boolean debuggable = (getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0;
        if (!debuggable) {
            getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE);
        }
        super.onCreate(savedInstanceState);

        bridge.addWebViewListener(new WebViewListener() {
            @Override
            public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
                return recoverFromRendererLoss(view, detail.didCrash());
            }
        });
    }

    /**
     * The WebView's renderer crashed, or Android killed it to free memory.
     * That WebView can't be used again, and unhandled, Chromium kills the
     * whole app in a way Crashlytics can't see. Report it and start this
     * screen again with a new WebView: the app opens locked, as after a
     * restart. A second loss within 30 seconds lets the app close instead,
     * so a renderer that dies on every load can't loop.
     */
    private boolean recoverFromRendererLoss(WebView view, boolean crashed) {
        FirebaseCrashlytics.getInstance().recordException(new RendererGone(crashed));
        long now = SystemClock.elapsedRealtime();
        if (lastRendererLoss >= 0 && now - lastRendererLoss < 30_000) {
            return false;
        }
        lastRendererLoss = now;
        // Out of the layout at once; Capacitor destroys it as the screen goes.
        if (view.getParent() instanceof ViewGroup) {
            ((ViewGroup) view.getParent()).removeView(view);
        }
        recreate();
        return true;
    }

    /** How Crashlytics files a lost renderer; the message says which kind. */
    static final class RendererGone extends RuntimeException {
        RendererGone(boolean crashed) {
            super(crashed ? "WebView renderer crashed" : "WebView renderer was killed to free memory");
        }
    }
}
