package com.mateuscelestino.adbsentinel

import android.annotation.SuppressLint
import android.content.Context
import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioManager
import android.media.AudioRecord
import android.media.AudioTrack
import android.media.MediaRecorder
import android.media.audiofx.LoudnessEnhancer
import android.net.wifi.WifiManager
import android.os.Build
import android.os.PowerManager
import android.util.Log
import java.io.InputStream
import java.io.OutputStream
import java.net.ServerSocket
import java.net.Socket
import java.nio.ByteBuffer
import java.nio.ByteOrder

/**
 * 🔊 AudioStreamManager — Motor de Áudio Bidirecional de Baixíssima Latência
 * - Caixa de Som: Transmite todo áudio do macOS para os alto-falantes estéreo do Galaxy S22 Ultra (Porta 8082)
 * - Microfone: Transmite a captação do microfone do Galaxy S22 Ultra para o macOS (Porta 8081)
 */
object AudioStreamManager {
    private const val TAG = "AudioStreamManager"
    const val MIC_PORT = 8081
    const val SPEAKER_PORT = 8082

    private const val SAMPLE_RATE = 48000
    private const val CHANNEL_IN = AudioFormat.CHANNEL_IN_STEREO
    private const val CHANNEL_OUT = AudioFormat.CHANNEL_OUT_STEREO
    private const val ENCODING = AudioFormat.ENCODING_PCM_16BIT

    @Volatile
    var isMicRunning = false
        private set

    @Volatile
    var isSpeakerRunning = false
        private set

    private var appContext: Context? = null

    @Volatile
    var softwareBoosterGain: Float = 1.8f // 180% (+4.8 dB) de ganho padrão

    @Volatile
    var currentBoosterGainMb: Int = 1200 // +12 dB de boost de hardware DSP por padrão

    @Volatile
    private var activeLoudnessEnhancer: LoudnessEnhancer? = null

    @Synchronized
    fun setBoosterGainPercent(percent: Int, context: Context? = appContext) {
        val clampedPercent = percent.coerceIn(100, 350)
        val gain = clampedPercent.toFloat() / 100.0f
        softwareBoosterGain = gain
        currentBoosterGainMb = ((gain - 1.0f) * 1200.0f).toInt().coerceIn(0, 3000)

        try {
            val ctx = context ?: appContext
            ctx?.getSharedPreferences("aero_audio_prefs", Context.MODE_PRIVATE)
                ?.edit()
                ?.putInt("booster_percent", clampedPercent)
                ?.apply()
        } catch (ignored: Exception) {}

        try {
            activeLoudnessEnhancer?.apply {
                setTargetGain(currentBoosterGainMb)
                enabled = currentBoosterGainMb > 0
            }
        } catch (ignored: Exception) {}

        Log.i(TAG, "🎚️ [AeroMobile] Amplificador ajustado para $clampedPercent% (${gain}x)")
    }

    fun getBoosterGainPercent(context: Context? = appContext): Int {
        try {
            val ctx = context ?: appContext
            val saved = ctx?.getSharedPreferences("aero_audio_prefs", Context.MODE_PRIVATE)
                ?.getInt("booster_percent", 180) ?: 180
            softwareBoosterGain = saved.toFloat() / 100.0f
            return saved
        } catch (ignored: Exception) {}
        return (softwareBoosterGain * 100).toInt()
    }

    @Synchronized
    fun setBoosterGain(gainMb: Int) {
        currentBoosterGainMb = gainMb.coerceIn(0, 3000)
        softwareBoosterGain = 1.0f + (currentBoosterGainMb.toFloat() / 1200.0f)
        try {
            activeLoudnessEnhancer?.apply {
                setTargetGain(currentBoosterGainMb)
                enabled = currentBoosterGainMb > 0
            }
            Log.i(TAG, "🎚️ [AeroAudio] LoudnessEnhancer ajustado para ${currentBoosterGainMb} mB")
        } catch (e: Exception) {
            Log.w(TAG, "Erro ao ajustar LoudnessEnhancer: ${e.message}")
        }
    }

