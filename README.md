# 📦 Magazzino Semplice

App web **PWA** (Progressive Web App) per la gestione visiva di un piccolo magazzino: scaffali, piani e prodotti.

Nessun backend, nessun login. I dati vivono in `localStorage` e possono essere esportati/importati come JSON.

## ✨ Funzionalità

- Definizione di scaffali identificati da lettera (A, B, C…) con un numero di piani variabile (1–20)
- Piani numerati dal basso verso l'alto (piano 1 = in basso)
- Più prodotti per piano, con nome, categoria, scaffale, piano e note
- Ricerca unica per nome prodotto o categoria
- Evidenziazione sulla mappa dei piani contenenti i risultati
- Export / Import JSON per backup
- Installabile come PWA su Windows 10 (Edge / Chrome)
- Funziona offline dopo la prima apertura

## 🚀 Utilizzo

### Apertura veloce (solo browser)

Doppio click su `index.html` (funziona anche da `file://`).

### Installazione come PWA su Windows 10

1. Servi la cartella via un piccolo web server (es. con Python, Node, oppure con l'estensione *Live Server* di VS Code)
2. Apri l'app su Edge o Chrome all'indirizzo (es. `http://localhost:5500`)
3. Dal menu del browser → **Installa questa app** / **Installa Magazzino Semplice**
4. L'app sarà disponibile come applicazione standalone

> Suggerimento rapido da terminale nella cartella del progetto:
> ```
> python -m http.server 5500
> ```
> poi apri <http://localhost:5500>

### Server semplice incluso (opzionale)

Se hai **Node.js**, puoi usare:
```
npx serve .
```

## 🗂️ Struttura del progetto

```
SHELF_MANAGER/
├── index.html              # shell HTML
├── manifest.webmanifest    # manifest PWA
├── css/styles.css          # tutti gli stili
├── js/
│   ├── storage.js          # localStorage + import/export JSON
│   ├── model.js            # logica pura (CRUD scaffali/prodotti, ricerca)
│   ├── ui.js               # rendering DOM, modali, pannello ricerca, toast
│   ├── app.js              # bootstrap, eventi, coordinamento
│   └── sw.js               # service worker (cache offline)
└── assets/
    ├── icon-192.png        # icona PWA
    └── icon-512.png        # icona PWA
```

## 💾 Modello dati

Tutti i dati sono in `localStorage` sotto la chiave `magazzino_semplice_v1`:

```json
{
  "version": 1,
  "shelves": [
    { "id": "A", "letter": "A", "levels": 4 }
  ],
  "products": [
    {
      "id": "p_abc123",
      "name": "Viti 3x20",
      "category": "Ferramenta",
      "shelfId": "A",
      "level": 2,
      "note": ""
    }
  ]
}
```

Al primo avvio l'app si popola con dati di esempio (scaffali A, B, C e qualche prodotto) per test immediato.

## 🔮 Estensioni future (non implementate)

- Avvolgere in **Tauri** per ottenere un `.exe` desktop
- Backend **FastAPI + SQLite** o **Node/Express + SQLite** per multi-utente in rete locale, riusando lo stesso frontend
- Drag & drop dei prodotti sul piano
- Quantità di magazzino
- Gestione categorie separata

## 📝 Note

- Scaffali: lettera singola A–Z, piani 1–20
- I prodotti con piano fuori range dopo un cambio di capienza vengono automaticamente riportati al piano più alto
- L'eliminazione di uno scaffale con prodotti richiede conferma esplicita
- Il backup JSON è versionato (`version: 1`) per future migrazioni
