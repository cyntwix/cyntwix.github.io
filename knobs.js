// knobs.js / a brass panel of knobs wired straight into the print shader.
// Drag a knob up or down (shift for fine), scroll on it, or use the arrow keys.
// Double-click a knob to put it back. Settings are remembered in this browser
// and every page uses them. "copy settings" puts the changed values on your
// clipboard so they can be made permanent.

(function () {
  const P = window.PLATE;
  if (!P || !P.TUNE) return;
  // tucked away: add ?knobs to the address to bring the panel back
  if (!new URLSearchParams(location.search).has('knobs')) return;

  const css = `
  .knob-toggle {
    position: fixed; left: 10px; top: 52px; z-index: 22;
    padding: 2px 8px; border: 2px outset #9a762e; background: #321006;
    color: #f4cf68; font: 12px "Courier New", Courier, monospace; cursor: pointer;
  }
  .knob-toggle:hover { background: #421500; color: #fff1a3; }
  .knob-panel {
    position: fixed; left: 10px; top: 80px; z-index: 22;
    width: min(392px, calc(100vw - 20px));
    max-height: calc(100vh - 120px); overflow: auto;
    padding: 10px 10px 8px;
    border: 4px double #9a762e;
    background:
      repeating-linear-gradient(90deg, rgba(255,230,160,0.025) 0 2px, transparent 2px 5px),
      linear-gradient(160deg, #2a1608, #120902 70%);
    box-shadow: 6px 6px 0 rgba(0,0,0,0.6);
    font: 11px "Courier New", Courier, monospace; color: #c9a35a;
    user-select: none;
  }
  .knob-panel[hidden] { display: none; }
  .knob-panel h2 {
    margin: 0 0 8px; font: italic 14px "Times New Roman", Times, serif;
    letter-spacing: 0.3em; color: #e0b643; text-align: center;
  }
  .knob-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px 6px; }
  .knob { display: flex; flex-direction: column; align-items: center; gap: 3px; outline: none; }
  .knob-dial {
    position: relative; width: 50px; height: 50px; border-radius: 50%;
    cursor: ns-resize; touch-action: none;
    background:
      repeating-conic-gradient(from -135deg, rgba(240,200,110,0.55) 0 1.2deg, transparent 1.2deg 27deg) ;
  }
  .knob-dial::before {
    /* the brass cap */
    content: ""; position: absolute; inset: 6px; border-radius: 50%;
    background: radial-gradient(circle at 35% 30%, #f6d98a, #b8862e 45%, #5a3810 85%);
    box-shadow: inset 0 -2px 3px rgba(0,0,0,0.6), 0 2px 0 #000;
  }
  .knob-arc { position: absolute; inset: 0; border-radius: 50%; }
  .knob-pointer {
    position: absolute; left: 50%; top: 50%; width: 3px; height: 21px; margin-left: -1.5px;
    transform-origin: 50% 0; background: #1a0c02; border-radius: 1px;
  }
  .knob:focus-visible .knob-dial { outline: 2px dotted #fff1a3; outline-offset: 2px; }
  .knob.changed .knob-label { color: #fff1a3; }
  .knob-label { color: #c9a35a; text-align: center; line-height: 1.1; }
  .knob-value { color: #8a6a35; font-size: 10px; }
  .knob-actions { display: flex; flex-wrap: wrap; gap: 6px 10px; margin-top: 10px; justify-content: space-between; align-items: baseline; }
  .knob-actions button {
    padding: 1px 7px; border: 2px outset #9a762e; background: #321006;
    color: #f4cf68; font: 11px "Courier New", Courier, monospace; cursor: pointer;
  }
  .knob-actions button:hover { background: #421500; color: #fff1a3; }
  .knob-hint { min-height: 2.4em; margin-top: 6px; color: #b9a774; font-size: 11px; }
  .knob-out {
    width: 100%; box-sizing: border-box; margin-top: 6px; height: 60px;
    background: #0c0701; color: #e4d5aa; border: 2px inset #6a4a1c;
    font: 10px "Courier New", Courier, monospace; resize: vertical;
  }
  .knob-out[hidden] { display: none; }
  `;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'knob-toggle';
  toggle.textContent = 'knobs';
  toggle.setAttribute('aria-expanded', 'false');

  const panel = document.createElement('section');
  panel.className = 'knob-panel';
  panel.hidden = true;
  panel.setAttribute('aria-label', 'Print effect knobs');
  panel.innerHTML = `
    <h2>the press</h2>
    <div class="knob-grid"></div>
    <p class="knob-hint">drag a knob up or down. shift for fine. double-click resets it.</p>
    <div class="knob-actions">
      <button type="button" data-act="copy">copy settings</button>
      <button type="button" data-act="reset">reset all</button>
      <button type="button" data-act="hide">hide (k)</button>
    </div>
    <textarea class="knob-out" hidden readonly aria-label="Settings"></textarea>`;
  document.body.append(toggle, panel);

  const grid = panel.querySelector('.knob-grid');
  const hint = panel.querySelector('.knob-hint');
  const out = panel.querySelector('.knob-out');
  const SWEEP = 270;

  const fmt = (d, v) => {
    const places = d.step >= 1 ? 0 : d.step >= 0.1 ? 1 : d.step >= 0.01 ? 2 : 3;
    return v.toFixed(places);
  };

  const knobs = P.TUNE.map((d) => {
    const el = document.createElement('div');
    el.className = 'knob';
    el.tabIndex = 0;
    el.setAttribute('role', 'slider');
    el.setAttribute('aria-label', d.label);
    el.setAttribute('aria-valuemin', d.min);
    el.setAttribute('aria-valuemax', d.max);
    el.innerHTML = `
      <div class="knob-dial"><div class="knob-arc"></div><div class="knob-pointer"></div></div>
      <div class="knob-label">${d.label}</div>
      <div class="knob-value"></div>`;
    grid.appendChild(el);
    const dial = el.querySelector('.knob-dial');
    const arc = el.querySelector('.knob-arc');
    const pointer = el.querySelector('.knob-pointer');
    const val = el.querySelector('.knob-value');

    function draw() {
      const v = P.tune[d.key];
      const k = (v - d.min) / (d.max - d.min);
      const ang = -SWEEP / 2 + k * SWEEP;
      pointer.style.transform = `rotate(${ang + 180}deg)`;
      // a lit arc from the shipped value to the current one
      const k0 = (d.def - d.min) / (d.max - d.min);
      const a0 = -SWEEP / 2 + Math.min(k, k0) * SWEEP, a1 = -SWEEP / 2 + Math.max(k, k0) * SWEEP;
      arc.style.background = `conic-gradient(from ${a0}deg, rgba(255,120,40,0.75) 0 ${Math.max(0.01, a1 - a0)}deg, transparent 0)`;
      arc.style.webkitMask = arc.style.mask = 'radial-gradient(circle, transparent 21px, #000 22px, #000 25px, transparent 25.5px)';
      val.textContent = fmt(d, v);
      el.setAttribute('aria-valuenow', v);
      el.classList.toggle('changed', Math.abs(v - d.def) > d.step / 2);
    }
    function set(v) {
      v = Math.min(d.max, Math.max(d.min, Math.round(v / d.step) * d.step));
      if (v === P.tune[d.key]) return;
      P.setTune(d.key, v);
      draw();
    }
    const range = d.max - d.min;

    let dragging = false, lastY = 0;
    dial.addEventListener('pointerdown', (e) => {
      dragging = true; lastY = e.clientY;
      dial.setPointerCapture(e.pointerId);
      P.dragging = true;
      e.preventDefault();
    });
    dial.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const dy = lastY - e.clientY;
      lastY = e.clientY;
      set(P.tune[d.key] + dy * range / (e.shiftKey ? 900 : 180));
    });
    const end = () => { dragging = false; P.dragging = false; };
    dial.addEventListener('pointerup', end);
    dial.addEventListener('pointercancel', end);
    dial.addEventListener('wheel', (e) => {
      e.preventDefault();
      set(P.tune[d.key] - Math.sign(e.deltaY) * range / (e.shiftKey ? 200 : 50));
    }, { passive: false });
    dial.addEventListener('dblclick', () => set(d.def));
    el.addEventListener('keydown', (e) => {
      const stepK = range / (e.shiftKey ? 200 : 40);
      if (e.key === 'ArrowUp' || e.key === 'ArrowRight') set(P.tune[d.key] + stepK);
      else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') set(P.tune[d.key] - stepK);
      else if (e.key === 'Home') set(d.min);
      else if (e.key === 'End') set(d.max);
      else if (e.key === 'Backspace' || e.key === 'Delete') set(d.def);
      else return;
      e.preventDefault();
      e.stopPropagation();
    });
    const showHint = () => { hint.textContent = `${d.label}: ${d.hint}. shipped at ${fmt(d, d.def)}.`; };
    el.addEventListener('pointerenter', showHint);
    el.addEventListener('focus', showHint);
    draw();
    return { d, draw, set };
  });

  function show(on) {
    panel.hidden = !on;
    toggle.setAttribute('aria-expanded', String(on));
    toggle.textContent = on ? 'knobs' : 'knobs';
    try { sessionStorage.setItem('plateKnobsOpen', on ? '1' : '0'); } catch { /* fine */ }
  }
  toggle.addEventListener('click', () => show(panel.hidden));
  window.addEventListener('keydown', (e) => {
    if (e.target.closest && e.target.closest('input, textarea, select')) return;
    if (e.key === 'k' || e.key === 'K') show(panel.hidden);
  });
  try { if (sessionStorage.getItem('plateKnobsOpen') === '1') show(true); } catch { /* fine */ }

  panel.querySelector('[data-act="hide"]').addEventListener('click', () => show(false));
  panel.querySelector('[data-act="reset"]').addEventListener('click', () => {
    knobs.forEach((k) => k.set(k.d.def));
    out.hidden = true;
  });
  panel.querySelector('[data-act="copy"]').addEventListener('click', async () => {
    const changed = {};
    P.TUNE.forEach((d) => { if (Math.abs(P.tune[d.key] - d.def) > d.step / 2) changed[d.key] = +fmt(d, P.tune[d.key]); });
    const text = Object.keys(changed).length ? 'press settings: ' + JSON.stringify(changed) : 'press settings: all at the shipped values';
    out.value = text;
    out.hidden = false;
    let ok = false;
    try { await navigator.clipboard.writeText(text); ok = true; } catch {
      out.select();
      try { ok = document.execCommand('copy'); } catch { ok = false; }
    }
    hint.textContent = ok ? 'copied. paste it to me and I’ll bake it in.' : 'couldn’t reach the clipboard; copy it from the box below.';
  });
})();
