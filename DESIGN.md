---
name: dowitme — dashboard e chrome ospitata
description: Identità dowitme e sistema visivo della dashboard e degli editor ospitati, estratti dal codice.
colors:
  home-bg: "#faf7f3"
  home-surface: "#fff"
  home-ink: "#30263c"
  home-muted: "#72677d"
  home-line: "#e9e1ec"
  home-blue: "#503178"
  home-blue-bg: "#f0eaf8"
  home-green: "#167354"
  home-green-bg: "#eaf7f0"
  home-orange: "#b6501f"
  home-orange-bg: "#fff2e9"
  home-focus: "#71459e"
  brand-apricot: "#FFB278"
  chrome-surface: "#fffdfb"
  chrome-panel: "#f4eef6"
  creation-green: "#26654e"
  creation-green-bg: "#edf4f1"
  creation-orange: "#965023"
  creation-orange-bg: "#fff0e2"
typography:
  headline:
    fontFamily: "Manrope, sans-serif"
    fontSize: "clamp(26px, 2.5vw, 36px)"
    fontWeight: 750
    lineHeight: 1.25
    letterSpacing: "-.035em"
  title:
    fontSize: "17px"
    fontWeight: 750
    letterSpacing: "-.025em"
  body:
    fontFamily: "Manrope, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "12px"
    lineHeight: 1.7
  label:
    fontSize: "11px"
    fontWeight: 600
rounded:
  action: "12px"
  row: "8px"
  navigation: "14px"
  filter: "10px"
  inline-form: "12px"
  field: "7px"
  surface: "14px"
  creation: "16px"
  dialog: "16px"
spacing:
  compact: "6px"
  inline: "12px"
  group: "16px"
  mobile-edge: "18px"
components:
  button-primary:
    backgroundColor: "{colors.home-blue}"
    textColor: "{colors.home-surface}"
    rounded: "{rounded.action}"
    padding: "11px 18px"
  text-action:
    textColor: "{colors.home-muted}"
    padding: "8px 6px"
  icon-action:
    textColor: "{colors.home-muted}"
    width: "32px"
    height: "32px"
    rounded: "{rounded.field}"
  input:
    backgroundColor: "{colors.home-surface}"
    textColor: "{colors.home-ink}"
    rounded: "{rounded.field}"
    padding: "10px 12px"
  navigation-active:
    rounded: "{rounded.navigation}"
    backgroundColor: "{colors.home-blue-bg}"
    textColor: "{colors.home-blue}"
    padding: "12px"
  filter:
    textColor: "{colors.home-muted}"
    rounded: "{rounded.filter}"
    padding: "8px 10px"
  folder:
    backgroundColor: "{colors.chrome-surface}"
    textColor: "{colors.home-ink}"
    rounded: "{rounded.surface}"
    padding: "17px 16px"
  create-spreadsheet:
    backgroundColor: "{colors.creation-green-bg}"
    textColor: "{colors.creation-green}"
    rounded: "{rounded.creation}"
    padding: "25px 22px"
---

# Design System: dowitme — dashboard e chrome ospitata

## Overview

**Creative North Star: "Il tavolo di lavoro personale"**

Il tavolo di lavoro personale: contenuto centrale, comandi leggibili e archivio compatto. L’identità approvata è dowitme, con monogramma dw fluido (direzione D) e palette 02 viola/albicocca. Superfici avorio, testo prugna e controlli arrotondati rendono coerenti dashboard e chrome degli editor ospitati.

La dashboard adotta Manrope e la chrome ospitata condivide logo e colori. I contenuti, i temi dei documenti, i formati e i crediti bento restano indipendenti dall’identità della suite.

**Key Characteristics:**
- Tre accenti semantici distinguono i formati dei file.
- Superfici prevalentemente piatte, delimitate da tono e bordi sottili.
- Titoli compatti e metadati subordinati, con navigazione adattata alla larghezza.

