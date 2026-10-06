package com.mateuscelestino.adbsentinel

import android.annotation.SuppressLint
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.ServiceConnection
import android.graphics.Color
import android.os.Build
import android.os.Bundle
import android.os.IBinder
import android.util.Log
import android.view.View
import android.view.WindowInsets
import android.webkit.*
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import org.json.JSONObject

class MainActivity : AppCompatActivity() {
    private lateinit var webView: WebView
    var sentinelService: AdbSentinelService? = null
    private var isServiceBound = false

    var lastSafeTopDp = 48f
    var lastSafeBottomDp = 20f

    private val serviceConnection = object : ServiceConnection {
        override fun onServiceConnected(name: ComponentName?, service: IBinder?) {
            val binder = service as? AdbSentinelService.LocalBinder
            sentinelService = binder?.getService()
            isServiceBound = true
            Log.i("MainActivity", "AdbSentinelService conectado.")
        }

        override fun onServiceDisconnected(name: ComponentName?) {
            sentinelService = null
            isServiceBound = false
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Borda a borda & Tema Escuro Obsidian
        WindowCompat.setDecorFitsSystemWindows(window, false)
        window.statusBarColor = Color.TRANSPARENT
        window.navigationBarColor = Color.TRANSPARENT

        webView = WebView(this).apply {
            setBackgroundColor(Color.parseColor("#05070C"))
            setLayerType(View.LAYER_TYPE_HARDWARE, null)
        }
        setContentView(webView)

        configureWebView()
        setupInsetsListener()
        startAndBindService()
        setupCommandStreamToUi()

        webView.loadUrl("file:///android_asset/web/index.html")
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun configureWebView() {
        val settings = webView.settings
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.databaseEnabled = true
        settings.allowFileAccess = true
        settings.allowContentAccess = true
        settings.loadsImagesAutomatically = true
        settings.mediaPlaybackRequiresUserGesture = false
        settings.cacheMode = WebSettings.LOAD_NO_CACHE

        webView.addJavascriptInterface(AndroidBridge(this, webView), "AndroidBridge")

        webView.webChromeClient = object : WebChromeClient() {
            override fun onConsoleMessage(consoleMessage: ConsoleMessage?): Boolean {
                Log.d("AdbSentinelWeb", "${consoleMessage?.message()} -- From line ${consoleMessage?.lineNumber()} of ${consoleMessage?.sourceId()}")
                return true
            }
        }

        webView.webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                injectSafeInsets()
            }
        }
    }

    private fun setupInsetsListener() {
        val density = resources.displayMetrics.density
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            window.decorView.setOnApplyWindowInsetsListener { _, insets ->
                val statusBarInsets = insets.getInsets(WindowInsets.Type.statusBars())
                val navBarInsets = insets.getInsets(WindowInsets.Type.navigationBars())
                val cutoutInsets = insets.getInsets(WindowInsets.Type.displayCutout())

                val topPx = maxOf(statusBarInsets.top, cutoutInsets.top)
                val bottomPx = maxOf(navBarInsets.bottom, cutoutInsets.bottom)

                lastSafeTopDp = maxOf(topPx / density, 48f)
                lastSafeBottomDp = maxOf(bottomPx / density, 20f)
                injectSafeInsets()
                insets
            }
        }
    }

    fun injectSafeInsets() {
        val js = """
            (function() {
                document.documentElement.style.setProperty('--safe-top', '${lastSafeTopDp}px');
                document.documentElement.style.setProperty('--safe-bottom', '${lastSafeBottomDp}px');
                if (window.dispatchEvent) {
                    window.dispatchEvent(new CustomEvent('safe_insets_updated', { detail: { top: ${lastSafeTopDp}, bottom: ${lastSafeBottomDp} } }));
                }
            })();
        """.trimIndent()
        webView.evaluateJavascript(js, null)
    }

    private fun startAndBindService() {
        val intent = Intent(this, AdbSentinelService::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(intent)
        } else {
            startService(intent)
        }
        bindService(intent, serviceConnection, Context.BIND_AUTO_CREATE)
    }

    private fun setupCommandStreamToUi() {
        AdbLogStreamer.addListener { event ->
            runOnUiThread {
                try {
                    val obj = JSONObject().apply {
                        put("id", event.id)
                        put("timestamp", event.timestamp)
                        put("command", event.command)
                        put("clientIp", event.clientIp)
                        put("serviceType", event.serviceType)
                        put("isPrivileged", event.isPrivileged)
                    }
                    val jsonStr = JSONObject.quote(obj.toString())
                    webView.evaluateJavascript("window.onAdbCommandReceived && window.onAdbCommandReceived(JSON.parse($jsonStr));", null)
                } catch (e: Exception) {
                    Log.e("MainActivity", "Erro avaliando JS de streaming: ${e.message}")
                }
            }
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        if (isServiceBound) {
            unbindService(serviceConnection)
            isServiceBound = false
        }
    }
}
