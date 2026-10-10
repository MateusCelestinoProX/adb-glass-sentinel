package com.mateuscelestino.adbsentinel

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.webkit.JavascriptInterface
import android.webkit.WebView
import org.json.JSONArray
import org.json.JSONObject

class AndroidBridge(
    private val activity: MainActivity,
    private val webView: WebView
) {
    @JavascriptInterface
    fun getAdbStatus(): String {
        val enabled = AdbSystemController.isWirelessAdbEnabled(activity)
        val wifiIp = AdbSocketTracker.getDeviceWifiIp()
        val connections = if (enabled) AdbSocketTracker.scanActiveConnections(activity) else emptyList()
        val established = connections.firstOrNull { it.state == "ESTABLISHED" }
        val adbdState = AdbSystemController.getSystemProperty("init.svc.adbd", if (enabled) "running" else "stopped")

        val activePort = established?.localPort ?: AdbSocketTracker.getActiveAdbPort()

        val obj = JSONObject().apply {
            put("wirelessEnabled", enabled)
            put("adbdState", adbdState)
            put("wifiIp", wifiIp)
            put("port", if (activePort > 0) activePort else 5555)
            put("activeConnectionCount", connections.count { it.state == "ESTABLISHED" })
            put("connectedHostIp", established?.remoteIp ?: "")
            put("connectedHostPort", established?.remotePort ?: 0)
            put("connectionType", established?.connectionType ?: "NONE")
        }
        return obj.toString()
    }

    @JavascriptInterface
    fun toggleWirelessAdb(enable: Boolean): Boolean {
        vibrate(35)
        val result = if (enable) {
            AdbSystemController.enableWirelessAdb(activity)
        } else {
            AdbSystemController.disableWirelessAdb(activity)
        }
        activity.sentinelService?.onAdbToggled(enable)
        return result
    }

    @JavascriptInterface
    fun getActiveConnections(): String {
        val enabled = AdbSystemController.isWirelessAdbEnabled(activity)
        val list = if (enabled) AdbSocketTracker.scanActiveConnections(activity) else emptyList()
        val array = JSONArray()
        list.forEach { conn ->
            val obj = JSONObject().apply {
                put("id", conn.id)
                put("localIp", conn.localIp)
                put("localPort", conn.localPort)
                put("remoteIp", conn.remoteIp)
                put("remotePort", conn.remotePort)
                put("state", conn.state)
                put("type", conn.connectionType)
                put("timestamp", conn.timestamp)
            }
            array.put(obj)
        }
        return array.toString()
    }

    @JavascriptInterface
    fun getRecentCommands(): String {
        val history = AdbLogStreamer.getHistory()
        val array = JSONArray()
        history.forEach { cmd ->
            val obj = JSONObject().apply {
                put("id", cmd.id)
                put("timestamp", cmd.timestamp)
                put("dateFormatted", cmd.dateFormatted)
                put("timeFormatted", cmd.timeFormatted)
                put("millisFormatted", cmd.millisFormatted)
                put("epochMs", cmd.epochMs)
                put("command", cmd.command)
                put("clientIp", cmd.clientIp)
                put("serviceType", cmd.serviceType)
                put("isPrivileged", cmd.isPrivileged)
            }
            array.put(obj)
        }
        return array.toString()
    }

    @JavascriptInterface
    fun getAuthorizedKeys(): String {
        val keys = AdbSystemController.getAuthorizedKeys(activity)
        val array = JSONArray()
        keys.forEach { k ->
            val obj = JSONObject().apply {
                put("keyId", k.keyId)
                put("comment", k.comment)
                put("rawKey", k.rawKey)
            }
            array.put(obj)
        }
        return array.toString()
    }

    @JavascriptInterface
    fun allowDebugging(always: Boolean, publicKey: String): Boolean {
        vibrate(40)
        return AdbSystemController.allowDebugging(always, publicKey)
    }

    @JavascriptInterface
    fun denyDebugging(): Boolean {
        vibrate(60)
        val res = AdbSystemController.denyDebugging()
        AdbSocketTracker.clearActiveConnectionsCache()
        return res
    }

    @JavascriptInterface
    fun clearAllKeys(): Boolean {
        vibrate(80)
        val res = AdbSystemController.clearDebuggingKeys()
        AdbSocketTracker.clearActiveConnectionsCache()
        return res
    }

    @JavascriptInterface
    fun getConnectionHistory(): String {
        return activity.sentinelService?.getConnectionHistoryJson() ?: "[]"
    }

    @JavascriptInterface
    fun clearHistory(): Boolean {
        vibrate(30)
        activity.sentinelService?.clearConnectionHistory()
        AdbLogStreamer.clearHistory()
        return true
    }

    @JavascriptInterface
    fun copyToClipboard(text: String) {
        activity.runOnUiThread {
            try {
                val clipboard = activity.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                val clip = ClipData.newPlainText("ADB Sentinel", text)
                clipboard.setPrimaryClip(clip)
                vibrate(20)
            } catch (ignored: Exception) {}
        }
    }

    @JavascriptInterface
    fun vibrate(durationMs: Int) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val vm = activity.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager
                vm?.defaultVibrator?.vibrate(VibrationEffect.createOneShot(durationMs.toLong(), VibrationEffect.DEFAULT_AMPLITUDE))
            } else {
                @Suppress("DEPRECATION")
                val v = activity.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    v?.vibrate(VibrationEffect.createOneShot(durationMs.toLong(), VibrationEffect.DEFAULT_AMPLITUDE))
                } else {
                    @Suppress("DEPRECATION")
                    v?.vibrate(durationMs.toLong())
                }
            }
        } catch (ignored: Exception) {}
    }

    @JavascriptInterface
    fun getSafeTop(): Float = maxOf(activity.lastSafeTopDp, 48f)

    @JavascriptInterface
    fun getSafeBottom(): Float = maxOf(activity.lastSafeBottomDp, 20f)
}
