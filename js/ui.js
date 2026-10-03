/* ============================================================
   ui.js
   Rendering DOM e gestione eventi di interfaccia.
   Espone funzioni riutilizzabili che verranno orchestrate da app.js
   ============================================================ */

const UI = (() => {
  // stato interno della UI: highlights correnti e query di ricerca
  const state = {
    highlights: new Set(), // chiavi "shelfId:level" da evidenziare
    lastQuery: '',
    panelOpen: false
  };

  // ----- Helpers -----
  function el(tag, attrs = {}, ...children) {
    const node = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => {
      if (v === null || v === undefined || v === false) return;
      if (k === 'class') node.className = v;
      else if (k === 'dataset') Object.entries(v).forEach(([dk, dv]) => node.dataset[dk] = dv);
      else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
      else if (k === 'html') node.innerHTML = v;
      else node.setAttribute(k, v);
    });
    children.flat().forEach(c => {
      if (c === null || c === undefined || c === false) return;
      node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return node;
  }
  const $ = sel => document.querySelector(sel);
  const $$ = sel => Array.from(document.querySelectorAll(sel));

  // =================== MAPPA ===================

  /**
   * Renderizza l'intera mappa scaffali.
   */
  function renderMap(data, callbacks = {}) {
    const root = $('#map');
    root.innerHTML = '';

    if (!data.shelves.length) {
      root.appendChild(renderEmptyState('Nessuno scaffale',
        'Inizia aggiungendo il primo scaffale dal pannello "Scaffali".'));
      return;
    }

    const counts = Model.productCountByShelf(data);

    data.shelves.forEach(shelf => {
      const shelfEl = el('div', { class: 'shelf', dataset: { shelfId: shelf.id } });

      const header = el('div', { class: 'shelf-header' },
        el('span', { class: 'shelf-letter', title: `Scaffale ${shelf.letter}` }, shelf.letter),
        el('span', { class: 'shelf-meta' },
          `${shelf.levels} ${shelf.levels === 1 ? 'piano' : 'piani'} · ${counts[shelf.id] || 0} prodotti`)
      );
      shelfEl.appendChild(header);

      const levels = el('div', { class: 'levels' });

      // Dal più alto al più basso, ma con column-reverse il primo figlio è in basso.
      // Quindi iteriamo dal più alto al più basso per popolare il DOM:
      // il primo figlio sarà il piano più alto e, grazie a column-reverse, finirà in alto.
      for (let level = shelf.levels; level >= 1; level--) {
        const products = Model.productsAt(data, shelf.id, level);
        const key = `${shelf.id}:${level}`;
        const isHighlight = state.highlights.has(key);

        const levelEl = el('div', {
          class: 'level' + (isHighlight ? ' highlight' : ''),
          dataset: { shelfId: shelf.id, level: String(level) },
          title: products.length
            ? `${products.length} prodott${products.length === 1 ? 'o' : 'i'}`
            : `Piano vuoto — clic per aggiungere un prodotto`
        },
          el('span', { class: 'level-num' }, `P${level}`),
          ...products.map(p =>
            el('button', {
              class: 'product',
              type: 'button',
              title: `${p.name}${p.category ? ' — ' + p.category : ''}${p.note ? '\n' + p.note : ''}`,
              dataset: { productId: p.id },
              onClick: e => { e.stopPropagation(); callbacks.onProductClick?.(p); }
            }, p.name)
          )
        );

        // click su piano (non su prodotto) apre form aggiunta
        levelEl.addEventListener('click', e => {
          if (e.target.closest('.product')) return; // ignora click su prodotto
          callbacks.onLevelClick?.(shelf.id, level);
        });

        levels.appendChild(levelEl);
      }
      shelfEl.appendChild(levels);
      root.appendChild(shelfEl);
    });
  }

  function renderEmptyState(title, message) {
    return el('div', { class: 'empty-state' },
      el('div', { class: 'emoji' }, '📦'),
      el('div', null, el('strong', null, title)),
      el('div', { class: 'muted' }, message)
    );
  }

  // =================== HIGHLIGHT ===================

  /** Evidenzia i piani indicati (chiavi "shelfId:level"). */
  function highlightLevels(keys) {
    state.highlights = new Set(keys);
  }

  function clearHighlights() {
    state.highlights = new Set();
  }

  /** Scrolla fino al primo piano evidenziato. */
  function scrollToFirstHighlight() {
    const first = $('.level.highlight');
    if (first) first.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  // =================== MODALE ===================

  /** Apre una modale con titolo e contenuto (nodo DOM). */
  function openModal(title, bodyNode, onClose) {
    const root = $('#modalRoot');
    root.hidden = false;
    $('#modalTitle').textContent = title;
    const body = $('#modalBody');
    body.innerHTML = '';
    if (typeof bodyNode === 'string') body.innerHTML = bodyNode;
    else if (bodyNode) body.appendChild(bodyNode);

    // chiudi su click backdrop / pulsante X
    $$('#modalRoot [data-close]').forEach(b => {
      b.onclick = () => closeModal(onClose);
    });
    // ESC chiude
    const escHandler = e => { if (e.key === 'Escape') closeModal(onClose); };
    document.addEventListener('keydown', escHandler);
    root._escHandler = escHandler;
  }

  function closeModal(onClose) {
    const root = $('#modalRoot');
    root.hidden = true;
    $('#modalBody').innerHTML = '';
    if (root._escHandler) document.removeEventListener('keydown', root._escHandler);
    onClose?.();
  }

  // =================== FORM PRODOTTO ===================

  /**
   * Apre il form prodotto. Se product è dato, modalità modifica.
   * Al submit, chiama onSubmit({ name, category, shelfId, level, note }).
   */
  function openProductForm(data, { shelfId = '', level = 1, product = null } = {}, onSubmit) {
    const isEdit = !!product;
    const shelves = data.shelves;

    if (!shelves.length) {
      showToast('Devi prima creare almeno uno scaffale.', 'error');
      return;
    }

    const initialShelfId = product?.shelfId || shelfId || shelves[0].id;
    const initialShelf = shelves.find(s => s.id === initialShelfId) || shelves[0];

    const nameInput = el('input', { type: 'text', id: 'pf-name', value: product?.name || '', maxlength: 80 });
    const categoryInput = el('input', { type: 'text', id: 'pf-category', value: product?.category || '', maxlength: 40 });
    const noteInput = el('textarea', { id: 'pf-note', rows: 2, maxlength: 200 }, product?.note || '');
    const shelfSelect = el('select', { id: 'pf-shelf' },
      ...shelves.map(s => el('option', { value: s.id, selected: s.id === initialShelfId }, `Scaffale ${s.letter} (${s.levels} piani)`))
    );
    const levelSelect = el('select', { id: 'pf-level' });
    function refreshLevels() {
      const shelf = shelves.find(s => s.id === shelfSelect.value);
      levelSelect.innerHTML = '';
      for (let i = 1; i <= shelf.levels; i++) {
        const opt = el('option', { value: String(i), selected: i === (product?.level || level) }, `Piano ${i}`);
        levelSelect.appendChild(opt);
      }
    }
    shelfSelect.addEventListener('change', refreshLevels);
    refreshLevels();

    const body = el('div', null,
      el('div', { class: 'form-row' },
        el('label', { for: 'pf-name' }, 'Nome *'),
        nameInput,
        el('div', { class: 'help' }, 'Nome del prodotto')
      ),
      el('div', { class: 'form-row' },
        el('label', { for: 'pf-category' }, 'Categoria'),
        categoryInput,
        el('div', { class: 'help' }, 'Es. Ferramenta, Elettronica…')
      ),
      el('div', { class: 'form-row row-2' },
        el('div', null,
          el('label', { for: 'pf-shelf' }, 'Scaffale *'),
          shelfSelect
        ),
        el('div', null,
          el('label', { for: 'pf-level' }, 'Piano *'),
          levelSelect
        )
      ),
      el('div', { class: 'form-row' },
        el('label', { for: 'pf-note' }, 'Note'),
        noteInput
      ),
      el('div', { class: 'form-actions' },
        isEdit ? el('button', { type: 'button', class: 'btn btn-danger', style: 'margin-right:auto;color:#fff;background:var(--c-danger);border-color:var(--c-danger)',
          onClick: () => {
            if (confirm(`Eliminare "${product.name}"?`)) {
              closeModal();
              onSubmit({ _delete: true });
            }
          }
        }, '🗑 Elimina') : null,
        el('button', { type: 'button', class: 'btn btn-ghost', 'data-close': true }, 'Annulla'),
        el('button', { type: 'button', class: 'btn btn-primary',
          onClick: () => {
            const payload = {
              name: nameInput.value,
              category: categoryInput.value,
              shelfId: shelfSelect.value,
              level: levelSelect.value,
              note: noteInput.value
            };
            // validazione minima
            if (!payload.name.trim()) { showToast('Il nome è obbligatorio.', 'error'); return; }
            closeModal();
            onSubmit(payload);
          }
        }, isEdit ? '💾 Salva' : '➕ Aggiungi')
      )
    );

    openModal(isEdit ? `Modifica prodotto` : `Nuovo prodotto`, body);
    setTimeout(() => nameInput.focus(), 50);
  }


  // =================== FORM SCAFFALE ===================

  function openShelfForm({ shelf = null } = {}, onSubmit) {
    const isEdit = !!shelf;
    const letterInput = el('input', {
      type: 'text', id: 'sf-letter', maxlength: 1,
      value: shelf?.letter || '',
      style: 'text-transform:uppercase'
    });
    const levelsInput = el('input', {
      type: 'number', id: 'sf-levels', min: 1, max: 20,
      value: shelf?.levels || 4
    });

    const body = el('div', null,
      el('div', { class: 'form-row' },
        el('label', { for: 'sf-letter' }, 'Lettera *'),
        letterInput,
        el('div', { class: 'help' }, 'Una singola lettera A-Z')
      ),
      el('div', { class: 'form-row' },
        el('label', { for: 'sf-levels' }, 'Numero di piani *'),
        levelsInput,
        el('div', { class: 'help' }, 'I piani sono numerati dal basso verso l\'alto (1 = in basso)')
      ),
      el('div', { class: 'form-actions' },
        el('button', { type: 'button', class: 'btn btn-ghost', 'data-close': true }, 'Annulla'),
        el('button', { type: 'button', class: 'btn btn-primary',
          onClick: () => {
            closeModal();
            onSubmit({ letter: letterInput.value, levels: parseInt(levelsInput.value, 10) });
          }
        }, isEdit ? '💾 Salva' : '➕ Crea scaffale')
      )
    );

    openModal(isEdit ? `Modifica scaffale ${shelf.letter}` : `Nuovo scaffale`, body);
    setTimeout(() => letterInput.focus(), 50);
  }

  // =================== GESTIONE SCAFFALI (lista) ===================

  function openShelfManager(data, callbacks) {
    const listEl = el('div', { class: 'shelf-list' });

    function refresh() {
      listEl.innerHTML = '';
      if (!data.shelves.length) {
        listEl.appendChild(el('div', { class: 'muted text-center' }, 'Nessuno scaffale definito.'));
        return;
      }
      const counts = Model.productCountByShelf(data);
      data.shelves.forEach(shelf => {
        const row = el('div', { class: 'shelf-row' },
          el('div', { class: 'info' },
            el('strong', null, `Scaffale ${shelf.letter}`),
            el('div', { class: 'meta' },
              `${shelf.levels} ${shelf.levels === 1 ? 'piano' : 'piani'} · ${counts[shelf.id] || 0} prodotti`)
          ),
          el('button', { type: 'button', class: 'btn btn-ghost',
            onClick: () => callbacks.onEdit(shelf)
          }, '✏️ Modifica'),
          el('button', { type: 'button', class: 'btn btn-danger', style: 'color:#fff;background:var(--c-danger);border-color:var(--c-danger)',
            onClick: () => callbacks.onDelete(shelf)
          }, '🗑 Elimina')
        );
        listEl.appendChild(row);
      });
    }
    refresh();

    const body = el('div', null,
      listEl,
      el('div', { class: 'form-actions' },
        el('button', { type: 'button', class: 'btn btn-primary',
          onClick: () => callbacks.onAdd()
        }, '➕ Aggiungi scaffale')
      )
    );
    openModal('Gestione scaffali', body);
    // restituiamo refresh così l'app può aggiornare la lista dopo modifiche
    return { refresh };
  }


  // =================== PANNELLO RISULTATI RICERCA ===================

  /**
   * Mostra il pannello con i risultati raggruppati per scaffale/piano.
   */
  function showSearchResults(data, query, { onResultClick }) {
    state.lastQuery = query;
    const panel = $('#searchPanel');
    const title = $('#searchTitle');
    const list = $('#searchResults');
    list.innerHTML = '';
    title.textContent = `Risultati per "${query}"`;
    panel.hidden = false;
    $('#main').classList.add('has-search');
    state.panelOpen = true;

    const result = Model.search(data, query);

    if (!result.products.length) {
      list.appendChild(el('div', { class: 'muted text-center' },
        'Nessun prodotto o categoria trovata.'));
      return;
    }

    // gruppi per scaffale+piano
    Object.keys(result.byShelf).sort().forEach(shelfId => {
      const shelf = data.shelves.find(s => s.id === shelfId);
      if (!shelf) return;
      const groupEl = el('div', { class: 'result-group' });
      const titleText = `Scaffale ${shelf.letter}`;
      const groupTitle = el('div', { class: 'result-group-title' }, titleText);
      groupEl.appendChild(groupTitle);

      const levels = Object.keys(result.byShelf[shelfId])
        .map(Number).sort((a, b) => a - b);
      levels.forEach(lvl => {
        const prods = result.byShelf[shelfId][lvl];
        const headerRow = el('div', { class: 'result-group-title', style: 'font-size:11px;color:var(--c-muted);margin-top:4px' },
          `Piano ${lvl} (${prods.length})`);
        groupEl.appendChild(headerRow);

        prods.forEach(p => {
          const item = el('button', {
            type: 'button', class: 'result-item',
            onClick: () => onResultClick?.(p, shelfId, lvl)
          },
            el('span', null,
              el('strong', null, p.name),
              p.category ? ` · ${p.category}` : ''
            ),
            el('span', { class: 'meta' }, `${shelf.letter}·P${lvl}`)
          );
          groupEl.appendChild(item);
        });
      });
      list.appendChild(groupEl);
    });

    // Evidenzia tutti i piani toccati dalla ricerca
    const keys = [];
    Object.keys(result.byShelf).forEach(sid => {
      Object.keys(result.byShelf[sid]).forEach(lv => keys.push(`${sid}:${lv}`));
    });
    highlightLevels(keys);
  }

  function hideSearchResults() {
    $('#searchPanel').hidden = true;
    $('#main').classList.remove('has-search');
    state.panelOpen = false;
    clearHighlights();
  }

  // =================== TOAST ===================

  let toastTimer = null;
  function showToast(msg, kind = 'info') {
    const t = $('#toast');
    t.textContent = msg;
    t.className = 'toast' + (kind === 'error' ? ' toast-error' : kind === 'success' ? ' toast-success' : '');
    t.hidden = false;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, 2800);
  }

  // =================== API pubblica ===================

  return {
    renderMap,
    highlightLevels, clearHighlights, scrollToFirstHighlight,
    openModal, closeModal,
    openProductForm, openShelfForm, openShelfManager,
    showSearchResults, hideSearchResults,
    showToast,
    isPanelOpen: () => state.panelOpen,
    getLastQuery: () => state.lastQuery
  };
})();

