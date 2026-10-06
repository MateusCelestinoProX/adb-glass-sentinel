# Keep AndroidBridge methods
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
