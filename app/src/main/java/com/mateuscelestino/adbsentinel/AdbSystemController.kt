package com.mateuscelestino.adbsentinel

import android.content.Context
import android.os.IBinder
import android.os.Parcel
import android.provider.Settings
import android.util.Log
import java.io.File
import java.lang.reflect.Method

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

    // Reflexão cacheada para leitura instantânea (0ms, sem fork de processos)
    private val systemPropertiesGetMethod: Method? by lazy {
        try {
            val clazz = Class.forName("android.os.SystemProperties")
            clazz.getMethod("get", String::class.java, String::class.java)
        } catch (e: Exception) {
            null
        }
    }

    // Estado otimista de transição para evitar flicker imediato após clique
    @Volatile
    private var optimisticAdbState: Boolean? = null
    @Volatile
    private var lastToggleTimestamp: Long = 0L

    // Cache de chaves autorizadas para evitar chamadas repetidas ao dumpsys
    @Volatile
    private var cachedKeys: List<AuthorizedKeyInfo> = emptyList()
    @Volatile
    private var lastKeysFetchTime: Long = 0L

    /**
     * Lê propriedade do sistema via memória compartilhada (libc) em 0ms sem criar processo
     */
    fun getSystemProperty(key: String, defaultValue: String = ""): String {
        return try {
            val method = systemPropertiesGetMethod
            if (method != null) {
                (method.invoke(null, key, defaultValue) as? String)?.trim() ?: defaultValue
            } else {
                defaultValue
            }
        } catch (e: Exception) {
            defaultValue
        }
    }

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
        val binder = getAdbBinder() ?: return false

        val data = Parcel.obtain()
        val reply = Parcel.obtain()
        return try {
            data.writeInterfaceToken("android.debug.IAdbManager")
            writeData?.invoke(data)
            val success = binder.transact(code, data, reply, 0)
            try {
                reply.readException()
            } catch (se: SecurityException) {
                Log.w(TAG, "IAdbManager requer MANAGE_DEBUGGING: ${se.message}")
                return false
            }
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
     * Verifica de forma instantânea (0ms, sem fork) se o sistema ADB está ativo
     */
    fun isWirelessAdbEnabled(context: Context): Boolean {
        val now = System.currentTimeMillis()
        val optimistic = optimisticAdbState
        if (optimistic != null && (now - lastToggleTimestamp) < 2500L) {
            return optimistic
        }

        // 1. Verifica o estado real do daemon adbd via SystemProperties (instantâneo)
        val adbdState = getSystemProperty("init.svc.adbd", "")
        if (adbdState.equals("stopped", ignoreCase = true)) {
            return false
        }

        // 2. Verifica Settings.Global (adb_enabled e adb_wifi_enabled)
        var adbEnabled = false
        var adbWifiEnabled = false
        try {
            adbEnabled = Settings.Global.getInt(context.contentResolver, Settings.Global.ADB_ENABLED, 0) == 1
        } catch (ignored: Exception) {}

        try {
            adbWifiEnabled = Settings.Global.getInt(context.contentResolver, "adb_wifi_enabled", 0) == 1
        } catch (ignored: Exception) {}

        if (!adbEnabled && !adbWifiEnabled) {
            return false
        }

        return true
    }

    /**
     * Ativa o Sistema ADB / Wireless ADB (Porta 5555)
     */
    fun enableWirelessAdb(context: Context): Boolean {
        optimisticAdbState = true
        lastToggleTimestamp = System.currentTimeMillis()
        var success = false

        // 1. Ativa imediatamente via Settings.Global (usando WRITE_SECURE_SETTINGS)
        try {
            Settings.Global.putInt(context.contentResolver, Settings.Global.ADB_ENABLED, 1)
            success = true
        } catch (e: Exception) {
            Log.w(TAG, "Falha ao ativar ADB_ENABLED: ${e.message}")
        }

        try {
            Settings.Global.putInt(context.contentResolver, "adb_wifi_enabled", 1)
            success = true
        } catch (e: Exception) {
            Log.w(TAG, "Falha ao ativar adb_wifi_enabled: ${e.message}")
        }

        // 2. Sinaliza arquivo de controle para o daemon shell e executa fallback assíncrono
        writeDaemonControlCommand(context, "ENABLE")

        Thread {
            try {
                callAdbTransaction(TRANSACTION_ALLOW_WIRELESS) { data ->
                    data.writeInt(1)
                    data.writeString("")
                }
                Runtime.getRuntime().exec(
                    arrayOf("sh", "-c", "setprop service.adb.tcp.port 5555 2>/dev/null; start adbd 2>/dev/null")
                )
            } catch (ignored: Exception) {}
        }.apply {
            isDaemon = true
            start()
        }

        return success
    }

    /**
     * Pausa ou redefine o monitoramento do Sentinel sem derrubar o ADB do Android
     */
    fun disableWirelessAdb(context: Context): Boolean {
        optimisticAdbState = false
        lastToggleTimestamp = System.currentTimeMillis()

        // SALVA-GUARDA PERMANENTE:
        // Mantém Settings.Global.ADB_ENABLED sempre 1 para NUNCA derrubar o serviço ADB do usuário
        try {
            Settings.Global.putInt(context.contentResolver, Settings.Global.ADB_ENABLED, 1)
        } catch (ignored: Exception) {}

        // 2. Limpa conexões ativas em memória imediatamente
        AdbSocketTracker.clearActiveConnectionsCache()

        // 3. Sinaliza arquivo de controle para o daemon shell
        writeDaemonControlCommand(context, "DISABLE")

        return true
    }

    private fun writeDaemonControlCommand(context: Context, cmd: String) {
        try {
            val extDir = context.getExternalFilesDir(null)
            if (extDir != null) {
                if (!extDir.exists()) extDir.mkdirs()
                File(extDir, "adb_control.cmd").writeText("$cmd\n")
            }
        } catch (ignored: Exception) {}
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
        cachedKeys = emptyList()
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
     * Analisa dumpsys adb (ou cache do daemon) para extrair chaves públicas autorizadas
     */
    fun getAuthorizedKeys(context: Context? = null): List<AuthorizedKeyInfo> {
        val now = System.currentTimeMillis()
        if (cachedKeys.isNotEmpty() && (now - lastKeysFetchTime) < 8000L) {
            return cachedKeys
        }

        val list = mutableListOf<AuthorizedKeyInfo>()
        try {
            // Tenta primeiro ler de arquivo de cache gerado pelo daemon se existir
            val extKeyFile = context?.getExternalFilesDir(null)?.let { File(it, "adb_keys.txt") }
            val tmpKeyFile = File("/data/local/tmp/adb_keys.txt")
            val rawText = when {
                extKeyFile != null && extKeyFile.exists() && extKeyFile.canRead() -> extKeyFile.readText()
                tmpKeyFile.exists() && tmpKeyFile.canRead() -> tmpKeyFile.readText()
                else -> {
                    val process = Runtime.getRuntime().exec("dumpsys adb")
                    process.inputStream.bufferedReader().use { it.readText() }
                }
            }

            val userKeysIndex = rawText.indexOf("user_keys=")
            if (userKeysIndex != -1) {
                val block = rawText.substring(userKeysIndex + "user_keys=".length)
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

            if (rawText.contains("adbKey")) {
                rawText.lines().forEach { l ->
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
            Log.e(TAG, "Erro ao obter chaves ADB: ${e.message}")
        }

        if (list.isNotEmpty()) {
            cachedKeys = list
            lastKeysFetchTime = now
        }
        return list
    }
}
