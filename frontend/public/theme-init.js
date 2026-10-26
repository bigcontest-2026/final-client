/* Runs before styles/React; the same store drives subsequent theme changes. */
(function () {
  'use strict';
  if (window.__HERMES_THEME__) return;

  var key = 'hermes.theme';
  var listeners = new Set();
  var media = null;
  var snapshot;

  function parse(value) {
    return value === 'light' || value === 'dark' ? value : 'system';
  }

  function storage() {
    try { return window.localStorage; } catch (_) { return null; }
  }

  function readPreference() {
    try { return parse(storage().getItem(key)); } catch (_) { return 'system'; }
  }

  try { media = window.matchMedia('(prefers-color-scheme: dark)'); } catch (_) { /* Use light. */ }

  function update(preference) {
    var resolved = preference === 'system' ? (media && media.matches ? 'dark' : 'light') : preference;
    if (snapshot && snapshot.preference === preference && snapshot.resolved === resolved) return;
    snapshot = { preference: preference, resolved: resolved };
    document.documentElement.dataset.theme = resolved;
    document.documentElement.style.colorScheme = resolved;
    var color = document.querySelector('meta[name="theme-color"]');
    if (color) color.content = resolved === 'dark' ? '#000000' : '#f5f5f7';
    listeners.forEach(function (listener) { listener(); });
  }

  update(readPreference());
  if (media && media.addEventListener) {
    media.addEventListener('change', function () {
      if (snapshot.preference === 'system') update('system');
    });
  }
  window.addEventListener('storage', function (event) {
    if (event.key !== key && event.key !== null) return;
    if (event.storageArea && event.storageArea !== storage()) return;
    update(parse(event.newValue));
  });

  window.__HERMES_THEME__ = {
    getSnapshot: function () { return snapshot; },
    setPreference: function (value) {
      var preference = parse(value);
      try { storage().setItem(key, preference); } catch (_) { /* Keep this tab usable. */ }
      update(preference);
    },
    subscribe: function (listener) {
      listeners.add(listener);
      return function () { listeners.delete(listener); };
    },
  };
})();
