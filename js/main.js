(function () {
  'use strict';

  // false : les animations tournent pour tout le monde, comme sur Tripletta.
  // true  : on respecte le réglage « réduire les animations » du système.
  var RESPECT_REDUCED_MOTION = false;

  var reduceMotion = RESPECT_REDUCED_MOTION && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  document.documentElement.classList.toggle('reduce-motion', reduceMotion);
  var header = document.querySelector('.header');

  /* ---------- Bandeau défilant : il accélère avec le scroll et en suit le sens ---------- */
  // Le scroll reste celui du navigateur (déjà fluide, y compris sur écran 120 Hz).
  // La boucle d'animation ne tourne que pendant le scroll, puis s'arrête.

  var track = document.querySelector('.marquee__track');
  var marquee = !reduceMotion && track && track.getAnimations ? track.getAnimations()[0] : null;

  if (marquee) {
    marquee.currentTime = 38000 * 1000; // point de départ loin de zéro pour pouvoir défiler à l'envers
    var lastY = window.scrollY, lastT = performance.now();
    var velocity = 0, direction = 1, speed = 1, applied = 1, running = false;

    var step = function () {
      velocity *= 0.9;
      var target = direction * (1 + Math.min(Math.abs(velocity) * 0.35, 6));
      speed += (target - speed) * 0.08;
      if (Math.abs(speed - target) < 0.005) speed = target;
      if (Math.abs(speed - applied) > 0.02 || (speed === target && speed !== applied)) {
        applied = speed;
        marquee.playbackRate = speed;
      }
      if (speed === direction && Math.abs(velocity) < 0.05) { running = false; return; }
      requestAnimationFrame(step);
    };

    window.addEventListener('scroll', function () {
      var now = performance.now(), y = window.scrollY;
      if (y !== lastY) direction = y > lastY ? 1 : -1;
      velocity = (y - lastY) / Math.max(1, now - lastT) * 16; // pixels par image
      lastY = y; lastT = now;
      if (!running) { running = true; requestAnimationFrame(step); }
    }, { passive: true });
  }

  function scrollToId(id) {
    var target = document.getElementById(id);
    if (target && target.classList.contains('hero')) target = 0;
    if (target === null) return;
    var top = target === 0 ? 0 : target.getBoundingClientRect().top + window.scrollY - header.offsetHeight;
    window.scrollTo({ top: top, behavior: reduceMotion ? 'auto' : 'smooth' });
    if (target !== 0) {
      target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
    }
    history.replaceState(null, '', '#' + id);
  }

  document.addEventListener('click', function (e) {
    var link = e.target.closest('a[href^="#"]');
    if (!link) return;
    var id = link.getAttribute('href').slice(1);
    if (!id || !document.getElementById(id)) return;
    e.preventDefault();
    if (link.closest('dialog')) {
      document.getElementById(id).scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
      return;
    }
    if (!menu.hidden) closeMenu(false);
    scrollToId(id);
  });

  /* ---------- Menu mobile ---------- */

  var menu = document.getElementById('menu');
  var burger = document.querySelector('.nav__burger');
  var menuClose = menu.querySelector('.menu__close');

  menu.querySelectorAll('.menu__links li').forEach(function (li, i) {
    li.style.setProperty('--i', i);
  });

  var background = document.querySelectorAll('.skip, .header, main, .footer');

  function setInert(on) {
    background.forEach(function (el) {
      if (on) el.setAttribute('inert', '');
      else el.removeAttribute('inert');
    });
  }

  function lockScroll(lock) {
    document.body.classList.toggle('is-locked', lock);
  }

  var hideTimer = null;

  function openMenu() {
    clearTimeout(hideTimer);
    menu.hidden = false;
    burger.setAttribute('aria-expanded', 'true');
    lockScroll(true);
    setInert(true);
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { menu.classList.add('is-open'); });
    });
    menuClose.focus();
  }

  function closeMenu(restoreFocus) {
    menu.classList.remove('is-open');
    burger.setAttribute('aria-expanded', 'false');
    lockScroll(false);
    setInert(false);
    hideTimer = setTimeout(function () { menu.hidden = true; }, reduceMotion ? 0 : 400);
    if (restoreFocus !== false) burger.focus();
  }

  burger.addEventListener('click', openMenu);
  menuClose.addEventListener('click', closeMenu);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !menu.hidden) closeMenu();
  });

  /* ---------- Modales projets ---------- */

  var opener = null;

  function afterClose() {
    if (!document.body.classList.contains('is-locked')) return;
    lockScroll(false);
    if (opener) opener.focus();
    opener = null;
  }

  function closeModal(dialog) {
    if (!dialog.open || dialog.classList.contains('is-closing')) return;
    if (reduceMotion) {
      dialog.close();
      afterClose();
      return;
    }
    dialog.classList.add('is-closing');
    setTimeout(function () {
      dialog.classList.remove('is-closing');
      dialog.close();
      afterClose();
    }, 200);
  }

  document.querySelectorAll('[data-modal]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var dialog = document.getElementById(btn.dataset.modal);
      if (!dialog) return;
      opener = btn;
      dialog.showModal();
      dialog.querySelector('.modal__body').scrollTop = 0;
      dialog.querySelector('.modal__box').scrollTop = 0;
      lockScroll(true);
    });
  });

  document.querySelectorAll('dialog.modal').forEach(function (dialog) {
    dialog.querySelector('.modal__close').addEventListener('click', function () {
      closeModal(dialog);
    });
    // Clic sur le fond (en dehors de la boîte)
    dialog.addEventListener('click', function (e) {
      if (e.target === dialog) closeModal(dialog);
    });
    // Échap : on garde l'animation de fermeture
    dialog.addEventListener('cancel', function (e) {
      e.preventDefault();
      closeModal(dialog);
    });
    dialog.addEventListener('close', afterClose);
  });

  // Lien direct vers une modale : index.html#modal-xefi
  var hashTarget = location.hash && document.getElementById(location.hash.slice(1));
  if (hashTarget && hashTarget.matches('dialog.modal')) {
    hashTarget.showModal();
    lockScroll(true);
  }

  /* ---------- Compétences : tout déplier / replier ---------- */

  var toggleAll = document.querySelector('[data-toggle-all]');
  var skills = document.querySelectorAll('details.skills');

  function syncToggleLabel() {
    var allOpen = Array.prototype.every.call(skills, function (d) { return d.open; });
    toggleAll.textContent = allOpen ? toggleAll.dataset.labelClose : toggleAll.dataset.labelOpen;
    toggleAll.setAttribute('aria-expanded', allOpen ? 'true' : 'false');
  }

  // Le contenu glisse au lieu d'apparaître d'un coup
  // État visé : pendant une animation, c'est la cible qui compte, pas l'état actuel
  function isOpen(d) { return d._anim ? d._target : d.open; }

  function setSkill(d, open) {
    var grid = d.querySelector('.skills__grid');
    if (isOpen(d) === open) return;
    if (d._anim) { d._anim.cancel(); d._anim = null; }
    d._target = open;
    d.classList.toggle('is-closing', !open);
    if (reduceMotion || !grid.animate) { d.open = open; d.classList.remove('is-closing'); return; }
    if (open) d.open = true;
    var full = grid.scrollHeight;
    var pad = getComputedStyle(grid).paddingBottom;
    var frames = [
      { height: '0px', paddingBottom: '0px', opacity: 0 },
      { height: full + 'px', paddingBottom: pad, opacity: 1 }
    ];
    grid.style.overflow = 'hidden';
    d._anim = grid.animate(open ? frames : frames.slice().reverse(), {
      duration: 450,
      easing: 'cubic-bezier(.22, 1, .36, 1)'
    });
    // Fin garantie par un minuteur : l'état reste juste même si l'onglet est en arrière-plan
    var anim = d._anim;
    clearTimeout(d._timer);
    d._timer = setTimeout(function () {
      if (d._anim !== anim) return;
      anim.cancel();
      if (!open) d.open = false;
      d.classList.remove('is-closing');
      grid.style.overflow = '';
      d._anim = null;
    }, 470);
  }

  skills.forEach(function (d) {
    d.querySelector('summary').addEventListener('click', function (e) {
      e.preventDefault();
      setSkill(d, !isOpen(d));
    });
  });

  if (toggleAll) {
    toggleAll.addEventListener('click', function () {
      var open = toggleAll.getAttribute('aria-expanded') !== 'true';
      skills.forEach(function (d) { setSkill(d, open); });
      if (open) syncToggleLabel();
    });
    skills.forEach(function (d) {
      d.addEventListener('toggle', syncToggleLabel);
    });
    syncToggleLabel();
  }

  /* ---------- Cartes projets entièrement cliquables ---------- */

  document.querySelectorAll('.card, .perso__item').forEach(function (card) {
    card.addEventListener('click', function (e) {
      if (e.target.closest('button, a')) return;
      var btn = card.querySelector('[data-modal]');
      if (btn) btn.click();
    });
  });

  /* ---------- Parallaxe façon Tripletta (grand écran) ---------- */

  var wideScreen = window.matchMedia('(min-width: 901px)');
  var hero = document.querySelector('.hero');
  var watermark = document.querySelector('.hero__watermark');

  function clamp01(v) { return Math.min(1, Math.max(0, v)); }

  // Les dimensions sont mesurées au chargement et quand la page change de taille,
  // jamais pendant le scroll : chaque image reste légère (important sur un écran 120 Hz).
  var geo = null;
  var lastWm = null;

  function measure() {
    geo = {
      heroH: hero.offsetHeight,
      wmH: watermark.offsetHeight,
      vh: window.innerHeight
    };
    lastWm = null;
  }

  function updateParallax() {
    if (reduceMotion || !wideScreen.matches) return;
    if (!geo) measure();
    var y = window.scrollY;
    // Filigrane de l'accueil : glisse moins vite que la page
    var wm = Math.round(clamp01(y / geo.heroH) * 0.35 * geo.wmH);
    if (wm !== lastWm) {
      watermark.style.transform = 'translate3d(0,' + wm + 'px,0)';
      lastWm = wm;
    }
  }

  function remeasure() { geo = null; updateParallax(); }
  window.addEventListener('resize', remeasure);
  window.addEventListener('load', remeasure);
  if ('ResizeObserver' in window) new ResizeObserver(remeasure).observe(document.body);

  wideScreen.addEventListener('change', function () {
    if (wideScreen.matches) return updateParallax();
    watermark.style.transform = '';
  });
  window.addEventListener('scroll', updateParallax, { passive: true });
  updateParallax();

  /* ---------- Pause du bandeau et du sticker (WCAG 2.2.2) ---------- */

  var motionToggle = document.querySelector('.motion-toggle');

  function setPaused(paused) {
    document.documentElement.classList.toggle('is-paused', paused);
    motionToggle.setAttribute('aria-pressed', paused ? 'true' : 'false');
    motionToggle.setAttribute('aria-label', paused ? motionToggle.dataset.labelPlay : motionToggle.dataset.labelPause);
  }

  if (motionToggle) {
    var stored = null;
    try { stored = localStorage.getItem('motion-paused'); } catch (err) { /* stockage indisponible */ }
    setPaused(stored === '1');
    motionToggle.addEventListener('click', function () {
      var paused = !document.documentElement.classList.contains('is-paused');
      setPaused(paused);
      try { localStorage.setItem('motion-paused', paused ? '1' : '0'); } catch (err) { /* stockage indisponible */ }
    });
  }

  /* ---------- FR / EN : on reste sur la même section ---------- */

  var SECTION_PAIRS = [
    ['accueil', 'home'], ['a-propos', 'about'], ['formation', 'education'], ['competences', 'skills'],
    ['projets', 'projects'], ['certifications', 'certifications'], ['interets', 'interests'],
    ['cv', 'resume'], ['contact', 'contact']
  ];
  var isEnglish = document.documentElement.lang === 'en';

  document.querySelectorAll('.lang a').forEach(function (a) {
    a.addEventListener('click', function () {
      var line = header.offsetHeight + window.innerHeight * 0.3, currentId = null;
      SECTION_PAIRS.forEach(function (pair) {
        var el = document.getElementById(pair[isEnglish ? 1 : 0]);
        if (el && el.getBoundingClientRect().top <= line) currentId = pair[isEnglish ? 0 : 1];
      });
      var base = a.getAttribute('href').split('#')[0];
      if (currentId && currentId !== 'accueil' && currentId !== 'home') a.setAttribute('href', base + '#' + currentId);
    });
  });

  /* ---------- Lien actif dans la navigation ---------- */

  var navLinks = document.querySelectorAll('.nav__links a');
  var sections = Array.prototype.map.call(navLinks, function (a) {
    return document.getElementById(a.getAttribute('href').slice(1));
  });

  function updateActive() {
    var line = header.offsetHeight + window.innerHeight * 0.3;
    var current = 0;
    sections.forEach(function (s, i) {
      if (s && s.getBoundingClientRect().top <= line) current = i;
    });
    navLinks.forEach(function (a, i) {
      if (i === current) a.setAttribute('aria-current', 'true');
      else a.removeAttribute('aria-current');
    });
  }
  window.addEventListener('scroll', updateActive, { passive: true });
  updateActive();
})();
