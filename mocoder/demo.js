// Mocoder "Try it" mini theremin. Vanilla JS, loaded with defer.
// One sine oscillator runs the whole time; sound is gated with the gain
// (0 -> 0.15 in 30 ms on press, -> 0 in 80 ms on release) so there are no
// clicks. The AudioContext is created and resumed only inside a user gesture.
// One requestAnimationFrame loop draws the wave and the tuner readout and runs
// only while the pad is on screen and the tab is visible.
(function () {
  'use strict';

  var LOW_HZ = 220;       // bottom of the pad (A3)
  var OCTAVES = 2;        // top of the pad = 880 Hz (A5)
  var PEAK = 0.15;        // gain while playing
  var ATTACK = 0.03;      // s
  var RELEASE = 0.08;     // s
  var IN_TUNE = 10;       // cents
  var NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];

  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function logToHz(l) { return LOW_HZ * Math.pow(2, l); }

  /** Nearest equal-tempered note (A4 = 440 Hz) and the offset in cents. */
  function freqToNote(hz) {
    var midi = 69 + 12 * Math.log2(hz / 440);
    var n = Math.round(midi);
    var cents = Math.round((midi - n) * 100);
    if (cents === 0) cents = 0; // no "-0"
    return { name: NAMES[((n % 12) + 12) % 12] + (Math.floor(n / 12) - 1), cents: cents, midi: n };
  }
  // Exposed so the note maths can be checked from the console or a test.
  window.MocoderDemo = { freqToNote: freqToNote, logToHz: logToHz };

  var pad = document.getElementById('demo-pad');
  if (!pad) return;
  var canvas = pad.querySelector('canvas');
  var readout = document.getElementById('demo-readout');
  var noteEl = document.getElementById('demo-note');
  var hzEl = document.getElementById('demo-hz');
  var centsEl = document.getElementById('demo-cents');
  var needle = document.getElementById('demo-needle');
  var statusEl = document.getElementById('demo-status');
  var tiltBtn = document.getElementById('tilt-btn');
  var snapBtn = document.getElementById('snap-btn');

  var reduceMQ = window.matchMedia('(prefers-reduced-motion: reduce)');
  var reduced = reduceMQ.matches;
  if (reduceMQ.addEventListener) reduceMQ.addEventListener('change', function (e) { reduced = e.matches; wake(); });

  // ---- state -------------------------------------------------------------------
  var targetLog = 1;          // 0..OCTAVES, 1 = 440 Hz
  var shownLog = 1;           // smoothed for the readout / wave
  var level = 0;              // visual envelope 0..1
  var holders = { pointer: false, key: false };
  var activePointer = null;
  var finger = null;          // {x, y} in CSS px while pressing
  var tiltOn = false;
  var tiltLog = 1;
  var gotTilt = false;
  var snapOn = false;         // round the sounding pitch to the nearest semitone
  var dirty = true;

  // ---- audio -------------------------------------------------------------------
  var ctx = null, osc = null, gain = null;

  function ensureAudio() {
    if (!ctx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) { say('Sorry, this browser cannot play Web Audio.', '이 브라우저는 Web Audio를 지원하지 않아요.'); return false; }
      // iOS 17+: let the demo play like media (it still follows the volume).
      try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) { /* ignore */ }
      ctx = new AC();
      osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = logToHz(targetLog);
      gain = ctx.createGain();
      gain.gain.value = 0;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
    }
    if (ctx.state !== 'running' && ctx.resume) ctx.resume().catch(function () {});
    return true;
  }
  function rampTo(value, seconds) {
    if (!ctx) return;
    var t = ctx.currentTime;
    var g = gain.gain;
    if (g.cancelAndHoldAtTime) {
      g.cancelAndHoldAtTime(t);
    } else {
      var v = g.value;
      g.cancelScheduledValues(t);
      g.setValueAtTime(v, t);
    }
    g.linearRampToValueAtTime(value, t + seconds);
  }
  function applyFreq() {
    if (!ctx) return;
    osc.frequency.setTargetAtTime(logToHz(soundLog(targetLog)), ctx.currentTime, 0.012);
  }

  function isPlaying() { return holders.pointer || holders.key; }
  function start(who) {
    var was = isPlaying();
    holders[who] = true;
    if (!ensureAudio()) return;
    applyFreq();
    if (!was) {
      rampTo(PEAK, ATTACK);
      pad.classList.add('is-playing');
    }
    wake();
  }
  function stop(who) {
    if (!holders[who]) return;
    holders[who] = false;
    if (isPlaying()) return;
    rampTo(0, RELEASE);
    pad.classList.remove('is-playing');
    finger = null;
    wake();
  }
  function stopAll() {
    activePointer = null;
    stop('pointer');
    stop('key');
  }

  // ---- pitch -------------------------------------------------------------------
  // Snap: the sound and note/Hz follow the nearest semitone (A notes sit on whole
  // twelfths of the 220 Hz log scale); the needle keeps showing the raw hand pitch.
  function soundLog(l) { return snapOn ? Math.round(l * 12) / 12 : l; }
  var lastAria = '';
  function setTarget(l) {
    targetLog = clamp(l, 0, OCTAVES);
    applyFreq();
    var hz = logToHz(soundLog(targetLog));
    var n = freqToNote(hz);
    var text = n.name + ', ' + Math.round(hz) + ' Hz';
    if (text !== lastAria) {
      lastAria = text;
      pad.setAttribute('aria-valuenow', String(Math.round(hz)));
      pad.setAttribute('aria-valuetext', text);
    }
    dirty = true;
    wake();
  }
  function fromPointer(e) {
    var r = pad.getBoundingClientRect();
    var x = clamp(e.clientX - r.left, 0, r.width);
    var y = clamp(e.clientY - r.top, 0, r.height);
    finger = { x: x, y: y };
    if (tiltOn) { dirty = true; wake(); return; }
    var py = 1 - y / r.height;              // 0 bottom .. 1 top
    var fine = (x / r.width - 0.5) / 6;     // +-1 semitone across the width
    setTarget(py * OCTAVES + fine);
  }

  // ---- input: pointer ----------------------------------------------------------
  pad.addEventListener('pointerdown', function (e) {
    if (e.button > 0) return;
    e.preventDefault();
    activePointer = e.pointerId;
    try { pad.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    fromPointer(e);
    start('pointer');
  });
  pad.addEventListener('pointermove', function (e) {
    if (e.pointerId === activePointer) fromPointer(e);
  });
  function pointerEnd(e) {
    if (e.pointerId !== activePointer) return;
    activePointer = null;
    // Some browsers only count pointerup as a user gesture: resume here too.
    if (ctx && ctx.state !== 'running') ctx.resume().catch(function () {});
    stop('pointer');
  }
  pad.addEventListener('pointerup', pointerEnd);
  pad.addEventListener('pointercancel', pointerEnd);
  pad.addEventListener('lostpointercapture', pointerEnd);
  pad.addEventListener('contextmenu', function (e) { e.preventDefault(); });

  // ---- input: keyboard ---------------------------------------------------------
  pad.addEventListener('keydown', function (e) {
    var k = e.key;
    var semis = Math.round(targetLog * 12);
    if (k === ' ' || k === 'Spacebar' || k === 'Enter') {
      e.preventDefault();
      if (!e.repeat) start('key');
      return;
    }
    var next = null;
    if (k === 'ArrowUp') next = (semis + 1) / 12;
    else if (k === 'ArrowDown') next = (semis - 1) / 12;
    else if (k === 'ArrowRight') next = targetLog + 1 / 120;   // +10 cents
    else if (k === 'ArrowLeft') next = targetLog - 1 / 120;
    else if (k === 'PageUp') next = (semis + 12) / 12;
    else if (k === 'PageDown') next = (semis - 12) / 12;
    else if (k === 'Home') next = 0;
    else if (k === 'End') next = OCTAVES;
    if (next === null) return;
    e.preventDefault();
    tiltOff();
    setTarget(next);
  });
  pad.addEventListener('keyup', function (e) {
    if (e.key === ' ' || e.key === 'Spacebar' || e.key === 'Enter') stop('key');
  });
  pad.addEventListener('blur', function () { stop('key'); });
  window.addEventListener('blur', stopAll);
  window.addEventListener('pagehide', stopAll);
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) stopAll();
    else wake();
  });

  // ---- option: snap to semitones ----------------------------------------------
  if (snapBtn) {
    snapBtn.hidden = false;
    snapBtn.addEventListener('click', function () {
      snapOn = !snapOn;
      snapBtn.setAttribute('aria-pressed', snapOn ? 'true' : 'false');
      say(snapOn ? 'Snap is on. The pitch jumps to the nearest note.' : 'Snap is off. The pitch glides freely.',
          snapOn ? '반음 스냅 켜짐. 가장 가까운 음으로 맞춰져요.' : '반음 스냅 꺼짐. 음이 자유롭게 미끄러져요.');
      setTarget(targetLog);
    });
  }

  // ---- input: tilt (optional, phones) -------------------------------------------
  function say(en, ko) {
    statusEl.innerHTML = '<span class="l-en" lang="en">' + en + '</span><span class="l-ko" lang="ko">' + ko + '</span>';
  }
  function onOrient(e) {
    if (e.beta === null || e.beta === undefined) return;
    gotTilt = true;
    // Flat on the table (0 deg) = low, held upright (90 deg) = high.
    var l = (clamp(e.beta, 10, 80) - 10) / 70 * OCTAVES;
    tiltLog += (l - tiltLog) * 0.3;
    setTarget(tiltLog);
  }
  function tiltEnable() {
    tiltOn = true;
    gotTilt = false;
    tiltLog = targetLog;
    window.addEventListener('deviceorientation', onOrient);
    tiltBtn.setAttribute('aria-pressed', 'true');
    say('Tilt is on. Hold the pad and tilt the phone up or down.', '기울기 켜짐. 패드를 누른 채 폰을 위아래로 기울여 보세요.');
    setTimeout(function () {
      if (tiltOn && !gotTilt) {
        tiltOff();
        say('No tilt sensor data here. Slide on the pad instead.', '기울기 센서 값이 없어요. 패드를 밀어서 연주해 주세요.');
      }
    }, 1500);
  }
  function tiltOff() {
    if (!tiltOn) return;
    tiltOn = false;
    window.removeEventListener('deviceorientation', onOrient);
    tiltBtn.setAttribute('aria-pressed', 'false');
    say('Tilt is off.', '기울기 꺼짐.');
  }
  var coarse = window.matchMedia('(pointer: coarse)').matches;
  if (tiltBtn && coarse && 'DeviceOrientationEvent' in window) {
    tiltBtn.hidden = false;
    tiltBtn.addEventListener('click', function () {
      if (tiltOn) { tiltOff(); return; }
      var DOE = window.DeviceOrientationEvent;
      if (typeof DOE.requestPermission === 'function') {
        // iOS 13+: must be called from this click.
        DOE.requestPermission().then(function (state) {
          if (state === 'granted') tiltEnable();
          else say('Motion access was not allowed. You can still slide on the pad.', '모션 접근이 허용되지 않았어요. 패드를 밀어서 연주할 수 있어요.');
        }).catch(function () {
          say('Motion access is not available here.', '여기서는 모션 접근을 쓸 수 없어요.');
        });
      } else {
        tiltEnable();
      }
    });
  }

  // ---- drawing -----------------------------------------------------------------
  var g = null;
  function sizeCanvas() {
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    var r = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.round(r.width * dpr));
    canvas.height = Math.max(1, Math.round(r.height * dpr));
    var c = canvas.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    g = { ctx: c, w: r.width, h: r.height };
    dirty = true;
  }
  sizeCanvas();
  if ('ResizeObserver' in window) new ResizeObserver(function () { sizeCanvas(); wake(); }).observe(pad);
  else window.addEventListener('resize', function () { sizeCanvas(); wake(); });

  function yFor(l) { return (1 - l / OCTAVES) * g.h; }

  var phase = 0;
  function draw() {
    var c = g.ctx, w = g.w, h = g.h;
    c.clearRect(0, 0, w, h);

    // semitone guide lines, A notes labelled
    c.font = '600 11px ui-monospace, Menlo, monospace';
    c.textBaseline = 'middle';
    for (var k = 0; k <= OCTAVES * 12; k++) {
      var y = yFor(k / 12);
      var isA = k % 12 === 0;
      c.fillStyle = isA ? 'rgba(201,196,255,0.32)' : 'rgba(201,196,255,0.08)';
      c.fillRect(0, Math.round(y) - (isA ? 1 : 0), w, isA ? 2 : 1);
      if (isA) {
        c.fillStyle = 'rgba(220,216,245,0.85)';
        c.fillText('A' + (3 + k / 12), 10, clamp(y, 10, h - 10) + (k === 0 ? -8 : k === OCTAVES * 12 ? 8 : -8));
      }
    }

    var cy = yFor(shownLog);
    var hzNorm = shownLog / OCTAVES;                 // 0..1
    var cycles = 2.5 + hzNorm * 7;
    var amp = 6 + level * Math.min(46, h * 0.13);

    // pitch band glow
    if (level > 0.01) {
      var band = c.createLinearGradient(0, cy - 40, 0, cy + 40);
      band.addColorStop(0, 'rgba(56,189,248,0)');
      band.addColorStop(0.5, 'rgba(125,211,252,' + (0.22 * level).toFixed(3) + ')');
      band.addColorStop(1, 'rgba(168,85,247,0)');
      c.fillStyle = band;
      c.fillRect(0, cy - 40, w, 80);
    }

    // the wave, three passes for a glow
    var grad = c.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0, '#38bdf8');
    grad.addColorStop(0.5, '#a5b4fc');
    grad.addColorStop(1, '#a855f7');
    var passes = [[16, 0.1 + 0.15 * level], [7, 0.25 + 0.3 * level], [2.5, 0.55 + 0.45 * level]];
    for (var p = 0; p < passes.length; p++) {
      c.beginPath();
      for (var x = 0; x <= w; x += 3) {
        var t = x / w;
        var yy = cy + Math.sin(t * Math.PI * 2 * cycles + phase) * amp * (0.35 + 0.65 * Math.sin(Math.PI * t));
        if (x === 0) c.moveTo(x, yy); else c.lineTo(x, yy);
      }
      c.strokeStyle = p === 2 ? '#f0f9ff' : grad;
      c.globalAlpha = passes[p][1];
      c.lineWidth = passes[p][0];
      c.lineJoin = 'round';
      c.stroke();
    }
    c.globalAlpha = 1;

    // finger marker
    if (finger) {
      c.beginPath();
      c.arc(finger.x, finger.y, 22, 0, Math.PI * 2);
      c.strokeStyle = 'rgba(240,249,255,0.7)';
      c.lineWidth = 2;
      c.stroke();
    }
  }

  var lastNote = '', lastHz = '', lastCents = null;
  function updateReadout() {
    var hz = logToHz(shownLog);
    var n = freqToNote(hz);
    var name = n.name;
    if (snapOn) {
      hz = logToHz(soundLog(shownLog));
      name = freqToNote(hz).name;
    }
    var hzText = hz.toFixed(1) + ' Hz';
    if (name !== lastNote) { noteEl.textContent = name; lastNote = name; }
    if (hzText !== lastHz) { hzEl.textContent = hzText; lastHz = hzText; }
    if (n.cents !== lastCents) {
      lastCents = n.cents;
      centsEl.textContent = (n.cents > 0 ? '+' : '') + n.cents + '¢';
      needle.setAttribute('transform', 'rotate(' + (n.cents * 1.1).toFixed(1) + ' 60 30)');
      var ok = Math.abs(n.cents) <= IN_TUNE;
      readout.classList.toggle('in-tune', ok);
      needle.setAttribute('stroke', ok ? '#86efac' : '#fca5a5');
    }
  }

  // ---- loop --------------------------------------------------------------------
  var onScreen = true;
  var rafId = 0;
  var last = 0;
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      onScreen = entries[0].isIntersecting;
      if (onScreen) wake();
    }, { rootMargin: '60px' }).observe(pad);
  }
  var themes = document.querySelector('.themes[data-anim]');
  if (themes && 'IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      themes.classList.toggle('is-paused', !entries[0].isIntersecting);
    }).observe(themes);
  }

  function frame(now) {
    rafId = 0;
    var dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016;
    last = now;
    var goal = isPlaying() ? 1 : 0;
    level += (goal - level) * (goal ? 0.35 : 0.18);
    if (Math.abs(goal - level) < 0.002) level = goal;
    shownLog += (targetLog - shownLog) * 0.3;
    if (Math.abs(targetLog - shownLog) < 0.0004) shownLog = targetLog;
    if (!reduced) phase -= dt * (2 + 4 * level) * (0.6 + shownLog);
    draw();
    updateReadout();
    var settling = level !== goal || shownLog !== targetLog;
    dirty = false;
    if (onScreen && !document.hidden && (!reduced || settling)) {
      rafId = requestAnimationFrame(frame);
    } else {
      last = 0;
    }
  }
  function wake() {
    if (!rafId && onScreen && !document.hidden) rafId = requestAnimationFrame(frame);
  }
  wake();
})();
