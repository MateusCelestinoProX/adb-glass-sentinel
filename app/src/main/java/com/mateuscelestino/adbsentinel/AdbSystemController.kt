package com.mateuscelestino.adbsentinel

import android.content.Context
import android.os.IBinder
import android.os.Parcel
import android.provider.Settings
import android.util.Log
import org.json.JSONArray
import org.json.JSONObject

data class AuthorizedKeyInfo(
    val keyId: String,
    val comment: String,
    val rawKey: String,
    val lastConnection: String = "",
    val wifiBssid: String = ""
)

object AdbSystemController {
    private const val TAG = "AdbSystemController"

    // Códigos de transação do IAdbManager no Android 11..14
    private const val TRANSACTION_ALLOW_DEBUGGING = 1
    private const val TRANSACTION_DENY_DEBUGGING = 2
    private const val TRANSACTION_CLEAR_KEYS = 3
    private const val TRANSACTION_ALLOW_WIRELESS = 4
    private const val TRANSACTION_DENY_WIRELESS = 5

    /**
     * Obtém o serviço "adb" através do IBinder do sistema via reflexão
     */
    private fun getAdbBinder(): IBinder? {
        return try {
            val serviceManagerClass = Class.forName("android.os.ServiceManager")
            val getServiceMethod = serviceManagerClass.getMethod("getService", String::class.java)
            getServiceMethod.invoke(null, "adb") as? IBinder
        } catch (e: Exception) {
            Log.e(TAG, "Falha ao obter IBinder do serviço adb: ${e.message}")
            null
        }
    }

    /**
     * Executa chamada IPC de baixo nível ao IAdbManager
     */
    private fun callAdbTransaction(code: Int, writeData: ((Parcel) -> Unit)? = null): Boolean {
        val binder = getAdbBinder()
        if (binder == null) {
            Log.w(TAG, "Binder do adb nulo. Tentando via shell execution.")
            return false
        }

        val data = Parcel.obtain()
        val reply = Parcel.obtain()
        return try {
            data.writeInterfaceToken("android.debug.IAdbManager")
            writeData?.invoke(data)
            val success = binder.transact(code, data, reply, 0)
            reply.readException()
            success
        } catch (e: Exception) {
            Log.e(TAG, "Erro na transação AIDL code=$code: ${e.message}")
            false
        } finally {
            data.recycle()
            reply.recycle()
        }
    }

    /**
     * Verifica se o Wireless ADB está ativo (porta 5555 ou adb_wifi_enabled)
     */
    fun isWirelessAdbEnabled(context: Context): Boolean {
        // 1. Checa a property TCP port
        try {
            val process = Runtime.getRuntime().exec("getprop service.adb.tcp.port")
            val portStr = process.inputStream.bufferedReader().use { it.readText().trim() }
            if (portStr == "5555" || (portStr.toIntOrNull() ?: -1) > 0) return true
        } catch (ignored: Exception) {}

        // 2. Checa Settings.Global adb_wifi_enabled
        try {
            val setting = Settings.Global.getInt(context.contentResolver, "adb_wifi_enabled", 0)
            if (setting == 1) return true
        } catch (ignored: Exception) {}

        // 3. Checa socket ativo no /proc/net/tcp
        val active = AdbSocketTracker.scanActiveConnections()
        return active.any { it.state == "LISTEN" && it.localPort == 5555 }
    }

    /**
     * Ativa o Wireless ADB (Porta 5555)
     */
    fun enableWirelessAdb(context: Context): Boolean {
        var success = false
        try {
            // Tenta via Settings.Global com WRITE_SECURE_SETTINGS
            Settings.Global.putInt(context.contentResolver, "adb_wifi_enabled", 1)
            success = true
        } catch (e: Exception) {
            Log.w(TAG, "Settings.Global putInt falhou: ${e.message}")
        }

        // Tenta também via comando shell / setprop se permissão disponível
        try {
            Runtime.getRuntime().exec(arrayOf("sh", "-c", "setprop service.adb.tcp.port 5555; stop adbd 2>/dev/null; start adbd 2>/dev/null"))
            success = true
        } catch (e: Exception) {
            Log.w(TAG, "Shell setprop falhou: ${e.message}")
        }

        return success
    }

