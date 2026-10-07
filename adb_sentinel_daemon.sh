#!/system/bin/sh
# ADB Sentinel Ultra-Fast Kernel Daemon

touch /data/local/tmp/adb_live.log 2>/dev/null
chmod 666 /data/local/tmp/adb_live.log 2>/dev/null
touch /data/local/tmp/adb_commands.txt 2>/dev/null
chmod 666 /data/local/tmp/adb_commands.txt 2>/dev/null

# 1. Pipeline de streaming em tempo real contínuo (0ms de latência)
(
  logcat -v time -s adbd:I | grep --line-buffered "service requested" | while IFS= read -r line; do
    echo "$line" >> /data/local/tmp/adb_live.log
    chmod 666 /data/local/tmp/adb_live.log 2>/dev/null
  done
) &

# 2. Loop de sockets e sincronização
COUNT=0
while true; do
  CONNS=""
  if [ -f /proc/net/tcp6 ]; then
    CONNS=$(grep ":15B3" /proc/net/tcp6 | grep " 01 ")
  fi
  if [ -z "$CONNS" ] && [ -f /proc/net/tcp ]; then
    CONNS=$(grep ":15B3" /proc/net/tcp | grep " 01 ")
  fi

  if [ -n "$CONNS" ]; then
    RAW_REMOTE=$(echo "$CONNS" | head -n 1 | awk '{print $3}')
    HEX_IP=$(echo "$RAW_REMOTE" | cut -d: -f1)
    HEX_PORT=$(echo "$RAW_REMOTE" | cut -d: -f2)

    V4_HEX=$(echo "$HEX_IP" | tail -c 9)
    B1=$((0x${V4_HEX:6:2}))
    B2=$((0x${V4_HEX:4:2}))
    B3=$((0x${V4_HEX:2:2}))
    B4=$((0x${V4_HEX:0:2}))
    REMOTE_IP="$B1.$B2.$B3.$B4"
    PORT_DEC=$((0x$HEX_PORT))

    echo "[{\"id\":\"$REMOTE_IP:$PORT_DEC\",\"remoteIp\":\"$REMOTE_IP\",\"remotePort\":$PORT_DEC,\"localPort\":5555,\"state\":\"ESTABLISHED\",\"type\":\"WIRELESS\"}]" > /data/local/tmp/adb_active.json
  else
    if dumpsys adb 2>/dev/null | grep -q "connected_to_adb=true"; then
      echo "[{\"id\":\"USB_HOST\",\"remoteIp\":\"USB-Host-Attached\",\"remotePort\":0,\"localPort\":5555,\"state\":\"ESTABLISHED\",\"type\":\"USB\"}]" > /data/local/tmp/adb_active.json
    else
      echo "[]" > /data/local/tmp/adb_active.json
    fi
  fi
  chmod 666 /data/local/tmp/adb_active.json 2>/dev/null

  # Rotação de logs para manter performance e memória limpas
  COUNT=$((COUNT + 1))
  if [ $COUNT -ge 20 ]; then
    COUNT=0
    tail -n 150 /data/local/tmp/adb_live.log > /data/local/tmp/adb_live.tmp 2>/dev/null
    mv /data/local/tmp/adb_live.tmp /data/local/tmp/adb_live.log 2>/dev/null
    chmod 666 /data/local/tmp/adb_live.log 2>/dev/null

    logcat -d -v time -s adbd:I -e "service requested" | tail -n 40 > /data/local/tmp/adb_commands.tmp 2>/dev/null
    mv /data/local/tmp/adb_commands.tmp /data/local/tmp/adb_commands.txt 2>/dev/null
    chmod 666 /data/local/tmp/adb_commands.txt 2>/dev/null
  fi

  sleep 1
done
