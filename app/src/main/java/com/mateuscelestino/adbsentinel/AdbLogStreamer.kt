package com.mateuscelestino.adbsentinel

import android.content.Context
import android.util.Log
import java.io.BufferedReader
import java.io.File
import java.io.InputStreamReader
import java.io.RandomAccessFile
import java.nio.charset.StandardCharsets
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale
import java.util.concurrent.CopyOnWriteArrayList

data class AdbShellCommandEvent(
    val id: String,
    val timestamp: String,
    val dateFormatted: String,
    val timeFormatted: String,
    val millisFormatted: String,
    val epochMs: Long,
    val command: String,
    val clientIp: String,
    val serviceType: String,
    val isPrivileged: Boolean = false
)

object AdbLogStreamer {
    private const val TAG = "AdbLogStreamer"
    private var streamProcess: Process? = null
    @Volatile
    private var isStreaming = false
    @Volatile
    private var appContext: Context? = null

    private val commandHistory = CopyOnWriteArrayList<AdbShellCommandEvent>()
    private val listeners = CopyOnWriteArrayList<(AdbShellCommandEvent) -> Unit>()

    // Conjunto sincronizado das últimas linhas brutas processadas para evitar duplicatas sem perder comandos repetidos em horários distintos
    private val processedLineSignatures = LinkedHashSet<String>()

    fun initContext(context: Context) {
        appContext = context.applicationContext
    }

    fun addListener(listener: (AdbShellCommandEvent) -> Unit) {
        if (!listeners.contains(listener)) {
            listeners.add(listener)
        }
    }

    fun removeListener(listener: (AdbShellCommandEvent) -> Unit) {
        listeners.remove(listener)
    }

    fun getHistory(): List<AdbShellCommandEvent> = commandHistory.toList()

    fun clearHistory() {
        commandHistory.clear()
        synchronized(processedLineSignatures) {
            processedLineSignatures.clear()
        }
    }

    @Synchronized
    fun startStreaming(context: Context? = null) {
        if (context != null) {
            appContext = context.applicationContext
        }
        if (isStreaming) return
        isStreaming = true

        // 1. Carrega histórico recente imediatamente em background
        Thread {
            loadRecentLogs()
        }.apply {
            name = "AdbLogInitialLoader"
            isDaemon = true
            start()
        }

        // 2. Loop de streaming direto via ProcessBuilder logcat (0% CPU quando ocioso, latência 0ms)
        Thread {
            try {
                val builder = ProcessBuilder("logcat", "-v", "time", "-s", "adbd:I")
                builder.redirectErrorStream(true)
                streamProcess = builder.start()

                val reader = BufferedReader(InputStreamReader(streamProcess!!.inputStream, StandardCharsets.UTF_8))
                var pendingMultilineHeader: String? = null
                val multilineBuffer = StringBuilder()

                while (isStreaming) {
                    val currentLine = reader.readLine() ?: break
                    pendingMultilineHeader = processStreamLineWithMultilineSupport(
                        currentLine,
                        pendingMultilineHeader,
                        multilineBuffer
                    )
                }
            } catch (e: Exception) {
                Log.v(TAG, "ProcessBuilder logcat fallback: ${e.message}")
            }
        }.apply {
            name = "AdbLogStreamerThread"
            isDaemon = true
            start()
        }

        // 3. Ultra-Fast Smart Tail Streamer (suporta rotação de arquivo e zero I/O quando ocioso)
        Thread {
            var filePointer = 0L
            var lastModified = 0L
            var firstLineSig = ""
            var activeFile: File? = null

            while (isStreaming) {
                try {
                    val targetFile = resolveLiveLogFile()
                    if (targetFile != null && targetFile.exists() && targetFile.canRead()) {
                        if (activeFile?.absolutePath != targetFile.absolutePath) {
                            activeFile = targetFile
                            filePointer = maxOf(0L, targetFile.length() - 12288L)
                            lastModified = 0L
                            firstLineSig = ""
                        }

                        val currentLen = targetFile.length()
                        val currentMod = targetFile.lastModified()

                        if (currentLen != filePointer || currentMod != lastModified) {
                            lastModified = currentMod
                            RandomAccessFile(targetFile, "r").use { raf ->
                                val currentFirstLine = raf.readLine() ?: ""
                                val rotated = (firstLineSig.isNotEmpty() && currentFirstLine != firstLineSig) || (currentLen < filePointer)
                                firstLineSig = currentFirstLine

                                if (rotated) {
                                    // O arquivo foi rotacionado pelo daemon (tail): lê os últimos 8KB
                                    val seekPos = maxOf(0L, currentLen - 8192L)
                                    raf.seek(seekPos)
                                    if (seekPos > 0L) {
                                        raf.readLine() // descarta linha parcial
                                    }
                                } else if (currentLen > filePointer) {
                                    raf.seek(filePointer)
                                } else {
                                    raf.seek(currentLen)
                                }

                                var pendingHeader: String? = null
                                val multiBuf = StringBuilder()
                                val rawBytes = ByteArray(4096)
                                val sb = StringBuilder()
                                var bytesRead: Int
                                while (raf.read(rawBytes).also { bytesRead = it } != -1) {
                                    sb.append(String(rawBytes, 0, bytesRead, StandardCharsets.UTF_8))
                                }
                                filePointer = raf.filePointer

                                if (sb.isNotEmpty()) {
                                    sb.toString().lineSequence().forEach { line ->
                                        val trimmed = line.trim()
                                        if (trimmed.isNotEmpty()) {
                                            pendingHeader = processStreamLineWithMultilineSupport(
                                                trimmed,
                                                pendingHeader,
                                                multiBuf
                                            )
                                        }
                                    }
                                    // Se sobrou um comando multiline no fim do bloco, despacha imediatamente
                                    if (pendingHeader != null) {
                                        val combined = "$pendingHeader ${multiBuf.toString().trim()}'"
                                        parseAndDispatchLogLine(combined)
                                    }
                                }
                            }
                        }
                    }
                } catch (ignored: Exception) {}

                try {
                    Thread.sleep(80)
                } catch (e: InterruptedException) {
                    break
                }
            }
        }.apply {
            name = "AdbLiveLogTailThread"
            isDaemon = true
            start()
        }
    }

