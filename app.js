"use strict";
(function () {
  var data = null, sortKey = "pushed", showForks = true;
  var rowsEl = document.getElementById("rows");
  var evEl = document.getElementById("events");
  var conEl = document.getElementById("contrib");

  function time(iso) { var t = iso ? Date.parse(iso) : NaN; return isNaN(t) ? 0 : t; }
  function ago(iso) {
    var t = time(iso);
    if (!t) return "-";
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
    if (/^https:\/\/github\.com\//.test(href || "")) a.href = href;
    return a;
  }
  function num(v) { return v == null ? "?" : String(v); }
  function msg(body, cols, cls, text) {
    body.textContent = "";
    var tr = el("tr"), td = el("td", cls, text);
    td.colSpan = cols;
    tr.appendChild(td);
    body.appendChild(tr);
  }
  var ciRank = { fail: 0, wait: 1, ok: 2, none: 3, unknown: 4 };
  function cmp(a, b) {
    var byName = a.name.localeCompare(b.name);
    switch (sortKey) {
      case "name": return byName;
      case "stars": return ((b.stars || 0) - (a.stars || 0)) || byName;
      case "forks": return ((b.forks || 0) - (a.forks || 0)) || byName;
      case "ci": return (ciRank[a.ci.state] - ciRank[b.ci.state]) || byName;
      case "prs": return ((b.open_prs == null ? -1 : b.open_prs) - (a.open_prs == null ? -1 : a.open_prs)) || byName;
      case "release": return (time(b.release.date) - time(a.release.date)) || byName;
      default: return time(b.pushed_at) - time(a.pushed_at);
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
      tr.appendChild(el("td", "n", num(r.stars)));
      tr.appendChild(el("td", "n", num(r.forks)));
      tr.appendChild(el("td", "n", num(r.open_prs)));
      tr.appendChild(el("td", "n", num(r.open_issues)));
      rowsEl.appendChild(tr);
    });
    if (!list.length) msg(rowsEl, 8, "none", "nothing to show");
  }
  function renderContrib() {
    var list = (data.contrib || []).slice().sort(function (a, b) { return time(b.updated) - time(a.updated); });
    conEl.textContent = "";
    list.forEach(function (c) {
      var tr = el("tr");
      var c1 = el("td");
      c1.appendChild(link(c.repo, "https://github.com/" + c.repo));
      tr.appendChild(c1);
      var c2 = el("td");
      c2.appendChild(link((c.pr ? "PR #" : "issue #") + c.number + " " + c.title, c.url));
      tr.appendChild(c2);
      tr.appendChild(el("td", c.state, c.state));
      tr.appendChild(el("td", null, ago(c.updated)));
      conEl.appendChild(tr);
    });
    if (!list.length) msg(conEl, 4, "none", "none found");
  }
  function renderEvents() {
    var list = data.events.slice().sort(function (a, b) { return time(b.at) - time(a.at); }).slice(0, 20);
    evEl.textContent = "";
    list.forEach(function (e) {
      var li = el("li");
      li.appendChild(el("time", null, ago(e.at)));
      li.appendChild(document.createTextNode(e.what + " "));
      li.appendChild(link(e.repo, "https://github.com/" + e.repo));
      evEl.appendChild(li);
    });
    if (!list.length) evEl.appendChild(el("li", "none", "no public activity"));
  }
  function renderInfo() {
    var stars = 0, last = 0;
    data.repos.forEach(function (r) { stars += r.stars || 0; last = Math.max(last, time(r.pushed_at)); });
    document.getElementById("i-repos").textContent = String(data.repos.length);
    document.getElementById("i-stars").textContent = String(stars);
    document.getElementById("i-last").textContent = last ? ago(new Date(last).toISOString()) : "-";
  }
  function comments(g) {
    var box = document.getElementById("comments");
    if (!g || !/^R_[A-Za-z0-9_-]+$/.test(g.repo_id || "") || !/^DIC_[A-Za-z0-9_-]+$/.test(g.category_id || "") ||
        !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(g.repo || "")) return;
    var s = document.createElement("script");
    s.src = "https://giscus.app/client.js";
    s.async = true;
    s.crossOrigin = "anonymous";
    var attrs = { "data-repo": g.repo, "data-repo-id": g.repo_id, "data-category": String(g.category || ""),
      "data-category-id": g.category_id, "data-mapping": "specific", "data-term": "Site Discussions", "data-strict": "0", "data-reactions-enabled": "1",
      "data-emit-metadata": "0", "data-input-position": "top", "data-theme": "dark_dimmed", "data-lang": "en",
      "data-loading": "lazy" };
    Object.keys(attrs).forEach(function (k) { s.setAttribute(k, attrs[k]); });
    box.textContent = "";
    box.appendChild(s);
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
      var st = document.getElementById("stamp");
      st.textContent = "generated " + d.generated.replace("T", " ").replace("Z", " UTC") + " (" + ago(d.generated) + ")  |  " +
        d.repos.length + " public repositories" + (d.errors ? "\n?? " + d.errors + " API calls failed: fields marked ? are unknown" : "");
      var age = (Date.now() - time(d.generated)) / 3600000;
      if (age > 3) {
        st.textContent += "\n!! data is " + Math.round(age) + " h old: the refresh workflow may have stopped";
        st.className = "bad";
      }
      render();
      renderContrib();
      renderEvents();
      renderInfo();
      comments(d.giscus);
    })
    .catch(function (e) {
      msg(rowsEl, 8, "bad", "could not load status.json: " + e.message);
      msg(conEl, 4, "none", "-");
      evEl.textContent = "";
    });
})();
