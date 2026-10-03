/* ============================================================
   model.js
   Logica pura di business: CRUD scaffali e prodotti, ricerca
   Nessuna dipendenza dal DOM
   ============================================================ */

const Model = (() => {

  // ---------- Scaffali ----------

  /**
   * Aggiunge uno scaffale. Restituisce { ok, error, data }.
   */
  function addShelf(data, { letter, levels }) {
    const cleanLetter = String(letter || '').toUpperCase().trim();
    if (!/^[A-Z]$/.test(cleanLetter)) {
      return { ok: false, error: 'La lettera deve essere una singola lettera A-Z.' };
    }
    const cleanLevels = parseInt(levels, 10);
    if (!Number.isFinite(cleanLevels) || cleanLevels < 1 || cleanLevels > 20) {
      return { ok: false, error: 'Il numero di piani deve essere tra 1 e 20.' };
    }
    if (data.shelves.some(s => s.letter === cleanLetter)) {
      return { ok: false, error: `Esiste già uno scaffale "${cleanLetter}".` };
    }
    const newShelf = { id: cleanLetter, letter: cleanLetter, levels: cleanLevels };
    const next = { ...data, shelves: [...data.shelves, newShelf] };
    return { ok: true, data: next };
  }

  /**
   * Aggiorna uno scaffale esistente.
   * cascadeLevel: se true e i piani diminuiscono, i prodotti fuori range
   * vengono spostati sul piano più alto.
   */
  function updateShelf(data, shelfId, { letter, levels, cascadeLevel = true }) {
    const idx = data.shelves.findIndex(s => s.id === shelfId);
    if (idx < 0) return { ok: false, error: 'Scaffale non trovato.' };

    const cleanLetter = String(letter || '').toUpperCase().trim();
    if (!/^[A-Z]$/.test(cleanLetter)) {
      return { ok: false, error: 'La lettera deve essere una singola lettera A-Z.' };
    }
    const cleanLevels = parseInt(levels, 10);
    if (!Number.isFinite(cleanLevels) || cleanLevels < 1 || cleanLevels > 20) {
      return { ok: false, error: 'Il numero di piani deve essere tra 1 e 20.' };
    }
    if (data.shelves.some(s => s.letter === cleanLetter && s.id !== shelfId)) {
      return { ok: false, error: `Esiste già uno scaffale "${cleanLetter}".` };
    }

    const updated = { id: cleanLetter, letter: cleanLetter, levels: cleanLevels };
    const nextShelves = [...data.shelves];
    nextShelves[idx] = updated;

    let nextProducts = data.products;
    if (cleanLetter !== shelfId) {
      nextProducts = data.products.map(p =>
        p.shelfId === shelfId ? { ...p, shelfId: cleanLetter } : p
      );
    }
    if (cascadeLevel) {
      nextProducts = nextProducts.map(p => {
        if (p.shelfId !== cleanLetter) return p;
        if (p.level > cleanLevels) return { ...p, level: cleanLevels };
        return p;
      });
    }

    return { ok: true, data: { ...data, shelves: nextShelves, products: nextProducts } };
  }

  /**
   * Elimina uno scaffale.
   * mode='cascade': elimina anche i prodotti presenti
   * mode='block':   rifiuta se ci sono prodotti
   */
  function deleteShelf(data, shelfId, mode = 'block') {
    const idx = data.shelves.findIndex(s => s.id === shelfId);
    if (idx < 0) return { ok: false, error: 'Scaffale non trovato.' };

    const productsOnShelf = data.products.filter(p => p.shelfId === shelfId);
    if (productsOnShelf.length > 0 && mode === 'block') {
      return {
        ok: false,
        error: `Impossibile eliminare: ci sono ${productsOnShelf.length} prodotti su questo scaffale.`
      };
    }
    const next = {
      ...data,
      shelves: data.shelves.filter(s => s.id !== shelfId),
      products: mode === 'cascade'
        ? data.products.filter(p => p.shelfId !== shelfId)
        : data.products
    };
    return { ok: true, data: next };
  }

  // ---------- Prodotti ----------

  /**
   * Aggiunge un prodotto.
   */
  function addProduct(data, { name, category, shelfId, level, note }) {
    const shelf = data.shelves.find(s => s.id === shelfId);
    if (!shelf) return { ok: false, error: 'Scaffale non valido.' };

    const cleanName = String(name || '').trim();
    if (!cleanName) return { ok: false, error: 'Il nome è obbligatorio.' };

    const cleanLevel = parseInt(level, 10);
    if (!Number.isFinite(cleanLevel) || cleanLevel < 1 || cleanLevel > shelf.levels) {
      return { ok: false, error: `Il piano deve essere tra 1 e ${shelf.levels}.` };
    }

    const newProduct = {
      id: Storage.generateId(),
      name: cleanName,
      category: String(category || '').trim(),
      shelfId,
      level: cleanLevel,
      note: String(note || '').trim()
    };
    return { ok: true, data: { ...data, products: [...data.products, newProduct] } };
  }

  /**
   * Aggiorna un prodotto esistente.
   */
  function updateProduct(data, productId, { name, category, shelfId, level, note }) {
    const idx = data.products.findIndex(p => p.id === productId);
    if (idx < 0) return { ok: false, error: 'Prodotto non trovato.' };

    const shelf = data.shelves.find(s => s.id === shelfId);
    if (!shelf) return { ok: false, error: 'Scaffale non valido.' };

    const cleanName = String(name || '').trim();
    if (!cleanName) return { ok: false, error: 'Il nome è obbligatorio.' };

    const cleanLevel = parseInt(level, 10);
    if (!Number.isFinite(cleanLevel) || cleanLevel < 1 || cleanLevel > shelf.levels) {
      return { ok: false, error: `Il piano deve essere tra 1 e ${shelf.levels}.` };
    }

    const updated = {
      ...data.products[idx],
      name: cleanName,
      category: String(category || '').trim(),
      shelfId,
      level: cleanLevel,
      note: String(note || '').trim()
    };
    const nextProducts = [...data.products];
    nextProducts[idx] = updated;
    return { ok: true, data: { ...data, products: nextProducts } };
  }

  /**
   * Elimina un prodotto.
   */
  function deleteProduct(data, productId) {
    const idx = data.products.findIndex(p => p.id === productId);
    if (idx < 0) return { ok: false, error: 'Prodotto non trovato.' };
    return {
      ok: true,
      data: { ...data, products: data.products.filter(p => p.id !== productId) }
    };
  }


  // ---------- Ricerca ----------

  /**
   * Cerca prodotti per nome o categoria (case-insensitive).
   * Ritorna { products, byShelf: { shelfId: { level: [products] } } }
   */
  function search(data, query) {
    const q = String(query || '').trim().toLowerCase();
    if (!q) return { products: [], byShelf: {} };

    const matched = data.products.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q)
    );

    const byShelf = {};
    matched.forEach(p => {
      if (!byShelf[p.shelfId]) byShelf[p.shelfId] = {};
      if (!byShelf[p.shelfId][p.level]) byShelf[p.shelfId][p.level] = [];
      byShelf[p.shelfId][p.level].push(p);
    });

    return { products: matched, byShelf };
  }

  // ---------- Query helpers ----------

  /** Restituisce i prodotti su un dato (shelfId, level). */
  function productsAt(data, shelfId, level) {
    return data.products.filter(p => p.shelfId === shelfId && p.level === level);
  }

  /** Conteggio prodotti per scaffale. */
  function productCountByShelf(data) {
    const counts = {};
    data.shelves.forEach(s => { counts[s.id] = 0; });
    data.products.forEach(p => {
      counts[p.shelfId] = (counts[p.shelfId] || 0) + 1;
    });
    return counts;
  }

  return {
    addShelf, updateShelf, deleteShelf,
    addProduct, updateProduct, deleteProduct,
    search, productsAt, productCountByShelf
  };
})();

