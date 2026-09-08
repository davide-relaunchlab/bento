# WebMCP parity Implementation Plan

**Goal:** parità tra le funzioni manuali di dowitme e WebMCP, pubblicata su Sites.
**Architecture:** tool server condivisi, adapter native browser, registro controlli reali.
**Tech Stack:** TypeScript, Zod, Vite, D1/R2, native WebMCP.
**Spec:** ../specs/2026-09-08-webmcp-parity-design.md

## Global Constraints

Preservare docId, formati, permessi, limiti e controlli di concorrenza.
Riutilizzare lo stesso worktree isolato e la versione Sites già verificata.
Nessuna modifica a kernel/sync né rilascio firmato standalone.

- [x] Analisi indipendente type/slides/dash e raccolta: confermata perdita API hosted.
- [x] Workspace: aggiungere test HTTP per discovery/cartelle/condivisione/review;
  esporre metodi esistenti in shared/workspace-tools.ts e server/workspace-tools.ts;
  permettere browser_agent autenticato dove la UI usa personOnly, conservando
  il diniego per bearer token remoti.
- [x] Browser: test DOM per catalogo, input, click, selezione e target obsoleti;
  implementare client/interface-tools.ts e shared/browser-tools.ts; integrare
  nel registro WebMCP con stato, errori, flush e import/export della shell.
- [x] Editor: aggiungere adapter in slides/type/dash che riusino i metodi native
  per selezione, comandi, letture derivate e undo/redo; mantenere le API hosted.
- [x] Documentare inventario e copertura per tutte le famiglie dell'audit;
  verificare via WebMCP nativo modifica, persistenza e aggiornamento in ogni app.
- [x] Eseguire typecheck/test/build, correggere difetti, pubblicare la sorgente
  validata su Sites e rileggere la versione effettivamente online.

La pubblicazione viene registrata nella consegna con riscontro del servizio Sites.
