# R8 rules for release builds (android/app/build.gradle).
#
# Capacitor ships rules that keep every plugin class with its @PluginMethod
# methods, which the bridge looks up by name and annotation
# (node_modules/@capacitor/android/capacitor/proguard-rules.pro), and AGP's
# proguard-android-optimize.txt keeps annotations. These cover the rest.

# Methods the page calls through addJavascriptInterface (Capacitor's bridge,
# SystemBars). AGP's defaults keep them too; said here so the bridge doesn't
# depend on that.
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Line numbers in Java stack traces for Crashlytics, which maps the short
# names back with the mapping file its Gradle plugin uploads.
-keepattributes SourceFile,LineNumberTable
