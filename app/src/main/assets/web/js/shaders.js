import { Renderer, Program, Mesh, Color, Triangle, RenderTarget, Camera, Transform, Geometry, Vec2, Vec3, Texture } from './ogl.js';

// Store active cleanup function for WebGL background
let currentCleanup = null;
let currentActiveType = null;

// ==========================================
// PERFORMANCE ENGINE & HARDWARE ADAPTIVE THROTTLER
// ==========================================
let currentBgSession = 0;

export const getOptimizedDPR = () => {
  // Calibração de hardware: 0.6 em Retina/Displays 4K e 0.75 em Desktop padrão
  // Proporciona visual Liquid Glass perfeito e economiza mais de 70% de processamento da GPU
  if (typeof window !== 'undefined') {
    const dpr = window.devicePixelRatio || 1;
    if (dpr > 1.5) return 0.6;
    return 0.75;
  }
  return 0.6;
};

let isTabVisible = typeof document !== 'undefined' ? !document.hidden : true;
let isUserScrollingFast = false;
let scrollEndTimer = null;

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    isTabVisible = !document.hidden;
  }, { passive: true });

  window.addEventListener('scroll', () => {
    isUserScrollingFast = true;
    if (scrollEndTimer) clearTimeout(scrollEndTimer);
    scrollEndTimer = setTimeout(() => {
      isUserScrollingFast = false;
    }, 120);
  }, { passive: true });
}

// Universal hardware-efficient RAF throttler for all 31 shaders (60 FPS cap, 0% CPU on hidden tab / modal pause)
const nativeRAF = (typeof window !== 'undefined' ? window.requestAnimationFrame.bind(window) : (cb) => setTimeout(cb, 16));
let lastBgFrameGlobal = 0;
const TARGET_BG_FPS = 60;
const BG_FRAME_INTERVAL = 1000 / TARGET_BG_FPS;

const isEngineSuspended = () => {
  if (!isTabVisible) return true;
  if (typeof window !== 'undefined') {
    if (window.__PAUSE_WEBGL_SHADERS__) return true;
    if (window.__MODAL_OPEN_PAUSE__) return true;
  }
  return false;
};

const requestAnimationFrame = (callback) => {
  const session = currentBgSession;
  return nativeRAF((time) => {
    // 1. Eliminação imediata de loops zumbis de fundos anteriores
    if (session !== currentBgSession) return;

    // 2. Pausa completa (0% CPU/GPU) se a aba estiver oculta ou suspensa
    if (isEngineSuspended()) {
      setTimeout(() => {
        if (session === currentBgSession) {
          requestAnimationFrame(callback);
        }
      }, 250);
      return;
    }

    // 3. Regulação de taxa de quadros (suavização adaptativa no fast scroll)
    const effectiveInterval = isUserScrollingFast ? 33.3 : BG_FRAME_INTERVAL;
    const delta = time - lastBgFrameGlobal;
    if (delta < effectiveInterval) {
      nativeRAF((nextTime) => {
        if (session === currentBgSession) {
          callback(nextTime);
        }
      });
      return;
    }
    lastBgFrameGlobal = time;
    callback(time);
  });
};

export const runAdaptiveAnimation = (renderFn, targetFps = 60) => {
  let rafId = 0;
  let lastFrameTime = 0;
  const frameInterval = 1000 / targetFps;
  let running = true;
  const session = currentBgSession;

  const loop = (now) => {
    if (!running || session !== currentBgSession) return;
    rafId = requestAnimationFrame(loop);

    if (isEngineSuspended()) return;

    const delta = now - lastFrameTime;
    const effectiveInterval = isUserScrollingFast ? (frameInterval * 2.0) : frameInterval;

    if (delta >= effectiveInterval) {
      lastFrameTime = now - (delta % effectiveInterval);
      try {
        renderFn(now);
      } catch (e) {}
    }
  };

  rafId = requestAnimationFrame(loop);

  return () => {
    running = false;
    if (rafId && typeof cancelAnimationFrame !== 'undefined') cancelAnimationFrame(rafId);
  };
};

// ==========================================
// 1. STRANDS COMPONENT
// ==========================================
const MAX_STRANDS = 12;
const MAX_COLORS = 8;

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
uniform vec3 uColors[${MAX_COLORS}];
uniform int uColorCount;
uniform int uStrandCount;
uniform float uSpeed;
uniform float uAmplitude;
uniform float uWaviness;
uniform float uThickness;
uniform float uGlow;
uniform float uTaper;
uniform float uSpread;
uniform float uHueShift;
uniform float uIntensity;
uniform float uOpacity;
uniform float uScale;
uniform float uSaturation;

out vec4 fragColor;

const float PI = 3.14159265;

vec3 spectrum(float t) {
  return 0.5 + 0.5 * cos(2.0 * PI * (t + vec3(0.00, 0.33, 0.67)));
}

vec3 samplePalette(float t) {
  t = fract(t);
  float scaled = t * float(uColorCount);
  int idx = int(floor(scaled));
  float blend = fract(scaled);
  int nextIdx = idx + 1;
  if (nextIdx >= uColorCount) nextIdx = 0;
  return mix(uColors[idx], uColors[nextIdx], blend);
}

vec3 strandColor(float t) {
  if (uColorCount > 0) return samplePalette(t);
  return spectrum(t);
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution) / uResolution.y;
  uv /= max(uScale, 0.0001);

  float e = 0.06 + uIntensity * 0.94;
  float env = pow(max(cos(uv.x * PI * 1.3), 0.0), uTaper);

  vec3 col = vec3(0.0);

  for (int i = 0; i < ${MAX_STRANDS}; i++) {
    if (i >= uStrandCount) break;

    float fi = float(i);
    float ph = fi * 1.7 * uSpread;
    float freq = (2.0 + fi * 0.35) * uWaviness;
    float spd = 1.4 + fi * 1.2;

    float tt = uTime * uSpeed;
    float w = sin(uv.x * freq + tt * spd + ph) * 0.60
            + sin(uv.x * freq * 1.1 - tt * spd * 0.7 + ph * 1.7) * 0.40;

    float amp = (0.1 + 0.02 * e) * env * uAmplitude;
    float y = w * amp;

    float d = abs(uv.y - y);
    float thick = (0.001 + 0.05 * e) * (0.35 + env) * uThickness;
    float g = thick / (d + thick * 0.45);
    g = g * g;

    float h = fi / float(uStrandCount) + uv.x * 0.30 + uTime * 0.04 + uHueShift;
    col += strandColor(h) * g * env;
  }

  col *= 0.45 + 0.7 * e;
  col = 1.0 - exp(-col * uGlow);

  float gray = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = max(mix(vec3(gray), col, uSaturation), 0.0);

  float lum = max(max(col.r, col.g), col.b);
  float alpha = clamp(lum, 0.0, 1.0) * uOpacity;

  fragColor = vec4(col * uOpacity, alpha);
}
`;

const STRANDS_GLASS_FRAG = `#version 300 es
precision highp float;

uniform sampler2D uScene;
uniform vec2 uResolution;
uniform float uRadius;
uniform float uRefraction;
uniform float uDispersion;

out vec4 fragColor;

vec2 toUv(vec2 p) {
  return p * (uResolution.y / uResolution) + 0.5;
}

void main() {
  vec2 p = (gl_FragCoord.xy - 0.5 * uResolution) / uResolution.y;
  float d = length(p);
  float r = uRadius;

  float edge = fwidth(d) * 1.5;
  float mask = 1.0 - smoothstep(r - edge, r + edge, d);
  if (mask <= 0.0) {
    fragColor = vec4(0.0);
    return;
  }

  float z = sqrt(max(r * r - d * d, 0.0)) / r;
  float nd = d / r;

  vec2 dir = d > 0.0 ? p / d : vec2(0.0);
  float lens = smoothstep(0.85, 1.0, nd) * pow(nd, 6.0);
  vec2 offset = -dir * lens * uRefraction * 0.15;
  vec2 disp = -dir * lens * uDispersion * 0.012;

  vec3 light;
  light.r = texture(uScene, toUv(p + offset - disp)).r;
  light.g = texture(uScene, toUv(p + offset)).g;
  light.b = texture(uScene, toUv(p + offset + disp)).b;

  float fres = pow(1.0 - z, 3.0);
  vec3 rim = vec3(1.0) * fres * 0.18;

  vec2 lightDir = normalize(vec2(-0.55, 0.6));
  float spec = pow(max(dot(p / max(r, 1e-4), lightDir), 0.0), 6.0);
  spec *= smoothstep(r, r * 0.55, d);

  vec3 emissive = light + rim + vec3(spec) * 0.4;
  float emissiveA = clamp(max(max(emissive.r, emissive.g), emissive.b), 0.0, 1.0);

  float bodyA = 0.05 + fres * 0.05;

  float outA = emissiveA + bodyA * (1.0 - emissiveA);
  vec3 outRGB = emissive;

  outRGB *= mask;
  outA *= mask;

  fragColor = vec4(outRGB, outA);
}
`;

function buildStrandsPalette(colors) {
  const filled = colors && colors.length ? colors : ['#ffffff'];
  const padded = [];
  for (let i = 0; i < MAX_COLORS; i++) {
    const hex = filled[i] ?? filled[filled.length - 1];
    const c = new Color(hex);
    padded.push([c.r, c.g, c.b]);
  }
  return padded;
}

function initStrands(ctn, opts = {}) {
  const colors = opts.colors || ['#F97316', '#7C3AED', '#06B6D4'];
  const count = opts.count ?? 3;
  const speed = opts.speed ?? 0.5;
  const amplitude = opts.amplitude ?? 1;
  const waviness = opts.waviness ?? 1;
  const thickness = opts.thickness ?? 0.7;
  const glow = opts.glow ?? 2.6;
  const taper = opts.taper ?? 3;
  const spread = opts.spread ?? 1;
  const hueShift = opts.hueShift ?? 0;
  const intensity = opts.intensity ?? 0.6;
  const saturation = opts.saturation ?? 1.5;
  const opacity = opts.opacity ?? 1;
  const scale = opts.scale ?? 1.5;
  const glass = opts.glass ?? false;
  const refraction = opts.refraction ?? 1;
  const dispersion = opts.dispersion ?? 1;
  const glassSize = opts.glassSize ?? 1;

  const renderer = new Renderer({ dpr: getOptimizedDPR(), alpha: true, premultipliedAlpha: true, antialias: false, powerPreference: 'low-power' });
  const gl = renderer.gl;
  gl.clearColor(0, 0, 0, 0);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  gl.canvas.style.backgroundColor = 'transparent';
  gl.canvas.style.width = '100%';
  gl.canvas.style.height = '100%';

  const geometry = new Triangle(gl);
  if (geometry.attributes.uv) delete geometry.attributes.uv;

  const program = new Program(gl, {
    vertex: STRANDS_VERT,
    fragment: STRANDS_FRAG,
    uniforms: {
      uTime: { value: 0 },
      uResolution: { value: [ctn.offsetWidth, ctn.offsetHeight] },
      uColors: { value: buildStrandsPalette(colors) },
      uColorCount: { value: Math.min(colors.length, MAX_COLORS) },
      uStrandCount: { value: Math.min(count, MAX_STRANDS) },
      uSpeed: { value: speed },
      uAmplitude: { value: amplitude },
      uWaviness: { value: waviness },
      uThickness: { value: thickness },
      uGlow: { value: glow },
      uTaper: { value: taper },
      uSpread: { value: spread },
      uHueShift: { value: hueShift },
      uIntensity: { value: intensity },
      uOpacity: { value: opacity },
      uScale: { value: scale },
      uSaturation: { value: saturation }
    }
  });

  const mesh = new Mesh(gl, { geometry, program });
  const renderTarget = new RenderTarget(gl, { width: ctn.offsetWidth, height: ctn.offsetHeight });

  const glassProgram = new Program(gl, {
    vertex: STRANDS_VERT,
    fragment: STRANDS_GLASS_FRAG,
    uniforms: {
      uScene: { value: renderTarget.texture },
      uResolution: { value: [ctn.offsetWidth, ctn.offsetHeight] },
      uRadius: { value: 0.46 * glassSize },
      uRefraction: { value: refraction },
      uDispersion: { value: dispersion }
    }
  });
  const glassMesh = new Mesh(gl, { geometry, program: glassProgram });

  ctn.appendChild(gl.canvas);

  function resize() {
    if (!ctn) return;
    const width = ctn.offsetWidth || window.innerWidth;
    const height = ctn.offsetHeight || window.innerHeight;
    renderer.setSize(width, height);
    program.uniforms.uResolution.value = [width, height];
    renderTarget.setSize(width, height);
    glassProgram.uniforms.uResolution.value = [width, height];
  }
  window.addEventListener('resize', resize);
  resize();

  let animateId = 0;
  const update = t => {
    if (!isTabVisible) {
      if (typeof raf !== 'undefined') raf = requestAnimationFrame(typeof loop !== 'undefined' ? loop : update);
      else if (typeof rafId !== 'undefined') rafId = requestAnimationFrame(typeof loop !== 'undefined' ? loop : update);
      else if (typeof animateId !== 'undefined') animateId = requestAnimationFrame(typeof loop !== 'undefined' ? loop : update);
      else if (typeof animationId !== 'undefined') animationId = requestAnimationFrame(typeof loop !== 'undefined' ? loop : update);
      return;
    }
    if (isUserScrollingFast && Math.random() < 0.5) {
      if (typeof raf !== 'undefined') raf = requestAnimationFrame(typeof loop !== 'undefined' ? loop : update);
      else if (typeof rafId !== 'undefined') rafId = requestAnimationFrame(typeof loop !== 'undefined' ? loop : update);
      else if (typeof animateId !== 'undefined') animateId = requestAnimationFrame(typeof loop !== 'undefined' ? loop : update);
      else if (typeof animationId !== 'undefined') animationId = requestAnimationFrame(typeof loop !== 'undefined' ? loop : update);
      return;
    }

    animateId = requestAnimationFrame(update);
    program.uniforms.uTime.value = t * 0.001;
    if (glass) {
      renderer.render({ scene: mesh, target: renderTarget });
      glassProgram.uniforms.uScene.value = renderTarget.texture;
      renderer.render({ scene: glassMesh });
    } else {
      renderer.render({ scene: mesh });
    }
  };
  animateId = requestAnimationFrame(update);

  return () => {
    cancelAnimationFrame(animateId);
    window.removeEventListener('resize', resize);
    if (ctn && gl.canvas.parentNode === ctn) {
      ctn.removeChild(gl.canvas);
    }
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  };
}


// ==========================================
// 2. SIDE RAYS COMPONENT
// ==========================================
const hexToRgb = hex => {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return m ? [parseInt(m[1], 16) / 255, parseInt(m[2], 16) / 255, parseInt(m[3], 16) / 255] : [1, 1, 1];
};

const originToFlip = origin => {
  switch (origin) {
    case 'top-left': return [1, 0];
    case 'bottom-right': return [0, 1];
    case 'bottom-left': return [1, 1];
    default: return [0, 0];
  }
};

function initSideRays(ctn, opts = {}) {
  const speed = opts.speed ?? 2.5;
  const rayColor1 = opts.rayColor1 || '#EAB308';
  const rayColor2 = opts.rayColor2 || '#96c8ff';
  const intensity = opts.intensity ?? 2;
  const spread = opts.spread ?? 2;
  const origin = opts.origin || 'top-right';
  const tilt = opts.tilt ?? 0;
  const saturation = opts.saturation ?? 1.5;
  const blend = opts.blend ?? 0.75;
  const falloff = opts.falloff ?? 1.6;
  const opacity = opts.opacity ?? 1.0;

  const renderer = new Renderer({
    dpr: getOptimizedDPR(),
    alpha: true
  });
  const gl = renderer.gl;
  gl.canvas.style.width = '100%';
  gl.canvas.style.height = '100%';
  ctn.appendChild(gl.canvas);

  const vert = `
attribute vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}`;

  const frag = `precision highp float;

uniform float iTime;
uniform vec2 iResolution;
uniform float iSpeed;
uniform vec3 iRayColor1;
uniform vec3 iRayColor2;
uniform float iIntensity;
uniform float iSpread;
uniform float iFlipX;
uniform float iFlipY;
uniform float iTilt;
uniform float iSaturation;
uniform float iBlend;
uniform float iFalloff;
uniform float iOpacity;

float rayStrength(vec2 raySource, vec2 rayRefDirection, vec2 coord, float seedA, float seedB, float speed) {
  vec2 sourceToCoord = coord - raySource;
  float cosAngle = dot(normalize(sourceToCoord), rayRefDirection);
  return clamp(
    (0.45 + 0.25 * sin(cosAngle * seedA + iTime * speed)) +
    (0.35 + 0.25 * cos(-cosAngle * seedB + iTime * speed)),
    0.0, 1.0) *
    clamp((iResolution.x * 2.5 - length(sourceToCoord)) / (iResolution.x * 2.5), 0.3, 1.0);
}

void main() {
  vec2 fragCoord = gl_FragCoord.xy;
  if (iFlipX > 0.5) fragCoord.x = iResolution.x - fragCoord.x;
  if (iFlipY > 0.5) fragCoord.y = iResolution.y - fragCoord.y;

  vec2 coord = vec2(fragCoord.x, iResolution.y - fragCoord.y);
  vec2 rayPos = vec2(iResolution.x * 1.1, -0.5 * iResolution.y);

  float tiltRad = iTilt * 3.14159265 / 180.0;
  float cs = cos(tiltRad);
  float sn = sin(tiltRad);
  vec2 rel = coord - rayPos;
  vec2 tiltedCoord = vec2(rel.x * cs - rel.y * sn, rel.x * sn + rel.y * cs) + rayPos;

  float halfSpread = iSpread * 0.45;
  vec2 rayRefDir1 = normalize(vec2(cos(0.785398 + halfSpread), sin(0.785398 + halfSpread)));
  vec2 rayRefDir2 = normalize(vec2(cos(0.785398 - halfSpread), sin(0.785398 - halfSpread)));

  vec4 rays1 = vec4(iRayColor1, 1.0) * rayStrength(rayPos, rayRefDir1, tiltedCoord, 36.2214, 21.11349, iSpeed);
  vec4 rays2 = vec4(iRayColor2, 1.0) * rayStrength(rayPos, rayRefDir2, tiltedCoord, 22.3991, 18.0234, iSpeed * 0.2);

  vec4 color = rays1 * (1.0 - iBlend) + rays2 * iBlend;

  float distanceToLight = length(fragCoord.xy - vec2(rayPos.x, iResolution.y - rayPos.y)) / iResolution.y;
  float brightness = iIntensity * 1.2 / pow(max(distanceToLight, 0.001), iFalloff);
  color.rgb *= brightness;

  float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
  color.rgb = mix(vec3(gray), color.rgb, iSaturation);

  color.a = clamp(max(color.r, max(color.g, color.b)) * iOpacity, 0.0, 1.0);
  gl_FragColor = color;
}`;

  const [flipX, flipY] = originToFlip(origin);
  const uniforms = {
    iTime: { value: 0 },
    iResolution: { value: [1, 1] },
    iSpeed: { value: speed },
    iRayColor1: { value: hexToRgb(rayColor1) },
    iRayColor2: { value: hexToRgb(rayColor2) },
    iIntensity: { value: intensity },
    iSpread: { value: spread },
    iFlipX: { value: flipX },
    iFlipY: { value: flipY },
    iTilt: { value: tilt },
    iSaturation: { value: saturation },
    iBlend: { value: blend },
    iFalloff: { value: falloff },
    iOpacity: { value: opacity }
  };

  const geometry = new Triangle(gl);
  const program = new Program(gl, { vertex: vert, fragment: frag, uniforms });
  const mesh = new Mesh(gl, { geometry, program });

  const updateSize = () => {
    if (!ctn || !renderer) return;
    renderer.dpr = getOptimizedDPR();
    const w = ctn.clientWidth || window.innerWidth;
    const h = ctn.clientHeight || window.innerHeight;
    renderer.setSize(w, h);
    uniforms.iResolution.value = [w * renderer.dpr, h * renderer.dpr];
  };

  let animationId = null;
  const loop = t => {
    if (!isTabVisible) {
      if (typeof raf !== 'undefined') raf = requestAnimationFrame(typeof loop !== 'undefined' ? loop : update);
      else if (typeof rafId !== 'undefined') rafId = requestAnimationFrame(typeof loop !== 'undefined' ? loop : update);
      else if (typeof animateId !== 'undefined') animateId = requestAnimationFrame(typeof loop !== 'undefined' ? loop : update);
      else if (typeof animationId !== 'undefined') animationId = requestAnimationFrame(typeof loop !== 'undefined' ? loop : update);
      return;
    }
    if (isUserScrollingFast && Math.random() < 0.5) {
      if (typeof raf !== 'undefined') raf = requestAnimationFrame(typeof loop !== 'undefined' ? loop : update);
      else if (typeof rafId !== 'undefined') rafId = requestAnimationFrame(typeof loop !== 'undefined' ? loop : update);
      else if (typeof animateId !== 'undefined') animateId = requestAnimationFrame(typeof loop !== 'undefined' ? loop : update);
      else if (typeof animationId !== 'undefined') animationId = requestAnimationFrame(typeof loop !== 'undefined' ? loop : update);
      return;
    }

    uniforms.iTime.value = t * 0.001;
    try {
      renderer.render({ scene: mesh });
      animationId = requestAnimationFrame(loop);
    } catch (e) {}
  };

  window.addEventListener('resize', updateSize);
  updateSize();
  animationId = requestAnimationFrame(loop);

  return () => {
    if (animationId) cancelAnimationFrame(animationId);
    window.removeEventListener('resize', updateSize);
    try {
      const loseCtx = renderer.gl.getExtension('WEBGL_lose_context');
      if (loseCtx) loseCtx.loseContext();
      if (gl.canvas && gl.canvas.parentNode) gl.canvas.parentNode.removeChild(gl.canvas);
    } catch (e) {}
  };
}


// ==========================================
// 3. PLASMA WAVE COMPONENT
// ==========================================
const PLASMA_VERT = /* glsl */ `
attribute vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const PLASMA_FRAG = /* glsl */ `
precision mediump float;
uniform float iTime;
uniform vec2  iResolution;
uniform vec2  uOffset;
uniform float uRotation;
uniform float uFocalLength;
uniform float uSpeed1;
uniform float uSpeed2;
uniform float uDir2;
uniform float uBend1;
uniform float uBend2;
uniform vec3  uColor1;
uniform vec3  uColor2;

const float lt   = 0.3;
const float pi   = 3.14159;
const float pi2  = 6.28318;
const float pi_2 = 1.5708;
#define MAX_STEPS 14

void mainImage(out vec4 C, in vec2 U) {
  float t = iTime * pi;
  float s = 1.0;
  float d = 0.0;
  vec2  R = iResolution;

  vec3 o = vec3(0.0, 0.0, -7.0);
  vec3 u = normalize(vec3((U - 0.5 * R) / R.y, uFocalLength));
  vec2 k = vec2(0.0);
  vec3 p;

  float t1 = t * 0.7;
  float t2 = t * 0.9;
  float tSpeed1 = t * uSpeed1;
  float tSpeed2 = t * uSpeed2 * uDir2;

  for (int i = 0; i < MAX_STEPS; ++i) {
    p = o + u * d;
    p.x -= 15.0;

    float px = p.x;
    float wob1 = uBend1 + sin(t1 + px * 0.8) * 0.1;
    float wob2 = uBend2 + cos(t2 + px * 1.1) * 0.1;

    float px2 = px + pi_2;
    vec2 sinOffset = sin(vec2(px, px2) + tSpeed1) * wob1;
    vec2 cosOffset = cos(vec2(px, px2) + tSpeed2) * wob2;

    vec2 yz = p.yz;
    float pxLt = px + lt;
    k.x = max(pxLt, length(yz - sinOffset) - lt);
    k.y = max(pxLt, length(yz - cosOffset) - lt);

    float current = min(k.x, k.y);
    s = min(s, current);
    if (s < 0.001 || d > 300.0) break;
    d += s * 0.7;
  }

  float sqrtD = sqrt(d);
  vec3 raw = max(cos(d * pi2) - s * sqrtD - vec3(k, 0.0), 0.0);
  raw.gb += 0.1;
  float maxC = max(raw.r, max(raw.g, raw.b));
  if (maxC < 0.15) discard;
  raw = raw * 0.4 + raw.brg * 0.6 + raw * raw;
  float lum = dot(raw, vec3(0.299, 0.587, 0.114));
  float w1 = max(0.0, 1.0 - k.x * 2.0);
  float w2 = max(0.0, 1.0 - k.y * 2.0);
  float wt = w1 + w2 + 0.001;
  vec3 c = (uColor1 * w1 + uColor2 * w2) / wt * lum * 3.5;
  C = vec4(c, 1.0);
}

void main() {
  vec2 coord = gl_FragCoord.xy + uOffset;
  coord -= 0.5 * iResolution;
  float c = cos(uRotation), s = sin(uRotation);
  coord = mat2(c, -s, s, c) * coord;
  coord += 0.5 * iResolution;

  vec4 color;
  mainImage(color, coord);
  gl_FragColor = color;
}
`;

function initPlasmaWave(ctn, opts = {}) {
  const colors = opts.colors || ['#A855F7', '#06B6D4'];
  const speed1 = opts.speed1 ?? 0.05;
  const speed2 = opts.speed2 ?? 0.05;
  const dir2 = opts.dir2 ?? 1.0;
  const focalLength = opts.focalLength ?? 0.8;
  const bend1 = opts.bend1 ?? 1;
  const bend2 = opts.bend2 ?? 0.5;
  const rotationDeg = opts.rotationDeg ?? 0;
  const xOffset = opts.xOffset ?? 0;
  const yOffset = opts.yOffset ?? 0;

  const renderer = new Renderer({
    alpha: true,
    dpr: getOptimizedDPR(),
    antialias: false,
    depth: false,
    stencil: false,
    premultipliedAlpha: false,
    preserveDrawingBuffer: false,
    powerPreference: 'low-power'
  });

  const gl = renderer.gl;
  gl.clearColor(0, 0, 0, 0);
  gl.canvas.style.width = '100%';
  gl.canvas.style.height = '100%';
  ctn.appendChild(gl.canvas);

  const camera = new Camera(gl);
  const scene = new Transform();
  const geometry = new Geometry(gl, {
    position: { size: 2, data: new Float32Array([-1, -1, 3, -1, -1, 3]) }
  });

  const uniformOffset = new Float32Array([xOffset, yOffset]);
  const uniformResolution = new Float32Array([1, 1]);
  const c1 = hexToRgb(colors[0] || '#A855F7');
  const c2 = hexToRgb(colors[1] || '#06B6D4');

  const program = new Program(gl, {
    vertex: PLASMA_VERT,
    fragment: PLASMA_FRAG,
    uniforms: {
      iTime: { value: 0 },
      iResolution: { value: uniformResolution },
      uOffset: { value: uniformOffset },
      uRotation: { value: (rotationDeg * Math.PI) / 180 },
      uFocalLength: { value: focalLength },
      uSpeed1: { value: speed1 },
      uSpeed2: { value: speed2 },
      uDir2: { value: dir2 },
      uBend1: { value: bend1 },
      uBend2: { value: bend2 },
      uColor1: { value: c1 },
      uColor2: { value: c2 }
    }
  });

  new Mesh(gl, { geometry, program }).setParent(scene);

  function resize() {
    if (!ctn) return;
    const { width, height } = ctn.getBoundingClientRect();
    const w = width || window.innerWidth;
    const h = height || window.innerHeight;
    renderer.setSize(w, h);
    uniformResolution[0] = w * renderer.dpr;
    uniformResolution[1] = h * renderer.dpr;
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
  }

  const ro = new ResizeObserver(resize);
  ro.observe(ctn);
  resize();

  const startTime = performance.now();
  let animateId;

  const update = now => {
    if (!isTabVisible) {
      if (typeof raf !== 'undefined') raf = requestAnimationFrame(typeof loop !== 'undefined' ? loop : update);
      else if (typeof rafId !== 'undefined') rafId = requestAnimationFrame(typeof loop !== 'undefined' ? loop : update);
      else if (typeof animateId !== 'undefined') animateId = requestAnimationFrame(typeof loop !== 'undefined' ? loop : update);
      else if (typeof animationId !== 'undefined') animationId = requestAnimationFrame(typeof loop !== 'undefined' ? loop : update);
      return;
    }
    if (isUserScrollingFast && Math.random() < 0.5) {
      if (typeof raf !== 'undefined') raf = requestAnimationFrame(typeof loop !== 'undefined' ? loop : update);
      else if (typeof rafId !== 'undefined') rafId = requestAnimationFrame(typeof loop !== 'undefined' ? loop : update);
      else if (typeof animateId !== 'undefined') animateId = requestAnimationFrame(typeof loop !== 'undefined' ? loop : update);
      else if (typeof animationId !== 'undefined') animationId = requestAnimationFrame(typeof loop !== 'undefined' ? loop : update);
      return;
    }

    program.uniforms.iTime.value = (now - startTime) * 0.001;
    renderer.render({ scene, camera });
    animateId = requestAnimationFrame(update);
  };

  animateId = requestAnimationFrame(update);

  return () => {
    cancelAnimationFrame(animateId);
    ro.disconnect();
    if (ctn && gl.canvas.parentNode === ctn) {
      ctn.removeChild(gl.canvas);
    }
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  };
}


// ==========================================
// 4. FERROFLUID COMPONENT
// ==========================================
const FERRO_VERT = `
attribute vec2 position;
attribute vec2 uv;
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const FERRO_FRAG = `
precision highp float;

uniform vec3  iResolution;
uniform vec2  iMouse;
uniform float iTime;

uniform vec3  uColor0;
uniform vec3  uColor1;
uniform vec3  uColor2;
uniform vec3  uColor3;
uniform vec3  uColor4;
uniform vec3  uColor5;
uniform vec3  uColor6;
uniform vec3  uColor7;
uniform int   uColorCount;

uniform vec3  uMouseColor;
uniform vec2  uFlow;
uniform float uSpeed;
uniform float uScale;
uniform float uTurbulence;
uniform float uFluidity;
uniform float uRimWidth;
uniform float uSharpness;
uniform float uShimmer;
uniform float uGlow;
uniform float uOpacity;
uniform float uMouseEnabled;
uniform float uMouseStrength;
uniform float uMouseRadius;

varying vec2 vUv;

#define PI 3.14159265

vec3 palette(float h) {
  int count = uColorCount;
  if (count < 1) count = 1;
  int idx = int(floor(clamp(h, 0.0, 0.999999) * float(count)));
  if (idx <= 0) return uColor0;
  if (idx == 1) return uColor1;
  if (idx == 2) return uColor2;
  if (idx == 3) return uColor3;
  if (idx == 4) return uColor4;
  if (idx == 5) return uColor5;
  if (idx == 6) return uColor6;
  return uColor7;
}

float hash(vec3 p3) {
  p3 = fract(p3 * 0.1031);
  p3 += dot(p3, p3.zyx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float smin(float a, float b, float k) {
  float r = exp2(-a / k) + exp2(-b / k);
  return -k * log2(r);
}

float sinlerp(float a, float b, float w) {
  return mix(a, b, (sin(w * PI - PI / 2.0) + 1.0) / 2.0);
}

float vn(vec2 p, float s, float seed) {
  vec2 cellp = floor(p / s);
  vec2 relp = mod(p, s);
  float g1 = hash(vec3(cellp, seed));
  float g2 = hash(vec3(cellp.x + 1.0, cellp.y, seed));
  float g3 = hash(vec3(cellp.x + 1.0, cellp.y + 1.0, seed));
  float g4 = hash(vec3(cellp.x, cellp.y + 1.0, seed));
  float bx = sinlerp(g1, g2, relp.x / s);
  float tx = sinlerp(g4, g3, relp.x / s);
  return sinlerp(bx, tx, relp.y / s);
}

float dbn(vec2 p, float s, float seed) {
  float o = s / 2.0;
  float n0 = vn(p, s, seed);
  float n1 = vn(p + vec2(o, o), s, seed + 0.1);
  float n2 = vn(p + vec2(-o, o), s, seed + 0.2);
  float n3 = vn(p + vec2(o, -o), s, seed + 0.3);
  float n4 = vn(p + vec2(-o, -o), s, seed + 0.4);
  return (2.0 * n0 + 1.5 * n1 + 1.25 * n2 + 1.125 * n3 + n4) / 7.0;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float ref = 700.0 / max(uScale, 0.05);
  vec2 p = fragCoord / iResolution.y * ref;

  float spd = 200.0 * uSpeed;
  float t = iTime;

  vec2 dir = uFlow;
  vec2 perp = vec2(-dir.y, dir.x);

  float distort1 = vn(p + perp * (t * spd), 60.0, 10.0) * 50.0 * uTurbulence;
  float distort2 = vn(p - perp * (t * spd), 120.0, 15.0) * 100.0 * uTurbulence;

  float peaks = dbn(p + distort1 + dir * (t * spd * 0.5), 40.0, 1.0);
  float peaks2 = dbn(p + distort2 - dir * (t * spd * 0.5), 40.0, 0.0);

  float mapeaks = smin(peaks, peaks2, max(uFluidity, 0.001));

  float mGlow = 0.0;
  if (uMouseEnabled > 0.5) {
    vec2 mp = iMouse / iResolution.y * ref;
    float md = length(p - mp) / ref;
    float rr = max(uMouseRadius, 0.02);
    mGlow = exp(-md * md / (rr * rr)) * uMouseStrength;
  }

  float band = (uRimWidth - abs((mapeaks - 0.4) * 2.0)) * 5.0;
  float ltn = clamp(band - vn(p + dir * (t * spd * 0.5), 60.0, 12.0) * uShimmer, 0.0, 1.0);
  ltn = pow(ltn, uSharpness) * uGlow;
  ltn *= clamp(1.0 - mGlow, 0.0, 1.0);

  float h = clamp(0.5 + (peaks - peaks2) * 0.8, 0.0, 1.0);
  vec3 col = palette(h);

  vec3 outc = col * ltn;
  float a = clamp(max(outc.r, max(outc.g, outc.b)), 0.0, 1.0);
  fragColor = vec4(outc, a * uOpacity);
}

void main() {
  vec4 color;
  mainImage(color, vUv * iResolution.xy);
  gl_FragColor = color;
}
`;

function prepFerroColors(input) {
  const base = (input && input.length ? input : ['#ffffff', '#ffffff', '#ffffff']).slice(0, MAX_COLORS);
  const count = base.length;
  const arr = [];
  for (let i = 0; i < MAX_COLORS; i++) {
    const c = base[Math.min(i, base.length - 1)].replace('#', '').padEnd(6, '0');
    arr.push([
      parseInt(c.slice(0, 2), 16) / 255,
      parseInt(c.slice(2, 4), 16) / 255,
      parseInt(c.slice(4, 6), 16) / 255
    ]);
  }
  const avg = [0, 0, 0];
  for (let i = 0; i < count; i++) {
    avg[0] += arr[i][0];
    avg[1] += arr[i][1];
    avg[2] += arr[i][2];
  }
  avg[0] /= count; avg[1] /= count; avg[2] /= count;
  return { arr, count, avg };
}

function initFerrofluid(ctn, opts = {}) {
  const colors = opts.colors || ['#ffffff', '#ffffff', '#ffffff'];
  const speed = opts.speed ?? 0.5;
  const scale = opts.scale ?? 1;
  const turbulence = opts.turbulence ?? 1;
  const fluidity = opts.fluidity ?? 0.1;
  const rimWidth = opts.rimWidth ?? 0.2;
  const sharpness = opts.sharpness ?? 3;
  const shimmer = opts.shimmer ?? 1;
  const glow = opts.glow ?? 2;
  const flowDirection = opts.flowDirection || 'down';
  const opacity = opts.opacity ?? 1;
  const mouseInteraction = opts.mouseInteraction ?? true;
  const mouseStrength = opts.mouseStrength ?? 1;
  const mouseRadius = opts.mouseRadius ?? 0.3;
  const mouseDampening = opts.mouseDampening ?? 0.15;

  const renderer = new Renderer({
    dpr: getOptimizedDPR(),
    alpha: true,
    antialias: true
  });
  const gl = renderer.gl;
  const canvas = gl.canvas;
  gl.clearColor(0, 0, 0, 0);
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.display = 'block';
  ctn.appendChild(canvas);

  const { arr, count, avg } = prepFerroColors(colors);
  const flowVec = d => {
    switch (d) {
      case 'up': return [0, 1];
      case 'down': return [0, -1];
      case 'left': return [-1, 0];
      case 'right': return [1, 0];
      default: return [0, -1];
    }
  };

  const uniforms = {
    iResolution: { value: [gl.drawingBufferWidth, gl.drawingBufferHeight, 1] },
    iMouse: { value: [0, 0] },
    iTime: { value: 0 },
    uColor0: { value: arr[0] }, uColor1: { value: arr[1] }, uColor2: { value: arr[2] }, uColor3: { value: arr[3] },
    uColor4: { value: arr[4] }, uColor5: { value: arr[5] }, uColor6: { value: arr[6] }, uColor7: { value: arr[7] },
    uColorCount: { value: count },
    uMouseColor: { value: avg },
    uFlow: { value: flowVec(flowDirection) },
    uSpeed: { value: speed },
    uScale: { value: scale },
    uTurbulence: { value: turbulence },
    uFluidity: { value: fluidity },
    uRimWidth: { value: rimWidth },
    uSharpness: { value: sharpness },
    uShimmer: { value: shimmer },
    uGlow: { value: glow },
    uOpacity: { value: opacity },
    uMouseEnabled: { value: mouseInteraction ? 1 : 0 },
    uMouseStrength: { value: mouseStrength },
    uMouseRadius: { value: mouseRadius }
  };

  const program = new Program(gl, { vertex: FERRO_VERT, fragment: FERRO_FRAG, uniforms });
  const geometry = new Triangle(gl);
  const mesh = new Mesh(gl, { geometry, program });

  const resize = () => {
    const rect = ctn.getBoundingClientRect();
    const w = rect.width || window.innerWidth;
    const h = rect.height || window.innerHeight;
    renderer.setSize(w, h);
    uniforms.iResolution.value = [gl.drawingBufferWidth, gl.drawingBufferHeight, 1];
  };

  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(ctn);

  const mouseTargetRef = [0, 0];
  let lastTime = 0;

  const onPointerMove = e => {
    const rect = canvas.getBoundingClientRect();
    const sc = renderer.dpr || 1;
    const x = (e.clientX - rect.left) * sc;
    const y = (rect.height - (e.clientY - rect.top)) * sc;
    mouseTargetRef[0] = x;
    mouseTargetRef[1] = y;
    if (mouseDampening <= 0) {
      uniforms.iMouse.value = [x, y];
    }
  };

  if (mouseInteraction) {
    window.addEventListener('pointermove', onPointerMove);
  }

  let rafId;
  const loop = t => {
    if (!isTabVisible) {
      if (typeof raf !== 'undefined') raf = requestAnimationFrame(typeof loop !== 'undefined' ? loop : update);
      else if (typeof rafId !== 'undefined') rafId = requestAnimationFrame(typeof loop !== 'undefined' ? loop : update);
      else if (typeof animateId !== 'undefined') animateId = requestAnimationFrame(typeof loop !== 'undefined' ? loop : update);
      else if (typeof animationId !== 'undefined') animationId = requestAnimationFrame(typeof loop !== 'undefined' ? loop : update);
      return;
    }
    if (isUserScrollingFast && Math.random() < 0.5) {
      if (typeof raf !== 'undefined') raf = requestAnimationFrame(typeof loop !== 'undefined' ? loop : update);
      else if (typeof rafId !== 'undefined') rafId = requestAnimationFrame(typeof loop !== 'undefined' ? loop : update);
      else if (typeof animateId !== 'undefined') animateId = requestAnimationFrame(typeof loop !== 'undefined' ? loop : update);
      else if (typeof animationId !== 'undefined') animationId = requestAnimationFrame(typeof loop !== 'undefined' ? loop : update);
      return;
    }

    rafId = requestAnimationFrame(loop);
    uniforms.iTime.value = t * 0.001;
    if (mouseDampening > 0) {
      if (!lastTime) lastTime = t;
      const dt = (t - lastTime) / 1000;
      lastTime = t;
      const tau = Math.max(1e-4, mouseDampening);
      let factor = 1 - Math.exp(-dt / tau);
      if (factor > 1) factor = 1;
      const cur = uniforms.iMouse.value;
      cur[0] += (mouseTargetRef[0] - cur[0]) * factor;
      cur[1] += (mouseTargetRef[1] - cur[1]) * factor;
    } else {
      lastTime = t;
    }
    try {
      renderer.render({ scene: mesh });
    } catch (e) {}
  };

  rafId = requestAnimationFrame(loop);

  return () => {
    if (rafId) cancelAnimationFrame(rafId);
    if (mouseInteraction) window.removeEventListener('pointermove', onPointerMove);
    ro.disconnect();
    if (canvas.parentElement === ctn) ctn.removeChild(canvas);
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  };
}


// ==========================================
// 5. SOFT AURORA COMPONENT
// ==========================================
const AURORA_VERT = `
attribute vec2 position;
attribute vec2 uv;
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const AURORA_FRAG = `
precision highp float;

uniform float uTime;
uniform vec3 uResolution;
uniform float uSpeed;
uniform float uScale;
uniform float uBrightness;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform float uNoiseFreq;
uniform float uNoiseAmp;
uniform float uBandHeight;
uniform float uBandSpread;
uniform float uOctaveDecay;
uniform float uLayerOffset;
uniform float uColorSpeed;
uniform vec2 uMouse;
uniform float uMouseInfluence;
uniform bool uEnableMouse;

varying vec2 vUv;

#define TAU 6.28318

vec3 gradientHash(vec3 p) {
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

float perlinNoise3D(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  vec3 u = f * f * (3.0 - 2.0 * f);

  return mix(
    mix(
      mix(dot(gradientHash(i + vec3(0,0,0)), f - vec3(0,0,0)),
          dot(gradientHash(i + vec3(1,0,0)), f - vec3(1,0,0)), u.x),
      mix(dot(gradientHash(i + vec3(0,1,0)), f - vec3(0,1,0)),
          dot(gradientHash(i + vec3(1,1,0)), f - vec3(1,1,0)), u.x), u.y),
    mix(
      mix(dot(gradientHash(i + vec3(0,0,1)), f - vec3(0,0,1)),
          dot(gradientHash(i + vec3(1,0,1)), f - vec3(1,0,1)), u.x),
      mix(dot(gradientHash(i + vec3(0,1,1)), f - vec3(0,1,1)),
          dot(gradientHash(i + vec3(1,1,1)), f - vec3(1,1,1)), u.x), u.y), u.z);
}

float fbm(vec3 p) {
  float val = 0.0;
  float amp = uNoiseAmp;
  float freq = uNoiseFreq;
  for (int i = 0; i < 4; i++) {
    val += amp * perlinNoise3D(p * freq);
    freq *= 2.0;
    amp *= uOctaveDecay;
  }
  return val;
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution.xy;
  vec2 st = (gl_FragCoord.xy - 0.5 * uResolution.xy) / uResolution.y;
  
  if (uEnableMouse) {
    st += (uMouse - 0.5) * uMouseInfluence;
  }

  float t = uTime * uSpeed;

  vec3 p1 = vec3(st * uScale, t * 0.2);
  float n1 = fbm(p1);

  vec3 p2 = vec3(st * uScale + vec2(1.7, 9.2), t * 0.2 + uLayerOffset);
  float n2 = fbm(p2);

  float dist1 = abs(st.y - (uBandHeight - 0.5) + n1 * 0.3);
  float dist2 = abs(st.y - (uBandHeight - 0.5) + n2 * 0.3);

  float aurora1 = smoothstep(uBandSpread, 0.0, dist1);
  float aurora2 = smoothstep(uBandSpread, 0.0, dist2);

  vec3 col1 = mix(uColor1, uColor2, sin(t * uColorSpeed) * 0.5 + 0.5);
  vec3 col2 = mix(uColor2, uColor1, cos(t * uColorSpeed) * 0.5 + 0.5);

  vec3 finalColor = col1 * aurora1 + col2 * aurora2;
  finalColor *= uBrightness;

  float alpha = clamp(aurora1 + aurora2, 0.0, 1.0);
  gl_FragColor = vec4(finalColor, alpha);
}
`;


// ==========================================
// SOFT AURORA INITIALIZER (React Bits / OGL Perlin 3D)
// ==========================================
function initSoftAurora(container, opts = {}) {
  const {
    speed = 0.6,
    scale = 1.5,
    brightness = 1.0,
    color1 = '#f7f7f7',
    color2 = '#e100ff',
    noiseFrequency = 2.5,
    noiseAmplitude = 1.0,
    bandHeight = 0.5,
    bandSpread = 1.0,
    octaveDecay = 0.1,
    layerOffset = 0,
    colorSpeed = 1.0,
    enableMouseInteraction = true,
    mouseInfluence = 0.25,
    lightMode = false
  } = opts;

  function hexToVec3(hex) {
    const h = (hex || '#ffffff').replace('#', '');
    return [
      parseInt(h.slice(0, 2), 16) / 255,
      parseInt(h.slice(2, 4), 16) / 255,
      parseInt(h.slice(4, 6), 16) / 255
    ];
  }

  const vertexShader = `
  attribute vec2 uv;
  attribute vec2 position;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 0.0, 1.0);
  }
  `;

  const fragmentShader = `
  precision highp float;

  uniform float uTime;
  uniform vec3 uResolution;
  uniform float uSpeed;
  uniform float uScale;
  uniform float uBrightness;
  uniform vec3 uColor1;
  uniform vec3 uColor2;
  uniform float uNoiseFreq;
  uniform float uNoiseAmp;
  uniform float uBandHeight;
  uniform float uBandSpread;
  uniform float uOctaveDecay;
  uniform float uLayerOffset;
  uniform float uColorSpeed;
  uniform vec2 uMouse;
  uniform float uMouseInfluence;
  uniform float uEnableMouse;
  uniform float uLightMode;
  varying vec2 vUv;

  #define TAU 6.28318

  vec3 gradientHash(vec3 p) {
    p = vec3(
      dot(p, vec3(127.1, 311.7, 234.6)),
      dot(p, vec3(269.5, 183.3, 198.3)),
      dot(p, vec3(169.5, 283.3, 156.9))
    );
    vec3 h = fract(sin(p) * 43758.5453123);
    float phi = acos(2.0 * h.x - 1.0);
    float theta = TAU * h.y;
    return vec3(cos(theta) * sin(phi), sin(theta) * cos(phi), cos(phi));
  }

  float quinticSmooth(float t) {
    float t2 = t * t;
    float t3 = t * t2;
    return 6.0 * t3 * t2 - 15.0 * t2 * t2 + 10.0 * t3;
  }

  vec3 cosineGradient(float t, vec3 a, vec3 b, vec3 c, vec3 d) {
    return a + b * cos(TAU * (c * t + d));
  }

  float perlin3D(float amplitude, float frequency, float px, float py, float pz) {
    float x = px * frequency;
    float y = py * frequency;

    float fx = floor(x); float fy = floor(y); float fz = floor(pz);
    float cx = ceil(x);  float cy = ceil(y);  float cz = ceil(pz);

    vec3 g000 = gradientHash(vec3(fx, fy, fz));
    vec3 g100 = gradientHash(vec3(cx, fy, fz));
    vec3 g010 = gradientHash(vec3(fx, cy, fz));
    vec3 g110 = gradientHash(vec3(cx, cy, fz));
    vec3 g001 = gradientHash(vec3(fx, fy, cz));
    vec3 g101 = gradientHash(vec3(cx, fy, cz));
    vec3 g011 = gradientHash(vec3(fx, cy, cz));
    vec3 g111 = gradientHash(vec3(cx, cy, cz));

    float d000 = dot(g000, vec3(x - fx, y - fy, pz - fz));
    float d100 = dot(g100, vec3(x - cx, y - fy, pz - fz));
    float d010 = dot(g010, vec3(x - fx, y - cy, pz - fz));
    float d110 = dot(g110, vec3(x - cx, y - cy, pz - fz));
    float d001 = dot(g001, vec3(x - fx, y - fy, pz - cz));
    float d101 = dot(g101, vec3(x - cx, y - fy, pz - cz));
    float d011 = dot(g011, vec3(x - fx, y - cy, pz - cz));
    float d111 = dot(g111, vec3(x - cx, y - cy, pz - cz));

    float sx = quinticSmooth(x - fx);
    float sy = quinticSmooth(y - fy);
    float sz = quinticSmooth(pz - fz);

    float lx00 = mix(d000, d100, sx);
    float lx10 = mix(d010, d110, sx);
    float lx01 = mix(d001, d101, sx);
    float lx11 = mix(d011, d111, sx);

    float ly0 = mix(lx00, lx10, sy);
    float ly1 = mix(lx01, lx11, sy);

    return amplitude * mix(ly0, ly1, sz);
  }

  float auroraGlow(float t, vec2 shift) {
    vec2 uv = gl_FragCoord.xy / max(uResolution.y, 1.0);
    uv += shift;

    float noiseVal = 0.0;
    float freq = uNoiseFreq;
    float amp = uNoiseAmp;
    vec2 samplePos = uv * uScale;

    for (float i = 0.0; i < 3.0; i += 1.0) {
      noiseVal += perlin3D(amp, freq, samplePos.x, samplePos.y, t);
      amp *= uOctaveDecay;
      freq *= 2.0;
    }

    float yBand = uv.y * 10.0 - uBandHeight * 10.0;
    return 0.3 * max(exp(uBandSpread * (1.0 - 1.1 * abs(noiseVal + yBand))), 0.0);
  }

  void main() {
    vec2 uv = gl_FragCoord.xy / max(uResolution.xy, vec2(1.0));
    float t = uSpeed * 0.4 * uTime;

    vec2 shift = vec2(0.0);
    if (uEnableMouse > 0.5) {
      shift = (uMouse - 0.5) * uMouseInfluence;
    }

    float glow1 = auroraGlow(t, shift);
    float glow2 = auroraGlow(t + uLayerOffset, shift);
    vec3 gradient1 = cosineGradient(uv.x + uTime * uSpeed * 0.2 * uColorSpeed, vec3(0.5), vec3(0.5), vec3(1.0), vec3(0.3, 0.20, 0.20));
    vec3 gradient2 = cosineGradient(uv.x + uTime * uSpeed * 0.1 * uColorSpeed, vec3(0.5), vec3(0.5), vec3(2.0, 1.0, 0.0), vec3(0.5, 0.20, 0.25));

    vec3 col = 0.99 * glow1 * gradient1 * uColor1;
    col += 0.99 * glow2 * gradient2 * uColor2;

    col *= uBrightness;
    float alpha = clamp(length(col), 0.0, 1.0);
    if (uLightMode > 0.5) {
      float phase1 = dot(gradient1, vec3(0.299, 0.587, 0.114));
      float phase2 = dot(gradient2, vec3(0.299, 0.587, 0.114));
      float weight1 = pow(max(glow1 * (0.62 + 0.38 * phase1), 0.0), 1.35);
      float weight2 = pow(max(glow2 * (0.62 + 0.38 * phase2), 0.0), 1.35);
      float weightSum = max(weight1 + weight2, 0.0001);

      vec3 chroma = (weight1 * uColor1 + weight2 * uColor2) / weightSum;
      float neutral = min(chroma.r, min(chroma.g, chroma.b));
      chroma = max(chroma - vec3(neutral * 0.78), vec3(0.0));
      float peak = max(chroma.r, max(chroma.g, chroma.b));
      chroma = pow(clamp(chroma / max(peak, 0.0001), 0.0, 1.0), vec3(1.08));

      float ink = clamp((weight1 + weight2) * uBrightness * 1.55, 0.0, 0.82);
      gl_FragColor = vec4(mix(vec3(1.0), chroma, ink), 1.0);
    } else {
      gl_FragColor = vec4(col, alpha);
    }
  }
  `;

  const renderer = new Renderer({ dpr: getOptimizedDPR(), alpha: true, premultipliedAlpha: false });
  const gl = renderer.gl;
  gl.clearColor(0, 0, 0, 0);
  const canvas = gl.canvas;
  canvas.style.position = 'absolute';
  canvas.style.inset = '0';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.display = 'block';
  container.appendChild(canvas);

  let currentMouse = [0.5, 0.5];
  let targetMouse = [0.5, 0.5];

  const geometry = new Triangle(gl);
  const program = new Program(gl, {
    vertex: vertexShader,
    fragment: fragmentShader,
    uniforms: {
      uTime: { value: 0 },
      uResolution: { value: [gl.canvas.width || 1, gl.canvas.height || 1, 1] },
      uSpeed: { value: speed },
      uScale: { value: scale },
      uBrightness: { value: brightness },
      uColor1: { value: hexToVec3(color1) },
      uColor2: { value: hexToVec3(color2) },
      uNoiseFreq: { value: noiseFrequency },
      uNoiseAmp: { value: noiseAmplitude },
      uBandHeight: { value: bandHeight },
      uBandSpread: { value: bandSpread },
      uOctaveDecay: { value: octaveDecay },
      uLayerOffset: { value: layerOffset },
      uColorSpeed: { value: colorSpeed },
      uMouse: { value: new Float32Array([0.5, 0.5]) },
      uMouseInfluence: { value: mouseInfluence },
      uEnableMouse: { value: enableMouseInteraction ? 1 : 0 },
      uLightMode: { value: lightMode ? 1 : 0 }
    }
  });

  const mesh = new Mesh(gl, { geometry, program });

  const resize = () => {
    const w = container.clientWidth || window.innerWidth || 1;
    const h = container.clientHeight || window.innerHeight || 1;
    renderer.setSize(w, h);
    program.uniforms.uResolution.value = [gl.canvas.width, gl.canvas.height, gl.canvas.width / (gl.canvas.height || 1)];
  };
  const ro = new ResizeObserver(resize);
  ro.observe(container);
  resize();

  const handlePointer = (clientX, clientY) => {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    targetMouse = [
      (clientX - rect.left) / rect.width,
      1.0 - (clientY - rect.top) / rect.height
    ];
  };

  const onMouseMove = e => handlePointer(e.clientX, e.clientY);
  const onTouchMove = e => { if (e.touches.length > 0) handlePointer(e.touches[0].clientX, e.touches[0].clientY); };
  const onPointerLeave = () => { targetMouse = [0.5, 0.5]; };

  if (enableMouseInteraction) {
    container.addEventListener('mousemove', onMouseMove, { passive: true });
    container.addEventListener('mouseleave', onPointerLeave, { passive: true });
    container.addEventListener('touchmove', onTouchMove, { passive: true });
    container.addEventListener('touchend', onPointerLeave, { passive: true });
  }

  let rafId;
  const update = time => {
    if (!isTabVisible) {
      rafId = requestAnimationFrame(update);
      return;
    }
    rafId = requestAnimationFrame(update);
    program.uniforms.uTime.value = time * 0.001;

    if (enableMouseInteraction) {
      currentMouse[0] += 0.05 * (targetMouse[0] - currentMouse[0]);
      currentMouse[1] += 0.05 * (targetMouse[1] - currentMouse[1]);
      program.uniforms.uMouse.value[0] = currentMouse[0];
      program.uniforms.uMouse.value[1] = currentMouse[1];
    }

    renderer.render({ scene: mesh });
  };
  rafId = requestAnimationFrame(update);

  return () => {
    cancelAnimationFrame(rafId);
    ro.disconnect();
    if (enableMouseInteraction) {
      container.removeEventListener('mousemove', onMouseMove);
      container.removeEventListener('mouseleave', onPointerLeave);
      container.removeEventListener('touchmove', onTouchMove);
      container.removeEventListener('touchend', onPointerLeave);
    }
    try { container.removeChild(canvas); } catch {}
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  };
}



// ==========================================
// PARTICLES INITIALIZER (React Bits / OGL 3D Point Cloud)
// ==========================================
function initParticles(container, opts = {}) {
  const {
    particleCount = 200,
    particleSpread = 10,
    speed = 0.1,
    particleColors = ['#ffffff', '#80bfff', '#a855f7'],
    moveParticlesOnHover = true,
    particleHoverFactor = 1,
    alphaParticles = false,
    particleBaseSize = 100,
    sizeRandomness = 1,
    cameraDistance = 20,
    disableRotation = false
  } = opts;

  const defaultColors = ['#ffffff', '#80bfff', '#a855f7'];

  const hexToRgb = hex => {
    hex = (hex || '#ffffff').replace(/^#/, '');
    if (hex.length === 3) {
      hex = hex.split('').map(c => c + c).join('');
    }
    const int = parseInt(hex.slice(0, 6), 16);
    const r = ((int >> 16) & 255) / 255;
    const g = ((int >> 8) & 255) / 255;
    const b = (int & 255) / 255;
    return [r, g, b];
  };

  const vertex = `
    attribute vec3 position;
    attribute vec4 random;
    attribute vec3 color;
    
    uniform mat4 modelMatrix;
    uniform mat4 viewMatrix;
    uniform mat4 projectionMatrix;
    uniform float uTime;
    uniform float uSpread;
    uniform float uBaseSize;
    uniform float uSizeRandomness;
    
    varying vec4 vRandom;
    varying vec3 vColor;
    
    void main() {
      vRandom = random;
      vColor = color;
      
      vec3 pos = position * uSpread;
      pos.z *= 10.0;
      
      vec4 mPos = modelMatrix * vec4(pos, 1.0);
      float t = uTime;
      mPos.x += sin(t * random.z + 6.28 * random.w) * mix(0.1, 1.5, random.x);
      mPos.y += sin(t * random.y + 6.28 * random.x) * mix(0.1, 1.5, random.w);
      mPos.z += sin(t * random.w + 6.28 * random.y) * mix(0.1, 1.5, random.z);
      
      vec4 mvPos = viewMatrix * mPos;

      if (uSizeRandomness == 0.0) {
        gl_PointSize = uBaseSize;
      } else {
        gl_PointSize = (uBaseSize * (1.0 + uSizeRandomness * (random.x - 0.5))) / max(length(mvPos.xyz), 0.01);
      }

      gl_Position = projectionMatrix * mvPos;
    }
  `;

  const fragment = `
    precision highp float;
    
    uniform float uTime;
    uniform float uAlphaParticles;
    varying vec4 vRandom;
    varying vec3 vColor;
    
    void main() {
      vec2 uv = gl_PointCoord.xy;
      float d = length(uv - vec2(0.5));
      
      if (uAlphaParticles < 0.5) {
        if (d > 0.5) discard;
        gl_FragColor = vec4(vColor + 0.2 * sin(uv.yxx + uTime + vRandom.y * 6.28), 1.0);
      } else {
        float circle = smoothstep(0.5, 0.4, d) * 0.8;
        gl_FragColor = vec4(vColor + 0.2 * sin(uv.yxx + uTime + vRandom.y * 6.28), circle);
      }
    }
  `;

  const renderer = new Renderer({
    dpr: getOptimizedDPR(),
    depth: false,
    alpha: true
  });
  const gl = renderer.gl;
  gl.clearColor(0, 0, 0, 0);
  const canvas = gl.canvas;
  canvas.style.position = 'absolute';
  canvas.style.inset = '0';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.display = 'block';
  container.appendChild(canvas);

  const camera = new Camera(gl, { fov: 15 });
  camera.position.set(0, 0, cameraDistance);

  const resize = () => {
    const width = container.clientWidth || window.innerWidth || 1;
    const height = container.clientHeight || window.innerHeight || 1;
    renderer.setSize(width, height);
    camera.perspective({ aspect: gl.canvas.width / (gl.canvas.height || 1) });
  };
  const ro = new ResizeObserver(resize);
  ro.observe(container);
  resize();

  let mouse = { x: 0, y: 0 };
  const handlePointer = (clientX, clientY) => {
    const rect = container.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const x = ((clientX - rect.left) / rect.width) * 2 - 1;
    const y = -(((clientY - rect.top) / rect.height) * 2 - 1);
    mouse = { x, y };
  };

  const onMouseMove = e => handlePointer(e.clientX, e.clientY);
  const onTouchMove = e => { if (e.touches.length > 0) handlePointer(e.touches[0].clientX, e.touches[0].clientY); };

  if (moveParticlesOnHover) {
    container.addEventListener('mousemove', onMouseMove, { passive: true });
    container.addEventListener('touchmove', onTouchMove, { passive: true });
  }

  const count = particleCount;
  const positions = new Float32Array(count * 3);
  const randoms = new Float32Array(count * 4);
  const colors = new Float32Array(count * 3);
  const palette = particleColors && particleColors.length > 0 ? particleColors : defaultColors;

  for (let i = 0; i < count; i++) {
    let x, y, z, len;
    do {
      x = Math.random() * 2 - 1;
      y = Math.random() * 2 - 1;
      z = Math.random() * 2 - 1;
      len = x * x + y * y + z * z;
    } while (len > 1 || len === 0);
    const r = Math.cbrt(Math.random());
    positions.set([x * r, y * r, z * r], i * 3);
    randoms.set([Math.random(), Math.random(), Math.random(), Math.random()], i * 4);
    const col = hexToRgb(palette[Math.floor(Math.random() * palette.length)]);
    colors.set(col, i * 3);
  }

  const geometry = new Geometry(gl, {
    position: { size: 3, data: positions },
    random: { size: 4, data: randoms },
    color: { size: 3, data: colors }
  });

  const program = new Program(gl, {
    vertex,
    fragment,
    uniforms: {
      uTime: { value: 0 },
      uSpread: { value: particleSpread },
      uBaseSize: { value: particleBaseSize * getOptimizedDPR() },
      uSizeRandomness: { value: sizeRandomness },
      uAlphaParticles: { value: alphaParticles ? 1 : 0 }
    },
    transparent: true,
    depthTest: false
  });

  const particles = new Mesh(gl, { mode: gl.POINTS, geometry, program });

  let animationFrameId;
  let lastTime = performance.now();
  let elapsed = 0;

  const update = t => {
    if (!isTabVisible) {
      animationFrameId = requestAnimationFrame(update);
      return;
    }
    animationFrameId = requestAnimationFrame(update);
    const delta = t - lastTime;
    lastTime = t;
    elapsed += delta * speed;

    program.uniforms.uTime.value = elapsed * 0.001;

    if (moveParticlesOnHover) {
      particles.position.x = -mouse.x * particleHoverFactor;
      particles.position.y = -mouse.y * particleHoverFactor;
    } else {
      particles.position.x = 0;
      particles.position.y = 0;
    }

    if (!disableRotation) {
      particles.rotation.x = Math.sin(elapsed * 0.0002) * 0.1;
      particles.rotation.y = Math.cos(elapsed * 0.0005) * 0.15;
      particles.rotation.z += 0.01 * speed;
    }

    renderer.render({ scene: particles, camera });
  };

  animationFrameId = requestAnimationFrame(update);

  return () => {
    cancelAnimationFrame(animationFrameId);
    ro.disconnect();
    if (moveParticlesOnHover) {
      container.removeEventListener('mousemove', onMouseMove);
      container.removeEventListener('touchmove', onTouchMove);
    }
    try { container.removeChild(canvas); } catch {}
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  };
}



// ==========================================
// GHOST FIBERS INITIALIZER (React Bits / OGL Luminous Waveform)
// ==========================================
function initGhostFibers(container, opts = {}) {
  const {
    lineColor = '#140E35',
    glowColor = '#3437A0',
    speed = 0.2,
    scale = 2,
    rotation = 0,
    rotationSpeed = 0.25,
    layers = 4,
    waveAmplitude = 0.015,
    waveFrequency = 3,
    waveSpeed = 0.15,
    layerSpeed = 0.08,
    twist = 0.1,
    twistFrequency = 5,
    twistSpeed = 1.2,
    lineFrequency = 5,
    lineSpacing = 2,
    lineSharpness = 16,
    glowFalloff = 10,
    glowIntensity = 1.6,
    brightness = 2,
    blueBoost = 1.25,
    vignette = 0.8,
    grain = 0.05,
    lightMode = false
  } = opts;

  const hexToRgb = hex => {
    const value = (hex || '#000000').trim().replace(/^#/, '');
    const normalized = value.length === 3 ? value.replace(/./g, channel => channel + channel) : value;
    const match = /^([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(normalized);
    if (!match) return [1, 1, 1];
    return [parseInt(match[1], 16) / 255, parseInt(match[2], 16) / 255, parseInt(match[3], 16) / 255];
  };

  const vertex = `
  attribute vec2 position;
  attribute vec2 uv;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 0.0, 1.0);
  }
  `;

  const fragment = `
  precision highp float;

  uniform vec2 uResolution;
  uniform float uTime;
  uniform float uSpeed;
  uniform float uScale;
  uniform float uRotation;
  uniform float uLayers;
  uniform float uWaveAmplitude;
  uniform float uWaveFrequency;
  uniform float uWaveSpeed;
  uniform float uLayerSpeed;
  uniform float uTwist;
  uniform float uTwistFrequency;
  uniform float uTwistSpeed;
  uniform float uLineFrequency;
  uniform float uLineSpacing;
  uniform float uLineSharpness;
  uniform float uGlowFalloff;
  uniform float uGlowIntensity;
  uniform float uBrightness;
  uniform float uBlueBoost;
  uniform float uVignette;
  uniform float uGrain;
  uniform float uRotationSpeed;
  uniform float uLightMode;
  uniform vec3 uLineColor;
  uniform vec3 uGlowColor;
  varying vec2 vUv;

  #define MAX_LAYERS 10

  mat2 rotate2d(float angle) {
    float sine = sin(angle);
    float cosine = cos(angle);
    return mat2(cosine, -sine, sine, cosine);
  }

  float grainHash(vec2 point) {
    point = floor(point);
    float hash = 52.9829189 * fract(dot(point, vec2(0.065, 0.005)));
    return fract(hash);
  }

  float layeredGrain(vec2 fragmentPixel) {
    vec2 point = mod(fragmentPixel + vec2(uTime * 30.0, -uTime * 21.0), 1024.0);
    vec2 rotated = mat2(0.8, -0.5, 0.5, 0.8) * point;
    float grain = 0.0;
    grain += 0.40 * grainHash(rotated);
    grain += 0.25 * grainHash(rotated * 2.0 + 17.0);
    grain += 0.20 * grainHash(rotated * 4.0 + 47.0);
    grain += 0.10 * grainHash(rotated * 8.0 + 113.0);
    grain += 0.05 * grainHash(rotated * 16.0 + 191.0);
    return grain;
  }

  void main() {
    vec2 resolution = max(uResolution, vec2(1.0));
    vec2 uv = (2.0 * gl_FragCoord.xy - resolution) / resolution.y;
    float time = uTime * uSpeed;
    vec3 backdrop = mix(vec3(0.070588, 0.058824, 0.090196), vec3(1.0), step(0.5, uLightMode));
    vec3 centerTone = max(uLineColor * 0.85567 - uGlowColor * 0.06186, vec3(0.0));
    vec3 cloudTone = uLineColor * 0.19588 + uGlowColor * 0.2268;
    vec2 p = uv;
    p /= max(uScale, 0.05);
    p = rotate2d(radians(uRotation) + time * uRotationSpeed) * p;
    vec3 color = vec3(0.0);
    float fiberField = 0.0;

    for (int index = 0; index < MAX_LAYERS; index++) {
      float fi = float(index) + 1.0;
      if (fi > uLayers) break;

      p += uWaveAmplitude * sin(p.yx * fi * uWaveFrequency + time * (uWaveSpeed + fi * uLayerSpeed));

      float radius = length(p);
      float polarAngle = atan(p.y, p.x);
      polarAngle += sin(radius * uTwistFrequency - time * uTwistSpeed + fi) * uTwist;
      p = vec2(cos(polarAngle), sin(polarAngle)) * radius;

      float lines = abs(sin(p.x * (uLineFrequency + fi * uLineSpacing) + sin(p.y * 3.0 + time)));
      lines = pow(max(0.0, 1.0 - lines), uLineSharpness);
      fiberField += lines / fi;
      color += uLineColor * lines / fi;

      float glow = exp(-uGlowFalloff * abs(sin(p.x * 3.0 + time + fi)));
      color += uGlowColor * glow * uGlowIntensity / (fi * 2.0);
    }

    float center = exp(-2.2 * dot(uv, uv));
    color += centerTone * center;

    float cloud = exp(-1.5 * length(uv + vec2(sin(time * 0.3) * 0.25, cos(time * 0.25) * 0.18)));
    color += cloudTone * cloud;

    float vignette = 1.0 - smoothstep(0.35, 1.45, length(uv));
    color *= mix(1.0 - uVignette, 1.0, vignette);
    color = 1.0 - exp(-color * uBrightness);
    color.b *= uBlueBoost;

    vec3 outputColor;
    if (uLightMode > 0.5) {
      float edgeFade = mix(1.0 - uVignette, 1.0, vignette);
      float fibers = pow(smoothstep(0.12, 1.05, fiberField) * edgeFade, 1.5);
      float atmosphere = (center * 0.025 + cloud * 0.015) * edgeFade;
      vec3 fiberInk = mix(backdrop, uLineColor, 0.52);
      vec3 airColor = mix(backdrop, uGlowColor, 0.16);

      outputColor = mix(backdrop, airColor, atmosphere);
      outputColor = mix(outputColor, fiberInk, fibers * 0.3);
    } else {
      outputColor = backdrop + color;
    }

    float noise = (layeredGrain(gl_FragCoord.xy) - 0.5) * uGrain;
    outputColor = clamp(outputColor + noise, 0.0, 1.0);
    gl_FragColor = vec4(outputColor, 1.0);
  }
  `;

  const renderer = new Renderer({
    dpr: getOptimizedDPR(),
    alpha: false,
    antialias: false
  });
  const gl = renderer.gl;
  const canvas = gl.canvas;
  canvas.style.position = 'absolute';
  canvas.style.inset = '0';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.display = 'block';
  container.appendChild(canvas);

  const geometry = new Triangle(gl);
  const program = new Program(gl, {
    vertex,
    fragment,
    uniforms: {
      uResolution: { value: new Float32Array([gl.canvas.width || 1, gl.canvas.height || 1]) },
      uTime: { value: 0 },
      uSpeed: { value: speed },
      uScale: { value: scale },
      uRotation: { value: rotation },
      uRotationSpeed: { value: rotationSpeed },
      uLayers: { value: Math.min(Math.max(Math.round(layers), 1), 10) },
      uWaveAmplitude: { value: waveAmplitude },
      uWaveFrequency: { value: waveFrequency },
      uWaveSpeed: { value: waveSpeed },
      uLayerSpeed: { value: layerSpeed },
      uTwist: { value: twist },
      uTwistFrequency: { value: twistFrequency },
      uTwistSpeed: { value: twistSpeed },
      uLineFrequency: { value: lineFrequency },
      uLineSpacing: { value: lineSpacing },
      uLineSharpness: { value: lineSharpness },
      uGlowFalloff: { value: glowFalloff },
      uGlowIntensity: { value: glowIntensity },
      uBrightness: { value: brightness },
      uBlueBoost: { value: blueBoost },
      uVignette: { value: vignette },
      uGrain: { value: grain },
      uLightMode: { value: lightMode ? 1 : 0 },
      uLineColor: { value: new Float32Array(hexToRgb(lineColor)) },
      uGlowColor: { value: new Float32Array(hexToRgb(glowColor)) }
    }
  });

  const mesh = new Mesh(gl, { geometry, program });

  const resize = () => {
    const w = container.clientWidth || window.innerWidth || 1;
    const h = container.clientHeight || window.innerHeight || 1;
    renderer.setSize(w, h);
    program.uniforms.uResolution.value[0] = gl.drawingBufferWidth;
    program.uniforms.uResolution.value[1] = gl.drawingBufferHeight;
  };
  const ro = new ResizeObserver(resize);
  ro.observe(container);
  resize();

  let rafId;
  let elapsed = 0;
  let previousTime = performance.now();

  const loop = now => {
    if (!isTabVisible) {
      rafId = requestAnimationFrame(loop);
      return;
    }
    rafId = requestAnimationFrame(loop);
    const delta = Math.min((now - previousTime) / 1000, 0.1);
    previousTime = now;
    elapsed += delta;

    program.uniforms.uTime.value = elapsed;
    renderer.render({ scene: mesh });
  };
  rafId = requestAnimationFrame(loop);

  return () => {
    cancelAnimationFrame(rafId);
    ro.disconnect();
    try { container.removeChild(canvas); } catch {}
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  };
}


// ==========================================
// 6. DITHER COMPONENT
// ==========================================
const DITHER_WAVE_VERT = `
attribute vec2 position;
attribute vec2 uv;
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const DITHER_WAVE_FRAG = `
precision highp float;
uniform vec2 resolution;
uniform float time;
uniform float waveSpeed;
uniform float waveFrequency;
uniform float waveAmplitude;
uniform vec3 waveColor;
uniform vec2 mousePos;
uniform int enableMouseInteraction;
uniform float mouseRadius;

varying vec2 vUv;

vec4 mod289(vec4 x) { return x - floor(x * (1.0/289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
vec2 fade(vec2 t) { return t*t*t*(t*(t*6.0-15.0)+10.0); }

float cnoise(vec2 P) {
  vec4 Pi = floor(P.xyxy) + vec4(0.0,0.0,1.0,1.0);
  vec4 Pf = fract(P.xyxy) - vec4(0.0,0.0,1.0,1.0);
  Pi = mod289(Pi);
  vec4 ix = Pi.xzxz;
  vec4 iy = Pi.yyww;
  vec4 fx = Pf.xzxz;
  vec4 fy = Pf.yyww;
  vec4 i = permute(permute(ix) + iy);
  vec4 gx = fract(i * (1.0/41.0)) * 2.0 - 1.0;
  vec4 gy = abs(gx) - 0.5;
  vec4 tx = floor(gx + 0.5);
  gx = gx - tx;
  vec2 g00 = vec2(gx.x, gy.x);
  vec2 g10 = vec2(gx.y, gy.y);
  vec2 g01 = vec2(gx.z, gy.z);
  vec2 g11 = vec2(gx.w, gy.w);
  vec4 norm = taylorInvSqrt(vec4(dot(g00,g00), dot(g01,g01), dot(g10,g10), dot(g11,g11)));
  g00 *= norm.x; g01 *= norm.y; g10 *= norm.z; g11 *= norm.w;
  float n00 = dot(g00, vec2(fx.x, fy.x));
  float n10 = dot(g10, vec2(fx.y, fy.y));
  float n01 = dot(g01, vec2(fx.z, fy.z));
  float n11 = dot(g11, vec2(fx.w, fy.w));
  vec2 fade_xy = fade(Pf.xy);
  vec2 n_x = mix(vec2(n00, n01), vec2(n10, n11), fade_xy.x);
  return 2.3 * mix(n_x.x, n_x.y, fade_xy.y);
}

const int OCTAVES = 4;
float fbm(vec2 p) {
  float value = 0.0;
  float amp = 1.0;
  float freq = waveFrequency;
  for (int i = 0; i < OCTAVES; i++) {
    value += amp * abs(cnoise(p));
    p *= freq;
    amp *= waveAmplitude;
  }
  return value;
}

float pattern(vec2 p) {
  vec2 p2 = p - time * waveSpeed;
  return fbm(p + fbm(p2)); 
}

void main() {
  vec2 uv = gl_FragCoord.xy / resolution.xy;
  uv -= 0.5;
  uv.x *= resolution.x / resolution.y;
  float f = pattern(uv);
  if (enableMouseInteraction == 1) {
    vec2 mouseNDC = (mousePos / resolution - 0.5) * vec2(1.0, -1.0);
    mouseNDC.x *= resolution.x / resolution.y;
    float dist = length(uv - mouseNDC);
    float effect = 1.0 - smoothstep(0.0, mouseRadius, dist);
    f -= 0.5 * effect;
  }
  vec3 col = mix(vec3(0.0), waveColor, f);
  gl_FragColor = vec4(col, 1.0);
}
`;

const DITHER_SCREEN_FRAG = `
precision highp float;
uniform sampler2D tDiffuse;
uniform vec2 resolution;
uniform float colorNum;
uniform float pixelSize;

varying vec2 vUv;

float bayer4x4(vec2 p) {
  vec4 m0 = vec4( 0.0,  8.0,  2.0, 10.0) / 16.0;
  vec4 m1 = vec4(12.0,  4.0, 14.0,  6.0) / 16.0;
  vec4 m2 = vec4( 3.0, 11.0,  1.0,  9.0) / 16.0;
  vec4 m3 = vec4(15.0,  7.0, 13.0,  5.0) / 16.0;
  int x = int(mod(p.x, 4.0));
  int y = int(mod(p.y, 4.0));
  if (y == 0) return (x==0?m0.x:(x==1?m0.y:(x==2?m0.z:m0.w)));
  if (y == 1) return (x==0?m1.x:(x==1?m1.y:(x==2?m1.z:m1.w)));
  if (y == 2) return (x==0?m2.x:(x==1?m2.y:(x==2?m2.z:m2.w)));
  return (x==0?m3.x:(x==1?m3.y:(x==2?m3.z:m3.w)));
}

float bayer8x8(vec2 p) {
  vec2 p4 = floor(p * 0.5);
  float b4 = bayer4x4(p4);
  vec2 p2 = mod(p, 2.0);
  float b2 = (p2.y > 0.5) ? ((p2.x > 0.5) ? 0.75 : 0.25) : ((p2.x > 0.5) ? 0.5 : 0.0);
  return b4 * 0.75 + b2 * 0.25;
}

vec3 dither(vec2 uv, vec3 color) {
  vec2 scaledCoord = floor(uv * resolution / pixelSize);
  float threshold = bayer8x8(scaledCoord) - 0.25;
  float step = 1.0 / (colorNum - 1.0);
  color += threshold * step;
  color = clamp(color, 0.0, 1.0);
  return floor(color * (colorNum - 1.0) + 0.5) / (colorNum - 1.0);
}

void main() {
  vec2 normalizedPixelSize = pixelSize / resolution;
  vec2 uvPixel = normalizedPixelSize * floor(vUv / normalizedPixelSize);
  vec4 color = texture2D(tDiffuse, uvPixel);
  color.rgb = dither(vUv, color.rgb);
  gl_FragColor = color;
}
`;

function initDither(ctn, opts = {}) {
  const waveSpeed = opts.waveSpeed ?? 0.05;
  const waveFrequency = opts.waveFrequency ?? 3;
  const waveAmplitude = opts.waveAmplitude ?? 0.3;
  const waveColor = opts.waveColor || [0.5, 0.5, 0.5];
  const colorNum = opts.colorNum ?? 4;
  const pixelSize = opts.pixelSize ?? 2;
  const enableMouse = opts.enableMouseInteraction ?? true;
  const mouseRadius = opts.mouseRadius ?? 0.3;

  const renderer = new Renderer({ dpr: getOptimizedDPR(), alpha: true, antialias: false, powerPreference: 'low-power' });
  const gl = renderer.gl;
  gl.canvas.style.width = '100%';
  gl.canvas.style.height = '100%';
  ctn.appendChild(gl.canvas);

  const geometry = new Triangle(gl);

  const waveProgram = new Program(gl, {
    vertex: DITHER_WAVE_VERT,
    fragment: DITHER_WAVE_FRAG,
    uniforms: {
      time: { value: 0 },
      resolution: { value: [ctn.offsetWidth, ctn.offsetHeight] },
      waveSpeed: { value: waveSpeed },
      waveFrequency: { value: waveFrequency },
      waveAmplitude: { value: waveAmplitude },
      waveColor: { value: waveColor },
      mousePos: { value: [0, 0] },
      enableMouseInteraction: { value: enableMouse ? 1 : 0 },
      mouseRadius: { value: mouseRadius }
    }
  });

  const waveMesh = new Mesh(gl, { geometry, program: waveProgram });
  const renderTarget = new RenderTarget(gl, { width: ctn.offsetWidth, height: ctn.offsetHeight });

  const ditherProgram = new Program(gl, {
    vertex: DITHER_WAVE_VERT,
    fragment: DITHER_SCREEN_FRAG,
    uniforms: {
      tDiffuse: { value: renderTarget.texture },
      resolution: { value: [ctn.offsetWidth, ctn.offsetHeight] },
      colorNum: { value: colorNum },
      pixelSize: { value: pixelSize }
    }
  });

  const ditherMesh = new Mesh(gl, { geometry, program: ditherProgram });

  function resize() {
    const w = ctn.offsetWidth || window.innerWidth;
    const h = ctn.offsetHeight || window.innerHeight;
    renderer.setSize(w, h);
    renderTarget.setSize(w, h);
    waveProgram.uniforms.resolution.value = [w, h];
    ditherProgram.uniforms.resolution.value = [w, h];
  }
  window.addEventListener('resize', resize);
  resize();

  const onPointerMove = e => {
    const rect = gl.canvas.getBoundingClientRect();
    waveProgram.uniforms.mousePos.value = [(e.clientX - rect.left), (e.clientY - rect.top)];
  };
  if (enableMouse) {
    window.addEventListener('pointermove', onPointerMove);
  }

  let rafId;
  const loop = t => {
    if (!isTabVisible) {
      if (typeof raf !== 'undefined') raf = requestAnimationFrame(typeof loop !== 'undefined' ? loop : update);
      else if (typeof rafId !== 'undefined') rafId = requestAnimationFrame(typeof loop !== 'undefined' ? loop : update);
      else if (typeof animateId !== 'undefined') animateId = requestAnimationFrame(typeof loop !== 'undefined' ? loop : update);
      else if (typeof animationId !== 'undefined') animationId = requestAnimationFrame(typeof loop !== 'undefined' ? loop : update);
      return;
    }
    if (isUserScrollingFast && Math.random() < 0.5) {
      if (typeof raf !== 'undefined') raf = requestAnimationFrame(typeof loop !== 'undefined' ? loop : update);
      else if (typeof rafId !== 'undefined') rafId = requestAnimationFrame(typeof loop !== 'undefined' ? loop : update);
      else if (typeof animateId !== 'undefined') animateId = requestAnimationFrame(typeof loop !== 'undefined' ? loop : update);
      else if (typeof animationId !== 'undefined') animationId = requestAnimationFrame(typeof loop !== 'undefined' ? loop : update);
      return;
    }

    rafId = requestAnimationFrame(loop);
    waveProgram.uniforms.time.value = t * 0.001;
    try {
      renderer.render({ scene: waveMesh, target: renderTarget });
      ditherProgram.uniforms.tDiffuse.value = renderTarget.texture;
      renderer.render({ scene: ditherMesh });
    } catch (e) {}
  };
  rafId = requestAnimationFrame(loop);

  return () => {
    if (rafId) cancelAnimationFrame(rafId);
    window.removeEventListener('resize', resize);
    if (enableMouse) window.removeEventListener('pointermove', onPointerMove);
    if (ctn && gl.canvas.parentNode === ctn) ctn.removeChild(gl.canvas);
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  };
}


// ==========================================
// 7. DARK VEIL COMPONENT
// ==========================================
const VEIL_VERT = `
attribute vec2 position;
attribute vec2 uv;
varying vec2 vUv;
void main(){
  vUv = uv;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const VEIL_FRAG = `
precision highp float;
uniform vec2 uResolution;
uniform float uTime;
uniform float uHueShift;
uniform float uNoise;
uniform float uScan;
uniform float uScanFreq;
uniform float uWarp;

varying vec2 vUv;

#define iTime uTime
#define iResolution uResolution

vec4 buf[8];
float rand(vec2 c){return fract(sin(dot(c,vec2(12.9898,78.233)))*43758.5453);}

mat3 rgb2yiq=mat3(0.299,0.587,0.114,0.596,-0.274,-0.322,0.211,-0.523,0.312);
mat3 yiq2rgb=mat3(1.0,0.956,0.621,1.0,-0.272,-0.647,1.0,-1.106,1.703);

vec3 hueShiftRGB(vec3 col,float deg){
    vec3 yiq=rgb2yiq*col;
    float rad=radians(deg);
    float cosh=cos(rad),sinh=sin(rad);
    vec3 yiqShift=vec3(yiq.x,yiq.y*cosh-yiq.z*sinh,yiq.y*sinh+yiq.z*cosh);
    return clamp(yiq2rgb*yiqShift,0.0,1.0);
}

vec4 sigmoid(vec4 x){return 1./(1.+exp(-x));}

vec4 cppn_fn(vec2 coordinate,float in0,float in1,float in2){
    buf[6]=vec4(coordinate.x,coordinate.y,0.3948333106474662+in0,0.36+in1);
    buf[7]=vec4(0.14+in2,sqrt(coordinate.x*coordinate.x+coordinate.y*coordinate.y),0.,0.);
    buf[0]=mat4(vec4(6.5404263,-3.6126034,0.7590882,-1.13613),vec4(2.4582713,3.1660357,1.2219609,0.06276096),vec4(-5.478085,-6.159632,1.8701609,-4.7742867),vec4(6.039214,-5.542865,-0.90925294,3.251348))*buf[6]+mat4(vec4(0.8473259,-5.722911,3.975766,1.6522468),vec4(-0.24321538,0.5839259,-1.7661959,-5.350116),vec4(0.,0.,0.,0.),vec4(0.,0.,0.,0.))*buf[7]+vec4(0.21808943,1.1243913,-1.7969975,5.0294676);
    buf[1]=mat4(vec4(-3.3522482,-6.0612736,0.55641043,-4.4719114),vec4(0.8631464,1.7432913,5.643898,1.6106541),vec4(2.4941394,-3.5012043,1.7184316,6.357333),vec4(3.310376,8.209261,1.1355612,-1.165539))*buf[6]+mat4(vec4(5.24046,-13.034365,0.009859298,15.870829),vec4(2.987511,3.129433,-0.89023495,-1.6822904),vec4(0.,0.,0.,0.),vec4(0.,0.,0.,0.))*buf[7]+vec4(-5.9457836,-6.573602,-0.8812491,1.5436668);
    buf[0]=sigmoid(buf[0]);buf[1]=sigmoid(buf[1]);
    buf[2]=mat4(vec4(-15.219568,8.095543,-2.429353,-1.9381982),vec4(-5.951362,4.3115187,2.6393783,1.274315),vec4(-7.3145227,6.7297835,5.2473326,5.9411426),vec4(5.0796127,8.979051,-1.7278991,-1.158976))*buf[6]+mat4(vec4(-11.967154,-11.608155,6.1486754,11.237008),vec4(2.124141,-6.263192,-1.7050359,-0.7021966),vec4(0.,0.,0.,0.),vec4(0.,0.,0.,0.))*buf[7]+vec4(-4.17164,-3.2281182,-4.576417,-3.6401186);
    buf[3]=mat4(vec4(3.1832156,-13.738922,1.879223,3.233465),vec4(0.64300746,12.768129,1.9141049,0.50990224),vec4(-0.049295485,4.4807224,1.4733979,1.801449),vec4(5.0039253,13.000481,3.3991797,-4.5561905))*buf[6]+mat4(vec4(-0.1285731,7.720628,-3.1425676,4.742367),vec4(0.6393625,3.714393,-0.8108378,-0.39174938),vec4(0.,0.,0.,0.),vec4(0.,0.,0.,0.))*buf[7]+vec4(-1.1811101,-21.621881,0.7851888,1.2329718);
    buf[2]=sigmoid(buf[2]);buf[3]=sigmoid(buf[3]);
    buf[4]=mat4(vec4(5.214916,-7.183024,2.7228765,2.6592617),vec4(-5.601878,-25.3591,4.067988,0.4602802),vec4(-10.57759,24.286327,21.102104,37.546658),vec4(4.3024497,-1.9625226,2.3458803,-1.372816))*buf[0]+mat4(vec4(-17.6526,-10.507558,2.2587414,12.462782),vec4(6.265566,-502.75443,-12.642513,0.9112289),vec4(-10.983244,20.741234,-9.701768,-0.7635988),vec4(5.383626,1.4819539,-4.1911616,-4.8444734))*buf[1]+mat4(vec4(12.785233,-16.345072,-0.39901125,1.7955981),vec4(-30.48365,-1.8345358,1.4542528,-1.1118771),vec4(19.872723,-7.337935,-42.941723,-98.52709),vec4(8.337645,-2.7312303,-2.2927687,-36.142323))*buf[2]+mat4(vec4(-16.298317,3.5471997,-0.44300047,-9.444417),vec4(57.5077,-35.609753,16.163465,-4.1534753),vec4(-0.07470326,-3.8656476,-7.0901804,3.1523974),vec4(-12.559385,-7.077619,1.490437,-0.8211543))*buf[3]+vec4(-7.67914,15.927437,1.3207729,-1.6686112);
    buf[5]=mat4(vec4(-1.4109162,-0.372762,-3.770383,-21.367174),vec4(-6.2103205,-9.35908,0.92529047,8.82561),vec4(11.460242,-22.348068,13.625772,-18.693201),vec4(-0.3429052,-3.9905605,-2.4626114,-0.45033523))*buf[0]+mat4(vec4(7.3481627,-4.3661838,-6.3037653,-3.868115),vec4(1.5462853,6.5488915,1.9701879,-0.58291394),vec4(6.5858274,-2.2180402,3.7127688,-1.3730392),vec4(-5.7973905,10.134961,-2.3395722,-5.965605))*buf[1]+mat4(vec4(-2.5132585,-6.6685553,-1.4029363,-0.16285264),vec4(-0.37908727,0.53738135,4.389061,-1.3024765),vec4(-0.70647055,2.0111287,-5.1659346,-3.728635),vec4(-13.562562,10.487719,-0.9173751,-2.6487076))*buf[2]+mat4(vec4(-8.645013,6.5546675,-6.3944063,-5.5933375),vec4(-0.57783127,-1.077275,36.91025,5.736769),vec4(14.283112,3.7146652,7.1452246,-4.5958776),vec4(2.7192075,3.6021907,-4.366337,-2.3653464))*buf[3]+vec4(-5.9000807,-4.329569,1.2427121,8.59503);
    buf[4]=sigmoid(buf[4]);buf[5]=sigmoid(buf[5]);
    buf[6]=mat4(vec4(-1.61102,0.7970257,1.4675229,0.20917463),vec4(-28.793737,-7.1390953,1.5025433,4.656581),vec4(-10.94861,39.66238,0.74318546,-10.095605),vec4(-0.7229728,-1.5483948,0.7301322,2.1687684))*buf[0]+mat4(vec4(3.2547753,21.489103,-1.0194173,-3.3100595),vec4(-3.7316632,-3.3792162,-7.223193,-0.23685838),vec4(13.1804495,0.7916005,5.338587,5.687114),vec4(-4.167605,-17.798311,-6.815736,-1.6451967))*buf[1]+mat4(vec4(0.604885,-7.800309,-7.213122,-2.741014),vec4(-3.522382,-0.12359311,-0.5258442,0.43852118),vec4(9.6752825,-22.853785,2.062431,0.099892326),vec4(-4.3196306,-17.730087,2.5184598,5.30267))*buf[2]+mat4(vec4(-6.545563,-15.790176,-6.0438633,-5.415399),vec4(-43.591583,28.551912,-16.00161,18.84728),vec4(4.212382,8.394307,3.0958717,8.657522),vec4(-5.0237565,-4.450633,-4.4768,-5.5010443))*buf[3]+mat4(vec4(1.6985557,-67.05806,6.897715,1.9004834),vec4(1.8680354,2.3915145,2.5231109,4.081538),vec4(11.158006,1.7294737,2.0738268,7.386411),vec4(-4.256034,-306.24686,8.258898,-17.132736))*buf[4]+mat4(vec4(1.6889864,-4.5852966,3.8534803,-6.3482175),vec4(1.3543309,-1.2640043,9.932754,2.9079645),vec4(-5.2770967,0.07150358,-0.13962056,3.3269649),vec4(28.34703,-4.918278,6.1044083,4.085355))*buf[5]+vec4(6.6818056,12.522166,-3.7075126,-4.104386);
    buf[7]=mat4(vec4(-8.265602,-4.7027016,5.098234,0.7509808),vec4(8.6507845,-17.15949,16.51939,-8.884479),vec4(-4.036479,-2.3946867,-2.6055532,-1.9866527),vec4(-2.2167742,-1.8135649,-5.9759874,4.8846445))*buf[0]+mat4(vec4(6.7790847,3.5076547,-2.8191125,-2.7028968),vec4(-5.743024,-0.27844876,1.4958696,-5.0517144),vec4(13.122226,15.735168,-2.9397483,-4.101023),vec4(-14.375265,-5.030483,-6.2599335,2.9848232))*buf[1]+mat4(vec4(4.0950394,-0.94011575,-5.674733,4.755022),vec4(4.3809423,4.8310084,1.7425908,-3.437416),vec4(2.117492,0.16342592,-104.56341,16.949184),vec4(-5.22543,-2.994248,3.8350096,-1.9364246))*buf[2]+mat4(vec4(-5.900337,1.7946124,-13.604192,-3.8060522),vec4(6.6583457,31.911177,25.164474,91.81147),vec4(11.840538,4.1503043,-0.7314397,6.768467),vec4(-6.3967767,4.034772,6.1714606,-0.32874924))*buf[3]+mat4(vec4(3.4992442,-196.91893,-8.923708,2.8142626),vec4(3.4806502,-3.1846354,5.1725626,5.1804223),vec4(-2.4009497,15.585794,1.2863957,2.0252278),vec4(-71.25271,-62.441242,-8.138444,0.50670296))*buf[4]+mat4(vec4(-12.291733,-11.176166,-7.3474145,4.390294),vec4(10.805477,5.6337385,-0.9385842,-4.7348723),vec4(-12.869276,-7.039391,5.3029537,7.5436664),vec4(1.4593618,8.91898,3.5101583,5.840625))*buf[5]+vec4(2.2415268,-6.705987,-0.98861027,-2.117676);
    buf[7]=sigmoid(buf[7]);
    return vec4(buf[7].x,buf[7].y,buf[7].z,1.);
}

void mainImage(out vec4 fragColor,in vec2 fragCoord){
    vec2 uv=fragCoord/uResolution.xy*2.-1.;
    uv.x *= uResolution.x / uResolution.y;
    uv.y*=-1.;
    uv+=uWarp*vec2(sin(uv.y*6.283+uTime*0.5),cos(uv.x*6.283+uTime*0.5))*0.05;
    fragColor=cppn_fn(uv,0.1*sin(0.3*uTime),0.1*sin(0.69*uTime),0.1*sin(0.44*uTime));
}

void main(){
    vec4 col;mainImage(col,gl_FragCoord.xy);
    col.rgb=hueShiftRGB(col.rgb,uHueShift);
    float scanline_val=sin(gl_FragCoord.y*uScanFreq)*0.5+0.5;
    col.rgb*=1.-(scanline_val*scanline_val)*uScan;
    col.rgb+=(rand(gl_FragCoord.xy+uTime)-0.5)*uNoise;
    gl_FragColor=vec4(clamp(col.rgb,0.0,1.0),1.0);
}
`;

function initDarkVeil(ctn, opts = {}) {
  const hueShift = opts.hueShift ?? 0;
  const noiseIntensity = opts.noiseIntensity ?? 0.1;
  const scanlineIntensity = opts.scanlineIntensity ?? 0.2;
  const speed = opts.speed ?? 0.5;
  const scanlineFrequency = opts.scanlineFrequency ?? 2.0;
  const warpAmount = opts.warpAmount ?? 0.15;
  const resolutionScale = opts.resolutionScale ?? 1;

  const renderer = new Renderer({
    dpr: getOptimizedDPR(),
    alpha: true
  });

  const gl = renderer.gl;
  gl.canvas.style.width = '100%';
  gl.canvas.style.height = '100%';
  ctn.appendChild(gl.canvas);

  const geometry = new Triangle(gl);

  const program = new Program(gl, {
    vertex: VEIL_VERT,
    fragment: VEIL_FRAG,
    uniforms: {
      uTime: { value: 0 },
      uResolution: { value: new Vec2() },
      uHueShift: { value: hueShift },
      uNoise: { value: noiseIntensity },
      uScan: { value: scanlineIntensity },
      uScanFreq: { value: scanlineFrequency },
      uWarp: { value: warpAmount }
    }
  });

  const mesh = new Mesh(gl, { geometry, program });

  const resize = () => {
    const w = ctn.clientWidth || window.innerWidth;
    const h = ctn.clientHeight || window.innerHeight;
    renderer.setSize(w * resolutionScale, h * resolutionScale);
    program.uniforms.uResolution.value.set(w, h);
  };

  window.addEventListener('resize', resize);
  resize();

  const start = performance.now();
  let rafId;

  const loop = () => {
    if (!isTabVisible) {
      if (typeof raf !== 'undefined') raf = requestAnimationFrame(typeof loop !== 'undefined' ? loop : update);
      else if (typeof rafId !== 'undefined') rafId = requestAnimationFrame(typeof loop !== 'undefined' ? loop : update);
      else if (typeof animateId !== 'undefined') animateId = requestAnimationFrame(typeof loop !== 'undefined' ? loop : update);
      else if (typeof animationId !== 'undefined') animationId = requestAnimationFrame(typeof loop !== 'undefined' ? loop : update);
      return;
    }
    if (isUserScrollingFast && Math.random() < 0.5) {
      if (typeof raf !== 'undefined') raf = requestAnimationFrame(typeof loop !== 'undefined' ? loop : update);
      else if (typeof rafId !== 'undefined') rafId = requestAnimationFrame(typeof loop !== 'undefined' ? loop : update);
      else if (typeof animateId !== 'undefined') animateId = requestAnimationFrame(typeof loop !== 'undefined' ? loop : update);
      else if (typeof animationId !== 'undefined') animationId = requestAnimationFrame(typeof loop !== 'undefined' ? loop : update);
      return;
    }

    program.uniforms.uTime.value = ((performance.now() - start) / 1000) * speed;
    try {
      renderer.render({ scene: mesh });
    } catch(e) {}
    rafId = requestAnimationFrame(loop);
  };

  loop();

  return () => {
    if (rafId) cancelAnimationFrame(rafId);
    window.removeEventListener('resize', resize);
    if (ctn && gl.canvas.parentNode === ctn) ctn.removeChild(gl.canvas);
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  };
}


// ==========================================
// MAIN WEBGL BACKGROUND CONTROLLER
// ==========================================
window.renderWebGLBackground = function(type) {
  const container = document.getElementById('bg-webgl-container');
  if (!container) return;

  // Incrementa a sessão para que qualquer frame do shader anterior aborte instantaneamente
  currentBgSession++;

  // Executa o descarte do shader anterior
  if (currentCleanup) {
    try {
      currentCleanup();
    } catch (e) {
      console.warn('[WebGL] Aviso no cleanup anterior:', e);
    }
    currentCleanup = null;
  }

  // Desaloca forçadamente quaisquer canvases e contextos remanescentes
  const oldCanvases = container.querySelectorAll('canvas');
  oldCanvases.forEach(cv => {
    try {
      const gl = cv.getContext('webgl2') || cv.getContext('webgl');
      if (gl) gl.getExtension('WEBGL_lose_context')?.loseContext();
      cv.width = 1;
      cv.height = 1;
    } catch(e) {}
  });
  container.innerHTML = '';

  currentActiveType = type;

  switch (type) {
    case 'strands':
      currentCleanup = initStrands(container, {
        colors: ["#F97316", "#7C3AED", "#06B6D4"],
        count: 3,
        speed: 0.5,
        amplitude: 1,
        waviness: 1,
        thickness: 0.7,
        glow: 2.6,
        taper: 3,
        spread: 1,
        intensity: 0.6,
        saturation: 1.5,
        opacity: 1,
        scale: 1.5,
        glass: false,
        refraction: 1,
        dispersion: 1,
        glassSize: 1
      });
      break;

    case 'siderays':
      currentCleanup = initSideRays(container, {
        speed: 2.2,
        rayColor1: "#F59E0B",
        rayColor2: "#38BDF8",
        intensity: 4.5,
        spread: 3.5,
        origin: "top-right",
        tilt: -5,
        saturation: 1.8,
        blend: 0.75,
        falloff: 0.85,
        opacity: 1.0
      });
      break;

    case 'plasmawave':
      currentCleanup = initPlasmaWave(container, {
        colors: ["#A855F7", "#06B6D4"],
        speed1: 0.05,
        speed2: 0.05,
        focalLength: 0.8,
        bend1: 1,
        bend2: 0.5,
        dir2: 1.0,
        rotationDeg: 0
      });
      break;

    case 'ferrofluid':
      currentCleanup = initFerrofluid(container, {
        colors: ["#ffffff", "#ffffff", "#ffffff"],
        speed: 0.5,
        scale: 1,
        turbulence: 1,
        fluidity: 0.1,
        rimWidth: 0.2,
        sharpness: 3,
        shimmer: 1,
        glow: 2,
        flowDirection: "down",
        opacity: 1,
        mouseInteraction: true,
        mouseStrength: 1,
        mouseRadius: 0.3
      });
      break;

    case 'softaurora':
      currentCleanup = initSoftAurora(container, {
        speed: 0.6,
        scale: 1.5,
        brightness: 1.0,
        color1: "#f7f7f7",
        color2: "#e100ff",
        noiseFrequency: 2.5,
        noiseAmplitude: 1.0,
        bandHeight: 0.5,
        bandSpread: 1.0,
        octaveDecay: 0.1,
        layerOffset: 0,
        colorSpeed: 1.0,
        enableMouseInteraction: true,
        mouseInfluence: 0.25,
        lightMode: false
      });
      break;

    case 'particles':
      currentCleanup = initParticles(container, {
        particleCount: 200,
        particleSpread: 10,
        speed: 0.1,
        particleColors: ["#ffffff", "#80bfff", "#a855f7"],
        moveParticlesOnHover: true,
        particleHoverFactor: 1,
        alphaParticles: false,
        particleBaseSize: 100,
        sizeRandomness: 1,
        cameraDistance: 20,
        disableRotation: false
      });
      break;

    case 'ghostfibers':
      currentCleanup = initGhostFibers(container, {
        lineColor: "#140E35",
        glowColor: "#3437A0",
        speed: 0.2,
        scale: 2,
        rotation: 0,
        rotationSpeed: 0.25,
        layers: 4,
        waveAmplitude: 0.015,
        waveFrequency: 3,
        waveSpeed: 0.15,
        layerSpeed: 0.08,
        twist: 0.1,
        twistFrequency: 5,
        twistSpeed: 1.2,
        lineFrequency: 5,
        lineSpacing: 2,
        lineSharpness: 16,
        glowFalloff: 10,
        glowIntensity: 1.6,
        brightness: 2,
        blueBoost: 1.25,
        vignette: 0.8,
        grain: 0.05,
        lightMode: false
      });
      break;

    case 'dither':
      currentCleanup = initDither(container, {
        waveSpeed: 0.1,
        waveFrequency: 4,
        waveAmplitude: 0.4,
        waveColor: [0.85, 0.25, 0.95],
        colorNum: 6,
        pixelSize: 3,
        enableMouseInteraction: true,
        mouseRadius: 0.35
      });
      break;

    case 'darkveil':
      currentCleanup = initDarkVeil(container, {
        hueShift: 0,
        noiseIntensity: 0.1,
        scanlineIntensity: 0.2,
        speed: 0.5,
        scanlineFrequency: 2.0,
        warpAmount: 0.15,
        resolutionScale: 1
      });
      break;

    case 'webthreads':
      currentCleanup = initWebThreads(container, {
        color1: '#5227FF',
        color2: '#FF9FFC',
        color3: '#FFFFFF',
        speed: 0.2,
        threadCount: 6,
        frequency: 5.0,
        spread: 0.18,
        taper: 1.0,
        position: 0.5,
        fanMode: 'center',
        glow: 0.02,
        falloff: 0.6,
        thickness: 1.1,
        brightness: 0.6,
        opacity: 1.0,
        mirror: true,
        shimmer: false,
        grain: true,
        grainIntensity: 0.05,
        mouseInteraction: true,
        mouseStrength: 0.3
      });
      break;

    case 'topography':
      currentCleanup = initTopography(container, {
        lowColor: '#5227FF',
        midColor: '#FF9FFC',
        highColor: '#FFFFFF',
        speed: 0.35,
        morphAmount: 3.0,
        morphSpeed: 0.05,
        bands: 2.0,
        thickness: 0.01,
        scale: 1.0,
        pixelSize: 1.0,
        glow: 0.5,
        colorMode: 'elevation',
        contrast: 3.0,
        brightness: 1.0,
        fillBands: false,
        opacity: 1.0,
        grain: true,
        grainIntensity: 0.05,
        mouseInteraction: true,
        mouseRadius: 0.3,
        mouseStrength: 0.4
      });
      break;

    case 'balatro':
      currentCleanup = initBalatro(container, {
        spinRotation: -2.0,
        spinSpeed: 7.0,
        offset: [0.0, 0.0],
        color1: '#DE443B',
        color2: '#006BB4',
        color3: '#162325',
        contrast: 3.5,
        lighting: 0.4,
        spinAmount: 0.25,
        pixelFilter: 700.0,
        spinEase: 1.0,
        isRotate: true,
        mouseInteraction: true
      });
      break;

    case 'faultyterminal':
      currentCleanup = initFaultyTerminal(container, {
        scale: 1.5,
        gridMul: [2, 1],
        digitSize: 1.2,
        timeScale: 0.8,
        pause: false,
        scanlineIntensity: 1,
        glitchAmount: 1,
        flickerAmount: 1,
        noiseAmp: 1,
        chromaticAberration: 0,
        dither: 0,
        curvature: 0.1,
        tint: '#ffffff',
        mouseReact: true,
        mouseStrength: 0.5,
        pageLoadAnimation: false,
        brightness: 1
      });
      break;

    case 'morphslider':
      currentCleanup = initMorphSlider(container, {
        transition: 'melt',
        duration: 1.4,
        intensity: 0.6,
        scale: 2.4,
        aberration: 0.35,
        drift: 0.35,
        overlayColor: '#000000',
        autoplayDelay: 5.0
      });
      break;

    case 'antigravity':
      currentCleanup = initAntigravity(container, {
        count: 280,
        magnetRadius: 8,
        ringRadius: 9,
        waveSpeed: 0.45,
        waveAmplitude: 1.2,
        particleSize: 1.8,
        lerpSpeed: 0.06,
        color: '#FF9FFC',
        autoAnimate: true,
        particleVariance: 1.0,
        depthFactor: 1.2,
        pulseSpeed: 2.5
      });
      break;

    case 'aurora':
      currentCleanup = initAurora(container, {
        colorStops: ['#5227FF', '#7cff67', '#00f0ff'],
        amplitude: 1.0,
        blend: 0.5,
        speed: 0.8
      });
      break;

    case 'letterglitch':
      currentCleanup = initLetterGlitch(container, {
        glitchColors: ['#2b4539', '#61dca3', '#61b3dc', '#ff6b35'],
        glitchSpeed: 45,
        outerVignette: true,
        smooth: true
      });
      break;

    case 'plasma':
      currentCleanup = initPlasma(container, {
        color: '#ff6b35',
        speed: 0.7,
        direction: 'forward',
        scale: 1.1,
        opacity: 0.85,
        mouseInteractive: true,
        iterations: 50
      });
      break;

    case 'liquidether':
      currentCleanup = initLiquidEther(container, {
        colors: ['#5227FF', '#FF9FFC', '#B497CF'],
        mouseForce: 20,
        cursorSize: 100,
        isViscous: false,
        resolution: 0.5,
        autoDemo: true,
        autoSpeed: 0.5,
        autoIntensity: 2.2
      });
      break;

    case 'orb':
      currentCleanup = initOrb(container, {
        hue: 0,
        hoverIntensity: 0.3,
        rotateOnHover: true,
        forceHoverState: false,
        backgroundColor: '#000000'
      });
      break;

    case 'prism':
      currentCleanup = initPrism(container, {
        animationType: 'rotate',
        timeScale: 0.5,
        height: 3.5,
        baseWidth: 5.5,
        scale: 3.6,
        glow: 1.2,
        noise: 0.4,
        bloom: 1.1
      });
      break;

    case 'prismaticburst':
      currentCleanup = initPrismaticBurst(container, {
        animationType: 'rotate3d',
        intensity: 2.2,
        speed: 0.5,
        distort: 1.0,
        rayCount: 24,
        colors: ['#ff007a', '#4d3dff', '#00f0ff', '#ffffff']
      });
      break;

    case 'lightning':
      currentCleanup = initLightning(container, {
        hue: 220,
        xOffset: 0,
        speed: 1.0,
        intensity: 1.2,
        size: 1.0
      });
      break;

    case 'evileye':
      currentCleanup = initEvilEye(container, {
        eyeColor: '#FF6F37',
        intensity: 1.5,
        pupilSize: 0.6,
        irisWidth: 0.25,
        glowIntensity: 0.35,
        scale: 0.85,
        noiseScale: 1.0,
        pupilFollow: 1.0,
        flameSpeed: 1.0,
        backgroundColor: '#000000'
      });
      break;

    case 'beams':
      currentCleanup = initBeams(container, {
        beamWidth: 2,
        beamHeight: 15,
        beamNumber: 12,
        lightColor: '#ffffff',
        beamColor: '#000000',
        backgroundColor: '#000000',
        speed: 2,
        noiseIntensity: 1.75,
        scale: 0.2,
        rotation: 0,
        lightMode: false
      });
      break;

    case 'floatinglines':
      currentCleanup = initFloatingLines(container, {
        enabledWaves: ['top', 'middle', 'bottom'],
        lineCount: [10, 15, 20],
        lineDistance: [8, 6, 4],
        bendRadius: 5.0,
        bendStrength: -0.5,
        interactive: true,
        parallax: true,
        animationSpeed: 1,
        linesGradient: ['#e947f5', '#2f4ba2', '#38bdf8', '#a855f7'],
        backgroundColor: '#000000'
      });
      break;

    case 'silk':
      currentCleanup = initSilk(container, {
        speed: 5,
        scale: 1,
        color: '#7B7481',
        noiseIntensity: 1.5,
        rotation: 0,
        lightMode: false
      });
      break;

    case 'radar':
      currentCleanup = initRadar(container, {
        speed: 1.0,
        scale: 0.5,
        ringCount: 10.0,
        spokeCount: 10.0,
        ringThickness: 0.05,
        spokeThickness: 0.01,
        sweepSpeed: 1.0,
        sweepWidth: 2.0,
        sweepLobes: 1.0,
        color: '#9f29ff',
        backgroundColor: '#000000',
        falloff: 2.0,
        brightness: 1.0,
        enableMouseInteraction: true,
        mouseInfluence: 0.1,
        lightMode: false
      });
      break;

    case 'ripplegrid':
      currentCleanup = initRippleGrid(container, {
        enableRainbow: false,
        gridColor: '#38bdf8',
        rippleIntensity: 0.05,
        gridSize: 10.0,
        gridThickness: 15.0,
        fadeDistance: 1.5,
        vignetteStrength: 2.0,
        glowIntensity: 0.1,
        opacity: 1.0,
        gridRotation: 0,
        mouseInteraction: true,
        mouseInteractionRadius: 1.0,
        lightMode: false
      });
      break;

    case 'pixelblast':
      currentCleanup = initPixelBlast(container, {
        variant: 'circle',
        pixelSize: 4,
        color: '#B497CF',
        patternScale: 2.5,
        patternDensity: 1.1,
        pixelSizeJitter: 0.2,
        enableRipples: true,
        rippleSpeed: 0.4,
        rippleThickness: 0.12,
        rippleIntensityScale: 1.5,
        speed: 0.5,
        edgeFade: 0.25,
        transparent: true
      });
      break;

    case 'magicrings':
      currentCleanup = initMagicRings(container, {
        color: '#fc42ff',
        colorTwo: '#42fcff',
        speed: 1,
        ringCount: 6,
        attenuation: 10,
        lineThickness: 2,
        baseRadius: 0.35,
        radiusStep: 0.1,
        scaleRate: 0.1,
        opacity: 1,
        noiseAmount: 0.1,
        rotation: 0,
        ringGap: 1.5,
        fadeIn: 0.7,
        fadeOut: 0.5,
        followMouse: true,
        mouseInfluence: 0.2,
        hoverScale: 1.1,
        parallax: 0.05,
        clickBurst: true,
        alphaMode: 'luminance'
      });
      break;

    case 'gridscan':
      currentCleanup = initGridScan(container, {
        sensitivity: 0.55,
        lineThickness: 1,
        linesColor: '#2F293A',
        gridScale: 0.1,
        scanColor: '#FF9FFC',
        scanOpacity: 0.4,
        lineStyle: 'solid',
        lineJitter: 0.1,
        bloomIntensity: 0.6,
        noiseIntensity: 0.01,
        scanDuration: 2.0,
        scanDelay: 2.0,
        scanDirection: 'pingpong',
        scanOnClick: true
      });
      break;

    case 'liquidchrome':
      currentCleanup = initLiquidChrome(container, {
        baseColor: [0.1, 0.1, 0.1],
        speed: 0.2,
        amplitude: 0.3,
        frequencyX: 3.0,
        frequencyY: 3.0,
        interactive: true
      });
      break;

    case 'linewaves':
      currentCleanup = initLineWaves(container, {
        speed: 0.3,
        innerLineCount: 32.0,
        outerLineCount: 36.0,
        warpIntensity: 1.0,
        rotation: -45,
        edgeFadeWidth: 0.0,
        colorCycleSpeed: 1.0,
        brightness: 0.2,
        color1: '#ffffff',
        color2: '#ffffff',
        color3: '#ffffff',
        enableMouseInteraction: true,
        mouseInfluence: 2.0,
        lightMode: false
      });
      break;

    case 'soft_aurora':
      currentCleanup = initSoftAurora(container, {
        speed: 0.8, scale: 1.5, brightness: 1.2, noiseFreq: 3.5, noiseAmp: 0.6
      });
      break;

    case 'dark_veil':
      currentCleanup = initDarkVeil(container, {
        hueShift: 0, noiseIntensity: 0.1, scanlineIntensity: 0.2, speed: 0.5
      });
      break;

    default:
      break;
  }
};

// ==========================================
// 8. WEB THREADS INITIALIZER
// ==========================================
function initWebThreads(container, opts = {}) {
  const {
    color1 = '#5227FF', color2 = '#FF9FFC', color3 = '#FFFFFF',
    speed = 0.2, threadCount = 6, frequency = 5.0, spread = 0.18,
    taper = 1.0, position = 0.5, fanMode = 'center', glow = 0.02,
    falloff = 0.6, thickness = 1.1, brightness = 0.6, opacity = 1.0,
    mirror = true, shimmer = false, grain = true, grainIntensity = 0.05,
    mouseInteraction = true, mouseStrength = 0.3
  } = opts;

  const hexToRgb = hex => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return [1, 1, 1];
    return [parseInt(result[1], 16) / 255, parseInt(result[2], 16) / 255, parseInt(result[3], 16) / 255];
  };

  const FAN_MODE_MAP = { center: 0, left: 1, right: 2 };

  const vertex = `#version 300 es
  in vec2 position;
  void main() { gl_Position = vec4(position, 0.0, 1.0); }
  `;

  const fragment = `#version 300 es
  precision highp float;
  uniform vec2 iResolution;
  uniform float iTime;
  uniform float uSpeed;
  uniform float uThreadCount;
  uniform float uFrequency;
  uniform float uSpread;
  uniform float uTaper;
  uniform float uPosition;
  uniform float uFanMode;
  uniform float uGlow;
  uniform float uFalloff;
  uniform float uThickness;
  uniform float uBrightness;
  uniform float uOpacity;
  uniform float uMirror;
  uniform float uShimmer;
  uniform float uGrain;
  uniform float uGrainIntensity;
  uniform vec3 uColor1;
  uniform vec3 uColor2;
  uniform vec3 uColor3;
  uniform vec2 uMouse;
  uniform float uMouseStrength;
  uniform float uEnableMouse;
  uniform float uMouseActive;
  out vec4 fragColor;

  #define TAU 6.28318530718
  #define MAX_THREADS 10

  float glowFn(float x, float str, float dist) {
    return dist / pow(max(x, 1e-4), str);
  }

  void main() {
    vec2 uv = gl_FragCoord.xy / iResolution.xy;
    float n = max(uThreadCount, 1.0);
    float pinchX = uFanMode < 0.5 ? 0.5 : (uFanMode < 1.5 ? 0.0 : 1.0);
    if (uEnableMouse > 0.5) {
      pinchX = mix(pinchX, uMouse.x, clamp(uMouseStrength, 0.0, 1.0) * uMouseActive);
    }
    float spreadDx = uSpread * abs(uv.x - pinchX);
    float baseT = iTime * uSpeed;
    float tauOverN = TAU / n;
    float mirrorVal = uMirror > 0.5 ? sign(pinchX - uv.x) : 1.0;
    bool doShimmer = uShimmer > 0.5;
    float shimmerT = iTime * 1.7;
    float invThickness = 1.0 / max(uThickness, 0.01);
    float xFreq = uv.x * uFrequency;
    float yOff = uv.y - uPosition;
    float ciScale = n > 1.0 ? 1.0 / (n - 1.0) : 0.0;
    vec3 col = vec3(0.0);
    float gsum = 0.0;

    for (int idx = 0; idx < MAX_THREADS; idx++) {
      float i = float(idx);
      if (i >= n) break;
      float amplitude = spreadDx * (1.0 + i * uTaper);
      float shimmerVal = doShimmer ? sin(shimmerT + i * 1.3) * 0.35 : 0.0;
      float phase = (baseT + i * tauOverN) * mirrorVal + shimmerVal;
      float sdf = abs(yOff + sin(xFreq + phase) * amplitude) * invThickness;
      float g = glowFn(sdf, uFalloff, uGlow);
      float ci = i * ciScale;
      vec3 threadCol = mix(uColor1, uColor2, ci);
      col += g * threadCol;
      gsum += g;
    }

    float coreAmt = smoothstep(0.5, 2.2, gsum);
    col = mix(col, uColor3 * gsum, coreAmt * 0.5);
    float bright = uBrightness;
    if (uEnableMouse > 0.5) {
      vec2 md = uv - uMouse;
      float d2 = dot(md, md);
      bright += clamp(uMouseStrength, 0.0, 1.0) * uMouseActive * exp(-d2 * 6.0) * 0.6;
    }
    col *= bright;
    float alpha = clamp(gsum, 0.0, 1.0) * uOpacity;
    vec3 outRgb = col * alpha;
    if (uGrain > 0.5) {
      float gv = (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233)) + iTime) * 43758.5453) - 0.5) * uGrainIntensity;
      outRgb = clamp(outRgb + gv, 0.0, 1.0);
      alpha = clamp(alpha + gv, 0.0, 1.0);
    }
    fragColor = vec4(outRgb, alpha);
  }
  `;

  const renderer = new Renderer({
    webgl: 2, alpha: true, premultipliedAlpha: true, antialias: false,
    dpr: getOptimizedDPR()
  });
  const gl = renderer.gl;
  gl.clearColor(0, 0, 0, 0);
  const canvas = gl.canvas;
  canvas.style.width = '100%'; canvas.style.height = '100%'; canvas.style.display = 'block';
  container.appendChild(canvas);

  const geometry = new Triangle(gl);
  const rgb1 = hexToRgb(color1), rgb2 = hexToRgb(color2), rgb3 = hexToRgb(color3);
  const program = new Program(gl, {
    vertex, fragment,
    uniforms: {
      iTime: { value: 0 },
      iResolution: { value: new Float32Array([1, 1]) },
      uSpeed: { value: speed },
      uThreadCount: { value: threadCount },
      uFrequency: { value: frequency },
      uSpread: { value: spread },
      uTaper: { value: taper },
      uPosition: { value: position },
      uFanMode: { value: FAN_MODE_MAP[fanMode] ?? 0 },
      uGlow: { value: glow },
      uFalloff: { value: falloff },
      uThickness: { value: thickness },
      uBrightness: { value: brightness },
      uOpacity: { value: opacity },
      uMirror: { value: mirror ? 1.0 : 0.0 },
      uShimmer: { value: shimmer ? 1.0 : 0.0 },
      uGrain: { value: grain ? 1.0 : 0.0 },
      uGrainIntensity: { value: grainIntensity },
      uColor1: { value: new Float32Array(rgb1) },
      uColor2: { value: new Float32Array(rgb2) },
      uColor3: { value: new Float32Array(rgb3) },
      uMouse: { value: new Float32Array([0.5, 0.5]) },
      uMouseStrength: { value: mouseStrength },
      uEnableMouse: { value: mouseInteraction ? 1.0 : 0.0 },
      uMouseActive: { value: 0 }
    }
  });

  const mesh = new Mesh(gl, { geometry, program });

  const setSize = () => {
    const rect = container.getBoundingClientRect();
    const w = Math.max(1, Math.floor(rect.width));
    const h = Math.max(1, Math.floor(rect.height));
    renderer.setSize(w, h);
    program.uniforms.iResolution.value[0] = gl.drawingBufferWidth;
    program.uniforms.iResolution.value[1] = gl.drawingBufferHeight;
  };

  const ro = new ResizeObserver(setSize);
  ro.observe(container);
  setSize();

  const currentMouse = [0.5, 0.5], targetMouse = [0.5, 0.5];
  let currentActive = 0, targetActive = 0;

  const onMouseMove = e => {
    const rect = canvas.getBoundingClientRect();
    targetMouse[0] = (e.clientX - rect.left) / rect.width;
    targetMouse[1] = 1.0 - (e.clientY - rect.top) / rect.height;
    targetActive = 1;
  };
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mouseleave', () => { targetActive = 0; });

  let raf = 0;
  const t0 = performance.now();
  const loop = t => {
    if (!isTabVisible) {
      if (typeof raf !== 'undefined') raf = requestAnimationFrame(typeof loop !== 'undefined' ? loop : update);
      else if (typeof rafId !== 'undefined') rafId = requestAnimationFrame(typeof loop !== 'undefined' ? loop : update);
      else if (typeof animateId !== 'undefined') animateId = requestAnimationFrame(typeof loop !== 'undefined' ? loop : update);
      else if (typeof animationId !== 'undefined') animationId = requestAnimationFrame(typeof loop !== 'undefined' ? loop : update);
      return;
    }
    if (isUserScrollingFast && Math.random() < 0.5) {
      if (typeof raf !== 'undefined') raf = requestAnimationFrame(typeof loop !== 'undefined' ? loop : update);
      else if (typeof rafId !== 'undefined') rafId = requestAnimationFrame(typeof loop !== 'undefined' ? loop : update);
      else if (typeof animateId !== 'undefined') animateId = requestAnimationFrame(typeof loop !== 'undefined' ? loop : update);
      else if (typeof animationId !== 'undefined') animationId = requestAnimationFrame(typeof loop !== 'undefined' ? loop : update);
      return;
    }

    program.uniforms.iTime.value = (t - t0) * 0.001;
    currentMouse[0] += 0.05 * (targetMouse[0] - currentMouse[0]);
    currentMouse[1] += 0.05 * (targetMouse[1] - currentMouse[1]);
    currentActive += 0.05 * (targetActive - currentActive);
    program.uniforms.uMouse.value[0] = currentMouse[0];
    program.uniforms.uMouse.value[1] = currentMouse[1];
    program.uniforms.uMouseActive.value = currentActive;
    renderer.render({ scene: mesh });
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);

  return () => {
    cancelAnimationFrame(raf);
    ro.disconnect();
    canvas.removeEventListener('mousemove', onMouseMove);
    try { container.removeChild(canvas); } catch {}
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  };
}

// ==========================================
// 9. TOPOGRAPHY INITIALIZER
// ==========================================
function initTopography(container, opts = {}) {
  const {
    lowColor = '#5227FF', midColor = '#FF9FFC', highColor = '#FFFFFF',
    speed = 0.35, morphAmount = 3.0, morphSpeed = 0.05, bands = 2.0,
    thickness = 0.01, scale = 1.0, pixelSize = 1.0, glow = 0.5,
    colorMode = 'elevation', contrast = 3.0, brightness = 1.0,
    fillBands = false, opacity = 1.0, grain = true, grainIntensity = 0.05,
    mouseInteraction = true, mouseRadius = 0.3, mouseStrength = 0.4
  } = opts;

  const hexToRgb = hex => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return [1, 1, 1];
    return [parseInt(result[1], 16) / 255, parseInt(result[2], 16) / 255, parseInt(result[3], 16) / 255];
  };

  const vertex = `#version 300 es
  in vec2 position;
  void main() { gl_Position = vec4(position, 0.0, 1.0); }
  `;

  const fragment = `#version 300 es
  precision highp float;
  uniform vec2 iResolution;
  uniform float iTime;
  uniform float uMorphAmount;
  uniform float uBands;
  uniform float uThickness;
  uniform float uScale;
  uniform float uPixelSize;
  uniform float uGlow;
  uniform float uColorMode;
  uniform float uContrast;
  uniform float uBrightness;
  uniform float uFillBands;
  uniform float uOpacity;
  uniform vec3 uLow;
  uniform vec3 uMid;
  uniform vec3 uHigh;
  uniform vec2 uMouse;
  uniform float uMouseEnabled;
  uniform float uMouseRadius;
  uniform float uMouseStrength;
  uniform float uMouseActive;
  uniform float uGrain;
  uniform float uGrainIntensity;
  uniform vec4 uCtrlA;
  uniform vec4 uCtrlB;
  uniform vec4 uCtrlC;
  uniform vec4 uCtrlD;
  out vec4 fragColor;

  float bez(float t, vec4 c) {
    float w = 6.2831853 * t;
    return 0.5 * (c.x * sin(w) + c.y * cos(w) + c.z * sin(2.0 * w) + c.w * cos(2.0 * w));
  }

  float field(vec2 uv) {
    vec2 a = vec2(bez(uv.x, uCtrlA), bez(uv.x, uCtrlB));
    vec2 b = vec2(bez(uv.y, uCtrlC), bez(uv.y, uCtrlD));
    return distance(a, b);
  }

  vec3 elevationColor(float e) {
    vec3 c = mix(uLow, uMid, smoothstep(0.0, 0.5, e));
    c = mix(c, uHigh, smoothstep(0.5, 1.0, e));
    return c;
  }

  void main() {
    vec2 res = iResolution.xy;
    vec2 uv = gl_FragCoord.xy / res;
    vec2 suv = (uv - 0.5) / max(uScale, 0.001) + 0.5;
    vec2 sampleUv = suv;
    if (uPixelSize > 1.0) {
      vec2 px = res / uPixelSize;
      sampleUv = (floor(suv * px) + 0.5) / px;
    }
    float fv = field(sampleUv);

    if (uMouseEnabled > 0.5) {
      vec2 d = uv - uMouse;
      d.x *= res.x / max(res.y, 1.0);
      float r = max(uMouseRadius, 0.001);
      float bump = exp(-dot(d, d) / (r * r)) * uMouseStrength * uMouseActive;
      fv += bump;
    }

    float f = fv * uBands;
    float frac = fract(f);
    float lineDist = min(frac, 1.0 - frac);
    float aa = fwidth(f) + 0.0001;
    float mask = 1.0 - smoothstep(uThickness - aa, uThickness + aa, lineDist);
    float glowR = uThickness + uGlow * 0.5 + aa;
    float glow = (1.0 - smoothstep(uThickness, glowR, lineDist)) * step(0.0001, uGlow);
    float elev = clamp(fv / (uMorphAmount * 2.5 + 0.001), 0.0, 1.0);

    vec3 lineCol = elevationColor(elev);
    float coverage = clamp(mask + glow * 0.55, 0.0, 1.0);
    coverage = pow(coverage, max(uContrast, 0.001));

    vec3 outColor = lineCol * uBrightness;
    float a = clamp(coverage, 0.0, 1.0) * uOpacity;
    fragColor = vec4(outColor * a, a);
  }
  `;

  const renderer = new Renderer({
    webgl: 2, alpha: true, premultipliedAlpha: true, antialias: false,
    dpr: getOptimizedDPR()
  });
  const gl = renderer.gl;
  gl.clearColor(0, 0, 0, 0);
  const canvas = gl.canvas;
  canvas.style.width = '100%'; canvas.style.height = '100%'; canvas.style.display = 'block';
  container.appendChild(canvas);

  const geometry = new Triangle(gl);
  const program = new Program(gl, {
    vertex, fragment,
    uniforms: {
      iTime: { value: 0 },
      iResolution: { value: new Float32Array([1, 1]) },
      uSpeed: { value: speed },
      uMorphAmount: { value: morphAmount },
      uMorphSpeed: { value: morphSpeed },
      uBands: { value: bands },
      uThickness: { value: thickness },
      uScale: { value: scale },
      uPixelSize: { value: pixelSize },
      uGlow: { value: glow },
      uColorMode: { value: 0.0 },
      uContrast: { value: contrast },
      uBrightness: { value: brightness },
      uFillBands: { value: fillBands ? 1.0 : 0.0 },
      uOpacity: { value: opacity },
      uGrain: { value: grain ? 1.0 : 0.0 },
      uGrainIntensity: { value: grainIntensity },
      uLow: { value: new Float32Array(hexToRgb(lowColor)) },
      uMid: { value: new Float32Array(hexToRgb(midColor)) },
      uHigh: { value: new Float32Array(hexToRgb(highColor)) },
      uMouse: { value: new Float32Array([0.5, 0.5]) },
      uMouseEnabled: { value: mouseInteraction ? 1.0 : 0.0 },
      uMouseRadius: { value: mouseRadius },
      uMouseStrength: { value: mouseStrength },
      uMouseActive: { value: 0.0 },
      uCtrlA: { value: new Float32Array([0, 0, 0, 0]) },
      uCtrlB: { value: new Float32Array([0, 0, 0, 0]) },
      uCtrlC: { value: new Float32Array([0, 0, 0, 0]) },
      uCtrlD: { value: new Float32Array([0, 0, 0, 0]) }
    }
  });

  const mesh = new Mesh(gl, { geometry, program });

  const setSize = () => {
    const rect = container.getBoundingClientRect();
    const w = Math.max(1, Math.floor(rect.width));
    const h = Math.max(1, Math.floor(rect.height));
    renderer.setSize(w, h);
    program.uniforms.iResolution.value[0] = gl.drawingBufferWidth;
    program.uniforms.iResolution.value[1] = gl.drawingBufferHeight;
  };

  const ro = new ResizeObserver(setSize);
  ro.observe(container);
  setSize();

  const ctrlArrays = [
    program.uniforms.uCtrlA.value, program.uniforms.uCtrlB.value,
    program.uniforms.uCtrlC.value, program.uniforms.uCtrlD.value
  ];
  const CTRL_INDICES = [[1, -2, 3, -4], [9, -8, 7, -6], [5, 2, 5, -5], [-1, -3, 8, 9]];

  let raf = 0;
  const t0 = performance.now();
  const loop = t => {
    if (!isTabVisible) {
      if (typeof raf !== 'undefined') raf = requestAnimationFrame(typeof loop !== 'undefined' ? loop : update);
      else if (typeof rafId !== 'undefined') rafId = requestAnimationFrame(typeof loop !== 'undefined' ? loop : update);
      else if (typeof animateId !== 'undefined') animateId = requestAnimationFrame(typeof loop !== 'undefined' ? loop : update);
      else if (typeof animationId !== 'undefined') animationId = requestAnimationFrame(typeof loop !== 'undefined' ? loop : update);
      return;
    }
    if (isUserScrollingFast && Math.random() < 0.5) {
      if (typeof raf !== 'undefined') raf = requestAnimationFrame(typeof loop !== 'undefined' ? loop : update);
      else if (typeof rafId !== 'undefined') rafId = requestAnimationFrame(typeof loop !== 'undefined' ? loop : update);
      else if (typeof animateId !== 'undefined') animateId = requestAnimationFrame(typeof loop !== 'undefined' ? loop : update);
      else if (typeof animationId !== 'undefined') animationId = requestAnimationFrame(typeof loop !== 'undefined' ? loop : update);
      return;
    }

    const time = (t - t0) * 0.001;
    program.uniforms.iTime.value = time;
    const ma = morphAmount, sp = speed, msp = morphSpeed;
    for (let g = 0; g < 4; g++) {
      const arr = ctrlArrays[g];
      const idx = CTRL_INDICES[g];
      for (let j = 0; j < 4; j++) {
        const i = idx[j];
        arr[j] = ma * Math.sin(time * sp * Math.sin(i * msp) + i);
      }
    }
    renderer.render({ scene: mesh });
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);

  return () => {
    cancelAnimationFrame(raf);
    ro.disconnect();
    try { container.removeChild(canvas); } catch {}
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  };
}

// ==========================================
// 10. BALATRO INITIALIZER
// ==========================================
function initBalatro(container, opts = {}) {
  const {
    spinRotation = -2.0, spinSpeed = 7.0, offset = [0.0, 0.0],
    color1 = '#DE443B', color2 = '#006BB4', color3 = '#162325',
    contrast = 3.5, lighting = 0.4, spinAmount = 0.25,
    pixelFilter = 700.0, spinEase = 1.0, isRotate = true,
    mouseInteraction = true
  } = opts;

  function hexToVec4(hex) {
    let hexStr = hex.replace('#', '');
    let r = 0, g = 0, b = 0, a = 1;
    if (hexStr.length === 6) {
      r = parseInt(hexStr.slice(0, 2), 16) / 255;
      g = parseInt(hexStr.slice(2, 4), 16) / 255;
      b = parseInt(hexStr.slice(4, 6), 16) / 255;
    } else if (hexStr.length === 8) {
      r = parseInt(hexStr.slice(0, 2), 16) / 255;
      g = parseInt(hexStr.slice(2, 4), 16) / 255;
      b = parseInt(hexStr.slice(4, 6), 16) / 255;
      a = parseInt(hexStr.slice(6, 8), 16) / 255;
    }
    return [r, g, b, a];
  }

  const vertexShader = `
  attribute vec2 position;
  void main() { gl_Position = vec4(position, 0, 1); }
  `;

  const fragmentShader = `
  precision highp float;
  #define PI 3.14159265359

  uniform float iTime;
  uniform vec3 iResolution;
  uniform float uSpinRotation;
  uniform float uSpinSpeed;
  uniform vec2 uOffset;
  uniform vec4 uColor1;
  uniform vec4 uColor2;
  uniform vec4 uColor3;
  uniform float uContrast;
  uniform float uLighting;
  uniform float uSpinAmount;
  uniform float uPixelFilter;
  uniform float uSpinEase;
  uniform bool uIsRotate;
  uniform vec2 uMouse;

  void main() {
    vec2 screenSize = iResolution.xy;
    vec2 screen_coords = gl_FragCoord.xy;
    float pixel_size = length(screenSize.xy) / uPixelFilter;
    vec2 uv = (floor(screen_coords.xy * (1.0 / pixel_size)) * pixel_size - 0.5 * screenSize.xy) / length(screenSize.xy) - uOffset;
    float uv_len = length(uv);
    
    float speed = (uSpinRotation * uSpinEase * 0.2);
    if (uIsRotate) { speed = iTime * speed; }
    speed += 302.2;
    
    float mouseInfluence = (uMouse.x * 2.0 - 1.0);
    speed += mouseInfluence * 0.1;
    
    float new_pixel_angle = atan(uv.y, uv.x) + speed - uSpinEase * 20.0 * (uSpinAmount * uv_len + (1.0 - uSpinAmount));
    vec2 mid = (screenSize.xy / length(screenSize.xy)) / 2.0;
    uv = (vec2(uv_len * cos(new_pixel_angle) + mid.x, uv_len * sin(new_pixel_angle) + mid.y) - mid);
    
    uv *= 30.0;
    float baseSpeed = iTime * uSpinSpeed;
    speed = baseSpeed + mouseInfluence * 2.0;
    
    vec2 uv2 = vec2(uv.x + uv.y);
    for(int i = 0; i < 5; i++) {
        uv2 += sin(max(uv.x, uv.y)) + uv;
        uv += 0.5 * vec2(cos(5.1123314 + 0.353 * uv2.y + speed * 0.131121), sin(uv2.x - 0.113 * speed));
        uv -= cos(uv.x + uv.y) - sin(uv.x * 0.711 - uv.y);
    }
    
    float contrast_mod = (0.25 * uContrast + 0.5 * uSpinAmount + 1.2);
    float paint_res = min(2.0, max(0.0, length(uv) * 0.035 * contrast_mod));
    float c1p = max(0.0, 1.0 - contrast_mod * abs(1.0 - paint_res));
    float c2p = max(0.0, 1.0 - contrast_mod * abs(paint_res));
    float c3p = 1.0 - min(1.0, c1p + c2p);
    float light = (uLighting - 0.2) * max(c1p * 5.0 - 4.0, 0.0) + uLighting * max(c2p * 5.0 - 4.0, 0.0);
    
    gl_FragColor = (0.3 / uContrast) * uColor1 + (1.0 - 0.3 / uContrast) * (uColor1 * c1p + uColor2 * c2p + vec4(c3p * uColor3.rgb, c3p * uColor1.a)) + light;
  }
  `;

  const renderer = new Renderer({ dpr: getOptimizedDPR(), antialias: false, powerPreference: 'low-power' });
  const gl = renderer.gl;
  gl.clearColor(0, 0, 0, 1);
  const canvas = gl.canvas;
  canvas.style.width = '100%'; canvas.style.height = '100%'; canvas.style.display = 'block';
  container.appendChild(canvas);

  const geometry = new Triangle(gl);
  const program = new Program(gl, {
    vertex: vertexShader,
    fragment: fragmentShader,
    uniforms: {
      iTime: { value: 0 },
      iResolution: { value: [gl.canvas.width, gl.canvas.height, gl.canvas.width / gl.canvas.height] },
      uSpinRotation: { value: spinRotation },
      uSpinSpeed: { value: spinSpeed },
      uOffset: { value: offset },
      uColor1: { value: hexToVec4(color1) },
      uColor2: { value: hexToVec4(color2) },
      uColor3: { value: hexToVec4(color3) },
      uContrast: { value: contrast },
      uLighting: { value: lighting },
      uSpinAmount: { value: spinAmount },
      uPixelFilter: { value: pixelFilter },
      uSpinEase: { value: spinEase },
      uIsRotate: { value: isRotate },
      uMouse: { value: [0.5, 0.5] }
    }
  });

  const mesh = new Mesh(gl, { geometry, program });

  const setSize = () => {
    const rect = container.getBoundingClientRect();
    const w = Math.max(1, Math.floor(rect.width));
    const h = Math.max(1, Math.floor(rect.height));
    renderer.setSize(w, h);
    program.uniforms.iResolution.value = [gl.canvas.width, gl.canvas.height, gl.canvas.width / gl.canvas.height];
  };

  const ro = new ResizeObserver(setSize);
  ro.observe(container);
  setSize();

  let raf = 0;
  const loop = time => {
    if (!isTabVisible) {
      if (typeof raf !== 'undefined') raf = requestAnimationFrame(typeof loop !== 'undefined' ? loop : update);
      else if (typeof rafId !== 'undefined') rafId = requestAnimationFrame(typeof loop !== 'undefined' ? loop : update);
      else if (typeof animateId !== 'undefined') animateId = requestAnimationFrame(typeof loop !== 'undefined' ? loop : update);
      else if (typeof animationId !== 'undefined') animationId = requestAnimationFrame(typeof loop !== 'undefined' ? loop : update);
      return;
    }
    if (isUserScrollingFast && Math.random() < 0.5) {
      if (typeof raf !== 'undefined') raf = requestAnimationFrame(typeof loop !== 'undefined' ? loop : update);
      else if (typeof rafId !== 'undefined') rafId = requestAnimationFrame(typeof loop !== 'undefined' ? loop : update);
      else if (typeof animateId !== 'undefined') animateId = requestAnimationFrame(typeof loop !== 'undefined' ? loop : update);
      else if (typeof animationId !== 'undefined') animationId = requestAnimationFrame(typeof loop !== 'undefined' ? loop : update);
      return;
    }

    program.uniforms.iTime.value = time * 0.001;
    renderer.render({ scene: mesh });
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);

  const handleMouseMove = e => {
    if (!mouseInteraction) return;
    const rect = container.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = 1.0 - (e.clientY - rect.top) / rect.height;
    program.uniforms.uMouse.value = [x, y];
  };
  container.addEventListener('mousemove', handleMouseMove);

  return () => {
    cancelAnimationFrame(raf);
    ro.disconnect();
    container.removeEventListener('mousemove', handleMouseMove);
    try { container.removeChild(canvas); } catch {}
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  };
}

// ==========================================
// 11. FAULTY TERMINAL INITIALIZER (React Bits)
// ==========================================
function initFaultyTerminal(container, opts = {}) {
  const {
    scale = 1.5,
    gridMul = [2, 1],
    digitSize = 1.2,
    timeScale = 0.8,
    pause = false,
    scanlineIntensity = 1,
    glitchAmount = 1,
    flickerAmount = 1,
    noiseAmp = 1,
    chromaticAberration = 0,
    dither = 0,
    curvature = 0.1,
    tint = '#ffffff',
    mouseReact = true,
    mouseStrength = 0.5,
    pageLoadAnimation = false,
    brightness = 1
  } = opts;

  const hexToRgb = hex => {
    let h = hex.replace('#', '').trim();
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    const num = parseInt(h.slice(0, 6), 16);
    return [((num >> 16) & 255) / 255, ((num >> 8) & 255) / 255, (num & 255) / 255];
  };

  const vertexShader = `
  attribute vec2 position;
  attribute vec2 uv;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 0.0, 1.0);
  }
  `;

  const fragmentShader = `
  precision mediump float;

  varying vec2 vUv;

  uniform float iTime;
  uniform vec3  iResolution;
  uniform float uScale;

  uniform vec2  uGridMul;
  uniform float uDigitSize;
  uniform float uScanlineIntensity;
  uniform float uGlitchAmount;
  uniform float uFlickerAmount;
  uniform float uNoiseAmp;
  uniform float uChromaticAberration;
  uniform float uDither;
  uniform float uCurvature;
  uniform vec3  uTint;
  uniform vec2  uMouse;
  uniform float uMouseStrength;
  uniform float uUseMouse;
  uniform float uPageLoadProgress;
  uniform float uUsePageLoadAnimation;
  uniform float uBrightness;

  float time;

  float hash21(vec2 p){
    p = fract(p * 234.56);
    p += dot(p, p + 34.56);
    return fract(p.x * p.y);
  }

  float noise(vec2 p)
  {
    return sin(p.x * 10.0) * sin(p.y * (3.0 + sin(time * 0.090909))) + 0.2; 
  }

  mat2 rotate(float angle)
  {
    float c = cos(angle);
    float s = sin(angle);
    return mat2(c, -s, s, c);
  }

  float fbm(vec2 p)
  {
    p *= 1.1;
    float f = 0.0;
    float amp = 0.5 * uNoiseAmp;
    
    mat2 modify0 = rotate(time * 0.02);
    f += amp * noise(p);
    p = modify0 * p * 2.0;
    amp *= 0.454545;
    
    mat2 modify1 = rotate(time * 0.02);
    f += amp * noise(p);
    p = modify1 * p * 2.0;
    amp *= 0.454545;
    
    mat2 modify2 = rotate(time * 0.08);
    f += amp * noise(p);
    
    return f;
  }

  float pattern(vec2 p, out vec2 q, out vec2 r) {
    vec2 offset1 = vec2(1.0);
    vec2 offset0 = vec2(0.0);
    mat2 rot01 = rotate(0.1 * time);
    mat2 rot1 = rotate(0.1);
    
    q = vec2(fbm(p + offset1), fbm(rot01 * p + offset1));
    r = vec2(fbm(rot1 * q + offset0), fbm(q + offset0));
    return fbm(p + r);
  }

  float digit(vec2 p){
      vec2 grid = uGridMul * 15.0;
      vec2 s = floor(p * grid) / grid;
      p = p * grid;
      vec2 q, r;
      float intensity = pattern(s * 0.1, q, r) * 1.3 - 0.03;
      
      if(uUseMouse > 0.5){
          vec2 mouseWorld = uMouse * uScale;
          float distToMouse = distance(s, mouseWorld);
          float mouseInfluence = exp(-distToMouse * 8.0) * uMouseStrength * 10.0;
          intensity += mouseInfluence;
          
          float ripple = sin(distToMouse * 20.0 - iTime * 5.0) * 0.1 * mouseInfluence;
          intensity += ripple;
      }
      
      if(uUsePageLoadAnimation > 0.5){
          float cellRandom = fract(sin(dot(s, vec2(12.9898, 78.233))) * 43758.5453);
          float cellDelay = cellRandom * 0.8;
          float cellProgress = clamp((uPageLoadProgress - cellDelay) / 0.2, 0.0, 1.0);
          
          float fadeAlpha = smoothstep(0.0, 1.0, cellProgress);
          intensity *= fadeAlpha;
      }
      
      p = fract(p);
      p *= uDigitSize;
      
      float px5 = p.x * 5.0;
      float py5 = (1.0 - p.y) * 5.0;
      float x = fract(px5);
      float y = fract(py5);
      
      float i = floor(py5) - 2.0;
      float j = floor(px5) - 2.0;
      float n = i * i + j * j;
      float f = n * 0.0625;
      
      float isOn = step(0.1, intensity - f);
      float brightness = isOn * (0.2 + y * 0.8) * (0.75 + x * 0.25);
      
      return step(0.0, p.x) * step(p.x, 1.0) * step(0.0, p.y) * step(p.y, 1.0) * brightness;
  }

  float onOff(float a, float b, float c)
  {
    return step(c, sin(iTime + a * cos(iTime * b))) * uFlickerAmount;
  }

  float displace(vec2 look)
  {
      float y = look.y - mod(iTime * 0.25, 1.0);
      float window = 1.0 / (1.0 + 50.0 * y * y);
      return sin(look.y * 20.0 + iTime) * 0.0125 * onOff(4.0, 2.0, 0.8) * (1.0 + cos(iTime * 60.0)) * window;
  }

  vec3 getColor(vec2 p){
      float bar = step(mod(p.y + time * 20.0, 1.0), 0.2) * 0.4 + 1.0;
      bar *= uScanlineIntensity;
      
      float displacement = displace(p);
      p.x += displacement;

      if (uGlitchAmount != 1.0) {
        float extra = displacement * (uGlitchAmount - 1.0);
        p.x += extra;
      }

      float middle = digit(p);
      
      const float off = 0.002;
      float sum = digit(p + vec2(-off, -off)) + digit(p + vec2(0.0, -off)) + digit(p + vec2(off, -off)) +
                  digit(p + vec2(-off, 0.0)) + digit(p + vec2(0.0, 0.0)) + digit(p + vec2(off, 0.0)) +
                  digit(p + vec2(-off, off)) + digit(p + vec2(0.0, off)) + digit(p + vec2(off, off));
      
      vec3 baseColor = vec3(0.9) * middle + sum * 0.1 * vec3(1.0) * bar;
      return baseColor;
  }

  vec2 barrel(vec2 uv){
    vec2 c = uv * 2.0 - 1.0;
    float r2 = dot(c, c);
    c *= 1.0 + uCurvature * r2;
    return c * 0.5 + 0.5;
  }

  void main() {
      time = iTime * 0.333333;
      vec2 uv = vUv;

      if(uCurvature != 0.0){
        uv = barrel(uv);
      }
      
      vec2 p = uv * uScale;
      vec3 col = getColor(p);

      if(uChromaticAberration != 0.0){
        vec2 ca = vec2(uChromaticAberration) / iResolution.xy;
        col.r = getColor(p + ca).r;
        col.b = getColor(p - ca).b;
      }

      col *= uTint;
      col *= uBrightness;

      if(uDither > 0.0){
        float rnd = hash21(gl_FragCoord.xy);
        col += (rnd - 0.5) * (uDither * 0.003922);
      }

      gl_FragColor = vec4(col, 1.0);
  }
  `;

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const renderer = new Renderer({ dpr });
  const gl = renderer.gl;
  gl.clearColor(0, 0, 0, 1);
  const canvas = gl.canvas;
  canvas.style.width = '100%'; canvas.style.height = '100%'; canvas.style.display = 'block';
  container.appendChild(canvas);

  const geometry = new Triangle(gl);
  const tintVec = hexToRgb(tint);
  const ditherValue = typeof dither === 'boolean' ? (dither ? 1 : 0) : dither;

  const mouse = { x: 0.5, y: 0.5 };
  const smoothMouse = { x: 0.5, y: 0.5 };
  let frozenTime = 0;
  let loadAnimationStart = 0;
  const timeOffset = Math.random() * 100;

  const program = new Program(gl, {
    vertex: vertexShader,
    fragment: fragmentShader,
    uniforms: {
      iTime: { value: 0 },
      iResolution: {
        value: new Color(gl.canvas.width || 100, gl.canvas.height || 100, (gl.canvas.width || 100) / (gl.canvas.height || 100))
      },
      uScale: { value: scale },
      uGridMul: { value: new Float32Array(gridMul) },
      uDigitSize: { value: digitSize },
      uScanlineIntensity: { value: scanlineIntensity },
      uGlitchAmount: { value: glitchAmount },
      uFlickerAmount: { value: flickerAmount },
      uNoiseAmp: { value: noiseAmp },
      uChromaticAberration: { value: chromaticAberration },
      uDither: { value: ditherValue },
      uCurvature: { value: curvature },
      uTint: { value: new Color(tintVec[0], tintVec[1], tintVec[2]) },
      uMouse: { value: new Float32Array([smoothMouse.x, smoothMouse.y]) },
      uMouseStrength: { value: mouseStrength },
      uUseMouse: { value: mouseReact ? 1 : 0 },
      uPageLoadProgress: { value: pageLoadAnimation ? 0 : 1 },
      uUsePageLoadAnimation: { value: pageLoadAnimation ? 1 : 0 },
      uBrightness: { value: brightness }
    }
  });

  const mesh = new Mesh(gl, { geometry, program });

  const resize = () => {
    if (!container || !renderer) return;
    const w = container.offsetWidth || window.innerWidth;
    const h = container.offsetHeight || window.innerHeight;
    renderer.setSize(w, h);
    program.uniforms.iResolution.value = new Color(
      gl.canvas.width,
      gl.canvas.height,
      gl.canvas.width / (gl.canvas.height || 1)
    );
  };

  const ro = new ResizeObserver(resize);
  ro.observe(container);
  resize();

  const handleMouseMove = e => {
    const rect = container.getBoundingClientRect();
    mouse.x = (e.clientX - rect.left) / rect.width;
    mouse.y = 1 - (e.clientY - rect.top) / rect.height;
  };
  if (mouseReact) window.addEventListener('mousemove', handleMouseMove);

  let raf = 0;
  const update = t => {
    if (!isTabVisible) {
      if (typeof raf !== 'undefined') raf = requestAnimationFrame(typeof loop !== 'undefined' ? loop : update);
      else if (typeof rafId !== 'undefined') rafId = requestAnimationFrame(typeof loop !== 'undefined' ? loop : update);
      else if (typeof animateId !== 'undefined') animateId = requestAnimationFrame(typeof loop !== 'undefined' ? loop : update);
      else if (typeof animationId !== 'undefined') animationId = requestAnimationFrame(typeof loop !== 'undefined' ? loop : update);
      return;
    }
    if (isUserScrollingFast && Math.random() < 0.5) {
      if (typeof raf !== 'undefined') raf = requestAnimationFrame(typeof loop !== 'undefined' ? loop : update);
      else if (typeof rafId !== 'undefined') rafId = requestAnimationFrame(typeof loop !== 'undefined' ? loop : update);
      else if (typeof animateId !== 'undefined') animateId = requestAnimationFrame(typeof loop !== 'undefined' ? loop : update);
      else if (typeof animationId !== 'undefined') animationId = requestAnimationFrame(typeof loop !== 'undefined' ? loop : update);
      return;
    }

    raf = requestAnimationFrame(update);

    if (pageLoadAnimation && loadAnimationStart === 0) {
      loadAnimationStart = t;
    }

    if (!pause) {
      const elapsed = (t * 0.001 + timeOffset) * timeScale;
      program.uniforms.iTime.value = elapsed;
      frozenTime = elapsed;
    } else {
      program.uniforms.iTime.value = frozenTime;
    }

    if (pageLoadAnimation && loadAnimationStart > 0) {
      const animationDuration = 2000;
      const animationElapsed = t - loadAnimationStart;
      const progress = Math.min(animationElapsed / animationDuration, 1);
      program.uniforms.uPageLoadProgress.value = progress;
    }

    if (mouseReact) {
      const dampingFactor = 0.08;
      smoothMouse.x += (mouse.x - smoothMouse.x) * dampingFactor;
      smoothMouse.y += (mouse.y - smoothMouse.y) * dampingFactor;

      const mouseUniform = program.uniforms.uMouse.value;
      mouseUniform[0] = smoothMouse.x;
      mouseUniform[1] = smoothMouse.y;
    }

    renderer.render({ scene: mesh });
  };
  raf = requestAnimationFrame(update);

  return () => {
    cancelAnimationFrame(raf);
    ro.disconnect();
    if (mouseReact) window.removeEventListener('mousemove', handleMouseMove);
    try { container.removeChild(canvas); } catch {}
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  };
}

// ==========================================
// 12. MORPH SLIDER INITIALIZER (React Bits Port)
// ==========================================
const MORPH_TRANSITIONS = { melt: 0, ripple: 1, shear: 2, swirl: 3 };

const MORPH_DEFAULT_IMAGES = [
  'https://images.unsplash.com/photo-1518020382113-a7e8fc38eac9?q=80&w=1920&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1534796636912-3b95b3ab5986?q=80&w=1920&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1519681393784-d120267933ba?q=80&w=1920&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?q=80&w=1920&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1470770903676-69b98201ea1c?q=80&w=1920&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=1920&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=1920&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1511447333015-45b65e60f6d5?q=80&w=1920&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1502134249126-9f3755a50d78?q=80&w=1920&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=1920&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1507499739999-097706ad8914?q=80&w=1920&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?q=80&w=1920&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?q=80&w=1920&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=1920&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1541701494587-cb58502866ab?q=80&w=1920&auto=format&fit=crop'
];

const MORPH_VERT = `
attribute vec2 position;
attribute vec2 uv;
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const MORPH_FRAG = `
precision highp float;

uniform sampler2D tCurrent;
uniform sampler2D tNext;
uniform vec2 uResolution;
uniform vec2 uCurrentSize;
uniform vec2 uNextSize;
uniform float uProgress;
uniform float uDir;
uniform int uMode;
uniform float uIntensity;
uniform float uScale;
uniform float uAberration;
uniform float uDrift;
uniform float uTime;
uniform float uReduce;
uniform vec2 uPointer;
uniform vec3 uOverlay;

varying vec2 vUv;

const float PI = 3.14159265359;

float hash11(float p) {
  p = fract(p * 0.1031);
  p *= p + 33.33;
  p *= p + p;
  return fract(p);
}

float hash21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p *= 2.0;
    a *= 0.5;
  }
  return v;
}

mat2 rot(float a) {
  float s = sin(a);
  float c = cos(a);
  return mat2(c, -s, s, c);
}

vec2 coverUV(vec2 uv, vec2 res, vec2 img) {
  float rA = res.x / max(res.y, 1.0);
  float iA = img.x / max(img.y, 1.0);
  vec2 s = vec2(1.0);
  float ratio = rA / max(iA, 0.0001);
  if (ratio > 1.0) {
    s.y = 1.0 / ratio;
  } else {
    s.x = ratio;
  }
  return (uv - 0.5) * s + 0.5;
}

void main() {
  float p = clamp(uProgress, 0.0, 1.0);
  float env = sin(p * PI);

  vec2 uv = vUv;

  uv += vec2(sin(uTime * 0.25 + uv.y * 4.0), cos(uTime * 0.22 + uv.x * 4.0)) * uDrift * 0.008;
  uv = (uv - 0.5) * (1.0 - uDrift * 0.02 * sin(uTime * 0.4)) + 0.5;

  vec2 uvC = uv;
  vec2 uvN = uv;
  float m = smoothstep(0.0, 1.0, p);

  if (uReduce < 0.5) {
    if (uMode == 3) {
      vec2 c = uv - 0.5;
      float r = length(c);
      float ang = env * uIntensity * 3.5 * (1.0 - r);
      uvC = rot(ang) * c + 0.5;
      uvN = rot(-ang) * c + 0.5;
      m = smoothstep(0.0, 1.0, p);
    } else if (uMode == 1) {
      float d = distance(uv, uPointer);
      float ring = p * 1.6;
      float wave = sin((d - ring) * 30.0) * env;
      vec2 dir = normalize(uv - uPointer + 1e-4);
      vec2 disp = dir * wave * uIntensity * 0.25;
      uvC = uv + disp;
      uvN = uv + disp * 0.6;
      m = 1.0 - smoothstep(ring - 0.03, ring + 0.03, d);
    } else if (uMode == 2) {
      float slices = 14.0;
      float row = floor(uv.y * slices);
      float rnd = hash11(row);
      vec2 disp = vec2((rnd - 0.5) * env * uIntensity * 0.6, 0.0);
      uvC = uv + disp;
      uvN = uv + disp;
      float localX = uDir > 0.0 ? uv.x : 1.0 - uv.x;
      float th = p * 1.5 - 0.25 + (rnd - 0.5) * 0.25;
      m = 1.0 - smoothstep(th - 0.06, th + 0.06, localX);
    } else {
      float nn = fbm(uv * uScale + uTime * 0.03);
      float warp = fbm(uv * uScale * 1.7 - uTime * 0.02);
      vec2 g = vec2(nn, warp) - 0.5;
      uvC = uv + g * uIntensity * 0.5 * p;
      uvN = uv - g * uIntensity * 0.5 * (1.0 - p);
      m = smoothstep(nn - 0.15, nn + 0.15, p);
    }
  }

  vec2 sC = coverUV(uvC, uResolution, uCurrentSize);
  vec2 sN = coverUV(uvN, uResolution, uNextSize);

  float ca = uReduce < 0.5 ? uAberration * env * 0.03 : 0.0;

  vec3 colC = vec3(
    texture2D(tCurrent, sC + vec2(ca, 0.0)).r,
    texture2D(tCurrent, sC).g,
    texture2D(tCurrent, sC - vec2(ca, 0.0)).b
  );
  vec3 colN = vec3(
    texture2D(tNext, sN + vec2(ca, 0.0)).r,
    texture2D(tNext, sN).g,
    texture2D(tNext, sN - vec2(ca, 0.0)).b
  );

  vec3 col = mix(colC, colN, m);

  float vig = smoothstep(1.25, 0.25, length(uv - 0.5));
  col = mix(col, uOverlay, (1.0 - vig) * 0.28);

  gl_FragColor = vec4(col, 1.0);
}
`;

function hexToRgbArr(hex) {
  let h = (hex || '#000000').replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const n = parseInt(h, 16) || 0;
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function makeMorphFallbackTexture(gl) {
  const size = 4;
  const data = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    data[i * 4] = 10; data[i * 4 + 1] = 10; data[i * 4 + 2] = 14; data[i * 4 + 3] = 255;
  }
  return new Texture(gl, {
    image: data,
    width: size,
    height: size,
    generateMipmaps: false,
    minFilter: gl.LINEAR,
    magFilter: gl.LINEAR,
    wrapS: gl.CLAMP_TO_EDGE,
    wrapT: gl.CLAMP_TO_EDGE
  });
}

function easePower2InOut(t) {
  return t < 0.5 ? 2.0 * t * t : 1.0 - Math.pow(-2.0 * t + 2.0, 2.0) / 2.0;
}

function initMorphSlider(container, opts = {}) {
  const {
    images = MORPH_DEFAULT_IMAGES,
    transition = 'melt',
    duration = 1.4,
    intensity = 0.6,
    scale = 2.4,
    aberration = 0.35,
    drift = 0.35,
    overlayColor = '#000000',
    autoplayDelay = 5.0
  } = opts;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const renderer = new Renderer({
    alpha: false,
    antialias: true,
    dpr: getOptimizedDPR()
  });
  const gl = renderer.gl;
  gl.clearColor(0.03, 0.03, 0.04, 1);

  const canvas = gl.canvas;
  canvas.style.cssText = 'width: 100%; height: 100%; display: block; position: absolute; inset: 0;';
  container.appendChild(canvas);

  const geometry = new Triangle(gl);
  const textures = images.map(() => makeMorphFallbackTexture(gl));
  const sizes = images.map(() => [1920, 1080]);

  let currentIndex = 0;
  let nextIndex = 0;
  let isTransitioning = false;

  // Carrega as imagens de forma assíncrona com CrossOrigin seguro
  images.forEach((url, idx) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = url;
    img.onload = () => {
      try {
        const tex = new Texture(gl, {
          generateMipmaps: false,
          minFilter: gl.LINEAR,
          magFilter: gl.LINEAR,
          wrapS: gl.CLAMP_TO_EDGE,
          wrapT: gl.CLAMP_TO_EDGE
        });
        tex.image = img;
        textures[idx] = tex;
        sizes[idx] = [img.naturalWidth || 1920, img.naturalHeight || 1080];
        if (idx === currentIndex && !isTransitioning) {
          program.uniforms.tCurrent.value = tex;
          program.uniforms.uCurrentSize.value = sizes[idx];
        }
      } catch (e) {
        console.warn('MorphSlider texture error:', e);
      }
    };
  });

  const transitionModes = [0, 1, 2, 3]; // melt, ripple, shear, swirl
  let currentModeIndex = MORPH_TRANSITIONS[transition] ?? 0;

  const program = new Program(gl, {
    vertex: MORPH_VERT,
    fragment: MORPH_FRAG,
    uniforms: {
      tCurrent: { value: textures[0] },
      tNext: { value: textures[0] },
      uResolution: { value: [gl.canvas.width || 1, gl.canvas.height || 1] },
      uCurrentSize: { value: sizes[0] },
      uNextSize: { value: sizes[0] },
      uProgress: { value: 0.0 },
      uDir: { value: 1.0 },
      uMode: { value: currentModeIndex },
      uIntensity: { value: intensity },
      uScale: { value: scale },
      uAberration: { value: aberration },
      uDrift: { value: drift },
      uTime: { value: 0.0 },
      uReduce: { value: reducedMotion ? 1.0 : 0.0 },
      uPointer: { value: [0.5, 0.5] },
      uOverlay: { value: hexToRgbArr(overlayColor) }
    }
  });

  const mesh = new Mesh(gl, { geometry, program });

  const resize = () => {
    if (!container || !renderer) return;
    const w = container.clientWidth || window.innerWidth || 1;
    const h = container.clientHeight || window.innerHeight || 1;
    renderer.setSize(w, h);
    program.uniforms.uResolution.value = [gl.canvas.width, gl.canvas.height];
  };

  const ro = new ResizeObserver(resize);
  ro.observe(container);
  resize();

  // Mouse interaction
  const handleMouseMove = (e) => {
    const rect = container.getBoundingClientRect();
    const px = (e.clientX - rect.left) / Math.max(rect.width, 1);
    const py = 1.0 - (e.clientY - rect.top) / Math.max(rect.height, 1);
    program.uniforms.uPointer.value = [px, py];
  };
  window.addEventListener('mousemove', handleMouseMove);

  // Autoplay State Machine
  let transitionStartTime = 0;
  let lastSlideTime = performance.now();
  let transitionCount = 0;
  const autoplayDelayMs = Math.max(autoplayDelay, 2.0) * 1000;
  const transitionDurationMs = Math.max(duration, 0.5) * 1000;

  let raf;
  const update = (t) => {
    raf = requestAnimationFrame(update);

    program.uniforms.uTime.value = t * 0.001;

    if (!isTransitioning) {
      if (t - lastSlideTime >= autoplayDelayMs && images.length > 1) {
        isTransitioning = true;
        transitionStartTime = t;
        nextIndex = (currentIndex + 1) % images.length;
        transitionCount++;

        currentModeIndex = transitionModes[transitionCount % transitionModes.length];
        program.uniforms.uMode.value = currentModeIndex;

        program.uniforms.tCurrent.value = textures[currentIndex];
        program.uniforms.uCurrentSize.value = sizes[currentIndex];
        program.uniforms.tNext.value = textures[nextIndex];
        program.uniforms.uNextSize.value = sizes[nextIndex];
        program.uniforms.uDir.value = 1.0;
        program.uniforms.uProgress.value = 0.0;
      }
    } else {
      const elapsed = t - transitionStartTime;
      const progress = Math.min(1.0, elapsed / transitionDurationMs);
      const easedProgress = easePower2InOut(progress);
      program.uniforms.uProgress.value = easedProgress;

      if (progress >= 1.0) {
        isTransitioning = false;
        currentIndex = nextIndex;
        program.uniforms.tCurrent.value = textures[currentIndex];
        program.uniforms.uCurrentSize.value = sizes[currentIndex];
        program.uniforms.uProgress.value = 0.0;
        lastSlideTime = t;
      }
    }

    renderer.render({ scene: mesh });
  };
  raf = requestAnimationFrame(update);

  return () => {
    cancelAnimationFrame(raf);
    ro.disconnect();
    window.removeEventListener('mousemove', handleMouseMove);
    try { container.removeChild(canvas); } catch {}
    textures.forEach(tex => {
      try { if (tex && tex.texture) gl.deleteTexture(tex.texture); } catch {}
    });
    try { gl.getExtension('WEBGL_lose_context')?.loseContext(); } catch {}
  };
}

// ==========================================
// 13. ANTIGRAVITY INITIALIZER (React Bits)
// ==========================================
function initAntigravity(container, opts = {}) {
  const {
    count = 280,
    magnetRadius = 8,
    ringRadius = 9,
    waveSpeed = 0.45,
    waveAmplitude = 1.2,
    particleSize = 1.8,
    lerpSpeed = 0.06,
    color = '#FF9FFC',
    autoAnimate = true,
    particleVariance = 1.0,
    depthFactor = 1.2,
    pulseSpeed = 2.5
  } = opts;

  const THREE_LIB = typeof THREE !== 'undefined' ? THREE : (typeof window !== 'undefined' ? window.THREE : null);
  if (!THREE_LIB) {
    console.warn('Three.js não encontrado para o efeito Antigravity');
    return () => {};
  }

  const scene = new THREE_LIB.Scene();
  const camera = new THREE_LIB.PerspectiveCamera(35, 1, 0.1, 1000);
  camera.position.set(0, 0, 50);

  const renderer = new THREE_LIB.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const canvas = renderer.domElement;
  canvas.style.position = 'absolute';
  canvas.style.inset = '0';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.display = 'block';
  container.appendChild(canvas);

  const dummy = new THREE_LIB.Object3D();
  const geom = new THREE_LIB.CylinderGeometry(0.1, 0.1, 0.4, 8);
  const mat = new THREE_LIB.MeshBasicMaterial({ color: new THREE_LIB.Color(color), transparent: true, opacity: 0.9 });
  const mesh = new THREE_LIB.InstancedMesh(geom, mat, count);
  scene.add(mesh);

  const lastMousePos = { x: 0, y: 0 };
  let lastMouseMoveTime = Date.now();
  const virtualMouse = { x: 0, y: 0 };
  const mouse = { x: 0, y: 0 };

  const onPointerMove = (e) => {
    const rect = container.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
    const dist = Math.hypot(mouse.x - lastMousePos.x, mouse.y - lastMousePos.y);
    if (dist > 0.001) {
      lastMouseMoveTime = Date.now();
      lastMousePos.x = mouse.x;
      lastMousePos.y = mouse.y;
    }
  };
  window.addEventListener('pointermove', onPointerMove, { passive: true });

  const particles = [];
  const width = 60, height = 40;
  for (let i = 0; i < count; i++) {
    const t = Math.random() * 100;
    const factor = 20 + Math.random() * 100;
    const speed = 0.01 + Math.random() / 200;
    const x = (Math.random() - 0.5) * width;
    const y = (Math.random() - 0.5) * height;
    const z = (Math.random() - 0.5) * 20;
    const randomRadiusOffset = (Math.random() - 0.5) * 2;
    particles.push({ t, factor, speed, mx: x, my: y, mz: z, cx: x, cy: y, cz: z, randomRadiusOffset });
  }

  const resize = () => {
    const w = container.clientWidth || window.innerWidth || 1;
    const h = container.clientHeight || window.innerHeight || 1;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(container);
  resize();

  let raf = 0;
  let startTime = performance.now();
  const loop = (now) => {
    raf = requestAnimationFrame(loop);
    const elapsed = (now - startTime) * 0.001;

    const vHeight = 2 * Math.tan(THREE_LIB.MathUtils.degToRad(35 / 2)) * 50;
    const vWidth = vHeight * camera.aspect;

    let destX = (mouse.x * vWidth) / 2;
    let destY = (mouse.y * vHeight) / 2;

    if (autoAnimate && Date.now() - lastMouseMoveTime > 2000) {
      destX = Math.sin(elapsed * 0.5) * (vWidth / 4);
      destY = Math.cos(elapsed * 0.5 * 2) * (vHeight / 4);
    }

    virtualMouse.x += (destX - virtualMouse.x) * 0.05;
    virtualMouse.y += (destY - virtualMouse.y) * 0.05;

    particles.forEach((p, i) => {
      p.t += p.speed / 2;
      const projectionFactor = 1 - p.cz / 50;
      const projX = virtualMouse.x * projectionFactor;
      const projY = virtualMouse.y * projectionFactor;

      const dx = p.mx - projX;
      const dy = p.my - projY;
      const dist = Math.hypot(dx, dy);

      let targetPos = { x: p.mx, y: p.my, z: p.mz * depthFactor };
      if (dist < magnetRadius) {
        const angle = Math.atan2(dy, dx);
        const wave = Math.sin(p.t * waveSpeed + angle) * (0.5 * waveAmplitude);
        const deviation = p.randomRadiusOffset * 0.5;
        const curRing = ringRadius + wave + deviation;

        targetPos.x = projX + curRing * Math.cos(angle);
        targetPos.y = projY + curRing * Math.sin(angle);
        targetPos.z = p.mz * depthFactor + Math.sin(p.t) * (1 * waveAmplitude * depthFactor);
      }

      p.cx += (targetPos.x - p.cx) * lerpSpeed;
      p.cy += (targetPos.y - p.cy) * lerpSpeed;
      p.cz += (targetPos.z - p.cz) * lerpSpeed;

      dummy.position.set(p.cx, p.cy, p.cz);
      dummy.lookAt(projX, projY, p.cz);
      dummy.rotateX(Math.PI / 2);

      const curDist = Math.hypot(p.cx - projX, p.cy - projY);
      const distFromRing = Math.abs(curDist - ringRadius);
      let scaleFactor = Math.max(0, Math.min(1, 1 - distFromRing / 10));
      const finalScale = scaleFactor * (0.8 + Math.sin(p.t * pulseSpeed) * 0.2 * particleVariance) * particleSize;
      dummy.scale.set(finalScale, finalScale, finalScale);
      dummy.updateMatrix();

      mesh.setMatrixAt(i, dummy.matrix);
    });

    mesh.instanceMatrix.needsUpdate = true;
    renderer.render(scene, camera);
  };
  raf = requestAnimationFrame(loop);

  return () => {
    cancelAnimationFrame(raf);
    ro.disconnect();
    window.removeEventListener('pointermove', onPointerMove);
    try { container.removeChild(canvas); } catch {}
    geom.dispose();
    mat.dispose();
    renderer.dispose();
  };
}

// ==========================================
// 14. AURORA BOREALIS INITIALIZER (Universal WebGL 1/2)
// ==========================================
function initAurora(container, opts = {}) {
  const {
    colorStops = ['#5227FF', '#7cff67', '#00f0ff'],
    amplitude = 1.0,
    blend = 0.5,
    speed = 0.8
  } = opts;

  const VERT = `
  attribute vec2 position;
  attribute vec2 uv;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 0.0, 1.0);
  }
  `;

  const FRAG = `
  precision highp float;
  uniform float uTime;
  uniform float uAmplitude;
  uniform vec3 uColor1;
  uniform vec3 uColor2;
  uniform vec3 uColor3;
  uniform vec2 uResolution;
  uniform float uBlend;
  varying vec2 vUv;

  vec3 permute(vec3 x) {
    return mod(((x * 34.0) + 1.0) * x, 289.0);
  }

  float snoise(vec2 v){
    const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
    vec2 i  = floor(v + dot(v, C.yy));
    vec2 x0 = v - i + dot(i, C.xx);
    vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod(i, 289.0);
    vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
    vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
    m = m * m * m * m;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
    vec3 g;
    g.x  = a0.x  * x0.x  + h.x  * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }

  void main() {
    vec2 uv = gl_FragCoord.xy / uResolution;
    
    // Smooth 3-color ramp sem indexação dinâmica de array
    float f = clamp(uv.x, 0.0, 1.0);
    vec3 rampColor = (f < 0.5) 
      ? mix(uColor1, uColor2, f * 2.0) 
      : mix(uColor2, uColor3, (f - 0.5) * 2.0);
    
    float height = snoise(vec2(uv.x * 2.0 + uTime * 0.1, uTime * 0.25)) * 0.5 * uAmplitude;
    height = exp(height);
    height = (uv.y * 2.0 - height + 0.2);
    float intensity = 0.6 * height;
    
    float midPoint = 0.20;
    float blendVal = max(0.01, uBlend);
    float auroraAlpha = smoothstep(midPoint - blendVal * 0.5, midPoint + blendVal * 0.5, intensity);
    vec3 auroraColor = intensity * rampColor;
    gl_FragColor = vec4(auroraColor * auroraAlpha, auroraAlpha);
  }
  `;

  const renderer = new Renderer({ dpr: getOptimizedDPR(), alpha: true, premultipliedAlpha: true, antialias: false, powerPreference: 'low-power' });
  const gl = renderer.gl;
  gl.clearColor(0, 0, 0, 0);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  const canvas = gl.canvas;
  canvas.style.position = 'absolute';
  canvas.style.inset = '0';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.display = 'block';
  container.appendChild(canvas);

  const geometry = new Triangle(gl);
  const c1 = new Color(colorStops[0] || '#5227FF');
  const c2 = new Color(colorStops[1] || '#7cff67');
  const c3 = new Color(colorStops[2] || '#00f0ff');

  const program = new Program(gl, {
    vertex: VERT,
    fragment: FRAG,
    uniforms: {
      uTime: { value: 0 },
      uAmplitude: { value: amplitude },
      uColor1: { value: [c1.r, c1.g, c1.b] },
      uColor2: { value: [c2.r, c2.g, c2.b] },
      uColor3: { value: [c3.r, c3.g, c3.b] },
      uResolution: { value: [container.offsetWidth || 1, container.offsetHeight || 1] },
      uBlend: { value: blend }
    }
  });

  const mesh = new Mesh(gl, { geometry, program });

  const resize = () => {
    const w = container.clientWidth || window.innerWidth || 1;
    const h = container.clientHeight || window.innerHeight || 1;
    renderer.setSize(w, h);
    program.uniforms.uResolution.value = [w, h];
  };
  const ro = new ResizeObserver(resize);
  ro.observe(container);
  resize();

  let raf = 0;
  const startTime = performance.now();
  const loop = (now) => {
    if (!isTabVisible) {
      raf = requestAnimationFrame(loop);
      return;
    }
    raf = requestAnimationFrame(loop);
    const elapsed = (now - startTime) * 0.001;
    program.uniforms.uTime.value = elapsed * speed * 0.2;
    renderer.render({ scene: mesh });
  };
  raf = requestAnimationFrame(loop);

  return () => {
    cancelAnimationFrame(raf);
    ro.disconnect();
    try { container.removeChild(canvas); } catch {}
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  };
}

// ==========================================
// 15. LETTER GLITCH INITIALIZER (React Bits / 2D Canvas)
// ==========================================
function initLetterGlitch(container, opts = {}) {
  const {
    glitchColors = ['#2b4539', '#61dca3', '#61b3dc', '#ff6b35'],
    glitchSpeed = 45,
    outerVignette = true,
    smooth = true,
    characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ!@#$&*()-_+=/[]{};:<>.,0123456789'
  } = opts;

  const canvas = document.createElement('canvas');
  canvas.style.position = 'absolute';
  canvas.style.inset = '0';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.display = 'block';
  canvas.style.backgroundColor = '#000000';
  container.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  const lettersAndSymbols = Array.from(characters);
  const fontSize = 28, charWidth = 26, charHeight = 36;

  let grid = { columns: 0, rows: 0 };
  let letters = [];
  let lastGlitchTime = Date.now();

  const getRandomChar = () => lettersAndSymbols[Math.floor(Math.random() * lettersAndSymbols.length)];
  const getRandomColor = () => glitchColors[Math.floor(Math.random() * glitchColors.length)];

  const hexToRgb = (hex) => {
    let h = hex.replace('#', '').trim();
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    const num = parseInt(h.slice(0, 6), 16);
    return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
  };

  const interpolateColor = (start, end, factor) => {
    const r = Math.round(start.r + (end.r - start.r) * factor);
    const g = Math.round(start.g + (end.g - start.g) * factor);
    const b = Math.round(start.b + (end.b - start.b) * factor);
    return `rgb(${r}, ${g}, ${b})`;
  };

  const initGrid = (w, h) => {
    const cols = Math.ceil(w / charWidth);
    const rows = Math.ceil(h / charHeight);
    grid = { columns: cols, rows };
    letters = Array.from({ length: cols * rows }, () => ({
      char: getRandomChar(),
      color: getRandomColor(),
      targetColor: getRandomColor(),
      colorProgress: 1
    }));
  };

  const resize = () => {
    const dpr = 1.0;
    const w = container.clientWidth || window.innerWidth || 1;
    const h = container.clientHeight || window.innerHeight || 1;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    initGrid(w, h);
  };
  const ro = new ResizeObserver(resize);
  ro.observe(container);
  resize();

  const drawLetters = () => {
    if (!ctx || letters.length === 0) return;
    const w = canvas.width / (window.devicePixelRatio || 1);
    const h = canvas.height / (window.devicePixelRatio || 1);
    ctx.clearRect(0, 0, w, h);
    ctx.font = `${fontSize}px monospace`;
    ctx.textBaseline = 'top';

    letters.forEach((l, i) => {
      const x = (i % grid.columns) * charWidth;
      const y = Math.floor(i / grid.columns) * charHeight;
      ctx.fillStyle = l.color;
      ctx.fillText(l.char, x, y);
    });

    if (outerVignette) {
      const rad = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.7);
      rad.addColorStop(0, 'rgba(0,0,0,0)');
      rad.addColorStop(1, 'rgba(0,0,0,0.85)');
      ctx.fillStyle = rad;
      ctx.fillRect(0, 0, w, h);
    }
  };

  const updateLetters = () => {
    if (!letters.length) return;
    const updateCount = Math.max(1, Math.floor(letters.length * 0.01));
    for (let i = 0; i < updateCount; i++) {
      const idx = Math.floor(Math.random() * letters.length);
      if (!letters[idx]) continue;
      letters[idx].char = getRandomChar();
      letters[idx].targetColor = getRandomColor();
      if (!smooth) {
        letters[idx].color = letters[idx].targetColor;
        letters[idx].colorProgress = 1;
      } else {
        letters[idx].colorProgress = 0;
      }
    }
  };

  const handleSmooth = () => {
    letters.forEach(l => {
      if (l.colorProgress < 1) {
        l.colorProgress += 0.05;
        if (l.colorProgress > 1) l.colorProgress = 1;
        const sRgb = hexToRgb(l.color.startsWith('rgb') ? '#61dca3' : l.color);
        const eRgb = hexToRgb(l.targetColor);
        l.color = interpolateColor(sRgb, eRgb, l.colorProgress);
      }
    });
  };

  let raf = 0;
  const loop = () => {
    if (!isTabVisible) {
      if (typeof raf !== 'undefined') raf = requestAnimationFrame(typeof loop !== 'undefined' ? loop : update);
      else if (typeof rafId !== 'undefined') rafId = requestAnimationFrame(typeof loop !== 'undefined' ? loop : update);
      else if (typeof animateId !== 'undefined') animateId = requestAnimationFrame(typeof loop !== 'undefined' ? loop : update);
      else if (typeof animationId !== 'undefined') animationId = requestAnimationFrame(typeof loop !== 'undefined' ? loop : update);
      return;
    }
    if (isUserScrollingFast && Math.random() < 0.5) {
      if (typeof raf !== 'undefined') raf = requestAnimationFrame(typeof loop !== 'undefined' ? loop : update);
      else if (typeof rafId !== 'undefined') rafId = requestAnimationFrame(typeof loop !== 'undefined' ? loop : update);
      else if (typeof animateId !== 'undefined') animateId = requestAnimationFrame(typeof loop !== 'undefined' ? loop : update);
      else if (typeof animationId !== 'undefined') animationId = requestAnimationFrame(typeof loop !== 'undefined' ? loop : update);
      return;
    }

    raf = requestAnimationFrame(loop);
    const now = Date.now();
    if (now - lastGlitchTime >= glitchSpeed) {
      updateLetters();
      lastGlitchTime = now;
    }
    if (smooth) handleSmooth();
    drawLetters();
  };
  raf = requestAnimationFrame(loop);

  return () => {
    cancelAnimationFrame(raf);
    ro.disconnect();
    try { container.removeChild(canvas); } catch {}
  };
}

// ==========================================
// 16. PLASMA INITIALIZER (React Bits / OGL)
// ==========================================
function initPlasma(container, opts = {}) {
  const {
    color = '#ff6b35',
    speed = 0.7,
    direction = 'forward',
    scale = 1.1,
    opacity = 0.85,
    mouseInteractive = true,
    iterations = 50
  } = opts;

  const hexToRgb = hex => {
    let h = hex.replace('#', '').trim();
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    const num = parseInt(h.slice(0, 6), 16);
    return [((num >> 16) & 255) / 255, ((num >> 8) & 255) / 255, (num & 255) / 255];
  };

  const vertex = `#version 300 es
  precision highp float;
  in vec2 position;
  in vec2 uv;
  out vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 0.0, 1.0);
  }
  `;

  const fragment = `#version 300 es
  precision highp float;
  uniform vec2 iResolution;
  uniform float iTime;
  uniform vec3 uCustomColor;
  uniform float uUseCustomColor;
  uniform float uSpeed;
  uniform float uDirection;
  uniform float uScale;   
  uniform float uOpacity;
  uniform vec2 uMouse;
  uniform float uMouseInteractive;
  uniform float uQuality;
  uniform float uStepScale;
  out vec4 fragColor;

  void mainImage(out vec4 o, vec2 C) {
    vec2 center = iResolution.xy * 0.5;
    C = (C - center) / uScale + center;
    vec2 mouseOffset = (uMouse - center) * 0.0002;
    C += mouseOffset * length(C - center) * step(0.5, uMouseInteractive);
    
    float i, d, z, T = iTime * uSpeed * uDirection;
    vec3 O, p, S;
    for (vec2 r = iResolution.xy, Q; ++i < 60.0; O += o.w/d*o.xyz) {
      p = z*normalize(vec3(C-.5*r,r.y)); 
      p.z -= 4.; 
      S = p;
      d = p.y-T;
      p.x += .4*(1.+p.y)*sin(d + p.x*0.1)*cos(.34*d + p.x*0.05); 
      Q = p.xz *= mat2(cos(p.y+vec4(0,11,33,0)-T)); 
      z += d = (abs(sqrt(length(Q*Q)) - .25*(5.+S.y))/3.+8e-4) * uStepScale;
      o = 1.+sin(S.y+p.z*.5+S.z-length(S-p)+vec4(2,1,0,8));
      if (i >= uQuality) break;
    }
    o.xyz = tanh(O/1e4);
  }

  void main() {
    vec4 o = vec4(0.0);
    mainImage(o, gl_FragCoord.xy);
    vec3 rgb = clamp(o.rgb, 0.0, 1.0);
    float intensity = (rgb.r + rgb.g + rgb.b) / 3.0;
    vec3 customColor = intensity * uCustomColor;
    vec3 finalColor = mix(rgb, customColor, step(0.5, uUseCustomColor));
    float alpha = length(rgb) * uOpacity;
    fragColor = vec4(finalColor, clamp(alpha, 0.0, 1.0));
  }
  `;

  const renderer = new Renderer({ alpha: true, antialias: false, dpr: getOptimizedDPR() });
  const gl = renderer.gl;
  const canvas = gl.canvas;
  canvas.style.position = 'absolute';
  canvas.style.inset = '0';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.display = 'block';
  container.appendChild(canvas);

  const geometry = new Triangle(gl);
  const program = new Program(gl, {
    vertex,
    fragment,
    uniforms: {
      iTime: { value: 0 },
      iResolution: { value: new Float32Array([1, 1]) },
      uCustomColor: { value: new Float32Array(hexToRgb(color)) },
      uUseCustomColor: { value: color ? 1.0 : 0.0 },
      uSpeed: { value: speed * 0.4 },
      uDirection: { value: direction === 'reverse' ? -1.0 : 1.0 },
      uScale: { value: scale },
      uOpacity: { value: opacity },
      uMouse: { value: new Float32Array([0, 0]) },
      uMouseInteractive: { value: mouseInteractive ? 1.0 : 0.0 },
      uQuality: { value: iterations },
      uStepScale: { value: 60.0 / iterations }
    }
  });

  const mesh = new Mesh(gl, { geometry, program });

  const onMouseMove = e => {
    if (!mouseInteractive) return;
    const rect = container.getBoundingClientRect();
    program.uniforms.uMouse.value[0] = e.clientX - rect.left;
    program.uniforms.uMouse.value[1] = e.clientY - rect.top;
  };
  if (mouseInteractive) container.addEventListener('mousemove', onMouseMove, { passive: true });

  const resize = () => {
    const w = container.clientWidth || window.innerWidth || 1;
    const h = container.clientHeight || window.innerHeight || 1;
    renderer.setSize(w, h);
    program.uniforms.iResolution.value[0] = gl.drawingBufferWidth;
    program.uniforms.iResolution.value[1] = gl.drawingBufferHeight;
  };
  const ro = new ResizeObserver(resize);
  ro.observe(container);
  resize();

  let raf = 0;
  const startTime = performance.now();
  const loop = now => {
    if (!isTabVisible) {
      if (typeof raf !== 'undefined') raf = requestAnimationFrame(typeof loop !== 'undefined' ? loop : update);
      else if (typeof rafId !== 'undefined') rafId = requestAnimationFrame(typeof loop !== 'undefined' ? loop : update);
      else if (typeof animateId !== 'undefined') animateId = requestAnimationFrame(typeof loop !== 'undefined' ? loop : update);
      else if (typeof animationId !== 'undefined') animationId = requestAnimationFrame(typeof loop !== 'undefined' ? loop : update);
      return;
    }
    if (isUserScrollingFast && Math.random() < 0.5) {
      if (typeof raf !== 'undefined') raf = requestAnimationFrame(typeof loop !== 'undefined' ? loop : update);
      else if (typeof rafId !== 'undefined') rafId = requestAnimationFrame(typeof loop !== 'undefined' ? loop : update);
      else if (typeof animateId !== 'undefined') animateId = requestAnimationFrame(typeof loop !== 'undefined' ? loop : update);
      else if (typeof animationId !== 'undefined') animationId = requestAnimationFrame(typeof loop !== 'undefined' ? loop : update);
      return;
    }

    raf = requestAnimationFrame(loop);
    program.uniforms.iTime.value = (now - startTime) * 0.001;
    renderer.render({ scene: mesh });
  };
  raf = requestAnimationFrame(loop);

  return () => {
    cancelAnimationFrame(raf);
    ro.disconnect();
    if (mouseInteractive) container.removeEventListener('mousemove', onMouseMove);
    try { container.removeChild(canvas); } catch {}
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  };
}

// ==========================================
// 17. LIQUID ETHER INITIALIZER (React Bits / Three.js Navier-Stokes)
// ==========================================
function initLiquidEther(container, opts = {}) {
  const THREE = typeof window !== 'undefined' ? (window.THREE || (typeof globalThis !== 'undefined' ? globalThis.THREE : null)) : null;
  if (!THREE) {
    console.warn('Three.js não encontrado para LiquidEther');
    return () => {};
  }

  const {
    mouseForce = 20,
    cursorSize = 100,
    isViscous = false,
    viscous = 30,
    iterationsViscous = 16,
    iterationsPoisson = 16,
    dt = 0.014,
    BFECC = true,
    resolution = 0.5,
    isBounce = false,
    colors = ['#5227FF', '#FF9FFC', '#B497CF'],
    autoDemo = true,
    autoSpeed = 0.5,
    autoIntensity = 2.2,
    takeoverDuration = 0.25,
    autoResumeDelay = 1000,
    autoRampDuration = 0.6,
    backgroundColor = '#000000',
    lightMode = false
  } = opts;

  function makePaletteTexture(stops) {
      let arr;
      if (Array.isArray(stops) && stops.length > 0) {
        if (stops.length === 1) {
          arr = [stops[0], stops[0]];
        } else {
          arr = stops;
        }
      } else {
        arr = ['#ffffff', '#ffffff'];
      }
      const w = arr.length;
      const data = new Uint8Array(w * 4);
      for (let i = 0; i < w; i++) {
        const c = new THREE.Color(arr[i]);
        data[i * 4 + 0] = Math.round(c.r * 255);
        data[i * 4 + 1] = Math.round(c.g * 255);
        data[i * 4 + 2] = Math.round(c.b * 255);
        data[i * 4 + 3] = 255;
      }
      const tex = new THREE.DataTexture(data, w, 1, THREE.RGBAFormat);
      tex.magFilter = THREE.LinearFilter;
      tex.minFilter = THREE.LinearFilter;
      tex.wrapS = THREE.ClampToEdgeWrapping;
      tex.wrapT = THREE.ClampToEdgeWrapping;
      tex.generateMipmaps = false;
      tex.needsUpdate = true;
      return tex;
    }

    const paletteTex = makePaletteTexture(colors);
    const bg = new THREE.Color(backgroundColor);
    const bgVec4 = lightMode ? new THREE.Vector4(bg.r, bg.g, bg.b, 1) : new THREE.Vector4(0, 0, 0, 0);

    class CommonClass {
      constructor() {
        this.width = 0;
        this.height = 0;
        this.aspect = 1;
        this.pixelRatio = 1;
        this.isMobile = false;
        this.breakpoint = 768;
        this.fboWidth = null;
        this.fboHeight = null;
        this.time = 0;
        this.delta = 0;
        this.container = null;
        this.renderer = null;
        this.clock = null;
      }
      init(container) {
        this.container = container;
        this.pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
        this.resize();
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.autoClear = false;
        this.renderer.setClearColor(new THREE.Color(0x000000), 0);
        this.renderer.setPixelRatio(this.pixelRatio);
        this.renderer.setSize(this.width, this.height);
        this.renderer.domElement.style.width = '100%';
        this.renderer.domElement.style.height = '100%';
        this.renderer.domElement.style.display = 'block';
        this.clock = new THREE.Clock();
        this.clock.start();
      }
      resize() {
        if (!this.container) return;
        const rect = this.container.getBoundingClientRect();
        this.width = Math.max(1, Math.floor(rect.width));
        this.height = Math.max(1, Math.floor(rect.height));
        this.aspect = this.width / this.height;
        if (this.renderer) this.renderer.setSize(this.width, this.height, false);
      }
      update() {
        this.delta = this.clock.getDelta();
        this.time += this.delta;
      }
    }
    const Common = new CommonClass();

    class MouseClass {
      constructor() {
        this.mouseMoved = false;
        this.coords = new THREE.Vector2();
        this.coords_old = new THREE.Vector2();
        this.diff = new THREE.Vector2();
        this.timer = null;
        this.container = null;
        this.docTarget = null;
        this.listenerTarget = null;
        this.isHoverInside = false;
        this.hasUserControl = false;
        this.isAutoActive = false;
        this.autoIntensity = 2.0;
        this.takeoverActive = false;
        this.takeoverStartTime = 0;
        this.takeoverDuration = 0.25;
        this.takeoverFrom = new THREE.Vector2();
        this.takeoverTo = new THREE.Vector2();
        this.onInteract = null;
        this._onMouseMove = this.onDocumentMouseMove.bind(this);
        this._onTouchStart = this.onDocumentTouchStart.bind(this);
        this._onTouchMove = this.onDocumentTouchMove.bind(this);
        this._onTouchEnd = this.onTouchEnd.bind(this);
        this._onDocumentLeave = this.onDocumentLeave.bind(this);
      }
      init(container) {
        this.container = container;
        this.docTarget = container.ownerDocument || null;
        const defaultView =
          (this.docTarget && this.docTarget.defaultView) || (typeof window !== 'undefined' ? window : null);
        if (!defaultView) return;
        this.listenerTarget = defaultView;
        this.listenerTarget.addEventListener('mousemove', this._onMouseMove);
        this.listenerTarget.addEventListener('touchstart', this._onTouchStart, { passive: true });
        this.listenerTarget.addEventListener('touchmove', this._onTouchMove, { passive: true });
        this.listenerTarget.addEventListener('touchend', this._onTouchEnd);
        if (this.docTarget) {
          this.docTarget.addEventListener('mouseleave', this._onDocumentLeave);
        }
      }
      dispose() {
        if (this.listenerTarget) {
          this.listenerTarget.removeEventListener('mousemove', this._onMouseMove);
          this.listenerTarget.removeEventListener('touchstart', this._onTouchStart);
          this.listenerTarget.removeEventListener('touchmove', this._onTouchMove);
          this.listenerTarget.removeEventListener('touchend', this._onTouchEnd);
        }
        if (this.docTarget) {
          this.docTarget.removeEventListener('mouseleave', this._onDocumentLeave);
        }
        this.listenerTarget = null;
        this.docTarget = null;
        this.container = null;
      }
      isPointInside(clientX, clientY) {
        if (!this.container) return false;
        const rect = this.container.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return false;
        return clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
      }
      updateHoverState(clientX, clientY) {
        this.isHoverInside = this.isPointInside(clientX, clientY);
        return this.isHoverInside;
      }
      setCoords(x, y) {
        if (!this.container) return;
        if (this.timer) window.clearTimeout(this.timer);
        const rect = this.container.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;
        const nx = (x - rect.left) / rect.width;
        const ny = (y - rect.top) / rect.height;
        this.coords.set(nx * 2 - 1, -(ny * 2 - 1));
        this.mouseMoved = true;
        this.timer = window.setTimeout(() => {
          this.mouseMoved = false;
        }, 100);
      }
      setNormalized(nx, ny) {
        this.coords.set(nx, ny);
        this.mouseMoved = true;
      }
      onDocumentMouseMove(event) {
        if (!this.updateHoverState(event.clientX, event.clientY)) return;
        if (this.onInteract) this.onInteract();
        if (this.isAutoActive && !this.hasUserControl && !this.takeoverActive) {
          if (!this.container) return;
          const rect = this.container.getBoundingClientRect();
          if (rect.width === 0 || rect.height === 0) return;
          const nx = (event.clientX - rect.left) / rect.width;
          const ny = (event.clientY - rect.top) / rect.height;
          this.takeoverFrom.copy(this.coords);
          this.takeoverTo.set(nx * 2 - 1, -(ny * 2 - 1));
          this.takeoverStartTime = performance.now();
          this.takeoverActive = true;
          this.hasUserControl = true;
          this.isAutoActive = false;
          return;
        }
        this.setCoords(event.clientX, event.clientY);
        this.hasUserControl = true;
      }
      onDocumentTouchStart(event) {
        if (event.touches.length !== 1) return;
        const t = event.touches[0];
        if (!this.updateHoverState(t.clientX, t.clientY)) return;
        if (this.onInteract) this.onInteract();
        this.setCoords(t.clientX, t.clientY);
        this.hasUserControl = true;
      }
      onDocumentTouchMove(event) {
        if (event.touches.length !== 1) return;
        const t = event.touches[0];
        if (!this.updateHoverState(t.clientX, t.clientY)) return;
        if (this.onInteract) this.onInteract();
        this.setCoords(t.clientX, t.clientY);
      }
      onTouchEnd() {
        this.isHoverInside = false;
      }
      onDocumentLeave() {
        this.isHoverInside = false;
      }
      update() {
        if (this.takeoverActive) {
          const t = (performance.now() - this.takeoverStartTime) / (this.takeoverDuration * 1000);
          if (t >= 1) {
            this.takeoverActive = false;
            this.coords.copy(this.takeoverTo);
            this.coords_old.copy(this.coords);
            this.diff.set(0, 0);
          } else {
            const k = t * t * (3 - 2 * t);
            this.coords.copy(this.takeoverFrom).lerp(this.takeoverTo, k);
          }
        }
        this.diff.subVectors(this.coords, this.coords_old);
        this.coords_old.copy(this.coords);
        if (this.coords_old.x === 0 && this.coords_old.y === 0) this.diff.set(0, 0);
        if (this.isAutoActive && !this.takeoverActive) this.diff.multiplyScalar(this.autoIntensity);
      }
    }
    const Mouse = new MouseClass();

    class AutoDriver {
      constructor(mouse, manager, opts) {
        this.mouse = mouse;
        this.manager = manager;
        this.enabled = opts.enabled;
        this.speed = opts.speed; // normalized units/sec
        this.resumeDelay = opts.resumeDelay || 3000; // ms
        this.rampDurationMs = (opts.rampDuration || 0) * 1000;
        this.active = false;
        this.current = new THREE.Vector2(0, 0);
        this.target = new THREE.Vector2();
        this.lastTime = performance.now();
        this.activationTime = 0;
        this.margin = 0.2;
        this._tmpDir = new THREE.Vector2(); // reuse temp vector to avoid per-frame alloc
        this.pickNewTarget();
      }
      pickNewTarget() {
        const r = Math.random;
        this.target.set((r() * 2 - 1) * (1 - this.margin), (r() * 2 - 1) * (1 - this.margin));
      }
      forceStop() {
        this.active = false;
        this.mouse.isAutoActive = false;
      }
      update() {
        if (!this.enabled) return;
        const now = performance.now();
        const idle = now - this.manager.lastUserInteraction;
        if (idle < this.resumeDelay) {
          if (this.active) this.forceStop();
          return;
        }
        if (this.mouse.isHoverInside) {
          if (this.active) this.forceStop();
          return;
        }
        if (!this.active) {
          this.active = true;
          this.current.copy(this.mouse.coords);
          this.lastTime = now;
          this.activationTime = now;
        }
        if (!this.active) return;
        this.mouse.isAutoActive = true;
        let dtSec = (now - this.lastTime) / 1000;
        this.lastTime = now;
        if (dtSec > 0.2) dtSec = 0.016;
        const dir = this._tmpDir.subVectors(this.target, this.current);
        const dist = dir.length();
        if (dist < 0.01) {
          this.pickNewTarget();
          return;
        }
        dir.normalize();
        let ramp = 1;
        if (this.rampDurationMs > 0) {
          const t = Math.min(1, (now - this.activationTime) / this.rampDurationMs);
          ramp = t * t * (3 - 2 * t);
        }
        const step = this.speed * dtSec * ramp;
        const move = Math.min(step, dist);
        this.current.addScaledVector(dir, move);
        this.mouse.setNormalized(this.current.x, this.current.y);
      }
    }

    const face_vert = `
  attribute vec3 position;
  uniform vec2 px;
  uniform vec2 boundarySpace;
  varying vec2 uv;
  precision highp float;
  void main(){
  vec3 pos = position;
  vec2 scale = 1.0 - boundarySpace * 2.0;
  pos.xy = pos.xy * scale;
  uv = vec2(0.5)+(pos.xy)*0.5;
  gl_Position = vec4(pos, 1.0);
}
`;
    const line_vert = `
  attribute vec3 position;
  uniform vec2 px;
  precision highp float;
  varying vec2 uv;
  void main(){
  vec3 pos = position;
  uv = 0.5 + pos.xy * 0.5;
  vec2 n = sign(pos.xy);
  pos.xy = abs(pos.xy) - px * 1.0;
  pos.xy *= n;
  gl_Position = vec4(pos, 1.0);
}
`;
    const mouse_vert = `
    precision highp float;
    attribute vec3 position;
    attribute vec2 uv;
    uniform vec2 center;
    uniform vec2 scale;
    uniform vec2 px;
    varying vec2 vUv;
    void main(){
    vec2 pos = position.xy * scale * 2.0 * px + center;
    vUv = uv;
    gl_Position = vec4(pos, 0.0, 1.0);
}
`;
    const advection_frag = `
    precision highp float;
    uniform sampler2D velocity;
    uniform float dt;
    uniform bool isBFECC;
    uniform vec2 fboSize;
    uniform vec2 px;
    varying vec2 uv;
    void main(){
    vec2 ratio = max(fboSize.x, fboSize.y) / fboSize;
    if(isBFECC == false){
        vec2 vel = texture2D(velocity, uv).xy;
        vec2 uv2 = uv - vel * dt * ratio;
        vec2 newVel = texture2D(velocity, uv2).xy;
        gl_FragColor = vec4(newVel, 0.0, 0.0);
    } else {
        vec2 spot_new = uv;
        vec2 vel_old = texture2D(velocity, uv).xy;
        vec2 spot_old = spot_new - vel_old * dt * ratio;
        vec2 vel_new1 = texture2D(velocity, spot_old).xy;
        vec2 spot_new2 = spot_old + vel_new1 * dt * ratio;
        vec2 error = spot_new2 - spot_new;
        vec2 spot_new3 = spot_new - error / 2.0;
        vec2 vel_2 = texture2D(velocity, spot_new3).xy;
        vec2 spot_old2 = spot_new3 - vel_2 * dt * ratio;
        vec2 newVel2 = texture2D(velocity, spot_old2).xy; 
        gl_FragColor = vec4(newVel2, 0.0, 0.0);
    }
}
`;
    const color_frag = `
    precision highp float;
    uniform sampler2D velocity;
    uniform sampler2D palette;
    uniform vec4 bgColor;
    uniform bool lightMode;
    varying vec2 uv;
    void main(){
    vec2 vel = texture2D(velocity, uv).xy;
    float lenv = clamp(length(vel), 0.0, 1.0);
    vec3 c = texture2D(palette, vec2(lenv, 0.5)).rgb;
    float peak = max(c.r, max(c.g, c.b));
    vec3 chroma = clamp(c / max(peak, 0.0001), 0.0, 1.0);
    chroma = pow(chroma, vec3(1.25));
    vec3 ink = lightMode ? chroma : c;
    vec3 outRGB = mix(bgColor.rgb, ink, lenv);
    float outA = mix(bgColor.a, 1.0, lenv);
    gl_FragColor = vec4(outRGB, outA);
}
`;
    const divergence_frag = `
    precision highp float;
    uniform sampler2D velocity;
    uniform float dt;
    uniform vec2 px;
    varying vec2 uv;
    void main(){
    float x0 = texture2D(velocity, uv-vec2(px.x, 0.0)).x;
    float x1 = texture2D(velocity, uv+vec2(px.x, 0.0)).x;
    float y0 = texture2D(velocity, uv-vec2(0.0, px.y)).y;
    float y1 = texture2D(velocity, uv+vec2(0.0, px.y)).y;
    float divergence = (x1 - x0 + y1 - y0) / 2.0;
    gl_FragColor = vec4(divergence / dt);
}
`;
    const externalForce_frag = `
    precision highp float;
    uniform vec2 force;
    uniform vec2 center;
    uniform vec2 scale;
    uniform vec2 px;
    varying vec2 vUv;
    void main(){
    vec2 circle = (vUv - 0.5) * 2.0;
    float d = 1.0 - min(length(circle), 1.0);
    d *= d;
    gl_FragColor = vec4(force * d, 0.0, 1.0);
}
`;
    const poisson_frag = `
    precision highp float;
    uniform sampler2D pressure;
    uniform sampler2D divergence;
    uniform vec2 px;
    varying vec2 uv;
    void main(){
    float p0 = texture2D(pressure, uv + vec2(px.x * 2.0, 0.0)).r;
    float p1 = texture2D(pressure, uv - vec2(px.x * 2.0, 0.0)).r;
    float p2 = texture2D(pressure, uv + vec2(0.0, px.y * 2.0)).r;
    float p3 = texture2D(pressure, uv - vec2(0.0, px.y * 2.0)).r;
    float div = texture2D(divergence, uv).r;
    float newP = (p0 + p1 + p2 + p3) / 4.0 - div;
    gl_FragColor = vec4(newP);
}
`;
    const pressure_frag = `
    precision highp float;
    uniform sampler2D pressure;
    uniform sampler2D velocity;
    uniform vec2 px;
    uniform float dt;
    varying vec2 uv;
    void main(){
    float step = 1.0;
    float p0 = texture2D(pressure, uv + vec2(px.x * step, 0.0)).r;
    float p1 = texture2D(pressure, uv - vec2(px.x * step, 0.0)).r;
    float p2 = texture2D(pressure, uv + vec2(0.0, px.y * step)).r;
    float p3 = texture2D(pressure, uv - vec2(0.0, px.y * step)).r;
    vec2 v = texture2D(velocity, uv).xy;
    vec2 gradP = vec2(p0 - p1, p2 - p3) * 0.5;
    v = v - gradP * dt;
    gl_FragColor = vec4(v, 0.0, 1.0);
}
`;
    const viscous_frag = `
    precision highp float;
    uniform sampler2D velocity;
    uniform sampler2D velocity_new;
    uniform float v;
    uniform vec2 px;
    uniform float dt;
    varying vec2 uv;
    void main(){
    vec2 old = texture2D(velocity, uv).xy;
    vec2 new0 = texture2D(velocity_new, uv + vec2(px.x * 2.0, 0.0)).xy;
    vec2 new1 = texture2D(velocity_new, uv - vec2(px.x * 2.0, 0.0)).xy;
    vec2 new2 = texture2D(velocity_new, uv + vec2(0.0, px.y * 2.0)).xy;
    vec2 new3 = texture2D(velocity_new, uv - vec2(0.0, px.y * 2.0)).xy;
    vec2 newv = 4.0 * old + v * dt * (new0 + new1 + new2 + new3);
    newv /= 4.0 * (1.0 + v * dt);
    gl_FragColor = vec4(newv, 0.0, 0.0);
}
`;

    class ShaderPass {
      constructor(props) {
        this.props = props || {};
        this.uniforms = this.props.material?.uniforms;
        this.scene = null;
        this.camera = null;
        this.material = null;
        this.geometry = null;
        this.plane = null;
      }
      init() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.Camera();
        if (this.uniforms) {
          this.material = new THREE.RawShaderMaterial(this.props.material);
          this.geometry = new THREE.PlaneGeometry(2.0, 2.0);
          this.plane = new THREE.Mesh(this.geometry, this.material);
          this.scene.add(this.plane);
        }
      }
      update() {
        Common.renderer.setRenderTarget(this.props.output || null);
        Common.renderer.render(this.scene, this.camera);
        Common.renderer.setRenderTarget(null);
      }
    }

    class Advection extends ShaderPass {
      constructor(simProps) {
        super({
          material: {
            vertexShader: face_vert,
            fragmentShader: advection_frag,
            uniforms: {
              boundarySpace: { value: simProps.cellScale },
              px: { value: simProps.cellScale },
              fboSize: { value: simProps.fboSize },
              velocity: { value: simProps.src.texture },
              dt: { value: simProps.dt },
              isBFECC: { value: true }
            }
          },
          output: simProps.dst
        });
        this.uniforms = this.props.material.uniforms;
        this.init();
      }
      init() {
        super.init();
        this.createBoundary();
      }
      createBoundary() {
        const boundaryG = new THREE.BufferGeometry();
        const vertices_boundary = new Float32Array([
          -1, -1, 0, -1, 1, 0, -1, 1, 0, 1, 1, 0, 1, 1, 0, 1, -1, 0, 1, -1, 0, -1, -1, 0
        ]);
        boundaryG.setAttribute('position', new THREE.BufferAttribute(vertices_boundary, 3));
        const boundaryM = new THREE.RawShaderMaterial({
          vertexShader: line_vert,
          fragmentShader: advection_frag,
          uniforms: this.uniforms
        });
        this.line = new THREE.LineSegments(boundaryG, boundaryM);
        this.scene.add(this.line);
      }
      update({ dt, isBounce, BFECC }) {
        this.uniforms.dt.value = dt;
        this.line.visible = isBounce;
        this.uniforms.isBFECC.value = BFECC;
        super.update();
      }
    }

    class ExternalForce extends ShaderPass {
      constructor(simProps) {
        super({ output: simProps.dst });
        this.init(simProps);
      }
      init(simProps) {
        super.init();
        const mouseG = new THREE.PlaneGeometry(1, 1);
        const mouseM = new THREE.RawShaderMaterial({
          vertexShader: mouse_vert,
          fragmentShader: externalForce_frag,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          uniforms: {
            px: { value: simProps.cellScale },
            force: { value: new THREE.Vector2(0.0, 0.0) },
            center: { value: new THREE.Vector2(0.0, 0.0) },
            scale: { value: new THREE.Vector2(simProps.cursor_size, simProps.cursor_size) }
          }
        });
        this.mouse = new THREE.Mesh(mouseG, mouseM);
        this.scene.add(this.mouse);
      }
      update(props) {
        const forceX = (Mouse.diff.x / 2) * props.mouse_force;
        const forceY = (Mouse.diff.y / 2) * props.mouse_force;
        const cursorSizeX = props.cursor_size * props.cellScale.x;
        const cursorSizeY = props.cursor_size * props.cellScale.y;
        const centerX = Math.min(
          Math.max(Mouse.coords.x, -1 + cursorSizeX + props.cellScale.x * 2),
          1 - cursorSizeX - props.cellScale.x * 2
        );
        const centerY = Math.min(
          Math.max(Mouse.coords.y, -1 + cursorSizeY + props.cellScale.y * 2),
          1 - cursorSizeY - props.cellScale.y * 2
        );
        const uniforms = this.mouse.material.uniforms;
        uniforms.force.value.set(forceX, forceY);
        uniforms.center.value.set(centerX, centerY);
        uniforms.scale.value.set(props.cursor_size, props.cursor_size);
        super.update();
      }
    }

    class Viscous extends ShaderPass {
      constructor(simProps) {
        super({
          material: {
            vertexShader: face_vert,
            fragmentShader: viscous_frag,
            uniforms: {
              boundarySpace: { value: simProps.boundarySpace },
              velocity: { value: simProps.src.texture },
              velocity_new: { value: simProps.dst_.texture },
              v: { value: simProps.viscous },
              px: { value: simProps.cellScale },
              dt: { value: simProps.dt }
            }
          },
          output: simProps.dst,
          output0: simProps.dst_,
          output1: simProps.dst
        });
        this.init();
      }
      update({ viscous, iterations, dt }) {
        let fbo_in, fbo_out;
        this.uniforms.v.value = viscous;
        for (let i = 0; i < iterations; i++) {
          if (i % 2 === 0) {
            fbo_in = this.props.output0;
            fbo_out = this.props.output1;
          } else {
            fbo_in = this.props.output1;
            fbo_out = this.props.output0;
          }
          this.uniforms.velocity_new.value = fbo_in.texture;
          this.props.output = fbo_out;
          this.uniforms.dt.value = dt;
          super.update();
        }
        return fbo_out;
      }
    }

    class Divergence extends ShaderPass {
      constructor(simProps) {
        super({
          material: {
            vertexShader: face_vert,
            fragmentShader: divergence_frag,
            uniforms: {
              boundarySpace: { value: simProps.boundarySpace },
              velocity: { value: simProps.src.texture },
              px: { value: simProps.cellScale },
              dt: { value: simProps.dt }
            }
          },
          output: simProps.dst
        });
        this.init();
      }
      update({ vel }) {
        this.uniforms.velocity.value = vel.texture;
        super.update();
      }
    }

    class Poisson extends ShaderPass {
      constructor(simProps) {
        super({
          material: {
            vertexShader: face_vert,
            fragmentShader: poisson_frag,
            uniforms: {
              boundarySpace: { value: simProps.boundarySpace },
              pressure: { value: simProps.dst_.texture },
              divergence: { value: simProps.src.texture },
              px: { value: simProps.cellScale }
            }
          },
          output: simProps.dst,
          output0: simProps.dst_,
          output1: simProps.dst
        });
        this.init();
      }
      update({ iterations }) {
        let p_in, p_out;
        for (let i = 0; i < iterations; i++) {
          if (i % 2 === 0) {
            p_in = this.props.output0;
            p_out = this.props.output1;
          } else {
            p_in = this.props.output1;
            p_out = this.props.output0;
          }
          this.uniforms.pressure.value = p_in.texture;
          this.props.output = p_out;
          super.update();
        }
        return p_out;
      }
    }

    class Pressure extends ShaderPass {
      constructor(simProps) {
        super({
          material: {
            vertexShader: face_vert,
            fragmentShader: pressure_frag,
            uniforms: {
              boundarySpace: { value: simProps.boundarySpace },
              pressure: { value: simProps.src_p.texture },
              velocity: { value: simProps.src_v.texture },
              px: { value: simProps.cellScale },
              dt: { value: simProps.dt }
            }
          },
          output: simProps.dst
        });
        this.init();
      }
      update({ vel, pressure }) {
        this.uniforms.velocity.value = vel.texture;
        this.uniforms.pressure.value = pressure.texture;
        super.update();
      }
    }

    class Simulation {
      constructor(options) {
        this.options = {
          iterations_poisson: 32,
          iterations_viscous: 32,
          mouse_force: 20,
          resolution: 0.5,
          cursor_size: 100,
          viscous: 30,
          isBounce: false,
          dt: 0.014,
          isViscous: false,
          BFECC: true,
          ...options
        };
        this.fbos = {
          vel_0: null,
          vel_1: null,
          vel_viscous0: null,
          vel_viscous1: null,
          div: null,
          pressure_0: null,
          pressure_1: null
        };
        this.fboSize = new THREE.Vector2();
        this.cellScale = new THREE.Vector2();
        this.boundarySpace = new THREE.Vector2();
        this.init();
      }
      init() {
        this.calcSize();
        this.createAllFBO();
        this.createShaderPass();
      }
      getFloatType() {
        const isIOS = /(iPad|iPhone|iPod)/i.test(navigator.userAgent);
        return isIOS ? THREE.HalfFloatType : THREE.FloatType;
      }
      createAllFBO() {
        const type = this.getFloatType();
        const opts = {
          type,
          depthBuffer: false,
          stencilBuffer: false,
          minFilter: THREE.LinearFilter,
          magFilter: THREE.LinearFilter,
          wrapS: THREE.ClampToEdgeWrapping,
          wrapT: THREE.ClampToEdgeWrapping
        };
        for (let key in this.fbos) {
          this.fbos[key] = new THREE.WebGLRenderTarget(this.fboSize.x, this.fboSize.y, opts);
        }
      }
      createShaderPass() {
        this.advection = new Advection({
          cellScale: this.cellScale,
          fboSize: this.fboSize,
          dt: this.options.dt,
          src: this.fbos.vel_0,
          dst: this.fbos.vel_1
        });
        this.externalForce = new ExternalForce({
          cellScale: this.cellScale,
          cursor_size: this.options.cursor_size,
          dst: this.fbos.vel_1
        });
        this.viscous = new Viscous({
          cellScale: this.cellScale,
          boundarySpace: this.boundarySpace,
          viscous: this.options.viscous,
          src: this.fbos.vel_1,
          dst: this.fbos.vel_viscous1,
          dst_: this.fbos.vel_viscous0,
          dt: this.options.dt
        });
        this.divergence = new Divergence({
          cellScale: this.cellScale,
          boundarySpace: this.boundarySpace,
          src: this.fbos.vel_viscous0,
          dst: this.fbos.div,
          dt: this.options.dt
        });
        this.poisson = new Poisson({
          cellScale: this.cellScale,
          boundarySpace: this.boundarySpace,
          src: this.fbos.div,
          dst: this.fbos.pressure_1,
          dst_: this.fbos.pressure_0
        });
        this.pressure = new Pressure({
          cellScale: this.cellScale,
          boundarySpace: this.boundarySpace,
          src_p: this.fbos.pressure_0,
          src_v: this.fbos.vel_viscous0,
          dst: this.fbos.vel_0,
          dt: this.options.dt
        });
      }
      calcSize() {
        const width = Math.max(1, Math.round(this.options.resolution * Common.width));
        const height = Math.max(1, Math.round(this.options.resolution * Common.height));
        const px_x = 1.0 / width;
        const px_y = 1.0 / height;
        this.cellScale.set(px_x, px_y);
        this.fboSize.set(width, height);
      }
      resize() {
        this.calcSize();
        for (let key in this.fbos) {
          this.fbos[key].setSize(this.fboSize.x, this.fboSize.y);
        }
      }
      update() {
        if (this.options.isBounce) {
          this.boundarySpace.set(0, 0);
        } else {
          this.boundarySpace.copy(this.cellScale);
        }
        this.advection.update({
          dt: this.options.dt,
          isBounce: this.options.isBounce,
          BFECC: this.options.BFECC
        });
        this.externalForce.update({
          cursor_size: this.options.cursor_size,
          mouse_force: this.options.mouse_force,
          cellScale: this.cellScale
        });
        let vel = this.fbos.vel_1;
        if (this.options.isViscous) {
          vel = this.viscous.update({
            viscous: this.options.viscous,
            iterations: this.options.iterations_viscous,
            dt: this.options.dt
          });
        }
        this.divergence.update({ vel });
        const pressure = this.poisson.update({
          iterations: this.options.iterations_poisson
        });
        this.pressure.update({ vel, pressure });
      }
    }

    class Output {
      constructor() {
        this.init();
      }
      init() {
        this.simulation = new Simulation();
        this.scene = new THREE.Scene();
        this.camera = new THREE.Camera();
        this.output = new THREE.Mesh(
          new THREE.PlaneGeometry(2, 2),
          new THREE.RawShaderMaterial({
            vertexShader: face_vert,
            fragmentShader: color_frag,
            transparent: true,
            depthWrite: false,
            uniforms: {
              velocity: { value: this.simulation.fbos.vel_0.texture },
              boundarySpace: { value: new THREE.Vector2() },
              palette: { value: paletteTex },
              bgColor: { value: bgVec4 },
              lightMode: { value: lightMode }
            }
          })
        );
        this.scene.add(this.output);
      }
      addScene(mesh) {
        this.scene.add(mesh);
      }
      resize() {
        this.simulation.resize();
      }
      render() {
        Common.renderer.setRenderTarget(null);
        Common.renderer.render(this.scene, this.camera);
      }
      update() {
        this.simulation.update();
        this.render();
      }
    }

    class WebGLManager {
      constructor(props) {
        this.props = props;
        Common.init(props.$wrapper);
        Mouse.init(props.$wrapper);
        Mouse.autoIntensity = props.autoIntensity;
        Mouse.takeoverDuration = props.takeoverDuration;
        this.lastUserInteraction = performance.now();
        Mouse.onInteract = () => {
          this.lastUserInteraction = performance.now();
          if (this.autoDriver) this.autoDriver.forceStop();
        };
        this.autoDriver = new AutoDriver(Mouse, this, {
          enabled: props.autoDemo,
          speed: props.autoSpeed,
          resumeDelay: props.autoResumeDelay,
          rampDuration: props.autoRampDuration
        });
        this.init();
        this._loop = this.loop.bind(this);
        this._resize = this.resize.bind(this);
        window.addEventListener('resize', this._resize);
        this._onVisibility = () => {
          const hidden = document.hidden;
          if (hidden) {
            this.pause();
          } else if (this.isVisible) {
            this.start();
          }
        };
        document.addEventListener('visibilitychange', this._onVisibility);
        this.running = false;
      }
      init() {
        this.props.$wrapper.prepend(Common.renderer.domElement);
        this.output = new Output();
      }
      resize() {
        Common.resize();
        this.output.resize();
      }
      render() {
        if (this.autoDriver) this.autoDriver.update();
        Mouse.update();
        Common.update();
        this.output.update();
      }
      loop() {
        if (!this.running) return; // safety
        this.render();
        this.raf = requestAnimationFrame(this._loop);
      }
      start() {
        if (this.running) return;
        this.running = true;
        this._loop();
      }
      pause() {
        this.running = false;
        if (this.raf) {
          cancelAnimationFrame(this.raf);
          this.raf = null;
        }
      }
      dispose() {
        try {
          window.removeEventListener('resize', this._resize);
          document.removeEventListener('visibilitychange', this._onVisibility);
          Mouse.dispose();
          if (Common.renderer) {
            const canvas = Common.renderer.domElement;
            if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);
            Common.renderer.dispose();
            Common.renderer.forceContextLoss();
          }
        } catch (e) {
          void 0;
        }
      }
    }

    

  container.style.position = container.style.position || 'relative';
  container.style.overflow = container.style.overflow || 'hidden';

  const webgl = new WebGLManager({
    $wrapper: container,
    autoDemo,
    autoSpeed,
    autoIntensity,
    takeoverDuration,
    autoResumeDelay,
    autoRampDuration
  });
  webgl.isVisible = true;

  if (webgl && webgl.output && webgl.output.simulation) {
    const sim = webgl.output.simulation;
    Object.assign(sim.options, {
      mouse_force: mouseForce,
      cursor_size: cursorSize,
      isViscous,
      viscous,
      iterations_viscous: iterationsViscous,
      iterations_poisson: iterationsPoisson,
      dt,
      BFECC,
      resolution,
      isBounce
    });
  }

  webgl.start();

  const ro = new ResizeObserver(() => {
    if (webgl) webgl.resize();
  });
  ro.observe(container);

  return () => {
    try {
      ro.disconnect();
      webgl.pause();
      webgl.dispose();
    } catch (err) {
      console.warn('Erro no cleanup de LiquidEther:', err);
    }
  };
}

// ==========================================
// ORB INITIALIZER(React Bits / OGL)
// ==========================================
function initOrb(container, opts = {}) {
  const {
    hue = 0,
    hoverIntensity = 0.3,
    rotateOnHover = true,
    forceHoverState = false,
    backgroundColor = '#000000'
  } = opts;

  function hslToRgb(h, s, l) {
    let r, g, b;
    if (s === 0) {
      r = g = b = l;
    } else {
      const hue2rgb = (p, q, t) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
      };
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1 / 3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1 / 3);
    }
    return new Vec3(r, g, b);
  }

  function hexToVec3(color) {
    if (color.startsWith('#')) {
      const r = parseInt(color.slice(1, 3), 16) / 255;
      const g = parseInt(color.slice(3, 5), 16) / 255;
      const b = parseInt(color.slice(5, 7), 16) / 255;
      return new Vec3(r, g, b);
    }
    const rgbMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (rgbMatch) {
      return new Vec3(parseInt(rgbMatch[1]) / 255, parseInt(rgbMatch[2]) / 255, parseInt(rgbMatch[3]) / 255);
    }
    const hslMatch = color.match(/hsla?\((\d+),\s*(\d+)%,\s*(\d+)%/);
    if (hslMatch) {
      const h = parseInt(hslMatch[1]) / 360;
      const s = parseInt(hslMatch[2]) / 100;
      const l = parseInt(hslMatch[3]) / 100;
      return hslToRgb(h, s, l);
    }
    return new Vec3(0, 0, 0);
  }

  const vert = `
    precision highp float;
    attribute vec2 position;
    attribute vec2 uv;
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = vec4(position, 0.0, 1.0);
    }
  `;

  const frag = `
    precision highp float;

    uniform float iTime;
    uniform vec3 iResolution;
    uniform float hue;
    uniform float hover;
    uniform float rot;
    uniform float hoverIntensity;
    uniform vec3 backgroundColor;
    varying vec2 vUv;

    vec3 rgb2yiq(vec3 c) {
      float y = dot(c, vec3(0.299, 0.587, 0.114));
      float i = dot(c, vec3(0.596, -0.274, -0.322));
      float q = dot(c, vec3(0.211, -0.523, 0.312));
      return vec3(y, i, q);
    }
    
    vec3 yiq2rgb(vec3 c) {
      float r = c.x + 0.956 * c.y + 0.621 * c.z;
      float g = c.x - 0.272 * c.y - 0.647 * c.z;
      float b = c.x - 1.106 * c.y + 1.703 * c.z;
      return vec3(r, g, b);
    }
    
    vec3 adjustHue(vec3 color, float hueDeg) {
      float hueRad = hueDeg * 3.14159265 / 180.0;
      vec3 yiq = rgb2yiq(color);
      float cosA = cos(hueRad);
      float sinA = sin(hueRad);
      float i = yiq.y * cosA - yiq.z * sinA;
      float q = yiq.y * sinA + yiq.z * cosA;
      yiq.y = i;
      yiq.z = q;
      return yiq2rgb(yiq);
    }

    vec3 hash33(vec3 p3) {
      p3 = fract(p3 * vec3(0.1031, 0.11369, 0.13787));
      p3 += dot(p3, p3.yxz + 19.19);
      return -1.0 + 2.0 * fract(vec3(
        p3.x + p3.y,
        p3.x + p3.z,
        p3.y + p3.z
      ) * p3.zyx);
    }

    float snoise3(vec3 p) {
      const float K1 = 0.333333333;
      const float K2 = 0.166666667;
      vec3 i = floor(p + (p.x + p.y + p.z) * K1);
      vec3 d0 = p - (i - (i.x + i.y + i.z) * K2);
      vec3 e = step(vec3(0.0), d0 - d0.yzx);
      vec3 i1 = e * (1.0 - e.zxy);
      vec3 i2 = 1.0 - e.zxy * (1.0 - e);
      vec3 d1 = d0 - (i1 - K2);
      vec3 d2 = d0 - (i2 - K1);
      vec3 d3 = d0 - 0.5;
      vec4 h = max(0.6 - vec4(
        dot(d0, d0),
        dot(d1, d1),
        dot(d2, d2),
        dot(d3, d3)
      ), 0.0);
      vec4 n = h * h * h * h * vec4(
        dot(d0, hash33(i)),
        dot(d1, hash33(i + i1)),
        dot(d2, hash33(i + i2)),
        dot(d3, hash33(i + 1.0))
      );
      return dot(vec4(31.316), n);
    }

    vec4 extractAlpha(vec3 colorIn) {
      float a = max(max(colorIn.r, colorIn.g), colorIn.b);
      return vec4(colorIn.rgb / (a + 1e-5), a);
    }

    const vec3 baseColor1 = vec3(0.611765, 0.262745, 0.996078);
    const vec3 baseColor2 = vec3(0.298039, 0.760784, 0.913725);
    const vec3 baseColor3 = vec3(0.062745, 0.078431, 0.600000);
    const float innerRadius = 0.6;
    const float noiseScale = 0.65;

    float light1(float intensity, float attenuation, float dist) {
      return intensity / (1.0 + dist * attenuation);
    }
    float light2(float intensity, float attenuation, float dist) {
      return intensity / (1.0 + dist * dist * attenuation);
    }

    vec4 draw(vec2 uv) {
      vec3 color1 = adjustHue(baseColor1, hue);
      vec3 color2 = adjustHue(baseColor2, hue);
      vec3 color3 = adjustHue(baseColor3, hue);
      
      float ang = atan(uv.y, uv.x);
      float len = length(uv);
      float invLen = len > 0.0 ? 1.0 / len : 0.0;

      float bgLuminance = dot(backgroundColor, vec3(0.299, 0.587, 0.114));
      
      float n0 = snoise3(vec3(uv * noiseScale, iTime * 0.5)) * 0.5 + 0.5;
      float r0 = mix(mix(innerRadius, 1.0, 0.4), mix(innerRadius, 1.0, 0.6), n0);
      float d0 = distance(uv, (r0 * invLen) * uv);
      float v0 = light1(1.0, 10.0, d0);

      v0 *= smoothstep(r0 * 1.05, r0, len);
      float innerFade = smoothstep(r0 * 0.8, r0 * 0.95, len);
      v0 *= mix(innerFade, 1.0, bgLuminance * 0.7);
      float cl = cos(ang + iTime * 2.0) * 0.5 + 0.5;
      
      float a = iTime * -1.0;
      vec2 pos = vec2(cos(a), sin(a)) * r0;
      float d = distance(uv, pos);
      float v1 = light2(1.5, 5.0, d);
      v1 *= light1(1.0, 50.0, d0);
      
      float v2 = smoothstep(1.0, mix(innerRadius, 1.0, n0 * 0.5), len);
      float v3 = smoothstep(innerRadius, mix(innerRadius, 1.0, 0.5), len);
      
      vec3 colBase = mix(color1, color2, cl);
      float fadeAmount = mix(1.0, 0.1, bgLuminance);
      
      vec3 darkCol = mix(color3, colBase, v0);
      darkCol = (darkCol + v1) * v2 * v3;
      darkCol = clamp(darkCol, 0.0, 1.0);
      
      vec3 lightCol = (colBase + v1) * mix(1.0, v2 * v3, fadeAmount);
      lightCol = mix(backgroundColor, lightCol, v0);
      lightCol = clamp(lightCol, 0.0, 1.0);
      
      vec3 finalCol = mix(darkCol, lightCol, bgLuminance);
      
      return extractAlpha(finalCol);
    }

    vec4 mainImage(vec2 fragCoord) {
      vec2 center = iResolution.xy * 0.5;
      float size = min(iResolution.x, iResolution.y);
      vec2 uv = (fragCoord - center) / size * 2.0;
      
      float angle = rot;
      float s = sin(angle);
      float c = cos(angle);
      uv = vec2(c * uv.x - s * uv.y, s * uv.x + c * uv.y);
      
      uv.x += hover * hoverIntensity * 0.1 * sin(uv.y * 10.0 + iTime);
      uv.y += hover * hoverIntensity * 0.1 * sin(uv.x * 10.0 + iTime);
      
      return draw(uv);
    }

    void main() {
      vec2 fragCoord = vUv * iResolution.xy;
      vec4 col = mainImage(fragCoord);
      gl_FragColor = vec4(col.rgb * col.a, col.a);
    }
  `;

  const renderer = new Renderer({ dpr: getOptimizedDPR(), alpha: true, premultipliedAlpha: false });
  const gl = renderer.gl;
  gl.clearColor(0, 0, 0, 0);
  const canvas = gl.canvas;
  canvas.style.position = 'absolute';
  canvas.style.inset = '0';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.display = 'block';
  container.appendChild(canvas);

  const geometry = new Triangle(gl);
  const program = new Program(gl, {
    vertex: vert,
    fragment: frag,
    uniforms: {
      iTime: { value: 0 },
      iResolution: {
        value: new Vec3(canvas.width, canvas.height, canvas.width / (canvas.height || 1))
      },
      hue: { value: hue },
      hover: { value: 0 },
      rot: { value: 0 },
      hoverIntensity: { value: hoverIntensity },
      backgroundColor: { value: hexToVec3(backgroundColor) }
    }
  });

  const mesh = new Mesh(gl, { geometry, program });

  const resize = () => {
    if (!container) return;
    const width = container.clientWidth || window.innerWidth || 1;
    const height = container.clientHeight || window.innerHeight || 1;
    renderer.setSize(width, height);
    program.uniforms.iResolution.value.set(gl.canvas.width, gl.canvas.height, gl.canvas.width / (gl.canvas.height || 1));
  };
  const ro = new ResizeObserver(resize);
  ro.observe(container);
  resize();

  let targetHover = 0;
  let lastTime = performance.now();
  let currentRot = 0;
  const rotationSpeed = 0.3;

  const handlePointerMove = (clientX, clientY) => {
    const rect = container.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const width = rect.width;
    const height = rect.height;
    const size = Math.min(width, height);
    const centerX = width / 2;
    const centerY = height / 2;
    const uvX = ((x - centerX) / size) * 2.0;
    const uvY = ((y - centerY) / size) * 2.0;

    if (Math.sqrt(uvX * uvX + uvY * uvY) < 0.8) {
      targetHover = 1;
    } else {
      targetHover = 0;
    }
  };

  const onMouseMove = (e) => handlePointerMove(e.clientX, e.clientY);
  const onTouchMove = (e) => {
    if (e.touches.length > 0) {
      handlePointerMove(e.touches[0].clientX, e.touches[0].clientY);
    }
  };
  const onPointerLeave = () => { targetHover = 0; };

  container.addEventListener('mousemove', onMouseMove, { passive: true });
  container.addEventListener('mouseleave', onPointerLeave, { passive: true });
  container.addEventListener('touchmove', onTouchMove, { passive: true });
  container.addEventListener('touchend', onPointerLeave, { passive: true });

  let rafId;
  const update = (t) => {
    if (!isTabVisible) {
      rafId = requestAnimationFrame(update);
      return;
    }
    rafId = requestAnimationFrame(update);
    const dt = (t - lastTime) * 0.001;
    lastTime = t;
    program.uniforms.iTime.value = t * 0.001;
    program.uniforms.hue.value = hue;
    program.uniforms.hoverIntensity.value = hoverIntensity;
    program.uniforms.backgroundColor.value = hexToVec3(backgroundColor);

    const effectiveHover = forceHoverState ? 1 : targetHover;
    program.uniforms.hover.value += (effectiveHover - program.uniforms.hover.value) * 0.1;

    if (rotateOnHover && effectiveHover > 0.5) {
      currentRot += dt * rotationSpeed;
    }
    program.uniforms.rot.value = currentRot;

    renderer.render({ scene: mesh });
  };
  rafId = requestAnimationFrame(update);

  return () => {
    cancelAnimationFrame(rafId);
    ro.disconnect();
    container.removeEventListener('mousemove', onMouseMove);
    container.removeEventListener('mouseleave', onPointerLeave);
    container.removeEventListener('touchmove', onTouchMove);
    container.removeEventListener('touchend', onPointerLeave);
    try { container.removeChild(canvas); } catch {}
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  };
}

// ==========================================
// 18. PRISM INITIALIZER (React Bits / OGL)
// ==========================================
function initPrism(container, opts = {}) {
  const {
    height = 3.5,
    baseWidth = 5.5,
    animationType = 'rotate',
    glow = 1.2,
    noise = 0.4,
    scale = 3.6,
    timeScale = 0.5,
    bloom = 1.1
  } = opts;

  const H = Math.max(0.001, height);
  const BW = Math.max(0.001, baseWidth);
  const BASE_HALF = BW * 0.5;

  const vertex = `#version 300 es
  in vec2 position;
  void main() { gl_Position = vec4(position, 0.0, 1.0); }
  `;

  const fragment = `#version 300 es
  precision highp float;
  uniform vec2  iResolution;
  uniform float iTime;
  uniform float uHeight;
  uniform float uBaseHalf;
  uniform mat3  uRot;
  uniform int   uUseBaseWobble;
  uniform float uGlow;
  uniform float uNoise;
  uniform float uScale;
  uniform float uColorFreq;
  uniform float uBloom;
  uniform float uCenterShift;
  uniform float uInvBaseHalf;
  uniform float uInvHeight;
  uniform float uMinAxis;
  uniform float uPxScale;
  uniform float uTimeScale;
  out vec4 fragColor;

  vec4 tanh4(vec4 x){
    vec4 e2x = exp(2.0*x);
    return (e2x - 1.0) / (e2x + 1.0);
  }

  float rand(vec2 co){
    return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453123);
  }

  float sdOctaAnisoInv(vec3 p){
    vec3 q = vec3(abs(p.x) * uInvBaseHalf, abs(p.y) * uInvHeight, abs(p.z) * uInvBaseHalf);
    float m = q.x + q.y + q.z - 1.0;
    return m * uMinAxis * 0.5773502691896258;
  }

  float sdPyramidUpInv(vec3 p){
    float oct = sdOctaAnisoInv(p);
    float halfSpace = -p.y;
    return max(oct, halfSpace);
  }

  void main(){
    vec2 f = (gl_FragCoord.xy - 0.5 * iResolution.xy) * uPxScale;
    float z = 5.0;
    float d = 0.0;
    vec3 p;
    vec4 o = vec4(0.0);
    float centerShift = uCenterShift;
    float cf = uColorFreq;

    mat2 wob = mat2(1.0);
    if (uUseBaseWobble == 1) {
      float t = iTime * uTimeScale;
      float c0 = cos(t + 0.0);
      float c1 = cos(t + 33.0);
      float c2 = cos(t + 11.0);
      wob = mat2(c0, c1, c2, c0);
    }

    const int STEPS = 80;
    for (int i = 0; i < STEPS; i++) {
      p = vec3(f, z);
      p.xz = p.xz * wob;
      p = uRot * p;
      vec3 q = p;
      q.y += centerShift;
      d = 0.1 + 0.2 * abs(sdPyramidUpInv(q));
      z -= d;
      o += (sin((p.y + z) * cf + vec4(0.0, 1.0, 2.0, 3.0)) + 1.0) / d;
    }

    o = tanh4(o * o * (uGlow * uBloom) / 1e5);
    vec3 col = o.rgb;
    float n = rand(gl_FragCoord.xy + vec2(iTime));
    col += (n - 0.5) * uNoise;
    col = clamp(col, 0.0, 1.0);
    float L = dot(col, vec3(0.2126, 0.7152, 0.0722));
    col = clamp(mix(vec3(L), col, 1.5), 0.0, 1.0);
    fragColor = vec4(col, clamp(o.a, 0.0, 1.0));
  }
  `;

  const renderer = new Renderer({ alpha: true, antialias: false, dpr: getOptimizedDPR() });
  const gl = renderer.gl;
  const canvas = gl.canvas;
  canvas.style.position = 'absolute';
  canvas.style.inset = '0';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.display = 'block';
  container.appendChild(canvas);

  const geometry = new Triangle(gl);
  const program = new Program(gl, {
    vertex,
    fragment,
    uniforms: {
      iResolution: { value: new Float32Array([1, 1]) },
      iTime: { value: 0 },
      uHeight: { value: H },
      uBaseHalf: { value: BASE_HALF },
      uUseBaseWobble: { value: 1 },
      uRot: { value: new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]) },
      uGlow: { value: glow },
      uNoise: { value: noise },
      uScale: { value: scale },
      uColorFreq: { value: 1.0 },
      uBloom: { value: bloom },
      uCenterShift: { value: H * 0.25 },
      uInvBaseHalf: { value: 1 / BASE_HALF },
      uInvHeight: { value: 1 / H },
      uMinAxis: { value: Math.min(BASE_HALF, H) },
      uPxScale: { value: 1 / (canvas.height * 0.1 * scale || 1) },
      uTimeScale: { value: timeScale }
    }
  });

  const mesh = new Mesh(gl, { geometry, program });

  const resize = () => {
    const w = container.clientWidth || window.innerWidth || 1;
    const h = container.clientHeight || window.innerHeight || 1;
    renderer.setSize(w, h);
    program.uniforms.iResolution.value[0] = gl.drawingBufferWidth;
    program.uniforms.iResolution.value[1] = gl.drawingBufferHeight;
    program.uniforms.uPxScale.value = 1 / (gl.drawingBufferHeight * 0.1 * scale || 1);
  };
  const ro = new ResizeObserver(resize);
  ro.observe(container);
  resize();

  let raf = 0;
  const startTime = performance.now();
  const loop = now => {
    if (!isTabVisible) {
      if (typeof raf !== 'undefined') raf = requestAnimationFrame(typeof loop !== 'undefined' ? loop : update);
      else if (typeof rafId !== 'undefined') rafId = requestAnimationFrame(typeof loop !== 'undefined' ? loop : update);
      else if (typeof animateId !== 'undefined') animateId = requestAnimationFrame(typeof loop !== 'undefined' ? loop : update);
      else if (typeof animationId !== 'undefined') animationId = requestAnimationFrame(typeof loop !== 'undefined' ? loop : update);
      return;
    }
    if (isUserScrollingFast && Math.random() < 0.5) {
      if (typeof raf !== 'undefined') raf = requestAnimationFrame(typeof loop !== 'undefined' ? loop : update);
      else if (typeof rafId !== 'undefined') rafId = requestAnimationFrame(typeof loop !== 'undefined' ? loop : update);
      else if (typeof animateId !== 'undefined') animateId = requestAnimationFrame(typeof loop !== 'undefined' ? loop : update);
      else if (typeof animationId !== 'undefined') animationId = requestAnimationFrame(typeof loop !== 'undefined' ? loop : update);
      return;
    }

    raf = requestAnimationFrame(loop);
    program.uniforms.iTime.value = (now - startTime) * 0.001;
    renderer.render({ scene: mesh });
  };
  raf = requestAnimationFrame(loop);

  return () => {
    cancelAnimationFrame(raf);
    ro.disconnect();
    try { container.removeChild(canvas); } catch {}
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  };
}

// ==========================================
// 19. PRISMATIC BURST INITIALIZER (React Bits / OGL)
// ==========================================
function initPrismaticBurst(container, opts = {}) {
  const {
    intensity = 2.2,
    speed = 0.5,
    animationType = 'rotate3d',
    distort = 1.0,
    rayCount = 24,
    colors = ['#ff007a', '#4d3dff', '#00f0ff', '#ffffff']
  } = opts;

  const vertex = `#version 300 es
  in vec2 position;
  in vec2 uv;
  out vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 0.0, 1.0);
  }
  `;

  const fragment = `#version 300 es
  precision highp float;
  precision highp int;
  out vec4 fragColor;
  uniform vec2  uResolution;
  uniform float uTime;
  uniform float uIntensity;
  uniform float uSpeed;
  uniform int   uAnimType;
  uniform vec2  uMouse;
  uniform int   uColorCount;
  uniform float uDistort;
  uniform sampler2D uGradient;
  uniform int   uRayCount;

  float hash21(vec2 p){
    p = floor(p);
    return fract(52.9829189 * fract(dot(p, vec2(0.065, 0.005))));
  }

  mat2 rot30(){ return mat2(0.8, -0.5, 0.5, 0.8); }

  float layeredNoise(vec2 fragPx){
    vec2 p = mod(fragPx + vec2(uTime * 30.0, -uTime * 21.0), 1024.0);
    vec2 q = rot30() * p;
    return 0.4 * hash21(q) + 0.25 * hash21(q * 2.0 + 17.0) + 0.2 * hash21(q * 4.0 + 47.0);
  }

  mat3 rotX(float a){ float c = cos(a), s = sin(a); return mat3(1.0,0.0,0.0, 0.0,c,-s, 0.0,s,c); }
  mat3 rotY(float a){ float c = cos(a), s = sin(a); return mat3(c,0.0,s, 0.0,1.0,0.0, -s,0.0,c); }
  mat3 rotZ(float a){ float c = cos(a), s = sin(a); return mat3(c,-s,0.0, s,c,0.0, 0.0,0.0,1.0); }

  vec2 rot2(vec2 v, float a){
    float s = sin(a), c = cos(a);
    return mat2(c, -s, s, c) * v;
  }

  float bendAngle(vec3 q, float t){
    return 0.8 * sin(q.x * 0.55 + t * 0.6) + 0.7 * sin(q.y * 0.50 - t * 0.5) + 0.6 * sin(q.z * 0.60 + t * 0.7);
  }

  void main(){
    vec2 frag = gl_FragCoord.xy;
    float t = uTime * uSpeed;
    vec3 dir = normalize(vec3(2.0 * frag - uResolution, uResolution.y));
    float marchT = 0.0;
    vec3 col = vec3(0.0);
    float n = layeredNoise(frag);
    vec4 c = cos(t * 0.2 + vec4(0.0, 33.0, 11.0, 0.0));
    mat2 M2 = mat2(c.x, c.y, c.z, c.w);
    float amp = clamp(uDistort, 0.0, 50.0) * 0.15;

    vec3 ang = vec3(t * 0.31, t * 0.21, t * 0.17);
    mat3 rot3dMat = rotZ(ang.z) * rotY(ang.y) * rotX(ang.x);

    for (int i = 0; i < 40; ++i) {
      vec3 P = marchT * dir;
      P.z -= 2.0;
      float rad = length(P);
      vec3 Pl = P * (10.0 / max(rad, 1e-6));
      Pl = rot3dMat * Pl;

      float stepLen = min(rad - 0.3, n * 0.08) + 0.1;
      float grow = smoothstep(0.35, 3.0, marchT);
      float a1 = amp * grow * bendAngle(Pl * 0.6, t);
      vec3 Pb = Pl;
      Pb.xz = rot2(Pb.xz, a1);

      float rayPattern = smoothstep(0.5, 0.7, sin(Pb.x + cos(Pb.y) * cos(Pb.z)) * sin(Pb.z + sin(Pb.y) * cos(Pb.x + t)));
      if (uRayCount > 0) {
        float angA = atan(Pb.y, Pb.x);
        float comb = pow(0.5 + 0.5 * cos(float(uRayCount) * angA), 3.0);
        rayPattern *= smoothstep(0.15, 0.95, comb);
      }

      vec3 spectral = 1.0 + vec3(cos(marchT * 3.0), cos(marchT * 3.0 + 1.0), cos(marchT * 3.0 + 2.0));
      vec3 base = (0.05 / (0.4 + stepLen)) * smoothstep(5.0, 0.0, rad) * spectral;
      col += base * rayPattern;
      marchT += stepLen;
    }

    col *= uIntensity;
    fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
  }
  `;

  const renderer = new Renderer({ alpha: false, antialias: false, dpr: getOptimizedDPR() });
  const gl = renderer.gl;
  const canvas = gl.canvas;
  canvas.style.position = 'absolute';
  canvas.style.inset = '0';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.display = 'block';
  container.appendChild(canvas);

  const geometry = new Triangle(gl);
  const program = new Program(gl, {
    vertex,
    fragment,
    uniforms: {
      uResolution: { value: new Float32Array([1, 1]) },
      uTime: { value: 0 },
      uIntensity: { value: intensity },
      uSpeed: { value: speed },
      uAnimType: { value: 1 },
      uMouse: { value: new Float32Array([0.5, 0.5]) },
      uColorCount: { value: colors.length },
      uDistort: { value: distort },
      uRayCount: { value: rayCount }
    }
  });

  const mesh = new Mesh(gl, { geometry, program });

  const resize = () => {
    const w = container.clientWidth || window.innerWidth || 1;
    const h = container.clientHeight || window.innerHeight || 1;
    renderer.setSize(w, h);
    program.uniforms.uResolution.value = [gl.drawingBufferWidth, gl.drawingBufferHeight];
  };
  const ro = new ResizeObserver(resize);
  ro.observe(container);
  resize();

  let raf = 0;
  const startTime = performance.now();
  const loop = now => {
    if (!isTabVisible) {
      if (typeof raf !== 'undefined') raf = requestAnimationFrame(typeof loop !== 'undefined' ? loop : update);
      else if (typeof rafId !== 'undefined') rafId = requestAnimationFrame(typeof loop !== 'undefined' ? loop : update);
      else if (typeof animateId !== 'undefined') animateId = requestAnimationFrame(typeof loop !== 'undefined' ? loop : update);
      else if (typeof animationId !== 'undefined') animationId = requestAnimationFrame(typeof loop !== 'undefined' ? loop : update);
      return;
    }
    if (isUserScrollingFast && Math.random() < 0.5) {
      if (typeof raf !== 'undefined') raf = requestAnimationFrame(typeof loop !== 'undefined' ? loop : update);
      else if (typeof rafId !== 'undefined') rafId = requestAnimationFrame(typeof loop !== 'undefined' ? loop : update);
      else if (typeof animateId !== 'undefined') animateId = requestAnimationFrame(typeof loop !== 'undefined' ? loop : update);
      else if (typeof animationId !== 'undefined') animationId = requestAnimationFrame(typeof loop !== 'undefined' ? loop : update);
      return;
    }

    raf = requestAnimationFrame(loop);
    program.uniforms.uTime.value = (now - startTime) * 0.001;
    renderer.render({ scene: mesh });
  };
  raf = requestAnimationFrame(loop);

  return () => {
    cancelAnimationFrame(raf);
    ro.disconnect();
    try { container.removeChild(canvas); } catch {}
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  };
}

// ==========================================
// 20. LIGHTNING INITIALIZER (React Bits / WebGL)
// ==========================================
function initLightning(container, opts = {}) {
  const {
    hue = 220,
    xOffset = 0,
    speed = 1.0,
    intensity = 1.2,
    size = 1.0
  } = opts;

  const vertex = `#version 300 es
  in vec2 position;
  void main() { gl_Position = vec4(position, 0.0, 1.0); }
  `;

  const fragment = `#version 300 es
  precision highp float;
  uniform vec2 iResolution;
  uniform float iTime;
  uniform float uHue;
  uniform float uXOffset;
  uniform float uSpeed;
  uniform float uIntensity;
  uniform float uSize;
  out vec4 fragColor;

  #define OCTAVE_COUNT 10

  vec3 hsv2rgb(vec3 c) {
    vec3 rgb = clamp(abs(mod(c.x * 6.0 + vec3(0.0,4.0,2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
    return c.z * mix(vec3(1.0), rgb, c.y);
  }

  float hash11(float p) {
    p = fract(p * .1031);
    p *= p + 33.33;
    p *= p + p;
    return fract(p);
  }

  float hash12(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * .1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }

  mat2 rotate2d(float theta) {
    float c = cos(theta);
    float s = sin(theta);
    return mat2(c, -s, s, c);
  }

  float noise(vec2 p) {
    vec2 ip = floor(p);
    vec2 fp = fract(p);
    float a = hash12(ip);
    float b = hash12(ip + vec2(1.0, 0.0));
    float c = hash12(ip + vec2(0.0, 1.0));
    float d = hash12(ip + vec2(1.0, 1.0));
    vec2 t = smoothstep(0.0, 1.0, fp);
    return mix(mix(a, b, t.x), mix(c, d, t.x), t.y);
  }

  float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;
    for (int i = 0; i < OCTAVE_COUNT; ++i) {
      value += amplitude * noise(p);
      p *= rotate2d(0.45);
      p *= 2.0;
      amplitude *= 0.5;
    }
    return value;
  }

  void main() {
    vec2 uv = gl_FragCoord.xy / iResolution.xy;
    uv = 2.0 * uv - 1.0;
    uv.x *= iResolution.x / iResolution.y;
    uv.x += uXOffset;
    uv += 2.0 * fbm(uv * uSize + 0.8 * iTime * uSpeed) - 1.0;
    
    float dist = abs(uv.x);
    vec3 baseColor = hsv2rgb(vec3(uHue / 360.0, 0.7, 0.8));
    vec3 col = baseColor * pow(mix(0.0, 0.07, hash11(iTime * uSpeed)) / dist, 1.0) * uIntensity;
    float a = clamp(max(col.r, max(col.g, col.b)), 0.0, 1.0);
    fragColor = vec4(col, a);
  }
  `;

  const renderer = new Renderer({ dpr: getOptimizedDPR(), alpha: true, premultipliedAlpha: false, antialias: false, powerPreference: 'low-power' });
  const gl = renderer.gl;
  const canvas = gl.canvas;
  canvas.style.position = 'absolute';
  canvas.style.inset = '0';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.display = 'block';
  container.appendChild(canvas);

  const geometry = new Triangle(gl);
  const program = new Program(gl, {
    vertex,
    fragment,
    uniforms: {
      iResolution: { value: new Float32Array([1, 1]) },
      iTime: { value: 0 },
      uHue: { value: hue },
      uXOffset: { value: xOffset },
      uSpeed: { value: speed },
      uIntensity: { value: intensity },
      uSize: { value: size }
    }
  });

  const mesh = new Mesh(gl, { geometry, program });

  const resize = () => {
    const w = container.clientWidth || window.innerWidth || 1;
    const h = container.clientHeight || window.innerHeight || 1;
    renderer.setSize(w, h);
    program.uniforms.iResolution.value[0] = gl.drawingBufferWidth;
    program.uniforms.iResolution.value[1] = gl.drawingBufferHeight;
  };
  const ro = new ResizeObserver(resize);
  ro.observe(container);
  resize();

  let raf = 0;
  const startTime = performance.now();
  const loop = now => {
    if (!isTabVisible) {
      if (typeof raf !== 'undefined') raf = requestAnimationFrame(typeof loop !== 'undefined' ? loop : update);
      else if (typeof rafId !== 'undefined') rafId = requestAnimationFrame(typeof loop !== 'undefined' ? loop : update);
      else if (typeof animateId !== 'undefined') animateId = requestAnimationFrame(typeof loop !== 'undefined' ? loop : update);
      else if (typeof animationId !== 'undefined') animationId = requestAnimationFrame(typeof loop !== 'undefined' ? loop : update);
      return;
    }
    if (isUserScrollingFast && Math.random() < 0.5) {
      if (typeof raf !== 'undefined') raf = requestAnimationFrame(typeof loop !== 'undefined' ? loop : update);
      else if (typeof rafId !== 'undefined') rafId = requestAnimationFrame(typeof loop !== 'undefined' ? loop : update);
      else if (typeof animateId !== 'undefined') animateId = requestAnimationFrame(typeof loop !== 'undefined' ? loop : update);
      else if (typeof animationId !== 'undefined') animationId = requestAnimationFrame(typeof loop !== 'undefined' ? loop : update);
      return;
    }

    raf = requestAnimationFrame(loop);
    program.uniforms.iTime.value = (now - startTime) * 0.001;
    renderer.render({ scene: mesh });
  };
  raf = requestAnimationFrame(loop);

  return () => {
    cancelAnimationFrame(raf);
    ro.disconnect();
    try { container.removeChild(canvas); } catch {}
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  };
}

// ==========================================
// 21. EVIL EYE INITIALIZER (React Bits / OGL)
// ==========================================
function initEvilEye(container, opts = {}) {
  const {
    eyeColor = '#FF6F37',
    intensity = 1.5,
    pupilSize = 0.6,
    irisWidth = 0.25,
    glowIntensity = 0.35,
    scale = 0.85,
    noiseScale = 1.0,
    pupilFollow = 1.0,
    flameSpeed = 1.0,
    backgroundColor = '#000000'
  } = opts;

  function hexToVec3(hex) {
    let h = hex.replace('#', '').trim();
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    const num = parseInt(h.slice(0, 6), 16);
    return [((num >> 16) & 255) / 255, ((num >> 8) & 255) / 255, (num & 255) / 255];
  }

  function generateNoiseTexture(size = 256) {
    const data = new Uint8Array(size * size * 4);
    function hash(x, y, s) {
      let n = x * 374761393 + y * 668265263 + s * 1274126177;
      n = Math.imul(n ^ (n >>> 13), 1274126177);
      return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
    }
    function noise(px, py, freq, seed) {
      const fx = (px / size) * freq, fy = (py / size) * freq;
      const ix = Math.floor(fx), iy = Math.floor(fy);
      const tx = fx - ix, ty = fy - iy;
      const w = freq | 0;
      const v00 = hash(((ix % w) + w) % w, ((iy % w) + w) % w, seed);
      const v10 = hash((((ix + 1) % w) + w) % w, ((iy % w) + w) % w, seed);
      const v01 = hash(((ix % w) + w) % w, (((iy + 1) % w) + w) % w, seed);
      const v11 = hash((((ix + 1) % w) + w) % w, (((iy + 1) % w) + w) % w, seed);
      return v00 * (1 - tx) * (1 - ty) + v10 * tx * (1 - ty) + v01 * (1 - tx) * ty + v11 * tx * ty;
    }
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        let v = 0, amp = 0.4, totalAmp = 0;
        for (let o = 0; o < 8; o++) {
          const f = 32 * (1 << o);
          v += amp * noise(x, y, f, o * 31);
          totalAmp += amp;
          amp *= 0.65;
        }
        v /= totalAmp;
        v = Math.max(0, Math.min(1, (v - 0.5) * 2.2 + 0.5));
        const val = Math.round(v * 255);
        const i = (y * size + x) * 4;
        data[i] = val; data[i + 1] = val; data[i + 2] = val; data[i + 3] = 255;
      }
    }
    return data;
  }

  const vertex = `#version 300 es
  in vec2 position;
  void main() { gl_Position = vec4(position, 0.0, 1.0); }
  `;

  const fragment = `#version 300 es
  precision highp float;
  uniform float uTime;
  uniform vec2 uResolution;
  uniform sampler2D uNoiseTexture;
  uniform float uPupilSize;
  uniform float uIrisWidth;
  uniform float uGlowIntensity;
  uniform float uIntensity;
  uniform float uScale;
  uniform float uNoiseScale;
  uniform vec2 uMouse;
  uniform float uPupilFollow;
  uniform float uFlameSpeed;
  uniform vec3 uEyeColor;
  uniform vec3 uBgColor;
  out vec4 fragColor;

  void main() {
    vec2 uv = (gl_FragCoord.xy * 2.0 - uResolution.xy) / uResolution.y;
    uv /= uScale;
    float ft = uTime * uFlameSpeed;
    float polarRadius = length(uv) * 2.0;
    float polarAngle = (2.0 * atan(uv.x, uv.y)) / 6.28 * 0.3;
    vec2 polarUv = vec2(polarRadius, polarAngle);

    vec4 noiseA = texture(uNoiseTexture, polarUv * vec2(0.2, 7.0) * uNoiseScale + vec2(-ft * 0.1, 0.0));
    vec4 noiseB = texture(uNoiseTexture, polarUv * vec2(0.3, 4.0) * uNoiseScale + vec2(-ft * 0.2, 0.0));
    vec4 noiseC = texture(uNoiseTexture, polarUv * vec2(0.1, 5.0) * uNoiseScale + vec2(-ft * 0.1, 0.0));

    float distanceMask = 1.0 - length(uv);
    float innerRing = clamp(-1.0 * ((distanceMask - 0.7) / uIrisWidth), 0.0, 1.0);
    innerRing = (innerRing * distanceMask - 0.2) / 0.28;
    innerRing += noiseA.r - 0.5;
    innerRing = clamp(innerRing * 1.3, 0.0, 1.0);

    float outerRing = clamp(-1.0 * ((distanceMask - 0.5) / 0.2), 0.0, 1.0);
    outerRing = (outerRing * distanceMask - 0.1) / 0.38;
    outerRing += noiseC.r - 0.5;
    outerRing = clamp(outerRing * 1.3, 0.0, 1.0);

    innerRing += outerRing;
    float innerEye = (distanceMask - 0.2) * noiseB.r * 2.0;

    vec2 pupilOffset = uMouse * uPupilFollow * 0.12;
    vec2 pupilUv = uv - pupilOffset;
    float pupil = clamp(1.0 - length(pupilUv * vec2(9.0, 2.3)), 0.0, 1.0) * uPupilSize / 0.35;

    float outerEyeGlow = clamp(1.0 - length(uv * vec2(0.5, 1.5)) + 0.5 + noiseC.r - 0.5, 0.0, 1.0);
    outerEyeGlow = pow(outerEyeGlow, 2.0) + distanceMask;
    outerEyeGlow = clamp(outerEyeGlow * uGlowIntensity, 0.0, 1.0) * pow(1.0 - distanceMask, 2.0) * 2.5;

    vec3 color = uEyeColor * uIntensity * clamp(max(innerRing + innerEye, outerEyeGlow) - pupil, 0.0, 3.0);
    color += uBgColor;
    fragColor = vec4(color, 1.0);
  }
  `;

  const renderer = new Renderer({ dpr: getOptimizedDPR(), alpha: true, premultipliedAlpha: false, antialias: false, powerPreference: 'low-power' });
  const gl = renderer.gl;
  gl.clearColor(0, 0, 0, 0);
  const canvas = gl.canvas;
  canvas.style.position = 'absolute';
  canvas.style.inset = '0';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.display = 'block';
  container.appendChild(canvas);

  const noiseData = generateNoiseTexture(256);
  const noiseTexture = new Texture(gl, {
    image: noiseData,
    width: 256,
    height: 256,
    generateMipmaps: false,
    flipY: false
  });
  noiseTexture.minFilter = gl.LINEAR;
  noiseTexture.magFilter = gl.LINEAR;
  noiseTexture.wrapS = gl.REPEAT;
  noiseTexture.wrapT = gl.REPEAT;

  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  const onMouseMove = e => {
    const rect = container.getBoundingClientRect();
    mouse.tx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.ty = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
  };
  const onMouseLeave = () => { mouse.tx = 0; mouse.ty = 0; };
  container.addEventListener('mousemove', onMouseMove, { passive: true });
  container.addEventListener('mouseleave', onMouseLeave);

  const geometry = new Triangle(gl);
  const program = new Program(gl, {
    vertex,
    fragment,
    uniforms: {
      uTime: { value: 0 },
      uResolution: { value: new Float32Array([1, 1]) },
      uNoiseTexture: { value: noiseTexture },
      uPupilSize: { value: pupilSize },
      uIrisWidth: { value: irisWidth },
      uGlowIntensity: { value: glowIntensity },
      uIntensity: { value: intensity },
      uScale: { value: scale },
      uNoiseScale: { value: noiseScale },
      uMouse: { value: new Float32Array([0, 0]) },
      uPupilFollow: { value: pupilFollow },
      uFlameSpeed: { value: flameSpeed },
      uEyeColor: { value: new Float32Array(hexToVec3(eyeColor)) },
      uBgColor: { value: new Float32Array(hexToVec3(backgroundColor)) }
    }
  });

  const mesh = new Mesh(gl, { geometry, program });

  const resize = () => {
    const w = container.clientWidth || window.innerWidth || 1;
    const h = container.clientHeight || window.innerHeight || 1;
    renderer.setSize(w, h);
    program.uniforms.uResolution.value = [gl.drawingBufferWidth, gl.drawingBufferHeight];
  };
  const ro = new ResizeObserver(resize);
  ro.observe(container);
  resize();

  let raf = 0;
  const loop = time => {
    if (!isTabVisible) {
      if (typeof raf !== 'undefined') raf = requestAnimationFrame(typeof loop !== 'undefined' ? loop : update);
      else if (typeof rafId !== 'undefined') rafId = requestAnimationFrame(typeof loop !== 'undefined' ? loop : update);
      else if (typeof animateId !== 'undefined') animateId = requestAnimationFrame(typeof loop !== 'undefined' ? loop : update);
      else if (typeof animationId !== 'undefined') animationId = requestAnimationFrame(typeof loop !== 'undefined' ? loop : update);
      return;
    }
    if (isUserScrollingFast && Math.random() < 0.5) {
      if (typeof raf !== 'undefined') raf = requestAnimationFrame(typeof loop !== 'undefined' ? loop : update);
      else if (typeof rafId !== 'undefined') rafId = requestAnimationFrame(typeof loop !== 'undefined' ? loop : update);
      else if (typeof animateId !== 'undefined') animateId = requestAnimationFrame(typeof loop !== 'undefined' ? loop : update);
      else if (typeof animationId !== 'undefined') animationId = requestAnimationFrame(typeof loop !== 'undefined' ? loop : update);
      return;
    }

    raf = requestAnimationFrame(loop);
    mouse.x += (mouse.tx - mouse.x) * 0.05;
    mouse.y += (mouse.ty - mouse.y) * 0.05;
    program.uniforms.uMouse.value[0] = mouse.x;
    program.uniforms.uMouse.value[1] = mouse.y;
    program.uniforms.uTime.value = time * 0.001;
    renderer.render({ scene: mesh });
  };
  raf = requestAnimationFrame(loop);

  return () => {
    cancelAnimationFrame(raf);
    ro.disconnect();
    container.removeEventListener('mousemove', onMouseMove);
    container.removeEventListener('mouseleave', onMouseLeave);
    try { container.removeChild(canvas); } catch {}
    try { if (noiseTexture && noiseTexture.texture) gl.deleteTexture(noiseTexture.texture); } catch {}
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  };
}



// ==========================================
// 22. BEAMS INITIALIZER (React Bits / Three.js)
// ==========================================
function initBeams(container, opts = {}) {
  const THREE_LIB = typeof THREE !== 'undefined' ? THREE : (typeof window !== 'undefined' ? window.THREE : null);
  if (!THREE_LIB) {
    console.warn('Three.js não encontrado para Beams');
    return () => {};
  }

  const {
    beamWidth = 2,
    beamHeight = 15,
    beamNumber = 12,
    lightColor = '#ffffff',
    beamColor = '#000000',
    backgroundColor = '#000000',
    speed = 2,
    noiseIntensity = 1.75,
    scale = 0.2,
    rotation = 0,
    lightMode = false
  } = opts;

  const hexToNormalizedRGB = hex => {
    const clean = (hex || '#000000').replace('#', '');
    const r = parseInt(clean.substring(0, 2), 16) || 0;
    const g = parseInt(clean.substring(2, 4), 16) || 0;
    const b = parseInt(clean.substring(4, 6), 16) || 0;
    return [r / 255, g / 255, b / 255];
  };

  const noiseShader = `
float random (in vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
}
float noise (in vec2 st) {
    vec2 i = floor(st);
    vec2 f = fract(st);
    float a = random(i);
    float b = random(i + vec2(1.0, 0.0));
    float c = random(i + vec2(0.0, 1.0));
    float d = random(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}
vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}
vec3 fade(vec3 t) {return t*t*t*(t*(t*6.0-15.0)+10.0);}
float cnoise(vec3 P){
  vec3 Pi0 = floor(P);
  vec3 Pi1 = Pi0 + vec3(1.0);
  Pi0 = mod(Pi0, 289.0);
  Pi1 = mod(Pi1, 289.0);
  vec3 Pf0 = fract(P);
  vec3 Pf1 = Pf0 - vec3(1.0);
  vec4 ix = vec4(Pi0.x, Pi1.x, Pi0.x, Pi1.x);
  vec4 iy = vec4(Pi0.yy, Pi1.yy);
  vec4 iz0 = Pi0.zzzz;
  vec4 iz1 = Pi1.zzzz;
  vec4 ixy = permute(permute(ix) + iy);
  vec4 ixy0 = permute(ixy + iz0);
  vec4 ixy1 = permute(ixy + iz1);
  vec4 gx0 = ixy0 / 7.0;
  vec4 gy0 = fract(floor(gx0) / 7.0) - 0.5;
  gx0 = fract(gx0);
  vec4 gz0 = vec4(0.5) - abs(gx0) - abs(gy0);
  vec4 sz0 = step(gz0, vec4(0.0));
  gx0 -= sz0 * (step(0.0, gx0) - 0.5);
  gy0 -= sz0 * (step(0.0, gy0) - 0.5);
  vec4 gx1 = ixy1 / 7.0;
  vec4 gy1 = fract(floor(gx1) / 7.0) - 0.5;
  gx1 = fract(gx1);
  vec4 gz1 = vec4(0.5) - abs(gx1) - abs(gy1);
  vec4 sz1 = step(gz1, vec4(0.0));
  gx1 -= sz1 * (step(0.0, gx1) - 0.5);
  gy1 -= sz1 * (step(0.0, gy1) - 0.5);
  vec3 g000 = vec3(gx0.x,gy0.x,gz0.x);
  vec3 g100 = vec3(gx0.y,gy0.y,gz0.y);
  vec3 g010 = vec3(gx0.z,gy0.z,gz0.z);
  vec3 g110 = vec3(gx0.w,gy0.w,gz0.w);
  vec3 g001 = vec3(gx1.x,gy1.x,gz1.x);
  vec3 g101 = vec3(gx1.y,gy1.y,gz1.y);
  vec3 g011 = vec3(gx1.z,gy1.z,gz1.z);
  vec3 g111 = vec3(gx1.w,gy1.w,gz1.w);
  vec4 norm0 = taylorInvSqrt(vec4(dot(g000,g000),dot(g010,g010),dot(g100,g100),dot(g110,g110)));
  g000 *= norm0.x; g010 *= norm0.y; g100 *= norm0.z; g110 *= norm0.w;
  vec4 norm1 = taylorInvSqrt(vec4(dot(g001,g001),dot(g011,g011),dot(g101,g101),dot(g111,g111)));
  g001 *= norm1.x; g011 *= norm1.y; g101 *= norm1.z; g111 *= norm1.w;
  float n000 = dot(g000, Pf0);
  float n100 = dot(g100, vec3(Pf1.x,Pf0.yz));
  float n010 = dot(g010, vec3(Pf0.x,Pf1.y,Pf0.z));
  float n110 = dot(g110, vec3(Pf1.xy,Pf0.z));
  float n001 = dot(g001, vec3(Pf0.xy,Pf1.z));
  float n101 = dot(g101, vec3(Pf1.x,Pf0.y,Pf1.z));
  float n011 = dot(g011, vec3(Pf0.x,Pf1.yz));
  float n111 = dot(g111, Pf1);
  vec3 fade_xyz = fade(Pf0);
  vec4 n_z = mix(vec4(n000,n100,n010,n110),vec4(n001,n101,n011,n111),fade_xyz.z);
  vec2 n_yz = mix(n_z.xy,n_z.zw,fade_xyz.y);
  float n_xyz = mix(n_yz.x,n_yz.y,fade_xyz.x);
  return 2.2 * n_xyz;
}
`;

  function extendMaterial(BaseMaterial, cfg) {
    const physical = THREE_LIB.ShaderLib.physical;
    const { vertexShader: baseVert, fragmentShader: baseFrag, uniforms: baseUniforms } = physical;
    const baseDefines = physical.defines || {};
    const uniforms = THREE_LIB.UniformsUtils.clone(baseUniforms);
    const defaults = new BaseMaterial(cfg.material || {});

    if (defaults.color) uniforms.diffuse.value = defaults.color;
    if ('roughness' in defaults) uniforms.roughness.value = defaults.roughness;
    if ('metalness' in defaults) uniforms.metalness.value = defaults.metalness;
    if ('envMap' in defaults) uniforms.envMap.value = defaults.envMap;
    if ('envMapIntensity' in defaults) uniforms.envMapIntensity.value = defaults.envMapIntensity;

    Object.entries(cfg.uniforms || {}).forEach(([key, u]) => {
      uniforms[key] = u !== null && typeof u === 'object' && 'value' in u ? u : { value: u };
    });

    let vert = `${cfg.header}\n${cfg.vertexHeader || ''}\n${baseVert}`;
    let frag = `${cfg.header}\n${cfg.fragmentHeader || ''}\n${baseFrag}`;

    for (const [inc, code] of Object.entries(cfg.vertex || {})) {
      vert = vert.replace(inc, `${inc}\n${code}`);
    }
    for (const [inc, code] of Object.entries(cfg.fragment || {})) {
      frag = frag.replace(inc, `${inc}\n${code}`);
    }

    const mat = new THREE_LIB.ShaderMaterial({
      defines: { ...baseDefines },
      uniforms,
      vertexShader: vert,
      fragmentShader: frag,
      lights: true,
      fog: !!cfg.material?.fog
    });

    return mat;
  }

  function createStackedPlanesBufferGeometry(n, width, height, spacing, heightSegments) {
    const geometry = new THREE_LIB.BufferGeometry();
    const numVertices = n * (heightSegments + 1) * 2;
    const numFaces = n * heightSegments * 2;
    const positions = new Float32Array(numVertices * 3);
    const indices = new Uint32Array(numFaces * 3);
    const uvs = new Float32Array(numVertices * 2);

    let vertexOffset = 0;
    let indexOffset = 0;
    let uvOffset = 0;
    const totalWidth = n * width + (n - 1) * spacing;
    const xOffsetBase = -totalWidth / 2;

    for (let i = 0; i < n; i++) {
      const xOffset = xOffsetBase + i * (width + spacing);
      const uvXOffset = Math.random() * 300;
      const uvYOffset = Math.random() * 300;

      for (let j = 0; j <= heightSegments; j++) {
        const y = height * (j / heightSegments - 0.5);
        const v0 = [xOffset, y, 0];
        const v1 = [xOffset + width, y, 0];
        positions.set([...v0, ...v1], vertexOffset * 3);

        const uvY = j / heightSegments;
        uvs.set([uvXOffset, uvY + uvYOffset, uvXOffset + 1, uvY + uvYOffset], uvOffset);

        if (j < heightSegments) {
          const a = vertexOffset,
            b = vertexOffset + 1,
            c = vertexOffset + 2,
            d = vertexOffset + 3;
          indices.set([a, b, c, c, b, d], indexOffset);
          indexOffset += 6;
        }
        vertexOffset += 2;
        uvOffset += 4;
      }
    }

    geometry.setAttribute('position', new THREE_LIB.BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE_LIB.BufferAttribute(uvs, 2));
    geometry.setIndex(new THREE_LIB.BufferAttribute(indices, 1));
    geometry.computeVertexNormals();
    return geometry;
  }

  const scene = new THREE_LIB.Scene();
  const camera = new THREE_LIB.PerspectiveCamera(30, 1, 0.1, 1000);
  camera.position.set(0, 0, 20);

  const renderer = new THREE_LIB.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(getOptimizedDPR());
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
  renderer.domElement.style.position = 'absolute';
  renderer.domElement.style.top = '0';
  renderer.domElement.style.left = '0';
  container.appendChild(renderer.domElement);

  const beamMaterial = extendMaterial(THREE_LIB.MeshStandardMaterial, {
    header: `
varying vec3 vEye;
varying float vNoise;
varying vec2 vUv;
varying vec3 vPosition;
uniform float time;
uniform float uSpeed;
uniform float uNoiseIntensity;
uniform float uScale;
${noiseShader}`,
    vertexHeader: `
float getPos(vec3 pos) {
  vec3 noisePos = vec3(pos.x * 0., pos.y - uv.y, pos.z + time * uSpeed * 3.) * uScale;
  return cnoise(noisePos);
}
vec3 getCurrentPos(vec3 pos) {
  vec3 newpos = pos;
  newpos.z += getPos(pos);
  return newpos;
}
vec3 getNormal(vec3 pos) {
  vec3 curpos = getCurrentPos(pos);
  vec3 nextposX = getCurrentPos(pos + vec3(0.01, 0.0, 0.0));
  vec3 nextposZ = getCurrentPos(pos + vec3(0.0, -0.01, 0.0));
  vec3 tangentX = normalize(nextposX - curpos);
  vec3 tangentZ = normalize(nextposZ - curpos);
  return normalize(cross(tangentZ, tangentX));
}`,
    fragmentHeader: 'uniform float uLightMode;',
    vertex: {
      '#include <begin_vertex>': `transformed.z += getPos(transformed.xyz);`,
      '#include <beginnormal_vertex>': `objectNormal = getNormal(position.xyz);`
    },
    fragment: {
      '#include <dithering_fragment>': `
float randomNoise = noise(gl_FragCoord.xy);
gl_FragColor.rgb -= randomNoise / 15. * uNoiseIntensity;
if (uLightMode > 0.5) {
  float energy = max(max(gl_FragColor.r, gl_FragColor.g), gl_FragColor.b);
  vec3 chroma = clamp(gl_FragColor.rgb / max(energy, 0.0001), 0.0, 1.0);
  chroma = pow(chroma, vec3(1.2));
  gl_FragColor.rgb = mix(vec3(1.0), chroma, clamp(energy * 0.98, 0.0, 0.94));
}`
    },
    material: { fog: true },
    uniforms: {
      diffuse: new THREE_LIB.Color(...hexToNormalizedRGB(beamColor)),
      time: { value: 0 },
      roughness: 0.3,
      metalness: 0.3,
      uSpeed: { value: speed },
      envMapIntensity: 10,
      uNoiseIntensity: noiseIntensity,
      uScale: scale,
      uLightMode: lightMode ? 1 : 0
    }
  });

  const group = new THREE_LIB.Group();
  group.rotation.z = THREE_LIB.MathUtils.degToRad(rotation);
  scene.add(group);

  const geometry = createStackedPlanesBufferGeometry(beamNumber, beamWidth, beamHeight, 0, 100);
  const mesh = new THREE_LIB.Mesh(geometry, beamMaterial);
  group.add(mesh);

  const dirLight = new THREE_LIB.DirectionalLight(lightColor, 1.2);
  dirLight.position.set(0, 3, 10);
  group.add(dirLight);

  const ambLight = new THREE_LIB.AmbientLight(0xffffff, 0.8);
  scene.add(ambLight);

  if (backgroundColor && backgroundColor !== 'transparent') {
    scene.background = new THREE_LIB.Color(backgroundColor);
  }

  const resize = () => {
    const w = container.clientWidth || window.innerWidth || 1;
    const h = container.clientHeight || window.innerHeight || 1;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };

  const ro = new ResizeObserver(resize);
  ro.observe(container);
  resize();

  let raf = 0;
  let lastTime = performance.now();

  const loop = (now) => {
    if (!isTabVisible) {
      raf = requestAnimationFrame(loop);
      return;
    }
    raf = requestAnimationFrame(loop);
    const delta = Math.min((now - lastTime) * 0.001, 0.1);
    lastTime = now;

    beamMaterial.uniforms.time.value += 0.1 * delta;
    renderer.render(scene, camera);
  };
  raf = requestAnimationFrame(loop);

  return () => {
    cancelAnimationFrame(raf);
    ro.disconnect();
    try { container.removeChild(renderer.domElement); } catch {}
    geometry.dispose();
    beamMaterial.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
  };
}

// ==========================================
// 23. FLOATING LINES INITIALIZER (React Bits / Three.js)
// ==========================================
function initFloatingLines(container, opts = {}) {
  const THREE_LIB = typeof THREE !== 'undefined' ? THREE : (typeof window !== 'undefined' ? window.THREE : null);
  if (!THREE_LIB) {
    console.warn('Three.js não encontrado para FloatingLines');
    return () => {};
  }

  const {
    linesGradient = ['#e947f5', '#2f4ba2', '#38bdf8', '#a855f7'],
    enabledWaves = ['top', 'middle', 'bottom'],
    lineCount = [10, 15, 20],
    lineDistance = [8, 6, 4],
    topWavePosition = { x: 10.0, y: 0.5, rotate: -0.4 },
    middleWavePosition = { x: 5.0, y: 0.0, rotate: 0.2 },
    bottomWavePosition = { x: 2.0, y: -0.7, rotate: 0.4 },
    animationSpeed = 1,
    interactive = true,
    bendRadius = 5.0,
    bendStrength = -0.5,
    mouseDamping = 0.05,
    parallax = true,
    parallaxStrength = 0.2,
    backgroundColor = '#000000',
    lightMode = false
  } = opts;

  const vertexShader = `
precision highp float;
void main() {
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

  const fragmentShader = `
precision highp float;

uniform float iTime;
uniform vec3  iResolution;
uniform float animationSpeed;

uniform bool enableTop;
uniform bool enableMiddle;
uniform bool enableBottom;

uniform int topLineCount;
uniform int middleLineCount;
uniform int bottomLineCount;

uniform float topLineDistance;
uniform float middleLineDistance;
uniform float bottomLineDistance;

uniform vec3 topWavePosition;
uniform vec3 middleWavePosition;
uniform vec3 bottomWavePosition;

uniform vec2 iMouse;
uniform bool interactive;
uniform float bendRadius;
uniform float bendStrength;
uniform float bendInfluence;

uniform bool parallax;
uniform float parallaxStrength;
uniform vec2 parallaxOffset;

uniform vec3 lineGradient[8];
uniform int lineGradientCount;
uniform vec3 backgroundColor;
uniform bool lightMode;

const vec3 BLACK = vec3(0.0);
const vec3 PINK  = vec3(233.0, 71.0, 245.0) / 255.0;
const vec3 BLUE  = vec3(47.0,  75.0, 162.0) / 255.0;

mat2 rotate(float r) {
  return mat2(cos(r), sin(r), -sin(r), cos(r));
}

vec3 background_color(vec2 uv) {
  vec3 col = vec3(0.0);
  float y = sin(uv.x - 0.2) * 0.3 - 0.1;
  float m = uv.y - y;
  col += mix(BLUE, BLACK, smoothstep(0.0, 1.0, abs(m)));
  col += mix(PINK, BLACK, smoothstep(0.0, 1.0, abs(m - 0.8)));
  return col * 0.5;
}

vec3 getLineColor(float t, vec3 baseColor) {
  if (lineGradientCount <= 0) {
    return baseColor;
  }
  vec3 gradientColor;
  if (lineGradientCount == 1) {
    gradientColor = lineGradient[0];
  } else {
    float clampedT = clamp(t, 0.0, 0.9999);
    float scaled = clampedT * float(lineGradientCount - 1);
    int idx = int(floor(scaled));
    float f = fract(scaled);
    int idx2 = min(idx + 1, lineGradientCount - 1);
    vec3 c1 = lineGradient[idx];
    vec3 c2 = lineGradient[idx2];
    gradientColor = mix(c1, c2, f);
  }
  return gradientColor * 0.5;
}

float wave(vec2 uv, float offset, vec2 screenUv, vec2 mouseUv, bool shouldBend) {
  float time = iTime * animationSpeed;
  float x_offset   = offset;
  float x_movement = time * 0.1;
  float amp        = sin(offset + time * 0.2) * 0.3;
  float y          = sin(uv.x + x_offset + x_movement) * amp;

  if (shouldBend) {
    vec2 d = screenUv - mouseUv;
    float influence = exp(-dot(d, d) * bendRadius);
    float bendOffset = (mouseUv.y - screenUv.y) * influence * bendStrength * bendInfluence;
    y += bendOffset;
  }

  float m = uv.y - y;
  return 0.0175 / max(abs(m) + 0.01, 1e-3) + 0.01;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 baseUv = (2.0 * fragCoord - iResolution.xy) / iResolution.y;
  baseUv.y *= -1.0;
  
  if (parallax) {
    baseUv += parallaxOffset;
  }

  vec3 col = vec3(0.0);
  vec3 b = lineGradientCount > 0 ? vec3(0.0) : background_color(baseUv);

  vec2 mouseUv = vec2(0.0);
  if (interactive) {
    mouseUv = (2.0 * iMouse - iResolution.xy) / iResolution.y;
    mouseUv.y *= -1.0;
  }
  
  if (enableBottom) {
    for (int i = 0; i < bottomLineCount; ++i) {
      float fi = float(i);
      float t = fi / max(float(bottomLineCount - 1), 1.0);
      vec3 lineCol = getLineColor(t, b);
      
      float angle = bottomWavePosition.z * log(length(baseUv) + 1.0);
      vec2 ruv = baseUv * rotate(angle);
      col += lineCol * wave(
        ruv + vec2(bottomLineDistance * fi + bottomWavePosition.x, bottomWavePosition.y),
        1.5 + 0.2 * fi,
        baseUv,
        mouseUv,
        interactive
      ) * 0.2;
    }
  }

  if (enableMiddle) {
    for (int i = 0; i < middleLineCount; ++i) {
      float fi = float(i);
      float t = fi / max(float(middleLineCount - 1), 1.0);
      vec3 lineCol = getLineColor(t, b);
      
      float angle = middleWavePosition.z * log(length(baseUv) + 1.0);
      vec2 ruv = baseUv * rotate(angle);
      col += lineCol * wave(
        ruv + vec2(middleLineDistance * fi + middleWavePosition.x, middleWavePosition.y),
        2.0 + 0.15 * fi,
        baseUv,
        mouseUv,
        interactive
      );
    }
  }

  if (enableTop) {
    for (int i = 0; i < topLineCount; ++i) {
      float fi = float(i);
      float t = fi / max(float(topLineCount - 1), 1.0);
      vec3 lineCol = getLineColor(t, b);
      
      float angle = topWavePosition.z * log(length(baseUv) + 1.0);
      vec2 ruv = baseUv * rotate(angle);
      ruv.x *= -1.0;
      col += lineCol * wave(
        ruv + vec2(topLineDistance * fi + topWavePosition.x, topWavePosition.y),
        1.0 + 0.2 * fi,
        baseUv,
        mouseUv,
        interactive
      ) * 0.1;
    }
  }

  if (lightMode) {
    vec3 energy = max(col, vec3(0.0));
    float peak = max(energy.r, max(energy.g, energy.b));
    float coverage = smoothstep(0.018, 0.5, peak);
    vec3 chroma = clamp(energy / max(peak, 0.0001), 0.0, 1.0);
    chroma = pow(chroma, vec3(1.35));
    float chromaPeak = max(chroma.r, max(chroma.g, chroma.b));
    chroma /= max(chromaPeak, 0.0001);
    vec3 ink = mix(chroma, clamp(chroma * 0.82, 0.0, 1.0), smoothstep(0.5, 1.0, coverage));
    fragColor = vec4(mix(vec3(1.0), ink, coverage * 0.94), 1.0);
  } else {
    fragColor = vec4(col, 1.0);
  }
}

void main() {
  vec4 color = vec4(0.0);
  mainImage(color, gl_FragCoord.xy);
  gl_FragColor = color;
}
`;

  const MAX_GRADIENT_STOPS = 8;
  function hexToVec3(hex) {
    let value = (hex || '').trim();
    if (value.startsWith('#')) value = value.slice(1);
    let r = 255, g = 255, b = 255;
    if (value.length === 3) {
      r = parseInt(value[0] + value[0], 16);
      g = parseInt(value[1] + value[1], 16);
      b = parseInt(value[2] + value[2], 16);
    } else if (value.length === 6) {
      r = parseInt(value.slice(0, 2), 16);
      g = parseInt(value.slice(2, 4), 16);
      b = parseInt(value.slice(4, 6), 16);
    }
    return new THREE_LIB.Vector3(r / 255, g / 255, b / 255);
  }

  const getLineCount = waveType => {
    if (typeof lineCount === 'number') return lineCount;
    if (!enabledWaves.includes(waveType)) return 0;
    const index = enabledWaves.indexOf(waveType);
    return lineCount[index] !== undefined ? lineCount[index] : 6;
  };

  const getLineDistance = waveType => {
    if (typeof lineDistance === 'number') return lineDistance;
    if (!enabledWaves.includes(waveType)) return 0.1;
    const index = enabledWaves.indexOf(waveType);
    return lineDistance[index] !== undefined ? lineDistance[index] : 0.1;
  };

  const topLineCount = enabledWaves.includes('top') ? getLineCount('top') : 0;
  const middleLineCount = enabledWaves.includes('middle') ? getLineCount('middle') : 0;
  const bottomLineCount = enabledWaves.includes('bottom') ? getLineCount('bottom') : 0;

  const topLineDistance = enabledWaves.includes('top') ? getLineDistance('top') * 0.01 : 0.01;
  const middleLineDistance = enabledWaves.includes('middle') ? getLineDistance('middle') * 0.01 : 0.01;
  const bottomLineDistance = enabledWaves.includes('bottom') ? getLineDistance('bottom') * 0.01 : 0.01;

  const scene = new THREE_LIB.Scene();
  const camera = new THREE_LIB.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  camera.position.z = 1;

  const renderer = new THREE_LIB.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(getOptimizedDPR());
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
  renderer.domElement.style.position = 'absolute';
  renderer.domElement.style.top = '0';
  renderer.domElement.style.left = '0';
  renderer.domElement.style.mixBlendMode = lightMode ? 'normal' : 'screen';
  container.appendChild(renderer.domElement);

  const uniforms = {
    iTime: { value: 0 },
    iResolution: { value: new THREE_LIB.Vector3(1, 1, 1) },
    animationSpeed: { value: animationSpeed },

    enableTop: { value: enabledWaves.includes('top') },
    enableMiddle: { value: enabledWaves.includes('middle') },
    enableBottom: { value: enabledWaves.includes('bottom') },

    topLineCount: { value: topLineCount },
    middleLineCount: { value: middleLineCount },
    bottomLineCount: { value: bottomLineCount },

    topLineDistance: { value: topLineDistance },
    middleLineDistance: { value: middleLineDistance },
    bottomLineDistance: { value: bottomLineDistance },

    topWavePosition: {
      value: new THREE_LIB.Vector3(topWavePosition?.x ?? 10.0, topWavePosition?.y ?? 0.5, topWavePosition?.rotate ?? -0.4)
    },
    middleWavePosition: {
      value: new THREE_LIB.Vector3(middleWavePosition?.x ?? 5.0, middleWavePosition?.y ?? 0.0, middleWavePosition?.rotate ?? 0.2)
    },
    bottomWavePosition: {
      value: new THREE_LIB.Vector3(bottomWavePosition?.x ?? 2.0, bottomWavePosition?.y ?? -0.7, bottomWavePosition?.rotate ?? 0.4)
    },

    iMouse: { value: new THREE_LIB.Vector2(-1000, -1000) },
    interactive: { value: interactive },
    bendRadius: { value: bendRadius },
    bendStrength: { value: bendStrength },
    bendInfluence: { value: 0 },

    parallax: { value: parallax },
    parallaxStrength: { value: parallaxStrength },
    parallaxOffset: { value: new THREE_LIB.Vector2(0, 0) },

    lineGradient: {
      value: Array.from({ length: MAX_GRADIENT_STOPS }, () => new THREE_LIB.Vector3(1, 1, 1))
    },
    lineGradientCount: { value: 0 },
    backgroundColor: { value: hexToVec3(backgroundColor) },
    lightMode: { value: lightMode }
  };

  if (linesGradient && linesGradient.length > 0) {
    const stops = linesGradient.slice(0, MAX_GRADIENT_STOPS);
    uniforms.lineGradientCount.value = stops.length;
    stops.forEach((hex, i) => {
      const color = hexToVec3(hex);
      uniforms.lineGradient.value[i].set(color.x, color.y, color.z);
    });
  }

  const material = new THREE_LIB.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader
  });

  const geometry = new THREE_LIB.PlaneGeometry(2, 2);
  const mesh = new THREE_LIB.Mesh(geometry, material);
  scene.add(mesh);

  const clock = new THREE_LIB.Clock();

  const targetMouse = new THREE_LIB.Vector2(-1000, -1000);
  const currentMouse = new THREE_LIB.Vector2(-1000, -1000);
  let targetInfluence = 0;
  let currentInfluence = 0;
  const targetParallax = new THREE_LIB.Vector2(0, 0);
  const currentParallax = new THREE_LIB.Vector2(0, 0);

  const resize = () => {
    const w = container.clientWidth || window.innerWidth || 1;
    const h = container.clientHeight || window.innerHeight || 1;
    renderer.setSize(w, h);
    uniforms.iResolution.value.set(renderer.domElement.width, renderer.domElement.height, 1);
  };

  const ro = new ResizeObserver(resize);
  ro.observe(container);
  resize();

  const handlePointerMove = event => {
    const rect = renderer.domElement.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const dpr = renderer.getPixelRatio();

    targetMouse.set(x * dpr, (rect.height - y) * dpr);
    targetInfluence = 1.0;

    if (parallax) {
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const offsetX = (x - centerX) / rect.width;
      const offsetY = -(y - centerY) / rect.height;
      targetParallax.set(offsetX * parallaxStrength, offsetY * parallaxStrength);
    }
  };

  const handlePointerLeave = () => {
    targetInfluence = 0.0;
  };

  if (interactive) {
    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('pointerleave', handlePointerLeave, { passive: true });
  }

  let raf = 0;
  const loop = () => {
    if (!isTabVisible) {
      raf = requestAnimationFrame(loop);
      return;
    }
    raf = requestAnimationFrame(loop);

    uniforms.iTime.value = clock.getElapsedTime();

    if (interactive) {
      currentMouse.lerp(targetMouse, mouseDamping);
      uniforms.iMouse.value.copy(currentMouse);

      currentInfluence += (targetInfluence - currentInfluence) * mouseDamping;
      uniforms.bendInfluence.value = currentInfluence;
    }

    if (parallax) {
      currentParallax.lerp(targetParallax, mouseDamping);
      uniforms.parallaxOffset.value.copy(currentParallax);
    }

    renderer.render(scene, camera);
  };
  raf = requestAnimationFrame(loop);

  return () => {
    cancelAnimationFrame(raf);
    ro.disconnect();
    if (interactive) {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerleave', handlePointerLeave);
    }
    try { container.removeChild(renderer.domElement); } catch {}
    geometry.dispose();
    material.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
  };
}

// ==========================================
// 24. SILK INITIALIZER (React Bits / Three.js)
// ==========================================
function initSilk(container, opts = {}) {
  const THREE_LIB = typeof THREE !== 'undefined' ? THREE : (typeof window !== 'undefined' ? window.THREE : null);
  if (!THREE_LIB) {
    console.warn('Three.js não encontrado para Silk');
    return () => {};
  }

  const {
    speed = 5,
    scale = 1,
    color = '#7B7481',
    noiseIntensity = 1.5,
    rotation = 0,
    lightMode = false
  } = opts;

  const hexToNormalizedRGB = hex => {
    const clean = (hex || '#7B7481').replace('#', '');
    return [
      (parseInt(clean.slice(0, 2), 16) || 0) / 255,
      (parseInt(clean.slice(2, 4), 16) || 0) / 255,
      (parseInt(clean.slice(4, 6), 16) || 0) / 255
    ];
  };

  const vertexShader = `
varying vec2 vUv;
varying vec3 vPosition;

void main() {
  vPosition = position;
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

  const fragmentShader = `
varying vec2 vUv;
varying vec3 vPosition;

uniform float uTime;
uniform vec3  uColor;
uniform float uSpeed;
uniform float uScale;
uniform float uRotation;
uniform float uNoiseIntensity;
uniform float uLightMode;

const float e = 2.71828182845904523536;

float noise(vec2 texCoord) {
  float G = e;
  vec2  r = (G * sin(G * texCoord));
  return fract(r.x * r.y * (1.0 + texCoord.x));
}

vec2 rotateUvs(vec2 uv, float angle) {
  float c = cos(angle);
  float s = sin(angle);
  mat2  rot = mat2(c, -s, s, c);
  return rot * uv;
}

void main() {
  float rnd        = noise(gl_FragCoord.xy);
  vec2  uv         = rotateUvs(vUv * uScale, uRotation);
  vec2  tex        = uv * uScale;
  float tOffset    = uSpeed * uTime;

  tex.y += 0.03 * sin(8.0 * tex.x - tOffset);

  float pattern = 0.6 +
                  0.4 * sin(5.0 * (tex.x + tex.y +
                                   cos(3.0 * tex.x + 5.0 * tex.y) +
                                   0.02 * tOffset) +
                           sin(20.0 * (tex.x + tex.y - 0.1 * tOffset)));

  float grain = rnd / 15.0 * uNoiseIntensity;
  vec3 result = uColor * pattern - vec3(grain);
  if (uLightMode > 0.5) {
    float fold = smoothstep(0.28, 0.9, pattern);
    float specular = smoothstep(0.72, 0.98, pattern);
    vec3 shadowColor = uColor * 0.72;
    vec3 bodyColor = min(uColor * 1.18, vec3(1.0));
    vec3 lightBase = mix(shadowColor, bodyColor, fold);
    lightBase = mix(lightBase, vec3(1.0), specular * 0.92);
    float fineNoise = noise(gl_FragCoord.xy * 0.63 + vec2(17.0, 41.0));
    float grainSignal = (rnd + fineNoise - 1.0);
    float grainStrength = clamp(uNoiseIntensity * 0.038, 0.0, 0.16);
    result = lightBase + grainSignal * grainStrength;
  }
  gl_FragColor = vec4(clamp(result, 0.0, 1.0), 1.0);
}
`;

  const scene = new THREE_LIB.Scene();
  const camera = new THREE_LIB.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  camera.position.z = 1;

  const renderer = new THREE_LIB.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(getOptimizedDPR());
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
  renderer.domElement.style.position = 'absolute';
  renderer.domElement.style.top = '0';
  renderer.domElement.style.left = '0';
  container.appendChild(renderer.domElement);

  const uniforms = {
    uTime: { value: 0 },
    uSpeed: { value: speed },
    uScale: { value: scale },
    uNoiseIntensity: { value: noiseIntensity },
    uColor: { value: new THREE_LIB.Color(...hexToNormalizedRGB(color)) },
    uRotation: { value: rotation },
    uLightMode: { value: lightMode ? 1 : 0 }
  };

  const material = new THREE_LIB.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader
  });

  const geometry = new THREE_LIB.PlaneGeometry(2, 2);
  const mesh = new THREE_LIB.Mesh(geometry, material);
  scene.add(mesh);

  const clock = new THREE_LIB.Clock();

  const resize = () => {
    const w = container.clientWidth || window.innerWidth || 1;
    const h = container.clientHeight || window.innerHeight || 1;
    renderer.setSize(w, h);
  };

  const ro = new ResizeObserver(resize);
  ro.observe(container);
  resize();

  let raf = 0;
  const loop = () => {
    if (!isTabVisible) {
      raf = requestAnimationFrame(loop);
      return;
    }
    raf = requestAnimationFrame(loop);
    const delta = clock.getDelta();
    uniforms.uTime.value += 0.1 * delta;
    renderer.render(scene, camera);
  };
  raf = requestAnimationFrame(loop);

  return () => {
    cancelAnimationFrame(raf);
    ro.disconnect();
    try { container.removeChild(renderer.domElement); } catch {}
    geometry.dispose();
    material.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
  };
}

// ==========================================
// 25. RADAR INITIALIZER (React Bits / OGL)
// ==========================================
function initRadar(container, opts = {}) {
  const {
    speed = 1.0,
    scale = 0.5,
    ringCount = 10.0,
    spokeCount = 10.0,
    ringThickness = 0.05,
    spokeThickness = 0.01,
    sweepSpeed = 1.0,
    sweepWidth = 2.0,
    sweepLobes = 1.0,
    color = '#9f29ff',
    backgroundColor = '#000000',
    falloff = 2.0,
    brightness = 1.0,
    enableMouseInteraction = true,
    mouseInfluence = 0.1,
    lightMode = false
  } = opts;

  function hexToVec3(hex) {
    const h = (hex || '#000000').replace('#', '');
    return [
      (parseInt(h.slice(0, 2), 16) || 0) / 255,
      (parseInt(h.slice(2, 4), 16) || 0) / 255,
      (parseInt(h.slice(4, 6), 16) || 0) / 255
    ];
  }

  const vertexShader = `
attribute vec2 uv;
attribute vec2 position;
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 0, 1);
}
`;

  const fragmentShader = `
precision highp float;

uniform float uTime;
uniform vec3 uResolution;
uniform float uSpeed;
uniform float uScale;
uniform float uRingCount;
uniform float uSpokeCount;
uniform float uRingThickness;
uniform float uSpokeThickness;
uniform float uSweepSpeed;
uniform float uSweepWidth;
uniform float uSweepLobes;
uniform vec3 uColor;
uniform vec3 uBgColor;
uniform bool uLightMode;
uniform float uFalloff;
uniform float uBrightness;
uniform vec2 uMouse;
uniform float uMouseInfluence;
uniform bool uEnableMouse;

#define TAU 6.28318530718
#define PI 3.14159265359

void main() {
  vec2 st = gl_FragCoord.xy / uResolution.xy;
  st = st * 2.0 - 1.0;
  st.x *= uResolution.x / uResolution.y;

  if (uEnableMouse) {
    vec2 mShift = (uMouse * 2.0 - 1.0);
    mShift.x *= uResolution.x / uResolution.y;
    st -= mShift * uMouseInfluence;
  }

  st *= uScale;

  float dist = length(st);
  float theta = atan(st.y, st.x);
  float t = uTime * uSpeed;

  float ringPhase = dist * uRingCount - t;
  float ringDist = abs(fract(ringPhase) - 0.5);
  float ringGlow = 1.0 - smoothstep(0.0, uRingThickness, ringDist);

  float spokeAngle = abs(fract(theta * uSpokeCount / TAU + 0.5) - 0.5) * TAU / uSpokeCount;
  float arcDist = spokeAngle * dist;
  float spokeGlow = (1.0 - smoothstep(0.0, uSpokeThickness, arcDist)) * smoothstep(0.0, 0.1, dist);

  float sweepPhase = t * uSweepSpeed;
  float sweepBeam = pow(max(0.5 * sin(uSweepLobes * theta + sweepPhase) + 0.5, 0.0), uSweepWidth);

  float fade = smoothstep(1.05, 0.85, dist) * pow(max(1.0 - dist, 0.0), uFalloff);

  float intensity = max((ringGlow + spokeGlow + sweepBeam) * fade * uBrightness, 0.0);
  vec3 signal = uColor * intensity;
  vec3 col;
  if (uLightMode) {
    vec3 mapped = vec3(1.0) - exp(-max(signal, vec3(0.0)) * 1.45);
    float energy = clamp(max(mapped.r, max(mapped.g, mapped.b)), 0.0, 1.0);
    vec3 hue = mapped / max(energy, 0.0001);
    hue = pow(clamp(hue, 0.0, 1.0), vec3(1.2));
    col = mix(uBgColor, hue, smoothstep(0.015, 0.8, energy) * 0.96);
    gl_FragColor = vec4(col, 1.0);
  } else {
    col = signal + uBgColor;
    float alpha = clamp(length(col), 0.0, 1.0);
    gl_FragColor = vec4(col, alpha);
  }
}
`;

  const renderer = new Renderer({ alpha: true, premultipliedAlpha: false, dpr: getOptimizedDPR() });
  const gl = renderer.gl;
  gl.clearColor(0, 0, 0, 0);

  const canvas = gl.canvas;
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.position = 'absolute';
  canvas.style.top = '0';
  canvas.style.left = '0';
  container.appendChild(canvas);

  let currentMouse = [0.5, 0.5];
  let targetMouse = [0.5, 0.5];

  function handleMouseMove(e) {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches && e.touches[0] ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches && e.touches[0] ? e.touches[0].clientY : e.clientY;
    if (clientX === undefined || clientY === undefined) return;
    targetMouse = [
      (clientX - rect.left) / rect.width,
      1.0 - (clientY - rect.top) / rect.height
    ];
  }

  function handleMouseLeave() {
    targetMouse = [0.5, 0.5];
  }

  const geometry = new Triangle(gl);
  const program = new Program(gl, {
    vertex: vertexShader,
    fragment: fragmentShader,
    uniforms: {
      uTime: { value: 0 },
      uResolution: { value: new Float32Array([1, 1, 1]) },
      uSpeed: { value: speed },
      uScale: { value: scale },
      uRingCount: { value: ringCount },
      uSpokeCount: { value: spokeCount },
      uRingThickness: { value: ringThickness },
      uSpokeThickness: { value: spokeThickness },
      uSweepSpeed: { value: sweepSpeed },
      uSweepWidth: { value: sweepWidth },
      uSweepLobes: { value: sweepLobes },
      uColor: { value: new Float32Array(hexToVec3(color)) },
      uBgColor: { value: new Float32Array(hexToVec3(backgroundColor)) },
      uLightMode: { value: lightMode },
      uFalloff: { value: falloff },
      uBrightness: { value: brightness },
      uMouse: { value: new Float32Array([0.5, 0.5]) },
      uMouseInfluence: { value: mouseInfluence },
      uEnableMouse: { value: enableMouseInteraction }
    }
  });

  const mesh = new Mesh(gl, { geometry, program });

  function resize() {
    const w = container.clientWidth || window.innerWidth || 1;
    const h = container.clientHeight || window.innerHeight || 1;
    renderer.setSize(w, h);
    program.uniforms.uResolution.value = [gl.canvas.width, gl.canvas.height, gl.canvas.width / gl.canvas.height];
  }

  const ro = new ResizeObserver(resize);
  ro.observe(container);
  resize();

  if (enableMouseInteraction) {
    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('touchmove', handleMouseMove, { passive: true });
    window.addEventListener('touchstart', handleMouseMove, { passive: true });
    window.addEventListener('mouseleave', handleMouseLeave);
    window.addEventListener('touchend', handleMouseLeave, { passive: true });
  }

  let animationFrameId = 0;

  function update(time) {
    if (!isTabVisible) {
      animationFrameId = requestAnimationFrame(update);
      return;
    }
    animationFrameId = requestAnimationFrame(update);
    program.uniforms.uTime.value = time * 0.001;

    if (enableMouseInteraction) {
      currentMouse[0] += 0.05 * (targetMouse[0] - currentMouse[0]);
      currentMouse[1] += 0.05 * (targetMouse[1] - currentMouse[1]);
      program.uniforms.uMouse.value[0] = currentMouse[0];
      program.uniforms.uMouse.value[1] = currentMouse[1];
    } else {
      program.uniforms.uMouse.value[0] = 0.5;
      program.uniforms.uMouse.value[1] = 0.5;
    }

    renderer.render({ scene: mesh });
  }
  animationFrameId = requestAnimationFrame(update);

  return () => {
    cancelAnimationFrame(animationFrameId);
    ro.disconnect();
    if (enableMouseInteraction) {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('touchmove', handleMouseMove);
      window.removeEventListener('touchstart', handleMouseMove);
      window.removeEventListener('mouseleave', handleMouseLeave);
      window.removeEventListener('touchend', handleMouseLeave);
    }
    try { container.removeChild(canvas); } catch {}
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  };
}

// ==========================================
// 26. RIPPLE GRID INITIALIZER (React Bits / OGL)
// ==========================================
function initRippleGrid(container, opts = {}) {
  const {
    enableRainbow = false,
    gridColor = '#ffffff',
    rippleIntensity = 0.05,
    gridSize = 10.0,
    gridThickness = 15.0,
    fadeDistance = 1.5,
    vignetteStrength = 2.0,
    glowIntensity = 0.1,
    opacity = 1.0,
    gridRotation = 0,
    mouseInteraction = true,
    mouseInteractionRadius = 1.0,
    lightMode = false
  } = opts;

  const hexToRgb = hex => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '#ffffff');
    return result
      ? [parseInt(result[1], 16) / 255, parseInt(result[2], 16) / 255, parseInt(result[3], 16) / 255]
      : [1, 1, 1];
  };

  const renderer = new Renderer({
    dpr: getOptimizedDPR(),
    alpha: true
  });
  const gl = renderer.gl;
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.canvas.style.width = '100%';
  gl.canvas.style.height = '100%';
  gl.canvas.style.position = 'absolute';
  gl.canvas.style.top = '0';
  gl.canvas.style.left = '0';
  container.appendChild(gl.canvas);

  const vert = `
attribute vec2 position;
varying vec2 vUv;
void main() {
    vUv = position * 0.5 + 0.5;
    gl_Position = vec4(position, 0.0, 1.0);
}`;

  const frag = `precision highp float;
uniform float iTime;
uniform vec2 iResolution;
uniform bool enableRainbow;
uniform vec3 gridColor;
uniform float rippleIntensity;
uniform float gridSize;
uniform float gridThickness;
uniform float fadeDistance;
uniform float vignetteStrength;
uniform float glowIntensity;
uniform float opacity;
uniform float gridRotation;
uniform bool mouseInteraction;
uniform vec2 mousePosition;
uniform float mouseInfluence;
uniform float mouseInteractionRadius;
uniform bool lightMode;
varying vec2 vUv;

float pi = 3.141592;

mat2 rotate(float angle) {
    float s = sin(angle);
    float c = cos(angle);
    return mat2(c, -s, s, c);
}

void main() {
    vec2 uv = vUv * 2.0 - 1.0;
    uv.x *= iResolution.x / iResolution.y;

    if (gridRotation != 0.0) {
        uv = rotate(gridRotation * pi / 180.0) * uv;
    }

    float dist = length(uv);
    float func = sin(pi * (iTime - dist));
    vec2 rippleUv = uv + uv * func * rippleIntensity;

    if (mouseInteraction && mouseInfluence > 0.0) {
        vec2 mouseUv = (mousePosition * 2.0 - 1.0);
        mouseUv.x *= iResolution.x / iResolution.y;
        float mouseDist = length(uv - mouseUv);
        
        float influence = mouseInfluence * exp(-mouseDist * mouseDist / (mouseInteractionRadius * mouseInteractionRadius));
        
        float mouseWave = sin(pi * (iTime * 2.0 - mouseDist * 3.0)) * influence;
        rippleUv += normalize(uv - mouseUv) * mouseWave * rippleIntensity * 0.3;
    }

    vec2 a = sin(gridSize * 0.5 * pi * rippleUv - pi / 2.0);
    vec2 b = abs(a);

    float aaWidth = 0.5;
    vec2 smoothB = vec2(
        smoothstep(0.0, aaWidth, b.x),
        smoothstep(0.0, aaWidth, b.y)
    );

    vec3 color = vec3(0.0);
    color += exp(-gridThickness * smoothB.x * (0.8 + 0.5 * sin(pi * iTime)));
    color += exp(-gridThickness * smoothB.y);
    color += 0.5 * exp(-(gridThickness / 4.0) * sin(smoothB.x));
    color += 0.5 * exp(-(gridThickness / 3.0) * smoothB.y);

    if (glowIntensity > 0.0) {
        color += glowIntensity * exp(-gridThickness * 0.5 * smoothB.x);
        color += glowIntensity * exp(-gridThickness * 0.5 * smoothB.y);
    }

    float ddd = exp(-2.0 * clamp(pow(dist, fadeDistance), 0.0, 1.0));
    
    vec2 vignetteCoords = vUv - 0.5;
    float vignetteDistance = length(vignetteCoords);
    float vignette = 1.0 - pow(vignetteDistance * 2.0, vignetteStrength);
    vignette = clamp(vignette, 0.0, 1.0);
    
    vec3 t;
    if (enableRainbow) {
        t = vec3(
            uv.x * 0.5 + 0.5 * sin(iTime),
            uv.y * 0.5 + 0.5 * cos(iTime),
            pow(cos(iTime), 4.0)
        ) + 0.5;
    } else {
        t = gridColor;
    }

    float finalFade = ddd * vignette;
    float alpha = length(color) * finalFade * opacity;
    vec3 effect = color * t * finalFade * opacity;
    if (lightMode) {
        float peak = max(effect.r, max(effect.g, effect.b));
        vec3 chroma = pow(clamp(effect / max(peak, 0.0001), 0.0, 1.0), vec3(1.2));
        gl_FragColor = vec4(mix(vec3(1.0), chroma, clamp(alpha * 0.94, 0.0, 0.94)), 1.0);
    } else {
        gl_FragColor = vec4(effect, alpha);
    }
}`;

  const uniforms = {
    iTime: { value: 0 },
    iResolution: { value: [1, 1] },
    enableRainbow: { value: enableRainbow },
    gridColor: { value: hexToRgb(gridColor) },
    rippleIntensity: { value: rippleIntensity },
    gridSize: { value: gridSize },
    gridThickness: { value: gridThickness },
    fadeDistance: { value: fadeDistance },
    vignetteStrength: { value: vignetteStrength },
    glowIntensity: { value: glowIntensity },
    opacity: { value: opacity },
    gridRotation: { value: gridRotation },
    mouseInteraction: { value: mouseInteraction },
    mousePosition: { value: [0.5, 0.5] },
    mouseInfluence: { value: 0 },
    mouseInteractionRadius: { value: mouseInteractionRadius },
    lightMode: { value: lightMode }
  };

  const geometry = new Triangle(gl);
  const program = new Program(gl, { vertex: vert, fragment: frag, uniforms });
  const mesh = new Mesh(gl, { geometry, program });

  const targetMouse = { x: 0.5, y: 0.5 };
  const currentMouse = { x: 0.5, y: 0.5 };
  let targetInfluence = 0;

  const resize = () => {
    const w = container.clientWidth || window.innerWidth || 1;
    const h = container.clientHeight || window.innerHeight || 1;
    renderer.setSize(w, h);
    uniforms.iResolution.value = [w, h];
  };

  const handleMouseMove = e => {
    if (!mouseInteraction) return;
    const rect = container.getBoundingClientRect();
    const clientX = e.touches && e.touches[0] ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches && e.touches[0] ? e.touches[0].clientY : e.clientY;
    if (clientX === undefined || clientY === undefined) return;
    targetMouse.x = (clientX - rect.left) / rect.width;
    targetMouse.y = 1.0 - (clientY - rect.top) / rect.height;
    targetInfluence = 1.0;
  };

  const handleMouseEnter = () => {
    if (!mouseInteraction) return;
    targetInfluence = 1.0;
  };

  const handleMouseLeave = () => {
    if (!mouseInteraction) return;
    targetInfluence = 0.0;
  };

  const ro = new ResizeObserver(resize);
  ro.observe(container);
  resize();

  if (mouseInteraction) {
    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('touchmove', handleMouseMove, { passive: true });
    window.addEventListener('touchstart', handleMouseMove, { passive: true });
    container.addEventListener('mouseenter', handleMouseEnter);
    container.addEventListener('mouseleave', handleMouseLeave);
    container.addEventListener('touchend', handleMouseLeave, { passive: true });
  }

  let animationFrameId = 0;
  const render = t => {
    if (!isTabVisible) {
      animationFrameId = requestAnimationFrame(render);
      return;
    }
    animationFrameId = requestAnimationFrame(render);
    uniforms.iTime.value = t * 0.001;

    const lerpFactor = 0.1;
    currentMouse.x += (targetMouse.x - currentMouse.x) * lerpFactor;
    currentMouse.y += (targetMouse.y - currentMouse.y) * lerpFactor;

    uniforms.mouseInfluence.value += (targetInfluence - uniforms.mouseInfluence.value) * 0.05;
    uniforms.mousePosition.value = [currentMouse.x, currentMouse.y];

    renderer.render({ scene: mesh });
  };
  animationFrameId = requestAnimationFrame(render);

  return () => {
    cancelAnimationFrame(animationFrameId);
    ro.disconnect();
    if (mouseInteraction) {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('touchmove', handleMouseMove);
      window.removeEventListener('touchstart', handleMouseMove);
      container.removeEventListener('mouseenter', handleMouseEnter);
      container.removeEventListener('mouseleave', handleMouseLeave);
      container.removeEventListener('touchend', handleMouseLeave);
    }
    try { container.removeChild(gl.canvas); } catch {}
    renderer.gl.getExtension('WEBGL_lose_context')?.loseContext();
  };
}

// ==========================================
// 27. PIXEL BLAST INITIALIZER (React Bits / Three.js)
// ==========================================
function initPixelBlast(container, opts = {}) {
  const THREE_LIB = typeof THREE !== 'undefined' ? THREE : (typeof window !== 'undefined' ? window.THREE : null);
  if (!THREE_LIB) {
    console.warn('Three.js não encontrado para PixelBlast');
    return () => {};
  }

  const {
    variant = 'circle',
    pixelSize = 4,
    color = '#B497CF',
    patternScale = 2.5,
    patternDensity = 1.1,
    pixelSizeJitter = 0.2,
    enableRipples = true,
    rippleSpeed = 0.4,
    rippleThickness = 0.12,
    rippleIntensityScale = 1.5,
    speed = 0.5,
    edgeFade = 0.25,
    transparent = true
  } = opts;

  const SHAPE_MAP = {
    square: 0,
    circle: 1,
    triangle: 2,
    diamond: 3
  };

  const MAX_CLICKS = 10;

  const VERTEX_SRC = `
void main() {
  gl_Position = vec4(position, 1.0);
}
`;

  const FRAGMENT_SRC = `
precision highp float;

uniform vec3  uColor;
uniform vec2  uResolution;
uniform float uTime;
uniform float uPixelSize;
uniform float uScale;
uniform float uDensity;
uniform float uPixelJitter;
uniform int   uEnableRipples;
uniform float uRippleSpeed;
uniform float uRippleThickness;
uniform float uRippleIntensity;
uniform float uEdgeFade;
uniform int   uShapeType;

const int SHAPE_SQUARE   = 0;
const int SHAPE_CIRCLE   = 1;
const int SHAPE_TRIANGLE = 2;
const int SHAPE_DIAMOND  = 3;

const int   MAX_CLICKS = 10;

uniform vec2  uClickPos  [MAX_CLICKS];
uniform float uClickTimes[MAX_CLICKS];

float Bayer2(vec2 a) {
  a = floor(a);
  return fract(a.x / 2. + a.y * a.y * .75);
}
#define Bayer4(a) (Bayer2(.5*(a))*0.25 + Bayer2(a))
#define Bayer8(a) (Bayer4(.5*(a))*0.25 + Bayer2(a))

#define FBM_OCTAVES     5
#define FBM_LACUNARITY  1.25
#define FBM_GAIN        1.0

float hash11(float n){ return fract(sin(n)*43758.5453); }

float vnoise(vec3 p){
  vec3 ip = floor(p);
  vec3 fp = fract(p);
  float n000 = hash11(dot(ip + vec3(0.0,0.0,0.0), vec3(1.0,57.0,113.0)));
  float n100 = hash11(dot(ip + vec3(1.0,0.0,0.0), vec3(1.0,57.0,113.0)));
  float n010 = hash11(dot(ip + vec3(0.0,1.0,0.0), vec3(1.0,57.0,113.0)));
  float n110 = hash11(dot(ip + vec3(1.0,1.0,0.0), vec3(1.0,57.0,113.0)));
  float n001 = hash11(dot(ip + vec3(0.0,0.0,1.0), vec3(1.0,57.0,113.0)));
  float n101 = hash11(dot(ip + vec3(1.0,0.0,1.0), vec3(1.0,57.0,113.0)));
  float n011 = hash11(dot(ip + vec3(0.0,1.0,1.0), vec3(1.0,57.0,113.0)));
  float n111 = hash11(dot(ip + vec3(1.0,1.0,1.0), vec3(1.0,57.0,113.0)));
  vec3 w = fp*fp*fp*(fp*(fp*6.0-15.0)+10.0);
  float x00 = mix(n000, n100, w.x);
  float x10 = mix(n010, n110, w.x);
  float x01 = mix(n001, n101, w.x);
  float x11 = mix(n011, n111, w.x);
  float y0  = mix(x00, x10, w.y);
  float y1  = mix(x01, x11, w.y);
  return mix(y0, y1, w.z) * 2.0 - 1.0;
}

float fbm2(vec2 uv, float t){
  vec3 p = vec3(uv * uScale, t);
  float amp = 1.0;
  float freq = 1.0;
  float sum = 1.0;
  for (int i = 0; i < FBM_OCTAVES; ++i){
    sum  += amp * vnoise(p * freq);
    freq *= FBM_LACUNARITY;
    amp  *= FBM_GAIN;
  }
  return sum * 0.5 + 0.5;
}

float maskCircle(vec2 p, float cov){
  float r = sqrt(cov) * .25;
  float d = length(p - 0.5) - r;
  float aa = 0.5 * fwidth(d);
  return cov * (1.0 - smoothstep(-aa, aa, d * 2.0));
}

float maskTriangle(vec2 p, vec2 id, float cov){
  bool flip = mod(id.x + id.y, 2.0) > 0.5;
  if (flip) p.x = 1.0 - p.x;
  float r = sqrt(cov);
  float d  = p.y - r*(1.0 - p.x);
  float aa = fwidth(d);
  return cov * clamp(0.5 - d/aa, 0.0, 1.0);
}

float maskDiamond(vec2 p, float cov){
  float r = sqrt(cov) * 0.564;
  return step(abs(p.x - 0.49) + abs(p.y - 0.49), r);
}

void main(){
  float pixelSize = uPixelSize;
  vec2 fragCoord = gl_FragCoord.xy - uResolution * .5;
  float aspectRatio = uResolution.x / uResolution.y;

  vec2 pixelId = floor(fragCoord / pixelSize);
  vec2 pixelUV = fract(fragCoord / pixelSize);

  float cellPixelSize = 8.0 * pixelSize;
  vec2 cellId = floor(fragCoord / cellPixelSize);
  vec2 cellCoord = cellId * cellPixelSize;
  vec2 uv = cellCoord / uResolution * vec2(aspectRatio, 1.0);

  float base = fbm2(uv, uTime * 0.05);
  base = base * 0.5 - 0.65;

  float feed = base + (uDensity - 0.5) * 0.3;

  float spd       = uRippleSpeed;
  float thickness = uRippleThickness;
  const float dampT     = 1.0;
  const float dampR     = 10.0;

  if (uEnableRipples == 1) {
    for (int i = 0; i < MAX_CLICKS; ++i){
      vec2 pos = uClickPos[i];
      if (pos.x < 0.0) continue;
      float cellPixelSize = 8.0 * pixelSize;
      vec2 cuv = (((pos - uResolution * .5 - cellPixelSize * .5) / (uResolution))) * vec2(aspectRatio, 1.0);
      float t = max(uTime - uClickTimes[i], 0.0);
      float r = distance(uv, cuv);
      float waveR = spd * t;
      float ring  = exp(-pow((r - waveR) / thickness, 2.0));
      float atten = exp(-dampT * t) * exp(-dampR * r);
      feed = max(feed, ring * atten * uRippleIntensity);
    }
  }

  float bayer = Bayer8(fragCoord / uPixelSize) - 0.5;
  float bw = step(0.5, feed + bayer);

  float h = fract(sin(dot(floor(fragCoord / uPixelSize), vec2(127.1, 311.7))) * 43758.5453);
  float jitterScale = 1.0 + (h - 0.5) * uPixelJitter;
  float coverage = bw * jitterScale;
  float M;
  if      (uShapeType == SHAPE_CIRCLE)   M = maskCircle (pixelUV, coverage);
  else if (uShapeType == SHAPE_TRIANGLE) M = maskTriangle(pixelUV, pixelId, coverage);
  else if (uShapeType == SHAPE_DIAMOND)  M = maskDiamond(pixelUV, coverage);
  else                                   M = coverage;

  if (uEdgeFade > 0.0) {
    vec2 norm = gl_FragCoord.xy / uResolution;
    float edge = min(min(norm.x, norm.y), min(1.0 - norm.x, 1.0 - norm.y));
    float fade = smoothstep(0.0, uEdgeFade, edge);
    M *= fade;
  }

  vec3 col = uColor;

  vec3 srgbColor = mix(
    col * 12.92,
    1.055 * pow(col, vec3(1.0 / 2.4)) - 0.055,
    step(0.0031308, col)
  );

  gl_FragColor = vec4(srgbColor, M);
}
`;

  const renderer = new THREE_LIB.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: 'low-power'
  });
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
  renderer.domElement.style.position = 'absolute';
  renderer.domElement.style.top = '0';
  renderer.domElement.style.left = '0';
  renderer.setPixelRatio(getOptimizedDPR());
  container.appendChild(renderer.domElement);

  if (transparent) renderer.setClearAlpha(0);
  else renderer.setClearColor(0x000000, 1);

  const uniforms = {
    uResolution: { value: new THREE_LIB.Vector2(0, 0) },
    uTime: { value: 0 },
    uColor: { value: new THREE_LIB.Color(color) },
    uClickPos: {
      value: Array.from({ length: MAX_CLICKS }, () => new THREE_LIB.Vector2(-1, -1))
    },
    uClickTimes: { value: new Float32Array(MAX_CLICKS) },
    uShapeType: { value: SHAPE_MAP[variant] ?? 1 },
    uPixelSize: { value: pixelSize * renderer.getPixelRatio() },
    uScale: { value: patternScale },
    uDensity: { value: patternDensity },
    uPixelJitter: { value: pixelSizeJitter },
    uEnableRipples: { value: enableRipples ? 1 : 0 },
    uRippleSpeed: { value: rippleSpeed },
    uRippleThickness: { value: rippleThickness },
    uRippleIntensity: { value: rippleIntensityScale },
    uEdgeFade: { value: edgeFade }
  };

  const scene = new THREE_LIB.Scene();
  const camera = new THREE_LIB.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const material = new THREE_LIB.ShaderMaterial({
    vertexShader: VERTEX_SRC,
    fragmentShader: FRAGMENT_SRC,
    uniforms,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    extensions: { derivatives: true }
  });

  const quadGeom = new THREE_LIB.PlaneGeometry(2, 2);
  const quad = new THREE_LIB.Mesh(quadGeom, material);
  scene.add(quad);

  const clock = new THREE_LIB.Clock();
  let clickIx = 0;

  const setSize = () => {
    const w = container.clientWidth || window.innerWidth || 1;
    const h = container.clientHeight || window.innerHeight || 1;
    renderer.setSize(w, h, false);
    uniforms.uResolution.value.set(renderer.domElement.width, renderer.domElement.height);
    uniforms.uPixelSize.value = pixelSize * renderer.getPixelRatio();
  };
  setSize();
  const ro = new ResizeObserver(setSize);
  ro.observe(container);

  const mapToPixels = e => {
    const rect = renderer.domElement.getBoundingClientRect();
    const scaleX = renderer.domElement.width / rect.width;
    const scaleY = renderer.domElement.height / rect.height;
    const fx = (e.clientX - rect.left) * scaleX;
    const fy = (rect.height - (e.clientY - rect.top)) * scaleY;
    return { fx, fy };
  };

  const onPointerDown = e => {
    const { fx, fy } = mapToPixels(e);
    uniforms.uClickPos.value[clickIx].set(fx, fy);
    uniforms.uClickTimes.value[clickIx] = uniforms.uTime.value;
    clickIx = (clickIx + 1) % MAX_CLICKS;
  };

  window.addEventListener('pointerdown', onPointerDown, { passive: true });

  let raf = 0;
  const loop = () => {
    if (!isTabVisible) {
      raf = requestAnimationFrame(loop);
      return;
    }
    raf = requestAnimationFrame(loop);
    uniforms.uTime.value = clock.getElapsedTime() * speed;
    renderer.render(scene, camera);
  };
  raf = requestAnimationFrame(loop);

  return () => {
    cancelAnimationFrame(raf);
    ro.disconnect();
    window.removeEventListener('pointerdown', onPointerDown);
    try { container.removeChild(renderer.domElement); } catch {}
    quadGeom.dispose();
    material.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
  };
}

// ==========================================
// 28. MAGIC RINGS INITIALIZER (React Bits / Three.js)
// ==========================================
function initMagicRings(container, opts = {}) {
  const THREE_LIB = typeof THREE !== 'undefined' ? THREE : (typeof window !== 'undefined' ? window.THREE : null);
  if (!THREE_LIB) {
    console.warn('Three.js não encontrado para MagicRings');
    return () => {};
  }

  const {
    color = '#fc42ff',
    colorTwo = '#42fcff',
    speed = 1,
    ringCount = 6,
    attenuation = 10,
    lineThickness = 2,
    baseRadius = 0.35,
    radiusStep = 0.1,
    scaleRate = 0.1,
    opacity = 1,
    noiseAmount = 0.1,
    rotation = 0,
    ringGap = 1.5,
    fadeIn = 0.7,
    fadeOut = 0.5,
    followMouse = true,
    mouseInfluence = 0.2,
    hoverScale = 1.1,
    parallax = 0.05,
    clickBurst = true,
    alphaMode = 'luminance'
  } = opts;

  const vertexShader = `
void main() {
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

  const fragmentShader = `
precision highp float;

uniform float uTime, uAttenuation, uLineThickness;
uniform float uBaseRadius, uRadiusStep, uScaleRate;
uniform float uOpacity, uNoiseAmount, uRotation, uRingGap;
uniform float uFadeIn, uFadeOut;
uniform float uMouseInfluence, uHoverAmount, uHoverScale, uParallax, uBurst;
uniform float uCoverageAlpha;
uniform vec2 uResolution, uMouse;
uniform vec3 uColor, uColorTwo;
uniform int uRingCount;

const float HP = 1.5707963;
const float CYCLE = 3.45;

float fade(float t) {
  return t < uFadeIn ? smoothstep(0.0, uFadeIn, t) : 1.0 - smoothstep(uFadeOut, CYCLE - 0.2, t);
}

float ring(vec2 p, float ri, float cut, float t0, float px) {
  float t = mod(uTime + t0, CYCLE);
  float r = ri + t / CYCLE * uScaleRate;
  float d = abs(length(p) - r);
  float a = atan(abs(p.y), abs(p.x)) / HP;
  float th = max(1.0 - a, 0.5) * px * uLineThickness;
  float h = (1.0 - smoothstep(th, th * 1.5, d)) + 1.0;
  d += pow(cut * a, 3.0) * r;
  return h * exp(-uAttenuation * d) * fade(t);
}

void main() {
  float px = 1.0 / min(uResolution.x, uResolution.y);
  vec2 p = (gl_FragCoord.xy - 0.5 * uResolution.xy) * px;
  float cr = cos(uRotation), sr = sin(uRotation);
  p = mat2(cr, -sr, sr, cr) * p;
  p -= uMouse * uMouseInfluence;
  float sc = mix(1.0, uHoverScale, uHoverAmount) + uBurst * 0.3;
  p /= sc;
  vec3 c = vec3(0.0);
  float coverage = 0.0;
  float rcf = max(float(uRingCount) - 1.0, 1.0);
  for (int i = 0; i < 10; i++) {
    if (i >= uRingCount) break;
    float fi = float(i);
    vec2 pr = p - fi * uParallax * uMouse;
    vec3 rc = mix(uColor, uColorTwo, fi / rcf);
    float ringAmount = ring(pr, uBaseRadius + fi * uRadiusStep, pow(uRingGap, fi), i == 0 ? 0.0 : 2.95 * fi, px);
    c = mix(c, rc, vec3(ringAmount));
    coverage = max(coverage, ringAmount);
  }
  c *= 1.0 + uBurst * 2.0;
  float n = fract(sin(dot(gl_FragCoord.xy + uTime * 100.0, vec2(12.9898, 78.233))) * 43758.5453);
  c += (n - 0.5) * uNoiseAmount;
  float intensity = max(c.r, max(c.g, c.b));
  vec3 emissiveColor = intensity > 0.0001 ? clamp(c / intensity, 0.0, 1.0) : vec3(0.0);
  vec3 outputColor = mix(emissiveColor, clamp(c, 0.0, 1.0), uCoverageAlpha);
  float outputAlpha = mix(intensity, coverage, uCoverageAlpha);
  gl_FragColor = vec4(outputColor, clamp(outputAlpha * uOpacity, 0.0, 1.0));
}
`;

  const renderer = new THREE_LIB.WebGLRenderer({ alpha: true });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(getOptimizedDPR());
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
  renderer.domElement.style.position = 'absolute';
  renderer.domElement.style.top = '0';
  renderer.domElement.style.left = '0';
  container.appendChild(renderer.domElement);

  const scene = new THREE_LIB.Scene();
  const camera = new THREE_LIB.OrthographicCamera(-0.5, 0.5, 0.5, -0.5, 0.1, 10);
  camera.position.z = 1;

  const uniforms = {
    uTime: { value: 0 },
    uAttenuation: { value: attenuation },
    uResolution: { value: new THREE_LIB.Vector2() },
    uColor: { value: new THREE_LIB.Color(color) },
    uColorTwo: { value: new THREE_LIB.Color(colorTwo) },
    uLineThickness: { value: lineThickness },
    uBaseRadius: { value: baseRadius },
    uRadiusStep: { value: radiusStep },
    uScaleRate: { value: scaleRate },
    uRingCount: { value: ringCount },
    uOpacity: { value: opacity },
    uNoiseAmount: { value: noiseAmount },
    uRotation: { value: (rotation * Math.PI) / 180 },
    uRingGap: { value: ringGap },
    uFadeIn: { value: fadeIn },
    uFadeOut: { value: fadeOut },
    uMouse: { value: new THREE_LIB.Vector2() },
    uMouseInfluence: { value: followMouse ? mouseInfluence : 0 },
    uHoverAmount: { value: 0 },
    uHoverScale: { value: hoverScale },
    uParallax: { value: parallax },
    uBurst: { value: 0 },
    uCoverageAlpha: { value: alphaMode === 'coverage' ? 1 : 0 },
  };

  const material = new THREE_LIB.ShaderMaterial({ vertexShader, fragmentShader, uniforms, transparent: true });
  const quad = new THREE_LIB.Mesh(new THREE_LIB.PlaneGeometry(1, 1), material);
  scene.add(quad);

  const resize = () => {
    const w = container.clientWidth || window.innerWidth || 1;
    const h = container.clientHeight || window.innerHeight || 1;
    const dpr = getOptimizedDPR();
    renderer.setSize(w, h);
    uniforms.uResolution.value.set(w * dpr, h * dpr);
  };
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(container);

  const mouse = [0, 0];
  const smoothMouse = [0, 0];
  let hoverAmount = 0;
  let isHovered = false;
  let burst = 0;

  const onMouseMove = (e) => {
    const rect = container.getBoundingClientRect();
    const clientX = e.touches && e.touches[0] ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches && e.touches[0] ? e.touches[0].clientY : e.clientY;
    if (clientX === undefined || clientY === undefined) return;
    mouse[0] = (clientX - rect.left) / rect.width - 0.5;
    mouse[1] = -((clientY - rect.top) / rect.height - 0.5);
    isHovered = true;
  };
  const onMouseLeave = () => {
    isHovered = false;
    mouse[0] = 0;
    mouse[1] = 0;
  };
  const onClick = () => { if (clickBurst) burst = 1.0; };

  window.addEventListener('mousemove', onMouseMove, { passive: true });
  window.addEventListener('touchmove', onMouseMove, { passive: true });
  window.addEventListener('touchstart', onMouseMove, { passive: true });
  container.addEventListener('mouseleave', onMouseLeave);
  container.addEventListener('touchend', onMouseLeave, { passive: true });
  window.addEventListener('click', onClick);
  window.addEventListener('touchend', onClick, { passive: true });

  let frameId = 0;
  let elapsed = 0;
  let lastT = performance.now();

  const animate = (t) => {
    if (!isTabVisible) {
      frameId = requestAnimationFrame(animate);
      return;
    }
    frameId = requestAnimationFrame(animate);

    const dt = Math.min(t - lastT, 100);
    lastT = t;
    elapsed += dt * 0.001 * speed;

    smoothMouse[0] += (mouse[0] - smoothMouse[0]) * 0.08;
    smoothMouse[1] += (mouse[1] - smoothMouse[1]) * 0.08;
    hoverAmount += ((isHovered ? 1 : 0) - hoverAmount) * 0.08;
    burst *= 0.95;
    if (burst < 0.001) burst = 0;

    uniforms.uTime.value = elapsed;
    uniforms.uMouse.value.set(smoothMouse[0], smoothMouse[1]);
    uniforms.uHoverAmount.value = hoverAmount;
    uniforms.uBurst.value = burst;

    renderer.render(scene, camera);
  };
  frameId = requestAnimationFrame(animate);

  return () => {
    cancelAnimationFrame(frameId);
    ro.disconnect();
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('touchmove', onMouseMove);
    window.removeEventListener('touchstart', onMouseMove);
    container.removeEventListener('mouseleave', onMouseLeave);
    container.removeEventListener('touchend', onMouseLeave);
    window.removeEventListener('click', onClick);
    window.removeEventListener('touchend', onClick);
    try { container.removeChild(renderer.domElement); } catch {}
    renderer.dispose();
    material.dispose();
  };
}

// ==========================================
// 29. GRID SCAN INITIALIZER (React Bits / Three.js)
// ==========================================
function initGridScan(container, opts = {}) {
  const THREE_LIB = typeof THREE !== 'undefined' ? THREE : (typeof window !== 'undefined' ? window.THREE : null);
  if (!THREE_LIB) {
    console.warn('Three.js não encontrado para GridScan');
    return () => {};
  }

  const {
    sensitivity = 0.55,
    lineThickness = 1,
    linesColor = '#2F293A',
    scanColor = '#FF9FFC',
    scanOpacity = 0.4,
    gridScale = 0.1,
    lineStyle = 'solid',
    lineJitter = 0.1,
    scanDirection = 'pingpong',
    bloomIntensity = 0.6,
    noiseIntensity = 0.01,
    scanGlow = 0.5,
    scanSoftness = 2,
    scanPhaseTaper = 0.9,
    scanDuration = 2.0,
    scanDelay = 2.0,
    scanOnClick = true,
    lightMode = false
  } = opts;

  function srgbColor(hex) {
    const c = new THREE_LIB.Color(hex);
    return c.convertSRGBToLinear();
  }

  function smoothDampVec2(current, target, currentVelocity, smoothTime, maxSpeed, deltaTime) {
    const out = current.clone();
    smoothTime = Math.max(0.0001, smoothTime);
    const omega = 2 / smoothTime;
    const x = omega * deltaTime;
    const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);

    let change = current.clone().sub(target);
    const originalTo = target.clone();

    const maxChange = maxSpeed * smoothTime;
    if (change.length() > maxChange) change.setLength(maxChange);

    target = current.clone().sub(change);
    const temp = currentVelocity.clone().addScaledVector(change, omega).multiplyScalar(deltaTime);
    currentVelocity.sub(temp.clone().multiplyScalar(omega));
    currentVelocity.multiplyScalar(exp);

    out.copy(target.clone().add(change.add(temp).multiplyScalar(exp)));

    const origMinusCurrent = originalTo.clone().sub(current);
    const outMinusOrig = out.clone().sub(originalTo);
    if (origMinusCurrent.dot(outMinusOrig) > 0) {
      out.copy(originalTo);
      currentVelocity.set(0, 0);
    }
    return out;
  }

  const vert = `
varying vec2 vUv;
void main(){
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

  const frag = `
precision highp float;
uniform vec3 iResolution;
uniform float iTime;
uniform vec2 uSkew;
uniform float uTilt;
uniform float uYaw;
uniform float uLineThickness;
uniform vec3 uLinesColor;
uniform vec3 uScanColor;
uniform float uGridScale;
uniform float uLineStyle;
uniform float uLineJitter;
uniform float uScanOpacity;
uniform float uScanDirection;
uniform float uNoise;
uniform float uBloomOpacity;
uniform float uScanGlow;
uniform float uScanSoftness;
uniform float uPhaseTaper;
uniform float uScanDuration;
uniform float uScanDelay;
uniform float uLightMode;
varying vec2 vUv;

uniform float uScanStarts[8];
uniform float uScanCount;

const int MAX_SCANS = 8;

float smoother01(float a, float b, float x){
  float t = clamp((x - a) / max(1e-5, (b - a)), 0.0, 1.0);
  return t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord)
{
    vec2 p = (2.0 * fragCoord - iResolution.xy) / iResolution.y;

    vec3 ro = vec3(0.0);
    vec3 rd = normalize(vec3(p, 2.0));

    float cR = cos(uTilt), sR = sin(uTilt);
    rd.xy = mat2(cR, -sR, sR, cR) * rd.xy;

    float cY = cos(uYaw), sY = sin(uYaw);
    rd.xz = mat2(cY, -sY, sY, cY) * rd.xz;

    vec2 skew = clamp(uSkew, vec2(-0.7), vec2(0.7));
    rd.xy += skew * rd.z;

    vec3 color = vec3(0.0);
    float minT = 1e20;
    float gridScale = max(1e-5, uGridScale);
    float fadeStrength = 2.0;
    vec2 gridUV = vec2(0.0);

    float hitIsY = 1.0;
    for (int i = 0; i < 4; i++)
    {
        float isY = float(i < 2);
        float pos = mix(-0.2, 0.2, float(i)) * isY + mix(-0.5, 0.5, float(i - 2)) * (1.0 - isY);
        float num = pos - (isY * ro.y + (1.0 - isY) * ro.x);
        float den = isY * rd.y + (1.0 - isY) * rd.x;
        float t = num / den;
        vec3 h = ro + rd * t;

        float depthBoost = smoothstep(0.0, 3.0, h.z);
        h.xy += skew * 0.15 * depthBoost;

        bool use = t > 0.0 && t < minT;
        gridUV = use ? mix(h.zy, h.xz, isY) / gridScale : gridUV;
        minT = use ? t : minT;
        hitIsY = use ? isY : hitIsY;
    }

    vec3 hit = ro + rd * minT;
    float dist = length(hit - ro);

    float jitterAmt = clamp(uLineJitter, 0.0, 1.0);
    if (jitterAmt > 0.0) {
      vec2 j = vec2(
        sin(gridUV.y * 2.7 + iTime * 1.8),
        cos(gridUV.x * 2.3 - iTime * 1.6)
      ) * (0.15 * jitterAmt);
      gridUV += j;
    }
    float fx = fract(gridUV.x);
    float fy = fract(gridUV.y);
    float ax = min(fx, 1.0 - fx);
    float ay = min(fy, 1.0 - fy);
    float wx = fwidth(gridUV.x);
    float wy = fwidth(gridUV.y);
    float halfPx = max(0.0, uLineThickness) * 0.5;

    float tx = halfPx * wx;
    float ty = halfPx * wy;

    float aax = wx;
    float aay = wy;

    float lineX = 1.0 - smoothstep(tx, tx + aax, ax);
    float lineY = 1.0 - smoothstep(ty, ty + aay, ay);
    if (uLineStyle > 0.5) {
      float dashRepeat = 4.0;
      float dashDuty = 0.5;
      float vy = fract(gridUV.y * dashRepeat);
      float vx = fract(gridUV.x * dashRepeat);
      float dashMaskY = step(vy, dashDuty);
      float dashMaskX = step(vx, dashDuty);
      if (uLineStyle < 1.5) {
        lineX *= dashMaskY;
        lineY *= dashMaskX;
      } else {
        float dotRepeat = 6.0;
        float dotWidth = 0.18;
        float cy = abs(fract(gridUV.y * dotRepeat) - 0.5);
        float cx = abs(fract(gridUV.x * dotRepeat) - 0.5);
        float dotMaskY = 1.0 - smoothstep(dotWidth, dotWidth + fwidth(gridUV.y * dotRepeat), cy);
        float dotMaskX = 1.0 - smoothstep(dotWidth, dotWidth + fwidth(gridUV.x * dotRepeat), cx);
        lineX *= dotMaskY;
        lineY *= dotMaskX;
      }
    }
    float primaryMask = max(lineX, lineY);

    vec2 gridUV2 = (hitIsY > 0.5 ? hit.xz : hit.zy) / gridScale;
    if (jitterAmt > 0.0) {
      vec2 j2 = vec2(
        cos(gridUV2.y * 2.1 - iTime * 1.4),
        sin(gridUV2.x * 2.5 + iTime * 1.7)
      ) * (0.15 * jitterAmt);
      gridUV2 += j2;
    }
    float fx2 = fract(gridUV2.x);
    float fy2 = fract(gridUV2.y);
    float ax2 = min(fx2, 1.0 - fx2);
    float ay2 = min(fy2, 1.0 - fy2);
    float wx2 = fwidth(gridUV2.x);
    float wy2 = fwidth(gridUV2.y);
    float tx2 = halfPx * wx2;
    float ty2 = halfPx * wy2;
    float aax2 = wx2;
    float aay2 = wy2;
    float lineX2 = 1.0 - smoothstep(tx2, tx2 + aax2, ax2);
    float lineY2 = 1.0 - smoothstep(ty2, ty2 + aay2, ay2);
    if (uLineStyle > 0.5) {
      float dashRepeat2 = 4.0;
      float dashDuty2 = 0.5;
      float vy2m = fract(gridUV2.y * dashRepeat2);
      float vx2m = fract(gridUV2.x * dashRepeat2);
      float dashMaskY2 = step(vy2m, dashDuty2);
      float dashMaskX2 = step(vx2m, dashDuty2);
      if (uLineStyle < 1.5) {
        lineX2 *= dashMaskY2;
        lineY2 *= dashMaskX2;
      } else {
        float dotRepeat2 = 6.0;
        float dotWidth2 = 0.18;
        float cy2 = abs(fract(gridUV2.y * dotRepeat2) - 0.5);
        float cx2 = abs(fract(gridUV2.x * dotRepeat2) - 0.5);
        float dotMaskY2 = 1.0 - smoothstep(dotWidth2, dotWidth2 + fwidth(gridUV2.y * dotRepeat2), cy2);
        float dotMaskX2 = 1.0 - smoothstep(dotWidth2, dotWidth2 + fwidth(gridUV2.x * dotRepeat2), cx2);
        lineX2 *= dotMaskY2;
        lineY2 *= dotMaskX2;
      }
    }
    float altMask = max(lineX2, lineY2);

    float edgeDistX = min(abs(hit.x - (-0.5)), abs(hit.x - 0.5));
    float edgeDistY = min(abs(hit.y - (-0.2)), abs(hit.y - 0.2));
    float edgeDist = mix(edgeDistY, edgeDistX, hitIsY);
    float edgeGate = 1.0 - smoothstep(gridScale * 0.5, gridScale * 2.0, edgeDist);
    altMask *= edgeGate;

    float lineMask = max(primaryMask, altMask);

    float fade = exp(-dist * fadeStrength);

    float dur = max(0.05, uScanDuration);
    float del = max(0.0, uScanDelay);
    float scanZMax = 2.0;
    float widthScale = max(0.1, uScanGlow);
    float sigma = max(0.001, 0.18 * widthScale * uScanSoftness);
    float sigmaA = sigma * 2.0;

    float combinedPulse = 0.0;
    float combinedAura = 0.0;

    float cycle = dur + del;
    float tCycle = mod(iTime, cycle);
    float scanPhase = clamp((tCycle - del) / dur, 0.0, 1.0);
    float phase = scanPhase;
    if (uScanDirection > 0.5 && uScanDirection < 1.5) {
      phase = 1.0 - phase;
    } else if (uScanDirection > 1.5) {
      float t2 = mod(max(0.0, iTime - del), 2.0 * dur);
      phase = (t2 < dur) ? (t2 / dur) : (1.0 - (t2 - dur) / dur);
    }
    float scanZ = phase * scanZMax;
    float dz = abs(hit.z - scanZ);
    float lineBand = exp(-0.5 * (dz * dz) / (sigma * sigma));
    float taper = clamp(uPhaseTaper, 0.0, 0.49);
    float headW = taper;
    float tailW = taper;
    float headFade = smoother01(0.0, headW, phase);
    float tailFade = 1.0 - smoother01(1.0 - tailW, 1.0, phase);
    float phaseWindow = headFade * tailFade;
    float pulseBase = lineBand * phaseWindow;
    combinedPulse += pulseBase * clamp(uScanOpacity, 0.0, 1.0);
    float auraBand = exp(-0.5 * (dz * dz) / (sigmaA * sigmaA));
    combinedAura += (auraBand * 0.25) * phaseWindow * clamp(uScanOpacity, 0.0, 1.0);

    for (int i = 0; i < MAX_SCANS; i++) {
      if (float(i) >= uScanCount) break;
      float tActiveI = iTime - uScanStarts[i];
      float phaseI = clamp(tActiveI / dur, 0.0, 1.0);
      if (uScanDirection > 0.5 && uScanDirection < 1.5) {
        phaseI = 1.0 - phaseI;
      } else if (uScanDirection > 1.5) {
        phaseI = (phaseI < 0.5) ? (phaseI * 2.0) : (1.0 - (phaseI - 0.5) * 2.0);
      }
      float scanZI = phaseI * scanZMax;
      float dzI = abs(hit.z - scanZI);
      float lineBandI = exp(-0.5 * (dzI * dzI) / (sigma * sigma));
      float headFadeI = smoother01(0.0, headW, phaseI);
      float tailFadeI = 1.0 - smoother01(1.0 - tailW, 1.0, phaseI);
      float phaseWindowI = headFadeI * tailFadeI;
      combinedPulse += lineBandI * phaseWindowI * clamp(uScanOpacity, 0.0, 1.0);
      float auraBandI = exp(-0.5 * (dzI * dzI) / (sigmaA * sigmaA));
      combinedAura += (auraBandI * 0.25) * phaseWindowI * clamp(uScanOpacity, 0.0, 1.0);
    }

    float lineVis = lineMask;
    vec3 gridCol = uLinesColor * lineVis * fade;
    vec3 scanCol = uScanColor * combinedPulse;
    vec3 scanAura = uScanColor * combinedAura;

    color = gridCol + scanCol + scanAura;

    float n = fract(sin(dot(gl_FragCoord.xy + vec2(iTime * 123.4), vec2(12.9898,78.233))) * 43758.5453123);
    color += (n - 0.5) * uNoise;
    color = clamp(color, 0.0, 1.0);
    float alpha = clamp(max(lineVis, combinedPulse), 0.0, 1.0);
    float gx = 1.0 - smoothstep(tx * 2.0, tx * 2.0 + aax * 2.0, ax);
    float gy = 1.0 - smoothstep(ty * 2.0, ty * 2.0 + aay * 2.0, ay);
    float halo = max(gx, gy) * fade;
    alpha = max(alpha, halo * clamp(uBloomOpacity, 0.0, 1.0));
    if (uLightMode > 0.5) {
      float energy = max(max(color.r, color.g), color.b);
      float coverage = clamp(max(alpha, smoothstep(0.0, 0.55, energy) * 0.82), 0.0, 0.9);
      coverage *= smoothstep(0.015, 0.12, energy);
      vec3 chroma = clamp(color / max(energy, 0.0001), 0.0, 1.0);
      chroma = pow(chroma, vec3(1.2));
      fragColor = vec4(mix(vec3(1.0), chroma, coverage * 0.94), 1.0);
    } else {
      fragColor = vec4(color, alpha);
    }
}

void main(){
  vec4 c;
  mainImage(c, vUv * iResolution.xy);
  gl_FragColor = c;
}
`;

  const renderer = new THREE_LIB.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(getOptimizedDPR());
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
  renderer.domElement.style.position = 'absolute';
  renderer.domElement.style.top = '0';
  renderer.domElement.style.left = '0';
  container.appendChild(renderer.domElement);

  const MAX_SCANS = 8;
  const scanStarts = [];

  const pushScan = t => {
    if (scanStarts.length >= MAX_SCANS) scanStarts.shift();
    scanStarts.push(t);
    const buf = new Array(MAX_SCANS).fill(0);
    for (let i = 0; i < scanStarts.length && i < MAX_SCANS; i++) buf[i] = scanStarts[i];
    uniforms.uScanStarts.value = buf;
    uniforms.uScanCount.value = scanStarts.length;
  };

  const uniforms = {
    iResolution: {
      value: new THREE_LIB.Vector3(container.clientWidth || 1, container.clientHeight || 1, renderer.getPixelRatio())
    },
    iTime: { value: 0 },
    uSkew: { value: new THREE_LIB.Vector2(0, 0) },
    uTilt: { value: 0 },
    uYaw: { value: 0 },
    uLineThickness: { value: lineThickness },
    uLinesColor: { value: srgbColor(linesColor) },
    uScanColor: { value: srgbColor(scanColor) },
    uGridScale: { value: gridScale },
    uLineStyle: { value: lineStyle === 'dashed' ? 1 : lineStyle === 'dotted' ? 2 : 0 },
    uLineJitter: { value: Math.max(0, Math.min(1, lineJitter || 0)) },
    uScanOpacity: { value: scanOpacity },
    uNoise: { value: noiseIntensity },
    uBloomOpacity: { value: bloomIntensity },
    uScanGlow: { value: scanGlow },
    uScanSoftness: { value: scanSoftness },
    uPhaseTaper: { value: scanPhaseTaper },
    uScanDuration: { value: scanDuration },
    uScanDelay: { value: scanDelay },
    uScanDirection: { value: scanDirection === 'backward' ? 1 : scanDirection === 'pingpong' ? 2 : 0 },
    uScanStarts: { value: new Array(MAX_SCANS).fill(0) },
    uScanCount: { value: 0 },
    uLightMode: { value: lightMode ? 1 : 0 }
  };

  const material = new THREE_LIB.ShaderMaterial({
    uniforms,
    vertexShader: vert,
    fragmentShader: frag,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    extensions: { derivatives: true }
  });

  const scene = new THREE_LIB.Scene();
  const camera = new THREE_LIB.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quad = new THREE_LIB.Mesh(new THREE_LIB.PlaneGeometry(2, 2), material);
  scene.add(quad);

  const lookTarget = new THREE_LIB.Vector2(0, 0);
  const lookCurrent = new THREE_LIB.Vector2(0, 0);
  const lookVel = new THREE_LIB.Vector2(0, 0);

  const s = THREE_LIB.MathUtils.clamp(sensitivity, 0, 1);
  const skewScale = THREE_LIB.MathUtils.lerp(0.06, 0.2, s);
  const smoothTime = THREE_LIB.MathUtils.lerp(0.45, 0.12, s);
  const maxSpeed = Infinity;
  const yBoost = THREE_LIB.MathUtils.lerp(1.2, 1.6, s);

  const resize = () => {
    const w = container.clientWidth || window.innerWidth || 1;
    const h = container.clientHeight || window.innerHeight || 1;
    renderer.setSize(w, h);
    material.uniforms.iResolution.value.set(w, h, renderer.getPixelRatio());
  };
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(container);

  const onMove = e => {
    const rect = container.getBoundingClientRect();
    const clientX = e.touches && e.touches[0] ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches && e.touches[0] ? e.touches[0].clientY : e.clientY;
    if (clientX === undefined || clientY === undefined) return;
    const nx = ((clientX - rect.left) / rect.width) * 2 - 1;
    const ny = -(((clientY - rect.top) / rect.height) * 2 - 1);
    lookTarget.set(nx, ny);
  };

  const onLeave = () => {
    lookTarget.set(0, 0);
  };

  const onClick = () => {
    if (scanOnClick) pushScan(performance.now() / 1000);
  };

  window.addEventListener('mousemove', onMove, { passive: true });
  window.addEventListener('touchmove', onMove, { passive: true });
  window.addEventListener('touchstart', onMove, { passive: true });
  container.addEventListener('mouseleave', onLeave);
  container.addEventListener('touchend', onLeave, { passive: true });
  if (scanOnClick) {
    window.addEventListener('click', onClick);
    window.addEventListener('touchend', onClick, { passive: true });
  }

  let last = performance.now();
  let raf = 0;
  const loop = () => {
    if (!isTabVisible) {
      raf = requestAnimationFrame(loop);
      return;
    }
    raf = requestAnimationFrame(loop);

    const now = performance.now();
    const dt = Math.max(0, Math.min(0.1, (now - last) / 1000));
    last = now;

    lookCurrent.copy(
      smoothDampVec2(lookCurrent, lookTarget, lookVel, smoothTime, maxSpeed, dt)
    );

    const skew = new THREE_LIB.Vector2(lookCurrent.x * skewScale, -lookCurrent.y * yBoost * skewScale);
    material.uniforms.uSkew.value.set(skew.x, skew.y);
    material.uniforms.iTime.value = now / 1000;

    renderer.render(scene, camera);
  };
  raf = requestAnimationFrame(loop);

  return () => {
    cancelAnimationFrame(raf);
    ro.disconnect();
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('touchmove', onMove);
    window.removeEventListener('touchstart', onMove);
    container.removeEventListener('mouseleave', onLeave);
    container.removeEventListener('touchend', onLeave);
    if (scanOnClick) {
      window.removeEventListener('click', onClick);
      window.removeEventListener('touchend', onClick);
    }
    try { container.removeChild(renderer.domElement); } catch {}
    quad.geometry.dispose();
    material.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
  };
}

// ==========================================
// 30. LIQUID CHROME INITIALIZER (React Bits / OGL)
// ==========================================
function initLiquidChrome(container, opts = {}) {
  const {
    baseColor = [0.1, 0.1, 0.1],
    speed = 0.2,
    amplitude = 0.3,
    frequencyX = 3.0,
    frequencyY = 3.0,
    interactive = true
  } = opts;

  const renderer = new Renderer({ antialias: true, alpha: true, dpr: getOptimizedDPR() });
  const gl = renderer.gl;
  gl.clearColor(0, 0, 0, 0);

  const canvas = gl.canvas;
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.position = 'absolute';
  canvas.style.top = '0';
  canvas.style.left = '0';
  container.appendChild(canvas);

  const vertexShader = `
    attribute vec2 position;
    attribute vec2 uv;
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = vec4(position, 0.0, 1.0);
    }
  `;

  const fragmentShader = `
    precision highp float;
    uniform float uTime;
    uniform vec3 uResolution;
    uniform vec3 uBaseColor;
    uniform float uAmplitude;
    uniform float uFrequencyX;
    uniform float uFrequencyY;
    uniform vec2 uMouse;
    varying vec2 vUv;

    vec4 renderImage(vec2 uvCoord) {
        vec2 fragCoord = uvCoord * uResolution.xy;
        vec2 uv = (2.0 * fragCoord - uResolution.xy) / min(uResolution.x, uResolution.y);

        for (float i = 1.0; i < 10.0; i++){
            uv.x += uAmplitude / i * cos(i * uFrequencyX * uv.y + uTime + uMouse.x * 3.14159);
            uv.y += uAmplitude / i * cos(i * uFrequencyY * uv.x + uTime + uMouse.y * 3.14159);
        }

        vec2 diff = (uvCoord - uMouse);
        float dist = length(diff);
        float falloff = exp(-dist * 20.0);
        float ripple = sin(10.0 * dist - uTime * 2.0) * 0.03;
        uv += (diff / (dist + 0.0001)) * ripple * falloff;

        vec3 color = uBaseColor / abs(sin(uTime - uv.y - uv.x));
        return vec4(color, 1.0);
    }

    void main() {
        vec4 col = vec4(0.0);
        int samples = 0;
        for (int i = -1; i <= 1; i++){
            for (int j = -1; j <= 1; j++){
                vec2 offset = vec2(float(i), float(j)) * (1.0 / min(uResolution.x, uResolution.y));
                col += renderImage(vUv + offset);
                samples++;
            }
        }
        gl_FragColor = col / float(samples);
    }
  `;

  const geometry = new Triangle(gl);
  const colorArr = Array.isArray(baseColor) ? baseColor : [0.1, 0.1, 0.1];
  const program = new Program(gl, {
    vertex: vertexShader,
    fragment: fragmentShader,
    uniforms: {
      uTime: { value: 0 },
      uResolution: {
        value: new Float32Array([1, 1, 1])
      },
      uBaseColor: { value: new Float32Array(colorArr) },
      uAmplitude: { value: amplitude },
      uFrequencyX: { value: frequencyX },
      uFrequencyY: { value: frequencyY },
      uMouse: { value: new Float32Array([0, 0]) }
    }
  });
  const mesh = new Mesh(gl, { geometry, program });

  function resize() {
    const w = container.clientWidth || window.innerWidth || 1;
    const h = container.clientHeight || window.innerHeight || 1;
    renderer.setSize(w, h);
    program.uniforms.uResolution.value = [gl.canvas.width, gl.canvas.height, gl.canvas.width / gl.canvas.height];
  }
  const ro = new ResizeObserver(resize);
  ro.observe(container);
  resize();

  function handleMouseMove(event) {
    const rect = container.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = 1 - (event.clientY - rect.top) / rect.height;
    program.uniforms.uMouse.value[0] = x;
    program.uniforms.uMouse.value[1] = y;
  }

  function handleTouchMove(event) {
    if (event.touches.length > 0) {
      const touch = event.touches[0];
      const rect = container.getBoundingClientRect();
      const x = (touch.clientX - rect.left) / rect.width;
      const y = 1 - (touch.clientY - rect.top) / rect.height;
      program.uniforms.uMouse.value[0] = x;
      program.uniforms.uMouse.value[1] = y;
    }
  }

  if (interactive) {
    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
  }

  let animationId = 0;
  function update(t) {
    if (!isTabVisible) {
      animationId = requestAnimationFrame(update);
      return;
    }
    animationId = requestAnimationFrame(update);
    program.uniforms.uTime.value = t * 0.001 * speed;
    renderer.render({ scene: mesh });
  }
  animationId = requestAnimationFrame(update);

  return () => {
    cancelAnimationFrame(animationId);
    ro.disconnect();
    if (interactive) {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('touchmove', handleTouchMove);
    }
    try { container.removeChild(canvas); } catch {}
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  };
}

// ==========================================
// 31. LINE WAVES INITIALIZER (React Bits / OGL)
// ==========================================
function initLineWaves(container, opts = {}) {
  const {
    speed = 0.3,
    innerLineCount = 32.0,
    outerLineCount = 36.0,
    warpIntensity = 1.0,
    rotation = -45,
    edgeFadeWidth = 0.0,
    colorCycleSpeed = 1.0,
    brightness = 0.2,
    color1 = '#ffffff',
    color2 = '#ffffff',
    color3 = '#ffffff',
    enableMouseInteraction = true,
    mouseInfluence = 2.0,
    lightMode = false
  } = opts;

  function hexToVec3(hex) {
    const h = (hex || '#ffffff').replace('#', '');
    return [
      (parseInt(h.slice(0, 2), 16) || 0) / 255,
      (parseInt(h.slice(2, 4), 16) || 0) / 255,
      (parseInt(h.slice(4, 6), 16) || 0) / 255
    ];
  }

  const renderer = new Renderer({ alpha: true, premultipliedAlpha: false, dpr: getOptimizedDPR() });
  const gl = renderer.gl;
  gl.clearColor(0, 0, 0, 0);

  const canvas = gl.canvas;
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.position = 'absolute';
  canvas.style.top = '0';
  canvas.style.left = '0';
  container.appendChild(canvas);

  let currentMouse = [0.5, 0.5];
  let targetMouse = [0.5, 0.5];

  function handleMouseMove(e) {
    const rect = container.getBoundingClientRect();
    const clientX = e.touches && e.touches[0] ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches && e.touches[0] ? e.touches[0].clientY : e.clientY;
    if (clientX === undefined || clientY === undefined) return;
    targetMouse = [
      (clientX - rect.left) / rect.width,
      1.0 - (clientY - rect.top) / rect.height
    ];
  }

  function handleMouseLeave() {
    targetMouse = [0.5, 0.5];
  }

  const vertexShader = `
attribute vec2 uv;
attribute vec2 position;
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 0, 1);
}
`;

  const fragmentShader = `
precision highp float;

uniform float uTime;
uniform vec3 uResolution;
uniform float uSpeed;
uniform float uInnerLines;
uniform float uOuterLines;
uniform float uWarpIntensity;
uniform float uRotation;
uniform float uEdgeFadeWidth;
uniform float uColorCycleSpeed;
uniform float uBrightness;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform vec2 uMouse;
uniform float uMouseInfluence;
uniform bool uEnableMouse;
uniform float uLightMode;

#define HALF_PI 1.5707963

float hashF(float n) {
  return fract(sin(n * 127.1) * 43758.5453123);
}

float smoothNoise(float x) {
  float i = floor(x);
  float f = fract(x);
  float u = f * f * (3.0 - 2.0 * f);
  return mix(hashF(i), hashF(i + 1.0), u);
}

float displaceA(float coord, float t) {
  float result = sin(coord * 2.123) * 0.2;
  result += sin(coord * 3.234 + t * 4.345) * 0.1;
  result += sin(coord * 0.589 + t * 0.934) * 0.5;
  return result;
}

float displaceB(float coord, float t) {
  float result = sin(coord * 1.345) * 0.3;
  result += sin(coord * 2.734 + t * 3.345) * 0.2;
  result += sin(coord * 0.189 + t * 0.934) * 0.3;
  return result;
}

vec2 rotate2D(vec2 p, float angle) {
  float c = cos(angle);
  float s = sin(angle);
  return vec2(p.x * c - p.y * s, p.x * s + p.y * c);
}

void main() {
  vec2 coords = gl_FragCoord.xy / uResolution.xy;
  coords = coords * 2.0 - 1.0;
  coords = rotate2D(coords, uRotation);

  float halfT = uTime * uSpeed * 0.5;
  float fullT = uTime * uSpeed;

  float mouseWarp = 0.0;
  if (uEnableMouse) {
    vec2 mPos = rotate2D(uMouse * 2.0 - 1.0, uRotation);
    float mDist = length(coords - mPos);
    mouseWarp = uMouseInfluence * exp(-mDist * mDist * 4.0);
  }

  float warpAx = coords.x + displaceA(coords.y, halfT) * uWarpIntensity + mouseWarp;
  float warpAy = coords.y - displaceA(coords.x * cos(fullT) * 1.235, halfT) * uWarpIntensity;
  float warpBx = coords.x + displaceB(coords.y, halfT) * uWarpIntensity + mouseWarp;
  float warpBy = coords.y - displaceB(coords.x * sin(fullT) * 1.235, halfT) * uWarpIntensity;

  vec2 fieldA = vec2(warpAx, warpAy);
  vec2 fieldB = vec2(warpBx, warpBy);
  vec2 blended = mix(fieldA, fieldB, mix(fieldA, fieldB, 0.5));

  float fadeTop = smoothstep(uEdgeFadeWidth, uEdgeFadeWidth + 0.4, blended.y);
  float fadeBottom = smoothstep(-uEdgeFadeWidth, -(uEdgeFadeWidth + 0.4), blended.y);
  float vMask = 1.0 - max(fadeTop, fadeBottom);

  float tileCount = mix(uOuterLines, uInnerLines, vMask);
  float scaledY = blended.y * tileCount;
  float nY = smoothNoise(abs(scaledY));

  float ridge = pow(
    step(abs(nY - blended.x) * 2.0, HALF_PI) * cos(2.0 * (nY - blended.x)),
    5.0
  );

  float lines = 0.0;
  for (float i = 1.0; i < 3.0; i += 1.0) {
    lines += pow(max(fract(scaledY), fract(-scaledY)), i * 2.0);
  }

  float pattern = vMask * lines;

  float cycleT = fullT * uColorCycleSpeed;
  float rChannel = (pattern + lines * ridge) * (cos(blended.y + cycleT * 0.234) * 0.5 + 1.0);
  float gChannel = (pattern + vMask * ridge) * (sin(blended.x + cycleT * 1.745) * 0.5 + 1.0);
  float bChannel = (pattern + lines * ridge) * (cos(blended.x + cycleT * 0.534) * 0.5 + 1.0);

  vec3 col = (rChannel * uColor1 + gChannel * uColor2 + bChannel * uColor3) * uBrightness;
  float alpha = clamp(length(col), 0.0, 1.0);

  if (uLightMode > 0.5) {
    vec3 weights = pow(max(vec3(rChannel, gChannel, bChannel), vec3(0.0)), vec3(3.0));
    float weightSum = max(weights.r + weights.g + weights.b, 0.0001);
    vec3 chroma = (weights.r * uColor1 + weights.g * uColor2 + weights.b * uColor3) / weightSum;
    float neutral = min(chroma.r, min(chroma.g, chroma.b));
    chroma = max(chroma - vec3(neutral * 0.92), vec3(0.0));
    float peak = max(chroma.r, max(chroma.g, chroma.b));
    chroma = pow(clamp(chroma / max(peak, 0.0001), 0.0, 1.0), vec3(1.08));
    float ink = clamp(max(rChannel, max(gChannel, bChannel)) * uBrightness * 1.15, 0.0, 0.92);
    gl_FragColor = vec4(mix(vec3(1.0), chroma, ink), 1.0);
  } else {
    gl_FragColor = vec4(col, alpha);
  }
}
`;

  const geometry = new Triangle(gl);
  const rotationRad = (rotation * Math.PI) / 180;
  const program = new Program(gl, {
    vertex: vertexShader,
    fragment: fragmentShader,
    uniforms: {
      uTime: { value: 0 },
      uResolution: { value: new Float32Array([1, 1, 1]) },
      uSpeed: { value: speed },
      uInnerLines: { value: innerLineCount },
      uOuterLines: { value: outerLineCount },
      uWarpIntensity: { value: warpIntensity },
      uRotation: { value: rotationRad },
      uEdgeFadeWidth: { value: edgeFadeWidth },
      uColorCycleSpeed: { value: colorCycleSpeed },
      uBrightness: { value: brightness },
      uColor1: { value: new Float32Array(hexToVec3(color1)) },
      uColor2: { value: new Float32Array(hexToVec3(color2)) },
      uColor3: { value: new Float32Array(hexToVec3(color3)) },
      uMouse: { value: new Float32Array([0.5, 0.5]) },
      uMouseInfluence: { value: mouseInfluence },
      uEnableMouse: { value: enableMouseInteraction },
      uLightMode: { value: lightMode ? 1 : 0 }
    }
  });

  const mesh = new Mesh(gl, { geometry, program });

  function resize() {
    const w = container.clientWidth || window.innerWidth || 1;
    const h = container.clientHeight || window.innerHeight || 1;
    renderer.setSize(w, h);
    program.uniforms.uResolution.value = [gl.canvas.width, gl.canvas.height, gl.canvas.width / gl.canvas.height];
  }
  const ro = new ResizeObserver(resize);
  ro.observe(container);
  resize();

  if (enableMouseInteraction) {
    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('touchmove', handleMouseMove, { passive: true });
    window.addEventListener('touchstart', handleMouseMove, { passive: true });
    container.addEventListener('mouseleave', handleMouseLeave);
    container.addEventListener('touchend', handleMouseLeave, { passive: true });
  }

  let animationFrameId = 0;
  function update(time) {
    if (!isTabVisible) {
      animationFrameId = requestAnimationFrame(update);
      return;
    }
    animationFrameId = requestAnimationFrame(update);
    program.uniforms.uTime.value = time * 0.001;

    if (enableMouseInteraction) {
      currentMouse[0] += 0.05 * (targetMouse[0] - currentMouse[0]);
      currentMouse[1] += 0.05 * (targetMouse[1] - currentMouse[1]);
      program.uniforms.uMouse.value[0] = currentMouse[0];
      program.uniforms.uMouse.value[1] = currentMouse[1];
    } else {
      program.uniforms.uMouse.value[0] = 0.5;
      program.uniforms.uMouse.value[1] = 0.5;
    }

    renderer.render({ scene: mesh });
  }
  animationFrameId = requestAnimationFrame(update);

  return () => {
    cancelAnimationFrame(animationFrameId);
    ro.disconnect();
    if (enableMouseInteraction) {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('touchmove', handleMouseMove);
      window.removeEventListener('touchstart', handleMouseMove);
      container.removeEventListener('mouseleave', handleMouseLeave);
      container.removeEventListener('touchend', handleMouseLeave);
    }
    try { container.removeChild(canvas); } catch {}
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  };
}

window.initBeams = initBeams;
window.initFloatingLines = initFloatingLines;
window.initSilk = initSilk;
window.initRadar = initRadar;
window.initRippleGrid = initRippleGrid;
window.initPixelBlast = initPixelBlast;
window.initMagicRings = initMagicRings;
window.initGridScan = initGridScan;
window.initLiquidChrome = initLiquidChrome;
window.initLineWaves = initLineWaves;
window.setWebGLBackground = window.renderWebGLBackground;

window.stopWebGLBackground = function() {
  currentBgSession++;
  const container = document.getElementById('bg-webgl-container');
  if (currentCleanup) {
    try {
      currentCleanup();
    } catch(e) {}
    currentCleanup = null;
  }
  if (container) {
    const oldCanvases = container.querySelectorAll('canvas');
    oldCanvases.forEach(cv => {
      try {
        const gl = cv.getContext('webgl2') || cv.getContext('webgl');
        if (gl) gl.getExtension('WEBGL_lose_context')?.loseContext();
        cv.width = 1;
        cv.height = 1;
      } catch(e) {}
    });
    container.innerHTML = '';
  }
  currentActiveType = null;
};



// ==========================================
// ADB GLASS SENTINEL BRIDGE & EXPORTS
// ==========================================
let activeSentinelShader = (typeof localStorage !== "undefined" ? localStorage.getItem("adb_sentinel_shader") : null) || "strands";

export function renderShader(type) {
  if (!type) type = activeSentinelShader;
  if (type === "soft_aurora") type = "softaurora";
  if (type === "dark_veil") type = "darkveil";
  activeSentinelShader = type;
  try { if (typeof localStorage !== "undefined") localStorage.setItem("adb_sentinel_shader", type); } catch(e) {}
  if (typeof window !== "undefined" && typeof window.renderWebGLBackground === "function") {
    return window.renderWebGLBackground(type);
  }
}

export function initShader(ctn, type) {
  return renderShader(type);
}

export function getActiveShader() {
  return activeSentinelShader;
}

if (typeof window !== "undefined") {
  window.renderShader = renderShader;
  window.initShader = initShader;
  window.getActiveShader = getActiveShader;
  window.setWebGLBackground = window.renderWebGLBackground;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      renderShader(activeSentinelShader);
    });
  } else {
    setTimeout(() => renderShader(activeSentinelShader), 50);
  }
}
