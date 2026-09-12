/* Giscus mount for Beethoven. One repository, one category, theme follows the page. */
(function () {
  'use strict';

  var CONFIG = {
    repo: 'beethovenstudios/beethoven-web',
    repoId: 'R_kgDOUVVd3w',
    category: 'General',
    categoryId: 'DIC_kwDOUVVd384DFUWY'
  };

  function giscusTheme(theme) {
    return theme === 'dark' ? 'noborder_dark' : 'noborder_light';
  }

  function pageTheme() {
    return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  }

  function mount() {
    var host = document.getElementById('giscus-host');
    if (!host) return;
    var s = document.createElement('script');
    s.src = 'https://giscus.app/client.js';
    s.async = true;
    s.crossOrigin = 'anonymous';
    s.setAttribute('data-repo', CONFIG.repo);
    s.setAttribute('data-repo-id', CONFIG.repoId);
    s.setAttribute('data-category', CONFIG.category);
    s.setAttribute('data-category-id', CONFIG.categoryId);
    s.setAttribute('data-mapping', 'pathname');
    s.setAttribute('data-strict', '0');
    s.setAttribute('data-reactions-enabled', '1');
    s.setAttribute('data-emit-metadata', '0');
    s.setAttribute('data-input-position', 'top');
    s.setAttribute('data-theme', giscusTheme(pageTheme()));
    s.setAttribute('data-lang', 'en');
    s.setAttribute('data-loading', 'lazy');
    host.appendChild(s);
  }

  window.bvnSetGiscusTheme = function (theme) {
    var frame = document.querySelector('iframe.giscus-frame');
    if (!frame || !frame.contentWindow) return;
    frame.contentWindow.postMessage({ giscus: { setConfig: { theme: giscusTheme(theme) } } }, 'https://giscus.app');
  };

  document.addEventListener('DOMContentLoaded', mount);
})();
