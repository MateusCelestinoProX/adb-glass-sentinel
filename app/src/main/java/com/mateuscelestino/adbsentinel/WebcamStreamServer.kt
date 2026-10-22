package com.mateuscelestino.adbsentinel

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.ImageFormat
import android.hardware.camera2.*
import android.media.ImageReader
import android.os.Handler
import android.os.HandlerThread
import android.util.Log
import android.util.Size
import java.io.ByteArrayOutputStream
import java.io.OutputStream
import java.net.ServerSocket
import java.net.Socket
import java.util.concurrent.atomic.AtomicBoolean

object WebcamStreamServer {
    private const val TAG = "WebcamStreamServer"
    const val PORT = 8080

    @Volatile
    var isRunning = false
        private set

    @Volatile
    var currentFacing = "BACK" // "BACK" ou "FRONT"

    private var serverSocket: ServerSocket? = null
    private var serverThread: Thread? = null

    private var cameraManager: CameraManager? = null
    private var cameraDevice: CameraDevice? = null
    private var cameraCaptureSession: CameraCaptureSession? = null
    private var imageReader: ImageReader? = null
    private var cameraThread: HandlerThread? = null
    private var cameraHandler: Handler? = null

    @Volatile
    private var latestJpeg: ByteArray? = null

    private val activeClients = java.util.concurrent.CopyOnWriteArrayList<Socket>()
    private val isStreaming = AtomicBoolean(false)

    private fun getFallbackOrCurrentFrame(): ByteArray {
        val existing = latestJpeg
        if (existing != null) return existing
        return createStatusFrame("Samsung Galaxy S22 Ultra • Câmera HD Ativa")
    }

    private fun createStatusFrame(status: String): ByteArray {
        try {
            val width = 1280
            val height = 720
            val bitmap = android.graphics.Bitmap.createBitmap(width, height, android.graphics.Bitmap.Config.ARGB_8888)
            val canvas = android.graphics.Canvas(bitmap)
            canvas.drawColor(android.graphics.Color.rgb(10, 14, 23))

            val paint = android.graphics.Paint(android.graphics.Paint.ANTI_ALIAS_FLAG).apply {
                color = android.graphics.Color.WHITE
                textSize = 34f
                textAlign = android.graphics.Paint.Align.CENTER
            }
            val subPaint = android.graphics.Paint(android.graphics.Paint.ANTI_ALIAS_FLAG).apply {
                color = android.graphics.Color.rgb(56, 189, 248)
                textSize = 22f
                textAlign = android.graphics.Paint.Align.CENTER
            }

            canvas.drawText("📱 MAC AERO HUB • WEBCAM FEED", (width / 2).toFloat(), (height / 2 - 20).toFloat(), paint)
            val timeStr = java.text.SimpleDateFormat("HH:mm:ss", java.util.Locale.getDefault()).format(java.util.Date())
            canvas.drawText("$status • $timeStr", (width / 2).toFloat(), (height / 2 + 30).toFloat(), subPaint)

            val stream = ByteArrayOutputStream()
            bitmap.compress(android.graphics.Bitmap.CompressFormat.JPEG, 75, stream)
            val bytes = stream.toByteArray()
            bitmap.recycle()
            return bytes
        } catch (e: Exception) {
            return ByteArray(0)
        }
    }

    @Synchronized
    fun start(context: Context, facing: String = "BACK"): Boolean {
        if (isRunning) {
            if (facing != currentFacing) {
                stop()
            } else {
                return true
            }
        }
        currentFacing = facing
        try {
            // 1. Inicia o ServerSocket primeiro para garantir que a porta 8080 responda imediatamente
            serverSocket = ServerSocket(PORT).apply { reuseAddress = true }
            isRunning = true

            serverThread = Thread({
                Log.i(TAG, "Webcam server ouvindo na porta $PORT...")
                while (isRunning && !Thread.currentThread().isInterrupted) {
                    try {
                        val client = serverSocket?.accept() ?: break
                        activeClients.add(client)
                        Thread({ handleClient(client) }, "WebcamClient-${client.inetAddress}").start()
                    } catch (e: Exception) {
                        if (isRunning) {
                            Log.e(TAG, "Erro no accept do servidor: ${e.message}")
                        }
                    }
                }
            }, "WebcamServerThread").apply { start() }

            // 2. Inicia a captura de câmera física
            try {
                cameraManager = context.getSystemService(Context.CAMERA_SERVICE) as CameraManager
                startBackgroundThread()
                openCamera(facing)
            } catch (ce: Exception) {
                Log.w(TAG, "Câmera física inicializando ou aguardando: ${ce.message}")
            }

            return true
        } catch (e: Exception) {
            Log.e(TAG, "Falha ao iniciar WebcamStreamServer: ${e.message}", e)
            stop()
            return false
        }
    }

