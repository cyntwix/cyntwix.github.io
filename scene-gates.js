// index / a plain of stones under a spent sun, four gates around you.

(function () {
  const THREE = window.THREE;
  const P = window.PLATE;
  const { fbm, vnoise, h2, smooth } = P;
  const rand = P.mulberry32(1757);

  const GATES = [
    { href: 'about.html', numeral: 'I', tone: 98.0 },
    { href: 'videos.html', numeral: 'II', tone: 116.5 },
    { href: 'writing.html', numeral: 'III', tone: 130.8 },
    { href: 'contact.html', numeral: 'IV', tone: 146.8 },
  ];

  function groundHeight(x, z) {
    const r = Math.hypot(x, z);
    const dunes = (fbm(x * 0.008 + 3.1, z * 0.008 - 7.7) - 0.5) * 34 * smooth(30, 260, r);
    const rubble = (vnoise(x * 0.35, z * 0.35) - 0.5) * 0.5;
    return dunes + rubble;
  }

  const CLEAR_R = (innerWidth < innerHeight ? 52 : 44) + 9;

  // ---------------------------------------------------------------- world

  const scene = new THREE.Scene();
  const HORIZON = new THREE.Color(0.42, 0.2, 0.12);
  scene.fog = new THREE.FogExp2(HORIZON, 0.0042);

  const camera = new THREE.PerspectiveCamera(62, 1, 0.5, 2000);
  const EYE_HEIGHT = 2.3;
  const HOME = new THREE.Vector3(0, groundHeight(0, 0) + EYE_HEIGHT, 0);
  camera.position.copy(HOME);

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

  // the stair
  const STAIR_AZ = -0.34, STAIR_DIST = 175, STAIR_HEIGHT = 240;
  const stairBase = new THREE.Vector3(Math.sin(STAIR_AZ) * STAIR_DIST, 0, -Math.cos(STAIR_AZ) * STAIR_DIST);
  stairBase.y = groundHeight(stairBase.x, stairBase.z) - 2;
  const stairTop = stairBase.clone().add(new THREE.Vector3(0, STAIR_HEIGHT, 0));
  const vortexDir = stairTop.clone().add(new THREE.Vector3(0, 90, 0)).sub(camera.position).normalize();

  // ---- sky
  const skyMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 }, uSun: { value: sunDir }, uVortex: { value: vortexDir },
      uFlash: { value: 0 }, uHorizon: { value: HORIZON },
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
      ${P.GLSL_NOISE}
      void main() {
        vec3 d = normalize(vDir);
        float h = d.y;
        float az = atan(d.x, -d.z);

        vec3 zen = vec3(0.025, 0.04, 0.10);
        vec3 mid = vec3(0.17, 0.09, 0.15);
        vec3 col = mix(uHorizon, mid, smoothstep(0.0, 0.22, h));
        col = mix(col, zen, smoothstep(0.18, 0.8, h));
        col = mix(col, uHorizon * 0.55, smoothstep(0.0, -0.08, h));

        float b1 = fbm(vec2(az * 2.4 + uTime * 0.008, h * 13.0 - uTime * 0.015));
        float b2 = fbm(vec2(az * 7.0 - uTime * 0.012, h * 44.0));
        float cloud = smoothstep(0.42, 0.78, b1 * 0.75 + b2 * 0.4)
                    * smoothstep(0.6, 0.04, h) * smoothstep(-0.02, 0.05, h);

        float sd = acos(clamp(dot(d, uSun), -1.0, 1.0));
        float R = 0.165;
        float sunNear = exp(-sd * 2.0);
        col = mix(col, mix(vec3(0.22, 0.09, 0.10), vec3(1.0, 0.56, 0.24), sunNear), cloud * 0.85);

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

        vec2 sg = vec2(az * 60.0, h * 60.0);
        vec2 sc = floor(sg);
        vec2 sf = fract(sg) - 0.5;
        float star = step(0.985, hash(sc)) * smoothstep(0.25, 0.6, h) * (1.0 - vort);
        float cross_ = max(step(abs(sf.x), 0.06) * step(abs(sf.y), 0.4), step(abs(sf.y), 0.06) * step(abs(sf.x), 0.4));
        col += vec3(0.9, 0.84, 0.66) * star * cross_ * 0.8;

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
    side: THREE.BackSide, depthWrite: false, fog: false,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(900, 48, 32), skyMat);
  sky.renderOrder = -10;
  scene.add(sky);

  // ---- the eye inside the sun
  const eyeMat = new THREE.ShaderMaterial({
    uniforms: { map: { value: P.texture('eye_sheet.png') }, uFrame: { value: 0 }, uBlink: { value: 0 } },
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
    depthTest: false, depthWrite: false, fog: false,
  });
  const EYE_DIST = 850;
  const eyeW = 2 * EYE_DIST * Math.tan(0.165) * 0.92;
  const eye = new THREE.Mesh(new THREE.PlaneGeometry(eyeW, eyeW * (111 / 255)), eyeMat);
  eye.renderOrder = -9;
  scene.add(eye);

  // ---- ground
  {
    const geo = new THREE.PlaneGeometry(3200, 3200, 220, 220);
    geo.rotateX(-Math.PI / 2);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) p.setY(i, groundHeight(p.getX(i), p.getZ(i)));
    geo.computeVertexNormals();
    const cols = new Float32Array(p.count * 3);
    const base = new THREE.Color(0x5e4630), ashy = new THREE.Color(0x6e665a), burnt = new THREE.Color(0x2e1a12), c = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i);
      const patch = fbm(x * 0.03 + 11.0, z * 0.03 - 4.0);
      const streak = vnoise(x * 0.012, z * 0.12);
      c.copy(base).lerp(ashy, smooth(0.5, 0.75, patch)).lerp(burnt, smooth(0.55, 0.85, streak) * 0.8);
      c.toArray(cols, i * 3);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    const ground = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
    ground.receiveShadow = true;
    scene.add(ground);
  }

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
      // keep the ground between you and the gates clear
      const ahead = Math.abs(Math.atan2(x, -z));
      if (ahead < 0.95 && r < CLEAR_R) continue;
      const obelisk = rand() < 0.05 && ahead > 0.75;
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
    const steps = new THREE.InstancedMesh(new THREE.BoxGeometry(13, 1.5, 4.2), stone, STEPS);
    const postGeo = new THREE.BoxGeometry(0.6, 3.4, 0.6);
    postGeo.translate(0, 1.7, 0);
    const posts = new THREE.InstancedMesh(postGeo, stone, STEPS);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), p = new THREE.Vector3();
    const one = new THREE.Vector3(1, 1, 1), none = new THREE.Vector3(0, 0, 0);
    for (let i = 0; i < STEPS; i++) {
      const a = i * 0.29;
      const y = (i / STEPS) * STAIR_HEIGHT;
      const gone = i > STEPS * 0.62 && h2(i, 4) < (i / STEPS - 0.62) * 2.2;
      q.setFromAxisAngle(up, -a);
      p.set(Math.cos(a) * 10.5, y, Math.sin(a) * 10.5).add(stairBase);
      m.compose(p, q, gone ? none : one);
      steps.setMatrixAt(i, m);
      p.set(Math.cos(a) * 16.5, y + 0.45, Math.sin(a) * 16.5).add(stairBase);
      m.compose(p, q, gone || i % 3 ? none : one);
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
        gl_PointSize = 1.0 + step(0.82, seed.z);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      varying float vFade;
      void main() { gl_FragColor = vec4(vec3(0.95, 0.86, 0.62) * vFade * 0.55, 1.0); }`,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
  });
  scene.add(seedPoints(6000, funnelMat));

  // ---- ash
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
    depthWrite: false, fog: false,
  });
  scene.add(seedPoints(2600, ashMat));

  function seedPoints(n, mat) {
    const seeds = new Float32Array(n * 3);
    for (let i = 0; i < n * 3; i++) seeds[i] = rand();
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute('seed', new THREE.BufferAttribute(seeds, 3));
    const pts = new THREE.Points(g, mat);
    pts.frustumCulled = false;
    return pts;
  }

  // ---------------------------------------------------------------- the four gates

  // all four stand in a shallow arc ahead, so the whole choice is in view at once
  const portrait = innerWidth < innerHeight;
  const GATE_R = portrait ? 52 : 44;
  const GATE_SPREAD = portrait ? 0.2 : 0.33;
  const gates = [];
  const pickables = [];

  const portalFrag = /* glsl */ `
    uniform float uTime, uHover, uKind;
    varying vec2 vUv;
    ${P.GLSL_NOISE}
    void main() {
      vec2 uv = vUv;
      vec2 p = (uv - 0.5) * vec2(1.0, 2.0);
      float v = 0.0;
      vec3 tint;
      if (uKind < 0.5) {
        float r = length(p * vec2(1.0, 0.8));
        v = 0.5 + 0.5 * sin(r * 30.0 - uTime * 2.2);
        v *= smoothstep(0.95, 0.15, r) * step(0.12, r);
        tint = vec3(1.0, 0.72, 0.32);
      } else if (uKind < 1.5) {
        float f = floor(uTime * 12.0);
        float row = floor(uv.y * 70.0);
        v = hash(vec2(floor(uv.x * 30.0 + hash(vec2(row, f)) * 30.0), row + f * 7.0));
        v *= 0.35 + 0.65 * step(0.55, fract(uv.y * 2.0 - uTime * 0.35));
        tint = vec3(0.72, 0.84, 1.0);
      } else if (uKind < 2.5) {
        float cols = 14.0;
        float c = floor(uv.x * cols);
        float sp = 0.3 + hash(vec2(c, 1.0)) * 0.9;
        float y = fract(uv.y * 3.0 + uTime * sp * 0.4 + hash(vec2(c, 3.0)));
        float fx = fract(uv.x * cols);
        v = step(0.7, y) * step(0.3, fx) * step(fx, 0.62) * (0.4 + 0.6 * hash(vec2(c, floor(uv.y * 40.0))));
        tint = vec3(1.0, 0.92, 0.72);
      } else {
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
    const theta = (i - 1.5) * GATE_SPREAD;
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
    left.position.set(-3.05, 5.0, 0);
    left.rotation.z = 0.012;
    const right = left.clone();
    right.position.x = 3.05;
    right.rotation.z = -0.02;
    const face = new THREE.MeshLambertMaterial({
      map: P.canvasTexture(128, 32, (g, w, h) => { P.stoneFill(g, w, h, '#6a5640', rand); P.inscribe(g, cfg.numeral, 64, 17, 26); }),
    });
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(8.6, 1.6, 2.3), [stone, stone, stone, stone, face, stone]);
    lintel.position.y = 10.2;
    lintel.rotation.z = (i % 2 ? 1 : -1) * 0.018;

    const portalMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uHover: { value: 0 }, uKind: { value: i } },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: portalFrag,
      fog: false,
    });
    const portal = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 8.8), portalMat);
    portal.position.set(0, 5.0, 0);

    group.add(plinth, left, right, lintel, portal);
    for (const part of [plinth, left, right, lintel]) { part.castShadow = true; part.receiveShadow = true; }
    for (const part of [left, right, lintel, portal]) { part.userData.gate = i; pickables.push(part); }

    for (const side of [-1, 1]) {
      const fl = P.flameSprite();
      fl.scale.set(2.3, 4.0, 1);
      fl.position.set(side * 3.4, 12.9, 0.2);
      group.add(fl);
    }
    const light = new THREE.PointLight(0xff8a3a, 30, 34, 1.4);
    light.position.set(0, 12.5, 2.5);
    group.add(light);

    gates.push({
      cfg, theta, group, portalMat, light,
      anchor: new THREE.Vector3(gx, gy + 14.2, gz),
      label: document.querySelector(`.pin[data-gate="${i}"]`),
      hover: 0,
    });
  });

  // ---------------------------------------------------------------- plate + input

  const fx = { blinkT: -1, flash: 0 };
  const plate = P.create({
    scene, camera, fov: [62, 82],
    onNav(href) {
      const i = GATES.findIndex((g) => g.href === href);
      if (i < 0) return false;
      enter(i);
      return true;
    },
    onReturn() { travel = null; camera.position.copy(HOME); },
    omens: {
      texts: ['transient illumination', 'to go beyond', 'videos, images, omens', 'the path through', 'four doors'],
      extras: [(t) => { fx.blinkT = t; }, () => { if (!P.reduceMotion) fx.flash = 1; }],
    },
  });
  if (!plate) return;

  const BASE_PITCH = portrait ? 0.14 : 0.1;
  const look = P.follow(plate, {
    yaw: 0.28, pitch: 0.12, rate: 1.3,
    onTap(pointer) {
      const hit = pick(pointer);
      if (hit) enter(hit.userData.gate);
    },
  });
  const view = { yaw: 0, pitch: BASE_PITCH };
  const pick = P.picker(camera, pickables, 60);

  let travel = null;
  let hover = -1;

  function angleDelta(a, b) {
    let d = (b - a) % (Math.PI * 2);
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    return d;
  }

  function enter(i) {
    if (travel || plate.leaving) return;
    const g = gates[i];
    travel = { i, from: camera.position.clone(), yaw0: view.yaw, pitch0: view.pitch };
    plate.leave(g.cfg.href, {
      duration: 1.9,
      onProgress(e) {
        view.yaw = travel.yaw0 + angleDelta(travel.yaw0, g.theta) * Math.min(1, e * 2.2);
        view.pitch = travel.pitch0 + (0.08 - travel.pitch0) * Math.min(1, e * 2.2);
        const target = g.group.position.clone().multiplyScalar(1.04);
        target.y = g.group.position.y + 4.8;
        camera.position.lerpVectors(travel.from, target, e);
      },
    });
  }

  const tmp = new THREE.Vector3();
  plate.run((dt, t) => {
    look.update(dt, t);
    if (!travel) { view.yaw = look.yaw; view.pitch = BASE_PITCH + look.pitch; }
    P.aim(camera, view.yaw, view.pitch);

    const hit = travel ? null : (look.hovering() ? pick(look.pointer) : null);
    const hov = travel ? travel.i : (hit ? hit.userData.gate : -1);
    if (hov !== hover) {
      hover = hov;
      plate.canvas.classList.toggle('over-thing', hov >= 0);
      P.hum.tone(hov >= 0 ? GATES[hov].tone : 0);
    }

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
    P.animateFlames(scene, t);

    gates.forEach((g, i) => {
      g.hover = P.damp(g.hover, hover === i ? 1 : 0, 8, dt);
      g.portalMat.uniforms.uTime.value = t;
      g.portalMat.uniforms.uHover.value = g.hover;
      g.light.intensity = 26 + 10 * vnoise(t * 7 + i * 10, 0.5) + 40 * g.hover;
      P.pin(g.label, g.anchor, camera, { opacity: 0.75 + 0.25 * g.hover });
      g.label.classList.toggle('lit', hover === i);
    });
    tmp.set(0, 0, 0);
  });
})();
