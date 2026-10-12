// words + entries / a dark field. The words you're given rise out of the ground
// as carved tablets; use one in your writing and it catches fire. On the
// entries page the tablets carry the names of whoever wrote before you.
// The original generator/entries scripts run untouched; this only watches
// what they put on the page.

(function () {
  const THREE = window.THREE;
  const P = window.PLATE;
  const rand = P.mulberry32(77);
  const MODE = document.body.dataset.mode || 'words';
  const MAX = MODE === 'entries' ? 12 : 10;

  const scene = new THREE.Scene();
  const NIGHT = new THREE.Color(0.11, 0.07, 0.09);
  scene.fog = new THREE.FogExp2(NIGHT, 0.012);

  const camera = new THREE.PerspectiveCamera(46, 1, 0.5, 900);
  const CAM_Z = 25;
  camera.position.set(0, 5.6, CAM_Z);
  const LOOK_AT = new THREE.Vector3(0, 2.4, 0);

  // ---------------------------------------------------------------- sky

  const MOON = new THREE.Vector3(0.35, 0.32, -1).normalize();
  const skyMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uFlash: { value: 0 }, uMoon: { value: MOON }, uFever: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position.z = gl_Position.w;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime, uFlash, uFever;
      uniform vec3 uMoon;
      varying vec3 vDir;
      ${P.GLSL_NOISE}
      void main() {
        vec3 d = normalize(vDir);
        float h = d.y;
        float az = atan(d.x, -d.z);
        vec3 low = mix(vec3(0.34, 0.16, 0.12), vec3(0.6, 0.2, 0.1), uFever);
        vec3 col = mix(low, vec3(0.1, 0.06, 0.14), smoothstep(0.0, 0.3, h));
        col = mix(col, vec3(0.02, 0.025, 0.06), smoothstep(0.25, 0.9, h));
        // ruled cloud, like lines on a page
        float rule = smoothstep(0.55, 0.7, fbm(vec2(az * 3.0 + uTime * 0.01, h * 30.0)));
        col = mix(col, vec3(0.42, 0.3, 0.26), rule * smoothstep(0.55, 0.05, h) * 0.6);
        // a pale moon with a bite out of it
        float md = acos(clamp(dot(d, uMoon), -1.0, 1.0));
        float disc = smoothstep(0.075, 0.07, md);
        vec3 bite = normalize(uMoon + vec3(0.03, 0.02, 0.0));
        float bd = acos(clamp(dot(d, bite), -1.0, 1.0));
        disc *= smoothstep(0.06, 0.066, bd);
        col = mix(col, vec3(0.95, 0.9, 0.74), disc);
        col += vec3(0.8, 0.6, 0.4) * exp(-md * 9.0) * 0.25;
        vec2 sg = vec2(az * 70.0, h * 70.0);
        float star = step(0.988, hash(floor(sg))) * smoothstep(0.2, 0.5, h);
        col += vec3(0.9, 0.85, 0.7) * star * step(length(fract(sg) - 0.5), 0.2);
        col += uFlash * vec3(1.0, 0.85, 0.6) * (0.3 + 0.7 * smoothstep(0.5, 0.0, h));
        gl_FragColor = vec4(col, 1.0);
      }`,
    side: THREE.BackSide, depthWrite: false, fog: false,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(800, 40, 24), skyMat);
  sky.renderOrder = -10;
  scene.add(sky);

  // ---------------------------------------------------------------- light + ground

  const moonLight = new THREE.DirectionalLight(0xc8b8ff, 2.4);
  moonLight.position.set(30, 70, 90);
  moonLight.castShadow = true;
  moonLight.shadow.mapSize.set(1024, 1024);
  Object.assign(moonLight.shadow.camera, { left: -40, right: 40, top: 30, bottom: -20, near: 1, far: 300 });
  scene.add(moonLight);
  scene.add(new THREE.HemisphereLight(0x5a5a90, 0x2a1408, 1.9));
  const fireLight = new THREE.PointLight(0xff7a30, 0, 40, 1.2);
  fireLight.position.set(0, 7, 4);
  scene.add(fireLight);

  {
    const geo = new THREE.PlaneGeometry(900, 900, 120, 120);
    geo.rotateX(-Math.PI / 2);
    const p = geo.attributes.position;
    const cols = new Float32Array(p.count * 3);
    const a = new THREE.Color(0x4e3a2c), b = new THREE.Color(0x2a1c16), c = new THREE.Color(0x6a5a48), out = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i);
      const r = Math.hypot(x, z);
      // furrows, as if the field had been ploughed in lines
      const furrow = Math.sin(z * 1.4 + P.fbm(x * 0.02, z * 0.02) * 6) * 0.18;
      p.setY(i, furrow * P.smooth(6, 30, r) + (P.fbm(x * 0.01, z * 0.01) - 0.5) * 18 * P.smooth(60, 260, r));
      out.copy(a).lerp(b, P.vnoise(x * 0.05, z * 0.05)).lerp(c, P.smooth(0.55, 0.8, P.fbm(x * 0.03 + 5, z * 0.03)) * 0.6);
      out.toArray(cols, i * 3);
    }
    geo.computeVertexNormals();
    geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    const ground = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
    ground.receiveShadow = true;
    scene.add(ground);
    // the ground again on the clean layer, invisible, so buried words stay buried
    const groundMask = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ colorWrite: false }));
    groundMask.layers.set(1);
    scene.add(groundMask);
  }

  // old blank tablets scattered out to the horizon, waiting to be written on
  {
    const COUNT = 900;
    const geo = new THREE.BoxGeometry(1, 1, 1);
    geo.translate(0, 0.5, 0);
    const mesh = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true }), COUNT);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), c = new THREE.Color();
    for (let i = 0; i < COUNT; i++) {
      const r = 26 + Math.pow(rand(), 1.4) * 320;
      const a = (rand() - 0.5) * Math.PI * 1.7;
      const x = Math.sin(a) * r, z = -Math.cos(a) * r + 6;
      e.set((rand() - 0.5) * 0.4, (rand() - 0.5) * 0.8, (rand() - 0.5) * 0.4);
      q.setFromEuler(e);
      const w = 1 + rand() * 3;
      m.compose(new THREE.Vector3(x, -0.6, z), q, new THREE.Vector3(w, 0.6 + rand() * 2.6, 0.5 + rand() * 0.4));
      mesh.setMatrixAt(i, m);
      c.setHSL(0.07 + rand() * 0.04, 0.2, 0.18 + rand() * 0.2);
      mesh.setColorAt(i, c);
    }
    mesh.castShadow = mesh.receiveShadow = true;
    scene.add(mesh);
  }

  // ---------------------------------------------------------------- the tablets

  const stone = new THREE.MeshLambertMaterial({ color: 0x8a7458, flatShading: true });
  const tablets = [];      // live + sinking
  const pickables = [];

  function faceTexture(text) {
    const len = Math.max(3, text.length);
    const w = 32 + len * 22, h = 64;
    return {
      tex: P.canvasTexture(w, h, (g) => {
        P.stoneFill(g, w, h, '#7a654c', rand);
        g.strokeStyle = '#2a1a0c';
        g.lineWidth = 2;
        g.strokeRect(4, 4, w - 8, h - 8);
        // a faint ghost of the letters cut into the stone; the readable word
        // is drawn sharp on top (see letterTexture)
        const size = Math.min(40, Math.floor((w - 20) / (text.length * 0.55)));
        P.inscribe(g, text, w / 2, h / 2 + 2, size, { color: 'rgba(30,18,8,0.55)', shadow: 'rgba(240,210,150,0.2)' });
      }),
      aspect: w / h,
    };
  }

  // the word itself, high resolution, light letters with a dark cut edge
  function letterTexture(text, aspect) {
    const w = 1024, h = Math.round(1024 / aspect);
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const g = cv.getContext('2d');
    let size = Math.floor(h * 0.62);
    const fit = () => { g.font = `bold ${size}px "Times New Roman", Times, serif`; return g.measureText(text).width; };
    while (fit() > w * 0.86 && size > 10) size -= 2;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineJoin = 'round';
    const y = h / 2 + size * 0.04;
    g.lineWidth = Math.max(4, size * 0.14);
    g.strokeStyle = 'rgba(14, 7, 2, 0.95)';
    g.strokeText(text, w / 2, y);
    g.fillStyle = '#ffffff';
    g.fillText(text, w / 2, y);
    const tex = new THREE.CanvasTexture(cv);
    tex.anisotropy = 4;
    return tex;
  }
  const LETTER_IDLE = new THREE.Color(0xeedcae);
  const LETTER_LIT = new THREE.Color(0xfff2b8);
  const LETTER_HOVER = new THREE.Color(0xffffff);

  const H = 2.0;
  function tabletWidth(text) {
    return Math.min(5.6, 1.2 + Math.max(3, text.length) * 0.44);
  }

  // one or two even rows, centred, nearest row lowest
  function arrange(texts) {
    const rows = texts.length > 5 ? 2 : 1;
    const per = Math.ceil(texts.length / rows);
    const spots = [];
    for (let r = 0; r < rows; r++) {
      const row = texts.slice(r * per, (r + 1) * per);
      const gap = 0.7;
      const total = row.reduce((sum, t) => sum + tabletWidth(t), 0) + gap * (row.length - 1);
      let x = -total / 2;
      row.forEach((t) => {
        const w = tabletWidth(t);
        // back row a little higher and further, slight arc so they face you
        const z = r === 0 ? (rows === 2 ? -1 : 2) : 6;
        const cx = x + w / 2;
        spots.push({ x: cx, z: z - Math.abs(cx) * 0.12, y: r === 0 && rows === 2 ? 1.6 : 0 });
        x += w + gap;
      });
    }
    return spots;
  }

  function makeTablet(text, spot, key, slot) {
    const { tex } = faceTexture(text);
    const W = tabletWidth(text);
    const face = new THREE.MeshLambertMaterial({ map: tex, emissive: 0xff6a20, emissiveIntensity: 0, emissiveMap: tex });
    const body = new THREE.Mesh(new THREE.BoxGeometry(W, H, 0.9), [stone, stone, stone, stone, face, stone]);
    body.castShadow = body.receiveShadow = true;
    const group = new THREE.Group();
    group.add(body);
    body.position.y = H / 2 + 0.7;
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(W + 0.6, 0.7 + spot.y, 1.5), stone);
    plinth.position.y = (0.7 + spot.y) / 2 - spot.y;
    plinth.castShadow = plinth.receiveShadow = true;
    group.add(plinth);

    const flames = [];
    const nf = Math.max(1, Math.round(W / 2.0));
    for (let k = 0; k < nf; k++) {
      const fl = P.flameSprite();
      fl.position.set((k - (nf - 1) / 2) * (W / nf), H + 0.7 + 1.1, 0);
      fl.scale.set(1.3, 0.01, 1);
      group.add(fl);
      flames.push(fl);
    }

    group.position.set(spot.x, spot.y, spot.z);
    group.lookAt(spot.x * 0.3, spot.y, CAM_Z);
    const baseY = spot.y;
    group.position.y = baseY - (H + 1.6);   // starts buried
    scene.add(group);
    body.userData.tablet = key;
    pickables.push(body);

    // clean layer: the slab as an invisible mask, then the word, sharp
    const mask = new THREE.Mesh(body.geometry, new THREE.MeshBasicMaterial({ colorWrite: false }));
    mask.position.copy(body.position);
    mask.layers.set(1);
    group.add(mask);
    const letters = new THREE.Mesh(
      new THREE.PlaneGeometry(W * 0.94, H * 0.86),
      new THREE.MeshBasicMaterial({ map: letterTexture(text, (W * 0.94) / (H * 0.86)), transparent: true, depthWrite: false, color: LETTER_IDLE.clone() })
    );
    letters.position.set(0, body.position.y, 0.47);
    letters.layers.set(1);
    letters.renderOrder = 2;
    group.add(letters);

    return {
      key, text, group, body, face, flames, H, baseY, letters,
      rise: 0, used: 0, wantUsed: false, wantUp: true, delay: slot * 0.18, dead: false,
    };
  }

  function sync(items) {
    // items: [{ key, text, used }]
    const keys = new Set(items.map((it) => it.key));
    tablets.forEach((t) => { if (!keys.has(t.key)) t.wantUp = false; });
    const shown = items.slice(0, MAX);
    const fresh = shown.some((it) => !tablets.find((t) => t.key === it.key && t.wantUp));
    if (fresh) {
      // a new set: sink everything that's left, raise the new ones in order
      tablets.forEach((t) => { t.wantUp = false; });
      const spots = arrange(shown.map((it) => it.text));
      shown.forEach((it, i) => {
        const t = makeTablet(it.text, spots[i], it.key, i);
        t.delay += 0.7;
        tablets.push(t);
      });
    }
    shown.forEach((it) => {
      const t = tablets.find((x) => x.key === it.key && x.wantUp);
      if (t) {
        if (it.used && !t.wantUsed) { P.hum.blip(196 * Math.pow(2, (tablets.indexOf(t) % 7) / 7), 0.8, 0.1); }
        t.wantUsed = !!it.used;
      }
    });
  }

  // ---------------------------------------------------------------- watching the page

  let complete = false;
  if (MODE === 'words') {
    const wordList = document.getElementById('word-list');
    const read = () => {
      const pills = Array.from(wordList.querySelectorAll('.word-pill'));
      // key includes the order so a reroll that repeats a word still re-raises it
      const stamp = pills.map((p) => p.dataset.word).join('|');
      sync(pills.map((p) => ({ key: stamp + '#' + p.dataset.word, text: p.dataset.word, used: p.classList.contains('is-used') })));
      complete = pills.length > 0 && pills.every((p) => p.classList.contains('is-used'));
    };
    new MutationObserver(read).observe(wordList, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    read();
    const box = document.getElementById('writing-box');
    box.addEventListener('input', () => spark(1 + Math.floor(Math.random() * 2)));
    document.querySelector('.submit-button').addEventListener('click', () => {
      if (plate) { plate.feedback = 0.85; fx.flash = 1; }
    }, true);
  } else {
    const list = document.getElementById('entry-list');
    const read = () => {
      const buttons = Array.from(list.querySelectorAll('.entry-button'));
      sync(buttons.map((b, i) => ({
        key: 'entry:' + i + ':' + (b.querySelector('strong')?.textContent || ''),
        text: (b.querySelector('strong')?.textContent || 'Unnamed').slice(0, 18),
        used: b.classList.contains('is-active'),
        button: b,
      })));
      entryButtons = buttons;
    };
    let entryButtons = [];
    new MutationObserver(read).observe(list, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    read();
    window.__entryButtons = () => entryButtons;
  }

  // ---------------------------------------------------------------- sparks off the pen

  const SPARKS = 300;
  const sparkPos = new Float32Array(SPARKS * 3);
  const sparkVel = new Float32Array(SPARKS * 3);
  const sparkLife = new Float32Array(SPARKS);
  let sparkHead = 0;
  const sparkGeo = new THREE.BufferGeometry();
  sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));
  sparkGeo.setAttribute('life', new THREE.BufferAttribute(sparkLife, 1));
  const sparkMat = new THREE.ShaderMaterial({
    vertexShader: /* glsl */ `
      attribute float life;
      varying float vL;
      void main() {
        vL = life;
        gl_PointSize = life > 0.0 ? 1.0 + step(0.7, life) : 0.0;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      varying float vL;
      void main() { if (vL <= 0.0) discard; gl_FragColor = vec4(mix(vec3(0.8, 0.2, 0.05), vec3(1.0, 0.9, 0.5), vL), 1.0); }`,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
  });
  const sparks = new THREE.Points(sparkGeo, sparkMat);
  sparks.frustumCulled = false;
  scene.add(sparks);

  function spark(n, from) {
    for (let k = 0; k < n * 6; k++) {
      const i = sparkHead++ % SPARKS;
      const live = tablets.filter((t) => t.wantUp);
      const src = from || (live.length ? live[Math.floor(Math.random() * live.length)].group.position : new THREE.Vector3(0, 0, 0));
      sparkPos[i * 3] = src.x + (Math.random() - 0.5) * 3;
      sparkPos[i * 3 + 1] = Math.max(0.2, src.y) + Math.random() * 2;
      sparkPos[i * 3 + 2] = src.z + (Math.random() - 0.5) * 1.5;
      sparkVel[i * 3] = (Math.random() - 0.5) * 1.5;
      sparkVel[i * 3 + 1] = 2 + Math.random() * 4;
      sparkVel[i * 3 + 2] = (Math.random() - 0.5) * 1.5;
      sparkLife[i] = 1;
    }
  }

  // ---------------------------------------------------------------- plate

  const fx = { flash: 0, fever: 0 };
  let panelW = 0;
  const plate = P.create({
    scene, camera, fov: [50, 64], clean: true,
    onResize(vw, vh) {
      const panel = document.querySelector('.panel');
      const wide = vw > 820;
      panelW = wide && panel ? panel.getBoundingClientRect().right : 0;
      // slide the view so the tablets sit in the space beside the panel
      if (panelW) camera.setViewOffset(vw, vh, -panelW / 2, 0, vw, vh);
    },
    omens: {
      texts: MODE === 'words'
        ? ['writing sketch instrument', 'submit your creation', 'select an amount', 'your words to use']
        : ['stored sketches', 'a small ledger', 'for users, by users', 'make another'],
      extras: [() => { fx.flash = 1; }, () => spark(8)],
    },
  });
  if (!plate) return;
  window.addEventListener('load', () => plate.resize());

  const pick = P.picker(camera, pickables, 120);
  const look = P.follow(plate, { rate: 1.1 });
  const pointer = new THREE.Vector2(9, 9);
  plate.canvas.addEventListener('pointermove', (e) => {
    pointer.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  });
  plate.canvas.addEventListener('pointerleave', () => pointer.set(9, 9));
  plate.canvas.addEventListener('click', (e) => {
    pointer.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    const hit = pick(pointer);
    if (!hit) return;
    const t = tablets.find((x) => x.key === hit.userData.tablet && x.wantUp);
    if (!t) return;
    if (MODE === 'entries') {
      const idx = Number(t.key.split(':')[1]);
      const b = window.__entryButtons()[idx];
      if (b) { b.click(); b.scrollIntoView({ block: 'nearest' }); }
    } else {
      spark(6, t.group.position);
      P.hum.blip(330, 0.4);
    }
  });

  let hoverKey = null;
  plate.run((dt, t) => {
    // ease after the cursor
    look.update(dt, t);
    camera.position.set(look.x * 2.4, 5.6 + look.y * 0.8 + Math.sin(t * 0.3) * 0.06, CAM_Z);
    camera.lookAt(LOOK_AT.x + look.x * 1.2, LOOK_AT.y + look.y * 0.6, LOOK_AT.z);

    const hit = pointer.x < 5 ? pick(pointer) : null;
    const hk = hit ? hit.userData.tablet : null;
    if (hk !== hoverKey) {
      hoverKey = hk;
      plate.canvas.classList.toggle('over-thing', !!hk);
    }

    let burning = 0;
    for (let i = tablets.length - 1; i >= 0; i--) {
      const tb = tablets[i];
      if (tb.delay > 0) { tb.delay -= dt; continue; }
      tb.rise = P.damp(tb.rise, tb.wantUp ? 1 : 0, tb.wantUp ? 1.6 : 2.6, dt);
      tb.used = P.damp(tb.used, tb.wantUsed && tb.wantUp ? 1 : 0, 3, dt);
      const shake = tb.wantUp && tb.rise < 0.97 ? (Math.random() - 0.5) * 0.08 : 0;
      tb.group.position.y = tb.baseY - (1 - tb.rise) * (tb.H + 1.6) + shake;
      tb.group.rotation.z = Math.sin(t * 0.5 + i) * 0.006 + shake * 0.2;
      tb.face.emissiveIntensity = tb.used * (0.55 + 0.25 * P.vnoise(t * 6 + i, 2)) + (hoverKey === tb.key ? 0.25 : 0);
      tb.letters.material.color.copy(LETTER_IDLE).lerp(LETTER_LIT, tb.used);
      if (tb.used > 0.05) tb.letters.material.color.offsetHSL(0, 0, -0.06 * P.vnoise(t * 7 + i, 4));
      if (hoverKey === tb.key) tb.letters.material.color.lerp(LETTER_HOVER, 0.6);
      tb.flames.forEach((f, k) => {
        const h = tb.used * (complete ? 3.6 : 2.3) * (0.9 + 0.2 * P.vnoise(t * 3 + k, i));
        f.scale.set(1.4, Math.max(0.01, h), 1);
        f.position.y = tb.H + 0.7 + h / 2 - 0.1;
        f.visible = h > 0.05;
      });
      burning += tb.used;
      if (tb.wantUp && tb.rise < 0.98 && Math.random() < 0.15) spark(1, tb.group.position);
      if (!tb.wantUp && tb.rise < 0.01) {
        scene.remove(tb.group);
        const pi = pickables.indexOf(tb.body);
        if (pi >= 0) pickables.splice(pi, 1);
        tablets.splice(i, 1);
      }
    }
    fireLight.intensity = P.damp(fireLight.intensity, burning * 9 + (complete ? 30 : 0), 3, dt);
    fx.fever = P.damp(fx.fever, complete ? 1 : 0, 1.5, dt);

    for (let i = 0; i < SPARKS; i++) {
      if (sparkLife[i] <= 0) continue;
      sparkLife[i] -= dt * 0.6;
      sparkVel[i * 3] += Math.sin(t * 2 + i) * dt * 0.8;
      sparkPos[i * 3] += sparkVel[i * 3] * dt;
      sparkPos[i * 3 + 1] += sparkVel[i * 3 + 1] * dt;
      sparkPos[i * 3 + 2] += sparkVel[i * 3 + 2] * dt;
    }
    sparkGeo.attributes.position.needsUpdate = true;
    sparkGeo.attributes.life.needsUpdate = true;
    if (complete && Math.random() < 0.3) spark(1);

    fx.flash = Math.max(0, fx.flash - dt * 2);
    skyMat.uniforms.uFlash.value = fx.flash;
    skyMat.uniforms.uFever.value = fx.fever;
    skyMat.uniforms.uTime.value = t;
    sky.position.copy(camera.position);
    P.animateFlames(scene, t);
  });
})();
