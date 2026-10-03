/** Optional browser bootstrap. Built-in AXXES apps use same-site server-rendered configuration. */
(function () {
  'use strict';
  var script = document.currentScript;
  if (!script || script.isConnected === false) return;
  var app = script.getAttribute('data-app'), tenant = script.getAttribute('data-tenant');
  if (!app || !tenant) return;
  var key = app + ':' + tenant;
  if (window.__axxesPulseSetup === key) return;
  window.__axxesPulseSetup = key;
  var generation = (window.__axxesPulseGeneration || 0) + 1;
  window.__axxesPulseGeneration = generation;
  if (window.pulse) { window.pulse.flush(); window.pulse.destroy(); }
  var origin = window.location && /(^|\.)axxes\.app$/.test(window.location.hostname) ? 'https://pulse.axxes.app' : 'https://pulse.axxes.club';
  fetch(origin + '/api/pulse/axxes/config?app=' + encodeURIComponent(app) + '&tenant=' + encodeURIComponent(tenant), { credentials: 'include', cache: 'no-store' })
    .then(function (response) { if (!response.ok) throw Error('Pulse is not connected'); return response.json(); })
    .then(function (config) {
      if (window.__axxesPulseGeneration !== generation || window.__axxesPulseSetup !== key) return;
      var tracker = document.createElement('script');
      tracker.async = true;
      tracker.src = 'https://pulse.axxes.app/pulse.v1.js';
      tracker.setAttribute('data-site', config.siteId);
      tracker.setAttribute('data-environment', config.environment);
      tracker.setAttribute('data-native-generation', String(generation));
      tracker.setAttribute('data-endpoint', 'https://pulse.axxes.app/api/pulse/collect');
      tracker.setAttribute('data-performance', 'true');
      if (config.identityMode === 'persistent') { tracker.setAttribute('data-identity', 'persistent'); tracker.setAttribute('data-consent', 'required'); }
      document.head.appendChild(tracker);
    }).catch(function () { if (window.__axxesPulseGeneration === generation) delete window.__axxesPulseSetup; });
})();
