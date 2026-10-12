// about / an altarpiece at the end of a nave. The portrait has been pressed
// into stone as a relief, haloed and candlelit. The altar under it has a mouth
// in it, which is the way out to contact. Two ledger stones stand either side.
// One fixed view: everything is in frame, the camera only leans after the mouse.

(function () {
  const THREE = window.THREE;
  const P = window.PLATE;
  const rand = P.mulberry32(404);

  const scene = new THREE.Scene();
  const DUSK = new THREE.Color(0.2, 0.11, 0.09);
  scene.fog = new THREE.Fog(DUSK, 30, 120);
  scene.background = DUSK;

  const camera = new THREE.PerspectiveCamera(56, 1, 0.3, 300);
  const NAVE_START = -34, NAVE_END = 40;
  const PILLAR_X = 12, WALL_X = 17.5;
  const BACK_Z = NAVE_START + 1.4;

  // ---------------------------------------------------------------- light

  // low hard light through the windows on the left wall
  const sunDir = new THREE.Vector3(-0.85, 0.42, 0.32).normalize();
  const sun = new THREE.DirectionalLight(0xffb070, 6.5);
  sun.position.copy(sunDir).multiplyScalar(90);
  sun.target.position.set(0, 0, -6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -60, right: 60, top: 40, bottom: -40, near: 1, far: 240 });
  sun.shadow.bias = -0.002;
  scene.add(sun, sun.target);
  scene.add(new THREE.HemisphereLight(0x6670a8, 0x3a1c0e, 1.7));

  // ---------------------------------------------------------------- stone

  const stone = new THREE.MeshLambertMaterial({ color: 0x86705a, flatShading: true });
  const darkStone = new THREE.MeshLambertMaterial({ color: 0x4a3a30, flatShading: true });

  function addBox(w, h, d, x, y, z, mat = stone, opts = {}) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    if (opts.ry) m.rotation.y = opts.ry;
    if (opts.rz) m.rotation.z = opts.rz;
    m.castShadow = opts.cast !== false;
    m.receiveShadow = true;
    scene.add(m);
    return m;
  }

  // flagstones, worn down the middle
  {
    const cols = 19, rows = 38, size = 2.0;
    const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true }), cols * rows);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), c = new THREE.Color();
    const a = new THREE.Color(0x7a6650), b = new THREE.Color(0x3d3028), worn = new THREE.Color(0x9c8a6e);
    let n = 0;
    for (let r = 0; r < rows; r++) {
      for (let k = 0; k < cols; k++) {
        const x = (k - (cols - 1) / 2) * size + (r % 2) * 0.5;
        const z = NAVE_START + r * size;
        e.set((rand() - 0.5) * 0.03, (rand() - 0.5) * 0.06, (rand() - 0.5) * 0.03);
        q.setFromEuler(e);
        m.compose(new THREE.Vector3(x, -0.15 + (rand() - 0.5) * 0.08, z), q, new THREE.Vector3(size * 0.95, 0.3, size * 0.95));
        mesh.setMatrixAt(n, m);
        c.copy(a).lerp(b, rand() * 0.8).lerp(worn, P.smooth(4, 0, Math.abs(x)) * 0.55 * rand());
        mesh.setColorAt(n++, c);
      }
    }
    mesh.receiveShadow = true;
    scene.add(mesh);
  }

  // pillars, torches on every other one, an arcade over them
  const BAY = 8;
  const torches = [];
  for (let z = NAVE_START + 10; z < NAVE_END; z += BAY) {
    for (const side of [-1, 1]) {
      const x = side * PILLAR_X;
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.1, 19, 8), stone);
      shaft.position.set(x, 9.5, z);
      shaft.castShadow = shaft.receiveShadow = true;
      scene.add(shaft);
      addBox(2.8, 0.9, 2.8, x, 0.45, z);
      addBox(2.6, 0.8, 2.6, x, 19.3, z);
    }
    if (((z - NAVE_START - 10) / BAY) % 2 === 0) {
      for (const side of [-1, 1]) {
        addBox(0.5, 0.5, 1.6, side * (PILLAR_X - 1.0), 9.6, z, darkStone);
        const fl = P.flameSprite();
        fl.scale.set(1.3, 2.2, 1);
        fl.position.set(side * (PILLAR_X - 1.4), 10.9, z);
        scene.add(fl);
      }
      const torch = new THREE.PointLight(0xff8a3a, 34, 26, 1.3);
      torch.position.set(0, 11, z);
      scene.add(torch);
      torches.push(torch);
    }
    addBox(1.5, 2.4, BAY, -PILLAR_X, 20.9, z + BAY / 2);
    addBox(1.5, 2.4, BAY, PILLAR_X, 20.9, z + BAY / 2);
  }

  // left wall: piers with tall windows between, so the light comes in striped
  for (let z = NAVE_START; z < NAVE_END; z += BAY) {
    addBox(1, 28, 4.6, -WALL_X, 14, z + 1.2, darkStone);
    addBox(1, 6, BAY, -WALL_X, 25, z + BAY / 2, darkStone);
    addBox(1, 3.2, BAY, -WALL_X, 1.6, z + BAY / 2, darkStone);
  }
  addBox(1, 28, NAVE_END - NAVE_START, WALL_X, 14, (NAVE_START + NAVE_END) / 2, darkStone, { cast: false });
  addBox(38, 1, NAVE_END - NAVE_START, 0, 28.5, (NAVE_START + NAVE_END) / 2, darkStone, { cast: false });
  addBox(36, 28, 1, 0, 14, NAVE_START - 0.6, darkStone, { cast: false });

  // ---------------------------------------------------------------- the relief

  const reliefH = 12.5, reliefW = reliefH * (288 / 300);
  const reliefCenter = new THREE.Vector3(0, 14.2, BACK_Z);
  const reliefUniforms = { uTime: { value: 0 }, uBand: { value: 0.3 }, uShift: { value: 0 } };
  let relief = null;

  function buildRelief() {
    const img = P.image('portrait.png');
    const SX = 144, SY = 150;
    const cv = document.createElement('canvas');
    cv.width = SX + 1; cv.height = SY + 1;
    const g = cv.getContext('2d');
    g.filter = 'blur(1.2px)';
    g.drawImage(img, 0, 0, SX + 1, SY + 1);
    const px = g.getImageData(0, 0, SX + 1, SY + 1).data;

    const geo = new THREE.PlaneGeometry(reliefW, reliefH, SX, SY);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const ix = i % (SX + 1), iy = Math.floor(i / (SX + 1));
      const k = (iy * (SX + 1) + ix) * 4;
      const lum = (px[k] * 0.3 + px[k + 1] * 0.59 + px[k + 2] * 0.11) / 255;
      const u = ix / SX - 0.5, v = iy / SY - 0.5;
      const pillow = Math.cos(u * Math.PI) * Math.cos(v * Math.PI);
      pos.setZ(i, lum * 1.6 + pillow * 1.1);
    }
    geo.computeVertexNormals();

    const mat = new THREE.MeshLambertMaterial({ map: P.texture('portrait.png'), color: 0xb8a48c });
    mat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, reliefUniforms);
      shader.vertexShader = 'uniform float uTime, uBand, uShift;\n' + shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         // a band of the face slides sideways, the way the scan did
         float inBand = step(uBand, uv.y) * step(uv.y, uBand + 0.07);
         transformed.x += inBand * uShift;
         transformed.z += inBand * abs(uShift) * 0.4;`
      );
    };
    relief = new THREE.Mesh(geo, mat);
    relief.position.copy(reliefCenter);
    relief.castShadow = true;
    relief.receiveShadow = true;
    scene.add(relief);
  }
  const portraitImg = P.image('portrait.png');
  if (portraitImg.complete && portraitImg.naturalWidth) buildRelief();
  else portraitImg.addEventListener('load', buildRelief, { once: true });

  // frame and aureole
  addBox(reliefW + 1.6, 0.9, 1.6, 0, reliefCenter.y - reliefH / 2 - 0.4, BACK_Z + 0.4);
  addBox(reliefW + 1.6, 0.9, 1.6, 0, reliefCenter.y + reliefH / 2 + 0.4, BACK_Z + 0.4);
  addBox(0.9, reliefH + 1.7, 1.6, -reliefW / 2 - 0.4, reliefCenter.y, BACK_Z + 0.4);
  addBox(0.9, reliefH + 1.7, 1.6, reliefW / 2 + 0.4, reliefCenter.y, BACK_Z + 0.4);
  const gilt = new THREE.MeshLambertMaterial({ color: 0xc9953e, emissive: 0x2a1404, flatShading: true });
  const aureole = new THREE.Group();
  aureole.position.set(0, reliefCenter.y, BACK_Z - 0.3);
  for (let i = 0; i < 56; i++) {
    const a = (i / 56) * Math.PI * 2;
    const len = i % 2 ? 3.6 : 6.0;
    const ray = new THREE.Mesh(new THREE.BoxGeometry(0.22, len, 0.2), gilt);
    const r = reliefH * 0.56 + len / 2;
    ray.position.set(Math.sin(a) * r, Math.cos(a) * r, 0);
    ray.rotation.z = -a;
    aureole.add(ray);
  }
  scene.add(aureole);

  // ---------------------------------------------------------------- the altar and its mouth

  const ALTAR_Z = BACK_Z + 4.2;
  const altarH = reliefCenter.y - reliefH / 2 - 1.0;
  addBox(10.5, altarH, 4.6, 0, altarH / 2, ALTAR_Z, stone);
  addBox(11.6, 0.6, 5.4, 0, altarH + 0.3, ALTAR_Z, stone);
  addBox(11.2, 0.5, 5.2, 0, 0.25, ALTAR_Z + 0.2, stone);

  const MOUTH = new THREE.Vector3(0, altarH * 0.47, ALTAR_Z + 2.33);
  const teethTex = P.sheet('teeth_sheet.png', 5, 4);
  const mouth = new THREE.Mesh(
    new THREE.PlaneGeometry(7.0, 4.8),
    new THREE.MeshLambertMaterial({ map: teethTex, alphaTest: 0.5, emissive: 0x220303 })
  );
  mouth.position.copy(MOUTH);
  scene.add(mouth);
  // a dark throat behind the teeth
  const throat = new THREE.Mesh(new THREE.PlaneGeometry(6.0, 3.4), new THREE.MeshBasicMaterial({ color: 0x050101 }));
  throat.position.copy(MOUTH).add(new THREE.Vector3(0, 0, -0.05));
  scene.add(throat);
  const mouthLight = new THREE.PointLight(0xff3020, 4, 14, 1.5);
  mouthLight.position.copy(MOUTH).add(new THREE.Vector3(0, 0.5, 3));
  scene.add(mouthLight);

  // candles on the altar, their light on the face
  const candles = [];
  for (const side of [-1, 1]) {
    const x = side * 4.3;
    const y = altarH + 0.6;
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 1.6, 6), new THREE.MeshLambertMaterial({ color: 0xd8c8a0 }));
    stick.position.set(x, y + 0.8, ALTAR_Z + 0.6);
    scene.add(stick);
    const fl = P.flameSprite();
    fl.scale.set(1.2, 2.1, 1);
    fl.position.set(x, y + 2.5, ALTAR_Z + 0.6);
    scene.add(fl);
    const light = new THREE.PointLight(0xff9a48, 26, 22, 1.4);
    light.position.set(x * 0.8, y + 3.6, ALTAR_Z + 2.4);
    scene.add(light);
    candles.push(light);
  }

  // ---------------------------------------------------------------- ledger stones

  const LEDGER = [
    { numeral: 'I', x: -10.8 },
    { numeral: 'II', x: 10.8 },
  ];
  const steles = LEDGER.map((L, i) => {
    const z = BACK_Z + 6;
    const H = 7.5;
    const tex = P.canvasTexture(64, 160, (g, w, h) => {
      P.stoneFill(g, w, h, '#76624a', rand);
      g.strokeStyle = '#2a1a0c';
      g.lineWidth = 2;
      g.strokeRect(5, 5, w - 10, h - 10);
      P.inscribe(g, L.numeral, w / 2, 34, 28);
      for (let k = 0; k < 9; k++) {
        g.fillStyle = 'rgba(30,16,6,0.6)';
        g.fillRect(12, 62 + k * 9, 40 - rand() * 14, 2);
      }
    });
    const face = new THREE.MeshLambertMaterial({ map: tex });
    const slab = new THREE.Mesh(new THREE.BoxGeometry(2.8, H, 0.9), [stone, stone, stone, stone, face, stone]);
    const ry = -Math.sign(L.x) * 0.3;
    slab.position.set(L.x, H / 2 + 0.4, z);
    slab.rotation.y = ry;
    slab.rotation.z = (rand() - 0.5) * 0.05;
    slab.castShadow = slab.receiveShadow = true;
    scene.add(slab);
    addBox(3.8, 0.5, 2.0, L.x, 0.25, z, stone, { ry });
    return {
      anchor: new THREE.Vector3(L.x, H + 1.4, z),
      label: document.querySelector(`.pin[data-stele="${i}"]`),
    };
  });

  // ---------------------------------------------------------------- dust in the light

  const dustMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      attribute vec3 seed;
      uniform float uTime;
      varying float vA;
      void main() {
        vec3 p = vec3(seed.x * 32.0 - 16.0, seed.y * 22.0, seed.z * 60.0 - 34.0);
        p.y = mod(p.y + uTime * (0.15 + seed.x * 0.2), 22.0);
        p.x += sin(uTime * 0.3 + seed.z * 30.0) * 0.6;
        p.z += cos(uTime * 0.2 + seed.x * 30.0) * 0.6;
        vA = 0.5 + 0.5 * sin(uTime * 2.0 + seed.y * 60.0);
        gl_PointSize = 1.0;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      varying float vA;
      void main() { gl_FragColor = vec4(vec3(1.0, 0.86, 0.6) * (0.4 + 0.6 * vA), 1.0); }`,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  {
    const n = 2200;
    const seeds = new Float32Array(n * 3);
    for (let i = 0; i < n * 3; i++) seeds[i] = rand();
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute('seed', new THREE.BufferAttribute(seeds, 3));
    const pts = new THREE.Points(g, dustMat);
    pts.frustumCulled = false;
    scene.add(pts);
  }

  // ---------------------------------------------------------------- plate + input

  const fx = { turnT: -1, gutter: 0, slide: 0 };
  const plate = P.create({
    scene, camera, fov: [56, 74],
    omens: {
      texts: ['field note / self-index', 'a place of texture', 'this isnt a biography', 'michigan, boston'],
      extras: [
        (t) => { fx.turnT = t; },
        () => { fx.gutter = 1; },
        () => { reliefUniforms.uBand.value = 0.15 + Math.random() * 0.7; fx.slide = 1; },
      ],
    },
  });
  if (!plate) return;

  const portrait = innerWidth < innerHeight;
  const CAM = portrait ? new THREE.Vector3(0, 8, 30) : new THREE.Vector3(0, 7.2, 8);
  const BASE_PITCH = portrait ? 0.08 : 0.1;
  const view = { yaw: 0, pitch: BASE_PITCH };
  const pickMouth = P.picker(camera, [mouth], 90);
  const look = P.follow(plate, {
    yaw: 0.16, pitch: 0.07, rate: 1.2,
    onTap(pointer) { if (pickMouth(pointer)) goToMouth(); },
  });

  function goToMouth() {
    if (plate.leaving) return;
    const from = camera.position.clone();
    const to = MOUTH.clone().add(new THREE.Vector3(0, 0, 1.2));
    const yaw0 = view.yaw, pitch0 = view.pitch;
    const pitchTo = Math.atan2(MOUTH.y - from.y, from.z - MOUTH.z);
    plate.leave('contact.html', {
      duration: 1.8,
      onProgress(e) {
        camera.position.lerpVectors(from, to, e * 0.95);
        view.yaw = yaw0 * (1 - Math.min(1, e * 2));
        view.pitch = pitch0 + (pitchTo - pitch0) * Math.min(1, e * 2);
        mouthLight.intensity = 50 * e;
      },
    });
  }
  document.querySelectorAll('[data-mouth-link]').forEach((a) => a.addEventListener('click', (e) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    goToMouth();
  }));

  const mouthPin = document.querySelector('.pin[data-mouth]');
  const mouthAnchor = new THREE.Vector3(0, -0.2, ALTAR_Z + 3.4);
  let hoverMouth = false;

  plate.run((dt, t) => {
    look.update(dt, t);
    if (!plate.leaving) {
      // lean a little with the gaze, as if to see past a pillar
      camera.position.set(CAM.x + look.x * 1.6, CAM.y + look.y * 0.5 + Math.sin(t * 0.9) * 0.04, CAM.z);
      view.yaw = look.yaw;
      view.pitch = BASE_PITCH + look.pitch;
    }
    P.aim(camera, view.yaw, view.pitch);

    const hm = !plate.leaving && look.hovering() && !!pickMouth(look.pointer);
    if (hm !== hoverMouth) {
      hoverMouth = hm;
      plate.canvas.classList.toggle('over-thing', hm);
      mouthPin.classList.toggle('lit', hm);
      P.hum.tone(hm ? 73.4 : 0);
    }
    if (!plate.leaving) mouthLight.intensity = P.damp(mouthLight.intensity, hm ? 30 : 5 + 3 * Math.sin(t * 2), 6, dt);

    // the teeth gif holds its first frame, then chatters
    const cyc = t % 1.35;
    P.frame(teethTex, cyc < 0.4 ? 0 : 1 + Math.floor((cyc - 0.4) / 0.05));

    dustMat.uniforms.uTime.value = t;
    reliefUniforms.uTime.value = t;
    P.animateFlames(scene, t);

    fx.gutter = Math.max(0, fx.gutter - dt * 0.7);
    candles.forEach((c, i) => {
      c.intensity = (22 + 9 * P.vnoise(t * 6 + i * 7, 1.3)) * (1 - 0.85 * Math.sin(Math.min(1, fx.gutter) * Math.PI));
    });
    torches.forEach((l, i) => { l.intensity = 30 + 10 * P.vnoise(t * 5 + i * 3.3, 7.1); });

    // the face slides a band sideways now and then
    if (fx.slide > 0) {
      fx.slide = Math.max(0, fx.slide - dt * 0.5);
      reliefUniforms.uShift.value = Math.sin((1 - fx.slide) * Math.PI) * 0.9;
    }
    // or turns its head to find you
    if (relief) {
      let turn = 0;
      if (fx.turnT >= 0) {
        const k = (t - fx.turnT) / 4;
        if (k >= 1) fx.turnT = -1;
        else turn = Math.sin(k * Math.PI);
      }
      const toCam = Math.atan2(camera.position.x - relief.position.x, camera.position.z - relief.position.z);
      relief.rotation.y = toCam * 0.6 * turn + Math.sin(t * 0.21) * 0.01;
    }
    aureole.rotation.z = t * 0.02;

    steles.forEach((s) => P.pin(s.label, s.anchor, camera, { cone: 0.1 }));
    P.pin(mouthPin, mouthAnchor, camera, { cone: 0.1, anchor: '0%' });
  });
})();
