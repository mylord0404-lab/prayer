/* 상황별 기도문 — 앱 로직 (오프라인, 외부 호출 없음) */
(function (root) {
  "use strict";
  var D = root.PRAYER_DATA;

  /* ───── 한국어 조사 처리 ───── */
  var DIGIT_JONG = { "0": 21, "1": 8, "2": 0, "3": 16, "4": 0, "5": 0, "6": 1, "7": 8, "8": 8, "9": 0 };
  function lastJong(word) {
    var w = String(word).replace(/[\s)\]}"'’”」』.,!?~·…]+$/g, "");
    if (!w) return 0;
    var ch = w.charAt(w.length - 1), c = ch.charCodeAt(0);
    if (c >= 0xac00 && c <= 0xd7a3) return (c - 0xac00) % 28;
    if (DIGIT_JONG.hasOwnProperty(ch)) return DIGIT_JONG[ch];
    if (/[lL]$/.test(w)) return 8;
    if (/(ng|[mnrMNR])$/.test(w)) return 4;
    return 0;
  }
  var SELF = { "저": { "이/가": "제가", "의": "제", "에게": "제게" } };
  function josa(word, p) {
    if (!p) return word;
    if (SELF[word] && SELF[word][p]) return SELF[word][p];
    if (p === "의" || p === "에게") return word + p;
    var j = lastJong(word);
    if (p === "으로/로") return word + (j === 0 || j === 8 ? "로" : "으로");
    var ab = p.split("/");
    return word + (j ? ab[0] : ab[1]);
  }
  function fill(tpl, ctx) {
    return tpl.replace(/\{([ND])(이\/가|을\/를|은\/는|과\/와|으로\/로|의|에게)?\}/g, function (_, k, p) {
      return josa(k === "N" ? ctx.N : ctx.D, p || "");
    });
  }

  /* ───── 무작위 도구 ───── */
  function rnd(n) { return Math.floor(Math.random() * n); }
  function pick(a) { return a[rnd(a.length)]; }
  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = rnd(i + 1), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  // 순서를 유지한 채 n개 고르기 (간구의 흐름을 자연스럽게)
  function sampleOrdered(a, n) {
    var idx = shuffle(a.map(function (_, i) { return i; })).slice(0, Math.min(n, a.length)).sort(function (x, y) { return x - y; });
    return idx.map(function (i) { return a[i]; });
  }
  function uniq(a) { var s = {}; return a.filter(function (x) { if (s[x]) return false; s[x] = 1; return true; }); }

  function cleanName(s) { return String(s || "").replace(/\s+/g, " ").trim().slice(0, 30); }
  function cleanDetail(s) { return String(s || "").replace(/\s+/g, " ").trim().replace(/[.!?。…\s]+$/g, "").slice(0, 60); }
  function isSentence(d) { return /(다|요|까|죠|네|니다)$/.test(d) || d.split(" ").length > 6; }

  var LEN = { short: { praise: 1, confess: 1, ask: 2 }, normal: { praise: 2, confess: 2, ask: 4 }, long: { praise: 3, confess: 3, ask: 7 } };

  function situation(id) { for (var i = 0; i < D.situations.length; i++) if (D.situations[i].id === id) return D.situations[i]; return null; }

  function generate(o) {
    var s = situation(o.sit); if (!s) throw new Error("unknown situation");
    var G = D.general, we = !!s.we, L = LEN[o.len] || LEN.normal;
    var name = s.nameLabel ? cleanName(o.name) : "";
    var detail = cleanDetail(o.detail);
    var ctx = { N: name || s.who || "", D: detail };
    var addr = o.addr || G.addresses[0];
    var paras = [];

    // 1. 부름 + 찬양/감사
    var first = pick(s.praise);
    var rest = shuffle(uniq(s.praise.filter(function (x) { return x !== first; }).concat(we ? G.praiseWe : G.praiseI)));
    var praise = [first].concat(rest.slice(0, L.praise - 1));
    paras.push({ k: "praise", t: addr + ", " + praise.map(function (x) { return fill(x, ctx); }).join(" ") });

    // 2. 고백/회개 (선택)
    if (o.confess && !s.noConfess) {
      var spec = shuffle(s.confess || []);
      var gen = shuffle(we ? G.confessWe : G.confessI);
      var n = L.confess, list = [];
      if (n === 1) list = [pick(we ? G.confessEndWe : G.confessEndI)];
      else { list = spec.slice(0, 1).concat(gen).slice(0, n - 1); list.push(pick(we ? G.confessEndWe : G.confessEndI)); }
      paras.push({ k: "confess", t: list.map(function (x) { return fill(x, ctx); }).join(" ") });
    }

    // 3. 상황별 간구 (+ 세부 사항)
    var nAsk = Math.min(L.ask, s.lenMax || 99);
    var chosen = sampleOrdered(s.ask, nAsk);
    // 이름을 입력했다면 이름이 들어간 간구가 최소 하나는 포함되도록
    if (name && !chosen.some(function (x) { return /\{N/.test(x); })) {
      var withN = s.ask.filter(function (x) { return /\{N/.test(x); });
      if (withN.length) { chosen[0] = pick(withN); chosen.sort(function (x, y) { return s.ask.indexOf(x) - s.ask.indexOf(y); }); }
    }
    var asks = uniq(chosen).map(function (x) { return fill(x, ctx); });
    if (detail) {
      var dt = isSentence(detail) ? pick(G.detailSentence) : pick((s.detail && s.detail.length ? s.detail : G.detailGeneric));
      asks.splice(Math.min(1, asks.length), 0, fill(dt, ctx));
    }
    if (o.len === "long" && asks.length > 4) {
      var mid = Math.ceil(asks.length / 2);
      paras.push({ k: "ask", t: asks.slice(0, mid).join(" ") });
      paras.push({ k: "ask", t: asks.slice(mid).join(" ") });
    } else {
      paras.push({ k: "ask", t: asks.join(" ") });
    }

    // 4. 말씀
    var verse = null;
    if (o.verse && s.verses && s.verses.length) {
      verse = D.verses[pick(s.verses)];
      paras.push({ k: "verse", lead: pick(G.verseLead), v: verse.t, r: verse.r, follow: pick(we ? G.verseFollowWe : G.verseFollowI) });
    }

    // 5. 마무리
    var closing = (o.len !== "short" && s.close && s.close.length) ? fill(pick(s.close), ctx) + " " : "";
    paras.push({ k: "amen", t: closing + pick(G.amenPrefix) + G.amen });

    var title = s.t + (s.sub ? " · " + s.sub : "") + (name ? " (" + name + ")" : "");
    return { sit: s.id, title: title, paras: paras, text: toText(paras), verse: verse };
  }
  function toText(paras) {
    return paras.map(function (p) {
      if (p.k === "verse") return p.lead + "\n“" + p.v + "” (" + p.r + ")\n" + p.follow;
      return p.t;
    }).join("\n\n");
  }

  var Engine = { generate: generate, josa: josa, fill: fill, lastJong: lastJong, situation: situation };
  root.PrayerEngine = Engine;
  if (typeof module !== "undefined") module.exports = Engine;
  if (typeof document === "undefined") return;

  /* ───────────────── UI ───────────────── */
  var $ = function (s) { return document.querySelector(s); };
  var LS = {
    get: function (k, d) { try { var v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };
  var K = { favs: "prayer.favs.v1", opts: "prayer.opts.v1", fs: "prayer.fontsize.v1", theme: "prayer.theme.v1", hint: "prayer.installhint.v1" };
  var state = { sit: null, current: null, lastText: "" };
  var opts = LS.get(K.opts, { len: "normal", addr: D.general.addresses[0], confess: true, verse: true });

  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }

  function toast(msg) {
    var t = $("#toast"); t.textContent = msg; t.classList.add("show");
    clearTimeout(toast._t); toast._t = setTimeout(function () { t.classList.remove("show"); }, 1800);
  }

  /* 글자 크기 */
  var FS = [17, 19, 21, 23, 26, 29];
  var fsIdx = LS.get(K.fs, 2);
  function applyFs() { document.documentElement.style.setProperty("--pfs", FS[fsIdx] + "px"); LS.set(K.fs, fsIdx); }
  function fontStep(d) { fsIdx = Math.max(0, Math.min(FS.length - 1, fsIdx + d)); applyFs(); }

  /* 테마 */
  var THEMES = ["auto", "light", "dark"], THEME_LABEL = { auto: "자동", light: "밝게", dark: "어둡게" };
  function applyTheme() {
    var t = LS.get(K.theme, "auto");
    if (t === "auto") document.documentElement.removeAttribute("data-theme"); else document.documentElement.setAttribute("data-theme", t);
    var dark = t === "dark" || (t === "auto" && window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches);
    var m = document.querySelector('meta[name="theme-color"]:not([media])');
    if (m) m.setAttribute("content", dark ? "#17161f" : "#46407a");
  }
  function cycleTheme() {
    var t = LS.get(K.theme, "auto"); t = THEMES[(THEMES.indexOf(t) + 1) % 3]; LS.set(K.theme, t); applyTheme(); toast("화면: " + THEME_LABEL[t]);
  }

  /* 상황 목록 */
  function renderHome() {
    var html = D.groups.map(function (g) {
      var items = D.situations.filter(function (s) { return s.g === g; });
      return '<section class="group"><h2 class="group-title">' + esc(g) + '</h2><div class="sit-grid">' +
        items.map(function (s) {
          return '<button type="button" class="sit" data-sit="' + s.id + '"><span class="sit-t">' + esc(s.t) + '</span><span class="sit-s">' + esc(s.sub || "") + "</span></button>";
        }).join("") + "</div></section>";
    }).join("");
    $("#sit-groups").innerHTML = html;
  }

  function show(view) {
    ["home", "compose", "favs"].forEach(function (v) { $("#view-" + v).hidden = v !== view; });
    $("#btn-back").hidden = view === "home";
    $("#btn-home").textContent = view === "favs" ? "즐겨찾기" : "상황별 기도문";
    window.scrollTo(0, 0);
  }

  function openCompose(id, keepResult) {
    var s = situation(id); if (!s) { show("home"); return; }
    if (state.sit !== id) { $("#in-name").value = ""; $("#in-detail").value = ""; keepResult = false; }
    state.sit = id;
    $("#c-group").textContent = s.g; $("#c-title").textContent = s.t; $("#c-sub").textContent = s.sub || "";
    $("#f-name").hidden = !s.nameLabel;
    $("#l-name").textContent = s.nameLabel || "";
    $("#in-name").placeholder = s.namePh || "";
    $("#in-detail").placeholder = s.detailPh || "예: 임플란트 수술";
    $("#t-confess").hidden = !!s.noConfess;
    if (!keepResult) { $("#result").hidden = true; state.current = null; }
    show("compose");
  }

  function readOpts() {
    opts.len = (document.querySelector('input[name="len"]:checked') || {}).value || "normal";
    opts.addr = $("#in-addr").value;
    opts.confess = $("#in-confess").checked;
    opts.verse = $("#in-verse").checked;
    LS.set(K.opts, opts);
  }
  function writeOpts() {
    var r = document.querySelector('input[name="len"][value="' + opts.len + '"]'); if (r) r.checked = true;
    $("#in-addr").innerHTML = D.general.addresses.map(function (a) { return '<option' + (a === opts.addr ? " selected" : "") + ">" + esc(a) + "</option>"; }).join("");
    $("#in-confess").checked = !!opts.confess; $("#in-verse").checked = !!opts.verse;
  }

  function renderPrayer(el, r) {
    el.innerHTML = r.paras.map(function (p) {
      if (p.k === "verse") return '<div class="p verse"><p>' + esc(p.lead) + '</p><blockquote>“' + esc(p.v) + '”<cite>' + esc(p.r) + "</cite></blockquote><p>" + esc(p.follow) + "</p></div>";
      return '<p class="p ' + p.k + '">' + esc(p.t) + "</p>";
    }).join("");
  }

  function doGenerate(again) {
    readOpts();
    var o = { sit: state.sit, name: $("#in-name").value, detail: $("#in-detail").value, len: opts.len, addr: opts.addr, confess: opts.confess, verse: opts.verse };
    var r, tries = 0;
    do { r = generate(o); tries++; } while (r.text === state.lastText && tries < 12);
    state.current = r; state.lastText = r.text;
    $("#r-title").textContent = r.title;
    renderPrayer($("#prayer"), r);
    $("#result").hidden = false;
    var b = $("#btn-save"); b.classList.remove("saved"); b.textContent = "☆ 저장";
    if (!again) setTimeout(function () { $("#result").scrollIntoView({ behavior: "smooth", block: "start" }); }, 30);
    else { $("#prayer").classList.remove("fade"); void $("#prayer").offsetWidth; $("#prayer").classList.add("fade"); }
  }

  function copyText(text) {
    function fallback() {
      var ta = document.createElement("textarea"); ta.value = text; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select(); ta.setSelectionRange(0, text.length);
      var ok = false; try { ok = document.execCommand("copy"); } catch (e) {}
      document.body.removeChild(ta); return ok;
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(function () { toast("복사했습니다"); }, function () { toast(fallback() ? "복사했습니다" : "복사하지 못했습니다"); });
    }
    toast(fallback() ? "복사했습니다" : "복사하지 못했습니다");
  }
  function shareText(title, text) {
    if (navigator.share) {
      navigator.share({ title: title, text: text }).catch(function (e) { if (e && e.name !== "AbortError") copyText(text); });
    } else { copyText(text); }
  }

  /* 즐겨찾기 */
  function favs() { return LS.get(K.favs, []); }
  function saveFav() {
    var r = state.current; if (!r) return;
    var list = favs();
    if (list.some(function (f) { return f.text === r.text; })) { toast("이미 저장된 기도문입니다"); return; }
    list.unshift({ id: Date.now().toString(36) + rnd(1e6).toString(36), sit: r.sit, title: r.title, text: r.text, at: new Date().toISOString() });
    LS.set(K.favs, list);
    var b = $("#btn-save"); b.classList.add("saved"); b.textContent = "★ 저장됨";
    updateFavCount(); toast("즐겨찾기에 저장했습니다");
  }
  function updateFavCount() { var n = favs().length; $("#fav-count").textContent = n ? n : ""; }
  function fmtDate(iso) { var d = new Date(iso); return d.getFullYear() + "." + (d.getMonth() + 1) + "." + d.getDate(); }
  function renderFavs() {
    var list = favs();
    if (!list.length) { $("#fav-list").innerHTML = '<p class="empty">아직 저장한 기도문이 없습니다.<br>기도문을 만든 뒤 ‘☆ 저장’을 눌러 보세요.</p>'; return; }
    $("#fav-list").innerHTML = list.map(function (f) {
      return '<article class="card fav" data-id="' + f.id + '"><button type="button" class="fav-head" data-act="toggle"><span class="fav-title">' + esc(f.title) + '</span><span class="fav-date">' + fmtDate(f.at) + '</span></button>' +
        '<div class="prayer fav-text">' + esc(f.text).split("\n\n").map(function (p) { return "<p>" + p.replace(/\n/g, "<br>") + "</p>"; }).join("") + "</div>" +
        '<div class="actions small"><button type="button" class="btn" data-act="copy">복사</button><button type="button" class="btn" data-act="share">공유</button><button type="button" class="btn danger" data-act="del">삭제</button></div></article>';
    }).join("");
  }
  function favAction(e) {
    var b = e.target.closest("[data-act]"); if (!b) return;
    var card = b.closest(".fav"), id = card.getAttribute("data-id");
    var f = favs().filter(function (x) { return x.id === id; })[0]; if (!f) return;
    var act = b.getAttribute("data-act");
    if (act === "toggle") card.classList.toggle("open");
    else if (act === "copy") copyText(f.text);
    else if (act === "share") shareText(f.title, f.text);
    else if (act === "del") {
      if (!confirm("이 기도문을 삭제할까요?")) return;
      LS.set(K.favs, favs().filter(function (x) { return x.id !== id; }));
      renderFavs(); updateFavCount(); toast("삭제했습니다");
    }
  }

  /* 라우팅 (#/s/상황, #/favs) */
  function route() {
    var h = location.hash.replace(/^#\/?/, "");
    if (h.indexOf("s/") === 0) openCompose(h.slice(2), true);
    else if (h === "favs") { renderFavs(); show("favs"); }
    else show("home");
  }

  function isStandalone() { return window.navigator.standalone === true || (window.matchMedia && matchMedia("(display-mode: standalone)").matches); }
  function maybeInstallHint() {
    var ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
    if (ios && !isStandalone() && !LS.get(K.hint, false)) $("#install-hint").hidden = false;
  }

  function init() {
    renderHome(); writeOpts(); applyFs(); applyTheme(); updateFavCount();
    $("#sit-groups").addEventListener("click", function (e) { var b = e.target.closest(".sit"); if (b) location.hash = "#/s/" + b.getAttribute("data-sit"); });
    $("#btn-back").addEventListener("click", function () { if (history.length > 1 && location.hash) history.back(); else location.hash = ""; });
    $("#btn-home").addEventListener("click", function () { location.hash = ""; });
    $("#btn-favs").addEventListener("click", function () { location.hash = "#/favs"; });
    $("#btn-theme").addEventListener("click", cycleTheme);
    $("#btn-help").addEventListener("click", function () { $("#help").showModal ? $("#help").showModal() : $("#help").setAttribute("open", ""); });
    $("#help-close").addEventListener("click", function () { $("#help").close ? $("#help").close() : $("#help").removeAttribute("open"); });
    $("#opts").addEventListener("submit", function (e) { e.preventDefault(); if (document.activeElement) document.activeElement.blur(); doGenerate(false); });
    $("#opts").addEventListener("change", readOpts);
    $("#btn-again").addEventListener("click", function () { doGenerate(true); });
    $("#btn-copy").addEventListener("click", function () { if (state.current) copyText(state.current.text); });
    $("#btn-share").addEventListener("click", function () { if (state.current) shareText(state.current.title, state.current.text); });
    $("#btn-save").addEventListener("click", saveFav);
    $("#fs-minus").addEventListener("click", function () { fontStep(-1); });
    $("#fs-plus").addEventListener("click", function () { fontStep(1); });
    $("#fav-list").addEventListener("click", favAction);
    $("#hint-open").addEventListener("click", function () { $("#help").showModal(); });
    $("#hint-close").addEventListener("click", function () { $("#install-hint").hidden = true; LS.set(K.hint, true); });
    if (window.matchMedia) matchMedia("(prefers-color-scheme: dark)").addEventListener && matchMedia("(prefers-color-scheme: dark)").addEventListener("change", applyTheme);
    window.addEventListener("hashchange", route);
    route(); maybeInstallHint();
    if ("serviceWorker" in navigator) {
      window.addEventListener("load", function () { navigator.serviceWorker.register("sw.js").catch(function () {}); });
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})(typeof window !== "undefined" ? window : globalThis);
