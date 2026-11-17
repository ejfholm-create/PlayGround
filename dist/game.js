(() => {
  'use strict';
  const canvas = document.querySelector('#game');
  const ctx = canvas.getContext('2d');
  const mini = document.querySelector('#minimap');
  const mctx = mini.getContext('2d');
  const W = 1000, H = 640, TILE = 40, COLS = 25, ROWS = 16;
  const keys = new Set();
  const state = { started: false, ended: false, won: false, last: 0, time: 0, health: 3, collected: 0, toastTimer: 0, damageLock: 0, dashLock: 0, dashTime: 0 };
  const player = { x: 110, y: 318, r: 12, dx: 1, dy: 0, speed: 176, lantern: 0 };
  const gate = { x: 916, y: 318 };
  const embers = [
    { x: 270, y: 164, got: false, phase: 0.4 },
    { x: 518, y: 492, got: false, phase: 2.3 },
    { x: 754, y: 190, got: false, phase: 4.1 },
  ];
  const shades = [
    { x: 420, y: 264, homeX: 420, homeY: 264, phase: 0.2, speed: 28 },
    { x: 665, y: 372, homeX: 665, homeY: 372, phase: 2.1, speed: 24 },
    { x: 820, y: 480, homeX: 820, homeY: 480, phase: 3.8, speed: 30 },
  ];
  const trees = [], stones = [], ferns = [], fireflies = [];
  let seed = 12091;
  const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  for (let i = 0; i < 87; i++) {
    const x = 35 + rand() * (W - 70), y = 30 + rand() * (H - 60);
    if (Math.abs(x - player.x) < 70 && Math.abs(y - player.y) < 70) continue;
    if (Math.abs(x - gate.x) < 60 && Math.abs(y - gate.y) < 65) continue;
    const nearPath = (y > 286 && y < 359) || (x > 215 && x < 820 && y > 235 && y < 274) || (x > 205 && x < 300 && y > 165 && y < 325) || (x > 470 && x < 560 && y > 300 && y < 510) || (x > 710 && x < 790 && y > 185 && y < 330);
    if (nearPath && rand() < .78) continue;
    if (rand() > .31) trees.push({ x, y, size: 12 + rand() * 14, hue: rand() });
    else ferns.push({ x, y, size: 5 + rand() * 9, hue: rand() });
  }
  for (let i = 0; i < 38; i++) stones.push({ x: rand() * W, y: rand() * H, r: 2 + rand() * 4 });
  for (let i = 0; i < 30; i++) fireflies.push({ x: rand() * W, y: rand() * H, phase: rand() * 7, size: 1 + rand() * 2 });

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
  }
  window.addEventListener('resize', resize);
  resize();

  function roundRect(c, x, y, w, h, r) {
    c.beginPath(); c.roundRect(x, y, w, h, r);
  }
  function drawWorld(t) {
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#283d30'); g.addColorStop(.48, '#24382e'); g.addColorStop(1, '#1b3029');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // Patches of old moss and moonlit grass.
    for (let i = 0; i < 22; i++) {
      const x = (i * 191 + 49) % W, y = (i * 137 + 58) % H;
      ctx.fillStyle = i % 2 ? '#30473322' : '#82906a0a';
      ctx.beginPath(); ctx.ellipse(x, y, 35 + (i % 5) * 12, 14 + (i % 4) * 7, i * .31, 0, Math.PI * 2); ctx.fill();
    }
    // Winding, pale trail through the fen.
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(20, 320); ctx.bezierCurveTo(180, 328, 200, 320, 250, 309); ctx.bezierCurveTo(342, 287, 326, 239, 397, 238); ctx.bezierCurveTo(483, 235, 479, 314, 506, 366); ctx.bezierCurveTo(535, 429, 542, 454, 580, 446); ctx.bezierCurveTo(661, 431, 619, 353, 675, 306); ctx.bezierCurveTo(733, 258, 771, 290, 816, 319); ctx.bezierCurveTo(863, 350, 876, 321, 980, 320);
    ctx.strokeStyle = '#b4a57a17'; ctx.lineWidth = 72; ctx.stroke();
    ctx.strokeStyle = '#c9ba8b10'; ctx.lineWidth = 51; ctx.stroke();
    ctx.strokeStyle = '#b8ad7b17'; ctx.lineWidth = 2; ctx.setLineDash([3, 12]); ctx.stroke(); ctx.setLineDash([]);
    // Dark pools at the forest edge.
    for (let i = 0; i < 8; i++) {
      const x = i * 147 - 16, y = i % 2 ? 586 : 49;
      ctx.fillStyle = '#101d1c55'; ctx.beginPath(); ctx.ellipse(x, y, 45, 13, .12, 0, 7); ctx.fill();
      ctx.strokeStyle = '#8ea39112'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(x - 5, y - 2, 31, 6, .12, 0, 7); ctx.stroke();
    }
    stones.forEach(s => { ctx.fillStyle = '#a4a17e30'; ctx.beginPath(); ctx.ellipse(s.x, s.y, s.r * 1.4, s.r, -.3, 0, 7); ctx.fill(); });
    ferns.forEach(f => {
      ctx.save(); ctx.translate(f.x, f.y); ctx.strokeStyle = f.hue > .5 ? '#78927089' : '#91a07966'; ctx.lineWidth = 1.4;
      for (let j = 0; j < 5; j++) { const a = -1.5 + j * .62; ctx.beginPath(); ctx.moveTo(0, 4); ctx.quadraticCurveTo(Math.cos(a) * f.size * .5, Math.sin(a) * f.size * .4, Math.cos(a) * f.size, Math.sin(a) * f.size); ctx.stroke(); }
      ctx.restore();
    });
    trees.sort((a, b) => a.y - b.y).forEach(tree => drawTree(tree, t));
    drawRuins(); drawGate(t); embers.forEach(e => { if (!e.got) drawEmber(e, t); });
    shades.forEach(s => drawShade(s, t)); drawPlayer(t);
    fireflies.forEach(f => { const a = .16 + .56 * (.5 + .5 * Math.sin(t * 1.4 + f.phase)); ctx.fillStyle = `rgba(218,225,155,${a})`; ctx.beginPath(); ctx.arc(f.x + Math.sin(t + f.phase) * 5, f.y + Math.cos(t * .7 + f.phase) * 4, f.size, 0, 7); ctx.fill(); });
    const vignette = ctx.createRadialGradient(W / 2, H / 2, 115, W / 2, H / 2, 690);
    vignette.addColorStop(0, '#07100c00'); vignette.addColorStop(1, '#09100caa'); ctx.fillStyle = vignette; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = '#b6b7880a'; ctx.lineWidth = 1; ctx.strokeRect(4, 4, W - 8, H - 8);
  }
  function drawTree(a, t) {
    const s = a.size;
    ctx.fillStyle = '#0d1712aa'; ctx.beginPath(); ctx.ellipse(a.x + 5, a.y + s * .56, s * .83, s * .36, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#473b2b'; ctx.fillRect(a.x - 2, a.y - s * .08, 4, s * .75);
    const color = a.hue > .66 ? '#3d5840' : a.hue > .32 ? '#34503b' : '#2c4737';
    ctx.fillStyle = color; ctx.beginPath(); ctx.arc(a.x, a.y - s * .32, s * .79, 0, 7); ctx.fill();
    ctx.fillStyle = '#82906a24'; ctx.beginPath(); ctx.arc(a.x - s * .22, a.y - s * .53, s * .44, 0, 7); ctx.fill();
    ctx.fillStyle = '#b1bb8530'; ctx.beginPath(); ctx.arc(a.x - s * .18, a.y - s * .73, 1.2 + Math.sin(t + a.x) * .5, 0, 7); ctx.fill();
  }
  function drawRuins() {
    ctx.save(); ctx.translate(884, 317);
    ctx.fillStyle = '#19241f'; ctx.fillRect(-42, -39, 84, 78);
    ctx.strokeStyle = '#8a947d'; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(-37, 36); ctx.lineTo(-37, -23); ctx.quadraticCurveTo(0, -69, 37, -23); ctx.lineTo(37, 36); ctx.stroke();
    ctx.strokeStyle = '#5c685a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-28, 29); ctx.lineTo(-28, -19); ctx.quadraticCurveTo(0, -52, 28, -19); ctx.lineTo(28, 29); ctx.stroke();
    ctx.fillStyle = '#28372d'; ctx.fillRect(-39, 30, 78, 13);
    for (let i = -1; i <= 1; i++) { ctx.fillStyle = '#aaa889'; ctx.fillRect(i * 19 - 3, 33, 6, 8); }
    ctx.restore();
    // Broken standing stones on the old path.
    [[352, 224], [466, 277], [605, 420], [705, 268]].forEach(([x, y], i) => {
      ctx.fillStyle = '#111c18aa'; ctx.beginPath(); ctx.ellipse(x + 4, y + 8, 15, 5, 0, 0, 7); ctx.fill();
      ctx.fillStyle = i % 2 ? '#626d5b' : '#707664'; ctx.beginPath(); ctx.moveTo(x - 7, y + 9); ctx.lineTo(x - 5, y - 12); ctx.lineTo(x + 1, y - 17); ctx.lineTo(x + 9, y - 12); ctx.lineTo(x + 8, y + 9); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#bdc09a30'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x - 2, y - 10); ctx.lineTo(x + 3, y - 4); ctx.lineTo(x - 1, y + 2); ctx.stroke();
    });
  }
  function drawGate(t) {
    const open = state.collected === 3, glow = .4 + Math.sin(t * 2.2) * .15;
    ctx.save(); ctx.translate(gate.x, gate.y);
    ctx.shadowColor = open ? '#d9bb78' : '#8ca18d'; ctx.shadowBlur = open ? 28 : 10;
    ctx.strokeStyle = open ? `rgba(239,204,130,${glow + .35})` : '#84908099'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, -6, 21, Math.PI, 0); ctx.lineTo(21, 21); ctx.moveTo(-21, -6); ctx.lineTo(-21, 21); ctx.stroke();
    ctx.shadowBlur = 0; ctx.fillStyle = open ? '#f5cb7624' : '#a9b49c11'; ctx.fillRect(-15, -3, 30, 24);
    ctx.strokeStyle = '#d6c38b77'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-5, 20); ctx.lineTo(-5, -4); ctx.lineTo(0, -12); ctx.lineTo(5, -4); ctx.lineTo(5, 20); ctx.stroke();
    if (open) { ctx.fillStyle = `rgba(255,215,145,${.35 + Math.sin(t * 3) * .2})`; ctx.beginPath(); ctx.arc(0, 6, 10, 0, 7); ctx.fill(); }
    ctx.restore();
    ctx.fillStyle = '#b2b59b'; ctx.font = '9px monospace'; ctx.textAlign = 'center'; ctx.fillText(open ? 'WARD GATE · OPEN' : 'WARD GATE', gate.x, gate.y + 42);
  }
  function drawEmber(e, t) {
    const float = Math.sin(t * 2.4 + e.phase) * 4, y = e.y + float;
    ctx.save(); ctx.translate(e.x, y); ctx.globalCompositeOperation = 'lighter';
    const glow = ctx.createRadialGradient(0, 0, 2, 0, 0, 43); glow.addColorStop(0, '#f3bd6770'); glow.addColorStop(1, '#eab45900'); ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(0, 0, 43, 0, 7); ctx.fill();
    ctx.rotate(t * .55 + e.phase); ctx.strokeStyle = '#f0ce84'; ctx.lineWidth = 1.5; ctx.shadowColor = '#f4bd69'; ctx.shadowBlur = 15;
    ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(8, 0); ctx.lineTo(0, 12); ctx.lineTo(-8, 0); ctx.closePath(); ctx.stroke();
    ctx.fillStyle = '#ffdfa2'; ctx.beginPath(); ctx.arc(0, 0, 3, 0, 7); ctx.fill(); ctx.restore();
  }
  function drawShade(s, t) {
    ctx.save(); ctx.translate(s.x, s.y + Math.sin(t * 3 + s.phase) * 3); ctx.shadowColor = '#b17b8a'; ctx.shadowBlur = 13;
    ctx.fillStyle = '#22252c'; ctx.beginPath(); ctx.ellipse(0, 2, 13, 16, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#59606a'; ctx.beginPath(); ctx.arc(0, -7, 9, Math.PI, 0); ctx.lineTo(8, 10); ctx.quadraticCurveTo(0, 6, -8, 10); ctx.closePath(); ctx.fill();
    ctx.shadowBlur = 0; ctx.fillStyle = '#e5b7a3'; ctx.beginPath(); ctx.ellipse(-3, -7, 1.6, 2.2, 0, 0, 7); ctx.ellipse(3, -7, 1.6, 2.2, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#13191b'; ctx.beginPath(); ctx.ellipse(0, 18, 12, 3, 0, 0, 7); ctx.fill(); ctx.restore();
  }
  function drawPlayer(t) {
    const bob = Math.sin(t * 8) * 1.5;
    const glow = ctx.createRadialGradient(player.x, player.y, 3, player.x, player.y, 116);
    glow.addColorStop(0, '#e6bb6a36'); glow.addColorStop(.3, '#d4a55417'); glow.addColorStop(1, '#d4a55400'); ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(player.x, player.y, 116, 0, 7); ctx.fill();
    ctx.fillStyle = '#10171199'; ctx.beginPath(); ctx.ellipse(player.x, player.y + 12, 12, 5, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#bf9c70'; ctx.beginPath(); ctx.ellipse(player.x, player.y + bob, 8, 11, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#8b7157'; ctx.beginPath(); ctx.arc(player.x, player.y - 7 + bob, 7, Math.PI, 0); ctx.lineTo(player.x + 7, player.y - 2 + bob); ctx.lineTo(player.x - 7, player.y - 2 + bob); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#e8d6a5'; ctx.beginPath(); ctx.arc(player.x + player.dx * 7, player.y + player.dy * 7 - 2 + bob, 2.3, 0, 7); ctx.fill();
    ctx.fillStyle = '#f5c879'; ctx.shadowColor = '#ffc860'; ctx.shadowBlur = 12; ctx.beginPath(); ctx.arc(player.x + player.dx * 13, player.y + player.dy * 13 - 3 + bob, 3, 0, 7); ctx.fill(); ctx.shadowBlur = 0;
  }

  function drawMinimap() {
    const w = mini.width, h = mini.height; mctx.clearRect(0, 0, w, h); mctx.fillStyle = '#1b2a21'; mctx.fillRect(0, 0, w, h);
    mctx.strokeStyle = '#998e6333'; mctx.lineWidth = 7; mctx.beginPath(); mctx.moveTo(6, h * .5); mctx.lineTo(w * .5, h * .5); mctx.lineTo(w * .5, h * .77); mctx.lineTo(w * .68, h * .77); mctx.lineTo(w * .68, h * .5); mctx.lineTo(w - 9, h * .5); mctx.stroke();
    trees.forEach(tree => { mctx.fillStyle = '#52705166'; mctx.fillRect(tree.x / W * w, tree.y / H * h, 2, 2); });
    embers.forEach(e => { if (!e.got) { mctx.fillStyle = '#f1b85f'; mctx.beginPath(); mctx.arc(e.x / W * w, e.y / H * h, 2.7, 0, 7); mctx.fill(); } });
    mctx.fillStyle = '#97b88b'; mctx.fillRect(gate.x / W * w - 2, gate.y / H * h - 2, 5, 5);
    mctx.fillStyle = '#ffdf98'; mctx.shadowColor = '#f4c368'; mctx.shadowBlur = 7; mctx.beginPath(); mctx.arc(player.x / W * w, player.y / H * h, 3.5, 0, 7); mctx.fill(); mctx.shadowBlur = 0;
  }

  const $ = selector => document.querySelector(selector);
  const toast = $('#toast');
  function announce(message) {
    toast.textContent = message;
    toast.classList.remove('hidden');
    state.toastTimer = 2.4;
  }
  function updateHud() {
    $('#sigil-list').querySelectorAll('.sigil-slot').forEach((slot, i) => slot.classList.toggle('collected', i < state.collected));
    $('#health-count').textContent = `${'♥ '.repeat(state.health).trim()}${'♡ '.repeat(3 - state.health).trim() ? ` ${'♡ '.repeat(3 - state.health).trim()}` : ''}`;
    $('#health-fill').style.width = `${state.health / 3 * 100}%`;
    $('#coord').textContent = `X ${String(Math.round(player.x / TILE)).padStart(2, '0')} · Y ${String(Math.round(player.y / TILE)).padStart(2, '0')}`;
    $('#world-status').textContent = state.collected === 3 ? 'THE WARD STIRS' : state.health === 1 ? 'THE FEN GROWS COLD' : 'THE FEN IS QUIET';
  }
  function finish(won) {
    state.ended = true; state.won = won;
    $('#end-spark').textContent = won ? '✦' : '☾';
    $('#end-eyebrow').textContent = won ? 'THE WARD REMEMBERS' : 'LOST TO THE HOLLOW';
    $('#end-title').innerHTML = won ? 'The light<br>holds <em>fast</em>.' : 'The fen<br>falls <em>quiet</em>.';
    $('#end-copy').textContent = won ? 'The Hollow Crown has fallen quiet. Emberfen will see another dawn.' : 'The hollow ones snuffed your lantern. The embers are waiting for you.';
    $('#again-button').innerHTML = 'PLAY AGAIN <span>↻</span>';
    $('#end-overlay').classList.remove('hidden');
    $('#world-status').textContent = won ? 'WARD RESTORED' : 'LANTERN EXTINGUISHED';
  }
  function reset() {
    state.started = true; state.ended = false; state.won = false; state.time = 0;
    state.health = 3; state.collected = 0; state.damageLock = 1; state.dashLock = 0; state.dashTime = 0;
    player.x = 110; player.y = 318; player.dx = 1; player.dy = 0;
    embers.forEach(e => e.got = false);
    shades.forEach((s, i) => { s.x = s.homeX; s.y = s.homeY; s.phase = i * 2; });
    $('#intro-overlay').classList.add('hidden'); $('#end-overlay').classList.add('hidden');
    updateHud(); announce('THE EMBERS ARE SCATTERED. FOLLOW THEIR GLOW.');
  }
  function dash() {
    if (!state.started || state.ended || state.dashLock > 0) return;
    let x = 0, y = 0;
    if (keys.has('ArrowLeft') || keys.has('a')) x--;
    if (keys.has('ArrowRight') || keys.has('d')) x++;
    if (keys.has('ArrowUp') || keys.has('w')) y--;
    if (keys.has('ArrowDown') || keys.has('s')) y++;
    if (!x && !y) { x = player.dx; y = player.dy; }
    const mag = Math.hypot(x, y) || 1;
    player.dx = x / mag; player.dy = y / mag;
    state.dashTime = .2; state.dashLock = 1.15;
  }
  window.addEventListener('keydown', event => {
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(event.key)) event.preventDefault();
    keys.add(key);
    if (event.key === ' ' || event.key === 'Shift') dash();
    if (!state.started && (event.key === 'Enter')) reset();
  });
  window.addEventListener('keyup', event => keys.delete(event.key.length === 1 ? event.key.toLowerCase() : event.key));
  window.addEventListener('blur', () => keys.clear());
  $('#begin-button').addEventListener('click', reset);
  $('#again-button').addEventListener('click', reset);
  document.querySelectorAll('.touch-key').forEach(button => {
    const key = button.dataset.key;
    const down = event => { event.preventDefault(); keys.add(key); button.setPointerCapture?.(event.pointerId); };
    const up = event => { event.preventDefault(); keys.delete(key); };
    button.addEventListener('pointerdown', down); button.addEventListener('pointerup', up); button.addEventListener('pointercancel', up); button.addEventListener('lostpointercapture', up);
  });
  $('#dash-button').addEventListener('pointerdown', event => { event.preventDefault(); dash(); });
  let muted = true;
  $('#sound-toggle').addEventListener('click', () => {
    muted = !muted;
    $('#sound-icon').textContent = muted ? '♪' : '♫';
    $('.sound-label').textContent = muted ? 'SOUND OFF' : 'SOUND ON';
    announce(muted ? 'SOUND OFF' : 'THE FEN WHISPERS…');
  });

  function update(dt) {
    if (state.toastTimer > 0) { state.toastTimer -= dt; if (state.toastTimer <= 0) toast.classList.add('hidden'); }
    if (!state.started || state.ended) return;
    state.time += dt; state.damageLock -= dt; state.dashLock -= dt; state.dashTime -= dt;
    let mx = 0, my = 0;
    if (keys.has('ArrowLeft') || keys.has('a')) mx--;
    if (keys.has('ArrowRight') || keys.has('d')) mx++;
    if (keys.has('ArrowUp') || keys.has('w')) my--;
    if (keys.has('ArrowDown') || keys.has('s')) my++;
    if (mx || my) {
      const mag = Math.hypot(mx, my); mx /= mag; my /= mag;
      player.dx = mx; player.dy = my;
      const speed = state.dashTime > 0 ? 570 : player.speed;
      player.x += mx * speed * dt; player.y += my * speed * dt;
    }
    player.x = Math.max(25, Math.min(W - 25, player.x));
    player.y = Math.max(28, Math.min(H - 26, player.y));
    for (const ember of embers) {
      if (!ember.got && Math.hypot(player.x - ember.x, player.y - ember.y) < 27) {
        ember.got = true; state.collected++;
        announce(state.collected === 3 ? 'ALL THREE EMBERS RETURN. THE WARD GATE OPENS!' : `EMBER SIGIL FOUND · ${state.collected} OF 3`);
        updateHud();
      }
    }
    for (const shade of shades) {
      const d = Math.hypot(player.x - shade.x, player.y - shade.y);
      if (d < 165 && d > 1) {
        const speed = shade.speed + (d < 75 ? 14 : 0);
        shade.x += (player.x - shade.x) / d * speed * dt;
        shade.y += (player.y - shade.y) / d * speed * dt;
      } else {
        shade.x = shade.homeX + Math.sin(state.time * .65 + shade.phase) * 21;
        shade.y = shade.homeY + Math.cos(state.time * .8 + shade.phase) * 17;
      }
      if (d < 23 && state.damageLock <= 0) {
        state.health--; state.damageLock = 1.45;
        const dx = (player.x - shade.x) / (d || 1), dy = (player.y - shade.y) / (d || 1);
        player.x += dx * 36; player.y += dy * 36;
        updateHud(); announce(state.health ? 'A HOLLOW SHADE TOUCHED YOUR HEARTLIGHT' : 'YOUR LANTERN IS GOING OUT…');
        if (state.health <= 0) { finish(false); break; }
      }
    }
    if (state.collected === 3 && Math.hypot(player.x - gate.x, player.y - gate.y) < 47) finish(true);
    updateHud();
  }
  function frame(now) {
    const dt = Math.min(.035, (now - (state.last || now)) / 1000);
    state.last = now;
    update(dt);
    drawWorld(state.time || now / 1000);
    drawMinimap();
    requestAnimationFrame(frame);
  }
  updateHud();
  requestAnimationFrame(frame);
})();
