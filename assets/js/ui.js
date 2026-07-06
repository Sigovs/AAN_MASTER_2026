// ============================================================================
// AAN prototype UI behavior (shared by index.html + design-system.html).
// Loaded with `defer`. All hooks are query-guarded, so the design-system-only
// bits are no-ops on the empty index shell.
// ============================================================================
(function () {
  var root = document.documentElement;

  // -- Dropzone dragover (demo) ---------------------------------------------
  var dz = document.getElementById('ds-dropzone');
  if (dz) {
    ['dragenter', 'dragover'].forEach(function (e) {
      dz.addEventListener(e, function (ev) {
        ev.preventDefault();
        dz.classList.add('is-dragover');
      });
    });
    ['dragleave', 'drop'].forEach(function (e) {
      dz.addEventListener(e, function (ev) {
        ev.preventDefault();
        dz.classList.remove('is-dragover');
      });
    });
  }

  // -- Delegated clicks: removable chips/rows/alerts + save pins ------------
  document.addEventListener('click', function (ev) {
    var rm = ev.target.closest('.tag__remove, .dropzone-file__remove, .alert .close');
    if (rm) {
      var host = rm.closest('.tag, .dropzone-file, .alert');
      if (host) host.remove();
      return;
    }
    var pin = ev.target.closest('.car-pin[data-save]');
    if (pin) {
      pin.classList.toggle('is-active'); // save (heart) toggle
    }
  });

  // -- Mobile off-canvas demo — scoped to the mockup frame ------------------
  document.addEventListener('click', function (ev) {
    var tgl = ev.target.closest('[data-nav-demo-toggle]');
    var closer = ev.target.closest('[data-nav-demo-close]');
    var trigger = tgl || closer;
    if (!trigger) return;
    var frame = trigger.closest('.ds-frame');
    if (!frame) return;
    var panel = frame.querySelector('.nav-offcanvas--contained');
    var back = frame.querySelector('.nav-backdrop--contained');
    var toggle = frame.querySelector('.nav-toggle');
    var open = tgl ? !(panel && panel.classList.contains('is-open')) : false;
    if (panel) panel.classList.toggle('is-open', open);
    if (back) back.classList.toggle('is-open', open);
    if (toggle) toggle.classList.toggle('is-open', open); // hamburger → X
  });

  // -- Foundations swatches: live custom-property values (match active skin) -
  function refreshSwatches() {
    var cs = getComputedStyle(root);
    document.querySelectorAll('.ds-swatch').forEach(function (sw) {
      var chip = sw.querySelector('.ds-swatch__chip');
      var val = sw.querySelector('.ds-swatch__value');
      if (!chip || !val) return;
      var v = cs.getPropertyValue('--' + chip.getAttribute('data-token')).trim();
      if (v) val.textContent = v; // fixed (non-custom-prop) tokens keep their label
    });
  }

  // -- Foundations contrast: compute live WCAG ratios per skin --------------
  function hexToRgb(h) {
    h = h.trim().replace('#', '');
    if (h.length === 3) h = h.charAt(0) + h.charAt(0) + h.charAt(1) + h.charAt(1) + h.charAt(2) + h.charAt(2);
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  function relLum(rgb) {
    var a = rgb.map(function (v) {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
  }
  function contrastRatio(fg, bg) {
    var l1 = relLum(fg), l2 = relLum(bg);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  }
  function refreshContrast() {
    var cs = getComputedStyle(root);
    document.querySelectorAll('[data-contrast]').forEach(function (row) {
      var fg = cs.getPropertyValue('--' + row.getAttribute('data-fg')).trim();
      var bg = cs.getPropertyValue('--' + row.getAttribute('data-bg')).trim();
      if (!fg || !bg || fg.charAt(0) !== '#' || bg.charAt(0) !== '#') return;
      var ratio = contrastRatio(hexToRgb(fg), hexToRgb(bg));
      var sample = row.querySelector('[data-contrast-sample]');
      if (sample) { sample.style.color = fg; sample.style.background = bg; }
      var out = row.querySelector('[data-contrast-ratio]');
      if (out) {
        out.textContent = ratio.toFixed(2) + ':1 ' + (ratio >= 4.5 ? 'AA' : ratio >= 3 ? 'AA large only' : 'fail');
      }
      row.classList.toggle('is-pass', ratio >= 4.5);
      row.classList.toggle('is-fail', ratio < 4.5);
    });
  }

  // -- Font panel: name each slot's resolved family live from computed CSS ---
  function readFontNames() {
    document.querySelectorAll('.ds-font-block').forEach(function (block) {
      var pan = block.querySelector('.ds-font-pan');
      var out = block.querySelector('.ds-font-name');
      if (!pan || !out) return;
      var stack = getComputedStyle(pan).fontFamily;
      out.textContent = stack.split(',')[0].trim().replace(/^["']|["']$/g, '');
      out.title = stack;
    });
  }

  refreshSwatches();
  refreshContrast();
  readFontNames();

  // -- Skin switcher — toggle data-skin on <html> (DOM only, no storage) ----
  document.querySelectorAll('.skin-switch__btn').forEach(function (b) {
    b.addEventListener('click', function () {
      root.setAttribute('data-skin', b.getAttribute('data-skin-set'));
      document.querySelectorAll('.skin-switch__btn').forEach(function (x) {
        x.classList.toggle('is-active', x === b);
      });
      refreshSwatches();
      refreshContrast();
    });
  });

  // -- Hero Full/Compact demo toggle (index.html) ---------------------------
  var heroEl = document.querySelector('.hero');
  if (heroEl) {
    document.querySelectorAll('[data-hero-set]').forEach(function (b) {
      b.addEventListener('click', function () {
        var mode = b.getAttribute('data-hero-set'); // full | compact
        heroEl.classList.toggle('hero--full', mode === 'full');
        heroEl.classList.toggle('hero--compact', mode === 'compact');
        document.querySelectorAll('[data-hero-set]').forEach(function (x) {
          x.classList.toggle('is-active', x === b);
        });
      });
    });
  }

  // -- Real site-header off-canvas (index.html) — Esc-close + focus trap -----
  // Distinct from the DS demo (which uses the *--contained variants).
  var siteOc = document.querySelector('.nav-offcanvas:not(.nav-offcanvas--contained)');
  if (siteOc) {
    var siteBd = document.querySelector('.nav-backdrop:not(.nav-backdrop--contained)');
    var siteTg = document.querySelector('.site-header .nav-toggle');
    var ocLastFocus = null;
    var ocFocusables = function () {
      return Array.prototype.slice.call(
        siteOc.querySelectorAll('a[href], button:not([disabled])')
      );
    };
    var setOc = function (open) {
      siteOc.classList.toggle('is-open', open);
      if (siteBd) siteBd.classList.toggle('is-open', open);
      if (siteTg) {
        siteTg.classList.toggle('is-open', open);
        siteTg.setAttribute('aria-expanded', open ? 'true' : 'false');
      }
      if (open) {
        ocLastFocus = document.activeElement;
        var f = ocFocusables();
        if (f[0]) f[0].focus();
      } else if (ocLastFocus) {
        ocLastFocus.focus();
      }
    };
    document.addEventListener('click', function (ev) {
      var t = ev.target.closest('[data-site-nav-toggle]');
      var c = ev.target.closest('[data-site-nav-close]');
      if (!t && !c) return;
      setOc(t ? !siteOc.classList.contains('is-open') : false);
    });
    document.addEventListener('keydown', function (ev) {
      if (!siteOc.classList.contains('is-open')) return;
      if (ev.key === 'Escape') {
        ev.preventDefault();
        setOc(false);
      } else if (ev.key === 'Tab') {
        var f = ocFocusables();
        if (!f.length) return;
        var first = f[0];
        var last = f[f.length - 1];
        if (ev.shiftKey && document.activeElement === first) {
          ev.preventDefault();
          last.focus();
        } else if (!ev.shiftKey && document.activeElement === last) {
          ev.preventDefault();
          first.focus();
        }
      }
    });
  }

  // -- Transparent-until-scroll header (index.html real header) -------------
  var siteHeader = document.querySelector('body > .site-header');
  if (siteHeader) {
    var HEADER_THRESHOLD = 24;
    var headerTicking = false;
    var applyHeader = function () {
      siteHeader.classList.toggle('site-header--top', window.scrollY <= HEADER_THRESHOLD);
      headerTicking = false;
    };
    var onScrollHeader = function () {
      if (!headerTicking) {
        requestAnimationFrame(applyHeader);
        headerTicking = true;
      }
    };
    window.addEventListener('scroll', onScrollHeader, { passive: true });
    applyHeader(); // initial state
  }

  // -- Featured: swap skeletons → real cards after a simulated load ---------
  var featured = document.querySelector('.featured');
  if (featured && !featured.classList.contains('is-loaded')) {
    setTimeout(function () {
      featured.classList.add('is-loaded');
    }, 600);
  }

  // -- Showcase parallax-lite (transform translateY) ------------------------
  // Desktop pointer devices only; off under prefers-reduced-motion.
  var reduceMo = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var pxMedia = document.querySelectorAll('.showcase__media');
  var canParallax =
    window.matchMedia &&
    window.matchMedia('(hover: hover)').matches &&
    window.innerWidth >= 1024 &&
    !reduceMo;
  if (pxMedia.length && canParallax) {
    var pxTicking = false;
    var runParallax = function () {
      var vh = window.innerHeight;
      pxMedia.forEach(function (m) {
        var r = m.parentElement.getBoundingClientRect();
        var progress = (r.top + r.height / 2 - vh / 2) / (vh / 2 + r.height / 2);
        progress = Math.max(-1, Math.min(1, progress));
        m.style.transform = 'translateY(' + (progress * 6).toFixed(2) + '%)'; // ±6%
      });
      pxTicking = false;
    };
    var onScrollPx = function () {
      if (!pxTicking) {
        requestAnimationFrame(runParallax);
        pxTicking = true;
      }
    };
    window.addEventListener('scroll', onScrollPx, { passive: true });
    window.addEventListener('resize', onScrollPx);
    runParallax();
  }

  // -- Stat counters — count up WHEN SCROLLED INTO VIEW (no loop) -----------
  // Plays 0 → value on entering the viewport; re-arms when it leaves so it
  // re-counts on the next visit. Static final value under prefers-reduced-motion.
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var COUNT_DUR = 1200;
  var counters = [];

  document.querySelectorAll('.stat-cell__num').forEach(function (el) {
    var raw = (el.getAttribute('data-count') || el.textContent).trim();
    var m = raw.match(/^([\d.,]+)(.*)$/); // number + optional suffix (e.g. "3,400+")
    if (!m) return;
    var numStr = m[1];
    var suffix = m[2] || '';
    var target = parseFloat(numStr.replace(/,/g, ''));
    if (isNaN(target)) return;
    el.setAttribute('data-count', raw); // preserve the target
    var decimals = (numStr.split('.')[1] || '').length;
    var grouped = numStr.indexOf(',') !== -1;

    function fmt(v) {
      var s = v.toFixed(decimals);
      if (grouped) {
        var parts = s.split('.');
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
        s = parts.join('.');
      }
      return s + suffix;
    }

    var playing = false;
    function play() {
      if (reduceMotion) {
        el.textContent = fmt(target);
        return;
      }
      if (playing) return;
      playing = true;
      var start = null;
      el.textContent = fmt(0);
      requestAnimationFrame(function step(ts) {
        if (start === null) start = ts;
        var p = Math.min((ts - start) / COUNT_DUR, 1);
        el.textContent = fmt(target * (1 - Math.pow(1 - p, 3))); // easeOutCubic
        if (p < 1) {
          requestAnimationFrame(step);
        } else {
          el.textContent = fmt(target);
          playing = false;
        }
      });
    }
    function arm() {
      if (!playing) el.textContent = fmt(0); // reset for the next scroll-in
    }
    counters.push({ el: el, play: play, arm: arm });
  });

  if (counters.length) {
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (e) {
            var c = counters.filter(function (x) { return x.el === e.target; })[0];
            if (!c) return;
            if (e.isIntersecting) c.play();
            else c.arm();
          });
        },
        { threshold: 0.4 }
      );
      counters.forEach(function (c) { io.observe(c.el); });
    } else {
      counters.forEach(function (c) { c.play(); }); // no IO support → just play once
    }
  }

  // -- DS sidebar: accordion groups + keyword search + active-section sync ---
  var dsNav = document.querySelector('.ds-nav');
  if (dsNav) {
    var navSearch = document.getElementById('ds-nav-search');
    var navItems = Array.prototype.slice.call(dsNav.querySelectorAll('.ds-nav__item'));
    var navGroups = Array.prototype.slice.call(dsNav.querySelectorAll('.ds-nav__group'));
    var navEmpty = dsNav.querySelector('[data-nav-empty]');
    var navToggle = dsNav.querySelector('[data-ds-nav-toggle]');
    var userPinned = []; // groups the user explicitly expanded this session

    // Mobile: the Menu toggle opens/closes the nav body (collapsed top bar).
    function setNavExpanded(open) {
      dsNav.classList.toggle('is-expanded', open);
      if (navToggle) navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    }
    if (navToggle) {
      navToggle.addEventListener('click', function () {
        setNavExpanded(!dsNav.classList.contains('is-expanded'));
      });
    }
    // Tapping a link (mobile) navigates then closes the dropdown.
    dsNav.querySelectorAll('.ds-nav__link').forEach(function (a) {
      a.addEventListener('click', function () { setNavExpanded(false); });
    });

    function setGroupOpen(group, open) {
      group.classList.toggle('is-open', open);
      var trg = group.querySelector('[data-nav-group]');
      if (trg) trg.setAttribute('aria-expanded', open ? 'true' : 'false');
    }

    // Trigger click → toggle the group + (un)pin it against auto-collapse.
    dsNav.querySelectorAll('[data-nav-group]').forEach(function (trg) {
      trg.addEventListener('click', function () {
        var group = trg.closest('.ds-nav__group');
        var open = !group.classList.contains('is-open');
        setGroupOpen(group, open);
        var idx = userPinned.indexOf(group);
        if (open && idx === -1) userPinned.push(group);
        if (!open && idx !== -1) userPinned.splice(idx, 1);
      });
    });

    // Keyword search — overrides collapse (is-searching forces panels open).
    function filterNav() {
      var q = navSearch ? navSearch.value.trim().toLowerCase() : '';
      dsNav.classList.toggle('is-searching', q.length > 0);
      if (q) setNavExpanded(true); // reveal matches on mobile while searching
      var anyVisible = false;
      navItems.forEach(function (it) {
        var link = it.querySelector('.ds-nav__link');
        var hay = ((link ? link.textContent : '') + ' ' + (it.getAttribute('data-keywords') || '')).toLowerCase();
        var show = !q || hay.indexOf(q) !== -1;
        it.classList.toggle('is-hidden', !show);
        if (show) anyVisible = true;
      });
      navGroups.forEach(function (g) {
        var visible = g.querySelectorAll('.ds-nav__item:not(.is-hidden)').length;
        g.classList.toggle('is-hidden', q.length > 0 && visible === 0);
      });
      if (navEmpty) navEmpty.hidden = anyVisible;
    }
    if (navSearch) {
      navSearch.addEventListener('input', filterNav);
      navSearch.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') { navSearch.value = ''; filterNav(); navSearch.blur(); }
      });
    }

    // Active-section highlight + accordion sync (topmost section in an upper band).
    var navAnchors = dsNav.querySelectorAll('.ds-nav__item > .ds-nav__link[href^="#"]');
    if (navAnchors.length && 'IntersectionObserver' in window) {
      var itemById = {};
      var groupBySection = {};
      var sections = [];
      navAnchors.forEach(function (a) {
        var id = a.getAttribute('href').slice(1);
        var sec = document.getElementById(id);
        if (!sec) return;
        itemById[id] = a.parentElement;
        groupBySection[id] = a.closest('.ds-nav__group');
        sections.push(sec);
      });
      var visibleTops = {};
      var currentId = null;
      function syncGroups(activeGroup) {
        navGroups.forEach(function (g) {
          setGroupOpen(g, g === activeGroup || userPinned.indexOf(g) !== -1);
        });
      }
      function setActive(id) {
        if (id === currentId) return;
        currentId = id;
        Object.keys(itemById).forEach(function (k) {
          itemById[k].classList.toggle('is-active', k === id);
        });
        syncGroups(groupBySection[id]); // open the active section's group
      }
      var secObs = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (e) {
            if (e.isIntersecting) visibleTops[e.target.id] = e.boundingClientRect.top;
            else delete visibleTops[e.target.id];
          });
          var ids = Object.keys(visibleTops);
          if (!ids.length) return;
          ids.sort(function (a, b) { return visibleTops[a] - visibleTops[b]; });
          setActive(ids[0]);
        },
        { rootMargin: '-30% 0px -60% 0px', threshold: 0 }
      );
      sections.forEach(function (s) { secObs.observe(s); });
    }
  }

  // -- DS viewport DESK/MOBILE toggle ---------------------------------------
  document.querySelectorAll('[data-viewport]').forEach(function (vp) {
    vp.querySelectorAll('[data-viewport-set]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        vp.classList.toggle('is-mobile', btn.getAttribute('data-viewport-set') === 'mobile');
        vp.querySelectorAll('[data-viewport-set]').forEach(function (b) {
          b.classList.toggle('is-active', b === btn);
        });
      });
    });
  });
})();
