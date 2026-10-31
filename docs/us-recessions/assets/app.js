/* US recessions dashboard. All figures are read or derived from data/recessions.json. */
(function () {
  "use strict";
  var COLORS = { Democratic: "#2563eb", Republican: "#dc2626" };
  var LIGHT = { Democratic: "rgba(37,99,235,.35)", Republican: "rgba(220,38,38,.35)" };
  var PARTIES = ["Democratic", "Republican"];
  var NA = '<span class="na">n/a</span>';

  // Keyword rules used to derive cause categories from the free-text "possible_causes".
  var TAG_RULES = [
    { tag: "Banking / financial panic or stress", re: /panic|bank|\bruns?\b|trust-company|savings-and-loan|financial stress|credit crunch|credit stress|subprime/, words: "panic, bank, runs, trust-company, savings-and-loan, financial stress, credit crunch/stress, subprime" },
    { tag: "Monetary tightening / high rates / credit squeeze", re: /tighten|tight |interest rate|monetary restraint|tighter credit|credit control|monetary contraction|sterilization|credit contraction/, words: "tightening, tight, interest rates, monetary restraint/contraction, tighter credit, credit controls/contraction, sterilization" },
    { tag: "Deflation / gold & currency", re: /deflation|gold|price adjustment/, words: "deflation, gold, price adjustment" },
    { tag: "Speculative boom / asset bust", re: /speculation|overbuild|overinvest|bubble|dot-com|stock-market|crash|housing|subprime/, words: "speculation, overbuilding, overinvestment, bubble, dot-com, stock-market, crash, housing, subprime" },
    { tag: "War, demobilisation & defense cuts", re: /war|wwi|demobiliz|defense|secession/, words: "war, WWI, demobilization, defense, secession" },
    { tag: "Fiscal / government spending cuts", re: /fiscal|spending/, words: "fiscal, spending" },
    { tag: "Oil / energy shock", re: /oil|opec/, words: "oil, OPEC" },
    { tag: "Pandemic", re: /pandemic|influenza|covid/, words: "pandemic, influenza, COVID" },
    { tag: "International / foreign financial shock", re: /international|european|world war i trade/, words: "international, European, World War I trade" },
    { tag: "Real-economy slowdown (investment, industry, demand)", re: /investment|production|industrial|manufactur|auto|demand|inventory|agricultur|confidence|closures|retrench/, words: "investment, production, industrial, manufacturing, auto, demand, inventory, agricultural, confidence, closures, retrenchment" }
  ];
  var OTHER_TAG = "Other one-off shock";
  var charts = [];

  function boot(data) {
    try { render(data); } catch (e) { showError(e); }
  }
  function showError(e) {
    var m = document.createElement("div");
    m.className = "caution"; m.textContent = "Could not render dashboard: " + (e && e.message ? e.message : e);
    document.querySelector("main").prepend(m);
    if (window.console) console.error(e && e.stack ? e.stack : e);
  }
  if (window.RECESSION_DATA) { boot(window.RECESSION_DATA); }
  else {
    fetch("data/recessions.json").then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(boot).catch(showError);
  }

  // ---------- helpers ----------
  function el(id) { return document.getElementById(id); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function ym(s) { var p = s.split("-"); return (+p[0]) * 12 + (+p[1] - 1); }
  function ymStr(i) { var y = Math.floor(i / 12), m = i % 12 + 1; return y + "-" + (m < 10 ? "0" : "") + m; }
  function ymFrac(s) { var i = ym(s); return Math.floor(i / 12) + (i % 12) / 12; }
  function avg(a) { return a.length ? a.reduce(function (x, y) { return x + y; }, 0) / a.length : null; }
  function median(a) { if (!a.length) return null; var b = a.slice().sort(function (x, y) { return x - y; }); var h = Math.floor(b.length / 2); return b.length % 2 ? b[h] : (b[h - 1] + b[h]) / 2; }
  function fmt(v, d) { return v === null || v === undefined || (typeof v === "number" && isNaN(v)) ? NA : (typeof v === "number" ? v.toFixed(d === undefined ? 1 : d) : esc(v)); }
  function pct(n, d) { return d ? (100 * n / d).toFixed(0) + "%" : NA; }
  function pill(p) { return '<span class="pill ' + p.charAt(0) + '">' + (p === "Democratic" ? "D" : p === "Republican" ? "R" : esc(p)) + "</span>"; }
  function short(p) { return p === "Democratic" ? "Dem" : p === "Republican" ? "Rep" : p; }
  function era(r) { var y = +r.start_month.slice(0, 4); return y <= 1913 ? "1857–1913" : y <= 1945 ? "1914–1945" : "1946–2020"; }
  function tenureBucket(m) { var y = Math.floor(m / 12) + 1; return y >= 5 ? "Year 5+" : "Year " + y; }
  function boolTxt(b) { return b === true ? "Yes" : b === false ? "No" : null; }
  function table(head, rows, numCols) {
    numCols = numCols || [];
    var h = "<table><thead><tr>" + head.map(function (c, i) { return '<th class="' + (numCols.indexOf(i) >= 0 ? "num" : "") + '">' + c + "</th>"; }).join("") + "</tr></thead><tbody>";
    h += rows.map(function (r) { return "<tr>" + r.map(function (c, i) { return '<td class="' + (numCols.indexOf(i) >= 0 ? "num" : "") + '">' + c + "</td>"; }).join("") + "</tr>"; }).join("");
    return h + "</tbody></table>";
  }
  function tagsFor(r) {
    var tags = [];
    r.possible_causes.forEach(function (c) {
      var lc = c.toLowerCase(), hit = false;
      TAG_RULES.forEach(function (t) { if (t.re.test(lc)) { hit = true; if (tags.indexOf(t.tag) < 0) tags.push(t.tag); } });
      if (!hit && tags.indexOf(OTHER_TAG) < 0) tags.push(OTHER_TAG);
    });
    return tags;
  }
  function causeMatches() {
    var m = {}; TAG_RULES.forEach(function (t) { m[t.tag] = []; }); m[OTHER_TAG] = [];
    return m;
  }


  function chart(id, cfg) {
    var c = el(id); if (!c || !window.Chart) return null;
    cfg.options = cfg.options || {};
    cfg.options.responsive = true; cfg.options.maintainAspectRatio = false;
    var ch = new Chart(c, cfg); charts.push(ch); return ch;
  }

  // ---------- main ----------
  function render(D) {
    var R = D.recessions.slice();
    R.forEach(function (r, i) {
      r._n = i + 1;
      r._sp = r.start_president.party; r._ep = r.end_president.party; r._pp = r.preceding_president.party;
      r._tags = tagsFor(r); r._era = era(r);
      r._flip = r._sp !== r._ep;
      r._dd = r.stock_market ? r.stock_market.index_peak_to_trough_change_percent : null;
    });
    if (window.Chart) { Chart.defaults.font.family = getComputedStyle(document.body).fontFamily; Chart.defaults.color = "#374151"; }

    // Header
    document.title = D.title;
    el("title").textContent = D.title;
    el("retrieved").textContent = "Data retrieved " + D.retrieved_on;
    el("claim").innerHTML = "“" + esc(D.claim_review.claim) + "”";
    var b = el("verdictBadge");
    b.textContent = D.claim_review.supported ? "SUPPORTED" : "NOT SUPPORTED";
    b.className = "badge " + (D.claim_review.supported ? "true" : "false");
    el("claimReason").textContent = D.claim_review.reason;
    el("scopeText").innerHTML = esc(D.scope.recession_count + " NBER-dated recessions, " + D.scope.period_start + " to " + D.scope.period_end + ". " + D.scope.standard + " " + D.scope.earlier_than_1857 + " " + D.scope.recessions_since_2020);
    el("causationNote").textContent = D.methodology.causes + " " + D.claim_review.reason.split(". ").slice(-1)[0];

    // ---------- exposure (months in office per party) ----------
    var admins = {}, list = [];
    R.forEach(function (r) {
      [r.start_president, r.end_president, r.preceding_president].forEach(function (p) {
        var k = p.name + "|" + p.term_start; if (!admins[k]) { admins[k] = { name: p.name, party: p.party, term_start: p.term_start }; list.push(admins[k]); }
      });
    });
    list.sort(function (a, b) { return a.term_start < b.term_start ? -1 : 1; });
    function partyOn(dateStr) { var p = null; for (var i = 0; i < list.length; i++) { if (list[i].term_start <= dateStr) p = list[i]; else break; } return p; }
    var w0 = ym(D.scope.period_start), w1 = ym(D.scope.period_end);
    var exposure = { Democratic: 0, Republican: 0 }, recMonthsMonthly = { Democratic: 0, Republican: 0 };
    var inRec = {};
    R.forEach(function (r) { for (var i = ym(r.start_month); i <= ym(r.end_month); i++) inRec[i] = true; });
    var gap = false;
    for (var i = w0; i <= w1; i++) {
      var a = partyOn(ymStr(i) + "-01"); if (!a) { gap = true; continue; }
      exposure[a.party] = (exposure[a.party] || 0) + 1;
      if (inRec[i]) recMonthsMonthly[a.party] = (recMonthsMonthly[a.party] || 0) + 1;
    }

    // ---------- per-party stats ----------
    var S = {};
    PARTIES.forEach(function (p) {
      var st = R.filter(function (r) { return r._sp === p; });
      var en = R.filter(function (r) { return r._ep === p; });
      var durs = st.map(function (r) { return r.duration_months; });
      S[p] = {
        starts: st.length, ends: en.length, durs: durs, avg: avg(durs), med: median(durs),
        monthsByStart: durs.reduce(function (x, y) { return x + y; }, 0),
        monthsMonthly: recMonthsMonthly[p], exposure: exposure[p],
        startsPerDecade: exposure[p] ? st.length / (exposure[p] / 120) : null,
        endsPerDecade: exposure[p] ? en.length / (exposure[p] / 120) : null,
        shareInRec: exposure[p] ? recMonthsMonthly[p] / exposure[p] : null,
        sameEnd: st.filter(function (r) { return !r._flip; }).length
      };
    });
    var allD = R.map(function (r) { return r.duration_months; });

    // ---------- stat cards ----------
    var cards = [
      [R.length, "NBER recessions (" + R[0].start_month.slice(0, 4) + "–" + R[R.length - 1].end_month.slice(0, 4) + ")", ""],
      [S.Democratic.starts, "began under a Democratic president", "dem"],
      [S.Republican.starts, "began under a Republican president", "rep"],
      [S.Democratic.ends, "ended under a Democratic president", "dem"],
      [S.Republican.ends, "ended under a Republican president", "rep"],
      [avg(allD).toFixed(1) + " mo", "average duration (file summary: " + D.summary.average_duration_months + ")", ""],
      [S.Democratic.sameEnd, "started AND ended under a Democrat", "dem"],
      [R.filter(function (r) { return r._flip; }).length, "changed party during the recession", ""],
      [R.filter(function (r) { return r.global_recession_overlap === true; }).length, "overlapped a World Bank global recession", ""]
    ];
    el("statCards").innerHTML = cards.map(function (c) { return '<div class="card"><div class="n ' + c[2] + '">' + c[0] + '</div><div class="l">' + c[1] + "</div></div>"; }).join("");

    // ---------- party charts ----------
    function partyDatasets(valsFn, opts) {
      return PARTIES.map(function (p) { return Object.assign({ label: p, data: valsFn(p), backgroundColor: COLORS[p], borderRadius: 4 }, opts || {}); });
    }
    chart("chPartyStartEnd", { type: "bar", data: { labels: ["In office at start", "In office at end"], datasets: partyDatasets(function (p) { return [S[p].starts, S[p].ends]; }) }, options: { scales: { y: { beginAtZero: true, title: { display: true, text: "Recessions" } } } } });
    chart("chDurByParty", { type: "bar", data: { labels: ["Average duration", "Median duration"], datasets: partyDatasets(function (p) { return [+S[p].avg.toFixed(1), S[p].med]; }) }, options: { scales: { y: { beginAtZero: true, title: { display: true, text: "Months" } } } } });
    chart("chMonthsByParty", { type: "bar", data: { labels: ["By party at start (whole recession)", "Month-by-month (party in office)"], datasets: partyDatasets(function (p) { return [S[p].monthsByStart, S[p].monthsMonthly]; }) }, options: { scales: { y: { beginAtZero: true, title: { display: true, text: "Recession-months" } } } } });
    chart("chNormalised", { type: "bar", data: { labels: ["Recession starts per 10 yrs in office", "Recession ends per 10 yrs in office"], datasets: partyDatasets(function (p) { return [+S[p].startsPerDecade.toFixed(2), +S[p].endsPerDecade.toFixed(2)]; }) }, options: { scales: { y: { beginAtZero: true, title: { display: true, text: "Per 10 years of presidency" } } } } });
    el("normNote").innerHTML = "Exposure = months each party held the presidency between " + esc(D.scope.period_start) + " and " + esc(D.scope.period_end) + ", derived from the inauguration dates (term_start) of all " + list.length + " administrations that appear in the file; each administration is assumed to last until the next one's term_start. Democratic: " + (S.Democratic.exposure / 12).toFixed(1) + " yrs; Republican: " + (S.Republican.exposure / 12).toFixed(1) + " yrs." + (gap ? " (Some months had no administration in the file and were skipped.)" : "");

    var buckets = ["Year 1", "Year 2", "Year 3", "Year 4", "Year 5+"];
    chart("chTenure", { type: "bar", data: { labels: buckets, datasets: partyDatasets(function (p) { return buckets.map(function (bk) { return R.filter(function (r) { return r._sp === p && tenureBucket(r.start_president.time_in_office.total_complete_months) === bk; }).length; }); }) }, options: { scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true, ticks: { precision: 0 }, title: { display: true, text: "Recessions starting" } } } } });

    chart("chPreceding", { type: "bar", data: { labels: ["Preceding president Democratic", "Preceding president Republican"], datasets: PARTIES.map(function (p) { return { label: "Start party " + p, data: PARTIES.map(function (pp) { return R.filter(function (r) { return r._pp === pp && r._sp === p; }).length; }), backgroundColor: COLORS[p], borderRadius: 4 }; }) }, options: { scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true, ticks: { precision: 0 }, title: { display: true, text: "Recessions" } } } } });

    chart("chTimeline", { type: "scatter", data: { datasets: PARTIES.map(function (p) { return { label: p + " at start", backgroundColor: LIGHT[p], borderColor: COLORS[p], pointRadius: 6, pointHoverRadius: 8, data: R.filter(function (r) { return r._sp === p; }).map(function (r) { return { x: ymFrac(r.start_month), y: r.duration_months, r: r }; }) }; }) },
      options: { scales: { x: { type: "linear", min: 1850, max: 2025, title: { display: true, text: "Start year" }, ticks: { callback: function (v) { return v; } } }, y: { beginAtZero: true, title: { display: true, text: "Duration (months)" } } },
        plugins: { tooltip: { callbacks: { label: function (c) { var r = c.raw.r; return r.name + " (" + r.start_month + " → " + r.end_month + ", " + r.duration_months + " mo) — start: " + r.start_president.name + ", end: " + r.end_president.name; } } } } } });

    // flip cross-tab
    var hdr = ["Start party \\ End party", "Democratic", "Republican", "Total"];
    el("tblFlip").innerHTML = table(hdr, PARTIES.map(function (sp) {
      var row = [pill(sp) + " " + sp]; var tot = 0;
      PARTIES.forEach(function (ep) { var n = R.filter(function (r) { return r._sp === sp && r._ep === ep; }).length; tot += n; row.push(n); });
      row.push(tot); return row;
    }), [1, 2, 3]);
    el("tblFlipList").innerHTML = table(["Recession", "Start → End president", "Months"], R.filter(function (r) { return r._flip; }).map(function (r) {
      return [esc(r.name) + "<br><small>" + r.start_month + " → " + r.end_month + "</small>", pill(r._sp) + " " + esc(r.start_president.name) + " → " + pill(r._ep) + " " + esc(r.end_president.name), r.duration_months];
    }), [2]);

    el("tblPartySummary").innerHTML = table(["Party", "Started under", "Ended under", "Started & ended under same party", "Avg duration (start party)", "Median", "Recession-months (start party)", "Recession-months (month-by-month)", "Years in office " + D.scope.period_start.slice(0, 4) + "–" + D.scope.period_end.slice(0, 4), "Starts per 10 yrs", "% of months in office in recession", "Global-overlap share (non-null)", "Avg stock drawdown (n)"],
      PARTIES.map(function (p) {
        var st = R.filter(function (r) { return r._sp === p; });
        var g = st.filter(function (r) { return r.global_recession_overlap !== null; });
        var dd = st.filter(function (r) { return r._dd !== null; }).map(function (r) { return r._dd; });
        return [pill(p) + " " + p, S[p].starts, S[p].ends, S[p].sameEnd, S[p].avg.toFixed(1), S[p].med, S[p].monthsByStart, S[p].monthsMonthly, (S[p].exposure / 12).toFixed(1), S[p].startsPerDecade.toFixed(2), (100 * S[p].shareInRec).toFixed(1) + "%",
          pct(g.filter(function (r) { return r.global_recession_overlap; }).length, g.length) + " (" + g.filter(function (r) { return r.global_recession_overlap; }).length + "/" + g.length + ")",
          dd.length ? avg(dd).toFixed(1) + "% (" + dd.length + ")" : NA];
      }), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12]);

    // ---------- causes ----------
    var allTags = TAG_RULES.map(function (t) { return t.tag; });
    if (R.some(function (r) { return r._tags.indexOf(OTHER_TAG) >= 0; })) allTags.push(OTHER_TAG);
    var tagCount = {}; allTags.forEach(function (t) { tagCount[t] = R.filter(function (r) { return r._tags.indexOf(t) >= 0; }).length; });
    var sortedTags = allTags.slice().sort(function (a, b) { return tagCount[b] - tagCount[a]; });
    chart("chTags", { type: "bar", data: { labels: sortedTags, datasets: partyDatasets(function (p) { return sortedTags.map(function (t) { return R.filter(function (r) { return r._sp === p && r._tags.indexOf(t) >= 0; }).length; }); }) },
      options: { indexAxis: "y", scales: { x: { stacked: true, beginAtZero: true, ticks: { precision: 0 }, title: { display: true, text: "Recessions tagged" } }, y: { stacked: true, ticks: { autoSkip: false } } } } });

    var tagRows = sortedTags.map(function (t) {
      var tr = R.filter(function (r) { return r._tags.indexOf(t) >= 0; });
      var d = tr.filter(function (r) { return r._sp === "Democratic"; }).length, rp = tr.filter(function (r) { return r._sp === "Republican"; }).length;
      var g = tr.filter(function (r) { return r.global_recession_overlap !== null; }), gy = g.filter(function (r) { return r.global_recession_overlap; }).length;
      return ['<span class="tag">' + esc(t) + "</span>", tr.length, d, pct(d, S.Democratic.starts), rp, pct(rp, S.Republican.starts), g.length ? pct(gy, g.length) + " (" + gy + "/" + g.length + ")" : NA, avg(tr.map(function (r) { return r.duration_months; })).toFixed(1)];
    });
    var gAll = R.filter(function (r) { return r.global_recession_overlap === true; });
    var gd = gAll.filter(function (r) { return r._sp === "Democratic"; }).length, gr = gAll.filter(function (r) { return r._sp === "Republican"; }).length;
    tagRows.push(["<strong>World Bank global recession overlap = Yes</strong> (data field)", gAll.length, gd, pct(gd, S.Democratic.starts), gr, pct(gr, S.Republican.starts), "—", avg(gAll.map(function (r) { return r.duration_months; })).toFixed(1)]);
    el("tblTagParty").innerHTML = table(["Cause category", "Recessions", "Dem start", "% of Dem", "Rep start", "% of Rep", "Global overlap", "Avg duration (mo)"], tagRows, [1, 2, 3, 4, 5, 7]);

    var gStates = [["Yes", true], ["No", false], ["n/a (null)", null]];
    chart("chGlobal", { type: "doughnut", data: { labels: gStates.map(function (g) { return g[0]; }), datasets: [{ data: gStates.map(function (g) { return R.filter(function (r) { return r.global_recession_overlap === g[1]; }).length; }), backgroundColor: ["#0f766e", "#94a3b8", "#e5e7eb"] }] }, options: { plugins: { legend: { position: "bottom" } } } });
    chart("chGlobalParty", { type: "bar", data: { labels: gStates.map(function (g) { return "Global overlap: " + g[0]; }), datasets: partyDatasets(function (p) { return gStates.map(function (g) { return R.filter(function (r) { return r._sp === p && r.global_recession_overlap === g[1]; }).length; }); }) }, options: { scales: { y: { beginAtZero: true, ticks: { precision: 0 }, title: { display: true, text: "Recessions (by start party)" } } } } });
    el("tblGlobal").innerHTML = table(["Global overlap", "Recessions", "Avg duration (mo)", "Median duration", "Avg stock drawdown", "Drawdown n"], gStates.map(function (g) {
      var s = R.filter(function (r) { return r.global_recession_overlap === g[1]; });
      var d = s.map(function (r) { return r.duration_months; }), dd = s.filter(function (r) { return r._dd !== null; }).map(function (r) { return r._dd; });
      return [g[0], s.length, fmt(avg(d)), fmt(median(d)), dd.length ? avg(dd).toFixed(1) + "%" : NA, dd.length];
    }), [1, 2, 3, 4, 5]);

    var ev = ["high", "medium", "low"];
    chart("chEvidence", { type: "bar", data: { labels: ev, datasets: partyDatasets(function (p) { return ev.map(function (e) { return R.filter(function (r) { return r._sp === p && r.cause_evidence_strength === e; }).length; }); }) }, options: { scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } } });

    var ddR = R.filter(function (r) { return r._dd !== null; });
    chart("chDrawdown", { type: "scatter", data: { datasets: PARTIES.map(function (p) { return { label: p + " at start", backgroundColor: LIGHT[p], borderColor: COLORS[p], pointRadius: 7, pointHoverRadius: 9, data: ddR.filter(function (r) { return r._sp === p; }).map(function (r) { return { x: r.duration_months, y: r._dd, r: r }; }) }; }) },
      options: { scales: { x: { beginAtZero: true, title: { display: true, text: "Recession duration (months)" } }, y: { title: { display: true, text: "Index peak-to-trough change (%)" }, max: 0 } },
        plugins: { tooltip: { callbacks: { label: function (c) { var r = c.raw.r, s = r.stock_market; return r.name + ": " + s.index_peak_to_trough_change_percent + "% " + s.index_name + " (" + s.index_peak_date + " → " + s.index_trough_date + "), " + r.duration_months + " mo; global overlap: " + (boolTxt(r.global_recession_overlap) || "n/a"); } } } } } });
    el("drawdownNote").textContent = "Only " + ddR.length + " of " + R.length + " recessions have an index drawdown in the file (" + ddR.map(function (r) { return r.end_month.slice(0, 4); }).join(", ") + " trough years); the rest are null and are not plotted. Index is S&P 500 except the 1929 entry (Dow Jones Industrial Average). " + D.methodology.stock_market;

    var oc = R.filter(function (r) { return r.other_countries_in_recession_count !== null && r.other_countries_in_recession_count !== undefined; });
    el("otherCountries").innerHTML = oc.length
      ? table(["Recession", "Other countries in recession", "Method"], oc.map(function (r) { return [esc(r.name), r.other_countries_in_recession_count, fmt(r.other_countries_count_method)]; }), [1])
      : '<p><strong>n/a for all ' + R.length + ' recessions.</strong> The file stores <code>other_countries_in_recession_count</code> as null for every record, so no chart is drawn. From the file\'s methodology: “' + esc(D.methodology.other_countries_in_recession_count) + '” Use the World Bank global-recession overlap charts above as the available global indicator.</p>';

    var matches = causeMatches();
    R.forEach(function (r) { r.possible_causes.forEach(function (c) { var lc = c.toLowerCase(), hit = false; TAG_RULES.forEach(function (t) { if (t.re.test(lc)) { hit = true; if (matches[t.tag].indexOf(c) < 0) matches[t.tag].push(c); } }); if (!hit && matches[OTHER_TAG].indexOf(c) < 0) matches[OTHER_TAG].push(c); }); });
    el("tblTagRules").innerHTML = table(["Category", "Keywords matched (case-insensitive)", "Cause phrases from the file that matched"], TAG_RULES.map(function (t) { return [esc(t.tag), esc(t.words), matches[t.tag].map(esc).join("; ") || NA]; }).concat(matches[OTHER_TAG].length ? [[OTHER_TAG, "(no keyword matched)", matches[OTHER_TAG].map(esc).join("; ")]] : []));

    // ---------- full table ----------
    var eras = ["1857–1913", "1914–1945", "1946–2020"];
    el("fEra").innerHTML += eras.map(function (e) { return "<option>" + e + "</option>"; }).join("");
    el("fTag").innerHTML += allTags.map(function (t) { return "<option>" + esc(t) + "</option>"; }).join("");
    var cols = [
      { k: "#", v: function (r) { return r._n; }, h: function (r) { return r._n; }, num: true },
      { k: "Recession", v: function (r) { return r.name; }, h: function (r) { return "<strong>" + esc(r.name) + "</strong><br><small>" + r._era + "</small>"; } },
      { k: "Start", v: function (r) { return r.start_month; }, h: function (r) { return r.start_month + '<br><small title="NBER peak month">peak ' + r.nber_peak_month + "</small>"; } },
      { k: "End", v: function (r) { return r.end_month; }, h: function (r) { return r.end_month; } },
      { k: "Months", v: function (r) { return r.duration_months; }, h: function (r) { return r.duration_months; }, num: true },
      { k: "President at start", v: function (r) { return r._sp + r.start_president.name; }, h: function (r) { return pill(r._sp) + " " + esc(r.start_president.name) + (r.start_president.party_note ? '<br><small>' + esc(r.start_president.party_note) + "</small>" : ""); } },
      { k: "Tenure at start", v: function (r) { return r.start_president.time_in_office.total_complete_months; }, h: function (r) { var t = r.start_president.time_in_office; return t.years + "y " + t.months + "m " + t.days + "d<br><small>" + tenureBucket(t.total_complete_months) + "</small>"; }, num: true },
      { k: "President at end", v: function (r) { return r._ep + r.end_president.name; }, h: function (r) { return pill(r._ep) + " " + esc(r.end_president.name) + (r.end_president_note ? '<br><small>' + esc(r.end_president_note) + "</small>" : ""); } },
      { k: "Preceding president", v: function (r) { return r._pp + r.preceding_president.name; }, h: function (r) { return pill(r._pp) + " " + esc(r.preceding_president.name); } },
      { k: "Possible causes", v: function (r) { return r.possible_causes.join("; "); }, h: function (r) { return esc(r.possible_causes.join("; ")) + "<br>" + r._tags.map(function (t) { return '<span class="tag">' + esc(t) + "</span>"; }).join(""); } },
      { k: "Evidence", v: function (r) { return { high: 3, medium: 2, low: 1 }[r.cause_evidence_strength] || 0; }, h: function (r) { return fmt(r.cause_evidence_strength); } },
      { k: "Global overlap", v: function (r) { return r.global_recession_overlap === true ? 2 : r.global_recession_overlap === false ? 1 : 0; }, h: function (r) { return boolTxt(r.global_recession_overlap) || NA; } },
      { k: "Other countries", v: function (r) { return r.other_countries_in_recession_count === null ? -1 : r.other_countries_in_recession_count; }, h: function (r) { return fmt(r.other_countries_in_recession_count, 0); }, num: true },
      { k: "Stock drawdown", v: function (r) { return r._dd === null ? 1 : r._dd; }, h: function (r) { var s = r.stock_market; if (r._dd === null) return NA; var x = r._dd + "%<br><small>" + esc(s.index_name) + " " + esc(s.index_peak_date) + " → " + esc(s.index_trough_date) + "</small>"; if (s.estimated_market_value_loss_usd !== null) x += "<br><small>~$" + (s.estimated_market_value_loss_usd / 1e12) + " trillion as of " + esc(s.estimated_market_value_loss_asof) + " (" + esc(s.estimated_market_value_loss_scope) + ")</small>"; return x; }, num: true },
      { k: "Sources", v: function (r) { return r.source_ids.join(" "); }, h: function (r) { return r.source_ids.map(function (id) { var s = D.sources[id]; return s ? '<a href="' + esc(s.url) + '" target="_blank" rel="noopener" title="' + esc(s.title) + '">' + esc(id) + "</a>" : esc(id); }).join(" "); }, cls: "src" }
    ];
    var sortCol = 0, sortDir = 1;
    var t = el("fullTable");
    t.innerHTML = "<thead><tr>" + cols.map(function (c, i) { return '<th data-i="' + i + '" class="' + (c.num ? "num" : "") + '">' + c.k + "</th>"; }).join("") + "</tr></thead><tbody></tbody>";
    var ths = t.querySelectorAll("th");
    Array.prototype.forEach.call(ths, function (th) { th.addEventListener("click", function () { var i = +th.getAttribute("data-i"); if (i === sortCol) sortDir = -sortDir; else { sortCol = i; sortDir = 1; } draw(); }); });
    ["fSearch", "fStart", "fEnd", "fEra", "fGlobal", "fTag", "fFlip"].forEach(function (id) { el(id).addEventListener(id === "fSearch" ? "input" : "change", draw); });
    function draw() {
      var q = el("fSearch").value.trim().toLowerCase(), fs = el("fStart").value, fe = el("fEnd").value, fera = el("fEra").value, fg = el("fGlobal").value, ft = el("fTag").value, ff = el("fFlip").checked;
      var rows = R.filter(function (r) {
        if (fs && r._sp !== fs) return false;
        if (fe && r._ep !== fe) return false;
        if (fera && r._era !== fera) return false;
        if (fg && String(r.global_recession_overlap) !== fg) return false;
        if (ft && r._tags.indexOf(ft) < 0) return false;
        if (ff && !r._flip) return false;
        if (q) { var hay = [r.name, r.start_month, r.end_month, r.start_president.name, r.end_president.name, r.preceding_president.name, r._sp, r._ep, r.possible_causes.join(" "), r._tags.join(" "), r.source_ids.join(" ")].join(" ").toLowerCase(); if (hay.indexOf(q) < 0) return false; }
        return true;
      });
      var c = cols[sortCol];
      rows.sort(function (a, b) { var x = c.v(a), y = c.v(b); return (x < y ? -1 : x > y ? 1 : 0) * sortDir; });
      Array.prototype.forEach.call(ths, function (th, i) { th.classList.remove("sorted-asc", "sorted-desc"); if (i === sortCol) th.classList.add(sortDir > 0 ? "sorted-asc" : "sorted-desc"); });
      t.querySelector("tbody").innerHTML = rows.map(function (r) { return "<tr>" + cols.map(function (c) { return '<td class="' + (c.num ? "num " : "") + (c.cls || "") + '">' + c.h(r) + "</td>"; }).join("") + "</tr>"; }).join("");
      var md = rows.map(function (r) { return r.duration_months; });
      el("rowCount").innerHTML = "Showing " + rows.length + " of " + R.length + " recessions" + (rows.length ? " · avg duration " + avg(md).toFixed(1) + " months · Dem start " + rows.filter(function (r) { return r._sp === "Democratic"; }).length + ", Rep start " + rows.filter(function (r) { return r._sp === "Republican"; }).length : "") + ". Click a column header to sort.";
    }
    draw();

    // ---------- methodology & sources ----------
    el("methodList").innerHTML = Object.keys(D.methodology).map(function (k) { return "<dt>" + esc(k.replace(/_/g, " ")) + "</dt><dd>" + esc(D.methodology[k]) + "</dd>"; }).join("");
    var calc = [
      "Party at start / end, durations, tenure, preceding president, causes, evidence strength, global overlap and stock drawdowns are read directly from the file; nothing is filled in. Null values display as “n/a” and are excluded from averages and charts (never treated as zero).",
      "Averages computed here (" + avg(allD).toFixed(1) + " months over " + R.length + " recessions) match the file's summary.average_duration_months (" + D.summary.average_duration_months + "). Party counts match summary.recessions_by_start/end_presidential_party.",
      "Years in office by party: built from the term_start dates of every administration named in the file (" + list.length + " administrations, " + list[0].name + " to " + list[list.length - 1].name + "). Each is assumed to run until the next administration's term_start, and the window is clipped to " + D.scope.period_start + "–" + D.scope.period_end + ". The party in office in a month is the one in office on the 1st of that month, matching the file's start-month rule.",
      "Cause categories are derived by case-insensitive keyword matching on the possible_causes text (rules in the table above). A recession can have several categories; a phrase matching no rule is tagged “" + OTHER_TAG + "”. This is a reading aid, not an authoritative classification.",
      "Eras used for filtering: 1857–1913, 1914–1945, 1946–2020 (by start year).",
      "With only 34 events (11 Democratic-start, 23 Republican-start), differences between parties are small-sample and are not tested for statistical significance here."
    ];
    el("calcNotes").innerHTML = calc.map(function (c) { return "<li>" + esc(c) + "</li>"; }).join("");
    el("sourceList").innerHTML = Object.keys(D.sources).map(function (id) { var s = D.sources[id]; var used = R.filter(function (r) { return r.source_ids.indexOf(id) >= 0; }).length; return '<li><a href="' + esc(s.url) + '" target="_blank" rel="noopener">' + esc(s.title) + "</a> <small>[" + esc(id) + "; cited by " + used + " recession" + (used === 1 ? "" : "s") + "]</small></li>"; }).join("");
  }
})();
