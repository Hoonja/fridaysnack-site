// FridaySnack home page toys: bite-able cookie, floating snack parallax,
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

  // ---- 1. bite-able cookie ---------------------------------------------------
  (function cookie() {
    var btn = document.getElementById('cookie');
    var stage = document.querySelector('.cookie-stage');
    if (!btn || !stage) return;
    var NS = 'http://www.w3.org/2000/svg';
    var holes = btn.querySelector('.bite-holes');
    var rims = btn.querySelector('.bite-rims');
    var counters = document.querySelectorAll('[data-bites]');
    var countBox = document.getElementById('bite-count');

    // [angle (deg, 0 = right, clockwise), distance from centre, radius] in the
    // 200x200 cookie. The bite already in the markup counts as bite 1.
    var BITES = [
      [40, 96, 30], [140, 96, 31], [205, 94, 29], [275, 96, 28],
      [95, 90, 30], [-10, 66, 32], [178, 60, 34], [250, 40, 40], [60, 34, 44]
    ];
    var bites = 1;
    var busy = false;

    function setCount(n, fresh) {
      for (var i = 0; i < counters.length; i++) counters[i].textContent = n;
      if (fresh && countBox) {
        countBox.querySelector('.l-en').innerHTML = 'Fresh cookie! bites: <b data-bites>0</b>';
        countBox.querySelector('.l-ko').innerHTML = '새로 구웠어요! 먹은 횟수: <b data-bites>0</b>';
        counters = document.querySelectorAll('[data-bites]');
      }
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
    function crumbs(pt) {
      if (reduced || !btn.animate) return;
      var sr = stage.getBoundingClientRect();
      var br = btn.getBoundingClientRect();
      var scale = br.width / 200;
      var ox = br.left - sr.left + pt.x * scale;
      var oy = br.top - sr.top + pt.y * scale;
      var colors = ['#d9962a', '#f5b82e', '#3b2414', '#e39d2a'];
      for (var i = 0; i < 12; i++) {
        var s = document.createElement('span');
        s.className = 'crumb';
        s.setAttribute('aria-hidden', 'true');
        var size = 6 + Math.random() * 9;
        s.style.cssText = 'left:' + ox + 'px;top:' + oy + 'px;width:' + size + 'px;height:' + size +
          'px;background:' + colors[i % colors.length];
        stage.appendChild(s);
        var spin = (Math.random() - 0.5) * 2;
        var dir = Math.atan2(pt.y - 100, pt.x - 100) + (Math.random() - 0.5) * 1.6;
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
    function bump(cls) {
      btn.classList.remove('is-chomp', 'is-rebake');
      void btn.offsetWidth; // restart the CSS animation
      btn.classList.add(cls);
    }

    btn.addEventListener('click', function () {
      if (busy) return;
      if (bites - 1 < BITES.length) {
        var pt = addBite(BITES[bites - 1]);
        bites++;
        setCount(bites);
        bump('is-chomp');
        crumbs(pt);
      }
      if (bites - 1 >= BITES.length) {
        // All gone: re-bake a fresh one with a pop.
        busy = true;
        setTimeout(function () {
          holes.innerHTML = '';
          rims.innerHTML = '';
          bites = 0;
          setCount(0, true);
          bump('is-rebake');
          busy = false;
        }, reduced ? 150 : 450);
      }
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
