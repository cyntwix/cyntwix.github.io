// NIGHTMARE!!! / a plain of stones under a spent sun.
// Everything renders at a fraction of screen resolution, then gets re-printed
// as a hand-coloured relief plate: hatching by tone, contour lines from depth,
// a misregistered colour wash crushed into a small palette, plate grain,
// negative dust, and a little feedback so motion leaves a stain.

import * as THREE from 'three';

THREE.ColorManagement.enabled = false;

const GATES = [
  { href: 'about.html', numeral: 'I', tone: 196.0 },
  { href: 'videos.html', numeral: 'II', tone: 233.1 },
  { href: 'writing.html', numeral: 'III', tone: 261.6 },
  { href: 'contact.html', numeral: 'IV', tone: 293.7 },
];
const OMENS = [
  'transient illumination',
  'to go beyond',
  'videos, images, omens',
  'the path through',
  'four doors',
];

const RAW = new URLSearchParams(location.search).has('raw');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const canvas = document.getElementById('plate');

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
} catch (err) {
  document.body.classList.add('no-gl');
  throw err;
}
renderer.setPixelRatio(1);
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.BasicShadowMap;

// ---------------------------------------------------------------- utilities

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(1757);

function h2(x, y) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function vnoise(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y);
  let fx = x - ix, fy = y - iy;
  fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
  const a = h2(ix, iy), b = h2(ix + 1, iy), c = h2(ix, iy + 1), d = h2(ix + 1, iy + 1);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}
function fbm(x, y) {
  let s = 0, a = 0.5;
  for (let i = 0; i < 5; i++) { s += a * vnoise(x, y); x *= 2.03; y *= 2.03; a *= 0.5; }
  return s;
}
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

function groundHeight(x, z) {
  const r = Math.hypot(x, z);
  const dunes = (fbm(x * 0.008 + 3.1, z * 0.008 - 7.7) - 0.5) * 34 * smooth(30, 260, r);
  const rubble = (vnoise(x * 0.35, z * 0.35) - 0.5) * 0.5;
  return dunes + rubble;
}

const GLSL_NOISE = /* glsl */ `
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  float fbm(vec2 p) {
    float s = 0.0, a = 0.5;
    for (int i = 0; i < 5; i++) { s += a * noise(p); p *= 2.03; a *= 0.5; }
    return s;
  }
`;

// ---------------------------------------------------------------- world

const scene = new THREE.Scene();
const HORIZON = new THREE.Color(0.42, 0.2, 0.12);
scene.fog = new THREE.FogExp2(HORIZON, 0.0042);

const camera = new THREE.PerspectiveCamera(62, 1, 0.5, 2000);
camera.rotation.order = 'YXZ';
const EYE_HEIGHT = 2.3;
camera.position.set(0, groundHeight(0, 0) + EYE_HEIGHT, 0);

const SUN_AZ = 0.0, SUN_EL = 0.2;
const sunDir = new THREE.Vector3(
  Math.sin(SUN_AZ) * Math.cos(SUN_EL), Math.sin(SUN_EL), -Math.cos(SUN_AZ) * Math.cos(SUN_EL)
);

const sunLight = new THREE.DirectionalLight(0xff8a4a, 7.5);
sunLight.position.copy(sunDir).multiplyScalar(320);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(2048, 2048);
Object.assign(sunLight.shadow.camera, { left: -210, right: 210, top: 120, bottom: -60, near: 1, far: 900 });
sunLight.shadow.bias = -0.0015;
scene.add(sunLight, sunLight.target);
scene.add(new THREE.HemisphereLight(0x3a4a78, 0x1c0c06, 2.2));

// the stair: a helix of slabs coiling up into the weather
const STAIR_AZ = -0.34, STAIR_DIST = 175, STAIR_HEIGHT = 240;
const stairBase = new THREE.Vector3(Math.sin(STAIR_AZ) * STAIR_DIST, 0, -Math.cos(STAIR_AZ) * STAIR_DIST);
stairBase.y = groundHeight(stairBase.x, stairBase.z) - 2;
const stairTop = stairBase.clone().add(new THREE.Vector3(0, STAIR_HEIGHT, 0));
const vortexDir = stairTop.clone().add(new THREE.Vector3(0, 90, 0)).sub(camera.position).normalize();

