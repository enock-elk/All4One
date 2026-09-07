/**
 * RyanGPT Case Maker — paste this entire file at the END of the Case Maker
 * HTML file in Apps Script (before </body>), then Deploy → New version.
 *
 * All4One embeds this widget in an iframe and cannot change its theme
 * directly (cross-origin). This listener applies the host theme and hides
 * the widget's own sun/moon button while embedded.
 *
 * Also add these origins to the existing ONESPACE_ORIGINS array in Case Maker
 * if you use the OneSpace fill/submit bridge from GitHub Pages:
 *   'https://enock-elk.github.io'
 *   'http://localhost:5500'
 *   'http://127.0.0.1:5500'
 */
(function () {
  'use strict';

  var HOST_ORIGINS = [
    'https://enock-elk.github.io',
    'https://actuaryspace.co.za',
    'http://localhost:5500',
    'http://localhost:5173',
    'http://localhost:8888',
    'http://127.0.0.1:5500',
    'http://127.0.0.1:5173',
  ];

  function applyHostTheme(theme) {
    var html = document.documentElement;
    if (theme === 'light') {
      html.classList.remove('dark');
    } else if (theme === 'dark') {
      html.classList.add('dark');
    }
  }

  function hideLocalToggle() {
    var btn = document.querySelector('button[onclick="toggleTheme()"]');
    if (btn) btn.style.display = 'none';
  }

  function hosted() {
    try {
      return window.self !== window.top;
    } catch (err) {
      return true;
    }
  }

  if (!hosted()) return;

  hideLocalToggle();

  window.addEventListener('message', function (e) {
    if (HOST_ORIGINS.indexOf(e.origin) === -1) return;
    var data = e.data || {};
    if (data.type !== 'casemaker:theme') return;
    if (data.theme !== 'light' && data.theme !== 'dark') return;
    applyHostTheme(data.theme);
  });

  try {
    window.top.postMessage({ type: 'casemaker:ready' }, '*');
  } catch (err) {}
})();
