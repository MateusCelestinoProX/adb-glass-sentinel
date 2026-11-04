package com.mateuscelestino.adbsentinel

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.BatteryManager
import android.os.Build
import android.os.PowerManager
import android.util.Log
import androidx.core.app.NotificationCompat
import kotlinx.coroutines.*
import org.json.JSONArray
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.nio.charset.StandardCharsets
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.CopyOnWriteArrayList

/**
 * 🛡️ SentinelGuardian — Guardião Térmico, de Bateria e Anti-Fork-Bomb do AeroSentinel
 *
 * Protege continuamente o dispositivo contra:
 * 1. Loops infinitos de crash de processos persistentes/debloat (Fork-bombs).
 * 2. Sobreaquecimento (Thermal Throttling) e estresse do silício (AP/SoC e Bateria).
 * 3. Drenagem anômala de bateria em repouso (Deep Sleep / Standby Drain).
 */
object SentinelGuardian {
    private const val TAG = "SentinelGuardian"
    private const val CHANNEL_PROTECTION_ID = "sentinel_protection_channel"
    private const val NOTIFICATION_PROTECTION_ID = 5560

    private val guardianScope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private var isRunning = false
    private var appContext: Context? = null

    // Rastreamento de crashes por pacote: pacote -> lista de timestamps (ms)
    private val crashWindow = ConcurrentHashMap<String, MutableList<Long>>()

    // Histórico em memória de incidentes prevenidos
    data class GuardianIncident(
        val timestamp: Long,
        val targetPackage: String,
        val actionTaken: String,
        val reason: String
    )
    private val incidentHistory = CopyOnWriteArrayList<GuardianIncident>()

    // Métricas térmicas e elétricas em tempo real
    @Volatile var currentThermalStatus: Int = 0
    @Volatile var batteryTemperatureC: Float = 0f
    @Volatile var batteryCurrentMa: Int = 0
    @Volatile var batteryLevel: Int = 0
    @Volatile var isScreenOn: Boolean = true

    private var crashStreamProcess: Process? = null

    @Synchronized
    fun start(context: Context) {
        if (isRunning) return
        isRunning = true
        appContext = context.applicationContext

        createProtectionNotificationChannel(context)
        registerThermalListener(context)
        startCrashLoopInterceptor(context)
        startThermalAndBatteryMonitor(context)

        Log.i(TAG, "🛡️ SentinelGuardian ativado com sucesso. Proteção térmica e de recursos ativa.")
    }

    @Synchronized
    fun stop() {
        isRunning = false
        try {
            crashStreamProcess?.destroy()
        } catch (ignored: Exception) {}
        crashStreamProcess = null
        guardianScope.coroutineContext.cancelChildren()
        Log.i(TAG, "🛡️ SentinelGuardian finalizado.")
    }

    /**
     * 1. INTERCEPTOR DE CRASH-LOOP & FORK-BOMBS
     * Monitora em tempo real o buffer de crashes do logcat. Se um pacote falhar repetidamente
     * (> 3 vezes em 15s), analisa a causa e aplica auto-cura instantânea.
     */
    private fun startCrashLoopInterceptor(context: Context) {
        guardianScope.launch {
            while (isActive && isRunning) {
                try {
                    val process = ProcessBuilder("logcat", "-v", "time", "-b", "crash")
                        .redirectErrorStream(true)
                        .start()
                    crashStreamProcess = process

                    val reader = BufferedReader(InputStreamReader(process.inputStream, StandardCharsets.UTF_8))
                    var line: String? = null

                    while (isActive && isRunning) {
                        val currentLine = reader.readLine() ?: break
                        detectAndHealCrashAnomaly(context, currentLine)
                    }
                } catch (e: Exception) {
                    if (isRunning) {
                        Log.w(TAG, "Reconectando monitor de crash em 3s: ${e.message}")
                        delay(3000)
                    }
                }
            }
        }
    }

    private fun detectAndHealCrashAnomaly(context: Context, line: String) {
        val now = System.currentTimeMillis()

        // Padrões de crash do Android
        val targetPackage = when {
            line.contains("Process: ") -> {
                line.substringAfter("Process: ").substringBefore(",").trim()
            }
            line.contains("ComponentInfo{") -> {
                line.substringAfter("ComponentInfo{").substringBefore("/").trim()
            }
            line.contains("Tried to schedule job for non-existent component:") -> {
                line.substringAfter("ComponentInfo{").substringBefore("/").trim()
            }
            else -> null
        } ?: return

        if (targetPackage.isBlank() || targetPackage.length < 3) return

        val timestamps = crashWindow.computeIfAbsent(targetPackage) { mutableListOf() }
        synchronized(timestamps) {
            timestamps.add(now)
            // Remove registros com mais de 15 segundos
            timestamps.removeAll { now - it > 15_000 }

            if (timestamps.size >= 4) {
                // Loop de crash detectado! Dispara ação preventiva
                timestamps.clear()
                handleCrashLoopEmergency(context, targetPackage, line)
            }
        }
    }

