import { Renderer as OGLRenderer, Program, Mesh, Triangle } from './ogl.js';

const IS_MOBILE = typeof navigator !== 'undefined' && (/iPhone|iPad|iPod|Android|Mobile/i.test(navigator.userAgent) || (typeof window !== 'undefined' && window.innerWidth < 768));
const OPTIMAL_DPR = IS_MOBILE ? 0.6 : (typeof window !== 'undefined' && window.devicePixelRatio > 1.5 ? 0.65 : 0.8);

class Renderer extends OGLRenderer {
  constructor(opts = {}) {
    super({
      dpr: OPTIMAL_DPR,
      powerPreference: 'low-power',
      ...opts
    });
  }
}

let activeCleanup = null;
let currentShaderId = 'cyber_matrix';

// ==========================================
// 1. STRANDS NEON SHADER
// ==========================================
const STRANDS_VERT = `#version 300 es
in vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const STRANDS_FRAG = `#version 300 es
precision highp float;

uniform float uTime;
uniform vec2 uResolution;
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform float uSpeed;

out vec4 fragColor;

const float PI = 3.14159265359;

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution) / uResolution.y;
  float env = pow(max(cos(uv.x * PI * 1.2), 0.0), 1.6);
  vec3 col = vec3(0.0);

  for (int i = 0; i < 9; i++) {
    float fi = float(i);
    float ph = fi * 1.5;
    float freq = 2.4 + fi * 0.4;
    float spd = 1.2 + fi * 0.7;

    float tt = uTime * uSpeed;
    float w = sin(uv.x * freq + tt * spd + ph) * 0.55
            + sin(uv.x * freq * 1.2 - tt * spd * 0.8 + ph * 1.4) * 0.35;

    float y = w * 0.22 * env;
    float d = abs(uv.y - y);
    float thick = 0.012 * env;
    float g = thick / (d + thick * 0.5);
    g = g * g;

    vec3 strandCol = mix(uColorA, uColorB, fi / 8.0);
    col += strandCol * g * env;
  }

  col = 1.0 - exp(-col * 1.8);
  fragColor = vec4(col, 1.0);
}
`;

// ==========================================
// 2. CYBER MATRIX PHOSPHOR SHADER
// ==========================================
const CYBER_MATRIX_FRAG = `#version 300 es
precision highp float;

uniform float uTime;
uniform vec2 uResolution;

out vec4 fragColor;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution.xy;
  vec2 gridUv = uv * vec2(40.0, 70.0);
  vec2 cellId = floor(gridUv);
  
  float speed = 2.5 + hash(vec2(cellId.x, 0.0)) * 3.5;
  float drop = fract(cellId.y * 0.05 - uTime * speed * 0.08 + hash(vec2(cellId.x, 1.0)));
  
  float charVal = hash(cellId + floor(uTime * 4.0));
  float glow = pow(drop, 3.5);
  
  // Verde Fósforo Matrix
  vec3 matrixGreen = vec3(0.0, 1.0, 0.4);
  vec3 matrixWhite = vec3(0.7, 1.0, 0.85);
  vec3 col = mix(matrixGreen, matrixWhite, pow(drop, 8.0)) * glow;
  
  // Background gradient escuro
  col += vec3(0.02, 0.05, 0.03) * (1.0 - uv.y * 0.6);
  fragColor = vec4(col, 1.0);
}
`;

// ==========================================
// 3. PLASMA WAVE SHADER
// ==========================================
const PLASMA_FRAG = `#version 300 es
precision highp float;

uniform float uTime;
uniform vec2 uResolution;

