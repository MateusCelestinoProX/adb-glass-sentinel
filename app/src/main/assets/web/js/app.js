/**
 * ADB GLASS SENTINEL — Motor de Interface Reativa & Bridge
 * Design inspirado no Pomodoro Clock do Personal OS
 */

(function () {
  'use strict';

  let isPaused = false;
  let isWirelessOn = true;
  let activeShader = 'cyber_matrix';

  // Elementos do DOM
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
  const terminalViewport = document.getElementById('terminal-viewport');
  const terminalEmptyMsg = document.getElementById('terminal-empty-msg');
  const btnTermPause = document.getElementById('btn-term-pause');
  const btnTermClear = document.getElementById('btn-term-clear');
  const historyModalOverlay = document.getElementById('history-modal-overlay');
  const btnModalClose = document.getElementById('btn-modal-close');
  const dockBtnHistory = document.getElementById('dock-btn-history');
  const modalContentList = document.getElementById('modal-content-list');
  const btnClearHistory = document.getElementById('btn-clear-history');
  const btnRevokeAllKeys = document.getElementById('btn-revoke-all-keys');
  const shaderButtons = document.querySelectorAll('.dock-pill-btn[data-shader]');

  // 1. Inicializar Shaders WebGL com retry
  function setupShader() {
    const ctn = document.getElementById('bg-webgl-container');
    if (ctn && window.initShader) {
      window.initShader(ctn, activeShader);
    } else {
      setTimeout(setupShader, 100);
    }
  }
  setupShader();

  // Alternar Shaders
  shaderButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const shader = btn.dataset.shader;
      if (shader && shader !== activeShader) {
        shaderButtons.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        activeShader = shader;
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

  // 2. Sincronização de Status do ADB
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

  // 3. Atualização dos Dispositivos Conectados (IP Mandatório)
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
          <div class="host-status-desc">Aguardando handshake na porta 5555 / USB...</div>
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

  // 4. Recebimento de Comandos Shell em Tempo Real (Terminal Verde Fósforo)
  window.onAdbCommandReceived = function (event) {
    if (isPaused) return;

    if (terminalEmptyMsg) {
      terminalEmptyMsg.style.display = 'none';
    }

    const row = document.createElement('div');
    row.className = 'terminal-log-row';

    const privClass = event.isPrivileged ? ' privileged' : '';
    const badgeText = event.clientIp || '127.0.0.1';

    row.innerHTML = `
      <div class="log-meta-line">
        <span class="log-time">${escapeHtml(event.timestamp)}</span>
        <span class="log-ip-badge">IP: ${escapeHtml(badgeText)}</span>
        <span>[${escapeHtml(event.serviceType)}]</span>
      </div>
      <div class="log-cmd-line${privClass}">$ ${escapeHtml(event.command)}</div>
    `;

    terminalViewport.insertBefore(row, terminalViewport.firstChild);

    // Limita o número de linhas no DOM para manter 120fps fluido
    while (terminalViewport.children.length > 80) {
      terminalViewport.removeChild(terminalViewport.lastChild);
    }
  };

  // 5. Controles do Terminal
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
    terminalViewport.innerHTML = `
      <div class="terminal-empty-msg" id="terminal-empty-msg">
        &gt; Terminal limpo. Escutando novos comandos shell...
      </div>
    `;
    if (window.AndroidBridge && window.AndroidBridge.vibrate) {
      window.AndroidBridge.vibrate(20);
    }
  });

  // 6. Toggle do Wireless ADB
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

  // 7. Copiar Endpoint
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

  // 8. Ações de Autorizar / Derrubar Dispositivo
  window.onAuthDeviceClick = function (ip) {
    if (window.AndroidBridge && window.AndroidBridge.allowDebugging) {
      window.AndroidBridge.allowDebugging(true, ip);
      alert(`Dispositivo com IP ${ip} autorizado permanentemente no sistema.`);
    }
  };

  window.onDenyDeviceClick = function (ip) {
    if (window.AndroidBridge && window.AndroidBridge.denyDebugging) {
      window.AndroidBridge.denyDebugging();
      setTimeout(fetchActiveDevices, 500);
    }
  };

  // 9. Modal de Histórico & Chaves
  dockBtnHistory.addEventListener('click', () => {
    loadHistoryModalData();
    historyModalOverlay.classList.add('open');
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

    // Seção de Chaves do SO
    html += `<div style="font-size: 12px; font-weight: 700; color: var(--accent-green); margin-top: 4px;">CHAVES AUTORIZADAS NO SO (${keysList.length})</div>`;
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

    // Seção de Histórico de Sessões
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

  // 10. Polling inicial e periódico (1.5s)
  function loadInitialCommands() {
    if (window.AndroidBridge && window.AndroidBridge.getRecentCommands) {
      try {
        const raw = window.AndroidBridge.getRecentCommands();
        const list = JSON.parse(raw);
        if (list && list.length > 0) {
          if (terminalEmptyMsg) terminalEmptyMsg.style.display = 'none';
          list.slice().reverse().forEach((event) => {
            window.onAdbCommandReceived(event);
          });
        }
      } catch (e) {
        console.error('Erro ao ler recent commands', e);
      }
    }
  }

  fetchAdbStatus();
  fetchActiveDevices();
  loadInitialCommands();
  setInterval(() => {
    fetchAdbStatus();
    fetchActiveDevices();
  }, 1500);

  // Escuta insets para atualizar safe area
  window.addEventListener('safe_insets_updated', (e) => {
    if (e.detail) {
      document.documentElement.style.setProperty('--safe-top', `${e.detail.top}px`);
      document.documentElement.style.setProperty('--safe-bottom', `${e.detail.bottom}px`);
    }
  });

})();
