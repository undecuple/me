"use strict";
(function () {
  var data = null, sortKey = "pushed", showForks = true, conPage = 0;
  var CON_PER_PAGE = 10;
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
    var pages = Math.max(1, Math.ceil(list.length / CON_PER_PAGE));
    conPage = Math.min(Math.max(conPage, 0), pages - 1);
    conEl.textContent = "";
    list.slice(conPage * CON_PER_PAGE, (conPage + 1) * CON_PER_PAGE).forEach(function (c) {
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
    var pager = document.getElementById("cpager");
    pager.hidden = pages < 2;
    document.getElementById("cpage").textContent = "page " + (conPage + 1) + " of " + pages;
    document.getElementById("cprev").disabled = conPage === 0;
    document.getElementById("cnext").disabled = conPage >= pages - 1;
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
  document.getElementById("cprev").addEventListener("click", function () { conPage--; renderContrib(); });
  document.getElementById("cnext").addEventListener("click", function () { conPage++; renderContrib(); });
  document.getElementById("forks").addEventListener("change", function (ev) {
    showForks = ev.target.checked;
    render();
  });
  var mainEl = document.querySelector("main");
  var still = window.matchMedia("(prefers-reduced-motion: reduce)");
  function bounce() {
    mainEl.style.transformOrigin = "50% " + (window.scrollY + window.innerHeight - mainEl.getBoundingClientRect().top - window.scrollY) + "px";
    mainEl.classList.remove("bounce");
    void mainEl.offsetWidth;
    mainEl.classList.add("bounce");
  }
  mainEl.addEventListener("animationend", function () { mainEl.classList.remove("bounce"); });
  var flight = 0;
  ["wheel", "touchstart", "keydown"].forEach(function (n) { window.addEventListener(n, function () { flight++; }, { passive: true }); });
  function glide(y, dur) {
    var max = document.documentElement.scrollHeight - window.innerHeight;
    var to = Math.max(0, Math.min(y, max)), from = window.scrollY, dist = to - from;
    var ms = dur || Math.min(600, 260 + Math.abs(dist) / 8), t0 = 0, mine = ++flight;
    if (!dist) { bounce(); return; }
    function step(now) {
      if (mine !== flight) return;
      if (!t0) t0 = now;
      var p = Math.min(1, (now - t0) / ms);
      window.scrollTo(0, from + dist * (p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2));
      if (p < 1) requestAnimationFrame(step);
      else { flight++; bounce(); }
    }
    requestAnimationFrame(step);
  }
  Array.prototype.forEach.call(document.querySelectorAll(".quick a[href^='#']"), function (a) {
    a.addEventListener("click", function (ev) {
      var t = document.getElementById(a.getAttribute("href").slice(1));
      if (!t) return;
      ev.preventDefault();
      if (history.pushState) history.pushState(null, "", a.getAttribute("href"));
      t.setAttribute("tabindex", "-1");
      t.focus({ preventScroll: true });
      if (still.matches) { t.scrollIntoView(); return; }
      glide(t.getBoundingClientRect().top + window.scrollY);
    });
  });
  var topBtn = document.getElementById("totop");
  function topShown() { topBtn.hidden = window.scrollY < 400; }
  window.addEventListener("scroll", topShown, { passive: true });
  topShown();
  topBtn.addEventListener("click", function () {
    var h = document.querySelector("h1");
    h.setAttribute("tabindex", "-1");
    h.focus({ preventScroll: true });
    if (history.pushState && location.hash) history.pushState(null, "", location.pathname + location.search);
    if (still.matches) { window.scrollTo(0, 0); return; }
    glide(0);
  });
  var supportBtn = document.querySelector(".nfo .btn");
  var confettiOn = false;
  function confetti() {
    var cv = document.createElement("canvas"), dpr = window.devicePixelRatio || 1;
    var w = window.innerWidth, h = window.innerHeight;
    cv.width = w * dpr; cv.height = h * dpr;
    cv.setAttribute("aria-hidden", "true");
    cv.style.cssText = "position:fixed;left:0;top:0;width:100%;height:100%;pointer-events:none;z-index:20";
    document.body.appendChild(cv);
    var ctx = cv.getContext("2d");
    ctx.scale(dpr, dpr);
    var colors = ["#a7d8b0", "#e1ffe5", "#ac7f7b", "#997e95", "#8288a0", "#9f9e99"], bits = [], t0 = 0, last = 0;
    for (var i = 0; i < 220; i++) {
      bits.push({ x: rnd(0, w), y: rnd(-h * .35, -10), vx: rnd(-40, 40), vy: rnd(80, 220), s: rnd(6, 12), r: rnd(0, 6.28), vr: rnd(-8, 8),
        c: colors[i % colors.length], d: rnd(0, 6.28) });
    }
    function frame(now) {
      if (!cv.parentNode) return;
      if (!t0) t0 = last = now;
      var dt = Math.min(.05, (now - last) / 1000); last = now;
      ctx.clearRect(0, 0, w, h);
      bits.forEach(function (b) {
        b.vy += 420 * dt;
        b.x += (b.vx + Math.sin(now / 300 + b.d) * 30) * dt;
        b.y += b.vy * dt; b.r += b.vr * dt;
        ctx.save();
        ctx.translate(b.x, b.y); ctx.rotate(b.r);
        ctx.scale(1, Math.cos(now / 150 + b.d));
        ctx.fillStyle = b.c;
        ctx.fillRect(-b.s / 2, -b.s / 4, b.s, b.s / 2);
        ctx.restore();
      });
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
    return cv;
  }
  if (supportBtn) {
    supportBtn.addEventListener("click", function (ev) {
      var href = supportBtn.href;
      if (still.matches || confettiOn || ev.ctrlKey || ev.metaKey || ev.shiftKey || ev.altKey || ev.button !== 0) return;
      if (href.indexOf("https://ko-fi.com/") !== 0) return;
      ev.preventDefault();
      confettiOn = true;
      var cv = confetti();
      window.addEventListener("pageshow", function () { confettiOn = false; if (cv.parentNode) cv.parentNode.removeChild(cv); });
      setTimeout(function () { window.location.href = href; }, 1400);
    });
  }
  var wreckBtn = document.getElementById("wreck"), wreckMsg = document.getElementById("wreckmsg");
  var PUSH_TIP = "What\u2019s the worst that can happen on a Friday?";
  var CRUMBS = "main .banner, .nfo > *, .quick h2, .quick li, section h2, .bar > *, th, #rows tr, #contrib tr, .events li, #cpager > *, #comments > p, footer pre, footer p";
  var crumbs = [], wrecked = false, busy = false;
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function whenDone(anims, fn) {
    var left = anims.length;
    if (!left) { fn(); return; }
    anims.forEach(function (an) { an.onfinish = an.oncancel = function () { if (--left === 0) fn(); }; });
  }
  function fall() {
    var floor = document.documentElement.scrollHeight - 40, longest = 0, anims = [];
    crumbs = [];
    Array.prototype.forEach.call(document.querySelectorAll(CRUMBS), function (e) {
      var r = e.getBoundingClientRect();
      if (!r.width || !r.height) return;
      var dy = Math.max(0, floor - rnd(0, 70) - (r.bottom + window.scrollY));
      var rest = "translate(" + rnd(-30, 30).toFixed(1) + "px," + dy.toFixed(1) + "px) rotate(" + rnd(-55, 55).toFixed(1) + "deg)";
      var up = rest.replace(/,([\d.]+)px\)/, function (m, v) { return "," + Math.max(0, v - rnd(8, 18)).toFixed(1) + "px)"; });
      var dur = 500 + Math.sqrt(dy) * 22, delay = rnd(0, 450);
      longest = Math.max(longest, dur + delay);
      anims.push(e.animate([
        { offset: 0, transform: "none", easing: "cubic-bezier(.55,0,.95,.55)" },
        { offset: .84, transform: rest, easing: "cubic-bezier(.1,.5,.4,1)" },
        { offset: .92, transform: up, easing: "cubic-bezier(.55,0,1,.45)" },
        { offset: 1, transform: rest }
      ], { duration: dur, delay: delay, fill: "both" }));
      crumbs.push({ e: e, rest: rest, anim: anims[anims.length - 1] });
    });
    return { anims: anims, longest: longest, floor: floor };
  }
  wreckBtn.addEventListener("click", function () {
    if (busy || still.matches) return;
    busy = true;
    wreckBtn.setAttribute("aria-disabled", "true");
    if (!wrecked) {
      document.documentElement.classList.add("wrecked");
      mainEl.inert = true;
      var f = fall();
      glide(document.documentElement.scrollHeight, f.longest);
      whenDone(f.anims, function () {
        wrecked = true; busy = false;
        wreckBtn.textContent = "git reset --hard";
        wreckBtn.title = "Let\u2019s pretend that never happened.";
        wreckBtn.removeAttribute("aria-disabled");
        wreckMsg.textContent = "The page has fallen apart. Press git reset --hard to restore it.";
      });
    } else {
      var back = crumbs.map(function (c) {
        return c.e.animate([{ transform: c.rest }, { transform: "none" }],
          { duration: rnd(450, 850), delay: rnd(0, 250), easing: "cubic-bezier(.3,0,.2,1)", fill: "both" });
      });
      glide(0, 900);
      whenDone(back, function () {
        crumbs.forEach(function (c) { c.anim.cancel(); });
        back.forEach(function (an) { an.cancel(); });
        crumbs = [];
        mainEl.inert = false;
        document.documentElement.classList.remove("wrecked");
        wrecked = false; busy = false;
        wreckBtn.textContent = "git push --force";
        wreckBtn.title = PUSH_TIP;
        wreckBtn.removeAttribute("aria-disabled");
        wreckMsg.textContent = "The page is restored.";
      });
    }
  });
  fetch("status.json", { cache: "no-cache" })
    .then(function (r) { if (!r.ok) throw new Error("status " + r.status); return r.json(); })
    .then(function (d) {
      data = d;
      conPage = 0;
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
