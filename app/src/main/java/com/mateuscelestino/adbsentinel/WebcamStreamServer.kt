package com.mateuscelestino.adbsentinel

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.ImageFormat
import android.hardware.camera2.*
import android.media.ImageReader
import android.net.Uri
import android.os.Build
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

    @Volatile
    var currentZoom = 1.0f

    @Volatile
    var isTorchOn = false

    @Volatile
    var currentEv = 0

    private var appContext: Context? = null
    private var serverSocket: ServerSocket? = null
    private var serverThread: Thread? = null

    private var cameraManager: CameraManager? = null
    private var cameraDevice: CameraDevice? = null
    private var cameraCaptureSession: CameraCaptureSession? = null
    private var captureRequestBuilder: CaptureRequest.Builder? = null
    private var cameraCharacteristics: CameraCharacteristics? = null
    private var selectedCameraId: String? = null
    private var imageReader: ImageReader? = null
    private var cameraThread: HandlerThread? = null
    private var cameraHandler: Handler? = null

    @Volatile
    private var latestJpeg: ByteArray? = null

    private val activeClients = java.util.concurrent.CopyOnWriteArrayList<Socket>()

    private fun getFallbackOrCurrentFrame(): ByteArray {
        val existing = latestJpeg
        if (existing != null) return existing
        return createStatusFrame("Samsung Galaxy S22 Ultra • Conectando Câmera...")
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
        appContext = context.applicationContext
        if (isRunning) {
            if (!facing.equals(currentFacing, ignoreCase = true)) {
                switchFacing(facing)
            }
            return true
        }
        currentFacing = facing.uppercase()
        try {
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

            try {
                cameraManager = context.getSystemService(Context.CAMERA_SERVICE) as CameraManager
                startBackgroundThread()
                openCamera(currentFacing)
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

        var foundId: String? = null
        for (id in manager.cameraIdList) {
            val chars = manager.getCameraCharacteristics(id)
            if (chars.get(CameraCharacteristics.LENS_FACING) == targetFacing) {
                foundId = id
                cameraCharacteristics = chars
                break
            }
        }
        if (foundId == null && manager.cameraIdList.isNotEmpty()) {
            foundId = manager.cameraIdList[0]
            cameraCharacteristics = manager.getCameraCharacteristics(foundId)
        }

        selectedCameraId = foundId
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

        manager.openCamera(selectedCameraId!!, object : CameraDevice.StateCallback() {
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
            val builder = device.createCaptureRequest(CameraDevice.TEMPLATE_PREVIEW).apply {
                addTarget(readerSurface)
                set(CaptureRequest.CONTROL_AF_MODE, CaptureRequest.CONTROL_AF_MODE_CONTINUOUS_PICTURE)
                set(CaptureRequest.CONTROL_AE_MODE, CaptureRequest.CONTROL_AE_MODE_ON)

                applyZoom(this, currentZoom)

                if (isTorchOn) {
                    set(CaptureRequest.FLASH_MODE, CaptureRequest.FLASH_MODE_TORCH)
                }

                if (currentEv != 0) {
                    set(CaptureRequest.CONTROL_AE_EXPOSURE_COMPENSATION, currentEv)
                }
            }
            captureRequestBuilder = builder

            device.createCaptureSession(listOf(readerSurface), object : CameraCaptureSession.StateCallback() {
                override fun onConfigured(session: CameraCaptureSession) {
                    if (cameraDevice == null) return
                    cameraCaptureSession = session
                    try {
                        session.setRepeatingRequest(builder.build(), null, cameraHandler)
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

    private fun applyZoom(builder: CaptureRequest.Builder, zoomRatio: Float) {
        val chars = cameraCharacteristics
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R && chars != null) {
            val range = chars.get(CameraCharacteristics.CONTROL_ZOOM_RATIO_RANGE)
            val min = range?.lower ?: 0.6f
            val max = range?.upper ?: 10.0f
            val clamped = zoomRatio.coerceIn(min, max)
            builder.set(CaptureRequest.CONTROL_ZOOM_RATIO, clamped)
        }
    }

    private fun updateRepeatingRequest() {
        val builder = captureRequestBuilder ?: return
        val session = cameraCaptureSession ?: return
        val handler = cameraHandler ?: return
        try {
            session.setRepeatingRequest(builder.build(), null, handler)
        } catch (e: Exception) {
            Log.e(TAG, "Erro ao atualizar controle de câmera: ${e.message}")
        }
    }

    // =========================================================================
    // 🎛️ CONTROLES TRADICIONAIS DA CÂMERA
    // =========================================================================

    fun setZoom(ratio: Float): Float {
        val chars = cameraCharacteristics
        val min = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R && chars != null) {
            chars.get(CameraCharacteristics.CONTROL_ZOOM_RATIO_RANGE)?.lower ?: 0.6f
        } else 0.6f
        val max = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R && chars != null) {
            chars.get(CameraCharacteristics.CONTROL_ZOOM_RATIO_RANGE)?.upper ?: 10.0f
        } else 10.0f

        val clamped = ratio.coerceIn(min, max)
        currentZoom = clamped
        captureRequestBuilder?.let { builder ->
            applyZoom(builder, clamped)
            updateRepeatingRequest()
        }
        return clamped
    }

    fun setTorch(enable: Boolean): Boolean {
        isTorchOn = enable
        captureRequestBuilder?.let { builder ->
            builder.set(
                CaptureRequest.FLASH_MODE,
                if (enable) CaptureRequest.FLASH_MODE_TORCH else CaptureRequest.FLASH_MODE_OFF
            )
            updateRepeatingRequest()
        }
        return isTorchOn
    }

    fun setExposure(ev: Int): Int {
        currentEv = ev.coerceIn(-4, 4)
        captureRequestBuilder?.let { builder ->
            builder.set(CaptureRequest.CONTROL_AE_EXPOSURE_COMPENSATION, currentEv)
            updateRepeatingRequest()
        }
        return currentEv
    }

    fun switchFacing(targetFacing: String) {
        val facingUpper = targetFacing.uppercase()
        if (facingUpper == currentFacing && cameraDevice != null) return
        currentFacing = facingUpper
        currentZoom = 1.0f
        isTorchOn = false
        currentEv = 0

        cameraHandler?.post {
            closeCamera()
            openCamera(currentFacing)
        }
    }

    fun triggerAutofocus() {
        val builder = captureRequestBuilder ?: return
        val session = cameraCaptureSession ?: return
        val handler = cameraHandler ?: return
        try {
            builder.set(CaptureRequest.CONTROL_AF_TRIGGER, CameraMetadata.CONTROL_AF_TRIGGER_START)
            session.capture(builder.build(), null, handler)
            builder.set(CaptureRequest.CONTROL_AF_TRIGGER, CameraMetadata.CONTROL_AF_TRIGGER_IDLE)
            session.setRepeatingRequest(builder.build(), null, handler)
        } catch (e: Exception) {
            Log.e(TAG, "Erro triggerAutofocus: ${e.message}")
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
        captureRequestBuilder = null
    }

    // =========================================================================
    // 🌐 HTTP CLIENT & REST CONTROL API
    // =========================================================================

    private fun handleClient(socket: Socket) {
        try {
            val input = socket.getInputStream()
            val reader = input.bufferedReader()
            val requestLine = reader.readLine() ?: return
            val out = socket.getOutputStream()

            if (requestLine.contains("/api/control")) {
                handleControlApi(requestLine, out)
            } else if (requestLine.contains("/api/status")) {
                handleStatusApi(out)
            } else if (requestLine.contains("/video")) {
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

    private fun handleControlApi(requestLine: String, out: OutputStream) {
        try {
            val parts = requestLine.split(" ")
            val uriStr = if (parts.size > 1) parts[1] else ""
            val uri = Uri.parse("http://localhost$uriStr")

            uri.getQueryParameter("zoom")?.toFloatOrNull()?.let {
                setZoom(it)
            }
            uri.getQueryParameter("torch")?.let {
                val on = it == "1" || it.equals("true", ignoreCase = true)
                setTorch(on)
            }
            uri.getQueryParameter("facing")?.let {
                switchFacing(it)
            }
            uri.getQueryParameter("ev")?.toIntOrNull()?.let {
                setExposure(it)
            }
            if (uri.getQueryParameter("af") != null) {
                triggerAutofocus()
            }

            val json = """{"ok":true,"zoom":$currentZoom,"torch":$isTorchOn,"facing":"$currentFacing","ev":$currentEv}"""
            val bytes = json.toByteArray(Charsets.UTF_8)
            val response = "HTTP/1.1 200 OK\r\n" +
                    "Content-Type: application/json; charset=utf-8\r\n" +
                    "Content-Length: ${bytes.size}\r\n" +
                    "Access-Control-Allow-Origin: *\r\n" +
                    "Connection: close\r\n\r\n"
            out.write(response.toByteArray(Charsets.UTF_8))
            out.write(bytes)
            out.flush()
        } catch (e: Exception) {
            val err = "HTTP/1.1 500 Internal Error\r\nConnection: close\r\n\r\n"
            out.write(err.toByteArray(Charsets.UTF_8))
            out.flush()
        }
    }

    private fun handleStatusApi(out: OutputStream) {
        val json = """{"ok":true,"zoom":$currentZoom,"torch":$isTorchOn,"facing":"$currentFacing","ev":$currentEv,"model":"SM-S908E"}"""
        val bytes = json.toByteArray(Charsets.UTF_8)
        val response = "HTTP/1.1 200 OK\r\n" +
                "Content-Type: application/json; charset=utf-8\r\n" +
                "Content-Length: ${bytes.size}\r\n" +
                "Access-Control-Allow-Origin: *\r\n" +
                "Connection: close\r\n\r\n"
        out.write(response.toByteArray(Charsets.UTF_8))
        out.write(bytes)
        out.flush()
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
                    "Content-Disposition: inline; filename=\"galaxy_s22_ultra_photo.jpg\"\r\n" +
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

    // =========================================================================
    // 🎨 PAINEL PROFISSIONAL DE CONTROLE DE CÂMERA TRADICIONAL
    // =========================================================================

    private fun serveWebPage(out: OutputStream) {
        val html = """
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Galaxy S22 Ultra • Câmera Studio Continuity</title>
    <style>
        :root {
            --bg-deep: #080a0f;
            --panel-bg: rgba(18, 22, 33, 0.75);
            --border-glass: rgba(255, 255, 255, 0.12);
            --accent-cyan: #38bdf8;
            --accent-yellow: #facc15;
            --accent-emerald: #10b981;
            --accent-red: #ef4444;
            --text-main: #f8fafc;
            --text-dim: #94a3b8;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; user-select: none; }
        body {
            background-color: var(--bg-deep);
            color: var(--text-main);
            font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif;
            height: 100vh;
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }

        /* Top Header */
        header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 12px 24px;
            background: rgba(10, 14, 23, 0.85);
            backdrop-filter: blur(20px);
            border-bottom: 1px solid var(--border-glass);
            z-index: 10;
        }
        .brand {
            display: flex;
            align-items: center;
            gap: 10px;
            font-weight: 700;
            font-size: 14px;
            letter-spacing: 0.5px;
        }
        .brand .dot {
            width: 9px;
            height: 9px;
            background: var(--accent-emerald);
            border-radius: 50%;
            box-shadow: 0 0 10px var(--accent-emerald);
            animation: pulse 2s infinite;
        }
        @keyframes pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.4; transform: scale(0.85); } }

        /* Top Quick Actions (Flash, EV, Mirror, Grid) */
        .top-tools {
            display: flex;
            align-items: center;
            gap: 12px;
        }
        .tool-btn {
            background: rgba(255, 255, 255, 0.08);
            border: 1px solid var(--border-glass);
            color: var(--text-main);
            padding: 6px 14px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 6px;
            transition: all 0.2s;
        }
        .tool-btn:hover { background: rgba(255, 255, 255, 0.16); }
        .tool-btn.active {
            background: var(--accent-yellow);
            color: #000;
            border-color: var(--accent-yellow);
            box-shadow: 0 0 14px rgba(250, 204, 21, 0.4);
        }

        /* Viewfinder Area */
        main {
            flex: 1;
            position: relative;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 16px;
            background: radial-gradient(circle at center, #111827 0%, #030712 100%);
        }
        .viewfinder-container {
            position: relative;
            max-width: 96vw;
            max-height: 72vh;
            border-radius: 20px;
            overflow: hidden;
            box-shadow: 0 25px 60px rgba(0,0,0,0.9);
            border: 1px solid var(--border-glass);
            background: #000;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        #streamImg {
            width: 100%;
            height: 100%;
            object-fit: contain;
            display: block;
            transition: transform 0.2s ease-out;
        }
        #streamImg.mirrored { transform: scaleX(-1); }

        /* Rule of Thirds Grid */
        .grid-overlay {
            position: absolute;
            inset: 0;
            display: grid;
            grid-template-columns: 1fr 1fr 1fr;
            grid-template-rows: 1fr 1fr 1fr;
            pointer-events: none;
            opacity: 0;
            transition: opacity 0.2s;
        }
        .grid-overlay.visible { opacity: 0.35; }
        .grid-overlay div { border: 1px solid rgba(255, 255, 255, 0.7); }

        /* Floating Lens Selector / Zoom Pills */
        .lens-dial-container {
            position: absolute;
            bottom: 24px;
            left: 50%;
            transform: translateX(-50%);
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 12px;
            z-index: 5;
        }
        .lens-pills {
            display: flex;
            background: rgba(10, 14, 23, 0.75);
            backdrop-filter: blur(25px);
            padding: 5px;
            border-radius: 40px;
            border: 1px solid var(--border-glass);
            box-shadow: 0 10px 30px rgba(0,0,0,0.7);
            gap: 6px;
        }
        .lens-btn {
            background: transparent;
            border: none;
            color: var(--text-dim);
            width: 44px;
            height: 44px;
            border-radius: 50%;
            font-size: 13px;
            font-weight: 700;
            cursor: pointer;
            transition: all 0.2s;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .lens-btn:hover { color: #fff; background: rgba(255, 255, 255, 0.1); }
        .lens-btn.active {
            background: var(--accent-yellow);
            color: #000;
            font-weight: 800;
            transform: scale(1.08);
            box-shadow: 0 0 12px rgba(250, 204, 21, 0.5);
        }

        /* Smooth Zoom Slider */
        .zoom-slider-box {
            display: flex;
            align-items: center;
            gap: 10px;
            background: rgba(10, 14, 23, 0.65);
            backdrop-filter: blur(15px);
            padding: 6px 16px;
            border-radius: 30px;
            border: 1px solid var(--border-glass);
        }
        .zoom-slider-box input[type="range"] {
            -webkit-appearance: none;
            width: 180px;
            height: 4px;
            border-radius: 2px;
            background: rgba(255, 255, 255, 0.25);
            outline: none;
        }
        .zoom-slider-box input[type="range"]::-webkit-slider-thumb {
            -webkit-appearance: none;
            width: 16px;
            height: 16px;
            border-radius: 50%;
            background: var(--accent-yellow);
            cursor: pointer;
            box-shadow: 0 0 8px rgba(250, 204, 21, 0.6);
        }
        .zoom-val {
            font-size: 12px;
            font-weight: 700;
            color: var(--accent-yellow);
            min-width: 38px;
            text-align: right;
        }

        /* Bottom Control Bar */
        footer {
            height: 84px;
            background: rgba(10, 14, 23, 0.95);
            backdrop-filter: blur(25px);
            border-top: 1px solid var(--border-glass);
            display: flex;
            align-items: center;
            justify-content: space-around;
            padding: 0 32px;
            z-index: 10;
        }
        .footer-action {
            width: 48px;
            height: 48px;
            border-radius: 50%;
            background: rgba(255, 255, 255, 0.08);
            border: 1px solid var(--border-glass);
            color: #fff;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            font-size: 18px;
            transition: all 0.2s;
        }
        .footer-action:hover { background: rgba(255, 255, 255, 0.2); }

        /* Shutter Button (Traditional Camera Style) */
        .shutter-btn {
            width: 68px;
            height: 68px;
            border-radius: 50%;
            background: transparent;
            border: 4px solid #fff;
            padding: 4px;
            cursor: pointer;
            transition: all 0.15s;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .shutter-inner {
            width: 100%;
            height: 100%;
            border-radius: 50%;
            background: #fff;
            transition: all 0.1s;
        }
        .shutter-btn:active .shutter-inner {
            transform: scale(0.85);
            background: var(--accent-red);
        }

        /* Flash Screen Animation */
        #flashOverlay {
            position: fixed;
            inset: 0;
            background: #fff;
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.15s ease-out;
            z-index: 999;
        }
    </style>
</head>
<body>
    <div id="flashOverlay"></div>

    <header>
        <div class="brand">
            <div class="dot"></div>
            <span>SAMSUNG GALAXY S22 ULTRA</span>
            <span style="color: var(--text-dim); font-size: 12px; font-weight: normal;">• Câmera Studio HD</span>
        </div>

        <div class="top-tools">
            <button class="tool-btn" id="torchBtn" onclick="toggleTorch()">
                ⚡ Lanterna
            </button>
            <button class="tool-btn" id="gridBtn" onclick="toggleGrid()">
                📐 Grade
            </button>
            <button class="tool-btn" id="mirrorBtn" onclick="toggleMirror()">
                🪞 Espelhar
            </button>
            <button class="tool-btn" onclick="triggerAF()">
                🎯 Focar
            </button>
        </div>
    </header>

    <main>
        <div class="viewfinder-container">
            <img id="streamImg" src="/video" alt="Feed da Câmera">
            <div class="grid-overlay" id="gridOverlay">
                <div></div><div></div><div></div>
                <div></div><div></div><div></div>
                <div></div><div></div><div></div>
            </div>
        </div>

        <div class="lens-dial-container">
            <div class="lens-pills">
                <button class="lens-btn" onclick="setPreset(0.6)">.6</button>
                <button class="lens-btn active" id="btn1x" onclick="setPreset(1.0)">1x</button>
                <button class="lens-btn" onclick="setPreset(2.0)">2x</button>
                <button class="lens-btn" onclick="setPreset(3.0)">3x</button>
                <button class="lens-btn" onclick="setPreset(10.0)">10x</button>
                <button class="lens-btn" id="btnFront" onclick="toggleFacing()" style="width: auto; padding: 0 14px; border-radius: 20px;">🤳 Selfie</button>
            </div>

            <div class="zoom-slider-box">
                <span style="font-size: 11px; color: var(--text-dim);">.6x</span>
                <input type="range" id="zoomSlider" min="0.6" max="10.0" step="0.1" value="1.0" oninput="onSliderZoom(this.value)">
                <span class="zoom-val" id="zoomVal">1.0x</span>
            </div>
        </div>
    </main>

    <footer>
        <button class="footer-action" onclick="toggleFacing()" title="Alternar Lente Traseira / Frontal">⟲</button>
        <button class="shutter-btn" onclick="takeSnapshot()" title="Tirar Foto em Alta Resolução">
            <div class="shutter-inner"></div>
        </button>
        <button class="footer-action" onclick="toggleFullScreen()" title="Tela Cheia">⛶</button>
    </footer>

    <script>
        let currentZoom = 1.0;
        let isTorch = false;
        let isFront = false;
        let isMirrored = false;
        let isGrid = false;

        async function sendControl(params) {
            try {
                const res = await fetch('/api/control?' + new URLSearchParams(params));
                const data = await res.json();
                return data;
            } catch (e) {
                console.error("Falha controle:", e);
            }
        }

        function setPreset(zoom) {
            currentZoom = zoom;
            document.getElementById('zoomSlider').value = zoom;
            document.getElementById('zoomVal').innerText = zoom.toFixed(1) + 'x';
            updateLensPillUI(zoom);
            sendControl({ zoom: zoom });
        }

        function onSliderZoom(val) {
            const z = parseFloat(val);
            currentZoom = z;
            document.getElementById('zoomVal').innerText = z.toFixed(1) + 'x';
            updateLensPillUI(z);
            sendControl({ zoom: z });
        }

        function updateLensPillUI(z) {
            document.querySelectorAll('.lens-btn').forEach(b => {
                if (!b.id) {
                    const text = b.innerText;
                    if (text === '.6' && Math.abs(z - 0.6) < 0.15) b.classList.add('active');
                    else if (text === '1x' && Math.abs(z - 1.0) < 0.2) b.classList.add('active');
                    else if (text === '2x' && Math.abs(z - 2.0) < 0.2) b.classList.add('active');
                    else if (text === '3x' && Math.abs(z - 3.0) < 0.2) b.classList.add('active');
                    else if (text === '10x' && Math.abs(z - 10.0) < 0.3) b.classList.add('active');
                    else b.classList.remove('active');
                }
            });
        }

        async function toggleTorch() {
            isTorch = !isTorch;
            const btn = document.getElementById('torchBtn');
            if (isTorch) btn.classList.add('active'); else btn.classList.remove('active');
            await sendControl({ torch: isTorch ? '1' : '0' });
        }

        function toggleGrid() {
            isGrid = !isGrid;
            const grid = document.getElementById('gridOverlay');
            const btn = document.getElementById('gridBtn');
            if (isGrid) { grid.classList.add('visible'); btn.classList.add('active'); }
            else { grid.classList.remove('visible'); btn.classList.remove('active'); }
        }

        function toggleMirror() {
            isMirrored = !isMirrored;
            const img = document.getElementById('streamImg');
            const btn = document.getElementById('mirrorBtn');
            if (isMirrored) { img.classList.add('mirrored'); btn.classList.add('active'); }
            else { img.classList.remove('mirrored'); btn.classList.remove('active'); }
        }

        async function toggleFacing() {
            isFront = !isFront;
            const btnFront = document.getElementById('btnFront');
            if (isFront) {
                btnFront.classList.add('active');
                isMirrored = true;
                document.getElementById('streamImg').classList.add('mirrored');
                document.getElementById('mirrorBtn').classList.add('active');
                await sendControl({ facing: 'FRONT' });
            } else {
                btnFront.classList.remove('active');
                isMirrored = false;
                document.getElementById('streamImg').classList.remove('mirrored');
                document.getElementById('mirrorBtn').classList.remove('active');
                await sendControl({ facing: 'BACK' });
            }
        }

        async function triggerAF() {
            await sendControl({ af: '1' });
        }

        function takeSnapshot() {
            const flash = document.getElementById('flashOverlay');
            flash.style.opacity = '0.9';
            setTimeout(() => { flash.style.opacity = '0'; }, 100);

            const a = document.createElement('a');
            a.href = '/snapshot?t=' + Date.now();
            a.download = 'GalaxyS22Ultra_Foto_' + Date.now() + '.jpg';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        }

        function toggleFullScreen() {
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen();
            } else {
                if (document.exitFullscreen) document.exitFullscreen();
            }
        }

        window.addEventListener('keydown', (e) => {
            if (e.code === 'Space') { e.preventDefault(); takeSnapshot(); }
            if (e.key === 't' || e.key === 'T') toggleTorch();
            if (e.key === 'm' || e.key === 'M') toggleMirror();
            if (e.key === 'g' || e.key === 'G') toggleGrid();
            if (e.key === 'f' || e.key === 'F') toggleFacing();
            if (e.key === '1') setPreset(1.0);
            if (e.key === '2') setPreset(2.0);
            if (e.key === '3') setPreset(3.0);
            if (e.key === '0') setPreset(0.6);
        });
    </script>
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
