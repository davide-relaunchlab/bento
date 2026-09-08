# Dipendenze di dowitme

## Installazione riproducibile

Node 24 e npm 11. Dalla radice, `npm ci` installa la suite e i workspace
`dash`, `slides`, `type` e `spaces`. C'è un solo `package-lock.json`;
non generare lockfile nelle sottocartelle. Ogni editor dichiara comunque le
proprie dipendenze nel suo `package.json`.

Vite 8.2.2 e TypeScript 5.9.3 sono allineati tra suite ed editor. Il plugin
single-file 2.3.3 dichiara compatibilità con Vite 8. I passaggi a nuove major
del compilatore o a runtime alpha vanno valutati separatamente dalla manutenzione
del lockfile, con build e controlli di compatibilità.

Riferimento: [npm workspaces](https://docs.npmjs.com/cli/v8/using-npm/workspaces/).

## Correzioni transitive

L'audit iniziale della suite (2026-09-08) riportava sei segnalazioni, una alta
e cinque moderate, nella catena degli strumenti di sviluppo. Gli override
sono espliciti e versionati:

- `miniflare → undici 7.29.1`: conserva la versione stabile di Miniflare,
  evitando il passaggio alla sua distribuzione alpha per correggere undici.
- `esbuild → $esbuild`: usa la versione 0.28.2 già dichiarata dalla suite
  anche per il vecchio loader transitivo di drizzle-kit.

Gli override richiedono i test HTTP/Miniflare, la build Worker e la verifica
`npm run db:generate`; non basta ottenere un audit verde. Il loader
`@esbuild-kit` rimane deprecato a monte: non è una dipendenza introdotta per
gli editor e andrà rimosso quando una versione stabile di drizzle-kit lo
eliminerà. Non retrocedere drizzle-kit con `npm audit fix --force`.

## Controlli GitHub

`dowitme.yml` verifica installazione da lockfile, audit, typecheck, test della
suite, build hosted e compatibilità degli HTML esportati. I controlli
preesistenti degli editor restano in `ci.yml`, adattati all'installazione
unica. Nessuno di questi workflow pubblica il sito.

Dependabot propone aggiornamenti npm e GitHub Actions. Le modifiche major
restano separate dai gruppi minor/patch; non è configurato alcun auto-merge.

## Separazione degli editor

Decisione confermata l’8 settembre 2026: conservare i motori esistenti e
migliorarli quando emergono problemi verificabili. Non sostituire algoritmi
funzionanti per cambiare provenienza al codice.

`kernel/src/workbench.ts` definisce la composizione opzionale della barra:
il motore fornisce i controlli vivi, dowitme decide titolo, navigazione,
cronologia, strumenti e azioni in `office/editors/workbench.ts` e relativo CSS.
Non si clonano pulsanti e non si simulano clic su un’applicazione nascosta:
listener, stato disabilitato, menu, salvataggio e scorciatoie restano collegati
agli stessi oggetti. Gli editor standalone non forniscono questo host e
mantengono la loro composizione originale.

La suite conserva gli iframe della stessa origine per documenti e slide:
isolano CSS e registri dei moduli. Il foglio gira nella pagina della suite.
I pannelli e gli strumenti specifici restano componenti derivati da bento;
questa separazione non è una riscrittura integrale dei tre editor.
Persistenza, ruoli, proposte e cronologia appartengono al controller della
suite, attraverso `office/shared/editor-host.ts` e `dash/src/officehost.ts`.

Le traduzioni della suite usano il kernel senza registrare implicitamente
un catalogo editor. Il foglio riattiva esplicitamente il proprio catalogo
all’avvio dopo i caricamenti degli altri formati. Il tema si propaga tra
frame e schede tramite l’evento storage; non modifica il contenuto dei file.

ID persistenti, campi sconosciuti, formati e blocco `#bento-doc` restano
vincoli di compatibilità. Copyright e licenza del codice derivato rimangono.
Gli aggiornamenti upstream sono selettivi, revisionati e verificati dai
controlli degli editor e della suite; non si copiano directory o bundle.

## Verifica del passaggio alla composizione comune — 2026-09-08

- Installazione pulita `npm ci`, audit senza segnalazioni, typecheck e 65 test
  della suite, inclusi isolamento dei cataloghi e propagazione del tema.
- Build hosted e tre build standalone; conformance gate sui file prodotti
  e sugli HTML realmente scaricati dalla UI.
- Rigs hosted type/slides, catalogo dash, azioni e pannelli dash, storage e temi.
- Browser desktop 1440×960 e mobile 390×844: rinomina persistente, scrittura
  di testo, inserimento di testo nelle slide, formula `=1+2` risultante in 3;
  undo/redo e download HTML per tutti i tre formati. Nessun errore JavaScript
  durante questi flussi. Barra a 390px senza overflow orizzontale.

La verifica locale non equivale a pubblicazione: questo cambiamento è nella
PR di manutenzione, non nel sito già pubblicato.