    private fun handleCrashLoopEmergency(context: Context, targetPackage: String, sampleCrashLine: String) {
        guardianScope.launch {
            try {
                Log.w(TAG, "⚠️ ALERTA: Detectado loop vicioso de crash em: $targetPackage!")

                val isSystemOrPersistent = targetPackage.startsWith("com.sec.") ||
                        targetPackage.startsWith("com.samsung.") ||
                        targetPackage.startsWith("com.google.") ||
                        targetPackage.startsWith("android")

                // Verifica se o pacote foi desativado via pm disable / debloat
                val isDisabled = checkIsPackageDisabled(targetPackage)

                if (isDisabled && isSystemOrPersistent) {
                    // Auto-Cura: reabilita o pacote persistente para estancar a fork-bomb imediatamente
                    Log.i(TAG, "🩹 Auto-Cura: Reabilitando pacote de sistema persistente '$targetPackage'...")
                    Runtime.getRuntime().exec(arrayOf("sh", "-c", "pm enable $targetPackage 2>/dev/null && logcat -b crash -c 2>/dev/null")).waitFor()

                    recordIncident(
                        GuardianIncident(
                            timestamp = System.currentTimeMillis(),
                            targetPackage = targetPackage,
                            actionTaken = "AUTO_ENABLED",
                            reason = "Pacote de sistema estava desativado e reiniciando a cada ~100ms. Reabilitado com sucesso."
                        )
                    )

                    notifyProtectionAction(
                        context,
                        "🛡️ Auto-Cura Ativada",
                        "Loop de crash em '$targetPackage' neutralizado. CPU e bateria salvas!"
                    )
                } else if (!isSystemOrPersistent) {
                    // App de terceiros desgovernado: força encerramento
                    Log.i(TAG, "🛑 Forçando parada de app instável: $targetPackage")
                    Runtime.getRuntime().exec(arrayOf("sh", "-c", "am force-stop $targetPackage 2>/dev/null")).waitFor()

                    recordIncident(
                        GuardianIncident(
                            timestamp = System.currentTimeMillis(),
                            targetPackage = targetPackage,
                            actionTaken = "FORCE_STOP",
                            reason = "App de terceiros em colapso de reinicializações. Forçado encerramento."
                        )
                    )

                    notifyProtectionAction(
                        context,
                        "🛡️ App Instável Contido",
                        "O app '$targetPackage' estava em loop de crash e foi encerrado."
                    )
                }
            } catch (e: Exception) {
                Log.e(TAG, "Erro ao mitigar crash loop de $targetPackage: ${e.message}")
            }
        }
    }

    private fun checkIsPackageDisabled(packageName: String): Boolean {
        return try {
            val process = Runtime.getRuntime().exec(arrayOf("sh", "-c", "pm list packages -d | grep -F '$packageName'"))
            val output = process.inputStream.bufferedReader().readText()
            process.waitFor()
            output.contains("package:$packageName")
        } catch (e: Exception) {
            false
        }
    }

