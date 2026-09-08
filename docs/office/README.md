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
