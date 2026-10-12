// videos / the end wall of a cathedral, hung with tapestries. Each one is a
// video, woven: thumbnail in the field, a red border with gold lozenges, a
// fringe at the bottom. Wind comes through in gusts and they lift and settle.
// All of them are in view at once; click one to play it.

(function () {
  const THREE = window.THREE;
  const P = window.PLATE;
  const rand = P.mulberry32(23);

  const VIDEOS = [
    ['alQNx0ceCzU', 'Lily Talmers - My Mortal Wound'],
    ['gpFsfQlkiAs', "Lily Talmers - Life's So Fun"],
    ['2GNermXRfW8', 'Lily Talmers - Prayer For Nearly Nothing'],
    ['IR3O3-4_Ubg', 'Lily Talmers - Best of Times'],
    ['9zI8pF6S-RI', 'Eight Carl - Torgo Kills/Torgo Lives'],
    ['hOguQb-k22I', 'waxing away indifference bleeds heartache in a birdsong'],
    ['cSI8bUAfnWI', 'shared flight, silent echoes'],
    ['HVYqS1dICm0', 'my mind is gossamer, my legs are trees'],
    ['O7I9RpXeSaw', "Help! My Roommate's A Monster!"],
    ['3jCfcEKLvU8', 'Color of the Year - Hippie Summer Camp'],
    ['cFcHj81zGs0', 'dust motes in a sunbeam'],
    ['MLAGSNympJ8', 'Sonifying the Thawing Great Lakes'],
    ['41o1Xgtui9I', 'Life After Work'],
    ['c13Fe905lVs', 'Quiet Remains'],
    ['F6bJBp4rzvk', "i'd rather remain in my dreams; at least there i can't think about you; how do i go on from here?"],
    ['xBeVeAeClkU', 'The Security Deposit'],
    ['vXqSd1hKWrs', "The Bada-Ba-Ba-Ba's - sparks"],
    ['mTyq5__0fCI', 'july 16th 2013'],
    ['6-IH3xzIPq0', 'once again'],
    ['yJcetqNbJIE', 'why should you expect to comprehend?'],
    ['fxjCKMlMfek', 'women want me. fish fear me.'],
    ['xC7Pv5TDT9w', 'THE SHOEGAZE SHOW S1E1'],
    ['kHpaVnxLyRI', 'lets just forget about christmas'],
  ];
  const N = VIDEOS.length;

  const TW = 6.2, TH = 5.8;          // a tapestry
  // the picture is cut to 16:9 so thumbnails and the player aren't stretched
  const FIELD = { x0: 0.07, x1: 0.93, y0: 0.91 - (0.86 * 6.2 / (16 / 9)) / 5.8, y1: 0.91 };
  const FIELD_GLSL = /* glsl */ `
    const vec2 lo = vec2(${FIELD.x0.toFixed(3)}, ${FIELD.y0.toFixed(3)});
    const vec2 hi = vec2(${FIELD.x1.toFixed(3)}, ${FIELD.y1.toFixed(3)});
    bool moth(vec2 uv, float seed) {
      // a ragged hole or two, kept out of the middle of the picture
      bool inField = uv.x > lo.x - 0.01 && uv.x < hi.x + 0.01 && uv.y > lo.y - 0.01 && uv.y < hi.y + 0.01;
      return !inField && noise(uv * vec2(14.0, 12.0) + seed * 40.0) > 0.88 && uv.y > 0.12;
    }`;
  const SX = 7.4, SY = 7.6;          // spacing on the wall
  const BASE_Y = 5.2;                // centre of the bottom row

  const scene = new THREE.Scene();
  const GLOOM = new THREE.Color(0.13, 0.08, 0.1);
  scene.fog = new THREE.Fog(GLOOM, 60, 190);
  scene.background = GLOOM;
  const camera = new THREE.PerspectiveCamera(50, 1, 0.5, 600);

  // ---------------------------------------------------------------- light

  const sunDir = new THREE.Vector3(-0.32, 0.5, 0.8).normalize();
  const sun = new THREE.DirectionalLight(0xffb878, 3.6);
  sun.position.copy(sunDir).multiplyScalar(120);
  sun.target.position.set(0, 12, 0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -60, right: 60, top: 60, bottom: -40, near: 1, far: 320 });
  sun.shadow.bias = -0.0015;
  scene.add(sun, sun.target);
  scene.add(new THREE.HemisphereLight(0x5a64a0, 0x3a1a0c, 1.6));

  const stone = new THREE.MeshLambertMaterial({ color: 0x8a745c, flatShading: true });
  const darkStone = new THREE.MeshLambertMaterial({ color: 0x33261f, flatShading: true });
  const gilt = new THREE.MeshLambertMaterial({ color: 0xc9953e, emissive: 0x1a0c02, flatShading: true });

  function box(parent, w, h, d, x, y, z, mat = stone, rz = 0) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.rotation.z = rz;
    m.castShadow = m.receiveShadow = true;
    parent.add(m);
    return m;
  }

  // floor, the end wall, and long side walls running back toward you
  {
    const cols = 40, rows = 40, size = 2.2;
    const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true }), cols * rows);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), c = new THREE.Color();
    const a = new THREE.Color(0x7a6650), b = new THREE.Color(0x3d3028);
    let n = 0;
    for (let r = 0; r < rows; r++) {
      for (let k = 0; k < cols; k++) {
        e.set((rand() - 0.5) * 0.03, (rand() - 0.5) * 0.05, (rand() - 0.5) * 0.03);
        q.setFromEuler(e);
        m.compose(new THREE.Vector3((k - cols / 2) * size + (r % 2) * 0.6, -0.15, 2 + r * size), q, new THREE.Vector3(size * 0.95, 0.3, size * 0.95));
        mesh.setMatrixAt(n, m);
        c.copy(a).lerp(b, rand() * 0.8);
        mesh.setColorAt(n++, c);
      }
    }
    mesh.receiveShadow = true;
    scene.add(mesh);
  }
  const wall = new THREE.Mesh(new THREE.BoxGeometry(140, 80, 2), darkStone);
  wall.position.set(0, 38, -1);
  wall.receiveShadow = true;
  scene.add(wall);

  // ---------------------------------------------------------------- the rose window

  const roseMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uFlash: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime, uFlash;
      varying vec2 vUv;
      ${P.GLSL_NOISE}
      void main() {
        vec2 p = (vUv - 0.5) * 2.0;
        float r = length(p);
        if (r > 1.0) discard;
        float a = atan(p.y, p.x);
        float petals = abs(cos(a * 6.0));
        // lead tracery: rings, spokes, petal outlines
        float lead = step(abs(r - 0.32), 0.03) + step(abs(r - 0.95), 0.05)
                   + step(abs(fract(a / 6.2831 * 12.0) - 0.5), 0.02) * step(0.32, r)
                   + step(abs(r - (0.55 + 0.35 * petals)), 0.03);
        vec3 glass = mix(vec3(0.75, 0.12, 0.08), vec3(0.15, 0.25, 0.7), step(0.5, fract(a / 6.2831 * 12.0 + 0.25)));
        glass = mix(glass, vec3(0.95, 0.75, 0.3), step(r, 0.32));
        glass *= 0.7 + 0.5 * noise(p * 9.0 + uTime * 0.2);
        vec3 col = mix(glass * (1.2 + uFlash), vec3(0.03, 0.02, 0.02), clamp(lead, 0.0, 1.0));
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const rose = new THREE.Mesh(new THREE.CircleGeometry(1, 48), roseMat);
  scene.add(rose);
  const roseLight = new THREE.PointLight(0xff9a60, 30, 40, 1.3);
  scene.add(roseLight);

  // ---------------------------------------------------------------- tapestries

  const tapVert = /* glsl */ `
    uniform float uTime, uHover, uGust, uSeed, uStill;
    uniform vec2 uSize;
    varying vec2 vUv;
    varying vec3 vN;
    varying float vFold;
    float dispZ(vec2 uv) {
      float hang = 1.0 - uv.y;
      float a = pow(hang, 1.35);
      float t = uTime;
      float wave = sin(uv.x * 3.1 + t * 1.3 + uSeed * 6.0 + hang * 3.5) * 0.22
                 + sin(uv.x * 7.3 - t * 2.1 + uSeed * 3.0) * 0.07;
      float g = uGust * (0.75 + 0.25 * sin(t * 4.0 + uv.x * 2.5 + uSeed));
      return (a * (wave * (1.0 + uHover * 1.6) + g * 2.4) + 0.25 * a) * (1.0 - uStill);
    }
    void main() {
      vUv = uv;
      vec3 p = position;
      float hang = 1.0 - uv.y;
      float z = dispZ(uv);
      p.z += z;
      // gusts lift the hem up and out
      p.y += hang * hang * uGust * 1.1 * (1.0 - uStill);
      p.x += hang * hang * sin(uTime * 0.8 + uSeed * 5.0) * 0.15 * (1.0 + uGust * 2.0) * (1.0 - uStill);
      // fake a normal from the slope of the cloth
      float e = 0.01;
      float dzx = (dispZ(uv + vec2(e, 0.0)) - z) / (e * uSize.x);
      float dzy = (dispZ(uv + vec2(0.0, e)) - z) / (e * uSize.y);
      vN = normalize(normalMatrix * normalize(vec3(-dzx, -dzy, 1.0)));
      vFold = z;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
    }`;
  const tapFrag = /* glsl */ `
    uniform sampler2D map;
    uniform float uTime, uHover, uSeed, uDim;
    uniform vec3 uLight;
    varying vec2 vUv;
    varying vec3 vN;
    varying float vFold;
    ${P.GLSL_NOISE}
    ${FIELD_GLSL}
    float lozenge(vec2 p, float k) {
      vec2 q = abs(fract(p * k) - 0.5);
      return step(q.x + q.y, 0.22);
    }
    void main() {
      vec2 uv = vUv;
      // fringe: hanging threads of uneven length
      float strand = floor(uv.x * 42.0);
      float len = 0.05 + 0.06 * hash(vec2(strand, uSeed * 10.0));
      if (uv.y < 0.11) {
        if (fract(uv.x * 42.0) > 0.55 || uv.y < 0.11 - len) discard;
      }
      // a ragged hole or two from moths
      if (moth(uv, uSeed)) discard;

      vec3 border = vec3(0.42, 0.07, 0.05);
      vec3 gold = vec3(0.86, 0.62, 0.22);
      vec3 col = border;
      col = mix(col, gold, lozenge(uv * vec2(1.0, 0.95), 9.0));

      bool field = uv.x > lo.x && uv.x < hi.x && uv.y > lo.y && uv.y < hi.y;
      if (field) {
        vec2 fuv = (uv - lo) / (hi - lo);
        vec3 img = texture2D(map, fuv).rgb;
        // woven: fewer colours, weft lines
        img = floor(img * 6.0 + 0.5) / 6.0;
        img *= 0.86 + 0.14 * step(0.5, fract(fuv.y * 70.0));
        col = img;
      } else if (uv.y > 0.13 && uv.y < lo.y - 0.02 && uv.x > lo.x && uv.x < hi.x) {
        // the lower band: indigo with gold eyes
        col = vec3(0.07, 0.08, 0.2);
        vec2 q = vec2(fract(uv.x * 9.0) - 0.5, (uv.y - 0.2) * 9.0 / 0.95);
        float eye = step(length(q * vec2(1.0, 1.8)), 0.36) - step(length(q), 0.12);
        col = mix(col, gold, clamp(eye, 0.0, 1.0));
      }
      // gold rules between the zones
      float rule = step(abs(uv.y - lo.y + 0.008), 0.006) + step(abs(uv.y - hi.y - 0.008), 0.006)
                 + step(abs(uv.x - lo.x + 0.006), 0.005) * step(0.13, uv.y) + step(abs(uv.x - hi.x - 0.006), 0.005) * step(0.13, uv.y);
      col = mix(col, gold, clamp(rule, 0.0, 1.0));

      // light it like cloth
      vec3 n = normalize(gl_FrontFacing ? vN : -vN);
      float diff = max(dot(n, normalize(uLight)), 0.0);
      float shade = 0.5 + 0.42 * diff + 0.1 * (1.0 - uv.y);
      col *= shade * (gl_FrontFacing ? 1.0 : 0.45);
      col *= 1.0 + uHover * 0.3;
      col += vec3(0.12, 0.05, 0.01) * uHover;
      col *= 1.0 - uDim * 0.55;
      gl_FragColor = vec4(col, 1.0);
    }`;

  // the picture alone, drawn sharp over the print (layer 1)
  const fieldFrag = /* glsl */ `
    uniform sampler2D map;
    uniform float uHover, uSeed, uDim;
    uniform vec3 uLight;
    varying vec2 vUv;
    varying vec3 vN;
    ${P.GLSL_NOISE}
    ${FIELD_GLSL}
    void main() {
      vec2 uv = vUv;
      if (!(uv.x > lo.x && uv.x < hi.x && uv.y > lo.y && uv.y < hi.y)) discard;
      if (moth(uv, uSeed)) discard;
      vec2 fuv = (uv - lo) / (hi - lo);
      vec3 img = texture2D(map, fuv).rgb;
      // just enough of the weave and the fold to keep it cloth
      img *= 0.95 + 0.05 * step(0.5, fract(fuv.y * 90.0));
      vec3 n = normalize(gl_FrontFacing ? vN : -vN);
      float diff = max(dot(n, normalize(uLight)), 0.0);
      img *= (0.78 + 0.3 * diff) * (1.0 + uHover * 0.12) * (1.0 - uDim * 0.6);
      img = mix(img, img * vec3(1.05, 0.95, 0.82), 0.5);
      if (!gl_FrontFacing) img *= 0.3;
      gl_FragColor = vec4(img, 1.0);
    }`;

  function placeholder(title, i) {
    return P.canvasTexture(192, 108, (g, w, h) => {
      g.fillStyle = '#1a0e14';
      g.fillRect(0, 0, w, h);
      for (let k = 0; k < 900; k++) {
        const v = 40 + Math.floor(rand() * 120);
        g.fillStyle = `rgb(${v},${v * 0.8},${v * 0.7})`;
        g.fillRect(rand() * w, rand() * h, 1 + rand() * 3, 1);
      }
      g.font = 'bold 13px "Times New Roman", Times, serif';
      g.textAlign = 'center';
      g.fillStyle = '#f4cf68';
      const words = title.split(' ');
      let line = '', lines = [];
      for (const word of words) {
        if ((line + ' ' + word).length > 22) { lines.push(line); line = word; } else line = line ? line + ' ' + word : word;
      }
      lines.push(line);
      lines.slice(0, 3).forEach((l, k) => g.fillText(l, w / 2, h / 2 - 8 + k * 15));
      g.font = '11px "Courier New", Courier, monospace';
      g.fillStyle = '#b57b2a';
      g.fillText(String(i + 1).padStart(2, '0'), 14, 13);
    });
  }

  const tapGeo = new THREE.PlaneGeometry(TW, TH, 24, 26);
  const tapestries = VIDEOS.map(([id, title], i) => {
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        map: { value: placeholder(title, i) },
        uTime: { value: 0 }, uHover: { value: 0 }, uGust: { value: 0 }, uSeed: { value: rand() },
        uStill: { value: 0 }, uDim: { value: 0 },
        uLight: { value: new THREE.Vector3(-0.5, 0.6, 0.9) },
        uSize: { value: new THREE.Vector2(TW, TH) },
      },
      vertexShader: tapVert,
      fragmentShader: tapFrag,
      side: THREE.DoubleSide,
    });
    const group = new THREE.Group();
    const cloth = new THREE.Mesh(tapGeo, mat);
    cloth.position.set(0, -TH / 2 - 0.1, 0);
    cloth.castShadow = true;
    cloth.userData.index = i;
    group.add(cloth);
    // layer 1: the same cloth again, depth only (so nearer cloth hides farther
    // pictures), then the picture itself, sharp
    const occluder = new THREE.Mesh(tapGeo, new THREE.ShaderMaterial({
      uniforms: mat.uniforms, vertexShader: tapVert, fragmentShader: tapFrag,
      side: THREE.DoubleSide, colorWrite: false,
    }));
    occluder.position.copy(cloth.position);
    occluder.layers.set(1);
    occluder.renderOrder = -1;
    group.add(occluder);
    const field = new THREE.Mesh(tapGeo, new THREE.ShaderMaterial({
      uniforms: mat.uniforms, vertexShader: tapVert, fragmentShader: fieldFrag,
      side: THREE.DoubleSide,
    }));
    field.position.copy(cloth.position);
    field.layers.set(1);
    group.add(field);
    // the rod it hangs from
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, TW + 1.0, 6), gilt);
    rod.rotation.z = Math.PI / 2;
    rod.castShadow = true;
    group.add(rod);
    for (const s of [-1, 1]) {
      const fin = new THREE.Mesh(new THREE.OctahedronGeometry(0.32), gilt);
      fin.position.x = s * (TW / 2 + 0.6);
      group.add(fin);
      const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.25, 1.0), darkStone);
      bracket.position.set(s * (TW / 2 + 0.2), 0, -0.5);
      group.add(bracket);
    }
    scene.add(group);

    // real thumbnails when YouTube allows it; the woven static stays otherwise
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const tex = new THREE.Texture(img);
      tex.minFilter = THREE.LinearFilter;
      tex.generateMipmaps = false;
      tex.needsUpdate = true;
      mat.uniforms.map.value = tex;
    };
    img.src = `https://i.ytimg.com/vi/${id}/mqdefault.jpg`;

    return { id, title, i, group, cloth, mat, hover: 0, x: 0, home: new THREE.Vector3(), open: 0 };
  });
  const cloths = tapestries.map((t) => t.cloth);

  // ---------------------------------------------------------------- layout

  // the wall rearranges itself to the window; everything always fits
  const decor = new THREE.Group();
  scene.add(decor);
  const candleLights = [];
  let layoutInfo = null;

  // how much vertical room a given grid needs (floor to arch tips)
  const gridTop = (rows) => BASE_Y + (rows - 1) * SY + TH / 2 + 0.6 + 4.2;
  function bestCols(aspect) {
    let best = 8, bestScale = 0;
    for (const cols of [3, 4, 5, 6, 8]) {
      const rows = Math.ceil(N / cols);
      const scale = Math.min(aspect / (cols * SX + 4), 1 / (gridTop(rows) + 0.5));
      if (scale > bestScale) { bestScale = scale; best = cols; }
    }
    return best;
  }

  function layout(aspect) {
    const cols = bestCols(aspect);
    const rows = Math.ceil(N / cols);
    const W = cols * SX, H = rows * SY;
    tapestries.forEach((t, i) => {
      const r = Math.floor(i / cols);
      const inRow = r === rows - 1 ? N - cols * (rows - 1) : cols;
      const c = i % cols;
      const x = (c - (inRow - 1) / 2) * SX;
      const y = BASE_Y + (rows - 1 - r) * SY + TH / 2 + 0.1;
      t.home.set(x, y, 1.0);
      if (!t.open) t.group.position.copy(t.home);
      t.x = x;
    });

    decor.clear();
    candleLights.length = 0;
    const topY = BASE_Y + (rows - 1) * SY + TH / 2 + 0.6;
    // engaged columns between the bays, pointed arches over them
    for (let c = 0; c <= cols; c++) {
      const x = (c - cols / 2) * SX;
      box(decor, 1.1, topY + 1, 1.1, x, (topY + 1) / 2, 0.4, stone);
      box(decor, 1.6, 0.8, 1.6, x, 0.4, 0.4, stone);
    }
    for (let c = 0; c < cols; c++) {
      const x0 = (c - cols / 2) * SX;
      const rise = 2.8, half = SX / 2;
      const len = Math.hypot(half, rise);
      const ang = Math.atan2(rise, half);
      box(decor, len, 0.7, 0.9, x0 + half / 2, topY + 1 + rise / 2, 0.4, stone, ang);
      box(decor, len, 0.7, 0.9, x0 + half * 1.5, topY + 1 + rise / 2, 0.4, stone, -ang);
    }
    // a string course under the rose
    box(decor, W + 2, 0.9, 1.3, 0, topY + 4.6, 0.5, stone);
    // side walls with piers marching back toward you
    for (const s of [-1, 1]) {
      for (let z = 4; z < 90; z += 9) {
        box(decor, 2.2, topY + 12, 2.2, s * (W / 2 + 4.5), (topY + 12) / 2, z, stone);
      }
      box(decor, 1, topY + 30, 100, s * (W / 2 + 9), (topY + 30) / 2, 48, darkStone);
    }
    // candles along the foot of the wall
    const n = cols + 1;
    for (let k = 0; k < n; k++) {
      const x = (k - cols / 2) * SX;
      const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 1.4, 6), new THREE.MeshLambertMaterial({ color: 0xd8c8a0 }));
      stick.position.set(x, 1.5, 1.6);
      decor.add(stick);
      const fl = P.flameSprite();
      fl.scale.set(0.9, 1.5, 1);
      fl.position.set(x, 2.9, 1.6);
      decor.add(fl);
    }
    for (let k = 0; k < 3; k++) {
      const l = new THREE.PointLight(0xff8a3a, 24, 26, 1.3);
      l.position.set((k - 1) * W * 0.36, 4, 5);
      decor.add(l);
      candleLights.push(l);
    }

    const roseR = Math.min(5.2, W * 0.12);
    rose.scale.setScalar(roseR);
    rose.position.set(0, topY + 5.4 + roseR, 0.1);
    roseLight.position.set(0, rose.position.y, 6);

    layoutInfo = { cols, rows, W, H, topY, roseTop: rose.position.y + roseR };
  }

  // frame the whole wall, tapestries and rose, with a margin
  function fitCamera(vw, vh) {
    const aspect = vw / vh;
    layout(aspect);
    const { W, rows } = layoutInfo;
    const bottom = 0.6, top = gridTop(rows) + 0.4;
    const midY = (bottom + top) / 2;
    const vfov = THREE.MathUtils.degToRad(camera.fov);
    const needH = (top - bottom) / 2 / Math.tan(vfov / 2);
    const needW = (W / 2 + 2) / (Math.tan(vfov / 2) * aspect);
    const d = Math.max(needH, needW) * 1.02;
    CAM.set(0, midY, d + 1);
  }
  const CAM = new THREE.Vector3();

  // ---------------------------------------------------------------- the player

  const hoverPanel = document.getElementById('hover-title');
  const player = document.getElementById('player');
  const playerSlot = player.querySelector('.player-slot');
  const playerTitle = player.querySelector('.player-title');
  const playerOut = player.querySelector('.player-out');
  const listPanel = document.getElementById('frame-list');
  let playing = -1;      // the tapestry that's out (or on its way out)

  function setHover(text) { hoverPanel.textContent = text || 'Hover a frame'; }

  // the chosen tapestry comes off the wall and hangs in front of you; the
  // player sits exactly over its picture
  function play(i) {
    if (playing === i) return;
    if (playing >= 0) stop(true);
    const v = tapestries[i];
    playing = i;
    v.opening = true;
    playerSlot.replaceChildren();
    const iframe = document.createElement('iframe');
    iframe.src = `https://www.youtube.com/embed/${v.id}?autoplay=1`;
    iframe.title = v.title;
    iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
    iframe.allowFullscreen = true;
    playerSlot.appendChild(iframe);
    playerTitle.textContent = v.title;
    playerOut.href = `https://www.youtube.com/watch?v=${v.id}`;
    listPanel.hidden = true;
    setHover('');
    hoverPanel.hidden = true;
    P.hum.blip(220 + i * 11, 0.5);
    gust(v.x, 0.8);
  }
  function stop(quick) {
    if (playing < 0) return;
    const v = tapestries[playing];
    v.opening = false;
    playing = -1;
    playerSlot.replaceChildren();
    player.hidden = true;
    hoverPanel.hidden = false;
    setHover('');
    if (!quick) P.hum.blip(160, 0.4);
  }
  player.querySelector('.player-close').addEventListener('click', () => stop());
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape') { stop(); listPanel.hidden = true; } });

  const _q = new THREE.Quaternion(), _fwd = new THREE.Vector3(), _up = new THREE.Vector3(), _off = new THREE.Vector3();
  const FIELD_CY = -TH / 2 - 0.1 + ((FIELD.y0 + FIELD.y1) / 2 - 0.5) * TH;
  const FIELD_W = (FIELD.x1 - FIELD.x0) * TW, FIELD_H = (FIELD.y1 - FIELD.y0) * TH;
  const homeQ = new THREE.Quaternion();

  function openPose(outPos, outQ) {
    // a distance where the picture fills most of the view, leaving room
    // under it for the title and the close link
    const vTan = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
    const hTan = vTan * camera.aspect;
    const D = Math.max(FIELD_W / (2 * 0.52 * hTan), FIELD_H / (2 * 0.5 * vTan));
    camera.getWorldDirection(_fwd);
    _up.set(0, 1, 0).applyQuaternion(camera.quaternion);
    outQ.copy(camera.quaternion);
    _off.set(0, FIELD_CY, 0).applyQuaternion(outQ);
    outPos.copy(camera.position).addScaledVector(_fwd, D).addScaledVector(_up, D * vTan * 0.06).sub(_off);
  }

  const corners = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  function placePlayer(v) {
    v.cloth.updateMatrixWorld();
    const xs = [-FIELD_W / 2, FIELD_W / 2];
    const ys = [FIELD.y0 - 0.5, FIELD.y1 - 0.5].map((f) => f * TH);
    let k = 0, minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
    for (const x of xs) for (const y of ys) {
      const c = corners[k++].set(x, y, 0).applyMatrix4(v.cloth.matrixWorld).project(camera);
      const sx = (c.x * 0.5 + 0.5) * innerWidth, sy = (-c.y * 0.5 + 0.5) * innerHeight;
      minX = Math.min(minX, sx); maxX = Math.max(maxX, sx);
      minY = Math.min(minY, sy); maxY = Math.max(maxY, sy);
    }
    Object.assign(player.style, {
      left: minX.toFixed(1) + 'px', top: minY.toFixed(1) + 'px',
      width: (maxX - minX).toFixed(1) + 'px', height: (maxY - minY).toFixed(1) + 'px',
    });
  }

  const list = listPanel.querySelector('ol');
  VIDEOS.forEach(([id, title], i) => {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = title;
    b.addEventListener('click', () => play(i));
    li.appendChild(b);
    list.appendChild(li);
  });
  document.getElementById('list-toggle').addEventListener('click', () => {
    listPanel.hidden = !listPanel.hidden;
    if (!listPanel.hidden) listPanel.querySelector('button').focus();
  });

  // ---------------------------------------------------------------- wind

  const gusts = [];
  function gust(fromX, strength = 1) {
    const dir = fromX === undefined ? (Math.random() < 0.5 ? -1 : 1) : 0;
    const W = layoutInfo ? layoutInfo.W : 60;
    gusts.push({
      x: fromX === undefined ? -dir * (W / 2 + 14) : fromX,
      v: fromX === undefined ? dir * (W / 2.6) : 0,
      spread: fromX === undefined ? 9 : 3,
      grow: fromX === undefined ? 0 : 12,
      s: strength, t: 0,
    });
  }
  let nextGust = 4;

  // ---------------------------------------------------------------- plate + input

  const fx = { flash: 0 };
  const plate = P.create({
    scene, camera, fov: [50, 66], clean: true,
    onResize(vw, vh) { fitCamera(vw, vh); },
    omens: {
      texts: ['moving images', 'hover a frame', 'return to the core', 'quiet remains', 'once again'],
      extras: [
        () => gust(undefined, 1.8),
        () => { fx.flash = 1; },
      ],
    },
  });
  if (!plate) return;

  const pick = P.picker(camera, cloths);
  const look = P.follow(plate, {
    yaw: 0.07, pitch: 0.045, rate: 1.1,
    onTap(pointer) {
      if (playing >= 0) { stop(); return; }
      const hit = pick(pointer);
      if (hit) play(hit.userData.index);
    },
  });

  const _pos = new THREE.Vector3();
  let hover = -1;
  plate.run((dt, t) => {
    look.update(dt, t);
    const anyOpen = tapestries.reduce((m, tp) => Math.max(m, tp.open), 0);
    const calm = 1 - anyOpen;
    camera.position.set(CAM.x + look.x * 2.2 * calm, CAM.y + look.y * 1.0 * calm, CAM.z);
    P.aim(camera, look.yaw * calm, look.pitch * calm);

    const hit = playing < 0 && look.hovering() ? pick(look.pointer) : null;
    const hov = hit ? hit.userData.index : -1;
    if (hov !== hover) {
      hover = hov;
      plate.canvas.classList.toggle('over-thing', hov >= 0);
      if (playing < 0) setHover(hov >= 0 ? tapestries[hov].title : '');
      P.hum.tone(hov >= 0 ? 110 + hov * 6 : 0);
      if (hov >= 0) gust(tapestries[hov].x, 0.35);
    }

    // wind
    if (t > nextGust) { gust(undefined, 0.6 + Math.random() * 0.8); nextGust = t + 6 + Math.random() * 9; }
    for (let g = gusts.length - 1; g >= 0; g--) {
      const G = gusts[g];
      G.t += dt;
      G.x += G.v * dt;
      G.spread += G.grow * dt;
      if (G.t > 4.5) gusts.splice(g, 1);
    }
    tapestries.forEach((tp) => {
      let gv = 0;
      for (const G of gusts) {
        const d = (tp.x - G.x) / G.spread;
        const life = Math.sin(Math.min(1, G.t / 4.5) * Math.PI);
        gv += Math.exp(-d * d) * G.s * life;
      }
      const target = tp.opening ? 0 : Math.min(1.6, gv);
      tp.gust = P.damp(tp.gust || 0, target, target > (tp.gust || 0) ? 5 : 1.4, dt);
      tp.hover = P.damp(tp.hover, hover === tp.i || playing === tp.i ? 1 : 0, 6, dt);
      const u = tp.mat.uniforms;
      u.uTime.value = t;
      u.uGust.value = tp.gust;
      u.uHover.value = tp.hover;

      // flying out and back
      tp.open = P.damp(tp.open, tp.opening ? 1 : 0, tp.opening ? 2.4 : 3.2, dt);
      if (tp.open < 0.002 && !tp.opening) tp.open = 0;
      u.uStill.value = tp.open;
      u.uDim.value = playing >= 0 && playing !== tp.i ? anyOpen : 0;
      if (tp.open > 0) {
        openPose(_pos, _q);
        const e = tp.open * tp.open * (3 - 2 * tp.open);
        tp.group.position.lerpVectors(tp.home, _pos, e);
        tp.group.position.z += Math.sin(e * Math.PI) * 3;      // a little arc out from the wall
        tp.group.quaternion.slerpQuaternions(homeQ, _q, e);
        tp.group.renderOrder = 5;
      } else {
        tp.group.position.copy(tp.home);
        tp.group.quaternion.identity();
      }
    });

    // the player appears once the tapestry has arrived
    if (playing >= 0) {
      const v = tapestries[playing];
      if (v.open > 0.97) {
        placePlayer(v);
        if (player.hidden) { player.hidden = false; player.querySelector('.player-close').focus({ preventScroll: true }); }
      }
    }

    fx.flash = Math.max(0, fx.flash - dt * 1.5);
    roseMat.uniforms.uTime.value = t;
    roseMat.uniforms.uFlash.value = fx.flash;
    roseLight.intensity = 26 + 40 * fx.flash;
    candleLights.forEach((l, i) => { l.intensity = 20 + 8 * P.vnoise(t * 5 + i * 3, 2.2); });
    P.animateFlames(scene, t);
  });
})();