// ---- sky
const skyMat = new THREE.ShaderMaterial({
  uniforms: {
    uTime: { value: 0 },
    uSun: { value: sunDir },
    uVortex: { value: vortexDir },
    uFlash: { value: 0 },
    uHorizon: { value: HORIZON },
  },
  vertexShader: /* glsl */ `
    varying vec3 vDir;
    void main() {
      vDir = position;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      gl_Position.z = gl_Position.w;
    }`,
  fragmentShader: /* glsl */ `
    uniform float uTime, uFlash;
    uniform vec3 uSun, uVortex, uHorizon;
    varying vec3 vDir;
    ${GLSL_NOISE}
    void main() {
      vec3 d = normalize(vDir);
      float h = d.y;
      float az = atan(d.x, -d.z);

      vec3 zen = vec3(0.025, 0.04, 0.10);
      vec3 mid = vec3(0.17, 0.09, 0.15);
      vec3 col = mix(uHorizon, mid, smoothstep(0.0, 0.22, h));
      col = mix(col, zen, smoothstep(0.18, 0.8, h));
      col = mix(col, uHorizon * 0.55, smoothstep(0.0, -0.08, h));

      // long horizontal weather, streaked like a burin pulled too hard
      float b1 = fbm(vec2(az * 2.4 + uTime * 0.008, h * 13.0 - uTime * 0.015));
      float b2 = fbm(vec2(az * 7.0 - uTime * 0.012, h * 44.0));
      float cloud = smoothstep(0.42, 0.78, b1 * 0.75 + b2 * 0.4)
                  * smoothstep(0.6, 0.04, h) * smoothstep(-0.02, 0.05, h);

      float sd = acos(clamp(dot(d, uSun), -1.0, 1.0));
      float R = 0.165;
      float sunNear = exp(-sd * 2.0);
      col = mix(col, mix(vec3(0.22, 0.09, 0.10), vec3(1.0, 0.56, 0.24), sunNear), cloud * 0.85);

      // the vortex, wound around an axis that rises out of the stair
      vec3 vx = normalize(cross(vec3(0.0, 1.0, 0.0), uVortex));
      vec3 vy = cross(uVortex, vx);
      float vr = acos(clamp(dot(d, uVortex), -1.0, 1.0));
      float va = atan(dot(d, vy), dot(d, vx));
      float swirl = va + 2.6 / (vr + 0.18) - uTime * 0.11;
      float arms = sin(swirl * 4.0 + fbm(vec2(vr * 5.0, swirl * 0.8)) * 3.5);
      float vort = smoothstep(0.1, 1.0, arms) * smoothstep(1.25, 0.2, vr) * smoothstep(0.03, 0.14, vr);
      col = mix(col, vec3(0.46, 0.38, 0.30), vort * 0.6);
      col = mix(col, vec3(0.02, 0.01, 0.03), smoothstep(0.14, 0.05, vr));
      col += vec3(1.0, 0.95, 0.78) * smoothstep(0.035, 0.0, vr) * 1.6;

      // crossed stars in the dark between arms
      vec2 sg = vec2(az * 60.0, h * 60.0);
      vec2 sc = floor(sg);
      vec2 sf = fract(sg) - 0.5;
      float star = step(0.985, hash(sc)) * smoothstep(0.25, 0.6, h) * (1.0 - vort);
      float cross_ = max(step(abs(sf.x), 0.06) * step(abs(sf.y), 0.4), step(abs(sf.y), 0.06) * step(abs(sf.x), 0.4));
      col += vec3(0.9, 0.84, 0.66) * star * cross_ * 0.8;

      // sun: straight engraved spokes, then the disc
      vec3 sx = normalize(cross(vec3(0.0, 1.0, 0.0), uSun));
      vec3 sy = cross(uSun, sx);
      vec2 sp = vec2(dot(d, sx), dot(d, sy));
      float sa = atan(sp.y, sp.x);
      float spokes = pow(abs(sin(sa * 34.0)), 22.0) + 0.7 * pow(abs(sin(sa * 9.0 + 0.6)), 40.0);
      float outside = step(R, sd);
      col += vec3(0.95, 0.52, 0.2) * spokes * smoothstep(R * 5.0, R, sd) * outside * 0.95;
      col += vec3(0.85, 0.32, 0.12) * exp(-(sd - R) * 7.0) * outside * 0.7;
      if (sd < R) {
        float k = sd / R;
        float limb = sqrt(1.0 - k * k);
        float spots = fbm(sp * 38.0 + vec2(uTime * 0.01, 0.0));
        vec3 disc = mix(vec3(0.5, 0.06, 0.03), vec3(1.0, 0.56, 0.2), limb);
        disc *= 0.7 + 0.55 * spots;
        disc = mix(disc, vec3(0.07, 0.02, 0.02), smoothstep(0.63, 0.68, spots));
        col = disc;
      }

      col += uFlash * vec3(0.95, 0.9, 1.0) * (0.25 + 0.75 * vort + 0.4 * cloud);
      gl_FragColor = vec4(col, 1.0);
    }`,
  side: THREE.BackSide,
  depthWrite: false,
  fog: false,
});
const sky = new THREE.Mesh(new THREE.SphereGeometry(900, 48, 32), skyMat);
sky.renderOrder = -10;
scene.add(sky);