Fonti: `office/client/brand.css`, `office/client/brand.ts`, `office/client/dashboard.css`, `office/client/dashboard.ts` e `PRODUCT.md`. Aggiornamento dell’8 settembre 2026 confrontato con le catture `.impeccable/review/desktop.png`, `mobile.png`, `docs.png`, `sheets.png`, `slides.png`. Le immagini documentano il rendering chiaro delle superfici mostrate; non provano tutti gli stati interattivi o il tema scuro.

## Colors

La palette affianca neutrali caldi e prugna a tre coppie inchiostro/fondo pastello; i valori normativi sono nel frontmatter. Le rampe OKLCH del sidecar sono sintetizzate per le anteprime del pannello, non sono token implementati né palette approvate per nuove superfici.

### Primary

`home-blue` conserva il nome tecnico storico ma ora indica il viola di documenti, azioni primarie e navigazione selezionata; `home-blue-bg` ne è la superficie tenue. `home-focus` mantiene il contorno di focus distinto dal riempimento del controllo.

### Secondary

`brand-apricot` è l’accento albicocca del monogramma e della variabile slash della chrome. I fogli restano verdi: `home-green` e `home-green-bg` nelle icone, `creation-green` e `creation-green-bg` sulla scheda di creazione.

### Tertiary

`home-orange` e `home-orange-bg` identificano le presentazioni nelle icone; `creation-orange` e `creation-orange-bg` ne ammorbidiscono la scheda di creazione. Il colore non sostituisce mai etichetta e disegno del formato.

### Neutral

`home-bg` è lo sfondo generale; `home-surface` sostiene campi e dialoghi; `chrome-surface` è il bianco caldo di rail, cartelle e testate ospitate. `home-ink` è il testo principale, `home-muted` accompagna metadati e controlli secondari, `home-line` separa superfici e righe.

**The File Identity Rule.** La famiglia cromatica di formato resta riconoscibile tra creazione, icona del file e punto del filtro; le schede usano varianti attenuate.

## Typography

Manrope è caricato da un font locale variabile (pesi 200–800), con `font-display: swap`. La famiglia della dashboard comprende fallback di sistema; titoli principali e dialoghi dichiarano Manrope con fallback sans-serif.

La gerarchia headline identifica il titolo della pagina; title descrive le intestazioni di sezione; body descrive la prosa introduttiva; label descrive filtri e azioni testuali. Non esiste un unico stile body applicato a tutto: nomi dei file sono 12px/700, titoli di creazione 15px/750, metadati tipicamente 10px, dialoghi 19px. I paragrafi introduttivi hanno misura massima 60ch. Date e contatore usano cifre tabulari. I titoli possono andare a capo, le etichette delle cartelle usano ellissi.

I valori più piccoli sono registrati come densità attuale, non come obiettivo universale di leggibilità. Non esiste una scala tipografica matematica dichiarata.

## Layout

La shell desktop usa una rail di 232px e una colonna `minmax(0,1fr)`. La rail è sticky, alta 100dvh; il contenuto principale ha larghezza massima 1392px e padding `52px clamp(24px,4vw,64px) 64px`. Il titolo e la ricerca precedono creazione, cartelle e archivio: è la composizione specifica della dashboard, non una regola per ogni pagina futura.

Creazione e cartelle occupano tre colonne con gap rispettivamente 16px e 12px; la separazione delle sezioni è di 38px. La ricerca misura 240px su desktop. Le righe file separano nome, posizione, data, ruolo e azioni; le azioni restano in una colonna di 68px.

A larghezze ≤1180px la rail scende a 200px, titolo e ricerca si impilano, le cartelle passano a due colonne; posizione e ruolo dei file vengono nascosti. I comandi di creazione mantengono tre colonne ma dispongono verticalmente icona e testo.

A larghezze ≤700px la rail diventa una testata con navigazione orizzontale; scheda spazio, cartelle laterali e profilo vengono nascosti. Il corpo usa padding `27px 18px 40px`; la creazione passa a una colonna e le cartelle restano su due. Date e intestazioni delle righe scompaiono: restano collegamento al file e azioni. Titolo pagina 27px; dialoghi con padding 22px. A larghezze ≥1500px le schede di creazione aumentano l’altezza minima a 152px e i titoli a 17px.

