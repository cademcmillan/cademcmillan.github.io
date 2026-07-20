/* ============================================================
   CCM — cademcmillan.com · app.js
   All page logic. Pages are identified by <body data-page="...">.
   Live sections auto-refresh every 5 minutes.
   ============================================================ */

(function () {
  "use strict";

  var CFG = window.CCM_CONFIG || {};
  var REFRESH_MS = 5 * 60 * 1000;

  /* ---------------- helpers ---------------- */

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function daySeed() {
    var n = new Date();
    var start = new Date(n.getFullYear(), 0, 0);
    var day = Math.floor((n - start) / 86400000);
    return n.getFullYear() * 366 + day;
  }

  function fmtTime(d) {
    return new Date(d).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }

  function fmtDateShort(d) {
    return new Date(d).toLocaleDateString([], { month: "short", day: "numeric" });
  }

  function firstSentences(text, n) {
    var parts = String(text || "").match(/[^.!?]+[.!?]+(\s|$)/g) || [String(text || "")];
    return parts.slice(0, n).join(" ").trim();
  }

  function setLoading(el) { if (el) el.innerHTML = '<p class="loading">LOADING…</p>'; }
  function setFail(el, msg) { if (el) el.innerHTML = '<p class="muted small">' + esc(msg || "Couldn't load this right now — it'll retry on the next refresh.") + "</p>"; }

  function stampUpdated() {
    var el = $("#last-updated");
    if (el) el.textContent = "LIVE SECTIONS UPDATED " + new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }).toUpperCase();
  }

  /* ---------------- TradingView embed helper ---------------- */

  function tvWidget(el, widgetName, config) {
    if (!el) return;
    el.innerHTML = "";
    var container = document.createElement("div");
    container.className = "tradingview-widget-container";
    var inner = document.createElement("div");
    inner.className = "tradingview-widget-container__widget";
    container.appendChild(inner);
    var s = document.createElement("script");
    s.type = "text/javascript";
    s.async = true;
    s.src = "https://s3.tradingview.com/external-embedding/embed-widget-" + widgetName + ".js";
    s.innerHTML = JSON.stringify(config);
    container.appendChild(s);
    el.appendChild(container);
  }

  var INDEX_SYMBOLS = [
    { proName: "FOREXCOM:SPXUSD", title: "S&P 500" },
    { proName: "FOREXCOM:DJI", title: "Dow Jones" },
    { proName: "FOREXCOM:NSXUSD", title: "Nasdaq 100" },
    { proName: "TVC:RUT", title: "Russell 2000" },
    { proName: "TVC:VIX", title: "VIX" },
    { proName: "BITSTAMP:BTCUSD", title: "Bitcoin" },
    { proName: "TVC:USOIL", title: "Crude Oil" }
  ];

  function loadTicker() {
    tvWidget($("#ticker"), "ticker-tape", {
      symbols: INDEX_SYMBOLS,
      showSymbolLogo: false,
      colorTheme: "light",
      isTransparent: true,
      displayMode: "adaptive",
      locale: "en"
    });
  }

  /* ---------------- STOCKS TAB ---------------- */

  function loadStocksPage() {
    tvWidget($("#tv-overview"), "market-overview", {
      colorTheme: "light", dateRange: "1D", showChart: true, locale: "en",
      isTransparent: true, width: "100%", height: 480,
      plotLineColorGrowing: "rgba(20,122,70,1)", plotLineColorFalling: "rgba(176,57,44,1)",
      belowLineFillColorGrowing: "rgba(20,122,70,0.10)", belowLineFillColorFalling: "rgba(176,57,44,0.10)",
      tabs: [
        { title: "Indices", symbols: [
          { s: "FOREXCOM:SPXUSD", d: "S&P 500" },
          { s: "FOREXCOM:DJI", d: "Dow Jones" },
          { s: "FOREXCOM:NSXUSD", d: "Nasdaq 100" },
          { s: "TVC:RUT", d: "Russell 2000" },
          { s: "TVC:VIX", d: "VIX" }
        ]},
        { title: "Crypto", symbols: [
          { s: "BITSTAMP:BTCUSD", d: "Bitcoin" },
          { s: "BITSTAMP:ETHUSD", d: "Ethereum" }
        ]},
        { title: "Commodities", symbols: [
          { s: "TVC:USOIL", d: "Crude Oil (WTI)" },
          { s: "TVC:GOLD", d: "Gold" },
          { s: "TVC:SILVER", d: "Silver" }
        ]}
      ]
    });

    tvWidget($("#tv-news"), "timeline", {
      feedMode: "market", market: "stock", colorTheme: "light",
      isTransparent: true, displayMode: "regular", width: "100%", height: 500, locale: "en"
    });

    loadEarnings();
    initWatchlist();
  }

  function loadEarnings() {
    var el = $("#earnings");
    if (!el) return;
    var key = (CFG.FINNHUB_API_KEY || "").trim();
    if (!key) {
      el.innerHTML =
        '<div class="notice">To show upcoming earnings, grab a <strong>free API key</strong> at ' +
        '<a href="https://finnhub.io" target="_blank" rel="noopener">finnhub.io</a> (sign up, copy the key ' +
        'from your dashboard) and paste it into <span class="mono">js/config.js</span> as ' +
        '<span class="mono">FINNHUB_API_KEY</span>. Takes about two minutes.</div>';
      return;
    }
    setLoading(el);
    var from = new Date(), to = new Date();
    to.setDate(to.getDate() + 10);
    function iso(d) { return d.toISOString().slice(0, 10); }
    fetch("https://finnhub.io/api/v1/calendar/earnings?from=" + iso(from) + "&to=" + iso(to) + "&token=" + encodeURIComponent(key))
      .then(function (r) { return r.json(); })
      .then(function (j) {
        var rows = (j.earningsCalendar || []).slice();
        if (!rows.length) { el.innerHTML = '<p class="muted">No earnings reports found in the next 10 days.</p>'; return; }
        rows.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : (a.symbol < b.symbol ? -1 : 1); });
        var hourMap = { bmo: "Before open", amc: "After close", dmh: "During market" };
        var shown = rows.slice(0, 80);
        var html = '<table class="data"><thead><tr><th>Date</th><th>Symbol</th><th>When</th><th>EPS est.</th></tr></thead><tbody>';
        shown.forEach(function (r) {
          html += "<tr><td>" + esc(fmtDateShort(r.date + "T12:00:00")) + '</td><td class="sym">' + esc(r.symbol) + "</td><td>" +
            esc(hourMap[r.hour] || "—") + "</td><td>" + (r.epsEstimate != null ? "$" + Number(r.epsEstimate).toFixed(2) : "—") + "</td></tr>";
        });
        html += "</tbody></table>";
        if (rows.length > shown.length) html += '<p class="muted small">Showing ' + shown.length + " of " + rows.length + " scheduled reports.</p>";
        el.innerHTML = html;
      })
      .catch(function () { setFail(el); });
  }

  /* ---------------- WATCHLIST (localStorage + TradingView minis) ---------------- */

  function getWatchlist() {
    try { return JSON.parse(localStorage.getItem("ccm_watchlist")) || []; }
    catch (e) { return []; }
  }
  function saveWatchlist(list) { localStorage.setItem("ccm_watchlist", JSON.stringify(list)); }

  function initWatchlist() {
    var input = $("#watch-input"), btn = $("#watch-add");
    if (!input || !btn) return;
    function add() {
      var sym = input.value.trim().toUpperCase().replace(/[^A-Z0-9.:-]/g, "");
      if (!sym) return;
      var list = getWatchlist();
      if (list.indexOf(sym) === -1) { list.push(sym); saveWatchlist(list); }
      input.value = "";
      renderWatchlist();
    }
    btn.addEventListener("click", add);
    input.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); add(); } });
    renderWatchlist();
  }

  function renderWatchlist() {
    var chips = $("#watch-chips"), grid = $("#watch-grid");
    if (!chips || !grid) return;
    var list = getWatchlist();
    if (!list.length) {
      chips.innerHTML = "";
      grid.innerHTML = '<p class="muted">Your watchlist is empty. Add a ticker above (e.g. <span class="mono">AAPL</span>, <span class="mono">NVDA</span>, <span class="mono">TSLA</span>) — it\'s saved in this browser and will be here tomorrow.</p>';
      return;
    }
    chips.innerHTML = list.map(function (s) {
      return '<span class="chip">' + esc(s) + ' <button type="button" aria-label="Remove ' + esc(s) + '" data-sym="' + esc(s) + '">✕</button></span>';
    }).join("");
    $all("button[data-sym]", chips).forEach(function (b) {
      b.addEventListener("click", function () {
        saveWatchlist(getWatchlist().filter(function (x) { return x !== b.getAttribute("data-sym"); }));
        renderWatchlist();
      });
    });
    grid.innerHTML = "";
    list.forEach(function (sym) {
      var cell = document.createElement("div");
      grid.appendChild(cell);
      tvWidget(cell, "mini-symbol-overview", {
        symbol: sym, width: "100%", height: 180, locale: "en",
        dateRange: "1M", colorTheme: "light", isTransparent: true,
        autosize: false, largeChartUrl: ""
      });
    });
  }

  /* ---------------- SPORTS (ESPN public feeds) ---------------- */

  var LEAGUES = [
    { key: "nfl", label: "NFL", path: "football/nfl" },
    { key: "cfb", label: "College Football", path: "football/college-football" },
    { key: "ufc", label: "UFC", path: "mma/ufc", mma: true },
    { key: "nba", label: "NBA", path: "basketball/nba" },
    { key: "mlb", label: "MLB", path: "baseball/mlb" }
  ];

  function espn(path) {
    return fetch("https://site.api.espn.com/apis/site/v2/sports/" + path)
      .then(function (r) { return r.json(); });
  }

  function describeTeamEvent(e) {
    var comp = (e.competitions || [])[0] || {};
    var comps = comp.competitors || [];
    var home = comps.filter(function (c) { return c.homeAway === "home"; })[0];
    var away = comps.filter(function (c) { return c.homeAway === "away"; })[0];
    if (!home || !away) return null;
    var state = e.status && e.status.type ? e.status.type.state : "pre";
    var detail = e.status && e.status.type ? e.status.type.shortDetail : "";
    var matchup, when = "";
    if (state === "pre") {
      matchup = away.team.shortDisplayName + " @ " + home.team.shortDisplayName;
      when = fmtTime(e.date);
    } else {
      matchup = away.team.shortDisplayName + " " + (away.score || "0") + " — " + (home.score || "0") + " " + home.team.shortDisplayName;
      when = detail;
    }
    var odds = "";
    if (state === "pre" && comp.odds && comp.odds[0]) {
      var o = comp.odds[0];
      var bits = [];
      if (o.details) bits.push(o.details);
      if (o.overUnder != null) bits.push("O/U " + o.overUnder);
      odds = bits.join(" · ");
    }
    return { matchup: matchup, when: when, odds: odds, state: state };
  }

  function gameRowHTML(g) {
    return '<div class="gamerow"><span class="matchup">' + esc(g.matchup) +
      (g.odds ? ' <span class="odds">' + esc(g.odds) + "</span>" : "") +
      '</span><span class="when">' + esc(g.when) + "</span></div>";
  }

  function loadSportsHome() {
    var el = $("#home-sports");
    if (!el) return;
    setLoading(el);
    Promise.all(LEAGUES.map(function (L) {
      return espn(L.path + "/scoreboard").then(function (j) { return { L: L, j: j }; })
        .catch(function () { return { L: L, j: { events: [] } }; });
    })).then(function (results) {
      var html = "", total = 0;
      results.forEach(function (res) {
        var events = (res.j.events || []);
        if (!events.length || total >= 10) return;
        var rows = "";
        var count = 0;
        events.forEach(function (e) {
          if (count >= 3 || total >= 10) return;
          if (res.L.mma) {
            rows += gameRowHTML({ matchup: e.name || e.shortName || "UFC event", when: fmtTime(e.date), odds: "" });
          } else {
            var g = describeTeamEvent(e);
            if (!g) return;
            rows += gameRowHTML(g);
          }
          count++; total++;
        });
        if (rows) html += '<div class="league-label">' + esc(res.L.label) + "</div>" + rows;
      });
      el.innerHTML = html || '<p class="muted">No games on the slate today across NFL, college football, UFC, NBA, or MLB. Check the Sports tab for headlines.</p>';
    }).catch(function () { setFail(el); });
  }

  function loadSportsPage() {
    var head = $("#sports-headlines"), boards = $("#sports-boards");
    if (head) {
      setLoading(head);
      Promise.all([
        espn("football/nfl/news").catch(function () { return { articles: [] }; }),
        espn("football/college-football/news").catch(function () { return { articles: [] }; }),
        espn("mma/news").catch(function () { return { articles: [] }; }),
        espn("basketball/nba/news").catch(function () { return { articles: [] }; }),
        espn("baseball/mlb/news").catch(function () { return { articles: [] }; })
      ]).then(function (feeds) {
        var labels = ["NFL", "CFB", "MMA", "NBA", "MLB"];
        var items = [];
        feeds.forEach(function (f, i) {
          (f.articles || []).slice(0, 4).forEach(function (a) {
            items.push({ t: a.headline, l: (a.links && a.links.web && a.links.web.href) || "#", s: labels[i], d: a.published });
          });
        });
        if (!items.length) { setFail(head); return; }
        head.innerHTML = '<ul class="headlines">' + items.map(function (it) {
          return "<li><a href=\"" + esc(it.l) + '" target="_blank" rel="noopener">' + esc(it.t) + '</a><span class="meta">' + esc(it.s) + "</span></li>";
        }).join("") + "</ul>";
      });
    }
    if (boards) {
      setLoading(boards);
      Promise.all(LEAGUES.map(function (L) {
        return espn(L.path + "/scoreboard").then(function (j) { return { L: L, j: j }; })
          .catch(function () { return { L: L, j: { events: [] } }; });
      })).then(function (results) {
        var html = "";
        results.forEach(function (res) {
          var events = res.j.events || [];
          html += '<section class="block"><h2>' + esc(res.L.label) + "</h2>";
          if (!events.length) {
            html += '<p class="muted">Nothing scheduled today.</p></section>';
            return;
          }
          if (res.L.mma) {
            events.slice(0, 3).forEach(function (e) {
              html += '<div class="league-label">' + esc(e.name || "UFC card") + " · " + esc(fmtDateShort(e.date)) + "</div>";
              var fights = (e.competitions || []).slice(0, 6);
              fights.forEach(function (f) {
                var names = (f.competitors || []).map(function (c) {
                  return c.athlete ? c.athlete.displayName : (c.team ? c.team.displayName : "TBD");
                });
                var st = f.status && f.status.type ? f.status.type.shortDetail : "";
                html += gameRowHTML({ matchup: names.join(" vs "), when: st || fmtTime(e.date), odds: "" });
              });
            });
          } else {
            events.forEach(function (e) {
              var g = describeTeamEvent(e);
              if (g) html += gameRowHTML(g);
            });
            html += '<p class="muted small">Lines shown next to upcoming games are ESPN BET odds where available.</p>';
          }
          html += "</section>";
        });
        boards.innerHTML = html;
      }).catch(function () { setFail(boards); });
    }
  }

  /* ---------------- HISTORICAL FIGURE (Wikipedia) ---------------- */

  function fetchFigures() {
    var n = new Date();
    var mm = String(n.getMonth() + 1).padStart(2, "0");
    var dd = String(n.getDate()).padStart(2, "0");
    return fetch("https://en.wikipedia.org/api/rest_v1/feed/onthisday/births/" + mm + "/" + dd)
      .then(function (r) { return r.json(); })
      .then(function (j) {
        return (j.births || []).filter(function (b) {
          var p = b.pages && b.pages[0];
          return p && p.thumbnail && p.extract && p.extract.length > 120;
        });
      });
  }

  function loadFigureHome() {
    var el = $("#home-figure");
    if (!el) return;
    setLoading(el);
    fetchFigures().then(function (figs) {
      if (!figs.length) { setFail(el); return; }
      var pick = figs[daySeed() % Math.min(figs.length, 15)];
      var p = pick.pages[0];
      el.innerHTML =
        '<div class="figure-flex">' +
        '<img src="' + esc(p.thumbnail.source) + '" alt="' + esc(p.titles.normalized) + '">' +
        '<div><h3 class="fig-name">' + esc(p.titles.normalized) + "</h3>" +
        '<div class="fig-years">BORN THIS DAY, ' + esc(pick.year) + "</div>" +
        '<p style="margin:8px 0 0">' + esc(firstSentences(p.extract, 2)) + "</p></div></div>";
    }).catch(function () { setFail(el); });
  }

  function loadFigurePage() {
    var el = $("#figure-detail"), others = $("#figure-others");
    if (!el) return;
    setLoading(el);
    fetchFigures().then(function (figs) {
      if (!figs.length) { setFail(el); return; }
      var idx = daySeed() % Math.min(figs.length, 15);
      var pick = figs[idx];
      var p = pick.pages[0];
      var img = (p.originalimage && p.originalimage.source) || p.thumbnail.source;
      var url = p.content_urls && p.content_urls.desktop ? p.content_urls.desktop.page : "#";
      el.innerHTML =
        '<div class="figure-flex" style="gap:26px">' +
        '<img style="width:200px" src="' + esc(img) + '" alt="' + esc(p.titles.normalized) + '">' +
        '<div class="prose"><h3 class="fig-name" style="font-size:30px">' + esc(p.titles.normalized) + "</h3>" +
        '<div class="fig-years">BORN THIS DAY IN ' + esc(pick.year) + " · " + esc(pick.text || "") + "</div>" +
        '<p style="margin-top:12px">' + esc(p.extract) + "</p>" +
        '<p><a class="btn" href="' + esc(url) + '" target="_blank" rel="noopener">Read more on Wikipedia →</a></p>' +
        '<p class="muted small">Summary and image from Wikipedia (CC BY-SA).</p></div></div>';
      if (others) {
        var rest = figs.filter(function (_, i) { return i !== idx; }).slice(0, 6);
        others.innerHTML = '<ul class="headlines">' + rest.map(function (b) {
          var pg = b.pages[0];
          var u = pg.content_urls && pg.content_urls.desktop ? pg.content_urls.desktop.page : "#";
          return "<li><a href=\"" + esc(u) + '" target="_blank" rel="noopener">' + esc(pg.titles.normalized) +
            '</a><span class="meta">BORN ' + esc(b.year) + "</span></li>";
        }).join("") + "</ul>";
      }
    }).catch(function () { setFail(el); });
  }

  /* ---------------- VOCAB (Free Dictionary API) ---------------- */

  function todaysWord() {
    var words = window.CCM_WORDS || ["serendipity"];
    return words[daySeed() % words.length];
  }

  function fetchWord(word) {
    return fetch("https://api.dictionaryapi.dev/api/v2/entries/en/" + encodeURIComponent(word))
      .then(function (r) { if (!r.ok) throw new Error("no entry"); return r.json(); })
      .then(function (j) { return j[0]; });
  }

  function loadVocabHome() {
    var el = $("#home-vocab");
    if (!el) return;
    var word = todaysWord();
    setLoading(el);
    fetchWord(word).then(function (entry) {
      var m = (entry.meanings || [])[0] || {};
      var d = (m.definitions || [])[0] || {};
      el.innerHTML =
        '<div class="word-display">' + esc(entry.word || word) + "</div>" +
        '<div class="word-pos">' + esc(m.partOfSpeech || "") + "</div>" +
        '<p class="word-def">' + esc(d.definition || "") + "</p>";
    }).catch(function () {
      el.innerHTML = '<div class="word-display">' + esc(word) + "</div>" +
        '<p class="muted small">Definition service is napping — see the Vocab tab for links.</p>';
    });
  }

  function loadVocabPage() {
    var el = $("#vocab-detail");
    if (!el) return;
    var word = todaysWord();
    setLoading(el);
    var links =
      '<p style="margin-top:20px">' +
      '<a class="btn" href="https://www.etymonline.com/word/' + encodeURIComponent(word) + '" target="_blank" rel="noopener">Etymology →</a> ' +
      '<a class="btn" href="https://www.merriam-webster.com/dictionary/' + encodeURIComponent(word) + '" target="_blank" rel="noopener" style="margin-left:8px">Merriam-Webster →</a></p>';
    fetchWord(word).then(function (entry) {
      var html = '<div class="word-display" style="font-size:48px">' + esc(entry.word || word) + "</div>";
      var phon = (entry.phonetics || []).filter(function (p) { return p.text; })[0];
      var audio = (entry.phonetics || []).filter(function (p) { return p.audio; })[0];
      if (phon) html += '<div class="word-pos" style="font-size:15px">' + esc(phon.text) + "</div>";
      if (audio) html += '<p><button class="btn" type="button" id="say-word">▶ Hear it</button></p>';
      (entry.meanings || []).forEach(function (m) {
        html += '<section class="block"><h2>' + esc(m.partOfSpeech || "meaning") + "</h2><ol>";
        (m.definitions || []).slice(0, 4).forEach(function (d) {
          html += "<li><p style=\"margin:4px 0\">" + esc(d.definition) + "</p>" +
            (d.example ? '<p class="muted small" style="margin:0 0 8px">“' + esc(d.example) + "”</p>" : "") + "</li>";
        });
        html += "</ol>";
        var syn = (m.synonyms || []).slice(0, 10);
        var ant = (m.antonyms || []).slice(0, 10);
        if (syn.length) html += '<p class="small"><strong>Synonyms:</strong> ' + esc(syn.join(", ")) + "</p>";
        if (ant.length) html += '<p class="small"><strong>Antonyms:</strong> ' + esc(ant.join(", ")) + "</p>";
        html += "</section>";
      });
      if (entry.origin) html += '<section class="block"><h2>Origin</h2><p>' + esc(entry.origin) + "</p></section>";
      html += links;
      el.innerHTML = html;
      var btn = $("#say-word");
      if (btn && audio) btn.addEventListener("click", function () { new Audio(audio.audio).play(); });
    }).catch(function () {
      el.innerHTML = '<div class="word-display" style="font-size:48px">' + esc(word) + "</div>" +
        '<p class="muted">The free dictionary service didn\'t have an entry handy — use the links below.</p>' + links;
    });
  }

  /* ---------------- MOVIES (TMDB) ---------------- */

  function tmdbSetupNotice() {
    return '<div class="notice">To light up the movies section, create a free account at ' +
      '<a href="https://www.themoviedb.org" target="_blank" rel="noopener">themoviedb.org</a>, then go to ' +
      '<strong>Settings → API → Create → Developer</strong> and copy your <strong>API Key</strong> into ' +
      '<span class="mono">js/config.js</span> as <span class="mono">TMDB_API_KEY</span>. Takes ~2 minutes and it\'s free.</div>';
  }

  function tmdb(path) {
    var key = (CFG.TMDB_API_KEY || "").trim();
    var sep = path.indexOf("?") > -1 ? "&" : "?";
    return fetch("https://api.themoviedb.org/3/" + path + sep + "api_key=" + encodeURIComponent(key))
      .then(function (r) { return r.json(); });
  }

  function posterHTML(m) {
    var img = m.poster_path
      ? '<img loading="lazy" src="https://image.tmdb.org/t/p/w342' + esc(m.poster_path) + '" alt="' + esc(m.title) + ' poster">'
      : '<div style="aspect-ratio:2/3;border:1px solid var(--rule);display:flex;align-items:center;justify-content:center" class="muted small">No poster</div>';
    return '<div class="movie">' + img + '<div class="t">' + esc(m.title) + '</div><div class="d">' +
      esc(m.release_date ? fmtDateShort(m.release_date + "T12:00:00") : "TBA") +
      (m.vote_average ? " · ★ " + Number(m.vote_average).toFixed(1) : "") + "</div></div>";
  }

  function loadMoviesHome() {
    var el = $("#home-movies");
    if (!el) return;
    if (!(CFG.TMDB_API_KEY || "").trim()) { el.innerHTML = tmdbSetupNotice(); return; }
    setLoading(el);
    Promise.all([tmdb("movie/now_playing?region=US"), tmdb("movie/upcoming?region=US")])
      .then(function (res) {
        var seen = {}, all = [];
        (res[0].results || []).concat(res[1].results || []).forEach(function (m) {
          if (!seen[m.id]) { seen[m.id] = 1; all.push(m); }
        });
        all.sort(function (a, b) { return b.popularity - a.popularity; });
        el.innerHTML = '<div class="poster-grid" style="grid-template-columns:repeat(3,1fr)">' +
          all.slice(0, 3).map(posterHTML).join("") + "</div>";
      })
      .catch(function () { setFail(el); });
  }

  function loadMoviesPage() {
    var now = $("#movies-now"), up = $("#movies-upcoming");
    if (!now) return;
    if (!(CFG.TMDB_API_KEY || "").trim()) {
      now.innerHTML = tmdbSetupNotice();
      if (up) up.innerHTML = "";
      return;
    }
    setLoading(now); if (up) setLoading(up);
    tmdb("movie/now_playing?region=US").then(function (j) {
      var list = (j.results || []).sort(function (a, b) { return b.popularity - a.popularity; }).slice(0, 12);
      now.innerHTML = '<div class="poster-grid">' + list.map(posterHTML).join("") + "</div>";
    }).catch(function () { setFail(now); });
    if (up) {
      tmdb("movie/upcoming?region=US").then(function (j) {
        var today = new Date().toISOString().slice(0, 10);
        var list = (j.results || [])
          .filter(function (m) { return m.release_date && m.release_date >= today; })
          .sort(function (a, b) { return a.release_date < b.release_date ? -1 : 1; })
          .slice(0, 12);
        up.innerHTML = '<div class="poster-grid">' + list.map(posterHTML).join("") + "</div>" +
          '<p class="muted small" style="margin-top:14px">This product uses the TMDB API but is not endorsed or certified by TMDB.</p>';
      }).catch(function () { setFail(up); });
    }
  }

  /* ---------------- WEATHER (Open-Meteo, no key) ---------------- */

  var WX = {
    0: ["☀️", "Clear"], 1: ["🌤️", "Mostly clear"], 2: ["⛅", "Partly cloudy"], 3: ["☁️", "Overcast"],
    45: ["🌫️", "Fog"], 48: ["🌫️", "Freezing fog"],
    51: ["🌦️", "Light drizzle"], 53: ["🌦️", "Drizzle"], 55: ["🌦️", "Heavy drizzle"],
    56: ["🌧️", "Freezing drizzle"], 57: ["🌧️", "Freezing drizzle"],
    61: ["🌧️", "Light rain"], 63: ["🌧️", "Rain"], 65: ["🌧️", "Heavy rain"],
    66: ["🌧️", "Freezing rain"], 67: ["🌧️", "Freezing rain"],
    71: ["🌨️", "Light snow"], 73: ["🌨️", "Snow"], 75: ["❄️", "Heavy snow"], 77: ["🌨️", "Snow grains"],
    80: ["🌦️", "Showers"], 81: ["🌧️", "Showers"], 82: ["⛈️", "Heavy showers"],
    85: ["🌨️", "Snow showers"], 86: ["❄️", "Snow showers"],
    95: ["⛈️", "Thunderstorm"], 96: ["⛈️", "Storm with hail"], 99: ["⛈️", "Storm with hail"]
  };
  function wx(code) { return WX[code] || ["🌡️", "—"]; }

  function fetchWeather(city) {
    var url = "https://api.open-meteo.com/v1/forecast?latitude=" + city.lat + "&longitude=" + city.lon +
      "&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m" +
      "&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max" +
      "&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto&forecast_days=6";
    return fetch(url).then(function (r) { return r.json(); });
  }

  function loadWeatherHome() {
    var el = $("#home-weather");
    if (!el) return;
    var city = (CFG.CITIES || [])[0];
    if (!city) { setFail(el, "Add a city in js/config.js"); return; }
    setLoading(el);
    fetchWeather(city).then(function (j) {
      var c = j.current, d = j.daily;
      var icon = wx(c.weather_code);
      el.innerHTML =
        '<div class="weather-now">' +
        '<div class="temp">' + Math.round(c.temperature_2m) + "°</div>" +
        '<div><div class="icon">' + icon[0] + "</div>" +
        '<div class="cond">' + esc(icon[1]) + " · feels " + Math.round(c.apparent_temperature) + "°</div>" +
        '<div class="hi-lo">H ' + Math.round(d.temperature_2m_max[0]) + "° · L " + Math.round(d.temperature_2m_min[0]) +
        "° · RAIN " + (d.precipitation_probability_max[0] != null ? d.precipitation_probability_max[0] : 0) + "%</div>" +
        "</div></div>";
    }).catch(function () { setFail(el); });
  }

  function loadWeatherPage() {
    var el = $("#weather-cities");
    if (!el) return;
    setLoading(el);
    var cities = CFG.CITIES || [];
    Promise.all(cities.map(function (c) { return fetchWeather(c).catch(function () { return null; }); }))
      .then(function (results) {
        el.innerHTML = results.map(function (j, i) {
          if (!j || !j.current) return "";
          var c = j.current, d = j.daily, icon = wx(c.weather_code);
          var days = "";
          for (var k = 1; k < Math.min(6, d.time.length); k++) {
            var di = wx(d.weather_code[k]);
            days += '<div class="fday"><div class="d">' +
              new Date(d.time[k] + "T12:00:00").toLocaleDateString([], { weekday: "short" }) +
              '</div><div class="i">' + di[0] + '</div><div class="t">' +
              Math.round(d.temperature_2m_max[k]) + "°/" + Math.round(d.temperature_2m_min[k]) + "°</div></div>";
          }
          return '<div class="city-card"><h3>' + esc(cities[i].name) + "</h3>" +
            '<div class="weather-now"><div class="temp">' + Math.round(c.temperature_2m) + "°</div>" +
            '<div><div class="icon">' + icon[0] + '</div><div class="cond">' + esc(icon[1]) +
            " · feels " + Math.round(c.apparent_temperature) + "° · wind " + Math.round(c.wind_speed_10m) + " mph</div>" +
            '<div class="hi-lo">H ' + Math.round(d.temperature_2m_max[0]) + "° · L " + Math.round(d.temperature_2m_min[0]) + "°</div></div></div>" +
            '<div class="forecast-row">' + days + "</div></div>";
        }).join("") +
        '<p class="muted small">Add or change cities in <span class="mono">js/config.js</span>. Weather by Open-Meteo (free, no key needed).</p>';
      }).catch(function () { setFail(el); });
  }

  /* ---------------- GEO FACT ---------------- */

  function todaysGeo() {
    var facts = window.CCM_GEO_FACTS || [];
    return facts[daySeed() % facts.length];
  }

  function loadGeoHome() {
    var el = $("#home-geo");
    if (!el) return;
    var f = todaysGeo();
    if (!f) return;
    el.innerHTML = '<h3 class="fig-name" style="font-size:19px">' + esc(f.title) + "</h3><p style=\"margin:6px 0 0\">" + esc(f.fact) + "</p>";
  }

  function loadGeoPage() {
    var el = $("#geo-detail");
    if (!el) return;
    var f = todaysGeo();
    if (!f) return;
    el.innerHTML =
      '<h3 class="fig-name" style="font-size:30px">' + esc(f.title) + "</h3>" +
      '<div class="prose"><p style="font-size:18px">' + esc(f.fact) + "</p><p>" + esc(f.more) + "</p></div>" +
      '<p><a class="btn" href="' + esc(f.link) + '" target="_blank" rel="noopener">Go deeper →</a></p>';
  }

  /* ---------------- WORLD NEWS (BBC RSS via proxy) ---------------- */

  var NEWS_FEED = "https://feeds.bbci.co.uk/news/world/rss.xml";

  function fetchFeed(url) {
    return fetch("https://api.rss2json.com/v1/api.json?rss_url=" + encodeURIComponent(url))
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (j.items && j.items.length) {
          return j.items.map(function (i) { return { title: i.title, link: i.link, date: i.pubDate }; });
        }
        throw new Error("empty");
      })
      .catch(function () {
        return fetch("https://api.allorigins.win/raw?url=" + encodeURIComponent(url))
          .then(function (r) { return r.text(); })
          .then(function (t) {
            var doc = new DOMParser().parseFromString(t, "text/xml");
            return $all("item", doc).map(function (it) {
              function grab(tag) { var n = it.querySelector(tag); return n ? n.textContent : ""; }
              return { title: grab("title"), link: grab("link"), date: grab("pubDate") };
            });
          });
      });
  }

  function newsListHTML(items, withMeta) {
    return '<ul class="headlines">' + items.map(function (it) {
      return "<li><a href=\"" + esc(it.link) + '" target="_blank" rel="noopener">' + esc(it.title) + "</a>" +
        (withMeta && it.date ? '<span class="meta">BBC WORLD · ' + esc(new Date(it.date).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })) + "</span>" : "") +
        "</li>";
    }).join("") + "</ul>";
  }

  function loadNewsHome() {
    var el = $("#home-news");
    if (!el) return;
    setLoading(el);
    fetchFeed(NEWS_FEED).then(function (items) {
      if (!items.length) { setFail(el); return; }
      el.innerHTML = newsListHTML(items.slice(0, 5), false) +
        '<p class="muted small" style="margin:8px 0 0">Source: BBC World</p>';
    }).catch(function () { setFail(el); });
  }

  function loadNewsPage() {
    var el = $("#news-list");
    if (!el) return;
    setLoading(el);
    fetchFeed(NEWS_FEED).then(function (items) {
      if (!items.length) { setFail(el); return; }
      el.innerHTML = newsListHTML(items.slice(0, 20), true);
    }).catch(function () { setFail(el); });
  }

  /* ---------------- DROP BOX FORM (FormSubmit) ---------------- */

  function initDropbox() {
    var form = $("#dropbox-form");
    if (!form) return;
    var email = (CFG.CONTACT_EMAIL || "").trim();
    var note = $("#dropbox-note");
    if (!email || /YOUR_EMAIL/i.test(email)) {
      if (note) note.innerHTML = '<div class="notice warn">Almost live: put your email in <span class="mono">js/config.js</span> (CONTACT_EMAIL) so submissions reach your inbox. The first submission triggers a one-time confirmation email from FormSubmit — click it once.</div>';
      var btn = form.querySelector("button[type=submit]");
      if (btn) { btn.disabled = true; btn.style.opacity = 0.5; }
      return;
    }
    form.action = "https://formsubmit.co/" + encodeURIComponent(email);
    if (location.search.indexOf("sent=1") > -1 && note) {
      note.innerHTML = '<div class="notice">Got it — your message is on its way. 🤝</div>';
      note.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  /* ---------------- boot ---------------- */

  document.addEventListener("DOMContentLoaded", function () {
    // dateline
    var dl = $("#dateline");
    if (dl) {
      dl.textContent = new Date().toLocaleDateString([], {
        weekday: "long", month: "long", day: "numeric", year: "numeric"
      }).toUpperCase().replace(/,/g, " ·");
    }

    // nav active state
    var page = document.body.getAttribute("data-page");
    $all("nav.mainnav a").forEach(function (a) {
      if (a.getAttribute("data-nav") === page) a.classList.add("active");
    });

    // per-page loaders
    var live = [];
    switch (page) {
      case "home":
        loadTicker();
        loadSportsHome(); loadWeatherHome(); loadNewsHome();
        loadFigureHome(); loadVocabHome(); loadGeoHome(); loadMoviesHome();
        initDropbox();
        live = [loadSportsHome, loadWeatherHome, loadNewsHome];
        break;
      case "stocks":
        loadTicker(); loadStocksPage();
        live = [loadEarnings];
        break;
      case "sports":
        loadTicker(); loadSportsPage();
        live = [loadSportsPage];
        break;
      case "history": loadTicker(); loadFigurePage(); break;
      case "vocab": loadTicker(); loadVocabPage(); break;
      case "games": loadTicker(); break;
      case "movies": loadTicker(); loadMoviesPage(); break;
      case "weather":
        loadTicker(); loadWeatherPage();
        live = [loadWeatherPage];
        break;
      case "geo": loadTicker(); loadGeoPage(); break;
      case "news":
        loadTicker(); loadNewsPage();
        live = [loadNewsPage];
        break;
    }

    stampUpdated();
    if (live.length) {
      setInterval(function () {
        live.forEach(function (fn) { try { fn(); } catch (e) {} });
        stampUpdated();
      }, REFRESH_MS);
    }
  });
})();
