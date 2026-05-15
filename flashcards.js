// Flashcards: load JSON, filter, shuffle, flip, track progress (localStorage).

(function() {
  const STORAGE_KEY = 'vnr-flashcards-v1';
  const FILTER_KEY = 'vnr-flashcards-filter';
  const STUDY_KEY = 'vnr-flashcards-study';

  /** @type {{categories: Array, cards: Array}} */
  let data = null;
  /** Active deck of card-indices (into data.cards) */
  let deck = [];
  let pos = 0;
  let activeCategory = 'all';
  let progress = {}; // { [cardIndex]: "known" | "unknown" }
  let studyMode = false;

  // ---- Persistence ----
  function loadProgress() {
    try { progress = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); }
    catch (e) { progress = {}; }
  }
  function saveProgress() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(progress)); } catch (e) {}
  }
  function loadFilter() {
    activeCategory = localStorage.getItem(FILTER_KEY) || 'all';
    studyMode = localStorage.getItem(STUDY_KEY) === '1';
  }
  function saveFilter() {
    localStorage.setItem(FILTER_KEY, activeCategory);
    localStorage.setItem(STUDY_KEY, studyMode ? '1' : '0');
  }

  // ---- Minimal markdown → HTML for card answers ----
  function escapeHtml(s) {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
  function mdToHtml(text) {
    let s = escapeHtml(text);
    // bold
    s = s.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
    // italic (single * not part of **)
    s = s.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>');
    // numbered list lines like "1. xxx"
    const lines = s.split(/\n+/);
    const out = [];
    let listType = null; // 'ol' | 'ul' | null
    for (const line of lines) {
      const olMatch = /^\s*\d+\.\s+(.*)/.exec(line);
      const ulMatch = /^\s*[-•]\s+(.*)/.exec(line);
      if (olMatch) {
        if (listType !== 'ol') { if (listType) out.push(`</${listType}>`); out.push('<ol>'); listType = 'ol'; }
        out.push(`<li>${olMatch[1]}</li>`);
      } else if (ulMatch) {
        if (listType !== 'ul') { if (listType) out.push(`</${listType}>`); out.push('<ul>'); listType = 'ul'; }
        out.push(`<li>${ulMatch[1]}</li>`);
      } else {
        if (listType) { out.push(`</${listType}>`); listType = null; }
        if (line.trim()) out.push(`<p>${line}</p>`);
      }
    }
    if (listType) out.push(`</${listType}>`);
    return out.join('');
  }

  // ---- Deck construction ----
  function rebuildDeck() {
    const allIndices = data.cards.map((_, i) => i);
    let filtered = activeCategory === 'all'
      ? allIndices
      : allIndices.filter(i => data.cards[i].cat === activeCategory);
    if (studyMode) {
      filtered = filtered.filter(i => progress[i] !== 'known');
    }
    deck = filtered;
    pos = 0;
  }

  function shuffleDeck() {
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    pos = 0;
  }

  // ---- Rendering ----
  const card = () => document.getElementById('fcCard');
  const $ = (id) => document.getElementById(id);

  function updateStats() {
    const total = data.cards.length;
    let known = 0, unknown = 0, unseen = 0;
    for (let i = 0; i < total; i++) {
      const s = progress[i];
      if (s === 'known') known++;
      else if (s === 'unknown') unknown++;
      else unseen++;
    }
    $('fcStatKnown').textContent = known;
    $('fcStatUnknown').textContent = unknown;
    $('fcStatUnseen').textContent = unseen;
    $('fcStatProgress').textContent = total > 0 ? Math.round(known / total * 100) + '%' : '0%';
    $('fcTotalCount').textContent = total;
  }

  function renderFilters() {
    const total = data.cards.length;
    const counts = { all: total };
    for (const cat of data.categories) counts[cat.id] = 0;
    for (const c of data.cards) counts[c.cat] = (counts[c.cat] || 0) + 1;

    const wrap = $('fcFilterChips');
    wrap.innerHTML = '';
    const all = [{ id: 'all', label: 'Alle hoofdstukken' }, ...data.categories];
    for (const cat of all) {
      const btn = document.createElement('button');
      btn.className = 'fc-chip' + (activeCategory === cat.id ? ' active' : '');
      btn.dataset.cat = cat.id;
      btn.innerHTML = `${cat.label} <span class="fc-chip-count">${counts[cat.id] || 0}</span>`;
      btn.addEventListener('click', () => {
        activeCategory = cat.id;
        saveFilter();
        rebuildDeck();
        renderFilters();
        renderCard();
      });
      wrap.appendChild(btn);
    }
  }

  function renderCard() {
    const empty = $('fcEmpty');
    const deckEl = $('fcDeck');
    if (deck.length === 0) {
      deckEl.style.display = 'none';
      empty.hidden = false;
      return;
    }
    deckEl.style.display = '';
    empty.hidden = true;

    if (pos < 0) pos = 0;
    if (pos >= deck.length) pos = deck.length - 1;
    const idx = deck[pos];
    const c = data.cards[idx];
    const cat = data.categories.find(x => x.id === c.cat);
    const tag = cat ? cat.label : c.cat;

    $('fcCardTag').textContent = tag;
    $('fcCardTagBack').textContent = tag;
    $('fcCardQ').textContent = c.q;
    $('fcCardA').innerHTML = mdToHtml(c.a);
    $('fcCounter').textContent = `${pos + 1} / ${deck.length}`;
    card().classList.remove('flipped');

    $('fcPrevBtn').disabled = pos === 0;
    $('fcNextBtn').disabled = pos === deck.length - 1;

    // Visually mark known/unknown buttons depending on current state
    const state = progress[idx];
    $('fcKnownBtn').classList.toggle('active', state === 'known');
    $('fcUnknownBtn').classList.toggle('active', state === 'unknown');
  }

  function flipCard() {
    if (deck.length === 0) return;
    card().classList.toggle('flipped');
  }

  function next() {
    if (pos < deck.length - 1) { pos++; renderCard(); }
  }
  function prev() {
    if (pos > 0) { pos--; renderCard(); }
  }
  function rate(state) {
    if (deck.length === 0) return;
    const idx = deck[pos];
    progress[idx] = state;
    saveProgress();
    updateStats();
    if (studyMode && state === 'known') {
      rebuildDeck();
      renderFilters();
      renderCard();
    } else {
      // auto-advance to next card after rating
      if (pos < deck.length - 1) {
        setTimeout(() => { pos++; renderCard(); }, 180);
      } else {
        renderCard();
      }
    }
  }

  function resetProgress() {
    if (!confirm('Weet je zeker dat je alle voortgang wil wissen? Deze actie kan niet ongedaan gemaakt worden.')) return;
    progress = {};
    saveProgress();
    rebuildDeck();
    renderFilters();
    renderCard();
    updateStats();
  }

  // ---- Init ----
  async function init() {
    loadProgress();
    loadFilter();
    try {
      const res = await fetch('flashcards.json');
      data = await res.json();
    } catch (e) {
      $('fcCardQ').textContent = 'Kon flashcards niet laden. Open de site via een webserver (niet via file://).';
      return;
    }

    rebuildDeck();
    renderFilters();
    renderCard();
    updateStats();

    // Wire up
    card().addEventListener('click', flipCard);
    $('fcNextBtn').addEventListener('click', next);
    $('fcPrevBtn').addEventListener('click', prev);
    $('fcKnownBtn').addEventListener('click', () => rate('known'));
    $('fcUnknownBtn').addEventListener('click', () => rate('unknown'));
    $('fcShuffleBtn').addEventListener('click', () => { shuffleDeck(); renderCard(); });
    $('fcResetBtn').addEventListener('click', resetProgress);
    const sm = $('fcStudyMode');
    sm.checked = studyMode;
    sm.addEventListener('change', () => {
      studyMode = sm.checked;
      saveFilter();
      rebuildDeck();
      renderFilters();
      renderCard();
    });

    document.addEventListener('keydown', (e) => {
      // Don't intercept while typing in inputs
      if (e.target.matches('input, textarea')) return;
      // Don't intercept if PDF modal is open
      const modal = document.getElementById('pdfModal');
      if (modal && !modal.hidden) return;
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        flipCard();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        next();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        prev();
      } else if (e.key === '1') {
        rate('unknown');
      } else if (e.key === '2') {
        rate('known');
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
