/* ═══════════════════════════════════════════
   SuriOrder Shared Utilities — shared.js
   ═══════════════════════════════════════════ */

// ─── Toast ─────────────────────────────────

const Toast = (() => {
  const icons = { success: '✅', error: '❌', info: 'ℹ️', warn: '⚠️' };

  let container;

  function show(message, type, duration) {
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-container';
      document.body.appendChild(container);
    }
    const el = document.createElement('div');
    el.className = 'toast toast--' + type;
    el.innerHTML = '<span class="toast__icon">' + icons[type] + '</span><span class="toast__msg">' + escToast(message) + '</span>';
    container.appendChild(el);
    // Double rAF for enter animation
    requestAnimationFrame(() => {
      requestAnimationFrame(() => el.classList.add('toast--visible'));
    });
    setTimeout(() => {
      el.classList.remove('toast--visible');
      setTimeout(() => el.remove(), 250);
    }, duration || 3500);
  }

  function escToast(s) { return String(s).replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  return {
    success: function (m, d) { show(m, 'success', d); },
    error:   function (m, d) { show(m, 'error', d); },
    info:    function (m, d) { show(m, 'info', d); },
    warn:    function (m, d) { show(m, 'warn', d); },
  };
})();

// ─── Confirm Modal ─────────────────────────

function showConfirm(message, onConfirm, cancelLabel, okLabel) {
  var overlay = document.createElement('div');
  overlay.className = 'confirm-overlay';
  var cancelText = cancelLabel || (typeof t === 'function' ? t('cancel') : 'Cancel');
  var okText = okLabel || (typeof t === 'function' ? t('delete_confirm') : 'Delete');
  overlay.innerHTML =
    '<div class="confirm-box">' +
    '<p class="confirm-msg">' + escToast(message) + '</p>' +
    '<div class="confirm-actions">' +
    '<button class="confirm-cancel">' + cancelText + '</button>' +
    '<button class="confirm-ok">' + okText + '</button>' +
    '</div></div>';
  overlay.querySelector('.confirm-cancel').onclick = function () { overlay.remove(); };
  overlay.querySelector('.confirm-ok').onclick = function () { overlay.remove(); onConfirm(); };
  overlay.addEventListener('click', function (e) { if (e.target === overlay) overlay.remove(); });
  document.body.appendChild(overlay);
}

// ─── Loading Helpers ───────────────────────

function showSpinner(container, size) {
  var cls = 'spinner' + (size === 'sm' ? ' spinner--sm' : size === 'lg' ? ' spinner--lg' : '');
  var html = '<div style="display:flex;justify-content:center;align-items:center;padding:40px 0"><div class="' + cls + '"></div></div>';
  if (typeof container === 'string') container = document.getElementById(container);
  if (container) container.innerHTML = html;
}

function showSkeleton(container, count, height) {
  count = count || 3;
  height = height || '64px';
  var html = '';
  for (var i = 0; i < count; i++) {
    html += '<div class="skeleton" style="height:' + height + ';margin-bottom:8px"></div>';
  }
  if (typeof container === 'string') container = document.getElementById(container);
  if (container) container.innerHTML = html;
}
