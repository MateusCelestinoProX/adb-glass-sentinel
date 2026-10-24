package com.mateuscelestino.adbsentinel

import android.annotation.SuppressLint
import android.content.Context
import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.AudioTrack
import android.media.MediaRecorder
import android.util.Log
import java.io.InputStream
import java.io.OutputStream
import java.net.ServerSocket
import java.net.Socket
import java.nio.ByteBuffer
import java.nio.ByteOrder

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

    private var micServerSocket: ServerSocket? = null
    private var micServerThread: Thread? = null

    private var speakerServerSocket: ServerSocket? = null
    private var speakerServerThread: Thread? = null

    // -------------------------------------------------------------
    // 1. MICROFONE (Android -> Mac na porta 8081)
    // -------------------------------------------------------------
    @Synchronized
    fun startMicServer(context: Context): Boolean {
        if (isMicRunning) return true
        try {
            micServerSocket = ServerSocket(MIC_PORT).apply { reuseAddress = true }
            isMicRunning = true

            micServerThread = Thread({
                Log.i(TAG, "Mic server ouvindo na porta $MIC_PORT...")
                while (isMicRunning && !Thread.currentThread().isInterrupted) {
                    try {
                        val client = micServerSocket?.accept() ?: break
                        Thread({ handleMicClient(client) }, "MicClient-${client.inetAddress}").start()
                    } catch (e: Exception) {
                        if (isMicRunning) Log.e(TAG, "Erro accept mic: ${e.message}")
                    }
                }
            }, "MicServerThread").apply { start() }

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
        Log.i(TAG, "Mic server finalizado.")
    }

    @SuppressLint("MissingPermission")
    private fun handleMicClient(socket: Socket) {
        var audioRecord: AudioRecord? = null
        try {
            val minBufSize = AudioRecord.getMinBufferSize(SAMPLE_RATE, CHANNEL_IN, ENCODING)
            val bufferSize = maxOf(minBufSize * 2, 8192)

            audioRecord = AudioRecord(
                MediaRecorder.AudioSource.MIC,
                SAMPLE_RATE,
                CHANNEL_IN,
                ENCODING,
                bufferSize
            )

            if (audioRecord.state != AudioRecord.STATE_INITIALIZED) {
                Log.e(TAG, "AudioRecord não pôde ser inicializado.")
                return
            }

            audioRecord.startRecording()

            val out = socket.getOutputStream()
            val header = "HTTP/1.1 200 OK\r\n" +
                    "Content-Type: audio/wav\r\n" +
                    "Server: AdbSentinelAudio\r\n" +
                    "Connection: close\r\n" +
                    "Cache-Control: no-cache\r\n\r\n"
            out.write(header.toByteArray(Charsets.UTF_8))

            val wavHeader = createWavHeader(SAMPLE_RATE, 2, 16)
            out.write(wavHeader)
            out.flush()

            val pcmBuffer = ByteArray(bufferSize)
            while (isMicRunning && socket.isConnected && !socket.isClosed) {
                val read = audioRecord.read(pcmBuffer, 0, pcmBuffer.size)
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
            try {
                if (audioRecord?.recordingState == AudioRecord.RECORDSTATE_RECORDING) {
                    audioRecord.stop()
                }
                audioRecord?.release()
            } catch (ignored: Exception) {}
            try { socket.close() } catch (ignored: Exception) {}
        }
    }

    private fun createWavHeader(sampleRate: Int, channels: Int, bitDepth: Int): ByteArray {
        val totalAudioLen = 0x7ffffff0
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
    // 2. CAIXA DE SOM (Mac -> Android na porta 8082)
    // -------------------------------------------------------------
    @Synchronized
    fun startSpeakerServer(context: Context): Boolean {
        if (isSpeakerRunning) return true
        try {
            speakerServerSocket = ServerSocket(SPEAKER_PORT).apply { reuseAddress = true }
            isSpeakerRunning = true

            speakerServerThread = Thread({
                Log.i(TAG, "Speaker server ouvindo na porta $SPEAKER_PORT...")
                while (isSpeakerRunning && !Thread.currentThread().isInterrupted) {
                    try {
                        val client = speakerServerSocket?.accept() ?: break
                        Thread({ handleSpeakerClient(client) }, "SpeakerClient-${client.inetAddress}").start()
                    } catch (e: Exception) {
                        if (isSpeakerRunning) Log.e(TAG, "Erro accept speaker: ${e.message}")
                    }
                }
            }, "SpeakerServerThread").apply { start() }

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
        try { speakerServerSocket?.close() } catch (ignored: Exception) {}
        speakerServerSocket = null

        speakerServerThread?.interrupt()
        speakerServerThread = null
        Log.i(TAG, "Speaker server finalizado.")
    }

    private fun handleSpeakerClient(socket: Socket) {
        var audioTrack: AudioTrack? = null
        try {
            val minBufSize = AudioTrack.getMinBufferSize(SAMPLE_RATE, CHANNEL_OUT, ENCODING)
            val bufferSize = maxOf(minBufSize * 2, 8192)

            val audioAttributes = AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_MEDIA)
                .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                .build()

            val audioFormat = AudioFormat.Builder()
                .setSampleRate(SAMPLE_RATE)
                .setChannelMask(CHANNEL_OUT)
                .setEncoding(ENCODING)
                .build()

            audioTrack = AudioTrack.Builder()
                .setAudioAttributes(audioAttributes)
                .setAudioFormat(audioFormat)
                .setBufferSizeInBytes(bufferSize)
                .setTransferMode(AudioTrack.MODE_STREAM)
                .build()

            val input = socket.getInputStream()
            val buffer = ByteArray(bufferSize)

            val out = socket.getOutputStream()
            val firstByte = input.read()
            if (firstByte == -1) return

            buffer[0] = firstByte.toByte()
            val initialRead = input.read(buffer, 1, minOf(buffer.size - 1, 512))
            val totalInitial = if (initialRead > 0) initialRead + 1 else 1
            val preview = String(buffer, 0, totalInitial)

            var offset = 0
            if (preview.startsWith("GET") || preview.startsWith("POST") || preview.startsWith("PUT")) {
                if (preview.contains("/test") || preview.contains("/beep")) {
                    playTestTone()
                    val resp = "HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\nConnection: close\r\n\r\nBeep Played\n"
                    out.write(resp.toByteArray(Charsets.UTF_8))
                    out.flush()
                    return
                }
                if (preview.startsWith("GET")) {
                    val resp = "HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\nContent-Length: 15\r\nConnection: close\r\n\r\nSpeaker Online\n"
                    out.write(resp.toByteArray(Charsets.UTF_8))
                    out.flush()
                    return
                }
                val headerEnd = preview.indexOf("\r\n\r\n")
                if (headerEnd != -1) {
                    offset = headerEnd + 4
                }
            }

            audioTrack.play()

            if (offset < totalInitial) {
                audioTrack.write(buffer, offset, totalInitial - offset)
            }

            var bytesRead: Int
            while (isSpeakerRunning && socket.isConnected && !socket.isClosed) {
                bytesRead = input.read(buffer, 0, buffer.size)
                if (bytesRead <= 0) break
                audioTrack.write(buffer, 0, bytesRead)
            }
        } catch (e: Exception) {
            Log.v(TAG, "Cliente de alto-falante desconectado: ${e.message}")
        } finally {
            try {
                if (audioTrack?.playState == AudioTrack.PLAYSTATE_PLAYING) {
                    audioTrack.pause()
                    audioTrack.flush()
                }
                audioTrack?.release()
            } catch (ignored: Exception) {}
            try { socket.close() } catch (ignored: Exception) {}
        }
    }

    fun playTestTone() {
        Thread {
            try {
                val sampleRate = 48000
                val durationMs = 350
                val numSamples = (sampleRate * durationMs) / 1000
                val samples = ShortArray(numSamples)
                val freq = 880.0 // A5 pleasant chime
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