    private fun resolveLiveLogFile(): File? {
        val extDir = appContext?.getExternalFilesDir(null)
        if (extDir != null) {
            val extLive = File(extDir, "adb_live.log")
            if (extLive.exists() && extLive.canRead() && extLive.length() > 0L) {
                return extLive
            }
        }
        val tmpLive = File("/data/local/tmp/adb_live.log")
        if (tmpLive.exists() && tmpLive.canRead()) {
            return tmpLive
        }
        val tmpCmd = File("/data/local/tmp/adb_commands.txt")
        if (tmpCmd.exists() && tmpCmd.canRead()) {
            return tmpCmd
        }
        return null
    }

    /**
     * Suporta linhas simples e comandos multilinhas do adbd (quando há quebras de linha no comando shell)
     */
    private fun processStreamLineWithMultilineSupport(
        line: String,
        pendingHeader: String?,
        multilineBuffer: StringBuilder
    ): String? {
        if (line.contains("service requested")) {
            // Se havia um comando multiline anterior pendente, despacha ele primeiro
            if (pendingHeader != null) {
                val combined = "$pendingHeader ${multilineBuffer.toString().trim()}'"
                parseAndDispatchLogLine(combined)
                multilineBuffer.clear()
            }

            // Verifica se a linha abre aspa em "requested '" mas não fecha "'" no final
            val reqIndex = line.indexOf("requested '")
            if (reqIndex != -1) {
                val afterReq = line.substring(reqIndex + "requested '".length)
                if (!afterReq.endsWith("'")) {
                    // Comando continua na próxima linha (ou é shell interativo sem fechamento na mesma linha)
                    multilineBuffer.clear()
                    return line
                }
            }
            parseAndDispatchLogLine(line)
            return null
        } else if (pendingHeader != null) {
            // Extrai o conteúdo da linha de continuação do logcat (após "adbd    : " ou "): ")
            val payloadPart = when {
                line.contains("): ") -> line.substringAfter("): ").trim()
                line.contains("adbd") && line.contains(": ") -> line.substringAfter(": ").trim()
                else -> line.trim()
            }
            if (payloadPart == "'") {
                val combined = "$pendingHeader ${multilineBuffer.toString().trim()}'"
                parseAndDispatchLogLine(combined)
                multilineBuffer.clear()
                return null
            } else if (payloadPart.endsWith("'")) {
                multilineBuffer.append(" ").append(payloadPart.removeSuffix("'"))
                val combined = "$pendingHeader ${multilineBuffer.toString().trim()}'"
                parseAndDispatchLogLine(combined)
                multilineBuffer.clear()
                return null
            } else {
                if (multilineBuffer.length < 600) {
                    if (multilineBuffer.isNotEmpty()) multilineBuffer.append(" ; ")
                    multilineBuffer.append(payloadPart)
                }
                return pendingHeader
            }
        }
        return null
    }