// ---- the eye inside the sun
const loader = new THREE.TextureLoader();
function nearest(tex) {
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  return tex;
}
const eyeTex = nearest(loader.load('assets/eye_sheet.png'));
const eyeMat = new THREE.ShaderMaterial({
  uniforms: { map: { value: eyeTex }, uFrame: { value: 0 }, uBlink: { value: 0 } },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D map;
    uniform float uFrame, uBlink;
    varying vec2 vUv;
    void main() {
      float open = 1.0 - uBlink;
      float lid = 0.5 * open * (1.0 - 0.35 * pow(abs(vUv.x - 0.5) * 2.0, 2.0));
      if (abs(vUv.y - 0.5) > lid) discard;
      float c = mod(uFrame, 3.0), r = floor(uFrame / 3.0);
      vec2 suv = vec2((c + vUv.x) / 3.0, 1.0 - (r + 1.0 - vUv.y) / 2.0);
      vec4 t = texture2D(map, suv);
      if (t.a < 0.5) discard;
      float l = dot(t.rgb, vec3(0.3, 0.59, 0.11));
      vec3 tint = mix(vec3(0.06, 0.0, 0.01), vec3(1.0, 0.66, 0.3), smoothstep(0.08, 0.85, l));
      gl_FragColor = vec4(tint, 1.0);
    }`,
  depthTest: false,
  depthWrite: false,
  fog: false,
});
const EYE_DIST = 850;
const eyeW = 2 * EYE_DIST * Math.tan(0.165) * 0.92;
const eye = new THREE.Mesh(new THREE.PlaneGeometry(eyeW, eyeW * (111 / 255)), eyeMat);
eye.renderOrder = -9;
scene.add(eye);

// ---- ground
const groundGeo = new THREE.PlaneGeometry(3200, 3200, 220, 220);
groundGeo.rotateX(-Math.PI / 2);
{
  const p = groundGeo.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, groundHeight(p.getX(i), p.getZ(i)));
  groundGeo.computeVertexNormals();
  const cols = new Float32Array(p.count * 3);
  const base = new THREE.Color(0x5e4630), ashy = new THREE.Color(0x6e665a), burnt = new THREE.Color(0x2e1a12), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    const patch = fbm(x * 0.03 + 11.0, z * 0.03 - 4.0);
    const streak = vnoise(x * 0.012, z * 0.12);
    c.copy(base).lerp(ashy, smooth(0.5, 0.75, patch)).lerp(burnt, smooth(0.55, 0.85, streak) * 0.8);
    c.toArray(cols, i * 3);
  }
  groundGeo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
}
const ground = new THREE.Mesh(groundGeo, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
ground.receiveShadow = true;
scene.add(ground);

// ---- standing stones out to the horizon
{
  const COUNT = 3400;
  const geo = new THREE.BoxGeometry(1, 1, 1);
  geo.translate(0, 0.5, 0);
  const mesh = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true }), COUNT);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), t = new THREE.Vector3();
  const pale = new THREE.Color(0x9a8264), mid = new THREE.Color(0x6f5c48), dark = new THREE.Color(0x3a2e24), c = new THREE.Color();
  let n = 0;
  while (n < COUNT) {
    const r = 30 + Math.pow(rand(), 1.5) * 760;
    const a = rand() * Math.PI * 2;
    const x = Math.sin(a) * r, z = -Math.cos(a) * r;
    if (Math.hypot(x - stairBase.x, z - stairBase.z) < 34) continue;
    const obelisk = rand() < 0.05;
    const hgt = obelisk ? 18 + rand() * 46 : 0.8 + Math.pow(rand(), 2) * 7;
    const w = obelisk ? 1.6 + rand() * 2.2 : 0.7 + rand() * 2.6;
    const dpt = obelisk ? w : 0.4 + rand() * 1.2;
    const tilt = obelisk ? 0.05 : 0.22;
    e.set((rand() - 0.5) * tilt, rand() * Math.PI, (rand() - 0.5) * tilt);
    q.setFromEuler(e);
    t.set(x, groundHeight(x, z) - 0.4, z);
    s.set(w, hgt, dpt);
    m.compose(t, q, s);
    mesh.setMatrixAt(n, m);
    c.copy(mid).lerp(rand() < 0.5 ? pale : dark, rand());
    mesh.setColorAt(n, c);
    n++;
  }
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
}

// ---- the stair
{
  const STEPS = 230;
  const stone = new THREE.MeshLambertMaterial({ color: 0x7e6a52, flatShading: true });
  const column = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 7.5, STAIR_HEIGHT + 10, 9, 1), stone);
  column.position.copy(stairBase).add(new THREE.Vector3(0, (STAIR_HEIGHT + 10) / 2, 0));
  scene.add(column);
  const stepGeo = new THREE.BoxGeometry(13, 1.5, 4.2);
  const steps = new THREE.InstancedMesh(stepGeo, stone, STEPS);
  const postGeo = new THREE.BoxGeometry(0.6, 3.4, 0.6);
  postGeo.translate(0, 1.7, 0);
  const posts = new THREE.InstancedMesh(postGeo, stone, STEPS);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), p = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
  for (let i = 0; i < STEPS; i++) {
    const a = i * 0.29;
    const y = (i / STEPS) * STAIR_HEIGHT;
    // the upper turns lose steps, as if the weather is eating them
    const gone = i > STEPS * 0.62 && h2(i, 4) < (i / STEPS - 0.62) * 2.2;
    q.setFromAxisAngle(up, -a);
    p.set(Math.cos(a) * 10.5, y, Math.sin(a) * 10.5).add(stairBase);
    m.compose(p, q, gone ? new THREE.Vector3(0, 0, 0) : one);
    steps.setMatrixAt(i, m);
    p.set(Math.cos(a) * 16.5, y + 0.45, Math.sin(a) * 16.5).add(stairBase);
    m.compose(p, q, gone || i % 3 ? new THREE.Vector3(0, 0, 0) : one);
    posts.setMatrixAt(i, m);
  }
  for (const o of [column, steps, posts]) { o.castShadow = true; o.receiveShadow = true; }
  scene.add(steps, posts);
}

// ---- particle funnel above the stair
const funnelMat = new THREE.ShaderMaterial({
  uniforms: { uTime: { value: 0 }, uBase: { value: stairTop } },
  vertexShader: /* glsl */ `
    attribute vec3 seed;
    uniform float uTime;
    uniform vec3 uBase;
    varying float vFade;
    void main() {
      float span = 520.0;
      float y = mod(seed.y * span + uTime * (6.0 + seed.z * 10.0), span);
      float rad = 6.0 + y * 0.7 + seed.z * 14.0;
      float ang = seed.x * 6.2831 + uTime * (0.9 + seed.z) * 22.0 / rad;
      vec3 p = uBase + vec3(cos(ang) * rad, y - 10.0, sin(ang) * rad);
      vFade = smoothstep(0.0, 160.0, y) * smoothstep(span, span * 0.6, y);
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      gl_PointSize = 1.0 + step(0.82, seed.z);
      gl_Position = projectionMatrix * mv;
    }`,
  fragmentShader: /* glsl */ `
    varying float vFade;
    void main() { gl_FragColor = vec4(vec3(0.95, 0.86, 0.62) * vFade * 0.55, 1.0); }`,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
  fog: false,
});
{
  const N = 6000;
  const seeds = new Float32Array(N * 3);
  for (let i = 0; i < N * 3; i++) seeds[i] = rand();
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
  g.setAttribute('seed', new THREE.BufferAttribute(seeds, 3));
  const pts = new THREE.Points(g, funnelMat);
  pts.frustumCulled = false;
  scene.add(pts);
}

// ---- ash falling around you
const ashMat = new THREE.ShaderMaterial({
  uniforms: { uTime: { value: 0 }, uCam: { value: camera.position } },
  vertexShader: /* glsl */ `
    attribute vec3 seed;
    uniform float uTime;
    uniform vec3 uCam;
    void main() {
      vec3 box = vec3(90.0, 40.0, 90.0);
      vec3 p = seed * box + vec3(uTime * 1.3, -uTime * (0.9 + seed.x * 0.6), uTime * 0.4);
      p.x += sin(uTime * 0.7 + seed.z * 20.0) * 1.5;
      p = mod(p - uCam, box) - box * 0.5 + uCam;
      gl_PointSize = 1.0;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
    }`,
  fragmentShader: /* glsl */ `void main() { gl_FragColor = vec4(0.8, 0.74, 0.62, 1.0); }`,
  depthWrite: false,
  fog: false,
});
{
  const N = 2600;
  const seeds = new Float32Array(N * 3);
  for (let i = 0; i < N * 3; i++) seeds[i] = rand();
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
  g.setAttribute('seed', new THREE.BufferAttribute(seeds, 3));
  const pts = new THREE.Points(g, ashMat);
  pts.frustumCulled = false;
  scene.add(pts);
}

// ---------------------------------------------------------------- the four gates

const GATE_R = 22;
const GATE_OFFSET = 0.42;
const flamesSrc = nearest(loader.load('assets/flames_sheet.png', () => flames.forEach((f) => { f.tex.needsUpdate = true; })));
const flames = [];
const gates = [];
const pickables = [];

function inscription(numeral) {
  const cv = document.createElement('canvas');
  cv.width = 128; cv.height = 32;
  const g = cv.getContext('2d');
  g.fillStyle = '#6a5640';
  g.fillRect(0, 0, 128, 32);
  for (let i = 0; i < 260; i++) {
    g.fillStyle = rand() < 0.5 ? 'rgba(20,10,4,0.35)' : 'rgba(200,170,120,0.18)';
    g.fillRect(rand() * 128, rand() * 32, 1 + rand() * 2, 1);
  }
  g.font = 'bold 26px "Times New Roman", Times, serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = '#140a04';
  g.fillText(numeral, 65, 18);
  g.fillStyle = '#e0b643';
  g.fillText(numeral, 64, 17);
  return nearest(new THREE.CanvasTexture(cv));
}

const portalVert = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const portalFrag = /* glsl */ `
  uniform float uTime, uHover, uKind;
  varying vec2 vUv;
  ${GLSL_NOISE}
  void main() {
    vec2 uv = vUv;
    vec2 p = (uv - 0.5) * vec2(1.0, 2.0);
    float v = 0.0;
    vec3 tint;
    if (uKind < 0.5) {
      // the who: rings closing on a pupil
      float r = length(p * vec2(1.0, 0.8));
      v = 0.5 + 0.5 * sin(r * 30.0 - uTime * 2.2);
      v *= smoothstep(0.95, 0.15, r);
      v = max(v, smoothstep(0.1, 0.07, r) * 0.0);
      v *= step(0.12, r);
      tint = vec3(1.0, 0.72, 0.32);
    } else if (uKind < 1.5) {
      // the what: a dead channel
      float f = floor(uTime * 12.0);
      float row = floor(uv.y * 70.0);
      v = hash(vec2(floor(uv.x * 30.0 + hash(vec2(row, f)) * 30.0), row + f * 7.0));
      v *= 0.35 + 0.65 * step(0.55, fract(uv.y * 2.0 - uTime * 0.35));
      tint = vec3(0.72, 0.84, 1.0);
    } else if (uKind < 2.5) {
      // the why: strokes raining down a page
      float cols = 14.0;
      float c = floor(uv.x * cols);
      float sp = 0.3 + hash(vec2(c, 1.0)) * 0.9;
      float y = fract(uv.y * 3.0 + uTime * sp * 0.4 + hash(vec2(c, 3.0)));
      float fx = fract(uv.x * cols);
      v = step(0.7, y) * step(0.3, fx) * step(fx, 0.62) * (0.4 + 0.6 * hash(vec2(c, floor(uv.y * 40.0))));
      tint = vec3(1.0, 0.92, 0.72);
    } else {
      // the how: a transmission leaving in rings
      float r = length(p);
      v = 1.0 - smoothstep(0.0, 0.05, abs(fract(r * 2.5 - uTime * 0.5) - 0.5) - 0.42);
      v += 0.35 * noise(p * 18.0 + uTime * 2.0) * smoothstep(0.6, 0.0, r);
      tint = vec3(1.0, 0.42, 0.3);
    }
    float edge = smoothstep(0.0, 0.07, uv.x) * smoothstep(1.0, 0.93, uv.x)
               * smoothstep(0.0, 0.04, uv.y) * smoothstep(1.0, 0.96, uv.y);
    float gain = 0.22 + 0.95 * uHover;
    gl_FragColor = vec4(tint * v * gain * edge + vec3(0.015, 0.006, 0.004), 1.0);
  }`;

GATES.forEach((cfg, i) => {
  const theta = GATE_OFFSET + i * Math.PI / 2;
  const group = new THREE.Group();
  const gx = Math.sin(theta) * GATE_R, gz = -Math.cos(theta) * GATE_R;
  const gy = groundHeight(gx, gz) - 0.2;
  group.position.set(gx, gy, gz);
  group.lookAt(0, gy, 0);
  scene.add(group);

  const stone = new THREE.MeshLambertMaterial({ color: 0x8c7458, flatShading: true });
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(10, 0.6, 3.8), stone);
  plinth.position.y = 0.3;
  const left = new THREE.Mesh(new THREE.BoxGeometry(1.7, 9.2, 1.7), stone);
  left.position.set(-3.05, 4.6 + 0.4, 0);
  left.rotation.z = 0.012;
  const right = left.clone();
  right.position.x = 3.05;
  right.rotation.z = -0.02;
  const face = new THREE.MeshLambertMaterial({ map: inscription(cfg.numeral) });
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(8.6, 1.6, 2.3), [stone, stone, stone, stone, face, stone]);
  lintel.position.y = 10.2;
  lintel.rotation.z = (i % 2 ? 1 : -1) * 0.018;

  const portalMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uHover: { value: 0 }, uKind: { value: i } },
    vertexShader: portalVert,
    fragmentShader: portalFrag,
    fog: false,
  });
  const portal = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 8.8), portalMat);
  portal.position.set(0, 4.4 + 0.6, 0);

  group.add(plinth, left, right, lintel, portal);
  for (const part of [plinth, left, right, lintel]) { part.castShadow = true; part.receiveShadow = true; }
  for (const part of [left, right, lintel, portal]) {
    part.userData.gate = i;
    pickables.push(part);
  }

  for (const side of [-1, 1]) {
    const tex = flamesSrc.clone();
    tex.needsUpdate = false;
    tex.repeat.set(0.25, 1 / 3);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: tex, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, color: 0xffd9a0,
    }));
    sprite.scale.set(2.3, 4.0, 1);
    sprite.position.set(side * 3.4, 12.9, 0.2);
    group.add(sprite);
    flames.push({ tex, offset: Math.floor(rand() * 12), rate: 10 + rand() * 4 });
  }

  const light = new THREE.PointLight(0xff8a3a, 30, 34, 1.4);
  light.position.set(0, 12.5, 2.5);
  group.add(light);

  gates.push({
    cfg, theta, group, portalMat, light,
    anchor: new THREE.Vector3(gx, gy + 14.2, gz),
    label: document.querySelector(`.gate-label[data-gate="${i}"]`),
    hover: 0,
  });
});

// ---------------------------------------------------------------- the plate (post)

const engraveMat = new THREE.ShaderMaterial({
  uniforms: {
    tScene: { value: null },
    tDepth: { value: null },
    tPrev: { value: null },
    uRes: { value: new THREE.Vector2(1, 1) },
    uTime: { value: 0 },
    uFeedback: { value: 0.18 },
    uInvert: { value: 0 },
    uWhite: { value: 0 },
    uNear: { value: camera.near },
    uFar: { value: camera.far },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
  fragmentShader: /* glsl */ `
    precision highp float;
    uniform sampler2D tScene, tDepth, tPrev;
    uniform vec2 uRes;
    uniform float uTime, uFeedback, uInvert, uWhite, uNear, uFar;
    varying vec2 vUv;
    ${GLSL_NOISE}

    float linZ(vec2 uv) {
      float d = texture2D(tDepth, uv).x * 2.0 - 1.0;
      return (2.0 * uNear * uFar) / (uFar + uNear - d * (uFar - uNear));
    }
    float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
    float hatch(vec2 p, float ang, float sp, float wob) {
      float d = dot(p, vec2(cos(ang), sin(ang))) + wob;
      return 1.0 - step(1.0, mod(d, sp));
    }
    float bayer4(vec2 p) {
      vec2 q = mod(p, 4.0);
      float a = mod(q.x, 2.0), b = mod(q.y, 2.0);
      float c = floor(q.x / 2.0), d = floor(q.y / 2.0);
      float v = 4.0 * (2.0 * a * (1.0 - b) + 3.0 * a * b + 1.0 * (1.0 - a) * b)
              + (2.0 * c * (1.0 - d) + 3.0 * c * d + 1.0 * (1.0 - c) * d);
      return (v + 0.5) / 16.0;
    }
    vec3 pal(vec3 c) {
      vec3 best = vec3(0.0);
      float bd = 1e9;
      #define P(r, g, b) { vec3 q = vec3(r, g, b); vec3 e = c - q; float dd = dot(e * e, vec3(1.1, 1.6, 0.8)); if (dd < bd) { bd = dd; best = q; } }
      P(0.07, 0.04, 0.03)
      P(0.16, 0.10, 0.22)
      P(0.10, 0.19, 0.30)
      P(0.30, 0.17, 0.10)
      P(0.47, 0.16, 0.13)
      P(0.70, 0.27, 0.15)
      P(0.80, 0.53, 0.19)
      P(0.88, 0.71, 0.27)
      P(0.93, 0.86, 0.67)
      P(0.31, 0.41, 0.34)
      P(0.36, 0.31, 0.40)
      P(0.55, 0.45, 0.36)
      return best;
    }

    void main() {
      vec2 px = floor(vUv * uRes);
      vec2 tx = 1.0 / uRes;
      vec2 uv = (px + 0.5) * tx;
      float boil = floor(uTime * 5.0);

      vec3 c = texture2D(tScene, uv).rgb;
      float L = pow(clamp(luma(c) * 1.7, 0.0, 1.0), 0.72);

      // colour laid on by hand, off the line by a couple of pixels
      vec2 mo = vec2(2.0, -1.0) * tx;
      vec3 w = (texture2D(tScene, uv + mo).rgb
              + texture2D(tScene, uv + mo + vec2(2.0 * tx.x, 0.0)).rgb
              + texture2D(tScene, uv + mo + vec2(0.0, 2.0 * tx.y)).rgb
              + texture2D(tScene, uv + mo - 2.0 * tx).rgb) * 0.25;
      vec3 wc = pow(clamp(w * 1.45, 0.0, 1.0), vec3(0.8));
      wc += (bayer4(px) - 0.5) * 0.055;
      vec3 wash = pal(wc) * (0.86 + 0.16 * noise(px * 0.8) + 0.06 * noise(px * 0.05));

      // the burin
      float wob = (noise(px * 0.09 + boil * 17.0) - 0.5) * 0.9 + (noise(px * 0.016) - 0.5) * 7.0;
      float j = (hash(px * 0.37 + boil) - 0.5) * 0.05;
      float ink = 0.0;
      ink = max(ink, hatch(px, 0.79, 5.0, wob) * step(L, 0.40 + j));
      ink = max(ink, hatch(px, -0.79, 5.0, wob * 0.8) * step(L, 0.25 + j));
      ink = max(ink, hatch(px, 0.0, 3.0, wob * 0.6) * step(L, 0.13 + j));
      ink = max(ink, step(L, 0.05 + j) * step(0.35, hash(px + boil)));

      // contour lines from depth
      float z = linZ(uv);
      float zl = linZ(uv - vec2(tx.x, 0.0)), zr = linZ(uv + vec2(tx.x, 0.0));
      float zu = linZ(uv + vec2(0.0, tx.y)), zd = linZ(uv - vec2(0.0, tx.y));
      float lap = (abs(zl + zr - 2.0 * z) + abs(zu + zd - 2.0 * z)) / max(z, 1.0);
      float edge = step(0.09, lap) * step(z, uFar * 0.95 + 1.0);
      edge = max(edge, step(0.09, lap) * step(zl + zr + zu + zd, uFar * 3.9));
      ink = max(ink, edge);

      // hot things burn through the ink
      float burn = smoothstep(0.62, 0.9, L);
      ink *= 1.0 - burn;
      vec3 hot = mix(wash, pal(clamp(c * 1.2, 0.0, 1.0)), burn);

      vec3 INK = vec3(0.045, 0.028, 0.024);
      vec3 col = mix(hot, INK, ink);

      // dust on the negative, and the odd scratch
      col = mix(col, vec3(0.93, 0.87, 0.71), step(0.9994, hash(px * 1.31 + boil * 3.1)));
      float sx = floor(hash(vec2(boil, 9.0)) * uRes.x);
      float scratch = step(0.86, hash(vec2(boil, 2.0))) * step(abs(px.x - sx), 0.5)
                    * step(0.35, noise(vec2(px.y * 0.04, boil)));
      col = mix(col, vec3(0.82, 0.76, 0.6), scratch * 0.55);

      // ragged plate edge
      vec2 ed = min(px, uRes - 1.0 - px);
      float m = min(ed.x, ed.y) + (noise(px * 0.13) - 0.5) * 5.0;
      col = mix(INK, col, step(3.0, m));

      // the stain of the last frame, drifting toward the light
      vec2 fuv = (uv - 0.5) * 0.994 + 0.5 + vec2(0.0, 0.0012);
      col = mix(col, texture2D(tPrev, fuv).rgb, uFeedback);

      col = mix(col, vec3(0.95) - col, uInvert);
      col = mix(col, vec3(0.93, 0.87, 0.71), uWhite);
      gl_FragColor = vec4(col, 1.0);
    }`,
  depthTest: false,
  depthWrite: false,
});

const displayMat = new THREE.ShaderMaterial({
  uniforms: { tSrc: { value: null } },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tSrc;
    varying vec2 vUv;
    void main() { gl_FragColor = vec4(texture2D(tSrc, vUv).rgb, 1.0); }`,
  depthTest: false,
  depthWrite: false,
});

