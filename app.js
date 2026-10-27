/* HMS Thailand — design preview by Mabido Media (v2, 27/10/2026).
   The film is driven by scroll: video shots are image sequences drawn on a canvas,
   the software is drawn line by line on a second canvas. All real text lives in
   index.html; the illustration figures are painted in canvases, so no search
   engine or AI can read them as HMS data. Without JavaScript, or with reduced
   motion, the page shows stacked scenes. */
(function () {
  'use strict';

  var root = document.documentElement;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  function clamp(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
  function ramp(p, a, b) { return clamp((p - a) / (b - a)); }
  function ease(x) { return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  // 1 inside [a, b], fading over f on each side
  function win(p, a, b, f) {
    f = f || 0.012;
    if (p < a - f || p > b + f) return 0;
    if (p < a) return (p - (a - f)) / f;
    if (p > b) return 1 - (p - b) / f;
    return 1;
  }

  if (reduce) root.classList.add('static');

  /* ---------- Design notes toggle (remembered per viewer) ---------- */
  var notesBtn = $('#notes-toggle');
  function setNotes(on) {
    root.classList.toggle('notes-off', !on);
    notesBtn.setAttribute('aria-pressed', String(on));
    notesBtn.textContent = on ? 'Hide design notes' : 'Show design notes';
    try { localStorage.setItem('hms-preview-notes', on ? '1' : '0'); } catch (e) {}
  }
  var stored = null;
  try { stored = localStorage.getItem('hms-preview-notes'); } catch (e) {}
  setNotes(stored !== '0');
  notesBtn.addEventListener('click', function () { setNotes(root.classList.contains('notes-off')); });

  /* ---------- Thai version tip ---------- */
  var thBtn = $('.lang-th'), thTip = $('#th-tip');
  thBtn.addEventListener('click', function () {
    var open = thTip.hidden;
    thTip.hidden = !open;
    thBtn.setAttribute('aria-expanded', String(open));
  });
  document.addEventListener('click', function (e) {
    if (!thTip.hidden && !e.target.closest('.lang')) { thTip.hidden = true; thBtn.setAttribute('aria-expanded', 'false'); }
  });

  /* ---------- Mobile menu ---------- */
  var menuBtn = $('.menu-btn');
  function setMenu(open) { menuBtn.setAttribute('aria-expanded', String(open)); root.classList.toggle('menu-open', open); }
  menuBtn.addEventListener('click', function () { setMenu(menuBtn.getAttribute('aria-expanded') !== 'true'); });
  $$('#main-nav a').forEach(function (a) { a.addEventListener('click', function () { setMenu(false); }); });

  /* ---------- Clients marquee: duplicate the list once for a seamless loop ---------- */
  var track = $('.marquee-track');
  if (track && !reduce) {
    $$('li', track).forEach(function (li) {
      var c = li.cloneNode(true);
      c.setAttribute('aria-hidden', 'true');
      track.appendChild(c);
    });
  }

  /* ---------- Header: transparent over the film, solid after ---------- */
  var film = $('#film');
  var header = $('.site-header');
  function updateHeader() {
    var r = film.getBoundingClientRect();
    root.classList.toggle('is-solid', r.bottom <= header.offsetHeight + 100);
  }

  /* ---------- Results: video, rolling digits, rising curve ---------- */
  var cards = $$('.stack-card');
  function buildRoller(fig) {
    var pct = fig.getAttribute('data-pct');
    if (!pct || fig.querySelector('.roll')) return;
    fig.setAttribute('aria-label', '+' + pct + '%');
    var roll = document.createElement('span');
    roll.className = 'roll';
    roll.setAttribute('aria-hidden', 'true');
    var plus = document.createElement('span'); plus.className = 'plus'; plus.textContent = '+'; roll.appendChild(plus);
    pct.split('').forEach(function (d, k) {
      var col = document.createElement('span'); col.className = 'roll-col';
      var strip = document.createElement('span'); strip.className = 'roll-strip';
      strip.style.transitionDelay = (0.15 + k * 0.18) + 's';
      strip.dataset.target = d;
      for (var n = 0; n < 20; n++) { var s = document.createElement('span'); s.textContent = String(n % 10); strip.appendChild(s); }
      col.appendChild(strip); roll.appendChild(col);
    });
    var unit = document.createElement('span'); unit.className = 'pct'; unit.textContent = '%';
    roll.appendChild(unit);
    fig.textContent = '';
    fig.appendChild(roll);
  }
  function spin(card) {
    $$('.roll-strip', card).forEach(function (s) { s.style.transform = 'translateY(-' + (10 + Number(s.dataset.target)) + 'em)'; });
  }
  function playVideo(card, on) {
    var v = $('video', card);
    if (!v) return;
    if (on) {
      if (!v.getAttribute('src') && v.dataset.src) v.setAttribute('src', v.dataset.src);
      var pr = v.play(); if (pr && pr.catch) pr.catch(function () {});
    } else if (!v.paused) v.pause();
  }
  if (!reduce) {
    cards.forEach(function (c) { buildRoller($('.card-figure', c)); });
    $$('.curve-line', document).forEach(function (l) { l.setAttribute('pathLength', '1'); });
  }
  if ('IntersectionObserver' in window && !reduce) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          if (!e.target.classList.contains('is-seen')) { e.target.classList.add('is-seen'); spin(e.target); }
          playVideo(e.target, true);
        } else playVideo(e.target, false);
      });
    }, { threshold: 0.45 });
    cards.forEach(function (c) { io.observe(c); });
  } else {
    cards.forEach(function (c) { c.classList.add('is-seen'); });
  }

  /* ================= The software, drawn line by line ================= */
  // Logical drawing space: 1600 x 900. q goes from 0 (blueprint) to 1 (finished, revenue rising).
  var ORANGE = '#EB5722', AMBER = '#E8A520', NAVY = '#0F1C2C', INK = '#16273B';
  var FONT = '"Schibsted Grotesk", "Helvetica Neue", Arial, sans-serif';
  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
  }
  // Draw a rounded rectangle outline progressively (k from 0 to 1), as a pen would
  function traceRect(ctx, x, y, w, h, k) {
    if (k <= 0) return;
    var per = 2 * (w + h), len = per * Math.min(k, 1);
    var pts = [[x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y]];
    ctx.beginPath(); ctx.moveTo(x, y);
    for (var i = 1; i < pts.length && len > 0; i++) {
      var a = pts[i - 1], b = pts[i], seg = Math.abs(b[0] - a[0]) + Math.abs(b[1] - a[1]);
      var t = Math.min(1, len / seg);
      ctx.lineTo(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t);
      len -= seg;
    }
    ctx.stroke();
  }
  function traceLine(ctx, x1, y1, x2, y2, k) {
    if (k <= 0) return;
    k = Math.min(k, 1);
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 + (x2 - x1) * k, y1 + (y2 - y1) * k); ctx.stroke();
  }
  var REV = [];
  for (var ri = 0; ri <= 24; ri++) REV.push(0.12 + 0.72 * Math.pow(ri / 24, 1.35) + 0.05 * Math.sin(ri * 1.3));
  var DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  var ROOMS = [['Deluxe', 3900], ['Pool villa', 6800], ['Suite', 9500]];

  function drawDash(ctx, W, H, q, t, full) {
    ctx.clearRect(0, 0, W, H);
    // where the drawing sits on screen
    var R;
    if (full) R = [0, 0, W, H];
    else if (W < 700) R = [W * 0.04, H * 0.11, W * 0.92, H * 0.42];
    else R = [W * 0.37, H * 0.13, W * 0.6, H * 0.78];
    var s = Math.min(R[2] / 1600, R[3] / 900);
    var ox = R[0] + (R[2] - 1600 * s) / 2, oy = R[1] + (R[3] - 900 * s) / 2;

    // blueprint grid over the whole stage
    var g = ramp(q, 0, 0.08) * (1 - 0.6 * ramp(q, 0.5, 0.7));
    if (g > 0 && !full) {
      ctx.save(); ctx.globalAlpha = g;
      for (var gx = 0; gx < W; gx += 32) { ctx.strokeStyle = gx % 160 === 0 ? 'rgba(233,238,245,0.09)' : 'rgba(233,238,245,0.04)'; ctx.beginPath(); ctx.moveTo(gx + 0.5, 0); ctx.lineTo(gx + 0.5, H); ctx.stroke(); }
      for (var gy = 0; gy < H; gy += 32) { ctx.strokeStyle = gy % 160 === 0 ? 'rgba(233,238,245,0.09)' : 'rgba(233,238,245,0.04)'; ctx.beginPath(); ctx.moveTo(0, gy + 0.5); ctx.lineTo(W, gy + 0.5); ctx.stroke(); }
      ctx.restore();
    }

    ctx.save();
    ctx.translate(ox, oy); ctx.scale(s, s);
    var lw = 2.4 / s * Math.max(1, s * 1.2);
    var fill = ease(ramp(q, 0.46, 0.64));          // the wireframe becomes a real screen
    var lineCol = 'rgba(235,87,34,' + (1 - 0.94 * fill) + ')';
    ctx.lineWidth = lw; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.shadowColor = 'rgba(235,87,34,' + (0.8 * (1 - fill)) + ')'; ctx.shadowBlur = 14 * (1 - fill);
    ctx.strokeStyle = lineCol;

    // devices
    traceRect(ctx, 40, 40, 1140, 820, ramp(q, 0.0, 0.13));      // tablet body
    traceRect(ctx, 72, 72, 1076, 756, ramp(q, 0.08, 0.17));     // tablet screen
    traceRect(ctx, 1250, 160, 300, 620, ramp(q, 0.12, 0.22));   // phone body
    traceRect(ctx, 1270, 200, 260, 540, ramp(q, 0.17, 0.25));   // phone screen

    // construction dimensions (blueprint only)
    var dim = ramp(q, 0.04, 0.12) * (1 - ramp(q, 0.42, 0.52));
    if (dim > 0) {
      ctx.save(); ctx.globalAlpha = dim; ctx.shadowBlur = 0; ctx.strokeStyle = 'rgba(232,165,32,0.8)'; ctx.lineWidth = lw * 0.6;
      traceLine(ctx, 40, 12, 1180, 12, ramp(q, 0.05, 0.12));
      traceLine(ctx, 1212, 40, 1212, 860, ramp(q, 0.07, 0.14));
      traceLine(ctx, 1250, 132, 1550, 132, ramp(q, 0.14, 0.2));
      [[40, 4, 40, 20], [1180, 4, 1180, 20], [1204, 40, 1220, 40], [1204, 860, 1220, 860]].forEach(function (m) { traceLine(ctx, m[0], m[1], m[2], m[3], 1); });
      ctx.restore();
    }

    // screen fills in
    if (fill > 0) {
      ctx.save(); ctx.shadowBlur = 0; ctx.globalAlpha = fill;
      // the devices themselves: a dark tablet and a dark phone
      ctx.fillStyle = '#0A1320'; rr(ctx, 40, 40, 1140, 820, 46); ctx.fill(); rr(ctx, 1250, 160, 300, 620, 44); ctx.fill();
      ctx.strokeStyle = 'rgba(233,238,245,0.18)'; ctx.lineWidth = 2; rr(ctx, 40, 40, 1140, 820, 46); ctx.stroke(); rr(ctx, 1250, 160, 300, 620, 44); ctx.stroke();
      ctx.fillStyle = '#FFFFFF'; rr(ctx, 72, 72, 1076, 756, 14); ctx.fill();
      ctx.fillStyle = NAVY; rr(ctx, 72, 72, 190, 756, 14); ctx.fill(); ctx.fillRect(200, 72, 62, 756);
      ctx.fillStyle = '#FFFFFF'; rr(ctx, 1270, 200, 260, 540, 22); ctx.fill();
      ctx.fillStyle = '#F3F5F8';
      for (var c = 0; c < 4; c++) { rr(ctx, 290 + c * 212, 180, 196, 118, 12); ctx.fill(); }
      rr(ctx, 1290, 250, 220, 96, 12); ctx.fill(); rr(ctx, 1290, 360, 220, 96, 12); ctx.fill();
      ctx.restore();
    }

    // wireframe of the layout
    ctx.strokeStyle = lineCol;
    traceLine(ctx, 262, 72, 262, 828, ramp(q, 0.18, 0.24));     // sidebar
    traceLine(ctx, 262, 150, 1148, 150, ramp(q, 0.2, 0.26));    // header
    ctx.save(); ctx.globalAlpha = 1 - fill; // the menu sketch gives way to the real menu
    for (var si = 0; si < 5; si++) traceRect(ctx, 100, 200 + si * 64, 130, 34, ramp(q, 0.22 + si * 0.012, 0.28 + si * 0.012));
    ctx.restore();
    for (var ci = 0; ci < 4; ci++) traceRect(ctx, 290 + ci * 212, 180, 196, 118, ramp(q, 0.25 + ci * 0.02, 0.33 + ci * 0.02));
    var cal = [290, 324, 830, 230];
    traceRect(ctx, cal[0], cal[1], cal[2], cal[3], ramp(q, 0.3, 0.38));
    for (var col = 1; col <= 7; col++) traceLine(ctx, cal[0] + 130 + (col - 1) * 100, cal[1], cal[0] + 130 + (col - 1) * 100, cal[1] + cal[3], ramp(q, 0.33 + col * 0.008, 0.4 + col * 0.008));
    for (var row = 1; row <= 3; row++) traceLine(ctx, cal[0], cal[1] + 44 + (row - 1) * 62, cal[0] + cal[2], cal[1] + 44 + (row - 1) * 62, ramp(q, 0.36 + row * 0.01, 0.43 + row * 0.01));
    var ch = [290, 580, 830, 222];
    traceRect(ctx, ch[0], ch[1], ch[2], ch[3], ramp(q, 0.38, 0.46));
    traceRect(ctx, 1290, 250, 220, 96, ramp(q, 0.3, 0.38));
    traceRect(ctx, 1290, 360, 220, 96, ramp(q, 0.33, 0.41));
    traceRect(ctx, 1290, 470, 220, 230, ramp(q, 0.36, 0.44));

    // words and figures (illustration)
    var txt = ease(ramp(q, 0.56, 0.7));
    if (txt > 0) {
      ctx.save(); ctx.shadowBlur = 0; ctx.globalAlpha = txt; ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = ORANGE; rr(ctx, 92, 196, 150, 42, 21); ctx.fill();
      ctx.fillStyle = '#FFFFFF'; ctx.font = '600 22px ' + FONT;
      ['Dashboard', 'Rates', 'Channels', 'Reports', 'Guests'].forEach(function (w, k) { ctx.globalAlpha = txt * (k === 0 ? 1 : 0.65); ctx.fillText(w, 110, 225 + k * 64); });
      ctx.globalAlpha = txt;
      ctx.fillStyle = INK; ctx.font = '600 30px ' + FONT; ctx.fillText('Tonight at your property', 292, 124);
      var kpi = [['Arrivals', '18'], ['Occupancy', '84%'], ['Average rate', '฿4,250'], ['RevPAR', '฿3,570']];
      kpi.forEach(function (k, i) {
        ctx.fillStyle = '#6B7686'; ctx.font = '500 19px ' + FONT; ctx.fillText(k[0], 310 + i * 212, 218);
        ctx.fillStyle = INK; ctx.font = '600 40px ' + FONT; ctx.fillText(k[1], 310 + i * 212, 272);
      });
      ctx.fillStyle = '#6B7686'; ctx.font = '600 18px ' + FONT;
      DAYS.forEach(function (d, i) { ctx.fillText(d, cal[0] + 152 + i * 100, cal[1] + 29); });
      ROOMS.forEach(function (r, i) { ctx.fillStyle = INK; ctx.font = '600 19px ' + FONT; ctx.fillText(r[0], cal[0] + 16, cal[1] + 84 + i * 62); });
      ctx.fillStyle = INK; ctx.font = '600 22px ' + FONT; ctx.fillText('Revenue', ch[0] + 20, ch[1] + 38);
      ctx.fillStyle = INK; ctx.font = '600 22px ' + FONT; ctx.fillText('Today', 1290, 236);
      ctx.fillStyle = '#6B7686'; ctx.font = '500 17px ' + FONT; ctx.fillText('Occupancy', 1306, 284); ctx.fillText('Arrivals', 1306, 394);
      ctx.fillStyle = INK; ctx.font = '600 34px ' + FONT; ctx.fillText('84%', 1306, 328); ctx.fillText('18', 1306, 438);
      ctx.restore();
    }

    // dynamic pricing: rates move with demand
    var dyn = ramp(q, 0.6, 0.72);
    if (txt > 0) {
      ctx.save(); ctx.shadowBlur = 0; ctx.globalAlpha = txt;
      ROOMS.forEach(function (r, i) {
        for (var d = 0; d < 7; d++) {
          var demand = 0.5 + 0.5 * Math.sin(d * 0.9 + i * 1.7 + t * 1.6 * dyn);
          var rate = Math.round((r[1] * (0.92 + 0.22 * demand * dyn + (d >= 4 ? 0.08 : 0))) / 50) * 50;
          var x = cal[0] + 130 + d * 100, y = cal[1] + 44 + i * 62;
          if (dyn > 0 && demand > 0.72) { ctx.fillStyle = 'rgba(235,87,34,' + (0.16 * dyn) + ')'; ctx.fillRect(x + 4, y + 4, 92, 54); }
          ctx.fillStyle = demand > 0.72 && dyn > 0.5 ? '#C2410C' : INK;
          ctx.font = '600 18px ' + FONT;
          ctx.fillText(rate.toLocaleString('en-US'), x + 18, y + 38);
        }
      });
      ctx.restore();
    }

    // the line: revenue rising
    var rv = ease(ramp(q, 0.7, 0.97));
    function curve(x0, y0, w, h, k, width, glow) {
      if (k <= 0) return;
      var n = Math.max(1, Math.round((REV.length - 1) * k));
      var pts = [];
      for (var i = 0; i <= n; i++) pts.push([x0 + (i / (REV.length - 1)) * w, y0 + h - REV[i] * h]);
      ctx.save(); ctx.shadowBlur = 0;
      var grd = ctx.createLinearGradient(0, y0, 0, y0 + h);
      grd.addColorStop(0, 'rgba(235,87,34,0.22)'); grd.addColorStop(1, 'rgba(235,87,34,0)');
      ctx.beginPath(); ctx.moveTo(pts[0][0], y0 + h);
      pts.forEach(function (p) { ctx.lineTo(p[0], p[1]); });
      ctx.lineTo(pts[pts.length - 1][0], y0 + h); ctx.closePath(); ctx.fillStyle = grd; ctx.fill();
      ctx.beginPath(); pts.forEach(function (p, i) { if (i) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]); });
      ctx.strokeStyle = ORANGE; ctx.lineWidth = width; ctx.shadowColor = 'rgba(235,87,34,0.8)'; ctx.shadowBlur = glow; ctx.stroke();
      var e = pts[pts.length - 1], pulse = 1 + 0.25 * Math.sin(t * 3);
      ctx.beginPath(); ctx.arc(e[0], e[1], width * 1.7 * pulse, 0, Math.PI * 2); ctx.fillStyle = '#FFD9B0'; ctx.fill();
      ctx.restore();
    }
    curve(ch[0] + 24, ch[1] + 56, ch[2] - 48, ch[3] - 76, rv, 5, 14);
    curve(1306, 520, 188, 150, rv, 4, 8);

    ctx.restore();
  }
  window.HMSDash = { draw: drawDash }; // used once to export the still image for visitors without JavaScript

  /* Traces (the orange line) know their own length */
  $$('.trace path').forEach(function (p) {
    var L = p.getTotalLength ? p.getTotalLength() : 2000;
    p.parentNode.style.setProperty('--len', L.toFixed(1));
  });

  if (reduce) {
    var v0 = $('.media-video');
    if (v0) { v0.removeAttribute('autoplay'); v0.pause(); }
    $$('.trace').forEach(function (t) { t.style.setProperty('--draw', 1); });
    addEventListener('scroll', updateHeader, { passive: true });
    updateHeader();
    return;
  }

  /* ================= The live film ================= */
  root.classList.add('film-live');

  var stage = $('.film-stage');
  var scenes = {};
  $$('.scene', film).forEach(function (s) {
    scenes[s.dataset.scene] = { el: s, media: $('.scene-media', s), text: $('.scene-text', s) };
  });
  var heroVideo = $('.media-video', film);
  var nightLit = $('.night-lit', film);
  var floors = $$('.floors li', film);
  var floorNo = $('.floor-no', film), floorRail = $('.floor-rail', film);
  var traceEntrance = $('.trace-path', film), traceVillas = $('.trace-villas', film);
  var villaDots = $$('.trace-villas circle', film), entranceDot = $('.trace-path circle', film);
  var cue = $('.scroll-cue', film), progress = $('.film-progress', film);
  var glow = document.createElement('div'); glow.className = 'screen-glow'; stage.appendChild(glow);

  // canvases (sharp on retina)
  var fc = $('.film-canvas', film), fctx = fc.getContext('2d');
  var dc = $('.dash-canvas', film), dctx = dc.getContext('2d');
  var dpr = 1, CW = 0, CH = 0;
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    CW = stage.clientWidth; CH = stage.clientHeight;
    [fc, dc].forEach(function (c) { c.width = Math.round(CW * dpr); c.height = Math.round(CH * dpr); });
    lastKey = '';
  }

  // image sequences
  function seq(dir, n) {
    var s = { frames: [], n: n };
    for (var i = 0; i < n; i++) { var im = new Image(); im.decoding = 'async'; s.frames.push(im); im.dataset.src = dir + '/' + ('00' + i).slice(-3) + '.webp'; }
    return s;
  }
  function still(src) { var im = new Image(); im.src = src; return im; }
  var V1 = seq('assets/seq/v1', 80), V3 = seq('assets/seq/v3', 80), V2 = seq('assets/seq/v2', 80);
  var ELEV_LOW = still('assets/film/elevator-low.jpg'), ELEV_HIGH = still('assets/film/elevator-high.jpg');
  // load V1 first, then V3, then V2 (a missing V2 falls back to the two stills)
  var queue = [V1, V3, V2];
  (function loadNext(qi, i) {
    if (qi >= queue.length) return;
    var S = queue[qi];
    if (i >= S.n) return loadNext(qi + 1, 0);
    var im = S.frames[i];
    im.onload = im.onerror = function () { if (im.naturalWidth === 0) im.failed = true; loadNext(qi, i + 1); };
    im.src = im.dataset.src;
  })(0, 0);
  function frameAt(S, k) {
    var i = Math.round(clamp(k) * (S.n - 1));
    for (var d = 0; d < S.n; d++) {             // nearest loaded frame
      var a = S.frames[i - d], b = S.frames[i + d];
      if (a && a.complete && a.naturalWidth) return a;
      if (b && b.complete && b.naturalWidth) return b;
    }
    return null;
  }
  // draw an image like object-fit: cover with object-position (fx, fy), zoomed by z around screen point (zx, zy)
  function drawCover(im, fx, fy, alpha, z, zx, zy) {
    if (!im || !im.naturalWidth || alpha <= 0) return;
    var W = CW * dpr, H = CH * dpr, iw = im.naturalWidth, ih = im.naturalHeight;
    var sc = Math.max(W / iw, H / ih), dw = iw * sc, dh = ih * sc;
    var x = (W - dw) * fx, y = (H - dh) * fy;
    z = z || 1;
    if (z !== 1) { var px = zx * W, py = zy * H; x = px + (x - px) * z; y = py + (y - py) * z; dw *= z; dh *= z; }
    fctx.globalAlpha = alpha; fctx.drawImage(im, x, y, dw, dh); fctx.globalAlpha = 1;
  }
  // where an image point (u, v) lands on screen, for a cover crop with object-position (fx, fy)
  function screenOf(im, fx, fy, u, v) {
    var iw = (im && im.naturalWidth) || 1280, ih = (im && im.naturalHeight) || 720;
    var sc = Math.max(CW / iw, CH / ih), dw = iw * sc, dh = ih * sc;
    return [((CW - dw) * fx + u * dw) / CW, ((CH - dh) * fy + v * dh) / CH];
  }

  function setText(node, o) {
    node.style.opacity = o.toFixed(3);
    node.style.transform = o < 1 ? 'translateY(' + ((1 - o) * 18).toFixed(1) + 'px)' : '';
    node.classList.toggle('is-live', o > 0.5);
  }

  var t0 = performance.now(), lastKey = '';
  resize();
  addEventListener('resize', resize);

  function drawFilm(p) {
    var W = CW * dpr, H = CH * dpr;
    fctx.clearRect(0, 0, W, H);
    var f1 = frameAt(V1, 1), f3 = frameAt(V3, 1);
    if (p < 0.275) {                                  // 1. sky -> arrival path
      var k1 = ramp(p, 0.06, 0.17), im1 = frameAt(V1, k1);
      var z = 1;
      if (p > 0.17) z = 1 + 0.04 * ramp(p, 0.17, 0.25) + 0.9 * ease(ramp(p, 0.25, 0.29));
      var door = screenOf(im1, 0.5, 0.5, 0.47, 0.57);
      drawCover(im1, 0.5, 0.5, 1, z, door[0], door[1]);
    }
    if (p > 0.26 && p < 0.47) {                      // 2. through the doors -> the reception tablet
      var a3 = ramp(p, 0.265, 0.29), im3 = frameAt(V3, ramp(p, 0.29, 0.4));
      var zz = 1 + 2.6 * ease(ramp(p, 0.395, 0.445));
      drawCover(im3, 0.49, 0.59, a3, zz, 0.49, 0.59);
    }
    if (p > 0.59 && p < 0.9) {                       // 3. out again -> up the glass elevator
      var a2 = ramp(p, 0.6, 0.64) * (1 - ramp(p, 0.855, 0.878));
      var k2 = ramp(p, 0.64, 0.78);
      var im2 = frameAt(V2, k2);
      if (im2) drawCover(im2, 0.5, 0.5, a2, 1 + 0.03 * ramp(p, 0.78, 0.865), 0.5, 0.5);
      else { drawCover(ELEV_LOW, 0.5, 0.5, a2, 1, 0.5, 0.5); drawCover(ELEV_HIGH, 0.5, 0.5, a2 * ease(k2), 1, 0.5, 0.5); }
    }
    return [f1, f3];
  }

  function frame(now) {
    step(now);
    var r = film.getBoundingClientRect();
    var total = film.offsetHeight - innerHeight;
    var p = clamp(-r.top / total);
    var t = (now - t0) / 1000;
    var visible = r.bottom > 0 && r.top < innerHeight;

    if (visible) {
      var key = p.toFixed(4) + '|' + CW + 'x' + CH;
      if (key !== lastKey) { drawFilm(p); lastKey = key; }
      fc.style.opacity = (ramp(p, 0.045, 0.075) * (1 - ramp(p, 0.44, 0.47)) + ramp(p, 0.6, 0.64) * (1 - ramp(p, 0.855, 0.878))).toFixed(3);

      // the arrival, then the hero text
      var A = scenes.arrive;
      A.media.style.opacity = (1 - ramp(p, 0.045, 0.075)).toFixed(3);
      setText(A.text, p < 0.001 ? 1 : win(p, -1, 0.05, 0.02));

      // I. Arrival: hotel websites, the line runs to the doors
      var I = scenes.websites, oI = win(p, 0.18, 0.255);
      setText(I.text, oI); I.media.style.setProperty('--veil', oI.toFixed(3));
      var dr = ramp(p, 0.18, 0.235);
      traceEntrance.style.setProperty('--draw', dr.toFixed(3));
      traceEntrance.style.opacity = (1 - ramp(p, 0.255, 0.275)).toFixed(3);
      entranceDot.classList.toggle('is-on', dr > 0.97);

      // the glow of the tablet screen
      glow.style.setProperty('--g', (0.15 + 7.5 * ease(ramp(p, 0.4, 0.46))).toFixed(3));
      glow.style.setProperty('--go', (ramp(p, 0.39, 0.425) * (1 - ramp(p, 0.46, 0.49))).toFixed(3));

      // II. Inside the screen: hotel software
      var S = scenes.software;
      var sIn = ramp(p, 0.435, 0.465), sOut = ramp(p, 0.6, 0.635);
      S.media.style.opacity = (sIn * (1 - sOut)).toFixed(3);
      S.media.style.transform = sOut > 0 ? 'scale(' + (1 - 0.12 * ease(sOut)).toFixed(4) + ')' : '';
      setText(S.text, win(p, 0.465, 0.595));
      if (sIn > 0 && sOut < 1) {
        dctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        drawDash(dctx, CW, CH, ramp(p, 0.455, 0.59), t, false);
      }

      // III. Going up: revenue management, floor by floor
      var U = scenes.revenue, oU = win(p, 0.645, 0.775);
      setText(U.text, oU); U.media.style.setProperty('--veil', oU.toFixed(3));
      var fAt = [0.65, 0.68, 0.71, 0.74], cur = 0;
      floors.forEach(function (li, k) { var on = p >= fAt[k]; li.classList.toggle('is-on', on); if (on) cur = k; });
      floors.forEach(function (li, k) { li.classList.toggle('is-current', k === cur); });
      floorNo.textContent = String(cur + 1);
      floorRail.style.setProperty('--rise', ramp(p, 0.64, 0.77).toFixed(3));
      $('.floor-display', U.el).style.opacity = oU.toFixed(3);

      // IV. The view from the top: sales and marketing assessment
      var V = scenes.assessment, oV = win(p, 0.79, 0.855);
      setText(V.text, oV); V.media.style.setProperty('--veil', oV.toFixed(3));

      // Night: a moment of dark, then the line lights the villas one by one
      var N = scenes.night;
      N.media.style.opacity = ramp(p, 0.858, 0.878).toFixed(3);
      N.media.style.transform = 'scale(' + (1.12 - 0.12 * ease(ramp(p, 0.858, 0.99))).toFixed(4) + ')';
      N.media.style.transformOrigin = '75% 55%';
      var dusk = ease(ramp(p, 0.878, 0.9));
      N.media.style.filter = dusk < 1 ? 'brightness(' + (0.3 + 0.7 * dusk).toFixed(3) + ')' : '';
      nightLit.style.setProperty('--r', (ramp(p, 0.9, 0.938) * 130).toFixed(1));
      var vd = ramp(p, 0.897, 0.935);
      traceVillas.style.setProperty('--draw', vd.toFixed(3));
      villaDots.forEach(function (c, k) { c.classList.toggle('is-on', vd >= (k + 1) / (villaDots.length + 0.5)); });
      setText(N.text, win(p, 0.9, 0.938));

      // The numbers, as plain text
      var Z = scenes.numbers;
      Z.media.style.opacity = (ramp(p, 0.945, 0.965) * 0.66).toFixed(3);
      setText(Z.text, win(p, 0.95, 2));

      // the button at the bottom: enter, continue, or skip the chapter that is playing
      var resting = !run && (p < 0.004 || Math.abs(p - STOPS[1]) < 0.003 || Math.abs(p - STOPS[2]) < 0.003);
      var playing = run && !run.back;
      var cueText = playing ? 'Skip ›' : p < 0.004 ? 'Click or scroll to enter' : 'Click or scroll to continue';
      if ((resting || playing) && cue.textContent !== cueText) cue.textContent = cueText;
      cue.style.opacity = resting || playing ? '1' : '0';
      cue.style.pointerEvents = resting || playing ? 'auto' : 'none';
      progress.style.setProperty('--p', p.toFixed(4));

      if (heroVideo) {
        if (p < 0.08 && heroVideo.paused) { var pr = heroVideo.play(); if (pr && pr.catch) pr.catch(function () {}); }
        else if (p >= 0.08 && !heroVideo.paused) heroVideo.pause();
      }
    } else if (heroVideo && !heroVideo.paused) {
      heroVideo.pause();
    }
    updateHeader();
    requestAnimationFrame(frame);
  }

  /* ---------- The film plays itself: one scroll, one chapter ---------- */
  // Three runs, each from one stop to the next, as [film position, second] keyframes:
  // camera moves keep their pace, and every chapter holds long enough to be read.
  // 1. sky -> path (hotel websites) -> lobby -> into the tablet -> the software draws itself
  // 2. out of the tablet -> the elevator climbs, floors 1 to 4 light up
  // 3. the view (assessment) -> a moment of dark -> the villas light up -> 95 · 5 · 2010
  // After the last stop the page scrolls normally.
  var RUNS = [
    [[0, 0], [0.06, 0.9], [0.17, 4.3], [0.255, 7.5], [0.29, 8.7], [0.4, 12.2], [0.455, 13.8], [0.592, 19]],
    [[0.592, 0], [0.64, 1.5], [0.772, 7.6]],
    [[0.772, 0], [0.79, 0.6], [0.855, 4.2], [0.878, 5.2], [0.9, 6.4], [0.938, 8.8], [0.945, 9.6], [0.985, 11.2]]
  ];
  var STOPS = [0, 0.592, 0.772, 0.985], LAST = STOPS[STOPS.length - 1], EPS = 0.002;
  // a monotone cubic through the keyframes, at rest at both ends
  function curve(K) {
    var n = K.length, d = [], m = [], i;
    for (i = 0; i < n - 1; i++) d.push((K[i + 1][0] - K[i][0]) / (K[i + 1][1] - K[i][1]));
    for (i = 0; i < n; i++) m.push(i === 0 || i === n - 1 || d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2);
    for (i = 0; i < n - 1; i++) {
      var a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b;
      if (s > 9) { s = 3 / Math.sqrt(s); m[i] = s * a * d[i]; m[i + 1] = s * b * d[i]; }
    }
    function at(t) {
      if (t <= 0) return K[0][0];
      if (t >= K[n - 1][1]) return K[n - 1][0];
      var j = 0; while (t > K[j + 1][1]) j++;
      var h = K[j + 1][1] - K[j][1], u = (t - K[j][1]) / h, u2 = u * u, u3 = u2 * u;
      return (2 * u3 - 3 * u2 + 1) * K[j][0] + (u3 - 2 * u2 + u) * h * m[j] + (3 * u2 - 2 * u3) * K[j + 1][0] + (u3 - u2) * h * m[j + 1];
    }
    function timeOf(p) {                            // where a run is when the page sits at p
      var lo = 0, hi = K[n - 1][1];
      for (var k = 0; k < 32; k++) { var mid = (lo + hi) / 2; if (at(mid) < p) lo = mid; else hi = mid; }
      return lo;
    }
    return { T: K[n - 1][1], at: at, timeOf: timeOf };
  }
  var CURVES = RUNS.map(curve);
  var run = null;

  function filmP() { return clamp((window.pageYOffset - film.offsetTop) / (film.offsetHeight - innerHeight)); }
  function goTo(p) { window.scrollTo(0, film.offsetTop + p * (film.offsetHeight - innerHeight)); }
  // the stop to play to from p in direction dir, or -1 when the page should scroll normally
  function target(p, dir) {
    var i;
    if (dir > 0 && p < LAST - EPS) { for (i = 1; i < STOPS.length; i++) if (STOPS[i] > p + EPS) return i; }
    if (dir < 0 && p > EPS && p <= LAST + EPS) { for (i = STOPS.length - 2; i >= 0; i--) if (STOPS[i] < p - EPS) return i; }
    return -1;
  }
  function play(dir) {
    var p = filmP(), i = target(p, dir);
    if (i < 0) return;
    if (dir > 0) run = { c: CURVES[i - 1], t: CURVES[i - 1].timeOf(p), rate: 1, back: false, last: performance.now() };
    else run = { from: p, to: STOPS[i], t: 0, T: Math.min(2.4, Math.max(0.8, (p - STOPS[i]) * 9)), rate: 1, back: true, last: performance.now() };
  }
  // one more scroll during a chapter: the same way fast-forwards it (it still plays), the other way turns back
  function nudge(dir) {
    if (dir === (run.back ? -1 : 1)) run.rate = Math.max(run.rate, 4);
    else { run = null; play(dir); }
  }
  // the Skip button: to the end of the chapter in half a second
  function skip() { if (run && !run.back) run.rate = Math.max(1, (run.c.T - run.t) / 0.5); }
  function step(now) {
    if (!run) return;
    var dt = Math.min(0.05, (now - run.last) / 1000);
    run.last = now; run.t += dt * run.rate;
    var p, done;
    if (run.back) { var k = clamp(run.t / run.T); p = lerp(run.from, run.to, ease(k)); done = k >= 1; }
    else { p = run.c.at(run.t); done = run.t >= run.c.T; }
    goTo(p);
    if (done) run = null;
  }

  // Wheel and trackpad: one gesture, one action. A trackpad gesture starts with tiny steps, so a gesture
  // counts as soon as it has moved 12 pixels in all; the rest of it (and its momentum) is swallowed.
  var lastWheel = 0, gestureSum = 0, gestureUsed = false;
  addEventListener('wheel', function (e) {
    if (e.ctrlKey || Math.abs(e.deltaY) < Math.abs(e.deltaX)) return;
    var now = performance.now(), dir = e.deltaY > 0 ? 1 : -1;
    if (now - lastWheel > 240) { gestureSum = 0; gestureUsed = false; }
    lastWheel = now;
    if (!run && target(filmP(), dir) < 0) return;
    e.preventDefault();
    gestureSum += Math.abs(e.deltaY) * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? innerHeight : 1);
    if (gestureUsed || gestureSum < 12) return;
    gestureUsed = true;
    if (run) nudge(dir); else play(dir);
  }, { passive: false });

  // Click to enter: on the opening screen, a click outside links and buttons starts the visit;
  // the button at the bottom enters, continues, or skips the chapter that is playing
  stage.addEventListener('click', function (e) {
    if (e.target.closest('a, button, input, .dnote')) return;
    if (!run && filmP() < 0.004) play(1);
  });
  cue.addEventListener('click', function () { if (run) skip(); else play(1); });

  // Touch: the first move decides; a swipe of 24px plays the chapter
  var touchY = null, touchDone = false;
  addEventListener('touchstart', function (e) {
    touchY = e.touches.length === 1 ? e.touches[0].clientY : null; touchDone = false;
  }, { passive: true });
  addEventListener('touchmove', function (e) {
    if (touchY === null) return;
    var dy = touchY - e.touches[0].clientY, dir = dy > 0 ? 1 : -1, p = filmP();
    var down = target(p, 1) >= 0, up = target(p, -1) >= 0;
    if (!run && !(down && up) && !(dy > 0 && down) && !(dy < 0 && up)) { touchY = null; return; }
    if (e.cancelable) e.preventDefault();
    if (touchDone || Math.abs(dy) < 24) return;
    touchDone = true;
    if (run) nudge(dir); else play(dir);
  }, { passive: false });

  // Keyboard: arrows, page keys and the space bar move chapter by chapter
  addEventListener('keydown', function (e) {
    var k = e.key, dir = 0;
    if (k === 'ArrowDown' || k === 'PageDown' || (k === ' ' && !e.shiftKey)) dir = 1;
    else if (k === 'ArrowUp' || k === 'PageUp' || (k === ' ' && e.shiftKey)) dir = -1;
    if (!dir || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.target.closest && e.target.closest('input, textarea, select, [contenteditable]')) return;
    if (k === ' ' && e.target.closest && e.target.closest('a, button')) return;
    if (!run && target(filmP(), dir) < 0) return;
    e.preventDefault();
    if (run) nudge(dir); else play(dir);
  });

  requestAnimationFrame(frame);

  document.addEventListener('visibilitychange', function () {
    if (document.hidden && heroVideo) heroVideo.pause();
  });
})();
