import { DEFAULT_CARDS, loadCards, saveCards, filterCards, createCard } from './cards.js';
import { DECK_INFO } from './data.js';

export function mountApp(root, options = {}) {
  const document = root.ownerDocument;
  const window = document.defaultView;
  let storage = options.storage;
  if (!('storage' in options)) {
    try { storage = window.localStorage; } catch { storage = undefined; }
  }
  let cards = loadCards(storage);
  let currentIndex = 0;
  let revealed = false;
  const reviewed = new Set();
  const events = new window.AbortController();

  root.innerHTML = `
    <div class="page-shell">
      <header class="site-header">
        <a class="brand" href="/" aria-label="Paramedic Drug Flashcards home">
          <span class="brand-mark" aria-hidden="true">✚</span>
          <span>Paramedic<span class="brand-subtitle">DRUG FLASHCARDS</span></span>
        </a>
        <span class="scope-badge">QAS · ACP2</span>
      </header>
      <main>
        <section class="intro">
          <div><p class="eyebrow">YOUR PHARMACOLOGY STUDY SPACE</p>
            <h1>Recall first.<br><span>Then check.</span></h1>
            <p class="intro-copy">Build your recall, one drug at a time. Study the supplied QAS ACP2 deck or add your own questions.</p>
          </div>
          <div class="deck-stats" aria-label="Study session progress">
            <div><strong id="total-count"></strong><span>cards in your deck</span></div>
            <div><strong id="reviewed-count">0</strong><span>revealed this session</span></div>
          </div>
        </section>

        <section class="study-tools" aria-label="Find flashcards">
          <div class="search-field"><span aria-hidden="true">⌕</span><label class="sr-only" for="search">Search drugs and answers</label><input id="search" type="search" placeholder="Search drugs and answers…" autocomplete="off"></div>
          <label class="sr-only" for="category-filter">Filter by category</label>
          <select id="category-filter"><option value="all">All categories</option></select>
          <button id="shuffle" class="button secondary" type="button">⇄ Shuffle</button>
          <button id="new-card" class="button primary" type="button" aria-expanded="false" aria-controls="card-editor">+ Add card</button>
        </section>

        <section id="card-editor" class="editor" hidden aria-labelledby="editor-title">
          <div class="editor-heading"><h2 id="editor-title">Make it your own</h2><button id="cancel-card" class="text-button" type="button">Cancel</button></div>
          <form id="card-form">
            <div class="form-row"><label>Drug name<input id="drug-name" name="name" required maxlength="120" placeholder="e.g. Adrenaline"></label><label>Category<input id="drug-category" name="category" maxlength="80" list="categories" placeholder="Custom"><datalist id="categories"></datalist></label></div>
            <label>Question<textarea id="drug-prompt" name="prompt" required maxlength="1000" rows="2" placeholder="What do you want to recall?"></textarea></label>
            <label>Answer<textarea id="drug-answer" name="answer" required maxlength="10000" rows="4" placeholder="Add your answer and reference notes"></textarea></label>
            <div class="form-actions"><p>Saved in this browser.</p><button class="button primary" type="submit">Save card</button></div>
          </form>
        </section>

        <p id="status" class="status" role="status" aria-live="polite"></p>
        <div class="study-heading"><p class="eyebrow">ACTIVE RECALL</p><span id="study-counter" aria-live="polite"></span></div>
        <section id="flashcard" class="flashcard" aria-labelledby="card-title">
          <div class="card-topline"><span id="card-category" class="category-pill"></span><span id="card-side" class="card-side">QUESTION</span></div>
          <h2 id="card-title"></h2>
          <div id="recall"><p id="card-prompt" class="card-prompt"></p><div class="recall-guide"><span class="guide-icon" aria-hidden="true">→</span><p>Take a moment to recall your answer.<br><span>Reveal when you're ready.</span></p></div></div>
          <div id="answer" class="answer" hidden><p id="memory-cue" class="memory-cue"></p><div id="answer-content" class="answer-content"></div></div>
          <div id="card-source" class="card-source"></div>
          <div class="card-footer"><button id="reveal-card" class="button primary" type="button" aria-expanded="false" aria-controls="answer">Reveal answer <span aria-hidden="true">→</span></button><button id="delete-card" class="text-button muted" type="button">Remove card</button></div>
        </section>
        <section id="empty-state" class="empty-state" hidden><h2>No cards here yet</h2><p id="empty-message"></p><button id="clear-filters" class="button secondary" type="button">Clear filters</button></section>
        <nav class="study-navigation" aria-label="Flashcard navigation"><button id="previous-card" class="button secondary" type="button">← Previous</button><p class="keyboard-hint"><kbd>Space</kbd> reveal <span>·</span> <kbd>←</kbd> <kbd>→</kbd> navigate</p><button id="next-card" class="button secondary" type="button">Next →</button></nav>
      </main>
      <footer class="site-footer"><div><strong>Study from the source.</strong><p>Independent study summaries. Check current QAS protocols for clinical decisions, dosing, and authority.</p><a id="source-pdf" target="_blank" rel="noopener noreferrer">Open supplied PDF →</a><span id="source-date"></span></div><button id="reset-deck" class="text-button" type="button">Reset original deck</button></footer>
    </div>`;

  const $ = (selector) => root.querySelector(selector);
  const on = (element, type, handler) => element.addEventListener(type, handler, { signal: events.signal });
  const visibleCards = () => filterCards(cards, $('#search').value, $('#category-filter').value);
  const announce = (text) => { $('#status').textContent = text; };

  $('#source-pdf').href = DECK_INFO.sourceFile;
  $('#source-date').textContent = `Source retrieved ${DECK_INFO.sourceDate}`;

  function renderCategories() {
    const selected = $('#category-filter').value;
    const categories = [...new Set(cards.map((card) => card.category))].sort();
    $('#category-filter').replaceChildren(new window.Option('All categories', 'all'));
    $('#categories').replaceChildren();
    for (const category of categories) {
      $('#category-filter').add(new window.Option(category, category));
      $('#categories').append(new window.Option(category, category));
    }
    $('#category-filter').value = categories.includes(selected) ? selected : 'all';
  }

  function renderStudy() {
    const visible = visibleCards();
    currentIndex = Math.min(currentIndex, Math.max(visible.length - 1, 0));
    const card = visible[currentIndex];
    $('#total-count').textContent = cards.length;
    $('#reviewed-count').textContent = reviewed.size;
    $('#study-counter').textContent = card ? `${currentIndex + 1} / ${visible.length}` : '0 / 0';
    $('#flashcard').hidden = !card;
    $('#empty-state').hidden = Boolean(card);
    $('#previous-card').disabled = visible.length < 2;
    $('#next-card').disabled = visible.length < 2;
    $('#shuffle').disabled = visible.length < 2;
    if (!card) {
      $('#empty-message').textContent = cards.length ? 'Try a different search or category.' : 'Add your first card or reset the original deck to get started.';
      $('#clear-filters').hidden = cards.length === 0;
      return;
    }
    $('#card-category').textContent = card.category;
    $('#card-title').textContent = card.name;
    $('#card-prompt').textContent = card.prompt;
    $('#card-side').textContent = revealed ? 'ANSWER' : 'QUESTION';
    $('#recall').hidden = revealed;
    $('#answer').hidden = !revealed;
    $('#reveal-card').setAttribute('aria-expanded', String(revealed));
    $('#reveal-card').textContent = revealed ? 'Back to question' : 'Reveal answer →';
    $('#memory-cue').textContent = typeof card.summary === 'string' ? card.summary : '';
    $('#memory-cue').hidden = !$('#memory-cue').textContent;
    $('#answer-content').replaceChildren();
    if (Array.isArray(card.sections) && card.sections.length && card.sections.every((section) =>
      section && typeof section.title === 'string' && typeof section.text === 'string')) {
      for (const section of card.sections) {
        const article = document.createElement('article');
        article.className = 'answer-section';
        const heading = document.createElement('h3');
        heading.textContent = section.title;
        const body = document.createElement('p');
        body.textContent = section.text;
        article.append(heading, body);
        $('#answer-content').append(article);
      }
    } else {
      const body = document.createElement('p');
      body.className = 'custom-answer';
      body.textContent = card.answer;
      $('#answer-content').append(body);
    }
    $('#card-source').replaceChildren();
    if (Number.isInteger(card.sourcePage) && card.sourcePage >= 2 && card.sourcePage <= 39) {
      const source = document.createElement('a');
      source.href = `${DECK_INFO.sourceFile}#page=${card.sourcePage}`;
      source.textContent = `Supplied PDF · page ${card.sourcePage}`;
      source.target = '_blank';
      source.rel = 'noopener noreferrer';
      $('#card-source').append(source);
      if (typeof card.sourceUrl === 'string' && /^https:\/\/(?:www\.)?ambulance\.qld\.gov\.au\//.test(card.sourceUrl)) {
        const dtp = document.createElement('a');
        dtp.href = card.sourceUrl;
        dtp.textContent = 'Original QAS DTP →';
        dtp.target = '_blank';
        dtp.rel = 'noopener noreferrer';
        $('#card-source').append(dtp);
      }
    } else {
      $('#card-source').textContent = 'Your custom card';
    }
  }

  function persist(message) {
    try { saveCards(storage, cards); announce(message); }
    catch { announce('Changes are available for this session. Browser storage is unavailable; they will not survive a refresh.'); }
    renderCategories();
    renderStudy();
  }

  function navigate(direction) {
    const count = visibleCards().length;
    if (!count) return;
    currentIndex = (currentIndex + direction + count) % count;
    revealed = false;
    renderStudy();
  }

  function reveal() {
    const card = visibleCards()[currentIndex];
    if (!card) return;
    revealed = !revealed;
    if (revealed) reviewed.add(card.id);
    renderStudy();
  }

  function closeEditor() {
    $('#card-editor').hidden = true;
    $('#new-card').setAttribute('aria-expanded', 'false');
    $('#new-card').focus();
  }

  on($('#search'), 'input', () => { currentIndex = 0; revealed = false; renderStudy(); });
  on($('#category-filter'), 'change', () => { currentIndex = 0; revealed = false; renderStudy(); });
  on($('#clear-filters'), 'click', () => { $('#search').value = ''; $('#category-filter').value = 'all'; currentIndex = 0; renderStudy(); });
  on($('#previous-card'), 'click', () => navigate(-1));
  on($('#next-card'), 'click', () => navigate(1));
  on($('#reveal-card'), 'click', reveal);
  on($('#new-card'), 'click', () => {
    $('#card-editor').hidden = false;
    $('#new-card').setAttribute('aria-expanded', 'true');
    $('#drug-name').focus();
  });
  on($('#cancel-card'), 'click', closeEditor);
  on($('#card-form'), 'submit', (event) => {
    event.preventDefault();
    try {
      const card = createCard(Object.fromEntries(new window.FormData(event.currentTarget)));
      cards.push(card);
      $('#search').value = '';
      $('#category-filter').value = 'all';
      currentIndex = cards.length - 1;
      revealed = false;
      event.currentTarget.reset();
      closeEditor();
      persist(`Added ${card.name}.`);
    } catch (error) { announce(error.message); }
  });
  on($('#shuffle'), 'click', () => {
    for (let i = cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [cards[i], cards[j]] = [cards[j], cards[i]];
    }
    currentIndex = 0;
    revealed = false;
    renderStudy();
    announce('Deck shuffled for this session.');
  });
  on($('#delete-card'), 'click', () => {
    const card = visibleCards()[currentIndex];
    if (!card || !window.confirm(`Remove ${card.name} from your browser's deck?`)) return;
    cards = cards.filter((item) => item.id !== card.id);
    reviewed.delete(card.id);
    revealed = false;
    persist(`Removed ${card.name}.`);
  });
  on($('#reset-deck'), 'click', () => {
    if (!window.confirm('Restore the 38 original cards? This replaces custom cards and removals in this browser.')) return;
    cards = structuredClone(DEFAULT_CARDS);
    reviewed.clear();
    currentIndex = 0;
    revealed = false;
    $('#search').value = '';
    $('#category-filter').value = 'all';
    persist('Original deck restored.');
  });
  on(document, 'keydown', (event) => {
    if (event.key === 'Escape' && !$('#card-editor').hidden) { closeEditor(); return; }
    if (!$('#card-editor').hidden || event.target.closest?.('input,textarea,select,button,a,[contenteditable]') || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === ' ' || event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault();
      if (event.key === ' ') reveal();
      else navigate(event.key === 'ArrowRight' ? 1 : -1);
    }
  });

  renderCategories();
  renderStudy();
  return { destroy: () => events.abort() };
}
