// contact / a night plain strung with telegraph wire. Every line runs in to
// one mast, and at its foot is the grave that says E-MAIL. Signals crawl in
// along the wires. Send a transmission and it all runs the other way, up the
// mast and out into the sky, and then your mail client opens.

(function () {
  const THREE = window.THREE;
  const P = window.PLATE;
  const rand = P.mulberry32(1847);

  // same obfuscated address as the old contact page
  const ADDRESS = [97, 100, 97, 109, 115, 105, 105, 115, 109, 101, 116, 115, 64, 103, 109, 97, 105, 108, 46, 99, 111, 109]
    .map((code) => String.fromCharCode(code)).join('');

  const scene = new THREE.Scene();
  const NIGHT = new THREE.Color(0.07, 0.06, 0.12);
  scene.fog = new THREE.FogExp2(NIGHT, 0.0075);

  const camera = new THREE.PerspectiveCamera(52, 1, 0.5, 900);
  const MAST = new THREE.Vector3(0, 0, -30);
  const MAST_H = 38;

  function ground(x, z) {
    const r = Math.hypot(x - MAST.x, z - MAST.z);
    return (P.fbm(x * 0.012 + 2, z * 0.012) - 0.5) * 14 * P.smooth(40, 220, r) + (P.vnoise(x * 0.3, z * 0.3) - 0.5) * 0.3;
  }

  // ---------------------------------------------------------------- sky

  const skyMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uFlash: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position.z = gl_Position.w;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime, uFlash;
      varying vec3 vDir;
      ${P.GLSL_NOISE}
      void main() {
        vec3 d = normalize(vDir);
        float h = d.y;
        float az = atan(d.x, -d.z);
        vec3 col = mix(vec3(0.3, 0.14, 0.16), vec3(0.08, 0.07, 0.16), smoothstep(0.0, 0.22, h));
        col = mix(col, vec3(0.015, 0.02, 0.05), smoothstep(0.2, 0.8, h));
        // slow curtains of something, high up
        float cur = fbm(vec2(az * 4.0 + uTime * 0.02, h * 3.0 - uTime * 0.03));
        float band = smoothstep(0.55, 0.8, cur) * smoothstep(0.1, 0.4, h) * smoothstep(0.85, 0.45, h);
        col += vec3(0.25, 0.42, 0.32) * band * 0.6;
        vec2 sg = vec2(az * 80.0, h * 80.0);
        float star = step(0.987, hash(floor(sg))) * smoothstep(0.1, 0.4, h);
        col += vec3(0.9, 0.86, 0.72) * star * step(length(fract(sg) - 0.5), 0.22);
        col += uFlash * vec3(0.9, 0.95, 1.0) * (0.35 + 0.65 * band + 0.4 * smoothstep(0.4, 0.0, abs(az)));
        gl_FragColor = vec4(col, 1.0);
      }`,
    side: THREE.BackSide, depthWrite: false, fog: false,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(800, 40, 24), skyMat);
  sky.renderOrder = -10;
  scene.add(sky);

  // ---------------------------------------------------------------- light + ground

  const moon = new THREE.DirectionalLight(0xb8c4ff, 2.2);
  moon.position.set(-60, 80, 60);
  moon.castShadow = true;
  moon.shadow.mapSize.set(2048, 2048);
  Object.assign(moon.shadow.camera, { left: -90, right: 90, top: 80, bottom: -60, near: 1, far: 300 });
  moon.target.position.copy(MAST);
  scene.add(moon, moon.target);
  scene.add(new THREE.HemisphereLight(0x44508a, 0x24120a, 1.6));
  const mastLight = new THREE.PointLight(0x9ad0ff, 20, 60, 1.2);
  mastLight.position.copy(MAST).setY(MAST_H);
  scene.add(mastLight);
  const graveLight = new THREE.PointLight(0xff8a40, 18, 20, 1.4);
  graveLight.position.copy(MAST).add(new THREE.Vector3(0, 4, 26));
  scene.add(graveLight);

  {
    const geo = new THREE.PlaneGeometry(900, 900, 160, 160);
    geo.rotateX(-Math.PI / 2);
    const p = geo.attributes.position;
    const cols = new Float32Array(p.count * 3);
    const a = new THREE.Color(0x3e3428), b = new THREE.Color(0x231a14), c = new THREE.Color(0x5a5244), out = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i);
      p.setY(i, ground(x, z));
      out.copy(a).lerp(b, P.vnoise(x * 0.04, z * 0.04)).lerp(c, P.smooth(0.6, 0.8, P.fbm(x * 0.05, z * 0.05)) * 0.7);
      out.toArray(cols, i * 3);
    }
    geo.computeVertexNormals();
    geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
    mesh.receiveShadow = true;
    scene.add(mesh);
  }

  const wood = new THREE.MeshLambertMaterial({ color: 0x6a5240, flatShading: true });
  const iron = new THREE.MeshLambertMaterial({ color: 0x5c5650, flatShading: true });

  // ---------------------------------------------------------------- the mast

  {
    const legs = 4, base = 7, top = 1.2;
    const mast = new THREE.Group();
    mast.position.copy(MAST);
    const ptAt = (leg, y) => {
      const r = base + (top - base) * (y / MAST_H);
      const a = (leg / legs) * Math.PI * 2 + Math.PI / 4;
      return new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r);
    };
    function strut(a, b, w = 0.35) {
      const len = a.distanceTo(b);
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, len, w), iron);
      m.position.copy(a).add(b).multiplyScalar(0.5);
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
      m.castShadow = true;
      mast.add(m);
    }
    const levels = 9;
    for (let k = 0; k < levels; k++) {
      const y0 = (k / levels) * MAST_H, y1 = ((k + 1) / levels) * MAST_H;
      for (let l = 0; l < legs; l++) {
        strut(ptAt(l, y0), ptAt(l, y1), 0.55);
        strut(ptAt(l, y1), ptAt((l + 1) % legs, y1), 0.25);
        // cross bracing
        strut(ptAt(l, y0), ptAt((l + 1) % legs, y1), 0.18);
        strut(ptAt((l + 1) % legs, y0), ptAt(l, y1), 0.18);
      }
    }
    // the crown: insulators like teeth
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * Math.PI * 2;
      const ins = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.32, 1.2, 5), new THREE.MeshLambertMaterial({ color: 0xc8d8c0 }));
      ins.position.set(Math.cos(a) * 2.2, MAST_H + 0.6, Math.sin(a) * 2.2);
      mast.add(ins);
    }
    const spire = new THREE.Mesh(new THREE.ConeGeometry(0.5, 7, 5), iron);
    spire.position.y = MAST_H + 3.5;
    mast.add(spire);
    scene.add(mast);
  }

  // ---------------------------------------------------------------- poles and wire

  // lines of poles march in from the dark, every one ending at the mast
  const wires = [];       // polylines, ordered from far end to the mast
  const LINES = [-2.5, -1.75, -0.95, -0.35, 0.35, 0.95, 1.75, 2.5];
  const crossW = 1.6;
  LINES.forEach((ang, li) => {
    const dir = new THREE.Vector3(Math.sin(ang), 0, Math.cos(ang));   // pointing away from the mast
    const poles = [];
    const count = 11;
    for (let k = 1; k <= count; k++) {
      const d = 10 + k * 13 + (rand() - 0.5) * 3;
      const bend = Math.sin(k * 0.5 + li) * 3;
      const p = MAST.clone().addScaledVector(dir, d);
      p.x += dir.z * bend; p.z -= dir.x * bend;
      p.y = ground(p.x, p.z);
      const hgt = 8 + rand() * 1.5;
      const lean = (rand() - 0.5) * 0.08;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.26, hgt, 5), wood);
      pole.position.set(p.x, p.y + hgt / 2, p.z);
      pole.rotation.z = lean;
      pole.castShadow = true;
      scene.add(pole);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(crossW * 2 + 0.4, 0.18, 0.18), wood);
      arm.position.set(p.x, p.y + hgt - 0.6, p.z);
      arm.rotation.y = Math.atan2(dir.x, dir.z) + Math.PI / 2;
      arm.castShadow = true;
      scene.add(arm);
      poles.push({ p, top: p.y + hgt - 0.5, side: new THREE.Vector3(dir.z, 0, -dir.x) });
    }
    // two wires per line, each sagging between poles, last span up to the mast
    for (const s of [-1, 1]) {
      const pts = [];
      for (let k = poles.length - 1; k >= 0; k--) {
        const a = poles[k];
        const A = a.p.clone().addScaledVector(a.side, s * crossW).setY(a.top);
        const B = k > 0
          ? poles[k - 1].p.clone().addScaledVector(poles[k - 1].side, s * crossW).setY(poles[k - 1].top)
          : MAST.clone().add(new THREE.Vector3(Math.sin(ang) * 1.6 + s * 0.6, MAST_H * (0.55 + 0.12 * (li % 3)), Math.cos(ang) * 1.6));
        const sag = k > 0 ? 1.1 : 2.0;
        for (let j = 0; j < 12; j++) {
          const u = j / 12;
          const q = A.clone().lerp(B, u);
          q.y -= Math.sin(u * Math.PI) * sag;
          pts.push(q);
        }
        if (k === 0) pts.push(B.clone());
      }
      wires.push(pts);
      const g = new THREE.BufferGeometry().setFromPoints(pts);
      scene.add(new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0x1a1410 })));
    }
  });

  // signals along the wire
  const lengths = wires.map((pts) => {
    const acc = [0];
    for (let i = 1; i < pts.length; i++) acc.push(acc[i - 1] + pts[i].distanceTo(pts[i - 1]));
    return acc;
  });
  function along(w, s) {
    const pts = wires[w], acc = lengths[w];
    const total = acc[acc.length - 1];
    const d = Math.min(Math.max(s, 0), 1) * total;
    let i = 1;
    while (i < acc.length - 1 && acc[i] < d) i++;
    const u = (d - acc[i - 1]) / Math.max(1e-6, acc[i] - acc[i - 1]);
    return pts[i - 1].clone().lerp(pts[i], u);
  }
  const PULSES = 90;
  const pulses = [];
  for (let i = 0; i < PULSES; i++) pulses.push({ w: i % wires.length, s: rand(), v: 0.03 + rand() * 0.05 });
  const pulsePos = new Float32Array(PULSES * 3);
  const pulseGeo = new THREE.BufferGeometry();
  pulseGeo.setAttribute('position', new THREE.BufferAttribute(pulsePos, 3));
  const pulseMat = new THREE.PointsMaterial({ color: 0xfff0b0, size: 2, sizeAttenuation: false, fog: false });
  const pulsePts = new THREE.Points(pulseGeo, pulseMat);
  pulsePts.frustumCulled = false;
  scene.add(pulsePts);

  // a column of light when the message goes up
  const beamMat = new THREE.MeshBasicMaterial({ color: 0xe8f4ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 2.4, 400, 8, 1, true), beamMat);
  beam.position.copy(MAST).setY(MAST_H + 200);
  scene.add(beam);

  // ---------------------------------------------------------------- the grave, and what watches

  const graveTex = P.sheet('grave_sheet.png', 4, 3);
  const grave = new THREE.Mesh(new THREE.PlaneGeometry(13, 9.6), new THREE.MeshBasicMaterial({ map: graveTex, color: 0x9a8e7c, alphaTest: 0.5 }));
  grave.position.copy(MAST).add(new THREE.Vector3(0, 4.2, 22));
  grave.position.y += ground(grave.position.x, grave.position.z);
  scene.add(grave);
  // the gif has a black background; a slab of dark earth behind it so it sits in the ground
  const mound = new THREE.Mesh(new THREE.BoxGeometry(11, 0.8, 4), new THREE.MeshLambertMaterial({ color: 0x2a1e16, flatShading: true }));
  mound.position.copy(grave.position).add(new THREE.Vector3(0, -4.4, -1));
  mound.receiveShadow = true;
  scene.add(mound);

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
        // the eye shifts its gaze inside the lids
        vec2 uv = clamp(vUv - uLook * vec2(0.08, 0.05), 0.0, 1.0);
        float c = mod(uFrame, 3.0), r = floor(uFrame / 3.0);
        vec4 t = texture2D(map, vec2((c + uv.x) / 3.0, 1.0 - (r + 1.0 - uv.y) / 2.0));
        if (t.a < 0.5) discard;
        float l = dot(t.rgb, vec3(0.3, 0.59, 0.11));
        gl_FragColor = vec4(mix(vec3(0.02, 0.03, 0.08), vec3(0.75, 0.85, 1.0), smoothstep(0.08, 0.9, l)), 1.0);
      }`,
    depthWrite: false, fog: false,
  });
  const eye = new THREE.Mesh(new THREE.PlaneGeometry(60, 60 * (111 / 255)), eyeMat);
  eye.position.copy(MAST).add(new THREE.Vector3(0, MAST_H + 34, -60));
  eye.renderOrder = -5;
  scene.add(eye);

  // ---------------------------------------------------------------- plate + input

  const fx = { flash: 0, blinkT: -1, send: -1 };
  const plate = P.create({
    scene, camera, fov: [52, 70],
    omens: {
      extras: [(t) => { fx.blinkT = t; }, () => { fx.flash = 1; }],
    },
  });
  if (!plate) return;

  const portrait = innerWidth < innerHeight;
  const CAM = portrait ? new THREE.Vector3(0, 9, 52) : new THREE.Vector3(0, 7, 34);
  const LOOK = new THREE.Vector3(0, 19, MAST.z);
  const pickGrave = P.picker(camera, [grave]);
  const look = P.follow(plate, {
    rate: 1.0,
    onTap(pointer) { if (pickGrave(pointer)) transmit(); },
  });

  const link = document.getElementById('transmissionLink');
  link.addEventListener('click', (e) => { e.preventDefault(); transmit(); });

  function transmit() {
    if (fx.send >= 0) return;
    fx.send = 0;
    link.classList.add('sending');
    link.textContent = 'TRANSMITTING...';
    P.hum.swell();
    P.hum.blip(880, 1.2, 0.08);
  }

  const capAnchor = grave.position.clone().add(new THREE.Vector3(0, -4.9, 0));
  let hoverGrave = false;

  plate.run((dt, t) => {
    look.update(dt, t);
    camera.position.set(CAM.x + look.x * 4, CAM.y + look.y * 1.5, CAM.z);
    camera.lookAt(LOOK.x + look.x * 2, LOOK.y + look.y * 2.5, LOOK.z);

    const hg = look.hovering() && !!pickGrave(look.pointer);
    if (hg !== hoverGrave) {
      hoverGrave = hg;
      plate.canvas.classList.toggle('over-thing', hg);
    }

    // sending: signals reverse and run for the mast, then up and out
    let reverse = 0;
    if (fx.send >= 0) {
      fx.send += dt;
      reverse = Math.min(1, fx.send / 0.4);
      const k = fx.send;
      beamMat.opacity = P.smooth(0.9, 1.3, k) * (1 - P.smooth(2.2, 3.2, k)) * 0.9;
      if (k > 1.0 && k < 1.1) fx.flash = 1.2;
      if (k > 1.6 && !fx.opened) {
        fx.opened = true;
        window.location.href = `mailto:${ADDRESS}`;
      }
      if (k > 3.4) {
        fx.send = -1; fx.opened = false;
        link.classList.remove('sending');
        link.textContent = 'SEND A TRANSMISSION';
      }
    }

    pulses.forEach((p, i) => {
      const speed = reverse ? 0.9 : p.v;
      p.s += speed * dt;
      if (p.s > 1) { p.s = reverse ? 1 : 0; }
      const pos = along(p.w, p.s);
      pulsePos[i * 3] = pos.x; pulsePos[i * 3 + 1] = pos.y; pulsePos[i * 3 + 2] = pos.z;
    });
    pulseGeo.attributes.position.needsUpdate = true;
    pulseMat.size = reverse ? 3 : 2;

    mastLight.intensity = 16 + 6 * Math.sin(t * 3) + beamMat.opacity * 120 + (hoverGrave ? 10 : 0);
    graveLight.intensity = 14 + 6 * P.vnoise(t * 4, 1) + (hoverGrave ? 26 : 0);

    // the eye watches the cursor, and blinks now and then
    eyeMat.uniforms.uLook.value.set(look.x, look.y);
    eyeMat.uniforms.uFrame.value = Math.floor(t * 7) % 6;
    if (fx.blinkT < 0 && Math.random() < dt * 0.08) fx.blinkT = t;
    if (fx.blinkT >= 0) {
      const b = (t - fx.blinkT) / 0.42;
      eyeMat.uniforms.uBlink.value = b >= 1 ? 0 : Math.sin(b * Math.PI);
      if (b >= 1) fx.blinkT = -1;
    }
    eye.lookAt(camera.position);

    const cyc = Math.floor(t * 5) % 12;
    P.frame(graveTex, cyc);

    fx.flash = Math.max(0, fx.flash - dt * 2.2);
    skyMat.uniforms.uFlash.value = fx.flash;
    skyMat.uniforms.uTime.value = t;
    sky.position.copy(camera.position);

  });
})();
