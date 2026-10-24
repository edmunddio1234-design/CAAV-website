/* XR Jags staff dashboard: Partners tab (/dashboard#partners).
   Tables and rules: su-shared/migration-partners.sql (Block 4). tasks.js owns the tab bar and calls
   XRPartners.start(db, me) after sign-in, XRPartners.show(route) when the Partners tab opens, XRPartners.stop() on sign-out.
   Who can do what is decided by the database: all active staff read; managers and student leads add and change;
   only managers remove. The page only hides buttons people cannot use.
   Every value from the database goes on screen with textContent, never as HTML. */
(function () {
  "use strict";
  var KIND = { resource: "Resource partner", sponsor: "Sponsor", program: "Program partner" };
  var KIND_ORDER = ["resource", "sponsor", "program"];
  var PAPER = { not_started: "Not started", drafted: "Drafted", sent: "Sent", signed: "Signed" };
  var PAPER_ORDER = ["not_started", "drafted", "sent", "signed"];
  var OTHER = { none: "None", moa: "MOA", sponsor_agreement: "Sponsor agreement", other: "Other" };
  var RST = { offered: "Offered", confirmed: "Confirmed", deployed: "Deployed", declined: "Declined" };
  var RST_ORDER = ["offered", "confirmed", "deployed", "declined"];
  var $ = function (id) { return document.getElementById(id); };
  var P = null; // state while signed in

  function h(tag, props, kids) {
    var el = document.createElement(tag);
    if (props) Object.keys(props).forEach(function (k) {
      var v = props[k]; if (v == null || v === false) return;
      if (k === "text") el.textContent = v;
      else if (k === "className") el.className = v;
      else if (k === "on") Object.keys(v).forEach(function (ev) { el.addEventListener(ev, v[ev]); });
      else if (k === "value") el.value = v;
      else if (k === "checked") el.checked = !!v;
      else el.setAttribute(k, v === true ? "" : v);
    });
    [].concat(kids || []).forEach(function (c) { if (c == null || c === false) return; el.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
    return el;
  }
  function msg(id, kind, text) { var el = $(id); if (!el) return; el.className = "su-status" + (text ? " su-status--" + kind : ""); el.textContent = text || ""; }
  function show(id, on) { var el = $(id); if (el) el.hidden = !on; }
  function q(p) { return Promise.resolve(p).then(function (r) { if (r && r.error) throw r.error; return r ? r.data : null; }); }
  function isMissing(err) {
    if (!err) return false;
    var c = String(err.code || ""), m = String(err.message || "");
    return c === "42P01" || c === "42703" || c === "PGRST205" || c === "PGRST204" || /does not exist|could not find/i.test(m);
  }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function today() { var d = new Date(); return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function fmtDay(s) { if (!s) return ""; try { var p = String(s).slice(0, 10).split("-"); return new Date(+p[0], +p[1] - 1, +p[2]).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }); } catch (e) { return s; } }
  function money(n) { return "$" + Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 }); }
  function val(f, n) { var x = f.elements[n] && f.elements[n].value != null ? String(f.elements[n].value).trim() : ""; return x === "" ? null : x; }
  var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  function enter(nodes) { if (window.gsap && !reduce && nodes && nodes.length) window.gsap.from(nodes, { y: 10, opacity: 0, duration: 0.32, stagger: 0.03, ease: "power2.out", clearProps: "all" }); }

  // "?" help for boxes drawn by this script (site.js only covers boxes that exist when the page loads)
  var helpN = 0;
  function helpFor(label, text) {
    var id = "pt-help-" + (++helpN);
    var t = h("p", { className: "help-t", id: id, hidden: true, text: text });
    var b = h("button", { type: "button", className: "help-q", text: "?", "aria-expanded": "false", "aria-controls": id, "aria-label": "What is " + label + "?",
      on: { click: function () { var open = t.hidden; t.hidden = !open; b.setAttribute("aria-expanded", open ? "true" : "false"); } } });
    return { btn: b, text: t };
  }
  function boxHead(tag, title, label, text, cls) {
    var hp = helpFor(label, text);
    return [h(tag, { className: "pt-box-h" + (cls ? " " + cls : "") }, [h("span", { text: title }), hp.btn]), hp.text];
  }

  // ---------- derived data ----------
  function resOf(pid) { return P.res.filter(function (r) { return r.partner_id === pid; }); }
  function deliveredValue(list) { return list.filter(function (r) { return r.status === "deployed"; }).reduce(function (s, r) { return s + (r.value_usd != null ? Number(r.value_usd) : 0); }, 0); }
  function partnerById(id) { for (var i = 0; i < P.partners.length; i++) if (P.partners[i].id === id) return P.partners[i]; return null; }
  function filtered() {
    return P.partners.filter(function (p) { return (!P.kind || p.kind === P.kind) && (!P.ndaOpen || p.nda_status !== "signed"); });
  }
  function canEdit() { var m = P.me || {}; return m.active !== false && (m.role === "admin" || m.role === "leadership" || m.role === "student_lead"); }
  function canDelete() { var m = P.me || {}; return m.active !== false && (m.role === "admin" || m.role === "leadership"); }
  function paperChip(which, status) {
    return h("span", { className: "tk-chip pt-paper p-" + status, text: which + ": " + PAPER[status] });
  }
  function kindChip(k) { return h("span", { className: "tk-chip pt-kind k-" + k, text: KIND[k] || k }); }
  function rstChip(s) { return h("span", { className: "tk-chip pt-rst r-" + s, text: RST[s] || s }); }

  // ---------- hover card: only on the partner NAME ----------
  var card = null, cardFor = null, hideT = null;
  function hoverCard() { if (!card) { card = h("div", { className: "tk-pv pt-pv", "aria-hidden": "true" }); document.body.appendChild(card); } return card; }
  function ring(done, total) {
    var pct = total ? done / total : 0, c = 2 * Math.PI * 22, ns = "http://www.w3.org/2000/svg", svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", "0 0 56 56"); svg.setAttribute("class", "tk-ring"); svg.setAttribute("aria-hidden", "true");
    [["tk-ring-bg", null], ["tk-ring-fg", (c * pct).toFixed(1) + " " + c.toFixed(1)]].forEach(function (x) {
      var e = document.createElementNS(ns, "circle"); e.setAttribute("cx", 28); e.setAttribute("cy", 28); e.setAttribute("r", 22); e.setAttribute("class", x[0]);
      if (x[1]) e.setAttribute("stroke-dasharray", x[1]); svg.appendChild(e);
    });
    var tx = document.createElementNS(ns, "text"); tx.setAttribute("x", 28); tx.setAttribute("y", 32); tx.setAttribute("text-anchor", "middle"); tx.textContent = total ? done + "/" + total : "0";
    svg.appendChild(tx); return svg;
  }
  function fillCard(pid) {
    var p = partnerById(pid); if (!p) return false;
    var rs = resOf(pid), dep = rs.filter(function (r) { return r.status === "deployed"; }).length, c = hoverCard(); c.textContent = "";
    c.appendChild(h("div", { className: "tk-pv-top" }, [ring(dep, rs.length), h("div", null, [h("b", { text: p.name }), h("small", null, [kindChip(p.kind)])])]));
    c.appendChild(h("p", { className: "pt-pv-chips" }, [paperChip("NDA", p.nda_status), " ", paperChip("MOU", p.mou_status)]));
    if (p.other_agreement && p.other_agreement !== "none") c.appendChild(h("p", { className: "tk-pv-sum", text: OTHER[p.other_agreement] + ": " + PAPER[p.other_agreement_status] }));
    c.appendChild(h("p", { className: "tk-pv-sum", text: rs.length + " resource" + (rs.length === 1 ? "" : "s") + " · " + dep + " deployed" }));
    c.appendChild(h("p", { className: "tk-pv-sum", text: "Value delivered: " + money(deliveredValue(rs)) }));
    return true;
  }
  function placeCard(el) {
    var c = hoverCard(), r = el.getBoundingClientRect(), w = Math.min(280, innerWidth - 16);
    c.style.width = w + "px";
    var x = Math.min(Math.max(8, r.left), innerWidth - w - 8), hgt = c.offsetHeight || 180, y = r.bottom + 8;
    if (y + hgt > innerHeight - 8) y = Math.max(8, r.top - hgt - 8);
    c.style.left = x + "px"; c.style.top = y + "px"; c.classList.add("on");
  }
  function showCard(el) { clearTimeout(hideT); if (!P || !fillCard(el.getAttribute("data-pid"))) return; cardFor = el; placeCard(el); }
  function hideCard() { hideT = setTimeout(function () { if (card) card.classList.remove("on"); cardFor = null; }, 60); }
  function bindHover() {
    if (bindHover.done) return; bindHover.done = true;
    var sel = ".pt-name[data-pid]";
    document.addEventListener("pointerover", function (e) { var el = e.target.closest && e.target.closest(sel); if (el && e.pointerType !== "touch" && el !== cardFor) showCard(el); });
    document.addEventListener("pointerout", function (e) { var el = e.target.closest && e.target.closest(sel); if (el && !el.contains(e.relatedTarget)) hideCard(); });
    document.addEventListener("focusin", function (e) { var el = e.target.closest && e.target.closest(sel); if (el) showCard(el); });
    document.addEventListener("focusout", function (e) { var el = e.target.closest && e.target.closest(sel); if (el) hideCard(); });
    addEventListener("scroll", function () {
      if (!card || !cardFor) return;
      if (cardFor.isConnected && (cardFor.matches(":hover") || cardFor === document.activeElement)) placeCard(cardFor); else { card.classList.remove("on"); cardFor = null; }
    }, { passive: true });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && card) { card.classList.remove("on"); cardFor = null; } });
    // a click on a name hides the card straight away (the partner page opens instead)
    document.addEventListener("click", function (e) { if (card && e.target.closest && e.target.closest(sel)) { card.classList.remove("on"); cardFor = null; } }, true);
  }
  function nameLink(p) { return h("a", { className: "pt-name", href: "#partners/p/" + p.id, "data-pid": p.id, text: p.name }); }

  // ---------- loading ----------
  function load() {
    return Promise.all([
      q(P.db.from("partners").select("id,created_at,updated_at,name,kind,contact_name,contact_email,notes,nda_status,nda_signed_on,mou_status,mou_signed_on,other_agreement,other_agreement_status,created_by").order("name").limit(1000)),
      q(P.db.from("partner_resources").select("id,partner_id,created_at,what_offered,what_delivered,value_usd,date_offered,date_deployed,status,notes,created_by").order("date_offered", { ascending: true }).limit(5000))
    ]).then(function (r) { P.partners = r[0] || []; P.res = r[1] || []; P.notSetUp = false; P.loadErr = false; P.loaded = true; })
      .catch(function (e) { if (isMissing(e)) P.notSetUp = true; else P.loadErr = true; P.loaded = true; });
  }
  function refresh(animate) { if (!P) return Promise.resolve(); return load().then(function () { paint(animate); }); }

  // ---------- painting ----------
  function paint(animate) {
    if (!P) return;
    var r = P.route || "partners", m;
    var add = r === "partners/add", one = (m = /^partners\/p\/([0-9a-f-]{8,})$/i.exec(r)) ? m[1] : null;
    if (P.notSetUp) { show("pt-main", true); show("pt-add", false); show("pt-view", false); setupNote(); return; }
    show("pt-tools-wrap", true);
    show("pt-add-btn", canEdit());
    if (add && !canEdit()) add = false;
    show("pt-main", !add && !one); show("pt-add", add); show("pt-view", !!one);
    if (P.loadErr) msg("pt-status", "err", "Partners could not load. Try again in a moment.");
    if (one) renderView(one, animate);
    else if (!add) { renderSummary(); renderList(animate); }
  }
  function setupNote() {
    show("pt-tools-wrap", false); var s = $("pt-summary"); if (s) s.textContent = "";
    var host = $("pt-list"); host.textContent = "";
    host.appendChild(h("li", { className: "pt-setup" }, [h("div", { className: "launch wide" }, [h("span", { className: "tag", text: "Coming soon" }), h("h3", { text: "Partners list is being set up" }),
      h("p", { text: "The partner tables are not switched on in the database yet. Tasks, leads, the activity log and uploads still work." })])]));
  }
  function tile(label, big, small, helpText) {
    var hp = helpFor(label, helpText);
    return h("div", { className: "pt-tile" }, [h("p", { className: "pt-tile-h" }, [h("span", { text: label }), hp.btn]), hp.text, h("p", { className: "pt-big", text: big }), h("p", { className: "pt-small", text: small })]);
  }
  function renderSummary() {
    var host = $("pt-summary"); host.textContent = "";
    var all = P.partners, res = P.res, dep = res.filter(function (r) { return r.status === "deployed"; });
    var byKind = KIND_ORDER.map(function (k) { return KIND[k] + " " + all.filter(function (p) { return p.kind === k; }).length; }).join(" · ");
    var ndaOpen = all.filter(function (p) { return p.nda_status !== "signed"; }).length;
    host.appendChild(tile("Partners", String(all.length), byKind, "How many partners are on the list, split by kind: resource partners give equipment, space or services; sponsors give money; program partners run programs with us."));
    host.appendChild(tile("NDA signed", (all.length - ndaOpen) + " of " + all.length, ndaOpen ? ndaOpen + " still need to sign" : "Everyone has signed", "Every potential partner must sign a non-disclosure agreement (NDA) before we share plans or budgets. This counts how many have signed."));
    host.appendChild(tile("Resources deployed", String(dep.length), "of " + res.length + " offered in total", "A resource is deployed when the partner has actually delivered it. Offered and confirmed ones are still on the way."));
    host.appendChild(tile("Value delivered", money(deliveredValue(res)), "from deployed resources", "The dollar value added up from every resource marked deployed."));
  }
  function renderList(animate) {
    var host = $("pt-list"); host.textContent = "";
    var list = filtered();
    $("pt-kind").value = P.kind || ""; $("pt-nda-open").checked = !!P.ndaOpen;
    if (!P.partners.length) { host.appendChild(h("li", { className: "tk-empty", text: canEdit() ? "No partners yet. Select Add partner to put the first one in." : "No partners yet." })); return; }
    if (!list.length) { host.appendChild(h("li", { className: "tk-empty", text: "No partners match these filters." })); return; }
    list.forEach(function (p) {
      var rs = resOf(p.id), dep = rs.filter(function (r) { return r.status === "deployed"; }).length;
      host.appendChild(h("li", { className: "pt-row", "data-partner": p.id }, [
        h("div", { className: "pt-row-who" }, [h("b", null, [nameLink(p)]), h("p", { className: "pt-chips" }, [kindChip(p.kind), paperChip("NDA", p.nda_status), paperChip("MOU", p.mou_status)])]),
        h("p", { className: "pt-row-num" }, [h("b", { text: String(rs.length) }), h("small", { text: rs.length === 1 ? "resource" : "resources" })]),
        h("p", { className: "pt-row-num" }, [h("b", { text: String(dep) }), h("small", { text: "deployed" })]),
        h("p", { className: "pt-row-num" }, [h("b", { text: money(deliveredValue(rs)) }), h("small", { text: "delivered" })])
      ]));
    });
    if (animate) enter(host.querySelectorAll(".pt-row"));
  }

  // ---------- one partner ----------
  function paperSelect(id, cur, disabled) {
    return h("select", { id: id, disabled: disabled ? true : null }, PAPER_ORDER.map(function (s) { return h("option", { value: s, text: PAPER[s], selected: s === cur ? true : null }); }));
  }
  function savePartner(p, patch, statusId, el, okText) {
    if (el) el.disabled = true; msg(statusId, "busy", "Saving…");
    return q(P.db.from("partners").update(patch).eq("id", p.id)).then(function () { return refresh(false).then(function () { msg(statusId, "ok", okText || "Saved."); }); })
      .catch(function () { if (el) el.disabled = false; msg(statusId, "err", "That did not save. Try again."); return refresh(false); });
  }
  function paperBox(p, which, key, sid) {
    var st = p[key + "_status"], on = p[key + "_signed_on"], ed = canEdit();
    var sel = paperSelect("pv-" + key, st, !ed), date = h("input", { type: "date", id: "pv-" + key + "-on", value: on ? String(on).slice(0, 10) : "", disabled: !ed ? true : null });
    if (ed) {
      sel.addEventListener("change", function () {
        var patch = {}; patch[key + "_status"] = sel.value;
        if (sel.value === "signed" && !date.value) patch[key + "_signed_on"] = today();
        if (sel.value !== "signed") patch[key + "_signed_on"] = null;
        savePartner(p, patch, sid, sel, which + " is now " + PAPER[sel.value] + ".");
      });
      date.addEventListener("change", function () { var patch = {}; patch[key + "_signed_on"] = date.value || null; savePartner(p, patch, sid, date, which + " signed-on date saved."); });
    }
    return h("div", { className: "pt-paper-box s-" + st }, [
      h("div", { className: "f" }, [h("label", { "for": "pv-" + key, text: which + " status" }), sel]),
      h("div", { className: "f" }, [h("label", { "for": "pv-" + key + "-on", text: which + " signed on" }), date])
    ]);
  }
  function otherBox(p, sid) {
    var ed = canEdit();
    var kindSel = h("select", { id: "pv-other", disabled: !ed ? true : null }, Object.keys(OTHER).map(function (k) { return h("option", { value: k, text: OTHER[k], selected: k === p.other_agreement ? true : null }); }));
    var stSel = paperSelect("pv-other-status", p.other_agreement_status, !ed || p.other_agreement === "none");
    if (ed) {
      kindSel.addEventListener("change", function () { savePartner(p, { other_agreement: kindSel.value }, sid, kindSel, "Other agreement saved."); });
      stSel.addEventListener("change", function () { savePartner(p, { other_agreement_status: stSel.value }, sid, stSel, OTHER[p.other_agreement] + " is now " + PAPER[stSel.value] + "."); });
    }
    return h("div", { className: "pt-paper-box" }, [
      h("div", { className: "f" }, [h("label", { "for": "pv-other", text: "Other agreement" }), kindSel]),
      h("div", { className: "f" }, [h("label", { "for": "pv-other-status", text: "Its status" }), stSel])
    ]);
  }
  function timelineItem(p, r, sid) {
    var li = h("li", { className: "pt-tl-item r-" + r.status, "data-res": r.id }, [
      h("div", { className: "pt-tl-top" }, [h("b", { className: "pt-tl-what", text: r.what_offered }), rstChip(r.status)]),
      h("ol", { className: "pt-steps", "aria-label": "Dates" }, [
        h("li", { className: "pt-step" + (r.date_offered ? " is-on" : "") }, [h("span", { className: "pt-dot", "aria-hidden": "true" }), h("span", { text: "Offered " + (r.date_offered ? fmtDay(r.date_offered) : "(no date)") })]),
        h("li", { className: "pt-step" + (r.date_deployed ? " is-on" : "") }, [h("span", { className: "pt-dot", "aria-hidden": "true" }),
          h("span", { text: r.date_deployed ? "Deployed " + fmtDay(r.date_deployed) : r.status === "declined" ? "Declined" : "Not deployed yet" })])
      ]),
      r.what_delivered ? h("p", { className: "tk-meta", text: "Delivered: " + r.what_delivered }) : null,
      r.value_usd != null ? h("p", { className: "tk-meta", text: "Value: " + money(r.value_usd) }) : null,
      r.notes ? h("p", { className: "tk-meta pt-notes", text: r.notes }) : null
    ]);
    if (canEdit()) li.appendChild(resEdit(p, r, sid));
    return li;
  }
  function field(id, label, input) { return h("div", { className: "f" }, [h("label", { "for": id, text: label }), input]); }
  function resEdit(p, r, sid) {
    var k = r.id.replace(/[^a-z0-9]/gi, "").slice(0, 16);
    var st = h("select", { id: "re-st-" + k, name: "status" }, RST_ORDER.map(function (s) { return h("option", { value: s, text: RST[s], selected: s === r.status ? true : null }); }));
    var f = h("form", { className: "su-form pt-res-edit", "aria-label": "Update " + r.what_offered }, [
      field("re-st-" + k, "Status", st),
      field("re-dep-" + k, "Date deployed", h("input", { id: "re-dep-" + k, name: "date_deployed", type: "date", value: r.date_deployed ? String(r.date_deployed).slice(0, 10) : "" })),
      h("div", { className: "f full" }, [h("label", { "for": "re-del-" + k, text: "What they delivered" }), h("input", { id: "re-del-" + k, name: "what_delivered", type: "text", maxlength: "500", value: r.what_delivered || "" })]),
      field("re-val-" + k, "Value (USD)", h("input", { id: "re-val-" + k, name: "value_usd", type: "number", min: "0", step: "0.01", value: r.value_usd != null ? String(r.value_usd) : "" })),
      h("div", { className: "actions" }, [h("button", { type: "submit", className: "btn gold", text: "Save" }),
        canDelete() ? h("button", { type: "button", className: "btn line tk-warn", text: "Remove", on: { click: function (e) { removeRes(p, r, sid, e.currentTarget); } } }) : null])
    ]);
    f.addEventListener("submit", function (e) {
      e.preventDefault(); if (!f.reportValidity()) return;
      var patch = { status: st.value, date_deployed: val(f, "date_deployed"), what_delivered: val(f, "what_delivered"), value_usd: val(f, "value_usd") == null ? null : Number(val(f, "value_usd")) };
      var bad = dateProblem(r.date_offered, patch.date_deployed, patch.status); if (bad) { msg(sid, "warn", bad); return; }
      var b = f.querySelector("[type=submit]"); b.disabled = true; msg(sid, "busy", "Saving…");
      q(P.db.from("partner_resources").update(patch).eq("id", r.id)).then(function () { return refresh(false).then(function () { msg(sid, "ok", "“" + r.what_offered + "” saved as " + RST[patch.status] + "."); }); })
        .catch(function () { b.disabled = false; msg(sid, "err", "That did not save. Try again."); });
    });
    return h("details", { className: "pt-res-more" }, [h("summary", { text: "Update this resource" }), f]);
  }
  function dateProblem(offered, deployed, status) {
    if (status === "deployed" && !deployed) return "Add the date it was deployed.";
    if (offered && deployed && String(deployed) < String(offered).slice(0, 10)) return "The deployed date cannot be before the offered date.";
    return "";
  }
  function removeRes(p, r, sid, btn) {
    if (!confirm("Remove “" + r.what_offered + "” from " + p.name + "? This cannot be undone.")) return;
    btn.disabled = true; msg(sid, "busy", "Removing…");
    q(P.db.from("partner_resources").delete().eq("id", r.id)).then(function () { return refresh(false).then(function () { msg(sid, "ok", "Removed."); }); })
      .catch(function () { btn.disabled = false; msg(sid, "err", "It was not removed. Try again."); });
  }
  function removePartner(p, btn) {
    if (!confirm("Remove " + p.name + " and all of its resources? This cannot be undone.")) return;
    btn.disabled = true; msg("pv-status", "busy", "Removing…");
    q(P.db.from("partners").delete().eq("id", p.id)).then(function () { location.hash = "#partners"; return refresh(false).then(function () { msg("pt-status", "ok", p.name + " was removed."); }); })
      .catch(function () { btn.disabled = false; msg("pv-status", "err", "It was not removed. Try again."); });
  }
  function addResForm(p, sid) {
    var f = h("form", { className: "su-form pt-add-res", id: "pr-form", "aria-label": "Add a resource" }, [
      h("div", { className: "f full" }, [h("label", { "for": "pr-offered", html: null }, ["What they offered ", h("span", { className: "req", "aria-hidden": "true", text: "*" })]), h("input", { id: "pr-offered", name: "what_offered", type: "text", maxlength: "500", required: true, placeholder: "e.g. 10 VR headsets, lab time, $5,000 for camp" })]),
      field("pr-date-offered", "Date offered", h("input", { id: "pr-date-offered", name: "date_offered", type: "date", value: today() })),
      field("pr-status", "Status", h("select", { id: "pr-status", name: "status" }, RST_ORDER.map(function (s) { return h("option", { value: s, text: RST[s] }); }))),
      field("pr-value", "Value (USD)", h("input", { id: "pr-value", name: "value_usd", type: "number", min: "0", step: "0.01" })),
      field("pr-date-deployed", "Date deployed", h("input", { id: "pr-date-deployed", name: "date_deployed", type: "date" })),
      h("div", { className: "f full" }, [h("label", { "for": "pr-delivered", text: "What they delivered" }), h("input", { id: "pr-delivered", name: "what_delivered", type: "text", maxlength: "500" })]),
      h("div", { className: "f full" }, [h("label", { "for": "pr-notes", text: "Notes" }), h("textarea", { id: "pr-notes", name: "notes", maxlength: "2000" })]),
      h("div", { className: "actions" }, [h("button", { type: "submit", className: "btn gold", text: "Add resource" })])
    ]);
    f.addEventListener("submit", function (e) {
      e.preventDefault(); if (!f.reportValidity()) return;
      var row = { partner_id: p.id, what_offered: val(f, "what_offered"), date_offered: val(f, "date_offered"), status: val(f, "status") || "offered",
                  value_usd: val(f, "value_usd") == null ? null : Number(val(f, "value_usd")), date_deployed: val(f, "date_deployed"), what_delivered: val(f, "what_delivered"), notes: val(f, "notes") };
      var bad = dateProblem(row.date_offered, row.date_deployed, row.status); if (bad) { msg(sid, "warn", bad); return; }
      var b = f.querySelector("[type=submit]"); b.disabled = true; msg(sid, "busy", "Saving…");
      q(P.db.from("partner_resources").insert(row)).then(function () { P.clearAddRes = true; return refresh(false).then(function () { msg("pv-status", "ok", "Resource added to " + p.name + "."); }); })
        .catch(function () { b.disabled = false; msg(sid, "err", "Not saved. Check the fields and try again."); });
    });
    return f;
  }
  function renderView(pid, animate) {
    var host = $("pt-view"); if (!host) return;
    var keep = {}; host.querySelectorAll("#pr-form input, #pr-form select, #pr-form textarea").forEach(function (el) { keep[el.id] = el.value; });
    var openRes = {}; host.querySelectorAll("details.pt-res-more[open]").forEach(function (d) { var li = d.closest("[data-res]"); if (li) openRes[li.getAttribute("data-res")] = 1; });
    var addOpen = host.querySelector("#pt-addres-box") ? host.querySelector("#pt-addres-box").open : false;
    var focus = document.activeElement && host.contains(document.activeElement) ? document.activeElement.id : null;
    var statusText = $("pv-status") ? [$("pv-status").className, $("pv-status").textContent] : null;
    host.textContent = "";
    var back = h("p", null, [h("a", { className: "tk-back", href: "#partners", text: "Back to Partners" })]);
    host.appendChild(back);
    var p = partnerById(pid);
    if (!p) { host.appendChild(h("h3", { text: "Partner not found" })); host.appendChild(h("p", { text: "This partner was removed, or the link is wrong." })); return; }
    var sid = "pv-status", rs = resOf(p.id).slice().sort(function (a, b) { return String(a.date_offered || "9999") < String(b.date_offered || "9999") ? -1 : String(a.date_offered || "9999") > String(b.date_offered || "9999") ? 1 : String(a.created_at) < String(b.created_at) ? -1 : 1; });
    host.appendChild(h("div", { className: "pt-head" }, [h("h3", { className: "pt-title", id: "pv-title", text: p.name }), h("p", { className: "pt-chips" }, [kindChip(p.kind), paperChip("NDA", p.nda_status), paperChip("MOU", p.mou_status)])]));
    if (p.nda_status !== "signed") host.appendChild(h("p", { className: "pt-warn", role: "note" }, [h("b", { text: "NDA not signed. " }), "Sign the NDA before sharing plans or budgets."]));
    var st = h("p", { className: "su-status", id: sid, role: "status", "aria-live": "polite" }); host.appendChild(st);
    if (statusText) { st.className = statusText[0]; st.textContent = statusText[1]; }
    // about
    var about = h("div", { className: "pt-box" }, boxHead("h4", "About this partner", "about this partner", "Who the partner is and who to talk to there. The kind says what they mainly give: resources, money (sponsor), or a program."));
    var em = p.contact_email && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(p.contact_email) ? h("a", { href: "mailto:" + p.contact_email, text: p.contact_email }) : (p.contact_email || null);
    about.appendChild(h("dl", { className: "pt-dl" }, [
      h("dt", { text: "Kind" }), h("dd", { text: KIND[p.kind] || p.kind }),
      h("dt", { text: "Contact" }), h("dd", null, [p.contact_name || (em ? "" : "Not added yet"), p.contact_name && em ? " · " : "", em]),
      h("dt", { text: "Notes" }), h("dd", { className: "pt-notes", text: p.notes || "None" })
    ]));
    host.appendChild(about);
    // paperwork
    var paper = h("div", { className: "pt-box" }, boxHead("h4", "Paperwork", "the paperwork", "Every potential partner must sign an NDA (it keeps our plans and budgets private) and gets an MOU (it writes down what each side will do). Change a status as it moves: Not started, Drafted, Sent, Signed. Picking Signed fills in today's date; change the date if it was signed another day. Other agreement is for an MOA, a sponsor agreement or anything else." + (canEdit() ? "" : " Only managers and student leads can change these.")));
    paper.appendChild(h("div", { className: "pt-paper-grid" }, [paperBox(p, "NDA", "nda", sid), paperBox(p, "MOU", "mou", sid), otherBox(p, sid)]));
    host.appendChild(paper);
    // timeline
    var dep = rs.filter(function (r) { return r.status === "deployed"; }).length;
    var tl = h("div", { className: "pt-box" }, boxHead("h4", "Resources: offered to deployed", "the resources timeline", "Everything this partner offered, oldest first. Each one shows the date it was offered and the date it was deployed (actually delivered). Status: Offered, Confirmed (they said yes), Deployed (it arrived), Declined." + (canEdit() ? " Open Update this resource to change its status, dates, what arrived and its value." : "")));
    tl.appendChild(h("p", { className: "tk-meta", text: rs.length + " offered · " + dep + " deployed · " + money(deliveredValue(rs)) + " delivered" }));
    var ul = h("ol", { className: "pt-tl", "aria-label": "Resources from " + p.name }, rs.length ? rs.map(function (r) { return timelineItem(p, r, sid); }) : [h("li", { className: "tk-empty", text: "No resources yet." })]);
    tl.appendChild(ul);
    host.appendChild(tl);
    if (canEdit()) {
      var addBox = h("details", { className: "tk-quick pt-box", id: "pt-addres-box", open: addOpen ? true : null }, [h("summary", { text: "Add resource" })]);
      var hp = helpFor("adding a resource", "Write down something this partner offered. Only What they offered is required. If it already arrived, set Status to Deployed and add the date deployed.");
      addBox.appendChild(h("p", { className: "pt-box-h pt-inbox-h" }, [h("span", { text: "New resource for " + p.name }), hp.btn])); addBox.appendChild(hp.text);
      addBox.appendChild(addResForm(p, sid));
      host.appendChild(addBox);
    }
    if (canDelete()) host.appendChild(h("div", { className: "tk-danger" }, [h("button", { type: "button", className: "btn line tk-warn", text: "Remove this partner", on: { click: function (e) { removePartner(p, e.currentTarget); } } })]));
    host.appendChild(h("p", null, [h("a", { className: "tk-back", href: "#partners", text: "Back to Partners" })]));
    // keep a half-typed resource across refreshes, but start clean after one was saved
    if (!P.clearAddRes) Object.keys(keep).forEach(function (id) { var el = $(id); if (el) el.value = keep[id]; });
    P.clearAddRes = false;
    Object.keys(openRes).forEach(function (rid) { var d = host.querySelector("[data-res='" + rid + "'] details.pt-res-more"); if (d) d.open = true; });
    if (focus && $(focus)) $(focus).focus();
    if (animate) enter(host.querySelectorAll(".pt-box"));
  }

  // ---------- add partner ----------
  function addPartner(e) {
    e.preventDefault(); var f = e.target; if (!f.reportValidity()) return;
    var row = { name: val(f, "name"), kind: val(f, "kind"), contact_name: val(f, "contact_name"), contact_email: val(f, "contact_email"), notes: val(f, "notes"),
                nda_status: val(f, "nda_status") || "not_started", mou_status: val(f, "mou_status") || "not_started", other_agreement: val(f, "other_agreement") || "none" };
    var b = f.querySelector("[type=submit]"); b.disabled = true; msg("pa-status", "busy", "Saving…");
    q(P.db.from("partners").insert(row).select("id").single()).then(function (d) {
      b.disabled = false; f.reset(); msg("pa-status", "", "");
      location.hash = "#partners/p/" + d.id;
      return refresh(true).then(function () { msg("pv-status", "ok", row.name + " was added. Add what they offered below."); });
    }).catch(function () { b.disabled = false; msg("pa-status", "err", "Not saved. Check the fields and try again."); });
  }

  var bound = false;
  function bindOnce() {
    if (bound) return; bound = true; bindHover();
    $("pt-kind").addEventListener("change", function () { if (!P) return; P.kind = $("pt-kind").value; renderList(true); });
    $("pt-nda-open").addEventListener("change", function () { if (!P) return; P.ndaOpen = $("pt-nda-open").checked; renderList(true); });
    $("pa-form").addEventListener("submit", addPartner);
  }

  window.XRPartners = {
    start: function (db, me) {
      P = { db: db, me: me || {}, partners: [], res: [], kind: "", ndaOpen: false, route: "partners", notSetUp: false, loaded: false };
      bindOnce();
      return refresh(false);
    },
    setMe: function (me) { if (P && me) P.me = me; },
    show: function (route) {
      if (!P) return;
      var changed = route !== P.route; P.route = route || "partners";
      paint(changed);
      refresh(false);
      if (changed && /^partners\/(add|p\/)/.test(P.route)) { var sec = $("t-partners"); if (sec && sec.getBoundingClientRect().top < 0) sec.scrollIntoView(); }
      if (P.route === "partners/add") { var n = $("pa-name"); if (n) n.focus(); }
    },
    stop: function () { if (card) card.classList.remove("on"); P = null; show("t-partners", false); },
    _state: function () { return P; }
  };
})();
