// plate.js / the shared engine.
// Every page renders its own little world at a fraction of screen resolution,
// then this re-prints it as a hand-coloured relief plate: hatching by tone,
// contour lines from depth, an off-register colour wash crushed into a small
// palette, plate grain, negative dust, and a little feedback so motion stains.
// Pages arrive by developing out of blank paper and leave by burning back to it.

(function () {
  const THREE = window.THREE;
  THREE.ColorManagement.enabled = false;

  const P = (window.PLATE = {});
  P.reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  P.raw = new URLSearchParams(location.search).has('raw');
  const ASSETS = window.PLATE_ASSETS || {};

  // ---------------------------------------------------------------- tuning

  // every visual knob, with the values the site ships with
  P.TUNE = [
    { key: 'resolution', label: 'resolution', min: 120, max: 1000, def: 610, step: 10, hint: 'rows of pixels the world is drawn at' },
    { key: 'light', label: 'light', min: 0.6, max: 3.2, def: 0.6, step: 0.01, hint: 'how bright the scene reads before inking' },
    { key: 'contrast', label: 'contrast', min: 0.3, max: 1.6, def: 0.3, step: 0.01, hint: 'curve on the light; low = flatter' },
    { key: 'ink', label: 'ink', min: -0.3, max: 0.4, def: 0.015, step: 0.005, hint: 'how readily hatching appears' },
    { key: 'hatch', label: 'hatch gap', min: 2, max: 14, def: 4.7, step: 0.1, hint: 'spacing between hatch lines' },
    { key: 'tremor', label: 'tremor', min: 0, max: 5, def: 5, step: 0.01, hint: 'how shaky the burin hand is' },
    { key: 'boil', label: 'boil', min: 0, max: 24, def: 0, step: 0.5, hint: 'times a second the lines redraw' },
    { key: 'contour', label: 'contour', min: 0, max: 1, def: 1, step: 0.01, hint: 'outlines from depth' },
    { key: 'palette', label: 'palette', min: 0, max: 1, def: 1, step: 0.01, hint: '0 = true colour, 1 = crushed to 12' },
    { key: 'dither', label: 'dither', min: 0, max: 0.35, def: 0.045, step: 0.005, hint: 'ordered noise in the colour' },
    { key: 'misregister', label: 'misregister', min: 0, max: 10, def: 0, step: 0.1, hint: 'colour slipping off the line' },
    { key: 'burn', label: 'burn', min: 0.2, max: 1.0, def: 0.7, step: 0.01, hint: 'how bright before light eats the ink' },
    { key: 'smear', label: 'smear', min: 0, max: 0.95, def: 0, step: 0.01, hint: 'how much each frame stains the next' },
    { key: 'dust', label: 'dust', min: 0, max: 12, def: 0, step: 0.1, hint: 'specks on the negative' },
    { key: 'scratches', label: 'scratches', min: 0, max: 1, def: 0, step: 0.01, hint: 'how often a scratch runs down the frame' },
    { key: 'follow', label: 'follow', min: 0, max: 3, def: 0.47, step: 0.01, hint: 'how far the camera leans after the mouse' },
  ];
  const TUNE_KEY = 'plateTune2';
  P.tune = {};
  P.TUNE.forEach((d) => { P.tune[d.key] = d.def; });
  try {
    const saved = JSON.parse(localStorage.getItem(TUNE_KEY) || '{}');
    P.TUNE.forEach((d) => { if (typeof saved[d.key] === 'number') P.tune[d.key] = Math.min(d.max, Math.max(d.min, saved[d.key])); });
  } catch { /* defaults it is */ }
  P.plates = [];
  P.setTune = function (key, value) {
    P.tune[key] = value;
    P.plates.forEach((p) => p.applyTune());
    try { localStorage.setItem(TUNE_KEY, JSON.stringify(P.tune)); } catch { /* fine */ }
  };

  // ---------------------------------------------------------------- maths

  P.mulberry32 = function (a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  P.h2 = function (x, y) {
    const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return s - Math.floor(s);
  };
  P.vnoise = function (x, y) {
    const ix = Math.floor(x), iy = Math.floor(y);
    let fx = x - ix, fy = y - iy;
    fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
    const h = P.h2;
    const a = h(ix, iy), b = h(ix + 1, iy), c = h(ix, iy + 1), d = h(ix + 1, iy + 1);
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  };
  P.fbm = function (x, y) {
    let s = 0, a = 0.5;
    for (let i = 0; i < 5; i++) { s += a * P.vnoise(x, y); x *= 2.03; y *= 2.03; a *= 0.5; }
    return s;
  };
  P.smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  P.damp = (a, b, rate, dt) => a + (b - a) * (1 - Math.exp(-rate * dt));

  P.GLSL_NOISE = /* glsl */ `
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

  // ---------------------------------------------------------------- textures

  P.nearest = function (tex) {
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    return tex;
  };

  // Images are inlined as data URIs (assets.js) so WebGL can use them even when
  // the page is opened straight from disk.
  const images = {};
  P.image = function (name) {
    if (!images[name]) {
      const img = new Image();
      img.src = ASSETS[name] || 'assets/' + name;
      images[name] = img;
    }
    return images[name];
  };
  P.texture = function (name) {
    const img = P.image(name);
    const tex = P.nearest(new THREE.Texture(img));
    const ready = () => { tex.needsUpdate = true; };
    if (img.complete && img.naturalWidth) ready();
    else img.addEventListener('load', ready, { once: true });
    return tex;
  };
  // a fresh texture per sprite so each can sit on its own frame
  P.sheet = function (name, cols, rows) {
    const tex = P.texture(name);
    tex.repeat.set(1 / cols, 1 / rows);
    tex.userData.grid = [cols, rows];
    return tex;
  };
  P.frame = function (tex, i) {
    const [cols, rows] = tex.userData.grid;
    const f = ((i % (cols * rows)) + cols * rows) % (cols * rows);
    tex.offset.set((f % cols) / cols, 1 - (Math.floor(f / cols) + 1) / rows);
  };

  P.canvasTexture = function (w, h, draw) {
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    draw(cv.getContext('2d'), w, h);
    return P.nearest(new THREE.CanvasTexture(cv));
  };

  // rough stone with something cut into it
  P.inscribe = function (g, text, x, y, size, opts = {}) {
    g.font = `${opts.italic ? 'italic ' : ''}bold ${size}px "Times New Roman", Times, serif`;
    g.textAlign = opts.align || 'center';
    g.textBaseline = 'middle';
    g.fillStyle = opts.shadow || '#140a04';
    g.fillText(text, x + Math.max(1, size / 26), y + Math.max(1, size / 26));
    g.fillStyle = opts.color || '#e0b643';
    g.fillText(text, x, y);
  };
  P.stoneFill = function (g, w, h, base = '#6a5640', rand = Math.random) {
    g.fillStyle = base;
    g.fillRect(0, 0, w, h);
    const n = Math.round((w * h) / 30);
    for (let i = 0; i < n; i++) {
      g.fillStyle = rand() < 0.5 ? 'rgba(20,10,4,0.32)' : 'rgba(200,170,120,0.16)';
      g.fillRect(rand() * w, rand() * h, 1 + rand() * 2, 1);
    }
  };

  // ---------------------------------------------------------------- shared materials

  P.flameSprite = function (opts = {}) {
    const tex = P.sheet('flames_sheet.png', 4, 3);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: tex, blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
      color: opts.color ?? 0xffd9a0,
    }));
    sprite.userData.flame = { tex, offset: Math.floor(Math.random() * 12), rate: 10 + Math.random() * 4 };
    return sprite;
  };
  P.animateFlames = function (root, t) {
    root.traverse((o) => {
      const f = o.userData.flame;
      if (f) P.frame(f.tex, Math.floor(t * f.rate) + f.offset);
    });
  };

  // ---------------------------------------------------------------- the plate

  const ENGRAVE_FRAG = /* glsl */ `
    precision highp float;
    uniform sampler2D tScene, tDepth, tPrev;
    uniform vec2 uRes;
    uniform float uTime, uFeedback, uInvert, uWhite, uNear, uFar, uInk;
    uniform float uGain, uGamma, uHatch, uWob, uEdge, uPal, uDither, uMisreg, uBurn, uDust, uScratch, uBoil;
    varying vec2 vUv;
    ${P.GLSL_NOISE}

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
      float boil = floor(uTime * uBoil);

      vec3 c = texture2D(tScene, uv).rgb;
      float L = pow(clamp(luma(c) * uGain, 0.0, 1.0), uGamma);

      // colour laid on by hand, off the line by a couple of pixels
      vec2 mo = vec2(1.0, -0.5) * uMisreg * tx;
      vec3 w = (texture2D(tScene, uv + mo).rgb
              + texture2D(tScene, uv + mo + vec2(2.0 * tx.x, 0.0)).rgb
              + texture2D(tScene, uv + mo + vec2(0.0, 2.0 * tx.y)).rgb
              + texture2D(tScene, uv + mo - 2.0 * tx).rgb) * 0.25;
      vec3 wc = pow(clamp(w * 1.45, 0.0, 1.0), vec3(0.8));
      wc += (bayer4(px) - 0.5) * uDither;
      vec3 wash = mix(wc, pal(wc), uPal) * (0.86 + 0.16 * noise(px * 0.8) + 0.06 * noise(px * 0.05));

      // the burin
      float wob = ((noise(px * 0.09 + boil * 17.0) - 0.5) * 0.9 + (noise(px * 0.016) - 0.5) * 7.0) * uWob;
      float j = (hash(px * 0.37 + boil) - 0.5) * 0.05 + uInk;
      float ink = 0.0;
      ink = max(ink, hatch(px, 0.79, uHatch, wob) * step(L, 0.40 + j));
      ink = max(ink, hatch(px, -0.79, uHatch, wob * 0.8) * step(L, 0.25 + j));
      ink = max(ink, hatch(px, 0.0, max(2.0, uHatch * 0.6), wob * 0.6) * step(L, 0.13 + j));
      ink = max(ink, step(L, 0.05 + j) * step(0.35, hash(px + boil)));

      // contour lines from depth
      float z = linZ(uv);
      float zl = linZ(uv - vec2(tx.x, 0.0)), zr = linZ(uv + vec2(tx.x, 0.0));
      float zu = linZ(uv + vec2(0.0, tx.y)), zd = linZ(uv - vec2(0.0, tx.y));
      float lap = (abs(zl + zr - 2.0 * z) + abs(zu + zd - 2.0 * z)) / max(z, 1.0);
      float eth = mix(0.6, 0.02, uEdge);
      float edge = step(eth, lap) * step(z, uFar * 0.95 + 1.0);
      edge = max(edge, step(eth, lap) * step(zl + zr + zu + zd, uFar * 3.9));
      edge *= step(0.01, uEdge);
      ink = max(ink, edge);

      // hot things burn through the ink
      float burn = smoothstep(uBurn, uBurn + 0.28, L);
      ink *= 1.0 - burn;
      vec3 hc = clamp(c * 1.2, 0.0, 1.0);
      vec3 hot = mix(wash, mix(hc, pal(hc), uPal), burn);

      vec3 INK = vec3(0.045, 0.028, 0.024);
      vec3 col = mix(hot, INK, ink);

      // dust on the negative, and the odd scratch
      col = mix(col, vec3(0.93, 0.87, 0.71), step(1.0 - 0.0006 * uDust, hash(px * 1.31 + boil * 3.1)));
      float sx = floor(hash(vec2(boil, 9.0)) * uRes.x);
      float scratch = step(1.0 - uScratch, hash(vec2(boil, 2.0))) * step(abs(px.x - sx), 0.5)
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

      // blank paper, eaten away by the image from the hottest parts outward
      float paper = uWhite * 1.25 - (1.0 - L) * 0.25 - noise(px * 0.07) * 0.18;
      col = mix(col, vec3(0.93, 0.87, 0.71), clamp(smoothstep(0.35, 0.75, paper), 0.0, 1.0) * step(0.001, uWhite));
      gl_FragColor = vec4(col, 1.0);
    }`;

  const QUAD_VERT = /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

  P.create = function (opts) {
    const canvas = opts.canvas || document.getElementById('plate');
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    } catch (err) {
      document.body.classList.add('no-gl');
      console.warn('no WebGL, falling back to the plain page', err);
      return null;
    }
    renderer.setPixelRatio(1);
    renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.BasicShadowMap;

    const { scene, camera } = opts;
    const fovs = opts.fov || [camera.fov, camera.fov];
    let pixelTarget = opts.pixel || P.tune.resolution;
    let feedbackBase = P.reduceMotion ? 0 : (opts.feedback ?? P.tune.smear);

    const engraveMat = new THREE.ShaderMaterial({
      uniforms: {
        tScene: { value: null }, tDepth: { value: null }, tPrev: { value: null },
        uRes: { value: new THREE.Vector2(1, 1) },
        uTime: { value: 0 }, uFeedback: { value: 0 }, uInvert: { value: 0 },
        uWhite: { value: 1 }, uInk: { value: opts.ink || 0 },
        uGain: { value: 1.7 }, uGamma: { value: 0.72 }, uHatch: { value: 5 }, uWob: { value: 1 }, uEdge: { value: 0.87 },
        uPal: { value: 1 }, uDither: { value: 0.055 }, uMisreg: { value: 2 }, uBurn: { value: 0.62 }, uDust: { value: 1 },
        uScratch: { value: 0.14 }, uBoil: { value: 5 },
        uNear: { value: camera.near }, uFar: { value: camera.far },
      },
      vertexShader: QUAD_VERT,
      fragmentShader: ENGRAVE_FRAG,
      depthTest: false, depthWrite: false,
    });
    // anything on layer 1 is drawn again at full resolution and laid over
    // the print untouched (used for things that must stay legible)
    const displayMat = new THREE.ShaderMaterial({
      uniforms: { tSrc: { value: null }, tClean: { value: null }, uClean: { value: 0 }, uWhite: { value: 0 } },
      vertexShader: QUAD_VERT,
      fragmentShader: /* glsl */ `
        uniform sampler2D tSrc, tClean;
        uniform float uClean, uWhite;
        varying vec2 vUv;
        void main() {
          vec3 col = texture2D(tSrc, vUv).rgb;
          if (uClean > 0.5) {
            vec4 cl = texture2D(tClean, vUv);
            col = mix(col, mix(cl.rgb, vec3(0.93, 0.87, 0.71), uWhite), cl.a);
          }
          gl_FragColor = vec4(col, 1.0);
        }`,
      depthTest: false, depthWrite: false,
    });
    const quad = new THREE.PlaneGeometry(2, 2);
    const postScene = new THREE.Scene();
    postScene.add(new THREE.Mesh(quad, engraveMat));
    const displayScene = new THREE.Scene();
    displayScene.add(new THREE.Mesh(quad, displayMat));
    const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    const rtOpts = { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, generateMipmaps: false, depthBuffer: false };
    let rtScene, rtA, rtB, rtClean;

    const plate = {
      THREE, renderer, scene, camera, canvas,
      uniforms: engraveMat.uniforms,
      W: 0, H: 0, vw: 0, vh: 0,
      feedback: feedbackBase, feedbackBase,
      arrive: P.reduceMotion || P.raw ? 0 : 1,
      leaving: null,
      flash: 0,
      invertUntil: 0,
      t: 0,
      frame: 0,
    };

    plate.resize = function () {
      const vw = window.innerWidth, vh = window.innerHeight;
      plate.vw = vw; plate.vh = vh;
      const pix = Math.max(2, Math.round(Math.min(vw, vh * 1.6) / pixelTarget));
      plate.W = Math.ceil(vw / pix);
      plate.H = Math.ceil(vh / pix);
      renderer.setSize(vw, vh, false);
      camera.aspect = vw / vh;
      camera.fov = vw < vh ? fovs[1] : fovs[0];
      camera.clearViewOffset();
      if (opts.onResize) opts.onResize(vw, vh, plate);
      camera.updateProjectionMatrix();

      rtScene?.depthTexture?.dispose();
      rtScene?.dispose(); rtA?.dispose(); rtB?.dispose();
      rtScene = new THREE.WebGLRenderTarget(plate.W, plate.H, {
        minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, generateMipmaps: false,
        depthBuffer: true, depthTexture: new THREE.DepthTexture(plate.W, plate.H),
      });
      rtA = new THREE.WebGLRenderTarget(plate.W, plate.H, rtOpts);
      rtB = new THREE.WebGLRenderTarget(plate.W, plate.H, rtOpts);
      if (opts.clean) {
        rtClean?.dispose();
        rtClean = new THREE.WebGLRenderTarget(vw, vh, { generateMipmaps: false });
        displayMat.uniforms.tClean.value = rtClean.texture;
        displayMat.uniforms.uClean.value = 1;
      }
      engraveMat.uniforms.uRes.value.set(plate.W, plate.H);
      engraveMat.uniforms.tScene.value = rtScene.texture;
      engraveMat.uniforms.tDepth.value = rtScene.depthTexture;
      plate.frame = 0;
    };
    window.addEventListener('resize', plate.resize);
    plate.resize();

    // live tuning (the knobs on the homepage write P.tune; every page reads it)
    plate.applyTune = function () {
      const T = P.tune, u = engraveMat.uniforms;
      u.uGain.value = T.light; u.uGamma.value = T.contrast; u.uInk.value = (opts.ink || 0) + T.ink;
      u.uHatch.value = T.hatch; u.uWob.value = T.tremor; u.uEdge.value = T.contour;
      u.uPal.value = T.palette; u.uDither.value = T.dither; u.uMisreg.value = T.misregister;
      u.uBurn.value = T.burn; u.uDust.value = T.dust; u.uScratch.value = T.scratches; u.uBoil.value = T.boil;
      if (!P.reduceMotion && opts.feedback === undefined) plate.feedbackBase = T.smear;
      const want = opts.pixel || T.resolution;
      if (want !== pixelTarget) { pixelTarget = want; plate.resize(); }
    };
    plate.applyTune();
    P.plates.push(plate);

    // burn the plate back to paper, then go
    plate.leave = function (href, o = {}) {
      if (plate.leaving) return;
      if (P.reduceMotion) { location.href = href; return; }
      plate.leaving = { href, t: 0, duration: o.duration || 1.1, onProgress: o.onProgress };
      document.body.classList.add('leaving');
      P.hum.swell();
    };
    window.addEventListener('pageshow', (e) => {
      if (e.persisted) {
        plate.leaving = null;
        plate.arrive = 0;
        document.body.classList.remove('leaving');
        if (opts.onReturn) opts.onReturn();
      }
    });

    plate.invert = function (sec = 0.11) {
      if (!P.reduceMotion) plate.invertUntil = plate.t + sec;
    };

    plate.run = function (update) {
      const clock = new THREE.Clock();
      function tick() {
        const dt = Math.min(clock.getDelta(), 0.1);
        const t = clock.elapsedTime;
        plate.t = t;

        let leaveK = 0;
        if (plate.leaving) {
          const L = plate.leaving;
          L.t = Math.min(1, L.t + dt / L.duration);
          leaveK = L.t * L.t * (3 - 2 * L.t);
          if (L.onProgress) L.onProgress(leaveK, dt);
          if (L.t >= 1 && !L.gone) { L.gone = true; location.href = L.href; }
        }
        plate.arrive = Math.max(0, plate.arrive - dt / 1.1);

        update(dt, t, leaveK);
        if (plate.omens) plate.omens.update(t);

        if (P.raw) {
          renderer.setRenderTarget(null);
          renderer.render(scene, camera);
          requestAnimationFrame(tick);
          return;
        }

        const u = engraveMat.uniforms;
        u.uTime.value = t;
        const fb = Math.max(plate.feedback, plate.feedbackBase + (0.88 - plate.feedbackBase) * leaveK);
        u.uFeedback.value = plate.frame < 2 ? 0 : fb;
        u.uInvert.value = t < plate.invertUntil ? 1 : 0;
        const a = plate.arrive;
        u.uWhite.value = Math.max(a * a * (3 - 2 * a), P.smooth(0.55, 1.0, leaveK));

        renderer.setRenderTarget(rtScene);
        renderer.render(scene, camera);
        u.tPrev.value = rtB.texture;
        renderer.setRenderTarget(rtA);
        renderer.render(postScene, ortho);
        displayMat.uniforms.tSrc.value = rtA.texture;
        if (rtClean) {
          const bg = scene.background;
          scene.background = null;
          renderer.shadowMap.autoUpdate = false;
          renderer.setClearColor(0x000000, 0);
          camera.layers.set(1);
          renderer.setRenderTarget(rtClean);
          renderer.clear();
          renderer.render(scene, camera);
          camera.layers.set(0);
          renderer.setClearColor(0x000000, 1);
          renderer.shadowMap.autoUpdate = true;
          scene.background = bg;
          displayMat.uniforms.uWhite.value = u.uWhite.value;
        }
        renderer.setRenderTarget(null);
        renderer.render(displayScene, ortho);
        [rtA, rtB] = [rtB, rtA];
        plate.frame++;
        requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    };

    P.wireNav(plate, opts.onNav);
    if (opts.omens) plate.omens = P.omens(plate, opts.omens);
    window.__plate = plate;
    return plate;
  };

  // ---------------------------------------------------------------- navigation

  // header links (and anything marked data-plate-link) burn out instead of cutting
  P.wireNav = function (plate, onNav) {
    const here = location.pathname.split('/').pop() || 'index.html';
    const links = document.querySelectorAll('.site-header a, [data-plate-link]');
    links.forEach((a) => {
      const href = a.getAttribute('href');
      if (!href || href.startsWith('#') || href.startsWith('mailto:') || /^https?:/.test(href)) return;
      a.addEventListener('click', (e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        if (href === here && !a.classList.contains('sigil')) { e.preventDefault(); return; }
        e.preventDefault();
        if (onNav && onNav(href, a)) return;
        plate.leave(href);
      });
    });
  };

  // ---------------------------------------------------------------- input

  // The camera eases after the mouse: aim offsets follow the cursor slowly and
  // decelerate as they arrive. No dragging, no walking: every page is one view.
  P.follow = function (plate, o = {}) {
    const canvas = plate.canvas;
    const c = {
      yaw: 0, pitch: 0, x: 0, y: 0,
      aim: new THREE.Vector2(),          // where the cursor is, -1..1
      pointer: new THREE.Vector2(9, 9),  // same, but only while over the canvas
      vel: new THREE.Vector2(),
      cur: new THREE.Vector2(),
    };
    const range = { yaw: o.yaw ?? 0.2, pitch: o.pitch ?? 0.1 };
    const rate = o.rate ?? 1.4;
    const fine = matchMedia('(pointer: fine)').matches;

    window.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse' || P.dragging) return;
      c.aim.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
      P.woke();
    });
    document.addEventListener('mouseleave', () => c.aim.set(0, 0));

    // phones: lean with the tilt of the device. The resting angle is whatever
    // the person is holding it at (it slowly re-centres), so only movement counts.
    const tilt = { on: false, raw: new THREE.Vector2(), base: null, v: new THREE.Vector2() };
    function onOrient(e) {
      if (e.beta == null || e.gamma == null) return;
      const ang = (screen.orientation && screen.orientation.angle) || window.orientation || 0;
      let x = e.gamma, y = e.beta;                 // portrait: gamma = left/right, beta = toward/away
      if (ang === 90) { x = e.beta; y = -e.gamma; }
      else if (ang === -90 || ang === 270) { x = -e.beta; y = e.gamma; }
      else if (ang === 180) { x = -e.gamma; y = -e.beta; }
      tilt.raw.set(x, y);
      if (!tilt.base) tilt.base = tilt.raw.clone();
      tilt.on = true;
    }
    if (!fine && 'DeviceOrientationEvent' in window) {
      const DOE = window.DeviceOrientationEvent;
      if (typeof DOE.requestPermission === 'function') {
        // iOS asks for permission, and only from a tap
        const ask = () => {
          DOE.requestPermission().then((r) => { if (r === 'granted') window.addEventListener('deviceorientation', onOrient); }).catch(() => {});
          document.removeEventListener('touchend', ask, true);
        };
        document.addEventListener('touchend', ask, true);
      } else {
        window.addEventListener('deviceorientation', onOrient);
      }
    }
    canvas.addEventListener('pointermove', (e) => {
      c.pointer.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    });
    canvas.addEventListener('pointerleave', () => c.pointer.set(9, 9));
    canvas.addEventListener('click', (e) => {
      const p = new THREE.Vector2((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
      P.woke();
      if (o.onTap) o.onTap(p, e);
    });

    c.update = function (dt, t) {
      // a soft spring: quick to start, slow to settle, never snaps
      let tx, ty;
      if (fine) { tx = c.aim.x; ty = c.aim.y; }
      else if (tilt.on) {
        tilt.base.lerp(tilt.raw, Math.min(1, dt * 0.25));      // drift back to centre over a few seconds
        const RANGE = 18;                                       // degrees of tilt for a full lean
        tilt.v.set((tilt.raw.x - tilt.base.x) / RANGE, -(tilt.raw.y - tilt.base.y) / RANGE);
        tx = Math.max(-1, Math.min(1, tilt.v.x)) + Math.sin(t * 0.07) * 0.15;
        ty = Math.max(-1, Math.min(1, tilt.v.y)) + Math.sin(t * 0.05) * 0.1;
      } else {
        tx = Math.sin(t * 0.07) * 0.5;
        ty = Math.sin(t * 0.05) * 0.3;
      }
      const k = rate * rate, damping = 2 * rate;
      c.vel.x += ((tx - c.cur.x) * k - c.vel.x * damping) * dt;
      c.vel.y += ((ty - c.cur.y) * k - c.vel.y * damping) * dt;
      c.cur.x += c.vel.x * dt;
      c.cur.y += c.vel.y * dt;
      c.x = c.cur.x; c.y = c.cur.y;
      const f = P.tune.follow;
      c.x = c.cur.x * f; c.y = c.cur.y * f;
      c.yaw = c.cur.x * range.yaw * f;
      c.pitch = c.cur.y * range.pitch * f;
    };
    c.hovering = () => c.pointer.x < 5;
    return c;
  };

  // aim a camera from a base heading plus the follow offsets
  P.aim = function (camera, yaw, pitch) {
    camera.rotation.order = 'YXZ';
    camera.rotation.y = -yaw;
    camera.rotation.x = pitch;
    camera.rotation.z = 0;
    camera.updateMatrixWorld();
  };

  let wokeOnce = false;
  P.woke = function () {
    if (wokeOnce) return;
    wokeOnce = true;
    setTimeout(() => {
      document.querySelectorAll('.hint').forEach((h) => { h.style.opacity = 0; });
      document.querySelectorAll('.colophon').forEach((h) => h.classList.add('dim'));
    }, 2500);
  };

  P.picker = function (camera, objects, maxDist = Infinity) {
    const ray = new THREE.Raycaster();
    return function (pointer) {
      if (pointer.x > 5) return null;
      ray.setFromCamera(pointer, camera);
      const hit = ray.intersectObjects(objects, false)[0];
      return hit && hit.distance < maxDist ? hit.object : null;
    };
  };

  // pin an HTML element over a point in the world
  const _v = new THREE.Vector3(), _f = new THREE.Vector3(), _d = new THREE.Vector3();
  P.pin = function (el, world, camera, o = {}) {
    _v.copy(world).project(camera);
    camera.getWorldDirection(_f);
    _d.copy(world).sub(camera.position);
    const dist = _d.length();
    const facing = P.smooth(o.cone ?? 0.55, (o.cone ?? 0.55) + 0.3, _f.dot(_d.normalize()));
    const onScreen = _v.z < 1 && Math.abs(_v.x) < 1.15 && Math.abs(_v.y) < 1.15;
    const near = o.far ? P.smooth(o.far, o.far * 0.7, dist) : 1;
    const x = (_v.x * 0.5 + 0.5) * innerWidth;
    const y = (-_v.y * 0.5 + 0.5) * innerHeight;
    el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, ${o.anchor || '-100%'})`;
    const op = onScreen ? facing * near * (o.opacity ?? 1) : 0;
    el.style.opacity = op.toFixed(3);
    el.style.visibility = op < 0.02 ? 'hidden' : 'visible';
    return op;
  };

  // ---------------------------------------------------------------- omens

  P.omens = function (plate, o) {
    const el = document.querySelector('.omen');
    const rand = P.mulberry32(Date.now() & 0xffff);
    let next = 7 + rand() * 6;
    let last = '';
    const texts = [];   // no words surfacing any more, only the visual omens
    const extras = o.extras || [];
    return {
      update(t) {
        if (t < next || plate.leaving) return;
        const roll = rand();
        if (roll < 0.22 && !P.reduceMotion) {
          plate.invert();
        } else if (roll < 0.55 && texts.length && el) {
          let text;
          do { text = texts[Math.floor(rand() * texts.length)]; } while (text === last && texts.length > 1);
          last = text;
          el.textContent = text;
          el.classList.add('show');
          setTimeout(() => el.classList.remove('show'), 3200);
        } else if (extras.length) {
          extras[Math.floor(rand() * extras.length)](t);
        }
        next = t + 9 + rand() * 12;
      },
    };
  };

  // ---------------------------------------------------------------- hum

  // the drone is gone; scenes still call these, so they stay as no-ops
  P.hum = { on: false, set() {}, tone() {}, blip() {}, swell() {} };
})();