const quadGeo = new THREE.PlaneGeometry(2, 2);
const postScene = new THREE.Scene();
postScene.add(new THREE.Mesh(quadGeo, engraveMat));
const displayScene = new THREE.Scene();
displayScene.add(new THREE.Mesh(quadGeo, displayMat));
const orthoCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

const rtOpts = {
  minFilter: THREE.NearestFilter,
  magFilter: THREE.NearestFilter,
  generateMipmaps: false,
  depthBuffer: false,
};
let rtScene, rtA, rtB, W = 0, H = 0;

function resize() {
  const vw = window.innerWidth, vh = window.innerHeight;
  const pix = Math.max(2, Math.round(Math.min(vw, vh * 1.6) / 380));
  W = Math.ceil(vw / pix);
  H = Math.ceil(vh / pix);
  renderer.setSize(vw, vh, false);
  camera.aspect = vw / vh;
  camera.fov = vw < vh ? 82 : 62;
  camera.updateProjectionMatrix();

  rtScene?.depthTexture?.dispose();
  rtScene?.dispose(); rtA?.dispose(); rtB?.dispose();
  rtScene = new THREE.WebGLRenderTarget(W, H, {
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    generateMipmaps: false,
    depthBuffer: true,
    depthTexture: new THREE.DepthTexture(W, H),
  });
  rtA = new THREE.WebGLRenderTarget(W, H, rtOpts);
  rtB = new THREE.WebGLRenderTarget(W, H, rtOpts);
  engraveMat.uniforms.uRes.value.set(W, H);
  engraveMat.uniforms.tScene.value = rtScene.texture;
  engraveMat.uniforms.tDepth.value = rtScene.depthTexture;
}
window.addEventListener('resize', resize);
resize();

