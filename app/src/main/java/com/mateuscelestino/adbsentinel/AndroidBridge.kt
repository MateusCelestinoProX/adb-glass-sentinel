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

    @JavascriptInterface
    fun getEcosystemStatus(): String {
        val wifiIp = AdbSocketTracker.getDeviceWifiIp()
        val tailscaleIp = AdbSocketTracker.getTailscaleIp()
        val activePort = AdbSocketTracker.getActiveAdbPort()

        val obj = JSONObject().apply {
            put("wifiIp", wifiIp)
            put("tailscaleIp", tailscaleIp)
            put("adbPort", activePort)
            put("adbConnectLocal", "adb connect $wifiIp:$activePort")
            put("adbConnectTailscale", if (tailscaleIp.isNotEmpty()) "adb connect $tailscaleIp:5555" else "")
            put("isMicRunning", AudioStreamManager.isMicRunning)
            put("micPort", AudioStreamManager.MIC_PORT)
            put("micLocalUrl", "http://$wifiIp:${AudioStreamManager.MIC_PORT}/mic.wav")
            put("isSpeakerRunning", AudioStreamManager.isSpeakerRunning)
            put("speakerPort", AudioStreamManager.SPEAKER_PORT)
            put("speakerLocalUrl", "http://$wifiIp:${AudioStreamManager.SPEAKER_PORT}/stream")
            put("isDeXInputRunning", SamsungDeXController.isInputServerRunning)
            put("dexInputPort", SamsungDeXController.REMOTE_INPUT_PORT)
        }
        return obj.toString()
    }

    @JavascriptInterface
    fun toggleMicStream(enable: Boolean): String {
        vibrate(30)
        return if (enable) {
            val ok = AudioStreamManager.startMicServer(activity)
            if (ok) "STARTED" else "ERROR"
        } else {
            AudioStreamManager.stopMicServer()
            "STOPPED"
        }
    }

    @JavascriptInterface
    fun toggleSpeakerReceiver(enable: Boolean): String {
        vibrate(30)
        return if (enable) {
            val ok = AudioStreamManager.startSpeakerServer(activity)
            if (ok) "STARTED" else "ERROR"
        } else {
            AudioStreamManager.stopSpeakerServer()
            "STOPPED"
        }
    }

    @JavascriptInterface
    fun launchSamsungDeX(): String {
        vibrate(50)
        return SamsungDeXController.activateDeX(activity)
    }

    @JavascriptInterface
    fun killAll(): String {
        vibrate(120)
        // 1. Notifica o AeroSentinel no Mac (porta 8084) para encerrar processos no Mac
        Thread {
            try {
                val conns = AdbSocketTracker.scanActiveConnections(activity)
                val established = conns.firstOrNull { it.state == "ESTABLISHED" }
                val macIp = established?.remoteIp
                if (!macIp.isNullOrEmpty() && macIp != "127.0.0.1" && macIp != "0.0.0.0") {
                    val url = java.net.URL("http://$macIp:8084/killall")
                    val conn = url.openConnection() as java.net.HttpURLConnection
                    conn.connectTimeout = 800
                    conn.readTimeout = 800
                    conn.requestMethod = "GET"
                    conn.responseCode
                    conn.disconnect()
                }
            } catch (ignored: Exception) {}
        }.start()

        // 2. Encerra todos os servidores de ecossistema de áudio e DeX no Android
        AudioStreamManager.stopMicServer()
        AudioStreamManager.stopSpeakerServer()
        SamsungDeXController.stopInputServer()
        SamsungDeXController.exitDeX(activity)

        // 3. Encerra o serviço em segundo plano
        activity.sentinelService?.stopEcosystemServers()
        activity.sentinelService?.stopSelf()

        return "ALL_KILLED"
    }

    @JavascriptInterface
    fun forceRestartAdbTcp5555(): Boolean {
        vibrate(40)
        return try {
            Runtime.getRuntime().exec(arrayOf("sh", "-c", "setprop service.adb.tcp.port 5555 && stop adbd && start adbd"))
            true
        } catch (e: Exception) {
            false
        }
    }

    @JavascriptInterface
    fun getBackupNotifications(): String {
        return try {
            val file = java.io.File("/sdcard/AeroSentinel/backup_notifications.json")
            if (file.exists() && file.length() > 0) {
                file.readText()
            } else {
                val alt = java.io.File("/sdcard/ADBSentinel/backup_notifications.json")
                if (alt.exists() && alt.length() > 0) {
                    alt.readText()
                } else {
                    "[]"
                }
            }
        } catch (e: Exception) {
            "[]"
        }
    }
}
