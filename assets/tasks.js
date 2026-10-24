/* XR Jags staff dashboard: team tasks + member management (/dashboard).
   Tables and rules: su-shared/migration-tasks.sql (Block 3). Member logins: Edge Function "admin-members".
   dashboard.js calls XRTasks.start(db, user, reveal) after sign-in and XRTasks.stop() on sign-out.
   Plain words on screen: task, To do, Working on it, Ready for review, Done.
   The database decides who sees what (members: only tasks they are on or made; managers: everything).
   Every value from the database goes on screen with textContent, never as HTML. Checks for new data every 30 s. */
(function () {
  "use strict";
  var ST = { todo: "To do", doing: "Working on it", review: "Ready for review", done: "Done" };
  var ORDER = ["todo", "doing", "review", "done"];
  var ROLE = { student: "Student", student_lead: "Student lead", leadership: "Leadership", admin: "Admin (director)" };
  var TABS = ["my-tasks", "team-tasks", "team", "deleted", "leads", "activity", "uploads", "partners"];
  var MGR_TABS = ["team-tasks", "team", "deleted"];
  var TAB_NAME = { "my-tasks": "My tasks", "team-tasks": "Team tasks", team: "Team", deleted: "Deleted", leads: "Leads", activity: "Activity log", uploads: "Uploads", partners: "Partners" };
  var POLL_MS = 30000;
  var $ = function (id) { return document.getElementById(id); };

  var S = null; // state for the signed-in session

  // ---------- small helpers ----------
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
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function today() { var d = new Date(); return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function dayDate(s) { var p = String(s).slice(0, 10).split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function fmtDay(s) { try { return dayDate(s).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }); } catch (e) { return s; } }
  function fmtWhen(s) { try { return new Date(s).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }); } catch (e) { return s; } }
  function weekStart() { var d = new Date(); d.setHours(0, 0, 0, 0); var wd = (d.getDay() + 6) % 7; d.setDate(d.getDate() - wd); return d; }
  function initials(n) { return String(n || "?").trim().split(/\s+/).slice(0, 2).map(function (w) { return w.charAt(0).toUpperCase(); }).join("") || "?"; }
  function nameOf(uid) { var p = S && S.byId[uid]; return p ? p.full_name : "Someone"; }
  function isOverdue(t) { return !!t.due_date && t.status !== "done" && String(t.due_date).slice(0, 10) < today(); }
  function lines(txt) { return String(txt || "").split(/\r?\n/).map(function (l) { return l.trim(); }).filter(Boolean).slice(0, 40).map(function (l) { return l.slice(0, 300); }); }
  function isMissing(err) {
    if (!err) return false;
    var c = String(err.code || ""), m = String(err.message || "");
    return c === "42P01" || c === "42703" || c === "PGRST205" || c === "PGRST204" || c === "PGRST202" || /does not exist|could not find/i.test(m);
  }
  function q(p) { return Promise.resolve(p).then(function (r) { if (r && r.error) throw r.error; return r ? r.data : null; }); }
  function plainErr(e, fallback) {
    var m = e && e.message ? String(e.message) : "";
    // our own database messages are already plain words; anything technical gets the fallback
    if (/^(Only |Say why|That person|This task)/.test(m)) return m;
    return fallback;
  }
  var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  function enter(nodes) { if (window.gsap && !reduce && nodes && nodes.length) window.gsap.from(nodes, { y: 10, opacity: 0, duration: 0.32, stagger: 0.03, ease: "power2.out", clearProps: "all" }); }

  // ---------- derived data ----------
  function membersOf(tid) { return S.members[tid] || []; }
  function stepsOf(tid) { return (S.checklist[tid] || []).slice().sort(function (a, b) { return (a.position || 0) - (b.position || 0); }); }
  function stepCount(tid) { var s = S.checklist[tid] || []; return { done: s.filter(function (x) { return x.done; }).length, total: s.length }; }
  function liveTasks() { return S.tasks.filter(function (t) { return !t.deleted_at; }); }
  function myTasks() {
    var me = S.me.user_id;
    return liveTasks().filter(function (t) { var m = membersOf(t.id); return m.indexOf(me) > -1 || (t.created_by === me && !m.length); });
  }
  function canManage(t) { return !t.deleted_at && (S.isMgr || t.created_by === S.me.user_id); }
  function taskById(id) { for (var i = 0; i < S.tasks.length; i++) if (S.tasks[i].id === id) return S.tasks[i]; return null; }
  function activeStaff() { return S.staff.filter(function (p) { return p.active !== false; }); }

  // ---------- links + hover cards (only on the NAME / TITLE text) ----------
  function personLink(uid) {
    var p = S.byId[uid], label = p ? p.full_name : "Someone";
    var el = S.isMgr ? h("a", { className: "tk-name", href: "#team-tasks/person/" + uid, "data-uid": uid, text: label })
                     : h("span", { className: "tk-name", tabindex: "0", "data-uid": uid, text: label });
    return el;
  }
  function peopleList(uids) {
    var wrap = h("span", { className: "tk-people" });
    if (!uids.length) { wrap.appendChild(document.createTextNode("Nobody yet")); return wrap; }
    uids.forEach(function (u, i) { if (i) wrap.appendChild(document.createTextNode(", ")); wrap.appendChild(personLink(u)); });
    return wrap;
  }
  function taskLink(t, from) { return h("a", { className: "tk-title", href: "#task/" + t.id, "data-tid": t.id, "data-from": from || "", text: t.title }); }
  function bar(done, total) {
    var pct = total ? Math.round(done / total * 100) : 0;
    return h("span", { className: "tk-bar", role: "img", "aria-label": done + " of " + total + " steps done" }, [h("i", { style: "width:" + pct + "%" })]);
  }
  function ring(done, total) {
    var pct = total ? done / total : 0, c = 2 * Math.PI * 22;
    var ns = "http://www.w3.org/2000/svg", svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", "0 0 56 56"); svg.setAttribute("class", "tk-ring"); svg.setAttribute("aria-hidden", "true");
    var a = document.createElementNS(ns, "circle"); a.setAttribute("cx", 28); a.setAttribute("cy", 28); a.setAttribute("r", 22); a.setAttribute("class", "tk-ring-bg");
    var b = document.createElementNS(ns, "circle"); b.setAttribute("cx", 28); b.setAttribute("cy", 28); b.setAttribute("r", 22); b.setAttribute("class", "tk-ring-fg");
    b.setAttribute("stroke-dasharray", (c * pct).toFixed(1) + " " + c.toFixed(1));
    var tx = document.createElementNS(ns, "text"); tx.setAttribute("x", 28); tx.setAttribute("y", 32); tx.setAttribute("text-anchor", "middle"); tx.textContent = total ? Math.round(pct * 100) + "%" : "–";
    svg.appendChild(a); svg.appendChild(b); svg.appendChild(tx); return svg;
  }
  var card = null, cardFor = null, hideT = null;
  function hoverCard() {
    if (card) return card;
    card = h("div", { className: "tk-pv", "aria-hidden": "true" }); document.body.appendChild(card); return card;
  }
  function fillPerson(uid) {
    var p = S.byId[uid]; if (!p) return false;
    var open = liveTasks().filter(function (t) { return t.status !== "done" && membersOf(t.id).indexOf(uid) > -1; });
    var over = open.filter(isOverdue).length;
    var c = hoverCard(); c.textContent = "";
    c.appendChild(h("div", { className: "tk-pv-top" }, [h("span", { className: "tk-av", text: initials(p.full_name) }),
      h("div", null, [h("b", { text: p.full_name }), h("small", { text: (ROLE[p.role] || p.role) + (p.active === false ? " · access off" : "") })])]));
    c.appendChild(h("p", { className: "tk-pv-sum", text: open.length ? open.length + " open task" + (open.length === 1 ? "" : "s") + (over ? " · " + over + " overdue" : "") : "No open tasks" + (S.isMgr ? "" : " shared with you") }));
    if (open.length) c.appendChild(h("ul", null, open.slice(0, 5).map(function (t) {
      return h("li", null, [h("span", { className: "tk-chip s-" + t.status, text: ST[t.status] }), h("span", { className: isOverdue(t) ? "tk-od" : "", text: t.title })]);
    })));
    return true;
  }
  function fillTask(tid) {
    var t = taskById(tid); if (!t) return false;
    var sc = stepCount(t.id), c = hoverCard(); c.textContent = "";
    c.appendChild(h("div", { className: "tk-pv-top" }, [ring(sc.done, sc.total), h("div", null, [h("b", { text: t.title }), h("small", null, [h("span", { className: "tk-chip s-" + t.status, text: ST[t.status] })])])]));
    c.appendChild(h("p", { className: "tk-pv-sum" + (isOverdue(t) ? " tk-od" : ""), text: t.due_date ? (isOverdue(t) ? "Overdue: was due " : "Due ") + fmtDay(t.due_date) : "No due date" }));
    c.appendChild(h("p", { className: "tk-pv-sum", text: sc.total ? sc.done + " of " + sc.total + " checklist steps done" : "No checklist" }));
    var who = membersOf(t.id).map(nameOf).join(", ");
    c.appendChild(h("p", { className: "tk-pv-sum", text: "With: " + (who || "nobody yet") + (t.priority === "high" ? " · High priority" : "") }));
    return true;
  }
  function placeCard(el) {
    var c = hoverCard(), r = el.getBoundingClientRect(), w = Math.min(280, innerWidth - 16);
    c.style.width = w + "px";
    var x = Math.min(Math.max(8, r.left), innerWidth - w - 8);
    var hgt = c.offsetHeight || 200, y = r.bottom + 8;
    if (y + hgt > innerHeight - 8) y = Math.max(8, r.top - hgt - 8);
    c.style.left = x + "px"; c.style.top = y + "px"; c.classList.add("on");
  }
  function showCardFor(el) {
    clearTimeout(hideT);
    var ok = el.hasAttribute("data-uid") ? fillPerson(el.getAttribute("data-uid")) : fillTask(el.getAttribute("data-tid"));
    if (!ok) return; cardFor = el; placeCard(el);
  }
  function hideCard() { hideT = setTimeout(function () { if (card) card.classList.remove("on"); cardFor = null; }, 60); }
  function bindHover() {
    if (bindHover.done) return; bindHover.done = true;
    var sel = ".tk-name[data-uid], .tk-title[data-tid]";
    document.addEventListener("pointerover", function (e) { var el = e.target.closest && e.target.closest(sel); if (el && e.pointerType !== "touch" && el !== cardFor) showCardFor(el); });
    document.addEventListener("pointerout", function (e) { var el = e.target.closest && e.target.closest(sel); if (el && !el.contains(e.relatedTarget)) hideCard(); });
    document.addEventListener("focusin", function (e) { var el = e.target.closest && e.target.closest(sel); if (el) showCardFor(el); });
    document.addEventListener("focusout", function (e) { var el = e.target.closest && e.target.closest(sel); if (el) hideCard(); });
    // on scroll: follow the name if the pointer (or focus) is still on it, otherwise hide
    addEventListener("scroll", function () {
      if (!card || !cardFor) return;
      if (cardFor.isConnected && (cardFor.matches(":hover") || cardFor === document.activeElement)) placeCard(cardFor);
      else { card.classList.remove("on"); cardFor = null; }
    }, { passive: true });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && card) { card.classList.remove("on"); cardFor = null; } });
  }

  // ---------- status buttons ----------
  function moves(t) {
    var mine = S.isMgr || t.created_by === S.me.user_id;
    if (t.status === "todo") return [["Start", "doing", "gold"]];
    if (t.status === "doing") return [["Ready for review", "review", "gold"], ["Mark done", "done", "line"]];
    if (t.status === "review") return mine ? [["Mark done", "done", "gold"], ["Send back to Working on it", "doing", "line"]] : [["Still working on it", "doing", "line"]];
    return [["Open again", "doing", "line"]];
  }
  function moveButtons(t, statusId) {
    return h("div", { className: "tk-actions" }, moves(t).map(function (m) {
      return h("button", { type: "button", className: "btn " + m[2] + " tk-big", "data-move": m[1], text: m[0], on: { click: function (e) { setStatus(t, m[1], statusId, e.currentTarget); } } });
    }));
  }
  function setStatus(t, to, statusId, btn) {
    if (btn) btn.disabled = true;
    msg(statusId, "busy", "Saving…");
    q(S.db.from("tasks").update({ status: to }).eq("id", t.id)).then(function () {
      msg(statusId, "ok", "“" + t.title + "” is now " + ST[to] + ".");
      return refresh();
    }).catch(function (e) { if (btn) btn.disabled = false; msg(statusId, "err", plainErr(e, "That did not save. Try again.")); });
  }

  // ---------- one task card (My tasks) ----------
  var drafts = {};
  function draftBox(key, labelText, onPost) {
    var id = "upd-" + key.replace(/[^a-z0-9]/gi, "");
    var ta = h("textarea", { id: id, maxlength: "2000", rows: "2", value: drafts[key] || "", on: { input: function () { drafts[key] = ta.value; } } });
    var b = h("button", { type: "button", className: "btn line", text: "Post update", on: { click: function () {
      var body = ta.value.trim(); if (!body) { ta.focus(); return; }
      b.disabled = true; onPost(body).then(function (ok) { b.disabled = false; if (ok) { drafts[key] = ""; ta.value = ""; } });
    } } });
    return h("div", { className: "tk-post" }, [h("label", { "for": id, text: labelText }), ta, b]);
  }
  function postUpdate(t, body, statusId) {
    msg(statusId, "busy", "Posting…");
    return q(S.db.from("task_updates").insert({ task_id: t.id, body: body.slice(0, 2000) })).then(function () {
      msg(statusId, "ok", "Update posted on “" + t.title + "”."); refresh(); return true;
    }).catch(function (e) { msg(statusId, "err", plainErr(e, "The update was not posted. Try again.")); return false; });
  }
  function tick(step, done, statusId, box) {
    box.disabled = true;
    q(S.db.from("task_checklist").update({ done: done }).eq("id", step.id)).then(function () { step.done = done; box.disabled = false; refresh(); })
      .catch(function (e) { box.disabled = false; box.checked = !done; msg(statusId, "err", plainErr(e, "That step did not save. Try again.")); });
  }
  function checklistBlock(t, statusId) {
    var steps = stepsOf(t.id); if (!steps.length) return null;
    var sc = stepCount(t.id);
    return h("div", { className: "tk-check" }, [
      h("p", { className: "tk-check-h" }, [h("span", { text: "Checklist: " + sc.done + " of " + sc.total + " done" }), bar(sc.done, sc.total)]),
      h("ul", null, steps.map(function (s) {
        var id = "ck-" + s.id, box = h("input", { type: "checkbox", id: id, checked: s.done, disabled: !!t.deleted_at });
        box.addEventListener("change", function () { tick(s, box.checked, statusId, box); });
        return h("li", { className: s.done ? "is-done" : "" }, [box, h("label", { "for": id, text: s.text })]);
      }))
    ]);
  }
  function dueText(t) {
    if (!t.due_date) return h("span", { className: "tk-due", text: "No due date" });
    var od = isOverdue(t);
    return h("span", { className: "tk-due" + (od ? " tk-od" : ""), text: (od ? "Overdue: was due " : "Due ") + fmtDay(t.due_date) });
  }
  function myCard(t) {
    var statusId = "my-status";
    var from = t.created_by && t.created_by !== S.me.user_id ? h("span", null, ["From ", personLink(t.created_by)]) : null;
    var others = membersOf(t.id).filter(function (u) { return u !== S.me.user_id; });
    return h("article", { className: "tk-card" + (isOverdue(t) ? " is-od" : "") + (t.priority === "high" ? " is-high" : ""), "data-task": t.id }, [
      h("div", { className: "tk-top" }, [h("h3", null, [taskLink(t, "my-tasks")]), t.priority === "high" ? h("span", { className: "tk-chip high", text: "High priority" }) : null]),
      h("p", { className: "tk-meta" }, [dueText(t), from ? " · " : "", from, others.length ? " · With " : "", others.length ? peopleList(others) : null]),
      t.details ? h("p", { className: "tk-details", text: t.details.length > 220 ? t.details.slice(0, 220) + "…" : t.details }) : null,
      checklistBlock(t, statusId),
      moveButtons(t, statusId),
      t.status !== "done" ? draftBox("my:" + t.id, "Post an update on this task", function (b) { return postUpdate(t, b, statusId); }) : null,
      h("p", { className: "tk-open" }, [h("a", { href: "#task/" + t.id, "data-from": "my-tasks", text: "Open task (details, people, history)" })])
    ]);
  }

  // ---------- My tasks ----------
  function renderMy(animate) {
    var host = $("my-list"); if (!host) return;
    if (S.notSetUp) { setupNote(); return; }
    var focus = document.activeElement && host.contains(document.activeElement) ? document.activeElement.id : null;
    host.textContent = "";
    var mine = myTasks(), recent = Date.now() - 14 * 864e5;
    if (!mine.length) { host.appendChild(h("p", { className: "tk-empty", text: "No tasks for you right now. When the director gives you one, it shows up here." })); return; }
    ORDER.forEach(function (st) {
      var list = mine.filter(function (t) { return t.status === st && (st !== "done" || !t.done_at || new Date(t.done_at).getTime() > recent); });
      list.sort(function (a, b) { return (a.due_date || "9999") < (b.due_date || "9999") ? -1 : (a.due_date || "9999") > (b.due_date || "9999") ? 1 : 0; });
      var head = h("h3", { className: "tk-group-h" }, [h("span", { className: "tk-dot s-" + st, "aria-hidden": "true" }), ST[st] + " ", h("small", { text: "(" + list.length + ")" })]);
      var cards = h("div", { className: "tk-cards" }, list.length ? list.map(myCard) : [h("p", { className: "tk-empty", text: st === "done" ? "Nothing finished in the last two weeks." : "Nothing here." })]);
      if (st === "done") host.appendChild(h("details", { className: "tk-group tk-done-group", open: S.openDone ? true : null, on: { toggle: function (e) { S.openDone = e.currentTarget.open; } } }, [h("summary", null, [head]), cards]));
      else host.appendChild(h("section", { className: "tk-group", "aria-label": ST[st] }, [head, cards]));
    });
    if (focus && $(focus)) { var f = $(focus); f.focus(); if (f.setSelectionRange && typeof f.value === "string") { var n = f.value.length; f.setSelectionRange(n, n); } }
    if (animate) enter(host.querySelectorAll(".tk-card"));
  }
  function quickAdd(e) {
    e.preventDefault(); var f = e.target; if (!f.reportValidity()) return;
    var title = f.elements.title.value.trim(), due = f.elements.due_date.value || null, steps = lines(f.elements.steps.value);
    var btn = f.querySelector("[type=submit]"); btn.disabled = true; msg("tq-status", "busy", "Saving…");
    createTask({ title: title, due_date: due, priority: "normal" }, [S.me.user_id], steps).then(function () {
      btn.disabled = false; f.reset(); msg("tq-status", "ok", "Added to your tasks."); refresh(true);
    }).catch(function (er) { btn.disabled = false; msg("tq-status", "err", plainErr(er, "Not saved. Try again.")); });
  }
  function createTask(row, people, steps) {
    var id;
    return q(S.db.from("tasks").insert(row).select("id").single()).then(function (d) {
      id = d.id;
      return people.length ? q(S.db.from("task_members").insert(people.map(function (u) { return { task_id: id, user_id: u }; }))) : null;
    }).then(function () {
      return steps.length ? q(S.db.from("task_checklist").insert(steps.map(function (s, i) { return { task_id: id, text: s, position: i }; }))) : null;
    }).then(function () { return id; });
  }

  // ---------- Team tasks (managers) ----------
  function teamFilterOptions() {
    var sel = $("tt-person"); if (!sel) return; var keep = S.person || "";
    sel.textContent = ""; sel.appendChild(h("option", { value: "", text: "Everyone" }));
    activeStaff().forEach(function (p) { sel.appendChild(h("option", { value: p.user_id, text: p.full_name })); });
    sel.value = keep;
  }
  function teamTasks() {
    var list = liveTasks();
    if (S.person) list = list.filter(function (t) { return membersOf(t.id).indexOf(S.person) > -1 || (t.created_by === S.person && !membersOf(t.id).length); });
    return list;
  }
  function boardCard(t) {
    var sc = stepCount(t.id), selId = "mv-" + t.id;
    var sel = h("select", { id: selId }, ORDER.map(function (s) { return h("option", { value: s, text: ST[s], selected: s === t.status ? true : null }); }));
    sel.addEventListener("change", function () { setStatus(t, sel.value, "team-status", sel); });
    return h("article", { className: "tk-bcard" + (isOverdue(t) ? " is-od" : "") + (t.priority === "high" ? " is-high" : ""), "data-task": t.id }, [
      h("h4", null, [taskLink(t, "team-tasks")]),
      t.priority === "high" ? h("span", { className: "tk-chip high", text: "High priority" }) : null,
      h("p", { className: "tk-meta" }, [dueText(t)]),
      h("p", { className: "tk-meta" }, ["With ", peopleList(membersOf(t.id))]),
      sc.total ? h("p", { className: "tk-meta tk-steps" }, [h("span", { text: sc.done + " of " + sc.total + " steps" }), bar(sc.done, sc.total)]) : null,
      h("div", { className: "tk-move" }, [h("label", { "for": selId, text: "Move to" }), sel])
    ]);
  }
  function renderTeam(animate) {
    if (!S.isMgr) return;
    if (S.notSetUp) { setupNote(); return; }
    teamFilterOptions();
    var give = S.route === "team-tasks/give";
    show("team-main", !give); show("team-give", give);
    if (give) { renderGivePeople(); return; }
    $("tt-view-board").setAttribute("aria-pressed", S.view === "board" ? "true" : "false");
    $("tt-view-table").setAttribute("aria-pressed", S.view === "table" ? "true" : "false");
    show("tt-board", S.view === "board"); show("tt-table", S.view === "table");
    var list = teamTasks(), board = $("tt-board"); board.textContent = "";
    var weekAgo = weekStart().getTime();
    ORDER.forEach(function (st) {
      var col = list.filter(function (t) { return t.status === st && (st !== "done" || !t.done_at || new Date(t.done_at).getTime() >= weekAgo - 7 * 864e5); });
      col.sort(function (a, b) { return (a.due_date || "9999") < (b.due_date || "9999") ? -1 : 1; });
      board.appendChild(h("section", { className: "tk-col", "aria-label": ST[st] + ", " + col.length + " tasks" }, [
        h("h3", { className: "tk-col-h" }, [h("span", { className: "tk-dot s-" + st, "aria-hidden": "true" }), ST[st] + " ", h("small", { text: "(" + col.length + ")" })]),
        h("div", { className: "tk-col-in" }, col.length ? col.map(boardCard) : [h("p", { className: "tk-empty", text: "Nothing here." })])
      ]));
    });
    renderTable();
    if (animate) enter(board.querySelectorAll(".tk-bcard"));
  }
  function renderTable() {
    var host = $("tt-table"); host.textContent = "";
    var ws = weekStart().getTime(), live = liveTasks();
    var rows = activeStaff().filter(function (p) { return !S.person || p.user_id === S.person; }).map(function (p) {
      var on = live.filter(function (t) { return membersOf(t.id).indexOf(p.user_id) > -1; });
      var open = on.filter(function (t) { return t.status !== "done"; });
      return { p: p, open: open.length, over: open.filter(isOverdue).length, review: on.filter(function (t) { return t.status === "review"; }).length,
               done: on.filter(function (t) { return t.status === "done" && t.done_at && new Date(t.done_at).getTime() >= ws; }).length };
    });
    var tb = h("tbody", null, rows.map(function (r) {
      return h("tr", null, [h("th", { scope: "row" }, [personLink(r.p.user_id)]), h("td", { text: String(r.open) }),
        h("td", { className: r.over ? "tk-od" : "", text: String(r.over) }), h("td", { text: String(r.review) }), h("td", { text: String(r.done) })]);
    }));
    host.appendChild(h("table", { className: "tk-table", "aria-label": "Progress by person" }, [
      h("thead", null, [h("tr", null, ["Person", "Open", "Overdue", "Waiting review", "Done this week"].map(function (c) { return h("th", { scope: "col", text: c }); }))]), tb]));
  }
  function renderGivePeople() {
    var box = $("gv-people"); if (!box) return;
    var checked = {}; box.querySelectorAll("input:checked").forEach(function (i) { checked[i.value] = true; });
    if (!box.childNodes.length && S.person) checked[S.person] = true;
    box.textContent = "";
    activeStaff().forEach(function (p) {
      var id = "gvp-" + p.user_id;
      box.appendChild(h("label", { className: "tk-pick-row", "for": id }, [h("input", { type: "checkbox", id: id, name: "people", value: p.user_id, checked: !!checked[p.user_id] }),
        h("span", { className: "tk-av sm", text: initials(p.full_name), "aria-hidden": "true" }), h("span", { text: p.full_name + (p.user_id === S.me.user_id ? " (me)" : "") })]));
    });
  }
  function giveTask(e) {
    e.preventDefault(); var f = e.target; if (!f.reportValidity()) return;
    var people = [].map.call(f.querySelectorAll("input[name=people]:checked"), function (i) { return i.value; });
    if (!people.length) { msg("gv-status", "warn", "Pick at least one person."); return; }
    var row = { title: f.elements.title.value.trim(), details: f.elements.details.value.trim() || null, due_date: f.elements.due_date.value || null,
                priority: (f.querySelector("input[name=priority]:checked") || {}).value || "normal" };
    var steps = lines(f.elements.steps.value), btn = f.querySelector("[type=submit]");
    btn.disabled = true; msg("gv-status", "busy", "Saving…");
    createTask(row, people, steps).then(function () {
      btn.disabled = false; f.reset(); $("gv-people").textContent = "";
      msg("team-status", "ok", "Task given to " + people.map(nameOf).join(", ") + ".");
      msg("gv-status", "", ""); location.hash = "#team-tasks";
      return refresh(true);
    }).catch(function (er) { btn.disabled = false; msg("gv-status", "err", plainErr(er, "The task was not saved. Check the fields and try again.")); });
  }

  // ---------- Team (members) ----------
  function fnErr(r) {
    var e = r && r.error; if (!e) return Promise.resolve(null);
    var ctx = e.context;
    if (ctx && typeof ctx.json === "function") return ctx.json().then(function (j) { return (j && j.error) || "That did not work. Try again."; }, function () { return "That did not work. Try again."; });
    return Promise.resolve(/fetch|not found|404|failed to send/i.test(String(e.message || "")) ? "Member tools are being set up. Ask Sonny to finish setup." : "That did not work. Try again.");
  }
  function callMembers(body) {
    return Promise.resolve(S.db.functions.invoke("admin-members", { body: body })).then(function (r) {
      return fnErr(r).then(function (err) {
        if (err) throw new Error(err);
        if (!r.data || r.data.ok === false) throw new Error((r.data && r.data.error) || "That did not work. Try again.");
        return r.data;
      });
    });
  }
  function showTemp(name, pw) {
    $("tk-temp-h").textContent = "Temporary password for " + name + ":";
    $("tk-temp-pw").textContent = pw; show("tk-temp", true); $("tk-temp-copy").textContent = "Copy";
    $("tk-temp").scrollIntoView({ block: "nearest" }); $("tk-temp-copy").focus();
  }
  function hideTemp() { $("tk-temp-pw").textContent = ""; show("tk-temp", false); }
  function roleOptions(sel, current) {
    sel.textContent = "";
    ["student", "student_lead", "leadership", "admin"].forEach(function (r) {
      if (r === "admin" && S.me.role !== "admin" && current !== "admin") return;
      sel.appendChild(h("option", { value: r, text: ROLE[r], selected: r === current ? true : null }));
    });
  }
  function renderPeople() {
    if (!S.isMgr) return;
    var add = $("tm-role"); if (add && !add.options.length) roleOptions(add, "student");
    var ul = $("tm-list"); ul.textContent = "";
    S.staff.slice().sort(function (a, b) { return (a.active === false) - (b.active === false) || String(a.full_name).localeCompare(b.full_name); }).forEach(function (p) {
      var me = p.user_id === S.me.user_id, locked = p.role === "admin" && S.me.role !== "admin";
      var rid = "role-" + p.user_id, sel = h("select", { id: rid, disabled: me || locked ? true : null });
      roleOptions(sel, p.role);
      sel.addEventListener("change", function () {
        var prev = p.role; sel.disabled = true; msg("tm-status", "busy", "Saving…");
        callMembers({ action: "role", user_id: p.user_id, role: sel.value }).then(function () { msg("tm-status", "ok", p.full_name + " is now " + ROLE[sel.value] + "."); return refresh(); })
          .catch(function (e) { sel.value = prev; sel.disabled = false; msg("tm-status", "err", e.message); });
      });
      var acts = h("div", { className: "tk-mem-acts" });
      if (!me && !locked) {
        acts.appendChild(h("button", { type: "button", className: "btn line", text: "Reset password", on: { click: function (e) {
          var b = e.currentTarget; if (!confirm("Make a new temporary password for " + p.full_name + "? Their old password stops working.")) return;
          b.disabled = true; msg("tm-status", "busy", "Resetting…");
          callMembers({ action: "reset", user_id: p.user_id }).then(function (d) { b.disabled = false; msg("tm-status", "ok", "New temporary password made for " + p.full_name + "."); showTemp(p.full_name, d.temp_password); refresh(); })
            .catch(function (er) { b.disabled = false; msg("tm-status", "err", er.message); });
        } } }));
        var on = p.active !== false;
        acts.appendChild(h("button", { type: "button", className: "btn " + (on ? "line tk-warn" : "gold"), text: on ? "Turn off access" : "Turn on access", on: { click: function (e) {
          var b = e.currentTarget; if (on && !confirm("Turn off access for " + p.full_name + "? They will not be able to sign in or see any tasks.")) return;
          b.disabled = true; msg("tm-status", "busy", "Saving…");
          callMembers({ action: on ? "deactivate" : "reactivate", user_id: p.user_id }).then(function () { msg("tm-status", "ok", p.full_name + (on ? " can no longer sign in." : " can sign in again.")); return refresh(); })
            .catch(function (er) { b.disabled = false; msg("tm-status", "err", er.message); });
        } } }));
      }
      var state = p.active === false ? h("span", { className: "tk-chip off", text: "Access off" }) : p.must_change_password ? h("span", { className: "tk-chip wait", text: "Has not picked a password yet" }) : h("span", { className: "tk-chip ok", text: "Access on" });
      ul.appendChild(h("li", { className: p.active === false ? "is-off" : "" }, [
        h("div", { className: "tk-mem-who" }, [h("span", { className: "tk-av", text: initials(p.full_name), "aria-hidden": "true" }),
          h("div", null, [h("b", null, [personLink(p.user_id), me ? " (you)" : ""]), h("small", { text: p.email || "" }), state])]),
        h("div", { className: "tk-mem-role" }, [h("label", { "for": rid, text: "Role" }), sel]), acts]));
    });
  }
  function addMember(e) {
    e.preventDefault(); var f = e.target; if (!f.reportValidity()) return;
    var body = { action: "create", full_name: f.elements.full_name.value.trim(), email: f.elements.email.value.trim(), role: f.elements.role.value };
    var btn = f.querySelector("[type=submit]"); btn.disabled = true; msg("tm-status", "busy", "Making the login…");
    callMembers(body).then(function (d) {
      btn.disabled = false; f.reset(); roleOptions($("tm-role"), "student");
      msg("tm-status", "ok", body.full_name + " was added."); showTemp(body.full_name, d.temp_password); refresh();
    }).catch(function (er) { btn.disabled = false; msg("tm-status", "err", er.message); });
  }

  // ---------- Deleted (managers) ----------
  function renderDeleted() {
    if (!S.isMgr) return;
    var ul = $("del-list"); ul.textContent = "";
    var del = S.tasks.filter(function (t) { return t.deleted_at; }).sort(function (a, b) { return a.deleted_at < b.deleted_at ? 1 : -1; });
    if (!del.length) { ul.appendChild(h("li", { className: "tk-empty", text: "Nothing deleted." })); return; }
    del.forEach(function (t) {
      ul.appendChild(h("li", null, [h("div", null, [h("b", null, [taskLink(t, "deleted")]),
        h("small", null, ["Deleted by ", t.deleted_by ? personLink(t.deleted_by) : "someone", " on " + fmtWhen(t.deleted_at)]),
        h("small", { text: "Why: " + (t.deleted_reason || "no reason given") })]),
        h("button", { type: "button", className: "btn gold", text: "Restore", on: { click: function (e) { restoreTask(t, e.currentTarget, "del-status"); } } })]));
    });
  }
  function restoreTask(t, btn, statusId) {
    if (btn) btn.disabled = true; msg(statusId, "busy", "Restoring…");
    q(S.db.rpc("restore_task", { p_task: t.id })).then(function () { msg(statusId, "ok", "“" + t.title + "” is back."); return refresh(); })
      .catch(function (e) { if (btn) btn.disabled = false; msg(statusId, "err", plainErr(e, "It was not restored. Try again.")); });
  }

  // ---------- task window (dialog) ----------
  var dlgTask = null, dlgFrom = "my-tasks", dlgDelete = false, dlgEdit = false;
  function actWords(a) {
    var d = a.detail || {};
    switch (a.action) {
      case "created": return "made this task";
      case "assigned": return "added " + nameOf(d.user_id);
      case "unassigned": return "took " + nameOf(d.user_id) + " off this task";
      case "status": return "moved it from " + (ST[d.from] || d.from) + " to " + (ST[d.to] || d.to);
      case "checklist": return (d.done ? "ticked " : "unticked ") + "“" + (d.text || "a step") + "”";
      case "update": return "posted an update";
      case "edited": return "changed " + Object.keys(d).map(function (k) { return { title: "the title", details: "the details", priority: "the priority", due_date: "the due date" }[k] || k; }).join(", ");
      case "deleted": return "deleted it: “" + (d.reason || "") + "”";
      case "restored": return "brought it back";
      default: return a.action;
    }
  }
  function openTask(id, from) {
    var dlg = $("tk-dlg"); dlgTask = id; dlgFrom = TABS.indexOf(from) > -1 ? from : (S.tab || "my-tasks"); dlgDelete = false; dlgEdit = false;
    renderDlg(true);
    if (!dlg.open) { if (dlg.showModal) dlg.showModal(); else dlg.setAttribute("open", ""); }
  }
  function closeTask(viaRoute) {
    var dlg = $("tk-dlg"); dlgTask = null;
    if (dlg.open) { if (dlg.close) dlg.close(); else dlg.removeAttribute("open"); }
    if (!viaRoute && /^#task\//.test(location.hash)) location.hash = "#" + dlgFrom;
  }
  function renderDlg(loadFeed) {
    var t = dlgTask && taskById(dlgTask), box = $("tk-dlg-in"); if (!box) return;
    if (!t) { box.textContent = ""; box.appendChild(h("div", { className: "tk-dlg-body" }, [backLink(), h("h2", { id: "dlg-title", text: "Task not found" }), h("p", { text: "This task was deleted, or it is not one of yours." })])); return; }
    var keep = {}; box.querySelectorAll("textarea, input[type=text], input[type=date], select").forEach(function (el) { if (el.id) keep[el.id] = el.value; });
    var focus = document.activeElement && box.contains(document.activeElement) ? document.activeElement.id : null;
    box.textContent = "";
    var sid = "dlg-status", mine = canManage(t), deleted = !!t.deleted_at;
    var body = h("div", { className: "tk-dlg-body" });
    body.appendChild(h("div", { className: "tk-dlg-top" }, [backLink(), h("button", { type: "button", className: "tk-x", "aria-label": "Close task", text: "×", on: { click: function () { closeTask(); } } })]));
    body.appendChild(h("h2", { id: "dlg-title", text: t.title }));
    body.appendChild(h("p", { className: "tk-meta" }, [h("span", { className: "tk-chip s-" + t.status, text: ST[t.status] }), " ", t.priority === "high" ? h("span", { className: "tk-chip high", text: "High priority" }) : null, " ", dueText(t),
      t.created_by ? h("span", null, [" · Made by ", personLink(t.created_by)]) : null]));
    if (deleted) body.appendChild(h("p", { className: "su-status su-status--warn", text: "Deleted " + fmtWhen(t.deleted_at) + " by " + nameOf(t.deleted_by) + ". Why: " + (t.deleted_reason || "") }));
    body.appendChild(h("p", { className: "su-status", id: sid, role: "status", "aria-live": "polite" }));
    if (!deleted) body.appendChild(moveButtons(t, sid));
    // details + edit
    if (dlgEdit && mine) body.appendChild(editForm(t, sid));
    else {
      body.appendChild(h("h3", { text: "Details" }));
      body.appendChild(h("p", { className: "tk-details", text: t.details || "No details." }));
      if (mine) body.appendChild(h("button", { type: "button", className: "btn line", text: "Edit task", on: { click: function () { dlgEdit = true; renderDlg(false); var f = $("ed-title"); if (f) f.focus(); } } }));
    }
    // people
    body.appendChild(h("h3", { text: "People on this task" }));
    var pul = h("ul", { className: "tk-dlg-people" }, membersOf(t.id).map(function (u) {
      return h("li", null, [h("span", { className: "tk-av sm", text: initials(nameOf(u)), "aria-hidden": "true" }), personLink(u),
        mine ? h("button", { type: "button", className: "tk-link", text: "Take off", "aria-label": "Take " + nameOf(u) + " off this task", on: { click: function () { removePerson(t, u, sid); } } }) : null]);
    }));
    if (!membersOf(t.id).length) pul.appendChild(h("li", { text: "Nobody yet." }));
    body.appendChild(pul);
    if (mine) {
      var cand = activeStaff().filter(function (p) { return membersOf(t.id).indexOf(p.user_id) < 0; });
      if (cand.length) {
        var ps = h("select", { id: "dlg-addp" }, [h("option", { value: "", text: "Choose a person" })].concat(cand.map(function (p) { return h("option", { value: p.user_id, text: p.full_name }); })));
        body.appendChild(h("div", { className: "tk-inline" }, [h("label", { "for": "dlg-addp", text: "Add a person" }), ps,
          h("button", { type: "button", className: "btn line", text: "Add", on: { click: function () { if (ps.value) addPerson(t, ps.value, sid); else ps.focus(); } } })]));
      }
    }
    // checklist
    body.appendChild(h("h3", { text: "Checklist" }));
    body.appendChild(checklistBlock(t, sid) || h("p", { className: "tk-empty", text: "No steps yet." }));
    if (!deleted) {
      var si = h("input", { type: "text", id: "dlg-step", maxlength: "300" });
      body.appendChild(h("div", { className: "tk-inline" }, [h("label", { "for": "dlg-step", text: "Add a step" }), si,
        h("button", { type: "button", className: "btn line", text: "Add step", on: { click: function () { addStep(t, si, sid); } } })]));
    }
    // updates
    body.appendChild(h("h3", { text: "Updates" }));
    if (!deleted) body.appendChild(draftBox("dlg:" + t.id, "Post an update", function (b) { return postUpdate(t, b, sid).then(function (ok) { if (ok) loadFeed2(t.id); return ok; }); }));
    body.appendChild(h("ul", { className: "tk-feed", id: "dlg-feed" }, [h("li", { className: "tk-empty", text: "Loading…" })]));
    // history
    body.appendChild(h("details", { className: "tk-hist" }, [h("summary", { text: "History" }), h("ul", { className: "tk-feed", id: "dlg-hist" })]));
    // delete / restore
    if (deleted && S.isMgr) body.appendChild(h("div", { className: "tk-danger" }, [h("button", { type: "button", className: "btn gold", text: "Restore task", on: { click: function (e) { restoreTask(t, e.currentTarget, sid); } } })]));
    else if (mine && !dlgDelete) body.appendChild(h("div", { className: "tk-danger" }, [h("button", { type: "button", className: "btn line tk-warn", text: "Delete this task", on: { click: function () { dlgDelete = true; renderDlg(false); var r = $("dlg-reason"); if (r) r.focus(); } } })]));
    else if (mine && dlgDelete) {
      var rs = h("input", { type: "text", id: "dlg-reason", maxlength: "300", required: true, placeholder: "e.g. duplicate, no longer needed" });
      body.appendChild(h("div", { className: "tk-danger" }, [h("p", null, ["Delete ", h("b", { text: t.title }), "? A manager can bring it back from the Deleted list."]),
        h("div", { className: "tk-inline" }, [h("label", { "for": "dlg-reason", text: "Why are you deleting it? (required)" }), rs]),
        h("div", { className: "tk-actions" }, [h("button", { type: "button", className: "btn line tk-warn", text: "Delete task", on: { click: function (e) { deleteTask(t, rs, sid, e.currentTarget); } } }),
          h("button", { type: "button", className: "btn line", text: "Keep it", on: { click: function () { dlgDelete = false; renderDlg(false); } } })])]));
    }
    box.appendChild(body);
    Object.keys(keep).forEach(function (id) { var el = $(id); if (el && el.tagName !== "SELECT" && id.indexOf("upd-") !== 0) el.value = keep[id]; });
    if (focus && $(focus)) $(focus).focus();
    if (loadFeed) loadFeed2(t.id); else paintFeed(t.id);
  }
  function backLink() { return h("a", { className: "tk-back", href: "#" + dlgFrom, text: "Back to " + (TAB_NAME[dlgFrom] || "the dashboard"), on: { click: function (e) { e.preventDefault(); closeTask(); } } }); }
  var feedCache = {};
  function loadFeed2(tid) {
    Promise.all([q(S.db.from("task_updates").select("id,task_id,user_id,body,created_at").eq("task_id", tid).order("created_at", { ascending: false }).limit(200)),
                 q(S.db.from("task_activity").select("id,task_id,user_id,action,detail,created_at").eq("task_id", tid).order("created_at", { ascending: false }).limit(300))])
      .then(function (r) { feedCache[tid] = { updates: r[0] || [], hist: r[1] || [] }; paintFeed(tid); })
      .catch(function () { feedCache[tid] = { updates: [], hist: [], err: true }; paintFeed(tid); });
  }
  function paintFeed(tid) {
    var f = feedCache[tid], ul = $("dlg-feed"), hl = $("dlg-hist"); if (!ul || !f) return;
    ul.textContent = ""; hl.textContent = "";
    if (f.err) { ul.appendChild(h("li", { className: "tk-empty", text: "Updates could not load. They will try again shortly." })); return; }
    if (!f.updates.length) ul.appendChild(h("li", { className: "tk-empty", text: "No updates yet." }));
    f.updates.forEach(function (u) { ul.appendChild(h("li", null, [h("p", { className: "tk-feed-h" }, [personLink(u.user_id), h("small", { text: " · " + fmtWhen(u.created_at) })]), h("p", { className: "tk-feed-b", text: u.body })])); });
    if (!f.hist.length) hl.appendChild(h("li", { className: "tk-empty", text: "Nothing yet." }));
    f.hist.forEach(function (a) { hl.appendChild(h("li", null, [h("p", { className: "tk-feed-h" }, [a.user_id ? personLink(a.user_id) : "The system", " " + actWords(a), h("small", { text: " · " + fmtWhen(a.created_at) })])])); });
  }
  function editForm(t, sid) {
    var f = h("form", { className: "su-form tk-edit", "aria-label": "Edit task" }, [
      h("div", { className: "f full" }, [h("label", { "for": "ed-title", text: "Task" }), h("input", { id: "ed-title", type: "text", maxlength: "200", required: true, value: t.title })]),
      h("div", { className: "f full" }, [h("label", { "for": "ed-details", text: "Details" }), h("textarea", { id: "ed-details", maxlength: "4000", value: t.details || "" })]),
      h("div", { className: "f" }, [h("label", { "for": "ed-due", text: "Due date" }), h("input", { id: "ed-due", type: "date", value: t.due_date ? String(t.due_date).slice(0, 10) : "" })]),
      h("div", { className: "f" }, [h("label", { "for": "ed-pri", text: "Priority" }), h("select", { id: "ed-pri" }, [h("option", { value: "normal", text: "Normal", selected: t.priority !== "high" ? true : null }), h("option", { value: "high", text: "High", selected: t.priority === "high" ? true : null })])]),
      h("div", { className: "actions" }, [h("button", { type: "submit", className: "btn gold", text: "Save changes" }), h("button", { type: "button", className: "btn line", text: "Cancel", on: { click: function () { dlgEdit = false; renderDlg(false); } } })])
    ]);
    f.addEventListener("submit", function (e) {
      e.preventDefault(); if (!f.reportValidity()) return;
      var patch = { title: $("ed-title").value.trim(), details: $("ed-details").value.trim() || null, due_date: $("ed-due").value || null, priority: $("ed-pri").value };
      msg(sid, "busy", "Saving…");
      q(S.db.from("tasks").update(patch).eq("id", t.id)).then(function () { dlgEdit = false; return refresh().then(function () { msg("dlg-status", "ok", "Saved."); }); })
        .catch(function (er) { msg(sid, "err", plainErr(er, "Not saved. Try again.")); });
    });
    return f;
  }
  function addPerson(t, uid, sid) {
    msg(sid, "busy", "Adding…");
    q(S.db.from("task_members").insert({ task_id: t.id, user_id: uid })).then(function () { return refresh().then(function () { msg("dlg-status", "ok", nameOf(uid) + " was added."); loadFeed2(t.id); }); })
      .catch(function (e) { msg(sid, "err", plainErr(e, "That person was not added. Try again.")); });
  }
  function removePerson(t, uid, sid) {
    msg(sid, "busy", "Saving…");
    q(S.db.from("task_members").delete().eq("task_id", t.id).eq("user_id", uid)).then(function () { return refresh().then(function () { msg("dlg-status", "ok", nameOf(uid) + " is off this task."); loadFeed2(t.id); }); })
      .catch(function (e) { msg(sid, "err", plainErr(e, "Not saved. Try again.")); });
  }
  function addStep(t, input, sid) {
    var txt = input.value.trim(); if (!txt) { input.focus(); return; }
    var pos = stepsOf(t.id).reduce(function (m, s) { return Math.max(m, (s.position || 0) + 1); }, 0);
    q(S.db.from("task_checklist").insert({ task_id: t.id, text: txt.slice(0, 300), position: pos })).then(function () { input.value = ""; return refresh(); })
      .catch(function (e) { msg(sid, "err", plainErr(e, "The step was not added. Try again.")); });
  }
  function deleteTask(t, input, sid, btn) {
    var why = input.value.trim(); if (!why) { msg(sid, "warn", "Say why you are deleting it (a few words is fine)."); input.focus(); return; }
    btn.disabled = true; msg(sid, "busy", "Deleting…");
    q(S.db.rpc("delete_task", { p_task: t.id, p_reason: why })).then(function () {
      var back = dlgFrom; closeTask(); location.hash = "#" + back;
      msg(back === "team-tasks" ? "team-status" : "my-status", "ok", "“" + t.title + "” was deleted." + (S.isMgr ? " You can bring it back from the Deleted tab." : " A manager can bring it back."));
      return refresh();
    }).catch(function (e) { btn.disabled = false; msg(sid, "err", plainErr(e, "It was not deleted. Try again.")); });
  }

  // ---------- notifications ----------
  function loadNotes() {
    if (S.notSetUp) return Promise.resolve();
    return q(S.db.from("notifications").select("id,task_id,text,read,created_at").order("created_at", { ascending: false }).limit(30)).then(function (rows) {
      S.notes = rows || []; paintNotes();
    }).catch(function () { /* keep the last list; try again next round */ });
  }
  function paintNotes() {
    var unread = S.notes.filter(function (n) { return !n.read; }).length, badge = $("tk-badge"), bell = $("tk-bell");
    badge.textContent = unread > 99 ? "99+" : String(unread); badge.hidden = !unread;
    bell.setAttribute("aria-label", "Updates, " + unread + " unread");
    var ul = $("tk-bell-list"); ul.textContent = "";
    if (!S.notes.length) { ul.appendChild(h("li", { className: "tk-empty", text: "Nothing new." })); return; }
    S.notes.forEach(function (n) {
      ul.appendChild(h("li", null, [h("button", { type: "button", className: "tk-note" + (n.read ? "" : " is-new"), on: { click: function () { openNote(n); } } }, [
        h("span", { text: n.text }), h("small", { text: fmtWhen(n.created_at) + (n.read ? "" : " · new") })])]));
    });
  }
  function openNote(n) {
    toggleBell(false);
    if (!n.read) { n.read = true; paintNotes(); S.db.from("notifications").update({ read: true }).eq("id", n.id).then(function () {}); }
    if (n.task_id) location.hash = "#task/" + n.task_id;
  }
  function toggleBell(open) {
    var pop = $("tk-bell-pop"), b = $("tk-bell"); if (open == null) open = pop.hidden;
    pop.hidden = !open; b.setAttribute("aria-expanded", open ? "true" : "false");
  }

  // ---------- loading + polling ----------
  function loadAll() {
    return Promise.all([
      q(S.db.from("staff").select("user_id,full_name,role,email,active,must_change_password").order("full_name")),
      q(S.db.from("tasks").select("id,title,details,status,priority,due_date,created_by,created_at,updated_at,done_at,deleted_at,deleted_by,deleted_reason").order("created_at", { ascending: false }).limit(1000)),
      q(S.db.from("task_members").select("task_id,user_id").limit(5000)),
      q(S.db.from("task_checklist").select("id,task_id,text,done,done_by,done_at,position").order("position").limit(10000))
    ]).then(function (r) {
      S.staff = r[0] || []; S.byId = {}; S.staff.forEach(function (p) { S.byId[p.user_id] = p; });
      var mine = S.byId[S.me.user_id]; if (mine) { S.me = mine; S.isMgr = mine.active !== false && (mine.role === "admin" || mine.role === "leadership"); if (window.XRPartners) window.XRPartners.setMe(mine); }
      S.tasks = r[1] || []; S.members = {}; (r[2] || []).forEach(function (m) { (S.members[m.task_id] = S.members[m.task_id] || []).push(m.user_id); });
      S.checklist = {}; (r[3] || []).forEach(function (c) { (S.checklist[c.task_id] = S.checklist[c.task_id] || []).push(c); });
      S.loadErr = false;
    }).catch(function (e) {
      if (isMissing(e)) S.notSetUp = true; else S.loadErr = true;
    });
  }
  function refresh(animate) {
    if (!S) return Promise.resolve();
    return Promise.all([loadAll(), loadNotes()]).then(function () { paint(animate); });
  }
  function paint(animate) {
    if (!S) return;
    document.querySelectorAll("#tk-tabs [data-mgr]").forEach(function (a) { a.hidden = !S.isMgr; });
    show("tk-bell-wrap", !S.notSetUp);
    if (S.notSetUp) { setupNote(); return; }
    if (S.loadErr) msg("my-status", "err", "Tasks could not load. The page will try again in 30 seconds.");
    else if ($("my-status").className.indexOf("--err") > -1) msg("my-status", "", "");
    renderMy(animate && S.tab === "my-tasks");
    renderTeam(animate && S.tab === "team-tasks");
    renderPeople(); renderDeleted();
    if (dlgTask) renderDlg(false);
  }
  function setupNote() {
    ["my-list", "tt-board"].forEach(function (id) {
      var el = $(id); if (!el) return; el.textContent = "";
      el.appendChild(h("div", { className: "launch wide" }, [h("span", { className: "tag", text: "Coming soon" }), h("h3", { text: "Task list is being set up" }),
        h("p", { text: "The task tables are not switched on in the database yet. Leads, the activity log and uploads still work." })]));
    });
    show("tk-quick", false); show("tt-table", false);
  }

  // ---------- tabs + routes (#partners, #partners/add, #partners/p/<id> are drawn by partners.js; #my-tasks, #team-tasks, #team-tasks/give, #team-tasks/person/<id>, #team, #deleted, #leads, #activity, #uploads, #task/<id>) ----------
  function sectionFor(tab) { return { "my-tasks": "t-my-tasks", "team-tasks": "t-team-tasks", team: "t-team", deleted: "t-deleted", leads: "leads", activity: "activity", uploads: "uploads", partners: "t-partners" }[tab]; }
  function route() {
    if (!S) return;
    var hsh = location.hash.replace(/^#/, ""), m;
    if ((m = /^task\/([0-9a-f-]{8,})$/i.exec(hsh))) {
      if (!S.tab) applyTab("my-tasks");
      var a = document.querySelector("[data-tid='" + m[1] + "'][data-from]:hover, a[href='#task/" + m[1] + "'][data-from]:focus");
      openTask(m[1], (S.nextFrom || (a && a.getAttribute("data-from")) || S.tab || "my-tasks"));
      S.nextFrom = null; return;
    }
    if (dlgTask) closeTask(true);
    var tab = hsh.split("/")[0];
    if (TABS.indexOf(tab) < 0 || (MGR_TABS.indexOf(tab) > -1 && !S.isMgr)) tab = S.tab || "my-tasks";
    S.route = hsh;
    if ((m = /^team-tasks\/person\/([0-9a-f-]{8,})$/i.exec(hsh))) { S.person = m[1]; S.view = S.view || "board"; }
    var changed = tab !== S.tab;
    applyTab(tab);
    if (tab === "team-tasks") renderTeam(changed);
    if (tab === "team") hideTemp();
    if (tab === "partners" && window.XRPartners) window.XRPartners.show(/^partners(\/|$)/.test(hsh) ? hsh : "partners");
    if (changed) { var app = $("app"); if (app && app.getBoundingClientRect().top < 0) app.scrollIntoView(); }
  }
  function applyTab(tab) {
    S.tab = tab;
    TABS.forEach(function (t) { show(sectionFor(t), t === tab); });
    document.querySelectorAll("#tk-tabs a").forEach(function (a) { if (a.getAttribute("data-tab") === tab) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); });
    if (tab === "my-tasks") renderMy(true);
  }

  // ---------- "Pick your own password" ----------
  function askPassword(done) {
    show("pwchange", true); $("pw-new").focus();
    var f = $("pw-form");
    f.onsubmit = function (e) {
      e.preventDefault(); if (!f.reportValidity()) return;
      var a = $("pw-new").value, b = $("pw-again").value;
      if (a.length < 10) { msg("pw-status", "err", "Use at least 10 characters."); return; }
      if (a !== b) { msg("pw-status", "err", "The two passwords are not the same. Type them again."); return; }
      var btn = f.querySelector("[type=submit]"); btn.disabled = true; msg("pw-status", "busy", "Saving your password…");
      Promise.resolve(S.db.auth.updateUser({ password: a })).then(function (r) {
        if (r && r.error) {
          var same = /different|same/i.test(String(r.error.message || "")) || r.error.code === "same_password";
          throw new Error(same ? "Pick a password that is different from the temporary one." : /weak|short|characters/i.test(String(r.error.message || "")) ? "That password is too easy to guess. Try a longer one." : "Your password was not saved. Try again.");
        }
        return q(S.db.rpc("clear_my_password_flag"));
      }).then(function () {
        btn.disabled = false; f.reset(); msg("pw-status", "", ""); show("pwchange", false);
        f.querySelectorAll(".pw-toggle").forEach(function (t) { t.setAttribute("aria-pressed", "false"); t.textContent = "Show password"; });
        [$("pw-new"), $("pw-again")].forEach(function (i) { i.type = "password"; });
        S.me.must_change_password = false; done(true);
      }).catch(function (er) { btn.disabled = false; msg("pw-status", "err", er.message || "Your password was not saved. Try again."); });
    };
  }

  // ---------- start / stop ----------
  var pollT = null, bound = false;
  function bindOnce() {
    if (bound) return; bound = true; bindHover();
    addEventListener("hashchange", route);
    // the tab bar changes the hash itself: autoplay.js turns clicks on "#leads", "#activity", "#uploads"
    // (ids that exist on the page) into a silent replaceState, which would skip the tab switch
    $("tk-tabs").addEventListener("click", function (e) {
      var a = e.target.closest && e.target.closest("a[data-tab]"); if (!a || e.metaKey || e.ctrlKey || e.shiftKey) return;
      e.preventDefault();
      var want = "#" + a.getAttribute("data-tab");
      if (location.hash === want) route(); else location.hash = want;
    });
    $("tk-quick-form").addEventListener("submit", quickAdd);
    $("give-form").addEventListener("submit", giveTask);
    $("tm-form").addEventListener("submit", addMember);
    $("tt-person").addEventListener("change", function () { var v = $("tt-person").value; S.person = v; location.hash = v ? "#team-tasks/person/" + v : "#team-tasks"; });
    $("tt-view-board").addEventListener("click", function () { S.view = "board"; renderTeam(true); });
    $("tt-view-table").addEventListener("click", function () { S.view = "table"; renderTeam(false); });
    $("tk-temp-hide").addEventListener("click", hideTemp);
    $("tk-temp-copy").addEventListener("click", function () {
      var pw = $("tk-temp-pw").textContent, b = $("tk-temp-copy");
      var ok = function () { b.textContent = "Copied"; };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(pw).then(ok, function () { selectPw(); b.textContent = "Press Ctrl+C or Cmd+C"; });
      else { selectPw(); try { document.execCommand("copy"); ok(); } catch (e) { b.textContent = "Press Ctrl+C or Cmd+C"; } }
    });
    function selectPw() { var r = document.createRange(); r.selectNodeContents($("tk-temp-pw")); var s = getSelection(); s.removeAllRanges(); s.addRange(r); }
    $("tk-bell").addEventListener("click", function (e) { e.stopPropagation(); toggleBell(); });
    $("tk-bell-all").addEventListener("click", function () {
      S.notes.forEach(function (n) { n.read = true; }); paintNotes();
      S.db.from("notifications").update({ read: true }).eq("user_id", S.me.user_id).eq("read", false).then(function () {});
    });
    document.addEventListener("click", function (e) { var w = $("tk-bell-wrap"); if (w && !w.contains(e.target) && !$("tk-bell-pop").hidden) toggleBell(false); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !$("tk-bell-pop").hidden) { toggleBell(false); $("tk-bell").focus(); } });
    var dlg = $("tk-dlg");
    dlg.addEventListener("cancel", function (e) { e.preventDefault(); closeTask(); });
    dlg.addEventListener("click", function (e) { if (e.target === dlg) closeTask(); });
    // remember which tab a task was opened from, for the "Back to ..." link
    document.addEventListener("click", function (e) { var a = e.target.closest && e.target.closest("a[href^='#task/']"); if (a && S) S.nextFrom = a.getAttribute("data-from") || S.tab; }, true);
  }

  window.XRTasks = {
    start: function (db, user, reveal) {
      S = { db: db, user: user, me: { user_id: user.id }, isMgr: false, staff: [], byId: {}, tasks: [], members: {}, checklist: {}, notes: [],
            tab: null, view: "board", person: "", route: "", notSetUp: false };
      bindOnce();
      q(db.from("staff").select("user_id,full_name,role,email,active,must_change_password").eq("user_id", user.id).maybeSingle()).then(function (row) {
        if (row) { S.me = row; S.isMgr = row.active !== false && (row.role === "admin" || row.role === "leadership"); }
        if (row && row.must_change_password) askPassword(go); else go();
      }).catch(function (e) {
        if (isMissing(e)) S.notSetUp = true;
        go();
      });
      function go() {
        reveal();
        if (S.me && S.me.full_name) $("who").textContent = "Signed in as " + S.me.full_name + (S.isMgr ? " (manager)" : "");
        if (window.XRPartners) window.XRPartners.start(db, S.me);
        refresh(true).then(function () { route(); if (!location.hash) S.tab && applyTab(S.tab); });
        route();
        clearInterval(pollT);
        pollT = setInterval(function () { if (!document.hidden) refresh(false); }, POLL_MS);
      }
    },
    stop: function () {
      clearInterval(pollT); pollT = null;
      if (dlgTask) closeTask(true);
      if (window.XRPartners) window.XRPartners.stop();
      ["pwchange", "t-my-tasks", "t-team-tasks", "t-team", "t-deleted", "t-partners"].forEach(function (id) { show(id, false); });
      hideTemp(); drafts = {}; feedCache = {}; S = null;
    },
    _state: function () { return S; }
  };
})();
