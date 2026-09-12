/* Beethoven site — theme, menu, copy buttons, docs scroll-spy. No framework. */
(function () {
  'use strict';

  var SUN = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
  var MOON = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';

  function currentTheme() {
    return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    var btns = document.querySelectorAll('.theme-toggle');
    for (var i = 0; i < btns.length; i++) {
      btns[i].innerHTML = theme === 'dark' ? SUN : MOON;
      btns[i].setAttribute('aria-label', theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
    }
    if (window.bvnSetGiscusTheme) window.bvnSetGiscusTheme(theme);
  }

  function initTheme() {
    applyTheme(currentTheme());
    var btns = document.querySelectorAll('.theme-toggle');
    for (var i = 0; i < btns.length; i++) {
      btns[i].addEventListener('click', function () {
        var next = currentTheme() === 'dark' ? 'light' : 'dark';
        try { localStorage.setItem('bvn_theme', next); } catch (e) { /* private mode */ }
        applyTheme(next);
      });
    }
  }

  function initMenu() {
    var btn = document.querySelector('.menu-btn');
    var links = document.getElementById('nav-links');
    if (!btn || !links) return;
    btn.addEventListener('click', function () {
      var open = links.classList.toggle('open');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    links.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') { links.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); }
    });
  }

  function initCopy() {
    var btns = document.querySelectorAll('[data-copy]');
    for (var i = 0; i < btns.length; i++) {
      btns[i].addEventListener('click', function () {
        var pre = this.parentElement.querySelector('pre');
        if (!pre) return;
        var text = pre.textContent;
        var self = this;
        function done() { self.textContent = 'Copied'; self.classList.add('copied'); setTimeout(function () { self.textContent = 'Copy'; self.classList.remove('copied'); }, 1600); }
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(done, function () { fallback(text); done(); });
        } else { fallback(text); done(); }
      });
    }
    function fallback(text) {
      var ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); } catch (e) { /* nothing more to try */ }
      document.body.removeChild(ta);
    }
  }

  // Docs page: highlight the section currently in view.
  function initScrollSpy() {
    var nav = document.querySelector('.docs-nav');
    if (!nav || !('IntersectionObserver' in window)) return;
    var links = nav.querySelectorAll('a[href^="#"]');
    var map = {};
    var targets = [];
    for (var i = 0; i < links.length; i++) {
      var id = links[i].getAttribute('href').slice(1);
      var el = document.getElementById(id);
      if (el) { map[id] = links[i]; targets.push(el); }
    }
    var obs = new IntersectionObserver(function (entries) {
      for (var j = 0; j < entries.length; j++) {
        if (!entries[j].isIntersecting) continue;
        for (var k in map) map[k].classList.remove('active');
        var link = map[entries[j].target.id];
        if (link) link.classList.add('active');
      }
    }, { rootMargin: '-15% 0px -75% 0px', threshold: 0 });
    for (var t = 0; t < targets.length; t++) obs.observe(targets[t]);
  }

  document.addEventListener('DOMContentLoaded', function () {
    initTheme();
    initMenu();
    initCopy();
    initScrollSpy();
  });
})();