    /**
     * Aplica amplificação PCM 16-bit com Soft-Knee Analógico C1 Contínuo de Estúdio
     * - Multiplica as amostras estéreo com precisão
     * - Continuidade C1 rigorosa: zero degraus, zero saltos, zero chiado ou buzzing
     * - Até 70% de amplitude (0.70): 100% linear e transparente
     * - Acima de 70%: compressão assintótica suave knee + margin * tanh((x - knee)/margin)
     * - Garante som quente, potente e cristalino em filmes sem estourar o sinal
     */
    /**
     * Aplica amplificação PCM 16-bit com Soft-Knee Analógico C1 Contínuo de Estúdio
     * - Multiplica as amostras estéreo com precisão
     * - Continuidade C1 rigorosa: zero degraus, zero saltos, zero chiado ou buzzing
     * - Até 70% de amplitude (0.70): 100% linear e transparente
     * - Acima de 70%: compressão assintótica suave knee + margin * tanh((x - knee)/margin)
     * - Garante som quente, potente e cristalino em filmes sem estourar o sinal
     */
    fun applySoftwareBooster(buffer: ByteArray, offset: Int, length: Int) {
        val gain = softwareBoosterGain
        if (gain <= 1.01f) return

        val knee = 0.70f
        val margin = 0.30f
        val invMargin = 1.0f / 0.30f

        var i = offset
        val end = offset + length
        while (i + 1 < end) {
            val low = buffer[i].toInt() and 0xFF
            val high = buffer[i + 1].toInt()
            val sample16 = ((high shl 8) or low).toShort()
            val normSample = sample16.toFloat() / 32768.0f

            val boosted = normSample * gain
            val absVal = Math.abs(boosted)

            val outVal: Float
            if (absVal <= knee) {
                outVal = boosted
            } else {
                val sign = if (boosted > 0f) 1.0f else -1.0f
                val excess = (absVal - knee) * invMargin
                val compressed = knee + margin * Math.tanh(excess.toDouble()).toFloat()
                outVal = sign * compressed
            }

            val clamped = outVal.coerceIn(-1.0f, 1.0f)
            val outInt16 = (clamped * 32767.0f).toInt().coerceIn(-32767, 32767)

            buffer[i] = (outInt16 and 0xFF).toByte()
            buffer[i + 1] = ((outInt16 shr 8) and 0xFF).toByte()
            i += 2
        }
    }

    /**
     * Versão de ultra-alta performance em ShortArray (Zero Alocação no hot path)
     */
    fun applySoftwareBooster(samples: ShortArray, offset: Int, length: Int) {
        val gain = softwareBoosterGain
        if (gain <= 1.01f) return

        val knee = 0.70f
        val margin = 0.30f
        val invMargin = 1.0f / 0.30f

        val end = offset + length
        for (i in offset until end) {
            val sample = samples[i]
            val normSample = sample.toFloat() / 32768.0f
            val boosted = normSample * gain
            val absVal = Math.abs(boosted)

            val outVal: Float
            if (absVal <= knee) {
                outVal = boosted
            } else {
                val sign = if (boosted > 0f) 1.0f else -1.0f
                val excess = (absVal - knee) * invMargin
                val compressed = knee + margin * Math.tanh(excess.toDouble()).toFloat()
                outVal = sign * compressed
            }

            val clamped = outVal.coerceIn(-1.0f, 1.0f)
            samples[i] = (clamped * 32767.0f).toInt().coerceIn(-32767, 32767).toShort()
        }
    }

    /**
     * Aplica micro-fade-in suave nas amostras para evitar estalos de descontinuidade de fase (glitch-free transition)
     */
    private fun applyFadeIn(buffer: ByteArray, offset: Int, samples: Int) {
        val total = maxOf(1, samples)
        for (s in 0 until total) {
            val idx = offset + (s * 4)
            if (idx + 3 >= buffer.size) break
            val factor = s.toFloat() / total.toFloat()

            val left16 = ((buffer[idx + 1].toInt() shl 8) or (buffer[idx].toInt() and 0xFF)).toShort()
            val fadeLeft = (left16 * factor).toInt().toShort()
            buffer[idx] = (fadeLeft.toInt() and 0xFF).toByte()
            buffer[idx + 1] = ((fadeLeft.toInt() shr 8) and 0xFF).toByte()

            val right16 = ((buffer[idx + 3].toInt() shl 8) or (buffer[idx + 2].toInt() and 0xFF)).toShort()
            val fadeRight = (right16 * factor).toInt().toShort()
            buffer[idx + 2] = (fadeRight.toInt() and 0xFF).toByte()
            buffer[idx + 3] = ((fadeRight.toInt() shr 8) and 0xFF).toByte()
        }
    }

    private fun applyFadeIn(samples: ShortArray, offset: Int, frameCount: Int) {
        val total = maxOf(1, frameCount)
        for (f in 0 until total) {
            val factor = f.toFloat() / total.toFloat()
            val lIdx = offset + (f * 2)
            val rIdx = lIdx + 1
            if (rIdx < samples.size) {
                samples[lIdx] = (samples[lIdx] * factor).toInt().toShort()
                samples[rIdx] = (samples[rIdx] * factor).toInt().toShort()
            }
        }
    }

    private fun applyFadeOut(samples: ShortArray, offset: Int, frameCount: Int) {
        val total = maxOf(1, frameCount)
        for (f in 0 until total) {
            val factor = 1.0f - (f.toFloat() / total.toFloat())
            val lIdx = offset + (f * 2)
            val rIdx = lIdx + 1
            if (rIdx < samples.size) {
                samples[lIdx] = (samples[lIdx] * factor).toInt().toShort()
                samples[rIdx] = (samples[rIdx] * factor).toInt().toShort()
            }
        }
    }

