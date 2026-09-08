# WebMCP: verifica delle modifiche complete

Data: 2026-09-08. Branch: `codex/webmcp-complete`, derivato da
`ed9f55860103e1e45719f2a352e4998e7d8bbdcc` (configurazione del nuovo sito dowitme).

## Risultati

- `npm run typecheck`: superato.
- `npm test`: 76 test superati, nessun fallimento.
- `npm run build`: superato, inclusi editor ospitati e documenti HTML autonomi.
- `git diff --check`: superato.
- Browser Codex IAB, WebMCP nativo, origine locale `http://127.0.0.1:5174`:
  creazione di una presentazione; creazione slide, testo e grafico nello stesso
  apply_change; riordino delle slide; apertura dell'editor e render osservato;
  modifica parziale del testo senza workbookId esplicito; aggiornamento immediato
  del contenuto a schermo; undo_change e rilettura della revisione 3 con testo
  originale ripristinato. Nessun errore nella console del browser.
- I test HTTP attraversano worker, D1 e R2 Miniflare. Verificano gli otto tipi
  nativi di elemento, default, aggiornamento parziale, proprietà della slide e
  della presentazione, cancellazione, riordino, annullamento, idempotenza e
  atomicità. Lettura completa e discovery sono verificati nei tre formati.
- Viewer e deleghe read/propose continuano a non poter applicare modifiche.
  Identificatori errati non vengono sostituiti con il documento corrente.
- Un errore nel refresh dopo una mutazione riuscita conserva il risultato del
  salvataggio e il changeId; non viene riportato come mutazione fallita.

## Limiti della verifica

Nessuna pubblicazione eseguita in questo task. Il sito remoto e l'estensione
WebMCP Inspector/OpenRouter dello screenshot non sono stati verificati con questa
versione. La verifica nativa usa i tool della pagina tramite il browser Codex.
L'errore not_found dello screenshot non dimostra da solo perché il documento non
fosse disponibile; il recupero ora indica come rileggere l'id corretto senza
indirizzare silenziosamente la modifica a un altro documento.
