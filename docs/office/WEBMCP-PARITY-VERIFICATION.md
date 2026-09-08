# Verifica ampliamento WebMCP — 8 settembre 2026

## Risultati locali

- Catalogo: 33 strumenti server + 10 strumenti browser + contesto pagina = 44.
- Comandi nativi con schema: 8 type, 8 slides, 10 dash; catalogo dinamico dei
  controlli visibili anche nei pannelli e negli iframe.
- `npm run typecheck`: passato.
- `npm test`: 83 test passati, nessuno fallito o saltato.
- `npm run build`: passato, inclusi i tre documenti standalone esportabili.
- `git diff --check`: passato.

## Browser reale

Script ripetibile: `scripts/office-webmcp-browser-smoke.js`, da eseguire con
Playwright CLI sul server locale autenticato di test (porta 5173).
La versione Chromium del runner non espone WebMCP nativo: lo script intercetta
`document.modelContext.registerTool` all'avvio e invoca gli stessi callback
registrati dall'applicazione. Non è una prova di compatibilità di ogni
versione di WebMCP Inspector/OpenRouter; è una prova dei callback e dell'app
reale, senza mock di editor, HTTP, D1, parser, firme o salvataggio.

Verificati sui tre editor: creazione, discovery, rinomina attraverso il campo
reale, persistenza, lettura ed esportazione HTML. In type: selezione,
grassetto persistente, paginazione, firma nativa e verifica valida. In slides:
inserimento atomico, selezione, misurazione con renderer. In dash: selezione,
incolla TSV, copia e diagnostica. Import CSV nell'archivio riuscito.
Nessun `pageerror` in questo percorso. Snapshot visivi desktop ispezionati.

## Regressioni coperte

Test DOM: handler effettivi, mousedown, campi, checkbox, selezione rich text
parziale, iframe, controlli nascosti/disabilitati/obsoleti, password non
esposte, ripristino prompt dopo risposta. Test dispatcher: schema, attesa,
read-only e rifiuto di nomi arbitrari. Test HTTP con D1: cartelle, spostamento,
ACL e diniego delle operazioni workspace a token limitati. Test controller:
flush attende il completamento di undo e redo.

## Portata dell'evidenza

L'inventario `WEBMCP-CAPABILITIES.md` deriva dal codice dei tre editor e
mappa le famiglie di funzionalità alla superficie esposta. Le verifiche browser
sono rappresentative: non costituiscono un collaudo esaustivo di ogni
combinazione di opzioni di tutti i pannelli. Il registro permette di chiamare
gli handler originali; per effetti asincroni generici dichiara `dispatched`
e richiede lettura del risultato. Restano i vincoli del browser sui gesti
fidati e sugli effetti esterni come stampa/fullscreen.
