/* Cresco — scroll reveal + mobile navigation. No dependencies. */
(function () {
  'use strict';

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* --- announcement bar -------------------------------------------------- */
  var announce = document.getElementById('announce');
  var announceClose = document.querySelector('.announce__close');
  if (announce && announceClose) {
    announceClose.addEventListener('click', function () {
      announce.style.display = 'none';
      try { localStorage.setItem('cresco-announce-dismissed', '1'); } catch (e) {}
    });
  }

  /* --- hero title typewriter --------------------------------------------- */
  var typeEl = document.querySelector('.type');

  if (typeEl && !reduced) {
    // capture the original nodes (text + any <br> line breaks) before
    // clearing, so forced line breaks in the markup survive the rebuild
    var sourceNodes = Array.prototype.slice.call(typeEl.childNodes);
    typeEl.textContent = '';
    var chars = [];

    sourceNodes.forEach(function (node) {
      if (node.nodeName === 'BR') {
        chars.push(typeEl.appendChild(document.createElement('br')));
      } else {
        Array.prototype.forEach.call(node.textContent, function (ch) {
          var span = document.createElement('span');
          span.className = 'char';
          span.textContent = ch === ' ' ? '\u00A0' : ch;
          typeEl.appendChild(span);
          chars.push(span);
        });
      }
    });

    var cursor = document.createElement('span');
    cursor.className = 'type-cursor is-on';
    cursor.setAttribute('aria-hidden', 'true');
    typeEl.insertBefore(cursor, chars[0]);

    var i = 0;
    function typeNext() {
      if (i >= chars.length) {
        window.setTimeout(function () {
          cursor.classList.remove('is-on');
        }, 900);
        return;
      }
      var node = chars[i];
      if (node.nodeName !== 'BR') node.classList.add('is-shown');
      typeEl.insertBefore(cursor, node.nextSibling);
      i++;
      window.setTimeout(typeNext, node.nodeName === 'BR' ? 90 : 16 + Math.random() * 28);
    }
    window.setTimeout(typeNext, 300);
  }

  /* --- reveal on scroll ------------------------------------------------ */
  var targets = document.querySelectorAll('.reveal');

  if (reduced || !('IntersectionObserver' in window)) {
    Array.prototype.forEach.call(targets, function (el) {
      el.classList.add('is-in');
    });
  } else {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        observer.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });

    Array.prototype.forEach.call(targets, function (el) {
      observer.observe(el);
    });
  }

  /* --- scroll-linked marquee -------------------------------------------- */
  var tracks = document.querySelectorAll('[data-marquee-track]');

  if (tracks.length && !reduced) {
    var state = Array.prototype.map.call(tracks, function (track) {
      return { track: track, section: track.closest('.marquee-section'), max: 0 };
    });

    var measure = function () {
      state.forEach(function (s) {
        s.max = Math.max(0, s.track.scrollWidth - s.section.clientWidth);
      });
    };

    var apply = function () {
      var vh = window.innerHeight;
      state.forEach(function (s) {
        var rect = s.section.getBoundingClientRect();
        var progress = (vh - rect.top) / (vh + rect.height);
        progress = Math.min(1, Math.max(0, progress));
        s.track.style.transform = 'translateX(-' + (progress * s.max) + 'px)';
      });
      ticking = false;
    };

    var ticking = false;
    var onScroll = function () {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(apply);
    };

    measure();
    apply();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', function () { measure(); apply(); });
  }

  /* --- cursor water ripple -----------------------------------------------
     A ripple is spawned on pointer move / touch / click: a set of
     concentric rings that grow and fade like a drop hitting water, drawn on
     a canvas overlay (multiply blend, monochrome, on-brand). Purely a
     visual overlay — it never touches the DOM, so page text and images are
     never distorted. No dependencies. */
  if (!reduced && window.matchMedia('(pointer: fine), (pointer: coarse)').matches) {
    var canvas = document.createElement('canvas');
    canvas.className = 'cursor-fx';
    canvas.setAttribute('aria-hidden', 'true');
    document.body.appendChild(canvas);
    var ctx = canvas.getContext('2d');

    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var ripples = [];
    var MAX_RIPPLES = 30;
    var SPAWN_DIST = 28;      // min px moved before a new ripple spawns
    var LIFESPAN = 1100;      // ms
    var lastX = null, lastY = null;

    function resize() {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = window.innerWidth + 'px';
      canvas.style.height = window.innerHeight + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener('resize', resize);

    function spawn(x, y, strong) {
      if (ripples.length >= MAX_RIPPLES) ripples.shift();
      ripples.push({
        x: x, y: y, born: performance.now(),
        maxR: strong ? 120 + Math.random() * 30 : 58 + Math.random() * 24,
        startAlpha: strong ? 0.45 : 0.24
      });
    }

    function maybeSpawn(x, y) {
      if (lastX === null) { lastX = x; lastY = y; return; }
      var dx = x - lastX, dy = y - lastY;
      if (Math.sqrt(dx * dx + dy * dy) >= SPAWN_DIST) {
        spawn(x, y, false);
        lastX = x; lastY = y;
      }
    }

    window.addEventListener('pointermove', function (e) {
      maybeSpawn(e.clientX, e.clientY);
    }, { passive: true });

    window.addEventListener('pointerdown', function (e) {
      spawn(e.clientX, e.clientY, true);
      lastX = e.clientX; lastY = e.clientY;
    }, { passive: true });

    var fgColor = getComputedStyle(document.documentElement).getPropertyValue('--fg').trim() || '#111111';

    // a real drop produces a leading wave plus one or two fainter, slower
    // trailing rings behind it — this is what reads as "water" rather than
    // a single expanding circle.
    var WAVES = [
      { delay: 0, radiusMul: 1, alphaMul: 1, widthMul: 1 },
      { delay: 90, radiusMul: 0.72, alphaMul: 0.55, widthMul: 0.8 },
      { delay: 200, radiusMul: 0.46, alphaMul: 0.32, widthMul: 0.6 }
    ];

    function tick(now) {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      ctx.globalCompositeOperation = 'multiply';

      ripples = ripples.filter(function (r) {
        return (now - r.born) < LIFESPAN + WAVES[WAVES.length - 1].delay;
      });

      ripples.forEach(function (r) {
        WAVES.forEach(function (w) {
          var t = (now - r.born - w.delay) / LIFESPAN;
          if (t < 0 || t >= 1) return;
          var eased = 1 - Math.pow(1 - t, 3);
          var radius = (3 + eased * r.maxR) * w.radiusMul;
          var alpha = r.startAlpha * w.alphaMul * (1 - t);

          ctx.beginPath();
          ctx.arc(r.x, r.y, radius, 0, Math.PI * 2);
          ctx.strokeStyle = fgColor;
          ctx.globalAlpha = alpha;
          ctx.lineWidth = Math.max(0.5, 2.2 * w.widthMul * (1 - t));
          ctx.stroke();
        });
      });

      ctx.globalAlpha = 1;
      window.requestAnimationFrame(tick);
    }
    window.requestAnimationFrame(tick);
  }

  /* --- mobile navigation ----------------------------------------------- */
  var toggle = document.querySelector('.nav__toggle');
  var overlay = document.querySelector('.nav__overlay');
  if (!toggle || !overlay) return;

  function setOpen(open) {
    document.body.classList.toggle('nav-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.textContent = open ? 'Close' : 'Menu';
  }

  toggle.addEventListener('click', function () {
    setOpen(!document.body.classList.contains('nav-open'));
  });

  overlay.addEventListener('click', function (e) {
    if (e.target.tagName === 'A') setOpen(false);
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') setOpen(false);
  });

  window.addEventListener('resize', function () {
    if (window.innerWidth > 860) setOpen(false);
  });
})();
