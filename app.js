/* =========================================================
   CISI Revision Hub — application logic (no framework, no build step)
   ========================================================= */
(function(){
"use strict";

var DATA = window.CISI_DATA || {};
var EXAM_KEYS = ["regulation","securities","derivatives"];
var EXAM_COLORS = { regulation:"#9a6b1f", securities:"#0f7a6e", derivatives:"#5b6bd6" };

/* ---------- storage helpers (safe: falls back to in-memory if localStorage is blocked, eg some file:// contexts) ---------- */
var memoryStorage = {};
var storageAvailable = (function(){
  try{ var t="__cisi_test__"; localStorage.setItem(t,"1"); localStorage.removeItem(t); return true; }
  catch(e){ return false; }
})();
function lsGet(key){
  if(storageAvailable){ try{ return localStorage.getItem(key); }catch(e){} }
  return Object.prototype.hasOwnProperty.call(memoryStorage,key) ? memoryStorage[key] : null;
}
function lsSet(key, val){
  if(storageAvailable){ try{ localStorage.setItem(key, val); return; }catch(e){} }
  memoryStorage[key] = val;
}

var STORE_KEY = "cisi_revision_progress_v1";
function loadStore(){
  try{ return JSON.parse(lsGet(STORE_KEY)) || {}; }catch(e){ return {}; }
}
function saveStore(s){
  try{ lsSet(STORE_KEY, JSON.stringify(s)); }catch(e){}
}
var store = loadStore();
function ensureExam(examKey){
  if(!store[examKey]) store[examKey] = { chapters:{}, cards:{}, weak:{} };
  if(!store[examKey].weak) store[examKey].weak = {};
  return store[examKey];
}
function markWeak(examKey, qid, isWeak){
  if(!qid) return;
  var ex = ensureExam(examKey);
  if(isWeak) ex.weak[qid] = true; else delete ex.weak[qid];
  saveStore(store);
}
function weakCount(examKey){
  var ex = ensureExam(examKey);
  return Object.keys(ex.weak).length;
}
function weakQuestions(examKey){
  var ex = ensureExam(examKey);
  var exam = DATA[examKey];
  var out = [];
  Object.keys(ex.weak).forEach(function(qid){
    var parts = qid.split("::");
    var chId = parts[0], i = +parts[1];
    var ch = exam.chapters.find(function(c){ return c.id===chId; });
    if(ch && ch.mcqs && ch.mcqs[i]){
      out.push(Object.assign({}, ch.mcqs[i], { _qid: qid, _chapter: ch.title, _chId: ch.id }));
    }
  });
  return out;
}
function ensureChapter(examKey, chId){
  var ex = ensureExam(examKey);
  if(!ex.chapters[chId]) ex.chapters[chId] = { visitedSummary:false, visitedDetail:false, bestScore:null, attempts:0 };
  return ex.chapters[chId];
}
function markVisited(examKey, chId, tab){
  var c = ensureChapter(examKey, chId);
  if(tab==="summary") c.visitedSummary = true;
  if(tab==="detail") c.visitedDetail = true;
  saveStore(store);
}
function recordQuizResult(examKey, chId, pct){
  var c = ensureChapter(examKey, chId);
  c.attempts = (c.attempts||0) + 1;
  if(c.bestScore===null || pct > c.bestScore) c.bestScore = pct;
  saveStore(store);
}
function ensureMockAttempts(examKey, mockId){
  var ex = ensureExam(examKey);
  if(!ex.mockAttempts) ex.mockAttempts = {};
  if(!ex.mockAttempts[mockId]) ex.mockAttempts[mockId] = [];
  return ex.mockAttempts[mockId];
}
function recordMockAttempt(examKey, mockId, attempt){
  var list = ensureMockAttempts(examKey, mockId);
  list.unshift(attempt); // most recent first
  if(list.length > 20) list.length = 20; // cap history so storage doesn't grow unbounded
  saveStore(store);
  return attempt;
}
function getMockAttempt(examKey, mockId, attemptId){
  var list = ensureMockAttempts(examKey, mockId);
  return list.find(function(a){ return a.id===attemptId; }) || null;
}
function getNote(examKey, chId){
  var ex = ensureExam(examKey);
  return (ex.notes && ex.notes[chId]) || "";
}
function setNote(examKey, chId, text){
  var ex = ensureExam(examKey);
  ex.notes = ex.notes || {};
  ex.notes[chId] = text;
  saveStore(store);
}
function getHighlightHtml(examKey, chId, tab){
  var ex = ensureExam(examKey);
  return (ex.highlights && ex.highlights[chId+"::"+tab]) || null;
}
function setHighlightHtml(examKey, chId, tab, html){
  var ex = ensureExam(examKey);
  ex.highlights = ex.highlights || {};
  ex.highlights[chId+"::"+tab] = html;
  saveStore(store);
}
function clearHighlights(examKey, chId, tab){
  var ex = ensureExam(examKey);
  if(ex.highlights) delete ex.highlights[chId+"::"+tab];
  saveStore(store);
}
function cardState(examKey, cardId){
  var ex = ensureExam(examKey);
  return ex.cards[cardId] || null;
}
function setCardLevel(examKey, cardId, level){
  var ex = ensureExam(examKey);
  ex.cards[cardId] = { level: level, ts: Date.now() };
  saveStore(store);
}
function cardLevel(examKey, cardId){
  var s = cardState(examKey, cardId);
  return s ? s.level : 0; // 0 = unseen, 1 = bad, 2 = medium, 3 = good
}

/* ---------- theme ---------- */
function initTheme(){
  var saved = lsGet("cisi_theme");
  var theme = saved || (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark":"light");
  document.documentElement.setAttribute("data-theme", theme);
}
function toggleTheme(){
  var cur = document.documentElement.getAttribute("data-theme");
  var next = cur === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  lsSet("cisi_theme", next);
  renderThemeIcon();
}
function renderThemeIcon(){
  var el = document.getElementById("themeIcon");
  if(!el) return;
  var dark = document.documentElement.getAttribute("data-theme")==="dark";
  el.innerHTML = dark ? ICON.sun : ICON.moon;
}
initTheme();

/* ---------- icons ---------- */
var ICON = {
  sun:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
  moon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z"/></svg>',
  search:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>',
  chevron:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M9 6l6 6-6 6"/></svg>',
  back:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg>',
  menu:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
  close:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  glossary:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"/><path d="M9 7h7M9 11h5"/></svg>',
  highlighter:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 11-6 6v3h3l6-6"/><path d="m14.5 5.5 4 4"/><path d="M13 3.5 20.5 11 17 14.5 9.5 7 13 3.5Z"/></svg>',
  pencil:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
  book:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"/></svg>',
  cards:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="14" height="14" rx="2"/><path d="M7 6V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/></svg>',
  quiz:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 2-3 4"/><path d="M12 17h.01"/></svg>',
  target:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/></svg>',
  shuffle:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 3h5v5"/><path d="M4 20L21 3"/><path d="M21 16v5h-5"/><path d="M15 15l6 6"/><path d="M4 4l5 5"/></svg>',
  refresh:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.6-6.4"/><path d="M21 3v6h-6"/></svg>',
  home:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/></svg>',
  pdf:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/><path d="M9 15h1.5a1.5 1.5 0 0 0 0-3H9v5"/><path d="M13.5 12v5h1a2 2 0 0 0 0-4"/></svg>',
  check:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
  map:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="5" r="2.4"/><circle cx="5" cy="14" r="2.4"/><circle cx="19" cy="14" r="2.4"/><circle cx="8" cy="20.5" r="1.8"/><circle cx="16" cy="20.5" r="1.8"/><path d="M10.3 6.9 6.7 12.1M13.7 6.9l3.6 5.2M6.3 16.1 7.3 18.7M17.7 16.1l-1 2.6M7.8 15h8.4"/></svg>'
};

/* ---------- payoff diagrams (SVG, drawn live so they follow the theme) ---------- */
var PAYOFF_DEFS = {
  "long-call": {
    title: "Long Call — buy the right to buy",
    sub: "Loss limited to premium paid &middot; profit unlimited above strike",
    // points as fractions of chart area: [x(0-1), y(0-1, 0=top/max profit, 1=bottom/max loss)]
    pts: [[0,0.78],[0.5,0.78],[1,0.12]],
    strikeX: 0.5, breakevenX: 0.6
  },
  "short-call": {
    title: "Short Call — sell the right to buy",
    sub: "Profit limited to premium received &middot; loss unlimited above strike",
    pts: [[0,0.28],[0.5,0.28],[1,0.9]],
    strikeX: 0.5, breakevenX: 0.6
  },
  "long-put": {
    title: "Long Put — buy the right to sell",
    sub: "Loss limited to premium paid &middot; profit rises as price falls",
    pts: [[0,0.12],[0.5,0.78],[1,0.78]],
    strikeX: 0.5, breakevenX: 0.4
  },
  "short-put": {
    title: "Short Put — sell the right to sell",
    sub: "Profit limited to premium received &middot; loss rises as price falls",
    pts: [[0,0.9],[0.5,0.28],[1,0.28]],
    strikeX: 0.5, breakevenX: 0.4
  },
  "long-future": {
    title: "Long Future — obligation to buy",
    sub: "Symmetrical, unlimited profit and loss either side of the trade price",
    pts: [[0,0.9],[0.5,0.5],[1,0.12]],
    strikeX: 0.5, breakevenX: 0.5
  },
  "short-future": {
    title: "Short Future — obligation to sell",
    sub: "Symmetrical, unlimited profit and loss either side of the trade price",
    pts: [[0,0.12],[0.5,0.5],[1,0.9]],
    strikeX: 0.5, breakevenX: 0.5
  }
};
function buildPayoffSVG(type){
  var def = PAYOFF_DEFS[type];
  if(!def) return "";
  var W=400,H=190, padL=16, padR=16, padT=14, padB=14;
  var innerW = W-padL-padR, innerH = H-padT-padB;
  var zeroY = padT + innerH*0.5;
  function toXY(p){ return [padL + p[0]*innerW, padT + p[1]*innerH]; }
  var pathPts = def.pts.map(toXY);
  var pathD = "M"+pathPts.map(function(p){return p[0].toFixed(1)+","+p[1].toFixed(1);}).join(" L");
  var strikeX = padL + def.strikeX*innerW;
  var isShort = type.indexOf("short")===0;
  var lineColor = isShort ? "var(--red)" : "var(--teal)";
  return '<div class="payoff-card">' +
    '<div class="payoff-title">'+def.title+'</div>' +
    '<div class="payoff-sub">'+def.sub+'</div>' +
    '<svg viewBox="0 0 '+W+' '+H+'" class="payoff-svg" xmlns="http://www.w3.org/2000/svg">' +
      '<line x1="'+padL+'" y1="'+zeroY+'" x2="'+(W-padR)+'" y2="'+zeroY+'" style="stroke:var(--border-strong);stroke-width:1"/>' +
      '<line x1="'+strikeX+'" y1="'+padT+'" x2="'+strikeX+'" y2="'+(H-padB)+'" style="stroke:var(--border);stroke-width:1;stroke-dasharray:3,3"/>' +
      '<path d="'+pathD+'" style="fill:none;stroke:'+lineColor+';stroke-width:2.5" stroke-linejoin="round"/>' +
      '<text x="'+strikeX+'" y="'+(H-2)+'" text-anchor="middle" style="fill:var(--text-faint);font-size:10px;">Strike</text>' +
      '<text x="'+(W-padR)+'" y="'+(zeroY-6)+'" text-anchor="end" style="fill:var(--text-faint);font-size:10px;">Underlying price &rarr;</text>' +
      '<text x="'+padL+'" y="'+(padT+9)+'" text-anchor="start" style="fill:var(--text-faint);font-size:10px;">Profit</text>' +
      '<text x="'+padL+'" y="'+(H-padB-2)+'" text-anchor="start" style="fill:var(--text-faint);font-size:10px;">Loss</text>' +
    '</svg>' +
  '</div>';
}
function attachDiagrams(root){
  var els = root.querySelectorAll(".payoff-diagram[data-type]");
  Array.prototype.forEach.call(els, function(el){
    el.innerHTML = buildPayoffSVG(el.getAttribute("data-type"));
  });
}

/* ---------- utilities ---------- */
function esc(s){ return (s==null?"":String(s)); }
function toggleSidebar(){
  var s = document.querySelector(".sidebar");
  if(!s) return;
  var open = s.classList.toggle("open");
  sidebarBackdrop(open);
}
function closeSidebar(){
  var s = document.querySelector(".sidebar");
  if(s) s.classList.remove("open");
  sidebarBackdrop(false);
}
function sidebarBackdrop(show){
  var bd = document.getElementById("sidebarBackdrop");
  if(!bd){
    bd = document.createElement("div");
    bd.id = "sidebarBackdrop";
    bd.className = "sidebar-backdrop";
    bd.onclick = closeSidebar;
    document.body.appendChild(bd);
  }
  bd.classList.toggle("show", !!show);
}
function backRow(label, targetPath){
  return '<button class="back-btn" data-back="1">'+ICON.back+' '+esc(label)+'</button>';
}
function wireBack(container, targetPath){
  var b = container.querySelector('[data-back="1"]');
  if(b) b.onclick = function(){ navigate(targetPath); };
}
function stripHtml(html){ var d=document.createElement("div"); d.innerHTML=html||""; return d.textContent||""; }
function pct(n,d){ return d>0 ? Math.round(n/d*100) : 0; }
function shuffle(arr){
  var a = arr.slice();
  for(var i=a.length-1;i>0;i--){ var j=Math.floor(Math.random()*(i+1)); var t=a[i]; a[i]=a[j]; a[j]=t; }
  return a;
}
function shuffleOptions(q){
  var idxs = shuffle(q.options.map(function(_,i){ return i; }));
  return Object.assign({}, q, {
    options: idxs.map(function(i){ return q.options[i]; }),
    correctIndex: idxs.indexOf(q.correctIndex)
  });
}
function examTitle(k){ return DATA[k] ? DATA[k].title : k; }

function chapterProgressPct(examKey, ch){
  var st = ensureChapter(examKey, ch.id);
  var parts = 0, total = 3;
  if(st.visitedSummary) parts++;
  if(st.visitedDetail) parts++;
  if(st.bestScore!==null && st.bestScore>=70) parts++;
  return Math.round(parts/total*100);
}
function examReadiness(examKey){
  var exam = DATA[examKey];
  if(!exam || !exam.chapters.length) return 0;
  var sum=0;
  exam.chapters.forEach(function(ch){ sum += chapterProgressPct(examKey, ch); });
  return Math.round(sum/exam.chapters.length);
}

/* ---------- routing ---------- */
function parseHash(){
  var h = location.hash.replace(/^#\/?/, "");
  var parts = h.split("/").filter(Boolean).map(decodeURIComponent);
  return parts; // [] | [exam] | [exam, chId] | [exam, chId, tab] | [exam, '_quiz'] | [exam,'_cards']
}
function navigate(path){ location.hash = "#/" + path.map(encodeURIComponent).join("/"); }
window.addEventListener("hashchange", render);

/* ---------- root render ---------- */
var app = document.getElementById("app");

function render(){
  stopActiveTimer(); stopActiveQuizKeys();
  closeSidebar();
  var parts = parseHash();
  closeSearch();
  if(parts.length===0){ renderHome(); renderTopbar(null); return; }
  var examKey = parts[0];
  if(!DATA[examKey]){ renderHome(); renderTopbar(null); return; }
  renderTopbar(examKey);

  if(parts.length===1){ renderExamOverview(examKey); return; }

  var second = parts[1];
  if(second === "_quiz"){ renderFullQuiz(examKey); return; }
  if(second === "_cisiquiz"){ renderCisiFullQuiz(examKey); return; }
  if(second === "_mixed"){ renderMixedPractice(examKey); return; }
  if(second === "_challenge"){ renderChallengeExam(examKey); return; }
  if(second === "_mocks"){
    var mockId = parts[2];
    var attemptId = parts[3];
    if(mockId && attemptId){ renderMockAttemptReview(examKey, mockId, attemptId); }
    else if(mockId){ renderMockExamRunner(examKey, mockId); }
    else { renderMockExamsList(examKey); }
    return;
  }
  if(second === "_cards"){ renderAllFlashcards(examKey); return; }
  if(second === "_weak"){ renderWeakSpots(examKey); return; }
  if(second === "_export"){ renderExportPage(examKey); return; }
  if(second === "_glossary"){ renderGlossary(examKey); return; }
  if(second === "_glossaryflashcards"){ renderGlossaryFlashcards(examKey); return; }
  if(second === "_regulators"){ renderRegulators(examKey); return; }
  if(second === "_clientrules"){ renderClientRules(examKey); return; }

  var chId = second;
  var chapter = DATA[examKey].chapters.find(function(c){ return c.id===chId; });
  if(!chapter){ renderExamOverview(examKey); return; }
  var tab = parts[2] || "summary";
  renderChapter(examKey, chapter, tab);
}

/* ---------- topbar ---------- */
function renderTopbar(activeExam){
  var bar = document.getElementById("topbar");
  var switcherHtml = EXAM_KEYS.filter(function(k){return DATA[k];}).map(function(k){
    return '<button data-exam="'+k+'" class="'+(k===activeExam?"active":"")+'">'+examTitle(k)+'</button>';
  }).join("");

  bar.innerHTML =
    (activeExam ? '<button class="icon-btn menu-btn" id="menuBtn" title="Menu">'+ICON.menu+'</button>' : '') +
    '<div class="brand" id="brandHome"><div class="mark">C</div><div><div>CISI Revision Hub</div><div class="sub">Level 3 &middot; Exam prep</div></div></div>' +
    '<div class="exam-switcher" id="examSwitcher">'+switcherHtml+'</div>' +
    '<div class="topbar-spacer"></div>' +
    '<div class="search-box" id="searchBox">'+ICON.search+
      '<input type="text" id="searchInput" placeholder="'+(activeExam? "Search "+examTitle(activeExam)+"…" : "Search…")+'" autocomplete="off"/>'+
      '<div class="search-results" id="searchResults"></div>'+
    '</div>' +
    '<button class="icon-btn" id="themeBtn" title="Toggle theme"><span id="themeIcon"></span></button>';

  var menuBtn = document.getElementById("menuBtn");
  if(menuBtn) menuBtn.onclick = function(e){ e.stopPropagation(); toggleSidebar(); };

  document.getElementById("brandHome").onclick = function(){ navigate([]); };
  Array.prototype.forEach.call(bar.querySelectorAll("#examSwitcher button"), function(b){
    b.onclick = function(){ navigate([b.getAttribute("data-exam")]); };
  });
  document.getElementById("themeBtn").onclick = toggleTheme;
  renderThemeIcon();

  var input = document.getElementById("searchInput");
  input.oninput = function(){ doSearch(activeExam, input.value); };
  input.onfocus = function(){ if(input.value.trim()) doSearch(activeExam, input.value); };
  document.addEventListener("click", function(e){
    if(!document.getElementById("searchBox").contains(e.target)) closeSearch();
  }, { once:false });
}
function closeSearch(){
  var r = document.getElementById("searchResults");
  if(r){ r.classList.remove("open"); r.innerHTML=""; }
}
function doSearch(examKey, qRaw){
  var results = document.getElementById("searchResults");
  var q = (qRaw||"").trim().toLowerCase();
  if(q.length < 2){ closeSearch(); return; }
  var hits = [];
  var keysToSearch = examKey ? [examKey] : EXAM_KEYS;
  keysToSearch.forEach(function(ek){
    var exam = DATA[ek];
    if(!exam) return;
    exam.chapters.forEach(function(ch){
      var hay = (ch.title + " " + stripHtml(ch.summaryHtml||"")).toLowerCase();
      (ch.sections||[]).forEach(function(s){ hay += " " + s.heading.toLowerCase() + " " + stripHtml(s.html).toLowerCase(); });
      if(hay.indexOf(q) !== -1){
        var idx = hay.indexOf(q);
        hits.push({ kind: examTitle(ek)+" · Chapter", title: ch.title, snippet: contextSnippet(hay, q), go:[ek, ch.id, "summary"] });
      }
      (ch.flashcards||[]).forEach(function(fc,i){
        var t = (fc.front+" "+fc.back).toLowerCase();
        if(t.indexOf(q)!==-1){
          hits.push({ kind: examTitle(ek)+" · Flashcard", title: fc.front, snippet: fc.back, go:[ek, ch.id, "flashcards"] });
        }
      });
    });
    (exam.glossary||[]).forEach(function(g){
      var t = (g.term+" "+(g.definition||"")).toLowerCase();
      if(t.indexOf(q)!==-1){
        hits.push({ kind: examTitle(ek)+" · Glossary", title: g.term, snippet: g.definition, go:[ek, "_glossary"] });
      }
    });
  });
  if(hits.length===0){
    results.innerHTML = '<div class="sr-empty">No matches</div>';
  } else {
    results.innerHTML = hits.slice(0,12).map(function(h,i){
      return '<div class="sr-item" data-i="'+i+'"><div class="sr-kind">'+esc(h.kind)+'</div><div class="sr-title">'+esc(h.title)+'</div><div class="sr-snippet">'+esc(h.snippet)+'</div></div>';
    }).join("");
    Array.prototype.forEach.call(results.querySelectorAll(".sr-item"), function(el){
      el.onclick = function(){ navigate(hits[+el.getAttribute("data-i")].go); closeSearch(); };
    });
  }
  results.classList.add("open");
}
function contextSnippet(hay, q){
  var i = hay.indexOf(q);
  var start = Math.max(0, i-40);
  return (start>0?"…":"") + hay.slice(start, i+q.length+60).trim() + "…";
}

/* ---------- home ---------- */
function renderHome(){
  var keys = EXAM_KEYS.filter(function(k){return DATA[k];});
  var cards = keys.map(function(k){
    var exam = DATA[k];
    var readiness = examReadiness(k);
    return '<div class="exam-card" data-exam="'+k+'">' +
      '<span class="tag">'+esc(exam.subtitle)+'</span>' +
      '<h3>'+esc(exam.title)+'</h3>' +
      '<div class="fmt">'+esc(exam.examFormat)+'</div>' +
      '<div class="stats">' +
        '<div class="stat"><b>'+exam.chapterCount+'</b>chapters</div>' +
        '<div class="stat"><b>'+exam.mcqCount+'</b>MCQs</div>' +
        '<div class="stat"><b>'+exam.flashcardCount+'</b>flashcards</div>' +
      '</div>' +
      '<div class="readiness">' +
        '<div class="readiness-bar"><div style="width:'+readiness+'%"></div></div>' +
        '<div class="readiness-label"><span>Readiness</span><span>'+readiness+'%</span></div>' +
      '</div>' +
    '</div>';
  }).join("");

  app.innerHTML =
    '<div class="hero">' +
      '<h1>Get exam-ready.</h1>' +
      '<p>Every notion, every figure, every question style the examiner could throw at you — across all three CISI papers, in one place.</p>' +
    '</div>' +
    '<div class="exam-grid">'+cards+'</div>' +
    '<div class="footer-note">Built from your CISI study manuals · Data stays on this device (localStorage)</div>';

  Array.prototype.forEach.call(app.querySelectorAll(".exam-card"), function(el){
    el.onclick = function(){ navigate([el.getAttribute("data-exam")]); };
  });
}

/* ---------- exam overview ---------- */
function renderExamOverview(examKey){
  var exam = DATA[examKey];
  renderSidebar(examKey, null);
  var rows = exam.chapters.map(function(ch){
    var st = ensureChapter(examKey, ch.id);
    var p = chapterProgressPct(examKey, ch);
    return '<div class="chapter-row" data-ch="'+ch.id+'">' +
      '<div class="chapter-num">'+ch.number+'</div>' +
      '<div class="ct-mid"><div class="ct-title">'+esc(ch.title)+'</div><div class="ct-weight">'+esc(ch.examWeight||"")+'</div></div>' +
      '<div class="ct-metrics">' +
        '<div class="mini-stat"><div class="v">'+(ch.mcqs?ch.mcqs.length:0)+'</div><div class="k">MCQs</div></div>' +
        '<div class="mini-stat"><div class="v">'+(ch.flashcards?ch.flashcards.length:0)+'</div><div class="k">Cards</div></div>' +
        '<div class="mini-stat"><div class="v">'+(st.bestScore===null?"—":st.bestScore+"%") +'</div><div class="k">Best</div></div>' +
        '<div class="chapter-progress-ring" style="--pct:'+p+'"></div>' +
      '</div>' +
      '<span class="chevron">'+ICON.chevron+'</span>' +
    '</div>';
  }).join("");

  var readiness = examReadiness(examKey);
  var nWeak = weakCount(examKey);
  var cisiTotal = exam.chapters.reduce(function(s,ch){ return s + (ch.cisiMcqs?ch.cisiMcqs.length:0); }, 0);
  var mockCount = (exam.mockExams||[]).length;

  app.innerHTML =
    '<div class="main-narrow">' +
    backRow("Home") +
    '<div class="overview-head">' +
      '<div><h1>'+esc(exam.title)+'</h1><div class="fmt">'+esc(exam.examFormat)+'</div></div>' +
      '<div class="overview-actions">' +
        (nWeak>0 ? '<button class="btn" id="weakBtn" style="border-color:var(--red);color:var(--red);">'+ICON.target+' Weak spots ('+nWeak+')</button>' : '') +
        '<button class="btn" id="glossaryBtn">'+ICON.glossary+' Glossary</button>' +
        '<button class="btn" id="regulatorsBtn">'+ICON.map+' Regulatory bodies</button>' +
        '<button class="btn" id="clientRulesBtn">'+ICON.target+' Who gets what</button>' +
        '<button class="btn" id="exportBtn">'+ICON.pdf+' Export PDF</button>' +
        '<button class="btn btn-teal" id="allCardsBtn">'+ICON.cards+' All flashcards</button>' +
        (mockCount>0 ? '<button class="btn btn-teal" id="mocksBtn">'+ICON.quiz+' Mock exams ('+mockCount+')</button>' : '') +
        (cisiTotal>0 ? '<button class="btn btn-primary" id="cisiExamBtn">'+ICON.quiz+' CISI exam mode ('+cisiTotal+')</button>' : '') +
        '<button class="btn btn-primary" id="mixedBtn">'+ICON.target+' Mixed practice</button>' +
        '<button class="btn btn-challenge" id="challengeBtn">'+ICON.target+' Challenge Exam</button>' +
        '<button class="btn btn-primary" id="fullQuizBtn">'+ICON.quiz+' Full exam simulation</button>' +
      '</div>' +
    '</div>' +
    '<div class="stat-row">' +
      '<div class="stat-pill"><div class="n">'+exam.chapterCount+'</div><div class="l">Chapters</div></div>' +
      '<div class="stat-pill"><div class="n">'+exam.mcqCount+'</div><div class="l">Practice MCQs</div></div>' +
      '<div class="stat-pill"><div class="n">'+exam.flashcardCount+'</div><div class="l">Flashcards</div></div>' +
      '<div class="stat-pill"><div class="n">'+readiness+'%</div><div class="l">Your readiness</div></div>' +
    '</div>' +
    '<div class="chapter-grid">'+rows+'</div>' +
    '</div>';

  wireBack(app, []);
  Array.prototype.forEach.call(app.querySelectorAll(".chapter-row"), function(el){
    el.onclick = function(){ navigate([examKey, el.getAttribute("data-ch"), "summary"]); };
  });
  document.getElementById("fullQuizBtn").onclick = function(){ navigate([examKey, "_quiz"]); };
  document.getElementById("allCardsBtn").onclick = function(){ navigate([examKey, "_cards"]); };
  document.getElementById("glossaryBtn").onclick = function(){ navigate([examKey, "_glossary"]); };
  var regBtn = document.getElementById("regulatorsBtn");
  if(regBtn) regBtn.onclick = function(){ navigate([examKey, "_regulators"]); };
  var crBtn = document.getElementById("clientRulesBtn");
  if(crBtn) crBtn.onclick = function(){ navigate([examKey, "_clientrules"]); };
  var mb = document.getElementById("mocksBtn");
  if(mb) mb.onclick = function(){ navigate([examKey, "_mocks"]); };
  var cb = document.getElementById("cisiExamBtn");
  if(cb) cb.onclick = function(){ navigate([examKey, "_cisiquiz"]); };
  document.getElementById("mixedBtn").onclick = function(){ navigate([examKey, "_mixed"]); };
  document.getElementById("challengeBtn").onclick = function(){ navigate([examKey, "_challenge"]); };
  var wb = document.getElementById("weakBtn");
  if(wb) wb.onclick = function(){ navigate([examKey, "_weak"]); };
  document.getElementById("exportBtn").onclick = function(){ navigate([examKey, "_export"]); };
}

/* ---------- sidebar ---------- */
function renderSidebar(examKey, activeChId){
  var old = document.getElementById("sidebarWrap");
  if(old) old.remove();
  var exam = DATA[examKey];
  var wrap = document.createElement("div");
  wrap.id = "sidebarWrap";
  wrap.style.display = "contents";
  var links = exam.chapters.map(function(ch){
    var p = chapterProgressPct(examKey, ch);
    return '<div class="chapter-link '+(ch.id===activeChId?"active":"")+'" data-ch="'+ch.id+'">' +
      '<div class="chapter-num">'+ch.number+'</div>' +
      '<div class="chapter-link-text"><div class="chapter-link-title">'+esc(ch.title)+'</div><div class="chapter-link-meta">'+esc(ch.examWeight||"")+'</div></div>' +
      '<div class="chapter-progress-ring" style="--pct:'+p+'" title="'+p+'% reviewed"></div>' +
    '</div>';
  }).join("");
  wrap.innerHTML = '<aside class="sidebar"><div class="sidebar-title">'+esc(exam.title)+'</div>' + links + '</aside>';
  var layout = document.getElementById("layout");
  layout.insertBefore(wrap, document.getElementById("app"));
  Array.prototype.forEach.call(wrap.querySelectorAll(".chapter-link"), function(el){
    el.onclick = function(){ navigate([examKey, el.getAttribute("data-ch"), "summary"]); };
  });
}

/* ---------- chapter view ---------- */
function renderChapter(examKey, chapter, tab){
  renderSidebar(examKey, chapter.id);
  if(tab==="summary") markVisited(examKey, chapter.id, "summary");
  if(tab==="detail") markVisited(examKey, chapter.id, "detail");

  var tabs = [
    ["summary","Summary", ICON.book],
    ["detail","Detailed notes", ICON.book],
    ["mindmap","Mind map", ICON.map],
    ["flashcards","Flashcards ("+(chapter.flashcards?chapter.flashcards.length:0)+")", ICON.cards]
  ];
  if(chapter.cisiMcqs && chapter.cisiMcqs.length){
    tabs.push(["cisiQuiz","Quiz CISI ("+chapter.cisiMcqs.length+")", ICON.quiz]);
  }
  if(chapter.practiceBank && chapter.practiceBank.length){
    tabs.push(["practiceBank","Practice Bank ("+chapter.practiceBank.length+")", ICON.target]);
  }
  var tabHtml = tabs.map(function(t){
    return '<button data-tab="'+t[0]+'" class="'+(t[0]===tab?"active":"")+'">'+t[1]+'</button>';
  }).join("");

  app.innerHTML =
    '<div class="chapter-head">' +
      backRow(DATA[examKey].title) +
      '<div class="crumb"><a data-nav="home">Home</a> / <a data-nav="exam">'+esc(DATA[examKey].title)+'</a> / '+esc(chapter.title)+'</div>' +
      '<h1>'+chapter.number+'. '+esc(chapter.title)+'</h1>' +
      (chapter.examWeight? '<span class="weight-badge">'+ICON.target+' '+esc(chapter.examWeight)+'</span>' : '') +
    '</div>' +
    '<div class="tabbar" id="tabbar">'+tabHtml+'</div>' +
    '<div id="tabContent"></div>';

  wireBack(app, [examKey]);
  app.querySelector('[data-nav="home"]').onclick = function(){ navigate([]); };
  app.querySelector('[data-nav="exam"]').onclick = function(){ navigate([examKey]); };
  Array.prototype.forEach.call(app.querySelectorAll("#tabbar button"), function(b){
    b.onclick = function(){ navigate([examKey, chapter.id, b.getAttribute("data-tab")]); };
  });

  var content = document.getElementById("tabContent");
  if(tab==="summary") renderSummaryTab(content, examKey, chapter);
  else if(tab==="detail") renderDetailTab(content, examKey, chapter);
  else if(tab==="mindmap") renderMindMapTab(content, chapter);
  else if(tab==="quiz") renderQuizTab(content, examKey, chapter);
  else if(tab==="cisiQuiz") renderCisiQuizTab(content, examKey, chapter);
  else if(tab==="practiceBank") renderPracticeBankTab(content, examKey, chapter);
  else if(tab==="flashcards") renderFlashcardsTab(content, examKey, chapter);
  else renderSummaryTab(content, examKey, chapter);
}

function studyToolbarHtml(examKey, chId, tab){
  var hasHl = !!getHighlightHtml(examKey, chId, tab);
  return '<div class="study-toolbar">' +
    '<button class="btn btn-sm" id="studyModeBtn">'+ICON.highlighter+' Highlight &amp; notes mode</button>' +
    '<button class="btn btn-sm" id="clearHlBtn" style="display:'+(hasHl?"inline-flex":"none")+';">Clear highlights</button>' +
    '<span class="study-hint" id="studyHint" style="display:none;">Select any text below to highlight it.</span>' +
  '</div>';
}
function notesBoxHtml(){
  return '<div class="notes-box" id="notesBox" style="display:none;">' +
    '<div class="notes-box-title">'+ICON.pencil+' My notes for this chapter</div>' +
    '<textarea id="notesArea" placeholder="Jot down anything you want to remember, in your own words…"></textarea>' +
  '</div>';
}
function wireStudyMode(content, examKey, chId, tab){
  var btn = content.querySelector("#studyModeBtn");
  var clearBtn = content.querySelector("#clearHlBtn");
  var hint = content.querySelector("#studyHint");
  var notesBox = content.querySelector("#notesBox");
  var proseArea = content.querySelector("#proseArea");
  var active = false;
  var popup = null;

  function closePopup(){ if(popup){ popup.remove(); popup=null; } }

  function persist(){ setHighlightHtml(examKey, chId, tab, proseArea.innerHTML); clearBtn.style.display = "inline-flex"; }

  function onSelectionUp(e){
    if(!active) return;
    var sel = window.getSelection();
    if(!sel || sel.isCollapsed || sel.rangeCount===0){ closePopup(); return; }
    var range = sel.getRangeAt(0);
    if(!proseArea.contains(range.commonAncestorContainer)){ closePopup(); return; }
    var rect = range.getBoundingClientRect();
    if(rect.width===0 && rect.height===0) return;
    closePopup();
    popup = document.createElement("div");
    popup.className = "hl-popup";
    popup.style.top = Math.max(8, rect.top + window.scrollY - 44) + "px";
    popup.style.left = Math.max(8, rect.left + window.scrollX) + "px";
    popup.innerHTML =
      '<button data-c="hl-yellow" title="Yellow"></button>' +
      '<button data-c="hl-green" title="Green"></button>' +
      '<button data-c="hl-pink" title="Pink"></button>' +
      '<button class="hl-remove" data-c="remove" title="Remove highlight">&times;</button>';
    document.body.appendChild(popup);
    Array.prototype.forEach.call(popup.querySelectorAll("button"), function(b){
      b.onclick = function(ev){
        ev.stopPropagation();
        var c = b.getAttribute("data-c");
        if(c==="remove"){
          var node = range.commonAncestorContainer;
          var el = node.nodeType===1 ? node : node.parentElement;
          var markEl = el ? el.closest("mark") : null;
          if(markEl){
            var parent = markEl.parentNode;
            while(markEl.firstChild) parent.insertBefore(markEl.firstChild, markEl);
            parent.removeChild(markEl);
          }
        } else {
          try{
            var mark = document.createElement("mark");
            mark.className = c;
            range.surroundContents(mark);
          }catch(err){
            try{
              var frag = range.extractContents();
              var mark2 = document.createElement("mark");
              mark2.className = c;
              mark2.appendChild(frag);
              range.insertNode(mark2);
            }catch(err2){}
          }
        }
        sel.removeAllRanges();
        closePopup();
        persist();
      };
    });
  }

  btn.onclick = function(){
    active = !active;
    btn.classList.toggle("active", active);
    hint.style.display = active ? "inline" : "none";
    notesBox.style.display = active ? "block" : "none";
    proseArea.classList.toggle("study-active", active);
    if(!active) closePopup();
  };
  clearBtn.onclick = function(){
    clearHighlights(examKey, chId, tab);
    render();
  };
  document.addEventListener("mouseup", onSelectionUp);
  document.addEventListener("touchend", onSelectionUp);
  document.addEventListener("mousedown", function(e){ if(popup && !popup.contains(e.target)) closePopup(); });
}
function wireNotesBox(content, examKey, chId){
  var area = content.querySelector("#notesArea");
  area.value = getNote(examKey, chId);
  var t;
  area.oninput = function(){
    clearTimeout(t);
    t = setTimeout(function(){ setNote(examKey, chId, area.value); }, 400);
  };
}

var CROSS_CHAPTER_LINKS = {
  "reg-ch1": [
    { text:"The MLRO you'll meet in Money Laundering is always a Senior Manager Function under the SM&CR you just read about here.", targetCh:"reg-ch3", targetTab:"detail", label:"Money Laundering — MLRO" },
    { text:"Whether COBS applies to a firm's business (MiFID vs non-MiFID) traces back to the regulated activities and Part 4A permission you learn here.", targetCh:"reg-ch2", targetTab:"detail", label:"Application of COBS" },
    { text:"FSCS is supervised jointly by the FCA and PRA — the same twin-peaks split you saw in Part 4A authorisation for dual-regulated firms.", targetCh:"reg-ch4", targetTab:"detail", label:"The FSCS" },
    { text:"An appointed representative (AR) conducts COBS business entirely under its principal's Part 4A permission — see how that plays out in practice.", targetCh:"reg-ch2", targetTab:"detail", label:"Appointed Representatives" }
  ],
  "reg-ch2": [
    { text:"A client unhappy with the suitability/appropriateness of advice they received here is exactly the kind of person who becomes an FOS-eligible complainant.", targetCh:"reg-ch4", targetTab:"detail", label:"Customer Complaints" },
    { text:"Personal account dealing rules here sit alongside — and sometimes overlap with — PDMR dealing restrictions and the closed period in market abuse.", targetCh:"reg-ch3", targetTab:"detail", label:"Market Manipulation" },
    { text:"Which regulated activities a firm can even offer (and therefore which COBS rules bite) comes from the Part 4A permission covered in Chapter 1.", targetCh:"reg-ch1", targetTab:"detail", label:"Regulated Activities" },
    { text:"Client money segregation (CASS, covered here) is one of the very few protections that applies to an eligible counterparty exactly like a retail client — see the ECP disapplication table.", targetCh:"reg-ch2", targetTab:"summary", label:"ECP disapplication (this chapter)" }
  ],
  "reg-ch3": [
    { text:"The MLRO is always a Senior Manager Function — see how that role fits within the wider SM&CR structure.", targetCh:"reg-ch1", targetTab:"detail", label:"Fitness and Propriety (SM&CR)" },
    { text:"An employee who whistleblows on suspected market abuse is protected under exactly the same whistleblowing regime covered in Complaints and Redress.", targetCh:"reg-ch4", targetTab:"detail", label:"Whistleblowing" },
    { text:"Personal account dealing rules in Conduct of Business directly intersect with the PDMR/insider dealing rules covered here.", targetCh:"reg-ch2", targetTab:"detail", label:"Dealing and Managing" },
    { text:"The FCA's civil market abuse penalty decisions (fine vs public censure) follow the same enforcement decision-making framework as general FCA disciplinary action.", targetCh:"reg-ch1", targetTab:"detail", label:"The Regulatory Environment" }
  ],
  "reg-ch4": [
    { text:"The Whistleblowers' Champion role required at some firms sits within the SM&CR accountability structure covered in Chapter 1.", targetCh:"reg-ch1", targetTab:"detail", label:"Fitness and Propriety (SM&CR)" },
    { text:"Most FOS complaints trace back to a suitability or appropriateness failure — see the underlying advice standards that create these disputes.", targetCh:"reg-ch2", targetTab:"detail", label:"Advising and Selling Standards" },
    { text:"An MLRO reports money-laundering suspicions to the NCA — a completely separate channel from the ICO breach reporting covered here. Don't mix them up.", targetCh:"reg-ch3", targetTab:"detail", label:"Money Laundering" },
    { text:"FSCS is supervised jointly by the FCA and PRA — trace that twin-peaks structure back to how firms get authorised in the first place.", targetCh:"reg-ch1", targetTab:"detail", label:"The Regulatory Environment" }
  ]
};
function connectionsHtml(chId){
  var items = CROSS_CHAPTER_LINKS[chId] || [];
  if(items.length===0) return "";
  return '<div class="connections-box">' +
    '<div class="connections-title">'+ICON.map+' How this chapter connects to the rest of the course</div>' +
    items.map(function(l,i){
      return '<button class="connection-row" data-idx="'+i+'"><span class="connection-text">'+esc(l.text)+'</span><span class="connection-target">'+esc(l.label)+' '+ICON.chevron+'</span></button>';
    }).join("") +
  '</div>';
}
function wireConnections(content, examKey, chId){
  var items = CROSS_CHAPTER_LINKS[chId] || [];
  Array.prototype.forEach.call(content.querySelectorAll(".connection-row"), function(btn){
    var item = items[+btn.getAttribute("data-idx")];
    if(!item) return;
    btn.onclick = function(){ navigate([examKey, item.targetCh, item.targetTab]); };
  });
}

function renderSummaryTab(content, examKey, chapter){
  var focusHtml = "";
  if(chapter.examFocus && chapter.examFocus.length){
    focusHtml = '<div class="exam-focus-box">' +
      '<div class="exam-focus-title">'+ICON.target+' What actually gets tested — based on the CISI &amp; Mock question bank</div>' +
      '<ul>' + chapter.examFocus.map(function(pt){ return '<li>'+pt+'</li>'; }).join("") + '</ul>' +
    '</div>';
  }
  var stored = getHighlightHtml(examKey, chapter.id, "summary");
  var bodyHtml = stored || (chapter.summaryHtml || "<p>No summary available.</p>");
  content.innerHTML = connectionsHtml(chapter.id) + focusHtml + studyToolbarHtml(examKey, chapter.id, "summary") +
    '<div class="summary-card"><div class="prose" id="proseArea">'+bodyHtml+'</div></div>' +
    notesBoxHtml();
  wireConnections(content, examKey, chapter.id);
  wireStudyMode(content, examKey, chapter.id, "summary");
  wireNotesBox(content, examKey, chapter.id);
}
var RELATED_LINKS_BY_CHAPTER = {
  "reg-ch1": [
    { label:"Regulatory bodies — who's accountable to whom", route:["_regulators"] },
    { label:"Mind map — the regulator relationship map for this chapter", route:["reg-ch1","mindmap"] },
    { label:"Glossary — key terms across the whole subject", route:["_glossary"] }
  ],
  "reg-ch2": [
    { label:"Who gets what — client protections by client type", route:["_clientrules"] },
    { label:"Regulatory bodies — FCA, PRA and how COBS applies", route:["_regulators"] },
    { label:"Glossary — key terms across the whole subject", route:["_glossary"] }
  ],
  "reg-ch3": [
    { label:"Regulatory bodies — NCA, JMLSG, FATF and the AML chain", route:["_regulators"] },
    { label:"Who gets what — client money rules (apply to everyone)", route:["_clientrules"] },
    { label:"Glossary — key terms across the whole subject", route:["_glossary"] }
  ],
  "reg-ch4": [
    { label:"Regulatory bodies — FSCS, FOS, ICO compared", route:["_regulators"] },
    { label:"Who gets what — FSCS/FOS eligibility by client type", route:["_clientrules"] },
    { label:"Glossary — key terms across the whole subject", route:["_glossary"] }
  ]
};
function relatedLinksHtml(chId){
  var items = RELATED_LINKS_BY_CHAPTER[chId] || [];
  if(items.length===0) return "";
  return '<div class="related-links-box"><div class="related-links-title">'+ICON.map+' See also — how this links to the rest of the subject</div>' +
    items.map(function(l,i){ return '<button class="related-link-btn" data-idx="'+i+'">'+esc(l.label)+' '+ICON.chevron+'</button>'; }).join("") +
  '</div>';
}
function wireRelatedLinks(content, examKey, chId){
  var items = RELATED_LINKS_BY_CHAPTER[chId] || [];
  Array.prototype.forEach.call(content.querySelectorAll(".related-link-btn"), function(btn){
    var item = items[+btn.getAttribute("data-idx")];
    if(!item) return;
    btn.onclick = function(){ navigate([examKey].concat(item.route)); };
  });
}

function renderDetailTab(content, examKey, chapter){
  var secs = (chapter.sections||[]).map(function(s){
    return '<div class="section-block"><h3 class="sec-h">'+esc(s.heading)+'</h3><div class="prose">'+s.html+'</div></div>';
  }).join("");
  var original = secs || '<div class="empty-state">No detailed notes available.</div>';
  var stored = getHighlightHtml(examKey, chapter.id, "detail");
  var bodyHtml = stored || original;
  content.innerHTML = connectionsHtml(chapter.id) + studyToolbarHtml(examKey, chapter.id, "detail") + '<div id="proseArea">'+bodyHtml+'</div>' + relatedLinksHtml(chapter.id) + notesBoxHtml();
  attachDiagrams(content);
  wireConnections(content, examKey, chapter.id);
  wireStudyMode(content, examKey, chapter.id, "detail");
  wireRelatedLinks(content, examKey, chapter.id);
  wireNotesBox(content, examKey, chapter.id);
}

/* ---------- mind map (auto-built from the chapter's sections/sub-headings so it always reflects the notes) ---------- */
var MM_PALETTE = ["#e0764f","#4f9de0","#5fb37a","#c98fe0","#e0b256","#4fc4c9","#e05f8a","#8fa3e0","#9fc95f","#e08f4f","#5f8ae0","#c95f9f"];

function mmStrip(text){
  return String(text||"").replace(/^\s*\d+(\.\d+)*\.?\s*/, "").replace(/\s*\([^)]*\)\s*$/, "").trim();
}
function mmTruncate(text, n){
  text = String(text||"");
  return text.length>n ? text.slice(0,n-1).trim()+"…" : text;
}
function buildMindMapModel(chapter){
  var branches = (chapter.sections||[]).map(function(section){
    var h4re = /<h4>([\s\S]*?)<\/h4>/g, m, kids = [];
    while((m = h4re.exec(section.html))){ kids.push(mmStrip(m[1].replace(/<[^>]+>/g,""))); }
    if(kids.length===0) kids = [""]; // keep an angular slot even if no sub-headings
    return { label: mmStrip(section.heading), kids: kids.filter(Boolean) };
  }).filter(function(b){ return b.label; });
  if(branches.length===0) return null;

  var cx = 1000, cy = 1000, R1 = 300, R2 = 640;
  var totalSlots = branches.reduce(function(s,b){ return s + Math.max(b.kids.length,1); }, 0);
  var angle = -Math.PI/2, nodes = [], links = [];
  branches.forEach(function(b, bi){
    var slotCount = Math.max(b.kids.length,1);
    var slice = (slotCount/totalSlots) * Math.PI*2;
    var mid = angle + slice/2;
    var color = MM_PALETTE[bi % MM_PALETTE.length];
    var bx = cx + R1*Math.cos(mid), by = cy + R1*Math.sin(mid);
    nodes.push({ x:bx, y:by, label:mmTruncate(b.label,46), level:1, color:color });
    links.push({ x1:cx, y1:cy, x2:bx, y2:by, color:color });
    if(b.kids.length){
      var childStart = angle, step = slice / b.kids.length;
      b.kids.forEach(function(k, ki){
        var ca = childStart + step*(ki+0.5);
        var kx = cx + R2*Math.cos(ca), ky = cy + R2*Math.sin(ca);
        nodes.push({ x:kx, y:ky, label:mmTruncate(k,40), level:2, color:color });
        links.push({ x1:bx, y1:by, x2:kx, y2:ky, color:color });
      });
    }
    angle += slice;
  });
  return { cx:cx, cy:cy, nodes:nodes, links:links, centerLabel: mmTruncate(chapter.title,26) };
}

function renderMindMapTab(content, chapter){
  if(chapter.id === "reg-ch1"){ renderCuratedMindMap(content, buildRegulatorMap()); return; }
  var model = buildMindMapModel(chapter);
  if(!model){ content.innerHTML = '<div class="empty-state">No notes available to build a mind map from yet.</div>'; return; }
  renderGeneratedMindMap(content, model);
}

/* Hand-authored: how the UK regulators relate to each other (from the ch.1 notes) */
function buildRegulatorMap(){
  var C = { gov:"#8fa3e0", boe:"#4fc4c9", fca:"#e0b256", mixed:"#c98fe0", intl:"#e0764f", neutral:"#9aa3b5" };
  var nodes = [
    { id:"hmt",   x:700,  y:70,  w:230, main:"HM Treasury", sub:"Gov't dept · overall responsibility", color:C.gov },
    { id:"boe",   x:380,  y:250, w:210, main:"Bank of England", sub:"Central bank", color:C.boe },
    { id:"fca",   x:950,  y:250, w:210, main:"FCA", sub:"Financial Conduct Authority", color:C.fca },
    { id:"pra",   x:210,  y:440, w:190, main:"PRA", sub:"Prudential Regulation Authority", color:C.boe },
    { id:"fpc",   x:400,  y:440, w:170, main:"FPC", sub:"Financial Policy Committee", color:C.boe },
    { id:"mpc",   x:570,  y:440, w:170, main:"MPC", sub:"Monetary Policy Committee", color:C.boe },
    { id:"fos",   x:840,  y:440, w:180, main:"FOS", sub:"Financial Ombudsman Service", color:C.fca },
    { id:"fscs",  x:1040, y:440, w:200, main:"FSCS", sub:"Compensation scheme", color:C.mixed },
    { id:"firms", x:620,  y:620, w:230, main:"Authorised Firms", sub:"Dual- & solo-regulated", color:C.neutral },
    { id:"cma",   x:1260, y:250, w:190, main:"CMA", sub:"Competition & Markets Authority", color:C.neutral },
    { id:"hmrc",  x:1260, y:440, w:190, main:"HMRC", sub:"Tax authority", color:C.neutral },
    { id:"tpr",   x:1260, y:620, w:190, main:"TPR", sub:"The Pensions Regulator", color:C.neutral },
    { id:"fatf",  x:330,  y:800, w:190, main:"FATF", sub:"AML/CTF standards (int'l)", color:C.intl },
    { id:"bis",   x:700,  y:800, w:190, main:"BIS", sub:"Central bank of central banks", color:C.intl },
    { id:"iosco", x:1070, y:800, w:190, main:"IOSCO", sub:"Securities standards (int'l)", color:C.intl }
  ];
  var edges = [
    { from:"hmt", to:"fca", label:"appoints CEO/chair · FCA reports to HMT" },
    { from:"hmt", to:"boe", label:"works with", dashed:true },
    { from:"hmt", to:"tpr", label:"sponsors", dashed:true },
    { from:"boe", to:"pra", label:"part of (via PRC)" },
    { from:"boe", to:"fpc", label:"part of" },
    { from:"boe", to:"mpc", label:"part of" },
    { from:"pra", to:"firms", label:"prudential supervision" },
    { from:"fca", to:"firms", label:"conduct supervision" },
    { from:"fca", to:"pra", label:"twin peaks — shared firms", dashed:true },
    { from:"fca", to:"fos", label:"oversees" },
    { from:"fca", to:"fscs", label:"jointly funds/oversees" },
    { from:"pra", to:"fscs", label:"jointly funds/oversees" },
    { from:"fca", to:"cma", label:"works closely with", dashed:true },
    { from:"fca", to:"hmrc", label:"info-sharing", dashed:true },
    { from:"pra", to:"hmrc", label:"info-sharing", dashed:true },
    { from:"fatf", to:"fca", label:"AML/CTF standards", dashed:true },
    { from:"fatf", to:"pra", label:"", dashed:true },
    { from:"bis", to:"pra", label:"prudential standards", dashed:true },
    { from:"iosco", to:"fca", label:"securities standards", dashed:true }
  ];
  var byId = {}; nodes.forEach(function(n){ byId[n.id]=n; });
  return { nodes:nodes, edges:edges, byId:byId, w:1500, h:900 };
}

function renderCuratedMindMap(content, g){
  var linksHtml = g.edges.map(function(e){
    var a = g.byId[e.from], b = g.byId[e.to];
    var midx = (a.x+b.x)/2, midy = (a.y+b.y)/2;
    var line = '<line x1="'+a.x+'" y1="'+a.y+'" x2="'+b.x+'" y2="'+b.y+'" stroke="'+(a.color)+'" stroke-width="2.5" opacity="0.5"'+(e.dashed?' stroke-dasharray="6,6"':'')+'/>';
    var labelHtml = "";
    if(e.label){
      labelHtml = '<foreignObject x="'+(midx-90)+'" y="'+(midy-13)+'" width="180" height="26">' +
        '<div xmlns="http://www.w3.org/1999/xhtml" class="mm-edge-label">'+esc(e.label)+'</div>' +
      '</foreignObject>';
    }
    return line + labelHtml;
  }).join("");
  var nodesHtml = g.nodes.map(function(n){
    var h = 60;
    return '<foreignObject x="'+(n.x-n.w/2)+'" y="'+(n.y-h/2)+'" width="'+n.w+'" height="'+h+'">' +
      '<div xmlns="http://www.w3.org/1999/xhtml" class="mm-node mm-reg" style="border-color:'+n.color+';">' +
        '<span class="mm-reg-main">'+esc(n.main)+'</span><span class="mm-reg-sub">'+esc(n.sub)+'</span>' +
      '</div>' +
    '</foreignObject>';
  }).join("");

  content.innerHTML =
    '<div class="mindmap-toolbar">' +
      '<span class="mm-hint">Drag to pan · pinch or use buttons to zoom · dashed = informal/indirect link</span>' +
      '<div class="mm-zoombtns">' +
        '<button class="btn btn-sm" id="mmZoomOut">−</button>' +
        '<button class="btn btn-sm" id="mmZoomReset">Reset</button>' +
        '<button class="btn btn-sm" id="mmZoomIn">+</button>' +
      '</div>' +
    '</div>' +
    '<div class="mindmap-wrap" id="mmWrap">' +
      '<svg id="mmSvg" viewBox="0 0 '+g.w+' '+g.h+'" width="'+g.w+'" height="'+g.h+'" style="transform-origin:0 0;">' +
        linksHtml + nodesHtml +
      '</svg>' +
    '</div>';

  wireMindMapControls(g.w, g.h, 0.62);
}

function renderGeneratedMindMap(content, model){
  var linksHtml = model.links.map(function(l){
    return '<line x1="'+l.x1+'" y1="'+l.y1+'" x2="'+l.x2+'" y2="'+l.y2+'" stroke="'+l.color+'" stroke-width="2.5" opacity="0.45"/>';
  }).join("");
  var nodesHtml = model.nodes.map(function(n){
    var w = n.level===1 ? 200 : 168, h = n.level===1 ? 56 : 46;
    return '<foreignObject x="'+(n.x-w/2)+'" y="'+(n.y-h/2)+'" width="'+w+'" height="'+h+'">' +
      '<div xmlns="http://www.w3.org/1999/xhtml" class="mm-node mm-lvl'+n.level+'" style="border-color:'+n.color+';">'+esc(n.label)+'</div>' +
    '</foreignObject>';
  }).join("");
  var centerHtml = '<foreignObject x="'+(model.cx-110)+'" y="'+(model.cy-40)+'" width="220" height="80">' +
    '<div xmlns="http://www.w3.org/1999/xhtml" class="mm-node mm-center">'+esc(model.centerLabel)+'</div>' +
  '</foreignObject>';

  content.innerHTML =
    '<div class="mindmap-toolbar">' +
      '<span class="mm-hint">Drag to pan · pinch or use buttons to zoom</span>' +
      '<div class="mm-zoombtns">' +
        '<button class="btn btn-sm" id="mmZoomOut">−</button>' +
        '<button class="btn btn-sm" id="mmZoomReset">Reset</button>' +
        '<button class="btn btn-sm" id="mmZoomIn">+</button>' +
      '</div>' +
    '</div>' +
    '<div class="mindmap-wrap" id="mmWrap">' +
      '<svg id="mmSvg" viewBox="0 0 2000 2000" width="2000" height="2000" style="transform-origin:0 0;">' +
        linksHtml + nodesHtml + centerHtml +
      '</svg>' +
    '</div>';

  wireMindMapControls(2000, 2000, 0.5);
}

function wireMindMapControls(vbW, vbH, initialScale){
  var wrap = document.getElementById("mmWrap");
  var svg = document.getElementById("mmSvg");
  var scale = initialScale;
  function applyScale(){ svg.style.transform = "scale("+scale+")"; }
  function center(){
    applyScale();
    wrap.scrollLeft = (vbW*scale - wrap.clientWidth)/2;
    wrap.scrollTop = (vbH*scale - wrap.clientHeight)/2;
  }
  center();
  document.getElementById("mmZoomIn").onclick = function(){ scale = Math.min(scale+0.15, 1.6); applyScale(); };
  document.getElementById("mmZoomOut").onclick = function(){ scale = Math.max(scale-0.15, 0.2); applyScale(); };
  document.getElementById("mmZoomReset").onclick = function(){ scale = initialScale; center(); };

  var dragging = false, lastX=0, lastY=0;
  function down(x,y){ dragging = true; lastX=x; lastY=y; }
  function move(x,y){ if(!dragging) return; wrap.scrollLeft -= (x-lastX); wrap.scrollTop -= (y-lastY); lastX=x; lastY=y; }
  function up(){ dragging = false; }
  wrap.addEventListener("mousedown", function(e){ down(e.clientX,e.clientY); });
  window.addEventListener("mousemove", function(e){ move(e.clientX,e.clientY); });
  window.addEventListener("mouseup", up);
  wrap.addEventListener("touchstart", function(e){ if(e.touches.length===1) down(e.touches[0].clientX,e.touches[0].clientY); }, {passive:true});
  wrap.addEventListener("touchmove", function(e){ if(e.touches.length===1) move(e.touches[0].clientX,e.touches[0].clientY); }, {passive:true});
  wrap.addEventListener("touchend", up);
}

/* ---------- quiz (chapter-level) ---------- */
function renderQuizTab(content, examKey, chapter){
  var mcqs = chapter.mcqs || [];
  if(mcqs.length===0){ content.innerHTML = '<div class="empty-state">No questions for this chapter yet.</div>'; return; }
  renderQuizSetup(content, mcqs.length, function(count){
    var tagged = mcqs.map(function(q,i){ return Object.assign({}, q, { _qid: chapter.id+"::"+i, _chId: chapter.id, _chapter: chapter.title }); });
    var picked = shuffle(tagged).slice(0, count);
    runQuizUI(content, examKey, chapter.title, picked, function(pct){
      recordQuizResult(examKey, chapter.id, pct);
    }, { chapterId: chapter.id });
  });
}

/* ---------- quiz CISI (official CISI competency-test questions, separate from the curated practice quiz) ---------- */
function renderCisiQuizTab(content, examKey, chapter){
  var mcqs = chapter.cisiMcqs || [];
  if(mcqs.length===0){ content.innerHTML = '<div class="empty-state">No CISI questions for this chapter yet.</div>'; return; }
  renderQuizSetup(content, mcqs.length, function(count){
    var tagged = mcqs.map(function(q,i){ return Object.assign({}, q, { _qid: chapter.id+"::cisi::"+i, _chId: chapter.id, _chapter: chapter.title }); });
    var picked = shuffle(tagged).slice(0, count);
    runQuizUI(content, examKey, chapter.title+" — CISI questions", picked, function(pct){
      recordQuizResult(examKey, chapter.id+"_cisi", pct);
    }, { chapterId: chapter.id+"_cisi" });
  });
}

/* ---------- Practice Bank: original, never-seen questions written to reinforce genuine understanding ---------- */
function renderPracticeBankTab(content, examKey, chapter){
  var mcqs = chapter.practiceBank || [];
  if(mcqs.length===0){ content.innerHTML = '<div class="empty-state">No practice bank questions for this chapter yet.</div>'; return; }
  content.innerHTML = '<div class="practice-bank-intro">'+ICON.target+' Original questions, written specifically to test understanding rather than memory — not from the CISI bank or the mocks.</div>';
  var setupHost = document.createElement("div");
  content.appendChild(setupHost);
  renderQuizSetup(setupHost, mcqs.length, function(count){
    var tagged = mcqs.map(function(q,i){ return Object.assign({}, q, { _qid: chapter.id+"::practice::"+i, _chId: chapter.id, _chapter: chapter.title }); });
    var picked = shuffle(tagged).slice(0, count);
    runQuizUI(content, examKey, chapter.title+" — Practice Bank", picked, function(pct){
      recordQuizResult(examKey, chapter.id+"_practice", pct);
    }, { chapterId: chapter.id+"_practice" });
  });
}

/* ---------- question-count picker (increments of 10, up to the full set) ---------- */
function renderQuizSetup(content, total, onStart){
  var options = [];
  for(var n=10; n<total; n+=10) options.push(n);
  options.push(total);
  var chipHtml = options.map(function(n, i){
    return '<button class="chip qty-chip" data-n="'+n+'"'+(i===options.length-1?' data-all="1"':'')+'>'+n+(n===total?' (all)':'')+'</button>';
  }).join("");
  content.innerHTML =
    '<div class="quiz-setup">' +
      '<div class="quiz-setup-label">How many questions do you want to revise?</div>' +
      '<div class="qty-chips">'+chipHtml+'</div>' +
    '</div>';
  Array.prototype.forEach.call(content.querySelectorAll(".qty-chip"), function(btn){
    btn.onclick = function(){ onStart(+btn.getAttribute("data-n")); };
  });
}

/* ---------- weak spots ---------- */
function renderWeakSpots(examKey){
  renderSidebar(examKey, null);
  var exam = DATA[examKey];
  var qs = shuffle(weakQuestions(examKey));
  app.innerHTML = '<div class="quiz-shell">' +
    '<div class="chapter-head">' + backRow(exam.title) +
    '<div class="crumb"><a data-nav="home">Home</a> / <a data-nav="exam">'+esc(exam.title)+'</a> / Weak spots</div>' +
    '<h1>Weak spots</h1><div class="fmt">Every question you\'ve gotten wrong so far, across all chapters. Answer correctly to clear it from this list.</div></div>' +
    '<div id="weakBody"></div></div>';
  wireBack(app, [examKey]);
  app.querySelector('[data-nav="home"]').onclick = function(){ navigate([]); };
  app.querySelector('[data-nav="exam"]').onclick = function(){ navigate([examKey]); };
  var body = document.getElementById("weakBody");
  if(qs.length===0){
    body.innerHTML = '<div class="empty-state">Nothing here yet — miss a question in any quiz and it\'ll show up here for focused drilling.</div>';
    return;
  }
  runQuizUI(body, examKey, "Weak spots ("+qs.length+")", qs, function(){}, { isWeakMode:true });
}

/* ---------- PDF export ---------- */
function renderExportPage(examKey){
  renderSidebar(examKey, null);
  var exam = DATA[examKey];
  var rows = exam.chapters.map(function(ch){
    return '<label class="export-row">' +
      '<input type="checkbox" class="export-check" data-ch="'+ch.id+'" checked/>' +
      '<span class="chapter-num">'+ch.number+'</span>' +
      '<span class="export-row-text"><span class="export-row-title">'+esc(ch.title)+'</span><span class="export-row-meta">'+esc(ch.examWeight||"")+'</span></span>' +
    '</label>';
  }).join("");

  app.innerHTML = '<div class="main-narrow">' +
    '<div class="chapter-head">' + backRow(exam.title) +
    '<div class="crumb"><a data-nav="home">Home</a> / <a data-nav="exam">'+esc(exam.title)+'</a> / Export PDF</div>' +
    '<h1>Export to PDF</h1><div class="fmt">Pick what to include, then your browser\'s print dialog opens — choose "Save as PDF" as the destination.</div></div>' +
    '<div class="export-panel">' +
      '<div class="export-section-title">Content to include</div>' +
      '<div class="opt-row" id="modeChips">' +
        '<button class="chip active" data-m="both">Summary + Detailed notes</button>' +
        '<button class="chip" data-m="summary">Summary only</button>' +
        '<button class="chip" data-m="detail">Detailed notes only</button>' +
      '</div>' +
      '<div class="export-section-title" style="margin-top:22px;">Chapters <span style="font-weight:400;color:var(--text-faint);">('+exam.chapterCount+')</span></div>' +
      '<div class="opt-row" style="margin-bottom:10px;">' +
        '<button class="btn btn-sm" id="selAll">Select all</button>' +
        '<button class="btn btn-sm" id="selNone">Select none</button>' +
      '</div>' +
      '<div class="export-list">'+rows+'</div>' +
      '<button class="btn btn-primary" id="genPdfBtn" style="margin-top:22px;">'+ICON.pdf+' Generate PDF</button>' +
    '</div>' +
  '</div>';

  wireBack(app, [examKey]);
  app.querySelector('[data-nav="home"]').onclick = function(){ navigate([]); };
  app.querySelector('[data-nav="exam"]').onclick = function(){ navigate([examKey]); };

  var mode = "both";
  var modeChips = document.getElementById("modeChips");
  Array.prototype.forEach.call(modeChips.querySelectorAll(".chip"), function(c){
    c.onclick = function(){
      Array.prototype.forEach.call(modeChips.querySelectorAll(".chip"), function(x){x.classList.remove("active");});
      c.classList.add("active"); mode = c.getAttribute("data-m");
    };
  });
  document.getElementById("selAll").onclick = function(){
    Array.prototype.forEach.call(document.querySelectorAll(".export-check"), function(cb){ cb.checked = true; });
  };
  document.getElementById("selNone").onclick = function(){
    Array.prototype.forEach.call(document.querySelectorAll(".export-check"), function(cb){ cb.checked = false; });
  };
  document.getElementById("genPdfBtn").onclick = function(){
    var ids = Array.prototype.filter.call(document.querySelectorAll(".export-check"), function(cb){ return cb.checked; })
      .map(function(cb){ return cb.getAttribute("data-ch"); });
    if(ids.length===0){ alert("Pick at least one chapter first."); return; }
    generatePrintDoc(examKey, ids, mode);
  };
}

/* ---------- glossary ---------- */
function renderGlossary(examKey){
  renderSidebar(examKey, null);
  var exam = DATA[examKey];
  var terms = (exam.glossary || []).slice().sort(function(a,b){ return a.term.localeCompare(b.term); });

  if(terms.length===0){
    app.innerHTML = '<div class="main-narrow"><div class="chapter-head">' + backRow(exam.title) +
      '<div class="crumb"><a data-nav="home">Home</a> / <a data-nav="exam">'+esc(exam.title)+'</a> / Glossary</div>' +
      '<h1>Glossary</h1></div><div class="empty-state">No glossary yet for '+esc(exam.title)+'.</div></div>';
    wireBack(app, [examKey]);
    app.querySelector('[data-nav="home"]').onclick = function(){ navigate([]); };
    app.querySelector('[data-nav="exam"]').onclick = function(){ navigate([examKey]); };
    return;
  }

  var chapterNames = {};
  exam.chapters.forEach(function(ch){ chapterNames[ch.number] = ch.title; });

  function cardHtml(t){
    var chars = (t.chars||[]).map(function(c){ return '<li>'+esc(c)+'</li>'; }).join("");
    return '<div class="gloss-card" data-term="'+esc(t.term.toLowerCase())+'" data-def="'+esc((t.definition||"").toLowerCase())+'">' +
      '<div class="gloss-head"><span class="gloss-term">'+esc(t.term)+'</span>'+(t.chapter?'<span class="gloss-ch">Ch.'+t.chapter+'</span>':'')+'</div>' +
      '<div class="gloss-def">'+esc(t.definition)+'</div>' +
      (chars ? '<ul class="gloss-chars">'+chars+'</ul>' : '') +
    '</div>';
  }

  app.innerHTML = '<div class="main-narrow">' +
    '<div class="chapter-head">' + backRow(exam.title) +
      '<div class="crumb"><a data-nav="home">Home</a> / <a data-nav="exam">'+esc(exam.title)+'</a> / Glossary</div>' +
      '<h1>Glossary</h1><div class="fmt">'+terms.length+' key terms, definitions and main characteristics — search or jump to a letter.</div>' +
    '</div>' +
    '<div class="gloss-toolbar">' +
      '<div class="search-box gloss-search">'+ICON.search+'<input type="text" id="glossSearch" placeholder="Search terms…" autocomplete="off"/></div>' +
      '<button class="btn btn-primary btn-sm" id="glossFcBtn">'+ICON.cards+' Flashcard mode</button>' +
    '</div>' +
    '<div class="gloss-list" id="glossList">' + terms.map(cardHtml).join("") + '</div>' +
    '<div class="empty-state" id="glossEmpty" style="display:none;">No terms match your search.</div>' +
  '</div>';

  wireBack(app, [examKey]);
  app.querySelector('[data-nav="home"]').onclick = function(){ navigate([]); };
  app.querySelector('[data-nav="exam"]').onclick = function(){ navigate([examKey]); };

  var input = document.getElementById("glossSearch");
  var glossFcBtn = document.getElementById("glossFcBtn");
  if(glossFcBtn) glossFcBtn.onclick = function(){ navigate([examKey, "_glossaryflashcards"]); };
  var cards = Array.prototype.slice.call(document.querySelectorAll(".gloss-card"));
  var emptyMsg = document.getElementById("glossEmpty");
  input.oninput = function(){
    var q = input.value.trim().toLowerCase();
    var shown = 0;
    cards.forEach(function(c){
      var match = !q || c.getAttribute("data-term").indexOf(q)!==-1 || c.getAttribute("data-def").indexOf(q)!==-1;
      c.style.display = match ? "" : "none";
      if(match) shown++;
    });
    emptyMsg.style.display = shown===0 ? "" : "none";
  };
}

function generatePrintDoc(examKey, chapterIds, mode){
  var exam = DATA[examKey];
  var chapters = exam.chapters.filter(function(ch){ return chapterIds.indexOf(ch.id) !== -1; });
  var today = new Date();
  var dateStr = today.toLocaleDateString("en-GB", { day:"numeric", month:"long", year:"numeric" });

  var cover =
    '<div class="print-cover">' +
      '<div class="print-cover-kicker">CISI Revision Hub</div>' +
      '<h1>'+esc(exam.title)+'</h1>' +
      '<div class="print-cover-sub">'+esc(exam.subtitle)+' &middot; '+esc(exam.examFormat)+'</div>' +
      '<div class="print-cover-meta">Generated '+dateStr+' &middot; '+chapters.length+' of '+exam.chapterCount+' chapters &middot; '+
        (mode==="both"?"Summary + detailed notes":mode==="summary"?"Summary only":"Detailed notes only") +
      '</div>' +
      '<div class="print-toc"><b>Contents</b><ol>' +
        chapters.map(function(ch){ return '<li>'+esc(ch.title)+(ch.examWeight?' <span>&middot; '+esc(ch.examWeight)+'</span>':'')+'</li>'; }).join("") +
      '</ol></div>' +
    '</div>';

  var body = chapters.map(function(ch){
    var parts = '<div class="print-chapter">' +
      '<div class="print-ch-kicker">'+esc(exam.title)+'</div>' +
      '<h2>'+ch.number+'. '+esc(ch.title)+'</h2>' +
      (ch.examWeight ? '<div class="print-weight">'+esc(ch.examWeight)+'</div>' : '');
    if(mode==="both" || mode==="summary"){
      parts += '<h3 class="print-subhead">Summary</h3><div class="prose">'+(ch.summaryHtml||"")+'</div>';
    }
    if(mode==="both" || mode==="detail"){
      parts += '<h3 class="print-subhead">Detailed notes</h3>';
      (ch.sections||[]).forEach(function(s){
        parts += '<h4 class="print-sec-h">'+esc(s.heading)+'</h4><div class="prose">'+s.html+'</div>';
      });
    }
    parts += '</div>';
    return parts;
  }).join("");

  var root = document.getElementById("printRoot");
  if(!root){
    root = document.createElement("div");
    root.id = "printRoot";
    document.body.appendChild(root);
  }
  root.innerHTML = '<div class="print-doc">'+cover+body+'</div>';
  attachDiagrams(root);

  document.body.classList.add("print-mode");
  function cleanup(){
    document.body.classList.remove("print-mode");
    window.removeEventListener("afterprint", cleanup);
  }
  window.addEventListener("afterprint", cleanup);
  setTimeout(function(){ window.print(); setTimeout(cleanup, 1500); }, 60);
}

/* ---------- full exam simulation ---------- */
var EXAM_SECONDS_PER_Q = 72; // ~1.2 min/question, matching Regulation (90min/75q) and Derivatives (120min/100q) pacing
function renderFullQuiz(examKey){
  renderSidebar(examKey, null);
  var exam = DATA[examKey];
  var all = [];
  exam.chapters.forEach(function(ch){ (ch.mcqs||[]).forEach(function(q,i){ all.push(Object.assign({}, q, { _chapter: ch.title, _chId: ch.id, _qid: ch.id+"::"+i })); }); });

  app.innerHTML = '<div class="quiz-shell">' +
    '<div class="chapter-head">' + backRow(exam.title) +
    '<div class="crumb"><a data-nav="home">Home</a> / <a data-nav="exam">'+esc(exam.title)+'</a> / Full exam simulation</div>' +
    '<h1>Full exam simulation</h1></div>' +
    '<div class="quiz-config">' +
      '<div>How many questions?</div>' +
      '<div class="opt-row" id="lenChips"></div>' +
      '<div>Timed?</div>' +
      '<div class="opt-row" id="timeChips"></div>' +
      '<button class="btn btn-primary" id="startFullQuiz" style="align-self:flex-start;">'+ICON.quiz+' Start</button>' +
    '</div></div>';

  wireBack(app, [examKey]);
  app.querySelector('[data-nav="home"]').onclick = function(){ navigate([]); };
  app.querySelector('[data-nav="exam"]').onclick = function(){ navigate([examKey]); };

  var options = [20, 40, all.length];
  var chosen = options[0];
  var timed = true;
  var chips = document.getElementById("lenChips");
  chips.innerHTML = options.map(function(n,i){
    return '<button class="chip '+(i===0?"active":"")+'" data-n="'+n+'">'+n+' questions</button>';
  }).join("");
  Array.prototype.forEach.call(chips.querySelectorAll(".chip"), function(c){
    c.onclick = function(){
      Array.prototype.forEach.call(chips.querySelectorAll(".chip"), function(x){x.classList.remove("active");});
      c.classList.add("active"); chosen = +c.getAttribute("data-n");
      updateTimeLabel();
    };
  });
  var timeChips = document.getElementById("timeChips");
  function timeLabel(n){ var s = n*EXAM_SECONDS_PER_Q; return "Timed ("+Math.round(s/60)+" min)"; }
  function renderTimeChips(){
    timeChips.innerHTML =
      '<button class="chip '+(timed?"active":"")+'" data-t="1">'+timeLabel(chosen)+'</button>' +
      '<button class="chip '+(!timed?"active":"")+'" data-t="0">Untimed</button>';
    Array.prototype.forEach.call(timeChips.querySelectorAll(".chip"), function(c){
      c.onclick = function(){ timed = c.getAttribute("data-t")==="1"; renderTimeChips(); };
    });
  }
  function updateTimeLabel(){ renderTimeChips(); }
  renderTimeChips();

  document.getElementById("startFullQuiz").onclick = function(){
    var set = shuffle(all).slice(0, chosen);
    var container = document.querySelector(".quiz-shell");
    runQuizUI(container, examKey, exam.title+" — Full simulation", set, function(pctScore, byChapter){
      Object.keys(byChapter).forEach(function(chId){
        var b = byChapter[chId];
        recordQuizResult(examKey, chId, pct(b.correct, b.total));
      });
    }, { isFullExam:true, timerSeconds: timed ? chosen*EXAM_SECONDS_PER_Q : null });
  };
}

/* ---------- CISI exam mode: official competency-test questions, randomly mixed across ALL chapters ---------- */
function renderCisiFullQuiz(examKey){
  renderSidebar(examKey, null);
  var exam = DATA[examKey];
  var all = [];
  exam.chapters.forEach(function(ch){
    (ch.cisiMcqs||[]).forEach(function(q,i){
      all.push(Object.assign({}, q, { _chapter: ch.title, _chId: ch.id, _qid: ch.id+"::cisi::"+i }));
    });
  });

  if(all.length===0){
    app.innerHTML = '<div class="quiz-shell"><div class="chapter-head">'+backRow(exam.title)+
      '<h1>CISI exam mode</h1></div><div class="empty-state">No CISI questions available for '+esc(exam.title)+' yet.</div></div>';
    wireBack(app, [examKey]);
    return;
  }

  app.innerHTML = '<div class="quiz-shell">' +
    '<div class="chapter-head">' + backRow(exam.title) +
    '<div class="crumb"><a data-nav="home">Home</a> / <a data-nav="exam">'+esc(exam.title)+'</a> / CISI exam mode</div>' +
    '<h1>CISI exam mode</h1><div class="fmt">Official CISI-style questions, randomly mixed across all '+exam.chapterCount+' chapters ('+all.length+' available).</div></div>' +
    '<div class="quiz-config">' +
      '<div>How many questions?</div>' +
      '<div class="qty-chips" id="lenChips"></div>' +
      '<div>Timed?</div>' +
      '<div class="opt-row" id="timeChips"></div>' +
      '<button class="btn btn-primary" id="startCisiQuiz" style="align-self:flex-start;">'+ICON.quiz+' Start</button>' +
    '</div></div>';

  wireBack(app, [examKey]);
  app.querySelector('[data-nav="home"]').onclick = function(){ navigate([]); };
  app.querySelector('[data-nav="exam"]').onclick = function(){ navigate([examKey]); };

  var options = [];
  for(var n=10; n<all.length; n+=10) options.push(n);
  options.push(all.length);
  var chosen = options[0];
  var timed = true;
  var chips = document.getElementById("lenChips");
  chips.innerHTML = options.map(function(n,i){
    return '<button class="chip qty-chip '+(i===0?"active":"")+'" data-n="'+n+'">'+n+(n===all.length?' (all)':'')+'</button>';
  }).join("");
  Array.prototype.forEach.call(chips.querySelectorAll(".chip"), function(c){
    c.onclick = function(){
      Array.prototype.forEach.call(chips.querySelectorAll(".chip"), function(x){x.classList.remove("active");});
      c.classList.add("active"); chosen = +c.getAttribute("data-n");
      updateTimeLabel();
    };
  });
  var timeChips = document.getElementById("timeChips");
  function timeLabel(n){ var s = n*EXAM_SECONDS_PER_Q; return "Timed ("+Math.round(s/60)+" min)"; }
  function renderTimeChips(){
    timeChips.innerHTML =
      '<button class="chip '+(timed?"active":"")+'" data-t="1">'+timeLabel(chosen)+'</button>' +
      '<button class="chip '+(!timed?"active":"")+'" data-t="0">Untimed</button>';
    Array.prototype.forEach.call(timeChips.querySelectorAll(".chip"), function(c){
      c.onclick = function(){ timed = c.getAttribute("data-t")==="1"; renderTimeChips(); };
    });
  }
  function updateTimeLabel(){ renderTimeChips(); }
  renderTimeChips();

  document.getElementById("startCisiQuiz").onclick = function(){
    var set = shuffle(all).slice(0, chosen);
    var container = document.querySelector(".quiz-shell");
    runQuizUI(container, examKey, exam.title+" — CISI exam mode", set, function(pctScore, byChapter){
      Object.keys(byChapter).forEach(function(chId){
        var b = byChapter[chId];
        recordQuizResult(examKey, chId+"_cisi", pct(b.correct, b.total));
      });
    }, { isFullExam:true, timerSeconds: timed ? chosen*EXAM_SECONDS_PER_Q : null });
  };
}

/* ---------- Mixed practice: every question, every source, deduped — the antidote to memorising one fixed paper ---------- */
function mixedPool(examKey){
  var exam = DATA[examKey];
  var seen = {};
  var all = [];
  function addQ(q, chId, src){
    var key = (q.question||"").trim().toLowerCase();
    if(seen[key]) return;
    seen[key] = true;
    all.push(Object.assign({}, q, { _chId: chId, _chapter: chapterTitle(examKey,chId), _qid: src+"::"+all.length }));
  }
  exam.chapters.forEach(function(ch){
    (ch.mcqs||[]).forEach(function(q){ addQ(q, ch.id, "practice"); });
    (ch.cisiMcqs||[]).forEach(function(q){ addQ(q, ch.id, "cisi"); });
  });
  (exam.mockExams||[]).forEach(function(m){
    m.mcqs.forEach(function(q){ addQ(q, q.chId, "mock"); });
  });
  return all;
}

function renderMixedPractice(examKey){
  renderSidebar(examKey, null);
  var exam = DATA[examKey];
  var all = mixedPool(examKey);

  if(all.length===0){
    app.innerHTML = '<div class="quiz-shell"><div class="chapter-head">'+backRow(exam.title)+
      '<h1>Mixed practice</h1></div><div class="empty-state">No questions available yet.</div></div>';
    wireBack(app, [examKey]);
    return;
  }

  app.innerHTML = '<div class="quiz-shell" id="mixedShell">' +
    '<div class="chapter-head">' + backRow(exam.title) +
    '<div class="crumb"><a data-nav="home">Home</a> / <a data-nav="exam">'+esc(exam.title)+'</a> / Mixed practice</div>' +
    '<h1>Mixed practice</h1><div class="fmt">Every question from the notes, the CISI bank and all mock papers, deduplicated ('+all.length+' unique questions) and shuffled — the best way to test real understanding rather than memorised papers.</div></div>' +
    '<div class="quiz-config">' +
      '<div>How many questions?</div>' +
      '<div class="qty-chips" id="lenChips"></div>' +
      '<div>Timed?</div>' +
      '<div class="opt-row" id="timeChips"></div>' +
      '<button class="btn btn-primary" id="startMixed" style="align-self:flex-start;">'+ICON.quiz+' Start</button>' +
    '</div></div>';

  wireBack(app, [examKey]);
  app.querySelector('[data-nav="home"]').onclick = function(){ navigate([]); };
  app.querySelector('[data-nav="exam"]').onclick = function(){ navigate([examKey]); };

  var options = [];
  for(var n=10; n<all.length; n+=10) options.push(n);
  options.push(all.length);
  var chosen = options[0];
  var timed = true;
  var chips = document.getElementById("lenChips");
  chips.innerHTML = options.map(function(n,i){
    return '<button class="chip qty-chip '+(i===0?"active":"")+'" data-n="'+n+'">'+n+(n===all.length?' (all)':'')+'</button>';
  }).join("");
  Array.prototype.forEach.call(chips.querySelectorAll(".chip"), function(c){
    c.onclick = function(){
      Array.prototype.forEach.call(chips.querySelectorAll(".chip"), function(x){x.classList.remove("active");});
      c.classList.add("active"); chosen = +c.getAttribute("data-n");
      renderTimeChips();
    };
  });
  var timeChips = document.getElementById("timeChips");
  function timeLabel(n){ var s = n*EXAM_SECONDS_PER_Q; return "Timed ("+Math.round(s/60)+" min)"; }
  function renderTimeChips(){
    timeChips.innerHTML =
      '<button class="chip '+(timed?"active":"")+'" data-t="1">'+timeLabel(chosen)+'</button>' +
      '<button class="chip '+(!timed?"active":"")+'" data-t="0">Untimed</button>';
    Array.prototype.forEach.call(timeChips.querySelectorAll(".chip"), function(c){
      c.onclick = function(){ timed = c.getAttribute("data-t")==="1"; renderTimeChips(); };
    });
  }
  renderTimeChips();

  document.getElementById("startMixed").onclick = function(){
    var set = shuffle(all).slice(0, chosen);
    var container = document.getElementById("mixedShell");
    runQuizUI(container, examKey, exam.title+" — Mixed practice", set, function(pctScore, byChapter){
      Object.keys(byChapter).forEach(function(chId){
        var b = byChapter[chId];
        recordQuizResult(examKey, chId+"_mixed", pct(b.correct, b.total));
      });
    }, { isFullExam:true, timerSeconds: timed ? chosen*EXAM_SECONDS_PER_Q : null });
  };
}

/* ---------- Challenge Exam: draws from the original Practice Bank, weighted toward your weakest chapters ---------- */
function renderChallengeExam(examKey){
  renderSidebar(examKey, null);
  var exam = DATA[examKey];
  var chaptersWithBank = exam.chapters.filter(function(ch){ return ch.practiceBank && ch.practiceBank.length; });
  var totalAvailable = chaptersWithBank.reduce(function(s,ch){ return s+ch.practiceBank.length; }, 0);

  if(chaptersWithBank.length===0){
    app.innerHTML = '<div class="main-narrow"><div class="chapter-head">'+backRow(exam.title)+
      '<h1>Challenge Exam</h1></div><div class="empty-state">No practice bank questions available yet.</div></div>';
    wireBack(app, [examKey]);
    return;
  }

  var lastKnownScores = { "reg-ch1":41, "reg-ch2":71, "reg-ch3":57, "reg-ch4":55 };
  var scoreRowsHtml = chaptersWithBank.map(function(ch){
    var defScore = lastKnownScores[ch.id] != null ? lastKnownScores[ch.id] : 60;
    return '<div class="challenge-score-row">' +
      '<span class="challenge-ch-name">'+esc(ch.title)+'</span>' +
      '<input type="number" class="challenge-score-input" id="score-'+esc(ch.id)+'" min="0" max="100" value="'+defScore+'" />' +
      '<span class="challenge-pct-sign">%</span>' +
    '</div>';
  }).join("");

  app.innerHTML = '<div class="main-narrow" id="challengeShell">' +
    '<div class="chapter-head">' + backRow(exam.title) +
    '<div class="crumb"><a data-nav="home">Home</a> / <a data-nav="exam">'+esc(exam.title)+'</a> / Challenge Exam</div>' +
    '<h1>Challenge Exam</h1><div class="fmt">Original questions from the Practice Bank ('+totalAvailable+' available), automatically weighted so your weaker chapters get more questions. Enter your latest score per chapter below — lower score, more questions from that chapter.</div>' +
    '</div>' +
    '<div class="quiz-config">' +
      '<div class="challenge-scores">'+scoreRowsHtml+'</div>' +
      '<div>How many questions in total?</div>' +
      '<div class="qty-chips" id="lenChips"></div>' +
      '<div>Timed?</div>' +
      '<div class="opt-row" id="timeChips"></div>' +
      '<button class="btn btn-challenge" id="startChallenge" style="align-self:flex-start;">'+ICON.target+' Start Challenge</button>' +
    '</div></div>';

  wireBack(app, [examKey]);
  app.querySelector('[data-nav="home"]').onclick = function(){ navigate([]); };
  app.querySelector('[data-nav="exam"]').onclick = function(){ navigate([examKey]); };

  var options = [];
  for(var n=10; n<totalAvailable; n+=10) options.push(n);
  options.push(totalAvailable);
  var chosen = options[0];
  var timed = true;
  var chips = document.getElementById("lenChips");
  chips.innerHTML = options.map(function(n,i){
    return '<button class="chip qty-chip '+(i===0?"active":"")+'" data-n="'+n+'">'+n+(n===totalAvailable?' (all)':'')+'</button>';
  }).join("");
  Array.prototype.forEach.call(chips.querySelectorAll(".chip"), function(c){
    c.onclick = function(){
      Array.prototype.forEach.call(chips.querySelectorAll(".chip"), function(x){x.classList.remove("active");});
      c.classList.add("active"); chosen = +c.getAttribute("data-n");
      renderTimeChips();
    };
  });
  var timeChips = document.getElementById("timeChips");
  function timeLabel(n){ var s = n*EXAM_SECONDS_PER_Q; return "Timed ("+Math.round(s/60)+" min)"; }
  function renderTimeChips(){
    timeChips.innerHTML =
      '<button class="chip '+(timed?"active":"")+'" data-t="1">'+timeLabel(chosen)+'</button>' +
      '<button class="chip '+(!timed?"active":"")+'" data-t="0">Untimed</button>';
    Array.prototype.forEach.call(timeChips.querySelectorAll(".chip"), function(c){
      c.onclick = function(){ timed = c.getAttribute("data-t")==="1"; renderTimeChips(); };
    });
  }
  renderTimeChips();

  document.getElementById("startChallenge").onclick = function(){
    var weights = {};
    var totalWeight = 0;
    chaptersWithBank.forEach(function(ch){
      var scoreInput = document.getElementById("score-"+ch.id);
      var score = Math.max(0, Math.min(100, +scoreInput.value || 60));
      var w = Math.max(8, 100 - score);
      weights[ch.id] = w;
      totalWeight += w;
    });
    var pool = [];
    chaptersWithBank.forEach(function(ch){
      var share = Math.round((weights[ch.id] / totalWeight) * chosen);
      share = Math.min(share, ch.practiceBank.length);
      var picked = shuffle(ch.practiceBank).slice(0, share).map(function(q,i){
        return Object.assign({}, q, { _qid: ch.id+"::challenge::"+i, _chId: ch.id, _chapter: ch.title });
      });
      pool = pool.concat(picked);
    });
    if(pool.length < chosen){
      var used = {};
      pool.forEach(function(q){ used[q._qid]=true; });
      var leftoverPool = [];
      chaptersWithBank.forEach(function(ch){
        ch.practiceBank.forEach(function(q,i){
          var qid = ch.id+"::challenge::"+i;
          if(!used[qid]) leftoverPool.push(Object.assign({}, q, { _qid: qid, _chId: ch.id, _chapter: ch.title }));
        });
      });
      pool = pool.concat(shuffle(leftoverPool).slice(0, chosen-pool.length));
    }
    var set = shuffle(pool).slice(0, chosen);
    var container = document.getElementById("challengeShell");
    runQuizUI(container, examKey, exam.title+" — Challenge Exam", set, function(pctScore, byChapter){
      Object.keys(byChapter).forEach(function(chId){
        var b = byChapter[chId];
        recordQuizResult(examKey, chId+"_challenge", pct(b.correct, b.total));
      });
    }, { isFullExam:true, timerSeconds: timed ? chosen*EXAM_SECONDS_PER_Q : null });
  };
}


function mockBestScore(examKey, mockId){
  var list = ensureMockAttempts(examKey, mockId);
  if(list.length===0) return null;
  var best = list[0].pct;
  list.forEach(function(a){ if(a.pct>best) best=a.pct; });
  return best;
}
function fmtAttemptDate(iso){
  try{
    var d = new Date(iso);
    return d.toLocaleDateString(undefined,{day:"numeric",month:"short",year:"numeric"}) + " · " + d.toLocaleTimeString(undefined,{hour:"2-digit",minute:"2-digit"});
  }catch(e){ return ""; }
}

function renderMockExamsList(examKey){
  renderSidebar(examKey, null);
  var exam = DATA[examKey];
  var mocks = exam.mockExams || [];

  var cardsHtml = mocks.map(function(m){
    var best = mockBestScore(examKey, m.id);
    var n = ensureMockAttempts(examKey, m.id).length;
    return '<div class="mock-card" data-mock="'+esc(m.id)+'">' +
      '<div class="mock-card-top"><span class="mock-title">'+esc(m.title)+'</span>' +
        (best!==null ? '<span class="mock-best">Best: '+best+'%</span>' : '') +
      '</div>' +
      '<div class="mock-meta">'+m.mcqs.length+' questions · full-length paper'+(n>0?' · '+n+' attempt'+(n>1?'s':'')+' so far':'')+'</div>' +
      '<button class="btn btn-primary btn-sm">'+ICON.quiz+' '+(n>0?"View / retake":"Start")+'</button>' +
    '</div>';
  }).join("");

  app.innerHTML = '<div class="main-narrow">' +
    '<div class="chapter-head">' + backRow(exam.title) +
    '<div class="crumb"><a data-nav="home">Home</a> / <a data-nav="exam">'+esc(exam.title)+'</a> / Mock exams</div>' +
    '<h1>Mock exams</h1><div class="fmt">Full-length past papers, sat as one block — the closest thing to the real exam.</div></div>' +
    '<div class="mock-grid">'+cardsHtml+'</div>' +
    '</div>';

  wireBack(app, [examKey]);
  app.querySelector('[data-nav="home"]').onclick = function(){ navigate([]); };
  app.querySelector('[data-nav="exam"]').onclick = function(){ navigate([examKey]); };
  Array.prototype.forEach.call(app.querySelectorAll(".mock-card"), function(el){
    el.onclick = function(){ navigate([examKey, "_mocks", el.getAttribute("data-mock")]); };
  });
}

function renderMockExamRunner(examKey, mockId){
  renderSidebar(examKey, null);
  var exam = DATA[examKey];
  var mock = (exam.mockExams||[]).find(function(m){ return m.id===mockId; });
  if(!mock){ renderMockExamsList(examKey); return; }

  var seconds = mock.mcqs.length * EXAM_SECONDS_PER_Q;
  var minutes = Math.round(seconds/60);
  var attempts = ensureMockAttempts(examKey, mock.id);

  var historyHtml = "";
  if(attempts.length>0){
    var firstAttempt = attempts[attempts.length-1]; // list is unshifted, so oldest = last
    var latestAttempt = attempts[0];
    var jump = latestAttempt.pct - firstAttempt.pct;
    var memoWarning = "";
    if(attempts.length>=2 && jump>=15){
      memoWarning = '<div class="memo-warning">' + ICON.target +
        ' Your score jumped '+jump+' points since your first go at this paper ('+firstAttempt.pct+'% &rarr; '+latestAttempt.pct+'%). ' +
        'That can be real progress — but it can also mean you\'re starting to recognise these exact questions rather than the underlying rules. ' +
        'Your <b>first-attempt score is the more honest signal</b> of where you actually stand. ' +
        'For broader, less repetitive practice, try <a data-nav="mixed">Mixed practice</a> — it pools every question across the whole subject so you rarely see the same one twice.' +
      '</div>';
    }
    historyHtml = memoWarning +
      '<div class="mock-history">' +
        '<div class="mock-history-title">Your past attempts (nothing is lost — every attempt is kept)</div>' +
        attempts.map(function(a){
          var isFirst = a.id === firstAttempt.id;
          return '<button class="mock-attempt-row" data-attempt="'+esc(a.id)+'">' +
            '<span class="mock-attempt-date">'+(isFirst?'<span class="attempt-badge">First attempt</span> ':'')+esc(fmtAttemptDate(a.date))+'</span>' +
            '<span class="mock-attempt-score '+(a.pct>=70?"good":"bad")+'-text">'+a.correct+'/'+a.total+' ('+a.pct+'%)</span>' +
            '<span class="mock-attempt-arrow">'+ICON.chevron+'</span>' +
          '</button>';
        }).join("") +
      '</div>';
  }

  app.innerHTML = '<div class="main-narrow" id="mockShell">' +
    '<div class="chapter-head">' + backRow("Mock exams") +
    '<div class="crumb"><a data-nav="home">Home</a> / <a data-nav="exam">'+esc(exam.title)+'</a> / <a data-nav="mocks">Mock exams</a> / '+esc(mock.title)+'</div>' +
    '<h1>'+esc(mock.title)+'</h1></div>' +
    '<div class="quiz-config">' +
      '<div class="mock-brief">'+mock.mcqs.length+' questions &middot; '+minutes+' minutes &middot; timed, exam conditions</div>' +
      '<button class="btn btn-primary" id="startMock" style="align-self:flex-start;">'+ICON.quiz+' Start a new attempt</button>' +
    '</div>' +
    historyHtml +
  '</div>';

  wireBack(app, [examKey, "_mocks"]);
  app.querySelector('[data-nav="home"]').onclick = function(){ navigate([]); };
  app.querySelector('[data-nav="exam"]').onclick = function(){ navigate([examKey]); };
  app.querySelector('[data-nav="mocks"]').onclick = function(){ navigate([examKey, "_mocks"]); };
  Array.prototype.forEach.call(app.querySelectorAll(".mock-attempt-row"), function(el){
    el.onclick = function(){ navigate([examKey, "_mocks", mock.id, el.getAttribute("data-attempt")]); };
  });
  var mixedLink = app.querySelector('[data-nav="mixed"]');
  if(mixedLink) mixedLink.onclick = function(){ navigate([examKey, "_mixed"]); };

  document.getElementById("startMock").onclick = function(){
    var tagged = mock.mcqs.map(function(q,i){ return Object.assign({}, q, { _qid: mock.id+"::"+i, _chId: q.chId || null, _chapter: mock.title, _qIndex:i }); });
    var container = document.getElementById("mockShell");
    runQuizUI(container, examKey, mock.title, tagged, function(pctScore, byChapter, answeredMap){
      var answers = [];
      Object.keys(answeredMap).forEach(function(k){
        answers.push({ i:+k, chosen:answeredMap[k].chosen, correct:answeredMap[k].correct });
      });
      answers.sort(function(a,b){ return a.i-b.i; });
      var correctN = answers.filter(function(a){ return a.correct; }).length;
      recordMockAttempt(examKey, mock.id, {
        id: String(Date.now()),
        date: new Date().toISOString(),
        pct: pctScore,
        correct: correctN,
        total: mock.mcqs.length,
        byChapter: byChapter,
        answers: answers
      });
    }, { isFullExam:true, timerSeconds: seconds });
  };
}

function renderMockAttemptReview(examKey, mockId, attemptId){
  renderSidebar(examKey, null);
  var exam = DATA[examKey];
  var mock = (exam.mockExams||[]).find(function(m){ return m.id===mockId; });
  var attempt = mock ? getMockAttempt(examKey, mockId, attemptId) : null;
  if(!mock || !attempt){ renderMockExamRunner(examKey, mockId); return; }

  var answersByIndex = {};
  attempt.answers.forEach(function(a){ answersByIndex[a.i] = a; });

  var breakdownHtml = '<div class="breakdown">' + Object.keys(attempt.byChapter).map(function(chId){
    var b = attempt.byChapter[chId];
    var chPct = pct(b.correct,b.total);
    return '<div class="breakdown-row"><span>'+esc(chapterTitle(examKey,chId))+'</span><span class="'+(chPct>=70?"good":"bad")+'-text">'+b.correct+'/'+b.total+' ('+chPct+'%)</span></div>';
  }).join("") + '</div>';

  var letters = ["A","B","C","D","E","F"];
  var questionsHtml = mock.mcqs.map(function(q, i){
    var a = answersByIndex[i];
    var optsHtml = q.options.map(function(o,oi){
      var cls = "q-opt disabled";
      if(oi===q.correctIndex) cls += " correct";
      else if(a && oi===a.chosen) cls += " incorrect";
      else cls += " dim";
      return '<button class="'+cls+'" disabled><span class="letter">'+letters[oi]+'</span><span>'+esc(o)+'</span></button>';
    }).join("");
    var statusChip = !a ? '<span class="review-chip skipped">Not answered</span>' : a.correct ? '<span class="review-chip good">Correct</span>' : '<span class="review-chip bad">Incorrect</span>';
    return '<div class="review-card">' +
      '<div class="review-card-head"><span class="review-qnum">Q'+(i+1)+'</span>'+statusChip+(q.chId?'<span class="q-chaptertag" style="margin:0;">'+esc(chapterTitle(examKey,q.chId))+'</span>':'')+'</div>' +
      '<div class="q-text">'+esc(q.question)+'</div>' +
      '<div class="q-opts">'+optsHtml+'</div>' +
      '<div class="explain-box"><b>'+(a ? (a.correct?"Correct. ":"Not quite. ") : "Skipped. ")+'</b>'+esc(q.explanation||"")+'</div>' +
    '</div>';
  }).join("");

  app.innerHTML = '<div class="main-narrow">' +
    '<div class="chapter-head">' + backRow(mock.title) +
    '<div class="crumb"><a data-nav="home">Home</a> / <a data-nav="exam">'+esc(exam.title)+'</a> / <a data-nav="mocks">Mock exams</a> / <a data-nav="mock">'+esc(mock.title)+'</a> / Review</div>' +
    '<h1>'+esc(mock.title)+' — '+esc(fmtAttemptDate(attempt.date))+'</h1>' +
    '<div class="fmt">'+attempt.correct+'/'+attempt.total+' correct ('+attempt.pct+'%). Scroll down to review every question.</div>' +
    '</div>' +
    breakdownHtml +
    '<div class="review-list">'+questionsHtml+'</div>' +
  '</div>';

  wireBack(app, [examKey, "_mocks", mockId]);
  app.querySelector('[data-nav="home"]').onclick = function(){ navigate([]); };
  app.querySelector('[data-nav="exam"]').onclick = function(){ navigate([examKey]); };
  app.querySelector('[data-nav="mocks"]').onclick = function(){ navigate([examKey, "_mocks"]); };
  app.querySelector('[data-nav="mock"]').onclick = function(){ navigate([examKey, "_mocks", mockId]); };
}

/* ---------- generic quiz runner ---------- */
function stopActiveTimer(){
  if(window.__cisiTimerInterval){ clearInterval(window.__cisiTimerInterval); window.__cisiTimerInterval = null; }
}
function stopActiveQuizKeys(){
  if(window.__cisiQuizKeyHandler){ document.removeEventListener("keydown", window.__cisiQuizKeyHandler); window.__cisiQuizKeyHandler = null; }
}
function fmtClock(sec){
  sec = Math.max(0, Math.round(sec));
  var m = Math.floor(sec/60), s = sec%60;
  return m+":"+(s<10?"0":"")+s;
}

function chapterTitle(examKey, chId){
  var ch = DATA[examKey] && DATA[examKey].chapters.find(function(c){ return c.id===chId; });
  return ch ? ch.title : chId;
}

function runQuizUI(container, examKey, label, questions, onFinish, opts){
  opts = opts || {};
  questions = questions.map(shuffleOptions);
  stopActiveTimer(); stopActiveQuizKeys();
  var idx = 0, correctCount = 0;
  var byChapter = {}; // chId -> {correct,total}
  var wrongOnes = [];
  var timeLeft = opts.timerSeconds || null;
  var timerStarted = false;
  var timedOut = false;
  var letters = ["A","B","C","D","E","F"];
  var answeredMap = {}; // idx -> {chosen, correct}
  var showNav = !!opts.isFullExam;

  function timerHtml(){
    if(timeLeft===null) return "";
    var low = timeLeft <= 60;
    return '<div class="quiz-timer'+(low?' low':'')+'" id="quizTimer" style="margin-left:10px;font-weight:700;font-size:12.5px;color:'+(low?'var(--red)':'var(--text-faint)')+';white-space:nowrap;">&#9202; '+fmtClock(timeLeft)+'</div>';
  }
  function startTimer(){
    if(timeLeft===null || timerStarted) return;
    timerStarted = true;
    stopActiveTimer();
    window.__cisiTimerInterval = setInterval(function(){
      timeLeft--;
      var el = document.getElementById("quizTimer");
      if(el){ el.innerHTML = '&#9202; '+fmtClock(timeLeft); el.style.color = timeLeft<=60 ? "var(--red)" : "var(--text-faint)"; }
      if(timeLeft<=0){
        stopActiveTimer();
        timedOut = true;
        renderResult();
      }
    }, 1000);
  }

  function liveGaugeHtml(){
    var answeredCount = Object.keys(answeredMap).length;
    if(answeredCount===0) return '<div class="live-gauge neutral" id="liveGauge">— %</div>';
    var livePct = pct(correctCount, answeredCount);
    return '<div class="live-gauge '+(livePct>=70?"good":"bad")+'" id="liveGauge">'+livePct+'%</div>';
  }

  function sidebarHtml(){
    if(!showNav) return "";
    var btns = questions.map(function(q,i){
      var cls = "qnav-btn";
      if(i===idx) cls += " current";
      var a = answeredMap[i];
      if(a) cls += a.correct ? " correct" : " incorrect";
      return '<button class="'+cls+'" data-i="'+i+'">'+(i+1)+'</button>';
    }).join("");
    return '<div class="quiz-sidenav">' +
      '<div class="qnav-title">Questions ('+Object.keys(answeredMap).length+'/'+questions.length+' answered)</div>' +
      '<div class="qnav-grid">'+btns+'</div>' +
      '<div class="qnav-legend"><span class="dot correct"></span>Correct<span class="dot incorrect"></span>Wrong<span class="dot"></span>Unanswered</div>' +
      '<button class="btn btn-primary btn-sm" id="finishNowBtn" style="width:100%;margin-top:12px;">'+ICON.check+' Finish now</button>' +
    '</div>';
  }

  function gotoQuestion(i){ idx = i; renderQ(); }

  function renderQ(){
    var q = questions[idx];
    var isReview = !!answeredMap[idx];
    var barPct = Math.round(Object.keys(answeredMap).length/questions.length*100);
    var chapterTagHtml = (showNav && q._chId) ? '<div class="q-chaptertag">Chapter: '+esc(chapterTitle(examKey,q._chId))+'</div>' : "";

    var mainHtml =
      '<div class="quiz-main">' +
        '<div class="quiz-progress"><div class="bar"><div style="width:'+barPct+'%"></div></div><div class="count">Question '+(idx+1)+' / '+questions.length+'</div>'+liveGaugeHtml()+timerHtml()+'</div>' +
        '<div class="q-card">' +
          '<div class="q-text">'+esc(q.question)+'</div>' +
          '<div class="q-opts" id="qOpts">' +
            q.options.map(function(o,i2){
              var cls = "q-opt";
              if(isReview){
                cls += " disabled";
                if(i2===q.correctIndex) cls += " correct";
                else if(i2===answeredMap[idx].chosen) cls += " incorrect";
                else cls += " dim";
              }
              return '<button class="'+cls+'" data-i="'+i2+'"><span class="letter">'+letters[i2]+'</span><span>'+esc(o)+'</span></button>';
            }).join("") +
          '</div>' +
          '<div id="explainWrap">'+(isReview ? '<div class="explain-box"><b>'+(answeredMap[idx].correct?"Correct. ":"Not quite. ")+'</b>'+esc(q.explanation||"")+'</div>' : "")+'</div>' +
          chapterTagHtml +
          '<div class="q-actions">' +
            (showNav ? '<button class="btn btn-sm" id="prevBtn" '+(idx===0?"disabled":"")+'>&larr; Prev</button>' : '<span class="kbd-hint" style="font-size:11.5px;color:var(--text-faint);">Keys 1-'+q.options.length+' to answer &middot; Enter for next</span>') +
            '<button class="btn btn-primary" id="nextBtn" style="display:'+(isReview?"inline-flex":"none")+';">'+(idx===questions.length-1?"See results":"Next question")+' '+ICON.chevron+'</button>' +
          '</div>' +
        '</div>' +
      '</div>';

    container.innerHTML = showNav ? ('<div class="quiz-layout">'+mainHtml+sidebarHtml()+'</div>') : mainHtml;
    startTimer();

    function selectOption(i){
      if(answeredMap[idx]) return;
      var correct = q.correctIndex;
      var isCorrect = i===correct;
      answeredMap[idx] = { chosen:i, correct:isCorrect };
      if(isCorrect) correctCount++; else wrongOnes.push(q);
      if(q._qid) markWeak(examKey, q._qid, !isCorrect);
      if(opts.isFullExam){
        var chId = q._chId;
        if(!byChapter[chId]) byChapter[chId] = {correct:0,total:0};
        byChapter[chId].total++;
        if(isCorrect) byChapter[chId].correct++;
      }
      renderQ();
    }

    if(!isReview){
      Array.prototype.forEach.call(container.querySelectorAll(".q-opt"), function(btn){
        btn.onclick = function(){ selectOption(+btn.getAttribute("data-i")); };
      });
    }
    var prevBtn = document.getElementById("prevBtn");
    if(prevBtn) prevBtn.onclick = function(){ if(idx>0) gotoQuestion(idx-1); };
    document.getElementById("nextBtn").onclick = function(){
      idx++;
      if(idx >= questions.length){ stopActiveTimer(); renderResult(); }
      else renderQ();
    };
    if(showNav){
      Array.prototype.forEach.call(container.querySelectorAll(".qnav-btn"), function(btn){
        btn.onclick = function(){ gotoQuestion(+btn.getAttribute("data-i")); };
      });
      var finishBtn = document.getElementById("finishNowBtn");
      if(finishBtn) finishBtn.onclick = function(){ stopActiveTimer(); renderResult(); };
    }

    window.__cisiQuizKeyHandler = function(e){
      if(e.metaKey||e.ctrlKey||e.altKey) return;
      var key = e.key;
      if(!isReview){
        var n = parseInt(key,10);
        if(n>=1 && n<=q.options.length){ e.preventDefault(); selectOption(n-1); return; }
        var letterIdx = letters.indexOf((key||"").toUpperCase());
        if(letterIdx>=0 && letterIdx<q.options.length){ e.preventDefault(); selectOption(letterIdx); return; }
      } else if(key==="Enter" || key===" "){
        e.preventDefault();
        document.getElementById("nextBtn").click();
      }
    };
    document.addEventListener("keydown", window.__cisiQuizKeyHandler);
  }

  function renderResult(){
    stopActiveTimer(); stopActiveQuizKeys();
    var answeredCount = correctCount + wrongOnes.length;
    var p = pct(correctCount, questions.length);
    var breakdownHtml = "", improveHtml = "";
    if(opts.isFullExam){
      var chIds = Object.keys(byChapter);
      breakdownHtml = '<div class="breakdown">' + chIds.map(function(chId){
        var b = byChapter[chId];
        var chPct = pct(b.correct,b.total);
        return '<div class="breakdown-row"><span>'+esc(chapterTitle(examKey,chId))+'</span><span class="'+(chPct>=70?"good":"bad")+'-text">'+b.correct+'/'+b.total+' ('+chPct+'%)</span></div>';
      }).join("") + '</div>';

      var weak = chIds.map(function(chId){ return { chId:chId, p:pct(byChapter[chId].correct,byChapter[chId].total) }; })
        .filter(function(w){ return w.p < 70; })
        .sort(function(a,b){ return a.p-b.p; });
      if(weak.length>0){
        improveHtml = '<div class="improve-box">' +
          '<div class="improve-title">Points à retravailler</div>' +
          weak.map(function(w){
            return '<button class="improve-row" data-ch="'+esc(w.chId)+'">'+esc(chapterTitle(examKey,w.chId))+' — '+w.p+'% <span>'+ICON.chevron+'</span></button>';
          }).join("") +
        '</div>';
      }
    }
    var timeoutNote = timedOut ? '<div style="color:var(--red);font-size:12.5px;margin-top:8px;">&#9202; Time\'s up — '+(questions.length-answeredCount)+' question(s) left unanswered, counted as incorrect.</div>' : "";
    container.innerHTML =
      '<div class="quiz-result">' +
        '<div class="score-circle" style="--pct:'+p+'"><div class="inner"><div class="pctnum">'+p+'%</div><div class="pctlbl">SCORE</div></div></div>' +
        '<h2>'+(p>=80?"Excellent work.":p>=60?"Good progress.":"Keep drilling this one.")+'</h2>' +
        '<div style="color:var(--text-faint);font-size:13.5px;">'+correctCount+' correct out of '+questions.length+' — '+esc(label)+'</div>' +
        timeoutNote +
        breakdownHtml +
        improveHtml +
        '<div class="result-actions">' +
          (wrongOnes.length>0 ? '<button class="btn btn-primary" id="mistakesBtn">'+ICON.target+' Redo '+wrongOnes.length+' mistake'+(wrongOnes.length>1?'s':'')+' only</button>' : '') +
          '<button class="btn" id="retryBtn">'+ICON.refresh+' Try again</button>' +
          '<button class="btn" id="backBtn">'+ICON.home+' Back</button>' +
        '</div>' +
      '</div>';
    onFinish(p, byChapter, answeredMap);
    document.getElementById("retryBtn").onclick = function(){
      idx=0; correctCount=0; byChapter={}; wrongOnes=[]; timedOut=false; timeLeft = opts.timerSeconds || null; timerStarted=false; answeredMap={};
      questions = shuffle(questions).map(shuffleOptions); renderQ();
    };
    var mb = document.getElementById("mistakesBtn");
    if(mb) mb.onclick = function(){
      var mistakes = wrongOnes.slice();
      runQuizUI(container, examKey, label+" — mistakes only", mistakes, function(){}, { isFullExam:false });
    };
    document.getElementById("backBtn").onclick = function(){ history.back(); };
    Array.prototype.forEach.call(container.querySelectorAll(".improve-row"), function(btn){
      btn.onclick = function(){ navigate([examKey, btn.getAttribute("data-ch"), "summary"]); };
    });
  }

  renderQ();
}

/* ---------- flashcards (chapter / all / glossary) — 3-tier priority queue: bad/medium cards resurface more often ---------- */
function renderFlashcardsTab(content, examKey, chapter){
  var cards = (chapter.flashcards||[]).map(function(fc, i){ return Object.assign({}, fc, { _id: examKey+":"+chapter.id+":"+i }); });
  runFlashcardUI(content, examKey, chapter.title, cards);
}
function renderAllFlashcards(examKey){
  renderSidebar(examKey, null);
  var exam = DATA[examKey];
  var cards = [];
  exam.chapters.forEach(function(ch){
    (ch.flashcards||[]).forEach(function(fc,i){ cards.push(Object.assign({}, fc, { _id: examKey+":"+ch.id+":"+i, _chapter: ch.title })); });
  });
  app.innerHTML = '<div class="chapter-head">' + backRow(exam.title) + '<div class="crumb"><a data-nav="home">Home</a> / <a data-nav="exam">'+esc(exam.title)+'</a> / All flashcards</div><h1>All flashcards</h1><div class="fmt">Every flashcard across every chapter, in one deck. Cards you rate Bad or Medium come back around more often.</div></div><div id="fcRoot"></div>';
  wireBack(app, [examKey]);
  app.querySelector('[data-nav="home"]').onclick = function(){ navigate([]); };
  app.querySelector('[data-nav="exam"]').onclick = function(){ navigate([examKey]); };
  runFlashcardUI(document.getElementById("fcRoot"), examKey, exam.title+" — all chapters", cards);
}
function renderGlossaryFlashcards(examKey){
  renderSidebar(examKey, null);
  var exam = DATA[examKey];
  var terms = exam.glossaryFlashcards || [];
  var cards = terms.map(function(fc,i){ return Object.assign({}, fc, { _id: examKey+":glossary:"+i }); });
  app.innerHTML = '<div class="chapter-head">' + backRow(exam.title) + '<div class="crumb"><a data-nav="home">Home</a> / <a data-nav="exam">'+esc(exam.title)+'</a> / <a data-nav="glossary">Glossary</a> / Flashcards</div><h1>Glossary flashcards</h1><div class="fmt">'+cards.length+' key terms — see the term, try to recall the definition before flipping.</div></div><div id="fcRoot"></div>';
  wireBack(app, [examKey, "_glossary"]);
  app.querySelector('[data-nav="home"]').onclick = function(){ navigate([]); };
  app.querySelector('[data-nav="exam"]').onclick = function(){ navigate([examKey]); };
  app.querySelector('[data-nav="glossary"]').onclick = function(){ navigate([examKey, "_glossary"]); };
  runFlashcardUI(document.getElementById("fcRoot"), examKey, exam.title+" — glossary", cards);
}

/* ---------- regulatory bodies directory: scope, powers, traps, and how they link to each other ---------- */
function renderRegulators(examKey){
  renderSidebar(examKey, null);
  var exam = DATA[examKey];
  var regs = exam.regulators || [];
  if(regs.length===0){
    app.innerHTML = '<div class="main-narrow"><div class="chapter-head">' + backRow(exam.title) +
      '<h1>Regulatory bodies</h1></div><div class="empty-state">Not available yet for '+esc(exam.title)+'.</div></div>';
    wireBack(app, [examKey]);
    return;
  }
  var byId = {}; regs.forEach(function(r){ byId[r.id]=r; });

  function regCardHtml(r){
    var powers = (r.powers||[]).map(function(p){ return '<li>'+esc(p)+'</li>'; }).join("");
    var traps = (r.traps||[]).map(function(t){ return '<li>'+esc(t)+'</li>'; }).join("");
    var related = (r.related||[]).map(function(rid){
      var rr = byId[rid];
      return rr ? '<button class="reg-chip" data-goto="'+esc(rid)+'">'+esc(rr.name)+'</button>' : "";
    }).join("");
    return '<div class="reg-card" id="reg-'+esc(r.id)+'" data-search="'+esc((r.name+" "+r.scope+" "+(r.traps||[]).join(" ")).toLowerCase())+'">' +
      '<div class="reg-card-head"><span class="reg-name">'+esc(r.name)+'</span><span class="reg-cat">'+esc(r.category)+'</span></div>' +
      '<div class="reg-scope">'+esc(r.scope)+'</div>' +
      (r.accountability ? '<div class="reg-accountability"><b>Accountable to:</b> '+esc(r.accountability)+'</div>' : "") +
      (powers ? '<div class="reg-section-label">Key powers</div><ul class="reg-list">'+powers+'</ul>' : "") +
      (traps ? '<div class="reg-section-label trap">'+ICON.target+' Watch out for</div><ul class="reg-list trap-list">'+traps+'</ul>' : "") +
      (related ? '<div class="reg-section-label">Linked to</div><div class="reg-chips">'+related+'</div>' : "") +
    '</div>';
  }

  app.innerHTML = '<div class="main-narrow">' +
    '<div class="chapter-head">' + backRow(exam.title) +
    '<div class="crumb"><a data-nav="home">Home</a> / <a data-nav="exam">'+esc(exam.title)+'</a> / Regulatory bodies</div>' +
    '<h1>Regulatory bodies</h1><div class="fmt">'+regs.length+' authorities and roles across the whole subject — what each one does, who it answers to, and the traps examiners love. Click a linked body to jump straight to it.</div>' +
    '</div>' +
    '<div class="gloss-toolbar"><div class="search-box gloss-search">'+ICON.search+'<input type="text" id="regSearch" placeholder="Search authorities…" autocomplete="off"/></div></div>' +
    '<div class="reg-grid" id="regGrid">' + regs.map(regCardHtml).join("") + '</div>' +
    '<div class="empty-state" id="regEmpty" style="display:none;">No authorities match your search.</div>' +
  '</div>';

  wireBack(app, [examKey]);
  app.querySelector('[data-nav="home"]').onclick = function(){ navigate([]); };
  app.querySelector('[data-nav="exam"]').onclick = function(){ navigate([examKey]); };

  var input = document.getElementById("regSearch");
  var cardEls = Array.prototype.slice.call(document.querySelectorAll(".reg-card"));
  var emptyMsg = document.getElementById("regEmpty");
  input.oninput = function(){
    var q = input.value.trim().toLowerCase();
    var shown = 0;
    cardEls.forEach(function(c){
      var match = !q || c.getAttribute("data-search").indexOf(q)!==-1;
      c.style.display = match ? "" : "none";
      if(match) shown++;
    });
    emptyMsg.style.display = shown===0 ? "" : "none";
  };
  Array.prototype.forEach.call(document.querySelectorAll(".reg-chip"), function(btn){
    btn.onclick = function(){
      var target = document.getElementById("reg-"+btn.getAttribute("data-goto"));
      if(!target) return;
      input.value = ""; input.oninput();
      target.scrollIntoView({behavior:"smooth", block:"center"});
      target.classList.add("reg-flash");
      setTimeout(function(){ target.classList.remove("reg-flash"); }, 1400);
    };
  });
}

/* ---------- client rules directory: who gets which protection, who can request what, by client type ---------- */
function renderClientRules(examKey){
  renderSidebar(examKey, null);
  var exam = DATA[examKey];
  var rules = exam.clientRules || [];
  if(rules.length===0){
    app.innerHTML = '<div class="main-narrow"><div class="chapter-head">' + backRow(exam.title) +
      '<h1>Who gets what</h1></div><div class="empty-state">Not available yet for '+esc(exam.title)+'.</div></div>';
    wireBack(app, [examKey]);
    return;
  }
  var typeLabel = { retail:"Retail", professional:"Professional", ecp:"Eligible counterparty" };

  function ruleCardHtml(r){
    var badges = (r.appliesTo||[]).map(function(t){ return '<span class="ct-badge ct-'+t+'">'+typeLabel[t]+'</span>'; }).join("");
    var traps = (r.traps||[]).map(function(t){ return '<li>'+esc(t)+'</li>'; }).join("");
    return '<div class="reg-card ct-card" data-types="'+(r.appliesTo||[]).join(",")+'" data-search="'+esc((r.name+" "+r.detail+" "+(r.traps||[]).join(" ")).toLowerCase())+'">' +
      '<div class="reg-card-head"><span class="reg-name">'+esc(r.name)+'</span></div>' +
      '<div class="ct-badges">'+badges+'</div>' +
      '<div class="reg-scope">'+esc(r.detail)+'</div>' +
      (r.depth ? '<div class="reg-accountability">'+esc(r.depth)+'</div>' : "") +
      (traps ? '<div class="reg-section-label trap">'+ICON.target+' Watch out for</div><ul class="reg-list trap-list">'+traps+'</ul>' : "") +
    '</div>';
  }

  app.innerHTML = '<div class="main-narrow">' +
    '<div class="chapter-head">' + backRow(exam.title) +
    '<div class="crumb"><a data-nav="home">Home</a> / <a data-nav="exam">'+esc(exam.title)+'</a> / Who gets what</div>' +
    '<h1>Who gets what</h1><div class="fmt">'+rules.length+' protections and rights, organised by client type — retail, professional and eligible counterparty — plus who can request re-categorisation and to what.</div>' +
    '</div>' +
    '<div class="gloss-toolbar">' +
      '<div class="search-box gloss-search">'+ICON.search+'<input type="text" id="ctSearch" placeholder="Search rules…" autocomplete="off"/></div>' +
      '<div class="ct-filters" id="ctFilters">' +
        '<button class="chip ct-filter active" data-type="all">All</button>' +
        '<button class="chip ct-filter" data-type="retail">Retail</button>' +
        '<button class="chip ct-filter" data-type="professional">Professional</button>' +
        '<button class="chip ct-filter" data-type="ecp">Eligible counterparty</button>' +
      '</div>' +
    '</div>' +
    '<div class="reg-grid" id="ctGrid">' + rules.map(ruleCardHtml).join("") + '</div>' +
    '<div class="empty-state" id="ctEmpty" style="display:none;">No rules match.</div>' +
  '</div>';

  wireBack(app, [examKey]);
  app.querySelector('[data-nav="home"]').onclick = function(){ navigate([]); };
  app.querySelector('[data-nav="exam"]').onclick = function(){ navigate([examKey]); };

  var input = document.getElementById("ctSearch");
  var cardEls = Array.prototype.slice.call(document.querySelectorAll(".ct-card"));
  var emptyMsg = document.getElementById("ctEmpty");
  var activeType = "all";

  function applyFilters(){
    var q = input.value.trim().toLowerCase();
    var shown = 0;
    cardEls.forEach(function(c){
      var typeMatch = activeType==="all" || (c.getAttribute("data-types")||"").split(",").indexOf(activeType)!==-1;
      var textMatch = !q || c.getAttribute("data-search").indexOf(q)!==-1;
      var match = typeMatch && textMatch;
      c.style.display = match ? "" : "none";
      if(match) shown++;
    });
    emptyMsg.style.display = shown===0 ? "" : "none";
  }
  input.oninput = applyFilters;
  Array.prototype.forEach.call(document.querySelectorAll(".ct-filter"), function(btn){
    btn.onclick = function(){
      Array.prototype.forEach.call(document.querySelectorAll(".ct-filter"), function(b){ b.classList.remove("active"); });
      btn.classList.add("active");
      activeType = btn.getAttribute("data-type");
      applyFilters();
    };
  });
}

function runFlashcardUI(container, examKey, label, cards){
  function priorityOf(c){ var lvl = cardLevel(examKey, c._id); return lvl===1?0 : lvl===0?1 : lvl===2?2 : 3; }
  function buildQueue(list){
    var groups = [[],[],[],[]];
    shuffle(list).forEach(function(c){ groups[priorityOf(c)].push(c); });
    return groups[0].concat(groups[1]).concat(groups[2]).concat(groups[3]);
  }
  var totalCards = cards.length;
  var queue = buildQueue(cards);
  var repeatCounts = {};
  var sessionSeen = {};
  var sessionRatings = { good:0, medium:0, bad:0 };

  function levelLabel(l){ return l===1?"Bad":l===2?"Medium":l===3?"Good":"New"; }

  function statsHtml(){
    var seenCount = Object.keys(sessionSeen).length;
    return '<div class="fc-stats">'+esc(label)+' &middot; <b>'+seenCount+'</b>/'+totalCards+' seen this session'+
      (sessionRatings.good+sessionRatings.medium+sessionRatings.bad>0 ?
        ' &middot; <span class="fc-tag good">'+sessionRatings.good+' good</span> <span class="fc-tag medium">'+sessionRatings.medium+' medium</span> <span class="fc-tag bad">'+sessionRatings.bad+' bad</span>' : '') +
    '</div>';
  }

  function draw(){
    if(totalCards===0){
      container.innerHTML = '<div class="fc-toolbar"><div></div></div><div class="fc-empty">No flashcards here.</div>';
      return;
    }
    if(queue.length===0){
      container.innerHTML =
        '<div class="fc-toolbar">'+statsHtml()+
          '<div style="display:flex;gap:8px;"><button class="btn btn-sm" id="restartBtn">'+ICON.refresh+' Study again</button></div>' +
        '</div>' +
        '<div class="fc-stage"><div class="fc-done">'+ICON.check+'<h2 style="margin:14px 0 6px;">Deck complete</h2><div style="color:var(--text-faint);font-size:13.5px;max-width:380px;text-align:center;">You\'ve been through all '+totalCards+' cards. Anything rated Bad or Medium will come up first next time you open this deck.</div></div></div>';
      document.getElementById("restartBtn").onclick = function(){
        queue = buildQueue(cards); repeatCounts={}; sessionSeen={}; sessionRatings={good:0,medium:0,bad:0}; draw();
      };
      return;
    }
    var c = queue[0];
    sessionSeen[c._id] = true;
    var curLevel = cardLevel(examKey, c._id);
    container.innerHTML =
      '<div class="fc-toolbar">' + statsHtml() +
        '<div style="display:flex;gap:8px;">' +
          '<button class="btn btn-sm" id="shuffleBtn">'+ICON.shuffle+' Shuffle rest</button>' +
          '<button class="btn btn-sm" id="resetBtn">'+ICON.refresh+' Reset progress</button>' +
        '</div>' +
      '</div>' +
      '<div class="fc-stage">' +
        '<div class="fc-count">'+queue.length+' card'+(queue.length>1?"s":"")+' left in this session'+(c._chapter?' &middot; '+esc(c._chapter):'')+(curLevel?' &middot; last rated: '+levelLabel(curLevel):'')+'</div>' +
        '<div class="flashcard" id="fcCard"><div class="flashcard-inner">' +
          '<div class="fc-face fc-front"><span class="fc-kicker">Term / prompt</span><div class="fc-txt">'+esc(c.front)+'</div><span class="fc-hint">Click to flip</span></div>' +
          '<div class="fc-face fc-back"><span class="fc-kicker">Answer</span><div class="fc-txt">'+esc(c.back)+'</div></div>' +
        '</div></div>' +
        '<div class="fc-controls fc-controls-3">' +
          '<button class="btn fc-bad" id="badBtn">'+ICON.close+' Bad</button>' +
          '<button class="btn fc-medium" id="mediumBtn">Medium</button>' +
          '<button class="btn fc-good" id="goodBtn">'+ICON.check+' Good</button>' +
        '</div>' +
      '</div>';

    var cardEl = document.getElementById("fcCard");
    cardEl.onclick = function(){ cardEl.classList.toggle("flipped"); };

    function rate(level, sessionKey){
      setCardLevel(examKey, c._id, level);
      sessionRatings[sessionKey]++;
      queue.shift();
      var reps = repeatCounts[c._id] || 0;
      if(level<3 && reps<2){
        repeatCounts[c._id] = reps+1;
        var gap = level===1 ? 3 : 7;
        queue.splice(Math.min(queue.length, gap), 0, c);
      }
      draw();
    }
    document.getElementById("badBtn").onclick = function(e){ e.stopPropagation(); rate(1, "bad"); };
    document.getElementById("mediumBtn").onclick = function(e){ e.stopPropagation(); rate(2, "medium"); };
    document.getElementById("goodBtn").onclick = function(e){ e.stopPropagation(); rate(3, "good"); };
    document.getElementById("shuffleBtn").onclick = function(){ var rest = queue.slice(1); queue = [queue[0]].concat(shuffle(rest)); draw(); };
    document.getElementById("resetBtn").onclick = function(){
      cards.forEach(function(c2){ var ex=ensureExam(examKey); delete ex.cards[c2._id]; });
      saveStore(store);
      queue = buildQueue(cards); repeatCounts={}; sessionSeen={}; sessionRatings={good:0,medium:0,bad:0};
      draw();
    };
  }
  draw();
}

/* ---------- boot ---------- */
render();

})();
