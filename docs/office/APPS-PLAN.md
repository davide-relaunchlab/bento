# Presentazioni e documenti nello spazio bento/office

## Obiettivo e decisioni
Aggiungere gli editor reali bento/slides e bento/type alla suite pubblicata, accanto a dash. Archivio unico, creazione e tipo riconoscibili, autenticazione/permessi/proposte/storico/annullamento comuni. “Word” indica il documento impaginato di bento/type; DOCX non è incluso nel motore upstream e non viene promesso.

Conservare modelli, formati HTML autonomi, editor, docId e copyright. Gli editor aggiunti vivono in iframe della stessa origine per isolare CSS, scorciatoie e singleton del kernel. Un contratto tipizzato collega il loro store alla coda transazionale esistente. Non si esegue HTML importato: si estrae e valida soltanto il blocco JSON.

Il servizio accetta i tre formati. I fogli mantengono le patch esistenti. Documenti e presentazioni aggiungono operazioni su blocchi, slide, elementi e proprietà ammesse, con guardie calcolate sullo snapshot storico, inverse e diff leggibili. La stessa autenticazione viene applicata agli strumenti MCP/WebMCP. Una proposta non può essere approvata da un agente. Il formato non cambia dopo la creazione.

La libreria aggiunge un tipo al record SQL con default bento/dash per preservare i file esistenti. Export usa la shell standalone del tipo corretto. Autosave locale, relay upstream, updater, sostituzione documento e agent API standalone vengono esclusi dal percorso hosted. La presentazione e la stampa restano disponibili.

## Implementazione e responsabilità
- [x] Root: modelli/validazione/transazioni native e test di conflitti, inverse, identità e ACL; migrazione, metadata, create e letture MCP per blocchi/slide.
- [x] Agente slides_host: hook Store/Editor/pannelli e entry office/editors/slides.ts/html, test del delegato e regressioni pertinenti. Non tocca file office comuni né Sites.
- [x] Agente type_host: hook Store/main/editor e entry office/editors/type.ts/html, test delegato e regressioni. Non tocca file office comuni né Sites.
- [x] Root: estensione controller e contratto editor-host, archivio, iframe, esportazione/importazione HTML per tipo, i18n e build multipla.
- [x] Review e verifica: creazione/apertura/modifica/riapertura per entrambi, proposta agente accettata e annullata, viewer effettivo, digitazione senza perdita del cursore e persistenza, desktop/mobile e build autonome.
- [ ] Root: commit nel fork, source push Sites, archivio dalla stessa versione, pubblicazione nello stesso sito pubblico e smoke dei tre tipi.

## Contratto e confini condivisi
`office/shared/editor-host.ts` è scritto dal root prima delle integrazioni. Gli entry leggono `getNativeHost(format)` da `office/editors/host.ts`. `changed(next)` annuncia il documento completo dopo una mutazione sincrona; il controller ricava patch precise rispetto all'ultimo stato locale, mai una sostituzione indiscriminata. `adopt()` non produce modifiche o checkpoint. `isEditing()` rinvia l'adozione che invaliderebbe le closure attive; gli echo uguali non ricreano il DOM. Undo/redo delegano al servizio.

Ruling: le prescrizioni generiche di approvazione intermedia non sospendono questa richiesta di implementazione autorizzata. La pubblicazione mantiene l'ambiente e l'accesso pubblico già scelti dall'utente. Nessuna migrazione distruttiva o invito a persone reali.
