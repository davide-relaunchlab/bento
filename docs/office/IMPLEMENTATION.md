# bento/office — prima versione condivisa

## Risultato richiesto
Una suite su Sites in cui più persone e agenti esterni aprono e modificano gli stessi fogli, vedono cambiamenti puntuali e risultati ricalcolati, controllano le proposte, condividono con permessi e annullano un intervento senza cancellare modifiche successive incompatibili.

## Base e confini
Base reale: dash e kernel del fork davide-relaunchlab/bento, upstream 0100083. Nuovo strato office per archivio, accesso e protocolli; editor/formule/grafici restano Bento. Il servizio hosted conserva dati lato server per applicare autorizzazioni e transazioni: non dichiara E2EE. Il relay cifrato storico e i file autonomi non cambiano protocollo. Il caricamento hosted non entra automaticamente nel relay upstream. Nessuna chiave di collaborazione o credenziale attraversa il contesto degli agenti o l'esportazione dalla suite.

## Ordine di lavoro e prove
- [x] Operazioni condivise: schema runtime, precondizioni sulle porzioni toccate, applicazione atomica, inverse e identificativo idempotente. Casi di concorrenza, errori a metà batch, payload ostili e undo dopo una modifica indipendente.
- [x] Servizio persistente: identità verificata, archivio, ruoli e inviti, proposte/accettazione/rifiuto, storico e revoca. Test HTTP su database reale locale con almeno due identità e un agente.
- [x] Integrazione dell'editor dash: apertura remota, patch umane e import catturati, aggiornamenti remoti, salvataggio/errori, condivisione e pannello modifiche. Nessun bypass delle ACL attraverso broadcast, JSON replace o relay.
- [ ] MCP remoto e WebMCP nativo rilevato senza shim: lista/lettura, proposte e operazioni strutturate; permessi identici all'API. Prova con client MCP e browser compatibile quando disponibile.
- [x] Esportazione HTML autonoma, CSV/XLSX, formule/grafici esistenti, accessibilità e schermi piccoli. Build e test di regressione pertinenti; verifica browser dei flussi reali.
- [ ] Revisione, source push nel fork, build e pubblicazione privata Sites, readback SHA e smoke runtime. Accessi a persone reali solo con destinatari autorizzati dall'utente.

## Decisioni implementative iniziali
- Una modifica umana può essere applicata direttamente se consentita; un agente in modalità proposta produce un confronto verificabile e non modifica il foglio fino all'accettazione.
- Il risultato di una revisione contiene autore, ambito, prima/dopo e precondizioni; una cella cambiata nel frattempo produce un conflitto, non una sostituzione silenziosa.
- Nessuna creazione di utenti fittizi o invito reale in produzione per le prove; identità di test solo nello sviluppo locale.
- UI estende la palette e la densità esistenti di dash. Archivio sobrio, foglio dominante, pannelli di condivisione e revisione su richiesta. Nessuna landing promozionale.
- Dettagli MCP gestito Sites e autenticazione in verifica sulle API correnti. WebMCP settembre 2026 usa document.modelContext e richiede feature detection; nessuna promessa di disponibilità universale.

## Stato
25 test office superati, inclusi HTTP reale D1/R2, client MCP Streamable HTTP, concorrenza e risposte perse. Regressioni Bento: store 126, formule 55, celle-formule 50, riferimenti fra fogli 33, XLSX 115, carry XLSX 75, grafici 52 controlli superati. LibreOffice non disponibile: apertura in LibreOffice non verificata. Typecheck e build passano.

WebMCP nativo: tutti i 10 strumenti registrati ed eseguiti in Codex IAB, input invalidi rifiutati. Proposta di A2=8 e A3=SUM(A1:A2), approvazione nella UI, ricalcolo 20; dataset creato/letto/annullato. Browser desktop e 390px verificati. Esportazione HTML scaricata dalla UI: identità e formula conservate, credenziali sync assenti, gate del blocco documento superato.

Pubblicazione privata Sites riuscita. Accesso con l’account proprietario, creazione persistente, proposta WebMCP e approvazione verificati sul sito remoto: formula B4=SUM(B2:B3), risultato 20. Annullo e ripristino verificati sullo stesso foglio.

MCP tramite client reale e /api/mcp verificato nel runtime locale. Il controllo Sites con include_mcp_connection restituisce «Sites MCP is not enabled for this Site owner». La dichiarazione capabilities:[mcp] viene riconosciuta, ma l’account non dispone del servizio gestito. Richiesta al proprietario la scelta fra ingresso pubblico con ACL applicative e mantenimento privato con WebMCP; nessun allargamento degli accessi effettuato. Il requisito degli agenti MCP esterni rimane aperto fino alla scelta e alla prova sul runtime remoto.
