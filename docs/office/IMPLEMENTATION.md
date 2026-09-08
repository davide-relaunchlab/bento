# bento/office — prima versione condivisa

## Risultato richiesto
Una suite su Sites in cui più persone e agenti esterni aprono e modificano gli stessi fogli, vedono cambiamenti puntuali e risultati ricalcolati, controllano le proposte, condividono con permessi e annullano un intervento senza cancellare modifiche successive incompatibili.

## Base e confini
Base reale: dash e kernel del fork davide-relaunchlab/bento, upstream 0100083. Nuovo strato office per archivio, accesso e protocolli; editor/formule/grafici restano Bento. Il servizio hosted conserva dati lato server per applicare autorizzazioni e transazioni: non dichiara E2EE. Il relay cifrato storico e i file autonomi non cambiano protocollo. Il caricamento hosted non entra automaticamente nel relay upstream. Nessuna chiave di collaborazione o credenziale attraversa il contesto degli agenti o l'esportazione dalla suite.

## Ordine di lavoro e prove
- [x] Operazioni condivise: schema runtime, precondizioni sulle porzioni toccate, applicazione atomica, inverse e identificativo idempotente. Casi di concorrenza, errori a metà batch, payload ostili e undo dopo una modifica indipendente.
- [x] Servizio persistente: identità verificata, archivio, ruoli e inviti, proposte/accettazione/rifiuto, storico e revoca. Test HTTP su database reale locale con almeno due identità e un agente.
- [x] Integrazione dell'editor dash: apertura remota, patch umane e import catturati, aggiornamenti remoti, salvataggio/errori, condivisione e pannello modifiche. Nessun bypass delle ACL attraverso broadcast, JSON replace o relay.
- [x] MCP remoto e WebMCP nativo rilevato senza shim: lista/lettura, proposte e operazioni strutturate; permessi identici all'API. Prova con client MCP e browser compatibile quando disponibile.
- [x] Esportazione HTML autonoma, CSV/XLSX, formule/grafici esistenti, accessibilità e schermi piccoli. Build e test di regressione pertinenti; verifica browser dei flussi reali.
- [x] Revisione, source push nel fork, build e pubblicazione Sites, readback SHA e smoke runtime. Accessi a persone reali solo con destinatari autorizzati dall'utente.

## Decisioni implementative iniziali
- Una modifica umana può essere applicata direttamente se consentita; un agente in modalità proposta produce un confronto verificabile e non modifica il foglio fino all'accettazione.
- Il risultato di una revisione contiene autore, ambito, prima/dopo e precondizioni; una cella cambiata nel frattempo produce un conflitto, non una sostituzione silenziosa.
- Nessuna creazione di utenti fittizi o invito reale in produzione per le prove; identità di test solo nello sviluppo locale.
- UI estende la palette e la densità esistenti di dash. Archivio sobrio, foglio dominante, pannelli di condivisione e revisione su richiesta. Nessuna landing promozionale.
- MCP remoto autonomo su /api/mcp, con deleghe applicative; ingresso pubblico approvato dal proprietario il 2026-09-08. WebMCP settembre 2026 usa document.modelContext e richiede feature detection; nessuna promessa di disponibilità universale.

## Stato
27 test office superati, inclusi HTTP reale D1/R2, client MCP Streamable HTTP, concorrenza e risposte perse. Regressioni Bento: store 126, formule 55, celle-formule 50, riferimenti fra fogli 33, XLSX 115, carry XLSX 75, grafici 52 controlli superati. LibreOffice non disponibile: apertura in LibreOffice non verificata. Typecheck e build passano.

WebMCP nativo: tutti i 10 strumenti registrati ed eseguiti in Codex IAB, input invalidi rifiutati. Proposta di A2=8 e A3=SUM(A1:A2), approvazione nella UI, ricalcolo 20; dataset creato/letto/annullato. Browser desktop e 390px verificati. Esportazione HTML scaricata dalla UI: identità e formula conservate, credenziali sync assenti, gate del blocco documento superato.

Pubblicazione privata Sites riuscita. Accesso con l’account proprietario, creazione persistente, proposta WebMCP e approvazione verificati sul sito remoto: formula B4=SUM(B2:B3), risultato 20. Annullo e ripristino verificati sullo stesso foglio.

MCP remoto verificato su Sites pubblico con SDK client Streamable HTTP: dieci strumenti scoperti, lettura di B2:B4 (12, 8, formula con risultato 20), proposta di D1/D2, rifiuto della scrittura diretta per una chiave limitata alle proposte. Accettazione nella UI, rilettura esterna di D2=20 e annullamento nella UI. La chiave temporanea è stata revocata a fine prova: la richiesta esterna successiva risponde 401. Accesso anonimo alle API rifiutato con 401. Nessuna persona esterna è stata invitata.

Autocompletamento: catalogo completo delle funzioni del motore, parser di contesto e inserimento coperti dai test office. Traduzioni complete nei cataloghi dash effettivamente distribuiti. Barra formula, celle canvas/dataset e formule di colonna usano lo stesso widget; i suggerimenti modificano la bozza, lasciando salvataggio e annullamento ai percorsi esistenti.

Verifica browser autocompletamento: apertura dal seed = nella cella, click SUM senza blur, salvataggio e rilettura della formula con risultato 20; filtro LOG1/LOG10 nel dataset; Esc chiude il menu ed Esc successivo annulla; Tab su espressione selezionata mantiene la navigazione del dialogo; Enter/Tab completano nei campi formula senza salvarli. Sintassi annidata con argomento attivo e menu a 390px contenuti nel viewport. Nessun errore console osservato. Regressioni aggiuntive: funzioni 175, formule canvas 66, celle canvas 14 controlli superati.

Review finale: aggiornato il DOM shim dei rig per i costruttori usati dal widget. Frontier 38, accessibilità 50 e tutti i rig che montano griglia/pannelli tramite lo stesso shim passano (spill, convalida, menu, ritmo pannelli, superfici, filtri, formati e nomi).