// ---------------------------------------------------------------- input

const state = {
  yaw: GATE_OFFSET * 0.45, pitch: 0.1,
  tYaw: GATE_OFFSET * 0.45, tPitch: 0.1,
  sway: new THREE.Vector2(),
  pointer: new THREE.Vector2(9, 9),
  dragging: false, downX: 0, downY: 0, lastX: 0, lastY: 0, moved: 0,
  hover: -1, lastInput: -1e9, woke: false,
  travel: null, navHover: -1,
};
const raycaster = new THREE.Raycaster();
const hint = document.querySelector('.hint');
const colophon = document.querySelector('.colophon');

function wake() {
  state.lastInput = performance.now();
  if (!state.woke) {
    state.woke = true;
    setTimeout(() => { hint.style.opacity = 0; colophon.classList.add('dim'); }, 2500);
  }
}

function setPointer(e) {
  state.pointer.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
}

function pick() {
  raycaster.setFromCamera(state.pointer, camera);
  const hit = raycaster.intersectObjects(pickables, false)[0];
  return hit && hit.distance < 60 ? hit.object.userData.gate : -1;
}

canvas.addEventListener('pointerdown', (e) => {
  canvas.setPointerCapture(e.pointerId);
  state.dragging = true;
  state.downX = state.lastX = e.clientX;
  state.downY = state.lastY = e.clientY;
  state.moved = 0;
  setPointer(e);
  wake();
  ensureAudioContext();
});
canvas.addEventListener('pointermove', (e) => {
  setPointer(e);
  if (state.dragging) {
    const dx = e.clientX - state.lastX, dy = e.clientY - state.lastY;
    state.lastX = e.clientX; state.lastY = e.clientY;
    state.moved = Math.max(state.moved, Math.hypot(e.clientX - state.downX, e.clientY - state.downY));
    if (state.moved > 5) {
      canvas.classList.add('dragging');
      const k = (camera.fov / 62) * 0.0042;
      state.tYaw -= dx * k;
      state.tPitch = THREE.MathUtils.clamp(state.tPitch + dy * k, -0.2, 1.15);
    }
    wake();
  }
});
canvas.addEventListener('pointerup', (e) => {
  canvas.classList.remove('dragging');
  state.dragging = false;
  setPointer(e);
  if (state.moved <= 5) {
    const g = pick();
    if (g >= 0) enter(g);
  }
  if (e.pointerType !== 'mouse') state.pointer.set(9, 9);
});
canvas.addEventListener('pointerleave', () => { if (!state.dragging) state.pointer.set(9, 9); });
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  state.tPitch = THREE.MathUtils.clamp(state.tPitch - e.deltaY * 0.0012, -0.2, 1.15);
  wake();
}, { passive: false });
window.addEventListener('keydown', (e) => {
  const step = 0.18;
  if (e.key === 'ArrowLeft') state.tYaw -= step;
  else if (e.key === 'ArrowRight') state.tYaw += step;
  else if (e.key === 'ArrowUp') state.tPitch = Math.min(1.15, state.tPitch + step);
  else if (e.key === 'ArrowDown') state.tPitch = Math.max(-0.2, state.tPitch - step);
  else return;
  wake();
});

