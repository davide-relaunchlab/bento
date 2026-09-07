# bento/office

Spazio condiviso per fogli di calcolo, derivato da `nyblnet/bento` al commit `01000838496ec863ba1035eae12a8a4943020cdc`. La licenza MIT e i copyright upstream restano nel repository e nei file autonomi. `dash/` è l'editor effettivo: formule, grafici, dataset, import/export e patch provengono da Bento.

## Sviluppo locale

Richiede Node moderno con supporto TypeScript tramite `tsx`.

```sh
npm ci
npm --prefix dash ci
npm --prefix dash run build:single
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

**Stato Sites:** la pubblicazione privata è verificata; il servizio MCP gestito restituisce «Sites MCP is not enabled for this Site owner». Il gate privato di Sites è distinto dai permessi dei fogli: la sola chiave agente non lo supera. L'ingresso pubblico per il servizio MCP autonomo richiede una scelta esplicita del proprietario. Non usare il token di bypass Sites come credenziale di prodotto.

Le prove eseguite e lo stato della consegna sono in [IMPLEMENTATION.md](IMPLEMENTATION.md).
