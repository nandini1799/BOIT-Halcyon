/* Halcyon — shared state switcher for the direction mocks.
 *
 * Generic on purpose: it knows nothing about any direction's visual language, only about
 * data attributes. Each direction styles its own switcher chrome; none of them reimplement
 * the switching logic.
 *
 *   [data-state-btn="kpi-bar"]   a control that selects a state
 *   [data-state="kpi-bar"]       a panel shown only in that state
 *   [data-drawer]                a "show the work" toggle; targets [data-drawer-body]
 */
(function (root) {
  'use strict';

  var STATES = ['empty', 'kpi-bar', 'table-line', 'branches', 'compare', 'thinking', 'rejected', 'error'];

  function init(opts) {
    opts = opts || {};
    var initial = opts.initial || STATES[0];

    function show(state) {
      document.querySelectorAll('[data-state]').forEach(function (el) {
        var on = el.getAttribute('data-state') === state;
        el.hidden = !on;
      });
      document.querySelectorAll('[data-state-btn]').forEach(function (b) {
        var on = b.getAttribute('data-state-btn') === state;
        b.classList.toggle('is-active', on);
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      document.documentElement.setAttribute('data-current-state', state);
      if (typeof opts.onChange === 'function') opts.onChange(state);
    }

    document.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-state-btn]');
      if (btn) { show(btn.getAttribute('data-state-btn')); return; }

      var toggle = e.target.closest('[data-drawer]');
      if (toggle) {
        var body = document.getElementById(toggle.getAttribute('data-drawer'));
        if (!body) return;
        var open = body.hasAttribute('hidden');
        if (open) body.removeAttribute('hidden'); else body.setAttribute('hidden', '');
        toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
        toggle.classList.toggle('is-open', open);
        return;
      }

      var tab = e.target.closest('[data-tab]');
      if (tab) {
        var group = tab.closest('[data-tabs]');
        if (!group) return;
        var name = tab.getAttribute('data-tab');
        group.querySelectorAll('[data-tab]').forEach(function (t) {
          var on = t === tab;
          t.classList.toggle('is-active', on);
          t.setAttribute('aria-selected', on ? 'true' : 'false');
        });
        group.querySelectorAll('[data-tab-panel]').forEach(function (p) {
          p.hidden = p.getAttribute('data-tab-panel') !== name;
        });
      }
    });

    document.addEventListener('keydown', function (e) {
      if (e.target.matches('input, textarea')) return;
      var i = STATES.indexOf(document.documentElement.getAttribute('data-current-state'));
      if (e.key === 'ArrowRight') { show(STATES[(i + 1) % STATES.length]); e.preventDefault(); }
      if (e.key === 'ArrowLeft') { show(STATES[(i - 1 + STATES.length) % STATES.length]); e.preventDefault(); }
    });

    show(initial);
    root.__ready = true;
    return { show: show };
  }

  root.HSwitch = { init: init, STATES: STATES };
})(window);
