package com.mateuscelestino.adbsentinel

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.Bundle
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView

/**
 * 🚨 SentinelSecurityAlertActivity
 * Diálogo de Alerta Visual Completo exibido quando o Mac solicita acesso a recursos
 * do dispositivo (Câmera, Microfone, Áudio, DeX).
 */
class SentinelSecurityAlertActivity : Activity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val resource = intent.getStringExtra(EXTRA_RESOURCE) ?: "RECURSO DESCONHECIDO"
        val requester = intent.getStringExtra(EXTRA_REQUESTER) ?: "MacAeroHub (MacBook Pro)"

        triggerAlertVibration()

        // Layout de Fundo Translúcido Escuro
        val rootLayout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setBackgroundColor(Color.argb(215, 5, 7, 12)) // Obsidian Cosmos translúcido
            setPadding(48, 48, 48, 48)
            layoutParams = ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
        }

        // Card Central Liquid Glassmorphism
        val cardDrawable = GradientDrawable().apply {
            shape = GradientDrawable.RECTANGLE
            cornerRadius = 48f
            setColor(Color.argb(240, 10, 14, 23))
            setStroke(3, Color.argb(180, 0, 240, 255)) // Borda ciano neon
        }

        val cardLayout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            background = cardDrawable
            setPadding(56, 56, 56, 56)
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            )
        }

        // Header: Ícone & Título
        val titleText = TextView(this).apply {
            text = "🚨 ALERTA DE SEGURANÇA"
            textSize = 20f
            setTextColor(Color.rgb(255, 16, 55)) // Vermelho neon
            typeface = android.graphics.Typeface.DEFAULT_BOLD
            gravity = Gravity.CENTER
        }

        val subtitleText = TextView(this).apply {
            text = "SOLICITAÇÃO DE ACESSO REMOTO"
            textSize = 12f
            setTextColor(Color.rgb(0, 240, 255)) // Ciano neon
            typeface = android.graphics.Typeface.MONOSPACE
            gravity = Gravity.CENTER
            setPadding(0, 8, 0, 24)
        }

        // Informações da Solicitação
        val originLabel = TextView(this).apply {
            text = "ORIGEM DA SOLICITAÇÃO:"
            textSize = 11f
            setTextColor(Color.argb(160, 255, 255, 255))
            typeface = android.graphics.Typeface.MONOSPACE
        }

        val originValue = TextView(this).apply {
            text = requester
            textSize = 14f
            setTextColor(Color.WHITE)
            typeface = android.graphics.Typeface.DEFAULT_BOLD
            setPadding(0, 2, 0, 16)
        }

        val resourceLabel = TextView(this).apply {
            text = "RECURSO SOLICITADO:"
            textSize = 11f
            setTextColor(Color.argb(160, 255, 255, 255))
            typeface = android.graphics.Typeface.MONOSPACE
        }

        val resourceValue = TextView(this).apply {
            text = formatResourceName(resource)
            textSize = 17f
            setTextColor(Color.rgb(0, 255, 102)) // Verde esmeralda neon
            typeface = android.graphics.Typeface.DEFAULT_BOLD
            setPadding(0, 4, 0, 20)
        }

        val policyNotice = TextView(this).apply {
            text = "Por política de segurança e economia de bateria/rede, todos os recursos ficam OFF por padrão. Deseja conceder autorização agora?"
            textSize = 12f
            setTextColor(Color.argb(200, 255, 255, 255))
            setPadding(0, 0, 0, 32)
        }

        // Botões de Ação
        val buttonsLayout = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER
            weightSum = 2f
        }

        // Botão Negar Acesso
        val btnDenyDrawable = GradientDrawable().apply {
            shape = GradientDrawable.RECTANGLE
            cornerRadius = 24f
            setColor(Color.argb(60, 255, 16, 55))
            setStroke(2, Color.rgb(255, 16, 55))
        }

        val btnDeny = Button(this).apply {
            text = "NEGAR"
            textSize = 13f
            setTextColor(Color.WHITE)
            typeface = android.graphics.Typeface.DEFAULT_BOLD
            background = btnDenyDrawable
            layoutParams = LinearLayout.LayoutParams(0, 130, 1f).apply {
                marginEnd = 16
            }
            setOnClickListener {
                denyAccess(resource)
            }
        }

        // Botão Autorizar
        val btnAllowDrawable = GradientDrawable().apply {
            shape = GradientDrawable.RECTANGLE
            cornerRadius = 24f
            setColor(Color.rgb(0, 255, 102))
        }

        val btnAllow = Button(this).apply {
            text = "AUTORIZAR"
            textSize = 13f
            setTextColor(Color.rgb(5, 7, 12)) // Texto escuro
            typeface = android.graphics.Typeface.DEFAULT_BOLD
            background = btnAllowDrawable
            layoutParams = LinearLayout.LayoutParams(0, 130, 1f).apply {
                marginStart = 16
            }
            setOnClickListener {
                grantAccess(resource)
            }
        }

        buttonsLayout.addView(btnDeny)
        buttonsLayout.addView(btnAllow)

        cardLayout.addView(titleText)
        cardLayout.addView(subtitleText)
        cardLayout.addView(originLabel)
        cardLayout.addView(originValue)
        cardLayout.addView(resourceLabel)
        cardLayout.addView(resourceValue)
        cardLayout.addView(policyNotice)
        cardLayout.addView(buttonsLayout)

        rootLayout.addView(cardLayout)
        setContentView(rootLayout)
    }

    private fun formatResourceName(resource: String): String {
        return when (resource.uppercase()) {
            "CAMERA", "WEBCAM" -> "📷 Câmera Traseira HD (Porta 8080)"
            "MIC", "MICROPHONE" -> "🎙️ Microfone de Estúdio PCM (Porta 8081)"
            "SPEAKER", "AUDIO" -> "🔊 Alto-falante do Celular (Porta 8082)"
            "DEX", "DESKTOP" -> "🖥️ Samsung DeX / Controle Remoto (Porta 8083)"
            else -> resource
        }
    }

    private fun grantAccess(resource: String) {
        val intent = Intent(this, AdbSentinelService::class.java).apply {
            action = AdbSentinelService.ACTION_START_RESOURCE
            putExtra(AdbSentinelService.EXTRA_RESOURCE_KEY, resource)
        }
        startService(intent)
        finish()
    }

    private fun denyAccess(resource: String) {
        val intent = Intent(this, AdbSentinelService::class.java).apply {
            action = AdbSentinelService.ACTION_STOP_RESOURCE
            putExtra(AdbSentinelService.EXTRA_RESOURCE_KEY, resource)
        }
        startService(intent)
        finish()
    }

    private fun triggerAlertVibration() {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val vm = getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager
                vm?.defaultVibrator?.vibrate(VibrationEffect.createOneShot(120, VibrationEffect.DEFAULT_AMPLITUDE))
            } else {
                @Suppress("DEPRECATION")
                val v = getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
                v?.vibrate(120)
            }
        } catch (ignored: Exception) {}
    }

    companion object {
        const val EXTRA_RESOURCE = "extra_resource"
        const val EXTRA_REQUESTER = "extra_requester"
    }
}
