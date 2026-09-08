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

Questa manutenzione non trasforma gli editor ereditati in editor originali.
Oggi il frontend importa il bootstrap di dash; documenti e presentazioni
montano gli editor type/slides in iframe della stessa origine. La suite
fornisce persistenza, autorizzazioni, proposte, cronologia e undo attraverso
`office/shared/editor-host.ts` e il controller.

La richiesta di prodotto è creare editor autonomi di dowitme. Prima di
sostituirli va decisa la provenienza dei motori: mantenere codice derivato
per calcolo/rendering/compatibilità, oppure sostituire anche quei motori.
Sono due migrazioni diverse; una riorganizzazione dei percorsi o del marchio
non soddisfa nessuna delle due.

In entrambi i casi gli editor nuovi devono rispettare le transazioni del
controller, i permessi server, gli ID persistenti, la preservazione dei
campi sconosciuti e l'importazione dei documenti esistenti. Il codice derivato
mantiene copyright e licenza. La riscrittura non deve rendere modificabile un
file in sola lettura, perdere contenuti non supportati o aggirare le proposte
degli agenti. Il sito attuale resta invariato fino a verifica e pubblicazione
esplicitamente autorizzata della sostituzione.
