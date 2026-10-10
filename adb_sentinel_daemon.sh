#!/system/bin/sh
# ADB Sentinel Ultra-Fast Kernel Daemon (v2.0)
# Sincroniza telemetria em tempo real para /data/local/tmp e /sdcard/Android/data/com.mateuscelestino.adbsentinel/files

APP_EXT_DIR="/sdcard/Android/data/com.mateuscelestino.adbsentinel/files"
mkdir -p "$APP_EXT_DIR" 2>/dev/null

TMP_LIVE="/data/local/tmp/adb_live.log"
EXT_LIVE="$APP_EXT_DIR/adb_live.log"
TMP_ACTIVE="/data/local/tmp/adb_active.json"
EXT_ACTIVE="$APP_EXT_DIR/adb_active.json"
CTRL_FILE="$APP_EXT_DIR/adb_control.cmd"

touch "$TMP_LIVE" "$EXT_LIVE" 2>/dev/null
chmod 666 "$TMP_LIVE" "$EXT_LIVE" 2>/dev/null

# Inicializa com os últimos comandos do buffer logcat para exibição imediata
logcat -d -v time -s adbd:I | tail -n 80 > "$TMP_LIVE" 2>/dev/null
cp "$TMP_LIVE" "$EXT_LIVE" 2>/dev/null
chmod 666 "$TMP_LIVE" "$EXT_LIVE" 2>/dev/null

# 1. Pipeline de streaming em tempo real contínuo (0ms de latência, preservando comandos multilinhas)
(
  logcat -v time -s adbd:I | while IFS= read -r line; do
    echo "$line" >> "$TMP_LIVE"
    echo "$line" >> "$EXT_LIVE" 2>/dev/null
  done
) &

# 2. Loop de controle ADB, sockets e manutenção
COUNT=0
while true; do
  # Mantém as configurações globais de ADB sempre ativas (Salva-guarda permanente)
  COUNT=$((COUNT + 1))
  if [ $((COUNT % 10)) -eq 0 ]; then
    settings put global adb_enabled 1 2>/dev/null
    settings put global adb_wifi_enabled 1 2>/dev/null
  fi

  # Verifica se o app enviou comando de controle do Sentinel
  if [ -f "$CTRL_FILE" ]; then
    CMD=$(cat "$CTRL_FILE" 2>/dev/null | tr -d '\r\n ')
    rm -f "$CTRL_FILE" 2>/dev/null
    if [ "$CMD" = "DISABLE" ]; then
      # Pausa monitoramento no app sem derrubar o adb_enabled global do Android
      echo "[]" > "$TMP_ACTIVE" 2>/dev/null
      echo "[]" > "$EXT_ACTIVE" 2>/dev/null
    elif [ "$CMD" = "ENABLE" ]; then
      setprop service.adb.tcp.port 5555 2>/dev/null
      settings put global adb_enabled 1 2>/dev/null
      settings put global adb_wifi_enabled 1 2>/dev/null
      start adbd 2>/dev/null
    fi
  fi

  CONNS=""
  if [ -f /proc/net/tcp6 ]; then
    CONNS=$(grep -E ":15B3| 2000 " /proc/net/tcp6 | grep " 01 ")
  fi
  if [ -z "$CONNS" ] && [ -f /proc/net/tcp ]; then
    CONNS=$(grep -E ":15B3| 2000 " /proc/net/tcp | grep " 01 ")
  fi

  if [ -n "$CONNS" ]; then
    CONN_LINE=$(echo "$CONNS" | head -n 1)
    RAW_LOCAL=$(echo "$CONN_LINE" | awk '{print $2}')
    RAW_REMOTE=$(echo "$CONN_LINE" | awk '{print $3}')

    HEX_LOCAL_PORT=$(echo "$RAW_LOCAL" | cut -d: -f2)
    HEX_IP=$(echo "$RAW_REMOTE" | cut -d: -f1)
    HEX_PORT=$(echo "$RAW_REMOTE" | cut -d: -f2)

    V4_HEX=$(echo "$HEX_IP" | tail -c 9)
    B1=$((0x${V4_HEX:6:2}))
    B2=$((0x${V4_HEX:4:2}))
    B3=$((0x${V4_HEX:2:2}))
    B4=$((0x${V4_HEX:0:2}))
    REMOTE_IP="$B1.$B2.$B3.$B4"
    PORT_DEC=$((0x$HEX_PORT))
    LOCAL_PORT_DEC=$((0x$HEX_LOCAL_PORT))
    if [ "$LOCAL_PORT_DEC" -eq 0 ]; then
      LOCAL_PORT_DEC=5555
    fi

    JSON_OUT="[{\"id\":\"$REMOTE_IP:$PORT_DEC\",\"remoteIp\":\"$REMOTE_IP\",\"remotePort\":$PORT_DEC,\"localPort\":$LOCAL_PORT_DEC,\"state\":\"ESTABLISHED\",\"type\":\"WIRELESS\"}]"
    echo "$JSON_OUT" > "$TMP_ACTIVE"
    echo "$JSON_OUT" > "$EXT_ACTIVE" 2>/dev/null
  else
    if dumpsys adb 2>/dev/null | grep -q "connected_to_adb=true"; then
      JSON_OUT="[{\"id\":\"USB_HOST\",\"remoteIp\":\"USB-Host-Attached\",\"remotePort\":0,\"localPort\":5555,\"state\":\"ESTABLISHED\",\"type\":\"USB\"}]"
      echo "$JSON_OUT" > "$TMP_ACTIVE"
      echo "$JSON_OUT" > "$EXT_ACTIVE" 2>/dev/null
    else
      echo "[]" > "$TMP_ACTIVE"
      echo "[]" > "$EXT_ACTIVE" 2>/dev/null
    fi
  fi
  chmod 666 "$TMP_ACTIVE" "$EXT_ACTIVE" 2>/dev/null

  # Rotação suave apenas quando o arquivo ultrapassar 800 linhas
  if [ $COUNT -ge 45 ]; then
    COUNT=0
    LINE_CNT=$(wc -l < "$TMP_LIVE" 2>/dev/null || echo 0)
    if [ "$LINE_CNT" -gt 800 ]; then
      tail -n 250 "$TMP_LIVE" > "${TMP_LIVE}.tmp" 2>/dev/null
      mv "${TMP_LIVE}.tmp" "$TMP_LIVE" 2>/dev/null
      cp "$TMP_LIVE" "$EXT_LIVE" 2>/dev/null
      chmod 666 "$TMP_LIVE" "$EXT_LIVE" 2>/dev/null
    fi
    dumpsys adb 2>/dev/null > "$APP_EXT_DIR/adb_keys.txt" 2>/dev/null
  fi

  sleep 1
done
