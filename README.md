# 🛡️ ADB Glass Sentinel

**ADB Glass Sentinel** é um aplicativo nativo Android para controle profundo, monitoramento e auditoria em tempo real de conexões e comandos ADB (*Android Debug Bridge*), combinando segurança avançada de baixo nível e uma interface *Liquid Glassmorphism* com shaders WebGL estéticos inspirados no ecossistema *Personal OS*.

---

## 🌟 Funcionalidades Principais

1. **Alternância de Wireless ADB com 1 Toque:**
   - Ativação e desativação instantânea do ADB sobre TCP/IP (Porta 5555).
   - Manipulação direta de `Settings.Global adb_wifi_enabled` e properties de sistema via AIDL / IPC.
   - Dial tátil central com anel de progresso luminescente e haptic feedback.

2. **Identificação Mandatória de IP do Host:**
   - Nenhum dispositivo conecta anonimamente: decodificação de sockets TCP/TCP6 (little-endian IPv4 e IPv6 mapped `::ffff:x.x.x.x`).
   - Monitoramento contínuo com daemon local de alta performance e resolução reversa via ARP.
   - Exibição em destaque do endereço IP e porta do computador ou host conectado.

3. **Super Glass Box Terminal com Letras Verde Fósforo:**
   - Streaming em tempo real dos comandos shell recebidos pelo daemon `adbd` do sistema Android.
   - Identificação do tipo de serviço (`SHELL`, `SHELL_V2`, `EXEC`, `ABB`, `SYNC`).
   - Tagging de comandos privilegiados (`pm`, `am`, `setprop`, `su`) com destaque visual.
   - Efeito CRT scanlines, quebra automática de linha e controle de pausa/limpeza sem vazamento de memória (buffer circular limitado a 80 nós no DOM para manter 120 FPS).

4. **Gerenciamento Profundo de Autorizações e Chaves:**
   - Integração com a interface AIDL do sistema operacional `android.debug.IAdbManager`.
   - Autorização permanente de hosts confiáveis com injeção de chaves públicas.
   - Recusa e desconexão imediata (*deny debugging*).
   - Revogação total de chaves do dispositivo (*clear debugging keys*).
   - Histórico persistente de conexões anteriores armazenado localmente em SharedPreferences.

5. **Shaders WebGL Estéticos em Segundo Plano:**
   - Motor WebGL autônomo sem dependências externas rodando em segundo plano sob vidro fosco (*Liquid Glass* com `backdrop-filter: blur(24px)`):
     - **Cyber Matrix:** Chuva digital verde néon com scanlines cibernéticos.
     - **Strands Neon:** Fitas ondulantes em ciano e roxo profundo inspiradas no Pomodoro Clock.
     - **Plasma Wave:** Ondas fluidas de plasma esmeralda e turquesa.
     - **Dark Veil:** Véu obsidiano minimalista com névoa luminescente sutil.

---

## 🏗️ Arquitetura do Sistema

```
                      ┌──────────────────────────────────────┐
                      │    Host Externo (Computador / CLI)   │
                      └──────────────────┬───────────────────┘
                                         │ TCP 5555 / USB
                                         ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                    Samsung Galaxy S22 Ultra (Android 14)                   │
│                                                                            │
│  ┌───────────────────────┐             ┌───────────────────────────────┐   │
│  │ adbd (Daemon Nativo)  │             │   IAdbManager (AIDL Binder)   │   │
│  └──────────┬────────────┘             └───────────────▲───────────────┘   │
│             │ Logcat time                              │ Transact IPC      │
│             ▼                                          │                   │
│  ┌───────────────────────┐             ┌───────────────┴───────────────┐   │
│  │    AdbLogStreamer     │             │      AdbSystemController      │   │
│  └──────────┬────────────┘             └───────────────▲───────────────┘   │
│             │                                          │                   │
│             ▼                                          │                   │
│  ┌───────────────────────┐             ┌───────────────┴───────────────┐   │
│  │   AdbSentinelService  ├────────────►│         AndroidBridge         │   │
│  │ (Foreground Service)  │             │     (JavaScriptInterface)     │   │
│  └───────────────────────┘             └───────────────▲───────────────┘   │
│                                                        │                   │
│  ┌─────────────────────────────────────────────────────┴────────────────┐  │
│  │              WebView (Chromium) + WebViewAssetLoader                 │  │
│  │  ┌───────────────────────┐            ┌───────────────────────────┐  │  │
│  │  │   Super Glass Box     │            │       Shaders WebGL       │  │  │
│  │  │ Terminal Verde Fósforo│            │ (Matrix/Strands/Plasma/Veil│  │  │
│  │  └───────────────────────┘            └───────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## 📦 Binários e Instalação

O binário assinado oficial encontra-se na raiz do repositório e nas Releases:
- **Arquivo:** `AdbGlassSentinel_v1.0.0.apk`
- **Target SDK:** Android 15 (API 35) / Min SDK: Android 8.0 (API 26)
- **Assinatura:** Keystore Release SHA-256

Para instalar diretamente via ADB:
```bash
adb install -r AdbGlassSentinel_v1.0.0.apk
adb shell pm grant com.mateuscelestino.adbsentinel android.permission.READ_LOGS
adb shell pm grant com.mateuscelestino.adbsentinel android.permission.DUMP
```

---

## 🔒 Auditoria de Segurança & Permissões

- **SELinux Enforcing:** O Android 14 restringe a leitura de `/proc/net/tcp6` por UIDs não privilegiados. O ADB Sentinel conta com fallback multicamada (daemon de inspeção de sockets com permissão de leitura, tabela ARP `/proc/net/arp` e parsing do `dumpsys adb`).
- **Sanitização XSS:** Todos os comandos de shell e dados de rede são rigorosamente escapados via `escapeHtml()` antes da injeção no DOM, impedindo injeção de scripts no Webview.
- **Isolamento de Origem:** Os assets locais são servidos exclusivamente através de `WebViewAssetLoader` sob o esquema seguro `https://appassets.androidplatform.net/assets/`, eliminando vulnerabilidades ligadas a `file:///` e desativando requisições cross-origin não autorizadas.

---

## 👤 Autor

**Mateus Celestino**  
GitHub: [@MateusCelestinoProX](https://github.com/MateusCelestinoProX)  
E-mail: `202405039459@alunos.estacio.br`
