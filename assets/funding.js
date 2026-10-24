/* Funding acknowledgments for /projects/.
   SU has not yet sent the exact acknowledgment and disclaimer wording for each funder. Until it does, every "text" below
   stays empty, and an entry with empty text is NEVER shown. The whole "Funding acknowledgments" block stays hidden while
   no entry has text (and without JavaScript it never shows). To publish one: paste SU's exact approved wording into its
   "text" field. Do not write or paraphrase the wording here. */
window.SU_FUNDING = [
  { agency: "National Science Foundation", text: "" },
  { agency: "National Telecommunications and Information Administration", text: "" },
  { agency: "Louisiana Department of Health", text: "" }
];
(function () {
  "use strict";
  function run() {
    var block = document.querySelector("[data-funding-block]"), list = document.querySelector("[data-funding]");
    if (!block || !list) return;
    var items = (window.SU_FUNDING || []).filter(function (f) { return f && f.agency && f.text && String(f.text).trim(); });
    list.textContent = "";
    items.forEach(function (f) {
      var p = document.createElement("p"), b = document.createElement("b");
      b.textContent = f.agency; p.appendChild(b); p.appendChild(document.createTextNode(String(f.text).trim()));
      list.appendChild(p);
    });
    block.hidden = items.length === 0;
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run); else run();
})();
