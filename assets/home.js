// FridaySnack home page toys: bite-able snacks (they rotate), floating snack parallax,
// Mocoder card wave, and the "next snack" oven timer.
// One requestAnimationFrame loop for the whole page. It only runs while
// something visible needs it and the tab is visible.
(function () {
  'use strict';

  var reduceMQ = window.matchMedia('(prefers-reduced-motion: reduce)');
  var reduced = reduceMQ.matches;
  if (reduceMQ.addEventListener) {
    reduceMQ.addEventListener('change', function (e) { reduced = e.matches; wake(); });
  }

  // ---- shared loop ---------------------------------------------------------
  var tasks = [];          // { active: fn -> bool, tick: fn(now) }
  var rafId = 0;

  function frame(now) {
    rafId = 0;
    var keep = false;
    for (var i = 0; i < tasks.length; i++) {
      if (tasks[i].active()) {
        tasks[i].tick(now);
        keep = true;
      }
    }
    if (keep && !document.hidden) rafId = requestAnimationFrame(frame);
  }
  function wake() {
    if (!rafId && !document.hidden) rafId = requestAnimationFrame(frame);
  }
  document.addEventListener('visibilitychange', function () {
    document.documentElement.classList.toggle('is-tab-hidden', document.hidden);
    if (document.hidden) {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = 0;
    } else {
      wake();
    }
  });

  // Pause CSS animations of [data-anim] blocks while offscreen.
  var visible = new WeakMap();
  function isVisible(el) { return !!el && visible.get(el) === true; }
  var io = 'IntersectionObserver' in window
    ? new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          visible.set(en.target, en.isIntersecting);
          en.target.classList.toggle('is-paused', !en.isIntersecting);
        });
        wake();
      }, { rootMargin: '80px' })
    : null;
  function watch(el) {
    if (!el) return;
    if (io) io.observe(el); else visible.set(el, true);
  }
  Array.prototype.forEach.call(document.querySelectorAll('[data-anim]'), watch);

  function sizeCanvas(canvas) {
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    var r = canvas.getBoundingClientRect();
    var w = Math.max(1, Math.round(r.width * dpr));
    var h = Math.max(1, Math.round(r.height * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    var ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx: ctx, w: r.width, h: r.height };
  }

  // ---- 1. bite-able snack: eat it, and a fresh one comes out of the oven ----
  (function snack() {
    var btn = document.getElementById('cookie');
    var stage = document.querySelector('.cookie-stage');
    if (!btn || !stage) return;
    var NS = 'http://www.w3.org/2000/svg';
    var art = btn.querySelector('.snack-art');
    var holes = btn.querySelector('.bite-holes');
    var rims = btn.querySelector('.bite-rims');
    var countBox = document.getElementById('bite-count');
    var srLabel = btn.querySelector('.snack-label');

    // [angle (deg, 0 = right, clockwise), distance from centre, radius] in the
    // 200x200 snack. Nine bites finish any snack.
    var BITES = [
      [40, 96, 30], [140, 96, 31], [205, 94, 29], [275, 96, 28],
      [95, 90, 30], [-10, 66, 32], [178, 60, 34], [250, 40, 40], [60, 34, 44]
    ];

    // Small seeded random so every batch of a snack looks the same.
    function rng(seed) {
      return function () { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
    }
    function pt(a, r) { return (100 + Math.cos(a) * r).toFixed(1) + ' ' + (100 + Math.sin(a) * r).toFixed(1); }
    function wobblyRing(outer, inner, waves, amp) {
      var d = '', i, a;
      for (i = 0; i <= 72; i++) {
        a = i / 72 * Math.PI * 2;
        d += (i ? 'L' : 'M') + pt(a, outer + Math.sin(a * waves) * amp);
      }
      // inner hole as two half arcs (a single full-circle arc draws nothing)
      return d + 'ZM' + pt(0, inner) + 'A' + inner + ' ' + inner + ' 0 1 0 ' + pt(Math.PI, inner) +
        'A' + inner + ' ' + inner + ' 0 1 0 ' + pt(0, inner) + 'Z';
    }
    function donutArt() {
      var r = rng(7), sprinkles = '', colors = ['#3b82f6', '#facc15', '#34d399', '#ffffff', '#a855f7'];
      for (var i = 0; i < 18; i++) {
        var a = i / 18 * Math.PI * 2 + r() * 0.25, d = 44 + r() * 20, t = a + 1.2 + r();
        var x = 100 + Math.cos(a) * d, y = 100 + Math.sin(a) * d;
        sprinkles += '<path d="M' + (x - Math.cos(t) * 4).toFixed(1) + ' ' + (y - Math.sin(t) * 4).toFixed(1) +
          'L' + (x + Math.cos(t) * 4).toFixed(1) + ' ' + (y + Math.sin(t) * 4).toFixed(1) + '" stroke="' + colors[i % 5] + '"/>';
      }
      return '<path d="M100 14a86 86 0 1 0 .01 0ZM100 72a28 28 0 1 1-.01 0Z" fill="#e0a05a" fill-rule="evenodd" stroke="currentColor" stroke-width="7"/>' +
        '<path d="' + wobblyRing(72, 34, 9, 4) + '" fill="#ff8fb1" fill-rule="evenodd" stroke="currentColor" stroke-width="4"/>' +
        '<path d="M50 70a56 56 0 0 1 28-26" fill="none" stroke="#ffd0de" stroke-width="7" stroke-linecap="round"/>' +
        '<g stroke-width="5" stroke-linecap="round">' + sprinkles + '</g>';
    }
    function waffleArt() {
      var lines = '';
      for (var v = 16; v <= 184; v += 26) {
        lines += '<path d="M' + v + ' 10V190M10 ' + v + 'H190"/>';
      }
      return '<circle cx="100" cy="100" r="86" fill="#e9b24f" stroke="currentColor" stroke-width="7"/>' +
        '<circle cx="100" cy="100" r="76" fill="#c98b2b"/>' +
        '<g clip-path="url(#waffle-in)" stroke="#f0c063" stroke-width="10">' + lines + '</g>' +
        '<path d="M64 52c10 8 4 20 14 28s22-2 30 8 0 24 12 30" fill="none" stroke="#8a4317" stroke-width="7" stroke-linecap="round" opacity="0.85"/>' +
        '<rect x="84" y="84" width="34" height="28" rx="5" transform="rotate(-10 101 98)" fill="#fff1a8" stroke="currentColor" stroke-width="4"/>' +
        '<path d="M90 92h14" stroke="#ffffff" stroke-width="4" stroke-linecap="round" transform="rotate(-10 101 98)"/>';
    }
    function riceCakeArt() {
      var r = rng(11), grains = '';
      for (var i = 0; i < 46; i++) {
        var a = r() * Math.PI * 2, d = Math.sqrt(r()) * 70;
        grains += '<ellipse cx="' + (100 + Math.cos(a) * d).toFixed(1) + '" cy="' + (100 + Math.sin(a) * d).toFixed(1) +
          '" rx="6" ry="4" transform="rotate(' + Math.round(r() * 180) + ' ' + (100 + Math.cos(a) * d).toFixed(1) + ' ' +
          (100 + Math.sin(a) * d).toFixed(1) + ')"/>';
      }
      return '<circle cx="100" cy="100" r="86" fill="#f6e7c1" stroke="currentColor" stroke-width="7"/>' +
        '<circle cx="100" cy="100" r="72" fill="none" stroke="#e5cf98" stroke-width="4" stroke-dasharray="2 10" stroke-linecap="round"/>' +
        '<g fill="#fffaf0" stroke="#e2c88d" stroke-width="1.6">' + grains + '</g>' +
        '<path d="M44 70a62 62 0 0 1 34-34" fill="none" stroke="#ffffff" stroke-width="7" stroke-linecap="round"/>';
    }

    var SNACKS = [
      { en: 'cookie', ko: '쿠키', emoji: '🍪', clip: 'cookie-disc', art: art.innerHTML,
        crumbs: ['#d9962a', '#f5b82e', '#3b2414', '#e39d2a'] },
      { en: 'donut', ko: '도넛', emoji: '🍩', clip: 'donut-ring', art: donutArt(),
        crumbs: ['#ff8fb1', '#e0a05a', '#3b82f6', '#facc15'] },
      { en: 'waffle', ko: '와플', emoji: '🧇', clip: 'cookie-disc', art: waffleArt(),
        crumbs: ['#e9b24f', '#c98b2b', '#fff1a8', '#f0c063'] },
      { en: 'rice cake', ko: '뻥튀기', emoji: '🍘', clip: 'cookie-disc', art: riceCakeArt(),
        crumbs: ['#f6e7c1', '#fffaf0', '#e5cf98', '#f6e7c1'] }
    ];
    var current = 0;
    var next = 0;  // index into BITES. The bite in the starting markup is decoration only.
    var busy = false;
    var taps = 0;  // bites this visit (just a toy, nothing is stored)

    function label(en, ko) {
      if (!countBox) return;
      countBox.querySelector('.l-en').innerHTML = en;
      countBox.querySelector('.l-ko').innerHTML = ko;
    }
    function setSrLabel(s) {
      if (!srLabel) return;
      srLabel.querySelector('.l-en').textContent = 'Take a bite of the ' + s.en;
      srLabel.querySelector('.l-ko').textContent = s.ko + ' 한입 먹기';
    }
    function circle(parent, cx, cy, r) {
      var c = document.createElementNS(NS, 'circle');
      c.setAttribute('cx', cx.toFixed(1));
      c.setAttribute('cy', cy.toFixed(1));
      c.setAttribute('r', r.toFixed(1));
      parent.appendChild(c);
    }
    function addBite(b) {
      var a = b[0] * Math.PI / 180;
      var x = 100 + Math.cos(a) * b[1];
      var y = 100 + Math.sin(a) * b[1];
      var a2 = a + 0.42;
      var x2 = 100 + Math.cos(a2) * (b[1] + 6);
      var y2 = 100 + Math.sin(a2) * (b[1] + 6);
      [holes, rims].forEach(function (g) {
        circle(g, x, y, b[2]);
        circle(g, x2, y2, b[2] * 0.6);
      });
      return { x: x, y: y };
    }
    function toStage(x, y) {
      var sr = stage.getBoundingClientRect();
      var br = btn.getBoundingClientRect();
      var scale = br.width / 200;
      return { x: br.left - sr.left + x * scale, y: br.top - sr.top + y * scale };
    }
    function crumbs(p) {
      if (reduced || !btn.animate) return;
      var o = toStage(p.x, p.y);
      var colors = SNACKS[current].crumbs;
      for (var i = 0; i < 12; i++) {
        var s = document.createElement('span');
        s.className = 'crumb';
        s.setAttribute('aria-hidden', 'true');
        var size = 6 + Math.random() * 9;
        s.style.cssText = 'left:' + o.x + 'px;top:' + o.y + 'px;width:' + size + 'px;height:' + size +
          'px;background:' + colors[i % colors.length];
        stage.appendChild(s);
        var spin = (Math.random() - 0.5) * 2;
        var dir = Math.atan2(p.y - 100, p.x - 100) + (Math.random() - 0.5) * 1.6;
        var dist = 50 + Math.random() * 90;
        var dx = Math.cos(dir) * dist;
        var dy = Math.sin(dir) * dist;
        var anim = s.animate([
          { transform: 'translate(0,0) rotate(0deg)', opacity: 1 },
          { transform: 'translate(' + dx * 0.7 + 'px,' + (dy * 0.7 - 30) + 'px) rotate(' + spin * 200 + 'deg)', opacity: 1, offset: 0.45 },
          { transform: 'translate(' + dx + 'px,' + (dy + 90) + 'px) rotate(' + spin * 400 + 'deg)', opacity: 0 }
        ], { duration: 700 + Math.random() * 400, easing: 'cubic-bezier(.2,.6,.4,1)' });
        anim.onfinish = (function (el) { return function () { el.remove(); }; })(s);
      }
    }
    function steam() {
      if (reduced || !btn.animate) return;
      for (var i = 0; i < 3; i++) {
        var o = toStage(66 + i * 34, -6 + (i % 2) * 8);
        var s = document.createElement('span');
        s.className = 'steam';
        s.setAttribute('aria-hidden', 'true');
        s.style.left = o.x + 'px';
        s.style.top = o.y + 'px';
        stage.appendChild(s);
        var anim = s.animate([
          { transform: 'translate(-50%, 0) scale(0.4)', opacity: 0 },
          { transform: 'translate(-50%, -22px) scale(1)', opacity: 0.9, offset: 0.35 },
          { transform: 'translate(calc(-50% + ' + (i - 1) * 10 + 'px), -64px) scale(1.5)', opacity: 0 }
        ], { duration: 1300, delay: 250 + i * 160, easing: 'ease-out', fill: 'backwards' });
        anim.onfinish = (function (el) { return function () { el.remove(); }; })(s);
      }
    }
    function bump(cls) {
      btn.classList.remove('is-chomp', 'is-rebake', 'is-gone');
      void btn.offsetWidth; // restart the CSS animation
      btn.classList.add(cls);
    }
    function serve() {
      current = (current + 1) % SNACKS.length;
      var s = SNACKS[current];
      art.innerHTML = s.art;
      holes.innerHTML = '';
      rims.innerHTML = '';
      rims.setAttribute('clip-path', 'url(#' + s.clip + ')');
      next = 0;
      setSrLabel(s);
      label('Fresh out of the oven: ' + s.en + '! ' + s.emoji,
        '갓 구운 ' + s.ko + ' 나왔어요! ' + s.emoji);
      bump('is-rebake');
      steam();
    }

    // The starting cookie already shows one bite; start it clean when JS runs.
    holes.innerHTML = '';
    rims.innerHTML = '';
    addBite([-40, 96, 30]);

    btn.addEventListener('click', function () {
      if (busy) return;
      var p = addBite(BITES[next]);
      next++;
      taps++;
      label('Nom nom ×<b>' + taps + '</b>', '냠냠 ×<b>' + taps + '</b>');
      bump('is-chomp');
      crumbs(p);
      if (next < BITES.length) return;
      // All gone: a short pause on the empty plate, then the next snack.
      busy = true;
      setTimeout(function () { bump('is-gone'); }, reduced ? 0 : 250);
      setTimeout(function () {
        serve();
        busy = false;
      }, reduced ? 150 : 700);
    });
  })();

  // ---- 3. floating stickers: pointer + scroll parallax ----------------------
  (function floaters() {
    var stage = document.querySelector('.cookie-stage');
    var els = document.querySelectorAll('.floater');
    if (!stage || !els.length) return;
    var target = { x: 0, y: 0 };
    var cur = { x: 0, y: 0 };
    var lastScroll = -1;
    var settled = false;

    window.addEventListener('pointermove', function (e) {
      if (e.pointerType === 'touch') return;
      target.x = (e.clientX / window.innerWidth) * 2 - 1;
      target.y = (e.clientY / window.innerHeight) * 2 - 1;
      settled = false;
      wake();
    }, { passive: true });
    window.addEventListener('scroll', function () { settled = false; wake(); }, { passive: true });

    tasks.push({
      active: function () { return !reduced && !settled && isVisible(stage); },
      tick: function () {
        cur.x += (target.x - cur.x) * 0.08;
        cur.y += (target.y - cur.y) * 0.08;
        var sy = window.scrollY;
        for (var i = 0; i < els.length; i++) {
          var d = parseFloat(els[i].getAttribute('data-depth')) || 1;
          els[i].style.setProperty('--px', (cur.x * d * -14).toFixed(2) + 'px');
          els[i].style.setProperty('--py', (cur.y * d * -14 - sy * d * 0.12).toFixed(2) + 'px');
        }
        if (Math.abs(target.x - cur.x) < 0.002 && Math.abs(target.y - cur.y) < 0.002 && sy === lastScroll) {
          settled = true;
        }
        lastScroll = sy;
      }
    });
  })();

  // ---- 6. Mocoder card: live sine wave that bends with the pointer ----------
  (function moWave() {
    var card = document.getElementById('mocoder-card');
    var panel = card && card.querySelector('.wave-panel');
    var canvas = panel && panel.querySelector('canvas');
    if (!canvas || !canvas.getContext) return;
    panel.classList.add('is-live');
    var g = sizeCanvas(canvas);
    var target = { f: 2.2, a: 0.5 };
    var cur = { f: 2.2, a: 0.5 };
    var phase = 0;
    var last = 0;
    var dirty = true;
    watch(panel);

    if ('ResizeObserver' in window) {
      new ResizeObserver(function () { g = sizeCanvas(canvas); dirty = true; wake(); }).observe(canvas);
    }
    card.addEventListener('pointermove', function (e) {
      var r = panel.getBoundingClientRect();
      var cr = card.getBoundingClientRect();
      var px = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
      var py = Math.min(1, Math.max(0, (e.clientY - cr.top) / cr.height));
      // like pitch: further right / higher up = more cycles
      target.f = 1.2 + px * 4.5 + (1 - py) * 1.5;
      target.a = 0.35 + (1 - py) * 0.5;
      dirty = true;
      wake();
    });
    card.addEventListener('pointerleave', function () {
      target.f = 2.2; target.a = 0.5; dirty = true; wake();
    });

    function draw() {
      var ctx = g.ctx, w = g.w, h = g.h;
      ctx.clearRect(0, 0, w, h);
      var mid = h / 2;
      var amp = cur.a * h * 0.38;
      var grad = ctx.createLinearGradient(0, 0, w, 0);
      grad.addColorStop(0, '#38bdf8');
      grad.addColorStop(1, '#a855f7');
      var passes = [[14, 0.12], [7, 0.28], [2.5, 1]];
      for (var p = 0; p < passes.length; p++) {
        ctx.beginPath();
        for (var x = 0; x <= w; x += 3) {
          var t = x / w;
          var env = Math.sin(Math.PI * t) * 0.85 + 0.15;
          var y = mid + Math.sin(t * Math.PI * 2 * cur.f + phase) * amp * env;
          if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = p === 2 ? '#e0f2fe' : grad;
        ctx.globalAlpha = passes[p][1];
        ctx.lineWidth = passes[p][0];
        ctx.lineCap = 'round';
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    draw(); // first frame right away, even before it scrolls into view

    tasks.push({
      active: function () { return isVisible(panel) && (!reduced || dirty); },
      tick: function (now) {
        var dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016;
        last = now;
        cur.f += (target.f - cur.f) * 0.12;
        cur.a += (target.a - cur.a) * 0.12;
        if (!reduced) phase -= dt * (1.5 + cur.f * 0.8);
        draw();
        if (reduced && Math.abs(target.f - cur.f) < 0.01 && Math.abs(target.a - cur.a) < 0.005) dirty = false;
      }
    });
  })();

  // ---- 5. next-snack oven timer (next Friday 18:00 KST = 09:00 UTC) --------
  (function ovenTimer() {
    var box = document.getElementById('oven-timer');
    var done = document.getElementById('oven-done');
    if (!box) return;
    var parts = {
      d: box.querySelector('[data-t="d"]'),
      h: box.querySelector('[data-t="h"]'),
      m: box.querySelector('[data-t="m"]'),
      s: box.querySelector('[data-t="s"]')
    };
    var SNACK_HOUR_MS = 60 * 60 * 1000; // show "snack time" for an hour
    var lastSec = -1;
    var card = box.closest('.app-card') || box;
    watch(card);

    function nextSnack(now) {
      var t = new Date(now);
      t.setUTCHours(9, 0, 0, 0);
      t.setUTCDate(t.getUTCDate() + ((5 - t.getUTCDay() + 7) % 7));
      if (t.getTime() <= now - SNACK_HOUR_MS) t.setUTCDate(t.getUTCDate() + 7);
      return t.getTime();
    }
    function pad(n) { return n < 10 ? '0' + n : String(n); }
    function render() {
      var now = Date.now();
      var sec = Math.floor(now / 1000);
      if (sec === lastSec) return;
      lastSec = sec;
      var diff = nextSnack(now) - now;
      var isNow = diff <= 0;
      if (done) done.hidden = !isNow;
      box.hidden = isNow;
      if (isNow) return;
      var s = Math.floor(diff / 1000);
      parts.d.textContent = Math.floor(s / 86400);
      parts.h.textContent = pad(Math.floor(s / 3600) % 24);
      parts.m.textContent = pad(Math.floor(s / 60) % 60);
      parts.s.textContent = pad(s % 60);
    }
    render();
    tasks.push({
      active: function () { return isVisible(card); },
      tick: render
    });
  })();

  wake();
})();