## Elevation & Depth

Le superfici ordinarie sono piatte, separate da colore e bordo sottile. L’hover delle cartelle cambia bordo e fondo; le righe file assumono un fondo lilla tenue. Il dialogo usa l’unica ombra strutturale (`0 22px 90px #16213940`) e un backdrop (`#18233f66`). Non vengono impiegati gradienti o blur in questo stylesheet.

**The Dialog Depth Rule.** Il dialogo introduce profondità per separare un’azione contestuale dall’archivio sottostante.

Solo con `prefers-reduced-motion: no-preference`, le schede di creazione abilitate si sollevano di 3px in hover e i dialoghi entrano con traslazione di 8px e clip-path. Durata 180ms, curva di trasformazione `cubic-bezier(.16,1,.3,1)`; colore e bordo delle schede usano `ease`. Non estendere il movimento ai controlli disabilitati.

## Shapes

Angoli morbidi e contenuti: campi e pulsanti icona condividono il raggio field; pulsanti primari il raggio action, righe file il raggio row, cartelle il raggio surface e form inline il raggio inline-form. La creazione usa il raggio creation e il dialogo il raggio dialog. Navigazione e ricerca condividono 14px; i filtri usano 10px. Avatar, punti di formato e piccolo segno più hanno forma circolare.

Le icone sono SVG geometrici inline a tratto arrotondato, non glifi di font. Le icone file condividono foglio con angolo ripiegato, disegno interno specifico e due dimensioni: 31×37px nella lista e 51×60px nella creazione desktop (37×44px su mobile).

## Components

### Identity and hosted chrome

Il logo usa `office/client/assets/dowitme-symbol.webp`, con trasparenza alpha reale, accanto al nome dowitme in minuscolo. Conservare la silhouette dw fluida e l’accento albicocca; non simulare la trasparenza con blend mode. Nella rail il simbolo misura 50×38px, su mobile 42×32px. Le barre ospitate usano misure più compatte e nascondono il nome interno sotto 700px. Il tema scuro dispone di override locali viola chiaro e prugna scura in `brand.css`; le catture di questo passaggio mostrano il tema chiaro. L’identità si applica alla chrome, senza riscrivere palette o tipografia del contenuto dei file.

### Buttons

Il primario viola conferma creazione, spostamento e accesso; hover più scuro (`#3d235c`). Le azioni testuali sono trasparenti e attenuate, con fondo lilla e testo viola in hover. I pulsanti icona hanno area 32×32px, SVG 17px e hover tenue. Tutti i controlli disabilitati hanno opacità .5 e cursore non consentito. Pulsanti, link, input e select ricevono un outline di focus di 3px, offset 3px.

### Creation cards

Tre ampi pulsanti, uno per formato, con icona foglio, titolo, breve descrizione e segno più. Altezza minima desktop 132px; su mobile 90px. Hover con bordo del colore di formato; il movimento è subordinato alla preferenza utente. I controlli possono essere disabilitati secondo spazio e permessi: la palette non implica disponibilità.

### Inputs / Fields

La ricerca è un contenitore bianco bordato con icona 18px e campo interno trasparente. I campi dei moduli usano bordo neutro e raggio field. Il form di denominazione appare inline; selezione della destinazione e concessione accessi vivono in dialoghi. I campi mantengono contorno di focus; errori sono regioni `role="alert"` con fondo rosato e testo rosso scuro.

### Navigation

Voci compatte con icona, testo allineato a sinistra e stato attivo lilla e testo viola. Le voci di spazio espongono `aria-current`; la rail elenca anche cartelle personali. Il cambio di spazio o cartella azzera la ricerca. Su mobile la navigazione resta esplicita nella testata.

### Filters

Pulsanti compatti con stato `aria-pressed`, testo e punto colorato per formato; selezionato con fondo `#eaddf4` e testo `#503178`. Il selettore di ordinamento affianca i filtri su desktop e scende sotto su mobile.

