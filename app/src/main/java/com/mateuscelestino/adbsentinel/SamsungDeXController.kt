package com.mateuscelestino.adbsentinel

import android.content.Context
import android.content.Intent
import android.util.Log
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.net.ServerSocket
import java.net.Socket

object SamsungDeXController {
    private const val TAG = "SamsungDeXController"
    const val REMOTE_INPUT_PORT = 8083

    @Volatile
    var isInputServerRunning = false
        private set

    private var serverSocket: ServerSocket? = null
    private var serverThread: Thread? = null

    /**
     * Tenta ativar o Samsung DeX através de Intents oficiais e configurações de Desktop Mode
     */
    fun activateDeX(context: Context): String {
        val results = StringBuilder()
        try {
            // 1. Tentar iniciar Wireless DeX Activity
            val dexIntent = Intent("com.sec.android.desktopmode.action.START_DESKTOP_MODE").apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.sendBroadcast(dexIntent)
            results.append("Broadcast START_DESKTOP_MODE enviado. ")
        } catch (e: Exception) {
            results.append("Broadcast falhou: ${e.message}. ")
        }

        try {
            // 2. Tentar abrir a interface do Samsung DeX
            val intent = context.packageManager.getLaunchIntentForPackage("com.sec.android.desktopmode.uiservice")
                ?: Intent().setClassName("com.sec.android.desktopmode.uiservice", "com.sec.android.desktopmode.uiservice.activity.DesktopModeActivity")
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            context.startActivity(intent)
            results.append("Activity DesktopModeActivity chamada.")
        } catch (e: Exception) {
            try {
                val wirelessIntent = Intent().setClassName("com.sec.android.desktopmode.uiservice", "com.sec.android.desktopmode.uiservice.activity.WirelessDeXActivity").apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                context.startActivity(wirelessIntent)
                results.append("WirelessDeXActivity chamada.")
            } catch (ex: Exception) {
                results.append("Início de activity DeX falhou: ${ex.message}")
            }
        }

        // Inicia o servidor de input caso ainda não esteja rodando
        startInputServer()

        return results.toString()
    }

    @Synchronized
    fun startInputServer(): Boolean {
        if (isInputServerRunning) return true
        try {
            serverSocket = ServerSocket(REMOTE_INPUT_PORT).apply { reuseAddress = true }
            isInputServerRunning = true

            serverThread = Thread({
                Log.i(TAG, "DeX Remote Input Server ouvindo na porta $REMOTE_INPUT_PORT...")
                while (isInputServerRunning && !Thread.currentThread().isInterrupted) {
                    try {
                        val client = serverSocket?.accept() ?: break
                        Thread({ handleClient(client) }, "DeXInputClient-${client.inetAddress}").start()
                    } catch (e: Exception) {
                        if (isInputServerRunning) Log.e(TAG, "Erro accept input server: ${e.message}")
                    }
                }
            }, "DeXInputServerThread").apply { start() }

            return true
        } catch (e: Exception) {
            Log.e(TAG, "Falha ao iniciar DeX Input Server: ${e.message}")
            stopInputServer()
            return false
        }
    }

    @Synchronized
    fun stopInputServer() {
        isInputServerRunning = false
        try { serverSocket?.close() } catch (ignored: Exception) {}
        serverSocket = null

        serverThread?.interrupt()
        serverThread = null
        Log.i(TAG, "DeX Remote Input Server finalizado.")
    }

    private fun handleClient(socket: Socket) {
        try {
            val reader = BufferedReader(InputStreamReader(socket.getInputStream()))
            while (isInputServerRunning && socket.isConnected && !socket.isClosed) {
                val line = reader.readLine() ?: break
                if (line.isBlank()) continue
                try {
                    val json = JSONObject(line)
                    processInputCommand(json)
                } catch (e: Exception) {
                    Log.v(TAG, "Erro ao processar comando JSON: ${e.message}")
                }
            }
        } catch (e: Exception) {
            Log.v(TAG, "Cliente de controle remoto desconectado: ${e.message}")
        } finally {
            try { socket.close() } catch (ignored: Exception) {}
        }
    }

    private fun processInputCommand(json: JSONObject) {
        val cmd = json.optString("cmd")
        when (cmd) {
            "tap", "click" -> {
                val x = json.optInt("x", 500)
                val y = json.optInt("y", 500)
                execShell("input tap $x $y")
            }
            "swipe", "scroll" -> {
                val x1 = json.optInt("x1", 500)
                val y1 = json.optInt("y1", 800)
                val x2 = json.optInt("x2", 500)
                val y2 = json.optInt("y2", 300)
                val duration = json.optInt("duration", 250)
                execShell("input swipe $x1 $y1 $x2 $y2 $duration")
            }
            "key" -> {
                val code = json.optInt("code", 66)
                execShell("input keyevent $code")
            }
            "text" -> {
                val text = json.optString("text", "")
                val escaped = text.replace(" ", "%s").replace("\"", "\\\"")
                execShell("input text \"$escaped\"")
            }
        }
    }

    private fun execShell(cmd: String) {
        try {
            Runtime.getRuntime().exec(arrayOf("sh", "-c", cmd))
        } catch (e: Exception) {
            Log.e(TAG, "Erro ao executar comando shell: $cmd - ${e.message}")
        }
    }
}