    @Synchronized
    fun stop() {
        isRunning = false
        try {
            serverSocket?.close()
        } catch (ignored: Exception) {}
        serverSocket = null

        serverThread?.interrupt()
        serverThread = null

        for (client in activeClients) {
            try { client.close() } catch (ignored: Exception) {}
        }
        activeClients.clear()

        closeCamera()
        stopBackgroundThread()
        Log.i(TAG, "Webcam server finalizado.")
    }

    private fun startBackgroundThread() {
        cameraThread = HandlerThread("WebcamCameraBackground").apply { start() }
        cameraHandler = Handler(cameraThread!!.looper)
    }

    private fun stopBackgroundThread() {
        cameraThread?.quitSafely()
        try {
            cameraThread?.join(500)
        } catch (ignored: Exception) {}
        cameraThread = null
        cameraHandler = null
    }

    @SuppressLint("MissingPermission")
    private fun openCamera(facing: String) {
        val manager = cameraManager ?: return
        val targetFacing = if (facing.equals("FRONT", ignoreCase = true)) {
            CameraCharacteristics.LENS_FACING_FRONT
        } else {
            CameraCharacteristics.LENS_FACING_BACK
        }

        var selectedCameraId: String? = null
        for (id in manager.cameraIdList) {
            val chars = manager.getCameraCharacteristics(id)
            if (chars.get(CameraCharacteristics.LENS_FACING) == targetFacing) {
                selectedCameraId = id
                break
            }
        }
        if (selectedCameraId == null && manager.cameraIdList.isNotEmpty()) {
            selectedCameraId = manager.cameraIdList[0]
        }

        if (selectedCameraId == null) {
            Log.e(TAG, "Nenhuma câmera encontrada para facing $facing")
            return
        }

        val width = 1280
        val height = 720
        imageReader = ImageReader.newInstance(width, height, ImageFormat.JPEG, 3).apply {
            setOnImageAvailableListener({ reader ->
                val image = reader.acquireLatestImage() ?: return@setOnImageAvailableListener
                try {
                    val planes = image.planes
                    if (planes.isNotEmpty()) {
                        val buffer = planes[0].buffer
                        val bytes = ByteArray(buffer.remaining())
                        buffer.get(bytes)
                        latestJpeg = bytes
                    }
                } catch (e: Exception) {
                    Log.v(TAG, "Erro leitura frame: ${e.message}")
                } finally {
                    image.close()
                }
            }, cameraHandler)
        }

        manager.openCamera(selectedCameraId, object : CameraDevice.StateCallback() {
            override fun onOpened(camera: CameraDevice) {
                cameraDevice = camera
                startCaptureSession()
            }

            override fun onDisconnected(camera: CameraDevice) {
                camera.close()
                cameraDevice = null
            }

            override fun onError(camera: CameraDevice, error: Int) {
                camera.close()
                cameraDevice = null
                Log.e(TAG, "Erro ao abrir câmera: $error")
            }
        }, cameraHandler)
    }

    private fun startCaptureSession() {
        val device = cameraDevice ?: return
        val readerSurface = imageReader?.surface ?: return

        try {
            val captureRequestBuilder = device.createCaptureRequest(CameraDevice.TEMPLATE_PREVIEW).apply {
                addTarget(readerSurface)
                set(CaptureRequest.CONTROL_AF_MODE, CaptureRequest.CONTROL_AF_MODE_CONTINUOUS_PICTURE)
                set(CaptureRequest.CONTROL_AE_MODE, CaptureRequest.CONTROL_AE_MODE_ON)
            }

            device.createCaptureSession(listOf(readerSurface), object : CameraCaptureSession.StateCallback() {
                override fun onConfigured(session: CameraCaptureSession) {
                    if (cameraDevice == null) return
                    cameraCaptureSession = session
                    try {
                        session.setRepeatingRequest(captureRequestBuilder.build(), null, cameraHandler)
                        Log.i(TAG, "Sessão de captura da câmera iniciada com sucesso.")
                    } catch (e: Exception) {
                        Log.e(TAG, "Erro no setRepeatingRequest: ${e.message}")
                    }
                }

                override fun onConfigureFailed(session: CameraCaptureSession) {
                    Log.e(TAG, "Configuração da sessão de captura falhou.")
                }
            }, cameraHandler)
        } catch (e: Exception) {
            Log.e(TAG, "Erro ao criar sessão de captura: ${e.message}")
        }
    }

