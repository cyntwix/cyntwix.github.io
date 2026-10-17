// index / a plain of stones under a spent sun, four gates around you.

(function () {
  const THREE = window.THREE;
  const P = window.PLATE;
  const { fbm, vnoise, h2, smooth } = P;
  const rand = P.mulberry32(1757);

  const GATES = [
    { href: 'about.html', numeral: 'I', name: 'ABOUT', tone: 98.0 },
    { href: 'videos.html', numeral: 'II', name: 'VIDEOS', tone: 116.5 },
    { href: 'writing.html', numeral: 'III', name: 'WORDS', tone: 130.8 },
    { href: 'contact.html', numeral: 'IV', name: 'CONTACT', tone: 146.8 },
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
  const hemi = new THREE.HemisphereLight(0x3a4a78, 0x1c0c06, 2.2);
  scene.add(hemi);

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
      uMid: { value: new THREE.Color(0.17, 0.09, 0.15) }, uZen: { value: new THREE.Color(0.025, 0.04, 0.10) },
      uCloudDark: { value: new THREE.Color(0.22, 0.09, 0.10) }, uCloudLit: { value: new THREE.Color(1.0, 0.56, 0.24) },
      uSunTint: { value: new THREE.Color(1, 1, 1) }, uStars: { value: 1 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position.z = gl_Position.w;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime, uFlash, uStars;
      uniform vec3 uSun, uVortex, uHorizon, uMid, uZen, uCloudDark, uCloudLit, uSunTint;
      varying vec3 vDir;
      ${P.GLSL_NOISE}
      void main() {
        vec3 d = normalize(vDir);
        float h = d.y;
        float az = atan(d.x, -d.z);

        vec3 zen = uZen;
        vec3 mid = uMid;
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
        col = mix(col, mix(uCloudDark, uCloudLit, sunNear), cloud * 0.85);

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
        col += vec3(0.9, 0.84, 0.66) * star * cross_ * 0.8 * uStars;

        vec3 sx = normalize(cross(vec3(0.0, 1.0, 0.0), uSun));
        vec3 sy = cross(uSun, sx);
        vec2 sp = vec2(dot(d, sx), dot(d, sy));
        float sa = atan(sp.y, sp.x);
        float spokes = pow(abs(sin(sa * 34.0)), 22.0) + 0.7 * pow(abs(sin(sa * 9.0 + 0.6)), 40.0);
        float outside = step(R, sd);
        col += vec3(0.95, 0.52, 0.2) * uSunTint * spokes * smoothstep(R * 5.0, R, sd) * outside * 0.95;
        col += vec3(0.85, 0.32, 0.12) * uSunTint * exp(-(sd - R) * 7.0) * outside * 0.7;
        if (sd < R) {
          float k = sd / R;
          float limb = sqrt(1.0 - k * k);
          float spots = fbm(sp * 38.0 + vec2(uTime * 0.01, 0.0));
          vec3 disc = mix(vec3(0.5, 0.06, 0.03), vec3(1.0, 0.56, 0.2), limb);
          disc *= 0.7 + 0.55 * spots;
          disc = mix(disc, vec3(0.07, 0.02, 0.02), smoothstep(0.63, 0.68, spots));
          col = disc * uSunTint;
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
    uniforms: { map: { value: P.texture('eye_sheet.png') }, uFrame: { value: 0 }, uBlink: { value: 0 }, uTint: { value: new THREE.Color(1, 1, 1) } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D map;
      uniform float uFrame, uBlink;
      uniform vec3 uTint;
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
        vec3 tint = mix(vec3(0.06, 0.0, 0.01), vec3(1.0, 0.66, 0.3) * uTint, smoothstep(0.08, 0.85, l));
        gl_FragColor = vec4(tint, 1.0);
      }`,
    depthTest: false, depthWrite: false, fog: false,
  });
  const EYE_DIST = 850;
  const eyeW = 2 * EYE_DIST * Math.tan(0.165) * 0.92;
  const eye = new THREE.Mesh(new THREE.PlaneGeometry(eyeW, eyeW * (111 / 255)), eyeMat);
  eye.renderOrder = -9;
  scene.add(eye);

  // ---- one sight on the plain, chosen per visit (?sight=cathedral|frigate|sword to force one)
  let sightTick = null;
  const SIGHTS = ['cathedral', 'frigate', 'sword'];
  const forced = new URLSearchParams(location.search).get('sight');
  const SIGHT = SIGHTS.includes(forced) ? forced : SIGHTS[Math.floor(Math.random() * SIGHTS.length)];
  const tall = innerWidth < innerHeight;
  // off to the right of the sun, big enough to stand over the gates
  const SIGHT_AT = {
    cathedral: { az: tall ? 0.36 : 0.62, dist: 175, clear: 80, scale: 1.15 },
    frigate:   { az: tall ? 0.34 : 0.62, dist: 175, clear: 90, scale: 1.3 },
    sword:     { az: tall ? 0.3 : 0.56, dist: 140, clear: 30, scale: 1.3 },
  }[SIGHT];
  const sightPos = new THREE.Vector3(Math.sin(SIGHT_AT.az) * SIGHT_AT.dist, 0, -Math.cos(SIGHT_AT.az) * SIGHT_AT.dist);
  sightPos.y = groundHeight(sightPos.x, sightPos.z);

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
      if (Math.hypot(x - sightPos.x, z - sightPos.z) < SIGHT_AT.clear) continue;
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

  // ---- the sight itself
  {
    const srand = P.mulberry32(SIGHT.length * 977 + 3);
    const root = new THREE.Group();
    root.position.copy(sightPos);
    // face roughly back toward the gates
    root.rotation.y = Math.atan2(-sightPos.x, -sightPos.z);
    root.scale.setScalar(SIGHT_AT.scale);
    scene.add(root);
    const lam = (c) => new THREE.MeshLambertMaterial({ color: c, flatShading: true });
    const add = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0, parent = root) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.rotation.set(rx, ry, rz);
      m.castShadow = m.receiveShadow = true;
      parent.add(m);
      return m;
    };
    const B = (w, h, d) => new THREE.BoxGeometry(w, h, d);
    // rubble heaped around whatever stands here
    const rubble = (n, r, mat, h = 2.5) => {
      for (let i = 0; i < n; i++) {
        const a = srand() * Math.PI * 2, d = r * (0.4 + srand() * 0.8);
        const s = 0.8 + srand() * h;
        add(B(s * (1 + srand()), s * 0.7, s), mat, Math.cos(a) * d, s * 0.25, Math.sin(a) * d, srand(), srand() * 3, srand());
      }
    };

    if (SIGHT === 'cathedral') {
      const st = lam(0x8e7a62), dk = lam(0x5a4a3c);
      const L = 64, Wd = 22, H = 30;
      // nave walls: piers with tall lancet gaps, some bays fallen
      for (const side of [-1, 1]) {
        for (let i = 0; i <= 8; i++) {
          const z = -L / 2 + i * (L / 8);
          const broken = srand() < 0.3;
          const h = broken ? H * (0.3 + srand() * 0.4) : H;
          add(B(2.6, h, 3.2), st, side * Wd / 2, h / 2, z);
          // flying buttress, leaning in from outside
          if (!broken && i % 2 === 0) {
            add(B(1.6, 20, 1.6), st, side * (Wd / 2 + 8), 10, z);
            add(B(1.1, 13, 1.1), st, side * (Wd / 2 + 4), H - 7, z, 0, 0, side * 0.75);
          }
          // the wall between piers, low, with the window gap above
          if (i < 8) add(B(1.4, H * 0.32, L / 8 - 2.6), dk, side * Wd / 2, H * 0.16, z + L / 16);
        }
        // a stretch of wall still carrying its upper course
        add(B(1.4, 4, L * 0.45), dk, side * Wd / 2, H - 2, -L / 4 + side * 6);
      }
      // the roof is gone; a few ribs still arch across
      for (let i = 1; i < 8; i += 2) {
        if (srand() < 0.35) continue;
        const z = -L / 2 + i * (L / 8);
        for (let k = 0; k <= 8; k++) {
          const a = Math.PI * (k / 8);
          if (srand() < 0.15) continue;
          add(B(1.2, 1.2, 1.2), st, Math.cos(a) * Wd / 2, H + Math.sin(a) * 9, z, 0, 0, a);
        }
      }
      // west front: two towers, one snapped off; the rose is an empty ring
      const fz = L / 2 + 2;
      add(B(6, H + 8, 3), st, -(Wd - 2) / 2 + 3, (H + 8) / 2, fz);
      add(B(6, H + 8, 3), st, (Wd - 2) / 2 - 3, (H + 8) / 2, fz);
      add(B(Wd - 2, 12, 3), st, 0, 6, fz);                                    // the base, around the door
      add(B(8.4, 2, 3), st, -3.4, H + 2, fz, 0, 0, 0.55);                      // pointed head of the great window
      add(B(8.4, 2, 3), st, 3.4, H + 2, fz, 0, 0, -0.55);
      for (let k = 0; k < 3; k++) if (k !== 1) add(B(0.7, H - 13, 0.8), dk, -3 + k * 3, 12 + (H - 13) / 2, fz);   // mullions, one gone
      add(new THREE.TorusGeometry(5.4, 0.9, 6, 20), dk, 0, H - 9, fz + 0.2);
      add(B(5, 10, 3.4), lam(0x140c08), 0, 5, fz + 0.4);                 // the doorway, dark
      add(B(9, 64, 9), st, -Wd / 2 - 3, 32, fz);
      add(new THREE.ConeGeometry(6.2, 22, 4), dk, -Wd / 2 - 3, 75, fz, 0, Math.PI / 4, 0);
      add(B(9, 38, 9), st, Wd / 2 + 3, 19, fz);
      add(B(9, 6, 9), st, Wd / 2 + 3, 40, fz, 0.2, 0.3, 0.4);            // the snapped top, slumping
      add(new THREE.ConeGeometry(6.2, 22, 4), dk, Wd / 2 + 16, 4, fz + 10, 1.35, 0.4, 0.2);   // its spire, fallen
      // the apse at the far end, half standing
      for (let k = 0; k < 7; k++) {
        const a = Math.PI * (k / 6);
        if (k === 4) continue;
        add(B(2.6, H * (0.5 + 0.5 * srand()), 2.6), st, Math.cos(a) * Wd / 2, H * 0.35, -L / 2 - Math.sin(a) * 10);
      }
      rubble(70, 40, st, 3);
    }

    if (SIGHT === 'frigate') {
      const hull = lam(0x6e6a64), dark = lam(0x2e2a28), rust = lam(0x7a4a30);
      const ship = new THREE.Group();
      // nose ploughed in, tail up
      ship.position.set(0, 20, 0);
      ship.rotation.order = 'YXZ';
      ship.rotation.set(0.62, 1.15, 0.25);   // side-on, nose driven into the ground, stern up in the air
      root.add(ship);
      const len = 96;
      // the hull: a long faceted body, plated in sections
      for (let i = 0; i < 9; i++) {
        const z = -len / 2 + i * (len / 9) + len / 18;
        const r = 7.5 - Math.abs(i - 5) * 0.7;
        if (i === 3) continue;                                  // a section blown out...
        const seg = add(new THREE.CylinderGeometry(r, r * 0.97, len / 9 - 0.6, 6, 1), i % 2 ? hull : rust, 0, 0, z, Math.PI / 2, 0, 0, ship);
        seg.rotation.z = Math.PI / 6;
      }
      // ...leaving its ribs open to the sky
      for (let k = 0; k < 5; k++) {
        const z = -len / 2 + 3 * (len / 9) + 1.5 + k * 2.1;
        add(new THREE.TorusGeometry(6.2, 0.35, 4, 12, Math.PI * (1.1 + srand() * 0.6)), dark, 0, 0, z, 0, 0, srand() * 2, ship);
      }
      add(B(2, 2, len / 9), dark, 0, -5.8, -len / 2 + 3.5 * (len / 9), 0, 0, 0, ship);      // the keel holds
      // the prow, a long wedge, buried
      add(new THREE.ConeGeometry(6.4, 22, 6), hull, 0, 0, len / 2 + 10, Math.PI / 2, 0, 0, ship);
      // bridge tower and masts
      add(B(6, 9, 12), hull, 0, 10, -8, 0, 0, 0, ship);
      add(B(7, 2, 5), dark, 0, 15.5, -5, 0, 0, 0, ship);
      add(B(0.5, 22, 0.5), dark, 1.5, 22, -12, 0.2, 0, 0.1, ship);
      add(B(0.4, 14, 0.4), dark, -2, 19, -16, -0.3, 0, -0.2, ship);
      // fins, one torn away
      add(B(1, 12, 18), hull, 9, 2, -34, 0, 0, -0.5, ship);
      add(B(1, 7, 14), hull, -8, 0, -36, 0, 0, 1.0, ship);
      // engine bells at the stern
      for (const [x, y] of [[-3.4, 2.4], [3.4, 2.4], [0, -3]]) {
        add(new THREE.CylinderGeometry(2.2, 3.6, 7, 8, 1, true), dark, x, y, -len / 2 - 3, Math.PI / 2, 0, 0, ship);
      }
      // a gouge in the earth behind it, plates shed along the way
      for (let i = 0; i < 26; i++) {
        const t = i / 26;
        add(B(2 + srand() * 4, 0.4, 1.5 + srand() * 3), srand() < 0.5 ? hull : rust, (srand() - 0.5) * 18, 0.3, 30 + t * 70, srand() * 0.4, srand() * 3, srand() * 0.4);
      }
      rubble(40, 26, lam(0x5a4a3a), 2);
      // a light still blinking somewhere on it
      const beacon = new THREE.PointLight(0xff3020, 0, 40, 1.4);
      beacon.position.set(1.5, 33, -12);
      ship.add(beacon);
      sightTick = (t) => { beacon.intensity = Math.sin(t * 3.1) > 0.85 ? 60 : 0; };
    }

    if (SIGHT === 'sword') {
      const steel = lam(0x8a8c90), gilt = lam(0xb08a3a), grip = lam(0x3a2418);
      const sw = new THREE.Group();
      // driven in at a lean, most of the blade still showing
      sw.rotation.set(0.1, 0.12, -0.16);
      root.add(sw);
      const bladeL = 64;
      // a diamond-section blade, tapering, with a fuller down its middle
      const blade = new THREE.CylinderGeometry(3.4, 1.4, bladeL, 4, 1);
      blade.scale(1, 1, 0.28);
      add(blade, steel, 0, bladeL / 2 - 14, 0, 0, Math.PI / 4, 0, sw);
      add(B(0.5, bladeL * 0.75, 0.6), lam(0x5a5c62), 0, bladeL / 2 - 10, 0, 0, 0, 0, sw);
      // notches knocked out of the edges
      for (let i = 0; i < 4; i++) add(B(1.2, 1.4, 1.2), lam(0x2a2620), (i % 2 ? 1 : -1) * 2.2, 8 + i * 9, 0, 0, 0, 0.7, sw);
      const top = bladeL - 14;
      add(B(19, 2.2, 2.6), gilt, 0, top + 1, 0, 0, 0, 0, sw);                       // crossguard
      add(new THREE.ConeGeometry(1.5, 4, 4), gilt, -10.5, top + 1, 0, 0, 0, Math.PI / 2, sw);
      add(new THREE.ConeGeometry(1.5, 4, 4), gilt, 10.5, top + 1, 0, 0, 0, -Math.PI / 2, sw);
      add(new THREE.CylinderGeometry(1, 1.15, 13, 6), grip, 0, top + 8.5, 0, 0, 0, 0, sw);
      for (let i = 0; i < 5; i++) add(new THREE.TorusGeometry(1.15, 0.25, 4, 8), gilt, 0, top + 3.5 + i * 2.5, 0, Math.PI / 2, 0, 0, sw);
      add(new THREE.IcosahedronGeometry(2.6, 0), gilt, 0, top + 17, 0, 0, 0, 0, sw);  // pommel
      // a rag of cloth still tied below the guard
      add(B(0.3, 9, 4), lam(0x6a1810), 1.8, top - 5, 0.6, 0, 0.3, 0.25, sw);
      // the earth split open where it landed
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2 + srand() * 0.4;
        add(B(4 + srand() * 6, 2 + srand() * 2, 3), lam(0x4a3626), Math.cos(a) * 6, 0.6, Math.sin(a) * 6, srand() * 0.5, -a, 0.3 + srand() * 0.4);
      }
      rubble(30, 16, lam(0x5a4430), 1.6);
    }
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

  // cut a word into weathered stone. Returns the stone face (letters recessed into it),
  // a glow map (just the cuts, for when the door is hovered) and a clean overlay
  // (letters only, with chunks missing, drawn sharp over the print).
  function carving(word, aspect, seed) {
    const crand = P.mulberry32(seed * 131 + 7);
    const W = 1024, H = Math.round(W / aspect);
    const mk = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; };
    const font = (g, size) => { g.font = `bold ${size}px "Times New Roman", Times, serif`; };
    const cv = mk(), g = cv.getContext('2d');
    // letters as a mask first
    const lm = mk(), lg = lm.getContext('2d');
    let size = Math.floor(H * 0.74);
    font(lg, size);
    const spacing = size * 0.12;
    const widthOf = () => [...word].reduce((a, ch) => a + lg.measureText(ch).width, 0) + spacing * (word.length - 1);
    while (widthOf() > W * 0.9) { size -= 2; font(lg, size); }
    let x = (W - widthOf()) / 2;
    const y = H / 2 + size * 0.36;
    lg.fillStyle = '#fff';
    const spots = [];
    for (const ch of word) {
      // each letter sits a hair off, as if cut by hand
      lg.save();
      lg.translate(x, y + (crand() - 0.5) * size * 0.05);
      lg.rotate((crand() - 0.5) * 0.04);
      lg.fillText(ch, 0, 0);
      lg.restore();
      spots.push(x + lg.measureText(ch).width / 2);
      x += lg.measureText(ch).width + spacing;
    }
    // time has taken bites out of them
    lg.globalCompositeOperation = 'destination-out';
    for (let k = 0; k < 4 + word.length; k++) {
      lg.beginPath();
      const cx = spots[Math.floor(crand() * spots.length)] + (crand() - 0.5) * size * 0.7;
      const cy = H / 2 + (crand() - 0.5) * size * 0.9;
      const r = size * (0.03 + crand() * 0.08);
      for (let a = 0; a < 7; a++) {
        const ang = (a / 7) * Math.PI * 2, rr = r * (0.6 + crand() * 0.6);
        a ? lg.lineTo(cx + Math.cos(ang) * rr, cy + Math.sin(ang) * rr) : lg.moveTo(cx + Math.cos(ang) * rr, cy + Math.sin(ang) * rr);
      }
      lg.fill();
    }
    // and a crack or two runs straight through
    lg.lineWidth = size * 0.035;
    lg.strokeStyle = '#000';
    for (let k = 0; k < 1; k++) {
      lg.beginPath();
      let px = W * (0.15 + crand() * 0.7), py = 0;
      lg.moveTo(px, py);
      while (py < H) { px += (crand() - 0.5) * size * 0.5; py += size * (0.15 + crand() * 0.2); lg.lineTo(px, py); }
      lg.stroke();
    }
    lg.globalCompositeOperation = 'source-over';

    // the stone
    g.fillStyle = '#6e5a44'; g.fillRect(0, 0, W, H);
    for (let k = 0; k < W * H / 260; k++) {
      g.fillStyle = crand() < 0.5 ? `rgba(20,10,4,${0.15 + crand() * 0.25})` : `rgba(210,180,130,${0.08 + crand() * 0.14})`;
      g.fillRect(crand() * W, crand() * H, 2 + crand() * 9, 1 + crand() * 3);
    }
    // weather streaks running down
    for (let k = 0; k < 40; k++) {
      g.fillStyle = `rgba(30,18,8,${0.05 + crand() * 0.12})`;
      g.fillRect(crand() * W, 0, 2 + crand() * 6, H * (0.3 + crand() * 0.7));
    }
    // cut: dark floor of the groove, a lit lower lip, a shadowed upper lip
    const tint = (color, dx, dy) => {
      const t = mk(), tg = t.getContext('2d');
      tg.drawImage(lm, dx, dy);
      tg.globalCompositeOperation = 'source-in';
      tg.fillStyle = color; tg.fillRect(0, 0, W, H);
      return t;
    };
    g.drawImage(tint('rgba(230,200,150,0.55)', 0, 5), 0, 0);   // light catching the lower edge of each cut
    g.drawImage(tint('rgba(8,4,2,0.95)', 0, -3), 0, 0);        // shadow inside the top of the groove
    g.drawImage(tint('rgba(28,16,8,0.92)', 0, 0), 0, 0);       // the groove itself
    // lichen and grime sitting in the letters
    g.globalCompositeOperation = 'source-atop';
    g.globalCompositeOperation = 'source-over';
    for (let k = 0; k < 160; k++) {
      g.fillStyle = `rgba(${70 + crand() * 30},${80 + crand() * 30},${50},${0.08 + crand() * 0.12})`;
      g.beginPath(); g.arc(crand() * W, crand() * H, 2 + crand() * 9, 0, 6.28); g.fill();
    }
    const stone = new THREE.CanvasTexture(cv);
    stone.anisotropy = 4;

    // glow: the cuts only, so the letters can smoulder when the door is hovered
    const glow = new THREE.CanvasTexture(tint('#fff', 0, 0));
    // clean overlay: pale letters with a dark edge, faint, partly eaten
    const cl = mk(), cg = cl.getContext('2d');
    cg.drawImage(tint('rgba(0,0,0,0.9)', 2, 3), 0, 0);
    cg.drawImage(tint('#fff', 0, 0), 0, 0);
    cg.globalCompositeOperation = 'destination-out';
    for (let k = 0; k < 300; k++) { cg.fillStyle = `rgba(0,0,0,${0.3 + crand() * 0.6})`; cg.fillRect(crand() * W, crand() * H, 2 + crand() * 7, 2 + crand() * 5); }
    const clean = new THREE.CanvasTexture(cl);
    clean.anisotropy = 4;
    return { stone, glow, clean };
  }

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
    // the name cut into the lintel: recessed letters, chipped, cracked, part crumbled
    const LW = 8.6, LH = 2.4;
    const carve = carving(cfg.name, LW / LH, i);
    const face = new THREE.MeshLambertMaterial({ map: carve.stone, emissive: 0xff7a30, emissiveIntensity: 0, emissiveMap: carve.glow });
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(LW, LH, 2.3), [stone, stone, stone, stone, face, stone]);
    lintel.position.y = 10.6;
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

    // the same letters, faint and sharp, so they survive the print (clean layer)
    const lintelMask = new THREE.Mesh(lintel.geometry, new THREE.MeshBasicMaterial({ colorWrite: false }));
    lintelMask.layers.set(1);
    lintel.add(lintelMask);
    const letters = new THREE.Mesh(new THREE.PlaneGeometry(LW, LH),
      new THREE.MeshBasicMaterial({ map: carve.clean, transparent: true, opacity: 0.72, depthWrite: false, color: 0xd8c6a0 }));
    letters.position.z = 1.16;
    letters.layers.set(1);
    letters.renderOrder = 2;
    lintel.add(letters);

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
      face, letters,
      hover: 0,
    });
  });

  // ---------------------------------------------------------------- the old path
  // Barely there: a pale trodden line from where you stand that splits four
  // ways toward the doors, mostly worn into the dirt, with a few sunken paving
  // stones still showing and long stretches gone altogether.
  {
    const prand = P.mulberry32(8128);
    // the ground mesh is a coarse grid, so sample its actual surface, not the smooth function
    const CELL = 3200 / 220;
    const meshY = (x, z) => {
      const gx = (x + 1600) / CELL, gz = (z + 1600) / CELL;
      const ix = Math.floor(gx), iz = Math.floor(gz), fx = gx - ix, fz = gz - iz;
      const h = (i, k) => groundHeight(i * CELL - 1600, k * CELL - 1600);
      // PlaneGeometry splits each cell along the same diagonal
      if (fx + fz <= 1) return h(ix, iz) + (h(ix + 1, iz) - h(ix, iz)) * fx + (h(ix, iz + 1) - h(ix, iz)) * fz;
      return h(ix + 1, iz + 1) + (h(ix, iz + 1) - h(ix + 1, iz + 1)) * (1 - fx) + (h(ix + 1, iz) - h(ix + 1, iz + 1)) * (1 - fz);
    };
    const curves = [];
    const fork = new THREE.Vector3(0, 0, -GATE_R * 0.42);
    curves.push({ c: new THREE.QuadraticBezierCurve3(new THREE.Vector3(0.4, 0, 14), new THREE.Vector3(-0.8, 0, -GATE_R * 0.2), fork), w0: 2.8, w1: 2.3 });
    GATES.forEach((g, i) => {
      const th = (i - 1.5) * GATE_SPREAD;
      const end = new THREE.Vector3(Math.sin(th) * GATE_R * 0.93, 0, -Math.cos(th) * GATE_R * 0.93);
      const mid = fork.clone().lerp(end, 0.5);
      mid.x += (i - 1.5) * 1.5 + (prand() - 0.5) * 3;
      mid.z += 2 + prand() * 2;
      curves.push({ c: new THREE.QuadraticBezierCurve3(fork.clone(), mid, end), w0: 2.2, w1: 1.6 });
    });

    // the worn strip: a ribbon laid on the ground, eaten away by noise
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    mat.onBeforeCompile = (sh) => {
      sh.vertexShader = 'attribute vec2 pathUv;\nvarying vec2 vPath;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvPath = pathUv;');
      sh.fragmentShader = 'varying vec2 vPath;\n' + P.GLSL_NOISE + sh.fragmentShader.replace('#include <dithering_fragment>', `#include <dithering_fragment>
        // across: soft edges; along: worn to nothing in long patches
        float across = 1.0 - smoothstep(0.3, 1.0, abs(vPath.y));
        float wear = smoothstep(0.24, 0.52, fbm(vec2(vPath.x * 0.07, vPath.y * 0.5)));
        float grit = 0.75 + 0.25 * noise(vPath * vec2(0.8, 2.0));
        float a = across * wear * grit * 0.92;
        if (a < 0.01) discard;
        gl_FragColor.a = a;`);
    };
    // packed earth: dried paler and finer than the loose dirt around it
    const pale = new THREE.Color(0x9a8a6e), dark = new THREE.Color(0x86745a);
    const STEP = 0.7;
    curves.forEach(({ c, w0, w1 }, ci) => {
      const len = c.getLength();
      const n = Math.max(8, Math.ceil(len / STEP));
      const pos = [], col = [], puv = [], idx = [];
      const p = new THREE.Vector3(), t = new THREE.Vector3(), side = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
      const cc = new THREE.Color();
      for (let k = 0; k <= n; k++) {
        const u = k / n;
        c.getPointAt(u, p);
        c.getTangentAt(u, t);
        side.crossVectors(t, up).normalize();
        // the trail wanders a little and narrows toward each door
        const wob = (P.vnoise(ci * 7 + u * len * 0.08, 3) - 0.5) * 1.2;
        const w = (w0 + (w1 - w0) * u) * (0.8 + 0.4 * P.vnoise(u * len * 0.15, ci + 9));
        for (const sgn of [-1, 1]) {
          const x = p.x + side.x * (sgn * w / 2 + wob), z = p.z + side.z * (sgn * w / 2 + wob);
          pos.push(x, meshY(x, z) + 0.05, z);
          cc.copy(dark).lerp(pale, 0.4 + 0.6 * prand());
          col.push(cc.r, cc.g, cc.b);
          puv.push(u * len + ci * 37, sgn);
        }
        if (k < n) { const a0 = k * 2; idx.push(a0, a0 + 2, a0 + 1, a0 + 1, a0 + 2, a0 + 3); }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      g.setAttribute('pathUv', new THREE.Float32BufferAttribute(puv, 2));
      g.setIndex(idx);
      g.computeVertexNormals();
      const m = new THREE.Mesh(g, mat);
      m.receiveShadow = true;
      m.renderOrder = 1;
      scene.add(m);
    });

  }

  // ---------------------------------------------------------------- time of day (preview)

  // The sky and light follow the visitor's own clock; the sun never moves.
  // ?hour=N in the address forces an hour, for checking how one looks.
  const params = new URLSearchParams(location.search);
  const C = (r, g, b) => new THREE.Color(r, g, b);
  const KEYS = [
    { h: 0,    hor: C(0.08, 0.08, 0.14), mid: C(0.04, 0.045, 0.1),  zen: C(0.008, 0.012, 0.035), cd: C(0.06, 0.06, 0.1),   cl: C(0.45, 0.5, 0.65), tint: C(0.55, 0.75, 1.25), sunC: 0x9fb4ff, sunI: 3.2, hs: 0x2a3560, hg: 0x0a0806, hi: 1.2, stars: 1.7, fog: 0.0052 },
    { h: 5,    hor: C(0.22, 0.12, 0.18), mid: C(0.1, 0.08, 0.18),   zen: C(0.02, 0.03, 0.08),    cd: C(0.15, 0.08, 0.14), cl: C(0.85, 0.5, 0.5),  tint: C(1.0, 0.75, 0.95),  sunC: 0xff9aa0, sunI: 5,   hs: 0x405080, hg: 0x140a08, hi: 1.5, stars: 0.9, fog: 0.005 },
    { h: 7,    hor: C(0.5, 0.28, 0.2),   mid: C(0.24, 0.16, 0.22),  zen: C(0.06, 0.08, 0.16),    cd: C(0.25, 0.14, 0.15), cl: C(1.0, 0.65, 0.42), tint: C(1.0, 1.1, 1.15),   sunC: 0xffa070, sunI: 7,   hs: 0x5a6898, hg: 0x241810, hi: 1.9, stars: 0.2, fog: 0.0042 },
    { h: 12.5, hor: C(0.46, 0.36, 0.26), mid: C(0.24, 0.24, 0.3),   zen: C(0.08, 0.12, 0.22),    cd: C(0.3, 0.26, 0.24),  cl: C(0.95, 0.85, 0.65), tint: C(1.0, 1.35, 1.9),  sunC: 0xffe6c0, sunI: 7.5, hs: 0x6a7898, hg: 0x3a2c1e, hi: 2.0, stars: 0.0, fog: 0.0036 },
    { h: 16,   hor: C(0.46, 0.27, 0.16), mid: C(0.21, 0.15, 0.19),  zen: C(0.05, 0.07, 0.15),    cd: C(0.25, 0.14, 0.13), cl: C(1.0, 0.65, 0.35), tint: C(1.0, 1.15, 1.35),  sunC: 0xffb070, sunI: 7.5, hs: 0x4a5a8a, hg: 0x241408, hi: 2.1, stars: 0.3, fog: 0.004 },
    { h: 18.5, hor: C(0.42, 0.2, 0.12),  mid: C(0.17, 0.09, 0.15),  zen: C(0.025, 0.04, 0.10),   cd: C(0.22, 0.09, 0.10), cl: C(1.0, 0.56, 0.24), tint: C(1, 1, 1),          sunC: 0xff8a4a, sunI: 7.5, hs: 0x3a4a78, hg: 0x1c0c06, hi: 2.2, stars: 1.0, fog: 0.0042 },
    { h: 20.5, hor: C(0.3, 0.09, 0.08),  mid: C(0.1, 0.04, 0.1),    zen: C(0.015, 0.02, 0.06),   cd: C(0.12, 0.05, 0.08), cl: C(0.85, 0.3, 0.15), tint: C(1.0, 0.6, 0.55),   sunC: 0xff5030, sunI: 5,   hs: 0x303c6c, hg: 0x100806, hi: 1.5, stars: 1.4, fog: 0.0048 },
    { h: 24,   hor: C(0.08, 0.08, 0.14), mid: C(0.04, 0.045, 0.1),  zen: C(0.008, 0.012, 0.035), cd: C(0.06, 0.06, 0.1),   cl: C(0.45, 0.5, 0.65), tint: C(0.55, 0.75, 1.25), sunC: 0x9fb4ff, sunI: 3.2, hs: 0x2a3560, hg: 0x0a0806, hi: 1.2, stars: 1.7, fog: 0.0052 },
  ];
  const _ca = new THREE.Color(), _cb = new THREE.Color();
  function setHour(hour) {
    hour = ((hour % 24) + 24) % 24;
    let i = 0;
    while (i < KEYS.length - 2 && KEYS[i + 1].h <= hour) i++;
    const A = KEYS[i], B = KEYS[i + 1];
    const k0 = (hour - A.h) / (B.h - A.h);
    const k = k0 * k0 * (3 - 2 * k0);
    const lerp = (a, b) => a + (b - a) * k;
    // the sun never moves: only the light changes
    const u = skyMat.uniforms;
    u.uHorizon.value.copy(A.hor).lerp(B.hor, k);
    u.uMid.value.copy(A.mid).lerp(B.mid, k);
    u.uZen.value.copy(A.zen).lerp(B.zen, k);
    u.uCloudDark.value.copy(A.cd).lerp(B.cd, k);
    u.uCloudLit.value.copy(A.cl).lerp(B.cl, k);
    u.uSunTint.value.copy(A.tint).lerp(B.tint, k);
    u.uStars.value = lerp(A.stars, B.stars);
    scene.fog.color.copy(u.uHorizon.value);
    scene.fog.density = lerp(A.fog, B.fog);
    sunLight.color.copy(_ca.set(A.sunC)).lerp(_cb.set(B.sunC), k);
    sunLight.intensity = lerp(A.sunI, B.sunI);
    hemi.color.copy(_ca.set(A.hs)).lerp(_cb.set(B.hs), k);
    hemi.groundColor.copy(_ca.set(A.hg)).lerp(_cb.set(B.hg), k);
    hemi.intensity = lerp(A.hi, B.hi);
    eyeMat.uniforms.uTint.value.copy(u.uSunTint.value);
  }
  const clockHour = () => { const d = new Date(); return d.getHours() + d.getMinutes() / 60; };
  let hourNow = params.has('hour') ? parseFloat(params.get('hour')) : clockHour();
  setHour(hourNow);
  // keep up as the evening goes on
  if (!params.has('hour')) setInterval(() => setHour(clockHour()), 60000);


  // ---------------------------------------------------------------- plate + input

  const fx = { blinkT: -1, flash: 0 };
  const birds = P.birds(scene, camera);
  window.__birds = birds;
  const plate = P.create({
    scene, camera, fov: [62, 82], clean: true,
    onNav(href) {
      const i = GATES.findIndex((g) => g.href === href);
      if (i < 0) return false;
      enter(i);
      return true;
    },
    onReturn() { travel = null; camera.position.copy(HOME); },
    omens: {
      extras: [() => birds.launch(), () => birds.launch(), (t) => { fx.blinkT = t; }, () => { if (!P.reduceMotion) fx.flash = 1; }],
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
    birds.update(dt, t);
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
    if (sightTick) sightTick(t);
    ashMat.uniforms.uTime.value = t;
    P.animateFlames(scene, t);

    gates.forEach((g, i) => {
      g.hover = P.damp(g.hover, hover === i ? 1 : 0, 8, dt);
      g.portalMat.uniforms.uTime.value = t;
      g.portalMat.uniforms.uHover.value = g.hover;
      g.light.intensity = 26 + 10 * vnoise(t * 7 + i * 10, 0.5) + 40 * g.hover;
      g.face.emissiveIntensity = g.hover * (0.9 + 0.3 * P.vnoise(t * 6 + i, 4));
      g.letters.material.opacity = 0.72 + 0.25 * g.hover;
      g.letters.material.color.setHex(g.hover > 0.5 ? 0xffe0a0 : 0xd8c6a0);
    });
    tmp.set(0, 0, 0);
  });
})();