    fun maximizeDeviceVolume(context: Context? = appContext) {
        try {
            val ctx = context ?: appContext ?: return
            val am = ctx.getSystemService(Context.AUDIO_SERVICE) as? AudioManager
            am?.let {
                val max = it.getStreamMaxVolume(AudioManager.STREAM_MUSIC)
                it.setStreamVolume(AudioManager.STREAM_MUSIC, max, 0)
                Log.i(TAG, "🔊 [AeroAudio] Volume de mídia STREAM_MUSIC colocado no máximo ($max).")
            }
        } catch (e: Exception) {
            Log.w(TAG, "Erro ao ajustar volume do dispositivo: ${e.message}")
        }
    }

    private var micServerSocket: ServerSocket? = null
    private var micServerThread: Thread? = null

    private var speakerServerSocket: ServerSocket? = null
    private var speakerServerThread: Thread? = null

    private var wakeLock: PowerManager.WakeLock? = null
    private var wifiLock: WifiManager.WifiLock? = null
    private var audioManager: AudioManager? = null
    private var audioFocusRequest: android.media.AudioFocusRequest? = null

    private val activeStreamingSessions = java.util.concurrent.atomic.AtomicInteger(0)

    @Synchronized
    private fun acquireStreamingLocks() {
        val count = activeStreamingSessions.incrementAndGet()
        val context = appContext ?: return
        if (count == 1 || wakeLock == null || wakeLock?.isHeld != true) {
            acquireLocks(context)
        }
    }

    @Synchronized
    private fun releaseStreamingLocks() {
        val count = activeStreamingSessions.decrementAndGet()
        if (count <= 0) {
            activeStreamingSessions.set(0)
            releaseLocksForce()
        }
    }

    fun releaseLocksIfIdleExternal() {
        if (activeStreamingSessions.get() <= 0) {
            releaseLocksForce()
        }
    }

