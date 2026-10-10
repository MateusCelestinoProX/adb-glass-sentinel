package com.mateuscelestino.adbsentinel

import android.content.Context
import android.util.Log
import org.json.JSONArray
import java.io.File
import java.net.InetAddress
import java.net.NetworkInterface

data class AdbConnection(
    val id: String,
    val localIp: String,
    val localPort: Int,
    val remoteIp: String,
    val remotePort: Int,
    val state: String,
    val uid: Int,
    val timestamp: Long = System.currentTimeMillis(),
    val connectionType: String = if (remoteIp.contains("127.0.0.1") || remoteIp == "::1") "LOOPBACK" else if (remoteIp.contains("USB") || remoteIp == "N/A") "USB" else "WIRELESS"
)

object AdbSocketTracker {
    private const val TAG = "AdbSocketTracker"
    private const val ADB_PORT_HEX = "15B3" // 5555 em hex

    @Volatile
    private var cachedConnections: List<AdbConnection> = emptyList()
    @Volatile
    private var lastScanTimestamp: Long = 0L

    @Volatile
    private var cachedWifiIp: String = "192.168.15.22"
    @Volatile
    private var lastWifiIpTimestamp: Long = 0L

    @Volatile
    private var lastDumpsysTimestamp: Long = 0L

    @Volatile
    private var detectedAdbPort: Int = 5555

    fun getActiveAdbPort(): Int = detectedAdbPort

    /**
     * Limpa imediatamente o cache de conexões ativas (usado ao desligar o ADB)
     */
    fun clearActiveConnectionsCache() {
        cachedConnections = emptyList()
        lastScanTimestamp = System.currentTimeMillis()
    }

    /**
     * Retorna o IP do cliente ativo direto da memória RAM (0ms, zero I/O)
     * Usado pelo AdbLogStreamer em cada linha de comando sem bloquear
     */
    fun getCachedClientIp(): String {
        val active = cachedConnections.firstOrNull { it.state == "ESTABLISHED" }
        return active?.remoteIp?.takeIf { it.isNotBlank() } ?: "192.168.15.23"
    }

    /**
     * Retorna a lista de conexões ativas com cache inteligente de alta performance
     */
    fun scanActiveConnections(context: Context? = null, forceRefresh: Boolean = false): List<AdbConnection> {
        // Se o daemon adbd está parado ou o ADB foi desativado, não há conexões ativas
        if (context != null && !AdbSystemController.isWirelessAdbEnabled(context)) {
            cachedConnections = emptyList()
            return emptyList()
        }
        val adbdState = AdbSystemController.getSystemProperty("init.svc.adbd", "running")
        if (adbdState.equals("stopped", ignoreCase = true)) {
            cachedConnections = emptyList()
            return emptyList()
        }

        val now = System.currentTimeMillis()
        if (!forceRefresh && (now - lastScanTimestamp) < 900L) {
            return cachedConnections
        }

        val connections = mutableListOf<AdbConnection>()

        // 1. Tentar ler do arquivo compartilhado do app ou do daemon /data/local/tmp/adb_active.json
        val candidateFiles = mutableListOf<File>()
        context?.getExternalFilesDir(null)?.let { extDir ->
            candidateFiles.add(File(extDir, "adb_active.json"))
        }
        candidateFiles.add(File("/data/local/tmp/adb_active.json"))

        for (daemonFile in candidateFiles) {
            if (daemonFile.exists() && daemonFile.canRead()) {
                try {
                    val text = daemonFile.readText().trim()
                    if (text.isNotEmpty() && text.startsWith("[")) {
                        val arr = JSONArray(text)
                        for (i in 0 until arr.length()) {
                            val obj = arr.getJSONObject(i)
                            connections.add(
                                AdbConnection(
                                    id = obj.optString("id"),
                                    localIp = cachedWifiIp,
                                    localPort = obj.optInt("localPort", 5555),
                                    remoteIp = obj.optString("remoteIp"),
                                    remotePort = obj.optInt("remotePort", 0),
                                    state = obj.optString("state", "ESTABLISHED"),
                                    uid = 2000,
                                    connectionType = obj.optString("type", "WIRELESS")
                                )
                            )
                        }
                        if (connections.isNotEmpty()) {
                            cachedConnections = connections
                            lastScanTimestamp = now
                            return connections
                        }
                    }
                } catch (e: Exception) {
                    Log.v(TAG, "Falha ao ler ${daemonFile.name}: ${e.message}")
                }
            }
        }

        // 2. Fallback rápido em /proc/net/tcp6 e /proc/net/tcp (leitura em memória procfs)
        parseProcNetFile(File("/proc/net/tcp6"), isIpv6 = true, connections)
        parseProcNetFile(File("/proc/net/tcp"), isIpv6 = false, connections)

        // 3. Fallback controlado com rate-limit (máximo 1x a cada 12s) para não gerar overhead de processos
        if (connections.none { it.state == "ESTABLISHED" } && (now - lastDumpsysTimestamp) > 12000L) {
            lastDumpsysTimestamp = now
            checkDumpsysAndArp(connections)
        }

        cachedConnections = connections
        lastScanTimestamp = now
        return connections
    }