    private fun loadRecentLogs() {
        val targetFile = resolveLiveLogFile()
        if (targetFile != null && targetFile.exists() && targetFile.canRead()) {
            try {
                val lines = targetFile.readLines(StandardCharsets.UTF_8).takeLast(45)
                var pendingHeader: String? = null
                val multiBuf = StringBuilder()
                lines.forEach { line ->
                    pendingHeader = processStreamLineWithMultilineSupport(line.trim(), pendingHeader, multiBuf)
                }
                if (pendingHeader != null) {
                    parseAndDispatchLogLine("$pendingHeader ${multiBuf.toString().trim()}'")
                }
                return
            } catch (ignored: Exception) {}
        }

        try {
            val process = Runtime.getRuntime().exec(arrayOf("logcat", "-d", "-v", "time", "-s", "adbd:I"))
            val reader = BufferedReader(InputStreamReader(process.inputStream, StandardCharsets.UTF_8))
            val recentLines = mutableListOf<String>()
            var l: String?
            while (reader.readLine().also { l = it } != null) {
                val line = l ?: continue
                recentLines.add(line)
            }
            var pendingHeader: String? = null
            val multiBuf = StringBuilder()
            recentLines.takeLast(60).forEach { line ->
                pendingHeader = processStreamLineWithMultilineSupport(line.trim(), pendingHeader, multiBuf)
            }
            if (pendingHeader != null) {
                parseAndDispatchLogLine("$pendingHeader ${multiBuf.toString().trim()}'")
            }
        } catch (e: Exception) {
            Log.v(TAG, "logcat -d note: ${e.message}")
        }
    }

