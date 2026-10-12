// 404 / the plain after the sun went out. The eye is all that's left in the
// sky, and it's searching: a cold light follows the cursor (or the tilt of a
// phone) across the ground. "404" is laid out in standing stones; whenever the
// eye blinks they scatter and drag themselves back. Three of the four gates
// lie broken. One still stands, faintly lit, and it goes home. The address the
// visitor tried is cut into a fallen slab at their feet.

(function () {
  const THREE = window.THREE;
  const P = window.PLATE;
  const rand = P.mulberry32(404);

  const scene = new THREE.Scene();
  const NIGHT = new THREE.Color(0.035, 0.04, 0.07);
  scene.fog = new THREE.FogExp2(NIGHT, 0.0085);

  const camera = new THREE.PerspectiveCamera(50, 1, 0.5, 1200);

  function groundHeight(x, z) {
    const r = Math.hypot(x, z);
    return (P.fbm(x * 0.01 + 7, z * 0.01 - 3) - 0.5) * 22 * P.smooth(60, 300, r) + (P.vnoise(x * 0.3, z * 0.3) - 0.5) * 0.35;
  }

  // ---------------------------------------------------------------- sky

  const EYE_DIR = new THREE.Vector3(-0.28, 0.36, -1).normalize();
  const skyMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uEye: { value: EYE_DIR }, uBlink: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position.z = gl_Position.w;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime, uBlink;
      uniform vec3 uEye;
      varying vec3 vDir;
      ${P.GLSL_NOISE}
      void main() {
        vec3 d = normalize(vDir);
        float h = d.y;
        float az = atan(d.x, -d.z);
        vec3 col = mix(vec3(0.07, 0.07, 0.12), vec3(0.01, 0.012, 0.03), smoothstep(0.0, 0.6, h));
        col = mix(col, vec3(0.05, 0.05, 0.08), smoothstep(0.0, -0.1, h));
        // a ring of old light where the sun used to sit, very faint
        float horizonGlow = exp(-abs(h) * 30.0) * (0.5 + 0.5 * fbm(vec2(az * 3.0, uTime * 0.02)));
        col += vec3(0.25, 0.12, 0.1) * horizonGlow * 0.4;
        // a halo round the eye, dimming as it shuts
        float ed = acos(clamp(dot(d, uEye), -1.0, 1.0));
        col += vec3(0.5, 0.6, 0.75) * exp(-ed * 4.0) * 0.35 * (1.0 - uBlink);
        // stars, slowly turning
        vec2 sg = vec2((az + uTime * 0.004) * 70.0, h * 70.0);
        float star = step(0.986, hash(floor(sg))) * smoothstep(0.05, 0.35, h);
        col += vec3(0.85, 0.85, 0.95) * star * step(length(fract(sg) - 0.5), 0.2) * (0.6 + 0.4 * sin(uTime * 3.0 + hash(floor(sg)) * 40.0));
        gl_FragColor = vec4(col, 1.0);
      }`,
    side: THREE.BackSide, depthWrite: false, fog: false,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1000, 40, 24), skyMat);
  sky.renderOrder = -10;
  scene.add(sky);

  // the eye, enormous, its pupil turning after the searchlight
  const eyeMat = new THREE.ShaderMaterial({
    uniforms: { map: { value: P.texture('eye_sheet.png') }, uFrame: { value: 0 }, uBlink: { value: 0 }, uLook: { value: new THREE.Vector2() } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D map;
      uniform float uFrame, uBlink;
      uniform vec2 uLook;
      varying vec2 vUv;
      void main() {
        float lid = 0.5 * (1.0 - uBlink) * (1.0 - 0.35 * pow(abs(vUv.x - 0.5) * 2.0, 2.0));
        if (abs(vUv.y - 0.5) > lid) discard;
        vec2 uv = clamp(vUv - uLook * vec2(0.1, 0.07), 0.0, 1.0);
        float c = mod(uFrame, 3.0), r = floor(uFrame / 3.0);
        vec4 t = texture2D(map, vec2((c + uv.x) / 3.0, 1.0 - (r + 1.0 - uv.y) / 2.0));
        if (t.a < 0.5) discard;
        float l = dot(t.rgb, vec3(0.3, 0.59, 0.11));
        gl_FragColor = vec4(mix(vec3(0.02, 0.025, 0.06), vec3(0.85, 0.92, 1.0), smoothstep(0.08, 0.9, l)), 1.0);
      }`,
    depthWrite: false, fog: false,
  });
  const EYE_DIST = 700;
  const eye = new THREE.Mesh(new THREE.PlaneGeometry(330, 330 * (111 / 255)), eyeMat);
  eye.renderOrder = -5;
  scene.add(eye);

  // ---------------------------------------------------------------- light

  scene.add(new THREE.HemisphereLight(0x3a4466, 0x0c0a10, 0.9));
  const moon = new THREE.DirectionalLight(0x8090c0, 0.6);
  moon.position.set(-60, 90, -40);
  scene.add(moon);

  // the searchlight, hung from the eye
  const search = new THREE.SpotLight(0xdde8ff, 9, 0, 0.075, 0.5, 0);
  search.castShadow = true;
  search.shadow.mapSize.set(1024, 1024);
  search.shadow.bias = -0.0008;
  search.shadow.camera.near = 300;
  search.shadow.camera.far = 900;
  scene.add(search, search.target);

  // ---------------------------------------------------------------- ground

  {
    const geo = new THREE.PlaneGeometry(1800, 1800, 180, 180);
    geo.rotateX(-Math.PI / 2);
    const p = geo.attributes.position;
    const cols = new Float32Array(p.count * 3);
    const a = new THREE.Color(0x6a645c), b = new THREE.Color(0x3a3530), c = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i);
      p.setY(i, groundHeight(x, z));
      c.copy(a).lerp(b, P.vnoise(x * 0.05, z * 0.05) * 0.8 + P.smooth(0.6, 0.85, P.fbm(x * 0.02, z * 0.02)) * 0.3);
      c.toArray(cols, i * 3);
    }
    geo.computeVertexNormals();
    geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    const ground = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
    ground.receiveShadow = true;
    scene.add(ground);
    // invisible copy on the clean layer so the carved address sits in the ground properly
    const mask = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ colorWrite: false }));
    mask.layers.set(1);
    scene.add(mask);
  }

  const stoneMat = new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true });

  // scattered stones out to the horizon, thinning near the numerals
  {
    const COUNT = 1800;
    const geo = new THREE.BoxGeometry(1, 1, 1);
    geo.translate(0, 0.5, 0);
    const mesh = new THREE.InstancedMesh(geo, stoneMat, COUNT);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), c = new THREE.Color();
    let n = 0;
    while (n < COUNT) {
      const r = 50 + Math.pow(rand(), 1.4) * 600;
      const a = rand() * Math.PI * 2;
      const x = Math.sin(a) * r, z = -Math.cos(a) * r;
      if (z > -40 && Math.abs(x) < 70) continue;     // keep the monument and foreground clear
      e.set((rand() - 0.5) * 0.4, rand() * Math.PI, (rand() - 0.5) * 0.4);
      q.setFromEuler(e);
      const hgt = 0.6 + Math.pow(rand(), 2.2) * 9;
      m.compose(new THREE.Vector3(x, groundHeight(x, z) - 0.4, z), q, new THREE.Vector3(0.8 + rand() * 2.4, hgt, 0.5 + rand() * 1.2));
      mesh.setMatrixAt(n, m);
      c.setHSL(0.6 + rand() * 0.08, 0.06, 0.3 + rand() * 0.25);
      mesh.setColorAt(n++, c);
    }
    mesh.castShadow = mesh.receiveShadow = true;
    scene.add(mesh);
  }

  // ---------------------------------------------------------------- 404, in stones

  // a dry-stone monument, standing, built in the shape of the number
  const MON_Z = -12;
  const glyph = [];
  {
    const W = 120, H = 48;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const g = cv.getContext('2d');
    g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#fff';
    g.font = 'bold 52px "Times New Roman", Times, serif';
    g.textAlign = 'center';
    g.textBaseline = 'alphabetic';
    g.fillText('404', W / 2, H - 4);
    const px = g.getImageData(0, 0, W, H).data;
    const STEP = 2.6, SCALE = 0.48;
    for (let y = 0; y < H; y += STEP) {
      for (let x = 0; x < W; x += STEP) {
        if (px[(Math.floor(y) * W + Math.floor(x)) * 4] > 120) {
          glyph.push({ x: (x - W / 2) * SCALE, y: (H - 4 - y) * SCALE });
        }
      }
    }
  }
  const N404 = glyph.length;
  const numerals = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), stoneMat, N404);
  numerals.castShadow = numerals.receiveShadow = true;
  scene.add(numerals);
  const baseY = groundHeight(0, MON_Z) - 0.2;
  const stones = glyph.map((p) => {
    const ax = p.x * 1.3 + (rand() - 0.5) * 16, az = MON_Z + 4 + rand() * 16;
    const size = 1.15 + rand() * 0.35;
    return {
      home: new THREE.Vector3(p.x + (rand() - 0.5) * 0.25, baseY + p.y + size / 2, MON_Z + (rand() - 0.5) * 0.5),
      away: new THREE.Vector3(ax, groundHeight(ax, az) + 0.5, az),
      w: size, h: size * (0.85 + rand() * 0.3), d: 1.2 + rand() * 0.9,
      rot: new THREE.Euler((rand() - 0.5) * 0.12, (rand() - 0.5) * 0.18, (rand() - 0.5) * 0.12),
      fall: new THREE.Euler((rand() - 0.5) * 3, rand() * 6, (rand() - 0.5) * 3),
      lag: rand(),
      col: new THREE.Color().setHSL(0.07 + rand() * 0.06, 0.1, 0.4 + rand() * 0.25),
    };
  });
  stones.forEach((s, i) => numerals.setColorAt(i, s.col));

  // ---------------------------------------------------------------- the gates

  const stone = new THREE.MeshLambertMaterial({ color: 0x8a7e72, flatShading: true });
  function part(parent, w, h, d, x, y, z, rx = 0, ry = 0, rz = 0, mat = stone) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, rz);
    m.castShadow = m.receiveShadow = true;
    parent.add(m);
    return m;
  }

  // three of them, down: pillars toppled, lintels cracked across the ground
  [[-62, -40, 0.7], [58, -55, -0.5], [-30, -95, 0.2]].forEach(([x, z, ry]) => {
    const g = new THREE.Group();
    g.position.set(x, groundHeight(x, z), z);
    g.rotation.y = ry;
    scene.add(g);
    part(g, 10, 0.6, 3.8, 0, 0.3, 0);
    part(g, 1.7, 9.2, 1.7, -3.05, 0.85, 3.4, Math.PI / 2 - 0.08, 0.2, 0);
    part(g, 1.7, 5.0, 1.7, 3.05, 2.5, 0, 0, 0, 0.05);
    part(g, 1.7, 4.0, 1.7, 5.4, 0.85, 2.2, Math.PI / 2, 0.9, 0);
    part(g, 4.3, 1.6, 2.3, -1.9, 0.75, -3.6, 0, 0.4, 0.06);
    part(g, 4.0, 1.6, 2.3, 2.6, 0.7, -4.4, 0, -0.3, -0.1);
  });

  // the one still standing: the way home
  const HOME = new THREE.Vector3(38, 0, -46);
  HOME.y = groundHeight(HOME.x, HOME.z) - 0.2;
  const homeGate = new THREE.Group();
  homeGate.position.copy(HOME);
  homeGate.lookAt(0, HOME.y, 40);
  scene.add(homeGate);
  const gp = [];
  gp.push(part(homeGate, 10, 0.6, 3.8, 0, 0.3, 0));
  gp.push(part(homeGate, 1.7, 9.2, 1.7, -3.05, 5.0, 0, 0, 0, 0.012));
  gp.push(part(homeGate, 1.7, 9.2, 1.7, 3.05, 5.0, 0, 0, 0, -0.02));
  gp.push(part(homeGate, 8.6, 1.6, 2.3, 0, 10.2, 0, 0, 0, -0.018));
  const portalMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uLit: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime, uLit;
      varying vec2 vUv;
      ${P.GLSL_NOISE}
      void main() {
        // a sliver of the old sunset, still burning through
        vec2 p = (vUv - vec2(0.5, 0.25)) * vec2(1.0, 2.0);
        float r = length(p);
        vec3 col = mix(vec3(1.0, 0.7, 0.3), vec3(0.5, 0.12, 0.08), smoothstep(0.0, 1.2, r));
        float a = atan(p.y, p.x);
        col += vec3(1.0, 0.6, 0.25) * pow(abs(sin(a * 17.0 + uTime * 0.1)), 20.0) * smoothstep(1.4, 0.2, r) * 0.6;
        col *= 0.18 + 0.95 * uLit + 0.06 * sin(uTime * 2.0);
        float edge = smoothstep(0.0, 0.06, vUv.x) * smoothstep(1.0, 0.94, vUv.x) * smoothstep(0.0, 0.04, vUv.y) * smoothstep(1.0, 0.96, vUv.y);
        gl_FragColor = vec4(col * edge, 1.0);
      }`,
    fog: false,
  });
  const portal = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 8.8), portalMat);
  portal.position.set(0, 5.0, 0);
  homeGate.add(portal);
  const homeLight = new THREE.PointLight(0xff8a3a, 10, 40, 1.4);
  homeLight.position.set(0, 6, 4);
  homeGate.add(homeLight);
  const flames = [];
  for (const side of [-1, 1]) {
    const fl = P.flameSprite();
    fl.scale.set(2.3, 4.0, 1);
    fl.position.set(side * 3.4, 12.9, 0.2);
    homeGate.add(fl);
    flames.push(fl);
  }
  const homeParts = gp.concat([portal]);
  homeParts.forEach((m) => { m.userData.home = true; });
  const homePin = document.querySelector('.pin[data-home]');

  // ---------------------------------------------------------------- the slab with the address on it

  const SLAB = innerWidth < innerHeight ? new THREE.Vector3(-0.5, 0, 70) : new THREE.Vector3(-1.5, 0, 22);
  SLAB.y = groundHeight(SLAB.x, SLAB.z);
  const slab = new THREE.Group();
  slab.position.copy(SLAB);
  slab.rotation.set(-1.2, 0.08, 0.03);          // fallen back, face up toward you
  scene.add(slab);
  const SW = 9, SH = 2.6;
  const slabBody = part(slab, SW, SH, 0.8, 0, 0, 0, 0, 0, 0, new THREE.MeshLambertMaterial({ color: 0x7e7468, flatShading: true }));
  const slabMask = new THREE.Mesh(slabBody.geometry, new THREE.MeshBasicMaterial({ colorWrite: false }));
  slabMask.layers.set(1);
  slab.add(slabMask);

  function triedAddress() {
    let path = location.protocol === 'file:' ? '/' + location.pathname.split('/').pop() : location.pathname;
    try { path = decodeURIComponent(path); } catch { /* keep it raw */ }
    path = path.replace(/[\u0000-\u001f]/g, '');
    return path.length > 34 ? path.slice(0, 33) + '…' : path;
  }
  {
    const text = triedAddress();
    const w = 1024, h = Math.round(1024 * SH / SW);
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const g = cv.getContext('2d');
    let size = Math.floor(h * 0.5);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const fit = () => { g.font = `bold ${size}px "Times New Roman", Times, serif`; return g.measureText(text).width; };
    while (fit() > w * 0.88 && size > 10) size -= 2;
    g.lineJoin = 'round';
    g.lineWidth = Math.max(4, size * 0.14);
    g.strokeStyle = 'rgba(10, 8, 12, 0.95)';
    g.strokeText(text, w / 2, h / 2 + size * 0.04);
    g.fillStyle = '#e9e2d4';
    g.fillText(text, w / 2, h / 2 + size * 0.04);
    const tex = new THREE.CanvasTexture(cv);
    tex.anisotropy = 4;
    const letters = new THREE.Mesh(new THREE.PlaneGeometry(SW * 0.94, SH * 0.86), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
    letters.position.z = 0.41;
    letters.layers.set(1);
    letters.renderOrder = 2;
    slab.add(letters);
  }

  // ---------------------------------------------------------------- ash, falling the wrong way

  const ashMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uCam: { value: new THREE.Vector3() } },
    vertexShader: /* glsl */ `
      attribute vec3 seed;
      uniform float uTime;
      uniform vec3 uCam;
      void main() {
        vec3 box = vec3(140.0, 60.0, 140.0);
        vec3 p = seed * box + vec3(sin(uTime * 0.2 + seed.y * 9.0) * 2.0, uTime * (0.7 + seed.x * 0.9), uTime * -0.3);
        p = mod(p - uCam, box) - box * 0.5 + uCam;
        gl_PointSize = 1.0 + step(0.9, seed.z);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: /* glsl */ `void main() { gl_FragColor = vec4(0.75, 0.78, 0.85, 1.0); }`,
    depthWrite: false, fog: false,
  });
  {
    const n = 3000;
    const seeds = new Float32Array(n * 3);
    for (let i = 0; i < n * 3; i++) seeds[i] = rand();
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute('seed', new THREE.BufferAttribute(seeds, 3));
    const pts = new THREE.Points(g, ashMat);
    pts.frustumCulled = false;
    scene.add(pts);
  }

  // ---------------------------------------------------------------- plate + input

  const fx = { blinkT: -1, scatter: 0, scatterT: -1, nextBlink: 9 };
  const plate = P.create({
    scene, camera, fov: [50, 70], clean: true,
    omens: { extras: [(t) => blink(t)] },
  });
  if (!plate) return;

  const portrait = () => innerWidth < innerHeight;
  const CAM = new THREE.Vector3();
  const LOOK = new THREE.Vector3(0, -2, -8);
  function frame() {
    if (portrait()) { CAM.set(0, 11, 104); LOOK.set(0, 10, MON_Z); }
    else { CAM.set(0, 9, 52); LOOK.set(0, 9.5, MON_Z); }
  }
  frame();
  window.addEventListener('resize', frame);

  const pickHome = P.picker(camera, homeParts);
  const look = P.follow(plate, {
    rate: 0.9,
    onTap(pointer) { if (pickHome(pointer)) goHome(); },
  });

  function goHome() {
    if (plate.leaving) return;
    const from = camera.position.clone();
    const target = HOME.clone().add(new THREE.Vector3(0, 4.6, 0));
    const toCam = from.clone().sub(target).normalize();
    plate.leave('index.html', {
      duration: 2.4,
      onProgress(e) {
        camera.position.lerpVectors(from, target.clone().addScaledVector(toCam, 1.5), e);
        camera.lookAt(target.x, target.y + (1 - e) * -6, target.z - 10);
        portalMat.uniforms.uLit.value = 1;
      },
    });
  }
  // the header's Home link takes the same walk
  document.querySelectorAll('.site-header a').forEach((a) => {
    if (a.getAttribute('href') !== 'index.html') return;
    a.addEventListener('click', (e) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      goHome();
    }, true);
  });

  function blink(t) {
    if (fx.blinkT >= 0) return;
    fx.blinkT = t;
    // the stones lose their place while it can't see
    if (!P.reduceMotion) fx.scatterT = t + 0.12;
  }

  // where on the ground the light is pointing
  const ray = new THREE.Raycaster();
  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const aim = new THREE.Vector3(0, 0, 0);
  const aimTarget = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  const m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), e4 = new THREE.Euler(), s4 = new THREE.Vector3(), p4 = new THREE.Vector3();
  let hoverHome = false;

  plate.run((dt, t) => {
    look.update(dt, t);
    if (!plate.leaving) {
      camera.position.set(CAM.x + look.x * 6, CAM.y + look.y * 2 + Math.sin(t * 0.2) * 0.3, CAM.z);
      camera.lookAt(LOOK.x + look.x * 3, LOOK.y + look.y * 1.5, LOOK.z);
    }

    // the searchlight: on desktop it follows the cursor over the ground;
    // otherwise it wanders, nudged by the tilt
    if (look.hovering()) {
      ray.setFromCamera(look.pointer, camera);
      if (ray.ray.intersectPlane(groundPlane, tmp) && tmp.z < 60) aimTarget.copy(tmp);
    } else {
      aimTarget.set(Math.sin(t * 0.13) * 30 + look.x * 40, 0, MON_Z + 8 + Math.sin(t * 0.09 + 1) * 16 - look.y * 30);
    }
    aimTarget.x = THREE.MathUtils.clamp(aimTarget.x, -140, 140);
    aimTarget.z = THREE.MathUtils.clamp(aimTarget.z, -200, 60);
    // it lags, like something heavy being swung
    aim.x = P.damp(aim.x, aimTarget.x, 1.4, dt);
    aim.z = P.damp(aim.z, aimTarget.z, 1.4, dt);
    aim.y = groundHeight(aim.x, aim.z);

    // eye hangs over the far side of the plain, looking down at the light
    eye.position.copy(camera.position).addScaledVector(EYE_DIR, EYE_DIST);
    eye.lookAt(camera.position);
    search.position.copy(eye.position).multiplyScalar(0.5);
    search.target.position.copy(aim);
    search.target.updateMatrixWorld();
    tmp.copy(aim).sub(search.position).normalize();
    eyeMat.uniforms.uLook.value.set(THREE.MathUtils.clamp(tmp.x * 4, -1, 1), THREE.MathUtils.clamp(-tmp.z * 2 - 1.2, -1, 1));
    eyeMat.uniforms.uFrame.value = Math.floor(t * 7) % 6;

    // blinking, on its own schedule and sometimes when an omen says so
    if (t > fx.nextBlink && fx.blinkT < 0) { blink(t); fx.nextBlink = t + 7 + Math.random() * 9; }
    let lid = 0;
    if (fx.blinkT >= 0) {
      const b = (t - fx.blinkT) / 0.55;
      lid = b >= 1 ? 0 : Math.sin(b * Math.PI);
      if (b >= 1) fx.blinkT = -1;
    }
    eyeMat.uniforms.uBlink.value = lid;
    skyMat.uniforms.uBlink.value = lid;
    search.intensity = (9 + 0.4 * Math.sin(t * 13)) * (1 - lid);

    // the numerals: blown apart, then dragging themselves home
    let k = 0;
    if (fx.scatterT >= 0) {
      const u = t - fx.scatterT;
      const out = 0.35, back = 3.2;
      if (u < out) k = u / out;
      else if (u < out + back) k = 1 - (u - out) / back;
      else { k = 0; fx.scatterT = -1; }
      k = Math.max(0, Math.min(1, k));
    }
    const qa = new THREE.Quaternion(), qb = new THREE.Quaternion();
    stones.forEach((s, i) => {
      // falling is quick and all at once; climbing back is slow and in turns
      let e;
      if (fx.scatterT >= 0 && t - fx.scatterT < 0.35) e = k;
      else { const kk = Math.max(0, Math.min(1, (k - s.lag * 0.45) / 0.55)); e = kk; }
      e = e * e * (3 - 2 * e);
      p4.lerpVectors(s.home, s.away, e);
      p4.y += Math.sin(e * Math.PI) * (2 + s.lag * 5);
      qa.setFromEuler(s.rot); qb.setFromEuler(s.fall);
      q4.slerpQuaternions(qa, qb, e);
      s4.set(s.w, s.h, s.d);
      m4.compose(p4, q4, s4);
      numerals.setMatrixAt(i, m4);
    });
    numerals.instanceMatrix.needsUpdate = true;

    // the way home brightens when the light finds it, or when you point at it
    const onHome = P.smooth(16, 4, Math.hypot(HOME.x - aim.x, HOME.z - aim.z));
    const hh = !plate.leaving && look.hovering() && !!pickHome(look.pointer);
    if (hh !== hoverHome) {
      hoverHome = hh;
      plate.canvas.classList.toggle('over-thing', hh);
      homePin.classList.toggle('lit', hh);
    }
    if (!plate.leaving) portalMat.uniforms.uLit.value = P.damp(portalMat.uniforms.uLit.value, Math.max(onHome, hh ? 1 : 0), 4, dt);
    portalMat.uniforms.uTime.value = t;
    homeLight.intensity = 8 + 40 * portalMat.uniforms.uLit.value + 4 * P.vnoise(t * 6, 3);
    flames.forEach((f) => { f.visible = portalMat.uniforms.uLit.value > 0.25 || Math.sin(t * 9 + f.position.x) > 0.6; });
    P.pin(homePin, HOME.clone().add(new THREE.Vector3(0, 15, 0)), camera, { cone: 0.1, opacity: 0.5 + 0.5 * portalMat.uniforms.uLit.value });

    skyMat.uniforms.uTime.value = t;
    sky.position.copy(camera.position);
    ashMat.uniforms.uTime.value = t;
    ashMat.uniforms.uCam.value.copy(camera.position);
    P.animateFlames(scene, t);
  });
})();