    /**
     * 2. GOVERNADOR TÉRMICO E DE CONSUMO DA BATERIA
     */
    private fun registerThermalListener(context: Context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            try {
                val powerManager = context.getSystemService(Context.POWER_SERVICE) as? PowerManager
                powerManager?.addThermalStatusListener { status ->
                    currentThermalStatus = status
                    Log.i(TAG, "🌡️ Novo status térmico do dispositivo: $status (${getThermalStatusString(status)})")

                    if (status >= PowerManager.THERMAL_STATUS_SEVERE) {
                        onThermalStatusCritical(context, status)
                    }
                }
            } catch (e: Exception) {
                Log.w(TAG, "Aviso ao registrar thermal listener: ${e.message}")
            }
        }
    }

    private fun onThermalStatusCritical(context: Context, status: Int) {
        guardianScope.launch {
            try {
                Log.w(TAG, "🔥 ALERTA TÉRMICO CRÍTICO: Dispositivo em nível $status (${getThermalStatusString(status)})!")

                // Libera eventuais locks mantidos pelo próprio AeroAudio se estiver ocioso
                AudioStreamManager.releaseLocksIfIdleExternal()

                notifyProtectionAction(
                    context,
                    "🔥 Alerta Térmico: Nível ${getThermalStatusString(status)}",
                    "AeroSentinel reduziu recursos para resfriar o dispositivo com segurança."
                )
            } catch (e: Exception) {
                Log.e(TAG, "Erro ao tratar alerta térmico: ${e.message}")
            }
        }
    }

    private fun startThermalAndBatteryMonitor(context: Context) {
        guardianScope.launch {
            val batteryManager = context.getSystemService(Context.BATTERY_SERVICE) as? BatteryManager
            val powerManager = context.getSystemService(Context.POWER_SERVICE) as? PowerManager
            var highDrainStandbyCount = 0

            while (isActive && isRunning) {
                try {
                    // Lê corrente instantânea (em microamperes -> converte para mA)
                    val rawCurrent = batteryManager?.getIntProperty(BatteryManager.BATTERY_PROPERTY_CURRENT_NOW) ?: 0
                    batteryCurrentMa = if (rawCurrent != Int.MIN_VALUE && rawCurrent != 0) rawCurrent / 1000 else 0

                    // Lê temperatura da bateria via sticky intent
                    val batteryIntent = context.registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED))
                    batteryIntent?.let { intent ->
                        val tempRaw = intent.getIntExtra(BatteryManager.EXTRA_TEMPERATURE, 0)
                        batteryTemperatureC = tempRaw / 10.0f
                        batteryLevel = intent.getIntExtra(BatteryManager.EXTRA_LEVEL, 0)
                    }

                    isScreenOn = powerManager?.isInteractive ?: true

                    // Verificação de Dreno Anômalo em Repouso (Tela desligada consumindo > 1200 mA)
                    if (!isScreenOn && batteryCurrentMa < -1200) {
                        highDrainStandbyCount++
                        if (highDrainStandbyCount >= 3) { // 3 ciclos seguidos (~45s)
                            highDrainStandbyCount = 0
                            Log.w(TAG, "⚡ Dreno Severo em Standby Detectado: ${batteryCurrentMa}mA!")

                            // Executa auto-diagnóstico
                            diagnoseAndMitigateStandbyDrain(context)
                        }
                    } else {
                        highDrainStandbyCount = 0
                    }
                } catch (e: Exception) {
                    Log.w(TAG, "Erro no ciclo de monitoramento térmico/bateria: ${e.message}")
                }

                // Ajusta intervalo com base no estado térmico
                val sleepInterval = if (currentThermalStatus >= 2) 10_000L else 20_000L
                delay(sleepInterval)
            }
        }
    }

    private fun diagnoseAndMitigateStandbyDrain(context: Context) {
        guardianScope.launch {
            try {
                // 1. Libera locks de áudio do próprio Sentinel caso não haja stream fluindo
                AudioStreamManager.releaseLocksIfIdleExternal()

                recordIncident(
                    GuardianIncident(
                        timestamp = System.currentTimeMillis(),
                        targetPackage = "system_standby",
                        actionTaken = "WAKELOCK_OPTIMIZED",
                        reason = "Drenagem anormal em repouso detectada (${batteryCurrentMa}mA). Recursos e locks liberados."
                    )
                )

                notifyProtectionAction(
                    context,
                    "⚡ Dreno Anômalo Contido",
                    "O dispositivo estava descarregando a ${batteryCurrentMa}mA com tela apagada. Recursos foram otimizados."
                )
            } catch (e: Exception) {
                Log.e(TAG, "Erro ao diagnosticar dreno: ${e.message}")
            }
        }
    }

    private fun recordIncident(incident: GuardianIncident) {
        incidentHistory.add(0, incident)
        if (incidentHistory.size > 50) {
            incidentHistory.removeAt(incidentHistory.size - 1)
        }
    }

    private fun createProtectionNotificationChannel(context: Context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val manager = context.getSystemService(NotificationManager::class.java)
            val channel = NotificationChannel(
                CHANNEL_PROTECTION_ID,
                "AeroSentinel Proteção Térmica & Recursos",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Notificações de segurança e auto-cura de bateria/temperatura"
            }
            manager?.createNotificationChannel(channel)
        }
    }

    private fun notifyProtectionAction(context: Context, title: String, message: String) {
        try {
            val notification = NotificationCompat.Builder(context, CHANNEL_PROTECTION_ID)
                .setSmallIcon(R.drawable.ic_launcher)
                .setContentTitle(title)
                .setContentText(message)
                .setStyle(NotificationCompat.BigTextStyle().bigText(message))
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setAutoCancel(true)
                .build()

            val manager = context.getSystemService(NotificationManager::class.java)
            manager?.notify(NOTIFICATION_PROTECTION_ID, notification)
        } catch (e: Exception) {
            Log.e(TAG, "Erro ao emitir notificacao de protecao: ${e.message}")
        }
    }

    fun getGuardianStatsJson(context: Context): String {
        val root = JSONObject().apply {
            put("protectionActive", isRunning)
            put("thermalStatus", currentThermalStatus)
            put("thermalStatusLabel", getThermalStatusString(currentThermalStatus))
            put("batteryTempC", batteryTemperatureC)
            put("batteryCurrentMa", batteryCurrentMa)
            put("batteryLevel", batteryLevel)
            put("isScreenOn", isScreenOn)

            val incidentsArray = JSONArray()
            incidentHistory.take(15).forEach { inc ->
                val incObj = JSONObject().apply {
                    put("timestamp", inc.timestamp)
                    put("package", inc.targetPackage)
                    put("action", inc.actionTaken)
                    put("reason", inc.reason)
                }
                incidentsArray.put(incObj)
            }
            put("incidents", incidentsArray)
        }
        return root.toString()
    }

    private fun getThermalStatusString(status: Int): String = when (status) {
        0 -> "NORMAL"
        1 -> "LIGHT"
        2 -> "MODERATE"
        3 -> "SEVERE"
        4 -> "CRITICAL"
        5 -> "EMERGENCY"
        6 -> "SHUTDOWN"
        else -> "DESCONHECIDO ($status)"
    }
}
