/* SU lead capture. Any <form data-su-form="tour|sponsor|media|service|contact|launch_rsvp"> is saved to the
   shared Supabase "leads" table. Fields named name, organization, email, phone go to their own columns;
   every other field goes into details. Needs su-config.js and supabase-js (UMD) loaded first. */
(function () {
  var cfg = window.SU_SUPABASE || {};
  var client = null;
  function db() {
    if (client) return client;
    if (cfg.url && cfg.key && window.supabase && window.supabase.createClient) {
      client = window.supabase.createClient(cfg.url, cfg.key, { auth: { persistSession: true } });
    }
    return client;
  }
  window.SUdb = db;
  var SITE = document.documentElement.getAttribute('data-su-site') || location.hostname;
  function status(form, kind, msg) {
    var box = form.querySelector('[data-su-status]');
    if (!box) { box = document.createElement('p'); box.setAttribute('data-su-status', ''); box.setAttribute('role', 'status'); form.appendChild(box); }
    box.className = 'su-status su-status--' + kind; box.textContent = msg;
  }
  function bind(form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!form.reportValidity()) return;
      var data = new FormData(form), row = { site: SITE, form: form.getAttribute('data-su-form'), page: location.pathname, details: {} };
      data.forEach(function (v, k) {
        v = String(v).trim();
        if (k === 'website_hp') return;                         // honeypot
        if (['name', 'organization', 'email', 'phone'].indexOf(k) > -1) row[k] = v || null;
        else if (row.details[k]) row.details[k] = [].concat(row.details[k], v); else row.details[k] = v;
      });
      if (data.get('website_hp')) { status(form, 'ok', 'Thank you. We received your request.'); return; }
      var btn = form.querySelector('[type=submit]'); if (btn) btn.disabled = true;
      var c = db();
      if (!c) {
        status(form, 'warn', 'Online requests open soon. For now, email ' + (window.SU_CONTACT_EMAIL || 'suradd@subr.edu') + ' with these details.');
        if (btn) btn.disabled = false; return;
      }
      status(form, 'busy', 'Sending…');
      c.from('leads').insert(row).then(function (r) {
        if (btn) btn.disabled = false;
        if (r.error) { status(form, 'err', 'That did not go through. Please try again, or email ' + window.SU_CONTACT_EMAIL + '.'); return; }
        form.reset(); status(form, 'ok', 'Thank you. We received your request and will reply within two business days.');
      });
    });
  }
  function init() { [].forEach.call(document.querySelectorAll('form[data-su-form]'), bind); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
