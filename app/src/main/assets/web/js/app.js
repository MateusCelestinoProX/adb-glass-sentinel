/**
 * ADB GLASS SENTINEL — Motor de Interface Reativa & Bridge
 * Design inspirado no Pomodoro Clock do Personal OS
 * Terminal Verde Fósforo em Tempo Real • Widget Background & Accent Colors
 */

(function () {
  'use strict';

  let isPaused = false;
  let isWirelessOn = true;
  let activeShader = localStorage.getItem('adb_sentinel_shader') || 'strands';
  let activeAccent = localStorage.getItem('adb_sentinel_accent_color') || '#00ff66';

  // Elementos da Interface Geral
  const toggleDialBtn = document.getElementById('toggle-dial-btn');
  const dialProgressRing = document.getElementById('dial-progress-ring');
  const dialIconEmoji = document.getElementById('dial-icon-emoji');
  const dialStateLabel = document.getElementById('dial-state-label');
  const headerStatusDot = document.getElementById('header-status-dot');
  const headerStatusText = document.getElementById('header-status-text');
  const endpointPill = document.getElementById('endpoint-pill');
  const endpointIpLabel = document.getElementById('endpoint-ip-label');
  const activeCountBadge = document.getElementById('active-count-badge');
  const activeDevicesContainer = document.getElementById('active-devices-container');

  // Elementos do Terminal de Comandos
  const terminalViewport = document.getElementById('terminal-viewport');
  const terminalEmptyMsg = document.getElementById('terminal-empty-msg');
  const btnTermPause = document.getElementById('btn-term-pause');
  const btnTermClear = document.getElementById('btn-term-clear');

  // Elementos do Dock Inferior
  const dockBtnBackground = document.getElementById('dock-btn-background');
  const dockBtnHistory = document.getElementById('dock-btn-history');

  // Elementos do Widget de Background & Visual
  const bgWidgetOverlay = document.getElementById('background-widget-overlay');
  const btnBgModalClose = document.getElementById('btn-bg-modal-close');
  const colorSwatchButtons = document.querySelectorAll('.color-swatch-btn');
  const customColorInput = document.getElementById('custom-color-input');
  const customColorPreview = document.getElementById('custom-color-preview');
  const customColorHexText = document.getElementById('custom-color-hex-text');
  const shaderOptionCards = document.querySelectorAll('.shader-option-card');

  // Elementos do Modal de Histórico
  const historyModalOverlay = document.getElementById('history-modal-overlay');
  const btnModalClose = document.getElementById('btn-modal-close');
  const modalContentList = document.getElementById('modal-content-list');
  const btnClearHistory = document.getElementById('btn-clear-history');
  const btnRevokeAllKeys = document.getElementById('btn-revoke-all-keys');

  // =========================================================================
  // 1. GESTÃO DE CORES DE ACENTO DA INTERFACE (Customizável pelo Usuário)
  // =========================================================================
  function hexToRgb(hex) {
    hex = hex.replace('#', '');
    if (hex.length === 3) {
      hex = hex.split('').map((c) => c + c).join('');
    }
    const num = parseInt(hex, 16);
    return {
      r: (num >> 16) & 255,
      g: (num >> 8) & 255,
      b: num & 255
    };
  }

  function applyAccentColor(hex) {
    activeAccent = hex;
    localStorage.setItem('adb_sentinel_accent_color', hex);

    const rgb = hexToRgb(hex);
    const root = document.documentElement;
    root.style.setProperty('--accent-primary', hex);
    root.style.setProperty('--accent-primary-glow', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.45)`);
    root.style.setProperty('--accent-primary-soft', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.14)`);
    root.style.setProperty('--accent-primary-border', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.38)`);

    // Atualiza controles visuais
    if (customColorPreview) {
      customColorPreview.style.background = hex;
      customColorPreview.style.boxShadow = `0 0 10px rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.5)`;
    }
    if (customColorHexText) {
      customColorHexText.textContent = `Cor Personalizada (${hex.toUpperCase()})`;
    }
    if (customColorInput) {
      customColorInput.value = hex;
    }

    // Marca o botão da paleta se coincidir
    colorSwatchButtons.forEach((btn) => {
      const bColor = btn.dataset.color.toLowerCase();
      if (bColor === hex.toLowerCase()) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }

  // Eventos de clique na paleta de cores rápida
  colorSwatchButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const color = btn.dataset.color;
      if (color) {
        applyAccentColor(color);
        if (window.AndroidBridge && window.AndroidBridge.vibrate) {
          window.AndroidBridge.vibrate(15);
        }
      }
    });
  });

  // Evento do Seletor Livre Hexadecimal
  if (customColorInput) {
    customColorInput.addEventListener('input', (e) => {
      applyAccentColor(e.target.value);
    });
  }

  // Inicializa cor de acento salva
  applyAccentColor(activeAccent);

  // =========================================================================
  // 2. GESTÃO DOS 5 SHADERS WEBGL DO PERSONAL OS
  // =========================================================================
  function updateShaderCardsUi(selectedShader) {
    shaderOptionCards.forEach((card) => {
      const type = card.dataset.shader;
      const tag = card.querySelector('.shader-status-tag');
      if (type === selectedShader) {
        card.classList.add('active');
        if (tag) tag.textContent = 'ATIVO';
      } else {
        card.classList.remove('active');
        if (tag) tag.textContent = 'SELECIONAR';
      }
    });
  }

  shaderOptionCards.forEach((card) => {
    card.addEventListener('click', () => {
      const shader = card.dataset.shader;
      if (shader && shader !== activeShader) {
        activeShader = shader;
        localStorage.setItem('adb_sentinel_shader', activeShader);
        updateShaderCardsUi(activeShader);

        const ctn = document.getElementById('bg-webgl-container');
        if (ctn && window.initShader) {
          window.initShader(ctn, activeShader);
        }

        if (window.AndroidBridge && window.AndroidBridge.vibrate) {
          window.AndroidBridge.vibrate(20);
        }
      }
    });
  });

  updateShaderCardsUi(activeShader);

  // =========================================================================
  // 3. WIDGET DE BACKGROUND & VISUAL (Abertura / Fechamento)
  // =========================================================================
  if (dockBtnBackground) {
    dockBtnBackground.addEventListener('click', () => {
      bgWidgetOverlay.classList.add('open');
      if (window.AndroidBridge && window.AndroidBridge.vibrate) {
        window.AndroidBridge.vibrate(15);
      }
    });
  }

  if (btnBgModalClose) {
    btnBgModalClose.addEventListener('click', () => {
      bgWidgetOverlay.classList.remove('open');
    });
  }

  bgWidgetOverlay.addEventListener('click', (e) => {
    if (e.target === bgWidgetOverlay) {
      bgWidgetOverlay.classList.remove('open');
    }
  });

  // =========================================================================
  // 4. TERMINAL ADB EM TEMPO REAL (Zero Tremor • Letras Verdes • Alta Fluidez)
  // =========================================================================
  const seenCommandIds = new Set();

  window.onAdbCommandReceived = function (event) {
    if (isPaused) return;
    if (!event || !event.command) return;

    // Deduplicação determinística
    const cmdKey = event.id || `${event.timestamp}_${event.command}`;
    if (seenCommandIds.has(cmdKey)) return;
    seenCommandIds.add(cmdKey);

    if (terminalEmptyMsg && terminalEmptyMsg.style.display !== 'none') {
      terminalEmptyMsg.style.display = 'none';
    }

    const row = document.createElement('div');
    row.className = 'terminal-log-row';
    row.dataset.id = cmdKey;

    const privClass = event.isPrivileged ? ' privileged' : '';
    const badgeText = event.clientIp || '192.168.15.23';

    row.innerHTML = `
      <div class="log-meta-line">
        <span class="log-time">${escapeHtml(event.timestamp)}</span>
        <span class="log-ip-badge">IP: ${escapeHtml(badgeText)}</span>
        <span>[${escapeHtml(event.serviceType || 'SHELL')}]</span>
      </div>
      <div class="log-cmd-line${privClass}">$ ${escapeHtml(event.command)}</div>
    `;

    // Inserção suave no topo sem interferir na rolagem ou causar tremor
    terminalViewport.prepend(row);

    // Limita linhas no DOM para estabilidade perpétua a 120 FPS
    while (terminalViewport.children.length > 80) {
      const lastChild = terminalViewport.lastChild;
      if (lastChild && lastChild.dataset && lastChild.dataset.id) {
        seenCommandIds.delete(lastChild.dataset.id);
      }
      terminalViewport.removeChild(lastChild);
    }
  };

  btnTermPause.addEventListener('click', () => {
    isPaused = !isPaused;
    btnTermPause.textContent = isPaused ? 'RETOMAR' : 'PAUSAR';
    if (isPaused) {
      btnTermPause.style.color = 'var(--accent-amber)';
      btnTermPause.style.borderColor = 'var(--accent-amber)';
    } else {
      btnTermPause.style.color = '';
      btnTermPause.style.borderColor = '';
    }
  });

  btnTermClear.addEventListener('click', () => {
    seenCommandIds.clear();
    terminalViewport.innerHTML = `
      <div class="terminal-empty-msg" id="terminal-empty-msg">
        &gt; Terminal limpo. Escutando novos comandos shell em tempo real...<br>
        &gt; Letras verdes terminal green com IP de origem ativo.
      </div>
    `;
    if (window.AndroidBridge && window.AndroidBridge.vibrate) {
      window.AndroidBridge.vibrate(20);
    }
  });

  // =========================================================================
  // 5. STATUS DO ADB & DISPOSITIVOS CONECTADOS (IP Mandatório)
  // =========================================================================
  function updateUiWithStatus(status) {
    isWirelessOn = status.wirelessEnabled;

    if (isWirelessOn) {
      dialProgressRing.classList.remove('inactive');
      dialIconEmoji.textContent = '⚡';
      dialStateLabel.textContent = 'WIRELESS ON';
      dialStateLabel.classList.remove('inactive');
      headerStatusDot.classList.remove('inactive');
      headerStatusText.textContent = 'PORTA 5555 ATIVA';
    } else {
      dialProgressRing.classList.add('inactive');
      dialIconEmoji.textContent = '🔒';
      dialStateLabel.textContent = 'WIRELESS OFF';
      dialStateLabel.classList.add('inactive');
      headerStatusDot.classList.add('inactive');
      headerStatusText.textContent = 'WIRELESS INATIVO';
    }

    if (status.wifiIp) {
      endpointIpLabel.textContent = status.wifiIp;
    }
  }

  function fetchAdbStatus() {
    if (window.AndroidBridge && window.AndroidBridge.getAdbStatus) {
      try {
        const raw = window.AndroidBridge.getAdbStatus();
        const data = JSON.parse(raw);
        updateUiWithStatus(data);
      } catch (e) {
        console.error('Erro ao ler getAdbStatus', e);
      }
    }
  }

  function fetchActiveDevices() {
    if (window.AndroidBridge && window.AndroidBridge.getActiveConnections) {
      try {
        const raw = window.AndroidBridge.getActiveConnections();
        const list = JSON.parse(raw);
        renderActiveDevices(list);
      } catch (e) {
        console.error('Erro ao ler getActiveConnections', e);
      }
    }
  }

  function renderActiveDevices(devices) {
    const established = devices.filter((d) => d.state === 'ESTABLISHED');
    activeCountBadge.textContent = `${established.length} ATIVO${established.length === 1 ? '' : 'S'}`;

    if (established.length === 0) {
      activeDevicesContainer.innerHTML = `
        <div class="active-host-box" style="border-color: rgba(255,255,255,0.1);">
          <div class="host-top-row">
            <span style="color: var(--text-dim); font-size: 12px; font-family: var(--font-mono);">Nenhum dispositivo conectado</span>
          </div>
          <div class="host-status-desc">Aguardando conexão na porta 5555 ou USB...</div>
        </div>
      `;
      return;
    }

    let html = '';
    established.forEach((dev) => {
      const isUsb = dev.type === 'USB';
      const ipDisplay = isUsb ? 'HOST CONECTADO VIA USB' : dev.remoteIp;
      const portDisplay = isUsb ? '' : `:${dev.remotePort}`;

      html += `
        <div class="active-host-box">
          <div class="host-top-row">
            <span class="host-ip-title">${escapeHtml(ipDisplay)}${portDisplay}</span>
            <span class="host-type-tag">${dev.type}</span>
          </div>
          <div class="host-bottom-row">
            <span class="host-status-desc">Socket: ${dev.state} • Conectado</span>
            <div class="host-action-buttons">
              <button class="btn-glass-action auth" onclick="window.onAuthDeviceClick('${escapeHtml(dev.remoteIp)}')">Autorizar</button>
              <button class="btn-glass-action deny" onclick="window.onDenyDeviceClick('${escapeHtml(dev.remoteIp)}')">Derrubar</button>
            </div>
          </div>
        </div>
      `;
    });

    activeDevicesContainer.innerHTML = html;
  }

  // Toggle do Wireless ADB
  toggleDialBtn.addEventListener('click', () => {
    const newState = !isWirelessOn;
    if (window.AndroidBridge && window.AndroidBridge.toggleWirelessAdb) {
      window.AndroidBridge.toggleWirelessAdb(newState);
      setTimeout(fetchAdbStatus, 300);
      setTimeout(fetchActiveDevices, 500);
    } else {
      updateUiWithStatus({ wirelessEnabled: newState, wifiIp: '192.168.15.22' });
    }
  });

  // Copiar Endpoint
  endpointPill.addEventListener('click', () => {
    const text = `${endpointIpLabel.textContent}:5555`;
    if (window.AndroidBridge && window.AndroidBridge.copyToClipboard) {
      window.AndroidBridge.copyToClipboard(text);
    }
    const badge = endpointPill.querySelector('.copy-badge');
    if (badge) {
      badge.textContent = 'COPIADO!';
      setTimeout(() => { badge.textContent = 'COPIAR'; }, 1500);
    }
  });

  // Autorizar / Derrubar
  window.onAuthDeviceClick = function (ip) {
    if (window.AndroidBridge && window.AndroidBridge.allowDebugging) {
      window.AndroidBridge.allowDebugging(true, ip);
      alert(`Dispositivo com IP ${ip} autorizado permanentemente.`);
    }
  };

  window.onDenyDeviceClick = function (ip) {
    if (window.AndroidBridge && window.AndroidBridge.denyDebugging) {
      window.AndroidBridge.denyDebugging();
      setTimeout(fetchActiveDevices, 500);
    }
  };

  // =========================================================================
  // 6. MODAL DE HISTÓRICO & CHAVES
  // =========================================================================
  dockBtnHistory.addEventListener('click', () => {
    loadHistoryModalData();
    historyModalOverlay.classList.add('open');
    if (window.AndroidBridge && window.AndroidBridge.vibrate) {
      window.AndroidBridge.vibrate(15);
    }
  });

  btnModalClose.addEventListener('click', () => {
    historyModalOverlay.classList.remove('open');
  });

  historyModalOverlay.addEventListener('click', (e) => {
    if (e.target === historyModalOverlay) {
      historyModalOverlay.classList.remove('open');
    }
  });

  function loadHistoryModalData() {
    let historyList = [];
    let keysList = [];

    if (window.AndroidBridge) {
      try {
        if (window.AndroidBridge.getConnectionHistory) {
          historyList = JSON.parse(window.AndroidBridge.getConnectionHistory());
        }
        if (window.AndroidBridge.getAuthorizedKeys) {
          keysList = JSON.parse(window.AndroidBridge.getAuthorizedKeys());
        }
      } catch (e) {
        console.error('Erro ao ler histórico', e);
      }
    }

    let html = '';
    html += `<div style="font-size: 12px; font-weight: 700; color: var(--accent-primary); margin-top: 4px;">CHAVES AUTORIZADAS NO SO (${keysList.length})</div>`;
    if (keysList.length === 0) {
      html += `<div style="font-size: 11px; color: var(--text-dim); padding: 6px 0;">Nenhuma chave registrada em dumpsys adb.</div>`;
    } else {
      keysList.forEach((k) => {
        html += `
          <div class="history-item-row">
            <div>
              <div class="history-ip">🔑 ${escapeHtml(k.comment)}</div>
              <div class="history-meta">${escapeHtml(k.rawKey.substring(0, 32))}...</div>
            </div>
            <span class="copy-badge" onclick="window.AndroidBridge && window.AndroidBridge.copyToClipboard('${escapeHtml(k.rawKey)}')">COPIAR</span>
          </div>
        `;
      });
    }

    html += `<div style="font-size: 12px; font-weight: 700; color: var(--accent-cyan); margin-top: 12px;">SESSÕES ANTERIORES (${historyList.length})</div>`;
    if (historyList.length === 0) {
      html += `<div style="font-size: 11px; color: var(--text-dim); padding: 6px 0;">Nenhuma conexão anterior gravada.</div>`;
    } else {
      historyList.forEach((h) => {
        const d = new Date(h.timestamp).toLocaleTimeString();
        html += `
          <div class="history-item-row">
            <div>
              <div class="history-ip">${escapeHtml(h.remoteIp)}:${h.remotePort}</div>
              <div class="history-meta">Horário: ${d} • Tipo: ${h.type}</div>
            </div>
            <span class="host-type-tag">${h.state}</span>
          </div>
        `;
      });
    }

    modalContentList.innerHTML = html;
  }

  btnClearHistory.addEventListener('click', () => {
    if (window.AndroidBridge && window.AndroidBridge.clearHistory) {
      window.AndroidBridge.clearHistory();
      loadHistoryModalData();
    }
  });

  btnRevokeAllKeys.addEventListener('click', () => {
    if (confirm('Deseja realmente revogar TODAS as autorizações ADB do dispositivo? Conexões ativas serão desconectadas.')) {
      if (window.AndroidBridge && window.AndroidBridge.clearAllKeys) {
        window.AndroidBridge.clearAllKeys();
        loadHistoryModalData();
        fetchActiveDevices();
      }
    }
  });

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Sincronização inicial e recarga sob demanda
  window.syncRecentCommands = function () {
    if (window.AndroidBridge && window.AndroidBridge.getRecentCommands) {
      try {
        const raw = window.AndroidBridge.getRecentCommands();
        const list = JSON.parse(raw);
        if (list && list.length > 0) {
          list.forEach((event) => {
            window.onAdbCommandReceived(event);
          });
        }
      } catch (e) {
        console.error('Erro ao sincronizar comandos', e);
      }
    }
  };

  fetchAdbStatus();
  fetchActiveDevices();
  window.syncRecentCommands();

  // Ciclo relaxado para monitorar dispositivos conectados sem sobrecarregar a UI
  setInterval(() => {
    fetchAdbStatus();
    fetchActiveDevices();
  }, 2000);

  // Escuta insets para atualizar safe area
  window.addEventListener('safe_insets_updated', (e) => {
    if (e.detail) {
      document.documentElement.style.setProperty('--safe-top', `${e.detail.top}px`);
      document.documentElement.style.setProperty('--safe-bottom', `${e.detail.bottom}px`);
    }
  });

})();
