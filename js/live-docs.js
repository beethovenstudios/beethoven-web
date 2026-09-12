/* Live docs: render the engine repository's own Markdown on load, so this
   site cannot drift from the code. Fetched from raw.githubusercontent.com,
   rendered with marked (vendored), with a plain fallback link on failure. */
(function () {
  'use strict';

  var REPO = 'anydaytv/beethoven';
  var BRANCH = 'master';
  var RAW = 'https://raw.githubusercontent.com/' + REPO + '/' + BRANCH + '/';
  var BLOB = 'https://github.com/' + REPO + '/blob/' + BRANCH + '/';

  var body = document.getElementById('live-body');
  var tabs = document.querySelectorAll('.live-tabs [data-doc]');
  if (!body || !tabs.length) return;

  var cache = {};

  function escapeHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // Rewrite relative links and images so they resolve inside the repository.
  function absolutize(html, docPath) {
    var dir = docPath.indexOf('/') >= 0 ? docPath.slice(0, docPath.lastIndexOf('/') + 1) : '';
    var div = document.createElement('div');
    div.innerHTML = html;
    var anchors = div.querySelectorAll('a[href]');
    for (var i = 0; i < anchors.length; i++) {
      var href = anchors[i].getAttribute('href');
      if (/^(https?:|mailto:|#)/.test(href)) continue;
      anchors[i].setAttribute('href', BLOB + dir + href.replace(/^\.\//, ''));
      anchors[i].setAttribute('rel', 'noopener');
    }
    var imgs = div.querySelectorAll('img[src]');
    for (var j = 0; j < imgs.length; j++) {
      var src = imgs[j].getAttribute('src');
      if (/^(https?:|data:)/.test(src)) continue;
      imgs[j].setAttribute('src', RAW + dir + src.replace(/^\.\//, ''));
    }
    return div.innerHTML;
  }

  function render(docPath, md) {
    var html;
    try {
      html = window.marked ? window.marked.parse(md) : '<pre>' + escapeHtml(md) + '</pre>';
    } catch (e) {
      html = '<pre>' + escapeHtml(md) + '</pre>';
    }
    body.innerHTML = '<p class="live-src">' + escapeHtml(docPath) + ' · <a href="' + BLOB + docPath + '" rel="noopener">view on GitHub</a></p>' + absolutize(html, docPath);
  }

  function load(docPath) {
    for (var i = 0; i < tabs.length; i++) tabs[i].classList.toggle('active', tabs[i].getAttribute('data-doc') === docPath);
    if (cache[docPath]) { render(docPath, cache[docPath]); return; }
    body.innerHTML = '<p class="loading">Fetching ' + escapeHtml(docPath) + '…</p>';
    fetch(RAW + docPath, { cache: 'no-cache' })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
      .then(function (md) { cache[docPath] = md; render(docPath, md); })
      .catch(function (err) {
        body.innerHTML = '<p class="loading">Could not fetch ' + escapeHtml(docPath) + ' (' + escapeHtml(err.message) + '). ' +
          '<a href="' + BLOB + docPath + '" rel="noopener">Read it on GitHub instead.</a></p>';
      });
  }

  for (var i = 0; i < tabs.length; i++) {
    tabs[i].addEventListener('click', function () { load(this.getAttribute('data-doc')); });
  }

  load(tabs[0].getAttribute('data-doc'));
})();
