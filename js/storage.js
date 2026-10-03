/* ============================================================
   storage.js
   Persistenza su localStorage + import/export JSON
   ============================================================ */

const Storage = (() => {
  const KEY = 'magazzino_semplice_v1';

  /**
   * Dati di esempio caricati al primo avvio
   * (solo se localStorage è vuoto)
   */
  const SAMPLE_DATA = {
    version: 1,
    shelves: [
      { id: 'A', letter: 'A', levels: 4 },
      { id: 'B', letter: 'B', levels: 5 },
      { id: 'C', letter: 'C', levels: 3 }
    ],
    products: [
      { id: 'p1', name: 'Viti 3x20',  category: 'Ferramenta', shelfId: 'A', level: 1, note: 'Confezione 100pz' },
      { id: 'p2', name: 'Dadi M3',    category: 'Ferramenta', shelfId: 'A', level: 2, note: '' },
      { id: 'p3', name: 'Cavo USB-C', category: 'Elettronica', shelfId: 'B', level: 3, note: '1m' },
      { id: 'p4', name: 'Batterie AA',category: 'Elettronica', shelfId: 'B', level: 1, note: '' },
      { id: 'p5', name: 'Nastro',     category: 'Consumo',     shelfId: 'C', level: 2, note: 'Vari colori' }
    ]
  };

  /**
   * Carica i dati da localStorage.
   * Se vuoto, restituisce una copia dei dati di esempio.
   */
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return deepClone(SAMPLE_DATA);
      const parsed = JSON.parse(raw);
      return normalize(parsed);
    } catch (err) {
      console.error('Errore lettura localStorage:', err);
      return deepClone(SAMPLE_DATA);
    }
  }

  /**
   * Salva i dati su localStorage.
   */
  function save(data) {
    try {
      localStorage.setItem(KEY, JSON.stringify(normalize(data)));
      return true;
    } catch (err) {
      console.error('Errore salvataggio localStorage:', err);
      return false;
    }
  }

  /**
   * Normalizza la struttura dati per garantire i campi minimi.
   */
  function normalize(data) {
    const out = {
      version: 1,
      shelves: Array.isArray(data?.shelves) ? data.shelves : [],
      products: Array.isArray(data?.products) ? data.products : []
    };
    out.shelves = out.shelves
      .filter(s => s && s.letter)
      .map(s => ({
        id: String(s.id || s.letter),
        letter: String(s.letter).toUpperCase(),
        levels: Math.max(1, Math.min(20, parseInt(s.levels, 10) || 1))
      }));
    out.products = out.products
      .filter(p => p && p.name && p.shelfId)
      .map(p => ({
        id: String(p.id || generateId()),
        name: String(p.name),
        category: String(p.category || ''),
        shelfId: String(p.shelfId),
        level: Math.max(1, parseInt(p.level, 10) || 1),
        note: String(p.note || '')
      }));
    return out;
  }

  /**
   * Esporta i dati come file JSON scaricato.
   */
  function exportJSON(data) {
    const json = JSON.stringify(normalize(data), null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const date = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `magazzino-backup-${date}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Importa dati da un File oggetto. Risolve con i dati normalizzati.
   * Rigetta se la struttura non è valida.
   */
  function importJSON(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => {
        try {
          const parsed = JSON.parse(e.target.result);
          if (!parsed || typeof parsed !== 'object') {
            return reject(new Error('File non valido: non è un oggetto JSON.'));
          }
          if (!Array.isArray(parsed.shelves) || !Array.isArray(parsed.products)) {
            return reject(new Error('File non valido: mancano gli array "shelves" o "products".'));
          }
          resolve(normalize(parsed));
        } catch (err) {
          reject(new Error('File JSON non parsabile: ' + err.message));
        }
      };
      reader.onerror = () => reject(new Error('Impossibile leggere il file.'));
      reader.readAsText(file);
    });
  }

  /**
   * Genera un ID univoco per i prodotti.
   */
  function generateId() {
    if (window.crypto && crypto.randomUUID) return 'p_' + crypto.randomUUID().slice(0, 8);
    return 'p_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function deepClone(o) { return JSON.parse(JSON.stringify(o)); }

  return { load, save, exportJSON, importJSON, generateId, normalize };
})();