    /**
     * Desativa o Wireless ADB
     */
    fun disableWirelessAdb(context: Context): Boolean {
        var success = false
        try {
            Settings.Global.putInt(context.contentResolver, "adb_wifi_enabled", 0)
            success = true
        } catch (e: Exception) {
            Log.w(TAG, "Settings.Global desativação falhou: ${e.message}")
        }

        try {
            Runtime.getRuntime().exec(arrayOf("sh", "-c", "setprop service.adb.tcp.port -1; stop adbd 2>/dev/null; start adbd 2>/dev/null"))
            success = true
        } catch (e: Exception) {
            Log.w(TAG, "Shell desativação setprop falhou: ${e.message}")
        }

        return success
    }

    /**
     * Autoriza permanentemente um host com sua chave pública
     */
    fun allowDebugging(alwaysAllow: Boolean, publicKey: String): Boolean {
        val aidlSuccess = callAdbTransaction(TRANSACTION_ALLOW_DEBUGGING) { data ->
            data.writeInt(if (alwaysAllow) 1 else 0)
            data.writeString(publicKey)
        }
        if (aidlSuccess) return true

        // Fallback via service call adb 1 i32 <always> s16 <key>
        return try {
            val alwaysInt = if (alwaysAllow) 1 else 0
            val process = Runtime.getRuntime().exec(arrayOf("service", "call", "adb", "1", "i32", alwaysInt.toString(), "s16", publicKey))
            process.waitFor() == 0
        } catch (e: Exception) {
            false
        }
    }

    /**
     * Recusa/Derruba a conexão atual de depuração
     */
    fun denyDebugging(): Boolean {
        val aidlSuccess = callAdbTransaction(TRANSACTION_DENY_DEBUGGING)
        if (aidlSuccess) return true

        return try {
            val process = Runtime.getRuntime().exec(arrayOf("service", "call", "adb", "2"))
            process.waitFor() == 0
        } catch (e: Exception) {
            false
        }
    }

    /**
     * Limpa e revoga todas as autorizações de chaves ADB do dispositivo
     */
    fun clearDebuggingKeys(): Boolean {
        val aidlSuccess = callAdbTransaction(TRANSACTION_CLEAR_KEYS)
        if (aidlSuccess) return true

        return try {
            val process = Runtime.getRuntime().exec(arrayOf("service", "call", "adb", "3"))
            process.waitFor() == 0
        } catch (e: Exception) {
            false
        }
    }

    /**
     * Analisa dumpsys adb para extrair chaves públicas autorizadas
     */
    fun getAuthorizedKeys(): List<AuthorizedKeyInfo> {
        val list = mutableListOf<AuthorizedKeyInfo>()
        try {
            val process = Runtime.getRuntime().exec("dumpsys adb")
            val text = process.inputStream.bufferedReader().use { it.readText() }

            // Procura user_keys
            val userKeysIndex = text.indexOf("user_keys=")
            if (userKeysIndex != -1) {
                val block = text.substring(userKeysIndex + "user_keys=".length)
                val line = block.substringBefore("\n").trim()
                if (line.isNotEmpty()) {
                    val parts = line.split("\\s+".toRegex())
                    val comment = if (parts.size > 1) parts.drop(1).joinToString(" ") else "Dispositivo Conectado"
                    val key = parts[0]
                    list.add(
                        AuthorizedKeyInfo(
                            keyId = comment,
                            comment = comment,
                            rawKey = key
                        )
                    )
                }
            }

            // Keystore parsing
            if (text.contains("adbKey")) {
                val lines = text.lines()
                lines.forEach { l ->
                    if (l.contains("@") && !l.contains("user_keys=")) {
                        val comment = l.trim().substringAfterLast(" ").ifEmpty { "Host Autorizado" }
                        if (list.none { it.comment == comment }) {
                            list.add(
                                AuthorizedKeyInfo(
                                    keyId = comment,
                                    comment = comment,
                                    rawKey = l.trim()
                                )
                            )
                        }
                    }
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Erro ao obter dumpsys adb: ${e.message}")
        }
        return list
    }
}