function enter(i) {
  if (state.travel) return;
  const g = gates[i];
  if (reduceMotion) { location.href = g.cfg.href; return; }
  state.travel = { i, t: 0, from: camera.position.clone(), yaw0: state.yaw, pitch0: state.pitch };
  colophon.classList.add('gone');
  hint.style.opacity = 0;
  hum.swell();
}
window.addEventListener('pageshow', (e) => {
  if (e.persisted) {
    state.travel = null;
    camera.position.set(0, groundHeight(0, 0) + EYE_HEIGHT, 0);
    engraveMat.uniforms.uWhite.value = 0;
    colophon.classList.remove('gone');
  }
});

// the header links take the long way round too
document.querySelectorAll('.site-header nav a').forEach((a) => {
  const i = GATES.findIndex((g) => g.href === a.getAttribute('href'));
  if (i < 0) return;
  a.addEventListener('click', (e) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    enter(i);
  });
  a.addEventListener('mouseenter', () => { state.navHover = i; });
  a.addEventListener('mouseleave', () => { state.navHover = -1; });
});

// ---------------------------------------------------------------- hum

let audioCtx = null;
function ensureAudioContext() { /* audio starts only when asked */ }
const humBtn = document.querySelector('.hum');
const hum = {
  on: false, nodes: null,
  build() {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const ctx = audioCtx;
    const master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 300; lp.Q.value = 7;
    lp.connect(master);
    [[55, 'sawtooth', 0.2], [55.41, 'sawtooth', 0.2], [82.2, 'triangle', 0.14], [41.1, 'sine', 0.3]].forEach(([f, type, gain]) => {
      const o = ctx.createOscillator();
      o.type = type; o.frequency.value = f;
      const g = ctx.createGain(); g.gain.value = gain;
      o.connect(g).connect(lp); o.start();
    });
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.061;
    const lg = ctx.createGain(); lg.gain.value = 160;
    lfo.connect(lg).connect(lp.frequency); lfo.start();
    const buf = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const noiseSrc = ctx.createBufferSource(); noiseSrc.buffer = buf; noiseSrc.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 620; bp.Q.value = 0.7;
    const ng = ctx.createGain(); ng.gain.value = 0.035;
    noiseSrc.connect(bp).connect(ng).connect(master); noiseSrc.start();
    const tone = ctx.createOscillator(); tone.type = 'sine'; tone.frequency.value = 196;
    const tg = ctx.createGain(); tg.gain.value = 0;
    tone.connect(tg).connect(master); tone.start();
    this.nodes = { ctx, master, lp, tone, tg };
  },
  toggle() {
    if (!this.nodes) this.build();
    const { ctx, master } = this.nodes;
    ctx.resume();
    this.on = !this.on;
    master.gain.setTargetAtTime(this.on ? 0.5 : 0, ctx.currentTime, 0.6);
    humBtn.textContent = this.on ? 'hum: on' : 'hum: off';
    humBtn.setAttribute('aria-pressed', String(this.on));
  },
  gate(i) {
    if (!this.on) return;
    const { ctx, tone, tg } = this.nodes;
    if (i >= 0) tone.frequency.setTargetAtTime(GATES[i].tone / 2, ctx.currentTime, 0.05);
    tg.gain.setTargetAtTime(i >= 0 ? 0.08 : 0, ctx.currentTime, 0.25);
  },
  swell() {
    if (!this.on) return;
    const { ctx, lp, master } = this.nodes;
    lp.frequency.cancelScheduledValues(ctx.currentTime);
    lp.frequency.setTargetAtTime(2400, ctx.currentTime, 0.6);
    master.gain.setTargetAtTime(0.9, ctx.currentTime, 0.5);
  },
};
humBtn.addEventListener('click', () => hum.toggle());

