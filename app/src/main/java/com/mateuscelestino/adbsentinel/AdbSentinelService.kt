package com.mateuscelestino.adbsentinel

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Binder
import android.os.Build
import android.os.IBinder
import android.util.Log
import androidx.core.app.NotificationCompat
import kotlinx.coroutines.*
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.ConcurrentHashMap

/**
 * 🛡️ AdbSentinelService — Serviço Central de Telemetria e Hub de Áudio do AeroSentinel
 * Fornece áudio cristalino sob demanda (Caixa de Som e Microfone) entre o macOS e o Galaxy S22 Ultra.
 */
class AdbSentinelService : Service() {
    private val binder = LocalBinder()
    private val serviceScope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private var isRunning = false

    // Estado dos recursos ativos sob demanda
    private val activeResources = ConcurrentHashMap.newKeySet<String>()

    inner class LocalBinder : Binder() {
        fun getService(): AdbSentinelService = this@AdbSentinelService
    }

    override fun onBind(intent: Intent?): IBinder = binder

    override fun onCreate() {
        super.onCreate()
        AdbLogStreamer.initContext(this)
        createNotificationChannels()
        startForegroundSafely("AeroSentinel: Pronto (Caixa de Som & Mic sob demanda)")
        startMonitoring()
        restoreGoodLockModules()

        // Inicializa servidores de áudio de alta performance (prontos para receber conexões instantâneas)
        AudioStreamManager.startSpeakerServer(applicationContext)
        AudioStreamManager.startMicServer(applicationContext)
        activeResources.add("SPEAKER")
        activeResources.add("MIC")
    }

    private fun restoreGoodLockModules() {
        serviceScope.launch {
            try {
                Runtime.getRuntime().exec(arrayOf("sh", "-c", "pm enable com.samsung.android.soundassistant 2>/dev/null && pm enable com.samsung.android.sidegesturepad 2>/dev/null"))
                val soundIntent = packageManager.getLaunchIntentForPackage("com.samsung.android.soundassistant")
                if (soundIntent != null) {
                    soundIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    startActivity(soundIntent)
                    delay(500)
                    Runtime.getRuntime().exec(arrayOf("sh", "-c", "input keyevent 3"))
                }
            } catch (e: Exception) {
                Log.w(TAG, "Aviso restauracao Good Lock: ${e.message}")
            }
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val action = intent?.action
        val resource = intent?.getStringExtra(EXTRA_RESOURCE_KEY)?.uppercase() ?: ""
        val requester = intent?.getStringExtra(EXTRA_REQUESTER_KEY) ?: "AeroSentinel Mac"
        Log.d(TAG, "onStartCommand action=$action resource=$resource requester=$requester")

        when (action) {
            null, "", "com.mateuscelestino.adbsentinel.START_SERVERS" -> {
                startResource("SPEAKER")
                startResource("MIC")
            }
            ACTION_REQUEST_RESOURCE, ACTION_START_RESOURCE -> {
                // Inicia imediatamente sem bloquear em caixas de diálogo
                startResource(resource)
            }
            ACTION_STOP_RESOURCE -> {
                stopResource(resource)
            }
            ACTION_STOP_ALL_RESOURCES, "com.mateuscelestino.adbsentinel.STOP_SERVERS" -> {
                stopAllResources()
            }
            ACTION_KILL_ALL -> {
                stopAllResources()
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                    stopForeground(STOP_FOREGROUND_REMOVE)
                } else {
                    @Suppress("DEPRECATION")
                    stopForeground(true)
                }
                stopSelf()
                return START_NOT_STICKY
            }
        }
        return START_STICKY
    }

    /**
     * Inicia pontualmente o recurso requisitado sob demanda imediatamente
     */
    fun startResource(resource: String) {
        when (resource) {
            "MIC", "MICROPHONE" -> {
                AudioStreamManager.startMicServer(applicationContext)
                activeResources.add("MIC")
                Log.i(TAG, "🟢 Microfone iniciado imediatamente na porta 8081.")
            }
            "SPEAKER", "AUDIO" -> {
                AudioStreamManager.startSpeakerServer(applicationContext)
                activeResources.add("SPEAKER")
                Log.i(TAG, "🟢 Alto-falante iniciado imediatamente na porta 8082.")
            }
            "DEX", "DESKTOP" -> {
                SamsungDeXController.startInputServer()
                activeResources.add("DEX")
                Log.i(TAG, "🟢 Samsung DeX Input iniciado na porta 8083.")
            }
        }
        updateStatusNotification()
    }

