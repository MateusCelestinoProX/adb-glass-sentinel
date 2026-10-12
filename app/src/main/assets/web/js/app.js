/**
 * ADB GLASS SENTINEL — Motor de Interface Reativa & Bridge (v2.0)
 * Design inspirado no Pomodoro Clock do Personal OS
 * Terminal Dinâmico Sincronizado com a Cor Principal • Data & Hora Intuitiva em Tempo Real
 */

(function () {
  'use strict';

  let isPaused = false;
  let isWirelessOn = true;
  let lastToggleLocalTime = 0;
  let lastCommandEpochMs = 0;
  let lastCommandTimeStr = '';

  let activeShader = localStorage.getItem('adb_sentinel_shader') || 'strands';
  let activeAccent = localStorage.getItem('adb_sentinel_accent_color') || '#00ff66';

  // Elementos da Interface Geral
  const toggleDialBtn = document.getElementById('toggle-dial-btn');
  const dialProgressRing = document.getElementById('dial-progress-ring');
  const dialIconEmoji = document.getElementById('dial-icon-emoji');
  const dialStateLabel = document.getElementById('dial-state-label');
  const dialSubHint = document.getElementById('dial-sub-hint');
  const headerStatusPill = document.getElementById('header-status-pill');
  const headerStatusDot = document.getElementById('header-status-dot');
  const headerStatusText = document.getElementById('header-status-text');
  const endpointPill = document.getElementById('endpoint-pill');
  const endpointIpLabel = document.getElementById('endpoint-ip-label');
  const endpointPortLabel = document.getElementById('endpoint-port-label');
  const activeCountBadge = document.getElementById('active-count-badge');
  const activeDevicesContainer = document.getElementById('active-devices-container');

  // Elementos do Terminal de Comandos (Card & Fullscreen Ultra Light Glass)
  const terminalViewport = document.getElementById('terminal-viewport');
  const terminalLiveBadge = document.getElementById('terminal-live-badge');
  const termLiveDate = document.getElementById('term-live-date');
  const termLiveClock = document.getElementById('term-live-clock');
  const termLastCmdTime = document.getElementById('term-last-cmd-time');
  const btnTermPause = document.getElementById('btn-term-pause');
  const btnTermClear = document.getElementById('btn-term-clear');
  const btnTermFullscreen = document.getElementById('btn-term-fullscreen');

  const termFsOverlay = document.getElementById('terminal-fullscreen-overlay');
  const termFsViewport = document.getElementById('terminal-fullscreen-viewport');
  const termFsLiveBadge = document.getElementById('term-fs-live-badge');
  const termFsLiveDatetime = document.getElementById('term-fs-live-datetime');
  const termFsAuditState = document.getElementById('term-fs-audit-state');
  const btnTermFsClose = document.getElementById('btn-term-fs-close');
  const btnTermFsPause = document.getElementById('btn-term-fs-pause');
  const btnTermFsClear = document.getElementById('btn-term-fs-clear');
  const btnTermFsCopyAll = document.getElementById('btn-term-fs-copy-all');
  const termFsCounter = document.getElementById('term-fs-counter');
  const termFsHostIp = document.getElementById('term-fs-host-ip');
  const termFsSearchInput = document.getElementById('term-fs-search-input');
  const btnTermFsSearchClear = document.getElementById('btn-term-fs-search-clear');
  const termFilterChips = document.querySelectorAll('.term-filter-chip');

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
  // 1. GESTÃO DE CORES DE ACENTO DA INTERFACE & TERMINAL (100% Sincronizados)
  // =========================================================================
  function hexToRgb(hex) {
    hex = (hex || '#00ff66').replace('#', '');
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

    // Variáveis principais da interface
    root.style.setProperty('--accent-primary', hex);
    root.style.setProperty('--accent-primary-glow', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.45)`);
    root.style.setProperty('--accent-primary-soft', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.14)`);
    root.style.setProperty('--accent-primary-border', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.38)`);

    // Variáveis do Shell Glass Terminal sincronizadas com a cor principal do sistema
    root.style.setProperty('--terminal-green', hex);
    root.style.setProperty('--terminal-green-glow', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.45)`);
    root.style.setProperty('--terminal-green-dim', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.14)`);
    root.style.setProperty('--terminal-green-border', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.38)`);
    root.style.setProperty('--terminal-accent-bg', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.08)`);
    root.style.setProperty('--terminal-row-bg', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.045)`);

    // Atualiza controles visuais do modal
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
      const bColor = (btn.dataset.color || '').toLowerCase();
      if (bColor === hex.toLowerCase()) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }

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

  if (customColorInput) {
    customColorInput.addEventListener('input', (e) => {
      applyAccentColor(e.target.value);
    });
  }

  applyAccentColor(activeAccent);

  // =========================================================================
  // 2. SISTEMA DE DATA E HORA INTUITIVO DO SHELL GLASS TERMINAL
  // =========================================================================
  const WEEKDAYS_PT = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];

  function pad2(n) {
    return String(n).padStart(2, '0');
  }

  function formatRelativeTime(epochMs) {
    if (!epochMs) return 'agora';
    const diffSec = Math.max(0, Math.floor((Date.now() - epochMs) / 1000));
    if (diffSec < 3) return 'agora';
    if (diffSec < 60) return `há ${diffSec}s`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `há ${diffMin}m`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `há ${diffHours}h`;
    const diffDays = Math.floor(diffHours / 24);
    return `há ${diffDays}d`;
  }

  function parseEventDateTime(event) {
    if (event.dateFormatted && event.timeFormatted) {
      return {
        dateLabel: event.dateFormatted,
        timeLabel: event.timeFormatted,
        millisLabel: event.millisFormatted || '.000',
        epochMs: event.epochMs || Date.now()
      };
    }

    const raw = (event.timestamp || '').trim();
    // Formato esperado do logcat: "MM-dd HH:mm:ss.SSS" (ex: "10-08 21:24:16.413")
    const parts = raw.split(/\s+/);
    if (parts.length >= 2 && parts[0].includes('-')) {
      const md = parts[0].split('-');
      const month = parseInt(md[0], 10) || 1;
      const day = parseInt(md[1], 10) || 1;

      const timeParts = parts[1].split('.');
      const timeMain = timeParts[0] || '00:00:00';
      const millis = timeParts[1] ? `.${timeParts[1]}` : '.000';

      const hms = timeMain.split(':');
      const now = new Date();
      const cmdDate = new Date(
        now.getFullYear(),
        month - 1,
        day,
        parseInt(hms[0], 10) || 0,
        parseInt(hms[1], 10) || 0,
        parseInt(hms[2], 10) || 0,
        parseInt(timeParts[1] || '0', 10) || 0
      );

      const dayStr = pad2(day);
      const monthStr = pad2(month);
      const isToday = now.getDate() === day && (now.getMonth() + 1) === month;

      const yest = new Date(now);
      yest.setDate(now.getDate() - 1);
      const isYesterday = yest.getDate() === day && (yest.getMonth() + 1) === month;

      let dateLabel = `${dayStr}/${monthStr}/${now.getFullYear()}`;
      if (isToday) dateLabel = `Hoje, ${dayStr}/${monthStr}`;
      else if (isYesterday) dateLabel = `Ontem, ${dayStr}/${monthStr}`;

      return {
        dateLabel,
        timeLabel: timeMain,
        millisLabel: millis,
        epochMs: event.epochMs || cmdDate.getTime()
      };
    }

    const now = new Date();
    return {
      dateLabel: `Hoje, ${pad2(now.getDate())}/${pad2(now.getMonth() + 1)}`,
      timeLabel: `${pad2(now.getHours())}:${pad2(now.getMinutes())}:${pad2(now.getSeconds())}`,
      millisLabel: `.${String(now.getMilliseconds()).padStart(3, '0')}`,
      epochMs: Date.now()
    };
  }

  function updateTerminalLiveClock() {
    const now = new Date();
    const wk = WEEKDAYS_PT[now.getDay()];
    const dayStr = pad2(now.getDate());
    const monthStr = pad2(now.getMonth() + 1);
    const yearStr = now.getFullYear();
    const clockStr = `${pad2(now.getHours())}:${pad2(now.getMinutes())}:${pad2(now.getSeconds())}`;

    if (termLiveDate) {
      termLiveDate.textContent = `${wk}, ${dayStr}/${monthStr}/${yearStr}`;
    }
    if (termLiveClock) {
      termLiveClock.textContent = clockStr;
    }
    if (termFsLiveDatetime) {
      termFsLiveDatetime.textContent = `📅 ${wk}, ${dayStr}/${monthStr}/${yearStr} • 🕒 ${clockStr}`;
    }
    if (termLastCmdTime && lastCommandEpochMs > 0) {
      termLastCmdTime.textContent = `⚡ Último: ${lastCommandTimeStr} (${formatRelativeTime(lastCommandEpochMs)})`;
    }
  }

  function updateRelativeTimestampsInDom() {
    const nodes = document.querySelectorAll('.log-rel-time[data-epoch]');
    nodes.forEach((el) => {
      const ep = parseInt(el.dataset.epoch, 10);
      if (ep > 0) {
        el.textContent = formatRelativeTime(ep);
      }
    });
  }

  updateTerminalLiveClock();
  setInterval(updateTerminalLiveClock, 1000);
  setInterval(updateRelativeTimestampsInDom, 3000);

  // =========================================================================
  // 3. GESTÃO DOS 34 SHADERS WEBGL CANÔNICOS DO PERSONAL OS
  // =========================================================================
  const CANONICAL_SHADERS = [
    'softaurora', 'particles', 'ghostfibers', 'plasmawave', 'strands',
    'siderays', 'beams', 'floatinglines', 'silk', 'radar',
    'ripplegrid', 'pixelblast', 'magicrings', 'gridscan', 'liquidchrome',
    'linewaves', 'ferrofluid', 'dither', 'darkveil', 'webthreads',
    'topography', 'balatro', 'faultyterminal', 'morphslider', 'antigravity',
    'aurora', 'letterglitch', 'plasma', 'liquidether', 'orb',
    'prism', 'prismaticburst', 'lightning', 'evileye'
  ];

  function updateShaderCardsUi(selectedShader) {
    if (selectedShader === 'soft_aurora') selectedShader = 'softaurora';
    if (selectedShader === 'dark_veil') selectedShader = 'darkveil';
    shaderOptionCards.forEach((card) => {
      let type = card.dataset.shader;
      if (type === 'soft_aurora') type = 'softaurora';
      if (type === 'dark_veil') type = 'darkveil';
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

        if (typeof window.renderShader === 'function') {
          window.renderShader(activeShader);
        } else {
          const ctn = document.getElementById('bg-webgl-container');
          if (ctn && window.initShader) {
            window.initShader(ctn, activeShader);
          }
        }

        if (window.AndroidBridge && window.AndroidBridge.vibrate) {
          window.AndroidBridge.vibrate(20);
        }
      }
    });
  });

  updateShaderCardsUi(activeShader);

  // =========================================================================
  // 4. WIDGET DE BACKGROUND & VISUAL (Abertura / Fechamento)
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
  // 5. TERMINAL ADB EM TEMPO REAL (Card & Fullscreen Ultra Light Glass)
  // =========================================================================
  const seenCommandIds = new Set();
  const allReceivedCommands = [];
  let activeFilter = 'all';
  let activeSearchTerm = '';

  function doesCommandMatchFilter(event) {
    const svc = (event.serviceType || 'SHELL').toUpperCase();
    if (activeFilter === 'shell' && !svc.startsWith('SHELL')) {
      return false;
    }
    if (activeFilter === 'priv' && !event.isPrivileged) {
      return false;
    }
    if (activeSearchTerm) {
      const term = activeSearchTerm.toLowerCase();
      const cmdMatch = (event.command || '').toLowerCase().includes(term);
      const ipMatch = (event.clientIp || '').toLowerCase().includes(term);
      const dateMatch = (event.dateFormatted || event.timestamp || '').toLowerCase().includes(term);
      if (!cmdMatch && !ipMatch && !dateMatch) return false;
    }
    return true;
  }

  function createLogCardElement(event, isFullscreen = false) {
    const row = document.createElement('div');
    const privClass = event.isPrivileged ? ' privileged' : '';
    const badgeText = event.clientIp || '192.168.15.23';
    const dt = parseEventDateTime(event);
    const relText = formatRelativeTime(dt.epochMs);
    const cmdKey = event.id || `${event.timestamp}_${event.command}`;

    if (isFullscreen) {
      row.className = `term-fs-log-row${privClass}`;
      row.dataset.id = cmdKey;
      row.dataset.service = event.serviceType || 'SHELL';
      row.dataset.privileged = event.isPrivileged ? 'true' : 'false';
      row.innerHTML = `
        <div class="term-fs-log-meta">
          <span class="log-time-pill">🕒 <b>${escapeHtml(dt.timeLabel)}</b><small>${escapeHtml(dt.millisLabel)}</small></span>
          <span class="log-date-pill">📅 ${escapeHtml(dt.dateLabel)}</span>
          <span class="log-rel-time" data-epoch="${dt.epochMs}">⏱️ ${escapeHtml(relText)}</span>
          <span class="log-ip-badge">IP: ${escapeHtml(badgeText)}</span>
          <span class="log-service-tag">[${escapeHtml(event.serviceType || 'SHELL')}]</span>
          ${event.isPrivileged ? '<span class="host-type-tag" style="color: var(--accent-amber); border-color: var(--accent-amber);">PRIVILEGIADO</span>' : ''}
        </div>
        <div class="term-fs-log-cmd${privClass}">$ ${escapeHtml(event.command)}</div>
      `;
    } else {
      row.className = `terminal-log-row${privClass}`;
      row.dataset.id = cmdKey;
      row.innerHTML = `
        <div class="log-meta-line">
          <span class="log-time-pill">🕒 <b>${escapeHtml(dt.timeLabel)}</b><small>${escapeHtml(dt.millisLabel)}</small></span>
          <span class="log-date-pill">📅 ${escapeHtml(dt.dateLabel)}</span>
          <span class="log-rel-time" data-epoch="${dt.epochMs}">${escapeHtml(relText)}</span>
          <span class="log-ip-badge">IP: ${escapeHtml(badgeText)}</span>
          <span class="log-service-tag">[${escapeHtml(event.serviceType || 'SHELL')}]</span>
        </div>
        <div class="log-cmd-line${privClass}">$ ${escapeHtml(event.command)}</div>
      `;
    }
    return row;
  }

  function pulseLiveBadge() {
    if (terminalLiveBadge) {
      terminalLiveBadge.classList.add('flash');
      setTimeout(() => terminalLiveBadge.classList.remove('flash'), 260);
    }
    if (termFsLiveBadge) {
      termFsLiveBadge.classList.add('flash');
      setTimeout(() => termFsLiveBadge.classList.remove('flash'), 260);
    }
  }

  window.onAdbCommandReceived = function (event) {
    if (isPaused) return;
    if (!event || !event.command) return;

    const cmdKey = event.id || `${event.timestamp}_${event.command}`;
    if (seenCommandIds.has(cmdKey)) return;
    seenCommandIds.add(cmdKey);

    const dt = parseEventDateTime(event);
    event.dateFormatted = dt.dateLabel;
    event.timeFormatted = dt.timeLabel;
    event.millisFormatted = dt.millisLabel;
    event.epochMs = dt.epochMs;

    allReceivedCommands.unshift(event);

    if (dt.epochMs >= lastCommandEpochMs) {
      lastCommandEpochMs = dt.epochMs;
      lastCommandTimeStr = dt.timeLabel;
      if (termLastCmdTime) {
        termLastCmdTime.textContent = `⚡ Último: ${lastCommandTimeStr} (${formatRelativeTime(lastCommandEpochMs)})`;
      }
    }

    // Remove placeholders vazios se presentes
    const emptyMini = document.getElementById('terminal-empty-msg');
    if (emptyMini) {
      emptyMini.style.display = 'none';
    }
    const emptyFs = document.getElementById('terminal-fs-empty-msg');
    if (emptyFs) {
      emptyFs.style.display = 'none';
    }

    // 1. Inserção no Viewport Padrão (Card)
    const rowMini = createLogCardElement(event, false);
    terminalViewport.prepend(rowMini);

    while (terminalViewport.children.length > 85) {
      const last = terminalViewport.lastElementChild;
      if (!last) break;
      if (last.id === 'terminal-empty-msg') break;
      terminalViewport.removeChild(last);
    }

    // 2. Inserção no Viewport Fullscreen (Ultra Light Glass)
    if (termFsViewport) {
      const rowFs = createLogCardElement(event, true);
      if (!doesCommandMatchFilter(event)) {
        rowFs.style.display = 'none';
      }
      termFsViewport.prepend(rowFs);

      while (termFsViewport.children.length > 160) {
        const lastFs = termFsViewport.lastElementChild;
        if (!lastFs || lastFs.id === 'terminal-fs-empty-msg') break;
        termFsViewport.removeChild(lastFs);
      }
    }

    pulseLiveBadge();

    if (termFsCounter) {
      termFsCounter.textContent = `${allReceivedCommands.length} COMANDOS`;
    }
    if (event.clientIp && termFsHostIp) {
      termFsHostIp.textContent = event.clientIp;
    }
  };

  // Funções de Controle de Tela Cheia
  function openFullscreenTerminal() {
    if (!termFsOverlay) return;
    document.body.style.overflow = 'hidden';
    if (termFsViewport) {
      termFsViewport.scrollTop = 0;
    }
    termFsOverlay.classList.add('open');
    if (window.AndroidBridge && window.AndroidBridge.vibrate) {
      window.AndroidBridge.vibrate(15);
    }
  }

  function closeFullscreenTerminal() {
    if (!termFsOverlay) return;
    document.body.style.overflow = '';
    termFsOverlay.classList.remove('open');
    if (window.AndroidBridge && window.AndroidBridge.vibrate) {
      window.AndroidBridge.vibrate(10);
    }
  }

  if (btnTermFullscreen) {
    btnTermFullscreen.addEventListener('click', openFullscreenTerminal);
  }

  if (btnTermFsClose) {
    btnTermFsClose.addEventListener('click', closeFullscreenTerminal);
  }

  // Toggle de Pausa sincronizado entre Card e Fullscreen
  function togglePauseState() {
    isPaused = !isPaused;
    const txt = isPaused ? 'RETOMAR' : 'PAUSAR';
    btnTermPause.textContent = txt;
    if (btnTermFsPause) btnTermFsPause.textContent = txt;

    const amber = 'var(--accent-amber)';
    if (isPaused) {
      btnTermPause.style.color = amber;
      btnTermPause.style.borderColor = amber;
      if (btnTermFsPause) {
        btnTermFsPause.style.color = amber;
        btnTermFsPause.style.borderColor = amber;
      }
    } else {
      btnTermPause.style.color = '';
      btnTermPause.style.borderColor = '';
      if (btnTermFsPause) {
        btnTermFsPause.style.color = '';
        btnTermFsPause.style.borderColor = '';
      }
      window.syncRecentCommands();
    }

    if (window.AndroidBridge && window.AndroidBridge.vibrate) {
      window.AndroidBridge.vibrate(15);
    }
  }

  btnTermPause.addEventListener('click', togglePauseState);
  if (btnTermFsPause) {
    btnTermFsPause.addEventListener('click', togglePauseState);
  }

  // Limpeza de logs sincronizada
  function clearLogsState() {
    seenCommandIds.clear();
    allReceivedCommands.length = 0;
    lastCommandEpochMs = 0;
    lastCommandTimeStr = '';

    if (termLastCmdTime) {
      termLastCmdTime.textContent = 'Terminal limpo • Escutando...';
    }

    terminalViewport.innerHTML = `
      <div class="terminal-empty-msg" id="terminal-empty-msg">
        &gt; Terminal limpo. Escutando novos comandos shell em tempo real...<br>
        &gt; Data, hora exata e IP de origem sincronizados com a cor principal.
      </div>
    `;

    if (termFsViewport) {
      termFsViewport.innerHTML = `
        <div class="terminal-empty-msg" id="terminal-fs-empty-msg">
          &gt; Modo Fullscreen Ultra Light Glass ativo.<br>
          &gt; Escutando comandos shell recebidos pelo adbd em tempo real...<br>
          &gt; Background WebGL visível e elegante com blur de fundo.
        </div>
      `;
    }

    if (termFsCounter) {
      termFsCounter.textContent = '0 COMANDOS';
    }

    if (window.AndroidBridge && window.AndroidBridge.vibrate) {
      window.AndroidBridge.vibrate(20);
    }
  }

  btnTermClear.addEventListener('click', clearLogsState);
  if (btnTermFsClear) {
    btnTermFsClear.addEventListener('click', clearLogsState);
  }

  // Copiar todos os logs para a área de transferência
  if (btnTermFsCopyAll) {
    btnTermFsCopyAll.addEventListener('click', () => {
      if (allReceivedCommands.length === 0) return;
      const text = allReceivedCommands.map((c) =>
        `[${c.dateFormatted || ''} ${c.timeFormatted || c.timestamp}${c.millisFormatted || ''}] IP:${c.clientIp || '192.168.15.23'} [${c.serviceType || 'SHELL'}] $ ${c.command}`
      ).join('\n');

      if (window.AndroidBridge && window.AndroidBridge.copyToClipboard) {
        window.AndroidBridge.copyToClipboard(text);
      } else if (navigator.clipboard) {
        navigator.clipboard.writeText(text);
      }

      const origText = btnTermFsCopyAll.textContent;
      btnTermFsCopyAll.textContent = 'COPIADO!';
      btnTermFsCopyAll.style.color = 'var(--accent-primary)';
      btnTermFsCopyAll.style.borderColor = 'var(--accent-primary)';
      setTimeout(() => {
        btnTermFsCopyAll.textContent = origText;
        btnTermFsCopyAll.style.color = '';
        btnTermFsCopyAll.style.borderColor = '';
      }, 1500);
    });
  }

  // Filtros rápidos por Chip
  termFilterChips.forEach((chip) => {
    chip.addEventListener('click', () => {
      termFilterChips.forEach((c) => c.classList.remove('active'));
      chip.classList.add('active');
      activeFilter = chip.dataset.filter || 'all';
      applyFullscreenFilters();
      if (window.AndroidBridge && window.AndroidBridge.vibrate) {
        window.AndroidBridge.vibrate(10);
      }
    });
  });

  // Busca em tempo real no Fullscreen
  if (termFsSearchInput) {
    termFsSearchInput.addEventListener('input', (e) => {
      activeSearchTerm = (e.target.value || '').trim();
      if (btnTermFsSearchClear) {
        btnTermFsSearchClear.style.display = activeSearchTerm ? 'block' : 'none';
      }
      applyFullscreenFilters();
    });
  }

  if (btnTermFsSearchClear) {
    btnTermFsSearchClear.addEventListener('click', () => {
      if (termFsSearchInput) termFsSearchInput.value = '';
      activeSearchTerm = '';
      btnTermFsSearchClear.style.display = 'none';
      applyFullscreenFilters();
    });
  }

  function applyFullscreenFilters() {
    if (!termFsViewport) return;
    const rows = termFsViewport.querySelectorAll('.term-fs-log-row');
    rows.forEach((row) => {
      const service = (row.dataset.service || 'SHELL').toUpperCase();
      const isPriv = row.dataset.privileged === 'true';
      const text = row.textContent.toLowerCase();

      let show = true;
      if (activeFilter === 'shell' && !service.startsWith('SHELL')) show = false;
      if (activeFilter === 'priv' && !isPriv) show = false;
      if (activeSearchTerm && !text.includes(activeSearchTerm.toLowerCase())) show = false;

      row.style.display = show ? 'flex' : 'none';
    });
  }

  // Handler nativo de voltar (Android Back)
  window.handleAndroidBack = function () {
    if (termFsOverlay && termFsOverlay.classList.contains('open')) {
      closeFullscreenTerminal();
      return true;
    }
    if (bgWidgetOverlay && bgWidgetOverlay.classList.contains('open')) {
      bgWidgetOverlay.classList.remove('open');
      return true;
    }
    if (historyModalOverlay && historyModalOverlay.classList.contains('open')) {
      historyModalOverlay.classList.remove('open');
      return true;
    }
    return false;
  };

  // =========================================================================
  // 6. STATUS DO SISTEMA ADB & BOTÃO PRINCIPAL (ATIVAR / PARAR ADB)
  // =========================================================================
  function updateUiWithStatus(status) {
    isWirelessOn = Boolean(status.wirelessEnabled);

    if (isWirelessOn) {
      dialProgressRing.classList.remove('inactive');
      dialIconEmoji.textContent = '⚡';
      dialStateLabel.textContent = 'WIRELESS ON';
      dialStateLabel.classList.remove('inactive');
      if (dialSubHint) dialSubHint.textContent = 'TOQUE P/ PARAR';

      const currentPort = status.port || 5555;
      if (headerStatusPill) headerStatusPill.classList.remove('inactive');
      headerStatusDot.classList.remove('inactive');
      headerStatusText.textContent = `PORTA ${currentPort} ATIVA`;

      if (endpointPortLabel) {
        endpointPortLabel.textContent = `:${currentPort}`;
        endpointPortLabel.classList.remove('inactive');
      }
      if (termFsAuditState) {
        termFsAuditState.textContent = 'AUDITANDO SHELL';
        termFsAuditState.style.color = 'var(--accent-primary)';
      }
    } else {
      dialProgressRing.classList.add('inactive');
      dialIconEmoji.textContent = '🔒';
      dialStateLabel.textContent = 'ADB PARADO';
      dialStateLabel.classList.add('inactive');
      if (dialSubHint) dialSubHint.textContent = 'TOQUE P/ ATIVAR';

      if (headerStatusPill) headerStatusPill.classList.add('inactive');
      headerStatusDot.classList.add('inactive');
      headerStatusText.textContent = 'ADB DESATIVADO';

      if (endpointPortLabel) {
        endpointPortLabel.textContent = ':OFF';
        endpointPortLabel.classList.add('inactive');
      }
      if (termFsAuditState) {
        termFsAuditState.textContent = 'SISTEMA ADB PARADO';
        termFsAuditState.style.color = 'var(--accent-red)';
      }
    }

    if (status.wifiIp) {
      endpointIpLabel.textContent = status.wifiIp;
    }
  }

  function fetchAdbStatus() {
    // Respeita janela otimista de 2 segundos após clique manual no botão principal
    if (Date.now() - lastToggleLocalTime < 2000) {
      return;
    }
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
    if (!isWirelessOn) {
      renderActiveDevices([]);
      return;
    }
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
    const established = (devices || []).filter((d) => d.state === 'ESTABLISHED');
    activeCountBadge.textContent = `${established.length} ATIVO${established.length === 1 ? '' : 'S'}`;

    if (!isWirelessOn) {
      activeDevicesContainer.innerHTML = `
        <div class="active-host-box" style="border-color: rgba(255, 16, 55, 0.35);">
          <div class="host-top-row">
            <span style="color: var(--accent-red); font-size: 12px; font-weight: 700; font-family: var(--font-mono);">🔒 Daemon ADB Parado</span>
          </div>
          <div class="host-status-desc">Porta 5555 fechada. Toque no botão principal acima para reativar o sistema ADB.</div>
        </div>
      `;
      return;
    }

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
            <span class="host-type-tag">${escapeHtml(dev.type)}</span>
          </div>
          <div class="host-bottom-row">
            <span class="host-status-desc">Socket: ${escapeHtml(dev.state)} • Conectado</span>
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

  // Botão Principal: Ativar / Parar o Sistema ADB com Resposta Instantânea
  toggleDialBtn.addEventListener('click', () => {
    const newState = !isWirelessOn;
    lastToggleLocalTime = Date.now();

    // 1. Atualização Otimista Imediata na Interface
    updateUiWithStatus({
      wirelessEnabled: newState,
      wifiIp: endpointIpLabel ? endpointIpLabel.textContent : '192.168.15.22'
    });

    if (!newState) {
      renderActiveDevices([]);
    }

    // 2. Aciona o Backend Android (Settings.Global.ADB_ENABLED + adb_wifi_enabled + Daemon Control)
    if (window.AndroidBridge && window.AndroidBridge.toggleWirelessAdb) {
      window.AndroidBridge.toggleWirelessAdb(newState);
      setTimeout(() => {
        lastToggleLocalTime = 0;
        fetchAdbStatus();
        fetchActiveDevices();
      }, 1200);
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
      setTimeout(fetchActiveDevices, 400);
    }
  };

  // =========================================================================
  // 7. MODAL DE HISTÓRICO & CHAVES
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
        const dtObj = new Date(h.timestamp);
        const dStr = `${pad2(dtObj.getDate())}/${pad2(dtObj.getMonth() + 1)} às ${dtObj.toLocaleTimeString()}`;
        html += `
          <div class="history-item-row">
            <div>
              <div class="history-ip">${escapeHtml(h.remoteIp)}:${h.remotePort}</div>
              <div class="history-meta">📅 ${dStr} • Tipo: ${escapeHtml(h.type)}</div>
            </div>
            <span class="host-type-tag">${escapeHtml(h.state)}</span>
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

  // Sincronização em tempo real mantendo a ordem cronológica exata (mais recente sempre no topo)
  window.syncRecentCommands = function () {
    if (isPaused) return;
    if (window.AndroidBridge && window.AndroidBridge.getRecentCommands) {
      try {
        const raw = window.AndroidBridge.getRecentCommands();
        const list = JSON.parse(raw);
        if (list && list.length > 0) {
          // A lista vem do backend com índice 0 = mais recente e último índice = mais antigo.
          // Como onAdbCommandReceived usa prepend(), iteramos do mais antigo para o mais recente!
          for (let i = list.length - 1; i >= 0; i--) {
            window.onAdbCommandReceived(list[i]);
          }
        }
      } catch (e) {
        console.error('Erro ao sincronizar comandos', e);
      }
    }
  };

  fetchAdbStatus();
  fetchActiveDevices();
  window.syncRecentCommands();

  // Loop de sincronização contínua em tempo real (0ms de custo via cache em RAM no Kotlin)
  setInterval(() => {
    window.syncRecentCommands();
  }, 900);

  // Ciclo para status de dispositivos e conexões
  setInterval(() => {
    fetchAdbStatus();
    fetchActiveDevices();
  }, 1800);

  // Escuta insets para atualizar safe area
  window.addEventListener('safe_insets_updated', (e) => {
    if (e.detail) {
      document.documentElement.style.setProperty('--safe-top', `${e.detail.top}px`);
      document.documentElement.style.setProperty('--safe-bottom', `${e.detail.bottom}px`);
    }
  });

})();