// ---------------------------------------------------------------- omens

const omenEl = document.querySelector('.omen');
const fx = { blink: 0, blinkT: -1, invertUntil: 0, flash: 0 };
let nextOmen = 7 + rand() * 6;
let lastOmen = '';

function omen(t) {
  const roll = rand();
  if (roll < 0.3) {
    fx.blinkT = t;
  } else if (roll < 0.5 && !reduceMotion) {
    fx.invertUntil = t + 0.11;
  } else if (roll < 0.75) {
    let text;
    do { text = OMENS[Math.floor(rand() * OMENS.length)]; } while (text === lastOmen);
    lastOmen = text;
    omenEl.textContent = text;
    omenEl.classList.add('show');
    setTimeout(() => omenEl.classList.remove('show'), 3200);
  } else if (!reduceMotion) {
    fx.flash = 1;
  }
  nextOmen = t + 9 + rand() * 12;
}

// ---------------------------------------------------------------- loop

const clock = new THREE.Clock();
const fwd = new THREE.Vector3();
const toGate = new THREE.Vector3();
const tmp = new THREE.Vector3();
let frameNo = 0;

function angleDelta(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function tick() {
  const dt = Math.min(clock.getDelta(), 0.1);
  const t = clock.elapsedTime;
  const now = performance.now();

  // idle drift
  if (!reduceMotion && !state.dragging && !state.travel && now - state.lastInput > 7000) {
    state.tYaw += dt * 0.018;
    state.tPitch += (0.1 - state.tPitch) * dt * 0.2;
  }

  // gentle sway toward the cursor
  if (state.pointer.x < 5 && !state.dragging) {
    state.sway.lerp(tmp.set(state.pointer.x * 0.05, state.pointer.y * 0.03, 0), 1 - Math.exp(-dt * 2));
  } else {
    state.sway.multiplyScalar(Math.exp(-dt * 2));
  }

  const feedbackBase = reduceMotion ? 0 : 0.2;
  let feedback = feedbackBase;

  if (state.travel) {
    const tr = state.travel;
    const g = gates[tr.i];
    tr.t = Math.min(1, tr.t + dt / 1.9);
    const e = tr.t * tr.t * (3 - 2 * tr.t);
    state.yaw = tr.yaw0 + angleDelta(tr.yaw0, g.theta) * Math.min(1, e * 2.2);
    state.pitch = tr.pitch0 + (0.08 - tr.pitch0) * Math.min(1, e * 2.2);
    state.tYaw = state.yaw; state.tPitch = state.pitch;
    tmp.copy(g.group.position).setY(g.group.position.y + 4.8);
    camera.position.lerpVectors(tr.from, tmp.multiplyScalar(1.04).setY(g.group.position.y + 4.8), e);
    feedback = feedbackBase + (0.88 - feedbackBase) * e;
    engraveMat.uniforms.uWhite.value = THREE.MathUtils.smoothstep(tr.t, 0.72, 1.0);
    g.hover = 1;
    if (tr.t >= 1 && !tr.gone) { tr.gone = true; location.href = g.cfg.href; }
  } else {
    const k = 1 - Math.exp(-dt * 6);
    state.yaw += (state.tYaw - state.yaw) * k;
    state.pitch += (state.tPitch - state.pitch) * k;
  }

  camera.rotation.y = -(state.yaw + state.sway.x);
  camera.rotation.x = state.pitch + state.sway.y;
  camera.updateMatrixWorld();

  // hover
  let hov = state.travel ? state.travel.i : (state.pointer.x < 5 && !state.dragging ? pick() : -1);
  if (hov < 0 && state.navHover >= 0) hov = state.navHover;
  if (hov !== state.hover) {
    state.hover = hov;
    canvas.classList.toggle('over-gate', hov >= 0);
    hum.gate(hov);
  }

  // sky + eye
  skyMat.uniforms.uTime.value = t;
  sky.position.copy(camera.position);
  fx.flash = Math.max(0, fx.flash - dt * 2.6);
  skyMat.uniforms.uFlash.value = fx.flash * (0.6 + 0.4 * Math.sin(t * 90));
  eye.position.copy(camera.position).addScaledVector(sunDir, EYE_DIST);
  eye.lookAt(camera.position);
  eyeMat.uniforms.uFrame.value = Math.floor(t * 7) % 6;
  if (fx.blinkT >= 0) {
    const b = (t - fx.blinkT) / 0.42;
    eyeMat.uniforms.uBlink.value = b >= 1 ? 0 : Math.sin(b * Math.PI);
    if (b >= 1) fx.blinkT = -1;
  }

  funnelMat.uniforms.uTime.value = t;
  ashMat.uniforms.uTime.value = t;

  // flames and gate lights
  for (const f of flames) {
    const fr = (Math.floor(t * f.rate) + f.offset) % 12;
    f.tex.offset.set((fr % 4) * 0.25, 1 - (Math.floor(fr / 4) + 1) / 3);
  }
  camera.getWorldDirection(fwd);
  gates.forEach((g, i) => {
    g.hover += ((state.hover === i ? 1 : 0) - g.hover) * (1 - Math.exp(-dt * 8));
    g.portalMat.uniforms.uTime.value = t;
    g.portalMat.uniforms.uHover.value = g.hover;
    g.light.intensity = 26 + 10 * vnoise(t * 7 + i * 10, 0.5) + 40 * g.hover;

    // labels ride above their gates
    toGate.copy(g.anchor).sub(camera.position).normalize();
    const facing = THREE.MathUtils.smoothstep(fwd.dot(toGate), 0.55, 0.85);
    tmp.copy(g.anchor).project(camera);
    const onScreen = tmp.z < 1 && Math.abs(tmp.x) < 1.1 && Math.abs(tmp.y) < 1.1;
    const x = (tmp.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-tmp.y * 0.5 + 0.5) * window.innerHeight;
    g.label.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%)`;
    g.label.style.opacity = state.travel ? 0 : (onScreen ? facing * (0.75 + 0.25 * g.hover) : 0);
    g.label.classList.toggle('lit', state.hover === i);
  });

  if (t > nextOmen && !state.travel) omen(t);

  engraveMat.uniforms.uTime.value = t;
  engraveMat.uniforms.uFeedback.value = frameNo < 2 ? 0 : feedback;
  engraveMat.uniforms.uInvert.value = t < fx.invertUntil ? 1 : 0;

  if (RAW) {
    renderer.setRenderTarget(null);
    renderer.render(scene, camera);
    frameNo++;
    requestAnimationFrame(tick);
    return;
  }
  renderer.setRenderTarget(rtScene);
  renderer.render(scene, camera);
  engraveMat.uniforms.tPrev.value = rtB.texture;
  renderer.setRenderTarget(rtA);
  renderer.render(postScene, orthoCam);
  displayMat.uniforms.tSrc.value = rtA.texture;
  renderer.setRenderTarget(null);
  renderer.render(displayScene, orthoCam);
  [rtA, rtB] = [rtB, rtA];
  frameNo++;

  requestAnimationFrame(tick);
}

requestAnimationFrame(tick);

// debugging handle for poking at it from the console
window.__plate = { state, gates, enter, omen: () => omen(clock.elapsedTime), fx };