    private fun parseProcNetFile(file: File, isIpv6: Boolean, output: MutableList<AdbConnection>) {
        if (!file.exists() || !file.canRead()) return
        try {
            file.bufferedReader().useLines { lines ->
                lines.drop(1).forEach { line ->
                    val tokens = line.trim().split("\\s+".toRegex())
                    if (tokens.size >= 10) {
                        val localRaw = tokens[1]
                        val remoteRaw = tokens[2]
                        val stateHex = tokens[3]
                        val uid = tokens[7].toIntOrNull() ?: -1

                        val localParts = localRaw.split(":")
                        val remoteParts = remoteRaw.split(":")

                        if (localParts.size == 2 && remoteParts.size == 2) {
                            val localPortHex = localParts[1]
                            val remotePortHex = remoteParts[1]

                            if (uid == 2000 || localPortHex.equals(ADB_PORT_HEX, ignoreCase = true) || remotePortHex.equals(ADB_PORT_HEX, ignoreCase = true)) {
                                val localPort = localPortHex.toIntOrNull(16) ?: 5555
                                val remotePort = remotePortHex.toIntOrNull(16) ?: 0

                                val localIp = decodeIpAddress(localParts[0], isIpv6)
                                val remoteIp = decodeIpAddress(remoteParts[0], isIpv6)
                                val stateStr = decodeSocketState(stateHex)

                                if (stateStr == "ESTABLISHED" && localPort > 0) {
                                    detectedAdbPort = localPort
                                }

                                val id = "$remoteIp:$remotePort"
                                if (output.none { it.id == id && it.state == stateStr }) {
                                    output.add(
                                        AdbConnection(
                                            id = id,
                                            localIp = localIp,
                                            localPort = localPort,
                                            remoteIp = remoteIp,
                                            remotePort = remotePort,
                                            state = stateStr,
                                            uid = uid
                                        )
                                    )
                                }
                            }
                        }
                    }
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Erro ao analisar ${file.path}: ${e.message}")
        }
    }

    private fun decodeIpAddress(hex: String, isIpv6: Boolean): String {
        return try {
            if (!isIpv6) {
                val num = hex.toLong(16)
                val b1 = (num and 0xFF).toInt()
                val b2 = ((num shr 8) and 0xFF).toInt()
                val b3 = ((num shr 16) and 0xFF).toInt()
                val b4 = ((num shr 24) and 0xFF).toInt()
                "$b1.$b2.$b3.$b4"
            } else {
                if (hex.length == 32) {
                    val bytes = ByteArray(16)
                    for (i in 0 until 4) {
                        val word = hex.substring(i * 8, (i + 1) * 8).toLong(16)
                        bytes[i * 4 + 0] = (word and 0xFF).toByte()
                        bytes[i * 4 + 1] = ((word shr 8) and 0xFF).toByte()
                        bytes[i * 4 + 2] = ((word shr 16) and 0xFF).toByte()
                        bytes[i * 4 + 3] = ((word shr 24) and 0xFF).toByte()
                    }
                    val inet = InetAddress.getByAddress(bytes)
                    val hostAddress = inet.hostAddress ?: hex
                    if (hostAddress.startsWith("::ffff:") && hostAddress.count { it == '.' } == 3) {
                        hostAddress.substringAfter("::ffff:")
                    } else if (hostAddress == "0:0:0:0:0:0:0:0" || hostAddress == "::") {
                        "0.0.0.0"
                    } else {
                        hostAddress
                    }
                } else {
                    hex
                }
            }
        } catch (e: Exception) {
            hex
        }
    }

    private fun decodeSocketState(stateHex: String): String {
        return when (stateHex.uppercase()) {
            "01" -> "ESTABLISHED"
            "02" -> "SYN_SENT"
            "03" -> "SYN_RECV"
            "04" -> "FIN_WAIT1"
            "05" -> "FIN_WAIT2"
            "06" -> "TIME_WAIT"
            "07" -> "CLOSE"
            "08" -> "CLOSE_WAIT"
            "09" -> "LAST_ACK"
            "0A" -> "LISTEN"
            "0B" -> "CLOSING"
            else -> "UNKNOWN ($stateHex)"
        }
    }

    private fun checkDumpsysAndArp(output: MutableList<AdbConnection>) {
        try {
            val process = Runtime.getRuntime().exec("dumpsys adb")
            val outputText = process.inputStream.bufferedReader().use { it.readText() }
            if (outputText.contains("connected_to_adb=true")) {
                var detectedIp = "192.168.15.23"
                val arp = File("/proc/net/arp")
                if (arp.exists() && arp.canRead()) {
                    arp.bufferedReader().useLines { lines ->
                        lines.drop(1).forEach { l ->
                            val parts = l.trim().split("\\s+".toRegex())
                            if (parts.size >= 4 && !parts[0].endsWith(".1") && parts[3] != "00:00:00:00:00:00") {
                                detectedIp = parts[0]
                            }
                        }
                    }
                }

                output.add(
                    AdbConnection(
                        id = "$detectedIp:5555",
                        localIp = getDeviceWifiIp(),
                        localPort = 5555,
                        remoteIp = detectedIp,
                        remotePort = 5555,
                        state = "ESTABLISHED",
                        uid = 2000,
                        connectionType = "WIRELESS"
                    )
                )
            }
        } catch (e: Exception) {
            Log.v(TAG, "checkDumpsysAndArp: ${e.message}")
        }
    }

    fun getDeviceWifiIp(): String {
        val now = System.currentTimeMillis()
        if ((now - lastWifiIpTimestamp) < 8000L && cachedWifiIp.isNotEmpty()) {
            return cachedWifiIp
        }
        try {
            val interfaces = NetworkInterface.getNetworkInterfaces()
            while (interfaces != null && interfaces.hasMoreElements()) {
                val iface = interfaces.nextElement()
                if (iface.isUp && !iface.isLoopback && (iface.name.contains("wlan") || iface.name.contains("eth") || iface.name.contains("ap"))) {
                    val addresses = iface.inetAddresses
                    while (addresses.hasMoreElements()) {
                        val addr = addresses.nextElement()
                        if (!addr.isLoopbackAddress && addr.hostAddress?.contains(".") == true) {
                            cachedWifiIp = addr.hostAddress ?: "192.168.15.22"
                            lastWifiIpTimestamp = now
                            return cachedWifiIp
                        }
                    }
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Erro ao obter IP Wi-Fi: ${e.message}")
        }
        lastWifiIpTimestamp = now
        return cachedWifiIp
    }
}
