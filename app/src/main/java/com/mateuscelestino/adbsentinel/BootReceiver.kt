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

        // 2. Acorda os módulos Good Lock para evitar perda de customizações One UI
        Thread {
            try {
                val soundIntent = context.packageManager.getLaunchIntentForPackage("com.samsung.android.soundassistant")
                if (soundIntent != null) {
                    soundIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    context.startActivity(soundIntent)
                    Thread.sleep(600)
                    Runtime.getRuntime().exec(arrayOf("sh", "-c", "input keyevent 3"))
                }
            } catch (e: Exception) {
                Log.w("BootReceiver", "Aviso SoundAssistant boot: ${e.message}")
            }

            try {
                val ohoIntent = context.packageManager.getLaunchIntentForPackage("com.samsung.android.sidegesturepad")
                if (ohoIntent != null) {
                    ohoIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    context.startActivity(ohoIntent)
                    Thread.sleep(600)
                    Runtime.getRuntime().exec(arrayOf("sh", "-c", "input keyevent 3"))
                }
            } catch (e: Exception) {
                Log.w("BootReceiver", "Aviso SideGesturePad boot: ${e.message}")
            }
        }.start()
    }
}
