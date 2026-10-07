/**
 * ADB GLASS SENTINEL — Motor WebGL de Shaders de Alta Fidelidade
 * Portado diretamente do Personal OS (McpPersonalOs / Pomodoro Clock)
 * 5 Shaders Nativos Autênticos com Cores Ricas Originais (sem forçar verde)
 * Otimizado para Android WebView (DPR 1.0, baixo consumo de GPU)
 */

(function () {
  'use strict';

  let currentGl = null;
  let currentProgram = null;
  let currentRaf = null;
  let currentCanvas = null;
  let activeShader = localStorage.getItem('adb_sentinel_shader') || 'strands';

  const VERTEX_SHADER_SRC = `
    attribute vec2 aPosition;
    void main() {
      gl_Position = vec4(aPosition, 0.0, 1.0);
    }
  `;

  // =========================================================================
  // 1. STRANDS SHADER (Feixes Espectrais Multicoloridos do Personal OS)
  // =========================================================================
  const STRANDS_FRAG_SRC = `
    precision highp float;
    uniform float uTime;
    uniform vec2 uResolution;

    const float PI = 3.14159265;

    vec3 samplePalette(float t) {
      t = fract(t);
      // Cores ricas do Personal OS: Laranja solar, Roxo vibrante, Ciano neon, Rosa plasma, Azul profundo
      vec3 c0 = vec3(0.976, 0.451, 0.086); // #F97316
      vec3 c1 = vec3(0.486, 0.227, 0.929); // #7C3AED
      vec3 c2 = vec3(0.024, 0.714, 0.831); // #06B6D4
      vec3 c3 = vec3(0.925, 0.282, 0.600); // #EC4899
      vec3 c4 = vec3(0.231, 0.510, 0.965); // #3B82F6

      float step = t * 5.0;
      if (step < 1.0) return mix(c0, c1, fract(step));
      if (step < 2.0) return mix(c1, c2, fract(step));
      if (step < 3.0) return mix(c2, c3, fract(step));
      if (step < 4.0) return mix(c3, c4, fract(step));
      return mix(c4, c0, fract(step));
    }

    void main() {
      vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution.xy) / uResolution.y;
      float env = pow(max(cos(uv.x * PI * 1.2), 0.0), 2.5);

      vec3 col = vec3(0.015, 0.02, 0.035);

      for (int i = 0; i < 7; i++) {
        float fi = float(i);
        float ph = fi * 1.6;
        float freq = 2.0 + fi * 0.4;
        float spd = 1.2 + fi * 0.35;

        float tt = uTime * 0.6;
        float w = sin(uv.x * freq + tt * spd + ph) * 0.45
                + sin(uv.x * freq * 1.15 - tt * spd * 0.7 + ph * 1.5) * 0.25;

        float amp = 0.22 * env;
        float y = w * amp;

        float d = abs(uv.y - y);
        float thick = 0.018 * (0.3 + env);
        float g = thick / (d + thick * 0.5);
        g = g * g;

        float h = fi / 7.0 + uv.x * 0.25 + uTime * 0.04;
        col += samplePalette(h) * g * env * 1.1;
      }

      col = 1.0 - exp(-col * 2.2);
      gl_FragColor = vec4(col, 1.0);
    }
  `;

  // =========================================================================
  // 2. PLASMA WAVE SHADER (Campos Cósmicos de Raymarching do Personal OS)
  // =========================================================================
  const PLASMA_FRAG_SRC = `
    precision mediump float;
    uniform float uTime;
    uniform vec2 uResolution;

    const float pi = 3.14159265;
    const float pi_2 = 1.5707963;
    #define MAX_STEPS 12

    void main() {
      vec2 coord = gl_FragCoord.xy - 0.5 * uResolution;
      float d = 0.0;
      float s = 1.0;
      vec3 o = vec3(0.0, 0.0, -6.5);
      vec3 u = normalize(vec3(coord / uResolution.y, 0.8));
      vec2 k = vec2(0.0);
      vec3 p;

      float t = uTime * 0.4 * pi;
      float t1 = t * 0.7;
      float t2 = t * 0.9;

      for (int i = 0; i < MAX_STEPS; ++i) {
        p = o + u * d;
        p.x -= 12.0;

        float px = p.x;
        float wob1 = 1.0 + sin(t1 + px * 0.8) * 0.12;
        float wob2 = 0.5 + cos(t2 + px * 1.1) * 0.12;

        float px2 = px + pi_2;
        vec2 sinOffset = sin(vec2(px, px2) + t * 0.08) * wob1;
        vec2 cosOffset = cos(vec2(px, px2) + t * 0.08) * wob2;

        vec2 yz = p.yz;
        float pxLt = px + 0.3;
        k.x = max(pxLt, length(yz - sinOffset) - 0.3);
        k.y = max(pxLt, length(yz - cosOffset) - 0.3);

        float current = min(k.x, k.y);
        s = min(s, current);
        if (s < 0.002 || d > 200.0) break;
        d += s * 0.75;
      }

      vec3 raw = max(cos(d * 6.283) - s * sqrt(max(d, 0.0)) - vec3(k, 0.0), 0.0);
      raw.gb += 0.12;
      raw = raw * 0.4 + raw.brg * 0.6 + raw * raw;
      float lum = dot(raw, vec3(0.299, 0.587, 0.114));

      float w1 = max(0.0, 1.0 - k.x * 2.0);
      float w2 = max(0.0, 1.0 - k.y * 2.0);
      float wt = w1 + w2 + 0.001;

      // Cores nativas do Personal OS: Violeta (#A855F7) e Ciano (#06B6D4)
      vec3 colViolet = vec3(0.658, 0.333, 0.968);
      vec3 colCyan   = vec3(0.024, 0.714, 0.831);
      vec3 c = (colViolet * w1 + colCyan * w2) / wt * lum * 3.2;

      // Fundo abissal
      c += vec3(0.02, 0.015, 0.04);
      gl_FragColor = vec4(c, 1.0);
    }
  `;

  // =========================================================================
  // 3. SOFT AURORA SHADER (Aurora Boreal Celestial com FBM e Ruído 3D)
  // =========================================================================
  const AURORA_FRAG_SRC = `
    precision highp float;
    uniform float uTime;
    uniform vec2 uResolution;

    #define TAU 6.2831853

    vec3 hash3(vec3 p) {
      p = vec3(
        dot(p, vec3(127.1, 311.7, 234.6)),
        dot(p, vec3(269.5, 183.3, 198.3)),
        dot(p, vec3(169.5, 283.3, 156.9))
      );
      vec3 h = fract(sin(p) * 43758.5453123);
      float phi = acos(2.0 * h.x - 1.0);
      float theta = TAU * h.y;
      return vec3(cos(theta) * sin(phi), sin(theta) * sin(phi), cos(phi));
    }

    float noise3D(vec3 p) {
      vec3 i = floor(p);
      vec3 f = fract(p);
      vec3 u = f * f * (3.0 - 2.0 * f);

      return mix(
        mix(mix(dot(hash3(i + vec3(0,0,0)), f - vec3(0,0,0)),
                dot(hash3(i + vec3(1,0,0)), f - vec3(1,0,0)), u.x),
            mix(dot(hash3(i + vec3(0,1,0)), f - vec3(0,1,0)),
                dot(hash3(i + vec3(1,1,0)), f - vec3(1,1,0)), u.x), u.y),
        mix(mix(dot(hash3(i + vec3(0,0,1)), f - vec3(0,0,1)),
                dot(hash3(i + vec3(1,0,1)), f - vec3(1,0,1)), u.x),
            mix(dot(hash3(i + vec3(0,1,1)), f - vec3(0,1,1)),
                dot(hash3(i + vec3(1,1,1)), f - vec3(1,1,1)), u.x), u.y), u.z);
    }

    float fbm(vec3 p) {
      float val = 0.0;
      float amp = 0.55;
      for (int i = 0; i < 3; i++) {
        val += amp * noise3D(p);
        p *= 2.1;
        amp *= 0.5;
      }
      return val;
    }

    void main() {
      vec2 st = (gl_FragCoord.xy - 0.5 * uResolution.xy) / uResolution.y;
      float t = uTime * 0.25;

      vec3 p1 = vec3(st * 2.2, t * 0.3);
      float n1 = fbm(p1);

      vec3 p2 = vec3(st * 2.2 + vec2(1.7, 5.2), t * 0.3 + 0.4);
      float n2 = fbm(p2);

      float dist1 = abs(st.y + 0.15 + n1 * 0.35);
      float dist2 = abs(st.y + 0.05 + n2 * 0.35);

      float a1 = smoothstep(0.45, 0.0, dist1);
      float a2 = smoothstep(0.40, 0.0, dist2);

      // Cores celestiais do Personal OS: Turquesa Ártico (#00f5d4) e Magenta Nebulosa (#9d4edd)
      vec3 colA = vec3(0.0, 0.96, 0.83);
      vec3 colB = vec3(0.61, 0.30, 0.86);

      vec3 sky = vec3(0.015, 0.02, 0.035);
      vec3 aurora = colA * a1 * 1.2 + colB * a2 * 1.3;

      gl_FragColor = vec4(sky + aurora, 1.0);
    }
  `;

  // =========================================================================
  // 4. DARK VEIL SHADER (Rede Neural CPPN com Cetim Negro do Personal OS)
  // =========================================================================
  const VEIL_FRAG_SRC = `
    precision highp float;
    uniform float uTime;
    uniform vec2 uResolution;

    vec4 buf[8];
    vec4 sigmoid(vec4 x){ return 1.0 / (1.0 + exp(-clamp(x, -15.0, 15.0))); }

    vec4 cppn_fn(vec2 coordinate, float in0, float in1, float in2) {
      buf[6] = vec4(coordinate.x, coordinate.y, 0.394 + in0, 0.36 + in1);
      buf[7] = vec4(0.14 + in2, length(coordinate), 0.0, 0.0);
      buf[0] = mat4(vec4(6.5,-3.6,0.7,-1.1),vec4(2.4,3.1,1.2,0.06),vec4(-5.4,-6.1,1.8,-4.7),vec4(6.0,-5.5,-0.9,3.2))*buf[6]
             + mat4(vec4(0.8,-5.7,3.9,1.6),vec4(-0.2,0.5,-1.7,-5.3),vec4(0.),vec4(0.))*buf[7] + vec4(0.2,1.1,-1.7,5.0);
      buf[1] = mat4(vec4(-3.3,-6.0,0.5,-4.4),vec4(0.8,1.7,5.6,1.6),vec4(2.4,-3.5,1.7,6.3),vec4(3.3,8.2,1.1,-1.1))*buf[6]
             + mat4(vec4(5.2,-13.0,0.0,15.8),vec4(2.9,3.1,-0.8,-1.6),vec4(0.),vec4(0.))*buf[7] + vec4(-5.9,-6.5,-0.8,1.5);
      buf[0] = sigmoid(buf[0]); buf[1] = sigmoid(buf[1]);
      buf[2] = mat4(vec4(-15.2,8.0,-2.4,-1.9),vec4(-5.9,4.3,2.6,1.2),vec4(-7.3,6.7,5.2,5.9),vec4(5.0,8.9,-1.7,-1.1))*buf[6]
             + mat4(vec4(-11.9,-11.6,6.1,11.2),vec4(2.1,-6.2,-1.7,-0.7),vec4(0.),vec4(0.))*buf[7] + vec4(-4.1,-3.2,-4.5,-3.6);
      buf[3] = mat4(vec4(3.1,-13.7,1.8,3.2),vec4(0.6,12.7,1.9,0.5),vec4(-0.04,4.4,1.4,1.8),vec4(5.0,13.0,3.3,-4.5))*buf[6]
             + mat4(vec4(-0.1,7.7,-3.1,4.7),vec4(0.6,3.7,-0.8,-0.3),vec4(0.),vec4(0.))*buf[7] + vec4(-1.1,-21.6,0.7,1.2);
      buf[2] = sigmoid(buf[2]); buf[3] = sigmoid(buf[3]);
      buf[4] = mat4(vec4(5.2,-7.1,2.7,2.6),vec4(-5.6,-25.3,4.0,0.4),vec4(-10.5,24.2,21.1,37.5),vec4(4.3,-1.9,2.3,-1.3))*buf[0]
             + mat4(vec4(-17.6,-10.5,2.2,12.4),vec4(6.2,-50.7,-12.6,0.9),vec4(-10.9,20.7,-9.7,-0.7),vec4(5.3,1.4,-4.1,-4.8))*buf[1]
             + vec4(-7.6,15.9,1.3,-1.6);
      buf[4] = sigmoid(buf[4]);
      return vec4(buf[4].x, buf[4].y, buf[4].z, 1.0);
    }

    void main() {
      vec2 uv = (gl_FragCoord.xy / uResolution.xy) * 2.0 - 1.0;
      uv.x *= uResolution.x / uResolution.y;
      uv += 0.04 * vec2(sin(uv.y * 6.28 + uTime * 0.4), cos(uv.x * 6.28 + uTime * 0.4));

      vec4 net = cppn_fn(uv, 0.08 * sin(0.3 * uTime), 0.08 * sin(0.65 * uTime), 0.08 * sin(0.4 * uTime));
      // Tonalidade de cetim abissal com reflexos índigo/prata do Personal OS
      vec3 col = mix(vec3(0.015, 0.02, 0.04), vec3(0.2, 0.28, 0.42), net.rgb * 0.8);
      float scan = sin(gl_FragCoord.y * 0.8) * 0.5 + 0.5;
      col *= 1.0 - scan * 0.06;

      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }
  `;

  // =========================================================================
  // 5. BALATRO SHADER (Vórtice Hipnótico Psicodélico Original do Personal OS)
  // =========================================================================
  const BALATRO_FRAG_SRC = `
    precision highp float;
    uniform float uTime;
    uniform vec2 uResolution;

    vec4 effect(vec2 screenSize, vec2 screen_coords) {
      float pixel_size = length(screenSize.xy) / 600.0;
      vec2 uv = (floor(screen_coords.xy * (1.0 / pixel_size)) * pixel_size - 0.5 * screenSize.xy) / length(screenSize.xy);
      float uv_len = length(uv);

      float speed = -2.0 * 0.2;
      speed = uTime * speed + 302.2;

      float new_pixel_angle = atan(uv.y, uv.x) + speed - 20.0 * (0.25 * uv_len + 0.75);
      vec2 mid = (screenSize.xy / length(screenSize.xy)) / 2.0;
      uv = (vec2(uv_len * cos(new_pixel_angle) + mid.x, uv_len * sin(new_pixel_angle) + mid.y) - mid);
      uv *= 28.0;

      float baseSpeed = uTime * 3.5;
      vec2 uv2 = vec2(uv.x + uv.y);
      for(int i = 0; i < 4; i++) {
        uv2 += sin(max(uv.x, uv.y)) + uv;
        uv += 0.5 * vec2(cos(5.112 + 0.353 * uv2.y + baseSpeed * 0.13), sin(uv2.x - 0.113 * baseSpeed));
        uv -= cos(uv.x + uv.y) - sin(uv.x * 0.711 - uv.y);
      }

      float contrast_mod = (0.25 * 3.2 + 0.5 * 0.25 + 1.2);
      float paint_res = min(2.0, max(0.0, length(uv) * 0.035 * contrast_mod));
      float c1p = max(0.0, 1.0 - contrast_mod * abs(1.0 - paint_res));
      float c2p = max(0.0, 1.0 - contrast_mod * abs(paint_res));
      float c3p = 1.0 - min(1.0, c1p + c2p);

      // Paleta Balatro Autêntica do Personal OS: Carmim (#DE443B), Azul Real (#006BB4), Slate Escuro (#162325)
      vec4 uColor1 = vec4(0.871, 0.267, 0.231, 1.0);
      vec4 uColor2 = vec4(0.000, 0.420, 0.706, 1.0);
      vec4 uColor3 = vec4(0.086, 0.137, 0.145, 1.0);

      float light = (0.4 - 0.2) * max(c1p * 5.0 - 4.0, 0.0) + 0.4 * max(c2p * 5.0 - 4.0, 0.0);
      return (0.3 / 3.2) * uColor1 + (1.0 - 0.3 / 3.2) * (uColor1 * c1p + uColor2 * c2p + vec4(c3p * uColor3.rgb, 1.0)) + light;
    }

    void main() {
      gl_FragColor = effect(uResolution.xy, gl_FragCoord.xy);
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

  function initShader(container, type = 'strands') {
    if (!container) return;
    activeShader = type;
    localStorage.setItem('adb_sentinel_shader', type);

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

    const gl = canvas.getContext('webgl', { powerPreference: 'low-power', alpha: false, antialias: false });
    if (!gl) {
      console.error('WebGL não disponível');
      return;
    }
    currentGl = gl;

    let fragSrc = STRANDS_FRAG_SRC;
    if (type === 'plasma') fragSrc = PLASMA_FRAG_SRC;
    else if (type === 'soft_aurora') fragSrc = AURORA_FRAG_SRC;
    else if (type === 'dark_veil') fragSrc = VEIL_FRAG_SRC;
    else if (type === 'balatro') fragSrc = BALATRO_FRAG_SRC;
    else if (type === 'strands') fragSrc = STRANDS_FRAG_SRC;

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

    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);

    const aPosLoc = gl.getAttribLocation(program, 'aPosition');
    gl.enableVertexAttribArray(aPosLoc);
    gl.vertexAttribPointer(aPosLoc, 2, gl.FLOAT, false, 0, 0);

    const uTimeLoc = gl.getUniformLocation(program, 'uTime');
    const uResLoc = gl.getUniformLocation(program, 'uResolution');

    // DPR 1.0 no mobile para máxima economia de GPU e suavidade a 120Hz
    function resize() {
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      canvas.width = Math.floor(w * 1.0);
      canvas.height = Math.floor(h * 1.0);
      gl.viewport(0, 0, canvas.width, canvas.height);
    }
    window.addEventListener('resize', resize, { passive: true });
    resize();

    const startTime = performance.now();

    function render(now) {
      if (!document.hidden) {
        const elapsed = (now - startTime) * 0.001;
        gl.useProgram(program);
        if (uTimeLoc) gl.uniform1f(uTimeLoc, elapsed);
        if (uResLoc) gl.uniform2f(uResLoc, canvas.width, canvas.height);
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
  window.getActiveShader = () => activeShader;

  document.addEventListener('DOMContentLoaded', () => {
    const ctn = document.getElementById('bg-webgl-container');
    if (ctn) initShader(ctn, activeShader);
  });
})();