    @Synchronized
    fun releaseLocksForce() {
        try {
            if (wakeLock?.isHeld == true) wakeLock?.release()
            wakeLock = null
            if (wifiLock?.isHeld == true) wifiLock?.release()
            wifiLock = null

            audioManager?.let { am ->
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && audioFocusRequest != null) {
                    am.abandonAudioFocusRequest(audioFocusRequest!!)
                    audioFocusRequest = null
                } else {
                    @Suppress("DEPRECATION")
                    am.abandonAudioFocus(null)
                }
            }
            Log.i(TAG, "⚡ [AeroAudio] Locks de energia liberados para repouso profundo (Doze).")
        } catch (e: Exception) {
            Log.w(TAG, "Aviso ao liberar locks: ${e.message}")
        }
    }

    @Synchronized
    private fun acquireLocks(context: Context) {
        try {
            if (wakeLock == null) {
                val pm = context.applicationContext.getSystemService(Context.POWER_SERVICE) as? PowerManager
                wakeLock = pm?.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "AeroSentinel:AudioStreamWakeLock")?.apply {
                    setReferenceCounted(false)
                    acquire(15 * 60 * 1000L) // 15 min safety timeout
                }
            }
            if (wifiLock == null) {
                val wm = context.applicationContext.getSystemService(Context.WIFI_SERVICE) as? WifiManager
                val mode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    WifiManager.WIFI_MODE_FULL_LOW_LATENCY
                } else {
                    @Suppress("DEPRECATION")
                    WifiManager.WIFI_MODE_FULL_HIGH_PERF
                }
                wifiLock = wm?.createWifiLock(mode, "AeroSentinel:AudioStreamWifiLock")?.apply {
                    setReferenceCounted(false)
                    acquire()
                }
            }

            // Solicita foco de áudio prioritário para impedir suspensão pelo PowerHAL / AudioFlinger em background
            if (audioManager == null) {
                audioManager = context.applicationContext.getSystemService(Context.AUDIO_SERVICE) as? AudioManager
            }
            audioManager?.let { am ->
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    val attrs = AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_MEDIA)
                        .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                        .build()
                    val req = android.media.AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
                        .setAudioAttributes(attrs)
                        .setAcceptsDelayedFocusGain(true)
                        .setOnAudioFocusChangeListener { /* Mantém stream contínuo */ }
                        .build()
                    audioFocusRequest = req
                    am.requestAudioFocus(req)
                } else {
                    @Suppress("DEPRECATION")
                    am.requestAudioFocus(null, AudioManager.STREAM_MUSIC, AudioManager.AUDIOFOCUS_GAIN)
                }
            }
        } catch (e: Exception) {
            Log.w(TAG, "Aviso ao obter locks de energia: ${e.message}")
        }
    }

    @Synchronized
    private fun releaseLocksIfIdle() {
        if (!isMicRunning && !isSpeakerRunning) {
            releaseLocksForce()
        }
    }

    // -------------------------------------------------------------
    // 1. MICROFONE (Galaxy Ultra -> Mac na porta 8081)
    // -------------------------------------------------------------
    @Synchronized
    fun startMicServer(context: Context): Boolean {
        if (isMicRunning) return true
        this.appContext = context.applicationContext
        try {
            micServerSocket = ServerSocket(MIC_PORT).apply { reuseAddress = true }
            isMicRunning = true

            micServerThread = Thread({
                Log.i(TAG, "🟢 [AeroAudio] Mic server ouvindo na porta $MIC_PORT...")
                while (isMicRunning && !Thread.currentThread().isInterrupted) {
                    try {
                        val client = micServerSocket?.accept() ?: break
                        client.tcpNoDelay = true
                        Thread({ handleMicClient(client) }, "AeroMicClient-${client.inetAddress}").start()
                    } catch (e: Exception) {
                        if (isMicRunning) Log.e(TAG, "Erro accept mic: ${e.message}")
                    }
                }
            }, "AeroMicServerThread").apply {
                priority = Thread.MAX_PRIORITY
                start()
            }

            return true
        } catch (e: Exception) {
            Log.e(TAG, "Falha ao iniciar Mic Server: ${e.message}", e)
            stopMicServer()
            return false
        }
    }

    @Synchronized
    fun stopMicServer() {
        isMicRunning = false
        try { micServerSocket?.close() } catch (ignored: Exception) {}
        micServerSocket = null

        micServerThread?.interrupt()
        micServerThread = null
        releaseLocksIfIdle()
        Log.i(TAG, "🔴 [AeroAudio] Mic server finalizado.")
    }

    @SuppressLint("MissingPermission")
    private fun handleMicClient(socket: Socket) {
        var activeRecord: AudioRecord? = null
        try {
            val input = socket.getInputStream()
            val reqBuffer = ByteArray(512)
            val bytesRead = input.read(reqBuffer)
            if (bytesRead <= 0) return
            val requestStr = String(reqBuffer, 0, bytesRead)
            val out = socket.getOutputStream()

            if (requestStr.startsWith("GET /status") || requestStr.startsWith("GET /ping")) {
                val resp = "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nConnection: close\r\n\r\n{\"mic\":true}\n"
                out.write(resp.toByteArray(Charsets.UTF_8))
                out.flush()
                return
            }

            val minBufSize = AudioRecord.getMinBufferSize(SAMPLE_RATE, CHANNEL_IN, ENCODING)
            val bufferSize = maxOf(minBufSize * 2, 8192)

            // Usa VOICE_COMMUNICATION para acionar o hardware DSP de cancelamento de ruído do Galaxy S22 Ultra
            val audioSource = MediaRecorder.AudioSource.VOICE_COMMUNICATION

            val record = try {
                AudioRecord(audioSource, SAMPLE_RATE, CHANNEL_IN, ENCODING, bufferSize)
            } catch (e: Exception) {
                // Fallback para MIC padrão caso VOICE_COMMUNICATION falhe
                AudioRecord(MediaRecorder.AudioSource.MIC, SAMPLE_RATE, CHANNEL_IN, ENCODING, bufferSize)
            }
            activeRecord = record

            if (record.state != AudioRecord.STATE_INITIALIZED) {
                Log.e(TAG, "AudioRecord não inicializado.")
                return
            }

            record.startRecording()
            acquireStreamingLocks()

            val header = "HTTP/1.1 200 OK\r\n" +
                    "Content-Type: audio/wav\r\n" +
                    "Server: AeroSentinelAudio\r\n" +
                    "Connection: close\r\n" +
                    "Cache-Control: no-cache, no-store\r\n\r\n"
            out.write(header.toByteArray(Charsets.UTF_8))

            val wavHeader = createWavHeader(SAMPLE_RATE, 2, 16)
            out.write(wavHeader)
            out.flush()

            val pcmBuffer = ByteArray(bufferSize)
            while (isMicRunning && socket.isConnected && !socket.isClosed) {
                val read = record.read(pcmBuffer, 0, pcmBuffer.size)
                if (read > 0) {
                    out.write(pcmBuffer, 0, read)
                    out.flush()
                } else if (read < 0) {
                    break
                }
            }
        } catch (e: Exception) {
            Log.v(TAG, "Cliente de microfone desconectado: ${e.message}")
        } finally {
            releaseStreamingLocks()
            try {
                if (activeRecord?.recordingState == AudioRecord.RECORDSTATE_RECORDING) {
                    activeRecord.stop()
                }
                activeRecord?.release()
            } catch (ignored: Exception) {}
            try { socket.close() } catch (ignored: Exception) {}
        }
    }

    private fun createWavHeader(sampleRate: Int, channels: Int, bitDepth: Int): ByteArray {
        val totalAudioLen = 0x7fffff00
        val totalDataLen = totalAudioLen + 36
        val byteRate = sampleRate * channels * bitDepth / 8
        val blockAlign = channels * bitDepth / 8

        val header = ByteBuffer.allocate(44).apply {
            order(ByteOrder.LITTLE_ENDIAN)
            put("RIFF".toByteArray())
            putInt(totalDataLen)
            put("WAVE".toByteArray())
            put("fmt ".toByteArray())
            putInt(16)
            putShort(1.toShort())
            putShort(channels.toShort())
            putInt(sampleRate)
            putInt(byteRate)
            putShort(blockAlign.toShort())
            putShort(bitDepth.toShort())
            put("data".toByteArray())
            putInt(totalAudioLen)
        }
        return header.array()
    }

    // -------------------------------------------------------------
    // 2. CAIXA DE SOM (Mac -> Galaxy Ultra na porta 8082)
    // -------------------------------------------------------------

    /**
     * Buffer Elástico Anti-Jitter Circular de Ultra-Baixa Latência (48kHz Estéreo 16-bit)
     * - Desacopla 100% o socket de rede da thread de reprodução de áudio
     * - Reamostragem micro-analógica contínua (zero cliques, zero cortes de fase)
     * - Absorve variações de jitter Wi-Fi/Tailscale mantendo lip-sync <50ms constante
     */
    class AudioJitterBuffer(capacityFrames: Int = 96000) {
        private val capacityShorts = capacityFrames * 2
        private val buffer = ShortArray(capacityShorts)
        private val lock = Any()

        @Volatile private var writePos = 0
        @Volatile private var readPos = 0
        @Volatile private var countShorts = 0

        fun clear() {
            synchronized(lock) {
                writePos = 0
                readPos = 0
                countShorts = 0
            }
        }

        fun availableFrames(): Int {
            return countShorts / 2
        }

        fun writeBytes(src: ByteArray, offset: Int, length: Int) {
            val validBytes = length - (length % 4)
            if (validBytes <= 0) return
            val numShorts = validBytes / 2

            synchronized(lock) {
                var srcIdx = offset
                for (s in 0 until numShorts) {
                    val low = src[srcIdx].toInt() and 0xFF
                    val high = src[srcIdx + 1].toInt()
                    val sample = ((high shl 8) or low).toShort()
                    srcIdx += 2

                    buffer[writePos] = sample
                    writePos = (writePos + 1) % capacityShorts
                }
                countShorts = minOf(capacityShorts, countShorts + numShorts)
                if (countShorts == capacityShorts) {
                    readPos = writePos // Se estourar 2s de buffer, avança para manter tempo real
                }
            }
        }

        fun readResampled(out: ShortArray, outOffset: Int, outFrames: Int, speedRatio: Float): Int {
            synchronized(lock) {
                val available = countShorts / 2
                if (available < 2) return 0

                val maxPossible = (available / maxOf(0.5f, speedRatio)).toInt()
                val framesToGenerate = minOf(outFrames, maxPossible)
                if (framesToGenerate <= 0) return 0

                // Caminho ultra-rápido bit-perfect (1:1 direto sem interpolação)
                if (Math.abs(speedRatio - 1.0f) < 0.0008f) {
                    val shortsToRead = framesToGenerate * 2
                    for (i in 0 until shortsToRead) {
                        out[outOffset + i] = buffer[readPos]
                        readPos = (readPos + 1) % capacityShorts
                    }
                    countShorts -= shortsToRead
                    return framesToGenerate
                }

                // Interpolação analógica linear contínua por canal (L/R)
                var fractionalSrcFrame = 0.0
                for (f in 0 until framesToGenerate) {
                    val frame0Idx = fractionalSrcFrame.toInt()
                    val frac = (fractionalSrcFrame - frame0Idx).toFloat()

                    val pos0 = (readPos + (frame0Idx * 2)) % capacityShorts
                    val pos1 = (pos0 + 2) % capacityShorts

                    val sL0 = buffer[pos0].toFloat()
                    val sR0 = buffer[(pos0 + 1) % capacityShorts].toFloat()
                    val sL1 = buffer[pos1].toFloat()
                    val sR1 = buffer[(pos1 + 1) % capacityShorts].toFloat()

                    val outL = (1.0f - frac) * sL0 + frac * sL1
                    val outR = (1.0f - frac) * sR0 + frac * sR1

                    out[outOffset + (f * 2)] = outL.toInt().coerceIn(-32768, 32767).toShort()
                    out[outOffset + (f * 2) + 1] = outR.toInt().coerceIn(-32768, 32767).toShort()

                    fractionalSrcFrame += speedRatio
                }

                val framesConsumed = minOf(available, Math.round(fractionalSrcFrame).toInt())
                val shortsConsumed = framesConsumed * 2
                readPos = (readPos + shortsConsumed) % capacityShorts
                countShorts = maxOf(0, countShorts - shortsConsumed)

                return framesToGenerate
            }
        }
    }

    private var activeSpeakerSession: SpeakerAudioSession? = null

    private class SpeakerAudioSession(
        val socket: Socket,
        val initialPeek: ByteArray,
        val initialPeekLen: Int
    ) {
        @Volatile var isRunning = true
        val jitterBuffer = AudioJitterBuffer(96000)
        var playerThread: Thread? = null
        var track: AudioTrack? = null
        var enhancer: LoudnessEnhancer? = null

        fun start() {
            acquireStreamingLocks()
            // Se houver dados iniciais de áudio recebidos no peek
            if (initialPeekLen > 0) {
                jitterBuffer.writeBytes(initialPeek, 0, initialPeekLen)
            }

            // 1. Thread de Ingestão de Rede Asíncrona (Prioridade Máxima)
            val ingestThread = Thread({
                try {
                    android.os.Process.setThreadPriority(android.os.Process.THREAD_PRIORITY_URGENT_AUDIO)
                } catch (ignored: Exception) {}

                try {
                    val rawInput = socket.getInputStream()
                    val netBuffer = ByteArray(4096)
                    while (isRunning && !socket.isClosed && socket.isConnected) {
                        val read = rawInput.read(netBuffer, 0, netBuffer.size)
                        if (read <= 0) break
                        jitterBuffer.writeBytes(netBuffer, 0, read)
                    }
                } catch (e: Exception) {
                    Log.v(TAG, "Ingestão de áudio finalizada: ${e.message}")
                } finally {
                    stop()
                }
            }, "AeroAudioIngestThread")
            ingestThread.priority = Thread.MAX_PRIORITY
            ingestThread.start()

            // 2. Thread Dedicada de Reprodução com Resampler Anti-Jitter
            playerThread = Thread({
                try {
                    android.os.Process.setThreadPriority(android.os.Process.THREAD_PRIORITY_URGENT_AUDIO)
                } catch (ignored: Exception) {}

                val minBuf = AudioTrack.getMinBufferSize(SAMPLE_RATE, CHANNEL_OUT, ENCODING)
                val bufferCapacity = maxOf(minBuf * 2, 24576)

                val audioAttrs = AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_MEDIA)
                    .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                    .setFlags(AudioAttributes.FLAG_AUDIBILITY_ENFORCED)
                    .build()

                val audioFormat = AudioFormat.Builder()
                    .setSampleRate(SAMPLE_RATE)
                    .setChannelMask(CHANNEL_OUT)
                    .setEncoding(ENCODING)
                    .build()

                val trackBuilder = AudioTrack.Builder()
                    .setAudioAttributes(audioAttrs)
                    .setAudioFormat(audioFormat)
                    .setBufferSizeInBytes(bufferCapacity)
                    .setTransferMode(AudioTrack.MODE_STREAM)

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    trackBuilder.setPerformanceMode(AudioTrack.PERFORMANCE_MODE_LOW_LATENCY)
                }

                val localTrack = trackBuilder.build()
                this.track = localTrack

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                    // Buffer de hardware fixado em 2160 quadros (~45ms):
                    // Lip-sync perfeito de estúdio sem acúmulo de atraso no hardware
                    try {
                        localTrack.setBufferSizeInFrames(2160)
                    } catch (ignored: Exception) {}
                }

                try {
                    val enh = LoudnessEnhancer(localTrack.audioSessionId).apply {
                        setTargetGain(currentBoosterGainMb)
                        enabled = currentBoosterGainMb > 0
                    }
                    this.enhancer = enh
                    activeLoudnessEnhancer = enh
                    Log.i(TAG, "🔊 [AeroAudio] LoudnessEnhancer DSP ativado no sessionId ${localTrack.audioSessionId} com ganho de ${currentBoosterGainMb}mB")
                } catch (e: Exception) {
                    Log.w(TAG, "LoudnessEnhancer indisponível: ${e.message}")
                }

                val chunkFrames = 240 // 5ms de áudio a 48kHz
                val chunkShorts = ShortArray(chunkFrames * 2)
                val targetCushionFrames = 2304 // ~48ms de ouro para lip-sync & estabilidade
                val prebufferFrames = 1920 // ~40ms para iniciar com solidez

                var isPrebuffering = true
                var needsFadeIn = true

                while (isRunning) {
                    val available = jitterBuffer.availableFrames()

                    if (isPrebuffering) {
                        if (available >= prebufferFrames) {
                            isPrebuffering = false
                            needsFadeIn = true
                            localTrack.play()
                        } else {
                            try { Thread.sleep(3) } catch (ignored: Exception) {}
                            continue
                        }
                    }

                    if (available < chunkFrames) {
                        // Rede oscilou severamente (esgotamento momentâneo)
                        // Limpa amostras com fade rápido para evitar estalos
                        isPrebuffering = true
                        java.util.Arrays.fill(chunkShorts, 0.toShort())
                        localTrack.write(chunkShorts, 0, chunkShorts.size)
                        try { Thread.sleep(4) } catch (ignored: Exception) {}
                        continue
                    }

                    // Resampler elástico analógico:
                    // Mantém o buffer centrado em 48ms de forma imperceptível aos ouvidos
                    val diff = available - targetCushionFrames
                    val speedRatio: Float = when {
                        diff > 288 -> {
                            // Fila subiu (>54ms): acelera suavemente de 1.002x a 1.012x para drenar atraso
                            val excessRatio = minOf(0.012f, ((diff - 288).toFloat() / 48000.0f) * 0.18f)
                            1.0f + excessRatio
                        }
                        diff < -288 -> {
                            // Fila desceu (<42ms): freia suavemente de 0.995x a 0.998x para proteger contra queda
                            val deficitRatio = minOf(0.008f, ((-diff - 288).toFloat() / 48000.0f) * 0.12f)
                            1.0f - deficitRatio
                        }
                        else -> 1.0f
                    }

                    val generated = jitterBuffer.readResampled(chunkShorts, 0, chunkFrames, speedRatio)
                    if (generated > 0) {
                        if (needsFadeIn) {
                            applyFadeIn(chunkShorts, 0, minOf(generated, 48))
                            needsFadeIn = false
                        }

                        applySoftwareBooster(chunkShorts, 0, generated * 2)
                        localTrack.write(chunkShorts, 0, generated * 2)
                    }
                }

                try {
                    if (localTrack.playState == AudioTrack.PLAYSTATE_PLAYING) {
                        localTrack.pause()
                        localTrack.flush()
                    }
                    localTrack.release()
                } catch (ignored: Exception) {}
                try { enhancer?.release() } catch (ignored: Exception) {}
                if (activeLoudnessEnhancer == enhancer) {
                    activeLoudnessEnhancer = null
                }
            }, "AeroAudioPlayerThread")
            playerThread?.priority = Thread.MAX_PRIORITY
            playerThread?.start()
        }

        fun stop() {
            if (!isRunning) return
            isRunning = false
            releaseStreamingLocks()
            try { socket.close() } catch (ignored: Exception) {}
            playerThread?.interrupt()
        }
    }

    @Synchronized
    fun startSpeakerServer(context: Context): Boolean {
        if (isSpeakerRunning) return true
        this.appContext = context.applicationContext
        getBoosterGainPercent(context)
        maximizeDeviceVolume(context)
        try {
            speakerServerSocket = ServerSocket(SPEAKER_PORT).apply { reuseAddress = true }
            isSpeakerRunning = true

            speakerServerThread = Thread({
                Log.i(TAG, "🟢 [AeroAudio] Speaker server ouvindo na porta $SPEAKER_PORT...")
                while (isSpeakerRunning && !Thread.currentThread().isInterrupted) {
                    try {
                        val client = speakerServerSocket?.accept() ?: break
                        client.tcpNoDelay = true
                        client.receiveBufferSize = 131072
                        client.sendBufferSize = 16384
                        Thread({ handleSpeakerClient(client) }, "AeroSpeakerClient-${client.inetAddress}").start()
                    } catch (e: Exception) {
                        if (isSpeakerRunning) Log.e(TAG, "Erro accept speaker: ${e.message}")
                    }
                }
            }, "AeroSpeakerServerThread").apply {
                priority = Thread.MAX_PRIORITY
                start()
            }

            return true
        } catch (e: Exception) {
            Log.e(TAG, "Falha ao iniciar Speaker Server: ${e.message}", e)
            stopSpeakerServer()
            return false
        }
    }

    @Synchronized
    fun stopSpeakerServer() {
        isSpeakerRunning = false
        try { activeSpeakerSession?.stop() } catch (ignored: Exception) {}
        activeSpeakerSession = null

        try { speakerServerSocket?.close() } catch (ignored: Exception) {}
        speakerServerSocket = null

        speakerServerThread?.interrupt()
        speakerServerThread = null
        releaseLocksIfIdle()
        Log.i(TAG, "🔴 [AeroAudio] Speaker server finalizado.")
    }

    private fun handleSpeakerClient(socket: Socket) {
        try {
            val rawInput = socket.getInputStream()
            val out = socket.getOutputStream()

            // 1. Timeout inicial para detecção rápida de probes/testes de porta sem travar
            socket.soTimeout = 2000
            val peekBuf = ByteArray(256)
            val firstByte = try { rawInput.read() } catch (e: Exception) { -1 }

            if (firstByte == -1) {
                // Conexão de teste/probe (como testPort do Mac) -> fecha imediatamente SEM alocar hardware de áudio
                try { socket.close() } catch (ignored: Exception) {}
                return
            }

            socket.soTimeout = 0 // Remove timeout para streaming contínuo

            peekBuf[0] = firstByte.toByte()
            val available = rawInput.available()
            val extraRead = if (available > 0) rawInput.read(peekBuf, 1, minOf(available, peekBuf.size - 1)) else 0
            val totalPeek = 1 + maxOf(0, extraRead)
            val preview = String(peekBuf, 0, totalPeek, Charsets.US_ASCII)

            // 2. Comandos de Controle HTTP (atendidos sem instanciar AudioTrack)
            if (preview.startsWith("GET") || preview.startsWith("POST") || preview.startsWith("PUT") || preview.startsWith("HEAD")) {
                if (preview.contains("/boost")) {
                    val gainParam = preview.substringAfter("gain=").substringBefore(" ").substringBefore("&").toIntOrNull() ?: 1200
                    setBoosterGain(gainParam)
                    val resp = "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nConnection: close\r\n\r\n{\"boost\":true,\"gainMb\":$currentBoosterGainMb}\n"
                    out.write(resp.toByteArray(Charsets.UTF_8))
                    out.flush()
                    try { socket.close() } catch (ignored: Exception) {}
                    return
                }
                if (preview.contains("/maxvol")) {
                    maximizeDeviceVolume()
                    val resp = "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nConnection: close\r\n\r\n{\"maxvol\":true}\n"
                    out.write(resp.toByteArray(Charsets.UTF_8))
                    out.flush()
                    try { socket.close() } catch (ignored: Exception) {}
                    return
                }
                if (preview.contains("/test") || preview.contains("/beep") || preview.contains("/chime")) {
                    playTestTone()
                    val resp = "HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\nConnection: close\r\n\r\nBeep Played\n"
                    out.write(resp.toByteArray(Charsets.UTF_8))
                    out.flush()
                    try { socket.close() } catch (ignored: Exception) {}
                    return
                }
                if (preview.startsWith("GET /ping") || preview.startsWith("GET /status")) {
                    val resp = "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nConnection: close\r\n\r\n{\"speaker\":true,\"gainMb\":$currentBoosterGainMb}\n"
                    out.write(resp.toByteArray(Charsets.UTF_8))
                    out.flush()
                    try { socket.close() } catch (ignored: Exception) {}
                    return
                }
            }

            // 3. FLUXO REAL DE STREAMING DE ÁUDIO PCM
            // Se já houver uma sessão anterior ativa, finaliza de forma limpa para ceder vez à nova
            synchronized(this) {
                activeSpeakerSession?.stop()
                val session = SpeakerAudioSession(socket, peekBuf, totalPeek)
                activeSpeakerSession = session
                session.start()
            }
        } catch (e: Exception) {
            Log.v(TAG, "Cliente de alto-falante desconectado: ${e.message}")
            try { socket.close() } catch (ignored: Exception) {}
        }
    }

    fun playTestTone() {
        Thread {
            try {
                val sampleRate = 48000
                val durationMs = 320
                val numSamples = (sampleRate * durationMs) / 1000
                val samples = ShortArray(numSamples)
                val freq = 880.0 // A5 chime cristalino
                for (i in 0 until numSamples) {
                    val angle = 2.0 * Math.PI * i / (sampleRate / freq)
                    val envelope = Math.sin(Math.PI * i / numSamples)
                    samples[i] = (Math.sin(angle) * 26000 * envelope).toInt().toShort()
                }
                val stereo = ShortArray(numSamples * 2)
                for (i in 0 until numSamples) {
                    stereo[i * 2] = samples[i]
                    stereo[i * 2 + 1] = samples[i]
                }
                val track = AudioTrack.Builder()
                    .setAudioAttributes(AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA).setContentType(AudioAttributes.CONTENT_TYPE_MUSIC).build())
                    .setAudioFormat(AudioFormat.Builder().setSampleRate(sampleRate).setChannelMask(AudioFormat.CHANNEL_OUT_STEREO).setEncoding(AudioFormat.ENCODING_PCM_16BIT).build())
                    .setBufferSizeInBytes(stereo.size * 2)
                    .setTransferMode(AudioTrack.MODE_STATIC)
                    .build()
                track.write(stereo, 0, stereo.size)
                track.play()
                Thread.sleep(durationMs.toLong() + 100)
                track.release()
            } catch (e: Exception) {
                Log.e(TAG, "Erro playTestTone: ${e.message}")
            }
        }.start()
    }
}