### Folders and file rows

Le cartelle sono pulsanti bianco caldo bordati con icona calda, nome e conteggio. I file sono righe con collegamento nativo, icona semantica, tipo e metadati progressivamente ridotti ai breakpoint. Le azioni di spostamento e condivisione hanno nome accessibile; la disponibilità dipende dal ruolo. Il contatore riflette l’elenco filtrato.

### Dialogs and feedback

Dialoghi nativi con larghezza `min(500px,calc(100vw - 32px))`, altezza massima 85dvh, scrolling interno, titolo e chiusura. Elenchi di accesso separano nome, ruolo e provenienza del permesso. Loading, errore con riprova e archivio vuoto sono stati espliciti; l’elenco file usa `aria-live="polite"`. Il sidecar illustra gli stili, non implementa questi flussi.

## Do's and Don'ts

### Do:
- Do mantenere la corrispondenza documento/viola, foglio/verde, presentazione/arancio insieme a icona e testo.
- Do mantenere focus visibile e stati disabled dei controlli.
- Do adattare la densità con i breakpoint esistenti e conservare titolo e azioni dei file su mobile.
- Do usare dowitme in minuscolo nella suite, preservando crediti e identificatori bento e i cataloghi di traduzione della UI.

### Don't:
- Don’t trasferire i token della chrome ai contenuti o ai temi dei documenti.
- Don’t aggiungere ombre alle superfici ordinarie della dashboard: il rilievo strutturale appartiene ai dialoghi.
- Don’t trasformare gli esempi statici del sidecar in prova di comportamento o verifica visiva.


## Area editor comune

Modalità Operate. La composizione ospitata separa identità del file e strumenti:
prima riga con titolo a sinistra, salvataggio e Altro a destra; seconda riga
con cronologia, strumenti di modifica e navigazione. Niente tipo del documento
ripetuto accanto al titolo e niente ritorno a capo incontrollato dei comandi.

Sotto 1200px gli strumenti si spostano in pannelli nativi popover, con ingressi
etichettati Inserisci/Strumenti e Vista. Il pannello si apre in basso, ha titolo,
chiusura da 44px, altezza massima 70dvh, scorrimento e sottomenu interni. Altro
contiene azioni nominate; nei documenti espone direttamente revisione, firma,
stampa e opzioni, senza un secondo Altro annidato. Escape chiude e riporta
il focus all’ingresso. I comandi di inserimento restituiscono il contenuto.

Da 1200px strumenti e navigazione sono esposti nella seconda riga. I pannelli
secondari di Altro si aprono vicino al pulsante. La stessa istanza di ciascun
controllo viene spostata al cambio di larghezza, conservando stato e listener.
Il campo titolo usa 17px su desktop e 16px in modalità compatta per evitare
lo zoom automatico durante la modifica sui browser mobili. Controlli principali
con altezza 40–44px in modalità compatta, 36px su desktop; raggio 7px.

La barra ospitata misura circa 107px in modalità compatta e 109px su desktop,
esclusa la testata della suite. La superficie attorno alle slide è uniforme:
la griglia decorativa non compete con la presentazione. Il documento mantiene
i suoi colori. I pannelli usano raggio 14px, ombra prugna #100b203d a 14px/48px
e backdrop #100b202e su mobile; animazione di entrata 160ms disabilitata con
movimento ridotto.

Verifica browser del 2026-09-08: tre editor, temi chiaro/scuro, larghezze
320/390/768/1199/1200/1440px, orientamento largo a 768×500. Nessun overflow
della barra; inserimento, undo/redo e chiusura dei pannelli funzionanti.
Le otto lingue offerte sono state controllate sulle slide a 1200px. Sono prove
in browser con viewport emulati, non certificazione su dispositivi fisici.

Fonti: `office/editors/workbench.ts` e `workbench.css`; il contratto dei controlli
vivi è `kernel/src/workbench.ts`. La composizione non modifica i formati dei file.
