"use strict";
(function () {
  var data = null, sortKey = "pushed", showForks = true;
  var rowsEl = document.getElementById("rows");
  var evEl = document.getElementById("events");

  function ago(iso) {
    var t = iso ? Date.parse(iso) : NaN;
    if (isNaN(t)) return "-";
    var s = Math.max(0, (Date.now() - t) / 1000);
    if (s < 90) return "now";
    if (s < 5400) return Math.round(s / 60) + " min ago";
    if (s < 129600) return Math.round(s / 3600) + " h ago";
    return Math.round(s / 86400) + " d ago";
  }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function link(text, href) {
    var a = el("a", null, text);
    if (/^https:\/\/github\.com\//.test(href)) a.href = href;
    return a;
  }
  var ciRank = { fail: 0, wait: 1, ok: 2, none: 3, unknown: 4 };
  function cmp(a, b) {
    switch (sortKey) {
      case "name": return a.name.localeCompare(b.name);
      case "ci": return (ciRank[a.ci.state] - ciRank[b.ci.state]) || a.name.localeCompare(b.name);
      case "prs": return ((b.open_prs == null ? -1 : b.open_prs) - (a.open_prs == null ? -1 : a.open_prs)) || a.name.localeCompare(b.name);
      case "release": return (Date.parse(b.release.date || "") || 0) - (Date.parse(a.release.date || "") || 0);
      default: return (Date.parse(b.pushed_at || "") || 0) - (Date.parse(a.pushed_at || "") || 0);
    }
  }
  function render() {
    if (!data) return;
    var list = data.repos.filter(function (r) { return showForks || !r.fork; }).sort(cmp);
    rowsEl.textContent = "";
    list.forEach(function (r) {
      var tr = el("tr");
      var c1 = el("td");
      c1.appendChild(link(r.name, r.url));
      if (r.fork) c1.appendChild(el("span", "fork", " (fork)"));
      if (r.description) c1.appendChild(el("span", "d", r.description));
      tr.appendChild(c1);
      var label = { ok: "pass", fail: "fail", wait: "running", none: "-", unknown: "?" }[r.ci.state];
      var c2 = el("td", r.ci.state, label);
      if (r.ci.total) c2.title = r.ci.summary;
      tr.appendChild(c2);
      tr.appendChild(el("td", null, ago(r.pushed_at)));
      var c4 = el("td");
      if (r.release.tag) c4.appendChild(link(r.release.tag + (r.release.pre ? " (pre)" : ""), r.release.url));
      else c4.appendChild(el("span", "none", r.release.unknown ? "?" : "-"));
      tr.appendChild(c4);
      tr.appendChild(el("td", null, r.open_prs == null ? "?" : String(r.open_prs)));
      tr.appendChild(el("td", null, r.open_issues == null ? "?" : String(r.open_issues)));
      rowsEl.appendChild(tr);
    });
    if (!list.length) {
      var t = el("tr"); var td = el("td", "none", "nothing to show"); td.colSpan = 6; t.appendChild(td); rowsEl.appendChild(t);
    }
  }
  function renderEvents() {
    evEl.textContent = "";
    data.events.slice(0, 20).forEach(function (e) {
      var li = el("li");
      li.appendChild(el("time", null, ago(e.at)));
      li.appendChild(document.createTextNode(e.what + " "));
      li.appendChild(link(e.repo, "https://github.com/" + e.repo));
      evEl.appendChild(li);
    });
    if (!data.events.length) evEl.appendChild(el("li", "none", "no public activity"));
  }
  document.getElementById("bar").addEventListener("click", function (ev) {
    var k = ev.target && ev.target.getAttribute && ev.target.getAttribute("data-sort");
    if (!k) return;
    sortKey = k;
    var bs = document.querySelectorAll("#bar button");
    for (var i = 0; i < bs.length; i++) {
      bs[i].className = bs[i] === ev.target ? "on" : "";
      bs[i].setAttribute("aria-pressed", bs[i] === ev.target ? "true" : "false");
    }
    render();
  });
  document.getElementById("forks").addEventListener("change", function (ev) {
    showForks = ev.target.checked;
    render();
  });
  fetch("status.json", { cache: "no-cache" })
    .then(function (r) { if (!r.ok) throw new Error("status " + r.status); return r.json(); })
    .then(function (d) {
      data = d;
      document.getElementById("stamp").textContent =
        "generated " + d.generated.replace("T", " ").replace("Z", " UTC") + " (" + ago(d.generated) + ")  |  " + d.repos.length + " public repositories" + (d.errors ? "\n?? " + d.errors + " API calls failed: fields marked ? are unknown" : "");
      var age = (Date.now() - Date.parse(d.generated)) / 3600000;
      if (age > 3) {
        document.getElementById("stamp").textContent += "\n!! data is " + Math.round(age) + " h old: the refresh workflow may have stopped";
        document.getElementById("stamp").className = "bad";
      }
      render();
      renderEvents();
    })
    .catch(function (e) {
      rowsEl.textContent = "";
      var tr = el("tr"); var td = el("td", "bad", "could not load status.json: " + e.message);
      td.colSpan = 6; tr.appendChild(td); rowsEl.appendChild(tr);
      evEl.textContent = "";
    });
})();