    /**
     * Interrompe um recurso específico
     */
    fun stopResource(resource: String) {
        when (resource) {
            "MIC", "MICROPHONE" -> {
                AudioStreamManager.stopMicServer()
                activeResources.remove("MIC")
                Log.i(TAG, "🔴 Microfone desligado.")
            }
            "SPEAKER", "AUDIO" -> {
                AudioStreamManager.stopSpeakerServer()
                activeResources.remove("SPEAKER")
                Log.i(TAG, "🔴 Alto-falante desligado.")
            }
            "DEX", "DESKTOP" -> {
                SamsungDeXController.stopInputServer()
                activeResources.remove("DEX")
                Log.i(TAG, "🔴 DeX Input desligado.")
            }
        }
        updateStatusNotification()
    }

    /**
     * Desliga todos os recursos compartilhados (retorna ao estado seguro OFF)
     */
    fun stopAllResources() {
        AudioStreamManager.stopMicServer()
        AudioStreamManager.stopSpeakerServer()
        SamsungDeXController.stopInputServer()
        activeResources.clear()
        Log.i(TAG, "🛡️ Todos os recursos de áudio e DeX foram desligados.")
        updateStatusNotification()
    }

    private fun updateStatusNotification() {
        if (activeResources.isEmpty()) {
            updateNotification("AeroSentinel: Pronto (Caixa de Som & Mic sob demanda)")
        } else {
            val list = activeResources.joinToString(", ")
            updateNotification("🟢 Áudio Ativo no Mac ($list)")
        }
    }

