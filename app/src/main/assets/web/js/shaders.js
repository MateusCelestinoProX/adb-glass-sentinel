/**
 * ADB GLASS SENTINEL — Motor Nativo WebGL de Shaders de Alta Performance
 * Inspirado no Pomodoro Clock do Personal OS
 * 100% Autônomo (Zero Dependências Externas) • Suporte a WebGL 1 & WebGL 2
 */

(function () {
  'use strict';

  let currentGl = null;
  let currentProgram = null;
  let currentRaf = null;
  let currentCanvas = null;
  let activeShader = 'cyber_matrix';

  const VERTEX_SHADER_SRC = `
    attribute vec2 aPosition;
    void main() {
      gl_Position = vec4(aPosition, 0.0, 1.0);
    }
  `;

  // 1. CYBER MATRIX SHADER (Verde Fósforo Hacker)
  const MATRIX_FRAG_SRC = `
    precision highp float;
    uniform float uTime;
    uniform vec2 uResolution;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
    }

    void main() {
      vec2 uv = gl_FragCoord.xy / uResolution.xy;
      vec2 grid = vec2(42.0, 75.0);
      vec2 st = uv * grid;
      vec2 ipos = floor(st);

      float speed = 1.8 + hash(vec2(ipos.x, 0.0)) * 2.8;
      float drop = fract(ipos.y * 0.04 - uTime * speed * 0.12 + hash(vec2(ipos.x, 1.0)));

      float trail = pow(drop, 3.2);
      float head = pow(drop, 9.0);

      vec3 matrixGreen = vec3(0.0, 1.0, 0.42);
      vec3 headWhite = vec3(0.8, 1.0, 0.88);
      vec3 col = mix(matrixGreen, headWhite, head) * (trail * 1.4);

      // Fundo sutil com gradiente abissal
      col += vec3(0.01, 0.04, 0.02) * (1.0 - uv.y * 0.5);

      gl_FragColor = vec4(col, 1.0);
    }
  `;

  // 2. STRANDS NEON SHADER (Feixes Laser do Pomodoro)
  const STRANDS_FRAG_SRC = `
    precision highp float;
    uniform float uTime;
    uniform vec2 uResolution;

    void main() {
      vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution.xy) / uResolution.y;
      vec3 col = vec3(0.005, 0.01, 0.02);

      for (int i = 0; i < 7; i++) {
        float fi = float(i);
        float freq = 2.2 + fi * 0.35;
        float spd = 0.9 + fi * 0.4;
        float ph = fi * 1.5;

        float tt = uTime * 0.8;
        float y = sin(uv.x * freq + tt * spd + ph) * 0.25 
                + sin(uv.x * freq * 1.2 - tt * spd * 0.7 + ph * 1.3) * 0.15;

        float d = abs(uv.y - y);
        float g = 0.012 / (d + 0.012);
        g = g * g;

        vec3 strandCol = mix(vec3(0.0, 1.0, 0.4), vec3(0.0, 0.4, 0.9), fi / 6.0);
        col += strandCol * g * 0.65;
      }

      gl_FragColor = vec4(col, 1.0);
    }
  `;

  // 3. PLASMA WAVE SHADER
  const PLASMA_FRAG_SRC = `
    precision highp float;
    uniform float uTime;
    uniform vec2 uResolution;

    void main() {
      vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution.xy) / uResolution.y;
      float t = uTime * 0.45;

      float v = sin(uv.x * 4.0 + t);
      v += sin(uv.y * 4.0 + t * 0.8);
      v += sin((uv.x + uv.y) * 4.0 + t * 1.2);
      v += sin(length(uv) * 5.0 - t * 1.4);

      vec3 colA = vec3(0.0, 0.95, 0.45);
      vec3 colB = vec3(0.03, 0.1, 0.22);
      vec3 colC = vec3(0.0, 0.3, 0.18);

      vec3 col = mix(colB, colC, 0.5 + 0.5 * sin(v * 2.0));
      col += colA * pow(0.5 + 0.5 * sin(v * 3.1415), 3.5) * 0.9;

      gl_FragColor = vec4(col, 1.0);
    }
  `;

  // 4. DARK VEIL SHADER
  const VEIL_FRAG_SRC = `
    precision highp float;
    uniform float uTime;
    uniform vec2 uResolution;

    void main() {
      vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution.xy) / uResolution.y;
      float d = length(uv);
      float a = atan(uv.y, uv.x);

      float wave = sin(d * 9.0 - uTime * 0.7 + sin(a * 4.0) * 1.4);
      float rings = smoothstep(0.1, 0.9, wave * 0.5 + 0.5);

      vec3 col = mix(vec3(0.015, 0.025, 0.05), vec3(0.0, 0.35, 0.18), rings * 0.4);
      col += vec3(0.0, 1.0, 0.5) * pow(rings, 5.0) * 0.4;
      col *= smoothstep(1.3, 0.2, d);

      gl_FragColor = vec4(col, 1.0);
    }
  `;

  function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error('Erro compilando shader:', gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  function initShader(container, type = 'cyber_matrix') {
    if (!container) return;
    activeShader = type;

    // Limpar renderização anterior
    if (currentRaf) {
      cancelAnimationFrame(currentRaf);
      currentRaf = null;
    }
    if (currentCanvas && container.contains(currentCanvas)) {
      container.removeChild(currentCanvas);
      currentCanvas = null;
    }

    const canvas = document.createElement('canvas');
    canvas.style.position = 'absolute';
    canvas.style.inset = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';
    container.appendChild(canvas);
    currentCanvas = canvas;

    const gl = canvas.getContext('webgl2', { powerPreference: 'low-power', alpha: false }) ||
               canvas.getContext('webgl', { powerPreference: 'low-power', alpha: false });

    if (!gl) {
      console.error('WebGL não suportado no WebView');
      return;
    }
    currentGl = gl;

    let fragSrc = MATRIX_FRAG_SRC;
    if (type === 'strands') fragSrc = STRANDS_FRAG_SRC;
    else if (type === 'plasma') fragSrc = PLASMA_FRAG_SRC;
    else if (type === 'veil') fragSrc = VEIL_FRAG_SRC;

    const vs = createShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER_SRC);
    const fs = createShader(gl, gl.FRAGMENT_SHADER, fragSrc);
    if (!vs || !fs) return;

    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('Erro linkando programa WebGL:', gl.getProgramInfoLog(program));
      return;
    }
    currentProgram = program;

    // Triângulo de tela inteira (cobre [-1, 1] em clip space)
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    const positions = new Float32Array([
      -1, -1,
       3, -1,
      -1,  3
    ]);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

    const aPosLoc = gl.getAttribLocation(program, 'aPosition');
    gl.enableVertexAttribArray(aPosLoc);
    gl.vertexAttribPointer(aPosLoc, 2, gl.FLOAT, false, 0, 0);

    const uTimeLoc = gl.getUniformLocation(program, 'uTime');
    const uResLoc = gl.getUniformLocation(program, 'uResolution');

    const dpr = Math.min(window.devicePixelRatio || 1, 1.5) * 0.7; // DPR equilibrado

    function resize() {
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      gl.viewport(0, 0, canvas.width, canvas.height);
    }
    window.addEventListener('resize', resize, { passive: true });
    resize();

    const startTime = performance.now();

    function render(now) {
      if (!document.hidden) {
        const elapsed = (now - startTime) * 0.001;
        gl.useProgram(program);
        gl.uniform1f(uTimeLoc, elapsed);
        gl.uniform2f(uResLoc, canvas.width, canvas.height);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      }
      currentRaf = requestAnimationFrame(render);
    }
    currentRaf = requestAnimationFrame(render);
  }

  window.initShader = initShader;
  window.renderShader = (type) => {
    const ctn = document.getElementById('bg-webgl-container');
    if (ctn) initShader(ctn, type);
  };

  // Inicializa automaticamente no carregamento da janela
  document.addEventListener('DOMContentLoaded', () => {
    const ctn = document.getElementById('bg-webgl-container');
    if (ctn) initShader(ctn, activeShader);
  });
})();
