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

class AdbSentinelService : Service() {
    private val binder = LocalBinder()
    private val serviceScope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private var isRunning = false

    // Estado dos recursos sob demanda (OFF por padrão)
    private val activeResources = ConcurrentHashMap.newKeySet<String>()

    inner class LocalBinder : Binder() {
        fun getService(): AdbSentinelService = this@AdbSentinelService
    }

    override fun onBind(intent: Intent?): IBinder = binder

    override fun onCreate() {
        super.onCreate()
        AdbLogStreamer.initContext(this)
        createNotificationChannels()
        startForegroundSafely("Sentinel: Recursos Compartilhados OFF (Zero-Trust Ativo)")
        startMonitoring()
        // NOTA DE SEGURANÇA: Recursos de Câmera, Áudio e DeX iniciam rigorosamente OFF por padrão
        restoreGoodLockModules()
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
        val requester = intent?.getStringExtra(EXTRA_REQUESTER_KEY) ?: "MacAeroHub (MacBook Pro)"

        when (action) {
            ACTION_REQUEST_RESOURCE -> {
                // Dispara alerta visual completo no Android (Notificação Heads-up + Diálogo)
                showResourceAccessAlert(resource, requester)
            }
            ACTION_START_RESOURCE -> {
                // Inicia exclusivamente o recurso aprovado
                startResource(resource)
            }
            ACTION_STOP_RESOURCE -> {
                // Desativa o recurso solicitado
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
     * 🚨 Exibe um alerta de segurança completamente visível quando o Mac solicita acesso
     */
    fun showResourceAccessAlert(resource: String, requester: String) {
        val resourceTitle = when (resource) {
            "CAMERA", "WEBCAM" -> "Câmera Traseira HD (Porta 8080)"
            "MIC", "MICROPHONE" -> "Microfone de Estúdio (Porta 8081)"
            "SPEAKER", "AUDIO" -> "Alto-falante do Celular (Porta 8082)"
            "DEX", "DESKTOP" -> "Samsung DeX & Touchpad (Porta 8083)"
            else -> resource
        }

        // 1. Notificação Heads-Up de Alta Prioridade com Ações Rápidas
        val manager = getSystemService(NotificationManager::class.java)

        // Intent de Autorização
        val allowIntent = Intent(this, AdbSentinelService::class.java).apply {
            action = ACTION_START_RESOURCE
            putExtra(EXTRA_RESOURCE_KEY, resource)
        }
        val allowPending = PendingIntent.getService(
            this, 101, allowIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // Intent de Negação
        val denyIntent = Intent(this, AdbSentinelService::class.java).apply {
            action = ACTION_STOP_RESOURCE
            putExtra(EXTRA_RESOURCE_KEY, resource)
        }
        val denyPending = PendingIntent.getService(
            this, 102, denyIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val alertNotification = NotificationCompat.Builder(this, CHANNEL_SECURITY_ALERT_ID)
            .setContentTitle("🚨 SOLICITAÇÃO DE ACESSO REMOTO")
            .setContentText("$requester solicitou acesso a: $resourceTitle")
            .setSmallIcon(R.drawable.ic_launcher)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setAutoCancel(true)
            .addAction(android.R.drawable.ic_delete, "NEGAR", denyPending)
            .addAction(android.R.drawable.ic_menu_camera, "AUTORIZAR", allowPending)
            .setVibrate(longArrayOf(0, 150, 100, 150))
            .build()

        manager.notify(NOTIFICATION_ALERT_ID, alertNotification)

        // 2. Abre a tela de diálogo visual completa na tela do celular
        try {
            val dialogIntent = Intent(this, SentinelSecurityAlertActivity::class.java).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
                putExtra(SentinelSecurityAlertActivity.EXTRA_RESOURCE, resource)
                putExtra(SentinelSecurityAlertActivity.EXTRA_REQUESTER, requester)
            }
            startActivity(dialogIntent)
        } catch (e: Exception) {
            Log.e(TAG, "Erro ao abrir SentinelSecurityAlertActivity: ${e.message}")
        }
    }

    /**
     * Inicia pontualmente o recurso requisitado sob demanda
     */
    fun startResource(resource: String) {
        val manager = getSystemService(NotificationManager::class.java)
        manager.cancel(NOTIFICATION_ALERT_ID) // Limpa o alerta pendente

        when (resource) {
            "CAMERA", "WEBCAM" -> {
                WebcamStreamServer.start(applicationContext, "BACK")
                activeResources.add("CAMERA")
                Log.i(TAG, "🟢 Câmera Traseira HD autorizada e iniciada na porta 8080.")
            }
            "MIC", "MICROPHONE" -> {
                AudioStreamManager.startMicServer(applicationContext)
                activeResources.add("MIC")
                Log.i(TAG, "🟢 Microfone autorizado e iniciado na porta 8081.")
            }
            "SPEAKER", "AUDIO" -> {
                AudioStreamManager.startSpeakerServer(applicationContext)
                activeResources.add("SPEAKER")
                Log.i(TAG, "🟢 Alto-falante autorizado e iniciado na porta 8082.")
            }
            "DEX", "DESKTOP" -> {
                SamsungDeXController.startInputServer()
                activeResources.add("DEX")
                Log.i(TAG, "🟢 Samsung DeX Input autorizado e iniciado na porta 8083.")
            }
        }
        updateStatusNotification()
    }

    /**
     * Interrompe um recurso específico
     */
    fun stopResource(resource: String) {
        val manager = getSystemService(NotificationManager::class.java)
        manager.cancel(NOTIFICATION_ALERT_ID)

        when (resource) {
            "CAMERA", "WEBCAM" -> {
                WebcamStreamServer.stop()
                activeResources.remove("CAMERA")
                Log.i(TAG, "🔴 Câmera desligada.")
            }
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
        WebcamStreamServer.stop()
        AudioStreamManager.stopMicServer()
        AudioStreamManager.stopSpeakerServer()
        SamsungDeXController.stopInputServer()
        activeResources.clear()
        Log.i(TAG, "🛡️ Todos os recursos compartilhados foram desligados (OFF).")
        updateStatusNotification()
    }

    private fun updateStatusNotification() {
        if (activeResources.isEmpty()) {
            updateNotification("Sentinel: Recursos Compartilhados OFF (Zero-Trust Ativo)")
        } else {
            val list = activeResources.joinToString(", ")
            updateNotification("🔴 RECURSO EM USO ($list) autorizado pelo usuário")
        }
    }

    private fun startForegroundSafely(text: String) {
        val notification = buildForegroundNotification(text)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            var fgsType = android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE
            if (activeResources.contains("MIC") && Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                fgsType = fgsType or android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE
            }
            if (activeResources.contains("CAM") && Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                fgsType = fgsType or android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_CAMERA
            }
            try {
                startForeground(NOTIFICATION_ID, notification, fgsType)
            } catch (e: Exception) {
                Log.w(TAG, "Aviso ao iniciar FGS com fgsType: ${e.message}, tentando specialUse exclusivo")
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
            updateNotification("Sentinel Ativo: Recursos Compartilhados OFF por Padrão")
            AdbLogStreamer.startStreaming(this)
        } else {
            updateNotification("Sistema ADB Parado (Protegido pelo Sentinel)")
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
                            updateNotification("Sistema ADB Parado (Protegido pelo Sentinel)")
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
                                updateNotification("Conexão ADB: $currentIp (Recursos: ${if (activeResources.isEmpty()) "OFF" else activeResources.joinToString()})")
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

            // 1. Canal do Serviço Sentinel (Baixa prioridade, contínuo)
            val monitorChannel = NotificationChannel(
                CHANNEL_ID,
                "ADB Sentinel Monitor",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Monitoramento e status de recursos de segurança"
            }
            manager.createNotificationChannel(monitorChannel)

            // 2. Canal de Alertas de Segurança (Alta prioridade, Heads-up popup e som)
            val alertChannel = NotificationChannel(
                CHANNEL_SECURITY_ALERT_ID,
                "Alertas de Acesso Remoto",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Solicitações de ativação de câmera, microfone e controle remoto"
                enableVibration(true)
                vibrationPattern = longArrayOf(0, 150, 100, 150)
            }
            manager.createNotificationChannel(alertChannel)
        }
    }

    private fun buildForegroundNotification(contentText: String): Notification {
        val intent = Intent(this, MainActivity::class.java)
        val pendingIntent = PendingIntent.getActivity(
            this, 0, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("ADB Glass Sentinel")
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
        private const val CHANNEL_SECURITY_ALERT_ID = "adb_sentinel_security_alert"
        private const val NOTIFICATION_ID = 5555
        private const val NOTIFICATION_ALERT_ID = 5556

        const val ACTION_REQUEST_RESOURCE = "com.mateuscelestino.adbsentinel.REQUEST_RESOURCE"
        const val ACTION_START_RESOURCE = "com.mateuscelestino.adbsentinel.START_RESOURCE"
        const val ACTION_STOP_RESOURCE = "com.mateuscelestino.adbsentinel.STOP_RESOURCE"
        const val ACTION_STOP_ALL_RESOURCES = "com.mateuscelestino.adbsentinel.STOP_ALL_RESOURCES"
        const val ACTION_KILL_ALL = "com.mateuscelestino.adbsentinel.KILL_ALL"

        const val EXTRA_RESOURCE_KEY = "resource"
        const val EXTRA_REQUESTER_KEY = "requester"
    }
}
