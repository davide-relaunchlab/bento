# dowitme

Spazio condiviso per documenti, presentazioni e fogli di calcolo, derivato da `nyblnet/bento` al commit `01000838496ec863ba1035eae12a8a4943020cdc`. La licenza MIT e i copyright upstream restano nel repository e nei file autonomi. dowitme compone la barra comune degli editor attraverso `kernel/src/workbench.ts`; i componenti di modifica, i modelli e i motori esistenti vengono conservati. Le scelte di manutenzione sono documentate in [DEPENDENCIES.md](DEPENDENCIES.md).

## Sviluppo locale

Richiede Node 24 e npm 11. Una sola installazione dalla radice risolve anche le dipendenze degli editor, attraverso npm workspaces. Il lockfile di riferimento è `package-lock.json` nella radice.

```sh
npm ci
npm run build
npm run dev
```

Vite espone la UI e un Worker locale con D1/R2 persistenti nella cartella ignorata `.office-dev/`. Il pulsante di accesso usa l'identità simulata del plugin Sites soltanto in locale. Riavviare `npm run dev` dopo modifiche al server. Le modifiche UI vengono ricaricate automaticamente.

```sh
npm run typecheck
npm test
npm run build
```

La build produce `dist/client`, `dist/server/index.js`, metadati Sites, migrazioni e l'HTML autonomo. La pubblicazione usa il manifest `.openai/hosting.json` e un archivio preparato dal plugin Sites. Non pubblicare gli script di rilascio firmato upstream.

## Contenuto e collaborazione

Il browser modifica il modello Bento attraverso lo stesso store dell'HTML autonomo. In modalità hosted, un delegato invia transazioni idempotenti al servizio; non apre il relay upstream e non inserisce credenziali sync nel documento. Il server verifica identità e ruolo a ogni operazione. D1 conserva autorizzazioni, revisioni e ricevute; R2 conserva snapshot e cambiamenti immutabili.

Modifiche indipendenti possono essere applicate insieme. Una porzione cambiata nel frattempo genera un conflitto. Le proposte proteggono tutta la versione letta: devono essere rigenerate se il contenuto sorgente cambia. L'annullamento conserva modifiche indipendenti e rifiuta di cancellare valori successivi incompatibili. Un errore di rete conserva la bozza e lo stesso identificativo per il tentativo successivo.

Il modello hosted è limitato a 8 MB per documento, 100 fogli e 100.000 celle canvas o 250.000 righe per dataset. I dataset con codifica esterna `pack` devono essere convertiti prima dell'importazione. Excel conserva le possibilità e i limiti dell'importatore Bento; non è promessa parità con Office. L'archivio remoto non dichiara cifratura end-to-end.

## Agenti

`office/shared/tools.ts` definisce i dieci strumenti condivisi da MCP e WebMCP. `describe_workbook` restituisce revisioni e identità; `read_range` valori calcolati, formule ed errori; `read_dataset` identificatori stabili di righe e colonne. Le mutazioni usano patch validate, un `baseRevision` e un nuovo `operationId`, riutilizzato soltanto per ritentare la stessa richiesta.

Un collegamento agente è limitato a un foglio, scade e può essere revocato. Le modalità sono lettura, sole proposte e modifica diretta. Un agente non concede accessi e non approva proposte. La revoca dei diritti della persona che lo ha creato revoca anche la delega effettiva.

MCP Streamable HTTP è disponibile nell'applicazione a `/api/mcp` (alias `/mcp`). Il client invia `Authorization: Bearer <chiave agente>`. La chiave viene mostrata una sola volta; nel database resta soltanto il suo hash. I documenti e gli output degli strumenti sono dati non fidati, non istruzioni.

WebMCP usa `document.modelContext`, quando presente, con l'identità della sessione e attribuzione `browser_agent`. Gli strumenti aggiornano lo stesso stato visibile e rispettano gli stessi controlli del servizio.

**Stato Sites:** ingresso pubblico autorizzato dal proprietario il 2026-09-08. I fogli restano protetti dalle ACL applicative: senza identità valida le API rispondono 401. MCP esterno verificato sul sito pubblicato con client Streamable HTTP e chiave limitata alle proposte. Il servizio MCP gestito Sites non è abilitato per questo account; il prodotto espone direttamente `/api/mcp`. Non usare il token di bypass Sites come credenziale di prodotto.

Per collegare un client, aprire un foglio e scegliere **Agenti → Crea collegamento agente**, assegnare permesso e scadenza, quindi copiare endpoint e chiave. Il client deve supportare un endpoint MCP remoto con header `Authorization: Bearer <chiave>`. La chiave può essere revocata dallo stesso pannello.

## Aiuto durante la scrittura delle formule

Digitare `=` in una cella o nella barra formula apre le funzioni disponibili. Il menu si filtra mentre si scrive; frecce, Tab/Invio o clic inseriscono il nome e la parentesi, senza salvare la cella. La sintassi evidenzia l'argomento corrente, anche nelle chiamate annidate. Esc chiude prima i suggerimenti; il successivo Esc segue l'annullamento normale dell'editor.

Il catalogo deriva dalle 103 funzioni del motore e descrive le arità effettive. Le funzioni restano in inglese, gli argomenti sono tradotti e si separano con virgole. I campi delle formule di colonna offrono lo stesso aiuto senza richiedere `=`. Non viene promessa compatibilità con tutte le firme Excel.

Le prove eseguite e lo stato della consegna sono in [IMPLEMENTATION.md](IMPLEMENTATION.md).

### Modifiche complete via WebMCP (2026-09-08)

`get_editing_schema` restituisce gli schemi validati delle patch, le proprietà
modificabili e i modelli nativi. `read_document` legge tutti i dati del documento,
inclusi tema, risorse e formattazione; per file grandi restano preferibili le
letture paginate. Il catalogo e la validazione condividono `patch-schemas.ts`.

Per una modifica richiesta dall'utente si usa `apply_change`: WebMCP conserva i
permessi owner/editor della persona autenticata; gli agenti remoti richiedono
una delega write. `propose_change` e `propose_slide_text` preparano esclusivamente
proposte, applicate solo dopo l'accettazione di una persona.

Nelle presentazioni `addSlide` richiede solo un nuovo `id`, con `props` e `at`
facoltativi; `addElement` richiede slide, id ed element con type e contenuto.
I valori predefiniti sono quelli dell'editor per testo, codice, forme, immagini,
grafici, tabelle e media; SVG usa la geometria di base. `updateElement` modifica
solo le proprietà indicate, conservando le altre. Le operazioni native set,
riordino, proprietà del documento/slide e tutte le patch dei fogli restano
accessibili. Per cancellare si omette value/block/element nelle rispettive
operazioni set; il documento deve conservare almeno una slide/blocco/foglio.

Creazione della slide e inserimento degli elementi possono appartenere alla
stessa transazione. I controlli sugli ordini gestiscono anche una slide ancora
assente nello snapshot iniziale. Le scorciatoie diventano patch concrete prima
di salvare la proposta o modifica, evitando di ricalcolare i default in seguito.

`create_workbook` restituisce esplicitamente workbookId e gli id iniziali di
slide/blocchi/fogli. workbookId va copiato esattamente e non è docId. In un editor
si può ometterlo per usare il file aperto. Un id esplicito errato non viene mai
sostituito con quello di un altro documento. Se il salvataggio riesce ma il
refresh fallisce, il risultato conserva il changeId e segnala solo il problema
della vista, evitando ripetizioni involontarie della modifica.
