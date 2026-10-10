#!/bin/bash
set -e

# ==============================================================================
# 🛡️ ADB GLASS SENTINEL — BUILD, SIGN & DEPLOY SCRIPT (GALAXY S22 ULTRA)
# ==============================================================================
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

export JAVA_HOME="/opt/homebrew/Cellar/openjdk@17/17.0.20.1/libexec/openjdk.jdk/Contents/Home"
export ANDROID_HOME="/opt/homebrew/share/android-commandlinetools"
export BUILD_TOOLS="/opt/homebrew/share/android-commandlinetools/build-tools/35.0.0"
export PATH="$JAVA_HOME/bin:$BUILD_TOOLS:$PATH"

echo "=========================================================="
echo "🚀 Compilando ADB Glass Sentinel (Release APK)..."
echo "=========================================================="

./gradlew assembleRelease

APK_PATH="app/build/outputs/apk/release/app-release.apk"
FINAL_APK="AdbGlassSentinel_v1.0.0.apk"

if [ -f "$APK_PATH" ]; then
    cp "$APK_PATH" "$FINAL_APK"
    echo "✅ APK compilado com sucesso: $FINAL_APK"
    ls -lh "$FINAL_APK"
else
    echo "❌ APK não encontrado em $APK_PATH"
    exit 1
fi

DEVICE_ID="${DEVICE:-192.168.15.22:5555}"

if adb devices | grep -q "$DEVICE_ID"; then
    echo "=========================================================="
    echo "📲 Instalando no dispositivo oficial: $DEVICE_ID (Usuário 0)..."
    echo "=========================================================="
    adb -s "$DEVICE_ID" install --user 0 -r "$FINAL_APK"

    echo "🧹 Garantindo remoção de perfis secundários..."
    adb -s "$DEVICE_ID" shell pm uninstall --user 10 com.mateuscelestino.adbsentinel 2>/dev/null || true
    adb -s "$DEVICE_ID" shell pm uninstall --user 95 com.mateuscelestino.adbsentinel 2>/dev/null || true

    echo "🔐 Concedendo permissões profundas de telemetria do SO..."
    adb -s "$DEVICE_ID" shell pm grant com.mateuscelestino.adbsentinel android.permission.READ_LOGS 2>/dev/null || true
    adb -s "$DEVICE_ID" shell pm grant com.mateuscelestino.adbsentinel android.permission.WRITE_SECURE_SETTINGS 2>/dev/null || true
    adb -s "$DEVICE_ID" shell pm grant com.mateuscelestino.adbsentinel android.permission.DUMP 2>/dev/null || true
    adb -s "$DEVICE_ID" shell dumpsys deviceidle whitelist +com.mateuscelestino.adbsentinel 2>/dev/null || true
    adb -s "$DEVICE_ID" shell cmd appops set com.mateuscelestino.adbsentinel RUN_IN_BACKGROUND allow 2>/dev/null || true
    adb -s "$DEVICE_ID" shell settings put global adb_enabled 1 2>/dev/null || true
    adb -s "$DEVICE_ID" shell settings put global adb_wifi_enabled 1 2>/dev/null || true

    echo "⚡ Atualizando e iniciando Daemon Kernel ADB Sentinel..."
    adb -s "$DEVICE_ID" push adb_sentinel_daemon.sh /data/local/tmp/adb_sentinel_daemon.sh
    adb -s "$DEVICE_ID" shell "chmod 755 /data/local/tmp/adb_sentinel_daemon.sh && pkill -f adb_sentinel_daemon.sh 2>/dev/null || true"
    adb -s "$DEVICE_ID" shell "setsid /system/bin/sh /data/local/tmp/adb_sentinel_daemon.sh >/dev/null 2>&1 < /dev/null &"

    echo "🚀 Iniciando ADB Glass Sentinel no Usuário 0..."
    adb -s "$DEVICE_ID" shell am force-stop com.mateuscelestino.adbsentinel
    adb -s "$DEVICE_ID" shell am start --user 0 -n com.mateuscelestino.adbsentinel/.MainActivity
    echo "=========================================================="
    echo "✨ App iniciado com sucesso com acesso profundo ao SO!"
    echo "=========================================================="
else
    echo "⚠️ Dispositivo $DEVICE_ID não está conectado no momento. O APK $FINAL_APK está pronto para instalação!"
fi