    private fun startForegroundSafely(text: String) {
        val notification = buildForegroundNotification(text)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            var fgsType = android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE
            if (activeResources.contains("MIC") && Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                fgsType = fgsType or android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE
            }
            if (activeResources.contains("SPEAKER")) {
                fgsType = fgsType or android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK
            }
            try {
                startForeground(NOTIFICATION_ID, notification, fgsType)
            } catch (e: Exception) {
                try {
                    startForeground(NOTIFICATION_ID, notification, android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE)
                } catch (e2: Exception) {
                    try {
                        startForeground(NOTIFICATION_ID, notification)
                    } catch (ignored: Exception) {}
                }
            }
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }
    }

    fun onAdbToggled(enabled: Boolean) {
        if (enabled) {
            updateNotification("AeroSentinel: Conexão Wireless Ativa")
            AdbLogStreamer.startStreaming(this)
        } else {
            updateNotification("AeroSentinel: Wireless ADB Pausado")
        }
    }

    private fun startMonitoring() {
        if (isRunning) return
        isRunning = true

        // 1. Inicia streamer de logs em tempo real
        AdbLogStreamer.startStreaming(this)

        // 2. Loop assíncrono leve de verificação de sockets a cada 2.0s
        serviceScope.launch {
            var lastConnectedIp: String? = null
            var lastEnabledState: Boolean? = null

            while (isActive && isRunning) {
                try {
                    val enabled = AdbSystemController.isWirelessAdbEnabled(this@AdbSentinelService)
                    if (!enabled) {
                        if (lastEnabledState != false) {
                            lastEnabledState = false
                            lastConnectedIp = null
                            AdbSocketTracker.clearActiveConnectionsCache()
                            updateNotification("AeroSentinel: Sistema ADB Pausado")
                        }
                    } else {
                        val connections = AdbSocketTracker.scanActiveConnections(this@AdbSentinelService, forceRefresh = true)
                        val established = connections.firstOrNull { it.state == "ESTABLISHED" }

                        if (established != null) {
                            val currentIp = established.remoteIp
                            if (currentIp != lastConnectedIp && currentIp != "0.0.0.0" && currentIp != "127.0.0.1") {
                                lastConnectedIp = currentIp
                                lastEnabledState = true
                                recordConnectionHistory(established)
                                updateNotification("Conexão Mac: $currentIp (Áudio: ${if (activeResources.isEmpty()) "OFF" else activeResources.joinToString()})")
                            }
                        } else if (lastConnectedIp != null || lastEnabledState != true) {
                            lastConnectedIp = null
                            lastEnabledState = true
                            updateStatusNotification()
                        }
                    }
                } catch (e: Exception) {
                    Log.e(TAG, "Erro no loop de sockets: ${e.message}")
                }
                delay(2000)
            }
        }
    }

    private fun recordConnectionHistory(connection: AdbConnection) {
        try {
            val prefs = getSharedPreferences("adb_sentinel_history", Context.MODE_PRIVATE)
            val currentRaw = prefs.getString("history_json", "[]") ?: "[]"
            val array = JSONArray(currentRaw)

            val item = JSONObject().apply {
                put("id", connection.id)
                put("remoteIp", connection.remoteIp)
                put("remotePort", connection.remotePort)
                put("type", connection.connectionType)
                put("state", connection.state)
                put("timestamp", System.currentTimeMillis())
            }

            val newArray = JSONArray()
            newArray.put(item)
            for (i in 0 until minOf(array.length(), 99)) {
                newArray.put(array.getJSONObject(i))
            }

            prefs.edit().putString("history_json", newArray.toString()).apply()
        } catch (e: Exception) {
            Log.e(TAG, "Erro ao salvar histórico: ${e.message}")
        }
    }

    fun getConnectionHistoryJson(): String {
        val prefs = getSharedPreferences("adb_sentinel_history", Context.MODE_PRIVATE)
        return prefs.getString("history_json", "[]") ?: "[]"
    }

    fun clearConnectionHistory() {
        val prefs = getSharedPreferences("adb_sentinel_history", Context.MODE_PRIVATE)
        prefs.edit().putString("history_json", "[]").apply()
    }

    fun stopEcosystemServers() {
        stopAllResources()
    }

    private fun createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val manager = getSystemService(NotificationManager::class.java)

            // Canal do Serviço Sentinel (Baixa prioridade, contínuo)
            val monitorChannel = NotificationChannel(
                CHANNEL_ID,
                "AeroSentinel Audio & Hub",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Monitoramento e controle de áudio e conexões do Mac"
            }
            manager.createNotificationChannel(monitorChannel)
        }
    }

    private fun buildForegroundNotification(contentText: String): Notification {
        val intent = Intent(this, MainActivity::class.java)
        val pendingIntent = PendingIntent.getActivity(
            this, 0, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("AeroSentinel")
            .setContentText(contentText)
            .setSmallIcon(R.drawable.ic_launcher)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
    }

    private fun updateNotification(text: String) {
        val manager = getSystemService(NotificationManager::class.java)
        manager.notify(NOTIFICATION_ID, buildForegroundNotification(text))
    }

    override fun onDestroy() {
        super.onDestroy()
        isRunning = false
        serviceScope.cancel()
        AdbLogStreamer.stopStreaming()
        stopAllResources()
    }

    companion object {
        private const val TAG = "AdbSentinelService"
        private const val CHANNEL_ID = "adb_sentinel_channel"
        private const val NOTIFICATION_ID = 5555

        const val ACTION_REQUEST_RESOURCE = "com.mateuscelestino.adbsentinel.REQUEST_RESOURCE"
        const val ACTION_START_RESOURCE = "com.mateuscelestino.adbsentinel.START_RESOURCE"
        const val ACTION_STOP_RESOURCE = "com.mateuscelestino.adbsentinel.STOP_RESOURCE"
        const val ACTION_STOP_ALL_RESOURCES = "com.mateuscelestino.adbsentinel.STOP_ALL_RESOURCES"
        const val ACTION_KILL_ALL = "com.mateuscelestino.adbsentinel.KILL_ALL"

        const val EXTRA_RESOURCE_KEY = "resource"
        const val EXTRA_REQUESTER_KEY = "requester"
    }
}