    private fun parseAndDispatchLogLine(line: String) {
        if (!line.contains("service requested")) return

        try {
            val rawTimestamp = if (line.length >= 18 && (line[0].isDigit() || line[2] == '-')) {
                line.substring(0, 18).trim()
            } else {
                val sdf = SimpleDateFormat("MM-dd HH:mm:ss.SSS", Locale.US)
                sdf.format(Date())
            }

            val marker = "requested '"
            val startIdx = if (line.contains(marker)) {
                line.indexOf(marker) + marker.length
            } else {
                line.indexOf("service requested") + 17
            }
            val endIdx = line.lastIndexOf("'")
            val rawPayload = if (startIdx in 0..endIdx) {
                line.substring(startIdx, endIdx)
            } else if (startIdx < line.length) {
                line.substring(startIdx)
            } else {
                ""
            }

            var command = rawPayload.trim()
            var serviceType = "SHELL"

            if (command.startsWith("shell,")) {
                val idx = command.indexOf(':')
                command = if (idx != -1) {
                    command.substring(idx + 1).trim()
                } else {
                    ""
                }
                serviceType = "SHELL_V2"
                if (command.isEmpty()) {
                    command = "[Sessão Shell Interativa / PTY]"
                }
            } else if (command.startsWith("shell:")) {
                command = command.removePrefix("shell:").trim()
                serviceType = "SHELL"
                if (command.isEmpty()) {
                    command = "[Sessão Shell Interativa]"
                }
            } else if (command.startsWith("exec:")) {
                command = command.removePrefix("exec:").trim()
                serviceType = "EXEC"
            } else if (command.startsWith("abb_exec:")) {
                command = command.removePrefix("abb_exec:").trim().replace('\u0000', ' ')
                serviceType = "ABB"
            } else if (command.startsWith("abb:")) {
                command = command.removePrefix("abb:").trim().replace('\u0000', ' ')
                serviceType = "ABB"
            } else if (command.startsWith("sync:")) {
                command = "[FILE SYNC / PUSH / PULL]"
                serviceType = "SYNC"
            } else if (command.startsWith("reverse:")) {
                command = command.removePrefix("reverse:").trim()
                serviceType = "REVERSE"
            } else if (command.startsWith("forward:")) {
                command = command.removePrefix("forward:").trim()
                serviceType = "FORWARD"
            } else if (command.startsWith("framebuffer:")) {
                command = "[CAPTURA DE TELA / FRAMEBUFFER]"
                serviceType = "SCREEN"
            }

            if (command.isEmpty()) return

            // Deduplicação determinística por assinatura (timestamp do logcat + comando)
            val lineSignature = "$rawTimestamp|$command"
            synchronized(processedLineSignatures) {
                if (processedLineSignatures.contains(lineSignature)) {
                    return
                }
                processedLineSignatures.add(lineSignature)
                if (processedLineSignatures.size > 400) {
                    val first = processedLineSignatures.iterator().next()
                    processedLineSignatures.remove(first)
                }
            }

            // Formatação intuitiva de Data e Hora (Padrão Brasileiro DD/MM + Hora + Milissegundos + EpochMs)
            val parsedTime = parseLogcatTimestamp(rawTimestamp)

            // Obtém o IP do cliente ativo direto da memória RAM (0ms, zero bloqueio!)
            val clientIp = AdbSocketTracker.getCachedClientIp()

            val isPriv = command.startsWith("pm ") ||
                command.startsWith("su") ||
                command.startsWith("setprop") ||
                command.startsWith("settings ") ||
                command.startsWith("am ") ||
                command.startsWith("monkey ") ||
                command.startsWith("cmd ") ||
                command.contains("WRITE_SECURE_SETTINGS")

            val event = AdbShellCommandEvent(
                id = "${parsedTime.epochMs}-${command.hashCode().toUInt()}",
                timestamp = rawTimestamp,
                dateFormatted = parsedTime.dateFormatted,
                timeFormatted = parsedTime.timeFormatted,
                millisFormatted = parsedTime.millisFormatted,
                epochMs = parsedTime.epochMs,
                command = command,
                clientIp = clientIp,
                serviceType = serviceType,
                isPrivileged = isPriv
            )

            // Insere mantendo ordem cronológica (mais recente no índice 0)
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

    private data class ParsedTimestampInfo(
        val dateFormatted: String,
        val timeFormatted: String,
        val millisFormatted: String,
        val epochMs: Long
    )

    /**
     * Converte "MM-dd HH:mm:ss.SSS" (ex: "10-08 21:24:16.413") em componentes intuitivos PT-BR
     */
    private fun parseLogcatTimestamp(raw: String): ParsedTimestampInfo {
        try {
            // Exemplo: "10-08 21:24:16.413"
            val parts = raw.split(" ")
            if (parts.size >= 2) {
                val datePart = parts[0] // MM-dd
                val timePart = parts[1] // HH:mm:ss.SSS

                val md = datePart.split("-")
                val month = md.getOrNull(0)?.toIntOrNull() ?: 1
                val day = md.getOrNull(1)?.toIntOrNull() ?: 1

                val timeMain = timePart.substringBefore(".")
                val millis = if (timePart.contains(".")) ".${timePart.substringAfter(".")}" else ".000"

                val hms = timeMain.split(":")
                val hour = hms.getOrNull(0)?.toIntOrNull() ?: 0
                val minute = hms.getOrNull(1)?.toIntOrNull() ?: 0
                val second = hms.getOrNull(2)?.toIntOrNull() ?: 0
                val msVal = millis.removePrefix(".").toIntOrNull() ?: 0

                val nowCal = Calendar.getInstance()
                val cmdCal = Calendar.getInstance().apply {
                    set(Calendar.MONTH, month - 1)
                    set(Calendar.DAY_OF_MONTH, day)
                    set(Calendar.HOUR_OF_DAY, hour)
                    set(Calendar.MINUTE, minute)
                    set(Calendar.SECOND, second)
                    set(Calendar.MILLISECOND, msVal)
                }

                val dayStr = day.toString().padStart(2, '0')
                val monthStr = month.toString().padStart(2, '0')

                val isToday = (nowCal.get(Calendar.MONTH) == cmdCal.get(Calendar.MONTH)) &&
                    (nowCal.get(Calendar.DAY_OF_MONTH) == cmdCal.get(Calendar.DAY_OF_MONTH))

                val yesterdayCal = (nowCal.clone() as Calendar).apply {
                    add(Calendar.DAY_OF_YEAR, -1)
                }
                val isYesterday = (yesterdayCal.get(Calendar.MONTH) == cmdCal.get(Calendar.MONTH)) &&
                    (yesterdayCal.get(Calendar.DAY_OF_MONTH) == cmdCal.get(Calendar.DAY_OF_MONTH))

                val dateLabel = when {
                    isToday -> "Hoje, $dayStr/$monthStr"
                    isYesterday -> "Ontem, $dayStr/$monthStr"
                    else -> "$dayStr/$monthStr/${nowCal.get(Calendar.YEAR)}"
                }

                return ParsedTimestampInfo(
                    dateFormatted = dateLabel,
                    timeFormatted = timeMain,
                    millisFormatted = millis,
                    epochMs = cmdCal.timeInMillis
                )
            }
        } catch (ignored: Exception) {}

        val now = System.currentTimeMillis()
        val d = Date(now)
        val timeFmt = SimpleDateFormat("HH:mm:ss", Locale.getDefault()).format(d)
        val msFmt = SimpleDateFormat(".SSS", Locale.getDefault()).format(d)
        val dateFmt = "Hoje, " + SimpleDateFormat("dd/MM", Locale.getDefault()).format(d)
        return ParsedTimestampInfo(dateFmt, timeFmt, msFmt, now)
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