out vec4 fragColor;

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution.xy) / uResolution.y;
  float t = uTime * 0.4;

  float v = sin(uv.x * 4.0 + t);
  v += sin(uv.y * 4.0 + t * 0.8);
  v += sin((uv.x + uv.y) * 4.0 + t * 1.2);
  v += sin(length(uv) * 6.0 - t * 1.5);

  vec3 colA = vec3(0.0, 0.9, 0.4); // Neon Green
  vec3 colB = vec3(0.02, 0.12, 0.25); // Deep Indigo
  vec3 colC = vec3(0.0, 0.35, 0.2); // Jade

  vec3 finalCol = mix(colB, colC, 0.5 + 0.5 * sin(v * 2.0));
  finalCol += colA * pow(0.5 + 0.5 * sin(v * 3.1415), 4.0) * 0.8;

  fragColor = vec4(finalCol, 1.0);
}
`;

// ==========================================
// 4. DARK VEIL SHADER
// ==========================================
const VEIL_FRAG = `#version 300 es
precision highp float;

uniform float uTime;
uniform vec2 uResolution;

out vec4 fragColor;

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution.xy) / uResolution.y;
  float d = length(uv);
  float a = atan(uv.y, uv.x);

  float wave = sin(d * 10.0 - uTime * 0.8 + sin(a * 4.0) * 1.5);
  float rings = smoothstep(0.1, 0.9, wave * 0.5 + 0.5);

  vec3 col = mix(vec3(0.02, 0.03, 0.06), vec3(0.0, 0.4, 0.2), rings * 0.4);
  col += vec3(0.0, 1.0, 0.45) * pow(rings, 6.0) * 0.35;
  col *= smoothstep(1.2, 0.2, d);

  fragColor = vec4(col, 1.0);
}
`;

// Inits
export function initShader(container, type = 'cyber_matrix') {
  if (activeCleanup) {
    try { activeCleanup(); } catch(e) {}
    activeCleanup = null;
  }
  currentShaderId = type;

  const renderer = new Renderer();
  const gl = renderer.gl;
  gl.clearColor(0.02, 0.03, 0.05, 1.0);
  container.appendChild(gl.canvas);

  const geometry = new Triangle(gl);
  let fragCode = CYBER_MATRIX_FRAG;

  if (type === 'strands') fragCode = STRANDS_FRAG;
  else if (type === 'plasma') fragCode = PLASMA_FRAG;
  else if (type === 'veil') fragCode = VEIL_FRAG;
  else fragCode = CYBER_MATRIX_FRAG;

  const program = new Program(gl, {
    vertex: STRANDS_VERT,
    fragment: fragCode,
    uniforms: {
      uTime: { value: 0 },
      uResolution: { value: new Float32Array([1, 1]) },
      uColorA: { value: new Float32Array([0.0, 1.0, 0.4]) },
      uColorB: { value: new Float32Array([0.0, 0.4, 0.8]) },
      uSpeed: { value: 0.8 }
    }
  });

  const mesh = new Mesh(gl, { geometry, program });

  const resize = () => {
    const w = Math.max(1, container.clientWidth || window.innerWidth);
    const h = Math.max(1, container.clientHeight || window.innerHeight);
    renderer.setSize(w, h);
    program.uniforms.uResolution.value[0] = gl.drawingBufferWidth;
    program.uniforms.uResolution.value[1] = gl.drawingBufferHeight;
  };
  window.addEventListener('resize', resize);
  resize();

  let rafId = 0;
  const t0 = performance.now();

  const loop = (t) => {
    if (document.hidden) {
      setTimeout(() => { rafId = requestAnimationFrame(loop); }, 300);
      return;
    }
    program.uniforms.uTime.value = (t - t0) * 0.001;
    renderer.render({ scene: mesh });
    rafId = requestAnimationFrame(loop);
  };
  rafId = requestAnimationFrame(loop);

  activeCleanup = () => {
    cancelAnimationFrame(rafId);
    window.removeEventListener('resize', resize);
    try { container.removeChild(gl.canvas); } catch(e) {}
  };

  return activeCleanup;
}

window.renderShader = (type) => {
  const ctn = document.getElementById('bg-webgl-container');
  if (ctn) initShader(ctn, type);
};