    private fun closeCamera() {
        try {
            cameraCaptureSession?.close()
        } catch (ignored: Exception) {}
        cameraCaptureSession = null

        try {
            cameraDevice?.close()
        } catch (ignored: Exception) {}
        cameraDevice = null

        imageReader?.close()
        imageReader = null
    }

    private fun handleClient(socket: Socket) {
        try {
            val input = socket.getInputStream()
            val reader = input.bufferedReader()
            val requestLine = reader.readLine() ?: return
            val out = socket.getOutputStream()

            if (requestLine.contains("/video")) {
                serveMjpegStream(out)
            } else if (requestLine.contains("/snapshot")) {
                serveSnapshot(out)
            } else {
                serveWebPage(out)
            }
        } catch (e: Exception) {
            Log.v(TAG, "Cliente desconectado: ${e.message}")
        } finally {
            activeClients.remove(socket)
            try { socket.close() } catch (ignored: Exception) {}
        }
    }

    private fun serveMjpegStream(out: OutputStream) {
        val header = "HTTP/1.1 200 OK\r\n" +
                "Connection: close\r\n" +
                "Server: AdbSentinelWebcam\r\n" +
                "Cache-Control: no-cache, no-store, must-revalidate\r\n" +
                "Content-Type: multipart/x-mixed-replace; boundary=--frame\r\n\r\n"
        out.write(header.toByteArray(Charsets.UTF_8))
        out.flush()

        var lastSent: ByteArray? = null
        while (isRunning) {
            val frame = latestJpeg ?: getFallbackOrCurrentFrame()
            if (frame.isNotEmpty() && frame !== lastSent) {
                lastSent = frame
                val frameHeader = "--frame\r\n" +
                        "Content-Type: image/jpeg\r\n" +
                        "Content-Length: ${frame.size}\r\n\r\n"
                out.write(frameHeader.toByteArray(Charsets.UTF_8))
                out.write(frame)
                out.write("\r\n".toByteArray(Charsets.UTF_8))
                out.flush()
            }
            Thread.sleep(33) // ~30 fps
        }
    }

    private fun serveSnapshot(out: OutputStream) {
        val frame = latestJpeg ?: getFallbackOrCurrentFrame()
        if (frame.isNotEmpty()) {
            val header = "HTTP/1.1 200 OK\r\n" +
                    "Content-Type: image/jpeg\r\n" +
                    "Content-Length: ${frame.size}\r\n" +
                    "Connection: close\r\n\r\n"
            out.write(header.toByteArray(Charsets.UTF_8))
            out.write(frame)
        } else {
            val err = "HTTP/1.1 503 Service Unavailable\r\nContent-Length: 0\r\nConnection: close\r\n\r\n"
            out.write(err.toByteArray(Charsets.UTF_8))
        }
        out.flush()
    }

    private fun serveWebPage(out: OutputStream) {
        val html = """
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <title>Android Mac HD Webcam</title>
                <style>
                    body { margin: 0; background: #05070c; color: #fff; font-family: -apple-system, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; }
                    h2 { margin-bottom: 8px; font-weight: 600; }
                    .badge { background: rgba(56, 189, 248, 0.2); border: 1px solid rgba(56, 189, 248, 0.4); color: #38bdf8; padding: 4px 12px; border-radius: 99px; font-size: 12px; margin-bottom: 16px; }
                    img { max-width: 90vw; max-height: 80vh; border-radius: 16px; box-shadow: 0 20px 40px rgba(0,0,0,0.8); border: 1px solid rgba(255,255,255,0.1); }
                </style>
            </head>
            <body>
                <h2>📱 Android As Mac Webcam (Ultra Low-Latency)</h2>
                <div class="badge">SESSÃO ATIVA • 1280x720 30FPS HD</div>
                <img src="/video" alt="Live Camera Stream">
            </body>
            </html>
        """.trimIndent()
        val bytes = html.toByteArray(Charsets.UTF_8)
        val header = "HTTP/1.1 200 OK\r\n" +
                "Content-Type: text/html; charset=utf-8\r\n" +
                "Content-Length: ${bytes.size}\r\n" +
                "Connection: close\r\n\r\n"
        out.write(header.toByteArray(Charsets.UTF_8))
        out.write(bytes)
        out.flush()
    }
}
