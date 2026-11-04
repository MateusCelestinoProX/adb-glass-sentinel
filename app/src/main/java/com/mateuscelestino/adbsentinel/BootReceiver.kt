package com.mateuscelestino.adbsentinel

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log

class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        val action = intent?.action
        Log.i("BootReceiver", "Broadcast recebido: $action. Restaurando ecossistema e Good Lock...")

        // 1. Inicia o serviço AdbSentinelService
        try {
            val serviceIntent = Intent(context, AdbSentinelService::class.java).apply {
                this.action = "com.mateuscelestino.adbsentinel.START_SERVERS"
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(serviceIntent)
            } else {
                context.startService(serviceIntent)
            }
        } catch (e: Exception) {
            Log.e("BootReceiver", "Erro ao iniciar serviço no boot: ${e.message}")
        }

        // 2. Garante módulos Good Lock habilitados sem abrir telas na cara do usuário
        Thread {
            try {
                Runtime.getRuntime().exec(arrayOf("sh", "-c", "pm enable com.samsung.android.soundassistant 2>/dev/null && pm enable com.samsung.android.sidegesturepad 2>/dev/null"))
            } catch (e: Exception) {
                Log.w("BootReceiver", "Aviso GoodLock boot: ${e.message}")
            }
        }.start()
    }
}
