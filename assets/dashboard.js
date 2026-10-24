/* XR Jags staff dashboard (/dashboard). Supabase Auth email + password, then the "leads" and "activity_log" tables
   from the shared schema (column names match migration.sql exactly). Uses window.SUdb() from su-leads.js.
   Row access is enforced by the database rules (only rows in public.staff can read or update). */
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var STATUSES = ["new", "contacted", "scheduled", "closed"];
  function show(id, on) { var el = $(id); if (el) el.hidden = !on; }
  function msg(id, kind, text) { var el = $(id); if (!el) return; el.className = "su-status" + (text ? " su-status--" + kind : ""); el.textContent = text || ""; }
  function txt(v) { return v == null ? "" : String(v); }
  function td(row, text, cls) { var c = document.createElement("td"); if (cls) c.className = cls; c.textContent = txt(text); row.appendChild(c); return c; }
  function fmtDate(s) { try { return new Date(s).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }); } catch (e) { return s; } }

  // every password field gets a visible "Show password" toggle
  document.querySelectorAll(".pw-toggle").forEach(function (b) {
    var inp = $(b.getAttribute("aria-controls"));
    b.addEventListener("click", function () {
      var on = inp.type === "password"; inp.type = on ? "text" : "password";
      b.setAttribute("aria-pressed", on ? "true" : "false"); b.textContent = on ? "Hide password" : "Show password";
    });
  });

  function start() {
    var db = window.SUdb && window.SUdb();
    if (!db) { show("offline", true); return; }

    function signedOut() { ["app", "leads", "activity"].forEach(function (s) { show(s, false); }); show("signin", true); }
    function signedIn(user) {
      show("signin", false); ["app", "leads", "activity"].forEach(function (s) { show(s, true); });
      $("who").textContent = "Signed in as " + (user.email || "staff");
      var d = $("act-happened-on"); if (d && !d.value) d.value = new Date().toISOString().slice(0, 10);
      loadLeads(); loadActivity();
    }

    $("signin-form").addEventListener("submit", function (e) {
      e.preventDefault(); if (!e.target.reportValidity()) return;
      msg("si-status", "busy", "Signing in…");
      db.auth.signInWithPassword({ email: $("si-email").value.trim(), password: $("si-password").value }).then(function (r) {
        if (r.error) { msg("si-status", "err", "Sign-in did not work. Check the email and password."); return; }
        $("si-password").value = ""; msg("si-status", "", ""); signedIn(r.data.user);
      });
    });
    $("signout").addEventListener("click", function () { db.auth.signOut().then(signedOut); });

    function loadLeads() {
      msg("leads-status", "busy", "Loading…");
      var q = db.from("leads").select("id,created_at,site,form,name,organization,email,phone,details,page,status").order("created_at", { ascending: false }).limit(500);
      var f = $("flt-form").value, s = $("flt-status").value;
      if (f) q = q.eq("form", f); if (s) q = q.eq("status", s);
      q.then(function (r) {
        var body = $("leads-body"); body.textContent = "";
        if (r.error) { msg("leads-status", "err", "Could not load leads. Your account may not be on the staff list."); return; }
        msg("leads-status", "", "");
        if (!r.data.length) { var tr = document.createElement("tr"); var c = td(tr, "No leads match these filters.", "dash-empty"); c.colSpan = 7; body.appendChild(tr); return; }
        r.data.forEach(function (L) {
          var tr = document.createElement("tr");
          td(tr, fmtDate(L.created_at)); td(tr, L.form); td(tr, L.name); td(tr, L.organization);
          td(tr, [L.email, L.phone].filter(Boolean).join("\n"), "det");
          var det = L.details && typeof L.details === "object" ? Object.keys(L.details).map(function (k) { return k + ": " + [].concat(L.details[k]).join(", "); }).join("\n") : txt(L.details);
          td(tr, det + (L.page ? "\npage: " + L.page : ""), "det");
          var c = document.createElement("td"), sel = document.createElement("select");
          sel.setAttribute("aria-label", "Status for " + (L.name || "lead"));
          STATUSES.forEach(function (s) { var o = document.createElement("option"); o.value = o.textContent = s; if (s === L.status) o.selected = true; sel.appendChild(o); });
          sel.addEventListener("change", function () {
            var prev = L.status; sel.disabled = true;
            db.from("leads").update({ status: sel.value }).eq("id", L.id).then(function (u) {
              sel.disabled = false;
              if (u.error) { sel.value = prev; msg("leads-status", "err", "Status was not saved. Try again."); }
              else { L.status = sel.value; msg("leads-status", "ok", "Status saved."); }
            });
          });
          c.appendChild(sel); tr.appendChild(c); body.appendChild(tr);
        });
      });
    }
    $("flt-form").addEventListener("change", loadLeads); $("flt-status").addEventListener("change", loadLeads);
    $("leads-reload").addEventListener("click", loadLeads);

    function loadActivity() {
      db.from("activity_log").select("id,happened_on,platform,kind,title,link,reach,boost_cost,notes").order("happened_on", { ascending: false }).limit(500).then(function (r) {
        var body = $("act-body"); body.textContent = "";
        if (r.error) { msg("act-status", "err", "Could not load the activity log."); return; }
        if (!r.data.length) { var tr = document.createElement("tr"); var c = td(tr, "Nothing logged yet.", "dash-empty"); c.colSpan = 7; body.appendChild(tr); return; }
        r.data.forEach(function (A) {
          var tr = document.createElement("tr");
          td(tr, A.happened_on); td(tr, A.platform); td(tr, A.kind);
          var t = td(tr, ""); if (A.link && /^https?:\/\//i.test(A.link)) { var a = document.createElement("a"); a.href = A.link; a.rel = "noopener"; a.target = "_blank"; a.textContent = A.title; t.appendChild(a); } else t.textContent = A.title;
          td(tr, A.reach); td(tr, A.boost_cost != null ? "$" + Number(A.boost_cost).toFixed(2) : ""); td(tr, A.notes, "det");
          body.appendChild(tr);
        });
      });
    }
    $("act-form").addEventListener("submit", function (e) {
      e.preventDefault(); var f = e.target; if (!f.reportValidity()) return;
      var v = function (n) { var x = f.elements[n].value.trim(); return x === "" ? null : x; };
      var row = { happened_on: v("happened_on"), platform: v("platform"), kind: v("kind"), title: v("title"), link: v("link"),
                  reach: v("reach") == null ? null : parseInt(v("reach"), 10), boost_cost: v("boost_cost") == null ? null : Number(v("boost_cost")), notes: v("notes") };
      msg("act-status", "busy", "Saving…");
      db.from("activity_log").insert(row).then(function (r) {
        if (r.error) { msg("act-status", "err", "Not saved. Check the fields and try again."); return; }
        f.reset(); $("act-happened-on").value = new Date().toISOString().slice(0, 10);
        msg("act-status", "ok", "Added to the log."); loadActivity();
      });
    });

    db.auth.getSession().then(function (r) { var s = r.data && r.data.session; if (s && s.user) signedIn(s.user); else signedOut(); });
    db.auth.onAuthStateChange(function (ev, s) { if (ev === "SIGNED_OUT") signedOut(); });
  }
  if (document.readyState === "complete") start(); else window.addEventListener("load", start);
})();
