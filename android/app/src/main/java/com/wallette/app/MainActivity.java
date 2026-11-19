package com.wallette.app;

import android.content.pm.ApplicationInfo;
import android.os.Bundle;
import android.view.WindowManager;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

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
    }
}
