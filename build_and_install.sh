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

DEVICE_ID=$(adb devices | grep -w "device" | head -n 1 | awk '{print $1}')

if [ -n "$DEVICE_ID" ]; then
    echo "=========================================================="
    echo "📲 Instalando no dispositivo ativo: $DEVICE_ID..."
    echo "=========================================================="
    adb -s "$DEVICE_ID" install -r "$FINAL_APK"

    echo "🔐 Concedendo permissões profundas de telemetria do SO..."
    adb -s "$DEVICE_ID" shell pm grant com.mateuscelestino.adbsentinel android.permission.READ_LOGS 2>/dev/null || true
    adb -s "$DEVICE_ID" shell pm grant com.mateuscelestino.adbsentinel android.permission.WRITE_SECURE_SETTINGS 2>/dev/null || true
    adb -s "$DEVICE_ID" shell pm grant com.mateuscelestino.adbsentinel android.permission.DUMP 2>/dev/null || true

    echo "🚀 Iniciando ADB Glass Sentinel..."
    adb -s "$DEVICE_ID" shell am start -n com.mateuscelestino.adbsentinel/.MainActivity
    echo "=========================================================="
    echo "✨ App iniciado com sucesso com acesso profundo ao SO!"
    echo "=========================================================="
else
    echo "⚠️ Nenhum dispositivo com status 'device' conectado via ADB."
fi
