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

class AdbSentinelService : Service() {
    private val binder = LocalBinder()
    private val serviceScope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private var isRunning = false

    inner class LocalBinder : Binder() {
        fun getService(): AdbSentinelService = this@AdbSentinelService
    }

    override fun onBind(intent: Intent?): IBinder = binder

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        startForeground(NOTIFICATION_ID, buildForegroundNotification("Sentinel Ativo: Monitorando Porta 5555"))
        startMonitoring()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        return START_STICKY
    }

    private fun startMonitoring() {
        if (isRunning) return
        isRunning = true

        // 1. Inicia streamer de logs em tempo real
        AdbLogStreamer.startStreaming()

        // 2. Loop de verificação de sockets a cada 1.5s
        serviceScope.launch {
            var lastConnectedIp: String? = null

            while (isActive && isRunning) {
                try {
                    val connections = AdbSocketTracker.scanActiveConnections()
                    val established = connections.firstOrNull { it.state == "ESTABLISHED" }

                    if (established != null) {
                        val currentIp = established.remoteIp
                        if (currentIp != lastConnectedIp && currentIp != "0.0.0.0" && currentIp != "127.0.0.1") {
                            lastConnectedIp = currentIp
                            recordConnectionHistory(established)
                            updateNotification("Conexão ADB Ativa: IP $currentIp")
                        }
                    } else if (lastConnectedIp != null) {
                        lastConnectedIp = null
                        updateNotification("Wireless ADB Aguardando Conexões...")
                    }
                } catch (e: Exception) {
                    Log.e(TAG, "Erro no loop de sockets: ${e.message}")
                }
                delay(1500)
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

            // Manter os 100 mais recentes
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

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "ADB Sentinel Monitor",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Monitoramento em tempo real de conexões e comandos ADB"
            }
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(channel)
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
    }

    companion object {
        private const val TAG = "AdbSentinelService"
        private const val CHANNEL_ID = "adb_sentinel_channel"
        private const val NOTIFICATION_ID = 5555
    }
}
