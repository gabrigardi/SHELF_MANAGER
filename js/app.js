/* ============================================================
   app.js
   Bootstrap dell'applicazione: stato globale, eventi, coordinamento
   tra Storage (persistenza), Model (logica) e UI (rendering)
   ============================================================ */

(function App() {
  // Helper DOM locali
  const $  = sel => document.querySelector(sel);
  const $$ = sel => Array.from(document.querySelectorAll(sel));

  let state = Storage.load();
  let shelfManagerHandle = null;

  function commit(nextData) {
    state = nextData;
    Storage.save(state);
    renderAll();
  }

  function renderAll() {
    UI.renderMap(state, {
      onLevelClick: (shelfId, level) => openProductForm({ shelfId, level }),
      onProductClick: (product) => openProductForm({ product })
    });
  }

  // =============== Prodotto ===============
  function openProductForm(opts) {
    UI.openProductForm(state, opts, payload => {
      if (payload._delete) {
        const r = Model.deleteProduct(state, opts.product.id);
        if (!r.ok) return UI.showToast(r.error, 'error');
        commit(r.data);
        return UI.showToast('Prodotto eliminato', 'success');
      }
      if (opts.product) {
        const r = Model.updateProduct(state, opts.product.id, payload);
        if (!r.ok) return UI.showToast(r.error, 'error');
        commit(r.data);
        return UI.showToast('Prodotto aggiornato', 'success');
      }
      const r = Model.addProduct(state, payload);
      if (!r.ok) return UI.showToast(r.error, 'error');
      commit(r.data);
      UI.showToast('Prodotto aggiunto', 'success');
    });
  }

  // =============== Scaffali ===============
  function openShelfAdd() {
    UI.openShelfForm({}, payload => {
      const r = Model.addShelf(state, payload);
      if (!r.ok) return UI.showToast(r.error, 'error');
      commit(r.data);
      shelfManagerHandle?.refresh();
      UI.showToast(`Scaffale "${payload.letter.toUpperCase()}" creato`, 'success');
    });
  }
  function openShelfEdit(shelf) {
    UI.openShelfForm({ shelf }, payload => {
      const r = Model.updateShelf(state, shelf.id, payload);
      if (!r.ok) return UI.showToast(r.error, 'error');
      commit(r.data);
      shelfManagerHandle?.refresh();
      UI.showToast('Scaffale aggiornato', 'success');
    });
  }
  function confirmShelfDelete(shelf) {
    const onShelf = state.products.filter(p => p.shelfId === shelf.id).length;
    let mode = 'block';
    if (onShelf > 0) {
      const choice = prompt(
        `Lo scaffale "${shelf.letter}" contiene ${onShelf} prodott${onShelf === 1 ? 'o' : 'i'}.\n\n` +
        `Digita ELIMINA per eliminare anche i prodotti, oppure ANNULLA per non eliminare lo scaffale.`,
        'ELIMINA'
      );
      if (!choice || choice.trim().toUpperCase() === 'ANNULLA') return;
      if (choice.trim().toUpperCase() !== 'ELIMINA') {
        return UI.showToast('Scelta non riconosciuta, operazione annullata.', 'error');
      }
      mode = 'cascade';
    } else {
      if (!confirm(`Eliminare lo scaffale "${shelf.letter}"?`)) return;
    }
    const r = Model.deleteShelf(state, shelf.id, mode);
    if (!r.ok) return UI.showToast(r.error, 'error');
    commit(r.data);
    shelfManagerHandle?.refresh();
    UI.showToast('Scaffale eliminato', 'success');
  }

  function openShelfManager() {
    shelfManagerHandle = UI.openShelfManager(state, {
      onAdd: openShelfAdd,
      onEdit: openShelfEdit,
      onDelete: confirmShelfDelete
    });
  }


  // =============== Ricerca ===============
  function handleSearch(query) {
    const q = query.trim();
    $('#searchClear').hidden = !q;

    if (!q) {
      UI.hideSearchResults();
      UI.clearHighlights();
      return;
    }
    UI.showSearchResults(state, q, {
      onResultClick: (product, shelfId, level) => {
        UI.highlightLevels([`${shelfId}:${level}`]);
        renderAll();
        UI.scrollToFirstHighlight();
      }
    });
    renderAll();
    UI.scrollToFirstHighlight();
  }

  // =============== Export / Import ===============
  function doExport() {
    try {
      Storage.exportJSON(state);
      UI.showToast('Backup scaricato', 'success');
    } catch (err) {
      console.error(err);
      UI.showToast("Errore durante l'esportazione", 'error');
    }
  }
  async function doImport(file) {
    try {
      const data = await Storage.importJSON(file);
      const totalProducts = data.products.length;
      const totalShelves = data.shelves.length;
      const msg = `Importare ${totalShelves} scaffal${totalShelves === 1 ? 'e' : 'i'} e ` +
                  `${totalProducts} prodott${totalProducts === 1 ? 'o' : 'i'}?\n` +
                  `I dati attuali verranno sostituiti.`;
      if (!confirm(msg)) return;
      commit(data);
      UI.showToast('Backup importato', 'success');
    } catch (err) {
      console.error(err);
      UI.showToast(err.message || "Errore durante l'importazione", 'error');
    }
  }

  // =============== Service Worker ===============
  function registerSW() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('js/sw.js').catch(err => {
        console.warn('Service worker non registrato:', err);
      });
    }
  }


  // =============== Init ===============
  function init() {
    $('#btnShelves').addEventListener('click', openShelfManager);
    $('#btnExport').addEventListener('click', doExport);
    $('#btnImport').addEventListener('click', () => $('#fileImport').click());
    $('#fileImport').addEventListener('change', e => {
      const file = e.target.files?.[0];
      if (file) doImport(file);
      e.target.value = '';
    });

    const searchInput = $('#searchInput');
    searchInput.addEventListener('input', e => handleSearch(e.target.value));
    $('#searchClear').addEventListener('click', () => {
      searchInput.value = '';
      handleSearch('');
      searchInput.focus();
    });
    $('#closeSearch').addEventListener('click', () => {
      searchInput.value = '';
      UI.hideSearchResults();
      renderAll();
    });

    renderAll();
    registerSW();
  }

  document.addEventListener('DOMContentLoaded', init);
})();

