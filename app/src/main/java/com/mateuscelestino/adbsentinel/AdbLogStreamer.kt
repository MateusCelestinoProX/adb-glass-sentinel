package com.mateuscelestino.adbsentinel

import android.util.Log
import java.io.BufferedReader
import java.io.InputStreamReader
import java.util.concurrent.CopyOnWriteArrayList

data class AdbShellCommandEvent(
    val id: String,
    val timestamp: String,
    val command: String,
    val clientIp: String,
    val serviceType: String,
    val isPrivileged: Boolean = false
)

object AdbLogStreamer {
    private const val TAG = "AdbLogStreamer"
    private var streamProcess: Process? = null
    private var isStreaming = false

    private val commandHistory = CopyOnWriteArrayList<AdbShellCommandEvent>()
    private val listeners = CopyOnWriteArrayList<(AdbShellCommandEvent) -> Unit>()

    fun addListener(listener: (AdbShellCommandEvent) -> Unit) {
        listeners.add(listener)
    }

    fun removeListener(listener: (AdbShellCommandEvent) -> Unit) {
        listeners.remove(listener)
    }

    fun getHistory(): List<AdbShellCommandEvent> = commandHistory.toList()

    fun clearHistory() {
        commandHistory.clear()
    }

    @Synchronized
    fun startStreaming() {
        if (isStreaming) return
        isStreaming = true

        // 1. Carrega histórico recente
        Thread {
            loadRecentLogs()
        }.start()

        // 2. Loop de streaming contínuo via ProcessBuilder logcat
        Thread {
            try {
                val builder = ProcessBuilder("logcat", "-v", "time", "-s", "adbd:I")
                builder.redirectErrorStream(true)
                streamProcess = builder.start()

                val reader = BufferedReader(InputStreamReader(streamProcess!!.inputStream))

                while (isStreaming) {
                    val currentLine = reader.readLine() ?: break
                    parseAndDispatchLogLine(currentLine)
                }
            } catch (e: Exception) {
                Log.v(TAG, "ProcessBuilder logcat fallback: ${e.message}")
            } finally {
                // Não encerra isStreaming para manter o file poller
            }
        }.apply {
            name = "AdbLogStreamerThread"
            isDaemon = true
            start()
        }

        // 3. Loop de polling de alto desempenho para /data/local/tmp/adb_commands.txt
        Thread {
            val cmdFile = java.io.File("/data/local/tmp/adb_commands.txt")
            var lastReadHash = 0
            while (isStreaming) {
                try {
                    if (cmdFile.exists() && cmdFile.canRead()) {
                        val lines = cmdFile.readLines()
                        val currentHash = lines.hashCode()
                        if (currentHash != lastReadHash) {
                            lastReadHash = currentHash
                            lines.forEach { line ->
                                if (line.contains("adbd service requested '")) {
                                    parseAndDispatchLogLine(line)
                                }
                            }
                        }
                    }
                } catch (ignored: Exception) {}
                try {
                    Thread.sleep(400)
                } catch (e: InterruptedException) {
                    break
                }
            }
        }.apply {
            name = "AdbCommandFilePollingThread"
            isDaemon = true
            start()
        }
    }

    private fun loadRecentLogs() {
        val cmdFile = java.io.File("/data/local/tmp/adb_commands.txt")
        if (cmdFile.exists() && cmdFile.canRead()) {
            try {
                val lines = cmdFile.readLines()
                lines.takeLast(35).forEach { line ->
                    if (line.contains("adbd service requested '")) {
                        parseAndDispatchLogLine(line)
                    }
                }
            } catch (ignored: Exception) {}
        }

        try {
            val process = Runtime.getRuntime().exec(arrayOf("logcat", "-d", "-v", "time", "-s", "adbd:I"))
            val reader = BufferedReader(InputStreamReader(process.inputStream))
            val recentLines = mutableListOf<String>()
            var l: String?
            while (reader.readLine().also { l = it } != null) {
                val line = l ?: continue
                if (line.contains("adbd service requested '")) {
                    recentLines.add(line)
                }
            }
            recentLines.takeLast(25).forEach { line ->
                parseAndDispatchLogLine(line)
            }
        } catch (e: Exception) {
            Log.v(TAG, "logcat -d note: ${e.message}")
        }
    }

    private fun parseAndDispatchLogLine(line: String) {
        if (!line.contains("adbd service requested '")) return

        try {
            val timestamp = if (line.length >= 18 && (line[0].isDigit() || line[2] == '-')) {
                line.substring(0, 18).trim()
            } else {
                "Agora"
            }

            val marker = "requested '"
            val startIdx = line.indexOf(marker) + marker.length
            val endIdx = line.lastIndexOf("'")
            val rawPayload = if (startIdx in 0..endIdx) {
                line.substring(startIdx, endIdx)
            } else {
                line.substring(startIdx)
            }

            var command = rawPayload.trim()
            var serviceType = "SHELL"

            if (command.startsWith("shell,")) {
                val idx = command.indexOf(':')
                if (idx != -1) {
                    command = command.substring(idx + 1)
                }
                serviceType = "SHELL_V2"
            } else if (command.startsWith("shell:")) {
                command = command.removePrefix("shell:")
                serviceType = "SHELL"
            } else if (command.startsWith("exec:")) {
                command = command.removePrefix("exec:")
                serviceType = "EXEC"
            } else if (command.startsWith("abb_exec:")) {
                command = command.removePrefix("abb_exec:")
                serviceType = "ABB"
            } else if (command.startsWith("sync:")) {
                command = "[FILE SYNC / PUSH / PULL]"
                serviceType = "SYNC"
            }

            // Identifica o IP do cliente ativo
            val activeConnections = AdbSocketTracker.scanActiveConnections()
            val clientIp = activeConnections.firstOrNull { it.state == "ESTABLISHED" }?.remoteIp
                ?: "192.168.15.23"

            val isPriv = command.startsWith("pm ") || command.startsWith("su") || command.startsWith("setprop") || command.startsWith("settings ") || command.startsWith("am ")

            val event = AdbShellCommandEvent(
                id = "${System.currentTimeMillis()}-${(1000..9999).random()}",
                timestamp = timestamp,
                command = command.trim(),
                clientIp = clientIp,
                serviceType = serviceType,
                isPrivileged = isPriv
            )

            // Evitar duplicata exata
            if (commandHistory.any { it.command == event.command && it.timestamp == event.timestamp }) {
                return
            }

            commandHistory.add(0, event)
            if (commandHistory.size > 200) {
                commandHistory.removeAt(commandHistory.size - 1)
            }

            listeners.forEach { listener ->
                try {
                    listener(event)
                } catch (e: Exception) {
                    Log.e(TAG, "Erro no listener de comando: ${e.message}")
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Erro ao parsear log line: ${e.message}")
        }
    }

    @Synchronized
    fun stopStreaming() {
        isStreaming = false
        try {
            streamProcess?.destroy()
            streamProcess = null
        } catch (ignored: Exception) {}
    }
}
